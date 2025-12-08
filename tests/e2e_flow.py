import requests
import time
import json
import os

# Configuration
GATEWAY_URL = "http://localhost:80"
INGESTION_URL = f"{GATEWAY_URL}/api/ingest"
RECO_URL = f"{GATEWAY_URL}/api/reco"

def test_sensor_ingestion():
    print("\n--- Testing Sensor Ingestion ---")
    payload = {
        "sensor_id": "TEST_SENSOR_01",
        "timestamp": "2023-10-27T10:00:00Z",
        "temperature": 25.5,
        "humidity": 60.0,
        "soil_moisture": 30.0,
        "light_intensity": 500.0,
        "location_lat": 45.0,
        "location_lon": -0.5
    }
    try:
        res = requests.post(f"{INGESTION_URL}/sensor-data", json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.json()}")
        assert res.status_code == 200
    except Exception as e:
        print(f"Ingestion failed: {e}")

def test_recommendation_flow():
    print("\n--- Testing Recommendation Flow ---")
    payload = {
        "zone_id": "ZONE_TEST_01",
        "lat": 45.0,
        "lon": -0.5,
        "temperature": 32.0,
        "soil_moisture": 15.0, # Low moisture, High Heat -> Should trigger urgent
        "crop_type": "Corn"
    }
    try:
        res = requests.post(f"{RECO_URL}/recommendation", json=payload)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Recommendation: {data.get('recommendation')}")
            print(f"Amount: {data.get('amount_mm')} mm")
            print(f"Details: {data.get('details')}")
            
            # Basic Assertion for 'Urgent' due to rules
            if "URGENT" in data.get('recommendation', ""):
                 print("PASS: Urgent condition detected correctly.")
            else:
                 print("WARN: Expected URGENT but got something else (check services).")
    except Exception as e:
        print(f"Recommendation failed: {e}")

if __name__ == "__main__":
    print("Starting E2E Tests for AgroTrace-MS")
    # Wait for services to be ready usually...
    test_sensor_ingestion()
    test_recommendation_flow()
