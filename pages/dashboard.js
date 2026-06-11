Router.register('dashboard', (() => {
  let _role   = '全部';
  let _period = 'month';
  let _month  = '';
  let _year   = 0;
  let _ver    = localStorage.getItem('ff_dash_ver') || 'v1'; // v1=分析版 v2=卡片版
  let _openAcct = false;
  let _openProj = true;

  const COLORS = ['#5B8DEF', '#FF8A65', '#34C99A', '#FFC757', '#A78BFA', '#F472B6', '#94A3B8'];

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const now = new Date();
    if (!_month) _month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if (!_year)  _year  = now.getFullYear();
    await Store.load();
    renderAll();
  }

  // ── 共用計算 ──────────────────────────────────────────────────────────────
  function byRole(ledger) {
    if (_role === '全部') return ledger;
    return ledger.filter(tx => tx.roleOut === _role || tx.roleIn === _role);
  }

  // 統一以斜線格式比對（Ledger 日期存為 2026/06/10，_month 為 2026-06）
  function normDate(d) { return d.replace(/-/g, '/'); }

  function periodTxs(ledger) {
    if (_period === 'month') {
      const prefix = normDate(_month); // '2026-06' → '2026/06'
      return byRole(ledger).filter(tx => tx.date.startsWith(prefix));
    }
    return byRole(ledger).filter(tx => tx.date.startsWith(String(_year)));
  }

  function sumIO(txs) {
    let income = 0, expense = 0;
    txs.forEach(tx => {
      if (tx.type === '收入' && (_role === '全部' || tx.roleOut === _role)) income  += tx.amount;
      if (tx.type === '支出' && (_role === '全部' || tx.roleOut === _role)) expense += tx.amount;
    });
    return { income, expense };
  }

  function catData(txs, topN = 5) {
    const map = {};
    txs.filter(t => t.type === '支出' && (_role === '全部' || t.roleOut === _role))
       .forEach(t => {
         const c = t.category || (t.projectTag ? `📁${t.projectTag}` : '未分類');
         map[c] = (map[c] || 0) + t.amount;
       });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    let entries = sorted;
    if (sorted.length > topN) {
      const rest = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
      entries = [...sorted.slice(0, topN), ['其他', rest]];
    }
    return { entries, total };
  }

  function assetInfo(accounts, investments, balances) {
    const roles = _role === '全部' ? CFG.ROLES : [_role];
    let acctSum = 0;
    roles.forEach(role => {
      (accounts[role] || []).forEach(a => {
        if (a.type === '信用卡' || a.type === '證券帳戶') return;
        acctSum += (balances[role] || {})[a.name] || 0;
      });
    });
    const invs = investments.filter(i => _role === '全部' || i.role === _role);
    const invSum = invs.reduce((s, i) => s + i.marketValue, 0);
    const unreal = invs.reduce((s, i) => s + i.unrealized, 0);
    return { acctSum, invSum, unreal, total: acctSum + invSum };
  }

  function shiftMonth(d) {
    const [y, m] = _month.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    _month = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  }

  // ── 共用 UI 片段 ──────────────────────────────────────────────────────────
  function topRow() {
    const chips = ['全部', ...CFG.ROLES].map(r =>
      `<button class="dash-chip ${_role === r ? 'active' : ''}" data-val="${r}" data-act="role">${r}</button>`
    ).join('');
    return `<div class="dash-top-row">
      <div class="dash-chips-row">${chips}</div>
      <button class="dash-ver-btn" data-act="ver" title="切換版型">${_ver === 'v1' ? '◐ 分析' : '▦ 卡片'}</button>
    </div>`;
  }

  function navRow() {
    const now = new Date();
    let label, prevAct, nextAct, canNext;
    if (_period === 'month') {
      const [y, m] = _month.split('-').map(Number);
      label = `${y}年${m}月`;
      prevAct = 'prev-m'; nextAct = 'next-m';
      canNext = !(y === now.getFullYear() && m === now.getMonth() + 1);
    } else {
      label = `${_year}年`;
      prevAct = 'prev-y'; nextAct = 'next-y';
      canNext = _year < now.getFullYear();
    }
    const periodMini = [['month','月'],['year','年']].map(([k,l]) =>
      `<button class="dash-pmini ${_period === k ? 'active' : ''}" data-val="${k}" data-act="period">${l}</button>`
    ).join('');
    return `<div class="dash-nav-row">
      <button class="dash-nav-btn" data-act="${prevAct}">‹</button>
      <span class="dash-nav-label">${label}</span>
      <button class="dash-nav-btn" data-act="${nextAct}" ${canNext ? '' : 'disabled'}>›</button>
      <span class="dash-nav-spacer"></span>
      <div class="dash-pmini-group">${periodMini}</div>
    </div>`;
  }

  function donutSVG(entries, total, size, stroke) {
    if (!total) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle r="${(size - stroke) / 2}" cx="${size/2}" cy="${size/2}" fill="none"
          stroke="var(--border, #e5e7eb)" stroke-width="${stroke}"/></svg>`;
    }
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const segs = entries.map(([, amt], i) => {
      const dash = amt / total * c;
      const s = `<circle r="${r}" cx="${size/2}" cy="${size/2}" fill="none"
        stroke="${COLORS[i % COLORS.length]}" stroke-width="${stroke}"
        stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="butt"
        transform="rotate(-90 ${size/2} ${size/2})"/>`;
      offset += dash;
      return s;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}</svg>`;
  }

  function catListHtml(entries, total) {
    if (!entries.length) return '<p class="empty-hint">本期無支出</p>';
    return entries.map(([cat, amt], i) => `
      <div class="dash-catl-row">
        <span class="dash-catl-dot" style="background:${COLORS[i % COLORS.length]}"></span>
        <span class="dash-catl-name">${cat}</span>
        <span class="dash-catl-pct">${(amt / total * 100).toFixed(0)}%</span>
        <span class="dash-catl-amt">${Utils.formatMoney(amt)}</span>
      </div>`).join('');
  }

  function trendChart(ledger) {
    if (_period !== 'year') return '';
    const txs = byRole(ledger).filter(tx => tx.date.startsWith(String(_year)));
    const BAR_H = 64;
    const months = Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const mTxs = txs.filter(tx => tx.date.startsWith(`${_year}/${mm}`));
      const io = sumIO(mTxs);
      return { m: i + 1, in: io.income, out: io.expense };
    });
    const maxVal = Math.max(...months.map(mo => Math.max(mo.in, mo.out)), 1);
    return `<div class="section-label">月度趨勢</div>
      <div class="card dash-bar-chart">
        ${months.map(mo => `
          <div class="dash-bar-col">
            <div class="dash-bar-pair">
              <div class="dash-bar-in"  style="height:${(mo.in  / maxVal * BAR_H).toFixed(1)}px"></div>
              <div class="dash-bar-out" style="height:${(mo.out / maxVal * BAR_H).toFixed(1)}px"></div>
            </div>
            <div class="dash-bar-label">${mo.m}</div>
          </div>`).join('')}
      </div>`;
  }

  function acctCollapse(accounts, balances) {
    const roles = _role === '全部' ? CFG.ROLES : [_role];
    let inner = '';
    roles.forEach(role => {
      const accts = (accounts[role] || []).filter(a => a.type !== '信用卡' && a.type !== '證券帳戶');
      if (!accts.length) return;
      if (_role === '全部') inner += `<div class="dash-acct-role">${role}</div>`;
      inner += `<div class="card dash-acct-card">
        ${accts.map(a => {
          const bal = (balances[role] || {})[a.name] || 0;
          return `<div class="dash-acct-row">
            <span class="dash-acct-name">${a.name}</span>
            <span class="dash-acct-bal ${bal < 0 ? 'amount-out' : ''}">${Utils.formatMoney(bal)}</span>
          </div>`;
        }).join('')}
      </div>`;
    });
    if (!inner) return '';
    return `<details class="dash-collapse" id="dash-col-acct" ${_openAcct ? 'open' : ''}>
      <summary>帳戶餘額</summary>
      <div class="dash-collapse-body">${inner}</div>
    </details>`;
  }

  function projCollapse(projects) {
    const active = projects.filter(p => p.status === '進行中');
    if (!active.length) return '';
    const inner = active.map(p => {
      const pct  = p.budget > 0 ? Math.min(p.spent / p.budget * 100, 100) : 0;
      const over = p.spent > p.budget;
      return `<div class="card proj-card" data-proj="${p.name}">
        <div class="proj-card-name">${p.name}</div>
        <div class="progress-wrap"><div class="progress-bar ${over ? 'over' : ''}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="proj-card-nums">
          <span>${Utils.formatMoney(p.spent)} / ${Utils.formatMoney(p.budget)}</span>
          <span class="${p.remaining < 0 ? 'amount-out' : ''}">剩 ${Utils.formatMoney(p.remaining)}</span>
        </div>
        ${p.gap > 0 ? `<div class="gap-alert">⚠ 資金缺口 ${Utils.formatMoney(p.gap)}</div>` : ''}
      </div>`;
    }).join('');
    return `<details class="dash-collapse" id="dash-col-proj" ${_openProj ? 'open' : ''}>
      <summary>進行中專案<span class="dash-collapse-badge">${active.length}</span></summary>
      <div class="dash-collapse-body">${inner}</div>
    </details>`;
  }

  // ── 版型一：分析版（環圈圖為主角） ─────────────────────────────────────────
  function buildV1(ledger, accounts, investments, balances) {
    const txs = periodTxs(ledger);
    const { income, expense } = sumIO(txs);
    const net = income - expense;
    const { entries, total } = catData(txs);
    const assets = assetInfo(accounts, investments, balances);

    const donutBlock = `
      <div class="card dash-donut-card">
        <div class="dash-donut-wrap">
          ${donutSVG(entries, total, 176, 26)}
          <div class="dash-donut-center">
            <div class="dash-donut-center-label">支出</div>
            <div class="dash-donut-center-val">${Utils.formatMoney(expense)}</div>
          </div>
        </div>
        <div class="dash-io-row">
          <span>收入 <b class="amount-in">${Utils.formatMoney(income)}</b></span>
          <span>結餘 <b class="${net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(net, true)}</b></span>
        </div>
        <div class="dash-catl">${catListHtml(entries, total)}</div>
      </div>`;

    const miniCards = `
      <div class="dash-mini-grid">
        <div class="card dash-mini-card">
          <div class="dash-mini-label">總資產</div>
          <div class="dash-mini-val">${Utils.formatMoney(assets.total)}</div>
          <div class="dash-mini-sub">帳戶 ${Utils.formatMoney(assets.acctSum)}</div>
        </div>
        <div class="card dash-mini-card">
          <div class="dash-mini-label">投資</div>
          <div class="dash-mini-val">${Utils.formatMoney(assets.invSum)}</div>
          <div class="dash-mini-sub ${assets.unreal >= 0 ? 'amount-in' : 'amount-out'}">${assets.unreal >= 0 ? '▲' : '▼'} ${Utils.formatMoney(Math.abs(assets.unreal))}</div>
        </div>
      </div>`;

    return donutBlock + trendChart(ledger) + miniCards;
  }

  // ── 版型二：卡片版（2×2 網格為主角） ──────────────────────────────────────
  function buildV2(ledger, accounts, investments, balances) {
    const txs = periodTxs(ledger);
    const { income, expense } = sumIO(txs);
    const net = income - expense;
    const { entries, total } = catData(txs, 3);
    const assets = assetInfo(accounts, investments, balances);

    const grid = `
      <div class="dash-grid2">
        <div class="card dash-g-card">
          <div class="dash-mini-label">${_period === 'month' ? '本月結餘' : '本年結餘'}</div>
          <div class="dash-g-val ${net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(net, true)}</div>
        </div>
        <div class="card dash-g-card">
          <div class="dash-mini-label">總資產</div>
          <div class="dash-g-val">${Utils.formatMoney(assets.total)}</div>
        </div>
        <div class="card dash-g-card">
          <div class="dash-mini-label">收入 / 支出</div>
          <div class="dash-g-io">
            <span class="amount-in">${Utils.formatMoney(income)}</span>
            <span class="amount-out">${Utils.formatMoney(expense)}</span>
          </div>
        </div>
        <div class="card dash-g-card">
          <div class="dash-mini-label">投資損益</div>
          <div class="dash-g-val ${assets.unreal >= 0 ? 'amount-in' : 'amount-out'}">${assets.unreal >= 0 ? '▲' : '▼'} ${Utils.formatMoney(Math.abs(assets.unreal))}</div>
        </div>
      </div>`;

    const donutRow = `
      <div class="card dash-donut-sm-card">
        <div class="dash-donut-sm-wrap">
          ${donutSVG(entries, total, 108, 18)}
          <div class="dash-donut-center dash-donut-center-sm">
            <div class="dash-donut-center-val-sm">${Utils.formatMoney(expense)}</div>
          </div>
        </div>
        <div class="dash-catl dash-catl-sm">${catListHtml(entries, total)}</div>
      </div>`;

    return grid + donutRow + trendChart(ledger);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderAll() {
    const el = Utils.el('page-content');
    const { ledger, projects, investments, accounts } = Store.get();
    const balances = Store.calcAllBalances(); // 一次掃描算出所有帳戶餘額，本次渲染共用

    const main = _ver === 'v1'
      ? buildV1(ledger, accounts, investments, balances)
      : buildV2(ledger, accounts, investments, balances);

    el.innerHTML = `<div class="page-inner">
      ${topRow()}
      ${navRow()}
      ${main}
      ${acctCollapse(accounts, balances)}
      ${projCollapse(projects)}
      <div style="height:16px"></div>
    </div>`;

    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { act, val } = btn.dataset;
        if (act === 'role')   _role   = val;
        if (act === 'period') _period = val;
        if (act === 'prev-m') shiftMonth(-1);
        if (act === 'next-m') shiftMonth(1);
        if (act === 'prev-y') _year--;
        if (act === 'next-y') _year++;
        if (act === 'ver') {
          _ver = _ver === 'v1' ? 'v2' : 'v1';
          localStorage.setItem('ff_dash_ver', _ver);
        }
        renderAll();
      });
    });
    document.getElementById('dash-col-acct')?.addEventListener('toggle', e => { _openAcct = e.target.open; });
    document.getElementById('dash-col-proj')?.addEventListener('toggle', e => { _openProj = e.target.open; });
    el.querySelectorAll('.proj-card').forEach(c =>
      c.addEventListener('click', () => Router.go('projects'))
    );
  }

  return { render, onMount };
})());
