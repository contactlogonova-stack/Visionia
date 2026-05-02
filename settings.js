/* ============================================
   VISIONAI — settings.js
   Gestion des paramètres persistants
   ============================================ */

const MODEL_HINTS = {
  performance: 'High speed, lower confidence thresholds. Optimized for edge devices.',
  balanced: 'Best of both worlds. Recommended for most use cases.',
  accuracy: 'Maximum precision, higher latency. Best for detailed analysis.'
};

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});

// ---- CHARGER SETTINGS ----
function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('visionai_settings') || '{}');

  if (saved.alertPerson !== undefined)
    document.getElementById('alert-person').checked = saved.alertPerson;
  if (saved.alertMotion !== undefined)
    document.getElementById('alert-motion').checked = saved.alertMotion;
  if (saved.alertLowconf !== undefined)
    document.getElementById('alert-lowconf').checked = saved.alertLowconf;
  if (saved.alertDrowsy !== undefined)
    document.getElementById('alert-drowsy').checked = saved.alertDrowsy;
  if (saved.showScanlines !== undefined)
    document.getElementById('show-scanlines').checked = saved.showScanlines;
  if (saved.showLatency !== undefined)
    document.getElementById('show-latency').checked = saved.showLatency;

  if (saved.model) {
    const btns = document.querySelectorAll('.segment-btn');
    btns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.trim().toLowerCase() === saved.model) {
        btn.classList.add('active');
        document.getElementById('model-hint').textContent = MODEL_HINTS[saved.model];
      }
    });
  }
}

// ---- SAUVEGARDER ----
function saveSettings() {
  const settings = {
    alertPerson: document.getElementById('alert-person').checked,
    alertMotion: document.getElementById('alert-motion').checked,
    alertLowconf: document.getElementById('alert-lowconf').checked,
    alertDrowsy: document.getElementById('alert-drowsy').checked,
    showScanlines: document.getElementById('show-scanlines').checked,
    showLatency: document.getElementById('show-latency').checked,
    model: document.querySelector('.segment-btn.active')?.textContent.trim().toLowerCase() || 'performance'
  };

  localStorage.setItem('visionai_settings', JSON.stringify(settings));
  showToast();
}

// ---- SEGMENT MODEL ----
function selectModel(btn, model) {
  document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('model-hint').textContent = MODEL_HINTS[model] || '';
  saveSettings();
}

// ---- RESET ----
function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  localStorage.removeItem('visionai_settings');
  location.reload();
}

// ---- CLEAR CACHE ----
function clearCache() {
  if (!confirm('Clear session stats and gallery? This cannot be undone.')) return;
  localStorage.removeItem('visionai_stats');
  localStorage.removeItem('visionai_gallery');
  showToast('Cache cleared ✓');
}

// ---- TOAST ----
function showToast(msg = 'Settings saved') {
  const toast = document.getElementById('save-toast');
  toast.querySelector('span:last-child').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}
