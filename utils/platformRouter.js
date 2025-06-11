import axios from 'axios';

export function registerPlatformRoutes(app, basePath, platformApi) {
  app.get(`${basePath}/categories`, async (req, res) => {
    try {
      const categories = await platformApi.getCategories(req);
      return res.json({ categories });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/category`, async (req, res) => {
    const category = req.query.category || req.query.titel || req.query.name;
    const page = parseInt(req.query.page || "1", 10);
    if (!category) return res.status(400).json({ error: 'Missing category' });
    try {
      const { videos, totalPages, sourceSetting, notFound } = await platformApi.getCategory(category, page, req);
      if (notFound) return res.status(404).json({ error: 'Kategorie/Tag nicht gefunden' });
      res.json({ videos, totalPages, page, sourceSetting });
    } catch (err) {
      console.error('Category Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/search`, async (req, res) => {
    const query = req.query.query;
    const page = parseInt(req.query.page || "1", 10);
    if (!query) return res.status(400).json({ error: 'Missing search query' });
    try {
      const { results, totalPages } = await platformApi.search(query, page, req);
      res.json({ results, totalPages, page });
    } catch (err) {
      console.error('Search Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/vidurl`, async (req, res) => {
    const { url } = req.query;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Ungültige oder fehlende URL' });
    }
    try {
      const directUrl = await platformApi.getVidUrl(url);
      if (!directUrl) {
        return res.status(404).json({ error: 'Video-URL konnte nicht extrahiert werden' });
      }
      return res.json({ directUrl });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/proxy`, async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url');
    try {
      if (targetUrl.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
        await platformApi.proxy(targetUrl, res);
      } else if (targetUrl.endsWith('.m3u8')) {
        const axiosResponse = await axios.get(targetUrl, { responseType: 'text' });
        let m3u8Text = axiosResponse.data;

        m3u8Text = m3u8Text.replace(
          /(https?:\/\/[^\s"']+\.(ts|html|m4s))/g,
          (match) => {
            // Nur ersetzen, wenn noch keine Proxy-URL
            if (match.includes(`${basePath}/proxy?url=`)) return match;
            return `${basePath}/proxy?url=${encodeURIComponent(match)}`;
          }
        );

        m3u8Text = m3u8Text.replace(
          /^([^\s#][^\s]*\.(ts|html|m4s))$/gm,
          (match) => {
            if (match.includes(`${basePath}/proxy?url=`)) return match;
            const absUrl = new URL(match, targetUrl).href;
            return `${basePath}/proxy?url=${encodeURIComponent(absUrl)}`;
          }
        );

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(m3u8Text);
      } else {

        await platformApi.proxy(targetUrl, res);
      }
    } catch (err) {
      console.error('Proxy failed for:', targetUrl, err?.response?.status, err?.message);
      res.status(500).send('Proxy failed');
    }
  });

  app.get(`${basePath}/featured`, async (req, res) => {
    try {
      const results = await platformApi.featured(req);
      res.json({ results, sourceSetting: "api" });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}