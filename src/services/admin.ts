import type { RowDataPacket } from 'mysql2/promise';
import { execute, queryOne, queryRows } from '../db.js';
import { slugify } from '../lib/utils.js';
import type { CategoryWithCount, TagWithCount } from './posts.js';

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: 'admin' | 'editor';
};

type UserRow = RowDataPacket & AdminUser & { password_hash: string };

export async function findUserByLogin(login: string): Promise<(AdminUser & { password_hash: string }) | null> {
  return queryOne<UserRow>(
    `SELECT id, username, email, display_name, avatar_url, bio, role, password_hash
     FROM users WHERE username = ? OR email = ? LIMIT 1`,
    [login, login],
  );
}

export async function findUserById(id: number): Promise<AdminUser | null> {
  return queryOne<UserRow>(
    `SELECT id, username, email, display_name, avatar_url, bio, role, password_hash
     FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
}

export async function touchLastLogin(id: number): Promise<void> {
  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
}

export async function updatePassword(id: number, passwordHash: string): Promise<void> {
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

export type AdminCommentRow = RowDataPacket & {
  id: number;
  post_id: number;
  post_title: string;
  post_slug: string;
  author_name: string;
  author_email: string;
  author_website: string | null;
  content: string;
  status: 'pending' | 'approved' | 'spam';
  created_at: string;
};

export async function listAdminComments(status = ''): Promise<AdminCommentRow[]> {
  const params: unknown[] = [];
  let filter = '';
  if (status) {
    filter = 'WHERE cm.status = ?';
    params.push(status);
  }
  return queryRows<AdminCommentRow[]>(
    `SELECT cm.id, cm.post_id, p.title AS post_title, p.slug AS post_slug,
            cm.author_name, cm.author_email, cm.author_website, cm.content,
            cm.status, cm.created_at
     FROM comments cm JOIN posts p ON p.id = cm.post_id
     ${filter}
     ORDER BY FIELD(cm.status, 'pending', 'approved', 'spam'), cm.created_at DESC
     LIMIT 200`,
    params,
  );
}

export async function setCommentStatus(id: number, status: 'pending' | 'approved' | 'spam'): Promise<void> {
  await execute('UPDATE comments SET status = ? WHERE id = ?', [status, id]);
}

export async function deleteComment(id: number): Promise<void> {
  await execute('DELETE FROM comments WHERE id = ?', [id]);
}

export async function listAdminCategories(): Promise<CategoryWithCount[]> {
  return queryRows<Array<CategoryWithCount & RowDataPacket>>(
    `SELECT c.id, c.name, c.slug, c.description, c.color, COUNT(p.id) AS post_count
     FROM categories c LEFT JOIN posts p ON p.category_id = c.id
     GROUP BY c.id ORDER BY c.sort_order, c.id`,
  );
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description: string;
  color: string;
}): Promise<void> {
  await execute(
    'INSERT INTO categories (name, slug, description, color) VALUES (?, ?, ?, ?)',
    [input.name, slugify(input.slug || input.name), input.description || null, input.color],
  );
}

export async function updateCategory(id: number, input: {
  name: string;
  slug: string;
  description: string;
  color: string;
}): Promise<void> {
  await execute(
    'UPDATE categories SET name = ?, slug = ?, description = ?, color = ? WHERE id = ?',
    [input.name, slugify(input.slug || input.name), input.description || null, input.color, id],
  );
}

export async function deleteCategory(id: number): Promise<void> {
  await execute('DELETE FROM categories WHERE id = ?', [id]);
}

export async function listAdminTags(): Promise<TagWithCount[]> {
  return queryRows<Array<TagWithCount & RowDataPacket>>(
    `SELECT t.id, t.name, t.slug, COUNT(pt.post_id) AS post_count
     FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id
     GROUP BY t.id ORDER BY t.name`,
  );
}

export async function createTag(name: string): Promise<void> {
  await execute('INSERT INTO tags (name, slug) VALUES (?, ?)', [name, slugify(name)]);
}

export async function updateTag(id: number, name: string): Promise<void> {
  await execute('UPDATE tags SET name = ?, slug = ? WHERE id = ?', [name, slugify(name), id]);
}

export async function deleteTag(id: number): Promise<void> {
  await execute('DELETE FROM tags WHERE id = ?', [id]);
}

export type LinkRow = RowDataPacket & {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  color: string;
  sort_order: number;
  visible: number;
};

export async function listLinks(visibleOnly = false): Promise<LinkRow[]> {
  return queryRows<LinkRow[]>(
    `SELECT id, name, url, description, avatar_url, color, sort_order, visible
     FROM links ${visibleOnly ? 'WHERE visible = 1' : ''}
     ORDER BY sort_order ASC, id ASC`,
  );
}

export async function createLink(input: {
  name: string;
  url: string;
  description: string;
  avatarUrl: string;
  color: string;
  visible: boolean;
}): Promise<void> {
  await execute(
    `INSERT INTO links (name, url, description, avatar_url, color, visible)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.url, input.description || null, input.avatarUrl || null, input.color, input.visible ? 1 : 0],
  );
}

export async function updateLink(id: number, input: {
  name: string;
  url: string;
  description: string;
  avatarUrl: string;
  color: string;
  visible: boolean;
  sortOrder: number;
}): Promise<void> {
  await execute(
    `UPDATE links SET name = ?, url = ?, description = ?, avatar_url = ?, color = ?,
      visible = ?, sort_order = ? WHERE id = ?`,
    [input.name, input.url, input.description || null, input.avatarUrl || null, input.color, input.visible ? 1 : 0, input.sortOrder, id],
  );
}

export async function deleteLink(id: number): Promise<void> {
  await execute('DELETE FROM links WHERE id = ?', [id]);
}

export async function getRecentAdminPosts(limit = 5): Promise<Array<RowDataPacket & {
  id: number;
  title: string;
  status: string;
  published_at: string | null;
  view_count: number;
  category_name: string | null;
}>> {
  return queryRows(
    `SELECT p.id, p.title, p.status, p.published_at, p.view_count, c.name AS category_name
     FROM posts p LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.updated_at DESC LIMIT ?`,
    [limit],
  ) as Promise<Array<RowDataPacket & {
    id: number;
    title: string;
    status: string;
    published_at: string | null;
    view_count: number;
    category_name: string | null;
  }>>;
}
