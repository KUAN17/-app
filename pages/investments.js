Router.register('investments', (() => {
  let _invState = [];
  const PERSONAL_ROLES = () => CFG.ROLES.filter(r => r !== '家用');
  const STOCK_LS = 'ff_stock_list';
  const STOCK_TS = 'ff_stock_list_ts';
  const STOCK_TTL = 24 * 60 * 60 * 1000;

  // ── Built-in common stocks ───────────────────────────────────────────────
  const BUILTIN_STOCKS = [
    // ETF
    {code:'0050',name:'元大台灣50',market:'上市'},{code:'0051',name:'元大中型100',market:'上市'},
    {code:'0052',name:'富邦科技',market:'上市'},{code:'0056',name:'元大高股息',market:'上市'},
    {code:'006208',name:'富邦台50',market:'上市'},{code:'00646',name:'元大S&P500',market:'上市'},
    {code:'00692',name:'富邦公司治理',market:'上市'},{code:'00713',name:'元大台灣高息低波',market:'上市'},
    {code:'00757',name:'統一FANG+',market:'上市'},{code:'00878',name:'國泰永續高股息',market:'上市'},
    {code:'00881',name:'國泰台灣5G+',market:'上市'},{code:'00900',name:'富邦特選高股息30',market:'上市'},
    {code:'00912',name:'中信台灣智慧50',market:'上市'},{code:'00919',name:'群益台灣精選高息',market:'上市'},
    {code:'00929',name:'復華台灣科技優息',market:'上市'},{code:'00934',name:'中信成長高股息',market:'上市'},
    {code:'00939',name:'統一台灣高息動能',market:'上市'},{code:'00940',name:'元大台灣價值高息',market:'上市'},
    {code:'00943',name:'國泰台灣季季息',market:'上市'},
    // 上市大型股
    {code:'1101',name:'台泥',market:'上市'},{code:'1216',name:'統一',market:'上市'},
    {code:'1301',name:'台塑',market:'上市'},{code:'1303',name:'南亞',market:'上市'},
    {code:'1326',name:'台化',market:'上市'},{code:'2002',name:'中鋼',market:'上市'},
    {code:'2207',name:'和泰車',market:'上市'},{code:'2301',name:'光寶科',market:'上市'},
    {code:'2303',name:'聯電',market:'上市'},{code:'2308',name:'台達電',market:'上市'},
    {code:'2317',name:'鴻海',market:'上市'},{code:'2327',name:'國巨',market:'上市'},
    {code:'2330',name:'台積電',market:'上市'},{code:'2337',name:'旺宏',market:'上市'},
    {code:'2345',name:'智邦',market:'上市'},{code:'2347',name:'聯強',market:'上市'},
    {code:'2352',name:'佳世達',market:'上市'},{code:'2353',name:'宏碁',market:'上市'},
    {code:'2356',name:'英業達',market:'上市'},{code:'2357',name:'華碩',market:'上市'},
    {code:'2360',name:'致茂',market:'上市'},{code:'2376',name:'技嘉',market:'上市'},
    {code:'2377',name:'微星',market:'上市'},{code:'2379',name:'瑞昱',market:'上市'},
    {code:'2382',name:'廣達',market:'上市'},{code:'2395',name:'研華',market:'上市'},
    {code:'2408',name:'南亞科',market:'上市'},{code:'2412',name:'中華電',market:'上市'},
    {code:'2454',name:'聯發科',market:'上市'},{code:'2474',name:'可成',market:'上市'},
    {code:'2492',name:'華新科',market:'上市'},{code:'2498',name:'宏達電',market:'上市'},
    {code:'2603',name:'長榮',market:'上市'},{code:'2609',name:'陽明',market:'上市'},
    {code:'2615',name:'萬海',market:'上市'},{code:'2633',name:'台灣高鐵',market:'上市'},
    {code:'2801',name:'彰銀',market:'上市'},{code:'2880',name:'華南金',market:'上市'},
    {code:'2881',name:'富邦金',market:'上市'},{code:'2882',name:'國泰金',market:'上市'},
    {code:'2883',name:'開發金',market:'上市'},{code:'2884',name:'玉山金',market:'上市'},
    {code:'2885',name:'元大金',market:'上市'},{code:'2886',name:'兆豐金',market:'上市'},
    {code:'2887',name:'台新金',market:'上市'},{code:'2890',name:'永豐金',market:'上市'},
    {code:'2891',name:'中信金',market:'上市'},{code:'2892',name:'第一金',market:'上市'},
    {code:'2912',name:'統一超',market:'上市'},{code:'3008',name:'大立光',market:'上市'},
    {code:'3017',name:'奇鋐',market:'上市'},{code:'3034',name:'聯詠',market:'上市'},
    {code:'3037',name:'欣興',market:'上市'},{code:'3045',name:'台灣大',market:'上市'},
    {code:'3481',name:'群創',market:'上市'},{code:'3711',name:'日月光投控',market:'上市'},
    {code:'4904',name:'遠傳',market:'上市'},{code:'5347',name:'世界先進',market:'上市'},
    {code:'5871',name:'中租-KY',market:'上市'},{code:'5876',name:'上海商銀',market:'上市'},
    {code:'5880',name:'合庫金',market:'上市'},{code:'6415',name:'矽力-KY',market:'上市'},
    {code:'6505',name:'台塑化',market:'上市'},{code:'6669',name:'緯穎',market:'上市'},
    {code:'6770',name:'力積電',market:'上市'},{code:'8046',name:'南電',market:'上市'},
    // 上櫃
    {code:'3533',name:'嘉澤',market:'上櫃'},{code:'3661',name:'世芯-KY',market:'上櫃'},
    {code:'4966',name:'譜瑞-KY',market:'上櫃'},{code:'6274',name:'台燿',market:'上櫃'},
    {code:'6488',name:'環球晶',market:'上櫃'},{code:'8299',name:'群聯',market:'上櫃'}
  ];

  let _stockList = [...BUILTIN_STOCKS];

  async function loadStockList() {
    _stockList = [...BUILTIN_STOCKS];
    const ts = parseInt(localStorage.getItem(STOCK_TS) || '0');
    if (Date.now() - ts < STOCK_TTL) {
      const cached = localStorage.getItem(STOCK_LS);
      if (cached) { _stockList = JSON.parse(cached); return; }
    }
    const existing = new Set(BUILTIN_STOCKS.map(s => s.code));
    const list = [...BUILTIN_STOCKS];
    try {
      const data = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L').then(r => r.json());
      data.forEach(s => {
        const code = (s['公司代號'] || s['證券代號'] || '').trim();
        const name = (s['公司簡稱'] || s['證券名稱'] || '').trim();
        if (code && name && /^\d/.test(code) && !existing.has(code)) { list.push({ code, name, market: '上市' }); existing.add(code); }
      });
    } catch (_) {}
    try {
      const data = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis').then(r => r.json());
      data.forEach(s => {
        const code = (s['SecuritiesCompanyCode'] || s['股票代號'] || s['Code'] || '').trim();
        const name = (s['CompanyName'] || s['公司名稱'] || s['Name'] || '').trim();
        if (code && name && !existing.has(code)) { list.push({ code, name, market: '上櫃' }); existing.add(code); }
      });
    } catch (_) {}
    _stockList = list;
    if (list.length > BUILTIN_STOCKS.length) {
      localStorage.setItem(STOCK_LS, JSON.stringify(list));
      localStorage.setItem(STOCK_TS, String(Date.now()));
    }
  }

  function searchStocks(q) {
    if (!q || q.length < 1) return [];
    const lower = q.toLowerCase();
    return _stockList.filter(s =>
      s.code.startsWith(q) || s.name.includes(q) || s.code.toLowerCase().startsWith(lower)
    ).slice(0, 8);
  }

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
    const roles = PERSONAL_ROLES();

    const totalMV     = visible.reduce((s, i) => s + i.marketValue, 0);
    const totalCost   = visible.reduce((s, i) => s + i.totalCost,   0);
    const totalUnreal = visible.reduce((s, i) => s + i.unrealized,  0);
    const totalReturn = totalCost > 0 ? totalUnreal / totalCost : 0;

    // Group by role → broker account
    const byRole = {};
    roles.forEach(r => { byRole[r] = {}; });
    visible.forEach(inv => {
      if (!byRole[inv.role]) return;
      if (!byRole[inv.role][inv.account]) byRole[inv.role][inv.account] = [];
      byRole[inv.role][inv.account].push({ ...inv, _si: _invState.indexOf(inv) });
    });

    const roleSections = roles.map(role => {
      const brokers = byRole[role];
      const brokerNames = Store.brokersForRole(role);
      const roleMV = Object.values(brokers).flat().reduce((s, i) => s + i.marketValue, 0);

      const brokerSections = Object.keys(brokers).map(broker => {
        const items = brokers[broker];
        const brokerMV = items.reduce((s, i) => s + i.marketValue, 0);
        const rows = items.map(i => `
          <div class="inv-row">
            <div class="inv-ticker">${i.ticker.replace(/^TPE:/i,'')}</div>
            <div class="inv-name">${i.name}</div>
            <div>${i.shares.toLocaleString()}</div>
            <div>$${i.price.toLocaleString()}</div>
            <div class="inv-mv">${Utils.formatMoney(i.marketValue)}</div>
            <div class="${i.unrealized >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(i.unrealized, true)}</div>
            <div class="${i.returnRate >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatPct(i.returnRate)}</div>
            <div class="inv-row-actions">
              <button class="inv-reduce-btn" data-si="${i._si}" title="減倉">減倉</button>
              <button class="inv-del-btn" data-si="${i._si}" title="刪除">✕</button>
            </div>
          </div>`).join('');

        return `<div class="inv-broker-section">
          <div class="inv-broker-header">
            <span>📊 ${broker}</span>
            <span class="inv-broker-mv">${Utils.formatMoney(brokerMV)}</span>
          </div>
          <div class="inv-table">
            <div class="inv-header">
              <span>代號</span><span>名稱</span><span>股數</span><span>現價</span><span>市值</span><span>損益</span><span>報酬</span><span></span>
            </div>
            ${rows}
          </div>
        </div>`;
      }).join('');

      const noBroker = brokerNames.length === 0
        ? `<p class="empty-hint" style="padding:8px 0">尚未設定證券帳戶，請先至設定新增「證券帳戶」類型的帳戶</p>` : '';

      return `
        <div class="section-header">
          <div class="section-label">${role}<span class="section-sub">${Utils.formatMoney(roleMV)}</span></div>
          <button class="btn btn-outline btn-sm btn-add-inv" data-role="${role}">＋ 新增標的</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          ${noBroker}
          ${brokerSections || '<p class="empty-hint" style="padding:12px 16px">尚無持倉</p>'}
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
          <span class="label-sm">總成本</span><span>${Utils.formatMoney(totalCost)}</span>
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
      Store.invalidate(); Utils.showLoading(true);
      try { await Store.load(true); buildState(); renderPage(); Utils.toast('已更新最新收盤價'); }
      finally { Utils.showLoading(false); }
    });

    document.querySelectorAll('.btn-add-inv').forEach(btn => {
      btn.addEventListener('click', () => showAddModal(btn.dataset.role));
    });

    document.querySelectorAll('.inv-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const si = parseInt(btn.dataset.si);
        if (!confirm(`確定刪除「${_invState[si].name}」持倉？`)) return;
        _invState[si]._deleted = true;
        saveInvestments();
      });
    });

    document.querySelectorAll('.inv-reduce-btn').forEach(btn => {
      btn.addEventListener('click', () => showReduceModal(parseInt(btn.dataset.si)));
    });
  }

  // ── Add modal ─────────────────────────────────────────────────────────────
  function showAddModal(defaultRole) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const roles = PERSONAL_ROLES();
    const roleOpts = roles.map(r =>
      `<option value="${r}"${r === defaultRole ? ' selected' : ''}>${r}</option>`
    ).join('');

    function brokerOpts(role) {
      const brokers = Store.brokersForRole(role);
      if (!brokers.length) return `<option value="">（請先至設定新增證券帳戶）</option>`;
      return brokers.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">新增持倉</div>
      <div class="form-row">
        <label>角色</label>
        <select id="inp-inv-role" class="form-select">${roleOpts}</select>
      </div>
      <div class="form-row">
        <label>證券帳戶</label>
        <select id="inp-inv-account" class="form-select">${brokerOpts(defaultRole)}</select>
      </div>
      <div class="form-row inv-search-wrap">
        <label>搜尋標的（代號或名稱）</label>
        <input type="text" id="inp-inv-search" class="form-input" placeholder="例：2330、台積電、AAPL" autocomplete="off">
        <div id="inv-search-dropdown" class="inv-search-dropdown hidden"></div>
      </div>
      <div class="form-row">
        <label>GOOGLEFINANCE 代號</label>
        <input type="text" id="inp-inv-ticker" class="form-input" placeholder="台股自動填入，美股請直接輸入如 AAPL">
        <p class="input-hint">台股將自動加上 <code>TPE:</code> 前綴</p>
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

    Utils.el('inp-inv-role').addEventListener('change', () => {
      Utils.el('inp-inv-account').innerHTML = brokerOpts(Utils.el('inp-inv-role').value);
    });

    let _timer;
    Utils.el('inp-inv-search').addEventListener('input', () => {
      clearTimeout(_timer);
      _timer = setTimeout(() => renderSearchDropdown(Utils.el('inp-inv-search').value.trim()), 200);
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
    Utils.el('btn-inv-confirm').addEventListener('click', () => {
      const role    = Utils.el('inp-inv-role').value;
      const account = Utils.el('inp-inv-account').value;
      const ticker  = Utils.el('inp-inv-ticker').value.trim();
      const name    = Utils.el('inp-inv-name').value.trim();
      const shares  = parseFloat(Utils.el('inp-inv-shares').value) || 0;
      const avgCost = parseFloat(Utils.el('inp-inv-avgcost').value) || 0;
      if (!account) return Utils.toast('請先至設定新增證券帳戶', 'warn');
      if (!ticker)  return Utils.toast('請選擇標的或輸入代號', 'warn');
      if (!name)    return Utils.toast('請輸入標的名稱', 'warn');
      if (!shares)  return Utils.toast('請輸入持有股數', 'warn');
      _invState.push({ role, account, ticker, name, shares, avgCost,
        totalCost: 0, price: 0, marketValue: 0, unrealized: 0, returnRate: 0, _deleted: false });
      modal.remove();
      saveInvestments();
    });
  }

  // ── Reduce modal ──────────────────────────────────────────────────────────
  function showReduceModal(si) {
    const inv = _invState[si];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">減倉 — ${inv.name}</div>
      <div class="form-row">
        <label>目前持倉</label>
        <div style="padding:8px 0;color:var(--text-muted)">${inv.shares.toLocaleString()} 股，均價 ${Utils.formatMoney(inv.avgCost)}</div>
      </div>
      <div class="form-row">
        <label>賣出股數 *</label>
        <input type="number" id="inp-reduce-shares" class="form-input" placeholder="0" min="1" max="${inv.shares}" step="1">
      </div>
      <div class="form-row">
        <label>賣出價格（選填，供計算已實現損益）</label>
        <input type="number" id="inp-reduce-price" class="form-input" placeholder="${inv.price || inv.avgCost}" min="0" step="0.01">
      </div>
      <div id="reduce-pnl" style="display:none;padding:8px 12px;border-radius:8px;margin:8px 0;font-size:.9rem"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-reduce-confirm">確認減倉</button>
        <button class="btn btn-outline" id="btn-reduce-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-reduce-cancel').addEventListener('click', () => modal.remove());

    function updatePnL() {
      const sellShares = parseFloat(Utils.el('inp-reduce-shares').value) || 0;
      const sellPrice  = parseFloat(Utils.el('inp-reduce-price').value) || 0;
      const pnlEl = Utils.el('reduce-pnl');
      if (sellShares > 0 && sellPrice > 0) {
        const realized = (sellPrice - inv.avgCost) * sellShares;
        pnlEl.style.display = 'block';
        pnlEl.style.background = realized >= 0 ? 'var(--success-light)' : 'var(--danger-light)';
        pnlEl.style.color = realized >= 0 ? '#059669' : 'var(--danger)';
        pnlEl.textContent = `已實現損益：${Utils.formatMoney(realized, true)}（${sellShares} 股 × $${sellPrice} − 均價 $${inv.avgCost}）`;
      } else {
        pnlEl.style.display = 'none';
      }
    }

    Utils.el('inp-reduce-shares').addEventListener('input', updatePnL);
    Utils.el('inp-reduce-price').addEventListener('input', updatePnL);

    Utils.el('btn-reduce-confirm').addEventListener('click', () => {
      const sellShares = parseFloat(Utils.el('inp-reduce-shares').value) || 0;
      if (!sellShares || sellShares <= 0) return Utils.toast('請輸入賣出股數', 'warn');
      if (sellShares > inv.shares) return Utils.toast(`最多可賣出 ${inv.shares} 股`, 'warn');
      if (sellShares === inv.shares) {
        _invState[si]._deleted = true;
      } else {
        _invState[si].shares = inv.shares - sellShares;
      }
      modal.remove();
      saveInvestments();
    });
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
