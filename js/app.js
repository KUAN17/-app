// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  });
}

async function boot() {
  const clientId = localStorage.getItem(CFG.LS_KEYS.CLIENT_ID);
  const sheetId = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);

  // No config → go to setup
  if (!clientId || !sheetId) {
    showScreen('setup');
    document.getElementById('btn-setup-save').addEventListener('click', () => {
      const cid = document.getElementById('inp-setup-client').value.trim();
      const sid = document.getElementById('inp-setup-sheet').value.trim();
      if (!cid || !sid) return Utils.toast('請填寫完整設定', 'warn');
      localStorage.setItem(CFG.LS_KEYS.CLIENT_ID, cid);
      localStorage.setItem(CFG.LS_KEYS.SHEET_ID, sid);
      location.reload();
    });
    return;
  }

  // Wait for Google Identity Services to load (it's async)
  try {
    await waitForGSI();
  } catch (e) {
    document.getElementById('gsi-error').classList.remove('hidden');
    showScreen('auth');
    return;
  }

  await Auth.init(clientId);

  showScreen('auth');
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
