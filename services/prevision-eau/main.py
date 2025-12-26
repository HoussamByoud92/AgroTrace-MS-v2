from fastapi import FastAPI, HTTPException, Body, UploadFile, File, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
try:
    import jwt
except ImportError:
    jwt = None
    print("WARNING: 'jwt' module not found. Authentication will fail.")
import pandas as pd
import os
import numpy as np
from typing import Optional, List, Dict
import joblib
from datetime import datetime, timedelta
import json
import io
import asyncio
from pathlib import Path
import py_eureka_client.eureka_client as eureka_client

# ML Imports
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")

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
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey")
ALGORITHM = "HS256"
MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)

# Database Setup
engine = None
SessionLocal = None
Base = declarative_base()
security = HTTPBearer(auto_error=False)

try:
    engine = create_engine(TIMESCALE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print("PrevisionEau connected to TimescaleDB")
except Exception as e:
    print(f"Warning: DB Connection failed: {e}")

# User Models Table
class UserModel(Base):
    __tablename__ = "user_models"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    model_type = Column(String(50), nullable=False)
    version = Column(String(50))
    accuracy = Column(Float)
    trained_at = Column(DateTime, default=datetime.now)
    file_path = Column(String(255))
    rows_processed = Column(Integer)

# Create tables
if engine:
    Base.metadata.create_all(bind=engine)

# Database dependency
def get_db():
    if not SessionLocal:
        raise HTTPException(status_code=500, detail="Database not available")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# JWT verification
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user info (optional)"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        username: str = payload.get("sub")
        if user_id is None:
            return None
        return {"user_id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        return None

# Global model storage
models = {
    "lstm": {"model": None, "scaler": None, "version": "0.0.0", "accuracy": 0.0}
}

# Training state
training_state = {
    "is_training": False,
    "progress": 0,
    "status": "idle",
    "model_type": None
}

# ============================================================================
# DATA MODELS
# ============================================================================

class WaterPredictionInput(BaseModel):
    temperature: float = Field(description="Temperature in Celsius")
    humidity: float = Field(description="Relative humidity %")
    pressure: float = Field(description="Atmospheric pressure in mbar")
    wind_speed: float = Field(description="Wind speed in m/s")
    dew_point: float = Field(description="Dew point temperature in Celsius")

class PredictionResult(BaseModel):
    predicted_water_need_mm: float
    irrigation_duration_hours: float
    irrigation_hours: int = 0
    irrigation_minutes: int = 0
    confidence: float
    recommendation: str
    model_used: str
    timestamp: str
    forecast_days: List[Dict] = []

class TrainingStatus(BaseModel):
    is_training: bool
    progress: float
    status: str
    model_type: Optional[str]

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
        data.temperature,
        data.humidity,
        data.pressure,
        data.wind_speed,
        data.dew_point
    ]
    return np.array(features).reshape(1, -1)

def calculate_irrigation_duration(water_need_mm: float, flow_rate_mm_per_hour: float = 5.0) -> dict:
    """Calculate irrigation duration based on water need and flow rate, returns hours and minutes"""
    if water_need_mm <= 0:
        return {"hours": 0, "minutes": 0, "total_hours": 0.0}
    total_hours = water_need_mm / flow_rate_mm_per_hour
    hours = int(total_hours)
    minutes = int((total_hours - hours) * 60)
    return {"hours": hours, "minutes": minutes, "total_hours": round(total_hours, 2)}

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

def weather_to_agricultural_features(df: pd.DataFrame) -> pd.DataFrame:
    """Convert weather data to agricultural features for water prediction"""
    # Create synthetic agricultural features based on weather data
    df_agri = df.copy()
    
    # Basic weather features - support both old and new column naming conventions
    # New format: T, rh, p, wv, Tdew
    # Old format: T (degC), rh (%), p (mbar), wv (m/s), Tdew (degC)
    df_agri['temperature'] = df_agri['T'] if 'T' in df_agri.columns else df_agri.get('T (degC)', 20)
    df_agri['humidity'] = df_agri['rh'] if 'rh' in df_agri.columns else df_agri.get('rh (%)', 50)
    df_agri['pressure'] = df_agri['p'] if 'p' in df_agri.columns else df_agri.get('p (mbar)', 1013)
    df_agri['wind_speed'] = df_agri['wv'] if 'wv' in df_agri.columns else df_agri.get('wv (m/s)', 2)
    df_agri['dew_point'] = df_agri['Tdew'] if 'Tdew' in df_agri.columns else df_agri.get('Tdew (degC)', 10)
    
    # Calculate water need based on weather conditions
    # Higher temperature and lower humidity = more water needed
    # Wind speed also increases evapotranspiration
    base_water_need = (
        (df_agri['temperature'] - 10) * 0.8 +  # Temperature effect
        (100 - df_agri['humidity']) * 0.3 +    # Humidity effect (inverted)
        df_agri['wind_speed'] * 2.0 +          # Wind effect
        np.random.normal(0, 3, len(df_agri))   # Natural variation
    )
    
    # Ensure realistic range (0-50mm per day)
    df_agri['water_need'] = np.clip(base_water_need, 0, 50)
    
    return df_agri

# ============================================================================
# LSTM MODEL FUNCTIONS
# ============================================================================

def create_lstm_model(input_dim: int = 5) -> keras.Model:
    """Create LSTM model architecture for water prediction"""
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Reshape((input_dim, 1)),
        
        # LSTM layers
        keras.layers.LSTM(64, return_sequences=True, dropout=0.2),
        keras.layers.LSTM(32, dropout=0.2),
        
        # Dense layers
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(16, activation='relu'),
        keras.layers.Dropout(0.2),
        
        # Output layer
        keras.layers.Dense(1, activation='linear')
    ])
    
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
        # Sample data if too large (for faster training while keeping diversity)
        max_samples = 5000
        if len(df) > max_samples:
            # Sample evenly from entire dataset to capture all seasons/conditions
            sample_indices = np.linspace(0, len(df)-1, max_samples, dtype=int)
            df = df.iloc[sample_indices].reset_index(drop=True)
            print(f"Sampled {max_samples} rows from dataset for training")
        
        # Convert weather data to agricultural features
        df_agri = weather_to_agricultural_features(df)
        
        # Prepare features and target
        feature_cols = ['temperature', 'humidity', 'pressure', 'wind_speed', 'dew_point']
        
        X = df_agri[feature_cols].values
        y = df_agri['water_need'].values
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Create and train model
        model = create_lstm_model(input_dim=X_train_scaled.shape[1])
        
        # Callbacks
        early_stop = keras.callbacks.EarlyStopping(
            monitor='val_loss', 
            patience=10,
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
            epochs=50,
            batch_size=32,
            callbacks=[early_stop, reduce_lr],
            verbose=0
        )
        
        # Evaluate
        test_loss, test_mae, test_mse = model.evaluate(X_test_scaled, y_test, verbose=0)
        accuracy = max(0, 1 - (test_mae / 25))  # Normalize MAE to accuracy score
        
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

