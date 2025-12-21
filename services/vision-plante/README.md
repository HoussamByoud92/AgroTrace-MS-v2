# 🌱 VisionPlante - Crop Stress Detection Service

AI-powered microservice for detecting crop stress and diseases using YOLO object detection.

## 🚀 Quick Start

### Option 1: Local (Development)
```bash
# Install dependencies
pip install -r requirements.txt

# Start service
python main.py
```

### Option 2: Docker Standalone
```bash
docker-compose -f docker-compose.standalone.yml up -d
```

### Option 3: Docker with Kafka
```bash
docker-compose up -d
```

**All options:** Open `http://localhost:8003/docs`

**See:** [QUICK_START.md](QUICK_START.md) for detailed guide

## 📁 Project Structure

```
visionPlant/
├── app/                        # Application code
│   ├── api/                   # API routes
│   │   └── routes.py         # REST endpoints
│   ├── core/                 # Core configuration
│   │   └── config.py         # Settings management
│   ├── schemas/              # Data models
│   │   └── detection.py      # Pydantic schemas
│   └── services/             # Business logic
│       ├── yolo_detector.py  # YOLO detection service
│       └── kafka_producer.py # Kafka integration
├── docs/                      # Documentation
│   ├── GETTING_STARTED.md    # Quick start guide
│   ├── README.md             # Full documentation
│   ├── QUICKSTART.md         # 5-minute setup
│   ├── DEPLOYMENT.md         # Production deployment
│   ├── ARCHITECTURE.md       # System architecture
│   └── PROJECT_SUMMARY.md    # Project overview
├── model/                     # AI model
│   └── best.pt               # YOLO model file
├── scripts/                   # Utility scripts
│   ├── start.bat             # Windows startup
│   └── start.sh              # Linux/Mac startup
├── tests/                     # Testing
│   ├── test_api.py           # API tests
│   └── test_frontend.html    # Web UI test
├── uploads/                   # Uploaded images
├── results/                   # Detection results
├── main.py                    # Application entry point
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Multi-container setup
└── .env                       # Environment variables
```

## 🎯 Features

- ✅ REST API for crop stress detection
- ✅ YOLO-based AI detection (healthy vs stressed)
- ✅ Real-time image processing
- ✅ Kafka event publishing
- ✅ Health score calculation
- ✅ Interactive API documentation
- ✅ Docker support
- ✅ Horizontal scaling ready

## 📚 Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** - Start here!
- **[Quick Start](docs/QUICKSTART.md)** - 5-minute setup
- **[Full Documentation](docs/README.md)** - Complete guide
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Architecture](docs/ARCHITECTURE.md)** - System design
- **[Project Summary](docs/PROJECT_SUMMARY.md)** - Overview

## 🧪 Testing

### Web UI (Easiest)
Open `tests/test_frontend.html` in your browser

### API Documentation
Visit `http://localhost:8003/docs`

### Python Script
```bash
python tests/test_api.py your_image.jpg
```

### curl
```bash
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@crop.jpg" \
  -F "field_id=field-001"
```

## 🐳 Docker Deployment

```bash
# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🔧 Configuration

Edit `.env` file:

```env
# Detection settings
CONF_THRESHOLD=0.4      # Detection confidence
DEVICE=cpu              # cpu or cuda for GPU

# Server settings
PORT=8003
LOG_LEVEL=INFO

# Kafka settings
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/api/v1/health` | GET | Health check |
| `/api/v1/detect` | POST | Detect crop stress |
| `/api/v1/results/{id}` | GET | Get result image |
| `/api/v1/model/info` | GET | Model configuration |
| `/docs` | GET | API documentation |

## 🔌 Integration

### Kafka Events
Publishes to `disease-detection-topic`:
```json
{
  "detection_id": "uuid",
  "field_id": "field-001",
  "health_score": 75.5,
  "diseases": [...],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### REST API Response
```json
{
  "detection_id": "uuid",
  "health_score": 75.5,
  "total_detections": 10,
  "stressed_count": 2,
  "healthy_count": 8,
  "detections": [...],
  "image_url": "/api/v1/results/uuid.jpg"
}
```

## 🛠️ Technology Stack

- **Framework**: FastAPI
- **AI Model**: YOLO (Ultralytics)
- **Image Processing**: OpenCV
- **Messaging**: Apache Kafka
- **Containerization**: Docker
- **Python**: 3.11+

## 📈 Performance

- Inference: ~200-500ms per image (CPU)
- Throughput: 10-50 images/second
- Scalability: Horizontal scaling via Kubernetes
- Memory: ~2GB per instance

## 🆘 Troubleshooting

**Service won't start?**
- Check if port 8003 is available
- Ensure `model/best.pt` exists
- Check Python version (3.11+)

**Slow detection?**
- Use GPU: Set `DEVICE=cuda` in `.env`
- Reduce image size: Set `IMG_SIZE=416`

**Kafka errors?**
- Service works without Kafka
- To use Kafka: `docker-compose up -d kafka`

## 📝 License

MIT

## 🤝 Support

- API Docs: `http://localhost:8003/docs`
- Health Check: `http://localhost:8003/api/v1/health`
- Documentation: See `docs/` folder

---

**Ready to detect crop stress? Run `scripts/start.bat` (Windows) or `scripts/start.sh` (Linux/Mac)!** 🚀
