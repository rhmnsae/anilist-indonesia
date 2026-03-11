/* =============================================
   AniList Indonesia — script.js
   Jikan API v4 (MyAnimeList)
   ============================================= */

const BASE_URL = 'https://api.jikan.moe/v4';

// Rate limit queue — Jikan free: 3 req/s, 60/min
const queue = [];
let processing = false;
async function jikan(endpoint) {
  return new Promise((resolve, reject) => {
    queue.push({ endpoint, resolve, reject });
    if (!processing) processQueue();
  });
}
async function processQueue() {
  if (!queue.length) { processing = false; return; }
  processing = true;
  const { endpoint, resolve, reject } = queue.shift();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    resolve(data);
  } catch (e) { reject(e); }
  setTimeout(processQueue, 380); // ~2.6 req/s to stay safe
}

/* =============================================
   UTILITIES
   ============================================= */
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function scoreColor(score) {
  if (!score || score === 0) return '#6b7280';
  if (score >= 8) return '#10b981';
  if (score >= 6) return '#d97706';
  return '#ef4444';
}

function formatNum(n) {
  if (!n) return 'N/A';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'rb';
  return n.toString();
}

async function translateText(text) {
  if (!text) return '';
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    let translated = '';
    data[0].forEach(t => { translated += t[0] });
    return translated;
  } catch (e) {
    console.error('Translation failed', e);
    return text;
  }
}

function typeLabel(type) {
  const map = { TV:'TV', Movie:'Film', OVA:'OVA', ONA:'ONA', Special:'Spesial', Music:'Musik' };
  return map[type] || type || '?';
}
function statusLabel(s) {
  const map = { 'Currently Airing':'Tayang', 'Finished Airing':'Selesai', 'Not yet aired':'Segera', 'Not yet aired':'Segera' };
  return map[s] || s || 'N/A';
}
function ratingLabel(r) {
  const map = { 'G - All Ages':'Semua Umur', 'PG - Children':'Anak-anak', 'PG-13 - Teens 13 or older':'13+', 'R - 17+ (violence & profanity)':'17+', 'R+ - Mild Nudity':'17+ (Kekerasan)', 'Rx - Hentai':'18+' };
  return map[r] || r || 'N/A';
}
function seasonLabel(s) {
  if (!s) return '';
  const map = { winter:'Winter', spring:'Spring', summer:'Summer', fall:'Fall' };
  return map[s.toLowerCase()] || s;
}

function buildAnimeCard(anime) {
  const type = typeLabel(anime.type);
  const score = anime.score ? anime.score.toFixed(1) : 'N/A';
  const airing = anime.airing;
  const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const eps = anime.episodes ? `${anime.episodes} eps` : '';

  const card = document.createElement('div');
  card.className = 'anime-card';
  card.innerHTML = `
    <div class="card-poster">
      <img src="${img}" alt="${anime.title}" loading="lazy" onerror="this.style.display='none'" />
      <span class="card-badge ${(anime.type||'').toLowerCase()}">${type}</span>
      ${score !== 'N/A' ? `<span class="card-score">★ ${score}</span>` : ''}
      ${airing ? '<span class="card-airing"></span>' : ''}
      <div class="card-overlay">
        <p class="card-overlay-text idx-synopsis" data-synopsis="${(anime.synopsis || '').replace(/"/g, '&quot;')}">Memuat sinopsis...</p>
      </div>
    </div>
    <div class="card-info">
      <p class="card-title">${anime.title}</p>
      <div class="card-meta">
        ${eps ? `<span class="card-meta-item">${eps}</span>` : ''}
        ${eps && anime.year ? '<span class="card-meta-dot"></span>' : ''}
        ${anime.year ? `<span class="card-meta-item">${anime.year}</span>` : ''}
      </div>
    </div>`;
  card.addEventListener('click', () => openModal(anime.mal_id));
  card.addEventListener('mouseenter', async () => {
    const synEl = card.querySelector('.idx-synopsis');
    if (synEl && !synEl.dataset.translated && synEl.dataset.synopsis) {
      synEl.dataset.translated = 'true';
      let sliced = synEl.dataset.synopsis.substring(0, 75).trim() + '...';
      
      // Creating a toggle structure for the tooltip
      synEl.innerHTML = `
        <span class="syn-text">${sliced}</span>
        <button class="syn-toggle" style="pointer-events:all;">Terjemahkan (ID)</button>
      `;
      
      const btn = synEl.querySelector('.syn-toggle');
      const textSpan = synEl.querySelector('.syn-text');
      
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btn.dataset.loading) return;
        
        if (btn.dataset.mode === 'id') {
          textSpan.textContent = sliced;
          btn.textContent = 'Terjemahkan (ID)';
          btn.dataset.mode = 'en';
        } else {
          if (!synEl.dataset.idText) {
            btn.dataset.loading = 'true';
            btn.textContent = 'Menerjemahkan...';
            try {
              const trans = await translateText(sliced);
              synEl.dataset.idText = trans;
              textSpan.textContent = trans;
              btn.textContent = 'Lihat Asli (EN)';
              btn.dataset.mode = 'id';
            } catch (err) {
              btn.textContent = 'Gagal (Coba Lagi)';
            }
            delete btn.dataset.loading;
          } else {
            textSpan.textContent = synEl.dataset.idText;
            btn.textContent = 'Lihat Asli (EN)';
            btn.dataset.mode = 'id';
          }
        }
      });
    } else if (synEl && !synEl.dataset.synopsis) {
      synEl.textContent = 'Tidak ada sinopsis.';
    }
  }, { once: true });
  return card;
}

