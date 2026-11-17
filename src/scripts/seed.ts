import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { execute, pool, queryOne, queryRows, withTransaction } from '../db.js';
import { estimateReadingTime, makeExcerpt, slugify } from '../lib/utils.js';
import { defaultSettings, saveSettings } from '../services/settings.js';
import { env } from '../config.js';

type SeedPost = {
  title: string;
  slug: string;
  category: string;
  tags: string[];
  excerpt: string;
  content: string;
  featured?: boolean;
  publishedAt: string;
  views: number;
};

const categories = [
  { name: '工程手记', slug: 'engineering', description: '关于系统、代码与工程实践的长短笔记。', color: '#0a8a4e', sort: 1 },
  { name: '设计观察', slug: 'design', description: '界面、产品与设计系统背后的判断。', color: '#e86f49', sort: 2 },
  { name: '生活切片', slug: 'life', description: '城市、阅读、散步，以及没有 KPI 的时刻。', color: '#d6a238', sort: 3 },
  { name: '工具箱', slug: 'toolbox', description: '那些让日常工作更顺手的小工具。', color: '#3f6e9e', sort: 4 },
];

const posts: SeedPost[] = [
  {
    title: '把博客重新做成一块安静的自留地',
    slug: 'a-quiet-corner-for-writing',
    category: '设计观察',
    tags: ['设计系统', 'M3E', '写作'],
    excerpt: '信息流越来越快，个人博客反而应该慢下来。一次关于版式、留白与写作动机的重做记录。',
    featured: true,
    publishedAt: '2026-11-12 09:30:00',
    views: 1286,
    content: `写了几年博客，我逐渐发现，真正让我愿意持续更新的，不是后台里不断增长的访问量，而是打开编辑器时那种**没有干扰的安静感**。

这次重做，我给博客定了三个很朴素的目标：

1. 打开一篇文章时，注意力只落在文字上。
2. 找旧文章时，不需要猜入口在哪里。
3. 后台足够完整，但不要比写作本身更复杂。

## 为什么从“卡片”退回到“版面”

很多博客模板喜欢把一切都装进卡片：文章是卡片，分类是卡片，标签是卡片，连关于我也是卡片。卡片本身没有错，但当所有内容共享同样的边框、圆角和阴影时，页面就失去了节奏。

Material Design 3 Expressive 给了一个更好的思路：**形状和色彩应该携带层级信息**。

> 重要的内容占据更大的面积，次要内容退到色调更低的表面，交互元素则用更明确的胶囊形态出现。

于是首页有了一个非常明确的视觉中心：一篇被放大的文章、一段被打断的标题，以及一组可以呼吸的留白。其余内容顺着页面向下展开，而不是抢着说话。

## 留白不是空白

留白真正的作用，是让眼睛知道下一步往哪里看。它需要和字号、行宽一起被设计。

\`\`\`css
.prose {
  max-width: 68ch;
  font-size: clamp(1rem, 0.96rem + 0.18vw, 1.125rem);
  line-height: 1.9;
}
\`\`\`

上面这段规则看起来简单，但它解决了一个长期问题：正文永远比容器窄一点，长句在中文里也不会变成难以追踪的一整行。

## 写作需要一套“低阻力”的系统

后台不应该只是数据库的表格视图。它应该记住写作者的工作顺序：

- 先写标题与正文，再补摘要和 SEO 信息
- 分类和标签可以顺手选择，但不阻塞发布
- Markdown 预览必须和最终排版一致
- 草稿可以随时保存，不强迫一次完成

这套博客系统最终选择了服务端渲染。没有复杂的前端状态，没有首屏瀑布流请求，文章从数据库到 HTML 只需要一次查询和一次模板渲染。

## 最后

个人博客最重要的功能，从来不是“像产品一样增长”，而是让一个人愿意继续写下去。

如果一块页面能让你在深夜打开电脑时少犹豫几秒，那它的设计就是成立的。`,
  },
  {
    title: 'Node.js 服务端分层的实用边界',
    slug: 'practical-boundaries-of-node-service-layers',
    category: '工程手记',
    tags: ['Node.js', 'TypeScript', '架构'],
    excerpt: 'Controller、Service、Repository 不是越多越好。用真实项目讨论 Node.js 后端分层的收益与成本。',
    publishedAt: '2026-10-28 20:10:00',
    views: 936,
    content: `分层架构最容易被做成一种仪式：每个请求都要穿过四个目录，最后只执行了一条 \`SELECT\`。

我对分层的判断标准一直很简单：**它有没有隔离会变化的东西？**

## 一个请求真正需要什么

以博客后台创建文章为例，流程大致是：

1. 校验请求体
2. 检查 slug 是否重复
3. 写入文章与标签
4. 返回新文章 ID

这四步里，HTTP 细节会变，数据库实现可能变，业务规则最稳定。分层应该保护最稳定的部分，而不是制造更多跳转。

\`\`\`ts
export async function createPost(input: PostInput) {
  const slug = await ensureUniqueSlug(input.slug || input.title);

  return withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO posts (title, slug, content) VALUES (?, ?, ?)',
      [input.title, slug, input.content],
    );
    await syncPostTags(connection, result.insertId, input.tags);
    return result.insertId;
  });
}
\`\`\`

这段代码没有单独的 Repository 类，但它已经把“怎样创建文章”完整地封装了起来。

## 哪些抽象值得保留

### 1. 输入边界

路由层负责把 \`unknown\` 变成可信的数据。Zod 很适合做这件事。

### 2. 事务边界

文章和标签必须一起成功或一起失败。事务边界比目录结构更重要。

### 3. 渲染边界

Markdown 原文是内容，渲染后的 HTML 是展示结果。两者不要混在一个字段里，否则以后换渲染器会很痛苦。

## 哪些抽象可以晚点再做

单表 CRUD 不需要 Repository 接口；只有一个实现时，依赖注入也未必带来收益。等出现第二种存储、第二个调用方，或者测试真的因为耦合而难写时，再抽也来得及。

好的架构不是目录整齐，而是改动发生时，你知道哪些文件应该被打开。`,
  },
  {
    title: 'MySQL 索引不是越多越好：一次慢查询复盘',
    slug: 'mysql-index-slow-query-review',
    category: '工程手记',
    tags: ['MySQL', '性能', 'SQL'],
    excerpt: '一个看起来只差一个索引的慢查询，最后为什么通过调整查询条件和排序方式解决？',
    publishedAt: '2026-10-09 14:20:00',
    views: 1742,
    content: `起因是一条文章列表查询在数据量超过二十万后突然变慢。直觉告诉我们应该加索引，但 \`EXPLAIN\` 给出的答案并不支持这个直觉。

## 先看执行计划

\`\`\`sql
EXPLAIN ANALYZE
SELECT p.id, p.title, p.published_at
FROM posts p
WHERE p.status = 'published'
  AND p.published_at <= NOW()
ORDER BY p.featured DESC, p.published_at DESC
LIMIT 20;
\`\`\`

问题出在排序：\`featured DESC, published_at DESC\` 是一个组合排序，而筛选条件又包含范围比较，导致优化器很难只用索引完成全部工作。

## 不要急着加第二个索引

原来的索引是 \`(status, published_at)\`。看起来只要补上 \`featured\` 就行：

\`\`\`sql
ALTER TABLE posts
ADD INDEX idx_posts_feed (status, featured, published_at);
\`\`\`

但这个索引会同时增加写入成本。对博客这种读多写少的系统也许可以接受，但在留言、统计更新频繁的场景里，需要重新权衡。

## 最后的做法

我们把查询拆成两段：

1. 先取精选文章，数量很少。
2. 再按时间取普通文章。

两个查询都命中更窄的索引，业务层负责合并与去重。慢查询从 480ms 降到 12ms，写入路径没有增加额外索引。

## 复盘清单

- 先看执行计划，不要凭字段名猜索引
- 区分“过滤慢”和“排序慢”
- 检查 \`LIMIT\` 是否真的让数据库提前停止扫描
- 索引的收益要放在真实读写比例里计算

性能优化不是把数据库调到最快，而是让系统的整体成本最低。`,
  },
  {
    title: 'Expressive UI：让界面有情绪，但不喧哗',
    slug: 'expressive-ui-with-restraint',
    category: '设计观察',
    tags: ['M3E', '动效', '设计系统'],
    excerpt: 'M3E 不只是更大的圆角。真正有价值的是形状、色调与运动如何共同表达内容的状态。',
    publishedAt: '2026-09-18 11:00:00',
    views: 1128,
    content: `如果把 Material 3 Expressive 理解为“更活泼的 Material Design”，很容易做成一个到处都在跳动的界面。

我更愿意把它理解成一套**表达强度可调**的设计语言。

## 形状是信息，不是装饰

胶囊按钮意味着可点击，超大圆角意味着一个独立的内容区域，不规则形状则适合承载情绪化的视觉焦点。

在博客里，我用三种主要形状：

- **胶囊**：导航、标签、筛选器，表示短小的交互
- **大圆角面板**：文章、设置分组，表示稳定的内容容器
- **不规则插画块**：只出现在首页 Hero 和空状态，承担记忆点

## 色调层级要比阴影更可靠

M3E 的 tonal surface 很适合内容型产品。页面背景是略带绿的暖白，一级表面几乎纯白，二级表面再降低一点对比度。

这样即使没有阴影，用户也能感知层级。

\`\`\`css
:root {
  --surface: #f5f6f0;
  --surface-container: #fbfcf7;
  --primary: #0a8a4e;
  --secondary-container: #d2f3df;
  --tertiary-container: #ffe0d1;
}
\`\`\`

## 动效只回答一个问题

好的界面动效应该告诉用户：“刚刚发生了什么？”

因此我只保留三类运动：

1. 页面加载时的一次 Hero 编排
2. 筛选与展开时的即时反馈
3. 滚动阅读时的进度提示

其余卡片不做无意义的漂浮和缩放。克制不是没有表达，而是把表达集中在真正重要的位置。

## 可访问性是表达的一部分

所有正文都保证足够对比度，键盘焦点始终可见，\`prefers-reduced-motion\` 下关闭位移动画。

如果一种视觉语言只能在理想条件下成立，它还不够好。`,
  },
  {
    title: '用 TypeScript 写一份能长期维护的配置层',
    slug: 'maintainable-config-layer-in-typescript',
    category: '工程手记',
    tags: ['TypeScript', 'Node.js', '工程化'],
    excerpt: '环境变量、默认值、类型约束和启动期校验，怎样组合成一份不会在半年后失控的配置层？',
    publishedAt: '2026-08-30 19:40:00',
    views: 684,
    content: `配置层最常见的坏味道，是业务代码里散落着 \`process.env.SOMETHING\`。

问题不在于读取环境变量，而在于：

- 默认值定义在三个不同文件里
- 类型永远是 \`string | undefined\`
- 直到运行到某个分支才发现变量拼错了

## 在启动时完成一次收敛

我的做法是在应用入口读取环境变量，立刻交给 Zod 校验，然后只导出一个强类型对象。

\`\`\`ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
\`\`\`

应用其他部分不再接触 \`process.env\`。

## 默认值要区分“开发方便”和“生产安全”

开发环境可以接受本地数据库地址和宽松日志；生产环境则应该在配置错误时立即退出。

不要在 \`NODE_ENV=production\` 时悄悄使用一个默认 session secret。那不是容错，是把风险藏起来。

## 配置应该有文档，但文档不是唯一真相

\`.env.example\` 负责说明变量，Zod schema 负责执行规则。两者必须一起更新，最好在 CI 里跑一次构建和启动检查。

配置层做得好，不会让产品显得更聪明；但它会让每一次部署少一点心跳加速。`,
  },
  {
    title: '周末散步：城市里的留白',
    slug: 'a-weekend-walk-in-the-city',
    category: '生活切片',
    tags: ['随笔', '城市', '摄影'],
    excerpt: '没有目的地地走了两个小时，记录几条街道、几棵树，以及一个下午逐渐变慢的光。',
    publishedAt: '2026-08-06 17:15:00',
    views: 522,
    content: `周日下午四点，我从一条不常走的路回家。

太阳已经不再直射，梧桐树的影子被拉得很长，落在旧居民楼的墙面上。城市在这个时刻会短暂地安静下来，像是给所有赶路的人留了一口气。

## 一条没有被规划的路线

我没有打开地图，只沿着有树的方向走。

路过一家很小的修表店，老板戴着放大镜坐在门口；再往前是一家只卖三种面的馆子，玻璃上贴着褪色的菜单。它们都存在了很多年，却因为不在日常路线上，被我长期忽略。

> 城市不是由地标组成的，而是由无数次经过组成的。

## 拍照不是为了证明来过

我只拍了三张照片：一面被爬山虎覆盖的墙、一辆停在树荫里的旧自行车，还有远处天桥上逆光的人影。

以前总想把看到的一切都记录下来，后来发现，真正会留下印象的画面，往往在举起手机之前就已经记住了。

## 慢下来是一种能力

我们很容易把效率带到所有地方：散步要听播客，吃饭要看视频，连休息都要安排出“产出”。

但有些时间就是应该被浪费掉。走一段没有目的的路，看云从楼顶慢慢移过去，让大脑从任务列表里退出来。

晚上回到家，我没有完成任何计划，却觉得这一天很完整。`,
  },
  {
    title: '我的命令行工具箱，2026 版',
    slug: 'my-command-line-toolbox-2026',
    category: '工具箱',
    tags: ['CLI', '效率', '工具'],
    excerpt: '不追求装得最多，只保留每天真的会打开的那些工具。一份轻量、可复制的终端工作流。',
    publishedAt: '2026-07-11 10:05:00',
    views: 851,
    content: `每年都会整理一次命令行工具。判断标准只有一个：过去半年里，我是否在真实工作中反复打开它。

## 搜索与文件

- \`fd\`：比 \`find\` 更短的语法，默认尊重 \`.gitignore\`
- \`rg\`：代码搜索几乎已经成为肌肉记忆
- \`bat\`：需要高亮和行号时替代 \`cat\`
- \`zoxide\`：按访问频率跳转目录

\`\`\`bash
z blog          # 跳到常用目录
rg "TODO" src   # 搜索代码
fd -e sql       # 查找所有 SQL 文件
\`\`\`

## Git 与发布

\`lazygit\` 仍然是我最推荐的 Git 终端界面。复杂 rebase 会切回命令行，但日常提交、查看 diff 和切换分支效率很高。

部署脚本则尽量保持“一条命令”：

\`\`\`bash
npm run check && npm run build && docker compose up -d --build
\`\`\`

## 文本处理

\`jq\` 和 \`yq\` 不用多说。最近用得更多的是 \`sd\`，它比 \`sed\` 的替换语法更容易记住：

\`\`\`bash
sd "old-domain.com" "new-domain.com" ./config
\`\`\`

## 工具不是收藏品

工具箱的价值不在于数量，而在于形成稳定的操作习惯。一个工具如果三个月没有打开，就说明它暂时不属于你的工作流。

每年删掉一些，比每年装上一堆更重要。`,
  },
  {
    title: '从 OneBlog 看个人博客真正需要什么',
    slug: 'what-a-personal-blog-really-needs',
    category: '设计观察',
    tags: ['OneBlog', '产品设计', '博客'],
    excerpt: '文章、分类、标签、评论、友链、后台管理。参考成熟博客系统时，哪些功能值得保留，哪些可以删掉？',
    publishedAt: '2026-06-20 21:30:00',
    views: 1439,
    content: `整理新博客需求时，我重新看了 OneBlog 一类经典博客系统的功能结构。

它们通常包含文章管理、分类标签、评论、友链、站点设置、数据统计和一套后台。功能很完整，但也提醒我们：**完整不等于必要**。

## 真正不可省略的部分

### 内容本身

文章需要 Markdown、草稿、发布时间、摘要、封面和 SEO 字段。标签与分类帮助组织内容，但不应强迫每篇文章都填满。

### 可被找到

列表页、归档、搜索、RSS 和 sitemap 是内容型站点的基本出口。它们不显眼，却决定了旧内容是否还有生命。

### 可被回应

评论可以很简单：昵称、邮箱、正文、审核。没有账号系统也能形成交流。

## 可以后置的部分

- 复杂角色权限：个人博客通常只有一个作者
- 多主题市场：先把自己的主题做完整
- 实时数据大屏：有意义的是趋势，不是每次刷新的数字
- 富文本块编辑器：Markdown 已经足够稳定

## 我最终保留的后台

最终的后台只保留七块：

1. 概览
2. 文章
3. 评论
4. 分类与标签
5. 友链
6. 站点设置
7. 账号安全

每一块都直接服务于公开页面上的某件事。没有为了“后台完整感”而存在的模块。

## 参考系统的正确用法

参考不是复刻。成熟系统告诉我们哪些问题真实存在，而新的设计应该回答：在今天的设备、审美和维护成本下，这些问题有没有更简单的解法。`,
  },
];

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await execute(
    `INSERT INTO users (username, email, password_hash, display_name, bio, role)
     VALUES (?, ?, ?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
    [env.ADMIN_USERNAME, env.ADMIN_EMAIL, passwordHash, 'JXY', '写代码，也记录代码之外的事。'],
  );

  const user = await queryOne<RowDataPacket & { id: number }>(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    [env.ADMIN_USERNAME],
  );
  if (!user) throw new Error('Admin user was not created.');

  for (const category of categories) {
    await execute(
      `INSERT INTO categories (name, slug, description, color, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), color = VALUES(color), sort_order = VALUES(sort_order)`,
      [category.name, category.slug, category.description, category.color, category.sort],
    );
  }

  await saveSettings(defaultSettings);

  const postCount = await queryOne<RowDataPacket & { total: number }>('SELECT COUNT(*) AS total FROM posts');
  if (Number(postCount?.total ?? 0) > 0) {
    console.log('Posts already exist; seed skipped article creation.');
    await pool.end();
    return;
  }

  for (const [index, post] of posts.entries()) {
    const category = await queryOne<RowDataPacket & { id: number }>(
      'SELECT id FROM categories WHERE name = ? LIMIT 1',
      [post.category],
    );
    await withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO posts
          (title, slug, excerpt, content, category_id, author_id, status, featured,
           allow_comments, view_count, reading_time, published_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, ?, ?)`,
        [
          post.title,
          post.slug,
          post.excerpt || makeExcerpt(post.content),
          post.content,
          category?.id ?? null,
          user.id,
          post.featured ? 1 : 0,
          post.views,
          estimateReadingTime(post.content),
          post.publishedAt,
        ],
      );
      for (const tagName of post.tags) {
        const tagSlug = slugify(tagName);
        await connection.execute(
          'INSERT INTO tags (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [tagName, tagSlug],
        );
        const [tagRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
          'SELECT id FROM tags WHERE slug = ? LIMIT 1',
          [tagSlug],
        );
        if (tagRows[0]) {
          await connection.execute('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)', [
            result.insertId,
            tagRows[0].id,
          ]);
        }
      }
      if (index === 0) {
        await connection.execute(
          `INSERT INTO comments (post_id, author_name, author_email, content, status, created_at)
           VALUES (?, 'Lin', 'lin@example.com', '很喜欢这次改版里对留白和阅读节奏的处理，期待看到更多设计复盘。', 'approved', '2026-11-13 10:20:00')`,
          [result.insertId],
        );
        await connection.execute(
          `INSERT INTO comments (post_id, author_name, author_email, content, status, created_at)
           VALUES (?, '一位路过的开发者', 'dev@example.com', '服务端渲染这个选择很务实，想看看后续部署和缓存策略的分享。', 'pending', '2026-11-14 18:05:00')`,
          [result.insertId],
        );
      }
    });
  }

  const links = [
    { name: 'GitHub', url: 'https://github.com/jxy162', description: '代码与开源项目', color: '#20242a', sort: 1 },
    { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', description: '前端技术参考', color: '#3f6e9e', sort: 2 },
    { name: 'OneBlog', url: 'https://github.com/zhangyd-c/OneBlog', description: '经典开源博客系统', color: '#e86f49', sort: 3 },
    { name: 'Material Design', url: 'https://m3.material.io/', description: '设计系统与组件规范', color: '#0a8a4e', sort: 4 },
  ];

  for (const link of links) {
    await execute(
      `INSERT INTO links (name, url, description, color, sort_order, visible)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE description = VALUES(description), color = VALUES(color)`,
      [link.name, link.url, link.description, link.color, link.sort],
    );
  }

  console.log(`Seed complete: ${posts.length} posts, ${categories.length} categories, ${links.length} links.`);
  console.log(`Admin login: ${env.ADMIN_USERNAME} / ${env.ADMIN_PASSWORD}`);
  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
