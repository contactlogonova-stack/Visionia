/* ============================================
   VISIONAI — app.js v2
   Stable, sans dépendances fragiles
   ============================================ */

'use strict';

let isRunning = false;
let cocoModel = null;
let animFrame = null;
let wellnessHistory = [];
let currentFacingMode = 'user'; // 'user' = avant, 'environment' = arrière
let sessionStats = {
  totalDetections: 0,
  totalConfidence: 0,
  confidenceCount: 0,
  snapshots: 0,
  detectionHistory: [],
  categoryCount: {}
};

const CLASS_COLORS = {
  'person':     '#7dffa2',
  'car':        '#6c63ff',
  'truck':      '#c4c0ff',
  'bus':        '#8781ff',
  'bicycle':    '#00e475',
  'motorcycle': '#62ff96',
  'dog':        '#ffb3b3',
  'cat':        '#ffb3b3',
  'chair':      '#ff525f',
  'couch':      '#ff8a80',
  'bottle':     '#80d8ff',
  'cup':        '#80d8ff',
  'laptop':     '#ffd740',
  'cellphone':  '#ffd740',
  'book':       '#ffcc80'
};

function getColor(cls) {
  return CLASS_COLORS[cls.toLowerCase().replace(/\s+/g, '')] || '#c4c0ff';
}

async function toggleDetection() {
  if (isRunning) stopDetection();
  else await startDetection();
}

async function startDetection() {
  const btn = document.getElementById('toggle-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> CHARGEMENT...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 } }
    });

    const video = document.getElementById('webcam');
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = res; });
    video.play();

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.add('hidden');

    if (!cocoModel) {
      btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> MODELE IA...';
      if (typeof tf === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
      }
      if (typeof cocoSsd === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');
      }
      cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }

    isRunning = true;
    btn.disabled = false;
    btn.classList.add('active');
    btn.innerHTML = '<span class="material-symbols-outlined">stop</span> STOP';
    setStatus(true);
    detectionLoop();

  } catch (err) {
    console.error('[VisionAI]', err);
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">power_settings_new</span> START DETECTION';
    let msg = err.message;
    if (err.name === 'NotAllowedError') msg = 'Permission camera refusee. Autorise la camera dans les parametres.';
    else if (err.name === 'NotFoundError') msg = 'Aucune camera detectee.';
    else if (err.name === 'NotReadableError') msg = 'Camera utilisee par une autre app.';
    alert('VisionAI: ' + msg);
  }
}

function stopDetection() {
  isRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);

  const video = document.getElementById('webcam');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  const canvas = document.getElementById('overlay');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  const badges = document.getElementById('detection-badges');
  if (badges) badges.innerHTML = '';

  const list = document.getElementById('objects-list');
  if (list) list.innerHTML = '<div class="objects-empty"><span class="objects-empty-text">SCANNING FOR OBJECTS...</span></div>';

  const latency = document.getElementById('latency');
  if (latency) latency.textContent = '--ms';

  const total = document.getElementById('sidebar-total');
  if (total) total.textContent = '00';

  const btn = document.getElementById('toggle-btn');
  if (btn) {
    btn.classList.remove('active');
    btn.innerHTML = '<span class="material-symbols-outlined">power_settings_new</span> START DETECTION';
  }

  setStatus(false);
  resetWellness();
}

