# twse-proxy — Cloudflare Worker

台股報價 Proxy，部署在 Cloudflare Workers，用於繞過 TWSE / TPEX API 的 IP 封鎖。

## 部署資訊

| 項目 | 值 |
|------|-----|
| Worker 名稱 | `twse-proxy` |
| 帳號 | leo30331@gmail.com |
| 部署網址 | `https://twse-proxy.leo30331.workers.dev` |
| 來源檔案 | `cloudflare-worker/twse-proxy.js` |

## API 用法

```
GET https://twse-proxy.leo30331.workers.dev?symbols=2330,00878,00933B
```

回傳：

```json
{"2330": 980.0, "00878": 21.5, "00933B": 14.3}
```

- `symbols`：股票代號，逗號分隔，純數字（不含 `.TW` / `.TWO`）
- 上市股票自動加 `.TW`，上櫃股票（含債券 ETF）自動 fallback 至 `.TWO`
- Cache-Control: `max-age=900`（15 分鐘）

## 更新 Worker 程式碼

1. 修改 `cloudflare-worker/twse-proxy.js`
2. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → `twse-proxy`
3. 點 **Edit Code** → 貼上新內容 → **Save and deploy**

## 資料來源

Yahoo Finance `v8/finance/chart` API（無需登入 / crumb）：

```
https://query1.finance.yahoo.com/v8/finance/chart/{symbol}.TW?interval=1d&range=1d
```

欄位路徑：`chart.result[0].meta.regularMarketPrice`
