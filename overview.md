# 本轮修复概览

## 2026-07-19 文章页注入顶部导航、移除返回列表、修复重复“顺序”按钮

1. **移除文章页「← 返回列表」**：
   - `mirror/render.py`：不再注入 `back-to-list` 链接。

2. **文章页注入源站风格顶部导航**（`xianbao-article-nav`）：
   - 与首页/分类页保持一致：首页、赚客吧、新赚吧、小嘀咕、葫芦侠、小刀 + 搜索 + 浅色模式。
   - 搜索按钮内联 onclick 展开/收起 `#search-area` 表单（源站 JS 已剥离，这里自包含实现）。
   - 暗色切换使用已注入的 `switchNightMode()`，同步切换 `document.documentElement`/`body` 的 `night` 类。
   - 图标字体走 CDN，离线时可能不显示，故额外提供「浅色/搜索」文字兜底，确保始终可用。

3. **修复重复“顺序/只看楼主”按钮**（全量根因）：
   - 源站 `#comment .comment-list`（评论列表）原本带控件；另一独立的“交流列表”块有真实评论但原本无控件。
   - 上一版 `strip_chrome` 的 `for cl in soup.find_all(class_="comment-list")` 给两个列表都加了控件，导致页面出现两组“顺序”。
   - 修复：仅主评论列表（`#comment .comment-list`）保留/补回控件，非主列表清理误加控件，评论内容仍保留。

4. **修复样式重复追加**（幂等性）：
   - 新增 `_ensure_cursor_pointer` / `_ensure_display_block`，清除旧值后再统一写入，避免多次运行后 `cursor:pointer` 和 `display:block` 重复累加。

### 涉及文件
- `mirror/render.py`：新增 `_build_article_nav`、`_ensure_cursor_pointer`、`_ensure_display_block`；改写 `strip_chrome` 的导航注入与评论控件逻辑。
- `mirror/test_backup_features.py`：更新断言，验证“返回列表”已移除、导航已注入、控件唯一。
- `mirror/test_render.py`：更新断言，验证源站 header 被清理但新导航已注入。
- `xianbao/*/*.html`：全站 1242 个文章页重新处理。

### 验证
- `pytest mirror/test_render.py mirror/test_backup_features.py -q`：**85 passed**
- 全量扫描 1242 个文章页：
  - 0 个文件含多个 `pinglunshunxu` 按钮
  - 0 个文件含多个 `showlouzhu` 按钮
  - 0 个文件仍含“返回列表”
  - 0 个文件缺失 `xianbao-article-nav` 导航
  - 0 个文件 `cursor:pointer` 重复
- 浏览器截图验证：`xianbao/zuankeba/6511148.html` 顶部显示完整导航、无返回列表、评论列表仅一组控件、交流列表评论保留且无控件。

### 提交
- Commit: `1c7c12ba` 已 push 至 `xfxx2022/xianbao-mirror` main（`21500838..1c7c12ba`）。

---

## 2026-07-19 修复评论用户名显示与恢复顺序/只看楼主功能

1. **保留并修复“顺序/只看楼主”控件**：
   - `mirror/render.py`：`strip_chrome` 不再删除 `.pinglunshunxu` / `.showlouzhu`，改为改写 `onclick` 指向自包含函数 `xianbaoPinglunshunxu()` / `xianbaoShowlouzhu()`。
   - 在 `<body>` 末尾注入 `id="xianbao-comment-tools"` 脚本：顺序按钮反转 `.comment-list` 下的 `.ul`；只看楼主按钮从 `.head-info .author a` 读取文章作者，切换只显示楼主评论，并在“只看楼主”与“查看全部”间切换按钮文本。
   - 兼容旧版已处理文件：若 `.title` 中缺失控件，自动补回。
2. **修复用户名显示问题**：
   - 本地重处理验证：用户名链接 `<a href="/record/.../提笔墨香浅.html">提笔墨香浅</a>` 正常渲染为蓝色可点击文本，无 `.html">` 外露。
   - 全站 1242 个文章页 HTML 已重新处理，确保线上版本一致。
3. **修复 `strip_chrome` 幂等性**：
   - 修复 `display:block` 与 `cursor:pointer` 重复追加的问题，现在多次运行 `strip_chrome` 结果稳定。

### 涉及文件
- `mirror/render.py`：保留/补回评论控件，注入自包含 JS，修复样式重复追加。
- `mirror/test_backup_features.py`：更新断言，验证控件保留、onclick 改写、脚本注入。
- `xianbao/*/*.html`：全站 1242 个文章页重新处理。

### 验证
- `pytest mirror/test_render.py mirror/test_backup_features.py -q`：**85 passed**
- Playwright 验证：点击“只看楼主”后 32 条评论中 23 条隐藏、9 条楼主评论可见；点击“顺序”正常反转。
- 浏览器截图验证：`xianbao/zuankeba/6511148.html` 评论列表标题旁显示“↹ 顺序 只看楼主”，用户名显示正常。

### 提交
- Commit: `c90c0ee4` 已 push 至 `xfxx2022/xianbao-mirror` main（`957c931..c90c0ee4`）。

---

## 更早的修复

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
