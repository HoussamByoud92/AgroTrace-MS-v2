# 🐳 VisionPlante Docker Guide

## Overview

VisionPlante can run in **two modes**:
1. **Local Mode** - Run directly with Python (for development)
2. **Docker Mode** - Run in containers (for production/testing)

Both modes work simultaneously - you can switch between them anytime!

---

## 🚀 Quick Start with Docker

### Option 1: Using Scripts (Easiest)

**Windows:**
```bash
scripts\docker-start.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/docker-start.sh
./scripts/docker-start.sh
```

Then choose:
- **1** - Full setup (VisionPlante + Kafka)
- **2** - Standalone (VisionPlante only)

### Option 2: Direct Commands

**Standalone (No Kafka):**
```bash
docker-compose -f docker-compose.standalone.yml up -d
```

**Full Setup (With Kafka):**
```bash
docker-compose up -d
```

---

## 📋 Prerequisites

### Required:
- ✅ Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- ✅ Docker Compose installed (usually comes with Docker Desktop)
- ✅ Model file at `model/best.pt`

### Check Installation:
```bash
docker --version
docker-compose --version
```

---

## 🎯 Deployment Modes

### Mode 1: Standalone (VisionPlante Only)

**Best for:**
- Quick testing
- Development
- When you don't need Kafka

**Start:**
```bash
docker-compose -f docker-compose.standalone.yml up -d
```

**What runs:**
- ✅ VisionPlante API on port 8003
- ❌ No Kafka

**Access:**
- API: http://localhost:8003
- Docs: http://localhost:8003/docs

---

### Mode 2: Full Microservices (VisionPlante + Kafka)

**Best for:**
- Production deployment
- Full microservices architecture
- Event-driven workflows

**Start:**
```bash
docker-compose up -d
```

**What runs:**
- ✅ VisionPlante API on port 8003
- ✅ Kafka broker on port 9092

**Access:**
- API: http://localhost:8003
- Docs: http://localhost:8003/docs
- Kafka: localhost:9092

---

## 🔧 Docker Commands

### Start Services

```bash
# Standalone mode
docker-compose -f docker-compose.standalone.yml up -d

# Full mode (with Kafka)
docker-compose up -d

# With build (if you changed code)
docker-compose up -d --build
```

### Stop Services

```bash
# Stop standalone
docker-compose -f docker-compose.standalone.yml down

# Stop full setup
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# VisionPlante only
docker-compose logs -f visionplante

# Kafka only
docker-compose logs -f kafka

# Last 100 lines
docker-compose logs --tail=100 visionplante
```

### Check Status

```bash
# List running containers
docker-compose ps

# Check health
docker-compose ps
docker inspect visionplante | grep Health
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart VisionPlante only
docker-compose restart visionplante
```

### Rebuild Containers

```bash
# Rebuild without cache
docker-compose build --no-cache

# Rebuild and start
docker-compose up -d --build
```

---

## 📁 Volume Mounts

Docker containers mount these local directories:

| Local Path | Container Path | Purpose | Mode |
|------------|----------------|---------|------|
| `./model` | `/app/model` | YOLO model | Read-only |
| `./uploads` | `/app/uploads` | Uploaded images | Read-write |
| `./results` | `/app/results` | Detection results | Read-write |

**Benefits:**
- ✅ Model stays on your machine
- ✅ Results persist after container stops
- ✅ Easy to access files from host

---

## 🔍 Testing Docker Deployment

### 1. Check if Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME            STATUS          PORTS
visionplante    Up (healthy)    0.0.0.0:8003->8003/tcp
kafka           Up (healthy)    0.0.0.0:9092->9092/tcp
```

### 2. Test Health Endpoint

```bash
curl http://localhost:8003/api/v1/health
```

**Expected:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "kafka_connected": true
}
```

### 3. Test with Browser

Open: http://localhost:8003/docs

### 4. Test Detection

```bash
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@test_image.jpg" \
  -F "field_id=docker-test"
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:**
```bash
# Start Docker Desktop (Windows/Mac)
# Or start Docker service (Linux)
sudo systemctl start docker
```

### Issue: "Port 8003 already in use"

**Solution:**
```bash
# Stop local Python service first
# Or change port in docker-compose.yml
ports:
  - "8004:8003"
