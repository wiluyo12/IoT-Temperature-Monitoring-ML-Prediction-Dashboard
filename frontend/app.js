/**
 * ThermoCast - IoT Temperature Monitoring & ML Prediction System
 * Interactive Application Engine & Chart Manager
 */

// API Configuration
const API_BASE = '';

// State Management
const state = {
  stats: null,
  dashboardData: null,
  charts: {},
  logCurrentPage: 1,
  logPageSize: 15,
  logSearchTerm: '',
  allLogs: []
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initClock();
  initTabs();
  initPresets();
  initFormControls();

  // Set default datetime to now
  const dtInput = document.getElementById('inputDateTime');
  if (dtInput) {
    const now = new Date();
    dtInput.value = now.toISOString().slice(0, 16);
  }

  // Load backend data or fallback
  await loadDashboardData();
  
  // Initial prediction compute
  submitPrediction();
});

/* ==========================================================================
   Theme Management (Light / Dark Mode)
   ========================================================================== */
window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = current === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
};

function getChartThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    gridColor: isLight ? 'rgba(148, 163, 184, 0.22)' : 'rgba(255, 255, 255, 0.05)',
    textColor: isLight ? '#475569' : '#94a3b8',
    headingColor: isLight ? '#0f172a' : '#f8fafc',
    tooltipBg: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.95)',
    tooltipText: isLight ? '#0f172a' : '#f8fafc',
    tooltipBorder: isLight ? 'rgba(148, 163, 184, 0.4)' : 'rgba(6, 182, 212, 0.4)'
  };
}

function initTheme() {
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('thermocast_theme') || 'light';
  } catch (err) {
    savedTheme = 'light';
  }
  applyTheme(savedTheme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.onclick = window.toggleTheme;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) {
    document.body.setAttribute('data-theme', theme);
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(theme + '-theme');
  }

  try {
    localStorage.setItem('thermocast_theme', theme);
  } catch (err) {
    console.warn('localStorage not accessible:', err);
  }

  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleText');
  if (icon && label) {
    if (theme === 'light') {
      icon.className = 'fa-solid fa-moon';
      label.textContent = 'Dark Mode';
    } else {
      icon.className = 'fa-solid fa-sun';
      label.textContent = 'Light Mode';
    }
  }

  updateAllChartsTheme();
}

function updateAllChartsTheme() {
  const colors = getChartThemeColors();
  
  Object.values(state.charts).forEach(chart => {
    if (!chart || !chart.options) return;
    
    // Update scales
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        if (chart.options.scales.x.grid && chart.options.scales.x.grid.display !== false) {
          chart.options.scales.x.grid.color = colors.gridColor;
        }
        if (chart.options.scales.x.ticks) {
          chart.options.scales.x.ticks.color = colors.textColor;
        }
      }
      if (chart.options.scales.y) {
        if (chart.options.scales.y.grid && chart.options.scales.y.grid.display !== false) {
          chart.options.scales.y.grid.color = colors.gridColor;
        }
        if (chart.options.scales.y.ticks) {
          chart.options.scales.y.ticks.color = colors.textColor;
        }
      }
    }
    
    // Update tooltip
    if (chart.options.plugins?.tooltip) {
      chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
      chart.options.plugins.tooltip.titleColor = colors.tooltipText;
      chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
      chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
    }

    // Update legend
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = colors.textColor;
    }

    try {
      chart.update();
    } catch (err) {
      console.warn('Chart update error:', err);
    }
  });
}

// Immediate theme execution
initTheme();

/* ==========================================================================
   Clock & Ticker
   ========================================================================== */
function initClock() {
  const clockEl = document.getElementById('clockDisplay');
  function update() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    if (clockEl) {
      clockEl.querySelector('.clock-time').textContent = timeStr;
      clockEl.querySelector('.clock-date').textContent = dateStr;
    }
  }
  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   Navigation Tabs
   ========================================================================== */
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // Resize charts when switching tabs
      Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    });
  });
}

/* ==========================================================================
   Data Fetching & Pipeline Initialization
   ========================================================================== */
