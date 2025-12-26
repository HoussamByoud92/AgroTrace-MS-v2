import json
import os
import time
import io
import kafka
from kafka import KafkaConsumer, KafkaProducer
from minio import Minio
import pandas as pd
import rasterio
from rasterio.windows import Window
import numpy as np
from PIL import Image
import py_eureka_client.eureka_client as eureka_client

# Config
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
MINIO_SECRET = os.getenv("MINIO_SECRET_KEY", "minio_password")
EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")

# Register with Eureka
def register_eureka():
    try:
        eureka_client.init(
            eureka_server=EUREKA_SERVER,
            app_name="pre-traitement",
            instance_port=8000,
            instance_host="pre-traitement"
        )
        print("Registered with Eureka")
    except Exception as e:
        print(f"Failed to register with Eureka: {e}")

# MinIO Client
minio_client = Minio(
    MINIO_ENDPOINT.replace("http://", "").replace("https://", ""),
    access_key=MINIO_ACCESS,
    secret_key=MINIO_SECRET,
    secure=False
)

# Kafka Setup
producer = None
consumer = None

for _ in range(15):
    try:
        if not producer:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
        
        if not consumer:
            consumer = KafkaConsumer(
                'sensor_data', 'image_events',
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                group_id='preprocessing_group'
            )
        print("Connected to Kafka")
        break
    except Exception as e:
        print(f"Waiting for Kafka... {e}")
        time.sleep(5)

def process_sensor_data(data):
    try:
        # Data Cleaning
        temp = data.get('temperature')
        hum = data.get('humidity')
        
        # Range checks
        if temp is None or not (-50 <= temp <= 60):
            print(f"Invalid temp: {temp}")
            return
        if hum is None or not (0 <= hum <= 100):
            print(f"Invalid humidity: {hum}")
            return
            
        # Enrich/Normalize if needed (e.g. Kelvin to Celsius? Assuming Celsius)
        
        # Produce to clean topic
        if producer:
            producer.send('clean_sensor_data', value=data)
            print(f"Cleaned data sent for {data.get('sensor_id')}")
            
    except Exception as e:
        print(f"Error processing sensor data: {e}")

def process_image_event(data):
    filename = data.get('filename')
    bucket = data.get('bucket', 'images')
    print(f"Processing image: {filename} from {bucket}")
    
    try:
        # Ensure tiles bucket exists
        if not minio_client.bucket_exists("tiles"):
            minio_client.make_bucket("tiles")

        # Download image
        obj = minio_client.get_object(bucket, filename)
        img_data = io.BytesIO(obj.read())
        
        # Open with Rasterio
        with rasterio.open(img_data) as src:
            width = src.width
            height = src.height
            tile_size = 256
            
            # Iterate tiles
            for x in range(0, width, tile_size):
                for y in range(0, height, tile_size):
                    window = Window(x, y, min(tile_size, width - x), min(tile_size, height - y))
                    
                    # Read window
                    # Read as numpy array (bands, height, width)
                    img_array = src.read(window=window)
                    
                    # Convert to CHW to HWC for Pillow
                    img_array = np.moveaxis(img_array, 0, -1)
                    
                    # Handle datatypes
                    if img_array.dtype == 'uint16':
                        img_array = (img_array / 256).astype('uint8')
                    elif img_array.dtype == 'float32':
                        img_array = (img_array * 255).astype('uint8') # Simplistic normalization
                        
                    # Create PIL Image
                    # Handle multispectral (take first 3 bands if > 3)
                    if img_array.shape[2] >= 3:
                        img_pil = Image.fromarray(img_array[:,:,:3].astype('uint8'), 'RGB')
                    else:
                        img_pil = Image.fromarray(img_array[:,:,0].astype('uint8'), 'L')
                    
                    # Save to buffer
                    tile_buffer = io.BytesIO()
                    img_pil.save(tile_buffer, format="PNG")
                    tile_buffer.seek(0)
                    
                    # Upload tile
                    tile_filename = f"tile_{x}_{y}_{filename.split('.')[0]}.png"
                    minio_client.put_object(
                        "tiles",
                        tile_filename,
                        tile_buffer,
                        length=tile_buffer.getbuffer().nbytes,
                        content_type="image/png"
                    )
                    
                    # Produce vision task
                    task = {
                        "type": "vision_task",
                        "original_image": filename,
                        "tile_filename": tile_filename,
                        "bucket": "tiles",
                        "drone_id": data.get('drone_id'),
                        "location": data.get('location'), # Ideally calculate tile center lat/lon
                        "tile_x": x,
                        "tile_y": y
                    }
                    if producer:
                        producer.send('vision_tasks', value=task)
            
            print(f"Finished tiling {filename}")

    except Exception as e:
        print(f"Error processing image {filename}: {e}")

if __name__ == "__main__":
    # Register with Eureka first
    register_eureka()
    
    if consumer:
        print("Preprocessing service started...")
        for message in consumer:
            if message.topic == 'sensor_data':
                process_sensor_data(message.value)
            elif message.topic == 'image_events':
                process_image_event(message.value)
