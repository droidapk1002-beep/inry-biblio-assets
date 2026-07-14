(function(){ try {
  var m = document.createElement('div');
  m.id = 'assistant-js-loaded';
  m.style.display = 'none';
  document.body.appendChild(m);
} catch(e){} })();

let chatHistory = [];
let attachedFile = null;
let generationAbort = null;
let isGenerating = false;
function hasArabic(text) { return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text); }
function msgDir(text) { return hasArabic(text) ? 'rtl' : 'ltr'; }
function msgStyle(text) { return hasArabic(text) ? 'text-align:right;direction:rtl;unicode-bidi:isolate;' : 'text-align:left;direction:ltr;'; }

/* ---- Conversation management ---- */
const CONV_KEY = 'inry_conversations';
const CURR_CONV_KEY = 'inry_current_conv_id';
let conversations = [];
let currentConvId = null;

function loadConversations() {
  try { conversations = JSON.parse(localStorage.getItem(CONV_KEY) || '[]'); } catch { conversations = []; }
}
function saveConversations() {
  localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
}

function saveCurrentConversation() {
  if (!currentConvId) return;
  const idx = conversations.findIndex(c => c.id === currentConvId);
  const title = conversations[idx]?.title || conversationTitleFromHistory() || 'Sans titre';
  const conv = { id: currentConvId, title, history: chatHistory, updated: Date.now() };
  if (idx >= 0) {
    conversations[idx] = conv;
  } else {
    conversations.push(conv);
  }
  saveConversations();
}

function conversationTitleFromHistory() {
  for (const m of chatHistory) {
    if (m.role === 'user' && m.content) {
      return m.content.slice(0, 60) + (m.content.length > 60 ? '…' : '');
    }
  }
  return '';
}

function switchConversation(id) {
  saveCurrentConversation();
  const conv = conversations.find(c => c.id === id);
  if (conv) {
    chatHistory = conv.history || [];
    currentConvId = id;
  } else {
    chatHistory = [];
    currentConvId = null;
  }
  localStorage.setItem(CURR_CONV_KEY, currentConvId || '');
  renderChatHistory();
  renderConvList();
}

function newConversation() {
  saveCurrentConversation();
  chatHistory = [];
  currentConvId = 'conv-' + Date.now();
  conversations.push({ id: currentConvId, title: 'Nouvelle conversation', history: [], created: Date.now(), updated: Date.now() });
  localStorage.setItem(CURR_CONV_KEY, currentConvId);
  saveConversations();
  renderChatHistory();
  renderConvList();
  document.getElementById('chat-search-inp').value = '';
  showFilteredChat = false;
}

function deleteConversation(id) {
  conversations = conversations.filter(c => c.id !== id);
  saveConversations();
  if (currentConvId === id) {
    if (conversations.length > 0) {
      switchConversation(conversations[conversations.length - 1].id);
    } else {
      newConversation();
    }
  } else {
    renderConvList();
  }
}

function renameConversation(id, newTitle) {
  const conv = conversations.find(c => c.id === id);
  if (conv) { conv.title = newTitle || 'Sans titre'; conv.updated = Date.now(); saveConversations(); renderConvList(); }
}

function renderConvList() {
  const list = document.getElementById('conv-list');
  if (!list) return;
  if (!conversations.length) {
    list.innerHTML = '<div style="padding:var(--space-3);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune conversation</div>';
    return;
  }
  list.innerHTML = [...conversations].sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(c =>
    `<div class="conv-item ${c.id === currentConvId ? 'active' : ''}" data-conv-id="${c.id}">
      <span class="conv-item-title">${escapeHTML(c.title || 'Sans titre')}</span>
      <span class="conv-item-actions">
        <button class="conv-rename-btn" title="Renommer">✎</button>
        <button class="conv-delete-btn" title="Supprimer">✕</button>
      </span>
    </div>`
  ).join('');
  list.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.conv-item-actions')) return;
      switchConversation(el.dataset.convId);
      document.getElementById('conv-sidebar').style.display = 'none';
    });
  });
  list.querySelectorAll('.conv-rename-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.conv-item').dataset.convId;
      const title = prompt('Nouveau titre :', conversations.find(c => c.id === id)?.title || '');
      if (title !== null) renameConversation(id, title.trim());
    });
  });
  list.querySelectorAll('.conv-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer cette conversation ?')) deleteConversation(btn.closest('.conv-item').dataset.convId);
    });
  });
}

/* ---- Saved prompts ---- */
const PROMPTS_KEY = 'inry_saved_prompts';
let savedPrompts = [];

function loadSavedPrompts() {
  try { savedPrompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '[]'); } catch { savedPrompts = []; }
}
function saveSavedPrompts() {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(savedPrompts));
}
function addSavedPrompt(title, text) {
  savedPrompts.push({ id: 'prompt-' + Date.now(), title: title || 'Sans titre', text });
  saveSavedPrompts();
  renderPromptsList();
}
function deleteSavedPrompt(id) {
  savedPrompts = savedPrompts.filter(p => p.id !== id);
  saveSavedPrompts();
  renderPromptsList();
}
function renderPromptsList() {
  const list = document.getElementById('prompts-list');
  if (!list) return;
  if (!savedPrompts.length) {
    list.innerHTML = '<div style="padding:var(--space-3);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucun prompt sauvegardé</div>';
    return;
  }
  list.innerHTML = savedPrompts.map(p =>
    `<div class="prompt-item" data-prompt-text="${escapeHTML(p.text)}">
      <span class="prompt-item-text">${escapeHTML(p.title)}</span>
      <button class="prompt-delete-btn" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);" title="Supprimer">✕</button>
    </div>`
  ).join('');
  list.querySelectorAll('.prompt-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-delete-btn')) return;
      const ta = document.getElementById('chat-textarea');
      if (ta) {
        ta.value = el.dataset.promptText;
        ta.focus();
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
      }
      document.getElementById('saved-prompts-panel').style.display = 'none';
    });
  });
  list.querySelectorAll('.prompt-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = btn.closest('.prompt-item');
      const idx = savedPrompts.findIndex(p => p.text === el.dataset.promptText);
      if (idx >= 0) deleteSavedPrompt(savedPrompts[idx].id);
    });
  });
}