async function loadDashboardData() {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch(`${API_BASE}/api/stats`);
    if (!statsRes.ok) throw new Error(`Stats API returned ${statsRes.status}`);
    if (statsRes.ok) {
      state.stats = await statsRes.json();
      populateKPIs(state.stats);
    }

    // 2. Fetch Charts Payload
    const chartsRes = await fetch(`${API_BASE}/api/charts`);
    if (!chartsRes.ok) throw new Error(`Charts API returned ${chartsRes.status}`);
    if (chartsRes.ok) {
      state.dashboardData = await chartsRes.json();
      renderCharts(state.dashboardData);
      initSensorLogs(state.dashboardData.recent_series || []);
    }
  } catch (err) {
    console.warn('API connection failed or local static preview. Loading embedded baseline telemetry...', err);
    loadFallbackData();
  }
}

function loadFallbackData() {
  // Graceful fallback from metadata.json defaults
  const fallbackStats = {
    total_readings: 97606,
    avg_temp: 35.05,
    min_temp: 21.0,
    max_temp: 51.0,
    std_temp: 5.7,
    indoor_count: 20345,
    outdoor_count: 77261,
    indoor_avg_temp: 30.45,
    outdoor_avg_temp: 36.27,
    date_min: "2018-07-28 07:06",
    date_max: "2018-12-08 09:30",
    model_comparison: {
      "Linear Regression": { "MAE": 3.5443, "RMSE": 4.7559, "R2": 0.2149 },
      "Decision Tree Regressor": { "MAE": 2.9637, "RMSE": 4.5931, "R2": 0.2677 },
      "Random Forest Regressor": { "MAE": 2.6533, "RMSE": 3.9883, "R2": 0.4479 }
    },
    feature_importance: {
      "hour": 0.0029,
      "day": 0.0265,
      "month": 0.0331,
      "day_of_week": 0.0063,
      "is_weekend": 0.0007,
      "is_indoor": 0.0799,
      "hour_sin": 0.0022,
      "hour_cos": 0.0051,
      "temp_lag_1": 0.8432
    }
  };

  populateKPIs(fallbackStats);
  state.stats = fallbackStats;

  // Generate synthetic recent time points for offline preview
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const indoorHourly = [27.2, 26.8, 26.5, 26.3, 26.4, 27.1, 28.5, 30.1, 31.8, 33.2, 34.0, 34.5, 34.8, 34.2, 33.5, 32.7, 31.5, 30.2, 29.3, 28.8, 28.2, 27.9, 27.5, 27.3];
  const outdoorHourly = [31.5, 30.8, 30.2, 29.8, 30.1, 32.0, 34.5, 37.2, 39.8, 41.5, 42.6, 43.1, 42.8, 41.7, 40.2, 38.5, 36.8, 35.1, 34.0, 33.2, 32.8, 32.4, 32.0, 31.8];

  const recentSeries = [];
  const baseTime = new Date('2018-12-08T09:30:00');
  for (let i = 100; i >= 0; i--) {
    const t = new Date(baseTime.getTime() - i * 600000); // 10 min steps
    const isInd = Math.random() > 0.4;
    const hour = t.getHours();
    const temp = isInd 
      ? +(indoorHourly[hour] + (Math.random() * 2 - 1)).toFixed(2)
      : +(outdoorHourly[hour] + (Math.random() * 2.5 - 1.25)).toFixed(2);
    recentSeries.push({
      timestamp: t.toISOString().replace('T', ' ').slice(0, 16),
      temp: temp,
      location: isInd ? 'Indoor' : 'Outdoor',
      hour: hour
    });
  }

  const fallbackDashboard = {
    stats: fallbackStats,
    recent_series: recentSeries,
    hourly_averages: {
      indoor: indoorHourly,
      outdoor: outdoorHourly,
      hours: hours
    }
  };

  state.dashboardData = fallbackDashboard;
  renderCharts(fallbackDashboard);
  initSensorLogs(recentSeries);
}

/* ==========================================================================
   KPI Population
   ========================================================================== */