function buildTopItem(anime, rank) {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
  const score = anime.score ? anime.score.toFixed(1) : 'N/A';
  const img = anime.images?.jpg?.image_url || '';
  const item = document.createElement('div');
  item.className = 'top-item';
  item.innerHTML = `
    <div class="top-rank ${rankClass}">${rank}</div>
    <div class="top-thumb"><img src="${img}" alt="${anime.title}" loading="lazy" /></div>
    <div class="top-info">
      <p class="top-title">${anime.title}</p>
      <div class="top-details">
        <span class="top-detail-chip">${typeLabel(anime.type)}</span>
        ${anime.year ? `<span class="top-detail-chip">${anime.year}</span>` : ''}
        <span class="top-detail-chip">${statusLabel(anime.status)}</span>
      </div>
    </div>
    <div class="top-score">
      <span class="top-score-val" style="color:${scoreColor(anime.score)}">★ ${score}</span>
      <span class="top-score-label">Nilai</span>
    </div>`;
  item.addEventListener('click', () => openModal(anime.mal_id));
  return item;
}

function renderPagination(container, currentPage, lastPage, onPageChange) {
  container.innerHTML = '';
  if (lastPage <= 1) return;

  const addBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', () => onPageChange(page));
    container.appendChild(btn);
  };

  addBtn('←', currentPage - 1, currentPage === 1);

  let pages = [];
  if (lastPage <= 7) {
    pages = Array.from({ length: lastPage }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(lastPage - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < lastPage - 2) pages.push('...');
    pages.push(lastPage);
  }

  pages.forEach(p => {
    if (p === '...') {
      const el = document.createElement('span');
      el.className = 'page-btn'; el.textContent = '…'; el.style.pointerEvents = 'none';
      container.appendChild(el);
    } else {
      addBtn(p, p, false, p === currentPage);
    }
  });

  addBtn('→', currentPage + 1, currentPage === lastPage);
}

/* =============================================
   SKELETON BUILDERS
   ============================================= */
function getSkeletonCards(count = 10) {
  let html = '';
  for(let i=0; i<count; i++) {
    html += `
    <div class="anime-card" style="pointer-events:none; border-color:transparent; box-shadow:none;">
      <div class="card-poster skeleton" style="border-radius:0;"></div>
      <div class="card-info">
        <div class="skeleton" style="height:16px; width:90%; margin-bottom:.5rem;"></div>
        <div class="skeleton" style="height:16px; width:60%; margin-bottom:.5rem;"></div>
        <div style="display:flex; gap:.4rem; margin-top:auto;">
          <div class="skeleton" style="height:12px; width:30px; border-radius:4px;"></div>
          <div class="skeleton" style="height:12px; width:40px; border-radius:4px;"></div>
        </div>
      </div>
    </div>`;
  }
  return html;
}

