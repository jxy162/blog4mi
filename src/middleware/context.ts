import type { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  res.locals.currentPath = req.path;
  res.locals.currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.query = req.query;
  next();
}

export function consumeFlash(req: Request, res: Response, next: NextFunction): void {
  res.locals.flash = req.session?.flash ?? null;
  if (req.session?.flash) delete req.session.flash;
  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    next(new Error('Session middleware is required before CSRF protection.'));
    return;
  }
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const submitted = String(req.body?._csrf ?? req.get('x-csrf-token') ?? '');
  const expected = req.session.csrfToken;
  const valid =
    submitted.length === expected.length &&
    timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));

  if (!valid) {
    res.status(403);
    res.render('error', {
      statusCode: 403,
      title: '请求已过期',
      message: '页面停留时间过长或来源无法验证，请刷新页面后重试。',
      settings: res.locals.settings ?? {},
    });
    return;
  }
  next();
}
