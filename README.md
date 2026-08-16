# xianbao.fun 镜像站（线报酷归档）

把 [new.xianbao.fun](https://new.xianbao.fun) 做成一个**静态镜像**：GitHub Actions 定时采集并提交到公开仓库，并提供 **Release 时间点归档**与**站内搜索**。

## 特性

- **5 分类白名单**：仅镜像 `zuankeba` / `xinzuanba` / `xiaodigu` / `huluxia` / `xiaodao`，其余页面改写成本地相对链接，不跳源站。
- **状态化增量爬取**：进度存于 `xianbao/.crawl-state.json`，先 `crawl` 抓完 5 分类再转 `maintenance` 只查更新，不重复全量存储。
- **域名轮换 + 轻量限速**：从 6 个内容一致的源域名随机选源；每日 3 轮（北京时间 **01:00 / 09:00 / 17:00**，整点后 0~5min 随机）。
- **站内搜索**：渲染生成 `search.json` + `search.html`，每页右下角「🔍 搜索」悬浮按钮。
- **外站图片本地化**：下载到站内，源站删帖后仍可查看；失效地址记录后自动跳过。
- **评论已包含**：等待 AJAX 评论注入后抓取，`maintenance` 模式可检测新评论。

## 文件结构

```
xianbao-mirror/
├── mirror/
│   ├── render.py            # 渲染核心（增量爬虫/白名单/域名轮换/评论等待/链接改写/搜索索引）
│   ├── mirror.sh            # 部署前修复（404/favicon/CSS/搜索按钮）
│   ├── requirements.txt     # 依赖版本锁定
│   ├── xianbao-override.css # 响应式兜底样式
│   ├── 404.html
│   └── test_render.py       # 核心纯函数单元测试
├── .github/workflows/
│   ├── backup.yml           # 每日 3 轮增量渲染，提交 xianbao/
│   ├── weekly-backup.yml    # 每周一整站打包归档 Release（永久保留）
│   ├── monthly-backup.yml   # 每月1日整站打包归档 Release（永久保留）
│   ├── yearly-backup.yml    # 每年1日整站打包归档 Release（永久保留）
│   └── keepalive.yml        # 每周提交时间戳，防止定时任务被暂停
├── xianbao/                 # 渲染产物（Actions 生成并提交，勿手动编辑）
└── README.md
```

## 本地运行

```bash
pip install -r mirror/requirements.txt
playwright install --with-deps chromium   # 仅首次
bash mirror/mirror.sh                     # 增量渲染到 xianbao/
python -m pytest mirror/ -q               # 单元测试
```

## 定时备份与归档

- **每日增量**：`backup.yml` 每天 3 轮渲染并提交 `xianbao/` 到 `main`。
- **Release 归档（永久保留）**：周 / 月 / 年三级 workflow 将**整站（`xianbao/` 含镜像）打包为 tar.gz** 上传 Release。
  - 单文件上限 < 2 GiB；压缩后超过 **1.5 GiB** 自动 `split` 分多卷，作为同一 Release 的多个 asset 上传。
  - 还原：`cat <tag>.tar.gz.part* > combined.tar.gz && tar -xzf combined.tar.gz`。
- 镜像完整内容本身也留存于每日 git 提交历史，可随时按日期恢复。

## 可调参数

写在 `mirror/render.py` 顶部常量或各 workflow 的 `env:`（CI 已覆盖部分值）：

| 变量 | 默认 | CI 覆盖 | 说明 |
|------|------|--------|------|
| `PAGES_PER_RUN_PER_CAT` | `6` | `8` | crawl 模式每轮每分类抓取的列表页数 |
| `MAX_PAGES_PER_RUN` | `200` | `600` | 单轮渲染页面总数硬上限（受 6h 超时约束） |
| `CHECKPOINT_EVERY` | `0` | `120` | 每渲染多少页做一次检查点提交（防进度丢失） |
| `TARGET_URL` | 随机轮换 | — | 指定单一抓取源（关闭轮换） |
| `OUT_DIR` | `xianbao` | — | 输出目录 |
| `PAGES_PREFIX` | `/` | — | 部署路径前缀（GitHub Pages 项目页改 `/<repo>`） |

> 完整参数见 `mirror/render.py` 顶部与 `backup.yml` 注释。

## 说明

- 本工具用于**个人归档**，镜像内容版权归原站所有，请勿冒充原站或二次分发牟利。
- "不被发现"是尽力而为：已做限速、常规 UA、域名轮换、增量小批量 + 随机时间；但公开部署后地址可被发现，没有真正隐形。