function getSkeletonTopItems(count = 5) {
  let html = '';
  for(let i=0; i<count; i++) {
    html += `
    <div class="top-item" style="pointer-events:none; border-color:transparent; box-shadow:none;">
      <div class="top-rank skeleton" style="background:transparent;"></div>
      <div class="top-thumb skeleton" style="border-radius:6px;"></div>
      <div class="top-info">
        <div class="skeleton" style="height:16px; width:80%; margin-bottom:.6rem;"></div>
        <div style="display:flex; gap:.5rem;">
          <div class="skeleton" style="height:16px; width:48px; border-radius:4px;"></div>
          <div class="skeleton" style="height:16px; width:64px; border-radius:4px;"></div>
        </div>
      </div>
      <div class="top-score">
        <div class="skeleton" style="height:18px; width:40px; margin-bottom:.4rem; border-radius:4px;"></div>
        <div class="skeleton" style="height:12px; width:30px; border-radius:4px;"></div>
      </div>
    </div>`;
  }
  return html;
}

function getSkeletonModal() {
  return `
    <div class="modal-top">
      <div class="modal-poster skeleton"></div>
      <div class="modal-info">
        <div class="skeleton" style="height:36px; width:70%; margin-bottom:1.5rem; border-radius:8px;"></div>
        <div style="display:flex; gap:.6rem; margin-bottom:2rem;">
          <div class="skeleton" style="height:26px; width:70px; border-radius:6px;"></div>
          <div class="skeleton" style="height:26px; width:60px; border-radius:6px;"></div>
        </div>
        <div style="display:flex; gap:1.5rem; margin-bottom:2rem;">
          <div class="skeleton" style="height:44px; width:60px; border-radius:6px;"></div>
          <div class="skeleton" style="height:44px; width:70px; border-radius:6px;"></div>
          <div class="skeleton" style="height:44px; width:50px; border-radius:6px;"></div>
        </div>
        <div class="skeleton" style="height:112px; width:112px; border-radius:var(--radius); margin-bottom:2rem;"></div>
        <div class="skeleton" style="height:40px; width:190px; border-radius:8px;"></div>
      </div>
    </div>
    <div class="skeleton" style="height:24px; width:180px; margin-bottom:1.2rem; border-radius:6px;"></div>
    <div class="skeleton" style="height:14px; width:100%; margin-bottom:.6rem; border-radius:4px;"></div>
    <div class="skeleton" style="height:14px; width:95%; margin-bottom:.6rem; border-radius:4px;"></div>
    <div class="skeleton" style="height:14px; width:85%; margin-bottom:2rem; border-radius:4px;"></div>
  `;
}

/* =============================================
   SCHEDULE
   ============================================= */
const DAY_MAP = {
  monday:'Senin', tuesday:'Selasa', wednesday:'Rabu',
  thursday:'Kamis', friday:'Jumat', saturday:'Sabtu', sunday:'Minggu'
};
let scheduleCache = {};
let currentDay = 'monday';

async function loadSchedule(day) {
  currentDay = day;
  const grid = $('scheduleGrid');
  grid.innerHTML = getSkeletonCards(10);

  if (scheduleCache[day]) { renderSchedule(scheduleCache[day]); return; }

  try {
    const data = await jikan(`/schedules/${day}?sfw&limit=25`);
    scheduleCache[day] = data.data || [];
    renderSchedule(scheduleCache[day]);
  } catch (e) {
    grid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>Gagal memuat jadwal. Coba lagi.</p>
        <button class="btn btn-outline btn-sm" onclick="loadSchedule('${day}')">Coba Lagi</button>
      </div>`;
  }
}

function renderSchedule(list) {
  const grid = $('scheduleGrid');
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><p>Tidak ada anime untuk hari ini.</p></div>';
    return;
  }
  list.forEach(a => grid.appendChild(buildAnimeCard(a)));
}

// Day tab switching
qsa('.day-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qsa('.day-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadSchedule(tab.dataset.day);
  });
});

/* =============================================
   ANIME LIST
   ============================================= */
let animeListPage = 1;
let animeSearchTimeout = null;
let currentAnimeQuery = { q: '', type: '', status: '', rating: '', order_by: 'score' };

async function loadAnimeList(page = 1) {
  animeListPage = page;
  const grid = $('animeGrid');
  const pagination = $('animePagination');
  grid.innerHTML = getSkeletonCards(14);
  pagination.innerHTML = '';

  const params = new URLSearchParams({ page, limit: 20, sfw: true });
  if (currentAnimeQuery.q) params.set('q', currentAnimeQuery.q);
  if (currentAnimeQuery.type) params.set('type', currentAnimeQuery.type);
  if (currentAnimeQuery.status) params.set('status', currentAnimeQuery.status);
  if (currentAnimeQuery.rating) params.set('rating', currentAnimeQuery.rating);
  params.set('order_by', currentAnimeQuery.order_by || 'score');
  params.set('sort', 'desc');

  try {
    const data = await jikan(`/anime?${params}`);
    const list = data.data || [];
    const lastPage = data.pagination?.last_visible_page || 1;

    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state"><p>Tidak ada anime yang ditemukan.</p></div>';
      return;
    }
    list.forEach(a => grid.appendChild(buildAnimeCard(a)));
    renderPagination(pagination, page, lastPage, loadAnimeList);
  } catch (e) {
    grid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>Gagal memuat daftar anime.</p>
        <button class="btn btn-outline btn-sm" onclick="loadAnimeList(${page})">Coba Lagi</button>
      </div>`;
  }
}

