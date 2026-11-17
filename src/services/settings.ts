import { execute, queryRows } from '../db.js';

export const defaultSettings = {
  site_title: '余白手记',
  site_subtitle: 'MI · FIELD NOTES',
  site_description: '关于代码、设计与日常观察的个人博客。',
  author_name: 'JXY',
  author_bio: '写代码，也记录代码之外的事。相信好的系统应该安静，好的文字应该有余温。',
  author_avatar: '',
  hero_kicker: 'PERSONAL FIELD NOTES / 2026',
  hero_title: '把复杂留给系统，',
  hero_highlight: '把温度写进文字。',
  hero_text: '这里收集工程实践、产品设计，以及那些值得被慢慢想清楚的小问题。',
  footer_text: '认真生活，持续构建。',
  github_url: 'https://github.com/jxy162',
  email: 'hello@example.com',
  icp: '',
  about_markdown: `## 你好，我是 JXY

我在做软件，也一直在练习如何把复杂的事情讲清楚。

这个博客是我的公开工作台：一部分是工程笔记，一部分是设计与产品观察，还有一部分留给生活。写作不是项目的附属品，它本身就是整理思考的方式。

### 我关心的事

- 可维护的系统，以及让人愿意反复使用的界面
- 从真实问题出发，而不是从框架出发
- 克制的视觉、清晰的层次和可靠的交互
- 在快速变化里保留长期主义

如果你也对这些问题感兴趣，欢迎从[文章归档](/archives)开始，或者通过邮件与我联系。`,
  posts_per_page: '9',
} as const;

export type SettingKey = keyof typeof defaultSettings;
export type SiteSettings = Record<SettingKey, string>;

export const settingDefinitions: Array<{
  key: SettingKey;
  label: string;
  hint: string;
  type: 'text' | 'textarea' | 'url' | 'email';
}> = [
  { key: 'site_title', label: '站点名称', hint: '显示在导航与浏览器标题中', type: 'text' },
  { key: 'site_subtitle', label: '站点副标题', hint: '导航 Logo 旁的小字', type: 'text' },
  { key: 'site_description', label: '站点描述', hint: '用于 SEO 与首页介绍', type: 'textarea' },
  { key: 'author_name', label: '作者名称', hint: '首页和文章页署名', type: 'text' },
  { key: 'author_bio', label: '作者简介', hint: '关于页与首页短介绍', type: 'textarea' },
  { key: 'author_avatar', label: '头像地址', hint: '支持完整 URL 或站内路径', type: 'url' },
  { key: 'hero_kicker', label: '首页眉题', hint: 'Hero 上方的小号识别文字', type: 'text' },
  { key: 'hero_title', label: '首页主标题', hint: '第一行主文案', type: 'text' },
  { key: 'hero_highlight', label: '首页强调标题', hint: '第二行高亮主文案', type: 'text' },
  { key: 'hero_text', label: '首页说明', hint: '主标题下方的简短说明', type: 'textarea' },
  { key: 'footer_text', label: '页脚文案', hint: '显示在页脚签名处', type: 'text' },
  { key: 'github_url', label: 'GitHub', hint: '留空则不显示', type: 'url' },
  { key: 'email', label: '联系邮箱', hint: '页脚和关于页展示', type: 'email' },
  { key: 'icp', label: '备案号', hint: '可选，显示在页脚', type: 'text' },
  { key: 'about_markdown', label: '关于页内容', hint: '支持 Markdown', type: 'textarea' },
  { key: 'posts_per_page', label: '每页文章数', hint: '建议 6–12', type: 'text' },
];

let settingsCache: { value: SiteSettings; expiresAt: number } | null = null;

export async function getSettings(): Promise<SiteSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  const rows = await queryRows<Array<{ setting_key: string; setting_value: string } & import('mysql2/promise').RowDataPacket>>(
    'SELECT setting_key, setting_value FROM settings',
  );
  const stored = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const value = { ...defaultSettings, ...stored } as SiteSettings;
  settingsCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
  const entries = Object.entries(values).filter(([key]) => key in defaultSettings);
  for (const [key, value] of entries) {
    await execute(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value ?? ''],
    );
  }
  settingsCache = null;
}
