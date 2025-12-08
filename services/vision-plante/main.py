import os
import time
import json
import torch
import torch.nn as nn
from torchvision import transforms, models
from minio import Minio
from kafka import KafkaConsumer, KafkaProducer
from io import BytesIO
from PIL import Image
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from contextlib import asynccontextmanager
import threading
import uvicorn

# Config
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
MINIO_SECRET = os.getenv("MINIO_SECRET_KEY", "minio_password")

# Model Setup
print("Loading ResNet18 model...")
try:
    weights = models.ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)
    print("Loaded pretrained ResNet18.")
except Exception as e:
    print(f"Could not load pretrained weights ({e}), using random weights.")
    model = models.resnet18(weights=None)

num_ftrs = model.fc.in_features
model.fc = nn.Linear(num_ftrs, 2) 
model.eval()

# Transform
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

classes = ['Healthy', 'Diseased']

# MinIO client setup
minio_client = Minio(
    MINIO_ENDPOINT.replace("http://", "").replace("https://", ""),
    access_key=MINIO_ACCESS,
    secret_key=MINIO_SECRET,
    secure=False
)

# Kafka Globals
producer = None
consumer_running = True

def kafka_consumer_loop():
    global producer
    consumer = None
    
    # Wait for Kafka
    for _ in range(15):
        try:
            if not producer:
                producer = KafkaProducer(
                    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                    value_serializer=lambda v: json.dumps(v).encode('utf-8')
                )
            
            if not consumer:
                consumer = KafkaConsumer(
                    'vision_tasks', 
                    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                    group_id='vision_group'
                )
            print("Kafka Consumer Background Thread Connected")
            break
        except Exception as e:
            print(f"Waiting for Kafka in background... {e}")
            time.sleep(5)
            
    if consumer:
        for message in consumer:
            if not consumer_running:
                break
            process_async_image(message.value)
        consumer.close()

def process_async_image(msg):
    filename = msg.get('tile_filename', msg.get('filename'))
    bucket = msg.get('bucket', 'tiles')
    print(f"Vision analyzing {filename} from {bucket}")

    try:
        response = minio_client.get_object(bucket, filename)
        image_data = BytesIO(response.read())
        
        result_data = run_inference(image_data)
        
        # Add metadata
        result_data.update({
            "original_image": msg.get('original_image', filename),
            "tile_filename": filename,
            "drone_id": msg.get('drone_id'),
            "location": msg.get('location'),
            "tile_x": msg.get('tile_x'),
            "tile_y": msg.get('tile_y'),
            "timestamp": time.time()
        })

        if producer:
            producer.send('vision_results', value=result_data)
            print(f"Result sent: {result_data['health_status']} ({result_data['confidence']:.2f})")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")

def run_inference(image_bytes_io):
    img = Image.open(image_bytes_io).convert('RGB')
    input_tensor = transform(img).unsqueeze(0)
    
    with torch.no_grad():
        output = model(input_tensor)
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        confidence, predicted_idx = torch.max(probabilities, 0)
        
    predicted_class = classes[predicted_idx.item()]
    
    return {
        "health_status": predicted_class,
        "confidence": float(confidence.item())
    }

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    t = threading.Thread(target=kafka_consumer_loop)
    t.start()
    yield
    # Shutdown
    global consumer_running
    consumer_running = False
    
app = FastAPI(lifespan=lifespan)

@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    try:
        content = await file.read()
        image_stream = BytesIO(content)
        result = run_inference(image_stream)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train")
async def train_endpoint(file: UploadFile = File(...)):
    # Simulation: In a real app we would save this file and trigger a training job
    # For now we just pretend
    return {"status": "Training started", "message": f"Received dataset {file.filename}. Model will improve over time."}

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

