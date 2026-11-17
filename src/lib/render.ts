import ejs from 'ejs';
import type { Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

function resolveProjectDirectory(name: 'views' | 'public'): string {
  const distDirectory = path.resolve(process.cwd(), 'dist', name);
  if (fs.existsSync(distDirectory)) return distDirectory;
  return path.resolve(process.cwd(), 'src', name);
}

export const viewsDirectory = resolveProjectDirectory('views');
export const publicDirectory = resolveProjectDirectory('public');

type RenderLocals = Record<string, unknown>;

async function renderBody(view: string, locals: RenderLocals): Promise<string> {
  const filename = path.join(viewsDirectory, `${view}.ejs`);
  return ejs.renderFile(filename, locals, { async: true });
}

export async function renderPage(
  res: Response,
  view: string,
  locals: RenderLocals = {},
): Promise<void> {
  const merged = { ...res.locals, ...locals, hideChrome: locals.hideChrome ?? false };
  const body = await renderBody(view, merged);
  res.render('layout', { ...merged, body, layout: 'public' });
}

export async function renderAdminPage(
  res: Response,
  view: string,
  locals: RenderLocals = {},
): Promise<void> {
  const merged = { ...res.locals, ...locals };
  const body = await renderBody(view, merged);
  res.render('admin-layout', { ...merged, body, layout: 'admin' });
}
