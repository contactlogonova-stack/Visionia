/* ============================================
   VISIONAI — game/game.js
   Mini-jeu : Attrape les balles avec les mains
   ============================================ */

'use strict';

// ---- ÉTAT DU JEU ----
const state = {
  running: false,
  score: 0,
  lives: 3,
  level: 1,
  timer: 60,
  combo: 0,
  maxCombo: 0,
  balls: [],
  particles: [],
  handPos: { x: -100, y: -100 },
  isFist: false,
  boostActive: false,
  boostTimer: 0,
  frameCount: 0,
  spawnRate: 120,  // frames entre spawns
  ballSpeed: 2
};

// ---- CANVAS + VIDEO ----
let gameCanvas, gameCtx, handsCanvas, handsCtx, video;
let animFrame = null;
let timerInterval = null;
let handsResults = null;

// ---- COULEURS ----
const BALL_COLORS = [
  '#7dffa2', '#6c63ff', '#ffd740',
  '#ff525f', '#80d8ff', '#c4c0ff'
];

// ============================================
// INIT
// ============================================
window.addEventListener('load', async () => {
  gameCanvas  = document.getElementById('game-canvas');
  gameCtx     = gameCanvas.getContext('2d');
  handsCanvas = document.getElementById('hands-canvas');
  handsCtx    = handsCanvas.getContext('2d');
  video       = document.getElementById('webcam');

  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  setLoading('INITIALIZING CAMERA...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = res; });
    video.play();
  } catch (e) {
    setLoading('❌ Camera access denied');
    return;
  }

  setLoading('LOADING AI MODELS...');

  try {
    await VizHands.init(onHandsResults);
  } catch (e) {
    setLoading('❌ Model load failed');
    return;
  }

  hideLoading();
  document.getElementById('start-screen').classList.remove('hidden');
  handsLoop();
});

function resizeCanvases() {
  const w = window.innerWidth;
  const h = window.innerHeight - 56;
  gameCanvas.width  = w;
  gameCanvas.height = h;
  handsCanvas.width  = w;
  handsCanvas.height = h;
}

function setLoading(text) {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-screen').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
}

// ============================================
// HANDS LOOP (tourne toujours)
// ============================================
async function handsLoop() {
  if (video.readyState === 4) {
    await VizHands.send(video);
  }
  requestAnimationFrame(handsLoop);
}

function onHandsResults(results) {
  handsResults = results;
  handsCtx.clearRect(0, 0, handsCanvas.width, handsCanvas.height);
  if (results.multiHandLandmarks?.length > 0) {
    VizHands.draw(handsCtx, results, handsCanvas.width, handsCanvas.height);
    updateHandPosition(results);
  }
}

function updateHandPosition(results) {
  if (!results.multiHandLandmarks?.length) return;

  const landmarks = results.multiHandLandmarks[0];
  const handedness = results.multiHandedness?.[0]?.label || 'Right';

  // Centre de la main (miroir car video flippée)
  const center = VizHands.getHandCenter(landmarks, handsCanvas.width, handsCanvas.height);
  if (center) {
    state.handPos.x = handsCanvas.width - center.x;
    state.handPos.y = center.y;
  }

  // Détecter poing
  const fingers = VizHands.countFingers(landmarks, handedness);
  state.isFist = fingers === 0;

  // Détecter wave → boost
  if (VizGestures) {
    const gesture = VizGestures.recognize(landmarks, handedness);
    if (gesture === 'wave' && !state.boostActive) activateBoost();
    if (gesture === 'peace') {
      VizGestures.showBadge('peace');
    }
  }
}

// ============================================
// DÉMARRER / RELANCER
// ============================================
window.startGame = function() {
  document.getElementById('start-screen').classList.add('hidden');
  resetGameState();
  state.running = true;
  startTimer();
  gameLoop();
};

window.restartGame = function() {
  document.getElementById('gameover-screen').classList.add('hidden');
  resetGameState();
  state.running = true;
  startTimer();
  gameLoop();
};

