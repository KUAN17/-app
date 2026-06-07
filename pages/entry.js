Router.register('entry', (() => {
  const CAT_ICONS = {
    '食物':'🍱','飲料':'🧋','交通':'🚇','購物':'🛍️',
    '娛樂':'🎮','家用':'🏠','電信':'📱','醫藥':'💊',
    '教育':'📚','醫療保險':'🏥','投資儲蓄':'📈','旅遊':'✈️',
    '訂閱':'📺','信用卡費':'💳',
    '薪資收入':'💰','利息/股息':'📊','現金回饋':'🎁','其他':'💵'
  };
  const LS_LAST         = 'ff_entry_last';
  const LS_RECENT_MEMOS = 'ff_recent_memos';
  let _s  = {};
  let _el = null;

  function loadLast() {
    try { return JSON.parse(localStorage.getItem(LS_LAST) || '{}'); } catch { return {}; }
  }

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

  function initState() {
    const last    = loadLast();
    const type    = CFG.TX_TYPES.includes(last.type) ? last.type : '支出';
    const role    = CFG.ROLES.includes(last.roleOut) ? last.roleOut : CFG.ROLES[0];
    const accts   = Store.accountsForRole(role);
    const acctOut = accts.includes(last.accountOut) ? last.accountOut : (accts[0] || '');
    const roleIn  = CFG.ROLES.includes(last.roleIn) ? last.roleIn : CFG.ROLES[0];
    const acctsIn = Store.accountsForRole(roleIn);
    const acctIn  = acctsIn.includes(last.accountIn) ? last.accountIn : (acctsIn[0] || '');

    _s = {
      type, dimension: '日常', projectTag: '', category: '',
      roleOut: role, accountOut: acctOut,
      roleIn, accountIn: acctIn,
      date: new Date().toISOString().slice(0, 10),
      memo: '', amount: '',
      payRole: '', payAccount: ''
    };
  }

  function saveLast() {
    localStorage.setItem(LS_LAST, JSON.stringify({
      roleOut: _s.roleOut, type: _s.type,
      accountOut: _s.accountOut, roleIn: _s.roleIn, accountIn: _s.accountIn
    }));
  }

  function render(el) {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    _el = Utils.el('page-content');
    await Store.load();
    initState();
    renderAll();
  }

  function renderAll() {
    _el.removeEventListener('click', handleClick);
    _el.innerHTML = buildHTML();
    _el.addEventListener('click', handleClick);
    attachListeners();
  }

  function attachListeners() {
    document.getElementById('date-trigger')?.addEventListener('click', () => {
      const inp = document.getElementById('inp-date');
      if (!inp) return;
      try { inp.showPicker(); } catch { inp.click(); }
    });

    document.getElementById('inp-date')?.addEventListener('change', e => {
      _s.date = e.target.value;
      const today = new Date().toISOString().slice(0, 10);
      const label = document.getElementById('date-label');
      if (label) label.textContent = _s.date === today ? '今天' : _s.date.replace(/-/g, '/');
    });

    document.getElementById('inp-memo')?.addEventListener('input', e => { _s.memo = e.target.value; });

    document.getElementById('sel-project-main')?.addEventListener('change', e => {
      handleAction('sel-proj', e.target.value);
    });

    const projCatEl = document.getElementById('inp-proj-cat');
    if (projCatEl) {
      projCatEl.addEventListener('input', e => {
        _s.category = e.target.value;
        const q = e.target.value;
        const sugg = document.getElementById('proj-cat-sugg');
        if (sugg) sugg.innerHTML = getProjectCatSuggestions()
          .filter(c => !q || c.includes(q))
          .map(c => `<button type="button" class="proj-cat-sugg-item" data-action="proj-cat-sugg" data-val="${c}">${c}</button>`)
          .join('');
      });
    }
  }

  function handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    handleAction(btn.dataset.action, btn.dataset.val);
  }

  function handleAction(action, val) {
    switch (action) {
      case 'type': {
        _s.type = val; _s.category = ''; _s.dimension = '日常';
        _s.projectTag = ''; _s.payRole = ''; _s.payAccount = '';
        renderAll(); break;
      }
      case 'set-dim': {
        _s.dimension = val; _s.projectTag = ''; _s.category = '';
        _s.payRole = ''; _s.payAccount = '';
        renderAll(); break;
      }
      case 'role-out': {
        _s.roleOut = val;
        _s.accountOut = Store.accountsForRole(val)[0] || '';
        renderAll(); break;
      }
      case 'sel-proj': {
        _s.projectTag = val;
        if (val) {
          const proj = Store.get().projects.find(p => p.name === val);
          if (_s.type === '轉帳') {
            // 轉帳+專案：鎖定轉入角色/帳戶為專案綁定
            if (proj?.ownerRole && CFG.ROLES.includes(proj.ownerRole)) {
              _s.roleIn = proj.ownerRole;
              const accts = Store.accountsForRole(proj.ownerRole);
              _s.accountIn = (proj.defaultAccount && accts.includes(proj.defaultAccount))
                ? proj.defaultAccount : (accts[0] || '');
            }
          } else {
            // 支出+專案：鎖定轉出角色/帳戶為專案歸屬
            if (proj?.ownerRole && CFG.ROLES.includes(proj.ownerRole)) {
              _s.roleOut = proj.ownerRole;
              const accts = Store.accountsForRole(proj.ownerRole);
              _s.accountOut = (proj.defaultAccount && accts.includes(proj.defaultAccount))
                ? proj.defaultAccount : (accts[0] || '');
            }
          }
        }
        renderAll(); break;
      }
      case 'cat':
        _s.category = val;
        _el.querySelectorAll('.entry-cat-chip').forEach(c =>
          c.classList.toggle('selected', c.dataset.val === val));
        break;
      case 'proj-cat-sugg': {
        _s.category = val;
        const inp = document.getElementById('inp-proj-cat');
        if (inp) inp.value = val;
        const sugg = document.getElementById('proj-cat-sugg');
        if (sugg) sugg.innerHTML = '';
        break;
      }
      case 'open-numpad':  showNumpad(); break;
      case 'pick-acct-out': showAccountPicker('out'); break;
      case 'pick-acct-in':  showAccountPicker('in');  break;
      case 'add-pay':   showPayPicker(); break;
      case 'clear-pay':
        _s.payRole = ''; _s.payAccount = '';
        renderAll(); break;
      case 'memo-chip': {
        _s.memo = val;
        const inp = document.getElementById('inp-memo');
        if (inp) inp.value = val;
        _el.querySelectorAll('.entry-memo-chip').forEach(c =>
          c.classList.toggle('active', c.dataset.val === val));
        break;
      }
      case 'submit': handleSubmit(); break;
    }
  }

  // ── Numpad bottom sheet ───────────────────────────────────────────────────
  function showNumpad() {
    document.getElementById('numpad-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'numpad-overlay';
    overlay.className = 'numpad-overlay';
    let cur = _s.amount || '';

    overlay.innerHTML = `
      <div class="numpad-sheet" id="numpad-sheet">
        <div class="numpad-sheet-handle"></div>
        <div class="numpad-display" id="numpad-disp">${cur || '0'}</div>
        <div class="numpad-keys">
          ${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k =>
            `<button type="button" class="numpad-key${k==='⌫'?' numpad-del':''}" data-key="${k}">${k}</button>`
          ).join('')}
        </div>
        <button type="button" class="numpad-done" id="numpad-done">完成</button>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.querySelector('#numpad-sheet')?.classList.add('open'));

    function commit() {
      _s.amount = cur;
      const disp = document.getElementById('entry-amount-display');
      if (disp) {
        disp.textContent = cur || '0';
        disp.classList.toggle('entry-amount-zero', !cur);
      }
      overlay.querySelector('#numpad-sheet')?.classList.remove('open');
      setTimeout(() => overlay.remove(), 280);
    }

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { commit(); return; }
      if (e.target.closest('#numpad-done')) { commit(); return; }
      const key = e.target.closest('[data-key]');
      if (!key) return;
      const k = key.dataset.key;
      if (k === '⌫') { cur = cur.slice(0, -1); }
      else if (k === '.') { if (!cur.includes('.')) cur = (cur || '0') + '.'; }
      else { cur = cur === '0' ? k : cur + k; }
      const disp = overlay.querySelector('#numpad-disp');
      if (disp) disp.textContent = cur || '0';
    });
  }

  // ── Account picker ────────────────────────────────────────────────────────
  function showAccountPicker(side) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    // 記帳頁不顯示證券帳戶
    const allAccts = Store.allAccountsFlat().filter(a => a.type !== '證券帳戶');
    const isTransfer = _s.type === '轉帳';

    if (isTransfer) {
      // 轉帳：以角色分頁，方便跨角色選帳戶
      const curRole = side === 'out' ? _s.roleOut : _s.roleIn;
      const curAcct = side === 'out' ? _s.accountOut : _s.accountIn;
      let activeRole = CFG.ROLES.includes(curRole) ? curRole : CFG.ROLES[0];

      function roleItemsHtml(role) {
        const items = allAccts.filter(a => a.role === role);
        if (!items.length) return '<p class="empty-hint">此角色無帳戶</p>';
        return items.map(a => {
          const cur = a.name === curAcct && a.role === (side === 'out' ? _s.roleOut : _s.roleIn);
          return `<div class="acct-pick-item${cur?' active':''}" data-role="${a.role}" data-acct="${a.name.replace(/"/g,'&quot;')}">
            <span>${a.name}</span>
            ${cur ? '<span class="acct-pick-check">✓</span>' : ''}
          </div>`;
        }).join('');
      }

      const tabsHtml = `<div class="acct-type-tabs">${CFG.ROLES.map(r =>
        `<button class="acct-type-tab${r===activeRole?' active':''}" data-role-tab="${r}">${r}</button>`
      ).join('')}</div>`;

      modal.innerHTML = `<div class="modal-card">
        <div class="modal-title">${side === 'out' ? '付款帳戶' : '對象帳戶'}</div>
        ${tabsHtml}
        <div id="acct-pick-list">${roleItemsHtml(activeRole)}</div>
      </div>`;
      document.body.appendChild(modal);

      function attachItems() {
        modal.querySelectorAll('.acct-pick-item').forEach(item => {
          item.addEventListener('click', () => {
            if (side === 'out') { _s.accountOut = item.dataset.acct; _s.roleOut = item.dataset.role; }
            else { _s.roleIn = item.dataset.role; _s.accountIn = item.dataset.acct; }
            modal.remove(); renderAll();
          });
        });
      }
      attachItems();

      modal.querySelectorAll('[data-role-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
          const role = tab.dataset.roleTab;
          const items = allAccts.filter(a => a.role === role);
          if (items.length === 1) {
            // 單一帳戶直接自動選取
            if (side === 'out') { _s.accountOut = items[0].name; _s.roleOut = items[0].role; }
            else { _s.roleIn = items[0].role; _s.accountIn = items[0].name; }
            modal.remove(); renderAll(); return;
          }
          modal.querySelectorAll('[data-role-tab]').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          modal.querySelector('#acct-pick-list').innerHTML = roleItemsHtml(role);
          attachItems();
        });
      });
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      return;
    }

    // 支出/收入：依 roleOut 過濾，以帳戶類型分頁
    const pool = side === 'out' ? allAccts.filter(a => a.role === _s.roleOut) : allAccts;
    const TYPE_ORDER = ['現金', '銀行', '信用卡'];
    const TYPE_ICONS = { '現金': '💵', '銀行': '🏦', '信用卡': '💳' };
    const usedTypes  = TYPE_ORDER.filter(t => pool.some(a => (a.type || '銀行') === t));
    const curName    = side === 'out' ? _s.accountOut : _s.accountIn;
    const curRole    = side === 'out' ? _s.roleOut : _s.roleIn;
    const curObj     = pool.find(a => a.name === curName && a.role === curRole);
    let activeType   = curObj?.type || '銀行';
    if (!usedTypes.includes(activeType)) activeType = usedTypes[0] || '銀行';

    function itemsHtml(type) {
      const items = pool.filter(a => (a.type || '銀行') === type);
      if (!items.length) return '<p class="empty-hint">此類型無帳戶</p>';
      return items.map(a => {
        const cur = side === 'out'
          ? (_s.accountOut === a.name && _s.roleOut === a.role)
          : (_s.accountIn === a.name && _s.roleIn === a.role);
        return `<div class="acct-pick-item${cur?' active':''}" data-role="${a.role}" data-acct="${a.name.replace(/"/g,'&quot;')}">
          <span class="balance-role-badge">${a.role}</span>
          <span>${a.name}</span>
          ${cur ? '<span class="acct-pick-check">✓</span>' : ''}
        </div>`;
      }).join('');
    }

    const tabsHtml = usedTypes.length > 0
      ? `<div class="acct-type-tabs">${usedTypes.map(t =>
          `<button class="acct-type-tab${t===activeType?' active':''}" data-type="${t}">${TYPE_ICONS[t]||''} ${t}</button>`
        ).join('')}</div>`
      : '';

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">${side === 'out' ? '付款帳戶' : '對象帳戶'}</div>
      ${tabsHtml}
      <div id="acct-pick-list">${itemsHtml(activeType)}</div>
      ${!pool.length ? '<p class="empty-hint">無帳戶，請至設定新增</p>' : ''}
    </div>`;
    document.body.appendChild(modal);

    function attachItems() {
      modal.querySelectorAll('.acct-pick-item').forEach(item => {
        item.addEventListener('click', () => {
          if (side === 'out') { _s.accountOut = item.dataset.acct; }
          else { _s.roleIn = item.dataset.role; _s.accountIn = item.dataset.acct; }
          modal.remove(); renderAll();
        });
      });
    }
    attachItems();

    modal.querySelectorAll('.acct-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        const items = pool.filter(a => (a.type || '銀行') === type);
        if (items.length === 1) {
          // 單一帳戶直接自動選取
          if (side === 'out') { _s.accountOut = items[0].name; }
          else { _s.roleIn = items[0].role; _s.accountIn = items[0].name; }
          modal.remove(); renderAll(); return;
        }
        modal.querySelectorAll('.acct-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector('#acct-pick-list').innerHTML = itemsHtml(type);
        attachItems();
      });
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── 代付帳戶 picker ───────────────────────────────────────────────────────
  function showPayPicker() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const allAccts = Store.allAccountsFlat().filter(a => a.name !== _s.accountOut && a.type !== '證券帳戶');

    const TYPE_ORDER = ['信用卡', '現金', '銀行', '證券帳戶'];
    const TYPE_ICONS = { '現金': '💵', '銀行': '🏦', '信用卡': '💳', '證券帳戶': '📊' };
    const usedTypes  = TYPE_ORDER.filter(t => allAccts.some(a => (a.type || '銀行') === t));
    let activeType   = usedTypes.includes('信用卡') ? '信用卡' : (usedTypes[0] || '銀行');

    function itemsHtml(type) {
      const items = allAccts.filter(a => (a.type || '銀行') === type);
      if (!items.length) return '<p class="empty-hint">此類型無帳戶</p>';
      return items.map(a => {
        const cur = _s.payAccount === a.name && _s.payRole === a.role;
        return `<div class="acct-pick-item${cur?' active':''}" data-role="${a.role}" data-acct="${a.name.replace(/"/g,'&quot;')}">
          <span class="balance-role-badge">${a.role}</span>
          <span>${a.name}</span>
          ${cur ? '<span class="acct-pick-check">✓</span>' : ''}
        </div>`;
      }).join('');
    }

    const tabsHtml = `<div class="acct-type-tabs">${usedTypes.map(t =>
      `<button class="acct-type-tab${t===activeType?' active':''}" data-type="${t}">${TYPE_ICONS[t]||''} ${t}</button>`
    ).join('')}</div>`;

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">代付帳戶</div>
      <p class="input-hint" style="margin:0 0 8px">實際刷卡的帳戶，費用仍歸屬上方角色</p>
      ${tabsHtml}
      <div id="pay-pick-list">${itemsHtml(activeType)}</div>
    </div>`;
    document.body.appendChild(modal);

    function attachItems() {
      modal.querySelectorAll('.acct-pick-item').forEach(item => {
        item.addEventListener('click', () => {
          _s.payRole = item.dataset.role;
          _s.payAccount = item.dataset.acct;
          modal.remove(); renderAll();
        });
      });
    }
    attachItems();
    modal.querySelectorAll('.acct-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.acct-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector('#pay-pick-list').innerHTML = itemsHtml(tab.dataset.type);
        attachItems();
      });
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const isTransfer = _s.type === '轉帳';
    const isExpense  = _s.type === '支出';
    const isProjMode = (isExpense || isTransfer) && _s.dimension === '專案';
    const amount     = parseFloat(_s.amount);
    const catRequired = !isTransfer && !(isExpense && _s.dimension === '專案');

    if (catRequired && !_s.category) return Utils.toast('請選擇分類', 'warn');
    if (!_s.accountOut)              return Utils.toast('請選擇付款帳戶', 'warn');
    if (!amount || amount <= 0)      return Utils.toast('請輸入有效金額', 'warn');
    if (isProjMode && !_s.projectTag) return Utils.toast('請選擇專案', 'warn');
    if (isTransfer && !_s.accountIn)  return Utils.toast('請選擇對象帳戶', 'warn');

    const memo = _s.memo.trim();
    const row = [
      Utils.uid(), _s.roleOut,
      (isExpense || isTransfer) ? _s.dimension : '',
      isProjMode ? _s.projectTag : '',
      _s.type, _s.category, memo,
      _s.date.replace(/-/g, '/'), amount, _s.accountOut,
      isTransfer ? _s.roleIn : '', isTransfer ? _s.accountIn : '',
      _s.payRole || '', _s.payAccount || ''
    ];

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const btn = document.getElementById('btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

    try {
      await API.append(sid, 'Ledger!A:N', row);
      Store.invalidate();
      saveLast();
      if (memo) addRecentMemo(memo);
      Utils.toast('記帳成功！', 'success');
      _s.category = ''; _s.projectTag = ''; _s.memo = ''; _s.amount = '';
      _s.payRole = ''; _s.payAccount = '';
      _s.date = new Date().toISOString().slice(0, 10);
      renderAll();
    } catch (err) {
      Utils.toast('儲存失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '記帳 ✓'; }
    }
  }

  function getProjectCatSuggestions() {
    return [...new Set(
      Store.get().ledger
        .filter(tx => tx.dimension === '專案' && tx.type === '支出' && tx.category)
        .map(tx => tx.category)
    )];
  }

  // ── Build HTML ────────────────────────────────────────────────────────────
  function buildHTML() {
    const isTransfer = _s.type === '轉帳';
    const isExpense  = _s.type === '支出';
    const isProjMode = (isExpense || isTransfer) && _s.dimension === '專案';
    const cats  = CFG.CATEGORIES[_s.type] || [];
    const today = new Date().toISOString().slice(0, 10);
    const dateLabel = _s.date === today ? '今天' : _s.date.replace(/-/g, '/');
    const recentMemos = getRecentMemos();

    const _acctIconMap = { '現金': '💵', '銀行': '🏦', '信用卡': '💳', '證券帳戶': '📊' };
    function acctIcon(name) {
      const a = Store.allAccountsFlat().find(x => x.name === name);
      return _acctIconMap[a?.type || '銀行'] || '🏦';
    }

    const lockedProj = isProjMode && _s.projectTag
      ? Store.get().projects.find(p => p.name === _s.projectTag)
      : null;

    // 1. Date (最上方，type tabs 之前)
    const dateSection = `
      <div class="entry-date-standalone" id="date-trigger">
        <span style="position:absolute;left:16px">📅</span>
        <span id="date-label" style="font-weight:600">${dateLabel}</span>
        <span style="position:absolute;right:16px;color:var(--text-muted)">›</span>
        <input type="date" id="inp-date" value="${_s.date}"
               style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;border:none">
      </div>`;

    // 2. Type tabs
    const typeTabs = CFG.TX_TYPES.map(t =>
      `<button type="button" class="entry-type-tab${_s.type===t?' active':''}" data-action="type" data-val="${t}">${t}</button>`
    ).join('');

    // 3. Dim tabs（支出 和 轉帳 都有）
    const dimSection = (isExpense || isTransfer) ? `
      <div class="entry-dim-section">
        <button type="button" class="entry-dim-tab${_s.dimension==='日常'?' active':''}" data-action="set-dim" data-val="日常">☀️ 日常</button>
        <button type="button" class="entry-dim-tab${_s.dimension==='專案'?' active':''}" data-action="set-dim" data-val="專案">📁 專案</button>
      </div>` : '';

    // 4. Project selector
    const activeProjList = Store.get().projects.filter(p => p.status === '進行中');
    const projSelect = isProjMode ? `
      <div class="entry-proj-select-row">
        <select id="sel-project-main" class="form-select entry-proj-select">
          <option value="">選擇專案</option>
          ${activeProjList.map(p =>
            `<option value="${p.name}"${_s.projectTag===p.name?' selected':''}>${p.name}</option>`
          ).join('')}
        </select>
      </div>` : '';

    // 5. Role tabs（支出/收入；轉帳不顯示角色列）
    let roleSection = '';
    if (!isTransfer) {
      if (isExpense && lockedProj?.ownerRole) {
        roleSection = `
          <div class="entry-role-tabs">
            <div class="entry-role-locked">
              <span>🔒</span>
              <span>${lockedProj.ownerRole}</span>
              <span class="entry-role-lock-hint">專案歸屬角色</span>
            </div>
          </div>`;
      } else {
        roleSection = `
          <div class="entry-role-tabs">${CFG.ROLES.map(r =>
            `<button type="button" class="entry-role-tab${_s.roleOut===r?' active':''}" data-action="role-out" data-val="${r}">${r}</button>`
          ).join('')}</div>`;
      }
    }

    // 6. Account row
    let acctRow;
    if (isTransfer) {
      const inLocked = isProjMode && lockedProj?.ownerRole;
      const inDisplay = inLocked
        ? `<div class="entry-acct-locked" style="flex:1">
            <span>🔒</span>
            <span>${_s.accountIn || lockedProj.defaultAccount || lockedProj.ownerRole}</span>
            <span class="entry-acct-lock-hint">專案帳戶</span>
           </div>`
        : `<button type="button" class="entry-acct-btn entry-acct-btn-in" data-action="pick-acct-in" style="flex:1">
            ${acctIcon(_s.accountIn)} ${_s.accountIn || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
           </button>`;
      acctRow = `
        <div class="entry-acct-row">
          <button type="button" class="entry-acct-btn" data-action="pick-acct-out" style="flex:1">
            ${acctIcon(_s.accountOut)} ${_s.accountOut || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
          </button>
          <span style="color:var(--text-muted);flex-shrink:0">→</span>
          ${inDisplay}
        </div>`;
    } else {
      acctRow = `
        <div class="entry-acct-row">
          <button type="button" class="entry-acct-btn" data-action="pick-acct-out">
            ${acctIcon(_s.accountOut)} ${_s.accountOut || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
          </button>
        </div>`;
    }

    // 7. Amount
    const amountSection = `
      <div class="entry-amount-area" data-action="open-numpad">
        <div class="entry-amount-big${!_s.amount?' entry-amount-zero':''}" id="entry-amount-display">${_s.amount || '0'}</div>
      </div>`;

    // 8. Category（轉帳無分類；支出+專案用自由輸入）
    let catSection = '';
    if (!isTransfer) {
      if (isExpense && isProjMode) {
        const initSugg = getProjectCatSuggestions();
        catSection = `<div class="entry-cat-section">
          <div class="proj-cat-area">
            <input type="text" id="inp-proj-cat" class="form-input proj-cat-input"
                   placeholder="分類（選填，例：建材、家電）"
                   value="${_s.category.replace(/"/g,'&quot;')}" autocomplete="off">
            <div class="proj-cat-suggestions" id="proj-cat-sugg">
              ${initSugg.map(c => `<button type="button" class="proj-cat-sugg-item" data-action="proj-cat-sugg" data-val="${c}">${c}</button>`).join('')}
            </div>
          </div>
        </div>`;
      } else {
        catSection = `<div class="entry-cat-section">
          <div class="entry-cat-grid">${cats.map(c =>
            `<button type="button" class="entry-cat-chip${_s.category===c?' selected':''}" data-action="cat" data-val="${c}">
              <span class="cat-icon">${CAT_ICONS[c]||'📌'}</span><span>${c}</span>
            </button>`
          ).join('')}</div>
        </div>`;
      }
    }

    // 9. 代付帳戶（支出+專案 only）
    let paySection = '';
    if (isExpense && isProjMode) {
      paySection = _s.payAccount
        ? `<div class="entry-pay-row">
            <span class="entry-pay-label">代付</span>
            <span class="entry-pay-chip">
              ${acctIcon(_s.payAccount)} ${_s.payRole} / ${_s.payAccount}
              <button type="button" class="entry-pay-clear" data-action="clear-pay">✕</button>
            </span>
           </div>`
        : `<div class="entry-pay-row">
            <button type="button" class="entry-pay-add-btn" data-action="add-pay">＋ 代付帳戶</button>
           </div>`;
    }

    // 10. Memo
    const memoChipsHtml = recentMemos.map(m =>
      `<button type="button" class="entry-memo-chip${_s.memo===m?' active':''}"
               data-action="memo-chip" data-val="${m.replace(/"/g,'&quot;')}">${m}</button>`
    ).join('');

    const memoSection = `
      <div class="entry-memo-section">
        ${recentMemos.length ? `<div class="entry-memo-recents">${memoChipsHtml}</div>` : ''}
        <div class="entry-memo-input-row">
          <span class="entry-memo-icon">✏️</span>
          <input type="text" id="inp-memo" class="entry-memo-input"
                 placeholder="備忘（選填）" value="${_s.memo.replace(/"/g,'&quot;')}" autocomplete="off">
        </div>
      </div>`;

    return `<div class="entry-wrapper">
      ${dateSection}
      <div class="entry-type-tabs">${typeTabs}</div>
      ${dimSection}
      ${projSelect}
      ${roleSection}
      ${acctRow}
      ${amountSection}
      ${catSection}
      ${paySection}
      ${memoSection}
      <div class="entry-submit-area">
        <button type="button" class="btn btn-primary btn-full btn-lg" id="btn-submit" data-action="submit">記帳 ✓</button>
      </div>
    </div>`;
  }

  return { render, onMount };
})());
