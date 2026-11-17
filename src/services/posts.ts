import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { execute, queryOne, queryRows, withTransaction } from '../db.js';
import { estimateReadingTime, makeExcerpt, slugify } from '../lib/utils.js';

export type PostStatus = 'draft' | 'published' | 'archived';

export type PostTag = {
  id: number;
  name: string;
  slug: string;
};

export type PostSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_url: string | null;
  published_at: string | null;
  reading_time: number;
  view_count: number;
  featured: number;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  author_name: string;
  tags: PostTag[];
};

export type PostDetail = PostSummary & {
  status: PostStatus;
  content: string;
  allow_comments: number;
  category_id: number | null;
  author_id: number;
  updated_at: string;
};

export type PostQuery = {
  page?: number;
  perPage?: number;
  categorySlug?: string;
  tagSlug?: string;
  q?: string;
  featured?: boolean;
};

export type PostListResult = {
  posts: PostSummary[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type CommentItem = {
  id: number;
  parent_id: number | null;
  author_name: string;
  author_website: string | null;
  content: string;
  created_at: string;
  children: CommentItem[];
};

export type CategoryWithCount = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  post_count: number;
};

export type TagWithCount = {
  id: number;
  name: string;
  slug: string;
  post_count: number;
};

type SummaryRow = RowDataPacket & {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  reading_time: number;
  view_count: number;
  featured: number;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  author_name: string;
};

type DetailRow = SummaryRow & {
  status: PostStatus;
  content: string;
  allow_comments: number;
  category_id: number | null;
  author_id: number;
  updated_at: string;
};

type TagRow = RowDataPacket & {
  post_id: number;
  id: number;
  name: string;
  slug: string;
};

type CountRow = RowDataPacket & { total: number };

type CommentRow = RowDataPacket & {
  id: number;
  parent_id: number | null;
  author_name: string;
  author_website: string | null;
  content: string;
  created_at: string;
};

const publishedCondition = "p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at <= NOW()";

function toSummary(row: SummaryRow): PostSummary {
  return {
    ...row,
    excerpt: row.excerpt ?? '',
    tags: [],
  };
}

async function attachTags<T extends PostSummary>(posts: T[]): Promise<T[]> {
  if (!posts.length) return posts;
  const placeholders = posts.map(() => '?').join(',');
  const rows = await queryRows<TagRow[]>(
    `SELECT pt.post_id, t.id, t.name, t.slug
     FROM post_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id IN (${placeholders})
     ORDER BY t.name`,
    posts.map((post) => post.id),
  );
  const tagsByPost = new Map<number, PostTag[]>();
  rows.forEach((row) => {
    const tags = tagsByPost.get(row.post_id) ?? [];
    tags.push({ id: row.id, name: row.name, slug: row.slug });
    tagsByPost.set(row.post_id, tags);
  });
  posts.forEach((post) => {
    post.tags = tagsByPost.get(post.id) ?? [];
  });
  return posts;
}

export async function listPosts(query: PostQuery = {}): Promise<PostListResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(24, Math.max(1, query.perPage ?? 9));
  const where: string[] = [publishedCondition];
  const params: unknown[] = [];
  const joins: string[] = [];

  if (query.categorySlug) {
    where.push('c.slug = ?');
    params.push(query.categorySlug);
  }
  if (query.tagSlug) {
    joins.push('JOIN post_tags filter_pt ON filter_pt.post_id = p.id', 'JOIN tags filter_t ON filter_t.id = filter_pt.tag_id');
    where.push('filter_t.slug = ?');
    params.push(query.tagSlug);
  }
  if (query.q) {
    where.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  if (query.featured) where.push('p.featured = 1');

  const fromSql = `FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.author_id
    ${joins.join(' ')}
    WHERE ${where.join(' AND ')}`;

  const count = await queryOne<CountRow>(`SELECT COUNT(DISTINCT p.id) AS total ${fromSql}`, params);
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * perPage;

  const rows = await queryRows<SummaryRow[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_url, p.published_at,
            p.reading_time, p.view_count, p.featured,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name
     ${fromSql}
     ORDER BY p.featured DESC, p.published_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, perPage, offset],
  );

  const posts = await attachTags(rows.map(toSummary));
  return { posts, total, page: safePage, perPage, totalPages };
}