/* ---- Export chat ---- */
function showExportMenu(anchor, cb) {
  var existing = document.getElementById('export-format-menu');
  if (existing) { existing.remove(); return; }
  var menu = document.createElement('div');
  menu.id = 'export-format-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:2px solid var(--kraft);border-radius:var(--radius-md);box-shadow:0 4px 16px rgba(0,0,0,.12);padding:var(--space-1);display:flex;flex-direction:column;gap:2px;min-width:140px;opacity:0;pointer-events:none;';
  var rect = anchor.getBoundingClientRect();
  var items = [
    { icon: '📝', label: 'Markdown (.md)', fmt: 'md' },
    { icon: '📄', label: 'Texte (.txt)', fmt: 'txt' },
    { icon: '📘', label: 'Word (.doc)', fmt: 'doc' },
    { icon: '📕', label: 'PDF (.pdf)', fmt: 'pdf' }
  ];
  items.forEach(function(it) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-3);border:none;border-radius:var(--radius-sm);background:transparent;color:var(--ink);font-size:var(--fs-xs);cursor:pointer;text-align:start;white-space:nowrap;';
    btn.innerHTML = '<span style="font-size:14px;">' + it.icon + '</span> ' + it.label;
    btn.onmouseover = function() { this.style.background = 'var(--cream-card)'; };
    btn.onmouseout = function() { this.style.background = 'transparent'; };
    btn.onclick = function() { menu.remove(); cb(it.fmt); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  var mh = menu.offsetHeight;
  var top = rect.bottom + 4;
  if (top + mh > window.innerHeight) top = rect.top - mh - 4;
  top = Math.max(4, top);
  var left = Math.max(4, Math.min(rect.left, window.innerWidth - 160));
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  menu.style.opacity = '';
  menu.style.pointerEvents = '';
  setTimeout(function() {
    document.addEventListener('click', function closeMenu(e2) {
      if (!menu.contains(e2.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
    });
  }, 10);
}

function exportChat(format, msgs) {
  msgs = msgs || chatHistory;
  if (!msgs.length) { showToast('Rien à exporter.'); return; }
  var lines = msgs.map(function(m) {
    var role = m.role === 'user' ? 'Vous' : 'Assistant';
    var prefix = m.fileName ? '[Fichier: ' + m.fileName + '] ' : '';
    var img = m.imgUrl ? '\n[Image générée]' : '';
    var date = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
    return '[' + (date || role) + '] ' + role + ': ' + prefix + m.content + img;
  }).join('\n---\n');
  var header = '# Conversation INRY-Biblio\n# ' + new Date().toLocaleString() + '\n\n';
  if (format === 'doc') {
    var docHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conversation INRY-Biblio</title></head><body style="font-family:sans-serif;max-width:700px;margin:auto;padding:2em;">' +
      '<h1 style="border-bottom:2px solid #ddd;padding-bottom:.5em;">Conversation INRY-Biblio</h1>' +
      '<p style="color:#666;font-size:.9em;">' + new Date().toLocaleString() + '</p>' +
      msgs.map(function(m) {
        var r = m.role === 'user' ? 'Vous' : 'Assistant';
        var c = m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        return '<div style="margin:1em 0;padding:1em;background:' + (m.role === 'user' ? '#e8f5e9' : '#f5f5f5') + ';border-radius:8px;">' +
          '<strong>' + r + '</strong>' + (m.fileName ? ' <small>[' + m.fileName + ']</small>' : '') + '<br>' + c +
          (m.imgUrl ? '<br><em>[Image générée]</em>' : '') + '</div>';
      }).join('\n') + '</body></html>';
    var blob = new Blob([docHtml], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'conversation.doc';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  if (format === 'pdf') {
    var hasRtl = msgs.some(function(m) { return hasArabic(m.content); });
    try {
      if (typeof window.jspdf !== 'undefined' && !hasRtl) {
        var doc = new window.jspdf.jsPDF();
        var pageW = doc.internal.pageSize.getWidth();
        var margin = 20;
        var maxW = pageW - margin * 2;
        var y = margin;
        doc.setFontSize(16);
        doc.text('Conversation INRY-Biblio', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(new Date().toLocaleString(), margin, y);
        y += 10;
        msgs.forEach(function(m) {
          if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
          var r = m.role === 'user' ? 'Vous' : 'Assistant';
          var label = r + (m.fileName ? ' [' + m.fileName + ']' : '');
          doc.setFontSize(11);
          doc.setTextColor(m.role === 'user' ? '#2e7d32' : '#1565c0');
          doc.text(label, margin, y);
          y += 5;
          var textLines = doc.splitTextToSize(m.content, maxW);
          doc.setFontSize(10);
          doc.setTextColor(34);
          doc.text(textLines, margin, y);
          y += textLines.length * 5 + 6;
          if (m.imgUrl) {
            if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
            doc.setTextColor(150);
            doc.text('[Image générée]', margin, y);
            y += 6;
          }
        });
        doc.save('conversation.pdf');
      } else {
        if (hasRtl && typeof window.jspdf === 'undefined') showToast('Contenu arabe — génération PDF via impression...');
        var pdfHtml = '<!DOCTYPE html><html dir="' + (hasRtl ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>Conversation INRY-Biblio</title>' +
          '<style>body{font-family:sans-serif;max-width:700px;margin:auto;padding:2em;color:#222;}' +
          'h1{border-bottom:2px solid #ddd;padding-bottom:.5em;}' +
          '.msg{margin:1em 0;padding:1em;border-radius:8px;}' +
          '.user{background:#e8f5e9;text-align:' + (hasRtl ? 'right' : 'left') + ';}' +
          '.bot{background:#f5f5f5;text-align:' + (hasRtl ? 'right' : 'left') + ';}' +
          'small{color:#888;}@media print{body{padding:0;}}</style></head><body>' +
          '<h1>Conversation INRY-Biblio</h1>' +
          '<p style="color:#666;font-size:.9em;">' + new Date().toLocaleString() + '</p>' +
          msgs.map(function(m) {
            var r = m.role === 'user' ? 'Vous' : 'Assistant';
            var c = m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
            return '<div class="msg ' + (m.role === 'user' ? 'user' : 'bot') + '" dir="' + msgDir(m.content) + '">' +
              '<strong>' + r + '</strong>' + (m.fileName ? ' <small>[' + m.fileName + ']</small>' : '') + '<br>' + c +
              (m.imgUrl ? '<br><em>[Image générée]</em>' : '') + '</div>';
          }).join('\n') + '</body></html>';
        var w = window.open('', '_blank');
        if (w) { w.document.write(pdfHtml); w.document.close(); setTimeout(function() { w.focus(); w.print(); }, 500); }
      }
    } catch (e) { showToast('Erreur PDF : ' + e.message); }
    return;
  }
  var content = format === 'md' ? header + lines : lines.replace(/#/g, '');
  var ext = format === 'md' ? 'md' : 'txt';
  var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'conversation.' + ext;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---- Search in chat ---- */
let showFilteredChat = false;

function renderFilteredChat(query) {
  if (!query) { showFilteredChat = false; renderChatHistory(); return; }
  showFilteredChat = true;
  const scrollEl = document.getElementById('chat-scroll');
  const emptyEl = document.getElementById('chat-empty');
  const lower = query.toLowerCase();
  const filtered = chatHistory.filter(m => (m.content || '').toLowerCase().includes(lower) || (m.fileName || '').toLowerCase().includes(lower));
  if (!filtered.length) {
    scrollEl.innerHTML = '<div style="padding:var(--space-4);text-align:center;color:var(--ink-soft);font-size:var(--fs-sm);">Aucun message trouvé pour « ' + escapeHTML(query) + ' »</div>';
    emptyEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  scrollEl.innerHTML = filtered.map(msg => {
    var contentHtml = (msg.role === 'bot' || msg.role === 'assistant') ? renderMarkdown(msg.content) : escapeHTML(msg.content);
    contentHtml = contentHtml.replace(new RegExp(escapeRegExp(query), 'gi'), m => '<mark style="background:var(--gold);color:var(--ink);padding:0 2px;border-radius:2px;">' + m.replace(/</g,'&lt;') + '</mark>');
    var copyHtml2 = (msg.role === 'bot' || msg.role === 'assistant') ? `<button class="copy-btn" onclick="copyMsgContent(this)">${icon('copy')} <span>Copier</span></button>` : '';
    return `<div dir="${msgDir(msg.content)}" style="${msgStyle(msg.content)}" class="chat-msg ${msg.role === 'user' ? 'user' : 'bot'}">${contentHtml}${copyHtml2}</div>`;
  }).join('');
  scrollEl.scrollTop = 0;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---- Original functions ---- */
function getSelectedKey() {
  const sel = document.getElementById('assistant-key-select');
  if (!sel) {
    var saved = sessionStorage.getItem('inry_assistant_key_id');
    if (saved && saved !== '__custom__') {
      var found = getStoredKeys().find(function(k) { return k.id === saved; });
      if (found) return found;
    }
    return getActiveKey();
  }
  const keyId = sel.value;
  if (!keyId) return null;
  if (keyId === '__custom__') {
    const customVal = document.getElementById('assistant-custom-key')?.value?.trim();
    const customProv = document.getElementById('assistant-custom-provider')?.value || 'openai';
    if (!customVal) return null;
    const defaults = PROVIDERS[customProv];
    if (defaults) {
      return { id: 'custom', provider: customProv, model: defaults.defaultModel, apiKey: customVal, endpoint: defaults.endpoint, active: true };
    }
    return { id: 'custom', provider: customProv, model: 'gpt-4.1', apiKey: customVal, active: true };
  }
  const keys = getStoredKeys();
  return keys.find(k => k.id === keyId) || null;
}

function populateKeySelect() {
  const sel = document.getElementById('assistant-key-select');
  const customRow = document.getElementById('assistant-custom-row');
  const customInput = document.getElementById('assistant-custom-key');
  const customProv = document.getElementById('assistant-custom-provider');
  if (!sel) { console.error('[populateKeySelect] sel not found'); return; }
  const keys = getStoredKeys();
  console.log('[DEBUG] getStoredKeys() returned', keys.length, 'keys:', JSON.stringify(keys).slice(0,200));
  const saved = sessionStorage.getItem('inry_assistant_key_id') || '';
  let html = `<option value="">${t('assistant.selectKey')}</option>`;
  if (keys.length === 0) {
    html += `<option value="" disabled style="color:var(--ink-soft);">— ${t('assistant.noKeysAvailable')} —</option>`;
  } else {
    keys.forEach(k => {
      const label = `${PROVIDERS[k.provider]?.label || k.provider} (${k.model})${k.endpoint ? ' · ' + k.endpoint : ''}`;
      html += `<option value="${k.id}" ${saved === k.id ? 'selected' : ''}>${label}</option>`;
    });
  }
  sel.dataset.empty = keys.length === 0 ? '1' : '0';

  var banner = document.getElementById('key-missing-banner');
  if (keys.length === 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'key-missing-banner';
      banner.style.cssText = 'background:var(--cream-card);border:1.5px dashed var(--gold);border-radius:var(--radius-md);padding:var(--space-3)var(--space-4);font-size:var(--fs-sm);color:var(--ink-soft);margin-bottom:var(--space-3);text-align:center;';
      banner.innerHTML = '🔑 ' + (t('assistant.noKeysHint') || 'Aucune clé API. Cliquez sur <strong>+</strong> ci-dessus pour en ajouter une.') + ' <button class="btn btn-secondary btn-sm" style="margin-inline-start:var(--space-2);" id="key-banner-add">+ Ajouter</button>';
      var keyRow = document.getElementById('assistant-key-select')?.parentNode;
      if (keyRow) keyRow.parentNode.insertBefore(banner, keyRow.nextSibling);
      document.getElementById('key-banner-add')?.addEventListener('click', function() {
        var p = document.getElementById('assistant-add-key-panel');
        if (p) { p.style.display = 'block'; banner.remove(); }
      });
    }
  } else {
    if (banner) banner.remove();
  }
  html += `<option value="__custom__" ${saved === '__custom__' ? 'selected' : ''}>— ${t('assistant.customKey')} —</option>`;
  sel.innerHTML = html;

  const showCustom = sel.value === '__custom__';
  if (customRow) customRow.style.display = showCustom ? 'flex' : 'none';
  if (customInput) customInput.style.display = showCustom ? '' : 'none';
  if (customProv) customProv.style.display = showCustom ? '' : 'none';

  if (showCustom && saved === '__custom__') {
    customInput.value = sessionStorage.getItem('inry_assistant_custom_key') || '';
    const savedProv = sessionStorage.getItem('inry_assistant_custom_provider');
    if (savedProv && customProv) customProv.value = savedProv;
  }

  if (keys.length === 0) {
    var panel = document.getElementById('assistant-add-key-panel');
    if (panel) panel.style.display = 'block';
  }

  sel.onchange = () => {
    const show = sel.value === '__custom__';
    if (customRow) customRow.style.display = show ? 'flex' : 'none';
    if (customInput) customInput.style.display = show ? '' : 'none';
    if (customProv) customProv.style.display = show ? '' : 'none';
    sessionStorage.setItem('inry_assistant_key_id', sel.value);
    if (!show) sessionStorage.removeItem('inry_assistant_custom_key');
    renderProviderPill();
  };
  if (customInput) {
    customInput.oninput = () => {
      sessionStorage.setItem('inry_assistant_custom_key', customInput.value);
      renderProviderPill();
    };
  }
  if (customProv) {
    customProv.onchange = () => {
      sessionStorage.setItem('inry_assistant_custom_provider', customProv.value);
      renderProviderPill();
    };
  }
  renderProviderPill();
}

function wireAddKeyPanel() {
  const toggleBtn = document.getElementById('assistant-add-key-btn');
  const panel = document.getElementById('assistant-add-key-panel');
  const provSel = document.getElementById('assistant-add-provider');
  const modelInput = document.getElementById('assistant-add-model');
  const endpointInput = document.getElementById('assistant-add-endpoint');
  const endpointRow = document.getElementById('assistant-add-endpoint-row');
  if (!toggleBtn || !panel) return;
  toggleBtn.onclick = () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };
  if (provSel && modelInput) {
    provSel.onchange = () => {
      const def = PROVIDERS[provSel.value];
      if (def && def.defaultModel) modelInput.value = def.defaultModel;
      if (endpointRow) {
        endpointRow.style.display = provSel.value === 'custom' ? '' : 'none';
      }
    };
  }
  document.getElementById('assistant-add-key-cancel').onclick = () => {
    panel.style.display = 'none';
  };
  document.getElementById('assistant-add-key-save').onclick = () => {
    const provider = document.getElementById('assistant-add-provider').value;
    const model = document.getElementById('assistant-add-model').value.trim();
    const apiKey = document.getElementById('assistant-add-apikey').value.trim();
    const endpoint = provider === 'custom' ? (endpointInput ? endpointInput.value.trim() : '') : '';
    if (!model || !apiKey) {
      showToast('Veuillez remplir le modèle et la clé API.');
      return;
    }
    if (provider === 'custom' && !endpoint) {
      showToast('Veuillez saisir l\'endpoint pour le fournisseur personnalisé.');
      return;
    }
    const keys = getStoredKeys();
    keys.push({
      id: 'key-' + Date.now(),
      provider,
      model,
      apiKey,
      endpoint: endpoint || undefined,
      active: keys.length === 0
    });
    saveStoredKeys(keys);
    document.getElementById('assistant-add-apikey').value = '';
    if (endpointInput) endpointInput.value = '';
    panel.style.display = 'none';
    populateKeySelect();
    const confirmEl = document.getElementById('assistant-add-key-confirm');
    confirmEl.classList.add('show');
    setTimeout(() => confirmEl.classList.remove('show'), 2000);
  };
}

function initAssistantPage() {
  loadConversations();
  loadSavedPrompts();
  const savedId = localStorage.getItem(CURR_CONV_KEY);
  if (savedId && conversations.find(c => c.id === savedId)) {
    switchConversation(savedId);
  } else if (conversations.length > 0) {
    switchConversation(conversations[conversations.length - 1].id);
  } else {
    newConversation();
  }
  populateKeySelect();
  renderProviderPill();
  renderChatHistory();
  renderConvList();
  renderPromptsList();
  wireAssistantEvents();
  wirePasswordToggle('assistant-custom-key');
  wirePasswordToggle('assistant-add-apikey');
  wireAddKeyPanel();
  wireToolbarEvents();
  createStopBtn();
}

function renderProviderPill() {
  const pillEl = document.getElementById('provider-pill');
  if (!pillEl) return;
  const active = getSelectedKey();
  if (active) {
    pillEl.classList.remove('off');
    const label = PROVIDERS[active.provider]?.label || active.provider || 'Clé personnelle';
    const modelInfo = active.model && active.provider !== 'custom' ? ' (' + active.model + ')' : '';
    const keySuffix = active.provider === 'custom' ? '' : '';
    pillEl.innerHTML = `<span class="dot"></span> ${t('assistant.providerLabel')}: ${escapeHTML(label)}${escapeHTML(modelInfo)}${escapeHTML(keySuffix)}`;
  } else {
    pillEl.classList.add('off');
    pillEl.innerHTML = `<span class="dot"></span> ${t('assistant.providerLabel')}: —`;
  }
}

function botMsgActions() {
  return `<button class="copy-btn" onclick="copyMsgContent(this)">${icon('copy')} <span>${t('assistant.copy')}</span></button>` +
         `<button class="regenerate-btn" onclick="regenerateLast()">${icon('refresh')} <span>${t('assistant.regenerate')}</span></button>`;
}

function renderRecentInEmpty() {
  var recent = getRecentDocs();
  var el = document.getElementById('chat-empty-recent');
  if (!el) return;
  if (!recent.length) { el.innerHTML = ''; return; }
  var items = recent.slice(0, 6).map(function(id) {
    var doc = (APP.db.documents || []).find(function(d) { return d.id === id; });
    if (!doc) return '';
    return '<li class="recent-item" data-doc-id="' + id + '">' + escapeHTML(localized(doc.title)) + '</li>';
  }).filter(Boolean);
  el.innerHTML = items.length ? '<h4 class="recent-heading">📖 Consultés récemment</h4><ul class="recent-list">' + items.join('') + '</ul>' : '';
  el.querySelectorAll('.recent-item').forEach(function(li) {
    li.addEventListener('click', function() { openDocModal(li.dataset.docId); });
  });
}

function renderChatHistory() {
  if (showFilteredChat) return;
  const scrollEl = document.getElementById('chat-scroll');
  const emptyEl = document.getElementById('chat-empty');
  if (!chatHistory.length) {
    scrollEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    renderRecentInEmpty();
    return;
  }
  emptyEl.classList.add('hidden');
  scrollEl.innerHTML = chatHistory.map(msg => {
    const extraClass = msg.fileName ? ' has-file' : '';
    const fileTag = msg.fileName ? `<div class="file-tag">${icon('paperclip')} ${escapeHTML(msg.fileName)}</div>` : '';
    var contentHtml;
    if (msg.role === 'bot' || msg.role === 'assistant') {
      try { contentHtml = renderMarkdown(msg.content); } catch(e) { console.error('[renderMarkdown]', e); contentHtml = escapeHTML(msg.content); }
    } else {
      contentHtml = escapeHTML(msg.content);
    }
    var imgHtml = msg.imgUrl ? `<img src="${escapeAttr(msg.imgUrl)}" alt="Généré" style="max-width:100%;border-radius:var(--radius-md);margin-top:var(--space-1);">` : '';
    var actionsHtml = (msg.role === 'bot' || msg.role === 'assistant') ? botMsgActions() : '';
    return `<div dir="${msgDir(msg.content)}" style="${msgStyle(msg.content)}" class="chat-msg ${msg.role === 'user' ? 'user' : 'bot'}${extraClass}">${fileTag}${contentHtml}${imgHtml}${actionsHtml}</div>`;
  }).join('');
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

function escapeHTML(str) {
  var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(str).replace(/[&<>"']/g, function(c) { return m[c]; });
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMarkdown(text) {
  if (typeof text !== 'string') return '';
  var div = document.createElement('div');
  div.textContent = text;
  var html = div.innerHTML;

  var codeBlocks = [];
  html = html.replace(/<\/?br>/g, '\n');
  html = html.replace(/```([\s\S]*?)```/g, function(m, code) {
    codeBlocks.push('<pre><code>' + code.trim() + '</code></pre>');
    return '%%CODEBLOCK' + (codeBlocks.length - 1) + '%%';
  });

  var inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, function(m, code) {
    inlineCodes.push('<code>' + code + '</code>');
    return '%%INLINECODE' + (inlineCodes.length - 1) + '%%';
  });

  function mathHTML(math, displayMode) {
    if (typeof katex !== 'undefined') {
      try { return katex.renderToString(math, { displayMode: displayMode, throwOnError: false }); } catch(e) {}
    }
    return '<span class="math-fallback">' + math.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>';
  }

  var displayMath = [];
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, function(m, math) {
    displayMath.push('<div class="math-block">' + mathHTML(math.trim(), true) + '</div>');
    return '%%DISPLAYMATH' + (displayMath.length - 1) + '%%';
  });
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, function(m, math) {
    displayMath.push('<div class="math-block">' + mathHTML(math.trim(), true) + '</div>');
    return '%%DISPLAYMATH' + (displayMath.length - 1) + '%%';
  });

  var inlineMath = [];
  html = html.replace(/\$([^$\n]+?)\$/g, function(m, math) {
    inlineMath.push(mathHTML(math.trim(), false));
    return '%%INLINEMATH' + (inlineMath.length - 1) + '%%';
  });
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, function(m, math) {
    inlineMath.push(mathHTML(math.trim(), false));
    return '%%INLINEMATH' + (inlineMath.length - 1) + '%%';
  });

  var lines = html.split('\n');
  var result = [];
  var inList = false;
  var listType = null;
  var tableRows = [];

  function flushTable() {
    if (tableRows.length < 2) { tableRows = []; return; }
    result.push('<table>');
    var sepLine = tableRows[1].replace(/\s/g,'');
    if (/^\|[-:|]+\|?$/.test(sepLine)) {
      result.push('<thead><tr>');
      tableRows[0].split('|').filter(function(c){ return c.trim() !== ''; }).forEach(function(c){
        result.push('<th>' + applyInline(c.trim()) + '</th>');
      });
      result.push('</tr></thead><tbody>');
      for (var ti = 2; ti < tableRows.length; ti++) {
        result.push('<tr>');
        tableRows[ti].split('|').filter(function(c){ return c.trim() !== ''; }).forEach(function(c){
          result.push('<td>' + applyInline(c.trim()) + '</td>');
        });
        result.push('</tr>');
      }
      result.push('</tbody></table>');
    }
    tableRows = [];
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^\|.+\|$/.test(line.trim())) {
      tableRows.push(line);
      continue;
    } else if (tableRows.length) {
      flushTable();
    }
    if (/^---+\s*$/.test(line)) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push('<hr>');
      continue;
    }
    var hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push('<h' + hMatch[1].length + '>' + applyInline(hMatch[2]) + '</h' + hMatch[1].length + '>');
      continue;
    }
    var bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push('<blockquote>' + applyInline(bqMatch[1]) + '</blockquote>');
      continue;
    }
    var ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push('</ol>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push('<li>' + applyInline(ulMatch[1]) + '</li>');
      continue;
    }
    var olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push('</ul>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push('<li>' + applyInline(olMatch[1]) + '</li>');
      continue;
    }
    if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
    if (line.trim()) {
      result.push('<p>' + applyInline(line.trim()) + '</p>');
    } else {
      result.push('<br>');
    }
  }

  if (tableRows.length) flushTable();
  if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');

  html = result.join('\n');

  html = html.replace(/%%CODEBLOCK(\d+)%%/g, function(m, idx) { return codeBlocks[parseInt(idx)] || ''; });
  html = html.replace(/%%INLINECODE(\d+)%%/g, function(m, idx) { return inlineCodes[parseInt(idx)] || ''; });
  html = html.replace(/%%DISPLAYMATH(\d+)%%/g, function(m, idx) { return displayMath[parseInt(idx)] || ''; });
  html = html.replace(/%%INLINEMATH(\d+)%%/g, function(m, idx) { return inlineMath[parseInt(idx)] || ''; });

  return html;

  function applyInline(t) {
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return t;
  }
}

/* ---- Stop generation ---- */
function stopGeneration() {
  if (generationAbort) {
    generationAbort.abort();
    generationAbort = null;
  }
  isGenerating = false;
  var stopBtn = document.getElementById('stop-generation-btn');
  if (stopBtn) stopBtn.style.display = 'none';
  var streamingEl = document.getElementById('streaming-msg');
  if (streamingEl && !streamingEl.dataset.complete) {
    var partialText = streamingEl.dataset.partialText || '';
    if (partialText) {
      var d3 = msgDir(partialText); streamingEl.dir = d3; streamingEl.style.textAlign = d3 === 'rtl' ? 'right' : 'left'; streamingEl.style.direction = d3; streamingEl.style.unicodeBidi = 'isolate';
      streamingEl.innerHTML = renderMarkdown(partialText) + botMsgActions();
      streamingEl.id = '';
      chatHistory.push({ role: 'assistant', content: partialText, timestamp: Date.now() });
      saveCurrentConversation();
    } else {
      streamingEl.remove();
    }
  }
}

function createStopBtn() {
  var existing = document.getElementById('stop-generation-btn');
  if (existing) return existing;
  var btn = document.createElement('button');
  btn.id = 'stop-generation-btn';
  btn.className = 'btn btn-danger btn-sm';
  btn.innerHTML = icon('stop') + ' ' + (t('assistant.stop') || 'Stop');
  btn.style.display = 'none';
  btn.onclick = stopGeneration;
  var tools = document.querySelector('.chat-input-tools');
  if (tools) tools.insertBefore(btn, tools.firstChild);
  return btn;
}

/* ---- Regenerate last ---- */
function regenerateLast() {
  if (isGenerating) return;
  var lastUserIdx = -1;
  for (var ri = chatHistory.length - 1; ri >= 0; ri--) {
    if (chatHistory[ri].role === 'user') { lastUserIdx = ri; break; }
  }
  if (lastUserIdx < 0) return;
  var lastUserMsg = chatHistory[lastUserIdx];
  chatHistory = chatHistory.slice(0, lastUserIdx + 1);
  renderChatHistory();
  sendMessage(lastUserMsg.content, lastUserMsg.fileName ? lastUserMsg : null);
}

/* ---- Suggested questions ---- */
function generateSuggestions(userText, reply) {
  var suggestionsEl = document.getElementById('suggestion-chips');
  if (!suggestionsEl) return;
  var key = getSelectedKey();
  if (!key) return;
  var prompt = 'Basé sur cette conversation, génère 3 questions courtes (1 ligne chacune, séparées par "||") que l\'utilisateur pourrait poser.\n\nMessage: ' + userText.slice(0, 200) + '\nRéponse: ' + reply.slice(0, 300);
  callProvider(key, [{ role: 'user', content: prompt }]).then(function(sugReply) {
    var questions = sugReply.split('||').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 5; }).slice(0, 3);
    if (!questions.length) return;
    suggestionsEl.innerHTML = questions.map(function(q) {
      return '<button type="button" class="chip" data-prompt="' + q.replace(/"/g,'&quot;') + '">' + q.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }) + '</button>';
    }).join('');
    suggestionsEl.style.display = 'flex';
    suggestionsEl.querySelectorAll('.chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var ta = document.getElementById('chat-textarea');
        if (ta) {
          ta.value = chip.dataset.prompt || chip.textContent;
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
          ta.focus();
        }
      });
    });
  }).catch(function() {}); // non-critical
}

function wireAssistantEvents() {
  const form = document.getElementById('chat-form');
  const textarea = document.getElementById('chat-textarea');
  const clearBtn = document.getElementById('chat-clear-btn');
  const fileInput = document.getElementById('chat-file-input');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isGenerating) return;
    const text = textarea.value.trim();
    if (!text && !attachedFile) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    await sendMessage(text, attachedFile);
    attachedFile = null;
    document.getElementById('chat-attachments').innerHTML = '';
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  });

  clearBtn.addEventListener('click', () => {
    if (isGenerating) { stopGeneration(); }
    chatHistory = [];
    attachedFile = null;
    document.getElementById('chat-attachments').innerHTML = '';
    renderChatHistory();
    saveCurrentConversation();
  });

  const imgBtn = document.getElementById('chat-img-btn');
  if (imgBtn) {
    imgBtn.addEventListener('click', () => {
      if (isGenerating) return;
      var txt = document.getElementById('chat-textarea').value.trim();
      if (txt) { document.getElementById('chat-textarea').value = ''; doImg(txt); return; }
      var scrollEl = document.getElementById('chat-scroll');
      if (!scrollEl) { var p = window.prompt('Décris l\'image à créer…'); if (p) doImg(p.trim()); return; }
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:var(--space-1);padding:var(--space-2)0;background:var(--cream-card);border-radius:var(--radius-md);padding:var(--space-2)var(--space-3);margin-bottom:var(--space-1);';
      row.innerHTML = '<input type="text" id="pg-img-inp" placeholder="Décris l\'image à créer…" style="flex:1;padding:var(--space-2)var(--space-3);border:2px solid var(--kraft);border-radius:var(--radius-md);font-size:var(--fs-xs);background:var(--surface);color:var(--ink);">' +
        '<button class="btn btn-primary btn-sm" id="pg-img-go">OK</button>' +
        '<button class="btn btn-ghost btn-sm" id="pg-img-cancel">Annuler</button>';
      scrollEl.appendChild(row);
      scrollEl.scrollTop = scrollEl.scrollHeight;
      document.getElementById('pg-img-inp').focus();
      document.getElementById('pg-img-go').onclick = function() { var v = document.getElementById('pg-img-inp').value.trim(); row.remove(); if (v) doImg(v); };
      document.getElementById('pg-img-cancel').onclick = function() { row.remove(); };
      document.getElementById('pg-img-inp').onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('pg-img-go').click(); };
    });
  }

  async function doImg(prompt) {
    chatHistory.push({ role: 'user', content: '🎨 Générer une image: ' + prompt, timestamp: Date.now() });
    renderChatHistory();
    var active = getSelectedKey();
    if (!active) {
      chatHistory.push({ role: 'assistant', content: '⚠️ Aucune clé API configurée.' });
      renderChatHistory(); return;
    }
    document.getElementById('chat-empty').classList.add('hidden');
    chatHistory.push({ role: 'assistant', content: '⏳ Génération…' });
    renderChatHistory();
    var scrollEl = document.getElementById('chat-scroll');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    try {
      var imgUrl = await generateImage(prompt, active);
      chatHistory.pop();
      chatHistory.push({ role: 'assistant', content: '', imgUrl: imgUrl, timestamp: Date.now() });
    } catch (err) {
      chatHistory.pop();
      chatHistory.push({ role: 'assistant', content: '⚠️ ' + err.message });
    }
    renderChatHistory();
    saveCurrentConversation();
  }

  var canvasBtn = document.getElementById('chat-canvas-btn');
  if (canvasBtn) {
    canvasBtn.addEventListener('click', function() {
      if (isGenerating) return;
      try {
        openWhiteboard(function(data, isImage) {
          if (!data) return;
          chatHistory.push({ role: 'user', content: '🎨 Canvas: ' + (document.getElementById('wb-prompt')?.value?.trim() || 'Création'), timestamp: Date.now() });
          if (isImage) {
            chatHistory.push({ role: 'assistant', content: '', imgUrl: data, timestamp: Date.now() });
          } else {
            chatHistory.push({ role: 'assistant', content: data, timestamp: Date.now() });
          }
          renderChatHistory();
          var scrollEl = document.getElementById('chat-scroll');
          if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          saveCurrentConversation();
        });
      } catch(e) {
        console.error('[Canvas]', e);
        showToast('Erreur Canvas: ' + e.message);
      }
    });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    attachedFile = file;
    const attachEl = document.getElementById('chat-attachments');
    attachEl.innerHTML = `<span class="file-tag">${icon('paperclip')} ${escapeHTML(file.name)} <button type="button" class="file-remove" id="file-remove-btn">${icon('close')}</button></span>`;
    document.getElementById('file-remove-btn').onclick = () => {
      attachedFile = null;
      fileInput.value = '';
      attachEl.innerHTML = '';
    };
    fileInput.value = '';
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = chip.dataset.prompt || chip.textContent;
      sendMessage(textarea.value, attachedFile);
      textarea.value = '';
      attachedFile = null;
      document.getElementById('chat-attachments').innerHTML = '';
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      var docModal = document.getElementById('doc-modal');
      if (docModal && docModal.classList.contains('open')) return;
      var searchInput = document.getElementById('chat-search-inp');
      if (searchInput) {
        if (searchInput.style.display === 'none') searchInput.style.display = '';
        searchInput.focus();
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      var conv = document.getElementById('conv-sidebar');
      if (conv && conv.style.display !== 'none') conv.style.display = 'none';
      var prompts = document.getElementById('saved-prompts-panel');
      if (prompts && prompts.style.display !== 'none') prompts.style.display = 'none';
    }
  });
}

