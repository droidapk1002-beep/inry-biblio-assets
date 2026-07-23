/* ============================================================
   ADMIN DOCUMENT MANAGER — add / edit / delete documents
   Strategy: db.json is static (read-only on disk from the browser).
   Local additions/edits/deletions are stored in localStorage and
   MERGED with db.json at runtime everywhere documents are shown.
   The admin can export an updated db.json to make changes permanent
   for all visitors (replace the file in data/).
   ============================================================ */

const LOCAL_DOCS_KEY = 'inry_local_docs';       // array of added/edited docs (full objects)
const DELETED_DOCS_KEY = 'inry_deleted_doc_ids'; // array of ids to hide from original db.json
const PENDING_DOCS_KEY = 'inry_pending_docs';    // array of imported docs awaiting validation

let sortState = { key: 'id', dir: 'desc' };

function getLocalDocs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveLocalDocs(docs) {
  localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
}
function getDeletedIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveDeletedIds(ids) {
  localStorage.setItem(DELETED_DOCS_KEY, JSON.stringify(ids));
}
function getPendingDocs() {
  try { return JSON.parse(localStorage.getItem(PENDING_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function savePendingDocs(docs) {
  localStorage.setItem(PENDING_DOCS_KEY, JSON.stringify(docs));
}
function approvePendingDoc(docId) {
  const pending = getPendingDocs();
  const idx = pending.findIndex(d => d.id === docId);
  if (idx === -1) return;
  const [doc] = pending.splice(idx, 1);
  savePendingDocs(pending);
  upsertLocalDoc(doc);
  applyLocalDocOverrides();
  renderAdminDocTable();
}
function rejectPendingDoc(docId) {
  const pending = getPendingDocs();
  const filtered = pending.filter(d => d.id !== docId);
  savePendingDocs(filtered);
  renderAdminDocTable();
}
function approveAllPending() {
  const pending = getPendingDocs();
  if (!pending.length) return;
  pending.forEach(d => upsertLocalDoc(d));
  savePendingDocs([]);
  applyLocalDocOverrides();
  renderAdminDocTable();
  showToast(pending.length + ' document(s) validé(s)');
}

/**
 * Returns the effective document list = original db.json documents
 * (minus deleted ones) + local docs (added or edited), local edits
 * taking priority over originals with the same id.
 * Call this once after loadData() and it patches APP.db.documents in place
 * so the rest of the app (home, library, modal) needs no changes.
 */
function applyLocalDocOverrides() {
  if (!APP.db || !APP.db.documents) return;
  const deleted = new Set(getDeletedIds());
  const localDocs = getLocalDocs();
  const localIds = new Set(localDocs.map(d => d.id));

  const base = APP.db.documents.filter(d => !deleted.has(d.id) && !localIds.has(d.id));
  APP.db.documents = [...base, ...localDocs.filter(d => !deleted.has(d.id))];
}

function upsertLocalDoc(doc) {
  const docs = getLocalDocs();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.push(doc);
  saveLocalDocs(docs);

  // if this id was previously marked deleted, un-delete it
  const deleted = getDeletedIds().filter(id => id !== doc.id);
  saveDeletedIds(deleted);
}

function deleteDocEverywhere(id) {
  // remove from local docs if present
  saveLocalDocs(getLocalDocs().filter(d => d.id !== id));
  // mark as deleted so it's hidden even if it exists in original db.json
  const deleted = getDeletedIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    saveDeletedIds(deleted);
  }
}

function nextDocId(allDocs) {
  const nums = allDocs
    .map(d => parseInt((d.id || '').replace('doc-', ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'doc-' + String(max + 1).padStart(4, '0');
}

/* ---------------- Admin "Documents" tab UI ---------------- */

let editingDocId = null; // null = creating new doc
let editingIsPending = false; // true when editing a pending (unvalidated) doc
let titleAutoFill = true;
let descAutoFill = true;
let titleTimer = null;
let descTimer = null;

function initDocManager() {
  if (!APP.db) {
    console.error('[INRY-Biblio] APP.db est vide — les listes Niveau/Filière/Matière/Type/Wilaya resteront vides. loadData() n\'a probablement pas terminé avant initDocManager().');
    return;
  }
  populateDocFormSelects();
  renderAdminDocTable();
  wireDocManagerEvents();
  wireImportBackupUI();
  wireAutoBackupUI();
  startAutoBackup();

  // Tab-to-fill: pressing Tab on an empty field with placeholder fills it
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    var el = document.activeElement;
    if (!el || el.tagName === 'SELECT' || el.tagName === 'BUTTON') return;
    if (!el.closest('#doc-form')) return;
    if (el.value || !el.placeholder) return;
    e.preventDefault();
    el.value = el.placeholder;
    var form = el.closest('form');
    if (!form) return;
    var inputs = Array.from(form.querySelectorAll('input, textarea, select'));
    var idx = inputs.indexOf(el);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
  });
}

function populateDocFormSelects() {
  const levelSel = document.getElementById('doc-form-level');
  const streamSel = document.getElementById('doc-form-stream');
  const subjectSel = document.getElementById('doc-form-subject');
  const typeSel = document.getElementById('doc-form-type');
  const hostSel = document.getElementById('doc-form-host');
  const wilayaSel = document.getElementById('doc-form-wilaya');
  const trimestreSel = document.getElementById('doc-form-trimestre');

  if (!levelSel || !streamSel || !subjectSel || !typeSel || !hostSel) {
    console.error('[INRY-Biblio] Un ou plusieurs champs du formulaire document sont introuvables dans le DOM. Vérifie que admin.html contient bien la section #doc-form-section à jour, et vide le cache du navigateur (Ctrl+Maj+R).');
    return;
  }
  levelSel.innerHTML = APP.db.levels.map(grp => `
    <optgroup label="${escapeAttr(localized(grp.name))}">
      ${grp.years.map(y => `<option value="${escapeAttr(y.id)}">${escapeHTML(localized(y.name))}</option>`).join('')}
    </optgroup>
  `).join('');

  streamSel.innerHTML = `<option value="">—</option>` +
    APP.db.streams.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`).join('');

  subjectSel.innerHTML = APP.db.subjects.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`).join('');

  typeSel.innerHTML = APP.db.documentTypes.map(ty => `<option value="${escapeAttr(ty.id)}">${escapeHTML(localized(ty.name))}</option>`).join('');

  hostSel.innerHTML = `<option value="drive">Google Drive</option><option value="mega">Mega</option><option value="other">Autre</option>`;

  if (wilayaSel) {
    const wilayasList = APP.db.wilayas || [];
    wilayaSel.innerHTML = `<option value="">— ${t('admin.noWilaya')}</option>` +
      `<option value="National">${t('admin.nationalWilaya')}</option>` +
      wilayasList.map(w => `<option value="${escapeAttr(localized(w.name))}">${escapeHTML(w.code)} — ${escapeHTML(localized(w.name))}</option>`).join('');
  }

  if (trimestreSel) {
    const trimestresList = APP.db.trimestres || [];
    trimestreSel.innerHTML = `<option value="">— ${t('admin.noTrimestre')}</option>` +
      trimestresList.map(tr => `<option value="${escapeAttr(tr.id)}">${escapeHTML(localized(tr.name))}</option>`).join('');
  }
}

function renderAdminDocTable() {
  const tbody = document.getElementById('admin-doc-table-body');
  const searchVal = (document.getElementById('admin-doc-search')?.value || '').toLowerCase().trim();

  const pendingDocs = getPendingDocs();
  const hiddenIds = getHiddenIds();
  let docs = [...APP.db.documents];
  // Sort by current sort state (default: most recently added first)
  const sk = sortState.key, sd = sortState.dir;
  docs.sort((a, b) => {
    let va, vb;
    if (sk === 'id') {
      va = parseInt(a.id.replace('doc-',''), 10) || 0;
      vb = parseInt(b.id.replace('doc-',''), 10) || 0;
    } else if (sk === 'title') {
      va = (localized(a.title) || '').toLowerCase();
      vb = (localized(b.title) || '').toLowerCase();
    } else {
      va = (a[sk] != null ? String(a[sk]) : '').toLowerCase();
      vb = (b[sk] != null ? String(b[sk]) : '').toLowerCase();
    }
    if (va < vb) return sd === 'asc' ? -1 : 1;
    if (va > vb) return sd === 'asc' ? 1 : -1;
    return 0;
  });
  if (searchVal) {
    docs = docs.filter(d => {
      const hay = [localized(d.title), d.id, d.subject, d.level].join(' ').toLowerCase();
      return hay.includes(searchVal);
    });
  }

  const selAllChecked = localStorage.getItem('_inry_select_all') === 'true' ? 'checked' : '';

  let html = '';

  // Toolbar row
  html += `<tr class="selection-toolbar"><td colspan="8" style="padding:0.5rem 1rem;background:var(--surface);border-bottom:1px solid var(--kraft-line);">
    <div style="display:flex;gap:var(--space-2);align-items:center;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-ghost btn-xs" id="select-all-btn">☐ Tout</button>
      <button class="btn btn-ghost btn-xs" id="deselect-all-btn">☐ Aucun</button>
      <span style="color:var(--ink-soft);font-size:var(--fs-xs);" id="sel-count"></span>
      <button class="btn btn-danger btn-xs" id="delete-selected-btn" style="display:none;">🗑 Supprimer</button>
      <button class="btn btn-secondary btn-xs" id="hide-selected-btn" style="display:none;">👁 Masquer</button>
      <button class="btn btn-secondary btn-xs" id="unhide-selected-btn" style="display:none;">👁 Afficher</button>
      <button class="btn btn-primary btn-xs" id="bulk-edit-btn" style="display:none;">✏️ Modifier</button>
    </div>
  </td></tr>`;

  // Bulk edit panel
  html += `<tr id="bulk-edit-panel" style="display:none;"><td colspan="8" style="padding:0.75rem 1rem;background:var(--surface-alt,#f5f0e8);border-bottom:2px solid var(--kraft-line);">
    <div style="display:flex;gap:var(--space-3);align-items:flex-end;flex-wrap:wrap;">
      <div style="font-weight:700;font-size:var(--fs-sm);width:100%;">✏️ Modifier la sélection — ne coche que les champs à changer :</div>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-level"> Niveau
        <select id="bulk-val-level" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-stream"> Filière
        <select id="bulk-val-stream" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-subject"> Matière
        <select id="bulk-val-subject" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-type"> Type
        <select id="bulk-val-type" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-host"> Hébergeur
        <input type="text" id="bulk-val-host" disabled list="bulk-datalist-host" placeholder="Google Drive / Mega..." style="display:block;margin-top:2px;width:140px;"></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-wilaya"> Wilaya
        <select id="bulk-val-wilaya" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-trimestre"> Trimestre
        <select id="bulk-val-trimestre" disabled style="display:block;margin-top:2px;"></select></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-year"> Année
        <input type="number" id="bulk-val-year" disabled="disabled" placeholder="2025" min="2000" max="2099" style="display:block;margin-top:2px;width:90px;"></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-source"> Source
        <input type="text" id="bulk-val-source" disabled="disabled" placeholder="…" style="display:block;margin-top:2px;width:120px;"></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-url-source"> URL Source
        <input type="url" id="bulk-val-url-source" disabled="disabled" list="bulk-datalist-url-source" placeholder="https://…" style="display:block;margin-top:2px;width:180px;"></label>
      <label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-url-pdf"> URL PDF
        <input type="url" id="bulk-val-url-pdf" disabled="disabled" list="bulk-datalist-url-pdf" placeholder="https://…" style="display:block;margin-top:2px;width:180px;"></label>
      <button class="btn btn-primary btn-xs" id="bulk-apply-btn">✅ Appliquer</button>
      <button class="btn btn-ghost btn-xs" id="bulk-cancel-btn">✖ Annuler</button>
      <span id="bulk-confirm" style="color:var(--green);font-size:var(--fs-xs);font-weight:600;"></span>
      <datalist id="bulk-datalist-host"><option value="Google Drive"><option value="Mega"><option value="Autre"></datalist>
      <datalist id="bulk-datalist-url-source"></datalist>
      <datalist id="bulk-datalist-url-pdf"></datalist>
    </div>
  </td></tr>`;

  // Pending section
  if (pendingDocs.length) {
    html += `<tr class="pending-section-header"><td colspan="8" style="padding:0.75rem 1rem;background:var(--gold);color:var(--ink);font-weight:700;">⏳ ${pendingDocs.length} document(s) en attente de validation</td></tr>`;
    pendingDocs.forEach(doc => {
      const subject = APP.db.subjects.find(s => s.id === doc.subject);
      const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
      const isHidden = hiddenIds.includes(doc.id);
      html += `
        <tr data-doc-id="${escapeAttr(doc.id)}" style="background:var(--cream);${isHidden ? 'opacity:0.5;' : ''}">
          <td><input type="checkbox" class="doc-select-cb" data-doc-id="${escapeAttr(doc.id)}" ${selAllChecked}></td>
          <td class="doc-table-title">${escapeHTML(localized(doc.title))} <span class="local-tag" style="background:var(--gold);color:var(--ink);">en attente</span>${isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : ''}</td>
          <td>${escapeHTML(subject ? localized(subject.name) : doc.subject)}</td>
          <td>${escapeHTML(typeName ? localized(typeName.name) : doc.type)}</td>
          <td>—</td>
          <td class="ltr-only">${escapeHTML(doc.year || '—')}</td>
          <td style="text-transform:capitalize;">${escapeHTML(doc.host)}</td>
          <td style="text-transform:capitalize;">${escapeHTML(doc.source || '—')}</td>
          <td style="white-space:nowrap;">${doc.urlSource ? `<button class="btn-source-eye" data-url="${escapeAttr(doc.urlSource)}" title="Voir la source">📄</button>` : ''}${doc.previewUrl || doc.downloadUrl || doc.urlPdf ? `<button class="btn-preview-pdf" data-url="${escapeAttr(doc.previewUrl || doc.downloadUrl || doc.urlPdf)}" title="Aperçu PDF">👁</button>` : ''}${!doc.urlSource && !doc.previewUrl && !doc.urlPdf && !doc.downloadUrl ? '—' : ''}</td>
          <td class="doc-table-actions">
            <button class="btn btn-secondary btn-sm edit-pending-btn" data-doc-id="${escapeAttr(doc.id)}">${icon('settings')}</button>
            <button class="btn btn-primary btn-sm approve-pending-btn" data-doc-id="${escapeAttr(doc.id)}">✓ Valider</button>
            <button class="btn btn-danger btn-sm reject-pending-btn" data-doc-id="${escapeAttr(doc.id)}">✕ Rejeter</button>
          </td>
        </tr>
      `;
    });
    html += `<tr><td colspan="10" style="padding:0.5rem 1rem;"><button class="btn btn-primary btn-sm" id="approve-all-pending-btn">✓ Tout valider</button></td></tr>`;
  }

  // Published section
  if (docs.length) {
    html += `<tr class="pending-section-header"><td colspan="10" style="padding:0.75rem 1rem;background:var(--kraft);font-weight:600;">✅ Documents publiés (${docs.length})</td></tr>`;
    html += docs.map(doc => {
      const subject = APP.db.subjects.find(s => s.id === doc.subject);
      const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
      const trimestreName = APP.db.trimestres?.find(tr => tr.id === doc.trimestre);
      const isLocal = getLocalDocs().some(d => d.id === doc.id);
      const isHidden = hiddenIds.includes(doc.id);
      return `
        <tr data-doc-id="${escapeAttr(doc.id)}"${isHidden ? ' style="opacity:0.5;"' : ''}>
          <td><input type="checkbox" class="doc-select-cb" data-doc-id="${escapeAttr(doc.id)}" ${selAllChecked}></td>
          <td class="doc-table-title">${escapeHTML(localized(doc.title))} ${isLocal ? '<span class="local-tag">local</span>' : ''}${isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : ''}</td>
          <td>${escapeHTML(subject ? localized(subject.name) : '—')}</td>
          <td>${escapeHTML(typeName ? localized(typeName.name) : doc.type)}</td>
          <td>${escapeHTML(trimestreName ? localized(trimestreName.name) : '—')}</td>
          <td class="ltr-only">${escapeHTML(doc.year || '—')}</td>
          <td style="text-transform:capitalize;">${escapeHTML(doc.host)}</td>
          <td style="text-transform:capitalize;">${escapeHTML(doc.source || '—')}</td>
          <td style="white-space:nowrap;">${doc.urlSource ? `<button class="btn-source-eye" data-url="${escapeAttr(doc.urlSource)}" title="Voir la source">📄</button>` : ''}${doc.previewUrl || doc.downloadUrl || doc.urlPdf ? `<button class="btn-preview-pdf" data-url="${escapeAttr(doc.previewUrl || doc.downloadUrl || doc.urlPdf)}" title="Aperçu PDF">👁</button>` : ''}${!doc.urlSource && !doc.previewUrl && !doc.urlPdf && !doc.downloadUrl ? '—' : ''}</td>
          <td class="doc-table-actions">
            <button class="btn btn-secondary btn-sm edit-doc-btn" data-doc-id="${escapeAttr(doc.id)}">${icon('settings')}</button>
            <button class="btn btn-danger btn-sm delete-doc-btn" data-doc-id="${escapeAttr(doc.id)}">${icon('trash')}</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (!html) {
    html = `<tr><td colspan="10" style="text-align:center; padding:1.5rem; color:var(--ink-soft);">${t('empty.title')}</td></tr>`;
  }

  tbody.innerHTML = html;

  // Wire selection toolbar
  const selCountEl = document.getElementById('sel-count');
  const deleteSelBtn = document.getElementById('delete-selected-btn');
  const hideSelBtn = document.getElementById('hide-selected-btn');
  const unhideSelBtn = document.getElementById('unhide-selected-btn');
  const bulkEditBtn = document.getElementById('bulk-edit-btn');
  const bulkPanel = document.getElementById('bulk-edit-panel');

  function updateSelectionUI() {
    const checked = tbody.querySelectorAll('.doc-select-cb:checked');
    const count = checked.length;
    const hiddenIds = getHiddenIds();
    const hasHidden = [...checked].some(cb => hiddenIds.includes(cb.dataset.docId));
    const hasVisible = [...checked].some(cb => !hiddenIds.includes(cb.dataset.docId));
    if (selCountEl) selCountEl.textContent = count ? count + ' sélectionné(s)' : '';
    if (deleteSelBtn) { deleteSelBtn.disabled = count === 0; deleteSelBtn.style.display = count === 0 ? 'none' : ''; }
    if (hideSelBtn) { hideSelBtn.disabled = count === 0; hideSelBtn.style.display = hasVisible && count > 0 ? '' : 'none'; }
    if (unhideSelBtn) { unhideSelBtn.style.display = hasHidden ? '' : 'none'; }
    if (bulkEditBtn) { bulkEditBtn.disabled = count === 0; bulkEditBtn.style.display = count === 0 ? 'none' : ''; }
  }

  tbody.querySelectorAll('.doc-select-cb').forEach(cb => {
    cb.addEventListener('change', updateSelectionUI);
  });

  document.getElementById('select-all-btn')?.addEventListener('click', () => {
    tbody.querySelectorAll('.doc-select-cb').forEach(cb => { cb.checked = true; });
    localStorage.setItem('_inry_select_all', 'true');
    updateSelectionUI();
  });
  document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
    tbody.querySelectorAll('.doc-select-cb').forEach(cb => { cb.checked = false; });
    localStorage.setItem('_inry_select_all', 'false');
    updateSelectionUI();
  });

  if (deleteSelBtn) {
    deleteSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      const ok = window.confirm('Supprimer ' + ids.length + ' document(s) définitivement ?');
      if (!ok) return;
      ids.forEach(id => {
        deleteDocEverywhere(id);
        const pending = getPendingDocs().filter(d => d.id !== id);
        savePendingDocs(pending);
      });
      applyLocalDocOverrides();
      renderAdminDocTable();
      showToast(ids.length + ' document(s) supprimé(s)');
    });
  }

  if (hideSelBtn) {
    hideSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      const hidden = getHiddenIds();
      ids.forEach(id => { if (!hidden.includes(id)) hidden.push(id); });
      saveHiddenIds(hidden);
      renderAdminDocTable();
      showToast(ids.length + ' document(s) masqué(s)');
    });
  }

  if (unhideSelBtn) {
    unhideSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      const hidden = getHiddenIds().filter(id => !ids.includes(id));
      saveHiddenIds(hidden);
      renderAdminDocTable();
      showToast(ids.length + ' document(s) ré-affiché(s)');
    });
  }

  // Bulk edit panel
  if (bulkEditBtn && bulkPanel) {
    const bulkLevels = document.getElementById('bulk-val-level');
    const bulkStreams = document.getElementById('bulk-val-stream');
    const bulkSubjects = document.getElementById('bulk-val-subject');
    const bulkTypes = document.getElementById('bulk-val-type');
    const bulkHost = document.getElementById('bulk-val-host');
    const bulkWilayas = document.getElementById('bulk-val-wilaya');
    const bulkTrimestres = document.getElementById('bulk-val-trimestre');
    const bulkYear = document.getElementById('bulk-val-year');
    const bulkSource = document.getElementById('bulk-val-source');
    const bulkUrlSource = document.getElementById('bulk-val-url-source');
    const bulkUrlPdf = document.getElementById('bulk-val-url-pdf');

    if (bulkLevels) bulkLevels.innerHTML = '<option value="">— choisir —</option>' + (APP.db.levels || []).flatMap(grp => grp.years.map(y => '<option value="' + escapeAttr(y.id) + '">' + escapeHTML(localized(y.name)) + '</option>')).join('');
    if (bulkStreams) bulkStreams.innerHTML = '<option value="">— choisir —</option>' + (APP.db.streams || []).map(s => '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>').join('');
    if (bulkSubjects) bulkSubjects.innerHTML = '<option value="">— choisir —</option>' + (APP.db.subjects || []).map(s => '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>').join('');
    if (bulkTypes) bulkTypes.innerHTML = '<option value="">— choisir —</option>' + (APP.db.documentTypes || []).map(ty => '<option value="' + escapeAttr(ty.id) + '">' + escapeHTML(localized(ty.name)) + '</option>').join('');
    // Populate URL datalists from existing documents
    var urlSourceVals = [...new Set((APP.db.documents || []).map(function(d) { return d.urlSource; }).filter(Boolean))];
    var urlPdfVals = [...new Set((APP.db.documents || []).map(function(d) { return d.previewUrl || d.downloadUrl || d.urlPdf; }).filter(Boolean))];
    var dlUrlSource = document.getElementById('bulk-datalist-url-source');
    var dlUrlPdf = document.getElementById('bulk-datalist-url-pdf');
    if (dlUrlSource) dlUrlSource.innerHTML = urlSourceVals.map(function(u) { return '<option value="' + escapeAttr(u) + '">'; }).join('');
    if (dlUrlPdf) dlUrlPdf.innerHTML = urlPdfVals.map(function(u) { return '<option value="' + escapeAttr(u) + '">'; }).join('');
    if (bulkWilayas) bulkWilayas.innerHTML = '<option value="">— choisir —</option><option value="National">National</option>' + (APP.db.wilayas || []).map(w => '<option value="' + escapeAttr(localized(w.name)) + '">' + escapeHTML(w.code) + ' — ' + escapeHTML(localized(w.name)) + '</option>').join('');
    if (bulkTrimestres) bulkTrimestres.innerHTML = '<option value="">— choisir —</option>' + (APP.db.trimestres || []).map(tr => '<option value="' + escapeAttr(tr.id) + '">' + escapeHTML(localized(tr.name)) + '</option>').join('');

    ['bulk-chk-level','bulk-chk-stream','bulk-chk-subject','bulk-chk-type','bulk-chk-host','bulk-chk-wilaya','bulk-chk-trimestre','bulk-chk-year','bulk-chk-source','bulk-chk-url-source','bulk-chk-url-pdf'].forEach(chkId => {
      const chk = document.getElementById(chkId);
      if (chk) chk.addEventListener('change', () => {
        const ctrl = chk.parentElement.querySelector('select, input[type="number"], input[type="text"], input[type="url"]');
        if (ctrl) ctrl.disabled = !chk.checked;
      });
    });

    bulkEditBtn.addEventListener('click', () => {
      bulkPanel.style.display = bulkPanel.style.display === 'none' ? '' : 'none';
      const bc = document.getElementById('bulk-confirm');
      if (bc) bc.textContent = '';
    });

    document.getElementById('bulk-cancel-btn')?.addEventListener('click', () => {
      bulkPanel.style.display = 'none';
    });

    document.getElementById('bulk-apply-btn')?.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      if (!ids.length) return;
      const fields = {};
      if (document.getElementById('bulk-chk-level')?.checked) fields.level = bulkLevels.value;
      if (document.getElementById('bulk-chk-stream')?.checked) fields.stream = bulkStreams.value || null;
      if (document.getElementById('bulk-chk-subject')?.checked) fields.subject = bulkSubjects.value;
      if (document.getElementById('bulk-chk-type')?.checked) fields.type = bulkTypes.value;
      if (document.getElementById('bulk-chk-host')?.checked) fields.host = bulkHost.value.trim() || null;
      if (document.getElementById('bulk-chk-wilaya')?.checked) fields.wilaya = bulkWilayas.value || null;
      if (document.getElementById('bulk-chk-trimestre')?.checked) fields.trimestre = bulkTrimestres.value || null;
      if (document.getElementById('bulk-chk-year')?.checked && bulkYear.value) fields.year = parseInt(bulkYear.value, 10);
      if (document.getElementById('bulk-chk-source')?.checked && bulkSource.value.trim()) fields.source = bulkSource.value.trim();
      if (document.getElementById('bulk-chk-url-source')?.checked && bulkUrlSource.value.trim()) fields.urlSource = bulkUrlSource.value.trim();
      if (document.getElementById('bulk-chk-url-pdf')?.checked && bulkUrlPdf.value.trim()) fields.urlPdf = bulkUrlPdf.value.trim();
      if (!Object.keys(fields).length) { showToast('Coche au moins un champ'); return; }
      let count = 0;
      (APP.db.documents || []).forEach(doc => {
        if (ids.includes(doc.id)) { Object.assign(doc, fields); count++; }
      });
      try {
        if (typeof getPendingDocs === 'function' && typeof savePendingDocs === 'function') {
          const pending = getPendingDocs();
          if (pending.length) {
            pending.forEach(doc => { if (ids.includes(doc.id)) { Object.assign(doc, fields); count++; } });
            savePendingDocs(pending);
          }
        }
      } catch(e) { console.error('Bulk edit pending error:', e); }
      renderAdminDocTable();
      const bc = document.getElementById('bulk-confirm');
      if (bc) bc.textContent = '✅ ' + count + ' document(s) modifié(s)';
      showToast(count + ' document(s) modifié(s)');
    });
  }

  // Event handlers
  tbody.querySelectorAll('.edit-doc-btn').forEach(btn => {
    btn.addEventListener('click', () => openDocFormForEdit(btn.dataset.docId));
  });
  tbody.querySelectorAll('.delete-doc-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteDoc(btn.dataset.docId));
  });
  tbody.querySelectorAll('.edit-pending-btn').forEach(btn => {
    btn.addEventListener('click', () => openDocFormForEdit(btn.dataset.docId));
  });
  tbody.querySelectorAll('.approve-pending-btn').forEach(btn => {
    btn.addEventListener('click', () => approvePendingDoc(btn.dataset.docId));
  });
  tbody.querySelectorAll('.reject-pending-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectPendingDoc(btn.dataset.docId));
  });
  const approveAllBtn = document.getElementById('approve-all-pending-btn');
  if (approveAllBtn) approveAllBtn.addEventListener('click', approveAllPending);

  tbody.querySelectorAll('.btn-source-eye').forEach(btn => {
    btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
  });

  tbody.querySelectorAll('.btn-preview-pdf').forEach(btn => {
    btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
  });

  updateSelectionUI();
  updateSortIndicators();
  wireSortHeaders();
}

function updateSortIndicators() {
  document.querySelectorAll('.admin-doc-table th.sortable').forEach(th => {
    const key = th.dataset.sort;
    const text = th.textContent.replace(/[▲▼].*$/, '').trim();
    if (key === sortState.key) {
      th.textContent = text + ' ' + (sortState.dir === 'asc' ? '▲' : '▼');
    } else {
      th.textContent = text;
    }
  });
}

function wireSortHeaders() {
  document.querySelectorAll('.admin-doc-table th.sortable').forEach(th => {
    th.removeEventListener('click', sortClickHandler);
    th.addEventListener('click', sortClickHandler);
  });
}

function sortClickHandler(e) {
  const key = e.currentTarget.dataset.sort;
  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = key;
    sortState.dir = 'asc';
  }
  renderAdminDocTable();
}

function openDocFormForEdit(docId) {
  let doc = APP.db.documents.find(d => d.id === docId);
  editingIsPending = false;
  if (!doc) {
    doc = getPendingDocs().find(d => d.id === docId);
    if (!doc) return;
    editingIsPending = true;
  }
  editingDocId = docId;

  // Reset auto-translate state so modifying French re-triggers translation
  titleAutoFill = true;
  descAutoFill = true;
  ['doc-form-title-ar','doc-form-title-en','doc-form-desc-ar','doc-form-desc-en'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.dataset.autofilled = 'true'; }
  });

  document.getElementById('doc-form-title-fr').value = doc.title.fr || '';
  document.getElementById('doc-form-title-ar').value = doc.title.ar || '';
  document.getElementById('doc-form-title-en').value = doc.title.en || '';
  document.getElementById('doc-form-desc-fr').value = doc.description?.fr || '';
  document.getElementById('doc-form-desc-ar').value = doc.description?.ar || '';
  document.getElementById('doc-form-desc-en').value = doc.description?.en || '';

  // Trigger translation for any filled French field (regardless of ar/en existing)
  if (doc.title.fr) {
    document.getElementById('doc-form-title-fr').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (doc.description?.fr) {
    document.getElementById('doc-form-desc-fr').dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.getElementById('doc-form-level').value = doc.level || '';
  document.getElementById('doc-form-stream').value = doc.stream || '';
  document.getElementById('doc-form-subject').value = doc.subject || '';
  document.getElementById('doc-form-type').value = doc.type || '';
  document.getElementById('doc-form-year').value = doc.year || '';
  document.getElementById('doc-form-trimestre').value = doc.trimestre || '';
  document.getElementById('doc-form-wilaya').value = doc.wilaya || '';
  document.getElementById('doc-form-pages').value = doc.pages || '';
  document.getElementById('doc-form-size').value = doc.size || '';
  document.getElementById('doc-form-host').value = doc.host || 'drive';
  document.getElementById('doc-form-preview-url').value = doc.previewUrl || '';
  document.getElementById('doc-form-download-url').value = doc.downloadUrl || '';
  document.getElementById('doc-form-source').value = doc.source || '';
  document.getElementById('doc-form-url-source').value = doc.urlSource || '';
  document.getElementById('doc-form-url-pdf').value = doc.urlPdf || '';

  // Auto-fetch file info from stored URLs (silently, only if fields are empty or placeholder)
  const previewUrl = doc.previewUrl || doc.downloadUrl;
  if (previewUrl) {
    const sizeField = document.getElementById('doc-form-size');
    const pagesField = document.getElementById('doc-form-pages');
    const currentPages = doc.pages || '';
    const currentSize = doc.size || '';
    if (!sizeField.value || sizeField.value === '—' || !currentSize || currentSize === '—') {
      tryFetchFileSize(previewUrl).then(s => { if (s && !sizeField.value) sizeField.value = s; });
    }
    if (!pagesField.value || pagesField.value === '—' || !currentPages || currentPages === '—') {
      tryFetchPageCount(previewUrl).then(p => { if (p && !pagesField.value) pagesField.value = String(p); });
    }
  }

  document.getElementById('doc-form-title-heading').textContent = t('admin.editDoc');
  document.getElementById('doc-form-submit-btn').textContent = t('admin.saveChanges');

  // Switch to Ajouter sub-tab
  document.querySelectorAll('.admin-sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelector('.admin-sub-tab[data-subtab="docs-add"]')?.classList.add('active');
  document.querySelectorAll('#tab-panel-docs .admin-sub-panel').forEach(function(p) { p.classList.add('hidden'); });
  document.getElementById('sub-panel-docs-add')?.classList.remove('hidden');
  document.getElementById('sub-panel-docs-add')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function resetDocForm() {
  editingDocId = null;
  editingIsPending = false;
  document.getElementById('doc-form').reset();
  document.getElementById('doc-form-title-heading').textContent = t('admin.addDoc');
  document.getElementById('doc-form-submit-btn').textContent = t('admin.save');
  // Reset auto-translate state
  titleAutoFill = true;
  descAutoFill = true;
  ['doc-form-title-ar','doc-form-title-en','doc-form-desc-ar','doc-form-desc-en'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.dataset.autofilled = 'false'; el.placeholder = ''; }
  });
  if (titleTimer) clearTimeout(titleTimer);
  if (descTimer) clearTimeout(descTimer);
}

function confirmDeleteDoc(docId) {
  let doc = APP.db.documents.find(d => d.id === docId);
  if (!doc) doc = getPendingDocs().find(d => d.id === docId);
  if (!doc) return;
  const ok = window.confirm(t('admin.confirmDelete') + '\n\n"' + localized(doc.title) + '"');
  if (!ok) return;

  deleteDocEverywhere(docId);
  applyLocalDocOverrides();
  renderAdminDocTable();
  showToast(t('admin.docDeleted'));
  if (editingDocId === docId) resetDocForm();
}

async function tryFetchFileSize(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = res.headers.get('Content-Length');
    if (len && parseInt(len) > 0) return formatFileSize(parseInt(len));
  } catch { /* ignore CORS/network errors */ }
  return null;
}

async function tryFetchPageCount(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-15360' } });
    const text = await res.text();
    const pagesMatch = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
    if (pagesMatch && pagesMatch[1]) {
      const count = parseInt(pagesMatch[1], 10);
      if (count > 0 && count < 500) return count;
    }
  } catch { /* ignore CORS/network errors */ }
  return null;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

async function translateText(text, targetLang) {
  if (!text.trim()) return '';
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=fr|${targetLang}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function wireDocManagerEvents() {
  const form = document.getElementById('doc-form');

  // Auto-translate Arabic and English from French title
  const titleFr = document.getElementById('doc-form-title-fr');
  const titleAr = document.getElementById('doc-form-title-ar');
  const titleEn = document.getElementById('doc-form-title-en');
  titleAutoFill = true;
  titleTimer = null;
  function isAutoTranslateOn() {
    var cb = document.getElementById('auto-translate-toggle');
    return cb && cb.checked;
  }
  titleFr.addEventListener('input', () => {
    if (!titleAutoFill || !isAutoTranslateOn()) return;
    clearTimeout(titleTimer);
    const val = titleFr.value;
    if (!val) { titleAr.value = ''; titleEn.value = ''; return; }
    titleTimer = setTimeout(async () => {
      if (titleAr.value === '' || titleAr.dataset.autofilled === 'true') {
        titleAr.dataset.autofilled = 'true';
        titleAr.placeholder = '...';
        titleAr.value = await translateText(val, 'ar');
        if (titleAr.dataset.autofilled === 'true') titleAr.placeholder = '';
      }
      if (titleEn.value === '' || titleEn.dataset.autofilled === 'true') {
        titleEn.dataset.autofilled = 'true';
        titleEn.placeholder = '...';
        titleEn.value = await translateText(val, 'en');
        if (titleEn.dataset.autofilled === 'true') titleEn.placeholder = '';
      }
    }, 600);
  });
  titleAr.addEventListener('input', () => { titleAr.dataset.autofilled = 'false'; titleAutoFill = false; });
  titleEn.addEventListener('input', () => { titleEn.dataset.autofilled = 'false'; titleAutoFill = false; });

  // Auto-translate Arabic and English from French description
  const descFr = document.getElementById('doc-form-desc-fr');
  const descAr = document.getElementById('doc-form-desc-ar');
  const descEn = document.getElementById('doc-form-desc-en');
  descAutoFill = true;
  descTimer = null;
  descFr.addEventListener('input', () => {
    if (!descAutoFill || !isAutoTranslateOn()) return;
    clearTimeout(descTimer);
    const val = descFr.value;
    if (!val) { descAr.value = ''; descEn.value = ''; return; }
    descTimer = setTimeout(async () => {
      if (descAr.value === '' || descAr.dataset.autofilled === 'true') {
        descAr.dataset.autofilled = 'true';
        descAr.placeholder = '...';
        descAr.value = await translateText(val, 'ar');
        if (descAr.dataset.autofilled === 'true') descAr.placeholder = '';
      }
      if (descEn.value === '' || descEn.dataset.autofilled === 'true') {
        descEn.dataset.autofilled = 'true';
        descEn.placeholder = '...';
        descEn.value = await translateText(val, 'en');
        if (descEn.dataset.autofilled === 'true') descEn.placeholder = '';
      }
    }, 600);
  });
  descAr.addEventListener('input', () => { descAr.dataset.autofilled = 'false'; descAutoFill = false; });
  descEn.addEventListener('input', () => { descEn.dataset.autofilled = 'false'; descAutoFill = false; });

  // Auto-fetch file info from URL (paste + on input when empty)
  const previewUrl = document.getElementById('doc-form-preview-url');
  const downloadUrl = document.getElementById('doc-form-download-url');
  const sizeField = document.getElementById('doc-form-size');
  const pagesField = document.getElementById('doc-form-pages');
  async function tryAutoFetchFromUrl(url) {
    if (!url) return;
    if (!sizeField.value) {
      const size = await tryFetchFileSize(url);
      if (size) sizeField.value = size;
    }
    if (!pagesField.value) {
      const pages = await tryFetchPageCount(url);
      if (pages) pagesField.value = pages;
    }
  }
  [previewUrl, downloadUrl].forEach(field => {
    if (!field) return;
    field.addEventListener('paste', () => {
      setTimeout(() => tryAutoFetchFromUrl(field.value.trim()), 100);
    });
    field.addEventListener('input', () => {
      if (field.value.trim()) {
        setTimeout(() => tryAutoFetchFromUrl(field.value.trim()), 300);
      }
    });
  });

  // TAB key → fill field from placeholder
  document.querySelectorAll('#doc-form input, #doc-form textarea').forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !el.value && el.placeholder) {
        el.value = el.placeholder;
      }
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const titleFr = document.getElementById('doc-form-title-fr').value.trim();
    const titleAr = document.getElementById('doc-form-title-ar').value.trim();
    const titleEn = document.getElementById('doc-form-title-en').value.trim();
    const previewUrl = document.getElementById('doc-form-preview-url').value.trim();
    const downloadUrl = document.getElementById('doc-form-download-url').value.trim();

    if (!titleFr || !previewUrl || !downloadUrl) {
      showToast(t('admin.requiredFieldsMissing'));
      return;
    }

    const id = editingDocId || nextDocId(APP.db.documents);
    const existing = editingDocId ? APP.db.documents.find(d => d.id === editingDocId) : null;
    const existingPending = editingDocId && !existing ? getPendingDocs().find(d => d.id === editingDocId) : null;

    const doc = {
      id,
      title: { fr: titleFr, ar: titleAr || titleFr, en: titleEn || titleFr },
      level: document.getElementById('doc-form-level').value,
      stream: document.getElementById('doc-form-stream').value || null,
      subject: document.getElementById('doc-form-subject').value,
      type: document.getElementById('doc-form-type').value,
      year: parseInt(document.getElementById('doc-form-year').value, 10) || new Date().getFullYear(),
      trimestre: document.getElementById('doc-form-trimestre').value || null,
      wilaya: document.getElementById('doc-form-wilaya').value.trim() || null,
      description: {
        fr: document.getElementById('doc-form-desc-fr').value.trim(),
        ar: document.getElementById('doc-form-desc-ar').value.trim(),
        en: document.getElementById('doc-form-desc-en').value.trim()
      },
      fileType: 'pdf',
      pages: parseInt(document.getElementById('doc-form-pages').value, 10) || 1,
      size: document.getElementById('doc-form-size').value.trim() || '—',
      previewUrl,
      downloadUrl,
      host: document.getElementById('doc-form-host').value,
      source: document.getElementById('doc-form-source').value.trim() || existing?.source || existingPending?.source || '',
      urlSource: document.getElementById('doc-form-url-source').value.trim() || existing?.urlSource || existingPending?.urlSource || '',
      urlPdf: document.getElementById('doc-form-url-pdf').value.trim() || existing?.urlPdf || existingPending?.urlPdf || '',
      downloads: existing?.downloads || existingPending?.downloads || 0,
      rating: existing?.rating || existingPending?.rating || 0,
      tags: existing?.tags || existingPending?.tags || []
    };

    if (editingIsPending) {
      const pending = getPendingDocs();
      const idx = pending.findIndex(d => d.id === id);
      if (idx >= 0) pending[idx] = doc;
      else pending.push(doc);
      savePendingDocs(pending);
    } else {
      upsertLocalDoc(doc);
      applyLocalDocOverrides();
    }
    renderAdminDocTable();
    resetDocForm();
    showToast(editingDocId ? t('admin.docUpdated') : t('admin.docAdded'));
  });

  document.getElementById('doc-form-cancel-btn').addEventListener('click', resetDocForm);

  const searchInput = document.getElementById('admin-doc-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(renderAdminDocTable, 200));
  }

  document.getElementById('export-db-btn').addEventListener('click', exportDbJson);

  // Spell check descriptions via AI
  const spellCheckBtn = document.getElementById('spell-check-btn');
  if (spellCheckBtn) {
    spellCheckBtn.addEventListener('click', async () => {
      const frText = document.getElementById('doc-form-desc-fr').value.trim();
      if (!frText) { showToast('Remplis d\'abord la description en français.'); return; }
      const key = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
      if (!key && typeof getActiveKey === 'function') {
        // fallback to any stored key
        if (typeof getStoredKeys === 'function') {
          const keys = getStoredKeys();
          if (keys.length) {
            spellCheckBtn.textContent = '⏳ Correction…';
            spellCheckBtn.disabled = true;
            try {
              const corrected = await correctTextWithAI(frText, keys[0]);
              if (corrected && corrected !== frText) {
                document.getElementById('doc-form-desc-fr').value = corrected;
                document.getElementById('doc-form-desc-fr').dispatchEvent(new Event('input', { bubbles: true }));
                showToast('Description corrigée !');
              } else {
                showToast('Aucune correction nécessaire.');
              }
            } catch (err) {
              showToast('Erreur: ' + err.message);
            }
            spellCheckBtn.textContent = t('admin.spellCheck') || 'Corriger l\'orthographe (descriptions)';
            spellCheckBtn.disabled = false;
            return;
          }
        }
        showToast('Configure une clé API dans l\'onglet IA.');
        return;
      }
      if (!key) { showToast('Configure une clé API dans l\'onglet IA.'); return; }
      spellCheckBtn.textContent = '⏳ Correction…';
      spellCheckBtn.disabled = true;
      try {
        const corrected = await correctTextWithAI(frText, key);
        if (corrected && corrected !== frText) {
          document.getElementById('doc-form-desc-fr').value = corrected;
          document.getElementById('doc-form-desc-fr').dispatchEvent(new Event('input', { bubbles: true }));
          showToast('Description corrigée !');
        } else {
          showToast('Aucune correction nécessaire.');
        }
      } catch (err) {
        showToast('Erreur: ' + err.message);
      }
      spellCheckBtn.textContent = t('admin.spellCheck') || 'Corriger l\'orthographe (descriptions)';
      spellCheckBtn.disabled = false;
    });
  }
}

async function correctTextWithAI(text, keyConfig) {
  const apiKey = (typeof sanitizeApiKey === 'function') ? sanitizeApiKey(keyConfig.apiKey) : keyConfig.apiKey.trim();
  const prompt = 'Corrige les fautes d\'orthographe et de grammaire du texte suivant en français. Ne change PAS le contenu, corrige UNIQUEMENT les erreurs. Réponds UNIQUEMENT avec le texte corrigé, sans commentaire ni guillemets.\n\n' + text.slice(0, 1000);
  if (keyConfig.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: keyConfig.model || 'gpt-4.1', messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }
  if (keyConfig.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: keyConfig.model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || text;
  }
  if (keyConfig.provider === 'google') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${keyConfig.model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim() || text;
  }
  throw new Error('Fournisseur non supporté pour la correction.');
}

async function exportDbJson() {
  try {
    const exportObj = await buildExportObj();
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'db.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    saveDbBackup('db.json', exportObj);
    renderDbBackupList();
    showToast(t('admin.exported'));
  } catch (err) {
    console.error('[INRY-Biblio] Échec de l\'export db.json:', err);
    showToast('Erreur export: ' + err.message);
  }
}

/* ---- PAT Encryption (AES-GCM) ---- */
var GH_PAT_KEY_STORAGE = 'inry_gh_pat_key';

function getOrCreatePatKey() {
  var stored = localStorage.getItem(GH_PAT_KEY_STORAGE);
  if (stored) return stored;
  var arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  var key = btoa(String.fromCharCode.apply(null, arr));
  localStorage.setItem(GH_PAT_KEY_STORAGE, key);
  return key;
}

async function encryptPat(pat) {
  if (!pat) return null;
  try {
    var keyB64 = getOrCreatePatKey();
    var keyBytes = Uint8Array.from(atob(keyB64), function(c) { return c.charCodeAt(0); });
    var cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    var iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    var encoded = new TextEncoder().encode(pat);
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, encoded);
    return { iv: btoa(String.fromCharCode.apply(null, iv)), data: btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted))) };
  } catch(e) { console.error('PAT encrypt error:', e); return null; }
}

async function buildExportObj() {
  var ghCfg = getGithubConfig();
  return {
    meta: APP.db.meta,
    levels: APP.db.levels,
    streams: APP.db.streams,
    subjects: APP.db.subjects,
    documentTypes: APP.db.documentTypes,
    wilayas: APP.db.wilayas,
    institutions: APP.db.institutions,
    hosts: APP.db.hosts,
    documents: APP.db.documents,
    hidden: {
      docIds: getHiddenIds(),
      levelIds: getEntityHiddenIds('levels'),
      streamIds: getEntityHiddenIds('streams'),
      subjectIds: getEntityHiddenIds('subjects')
    },
    githubSync: {
      encryptedPAT: await encryptPat(ghCfg.pat),
      patKey: localStorage.getItem(GH_PAT_KEY_STORAGE) || '',
      repo: ghCfg.repo || '',
      branch: ghCfg.branch || 'main',
      path: ghCfg.path || 'repo/data/db.json',
      autoPush: getGithubAutoPush()
    }
  };
}

/* ---- Import db.json & local backups ---- */
const DB_BACKUPS_KEY = 'inry_db_backups';
const MAX_BACKUPS = 5;

function computeDbStats(data) {
  var docs = data.documents || [];
  var total = docs.length;
  var subjects = {}; var types = {}; var years = {};
  docs.forEach(function(d) {
    var s = APP.db.subjects.find(function(s) { return s.id === d.subject; });
    var sn = s ? (localized(s.name) || d.subject) : d.subject;
    subjects[sn] = (subjects[sn] || 0) + 1;
    var t = APP.db.documentTypes.find(function(t) { return t.id === d.type; });
    var tn = t ? (localized(t.name) || d.type) : d.type;
    types[tn] = (types[tn] || 0) + 1;
    if (d.year) years[d.year] = (years[d.year] || 0) + 1;
  });
  var yearRange = Object.keys(years).sort();
  return { total: total, subjects: subjects, types: types, years: yearRange };
}

function getDbBackups() {
  try { return JSON.parse(localStorage.getItem(DB_BACKUPS_KEY)) || []; } catch(e) { return []; }
}

function saveDbBackup(name, data) {
  var json = JSON.stringify(data);
  var sizeBytes = new Blob([json]).size;
  var sizeLabel = sizeBytes < 1024 ? sizeBytes + ' o' : sizeBytes < 1048576 ? (sizeBytes / 1024).toFixed(1) + ' Ko' : (sizeBytes / 1048576).toFixed(1) + ' Mo';
  var stats = computeDbStats(data);
  var backups = getDbBackups();
  backups.unshift({ id: Date.now(), name: name || 'db.json', timestamp: new Date().toISOString(), size: sizeLabel, stats: stats, data: data });
  if (backups.length > MAX_BACKUPS) backups = backups.slice(0, MAX_BACKUPS);
  try { localStorage.setItem(DB_BACKUPS_KEY, JSON.stringify(backups)); } catch(e) { showToast('Stockage local saturé, sauvegarde ignorée.'); }
}

function deleteDbBackup(id) {
  var backups = getDbBackups().filter(function(b) { return b.id !== id; });
  localStorage.setItem(DB_BACKUPS_KEY, JSON.stringify(backups));
}

function renderDbBackupList() {
  var el = document.getElementById('db-backup-list');
  if (!el) return;
  var backups = getDbBackups();
  if (!backups.length) {
    el.innerHTML = '<div style="padding:var(--space-3);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune sauvegarde locale</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:var(--space-1);">Sauvegardes locales :</div>' +
    backups.map(function(b) {
      var s = b.stats || {};
      var tooltipParts = [];
      tooltipParts.push('📄 ' + s.total + ' document' + (s.total > 1 ? 's' : ''));
      if (b.size) tooltipParts.push('💾 ' + b.size);
      if (s.years && s.years.length) tooltipParts.push('📅 ' + s.years[0] + (s.years.length > 1 ? '–' + s.years[s.years.length - 1] : ''));
      if (s.subjects) {
        var topSubj = Object.entries(s.subjects).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
        topSubj.forEach(function(kv) { tooltipParts.push('📁 ' + kv[0] + ': ' + kv[1]); });
      }
      if (s.types) {
        Object.entries(s.types).forEach(function(kv) { tooltipParts.push('🏷 ' + kv[0] + ': ' + kv[1]); });
      }
      var tooltipHtml = tooltipParts.length ? tooltipParts.join('<br>') : '';
      return '<div class="db-backup-item" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border:1px solid var(--kraft-line);border-radius:var(--radius-sm);margin-bottom:var(--space-1);">' +
        (tooltipHtml ? '<div class="db-backup-tooltip" data-tt="' + escapeHTML(tooltipHtml) + '">' + tooltipHtml + '</div>' : '') +
        '<span style="flex:1;font-size:var(--fs-xs);">' +
          '<strong>' + escapeHTML(b.name || 'db.json') + '</strong>' +
          (b.size ? ' <span style="color:var(--ink-soft);font-size:9px;">(' + escapeHTML(b.size) + ')</span>' : '') +
          '<br><span style="color:var(--ink-soft);font-size:10px;">' + new Date(b.timestamp).toLocaleString() + '</span>' +
        '</span>' +
        '<button class="btn btn-primary btn-sm db-backup-restore-btn" data-backup-id="' + b.id + '">Restaurer</button>' +
        '<button class="btn btn-ghost btn-sm db-backup-del-btn" data-backup-id="' + b.id + '" title="Supprimer">✕</button></div>';
    }).join('');
  el.querySelectorAll('.db-backup-restore-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var backup = getDbBackups().find(function(b) { return b.id === parseInt(btn.dataset.backupId); });
      if (!backup) return;
      if (!confirm('Restaurer la sauvegarde "' + (backup.name || 'db.json') + '" du ' + new Date(backup.timestamp).toLocaleString() + ' ?')) return;
      importDbData(backup.data);
    });
  });
  el.querySelectorAll('.db-backup-del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      deleteDbBackup(parseInt(btn.dataset.backupId));
      renderDbBackupList();
    });
  });
  // Tooltip positioning on hover
  el.querySelectorAll('.db-backup-item').forEach(function(item) {
    var tip = item.querySelector('.db-backup-tooltip');
    if (!tip) return;
    function showTip(e) {
      var rect = item.getBoundingClientRect();
      var tipRect = tip.getBoundingClientRect();
      var tipH = tipRect.height || 120;
      var spaceBelow = window.innerHeight - rect.bottom;
      var spaceAbove = rect.top;
      tip.classList.add('show');
      tip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
      if (spaceBelow >= tipH + 12) {
        tip.style.top = (rect.bottom + 8) + 'px';
        tip.style.bottom = 'auto';
      } else if (spaceAbove >= tipH + 12) {
        tip.style.top = 'auto';
        tip.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      } else {
        tip.style.top = Math.max(4, rect.top) + 'px';
        tip.style.bottom = 'auto';
      }
    }
    item.addEventListener('mouseenter', showTip);
    item.addEventListener('mousemove', showTip);
    item.addEventListener('mouseleave', function() { tip.classList.remove('show'); });
  });
}

function importDbData(data) {
  try {
    if (!data || !data.meta || !data.documents) {
      showToast('Fichier invalide : structure db.json non reconnue.');
      return;
    }
    localStorage.setItem('inry_custom_db', JSON.stringify(data));
    localStorage.removeItem('inry_local_docs');
    localStorage.removeItem('inry_deleted_ids');
    showToast('Base importée ! Rechargement…');
    setTimeout(function() { location.reload(); }, 800);
  } catch(err) {
    showToast('Erreur: ' + err.message);
  }
}

/* ---- Auto-backup planifié ---- */

var autoBackupTimer = null;
var AUTO_BACKUP_KEY = 'inry_auto_backup';
var AUTO_BACKUP_LAST_KEY = 'inry_auto_backup_last';
var AUTO_BACKUP_CHECK_INTERVAL = 30000; // check every 30s

function getAutoBackupConfig() {
  try {
    var raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return { mode: 'off' };
    return JSON.parse(raw);
  } catch(e) { return { mode: 'off' }; }
}

function setAutoBackupConfig(cfg) {
  try { localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(cfg)); } catch(e) {}
}

function stopAutoBackup() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
}

function getDbDataForBackup() {
  var custom = localStorage.getItem('inry_custom_db');
  if (custom) { try { return JSON.parse(custom); } catch(e) {} }
  var local = localStorage.getItem('inry_local_docs');
  var deleted = localStorage.getItem('inry_deleted_ids');
  return {
    meta: APP.db ? APP.db.meta : { version: 1 },
    documents: local ? JSON.parse(local) : (APP.db ? APP.db.documents : []),
    subjects: APP.db ? APP.db.subjects : [],
    documentTypes: APP.db ? APP.db.documentTypes : [],
    studyLevels: APP.db ? APP.db.studyLevels : [],
    removedIds: deleted ? JSON.parse(deleted) : []
  };
}

function shouldRunBackup(cfg) {
  var now = Date.now();
  var last = 0;
  try { last = parseInt(localStorage.getItem(AUTO_BACKUP_LAST_KEY)) || 0; } catch(e) {}
  if (cfg.mode === 'interval') {
    var ms = parseInt(cfg.value) * (cfg.unit === 'minutes' ? 60000 : cfg.unit === 'hours' ? 3600000 : 86400000);
    if (isNaN(ms) || ms <= 0) return false;
    return (now - last) >= ms;
  }
  if (cfg.mode === 'fixed') {
    var d = new Date();
    var target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(cfg.hour) || 0, parseInt(cfg.minute) || 0);
    // If target already passed today, schedule for next day
    if (target <= new Date(last)) return false;
    return now >= target.getTime();
  }
  return false;
}

function performAutoBackup() {
  var cfg = getAutoBackupConfig();
  if (cfg.mode === 'off') return;
  if (!shouldRunBackup(cfg)) return;
  var now = Date.now();
  try { localStorage.setItem(AUTO_BACKUP_LAST_KEY, String(now)); } catch(e) {}
  var data = getDbDataForBackup();
  if (!data || !data.documents) return;
  saveDbBackup('auto-' + new Date().toISOString().slice(0,10), data);
}

function startAutoBackup() {
  stopAutoBackup();
  var cfg = getAutoBackupConfig();
  if (cfg.mode === 'off') return;
  performAutoBackup();
  autoBackupTimer = setInterval(performAutoBackup, AUTO_BACKUP_CHECK_INTERVAL);
}

function wireAutoBackupUI() {
  var cfg = getAutoBackupConfig();
  var modeRadios = document.querySelectorAll('input[name="auto-backup-mode"]');
  var intervalGroup = document.getElementById('auto-backup-interval-group');
  var fixedGroup = document.getElementById('auto-backup-fixed-group');

  if (!modeRadios.length) return;
  modeRadios.forEach(function(r) { r.checked = r.value === cfg.mode; });
  toggleAutoBackupGroups(cfg.mode);

  modeRadios.forEach(function(r) {
    r.addEventListener('change', function() {
      toggleAutoBackupGroups(r.value);
    });
  });

  document.getElementById('auto-backup-interval-val').value = cfg.value || 1;
  document.getElementById('auto-backup-interval-unit').value = cfg.unit || 'hours';
  var h = ('0' + (cfg.hour || 8)).slice(-2);
  var m = ('0' + (cfg.minute || 0)).slice(-2);
  document.getElementById('auto-backup-fixed-hour').value = h + ':' + m;

  document.getElementById('auto-backup-save').addEventListener('click', function() {
    var mode = document.querySelector('input[name="auto-backup-mode"]:checked');
    if (!mode) return;
    var newCfg = { mode: mode.value };
    if (mode.value === 'interval') {
      newCfg.value = parseInt(document.getElementById('auto-backup-interval-val').value) || 1;
      newCfg.unit = document.getElementById('auto-backup-interval-unit').value;
    } else if (mode.value === 'fixed') {
      var timeParts = document.getElementById('auto-backup-fixed-hour').value.split(':');
      newCfg.hour = parseInt(timeParts[0]) || 0;
      newCfg.minute = parseInt(timeParts[1]) || 0;
    }
    setAutoBackupConfig(newCfg);
    startAutoBackup();
    showToast(mode.value === 'off' ? 'Sauvegarde automatique désactivée' : 'Sauvegarde automatique activée');
  });
}

function toggleAutoBackupGroups(mode) {
  var intervalGroup = document.getElementById('auto-backup-interval-group');
  var fixedGroup = document.getElementById('auto-backup-fixed-group');
  if (intervalGroup) intervalGroup.style.display = mode === 'interval' ? 'flex' : 'none';
  if (fixedGroup) fixedGroup.style.display = mode === 'fixed' ? 'flex' : 'none';
}

function wireImportBackupUI() {
  document.getElementById('import-db-btn').addEventListener('click', function() {
    var fileInput = document.getElementById('import-db-file-input');
    var file = fileInput.files[0];
    if (!file) { showToast('Sélectionne un fichier db.json d\'abord.'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        importDbData(data);
      } catch(err) {
        showToast('Erreur de lecture du fichier: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('reset-db-btn').addEventListener('click', function() {
    if (!confirm('Réinitialiser la base aux données d\'origine ? Toute modification locale sera perdue.')) return;
    localStorage.removeItem('inry_custom_db');
    localStorage.removeItem('inry_local_docs');
    localStorage.removeItem('inry_deleted_ids');
    showToast('Base réinitialisée. Rechargement…');
    setTimeout(function() { location.reload(); }, 800);
  });

  renderDbBackupList();
}

/* ---- Import manifest helpers (dzexams format) ---- */

function guessLevel(raw) {
  const map = { '1am': 'm1','2am': 'm2','3am': 'm3','4am': 'm4',
    '1as': 's1','2as': 's2','3as': 's3',
    'ap1': 'p1','ap2': 'p2','ap3': 'p3','ap4': 'p4','ap5': 'p5' };
  return map[raw] || raw;
}
function guessSubject(raw, db) {
  const sub = (db.subjects || []).find(s => raw.includes(s.id) || raw.includes(localized(s.name).toLowerCase()));
  return sub ? sub.id : raw;
}
function guessType(raw, db) {
  const map = { devoir: 'devoir', composition: 'devoir', examen: 'examen', fiche: 'fiche', cours: 'cours', serie: 'serie', exercice: 'exercice', sujet: 'bac-bem', bac: 'bac-bem', bem: 'bac-bem', corrige: 'corrige', correction: 'corrige' };
  if (raw && typeof raw === 'string') {
    const lc = raw.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (lc.includes(k)) return v;
    }
  }
  return raw || 'devoir';
}
function guessStream(raw, db) {
  const map = { science: 'sci', maths: 'math', technique: 'tech', lettre: 'lettres', gestion: 'eco', economie: 'eco', langues: 'langues', philo: 'philo' };
  if (raw && typeof raw === 'string') {
    const lc = raw.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (lc.includes(k)) return v;
    }
  }
  return raw || null;
}
function guessTrimestre(raw) {
  const map = { '1': 't1', '2': 't2', '3': 't3', '01': 't1', '02': 't2', '03': 't3', premier: 't1', deuxieme: 't2', troisieme: 't3', '1er': 't1', '2eme': 't2', '3eme': 't3' };
  if (raw && typeof raw === 'string') {
    const lc = raw.toLowerCase().trim();
    if (map[lc]) return map[lc];
    if (lc.includes('1')) return 't1';
    if (lc.includes('2')) return 't2';
    if (lc.includes('3')) return 't3';
  }
  return raw || null;
}
function extractDriveId(url) {
  if (!url) return '';
  const m = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?#&]+)/) || url.match(/\/file\/d\/([^/?#&]+)/);
  return m ? m[1] : '';
}
function toDrivePreview(id) {
  return id ? 'https://drive.google.com/file/d/' + id + '/preview' : '';
}
function toDriveDownload(id) {
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : '';
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function stripEmoji(str) {
  return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}\u{2795}\u{2796}\u{274C}\u{274E}\u{2757}\u{203C}\u{2049}\u{2139}\u{24C2}\u{2934}\u{2935}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '').trim();
}

async function translateFromAr(text, targetLang) {
  if (!text.trim()) return '';
  const cleaned = stripEmoji(text);
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(cleaned.slice(0, 500)) + '&langpair=ar|' + targetLang;
    const res = await fetch(url);
    const data = await res.json();
    return data.responseData?.translatedText || cleaned;
  } catch { return cleaned; }
}

function detectProviderFromUrl(url) {
  if (!url) return null;
  if (url.includes('mega.nz')) return 'mega';
  if (url.includes('drive.google.com')) return 'google';
  if (url.includes('dropbox.com')) return 'dropbox';
  if (url.includes('sharepoint.com') || url.includes('onedrive.live.com')) return 'onedrive';
  return null;
}

function migrateHostFromUrl() {
  const pending = getPendingDocs();
  const localDocs = getLocalDocs();
  let updated = 0;

  pending.forEach(d => {
    const provider = detectProviderFromUrl(d.previewUrl) || detectProviderFromUrl(d.downloadUrl);
    if (provider && d.host !== provider) { d.host = provider; updated++; }
  });
  savePendingDocs(pending);

  localDocs.forEach(d => {
    const provider = detectProviderFromUrl(d.previewUrl) || detectProviderFromUrl(d.downloadUrl);
    if (provider && d.host !== provider) { d.host = provider; updated++; }
  });
  saveLocalDocs(localDocs);

  try {
    var custom = localStorage.getItem('inry_custom_db');
    if (custom) {
      var data = JSON.parse(custom);
      if (data.documents) {
        data.documents.forEach(d => {
          const provider = detectProviderFromUrl(d.previewUrl) || detectProviderFromUrl(d.downloadUrl);
          if (provider && d.host !== provider) { d.host = provider; updated++; }
        });
        localStorage.setItem('inry_custom_db', JSON.stringify(data));
      }
    }
  } catch(e) {}

  applyLocalDocOverrides();
  renderAdminDocTable();
  showToast(updated + ' document(s) mis à jour (host → provider)');
}

async function batchAddAll(parsedDocs, rawDocs) {
  let idCounter = Math.max(0, ...APP.db.documents.map(d => parseInt((d.id||'').replace('doc-',''),10)).filter(n=>!isNaN(n)), ...getPendingDocs().map(d => parseInt((d.id||'').replace('doc-',''),10)).filter(n=>!isNaN(n)));
  const pending = getPendingDocs();
  let count = 0;
  for (let i = 0; i < parsedDocs.length; i++) {
    const d = parsedDocs[i];
    const [frTitle, enTitle] = await Promise.all([
      d.title.fr || translateFromAr(d.title.ar, 'fr'),
      d.title.en || translateFromAr(d.title.ar, 'en')
    ]);
    idCounter++;
    const doc = {
      id: 'doc-' + String(idCounter).padStart(4, '0'),
      title: { fr: frTitle, ar: d.title.ar, en: enTitle },
      level: d.level, stream: d.stream || null, subject: d.subject,
      type: d.type, year: d.year, trimestre: d.trimestre || null,
      wilaya: d.wilaya, description: { fr: frTitle, ar: d.title.ar, en: enTitle },
      fileType: 'pdf', pages: d.pages, size: d.size,
      previewUrl: d.previewUrl, downloadUrl: d.downloadUrl, host: d.host,
      source: d.source || '', urlSource: d.urlSource || '', urlPdf: d.urlPdf || '',
      downloads: 0, rating: 0, tags: []
    };
    pending.push(doc);
    count++;
  }
  savePendingDocs(pending);
  renderAdminDocTable();
  showToast(count + ' document(s) importé(s) — en attente de validation dans la liste 📋');
}

function openAdminPdfPreview(url) {
  const overlay = document.createElement('div');
  overlay.className = 'pdf-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:90vw;height:90vh;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f5f5f5;border-bottom:1px solid #ddd;';
  const title = document.createElement('span');
  title.textContent = '📄 Aperçu PDF';
  title.style.cssText = 'font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;padding:0 4px;';
  closeBtn.addEventListener('click', close);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = 'flex:1;border:none;width:100%;';
  iframe.allow = 'fullscreen';

  box.appendChild(header);
  box.appendChild(iframe);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', keyHandler);
  }
  function keyHandler(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', keyHandler);
}

function generateManifestJSON() {
  var docs = getLocalDocs();
  var items = docs.map(function(d) {
    return {
      titre: d.title ? (d.title.ar || d.title.fr || d.title.en || '') : '',
      titreAr: d.title ? d.title.ar || '' : '',
      titreFr: d.title ? d.title.fr || '' : '',
      titreEn: d.title ? d.title.en || '' : '',
      niveau: d.level || '',
      filiere: d.stream || '',
      matiere: d.subject || '',
      type_doc_label: d.type || '',
      annee: d.year || '',
      trimestre: d.trimestre || '',
      wilaya: d.wilaya || '',
      tailleFichier: d.size || '',
      pages: d.pages || '',
      urlCloud: d.previewUrl || '',
      urlPartage: d.downloadUrl || '',
      provider: d.host || '',
      source: d.source || '',
      urlSource: d.urlSource || '',
      urlPdf: d.urlPdf || ''
    };
  });
  return { items: items, generatedAt: new Date().toISOString(), count: items.length, source: 'inry-biblio-blogger' };
}

function downloadManifestJSON() {
  var manifest = generateManifestJSON();
  if (!manifest.items.length) { showToast('Aucun document à exporter.'); return; }
  var blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'manifest-inry-biblio-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  var stats = document.getElementById('export-manifest-stats');
  if (stats) stats.textContent = manifest.items.length + ' document(s) exporté(s) — ' + manifest.generatedAt;
  showToast(manifest.items.length + ' document(s) téléchargé(s)');
}

function copyManifestToClipboard() {
  var manifest = generateManifestJSON();
  if (!manifest.items.length) { showToast('Aucun document à exporter.'); return; }
  var text = JSON.stringify(manifest, null, 2);
  navigator.clipboard.writeText(text).then(function() {
    var stats = document.getElementById('export-manifest-stats');
    if (stats) stats.textContent = manifest.items.length + ' document(s) copiés — ' + manifest.generatedAt;
    showToast(manifest.items.length + ' document(s) copiés dans le presse-papier');
  }).catch(function() {
    showToast('Erreur: impossible de copier');
  });
}
