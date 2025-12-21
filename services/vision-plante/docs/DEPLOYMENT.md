# VisionPlante - Deployment Guide

## Architecture Overview

VisionPlante is a FastAPI-based microservice that:
- Accepts crop images via REST API
- Runs YOLO object detection to identify healthy vs stressed crops
- Returns annotated images with bounding boxes
- Publishes detection events to Kafka
- Calculates health scores and statistics

## Deployment Options

### 1. Local Development (Recommended for Testing)

**Requirements:**
- Python 3.11+
- 2GB RAM minimum
- GPU optional (CUDA support for faster inference)

**Steps:**

```bash
# Navigate to directory
cd visionPlant

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run service
python main.py
```

Service will be available at: `http://localhost:8003`

### 2. Docker Standalone

**Requirements:**
- Docker installed
- 4GB RAM minimum

**Steps:**

```bash
cd visionPlant

# Build image
docker build -t visionplante:1.0.0 .

# Run container
docker run -d \
  --name visionplante \
  -p 8003:8003 \
  -v $(pwd)/model:/app/model \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/results:/app/results \
  -e DEVICE=cpu \
  visionplante:1.0.0

# Check logs
docker logs -f visionplante

# Stop container
docker stop visionplante
docker rm visionplante
```

### 3. Docker Compose (Recommended for Full Stack)

**Includes:**
- VisionPlante service
- Kafka broker (for event streaming)

**Steps:**

```bash
cd visionPlant

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f visionplante

# Stop all services
docker-compose down
```

### 4. Kubernetes Deployment

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: visionplante
  labels:
    app: visionplante
spec:
  replicas: 3
  selector:
    matchLabels:
      app: visionplante
  template:
    metadata:
      labels:
        app: visionplante
    spec:
      containers:
      - name: visionplante
        image: visionplante:1.0.0
        ports:
        - containerPort: 8003
        env:
        - name: KAFKA_BOOTSTRAP_SERVERS
          value: "kafka-service:9092"
        - name: DEVICE
          value: "cpu"
        - name: LOG_LEVEL
          value: "INFO"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: model-volume
          mountPath: /app/model
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8003
          initialDelaySeconds: 20
          periodSeconds: 5
      volumes:
      - name: model-volume
        persistentVolumeClaim:
          claimName: model-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: visionplante-service
spec:
  selector:
    app: visionplante
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8003
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: visionplante-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: visionplante
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Deploy to Kubernetes:**

```bash
# Create namespace
kubectl create namespace agri-iot

# Apply deployment
kubectl apply -f deployment.yaml -n agri-iot

# Check status
kubectl get pods -n agri-iot
kubectl get svc -n agri-iot

# View logs
kubectl logs -f deployment/visionplante -n agri-iot

# Scale manually
kubectl scale deployment visionplante --replicas=5 -n agri-iot
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8003 | Server port |
| `ENVIRONMENT` | development | Environment (development/production) |
| `MODEL_PATH` | ./model/best.pt | Path to YOLO model |
| `CONF_THRESHOLD` | 0.4 | Detection confidence threshold |
| `IOU_THRESHOLD` | 0.45 | IoU threshold for NMS |
| `IMG_SIZE` | 640 | Input image size |
| `DEVICE` | cuda | Device (cpu/cuda/mps) |
| `MAX_DETECTIONS` | 300 | Max detections per image |
| `KAFKA_BOOTSTRAP_SERVERS` | localhost:9092 | Kafka brokers |
| `LOG_LEVEL` | INFO | Logging level |

### GPU Support

**For NVIDIA GPU:**

1. Install CUDA toolkit
2. Install PyTorch with CUDA:
   ```bash
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
   ```
3. Set `DEVICE=cuda` in `.env`

**Docker with GPU:**

```bash
docker run -d \
  --gpus all \
  --name visionplante \
  -p 8003:8003 \
  -e DEVICE=cuda \
  visionplante:1.0.0
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:8003/api/v1/health

