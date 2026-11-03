import type { Config } from '@netlify/functions';
import metadata from '../../model/model_metadata.json' with { type: 'json' };
import dashboard from '../../model/dashboard_data.json' with { type: 'json' };
import { predict, comfort } from '../lib/predict.mts';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = path === '/api/predict' ? 'POST' : 'GET';
  if (!['/api/status', '/api/stats', '/api/charts', '/api/predict', '/api/simulated-reading'].includes(path)) {
    return Response.json({ detail: 'Endpoint not found' }, { status: 404 });
  }
  if (request.method !== method) {
    return Response.json({ detail: 'Method not allowed' }, { status: 405, headers: { Allow: method } });
  }
  if (path === '/api/stats') return Response.json(metadata);
  if (path === '/api/charts') return Response.json(dashboard);
  if (path === '/api/status') {
    return Response.json({
      status: 'online', service: 'IoT Temperature Analytics & Predictor API', model_loaded: true,
      total_records: metadata.total_readings,
      dataset_range: { start: metadata.date_min, end: metadata.date_max }, server_time: new Date().toISOString(),
    });
  }
  if (path === '/api/simulated-reading') {
    const location = url.searchParams.get('location') || 'Indoor';
    if (!['Indoor', 'Outdoor'].includes(location)) return invalid('location must be Indoor or Outdoor');
    const now = new Date();
    const isIndoor = location === 'Indoor' ? 1 : 0;
    const current = Number(((isIndoor ? 30.5 : 36.3) +
      3.5 * Math.sin(2 * Math.PI * (now.getUTCHours() - 8) / 24) + (Math.random() - 0.5) * 1.6).toFixed(2));
    const next = predict(new Date(now.getTime() + 3600000), isIndoor, current);
    return Response.json({ timestamp: now.toISOString(), location, is_indoor: isIndoor,
      current_temp: current, predicted_next_hour_temp: next.predicted_temp, status: comfort(current)[0], simulated: true });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ detail: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Expected a JSON object');
  const indoor = body.is_indoor ?? 1;
  const lag = body.temp_lag_1 ?? 30;
  if (indoor !== 0 && indoor !== 1) return invalid('is_indoor must be 0 or 1');
  if (typeof lag !== 'number' || !Number.isFinite(lag) || lag < -10 || lag > 70) {
    return invalid('temp_lag_1 must be a number between -10 and 70');
  }
  let date = new Date();
  if (body.date_time != null) {
    if (typeof body.date_time !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(body.date_time)) {
      return invalid('date_time must use YYYY-MM-DD HH:MM');
    }
    const normalized = body.date_time.replace(' ', 'T');
    date = new Date(`${normalized}:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== normalized) return invalid('Invalid date_time');
  }
  return Response.json(predict(date, indoor, lag));
}

function invalid(detail: string) { return Response.json({ detail }, { status: 422 }); }

export const config: Config = { path: '/api/*' };
