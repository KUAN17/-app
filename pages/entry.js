Router.register('entry', (() => {
  const CAT_ICONS = {
    '食物':'🍱','飲料':'🧋','交通':'🚇','購物':'🛍️',
    '娛樂':'🎮','家用':'🏠','電信':'📱','醫藥':'💊',
    '教育':'📚','醫療保險':'🏥','投資儲蓄':'📈','旅遊':'✈️',
    '訂閱':'📺','信用卡費':'💳',
    '薪資收入':'💰','利息/股息':'📊','業外收入':'💵','現金回饋':'🎁',
    'ATM領現':'🏧','轉帳':'🔄',
    '常態家用':'🏡','專案預備金':'🗂️'
  };
  const LS_LAST = 'ff_entry_last';
  let _s = {};
  let _el = null;

  function loadLast() {
    try { return JSON.parse(localStorage.getItem(LS_LAST) || '{}'); } catch { return {}; }
  }

  function initState() {
    const last = loadLast();
    const role    = CFG.ROLES.includes(last.roleOut) ? last.roleOut : CFG.ROLES[0];
    const type    = CFG.TX_TYPES.includes(last.type) ? last.type : '支出';
    const accts   = Store.accountsForRole(role);
    const acctOut = accts.includes(last.accountOut) ? last.accountOut : (accts[0] || '');
    const roleIn  = CFG.ROLES.includes(last.roleIn) ? last.roleIn : CFG.ROLES[0];
    const acctsIn = Store.accountsForRole(roleIn);
    const acctIn  = acctsIn.includes(last.accountIn) ? last.accountIn : (acctsIn[0] || '');

    _s = {
      roleOut: role, type, dimension: '日常', projectTag: '',
      category: '', accountOut: acctOut, roleIn, accountIn: acctIn,
      date: new Date().toISOString().slice(0, 10), memo: '', showMemo: false
    };

    if (type === '公積金提撥') {
      _s.roleIn = '家用';
      const ha = Store.accountsForRole('家用');
      if (!ha.includes(_s.accountIn)) _s.accountIn = ha[0] || '';
    }
  }

  function saveLast() {
    localStorage.setItem(LS_LAST, JSON.stringify({
      roleOut: _s.roleOut, type: _s.type,
      accountOut: _s.accountOut, roleIn: _s.roleIn, accountIn: _s.accountIn
    }));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(el) {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    _el = Utils.el('page-content');
    await Store.load();
    initState();
    renderAll();
  }

  function renderAll(keepFocus) {
    _el.removeEventListener('click', handleClick);
    _el.innerHTML = buildHTML();
    _el.addEventListener('click', handleClick);

    // Date input change
    document.getElementById('inp-date')?.addEventListener('change', e => {
      _s.date = e.target.value;
      const today = new Date().toISOString().slice(0, 10);
      const label = document.getElementById('date-chip-label');
      if (label) label.textContent = '📅 ' + (_s.date === today ? '今天' : _s.date.replace(/-/g, '/'));
    });

    // Memo input
    document.getElementById('inp-memo')?.addEventListener('input', e => { _s.memo = e.target.value; });

    // Project select
    document.getElementById('sel-project')?.addEventListener('change', e => { _s.projectTag = e.target.value; });

    // Auto-focus amount (unless keepFocus flag set for memo)
    if (!keepFocus) {
      setTimeout(() => document.getElementById('inp-amount')?.focus(), 80);
    } else {
      setTimeout(() => document.getElementById('inp-memo')?.focus(), 80);
    }
  }

  function handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    // Don't intercept clicks inside the date label (let them reach the date input)
    if (btn.dataset.action === 'date-chip') return;
    handleAction(btn.dataset.action, btn.dataset.val);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleAction(action, val) {
    switch (action) {
      case 'role-out': {
        _s.roleOut = val;
        const a = Store.accountsForRole(val);
        _s.accountOut = a[0] || '';
        renderAll(); break;
      }
      case 'type': {
        _s.type = val; _s.category = ''; _s.dimension = '日常'; _s.projectTag = '';
        if (val === '公積金提撥') {
          _s.roleIn = '家用';
          const ha = Store.accountsForRole('家用');
          _s.accountIn = ha[0] || '';
        }
        renderAll(); break;
      }
      case 'cat':
        _s.category = val;
        _el.querySelectorAll('.entry-cat-chip').forEach(c =>
          c.classList.toggle('selected', c.dataset.val === val));
        break;
      case 'toggle-dim':
        _s.dimension = _s.dimension === '日常' ? '專案' : '日常';
        _s.projectTag = '';
        renderAll(); break;
      case 'pick-acct-out': showAccountPicker('out'); break;
      case 'pick-acct-in':  showAccountPicker('in');  break;
      case 'toggle-memo':
        _s.showMemo = !_s.showMemo;
        renderAll(_s.showMemo);
        break;
      case 'submit': handleSubmit(); break;
    }
  }

  // ── Account picker ────────────────────────────────────────────────────────
  function showAccountPicker(side) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const roles = (side === 'in' && _s.type !== '公積金提撥') ? CFG.ROLES : (side === 'in' ? ['家用'] : [_s.roleOut]);

    const items = roles.flatMap(role =>
      Store.accountsForRole(role).map(a => {
        const cur = side === 'out' ? _s.accountOut === a : (_s.accountIn === a && _s.roleIn === role);
        return `<div class="acct-pick-item${cur?' active':''}" data-role="${role}" data-acct="${a}">
          <span class="balance-role-badge">${role}</span>
          <span>${a}</span>
          ${cur ? '<span class="acct-pick-check">✓</span>' : ''}
        </div>`;
      })
    ).join('');

    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">${side === 'out' ? '付款帳戶' : '對象帳戶'}</div>
      ${items || '<p class="empty-hint">無帳戶，請先至設定新增</p>'}
    </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('.acct-pick-item').forEach(item => {
      item.addEventListener('click', () => {
        if (side === 'out') { _s.accountOut = item.dataset.acct; }
        else { _s.roleIn = item.dataset.role; _s.accountIn = item.dataset.acct; }
        modal.remove();
        renderAll();
      });
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const isTransfer = _s.type === '轉帳' || _s.type === '公積金提撥';
    const amount = parseFloat(document.getElementById('inp-amount')?.value || '');

    if (!_s.category)           return Utils.toast('請選擇分類', 'warn');
    if (!_s.accountOut)         return Utils.toast('請選擇付款帳戶', 'warn');
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    if (_s.type === '支出' && _s.dimension === '專案' && !_s.projectTag)
      return Utils.toast('請選擇專案', 'warn');
    if (isTransfer && !_s.accountIn) return Utils.toast('請選擇對象帳戶', 'warn');

    const memo = document.getElementById('inp-memo')?.value?.trim() || '';
    const row = [
      Utils.uid(), _s.roleOut,
      _s.type === '支出' ? _s.dimension : '',
      _s.type === '支出' && _s.dimension === '專案' ? _s.projectTag : '',
      _s.type, _s.category, memo,
      _s.date.replace(/-/g, '/'), amount, _s.accountOut,
      isTransfer ? _s.roleIn : '', isTransfer ? _s.accountIn : ''
    ];

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const btn = document.getElementById('btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

    try {
      await API.append(sid, 'Ledger!A:L', row);
      Store.invalidate();
      saveLast();
      Utils.toast('記帳成功！', 'success');
      _s.category = ''; _s.projectTag = ''; _s.memo = ''; _s.showMemo = false;
      _s.date = new Date().toISOString().slice(0, 10);
      renderAll();
    } catch (err) {
      Utils.toast('儲存失敗：' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '記帳 ✓'; }
    }
  }

  // ── Build HTML ────────────────────────────────────────────────────────────
  function buildHTML() {
    const isTransfer = _s.type === '轉帳' || _s.type === '公積金提撥';
    const isExpense  = _s.type === '支出';
    const cats = CFG.CATEGORIES[_s.type] || [];
    const today = new Date().toISOString().slice(0, 10);
    const dateLabel = _s.date === today ? '今天' : _s.date.replace(/-/g, '/');

    const roleBtns = CFG.ROLES.map(r =>
      `<button type="button" class="entry-seg-btn${_s.roleOut===r?' active':''}" data-action="role-out" data-val="${r}">${r}</button>`
    ).join('');

    const typeBtns = CFG.TX_TYPES.map(t => {
      const label = t === '公積金提撥' ? '公積金' : t;
      return `<button type="button" class="entry-seg-btn entry-seg-type${_s.type===t?' active':''}${t==='公積金提撥'?' entry-seg-xs':''}" data-action="type" data-val="${t}">${label}</button>`;
    }).join('');

    const acctOutName = _s.accountOut || '選擇帳戶';
    const acctInName  = _s.accountIn  || '選擇帳戶';

    const acctChips = isTransfer ? `
      <button type="button" class="entry-chip entry-chip-acct" data-action="pick-acct-out">💳 ${acctOutName} ▾</button>
      <span class="chip-arrow">→</span>
      <button type="button" class="entry-chip entry-chip-acct-in" data-action="pick-acct-in">🏦 ${acctInName} ▾</button>
    ` : `
      <button type="button" class="entry-chip entry-chip-acct" data-action="pick-acct-out">💳 ${acctOutName} ▾</button>
    `;

    // Date chip: label wraps a hidden date input so clicking triggers native picker
    const dateChip = `
      <label class="entry-chip entry-chip-date" for="inp-date">
        <span id="date-chip-label">📅 ${dateLabel}</span>
        <input type="date" id="inp-date" value="${_s.date}"
               style="position:absolute;opacity:0;width:1px;height:1px;overflow:hidden;pointer-events:none">
      </label>`;

    const memoChip = `<button type="button" class="entry-chip entry-chip-memo${_s.showMemo?' entry-chip-active':''}" data-action="toggle-memo">✏️ 備忘</button>`;

    const memoBar = _s.showMemo ? `
      <div class="entry-memo-bar">
        <input type="text" id="inp-memo" class="entry-memo-input" placeholder="備忘（選填）" value="${_s.memo}">
      </div>` : '';

    const dimChip = isExpense ? `
      <button type="button" class="entry-chip${_s.dimension==='專案'?' entry-chip-dim-on':' entry-chip-dim'}" data-action="toggle-dim">
        ${_s.dimension === '專案' ? '📁 專案' : '☀️ 日常'}
      </button>` : '';

    const projectRow = (isExpense && _s.dimension === '專案') ? `
      <div class="entry-project-row">
        <select id="sel-project" class="form-select" style="font-size:13px;padding:8px 12px">
          <option value="">選擇專案</option>
          ${Store.get().activeProjects.map(p =>
            `<option value="${p}"${_s.projectTag===p?' selected':''}>${p}</option>`
          ).join('')}
        </select>
      </div>` : '';

    const catGrid = cats.map(c =>
      `<button type="button" class="entry-cat-chip${_s.category===c?' selected':''}" data-action="cat" data-val="${c}">
        <span class="cat-icon">${CAT_ICONS[c]||'📌'}</span><span>${c}</span>
      </button>`
    ).join('');

    return `<div class="entry-wrapper">
      <div class="entry-segs">
        <div class="entry-seg-row">${roleBtns}</div>
        <div class="entry-seg-row entry-seg-row-type">${typeBtns}</div>
      </div>

      <div class="entry-amount-area">
        <div class="entry-amount-label">金額</div>
        <input type="text" inputmode="decimal" id="inp-amount"
               class="entry-amount-input" placeholder="0" autocomplete="off">
        <div class="entry-chips" style="margin-top:10px">
          ${acctChips}
          ${dateChip}
          ${dimChip}
          ${memoChip}
        </div>
        ${memoBar}
      </div>

      ${projectRow}

      <div class="entry-cat-section">
        <div class="entry-cat-grid">${catGrid}</div>
      </div>

      <div class="entry-submit-area">
        <button type="button" class="btn btn-primary btn-full btn-lg" id="btn-submit" data-action="submit">記帳 ✓</button>
      </div>
    </div>`;
  }

  return { render, onMount };
})());