// Search input
$('animeSearch').addEventListener('input', e => {
  clearTimeout(animeSearchTimeout);
  animeSearchTimeout = setTimeout(() => {
    currentAnimeQuery.q = e.target.value.trim();
    loadAnimeList(1);
  }, 600);
});

// Filters
$('typeFilter').addEventListener('change', e => { currentAnimeQuery.type = e.target.value; loadAnimeList(1); });
$('statusFilter').addEventListener('change', e => { currentAnimeQuery.status = e.target.value; loadAnimeList(1); });
$('ratingFilter').addEventListener('change', e => { currentAnimeQuery.rating = e.target.value; loadAnimeList(1); });
$('orderFilter').addEventListener('change', e => { currentAnimeQuery.order_by = e.target.value; loadAnimeList(1); });

/* =============================================
   SEASONAL
   ============================================= */
let seasonalPage = 1;

function initSeasonSelector() {
  const yearSel = $('seasonYear');
  const seasonSel = $('seasonName');
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // current season
  let curSeason = 'winter';
  if (curMonth >= 4 && curMonth <= 6) curSeason = 'spring';
  else if (curMonth >= 7 && curMonth <= 9) curSeason = 'summer';
  else if (curMonth >= 10 && curMonth <= 12) curSeason = 'fall';

  for (let y = curYear; y >= 1990; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    yearSel.appendChild(opt);
  }
  yearSel.value = curYear;

  // set current season option
  qsa('option', seasonSel).forEach(o => { if (o.value === curSeason) o.selected = true; });
}

async function loadSeasonal(page = 1) {
  seasonalPage = page;
  const year = $('seasonYear').value;
  const season = $('seasonName').value;
  const grid = $('seasonalGrid');
  const pagination = $('seasonalPagination');

  grid.innerHTML = getSkeletonCards(14);
  pagination.innerHTML = '';

  try {
    const data = await jikan(`/seasons/${year}/${season}?page=${page}&limit=20&sfw`);
    const list = data.data || [];
    const lastPage = data.pagination?.last_visible_page || 1;
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state"><p>Tidak ada anime untuk musim ini.</p></div>';
      return;
    }
    list.forEach(a => grid.appendChild(buildAnimeCard(a)));
    renderPagination(pagination, page, lastPage, loadSeasonal);
  } catch (e) {
    grid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>Gagal memuat anime musiman.</p>
        <button class="btn btn-outline btn-sm" onclick="loadSeasonal(${page})">Coba Lagi</button>
      </div>`;
  }
}

$('loadSeasonBtn').addEventListener('click', () => loadSeasonal(1));

/* =============================================
   TOP ANIME
   ============================================= */
let topPage = 1;
let currentTopType = 'bypopularity';

async function loadTop(page = 1, type = currentTopType) {
  topPage = page; currentTopType = type;
  const list = $('topList');
  const pagination = $('topPagination');
  list.innerHTML = getSkeletonTopItems(5);
  pagination.innerHTML = '';

  try {
    let apiType = type;
    if (type === 'byScore') {
      // For score we actually just want the base top endpoint ordered by score.
      // Jikan doesn't have a 'byScore' filter, it's just the default ordering by score descending.
      apiType = '';
    }
    const endpoint = `/top/anime?page=${page}&limit=20&type=tv${apiType ? `&filter=${apiType}` : ''}`;
    const data = await jikan(endpoint);
    const items = data.data || [];
    const lastPage = data.pagination?.last_visible_page || 1;
    list.innerHTML = '';
    items.forEach((a, i) => list.appendChild(buildTopItem(a, (page-1)*20 + i + 1)));
    renderPagination(pagination, page, lastPage, p => loadTop(p, type));
  } catch (e) {
    list.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>Gagal memuat data.</p>
        <button class="btn btn-outline btn-sm" onclick="loadTop(${page},'${type}')">Coba Lagi</button>
      </div>`;
  }
}

