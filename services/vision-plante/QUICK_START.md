# ⚡ VisionPlante Quick Start

## Choose Your Path

### 🏃 Path 1: Local (Fastest for Development)

```bash
# 1. Install dependencies (one time)
pip install -r requirements.txt

# 2. Start service
python main.py

# 3. Test
Open http://localhost:8003/docs
```

**Time:** 30 seconds  
**Best for:** Development, learning, quick testing

---

### 🐳 Path 2: Docker Standalone (No Kafka)

```bash
# 1. Navigate to visionPlant directory
cd visionPlant

# 2. Start service
docker-compose -f docker-compose.standalone.yml up -d

# 3. Test
Open http://localhost:8003/docs

# 4. Stop
docker-compose -f docker-compose.standalone.yml down
```

**Time:** 2 minutes (first time)  
**Best for:** Testing, isolated environment

---

### 🚀 Path 3: Docker Full (With Kafka)

```bash
# 1. Navigate to visionPlant directory
cd visionPlant

# 2. Start all services
docker-compose up -d

# 3. Test
Open http://localhost:8003/docs

# 4. Stop
docker-compose down
```

**Time:** 3 minutes (first time)  
**Best for:** Production, full microservices

---

## 🎯 What You Get

All three paths give you:
- ✅ REST API at http://localhost:8003
- ✅ Interactive docs at http://localhost:8003/docs
- ✅ Crop stress detection with YOLO
- ✅ Health score calculation
- ✅ Annotated images with bounding boxes

---

## 🧪 Test It

### Method 1: Browser (Easiest)
1. Open http://localhost:8003/docs
2. Click `POST /api/v1/detect`
3. Click "Try it out"
4. Upload an image
5. Click "Execute"
6. See results! 🎉

### Method 2: Beautiful UI
1. Open `tests/test_frontend.html` in browser
2. Drag and drop an image
3. Click "Detect Crop Stress"
4. See beautiful results!

### Method 3: Command Line
```bash
curl http://localhost:8003/api/v1/health
```

---

## 📚 Learn More

- **[LOCAL_VS_DOCKER.md](LOCAL_VS_DOCKER.md)** - Compare modes
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - Full Docker guide
- **[HOW_TO_TEST.md](HOW_TO_TEST.md)** - Testing guide
- **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** - Complete guide

---

## 🆘 Need Help?

**Service won't start?**
- Check if port 8003 is free
- Ensure `model/best.pt` exists
- Check Python version (3.11+)

**Docker issues?**
- **Error: "cannot find the file specified" or "dockerDesktopLinuxEngine"?**
  - Docker Desktop is not running! Start Docker Desktop from Windows Start menu
  - Wait for Docker Desktop to fully start (check system tray icon)
  - Verify with: `docker ps` (should not show errors)
- Try: `docker-compose down` then `docker-compose up -d`

**Still stuck?**
- Check logs: `docker-compose logs -f`
- Read: [DOCKER_GUIDE.md](DOCKER_GUIDE.md)

---

**Ready? Pick a path above and start in 30 seconds!** 🚀
