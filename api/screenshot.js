export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    const thumUrl = 'https://image.thum.io/get/width/1200/' + url;
    const response = await fetch(thumUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    res.status(200).json({ image: 'data:image/jpeg;base64,' + base64 });
  } catch (e) {
    res.status(500).json({ error: 'Impossible de capturer cette URL' });
  }
}
