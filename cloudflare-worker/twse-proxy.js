// Cloudflare Worker — 台股報價 Proxy
// 部署方式：
//   1. 登入 https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. 貼上此程式碼，Worker 名稱建議 twse-proxy
//   3. 部署後把 js/config.js 的 QUOTE_PROXY 改成你的 Worker URL
//
// 支援 ?target=twse（上市）和 ?target=tpex（上櫃）

const ENDPOINTS = {
  twse: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  tpex: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target');

    if (!ENDPOINTS[target]) {
      return new Response(JSON.stringify({ error: 'invalid target' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const upstream = await fetch(ENDPOINTS[target], {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.twse.com.tw/',
        'Accept': 'application/json, text/plain, */*',
      },
      cf: { cacheTtl: 3600, cacheEverything: true }, // Cloudflare edge cache 1 小時
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        ...CORS,
      },
    });
  },
};
