import compression from 'compression';
import cookieSession from 'cookie-session';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { env, isProduction } from './config.js';
import { publicDirectory, viewsDirectory } from './lib/render.js';
import { buildQueryString, formatDate, formatDateTime, relativeTime, safeExternalUrl, truncate } from './lib/utils.js';
import { loadCurrentUser } from './middleware/auth.js';
import { attachRequestContext, consumeFlash, csrfProtection } from './middleware/context.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { requireAdmin } from './middleware/auth.js';
import { defaultSettings, getSettings, type SiteSettings } from './services/settings.js';

export function createApp(): express.Express {
  const app = express();
  const secureCookies = isProduction && env.SITE_URL.startsWith('https://');
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', viewsDirectory);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(
    '/assets',
    express.static(publicDirectory, {
      maxAge: isProduction ? '7d' : 0,
      etag: true,
      index: false,
    }),
  );
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/images/favicon.svg'));
  app.get('/robots.txt', (req, res) => res.sendFile(path.join(publicDirectory, 'robots.txt')));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    cookieSession({
      name: 'blog4mi_session',
      keys: [env.SESSION_SECRET],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
    }),
  );

  app.use(attachRequestContext);
  app.use(async (req, res, next) => {
    let settings: SiteSettings;
    try {
      settings = await getSettings();
    } catch (error) {
      console.error('Unable to load site settings; falling back to defaults.', error);
      settings = { ...defaultSettings } as SiteSettings;
    }
    res.locals.settings = settings;
    res.locals.siteTitle = settings.site_title;
    res.locals.formatDate = formatDate;
    res.locals.formatDateTime = formatDateTime;
    res.locals.relativeTime = relativeTime;
    res.locals.safeExternalUrl = safeExternalUrl;
    res.locals.truncate = truncate;
    res.locals.buildQueryString = buildQueryString;
    res.locals.asset = (filename: string) => `/assets/${String(filename).replace(/^\//, '')}`;
    next();
  });
  app.use(loadCurrentUser);
  app.use(consumeFlash);
  app.use(csrfProtection);

  app.use(authRouter);
  app.use('/admin', requireAdmin, adminRouter);
  app.use(publicRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
