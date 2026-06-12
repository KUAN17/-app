Router.register('billing', (() => {

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    await Store.load();
    const { accounts, ledger } = Store.get();
    const today = new Date();

    const byRole = {};
    CFG.ROLES.forEach(role => {
      (accounts[role] || []).forEach(a => {
        if (a.type === '信用卡') {
          if (!byRole[role]) byRole[role] = [];
          byRole[role].push({ role, ...a });
        }
      });
    });

    const roles = Object.keys(byRole);
    if (!roles.length) {
      el.innerHTML = `<div class="page-inner">
        <p class="empty-hint" style="margin-top:32px">尚無信用卡帳戶。<br>請至設定 → 帳戶管理新增帳戶，並將類型設為「信用卡」。</p>
      </div>`;
      return;
    }

    let html = `<div class="page-inner">`;
    let idx = 0;
    roles.forEach(role => {
      html += `<div class="billing-role-header">${role}</div>`;
      byRole[role].forEach(acct => { html += renderCard(acct, ledger, today, idx++); });
    });
    html += `<div style="height:16px"></div></div>`;
    el.innerHTML = html;

    el.querySelectorAll('.cc-pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('ff_entry_prefill', JSON.stringify({
          type: '轉帳',
          roleIn: btn.dataset.role,
          accountIn: btn.dataset.name,
          amount: btn.dataset.amount
        }));
        Router.go('entry');
      });
    });

    el.querySelectorAll('.cc-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = document.getElementById(`cc-tx-${btn.dataset.idx}`);
        if (!list) return;
        const hidden = list.classList.toggle('hidden');
        btn.textContent = hidden ? `展開明細（${btn.dataset.count}）` : '收合';
      });
    });
  }

  function fmtDate(d) {
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function getBillingWindows(today, billingDay, dueDay) {
    const bd = billingDay || 15;
    const dd = dueDay || 25;
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();

    const pastEnd   = d >= bd ? new Date(y, m, bd) : new Date(y, m - 1, bd);
    const pastStart = new Date(new Date(pastEnd.getFullYear(), pastEnd.getMonth() - 1, bd).getTime() + 86400000);
    const pastDue   = new Date(pastEnd.getFullYear(), pastEnd.getMonth() + 1, dd);
    const curStart  = new Date(pastEnd.getTime() + 86400000);
    const curEnd    = new Date(pastEnd.getFullYear(), pastEnd.getMonth() + 1, bd);

    return {
      past:    { start: pastStart, end: pastEnd, due: pastDue },
      current: { start: curStart,  end: curEnd }
    };
  }

  function filterTxs(ledger, acctName, startStr, endStr) {
    return ledger
      .filter(tx =>
        (tx.accountOut === acctName || tx.payAccount === acctName) &&
        tx.type === '支出' && tx.date >= startStr && tx.date <= endStr
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function txListHtml(txs, listId) {
    if (!txs.length) return '';
    const items = txs.map(tx => `
      <div class="cc-tx-item">
        <span class="cc-tx-date">${tx.date.slice(5)}</span>
        <span class="cc-tx-cat">${tx.category}${tx.memo ? ' · ' + tx.memo : ''}</span>
        <span class="cc-tx-amt">${Utils.formatMoney(tx.amount)}</span>
      </div>`).join('');
    return `<div id="${listId}" class="cc-tx-list hidden">${items}</div>`;
  }

  function renderCard(acct, ledger, today, baseIdx) {
    const { past, current } = getBillingWindows(today, acct.billingDate, acct.dueDate);
    const todayStr  = fmtDate(today);
    const safeName  = acct.name.replace(/"/g, '&quot;');

    // ── 本期（進行中）
    const curStartStr = fmtDate(current.start);
    const curEndStr   = fmtDate(current.end);
    const curTxs      = filterTxs(ledger, acct.name, curStartStr, todayStr);
    const curSpending = curTxs.reduce((s, tx) => s + tx.amount, 0);
    const curListId   = `cc-tx-${baseIdx * 2}`;

    const curSection = `
      <div class="cc-period-section">
        <div class="cc-period-header">
          <span class="cc-period-label">本期</span>
          <span class="cc-period-range">${curStartStr.slice(5)} ～ ${curEndStr.slice(5)}</span>
          <span class="cc-status status-progress">進行中</span>
        </div>
        <div class="cc-amount">${Utils.formatMoney(curSpending)}</div>
        <div class="cc-actions">
          ${curTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
              data-idx="${baseIdx * 2}" data-count="${curTxs.length}">展開明細（${curTxs.length}）</button>` : ''}
        </div>
        ${txListHtml(curTxs, curListId)}
      </div>`;

    // ── 上期（已結算）
    const pastStartStr = fmtDate(past.start);
    const pastEndStr   = fmtDate(past.end);
    const pastTxs      = filterTxs(ledger, acct.name, pastStartStr, pastEndStr);
    const pastSpending = pastTxs.reduce((s, tx) => s + tx.amount, 0);
    const pastListId   = `cc-tx-${baseIdx * 2 + 1}`;

    const paymentTx = ledger.find(tx =>
      tx.accountIn === acct.name && tx.type === '轉帳' &&
      tx.date > pastEndStr && tx.date <= fmtDate(past.due)
    );

    let pastSection;
    if (paymentTx) {
      pastSection = `
        <div class="cc-period-section cc-period-past">
          <div class="cc-period-header">
            <span class="cc-period-label">上期</span>
            <span class="cc-period-range">${pastStartStr.slice(5)} ～ ${pastEndStr.slice(5)}</span>
            <span class="cc-status status-progress">✓ 已繳清</span>
          </div>
          <div class="cc-amount" style="color:var(--text-muted)">${Utils.formatMoney(pastSpending)}</div>
          <div class="cc-due-row">
            <span class="cc-auto-pay">轉帳 ${Utils.formatMoney(paymentTx.amount)} · ${paymentTx.date.slice(5)}</span>
          </div>
        </div>`;
    } else {
      const msLeft    = past.due - today;
      const daysLeft  = Math.ceil(msLeft / 86400000);
      const statusClass = daysLeft <= 5 ? 'status-urgent' : 'status-pending';
      const statusText  = daysLeft < 0 ? '⚠ 逾期' : `${daysLeft} 天後截止`;

      pastSection = `
        <div class="cc-period-section cc-period-past">
          <div class="cc-period-header">
            <span class="cc-period-label">上期</span>
            <span class="cc-period-range">${pastStartStr.slice(5)} ～ ${pastEndStr.slice(5)}</span>
            <span class="cc-status ${statusClass}">${statusText}</span>
          </div>
          <div class="cc-amount">${Utils.formatMoney(pastSpending)}</div>
          <div class="cc-due-row">
            <span class="label-sm">繳費截止</span>
            <span>${fmtDate(past.due)}</span>
          </div>
          <div class="cc-actions">
            ${pastTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
                data-idx="${baseIdx * 2 + 1}" data-count="${pastTxs.length}">展開明細（${pastTxs.length}）</button>` : ''}
            <button class="btn btn-primary btn-sm cc-pay-btn"
                data-role="${acct.role}" data-name="${safeName}" data-amount="${pastSpending}">前往繳費 →</button>
          </div>
          ${txListHtml(pastTxs, pastListId)}
        </div>`;
    }

    return `<div class="card cc-card">
      <div class="cc-card-name">💳 ${acct.name}</div>
      ${curSection}
      ${pastSection}
    </div>`;
  }

  return { render, onMount };
})());