function resetGameState() {
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.timer = 60;
  state.combo = 0;
  state.maxCombo = 0;
  state.balls = [];
  state.particles = [];
  state.boostActive = false;
  state.boostTimer = 0;
  state.frameCount = 0;
  state.spawnRate = 120;
  state.ballSpeed = 2;

  updateHUD();
  updateLives();
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
  if (!state.running) return;

  const W = gameCanvas.width;
  const H = gameCanvas.height;

  gameCtx.clearRect(0, 0, W, H);

  state.frameCount++;

  // Spawn balle
  if (state.frameCount % state.spawnRate === 0) spawnBall(W);

  // Update + dessiner balles
  updateBalls(W, H);

  // Update + dessiner particules
  updateParticles();

  // Dessiner curseur main
  drawHand(W, H);

  // Vérifier collisions
  checkCollisions();

  // Boost timer
  if (state.boostActive) {
    state.boostTimer--;
    if (state.boostTimer <= 0) state.boostActive = false;
    drawBoostBar(W, H);
  }

  // Level up
  checkLevelUp();

  animFrame = requestAnimationFrame(gameLoop);
}

// ============================================
// BALLES
// ============================================
function spawnBall(W) {
  const size = Math.random() * 20 + 20;
  const color = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
  const speed = state.ballSpeed + Math.random() * 2;
  const isBonus = Math.random() < 0.1; // 10% chance balle bonus

  state.balls.push({
    x: Math.random() * (W - size * 2) + size,
    y: -size,
    size,
    color,
    speed: state.boostActive ? speed * 0.5 : speed,
    isBonus,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 0.1
  });
}

function updateBalls(W, H) {
  state.balls = state.balls.filter(ball => {
    ball.y += ball.speed;
    ball.rotation += ball.rotSpeed;

    // Dessiner balle
    gameCtx.save();
    gameCtx.translate(ball.x, ball.y);
    gameCtx.rotate(ball.rotation);

    if (ball.isBonus) {
      // Balle bonus — étoile dorée
      drawStar(gameCtx, 0, 0, ball.size, '#ffd740');
    } else {
      // Balle normale
      gameCtx.beginPath();
      gameCtx.arc(0, 0, ball.size / 2, 0, Math.PI * 2);
      gameCtx.fillStyle = ball.color + '33';
      gameCtx.fill();
      gameCtx.strokeStyle = ball.color;
      gameCtx.lineWidth = 2;
      gameCtx.shadowColor = ball.color;
      gameCtx.shadowBlur = 12;
      gameCtx.stroke();
      gameCtx.shadowBlur = 0;
    }

    gameCtx.restore();

    // Tombée hors écran → perte de vie
    if (ball.y > H + ball.size) {
      loseLife();
      return false;
    }

    return true;
  });
}

function drawStar(ctx, cx, cy, size, color) {
  const spikes = 5;
  const outerR = size / 2;
  const innerR = outerR * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
             : ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ============================================
// MAIN / CURSEUR
// ============================================
function drawHand(W, H) {
  const { x, y, isFist, boostActive } = state;
  const hx = state.handPos.x;
  const hy = state.handPos.y;
  const radius = isFist ? 35 : 28;
  const color = boostActive ? '#ffd740' : isFist ? '#ff525f' : '#7dffa2';

  // Cercle main
  gameCtx.beginPath();
  gameCtx.arc(hx, hy, radius, 0, Math.PI * 2);
  gameCtx.fillStyle = color + '22';
  gameCtx.fill();
  gameCtx.strokeStyle = color;
  gameCtx.lineWidth = 2.5;
  gameCtx.shadowColor = color;
  gameCtx.shadowBlur = 15;
  gameCtx.stroke();
  gameCtx.shadowBlur = 0;

  // Icône
  gameCtx.font = `${isFist ? 24 : 20}px serif`;
  gameCtx.textAlign = 'center';
  gameCtx.textBaseline = 'middle';
  gameCtx.fillText(isFist ? '✊' : '🖐️', hx, hy);
}

// ============================================
// COLLISIONS
// ============================================
function checkCollisions() {
  const hx = state.handPos.x;
  const hy = state.handPos.y;
  const catchRadius = state.isFist ? 45 : 30;

  state.balls = state.balls.filter(ball => {
    const dist = Math.hypot(ball.x - hx, ball.y - hy);
    if (dist < catchRadius + ball.size / 2) {
      // Attrapée !
      const points = ball.isBonus ? 50 : 10;
      addScore(points, ball.x, ball.y, ball.color);
      spawnParticles(ball.x, ball.y, ball.color);
      return false;
    }
    return true;
  });
}

// ============================================
// SCORE + COMBO
// ============================================
function addScore(points, x, y, color) {
  state.combo++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  const multiplier = Math.min(state.combo, 10);
  const total = points * multiplier;
  state.score += total;

  // Afficher combo
  if (state.combo > 1) showCombo(state.combo);

  // Floating score text
  spawnScoreText(x, y, `+${total}`, color);

  document.getElementById('score').textContent = state.score;
}

function showCombo(combo) {
  const el = document.getElementById('combo-display');
  el.textContent = `${combo}x COMBO! 🔥`;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 800);
}

