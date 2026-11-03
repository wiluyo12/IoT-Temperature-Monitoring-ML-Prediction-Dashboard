import os
import sys
import subprocess

def main():
    print("=" * 65)
    print("ThermoCast: IoT Temperature Monitoring & ML Prediction Service")
    print("=" * 65)
    
    # Check if model exists, if not run train_model.py
    model_path = os.path.join("model", "rf_temp_model.joblib")
    if not os.path.exists(model_path):
        print("[!] Model file not found. Running training pipeline...")
        subprocess.run([sys.executable, os.path.join("backend", "train_model.py")], check=True)
    
    print("\n[+] Starting FastAPI Web Server at http://127.0.0.1:8000 ...")
    print("[+] Dashboard accessible directly in your web browser.")
    print("=" * 65)
    
    import uvicorn
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