```

### Issue: "Model file not found"

**Solution:**
```bash
# Ensure model exists
ls model/best.pt

# Check volume mount
docker-compose exec visionplante ls -la /app/model/
```

### Issue: Container keeps restarting

**Check logs:**
```bash
docker-compose logs visionplante
```

**Common causes:**
- Missing model file
- Port conflict
- Memory issues

### Issue: "No space left on device"

**Clean up Docker:**
```bash
# Remove unused containers
docker system prune -a

# Remove unused volumes
docker volume prune
```

---

## 🔄 Switching Between Local and Docker

### Currently Running Local? Switch to Docker:

1. **Stop local service** (Ctrl+C in terminal)
2. **Start Docker:**
   ```bash
   docker-compose up -d
   ```
3. **Access same URL:** http://localhost:8003

### Currently Running Docker? Switch to Local:

1. **Stop Docker:**
   ```bash
   docker-compose down
   ```
2. **Start local:**
   ```bash
   python main.py
   ```
3. **Access same URL:** http://localhost:8003

**Both use the same:**
- ✅ Port 8003
- ✅ Model file
- ✅ Upload/results directories
- ✅ API endpoints

---

## ⚙️ Configuration

### Environment Variables

Edit `docker-compose.yml` to change settings:

```yaml
environment:
  - CONF_THRESHOLD=0.5      # Detection confidence
  - DEVICE=cuda             # Use GPU (if available)
  - IMG_SIZE=1280           # Larger images
  - LOG_LEVEL=DEBUG         # More logging
```

### Using GPU in Docker

**Requirements:**
- NVIDIA GPU
- NVIDIA Docker runtime

**Update docker-compose.yml:**
```yaml
services:
  visionplante:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - DEVICE=cuda
```

---

## 📊 Monitoring

### View Resource Usage

```bash
# Real-time stats
docker stats visionplante

# Container info
docker inspect visionplante
```

### Health Checks

Docker automatically checks health every 30 seconds:

```bash
# Check health status
docker inspect visionplante | grep -A 10 Health
```

---

## 🚀 Production Deployment

### Best Practices

1. **Use specific versions:**
   ```yaml
   image: visionplante:1.0.0
   ```

2. **Set resource limits:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 4G
   ```

3. **Use secrets for sensitive data:**
   ```yaml
   secrets:
     - kafka_password
   ```

4. **Enable logging:**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

### Deploy to Production

```bash
# Build production image
docker build -t visionplante:1.0.0 .

# Tag for registry
docker tag visionplante:1.0.0 your-registry/visionplante:1.0.0

# Push to registry
docker push your-registry/visionplante:1.0.0

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📝 Docker Files Overview

| File | Purpose |
|------|---------|
| `Dockerfile` | Container image definition |
| `docker-compose.yml` | Full setup (VisionPlante + Kafka) |
| `docker-compose.standalone.yml` | Standalone (VisionPlante only) |
| `.env.docker` | Docker environment variables |
| `scripts/docker-start.bat` | Windows Docker startup script |
| `scripts/docker-start.sh` | Linux/Mac Docker startup script |

---

## 🎯 Quick Reference

### Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Status
docker-compose ps

# Clean up
docker-compose down -v
docker system prune -a
```

### Access Points

- **API**: http://localhost:8003
- **Docs**: http://localhost:8003/docs
- **Health**: http://localhost:8003/api/v1/health
- **Kafka**: localhost:9092 (if running full setup)

---

## ✅ Comparison: Local vs Docker

| Feature | Local | Docker |
|---------|-------|--------|
| **Setup** | `pip install` | `docker-compose up` |
| **Start Time** | ~5 seconds | ~30 seconds |
| **Isolation** | No | Yes |
| **Portability** | Medium | High |
| **Resource Usage** | Lower | Higher |
| **Best For** | Development | Production/Testing |
| **Dependencies** | Manual | Automatic |
| **Cleanup** | Manual | Automatic |

---

## 🎉 Summary

### Local Development:
```bash
python main.py
```

### Docker Testing:
```bash
docker-compose -f docker-compose.standalone.yml up -d
```

### Docker Production:
```bash
docker-compose up -d
```

**All three work with the same API at http://localhost:8003!** 🚀

---

**Need help? Check logs with `docker-compose logs -f`**
