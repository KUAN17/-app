window.Auth = (() => {
  let _token  = null;
  let _expiry = 0;
  let _hint   = '';
  let _client = null;
  let _resolveToken = null;

  const LS_TOKEN  = 'ff_access_token';
  const LS_EXPIRY = 'ff_token_expiry';
  const LS_HINT   = 'ff_token_hint';

  function isValid() {
    return !!_token && Date.now() < _expiry - 60000;
  }

  function _persist(token, expiresIn) {
    _token  = token;
    _expiry = Date.now() + expiresIn * 1000;
    localStorage.setItem(LS_TOKEN,  _token);
    localStorage.setItem(LS_EXPIRY, String(_expiry));
  }

  function _restore() {
    const t = localStorage.getItem(LS_TOKEN);
    const e = parseInt(localStorage.getItem(LS_EXPIRY) || '0');
    _hint   = localStorage.getItem(LS_HINT) || '';
    if (t && Date.now() < e - 60000) { _token = t; _expiry = e; }
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

  async function getToken() {
    if (isValid()) return _token;
    return interactiveToken();
  }

  function signOut() {
    if (_token) google.accounts.oauth2.revoke(_token);
    _token = null; _expiry = 0; _hint = '';
    localStorage.removeItem(CFG.LS_KEYS.AUTOLOGIN);
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

  return { init, getToken, silentToken, signOut, hasToken, isValid, getEmail };
})();
