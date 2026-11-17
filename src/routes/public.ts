import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config.js';
import { queryOne } from '../db.js';
import { renderMarkdown } from '../lib/markdown.js';
import { renderPage } from '../lib/render.js';
import {
  absoluteUrl,
  buildQueryString,
  escapeXml,
  formatDate,
  pageWindow,
} from '../lib/utils.js';
import { listLinks } from '../services/admin.js';
import {
  createComment,
  getAdjacentPosts,
  getApprovedComments,
  getArchivePosts,
  getCategoriesWithCounts,
  getFeaturedPost,
  getPostBySlug,
  getRelatedPosts,
  getSiteStats,
  getTagsWithCounts,
  incrementPostView,
  listPosts,
} from '../services/posts.js';
import { getSettings } from '../services/settings.js';

export const publicRouter = Router();

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: '评论提交太频繁，请稍后再试。',
});

function positivePage(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function queryText(value: unknown, maxLength = 80): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

publicRouter.get('/', async (req, res) => {
  const settings = await getSettings();
  const perPage = Number.parseInt(settings.posts_per_page, 10) || 9;
  const [featured, latestResult, categories, tags, stats] = await Promise.all([
    getFeaturedPost(),
    listPosts({ page: 1, perPage: perPage + 1 }),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
    getSiteStats(),
  ]);
  const posts = latestResult.posts.filter((post) => post.id !== featured?.id).slice(0, perPage);
  await renderPage(res, 'home', {
    pageTitle: null,
    pageDescription: settings.site_description,
    canonicalPath: '/',
    bodyClass: 'home-page',
    featured,
    posts,
    categories,
    tags: tags.slice(0, 14),
    stats,
  });
});

publicRouter.get('/posts', async (req, res) => {
  const settings = await getSettings();
  const page = positivePage(req.query.page);
  const categorySlug = queryText(req.query.category);
  const tagSlug = queryText(req.query.tag);
  const q = queryText(req.query.q, 120);
  const perPage = Number.parseInt(settings.posts_per_page, 10) || 9;
  const [result, categories, tags] = await Promise.all([
    listPosts({ page, perPage, categorySlug, tagSlug, q }),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
  ]);
  const activeCategory = categories.find((category) => category.slug === categorySlug);
  const activeTag = tags.find((tag) => tag.slug === tagSlug);
  const heading = q ? `搜索：${q}` : activeCategory?.name ?? activeTag?.name ?? '全部文章';
  const description = activeCategory?.description ?? (q ? `站内搜索“${q}”的结果。` : '按时间浏览全部公开文章。');

  await renderPage(res, 'posts', {
    pageTitle: heading,
    pageDescription: description,
    canonicalPath: `/posts${buildQueryString({ category: categorySlug, tag: tagSlug, q })}`,
    bodyClass: 'posts-page',
    result,
    categories,
    tags,
    activeCategory,
    activeTag,
    q,
    categorySlug,
    tagSlug,
    heading,
    description,
    pageWindow: pageWindow(result.page, result.totalPages),
  });
});

publicRouter.get('/category/:slug', (req, res) => {
  res.redirect(301, `/posts?category=${encodeURIComponent(req.params.slug)}`);
});

publicRouter.get('/tag/:slug', (req, res) => {
  res.redirect(301, `/posts?tag=${encodeURIComponent(req.params.slug)}`);
});

publicRouter.get('/posts/:slug', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const post = await getPostBySlug(String(req.params.slug));
    if (!post) {
      res.status(404);
      await renderPage(res, 'error', {
        statusCode: 404,
        title: '这篇文章不见了',
        message: '它可能被移动、归档，或者从未发表。',
        pageTitle: '文章未找到',
        bodyClass: 'error-page',
      });
      return;
    }
    const [{ html, toc }, comments, adjacent, related] = await Promise.all([
      renderMarkdown(post.content),
      getApprovedComments(post.id),
      getAdjacentPosts(post),
      getRelatedPosts(post, 3),
    ]);
    await incrementPostView(post.id);
    post.view_count += 1;

    await renderPage(res, 'post', {
      pageTitle: post.title,
      pageDescription: post.excerpt || settings.site_description,
      canonicalPath: `/posts/${post.slug}`,
      bodyClass: 'post-page',
      post,
      postHtml: html,
      toc,
      comments,
      adjacent,
      related,
      ogType: 'article',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: { '@type': 'Person', name: post.author_name },
        mainEntityOfPage: absoluteUrl(`/posts/${post.slug}`, env.SITE_URL),
      },
    });
  } catch (error) {
    next(error);
  }
});

const commentSchema = z.object({
  author_name: z.string().trim().min(2, '请填写至少 2 个字符的称呼').max(80),
  author_email: z.string().trim().email('请填写有效邮箱').max(190),
  author_website: z.string().trim().max(300).optional().default(''),
  content: z.string().trim().min(2, '评论内容太短').max(3000, '评论不能超过 3000 字'),
  parent_id: z.string().optional().default(''),
});