function wireToolbarEvents() {
  const convToggle = document.getElementById('conv-toggle-btn');
  const convSidebar = document.getElementById('conv-sidebar');
  if (convToggle && convSidebar) {
    convToggle.onclick = () => { convSidebar.style.display = convSidebar.style.display === 'none' ? 'block' : 'none'; };
  }
  const newBtn = document.getElementById('conv-new-btn');
  if (newBtn) newBtn.onclick = () => { newConversation(); document.getElementById('conv-sidebar').style.display = 'none'; };

  const promptsBtn = document.getElementById('saved-prompts-btn');
  const promptsPanel = document.getElementById('saved-prompts-panel');
  if (promptsBtn && promptsPanel) {
    promptsBtn.onclick = () => { promptsPanel.style.display = promptsPanel.style.display === 'none' ? 'block' : 'none'; };
  }
  document.getElementById('close-prompts-btn').onclick = () => { promptsPanel.style.display = 'none'; };

  const exportBtn = document.getElementById('export-chat-btn');
  if (exportBtn) {
    exportBtn.onclick = (e) => {
      if (!chatHistory.length) { showToast('Rien à exporter.'); return; }
      showExportMenu(e.target || e.currentTarget, function(fmt) { exportChat(fmt); });
    };
  }

  const toggleSearch = document.getElementById('toggle-search-btn');
  const searchInp = document.getElementById('chat-search-inp');
  if (toggleSearch && searchInp) {
    toggleSearch.onclick = () => {
      searchInp.style.display = searchInp.style.display === 'none' ? '' : 'none';
      if (searchInp.style.display === 'none') { searchInp.value = ''; showFilteredChat = false; renderChatHistory(); }
      else searchInp.focus();
    };
    searchInp.oninput = () => {
      renderFilteredChat(searchInp.value.trim());
    };
  }

  const ta = document.getElementById('chat-textarea');
  if (ta && promptsPanel) {
    var oldBtn = document.getElementById('save-prompt-quick-btn');
    if (!oldBtn) {
      var btn = document.createElement('button');
      btn.id = 'save-prompt-quick-btn';
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = '💾';
      btn.title = 'Sauvegarder le prompt actuel';
      btn.style.marginInlineStart = 'auto';
      btn.onclick = function() {
        var txt = ta.value.trim();
        if (!txt) { showToast('Le champ est vide.'); return; }
        var title = prompt('Nom du prompt :', txt.slice(0, 40));
        if (title) { addSavedPrompt(title.trim(), txt); showToast('Prompt sauvegardé !'); }
      };
      document.querySelector('.chat-input-tools')?.appendChild(btn);
    }
  }
}

