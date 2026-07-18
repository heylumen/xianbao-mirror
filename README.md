# xianbao.fun 镜像站（线报酷归档）

把 [new.xianbao.fun](https://new.xianbao.fun)（线报酷，Z-BlogPHP）做成一个**静态镜像**，
由 GitHub Actions 定时自动采集、提交到私有仓库，并可一键部署到 **Vercel** 与 **Netlify**；
同时提供**周 / 月 / 年级别 Release 归档**作为时间点备份，并内置**站内搜索**。

> 本方案改编自已有的 `qke.net` 项目，架构一致：Playwright 无头渲染 → 链接改写为部署前缀 →
> Actions 定时提交静态产物 → Vercel/Netlify 直发。

---

## ✨ 本期能力（相对旧版）

- **仅镜像指定 5 个分类**：`zuankeba`（赚客吧）、`xinzuanba`（新赚客吧）、`xiaodigu`（小弟谷）、
  `huluxia`（葫芦侠）、`xiaodao`（小道）。其余页面（首页 / 其他分类 / 关于 / 免责等）**一律不抓取**；
  这些非白名单链接在镜像页内改写为「原站绝对地址」，点击会跳转到活站，避免 404。
- **状态化增量爬取**：进度写入 `xianbao/.crawl-state.json` 并提交仓库。
  - `crawl` 模式：每天每分类抓 `PAGES_PER_RUN_PER_CAT` 个列表页，直到各分类抓完，自动转 `maintenance`。
  - `maintenance` 模式：每天只检查各分类第 1 页（捕获新帖）+ 抽样复查已抓帖的内容签名，
    仅当内容/评论变化时重存。**不重复全量存储**，大幅降低源站负载。
- **源域名随机轮换**：从 6 个已验证内容一致的 HTTPS 域名（`new.xianbao.fun` / `news.xianbao.fun` /
  `new.ixbk.net` / `news.ixbk.net` / `new.ixbk.fun` / `news.ixbk.fun`）中随机选一个作抓取源，
  分散单域名请求频次。因各域名内容/URL 完全一致，轮换不会碎片镜像。
- **夜间随机时间**：`backup.yml` 在北京时间约 02:00 基准上叠加 **0~45 分钟随机抖动**，
  把请求打散到深夜，降低被识别为规律爬虫的概率（抖动控制在 45 分钟内以免过度消耗 Actions 额度）。
- **站内搜索**：渲染时生成 `search.json` 索引与 `search.html` 搜索页（MiniSearch 前端检索），
  每个页面右下角有「🔍 搜索」悬浮按钮。满足「搜索站内内容」的核心诉求（每日重建，随备份更新）。
- **多级别归档**：周 / 月 / 年 三级 Release 归档点；镜像内容本身完整留存于每日 git 提交历史。
- **失效地址自动跳过（减少源站负担 / 更隐蔽）**：页面或资源返回 **404/410** 时，会把该地址写入
  `xianbao/.crawl-state.json` 的 `dead`（页面）/ `dead_assets`（资源）集合，**后续运行直接跳过、不再请求**；
  既可避免对死链反复抓取暴露规律，也能省下请求额度。失效记录默认 **90 天后自动过期重试一次**（应对源站临时恢复），
  可用 `DEAD_TTL_DAYS=0` 设为永不过期。

---

## ⚠️ 重要须知（请先读）

1. **用途定位：个人归档**。本工具用于把公开网页抓取为本地/私有仓库的静态副本，便于个人留存与离线浏览。
   原站内容（文字、图片、评论）的版权归原站运营方所有，镜像站**不应**用于冒充原站、二次分发牟利或任何侵权用途。
2. **“完整镜像”的务实边界**。原站分页到约 **1298 页**、全站文章约 **6.5 万篇**，但本镜像**仅覆盖指定的 5 个分类**。
   受 GitHub 仓库体积（软上限 1GB / 单文件 100MB）与 Actions 单次运行时长（上限 6 小时）限制，
   采用「**每天增量一小批，逐日累积直到抓完 5 分类，之后转维护模式只查更新**」的策略，
   既能最终覆盖全部目标内容，又避免一次性巨量请求。
3. **外链资源保持热链**。文章图片等多存于外部 CDN（如 `v.yuebuy.cn`），脚本**只下载同站资源**，
   外链图片仍指向原 CDN。这样能控制仓库体积，但意味着镜像的图片依赖于原 CDN 在线。
4. **“不被发现”是尽力而为，非绝对**。已做：限速、常规 UA、浏览器指纹伪装、**源域名轮换**、
   **增量小批量 + 夜间随机时间**。这降低了被识别为异常流量的概率；但原站服务器始终能看到请求来源（IP、时间规律），
   且一旦把镜像**公开部署**到 Vercel/Netlify，它的地址可被搜索引擎/引用发现。**没有真正意义的“隐形”**。
5. **评论已包含**。原站评论为 AJAX 动态加载，渲染脚本会在文章页等待评论注入完成后再抓取 DOM，
   因此镜像中包含评论内容（与文章页同一快照）。`maintenance` 模式的内容签名比对正文+评论区文本，
   能检测「新评论」并触发更新。

---

## 文件结构

```
xianbao-mirror/
├── mirror/
│   ├── render.py            # Playwright 渲染核心（增量爬虫 + 白名单 + 域名轮换 + 评论等待 + 链接改写 + 搜索索引）
│   ├── mirror.sh            # 部署前修复（404 / favicon / 覆盖 CSS / 搜索按钮 / 可选 Vercel 分析）
│   ├── requirements.txt     # 依赖版本锁定
│   ├── xianbao-override.css # 响应式兜底样式
│   ├── 404.html             # 自定义 404 页
│   └── test_render.py       # 核心纯函数单元测试（白名单/链接改写/签名/索引）
├── .github/workflows/
│   ├── backup.yml           # 每日增量渲染（约 02:00 北京时间 + 0~45m 随机抖动）并提交 xianbao/
│   ├── weekly-backup.yml    # 每周一归档 Release（backup-YYYY-Www，保留 30 周，不重渲染）
│   ├── monthly-backup.yml   # 每月1日归档 Release（backup-YYYY-MM，保留 24 个月，不重渲染）
│   ├── yearly-backup.yml    # 每年1日归档 Release（backup-YYYY，保留 5 年，不重渲染）
│   └── keepalive.yml        # 每周提交时间戳，防止定时任务被 GitHub 自动暂停
├── xianbao/                 # 渲染产物（由 Actions 生成并提交，含 .crawl-state.json 状态文件，勿手动编辑）
├── vercel.json              # Vercel 部署配置（outputDirectory: xianbao）
├── netlify.toml            # Netlify 部署配置（publish: xianbao）
└── README.md
```

---

## 可调参数（环境变量 / 代码常量）

### 环境变量（CI 与本地均可覆盖，写在各 workflow 的 `env:` 或运行前 export）

| 变量 | 默认 | 说明 |
|------|------|------|
| `TARGET_URL` | 随机从 6 域名中选 | 指定单一抓取源（设了就**关闭轮换**）；不设则每次随机轮换 |
| `OUT_DIR` | `xianbao` | 输出目录 |
| `PAGES_PREFIX` | `/` | 部署路径前缀；GitHub Pages 项目页改为 `/<repo>` |
| `PAGES_PER_RUN_PER_CAT` | `6` | `crawl` 模式每轮每分类抓取的列表页数（控制每日增量节奏） |
| `RECHECK_PER_RUN` | `200` | `maintenance` 模式每轮抽样复查的已抓文章数（检测新评论/内容） |
| `MAX_PAGES_PER_RUN` | `400` | 单轮渲染页面总数安全上限（防失控） |
| `CONSEC_MISS_LIMIT` | `3` | 分类列表页连续无新文章达此次数，判定该分类已抓完 |
| `MAX_CAT_PAGES` | `5000` | 单分类列表页安全上限（防死循环） |
| `NAV_TIMEOUT_MS` | `30000` | 单页导航超时 |
| `CRAWL_DELAY_MS` | `200` | 每页之间的礼貌延时（毫秒） |
| `COMMENT_WAIT_MS` | `6000` | 评论等待上限（实际用 networkidle+settle，远小于此） |

### 代码常量（改 `mirror/render.py` 顶部）

- `ALLOWED_CATEGORIES`：要镜像的分类 slug 白名单（默认 5 个，可增删）。
- `DOMAIN_POOL`：参与轮换的源域名列表（默认 6 个已验证一致的 HTTPS 域名）。

> 想加快全量覆盖：调大 `PAGES_PER_RUN_PER_CAT`（如 12~20）。注意 Actions 6 小时上限与仓库体积增长。

---

## 本地运行（调试 / 首次验证）

```bash
cd xianbao-mirror
python -m pip install -r mirror/requirements.txt
playwright install --with-deps chromium   # 仅需首次
bash mirror/mirror.sh                     # 增量渲染到 xianbao/
python -m pytest mirror/test_render.py -q # 跑单元测试
```

> 首次在 CI 跑会进入 `crawl` 模式从各分类第 1 页开始；后续每天推进，抓完自动转 `maintenance`。

---

## 部署到 Vercel / Netlify

`xianbao/` 是纯静态产物，**无需构建**。两种平台都通过 Git 集成读取提交的 `xianbao/` 目录直接发布：

- **Vercel**：导入本仓库 → Framework 选 `Other` → Output Directory 填 `xianbao`（或直接使用仓库内 `vercel.json`）。
  如需访问分析，在 Vercel 后台开启 Analytics 后，本地重新运行
  `INJECT_VERCEL_ANALYTICS=1 bash mirror/mirror.sh` 并提交。
- **Netlify**：导入本仓库 → Build command 留空（或 `echo`）→ Publish directory 填 `xianbao`
  （或直接使用仓库内 `netlify.toml`）。

两个平台可同时接入同一仓库，互不影响（同一份 `xianbao/` 产物）。站内搜索页在 `/search.html`，
各页面右下角有「🔍 搜索」悬浮按钮。

---

## 定时备份与归档

- **每日增量**：`backup.yml` 北京时间约 02:00（叠加 0~45 分钟随机抖动）增量渲染并提交 `xianbao/` 到 `main`，
  Vercel/Netlify 自动拉取发布。
- **周级归档**：`weekly-backup.yml` 每周一创建 `backup-YYYY-Www` Release，保留最近 30 周。
- **月级归档**：`monthly-backup.yml` 每月1日创建 `backup-YYYY-MM` Release，保留最近 24 个月。
- **年级归档**：`yearly-backup.yml` 每年1日创建 `backup-YYYY` Release，保留最近 5 年。
- **归档体积自适应**：若 `xianbao/` 压缩后超过 ~450MB（GitHub Free Packages 免费额度附近），
  Release 自动改为**仅打包 `mirror/` 脚本与配置**，镜像内容本身完整留存于每日 git 提交历史，
  可由对应日期的提交随时恢复。
- **Keepalive**：`keepalive.yml` 每周提交时间戳，防止 60 天无活动导致定时任务被暂停。

---

## 首次建仓与推送

本仓库初始化为私有。建仓与首次推送请用本机已登录 `gh` 的环境执行（详见 `setup-repo.sh` / `setup-repo.bat`）：

```bash
# 在 xianbao-mirror/ 目录下
gh repo create xianbao-mirror --private --source=. --remote=origin --push
```

推送后到 GitHub 仓库的 **Settings → Actions → General** 确认 Actions 已启用；
首次建议到 Actions 页面手动跑一次 `backup.yml` 验证端到端链路（会装 Python+Chromium、抓 5 分类首批内容）。
