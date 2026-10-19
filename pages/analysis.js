Router.register('analysis', (() => {
  let _selMonths = new Set();   // 'YYYY/MM'
  let _selRoles  = new Set();   // 角色名稱
  let _showCombined = true;     // 全家庭卡片（固定加總全部角色，不受角色篩選影響）
  let _activeIdx = 0;

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    await Store.load();
    if (!_selMonths.size) {
      const now = new Date();
      _selMonths.add(`${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    if (!_selRoles.size) Store.roleNames().forEach(r => _selRoles.add(r));
    renderAll();
  }

  // ── 資料計算 ──────────────────────────────────────────────────────────────
  function monthsAvailable(ledger) {
    const set = new Set();
    ledger.forEach(tx => { if (tx.date) set.add(tx.date.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }

  function sortedEntries(map) {
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  // 排除信用卡費（還債非消費）與調帳（對帳校正非真實收支），與 Dashboard 統計口徑一致
  function computeRoleData(ledger, role, monthSet) {
    const incomeCat = {}, incomeItems = {};
    const expCat = {}, expItems = {};
    const projCat = {}, projItems = {};
    ledger.forEach(tx => {
      if (tx.roleOut !== role) return;
      if (!monthSet.has(tx.date.slice(0, 7))) return;
      if (tx.category === CFG.CAT_CARD_BILL || tx.category === CFG.CAT_ADJUST) return;
      if (tx.type === '收入') {
        const label = tx.category || '未分類';
        incomeCat[label] = (incomeCat[label] || 0) + tx.amount;
        (incomeItems[label] = incomeItems[label] || []).push(tx);
      } else if (tx.type === '支出') {
        if (tx.projectTag) {
          const label = `📁${tx.projectTag}`;
          projCat[label] = (projCat[label] || 0) + tx.amount;
          (projItems[label] = projItems[label] || []).push(tx);
        } else {
          const label = tx.category || '未分類';
          expCat[label] = (expCat[label] || 0) + tx.amount;
          (expItems[label] = expItems[label] || []).push(tx);
        }
      }
    });
    const income = Object.values(incomeCat).reduce((s, v) => s + v, 0);
    const expense = Object.values(expCat).reduce((s, v) => s + v, 0) + Object.values(projCat).reduce((s, v) => s + v, 0);
    return { income, expense, net: income - expense, incomeCat, incomeItems, expCat, expItems, projCat, projItems };
  }

  function computeCombinedData(ledger, roles, monthSet) {
    let income = 0, expense = 0;
    const incomeCat = {}, expCat = {}, projCat = {};
    roles.forEach(role => {
      const d = computeRoleData(ledger, role, monthSet);
      income += d.income; expense += d.expense;
      Object.entries(d.incomeCat).forEach(([k, v]) => incomeCat[k] = (incomeCat[k] || 0) + v);
      Object.entries(d.expCat).forEach(([k, v]) => expCat[k] = (expCat[k] || 0) + v);
      Object.entries(d.projCat).forEach(([k, v]) => projCat[k] = (projCat[k] || 0) + v);
    });
    return { income, expense, net: income - expense, incomeCat, expCat, projCat };
  }

  // ── HTML 片段 ─────────────────────────────────────────────────────────────
  function itemRowHtml(tx) {
    const name = tx.memo || tx.category || '（未命名）';
    return `<div class="an-detail-item">
      <span class="an-detail-item-name">${Utils.esc(name)}</span>
      <span class="an-detail-item-date">${Utils.esc(tx.date.slice(5))}</span>
      <span class="an-detail-item-amt">${Utils.formatMoney(tx.amount)}</span>
    </div>`;
  }

  // 選了多個月份時，明細依月份分組並顯示小計；只選一個月份時用純清單
  function groupedItemsHtml(items, monthsSorted) {
    if (!items || !items.length) return '<p class="empty-hint">無明細</p>';
    if (monthsSorted.length <= 1) {
      return items.slice().sort((a, b) => b.date.localeCompare(a.date)).map(itemRowHtml).join('');
    }
    let html = '';
    monthsSorted.forEach(ym => {
      const monthItems = items.filter(t => t.date.slice(0, 7) === ym).sort((a, b) => b.date.localeCompare(a.date));
      if (!monthItems.length) return;
      const sub = monthItems.reduce((s, t) => s + t.amount, 0);
      html += `<div class="an-detail-month">
        <div class="an-detail-month-head"><span>${Utils.esc(ym.replace('/', '年'))}月</span><span>${Utils.formatMoney(sub)}</span></div>
        ${monthItems.map(itemRowHtml).join('')}
      </div>`;
    });
    return html;
  }

  function catRowHtml(label, amt, items, monthsSorted) {
    return `<details class="an-cat-details">
      <summary class="an-cat-row">
        <span class="an-cat-name">${Utils.esc(label)}</span>
        <span class="an-cat-amt">${Utils.formatMoney(amt)}</span>
      </summary>
      <div class="an-cat-detail">${groupedItemsHtml(items, monthsSorted)}</div>
    </details>`;
  }

  function plainRowHtml(label, amt) {
    return `<div class="an-cat-row an-cat-row-plain">
      <span class="an-cat-name">${Utils.esc(label)}</span>
      <span class="an-cat-amt">${Utils.formatMoney(amt)}</span>
    </div>`;
  }

  function sectionHtml(title, cls, entries, itemsMap, monthsSorted, collapsible) {
    const body = !entries.length
      ? '<p class="empty-hint">無資料</p>'
      : entries.map(([label, amt]) => collapsible ? catRowHtml(label, amt, itemsMap[label], monthsSorted) : plainRowHtml(label, amt)).join('');
    return `<div class="an-section">
      <div class="an-section-title ${cls}">${title}</div>
      ${body}
    </div>`;
  }

  // 專案支出整區包成一個可收合群組（預設展開），群組內各專案不逐筆展開明細
  function projectGroupHtml(entries) {
    const inner = entries.length ? entries.map(([label, amt]) => plainRowHtml(label, amt)).join('') : '<p class="empty-hint">—</p>';
    return `<details class="an-group" open>
      <summary class="an-section-title is-expense">專案支出</summary>
      <div class="an-group-body">${inner}</div>
    </details>`;
  }

  function roleCardHtml(role, data, monthsSorted) {
    return `<div class="an-role-card">
      <div class="card an-hero-card">
        <div class="an-hero-label">${Utils.esc(role)}｜結餘</div>
        <div class="an-hero-val ${data.net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(data.net, true)}</div>
        <div class="an-hero-sub">
          <span>收入 <b class="amount-in">${Utils.formatMoney(data.income)}</b></span>
          <span>支出 <b class="amount-out">${Utils.formatMoney(data.expense)}</b></span>
        </div>
      </div>
      <div class="card an-body-card">
        ${sectionHtml('收入', 'is-income', sortedEntries(data.incomeCat), data.incomeItems, monthsSorted, true)}
        ${sectionHtml('日常支出', 'is-expense', sortedEntries(data.expCat), data.expItems, monthsSorted, true)}
        ${projectGroupHtml(sortedEntries(data.projCat))}
      </div>
    </div>`;
  }

  function combinedCardHtml(data) {
    return `<div class="an-role-card">
      <div class="card an-hero-card">
        <div class="an-hero-label">全家庭｜結餘</div>
        <div class="an-hero-val ${data.net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(data.net, true)}</div>
        <div class="an-hero-sub">
          <span>收入 <b class="amount-in">${Utils.formatMoney(data.income)}</b></span>
          <span>支出 <b class="amount-out">${Utils.formatMoney(data.expense)}</b></span>
        </div>
      </div>
      <div class="card an-body-card">
        ${sectionHtml('收入', 'is-income', sortedEntries(data.incomeCat), {}, [], false)}
        ${sectionHtml('日常支出', 'is-expense', sortedEntries(data.expCat), {}, [], false)}
        <div class="an-section">
          <div class="an-section-title is-expense">專案支出</div>
          ${sortedEntries(data.projCat).length ? sortedEntries(data.projCat).map(([l, a]) => plainRowHtml(l, a)).join('') : '<p class="empty-hint">—</p>'}
        </div>
      </div>
    </div>`;
  }

  function monthChipsHtml(ledger) {
    const months = monthsAvailable(ledger);
    if (!months.length) return '<p class="empty-hint">尚無資料</p>';
    return `<div class="an-chips-row">${months.map(ym =>
      `<button class="dash-chip ${_selMonths.has(ym) ? 'active' : ''}" data-act="month" data-val="${ym}">${Utils.esc(ym.replace('/', '年'))}月</button>`
    ).join('')}</div>`;
  }

  function roleChipsHtml() {
    const roles = Store.roleNames();
    const chips = roles.map(r =>
      `<button class="dash-chip ${_selRoles.has(r) ? 'active' : ''}" data-act="role" data-val="${Utils.esc(r)}">${Utils.esc(r)}</button>`
    ).join('');
    const combinedChip = `<button class="dash-chip ${_showCombined ? 'active' : ''}" data-act="combined">全家庭</button>`;
    return `<div class="an-chips-row">${chips}${combinedChip}</div>`;
  }

  function carouselHtml(cards) {
    if (!cards.length) return '<p class="empty-hint">請至少選擇一個角色或全家庭</p>';
    const dots = cards.length > 1
      ? `<div class="an-dots">${cards.map((_, i) => `<span class="an-dot ${i === _activeIdx ? 'active' : ''}"></span>`).join('')}</div>` : '';
    return `<div class="an-role-scroll" id="an-scroll">${cards.join('')}</div>${dots}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderAll() {
    const el = Utils.el('page-content');
    const { ledger } = Store.get();
    const roles = Store.roleNames();
    const monthsSorted = Array.from(_selMonths).sort();

    const cards = [];
    if (_showCombined) cards.push(combinedCardHtml(computeCombinedData(ledger, roles, _selMonths)));
    roles.forEach(r => {
      if (!_selRoles.has(r)) return;
      cards.push(roleCardHtml(r, computeRoleData(ledger, r, _selMonths), monthsSorted));
    });
    if (_activeIdx >= cards.length) _activeIdx = 0;

    el.innerHTML = `<div class="page-inner">
      <div class="card an-filter-card">
        <div class="an-filter-label">月份（可多選）</div>
        ${monthChipsHtml(ledger)}
        <div class="an-filter-label" style="margin-top:10px">角色</div>
        ${roleChipsHtml()}
      </div>
      ${carouselHtml(cards)}
      <div style="height:16px"></div>
    </div>`;

    el.querySelectorAll('[data-act="month"]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.val;
      if (_selMonths.has(v)) _selMonths.delete(v); else _selMonths.add(v);
      renderAll();
    }));
    el.querySelectorAll('[data-act="role"]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.val;
      if (_selRoles.has(v)) _selRoles.delete(v); else _selRoles.add(v);
      renderAll();
    }));
    el.querySelector('[data-act="combined"]')?.addEventListener('click', () => {
      _showCombined = !_showCombined;
      renderAll();
    });

    const scrollEl = el.querySelector('#an-scroll');
    if (scrollEl) {
      scrollEl.addEventListener('scroll', Utils.debounce(() => {
        const idx = Math.max(0, Math.round(scrollEl.scrollLeft / (scrollEl.clientWidth * 0.9)));
        _activeIdx = idx;
        el.querySelectorAll('.an-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      }, 80));
    }
  }

  return { render, onMount };
})());
