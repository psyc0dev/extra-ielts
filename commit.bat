@echo off
setlocal EnableDelayedExpansion

git add .

REM Check for changes in backend directory
git diff --cached --name-only | findstr "server/" > nul
if %errorlevel% equ 0 (
    echo Backend changes detected. Deploying to Cloudflare...
    cd backend
    call npx wrangler deploy
    cd ..
)

REM Generate commit message from staged files
set "files="
set /a count=0

for /f "tokens=*" %%F in ('git diff --cached --name-only') do (
    set /a count+=1
    if !count! leq 3 (
        if defined files (
            set "files=!files!, %%~nxF"
        ) else (
            set "files=%%~nxF"
        )
    )
)

if !count! gtr 3 (
    set "files=!files! and more..."
)

if not defined files (
    set "msg=update"
) else (
    set "msg=edited: !files!"
)

git commit -m "!msg!"
git push origin main