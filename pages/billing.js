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
    Store.roleNames().forEach(role => {
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
        <div class="empty-cta" style="margin-top:32px">
          <div class="empty-cta-icon">💳</div>
          <p>尚無信用卡帳戶<br><span class="label-sm">新增帳戶並將類型設為「信用卡」，即可管理帳單週期</span></p>
          <button class="btn btn-primary" id="btn-goto-settings">前往帳戶管理 →</button>
        </div>
      </div>`;
      Utils.el('btn-goto-settings')?.addEventListener('click', () => Router.go('settings'));
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
    const { past, current } = Utils.billingWindows(today, acct.billingDate, acct.dueDate);
    const safeName = acct.name.replace(/"/g, '&quot;');

    // 帳單引擎：金額/已繳/狀態單一來源（FIFO 沖最舊，不看繳費日期）
    const { bills, issuedUnpaid } = Utils.cardBills(acct.role, acct, ledger, today);
    const unpaidSum = issuedUnpaid.reduce((s, b) => s + b.remain, 0); // 去繳費帶全卡未繳合計

    // ── 本期（進行中）
    const curEndStr = fmtDate(current.end);
    const curBill   = bills.find(b => b.end === curEndStr);
    const curTxs    = (curBill?.txs || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const curListId = `cc-tx-${baseIdx * 2}`;

    const curSection = `
      <div class="cc-period-section">
        <div class="cc-period-header">
          <span class="cc-period-label">本期</span>
          <span class="cc-period-range">${fmtDate(current.start).slice(5)} ～ ${curEndStr.slice(5)}</span>
          <span class="cc-status status-progress">進行中</span>
        </div>
        <div class="cc-amount">${Utils.formatMoney(curBill?.amount || 0)}</div>
        <div class="cc-actions">
          ${curTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
              data-idx="${baseIdx * 2}" data-count="${curTxs.length}">展開明細（${curTxs.length}）</button>` : ''}
        </div>
        ${txListHtml(curTxs, curListId)}
      </div>`;

    // ── 上期（已出帳）
    const pastEndStr = fmtDate(past.end);
    const pastBill   = bills.find(b => b.end === pastEndStr);
    const pastTxs    = (pastBill?.txs || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const pastListId = `cc-tx-${baseIdx * 2 + 1}`;

    let pastSection;
    if (pastBill && pastBill.status === '未繳清') {
      const daysLeft  = Math.ceil((past.due - today) / 86400000);
      const statusClass = daysLeft <= 5 ? 'status-urgent' : 'status-pending';
      const statusText  = daysLeft < 0 ? '⚠ 逾期' : `${daysLeft} 天後截止`;

      pastSection = `
        <div class="cc-period-section cc-period-past">
          <div class="cc-period-header">
            <span class="cc-period-label">上期</span>
            <span class="cc-period-range">${pastBill.start.slice(5)} ～ ${pastEndStr.slice(5)}</span>
            <span class="cc-status ${statusClass}">${statusText}</span>
          </div>
          <div class="cc-amount">${Utils.formatMoney(pastBill.remain)}</div>
          ${pastBill.paid > 0 ? `<div class="cc-due-row">
            <span class="label-sm">帳單 ${Utils.formatMoney(pastBill.amount)}，已繳 ${Utils.formatMoney(pastBill.paid)}</span>
          </div>` : ''}
          <div class="cc-due-row">
            <span class="label-sm">繳費截止</span>
            <span>${fmtDate(past.due)}</span>
          </div>
          <div class="cc-actions">
            ${pastTxs.length ? `<button class="btn btn-outline btn-sm cc-expand-btn"
                data-idx="${baseIdx * 2 + 1}" data-count="${pastTxs.length}">展開明細（${pastTxs.length}）</button>` : ''}
            <button class="btn btn-primary btn-sm cc-pay-btn"
                data-role="${acct.role}" data-name="${safeName}" data-amount="${unpaidSum}">前往繳費 →</button>
          </div>
          ${txListHtml(pastTxs, pastListId)}
        </div>`;
    } else {
      // 無上期帳單或已繳清
      pastSection = `
        <div class="cc-period-section cc-period-past">
          <div class="cc-period-header">
            <span class="cc-period-label">上期</span>
            <span class="cc-period-range">${(pastBill?.start || fmtDate(past.start)).slice(5)} ～ ${pastEndStr.slice(5)}</span>
            <span class="cc-status status-progress">${pastBill ? '✓ 已繳清' : '無消費'}</span>
          </div>
          <div class="cc-amount" style="color:var(--text-muted)">${Utils.formatMoney(pastBill?.amount || 0)}</div>
          ${pastBill ? `<div class="cc-due-row">
            <span class="cc-auto-pay">已繳 ${Utils.formatMoney(pastBill.paid)}</span>
          </div>` : ''}
        </div>`;
    }

    // ── 更早未繳（上期之前仍未繳清的帳單，過去看不到的盲區）
    const earlier = issuedUnpaid.filter(b => b.end < pastEndStr);
    const earlierSection = earlier.length ? `
      <div class="cc-period-section cc-period-past">
        <div class="cc-period-header">
          <span class="cc-period-label">更早未繳</span>
          <span class="cc-status status-urgent">⚠ ${earlier.length} 期</span>
        </div>
        ${earlier.map(b => `<div class="cc-due-row">
          <span class="label-sm">${b.start.slice(5)} ～ ${b.end.slice(5)}（截止 ${b.due.slice(5)}）</span>
          <span class="amount-out">${Utils.formatMoney(b.remain)}</span>
        </div>`).join('')}
        <div class="cc-actions">
          <button class="btn btn-primary btn-sm cc-pay-btn"
              data-role="${acct.role}" data-name="${safeName}" data-amount="${unpaidSum}">一次繳清 ${Utils.formatMoney(unpaidSum)} →</button>
        </div>
      </div>` : '';

    return `<div class="card cc-card">
      <div class="cc-card-name">💳 ${acct.name}</div>
      ${curSection}
      ${pastSection}
      ${earlierSection}
    </div>`;
  }

  return { render, onMount };
})());
