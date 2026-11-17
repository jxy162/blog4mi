import type { NextFunction, Request, Response } from 'express';
import { findUserById, type AdminUser } from '../services/admin.js';

export async function loadCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.locals.currentUser = null;
  if (!req.session?.userId) {
    next();
    return;
  }
  try {
    const user = await findUserById(req.session.userId);
    if (!user) {
      req.session.userId = undefined;
      next();
      return;
    }
    res.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = res.locals.currentUser as AdminUser | null;
  if (!user) {
    const nextPath = encodeURIComponent(req.originalUrl);
    res.redirect(`/admin/login?next=${nextPath}`);
    return;
  }
  if (user.role !== 'admin' && user.role !== 'editor') {
    res.status(403).render('error', {
      statusCode: 403,
      title: '没有访问权限',
      message: '当前账号无法进入内容管理后台。',
      settings: res.locals.settings ?? {},
    });
    return;
  }
  next();
}

export function safeNextPath(value: unknown, fallback = '/admin'): string {
  const path = typeof value === 'string' ? value : '';
  return path.startsWith('/') && !path.startsWith('//') ? path : fallback;
}
