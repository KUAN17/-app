Router.register('projects', (() => {
  function progressBar(spent, budget) {
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    return `<div class="progress-wrap">
      <div class="progress-bar ${spent > budget ? 'over' : ''}" style="width:${pct}%"></div>
    </div>`;
  }

  function loanStats(p) {
    const paymentsMade = p.monthlyPayment > 0 ? Math.round(p.spent / p.monthlyPayment) : 0;
    const remainingPeriods = Math.max(0, p.totalPeriods - paymentsMade);
    let payoffStr = '';
    if (p.loanStartDate && p.totalPeriods) {
      const parts = p.loanStartDate.replace(/\//g, '-').split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      d.setMonth(d.getMonth() + p.totalPeriods);
      payoffStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const totalInterest = p.monthlyPayment * p.totalPeriods - p.budget;
    return { paymentsMade, remainingPeriods, payoffStr, totalInterest };
  }

  function loanSummaryCard(loans) {
    const totalBudget   = loans.reduce((s, p) => s + p.budget, 0);
    const totalSpent    = loans.reduce((s, p) => s + p.spent, 0);
    const totalRemain   = loans.reduce((s, p) => s + p.remaining, 0);
    const totalMonthly  = loans.reduce((s, p) => s + p.monthlyPayment, 0);
    const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

    // Latest payoff date across all loans
    let latestPayoff = '';
    loans.forEach(p => {
      if (!p.loanStartDate || !p.totalPeriods) return;
      const parts = p.loanStartDate.replace(/\//g, '-').split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      d.setMonth(d.getMonth() + p.totalPeriods);
      const str = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!latestPayoff || str > latestPayoff) latestPayoff = str;
    });

    return `<div class="card loan-summary-card">
      <div class="loan-summary-title">🏠 房貸總覽（${loans.length} 條）</div>
      <div class="progress-wrap" style="margin:10px 0 14px">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="proj-stats">
        <div class="proj-stat-row">
          <span class="label-sm">總貸款金額</span>
          <span>${Utils.formatMoney(totalBudget)}</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">已還合計</span>
          <span>${Utils.formatMoney(totalSpent)}</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">剩餘合計</span>
          <span class="amount-out">${Utils.formatMoney(totalRemain)}</span>
        </div>
      </div>
      <div class="proj-loan-section">
        <div class="proj-stat-row">
          <span class="label-sm">本月應繳合計</span>
          <span><strong>${Utils.formatMoney(totalMonthly)}</strong> / 月</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">整體還款進度</span>
          <span>${pct.toFixed(1)}%</span>
        </div>
        ${latestPayoff ? `<div class="proj-stat-row">
          <span class="label-sm">最晚還清日</span>
          <span>${latestPayoff}</span>
        </div>` : ''}
      </div>
    </div>`;
  }

  function projCard(p, active, sheetRow) {
    const isLoan = p.monthlyPayment > 0;
    const ls = isLoan ? loanStats(p) : null;

    const statsHtml = `<div class="proj-stats">
      <div class="proj-stat-row">
        <span class="label-sm">${isLoan ? '貸款總額' : '目標預算'}</span>
        <span>${Utils.formatMoney(p.budget)}</span>
      </div>
      <div class="proj-stat-row">
        <span class="label-sm">${isLoan ? '已還款' : '已花費'}</span>
        <span>${Utils.formatMoney(p.spent)}</span>
      </div>
      <div class="proj-stat-row">
        <span class="label-sm">${isLoan ? '剩餘款項' : '預算剩餘'}</span>
        <span class="${p.remaining < 0 ? 'amount-out' : 'amount-in'}">${Utils.formatMoney(p.remaining)}</span>
      </div>
      ${!isLoan ? `<div class="proj-stat-row">
        <span class="label-sm">已補代付</span>
        <span>${Utils.formatMoney(p.allocated)}</span>
      </div>` : ''}
    </div>`;

    const loanHtml = isLoan && ls ? `
      <div class="proj-loan-section">
        <div class="proj-stat-row">
          <span class="label-sm">月供金額</span>
          <span>${Utils.formatMoney(p.monthlyPayment)} / 月</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">已繳 / 剩餘期數</span>
          <span>${ls.paymentsMade} / ${ls.remainingPeriods} 期</span>
        </div>
        ${p.annualRate ? `<div class="proj-stat-row">
          <span class="label-sm">年利率</span><span>${p.annualRate}%</span>
        </div>` : ''}
        ${ls.payoffStr ? `<div class="proj-stat-row">
          <span class="label-sm">預計還清</span><span>${ls.payoffStr}</span>
        </div>` : ''}
        ${ls.totalInterest > 0 ? `<div class="proj-stat-row">
          <span class="label-sm">總利息試算</span>
          <span class="amount-out">${Utils.formatMoney(ls.totalInterest)}</span>
        </div>` : ''}
      </div>` : '';

    const gapHtml = !isLoan && active && p.gap > 0
      ? `<div class="gap-alert">⚠ 資金缺口 ${Utils.formatMoney(p.gap)}（代墊尚未補足）</div>` : '';

    return `<div class="card proj-detail-card">
      <div class="proj-card-name">
        ${isLoan ? '🏠 ' : ''}${p.name}
        <span class="status-badge ${active ? 'badge-active' : 'badge-closed'}">${p.status}</span>
      </div>
      ${active ? progressBar(p.spent, p.budget) : ''}
      ${statsHtml}
      ${loanHtml}
      ${gapHtml}
      <div class="proj-card-actions">
        <button class="btn btn-outline btn-sm btn-detail-proj" data-name="${p.name}">📄 明細</button>
        <button class="btn btn-outline btn-sm btn-edit-proj" data-name="${p.name}" data-row="${sheetRow}">編輯</button>
        ${active ? `<button class="btn btn-outline btn-sm btn-close-proj" data-name="${p.name}">結案</button>` : ''}
      </div>
    </div>`;
  }

  function render(el) {
    el.innerHTML = `<div class="page-inner"><div class="spinner"></div></div>`;
  }

  async function onMount() {
    const el = Utils.el('page-content');
    await Store.load();
    const { projects } = Store.get();

    const active = projects.filter(p => p.status === '進行中');
    const closed = projects.filter(p => p.status === '已結案');
    const activeLoans = active.filter(p => p.monthlyPayment > 0);

    el.innerHTML = `<div class="page-inner">
      ${activeLoans.length >= 2 ? loanSummaryCard(activeLoans) : ''}
      <div class="section-header">
        <span class="section-label">進行中</span>
        <button class="btn btn-primary btn-sm" id="btn-new-proj">＋ 新增</button>
      </div>
      ${active.length ? active.map(p => projCard(p, true, projects.indexOf(p) + 2)).join('') : '<p class="empty-hint">目前無進行中專案</p>'}
      ${closed.length ? `
        <div class="section-label" style="margin-top:24px">已結案</div>
        ${closed.map(p => projCard(p, false, projects.indexOf(p) + 2)).join('')}
      ` : ''}
      <div style="height:16px"></div>
    </div>`;

    Utils.el('btn-new-proj').addEventListener('click', () => showNewProjModal());
    el.querySelectorAll('.btn-close-proj').forEach(btn => {
      btn.addEventListener('click', () => closeProject(btn.dataset.name));
    });
    el.querySelectorAll('.btn-edit-proj').forEach(btn => {
      const proj = projects.find(p => p.name === btn.dataset.name);
      btn.addEventListener('click', () => showEditProjModal(proj, parseInt(btn.dataset.row)));
    });
    el.querySelectorAll('.btn-detail-proj').forEach(btn => {
      const proj = projects.find(p => p.name === btn.dataset.name);
      btn.addEventListener('click', () => showProjectDetail(proj));
    });
  }

  // ── Project spending detail ───────────────────────────────────────────────
  function showProjectDetail(p) {
    if (!p) return;
    const items = Store.get().ledger
      .filter(tx => tx.projectTag === p.name && tx.type === '支出')
      .sort((a, b) => b.date.localeCompare(a.date));

    const listHtml = items.length ? items.map(tx => {
      const label = tx.memo || tx.category || '（未命名）';
      const payTag = tx.payAccount
        ? `<span class="proj-detail-paytag">${tx.payRole || ''}${tx.payRole ? '／' : ''}${tx.payAccount} 代付</span>`
        : '';
      return `<div class="proj-detail-item">
        <div class="proj-detail-item-main">
          <span class="proj-detail-item-name">${label}</span>
          <span class="proj-detail-item-amt amount-out">${Utils.formatMoney(tx.amount)}</span>
        </div>
        <div class="proj-detail-item-sub">
          <span>${tx.date}</span>
          ${tx.category && tx.memo ? `<span>· ${tx.category}</span>` : ''}
          ${payTag}
        </div>
      </div>`;
    }).join('') : `<p class="empty-hint">尚無支出記錄</p>`;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card" style="max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-title">${p.name}｜已花費明細</div>
      <div class="proj-detail-summary">
        <div><span class="label-sm">目標預算</span><span>${Utils.formatMoney(p.budget)}</span></div>
        <div><span class="label-sm">已花費</span><span>${Utils.formatMoney(p.spent)}</span></div>
        <div><span class="label-sm">預算剩餘</span><span class="${p.remaining < 0 ? 'amount-out' : 'amount-in'}">${Utils.formatMoney(p.remaining)}</span></div>
        <div><span class="label-sm">筆數</span><span>${items.length} 筆</span></div>
      </div>
      <div class="proj-detail-list" style="overflow-y:auto;flex:1">${listHtml}</div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-outline btn-sm" id="btn-close-proj-detail">關閉</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-close-proj-detail').addEventListener('click', () => modal.remove());
  }

  // ── New project modal ─────────────────────────────────────────────────────
  function showNewProjModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const roleOpts = Store.roleNames().map(r => `<option value="${r}">${r}</option>`).join('');
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">新增專案</div>
      <div class="form-row">
        <label>類型</label>
        <div class="proj-type-toggle">
          <button type="button" class="proj-type-btn active" id="ptype-general">一般專案</button>
          <button type="button" class="proj-type-btn" id="ptype-loan">🏠 貸款計畫</button>
        </div>
      </div>
      <div class="form-row">
        <label>專案名稱</label>
        <input type="text" id="inp-proj-name" class="form-input" placeholder="例：[家] 裝潢">
      </div>
      <div class="form-row">
        <label id="lbl-budget">目標預算</label>
        <input type="number" id="inp-proj-budget" class="form-input" placeholder="0" min="0">
      </div>
      <div class="form-row">
        <label>費用歸屬角色 *</label>
        <select id="inp-proj-owner-role" class="form-select">
          <option value="">請選擇</option>${roleOpts}
        </select>
      </div>
      <div class="form-row">
        <label>預設扣款帳戶</label>
        <select id="inp-proj-default-acct" class="form-select">
          <option value="">（不指定）</option>
        </select>
      </div>
      <div id="loan-extra" style="display:none">
        <div class="form-row">
          <label>月供金額</label>
          <input type="number" id="inp-monthly" class="form-input" placeholder="每月繳款金額" min="0">
        </div>
        <div class="form-row">
          <label>年利率 (%)</label>
          <input type="number" id="inp-rate" class="form-input" placeholder="例：2.06" step="0.01" min="0">
        </div>
        <div class="form-row">
          <label>貸款開始日</label>
          <input type="date" id="inp-loan-start" class="form-input">
        </div>
        <div class="form-row">
          <label>總期數（月）</label>
          <input type="number" id="inp-periods" class="form-input" placeholder="例：360（30年）" min="1">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-proj">儲存</button>
        <button class="btn btn-outline btn-sm" id="btn-cancel-proj">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-cancel-proj').addEventListener('click', () => modal.remove());
    Utils.el('btn-save-proj').addEventListener('click', () => saveNewProject(modal));

    Utils.el('inp-proj-owner-role').addEventListener('change', e => {
      const accts = Store.accountsForRole(e.target.value);
      Utils.el('inp-proj-default-acct').innerHTML =
        '<option value="">（不指定）</option>' +
        accts.map(a => `<option value="${a}">${a}</option>`).join('');
    });

    Utils.el('ptype-general').addEventListener('click', () => {
      Utils.el('ptype-general').classList.add('active');
      Utils.el('ptype-loan').classList.remove('active');
      Utils.el('loan-extra').style.display = 'none';
      Utils.el('lbl-budget').textContent = '目標預算';
    });
    Utils.el('ptype-loan').addEventListener('click', () => {
      Utils.el('ptype-loan').classList.add('active');
      Utils.el('ptype-general').classList.remove('active');
      Utils.el('loan-extra').style.display = 'block';
      Utils.el('lbl-budget').textContent = '貸款總額';
    });
  }

  async function saveNewProject(modal) {
    const name         = Utils.el('inp-proj-name').value.trim();
    const budget       = parseFloat(Utils.el('inp-proj-budget').value) || 0;
    const ownerRole    = Utils.el('inp-proj-owner-role').value;
    const defaultAcct  = Utils.el('inp-proj-default-acct').value;
    const isLoan       = Utils.el('ptype-loan').classList.contains('active');
    if (!name)       return Utils.toast('請輸入專案名稱', 'warn');
    if (budget <= 0) return Utils.toast('請輸入金額', 'warn');
    if (!ownerRole)  return Utils.toast('請選擇費用歸屬角色', 'warn');

    let monthly = 0, rate = 0, startDate = '', periods = 0;
    if (isLoan) {
      monthly   = parseFloat(Utils.el('inp-monthly').value) || 0;
      rate      = parseFloat(Utils.el('inp-rate').value) || 0;
      startDate = (Utils.el('inp-loan-start').value || '').replace(/-/g, '/');
      periods   = parseInt(Utils.el('inp-periods').value) || 0;
      if (!monthly) return Utils.toast('請輸入月供金額', 'warn');
      if (!periods) return Utils.toast('請輸入還款期數', 'warn');
    }

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    // A-C: status/name/budget, D-H: formula placeholders, I-L: loan fields, M-N: ownerRole/defaultAccount
    const row = isLoan
      ? ['進行中', name, budget, '', '', '', '', '', monthly, rate, startDate, periods, ownerRole, defaultAcct]
      : ['進行中', name, budget, '', '', '', '', '', '', '', '', '', ownerRole, defaultAcct];

    Utils.showLoading(true);
    try {
      await API.append(sid, 'Projects!A:N', row);
      Store.invalidate();
      await Store.load(true);
      modal.remove();
      await onMount();
      Utils.toast('專案已新增', 'success');
    } catch (e) {
      Utils.toast('新增失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  // ── Edit project modal ────────────────────────────────────────────────────
  function showEditProjModal(p, sheetRow) {
    if (!p) return;
    const isLoan = p.monthlyPayment > 0;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const roleOpts = Store.roleNames().map(r =>
      `<option value="${r}"${p.ownerRole===r?' selected':''}>${r}</option>`
    ).join('');
    const accts = p.ownerRole ? Store.accountsForRole(p.ownerRole) : [];
    const acctOpts = accts.map(a =>
      `<option value="${a}"${p.defaultAccount===a?' selected':''}>${a}</option>`
    ).join('');
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">編輯專案</div>
      <div class="form-row">
        <label>專案名稱</label>
        <input type="text" id="inp-edit-proj-name" class="form-input" value="${p.name.replace(/"/g,'&quot;')}">
      </div>
      <div class="form-row">
        <label>${isLoan ? '貸款總額' : '目標預算'}</label>
        <input type="number" id="inp-edit-proj-budget" class="form-input" value="${p.budget}" min="0">
      </div>
      <div class="form-row">
        <label>費用歸屬角色 *</label>
        <select id="inp-edit-owner-role" class="form-select">
          <option value="">請選擇</option>${roleOpts}
        </select>
      </div>
      <div class="form-row">
        <label>預設扣款帳戶</label>
        <select id="inp-edit-default-acct" class="form-select">
          <option value="">（不指定）</option>${acctOpts}
        </select>
      </div>
      ${isLoan ? `
      <div class="form-row">
        <label>月供金額</label>
        <input type="number" id="inp-edit-monthly" class="form-input" value="${p.monthlyPayment}" min="0">
      </div>
      <div class="form-row">
        <label>年利率 (%)</label>
        <input type="number" id="inp-edit-rate" class="form-input" value="${p.annualRate}" step="0.01" min="0">
      </div>
      <div class="form-row">
        <label>貸款開始日</label>
        <input type="date" id="inp-edit-loan-start" class="form-input" value="${p.loanStartDate.replace(/\//g,'-')}">
      </div>
      <div class="form-row">
        <label>總期數（月）</label>
        <input type="number" id="inp-edit-periods" class="form-input" value="${p.totalPeriods}" min="1">
      </div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-edit-proj">儲存</button>
        <button class="btn btn-outline btn-sm" id="btn-cancel-edit-proj">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-cancel-edit-proj').addEventListener('click', () => modal.remove());
    Utils.el('btn-save-edit-proj').addEventListener('click', () => saveEditProject(p, isLoan, sheetRow, modal));

    Utils.el('inp-edit-owner-role').addEventListener('change', e => {
      const accts = Store.accountsForRole(e.target.value);
      Utils.el('inp-edit-default-acct').innerHTML =
        '<option value="">（不指定）</option>' +
        accts.map(a => `<option value="${a}">${a}</option>`).join('');
    });
  }

  async function saveEditProject(oldProj, isLoan, sheetRow, modal) {
    const newName    = Utils.el('inp-edit-proj-name').value.trim();
    const newBudget  = parseFloat(Utils.el('inp-edit-proj-budget').value) || 0;
    const ownerRole  = Utils.el('inp-edit-owner-role').value;
    const defaultAcct = Utils.el('inp-edit-default-acct').value;
    if (!newName)    return Utils.toast('請輸入專案名稱', 'warn');
    if (newBudget <= 0) return Utils.toast('請輸入金額', 'warn');
    if (!ownerRole)  return Utils.toast('請選擇費用歸屬角色', 'warn');

    // 改名連動：帳本 projectTag 一併改寫，否則已花費/已補代付/明細會因名稱脫鉤而歸零
    const renamed = newName !== oldProj.name;
    const tagRefs = renamed
      ? Store.get().ledger.filter(tx => tx.projectTag === oldProj.name)
      : [];
    if (renamed && tagRefs.length &&
        !confirm(`專案改名「${oldProj.name}」→「${newName}」\n將同步更新帳本 ${tagRefs.length} 筆紀錄的專案標籤。繼續？`)) return;

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const saveBtn = Utils.el('btn-save-edit-proj');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
    try {
      await API.updateRange(sid, `Projects!B${sheetRow}:C${sheetRow}`, [[newName, newBudget]]);
      if (tagRefs.length) {
        await API.batchUpdateValues(sid, tagRefs.map(tx => ({ range: `Ledger!D${tx._row}`, values: [[newName]] })));
      }
      await API.updateRange(sid, `Projects!M${sheetRow}:N${sheetRow}`, [[ownerRole, defaultAcct]]);
      if (isLoan) {
        const monthly   = parseFloat(Utils.el('inp-edit-monthly').value) || 0;
        const rate      = parseFloat(Utils.el('inp-edit-rate').value) || 0;
        const startDate = (Utils.el('inp-edit-loan-start').value || '').replace(/-/g, '/');
        const periods   = parseInt(Utils.el('inp-edit-periods').value) || 0;
        await API.updateRange(sid, `Projects!I${sheetRow}:L${sheetRow}`, [[monthly, rate, startDate, periods]]);
      }
      Store.invalidate();
      await Store.load(true);
      modal.remove();
      await onMount();
      Utils.toast('專案已更新', 'success');
    } catch (e) {
      Utils.toast('更新失敗：' + e.message, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
    }
  }

  // 直接結案＋Undo Toast（取代 confirm）
  async function closeProject(name) {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const { projects } = Store.get();
    const idx = projects.findIndex(p => p.name === name);
    if (idx < 0) return;
    Utils.showLoading(true);
    try {
      await API.updateRange(sid, `Projects!A${idx + 2}`, [['已結案']]);
      Store.invalidate();
      await Store.load(true);
      await onMount();
      Utils.toast(`「${name}」已結案`, 'success', {
        actionLabel: '復原',
        onAction: async () => {
          Utils.showLoading(true);
          try {
            await API.updateRange(sid, `Projects!A${idx + 2}`, [['進行中']]);
            Store.invalidate();
            await Store.load(true);
            await onMount();
            Utils.toast('已復原', 'success');
          } catch (e) {
            Utils.toast('復原失敗：' + e.message, 'error');
          } finally {
            Utils.showLoading(false);
          }
        }
      });
    } catch (e) {
      Utils.toast('操作失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  return { render, onMount };
})());
