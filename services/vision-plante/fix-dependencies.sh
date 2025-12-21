#!/bin/bash
# Fix numpy/opencv-python compatibility issue (Linux/Mac)

echo ""
echo "Fixing numpy/opencv-python compatibility..."
echo ""

cd "$(dirname "$0")"

echo "Step 1: Uninstalling conflicting packages..."
pip uninstall -y opencv-python opencv-contrib-python numpy

echo ""
echo "Step 2: Installing compatible versions..."
pip install "numpy>=1.24.0,<2.0.0"
pip install opencv-python>=4.8.0

echo ""
echo "Step 3: Verifying installation..."
python -c "import numpy; import cv2; print('numpy version:', numpy.__version__); print('opencv version:', cv2.__version__); print('SUCCESS!')"

echo ""
echo "Done! Try running the service again."
echo ""

