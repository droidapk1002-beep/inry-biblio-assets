/* ============================================================
   LAYOUT — header, footer, mobile drawer, modal (shared across pages)
   ============================================================ */

var INRY_ROUTES = (typeof window !== 'undefined' && window.INRY_ROUTES) || {
  home: '#home', library: '#library', assistant: '#assistant', admin: '#admin'
};

function renderHeader(activePage) {
  var navItems = [
    { key: 'home', href: INRY_ROUTES.home },
    { key: 'library', href: INRY_ROUTES.library },
    { key: 'assistant', href: INRY_ROUTES.assistant }
  ];
  var navHTML = navItems.map(function(item) {
    return '<a class="nav-link ' + (activePage === item.key ? 'active' : '') + '" href="' + item.href + '">' + t('nav.' + item.key) + '</a>';
  }).join('');

  return '' +
    '<header class="site-header">' +
      '<div class="container header-inner">' +
        '<a href="' + INRY_ROUTES.home + '" class="brand">' +
          '<svg class="brand-seal" viewBox="0 0 100 100" fill="none">' +
            '<circle cx="50" cy="50" r="46" stroke="var(--green)" stroke-width="3" stroke-dasharray="5 4"/>' +
            '<circle cx="50" cy="50" r="36" stroke="var(--gold)" stroke-width="2"/>' +
            '<text x="50" y="47" font-size="13" text-anchor="middle" fill="var(--green)" font-family="Fraunces, serif" font-weight="700">IN</text>' +
            '<text x="50" y="62" font-size="9" text-anchor="middle" fill="var(--ink)" font-family="Fraunces, serif">RY</text>' +
          '</svg>' +
          '<div class="brand-text">' +
            '<span class="brand-name">' + t('siteName') + '</span>' +
            '<span class="brand-tagline ltr-only">' + t('tagline') + '</span>' +
          '</div>' +
        '</a>' +
        '<nav class="main-nav" aria-label="Navigation principale">' + navHTML + '</nav>' +
        '<div class="header-controls">' +
          '<div class="lang-switch" role="group" aria-label="Langue">' +
            '<button class="lang-btn ' + (APP.lang === 'fr' ? 'active' : '') + '" data-lang="fr">FR</button>' +
            '<button class="lang-btn ' + (APP.lang === 'ar' ? 'active' : '') + '" data-lang="ar">ع</button>' +
            '<button class="lang-btn ' + (APP.lang === 'en' ? 'active' : '') + '" data-lang="en">EN</button>' +
          '</div>' +
          '<button class="icon-btn" id="theme-toggle" aria-label="Theme">' + icon(APP.theme === 'light' ? 'moon' : 'sun') + '</button>' +
          '<button class="icon-btn mobile-nav-toggle" id="mobile-nav-open" aria-label="Menu">' + icon('menu') + '</button>' +
        '</div>' +
      '</div>' +
    '</header>' +
    '<div class="mobile-drawer" id="mobile-drawer">' +
      '<div class="mobile-drawer-backdrop" id="mobile-drawer-backdrop"></div>' +
      '<div class="mobile-drawer-panel">' +
        '<button class="icon-btn" id="mobile-nav-close" style="align-self:flex-end;" aria-label="Close">' + icon('close') + '</button>' +
        navItems.map(function(item) {
          return '<a class="nav-link ' + (activePage === item.key ? 'active' : '') + '" href="' + item.href + '">' + t('nav.' + item.key) + '</a>';
        }).join('') +
      '</div>' +
    '</div>';
}

function renderFooter() {
  return '' +
    '<footer class="site-footer">' +
      '<div class="container footer-inner">' +
        '<p class="footer-about">' + t('footer.about') + '</p>' +
        '<div class="footer-meta">' +
          '<div>&copy; ' + new Date().getFullYear() + ' ' + t('siteName') + ' &mdash; ' + t('footer.rights') + '</div>' +
          '<div>&#x1F1E9;&#x1F1FF; ' + t('footer.madeWith') + '</div>' +
        '</div>' +
      '</div>' +
    '</footer>';
}