qsa('.top-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qsa('.top-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadTop(1, tab.dataset.type);
  });
});

/* ==============================================
   MODAL
   ============================================= */
const overlay = $('modalOverlay');
const closeBtn = $('modalClose');

async function openModal(id) {
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  $('modalContent').innerHTML = getSkeletonModal();

  try {
    const [animeRes, charRes] = await Promise.all([
      jikan(`/anime/${id}/full`),
      jikan(`/anime/${id}/characters`).catch(() => ({ data: [] }))
    ]);
    const a = animeRes.data;
    renderModal(a, charRes.data || []);
  } catch (e) {
    $('modalContent').innerHTML = `
      <div class="error-state" style="min-height:300px">
        <div class="error-icon">⚠</div>
        <p>Gagal memuat detail anime.</p>
        <button class="btn btn-outline btn-sm" onclick="openModal(${id})">Coba Lagi</button>
      </div>`;
  }
}

function renderModal(a, chars) {
  const img = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '';
  const score = a.score ? a.score.toFixed(2) : 'N/A';
  const scoreNum = a.score || 0;
  const scorePercent = (scoreNum / 10) * 100;
  const circumference = 2 * Math.PI * 34;
  const dash = circumference - (scorePercent / 100) * circumference;
  const scoreCol = scoreColor(scoreNum);

  const studios = (a.studios || []).map(s => s.name).join(', ') || 'N/A';
  const genres = (a.genres || []);
  const themes = (a.themes || []);
  const allGenres = [...genres, ...themes];

  const topChars = chars.slice(0, 6);

  $('modalContent').innerHTML = `
    <div class="modal-top">
      <div class="modal-poster">
        <img src="${img}" alt="${a.title}" onerror="this.style.display='none'" />
      </div>
      <div class="modal-info">
        <h2 class="modal-title">${a.title}</h2>
        ${a.title_english && a.title_english !== a.title ? `<p class="modal-alt-title">${a.title_english}</p>` : ''}
        ${a.title_japanese ? `<p class="modal-alt-title" style="font-style:italic">${a.title_japanese}</p>` : ''}

        <div class="modal-chips">
          <span class="modal-chip ${a.airing ? 'green' : ''}">${statusLabel(a.status)}</span>
          <span class="modal-chip blue">${typeLabel(a.type)}</span>
          ${a.rating ? `<span class="modal-chip orange">${ratingLabel(a.rating)}</span>` : ''}
        </div>

        <div class="modal-stats">
          <div class="modal-stat">
            <span class="modal-stat-val" style="color:${scoreCol}">★ ${score}</span>
            <span class="modal-stat-label">Nilai MAL</span>
          </div>
          <div class="modal-stat">
            <span class="modal-stat-val">#${a.rank || 'N/A'}</span>
            <span class="modal-stat-label">Peringkat</span>
          </div>
          <div class="modal-stat">
            <span class="modal-stat-val">#${a.popularity || 'N/A'}</span>
            <span class="modal-stat-label">Popularitas</span>
          </div>
          <div class="modal-stat">
            <span class="modal-stat-val">${formatNum(a.members)}</span>
            <span class="modal-stat-label">Member</span>
          </div>
          <div class="modal-stat">
            <span class="modal-stat-val">${formatNum(a.favorites)}</span>
            <span class="modal-stat-label">Favorit</span>
          </div>
        </div>

        <div class="score-ring">
          <div class="score-circle">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle class="score-circle-bg" cx="40" cy="40" r="34" />
              <circle class="score-circle-fill" cx="40" cy="40" r="34"
                stroke="${scoreCol}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dash}" />
            </svg>
            <div class="score-circle-text" style="color:${scoreCol}">${score}</div>
          </div>
          <span style="font-size:.72rem;color:var(--text-dim)">Skor dari ${formatNum(a.scored_by)} pengguna</span>
        </div>

        <a href="${a.url}" target="_blank" rel="noopener" class="modal-mal-link">
          Lihat di MyAnimeList ↗
        </a>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;">
      <h4 class="modal-section-title" style="margin-bottom:0;">Sinopsis</h4>
      ${a.synopsis ? `<button id="modalTranslateBtn" class="btn btn-outline btn-sm" style="padding:.25rem .6rem;font-size:.7rem;border-radius:6px;">Terjemahkan (ID)</button>` : ''}
    </div>
    
    ${a.synopsis ? `
    <p class="modal-synopsis" id="modalSynopsisContent">${a.synopsis}</p>
    ` : '<p class="modal-synopsis">Tidak ada sinopsis.</p>'}

    ${allGenres.length ? `
    <h4 class="modal-section-title">Genre & Tema</h4>
    <div class="modal-genres">
      ${allGenres.map(g => `<span class="modal-genre">${g.name}</span>`).join('')}
    </div>
    ` : ''}

    <h4 class="modal-section-title">Informasi</h4>
    <table class="modal-table">
      <tr><td>Studio</td><td>${studios}</td></tr>
      <tr><td>Episode</td><td>${a.episodes || '?'} eps</td></tr>
      <tr><td>Durasi</td><td>${a.duration || 'N/A'}</td></tr>
      <tr><td>Tayang</td><td>${a.aired?.string || 'N/A'}</td></tr>
      <tr><td>Musim</td><td>${a.season ? seasonLabel(a.season) + ' ' + (a.year||'') : 'N/A'}</td></tr>
      <tr><td>Sumber</td><td>${a.source || 'N/A'}</td></tr>
      <tr><td>Rating</td><td>${ratingLabel(a.rating)}</td></tr>
      ${a.broadcast?.string ? `<tr><td>Jadwal Tayang</td><td>${a.broadcast.string}</td></tr>` : ''}
    </table>

    ${topChars.length ? `
    <h4 class="modal-section-title" style="margin-top:1.5rem">Karakter</h4>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
      ${topChars.map(c => `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;font-size:.78rem;">
          <img src="${c.character?.images?.jpg?.image_url||''}" alt="${c.character?.name||''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:var(--bg);" onerror="this.style.display='none'" />
          <span style="color:var(--text)">${c.character?.name||''}</span>
          <span style="color:var(--text-dim);font-size:.7rem">${c.role||''}</span>
        </div>`).join('')}
    </div>
    ` : ''}
    
    <div id="modalScrollHint" class="modal-scroll-hint">
      Geser ke bawah
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M19 12l-7 7-7-7"/>
      </svg>
    </div>
  `;

  document.body.style.overflow = 'hidden';
  $('modalOverlay').classList.add('open');

  const modalScrollArea = document.querySelector('.modal');
  const scrollHint = $('modalScrollHint');
  
  if (modalScrollArea && scrollHint) {
    // Check if scrollable
    setTimeout(() => {
      if (modalScrollArea.scrollHeight <= modalScrollArea.clientHeight + 20) {
        scrollHint.classList.add('hide');
      }
    }, 150);

    modalScrollArea.onscroll = () => {
      if (modalScrollArea.scrollTop > 50) {
        scrollHint.classList.add('hide');
      }
    };
    
    // Fallback: clicking the hint scrolls down
    scrollHint.onclick = () => {
      modalScrollArea.scrollBy({ top: 300, behavior: 'smooth' });
    };
  }

  if (a.synopsis) {
    const btn = $('modalTranslateBtn');
    const content = $('modalSynopsisContent');
    let idText = '';
    
    btn.addEventListener('click', async () => {
      if (btn.dataset.loading) return;
      
      if (btn.dataset.mode === 'id') {
        content.textContent = a.synopsis;
        btn.textContent = 'Terjemahkan (ID)';
        btn.dataset.mode = 'en';
      } else {
        if (!idText) {
          btn.dataset.loading = 'true';
          btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:.3rem;border-width:2px;"></span>Menerjemahkan...`;
          try {
            idText = await translateText(a.synopsis);
            content.textContent = idText;
            btn.textContent = 'Lihat Asli (EN)';
            btn.dataset.mode = 'id';
          } catch (e) {
            btn.textContent = 'Gagal (Coba lagi)';
          }
          delete btn.dataset.loading;
        } else {
          content.textContent = idText;
          btn.textContent = 'Lihat Asli (EN)';
          btn.dataset.mode = 'id';
        }
      }
    });
  }
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* =============================================
   HEADER SCROLL + NAV HIGHLIGHTING
   ============================================= */
const header = $('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 30);

  // Active nav highlight
  const sections = ['beranda','jadwal','daftar','musiman','populer'];
  let current = 'beranda';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 120) current = id;
  });
  qsa('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === current);
  });
}, { passive: true });

