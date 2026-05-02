/* ============================================
   VISIONAI — modules/pose.js
   MediaPipe Pose — Skeleton corps complet
   ============================================ */

'use strict';

const POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.min.js';
const POSE_UTILS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.min.js';

// Connexions entre les joints du skeleton
const POSE_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],
  [9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[17,19],
  [12,14],[14,16],[16,18],[16,20],[18,20],
  [11,23],[12,24],[23,24],[23,25],[24,26],
  [25,27],[26,28],[27,29],[28,30],[29,31],[30,32]
];

const POSE_COLORS = {
  leftSide: '#7dffa2',
  rightSide: '#6c63ff',
  center: '#c4c0ff',
  joint: '#ffffff'
};

let poseDetector = null;
let poseRunning = false;
let poseCallback = null;

// ---- CHARGER MEDIAPIPE ----
function loadPoseScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ---- INIT POSE ----
async function initPose(onResults) {
  poseCallback = onResults;
  await loadPoseScript(POSE_CDN);

  poseDetector = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
  });

  poseDetector.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  poseDetector.onResults(onPoseResults);
  poseRunning = true;
  console.log('[Pose] MediaPipe Pose ready.');
}

// ---- RÉSULTATS ----
function onPoseResults(results) {
  if (!poseCallback) return;
  poseCallback(results);
}

// ---- ENVOYER FRAME ----
async function sendPoseFrame(videoElement) {
  if (!poseDetector || !poseRunning) return;
  try {
    await poseDetector.send({ image: videoElement });
  } catch (e) {}
}

// ---- DESSINER SKELETON ----
function drawSkeleton(ctx, landmarks, canvasWidth, canvasHeight) {
  if (!landmarks || landmarks.length === 0) return;

  // Dessiner les connexions
  POSE_CONNECTIONS.forEach(([i, j]) => {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b || a.visibility < 0.3 || b.visibility < 0.3) return;

    const x1 = a.x * canvasWidth;
    const y1 = a.y * canvasHeight;
    const x2 = b.x * canvasWidth;
    const y2 = b.y * canvasHeight;

    // Couleur selon côté
    let color = POSE_COLORS.center;
    if (i % 2 === 1 || j % 2 === 1) color = POSE_COLORS.leftSide;
    if (i % 2 === 0 && i > 10) color = POSE_COLORS.rightSide;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Dessiner les joints
  landmarks.forEach((lm, i) => {
    if (lm.visibility < 0.3) return;
    const x = lm.x * canvasWidth;
    const y = lm.y * canvasHeight;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = POSE_COLORS.joint;
    ctx.shadowColor = '#6c63ff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

// ---- ANALYSER POSTURE ----
function analyzePosture(landmarks, canvasHeight) {
  if (!landmarks || landmarks.length < 29) return 'UNKNOWN';

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 'UNKNOWN';

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const shoulderX = Math.abs(leftShoulder.x - rightShoulder.x);

  // Debout vs assis
  const torsoHeight = Math.abs(hipY - shoulderY);
  if (torsoHeight < 0.15) return 'SEATED';

  // Dos courbé
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  if (shoulderTilt > 0.08) return 'SLOUCHING';

  // Bonne posture
  return 'STANDING';
}

// ---- STOP ----
function stopPose() {
  poseRunning = false;
  if (poseDetector) poseDetector.close();
  poseDetector = null;
  console.log('[Pose] Stopped.');
}

window.VizPose = {
  init: initPose,
  send: sendPoseFrame,
  draw: drawSkeleton,
  analyze: analyzePosture,
  stop: stopPose
};