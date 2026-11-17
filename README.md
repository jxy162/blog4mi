# 晚安的博客

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

### 2. 使用 GitHub Codespaces

仓库已包含 `.devcontainer` 配置。在 GitHub 仓库页面选择 **Code → Codespaces → Create codespace on main**，Codespaces 会自动：

1. 启动 Node.js 24 开发容器和 MySQL 8.4；
2. 安装依赖并执行数据库迁移；
3. 创建管理员和默认站点设置；
4. 启动开发服务器并转发 `3000` 端口。

详细说明见 [docs/CODESPACES.md](docs/CODESPACES.md)。

### 3. 使用 Docker Desktop

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

### 4. 使用本机 MySQL

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

## 生产部署

GitHub Pages 无法运行 Node.js 与 MySQL。正式部署采用 **GitHub Actions + Railway**：

- GitHub Actions 自动执行测试、Docker 冒烟测试并发布镜像到 GHCR；
- Railway 从 GitHub 仓库自动部署博客容器和 MySQL，生成公网 HTTPS 域名。

完整步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 常用命令

```bash
npm run dev          # 开发服务器
npm run check        # TypeScript 类型检查
npm test             # 单元测试
npm run build        # 编译并复制 views/public 到 dist
npm start            # 运行生产构建
npm run db:migrate   # 开发环境建表
npm run db:seed      # 初始化管理员与默认设置（不创建示例内容）
npm run db:clear-content  # 清空文章、分类、标签、评论和友链，保留管理员与设置
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
.devcontainer/         GitHub Codespaces 开发容器配置
railway.json           Railway 生产部署配置
docs/                  设计与部署说明
```

## 设计与安全说明

- 视觉规范与目标站分析见 [docs/DESIGN.md](docs/DESIGN.md)。
- Windows 下 Docker Desktop 安装、WSL 2 配置与 D 盘数据位置见 [docs/WINDOWS-STORAGE.md](docs/WINDOWS-STORAGE.md)。
- GitHub Codespaces 启动方式与默认账号见 [docs/CODESPACES.md](docs/CODESPACES.md)。
- Railway + GitHub Actions 生产部署见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
- 所有写操作均经过 CSRF 校验；Markdown 输出经过白名单清洗。
- 评论默认进入待审核队列，登录和评论接口有限流。
- 生产环境建议通过 HTTPS 反向代理暴露服务，并定期备份 MySQL。

## License

MIT
