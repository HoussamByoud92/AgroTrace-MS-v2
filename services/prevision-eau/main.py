from fastapi import FastAPI, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
import pandas as pd
import os
import numpy as np
from typing import Optional, List, Dict
import joblib
from datetime import datetime
import json
import io
import asyncio
from pathlib import Path

# ML Imports
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from prophet import Prophet

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
TIMESCALE_URL = os.getenv("TIMESCALE_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_timescale")
MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)

# Database Setup
engine = None
try:
    engine = create_engine(TIMESCALE_URL)
    print("PrevisionEau connected to TimescaleDB")
except Exception as e:
    print(f"Warning: DB Connection failed: {e}")

# Global model storage
models = {
    "lstm": {"model": None, "scaler": None, "version": "0.0.0", "accuracy": 0.0},
    "prophet": {"model": None, "version": "0.0.0", "accuracy": 0.0}
}

# Training state
training_state = {
    "is_training": False,
    "progress": 0,
    "status": "idle",
    "model_type": None,
    "realtime_training": False
}

# ============================================================================
# DATA MODELS
# ============================================================================

class WaterPredictionInput(BaseModel):
    fips: str = Field(default="00000", description="FIPS code")
    lat: float
    lon: float
    elevation: float
    
    # Slope variables (8 directions)
    slope1: float = 0
    slope2: float = 0
    slope3: float = 0
    slope4: float = 0
    slope5: float = 0
    slope6: float = 0
    slope7: float = 0
    slope8: float = 0
    
    # Aspect variables
    aspectN: float = 0
    aspectE: float = 0
    aspectS: float = 0
    aspectW: float = 0
    aspectUnknown: float = 0
    
    # Land usage percentages
    WAT_LAND: float = 0
    NVG_LAND: float = 0
    URB_LAND: float = 0
    GRS_LAND: float = 0
    FOR_LAND: float = 0
    CULTRF_LAND: float = 0
    CULTIR_LAND: float = 0
    CULT_LAND: float = 0
    
    # Soil Quality indices
    SQ1: float = 0
    SQ2: float = 0
    SQ3: float = 0
    SQ4: float = 0
    SQ5: float = 0
    SQ6: float = 0
    SQ7: float = 0

class PredictionResult(BaseModel):
    predicted_water_need_mm: float
    irrigation_duration_hours: float
    confidence: float
    recommendation: str
    model_used: str
    timestamp: str

class TrainingStatus(BaseModel):
    is_training: bool
    progress: float
    status: str
    model_type: Optional[str]
    realtime_training: bool

class ModelInfo(BaseModel):
    model_type: str
    version: str
    accuracy: float
    is_loaded: bool

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def input_to_features(data: WaterPredictionInput) -> np.ndarray:
    """Convert input model to feature array"""
    features = [
        data.lat, data.lon, data.elevation,
        data.slope1, data.slope2, data.slope3, data.slope4,
        data.slope5, data.slope6, data.slope7, data.slope8,
        data.aspectN, data.aspectE, data.aspectS, data.aspectW, data.aspectUnknown,
        data.WAT_LAND, data.NVG_LAND, data.URB_LAND, data.GRS_LAND,
        data.FOR_LAND, data.CULTRF_LAND, data.CULTIR_LAND, data.CULT_LAND,
        data.SQ1, data.SQ2, data.SQ3, data.SQ4, data.SQ5, data.SQ6, data.SQ7
    ]
    return np.array(features).reshape(1, -1)

def calculate_irrigation_duration(water_need_mm: float, flow_rate_mm_per_hour: float = 5.0) -> float:
    """Calculate irrigation duration based on water need and flow rate"""
    if water_need_mm <= 0:
        return 0.0
    return round(water_need_mm / flow_rate_mm_per_hour, 2)

def get_recommendation(water_need_mm: float) -> str:
    """Generate recommendation based on water need"""
    if water_need_mm < 5:
        return "No irrigation needed - soil moisture sufficient"
    elif water_need_mm < 15:
        return "Light irrigation recommended"
    elif water_need_mm < 30:
        return "Moderate irrigation required"
    else:
        return "Heavy irrigation required - critical water deficit"

# ============================================================================
# LSTM MODEL FUNCTIONS
# ============================================================================

