import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "rf_temp_model.joblib")
METADATA_PATH = os.path.join(BASE_DIR, "model", "model_metadata.json")
DASHBOARD_DATA_PATH = os.path.join(BASE_DIR, "model", "dashboard_data.json")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = FastAPI(
    title="IoT Temperature Monitoring & ML Prediction API",
    description="CRISP-DM driven IoT Analytics and Random Forest Temperature Regression Service",
    version="1.0.0"
)

# Enable CORS for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global cache for loaded model and data
model = None
metadata = {}
dashboard_data = {}

def load_artifacts():
    global model, metadata, dashboard_data
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"[Backend] Random Forest Model loaded successfully from {MODEL_PATH}")
        except Exception as e:
            print(f"[Backend] Error loading model: {e}")

    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r") as f:
                metadata = json.load(f)
            print(f"[Backend] Model metadata loaded successfully")
        except Exception as e:
            print(f"[Backend] Error loading metadata: {e}")

    if os.path.exists(DASHBOARD_DATA_PATH):
        try:
            with open(DASHBOARD_DATA_PATH, "r") as f:
                dashboard_data = json.load(f)
            print(f"[Backend] Dashboard payload loaded successfully")
        except Exception as e:
            print(f"[Backend] Error loading dashboard data: {e}")

load_artifacts()

# Pydantic Schemas for Prediction
class PredictionRequest(BaseModel):
    date_time: Optional[str] = Field(
        default=None, 
        description="ISO timestamp or 'YYYY-MM-DD HH:MM'. Defaults to current local time if omitted."
    )
    is_indoor: int = Field(
        default=1, 
        ge=0, 
        le=1, 
        description="1 for Indoor, 0 for Outdoor"
    )
    temp_lag_1: float = Field(
        default=30.0, 
        ge=-10.0, 
        le=70.0, 
        description="Previous temperature reading in °C"
    )

class PredictionResponse(BaseModel):
    predicted_temp: float
    confidence_interval: dict
    comfort_status: str
    comfort_color: str
    feature_breakdown: dict
    model_name: str
    timestamp: str

def categorize_comfort(temp: float) -> tuple[str, str]:
    if temp < 18.0:
        return "Cold", "#3b82f6"
    elif 18.0 <= temp <= 25.0:
        return "Comfortable / Optimal", "#10b981"
    elif 25.0 < temp <= 32.0:
        return "Warm", "#f59e0b"
    elif 32.0 < temp <= 40.0:
        return "Hot", "#f97316"
    else:
        return "Extreme Heat", "#ef4444"

@app.get("/api/status")
def get_system_status():
    return {
        "status": "online",
        "service": "IoT Temperature Analytics & Predictor API",
        "model_loaded": model is not None,
        "total_records": metadata.get("total_readings", 0),
        "dataset_range": {
            "start": metadata.get("date_min"),
            "end": metadata.get("date_max")
        },
        "server_time": datetime.now().isoformat()
    }

@app.get("/api/stats")
def get_dataset_stats():
    if not metadata:
        raise HTTPException(status_code=500, detail="Metadata not found. Please run train_model.py first.")
    return metadata

@app.get("/api/charts")
def get_chart_data():
    if not dashboard_data:
        raise HTTPException(status_code=500, detail="Dashboard data not found. Please run train_model.py first.")
    return dashboard_data

@app.post("/api/predict", response_model=PredictionResponse)
def predict_temperature(req: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded. Ensure rf_temp_model.joblib exists.")

    # Parse datetime
    if req.date_time:
        try:
            # Handle ISO or standard formats
            dt_str = req.date_time.replace("T", " ")
            if len(dt_str) > 16:
                dt_str = dt_str[:16]
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        except ValueError:
            dt = datetime.now()
    else:
        dt = datetime.now()

    hour = dt.hour
    day = dt.day
    month = dt.month
    day_of_week = dt.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    is_indoor = req.is_indoor
    hour_sin = float(np.sin(2 * np.pi * hour / 24.0))
    hour_cos = float(np.cos(2 * np.pi * hour / 24.0))
    temp_lag_1 = float(req.temp_lag_1)

    feature_cols = ['hour', 'day', 'month', 'day_of_week', 'is_weekend', 'is_indoor', 'hour_sin', 'hour_cos', 'temp_lag_1']
    input_row = pd.DataFrame([[
        hour, day, month, day_of_week, is_weekend, is_indoor, hour_sin, hour_cos, temp_lag_1
    ]], columns=feature_cols)

    try:
        pred_val = float(model.predict(input_row)[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    # Approximate confidence interval using test RMSE (from metadata or default ~3.98)
    rf_rmse = metadata.get("model_comparison", {}).get("Random Forest Regressor", {}).get("RMSE", 3.98)
    conf_low = round(pred_val - rf_rmse, 2)
    conf_high = round(pred_val + rf_rmse, 2)

    status, color = categorize_comfort(pred_val)

    return PredictionResponse(
        predicted_temp=round(pred_val, 2),
        confidence_interval={"low": conf_low, "high": conf_high, "rmse": rf_rmse},
        comfort_status=status,
        comfort_color=color,
        feature_breakdown={
            "hour": hour,
            "day": day,
            "month": month,
            "day_of_week": day_of_week,
            "is_weekend": bool(is_weekend),
            "is_indoor": bool(is_indoor),
            "hour_sin": round(hour_sin, 4),
            "hour_cos": round(hour_cos, 4),
            "temp_lag_1": temp_lag_1
        },
        model_name="Random Forest Regressor (Optimized)",
        timestamp=dt.strftime("%Y-%m-%d %H:%M")
    )

@app.get("/api/simulated-reading")
def get_simulated_reading(location: str = Query(default="Indoor")):
    """Generate a realistic live IoT sensor reading with predicted next step."""
    now = datetime.now()
    is_indoor = 1 if location == "Indoor" else 0
    base_temp = 30.5 if is_indoor == 1 else 36.3
    hour = now.hour

    # Diurnal variation: peak around 14:00, trough around 04:00
    diurnal_shift = 3.5 * np.sin(2 * np.pi * (hour - 8) / 24.0)
    noise = np.random.normal(0, 0.8)
    simulated_temp = round(base_temp + diurnal_shift + noise, 2)

    # Predict next reading using current simulated reading as lag_1
    feature_cols = ['hour', 'day', 'month', 'day_of_week', 'is_weekend', 'is_indoor', 'hour_sin', 'hour_cos', 'temp_lag_1']
    next_hour = (hour + 1) % 24
    input_row = pd.DataFrame([[
        next_hour, now.day, now.month, now.weekday(), 1 if now.weekday() >= 5 else 0,
        is_indoor, np.sin(2 * np.pi * next_hour / 24.0), np.cos(2 * np.pi * next_hour / 24.0), simulated_temp
    ]], columns=feature_cols)

    pred_next = round(float(model.predict(input_row)[0]), 2) if model else simulated_temp

    return {
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "location": location,
        "is_indoor": is_indoor,
        "current_temp": simulated_temp,
        "predicted_next_hour_temp": pred_next,
        "status": categorize_comfort(simulated_temp)[0]
    }

# Serve frontend static assets if directory exists
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
