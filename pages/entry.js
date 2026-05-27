Router.register('entry', (() => {
  function render(el) {
    el.innerHTML = `<div class="page-inner">
      <form id="entry-form" autocomplete="off">

        <div class="form-row">
          <label>角色（出）</label>
          <div class="seg-group" id="seg-role-out">
            ${CFG.ROLES.map(r => `<button type="button" class="seg-btn" data-val="${r}">${r}</button>`).join('')}
          </div>
        </div>

        <div class="form-row">
          <label>類型</label>
          <div class="seg-group" id="seg-type">
            ${CFG.TX_TYPES.map(t => `<button type="button" class="seg-btn" data-val="${t}">${t}</button>`).join('')}
          </div>
        </div>

        <div class="form-row" id="row-dimension">
          <label>開銷維度</label>
          <div class="seg-group" id="seg-dimension">
            ${CFG.DIMENSIONS.map(d => `<button type="button" class="seg-btn" data-val="${d}">${d}</button>`).join('')}
          </div>
        </div>

        <div class="form-row hidden" id="row-project">
          <label>專案標籤</label>
          <select id="sel-project" class="form-select">
            <option value="">選擇專案</option>
          </select>
        </div>

        <div class="form-row">
          <label>主分類</label>
          <select id="sel-category" class="form-select">
            <option value="">選擇分類</option>
          </select>
        </div>

        <div class="form-row">
          <label>付款帳戶</label>
          <select id="sel-account-out" class="form-select">
            <option value="">選擇帳戶</option>
          </select>
        </div>

        <div class="form-row hidden" id="row-role-in">
          <label>角色（入）</label>
          <div class="seg-group" id="seg-role-in">
            ${CFG.ROLES.map(r => `<button type="button" class="seg-btn" data-val="${r}">${r}</button>`).join('')}
          </div>
        </div>

        <div class="form-row hidden" id="row-account-in">
          <label>對象帳戶</label>
          <select id="sel-account-in" class="form-select">
            <option value="">選擇帳戶</option>
          </select>
        </div>

        <div class="form-row">
          <label>金額</label>
          <input type="number" id="inp-amount" class="form-input" placeholder="0" min="0" inputmode="decimal">
        </div>

        <div class="form-row">
          <label>日期</label>
          <input type="date" id="inp-date" class="form-input" value="${new Date().toISOString().slice(0,10)}">
        </div>

        <div class="form-row">
          <label>項目 / 明細</label>
          <input type="text" id="inp-memo" class="form-input" placeholder="備忘（選填）">
        </div>

        <button type="submit" class="btn btn-primary btn-full" id="btn-submit">記帳</button>
      </form>
    </div>`;
  }

  function segGroup(groupId, handler) {
    const group = Utils.el(groupId);
    group.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        handler(btn.dataset.val);
      });
    });
  }

  function segVal(groupId) {
    const active = Utils.el(groupId)?.querySelector('.seg-btn.active');
    return active ? active.dataset.val : '';
  }

  function setSegVal(groupId, val) {
    const group = Utils.el(groupId);
    if (!group) return;
    group.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.val === val);
    });
  }

  function fillSelect(id, options, selected = '') {
    const sel = Utils.el(id);
    sel.innerHTML = `<option value="">選擇...</option>` +
      options.map(o => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o}</option>`).join('');
  }

  function show(id) { Utils.el(id)?.classList.remove('hidden'); }
  function hide(id) { Utils.el(id)?.classList.add('hidden'); }

  function updateCategory(type) {
    const cats = CFG.CATEGORIES[type] || [];
    fillSelect('sel-category', cats);
  }

  function updateAccountOut(role) {
    fillSelect('sel-account-out', Store.accountsForRole(role));
  }

  function updateAccountIn(role) {
    fillSelect('sel-account-in', Store.accountsForRole(role));
  }

  function updateProjectList() {
    const active = Store.get().activeProjects;
    const sel = Utils.el('sel-project');
    sel.innerHTML = `<option value="">選擇專案</option>` +
      active.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  function applyTypeRules(type) {
    updateCategory(type);

    const needTransfer = type === '轉帳' || type === '公積金提撥';
    const isExpense = type === '支出';

    if (needTransfer) { show('row-role-in'); show('row-account-in'); }
    else { hide('row-role-in'); hide('row-account-in'); }

    if (isExpense) { show('row-dimension'); }
    else { hide('row-dimension'); hide('row-project'); setSegVal('seg-dimension', ''); }

    // 公積金提撥 → 角色(入) 固定家用
    if (type === '公積金提撥') {
      setSegVal('seg-role-in', '家用');
      updateAccountIn('家用');
      Utils.el('seg-role-in').querySelectorAll('.seg-btn').forEach(b => {
        b.disabled = b.dataset.val !== '家用';
      });
    } else {
      Utils.el('seg-role-in').querySelectorAll('.seg-btn').forEach(b => b.disabled = false);
    }
  }

  function applyDimensionRules(dim) {
    if (dim === '專案') { show('row-project'); updateProjectList(); }
    else { hide('row-project'); Utils.el('sel-project').value = ''; }

    // 若為專案提撥，限定分類為「專案預備金」
    const type = segVal('seg-type');
    if (type === '公積金提撥' && dim === '專案') {
      fillSelect('sel-category', ['專案預備金'], '專案預備金');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const roleOut = segVal('seg-role-out');
    const type = segVal('seg-type');
    const dimension = segVal('seg-dimension');
    const projectTag = Utils.el('sel-project').value;
    const category = Utils.el('sel-category').value;
    const accountOut = Utils.el('sel-account-out').value;
    const roleIn = segVal('seg-role-in');
    const accountIn = Utils.el('sel-account-in').value;
    const amount = parseFloat(Utils.el('inp-amount').value);
    const date = Utils.el('inp-date').value.replace(/-/g, '/');
    const memo = Utils.el('inp-memo').value.trim();

    // Validation
    if (!roleOut) return Utils.toast('請選擇角色（出）', 'warn');
    if (!type) return Utils.toast('請選擇類型', 'warn');
    if (!category) return Utils.toast('請選擇主分類', 'warn');
    if (!accountOut) return Utils.toast('請選擇付款帳戶', 'warn');
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    if (!date) return Utils.toast('請選擇日期', 'warn');
    if (type === '支出' && dimension === '專案' && !projectTag) return Utils.toast('請選擇專案標籤', 'warn');
    if ((type === '轉帳' || type === '公積金提撥') && !accountIn) return Utils.toast('請選擇對象帳戶', 'warn');

    const row = [
      Utils.uid(), roleOut, dimension || '', projectTag, type,
      category, memo, date, amount, accountOut,
      roleIn || '', accountIn || ''
    ];

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const btn = Utils.el('btn-submit');
    btn.disabled = true;
    btn.textContent = '儲存中…';

    try {
      await API.append(sid, 'Ledger!A:L', row);
      Store.invalidate();
      Utils.toast('已記帳！', 'success');
      Utils.el('entry-form').reset();
      Utils.el('seg-role-out').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      Utils.el('seg-type').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      Utils.el('seg-dimension').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      Utils.el('inp-date').value = new Date().toISOString().slice(0,10);
      hide('row-dimension'); hide('row-project'); hide('row-role-in'); hide('row-account-in');
    } catch (err) {
      Utils.toast('儲存失敗：' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '記帳';
    }
  }

  function onMount() {
    segGroup('seg-role-out', role => updateAccountOut(role));
    segGroup('seg-type', type => applyTypeRules(type));
    segGroup('seg-dimension', dim => applyDimensionRules(dim));
    segGroup('seg-role-in', role => updateAccountIn(role));
    Utils.el('entry-form').addEventListener('submit', handleSubmit);

    // Defaults
    hide('row-dimension');
    hide('row-project');
    hide('row-role-in');
    hide('row-account-in');
    setSegVal('seg-type', '支出');
    applyTypeRules('支出');
  }

  return { render, onMount };
})());
