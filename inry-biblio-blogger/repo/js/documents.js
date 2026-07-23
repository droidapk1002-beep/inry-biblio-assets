/* ============================================================
   DOCUMENT CARDS + FILTERING ENGINE
   ============================================================ */

var FAV_KEY = 'inry_favorites';
var RECENT_KEY = 'inry_recent';
var HIDDEN_DOCS_KEY = 'inry_hidden_doc_ids';
function getHiddenIds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveHiddenIds(ids) {
  localStorage.setItem(HIDDEN_DOCS_KEY, JSON.stringify(ids));
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavorites(ids) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}
function toggleFavorite(docId) {
  var favs = getFavorites();
  var idx = favs.indexOf(docId);
  if (idx >= 0) { favs.splice(idx, 1); } else { favs.push(docId); }
  saveFavorites(favs);
  return idx < 0;
}
function isFavorite(docId) {
  return getFavorites().indexOf(docId) >= 0;
}

function getRecentDocs() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentDoc(docId) {
  var recent = getRecentDocs();
  var idx = recent.indexOf(docId);
  if (idx >= 0) recent.splice(idx, 1);
  recent.unshift(docId);
  if (recent.length > 20) recent = recent.slice(0, 20);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function docCardHTML(doc) {
  const subject = APP.db.subjects.find(s => s.id === doc.subject);
  const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
  const trimestreName = APP.db.trimestres?.find(tr => tr.id === doc.trimestre);
  var isFav = isFavorite(doc.id);

  return `
    <article class="doc-card" data-doc-id="${escapeAttr(doc.id)}">
      <span class="host-tag">${escapeHTML(doc.host)}</span>
      <div class="doc-card-head">
        <span class="doc-badge type-${escapeAttr(doc.type)}">${escapeHTML(typeName ? localized(typeName.name) : doc.type)}</span>
        <span class="doc-year ltr-only">${escapeHTML(doc.year || '')}</span>
      </div>
      <div class="doc-card-body">
        <h3 class="doc-title">${escapeHTML(localized(doc.title))}</h3>
        <div class="doc-meta-row">
          <span>${icon('fileText')} ${escapeHTML(''+doc.pages)} ${t('card.pages')}</span>
          <span>${icon('download')} <span class="ltr-only">${escapeHTML(doc.downloads?.toLocaleString() || '0')}</span> ${t('card.downloads')}</span>
          ${doc.rating ? `<span>${icon('star')} <span class="ltr-only">${escapeHTML(''+doc.rating)}</span></span>` : ''}
        </div>
        <div class="doc-meta-row">
          ${subject ? `<span style="color:${escapeAttr(subject.color)}; font-weight:700;">${escapeHTML(localized(subject.name))}</span>` : ''}
          ${trimestreName ? `<span>· ${escapeHTML(localized(trimestreName.name))}</span>` : ''}
        </div>
      </div>
      <div class="doc-card-foot">
        <button class="btn btn-secondary doc-fav-btn" data-doc-id="${escapeAttr(doc.id)}" title="${escapeAttr(isFav ? 'Retirer des favoris' : 'Ajouter aux favoris')}" style="padding:var(--space-2);flex:0;color:${isFav ? 'var(--red-stamp)' : 'var(--ink-soft)'};">${icon(isFav ? 'heart' : 'heart')}</button>
        <button class="btn btn-secondary doc-preview-btn" data-doc-id="${escapeAttr(doc.id)}">${icon('eye')} ${t('card.preview')}</button>
        <a class="btn btn-primary" href="${escapeAttr(doc.downloadUrl)}" target="_blank" rel="noopener">${icon('download')} ${t('card.download')}</a>
      </div>
    </article>
  `;
}

function emptyStateHTML() {
  return `
    <div class="empty-state">
      ${icon('search')}
      <h3>${t('empty.title')}</h3>
      <p>${t('empty.subtitle')}</p>
    </div>
  `;
}

function getFilteredDocs() {
  const f = APP.filters;
  const hiddenIds = new Set(getHiddenIds());
  return APP.db.documents.filter(doc => {
    if (hiddenIds.has(doc.id)) return false;
    if (f.level && doc.level !== f.level) return false;
    if (f.levelGroup && !f.level) {
      const group = APP.db.levels.find(g => g.id === levelGroupToDbId(f.levelGroup));
      if (group && !group.years.some(y => y.id === doc.level)) return false;
    }
    if (f.stream && doc.stream !== f.stream) return false;
    if (f.subject && doc.subject !== f.subject) return false;
    if (f.type && doc.type !== f.type) return false;
    if (f.trimestre && doc.trimestre !== f.trimestre) return false;
    if (f.year && String(doc.year) !== String(f.year)) return false;
    if (f.search) {
      const q = f.search.trim().toLowerCase();
      const haystack = [
        localized(doc.title), doc.title.fr, doc.title.ar, doc.title.en,
        localized(doc.description)
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.favoritesOnly && !isFavorite(doc.id)) return false;
    return true;
  });
}

function renderDocGrid(containerId, docs) {
  const el = document.getElementById(containerId);
  if (!docs.length) {
    el.innerHTML = emptyStateHTML();
    return;
  }
  el.innerHTML = docs.map(docCardHTML).join('');
  el.querySelectorAll('.doc-preview-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addRecentDoc(btn.dataset.docId);
      openDocModal(btn.dataset.docId);
    });
  });
  el.querySelectorAll('.doc-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      var id = btn.dataset.docId;
      var isNowFav = toggleFavorite(id);
      btn.title = isNowFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
      btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)';
    });
  });
  el.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      addRecentDoc(card.dataset.docId);
      openDocModal(card.dataset.docId);
    });
  });
}