publicRouter.post('/posts/:slug/comments', commentLimiter, async (req, res, next) => {
  try {
    const post = await getPostBySlug(String(req.params.slug));
    if (!post) {
      res.status(404).send('Post not found');
      return;
    }
    if (!post.allow_comments) {
      req.session!.flash = { type: 'error', message: '这篇文章已关闭评论。' };
      res.redirect(`/posts/${post.slug}#comments`);
      return;
    }
    if (String(req.body.company_website ?? '').trim()) {
      res.redirect(`/posts/${post.slug}#comments`);
      return;
    }
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      req.session!.flash = { type: 'error', message: parsed.error.issues[0]?.message ?? '评论格式不正确。' };
      res.redirect(`/posts/${post.slug}#comment-form`);
      return;
    }
    let parentId: number | null = null;
    if (parsed.data.parent_id) {
      const candidate = Number.parseInt(parsed.data.parent_id, 10);
      if (Number.isFinite(candidate)) {
        const parent = await queryOne<import('mysql2/promise').RowDataPacket & { post_id: number }>(
          "SELECT post_id FROM comments WHERE id = ? AND status = 'approved' LIMIT 1",
          [candidate],
        );
        if (parent?.post_id === post.id) parentId = candidate;
      }
    }
    const website = parsed.data.author_website
      ? /^https?:\/\//i.test(parsed.data.author_website)
        ? parsed.data.author_website
        : `https://${parsed.data.author_website}`
      : null;
    await createComment({
      postId: post.id,
      parentId,
      authorName: parsed.data.author_name,
      authorEmail: parsed.data.author_email,
      authorWebsite: website,
      content: parsed.data.content,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    req.session!.flash = {
      type: 'success',
      message: '评论已送达。审核通过后会出现在这里。',
    };
    res.redirect(`/posts/${post.slug}#comments`);
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/archives', async (req, res) => {
  const [posts, stats] = await Promise.all([getArchivePosts(), getSiteStats()]);
  const groups: Array<{
    year: string;
    months: Array<{ month: string; label: string; posts: typeof posts }>;
  }> = [];
  for (const post of posts) {
    if (!post.published_at) continue;
    const [year, month] = post.published_at.slice(0, 7).split('-');
    let yearGroup = groups.find((group) => group.year === year);
    if (!yearGroup) {
      yearGroup = { year: year!, months: [] };
      groups.push(yearGroup);
    }
    let monthGroup = yearGroup.months.find((group) => group.month === month);
    if (!monthGroup) {
      monthGroup = { month: month!, label: `${Number(month)} 月`, posts: [] };
      yearGroup.months.push(monthGroup);
    }
    monthGroup.posts.push(post);
  }
  await renderPage(res, 'archives', {
    pageTitle: '文章归档',
    pageDescription: '按时间回看每一篇公开文章。',
    canonicalPath: '/archives',
    bodyClass: 'archives-page',
    groups,
    stats,
  });
});

publicRouter.get('/categories', async (req, res) => {
  const categories = await getCategoriesWithCounts();
  await renderPage(res, 'categories', {
    pageTitle: '分类',
    pageDescription: '按主题浏览文章。',
    canonicalPath: '/categories',
    bodyClass: 'categories-page',
    categories,
  });
});

publicRouter.get('/tags', async (req, res) => {
  const tags = await getTagsWithCounts();
  await renderPage(res, 'tags', {
    pageTitle: '标签',
    pageDescription: '从一个关键词开始探索。',
    canonicalPath: '/tags',
    bodyClass: 'tags-page',
    tags,
  });
});

publicRouter.get('/about', async (req, res) => {
  const settings = await getSettings();
  const { html } = await renderMarkdown(settings.about_markdown);
  const stats = await getSiteStats();
  await renderPage(res, 'about', {
    pageTitle: '关于',
    pageDescription: settings.author_bio,
    canonicalPath: '/about',
    bodyClass: 'about-page',
    aboutHtml: html,
    stats,
  });
});

publicRouter.get('/links', async (req, res) => {
  const links = await listLinks(true);
  await renderPage(res, 'links', {
    pageTitle: '友链',
    pageDescription: '一些值得反复访问的个人站点。',
    canonicalPath: '/links',
    bodyClass: 'links-page',
    links,
  });
});

publicRouter.get('/feed.xml', async (req, res) => {
  const settings = await getSettings();
  const result = await listPosts({ page: 1, perPage: 20 });
  const siteUrl = env.SITE_URL;
  const items = result.posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(absoluteUrl(`/posts/${post.slug}`, siteUrl))}</link>
      <guid isPermaLink="true">${escapeXml(absoluteUrl(`/posts/${post.slug}`, siteUrl))}</guid>
      <pubDate>${new Date(post.published_at ?? Date.now()).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.category_name ?? '未分类')}</category>
    </item>`,
    )
    .join('\n');
  res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(settings.site_title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(settings.site_description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`);
});

publicRouter.get('/sitemap.xml', async (req, res) => {
  const settings = await getSettings();
  const [posts, categories, tags] = await Promise.all([
    getArchivePosts(),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
  ]);
  const staticPages = ['/', '/posts', '/archives', '/categories', '/tags', '/about', '/links'];
  const urls = [
    ...staticPages.map((path) => ({ path, lastmod: null as string | null })),
    ...posts.map((post) => ({ path: `/posts/${post.slug}`, lastmod: post.published_at })),
    ...categories.map((category) => ({ path: `/posts?category=${category.slug}`, lastmod: null })),
    ...tags.map((tag) => ({ path: `/posts?tag=${tag.slug}`, lastmod: null })),
  ];
  const body = urls
    .map(
      (item) => `  <url><loc>${escapeXml(absoluteUrl(item.path, env.SITE_URL))}</loc>${item.lastmod ? `<lastmod>${item.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`);
});

publicRouter.get('/health', async (req, res) => {
  try {
    await queryOne('SELECT 1 AS ok');
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});
