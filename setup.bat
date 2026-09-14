@echo off
setlocal enabledelayedexpansion
title Nexus: The Archive - Automated Setup

echo ======================================================================
echo                NEXUS: THE ARCHIVE - SETUP WIZARD
echo       100%% Local, In-Browser AI Research Assistant (WebLLM + WebGPU)
echo ======================================================================
echo.

:: 1. Check for Node.js
echo [1/4] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please download and install Node.js (v18.17 or higher recommended):
    echo https://nodejs.org/
    echo.
    echo After installing, restart this setup script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo       Detected Node.js version: !NODE_VERSION!

:: 2. Check for npm
echo.
echo [2/4] Checking npm package manager...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] npm was not found in your system PATH.
    echo Please verify your Node.js installation.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo       Detected npm version: !NPM_VERSION!

:: 3. Install project dependencies
echo.
echo [3/4] Installing project dependencies...
echo       This may take a couple minutes depending on your internet connection.
echo       (Installing Next.js, React, WebLLM, Transformers.js, Lucide, Tailwind, etc.)
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Please check your network connection or try running 'npm install' manually.
    echo.
    pause
    exit /b 1
)
echo.
echo       Dependencies installed successfully!

:: 4. Build Next.js application
echo.
echo [4/4] Building optimized production bundle...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Production build encountered an issue.
    echo You can still try running in development mode via 'npm run dev'.
    echo.
) else (
    echo.
    echo       Production build completed successfully!
)

echo.
echo ======================================================================
echo                      SETUP COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo NOTE:
echo - No Ollama or Python daemon is required!
echo - The application runs 100%% locally inside your browser using WebGPU.
echo - On first launch, the browser will download the Llama-3.2-1B model
echo   weights (~880MB) and store them permanently in browser IndexedDB cache.
echo - Subsequent launches will load instantly offline from your local disk.
echo.
echo How would you like to start the application now?
echo.
echo   [1] Start in Production Mode (Fastest, recommended: http://localhost:3000)
echo   [2] Start in Development Mode (Live reload: http://localhost:3000)
echo   [3] Exit (You can start later using 'start.bat' or 'npm start')
echo.
set /p CHOICE="Enter choice [1, 2, or 3] (default is 1): "

if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    echo.
    echo Starting production server on http://localhost:3000...
    start "" http://localhost:3000
    call npm start
) else if "%CHOICE%"=="2" (
    echo.
    echo Starting development server on http://localhost:3000...
    start "" http://localhost:3000
    call npm run dev
) else (
    echo.
    echo Setup complete! To start the app anytime, run 'start.bat' or 'npm start'.
    echo.
    pause
)