async function sendMessage(text, file) {
  if (isGenerating) return;
  const active = getSelectedKey();
  const scrollEl = document.getElementById('chat-scroll');
  const suggestionEl = document.getElementById('suggestion-chips');
  if (suggestionEl) { suggestionEl.innerHTML = ''; suggestionEl.style.display = 'none'; }

  let userContent = text;
  if (file) {
    const fileData = await readFileAsBase64(file);
    userContent = `[Fichier joint: ${file.name}]\n\n${text}`;
    chatHistory.push({ role: 'user', content: userContent, fileName: file.name, fileData, fileType: file.type, timestamp: Date.now() });
  } else {
    chatHistory.push({ role: 'user', content: userContent, timestamp: Date.now() });
  }
  renderChatHistory();

  if (!active) {
    chatHistory.push({ role: 'assistant', content: t('assistant.noProvider') });
    renderChatHistory();
    return;
  }

  document.getElementById('chat-empty').classList.add('hidden');

  var stopBtn = document.getElementById('stop-generation-btn');
  if (stopBtn) stopBtn.style.display = 'inline-flex';

  var msgEl = document.createElement('div');
  msgEl.className = 'chat-msg bot';
  msgEl.id = 'streaming-msg';
  scrollEl.appendChild(msgEl);
  scrollEl.scrollTop = scrollEl.scrollHeight;

  generationAbort = new AbortController();
  isGenerating = true;

  try {
    var reply = await callProvider(active, chatHistory, null, generationAbort.signal);
    isGenerating = false;
    if (stopBtn) stopBtn.style.display = 'none';

    var words = reply.split(/\s+/);
    if (words.length <= 2) {
      msgEl.innerHTML = renderMarkdown(reply) + botMsgActions();
      var d = msgDir(reply); msgEl.dir = d; msgEl.style.textAlign = d === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d; msgEl.style.unicodeBidi = 'isolate';
      msgEl.id = '';
      chatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      saveCurrentConversation();
      generateSuggestions(text, reply);
      return;
    }

    var wordIdx = 1;
    var speed = Math.max(10, Math.min(50, 2000 / words.length));
    var partialText = '';

    function revealWord() {
      if (!document.getElementById('streaming-msg')) return;
      partialText = words.slice(0, wordIdx).join(' ');
      var d3 = msgDir(partialText); msgEl.dir = d3; msgEl.style.textAlign = d3 === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d3; msgEl.style.unicodeBidi = 'isolate';
      msgEl.innerHTML = renderMarkdown(partialText);
      msgEl.dataset.partialText = partialText;
      scrollEl.scrollTop = scrollEl.scrollHeight;
      wordIdx++;
      if (wordIdx <= words.length) {
        setTimeout(revealWord, speed);
      } else {
        msgEl.innerHTML = renderMarkdown(reply) + botMsgActions();
        var d2 = msgDir(reply); msgEl.dir = d2; msgEl.style.textAlign = d2 === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d2; msgEl.style.unicodeBidi = 'isolate';
        msgEl.id = '';
        delete msgEl.dataset.partialText;
        msgEl.dataset.complete = '1';
        chatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
        saveCurrentConversation();
        generateSuggestions(text, reply);
      }
    }
    revealWord();
  } catch (err) {
    isGenerating = false;
    if (stopBtn) stopBtn.style.display = 'none';

    if (err.name === 'AbortError') {
      // already handled by stopGeneration()
      return;
    }
    console.error(err);
    document.getElementById('streaming-msg')?.remove();
    let msg = t('assistant.error') + ' (' + err.message + ')';
    if (/401/.test(err.message)) {
      msg += '\n\n' + t('assistant.hint401');
    } else if (/404/.test(err.message)) {
      msg += '\n\n' + t('assistant.hint404');
    } else if (/429/.test(err.message)) {
      msg += '\n\n' + t('assistant.hint429');
    } else if (/image/i.test(err.message) && /not support/i.test(err.message)) {
      msg += '\n\n💡 Ce modèle ne supporte pas les images. Essaie sans fichier joint, ou change de modèle (ex: GPT-4o, Claude Sonnet, Gemini).';
    }
    chatHistory.push({ role: 'assistant', content: msg });
    renderChatHistory();
    saveCurrentConversation();
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---- Shared Canvas ---- */
function openWhiteboard(onResult) {
  var existing = document.getElementById('wb-overlay');
  if (existing) { existing.remove(); return; }
  var overlay = document.createElement('div');
  overlay.id = 'wb-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-4);max-width:600px;width:90%;';
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">' +
      '<strong style="font-size:var(--fs-md);">Canvas — Création par IA</strong>' +
      '<button class="btn btn-ghost btn-sm" id="wb-close">' + icon('close') + '</button>' +
    '</div>' +
    '<p style="font-size:var(--fs-sm);color:var(--ink-soft);margin-bottom:var(--space-3);">Décris ce que tu veux créer (image, exercice, résumé, tableau, schéma…). L\'IA générera le contenu.</p>' +
    '<textarea id="wb-prompt" rows="4" style="width:100%;padding:var(--space-3);border:2px solid var(--kraft);border-radius:var(--radius-md);background:var(--surface);color:var(--ink);font-family:inherit;font-size:var(--fs-sm);resize:vertical;box-sizing:border-box;" placeholder="Ex: Génère un tableau récapitulatif des verbes du 1er groupe au présent"></textarea>' +
    '<div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);align-items:center;flex-wrap:wrap;">' +
      '<button class="btn btn-primary btn-sm" id="wb-generate">' + icon('send') + ' Générer</button>' +
      '<select id="wb-type" style="padding:var(--space-2)var(--space-3);border:2px solid var(--kraft);border-radius:var(--radius-md);font-size:var(--fs-xs);background:var(--surface);color:var(--ink);">' +
        '<option value="auto">Auto (laisser l\'IA décider)</option>' +
        '<option value="image">Image</option>' +
        '<option value="text">Texte / Exercice</option>' +
        '<option value="table">Tableau</option>' +
        '<option value="code">Code / Formule</option>' +
      '</select>' +
    '</div>' +
    '<div id="wb-result" style="margin-top:var(--space-3);padding:var(--space-3);background:var(--cream-card);border:var(--border-w)solid var(--kraft-line);border-radius:var(--radius-md);font-size:var(--fs-sm);line-height:1.55;max-height:400px;overflow-y:auto;display:none;white-space:pre-wrap;"></div>' +
    '<div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap;">' +
      '<button class="btn btn-primary btn-sm" id="wb-send" style="display:none;">Ajouter au chat</button>' +
      '<button class="btn btn-secondary btn-sm" id="wb-retry" style="display:none;">Régénérer</button>' +
    '</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  var lastResult = null;
  var resultIsImage = false;

  document.getElementById('wb-close').onclick = function() { overlay.remove(); };
  async function doGenerate() {
    var prompt = document.getElementById('wb-prompt').value.trim();
    if (!prompt) return;
    var type = document.getElementById('wb-type').value;
    var resultDiv = document.getElementById('wb-result');
    var sendBtn = document.getElementById('wb-send');
    var retryBtn = document.getElementById('wb-retry');
    resultDiv.style.display = 'block';
    resultDiv.textContent = '⏳ Génération en cours…';
    sendBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    lastResult = null;
    resultIsImage = false;

    var key = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
    if (!key) {
      resultDiv.textContent = '⚠️ Aucune clé API configurée.';
      return;
    }

    try {
      var provName = key.label || key.provider || '?';
      var systemMsg = 'Tu es un assistant de création de contenu pédagogique algérien. ' +
        'Génère le contenu demandé de manière claire, structurée et adaptée au programme algérien.';
      if (type === 'image') {
        var imgUrl = await generateImage(prompt, key);
        lastResult = imgUrl;
        resultIsImage = true;
        resultDiv.innerHTML = '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(prompt) + '" style="max-width:100%;border-radius:var(--radius-md);">';
        sendBtn.style.display = 'inline-flex';
        retryBtn.style.display = 'inline-flex';
        return;
      }
      var fullPrompt = 'Type demandé: ' + type + '\n\nConsigne: ' + prompt;
      var reply = await callProvider(key, [{ role: 'user', content: fullPrompt }], systemMsg);
      lastResult = reply;
      resultIsImage = false;
      resultDiv.textContent = reply;
      sendBtn.style.display = 'inline-flex';
      retryBtn.style.display = 'inline-flex';
    } catch (err) {
      resultDiv.textContent = '⚠️ ' + err.message;
      retryBtn.style.display = 'inline-flex';
    }
  };

  document.getElementById('wb-generate').onclick = doGenerate;
  document.getElementById('wb-retry').onclick = doGenerate;

  document.getElementById('wb-send').onclick = function() {
    if (lastResult) {
      if (onResult) onResult(lastResult, resultIsImage);
    }
    overlay.remove();
  };

  document.getElementById('wb-prompt').onkeydown = function(e) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.getElementById('wb-generate').click();
    }
  };
}

