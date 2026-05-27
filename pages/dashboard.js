Router.register('dashboard', (() => {
  function calcMonthSummary(ledger) {
    const s = { '阿熊': { in: 0, out: 0 }, '綺綺': { in: 0, out: 0 }, '家用': { in: 0, out: 0 } };
    ledger.forEach(tx => {
      if (!Utils.isThisMonth(tx.date)) return;
      if (tx.type === '支出' && s[tx.roleOut]) s[tx.roleOut].out += tx.amount;
      if (tx.type === '收入' && s[tx.roleOut]) s[tx.roleOut].in += tx.amount;
      if (tx.type === '公積金提撥') {
        if (s[tx.roleOut]) s[tx.roleOut].out += tx.amount;
        if (s[tx.roleIn]) s[tx.roleIn].in += tx.amount;
      }
    });
    return s;
  }

  function progressBar(spent, budget) {
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over = spent > budget;
    return `<div class="progress-wrap">
      <div class="progress-bar ${over ? 'over' : ''}" style="width:${pct}%"></div>
    </div>`;
  }

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    try {
      await Store.load();
      const { ledger, projects, investments } = Store.get();
      const summary = calcMonthSummary(ledger);

      const totalMV = investments.reduce((s, i) => s + i.marketValue, 0);
      const totalUnreal = investments.reduce((s, i) => s + i.unrealized, 0);

      const activeProj = projects.filter(p => p.status === '進行中');

      const roleCards = CFG.ROLES.map(role => {
        const s = summary[role];
        const net = s.in - s.out;
        return `<div class="card role-card">
          <div class="role-card-header">${role}</div>
          <div class="role-card-row">
            <span class="label-sm">收入</span>
            <span class="amount-in">${Utils.formatMoney(s.in)}</span>
          </div>
          <div class="role-card-row">
            <span class="label-sm">支出</span>
            <span class="amount-out">${Utils.formatMoney(s.out)}</span>
          </div>
          <div class="role-card-divider"></div>
          <div class="role-card-row">
            <span class="label-sm">淨現金流</span>
            <span class="${net >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(net, true)}</span>
          </div>
        </div>`;
      }).join('');

      const projCards = activeProj.length === 0
        ? `<p class="empty-hint">目前無進行中專案</p>`
        : activeProj.map(p => {
            const gapHtml = p.gap > 0
              ? `<div class="gap-alert">⚠ 資金缺口 ${Utils.formatMoney(p.gap)}</div>`
              : '';
            return `<div class="card proj-card" data-proj="${p.name}">
              <div class="proj-card-name">${p.name}</div>
              ${progressBar(p.spent, p.budget)}
              <div class="proj-card-nums">
                <span>${Utils.formatMoney(p.spent)} / ${Utils.formatMoney(p.budget)}</span>
                <span class="${p.remaining < 0 ? 'amount-out' : ''}">剩 ${Utils.formatMoney(p.remaining)}</span>
              </div>
              ${gapHtml}
            </div>`;
          }).join('');

      el.innerHTML = `<div class="page-inner">
        <div class="section-label">${Utils.monthLabel()} 金流總覽</div>
        <div class="role-cards">${roleCards}</div>

        <div class="section-label">投資組合</div>
        <div class="card invest-summary">
          <div class="invest-row">
            <span class="label-sm">總市值</span>
            <span class="amount-primary">${Utils.formatMoney(totalMV)}</span>
          </div>
          <div class="invest-row">
            <span class="label-sm">未實現損益</span>
            <span class="${totalUnreal >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(totalUnreal, true)}</span>
          </div>
        </div>

        <div class="section-label">進行中專案</div>
        ${projCards}
        <div style="height:16px"></div>
      </div>`;

      el.querySelectorAll('.proj-card').forEach(card => {
        card.addEventListener('click', () => Router.go('projects'));
      });
    } catch (e) {
      el.innerHTML = `<div class="page-inner"><div class="error-msg">${e.message}</div></div>`;
    }
  }

  return { render, onMount };
})());
