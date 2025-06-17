import axios from 'axios';

export function registerPlatformRoutes(app, basePath, platformApi) {
  // Category endpoints
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
      if (notFound) return res.status(404).json({ error: 'Category/tag not found' });
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
      return res.status(400).json({ error: 'Invalid or missing URL' });
    }
    try {
      const result = await platformApi.getVidUrl(url);
      if (!result) {
        return res.status(404).json({ error: 'Video URL could not be extracted' });
      }
      return res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' + err});
    }
  });

  // Proxy handler for both variants
  app.get(`${basePath}/proxy`, async (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return next(); // If no query, pass to next route

    await handleProxy(targetUrl, req, res, basePath, platformApi);
  });

  app.get(`${basePath}/proxy/*`, async (req, res) => {
    const restPath = req.params[0];
    if (!restPath) return res.status(400).send('Missing url');
    const targetUrl = 'https://' + restPath;
    await handleProxy(targetUrl, req, res, basePath, platformApi);
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

// Helper function for proxy logic
async function handleProxy(targetUrl, req, res, basePath, platformApi) {
  // Detect manifest files (also with query params)
  if (/\.(m3u8|mpd)(\?|$)/.test(targetUrl)) {
    try {
      const axiosResponse = await axios.get(targetUrl, { responseType: 'text' });
      let manifestText = axiosResponse.data;
      const baseUrl = targetUrl.replace(/\/[^\/?#]+$/, '/');

      // 1. Convert relative paths to absolute CDN URLs (also with query params)
      manifestText = manifestText.replace(
        /^([^\s#][^\s?]*\.[a-z0-9]+(\?[^\s]*)?)$/gim,
        (match) => {
          if (match.startsWith('http')) return match;
          return new URL(match, baseUrl).href;
        }
      );

      // Rewrite #EXT-X-MAP:URI="..." to proxy URL (always as query)
      manifestText = manifestText.replace(
        /(#EXT-X-MAP:URI=")([^"]+)"/g,
        (full, prefix, uri) => {
          let abs = uri;
          if (!abs.startsWith('http')) abs = new URL(uri, baseUrl).href;
          return `${prefix}${basePath}/proxy?url=${encodeURIComponent(abs)}"`;
        }
      );

      // 2. Rewrite all CDN URLs to proxy URLs (any extension, always as query)
      manifestText = manifestText.replace(
        /(https?:\/\/[^\s"']+\.[a-z0-9]+(\?[^\s"']*)?)/gim,
        (match) => {
          if (match.includes(`${basePath}/proxy?url=`)) return match;
          return `${basePath}/proxy?url=${encodeURIComponent(match)}`;
        }
      );

      // For MPD: rewrite SegmentTemplate attributes (initialization, media) as path!
      if (/\.mpd(\?|$)/.test(targetUrl)) {
        manifestText = manifestText.replace(
          /(initialization|media)="([^"]+)"/g,
          (full, attr, val) => {
            let abs = val;
            if (!abs.startsWith('http')) abs = new URL(val, baseUrl).href;
            // Proxy URL as path, keep placeholders!
            abs = `${basePath}/proxy/${abs.replace(/^https?:\/\//, '')}`;
            return `${attr}="${abs}"`;
          }
        );
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(manifestText);
    } catch (err) {
      console.error('Manifest Proxy failed:', targetUrl, err?.response?.status, err?.message);
      res.status(500).send('Proxy failed');
    }
    return;
  }

  try {
    // Hole die Datei selbst, setze Header, dann streame
    const response = await axios.get(targetUrl, { responseType: 'stream' });
    // Setze alle relevanten Header VOR dem Senden!
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.data.pipe(res);
  } catch (err) {
    console.error('Proxy failed for:', targetUrl, err?.response?.status, err?.message);
    res.status(500).send('Proxy failed');
  }
}