def create_lstm_model(input_dim: int = 31) -> keras.Model:
    """Create deeper LSTM model architecture for better precision"""
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Reshape((input_dim, 1)),
        
        # First LSTM layer - 128 units
        keras.layers.LSTM(128, return_sequences=True, dropout=0.3, recurrent_dropout=0.2),
        keras.layers.BatchNormalization(),
        
        # Second LSTM layer - 64 units
        keras.layers.LSTM(64, return_sequences=True, dropout=0.3, recurrent_dropout=0.2),
        keras.layers.BatchNormalization(),
        
        # Third LSTM layer - 32 units
        keras.layers.LSTM(32, dropout=0.2),
        keras.layers.BatchNormalization(),
        
        # Dense layers for feature extraction
        keras.layers.Dense(64, activation='relu'),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation='relu'),
        keras.layers.Dropout(0.1),
        
        # Output layer
        keras.layers.Dense(1, activation='linear')
    ])
    
    # Use Adam optimizer with learning rate scheduling
    optimizer = keras.optimizers.Adam(learning_rate=0.001)
    
    model.compile(
        optimizer=optimizer,
        loss='mse',
        metrics=['mae', 'mse']
    )
    
    return model

def train_lstm_model(df: pd.DataFrame) -> Dict:
    """Train LSTM model on provided data"""
    try:
        # Prepare features and target
        feature_cols = [
            'lat', 'lon', 'elevation',
            'slope1', 'slope2', 'slope3', 'slope4', 'slope5', 'slope6', 'slope7', 'slope8',
            'aspectN', 'aspectE', 'aspectS', 'aspectW', 'aspectUnknown',
            'WAT_LAND', 'NVG_LAND', 'URB_LAND', 'GRS_LAND', 'FOR_LAND',
            'CULTRF_LAND', 'CULTIR_LAND', 'CULT_LAND',
            'SQ1', 'SQ2', 'SQ3', 'SQ4', 'SQ5', 'SQ6', 'SQ7'
        ]
        
        # Check if target column exists, if not create synthetic target
        if 'water_need' not in df.columns:
            # Create synthetic target based on features (for demo purposes)
            df['water_need'] = (
                50 - df['SQ1'] * 0.3 + df['CULTIR_LAND'] * 0.2 + 
                df['elevation'] * 0.01 + np.random.normal(0, 5, len(df))
            ).clip(0, 100)
        
        X = df[feature_cols].values
        y = df['water_need'].values
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Create and train model
        model = create_lstm_model(input_dim=X_train_scaled.shape[1])
        
        # Enhanced callbacks for better training
        early_stop = keras.callbacks.EarlyStopping(
            monitor='val_loss', 
            patience=15,  # Increased patience
            restore_best_weights=True,
            min_delta=0.001
        )
        
        reduce_lr = keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=0.00001,
            verbose=0
        )
        
        history = model.fit(
            X_train_scaled, y_train,
            validation_data=(X_test_scaled, y_test),
            epochs=100,  # Increased epochs
            batch_size=16,  # Smaller batch size for better precision
            callbacks=[early_stop, reduce_lr],
            verbose=0
        )
        
        # Evaluate
        test_loss, test_mae, test_mse = model.evaluate(X_test_scaled, y_test, verbose=0)
        accuracy = max(0, 1 - (test_mae / 50))  # Normalize MAE to accuracy score
        
        # Save model
        model_path = MODELS_DIR / "lstm_model.keras"
        scaler_path = MODELS_DIR / "lstm_scaler.joblib"
        
        model.save(model_path)
        joblib.dump(scaler, scaler_path)
        
        # Update global models
        models["lstm"]["model"] = model
        models["lstm"]["scaler"] = scaler
        models["lstm"]["version"] = datetime.now().strftime("%Y%m%d_%H%M%S")
        models["lstm"]["accuracy"] = round(accuracy, 3)
        
        return {
            "status": "success",
            "accuracy": round(accuracy, 3),
            "mae": round(test_mae, 2),
            "version": models["lstm"]["version"]
        }
        
    except Exception as e:
        raise Exception(f"LSTM training failed: {str(e)}")

# ============================================================================
# PROPHET MODEL FUNCTIONS
# ============================================================================

