/* ============================================================
   I18N + GLOBAL STATE
   ============================================================ */
const APP = {
  lang: localStorage.getItem('inry_lang') || 'fr',
  theme: localStorage.getItem('inry_theme') || 'light',
  db: null,
  i18n: null,
  filters: {
    level: '',
    levelGroup: '',
    stream: '',
    subject: '',
    type: '',
    trimestre: '',
    year: '',
    search: ''
  }
};

function t(path) {
  const dict = APP.i18n[APP.lang];
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return path;
  }
  return cur;
}

function localized(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[APP.lang] || field.fr || Object.values(field)[0] || '';
}

async function loadData() {
  const [dbRes, i18nRes] = await Promise.all([
    fetch('data/db.json'),
    fetch('data/i18n.json')
  ]);
  const defaultDb = await dbRes.json();
  const customDb = localStorage.getItem('inry_custom_db');
  if (customDb) {
    try { APP.db = JSON.parse(customDb); } catch(e) { APP.db = defaultDb; }
  } else {
    APP.db = defaultDb;
  }
  if (defaultDb.hidden) {
    var h = defaultDb.hidden;
    if (h.docIds && !localStorage.getItem('inry_hidden_doc_ids')) localStorage.setItem('inry_hidden_doc_ids', JSON.stringify(h.docIds));
  }
  if (defaultDb.githubSync && !localStorage.getItem('inry_github_sync')) {
    var gs = defaultDb.githubSync;
    var ghCfg = {
      repo: gs.repo || '',
      branch: gs.branch || 'main',
      path: gs.path || 'repo/data/db.json',
      pat: ''
    };
    if (gs.encryptedPAT && gs.patKey) {
      try {
        var keyBytes = Uint8Array.from(atob(gs.patKey), c => c.charCodeAt(0));
        var rawKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        var ctBytes = Uint8Array.from(atob(gs.encryptedPAT), c => c.charCodeAt(0));
        var plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: keyBytes }, rawKey, ctBytes);
        ghCfg.pat = new TextDecoder().decode(plainBuf);
      } catch (e) { /* decryption failed, pat stays empty */ }
    }
    localStorage.setItem('inry_github_sync', JSON.stringify(ghCfg));
    if (gs.autoPush) localStorage.setItem('inry_github_auto_push', 'true');
  }
  APP.i18n = await i18nRes.json();
}

function applyLangToDocument() {
  const dir = APP.i18n[APP.lang].dir;
  document.documentElement.lang = APP.lang;
  document.documentElement.dir = dir;
  document.documentElement.setAttribute('data-theme', APP.theme);
}

function setLang(lang) {
  APP.lang = lang;
  localStorage.setItem('inry_lang', lang);
  applyLangToDocument();
  if (typeof onLangChange === 'function') onLangChange();
}

function setTheme(theme) {
  APP.theme = theme;
  localStorage.setItem('inry_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  setTheme(APP.theme === 'light' ? 'dark' : 'light');
}

/* Generic helper: translate every [data-i18n] element using current dict */
function translateStaticDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val !== key) el.setAttribute('placeholder', val);
  });
}

function showToast(msg) {
  let toastEl = document.getElementById('global-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'global-toast';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