def generate_forecast(input_data: WaterPredictionInput, days: int = 3) -> List[Dict]:
    """Generate multi-day forecast"""
    if models["lstm"]["model"] is None:
        return []
    
    forecast = []
    current_temp = input_data.temperature
    current_humidity = input_data.humidity
    
    for day in range(1, days + 1):
        # Simulate weather variation
        temp_variation = np.random.normal(0, 2)
        humidity_variation = np.random.normal(0, 5)
        
        forecast_input = WaterPredictionInput(
            temperature=current_temp + temp_variation,
            humidity=max(0, min(100, current_humidity + humidity_variation)),
            pressure=input_data.pressure + np.random.normal(0, 2),
            wind_speed=max(0, input_data.wind_speed + np.random.normal(0, 0.5)),
            dew_point=input_data.dew_point + temp_variation * 0.7
        )
        
        water_need = predict_with_lstm(forecast_input)
        water_need = max(0, water_need)
        
        duration = calculate_irrigation_duration(water_need)
        forecast.append({
            "day": day,
            "date": (datetime.now() + timedelta(days=day)).strftime("%Y-%m-%d"),
            "water_need_mm": round(water_need, 2),
            "irrigation_hours": duration["hours"],
            "irrigation_minutes": duration["minutes"],
            "irrigation_total": duration["total_hours"],
            "recommendation": get_recommendation(water_need),
            "temperature": round(forecast_input.temperature, 1),
            "humidity": round(forecast_input.humidity, 1)
        })
    
    return forecast

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.post("/predict", response_model=PredictionResult)
async def predict_water_needs(input_data: WaterPredictionInput):
    """Predict water needs using LSTM model"""
    try:
        # Make prediction
        water_need = predict_with_lstm(input_data)
        confidence = models["lstm"]["accuracy"]
        
        # Ensure non-negative
        water_need = max(0, water_need)
        
        # Calculate irrigation duration
        duration = calculate_irrigation_duration(water_need)
        
        # Get recommendation
        recommendation = get_recommendation(water_need)
        
        # Generate 7-day forecast
        forecast = generate_forecast(input_data, days=7)
        
        return PredictionResult(
            predicted_water_need_mm=round(water_need, 2),
            irrigation_duration_hours=duration["total_hours"],
            irrigation_hours=duration["hours"],
            irrigation_minutes=duration["minutes"],
            confidence=round(confidence, 2),
            recommendation=recommendation,
            model_used="LSTM",
            timestamp=datetime.now().isoformat(),
            forecast_days=forecast
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train")
async def train_model():
    """Train model using the data.csv file"""
    try:
        # Check if data.csv exists
        data_path = Path("/app/data.csv")
        if not data_path.exists():
            raise HTTPException(status_code=404, detail="data.csv not found")
        
        # Update training state
        training_state["is_training"] = True
        training_state["status"] = "loading data"
        training_state["progress"] = 10
        
        # Read CSV
        df = pd.read_csv(data_path)
        print(f"CSV loaded: {len(df)} rows, columns: {list(df.columns)}")
        
        if len(df) < 100:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data. Minimum 100 rows required for training. Got {len(df)} rows."
            )
        
        training_state["status"] = "training LSTM model"
        training_state["progress"] = 50
        
        # Train LSTM
        result = train_lstm_model(df)
        
        training_state["is_training"] = False
        training_state["status"] = "completed"
        training_state["progress"] = 100
        
        return {
            "status": "Training completed successfully",
            "rows_processed": len(df),
            "result": result
        }
        
    except HTTPException:
        training_state["is_training"] = False
        training_state["status"] = "failed"
        raise
    except Exception as e:
        print(f"Training error: {str(e)}")
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
        )
    ]

