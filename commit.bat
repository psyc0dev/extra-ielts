@echo off
setlocal EnableDelayedExpansion

if exist ai\extra-ai-evaluator\.git powershell -Command "Rename-Item -Path 'ai\extra-ai-evaluator\.git' -NewName '.git.bak' -Force -ErrorAction SilentlyContinue"
if exist ai\extra-ai-generator\.git powershell -Command "Rename-Item -Path 'ai\extra-ai-generator\.git' -NewName '.git.bak' -Force -ErrorAction SilentlyContinue"

git add .
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

timeout /t 1 /nobreak >nul
if exist ai\extra-ai-evaluator\.git.bak powershell -Command "Rename-Item -Path 'ai\extra-ai-evaluator\.git.bak' -NewName '.git' -Force -ErrorAction SilentlyContinue"
if exist ai\extra-ai-generator\.git.bak powershell -Command "Rename-Item -Path 'ai\extra-ai-generator\.git.bak' -NewName '.git' -Force -ErrorAction SilentlyContinue"