function renderDocModal() {
  return '' +
    '<div class="modal-overlay" id="doc-modal">' +
      '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head">' +
          '<h3 id="modal-title"></h3>' +
          '<button class="modal-close" id="modal-close-btn" aria-label="' + t('modal.close') + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body" id="modal-body">' +
          '<div class="modal-preview" id="modal-preview"></div>' +
          '<div class="modal-resize-handle" id="modal-resize-handle"></div>' +
          '<div class="modal-info">' +
            '<div>' +
              '<div class="eyebrow">' + t('modal.description') + '</div>' +
              '<p id="modal-description"></p>' +
            '</div>' +
            '<dl class="modal-detail-grid" id="modal-details"></dl>' +
            '<div class="modal-actions">' +
              '<a class="btn btn-primary" id="modal-download-btn" target="_blank" rel="noopener">' +
                icon('download') + ' <span>' + t('card.download') + '</span>' +
              '</a>' +
              '<a class="btn btn-secondary" id="modal-external-btn" target="_blank" rel="noopener">' +
                icon('external') + ' <span>' + t('modal.openExternal') + '</span>' +
              '</a>' +
            '</div>' +
            '<div class="modal-ai-chat">' +
              '<div class="modal-ai-messages" id="modal-ai-messages"></div>' +
              '<div class="modal-ai-input-row">' +
                '<label class="btn-attach" id="modal-ai-attach-btn" title="' + t('assistant.attach') + '">' +
                  icon('paperclip') +
                  '<input type="file" id="modal-ai-file" accept="image/*,.pdf,.txt" style="display:none;">' +
                '</label>' +
                '<textarea id="modal-ai-input" rows="1" dir="auto" placeholder="' + t('assistant.askAI') + '"></textarea>' +
                '<button class="btn btn-primary btn-sm" id="modal-ai-send-btn">' + icon('send') + '</button>' +
              '</div>' +
              '<div class="modal-ai-tools">' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-img-btn">' + icon('image') + ' <span data-i18n="assistant.generateImage">Image</span></button>' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-canvas-btn">' + icon('feather') + ' <span data-i18n="assistant.canvas">Canvas</span></button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-apa" title="Citation APA">APA</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-mla" title="Citation MLA">MLA</button>' +
                '<input type="text" id="modal-ai-search-inp" placeholder="Rechercher..." style="display:none;flex:1;max-width:140px;padding:var(--space-1)var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-md);background:var(--surface);color:var(--ink);font-size:var(--fs-xs);">' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-export-btn" title="Exporter le chat">&darr;</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-save-prompt-btn" title="Sauvegarder le prompt">&#128190;</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-view-prompts-btn" title="Prompts sauvegardes">&#128203;</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-search-toggle" title="Rechercher dans le chat">&#128269;</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-key-btn" title="Cle API">&#128273;</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-fullscreen-btn" title="Plein ecran">&#8669;</button>' +
              '</div>' +
              '<div class="modal-ai-key-panel" id="modal-ai-key-panel" style="display:none;margin-top:var(--space-2);border:var(--border-w) solid var(--kraft-line);border-radius:var(--radius-md);background:var(--surface);max-height:260px;overflow-y:auto;">' +
                '<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-bottom:var(--border-w) solid var(--kraft-line);">' +
                  '<strong style="font-size:var(--fs-xs);flex:1;">Cles API</strong>' +
                  '<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--ink-soft);" id="modal-ai-close-key-btn">&#10005;</button>' +
                '</div>' +
                '<div id="modal-ai-key-list" style="padding:var(--space-2);"></div>' +
                '<div style="border-top:var(--border-w) solid var(--kraft-line);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column;gap:var(--space-1);">' +
                  '<input type="password" id="modal-ai-key-add-input" placeholder="Nouvelle cle API..." style="padding:var(--space-1) var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-sm);font-size:var(--fs-xs);">' +
                  '<div style="display:flex;gap:var(--space-1);">' +
                    '<select id="modal-ai-key-add-provider" style="flex:1;padding:var(--space-1) var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-sm);font-size:var(--fs-xs);background:var(--surface);color:var(--ink);"></select>' +
                    '<button class="btn btn-primary btn-sm" id="modal-ai-key-add-btn">+</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="modal-ai-suggestions" id="modal-ai-suggestions" style="display:none;margin-top:var(--space-2);"></div>' +
              '<div class="modal-ai-prompts-panel" id="modal-ai-prompts-panel" style="display:none;margin-top:var(--space-2);border:var(--border-w) solid var(--kraft-line);border-radius:var(--radius-md);background:var(--surface);max-height:200px;overflow-y:auto;">' +
                '<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-bottom:var(--border-w) solid var(--kraft-line);">' +
                  '<strong style="font-size:var(--fs-xs);flex:1;">Prompts sauvegardes</strong>' +
                  '<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--ink-soft);" id="modal-ai-close-prompts-btn">&#10005;</button>' +
                '</div>' +
                '<div id="modal-ai-prompts-list" style="padding:var(--space-2);"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function wireLayoutEvents() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      toggleTheme();
      themeToggle.innerHTML = icon(APP.theme === 'light' ? 'moon' : 'sun');
    });
  }

  const drawer = document.getElementById('mobile-drawer');
  const openBtn = document.getElementById('mobile-nav-open');
  const closeBtn = document.getElementById('mobile-nav-close');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  if (openBtn) openBtn.addEventListener('click', () => drawer.classList.add('open'));
  if (closeBtn) closeBtn.addEventListener('click', () => drawer.classList.remove('open'));
  if (backdrop) backdrop.addEventListener('click', () => drawer.classList.remove('open'));

  // Modal wiring
  const modal = document.getElementById('doc-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  if (modal && modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeDocModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDocModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeDocModal();
    });
  }

  // Modal / shortcut: focus modal search
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      var modal = document.getElementById('doc-modal');
      if (modal && modal.classList.contains('open')) {
        var inp = document.getElementById('modal-ai-search-inp');
        if (inp) {
          if (inp.style.display === 'none') inp.style.display = '';
          inp.focus();
          e.preventDefault();
        }
      }
    }
  });

  // Resizable split
  const handle = document.getElementById('modal-resize-handle');
  const preview = document.getElementById('modal-preview');
  if (handle && preview) {
    var isResizing = false;
    handle.addEventListener('mousedown', function(e) {
      isResizing = true;
      handle.classList.add('active');
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      var box = modal.querySelector('.modal-box');
      var rect = box.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(20, Math.min(80, pct));
      preview.style.flex = '0 0 ' + pct + '%';
    });
    document.addEventListener('mouseup', function() {
      if (isResizing) { isResizing = false; handle.classList.remove('active'); }
    });
  }

  // Hidden admin access: Ctrl+Alt+H
  document.addEventListener('keydown', (e) => {
    if (e.key === 'h' && e.ctrlKey && e.altKey) {
      e.preventDefault();
      window.location.hash = '#admin';
    }
  });
}

