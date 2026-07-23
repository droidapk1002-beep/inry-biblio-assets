/* ============================================================
   ADMIN PANEL — manage AI provider keys (stored client-side)
   NOTE: This is a front-end only demo storage (localStorage).
   In production, API keys must be stored server-side, never
   exposed in client-side JS/localStorage.
   ============================================================ */

const ADMIN_PASSWORD = 'inry2026'; // ⚠️ fallback default — overridden by localStorage when changed

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-6',
    endpoint: 'https://api.anthropic.com/v1/messages',
    helpUrl: 'https://docs.claude.com/en/docs/about-claude/models/overview'
  },
  openai: {
    label: 'OpenAI (GPT)',
    defaultModel: 'gpt-4.1',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    helpUrl: 'https://platform.openai.com/docs/models'
  },
  google: {
    label: 'Google (Gemini)',
    defaultModel: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    helpUrl: 'https://ai.google.dev/gemini-api/docs/models'
  },
  custom: {
    label: 'Autre (compatible OpenAI)',
    defaultModel: '',
    endpoint: ''
  }
};

const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant pédagogique algérien.
Ton rôle est d'aider les élèves du primaire, du moyen et du secondaire.
Pour chaque question :
1. Identifier le niveau scolaire.
2. Identifier la matière.
3. Fournir une explication adaptée au programme algérien.
4. Donner des exemples corrigés.
5. Proposer des exercices similaires.
6. Générer des sujets de devoirs et d'examens si demandé.
7. Fournir les corrigés détaillés.
8. Répondre en arabe ou en français selon la langue de la question.
Priorité : exactitude pédagogique, programme algérien officiel, explications simples, réponses structurées.`;

function getStoredKeys() {
  try {
    return JSON.parse(localStorage.getItem('inry_api_keys') || '[]');
  } catch {
    return [];
  }
}

function saveStoredKeys(keys) {
  localStorage.setItem('inry_api_keys', JSON.stringify(keys));
}

function getActiveKey() {
  const keys = getStoredKeys();
  return keys.find(k => k.active) || keys[0] || null;
}

function getSystemPrompt() {
  return localStorage.getItem('inry_system_prompt') || DEFAULT_SYSTEM_PROMPT;
}

function setSystemPrompt(val) {
  localStorage.setItem('inry_system_prompt', val);
}

function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

function getAdminPassword() {
  var stored = localStorage.getItem('inry_admin_password');
  if (stored) {
    if (stored.startsWith('h@')) {
      // Old bad format from my earlier edit — hash the actual password
      var fixed = simpleHash(stored.slice(2));
      localStorage.setItem('inry_admin_password', fixed);
      return fixed;
    }
    if (stored.startsWith('h') && !stored.startsWith('h@')) {
      // Already a hash — return as-is
      return stored;
    }
    // Plain text from old versions — migrate
    var migrated = simpleHash(stored);
    localStorage.setItem('inry_admin_password', migrated);
    return migrated;
  }
  return simpleHash(ADMIN_PASSWORD);
}

function setAdminPassword(pwd) {
  localStorage.setItem('inry_admin_password', simpleHash(pwd));
}

function checkAdminPassword(input) {
  return simpleHash(input) === getAdminPassword();
}

function sanitizeApiKey(raw) {
  // Remove ALL whitespace (spaces, tabs, newlines) anywhere in the string,
  // plus invisible zero-width characters that sometimes survive copy-paste
  // from PDFs, chat apps, or rich text editors.
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width space/joiner/BOM
    .replace(/\s+/g, '');
}

function maskKey(key) {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

function checkKeyFormatWarning(provider, apiKey) {
  // Soft, non-blocking sanity checks for the most common providers.
  // A mismatch here is a strong signal of a copy-paste mistake (wrong key type,
  // truncated key, key from the wrong product/dashboard, etc.)
  if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    return t('admin.keyFormatWarningAnthropic');
  }
  if (provider === 'openai' && !apiKey.startsWith('sk-')) {
    return t('admin.keyFormatWarningOpenAI');
  }
  return null;
}

/* ---------------- Admin Page Logic ---------------- */
function initAdminPage() {
  const isUnlocked = sessionStorage.getItem('inry_admin_unlocked') === 'true';
  renderAdminLockState(isUnlocked);

  wirePasswordToggle('admin-password-input');
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = document.getElementById('admin-password-input').value;
      if (checkAdminPassword(pwd)) {
        sessionStorage.setItem('inry_admin_unlocked', 'true');
        renderAdminLockState(true);
      } else {
        document.getElementById('admin-error').textContent = t('admin.wrongPassword');
      }
    });
  }
}

function renderAdminLockState(unlocked) {
  const lockEl = document.getElementById('admin-lock-screen');
  const contentEl = document.getElementById('admin-content');
  if (unlocked) {
    lockEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    renderAdminContent();
  } else {
    lockEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
  }
}

function renderAdminContent() {
  // Populate provider select
  const providerSel = document.getElementById('admin-provider');
  providerSel.innerHTML = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');

  // Model is a FREE TEXT input — pre-filled with a sensible default for the
  // chosen provider, but fully editable: type whatever model name you want.
  const modelInput = document.getElementById('admin-model');
  const endpointRow = document.getElementById('admin-endpoint-row');
  const endpointInput = document.getElementById('admin-endpoint');
  const modelHelpLink = document.getElementById('admin-model-help-link');

  function suggestModel() {
    const p = PROVIDERS[providerSel.value];
    // Only auto-fill if the user hasn't typed something themselves (or it's still showing
    // a previous provider's default) — avoid overwriting a deliberately custom value.
    if (!modelInput.value || modelInput.dataset.autofilled === 'true') {
      modelInput.value = p.defaultModel || '';
      modelInput.dataset.autofilled = 'true';
    }
    modelInput.placeholder = p.defaultModel || 'nom-du-modele';
    endpointRow.style.display = providerSel.value === 'custom' ? '' : 'none';
    if (modelHelpLink) {
      if (p.helpUrl) {
        modelHelpLink.href = p.helpUrl;
        modelHelpLink.classList.remove('hidden');
      } else {
        modelHelpLink.classList.add('hidden');
      }
    }
  }
  modelInput.addEventListener('input', () => { modelInput.dataset.autofilled = 'false'; });
  suggestModel();
  providerSel.onchange = suggestModel;

  // System prompt
  const promptEl = document.getElementById('admin-system-prompt');
  promptEl.value = getSystemPrompt();
  promptEl.addEventListener('input', debounce(() => setSystemPrompt(promptEl.value), 400));

  wirePasswordToggle('admin-api-key');
  wirePasswordToggle('admin-current-password');
  wirePasswordToggle('admin-new-password');
  wirePasswordToggle('admin-confirm-password');

  // Save key form (handles both ADD and EDIT)
  const form = document.getElementById('admin-key-form');
  form.onsubmit = (e) => {
    e.preventDefault();
    const provider = providerSel.value;
    const model = modelInput.value.trim() || PROVIDERS[provider].defaultModel;
    const keyInput = document.getElementById('admin-api-key');
    const rawKey = keyInput.dataset.originalKey && keyInput.value === maskKey(keyInput.dataset.originalKey) ? keyInput.dataset.originalKey : keyInput.value;
    const apiKey = sanitizeApiKey(rawKey);
    const endpoint = provider === 'custom' ? endpointInput.value.trim() : '';

    if (!apiKey) {
      showToast(t('admin.apiKeyRequired'));
      return;
    }
    if (!model) {
      showToast(t('admin.modelRequired'));
      return;
    }
    if (provider === 'custom' && !endpoint) {
      showToast(t('admin.endpointRequired'));
      return;
    }

    const formatWarning = checkKeyFormatWarning(provider, apiKey);
    if (formatWarning) {
      showToast(formatWarning);
      // not blocking — some legitimate keys (proxies, org-issued keys) may not match the usual prefix
    }

    let keys = getStoredKeys();

    if (editingKeyId) {
      // EDIT existing key in place, keep its id and active status
      keys = keys.map(k => k.id === editingKeyId
        ? { ...k, provider, model, apiKey, endpoint: endpoint || undefined }
        : k);
      saveStoredKeys(keys);
      resetKeyForm();
      showToast(t('admin.keyUpdated'));
    } else {
      // ADD new key
      const makeActive = keys.length === 0; // first key added becomes active automatically
      keys.push({
        id: 'key-' + Date.now(),
        provider,
        model,
        apiKey,
        endpoint: endpoint || undefined,
        active: makeActive
      });
      saveStoredKeys(keys);
      document.getElementById('admin-api-key').value = '';
      modelInput.value = '';
      endpointInput.value = '';
    }

    renderKeyList();

    const confirmEl = document.getElementById('admin-save-confirm');
    confirmEl.classList.add('show');
    setTimeout(() => confirmEl.classList.remove('show'), 2200);
  };

  // Password change form
  const passwordForm = document.getElementById('admin-password-form');
  if (passwordForm) {
    passwordForm.onsubmit = (e) => {
      e.preventDefault();
      const current = document.getElementById('admin-current-password').value;
      const newPwd = document.getElementById('admin-new-password').value;
      const confirmPwd = document.getElementById('admin-confirm-password').value;
      const errorEl = document.getElementById('admin-password-error');

      if (!checkAdminPassword(current)) {
        errorEl.textContent = t('admin.wrongCurrentPassword');
        return;
      }
      if (newPwd.length < 6) {
        errorEl.textContent = t('admin.passwordTooShort');
        return;
      }
      if (newPwd !== confirmPwd) {
        errorEl.textContent = t('admin.passwordMismatch');
        return;
      }
      errorEl.textContent = '';
      setAdminPassword(newPwd);
      document.getElementById('admin-current-password').value = '';
      document.getElementById('admin-new-password').value = '';
      document.getElementById('admin-confirm-password').value = '';
      const confirmEl = document.getElementById('admin-password-save-confirm');
      confirmEl.classList.add('show');
      setTimeout(() => confirmEl.classList.remove('show'), 2200);
    };
  }

  document.getElementById('admin-logout-btn').onclick = () => {
    sessionStorage.removeItem('inry_admin_unlocked');
    window.location.href = 'index.html';
  };

  renderKeyList();

  if (typeof initDocManager === 'function') {
    initDocManager();
  } else {
    console.error('[INRY-Biblio] initDocManager() introuvable — vérifie que js/doc-manager.js est bien chargé et vide le cache du navigateur (Ctrl+Maj+R).');
  }
}

function renderKeyList() {
  const listEl = document.getElementById('admin-key-list');
  const keys = getStoredKeys();
  if (!keys.length) {
    listEl.innerHTML = `<p style="color:var(--ink-soft); font-size:var(--fs-sm);">${t('admin.noKeys')}</p>`;
    return;
  }
  listEl.innerHTML = keys.map(k => `
    <div class="key-item" data-key-id="${escapeAttr(k.id)}">
      <div class="key-item-info">
        <span class="key-item-provider">${escapeHTML(PROVIDERS[k.provider]?.label || k.provider)} ${k.active ? `<span class="badge-active">${t('admin.active')}</span>` : ''}</span>
        <span class="key-item-meta">${escapeHTML(k.model)}${k.endpoint ? ' · ' + escapeHTML(k.endpoint) : ''} · ${maskKey(k.apiKey)}</span>
      </div>
      <div class="key-item-actions">
        ${!k.active ? `<button class="btn btn-secondary btn-sm set-active-btn" data-key-id="${escapeAttr(k.id)}">${t('admin.setActive')}</button>` : ''}
        <button class="btn btn-secondary btn-sm edit-key-btn" data-key-id="${escapeAttr(k.id)}">${icon('settings')}</button>
        <button class="btn btn-danger btn-sm delete-key-btn" data-key-id="${escapeAttr(k.id)}">${icon('trash')}</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.set-active-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const keys = getStoredKeys().map(k => ({ ...k, active: k.id === btn.dataset.keyId }));
      saveStoredKeys(keys);
      renderKeyList();
    });
  });
  listEl.querySelectorAll('.edit-key-btn').forEach(btn => {
    btn.addEventListener('click', () => loadKeyIntoForm(btn.dataset.keyId));
  });
  listEl.querySelectorAll('.delete-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      let keys = getStoredKeys().filter(k => k.id !== btn.dataset.keyId);
      // if we deleted the active one, promote the next key
      if (keys.length && !keys.some(k => k.active)) keys[0].active = true;
      saveStoredKeys(keys);
      renderKeyList();
      if (editingKeyId === btn.dataset.keyId) resetKeyForm();
    });
  });
}