async function detectionLoop() {
  if (!isRunning) return;

  const video = document.getElementById('webcam');
  const canvas = document.getElementById('overlay');
  if (!video || !canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const t0 = performance.now();
  const threshold = ((document.getElementById('threshold') || {}).value || 75) / 100;

  let predictions = [];
  const objectsOn = (document.getElementById('toggle-objects') || {}).checked !== false;

  if (cocoModel && objectsOn && video.readyState === 4) {
    try {
      predictions = await cocoModel.detect(video);
      predictions = predictions.filter(p => p.score >= threshold);
    } catch (e) {}
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grouped = {};

  predictions.forEach(pred => {
    const [x, y, w, h] = pred.bbox;
    const color = getColor(pred.class);
    const pct = Math.round(pred.score * 100);
    const label = pred.class.toUpperCase() + ' ' + pct + '%';

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    const cSize = 10;
    ctx.lineWidth = 3;
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(function(pt) {
      const dx = pt[0] === x ? 1 : -1;
      const dy = pt[1] === y ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(pt[0] + dx*cSize, pt[1]);
      ctx.lineTo(pt[0], pt[1]);
      ctx.lineTo(pt[0], pt[1] + dy*cSize);
      ctx.stroke();
    });

    ctx.font = 'bold 11px Space Grotesk, sans-serif';
    const tw = ctx.measureText(label).width;
    const lx = Math.max(0, x);
    const ly = Math.max(22, y);
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly - 20, tw + 16, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(label, lx + 8, ly - 6);

    grouped[pred.class] = (grouped[pred.class] || 0) + 1;
    sessionStats.totalDetections++;
    sessionStats.totalConfidence += pred.score;
    sessionStats.confidenceCount++;
    sessionStats.categoryCount[pred.class] = (sessionStats.categoryCount[pred.class] || 0) + 1;
  });

  const wellnessOn = (document.getElementById('toggle-wellness') || {}).checked !== false;
  if (wellnessOn) simpleWellness(predictions);

  const latEl = document.getElementById('latency');
  if (latEl) latEl.textContent = Math.round(performance.now() - t0) + 'ms';

  updateObjectsList(grouped);
  updateDetectionBadges(grouped);
  updateSidebarTotal(predictions.length);

  sessionStats.detectionHistory.push({ time: Date.now(), count: predictions.length });
  if (sessionStats.detectionHistory.length > 60) sessionStats.detectionHistory.shift();
  saveSessionStats();

  animFrame = requestAnimationFrame(detectionLoop);
}

function simpleWellness(predictions) {
  const personDetected = predictions.some(function(p) { return p.class === 'person'; });
  const now = Date.now();
  wellnessHistory.push({ time: now, detected: personDetected });
  wellnessHistory = wellnessHistory.filter(function(h) { return now - h.time < 10000; });
  const rate = wellnessHistory.filter(function(h) { return h.detected; }).length / Math.max(wellnessHistory.length, 1);

  const eIcon = document.getElementById('emotion-icon');
  const eLabel = document.getElementById('emotion-label');
  if (eIcon) eIcon.textContent = personDetected ? '😊' : '👤';
  if (eLabel) {
    eLabel.textContent = personDetected ? 'DETECTED' : 'NO FACE';
    eLabel.style.color = personDetected ? '#7dffa2' : '';
  }

  const alertness = Math.round(rate * 100);
  const ring = document.getElementById('fatigue-ring');
  const fatVal = document.getElementById('fatigue-value');
  const fatLabel = document.getElementById('fatigue-label');
  const circ = 2 * Math.PI * 15.9;
  if (ring) {
    ring.style.strokeDasharray = ((alertness/100)*circ) + ' ' + circ;
    ring.style.stroke = alertness > 60 ? '#7dffa2' : alertness > 30 ? '#ffd740' : '#ff525f';
  }
  if (fatVal) fatVal.textContent = alertness + '%';
  if (fatLabel) {
    fatLabel.textContent = alertness > 60 ? 'PRESENT' : alertness > 30 ? 'MOVING' : 'ABSENT';
    fatLabel.style.color = alertness > 60 ? '#7dffa2' : alertness > 30 ? '#ffd740' : '#ff525f';
  }

  const person = predictions.find(function(p) { return p.class === 'person'; });
  const pIcon = document.getElementById('posture-icon');
  const pLabel = document.getElementById('posture-label');
  if (person && pIcon && pLabel) {
    const ratio = person.bbox[3] / person.bbox[2];
    if (ratio > 2.5) {
      pIcon.textContent = '🧍'; pLabel.textContent = 'STANDING'; pLabel.style.color = '#7dffa2';
    } else if (ratio > 1.2) {
      pIcon.textContent = '🧘'; pLabel.textContent = 'SEATED'; pLabel.style.color = '#c4c0ff';
    } else {
      pIcon.textContent = '🪑'; pLabel.textContent = 'SLOUCHING'; pLabel.style.color = '#ffd740';
    }
  } else if (!person && pIcon && pLabel) {
    pIcon.textContent = '🧍'; pLabel.textContent = 'UNKNOWN'; pLabel.style.color = '';
  }
}

function resetWellness() {
  wellnessHistory = [];
  var ids = { 'emotion-icon':'😐','fatigue-value':'--','posture-icon':'🧍' };
  Object.keys(ids).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = ids[id];
  });
  var labels = ['emotion-label','fatigue-label','posture-label'];
  labels.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.color = ''; }
  });
  var elLabel = document.getElementById('emotion-label');
  if (elLabel) elLabel.textContent = 'NEUTRAL';
  var fatLabel = document.getElementById('fatigue-label');
  if (fatLabel) fatLabel.textContent = 'UNKNOWN';
  var postLabel = document.getElementById('posture-label');
  if (postLabel) postLabel.textContent = 'UNKNOWN';
  var ring = document.getElementById('fatigue-ring');
  if (ring) ring.style.strokeDasharray = '0 100';
  var alert = document.getElementById('wellness-alert');
  if (alert) alert.classList.add('hidden');
}

