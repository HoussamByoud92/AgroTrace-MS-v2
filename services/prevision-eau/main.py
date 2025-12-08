from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
import pandas as pd
import os
import numpy as np
from typing import Optional

app = FastAPI()

# Config
TIMESCALE_URL = os.getenv("TIMESCALE_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_timescale")

# Database Setup
engine = None
try:
    engine = create_engine(TIMESCALE_URL)
    print("PrevisionEau connected to TimescaleDB")
except Exception as e:
    print(f"Warning: DB Connection failed: {e}")

# Data Model
class WaterPredictionInput(BaseModel):
    fips: str = Field(..., description="FIPS code")
    lat: float
    lon: float
    elevation: float
    
    # Land Cover / Topography Variables
    slope1: float = 0
    slope2: float = 0
    slope3: float = 0
    slope4: float = 0
    slope5: float = 0
    slope6: float = 0
    slope7: float = 0
    slope8: float = 0
    
    aspectN: float = 0
    aspectNE: float = 0
    aspectE: float = 0
    aspectSE: float = 0
    aspectS: float = 0
    aspectSW: float = 0
    aspectW: float = 0
    aspectNW: float = 0
    
    # Land usage percentages
    WAT_LAND: float = 0
    NVG_LAND: float = 0
    URB_LAND: float = 0
    GRS_LAND: float = 0
    FOR_LAND: float = 0
    CULT_LAND: float = 0
    CULT_IR_LAND: float = 0
    CULT_RAIN_LAND: float = 0
    
    # Soil Quality
    SQ1: float = 0
    SQ2: float = 0
    SQ3: float = 0
    SQ4: float = 0
    SQ5: float = 0
    SQ6: float = 0
    SQ7: float = 0

class PredictionResult(BaseModel):
    predicted_water_need_mm: float
    confidence: float
    recommendation: str

@app.post("/predict", response_model=PredictionResult)
def predict_water_needs(input_data: WaterPredictionInput):
    # 1. Fetch historical weather context (Mocked query)
    avg_temp_last_7d = 25.0
    total_rain_last_7d = 10.0
    
    if engine:
        try:
            with engine.connect() as conn:
                # Example: get avg temp for this location (approximated)
                pass 
                # res = conn.execute(text("SELECT avg(temperature) ..."))
        except Exception as e:
            print(f"DB Query failed: {e}")

    # 2. Heuristic Logic (Mocking the LSTM/Prophet model)
    # Higher slope -> more runoff -> less water retained -> need more water? Or fewer crops?
    # Let's assume prediction is "Irrigation Need in mm"
    
    base_need = 50.0 # Base need for generic crop
    
    # Adjust based on soil (SQ1 = high quality, holds water? Just valid assumption)
    soil_factor = 1.0 - (input_data.SQ1 * 0.01) # If SQ1 is high, reduce need
    
    # Adjust based on land type
    if input_data.CULT_IR_LAND > 50:
        base_need += 20 # High irrigation land
        
    final_need = base_need * soil_factor - total_rain_last_7d
    final_need = max(0.0, final_need)
    
    # Simple formatting
    rec = "Irrigation Recommended" if final_need > 10 else "No Action Needed"
    
    return {
        "predicted_water_need_mm": round(final_need, 2),
        "confidence": 0.85,
        "recommendation": rec
    }

@app.get("/health")
def health():
    return {"status": "ok", "db": engine is not None}
