window.CFG = {
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
  SHEETS_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

  CLIENT_ID: '677203779184-0r63u9ebkc4vu92r7ivetmqrprrgc6ct.apps.googleusercontent.com',
  SHEET_ID: '1UY2xEcxqqo8eQcFz-E_Txs3koxf9K9wl29OG2Ht7sgM',

  ROLES: ['阿熊', '綺綺', '家用'],
  TX_TYPES: ['支出', '收入', '轉帳'],
  DIMENSIONS: ['日常', '專案'],

  CATEGORIES: {
    '支出': ['食物','飲料','交通','購物','娛樂','家用','電信','醫藥','教育','醫療保險','投資儲蓄','旅遊','訂閱','信用卡費'],
    '收入': ['薪資收入','利息/股息','現金回饋','其他'],
    '轉帳': []
  },

  INITIAL_ACCOUNTS: [
    {role:'阿熊', name:'中信活存(薪資)', purpose:'薪資入帳'},
    {role:'阿熊', name:'新光活存(投資)', purpose:'投資'},
    {role:'阿熊', name:'聯邦活存(日用)', purpose:'日常消費'},
    {role:'阿熊', name:'Line Pay Money',  purpose:'行動支付'},
    {role:'阿熊', name:'信用卡-玉山Pi',   purpose:''},
    {role:'阿熊', name:'現金錢包',         purpose:''},
    {role:'阿熊', name:'股票部位',         purpose:'投資'},
    {role:'綺綺', name:'台新Richart',      purpose:''},
    {role:'綺綺', name:'信用卡-台新GoGo', purpose:''},
    {role:'綺綺', name:'現金錢包',         purpose:''},
    {role:'綺綺', name:'股票部位',         purpose:'投資'},
    {role:'家用', name:'一銀活存',         purpose:'家用主帳戶'},
    {role:'家用', name:'土銀活存',         purpose:''},
    {role:'家用', name:'現金錢包',         purpose:''}
  ],

  LS_KEYS: {
    SHEET_ID:  'ff_sheet_id',
    CLIENT_ID: 'ff_client_id',
    CACHE_DATA:'ff_cache',
    CACHE_TS:  'ff_cache_ts',
    AUTOLOGIN: 'ff_autologin',
    IDENTITY:  'ff_identity'
  },

  CAT_REPAYMENT: '代付補款',

  CACHE_TTL: 5 * 60 * 1000
};
