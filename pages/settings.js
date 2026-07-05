Router.register('settings', (() => {
  let _acctState = {};
  let _projState = []; // [{ _row, name, status, ownerRole, defaultAccount }]

  // ── Render shell ─────────────────────────────────────────────────────────
  function render(el) {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID || '';
    const cid = localStorage.getItem(CFG.LS_KEYS.CLIENT_ID) || CFG.CLIENT_ID || '';
    const curId = Utils.identity();

    el.innerHTML = `<div class="page-inner">

      <!-- ── 身份 ────────────────────────────────── -->
      <div class="settings-identity-card card">
        <p class="input-hint" id="id-email-hint" style="margin:0 0 10px">記帳頁與 Dashboard 會以此身份為主（自己＋家用）。</p>
        <div class="id-toggle">
          ${CFG.ROLES.map(r =>
            `<button type="button" class="proj-type-btn${curId === r ? ' active' : ''}" data-identity="${r}">${r === '家用' ? '🏠 家用視角' : r}</button>`
          ).join('')}
        </div>
      </div>

      <!-- ── 帳戶管理 ──────────────────────────────── -->
      <details class="settings-section" open>
        <summary class="settings-section-hd">
          <span>💳 帳戶管理</span>
          <span class="settings-section-arrow">›</span>
        </summary>
        <div class="settings-section-body">
          <div id="acct-mgmt-section"><div class="spinner"></div></div>
        </div>
      </details>

      <!-- ── 專案設定 ──────────────────────────────── -->
      <details class="settings-section">
        <summary class="settings-section-hd">
          <span>📋 專案設定</span>
          <span class="settings-section-arrow">›</span>
        </summary>
        <div class="settings-section-body">
          <p class="section-hint">設定各專案的費用歸屬角色與預設扣款帳戶，記帳時選擇專案後自動帶入。</p>
          <div id="proj-settings-section"><div class="spinner"></div></div>
        </div>
      </details>

      <!-- ── 系統 ─────────────────────────────────── -->
      <details class="settings-section">
        <summary class="settings-section-hd">
          <span>⚙️ 系統</span>
          <span class="settings-section-arrow">›</span>
        </summary>
        <div class="settings-section-body">
          <p class="section-hint" style="margin-bottom:12px">Google 連線設定，以及試算表結構初始化工具。</p>
          <div class="form-row">
            <label>OAuth Client ID</label>
            <input type="text" id="inp-client-id" class="form-input" value="${cid}" placeholder="your-client-id.apps.googleusercontent.com">
          </div>
          <div class="form-row">
            <label>Spreadsheet ID</label>
            <input type="text" id="inp-sheet-id" class="form-input" value="${sid}" placeholder="從 Google Sheets 網址列複製">
          </div>
          <button class="btn btn-primary btn-full" id="btn-save-conn">儲存連線設定</button>
          <div class="settings-sys-divider"></div>
          <p class="input-hint">尚未建立 Google Sheets 結構時，複製 Apps Script 至試算表執行 <code>buildAppSheetDatabase</code>。</p>
          <button class="btn btn-outline btn-full" id="btn-copy-script">複製 Apps Script 程式碼</button>
          <div class="settings-sys-divider"></div>
          <button class="btn btn-danger btn-full" id="btn-signout">登出</button>
        </div>
      </details>

      <div style="height:24px"></div>
    </div>`;
  }

  // ── Account management ───────────────────────────────────────────────────
  async function loadAccountSection() {
    const el = Utils.el('acct-mgmt-section');
    try {
      await Store.load();
      const raw = Store.get().accounts;
      const isEmpty = CFG.ROLES.every(r => !(raw[r] || []).length);

      _acctState = {};
      CFG.ROLES.forEach(r => {
        _acctState[r] = (raw[r] || []).map(a => ({
          ...a,
          type:        a.type || '',
          billingDate: a.billingDate || 0,
          dueDate:     a.dueDate || 0,
          paymentAccount: a.paymentAccount || '',
          _deleted: false, _new: false
        }));
      });

      if (isEmpty) {
        el.innerHTML = `<div class="card settings-card" style="text-align:center;padding:20px">
          <p style="color:var(--text-muted);margin-bottom:12px">尚未設定帳戶，請先初始化預設帳戶</p>
          <button class="btn btn-primary" id="btn-init-accounts">載入預設帳戶</button>
        </div>`;
        Utils.el('btn-init-accounts').addEventListener('click', initDefaultAccounts);
      } else {
        renderAccountMgmt();
      }
    } catch (e) {
      Utils.el('acct-mgmt-section').innerHTML = `<p class="error-msg">${e.message}</p>`;
    }
  }

  function renderAccountMgmt() {
    const el = Utils.el('acct-mgmt-section');
    el.innerHTML = CFG.ROLES.map(role => `
      <div class="card settings-card acct-role-card" style="margin-bottom:12px">
        <div class="acct-role-header">
          <span class="balance-role-badge">${role}</span>
          <button class="btn btn-outline btn-sm btn-add-acct" data-role="${role}">＋ 新增</button>
        </div>
        <div id="acct-list-${role}">${renderRoleList(role)}</div>
      </div>
    `).join('') +
    `<button class="btn btn-primary btn-full" id="btn-save-accounts">儲存帳戶設定</button>
     <button class="btn btn-outline btn-full" id="btn-reconcile" style="margin-top:8px">📋 對帳校正</button>
     <div style="height:8px"></div>`;

    CFG.ROLES.forEach(role => {
      Utils.el(`acct-mgmt-section`).querySelector(`.btn-add-acct[data-role="${role}"]`)
        .addEventListener('click', () => showAddModal(role));
    });
    Utils.el('btn-save-accounts').addEventListener('click', saveAccounts);
    Utils.el('btn-reconcile').addEventListener('click', showReconcileModal);
    attachListListeners();
  }

  // 該帳戶在帳本中的最後異動日（含代付扣款）
  function lastTxDate(role, name) {
    let d = '';
    Store.get().ledger.forEach(tx => {
      const hit = (tx.roleOut === role && tx.accountOut === name) ||
                  (tx.roleIn === role && tx.accountIn === name) ||
                  (tx.payAccount === name && (!tx.payRole || tx.payRole === role));
      if (hit && tx.date > d) d = tx.date;
    });
    return d;
  }

  function renderRoleList(role) {
    const visible = _acctState[role].map((a, i) => ({ ...a, _i: i })).filter(a => !a._deleted);
    if (!visible.length) return `<p class="empty-hint" style="padding:10px 0">尚無帳戶</p>`;
    const balances = Store.calcAllBalances();

    return visible.map(a => {
      const typeClass = a.type === '現金' ? 'cash' : a.type === '信用卡' ? 'cc' : a.type === '證券帳戶' ? 'broker' : 'bank';
      const typeLabel = a.type || '銀行';
      // 目前餘額＝期初＋帳本試算（含調帳校正）；未儲存的新帳戶尚無帳本紀錄，即期初值
      const cur = a._new ? (a.balance || 0) : ((balances[role] || {})[a.name] ?? (a.balance || 0));
      const last = a._new ? '' : lastTxDate(role, a.name);
      const curLabel = a.type === '信用卡' ? '目前待繳' : '目前餘額';
      const curRow = a.type === '證券帳戶' ? '' : `
        <div class="acct-cur-row">
          <span class="acct-cur-label">${curLabel}</span>
          <b class="${a.type === '信用卡' ? (cur > 0 ? 'amount-out' : '') : (cur < 0 ? 'amount-out' : '')}">${cur < 0 ? '-' : ''}${Utils.formatMoney(cur)}</b>
          ${last ? `<span class="acct-cur-date">最後異動 ${last.slice(5)}</span>` : ''}
        </div>`;
      return `
      <div class="acct-item">
        <div class="acct-item-top">
          <span class="acct-type-badge type-${typeClass}">${typeLabel}</span>
          <span class="acct-item-name">${a.name}</span>
          ${a.purpose ? `<span class="acct-item-purpose">${a.purpose}</span>` : ''}
          ${a.type === '信用卡' && a.paymentAccount ? `<span class="acct-item-purpose">扣款：${a.paymentAccount}</span>` : ''}
          <button class="btn btn-outline btn-sm acct-edit-btn" data-role="${role}" data-i="${a._i}" style="margin-left:auto">編輯</button>
          <button class="btn btn-danger btn-sm acct-del-btn" data-role="${role}" data-i="${a._i}">✕</button>
        </div>
        ${curRow}
        <div class="acct-item-inputs">
          <input type="number" class="form-input inp-acct-balance" data-role="${role}" data-i="${a._i}"
                 value="${a.balance || ''}" placeholder="期初餘額">
          <input type="date" class="form-input inp-acct-date" data-role="${role}" data-i="${a._i}"
                 value="${a.baseDate ? a.baseDate.replace(/\//g, '-') : ''}">
        </div>
      </div>`;
    }).join('');
  }

  function attachListListeners() {
    document.querySelectorAll('.acct-del-btn').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const { role, i } = fresh.dataset;
        _acctState[role][parseInt(i)]._deleted = true;
        Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
        attachListListeners();
      });
    });
    document.querySelectorAll('.acct-edit-btn').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const { role, i } = fresh.dataset;
        showEditModal(role, parseInt(i));
      });
    });
  }

  function _acctTypeModal(opts) {
    // Shared HTML builder for add/edit account modal
    const { title, acct, role, onConfirm } = opts;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const today = new Date().toISOString().slice(0, 10);
    const t = acct.type || '銀行';
    modal.innerHTML = `<div class="modal-card">
    <div class="modal-title">${title}</div>
    <div class="form-row">
      <label>帳戶類型 *</label>
      <div class="acct-type-toggle">
        <button type="button" class="proj-type-btn${t==='現金'?' active':''}" id="atype-cash">💵 現金</button>
        <button type="button" class="proj-type-btn${(t==='銀行'||!acct.type)?' active':''}" id="atype-bank">🏦 銀行</button>
        <button type="button" class="proj-type-btn${t==='信用卡'?' active':''}" id="atype-cc">💳 信用卡</button>
        <button type="button" class="proj-type-btn${t==='證券帳戶'?' active':''}" id="atype-broker">📊 證券帳戶</button>
      </div>
    </div>
    <div class="form-row">
      <label>帳戶名稱 *</label>
      <input type="text" id="inp-acct-name" class="form-input" placeholder="例：永豐數位帳戶" value="${acct.name||''}">
    </div>
    <div class="form-row">
      <label>主要用途</label>
      <input type="text" id="inp-acct-purpose" class="form-input" placeholder="選填，例：日常消費" value="${acct.purpose||''}">
    </div>
    <div class="form-row">
      <label>期初餘額</label>
      <input type="number" id="inp-acct-balance2" class="form-input" placeholder="0" value="${acct.balance||0}">
    </div>
    <div class="form-row">
      <label>基準日期</label>
      <input type="date" id="inp-acct-date2" class="form-input" value="${acct.baseDate ? acct.baseDate.replace(/\//g,'-') : today}">
    </div>
    <div id="cc-acct-fields" style="display:${t==='信用卡'?'block':'none'}">
      <div class="form-row">
        <label>帳單結帳日（每月幾號）</label>
        <input type="number" id="inp-acct-billing" class="form-input" placeholder="例：15" min="1" max="31" value="${acct.billingDate||''}">
      </div>
      <div class="form-row">
        <label>繳費截止日（每月幾號）</label>
        <input type="number" id="inp-acct-dueday" class="form-input" placeholder="例：25" min="1" max="31" value="${acct.dueDate||''}">
      </div>
      <div class="form-row">
        <label>扣款帳戶（選填）</label>
        <select id="inp-acct-payment" class="form-select">
          <option value="">不設定</option>
          ${(_acctState[role]||[]).filter(a=>!a._deleted&&a.type!=='信用卡'&&a.type!=='證券帳戶').map(a=>`<option value="${a.name}"${acct.paymentAccount===a.name?' selected':''}>${a.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" id="btn-confirm-acct">確認</button>
      <button class="btn btn-outline btn-sm" id="btn-cancel-acct">取消</button>
    </div>
  </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-cancel-acct').addEventListener('click', () => modal.remove());

    function getType() {
      if (Utils.el('atype-cash').classList.contains('active')) return '現金';
      if (Utils.el('atype-cc').classList.contains('active')) return '信用卡';
      if (Utils.el('atype-broker').classList.contains('active')) return '證券帳戶';
      return '銀行';
    }
    ['cash','bank','cc','broker'].forEach(key => {
      Utils.el(`atype-${key}`).addEventListener('click', () => {
        ['cash','bank','cc','broker'].forEach(x => Utils.el(`atype-${x}`).classList.remove('active'));
        Utils.el(`atype-${key}`).classList.add('active');
        Utils.el('cc-acct-fields').style.display = key === 'cc' ? 'block' : 'none';
      });
    });

    Utils.el('btn-confirm-acct').addEventListener('click', () => {
      const name = Utils.el('inp-acct-name').value.trim();
      if (!name) return Utils.toast('請輸入帳戶名稱', 'warn');
      const type = getType();
      onConfirm({
        name,
        purpose:     Utils.el('inp-acct-purpose').value.trim(),
        balance:     parseFloat(Utils.el('inp-acct-balance2').value) || 0,
        baseDate:    Utils.el('inp-acct-date2').value.replace(/-/g, '/'),
        type,
        billingDate: type === '信用卡' ? parseInt(Utils.el('inp-acct-billing').value) || 0 : 0,
        dueDate:     type === '信用卡' ? parseInt(Utils.el('inp-acct-dueday').value) || 0 : 0,
        paymentAccount: type === '信用卡' ? (Utils.el('inp-acct-payment')?.value || '') : '',
      });
      modal.remove();
    });
  }

  function showAddModal(role) {
    _acctTypeModal({
      title: `新增帳戶（${role}）`,
      role,
      acct: { name:'', purpose:'', balance:0, baseDate:'', type:'銀行', billingDate:0, dueDate:0, paymentAccount:'' },
      onConfirm(data) {
        _acctState[role].push({ ...data, _deleted: false, _new: true });
        Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
        attachListListeners();
      }
    });
  }

  function showEditModal(role, idx) {
    const acct = _acctState[role][idx];
    _acctTypeModal({
      title: `編輯帳戶（${role}）`,
      role,
      acct,
      onConfirm(data) {
        _acctState[role][idx] = { ...acct, ...data };
        Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
        attachListListeners();
      }
    });
  }

  function readInputsIntoState() {
    document.querySelectorAll('.inp-acct-balance').forEach(inp => {
      const { role, i } = inp.dataset;
      _acctState[role][parseInt(i)].balance = parseFloat(inp.value) || 0;
    });
    document.querySelectorAll('.inp-acct-date').forEach(inp => {
      const { role, i } = inp.dataset;
      _acctState[role][parseInt(i)].baseDate = inp.value.replace(/-/g, '/');
    });
  }

  function showReconcileModal() {
    const today = new Date().toISOString().slice(0, 10);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    // 信用卡＝累積消費、證券＝持倉市值，皆不適用現金餘額對帳，排除
    const rows = CFG.ROLES.flatMap(role =>
      (_acctState[role] || [])
        .map((a, i) => ({ ...a, _i: i, role }))
        .filter(a => !a._deleted && a.type !== '信用卡' && a.type !== '證券帳戶')
    );

    const rowsHtml = rows.map(a => {
      const curBal = Store.calcBalance(a.role, a.name);
      return `<div class="reconcile-row" data-role="${a.role}" data-i="${a._i}" data-cur="${curBal}">
        <div class="reconcile-name">
          <span class="balance-role-badge">${a.role}</span>
          <span>${a.name}</span>
          <span class="reconcile-cur">app: ${Utils.formatMoney(curBal)}</span>
        </div>
        <div class="reconcile-inputs">
          <input type="number" step="any" class="form-input reconcile-bal" placeholder="實際餘額（留空=略過）" style="flex:2">
          <input type="date" class="form-input reconcile-date" value="${today}" style="flex:1">
        </div>
        <div class="reconcile-diff" style="display:none"></div>
      </div>`;
    }).join('');

    modal.innerHTML = `<div class="modal-card" style="max-height:80vh;overflow-y:auto">
      <div class="modal-title">對帳校正</div>
      <div class="reconcile-mode">
        <label><input type="radio" name="rec-mode" value="adjust" checked> 補記調帳交易（保留紀錄、可追查）</label>
        <label><input type="radio" name="rec-mode" value="rebase"> 直接改期初餘額（不留紀錄）</label>
      </div>
      <p class="input-hint" id="rec-hint" style="margin:0 0 12px">填入各帳戶今日實際餘額，留空者略過。app 會自動計算差額並補記一筆「${CFG.CAT_ADJUST}」收入／支出，讓餘額與實際相符。</p>
      ${rows.length ? rowsHtml : '<p class="empty-hint">無可對帳的帳戶</p>'}
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-outline" id="reconcile-cancel">取消</button>
        <button class="btn btn-primary" id="reconcile-confirm">確認</button>
      </div>
    </div>`;

    document.body.appendChild(modal);

    function curMode() {
      return modal.querySelector('input[name="rec-mode"]:checked').value;
    }

    // 即時顯示差額
    function updateDiff(row) {
      const diffEl = row.querySelector('.reconcile-diff');
      const val = row.querySelector('.reconcile-bal').value.trim();
      if (val === '' || isNaN(parseFloat(val))) { diffEl.style.display = 'none'; return; }
      const cur = parseFloat(row.dataset.cur);
      const diff = Math.round((parseFloat(val) - cur) * 100) / 100;
      diffEl.style.display = 'block';
      if (diff === 0) {
        diffEl.textContent = '✓ 餘額相符，無需調整';
        diffEl.className = 'reconcile-diff match';
      } else {
        const sign = diff > 0 ? '+' : '−';
        const word = curMode() === 'adjust'
          ? (diff > 0 ? `補記收入 ${CFG.CAT_ADJUST}` : `補記支出 ${CFG.CAT_ADJUST}`)
          : '改期初餘額';
        diffEl.textContent = `差額 ${sign}${Utils.formatMoney(Math.abs(diff))} → ${word}`;
        diffEl.className = `reconcile-diff ${diff > 0 ? 'pos' : 'neg'}`;
      }
    }

    modal.querySelectorAll('.reconcile-row').forEach(row => {
      row.querySelector('.reconcile-bal').addEventListener('input', () => updateDiff(row));
    });
    modal.querySelectorAll('input[name="rec-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const adjust = curMode() === 'adjust';
        modal.querySelector('#rec-hint').textContent = adjust
          ? `填入各帳戶今日實際餘額，留空者略過。app 會自動計算差額並補記一筆「${CFG.CAT_ADJUST}」收入／支出，讓餘額與實際相符。`
          : '填入各帳戶今日實際餘額，留空者略過。直接把期初餘額改成實際值、基準日設為填入日期（歷史落差不再計入，但無調帳紀錄）。';
        modal.querySelectorAll('.reconcile-row').forEach(updateDiff);
      });
    });

    modal.querySelector('#reconcile-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#reconcile-confirm').addEventListener('click', async () => {
      const mode = curMode();
      const targets = [];
      modal.querySelectorAll('.reconcile-row').forEach(row => {
        const val = row.querySelector('.reconcile-bal').value.trim();
        if (val === '' || isNaN(parseFloat(val))) return; // 留空 → 略過
        const { role, i } = row.dataset;
        targets.push({
          role, idx: parseInt(i),
          actual: parseFloat(val),
          cur: parseFloat(row.dataset.cur),
          date: row.querySelector('.reconcile-date').value || today
        });
      });

      if (!targets.length) { Utils.toast('未填入任何餘額', 'warn'); return; }

      if (mode === 'rebase') {
        targets.forEach(t => {
          _acctState[t.role][t.idx].balance  = t.actual;
          _acctState[t.role][t.idx].baseDate = t.date.replace(/-/g, '/');
        });
        modal.remove();
        await saveAccounts(true);
        await Store.load(true); // 重新載入，讓「目前餘額」立即反映新期初值
        renderAccountMgmt();
        return;
      }

      // mode === 'adjust'：為每個有差額的帳戶補記一筆調帳交易
      const ledgerRows = [];
      targets.forEach(t => {
        const diff = Math.round((t.actual - t.cur) * 100) / 100;
        if (diff === 0) return; // 已相符
        const acctName = _acctState[t.role][t.idx].name;
        const date = t.date.replace(/-/g, '/');
        const memo = Utils.sheetText(`對帳校正（app ${Utils.formatMoney(t.cur)} → 實際 ${Utils.formatMoney(t.actual)}）`);
        if (diff > 0) {
          // 實際 > app：補一筆收入把餘額補上來
          ledgerRows.push([Utils.uid(), t.role, '', '', '收入', CFG.CAT_ADJUST, memo, date, diff, acctName, '', '', '', '', '']);
        } else {
          // 實際 < app：補一筆支出把餘額扣下去
          ledgerRows.push([Utils.uid(), t.role, '日常', '', '支出', CFG.CAT_ADJUST, memo, date, -diff, acctName, '', '', '', '', '']);
        }
      });

      if (!ledgerRows.length) { Utils.toast('所有帳戶餘額皆相符，無需調整', 'success'); modal.remove(); return; }

      const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
      const btn = modal.querySelector('#reconcile-confirm');
      btn.disabled = true; btn.textContent = '儲存中…';
      Utils.showLoading(true);
      try {
        for (const row of ledgerRows) {
          await API.append(sid, 'Ledger!A:O', row);
        }
        Store.invalidate();
        await Store.load(true);
        modal.remove();
        renderAccountMgmt();
        Utils.toast(`已補記 ${ledgerRows.length} 筆調帳，餘額已校正`, 'success');
      } catch (e) {
        Utils.toast('調帳失敗：' + e.message, 'error');
        btn.disabled = false; btn.textContent = '確認';
      } finally {
        Utils.showLoading(false);
      }
    });
  }

  async function saveAccounts(skipDOMRead = false) {
    if (!skipDOMRead) readInputsIntoState();

    const rows = [];
    CFG.ROLES.forEach(role => {
      _acctState[role].filter(a => !a._deleted).forEach(a => {
        rows.push([role, a.name, a.balance||0, a.baseDate||'', a.purpose||'', a.type||'', a.billingDate||'', a.dueDate||'', a.paymentAccount||'']);
      });
    });

    // Pad to 100 rows to overwrite any old data
    const padded = [...rows];
    while (padded.length < 100) padded.push(['','','','','','','','','']);

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    Utils.showLoading(true);
    try {
      await API.updateRange(sid, 'Backend!L1:T1',
        [['角色','帳戶名稱','期初餘額','基準日期','主要用途','帳戶類型','帳單日','截止日','扣款帳戶']]);
      await API.updateRange(sid, 'Backend!L2:T101', padded);
      Store.invalidate();
      Utils.toast('帳戶設定已儲存', 'success');
    } catch (e) {
      Utils.toast('儲存失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  // ── Project settings section ─────────────────────────────────────────────
  async function loadProjSection() {
    const el = Utils.el('proj-settings-section');
    try {
      await Store.load();
      const projects = Store.get().projects;
      _projState = projects.map(p => ({
        _row: p._row, name: p.name, status: p.status,
        ownerRole: p.ownerRole || '', defaultAccount: p.defaultAccount || ''
      }));
      renderProjSection();
    } catch(e) {
      el.innerHTML = `<p class="error-msg">${e.message}</p>`;
    }
  }

  function renderProjSection() {
    const el = Utils.el('proj-settings-section');
    if (!_projState.length) {
      el.innerHTML = `<div class="card settings-card"><p class="empty-hint" style="padding:10px 0">尚無專案資料</p></div>`;
      return;
    }

    const rows = _projState.map((p, i) => {
      const statusClass = p.status === '進行中' ? 'type-bank' : 'type-cash';
      const roleOpts = CFG.ROLES.map(r =>
        `<option value="${r}"${p.ownerRole===r?' selected':''}>${r}</option>`
      ).join('');
      const accts = p.ownerRole ? Store.accountsForRole(p.ownerRole) : [];
      const acctOpts = accts.map(a =>
        `<option value="${a}"${p.defaultAccount===a?' selected':''}>${a}</option>`
      ).join('');
      return `<div class="proj-setting-row">
        <div class="proj-setting-name">
          ${p.name}
          <span class="acct-type-badge ${statusClass}" style="font-size:10px">${p.status}</span>
        </div>
        <div class="proj-setting-fields">
          <select class="form-select inp-proj-owner" data-i="${i}" style="flex:1;font-size:13px">
            <option value="">歸屬角色</option>${roleOpts}
          </select>
          <select class="form-select inp-proj-acct" data-i="${i}" style="flex:1;font-size:13px">
            <option value="">預設帳戶</option>${acctOpts}
          </select>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `<div class="card settings-card">
      ${rows}
      <button class="btn btn-primary btn-full" id="btn-save-proj" style="margin-top:12px">儲存專案設定</button>
    </div>`;

    el.querySelectorAll('.inp-proj-owner').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = parseInt(sel.dataset.i);
        _projState[i].ownerRole = sel.value;
        _projState[i].defaultAccount = '';
        const accts = Store.accountsForRole(sel.value);
        const acctSel = el.querySelector(`.inp-proj-acct[data-i="${i}"]`);
        if (acctSel) acctSel.innerHTML = '<option value="">預設帳戶</option>' +
          accts.map(a => `<option value="${a}">${a}</option>`).join('');
      });
    });

    el.querySelectorAll('.inp-proj-acct').forEach(sel => {
      sel.addEventListener('change', () => {
        _projState[parseInt(sel.dataset.i)].defaultAccount = sel.value;
      });
    });

    Utils.el('btn-save-proj').addEventListener('click', saveProjSettings);
  }

  async function saveProjSettings() {
    if (!_projState.length) return;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const maxRow = Math.max(..._projState.map(p => p._row));
    const data = Array.from({ length: maxRow - 1 }, () => ['', '']);
    _projState.forEach(p => { data[p._row - 2] = [p.ownerRole || '', p.defaultAccount || '']; });

    Utils.showLoading(true);
    try {
      await API.updateRange(sid, `Projects!M2:N${maxRow}`, data);
      Store.invalidate();
      Utils.toast('專案設定已儲存', 'success');
    } catch(e) {
      Utils.toast('儲存失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  async function initDefaultAccounts() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    CFG.ROLES.forEach(r => { _acctState[r] = []; });
    function guessType(name) {
      if (/信用卡/.test(name)) return '信用卡';
      if (/現金|錢包/.test(name)) return '現金';
      if (/證券|股票|投資|券商/.test(name)) return '證券帳戶';
      return '銀行';
    }
    CFG.INITIAL_ACCOUNTS.forEach(a => {
      _acctState[a.role].push({ ...a, balance: 0, baseDate: today, type: guessType(a.name), billingDate: 0, dueDate: 0, paymentAccount: '', _deleted: false, _new: true });
    });
    await saveAccounts();
    Store.invalidate();
    await Store.load(true);
    renderAccountMgmt();
  }

  // ── Apps Script ──────────────────────────────────────────────────────────
  const APPS_SCRIPT = `function buildAppSheetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Projects
  var ps = ss.getSheetByName('Projects') || ss.insertSheet('Projects');
  ps.clear();
  ps.getRange('A1:H1').setValues([['狀態','專案名稱','目標預算','已花費金額','預算剩餘額度','已提撥準備金','資金缺口警示','預算消耗圖']]).setFontWeight('bold');
  var pf = [];
  for (var i = 2; i <= 51; i++) {
    pf.push([
      '=IF(B'+i+'="","",SUMIFS(Ledger!I:I,Ledger!D:D,B'+i+',Ledger!E:E,"支出"))',
      '=IF(B'+i+'="","",C'+i+'-D'+i+')',
      '=IF(B'+i+'="","",SUMIFS(Ledger!I:I,Ledger!D:D,B'+i+',Ledger!E:E,"公積金提撥",Ledger!F:F,"專案預備金"))',
      '=IF(B'+i+'="","",IF(D'+i+'>F'+i+',D'+i+'-F'+i+',0))',
      '=IF(OR(B'+i+'="",C'+i+'=0),"",SPARKLINE(D'+i+',{"charttype","bar";"max",C'+i+';"color1",IF(D'+i+'>C'+i+',"red","green")}))'
    ]);
  }
  ps.getRange(2,4,pf.length,5).setFormulas(pf);
  ps.getRange('A2:C4').setValues([['進行中','[家] 範例專案',500000],['進行中','[熊] 範例保養',15000],['已結案','[家] 舊專案',100000]]);

  // Backend
  var bs = ss.getSheetByName('Backend') || ss.insertSheet('Backend');
  bs.clear();
  bs.getRange('A1:C1').setValues([['阿熊帳戶','綺綺帳戶','家用帳戶']]).setFontWeight('bold');
  bs.getRange('A2:A8').setValues([['中信活存(薪資)'],['新光活存(投資)'],['聯邦活存(日用)'],['Line Pay Money'],['信用卡-玉山Pi'],['現金錢包'],['股票部位']]);
  bs.getRange('B2:B5').setValues([['台新Richart'],['信用卡-台新GoGo'],['現金錢包'],['股票部位']]);
  bs.getRange('C2:C4').setValues([['一銀活存'],['土銀活存'],['現金錢包']]);
  bs.getRange('E1:H1').setValues([['支出分類','收入分類','轉帳分類','提撥分類']]).setFontWeight('bold');
  bs.getRange('E2:E15').setValues([['食物'],['飲料'],['交通'],['購物'],['娛樂'],['家用'],['電信'],['醫藥'],['教育'],['醫療保險'],['投資儲蓄'],['旅遊'],['訂閱'],['信用卡費']]);
  bs.getRange('F2:F5').setValues([['薪資收入'],['利息/股息'],['業外收入'],['現金回饋']]);
  bs.getRange('G2:G3').setValues([['ATM領現'],['轉帳']]);
  bs.getRange('H2:H3').setValues([['常態家用'],['專案預備金']]);
  // Account config (L:P)
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  bs.getRange('L1:P1').setValues([['角色','帳戶名稱','期初餘額','基準日期','主要用途']]).setFontWeight('bold');
  var accts = [
    ['阿熊','中信活存(薪資)',0,today,'薪資入帳'],
    ['阿熊','新光活存(投資)',0,today,'投資'],
    ['阿熊','聯邦活存(日用)',0,today,'日常消費'],
    ['阿熊','Line Pay Money',0,today,'行動支付'],
    ['阿熊','信用卡-玉山Pi',0,today,''],
    ['阿熊','現金錢包',0,today,''],
    ['阿熊','股票部位',0,today,'投資'],
    ['綺綺','台新Richart',0,today,''],
    ['綺綺','信用卡-台新GoGo',0,today,''],
    ['綺綺','現金錢包',0,today,''],
    ['綺綺','股票部位',0,today,'投資'],
    ['家用','一銀活存',0,today,'家用主帳戶'],
    ['家用','土銀活存',0,today,''],
    ['家用','現金錢包',0,today,'']
  ];
  bs.getRange(2, 12, accts.length, 5).setValues(accts);

  // Investments
  var inv = ss.getSheetByName('Investments') || ss.insertSheet('Investments');
  inv.clear();
  inv.getRange('A1:K1').setValues([['角色歸屬','帳戶','標的代號','標的名稱','持有股數','持有均價','總成本','即時現價','總市值','未實現損益','報酬率']]).setFontWeight('bold');
  var ivf = [];
  for (var j = 2; j <= 51; j++) {
    ivf.push([
      '=IF(C'+j+'="","",E'+j+'*F'+j+')',
      '=IF(C'+j+'="","",GOOGLEFINANCE(C'+j+',"price"))',
      '=IF(C'+j+'="","",E'+j+'*H'+j+')',
      '=IF(C'+j+'="","",I'+j+'-G'+j+')',
      '=IF(OR(C'+j+'="",G'+j+'=0),"",J'+j+'/G'+j+')'
    ]);
  }
  inv.getRange(2,7,ivf.length,5).setFormulas(ivf);
  inv.getRange('H2:H200').setNumberFormat('0.00');
  inv.getRange('K2:K51').setNumberFormat('0.00%');

  // Settings（使用者身份：Email ↔ 身份）
  var st = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  st.clear();
  st.getRange('A1:B1').setValues([['Email','身份']]).setFontWeight('bold');

  // Ledger
  var ld = ss.getSheetByName('Ledger') || ss.insertSheet('Ledger');
  ld.clear();
  ld.getRange('A1:O1').setValues([['記帳 ID','角色 (出)','開銷維度','專案標籤','類型','主分類','項目/明細','日期','金額','付款帳戶','角色 (入)','對象帳戶','代付角色','代付帳戶','結清代付ID']]).setFontWeight('bold');

  SpreadsheetApp.getUi().alert('建置完成！');
}`;

  // ── onMount ──────────────────────────────────────────────────────────────
  function onMount() {
    document.querySelectorAll('[data-identity]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.identity;
        document.querySelectorAll('[data-identity]').forEach(b =>
          b.classList.toggle('active', b === btn));
        try {
          const synced = await Store.saveIdentity(id);
        Utils.toast(synced
            ? `身份已設定為「${id}」，並同步到雲端`
            : `身份已設定為「${id}」（僅此裝置，無法取得登入帳號）`, 'success');
        } catch (e) {
          Utils.toast(`身份已設定為「${id}」，但雲端同步失敗：${e.message}`, 'warn');
        }
      });
    });

    Auth.getEmail().then(em => {
      const hint = Utils.el('id-email-hint');
      if (em && hint) hint.textContent = `登入帳號：${em}。身份會跟著此 Google 帳號在 Safari／PWA／所有裝置間自動同步。`;
    });

    Utils.el('btn-save-conn').addEventListener('click', () => {
      const cid = Utils.el('inp-client-id').value.trim();
      const sid = Utils.el('inp-sheet-id').value.trim();
      if (!cid || !sid) return Utils.toast('請填寫完整設定', 'warn');
      localStorage.setItem(CFG.LS_KEYS.CLIENT_ID, cid);
      localStorage.setItem(CFG.LS_KEYS.SHEET_ID, sid);
      Store.invalidate();
      Utils.toast('已儲存，請重新整理頁面', 'success');
    });

    Utils.el('btn-copy-script').addEventListener('click', () => {
      navigator.clipboard.writeText(APPS_SCRIPT).then(() => Utils.toast('已複製！', 'success'));
    });

    Utils.el('btn-signout').addEventListener('click', () => {
      Auth.signOut();
      localStorage.removeItem(CFG.LS_KEYS.CACHE_DATA);
      localStorage.removeItem(CFG.LS_KEYS.CACHE_TS);
      location.reload();
    });

    loadAccountSection();
    loadProjSection();
  }

  return { render, onMount };
})());
