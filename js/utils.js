window.Utils = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },

  formatDate(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return d;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  },

  todayStr() {
    return this.formatDate(new Date());
  },

  formatMoney(n, showSign = false) {
    const num = parseFloat(n) || 0;
    const abs = Math.abs(num).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (showSign) return (num >= 0 ? '+' : '-') + ' $' + abs;
    return '$' + abs;
  },

  formatPct(n) {
    return (parseFloat(n) * 100).toFixed(2) + '%';
  },

  parseAmount(str) {
    return parseFloat(String(str).replace(/[,$]/g, '')) || 0;
  },

  // 防止 Google Sheets（USER_ENTERED）把純數字字串當數字解析而吃掉前導零
  // 例：備忘「00878」會被存成 878；加上 ' 前綴強制視為文字（讀回時前綴不會帶出來）
  sheetText(text) {
    const t = String(text ?? '');
    return /^\d/.test(t) && String(Number(t)) !== t ? `'${t}` : t;
  },

  monthStart(date) {
    const d = date ? new Date(date) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  },

  monthLabel(date) {
    const d = date ? new Date(date) : new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr.replace(/\//g, '-'));
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  },

  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // opts.actionLabel + opts.onAction：顯示動作按鈕（如「復原」），取代 confirm 彈窗的 Undo 模式
  toast(msg, type = 'info', opts = {}) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(this._toastTimer);
    el.textContent = msg;
    if (opts.actionLabel && typeof opts.onAction === 'function') {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', () => {
        clearTimeout(this._toastTimer);
        el.classList.remove('show');
        opts.onAction();
      });
      el.appendChild(btn);
    }
    el.className = `toast toast-${type} show`;
    this._toastTimer = setTimeout(() => el.classList.remove('show'),
      opts.duration || (opts.actionLabel ? 6000 : 2800));
  },

  // 信用卡帳單週期（billing 頁與 dashboard 待辦卡共用）
  billingWindows(today, billingDay, dueDay) {
    const bd = billingDay || 15;
    const dd = dueDay || 25;
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const pastEnd   = d >= bd ? new Date(y, m, bd) : new Date(y, m - 1, bd);
    const pastStart = new Date(new Date(pastEnd.getFullYear(), pastEnd.getMonth() - 1, bd).getTime() + 86400000);
    const pastDue   = new Date(pastEnd.getFullYear(), pastEnd.getMonth() + 1, dd);
    const curStart  = new Date(pastEnd.getTime() + 86400000);
    const curEnd    = new Date(pastEnd.getFullYear(), pastEnd.getMonth() + 1, bd);
    return {
      past:    { start: pastStart, end: pastEnd, due: pastDue },
      current: { start: curStart,  end: curEnd }
    };
  },

  // ── 信用卡帳單引擎 ─────────────────────────────────────────────────────────
  // 把該卡所有刷卡按結帳日切成一期期帳單，繳費依帳單順序 FIFO 沖最舊（不看繳費
  // 日期，回填/逾期繳費都能正確認列），溢繳滾入下一期。
  // 回傳 { bills, unpaidTotal, issuedUnpaid, credit }
  //   bills: [{ start, end, due, dueDate, amount, paid, remain, issued, status, txs }]
  //   unpaidTotal: 所有未繳清帳單剩餘總和（＝信用卡應繳，含未出帳與未來分期）
  //   issuedUnpaid: 已出帳且未繳清的帳單（待辦卡用）
  cardBills(role, acct, ledger, today = new Date()) {
    const bd = acct.billingDate || 15;
    const dd = acct.dueDate || 25;
    const name = acct.name;
    const base = (acct.baseDate || '').replace(/-/g, '/');
    const fmt = d => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    // 月底夾擠：結帳/截止日超過當月天數時取月底
    const clampDay = (y, mIdx, day) => {
      const last = new Date(y, mIdx + 1, 0).getDate();
      return new Date(y, mIdx, Math.min(day, last));
    };

    const charges = ledger.filter(tx =>
      tx.type === '支出' && tx.amount > 0 &&
      (tx.accountOut === name || tx.payAccount === name) &&
      (!base || tx.date >= base)
    ).sort((a, b) => a.date.localeCompare(b.date));

    const paysTotal = ledger.filter(tx =>
      (tx.type === '轉帳' || tx.type === '公積金提撥') &&
      tx.accountIn === name && (!base || tx.date >= base)
    ).reduce((s, t) => s + t.amount, 0);

    if (!charges.length) return { bills: [], unpaidTotal: 0, issuedUnpaid: [], credit: paysTotal };

    // 該筆刷卡所屬帳單期的結帳日：日期 ≤ 當月結帳日 → 當月；否則下月
    const cycleEnd = dateStr => {
      const [y, m] = dateStr.split('/').map(Number);
      let end = clampDay(y, m - 1, bd);
      if (dateStr > fmt(end)) end = clampDay(y, m, bd);
      return end;
    };

    const map = new Map();
    charges.forEach(tx => {
      const end = cycleEnd(tx.date);
      const endStr = fmt(end);
      if (!map.has(endStr)) {
        const prevEnd = clampDay(end.getFullYear(), end.getMonth() - 1, bd);
        const dueDate = clampDay(end.getFullYear(), end.getMonth() + 1, dd);
        map.set(endStr, {
          start: fmt(new Date(prevEnd.getTime() + 86400000)),
          end: endStr, due: fmt(dueDate), dueDate,
          amount: 0, txs: []
        });
      }
      const b = map.get(endStr);
      b.amount += tx.amount;
      b.txs.push(tx);
    });

    const todayStr = fmt(today);
    const bills = [...map.values()].sort((a, b) => a.end.localeCompare(b.end));
    let pool = paysTotal;
    bills.forEach(b => {
      const cut = Math.min(pool, b.amount);
      b.paid = cut;
      pool -= cut;
      b.remain = b.amount - cut;
      b.issued = todayStr > b.end;
      b.status = b.remain <= 0 ? '已繳清' : '未繳清';
    });

    return {
      bills,
      unpaidTotal: bills.reduce((s, b) => s + b.remain, 0),
      issuedUnpaid: bills.filter(b => b.issued && b.remain >= 1),
      credit: pool
    };
  },

  showLoading(show = true) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
  },

  identity() { return localStorage.getItem(CFG.LS_KEYS.IDENTITY) || ''; },

  el(id) { return document.getElementById(id); },

  html(tag, attrs = {}, children = '') {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag}${a ? ' ' + a : ''}>${children}</${tag}>`;
  }
};
