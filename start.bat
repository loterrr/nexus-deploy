@echo off
title Nexus: The Archive - In-Browser Local RAG
echo ======================================================================
echo                  LAUNCHING NEXUS: THE ARCHIVE
echo         100%% Local AI Research Assistant (WebLLM + WebGPU)
echo ======================================================================
echo.
echo Opening browser at http://localhost:3000 ...
start "" http://localhost:3000
echo.
echo Starting server... (Press Ctrl+C to stop)
npm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo Production build not found or failed. Starting dev server instead...
    npm run dev
)
pause
