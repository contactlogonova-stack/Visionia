/* ============================================
   VISIONAI — modules/speed.js
   Vitesse des objets détectés en temps réel
   ============================================ */

'use strict';

// ---- ÉTAT ----
const objectTrackers = {};  // { id: { x, y, time, speed, history } }
const PIXELS_PER_METER = 200; // calibration approximative
const FPS_ESTIMATE = 30;

// ---- CALCULER VITESSE ----
function updateSpeed(predictions, canvasWidth, canvasHeight) {
  const now = Date.now();
  const results = [];

  predictions.forEach((pred, idx) => {
    const [x, y, w, h] = pred.bbox;
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Clé unique par classe + position approximative
    const key = `${pred.class}_${idx}`;

    if (!objectTrackers[key]) {
      objectTrackers[key] = {
        x: cx, y: cy,
        time: now,
        speed: 0,
        speedKmh: 0,
        direction: null,
        history: []
      };
    }

    const tracker = objectTrackers[key];
    const dt = (now - tracker.time) / 1000;

    if (dt > 0 && dt < 2) {
      const dx = cx - tracker.x;
      const dy = cy - tracker.y;
      const distPx = Math.hypot(dx, dy);
      const distMeters = distPx / PIXELS_PER_METER;
      const speedMs = distMeters / dt;
      const speedKmh = speedMs * 3.6;

      // Lisser la vitesse
      tracker.history.push(speedKmh);
      if (tracker.history.length > 5) tracker.history.shift();
      const avgSpeed = tracker.history.reduce((a, b) => a + b, 0) / tracker.history.length;

      tracker.speed = distPx / dt;
      tracker.speedKmh = avgSpeed;

      // Direction
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      tracker.direction = getDirection(angle);
    }

    tracker.x = cx;
    tracker.y = cy;
    tracker.time = now;

    results.push({
      class: pred.class,
      bbox: pred.bbox,
      speed: tracker.speedKmh,
      direction: tracker.direction,
      key
    });
  });

  // Nettoyer les trackers inactifs
  const activeKeys = new Set(predictions.map((p, i) => `${p.class}_${i}`));
  Object.keys(objectTrackers).forEach(key => {
    if (!activeKeys.has(key)) delete objectTrackers[key];
  });

  return results;
}

// ---- DIRECTION ----
function getDirection(angle) {
  if (angle >= -22.5 && angle < 22.5)   return '→';
  if (angle >= 22.5 && angle < 67.5)    return '↘';
  if (angle >= 67.5 && angle < 112.5)   return '↓';
  if (angle >= 112.5 && angle < 157.5)  return '↙';
  if (angle >= 157.5 || angle < -157.5) return '←';
  if (angle >= -157.5 && angle < -112.5)return '↖';
  if (angle >= -112.5 && angle < -67.5) return '↑';
  if (angle >= -67.5 && angle < -22.5)  return '↗';
  return '•';
}

// ---- DESSINER VITESSE ----
function drawSpeed(ctx, speedResults) {
  speedResults.forEach(({ bbox, speed, direction, class: cls }) => {
    if (speed < 0.5) return; // ignorer si quasi immobile

    const [x, y, w, h] = bbox;
    const label = `${direction} ${Math.round(speed)} km/h`;

    ctx.font = 'bold 10px Space Grotesk, sans-serif';
    const tw = ctx.measureText(label).width;

    // Badge vitesse en bas de la box
    const bx = x + w / 2 - tw / 2 - 6;
    const by = y + h + 4;

    ctx.fillStyle = speed > 30
      ? 'rgba(255,82,95,0.85)'
      : speed > 10
      ? 'rgba(255,215,64,0.85)'
      : 'rgba(108,99,255,0.85)';

    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 12, 18, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx + 6, by + 13);
  });
}

// ---- RESET ----
function resetSpeed() {
  Object.keys(objectTrackers).forEach(k => delete objectTrackers[k]);
}

window.VizSpeed = {
  update: updateSpeed,
  draw: drawSpeed,
  reset: resetSpeed,
  getTrackers: () => ({ ...objectTrackers })
};