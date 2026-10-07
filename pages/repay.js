Router.register('repay', (() => {
  let _payGroups = [];   // 分期代付分組，供「記補款」全額補款使用
  let _payChecked = new Map(); // 多選補款：settleId → 勾選項資料，限同一組（債權人＋債務人＋補款對象帳戶）

  // 解析分期備忘：「商品名 分期3/6」→ { base, idx, total }
  function parseInstallment(memo) {
    const m = (memo || '').match(/^(.*?)\s*分期(\d+)\/(\d+)$/);
    if (!m) return null;
    return { base: m[1].trim(), idx: parseInt(m[2]), total: parseInt(m[3]) };
  }

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    await Store.load();
    renderAll();
  }

  function renderAll() {
    const el = Utils.el('page-content');
    const { ledger } = Store.get();
    const items = Store.computePayables(ledger);

    if (!items.length) {
      el.innerHTML = `<div class="page-inner">
        <div class="empty-cta" style="margin-top:32px">
          <div class="empty-cta-icon">🤝</div>
          <p>目前沒有未結代付</p>
        </div>
      </div>`;
      return;
    }

    // 分期分組：同 base＋總期數＋債權人＋債務人視為同一組，供單筆「記補款」的全額補款選項
    _payGroups = [];
    const gidByKey = {};
    items.forEach(e => {
      const pi = parseInstallment(e.memo);
      if (!pi) return;
      // 新資料以 ID 前綴（gid-i期數）精準分組，舊資料退回備忘＋雙方比對
      const gm = (e.id || '').match(/^(.+)-i\d+$/);
      const gk = gm ? `id:${gm[1]}` : `${pi.base}||${pi.total}||${e.creditor}||${e.debtor}`;
      if (!(gk in gidByKey)) {
        gidByKey[gk] = _payGroups.length;
        _payGroups.push({ creditor: e.creditor, debtor: e.debtor, members: [] });
      }
      e._gid = gidByKey[gk];
      _payGroups[e._gid].members.push({ settleId: e.id, amount: e.remaining, date: e.date, memo: e.memo });
    });

    // 清掉已經結清、不再存在的勾選項（避免補款送出後殘留舊的多選狀態）
    const validSettleIds = new Set(items.map(x => x.id));
    for (const k of _payChecked.keys()) if (!validSettleIds.has(k)) _payChecked.delete(k);

    const id = Utils.identity();

    // 依「實際補款帳戶」分類：債權人＋債務人＋補款對象角色/帳戶都相同才算同一組，
    // 組內可單選或全選，一次送出合併成一筆轉帳
    const groups = []; // [{ key, creditor, debtor, tgtRole, tgtAcct, items: [...] }]
    const gidxByKey = {};
    items.forEach(e => {
      const tgt = e.payAccount ? Store.repayTarget(e.creditor, e.payAccount) : { role: e.creditor, account: '' };
      const key = `${e.creditor}||${e.debtor}||${tgt.role}||${tgt.account}`;
      if (!(key in gidxByKey)) {
        gidxByKey[key] = groups.length;
        groups.push({ key, creditor: e.creditor, debtor: e.debtor, tgtRole: tgt.role, tgtAcct: tgt.account, items: [] });
      }
      groups[gidxByKey[key]].items.push({ ...e, tgt });
    });

    const groupsHtml = groups.map(g => {
      const isMyDebt = g.debtor === id;
      const isMyRecv = g.creditor === id;
      const label = isMyDebt ? `我欠 ${Utils.esc(g.creditor)}` : isMyRecv ? `${Utils.esc(g.debtor)} 欠我` : `${Utils.esc(g.debtor)} 欠 ${Utils.esc(g.creditor)}`;
      const acctSub = g.tgtAcct ? `補到 ${Utils.esc(g.tgtRole)}／${Utils.esc(g.tgtAcct)}` : '補款對象帳戶未設定';
      const groupSum = g.items.reduce((s, e) => s + e.remaining, 0);
      const checkedInGroup = g.items.filter(e => _payChecked.has(e.id));
      const allChecked = checkedInGroup.length === g.items.length;

      const rows = g.items.map(e => {
        const partial = e.remaining < e.amount ? `（剩 ${Utils.formatMoney(e.remaining)}）` : '';
        const sub = `${e.date.slice(5)}${e.memo ? ' · ' + Utils.esc(e.memo) : ''}${partial}`;
        const repayMemo = `補款／${e.date.slice(5)}${e.memo ? ' ' + e.memo : ''}`;
        const grouped = e._gid !== undefined && _payGroups[e._gid].members.length > 1;
        const payBtn = `<button type="button" class="dash-repay-btn"
          data-creditor="${Utils.esc(e.creditor)}"
          data-debtor="${Utils.esc(e.debtor)}"
          data-amount="${e.remaining}"
          data-settle="${Utils.esc(e.id || '')}"
          data-group="${grouped ? e._gid : ''}"
          data-memo="${Utils.esc(repayMemo)}">記補款 →</button>`;
        const checked = _payChecked.has(e.id) ? ' checked' : '';
        return `<div class="dash-acct-row dash-pay-row">
          <input type="checkbox" class="dash-pay-check" data-settle="${Utils.esc(e.id || '')}"
            data-group-key="${Utils.esc(g.key)}" data-amount="${e.remaining}" data-memo="${Utils.esc(repayMemo)}"
            data-date="${Utils.esc(e.date)}" data-creditor="${Utils.esc(e.creditor)}" data-debtor="${Utils.esc(e.debtor)}"
            data-tgt-role="${Utils.esc(g.tgtRole)}" data-tgt-acct="${Utils.esc(g.tgtAcct)}"${checked}>
          <div class="dash-pay-info">
            <span class="dash-acct-name">${label}</span>
            <span class="dash-pay-sub">${sub}</span>
          </div>
          <span class="dash-acct-bal ${isMyDebt ? 'amount-out' : isMyRecv ? 'amount-in' : ''}">${Utils.formatMoney(e.remaining)}</span>
          ${payBtn}
        </div>`;
      }).join('');

      const groupBar = checkedInGroup.length > 0
        ? `<div class="dash-pay-batch-bar">
            <span>已選 ${checkedInGroup.length} 筆・共 ${Utils.formatMoney(checkedInGroup.reduce((s, e) => s + e.remaining, 0))}</span>
            <button type="button" class="btn btn-primary btn-sm dash-pay-group-btn" data-group-key="${Utils.esc(g.key)}">建立補款 →</button>
          </div>` : '';

      return `<div class="dash-pay-group">
        <div class="dash-pay-group-head">
          <label class="dash-pay-group-all">
            <input type="checkbox" class="dash-pay-check-all" data-group-key="${Utils.esc(g.key)}"${g.items.length > 1 ? (allChecked ? ' checked' : '') : ' style="display:none"'}>
            <span class="dash-acct-name">${label}</span>
          </label>
          <span class="dash-pay-group-sum">${Utils.formatMoney(groupSum)}</span>
        </div>
        <div class="dash-pay-group-sub">${acctSub}</div>
        ${rows}
        ${groupBar}
      </div>`;
    }).join('');

    const totalIn  = items.filter(x => x.creditor === id).reduce((s, x) => s + x.remaining, 0);
    const totalOut = items.filter(x => x.debtor   === id).reduce((s, x) => s + x.remaining, 0);
    const parts = [];
    if (id) {
      if (totalIn  > 0) parts.push(`收 ${Utils.formatMoney(totalIn)}`);
      if (totalOut > 0) parts.push(`付 ${Utils.formatMoney(totalOut)}`);
    }
    const summary = parts.length ? parts.join('・') : `${items.length} 筆`;

    el.innerHTML = `<div class="page-inner">
      <p class="section-hint" style="margin:0 0 12px">${summary}</p>
      ${groupsHtml}
    </div>`;

    wire(el);
  }

  function wire(el) {
    el.querySelectorAll('.dash-repay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = btn.dataset.group;
        if (gid !== '' && gid !== undefined && _payGroups[parseInt(gid)]?.members.length > 1) {
          showRepayChooser(btn, _payGroups[parseInt(gid)]);
        } else {
          prefillSingleRepay(btn);
        }
      });
    });
    el.querySelectorAll('.dash-pay-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const { settle, groupKey, amount, memo, date, creditor, debtor, tgtRole, tgtAcct } = chk.dataset;
        if (chk.checked) {
          _payChecked.set(settle, { groupKey, amount: Number(amount), memo, date, creditor, debtor, tgtRole, tgtAcct });
        } else {
          _payChecked.delete(settle);
        }
        renderAll();
      });
    });
    el.querySelectorAll('.dash-pay-check-all').forEach(chk => {
      chk.addEventListener('change', () => {
        const gkey = chk.dataset.groupKey;
        el.querySelectorAll(`.dash-pay-check[data-group-key="${CSS.escape(gkey)}"]`).forEach(row => {
          const { settle, amount, memo, date, creditor, debtor, tgtRole, tgtAcct } = row.dataset;
          if (chk.checked) _payChecked.set(settle, { groupKey: gkey, amount: Number(amount), memo, date, creditor, debtor, tgtRole, tgtAcct });
          else _payChecked.delete(settle);
        });
        renderAll();
      });
    });
    el.querySelectorAll('.dash-pay-group-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gkey = btn.dataset.groupKey;
        const items = [..._payChecked.entries()]
          .filter(([, m]) => m.groupKey === gkey)
          .map(([settleId, m]) => ({ settleId, ...m }));
        _payChecked.clear();
        prefillMultiRepay(items);
      });
    });
  }

  function prefillSingleRepay(btn) {
    localStorage.setItem('ff_entry_prefill', JSON.stringify({
      type: '轉帳',
      roleOut: btn.dataset.debtor,
      roleIn: btn.dataset.creditor,
      amount: btn.dataset.amount,
      category: CFG.CAT_REPAYMENT,
      settleId: btn.dataset.settle || '',
      memo: btn.dataset.memo || ''
    }));
    Router.go('entry');
  }

  // 自由多選補款：使用者在清單勾選的任意幾筆（同一債權人＋債務人＋補款對象帳戶），
  // 一次合併成一筆轉帳（多期分帳於 repayBatch），帶入正確的補款對象帳戶（而非預設帳戶）
  function prefillMultiRepay(items) {
    if (!items.length) return;
    const first = items[0];
    const total = items.reduce((s, m) => s + m.amount, 0);
    localStorage.setItem('ff_entry_prefill', JSON.stringify({
      type: '轉帳',
      roleOut: first.debtor,
      roleIn: first.tgtRole,
      accountIn: first.tgtAcct,
      category: CFG.CAT_REPAYMENT,
      amount: total,
      repayBatch: items.map(m => ({ settleId: m.settleId, amount: m.amount, memo: m.memo }))
    }));
    Router.go('entry');
  }

  function prefillBatchRepay(g) {
    const total = g.members.reduce((s, m) => s + m.amount, 0);
    localStorage.setItem('ff_entry_prefill', JSON.stringify({
      type: '轉帳',
      roleOut: g.debtor,
      roleIn: g.creditor,
      category: CFG.CAT_REPAYMENT,
      amount: total,
      repayBatch: g.members.map(m => ({
        settleId: m.settleId,
        amount: m.amount,
        memo: `補款／${m.date.slice(5)} ${m.memo}`
      }))
    }));
    Router.go('entry');
  }

  // 分期代付的補款方式選擇：補這期 vs 補全部剩餘
  function showRepayChooser(btn, g) {
    const single = Number(btn.dataset.amount) || 0;
    const total = g.members.reduce((s, m) => s + m.amount, 0);
    const n = g.members.length;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">補款方式</div>
      <p class="section-hint">這筆是分期代付，共有 ${n} 期未補。</p>
      <div class="modal-actions" style="flex-direction:column;align-items:stretch;gap:8px">
        <button class="btn btn-outline" id="repay-one">補這期　${Utils.formatMoney(single)}</button>
        <button class="btn btn-primary" id="repay-all">補全部剩餘 ${n} 期　${Utils.formatMoney(total)}</button>
        <button class="btn btn-outline btn-sm" id="repay-cancel">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('repay-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('repay-one').addEventListener('click', () => { modal.remove(); prefillSingleRepay(btn); });
    document.getElementById('repay-all').addEventListener('click', () => { modal.remove(); prefillBatchRepay(g); });
  }

  return { render, onMount };
})());