function populateKPIs(stats) {
  if (!stats) return;

  document.getElementById('valTotalReadings').textContent = Number(stats.total_readings).toLocaleString();
  document.getElementById('valAvgTemp').innerHTML = `${stats.avg_temp}<span class="kpi-unit">°C</span>`;
  document.getElementById('valStdTemp').textContent = `±${stats.std_temp}°C`;
  document.getElementById('valMinMaxRange').textContent = `${stats.min_temp}° – ${stats.max_temp}°C`;

  document.getElementById('valIndoorAvg').textContent = `${stats.indoor_avg_temp}°C`;
  document.getElementById('valOutdoorAvg').textContent = `${stats.outdoor_avg_temp}°C`;
  const diff = (stats.outdoor_avg_temp - stats.indoor_avg_temp).toFixed(2);
  document.getElementById('valGradientDiff').textContent = `+${diff}°C`;

  const total = stats.indoor_count + stats.outdoor_count;
  const inPct = Math.round((stats.indoor_count / total) * 100);
  const outPct = 100 - inPct;
  document.getElementById('valCounts').textContent = `${inPct}% In / ${outPct}% Out`;

  const rfMetrics = stats.model_comparison?.["Random Forest Regressor"] || {};
  if (rfMetrics.MAE) {
    document.getElementById('valRfMae').innerHTML = `${rfMetrics.MAE}<span class="kpi-unit">°C MAE</span>`;
    document.getElementById('valRfRmse').textContent = `${rfMetrics.RMSE} °C`;
  }

  if (stats.date_min && stats.date_max) {
    document.getElementById('kpiDateRange').textContent = `${stats.date_min.split(' ')[0]} – ${stats.date_max.split(' ')[0]}`;
  }
}

/* ==========================================================================
   Chart.js Rendering
   ========================================================================== */
function renderCharts(data) {
  renderTimeSeriesChart(data.recent_series || []);
  renderDiurnalChart(data.hourly_averages);
  renderModelComparisonChart(data.stats?.model_comparison);
  renderFeatureImportanceChart(data.stats?.feature_importance);
}

// 1. Time Series Chronological Chart
function renderTimeSeriesChart(series, filter = 'all') {
  const ctx = document.getElementById('timeSeriesChart');
  if (!ctx) return;

  let filtered = series;
  if (filter === 'Indoor') {
    filtered = series.filter(s => s.location === 'Indoor');
  } else if (filter === 'Outdoor') {
    filtered = series.filter(s => s.location === 'Outdoor');
  }

  const labels = filtered.map(s => s.timestamp.slice(5)); // MM-DD HH:MM
  const temps = filtered.map(s => s.temp);
  const pointBgColors = filtered.map(s => s.location === 'Indoor' ? '#10b981' : '#f59e0b');
  const themeColors = getChartThemeColors();

  if (state.charts.timeSeries) {
    state.charts.timeSeries.data.labels = labels;
    state.charts.timeSeries.data.datasets[0].data = temps;
    state.charts.timeSeries.data.datasets[0].pointBackgroundColor = pointBgColors;
    state.charts.timeSeries.update();
    return;
  }

  state.charts.timeSeries = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Recorded Temp (°C)',
        data: temps,
        borderColor: '#06b6d4',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: pointBgColors,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          return gradient;
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          titleFont: { family: 'Outfit', size: 13, weight: '600' },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: themeColors.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const item = filtered[ctx.dataIndex];
              return ` Temperature: ${ctx.parsed.y} °C [${item?.location || 'IoT Node'}]`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 11 }, callback: v => `${v}°C` }
        }
      }
    }
  });

  // Filter Buttons
  const filterBtns = document.querySelectorAll('#chartFilterGroup .pill-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTimeSeriesChart(series, btn.getAttribute('data-filter'));
    });
  });
}