export async function getFeaturedPost(): Promise<PostSummary | null> {
  const result = await listPosts({ page: 1, perPage: 1, featured: true });
  if (result.posts[0]) return result.posts[0];
  const fallback = await listPosts({ page: 1, perPage: 1 });
  return fallback.posts[0] ?? null;
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  const row = await queryOne<DetailRow>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.cover_url, p.published_at, p.status,
            p.reading_time, p.view_count, p.featured, p.allow_comments, p.category_id,
            p.author_id, p.updated_at,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.author_id
     WHERE p.slug = ? AND ${publishedCondition}
     LIMIT 1`,
    [slug],
  );
  if (!row) return null;
  const [detail] = await attachTags([{ ...row, excerpt: row.excerpt ?? '', tags: [] } as PostDetail]);
  return detail ?? null;
}

export async function getAdjacentPosts(post: PostDetail): Promise<{
  newer: { title: string; slug: string } | null;
  older: { title: string; slug: string } | null;
}> {
  const [newerRows, olderRows] = await Promise.all([
    queryRows<Array<RowDataPacket & { title: string; slug: string }>>(
      `SELECT title, slug FROM posts p
       WHERE ${publishedCondition} AND (p.published_at > ? OR (p.published_at = ? AND p.id > ?))
       ORDER BY p.published_at ASC, p.id ASC LIMIT 1`,
      [post.published_at, post.published_at, post.id],
    ),
    queryRows<Array<RowDataPacket & { title: string; slug: string }>>(
      `SELECT title, slug FROM posts p
       WHERE ${publishedCondition} AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?))
       ORDER BY p.published_at DESC, p.id DESC LIMIT 1`,
      [post.published_at, post.published_at, post.id],
    ),
  ]);
  return { newer: newerRows[0] ?? null, older: olderRows[0] ?? null };
}

export async function getRelatedPosts(post: PostDetail, limit = 3): Promise<PostSummary[]> {
  const rows = await queryRows<SummaryRow[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_url, p.published_at,
            p.reading_time, p.view_count, p.featured,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.author_id
     WHERE ${publishedCondition} AND p.id <> ?
       AND (? IS NULL OR p.category_id = ?)
     ORDER BY (SELECT COUNT(*) FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id IN (
       SELECT tag_id FROM post_tags WHERE post_id = ?
     )) DESC, p.published_at DESC
     LIMIT ?`,
    [post.id, post.category_id, post.category_id, post.id, limit],
  );
  return attachTags(rows.map(toSummary));
}

