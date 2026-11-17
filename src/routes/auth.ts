import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { renderPage } from '../lib/render.js';
import { safeNextPath } from '../middleware/auth.js';
import { findUserByLogin, touchLastLogin } from '../services/admin.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: '登录尝试太频繁，请 15 分钟后再试。',
});

const loginSchema = z.object({
  login: z.string().trim().min(1, '请输入用户名或邮箱').max(190),
  password: z.string().min(1, '请输入密码').max(200),
  next: z.string().optional().default('/admin'),
});

authRouter.get('/admin/login', async (req, res) => {
  if (res.locals.currentUser) {
    res.redirect(safeNextPath(req.query.next));
    return;
  }
  await renderPage(res, 'admin/login', {
    pageTitle: '登录后台',
    pageDescription: '内容管理入口',
    hideChrome: true,
    bodyClass: 'login-page',
    next: safeNextPath(req.query.next),
  });
});

authRouter.post('/admin/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      req.session!.flash = { type: 'error', message: parsed.error.issues[0]?.message ?? '登录信息不完整。' };
      res.redirect('/admin/login');
      return;
    }
    const user = await findUserByLogin(parsed.data.login);
    const valid = user ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
    if (!user || !valid) {
      req.session!.flash = { type: 'error', message: '用户名或密码不正确。' };
      res.redirect('/admin/login');
      return;
    }
    req.session!.userId = user.id;
    req.session!.csrfToken = undefined;
    await touchLastLogin(user.id);
    req.session!.flash = { type: 'success', message: `欢迎回来，${user.display_name}。` };
    res.redirect(safeNextPath(parsed.data.next));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});
