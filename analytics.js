/* ============================================
   VISIONAI — analytics.js
   Stats de session + graphique canvas
   ============================================ */

let sessionStart = Date.now();
let chartData = [];
let chartLabels = [];
let timerInterval = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  drawChart();
  startSessionTimer();
  setInterval(() => { loadStats(); drawChart(); }, 2000);
});

// ---- CHARGER STATS ----
function loadStats() {
  const raw = localStorage.getItem('visionai_stats');
  if (!raw) return;

  const stats = JSON.parse(raw);

  // KPI Total
  const total = stats.totalDetections || 0;
  document.getElementById('kpi-total').textContent = total.toLocaleString();
  const totalBar = document.getElementById('kpi-total-bar');
  totalBar.style.width = Math.min(100, (total / 500) * 100) + '%';

  // KPI Confidence
  const avgConf = stats.confidenceCount > 0
    ? Math.round((stats.totalConfidence / stats.confidenceCount) * 100)
    : 0;
  document.getElementById('kpi-confidence').textContent = avgConf + '%';
  document.getElementById('kpi-confidence-bar').style.width = avgConf + '%';

  // KPI Snapshots
  const snaps = stats.snapshots || 0;
  document.getElementById('kpi-snapshots').textContent = snaps;
  document.getElementById('kpi-snapshots-bar').style.width = Math.min(100, snaps * 10) + '%';

  // Historique pour chart
  chartData = (stats.detectionHistory || []).map(h => h.count);
  chartLabels = (stats.detectionHistory || []).map(h => {
    const d = new Date(h.time);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  });

  // Top catégories
  renderCategories(stats.categoryCount || {});
}

// ---- CATEGORIES ----
const CAT_COLORS = {
  person: '#7dffa2', car: '#6c63ff', truck: '#c4c0ff',
  bus: '#8781ff', bicycle: '#00e475', dog: '#ffb3b3',
  cat: '#ffb3b3', chair: '#ff525f', laptop: '#ffd740',
  default: '#c4c0ff'
};

function renderCategories(categoryCount) {
  const list = document.getElementById('categories-list');
  const entries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="category-empty">
        <span class="objects-empty-text">NO DATA YET — START DETECTION</span>
      </div>`;
    return;
  }

  const max = entries[0][1];

  list.innerHTML = entries.slice(0, 6).map(([name, count]) => {
    const color = CAT_COLORS[name.toLowerCase()] || CAT_COLORS.default;
    const pct = Math.round((count / max) * 100);
    return `
      <div class="category-item">
        <div class="category-header">
          <span class="category-name">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
          <span class="category-count">${count.toLocaleString()}</span>
        </div>
        <div class="category-bar-bg">
          <div class="category-bar" style="width:${pct}%; background:${color};
            box-shadow: 0 0 6px ${color}80;"></div>
        </div>
      </div>`;
  }).join('');
}

// ---- CHART CANVAS ----
function drawChart() {
  const canvas = document.getElementById('detection-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 250;
  canvas.width = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const data = chartData.length > 0 ? chartData : Array(10).fill(0);
  const maxVal = Math.max(...data, 1);
  const padLeft = 30;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 30;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const step = chartW / Math.max(data.length - 1, 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();

    // Y labels
    const val = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '9px Space Grotesk, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, padLeft - 4, y + 3);
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + chartH);
  ctx.lineTo(W - padRight, padTop + chartH);
  ctx.stroke();

  if (data.every(v => v === 0)) {
    // Empty state chart
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '11px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Start detection to see data', W / 2, H / 2);
    return;
  }

  // Points
  const points = data.map((v, i) => ({
    x: padLeft + i * step,
    y: padTop + chartH - (v / maxVal) * chartH
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  grad.addColorStop(0, 'rgba(108, 99, 255, 0.4)');
  grad.addColorStop(1, 'rgba(108, 99, 255, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, padTop + chartH);
  ctx.lineTo(points[0].x, padTop + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
  }
  ctx.strokeStyle = '#6c63ff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#6c63ff';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dots
  points.forEach((p, i) => {
    if (i === points.length - 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#6c63ff';
      ctx.shadowColor = '#6c63ff';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // X Labels (5 points)
  if (chartLabels.length > 0) {
    const indices = [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5),
                     Math.floor(data.length * 0.75), data.length - 1];
    indices.forEach((idx, i) => {
      const el = document.getElementById(`chart-label-${i}`);
      if (el && chartLabels[idx]) el.textContent = chartLabels[idx];
    });
  }
}

// ---- SESSION TIMER ----
function startSessionTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const el = document.getElementById('session-time');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

// ---- EXPORT REPORT ----
function exportReport() {
  const raw = localStorage.getItem('visionai_stats');
  const stats = raw ? JSON.parse(raw) : {};
  const gallery = JSON.parse(localStorage.getItem('visionai_gallery') || '[]');

  const avgConf = stats.confidenceCount > 0
    ? Math.round((stats.totalConfidence / stats.confidenceCount) * 100)
    : 0;

  const report = {
    generated: new Date().toISOString(),
    session: {
      totalDetections: stats.totalDetections || 0,
      avgConfidence: avgConf + '%',
      snapshots: stats.snapshots || 0,
      topCategories: stats.categoryCount || {}
    },
    galleryCount: gallery.length
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visionai-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
