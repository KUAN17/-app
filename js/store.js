window.Store = (() => {
  // 本機快取資料結構版本：改動解析邏輯時 +1，自動讓舊快取失效並重抓
  const SCHEMA_V = 2;

  // 統一日期格式為 YYYY/MM/DD，相容多種來源格式以避免字串比較失敗：
  //  - 試算表序列值（UNFORMATTED_VALUE 下日期欄可能回傳純數字，如 46000）
  //  - 民國/西元 年月日（2026年6月1日）
  //  - 未補零的 2026/6/1、2026-6-1
  function normDate(d) {
    if (d === '' || d === null || d === undefined) return '';
    const str = String(d).trim();
    // 純數字 → Google Sheets 日期序列值（基準 1899/12/30）
    if (/^\d+(\.\d+)?$/.test(str)) {
      const serial = Math.floor(Number(str));
      if (serial > 20000 && serial < 80000) { // 約 1954–2119，排除一般數字
        const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${String(dt.getUTCDate()).padStart(2, '0')}`;
      }
    }
    const parts = str.replace(/[-年月]/g, '/').replace(/日/g, '').split('/').filter(Boolean);
    if (parts.length !== 3) return str;
    return `${parts[0]}/${String(parts[1]).padStart(2, '0')}/${String(parts[2]).padStart(2, '0')}`;
  }
  let _data = {
    ledger: [],
    projects: [],
    investments: [],
    accounts: {},       // { '阿熊': [{name, balance, baseDate}], ... }
    categories: {},     // overrides from Backend
    activeProjects: []  // names only
  };
  let _sheetMeta = [];
  let _dirty = true;

  // ── Ledger row → object ──────────────────────────────────────────────────
  function parseLedgerRow(row, idx) {
    return {
      _row: idx + 2, // 1-indexed, header is row 1
      id: row[0] || '',
      roleOut: row[1] || '',
      dimension: row[2] || '',
      projectTag: row[3] || '',
      type: row[4] || '',
      category: row[5] || '',
      memo: row[6] || '',
      date: normDate(row[7]),
      amount: Utils.parseAmount(row[8]),
      accountOut: row[9] || '',
      roleIn: row[10] || '',
      accountIn: row[11] || '',
      payRole: row[12] || '',
      payAccount: row[13] || '',
      settleId: row[14] || '' // 代付補款轉帳結清的支出 ID（逐筆綁定）
    };
  }

  // ── Projects row → object ────────────────────────────────────────────────
  function parseProjectRow(row, idx) {
    return {
      _row: idx + 2,
      status: row[0] || '',
      name:   row[1] || '',
      budget: Utils.parseAmount(row[2]),
      spent: 0, remaining: 0, allocated: 0, gap: 0, // recalculated from ledger
      // Loan plan fields — columns I-L (indices 8-11)
      monthlyPayment: Utils.parseAmount(row[8]),
      annualRate:     parseFloat(row[9]) || 0,
      loanStartDate:  row[10] || '',
      totalPeriods:   parseInt(row[11]) || 0,
      // Project owner config — columns M-N (indices 12-13)
      ownerRole:      row[12] || '',
      defaultAccount: row[13] || ''
    };
  }

  // ── Investments row → object ─────────────────────────────────────────────
  function parseInvestRow(row) {
    const shares  = Utils.parseAmount(row[4]);
    const avgCost = Utils.parseAmount(row[5]);
    const price   = Utils.parseAmount(row[7]);
    // 市值/損益由股數×價格直接計算，不依賴試算表公式欄（I-K），公式失效也不影響顯示
    const totalCost   = shares * avgCost;
    const marketValue = price > 0 ? shares * price : totalCost;
    const unrealized  = marketValue - totalCost;
    return {
      role:        row[0] || '',
      account:     row[1] || '',
      ticker:      row[2] || '',
      name:        row[3] || '',
      shares, avgCost, price, totalCost, marketValue, unrealized,
      returnRate:  totalCost > 0 ? unrealized / totalCost : 0
    };
  }

  // ── Account initial balances from Backend L:P ────────────────────────────
  function parseAccountConfig(rows) {
    const map = {};
    rows.forEach(row => {
      if (!row[0] || !row[1]) return;
      const role = row[0];
      if (!map[role]) map[role] = [];
      map[role].push({
        name:        row[1],
        balance:     Utils.parseAmount(row[2]),
        baseDate:    normDate(row[3]),
        purpose:     row[4] || '',
        type:        row[5] || '',
        billingDate: parseInt(row[6]) || 0,
        dueDate:     parseInt(row[7]) || 0,
        paymentAccount: row[8] || ''
      });
    });
    return map;
  }

  async function load(force = false) {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID);
    if (!sid) return;

    if (!force) {
      const ts = parseInt(localStorage.getItem(CFG.LS_KEYS.CACHE_TS) || '0');
      if (Date.now() - ts < CFG.CACHE_TTL) {
        const cached = localStorage.getItem(CFG.LS_KEYS.CACHE_DATA);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            // 僅在結構版本相符時採用快取，否則重抓（讓解析邏輯更新後立即生效）
            if (parsed && parsed.v === SCHEMA_V && parsed.d) {
              _data = parsed.d; _dirty = false; return;
            }
          } catch (e) { /* 損毀的快取 → 直接重抓 */ }
        }
      }
    }

    Utils.showLoading(true);
    try {
      const ranges = [
        'Ledger!A2:O',
        'Projects!A2:N',
        'Investments!A2:K',
        'Backend!L2:T'
      ];
      const [ledgerRows, projRows, invRows, acctRows] = await API.batchGet(sid, ranges);

      _data.ledger = ledgerRows.filter(r => r[0]).map(parseLedgerRow);
      _data.projects = projRows.filter(r => r[1]).map((row, idx) => parseProjectRow(row, idx));
      _data.investments = invRows.filter(r => r[2]).map(parseInvestRow);
      _data.accounts = parseAccountConfig(acctRows);
      _data.activeProjects = _data.projects.filter(p => p.status === '進行中').map(p => p.name);

      // Recalculate project financials from ledger — independent of Sheets formula columns
      _data.projects.forEach(proj => {
        proj.spent = _data.ledger
          .filter(tx => tx.projectTag === proj.name && tx.type === '支出')
          .reduce((s, tx) => s + tx.amount, 0);

        // 已提撥 = 標記此專案的轉帳 + 補款轉帳（settleId 指向此專案支出，相容 dim='日常' 舊資料）
        const projExpenseIds = new Set(
          _data.ledger
            .filter(tx => tx.projectTag === proj.name && tx.type === '支出')
            .map(tx => tx.id)
        );
        proj.allocated = _data.ledger
          .filter(tx =>
            (tx.projectTag === proj.name && tx.type === '公積金提撥') ||
            (tx.projectTag === proj.name && tx.type === '轉帳' && tx.dimension === '專案') ||
            (tx.type === '轉帳' && tx.settleId && projExpenseIds.has(tx.settleId))
          )
          .reduce((s, tx) => s + tx.amount, 0);

        proj.remaining = proj.budget - proj.spent;
        // 缺口：代付支出尚未被補款覆蓋的金額（直接付款不算缺口）
        const advancedSpent = _data.ledger
          .filter(tx => tx.projectTag === proj.name && tx.type === '支出' && tx.payAccount)
          .reduce((s, tx) => s + tx.amount, 0);
        const repaid = _data.ledger
          .filter(tx =>
            tx.type === '轉帳' && tx.settleId && projExpenseIds.has(tx.settleId)
          )
          .reduce((s, tx) => s + tx.amount, 0);
        proj.gap = repaid < advancedSpent ? advancedSpent - repaid : 0;
      });

      _sheetMeta = await API.getSheetMeta(sid);
      _dirty = false;

      localStorage.setItem(CFG.LS_KEYS.CACHE_DATA, JSON.stringify({ v: SCHEMA_V, d: _data }));
      localStorage.setItem(CFG.LS_KEYS.CACHE_TS, String(Date.now()));
    } finally {
      Utils.showLoading(false);
    }
  }

  function invalidate() {
    _dirty = true;
    localStorage.removeItem(CFG.LS_KEYS.CACHE_TS);
  }

  // ── Account balance calculation ──────────────────────────────────────────
  function calcBalance(role, accountName) {
    const cfg = (_data.accounts[role] || []).find(a => a.name === accountName);
    const initial = cfg ? cfg.balance : 0;
    const baseDate = cfg ? cfg.baseDate : '';
    const isCC = !!(cfg && cfg.type === '信用卡');

    const normBase = baseDate ? baseDate.replace(/-/g, '/') : '';
    let balance = initial;
    _data.ledger.forEach(tx => {
      if (normBase && tx.date < normBase) return;
      if (isCC) {
        // 信用卡＝累積消費：只累加刷卡金額，還款/轉入/收入皆不影響
        if (tx.type !== '支出') return;
        if (tx.payAccount) {
          if (tx.payAccount === accountName && (!tx.payRole || tx.payRole === role)) balance += tx.amount;
        } else if (tx.roleOut === role && tx.accountOut === accountName) {
          balance += tx.amount;
        }
        return;
      }
      if (tx.type === '收入' && tx.roleOut === role && tx.accountOut === accountName) {
        balance += tx.amount;
      } else if (tx.type === '支出') {
        if (tx.payAccount) {
          // 代付：實際從 payAccount 扣款，accountOut 為費用歸屬（待帳單轉帳時才扣）
          // payRole 為空的舊資料退回僅比對帳戶名稱
          if (tx.payAccount === accountName && (!tx.payRole || tx.payRole === role)) balance -= tx.amount;
        } else if (tx.roleOut === role && tx.accountOut === accountName) {
          balance -= tx.amount;
        }
      } else if ((tx.type === '轉帳' || tx.type === '公積金提撥')) {
        if (tx.roleOut === role && tx.accountOut === accountName) balance -= tx.amount;
        if (tx.roleIn === role && tx.accountIn === accountName) balance += tx.amount;
      }
    });
    return balance;
  }

  // 單次掃描帳本，一次算出所有帳戶餘額：{ role: { accountName: balance } }
  function calcAllBalances() {
    const map = {};
    Object.entries(_data.accounts).forEach(([role, accts]) => {
      accts.forEach(a => {
        map[`${role}||${a.name}`] = { bal: a.balance, base: (a.baseDate || '').replace(/-/g, '/'), isCC: a.type === '信用卡' };
      });
    });
    // kind: 'charge'=刷卡消費（加進信用卡累積）, 'in'=收入/轉入, 'out'=轉出
    function apply(role, name, date, amt, kind) {
      const e = map[`${role}||${name}`];
      if (!e || (e.base && date < e.base)) return;
      if (e.isCC) {
        // 信用卡＝累積消費：只累加刷卡金額，還款/轉入/收入皆不影響
        if (kind === 'charge') e.bal += -amt; // amt 為負，轉成正的消費額
        return;
      }
      e.bal += amt;
    }
    _data.ledger.forEach(tx => {
      if (tx.type === '收入') {
        apply(tx.roleOut, tx.accountOut, tx.date, tx.amount, 'in');
      } else if (tx.type === '支出') {
        if (tx.payAccount) {
          if (tx.payRole) {
            apply(tx.payRole, tx.payAccount, tx.date, -tx.amount, 'charge');
          } else {
            // 舊資料無 payRole：所有同名帳戶都扣（與 calcBalance 退回邏輯一致）
            Object.keys(map).forEach(k => {
              if (k.split('||')[1] === tx.payAccount) apply(...k.split('||'), tx.date, -tx.amount, 'charge');
            });
          }
        } else {
          apply(tx.roleOut, tx.accountOut, tx.date, -tx.amount, 'charge');
        }
      } else if (tx.type === '轉帳' || tx.type === '公積金提撥') {
        apply(tx.roleOut, tx.accountOut, tx.date, -tx.amount, 'out');
        apply(tx.roleIn, tx.accountIn, tx.date, tx.amount, 'in');
      }
    });
    const res = {};
    Object.entries(map).forEach(([k, e]) => {
      const [role, name] = k.split('||');
      (res[role] = res[role] || {})[name] = e.bal;
    });
    return res;
  }

  function accountsForRole(role) {
    return (_data.accounts[role] || []).map(a => a.name);
  }

  function brokersForRole(role) {
    return (_data.accounts[role] || []).filter(a => a.type === '證券帳戶').map(a => a.name);
  }

  function allAccountsFlat() {
    const result = [];
    CFG.ROLES.forEach(role => {
      (_data.accounts[role] || []).forEach(acct => {
        result.push({ role, ...acct });
      });
    });
    return result;
  }

  function getSheetId(sheetName) {
    const s = _sheetMeta.find(m => m.name === sheetName);
    return s ? s.id : null;
  }

  function get() { return _data; }
  function isDirty() { return _dirty; }

  // ── 使用者身份雲端同步（Settings 工作表：A=Email, B=身份） ────────────────
  async function ensureSettingsSheet(sid) {
    if (!_sheetMeta.length) _sheetMeta = await API.getSheetMeta(sid);
    if (_sheetMeta.find(m => m.name === 'Settings')) return;
    await API.batchUpdate(sid, [{ addSheet: { properties: { title: 'Settings' } } }]);
    await API.updateRange(sid, 'Settings!A1:B1', [['Email', '身份']]);
    _sheetMeta = await API.getSheetMeta(sid);
  }

  // 以登入 Gmail 查雲端身份並同步到本機。回傳 { email, identity }；
  // identity 為 null 代表「成功查詢但雲端無此帳號的設定」（新身份）；網路/API 失敗則 throw
  async function loadIdentity() {
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const email = ((await Auth.getEmail()) || '').toLowerCase();
    if (!sid || !email) return { email, identity: undefined }; // 無法判斷，不視為新身份
    let rows;
    try {
      rows = await API.getRange(sid, 'Settings!A2:B');
    } catch (e) {
      // 只有「工作表不存在」才建表；暫時性錯誤（網路/429/5xx）直接 rethrow，
      // 讓 checkIdentity 的 catch 保留本機既有身份
      if ((e.message || '').toLowerCase().includes('unable to parse range')) {
        await ensureSettingsSheet(sid);
        rows = [];
      } else {
        throw e;
      }
    }
    const hit = rows.find(r => (r[0] || '').toLowerCase() === email);
    const identity = hit && CFG.ROLES.includes(hit[1]) ? hit[1] : null;
    if (identity) localStorage.setItem(CFG.LS_KEYS.IDENTITY, identity);
    return { email, identity };
  }

  // 設定身份：本機立即生效，並寫回雲端（同 email 既有列更新、否則新增）
  async function saveIdentity(identity) {
    localStorage.setItem(CFG.LS_KEYS.IDENTITY, identity);
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const email = ((await Auth.getEmail()) || '').toLowerCase();
    if (!sid || !email) return false;
    await ensureSettingsSheet(sid);
    const rows = await API.getRange(sid, 'Settings!A2:B');
    const idx = rows.findIndex(r => (r[0] || '').toLowerCase() === email);
    if (idx >= 0) await API.updateRange(sid, `Settings!A${idx + 2}:B${idx + 2}`, [[email, identity]]);
    else await API.append(sid, 'Settings!A:B', [email, identity]);
    return true;
  }

  return { load, invalidate, calcBalance, calcAllBalances, accountsForRole, brokersForRole, allAccountsFlat, getSheetId, get, isDirty, loadIdentity, saveIdentity };
})();
