@echo off
setlocal EnableDelayedExpansion

if exist ai\extra-ai-evaluator\.git move ai\extra-ai-evaluator\.git ai\extra-ai-evaluator\.git.bak >nul
if exist ai\extra-ai-generator\.git move ai\extra-ai-generator\.git ai\extra-ai-generator\.git.bak >nul

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

if exist ai\extra-ai-evaluator\.git.bak move ai\extra-ai-evaluator\.git.bak ai\extra-ai-evaluator\.git >nul
if exist ai\extra-ai-generator\.git.bak move ai\extra-ai-generator\.git.bak ai\extra-ai-generator\.git >nul