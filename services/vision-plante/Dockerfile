FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgthread-2.0-0 \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Upgrade pip first (as suggested in error message)
RUN pip install --upgrade pip

# Install Python dependencies with increased timeout and retries
RUN pip install --no-cache-dir --default-timeout=100 --retries 5 -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY main.py .
COPY .env.docker .env
COPY model/ ./model/

# Create directories
RUN mkdir -p uploads results

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8003/api/v1/health')" || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