// 2. Diurnal Circadian Hourly Curve Chart
function renderDiurnalChart(hourly) {
  const ctx = document.getElementById('diurnalChart');
  if (!ctx || !hourly) return;

  if (state.charts.diurnal) {
    state.charts.diurnal.destroy();
  }

  const themeColors = getChartThemeColors();

  state.charts.diurnal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hourly.hours,
      datasets: [
        {
          label: 'Outdoor Ambient',
          data: hourly.outdoor,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 2,
          fill: true
        },
        {
          label: 'Indoor Room',
          data: hourly.indoor,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: themeColors.textColor, font: { family: 'Inter', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          borderColor: themeColors.tooltipBorder,
          padding: 10,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}°C` }
        }
      }
    }
  });
}

// 3. Model Benchmark Bar Chart
function renderModelComparisonChart(comparison) {
  const ctx = document.getElementById('modelComparisonChart');
  if (!ctx || !comparison) return;

  const models = Object.keys(comparison);
  const maeData = models.map(m => comparison[m].MAE);
  const rmseData = models.map(m => comparison[m].RMSE);
  const r2Data = models.map(m => comparison[m].R2 * 10); // Scaled for visual comparison

  if (state.charts.benchmark) {
    state.charts.benchmark.destroy();
  }

  const themeColors = getChartThemeColors();

  state.charts.benchmark = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: models,
      datasets: [
        {
          label: 'MAE (°C) - Lower is better',
          data: maeData,
          backgroundColor: 'rgba(6, 182, 212, 0.8)',
          borderRadius: 6
        },
        {
          label: 'RMSE (°C) - Lower is better',
          data: rmseData,
          backgroundColor: 'rgba(244, 63, 94, 0.8)',
          borderRadius: 6
        },
        {
          label: 'R² Score (x10) - Higher is better',
          data: r2Data,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: themeColors.textColor, font: { family: 'Inter', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          borderColor: themeColors.tooltipBorder,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: themeColors.textColor, font: { family: 'Outfit', size: 11, weight: '500' } }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

// 4. Feature Importance Horizontal Bar Chart
function renderFeatureImportanceChart(importances) {
  const ctx = document.getElementById('featureImportanceChart');
  if (!ctx || !importances) return;

  // Sort descending
  const sorted = Object.entries(importances).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const values = sorted.map(s => Math.round(s[1] * 1000) / 10); // in percent %

  if (state.charts.featureImportance) {
    state.charts.featureImportance.destroy();
  }

  const themeColors = getChartThemeColors();

  state.charts.featureImportance = new Chart(ctx, {
    type: 'bar',
    indexAxis: 'y',
    data: {
      labels: labels,
      datasets: [{
        label: 'Importance (%)',
        data: values,
        backgroundColor: (ctx) => {
          const idx = ctx.dataIndex;
          if (idx === 0) return '#06b6d4'; // highest
          if (idx === 1) return '#8b5cf6';
          return 'rgba(148, 163, 184, 0.5)';
        },
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          borderColor: themeColors.tooltipBorder,
          callbacks: {
            label: (ctx) => ` Relative Weight: ${ctx.parsed.x}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.textColor, callback: v => `${v}%` }
        },
        y: {
          grid: { display: false },
          ticks: { color: themeColors.textColor, font: { family: 'JetBrains Mono', size: 11 } }
        }
      }
    }
  });
}

/* ==========================================================================
   Tab 2: What-If Predictor Interaction & Engine
   ========================================================================== */
function initFormControls() {
  // Slider sync
  const slider = document.getElementById('inputTempLag');
  const bubble = document.getElementById('lagValDisplay');
  if (slider && bubble) {
    slider.addEventListener('input', () => {
      bubble.textContent = `${parseFloat(slider.value).toFixed(1)} °C`;
    });
  }

  // Segmented control (Indoor vs Outdoor)
  const segmentBtns = document.querySelectorAll('#locationSegmented .segment-btn');
  const hiddenInput = document.getElementById('inputIsIndoor');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hiddenInput.value = btn.getAttribute('data-val');
    });
  });

  // Submit handler
  const form = document.getElementById('predictionForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitPrediction();
    });
  }
}

function initPresets() {
  const pills = document.querySelectorAll('.preset-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const type = pill.getAttribute('data-preset');
      const dtInput = document.getElementById('inputDateTime');
      const slider = document.getElementById('inputTempLag');
      const bubble = document.getElementById('lagValDisplay');
      const hiddenInput = document.getElementById('inputIsIndoor');
      const segmentBtns = document.querySelectorAll('#locationSegmented .segment-btn');

      if (type === 'summer-noon') {
        dtInput.value = '2018-08-15T14:00';
        slider.value = 42.0;
        bubble.textContent = '42.0 °C';
        hiddenInput.value = '0'; // Outdoor
        segmentBtns[0].classList.remove('active');
        segmentBtns[1].classList.add('active');
      } else if (type === 'ac-indoor') {
        dtInput.value = '2018-09-10T11:00';
        slider.value = 24.0;
        bubble.textContent = '24.0 °C';
        hiddenInput.value = '1'; // Indoor
        segmentBtns[1].classList.remove('active');
        segmentBtns[0].classList.add('active');
      } else if (type === 'night-breeze') {
        dtInput.value = '2018-10-05T02:30';
        slider.value = 28.0;
        bubble.textContent = '28.0 °C';
        hiddenInput.value = '0'; // Outdoor
        segmentBtns[0].classList.remove('active');
        segmentBtns[1].classList.add('active');
      }

      submitPrediction();
    });
  });
}

