window.Auth = (() => {
  let _token  = null;
  let _expiry = 0;
  let _hint   = '';
  let _client = null;
  let _resolveToken = null;
  let _reauth = null;      // 登入過期時共用的「重新登入」等待，避免同時多個請求各跳一次視窗

  const LS_TOKEN  = 'ff_access_token';
  const LS_EXPIRY = 'ff_token_expiry';
  const LS_HINT   = 'ff_token_hint';

  function isValid() {
    return !!_token && Date.now() < _expiry - 60000;
  }

  // token 存 sessionStorage（非 localStorage）：縮小 XSS 竊取窗口——關閉 app 即失效，
  // 新開啟時由 boot 的 silentToken 靜默換發。email hint 非機密，留在 localStorage。
  function _persist(token, expiresIn) {
    _token  = token;
    _expiry = Date.now() + expiresIn * 1000;
    sessionStorage.setItem(LS_TOKEN,  _token);
    sessionStorage.setItem(LS_EXPIRY, String(_expiry));
    // 清除舊版殘留在 localStorage 的 token
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRY);
  }

  function _restore() {
    const t = sessionStorage.getItem(LS_TOKEN);
    const e = parseInt(sessionStorage.getItem(LS_EXPIRY) || '0');
    _hint   = localStorage.getItem(LS_HINT) || '';
    if (t && Date.now() < e - 60000) { _token = t; _expiry = e; }
    // 舊版 localStorage token 一律作廢清除
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRY);
  }

  function _fetchHint() {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${_token}` }
    }).then(r => r.json()).then(info => {
      if (info.email) { _hint = info.email; localStorage.setItem(LS_HINT, _hint); }
    }).catch(() => {});
  }

  function init(clientId) {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined') {
        reject(new Error('Google Identity Services 未載入'));
        return;
      }
      _restore();
      _client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CFG.SCOPES,
        callback: (resp) => {
          if (resp.error) {
            if (_resolveToken) { _resolveToken.reject(new Error(resp.error)); _resolveToken = null; }
            return;
          }
          _persist(resp.access_token, resp.expires_in);
          localStorage.setItem(CFG.LS_KEYS.AUTOLOGIN, '1');
          if (!_hint) _fetchHint();
          if (_resolveToken) { _resolveToken.resolve(_token); _resolveToken = null; }
        },
        // 登入視窗被瀏覽器擋下或被使用者關閉：讓等待中的請求失敗，而不是永遠卡住
        error_callback: (err) => {
          if (_resolveToken) { _resolveToken.reject(new Error(err?.type || 'popup_failed')); _resolveToken = null; }
        }
      });
      resolve();
    });
  }

  function silentToken(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        _resolveToken = null;
        reject(new Error('silent timeout'));
      }, timeout);
      _resolveToken = {
        resolve: (v) => { clearTimeout(t); resolve(v); },
        reject:  (e) => { clearTimeout(t); reject(e); }
      };
      _client.requestAccessToken({ prompt: 'none', ..._hint ? { hint: _hint } : {} });
    });
  }

  function interactiveToken() {
    return new Promise((resolve, reject) => {
      _resolveToken = { resolve, reject };
      _client.requestAccessToken({ ..._hint ? { hint: _hint } : {} });
    });
  }

  // 使用中憑證過期：不能直接開 Google 登入視窗（非點擊觸發會被瀏覽器擋下），
  // 改跳一個小視窗，由使用者按下「重新登入」再開，所有等待中的請求共用同一次登入
  function promptReauth() {
    if (_reauth) return _reauth;
    _reauth = new Promise((resolve, reject) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay reauth-overlay';
      modal.innerHTML = `<div class="modal-card">
        <div class="modal-title">登入已過期</div>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:14px">為了繼續讀寫試算表，請重新登入 Google。</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="btn-reauth">重新登入</button>
          <button class="btn btn-outline" id="btn-reauth-cancel">取消</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#btn-reauth').addEventListener('click', async () => {
        try {
          const t = await interactiveToken();
          modal.remove();
          resolve(t);
        } catch (e) {
          Utils.toast('登入沒有完成，請再按一次「重新登入」', 'warn');
        }
      });
      modal.querySelector('#btn-reauth-cancel').addEventListener('click', () => {
        modal.remove();
        reject(new Error('登入已過期，已取消'));
      });
    }).finally(() => { _reauth = null; });
    return _reauth;
  }

  async function getToken() {
    if (isValid()) return _token;
    return promptReauth();
  }

  // 登入畫面的「登入」按鈕：本身就是點擊，直接開 Google 登入視窗
  function signIn() {
    return isValid() ? Promise.resolve(_token) : interactiveToken();
  }

  function signOut() {
    if (_token) google.accounts.oauth2.revoke(_token);
    _token = null; _expiry = 0; _hint = '';
    localStorage.removeItem(CFG.LS_KEYS.AUTOLOGIN);
    sessionStorage.removeItem(LS_TOKEN);
    sessionStorage.removeItem(LS_EXPIRY);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRY);
    localStorage.removeItem(LS_HINT);
  }

  function hasToken() { return !!_token; }

  // 取得登入者 Gmail（身份雲端同步用）；token 無 email 權限時回空字串
  async function getEmail() {
    if (_hint) return _hint;
    if (!isValid()) return '';
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${_token}` }
      });
      const info = await r.json();
      if (info.email) { _hint = info.email; localStorage.setItem(LS_HINT, _hint); }
    } catch {}
    return _hint || '';
  }

  return { init, getToken, signIn, silentToken, signOut, hasToken, isValid, getEmail };
})();
