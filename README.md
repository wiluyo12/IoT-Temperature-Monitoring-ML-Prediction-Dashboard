# ThermoCast

## Netlify

`netlify.toml` publishes `frontend/` as the site root. No frontend build command is required. Netlify deploys the TypeScript API in `netlify/functions/` alongside the static dashboard. All browser API requests use the same domain, including Deploy Previews.

The production branch is `main`. Merge changes into `main` to update the production site; opening a pull request creates a preview only.

The API serves the existing historical dataset and runs the trained 100-tree Random Forest in Node.js. `model/rf_netlify.json` is an export of the original sklearn model, preserving tree thresholds and leaf predictions. It does not retrain or approximate the model. The prediction range is ± test RMSE, not a calibrated 95% confidence interval.

After retraining with `python backend/train_model.py`, run `python backend/export_netlify_model.py` using the same Python environment and commit the updated model artifacts together. Python needs scikit-learn, joblib, pandas and numpy for this export; Python is not required on Netlify.

Run `npm install`, `npm test` and `npm run typecheck` to verify the Netlify API. To preview locally with functions, run `netlify dev --port 8889`.

## Original Python server

With FastAPI, uvicorn, pandas, numpy, scikit-learn and joblib installed, run `python run.py`. The dashboard also uses same-origin API requests with this server.
