import { describe, expect, it } from 'vitest';
import {
  buildQueryString,
  estimateReadingTime,
  formatDate,
  makeExcerpt,
  pageWindow,
  safeExternalUrl,
  slugify,
} from '../src/lib/utils.js';

describe('content utilities', () => {
  it('creates readable unicode slugs', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('TypeScript 与 MySQL')).toBe('typescript-与-mysql');
    expect(slugify('***')).toMatch(/^post-\d+$/);
  });

  it('builds excerpts and reading time from markdown', () => {
    const content = '# 标题\n\n这是一段用于测试的正文。它包含 **粗体**、[链接](https://example.com) 和 `代码`。';
    expect(makeExcerpt(content, 20)).not.toContain('**');
    expect(makeExcerpt(content, 12).endsWith('…')).toBe(true);
    expect(estimateReadingTime(content)).toBeGreaterThanOrEqual(1);
  });

  it('formats dates in the configured timezone', () => {
    expect(formatDate('2026-11-17 09:30:00')).toContain('2026');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('windows pagination around the current page', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12]);
  });

  it('only accepts safe external URLs', () => {
    expect(safeExternalUrl('https://example.com')).toBe('https://example.com/');
    expect(safeExternalUrl('javascript:alert(1)')).toBe('#');
    expect(safeExternalUrl('/posts')).toBe('/posts');
  });

  it('serializes active query filters', () => {
    expect(buildQueryString({ page: 2, tag: 'TypeScript', q: '' })).toBe('?page=2&tag=TypeScript');
  });
});
