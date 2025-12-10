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
    
    print("Starting sensor simulation with full 37-variable dataset...")
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
            
            # Generate basic sensor data
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

def generate_full_variable_data(sensor_id: str = "sensor-01", base_lat: float = 45.0, base_lon: float = -0.5, base_elevation: float = 100.0):
    """Generate all 37 variables for water prediction model"""
    import random
    
    # Slopes vary by terrain (8 directions)
    slope_base = random.uniform(0.1, 0.8)
    slopes = {f"slope{i}": round(slope_base + random.uniform(-0.3, 0.3), 2) for i in range(1, 9)}
    
    # Aspect distribution (should sum to ~100%)
    aspect_values = [random.uniform(15, 35) for _ in range(4)]
    aspect_sum = sum(aspect_values)
    aspects = {
        "aspectN": round((aspect_values[0] / aspect_sum) * 100, 1),
        "aspectE": round((aspect_values[1] / aspect_sum) * 100, 1),
        "aspectS": round((aspect_values[2] / aspect_sum) * 100, 1),
        "aspectW": round((aspect_values[3] / aspect_sum) * 100, 1),
        "aspectUnknown": round(random.uniform(0, 5), 1)
    }
    
    # Land cover percentages (should sum to ~100%)
    land_values = {
        "WAT_LAND": random.uniform(2, 8),
        "NVG_LAND": random.uniform(5, 15),
        "URB_LAND": random.uniform(3, 10),
        "GRS_LAND": random.uniform(15, 30),
        "FOR_LAND": random.uniform(8, 20),
        "CULTRF_LAND": random.uniform(10, 25),
        "CULTIR_LAND": random.uniform(15, 30),
        "CULT_LAND": random.uniform(5, 15)
    }
    land_sum = sum(land_values.values())
    land_cover = {k: round((v / land_sum) * 100, 1) for k, v in land_values.items()}
    
    # Soil quality indices
    soil_base = random.uniform(40, 70)
    soil_quality = {
        f"SQ{i}": round(soil_base + random.uniform(-10, 10) - (i * 2), 1) 
        for i in range(1, 8)
    }
    
    # Basic environmental data
    temperature = 20 + random.uniform(-8, 15)
    humidity = 50 + random.uniform(-15, 25)
    soil_moisture = 25 + random.uniform(0, 50)
    
    # Combine all data
    return {
        "fips": f"{random.randint(10000, 99999)}",
        "lat": round(base_lat + random.uniform(-0.02, 0.02), 4),
        "lon": round(base_lon + random.uniform(-0.02, 0.02), 4),
        "elevation": round(base_elevation + random.uniform(-20, 20), 1),
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
        "soil_moisture": round(soil_moisture, 2),
        "sensor_id": sensor_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **slopes,
        **aspects,
        **land_cover,
        **soil_quality
    }

@app.get("/simulate/generate-full")
def generate_full_data(count: int = 1):
    """Generate full 37-variable dataset for testing"""
    import random
    
    sensors = ["sensor-01", "sensor-02", "sensor-03"]
    sensor_locations = {
        "sensor-01": {"base_lat": 45.0, "base_lon": -0.5, "base_elevation": 100},
        "sensor-02": {"base_lat": 45.2, "base_lon": -0.7, "base_elevation": 150},
        "sensor-03": {"base_lat": 44.8, "base_lon": -0.3, "base_elevation": 80}
    }
    
    results = []
    for _ in range(count):
        sensor = random.choice(sensors)
        loc = sensor_locations[sensor]
        data = generate_full_variable_data(
            sensor_id=sensor,
            base_lat=loc["base_lat"],
            base_lon=loc["base_lon"],
            base_elevation=loc["base_elevation"]
        )
        results.append(data)
    
    return results

@app.get("/simulate/export-csv")
def export_csv(rows: int = 20):
    """Export simulation data as CSV with configurable row count (min 20)"""
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    
    # Validate minimum rows
    if rows < 20:
        raise HTTPException(status_code=400, detail="Minimum 20 rows required")
    
    # Generate data
    import random
    sensors = ["sensor-01", "sensor-02", "sensor-03"]
    sensor_locations = {
        "sensor-01": {"base_lat": 45.0, "base_lon": -0.5, "base_elevation": 100},
        "sensor-02": {"base_lat": 45.2, "base_lon": -0.7, "base_elevation": 150},
        "sensor-03": {"base_lat": 44.8, "base_lon": -0.3, "base_elevation": 80}
    }
    
    data_rows = []
    for _ in range(rows):
        sensor = random.choice(sensors)
        loc = sensor_locations[sensor]
        data = generate_full_variable_data(
            sensor_id=sensor,
            base_lat=loc["base_lat"],
            base_lon=loc["base_lon"],
            base_elevation=loc["base_elevation"]
        )
        data_rows.append(data)
    
    # Create CSV
    output = StringIO()
    if data_rows:
        writer = csv.DictWriter(output, fieldnames=data_rows[0].keys())
        writer.writeheader()
        writer.writerows(data_rows)
    
    output.seek(0)
    
    # Return as downloadable file
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=sensor_simulation_{rows}_rows.csv"
        }
    )

