from fastapi import FastAPI, HTTPException, BackgroundTasks
import requests
from datetime import datetime, timedelta
import os
import pandas as pd
import random
import time
import asyncio
from typing import Optional

app = FastAPI()

# Configuration
DEFAULT_LAT = 33.57
DEFAULT_LON = -7.59
SAMPLE_DATA_PATH = "/app/data/sample_training_data.csv"
if not os.path.exists(SAMPLE_DATA_PATH):
    # Fallback for local development or if volume mapping is different
    SAMPLE_DATA_PATH = os.path.abspath(os.path.join(os.getcwd(), "../../sample_training_data.csv"))

# Simulation State
class SimulationManager:
    def __init__(self):
        self.is_active = False
        self.latest_data = None
        self.task = None

    async def run_simulation(self):
        try:
            df = pd.read_csv(SAMPLE_DATA_PATH)
            while self.is_active:
                # Pick a random row
                idx = random.randint(0, len(df) - 1)
                row = df.iloc[idx].to_dict()
                
                # Add timestamp and sensor_id for realism
                row["timestamp"] = datetime.now().isoformat()
                row["sensor_id"] = f"SENSOR_{random.randint(100, 999)}"
                
                # In a real system, we'd send to Kafka here
                # For this demo, we'll just keep the 'latest' in memory
                # and maybe push to TimescaleDB if needed by other services.
                self.latest_data = row
                
                # Log it (for the frontend to see)
                print(f"SIMULATION: {row['sensor_id']} emitted data")
                
                await asyncio.sleep(1) # Emit every second as requested
        except Exception as e:
            print(f"Simulation Error: {e}")
            self.is_active = False

sim_manager = SimulationManager()

@app.get("/forecast/15min")
def get_15min_forecast():
    """
    Keep original functionality for dashboard weather widget
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": DEFAULT_LAT,
            "longitude": DEFAULT_LON,
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,soil_moisture_1_to_3cm",
            "timezone": "auto",
            "forecast_days": 2
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Open-Meteo API Error")
            
        data = response.json()
        hourly = data.get("hourly", {})
        h_times = hourly.get("time", [])
        h_temps = hourly.get("temperature_2m", [])
        h_hums = hourly.get("relative_humidity_2m", [])
        h_winds = hourly.get("wind_speed_10m", [])
        h_soils = hourly.get("soil_moisture_1_to_3cm", [])
        
        if not h_times:
            raise HTTPException(status_code=500, detail="No hourly data returned from API")

        def interpolate_var(target_iso, var_list):
            target_dt = datetime.fromisoformat(target_iso)
            for i in range(len(h_times) - 1):
                t0_dt = datetime.fromisoformat(h_times[i])
                t1_dt = datetime.fromisoformat(h_times[i+1])
                if t0_dt <= target_dt <= t1_dt:
                    v0, v1 = var_list[i], var_list[i+1]
                    if v0 is None or v1 is None: return v0 or v1
                    total_sec = (t1_dt - t0_dt).total_seconds()
                    offset_sec = (target_dt - t0_dt).total_seconds()
                    if total_sec == 0: return v0
                    weight = offset_sec / total_sec
                    return round(v0 + weight * (v1 - v0), 2)
            return var_list[0] if var_list else None

        start_time = datetime.fromisoformat(h_times[0])
        formatted_data = []
        for i in range(12):
            point_dt = start_time + timedelta(hours=2 * i)
            point_iso = point_dt.isoformat().replace('+00:00', '') 
            formatted_data.append({
                "time": point_iso,
                "temperature": interpolate_var(point_iso, h_temps),
                "humidity": interpolate_var(point_iso, h_hums),
                "wind_speed": interpolate_var(point_iso, h_winds),
                "soil_moisture": interpolate_var(point_iso, h_soils),
                "source": "Open-Meteo (Interpolated)"
            })
        return formatted_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate/start")
async def start_simulation(background_tasks: BackgroundTasks):
    if sim_manager.is_active:
        return {"message": "Simulation already running"}
    sim_manager.is_active = True
    background_tasks.add_task(sim_manager.run_simulation)
    return {"message": "Simulation started"}

@app.post("/simulate/stop")
def stop_simulation():
    sim_manager.is_active = False
    return {"message": "Simulation stopped"}

@app.get("/simulate/status")
def get_simulate_status():
    return {"is_active": sim_manager.is_active}

@app.get("/simulate/generate-full")
def get_simulated_data(count: int = 1):
    """
    Returns the latest simulated data points. 
    In a real app, this would fetch from a buffer or database.
    """
    if not sim_manager.latest_data:
        return []
    return [sim_manager.latest_data for _ in range(count)]

@app.get("/latest-sensor-data")
def get_latest_sensor_data():
    """
    Endpoint used by WaterPrediction page
    """
    if not sim_manager.latest_data:
        # Return a Default from CSV if none emitted yet
        try:
            df = pd.read_csv(SAMPLE_DATA_PATH)
            return df.iloc[0].to_dict()
        except:
            return {"lat": DEFAULT_LAT, "lon": DEFAULT_LON, "elevation": 0}
    return sim_manager.latest_data

@app.get("/health")
def health_check():
    return {"status": "ok", "mode": "simulation-active" if sim_manager.is_active else "idle"}
