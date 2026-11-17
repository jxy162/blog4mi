import hljs from 'highlight.js';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { markedHighlight } from 'marked-highlight';
import sanitizeHtml from 'sanitize-html';

marked.use(
  gfmHeadingId({ prefix: 'heading-' }),
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, language) {
      const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
      return hljs.highlight(code, { language: validLanguage }).value;
    },
  }),
);

marked.setOptions({
  gfm: true,
  breaks: false,
});

export type TocItem = {
  level: 2 | 3;
  id: string;
  text: string;
};

export type RenderedMarkdown = {
  html: string;
  toc: TocItem[];
};

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const parsed = await marked.parse(markdown ?? '');
  const sanitized = sanitizeHtml(parsed, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'del',
      'input',
      'details',
      'summary',
      'figure',
      'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'loading', 'width', 'height'],
      code: ['class'],
      span: ['class'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      input: ['type', 'checked', 'disabled'],
      details: ['open'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        if (/^https?:\/\//i.test(href)) {
          return {
            tagName,
            attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
          };
        }
        return { tagName, attribs };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: 'lazy' },
      }),
    },
  });

  const toc: TocItem[] = [];
  const headingPattern = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const match of sanitized.matchAll(headingPattern)) {
    const text = decodeBasicEntities(match[3]!.replace(/<[^>]+>/g, '')).trim();
    if (text) toc.push({ level: Number(match[1]) as 2 | 3, id: match[2]!, text });
  }

  return { html: sanitized, toc };
}

export function renderMarkdownSync(markdown: string): string {
  const parsed = marked.parse(markdown ?? '', { async: false });
  return sanitizeHtml(parsed, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2', 'h3', 'h4'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'loading'],
    },
  });
}
