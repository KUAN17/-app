Router.register('ledger', (() => {
  let _filter = { role: '', type: '', month: Utils.monthLabel() };
  let _limit = 50;          // 一次最多渲染筆數，按「載入更多」遞增
  const PAGE_SIZE = 50;

  const TYPE_ICON = { '支出': '↑', '收入': '↓', '轉帳': '⇄', '公積金提撥': '⊕' };
  const TYPE_CLASS = { '支出': 'amount-out', '收入': 'amount-in', '轉帳': 'amount-neutral', '公積金提撥': 'amount-primary' };

  function renderList(ledger) {
    let rows = [...ledger].sort((a, b) => b.date.localeCompare(a.date));

    if (_filter.month) rows = rows.filter(tx => tx.date.startsWith(_filter.month));
    if (_filter.role) rows = rows.filter(tx => tx.roleOut === _filter.role);
    if (_filter.type) rows = rows.filter(tx => tx.type === _filter.type);

    if (rows.length === 0) return `<p class="empty-hint">無符合記錄</p>`;

    const hasMore = rows.length > _limit;
    if (hasMore) rows = rows.slice(0, _limit);

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
            <div class="ledger-cat">${tx.category || tx.type}${tx.projectTag ? ` · ${tx.projectTag}` : ''}</div>
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
    }).join('') +
    (hasMore ? `<button class="btn btn-outline btn-full" id="btn-load-more" style="margin:8px 0">載入更多</button>` : '');
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

    Utils.el('btn-load-more')?.addEventListener('click', () => {
      _limit += PAGE_SIZE;
      refreshList();
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
    const isProject = tx.dimension === '專案';
    const cats = CFG.CATEGORIES[tx.type] || [];
    // 專案支出有空白選項（分類非必填）；自訂分類不在清單也補進
    const catList = isProject ? ['', ...cats] : cats;
    if (tx.category && !catList.includes(tx.category)) catList.unshift(tx.category);
    const acctOuts = Store.accountsForRole(tx.roleOut);

    const catOptions = catList.map(c =>
      `<option value="${c}"${c === tx.category ? ' selected' : ''}>${c || '（不選分類）'}</option>`
    ).join('');
    const acctOutOptions = acctOuts.map(a =>
      `<option value="${a.replace(/"/g,'&quot;')}"${a === tx.accountOut ? ' selected' : ''}>${a}</option>`
    ).join('');

    // 支出可編輯代付來源（記錯代付帳戶時不必刪掉重記）
    let payField = '';
    if (!isTransfer && tx.type === '支出') {
      const payOpts = Store.allAccountsFlat()
        .filter(a => a.type !== '證券帳戶')
        .map(a => {
          const v = `${a.role}||${a.name}`;
          const cur = tx.payAccount === a.name && (!tx.payRole || tx.payRole === a.role);
          return `<option value="${v.replace(/"/g,'&quot;')}"${cur ? ' selected' : ''}>${a.role}／${a.name}</option>`;
        }).join('');
      payField = `
        <div class="form-row">
          <label>代付帳戶</label>
          <select id="edit-pay" class="form-select">
            <option value="">不使用代付</option>${payOpts}
          </select>
        </div>`;
    }

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
      ${isTransfer ? '' : `<div class="form-row">
        <label>主分類</label>
        <select id="edit-category" class="form-select">
          ${catOptions || `<option value="${tx.category}">${tx.category}</option>`}
        </select>
      </div>`}
      <div class="form-row">
        <label>${isTransfer ? '轉出帳戶' : '付款帳戶'}</label>
        <select id="edit-acct-out" class="form-select">
          ${acctOutOptions || `<option value="${tx.accountOut}">${tx.accountOut}</option>`}
        </select>
      </div>
      ${payField}
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
    // 轉帳無主分類欄，保留原本用途（如代付補款），不強制改動
    const category = isTransfer ? tx.category : document.getElementById('edit-category').value;
    const accountOut = document.getElementById('edit-acct-out').value;
    const memo = document.getElementById('edit-memo').value.trim();
    const roleIn = isTransfer ? document.getElementById('edit-role-in').value : tx.roleIn;
    const accountIn = isTransfer ? document.getElementById('edit-acct-in').value : tx.accountIn;

    if (!date) return Utils.toast('請選擇日期', 'warn');
    if (!amount || amount <= 0) return Utils.toast('請輸入有效金額', 'warn');
    // 轉帳與專案支出分類可留空；其他類型仍需分類
    if (!category && !isTransfer && tx.dimension !== '專案') return Utils.toast('請選擇分類', 'warn');

    // M/N 代付欄：支出可經下拉修改；其餘保留原值。O settleId 一律保留補款綁定
    let payRole = tx.payRole || '', payAccount = tx.payAccount || '';
    const paySel = document.getElementById('edit-pay');
    if (paySel) {
      if (!paySel.value) { payRole = ''; payAccount = ''; }
      else [payRole, payAccount] = paySel.value.split('||');
    }
    const row = [
      tx.id, tx.roleOut, tx.dimension, tx.projectTag,
      tx.type, category, Utils.sheetText(memo), date, amount, accountOut,
      roleIn, accountIn, payRole, payAccount, tx.settleId || ''
    ];

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const saveBtn = document.getElementById('btn-save-edit');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
    try {
      await API.updateRange(sid, `Ledger!A${tx._row}:O${tx._row}`, [row]);
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

  // 解析分期備忘：「商品名 分期3/6」→ { base:'商品名', idx:3, total:6 }
  function parseInstallment(memo) {
    const m = (memo || '').match(/^(.*?)\s*分期(\d+)\/(\d+)$/);
    if (!m) return null;
    return { base: m[1].trim(), idx: parseInt(m[2]), total: parseInt(m[3]) };
  }
  // 找出綁定此支出的補款轉帳（settleId 指向該筆）
  function linkedRepays(expId) {
    if (!expId) return [];
    return Store.get().ledger.filter(t =>
      t.type === '轉帳' && t.category === CFG.CAT_REPAYMENT && t.settleId === expId);
  }
  // 找出同組分期的所有支出。新資料以 ID 前綴（gid-i期數）精準分組；
  // 舊資料退回備忘比對（同 base、同總期數、同帳戶/代付/專案/分類）
  function installmentSiblings(tx, inst) {
    const gm = (tx.id || '').match(/^(.+)-i\d+$/);
    if (gm) {
      return Store.get().ledger.filter(t => t.id.startsWith(`${gm[1]}-i`));
    }
    return Store.get().ledger.filter(t => {
      if (t.type !== '支出') return false;
      if (/-i\d+$/.test(t.id || '')) return false; // 新制資料不與舊制混組
      const pi = parseInstallment(t.memo);
      if (!pi) return false;
      return pi.base === inst.base && pi.total === inst.total &&
        t.roleOut === tx.roleOut && t.accountOut === tx.accountOut &&
        (t.payAccount || '') === (tx.payAccount || '') &&
        (t.projectTag || '') === (tx.projectTag || '') &&
        (t.category || '') === (tx.category || '');
    });
  }

  async function deleteTx(tx, modal) {
    let toDelete = [tx];
    const inst = tx.type === '支出' ? parseInstallment(tx.memo) : null;

    if (inst) {
      const siblings = installmentSiblings(tx, inst);
      if (siblings.length > 1) {
        if (!confirm(`這是分期記錄（${inst.idx}/${inst.total}），共 ${siblings.length} 筆。\n刪除將移除整組 ${siblings.length} 期及其補款。要繼續嗎？`)) return;
        toDelete = siblings;
      } else {
        if (!confirm(`確定刪除這筆記錄？\n${tx.date} ${tx.memo || tx.category} ${Utils.formatMoney(tx.amount)}`)) return;
      }
    } else {
      if (!confirm(`確定刪除這筆記錄？\n${tx.date} ${tx.category} ${Utils.formatMoney(tx.amount)}`)) return;
    }

    // 連帶刪除：每筆代付支出綁定的補款轉帳
    const repays = [];
    toDelete.forEach(e => { if (e.type === '支出') repays.push(...linkedRepays(e.id)); });

    // 以 _row 去重，由大到小排序逐筆刪（單次 batchUpdate 依序執行，先刪大列號不影響小列號）
    const byRow = new Map([...toDelete, ...repays].map(r => [r._row, r]));
    const rowsDesc = [...byRow.keys()].sort((a, b) => b - a);

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    Utils.showLoading(true);
    try {
      await Store.ensureSheetMeta(); // 快取路徑下 meta 可能尚未載入
      const sheetId = Store.getSheetId('Ledger');
      await API.batchUpdate(sid, rowsDesc.map(r => ({
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r } }
      })));
      Store.invalidate();
      await Store.load(true);
      modal.remove();
      refreshList();
      const n = rowsDesc.length;
      Utils.toast(n > 1 ? `已刪除 ${n} 筆` : '已刪除', 'success');
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
        _limit = PAGE_SIZE; // 換篩選條件時回到第一頁
        refreshList();
      });
    });
  }

  return { render, onMount };
})());
