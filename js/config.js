window.CFG = {
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  SHEETS_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

  ROLES: ['阿熊', '綺綺', '家用'],
  TX_TYPES: ['支出', '收入', '轉帳', '公積金提撥'],
  DIMENSIONS: ['日常', '專案'],

  CATEGORIES: {
    '支出': ['食物','飲料','交通','購物','娛樂','家用','電信','醫藥','教育','醫療保險','投資儲蓄','旅遊','訂閱','信用卡費'],
    '收入': ['薪資收入','利息/股息','業外收入','現金回饋'],
    '轉帳': ['ATM領現','轉帳'],
    '公積金提撥': ['常態家用','專案預備金']
  },

  DEFAULT_ACCOUNTS: {
    '阿熊': ['中信活存(薪資)','新光活存(投資)','聯邦活存(日用)','Line Pay Money','信用卡-玉山Pi','現金錢包','股票部位'],
    '綺綺': ['台新Richart','信用卡-台新GoGo','現金錢包','股票部位'],
    '家用': ['一銀活存','土銀活存','現金錢包']
  },

  LS_KEYS: {
    SHEET_ID: 'ff_sheet_id',
    CLIENT_ID: 'ff_client_id',
    CACHE_DATA: 'ff_cache',
    CACHE_TS: 'ff_cache_ts',
    AUTOLOGIN: 'ff_autologin'
  },

  CACHE_TTL: 5 * 60 * 1000
};
