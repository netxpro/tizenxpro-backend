import axios from 'axios';
import { normalizeXhamsterVideo } from '../utils/normalizeVideo.js';
import * as cheerio from 'cheerio';

const XHAMSTER_HEADERS = {
  'Referer': 'https://xhamster.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'DNT': '1',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

function xhamsterGet(url, options = {}) {
  return axios.get(url, { headers: XHAMSTER_HEADERS, ...options });
}

function getBaseUrl(setting = "straight") {
  switch (setting) {
    case "gay": return "https://xhamster.com/gay";
    case "shemale": return "https://xhamster.com/shemale";
    default: return "https://xhamster.com";
  }
}

export async function getDirectXhamsterUrl(videoPageUrl) {
  try {
    const { data } = await xhamsterGet(videoPageUrl);
    const match = data.match(/<video[^>]+src="([^"]+\.mp4[^"]*)"/i);
    if (match && match[1]) return match[1];
    console.warn('[XHAMSTER] no vids found in <noscript>');
  } catch (err) {
    console.error(`[XHAMSTER] ERROR: ${videoPageUrl}`, err.message);
  }
  return null;
}

export async function searchXhamster(query, setting = "straight", page = 1) {
  const base = getBaseUrl(setting);
  const url = page > 1
    ? `${base}/search/${encodeURIComponent(query)}/?quality=720p&page=${page}`
    : `${base}/search/${encodeURIComponent(query)}/?quality=720p`;
  const { data } = await xhamsterGet(url);

  const $ = cheerio.load(data);
  const results = [];
  $('div.thumb-list__item.video-thumb').each((_, el) => {
    const href = $(el).find('a.video-thumb__image-container').attr('href');
    const title = $(el).find('.video-thumb-info__name').attr('title')?.trim();
    const img = $(el).find('img.thumb-image-container__image').attr('src');
    const duration = $(el).find('[data-role="video-duration"]').text().trim();
    const views = $(el).find('.video-thumb-views').text().trim();
    if (href && title && img) {
      results.push(normalizeXhamsterVideo({ title, href, img, duration, views }, setting));
    }
  });

  let totalPages = 1;
  $('ul.test-pager a[data-page]').each((_, el) => {
    const val = $(el).attr('data-page');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });

  if (totalPages === 1) {
    $('nav[data-role="pagination-cleaner"] .page-list a.page-button-link').each((_, el) => {
      const num = parseInt($(el).text().trim(), 10);
      if (!isNaN(num) && num > totalPages) totalPages = num;
    });
    const lastBtn = $('nav[data-role="pagination-cleaner"] .page-limit-button--right a.page-button-link').last();
    if (lastBtn.length) {
      const num = parseInt(lastBtn.text().trim(), 10);
      if (!isNaN(num) && num > totalPages) totalPages = num;
    }
  }

  return { results, totalPages, sourceSetting: setting };
}

export async function featuredXhamster(setting = "straight") {
  const base = getBaseUrl(setting);
  const url = `${base}/hd`;
  const { data } = await xhamsterGet(url);

  const $ = cheerio.load(data);
  const results = [];
  $('div.thumb-list__item.video-thumb').each((_, el) => {
    const href = $(el).find('a.video-thumb__image-container').attr('href');
    const title = $(el).find('.video-thumb-info__name').attr('title')?.trim();
    const img = $(el).find('img.thumb-image-container__image').attr('src');
    const duration = $(el).find('[data-role="video-duration"]').text().trim();
    const views = $(el).find('.video-thumb-views').text().trim();
    if (href && title && img) {
      results.push(normalizeXhamsterVideo({ title, href, img, duration, views }, setting));
    }
  });
  return results;
}

export async function getXhamsterCategory(category, page = 1, setting = "straight") {
  const base = getBaseUrl(setting);
  const url = page > 1
    ? `${base}/categories/${category}/hd/${page}`
    : `${base}/categories/${category}/hd`;
  const { data } = await xhamsterGet(url);

  const $ = cheerio.load(data);
  const results = [];
  $('div.thumb-list__item.video-thumb').each((_, el) => {
    const href = $(el).find('a.video-thumb__image-container').attr('href');
    const title = $(el).find('.video-thumb-info__name').attr('title')?.trim();
    const img = $(el).find('img.thumb-image-container__image').attr('src');
    const duration = $(el).find('[data-role="video-duration"]').text().trim();
    const views = $(el).find('.video-thumb-views').text().trim();
    if (href && title && img) {
      results.push(normalizeXhamsterVideo({ title, href, img, duration, views }, setting));
    }
  });

  let totalPages = 1;
  $('nav[data-role="pagination-cleaner"] .page-list a.page-button-link').each((_, el) => {
    const num = parseInt($(el).text().trim(), 10);
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });
  const lastBtn = $('nav[data-role="pagination-cleaner"] .page-limit-button--right a.page-button-link').last();
  if (lastBtn.length) {
    const num = parseInt(lastBtn.text().trim(), 10);
    if (!isNaN(num) && num > totalPages) totalPages = num;
  }
  return { videos: results, totalPages, sourceSetting: setting };
}


export function registerRoutes(app, basePath) {
  app.get(`${basePath}/search`, async (req, res) => {
    const query = req.query.query;
    const setting = req.query.setting || "straight";
    const page = parseInt(req.query.page || "1", 10);
    if (!query) return res.status(400).json({ error: 'Missing search query' });
    try {
      const { results, totalPages, sourceSetting } = await searchXhamster(query, setting, page);
      res.json({ results, totalPages, page, sourceSetting });
    } catch (err) {
      console.error('XHamster Search Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/vidurl`, async (req, res) => {
    const { url } = req.query;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Ungültige oder fehlende URL' });
    }
    const directUrl = await getDirectXhamsterUrl(url);
    if (!directUrl) {
      return res.status(404).json({ error: 'Video-URL konnte nicht extrahiert werden' });
    }
    return res.json({ directUrl });
  });

  app.get(`${basePath}/proxy`, async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url');
    try {
      const response = await axios.get(targetUrl, {
        headers: XHAMSTER_HEADERS,
        responseType: 'stream',
      });
      res.set(response.headers);
      response.data.pipe(res);
    } catch (err) {
      console.error('[Proxy Fehler]', err.message);
      res.status(500).send('Proxy failed');
    }
  });

  app.get(`${basePath}/featured`, async (req, res) => {
    const setting = req.query.setting || "straight";
    try {
      const results = await featuredXhamster(setting);
      res.json({ results, sourceSetting: setting });
    } catch (err) {
      console.error('XHamster Featured Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(`${basePath}/categories`, async (req, res) => {
    const category = req.query.category || req.query.titel || req.query.name;
    const page = parseInt(req.query.page || "1", 10);
    const setting = req.query.setting || "straight";
    if (!category) return res.status(400).json({ error: 'Missing category' });
    try {
      const { videos, totalPages, sourceSetting } = await getXhamsterCategory(category, page, setting);
      res.json({ videos, totalPages, page, sourceSetting });
    } catch (err) {
      console.error('XHamster Category Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}