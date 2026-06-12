Router.register('entry', (() => {
  const CAT_ICONS = {
    '食物':'🍱','飲料':'🧋','交通':'🚇','購物':'🛍️',
    '娛樂':'🎮','家用':'🏠','電信':'📱','醫藥':'💊',
    '教育':'📚','醫療保險':'🏥','投資儲蓄':'📈','旅遊':'✈️',
    '訂閱':'📺','信用卡費':'💳',
    '薪資收入':'💰','利息/股息':'📊','現金回饋':'🎁','其他':'💵'
  };
  const LS_RECENT_MEMOS = 'ff_recent_memos';
  const LS_LAST_ROLE = 'ff_entry_role';
  const LS_LAST_ACCT = r => `ff_entry_acct_${r}`;

  let _el = null;
  let _role = '';
  let _showAll = false;   // 角色列是否展開全部成員
  let _date = '';
  let _sh = null;         // bottom sheet 狀態
  let _sheetEl = null;

  // ── 身份 ──────────────────────────────────────────────────────────────────
  function identity() { return localStorage.getItem('ff_identity') || ''; }
  function primaryRoles() {
    const id = identity();
    if (!id) return [...CFG.ROLES];
    return id === '家用' ? ['家用'] : [id, '家用'];
  }
  function visibleRoles() { return _showAll ? [...CFG.ROLES] : primaryRoles(); }

  // ── 小工具 ────────────────────────────────────────────────────────────────
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function getRecentMemos() {
    try { return JSON.parse(localStorage.getItem(LS_RECENT_MEMOS) || '[]'); } catch { return []; }
  }
  function addRecentMemo(memo) {
    if (!memo?.trim()) return;
    const m = memo.trim();
    const list = getRecentMemos().filter(x => x !== m);
    list.unshift(m);
    localStorage.setItem(LS_RECENT_MEMOS, JSON.stringify(list.slice(0, 8)));
  }
  function acctsForRole(role) {
    return Store.allAccountsFlat().filter(a => a.role === role && a.type !== '證券帳戶');
  }
  function lastAcct(role) {
    const saved = localStorage.getItem(LS_LAST_ACCT(role));
    const names = acctsForRole(role).map(a => a.name);
    return names.includes(saved) ? saved : (names[0] || '');
  }
  function acctIcon(name) {
    const map = { '現金': '💵', '銀行': '🏦', '信用卡': '💳', '證券帳戶': '📊' };
    const a = Store.allAccountsFlat().find(x => x.name === name);
    return map[a?.type || '銀行'] || '🏦';
  }
  function getPaymentInfo(cardName) {
    const all = Store.allAccountsFlat();
    const card = all.find(a => a.name === cardName);
    if (!card?.paymentAccount) return null;
    const owner = all.find(a => a.name === card.paymentAccount);
    return { account: card.paymentAccount, role: owner?.role || '' };
  }
  function getProjectCatSuggestions() {
    return [...new Set(
      Store.get().ledger
        .filter(tx => tx.dimension === '專案' && tx.type === '支出' && tx.category)
        .map(tx => tx.category)
    )];
  }
  // 該角色的支出分類，依使用頻率排序
  function catOrder(role) {
    const counts = {};
    Store.get().ledger.forEach(tx => {
      if (tx.type === '支出' && tx.roleOut === role && tx.category) {
        counts[tx.category] = (counts[tx.category] || 0) + 1;
      }
    });
    return [...CFG.CATEGORIES['支出']].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function render(el) {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    _el = Utils.el('page-content');
    _showAll = false;
    await Store.load();

    const pr = primaryRoles();
    const saved = localStorage.getItem(LS_LAST_ROLE);
    _role = pr.includes(saved) ? saved : pr[0];
    if (!_date) _date = todayISO();

    // 帳單頁「前往繳費」帶入的預填（用完即清）
    let prefill = null;
    try {
      const raw = localStorage.getItem('ff_entry_prefill');
      if (raw) { localStorage.removeItem('ff_entry_prefill'); prefill = JSON.parse(raw); }
    } catch {}

    renderMain();
    if (prefill?.type === '轉帳') openSheet('transfer', prefill);
  }

  // ── 主畫面 ────────────────────────────────────────────────────────────────
  function renderMain() {
    const today = todayISO();
    const dateLabel = _date === today ? '今天' : _date.replace(/-/g, '/');
    const roles = visibleRoles();
    const hasMore = !_showAll && roles.length < CFG.ROLES.length;
    const id = identity();

    const roleCards = roles.map(r =>
      `<button type="button" class="entry-id-card${_role === r ? ' active' : ''}" data-action="role" data-val="${r}">
        ${r === '家用' ? '🏠 ' : ''}${r}${id === r ? '<span class="entry-id-tag">我</span>' : ''}
      </button>`
    ).join('') + (hasMore
      ? `<button type="button" class="entry-id-card entry-id-more" data-action="more-roles">⋯</button>` : '');

    const cats = catOrder(_role);
    const tiles = cats.map(c => ({ icon: CAT_ICONS[c] || '📌', label: c, action: 'cat', val: c }));
    tiles.push({ icon: '📁', label: '專案', action: 'open-proj', val: '' });
    const pages = [];
    for (let i = 0; i < tiles.length; i += 8) pages.push(tiles.slice(i, i + 8));

    const pagesHtml = pages.map(p =>
      `<div class="entry-cat-page">${p.map(t =>
        `<button type="button" class="entry-cat-tile" data-action="${t.action}" data-val="${t.val}">
          <span class="entry-cat-tile-icon">${t.icon}</span><span>${t.label}</span>
        </button>`).join('')}</div>`
    ).join('');

    const dots = pages.length > 1
      ? `<div class="entry-dots">${pages.map((_, i) =>
          `<span class="entry-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
      : '';

    _el.innerHTML = `<div class="entry-wrapper">
      <label class="entry-date-standalone" style="cursor:pointer;-webkit-tap-highlight-color:transparent">
        <span style="position:absolute;left:16px;pointer-events:none">📅</span>
        <span id="date-label" style="font-weight:600;pointer-events:none">${dateLabel}</span>
        <span style="position:absolute;right:16px;color:var(--text-muted);pointer-events:none">›</span>
        <input type="date" id="inp-date" value="${_date}"
               style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:none;background:none;font-size:16px">
      </label>
      <div class="entry-id-row">${roleCards}</div>
      <div class="entry-swipe" id="entry-swipe">${pagesHtml}</div>
      ${dots}
      <div class="entry-alt-row">
        <button type="button" class="entry-alt-btn alt-income" data-action="open-income">💰 收入</button>
        <button type="button" class="entry-alt-btn alt-transfer" data-action="open-transfer">⇄ 轉帳</button>
      </div>
    </div>`;

    _el.querySelector('.entry-wrapper').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, val } = btn.dataset;
      if (action === 'role') {
        _role = val;
        localStorage.setItem(LS_LAST_ROLE, val);
        renderMain();
      } else if (action === 'more-roles') {
        _showAll = true;
        renderMain();
      } else if (action === 'cat') {
        openSheet('cat', { category: val });
      } else if (action === 'open-proj') {
        openSheet('proj');
      } else if (action === 'open-income') {
        openSheet('income');
      } else if (action === 'open-transfer') {
        openSheet('transfer');
      }
    });

    const inpDate = Utils.el('inp-date');
    inpDate?.addEventListener('click', e => { try { e.currentTarget.showPicker(); } catch {} });
    inpDate?.addEventListener('change', e => {
      _date = e.target.value;
      const label = Utils.el('date-label');
      if (label) label.textContent = _date === todayISO() ? '今天' : _date.replace(/-/g, '/');
    });

    const sw = Utils.el('entry-swipe');
    sw?.addEventListener('scroll', () => {
      const i = Math.round(sw.scrollLeft / sw.clientWidth);
      _el.querySelectorAll('.entry-dot').forEach((d, j) => d.classList.toggle('active', j === i));
    }, { passive: true });
  }

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  function openSheet(kind, opts = {}) {
    _sh = { kind, amount: opts.amount ? String(opts.amount) : '', memo: '' };

    if (kind === 'cat') {
      _sh.category = opts.category;
      _sh.role = _role; _sh.account = lastAcct(_role);
      _sh.payRole = ''; _sh.payAccount = '';
      _sh.autoTransfer = false; _sh.transferFrom = '';
    } else if (kind === 'income') {
      _sh.category = '';
      _sh.role = _role; _sh.account = lastAcct(_role);
    } else if (kind === 'proj') {
      _sh.role = _role; _sh.account = lastAcct(_role);
      _sh.project = ''; _sh.projCat = ''; _sh.locked = false;
      _sh.payRole = ''; _sh.payAccount = '';
      _sh.autoTransfer = false; _sh.transferFrom = '';
    } else if (kind === 'transfer') {
      _sh.roleOut = _role; _sh.accountOut = lastAcct(_role);
      let roleIn = opts.roleIn && CFG.ROLES.includes(opts.roleIn) ? opts.roleIn
        : (_role === '家用' ? (identity() && identity() !== '家用' ? identity() : CFG.ROLES[0]) : '家用');
      _sh.roleIn = roleIn;
      const inNames = acctsForRole(roleIn).map(a => a.name);
      _sh.accountIn = (opts.accountIn && inNames.includes(opts.accountIn)) ? opts.accountIn : lastAcct(roleIn);
      _sh.project = '';
    }

    _sheetEl = document.createElement('div');
    _sheetEl.className = 'entry-sheet-overlay';
    document.body.appendChild(_sheetEl);
    renderSheet(false);
    requestAnimationFrame(() => _sheetEl.querySelector('.entry-sheet')?.classList.add('open'));
  }

  function closeSheet() {
    if (!_sheetEl) return;
    const sheet = _sheetEl.querySelector('.entry-sheet');
    sheet?.classList.remove('open');
    const el = _sheetEl;
    setTimeout(() => el.remove(), 260);
    _sheetEl = null; _sh = null;
  }

  function sheetTitle() {
    switch (_sh.kind) {
      case 'cat':     return `${CAT_ICONS[_sh.category] || '📌'} ${_sh.category}｜${_sh.role}`;
      case 'income':  return `💰 收入｜${_sh.role}`;
      case 'proj':    return `📁 專案支出${_sh.locked ? `｜🔒 ${_sh.role}` : `｜${_sh.role}`}`;
      case 'transfer':return `⇄ 轉帳`;
    }
  }

  function renderSheet(keepOpen = true) {
    if (!_sheetEl || !_sh) return;
    const dateLabel = _date === todayISO() ? '今天' : _date.replace(/-/g, '/');
    const recentMemos = getRecentMemos();

    function acctSelect(id, role, current) {
      const opts = acctsForRole(role).map(a =>
        `<option value="${a.name.replace(/"/g, '&quot;')}"${a.name === current ? ' selected' : ''}>${acctIcon(a.name)} ${a.name}</option>`
      ).join('');
      return `<select id="${id}" class="form-select">${opts || '<option value="">無帳戶</option>'}</select>`;
    }
    function roleSelect(id, current) {
      return `<select id="${id}" class="form-select" style="flex:0 0 92px">${CFG.ROLES.map(r =>
        `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('')}</select>`;
    }

    let body = '';
    if (_sh.kind === 'cat' || _sh.kind === 'income') {
      if (_sh.kind === 'income') {
        body += `<div class="sheet-cat-chips">${CFG.CATEGORIES['收入'].map(c =>
          `<button type="button" class="sheet-chip${_sh.category === c ? ' active' : ''}" data-action="inc-cat" data-val="${c}">${CAT_ICONS[c] || ''} ${c}</button>`
        ).join('')}</div>`;
      }
      body += `<div class="sheet-row"><label>帳戶</label>${acctSelect('sel-sheet-acct', _sh.role, _sh.account)}</div>`;
      if (_sh.kind === 'cat') {
        const payOpts = Store.allAccountsFlat()
          .filter(a => a.type !== '證券帳戶' && a.name !== _sh.account)
          .sort((a, b) => (a.type === '信用卡' ? -1 : 0) - (b.type === '信用卡' ? -1 : 0))
          .map(a => {
            const v = `${a.role}||${a.name}`;
            const cur = _sh.payRole === a.role && _sh.payAccount === a.name;
            return `<option value="${v.replace(/"/g, '&quot;')}"${cur ? ' selected' : ''}>${acctIcon(a.name)} ${a.role}／${a.name}</option>`;
          }).join('');
        const payInfo = _sh.payAccount ? getPaymentInfo(_sh.payAccount) : null;
        const canAuto = !!payInfo && _sh.role !== _sh.payRole;
        const tfOpts = acctsForRole(_sh.role).filter(a => a.type !== '信用卡')
          .map(a => `<option value="${a.name.replace(/"/g, '&quot;')}"${_sh.transferFrom === a.name ? ' selected' : ''}>${a.name}</option>`).join('');
        body += `<details class="sheet-adv"${_sh.payAccount ? ' open' : ''}>
          <summary>進階：代付${_sh.payAccount ? `（${_sh.payRole}／${_sh.payAccount}）` : ''}</summary>
          <div class="sheet-row"><label>代付</label>
            <select id="sel-sheet-pay" class="form-select">
              <option value="">不使用代付</option>${payOpts}
            </select></div>
          ${canAuto ? `
            <label class="sheet-auto-toggle">
              <input type="checkbox" id="chk-sheet-auto"${_sh.autoTransfer ? ' checked' : ''}>
              <span>同步補款轉帳</span>
            </label>
            ${_sh.autoTransfer ? `
              <div class="sheet-row"><label>轉出</label><select id="sel-sheet-tf" class="form-select">${tfOpts}</select></div>
              <div class="sheet-row"><label>轉入</label><span class="sheet-static">${payInfo.role}／${payInfo.account}</span></div>` : ''}
          ` : ''}
        </details>`;
      }
    } else if (_sh.kind === 'proj') {
      const projects = Store.get().projects.filter(p => p.status === '進行中');
      body += `<div class="sheet-row"><label>專案</label>
        <select id="sel-sheet-proj" class="form-select">
          <option value="">選擇專案 *</option>
          ${projects.map(p => `<option value="${p.name}"${_sh.project === p.name ? ' selected' : ''}>${p.name}</option>`).join('')}
        </select></div>`;
      body += `<div class="sheet-row"><label>分類</label>
        <input type="text" id="inp-sheet-projcat" class="form-input" list="proj-cat-list"
               placeholder="選填，例：建材、家電" value="${(_sh.projCat || '').replace(/"/g, '&quot;')}" autocomplete="off">
        <datalist id="proj-cat-list">${getProjectCatSuggestions().map(c => `<option value="${c}">`).join('')}</datalist>
      </div>`;
      body += `<div class="sheet-row"><label>帳戶</label>${acctSelect('sel-sheet-acct', _sh.role, _sh.account)}</div>`;

      // 進階：代付＋同步補款
      const payOpts = Store.allAccountsFlat()
        .filter(a => a.type !== '證券帳戶' && a.name !== _sh.account)
        .sort((a, b) => (a.type === '信用卡' ? -1 : 0) - (b.type === '信用卡' ? -1 : 0))
        .map(a => {
          const v = `${a.role}||${a.name}`;
          const cur = _sh.payRole === a.role && _sh.payAccount === a.name;
          return `<option value="${v.replace(/"/g, '&quot;')}"${cur ? ' selected' : ''}>${acctIcon(a.name)} ${a.role}／${a.name}</option>`;
        }).join('');
      const payInfo = _sh.payAccount ? getPaymentInfo(_sh.payAccount) : null;
      const canAuto = !!payInfo && _sh.role !== _sh.payRole;
      const tfOpts = acctsForRole(_sh.role).filter(a => a.type !== '信用卡')
        .map(a => `<option value="${a.name.replace(/"/g, '&quot;')}"${_sh.transferFrom === a.name ? ' selected' : ''}>${a.name}</option>`).join('');

      body += `<details class="sheet-adv"${_sh.payAccount ? ' open' : ''}>
        <summary>進階：代付${_sh.payAccount ? `（${_sh.payRole}／${_sh.payAccount}）` : ''}</summary>
        <div class="sheet-row"><label>代付</label>
          <select id="sel-sheet-pay" class="form-select">
            <option value="">不使用代付</option>${payOpts}
          </select></div>
        ${canAuto ? `
          <label class="sheet-auto-toggle">
            <input type="checkbox" id="chk-sheet-auto"${_sh.autoTransfer ? ' checked' : ''}>
            <span>同步補款轉帳</span>
          </label>
          ${_sh.autoTransfer ? `
            <div class="sheet-row"><label>轉出</label><select id="sel-sheet-tf" class="form-select">${tfOpts}</select></div>
            <div class="sheet-row"><label>轉入</label><span class="sheet-static">${payInfo.role}／${payInfo.account}</span></div>` : ''}
        ` : ''}
      </details>`;
    } else if (_sh.kind === 'transfer') {
      const projects = Store.get().projects.filter(p => p.status === '進行中');
      const projLocked = !!_sh.project && (() => {
        const p = Store.get().projects.find(x => x.name === _sh.project);
        return !!(p?.ownerRole && CFG.ROLES.includes(p.ownerRole));
      })();
      body += `
        <div class="sheet-row"><label>轉出</label>${roleSelect('sel-out-role', _sh.roleOut)}${acctSelect('sel-out-acct', _sh.roleOut, _sh.accountOut)}</div>
        <div class="entry-transfer-arrow" style="margin:2px 0">↓</div>
        <div class="sheet-row"><label>轉入</label>
          ${projLocked
            ? `<span class="sheet-static">🔒 ${_sh.roleIn}／${_sh.accountIn}</span>`
            : roleSelect('sel-in-role', _sh.roleIn) + acctSelect('sel-in-acct', _sh.roleIn, _sh.accountIn)}
        </div>
        ${projects.length ? `<div class="sheet-row"><label>專案</label>
          <select id="sel-tr-proj" class="form-select">
            <option value="">無（一般轉帳）</option>
            ${projects.map(p => `<option value="${p.name}"${_sh.project === p.name ? ' selected' : ''}>📁 ${p.name}</option>`).join('')}
          </select></div>` : ''}`;
    }

    const memoChips = recentMemos.length
      ? `<div class="entry-memo-chips">${recentMemos.map(m =>
          `<button type="button" class="sheet-chip${_sh.memo === m ? ' active' : ''}" data-action="memo-chip" data-val="${m.replace(/"/g, '&quot;')}">${m}</button>`
        ).join('')}</div>` : '';

    const amtDisplay = _sh.amount || '0';
    const submitLabel = _sh.amount ? `✓ 記帳 NT$ ${Number(_sh.amount).toLocaleString()}` : '✓ 記帳';

    _sheetEl.innerHTML = `<div class="entry-sheet${keepOpen ? ' open' : ''}">
      <div class="entry-sheet-handle"></div>
      <div class="entry-sheet-head">
        <span>${sheetTitle()}</span>
        <span class="entry-sheet-date">📅 ${dateLabel}</span>
      </div>
      <div class="entry-sheet-amt${_sh.amount ? '' : ' zero'}" id="sheet-amt">$ ${amtDisplay}</div>
      ${body}
      ${memoChips}
      <div class="sheet-row"><label>備忘</label>
        <input type="text" id="inp-sheet-memo" class="form-input" placeholder="選填" value="${(_sh.memo || '').replace(/"/g, '&quot;')}" autocomplete="off">
      </div>
      <div class="numpad-keys sheet-numpad">
        ${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k =>
          `<button type="button" class="numpad-key${k === '⌫' ? ' numpad-del' : ''}" data-key="${k}">${k}</button>`).join('')}
      </div>
      <button type="button" class="numpad-done sheet-submit" id="btn-sheet-submit" data-action="submit">${submitLabel}</button>
    </div>`;

    wireSheet();
    addSwipeToClose();
  }

  function addSwipeToClose() {
    const sheet  = _sheetEl?.querySelector('.entry-sheet');
    const handle = _sheetEl?.querySelector('.entry-sheet-handle');
    const head   = _sheetEl?.querySelector('.entry-sheet-head');
    if (!sheet) return;

    let startY = 0, curY = 0, active = false;

    function onStart(e) {
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      curY   = 0;
      active = true;
      sheet.style.transition = 'none';
    }
    function onMove(e) {
      if (!active) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
      if (y > 0) { curY = y; sheet.style.transform = `translateY(${curY}px)`; }
    }
    function onEnd() {
      if (!active) return;
      active = false;
      sheet.style.transition = '';
      if (curY > 90) { closeSheet(); } else { sheet.style.transform = ''; }
      curY = 0;
    }

    [handle, head].filter(Boolean).forEach(el => {
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchmove',  onMove,  { passive: true });
      el.addEventListener('touchend',   onEnd);
      el.style.cursor = 'grab';
    });
  }

  function wireSheet() {
    _sheetEl.addEventListener('click', e => {
      if (e.target === _sheetEl) { closeSheet(); return; }

      const key = e.target.closest('[data-key]');
      if (key) {
        const k = key.dataset.key;
        let cur = _sh.amount || '';
        if (k === '⌫') cur = cur.slice(0, -1);
        else if (k === '.') { if (!cur.includes('.')) cur = (cur || '0') + '.'; }
        else cur = cur === '0' ? k : cur + k;
        _sh.amount = cur;
        const disp = _sheetEl.querySelector('#sheet-amt');
        if (disp) { disp.textContent = `$ ${cur || '0'}`; disp.classList.toggle('zero', !cur); }
        const btn = _sheetEl.querySelector('#btn-sheet-submit');
        if (btn) btn.textContent = cur ? `✓ 記帳 NT$ ${Number(cur).toLocaleString()}` : '✓ 記帳';
        return;
      }

      const act = e.target.closest('[data-action]');
      if (!act) return;
      const { action, val } = act.dataset;
      if (action === 'submit') submitSheet();
      else if (action === 'inc-cat') { _sh.category = val; renderSheet(); }
      else if (action === 'memo-chip') {
        _sh.memo = val;
        const inp = _sheetEl.querySelector('#inp-sheet-memo');
        if (inp) inp.value = val;
        _sheetEl.querySelectorAll('[data-action="memo-chip"]').forEach(c =>
          c.classList.toggle('active', c.dataset.val === val));
      }
    });

    _sheetEl.querySelector('#inp-sheet-memo')?.addEventListener('input', e => { _sh.memo = e.target.value; });
    _sheetEl.querySelector('#sel-sheet-acct')?.addEventListener('change', e => { _sh.account = e.target.value; });
    _sheetEl.querySelector('#inp-sheet-projcat')?.addEventListener('input', e => { _sh.projCat = e.target.value; });

    _sheetEl.querySelector('#sel-sheet-proj')?.addEventListener('change', e => {
      const val = e.target.value;
      _sh.project = val;
      const p = Store.get().projects.find(x => x.name === val);
      if (val && p?.ownerRole && CFG.ROLES.includes(p.ownerRole)) {
        _sh.role = p.ownerRole;
        const names = acctsForRole(p.ownerRole).map(a => a.name);
        _sh.account = (p.defaultAccount && names.includes(p.defaultAccount)) ? p.defaultAccount : (names[0] || '');
        _sh.locked = true;
      } else {
        _sh.locked = false;
      }
      renderSheet();
    });

    _sheetEl.querySelector('#sel-sheet-pay')?.addEventListener('change', e => {
      const val = e.target.value;
      if (!val) {
        _sh.payRole = ''; _sh.payAccount = '';
        _sh.autoTransfer = false; _sh.transferFrom = '';
      } else {
        const [r, n] = val.split('||');
        _sh.payRole = r; _sh.payAccount = n;
        const pi = getPaymentInfo(n);
        if (pi && _sh.role !== r) {
          _sh.autoTransfer = true;
          _sh.transferFrom = (acctsForRole(_sh.role).filter(a => a.type !== '信用卡')[0] || {}).name || '';
        } else {
          _sh.autoTransfer = false; _sh.transferFrom = '';
        }
      }
      renderSheet();
    });
    _sheetEl.querySelector('#chk-sheet-auto')?.addEventListener('change', e => {
      _sh.autoTransfer = e.target.checked;
      if (_sh.autoTransfer && !_sh.transferFrom) {
        _sh.transferFrom = (acctsForRole(_sh.role).filter(a => a.type !== '信用卡')[0] || {}).name || '';
      }
      renderSheet();
    });
    _sheetEl.querySelector('#sel-sheet-tf')?.addEventListener('change', e => { _sh.transferFrom = e.target.value; });

    _sheetEl.querySelector('#sel-out-role')?.addEventListener('change', e => {
      _sh.roleOut = e.target.value;
      _sh.accountOut = lastAcct(_sh.roleOut);
      renderSheet();
    });
    _sheetEl.querySelector('#sel-out-acct')?.addEventListener('change', e => { _sh.accountOut = e.target.value; });
    _sheetEl.querySelector('#sel-in-role')?.addEventListener('change', e => {
      _sh.roleIn = e.target.value;
      _sh.accountIn = lastAcct(_sh.roleIn);
      renderSheet();
    });
    _sheetEl.querySelector('#sel-in-acct')?.addEventListener('change', e => { _sh.accountIn = e.target.value; });
    _sheetEl.querySelector('#sel-tr-proj')?.addEventListener('change', e => {
      const val = e.target.value;
      _sh.project = val;
      const p = Store.get().projects.find(x => x.name === val);
      if (val && p?.ownerRole && CFG.ROLES.includes(p.ownerRole)) {
        _sh.roleIn = p.ownerRole;
        const names = acctsForRole(p.ownerRole).map(a => a.name);
        _sh.accountIn = (p.defaultAccount && names.includes(p.defaultAccount)) ? p.defaultAccount : (names[0] || '');
      }
      renderSheet();
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submitSheet() {
    const amount = parseFloat(_sh.amount);
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    const memo = (_sh.memo || '').trim();
    const date = _date.replace(/-/g, '/');
    let row, extra = null, usedRole, usedAcct;

    if (_sh.kind === 'cat') {
      if (!_sh.account) return Utils.toast('請選擇帳戶', 'warn');
      row = [Utils.uid(), _sh.role, '日常', '', '支出', _sh.category, memo, date, amount, _sh.account, '', '', _sh.payRole || '', _sh.payAccount || ''];
      usedRole = _sh.role; usedAcct = _sh.account;
      if (_sh.autoTransfer && _sh.payAccount) {
        const pi = getPaymentInfo(_sh.payAccount);
        if (pi && _sh.transferFrom) {
          extra = [Utils.uid(), _sh.role, '日常', '', '轉帳', '代付補款', `補款／${_sh.payAccount}`,
                   date, amount, _sh.transferFrom, pi.role, pi.account, '', ''];
        }
      }
    } else if (_sh.kind === 'income') {
      if (!_sh.category) return Utils.toast('請選擇收入分類', 'warn');
      if (!_sh.account)  return Utils.toast('請選擇帳戶', 'warn');
      row = [Utils.uid(), _sh.role, '', '', '收入', _sh.category, memo, date, amount, _sh.account, '', '', '', ''];
      usedRole = _sh.role; usedAcct = _sh.account;
    } else if (_sh.kind === 'proj') {
      if (!_sh.project) return Utils.toast('請選擇專案', 'warn');
      if (!_sh.account) return Utils.toast('請選擇帳戶', 'warn');
      row = [Utils.uid(), _sh.role, '專案', _sh.project, '支出', (_sh.projCat || '').trim(), memo, date, amount,
             _sh.account, '', '', _sh.payRole || '', _sh.payAccount || ''];
      usedRole = _sh.role; usedAcct = _sh.account;
      if (_sh.autoTransfer && _sh.payAccount) {
        const pi = getPaymentInfo(_sh.payAccount);
        if (pi && _sh.transferFrom) {
          extra = [Utils.uid(), _sh.role, '日常', '', '轉帳', '代付補款', `補款／${_sh.payAccount}`,
                   date, amount, _sh.transferFrom, pi.role, pi.account, '', ''];
        }
      }
    } else if (_sh.kind === 'transfer') {
      if (!_sh.accountOut) return Utils.toast('請選擇轉出帳戶', 'warn');
      if (!_sh.accountIn)  return Utils.toast('請選擇轉入帳戶', 'warn');
      const isProj = !!_sh.project;
      row = [Utils.uid(), _sh.roleOut, isProj ? '專案' : '日常', _sh.project || '', '轉帳', '', memo, date, amount,
             _sh.accountOut, _sh.roleIn, _sh.accountIn, '', ''];
      usedRole = _sh.roleOut; usedAcct = _sh.accountOut;
    }

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const btn = _sheetEl?.querySelector('#btn-sheet-submit');
    if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

    try {
      await API.append(sid, 'Ledger!A:N', row);
      if (extra) await API.append(sid, 'Ledger!A:N', extra);
      Store.invalidate();
      if (usedRole && usedAcct) localStorage.setItem(LS_LAST_ACCT(usedRole), usedAcct);
      if (memo) addRecentMemo(memo);
      Utils.toast('記帳成功！', 'success');
      closeSheet();
      _date = todayISO();
      renderMain();
    } catch (err) {
      Utils.toast('儲存失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ 記帳'; }
    }
  }

  return { render, onMount };
})());
