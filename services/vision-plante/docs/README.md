# VisionPlante - Crop Stress Detection Service

AI-powered microservice for detecting crop stress and diseases using YOLO object detection.

## Features

- Real-time crop stress detection (healthy vs stressed)
- REST API for image upload and analysis
- Kafka integration for event-driven architecture
- Annotated image results with bounding boxes
- Health score calculation
- Docker support for easy deployment

## Technology Stack

- **Framework:** FastAPI
- **AI Model:** YOLO (Ultralytics)
- **Image Processing:** OpenCV, PIL
- **Messaging:** Apache Kafka
- **Python:** 3.11+

## Installation

### Local Development

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Ensure YOLO model exists at `./model/best.pt`

5. Run the service:
```bash
python main.py
```

Or with uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

### Docker Deployment

1. Build image:
```bash
docker build -t visionplante:latest .
```

2. Run container:
```bash
docker run -d \
  -p 8003:8003 \
  -v $(pwd)/model:/app/model \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/results:/app/results \
  --env-file .env \
  --name visionplante \
  visionplante:latest
```

## API Endpoints

### Health Check
```
GET /api/v1/health
```

### Detect Crop Stress
```
POST /api/v1/detect
Content-Type: multipart/form-data

Parameters:
- image: Image file (required)
- field_id: Field identifier (optional)
- tile_id: Tile identifier (optional)

Response:
{
  "detection_id": "uuid",
  "field_id": "field-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "detections": [
    {
      "class_name": "stressed",
      "confidence": 0.92,
      "bounding_box": {
        "x1": 100, "y1": 150,
        "x2": 300, "y2": 400
      }
    }
  ],
  "total_detections": 5,
  "health_score": 65.5,
  "stressed_count": 2,
  "healthy_count": 3,
  "image_url": "/api/v1/results/uuid.jpg"
}
```

### Get Result Image
```
GET /api/v1/results/{filename}
```

### Model Information
```
GET /api/v1/model/info
```

## Configuration

Edit `.env` file to configure:

- `CONF_THRESHOLD`: Detection confidence threshold (0.0-1.0)
- `IOU_THRESHOLD`: IoU threshold for NMS (0.0-1.0)
- `IMG_SIZE`: Input image size for model
- `DEVICE`: Inference device (cpu, cuda, mps)
- `KAFKA_BOOTSTRAP_SERVERS`: Kafka broker addresses

## Testing

Test the API using curl:

```bash
# Health check
curl http://localhost:8003/api/v1/health

# Detect crop stress
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@test_image.jpg" \
  -F "field_id=field-001"
```

Or use the interactive API docs at: `http://localhost:8003/docs`

## Kafka Integration

The service publishes detection events to Kafka topic `disease-detection-topic`:

```json
{
  "detection_id": "uuid",
  "field_id": "field-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "diseases": [
    {
      "class": "stressed",
      "confidence": 0.92,
      "affected_area_percent": 15.5
    }
  ],
  "health_score": 84.5,
  "total_detections": 10,
  "stressed_count": 2,
  "healthy_count": 8
}
```

## Model Classes

- `healthy`: Healthy crop
- `stressed`: Stressed crop
- `st`: Intermediate stress state

## Directory Structure

```
visionPlant/
├── main.py              # FastAPI application
├── config.py            # Configuration management
├── models.py            # Pydantic models
├── yolo_detector.py     # YOLO detection logic
├── kafka_producer.py    # Kafka integration
├── requirements.txt     # Python dependencies
├── Dockerfile          # Docker configuration
├── .env.example        # Environment template
├── model/              # YOLO model files
│   └── best.pt
├── uploads/            # Uploaded images
└── results/            # Annotated results
```

## License

MIT
