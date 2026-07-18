#!/usr/bin/env bash
# setup-repo.sh — 在本机（已登录 gh）创建私有仓库并推送初始代码
# 用法：cd xianbao-mirror && bash setup-repo.sh
set -euo pipefail

REPO_NAME="${1:-xianbao-mirror}"

if ! command -v gh >/dev/null 2>&1; then
  echo "::error:: 未检测到 gh CLI。请先安装并登录：https://cli.github.com/ 然后执行 gh auth login" >&2
  exit 1
fi

if [ ! -f mirror/render.py ]; then
  echo "::error:: 请在 xianbao-mirror/ 目录下运行本脚本" >&2
  exit 1
fi

echo "==> 初始化 git 仓库"
git init -b main >/dev/null 2>&1 || git checkout -B main
git add -A
git commit -m "init: xianbao.fun mirror (Playwright + GitHub Actions + Vercel/Netlify)" >/dev/null

echo "==> 创建私有仓库并推送: $REPO_NAME"
gh repo create "$REPO_NAME" --private --source=. --remote=origin --push

echo "==> 完成。请到 GitHub 仓库 Settings -> Actions 确认 Actions 已启用，"
echo "    并手动跑一次 backup.yml 验证。"
