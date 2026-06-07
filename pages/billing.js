Router.register('billing', (() => {
  const LS_PAID = (monthKey, name) => `ff_cc_paid_${monthKey}_${name}`;

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    await Store.load();
    const { accounts, ledger } = Store.get();

    const today = new Date();

    // Collect CC accounts grouped by role
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

    // Build card data for every CC, filter out paid
    const sections = roles.map(role => ({
      role,
      cards: byRole[role]
        .map(acct => buildCardData(acct, ledger, today))
        .filter(c => !c.isPaid)
    }));

    const anyVisible = sections.some(s => s.cards.length);

    let html = `<div class="page-inner">`;

    if (!anyVisible) {
      html += `<div class="card" style="text-align:center;padding:32px 16px">
        <div style="font-size:2rem;margin-bottom:8px">✓</div>
        <div style="font-weight:600;font-size:1.1rem">本期無待繳帳單</div>
        <div style="color:var(--text-muted);margin-top:4px;font-size:.9rem">所有信用卡帳單均已繳清</div>
      </div>`;
    } else {
      sections.forEach(({ role, cards }) => {
        if (!cards.length) return;
        html += `<div class="billing-role-header">${role}</div>`;
        html += cards.map(renderCard).join('');
      });
    }

    html += `<div style="height:16px"></div></div>`;
    el.innerHTML = html;

    el.querySelectorAll('.cc-toggle-paid').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = LS_PAID(btn.dataset.monthKey, btn.dataset.name);
        localStorage.setItem(key, '1');
        onMount();
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

  function getBillingWindow(today, billingDay, dueDay) {
    const bd = billingDay || 15;
    const dd = dueDay || 25;
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();

    const cycleEnd = d >= bd
      ? new Date(y, m, bd)
      : new Date(y, m - 1, bd);

    const prevEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, bd);
    const cycleStart = new Date(prevEnd.getTime() + 86400000);
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
    const todayStr = fmtDate(today);

    const inProgress = todayStr <= endStr; // today is still within billing period

    const cycleTxs = ledger.filter(tx =>
      (tx.accountOut === acct.name || tx.payAccount === acct.name) &&
      tx.type === '支出' &&
      tx.date >= startStr && tx.date <= (inProgress ? todayStr : endStr)
    ).sort((a, b) => b.date.localeCompare(a.date));

    const spending = cycleTxs.reduce((s, tx) => s + tx.amount, 0);

    const paymentTx = !inProgress ? ledger.find(tx =>
      tx.accountIn === acct.name && tx.type === '轉帳' &&
      tx.date > endStr && tx.date <= fmtDate(nextDue)
    ) : null;

    const monthKey = endStr.slice(0, 7);
    const manualPaid = !inProgress && localStorage.getItem(LS_PAID(monthKey, acct.name)) === '1';
    const isPaid = !!(paymentTx || manualPaid);

    const msLeft = nextDue - today;
    const daysLeft = Math.ceil(msLeft / 86400000);

    return { acct, cycleTxs, spending, paymentTx, isPaid, inProgress, daysLeft, nextDue, startStr, endStr, monthKey };
  }

  let _cardIdx = 0;

  function renderCard(c) {
    const { acct, cycleTxs, spending, paymentTx, inProgress, daysLeft, nextDue, startStr, endStr, monthKey } = c;
    const idx = _cardIdx++;
    const dueDateStr = fmtDate(nextDue);
    const safeName = acct.name.replace(/"/g, '&quot;');

    let statusClass, statusText;
    if (inProgress) {
      statusClass = 'status-progress'; statusText = '進行中';
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

    const cycleLabel = inProgress
      ? `${startStr.slice(5)} ～ 今天`
      : `${startStr.slice(5)} ～ ${endStr.slice(5)}`;

    return `<div class="card cc-card">
      <div class="cc-card-header">
        <div>
          <div class="cc-card-name">💳 ${acct.name}</div>
          <div class="cc-card-cycle">${cycleLabel}</div>
        </div>
        <span class="cc-status ${statusClass}">${statusText}</span>
      </div>
      <div class="cc-amount">${Utils.formatMoney(spending)}</div>
      ${!inProgress ? `<div class="cc-due-row">
        <span class="label-sm">繳費截止</span>
        <span>${dueDateStr}</span>
        ${paymentTx ? `<span class="cc-auto-pay">已轉帳 ${Utils.formatMoney(paymentTx.amount)}</span>` : ''}
      </div>` : ''}
      <div class="cc-actions">
        ${cycleTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
            data-idx="${idx}" data-count="${cycleTxs.length}">展開明細（${cycleTxs.length}）</button>` : ''}
        ${!inProgress && !paymentTx ? `<button class="btn btn-primary btn-sm cc-toggle-paid"
            data-name="${safeName}" data-month-key="${monthKey}">標記已繳</button>` : ''}
      </div>
      ${cycleTxs.length ? `<div id="cc-tx-${idx}" class="cc-tx-list hidden">${txItems}</div>` : ''}
    </div>`;
  }

  return { render, onMount };
})());
