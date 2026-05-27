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

  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type} show`;
    setTimeout(() => el.classList.remove('show'), 2800);
  },

  showLoading(show = true) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
  },

  el(id) { return document.getElementById(id); },

  html(tag, attrs = {}, children = '') {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag}${a ? ' ' + a : ''}>${children}</${tag}>`;
  }
};
