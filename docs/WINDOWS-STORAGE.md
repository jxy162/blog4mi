# Windows：使用 Docker Desktop 并把数据放到 D 盘

本机 C 盘空间有限。本项目使用 **Docker Desktop + WSL 2 后端**，安装目录、Docker 镜像/卷数据、WSL 发行版和开发用 MySQL 均规划在 D 盘。

## 当前已完成的配置

| 项目 | 位置 / 版本 |
| --- | --- |
| Docker Desktop | `D:\Docker\DockerDesktop` |
| Docker Desktop 版本 | `4.99.0` |
| Docker Engine | `29.9.3`，Linux 容器 |
| Docker Compose | `v5.7.0` |
| Docker Desktop WSL 数据根目录 | `D:\Docker\data` |
| Docker Desktop 发行版磁盘 | `D:\Docker\data\main\ext4.vhdx` |
| Docker 镜像、容器和卷数据 | `D:\Docker\data\disk\docker_data.vhdx` |
| WSL Ubuntu 发行版 | `D:\WSL\Ubuntu` |
| WSL Swap | `D:\WSL\swap.vhdx` |
| 本地验证用 MySQL 8.4 | `D:\MySQL`，端口 `3307` |

C 盘仍会保留少量 Docker Desktop 配置和日志，主要位于 `%APPDATA%\Docker` 与 `%LOCALAPPDATA%\Docker`，但镜像、容器、数据库卷和 WSL 虚拟磁盘均位于 D 盘。

## Docker Desktop 安装方式

安装器下载到 `D:\Docker\DockerDesktopInstaller.exe` 后，使用当前用户模式安装，并将 WSL 数据根目录指向 D 盘：

```powershell
& 'D:\Docker\DockerDesktopInstaller.exe' install `
  --user `
  --quiet `
  --accept-license `
  --backend=wsl-2 `
  --installation-dir=D:\Docker\DockerDesktop `
  --wsl-default-data-root=D:\Docker\data
```

`--user` 安装不要求管理员权限。安装完成后，Docker Desktop 会把镜像和卷存储到 `--wsl-default-data-root` 指定的位置。
## 日常启动项目

先启动 Docker Desktop：

```powershell
Start-Process 'D:\Docker\DockerDesktop\Docker Desktop.exe'
```

等待托盘中的 Docker 图标显示引擎已启动，然后执行：

```powershell
Set-Location D:\project\BLOG
docker compose up -d --build
docker compose ps
```

首次启动会自动拉取镜像、构建应用、执行数据库建表与初始化种子数据。服务就绪后访问：

- 博客首页：<http://localhost:3000>
- 健康检查：<http://localhost:3000/health>
- 管理后台：<http://localhost:3000/admin/login>
- 默认管理员：`admin` / `Admin@123456`

查看日志：

```powershell
docker compose logs -f app
```

停止项目：

```powershell
docker compose down
```

该命令保留 MySQL 数据卷。只有确定要清空全部博客数据时才执行：

```powershell
docker compose down -v
```
## 验证数据确实位于 D 盘

检查 WSL 发行版及其虚拟磁盘：

```powershell
wsl -l -v
Get-ChildItem D:\Docker\data -Recurse -Filter *.vhdx |
  Select-Object FullName, Length, LastWriteTime
```

预期至少能看到：

```text
D:\Docker\data\main\ext4.vhdx
D:\Docker\data\disk\docker_data.vhdx
```

检查 Docker 引擎和磁盘占用：

```powershell
docker version
docker info
docker system df
```

## 常用维护命令

```powershell
# 查看所有容器
docker compose ps

# 重新构建博客应用
docker compose build --no-cache app
docker compose up -d

# 清理未使用的镜像和构建缓存
docker image prune
docker builder prune

# 查看 Docker Desktop 磁盘镜像
Get-ChildItem D:\Docker\data -Recurse -Filter *.vhdx
```

不要随意删除 `D:\Docker\data` 下的 VHDX 文件，否则会丢失 Docker 镜像、容器和 MySQL 数据卷。备份博客数据库时建议使用 `mysqldump`，不要直接复制正在运行的容器文件。
## 本地 MySQL 开发实例

便携版 MySQL 8.4 仅用于不通过 Docker 的本机开发与验收，端口为 `3307`，避免与 Docker Compose 暴露的 `3306` 冲突：

- 程序：`D:\MySQL\server\mysql-8.4.7-winx64`
- 数据：`D:\MySQL\data`
- 配置：`D:\MySQL\my.ini`
- 日志：`D:\MySQL\mysql-error.log`

启动：

```powershell
Start-Process 'D:\MySQL\server\mysql-8.4.7-winx64\bin\mysqld.exe' `
  -ArgumentList '--defaults-file=D:\MySQL\my.ini','--log-error=D:\MySQL\mysql-error.log' `
  -WindowStyle Hidden
```

停止：

```powershell
& 'D:\MySQL\server\mysql-8.4.7-winx64\bin\mysqladmin.exe' `
  --protocol=TCP --host=127.0.0.1 --port=3307 --user=root shutdown
```