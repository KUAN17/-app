window.API = (() => {
  const base = CFG.SHEETS_BASE;

  async function req(url, opts = {}) {
    const token = await Auth.getToken();
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function getRange(sheetId, range) {
    const data = await req(`${base}/${sheetId}/values/${encodeURIComponent(range)}`);
    return data.values || [];
  }

  async function batchGet(sheetId, ranges) {
    const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const data = await req(`${base}/${sheetId}/values:batchGet?${qs}`);
    return (data.valueRanges || []).map(vr => vr.values || []);
  }

  async function append(sheetId, range, row) {
    return req(
      `${base}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [row] }) }
    );
  }

  async function updateRange(sheetId, range, values) {
    return req(
      `${base}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', body: JSON.stringify({ values }) }
    );
  }

  async function batchUpdate(sheetId, requests) {
    return req(
      `${base}/${sheetId}:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ requests }) }
    );
  }

  async function getSheetMeta(sheetId) {
    const data = await req(`${base}/${sheetId}?fields=sheets.properties`);
    return (data.sheets || []).map(s => ({
      id: s.properties.sheetId,
      name: s.properties.title
    }));
  }

  async function deleteRow(sheetId, sheetNumericId, rowIndex) {
    return batchUpdate(sheetId, [{
      deleteDimension: {
        range: {
          sheetId: sheetNumericId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1
        }
      }
    }]);
  }

  return { getRange, batchGet, append, updateRange, batchUpdate, getSheetMeta, deleteRow };
})();
