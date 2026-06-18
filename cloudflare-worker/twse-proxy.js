// Cloudflare Worker — 台股報價 Proxy
// 使用 Yahoo Finance v8/finance/chart 逐支查詢（無需 crumb / 登入）
//
// 用法：?symbols=2330,00878,00933B   （純數字代號，逗號分隔）
// 回傳：{"2330":980.0,"00878":21.5,...}
//
// 上市股票後綴 .TW，上櫃股票後綴 .TWO，自動嘗試兩者

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

async function fetchPrice(suffix, code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.${suffix}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YF_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  // 優先取 indicators.quote[0].close 末尾值（官方收盤競價價格）
  // 備用 meta.regularMarketPrice（即時最後成交，盤中準確但收盤可能有差）
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  const closePrice = closes?.length > 0 ? closes[closes.length - 1] : null;
  const fallback = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const price = closePrice ?? fallback;
  return price > 0 ? price : null;
}

async function fetchOne(code) {
  // 先試上市（.TW），取不到再試上櫃（.TWO）
  const price = await fetchPrice('TW', code);
  if (price !== null) return price;
  return fetchPrice('TWO', code);
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
