# ThermoCast: IoT Temperature Monitoring & ML Prediction Dashboard

An end-to-end Machine Learning and IoT Telemetry platform with Light & Dark theme support. The system analyzes ambient room and outdoor temperatures, engineers diurnal circadian & thermal inertia features, benchmarks multiple regression algorithms (Linear Regression, Decision Tree, Random Forest), and serves real-time predictions via an interactive dashboard.

---

## 🚀 Key Features

### 1. 🌓 Light & Dark Mode Theming
- Seamless one-click theme switcher in header (defaults to clean Light Mode with high-contrast typography and adapts all Chart.js color schemes dynamically).

### 2. 📊 Telemetry & Historical Trends
- **Sequential Chrono-Stream**: Interactive time series chart plotting chronological IoT sensor readings with location-based color differentiation.
- **Diurnal Circadian Cycle (24h)**: Hourly mean comparison highlighting solar radiation thermal absorption differences between indoor and outdoor environments.
- **Dynamic KPI Telemetry**: Real-time fleet metrics (97,606 logs validated, ±5.70°C standard deviation, 21% indoor / 79% outdoor split).

### 3. 🤖 Interactive "What-If" AI Predictor
- **Configurable Parameters**: Custom Date & Time picker (extracting hour, day, month, day-of-week, weekend flags, and cyclical sin/cos signals), Sensor Placement toggle, and Previous Temperature Lag (`temp_lag_1`) slider.
- **Quick Scenarios**: One-click presets ("Summer Noon Outdoor 42°C", "AC Office Room 24°C", "Late Night Breeze 28°C").
- **Radial Thermal Dial**: Dynamic gauge displaying predicted temperature, thermal comfort categorization (Optimal, Warm, Hot, Extreme Heat), and 95% confidence intervals based on model RMSE.

### 4. ⚖️ Multi-Model Regression Benchmark
- **Side-by-Side Algorithm Comparison** on an unseen 20% chronological test partition (19,522 records):
  - **Linear Regression**: MAE: 3.54°C | RMSE: 4.76°C | R²: 0.2149
  - **Decision Tree Regressor (Depth=12)**: MAE: 2.96°C | RMSE: 4.59°C | R²: 0.2677
  - **Random Forest Regressor (Champion)**: **MAE: 2.65°C | RMSE: 3.99°C | R²: 0.4479**
- **Feature Importance Analysis**: Gini-impurity reduction ranking, demonstrating the dominant 84.3% influence of thermal inertia (`temp_lag_1`).

### 5. 🗄️ Sensor Data Explorer
- Searchable and paginated table of raw IoT logs with classification tags and one-click CSV export.

---

## 📂 Project Architecture

```
dashboard IoT/
├── backend/
│   ├── app.py             # FastAPI REST service & static asset mounting
│   └── train_model.py     # CRISP-DM training, data cleaning & feature engineering
├── data/
│   └── IOT-temp.csv       # IoT sensor readings dataset (97,606 rows)
├── frontend/
│   ├── index.html         # Modern dark-glassmorphism dashboard
│   ├── style.css          # Design system, CSS variables & animations
│   └── app.js             # Real-time state management, Chart.js & API bridge
├── model/
│   ├── rf_temp_model.joblib # Serialized Random Forest model artifact
│   ├── model_metadata.json  # Model comparison metrics & stats
│   └── dashboard_data.json  # Chart payloads & chronological samples
├── run.py                 # One-click startup runner
└── README.md
```

---

## 🛠️ How to Run

### Option 1: Run via the launcher script
```powershell
python run.py
```

### Option 2: Run directly with Uvicorn
```powershell
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

Once started, open your web browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**
