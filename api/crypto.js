const SYMBOL_MAP = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  BNBUSDT: 'binancecoin',
  SOLUSDT: 'solana',
  XRPUSDT: 'ripple',
  DOGEUSDT: 'dogecoin',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'BTCUSDT', days = '7' } = req.query;
  const coinId = SYMBOL_MAP[symbol.toUpperCase()] || 'bitcoin';

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    const response = await fetch(url);
    const raw = await response.json();

    if (!Array.isArray(raw)) {
      return res.status(404).json({ error: 'Symbole introuvable ou erreur CoinGecko', details: raw });
    }

    const candles = raw.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
    }));

    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;

    res.status(200).json({ symbol, currentPrice, candles });
  } catch (e) {
    res.status(500).json({ error: 'Impossible de récupérer les prix crypto' });
  }
}
