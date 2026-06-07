Router.register('dashboard', (() => {
  let _role   = '全部';
  let _period = 'month';
  let _month  = '';
  let _year   = 0;

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

  function renderAll() {
    const el = Utils.el('page-content');
    const { ledger, projects, investments, accounts } = Store.get();

    const roleTabs = ['全部', ...CFG.ROLES].map(r =>
      `<button class="dash-chip ${_role === r ? 'active' : ''}" data-val="${r}" data-act="role">${r}</button>`
    ).join('');

    const periodTabs = [['month','月度'],['year','年度']].map(([k,l]) =>
      `<button class="dash-chip ${_period === k ? 'active' : ''}" data-val="${k}" data-act="period">${l}</button>`
    ).join('');

    const mainContent = _period === 'month'
      ? buildMonth(ledger, accounts)
      : buildYear(ledger);

    const totalMV     = investments.reduce((s, i) => s + i.marketValue, 0);
    const totalUnreal = investments.reduce((s, i) => s + i.unrealized, 0);

    const activeProj = projects.filter(p => p.status === '進行中');
    const projHtml = activeProj.length === 0
      ? `<p class="empty-hint">目前無進行中專案</p>`
      : activeProj.map(p => {
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

    el.innerHTML = `<div class="page-inner">
      <div class="dash-chips-row">${roleTabs}</div>
      <div class="dash-chips-row">${periodTabs}</div>
      ${mainContent}
      <div class="section-label">投資組合</div>
      <div class="card invest-summary">
        <div class="invest-row"><span class="label-sm">總市值</span><span class="amount-primary">${Utils.formatMoney(totalMV)}</span></div>
        <div class="invest-row"><span class="label-sm">未實現損益</span>
          <span class="${totalUnreal >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(totalUnreal, true)}</span></div>
      </div>
      <div class="section-label">進行中專案</div>
      ${projHtml}
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
        renderAll();
      });
    });
    el.querySelectorAll('.proj-card').forEach(c =>
      c.addEventListener('click', () => Router.go('projects'))
    );
  }

  function shiftMonth(d) {
    const [y, m] = _month.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    _month = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  }

  function byRole(ledger) {
    if (_role === '全部') return ledger;
    return ledger.filter(tx => tx.roleOut === _role || tx.roleIn === _role);
  }

  function sumIO(txs) {
    let income = 0, expense = 0;
    txs.forEach(tx => {
      if (tx.type === '收入' && (_role === '全部' || tx.roleOut === _role)) income  += tx.amount;
      if (tx.type === '支出' && (_role === '全部' || tx.roleOut === _role)) expense += tx.amount;
    });
    return { income, expense };
  }

  function navRow(label, prevAct, nextAct, canNext) {
    return `<div class="dash-nav-row">
      <button class="dash-nav-btn" data-act="${prevAct}">‹</button>
      <span class="dash-nav-label">${label}</span>
      <button class="dash-nav-btn" data-act="${nextAct}" ${canNext ? '' : 'disabled'}>›</button>
    </div>`;
  }

  function summaryCards(income, expense) {
    const net = income - expense;
    return `<div class="dash-summary-grid">
      <div class="dash-sum-card">
        <div class="dash-sum-label">收入</div>
        <div class="dash-sum-val amount-in">${Utils.formatMoney(income)}</div>
      </div>
      <div class="dash-sum-card">
        <div class="dash-sum-label">支出</div>
        <div class="dash-sum-val amount-out">${Utils.formatMoney(expense)}</div>
      </div>
      <div class="dash-sum-card">
        <div class="dash-sum-label">結餘</div>
        <div class="dash-sum-val ${net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(net, true)}</div>
      </div>
    </div>`;
  }

  function catSection(txs, label) {
    const catMap = {};
    txs.filter(t => t.type === '支出' && (_role === '全部' || t.roleOut === _role))
       .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!cats.length) return '';
    const maxAmt = cats[0][1];
    return `<div class="section-label">${label}</div>
      <div class="card dash-cat-card">
        ${cats.map(([cat, amt]) => `
          <div class="dash-cat-row">
            <span class="dash-cat-name">${cat}</span>
            <div class="dash-cat-bar-wrap">
              <div class="dash-cat-bar" style="width:${(amt / maxAmt * 100).toFixed(1)}%"></div>
            </div>
            <span class="dash-cat-amt">${Utils.formatMoney(amt)}</span>
          </div>`).join('')}
      </div>`;
  }

  function acctSection(ledger, accounts) {
    const balMap = {};
    const roles = _role === '全部' ? CFG.ROLES : [_role];

    roles.forEach(role => {
      (accounts[role] || []).forEach(a => {
        if (a.type === '信用卡' || a.type === '證券帳戶') return;
        balMap[a.name] = { role, balance: a.balance || 0 };
      });
    });

    ledger.forEach(tx => {
      if (tx.type === '支出') {
        const acct = tx.payAccount || tx.accountOut;
        if (balMap[acct]) balMap[acct].balance -= tx.amount;
      } else if (tx.type === '收入') {
        if (balMap[tx.accountOut]) balMap[tx.accountOut].balance += tx.amount;
      } else if (tx.type === '轉帳') {
        if (balMap[tx.accountOut]) balMap[tx.accountOut].balance -= tx.amount;
        if (tx.accountIn && balMap[tx.accountIn]) balMap[tx.accountIn].balance += tx.amount;
      }
    });

    let html = '<div class="section-label">帳戶餘額</div>';
    roles.forEach(role => {
      const accts = (accounts[role] || []).filter(a =>
        a.type !== '信用卡' && a.type !== '證券帳戶' && balMap[a.name]
      );
      if (!accts.length) return;
      if (_role === '全部') html += `<div class="dash-acct-role">${role}</div>`;
      html += `<div class="card dash-acct-card">
        ${accts.map(a => {
          const bal = balMap[a.name].balance;
          return `<div class="dash-acct-row">
            <span class="dash-acct-name">${a.name}</span>
            <span class="dash-acct-bal ${bal < 0 ? 'amount-out' : ''}">${Utils.formatMoney(bal)}</span>
          </div>`;
        }).join('')}
      </div>`;
    });
    return html;
  }

  function buildMonth(ledger, accounts) {
    const [y, m] = _month.split('-').map(Number);
    const now = new Date();
    const isNow = y === now.getFullYear() && m === now.getMonth() + 1;
    const txs = byRole(ledger).filter(tx => tx.date.startsWith(_month));
    const { income, expense } = sumIO(txs);
    return `
      ${navRow(`${y}年${m}月`, 'prev-m', 'next-m', !isNow)}
      ${summaryCards(income, expense)}
      ${catSection(txs, '支出分類')}
      ${acctSection(ledger, accounts)}
    `;
  }

  function buildYear(ledger) {
    const now = new Date();
    const txs = byRole(ledger).filter(tx => tx.date.startsWith(String(_year)));
    const { income, expense } = sumIO(txs);

    const BAR_H = 72;
    const months = Array.from({ length: 12 }, (_, i) => {
      const mm   = String(i + 1).padStart(2, '0');
      const mTxs = txs.filter(tx => tx.date.startsWith(`${_year}-${mm}`));
      const mIn  = mTxs.filter(t => t.type === '收入' && (_role === '全部' || t.roleOut === _role))
                       .reduce((s, t) => s + t.amount, 0);
      const mOut = mTxs.filter(t => t.type === '支出' && (_role === '全部' || t.roleOut === _role))
                       .reduce((s, t) => s + t.amount, 0);
      return { m: i + 1, in: mIn, out: mOut };
    });
    const maxVal = Math.max(...months.map(mo => Math.max(mo.in, mo.out)), 1);

    const barChart = `<div class="section-label">月度趨勢</div>
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

    return `
      ${navRow(`${_year}年`, 'prev-y', 'next-y', _year < now.getFullYear())}
      ${summaryCards(income, expense)}
      ${barChart}
      ${catSection(txs, '年度支出分類')}
    `;
  }

  return { render, onMount };
})());
