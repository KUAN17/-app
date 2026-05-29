Router.register('investments', (() => {
  let _invState = []; // [{role,account,ticker,name,shares,avgCost,totalCost,price,marketValue,unrealized,returnRate,_deleted}]
  let _stockList = [];
  const STOCK_LS = 'ff_stock_list';
  const STOCK_TS = 'ff_stock_list_ts';
  const STOCK_TTL = 24 * 60 * 60 * 1000;

  // ── Stock list (TWSE + TPEX) ─────────────────────────────────────────────
  async function loadStockList() {
    const ts = parseInt(localStorage.getItem(STOCK_TS) || '0');
    if (Date.now() - ts < STOCK_TTL) {
      const cached = localStorage.getItem(STOCK_LS);
      if (cached) { _stockList = JSON.parse(cached); return; }
    }
    const list = [];
    try {
      const data = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL').then(r => r.json());
      data.forEach(s => {
        const code = s['證券代號'] || '';
        const name = s['證券名稱'] || '';
        if (code && name && /^\d/.test(code)) list.push({ code, name, market: '上市' });
      });
    } catch (_) {}
    try {
      const data = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis').then(r => r.json());
      data.forEach(s => {
        const code = s['SecuritiesCompanyCode'] || s['股票代號'] || s['Code'] || '';
        const name = s['CompanyName'] || s['公司名稱'] || s['Name'] || '';
        if (code && name) list.push({ code, name, market: '上櫃' });
      });
    } catch (_) {}
    if (list.length) {
      _stockList = list;
      localStorage.setItem(STOCK_LS, JSON.stringify(list));
      localStorage.setItem(STOCK_TS, String(Date.now()));
    }
  }

  function searchStocks(q) {
    if (!q || q.length < 1) return [];
    return _stockList.filter(s =>
      s.code.startsWith(q) || s.name.includes(q)
    ).slice(0, 8);
  }

  // ── Render shell ─────────────────────────────────────────────────────────
  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    await Store.load();
    buildState();
    renderPage();
    loadStockList();
  }

  function buildState() {
    _invState = Store.get().investments.map(i => ({ ...i, _deleted: false }));
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  function renderPage() {
    const el = Utils.el('page-content');
    const visible = _invState.filter(i => !i._deleted);

    const totalMV     = visible.reduce((s, i) => s + i.marketValue, 0);
    const totalCost   = visible.reduce((s, i) => s + i.totalCost,   0);
    const totalUnreal = visible.reduce((s, i) => s + i.unrealized,  0);
    const totalReturn = totalCost > 0 ? totalUnreal / totalCost : 0;

    const byRole = {};
    visible.forEach((inv, idx) => {
      if (!byRole[inv.role]) byRole[inv.role] = [];
      byRole[inv.role].push({ ...inv, _si: _invState.indexOf(inv) });
    });

    const roleSections = CFG.ROLES.filter(r => byRole[r] || true).map(role => {
      const items = byRole[role] || [];
      const roleMV = items.reduce((s, i) => s + i.marketValue, 0);
      const rows = items.map(i => `
        <div class="inv-row">
          <div class="inv-ticker">${i.ticker.replace(/^TPE:/i, '')}</div>
          <div class="inv-name">${i.name}<br><span class="inv-acct">${i.account}</span></div>
          <div>${i.shares.toLocaleString()}</div>
          <div>$${i.price.toLocaleString()}</div>
          <div class="inv-mv">${Utils.formatMoney(i.marketValue)}</div>
          <div class="${i.unrealized >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(i.unrealized, true)}</div>
          <div class="${i.returnRate >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatPct(i.returnRate)}</div>
          <button class="inv-del-btn" data-si="${i._si}" title="刪除">✕</button>
        </div>`).join('');

      return `
        <div class="section-header">
          <div class="section-label">${role}<span class="section-sub">${Utils.formatMoney(roleMV)}</span></div>
          <button class="btn btn-outline btn-sm btn-add-inv" data-role="${role}">＋ 新增</button>
        </div>
        <div class="card inv-table">
          <div class="inv-header">
            <span>代號</span><span>名稱</span><span>股數</span><span>現價</span><span>市值</span><span>損益</span><span>報酬</span><span></span>
          </div>
          ${rows || '<p class="empty-hint" style="padding:12px 16px">尚無持倉</p>'}
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-inner">
      <div class="card invest-total">
        <div class="invest-total-row">
          <span class="label-sm">投資組合總市值</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="amount-primary invest-total-num">${Utils.formatMoney(totalMV)}</span>
            <button class="btn btn-outline btn-sm" id="btn-inv-refresh">重新整理</button>
          </div>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">總成本</span>
          <span>${Utils.formatMoney(totalCost)}</span>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">未實現損益</span>
          <span class="${totalUnreal >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(totalUnreal, true)}</span>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">整體報酬率</span>
          <span class="${totalReturn >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatPct(totalReturn)}</span>
        </div>
      </div>
      ${roleSections}
      <div style="height:16px"></div>
    </div>`;

    Utils.el('btn-inv-refresh').addEventListener('click', async () => {
      Store.invalidate();
      Utils.showLoading(true);
      try {
        await Store.load(true);
        buildState();
        renderPage();
        Utils.toast('已更新最新收盤價');
      } finally {
        Utils.showLoading(false);
      }
    });

    document.querySelectorAll('.btn-add-inv').forEach(btn => {
      btn.addEventListener('click', () => showAddModal(btn.dataset.role));
    });

    document.querySelectorAll('.inv-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const si = parseInt(btn.dataset.si);
        const name = _invState[si].name;
        if (!confirm(`確定刪除「${name}」持倉？`)) return;
        _invState[si]._deleted = true;
        saveInvestments();
      });
    });
  }

  // ── Add modal ─────────────────────────────────────────────────────────────
  function showAddModal(defaultRole) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const roleOpts = CFG.ROLES.map(r =>
      `<option value="${r}"${r === defaultRole ? ' selected' : ''}>${r}</option>`
    ).join('');
    const accts = Store.accountsForRole(defaultRole);
    const acctOpts = accts.map(a => `<option value="${a}">${a}</option>`).join('');

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">新增持倉</div>
      <div class="form-row">
        <label>角色</label>
        <select id="inp-inv-role" class="form-select">${roleOpts}</select>
      </div>
      <div class="form-row">
        <label>帳戶</label>
        <select id="inp-inv-account" class="form-select">${acctOpts}</select>
      </div>
      <div class="form-row inv-search-wrap">
        <label>搜尋標的（代號或名稱）</label>
        <input type="text" id="inp-inv-search" class="form-input" placeholder="例：2330、台積電、AAPL" autocomplete="off">
        <div id="inv-search-dropdown" class="inv-search-dropdown hidden"></div>
      </div>
      <div class="form-row">
        <label>GOOGLEFINANCE 代號</label>
        <input type="text" id="inp-inv-ticker" class="form-input" placeholder="台股自動填入，美股請直接輸入如 AAPL">
        <p class="input-hint">台股將自動加上 <code>TPE:</code> 前綴，美股請直接填代號</p>
      </div>
      <div class="form-row">
        <label>標的名稱</label>
        <input type="text" id="inp-inv-name" class="form-input" placeholder="自動填入或手動輸入">
      </div>
      <div class="form-row">
        <label>持有股數</label>
        <input type="number" id="inp-inv-shares" class="form-input" placeholder="0" min="0" step="1">
      </div>
      <div class="form-row">
        <label>持有均價</label>
        <input type="number" id="inp-inv-avgcost" class="form-input" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-inv-confirm">新增持倉</button>
        <button class="btn btn-outline" id="btn-inv-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    // Role → account cascade
    Utils.el('inp-inv-role').addEventListener('change', () => {
      const role = Utils.el('inp-inv-role').value;
      const accts2 = Store.accountsForRole(role);
      Utils.el('inp-inv-account').innerHTML = accts2.map(a => `<option value="${a}">${a}</option>`).join('');
    });

    // Search with debounce
    let _timer;
    Utils.el('inp-inv-search').addEventListener('input', () => {
      clearTimeout(_timer);
      _timer = setTimeout(() => {
        const q = Utils.el('inp-inv-search').value.trim();
        renderSearchDropdown(q);
      }, 200);
    });

    function renderSearchDropdown(q) {
      const dd = Utils.el('inv-search-dropdown');
      const matches = searchStocks(q);
      if (!matches.length) { dd.classList.add('hidden'); return; }
      dd.innerHTML = matches.map(s =>
        `<div class="inv-search-item" data-code="${s.code}" data-name="${s.name}">
          <span class="inv-search-code">${s.code}</span>
          <span class="inv-search-name">${s.name}</span>
          <span class="inv-search-market">${s.market}</span>
        </div>`
      ).join('');
      dd.classList.remove('hidden');
      dd.querySelectorAll('.inv-search-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          Utils.el('inp-inv-ticker').value = 'TPE:' + item.dataset.code;
          Utils.el('inp-inv-name').value = item.dataset.name;
          Utils.el('inp-inv-search').value = `${item.dataset.code}　${item.dataset.name}`;
          dd.classList.add('hidden');
        });
      });
    }

    Utils.el('inp-inv-search').addEventListener('blur', () => {
      setTimeout(() => Utils.el('inv-search-dropdown')?.classList.add('hidden'), 150);
    });

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-inv-cancel').addEventListener('click', () => modal.remove());
    Utils.el('btn-inv-confirm').addEventListener('click', () => confirmAdd(modal));
  }

  function confirmAdd(modal) {
    const role    = Utils.el('inp-inv-role').value;
    const account = Utils.el('inp-inv-account').value;
    const ticker  = Utils.el('inp-inv-ticker').value.trim();
    const name    = Utils.el('inp-inv-name').value.trim();
    const shares  = parseFloat(Utils.el('inp-inv-shares').value) || 0;
    const avgCost = parseFloat(Utils.el('inp-inv-avgcost').value) || 0;

    if (!ticker) return Utils.toast('請選擇標的或輸入代號', 'warn');
    if (!name)   return Utils.toast('請輸入標的名稱', 'warn');
    if (!shares) return Utils.toast('請輸入持有股數', 'warn');

    _invState.push({
      role, account, ticker, name, shares, avgCost,
      totalCost: 0, price: 0, marketValue: 0, unrealized: 0, returnRate: 0,
      _deleted: false
    });
    modal.remove();
    saveInvestments();
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveInvestments() {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const rows = _invState.filter(i => !i._deleted)
      .map(i => [i.role, i.account, i.ticker, i.name, i.shares, i.avgCost]);
    const padded = [...rows];
    while (padded.length < 50) padded.push(['', '', '', '', '', '']);

    Utils.showLoading(true);
    try {
      await API.updateRange(sid, 'Investments!A2:F51', padded);
      Store.invalidate();
      await Store.load(true);
      buildState();
      renderPage();
      Utils.toast('已儲存', 'success');
    } catch (e) {
      Utils.toast('儲存失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  return { render, onMount };
})());
