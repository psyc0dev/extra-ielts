@echo off
start "API Server" cmd /k "bun dev:api"
start "Frontend" cmd /k "bun dev"
start "Tauri" cmd /k "bun tauri dev"