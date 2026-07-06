window.API = (() => {
  const base = CFG.SHEETS_BASE;

  // 429（配額）/ 5xx 自動退避重試：家庭多人同時操作時 Sheets API 偶發限流
  async function req(url, opts = {}, retries = 2) {
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
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        await new Promise(r => setTimeout(r, (3 - retries) * 1500 + 1000));
        return req(url, opts, retries - 1);
      }
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
    const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
      + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';
    const data = await req(`${base}/${sheetId}/values:batchGet?${qs}`);
    return (data.valueRanges || []).map(vr => vr.values || []);
  }

  async function append(sheetId, range, rowOrRows) {
    // 支援單列（1D）或多列（2D）：多列以單一請求寫入，避免逐筆中斷留下半組資料
    const values = Array.isArray(rowOrRows[0]) ? rowOrRows : [rowOrRows];
    return req(
      `${base}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) }
    );
  }

  // 一次更新多個不連續 range：data = [{ range, values }]
  async function batchUpdateValues(sheetId, data) {
    return req(
      `${base}/${sheetId}/values:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) }
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

  return { getRange, batchGet, append, updateRange, batchUpdate, batchUpdateValues, getSheetMeta, deleteRow };
})();
