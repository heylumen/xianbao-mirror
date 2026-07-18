#!/usr/bin/env bash
#
# mirror/mirror.sh — 驱动 Playwright 渲染镜像，并做部署前必要修复
#
# 抓取本身由 mirror/render.py（Playwright 无头浏览器）完成：
#   - 执行 JavaScript，完整捕获动态注入的 DOM（含 AJAX 评论）
#   - 落盘全部同源资源（CSS/JS/图片/字体等）
#   - 把站内链接统一改写为部署前缀（默认 /，兼容 Vercel / Netlify 根域名；
#     GitHub Pages 项目页通过 PAGES_PREFIX=/<repo> 切换）
# 本脚本在其之后做三件事（部署前修复，幂等可重复执行）：
#   1) 注入自定义 404.html（覆盖平台默认错误页）
#   2) 处理 favicon（ICO/PNG 声明与兜底生成）
#   3) 注入响应式/间距覆盖 CSS（xianbao-override.css）
# 可选：INJECT_VERCEL_ANALYTICS=1 时注入 Vercel Analytics / Speed Insights 脚本。
#
# 前置：python3 + playwright + beautifulsoup4（见 mirror/requirements.txt）
#   pip install -r mirror/requirements.txt && playwright install chromium
# 可通过环境变量覆盖目标地址：TARGET_URL=https://example.com bash mirror/mirror.sh

set -euo pipefail

TARGET="${TARGET_URL:-https://new.xianbao.fun}"
OUT_DIR="xianbao"

if [ -x "$HOME/.workbuddy/binaries/python/envs/default/Scripts/python.exe" ]; then
  PY="$HOME/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
elif [ -x "$(dirname "$0")/../.venv/Scripts/python.exe" ]; then
  PY="$(dirname "$0")/../.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
else
  PY="python"
fi

REQ_FILE="$(dirname "$0")/requirements.txt"
"$PY" -c "import playwright, bs4" 2>/dev/null || "$PY" -m pip install -r "$REQ_FILE" >/dev/null 2>&1 \
  || "$PY" -m pip install --user -r "$REQ_FILE" >/dev/null 2>&1

echo "==> 开始渲染镜像目标站点: $TARGET -> $OUT_DIR"

# 增量镜像：保留已有 xianbao/ 产物并累加（不删除），由 render.py 的状态文件
# (.crawl-state.json) 驱动「每天抓一批、抓完转维护」的节奏。
mkdir -p "$OUT_DIR"

if ! "$PY" "$(dirname "$0")/render.py"; then
  echo "::error::render.py 执行失败，中止镜像" >&2
  exit 1
fi
echo "==> 渲染脚本执行完毕"

# ---------------------------------------------------------------------------
# 修复 1：注入自定义 404 页面
# ---------------------------------------------------------------------------
SRC404="$(dirname "$0")/404.html"
if [ -f "$SRC404" ]; then
  cp "$SRC404" "$OUT_DIR/404.html"
  echo "==> 自定义 404.html 已注入 -> $OUT_DIR/404.html"
fi

# ---------------------------------------------------------------------------
# 修复 2：处理 favicon
# ---------------------------------------------------------------------------
echo "==> 处理 favicon"
if [ ! -f "$OUT_DIR/favicon.ico" ]; then
  if [ -f "$OUT_DIR/favicon.png" ]; then
    OUT_DIR="$OUT_DIR" "$PY" - <<'PY'
import os, struct
out_dir = os.environ["OUT_DIR"]
src = os.path.join(out_dir, "favicon.png")
png = open(src, "rb").read()
if png[:8] != b"\x89PNG\r\n\x1a\n":
    raise SystemExit("源文件不是 PNG")
w, h = struct.unpack(">II", png[16:24])
bw = 0 if w >= 256 else w
bh = 0 if h >= 256 else h
ico = struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", bw, bh, 0, 0, 1, 32, len(png), 22) + png
open(os.path.join(out_dir, "favicon.ico"), "wb").write(ico)
print("favicon.ico 已生成（PNG 封装，无需 PIL）")
PY
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 30 "$TARGET/favicon.ico" -o "$OUT_DIR/favicon.ico" 2>/dev/null \
      && echo "favicon.ico 已从源站下载" || true
  fi
fi

PREFIX="${PAGES_PREFIX:-/}"
ICOLINK=""
[ -f "$OUT_DIR/favicon.ico" ] && ICOLINK="<link rel=\"icon\" href=\"${PREFIX%/}/favicon.ico\">"
PNGLINK=""
[ -f "$OUT_DIR/favicon.png" ] && PNGLINK="<link rel=\"icon\" href=\"${PREFIX%/}/favicon.png\" type=\"image/png\">"
if [ -n "$ICOLINK$PNGLINK" ]; then
  find "$OUT_DIR" -type f \( -iname '*.html' -o -iname '*.htm' \) | while read -r f; do
    grep -qi 'rel="icon"' "$f" || sed -i "s#<head>#<head>\n$ICOLINK\n$PNGLINK#I" "$f"
  done
  echo "favicon 声明已注入"