/* ---- Filter bar builder (used on library.html) ---- */
function populateFilterBar() {
  const levelSel = document.getElementById('filter-level');
  const streamSel = document.getElementById('filter-stream');
  const subjectSel = document.getElementById('filter-subject');
  const typeSel = document.getElementById('filter-type');
  const trimestreSel = document.getElementById('filter-trimestre');
  const yearSel = document.getElementById('filter-year');

  levelSel.innerHTML = `<option value="">${t('filters.allLevels')}</option>` +
    APP.db.levels.map(grp => `
      <optgroup label="${escapeAttr(localized(grp.name))}">
        ${grp.years.map(y => `<option value="${escapeAttr(y.id)}">${escapeHTML(localized(y.name))}</option>`).join('')}
      </optgroup>
    `).join('');

  streamSel.innerHTML = `<option value="">${t('filters.allStreams')}</option>` +
    APP.db.streams.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`).join('');

  subjectSel.innerHTML = `<option value="">${t('filters.allSubjects')}</option>` +
    APP.db.subjects.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`).join('');

  typeSel.innerHTML = `<option value="">${t('filters.allTypes')}</option>` +
    APP.db.documentTypes.map(ty => `<option value="${escapeAttr(ty.id)}">${escapeHTML(localized(ty.name))}</option>`).join('');

  if (trimestreSel) {
    trimestreSel.innerHTML = `<option value="">${t('filters.allTrimestres')}</option>` +
      (APP.db.trimestres || []).map(tr => `<option value="${escapeAttr(tr.id)}">${escapeHTML(localized(tr.name))}</option>`).join('');
  }

  const years = [...new Set(APP.db.documents.map(d => d.year))].sort((a, b) => b - a);
  yearSel.innerHTML = `<option value="">${t('filters.allYears')}</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join('');

  // restore current filter values
  levelSel.value = APP.filters.level;
  streamSel.value = APP.filters.stream;
  subjectSel.value = APP.filters.subject;
  typeSel.value = APP.filters.type;
  if (trimestreSel) trimestreSel.value = APP.filters.trimestre;
  yearSel.value = APP.filters.year;
}

function wireFilterBar(onChange) {
  ['level', 'stream', 'subject', 'type', 'trimestre', 'year'].forEach(key => {
    const el = document.getElementById('filter-' + key);
    if (!el) return;
    el.addEventListener('change', () => {
      APP.filters[key] = el.value;
      if (key === 'level') APP.filters.levelGroup = '';
      onChange();
    });
  });

  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.value = APP.filters.search;
    searchInput.addEventListener('input', debounce(() => {
      APP.filters.search = searchInput.value;
      onChange();
    }, 250));
  }

  const resetBtn = document.getElementById('filter-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      APP.filters = { level: '', levelGroup: '', stream: '', subject: '', type: '', trimestre: '', year: '', search: '', favoritesOnly: false };
      if (searchInput) searchInput.value = '';
      var favBtn = document.getElementById('fav-filter-btn');
      if (favBtn) { favBtn.classList.remove('active'); favBtn.querySelector('.icon svg').style.fill = 'none'; }
      populateFilterBar();
      onChange();
    });
  }

  var favBtn = document.getElementById('fav-filter-btn');
  if (favBtn) {
    favBtn.addEventListener('click', function () {
      APP.filters.favoritesOnly = !APP.filters.favoritesOnly;
      this.classList.toggle('active');
      var svg = this.querySelector('.icon svg');
      if (svg) svg.style.fill = APP.filters.favoritesOnly ? 'var(--red-stamp)' : 'none';
      onChange();
    });
  }
}

const LEVEL_GROUPS = [
  { id: 'primaire', levelIds: ['p1','p2','p3','p4','p5'] },
  { id: 'moyen', levelIds: ['m1','m2','m3','m4'] },
  { id: 'lycee', levelIds: ['s1','s2','s3'] }
];

function levelGroupToDbId(groupId) {
  const map = { primaire: 'primaire', moyen: 'moyen', lycee: 'secondaire' };
  return map[groupId] || groupId;
}
