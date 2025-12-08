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

# Config
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
MINIO_SECRET = os.getenv("MINIO_SECRET_KEY", "minio_password")

# Model Setup
print("Loading ResNet18 model...")
try:
    # Try loading pretrained weights
    weights = models.ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)
    print("Loaded pretrained ResNet18.")
except Exception as e:
    print(f"Could not load pretrained weights ({e}), using random weights.")
    model = models.resnet18(weights=None)

# Modify last layer for 2 classes (Healthy vs Diseased) for this demo
# In reality, we'd load a fine-tuned state_dict
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

# Kafka Setup
consumer = None
producer = None

for _ in range(15):
    try:
        if not producer:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            
        if not consumer:
            consumer = KafkaConsumer(
                'vision_tasks', # Consume tiles
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                group_id='vision_group'
            )
        print("Connected to Kafka")
        break
    except Exception as e:
        print(f"Waiting for Kafka... {e}")
        time.sleep(5)

def process_image(msg):
    filename = msg.get('tile_filename', msg.get('filename')) # Handle both tiles and raw images
    bucket = msg.get('bucket', 'tiles')
    print(f"Vision analyzing {filename} from {bucket}")

    try:
        # Get Image from MinIO
        response = minio_client.get_object(bucket, filename)
        image_data = BytesIO(response.read())
        img = Image.open(image_data).convert('RGB')
        
        # Preprocess
        input_tensor = transform(img).unsqueeze(0)
        
        # Inference
        with torch.no_grad():
            output = model(input_tensor)
            probabilities = torch.nn.functional.softmax(output[0], dim=0)
            confidence, predicted_idx = torch.max(probabilities, 0)
            
        predicted_class = classes[predicted_idx.item()]
        
        # Result
        result = {
            "original_image": msg.get('original_image', filename),
            "tile_filename": filename,
            "drone_id": msg.get('drone_id'),
            "location": msg.get('location'),
            "tile_x": msg.get('tile_x'),
            "tile_y": msg.get('tile_y'),
            "health_status": predicted_class,
            "confidence": float(confidence.item()),
            "timestamp": time.time()
        }

        if producer:
            producer.send('vision_results', value=result)
            print(f"Result sent: {predicted_class} ({confidence.item():.2f})")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    if consumer:
        print("Vision Service Ready.")
        for message in consumer:
            process_image(message.value)
