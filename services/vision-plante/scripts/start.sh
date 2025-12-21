#!/bin/bash

echo "========================================"
echo "  VisionPlante - Crop Stress Detection"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

echo "[1/3] Checking dependencies..."
if ! python3 -c "import fastapi" &> /dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
else
    echo "Dependencies already installed"
fi

echo ""
echo "[2/3] Checking model file..."
if [ ! -f "model/best.pt" ]; then
    echo "ERROR: Model file not found at model/best.pt"
    exit 1
fi
echo "Model file found"

echo ""
echo "[3/3] Starting VisionPlante service..."
echo ""
echo "Service will be available at:"
echo "  - API: http://localhost:8003"
echo "  - Docs: http://localhost:8003/docs"
echo "  - Test UI: Open test_frontend.html in browser"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

python3 main.py
