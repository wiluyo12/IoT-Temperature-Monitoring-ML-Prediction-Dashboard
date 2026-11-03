How to Run

powershell => python run.py

## Deploy the dashboard to Netlify

`netlify.toml` sets the publish directory to `frontend`, which contains
`index.html`, `style.css`, and `app.js`. No frontend build command is needed.
Redeploy after changing this configuration so the dashboard is served at `/`.

This publishes the dashboard interface only. The Python FastAPI server is not
started by a static Netlify deploy. To enable backend data and model predictions
for visitors, host the Python backend on a Python-compatible service and update
`API_BASE` in `frontend/app.js` to its HTTPS URL. The current localhost address
works only when the backend is running on the visitor's own computer.
