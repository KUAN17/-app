// Cloudflare Worker — 台股報價 Proxy（Yahoo Finance）
// 改用 Yahoo Finance API，無地區限制，支援批次查詢
//
// 用法：
//   ?symbols=2330.TW,00878.TW,2317.TW
//   回傳 { "2330": 980.0, "00878": 21.5, ... }（純數字代號 → 收盤價）

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols'); // e.g. "2330.TW,00878.TW"

    if (!symbols) {
      return new Response(JSON.stringify({ error: 'missing symbols' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,symbol`;

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 900, cacheEverything: true }, // edge cache 15 分鐘
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `upstream ${upstream.status}` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const data = await upstream.json();
    const quotes = data?.quoteResponse?.result || [];

    // 轉換成 { "2330": 980.0, "00878": 21.5 } 格式
    const prices = {};
    quotes.forEach(q => {
      // Yahoo symbol 格式 "2330.TW" → 取 "2330"
      const code = (q.symbol || '').replace(/\.TW$/i, '');
      if (code && q.regularMarketPrice) prices[code] = q.regularMarketPrice;
    });

    return new Response(JSON.stringify(prices), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
        ...CORS,
      },
    });
  },
};
