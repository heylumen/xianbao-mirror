@echo off
REM setup-repo.bat - create private GitHub repo and push (requires gh CLI logged in)
REM Usage: cd xianbao-mirror && setup-repo.bat
setlocal
set "REPO_NAME=%~1"
if "%REPO_NAME%"=="" set "REPO_NAME=xianbao-mirror"

where gh >nul 2>nul
if errorlevel 1 (
  echo [error] gh CLI not found. Install from https://cli.github.com/ then run: gh auth login
  exit /b 1
)

if not exist mirror\render.py (
  echo [error] Run this script inside the xianbao-mirror\ directory
  exit /b 1
)

echo ==^> git init
git init -b main >nul 2>&1 || git checkout -B main
git add -A
git commit -m "init: xianbao.fun mirror (Playwright + GitHub Actions + Vercel/Netlify)" >nul

echo ==^> create private repo and push: %REPO_NAME%
gh repo create %REPO_NAME% --private --source=. --remote=origin --push

echo ==^> done. Enable Actions in repo Settings, then run backup.yml once manually.
endlocal