async function submitPrediction() {
  const dtVal = document.getElementById('inputDateTime')?.value;
  const isIndoor = parseInt(document.getElementById('inputIsIndoor')?.value || '1');
  const tempLag = parseFloat(document.getElementById('inputTempLag')?.value || '30.0');

  const payload = {
    date_time: dtVal ? dtVal.replace('T', ' ') : null,
    is_indoor: isIndoor,
    temp_lag_1: tempLag
  };

  // Button loading state
  const btn = document.getElementById('btnSubmitPredict');
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Computing RF Regression...</span>`;
    btn.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const result = await res.json();
      displayPredictionResult(result);
    } else {
      // In-browser mathematical simulation fallback
      computeLocalInference(payload);
    }
  } catch (err) {
    computeLocalInference(payload);
  } finally {
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-sparkles"></i> <span>Compute AI Temperature Prediction</span>`;
      btn.disabled = false;
    }
  }
}

function displayPredictionResult(res) {
  const valEl = document.getElementById('resultPredictedTemp');
  const badgeEl = document.getElementById('resultComfortBadge');
  const confEl = document.getElementById('resultConfInterval');
  const deltaEl = document.getElementById('resultDeltaAvg');
  const dialEl = document.getElementById('gaugeDial');
  const chipsEl = document.getElementById('featureChips');

  if (valEl) {
    valEl.innerHTML = `${res.predicted_temp.toFixed(2)}<span class="gauge-unit">°C</span>`;
  }

  if (badgeEl) {
    badgeEl.textContent = res.comfort_status;
    badgeEl.style.color = res.comfort_color;
    badgeEl.style.borderColor = res.comfort_color;
    badgeEl.style.background = `${res.comfort_color}25`;
  }

  if (confEl && res.confidence_interval) {
    confEl.textContent = `${res.confidence_interval.low}°C — ${res.confidence_interval.high}°C`;
  }

  if (deltaEl && state.stats) {
    const delta = (res.predicted_temp - state.stats.avg_temp).toFixed(2);
    const sign = delta >= 0 ? `+${delta}` : `${delta}`;
    const word = delta >= 0 ? 'Warmer than fleet' : 'Cooler than fleet';
    deltaEl.textContent = `${sign}°C (${word})`;
  }

  // Dial rotation: Map 15°C -> -120deg to 50°C -> +120deg
  if (dialEl) {
    const normalized = Math.max(15, Math.min(50, res.predicted_temp));
    const deg = ((normalized - 15) / (50 - 15)) * 240 - 120;
    dialEl.style.transform = `rotate(${deg}deg)`;
  }

  // Render feature chips
  if (chipsEl && res.feature_breakdown) {
    chipsEl.innerHTML = '';
    const fb = res.feature_breakdown;
    const items = [
      `hour: ${fb.hour}:00`,
      `month: ${fb.month}`,
      `loc: ${fb.is_indoor ? 'Indoor' : 'Outdoor'}`,
      `hour_sin: ${fb.hour_sin}`,
      `temp_lag_1: ${fb.temp_lag_1}°C`
    ];
    items.forEach(txt => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = txt;
      chipsEl.appendChild(chip);
    });
  }
}

function computeLocalInference(payload) {
  // Analytical approximation if backend API unavailable
  const dt = payload.date_time ? new Date(payload.date_time) : new Date();
  const hour = dt.getHours();
  const isIndoor = payload.is_indoor;
  const lag = payload.temp_lag_1;

  // Thermal inertia equation weighting lag by ~0.84
  const diurnalCycle = 2.5 * Math.sin(2 * Math.PI * (hour - 8) / 24.0);
  const locationOffset = isIndoor ? -1.5 : +1.5;
  const pred = +(lag * 0.85 + (30.0 + diurnalCycle + locationOffset) * 0.15).toFixed(2);

  let comfort = "Comfortable";
  let color = "#10b981";
  if (pred < 18) { comfort = "Cold"; color = "#3b82f6"; }
  else if (pred > 38) { comfort = "Extreme Heat"; color = "#ef4444"; }
  else if (pred > 30) { comfort = "Hot"; color = "#f97316"; }
  else if (pred > 24) { comfort = "Warm"; color = "#f59e0b"; }

  displayPredictionResult({
    predicted_temp: pred,
    confidence_interval: { low: +(pred - 3.99).toFixed(2), high: +(pred + 3.99).toFixed(2) },
    comfort_status: comfort,
    comfort_color: color,
    feature_breakdown: {
      hour: hour,
      month: dt.getMonth() + 1,
      is_indoor: isIndoor,
      hour_sin: +(Math.sin(2 * Math.PI * hour / 24.0)).toFixed(4),
      temp_lag_1: lag
    }
  });
}

