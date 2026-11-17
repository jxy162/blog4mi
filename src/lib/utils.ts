export function slugify(input: string): string {
  const slug = input
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .trim()
    .replace(/['"’”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug || `post-${Date.now()}`;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeExcerpt(markdown: string, maxLength = 180): string {
  const text = stripMarkdown(markdown);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export function estimateReadingTime(markdown: string): number {
  const text = stripMarkdown(markdown);
  const chineseCharacters = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[a-zA-Z0-9]+/g) ?? []).length;
  return Math.max(1, Math.ceil(chineseCharacters / 400 + latinWords / 220));
}

function parseDatabaseDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}+08:00`);
}

export function formatDate(value: string | Date | null | undefined, style: 'short' | 'long' = 'short'): string {
  if (!value) return '';
  const date = value instanceof Date ? value : parseDatabaseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: style === 'long' ? 'long' : '2-digit',
    day: '2-digit',
    ...(style === 'long' ? { weekday: 'short' } : {}),
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : parseDatabaseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : parseDatabaseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return '刚刚';
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function safeExternalUrl(value: string | null | undefined): string {
  if (!value) return '#';
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : '#';
  } catch {
    return value.startsWith('/') ? value : '#';
  }
}

export function absoluteUrl(pathname: string, siteUrl: string): string {
  try {
    return new URL(pathname, siteUrl).toString();
  } catch {
    return pathname;
  }
}

export function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1]! > 1) result.push('…');
    result.push(page);
  });
  return result;
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}
