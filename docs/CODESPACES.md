# 在 GitHub Codespaces 中运行晚安的博客

仓库中的 `.devcontainer` 会自动创建 Node.js 24 开发容器和 MySQL 8.4 数据库，并启动博客。

## 创建 Codespace

1. 打开 <https://github.com/jxy162/blog4mi>。
2. 点击 **Code → Codespaces → Create codespace on main**。
3. 等待容器构建、`npm ci`、数据库迁移和管理员初始化完成。
4. 当 `3000` 端口出现后，打开 **Ports** 面板中的博客预览。

开发服务器由 `.devcontainer/devcontainer.json` 的 `postStartCommand` 自动启动。如果页面暂时无法访问，在 Codespaces 终端执行：

```bash
tail -f /tmp/blog4mi-dev.log
```

手动重启开发服务器：

```bash
pkill -f "tsx watch" || true
npm run db:migrate
npm run db:seed
nohup npm run dev > /tmp/blog4mi-dev.log 2>&1 &
```

## 默认账号

- 用户名：`admin`
- 密码：`Admin@123456`
- 后台：`/admin/login`

首次登录后请在「账号安全」中修改密码。若准备把端口公开给他人访问，还应修改 `.devcontainer/docker-compose.yml` 中的 `SESSION_SECRET` 和数据库密码。

## 数据与示例内容

- 首次启动只创建管理员和默认站点设置，不会创建示例文章、分类、标签、评论或友链。
- MySQL 数据保存在 Docker 命名卷 `blog4mi_codespaces_mysql` 中，停止并重新打开 Codespace 后仍会保留。
- 如需再次清空博客内容（保留管理员与设置）：

```bash
npm run db:clear-content
```

- 如需连数据库一起彻底重置，可在 Codespaces 终端删除对应 Docker 卷，或在 Docker 面板中清理 Compose 资源。

## 注意

Codespaces 适合开发、预览和验收。免费额度、闲置超时和端口访问策略由 GitHub 控制，不建议把它当作长期生产服务器。需要 24 小时公开访问时，应将同一个 Docker 镜像部署到云服务器或支持 Docker 的托管平台。