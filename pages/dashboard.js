Router.register('dashboard', (() => {
  let _scope  = '';   // 我的 / 全部 / 單一角色
  let _period = 'month';
  let _month  = '';
  let _year   = 0;
  let _ver    = localStorage.getItem('ff_dash_ver') || 'v1'; // v1=分析版 v2=卡片版
  let _openAcct = false;
  let _openProj = true;

  const COLORS = ['#5B8DEF', '#FF8A65', '#34C99A', '#FFC757', '#A78BFA', '#F472B6', '#94A3B8'];

  // 分類固定色：已知分類查表，未知（📁專案等）以名稱雜湊取固定色，跨月份顏色不變
  function colorFor(label) {
    if (CFG.CAT_COLORS[label]) return CFG.CAT_COLORS[label];
    let h = 0;
    for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  function scopeRoles() {
    const id = Utils.identity();
    if (_scope === '我的') return Store.isShared(id) ? [id] : [id, ...Store.sharedRoleNames()];
    if (_scope === '全部') return [...Store.roleNames()];
    return [_scope];
  }

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const now = new Date();
    if (!_month) _month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if (!_year)  _year  = now.getFullYear();
    if (!_scope) {
      const id = Utils.identity();
      _scope = (id && Store.roleNames().includes(id) && !Store.isShared(id)) ? '我的' : '全部';
    }
    await Store.load();
    renderAll();
  }

  // ── 共用計算 ──────────────────────────────────────────────────────────────
  function byRole(ledger) {
    if (_scope === '全部') return ledger;
    const set = new Set(scopeRoles());
    return ledger.filter(tx => set.has(tx.roleOut) || set.has(tx.roleIn));
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
    const set = new Set(scopeRoles());
    let income = 0, expense = 0;
    txs.forEach(tx => {
      if (!set.has(tx.roleOut)) return;
      // 排除非真實收支：信用卡費是還債（刷卡當下已計入）、調帳是對帳校正非消費
      if (tx.category === CFG.CAT_CARD_BILL || tx.category === CFG.CAT_ADJUST) return;
      if (tx.type === '收入') income  += tx.amount;
      if (tx.type === '支出') expense += tx.amount;
    });
    return { income, expense };
  }

  function catData(txs, topN = 5) {
    const set = new Set(scopeRoles());
    const map = {};
    txs.filter(t => t.type === '支出' && t.category !== CFG.CAT_CARD_BILL && t.category !== CFG.CAT_ADJUST && set.has(t.roleOut))
       .forEach(t => {
         const c = t.category || (t.projectTag ? `📁${t.projectTag}` : '未分類');
         map[c] = (map[c] || 0) + t.amount;
       });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    let entries = sorted;
    if (sorted.length > topN) {
      const restItems = sorted.slice(topN);
      const rest = restItems.reduce((s, [, v]) => s + v, 0);
      entries = [...sorted.slice(0, topN), ['其他', rest, restItems]];
    }
    return { entries, total };
  }

  function assetInfo(accounts, investments, balances) {
    const roles = scopeRoles();
    const set = new Set(roles);
    let acctSum = 0, ccDebt = 0;
    roles.forEach(role => {
      (accounts[role] || []).forEach(a => {
        if (a.type === '信用卡') {
          // 信用卡應繳＝帳本逐筆試算的卡債餘額（跟設定頁帳戶管理同一套，溢繳不計入負債）
          ccDebt += Math.max(0, (balances[role] || {})[a.name] || 0);
          return;
        }
        if (a.type === '證券帳戶') return;
        acctSum += (balances[role] || {})[a.name] || 0;
      });
    });
    const invs = investments.filter(i => set.has(i.role));
    const invSum = invs.reduce((s, i) => s + i.marketValue, 0);
    const unreal = invs.reduce((s, i) => s + i.unrealized, 0);
    return { acctSum, invSum, unreal, ccDebt, total: acctSum + invSum };
  }

  function shiftMonth(d) {
    const [y, m] = _month.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    _month = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  }

  // ── 共用 UI 片段 ──────────────────────────────────────────────────────────
  function topRow() {
    const id = Utils.identity();
    const opts = (id && Store.roleNames().includes(id) && !Store.isShared(id))
      ? ['我的', '全部', ...Store.roleNames()] : ['全部', ...Store.roleNames()];
    const chips = opts.map(r =>
      `<button class="dash-chip ${_scope === r ? 'active' : ''}" data-val="${Utils.esc(r)}" data-act="role">${Utils.esc(r)}</button>`
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
    const segs = entries.map(([cat, amt]) => {
      const dash = amt / total * c;
      const s = `<circle r="${r}" cx="${size/2}" cy="${size/2}" fill="none"
        stroke="${colorFor(cat)}" stroke-width="${stroke}"
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
    return entries.map(([cat, amt, sub]) => {
      const color = colorFor(cat);
      const rowInner = `
        <span class="dash-catl-dot" style="background:${color}"></span>
        <span class="dash-catl-name">${Utils.esc(cat)}</span>
        <span class="dash-catl-pct">${(amt / total * 100).toFixed(0)}%</span>
        <span class="dash-catl-amt">${Utils.formatMoney(amt)}</span>`;
      if (sub && sub.length) {
        // 「其他」列本身是展開/收合，明細點擊掛在子列上
        const subRows = sub.map(([sc, sa]) => `
          <div class="dash-catl-sub-row" data-cat="${Utils.esc(sc)}">
            <span class="dash-catl-name">${Utils.esc(sc)}</span>
            <span class="dash-catl-pct">${(sa / total * 100).toFixed(0)}%</span>
            <span class="dash-catl-amt">${Utils.formatMoney(sa)}</span>
          </div>`).join('');
        return `<details class="dash-catl-details">
          <summary class="dash-catl-row dash-catl-exp">${rowInner}</summary>
          <div class="dash-catl-sub">${subRows}</div>
        </details>`;
      }
      return `<div class="dash-catl-row" data-cat="${Utils.esc(cat)}">${rowInner}</div>`;
    }).join('');
  }

  // ── 分類支出明細 ──────────────────────────────────────────────────────────
  function showCatDetail(label) {
    const { ledger } = Store.get();
    const set = new Set(scopeRoles());
    const txs = periodTxs(ledger).filter(t => {
      if (t.type !== '支出' || !set.has(t.roleOut)) return false;
      if (t.category === CFG.CAT_CARD_BILL || t.category === CFG.CAT_ADJUST) return false;
      // 與 catData 相同的標籤規則：分類 → 📁專案 → 未分類
      const c = t.category || (t.projectTag ? `📁${t.projectTag}` : '未分類');
      return c === label;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const total = txs.reduce((s, t) => s + t.amount, 0);
    const [y, m] = _month.split('-').map(Number);
    const periodLabel = _period === 'month' ? `${y}年${m}月` : `${_year}年`;

    const listHtml = txs.length ? txs.map(tx => {
      const name = tx.memo || tx.category || '（未命名）';
      const payTag = tx.payAccount
        ? `<span class="proj-detail-paytag">${Utils.esc(tx.payRole || '')}${tx.payRole ? '／' : ''}${Utils.esc(tx.payAccount)} 代付</span>` : '';
      return `<div class="proj-detail-item">
        <div class="proj-detail-item-main">
          <span class="proj-detail-item-name">${Utils.esc(name)}</span>
          <span class="proj-detail-item-amt amount-out">${Utils.formatMoney(tx.amount)}</span>
        </div>
        <div class="proj-detail-item-sub">
          <span>${tx.date}</span>
          <span>· ${Utils.esc(tx.roleOut)}／${Utils.esc(tx.accountOut)}</span>
          ${tx.projectTag ? `<span>· 📁${Utils.esc(tx.projectTag)}</span>` : ''}
          ${payTag}
        </div>
      </div>`;
    }).join('') : `<p class="empty-hint">本期無此分類支出</p>`;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card" style="max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-title">${Utils.esc(label)}｜${periodLabel}</div>
      <div class="proj-detail-summary">
        <div><span class="label-sm">合計</span><span class="amount-out">${Utils.formatMoney(total)}</span></div>
        <div><span class="label-sm">筆數</span><span>${txs.length} 筆</span></div>
      </div>
      <div class="proj-detail-list" style="overflow-y:auto;flex:1">${listHtml}</div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-outline btn-sm" id="btn-close-cat-detail">關閉</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-close-cat-detail').addEventListener('click', () => modal.remove());
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

  // 計算各帳戶「進行中專案剩餘預算合計」與「實際餘額」的差距
  function overcommitWarnings(projects, balances) {
    const committed = {};
    projects.filter(p => p.status === '進行中' && p.ownerRole && p.defaultAccount).forEach(p => {
      const key = `${p.ownerRole}||${p.defaultAccount}`;
      const remaining = Math.max(0, p.budget - p.spent);
      if (!committed[key]) committed[key] = { total: 0, items: [] };
      committed[key].total += remaining;
      committed[key].items.push({ name: p.name, remaining });
    });
    const warnings = {};
    Object.entries(committed).forEach(([key, { total, items }]) => {
      const [role, name] = key.split('||');
      const bal = (balances[role] || {})[name] || 0;
      if (bal < total) warnings[key] = { committed: total, shortage: total - bal, items };
    });
    return warnings;
  }

  function acctCollapse(accounts, balances, warnings) {
    const roles = scopeRoles();
    let inner = '';
    roles.forEach(role => {
      const accts = (accounts[role] || []).filter(a => a.type !== '信用卡' && a.type !== '證券帳戶');
      if (!accts.length) return;
      if (roles.length > 1) inner += `<div class="dash-acct-role">${Utils.esc(role)}</div>`;
      inner += `<div class="card dash-acct-card">
        ${accts.map(a => {
          const bal = (balances[role] || {})[a.name] || 0;
          const warn = (warnings || {})[`${role}||${a.name}`];
          return `<div class="dash-acct-row">
            <span class="dash-acct-name">${Utils.esc(a.name)}</span>
            <span class="dash-acct-bal ${bal < 0 ? 'amount-out' : ''}">${bal < 0 ? '-' : ''}${Utils.formatMoney(bal)}</span>
          </div>${warn ? `<div class="dash-overcommit-warn">⚠ 專案剩餘預算 ${Utils.formatMoney(warn.committed)}（${warn.items.map(i => Utils.esc(i.name)).join('、')}），餘額不足，缺口 ${Utils.formatMoney(warn.shortage)}</div>` : ''}`;
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
      return `<div class="card proj-card" data-proj="${Utils.esc(p.name)}">
        <div class="proj-card-name">${Utils.esc(p.name)}</div>
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

  // ── 待辦卡：信用卡未繳＋未結代付，最需要行動的資訊放最上面 ──────────────────
  function todoCard(ledger) {
    const rows = [];
    const today = new Date();

    // 定期提醒：本月尚未完成且已啟用者，依提醒日排序，逾期者標註 ⚠
    const curMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    Store.get().reminders
      .filter(r => r.active && r.lastPaidMonth !== curMonth)
      .sort((a, b) => a.dueDay - b.dueDay)
      .forEach(r => {
        const overdue = today.getDate() > r.dueDay;
        const sub = overdue ? `⚠ 已逾期（提醒日 ${r.dueDay} 號）` : `${r.dueDay} 號提醒`;
        rows.push(`<div class="dash-todo-row">
          <span class="dash-todo-icon">🔔</span>
          <span class="dash-todo-txt">${Utils.esc(r.name)}<small>${sub}</small></span>
          <span class="dash-todo-amt">${r.amount ? Utils.formatMoney(r.amount) : ''}</span>
          <button class="dash-todo-btn" data-act="todo-reminder"
            data-id="${Utils.esc(r.id)}" data-role="${Utils.esc(r.role)}" data-category="${Utils.esc(r.category)}"
            data-account="${Utils.esc(r.account)}" data-amount="${r.amount || ''}">記帳</button>
        </div>`);
      });

    const pays = Store.computePayables(ledger);
    if (pays.length) {
      const sum = pays.reduce((s, x) => s + x.remaining, 0);
      rows.push(`<div class="dash-todo-row">
        <span class="dash-todo-icon">🤝</span>
        <span class="dash-todo-txt">未結代付<small>${pays.length} 筆</small></span>
        <span class="dash-todo-amt">${Utils.formatMoney(sum)}</span>
        <button class="dash-todo-btn" data-act="todo-payables">查看</button>
      </div>`);
    }

    if (!rows.length) return '';
    return `<div class="card dash-todo-card">${rows.join('')}</div>`;
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
          ${assets.ccDebt > 0 ? `<div class="dash-cc-debt">信用卡應繳 -${Utils.formatMoney(assets.ccDebt)}</div>` : ''}
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
          ${assets.ccDebt > 0 ? `<div class="dash-cc-debt">信用卡應繳 -${Utils.formatMoney(assets.ccDebt)}</div>` : ''}
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
    const warnings = overcommitWarnings(projects, balances);

    const main = _ver === 'v1'
      ? buildV1(ledger, accounts, investments, balances)
      : buildV2(ledger, accounts, investments, balances);

    const emptyCta = !ledger.length ? `<div class="card empty-cta">
      <div class="empty-cta-icon">👋</div>
      <p>歡迎！從第一筆記帳開始</p>
      <button class="btn btn-primary" data-act="goto-entry">記下第一筆 →</button>
    </div>` : '';

    el.innerHTML = `<div class="page-inner">
      ${topRow()}
      ${navRow()}
      ${todoCard(ledger)}
      ${emptyCta || main}
      ${acctCollapse(accounts, balances, warnings)}
      ${projCollapse(projects)}
      <div style="height:16px"></div>
    </div>`;

    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { act, val } = btn.dataset;
        if (act === 'goto-entry') { Router.go('entry'); return; }
        if (act === 'todo-reminder') {
          localStorage.setItem('ff_entry_prefill', JSON.stringify({
            type: '支出', reminderId: btn.dataset.id, role: btn.dataset.role,
            category: btn.dataset.category, account: btn.dataset.account, amount: btn.dataset.amount
          }));
          Router.go('entry');
          return;
        }
        if (act === 'todo-payables') {
          Router.go('repay');
          return;
        }
        if (act === 'role')   _scope  = val;
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
    el.querySelectorAll('[data-cat]').forEach(row => {
      row.addEventListener('click', () => showCatDetail(row.dataset.cat));
    });
    document.getElementById('dash-col-acct')?.addEventListener('toggle', e => { _openAcct = e.target.open; });
    document.getElementById('dash-col-proj')?.addEventListener('toggle', e => { _openProj = e.target.open; });
    el.querySelectorAll('.proj-card').forEach(c =>
      c.addEventListener('click', () => Router.go('projects'))
    );
  }

  return { render, onMount };
})());
