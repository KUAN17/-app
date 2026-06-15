// Cloudflare Worker — 台股報價 Proxy
// 使用 Yahoo Finance v8/finance/chart 逐支查詢（無需 crumb / 登入）
//
// 用法：?symbols=2330,00878,2317   （純數字代號，逗號分隔）
// 回傳：{"2330":980.0,"00878":21.5,...}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchOne(code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TW?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YF_HEADERS });
  if (!res.ok) throw new Error(`${code} ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return price > 0 ? price : null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    if (!symbolsParam) {
      return new Response(JSON.stringify({ error: 'missing symbols' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const codes = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

    // 並行查詢所有股票
    const results = await Promise.allSettled(codes.map(async code => {
      const price = await fetchOne(code);
      return { code, price };
    }));

    const prices = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.price) {
        prices[r.value.code] = r.value.price;
      }
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
