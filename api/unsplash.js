export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { query } = req.query;
  
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&per_page=5&orientation=landscape`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.VITE_UNSPLASH_ACCESS_KEY}`
      }
    }
  );
  
  const data = await response.json();
  const urls = data.results?.map(photo => photo.urls.regular) || [];
  res.status(200).json({ urls });
}