# Model info
curl http://localhost:8003/api/v1/model/info
```

### Metrics to Monitor

1. **Request Rate**: Requests per second
2. **Response Time**: p50, p95, p99 latencies
3. **Error Rate**: Failed detections
4. **Model Inference Time**: Time per detection
5. **Memory Usage**: RAM consumption
6. **GPU Utilization**: If using GPU

### Logging

Logs are output to stdout in JSON format:

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "INFO",
  "message": "Detection complete: 5 objects found",
  "detection_id": "uuid",
  "processing_time_ms": 234
}
```

## Performance Tuning

### CPU Optimization

```env
# Reduce image size for faster processing
IMG_SIZE=416

# Increase confidence threshold to reduce false positives
CONF_THRESHOLD=0.5

# Limit max detections
MAX_DETECTIONS=100
```

### GPU Optimization

```env
# Use larger image size for better accuracy
IMG_SIZE=1280

# Enable GPU
DEVICE=cuda

# Batch processing (if implementing)
BATCH_SIZE=8
```

### Scaling Guidelines

| Load | Replicas | Resources per Pod |
|------|----------|-------------------|
| Low (< 10 req/min) | 1-2 | 1 CPU, 2GB RAM |
| Medium (10-100 req/min) | 3-5 | 2 CPU, 4GB RAM |
| High (> 100 req/min) | 5-10 | 4 CPU, 8GB RAM |

## Security

### API Security

1. **Add Authentication:**
   ```python
   # In main.py
   from fastapi.security import HTTPBearer
   
   security = HTTPBearer()
   
   @app.post("/api/v1/detect")
   async def detect(token: str = Depends(security)):
       # Verify token
       pass
   ```

2. **Rate Limiting:**
   ```python
   from slowapi import Limiter
   
   limiter = Limiter(key_func=get_remote_address)
   
   @app.post("/api/v1/detect")
   @limiter.limit("10/minute")
   async def detect():
       pass
   ```

3. **HTTPS Only:**
   - Use reverse proxy (nginx, traefik)
   - Enable TLS certificates

### Network Security

- Run in private network/VPC
- Use firewall rules
- Implement API gateway
- Enable CORS selectively

## Troubleshooting

### Common Issues

**1. Model not loading**
```
Error: Model file 'best.pt' not found
Solution: Ensure model exists at ./model/best.pt
```

**2. Out of memory**
```
Error: CUDA out of memory
Solution: Reduce IMG_SIZE or use CPU (DEVICE=cpu)
```

**3. Kafka connection failed**
```
Warning: Kafka producer not available
Solution: Service works without Kafka, or start Kafka broker
```

**4. Slow inference**
```
Issue: Detection takes > 5 seconds
Solution: Use GPU, reduce IMG_SIZE, or scale horizontally
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python main.py

# Or in Docker
docker run -e LOG_LEVEL=DEBUG visionplante:1.0.0
```

## Backup and Recovery

### Model Backup

```bash
# Backup model
cp model/best.pt model/best.pt.backup

# Restore model
cp model/best.pt.backup model/best.pt
```

### Data Backup

```bash
# Backup results
tar -czf results-backup-$(date +%Y%m%d).tar.gz results/

# Restore results
tar -xzf results-backup-20240115.tar.gz
```

## Integration with Other Services

### IngestionCapteurs Integration

VisionPlante receives image tiles from IngestionCapteurs via Kafka topic `image-tiles-topic`.

### RèglesAgro Integration

Detection events are published to `disease-detection-topic` for rule processing.

### DashboardSIG Integration

Dashboard queries results via REST API and displays annotated images.

## Maintenance

### Update Model

```bash
# Stop service
docker-compose down

# Replace model
cp new_model.pt model/best.pt

# Restart service
docker-compose up -d
```

### Update Dependencies

```bash
# Update requirements.txt
pip install --upgrade ultralytics fastapi

# Rebuild Docker image
docker-compose build
docker-compose up -d
```

## Support

For issues or questions:
- Check logs: `docker-compose logs visionplante`
- API docs: `http://localhost:8003/docs`
- Health check: `http://localhost:8003/api/v1/health`