/* ---- Shared Image Generation ---- */
async function generateImage(prompt, keyConfig) {
  if (!keyConfig) throw new Error('Aucune clé API configurée.');
  var apiKey = (typeof sanitizeApiKey === 'function') ? sanitizeApiKey(keyConfig.apiKey) : keyConfig.apiKey.trim();
  var provLabel = keyConfig.label || keyConfig.provider || '?';

  if (keyConfig.provider === 'openai') {
    var res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'dall-e-3', prompt: prompt, n: 1, size: '1024x1024' })
    });
    if (!res.ok) {
      var errData;
      try { errData = await res.json(); } catch(e) {}
      throw new Error((errData && errData.error && errData.error.message) || 'HTTP ' + res.status);
    }
    var data = await res.json();
    return data.data && data.data[0] && data.data[0].url;

  } else if (keyConfig.provider === 'google') {
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt: prompt }], parameters: { sampleCount: 1 } })
    });
    if (!res.ok) {
      var errData;
      try { errData = await res.json(); } catch(e) {}
      throw new Error((errData && errData.error && errData.error.message) || 'HTTP ' + res.status);
    }
    var data = await res.json();
    if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
      return 'data:image/png;base64,' + data.predictions[0].bytesBase64Encoded;
    }
    throw new Error('Format de réponse Imagen inattendu.');

  } else {
    throw new Error('La génération d\'images nécessite une clé OpenAI (DALL·E) ou Google (Imagen). Clé actuelle: ' + provLabel);
  }
}