// ============================================
// VIES
// ============================================
function loseLife() {
  state.combo = 0;
  state.lives--;
  updateLives();
  screenShake();

  if (state.lives <= 0) gameOver();
}

function updateLives() {
  const hearts = document.querySelectorAll('.heart');
  hearts.forEach((h, i) => {
    h.classList.toggle('lost', i >= state.lives);
  });
}

function screenShake() {
  const wrapper = document.querySelector('.game-wrapper');
  wrapper.style.animation = 'none';
  wrapper.offsetHeight;
  wrapper.style.animation = 'shake 0.3s ease';
}

// ============================================
// PARTICULES
// ============================================
function spawnParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const speed = Math.random() * 3 + 2;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: Math.random() * 4 + 2,
      life: 1.0
    });
  }
}

function spawnScoreText(x, y, text, color) {
  state.particles.push({
    x, y,
    vx: 0, vy: -2,
    color,
    text,
    isText: true,
    size: 16,
    life: 1.0
  });
}

function updateParticles() {
  state.particles = state.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    p.vy -= 0.05;

    if (p.isText) {
      gameCtx.font = `bold ${p.size}px Space Grotesk, sans-serif`;
      gameCtx.fillStyle = p.color + Math.round(p.life * 255).toString(16).padStart(2, '0');
      gameCtx.textAlign = 'center';
      gameCtx.fillText(p.text, p.x, p.y);
    } else {
      gameCtx.beginPath();
      gameCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      gameCtx.fillStyle = p.color + Math.round(p.life * 255).toString(16).padStart(2, '0');
      gameCtx.fill();
    }

    return p.life > 0;
  });
}

// ============================================
// BOOST
// ============================================
function activateBoost() {
  state.boostActive = true;
  state.boostTimer = 180; // 3 secondes à 60fps
  VizGestures?.showBadge('wave', '👋 BOOST ACTIVÉ !');
}

function drawBoostBar(W, H) {
  const pct = state.boostTimer / 180;
  const barW = 150;
  const barH = 6;
  const bx = W / 2 - barW / 2;
  const by = H - 60;

  gameCtx.fillStyle = 'rgba(255,215,64,0.1)';
  gameCtx.beginPath();
  gameCtx.roundRect(bx, by, barW, barH, 3);
  gameCtx.fill();

  gameCtx.fillStyle = '#ffd740';
  gameCtx.shadowColor = '#ffd740';
  gameCtx.shadowBlur = 8;
  gameCtx.beginPath();
  gameCtx.roundRect(bx, by, barW * pct, barH, 3);
  gameCtx.fill();
  gameCtx.shadowBlur = 0;
}

// ============================================
// TIMER + LEVEL
// ============================================
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    state.timer--;
    document.getElementById('timer').textContent = state.timer;
    if (state.timer <= 0) gameOver();
  }, 1000);
}

function checkLevelUp() {
  const newLevel = Math.floor(state.score / 200) + 1;
  if (newLevel > state.level) {
    state.level = newLevel;
    state.spawnRate = Math.max(40, 120 - state.level * 10);
    state.ballSpeed = 2 + state.level * 0.5;
    document.getElementById('level').textContent = state.level;
    VizGestures?.showBadge('open', `⬆️ LEVEL ${state.level}!`);
  }
}

function updateHUD() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('level').textContent = state.level;
  document.getElementById('timer').textContent = state.timer;
}

// ============================================
// GAME OVER
// ============================================
function gameOver() {
  state.running = false;
  clearInterval(timerInterval);
  if (animFrame) cancelAnimationFrame(animFrame);

  document.getElementById('final-score').textContent = state.score;

  let msg = 'Continue comme ça ! 💪';
  if (state.score >= 500) msg = 'Incroyable ! Tu es une légende 🏆';
  else if (state.score >= 200) msg = 'Excellent score ! 🔥';
  else if (state.score >= 100) msg = 'Bien joué ! 👏';

  document.getElementById('final-message').textContent =
    `${msg}\nMax combo: x${state.maxCombo}`;

  document.getElementById('gameover-screen').classList.remove('hidden');
}

// ============================================
// CSS ANIMATION SHAKE
// ============================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-6px, 3px); }
    40% { transform: translate(6px, -3px); }
    60% { transform: translate(-4px, 4px); }
    80% { transform: translate(4px, -2px); }
  }
`;
document.head.appendChild(shakeStyle);