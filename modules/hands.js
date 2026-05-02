/* ============================================
   VISIONAI — modules/hands.js
   MediaPipe Hands — 21 landmarks par main
   ============================================ */

'use strict';

const HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.min.js';

// Connexions doigts
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],         // Pouce
  [0,5],[5,6],[6,7],[7,8],         // Index
  [0,9],[9,10],[10,11],[11,12],    // Majeur
  [0,13],[13,14],[14,15],[15,16],  // Annulaire
  [0,17],[17,18],[18,19],[19,20],  // Auriculaire
  [5,9],[9,13],[13,17]             // Paume
];

const HAND_COLORS = {
  left: '#7dffa2',
  right: '#6c63ff',
  joint: '#ffffff',
  tip: '#ffd740'
};

// Indices des bouts de doigts
const FINGERTIPS = [4, 8, 12, 16, 20];
const FINGER_BASES = [2, 5, 9, 13, 17];

let handsDetector = null;
let handsRunning = false;
let handsCallback = null;
let lastHandsData = [];

function loadHandsScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ---- INIT ----
async function initHands(onResults) {
  handsCallback = onResults;
  await loadHandsScript(HANDS_CDN);

  handsDetector = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
  });

  handsDetector.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });

  handsDetector.onResults(onHandsResults);
  handsRunning = true;
  console.log('[Hands] MediaPipe Hands ready.');
}

function onHandsResults(results) {
  lastHandsData = results.multiHandLandmarks || [];
  if (handsCallback) handsCallback(results);
}

async function sendHandsFrame(videoElement) {
  if (!handsDetector || !handsRunning) return;
  try {
    await handsDetector.send({ image: videoElement });
  } catch (e) {}
}

// ---- DESSINER MAINS ----
function drawHands(ctx, results, canvasWidth, canvasHeight) {
  if (!results.multiHandLandmarks) return;

  results.multiHandLandmarks.forEach((landmarks, idx) => {
    const handedness = results.multiHandedness?.[idx]?.label || 'Right';
    const color = handedness === 'Left' ? HAND_COLORS.left : HAND_COLORS.right;

    // Connexions
    HAND_CONNECTIONS.forEach(([i, j]) => {
      const a = landmarks[i];
      const b = landmarks[j];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
      ctx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Joints
    landmarks.forEach((lm, i) => {
      const x = lm.x * canvasWidth;
      const y = lm.y * canvasHeight;
      const isTip = FINGERTIPS.includes(i);

      ctx.beginPath();
      ctx.arc(x, y, isTip ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? HAND_COLORS.tip : HAND_COLORS.joint;
      ctx.shadowColor = isTip ? HAND_COLORS.tip : color;
      ctx.shadowBlur = isTip ? 10 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Label main
    const wrist = landmarks[0];
    ctx.font = 'bold 11px Space Grotesk, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(
      handedness.toUpperCase(),
      wrist.x * canvasWidth - 10,
      wrist.y * canvasHeight + 20
    );
  });
}

// ---- COMPTER DOIGTS LEVÉS ----
function countFingers(landmarks, handedness) {
  if (!landmarks || landmarks.length < 21) return 0;
  let count = 0;
  const isLeft = handedness === 'Left';

  // Pouce (logique différente)
  const thumbTip = landmarks[4];
  const thumbBase = landmarks[2];
  if (isLeft ? thumbTip.x > thumbBase.x : thumbTip.x < thumbBase.x) count++;

  // Autres doigts
  for (let i = 1; i < 5; i++) {
    const tip = landmarks[FINGERTIPS[i]];
    const base = landmarks[FINGER_BASES[i]];
    if (tip.y < base.y) count++;
  }

  return count;
}

// ---- POSITION DOIGT INDEX ----
function getIndexPosition(landmarks, canvasWidth, canvasHeight) {
  if (!landmarks || landmarks.length < 9) return null;
  const tip = landmarks[8];
  return {
    x: tip.x * canvasWidth,
    y: tip.y * canvasHeight,
    z: tip.z
  };
}

// ---- CENTRE DE LA MAIN ----
function getHandCenter(landmarks, canvasWidth, canvasHeight) {
  if (!landmarks) return null;
  const wrist = landmarks[0];
  const middle = landmarks[9];
  return {
    x: ((wrist.x + middle.x) / 2) * canvasWidth,
    y: ((wrist.y + middle.y) / 2) * canvasHeight
  };
}

function stopHands() {
  handsRunning = false;
  if (handsDetector) handsDetector.close();
  handsDetector = null;
}

function getLastHandsData() {
  return lastHandsData;
}

window.VizHands = {
  init: initHands,
  send: sendHandsFrame,
  draw: drawHands,
  countFingers,
  getIndexPosition,
  getHandCenter,
  getLastHands: getLastHandsData,
  stop: stopHands
};