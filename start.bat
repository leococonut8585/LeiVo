@echo off
echo ================================
echo LeiVo - Voice Transformation App
echo ================================
echo.

echo [1/3] Starting Backend (Port 8002)...
cd backend
start "LeiVo Backend" cmd /k "python api.py"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend (Port 5175)...
cd ..\frontend
start "LeiVo Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo [3/3] Done!
echo.
echo Backend:  http://localhost:8002
echo Frontend: http://localhost:5175
echo.
echo Press any key to exit...
pause >nul
