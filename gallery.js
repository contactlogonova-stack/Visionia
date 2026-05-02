/* ============================================
   VISIONAI — gallery.js
   Gestion de la galerie de screenshots
   ============================================ */

let allSnapshots = [];
let currentFilter = 'all';
let currentSearch = '';

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadGallery();
});

function loadGallery() {
  allSnapshots = JSON.parse(localStorage.getItem('visionai_gallery') || '[]');
  updateGalleryCount();
  renderGallery();
}

function updateGalleryCount() {
  const el = document.getElementById('gallery-count');
  if (el) el.textContent = allSnapshots.length;
}

// ---- RENDER ----
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');

  let filtered = allSnapshots;

  // Filtre par tag
  if (currentFilter !== 'all') {
    filtered = filtered.filter(snap =>
      snap.tags && snap.tags.some(t => t.toLowerCase().includes(currentFilter))
    );
  }

  // Filtre par recherche
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(snap =>
      snap.tags && snap.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Vider le grid (sans toucher à l'empty state)
  Array.from(grid.children).forEach(child => {
    if (child.id !== 'gallery-empty') child.remove();
  });

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';

  filtered.forEach(snap => {
    const card = createCard(snap);
    grid.appendChild(card);
  });
}

function createCard(snap) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.onclick = () => openLightbox(snap);

  const date = new Date(snap.timestamp);
  const timeStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    + ' · ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const tagsHTML = (snap.tags || []).slice(0, 3).map(t => `
    <span class="gallery-tag">
      <span style="width:5px;height:5px;border-radius:50%;background:#7dffa2;display:inline-block;"></span>
      ${t}
    </span>`).join('');

  card.innerHTML = `
    <div class="gallery-card-thumb">
      <img src="${snap.dataUrl}" alt="Snapshot" loading="lazy"/>
      <span class="gallery-card-cam">CAM-01</span>
    </div>
    <div class="gallery-card-body">
      <div class="gallery-card-meta">
        <span class="gallery-card-time">${timeStr}</span>
        <span class="gallery-card-conf">${snap.confidence || '--'}%</span>
      </div>
      <div class="gallery-card-tags">${tagsHTML || '<span class="gallery-card-time">No tags</span>'}</div>
    </div>`;

  return card;
}

// ---- FILTRES ----
function filterByTag(tag, el) {
  currentFilter = tag;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderGallery();
}

function filterGallery(query) {
  currentSearch = query;
  renderGallery();
}

// ---- LIGHTBOX ----
function openLightbox(snap) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const meta = document.getElementById('lightbox-meta');
  const dl = document.getElementById('lightbox-download');

  img.src = snap.dataUrl;
  dl.href = snap.dataUrl;
  dl.download = `visionai-${snap.id}.png`;

  const date = new Date(snap.timestamp);
  const tags = (snap.tags || []).join(', ') || 'None';
  meta.textContent = `${date.toLocaleString('fr-FR')} · Objects: ${tags}`;

  lightbox.classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
}

// Fermer avec Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

// ---- CLEAR GALLERY ----
function clearGallery() {
  if (allSnapshots.length === 0) return;
  if (!confirm('Delete all snapshots? This cannot be undone.')) return;
  localStorage.removeItem('visionai_gallery');
  allSnapshots = [];
  updateGalleryCount();
  renderGallery();
  const empty = document.getElementById('gallery-empty');
  if (empty) empty.style.display = 'flex';
}
