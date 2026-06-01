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
    if (!memo || !memo.trim()) return;
    const m = memo.trim();
    const list = getRecentMemos().filter(x => x !== m);
    list.unshift(m);
    localStorage.setItem(LS_RECENT_MEMOS, JSON.stringify(list.slice(0, 8)));
  }

  function initState() {
    const last   = loadLast();
    const role   = CFG.ROLES.includes(last.roleOut) ? last.roleOut : CFG.ROLES[0];
    const type   = CFG.TX_TYPES.includes(last.type) ? last.type : '支出';
    const accts  = Store.accountsForRole(role);
    const acctOut = accts.includes(last.accountOut) ? last.accountOut : (accts[0] || '');
    const roleIn  = CFG.ROLES.includes(last.roleIn) ? last.roleIn : CFG.ROLES[0];
    const acctsIn = Store.accountsForRole(roleIn);
    const acctIn  = acctsIn.includes(last.accountIn) ? last.accountIn : (acctsIn[0] || '');

    _s = {
      roleOut: role, type, dimension: '日常', projectTag: '',
      category: '', accountOut: acctOut, roleIn, accountIn: acctIn,
      date: new Date().toISOString().slice(0, 10), memo: '', amount: ''
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
    document.getElementById('inp-date')?.addEventListener('change', e => {
      _s.date = e.target.value;
      const today = new Date().toISOString().slice(0, 10);
      const label = document.getElementById('date-label');
      if (label) label.textContent = _s.date === today ? '今天' : _s.date.replace(/-/g, '/');
    });

    document.getElementById('inp-memo')?.addEventListener('input', e => { _s.memo = e.target.value; });

    document.getElementById('sel-project')?.addEventListener('change', e => { _s.projectTag = e.target.value; });
    document.getElementById('sel-project-reserve')?.addEventListener('change', e => { _s.projectTag = e.target.value; });

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
        if (_s.type === '公積金提撥') { _s.projectTag = ''; renderAll(); }
        break;
      case 'set-dim':
        _s.dimension = val; _s.projectTag = ''; _s.category = '';
        renderAll(); break;
      case 'proj-cat-sugg': {
        _s.category = val;
        const inp = document.getElementById('inp-proj-cat');
        if (inp) inp.value = val;
        const sugg = document.getElementById('proj-cat-sugg');
        if (sugg) sugg.innerHTML = '';
        break;
      }
      case 'open-numpad': showNumpad(); break;
      case 'pick-acct-out': showAccountPicker('out'); break;
      case 'pick-acct-in':  showAccountPicker('in');  break;
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

    function rebuildSheet() {
      overlay.innerHTML = `
        <div class="numpad-sheet" id="numpad-sheet">
          <div class="numpad-sheet-handle"></div>
          <div class="numpad-display">${cur || '0'}</div>
          <div class="numpad-keys">
            ${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k =>
              `<button type="button" class="numpad-key${k==='⌫'?' numpad-del':''}" data-key="${k}">${k}</button>`
            ).join('')}
          </div>
          <button type="button" class="numpad-done" id="numpad-done">完成</button>
        </div>`;
    }

    rebuildSheet();
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.querySelector('#numpad-sheet')?.classList.add('open'));

    function commit() {
      _s.amount = cur;
      const disp = document.getElementById('entry-amount-display');
      if (disp) disp.textContent = cur || '0';
      overlay.querySelector('#numpad-sheet')?.classList.remove('open');
      setTimeout(() => overlay.remove(), 280);
    }

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { commit(); return; }
      if (e.target.closest('#numpad-done')) { commit(); return; }
      const key = e.target.closest('[data-key]');
      if (!key) return;
      const k = key.dataset.key;
      if (k === '⌫') {
        cur = cur.slice(0, -1);
      } else if (k === '.') {
        if (!cur.includes('.')) cur = (cur || '0') + '.';
      } else {
        cur = cur === '0' ? k : cur + k;
      }
      const disp = overlay.querySelector('.numpad-display');
      if (disp) disp.textContent = cur || '0';
    });
  }

  // ── Account picker ────────────────────────────────────────────────────────
  function showAccountPicker(side) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const allAccts = Store.allAccountsFlat();
    const pool = side === 'out'
      ? allAccts.filter(a => a.role === _s.roleOut)
      : (_s.type === '公積金提撥' ? allAccts.filter(a => a.role === '家用') : allAccts);

    const TYPE_ORDER = ['現金', '銀行', '信用卡', '證券帳戶'];
    const usedTypes  = TYPE_ORDER.filter(t => pool.some(a => (a.type || '銀行') === t));
    const curName    = side === 'out' ? _s.accountOut : _s.accountIn;
    const curObj     = pool.find(a => a.name === curName);
    let activeType   = curObj?.type || '銀行';
    if (!usedTypes.includes(activeType)) activeType = usedTypes[0] || '銀行';

    const TYPE_ICONS = { '現金': '💵', '銀行': '🏦', '信用卡': '💳', '證券帳戶': '📊' };

    function itemsHtml(type) {
      const items = pool.filter(a => (a.type || '銀行') === type);
      if (!items.length) return '<p class="empty-hint">此類型無帳戶</p>';
      return items.map(a => {
        const cur = side === 'out' ? _s.accountOut === a.name : (_s.accountIn === a.name && _s.roleIn === a.role);
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
      ${pool.length === 0 ? '<p class="empty-hint">無帳戶，請先至設定新增</p>' : ''}
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
        modal.querySelectorAll('.acct-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector('#acct-pick-list').innerHTML = itemsHtml(tab.dataset.type);
        attachItems();
      });
    });

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const isTransfer = _s.type === '轉帳' || _s.type === '公積金提撥';
    const amount = parseFloat(_s.amount);
    const needsProjTag = (_s.type === '支出' && _s.dimension === '專案') ||
                         (_s.type === '公積金提撥' && _s.category === '專案預備金');

    if (!_s.category)           return Utils.toast('請選擇分類', 'warn');
    if (!_s.accountOut)         return Utils.toast('請選擇付款帳戶', 'warn');
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    if (needsProjTag && !_s.projectTag) return Utils.toast('請選擇專案', 'warn');
    if (isTransfer && !_s.accountIn)    return Utils.toast('請選擇對象帳戶', 'warn');

    const memo = _s.memo.trim();
    const row = [
      Utils.uid(), _s.roleOut,
      _s.type === '支出' ? _s.dimension : '',
      needsProjTag ? _s.projectTag : '',
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
      if (memo) addRecentMemo(memo);
      Utils.toast('記帳成功！', 'success');
      _s.category = ''; _s.projectTag = ''; _s.memo = ''; _s.amount = '';
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
    const isTransfer = _s.type === '轉帳' || _s.type === '公積金提撥';
    const isExpense  = _s.type === '支出';
    const cats  = CFG.CATEGORIES[_s.type] || [];
    const today = new Date().toISOString().slice(0, 10);
    const dateLabel = _s.date === today ? '今天' : _s.date.replace(/-/g, '/');
    const recentMemos = getRecentMemos();

    const typeTabs = CFG.TX_TYPES.map(t => {
      const label = t === '公積金提撥' ? '公積金' : t;
      return `<button type="button" class="entry-type-tab${_s.type===t?' active':''}" data-action="type" data-val="${t}">${label}</button>`;
    }).join('');

    const roleTabs = CFG.ROLES.map(r =>
      `<button type="button" class="entry-role-tab${_s.roleOut===r?' active':''}" data-action="role-out" data-val="${r}">${r}</button>`
    ).join('');

    const _acctIconMap = { '現金': '💵', '銀行': '🏦', '信用卡': '💳', '證券帳戶': '📊' };
    function acctIcon(name) {
      const a = Store.allAccountsFlat().find(x => x.name === name);
      return _acctIconMap[a?.type || '銀行'] || '🏦';
    }

    const dateInput = `<input type="date" id="inp-date" value="${_s.date}" style="position:absolute;opacity:0;width:1px;height:1px;top:0;left:0;border:none">`;

    let acctRow;
    if (isTransfer) {
      acctRow = `
        <div class="entry-acct-date-row">
          <div class="entry-acct-transfer" style="flex:1;display:flex;align-items:center;gap:6px">
            <button type="button" class="entry-acct-btn" data-action="pick-acct-out" style="flex:1">
              ${acctIcon(_s.accountOut)} ${_s.accountOut || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
            </button>
            <span style="color:var(--text-muted);font-size:16px">→</span>
            <button type="button" class="entry-acct-btn entry-acct-btn-in" data-action="pick-acct-in" style="flex:1">
              ${acctIcon(_s.accountIn)} ${_s.accountIn || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
            </button>
          </div>
          <label class="entry-date-btn" for="inp-date">
            <span id="date-label">${dateLabel}</span> 📅
            ${dateInput}
          </label>
        </div>`;
    } else {
      acctRow = `
        <div class="entry-acct-date-row">
          <button type="button" class="entry-acct-btn" data-action="pick-acct-out" style="flex:1">
            ${acctIcon(_s.accountOut)} ${_s.accountOut || '選擇帳戶'} <span class="entry-acct-caret">▾</span>
          </button>
          <label class="entry-date-btn" for="inp-date">
            <span id="date-label">${dateLabel}</span> 📅
            ${dateInput}
          </label>
        </div>`;
    }

    const dimTabs = isExpense ? `
      <div class="entry-dim-tabs" style="margin:10px 12px 2px">
        <button type="button" class="entry-dim-tab${_s.dimension==='日常'?' active':''}" data-action="set-dim" data-val="日常">☀️ 日常</button>
        <button type="button" class="entry-dim-tab${_s.dimension==='專案'?' active':''}" data-action="set-dim" data-val="專案">📁 專案</button>
      </div>` : '';

    const projectRow = (isExpense && _s.dimension === '專案') ? `
      <div class="entry-project-row">
        <select id="sel-project" class="form-select" style="font-size:13px;padding:8px 12px">
          <option value="">選擇專案</option>
          ${Store.get().activeProjects.map(p =>
            `<option value="${p}"${_s.projectTag===p?' selected':''}>${p}</option>`
          ).join('')}
        </select>
      </div>` : '';

    const reserveProjectRow = (_s.type === '公積金提撥' && _s.category === '專案預備金') ? `
      <div class="entry-project-row">
        <select id="sel-project-reserve" class="form-select" style="font-size:13px;padding:8px 12px">
          <option value="">選擇要提撥的專案</option>
          ${Store.get().activeProjects.map(p =>
            `<option value="${p}"${_s.projectTag===p?' selected':''}>${p}</option>`
          ).join('')}
        </select>
      </div>` : '';

    let catContent;
    if (isExpense && _s.dimension === '專案') {
      const initSugg = getProjectCatSuggestions();
      catContent = `<div class="entry-cat-section">
        ${projectRow}
        <div class="proj-cat-area" style="margin-top:8px">
          <input type="text" id="inp-proj-cat" class="form-input proj-cat-input"
                 placeholder="輸入分類（如：建材、人工）"
                 value="${_s.category.replace(/"/g,'&quot;')}" autocomplete="off">
          <div class="proj-cat-suggestions" id="proj-cat-sugg">
            ${initSugg.map(c => `<button type="button" class="proj-cat-sugg-item" data-action="proj-cat-sugg" data-val="${c}">${c}</button>`).join('')}
          </div>
        </div>
      </div>`;
    } else {
      catContent = `<div class="entry-cat-section">
        ${reserveProjectRow}
        <div class="entry-cat-grid">${cats.map(c =>
          `<button type="button" class="entry-cat-chip${_s.category===c?' selected':''}" data-action="cat" data-val="${c}">
            <span class="cat-icon">${CAT_ICONS[c]||'📌'}</span><span>${c}</span>
          </button>`
        ).join('')}</div>
      </div>`;
    }

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
      <div class="entry-type-tabs">${typeTabs}</div>
      <div class="entry-role-tabs">${roleTabs}</div>
      ${acctRow}

      <div class="entry-amount-area" data-action="open-numpad">
        <div class="entry-amount-big${!_s.amount?' entry-amount-zero':''}" id="entry-amount-display">${_s.amount || '0'}</div>
      </div>

      ${dimTabs}
      ${catContent}
      ${memoSection}

      <div class="entry-submit-area">
        <button type="button" class="btn btn-primary btn-full btn-lg" id="btn-submit" data-action="submit">記帳 ✓</button>
      </div>
    </div>`;
  }

  return { render, onMount };
})());
