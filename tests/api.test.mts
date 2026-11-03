import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mts';
import cases from './python-predictions.json' with { type: 'json' };

function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return handler(new Request(`https://thermocast.example/api/${path}`, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  }));
}

test('Node predictions match the trained Python forest for dates, locations and lag boundaries', async () => {
  for (const { expected, ...input } of cases) {
    const res = await request('predict', input);
    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.predicted_temp, expected, JSON.stringify(input));
    assert.ok(result.confidence_interval.low <= expected);
    assert.ok(result.confidence_interval.high >= expected);
  }
});

test('dashboard and health endpoints serve the actual artifacts', async () => {
  const status = await (await request('status')).json();
  assert.equal(status.model_loaded, true);
  const stats = await (await request('stats')).json();
  assert.equal(stats.total_readings, 97606);
  const charts = await (await request('charts')).json();
  assert.ok(charts.recent_series.length > 0);
  assert.equal(charts.hourly_averages.indoor.length, 24);
  assert.deepEqual(charts.stats, stats);
});

test('invalid payloads and methods return clear errors', async () => {
  for (const body of [null, [], { temp_lag_1: 71 }, { temp_lag_1: '30' },
    { is_indoor: 2 }, { date_time: 'invalid' }, { date_time: '2026-02-30 12:00' }]) {
    assert.equal((await request('predict', body)).status, 422);
  }
  assert.equal((await request('predict')).status, 405);
  assert.equal((await request('stats', {})).status, 405);
  assert.equal((await request('missing')).status, 404);
  assert.equal((await handler(new Request('https://thermocast.example/api/predict', { method: 'POST', body: '{' }))).status, 400);
});

test('simulation supplies a finite prediction and explicitly identifies simulated data', async () => {
  const res = await request('simulated-reading?location=Outdoor');
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.simulated, true);
  assert.equal(result.is_indoor, 0);
  assert.ok(Number.isFinite(result.predicted_next_hour_temp));
});
