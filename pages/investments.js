Router.register('investments', (() => {
  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    await Store.load();
    const { investments } = Store.get();

    const totalMV = investments.reduce((s, i) => s + i.marketValue, 0);
    const totalCost = investments.reduce((s, i) => s + i.totalCost, 0);
    const totalUnreal = investments.reduce((s, i) => s + i.unrealized, 0);
    const totalReturn = totalCost > 0 ? totalUnreal / totalCost : 0;

    const byRole = {};
    investments.forEach(i => {
      if (!byRole[i.role]) byRole[i.role] = [];
      byRole[i.role].push(i);
    });

    const roleSections = Object.entries(byRole).map(([role, items]) => {
      const rows = items.map(i => `
        <div class="inv-row">
          <div class="inv-ticker">${i.ticker}</div>
          <div class="inv-name">${i.name}</div>
          <div class="inv-shares">${i.shares} 股</div>
          <div class="inv-price">$${i.price.toLocaleString()}</div>
          <div class="inv-mv">${Utils.formatMoney(i.marketValue)}</div>
          <div class="inv-ret ${i.unrealized >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(i.unrealized, true)}</div>
          <div class="inv-pct ${i.returnRate >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatPct(i.returnRate)}</div>
        </div>`).join('');

      const roleMV = items.reduce((s, i) => s + i.marketValue, 0);
      return `<div class="section-label">${role}
        <span class="section-sub">${Utils.formatMoney(roleMV)}</span>
      </div>
      <div class="card inv-table">
        <div class="inv-header">
          <span>代號</span><span>名稱</span><span>股數</span><span>現價</span><span>市值</span><span>損益</span><span>報酬</span>
        </div>
        ${rows || '<p class="empty-hint" style="padding:12px">無持倉</p>'}
      </div>`;
    }).join('');

    el.innerHTML = `<div class="page-inner">
      <div class="card invest-total">
        <div class="invest-total-row">
          <span class="label-sm">投資組合總市值</span>
          <span class="amount-primary invest-total-num">${Utils.formatMoney(totalMV)}</span>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">總成本</span>
          <span>${Utils.formatMoney(totalCost)}</span>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">未實現損益</span>
          <span class="${totalUnreal >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatMoney(totalUnreal, true)}</span>
        </div>
        <div class="invest-total-row">
          <span class="label-sm">整體報酬率</span>
          <span class="${totalReturn >= 0 ? 'amount-in' : 'amount-out'}">${Utils.formatPct(totalReturn)}</span>
        </div>
      </div>

      ${roleSections || '<p class="empty-hint">尚無持倉資料，請至 Google Sheets Investments 表新增</p>'}
      <div style="height:16px"></div>
    </div>`;
  }

  return { render, onMount };
})());
