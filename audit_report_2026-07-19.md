# xianbao-mirror 全量核查报告

生成时间：2026-07-19 17:38
仓库版本：`311d35b1`（main）

## 核查范围

扫描 `xianbao/` 下所有符合 `category/NNNNNNN.html` 的文章页，共 1242 个文件。

## 核查结果

| 检查项 | 异常文件数 | 状态 |
|---|---|---|
| 存在多个“顺序”按钮（`.pinglunshunxu` > 1） | 0 | 正常 |
| 存在多个“只看楼主”按钮（`.showlouzhu` > 1） | 0 | 正常 |
| 用户名链接显示异常（文本包含 `.html` / `>` / `&quot;` 等） | 0 | 正常 |
| 缺失文章页导航（`xianbao-article-nav`） | 0 | 正常 |
| 残留旧版“返回列表” | 0 | 正常 |

## 用户截图涉及文件

- `zuankeba/6511523.html`（`infosky`）
- `huluxia/6656768.html`（`是我的记忆`）

这两个文件在本地仓库中检查均为：
- 1 个“顺序”按钮、1 个“只看楼主”按钮
- 用户名 `<a href="/record/.../xxx.html">xxx</a>` 正常显示
- 顶部导航已注入

## 本地浏览器验证

用 Chrome 无头模式对 `zuankeba/6511523.html` 截图，显示正常：
- 导航完整
- 评论列表只有 1 个“顺序”按钮
- 用户名 `infosky` 正常显示

## 结论

当前 GitHub 仓库 `xfxx2022/xianbao-mirror` 的 `main` 分支与本地仓库一致，均为 `311d35b1`，且全量核查 0 异常。

用户仍看到旧版问题（两个“顺序”按钮、用户名被转义），最可能原因：
1. 线上平台（Vercel / Cloudflare）缓存了旧版 HTML。
2. 用户访问的域名或路径并非由最新 main 分支部署。
3. 浏览器或中间代理缓存未彻底刷新。

## 建议

1. 在浏览器里打开线上问题页面，按 `Ctrl+Shift+R`（Windows）或 `Ctrl+F5` 强制刷新。
2. 查看页面源码，搜索 `xianbao-article-nav` 和 `xianbao-comment-tools`：
   - 若存在 → 是最新版，刷新缓存即可。
   - 若不存在 → 线上部署未更新到最新 main，需检查 Vercel / Cloudflare 部署日志。
3. 如使用 Cloudflare，进入控制台 “Caching” → “Purge Everything” 清除缓存。
4. 如使用 Vercel，可在项目设置中重新部署或触发新部署。

