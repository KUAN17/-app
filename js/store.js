window.Store = (() => {
  // 本機快取資料結構版本：改動解析邏輯時 +1，自動讓舊快取失效並重抓
  const SCHEMA_V = 6;

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
    members: [],        // [{ name, type: 'personal'|'shared' }]，空時退回 CFG.ROLES 預設
    reminders: [],       // 定期付款提醒
    categories: {},     // overrides from Backend
    activeProjects: []  // names only
  };

  // 預設成員：沿用 CFG.ROLES，「家用」視為共享角色（舊資料自動遷移）
  function defaultMembers() {
    return CFG.ROLES.map(r => ({ name: r, type: r === '家用' ? 'shared' : 'personal' }));
  }
  let _sheetMeta = [];
  let _dirty = true;

  // 文字欄位強制轉字串：Sheets（UNFORMATTED_VALUE）會把純數字內容回傳為 number，
  // 例如備忘「799」→ 799，下游 .trim()/.replace() 會直接 TypeError
  function txt(v) { return v === null || v === undefined ? '' : String(v); }

  // ── Ledger row → object ──────────────────────────────────────────────────
  function parseLedgerRow(row, idx) {
    return {
      _row: idx + 2, // 1-indexed, header is row 1
      id: txt(row[0]),
      roleOut: txt(row[1]),
      dimension: txt(row[2]),
      projectTag: txt(row[3]),
      type: txt(row[4]),
      category: txt(row[5]),
      memo: txt(row[6]),
      date: normDate(row[7]),
      amount: Utils.parseAmount(row[8]),
      accountOut: txt(row[9]),
      roleIn: txt(row[10]),
      accountIn: txt(row[11]),
      payRole: txt(row[12]),
      payAccount: txt(row[13]),
      settleId: txt(row[14]) // 代付補款轉帳結清的支出 ID（逐筆綁定）
    };
  }

  // ── Projects row → object ────────────────────────────────────────────────
  function parseProjectRow(row, idx) {
    return {
      _row: idx + 2,
      status: txt(row[0]),
      name:   txt(row[1]),
      budget: Utils.parseAmount(row[2]),
      spent: 0, remaining: 0, allocated: 0, gap: 0, // recalculated from ledger
      // Loan plan fields — columns I-L (indices 8-11)
      monthlyPayment: Utils.parseAmount(row[8]),
      annualRate:     parseFloat(row[9]) || 0,
      loanStartDate:  txt(row[10]),
      totalPeriods:   parseInt(row[11]) || 0,
      // Project owner config — columns M-N (indices 12-13)
      ownerRole:      txt(row[12]),
      defaultAccount: txt(row[13])
    };
  }

  // ── Investments row → object ─────────────────────────────────────────────
  function parseInvestRow(row, idx) {
    const shares  = Utils.parseAmount(row[4]);
    const avgCost = Utils.parseAmount(row[5]);
    const price   = Utils.parseAmount(row[7]);
    // 市值/損益由股數×價格直接計算，不依賴試算表公式欄（I-K），公式失效也不影響顯示
    const totalCost   = shares * avgCost;
    const marketValue = price > 0 ? shares * price : totalCost;
    const unrealized  = marketValue - totalCost;
    return {
      _row:        idx + 2, // 1-indexed，第 1 列為表頭
      role:        txt(row[0]),
      account:     txt(row[1]),
      ticker:      txt(row[2]),
      name:        txt(row[3]),
      shares, avgCost, price, totalCost, marketValue, unrealized,
      returnRate:  totalCost > 0 ? unrealized / totalCost : 0
    };
  }

  // ── Account initial balances from Backend L:U ────────────────────────────
  function parseAccountConfig(rows) {
    const map = {};
    rows.forEach(row => {
      if (!row[0] || !row[1]) return;
      const role = txt(row[0]);
      if (!map[role]) map[role] = [];
      map[role].push({
        name:        txt(row[1]),
        balance:     Utils.parseAmount(row[2]),
        baseDate:    normDate(row[3]),
        purpose:     txt(row[4]),
        type:        txt(row[5]),
        billingDate: parseInt(row[6]) || 0,
        dueDate:     parseInt(row[7]) || 0,
        paymentAccount: txt(row[8]),
        isDefaultCC: row[9] === 'Y' // 該角色記帳時「信用卡」快速鍵自動帶入的卡（一角色限一張）
      });
    });
    return map;
  }

  // ── Reminders row → object（定期付款提醒） ───────────────────────────────
  function parseReminderRow(row, idx) {
    return {
      _row: idx + 2,
      id:            txt(row[0]) || Utils.uid(),
      name:          txt(row[1]),
      role:          txt(row[2]),
      category:      txt(row[3]),
      amount:        Utils.parseAmount(row[4]), // 預設金額，可為 0（表示每次手動輸入）
      account:       txt(row[5]),
      dueDay:        parseInt(row[6]) || 1,
      lastPaidMonth: txt(row[7]), // 'YYYY-MM'，與目前月份比對決定是否已繳
      active:        row[8] !== 'N',
      memo:          txt(row[9])
    };
  }

  // 一次性分類改名遷移：把歷史帳本裡舊分類名稱的列批次改成新名稱，每個瀏覽器只跑一次
  // （用 localStorage flag 擋重複執行；失敗不設 flag，下次 load() 會再試一次）
  async function migrateCategoryRename(sid, oldName, newName) {
    const flag = `ff_cat_migrated_${oldName}_${newName}`;
    if (localStorage.getItem(flag)) return;
    try {
      const targets = _data.ledger.filter(tx => tx.category === oldName);
      if (targets.length) {
        const data = targets.map(tx => ({ range: `Ledger!F${tx._row}`, values: [[newName]] }));
        await API.batchUpdateValues(sid, data);
        targets.forEach(tx => { tx.category = newName; });
      }
      localStorage.setItem(flag, '1');
    } catch (e) { /* 失敗不設 flag，下次 load() 重試 */ }
  }

  // 一次性分類重整：「家用」依備註關鍵字拆成家用用品／家用採購／水電生活／禮物／食物／房貸，
  // 「醫療保險」改名「保險」。跟 migrateCategoryRename 一樣用 localStorage flag 擋重複執行，
  // 失敗不設 flag，下次 load() 會再試一次
  async function migrateCategorySplit(sid) {
    const flag = 'ff_cat_migrated_split_v1';
    if (localStorage.getItem(flag)) return;
    try {
      const MONTHLY_KW  = ['房貸', '新青安'];
      const UTILITY_KW  = ['水電', '電費', '瓦斯', '水費', '寬頻', '網路'];
      const DURABLE_KW  = ['收納', '水槽', '層架', '電鍋', '特力屋', '垃圾桶', '菜刀', '漏勺', '廚房龍頭',
                            '入厝', '枕套', '掃把', '刀具架', '碗盤', 'ikea', 'IKEA', '置物架', '衣架',
                            '電視', '背膠', '砧板', '濾網', '拖鞋'];
      const GIFT_KW     = ['禮物', '生日', '初魚'];
      const FOOD_KW     = ['買菜', '食材', '晚餐', '午餐', '早餐', '蛋', '芭蕉', '烤肉', '拜拜買米', '家用和食物', '拜拜'];

      function reclassifyHome(memo) {
        const m = memo || '';
        if (MONTHLY_KW.some(k => m.includes(k))) return '房貸';
        if (UTILITY_KW.some(k => m.includes(k))) return '水電生活';
        if (DURABLE_KW.some(k => m.includes(k))) return '家用採購';
        if (GIFT_KW.some(k => m.includes(k))) return '禮物';
        if (FOOD_KW.some(k => m.includes(k))) return '食物';
        return '家用用品';
      }

      const data = [];
      _data.ledger.forEach(tx => {
        if (tx.category === '家用') {
          const newCat = reclassifyHome(tx.memo);
          data.push({ range: `Ledger!F${tx._row}`, values: [[newCat]] });
          tx.category = newCat;
        } else if (tx.category === '醫療保險') {
          data.push({ range: `Ledger!F${tx._row}`, values: [['保險']] });
          tx.category = '保險';
        }
      });
      if (data.length) await API.batchUpdateValues(sid, data);
      localStorage.setItem(flag, '1');
    } catch (e) { /* 失敗不設 flag，下次 load() 重試 */ }
  }

  // 定期提醒的分類也同步重整：房貸/新青安提醒 → 房貸；醫療保險提醒（壽險等）→ 保險
  async function migrateReminderCategorySplit(sid) {
    const flag = 'ff_cat_migrated_reminder_split_v1';
    if (localStorage.getItem(flag)) return;
    try {
      const data = [];
      _data.reminders.forEach(r => {
        if (r.category === '家用' && (r.name.includes('房貸') || r.name.includes('新青安'))) {
          data.push({ range: `Reminders!D${r._row}`, values: [['房貸']] });
          r.category = '房貸';
        } else if (r.category === '醫療保險') {
          data.push({ range: `Reminders!D${r._row}`, values: [['保險']] });
          r.category = '保險';
        }
      });
      if (data.length) await API.batchUpdateValues(sid, data);
      localStorage.setItem(flag, '1');
    } catch (e) { /* 失敗不設 flag，下次 load() 重試 */ }
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
        'Backend!L2:U',
        'Backend!V2:W'
      ];
      const [ledgerRows, projRows, invRows, acctRows, memberRows] = await API.batchGet(sid, ranges);

      _data.ledger = ledgerRows.filter(r => r[0]).map(parseLedgerRow);
      await migrateCategoryRename(sid, '電信', '水電生活');
      await migrateCategorySplit(sid);
      _data.projects = projRows.filter(r => r[1]).map((row, idx) => parseProjectRow(row, idx));
      _data.investments = invRows.filter(r => r[2]).map((row, idx) => parseInvestRow(row, idx));
      _data.accounts = parseAccountConfig(acctRows);
      _data.members = (memberRows || [])
        .filter(r => r[0])
        .map(r => ({ name: String(r[0]), type: r[1] === '共享' ? 'shared' : 'personal' }));
      if (!_data.members.length) _data.members = defaultMembers();
      _data.activeProjects = _data.projects.filter(p => p.status === '進行中').map(p => p.name);

      // 定期提醒：獨立讀取（非主 batchGet），工作表不存在時自動建立，不中斷主要載入
      try {
        const remRows = await API.getRange(sid, 'Reminders!A2:J');
        _data.reminders = remRows.filter(r => r[0]).map((row, idx) => parseReminderRow(row, idx));
        await migrateReminderCategorySplit(sid);
      } catch (e) {
        if ((e.message || '').toLowerCase().includes('unable to parse range')) {
          await ensureRemindersSheet(sid);
          _data.reminders = [];
        } else {
          _data.reminders = _data.reminders || []; // 暫時性錯誤，保留舊值
        }
      }

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
  // 信用卡不追蹤餘額：純粹是記帳時「這筆是刷卡付的」標籤，不是有餘額的帳戶
  // （帳單金額由使用者自己透過定期提醒每期手動輸入，從銀行帳戶直接扣）
  function calcBalance(role, accountName) {
    const cfg = (_data.accounts[role] || []).find(a => a.name === accountName);
    if (cfg && cfg.type === '信用卡') return 0;
    const baseDate = cfg ? cfg.baseDate : '';
    const normBase = baseDate ? baseDate.replace(/-/g, '/') : '';
    let balance = cfg ? cfg.balance : 0;
    _data.ledger.forEach(tx => {
      if (normBase && tx.date < normBase) return;
      if (tx.type === '收入' && tx.roleOut === role && tx.accountOut === accountName) {
        balance += tx.amount;
      } else if (tx.type === '支出') {
        if (tx.payAccount) {
          // 代付：實際從 payAccount 扣款，accountOut 為費用歸屬（待補款轉帳時才扣）
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
        if (a.type === '信用卡') return; // 信用卡不追蹤餘額（同 calcBalance）
        map[`${role}||${a.name}`] = { bal: a.balance, base: (a.baseDate || '').replace(/-/g, '/') };
      });
    });
    function apply(role, name, date, amt) {
      const e = map[`${role}||${name}`];
      if (!e) return; // 信用卡／已刪除帳戶都不在 map 裡，直接略過
      if (e.base && date < e.base) return;
      e.bal += amt;
    }
    _data.ledger.forEach(tx => {
      if (tx.type === '收入') {
        apply(tx.roleOut, tx.accountOut, tx.date, tx.amount);
      } else if (tx.type === '支出') {
        if (tx.payAccount) {
          if (tx.payRole) {
            apply(tx.payRole, tx.payAccount, tx.date, -tx.amount);
          } else {
            // 舊資料無 payRole：所有同名帳戶都扣（與 calcBalance 退回邏輯一致）
            Object.keys(map).forEach(k => {
              if (k.split('||')[1] === tx.payAccount) apply(...k.split('||'), tx.date, -tx.amount);
            });
          }
        } else {
          apply(tx.roleOut, tx.accountOut, tx.date, -tx.amount);
        }
      } else if (tx.type === '轉帳' || tx.type === '公積金提撥') {
        apply(tx.roleOut, tx.accountOut, tx.date, -tx.amount);
        apply(tx.roleIn, tx.accountIn, tx.date, tx.amount);
      }
    });
    const res = {};
    Object.entries(map).forEach(([k, e]) => {
      const [role, name] = k.split('||');
      (res[role] = res[role] || {})[name] = e.bal;
    });
    return res;
  }

  // ── 成員（角色）───────────────────────────────────────────────────────────
  function members() {
    return _data.members.length ? _data.members : defaultMembers();
  }
  function roleNames()         { return members().map(m => m.name); }
  function personalRoleNames() { return members().filter(m => m.type !== 'shared').map(m => m.name); }
  function sharedRoleNames()   { return members().filter(m => m.type === 'shared').map(m => m.name); }
  function isShared(name)      { return members().some(m => m.name === name && m.type === 'shared'); }

  async function saveMembers(list) {
    if (list.length > 20) throw new Error('成員數量上限為 20 人');
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const rows = list.map(m => [m.name, m.type === 'shared' ? '共享' : '個人']);
    while (rows.length < 20) rows.push(['', '']); // 覆蓋舊資料
    await API.updateRange(sid, 'Backend!V1:W1', [['成員', '類型']]);
    await API.updateRange(sid, 'Backend!V2:W21', rows);
    _data.members = [...list];
  }

  function accountsForRole(role) {
    return (_data.accounts[role] || []).map(a => a.name);
  }

  function brokersForRole(role) {
    return (_data.accounts[role] || []).filter(a => a.type === '證券帳戶').map(a => a.name);
  }

  // 該角色記帳用「信用卡」快速鍵對應的帳戶名：優先設定頁勾選的預設卡，否則退回第一張信用卡
  function defaultCCFor(role) {
    const ccs = (_data.accounts[role] || []).filter(a => a.type === '信用卡');
    return (ccs.find(a => a.isDefaultCC) || ccs[0] || {}).name || '';
  }
  // 該角色記帳用「現金」快速鍵對應的帳戶名：第一個現金類型帳戶
  function defaultCashFor(role) {
    return ((_data.accounts[role] || []).find(a => a.type === '現金') || {}).name || '';
  }

  function allAccountsFlat() {
    const result = [];
    roleNames().forEach(role => {
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

  // 寫入前驗證：確認各列的 A 欄 id 仍與快取一致（多裝置並發時他人刪列會使列位移，
  // 直接寫會損毀別筆資料）。pairs = [{ row, id }]，全部相符回 true。
  async function verifyLedgerRows(pairs) {
    if (!pairs.length) return true;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    const ranges = pairs.map(p => `Ledger!A${p.row}`);
    const results = await API.batchGet(sid, ranges);
    return pairs.every((p, i) => ((results[i] || [])[0] || [])[0] === p.id);
  }

  // 快取路徑下 load() 不會抓 sheet meta；刪除列等操作前先確保已載入
  async function ensureSheetMeta() {
    if (_sheetMeta.length) return;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    if (sid) _sheetMeta = await API.getSheetMeta(sid);
  }

  // ── 定期付款提醒 ───────────────────────────────────────────────────────────
  async function ensureRemindersSheet(sid) {
    if (!_sheetMeta.length) _sheetMeta = await API.getSheetMeta(sid);
    if (_sheetMeta.find(m => m.name === 'Reminders')) return;
    await API.batchUpdate(sid, [{ addSheet: { properties: { title: 'Reminders' } } }]);
    await API.updateRange(sid, 'Reminders!A1:J1',
      [['ID', '名稱', '角色', '分類', '預設金額', '扣款帳戶', '提醒日', '最後完成月份', '啟用', '備忘']]);
    _sheetMeta = await API.getSheetMeta(sid);
  }

  // 全量覆寫（與 saveMembers/saveAccounts 同模式），pad 空列蓋掉刪除的舊資料
  async function saveReminders(list) {
    if (list.length > 50) throw new Error('定期提醒上限為 50 筆');
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    await ensureRemindersSheet(sid);
    const rows = list.map(r => [
      r.id || Utils.uid(), r.name, r.role, r.category || '', r.amount || 0,
      r.account, r.dueDay || 1, r.lastPaidMonth || '', r.active === false ? 'N' : 'Y', r.memo || ''
    ]);
    const padded = [...rows];
    while (padded.length < 50) padded.push(['', '', '', '', '', '', '', '', '', '']);
    await API.updateRange(sid, `Reminders!A2:J${1 + padded.length}`, padded);
    _data.reminders = rows.map((row, idx) => parseReminderRow(row, idx));
  }

  // 記帳成功後標記該提醒本月已完成，避免月內重複提醒；下月份自動因月份不同而重新出現
  async function markReminderPaid(reminderId, yyyymm) {
    const r = _data.reminders.find(x => x.id === reminderId);
    if (!r) return;
    const sid = localStorage.getItem(CFG.LS_KEYS.SHEET_ID) || CFG.SHEET_ID;
    await API.updateRange(sid, `Reminders!H${r._row}`, [[yyyymm]]);
    r.lastPaidMonth = yyyymm;
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
    const identity = hit && roleNames().includes(hit[1]) ? hit[1] : null;
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

  // ── 代付往來 ──────────────────────────────────────────────────────────────
  // 補款實際要轉入的對象：代付帳戶是信用卡 → 轉進該卡綁定的扣款帳戶（持卡人才還得了卡費）；
  // 銀行／現金帳戶 → 直接轉回代付帳戶本身（補款不一定要走正式轉帳，現金收付也算）；
  // 信用卡沒綁扣款帳戶 → 回傳空帳戶，交由畫面開放使用者手動選擇（必填，不自動猜）。
  // dashboard/repay 頁共用同一套判斷
  function repayTarget(creditorRole, payAccountName) {
    const all = allAccountsFlat();
    const acct = all.find(a => a.role === creditorRole && a.name === payAccountName);
    if (acct && (acct.type === '銀行' || acct.type === '現金')) return { role: creditorRole, account: payAccountName };
    if (acct && acct.type === '信用卡' && acct.paymentAccount) {
      const owner = all.find(a => a.name === acct.paymentAccount);
      return { role: owner?.role || creditorRole, account: acct.paymentAccount };
    }
    return { role: creditorRole, account: '' };
  }

  // 未結清代付清單：逐筆列出，代付補款轉帳依「債務人→債權人」FIFO（先借先還）沖銷
  function computePayables(ledger) {
    const expById = {};    // 支出 ID → 該筆代付支出
    const expByPair = {};  // `creditor||debtor` → [代付支出…]
    const linkedRepay = {}; // 支出 ID → 已綁定補款總額（精準逐筆）
    const poolByPair = {};  // `creditor||debtor` → 未綁定補款總額（FIFO 後備）
    ledger.forEach(tx => {
      if (tx.type === '支出' && tx.payRole && tx.payRole !== tx.roleOut && tx.amount > 0) {
        const e = {
          id: tx.id, creditor: tx.payRole, debtor: tx.roleOut, payAccount: tx.payAccount || '',
          date: tx.date, amount: tx.amount, memo: tx.memo || tx.category || '', remaining: tx.amount
        };
        expById[tx.id] = e;
        const k = `${tx.payRole}||${tx.roleOut}`;
        (expByPair[k] = expByPair[k] || []).push(e);
      }
      if (tx.type === '轉帳' && tx.category === CFG.CAT_REPAYMENT && tx.amount > 0) {
        if (tx.settleId) {
          linkedRepay[tx.settleId] = (linkedRepay[tx.settleId] || 0) + tx.amount;
        } else {
          const k = `${tx.roleIn}||${tx.roleOut}`;
          poolByPair[k] = (poolByPair[k] || 0) + tx.amount;
        }
      }
    });

    // 1. 先扣有綁定的補款（點「記補款」記入的，精準對應該筆支出）
    Object.entries(linkedRepay).forEach(([id, paid]) => {
      if (expById[id]) expById[id].remaining = Math.max(0, expById[id].remaining - paid);
    });
    // 2. 未綁定的補款（舊資料／手動轉帳）→ 同組 FIFO 沖最舊
    Object.entries(expByPair).forEach(([k, exps]) => {
      let pool = poolByPair[k] || 0;
      if (!pool) return;
      exps.sort((a, b) => a.date.localeCompare(b.date));
      exps.forEach(e => {
        const cut = Math.min(pool, e.remaining);
        e.remaining -= cut; pool -= cut;
      });
    });

    const items = Object.values(expById).filter(e => e.remaining >= 1);
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  }

  // 抽屜選單紅點：有沒有任何未結代付（不需要完整分組，只看有沒有）
  function hasPendingRepay() {
    return computePayables(_data.ledger).length > 0;
  }

  return { load, invalidate, calcBalance, calcAllBalances, accountsForRole, brokersForRole, defaultCCFor, defaultCashFor, allAccountsFlat, getSheetId, ensureSheetMeta, verifyLedgerRows, get, isDirty, loadIdentity, saveIdentity,
           members, roleNames, personalRoleNames, sharedRoleNames, isShared, saveMembers, saveReminders, markReminderPaid,
           computePayables, repayTarget, hasPendingRepay };
})();
