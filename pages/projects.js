Router.register('projects', (() => {
  function progressBar(spent, budget) {
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over = spent > budget;
    return `<div class="progress-wrap">
      <div class="progress-bar ${over ? 'over' : ''}" style="width:${pct}%"></div>
    </div>`;
  }

  function projCard(p, active, sheetRow) {
    const gapHtml = active && p.gap > 0
      ? `<div class="gap-alert">⚠ 資金缺口 ${Utils.formatMoney(p.gap)}（代墊尚未補足）</div>` : '';
    const allocRow = `<div class="proj-stat-row">
      <span class="label-sm">已提撥準備金</span>
      <span>${Utils.formatMoney(p.allocated)}</span>
    </div>`;
    return `<div class="card proj-detail-card">
      <div class="proj-card-name">
        ${p.name}
        <span class="status-badge ${active ? 'badge-active' : 'badge-closed'}">${p.status}</span>
      </div>
      ${active ? progressBar(p.spent, p.budget) : ''}
      <div class="proj-stats">
        <div class="proj-stat-row">
          <span class="label-sm">目標預算</span>
          <span>${Utils.formatMoney(p.budget)}</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">已花費</span>
          <span class="${p.spent > p.budget ? 'amount-out' : ''}">${Utils.formatMoney(p.spent)}</span>
        </div>
        <div class="proj-stat-row">
          <span class="label-sm">預算剩餘</span>
          <span class="${p.remaining < 0 ? 'amount-out' : 'amount-in'}">${Utils.formatMoney(p.remaining)}</span>
        </div>
        ${allocRow}
      </div>
      ${gapHtml}
      <div class="proj-card-actions">
        <button class="btn btn-outline btn-sm btn-edit-proj" data-name="${p.name}" data-budget="${p.budget}" data-row="${sheetRow}">編輯</button>
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

    el.innerHTML = `<div class="page-inner">
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
      btn.addEventListener('click', () => showEditProjModal(btn.dataset.name, parseFloat(btn.dataset.budget), parseInt(btn.dataset.row)));
    });
  }

  function showNewProjModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">新增專案</div>
      <div class="form-row">
        <label>專案名稱</label>
        <input type="text" id="inp-proj-name" class="form-input" placeholder="例：[家] 裝潢">
      </div>
      <div class="form-row">
        <label>目標預算</label>
        <input type="number" id="inp-proj-budget" class="form-input" placeholder="0" min="0">
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
  }

  async function saveNewProject(modal) {
    const name = Utils.el('inp-proj-name').value.trim();
    const budget = parseFloat(Utils.el('inp-proj-budget').value) || 0;
    if (!name) return Utils.toast('請輸入專案名稱', 'warn');
    if (budget <= 0) return Utils.toast('請輸入預算金額', 'warn');

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    Utils.showLoading(true);
    try {
      await API.append(sid, 'Projects!A:C', ['進行中', name, budget]);
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

  async function closeProject(name) {
    if (!confirm(`確定將「${name}」結案？`)) return;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const { projects } = Store.get();
    const idx = projects.findIndex(p => p.name === name);
    if (idx < 0) return;
    const sheetRowNum = idx + 2;
    Utils.showLoading(true);
    try {
      await API.updateRange(sid, `Projects!A${sheetRowNum}`, [['已結案']]);
      Store.invalidate();
      await Store.load(true);
      await onMount();
      Utils.toast('已結案', 'success');
    } catch (e) {
      Utils.toast('操作失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  function showEditProjModal(name, budget, sheetRow) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
      <div class="modal-title">編輯專案</div>
      <div class="form-row">
        <label>專案名稱</label>
        <input type="text" id="inp-edit-proj-name" class="form-input" value="${name.replace(/"/g,'&quot;')}">
      </div>
      <div class="form-row">
        <label>目標預算</label>
        <input type="number" id="inp-edit-proj-budget" class="form-input" value="${budget}" min="0">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-edit-proj">儲存</button>
        <button class="btn btn-outline btn-sm" id="btn-cancel-edit-proj">取消</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-cancel-edit-proj').addEventListener('click', () => modal.remove());
    Utils.el('btn-save-edit-proj').addEventListener('click', () => saveEditProject(name, sheetRow, modal));
  }

  async function saveEditProject(oldName, sheetRow, modal) {
    const newName = Utils.el('inp-edit-proj-name').value.trim();
    const newBudget = parseFloat(Utils.el('inp-edit-proj-budget').value) || 0;
    if (!newName) return Utils.toast('請輸入專案名稱', 'warn');
    if (newBudget <= 0) return Utils.toast('請輸入預算金額', 'warn');

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    const saveBtn = Utils.el('btn-save-edit-proj');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
    try {
      await API.updateRange(sid, `Projects!B${sheetRow}:C${sheetRow}`, [[newName, newBudget]]);
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

  return { render, onMount };
})());