/* =============================================
   MOBILE NAV
   ============================================= */
const hamburger = $('hamburger');
const navMenu = $('navMenu');
const navOverlay = $('navOverlay');

function closeMobileNav() {
  hamburger.classList.remove('open');
  navMenu.classList.remove('open');
  if(navOverlay) navOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  navMenu.classList.toggle('open');
  if(navOverlay) navOverlay.classList.toggle('open');
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

qsa('.nav-link').forEach(l => l.addEventListener('click', closeMobileNav));
if(navOverlay) navOverlay.addEventListener('click', closeMobileNav);

/* =============================================
   SMOOTH SCROLL
   ============================================= */
qsa('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* =============================================
   INTERSECTION OBSERVER Placeholder
   (Moved to DOMContentLoaded to prevent race conditions)
   ============================================= */

/* =============================================
   CUSTOM SELECT UI
   ============================================= */
function createCustomSelect(selectElement) {
  selectElement.style.display = 'none';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  selectElement.parentNode.insertBefore(wrapper, selectElement);
  wrapper.appendChild(selectElement);
  
  const selectedDiv = document.createElement('div');
  selectedDiv.className = 'custom-select';
  
  const selectedText = document.createElement('span');
  selectedText.style.flex = '1';
  selectedText.style.whiteSpace = 'nowrap';
  selectedText.style.overflow = 'hidden';
  selectedText.style.textOverflow = 'ellipsis';
  selectedText.textContent = selectElement.options[selectElement.selectedIndex]?.textContent || '';
  selectedDiv.appendChild(selectedText);
  
  const icon = document.createElement('div');
  icon.className = 'custom-select-icon';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
  selectedDiv.appendChild(icon);
  
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'custom-select-options';
  
  Array.from(selectElement.options).forEach((opt, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'custom-select-option' + (opt.selected ? ' selected' : '');
    optionDiv.textContent = opt.textContent;
    
    optionDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      selectElement.selectedIndex = index;
      selectElement.dispatchEvent(new Event('change'));
      
      selectedText.textContent = opt.textContent;
      wrapper.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
      optionDiv.classList.add('selected');
      closeAllCustomSelects();
    });
    optionsDiv.appendChild(optionDiv);
  });
  
  wrapper.appendChild(selectedDiv);
  wrapper.appendChild(optionsDiv);
  
  selectedDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = selectedDiv.classList.contains('open');
    closeAllCustomSelects();
    if (!isOpen) {
      selectedDiv.classList.add('open');
      optionsDiv.classList.add('open');
    }
  });
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.custom-select-options.open').forEach(el => el.classList.remove('open'));
}
document.addEventListener('click', closeAllCustomSelects);

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initSeasonSelector();
  
  // Initialize custom selects
  qsa('.filter-select').forEach(sel => createCustomSelect(sel));

  // Set currently airing day tab as active based on local time
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayDay = days[new Date().getDay()];
  qsa('.day-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === todayDay);
  });
  currentDay = todayDay;

  // Initialize intersection observer for lazy-loading sections
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      if (id === 'jadwal'   && !scheduleCache[currentDay]) loadSchedule(currentDay);
      if (id === 'daftar')  loadAnimeList(1);
      if (id === 'musiman') loadSeasonal(1);
      if (id === 'populer') loadTop(1);
      sectionObserver.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  ['jadwal','daftar','musiman','populer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  // Load hero-visible section immediately
});
