if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  });
}

async function boot() {
  // Use hardcoded values, fall back to localStorage overrides (from settings page)
  const clientId = localStorage.getItem(CFG.LS_KEYS.CLIENT_ID) || CFG.CLIENT_ID;
  const sheetId  = localStorage.getItem(CFG.LS_KEYS.SHEET_ID)  || CFG.SHEET_ID;

  // Persist so Store/API can read from localStorage
  if (!localStorage.getItem(CFG.LS_KEYS.CLIENT_ID)) localStorage.setItem(CFG.LS_KEYS.CLIENT_ID, clientId);
  if (!localStorage.getItem(CFG.LS_KEYS.SHEET_ID))  localStorage.setItem(CFG.LS_KEYS.SHEET_ID, sheetId);

  try {
    await waitForGSI();
  } catch (e) {
    document.getElementById('gsi-error').classList.remove('hidden');
    showScreen('auth');
    bindAuthButtons();
    return;
  }

  await Auth.init(clientId);

  // Auto-login if user has logged in before
  const hasLoggedInBefore = localStorage.getItem(CFG.LS_KEYS.AUTOLOGIN);
  if (hasLoggedInBefore) {
    // Cached token still valid → enter app immediately, no GIS call needed
    if (Auth.isValid()) {
      launchApp();
      return;
    }
    // Token expired → try silent refresh using browser's Google session
    Utils.showLoading(true);
    try {
      await Auth.silentToken();
      Utils.showLoading(false);
      launchApp();
      return;
    } catch (e) {
      Utils.showLoading(false);
    }
  }

  showScreen('auth');
  bindAuthButtons();
}

function bindAuthButtons() {
  document.getElementById('btn-signin').addEventListener('click', async () => {
    try {
      await Auth.getToken();
      launchApp();
    } catch (e) {
      Utils.toast('登入失敗：' + e.message, 'error');
    }
  });
  document.getElementById('btn-reconfig').addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem(CFG.LS_KEYS.CLIENT_ID);
    localStorage.removeItem(CFG.LS_KEYS.SHEET_ID);
    location.reload();
  });
}

function launchApp() {
  showScreen('main');
  Router.init();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function waitForGSI(timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined') { resolve(); return; }
    if (window._gsiFailed) { reject(); return; }
    const start = Date.now();
    const t = setInterval(() => {
      if (typeof google !== 'undefined') { clearInterval(t); resolve(); }
      else if (window._gsiFailed || Date.now() - start > timeout) { clearInterval(t); reject(); }
    }, 100);
  });
}

window.addEventListener('DOMContentLoaded', boot);