let lastFocusedEl = null;
let modalDocContext = null;
let modalAiAbort = null;

function openDocModal(docId) {
  const doc = APP.db.documents.find(d => d.id === docId);
  if (!doc) return;
  lastFocusedEl = document.activeElement;
  modalDocContext = doc;

  document.getElementById('modal-title').textContent = localized(doc.title);
  document.getElementById('modal-description').textContent = localized(doc.description);

  const preview = document.getElementById('modal-preview');
  const pUrl = doc.previewUrl || '';
  if (pUrl.includes('mega.nz')) {
    preview.innerHTML = `<div class="preview-fallback"><p>${t('modal.previewBlocked')}</p><p style="font-size:var(--fs-xs);color:var(--ink-soft);word-break:break-all;">${escapeHTML(pUrl)}</p></div>`;
  } else {
    let embedUrl = pUrl;
    if (embedUrl.includes('drive.google.com')) {
      embedUrl = embedUrl.replace('/view?usp=drivesdk', '/preview').replace('/view', '/preview');
      if (!embedUrl.includes('/preview')) {
        const driveIdMatch = embedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveIdMatch) embedUrl = 'https://drive.google.com/file/d/' + driveIdMatch[1] + '/preview';
      }
    }
    preview.innerHTML = `<iframe src="${escapeAttr(embedUrl)}" title="${escapeAttr(localized(doc.title))}" loading="lazy" allow="autoplay"></iframe>`;
  }

  const subjectName = APP.db.subjects.find(s => s.id === doc.subject);
  const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
  const levelObj = findLevelYear(doc.level);

  const details = document.getElementById('modal-details');
  details.innerHTML = `
    <div><dt>${t('modal.level')}</dt><dd>${escapeHTML(levelObj ? localized(levelObj.name) : '—')}</dd></div>
    <div><dt>${t('modal.subject')}</dt><dd>${escapeHTML(subjectName ? localized(subjectName.name) : '—')}</dd></div>
    <div><dt>${t('modal.type')}</dt><dd>${escapeHTML(typeName ? localized(typeName.name) : '—')}</dd></div>
    <div><dt>${t('modal.year')}</dt><dd class="ltr-only">${escapeHTML(doc.year || '—')}</dd></div>
    ${doc.wilaya ? `<div><dt>${t('modal.wilaya')}</dt><dd>${escapeHTML(doc.wilaya)}</dd></div>` : ''}
    <div><dt>${t('modal.size')}</dt><dd class="ltr-only">${escapeHTML(doc.size)}</dd></div>
    <div><dt>${t('modal.pages')}</dt><dd class="ltr-only">${escapeHTML(doc.pages)}</dd></div>
    <div><dt>${t('modal.host')}</dt><dd style="text-transform:capitalize">${escapeHTML(doc.host)}</dd></div>
  `;

  document.getElementById('modal-download-btn').href = doc.downloadUrl;
  document.getElementById('modal-external-btn').href = doc.previewUrl;

  // Wire inline AI chat
  const aiMessages = document.getElementById('modal-ai-messages');
  const aiInput = document.getElementById('modal-ai-input');
  const aiSend = document.getElementById('modal-ai-send-btn');
  const aiFileInput = document.getElementById('modal-ai-file');
  const aiImgBtn = document.getElementById('modal-ai-img-btn');
  const aiCanvasBtn = document.getElementById('modal-ai-canvas-btn');
  let aiAttachedFile = null;
  if (aiMessages && aiInput && aiSend) {
    aiInput.value = '';
    aiMessages.innerHTML = '';
    aiInput.disabled = false;
    aiSend.disabled = false;

    const addMsg = (role, content, fileName, isHtml) => {
      const extraClass = fileName ? ' has-file' : '';
      const fileTag = fileName ? `<div class="file-tag">${icon('paperclip')} ${fileName}</div>` : '';
      var safeContent;
      if (isHtml) {
        safeContent = content;
      } else if (role === 'bot' && typeof renderMarkdown === 'function') {
        try { safeContent = renderMarkdown(content); } catch(e) { console.error('[modal renderMarkdown]', e); safeContent = escapeHTML(content); }
      } else if (typeof escapeHTML === 'function') {
        safeContent = escapeHTML(content);
      } else {
        safeContent = content.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
      }
      var copyBtn = role === 'bot' ? `<button class="copy-btn" onclick="copyMsgContent(this)">${icon('copy')} <span>${t('assistant.copy')}</span></button>` : '';
      function hasArabic(t) { return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(t); }
      function msgDir(t) { return hasArabic(t) ? 'rtl' : 'ltr'; }
      var d3 = msgDir(content);
      var msgHtml = `<div dir="${d3}" style="text-align:${d3 === 'rtl' ? 'right' : 'left'};direction:${d3};unicode-bidi:isolate;" class="chat-msg ${role}${extraClass}">${fileTag}${safeContent}${copyBtn}</div>`;
      aiMessages.innerHTML += msgHtml;
      var lastMsg = aiMessages.lastElementChild;
      if (lastMsg) lastMsg.dataset.originalHtml = lastMsg.innerHTML;
      aiMessages.scrollTop = aiMessages.scrollHeight;
    };

    const doAsk = async () => {
      const text = aiInput.value.trim();
      if (!text && !aiAttachedFile) return;
      const userMsg = aiAttachedFile ? `[Fichier: ${aiAttachedFile.name}]\n\n${text}` : text;
      addMsg('user', userMsg, aiAttachedFile?.name);
      aiInput.value = '';
      aiInput.style.height = 'auto';
      aiAttachedFile = null;
      document.querySelector('.modal-ai-file-tag')?.remove();

      const key = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
      if (!key) {
        addMsg('bot', '⚠️ ' + (t('assistant.noProvider') || 'Aucune IA configurée.'));
        return;
      }

      aiInput.disabled = true;
      aiSend.disabled = true;

      const title = localized(modalDocContext?.title || '');
      const desc = localized(modalDocContext?.description || '');
      const contextMsg = 'Document: ' + title + (desc ? '\nDescription: ' + desc : '') + '\n\nQuestion: ' + userMsg;

      var msgEl = document.createElement('div');
      msgEl.className = 'chat-msg bot';
      msgEl.id = 'modal-streaming-msg';
      aiMessages.appendChild(msgEl);
      aiMessages.scrollTop = aiMessages.scrollHeight;

      var reply = '';
      try {
        reply = await callProvider(key, [{ role: 'user', content: contextMsg }]);

        var words = reply.split(/\s+/);
        if (words.length <= 2) {
          var d = msgDir(reply); msgEl.dir = d; msgEl.style.textAlign = d === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d; msgEl.style.unicodeBidi = 'isolate';
          msgEl.innerHTML = (typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply) + copyBtn();
          msgEl.id = '';
          msgEl.dataset.originalHtml = msgEl.innerHTML;
        } else {
          var wordIdx = 1;
          var speed = Math.max(10, Math.min(50, 2000 / words.length));
          function revealWord() {
            if (!document.getElementById('modal-streaming-msg')) return;
            var partialText = words.slice(0, wordIdx).join(' ');
            var d3 = msgDir(partialText); msgEl.dir = d3; msgEl.style.textAlign = d3 === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d3; msgEl.style.unicodeBidi = 'isolate';
            msgEl.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(partialText) : partialText;
            aiMessages.scrollTop = aiMessages.scrollHeight;
            wordIdx++;
            if (wordIdx <= words.length) {
              setTimeout(revealWord, speed);
            } else {
              var d4 = msgDir(reply); msgEl.dir = d4; msgEl.style.textAlign = d4 === 'rtl' ? 'right' : 'left'; msgEl.style.direction = d4; msgEl.style.unicodeBidi = 'isolate';
              msgEl.innerHTML = (typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply) + copyBtn();
              msgEl.id = '';
              msgEl.dataset.originalHtml = msgEl.innerHTML;
            }
          }
          revealWord();
        }

        // Auto-suggest follow-up questions
        const suggestionsEl = document.getElementById('modal-ai-suggestions');
        if (suggestionsEl) {
          try {
            const sugPrompt = 'Basé sur cette conversation, génère 3 questions courtes (1 ligne chacune, séparées par "||") que l\'utilisateur pourrait poser en lien avec le document.\n\nDocument: ' + title + '\nMessage: ' + userMsg + '\nRéponse: ' + reply.slice(0, 300);
            const sugReply = await callProvider(key, [{ role: 'user', content: sugPrompt }]);
            const questions = sugReply.split('||').map(s => s.trim()).filter(s => s.length > 5).slice(0, 3);
            if (questions.length) {
              suggestionsEl.style.display = 'flex';
              suggestionsEl.innerHTML = questions.map(q => `<button type="button" class="chip" data-prompt="${q.replace(/"/g,'&quot;')}">${q.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; })}</button>`).join('');
              suggestionsEl.querySelectorAll('.chip').forEach(chip => {
                chip.addEventListener('click', () => {
                  aiInput.value = chip.dataset.prompt || chip.textContent;
                  aiInput.style.height = 'auto';
                  aiInput.style.height = Math.min(aiInput.scrollHeight, 80) + 'px';
                  aiInput.dispatchEvent(new Event('input'));
                  doAsk();
                });
              });
            }
          } catch(e) { /* suggestions non critiques */ }
        }
      } catch (err) {
        document.getElementById('modal-streaming-msg')?.remove();
        var errorReply = '⚠️ ' + t('assistant.error') + ' (' + err.message + ')';
        if (err.message && /401/.test(err.message)) errorReply += '\n\n' + (t('assistant.hint401') || 'Vérifie ta clé API.');
        addMsg('bot', errorReply);
      }
      aiInput.disabled = false;
      aiSend.disabled = false;
      aiMessages.scrollTop = aiMessages.scrollHeight;
    };

    function copyBtn() {
      return '<button class="copy-btn" onclick="copyMsgContent(this)">' + icon('copy') + ' <span>' + t('assistant.copy') + '</span></button>';
    }

    aiSend.onclick = doAsk;
    aiInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doAsk(); }
    };
    aiInput.oninput = () => {
      aiInput.style.height = 'auto';
      aiInput.style.height = Math.min(aiInput.scrollHeight, 80) + 'px';
    };

    // File attachment
    if (aiFileInput) {
      aiFileInput.onchange = () => {
        const f = aiFileInput.files[0];
        if (!f) return;
        aiAttachedFile = f;
        document.querySelector('.modal-ai-file-tag')?.remove();
        const tag = document.createElement('span');
        tag.className = 'file-tag modal-ai-file-tag';
        tag.innerHTML = icon('paperclip') + ' ' + escapeHTML(f.name) + ' <button type="button" class="file-remove" id="modal-ai-file-remove">' + icon('close') + '</button>';
        aiFileInput.parentElement.after(tag);
        document.getElementById('modal-ai-file-remove').onclick = () => { aiAttachedFile = null; tag.remove(); };
        aiFileInput.value = '';
      };
    }

    // Image generation — uses shared generateImage()
    if (aiImgBtn) {
      aiImgBtn.onclick = function() {
        var txt = aiInput.value.trim();
        if (txt) { aiInput.value = ''; aiInput.style.height = 'auto'; doModalImg(txt); return; }
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:var(--space-1);padding:var(--space-2)0;';
        row.innerHTML = '<input type="text" id="md-img-inp" placeholder="Décris l\'image à créer…" style="flex:1;padding:var(--space-2)var(--space-3);border:2px solid var(--kraft);border-radius:var(--radius-md);font-size:var(--fs-xs);">' +
          '<button class="btn btn-primary btn-sm" id="md-img-go">OK</button>' +
          '<button class="btn btn-ghost btn-sm" id="md-img-cancel">Annuler</button>';
        aiMessages.appendChild(row);
        aiMessages.scrollTop = aiMessages.scrollHeight;
        document.getElementById('md-img-inp').focus();
        document.getElementById('md-img-go').onclick = function() { var v = document.getElementById('md-img-inp').value.trim(); row.remove(); if (v) doModalImg(v); };
        document.getElementById('md-img-cancel').onclick = function() { row.remove(); };
        document.getElementById('md-img-inp').onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('md-img-go').click(); };
      };
    }
    async function doModalImg(prompt) {
      addMsg('user', '🎨 Générer une image: ' + prompt);
      addMsg('bot', '⏳ Génération…');
      var key = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
      if (!key) {
        var msgs2 = aiMessages.querySelectorAll('.chat-msg.bot');
        if (msgs2.length) msgs2[msgs2.length - 1].textContent = '⚠️ Aucune clé API configurée.';
        return;
      }
      try {
        var imgUrl = await generateImage(prompt, key);
        var msgs2 = aiMessages.querySelectorAll('.chat-msg.bot');
        if (msgs2.length && imgUrl) { var e2 = msgs2[msgs2.length - 1]; e2.innerHTML = '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(prompt) + '" style="max-width:100%;border-radius:var(--radius-md);">'; e2.dataset.originalHtml = e2.innerHTML; }
        else if (msgs2.length) msgs2[msgs2.length - 1].textContent = '⚠️ Échec de génération.';
      } catch (err) {
        var msgs2 = aiMessages.querySelectorAll('.chat-msg.bot');
        if (msgs2.length) msgs2[msgs2.length - 1].textContent = '⚠️ ' + err.message;
      }
      aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    // Canvas — uses shared openWhiteboard() (prompt-based AI creation)
    if (aiCanvasBtn) {
      aiCanvasBtn.onclick = function() {
        try {
          openWhiteboard(function(data, isImage) {
            if (!data) return;
            var promptInput = document.getElementById('wb-prompt');
            addMsg('user', '🎨 Canvas: ' + (promptInput ? promptInput.value.trim() : 'Création'));
            if (isImage) {
              addMsg('bot', '<img src="' + data + '" alt="Canvas" style="max-width:100%;border-radius:var(--radius-md);">', null, true);
            } else {
              addMsg('bot', data);
            }
            aiMessages.scrollTop = aiMessages.scrollHeight;
          });
        } catch(e) {
          console.error('[Modal Canvas]', e);
          addMsg('bot', '⚠️ Erreur Canvas: ' + e.message);
        }
      };
    }

    // Citation generation (APA / MLA)
    async function doCite(format) {
      if (!modalDocContext) { addMsg('bot', '⚠️ Aucun document sélectionné.'); return; }
      const key = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
      if (!key) { addMsg('bot', '⚠️ Aucune IA configurée.'); return; }
      const title = localized(modalDocContext.title || '');
      const desc = localized(modalDocContext.description || '');
      const subject = APP.db.subjects.find(s => s.id === modalDocContext.subject);
      const subjectName = subject ? localized(subject.name) : '';
      const typeName = APP.db.documentTypes.find(ty => ty.id === modalDocContext.type);
      const typeLabel = typeName ? localized(typeName.name) : '';
      const levelObj = findLevelYear(modalDocContext.level);
      const levelName = levelObj ? localized(levelObj.name) : '';
      const meta = `Titre: ${title}\nDescription: ${desc}\nMatière: ${subjectName}\nType: ${typeLabel}\nNiveau: ${levelName}\nAnnée: ${modalDocContext.year || '—'}\nPages: ${modalDocContext.pages || '—'}`;
      const prompt = `Génère une citation en format ${format.toUpperCase()} pour le document suivant. Ne donne que la citation, sans commentaire.\n\n${meta}`;
      addMsg('user', `📖 Générer une citation (${format.toUpperCase()}) pour : ${title}`);
      addMsg('bot', '⏳ Génération…');
      aiInput.disabled = true;
      aiSend.disabled = true;
      try {
        const reply = await callProvider(key, [{ role: 'user', content: prompt }]);
        const msgs = aiMessages.querySelectorAll('.chat-msg.bot');
        if (msgs.length) { var el = msgs[msgs.length - 1]; el.innerHTML = (typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply) + `<button class="copy-btn" onclick="copyMsgContent(this)">${icon('copy')} <span>${t('assistant.copy')}</span></button>`; el.dataset.originalHtml = el.innerHTML; }
      } catch (err) {
        const msgs = aiMessages.querySelectorAll('.chat-msg.bot');
        if (msgs.length) msgs[msgs.length - 1].textContent = '⚠️ ' + err.message;
      }
      aiInput.disabled = false;
      aiSend.disabled = false;
      aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    const citeApa = document.getElementById('modal-ai-cite-apa');
    const citeMla = document.getElementById('modal-ai-cite-mla');
    if (citeApa) citeApa.onclick = () => doCite('apa');
    if (citeMla) citeMla.onclick = () => doCite('mla');

    // Fullscreen toggle
    const fsBtn = document.getElementById('modal-ai-fullscreen-btn');
    if (fsBtn) {
      fsBtn.onclick = () => {
        const modalBox = document.querySelector('.modal-box');
        modalBox.classList.toggle('chat-full');
        fsBtn.textContent = modalBox.classList.contains('chat-full') ? '✕' : '⇱';
        setTimeout(() => aiMessages.scrollTop = aiMessages.scrollHeight, 100);
      };
    }

    // Modal search
    const modalSearchInp = document.getElementById('modal-ai-search-inp');
    const modalSearchToggle = document.getElementById('modal-ai-search-toggle');
    if (modalSearchInp && modalSearchToggle) {
      modalSearchToggle.onclick = () => {
        modalSearchInp.style.display = modalSearchInp.style.display === 'none' ? '' : 'none';
        if (modalSearchInp.style.display === 'none') {
          modalSearchInp.value = '';
          aiMessages.querySelectorAll('.chat-msg').forEach(function(m) { m.style.display = ''; if (m.dataset.originalHtml) m.innerHTML = m.dataset.originalHtml; });
          modalSearchEmpty.style.display = 'none';
        }
        else modalSearchInp.focus();
      };
      var modalSearchEmpty = document.createElement('div');
      modalSearchEmpty.style.cssText = 'display:none;padding:var(--space-4);text-align:center;color:var(--ink-soft);font-size:var(--fs-sm);';
      modalSearchEmpty.className = 'modal-search-empty';
      aiMessages.after(modalSearchEmpty);

      modalSearchInp.oninput = function() {
        var q = this.value.trim();
        var lowerQ = q.toLowerCase();
        function escR(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
        var visible = 0;
        aiMessages.querySelectorAll('.chat-msg').forEach(function(m) {
          if (!q) {
            m.style.display = '';
            if (m.dataset.originalHtml) m.innerHTML = m.dataset.originalHtml;
            return;
          }
          var text = m.textContent.toLowerCase();
          if (!text.includes(lowerQ)) { m.style.display = 'none'; return; }
          visible++;
          m.style.display = '';
          if (m.dataset.originalHtml) m.innerHTML = m.dataset.originalHtml;
          m.innerHTML = m.innerHTML.replace(new RegExp(escR(q), 'gi'), function(match) {
            return '<mark style="background:var(--gold);color:var(--ink);padding:0 2px;border-radius:2px;">' + match.replace(/</g,'&lt;') + '</mark>';
          });
        });
        if (q && visible === 0) {
          modalSearchEmpty.textContent = 'Aucun message trouvé pour « ' + q + ' »';
          modalSearchEmpty.style.display = '';
        } else {
          modalSearchEmpty.style.display = 'none';
        }
      };
    }

    // Modal export
    var modalExportBtn = document.getElementById('modal-ai-export-btn');
    if (modalExportBtn) {
      modalExportBtn.onclick = function(e) {
        var msgs = [];
        aiMessages.querySelectorAll('.chat-msg').forEach(function(el) {
          var role = el.classList.contains('user') ? 'user' : 'assistant';
          var clone = el.cloneNode(true);
          var cb = clone.querySelector('.copy-btn');
          if (cb) cb.remove();
          var ft = clone.querySelector('.file-tag');
          if (ft) ft.remove();
          msgs.push({ role: role, content: clone.textContent.trim() });
        });
        if (!msgs.length) return;
        if (typeof showExportMenu === 'function') showExportMenu(e.target || e.currentTarget, function(fmt) { if (typeof exportChat === 'function') exportChat(fmt, msgs); });
      };
    }

    // Modal save prompt
    var modalSavePromptBtn = document.getElementById('modal-ai-save-prompt-btn');
    if (modalSavePromptBtn) {
      modalSavePromptBtn.onclick = function() {
        var txt = aiInput.value.trim();
        if (!txt) { if (typeof showToast === 'function') showToast('Le champ est vide.'); return; }
        var title = prompt('Nom du prompt :', txt.slice(0, 40));
        if (title) {
          if (typeof addSavedPrompt === 'function') addSavedPrompt(title.trim(), txt);
          if (typeof showToast === 'function') showToast('Prompt sauvegardé !');
        }
        if (modalPromptsPanel) { renderModalPrompts(); modalPromptsPanel.style.display = ''; }
      };
    }

    // Modal toggle prompts panel
    var modalViewPromptsBtn = document.getElementById('modal-ai-view-prompts-btn');
    if (modalViewPromptsBtn) {
      modalViewPromptsBtn.onclick = function() {
        if (!modalPromptsPanel || !modalPromptsList) return;
        if (modalPromptsPanel.style.display !== 'none') { modalPromptsPanel.style.display = 'none'; return; }
        renderModalPrompts();
        modalPromptsPanel.style.display = '';
      };
    }

    // Modal saved prompts panel
    var modalPromptsPanel = document.getElementById('modal-ai-prompts-panel');
    var modalPromptsList = document.getElementById('modal-ai-prompts-list');
    if (modalPromptsPanel && modalPromptsList) {
      function renderModalPrompts() {
        var saved = typeof savedPrompts !== 'undefined' ? savedPrompts : [];
        if (!saved.length) {
          modalPromptsList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucun prompt sauvegardé</div>';
          return;
        }
        modalPromptsList.innerHTML = saved.map(function(p) {
          return '<div class="modal-prompt-item" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);cursor:pointer;border-radius:var(--radius-sm);" data-text="' + escapeAttr(p.text) + '">' +
            '<span style="flex:1;font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHTML(p.title) + '</span>' +
            '<button class="modal-prompt-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">✕</button></div>';
        }).join('');
        modalPromptsList.querySelectorAll('.modal-prompt-item').forEach(function(el) {
          el.addEventListener('click', function(e) {
            if (e.target.closest('.modal-prompt-del')) return;
            aiInput.value = el.dataset.text;
            aiInput.focus();
            aiInput.style.height = 'auto';
            aiInput.style.height = Math.min(aiInput.scrollHeight, 80) + 'px';
            modalPromptsPanel.style.display = 'none';
          });
        });
        modalPromptsList.querySelectorAll('.modal-prompt-del').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var el = btn.closest('.modal-prompt-item');
            var found = (typeof savedPrompts !== 'undefined' ? savedPrompts : []).findIndex(function(p) { return p.text === el.dataset.text; });
            if (found >= 0 && typeof deleteSavedPrompt === 'function') deleteSavedPrompt((typeof savedPrompts !== 'undefined' ? savedPrompts : [])[found].id);
            setTimeout(renderModalPrompts, 50);
          });
        });
      }
      document.getElementById('modal-ai-close-prompts-btn').onclick = function() { modalPromptsPanel.style.display = 'none'; };
      if (typeof savedPrompts !== 'undefined' && savedPrompts.length) {
        renderModalPrompts();
        modalPromptsPanel.style.display = '';
      }
    }

    // Modal API key panel
    var modalKeyPanel = document.getElementById('modal-ai-key-panel');
    var modalKeyList = document.getElementById('modal-ai-key-list');
    var modalKeyAddInput = document.getElementById('modal-ai-key-add-input');
    var modalKeyAddProv = document.getElementById('modal-ai-key-add-provider');
    var modalKeyAddBtn = document.getElementById('modal-ai-key-add-btn');
    if (modalKeyPanel && modalKeyList) {
      // Populate provider dropdown
      if (modalKeyAddProv && typeof PROVIDERS !== 'undefined') {
        modalKeyAddProv.innerHTML = Object.entries(PROVIDERS).map(function(p) { return '<option value="' + p[0] + '">' + p[1].label + '</option>'; }).join('');
      }
      function renderModalKeyList() {
        var keys = typeof getStoredKeys === 'function' ? getStoredKeys() : [];
        if (!keys.length) {
          modalKeyList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune clé enregistrée</div>';
          return;
        }
        var activeId = sessionStorage.getItem('inry_assistant_key_id') || '';
        modalKeyList.innerHTML = keys.map(function(k) {
          var label = (typeof PROVIDERS !== 'undefined' && PROVIDERS[k.provider] ? PROVIDERS[k.provider].label : k.provider) + ' (' + k.model + ')';
          var isActive = activeId === k.id || (!activeId && k.active);
          return '<div class="modal-key-item" data-key-id="' + escapeAttr(k.id) + '" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);cursor:pointer;border-radius:var(--radius-sm);' + (isActive ? 'background:var(--cream-card);font-weight:600;' : '') + '">' +
            '<span style="flex:1;font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHTML(label) + '</span>' +
            (isActive ? '<span style="font-size:10px;color:var(--green);">✓</span>' : '') +
            '<button class="modal-key-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">✕</button></div>';
        }).join('');
        modalKeyList.querySelectorAll('.modal-key-item').forEach(function(el) {
          el.addEventListener('click', function(e) {
            if (e.target.closest('.modal-key-del')) return;
            var kid = el.dataset.keyId;
            sessionStorage.setItem('inry_assistant_key_id', kid);
            renderModalKeyList();
            if (typeof renderProviderPill === 'function') renderProviderPill();
          });
        });
        modalKeyList.querySelectorAll('.modal-key-del').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var el = btn.closest('.modal-key-item');
            var keys2 = (typeof getStoredKeys === 'function' ? getStoredKeys() : []).filter(function(k) { return k.id !== el.dataset.keyId; });
            if (typeof saveStoredKeys === 'function') saveStoredKeys(keys2);
            renderModalKeyList();
            if (typeof renderProviderPill === 'function') renderProviderPill();
          });
        });
      }
      // Add new key
      if (modalKeyAddBtn && modalKeyAddInput && modalKeyAddProv) {
        modalKeyAddBtn.onclick = function() {
          var val = modalKeyAddInput.value.trim();
          if (!val) { if (typeof showToast === 'function') showToast('Entrez une clé API.'); return; }
          var prov = modalKeyAddProv.value;
          var keys3 = typeof getStoredKeys === 'function' ? getStoredKeys() : [];
          var defModel = (typeof PROVIDERS !== 'undefined' && PROVIDERS[prov]) ? PROVIDERS[prov].defaultModel : 'gpt-4.1';
          keys3.push({ id: 'key-' + Date.now(), provider: prov, model: defModel, apiKey: val, endpoint: undefined, active: keys3.length === 0 });
          if (typeof saveStoredKeys === 'function') saveStoredKeys(keys3);
          sessionStorage.setItem('inry_assistant_key_id', keys3[keys3.length - 1].id);
          modalKeyAddInput.value = '';
          renderModalKeyList();
          if (typeof renderProviderPill === 'function') renderProviderPill();
          if (typeof showToast === 'function') showToast('Clé ajoutée !');
        };
      }
      document.getElementById('modal-ai-close-key-btn').onclick = function() { modalKeyPanel.style.display = 'none'; };
      document.getElementById('modal-ai-key-btn').onclick = function() {
        if (modalKeyPanel.style.display !== 'none') { modalKeyPanel.style.display = 'none'; return; }
        renderModalKeyList();
        modalKeyPanel.style.display = '';
      };
      function updateKeyBtn() {
        var btn = document.getElementById('modal-ai-key-btn');
        if (!btn) return;
        var k = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
        btn.textContent = k ? '🔑' + (k.model ? k.model.slice(0, 12) : 'API') : '🔑—';
      }
      document.getElementById('modal-ai-key-btn').title = 'Clé API';
      // Update after key changes
      var origRender = renderModalKeyList;
      renderModalKeyList = function() { origRender(); updateKeyBtn(); };
      updateKeyBtn();
      if (typeof renderProviderPill === 'function') renderProviderPill();
    }
  }

  document.getElementById('doc-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-close-btn').focus();
}

function closeDocModal() {
  const modal = document.getElementById('doc-modal');
  modal.classList.remove('open');
  document.getElementById('modal-preview').innerHTML = '';
  document.body.style.overflow = '';
  if (lastFocusedEl) lastFocusedEl.focus();
}

function findLevelYear(levelId) {
  for (const lvl of APP.db.levels) {
    const y = lvl.years.find(y => y.id === levelId);
    if (y) return y;
  }
  return null;
}

function findLevelGroup(levelId) {
  for (const lvl of APP.db.levels) {
    if (lvl.years.some(y => y.id === levelId)) return lvl;
  }
  return null;
}
