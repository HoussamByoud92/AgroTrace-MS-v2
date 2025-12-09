from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from kafka import KafkaProducer
from sqlalchemy import create_engine, text
from minio import Minio
import json
import os
import time
import io
import uuid

app = FastAPI()

# Configuration
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
TIMESCALE_URL = os.getenv("TIMESCALE_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_timescale")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minio_password")

# Setup Kafka Producer
producer = None
for _ in range(10):
    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        print("Kafka Producer connected.")
        break
    except Exception as e:
        print(f"Waiting for Kafka... {e}")
        time.sleep(5)

# Setup TimescaleDB Engine
try:
    engine = create_engine(TIMESCALE_URL)
    # Create table if not exists (basic raw data table)
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
        conn.commit()
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sensor_readings (
                time TIMESTAMPTZ NOT NULL,
                sensor_id TEXT,
                temperature DOUBLE PRECISION,
                humidity DOUBLE PRECISION,
                soil_moisture DOUBLE PRECISION,
                light_intensity DOUBLE PRECISION,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION
            );
        """))
        # Convert to hypertable if not already
        try:
            conn.execute(text("SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);"))
        except Exception as e:
            print(f"Hypertable creation warning (might exist): {e}")
        conn.commit()
    print("TimescaleDB connected and initialized.")
except Exception as e:
    print(f"Database connection error: {e}")
    engine = None

# Setup MinIO Client
minio_client = Minio(
    MINIO_ENDPOINT.replace("http://", "").replace("https://", ""),
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

class SensorData(BaseModel):
    sensor_id: str
    timestamp: str 
    temperature: float
    humidity: float
    soil_moisture: float
    light_intensity: float
    location_lat: float
    location_lon: float

@app.post("/sensor-data")
def ingest_sensor_data(data: SensorData):
    # 1. Save to TimescaleDB (Hot path persistence)
    try:
        if engine:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO sensor_readings (time, sensor_id, temperature, humidity, soil_moisture, light_intensity, latitude, longitude)
                    VALUES (:time, :id, :temp, :hum, :soil, :light, :lat, :lon)
                """), {
                    "time": data.timestamp, # Ensure generic ISO string or handled by driver
                    "id": data.sensor_id,
                    "temp": data.temperature,
                    "hum": data.humidity,
                    "soil": data.soil_moisture,
                    "light": data.light_intensity,
                    "lat": data.location_lat,
                    "lon": data.location_lon
                })
                conn.commit()
    except Exception as e:
        print(f"DB Insert Error: {e}")
        # Dont fail request if DB is down, just log, but maybe return 500 in strict mode. 
        # Here we prioritize availability + Kafka.

    # 2. Publish to Kafka
    if not producer:
        raise HTTPException(status_code=503, detail="Kafka not available")
    
    producer.send('sensor_data', value=data.dict())
    return {"status": "queued", "saved_db": engine is not None}

@app.post("/upload-image")
def upload_image(
    file: UploadFile = File(...),
    drone_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    try:
        # Generate unique filename
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{drone_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}.{file_ext}"
        bucket_name = "images"

        # Check bucket (initialized in infra but check safety)
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)

        # Upload to MinIO
        file_content = file.file.read()
        file_stream = io.BytesIO(file_content)
        
        minio_client.put_object(
            bucket_name,
            unique_filename,
            file_stream,
            length=len(file_content),
            content_type=file.content_type
        )

        # Create Event
        event = {
             "type": "image_upload",
             "filename": unique_filename,
             "bucket": bucket_name,
             "drone_id": drone_id,
             "location": {"lat": latitude, "lon": longitude},
             "timestamp": time.time()
        }

        # Send to Kafka
        if producer:
            producer.send('image_events', value=event)
        
        return {"status": "uploaded", "filename": unique_filename}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Simulation Logic
simulation_active = False
simulation_thread = None

def run_simulation():
    global simulation_active
    import random
    
    print("Starting sensor simulation...")
    sensors = ["sensor-01", "sensor-02", "sensor-03"]
    
    # Base locations for sensors (different regions)
    sensor_locations = {
        "sensor-01": {"base_lat": 45.0, "base_lon": -0.5, "base_elevation": 100},
        "sensor-02": {"base_lat": 45.2, "base_lon": -0.7, "base_elevation": 150},
        "sensor-03": {"base_lat": 44.8, "base_lon": -0.3, "base_elevation": 80}
    }
    
    while simulation_active:
        for s_id in sensors:
            if not simulation_active: break
            
            loc = sensor_locations[s_id]
            
            # Generate varied environmental data
            data = SensorData(
                sensor_id=s_id,
                timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                # Temperature varies by time and sensor
                temperature=20 + random.uniform(-8, 15) + (hash(s_id) % 5),
                # Humidity varies inversely with temperature
                humidity=50 + random.uniform(-15, 25),
                # Soil moisture varies significantly
                soil_moisture=25 + random.uniform(0, 50),
                # Light intensity varies
                light_intensity=400 + random.uniform(-200, 600),
                # Location with small variations
                location_lat=loc["base_lat"] + random.uniform(-0.02, 0.02),
                location_lon=loc["base_lon"] + random.uniform(-0.02, 0.02)
            )
            
            # Call internal ingest directly
            ingest_sensor_data(data)
            
        time.sleep(2) # Generate every 2 seconds
        
    print("Simulation stopped.")

@app.post("/simulate/start")
def start_simulation():
    global simulation_active, simulation_thread
    if simulation_active:
        return {"status": "Already running"}
    
    simulation_active = True
    import threading
    simulation_thread = threading.Thread(target=run_simulation)
    simulation_thread.start()
    return {"status": "Simulation started"}

@app.post("/simulate/stop")
def stop_simulation():
    global simulation_active
    simulation_active = False
    return {"status": "Simulation stopping..."}

@app.get("/simulate/status")
def get_simulation_status():
    """Get current simulation status"""
    global simulation_active
    return {
        "is_active": simulation_active,
        "status": "running" if simulation_active else "stopped"
    }

@app.get("/recent")
def get_recent_readings(limit: int = 20):
    if engine:
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f"""
                    SELECT time, sensor_id, temperature, humidity, soil_moisture 
                    FROM sensor_readings 
                    ORDER BY time DESC 
                    LIMIT {limit}
                """))
                rows = []
                for row in result:
                    rows.append({
                        "time": str(row[0]),
                        "sensor_id": row[1],
                        "temperature": row[2],
                        "humidity": row[3],
                        "soil_moisture": row[4]
                    })
                return rows
        except Exception as e:
            print(f"Error fetching recent: {e}")
            return []
    return []
