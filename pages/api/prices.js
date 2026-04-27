export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');
  const FINNHUB_KEY = process.env.FINNHUB_KEY;
  if (!FINNHUB_KEY) {
    return res.status(500).json({ error: 'FINNHUB_KEY not set' });
  }
  const ALL_TICKERS = [
    '1120','2222','7010','9405',
    'SPUS','SPTE','BITB',
    '4002','1150','2380','4013','7203','2020','4003',
    'NVDA','AAPL','TSLA','MSFT','META','AMZN','GOOGL',
  ];
  const results = await Promise.allSettled(
    ALL_TICKERS.map((t) => fetchPrice(t, FINNHUB_KEY))
  );
  const prices = {};
  results.forEach((r, i) => {
    prices[ALL_TICKERS[i]] = r.status === 'fulfilled'
      ? r.value
      : { price: null, change: null, error: true };
  });
  res.json({ prices, updatedAt: new Date().toISOString() });
}
async function fetchPrice(ticker, key) {
  const isSaudi = /^\d{4}$/.test(ticker);
  if (isSaudi) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SR?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' }
    });
    if (!r.ok) throw new Error('Yahoo error');
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('No data');
    const prev = meta.previousClose ?? meta.regularMarketPrice;
    const change = ((meta.regularMarketPrice - prev) / prev) * 100;
    return { price: Math.round(meta.regularMarketPrice * 100) / 100, change: Math.round(change * 100) / 100, currency: 'SAR' };
  } else {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`);
    if (!r.ok) throw new Error('Finnhub error');
    const d = await r.json();
    if (!d.c) throw new Error('No price');
    const change = d.pc ? ((d.c - d.pc) / d.pc) * 100 : 0;
    return { price: Math.round(d.c * 100) / 100, change: Math.round(change * 100) / 100, currency: 'USD' };
  }
}
