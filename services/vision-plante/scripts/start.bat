@echo off
echo ========================================
echo   VisionPlante - Crop Stress Detection
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11 or higher
    pause
    exit /b 1
)

echo [1/3] Checking dependencies...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    echo Dependencies already installed
)

echo.
echo [2/3] Checking model file...
if not exist "model\best.pt" (
    echo ERROR: Model file not found at model\best.pt
    pause
    exit /b 1
)
echo Model file found

echo.
echo [3/3] Starting VisionPlante service...
echo.
echo Service will be available at:
echo   - API: http://localhost:8003
echo   - Docs: http://localhost:8003/docs
echo   - Test UI: Open test_frontend.html in browser
echo.
echo Press Ctrl+C to stop the service
echo.

python main.py
