/* ============================================
   VISIONAI — modules/gestures.js
   Reconnaissance gestes + actions UI
   ============================================ */

'use strict';

// ---- CONFIGURATION ----
const GESTURE_COOLDOWN = 1000; // ms entre 2 gestes
const SWIPE_THRESHOLD = 0.25;  // distance min pour swipe
const SWIPE_SPEED = 0.015;     // vitesse min pour swipe

// ---- ÉTAT ----
let lastGestureTime = {};
let handHistory = [];           // historique positions pour swipe
const HISTORY_SIZE = 10;

// ---- GESTES DÉFINIS ----
const GESTURES = {
  FIST:       'fist',
  OPEN:       'open',
  PEACE:      'peace',
  THUMBS_UP:  'thumbs_up',
  THUMBS_DOWN:'thumbs_down',
  POINT:      'point',
  CALL:       'call',
  ROCK:       'rock',
  OK:         'ok',
  PINCH:      'pinch',
  THREE:      'three',
  FOUR:       'four',
  SWIPE_LEFT: 'swipe_left',
  SWIPE_RIGHT:'swipe_right',
  SWIPE_UP:   'swipe_up',
  SWIPE_DOWN: 'swipe_down',
  WAVE:       'wave'
};

// ---- ACTIONS PAR GESTE ----
const GESTURE_ACTIONS = {
  fist:        () => { triggerAction('START_DETECTION'); },
  open:        () => { triggerAction('STOP_DETECTION'); },
  peace:       () => { triggerAction('SCREENSHOT'); },
  thumbs_up:   () => { triggerAction('VOLUME_UP'); },
  thumbs_down: () => { triggerAction('VOLUME_DOWN'); },
  point:       () => { triggerAction('PAUSE_PLAY'); },
  swipe_left:  () => { triggerAction('NAV_GALLERY'); },
  swipe_right: () => { triggerAction('NAV_LIVE'); },
  swipe_up:    () => { triggerAction('NAV_SETTINGS'); },
  swipe_down:  () => { triggerAction('NAV_ANALYTICS'); },
  wave:        () => { triggerAction('WAVE_HELLO'); },
  pinch:       () => { triggerAction('ZOOM_TOGGLE'); },
  call:        () => { triggerAction('OPEN_GAME'); },
  rock:        () => { triggerAction('TOGGLE_OVERLAY'); },
  ok:          () => { triggerAction('CONFIRM'); }
};

// Callbacks enregistrés par l'app
let actionCallbacks = {};

// ---- RECONNAÎTRE GESTE ----
function recognizeGesture(landmarks, handedness) {
  if (!landmarks || landmarks.length < 21) return null;

  const fingers = countFingersUp(landmarks, handedness);
  const thumbUp = isThumbUp(landmarks, handedness);
  const thumbDown = isThumbDown(landmarks, handedness);
  const isPinching = isPinch(landmarks);

  const [thumb, index, middle, ring, pinky] = fingers;
  const total = fingers.reduce((a, b) => a + b, 0);

  // Pinch
  if (isPinching) return GESTURES.PINCH;

  // Poing fermé
  if (total === 0) return GESTURES.FIST;

  // Main ouverte
  if (total === 5) return GESTURES.OPEN;

  // Pouce haut
  if (thumbUp && total === 1) return GESTURES.THUMBS_UP;

  // Pouce bas
  if (thumbDown && total === 1) return GESTURES.THUMBS_DOWN;

  // Peace / V
  if (!thumb && index && middle && !ring && !pinky) return GESTURES.PEACE;

  // Un doigt (pointer)
  if (!thumb && index && !middle && !ring && !pinky) return GESTURES.POINT;

  // Call me 🤙
  if (thumb && !index && !middle && !ring && pinky) return GESTURES.CALL;

  // Rock 🤟
  if (thumb && index && !middle && !ring && pinky) return GESTURES.ROCK;

  // OK
  if (isPinch(landmarks) && middle && ring && pinky) return GESTURES.OK;

  // 3 doigts
  if (!thumb && index && middle && ring && !pinky) return GESTURES.THREE;

  // 4 doigts
  if (!thumb && index && middle && ring && pinky) return GESTURES.FOUR;

  return null;
}

