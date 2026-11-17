# Windows：把 WSL 与 Docker 放到 D 盘

本机 C 盘空间有限，因此项目相关的 WSL 磁盘、Docker 数据与 MySQL 开发实例都规划在 D 盘。

## 当前已完成的配置

- `C:\Users\<user>\.wslconfig`
  - WSL 2 内存限制：6 GB
  - CPU：4
  - Swap：4 GB
  - Swap 文件：`D:\WSL\swap.vhdx`
- WSL Ubuntu 目标目录：`D:\WSL\Ubuntu`
- Ubuntu 24.04 WSL 根文件系统：`D:\WSL\ubuntu-noble-rootfs.tar.gz`
- Docker 预留目录：`D:\Docker`
- 本地验证用 MySQL 8.4：`D:\MySQL`，端口 `3307`

## 为什么还没有启动 WSL

当前系统没有启用「虚拟机平台（VirtualMachinePlatform）」，因此 `wsl --import` 会提示：

```text
当前计算机配置不支持 WSL2
```

启用该 Windows 功能需要管理员权限并重启电脑。

## 一次性启用与导入

在**管理员 PowerShell**中执行：

```powershell
wsl --install --no-distribution
```

也可以使用：

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

随后重启 Windows。重启后执行：

```powershell
wsl --import Ubuntu D:\WSL\Ubuntu D:\WSL\ubuntu-noble-rootfs.tar.gz --version 2
wsl --set-default Ubuntu
wsl --list --verbose
```

确认 `Ubuntu` 的 `VERSION` 为 `2`，并检查 `D:\WSL\Ubuntu\ext4.vhdx` 已生成。该 VHDX 就是发行版全部数据，位于 D 盘。

## 在 Ubuntu 中安装 Docker Engine

```powershell
wsl -d Ubuntu -u root
```

在 Ubuntu 内执行：

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg docker.io docker-compose-v2
mkdir -p /etc/docker /srv/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "data-root": "/srv/docker"
}
EOF

cat >/etc/wsl.conf <<'EOF'
[boot]
systemd=true
EOF

systemctl enable --now docker
```

创建日常用户并加入 Docker 组：

```bash
adduser jxy
usermod -aG docker jxy
```

回到 Windows，重启 WSL：

```powershell
wsl --shutdown
wsl -d Ubuntu -u jxy
```

验证：

```bash
docker version
docker compose version
docker info | grep "Docker Root Dir"
```

`Docker Root Dir` 应为 `/srv/docker`。该路径位于 `D:\WSL\Ubuntu\ext4.vhdx` 内，实际占用仍在 D 盘。

## 如果选择 Docker Desktop

项目不依赖 Docker Desktop。若后续仍要安装，请：

1. 在 Docker Desktop 的 `Settings → Resources → Advanced` 中把磁盘镜像位置改为 `D:\Docker\data`。
2. 不要使用默认的 `%LOCALAPPDATA%\Docker\wsl`。
3. 安装前确认所有 WSL 发行版已通过 `wsl --import` 导入到 `D:\WSL`。
4. Docker Desktop 的程序文件通常仍会写入 `C:\Program Files`；推荐方案是 **WSL Ubuntu 内运行 Docker Engine**。

## 本地 MySQL 开发实例

为完成当前项目的真实数据库验证，已使用 MySQL 8.4 便携版：

- 程序：`D:\MySQL\server\mysql-8.4.7-winx64`
- 数据：`D:\MySQL\data`
- 配置：`D:\MySQL\my.ini`
- 端口：`3307`
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

项目正式部署推荐 Docker Compose 或独立 MySQL 8.4 服务。便携 MySQL 只用于本机开发与验收。
