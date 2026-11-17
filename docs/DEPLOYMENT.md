# 使用 GitHub Actions + Railway 部署晚安的博客

GitHub Pages 不能运行 Node.js 和 MySQL。生产环境采用以下分工：

- **GitHub**：源码、CI、自动构建 Docker 镜像、GHCR 镜像仓库
- **Railway**：运行博客容器和 MySQL，提供公网 HTTPS 域名
- **GitHub Actions**：每次推送到 `main` 自动测试、容器冒烟测试并发布镜像

## 一、在 Railway 创建项目

1. 使用 GitHub 登录 <https://railway.com/>。
2. 选择 **New Project → Deploy from GitHub repo**。
3. 选择 `jxy162/blog4mi`，分支选择 `main`。
4. 在项目中点击 **New → Database → MySQL**。
5. 等待 MySQL 创建完成。

仓库根目录的 `railway.json` 会自动使用 `Dockerfile` 构建，并在每次发布前执行：

```bash
node dist/scripts/migrate.js
node dist/scripts/seed.js
```

随后执行 `node dist/index.js`，健康检查路径为 `/health`。

## 二、配置应用变量

打开博客应用服务的 **Variables**，添加以下变量。

```text
NODE_ENV=production
SESSION_SECRET=<64 位随机字符串>
SITE_URL=https://<Railway 生成的域名>
ADMIN_USERNAME=admin
ADMIN_EMAIL=你的邮箱
ADMIN_PASSWORD=<至少 10 位的强密码>
```

生成 `SESSION_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

数据库连接推荐分别引用 MySQL 服务变量：

```text
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
```

如果 Railway 中 MySQL 服务不叫 `MySQL`，请把 `${{MySQL.xxx}}` 中的服务名改成实际名称。

也可以使用单条数据库 URL，但不要同时设置 `DATABASE_URL` 和 `DB_*`，否则应用会优先使用 `DATABASE_URL`：

```text
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

## 三、生成公网域名

1. 打开应用服务的 **Settings → Networking**。
2. 点击 **Generate Domain**。
3. 把生成的 `https://...up.railway.app` 地址填入 `SITE_URL`。
4. 重新部署一次，确保 RSS、Sitemap、Canonical URL 和 Cookie 使用正式域名。

部署完成后访问：

- 博客：`https://<你的域名>/`
- 健康检查：`https://<你的域名>/health`
- 管理后台：`https://<你的域名>/admin/login`

管理员账号由 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 在首次部署时创建。之后修改 Railway 变量不会覆盖已经修改过的管理员密码。

## 四、GitHub Actions

`.github/workflows/ci.yml` 在推送到 `main` 时执行：

1. TypeScript 类型检查；
2. Vitest 单元测试；
3. 生产构建；
4. 生产依赖安全审计；
5. Docker Compose 冒烟测试；
6. 构建并推送镜像到 GHCR。

镜像地址：

```text
ghcr.io/jxy162/blog4mi:latest
ghcr.io/jxy162/blog4mi:sha-<commit>
```

如果需要在其他服务器拉取该镜像，可在 GitHub 仓库的 **Packages** 设置中调整镜像可见性，或使用 GitHub Token 登录 GHCR。

## 五、Railway CLI（可选）

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

Railway 连接 GitHub 仓库后，推送 `main` 会自动重新部署，一般不需要手动执行 `railway up`。

## 六、运维建议

- 在 Railway 中开启 MySQL 备份，或定期使用 `mysqldump` 导出数据。
- 不要把 `.env`、数据库密码或管理员密码提交到 Git。
- 首次登录后立即修改管理员密码。
- 使用 Railway 的 Deployment 历史快速回滚旧版本。
- Codespaces 用于开发预览，不作为长期生产服务器。