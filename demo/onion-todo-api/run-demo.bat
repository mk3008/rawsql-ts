@echo off
REM Onion Todo API Demo Startup Script for Windows

echo 🚀 Starting Onion Todo API Demo...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

echo 📦 Starting PostgreSQL database...
docker-compose up -d

echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

echo 🔧 Setting up database...
npm run db:setup

echo 🎯 Running demo...
npm run demo

echo.
echo ✨ Demo completed! You can now:
echo   - Run the API server: npm run dev
echo   - Test the API: curl http://localhost:3000/todos/search
echo   - View docs: curl http://localhost:3000/docs
echo.
echo 🛑 To stop the database: docker-compose down

pause
