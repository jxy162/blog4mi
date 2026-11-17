import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown.js';

describe('renderMarkdown', () => {
  it('renders headings, code highlighting and a table of contents', async () => {
    const result = await renderMarkdown('## 第一节\n\n正文\n\n### 子标题\n\n```ts\nconst answer = 42;\n```');
    expect(result.html).toContain('<h2 id="heading-第一节">第一节</h2>');
    expect(result.html).toContain('<h3 id="heading-子标题">子标题</h3>');
    expect(result.html).toContain('hljs language-ts');
    expect(result.toc).toEqual([
      { level: 2, id: 'heading-第一节', text: '第一节' },
      { level: 3, id: 'heading-子标题', text: '子标题' },
    ]);
  });

  it('removes unsafe HTML and script tags', async () => {
    const result = await renderMarkdown('<script>alert(1)</script>\n\n<img src="javascript:alert(1)">\n\n[安全链接](https://example.com)');
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer nofollow"');
  });
});
