# 线报酷镜像修复概览

## 完成内容
1. **首页改版**：`mirror/render.py` 的 `build_hub` 从「分类列表」改为「顶部标签 + 下方帖子列表」，支持全部 / 5 分类切换，每类最新 200 篇。
2. **修复站内搜索**：`build_search_index` 为每条文档添加 `id` 字段，解决 MiniSearch 报错 `document does not have ID field "id"`。
3. **手动触发立即执行**：`.github/workflows/backup.yml` 的随机延迟改为 `if: github.event_name == 'schedule'`，workflow_dispatch 手动触发时不再等待。
4. **接入 Vercel Analytics**：`backup.yml` 环境变量增加 `INJECT_VERCEL_ANALYTICS: "1"`，`mirror.sh` 自动注入 `/_vercel/insights/script.js` 与 Speed Insights 脚本。

## 验证
- 本地 `pytest mirror/test_render.py`：38 测试通过。
- 本地临时生成 `xianbao/index.html` 与 `search.json`：标签切换、帖子列表、搜索 `id` 字段均正确。
- 已推送 commit `522705f` 到 GitHub (`xfxx2022/xianbao-mirror`)。

## 后续操作
- 到 GitHub Actions 页面手动运行一次「网站镜像 · 每日渲染」，产物自动更新后 Vercel/Netlify 会同步发布。
- 如使用 Vercel，需在项目后台开启 **Web Analytics** 与 **Speed Insights** 开关，脚本才会真正收集数据。
- 若同时部署到 Netlify，Vercel Analytics 脚本在 Netlify 侧会 404，属正常现象（仅对 Vercel 有效）。
