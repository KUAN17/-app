Router.register('settings', (() => {
  function render(el) {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || '';
    const cid = localStorage.getItem(CFG.LS_KEYS.CLIENT_ID) || '';

    el.innerHTML = `<div class="page-inner">

      <div class="section-label">Google 連線設定</div>
      <div class="card settings-card">
        <div class="form-row">
          <label>OAuth Client ID</label>
          <input type="text" id="inp-client-id" class="form-input" value="${cid}" placeholder="your-client-id.apps.googleusercontent.com">
          <p class="input-hint">前往 Google Cloud Console → API 和服務 → 憑證 → OAuth 2.0 用戶端 ID</p>
        </div>
        <div class="form-row">
          <label>Spreadsheet ID</label>
          <input type="text" id="inp-sheet-id" class="form-input" value="${sid}" placeholder="從 Google Sheets 網址列複製">
          <p class="input-hint">網址格式：docs.google.com/spreadsheets/d/<strong>這段就是ID</strong>/edit</p>
        </div>
        <button class="btn btn-primary btn-full" id="btn-save-conn">儲存連線設定</button>
      </div>

      <div class="section-label">帳戶期初餘額</div>
      <p class="section-hint">設定各帳戶在某個基準日的實際餘額，系統將從該日期後累計交易計算即時餘額。</p>
      <div id="account-balance-section"><div class="spinner"></div></div>

      <div class="section-label">後端試算表初始化</div>
      <div class="card settings-card">
        <p class="input-hint">尚未建立 Google Sheets 結構時，複製以下 Apps Script 程式碼至試算表的「擴充功能 → Apps Script」並執行 <code>buildAppSheetDatabase</code>。</p>
        <button class="btn btn-outline btn-full" id="btn-copy-script">複製 Apps Script 程式碼</button>
      </div>

      <div class="section-label">帳號</div>
      <div class="card settings-card">
        <button class="btn btn-danger btn-full" id="btn-signout">登出</button>
      </div>

      <div style="height:24px"></div>
    </div>`;
  }

  async function loadBalanceSection() {
    const el = Utils.el('account-balance-section');
    try {
      await Store.load();
      const accountsCfg = Store.get().accounts;

      const rows = CFG.ROLES.flatMap(role => {
        const names = Store.accountsForRole(role);
        return names.map(name => {
          const cfg = (accountsCfg[role] || []).find(a => a.name === name) || {};
          return { role, name, balance: cfg.balance || 0, baseDate: cfg.baseDate || '' };
        });
      });

      el.innerHTML = `<div class="card settings-card">
        ${rows.map((a, i) => `
          <div class="balance-row">
            <div class="balance-row-head">
              <span class="balance-role-badge">${a.role}</span>
              <span class="balance-acct">${a.name}</span>
            </div>
            <div class="balance-row-inputs">
              <input type="number" class="form-input inp-balance" data-i="${i}" placeholder="期初餘額" value="${a.balance || ''}">
              <input type="date" class="form-input inp-basedate" data-i="${i}" value="${a.baseDate ? a.baseDate.replace(/\//g,'-') : ''}">
            </div>
          </div>`).join('')}
        <button class="btn btn-primary btn-full" id="btn-save-balances" style="margin-top:12px">儲存餘額設定</button>
      </div>`;

      Utils.el('btn-save-balances').addEventListener('click', () => saveBalances(rows));
    } catch (e) {
      el.innerHTML = `<p class="error-msg">${e.message}</p>`;
    }
  }

  async function saveBalances(rows) {
    const balanceInputs = document.querySelectorAll('.inp-balance');
    const dateInputs = document.querySelectorAll('.inp-basedate');

    const updated = rows.map((a, i) => ({
      ...a,
      balance: parseFloat(balanceInputs[i].value) || 0,
      baseDate: dateInputs[i].value.replace(/-/g, '/')
    }));

    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    if (!sid) return Utils.toast('請先設定 Spreadsheet ID', 'warn');

    const values = updated.map(a => [a.role, a.name, a.balance, a.baseDate]);
    Utils.showLoading(true);
    try {
      await API.updateRange(sid, `Backend!L2:O${values.length + 1}`, values);
      Store.invalidate();
      Utils.toast('已儲存', 'success');
    } catch (e) {
      Utils.toast('儲存失敗：' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }

  const APPS_SCRIPT = `function buildAppSheetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Projects
  var ps = ss.getSheetByName('Projects') || ss.insertSheet('Projects');
  ps.clear();
  ps.getRange('A1:H1').setValues([['狀態','專案名稱','目標預算','已花費金額','預算剩餘額度','已提撥準備金','資金缺口警示','預算消耗圖']]).setFontWeight('bold');
  ps.getRange('D2').setFormula('=IF(B2="","",SUMIFS(Ledger!I:I,Ledger!D:D,B2,Ledger!E:E,"支出"))');
  ps.getRange('E2').setFormula('=IF(B2="","",C2-D2)');
  ps.getRange('F2').setFormula('=IF(B2="","",SUMIFS(Ledger!I:I,Ledger!D:D,B2,Ledger!E:E,"公積金提撥",Ledger!F:F,"專案預備金"))');
  ps.getRange('G2').setFormula('=IF(B2="","",IF(D2>F2,D2-F2,0))');
  ps.getRange('H2').setFormula('=IF(OR(B2="",C2=0),"",SPARKLINE(D2,{"charttype","bar";"max",C2;"color1",IF(D2>C2,"red","green")}))');
  ps.getRange('D2:H2').copyTo(ps.getRange('D3:H100'),SpreadsheetApp.CopyPasteType.PASTE_FORMULA,false);
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
  bs.getRange('L1:O1').setValues([['角色','帳戶名稱','期初餘額','基準日期']]).setFontWeight('bold');
  // Investments
  var inv = ss.getSheetByName('Investments') || ss.insertSheet('Investments');
  inv.clear();
  inv.getRange('A1:J1').setValues([['角色歸屬','標的代號','標的名稱','持有股數','持有均價','總成本','即時現價','總市值','未實現損益','報酬率']]).setFontWeight('bold');
  inv.getRange('F2').setFormula('=IF(B2="","",D2*E2)');
  inv.getRange('G2').setFormula('=IF(B2="","",GOOGLEFINANCE(B2,"price"))');
  inv.getRange('H2').setFormula('=IF(B2="","",D2*G2)');
  inv.getRange('I2').setFormula('=IF(B2="","",H2-F2)');
  inv.getRange('J2').setFormula('=IF(OR(B2="",F2=0),"",I2/F2)');
  inv.getRange('J2:J100').setNumberFormat('0.00%');
  inv.getRange('F2:J2').copyTo(inv.getRange('F3:J100'),SpreadsheetApp.CopyPasteType.PASTE_FORMULA,false);
  // Ledger
  var ld = ss.getSheetByName('Ledger') || ss.insertSheet('Ledger');
  ld.clear();
  ld.getRange('A1:L1').setValues([['記帳 ID','角色 (出)','開銷維度','專案標籤','類型','主分類','項目/明細','日期','金額','付款帳戶','角色 (入)','對象帳戶']]).setFontWeight('bold');
  SpreadsheetApp.getUi().alert('建置完成！');
}`;

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

    loadBalanceSection();
  }

  return { render, onMount };
})());
