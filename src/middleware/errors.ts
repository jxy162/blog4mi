import type { NextFunction, Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).render('error', {
    statusCode: 404,
    title: '这一页还没有被写下',
    message: '链接可能已经移动，或者内容暂时不在这里。',
    settings: res.locals.settings ?? {},
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
  res.status(500).render('error', {
    statusCode: 500,
    title: '服务暂时走神了',
    message: '服务器遇到了一个未预期的问题。稍后刷新页面再试一次。',
    settings: res.locals.settings ?? {},
  });
}
