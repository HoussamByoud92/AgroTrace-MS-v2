# VisionPlante - Quick Start Guide

## Prerequisites

- Python 3.11+
- YOLO model file at `./model/best.pt` ✓ (already present)
- (Optional) Docker and Docker Compose

## Option 1: Local Development (Fastest)

### 1. Install Dependencies

```bash
cd visionPlant
pip install -r requirements.txt
```

### 2. Start the Service

```bash
python main.py
```

The service will start at `http://localhost:8003`

### 3. Test the API

Open your browser and go to:
- API Documentation: `http://localhost:8003/docs`
- Health Check: `http://localhost:8003/api/v1/health`

### 4. Test with an Image

Using curl:
```bash
curl -X POST http://localhost:8003/api/v1/detect \
  -F "image=@your_image.jpg" \
  -F "field_id=field-001"
```

Using Python test script:
```bash
python test_api.py your_image.jpg
```

## Option 2: Docker Deployment

### 1. Build and Run with Docker Compose

```bash
cd visionPlant
docker-compose up -d
```

This will start:
- VisionPlante service on port 8003
- Kafka broker on port 9092

### 2. Check Logs

```bash
docker-compose logs -f visionplante
```

### 3. Stop Services

```bash
docker-compose down
```

## API Endpoints

### Health Check
```
GET http://localhost:8003/api/v1/health
```

### Detect Crop Stress
```
POST http://localhost:8003/api/v1/detect
Content-Type: multipart/form-data

Form Data:
- image: [image file]
- field_id: "field-001" (optional)
- tile_id: "tile-001" (optional)
```

### Get Result Image
```
GET http://localhost:8003/api/v1/results/{filename}
```

### Model Info
```
GET http://localhost:8003/api/v1/model/info
```

## Interactive API Documentation

Once the service is running, visit:
- Swagger UI: `http://localhost:8003/docs`
- ReDoc: `http://localhost:8003/redoc`

You can test all endpoints directly from the browser!

## Example Response

```json
{
  "detection_id": "123e4567-e89b-12d3-a456-426614174000",
  "field_id": "field-001",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "detections": [
    {
      "class_name": "stressed",
      "confidence": 0.92,
      "bounding_box": {
        "x1": 100.5,
        "y1": 150.2,
        "x2": 300.8,
        "y2": 400.1
      }
    },
    {
      "class_name": "healthy",
      "confidence": 0.88,
      "bounding_box": {
        "x1": 350.0,
        "y1": 200.0,
        "x2": 500.0,
        "y2": 450.0
      }
    }
  ],
  "total_detections": 2,
  "health_score": 50.0,
  "stressed_count": 1,
  "healthy_count": 1,
  "image_url": "/api/v1/results/123e4567-e89b-12d3-a456-426614174000.jpg"
}
```

## Configuration

Edit `.env` file to customize:

```env
# Detection thresholds
CONF_THRESHOLD=0.4      # Lower = more detections, higher = fewer but more confident
IOU_THRESHOLD=0.45      # Non-maximum suppression threshold

# Device
DEVICE=cpu              # Use 'cuda' for GPU acceleration

# Image size
IMG_SIZE=640            # Larger = more accurate but slower
```

## Troubleshooting

### Model not found
- Ensure `best.pt` exists in `./model/` directory

### Kafka connection failed
- For local development without Kafka, the service will still work (just won't publish events)
- To use Kafka, start it with: `docker-compose up -d kafka`

### CUDA/GPU errors
- Set `DEVICE=cpu` in `.env` file if you don't have a GPU

### Port already in use
- Change `PORT=8003` to another port in `.env` file

## Next Steps

1. Integrate with other microservices (IngestionCapteurs, RèglesAgro)
2. Connect to Kafka for event-driven architecture
3. Deploy to production with Kubernetes
4. Add authentication and rate limiting

## Support

For issues or questions, check:
- API docs: `http://localhost:8003/docs`
- Logs: `docker-compose logs visionplante`
- README.md for detailed documentation
