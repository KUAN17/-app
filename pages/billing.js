Router.register('billing', (() => {
  const LS_PAID = (monthKey, name) => `ff_cc_paid_${monthKey}_${name}`;

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    await Store.load();
    const { accounts, ledger } = Store.get();

    // Collect CC accounts
    const ccAccts = [];
    CFG.ROLES.forEach(role => {
      (accounts[role] || []).forEach(a => {
        if (a.type === '信用卡') ccAccts.push({ role, ...a });
      });
    });

    if (!ccAccts.length) {
      el.innerHTML = `<div class="page-inner">
        <p class="empty-hint" style="margin-top:32px">尚無信用卡帳戶。<br>請至設定 → 帳戶管理新增帳戶，並將類型設為「信用卡」。</p>
      </div>`;
      return;
    }

    const today = new Date();
    const cards = ccAccts.map(acct => buildCardData(acct, ledger, today));

    el.innerHTML = `<div class="page-inner">
      ${cards.map(renderCard).join('')}
      <div style="height:16px"></div>
    </div>`;

    el.querySelectorAll('.cc-toggle-paid').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = LS_PAID(btn.dataset.monthKey, btn.dataset.name);
        if (btn.dataset.paid === '1') localStorage.removeItem(key);
        else localStorage.setItem(key, '1');
        onMount();
      });
    });

    el.querySelectorAll('.cc-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = document.getElementById(`cc-tx-${btn.dataset.name}`);
        if (!list) return;
        const hidden = list.classList.toggle('hidden');
        btn.textContent = hidden ? `展開明細（${btn.dataset.count}）` : '收合';
      });
    });
  }

  function getBillingWindow(today, billingDay, dueDay) {
    const bd = billingDay || 15;
    const dd = dueDay || 25;
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();

    // cycleEnd = this month's billingDay if today >= bd, else last month's
    const cycleEnd = d >= bd
      ? new Date(y, m, bd)
      : new Date(y, m - 1, bd);

    // cycleStart = day after previous cycleEnd
    const prevEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, bd);
    const cycleStart = new Date(prevEnd.getTime() + 86400000);

    // nextDue = dd of month after cycleEnd
    const nextDue = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, dd);

    return { cycleStart, cycleEnd, nextDue };
  }

  function fmtDate(d) {
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function buildCardData(acct, ledger, today) {
    const { cycleStart, cycleEnd, nextDue } = getBillingWindow(today, acct.billingDate, acct.dueDate);
    const startStr = fmtDate(cycleStart);
    const endStr   = fmtDate(cycleEnd);

    const cycleTxs = ledger.filter(tx =>
      tx.accountOut === acct.name && tx.type === '支出' &&
      tx.date >= startStr && tx.date <= endStr
    ).sort((a, b) => b.date.localeCompare(a.date));

    const spending = cycleTxs.reduce((s, tx) => s + tx.amount, 0);

    // Detect payment: 轉帳 to this CC account after cycle end, on or before due date
    const paymentTx = ledger.find(tx =>
      tx.accountIn === acct.name && tx.type === '轉帳' &&
      tx.date > endStr && tx.date <= fmtDate(nextDue)
    );

    const monthKey = endStr.slice(0, 7);
    const manualPaid = localStorage.getItem(LS_PAID(monthKey, acct.name)) === '1';
    const isPaid = !!(paymentTx || manualPaid);

    const msLeft = nextDue - today;
    const daysLeft = Math.ceil(msLeft / 86400000);

    return { acct, cycleTxs, spending, paymentTx, isPaid, manualPaid, daysLeft, nextDue, startStr, endStr, monthKey };
  }

  function renderCard(c) {
    const { acct, cycleTxs, spending, paymentTx, isPaid, manualPaid, daysLeft, nextDue, startStr, endStr, monthKey } = c;
    const dueDateStr = fmtDate(nextDue);

    let statusClass, statusText;
    if (isPaid) {
      statusClass = 'status-paid'; statusText = '✓ 已繳';
    } else if (daysLeft < 0) {
      statusClass = 'status-urgent'; statusText = '⚠ 逾期';
    } else if (daysLeft <= 5) {
      statusClass = 'status-urgent'; statusText = `${daysLeft} 天後截止`;
    } else {
      statusClass = 'status-pending'; statusText = `${daysLeft} 天後截止`;
    }

    const txItems = cycleTxs.map(tx => `
      <div class="cc-tx-item">
        <span class="cc-tx-date">${tx.date.slice(5)}</span>
        <span class="cc-tx-cat">${tx.category}${tx.memo ? ' · ' + tx.memo : ''}</span>
        <span class="cc-tx-amt">${Utils.formatMoney(tx.amount)}</span>
      </div>`).join('');

    const safeName = acct.name.replace(/"/g, '&quot;');

    return `<div class="card cc-card">
      <div class="cc-card-header">
        <div>
          <div class="cc-card-name">💳 ${acct.name}</div>
          <div class="cc-card-cycle">${startStr.slice(5)} ～ ${endStr.slice(5)}</div>
        </div>
        <span class="cc-status ${statusClass}">${statusText}</span>
      </div>
      <div class="cc-amount">${Utils.formatMoney(spending)}</div>
      <div class="cc-due-row">
        <span class="label-sm">繳費截止</span>
        <span>${dueDateStr}</span>
        ${paymentTx ? `<span class="cc-auto-pay">已轉帳 ${Utils.formatMoney(paymentTx.amount)}</span>` : ''}
      </div>
      <div class="cc-actions">
        ${cycleTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
            data-name="${safeName}" data-count="${cycleTxs.length}">展開明細（${cycleTxs.length}）</button>` : ''}
        ${!paymentTx ? `<button class="btn ${isPaid ? 'btn-outline' : 'btn-primary'} btn-sm cc-toggle-paid"
            data-name="${safeName}" data-month-key="${monthKey}" data-paid="${isPaid ? '1' : '0'}">
            ${isPaid ? '取消標記' : '標記已繳'}</button>` : ''}
      </div>
      ${cycleTxs.length ? `<div id="cc-tx-${safeName}" class="cc-tx-list hidden">${txItems}</div>` : ''}
    </div>`;
  }

  return { render, onMount };
})());
