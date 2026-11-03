import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

def main():
    print("=" * 60)
    print("CRISP-DM PIPELINE: IOT TEMPERATURE REGRESSION")
    print("=" * 60)

    # 1. DATA UNDERSTANDING & LOADING
    data_path = os.path.join("data", "IOT-temp.csv")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}")

    print(f"[1/5] Loading data from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Total raw records: {len(df):,}")
    print(f"Columns: {list(df.columns)}")

    # 2. DATA PREPARATION
    print("\n[2/5] Cleaning and feature engineering...")
    
    # Standardize column names (strip whitespace)
    df.columns = [c.strip() for c in df.columns]

    # Handle datetime
    # Format in dataset is typically DD-MM-YYYY HH:MM or similar
    df['noted_date'] = pd.to_datetime(df['noted_date'], format='%d-%m-%Y %H:%M', errors='coerce')
    
    # Drop rows with null dates or null temps
    df = df.dropna(subset=['noted_date', 'temp']).copy()

    # Sort chronologically
    df = df.sort_values('noted_date').reset_index(drop=True)

    # Filter physical outliers for IoT room/outdoor temp (reasonable range: 10°C to 60°C)
    initial_count = len(df)
    df = df[(df['temp'] >= 10) & (df['temp'] <= 60)].copy()
    print(f"Filtered {initial_count - len(df)} outlier readings. Valid records: {len(df):,}")

    # Extract time features
    df['hour'] = df['noted_date'].dt.hour
    df['day'] = df['noted_date'].dt.day
    df['month'] = df['noted_date'].dt.month
    df['day_of_week'] = df['noted_date'].dt.dayofweek # 0=Monday, 6=Sunday
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

    # Encode out/in: 'In' -> 1, 'Out' -> 0
    # Clean whitespace or uppercase
    df['out_in_clean'] = df['out/in'].astype(str).str.strip().str.capitalize()
    df['is_indoor'] = (df['out_in_clean'] == 'In').astype(int)

    # Cyclical hour encoding (useful for continuous circadian cycles)
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24.0)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24.0)

    # Lag feature: previous reading temp
    df['temp_lag_1'] = df['temp'].shift(1).bfill()

    # Feature matrix & target
    feature_cols = ['hour', 'day', 'month', 'day_of_week', 'is_weekend', 'is_indoor', 'hour_sin', 'hour_cos', 'temp_lag_1']
    X = df[feature_cols]
    y = df['temp']

    print(f"Features used: {feature_cols}")

    # 3. SPLIT DATA (Chronological 80:20 split to avoid data leakage)
    print("\n[3/5] Splitting data (80% Train, 20% Test)...")
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    print(f"Train size: {len(X_train):,}, Test size: {len(X_test):,}")

    # 4. MODELING & COMPARISON
    print("\n[4/5] Training models for comparison...")

    models = {
        "Linear Regression": LinearRegression(),
        "Decision Tree Regressor": DecisionTreeRegressor(max_depth=12, random_state=42),
        "Random Forest Regressor": RandomForestRegressor(n_estimators=100, max_depth=14, min_samples_split=5, random_state=42, n_jobs=-1)
    }

    results = {}
    for name, model in models.items():
        print(f"  Training {name}...")
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        
        mae = float(mean_absolute_error(y_test, preds))
        mse = float(mean_squared_error(y_test, preds))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test, preds))
        
        results[name] = {
            "MAE": round(mae, 4),
            "MSE": round(mse, 4),
            "RMSE": round(rmse, 4),
            "R2": round(r2, 4)
        }
        print(f"    -> MAE: {mae:.4f} °C | RMSE: {rmse:.4f} °C | R²: {r2:.4f}")

    # Best model is Random Forest Regressor
    rf_model = models["Random Forest Regressor"]
    feature_importance = dict(zip(feature_cols, [round(float(imp), 4) for imp in rf_model.feature_importances_]))

    # 5. EXPORT MODEL & METADATA
    print("\n[5/5] Exporting model & metadata...")
    os.makedirs("model", exist_ok=True)
    model_path = os.path.join("model", "rf_temp_model.joblib")
    joblib.dump(rf_model, model_path)
    print(f"Model saved to {model_path}")

    # Overall dataset statistics for dashboard API
    stats = {
        "total_readings": int(len(df)),
        "avg_temp": round(float(df['temp'].mean()), 2),
        "min_temp": round(float(df['temp'].min()), 2),
        "max_temp": round(float(df['temp'].max()), 2),
        "std_temp": round(float(df['temp'].std()), 2),
        "indoor_count": int((df['is_indoor'] == 1).sum()),
        "outdoor_count": int((df['is_indoor'] == 0).sum()),
        "indoor_avg_temp": round(float(df[df['is_indoor'] == 1]['temp'].mean()), 2),
        "outdoor_avg_temp": round(float(df[df['is_indoor'] == 0]['temp'].mean()), 2),
        "date_min": df['noted_date'].min().strftime('%Y-%m-%d %H:%M'),
        "date_max": df['noted_date'].max().strftime('%Y-%m-%d %H:%M'),
        "model_comparison": results,
        "feature_importance": feature_importance,
        "features": feature_cols
    }

    metadata_path = os.path.join("model", "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Metadata saved to {metadata_path}")

    # Prepare sampled lightweight time series for dashboard charts (last 200 chronological points)
    sample_df = df.tail(150)[['noted_date', 'temp', 'is_indoor', 'hour']]
    sample_series = []
    for _, row in sample_df.iterrows():
        sample_series.append({
            "timestamp": row['noted_date'].strftime('%Y-%m-%d %H:%M'),
            "temp": round(float(row['temp']), 2),
            "location": "Indoor" if row['is_indoor'] == 1 else "Outdoor",
            "hour": int(row['hour'])
        })
    
    # Also calculate average temp by hour for indoor vs outdoor
    hourly_in = df[df['is_indoor'] == 1].groupby('hour')['temp'].mean().round(2).to_dict()
    hourly_out = df[df['is_indoor'] == 0].groupby('hour')['temp'].mean().round(2).to_dict()

    dashboard_data = {
        "stats": stats,
        "recent_series": sample_series,
        "hourly_averages": {
            "indoor": [hourly_in.get(h, 0.0) for h in range(24)],
            "outdoor": [hourly_out.get(h, 0.0) for h in range(24)],
            "hours": [f"{h:02d}:00" for h in range(24)]
        }
    }

    dashboard_data_path = os.path.join("model", "dashboard_data.json")
    with open(dashboard_data_path, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"Dashboard data payload saved to {dashboard_data_path}")
    print("\nTraining and pipeline execution completed successfully!")

if __name__ == "__main__":
    main()
