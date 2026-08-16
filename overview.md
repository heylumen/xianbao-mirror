# 修复概览：Fancybox 灯箱关闭后评论区左晃

## 问题
帖子评论里的图片已能点击放大，但关闭灯箱后，评论内容会"往左边晃一下"。

## 根因
Fancybox v5 打开灯箱时：
1. 给 `<html>` 添加 `with-fancybox` 类，把主题原本的 `html{overflow-y:scroll}`（常驻垂直滚动条）改为 `overflow:visible`，导致滚动条消失。
2. 给 `<body>` 添加 `hide-scrollbar` 类，并设置 `margin-right` 补偿滚动条宽度。

在真实 Windows 浏览器中（经典滚动条约 15px），这两个动作叠加使文档可用宽度变化，评论区等容器在灯箱打开/关闭瞬间发生水平位移。

## 修复内容
修改覆盖 CSS（同时更新 `mirror/xianbao-override.css` 与 `xianbao/lib/xianbao-override.css`）：

```css
html.with-fancybox { overflow-y: scroll !important; overflow-x: hidden !important; }
html.with-fancybox body.hide-scrollbar { margin-right: 0 !important; }
```

- 保持灯箱打开时 `html` 的滚动条常驻，不因为 `overflow:visible` 而移除。
- 取消 Fancybox 对 `body` 的 `margin-right` 补偿，避免宽度重复变化。
- `body` 的 `overflow:hidden`（来自 `.hide-scrollbar`）保留，仍禁止背景滚动。

## 验证
- 在本地用 Playwright 模拟真实浏览器（强制 `with-fancybox` + `hide-scrollbar` + `scrollbar-compensate=15px`）：修复前 `#comment .comment-list` 左移约 7px，修复后 **Δ0**。
- 真实点击 → 打开灯箱（评论图分组 5 张）→ Esc 关闭，无异常。
- `pytest` **85 passed**，无回归。

## 其它发现（未修复，仅记录）
- 控制台仍有 `meta.php` 相关 404 和 `initGM is not defined` 页面错误。原因是 `common.js` 已剥离，但 `<script src=".../meta.php">` 仍调用其中函数。不影响可见功能，为保持最小化改动，本次未处理。

## 提交
- Commit: `69a453b6` — `fix: 阻止 Fancybox 灯箱开合时评论区左右晃动`
- 已推送 `xfxx2022/xianbao-mirror` main，访客请 Ctrl+F5 硬刷新验证。