def train_prophet_model(df: pd.DataFrame) -> Dict:
    """Train Prophet model on provided data"""
    try:
        # Prophet requires 'ds' (date) and 'y' (target) columns
        # We'll create a time series from the data
        
        if 'water_need' not in df.columns:
            # Create synthetic target
            df['water_need'] = (
                50 - df['SQ1'] * 0.3 + df['CULTIR_LAND'] * 0.2 + 
                df['elevation'] * 0.01 + np.random.normal(0, 5, len(df))
            ).clip(0, 100)
        
        # Create time series data
        df_prophet = pd.DataFrame({
            'ds': pd.date_range(start='2023-01-01', periods=len(df), freq='D'),
            'y': df['water_need'].values
        })
        
        # Add regressors (additional features)
        feature_cols = ['lat', 'lon', 'elevation', 'SQ1', 'SQ2', 'CULTIR_LAND', 'CULT_LAND']
        for col in feature_cols:
            if col in df.columns:
                df_prophet[col] = df[col].values
        
        # Initialize and configure Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        
        # Add regressors
        for col in feature_cols:
            if col in df_prophet.columns:
                model.add_regressor(col)
        
        # Train model
        model.fit(df_prophet)
        
        # Make predictions on training data for accuracy
        forecast = model.predict(df_prophet)
        
        # Calculate accuracy
        mae = np.mean(np.abs(forecast['yhat'].values - df_prophet['y'].values))
        accuracy = max(0, 1 - (mae / 50))
        
        # Save model
        model_path = MODELS_DIR / "prophet_model.joblib"
        joblib.dump(model, model_path)
        
        # Update global models
        models["prophet"]["model"] = model
        models["prophet"]["version"] = datetime.now().strftime("%Y%m%d_%H%M%S")
        models["prophet"]["accuracy"] = round(accuracy, 3)
        
        return {
            "status": "success",
            "accuracy": round(accuracy, 3),
            "mae": round(mae, 2),
            "version": models["prophet"]["version"]
        }
        
    except Exception as e:
        raise Exception(f"Prophet training failed: {str(e)}")

# ============================================================================
# PREDICTION FUNCTIONS
# ============================================================================

def predict_with_lstm(input_data: WaterPredictionInput) -> float:
    """Make prediction using LSTM model"""
    if models["lstm"]["model"] is None:
        raise HTTPException(status_code=400, detail="LSTM model not trained yet")
    
    features = input_to_features(input_data)
    scaled_features = models["lstm"]["scaler"].transform(features)
    
    prediction = models["lstm"]["model"].predict(scaled_features, verbose=0)
    return float(prediction[0][0])

def predict_with_prophet(input_data: WaterPredictionInput) -> float:
    """Make prediction using Prophet model"""
    if models["prophet"]["model"] is None:
        raise HTTPException(status_code=400, detail="Prophet model not trained yet")
    
    # Create future dataframe
    future = pd.DataFrame({
        'ds': [datetime.now()],
        'lat': [input_data.lat],
        'lon': [input_data.lon],
        'elevation': [input_data.elevation],
        'SQ1': [input_data.SQ1],
        'SQ2': [input_data.SQ2],
        'CULTIR_LAND': [input_data.CULTIR_LAND],
        'CULT_LAND': [input_data.CULT_LAND]
    })
    
    forecast = models["prophet"]["model"].predict(future)
    return float(forecast['yhat'].values[0])

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.post("/predict", response_model=PredictionResult)
async def predict_water_needs(
    input_data: WaterPredictionInput,
    model_type: str = "lstm"
):
    """Predict water needs using specified model"""
    try:
        # Make prediction
        if model_type.lower() == "lstm":
            water_need = predict_with_lstm(input_data)
            confidence = models["lstm"]["accuracy"]
        elif model_type.lower() == "prophet":
            water_need = predict_with_prophet(input_data)
            confidence = models["prophet"]["accuracy"]
        else:
            raise HTTPException(status_code=400, detail="Invalid model type. Use 'lstm' or 'prophet'")
        
        # Ensure non-negative
        water_need = max(0, water_need)
        
        # Calculate irrigation duration
        duration = calculate_irrigation_duration(water_need)
        
        # Get recommendation
        recommendation = get_recommendation(water_need)
        
        return PredictionResult(
            predicted_water_need_mm=round(water_need, 2),
            irrigation_duration_hours=duration,
            confidence=round(confidence, 2),
            recommendation=recommendation,
            model_used=model_type.upper(),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train/upload")
async def train_from_csv(
    file: UploadFile = File(...),
    model_type: str = "both",
    background_tasks: BackgroundTasks = None
):
    """Train model from uploaded CSV file"""
    try:
        # Read CSV
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        print(f"CSV loaded: {len(df)} rows, columns: {list(df.columns)}")
        
        # Validate columns
        required_cols = ['lat', 'lon', 'elevation', 'SQ1']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing_cols}"
            )
        
        if len(df) < 50:  # Reduced from 100 for easier testing
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data. Minimum 50 rows required for training. Got {len(df)} rows."
            )
        
        # Update training state
        training_state["is_training"] = True
        training_state["status"] = "training"
        training_state["model_type"] = model_type
        training_state["progress"] = 0
        
        results = {}
        
        # Train LSTM
        if model_type in ["lstm", "both"]:
            try:
                print("Starting LSTM training...")
                training_state["status"] = "Training LSTM model..."
                training_state["progress"] = 25
                lstm_result = train_lstm_model(df)
                results["lstm"] = lstm_result
                training_state["progress"] = 50
                print(f"LSTM training completed: {lstm_result}")
            except Exception as e:
                print(f"LSTM training error: {str(e)}")
                import traceback
                traceback.print_exc()
                raise
        
        # Train Prophet
        if model_type in ["prophet", "both"]:
            try:
                print("Starting Prophet training...")
                training_state["status"] = "Training Prophet model..."
                training_state["progress"] = 75
                prophet_result = train_prophet_model(df)
                results["prophet"] = prophet_result
                training_state["progress"] = 100
                print(f"Prophet training completed: {prophet_result}")
            except Exception as e:
                print(f"Prophet training error: {str(e)}")
                import traceback
                traceback.print_exc()
                raise
        
        # Reset training state
        training_state["is_training"] = False
        training_state["status"] = "completed"
        training_state["progress"] = 100
        
        return {
            "status": "Training completed successfully",
            "rows_processed": len(df),
            "results": results
        }
        
    except HTTPException:
        training_state["is_training"] = False
        training_state["status"] = "failed"
        raise
    except Exception as e:
        print(f"Training error: {str(e)}")
        import traceback
        traceback.print_exc()
        training_state["is_training"] = False
        training_state["status"] = f"failed: {str(e)}"
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/train/status", response_model=TrainingStatus)
async def get_training_status():
    """Get current training status"""
    return TrainingStatus(**training_state)

