Router.register('investments', (() => {
  let _lots = [];
  let _activeRole = null;
  const PERSONAL_ROLES = () => Store.personalRoleNames();

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

  // 搜尋只用內建清單：證交所／櫃買中心的開放資料不允許網頁直接跨站讀取（CORS），
  // 從瀏覽器抓一定失敗；不在清單內的標的可直接輸入代號
  const _stockList = BUILTIN_STOCKS;

  function searchStocks(q) {
    if (!q) return [];
    const lower = q.toLowerCase();
    return _stockList.filter(s =>
      s.code.startsWith(q) || s.name.includes(q) || s.code.toLowerCase().startsWith(lower)
    ).slice(0, 8);
  }

  // ── 台股交易成本（券商交割單皆為無條件捨去） ─────────────────────────────
  const FEE_RATE = 0.001425;
  function isTWTicker(ticker) {
    const t = String(ticker || '').trim();
    return /^TPE:/i.test(t) || /^\d/.test(t);
  }
  function calcFee(amount, ticker) {
    if (!isTWTicker(ticker) || amount <= 0) return 0;
    return Math.floor(amount * FEE_RATE);
  }
  // 證交稅只在賣出時收：債券 ETF（00 開頭、B 結尾）停徵、ETF（00 開頭）0.1%、股票 0.3%
  function sellTaxRate(ticker) {
    if (!isTWTicker(ticker)) return 0;
    const code = String(ticker).replace(/^TPE:/i, '').trim().toUpperCase();
    if (/^00\w*B$/.test(code)) return 0;
    if (/^00/.test(code)) return 0.001;
    return 0.003;
  }
  function calcSellTax(amount, ticker) {
    return amount > 0 ? Math.floor(amount * sellTaxRate(ticker)) : 0;
  }

  // ── 交易紀錄狀態 ─────────────────────────────────────────────────────
  let _txs = [];          // InvestTx 交易紀錄；持股由此推算
  let _sells = {};        // 賣出 ID → { cost, realized }
  let _readonly = false;  // 交易紀錄尚未建立（遷移未完成）時只顯示快照、不可編輯

  const sid = () => localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
  const codeOf = t => String(t || '').replace(/^TPE:/i, '');
  const isoDate = d => (d || '').replace(/\//g, '-');
  const slashDate = d => (d || '').replace(/-/g, '/');

  function ledgerAmount(t) {
    const amt = Math.round(t.shares * t.price);
    return t.type === '買進' ? amt + (t.fee || 0) : amt - (t.fee || 0) - (t.tax || 0);
  }
  function txMemo(t) {
    const amt = Math.round(t.shares * t.price).toLocaleString();
    return t.type === '買進'
      ? `${t.name}（${codeOf(t.ticker)}）買入 ${t.shares}股@${t.price}，成交金額 ${amt}，手續費${t.fee || 0}`
      : `${t.name}（${codeOf(t.ticker)}）賣出 ${t.shares}股@${t.price}，賣股收入 ${amt}，證交稅${t.tax || 0}，手續費${t.fee || 0}`;
  }

  // 扣款帳戶（買進）：個別信用卡合併成「信用卡」；入帳帳戶（賣出）：只限銀行／現金
  const ACCT_ICON = { '現金': '💵', '銀行': '🏦', '信用卡': '💳' };
  function payAcctList(role) {
    const all = Store.allAccountsFlat().filter(a => a.role === role && a.type !== '證券帳戶');
    const list = all.filter(a => a.type !== '信用卡');
    if (all.some(a => a.type === '信用卡')) list.push({ name: CFG.CC_GENERIC, type: '信用卡' });
    return list;
  }
  function inAcctList(role) {
    return Store.allAccountsFlat().filter(a => a.role === role && (a.type === '銀行' || a.type === '現金'));
  }
  function acctOpts(list, selected) {
    if (!list.length) return `<option value="">（無可用帳戶）</option>`;
    return list.map(a => `<option value="${Utils.esc(a.name)}"${a.name === selected ? ' selected' : ''}>${ACCT_ICON[a.type] || '🏦'} ${Utils.esc(a.name)}</option>`).join('');
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
  }

  function buildState() {
    const { investments, investTx } = Store.get();
    const priceMap = {};
    investments.forEach(i => { if (i.price > 0) priceMap[i.ticker] = i.price; });
    _readonly = !(investTx || []).length && investments.length > 0;
    if (_readonly) { _txs = []; _sells = {}; _lots = investments.map(i => ({ ...i })); return; }
    _txs = investTx.map(t => ({ ...t }));
    const d = Store.deriveHoldings(_txs);
    _sells = d.sells;
    _lots = d.holdings.map(h => ({ ...h, price: priceMap[h.ticker] || 0 }));
  }

  // 寫回交易紀錄與持股快照（持股快照沿用目前已知的現價）
  async function persistTxs(newTxs) {
    const priceMap = {};
    _lots.forEach(l => { if (l.price > 0) priceMap[l.ticker] = l.price; });
    const d = Store.deriveHoldings(newTxs);
    await Store.saveInvestTx(newTxs);
    await Store.saveHoldingsSnapshot(d.holdings.map(h => ({ ...h, price: priceMap[h.ticker] || 0 })));
  }

  async function reloadPage() {
    Store.invalidate();
    await Store.load(true);
    buildState();
    renderPage();
  }

  // ── Merge lots into positions ──────────────────────────────────────────
  function getMergedPositions(role) {
    const map = {};
    _lots.filter(l => l.role === role).forEach(l => {
      const key = `${l.account}||${l.ticker}`;
      if (!map[key]) map[key] = { role: l.role, account: l.account, ticker: l.ticker, name: l.name, lots: [], price: 0 };
      map[key].lots.push(l);
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

  // ── 交易明細列表（新到舊；未填日期的排最後） ───────────────────────────
  function sortTxsDesc(list) {
    return list.map(t => ({ t, i: _txs.indexOf(t) }))
      .sort((a, b) => (b.t.date || '').localeCompare(a.t.date || '') || b.i - a.i)
      .map(x => x.t);
  }
  function txRowHtml(t, showName = true) {
    const s = _sells[t.id];
    const pnl = s ? `<span class="${s.realized >= 0 ? 'amount-in' : 'amount-out'}">損益 ${s.realized >= 0 ? '+' : '-'}${Utils.formatMoney(Math.abs(Math.round(s.realized)))}</span>` : '';
    return `<div class="inv-tx-row" data-tx="${Utils.esc(t.id)}">
      <div class="inv-tx-main">
        <span class="inv-tx-type ${t.type === '買進' ? 'buy' : 'sell'}">${t.type}</span>
        <span class="inv-tx-name">${showName ? `${Utils.esc(t.name)}（${Utils.esc(codeOf(t.ticker))}）` : `${t.shares.toLocaleString()} 股 @ ${t.price}`}</span>
        <span class="inv-tx-amt">${Utils.formatMoney(ledgerAmount(t))}</span>
      </div>
      <div class="inv-tx-sub">
        <span>${t.date ? Utils.esc(t.date) : '日期未填'}</span>
        ${showName ? `<span>${t.shares.toLocaleString()} 股 @ ${t.price}</span>` : ''}
        ${t.ledgerId ? '<span class="inv-tx-linked">📒 已連帳本</span>' : ''}
        ${pnl}
      </div>
    </div>`;
  }
  function wireTxRows(root, onOpen) {
    root.querySelectorAll('.inv-tx-row').forEach(row => row.addEventListener('click', () => {
      const t = _txs.find(x => x.id === row.dataset.tx);
      if (t) { onOpen && onOpen(); showTxEditModal(t); }
    }));
  }

  // ── Main page ──────────────────────────────────────────────────────────
  function renderPage() {
    const el = Utils.el('page-content');
    const roles = PERSONAL_ROLES();

    let totalMV = 0, totalCost = 0;
    roles.forEach(r => getMergedPositions(r).forEach(p => { totalMV += p.marketValue; totalCost += p.totalCost; }));
    const totalUnreal  = totalMV - totalCost;
    const totalReturn  = totalCost > 0 ? totalUnreal / totalCost : 0;
    const pnlClass     = totalUnreal >= 0 ? 'amount-in' : 'amount-out';
    const pnlArrow     = totalUnreal >= 0 ? '▲' : '▼';

    const roleTabs = roles.length > 1
      ? `<div class="inv-role-tabs">${roles.map(r =>
          `<button class="inv-role-tab${r === _activeRole ? ' active' : ''}" data-role="${Utils.esc(r)}">${Utils.esc(r)}</button>`
        ).join('')}</div>` : '';

    el.innerHTML = `<div class="page-inner">
      ${_readonly ? '<div class="card inv-readonly-hint">交易紀錄還在建立中，目前只能檢視。請關掉 app 重新打開後再編輯。</div>' : ''}
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

    const byAccount = {};
    positions.forEach(pos => {
      if (!byAccount[pos.account]) byAccount[pos.account] = [];
      byAccount[pos.account].push(pos);
    });

    const accountSections = Object.keys(byAccount).map(acct => {
      const acctMV = byAccount[acct].reduce((s, p) => s + p.marketValue, 0);
      const rows = byAccount[acct].map(pos => {
        const pnlClass  = pos.unrealized >= 0 ? 'amount-in' : 'amount-out';
        const pnlArrow  = pos.unrealized >= 0 ? '▲' : '▼';
        const pnlAmt    = Utils.formatMoney(Math.abs(Math.round(pos.unrealized)));
        return `<div class="inv-pos-row" data-key="${Utils.esc(acct)}||${Utils.esc(pos.ticker)}" data-role="${Utils.esc(role)}">
          <div class="inv-pos-left">
            <span class="inv-pos-name">${Utils.esc(pos.name)}</span>
            <span class="inv-pos-meta">${Utils.esc(codeOf(pos.ticker))} · ${pos.totalShares.toLocaleString()} 股</span>
          </div>
          <div class="inv-pos-right">
            <span class="inv-pos-value">${Utils.formatMoney(pos.marketValue)}</span>
            <span class="inv-pos-pnl ${pnlClass}">${pnlArrow} ${pnlAmt}（${Utils.formatPct(pos.returnRate)}）</span>
          </div>
        </div>`;
      }).join('');

      return `<div class="inv-broker-section">
        <div class="inv-broker-header">
          <span>📊 ${Utils.esc(acct)}</span>
          <span class="inv-broker-mv">${Utils.formatMoney(acctMV)}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');

    const emptyMsg = positions.length === 0
      ? `<p class="empty-hint" style="padding:12px 16px">${brokers.length ? '尚無持倉' : '請先至設定新增「證券帳戶」類型的帳戶'}</p>`
      : '';

    // 全部交易明細（含已賣光的標的），點一筆即可編輯／刪除
    const roleTxs = sortTxsDesc(_txs.filter(t => t.role === role));
    const txSection = roleTxs.length ? `
      <details class="card inv-tx-card">
        <summary class="inv-tx-summary">📜 交易明細<span class="inv-tx-count">${roleTxs.length}</span></summary>
        <div class="inv-tx-list">${roleTxs.map(t => txRowHtml(t)).join('')}</div>
      </details>` : '';

    container.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
        ${emptyMsg}${accountSections}
      </div>
      ${_readonly ? '' : `<button class="btn btn-outline btn-add-inv" data-role="${Utils.esc(role)}" style="width:100%;margin-bottom:10px">＋ 新增標的</button>`}
      ${txSection}
    `;

    container.querySelectorAll('.inv-pos-row').forEach(row => {
      row.addEventListener('click', () => {
        const [acct, ticker] = row.dataset.key.split('||');
        const pos = getMergedPositions(row.dataset.role).find(p => p.account === acct && p.ticker === ticker);
        if (pos) showDetailSheet(pos);
      });
    });
    wireTxRows(container);
    container.querySelector('.btn-add-inv')?.addEventListener('click', e => showAddLotModal(e.target.dataset.role));
  }

  // ── Detail bottom sheet ────────────────────────────────────────────────
  function showDetailSheet(pos) {
    const overlay = document.createElement('div');
    overlay.className = 'detail-sheet-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'detail-sheet';

    const pnlClass = pos.unrealized >= 0 ? 'amount-in' : 'amount-out';
    const pnlArrow = pos.unrealized >= 0 ? '▲' : '▼';
    const pnlAmt   = Utils.formatMoney(Math.abs(Math.round(pos.unrealized)));

    const lotsHtml = pos.lots.map((l, i) => `
      <div class="detail-lot-row">
        <span class="detail-lot-idx">第 ${i + 1} 批</span>
        <span class="detail-lot-info">${l.shares.toLocaleString()} 股 @ $${l.avgCost.toLocaleString()}</span>
        <span class="detail-lot-cost">${Utils.formatMoney(Math.round(l.shares * l.avgCost))}</span>
      </div>`).join('');

    const posTxs = sortTxsDesc(_txs.filter(t => t.role === pos.role && t.account === pos.account && t.ticker === pos.ticker));

    sheet.innerHTML = `
      <div class="detail-sheet-handle"></div>
      <div class="detail-sheet-header">
        <div>
          <div class="detail-sheet-name">${Utils.esc(pos.name)}</div>
          <div class="detail-sheet-sub">${Utils.esc(codeOf(pos.ticker))} · 📊 ${Utils.esc(pos.account)}</div>
        </div>
        <button class="detail-sheet-close" id="btn-sheet-close">✕</button>
      </div>
      <div class="detail-stats-grid">
        <div class="detail-stat"><span class="label-sm">持有股數</span><span class="detail-stat-val">${pos.totalShares.toLocaleString()} 股</span></div>
        <div class="detail-stat"><span class="label-sm">加權均價</span><span class="detail-stat-val">$${pos.weightedAvg.toFixed(2)}</span></div>
        <div class="detail-stat"><span class="label-sm">現價</span><span class="detail-stat-val">$${pos.price.toFixed(2)}</span></div>
        <div class="detail-stat"><span class="label-sm">總市值</span><span class="detail-stat-val">${Utils.formatMoney(pos.marketValue)}</span></div>
        <div class="detail-stat detail-stat-full">
          <span class="label-sm">未實現損益</span>
          <span class="detail-stat-pnl ${pnlClass}">${pnlArrow} ${pnlAmt}<span class="detail-pct">（${Utils.formatPct(pos.returnRate)}）</span></span>
        </div>
      </div>
      <div class="detail-lots-title">持倉明細（${pos.lots.length} 批）</div>
      <div class="detail-lots-list">${lotsHtml}</div>
      ${posTxs.length ? `<div class="detail-lots-title">交易明細（點一筆可編輯）</div>
      <div class="inv-tx-list">${posTxs.map(t => txRowHtml(t, false)).join('')}</div>` : ''}
      ${_readonly ? '' : `<div class="detail-actions">
        <button class="btn btn-outline" id="btn-add-lot">＋ 加倉</button>
        <button class="btn btn-outline" id="btn-reduce-lot">減倉</button>
        <button class="btn btn-outline" id="btn-sell-all">全部賣出</button>
      </div>`}
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
    wireTxRows(sheet, close);
    sheet.querySelector('#btn-add-lot')?.addEventListener('click', () => {
      close();
      showAddLotModal(pos.role, { ticker: pos.ticker, name: pos.name, account: pos.account });
    });
    sheet.querySelector('#btn-reduce-lot')?.addEventListener('click', () => { close(); showReduceModal(pos); });
    sheet.querySelector('#btn-sell-all')?.addEventListener('click', () => { close(); showReduceModal(pos, pos.totalShares); });
  }

  // ── Add lot modal（買進：建立交易＋帳本「投資儲蓄」支出） ───────────────
  function showAddLotModal(defaultRole, prefill = {}) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const roles    = PERSONAL_ROLES();
    const roleOpts = roles.map(r => `<option value="${Utils.esc(r)}"${r === defaultRole ? ' selected' : ''}>${Utils.esc(r)}</option>`).join('');
    const today = isoDate(Utils.todayStr());

    function brokerOpts(role) {
      const list = Store.brokersForRole(role);
      if (!list.length) return `<option value="">（請先至設定新增證券帳戶）</option>`;
      return list.map(b => `<option value="${Utils.esc(b)}"${prefill.account === b ? ' selected' : ''}>${Utils.esc(b)}</option>`).join('');
    }

    const tickerSection = prefill.ticker
      ? `<div class="form-row"><label>標的</label>
          <div style="padding:8px 0;font-weight:600">${Utils.esc(prefill.name)}（${Utils.esc(codeOf(prefill.ticker))}）</div>
          <input type="hidden" id="inp-inv-ticker" value="${Utils.esc(prefill.ticker)}">
          <input type="hidden" id="inp-inv-name" value="${Utils.esc(prefill.name)}">
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
      <div class="form-row"><label>買入日期</label>
        <input type="date" id="inp-inv-date" class="form-input" value="${today}">
      </div>
      <div class="form-row"><label>扣款帳戶</label>
        <select id="inp-inv-pay-account" class="form-select">${acctOpts(payAcctList(defaultRole))}</select>
      </div>
      <p class="input-hint">實際扣款（價金＋手續費）將同步記一筆「投資儲蓄」支出</p>
      <div class="form-row"><label>買入股數</label>
        <input type="number" id="inp-inv-shares" class="form-input" placeholder="0" min="0" step="1">
      </div>
      <div class="form-row"><label>成交價</label>
        <input type="number" id="inp-inv-avgcost" class="form-input" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-row"><label>手續費</label>
        <input type="number" id="inp-inv-fee" class="form-input" placeholder="0" min="0" step="1">
        <p class="input-hint">依 0.1425% 自動試算，與交割單不同可直接修改</p>
      </div>
      <div id="inv-buy-summary" class="inv-trade-summary" style="display:none"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-inv-confirm">${prefill.ticker ? '確認加倉' : '新增持倉'}</button>
        <button class="btn btn-outline" id="btn-inv-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-inv-cancel').addEventListener('click', () => modal.remove());
    Utils.el('inp-inv-role').addEventListener('change', () => {
      const role = Utils.el('inp-inv-role').value;
      Utils.el('inp-inv-account').innerHTML = brokerOpts(role);
      Utils.el('inp-inv-pay-account').innerHTML = acctOpts(payAcctList(role));
    });

    // 手續費自動試算；使用者手動改過就不再覆蓋
    let feeTouched = false;
    function updateBuySummary() {
      const shares = parseFloat(Utils.el('inp-inv-shares').value) || 0;
      const price  = parseFloat(Utils.el('inp-inv-avgcost').value) || 0;
      const amount = Math.round(shares * price);
      const ticker = Utils.el('inp-inv-ticker').value.trim();
      if (!feeTouched) Utils.el('inp-inv-fee').value = amount > 0 ? calcFee(amount, ticker) : '';
      const fee = parseFloat(Utils.el('inp-inv-fee').value) || 0;
      const box = Utils.el('inv-buy-summary');
      if (amount <= 0) { box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.innerHTML = `價金 ${Utils.formatMoney(amount)} ＋ 手續費 ${Utils.formatMoney(fee)}
        ＝ 實際扣款 <b>${Utils.formatMoney(amount + fee)}</b><br>
        <span class="inv-trade-sub">持股成本均價 $${((amount + fee) / shares).toFixed(2)}</span>`;
    }
    Utils.el('inp-inv-shares').addEventListener('input', updateBuySummary);
    Utils.el('inp-inv-avgcost').addEventListener('input', updateBuySummary);
    Utils.el('inp-inv-ticker').addEventListener('change', updateBuySummary);
    Utils.el('inp-inv-fee').addEventListener('input', () => { feeTouched = true; updateBuySummary(); });

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
            `<div class="inv-search-item" data-code="${Utils.esc(s.code)}" data-name="${Utils.esc(s.name)}">
              <span class="inv-search-code">${Utils.esc(s.code)}</span>
              <span class="inv-search-name">${Utils.esc(s.name)}</span>
              <span class="inv-search-market">${Utils.esc(s.market)}</span>
            </div>`).join('');
          dd.classList.remove('hidden');
          dd.querySelectorAll('.inv-search-item').forEach(item => {
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              Utils.el('inp-inv-ticker').value = 'TPE:' + item.dataset.code;
              Utils.el('inp-inv-name').value = item.dataset.name;
              Utils.el('inp-inv-search').value = `${item.dataset.code}　${item.dataset.name}`;
              dd.classList.add('hidden');
              updateBuySummary();
            });
          });
        }, 200);
      });
      Utils.el('inp-inv-search').addEventListener('blur', () => {
        setTimeout(() => Utils.el('inv-search-dropdown')?.classList.add('hidden'), 150);
      });
    }

    Utils.el('btn-inv-confirm').addEventListener('click', async () => {
      const role       = Utils.el('inp-inv-role').value;
      const account    = Utils.el('inp-inv-account').value;
      const ticker     = Utils.el('inp-inv-ticker').value.trim();
      const name       = Utils.el('inp-inv-name').value.trim();
      const date       = slashDate(Utils.el('inp-inv-date').value);
      const shares     = parseFloat(Utils.el('inp-inv-shares').value) || 0;
      const price      = parseFloat(Utils.el('inp-inv-avgcost').value) || 0;
      const fee        = Math.max(0, Math.round(parseFloat(Utils.el('inp-inv-fee').value) || 0));
      const payAccount = Utils.el('inp-inv-pay-account')?.value || '';
      if (!account)    return Utils.toast('請先至設定新增證券帳戶', 'warn');
      if (!ticker)     return Utils.toast('請選擇標的或輸入代號', 'warn');
      if (!name)       return Utils.toast('請輸入標的名稱', 'warn');
      if (!date)       return Utils.toast('請選擇買入日期', 'warn');
      if (!shares)     return Utils.toast('請輸入買入股數', 'warn');
      if (!price)      return Utils.toast('請輸入成交價', 'warn');
      if (!payAccount) return Utils.toast('請選擇扣款帳戶', 'warn');

      const tx = { id: Utils.uid(), date, type: '買進', role, account, ticker, name, shares, price, fee, tax: 0, ledgerId: Utils.uid() };
      const row = [tx.ledgerId, role, '日常', '', '支出', '投資儲蓄', Utils.sheetText(txMemo(tx)), date, ledgerAmount(tx),
                   payAccount, '', '', '', '', ''];
      modal.remove();
      Utils.showLoading(true);
      try {
        await API.append(sid(), 'Ledger!A:O', row);
        await persistTxs([..._txs, tx]);
        Utils.toast('已買進並記入帳本', 'success');
      } catch (e) {
        Utils.toast('儲存失敗：' + e.message, 'error');
      } finally {
        Utils.showLoading(false);
      }
      await reloadPage();
    });
  }

  // ── Reduce modal（賣出：建立交易＋帳本「投資賣出」收入，FIFO 扣批次） ────
  function showReduceModal(pos, presetShares = 0) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const taxRate = sellTaxRate(pos.ticker);
    const taxHint = !isTWTicker(pos.ticker) ? '非台股不自動試算'
      : taxRate === 0 ? '債券 ETF 證交稅停徵' : `證交稅 ${(taxRate * 100).toFixed(1)}%`;
    const today = isoDate(Utils.todayStr());

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">${presetShares ? '全部賣出' : '減倉'} — ${Utils.esc(pos.name)}</div>
      <div class="form-row">
        <label>持倉概況</label>
        <div style="padding:6px 0;color:var(--text-muted);font-size:.9rem">
          ${pos.totalShares.toLocaleString()} 股，加權均價 $${pos.weightedAvg.toFixed(2)}，共 ${pos.lots.length} 批（FIFO 順序賣出）
        </div>
      </div>
      <div class="form-row"><label>賣出日期</label>
        <input type="date" id="inp-reduce-date" class="form-input" value="${today}">
      </div>
      <div class="form-row">
        <label>賣出股數 *</label>
        <input type="number" id="inp-reduce-shares" class="form-input" placeholder="0" min="1" max="${pos.totalShares}" step="1" value="${presetShares || ''}">
      </div>
      <div class="form-row">
        <label>成交價 *</label>
        <input type="number" id="inp-reduce-price" class="form-input" placeholder="${pos.price || pos.weightedAvg.toFixed(2)}" min="0" step="0.01">
      </div>
      <div class="form-row"><label>入帳帳戶 *</label>
        <select id="inp-reduce-in-account" class="form-select">${acctOpts(inAcctList(pos.role))}</select>
      </div>
      <div class="inv-fee-grid">
        <div class="form-row"><label>手續費</label>
          <input type="number" id="inp-reduce-fee" class="form-input" placeholder="0" min="0" step="1">
        </div>
        <div class="form-row"><label>證交稅</label>
          <input type="number" id="inp-reduce-tax" class="form-input" placeholder="0" min="0" step="1">
        </div>
      </div>
      <p class="input-hint">手續費 0.1425%、${taxHint}，自動試算可直接修改；淨入帳將記一筆「投資賣出」收入</p>
      <div id="reduce-pnl" class="inv-trade-summary" style="display:none"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-reduce-confirm">確認賣出</button>
        <button class="btn btn-outline" id="btn-reduce-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-reduce-cancel').addEventListener('click', () => modal.remove());

    let feeTouched = false, taxTouched = false;
    function readTrade() {
      const shares = parseFloat(Utils.el('inp-reduce-shares').value) || 0;
      const price  = parseFloat(Utils.el('inp-reduce-price').value) || 0;
      const fee = Math.max(0, Math.round(parseFloat(Utils.el('inp-reduce-fee').value) || 0));
      const tax = Math.max(0, Math.round(parseFloat(Utils.el('inp-reduce-tax').value) || 0));
      const date = slashDate(Utils.el('inp-reduce-date').value);
      return { id: '__preview', date, type: '賣出', role: pos.role, account: pos.account, ticker: pos.ticker, name: pos.name,
               shares, price, fee, tax, ledgerId: '' };
    }
    function updatePnL() {
      const pre = readTrade();
      const amount = Math.round(pre.shares * pre.price);
      if (!feeTouched) Utils.el('inp-reduce-fee').value = amount > 0 ? calcFee(amount, pos.ticker) : '';
      if (!taxTouched) Utils.el('inp-reduce-tax').value = amount > 0 ? calcSellTax(amount, pos.ticker) : '';
      const t = readTrade();
      const pnlEl = Utils.el('reduce-pnl');
      if (t.shares > 0 && t.price > 0) {
        const s = Store.deriveHoldings([..._txs, t]).sells[t.id];
        pnlEl.style.display = 'block';
        pnlEl.innerHTML = `價金 ${Utils.formatMoney(Math.round(t.shares * t.price))} − 手續費 ${Utils.formatMoney(t.fee)} − 證交稅 ${Utils.formatMoney(t.tax)}
          ＝ 淨入帳 <b>${Utils.formatMoney(ledgerAmount(t))}</b><br>
          <span class="${s.realized >= 0 ? 'amount-in' : 'amount-out'}">已實現損益：${s.realized >= 0 ? '+' : '-'}${Utils.formatMoney(Math.abs(Math.round(s.realized)))}</span>
          <span class="inv-trade-sub">（FIFO 成本 ${Utils.formatMoney(Math.round(s.cost))}）</span>`;
      } else { pnlEl.style.display = 'none'; }
    }
    Utils.el('inp-reduce-shares').addEventListener('input', updatePnL);
    Utils.el('inp-reduce-price').addEventListener('input', updatePnL);
    Utils.el('inp-reduce-date').addEventListener('change', updatePnL);
    Utils.el('inp-reduce-fee').addEventListener('input', () => { feeTouched = true; updatePnL(); });
    Utils.el('inp-reduce-tax').addEventListener('input', () => { taxTouched = true; updatePnL(); });
    if (presetShares) updatePnL();

    Utils.el('btn-reduce-confirm').addEventListener('click', async () => {
      const t = readTrade();
      const inAccount = Utils.el('inp-reduce-in-account').value;
      if (!t.date)                      return Utils.toast('請選擇賣出日期', 'warn');
      if (!t.shares || t.shares <= 0)   return Utils.toast('請輸入賣出股數', 'warn');
      if (!t.price || t.price <= 0)     return Utils.toast('請輸入成交價', 'warn');
      if (!inAccount)                   return Utils.toast('請選擇入帳帳戶', 'warn');
      if (ledgerAmount(t) < 0)          return Utils.toast('手續費與證交稅超過價金，請確認金額', 'warn');
      t.id = Utils.uid();
      t.ledgerId = Utils.uid();
      const newTxs = [..._txs, t];
      if (Store.deriveHoldings(newTxs).errors.includes(t.id)) return Utils.toast('賣出股數超過這個日期當時的持股', 'warn');

      const row = [t.ledgerId, pos.role, '日常', '', '收入', CFG.CAT_INVEST_SELL, Utils.sheetText(txMemo(t)), t.date, ledgerAmount(t),
                   inAccount, '', '', '', '', ''];
      modal.remove();
      Utils.showLoading(true);
      try {
        await API.append(sid(), 'Ledger!A:O', row);
        await persistTxs(newTxs);
        Utils.toast('已賣出並記入帳本', 'success');
      } catch (e) {
        Utils.toast('儲存失敗：' + e.message, 'error');
      } finally {
        Utils.showLoading(false);
      }
      await reloadPage();
    });
  }

  // ── 編輯／刪除交易：有連帳本的同步更新或刪除帳本那一筆 ─────────────────
  function showTxEditModal(t) {
    if (_readonly) return;
    const isBuy = t.type === '買進';
    const lt = t.ledgerId ? Store.get().ledger.find(x => x.id === t.ledgerId) : null;
    const acctList = isBuy ? payAcctList(t.role) : inAcctList(t.role);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">編輯${t.type} — ${Utils.esc(t.name)}（${Utils.esc(codeOf(t.ticker))}）</div>
      <p class="input-hint" style="margin-top:0">📊 ${Utils.esc(t.account)}${t.ledgerId
        ? (lt ? ' · 📒 已連帳本，存檔會同步更新帳本那一筆' : ' · ⚠ 帳本找不到對應紀錄（可能已在帳本頁刪除）')
        : ' · 沒有對應的帳本紀錄，只會修改投資資料'}</p>
      <div class="form-row"><label>日期${lt ? ' *' : ''}</label>
        <input type="date" id="inp-tx-date" class="form-input" value="${isoDate(t.date)}">
      </div>
      <div class="form-row"><label>股數 *</label>
        <input type="number" id="inp-tx-shares" class="form-input" min="0" step="1" value="${t.shares}">
      </div>
      <div class="form-row"><label>成交價 *</label>
        <input type="number" id="inp-tx-price" class="form-input" min="0" step="0.01" value="${t.price}">
      </div>
      <div class="inv-fee-grid">
        <div class="form-row"><label>手續費</label>
          <input type="number" id="inp-tx-fee" class="form-input" min="0" step="1" value="${t.fee || 0}">
        </div>
        ${isBuy ? '' : `<div class="form-row"><label>證交稅</label>
          <input type="number" id="inp-tx-tax" class="form-input" min="0" step="1" value="${t.tax || 0}">
        </div>`}
      </div>
      ${lt ? `<div class="form-row"><label>${isBuy ? '扣款帳戶' : '入帳帳戶'}</label>
        <select id="inp-tx-acct" class="form-select">${acctOpts(acctList.some(a => a.name === lt.accountOut) ? acctList : [{ name: lt.accountOut, type: '' }, ...acctList], lt.accountOut)}</select>
      </div>` : ''}
      <div id="tx-edit-summary" class="inv-trade-summary"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-tx-save">儲存</button>
        <button class="btn btn-danger" id="btn-tx-delete">刪除</button>
        <button class="btn btn-outline" id="btn-tx-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-tx-cancel').addEventListener('click', () => modal.remove());

    function readEdit() {
      return { ...t,
        date:   slashDate(Utils.el('inp-tx-date').value),
        shares: parseFloat(Utils.el('inp-tx-shares').value) || 0,
        price:  parseFloat(Utils.el('inp-tx-price').value) || 0,
        fee:    Math.max(0, Math.round(parseFloat(Utils.el('inp-tx-fee').value) || 0)),
        tax:    isBuy ? 0 : Math.max(0, Math.round(parseFloat(Utils.el('inp-tx-tax').value) || 0)) };
    }
    function updateSummary() {
      const u = readEdit();
      const amt = Math.round(u.shares * u.price);
      Utils.el('tx-edit-summary').innerHTML = isBuy
        ? `價金 ${Utils.formatMoney(amt)} ＋ 手續費 ${Utils.formatMoney(u.fee)} ＝ 實際扣款 <b>${Utils.formatMoney(ledgerAmount(u))}</b>`
        : `價金 ${Utils.formatMoney(amt)} − 手續費 ${Utils.formatMoney(u.fee)} − 證交稅 ${Utils.formatMoney(u.tax)} ＝ 淨入帳 <b>${Utils.formatMoney(ledgerAmount(u))}</b>`;
    }
    modal.querySelectorAll('input').forEach(i => i.addEventListener('input', updateSummary));
    updateSummary();

    Utils.el('btn-tx-save').addEventListener('click', async () => {
      const u = readEdit();
      if (!u.shares || u.shares <= 0) return Utils.toast('請輸入股數', 'warn');
      if (!u.price || u.price <= 0)   return Utils.toast('請輸入成交價', 'warn');
      if (lt && !u.date)              return Utils.toast('有連帳本的交易需要日期', 'warn');
      if (!isBuy && ledgerAmount(u) < 0) return Utils.toast('手續費與證交稅超過價金，請確認金額', 'warn');
      const newTxs = _txs.map(x => x.id === t.id ? u : x);
      if (Store.deriveHoldings(newTxs).errors.length) return Utils.toast('這樣改會讓某筆賣出的股數超過當時持股，請確認股數或日期', 'warn');
      if (t.ledgerId && !lt) {
        if (!confirm('帳本找不到這筆交易對應的紀錄，只更新投資資料（並取消連結）？')) return;
        u.ledgerId = '';
      }
      modal.remove();
      Utils.showLoading(true);
      try {
        if (lt) {
          if (!await Store.verifyLedgerRows([{ row: lt._row, id: lt.id }])) {
            Utils.toast('帳本資料已被其他裝置變動，已重新載入，請再操作一次', 'warn');
            return;
          }
          const acct = Utils.el('inp-tx-acct')?.value || lt.accountOut;
          await API.batchUpdateValues(sid(), [{ range: `Ledger!G${lt._row}:J${lt._row}`,
            values: [[Utils.sheetText(txMemo(u)), u.date, ledgerAmount(u), acct]] }]);
        }
        await persistTxs(newTxs);
        Utils.toast(lt ? '已更新交易與帳本' : '已更新交易', 'success');
      } catch (e) {
        Utils.toast('儲存失敗：' + e.message, 'error');
      } finally {
        Utils.showLoading(false);
        await reloadPage();
      }
    });

    Utils.el('btn-tx-delete').addEventListener('click', async () => {
      const newTxs = _txs.filter(x => x.id !== t.id);
      if (Store.deriveHoldings(newTxs).errors.length) return Utils.toast('刪掉這筆後，之後的賣出會超過持股，請先刪除相關的賣出', 'warn');
      const msg = lt
        ? `刪除這筆${t.type}，並一併刪除帳本 ${lt.date}「${lt.memo || lt.category}」${Utils.formatMoney(lt.amount)}？`
        : `刪除這筆${t.type}（${t.shares} 股 @ ${t.price}）？`;
      if (!confirm(msg)) return;
      modal.remove();
      Utils.showLoading(true);
      try {
        if (lt) {
          if (!await Store.verifyLedgerRows([{ row: lt._row, id: lt.id }])) {
            Utils.toast('帳本資料已被其他裝置變動，已重新載入，請再操作一次', 'warn');
            return;
          }
          await Store.ensureSheetMeta();
          const sheetId = Store.getSheetId('Ledger');
          await API.batchUpdate(sid(), [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: lt._row - 1, endIndex: lt._row } } }]);
        }
        await persistTxs(newTxs);
        Utils.toast(lt ? '已刪除交易與帳本紀錄' : '已刪除交易', 'success');
      } catch (e) {
        Utils.toast('刪除失敗：' + e.message, 'error');
      } finally {
        Utils.showLoading(false);
        await reloadPage();
      }
    });
  }

  // ── Price fetch via Cloudflare Worker → Yahoo Finance ─────────────────
  async function fetchPrices() {
    const btn = document.getElementById('btn-inv-refresh');
    if (btn) { btn.disabled = true; btn.textContent = '更新中…'; }

    const uniqueTickers = [...new Set(_lots.map(l => l.ticker))];
    if (!uniqueTickers.length) {
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
      return;
    }

    // ticker 格式是 "TPE:2330"；Worker 接受純代號（不含 .TW），內部自行加 .TW 查 Yahoo Finance
    const yahooSymbols = uniqueTickers.map(codeOf).join(',');

    const priceMap = {}; // { 'TPE:2330': 980 }
    try {
      const res = await fetch(`${CFG.QUOTE_PROXY}?symbols=${encodeURIComponent(yahooSymbols)}`);
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      const data = await res.json(); // { "2330": 980.0, "00878": 21.5 }
      Object.entries(data).forEach(([code, price]) => {
        if (price > 0) priceMap['TPE:' + code] = price;
      });
    } catch (err) {
      Utils.toast('取得報價失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
      return;
    }

    if (!Object.keys(priceMap).length) {
      const dow = new Date().getDay();
      const reason = (dow === 0 || dow === 6) ? '今日為假日' : 'API 無資料（可能為休市）';
      Utils.toast(`無法取得報價（${reason}），顯示上次記錄`, 'warn');
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
      return;
    }

    _lots.forEach(l => { if (priceMap[l.ticker]) l.price = priceMap[l.ticker]; });

    try {
      if (_readonly) {
        // 交易紀錄尚未建立：沿用原本依列序回寫 H 欄
        const priceRows = _lots.map(l => [l.price ? parseFloat(l.price).toFixed(2) : '']);
        await API.updateRange(sid(), `Investments!H2:H${1 + priceRows.length}`, priceRows);
      } else {
        await Store.saveHoldingsSnapshot(_lots);
      }
      await reloadPage();
      const got     = uniqueTickers.filter(t => priceMap[t]).length;
      const missing = uniqueTickers.filter(t => !priceMap[t]).map(codeOf);
      if (missing.length) Utils.toast(`已更新 ${got} 筆，${missing.join('、')} 無法取得`, 'warn');
      else Utils.toast(`報價已更新（${got} 筆）`, 'success');
    } catch (err) {
      Utils.toast('寫入失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '更新報價'; }
    }
  }

  return { render, onMount };
})());
