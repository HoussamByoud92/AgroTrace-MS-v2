from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text
import requests
import os
import time

app = FastAPI()

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
    temperature: float
    soil_moisture: float
    crop_type: str = "Generic"
    
    # Extra fields for PrevisionEau... simplified for demo adoption
    fips: str = "00000"
    elevation: float = 100.0
    SQ1: float = 70.0 # High quality soil default

@app.post("/recommendation")
def calculate_recommendation(ctx: CropContext):
    reco_details = []
    
    # 1. Call Rules Engine (Java/Drools)
    rule_recommendation = "Unknown"
    try:
        rule_payload = {
            "temperature": ctx.temperature,
            "soilMoisture": ctx.soil_moisture,
            "cropType": ctx.crop_type
        }
        resp = requests.post(RULES_SERVICE_URL, json=rule_payload, timeout=5)
        if resp.status_code == 200:
            rule_recommendation = resp.json().get("recommendation", "Standard")
            reco_details.append(f"Rules: {rule_recommendation}")
    except Exception as e:
        print(f"Rules Service failed: {e}")
        reco_details.append("Rules Service Unavailable")

    # 2. Call Water Prediction (Python/Timescale)
    predicted_need_mm = 0.0
    try:
        # Construct payload matching PrevisionEau requirements
        pred_payload = {
            "fips": ctx.fips,
            "lat": ctx.lat,
            "lon": ctx.lon,
            "elevation": ctx.elevation,
            "SQ1": ctx.SQ1,
            "CULT_IR_LAND": 100.0 # Assume this zone is irrigated land
        }
        resp = requests.post(PREVISION_SERVICE_URL, json=pred_payload, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            predicted_need_mm = data.get("predicted_water_need_mm", 0.0)
            reco_details.append(f"Prediction: {predicted_need_mm}mm needed")
    except Exception as e:
        print(f"Prediction Service failed: {e}")
        reco_details.append("Prediction Service Unavailable")
        
    # 3. Aggregate Logic
    final_amount = predicted_need_mm
    final_action = "Irrigate"
    
    # Logic: Rules can override amount or urgency
    if "Urgent" in rule_recommendation or "Critical" in rule_recommendation:
        final_action = "URGENT IRRIGATION"
        final_amount = max(final_amount, 20.0) # Ensure at least 20mm for urgent cases
    elif "No Irrigation Needed" in rule_recommendation:
        final_action = "Wait"
        final_amount = 0.0
        
    result_text = f"{final_action} ({final_amount}mm). Factors: {'; '.join(reco_details)}"
    
    # 4. Store in DB
    if engine:
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO irrigation_plans (zone_id, recommendation, water_amount_mm, source)
                    VALUES (:zone, :rec, :amt, 'System')
                """), {
                    "zone": ctx.zone_id,
                    "rec": result_text,
                    "amt": final_amount
                })
                conn.commit()
        except Exception as e:
            print(f"DB Save Failed: {e}")

    return {
        "zone_id": ctx.zone_id,
        "recommendation": final_action,
        "amount_mm": final_amount,
        "details": result_text
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
