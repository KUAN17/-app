Router.register('investments', (() => {
  let _lots = [];
  let _activeRole = null;
  const PERSONAL_ROLES = () => CFG.ROLES.filter(r => r !== '家用');

  const STOCK_LS = 'ff_stock_list', STOCK_TS = 'ff_stock_list_ts', STOCK_TTL = 86400000;

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
    // 債券 ETF（TWSE PE API 不包含，需手動維護）
    {code:'00679B',name:'元大美國政府20年以上債券',market:'上市'},
    {code:'00687B',name:'國泰20年美債',market:'上市'},
    {code:'00695B',name:'富邦美國投資等級債',market:'上市'},
    {code:'00720B',name:'元大投資級公司債',market:'上市'},
    {code:'00740B',name:'國泰20年美國公債',market:'上市'},
    {code:'00772B',name:'中信高評級公司債',market:'上市'},
    {code:'00779B',name:'凱基美國投資級債20+',market:'上市'},
    {code:'00840B',name:'元大30年美國公債',market:'上市'},
    {code:'00844B',name:'中信20年美國公債',market:'上市'},
    {code:'00856B',name:'國泰AAA至A級美元公司債',market:'上市'},
    {code:'00933B',name:'國泰10Y+金融債',market:'上市'},
    {code:'00934B',name:'中信科技優先債',market:'上市'},
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
    if (!q) return [];
    const lower = q.toLowerCase();
    return _stockList.filter(s =>
      s.code.startsWith(q) || s.name.includes(q) || s.code.toLowerCase().startsWith(lower)
    ).slice(0, 8);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    await Store.load(true); // always force-refresh to pick up manual Sheet edits
    buildState();
    if (!_activeRole || !PERSONAL_ROLES().includes(_activeRole)) _activeRole = PERSONAL_ROLES()[0];
    renderPage();
    loadStockList();
  }

  function buildState() {
    _lots = Store.get().investments.map(i => ({ ...i, _deleted: false }));
  }

  // ── Merge lots into positions ──────────────────────────────────────────
  function getMergedPositions(role) {
    const map = {};
    _lots.filter(l => !l._deleted && l.role === role).forEach(l => {
      const key = `${l.account}||${l.ticker}`;
      if (!map[key]) map[key] = { role: l.role, account: l.account, ticker: l.ticker, name: l.name, lots: [], price: 0 };
      map[key].lots.push({ ...l, _si: _lots.indexOf(l) });
      if (l.price > 0) map[key].price = l.price;
    });
    return Object.values(map).map(pos => {
      const totalShares = pos.lots.reduce((s, l) => s + l.shares, 0);
      const totalCost   = pos.lots.reduce((s, l) => s + l.shares * l.avgCost, 0);
      const weightedAvg = totalShares > 0 ? totalCost / totalShares : 0;
      const marketValue = pos.price > 0 ? totalShares * pos.price : totalCost;
      const unrealized  = marketValue - totalCost;
      const returnRate  = totalCost > 0 ? unrealized / totalCost : 0;
      return { ...pos, totalShares, totalCost, weightedAvg, marketValue, unrealized, returnRate };
    }).sort((a, b) => b.marketValue - a.marketValue);
  }

  // ── Main page ──────────────────────────────────────────────────────────
  function renderPage() {
    const el = Utils.el('page-content');
    const roles = PERSONAL_ROLES();

    // Summary across all roles
    let totalMV = 0, totalCost = 0;
    roles.forEach(r => getMergedPositions(r).forEach(p => { totalMV += p.marketValue; totalCost += p.totalCost; }));
    const totalUnreal  = totalMV - totalCost;
    const totalReturn  = totalCost > 0 ? totalUnreal / totalCost : 0;
    const pnlClass     = totalUnreal >= 0 ? 'amount-in' : 'amount-out';
    const pnlArrow     = totalUnreal >= 0 ? '▲' : '▼';

    const roleTabs = roles.length > 1
      ? `<div class="inv-role-tabs">${roles.map(r =>
          `<button class="inv-role-tab${r === _activeRole ? ' active' : ''}" data-role="${r}">${r}</button>`
        ).join('')}</div>` : '';

    el.innerHTML = `<div class="page-inner">
      <div class="card invest-summary">
        <div class="invest-summary-label">投資組合總市值</div>
        <div class="invest-summary-value">${Utils.formatMoney(totalMV)}</div>
        <div class="invest-summary-pnl ${pnlClass}">
          ${pnlArrow} ${Utils.formatMoney(Math.abs(Math.round(totalUnreal)))}
          <span class="invest-summary-pct">${Utils.formatPct(totalReturn)}</span>
        </div>
        <div class="invest-summary-row">
          <span class="label-sm">總成本</span>
          <span>${Utils.formatMoney(totalCost)}</span>
          <button class="btn btn-outline btn-sm" id="btn-inv-refresh" style="margin-left:auto">更新報價</button>
        </div>
      </div>
      ${roleTabs}
      <div id="inv-role-content"></div>
      <div style="height:16px"></div>
    </div>`;

    renderRoleSection(_activeRole);

    if (roles.length > 1) {
      el.querySelectorAll('.inv-role-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          _activeRole = tab.dataset.role;
          el.querySelectorAll('.inv-role-tab').forEach(t => t.classList.toggle('active', t.dataset.role === _activeRole));
          renderRoleSection(_activeRole);
        });
      });
    }

    Utils.el('btn-inv-refresh').addEventListener('click', () => fetchPrices());
  }

  function renderRoleSection(role) {
    const container = Utils.el('inv-role-content');
    const positions  = getMergedPositions(role);
    const brokers    = Store.brokersForRole(role);

    // Group by account
    const byAccount = {};
    positions.forEach(pos => {
      if (!byAccount[pos.account]) byAccount[pos.account] = [];
      byAccount[pos.account].push(pos);
    });

    const accountSections = Object.keys(byAccount).map(acct => {
      const acctMV = byAccount[acct].reduce((s, p) => s + p.marketValue, 0);
      const rows = byAccount[acct].map(pos => {
        const ticker    = pos.ticker.replace(/^TPE:/i, '');
        const pnlClass  = pos.unrealized >= 0 ? 'amount-in' : 'amount-out';
        const pnlArrow  = pos.unrealized >= 0 ? '▲' : '▼';
        const pnlAmt    = Utils.formatMoney(Math.abs(Math.round(pos.unrealized)));
        return `<div class="inv-pos-row" data-key="${acct}||${pos.ticker}" data-role="${role}">
          <div class="inv-pos-left">
            <span class="inv-pos-name">${pos.name}</span>
            <span class="inv-pos-meta">${ticker} · ${pos.totalShares.toLocaleString()} 股</span>
          </div>
          <div class="inv-pos-right">
            <span class="inv-pos-value">${Utils.formatMoney(pos.marketValue)}</span>
            <span class="inv-pos-pnl ${pnlClass}">${pnlArrow} ${pnlAmt}（${Utils.formatPct(pos.returnRate)}）</span>
          </div>
        </div>`;
      }).join('');

      return `<div class="inv-broker-section">
        <div class="inv-broker-header">
          <span>📊 ${acct}</span>
          <span class="inv-broker-mv">${Utils.formatMoney(acctMV)}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');

    const emptyMsg = positions.length === 0
      ? `<p class="empty-hint" style="padding:12px 16px">${brokers.length ? '尚無持倉' : '請先至設定新增「證券帳戶」類型的帳戶'}</p>`
      : '';

    container.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
        ${emptyMsg}${accountSections}
      </div>
      <button class="btn btn-outline btn-add-inv" data-role="${role}" style="width:100%">＋ 新增標的</button>
    `;

    container.querySelectorAll('.inv-pos-row').forEach(row => {
      row.addEventListener('click', () => {
        const [acct, ticker] = row.dataset.key.split('||');
        const pos = getMergedPositions(row.dataset.role).find(p => p.account === acct && p.ticker === ticker);
        if (pos) showDetailSheet(pos);
      });
    });

    container.querySelector('.btn-add-inv')?.addEventListener('click', e => showAddLotModal(e.target.dataset.role));
  }

  // ── Detail bottom sheet ────────────────────────────────────────────────
  function showDetailSheet(pos) {
    const overlay = document.createElement('div');
    overlay.className = 'detail-sheet-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'detail-sheet';

    const ticker   = pos.ticker.replace(/^TPE:/i, '');
    const pnlClass = pos.unrealized >= 0 ? 'amount-in' : 'amount-out';
    const pnlArrow = pos.unrealized >= 0 ? '▲' : '▼';
    const pnlAmt   = Utils.formatMoney(Math.abs(Math.round(pos.unrealized)));

    const lotsHtml = pos.lots.map((l, i) => `
      <div class="detail-lot-row">
        <span class="detail-lot-idx">第 ${i + 1} 批</span>
        <span class="detail-lot-info">${l.shares.toLocaleString()} 股 @ $${l.avgCost.toLocaleString()}</span>
        <span class="detail-lot-cost">${Utils.formatMoney(Math.round(l.shares * l.avgCost))}</span>
      </div>`).join('');

    sheet.innerHTML = `
      <div class="detail-sheet-handle"></div>
      <div class="detail-sheet-header">
        <div>
          <div class="detail-sheet-name">${pos.name}</div>
          <div class="detail-sheet-sub">${ticker} · 📊 ${pos.account}</div>
        </div>
        <button class="detail-sheet-close" id="btn-sheet-close">✕</button>
      </div>
      <div class="detail-stats-grid">
        <div class="detail-stat"><span class="label-sm">持有股數</span><span class="detail-stat-val">${pos.totalShares.toLocaleString()} 股</span></div>
        <div class="detail-stat"><span class="label-sm">加權均價</span><span class="detail-stat-val">$${pos.weightedAvg.toFixed(2)}</span></div>
        <div class="detail-stat"><span class="label-sm">現價</span><span class="detail-stat-val">$${pos.price.toLocaleString()}</span></div>
        <div class="detail-stat"><span class="label-sm">總市值</span><span class="detail-stat-val">${Utils.formatMoney(pos.marketValue)}</span></div>
        <div class="detail-stat detail-stat-full">
          <span class="label-sm">未實現損益</span>
          <span class="detail-stat-pnl ${pnlClass}">${pnlArrow} ${pnlAmt}<span class="detail-pct">（${Utils.formatPct(pos.returnRate)}）</span></span>
        </div>
      </div>
      <div class="detail-lots-title">持倉明細（${pos.lots.length} 批）</div>
      <div class="detail-lots-list">${lotsHtml}</div>
      <div class="detail-actions">
        <button class="btn btn-outline" id="btn-add-lot">＋ 加倉</button>
        <button class="btn btn-outline" id="btn-reduce-lot">減倉</button>
        <button class="btn btn-danger" id="btn-clear-lot">清倉</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { overlay.classList.add('visible'); sheet.classList.add('visible'); });

    function close() {
      overlay.classList.remove('visible'); sheet.classList.remove('visible');
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    }

    overlay.addEventListener('click', close);
    sheet.querySelector('#btn-sheet-close').addEventListener('click', close);

    sheet.querySelector('#btn-add-lot').addEventListener('click', () => {
      close();
      showAddLotModal(pos.role, { ticker: pos.ticker, name: pos.name, account: pos.account });
    });
    sheet.querySelector('#btn-reduce-lot').addEventListener('click', () => { close(); showReduceModal(pos); });
    sheet.querySelector('#btn-clear-lot').addEventListener('click', () => {
      if (!confirm(`確定清倉「${pos.name}」所有批次？`)) return;
      pos.lots.forEach(l => { _lots[l._si]._deleted = true; });
      close();
      saveLots();
    });
  }

  // ── Add lot modal ──────────────────────────────────────────────────────
  function showAddLotModal(defaultRole, prefill = {}) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const roles    = PERSONAL_ROLES();
    const roleOpts = roles.map(r => `<option value="${r}"${r === defaultRole ? ' selected' : ''}>${r}</option>`).join('');

    function brokerOpts(role) {
      const list = Store.brokersForRole(role);
      if (!list.length) return `<option value="">（請先至設定新增證券帳戶）</option>`;
      return list.map(b => `<option value="${b}"${prefill.account === b ? ' selected' : ''}>${b}</option>`).join('');
    }

    const tickerSection = prefill.ticker
      ? `<div class="form-row"><label>標的</label>
          <div style="padding:8px 0;font-weight:600">${prefill.name}（${prefill.ticker.replace(/^TPE:/i,'')}）</div>
          <input type="hidden" id="inp-inv-ticker" value="${prefill.ticker}">
          <input type="hidden" id="inp-inv-name" value="${prefill.name}">
        </div>`
      : `<div class="form-row inv-search-wrap">
          <label>搜尋標的</label>
          <input type="text" id="inp-inv-search" class="form-input" placeholder="輸入代號或名稱" autocomplete="off">
          <div id="inv-search-dropdown" class="inv-search-dropdown hidden"></div>
        </div>
        <div class="form-row">
          <label>GOOGLEFINANCE 代號</label>
          <input type="text" id="inp-inv-ticker" class="form-input" placeholder="TPE:2330 或 AAPL">
          <p class="input-hint">台股自動加 TPE: 前綴</p>
        </div>
        <div class="form-row">
          <label>標的名稱</label>
          <input type="text" id="inp-inv-name" class="form-input" placeholder="自動填入">
        </div>`;

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">${prefill.ticker ? '加倉' : '新增標的'}</div>
      <div class="form-row"><label>角色</label>
        <select id="inp-inv-role" class="form-select">${roleOpts}</select>
      </div>
      <div class="form-row"><label>證券帳戶</label>
        <select id="inp-inv-account" class="form-select">${brokerOpts(defaultRole)}</select>
      </div>
      ${tickerSection}
      <div class="form-row"><label>買入股數</label>
        <input type="number" id="inp-inv-shares" class="form-input" placeholder="0" min="0" step="1">
      </div>
      <div class="form-row"><label>買入均價</label>
        <input type="number" id="inp-inv-avgcost" class="form-input" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-inv-confirm">${prefill.ticker ? '確認加倉' : '新增持倉'}</button>
        <button class="btn btn-outline" id="btn-inv-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-inv-cancel').addEventListener('click', () => modal.remove());
    Utils.el('inp-inv-role').addEventListener('change', () => {
      Utils.el('inp-inv-account').innerHTML = brokerOpts(Utils.el('inp-inv-role').value);
    });

    if (!prefill.ticker) {
      let _t;
      Utils.el('inp-inv-search').addEventListener('input', () => {
        clearTimeout(_t);
        _t = setTimeout(() => {
          const q = Utils.el('inp-inv-search').value.trim();
          const dd = Utils.el('inv-search-dropdown');
          const hits = searchStocks(q);
          if (!hits.length) { dd.classList.add('hidden'); return; }
          dd.innerHTML = hits.map(s =>
            `<div class="inv-search-item" data-code="${s.code}" data-name="${s.name}">
              <span class="inv-search-code">${s.code}</span>
              <span class="inv-search-name">${s.name}</span>
              <span class="inv-search-market">${s.market}</span>
            </div>`).join('');
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
        }, 200);
      });
      Utils.el('inp-inv-search').addEventListener('blur', () => {
        setTimeout(() => Utils.el('inv-search-dropdown')?.classList.add('hidden'), 150);
      });
    }

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
      if (!shares)  return Utils.toast('請輸入買入股數', 'warn');
      _lots.push({ role, account, ticker, name, shares, avgCost,
        totalCost: 0, price: 0, marketValue: 0, unrealized: 0, returnRate: 0, _deleted: false });
      modal.remove();
      saveLots();
    });
  }

  // ── Reduce modal (FIFO) ────────────────────────────────────────────────
  function showReduceModal(pos) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">減倉 — ${pos.name}</div>
      <div class="form-row">
        <label>持倉概況</label>
        <div style="padding:6px 0;color:var(--text-muted);font-size:.9rem">
          ${pos.totalShares.toLocaleString()} 股，加權均價 $${pos.weightedAvg.toFixed(2)}，共 ${pos.lots.length} 批（FIFO 順序賣出）
        </div>
      </div>
      <div class="form-row">
        <label>賣出股數 *</label>
        <input type="number" id="inp-reduce-shares" class="form-input" placeholder="0" min="1" max="${pos.totalShares}" step="1">
      </div>
      <div class="form-row">
        <label>賣出價格（選填，計算已實現損益）</label>
        <input type="number" id="inp-reduce-price" class="form-input" placeholder="${pos.price || pos.weightedAvg.toFixed(2)}" min="0" step="0.01">
      </div>
      <div id="reduce-pnl" style="display:none;padding:8px 12px;border-radius:8px;margin:4px 0;font-size:.9rem"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-reduce-confirm">確認減倉</button>
        <button class="btn btn-outline" id="btn-reduce-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-reduce-cancel').addEventListener('click', () => modal.remove());

    const sorted = [...pos.lots].sort((a, b) => a._si - b._si);

    function updatePnL() {
      const sellShares = parseFloat(Utils.el('inp-reduce-shares').value) || 0;
      const sellPrice  = parseFloat(Utils.el('inp-reduce-price').value) || 0;
      const pnlEl = Utils.el('reduce-pnl');
      if (sellShares > 0 && sellPrice > 0) {
        let rem = sellShares, fifoCost = 0;
        for (const l of sorted) {
          if (rem <= 0) break;
          const take = Math.min(l.shares, rem);
          fifoCost += take * l.avgCost;
          rem -= take;
        }
        const realized = sellShares * sellPrice - fifoCost;
        pnlEl.style.display = 'block';
        pnlEl.style.background = realized >= 0 ? 'var(--success-light)' : 'var(--danger-light)';
        pnlEl.style.color = realized >= 0 ? '#059669' : 'var(--danger)';
        pnlEl.textContent = `已實現損益：${realized >= 0 ? '+' : ''}${Utils.formatMoney(Math.round(realized))}（FIFO 成本 ${Utils.formatMoney(Math.round(fifoCost))}）`;
      } else { pnlEl.style.display = 'none'; }
    }
    Utils.el('inp-reduce-shares').addEventListener('input', updatePnL);
    Utils.el('inp-reduce-price').addEventListener('input', updatePnL);

    Utils.el('btn-reduce-confirm').addEventListener('click', () => {
      const sellShares = parseFloat(Utils.el('inp-reduce-shares').value) || 0;
      if (!sellShares || sellShares <= 0) return Utils.toast('請輸入賣出股數', 'warn');
      if (sellShares > pos.totalShares)   return Utils.toast(`最多可賣出 ${pos.totalShares} 股`, 'warn');
      let rem = sellShares;
      for (const l of sorted) {
        if (rem <= 0) break;
        const take = Math.min(l.shares, rem);
        if (take >= _lots[l._si].shares) _lots[l._si]._deleted = true;
        else _lots[l._si].shares -= take;
        rem -= take;
      }
      modal.remove();
      saveLots();
    });
  }

  // ── Price fetch via TWSE/TPEX Open API (no auth, CORS-friendly) ──────
  async function fetchPrices() {
    const btn = document.getElementById('btn-inv-refresh');
    if (btn) { btn.disabled = true; btn.textContent = '更新中…'; }

    const activeLots = _lots.filter(l => !l._deleted);
    const uniqueTickers = [...new Set(activeLots.map(l => l.ticker))];
    if (!uniqueTickers.length) {
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
      return;
    }

    // 從回應物件中取收盤價（各 API 欄位名稱不同，防禦性讀取）
    // STOCK_DAY_ALL / TPEX → ClosingPrice（英文）；MI_ETFCH_CLSPRC → 收盤價（中文）
    function px(obj) {
      const v = obj['ClosingPrice'] || obj['收盤價'] || obj['收盤'] || obj['Close'] || '';
      return parseFloat(v) || 0;
    }
    function cd(obj) {
      return (obj['Code'] || obj['證券代號'] || obj['SecuritiesCompanyCode'] ||
              obj['代號'] || obj['公司代號'] || '').trim();
    }

    const priceMap = {};

    try {
      // 兩支 Open API 並行抓取（免認證、瀏覽器可 CORS）：
      //   1. STOCK_DAY_ALL → 所有上市股票＋ETF 每日收盤行情（欄位：Code, ClosingPrice）
      //   2. tpex PE       → 上櫃股票每日收盤行情（欄位：SecuritiesCompanyCode, ClosingPrice）
      const [twseRes, tpexRes] = await Promise.allSettled([
        fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL').then(r => r.json()),
        fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis').then(r => r.json())
      ]);

      if (twseRes.status === 'fulfilled' && Array.isArray(twseRes.value)) {
        twseRes.value.forEach(s => {
          const code = cd(s), price = px(s);
          if (code && price > 0) priceMap['TPE:' + code] = price;
        });
      }
      if (tpexRes.status === 'fulfilled' && Array.isArray(tpexRes.value)) {
        tpexRes.value.forEach(s => {
          const code = cd(s), price = px(s);
          if (code && price > 0) priceMap['TPE:' + code] = price;
        });
      }

      if (!Object.keys(priceMap).length) throw new Error('兩個端點均未取得報價，可能為非交易日或網路問題');
    } catch (err) {
      Utils.toast('取得報價失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
      return;
    }

    // 更新記憶體
    _lots.forEach(l => { if (priceMap[l.ticker]) l.price = priceMap[l.ticker]; });

    // 寫回 Investments!H2:H51
    try {
      const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
      const priceRows = activeLots.map(l => [priceMap[l.ticker] || l.price || '']);
      while (priceRows.length < 50) priceRows.push(['']);
      await API.updateRange(sid, 'Investments!H2:H51', priceRows);

      Store.invalidate();
      await Store.load(true);
      buildState();
      renderPage();

      const got     = uniqueTickers.filter(t => priceMap[t]).length;
      const missing = uniqueTickers.filter(t => !priceMap[t]).map(t => t.replace(/^TPE:/i, ''));
      if (missing.length) {
        Utils.toast(`已更新 ${got} 筆，${missing.join('、')} 無法取得`, 'warn');
      } else {
        Utils.toast(`報價已更新（${got} 筆）`, 'success');
      }
    } catch (err) {
      Utils.toast('寫入失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────
  async function saveLots() {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const rows = _lots.filter(l => !l._deleted).map(l => [l.role, l.account, l.ticker, l.name, l.shares, l.avgCost]);
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
    } finally { Utils.showLoading(false); }
  }

  return { render, onMount };
})());
