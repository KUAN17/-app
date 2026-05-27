window.Router = (() => {
  const pages = {};
  let current = null;
  let _titleEl, _contentEl, _navItems;

  const PAGE_TITLES = {
    dashboard: '總覽',
    entry: '記帳',
    ledger: '帳本',
    projects: '專案',
    investments: '投資',
    settings: '設定'
  };

  function register(name, mod) {
    pages[name] = mod;
  }

  function go(name, params = {}) {
    if (!pages[name]) return;
    current = name;

    _titleEl.textContent = PAGE_TITLES[name] || name;

    _navItems.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === name);
    });

    _contentEl.innerHTML = '';
    pages[name].render(_contentEl, params);
    if (pages[name].onMount) pages[name].onMount();

    window.location.hash = name;
  }

  function init() {
    _titleEl = Utils.el('page-title');
    _contentEl = Utils.el('page-content');
    _navItems = document.querySelectorAll('#bottom-nav .nav-item');

    _navItems.forEach(btn => {
      btn.addEventListener('click', () => go(btn.dataset.page));
    });

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    go(hash);
  }

  function current_page() { return current; }

  return { register, go, init, current: current_page };
})();
