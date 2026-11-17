# blog4mi

一个以 **Node.js + TypeScript + MySQL** 构建的个人博客系统。视觉语言参考支付宝 Agent Pay 产品页的简洁平面设计，并结合 **Material Design 3 Expressive（M3E）** 的色调层级、形状系统与动效原则。

## 技术栈

- Node.js 20+
- TypeScript 5
- Express 5 + EJS 服务端渲染
- MySQL 8.4 / `mysql2`
- Markdown + highlight.js + sanitize-html
- Cookie Session、CSRF 防护、bcryptjs、Helmet、Rate Limit
- Vitest

## 功能

### 公开站点

- 首页 Hero、置顶文章、最新文章、主题与标签入口
- 文章列表、分类筛选、标签筛选、关键词搜索、分页
- 文章详情、自动目录、代码高亮、阅读进度、上一篇/下一篇、相关文章
- 文章归档、分类索引、标签索引
- 评论提交与审核后展示
- 关于页、友链页
- RSS、sitemap.xml、robots.txt
- 深色/浅色主题、响应式布局、减少动态效果支持

### 管理后台

- 登录、退出、修改密码
- 概览：文章、草稿、浏览、待审评论
- 文章创建、编辑、预览、发布、归档、删除
- Markdown 工具栏与实时预览
- 分类与标签管理
- 评论审核、标记垃圾、删除
- 友链管理
- 站点身份、首页文案、联系方式、关于页内容设置

## 快速开始

### 1. 环境变量

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

生产环境必须替换 `SESSION_SECRET` 和默认管理员密码。

### 2. 使用 Docker Desktop

先启动 Docker Desktop，然后在项目目录执行：

```powershell
docker compose up -d --build
docker compose ps
```

应用会等待 MySQL 通过 TCP 健康检查，自动执行建表和幂等种子脚本，然后监听 `http://localhost:3000`。健康检查地址为 `http://localhost:3000/health`。

Windows 下的安装目录、Docker 数据盘位置与日常命令见 [docs/WINDOWS-STORAGE.md](docs/WINDOWS-STORAGE.md)。

仅启动数据库：

```bash
docker compose up -d db
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. 使用本机 MySQL

创建数据库和用户，然后按实际端口修改 `.env` 中的 `DATABASE_URL` / `DB_*` 配置：

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

默认管理员：

- 用户名：`admin`
- 密码：`Admin@123456`

首次登录后请立即在「账号安全」中修改密码。

## 常用命令

```bash
npm run dev          # 开发服务器
npm run check        # TypeScript 类型检查
npm test             # 单元测试
npm run build        # 编译并复制 views/public 到 dist
npm start            # 运行生产构建
npm run db:migrate   # 开发环境建表
npm run db:seed      # 初始化管理员、分类、示例文章与友链
```

## 目录结构

```text
src/
  app.ts               Express 应用与中间件
  routes/              公开站、后台、登录路由
  services/            文章、设置、后台数据服务
  lib/                 Markdown、模板渲染、工具函数
  middleware/          鉴权、CSRF、错误处理
  views/               EJS 页面与后台模板
  public/              CSS、JavaScript、SVG 图标
db/schema.sql          MySQL 表结构
tests/                 Vitest 单元测试
docs/                  设计与 Windows 存储说明
```

## 设计与安全说明

- 视觉规范与目标站分析见 [docs/DESIGN.md](docs/DESIGN.md)。
- Windows 下 Docker Desktop 安装、WSL 2 配置与 D 盘数据位置见 [docs/WINDOWS-STORAGE.md](docs/WINDOWS-STORAGE.md)。
- 所有写操作均经过 CSRF 校验；Markdown 输出经过白名单清洗。
- 评论默认进入待审核队列，登录和评论接口有限流。
- 生产环境建议通过 HTTPS 反向代理暴露服务，并定期备份 MySQL。

## License

MIT