/* ==========================================================================
   Tab 4: Sensor Logs Explorer Table
   ========================================================================== */
function initSensorLogs(series) {
  state.allLogs = [...series].reverse();
  renderLogsTable();

  // Search filter
  const searchInput = document.getElementById('logSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.logSearchTerm = e.target.value.toLowerCase();
      state.logCurrentPage = 1;
      renderLogsTable();
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.logCurrentPage > 1) {
        state.logCurrentPage--;
        renderLogsTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const maxPages = Math.ceil(getFilteredLogs().length / state.logPageSize);
      if (state.logCurrentPage < maxPages) {
        state.logCurrentPage++;
        renderLogsTable();
      }
    });
  }

  // CSV Export
  const exportBtn = document.getElementById('btnExportCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportLogsToCsv);
  }
}

function getFilteredLogs() {
  if (!state.logSearchTerm) return state.allLogs;
  return state.allLogs.filter(item => 
    item.timestamp.toLowerCase().includes(state.logSearchTerm) ||
    item.location.toLowerCase().includes(state.logSearchTerm) ||
    String(item.temp).includes(state.logSearchTerm)
  );
}

function renderLogsTable() {
  const tbody = document.getElementById('sensorLogsTableBody');
  const pageInfo = document.getElementById('paginationInfo');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (!tbody) return;

  const filtered = getFilteredLogs();
  const total = filtered.length;
  const maxPages = Math.max(1, Math.ceil(total / state.logPageSize));
  state.logCurrentPage = Math.min(state.logCurrentPage, maxPages);

  const startIdx = (state.logCurrentPage - 1) * state.logPageSize;
  const endIdx = Math.min(startIdx + state.logPageSize, total);
  const pageRows = filtered.slice(startIdx, endIdx);

  tbody.innerHTML = '';
  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-dim);">No matching telemetry logs found.</td></tr>`;
  } else {
    pageRows.forEach(row => {
      const tr = document.createElement('tr');
      const locBadgeClass = row.location === 'Indoor' ? 'badge-emerald' : 'badge-amber';
      
      let classText = 'Normal';
      let classColor = '#10b981';
      if (row.temp > 38) { classText = 'Extreme Heat'; classColor = '#ef4444'; }
      else if (row.temp > 32) { classText = 'Warm / Hot'; classColor = '#f59e0b'; }
      else if (row.temp < 20) { classText = 'Cool'; classColor = '#3b82f6'; }

      const nextPred = (row.temp + (row.location === 'Indoor' ? -0.2 : 0.4)).toFixed(2);

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); color: var(--text-dim);">${row.timestamp}</td>
        <td><span class="kpi-badge ${locBadgeClass}">${row.location}</span></td>
        <td style="font-family: var(--font-mono); color: var(--text-main);">${String(row.hour).padStart(2, '0')}:00</td>
        <td><strong style="color: var(--text-main); font-family: var(--font-mono);">${row.temp.toFixed(1)} °C</strong></td>
        <td><span style="color: ${classColor}; font-weight: 600;">● ${classText}</span></td>
        <td style="font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 600;">${nextPred} °C</td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (pageInfo) {
    pageInfo.textContent = `Showing ${total > 0 ? startIdx + 1 : 0} to ${endIdx} of ${total} entries`;
  }
  if (pageIndicator) {
    pageIndicator.textContent = `Page ${state.logCurrentPage} of ${maxPages}`;
  }
  if (prevBtn) prevBtn.disabled = state.logCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = state.logCurrentPage >= maxPages;
}

function exportLogsToCsv() {
  const filtered = getFilteredLogs();
  if (!filtered.length) return;

  let csv = 'timestamp,location,hour,temperature_celsius\n';
  filtered.forEach(r => {
    csv += `"${r.timestamp}","${r.location}",${r.hour},${r.temp}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `iot_temperature_telemetry_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