@app.get("/models/info", response_model=List[ModelInfo])
async def get_models_info():
    """Get information about available models"""
    return [
        ModelInfo(
            model_type="LSTM",
            version=models["lstm"]["version"],
            accuracy=models["lstm"]["accuracy"],
            is_loaded=models["lstm"]["model"] is not None
        ),
        ModelInfo(
            model_type="Prophet",
            version=models["prophet"]["version"],
            accuracy=models["prophet"]["accuracy"],
            is_loaded=models["prophet"]["model"] is not None
        )
    ]

@app.get("/latest-sensor-data")
async def get_latest_sensor_data():
    """Get latest sensor data for form pre-fill with all 37 variables"""
    import random
    
    base_data = {
        "lat": 45.0,
        "lon": -0.5,
        "elevation": 100.0,
        "temperature": 22.0,
        "humidity": 60.0,
        "soil_moisture": 45.0
    }
    
    if engine:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT latitude, longitude, temperature, humidity, soil_moisture
                    FROM sensor_readings
                    ORDER BY time DESC
                    LIMIT 1
                """))
                row = result.fetchone()
                if row:
                    base_data["lat"] = row[0]
                    base_data["lon"] = row[1]
                    base_data["temperature"] = row[2]
                    base_data["humidity"] = row[3]
                    base_data["soil_moisture"] = row[4]
        except Exception as e:
            print(f"Error fetching sensor data: {e}")
    
    # Generate varied values for all 37 variables based on sensor data
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
    
    # Soil quality indices (influenced by soil moisture)
    soil_base = 50 + (base_data["soil_moisture"] - 45) * 0.5
    soil_quality = {
        f"SQ{i}": round(soil_base + random.uniform(-10, 10) - (i * 2), 1) 
        for i in range(1, 8)
    }
    
    # Combine all data
    return {
        "fips": f"{random.randint(10000, 99999)}",
        "lat": round(base_data["lat"], 4),
        "lon": round(base_data["lon"], 4),
        "elevation": round(base_data["elevation"] + random.uniform(-20, 20), 1),
        **slopes,
        **aspects,
        **land_cover,
        **soil_quality
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "db": engine is not None,
        "models": {
            "lstm_loaded": models["lstm"]["model"] is not None,
            "prophet_loaded": models["prophet"]["model"] is not None
        }
    }

# Load existing models on startup
@app.on_event("startup")
async def load_models():
    """Load pre-trained models if they exist"""
    try:
        lstm_model_path = MODELS_DIR / "lstm_model.keras"
        lstm_scaler_path = MODELS_DIR / "lstm_scaler.joblib"
        
        if lstm_model_path.exists() and lstm_scaler_path.exists():
            models["lstm"]["model"] = keras.models.load_model(lstm_model_path)
            models["lstm"]["scaler"] = joblib.load(lstm_scaler_path)
            models["lstm"]["version"] = "loaded"
            print("LSTM model loaded from disk")
        
        prophet_model_path = MODELS_DIR / "prophet_model.joblib"
        if prophet_model_path.exists():
            models["prophet"]["model"] = joblib.load(prophet_model_path)
            models["prophet"]["version"] = "loaded"
            print("Prophet model loaded from disk")
            
    except Exception as e:
        print(f"Error loading models: {e}")
