import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2/promise';
import { execute } from '../db.js';
import { renderMarkdown } from '../lib/markdown.js';
import { renderAdminPage } from '../lib/render.js';
import { buildQueryString, pageWindow, formatDateTime } from '../lib/utils.js';
import {
  createCategory,
  createLink,
  createTag,
  deleteCategory,
  deleteComment,
  deleteLink,
  deleteTag,
  getRecentAdminPosts,
  listAdminCategories,
  listAdminComments,
  listAdminTags,
  listLinks,
  setCommentStatus,
  updateCategory,
  updateLink,
  updatePassword,
  updateTag,
  type AdminUser,
} from '../services/admin.js';
import {
  createPost,
  deletePost,
  getAdminPost,
  getAdminStats,
  listAdminPosts,
  setPostStatus,
  updatePost,
  type PostInput,
  type PostStatus,
} from '../services/posts.js';
import { getSettings, saveSettings, settingDefinitions, type SettingKey } from '../services/settings.js';

export const adminRouter = Router();

const postSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(255),
  slug: z.string().trim().max(190).optional().default(''),
  excerpt: z.string().trim().max(500).optional().default(''),
  content: z.string().min(1, '正文不能为空'),
  cover_url: z.string().trim().max(500).optional().default(''),
  category_id: z.string().optional().default(''),
  status: z.enum(['draft', 'published', 'archived']),
  featured: z.string().optional(),
  allow_comments: z.string().optional(),
  tags: z.string().optional().default(''),
  published_at: z.string().optional().default(''),
});

function parsePostInput(body: Record<string, unknown>, authorId: number): PostInput {
  const parsed = postSchema.parse(body);
  const categoryId = parsed.category_id ? Number.parseInt(parsed.category_id, 10) : null;
  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    content: parsed.content,
    coverUrl: parsed.cover_url,
    categoryId: Number.isFinite(categoryId) ? categoryId : null,
    status: parsed.status,
    featured: parsed.featured === 'on' || parsed.featured === '1',
    allowComments: parsed.allow_comments === 'on' || parsed.allow_comments === '1',
    tags: parsed.tags.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean),
    publishedAt: parsed.published_at || null,
    authorId,
  };
}

function duplicateMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    return '名称或网址已经存在，请换一个。';
  }
  return null;
}

adminRouter.get('/', async (req, res) => {
  const [stats, posts] = await Promise.all([getAdminStats(), getRecentAdminPosts(6)]);
  await renderAdminPage(res, 'admin/dashboard', {
    pageTitle: '概览',
    bodyClass: 'admin-dashboard',
    stats,
    posts,
    activeNav: 'dashboard',
  });
});

adminRouter.get('/posts', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const status = String(req.query.status ?? '') as PostStatus | '';
  const q = String(req.query.q ?? '').trim().slice(0, 120);
  const result = await listAdminPosts({ page, perPage: 15, status, q });
  await renderAdminPage(res, 'admin/posts', {
    pageTitle: '文章',
    bodyClass: 'admin-posts',
    result,
    status,
    q,
    pageWindow: pageWindow(result.page, result.totalPages),
    queryString: buildQueryString({ status, q }),
    activeNav: 'posts',
  });
});

adminRouter.get('/posts/new', async (req, res) => {
  const [categories, tags] = await Promise.all([listAdminCategories(), listAdminTags()]);
  await renderAdminPage(res, 'admin/post-form', {
    pageTitle: '写新文章',
    bodyClass: 'admin-editor',
    post: null,
    categories,
    tagSuggestions: tags,
    activeNav: 'posts',
  });
});

adminRouter.get('/posts/:id/edit', async (req, res) => {
  const post = await getAdminPost(Number(req.params.id));
  if (!post) {
    res.status(404).send('Post not found');
    return;
  }
  const [categories, tags] = await Promise.all([listAdminCategories(), listAdminTags()]);
  await renderAdminPage(res, 'admin/post-form', {
    pageTitle: `编辑：${post.title}`,
    bodyClass: 'admin-editor',
    post,
    categories,
    tagSuggestions: tags,
    activeNav: 'posts',
  });
});

adminRouter.post('/posts', async (req, res, next) => {
  try {
    const user = res.locals.currentUser as AdminUser;
    const input = parsePostInput(req.body, user.id);
    const insertId = await createPost(input);
    req.session!.flash = { type: 'success', message: '文章已创建。' };
    res.redirect(`/admin/posts/${insertId}/edit`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      req.session!.flash = { type: 'error', message: error.issues[0]?.message ?? '文章格式不正确。' };
      res.redirect('/admin/posts/new');
      return;
    }
    next(error);
  }
});

