# 部署到 VPS（Debian + codex）

本应用是一个 **长驻 Node 服务**（Next.js 全栈）：首页输入仓库地址 → 后端在本机拉取仓库并调用本机 `codex` 拆解 → SSE 实时进度 → 渲染分层教程。codex 必须装在服务器上并登录好。

> ⚠️ 不能用 serverless/边缘部署：后台生成任务和 SSE 需要稳定进程。请用 `next start`（或 pm2/systemd）。

## 0. 前置条件

```bash
node -v        # >= 20
git --version
codex --version   # 已安装并完成登录（codex login）
```

## 1. 拉取 + 安装 + 构建

```bash
git clone https://github.com/OneLastHug/aicourse.git
cd aicourse
npm install                # 安装编排引擎 + Next.js 站点
npm -w site run build      # 生产构建
```

## 2. 运行（带持久化数据目录 + codex）
> ⚠️ **持久化关键**：`R2L_DATA_DIR` 必须是仓库目录**之外**的绝对路径（例如 `/var/lib/aicourse`）。
> 如果放在仓库内（默认的 `./data`），每次 `git pull` / 重新部署 / `git clean` 都可能把它清掉，已生成的教程就会消失。
> 服务器启动时日志会打印 `[repo2learn] data dir: <实际路径>`，可用它确认数据到底存在哪。


```bash
# 持久化目录（生成的课程存这里，重启不丢）
export R2L_DATA_DIR=/var/lib/aicourse
mkdir -p "$R2L_DATA_DIR"

# 真实 codex 模式（不要设 R2L_MOCK；codex 走默认 gpt-5.4 / xhigh / 教程生成共享并发 10）
npm -w site run start      # 监听 http://0.0.0.0:3000
```

环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `R2L_DATA_DIR` | 课程/缓存/仓库克隆的存放目录 | `./data` |
| `R2L_MOCK` | `=1` 用 mock 驱动（离线测试，不调 codex） | 未设=真实 codex |

并发上限、模型、思考强度等在 `src/types.ts` 的 `DEFAULT_CONFIG`，或 `config/repo2learn.config.ts` 里改。

## 3. 用 systemd 常驻（推荐）

`/etc/systemd/system/aicourse.service`：

```ini
[Unit]
Description=AICourse (Repo2Learn)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/aicourse
Environment=R2L_DATA_DIR=/var/lib/aicourse
Environment=PATH=/usr/local/bin:/usr/bin:/bin   # 确保能找到 codex
ExecStart=/usr/bin/npm -w site run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aicourse
sudo systemctl status aicourse
journalctl -u aicourse -f     # 看日志
```

## 4. 反向代理 + HTTPS（可选，Nginx）

```nginx
server {
  server_name your.domain;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    # SSE 需要关闭缓冲
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
}
```

## 5. 推送后自动更新（自动拉取）

如果你已有「GitHub push → VPS 自动拉取」的机制，把它接到这个脚本即可（`/opt/aicourse/deploy.sh`）：

```bash
#!/usr/bin/env bash
set -e
cd /opt/aicourse
git pull --ff-only
npm install --omit=dev
npm -w site run build
systemctl restart aicourse
```

- 用 GitHub Webhook：加一个监听 push 的最小服务调 `deploy.sh`。
- 或用定时：`crontab -e` → `*/2 * * * * /opt/aicourse/deploy.sh >> /var/log/aicourse-deploy.log 2>&1`。

## 6. 常见问题

- **codex 不在服务 PATH**：systemd 的 `Environment=PATH=...` 要包含 codex 所在目录；`which codex` 确认。
- **生成很慢/超时**：codex 每课是深度思考调用，10 节约数分钟属正常；SSE 已设 `maxDuration=600`。
- **想强制重算某课**：删 `R2L_DATA_DIR/courses/<repoId>`，或对缓存 `R2L_DATA_DIR/cache` 做清理。
