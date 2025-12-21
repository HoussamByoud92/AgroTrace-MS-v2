# 🚀 Getting Started with VisionPlante

## What is VisionPlante?

VisionPlante is a web-based microservice that detects crop stress in agricultural images using AI (YOLO model). It replaces your Tkinter desktop application with a scalable, network-accessible REST API.

## ⚡ Quick Start (3 Minutes)

### Option 1: Windows (Easiest)

1. **Double-click** `start.bat`
2. Wait for service to start
3. Open browser to `http://localhost:8003/docs`
4. Done! 🎉

### Option 2: Linux/Mac

1. Run: `chmod +x start.sh && ./start.sh`
2. Open browser to `http://localhost:8003/docs`
3. Done! 🎉

### Option 3: Manual Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start service
python main.py
```

## 🧪 Test It Out

### Method 1: Beautiful Web UI (Recommended)

1. Open `test_frontend.html` in your browser
2. Click "Choose Image" and select a crop image
3. Click "Detect Crop Stress"
4. See results with health score and annotations!

### Method 2: Interactive API Docs

1. Go to `http://localhost:8003/docs`
2. Click on `POST /api/v1/detect`
3. Click "Try it out"
4. Upload an image
5. Click "Execute"
6. See JSON response!

### Method 3: Command Line

```bash
# Test with curl
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@your_image.jpg" \
  -F "field_id=test-field"

# Or use the Python test script
python test_api.py your_image.jpg
```

## 📊 What You'll Get

After uploading an image, you'll receive:

```json
{
  "detection_id": "unique-id",
  "health_score": 75.5,
  "total_detections": 10,
  "stressed_count": 2,
  "healthy_count": 8,
  "detections": [
    {
      "class_name": "stressed",
      "confidence": 0.92,
      "bounding_box": {...}
    }
  ],
  "image_url": "/api/v1/results/unique-id.jpg"
}
```

Plus an annotated image with bounding boxes showing stressed vs healthy crops!

## 🎯 Key Features

✅ **Web-based**: Access from anywhere, not just your desktop  
✅ **REST API**: Easy integration with other services  
✅ **Real-time**: Fast detection (< 1 second per image)  
✅ **Scalable**: Run multiple instances for high load  
✅ **Event-driven**: Publishes to Kafka for microservices  
✅ **Well-documented**: Interactive API docs included  
✅ **Easy to test**: 3 different testing methods  
✅ **Production-ready**: Docker, Kubernetes support  

## 📁 Important Files

| File | Purpose |
|------|---------|
| `main.py` | Main application - start here |
| `test_frontend.html` | Beautiful web UI for testing |
| `start.bat` / `start.sh` | Easy startup scripts |
| `requirements.txt` | Python dependencies |
| `docker-compose.yml` | Run with Docker |
| `.env` | Configuration settings |
| `model/best.pt` | Your YOLO model |

## 🔧 Configuration

Edit `.env` file to customize:

```env
# Make detection more/less sensitive
CONF_THRESHOLD=0.4    # Lower = more detections

# Use GPU for faster processing
DEVICE=cuda           # Change to 'cpu' if no GPU

# Change port
PORT=8003             # Use any available port
```

## 🐳 Docker Deployment (Optional)

If you want to run with Docker:

```bash
# Start everything (app + Kafka)
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop everything
docker-compose down
```

## 🆚 Comparison with Your Tkinter App

| Feature | Tkinter GUI | VisionPlante Web |
|---------|-------------|------------------|
| Access | Desktop only | Network accessible |
| Users | Single user | Multiple concurrent |
| Integration | Standalone | REST API |
| Deployment | Manual install | Docker/Cloud |
| Testing | Manual | Automated + Web UI |
| Scalability | No | Yes (horizontal) |
| Events | No | Kafka integration |

## 📚 Documentation

- **QUICKSTART.md** - Get started in 5 minutes
- **README.md** - Complete documentation
- **DEPLOYMENT.md** - Production deployment guide
- **ARCHITECTURE.md** - System architecture diagrams
- **PROJECT_SUMMARY.md** - Project overview

## 🔍 API Endpoints

Once running, you have these endpoints:

```
GET  /                          - Service info
GET  /api/v1/health            - Health check
POST /api/v1/detect            - Upload & detect
GET  /api/v1/results/{id}      - Get annotated image
GET  /api/v1/model/info        - Model configuration
GET  /docs                     - Interactive API docs
```

## 🎨 Example Usage

### Python

```python
import requests

# Upload image
with open('crop.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:8003/api/v1/detect',
        files={'image': f},
        data={'field_id': 'field-001'}
    )

result = response.json()
print(f"Health Score: {result['health_score']}%")
print(f"Stressed: {result['stressed_count']}")
print(f"Healthy: {result['healthy_count']}")
```

### JavaScript

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('field_id', 'field-001');

const response = await fetch('http://localhost:8003/api/v1/detect', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log(`Health Score: ${result.health_score}%`);
```

### curl

```bash
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@crop.jpg" \
  -F "field_id=field-001"
```

## ❓ Troubleshooting

### Service won't start

**Problem**: Port 8003 already in use  
**Solution**: Change `PORT=8004` in `.env` file

**Problem**: Model not found  
**Solution**: Ensure `model/best.pt` exists

### Slow detection

**Problem**: Takes > 5 seconds per image  
**Solution**: 
- Use GPU: Set `DEVICE=cuda` in `.env`
- Or reduce image size: Set `IMG_SIZE=416`

### Kafka errors

**Problem**: Kafka connection failed  
**Solution**: Service works fine without Kafka. To use Kafka:
```bash
docker-compose up -d kafka
```

## 🎓 Next Steps

1. ✅ **Test locally**: Use `test_frontend.html` or API docs
2. ✅ **Integrate**: Connect to your dashboard or other services
3. ✅ **Deploy**: Use Docker Compose or Kubernetes
4. ✅ **Scale**: Add more instances for high load
5. ✅ **Monitor**: Check `/api/v1/health` endpoint

## 💡 Tips

- **Development**: Use `ENVIRONMENT=development` in `.env` for auto-reload
- **Production**: Use `ENVIRONMENT=production` and Docker
- **GPU**: Install CUDA and set `DEVICE=cuda` for 5x faster inference
- **Testing**: Use `test_frontend.html` - it's beautiful and easy!

## 🆘 Need Help?

1. Check API docs: `http://localhost:8003/docs`
2. Check health: `http://localhost:8003/api/v1/health`
3. Check logs: Look at console output
4. Read documentation: See README.md

## 🎉 You're Ready!

Your VisionPlante microservice is now ready to detect crop stress!

**Start the service** → **Open test UI** → **Upload image** → **See results**

It's that simple! 🌱
