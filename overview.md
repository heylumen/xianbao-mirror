# 本轮修复概览

## 完成内容
1. **修复已部署页面仍跳转源站**：
   - `mirror/render.py`：`fix_url` 现在会处理协议相对链接 `//new.xianbao.fun/...`（属于源站则改本地路径，外部 CDN 保留）。
   - `mirror/render.py`：`rewrite_html` 增加 `action` 属性处理，并补充 `window.open`、`location =`、`location.replace/assign` 的 JS 链接改写。
   - `mirror/mirror.sh`：新增“修复 5”步骤，对所有历史 HTML 文件重新执行 `render.rewrite_html`，把旧产物里残留的源站绝对链接（如 `https://new.ixbk.net/haodan/xxx.html`）改写为本地路径。
2. **修复分类标签**：`build_hub` 与 `README.md` 中 `小道` → `小刀`，`README.md` 中的 `小弟谷` → `小嘀咕`（与代码一致），并更新非白名单链接描述。
3. **修复赚客吧/新赚客吧 0 篇**：
   - 根因：`discover_article_links` 与 `fill_missing` 中 `ORIGIN + href` 拼接在 `ORIGIN` 缺少 scheme 时会生成错误 URL，导致部分分类文章未被识别。
   - 修复：`TARGET` 加载后若缺少 scheme 自动补 `https://`；`discover_article_links` / `fill_missing` 改用 `urljoin`。
   - 已重置 `xianbao/.crawl-state.json` 中 `zuankeba` / `xinzuanba` 的 `category_cursor=1`、`category_miss=0`、`category_exhausted=false`，下次 Actions 会从第 1 页重新爬取这两个分类（已爬文章会幂等去重，不重复保存）。
4. **全量链接改写审计**：覆盖 `href/src/data-src/poster/data-href/data-url/srcset/action`、协议相对链接、JS 内 `location.href`/`window.open`/`location.replace/assign`、title 中的源站域名。

## 涉及文件
- `mirror/render.py`：
  - `TARGET` scheme 自动补全；`fix_url` 处理协议相对链接；`rewrite_html` 增加 action 与 JS 链接改写；title 替换所有源站域名；`discover_article_links`/`fill_missing` 改用 `urljoin`；`build_hub` 标签修正。
- `mirror/mirror.sh`：新增“修复 5：重写所有 HTML 中的源站绝对链接为本地路径”。
- `mirror/test_render.py`：新增 4 个测试（协议相对源站链接改写、协议相对源站非白名单、JS 内 window.open、TARGET 缺 scheme 自动补全）。
- `README.md`：分类标签修正、非白名单链接描述更新。
- `xianbao/.crawl-state.json`：重置 `zuankeba` / `xinzuanba` 游标。
- `xianbao/*.html`：本地对所有历史 HTML 重新执行 `render.rewrite_html` 改写源站链接；首页 `index.html` 中的标签由 `小道` 手动修正为 `小刀`，并保留已有的 favicon 与 Vercel Analytics 注入内容。

## 验证
- `pytest mirror/test_render.py -q`：**43 passed**
- 本地检查 `xianbao/index.html`：`小刀` 标签正确；`xiaodao` 文章页源站绝对链接从 71 条降到 8 条（剩余均为京东/阿里/x6d 等外部链接，应保留）。

## 说明与风险
- **兼容性风险**：`xianbao/.crawl-state.json` 被手动重置。下次 Actions 会从 `zuankeba`/`xinzuanba` 第 1 页开始重新爬取，但由于 `state["crawled"]` 去重，不会重复保存已存在文章，仅重新渲染分类列表页并发现之前漏掉的文章页。
- **0 篇分类**：提交后，站点会立即显示 `小刀` 标签和修复后的链接；但 `赚客吧`/`新赚客吧` 的帖子数量需要下一次 Actions 运行（或手动触发）后才会从 0 变成正常。一次运行即可从各分类第 1 页发现足够填充首页 25 条的帖子。
