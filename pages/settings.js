Router.register('settings', (() => {
  // In-memory account state for the management UI
  let _acctState = {}; // { role: [{name, purpose, balance, baseDate, _deleted, _new}] }

  // ── Render shell ─────────────────────────────────────────────────────────
  function render(el) {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID || '';
    const cid = localStorage.getItem(CFG.LS_KEYS.CLIENT_ID) || CFG.CLIENT_ID || '';

    el.innerHTML = `<div class="page-inner">

      <div class="section-label">Google 連線設定</div>
      <div class="card settings-card">
        <div class="form-row">
          <label>OAuth Client ID</label>
          <input type="text" id="inp-client-id" class="form-input" value="${cid}" placeholder="your-client-id.apps.googleusercontent.com">
        </div>
        <div class="form-row">
          <label>Spreadsheet ID</label>
          <input type="text" id="inp-sheet-id" class="form-input" value="${sid}" placeholder="從 Google Sheets 網址列複製">
        </div>
        <button class="btn btn-primary btn-full" id="btn-save-conn">儲存連線設定</button>
      </div>

      <div class="section-label">帳戶管理</div>
      <p class="section-hint">新增、刪除各角色的帳戶，並設定期初餘額。</p>
      <div id="acct-mgmt-section"><div class="spinner"></div></div>

      <div class="section-label">後端試算表初始化</div>
      <div class="card settings-card">
        <p class="input-hint">尚未建立 Google Sheets 結構時，複製 Apps Script 至試算表執行 <code>buildAppSheetDatabase</code>。</p>
        <button class="btn btn-outline btn-full" id="btn-copy-script">複製 Apps Script 程式碼</button>
      </div>

      <div class="section-label">帳號</div>
      <div class="card settings-card">
        <button class="btn btn-danger btn-full" id="btn-signout">登出</button>
      </div>

      <div style="height:24px"></div>
    </div>`;
  }

  // ── Account management ───────────────────────────────────────────────────
  async function loadAccountSection() {
    const el = Utils.el('acct-mgmt-section');
    try {
      await Store.load();
      const raw = Store.get().accounts;
      const isEmpty = CFG.ROLES.every(r => !(raw[r] || []).length);

      _acctState = {};
      CFG.ROLES.forEach(r => {
        _acctState[r] = (raw[r] || []).map(a => ({
          ...a,
          type:        a.type || '',
          billingDate: a.billingDate || 0,
          dueDate:     a.dueDate || 0,
          _deleted: false, _new: false
        }));
      });

      if (isEmpty) {
        el.innerHTML = `<div class="card settings-card" style="text-align:center;padding:20px">
          <p style="color:var(--text-muted);margin-bottom:12px">尚未設定帳戶，請先初始化預設帳戶</p>
          <button class="btn btn-primary" id="btn-init-accounts">載入預設帳戶</button>
        </div>`;
        Utils.el('btn-init-accounts').addEventListener('click', initDefaultAccounts);
      } else {
        renderAccountMgmt();
      }
    } catch (e) {
      Utils.el('acct-mgmt-section').innerHTML = `<p class="error-msg">${e.message}</p>`;
    }
  }

  function renderAccountMgmt() {
    const el = Utils.el('acct-mgmt-section');
    el.innerHTML = CFG.ROLES.map(role => `
      <div class="card settings-card acct-role-card" style="margin-bottom:12px">
        <div class="acct-role-header">
          <span class="balance-role-badge">${role}</span>
          <button class="btn btn-outline btn-sm btn-add-acct" data-role="${role}">＋ 新增</button>
        </div>
        <div id="acct-list-${role}">${renderRoleList(role)}</div>
      </div>
    `).join('') +
    `<button class="btn btn-primary btn-full" id="btn-save-accounts">儲存帳戶設定</button>
     <div style="height:8px"></div>`;

    CFG.ROLES.forEach(role => {
      Utils.el(`acct-mgmt-section`).querySelector(`.btn-add-acct[data-role="${role}"]`)
        .addEventListener('click', () => showAddModal(role));
    });
    Utils.el('btn-save-accounts').addEventListener('click', saveAccounts);
    attachListListeners();
  }

  function renderRoleList(role) {
    const visible = _acctState[role].map((a, i) => ({ ...a, _i: i })).filter(a => !a._deleted);
    if (!visible.length) return `<p class="empty-hint" style="padding:10px 0">尚無帳戶</p>`;

    return visible.map(a => {
      const typeClass = a.type === '現金' ? 'cash' : a.type === '信用卡' ? 'cc' : 'bank';
      return `
      <div class="acct-item">
        <div class="acct-item-top">
          <span class="acct-item-name">${a.name}</span>
          ${a.purpose ? `<span class="acct-item-purpose">${a.purpose}</span>` : ''}
          <button class="btn btn-danger btn-sm acct-del-btn" data-role="${role}" data-i="${a._i}" style="margin-left:auto">✕</button>
        </div>
        <div class="acct-type-toggle acct-inline-type" style="margin:4px 0 6px">
          <button type="button" class="proj-type-btn acct-type-pick${a.type==='現金'?' active':''}" data-role="${role}" data-i="${a._i}" data-t="現金">💵 現金</button>
          <button type="button" class="proj-type-btn acct-type-pick${(!a.type||a.type==='活存帳戶')?' active':''}" data-role="${role}" data-i="${a._i}" data-t="活存帳戶">🏦 活存帳戶</button>
          <button type="button" class="proj-type-btn acct-type-pick${a.type==='信用卡'?' active':''}" data-role="${role}" data-i="${a._i}" data-t="信用卡">💳 信用卡</button>
        </div>
        <div class="acct-item-inputs">
          <input type="number" class="form-input inp-acct-balance" data-role="${role}" data-i="${a._i}"
                 value="${a.balance || ''}" placeholder="期初餘額">
          <input type="date" class="form-input inp-acct-date" data-role="${role}" data-i="${a._i}"
                 value="${a.baseDate ? a.baseDate.replace(/\//g, '-') : ''}">
        </div>
      </div>`;
    }).join('');
  }

  function attachListListeners() {
    document.querySelectorAll('.acct-del-btn').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const { role, i } = fresh.dataset;
        _acctState[role][parseInt(i)]._deleted = true;
        Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
        attachListListeners();
      });
    });
    document.querySelectorAll('.acct-type-pick').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const { role, i, t } = fresh.dataset;
        _acctState[role][parseInt(i)].type = t;
        Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
        attachListListeners();
      });
    });
  }

  function showAddModal(role) {
    const today = new Date().toISOString().slice(0, 10);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
    <div class="modal-title">新增帳戶（${role}）</div>
    <div class="form-row">
      <label>帳戶類型 *</label>
      <div class="acct-type-toggle">
        <button type="button" class="proj-type-btn" id="atype-cash">現金</button>
        <button type="button" class="proj-type-btn active" id="atype-bank">活存帳戶</button>
        <button type="button" class="proj-type-btn" id="atype-cc">信用卡</button>
      </div>
    </div>
    <div class="form-row">
      <label>帳戶名稱 *</label>
      <input type="text" id="inp-new-name" class="form-input" placeholder="例：永豐數位帳戶">
    </div>
    <div class="form-row">
      <label>主要用途</label>
      <input type="text" id="inp-new-purpose" class="form-input" placeholder="選填，例：日常消費">
    </div>
    <div class="form-row">
      <label>期初餘額</label>
      <input type="number" id="inp-new-balance" class="form-input" placeholder="0" value="0">
    </div>
    <div class="form-row">
      <label>基準日期</label>
      <input type="date" id="inp-new-date" class="form-input" value="${today}">
    </div>
    <div id="cc-acct-fields" style="display:none">
      <div class="form-row">
        <label>帳單結帳日（每月幾號）</label>
        <input type="number" id="inp-new-billing" class="form-input" placeholder="例：15" min="1" max="31">
      </div>
      <div class="form-row">
        <label>繳費截止日（每月幾號）</label>
        <input type="number" id="inp-new-dueday" class="form-input" placeholder="例：25" min="1" max="31">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" id="btn-confirm-add">新增</button>
      <button class="btn btn-outline btn-sm" id="btn-cancel-add">取消</button>
    </div>
  </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    Utils.el('btn-cancel-add').addEventListener('click', () => modal.remove());

    function getType() {
      if (Utils.el('atype-cash').classList.contains('active')) return '現金';
      if (Utils.el('atype-cc').classList.contains('active')) return '信用卡';
      return '活存帳戶';
    }

    ['cash','bank','cc'].forEach(t => {
      Utils.el(`atype-${t}`).addEventListener('click', () => {
        ['cash','bank','cc'].forEach(x => Utils.el(`atype-${x}`).classList.remove('active'));
        Utils.el(`atype-${t}`).classList.add('active');
        Utils.el('cc-acct-fields').style.display = t === 'cc' ? 'block' : 'none';
      });
    });

    Utils.el('btn-confirm-add').addEventListener('click', () => {
      const name = Utils.el('inp-new-name').value.trim();
      if (!name) return Utils.toast('請輸入帳戶名稱', 'warn');
      const type = getType();
      const billingDate = type === '信用卡' ? parseInt(Utils.el('inp-new-billing').value) || 0 : 0;
      const dueDate     = type === '信用卡' ? parseInt(Utils.el('inp-new-dueday').value) || 0 : 0;
      _acctState[role].push({
        name,
        purpose:     Utils.el('inp-new-purpose').value.trim(),
        balance:     parseFloat(Utils.el('inp-new-balance').value) || 0,
        baseDate:    Utils.el('inp-new-date').value.replace(/-/g, '/'),
        type,
        billingDate,
        dueDate,
        _deleted: false,
        _new: true
      });
      Utils.el(`acct-list-${role}`).innerHTML = renderRoleList(role);
      attachListListeners();
      modal.remove();
    });
  }

  function readInputsIntoState() {
    document.querySelectorAll('.inp-acct-balance').forEach(inp => {
      const { role, i } = inp.dataset;
      _acctState[role][parseInt(i)].balance = parseFloat(inp.value) || 0;
    });
    document.querySelectorAll('.inp-acct-date').forEach(inp => {
      const { role, i } = inp.dataset;
      _acctState[role][parseInt(i)].baseDate = inp.value.replace(/-/g, '/');
    });
  }

  async function saveAccounts() {
    readInputsIntoState();

    const rows = [];
    CFG.ROLES.forEach(role => {
      _acctState[role].filter(a => !a._deleted).forEach(a => {
        rows.push([role, a.name, a.balance||0, a.baseDate||'', a.purpose||'', a.type||'', a.billingDate||'', a.dueDate||'']);
      });
    });

    // Pad to 100 rows to overwrite any old data
    const padded = [...rows];
    while (padded.length < 100) padded.push(['','','','','','','','']);

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    Utils.showLoading(true);
    try {
      await API.updateRange(sid, 'Backend!L1:S1',
        [['角色','帳戶名稱','期初餘額','基準日期','主要用途','帳戶類型','帳單日','截止日']]);
      await API.updateRange(sid, 'Backend!L2:S101', padded);
      Store.invalidate();
      Utils.toast('帳戶設定已儲存', 'success');
    } catch (e) {
      Utils.toast('儲存失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  async function initDefaultAccounts() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    CFG.ROLES.forEach(r => { _acctState[r] = []; });
    function guessType(name) {
      if (/信用卡/.test(name)) return '信用卡';
      if (/現金|錢包/.test(name)) return '現金';
      return '活存帳戶';
    }
    CFG.INITIAL_ACCOUNTS.forEach(a => {
      _acctState[a.role].push({ ...a, balance: 0, baseDate: today, type: guessType(a.name), billingDate: 0, dueDate: 0, _deleted: false, _new: true });
    });
    await saveAccounts();
    Store.invalidate();
    await Store.load(true);
    renderAccountMgmt();
  }

  // ── Apps Script ──────────────────────────────────────────────────────────
  const APPS_SCRIPT = `function buildAppSheetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Projects
  var ps = ss.getSheetByName('Projects') || ss.insertSheet('Projects');
  ps.clear();
  ps.getRange('A1:H1').setValues([['狀態','專案名稱','目標預算','已花費金額','預算剩餘額度','已提撥準備金','資金缺口警示','預算消耗圖']]).setFontWeight('bold');
  var pf = [];
  for (var i = 2; i <= 51; i++) {
    pf.push([
      '=IF(B'+i+'="","",SUMIFS(Ledger!I:I,Ledger!D:D,B'+i+',Ledger!E:E,"支出"))',
      '=IF(B'+i+'="","",C'+i+'-D'+i+')',
      '=IF(B'+i+'="","",SUMIFS(Ledger!I:I,Ledger!D:D,B'+i+',Ledger!E:E,"公積金提撥",Ledger!F:F,"專案預備金"))',
      '=IF(B'+i+'="","",IF(D'+i+'>F'+i+',D'+i+'-F'+i+',0))',
      '=IF(OR(B'+i+'="",C'+i+'=0),"",SPARKLINE(D'+i+',{"charttype","bar";"max",C'+i+';"color1",IF(D'+i+'>C'+i+',"red","green")}))'
    ]);
  }
  ps.getRange(2,4,pf.length,5).setFormulas(pf);
  ps.getRange('A2:C4').setValues([['進行中','[家] 範例專案',500000],['進行中','[熊] 範例保養',15000],['已結案','[家] 舊專案',100000]]);

  // Backend
  var bs = ss.getSheetByName('Backend') || ss.insertSheet('Backend');
  bs.clear();
  bs.getRange('A1:C1').setValues([['阿熊帳戶','綺綺帳戶','家用帳戶']]).setFontWeight('bold');
  bs.getRange('A2:A8').setValues([['中信活存(薪資)'],['新光活存(投資)'],['聯邦活存(日用)'],['Line Pay Money'],['信用卡-玉山Pi'],['現金錢包'],['股票部位']]);
  bs.getRange('B2:B5').setValues([['台新Richart'],['信用卡-台新GoGo'],['現金錢包'],['股票部位']]);
  bs.getRange('C2:C4').setValues([['一銀活存'],['土銀活存'],['現金錢包']]);
  bs.getRange('E1:H1').setValues([['支出分類','收入分類','轉帳分類','提撥分類']]).setFontWeight('bold');
  bs.getRange('E2:E15').setValues([['食物'],['飲料'],['交通'],['購物'],['娛樂'],['家用'],['電信'],['醫藥'],['教育'],['醫療保險'],['投資儲蓄'],['旅遊'],['訂閱'],['信用卡費']]);
  bs.getRange('F2:F5').setValues([['薪資收入'],['利息/股息'],['業外收入'],['現金回饋']]);
  bs.getRange('G2:G3').setValues([['ATM領現'],['轉帳']]);
  bs.getRange('H2:H3').setValues([['常態家用'],['專案預備金']]);
  // Account config (L:P)
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  bs.getRange('L1:P1').setValues([['角色','帳戶名稱','期初餘額','基準日期','主要用途']]).setFontWeight('bold');
  var accts = [
    ['阿熊','中信活存(薪資)',0,today,'薪資入帳'],
    ['阿熊','新光活存(投資)',0,today,'投資'],
    ['阿熊','聯邦活存(日用)',0,today,'日常消費'],
    ['阿熊','Line Pay Money',0,today,'行動支付'],
    ['阿熊','信用卡-玉山Pi',0,today,''],
    ['阿熊','現金錢包',0,today,''],
    ['阿熊','股票部位',0,today,'投資'],
    ['綺綺','台新Richart',0,today,''],
    ['綺綺','信用卡-台新GoGo',0,today,''],
    ['綺綺','現金錢包',0,today,''],
    ['綺綺','股票部位',0,today,'投資'],
    ['家用','一銀活存',0,today,'家用主帳戶'],
    ['家用','土銀活存',0,today,''],
    ['家用','現金錢包',0,today,'']
  ];
  bs.getRange(2, 12, accts.length, 5).setValues(accts);

  // Investments
  var inv = ss.getSheetByName('Investments') || ss.insertSheet('Investments');
  inv.clear();
  inv.getRange('A1:K1').setValues([['角色歸屬','帳戶','標的代號','標的名稱','持有股數','持有均價','總成本','即時現價','總市值','未實現損益','報酬率']]).setFontWeight('bold');
  var ivf = [];
  for (var j = 2; j <= 51; j++) {
    ivf.push([
      '=IF(C'+j+'="","",E'+j+'*F'+j+')',
      '=IF(C'+j+'="","",GOOGLEFINANCE(C'+j+',"price"))',
      '=IF(C'+j+'="","",E'+j+'*H'+j+')',
      '=IF(C'+j+'="","",I'+j+'-G'+j+')',
      '=IF(OR(C'+j+'="",G'+j+'=0),"",J'+j+'/G'+j+')'
    ]);
  }
  inv.getRange(2,7,ivf.length,5).setFormulas(ivf);
  inv.getRange('K2:K51').setNumberFormat('0.00%');

  // Ledger
  var ld = ss.getSheetByName('Ledger') || ss.insertSheet('Ledger');
  ld.clear();
  ld.getRange('A1:L1').setValues([['記帳 ID','角色 (出)','開銷維度','專案標籤','類型','主分類','項目/明細','日期','金額','付款帳戶','角色 (入)','對象帳戶']]).setFontWeight('bold');

  SpreadsheetApp.getUi().alert('建置完成！');
}`;

  // ── onMount ──────────────────────────────────────────────────────────────
  function onMount() {
    Utils.el('btn-save-conn').addEventListener('click', () => {
      const cid = Utils.el('inp-client-id').value.trim();
      const sid = Utils.el('inp-sheet-id').value.trim();
      if (!cid || !sid) return Utils.toast('請填寫完整設定', 'warn');
      localStorage.setItem(CFG.LS_KEYS.CLIENT_ID, cid);
      localStorage.setItem(CFG.LS_KEYS.SHEET_ID, sid);
      Store.invalidate();
      Utils.toast('已儲存，請重新整理頁面', 'success');
    });

    Utils.el('btn-copy-script').addEventListener('click', () => {
      navigator.clipboard.writeText(APPS_SCRIPT).then(() => Utils.toast('已複製！', 'success'));
    });

    Utils.el('btn-signout').addEventListener('click', () => {
      Auth.signOut();
      localStorage.removeItem(CFG.LS_KEYS.CACHE_DATA);
      localStorage.removeItem(CFG.LS_KEYS.CACHE_TS);
      location.reload();
    });

    loadAccountSection();
  }

  return { render, onMount };
})());