function updateObjectsList(grouped) {
  var list = document.getElementById('objects-list');
  if (!list) return;
  if (Object.keys(grouped).length === 0) {
    list.innerHTML = '<div class="objects-empty"><span class="objects-empty-text">NO OBJECTS DETECTED</span></div>';
    return;
  }
  list.innerHTML = Object.entries(grouped).sort(function(a,b){ return b[1]-a[1]; }).map(function(entry) {
    var name = entry[0], count = entry[1];
    var color = getColor(name);
    var label = name.charAt(0).toUpperCase() + name.slice(1);
    return '<div class="object-row">' +
      '<div class="object-row-left">' +
      '<span class="object-dot" style="background:'+color+';box-shadow:0 0 6px '+color+'80;"></span>' +
      '<span class="object-name">'+label+'</span></div>' +
      '<span class="object-count" style="color:'+color+';font-weight:700;">x'+count+'</span></div>';
  }).join('');
}

function updateDetectionBadges(grouped) {
  var container = document.getElementById('detection-badges');
  if (!container) return;
  container.innerHTML = Object.entries(grouped).slice(0,4).map(function(entry) {
    var name = entry[0], count = entry[1];
    var color = getColor(name);
    return '<div class="detection-badge">' +
      '<span class="detection-badge-dot" style="background:'+color+'"></span>' +
      count + ' ' + name.toUpperCase() + '</div>';
  }).join('');
}

function updateSidebarTotal(count) {
  var el = document.getElementById('sidebar-total');
  if (el) el.textContent = String(count).padStart(2, '0');
}

function setStatus(active) {
  var dot = document.getElementById('status-dot');
  var ping = document.getElementById('status-ping');
  var text = document.getElementById('status-text');
  if (dot) dot.classList.toggle('active', active);
  if (ping) ping.classList.toggle('active', active);
  if (text) text.textContent = active ? 'LIVE · CAM FRONT' : 'FEED INACTIVE';
}

function captureScreenshot() {
  var video = document.getElementById('webcam');
  var canvas = document.getElementById('overlay');
  if (!video || !video.srcObject) { alert('Lance la detection d abord.'); return; }

  var capture = document.createElement('canvas');
  capture.width = video.videoWidth || 640;
  capture.height = video.videoHeight || 480;
  var ctx = capture.getContext('2d');
  ctx.drawImage(video, 0, 0);
  if (canvas) ctx.drawImage(canvas, 0, 0);

  var dataUrl = capture.toDataURL('image/png');
  var tags = Array.from(document.querySelectorAll('.object-name')).map(function(el) { return el.textContent.trim(); });

  try {
    var gallery = JSON.parse(localStorage.getItem('visionai_gallery') || '[]');
    gallery.unshift({ id: Date.now(), dataUrl: dataUrl, timestamp: new Date().toISOString(), tags: tags, confidence: 95 });
    if (gallery.length > 30) gallery.pop();
    localStorage.setItem('visionai_gallery', JSON.stringify(gallery));
  } catch(e) {}

  sessionStats.snapshots++;
  saveSessionStats();

  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:white;opacity:0.5;pointer-events:none;z-index:9999;transition:opacity 0.3s;';
  document.body.appendChild(flash);
  requestAnimationFrame(function() {
    flash.style.opacity = '0';
    setTimeout(function() { flash.remove(); }, 350);
  });
}

function saveSessionStats() {
  try { localStorage.setItem('visionai_stats', JSON.stringify(sessionStats)); } catch(e) {}
}

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = function() { reject(new Error('Failed: ' + src)); };
    document.head.appendChild(s);
  });
}

// ... reste du code ...

async function switchCamera() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  if (isRunning) {
    stopDetection();
    await startDetection();
  }
}

window.toggleDetection = toggleDetection;
window.captureScreenshot = captureScreenshot;
window.switchCamera = switchCamera;  // ← remplace l'ancienne ligne window.switchCamera

console.log('[VisionAI] app.js v2 ready.');