// ---- DOIGTS LEVÉS ----
function countFingersUp(landmarks, handedness) {
  const isLeft = handedness === 'Left';
  const result = [0, 0, 0, 0, 0]; // thumb, index, middle, ring, pinky

  // Pouce
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  result[0] = isLeft
    ? (thumbTip.x > thumbIP.x ? 1 : 0)
    : (thumbTip.x < thumbIP.x ? 1 : 0);

  // Autres doigts
  const tips =  [8, 12, 16, 20];
  const pips =  [6, 10, 14, 18];
  tips.forEach((tip, i) => {
    result[i + 1] = landmarks[tip].y < landmarks[pips[i]].y ? 1 : 0;
  });

  return result;
}

// ---- POUCE HAUT ----
function isThumbUp(landmarks, handedness) {
  const tip = landmarks[4];
  const base = landmarks[2];
  const wrist = landmarks[0];
  return tip.y < wrist.y && tip.y < base.y;
}

// ---- POUCE BAS ----
function isThumbDown(landmarks, handedness) {
  const tip = landmarks[4];
  const wrist = landmarks[0];
  return tip.y > wrist.y + 0.1;
}

// ---- PINCH ----
function isPinch(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const dist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y
  );
  return dist < 0.07;
}

// ---- DÉTECTER SWIPE ----
function detectSwipe(landmarks, canvasWidth, canvasHeight) {
  if (!landmarks) return null;

  const center = {
    x: landmarks[9].x,
    y: landmarks[9].y
  };

  handHistory.push({ ...center, time: Date.now() });
  if (handHistory.length > HISTORY_SIZE) handHistory.shift();
  if (handHistory.length < 5) return null;

  const first = handHistory[0];
  const last = handHistory[handHistory.length - 1];
  const dt = (last.time - first.time) / 1000;
  if (dt === 0) return null;

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const speedX = Math.abs(dx) / dt;
  const speedY = Math.abs(dy) / dt;

  if (Math.abs(dx) > SWIPE_THRESHOLD && speedX > SWIPE_SPEED * 10) {
    handHistory = [];
    return dx > 0 ? GESTURES.SWIPE_RIGHT : GESTURES.SWIPE_LEFT;
  }

  if (Math.abs(dy) > SWIPE_THRESHOLD && speedY > SWIPE_SPEED * 10) {
    handHistory = [];
    return dy > 0 ? GESTURES.SWIPE_DOWN : GESTURES.SWIPE_UP;
  }

  return null;
}

// ---- DÉTECTER WAVE ----
let waveHistory = [];
let waveDirectionChanges = 0;
let lastWaveDir = null;

function detectWave(landmarks) {
  if (!landmarks) return false;
  const wrist = landmarks[0];
  waveHistory.push(wrist.x);
  if (waveHistory.length > 20) waveHistory.shift();
  if (waveHistory.length < 10) return false;

  for (let i = 1; i < waveHistory.length; i++) {
    const dir = waveHistory[i] > waveHistory[i-1] ? 'right' : 'left';
    if (dir !== lastWaveDir) {
      waveDirectionChanges++;
      lastWaveDir = dir;
    }
  }

  if (waveDirectionChanges >= 4) {
    waveDirectionChanges = 0;
    waveHistory = [];
    return true;
  }
  return false;
}

// ---- PROCESS FRAME COMPLET ----
function processGestures(handsResults, canvasWidth, canvasHeight) {
  if (!handsResults.multiHandLandmarks) return;

  handsResults.multiHandLandmarks.forEach((landmarks, idx) => {
    const handedness = handsResults.multiHandedness?.[idx]?.label || 'Right';

    // Geste statique
    const gesture = recognizeGesture(landmarks, handedness);

    // Swipe
    const swipe = detectSwipe(landmarks, canvasWidth, canvasHeight);

    // Wave
    const wave = detectWave(landmarks);

    const detected = swipe || (wave ? GESTURES.WAVE : gesture);

    if (detected) fireGesture(detected, landmarks, handedness);
  });
}