@app.get("/random-sensor-data")
async def get_random_sensor_data():
    """Get random sensor data from data.csv for simulation"""
    try:
        data_path = Path("/app/data.csv")
        if not data_path.exists():
            # Return default data if file doesn't exist
            return {
                "temperature": 22.0,
                "humidity": 60.0,
                "pressure": 1013.25,
                "wind_speed": 2.5,
                "dew_point": 15.0
            }
        
        # Read CSV and get random row
        df = pd.read_csv(data_path)
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="No data available")
        
        # Get random row
        random_row = df.sample(n=1).iloc[0]
        
        # Support both old and new column formats
        temp_col = 'T' if 'T' in df.columns else 'T (degC)'
        rh_col = 'rh' if 'rh' in df.columns else 'rh (%)'
        p_col = 'p' if 'p' in df.columns else 'p (mbar)'
        wv_col = 'wv' if 'wv' in df.columns else 'wv (m/s)'
        tdew_col = 'Tdew' if 'Tdew' in df.columns else 'Tdew (degC)'
        
        return {
            "temperature": float(random_row[temp_col]),
            "humidity": float(random_row[rh_col]),
            "pressure": float(random_row[p_col]),
            "wind_speed": float(random_row[wv_col]),
            "dew_point": float(random_row[tdew_col])
        }
        
    except Exception as e:
        print(f"Error getting random sensor data: {e}")
        # Return default data on error
        return {
            "temperature": 22.0,
            "humidity": 60.0,
            "pressure": 1013.25,
            "wind_speed": 2.5,
            "dew_point": 15.0
        }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "db": engine is not None,
        "models": {
            "lstm_loaded": models["lstm"]["model"] is not None
        }
    }

@app.on_event("startup")
async def load_models():
    """Load pre-trained models if they exist, otherwise train on startup"""
    # Register with Eureka
    try:
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name="prevision-eau",
            instance_port=8000,
            instance_host="prevision-eau"
        )
        print("Registered with Eureka")
    except Exception as e:
        print(f"Failed to register with Eureka: {e}")
    
    try:
        lstm_model_path = MODELS_DIR / "lstm_model.keras"
        lstm_scaler_path = MODELS_DIR / "lstm_scaler.joblib"
        
        if lstm_model_path.exists() and lstm_scaler_path.exists():
            models["lstm"]["model"] = keras.models.load_model(lstm_model_path)
            models["lstm"]["scaler"] = joblib.load(lstm_scaler_path)
            models["lstm"]["version"] = "loaded"
            models["lstm"]["accuracy"] = 0.85  # Default accuracy for loaded model
            print("LSTM model loaded from disk")
        else:
            # Try to train model on startup if data.csv exists
            data_path = Path("/app/data.csv")
            if data_path.exists():
                print("No pre-trained model found. Training on startup...")
                try:
                    df = pd.read_csv(data_path)
                    if len(df) >= 100:
                        result = train_lstm_model(df)
                        print(f"Model trained on startup: {result}")
                    else:
                        print(f"Insufficient data for training: {len(df)} rows")
                except Exception as e:
                    print(f"Failed to train model on startup: {e}")
            else:
                print("No data.csv found for training")
            
    except Exception as e:
        print(f"Error during startup: {e}")