async function extractApiError(res) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || data?.error?.type || JSON.stringify(data).slice(0, 200);
  } catch {
    try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
  }
  return `HTTP ${res.status}${detail ? ' — ' + detail : ''}`;
}

async function callProvider(keyConfig, history, systemOverride, signal) {
  const systemPrompt = systemOverride || getSystemPrompt();
  const apiKey = (typeof sanitizeApiKey === 'function')
    ? sanitizeApiKey(keyConfig.apiKey || '')
    : (keyConfig.apiKey || '').trim();

  if (keyConfig.provider === 'anthropic') {
    const messages = history.map(m => {
      if (m.fileData && m.fileType?.startsWith('image/')) {
        return {
          role: m.role,
          content: [
            { type: 'image', source: { type: 'base64', media_type: m.fileType, data: m.fileData.split(',')[1] } },
            { type: 'text', text: m.content }
          ]
        };
      }
      return { role: m.role, content: m.content };
    });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      signal: signal,
      body: JSON.stringify({
        model: keyConfig.model,
        max_tokens: 1500,
        system: systemPrompt,
        messages
      })
    });
    if (!res.ok) throw new Error(await extractApiError(res));
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '…';
  }

  if (keyConfig.provider === 'openai') {
    const messages = [{ role: 'system', content: systemPrompt }];
    history.forEach(m => {
      if (m.fileData && m.fileType?.startsWith('image/')) {
        messages.push({
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.fileData } }
          ]
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      signal: signal,
      body: JSON.stringify({
        model: keyConfig.model,
        messages,
        max_tokens: 1500
      })
    });
    if (!res.ok) throw new Error(await extractApiError(res));
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '…';
  }

  if (keyConfig.provider === 'google') {
    const contents = history.map(m => {
      const parts = [{ text: m.content }];
      if (m.fileData && m.fileType?.startsWith('image/')) {
        parts.unshift({ inlineData: { mimeType: m.fileType, data: m.fileData.split(',')[1] } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${keyConfig.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents
      })
    });
    if (!res.ok) throw new Error(await extractApiError(res));
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '…';
  }

  if (keyConfig.provider === 'custom') {
    const endpoint = keyConfig.endpoint || '';
    if (!endpoint) throw new Error('Endpoint manquant pour le fournisseur personnalisé');
    const messages = [{ role: 'system', content: systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content }))];
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      signal: signal,
      body: JSON.stringify({
        model: keyConfig.model,
        messages,
        max_tokens: 1500
      })
    });
    if (!res.ok) throw new Error(await extractApiError(res));
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '…';
  }

  throw new Error('Unknown provider');
}

/* ---- Copy to clipboard ---- */
function copyMsgContent(btn) {
  var msgEl = btn.closest('.chat-msg');
  if (!msgEl) return;
  var clone = msgEl.cloneNode(true);
  clone.querySelectorAll('.copy-btn, .regenerate-btn, .file-tag').forEach(function(el) { el.remove(); });
  var text = clone.textContent.trim();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      var span = btn.querySelector('span');
      if (span) span.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(function() {
        if (span) span.textContent = t('assistant.copy') || 'Copier';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function() { fallbackCopy(text, btn); });
  } else {
    fallbackCopy(text, btn);
  }
}
function fallbackCopy(text, btn) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  var span = btn.querySelector('span');
  if (span) span.textContent = '✓';
  btn.classList.add('copied');
  setTimeout(function() {
    if (span) span.textContent = t('assistant.copy') || 'Copier';
    btn.classList.remove('copied');
  }, 2000);
}
