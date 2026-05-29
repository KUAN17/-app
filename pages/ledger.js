Router.register('ledger', (() => {
  let _filter = { role: '', type: '', month: Utils.monthLabel() };

  const TYPE_ICON = { '支出': '↑', '收入': '↓', '轉帳': '⇄', '公積金提撥': '⊕' };
  const TYPE_CLASS = { '支出': 'amount-out', '收入': 'amount-in', '轉帳': 'amount-neutral', '公積金提撥': 'amount-primary' };

  function renderList(ledger) {
    let rows = [...ledger].sort((a, b) => b.date.localeCompare(a.date));

    if (_filter.month) rows = rows.filter(tx => tx.date.startsWith(_filter.month.replace('/', '-').slice(0,7)) || tx.date.slice(0,7) === _filter.month.slice(0,7));
    if (_filter.role) rows = rows.filter(tx => tx.roleOut === _filter.role);
    if (_filter.type) rows = rows.filter(tx => tx.type === _filter.type);

    if (rows.length === 0) return `<p class="empty-hint">無符合記錄</p>`;

    const grouped = {};
    rows.forEach(tx => {
      if (!grouped[tx.date]) grouped[tx.date] = [];
      grouped[tx.date].push(tx);
    });

    return Object.entries(grouped).map(([date, txs]) => {
      const dayTotal = txs.reduce((s, tx) => tx.type === '支出' ? s - tx.amount : tx.type === '收入' ? s + tx.amount : s, 0);
      const items = txs.map(tx => `
        <div class="ledger-item" data-row="${tx._row}" data-id="${tx.id}">
          <div class="ledger-icon ${TYPE_CLASS[tx.type]}">${TYPE_ICON[tx.type]||''}</div>
          <div class="ledger-info">
            <div class="ledger-cat">${tx.category}${tx.projectTag ? ` · ${tx.projectTag}` : ''}</div>
            <div class="ledger-meta">${tx.roleOut} · ${tx.accountOut}${tx.memo ? ` · ${tx.memo}` : ''}</div>
          </div>
          <div class="ledger-amount ${TYPE_CLASS[tx.type]}">${Utils.formatMoney(tx.amount)}</div>
        </div>`).join('');
      return `<div class="ledger-group">
        <div class="ledger-date-row">
          <span>${date}</span>
          <span class="${dayTotal >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(dayTotal, true)}</span>
        </div>
        ${items}
      </div>`;
    }).join('');
  }

  function render(el) {
    const now = Utils.monthLabel();
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(Utils.monthLabel(d));
    }

    el.innerHTML = `<div class="page-inner">
      <div class="filter-bar">
        <select id="fil-month" class="filter-sel">
          ${months.map(m => `<option value="${m}" ${m === _filter.month ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="fil-role" class="filter-sel">
          <option value="">全部角色</option>
          ${CFG.ROLES.map(r => `<option value="${r}" ${r === _filter.role ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <select id="fil-type" class="filter-sel">
          <option value="">全部類型</option>
          ${CFG.TX_TYPES.map(t => `<option value="${t}" ${t === _filter.type ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div id="ledger-list"><div class="spinner"></div></div>
    </div>`;
  }

  function refreshList() {
    const listEl = Utils.el('ledger-list');
    listEl.innerHTML = renderList(Store.get().ledger);

    listEl.querySelectorAll('.ledger-item').forEach(item => {
      item.addEventListener('click', () => showDetail(item.dataset.id));
    });
  }

  function showDetail(id) {
    const tx = Store.get().ledger.find(t => t.id === id);
    if (!tx) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">帳目明細</div>
      <div class="detail-grid">
        <span class="detail-label">日期</span><span>${tx.date}</span>
        <span class="detail-label">角色（出）</span><span>${tx.roleOut}</span>
        <span class="detail-label">類型</span><span>${tx.type}</span>
        ${tx.dimension ? `<span class="detail-label">開銷維度</span><span>${tx.dimension}</span>` : ''}
        ${tx.projectTag ? `<span class="detail-label">專案標籤</span><span>${tx.projectTag}</span>` : ''}
        <span class="detail-label">主分類</span><span>${tx.category}</span>
        ${tx.memo ? `<span class="detail-label">明細</span><span>${tx.memo}</span>` : ''}
        <span class="detail-label">金額</span><span class="amount-primary">${Utils.formatMoney(tx.amount)}</span>
        <span class="detail-label">付款帳戶</span><span>${tx.accountOut}</span>
        ${tx.roleIn ? `<span class="detail-label">角色（入）</span><span>${tx.roleIn}</span>` : ''}
        ${tx.accountIn ? `<span class="detail-label">對象帳戶</span><span>${tx.accountIn}</span>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-edit-tx">編輯</button>
        <button class="btn btn-danger btn-sm" id="btn-del-tx">刪除</button>
        <button class="btn btn-outline btn-sm" id="btn-close-modal">關閉</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-close-modal').addEventListener('click', () => modal.remove());
    Utils.el('btn-del-tx').addEventListener('click', () => deleteTx(tx, modal));
    Utils.el('btn-edit-tx').addEventListener('click', () => { modal.remove(); showEditModal(tx); });
  }

  function showEditModal(tx) {
    const isTransfer = tx.type === '轉帳' || tx.type === '公積金提撥';
    const cats = CFG.CATEGORIES[tx.type] || [];
    const acctOuts = Store.accountsForRole(tx.roleOut);

    const catOptions = cats.map(c =>
      `<option value="${c}"${c === tx.category ? ' selected' : ''}>${c}</option>`
    ).join('');
    const acctOutOptions = acctOuts.map(a =>
      `<option value="${a.replace(/"/g,'&quot;')}"${a === tx.accountOut ? ' selected' : ''}>${a}</option>`
    ).join('');

    let transferFields = '';
    if (isTransfer) {
      const roleInOpts = CFG.ROLES.map(r =>
        `<option value="${r}"${r === tx.roleIn ? ' selected' : ''}>${r}</option>`
      ).join('');
      const acctIns = Store.accountsForRole(tx.roleIn);
      const acctInOpts = acctIns.map(a =>
        `<option value="${a.replace(/"/g,'&quot;')}"${a === tx.accountIn ? ' selected' : ''}>${a}</option>`
      ).join('');
      transferFields = `
        <div class="form-row">
          <label>角色（入）</label>
          <select id="edit-role-in" class="form-select">${roleInOpts}</select>
        </div>
        <div class="form-row">
          <label>對象帳戶</label>
          <select id="edit-acct-in" class="form-select">${acctInOpts}</select>
        </div>`;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">編輯帳目</div>
      <div class="form-row">
        <label>日期</label>
        <input type="date" id="edit-date" class="form-input" value="${tx.date.replace(/\//g,'-')}">
      </div>
      <div class="form-row">
        <label>金額</label>
        <input type="number" id="edit-amount" class="form-input" value="${tx.amount}" min="0" step="any">
      </div>
      <div class="form-row">
        <label>主分類</label>
        <select id="edit-category" class="form-select">
          ${catOptions || `<option value="${tx.category}">${tx.category}</option>`}
        </select>
      </div>
      <div class="form-row">
        <label>付款帳戶</label>
        <select id="edit-acct-out" class="form-select">
          ${acctOutOptions || `<option value="${tx.accountOut}">${tx.accountOut}</option>`}
        </select>
      </div>
      ${transferFields}
      <div class="form-row">
        <label>備忘</label>
        <input type="text" id="edit-memo" class="form-input" value="${tx.memo.replace(/"/g,'&quot;')}" placeholder="（選填）">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-edit">儲存</button>
        <button class="btn btn-outline btn-sm" id="btn-cancel-edit">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('btn-cancel-edit').addEventListener('click', () => modal.remove());

    if (isTransfer) {
      document.getElementById('edit-role-in').addEventListener('change', e => {
        const accts = Store.accountsForRole(e.target.value);
        const sel = document.getElementById('edit-acct-in');
        sel.innerHTML = accts.map(a => `<option value="${a.replace(/"/g,'&quot;')}">${a}</option>`).join('');
      });
    }

    document.getElementById('btn-save-edit').addEventListener('click', () => saveEditTx(tx, modal, isTransfer));
  }

  async function saveEditTx(tx, modal, isTransfer) {
    const date = document.getElementById('edit-date').value.replace(/-/g, '/');
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const category = document.getElementById('edit-category').value;
    const accountOut = document.getElementById('edit-acct-out').value;
    const memo = document.getElementById('edit-memo').value.trim();
    const roleIn = isTransfer ? document.getElementById('edit-role-in').value : tx.roleIn;
    const accountIn = isTransfer ? document.getElementById('edit-acct-in').value : tx.accountIn;

    if (!date) return Utils.toast('請選擇日期', 'warn');
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    if (!category) return Utils.toast('請選擇分類', 'warn');

    const row = [
      tx.id, tx.roleOut, tx.dimension, tx.projectTag,
      tx.type, category, memo, date, amount, accountOut,
      roleIn, accountIn
    ];

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const saveBtn = document.getElementById('btn-save-edit');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
    try {
      await API.updateRange(sid, `Ledger!A${tx._row}:L${tx._row}`, [row]);
      Store.invalidate();
      await Store.load(true);
      modal.remove();
      refreshList();
      Utils.toast('已更新', 'success');
    } catch (e) {
      Utils.toast('更新失敗：' + e.message, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
    }
  }

  async function deleteTx(tx, modal) {
    if (!confirm(`確定刪除這筆記錄？\n${tx.date} ${tx.category} ${Utils.formatMoney(tx.amount)}`)) return;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const sheetId = Store.getSheetId('Ledger');
    Utils.showLoading(true);
    try {
      await API.deleteRow(sid, sheetId, tx._row - 1);
      Store.invalidate();
      await Store.load(true);
      modal.remove();
      refreshList();
      Utils.toast('已刪除', 'success');
    } catch (e) {
      Utils.toast('刪除失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  async function onMount() {
    await Store.load();
    refreshList();

    ['fil-month', 'fil-role', 'fil-type'].forEach(id => {
      Utils.el(id)?.addEventListener('change', e => {
        const key = { 'fil-month': 'month', 'fil-role': 'role', 'fil-type': 'type' }[id];
        _filter[key] = e.target.value;
        refreshList();
      });
    });
  }

  return { render, onMount };
})());