adminRouter.post('/posts/:id', async (req, res, next) => {
  try {
    const user = res.locals.currentUser as AdminUser;
    const input = parsePostInput(req.body, user.id);
    await updatePost(Number(req.params.id), input);
    req.session!.flash = { type: 'success', message: '文章已保存。' };
    res.redirect(`/admin/posts/${req.params.id}/edit`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      req.session!.flash = { type: 'error', message: error.issues[0]?.message ?? '文章格式不正确。' };
      res.redirect(`/admin/posts/${req.params.id}/edit`);
      return;
    }
    next(error);
  }
});

adminRouter.post('/posts/:id/status', async (req, res) => {
  const status = String(req.body.status ?? '') as PostStatus;
  if (['draft', 'published', 'archived'].includes(status)) {
    await setPostStatus(Number(req.params.id), status);
    req.session!.flash = { type: 'success', message: '文章状态已更新。' };
  }
  res.redirect(req.get('referer') || '/admin/posts');
});

adminRouter.post('/posts/:id/delete', async (req, res) => {
  await deletePost(Number(req.params.id));
  req.session!.flash = { type: 'success', message: '文章已删除。' };
  res.redirect('/admin/posts');
});

adminRouter.post('/preview', async (req, res) => {
  const rendered = await renderMarkdown(String(req.body.content ?? ''));
  res.json(rendered);
});

adminRouter.get('/comments', async (req, res) => {
  const status = String(req.query.status ?? '');
  const comments = await listAdminComments(status);
  await renderAdminPage(res, 'admin/comments', {
    pageTitle: '评论',
    bodyClass: 'admin-comments',
    comments,
    status,
    activeNav: 'comments',
  });
});

adminRouter.post('/comments/:id/status', async (req, res) => {
  const status = String(req.body.status ?? '');
  if (['pending', 'approved', 'spam'].includes(status)) {
    await setCommentStatus(Number(req.params.id), status as 'pending' | 'approved' | 'spam');
    req.session!.flash = { type: 'success', message: '评论状态已更新。' };
  }
  res.redirect(req.get('referer') || '/admin/comments');
});

adminRouter.post('/comments/:id/delete', async (req, res) => {
  await deleteComment(Number(req.params.id));
  req.session!.flash = { type: 'success', message: '评论已删除。' };
  res.redirect('/admin/comments');
});

adminRouter.get('/taxonomy', async (req, res) => {
  const [categories, tags] = await Promise.all([listAdminCategories(), listAdminTags()]);
  await renderAdminPage(res, 'admin/taxonomy', {
    pageTitle: '分类与标签',
    bodyClass: 'admin-taxonomy',
    categories,
    tags,
    activeNav: 'taxonomy',
  });
});

adminRouter.post('/categories', async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim().slice(0, 80);
    if (!name) throw new Error('分类名称不能为空');
    await createCategory({
      name,
      slug: String(req.body.slug ?? ''),
      description: String(req.body.description ?? ''),
      color: String(req.body.color ?? '#0a8a4e'),
    });
    req.session!.flash = { type: 'success', message: '分类已创建。' };
  } catch (error) {
    req.session!.flash = {
      type: 'error',
      message: duplicateMessage(error) ?? (error instanceof Error ? error.message : '分类创建失败。'),
    };
  }
  res.redirect('/admin/taxonomy');
});

adminRouter.post('/categories/:id', async (req, res) => {
  try {
    await updateCategory(Number(req.params.id), {
      name: String(req.body.name ?? '').trim(),
      slug: String(req.body.slug ?? ''),
      description: String(req.body.description ?? ''),
      color: String(req.body.color ?? '#0a8a4e'),
    });
    req.session!.flash = { type: 'success', message: '分类已更新。' };
  } catch (error) {
    req.session!.flash = { type: 'error', message: duplicateMessage(error) ?? '分类更新失败。' };
  }
  res.redirect('/admin/taxonomy');
});

adminRouter.post('/categories/:id/delete', async (req, res) => {
  await deleteCategory(Number(req.params.id));
  req.session!.flash = { type: 'success', message: '分类已删除，相关文章会变为未分类。' };
  res.redirect('/admin/taxonomy');
});

adminRouter.post('/tags', async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim().slice(0, 60);
    if (!name) throw new Error('标签名称不能为空');
    await createTag(name);
    req.session!.flash = { type: 'success', message: '标签已创建。' };
  } catch (error) {
    req.session!.flash = { type: 'error', message: duplicateMessage(error) ?? '标签创建失败。' };
  }
  res.redirect('/admin/taxonomy');
});

