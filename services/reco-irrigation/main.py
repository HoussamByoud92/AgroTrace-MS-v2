from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
import requests
import os
import time
from datetime import datetime
import py_eureka_client.eureka_client as eureka_client

EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")

app = FastAPI()

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Eureka registration on startup
@app.on_event("startup")
async def startup_event():
    try:
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name="reco-irrigation",
            instance_port=8000,
            instance_host="reco-irrigation"
        )
        print("Registered with Eureka")
    except Exception as e:
        print(f"Failed to register with Eureka: {e}")

# Configuration
RULES_SERVICE_URL = os.getenv("RULES_SERVICE_URL", "http://regles-agro:8080/api/rules/evaluate")
PREVISION_SERVICE_URL = os.getenv("PREVISION_SERVICE_URL", "http://prevision-eau:8000/predict")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agro_user:agro_password@postgis:5432/agro_gis")

# DB Setup
engine = None
try:
    engine = create_engine(DATABASE_URL)
    # Ensure table exists
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS irrigation_plans (
                id SERIAL PRIMARY KEY,
                zone_id TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                recommendation TEXT,
                water_amount_mm FLOAT,
                source TEXT
            );
        """))
        conn.commit()
    print("RecoIrrigation connected to PostGIS")
except Exception as e:
    print(f"Warning: DB Connection failed: {e}")

class CropContext(BaseModel):
    zone_id: str
    lat: float
    lon: float
    temperature: float = 25.0
    soil_moisture: float = 30.0
    crop_type: str = "Tomato"
    stressed_count: int = 0
    avg_confidence: float = 0.0
    
    # Extra fields for PrevisionEau... simplified for demo adoption
    fips: str = "00000"
    elevation: float = 100.0
    SQ1: float = 70.0 # High quality soil default

@app.post("/recommendation")
def calculate_recommendation(ctx: CropContext):
    
    # 0. Get sensor data (if not provided, fetch random from prediction service)
    current_weather = {
        "temperature": ctx.temperature,
        "humidity": 60.0,
        "pressure": 1013.25,
        "wind_speed": 2.5,
        "dew_point": 15.0
    }
    
    try:
        # Try to get more realistic sensor data from prevision-eau
        # Use simple requests since we are inside the same network
        resp = requests.get("http://prevision-eau:8000/random-sensor-data", timeout=2)
        if resp.status_code == 200:
            current_weather = resp.json()
    except Exception:
        pass

    # 1. Call Rules Engine (Java/Drools)
    rule_recommendation = "Standard"
    rule_action = "Maintain current monitoring."
    try:
        rule_payload = {
            "temperature": current_weather["temperature"],
            "soilMoisture": ctx.soil_moisture,
            "cropType": ctx.crop_type,
            "stressedCount": ctx.stressed_count
        }
        resp = requests.post(RULES_SERVICE_URL, json=rule_payload, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            rule_recommendation = data.get("recommendation", "Standard")
            rule_action = data.get("action", "Follow standard procedure.")
    except Exception as e:
        print(f"Rules Service failed: {e}")
        rule_action = f"Rules Service Unavailable. Field has {ctx.stressed_count} stressed plants."

    # 2. Call Water Prediction (Python/LSTM)
    lstm_data = None
    try:
        resp = requests.post(PREVISION_SERVICE_URL, json=current_weather, timeout=5)
        if resp.status_code == 200:
            lstm_data = resp.json()
    except Exception as e:
        print(f"Prediction Service failed: {e}")
        
    # 3. Aggregate Logic
    final_recommendation = rule_recommendation
    if lstm_data:
        final_recommendation = lstm_data.get("recommendation", rule_recommendation)
    
    # If high stress detected by vision, override with urgent
    if ctx.stressed_count > 10:
        final_recommendation = "High stress detected - Urgent action"

    # 4. Store in DB
    if engine:
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO irrigation_plans (zone_id, recommendation, water_amount_mm, source)
                    VALUES (:zone, :rec, :amt, 'AI_Unified')
                """), {
                    "zone": ctx.zone_id,
                    "rec": f"{final_recommendation}: {rule_action}",
                    "amt": lstm_data.get("predicted_water_need_mm", 0.0) if lstm_data else 0.0
                })
                conn.commit()
        except Exception as e:
            print(f"DB Save Failed: {e}")

    return {
        "zone_id": ctx.zone_id,
        "recommendation": final_recommendation,
        "action": rule_action,
        "amount_mm": lstm_data.get("predicted_water_need_mm", 0.0) if lstm_data else 0.0,
        "hours": lstm_data.get("irrigation_hours", 0) if lstm_data else 0,
        "minutes": lstm_data.get("irrigation_minutes", 0) if lstm_data else 0,
        "confidence": lstm_data.get("confidence", 0.5) if lstm_data else 0.5,
        "forecast_days": lstm_data.get("forecast_days", []) if lstm_data else [],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/history")
def get_history(limit: int = 10):
    if engine:
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f"""
                    SELECT id, zone_id, timestamp, recommendation, water_amount_mm, source
                    FROM irrigation_plans
                    ORDER BY timestamp DESC
                    LIMIT {limit}
                """))
                return [dict(row._mapping) for row in result]
        except Exception as e:
            print(f"History fetch error: {e}")
            return []
    return []

@app.get("/health")
def health():
    return {"status": "ok"}
