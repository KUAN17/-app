window.Store = (() => {
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
      date: (row[7] || '').replace(/-/g, '/'),
      amount: Utils.parseAmount(row[8]),
      accountOut: row[9] || '',
      roleIn: row[10] || '',
      accountIn: row[11] || '',
      payRole: row[12] || '',
      payAccount: row[13] || ''
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
    return {
      role:        row[0] || '',
      account:     row[1] || '',
      ticker:      row[2] || '',
      name:        row[3] || '',
      shares:      Utils.parseAmount(row[4]),
      avgCost:     Utils.parseAmount(row[5]),
      totalCost:   Utils.parseAmount(row[6]),
      price:       Utils.parseAmount(row[7]),
      marketValue: Utils.parseAmount(row[8]),
      unrealized:  Utils.parseAmount(row[9]),
      returnRate:  parseFloat(row[10]) || 0
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
        baseDate:    row[3] || '',
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
        if (cached) { _data = JSON.parse(cached); _dirty = false; return; }
      }
    }

    Utils.showLoading(true);
    try {
      const ranges = [
        'Ledger!A2:N',
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
        proj.allocated = _data.ledger
          .filter(tx => tx.projectTag === proj.name && (
            tx.type === '公積金提撥' ||
            (tx.type === '轉帳' && tx.dimension === '專案')
          ))
          .reduce((s, tx) => s + tx.amount, 0);
        proj.remaining = proj.budget - proj.spent;
        proj.gap = proj.allocated < proj.spent ? proj.spent - proj.allocated : 0;
      });

      _sheetMeta = await API.getSheetMeta(sid);
      _dirty = false;

      localStorage.setItem(CFG.LS_KEYS.CACHE_DATA, JSON.stringify(_data));
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

    const normBase = baseDate ? baseDate.replace(/-/g, '/') : '';
    let balance = initial;
    _data.ledger.forEach(tx => {
      if (normBase && tx.date.replace(/-/g, '/') < normBase) return;
      if (tx.type === '收入' && tx.roleOut === role && tx.accountOut === accountName) {
        balance += tx.amount;
      } else if (tx.type === '支出') {
        if (tx.payAccount) {
          // 代付：實際從 payAccount 扣款，accountOut 為費用歸屬（待帳單轉帳時才扣）
          if (tx.payAccount === accountName) balance -= tx.amount;
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

  return { load, invalidate, calcBalance, accountsForRole, brokersForRole, allAccountsFlat, getSheetId, get, isDirty };
})();