adminRouter.post('/tags/:id', async (req, res) => {
  try {
    await updateTag(Number(req.params.id), String(req.body.name ?? '').trim());
    req.session!.flash = { type: 'success', message: '标签已更新。' };
  } catch (error) {
    req.session!.flash = { type: 'error', message: duplicateMessage(error) ?? '标签更新失败。' };
  }
  res.redirect('/admin/taxonomy');
});

adminRouter.post('/tags/:id/delete', async (req, res) => {
  await deleteTag(Number(req.params.id));
  req.session!.flash = { type: 'success', message: '标签已删除。' };
  res.redirect('/admin/taxonomy');
});

adminRouter.get('/links', async (req, res) => {
  const links = await listLinks(false);
  await renderAdminPage(res, 'admin/links', {
    pageTitle: '友链',
    bodyClass: 'admin-links',
    links,
    activeNav: 'links',
  });
});

adminRouter.post('/links', async (req, res) => {
  try {
    await createLink({
      name: String(req.body.name ?? '').trim(),
      url: String(req.body.url ?? '').trim(),
      description: String(req.body.description ?? '').trim(),
      avatarUrl: String(req.body.avatar_url ?? '').trim(),
      color: String(req.body.color ?? '#0a8a4e'),
      visible: req.body.visible === 'on',
    });
    req.session!.flash = { type: 'success', message: '友链已添加。' };
  } catch (error) {
    req.session!.flash = { type: 'error', message: duplicateMessage(error) ?? '友链添加失败。' };
  }
  res.redirect('/admin/links');
});

adminRouter.post('/links/:id', async (req, res) => {
  try {
    await updateLink(Number(req.params.id), {
      name: String(req.body.name ?? '').trim(),
      url: String(req.body.url ?? '').trim(),
      description: String(req.body.description ?? '').trim(),
      avatarUrl: String(req.body.avatar_url ?? '').trim(),
      color: String(req.body.color ?? '#0a8a4e'),
      visible: req.body.visible === 'on',
      sortOrder: Number.parseInt(String(req.body.sort_order ?? '0'), 10) || 0,
    });
    req.session!.flash = { type: 'success', message: '友链已更新。' };
  } catch (error) {
    req.session!.flash = { type: 'error', message: duplicateMessage(error) ?? '友链更新失败。' };
  }
  res.redirect('/admin/links');
});

adminRouter.post('/links/:id/delete', async (req, res) => {
  await deleteLink(Number(req.params.id));
  req.session!.flash = { type: 'success', message: '友链已删除。' };
  res.redirect('/admin/links');
});

adminRouter.get('/settings', async (req, res) => {
  const settings = await getSettings();
  await renderAdminPage(res, 'admin/settings', {
    pageTitle: '站点设置',
    bodyClass: 'admin-settings',
    settings,
    definitions: settingDefinitions,
    activeNav: 'settings',
  });
});

adminRouter.post('/settings', async (req, res) => {
  const values: Partial<Record<SettingKey, string>> = {};
  settingDefinitions.forEach((definition) => {
    values[definition.key] = String(req.body[definition.key] ?? '').trim();
  });
  const perPage = Number.parseInt(values.posts_per_page ?? '9', 10);
  values.posts_per_page = String(Number.isFinite(perPage) ? Math.min(24, Math.max(3, perPage)) : 9);
  await saveSettings(values);
  req.session!.flash = { type: 'success', message: '站点设置已保存。' };
  res.redirect('/admin/settings');
});

adminRouter.get('/account', async (req, res) => {
  await renderAdminPage(res, 'admin/account', {
    pageTitle: '账号安全',
    bodyClass: 'admin-account',
    activeNav: 'account',
  });
});

adminRouter.post('/account/password', async (req, res) => {
  const user = res.locals.currentUser as AdminUser;
  const currentPassword = String(req.body.current_password ?? '');
  const newPassword = String(req.body.new_password ?? '');
  const confirmPassword = String(req.body.confirm_password ?? '');
  if (newPassword.length < 10) {
    req.session!.flash = { type: 'error', message: '新密码至少需要 10 个字符。' };
    res.redirect('/admin/account');
    return;
  }
  if (newPassword !== confirmPassword) {
    req.session!.flash = { type: 'error', message: '两次输入的新密码不一致。' };
    res.redirect('/admin/account');
    return;
  }
  const { findUserByLogin } = await import('../services/admin.js');
  const dbUser = await findUserByLogin(user.username);
  if (!dbUser || !(await bcrypt.compare(currentPassword, dbUser.password_hash))) {
    req.session!.flash = { type: 'error', message: '当前密码不正确。' };
    res.redirect('/admin/account');
    return;
  }
  await updatePassword(user.id, await bcrypt.hash(newPassword, 12));
  req.session!.flash = { type: 'success', message: '密码已更新，请妥善保管。' };
  res.redirect('/admin/account');
});
