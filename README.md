# xianbao.fun 镜像站（线报酷归档）

把 [new.xianbao.fun](https://new.xianbao.fun)（线报酷，Z-BlogPHP）做成一个**静态镜像**，
由 GitHub Actions 定时自动采集、提交到私有仓库，并可一键部署到 **Vercel** 与 **Netlify**；
同时提供**周级 Release 归档**作为整站时间点备份。

> 本方案改编自已有的 `qke.net` 项目，架构一致：Playwright 无头渲染 → 链接改写为部署前缀 →
> Actions 定时提交静态产物 → Vercel/Netlify 直发。

---

## ⚠️ 重要须知（请先读）

1. **用途定位：个人归档**。本工具用于把公开网页抓取为本地/私有仓库的静态副本，便于个人留存与离线浏览。
   原站内容（文字、图片、评论）的版权归原站运营方所有，镜像站**不应**用于冒充原站、二次分发牟利或任何侵权用途。
2. **“完整镜像”的务实边界**。原站分页到约 **1298 页**、全站文章约 **6.5 万篇**。受 GitHub 仓库体积
   （软上限 1GB / 单文件 100MB）与 Actions 单次运行时长（上限 6 小时）限制，**无法一次性镜像全部历史**。
   默认策略为**滚动采集近期窗口**（首页 + 最近若干列表页，约 2500~3000 篇）+ 每日增量，
   配合周级 Release 做时间点整站备份。日积月累即可覆盖活跃内容。需要调整范围见下方「可调参数」。
3. **外链资源保持热链**。文章图片等多存于外部 CDN（如 `v.yuebuy.cn`），脚本**只下载同站资源**，
   外链图片仍指向原 CDN。这样能控制仓库体积，但意味着镜像的图片依赖于原 CDN 在线。
4. **“不被发现”是尽力而为，非绝对**。脚本已做基础礼貌化（限速、常规 UA、浏览器指纹伪装），
   这同时降低了被识别为异常流量的概率；但原站服务器始终能看到请求来源（IP、时间规律），
   且一旦把镜像**公开部署**到 Vercel/Netlify，它的地址可被搜索引擎/引用发现。**没有真正意义的“隐形”**。
5. **评论已包含**。原站评论为 AJAX 动态加载，渲染脚本会在文章页等待评论注入完成后再抓取 DOM，
   因此镜像中包含评论内容（与文章页同一快照）。

---

## 文件结构

```
xianbao-mirror/
├── mirror/
│   ├── render.py            # Playwright 渲染核心（抓取 + 评论等待 + 链接改写 + 资源补全）
│   ├── mirror.sh            # 部署前修复（404 / favicon / 覆盖 CSS / 可选 Vercel 分析）
│   ├── requirements.txt     # 依赖版本锁定
│   ├── xianbao-override.css # 响应式兜底样式
│   ├── 404.html             # 自定义 404 页
│   └── test_render.py       # 核心纯函数单元测试
├── .github/workflows/
│   ├── backup.yml           # 每日渲染并提交 xianbao/（供 Vercel/Netlify 发布）
│   ├── weekly-backup.yml    # 每周创建整站 Release 归档（可恢复历史版本）
│   └── keepalive.yml        # 每周提交时间戳，防止定时任务被 GitHub 自动暂停
├── xianbao/                 # 渲染产物（由 Actions 生成并提交，勿手动编辑）
├── vercel.json              # Vercel 部署配置（outputDirectory: xianbao）
├── netlify.toml            # Netlify 部署配置（publish: xianbao）
└── README.md
```

---

## 可调参数（环境变量，CI 与本地均可覆盖）

在 `backup.yml` / `weekly-backup.yml` 的 `env:` 或本地运行前设置：

| 变量 | 默认 | 说明 |
|------|------|------|
| `TARGET_URL` | `https://new.xianbao.fun` | 目标站点根 |
| `OUT_DIR` | `xianbao` | 输出目录 |
| `PAGES_PREFIX` | `/` | 部署路径前缀；GitHub Pages 项目页改为 `/<repo>` |
| `MAX_PAGES` | `3000` | 单次最大抓取页面数（控制 Actions 时长） |
| `RECENT_LIST_PAGES` | `50` | 仅收录前 N 页分页，防止爬虫一路抓到全站尾页 |
| `NAV_TIMEOUT_MS` | `30000` | 单页导航超时 |
| `CRAWL_DELAY_MS` | `200` | 每页之间的礼貌延时（毫秒） |
| `COMMENT_WAIT_MS` | `6000` | 评论等待上限（实际用 networkidle+settle，远小于此） |

> 想扩大覆盖：调大 `RECENT_LIST_PAGES` 与 `MAX_PAGES`。注意 Actions 6 小时上限——
> 若单次渲染超时，请相应缩小范围或拆分成多次运行。

---

## 本地运行（调试 / 首次验证）

```bash
cd xianbao-mirror
python -m pip install -r mirror/requirements.txt
playwright install --with-deps chromium   # 仅需首次
bash mirror/mirror.sh                     # 渲染到 xianbao/
python -m pytest mirror/test_render.py -q # 跑单元测试
```

---

## 部署到 Vercel / Netlify

`xianbao/` 是纯静态产物，**无需构建**。两种平台都通过 Git 集成读取提交的 `xianbao/` 目录直接发布：

- **Vercel**：导入本仓库 → Framework 选 `Other` → Output Directory 填 `xianbao`（或直接使用仓库内 `vercel.json`）。
  如需访问分析，在 Vercel 后台开启 Analytics 后，本地重新运行
  `INJECT_VERCEL_ANALYTICS=1 bash mirror/mirror.sh` 并提交。
- **Netlify**：导入本仓库 → Build command 留空（或 `echo`）→ Publish directory 填 `xianbao`
  （或直接使用仓库内 `netlify.toml`）。

两个平台可同时接入同一仓库，互不影响（同一份 `xianbao/` 产物）。

---

## 定时备份

- **每日**：`backup.yml` 北京时间 03:30 重新渲染并提交 `xianbao/` 到 `main`，Vercel/Netlify 自动拉取发布。
- **每周**：`weekly-backup.yml` 每周一创建 `backup-YYYY-Www` Release，打包**整个项目**
  （脚本 + `xianbao/` 整站镜像），保留最近 30 周，可随时下载恢复。
- **Keepalive**：`keepalive.yml` 每周提交时间戳，防止 60 天无活动导致定时任务被暂停。

---

## 首次建仓与推送

本仓库初始化为私有。建仓与首次推送请用本机已登录 `gh` 的环境执行（详见 `setup-repo.sh` / `setup-repo.bat`）：

```bash
# 在 xianbao-mirror/ 目录下
gh repo create xianbao-mirror --private --source=. --remote=origin --push
```

推送后到 GitHub 仓库的 **Settings → Actions → General** 确认 Actions 已启用；
首次建议到 Actions 页面手动跑一次 `backup.yml` 验证端到端链路。