// ---- DÉCLENCHER GESTE ----
function fireGesture(gesture, landmarks, handedness) {
  const now = Date.now();
  if (lastGestureTime[gesture] && now - lastGestureTime[gesture] < GESTURE_COOLDOWN) return;
  lastGestureTime[gesture] = now;

  // Afficher le badge geste
  showGestureBadge(gesture);

  // Action intégrée
  if (GESTURE_ACTIONS[gesture]) GESTURE_ACTIONS[gesture]();

  // Callback custom
  if (actionCallbacks[gesture]) actionCallbacks[gesture]({ gesture, landmarks, handedness });
  if (actionCallbacks['*']) actionCallbacks['*']({ gesture, landmarks, handedness });

  // Event DOM
  document.dispatchEvent(new CustomEvent('vizgesture', {
    detail: { gesture, landmarks, handedness }
  }));

  console.log('[Gestures] Detected:', gesture);
}

// ---- ACTIONS UI ----
function triggerAction(action) {
  switch (action) {
    case 'START_DETECTION':
      if (!window.isRunning) window.toggleDetection?.();
      break;
    case 'STOP_DETECTION':
      if (window.isRunning) window.toggleDetection?.();
      break;
    case 'SCREENSHOT':
      window.captureScreenshot?.();
      break;
    case 'NAV_GALLERY':
      window.location.href = 'gallery.html';
      break;
    case 'NAV_LIVE':
      window.location.href = 'index.html';
      break;
    case 'NAV_SETTINGS':
      window.location.href = 'settings.html';
      break;
    case 'NAV_ANALYTICS':
      window.location.href = 'analytics.html';
      break;
    case 'OPEN_GAME':
      window.open('game/index.html', '_blank');
      break;
    case 'ZOOM_TOGGLE':
      const video = document.getElementById('webcam');
      if (video) video.style.transform =
        video.style.transform === 'scale(1.3)' ? 'scale(1)' : 'scale(1.3)';
      break;
    case 'WAVE_HELLO':
      showGestureBadge('wave', '👋 Hello!');
      break;
    case 'TOGGLE_OVERLAY':
      const overlay = document.getElementById('overlay');
      if (overlay) overlay.style.opacity =
        overlay.style.opacity === '0' ? '1' : '0';
      break;
  }
}

// ---- BADGE GESTE UI ----
const GESTURE_EMOJIS = {
  fist: '✊', open: '🖐️', peace: '✌️',
  thumbs_up: '👍', thumbs_down: '👎',
  point: '☝️', call: '🤙', rock: '🤟',
  ok: '👌', pinch: '🤌', three: '3️⃣',
  four: '4️⃣', swipe_left: '👈', swipe_right: '👉',
  swipe_up: '👆', swipe_down: '👇', wave: '👋'
};

function showGestureBadge(gesture, customText) {
  let badge = document.getElementById('gesture-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'gesture-badge';
    badge.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(108,99,255,0.85);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(196,192,255,0.3);
      border-radius: 999px;
      padding: 10px 24px;
      font-family: Space Grotesk, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: white;
      z-index: 99999;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(badge);
  }

  const emoji = GESTURE_EMOJIS[gesture] || '🤖';
  badge.textContent = customText || `${emoji} ${gesture.replace('_', ' ').toUpperCase()}`;
  badge.style.opacity = '1';

  clearTimeout(badge._timeout);
  badge._timeout = setTimeout(() => { badge.style.opacity = '0'; }, 1500);
}

// ---- API PUBLIQUE ----
function onGesture(gesture, callback) {
  actionCallbacks[gesture] = callback;
}

function onAnyGesture(callback) {
  actionCallbacks['*'] = callback;
}

window.VizGestures = {
  process: processGestures,
  recognize: recognizeGesture,
  onGesture,
  onAnyGesture,
  GESTURES,
  showBadge: showGestureBadge
};