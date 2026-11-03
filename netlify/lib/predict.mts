import forest from '../../model/rf_netlify.json' with { type: 'json' };
import metadata from '../../model/model_metadata.json' with { type: 'json' };

export function predict(date: Date, isIndoor: number, lag: number) {
  // A datetime-local input has no timezone: the handler interprets its calendar fields as UTC.
  const hour = date.getUTCHours();
  const weekday = (date.getUTCDay() + 6) % 7;
  const features = [hour, date.getUTCDate(), date.getUTCMonth() + 1, weekday,
    weekday >= 5 ? 1 : 0, isIndoor, Math.sin(2 * Math.PI * hour / 24),
    Math.cos(2 * Math.PI * hour / 24), lag];
  // sklearn converts feature values to float32 before traversing its trees.
  const input = features.map(Math.fround);
  const value = forest.trees.reduce((sum, tree) => {
    let node = 0;
    while (tree.left[node] !== -1) {
      node = input[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    }
    return sum + tree.value[node];
  }, 0) / forest.trees.length;
  const rmse = metadata.model_comparison['Random Forest Regressor'].RMSE;
  const [status, color] = comfort(value);
  return {
    predicted_temp: round(value),
    confidence_interval: { low: round(value - rmse), high: round(value + rmse), rmse },
    comfort_status: status,
    comfort_color: color,
    feature_breakdown: {
      hour, day: features[1], month: features[2], day_of_week: weekday,
      is_weekend: weekday >= 5, is_indoor: Boolean(isIndoor),
      hour_sin: Number(features[6].toFixed(4)), hour_cos: Number(features[7].toFixed(4)), temp_lag_1: lag,
    },
    model_name: 'Random Forest Regressor (Optimized)',
    timestamp: date.toISOString().slice(0, 16).replace('T', ' '),
  };
}

export function comfort(value: number): [string, string] {
  if (value < 18) return ['Cold', '#3b82f6'];
  if (value <= 25) return ['Comfortable / Optimal', '#10b981'];
  if (value <= 32) return ['Warm', '#f59e0b'];
  if (value <= 40) return ['Hot', '#f97316'];
  return ['Extreme Heat', '#ef4444'];
}

function round(value: number) { return Number(value.toFixed(2)); }
