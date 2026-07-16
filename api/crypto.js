export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol = 'BTCUSDT', interval = '1h', limit = '100' } = req.query;

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    const raw = await response.json();

    if (!Array.isArray(raw)) {
      return res.status(404).json({ error: 'Symbole introuvable ou erreur Binance', details: raw });
    }

    const candles = raw.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
    }));

    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;

    res.status(200).json({ symbol, currentPrice, candles });
  } catch (e) {
    res.status(500).json({ error: 'Impossible de récupérer les prix crypto' });
  }
}
