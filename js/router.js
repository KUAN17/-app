window.Router = (() => {
  const pages = {};
  let current = null;
  let _titleEl, _contentEl, _navItems;

  const DRAWER_PAGES = new Set(['repay', 'projects', 'investments', 'settings']);

  const PAGE_TITLES = {
    dashboard: '總覽', entry: '記帳', ledger: '帳本',
    repay: '代付補款', projects: '專案', investments: '投資', settings: '設定'
  };

  function register(name, mod) { pages[name] = mod; }

  function _closeDrawer() {
    document.getElementById('side-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('show');
  }

  // 抽屜選單紅點：有未結代付就顯示，切頁時同步（資料變動後下次切頁就會反映）
  function _updateBadges() {
    const has = typeof Store !== 'undefined' && Store.hasPendingRepay && Store.hasPendingRepay();
    document.querySelectorAll('.drawer-item[data-page="repay"] .drawer-badge').forEach(b => {
      b.style.display = has ? '' : 'none';
    });
  }

  function go(name, params = {}) {
    if (!pages[name]) return;
    current = name;
    _titleEl.textContent = PAGE_TITLES[name] || name;

    _navItems.forEach(btn => {
      if (btn.id === 'btn-menu') {
        btn.classList.toggle('active', DRAWER_PAGES.has(name));
      } else {
        btn.classList.toggle('active', btn.dataset.page === name);
      }
    });

    // Update active state in drawer
    document.querySelectorAll('.drawer-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === name);
    });

    _closeDrawer();
    _contentEl.innerHTML = '';
    pages[name].render(_contentEl, params);
    const mounted = pages[name].onMount ? pages[name].onMount() : null;
    _updateBadges();
    if (mounted && mounted.then) mounted.then(_updateBadges);
    window.location.hash = name;
  }

  function init() {
    _titleEl   = Utils.el('page-title');
    _contentEl = Utils.el('page-content');
    _navItems  = document.querySelectorAll('#bottom-nav .nav-item');

    _navItems.forEach(btn => {
      if (btn.id !== 'btn-menu') {
        btn.addEventListener('click', () => go(btn.dataset.page));
      }
    });

    // Hamburger
    const menuBtn  = document.getElementById('btn-menu');
    const drawer   = document.getElementById('side-drawer');
    const overlay  = document.getElementById('drawer-overlay');
    menuBtn?.addEventListener('click', () => {
      drawer.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay?.addEventListener('click', _closeDrawer);

    // Drawer items
    document.querySelectorAll('.drawer-item[data-page]').forEach(item => {
      item.addEventListener('click', () => go(item.dataset.page));
    });

    // 未知 hash（亂碼/舊書籤）退回總覽，避免白畫面
    const hash = window.location.hash.replace('#', '');
    go(pages[hash] ? hash : 'dashboard');
  }

  function current_page() { return current; }
  return { register, go, init, current: current_page };
})();