export async function incrementPostView(id: number): Promise<void> {
  await execute('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [id]);
}

export async function getApprovedComments(postId: number): Promise<CommentItem[]> {
  const rows = await queryRows<CommentRow[]>(
    `SELECT id, parent_id, author_name, author_website, content, created_at
     FROM comments WHERE post_id = ? AND status = 'approved'
     ORDER BY created_at ASC, id ASC`,
    [postId],
  );
  const map = new Map<number, CommentItem>();
  const roots: CommentItem[] = [];
  rows.forEach((row) => map.set(row.id, { ...row, children: [] }));
  rows.forEach((row) => {
    const item = map.get(row.id)!;
    const parent = row.parent_id ? map.get(row.parent_id) : null;
    if (parent) parent.children.push(item);
    else roots.push(item);
  });
  return roots;
}

export async function createComment(input: {
  postId: number;
  parentId?: number | null;
  authorName: string;
  authorEmail: string;
  authorWebsite?: string | null;
  content: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<number> {
  const result = await execute(
    `INSERT INTO comments
      (post_id, parent_id, author_name, author_email, author_website, content, status, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      input.postId,
      input.parentId ?? null,
      input.authorName,
      input.authorEmail,
      input.authorWebsite || null,
      input.content,
      input.ipAddress ?? null,
      input.userAgent?.slice(0, 500) ?? null,
    ],
  );
  return result.insertId;
}

export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  return queryRows<Array<CategoryWithCount & RowDataPacket>>(
    `SELECT c.id, c.name, c.slug, c.description, c.color, COUNT(p.id) AS post_count
     FROM categories c
     LEFT JOIN posts p ON p.category_id = c.id AND ${publishedCondition}
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.id ASC`,
  );
}

export async function getTagsWithCounts(): Promise<TagWithCount[]> {
  return queryRows<Array<TagWithCount & RowDataPacket>>(
    `SELECT t.id, t.name, t.slug, COUNT(p.id) AS post_count
     FROM tags t
     LEFT JOIN post_tags pt ON pt.tag_id = t.id
     LEFT JOIN posts p ON p.id = pt.post_id AND ${publishedCondition}
     GROUP BY t.id
     HAVING post_count > 0
     ORDER BY post_count DESC, t.name ASC`,
  );
}

export async function getArchivePosts(): Promise<PostSummary[]> {
  const rows = await queryRows<SummaryRow[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_url, p.published_at,
            p.reading_time, p.view_count, p.featured,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.author_id
     WHERE ${publishedCondition}
     ORDER BY p.published_at DESC, p.id DESC`,
  );
  return attachTags(rows.map(toSummary));
}

export async function getSiteStats(): Promise<{
  posts: number;
  categories: number;
  tags: number;
  comments: number;
  words: number;
}> {
  const posts = await queryOne<CountRow & { words: number | null }>(
    `SELECT COUNT(*) AS total, SUM(CHAR_LENGTH(content)) AS words
     FROM posts p WHERE ${publishedCondition}`,
  );
  const categories = await queryOne<CountRow>(
    `SELECT COUNT(DISTINCT p.category_id) AS total FROM posts p WHERE ${publishedCondition}`,
  );
  const tags = await queryOne<CountRow>(
    `SELECT COUNT(DISTINCT pt.tag_id) AS total FROM post_tags pt
     JOIN posts p ON p.id = pt.post_id WHERE ${publishedCondition}`,
  );
  const comments = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM comments c
     JOIN posts p ON p.id = c.post_id
     WHERE c.status = 'approved' AND ${publishedCondition}`,
  );
  return {
    posts: Number(posts?.total ?? 0),
    categories: Number(categories?.total ?? 0),
    tags: Number(tags?.total ?? 0),
    comments: Number(comments?.total ?? 0),
    words: Number(posts?.words ?? 0),
  };
}

export type PostInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  categoryId: number | null;
  status: PostStatus;
  featured: boolean;
  allowComments: boolean;
  tags: string[];
  publishedAt: string | null;
  authorId: number;
};

export type AdminPostRow = RowDataPacket & {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  featured: number;
  view_count: number;
  published_at: string | null;
  updated_at: string;
  category_name: string | null;
  comment_count: number;
};

export async function listAdminPosts(options: {
  page?: number;
  perPage?: number;
  status?: PostStatus | '';
  q?: string;
} = {}): Promise<{ posts: AdminPostRow[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = options.perPage ?? 15;
  const where: string[] = ['1 = 1'];
  const params: unknown[] = [];
  if (options.status) {
    where.push('p.status = ?');
    params.push(options.status);
  }
  if (options.q) {
    where.push('(p.title LIKE ? OR p.slug LIKE ?)');
    params.push(`%${options.q}%`, `%${options.q}%`);
  }
  const count = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM posts p WHERE ${where.join(' AND ')}`,
    params,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const posts = await queryRows<AdminPostRow[]>(
    `SELECT p.id, p.title, p.slug, p.status, p.featured, p.view_count, p.published_at, p.updated_at,
            c.name AS category_name,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, perPage, (safePage - 1) * perPage],
  );
  return { posts, total, page: safePage, totalPages };
}

export async function getAdminPost(id: number): Promise<(PostDetail & { tagsText: string }) | null> {
  const row = await queryOne<DetailRow>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.cover_url, p.published_at, p.status,
            p.reading_time, p.view_count, p.featured, p.allow_comments, p.category_id,
            p.author_id, p.updated_at,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
            u.display_name AS author_name
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.author_id
     WHERE p.id = ? LIMIT 1`,
    [id],
  );
  if (!row) return null;
  const [detail] = await attachTags([{ ...row, excerpt: row.excerpt ?? '', tags: [] } as PostDetail]);
  return detail ? { ...detail, tagsText: detail.tags.map((tag) => tag.name).join(', ') } : null;
}

export async function ensureUniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 2;
  while (true) {
    const row = await queryOne<RowDataPacket & { id: number }>(
      `SELECT id FROM posts WHERE slug = ? ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
      excludeId ? [candidate, excludeId] : [candidate],
    );
    if (!row) return candidate;
    candidate = `${root}-${suffix++}`;
  }
}

async function syncPostTags(
  connection: import('mysql2/promise').PoolConnection,
  postId: number,
  tagNames: string[],
): Promise<void> {
  await connection.execute('DELETE FROM post_tags WHERE post_id = ?', [postId]);
  const uniqueTags = [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  for (const name of uniqueTags) {
    const slug = slugify(name);
    await connection.execute(
      'INSERT INTO tags (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [name, slug],
    );
    const [tagRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM tags WHERE slug = ? LIMIT 1',
      [slug],
    );
    if (tagRows[0]) {
      await connection.execute('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, tagRows[0].id]);
    }
  }
}

function normalizePublishedAt(input: PostInput): string | null {
  if (input.status !== 'published') return input.publishedAt;
  if (!input.publishedAt) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  return input.publishedAt.replace('T', ' ').slice(0, 19);
}

export async function createPost(input: PostInput): Promise<number> {
  const slug = await ensureUniqueSlug(input.slug || input.title);
  const readingTime = estimateReadingTime(input.content);
  const excerpt = input.excerpt || makeExcerpt(input.content);
  return withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO posts
        (title, slug, excerpt, content, cover_url, category_id, author_id, status, featured,
         allow_comments, reading_time, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        slug,
        excerpt,
        input.content,
        input.coverUrl || null,
        input.categoryId,
        input.authorId,
        input.status,
        input.featured ? 1 : 0,
        input.allowComments ? 1 : 0,
        readingTime,
        normalizePublishedAt(input),
      ],
    );
    await syncPostTags(connection, result.insertId, input.tags);
    return result.insertId;
  });
}

export async function updatePost(id: number, input: PostInput): Promise<void> {
  const slug = await ensureUniqueSlug(input.slug || input.title, id);
  const readingTime = estimateReadingTime(input.content);
  const excerpt = input.excerpt || makeExcerpt(input.content);
  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, cover_url = ?,
         category_id = ?, status = ?, featured = ?, allow_comments = ?, reading_time = ?,
         published_at = COALESCE(?, published_at)
       WHERE id = ?`,
      [
        input.title,
        slug,
        excerpt,
        input.content,
        input.coverUrl || null,
        input.categoryId,
        input.status,
        input.featured ? 1 : 0,
        input.allowComments ? 1 : 0,
        readingTime,
        normalizePublishedAt(input),
        id,
      ],
    );
    await syncPostTags(connection, id, input.tags);
  });
}

export async function deletePost(id: number): Promise<void> {
  await execute('DELETE FROM posts WHERE id = ?', [id]);
}

export async function setPostStatus(id: number, status: PostStatus): Promise<void> {
  await execute(
    `UPDATE posts SET status = ?, published_at = CASE
       WHEN ? = 'published' AND published_at IS NULL THEN NOW()
       ELSE published_at END
     WHERE id = ?`,
    [status, status, id],
  );
}

export async function getAdminStats(): Promise<{
  posts: number;
  published: number;
  drafts: number;
  pendingComments: number;
  views: number;
  categories: number;
  tags: number;
}> {
  const row = await queryOne<RowDataPacket & Record<string, number | null>>(
    `SELECT
      (SELECT COUNT(*) FROM posts) AS posts,
      (SELECT COUNT(*) FROM posts WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM posts WHERE status = 'draft') AS drafts,
      (SELECT COUNT(*) FROM comments WHERE status = 'pending') AS pendingComments,
      (SELECT COALESCE(SUM(view_count), 0) FROM posts) AS views,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM tags) AS tags`,
  );
  return {
    posts: Number(row?.posts ?? 0),
    published: Number(row?.published ?? 0),
    drafts: Number(row?.drafts ?? 0),
    pendingComments: Number(row?.pendingComments ?? 0),
    views: Number(row?.views ?? 0),
    categories: Number(row?.categories ?? 0),
    tags: Number(row?.tags ?? 0),
  };
}