fi

# ---------------------------------------------------------------------------
# 修复 3：注入响应式/间距覆盖 CSS
# ---------------------------------------------------------------------------
echo "==> 注入响应式/间距覆盖 CSS"
SRC_CSS="$(dirname "$0")/xianbao-override.css"
if [ -f "$SRC_CSS" ]; then
  mkdir -p "$OUT_DIR/lib"
  cp "$SRC_CSS" "$OUT_DIR/lib/xianbao-override.css"
  echo "覆盖 CSS 已复制 -> $OUT_DIR/lib/xianbao-override.css"
fi
PREFIX="${PAGES_PREFIX:-/}"
CSSLINK="<link rel=\"stylesheet\" href=\"${PREFIX%/}/lib/xianbao-override.css\">"
OUT_DIR="$OUT_DIR" CSSLINK="$CSSLINK" "$PY" - <<'PY'
import os, pathlib, re
out_dir = os.environ["OUT_DIR"]
css_link = os.environ["CSSLINK"]
marker = "xianbao-override.css"
count = 0
for p in pathlib.Path(out_dir).rglob("*"):
    if p.suffix.lower() not in (".html", ".htm"):
        continue
    try:
        html = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if marker in html:
        continue
    m = re.search(r"</head>", html, re.IGNORECASE)
    if m is None and "</body>" in html.lower():
        m = re.search(r"</body>", html, re.IGNORECASE)
    if m is not None:
        html = html[:m.start()] + css_link + "\n" + html[m.start():]
        p.write_text(html, encoding="utf-8")
        count += 1
print(f"覆盖 CSS 链接已注入 {count} 个页面")
PY

# ---------------------------------------------------------------------------
# 修复 4：注入「站内搜索」悬浮按钮（search.html 由 render.py 生成）
# ---------------------------------------------------------------------------
echo "==> 注入站内搜索悬浮按钮"
OUT_DIR="$OUT_DIR" PREFIX="${PAGES_PREFIX:-/}" "$PY" - <<'PY'
import os, pathlib, re
out_dir = os.environ["OUT_DIR"]
prefix = os.environ.get("PREFIX", "/").rstrip("/")
style = (
  '<style>.xianbao-search-fab{position:fixed;right:18px;bottom:18px;z-index:9999;'
  'width:48px;height:48px;border-radius:50%;background:#1f4fd6;color:#fff;'
  'display:flex;align-items:center;justify-content:center;font-size:22px;'
  'text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.25)}'
  '.xianbao-search-fab:hover{background:#1640b0}</style>'
)
fab = '<a class="xianbao-search-fab" href="%s/search.html" title="站内搜索">🔍</a>' % prefix
marker = "xianbao-search-fab"
count = 0
for p in pathlib.Path(out_dir).rglob("*"):
    if p.suffix.lower() not in (".html", ".htm") or p.name == "search.html":
        continue
    try:
        html = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if marker in html:
        continue
    m = re.search(r"</body>", html, re.I) or re.search(r"</html>", html, re.I)
    if m is None:
        continue
    html = html[:m.start()] + style + fab + "\n" + html[m.start():]
    p.write_text(html, encoding="utf-8")
    count += 1
print(f"搜索悬浮按钮已注入 {count} 个页面")
PY

# ---------------------------------------------------------------------------
# 可选：注入 Vercel Analytics / Speed Insights（默认关闭，避免 Netlify 部署 404 噪音）
# 在 Vercel 后台开启分析后，设 INJECT_VERCEL_ANALYTICS=1 再运行本脚本。
# ---------------------------------------------------------------------------
if [ "${INJECT_VERCEL_ANALYTICS:-0}" = "1" ]; then
  echo "==> 注入 Vercel Analytics / Speed Insights"
  OUT_DIR="$OUT_DIR" "$PY" - <<'PY'
import os, pathlib, re
out_dir = os.environ["OUT_DIR"]
SNIPPET = (
    "<!-- Vercel Analytics + Speed Insights (injected by mirror.sh) -->\n"
    '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script>\n'
    '<script defer src="/_vercel/insights/script.js"></script>\n'
    '<script>window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)}</script>\n'
    '<script defer src="/_vercel/speed-insights/script.js"></script>\n'
)
marker = "_vercel/insights/script.js"
count = 0
for p in pathlib.Path(out_dir).rglob("*"):
    if p.suffix.lower() not in (".html", ".htm") or p.name == "404.html":
        continue
    try:
        html = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if marker in html:
        continue
    m = re.search(r"</head>", html, re.IGNORECASE) or re.search(r"</body>", html, re.IGNORECASE)
    if m is not None:
        html = html[:m.start()] + SNIPPET + html[m.start():]
        p.write_text(html, encoding="utf-8")
        count += 1
print(f"Vercel 分析脚本已注入 {count} 个页面")
PY
fi

echo "==> 镜像完成，输出目录: $OUT_DIR"