let editingKeyId = null;

function loadKeyIntoForm(keyId) {
  const key = getStoredKeys().find(k => k.id === keyId);
  if (!key) return;
  editingKeyId = keyId;

  document.getElementById('admin-provider').value = key.provider;
  document.getElementById('admin-provider').dispatchEvent(new Event('change'));
  document.getElementById('admin-model').value = key.model;
  document.getElementById('admin-model').dataset.autofilled = 'false';
  document.getElementById('admin-endpoint').value = key.endpoint || '';
  document.getElementById('admin-api-key').value = maskKey(key.apiKey);
  document.getElementById('admin-api-key').dataset.originalKey = key.apiKey;

  const submitBtn = document.querySelector('#admin-key-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = t('admin.saveChanges');

  let cancelBtn = document.getElementById('admin-key-cancel-btn');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'admin-key-cancel-btn';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('admin.cancel');
    cancelBtn.addEventListener('click', resetKeyForm);
    submitBtn.insertAdjacentElement('afterend', cancelBtn);
  }
  cancelBtn.classList.remove('hidden');

  document.getElementById('admin-key-form')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function resetKeyForm() {
  editingKeyId = null;
  document.getElementById('admin-key-form').reset();
  const submitBtn = document.querySelector('#admin-key-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = t('admin.save');
  const cancelBtn = document.getElementById('admin-key-cancel-btn');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  document.getElementById('admin-provider').dispatchEvent(new Event('change'));
}

function wirePasswordToggle(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  if (input.parentNode.classList.contains('pwd-toggle-wrap')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pwd-toggle-btn';
  btn.innerHTML = icon('eye');
  btn.setAttribute('aria-label', 'Afficher/masquer le mot de passe');
  var wrapper = document.createElement('div');
  wrapper.className = 'pwd-toggle-wrap';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  wrapper.appendChild(btn);
  btn.addEventListener('click', function () {
    var isPassword = input.type === 'password';
    // Show mode: reveal the original key if masked
    if (isPassword && input.dataset.originalKey) {
      input.value = input.dataset.originalKey;
    }
    // Hide mode: restore masked version only if unchanged
    if (!isPassword && input.dataset.originalKey && input.value === input.dataset.originalKey) {
      input.value = maskKey(input.dataset.originalKey);
    }
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = icon(isPassword ? 'eyeOff' : 'eye');
  });
}
