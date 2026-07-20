# 用 Cloudflare Worker 免费层做「随机触发 GitHub Actions」

目标：私有仓爬取既**真随机隐蔽**（落点小时级均匀）又**省 Actions 额度**（GitHub runner 不 sleep）。

## 原理
1. Cloudflare Cron Trigger 每天触发 Worker 一次（锚点，北京时间 01:00）。
2. Worker 算一个 0~`RANDOM_WINDOW_SEC` 的随机延迟，交给 Durable Object 的 alarm。
3. alarm 到点调用 GitHub `workflow_dispatch`，触发 `backup.yml`。

→ GitHub 每天只跑 1 次，额度 = 爬取本身；随机性由 Cloudflare 承担（免费）。

## 前置
- 一个 **Cloudflare 免费账号**（workers.dev 域名即可）。
- 一个 **GitHub PAT**：
  - 经典令牌需勾选 `repo` + `workflow`；
  - 或 Fine-grained Token，对该仓库授予 **Actions: write**。
  - 复制令牌值（只显示一次）。

## 部署步骤
```bash
cd cloudflare
npm i -g wrangler            # 或 npx wrangler
wrangler login              # 浏览器 OAuth 登录 Cloudflare
wrangler secret put GH_TOKEN   # 粘贴上面的 GitHub PAT
wrangler deploy             # 部署 Worker + DO 绑定 + Cron Trigger
```
部署后到 Cloudflare 控制台 → Workers → xianbao-mirror-trigger →
- **Triggers** 页能看到 Cron `0 17 * * *`；
- **Settings → Variables** 能看到 `GH_TOKEN`(secret) 与 `RANDOM_WINDOW_SEC`(var)。

## 切到 Worker 触发（重要：避免双触发双额度）
当前 `backup.yml` 仍带 GitHub 自带 `schedule` 定时。若保留它 + Worker，会变成每天 2 次运行、额度翻倍。
确认 Worker 跑通一次后，把 `backup.yml` 的 `schedule` 块注释掉，只留 `workflow_dispatch`：

```yaml
on:
  # schedule:
  #   - cron: "0 17 * * *"
  workflow_dispatch: {}
```
（`concurrency: group: backup` 已设，万一两路同时到点也不会并发冲掉。）

## 想要更宽/更窄的随机
改 `RANDOM_WINDOW_SEC`：
- `7200` → 北京 01:00~03:00 随机（与现状窗口一致，但真随机）；
- `86400` → 全天任意小时随机（最隐蔽）；
- `300` → 01:00~01:05（与当前几乎等价，但 GitHub 端零 sleep 浪费）。

控制台 Variables 里改值后 `wrangler deploy` 即生效，无需改代码。

## 免费层额度说明
- Workers 免费：每日 10 万请求 / 10ms CPU（alarm 执行极轻，远不触顶）。
- Cron Trigger 免费层支持有限个（本方案用 1 个，足够）。
- Durable Object 免费层可用，本场景请求量可忽略。
- 真正花钱的是 GitHub Actions——而本方案把它压到“只爬取”，私有仓 2000 分钟/月绰绰有余。

## 备选（不想注册 Cloudflare）
本机 Windows 任务计划程序：每天触发一个 PowerShell/脚本，脚本内在随机时刻调
`gh workflow run -R xfxx2022/xianbao-mirror`（需本机装 gh 且已登录）。机器开机即可，零外部依赖。
