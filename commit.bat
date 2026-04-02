@echo off
setlocal EnableDelayedExpansion

if exist ai\extra-ai-evaluator\.git rename ai\extra-ai-evaluator\.git .git.bak >nul
if exist ai\extra-ai-generator\.git rename ai\extra-ai-generator\.git .git.bak >nul

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

if exist ai\extra-ai-evaluator\.git.bak rename ai\extra-ai-evaluator\.git.bak .git >nul
if exist ai\extra-ai-generator\.git.bak rename ai\extra-ai-generator\.git.bak .git >nul