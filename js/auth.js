window.Auth = (() => {
  let _token = null;
  let _expiry = 0;
  let _client = null;
  let _resolveToken = null;

  function isValid() {
    return _token && Date.now() < _expiry - 60000;
  }

  function init(clientId) {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined') {
        reject(new Error('Google Identity Services 未載入'));
        return;
      }
      _client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CFG.SCOPES,
        callback: (resp) => {
          if (resp.error) {
            if (_resolveToken) _resolveToken.reject(new Error(resp.error));
            return;
          }
          _token = resp.access_token;
          _expiry = Date.now() + resp.expires_in * 1000;
          if (_resolveToken) {
            _resolveToken.resolve(_token);
            _resolveToken = null;
          }
        }
      });
      resolve();
    });
  }

  async function getToken() {
    if (isValid()) return _token;
    return new Promise((resolve, reject) => {
      _resolveToken = { resolve, reject };
      _client.requestAccessToken({ prompt: isValid() ? '' : 'none' });
    }).catch(() => {
      return new Promise((resolve, reject) => {
        _resolveToken = { resolve, reject };
        _client.requestAccessToken();
      });
    });
  }

  function signOut() {
    if (_token) google.accounts.oauth2.revoke(_token);
    _token = null;
    _expiry = 0;
  }

  function hasToken() { return !!_token; }

  return { init, getToken, signOut, hasToken };
})();
