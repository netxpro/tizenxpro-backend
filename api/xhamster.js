import axios from 'axios';
import * as cheerio from 'cheerio';
import { videojson } from '../utils/video.js';
import { categoryjson } from '../utils/category.js';
import { registerPlatformRoutes } from '../utils/platformRouter.js';
import { platformjson } from '../utils/platform.js';

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

function getBaseUrl(orientation = "straight") {
  switch (orientation) {
    case "gay": return "https://xhamster.com/gay";
    case "shemale": return "https://xhamster.com/shemale";
    default: return "https://xhamster.com";
  }
}

export async function getXhamsterCategories(orientation = "straight") {
  const base = getBaseUrl(orientation);
  const url = `${base}/categories/hd`;
  const { data } = await xhamsterGet(url);
  const $ = cheerio.load(data);
  const categories = [];
  $('div.categories-list__item').each((_, el) => {
    const name = $(el).find('.categories-list__name').text().trim();
    const href = $(el).find('a.categories-list__link').attr('href');
    const img = $(el).find('img.categories-list__thumb').attr('src');
    const id = href ? href.split('/').filter(Boolean).pop() : name.toLowerCase();
    if (name && href) {
      categories.push(categoryjson({
        id,
        name,
        image: img,
        description: null,
        url: href,
        source: "xhamster"
      }));
    }
  });
  return categories;
}

export async function getCategories() {
  const url = "https://xhamster.com/categories";
  const { data } = await axios.get(url, { headers: XHAMSTER_HEADERS });
  const $ = cheerio.load(data);
  const categories = [];
  const seen = new Set();

  const allowedSections = [
    "actions",
    "age",
    "body",
    "number-of-people"
  ];

  for (const sectionId of allowedSections) {
    $(`section#${sectionId} a.thumbItem-f658a`).each((_, el) => {
      const name = $(el).find('h3.imgHeaderPrimary-f658a').text().trim();
      const href = $(el).attr('href');
      const img = $(el).find('img.img-f658a').attr('src');
      const id = href ? href.split('/').filter(Boolean).pop() : name.toLowerCase();
      const uniqueKey = id + '|' + img;
      if (!name || !href || !img || seen.has(uniqueKey)) return;
      seen.add(uniqueKey);
      categories.push(categoryjson({
        id,
        name,
        image: img,
        description: null,
        url: href,
        source: "xhamster"
      }));
    });
  }
  return categories;
}

export async function getXhamsterCategory(category, page = 1, orientation = "straight") {
  const base = getBaseUrl(orientation);
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
      results.push(videojson({
        id: href.split('/').filter(Boolean).pop(),
        title,
        thumbnail: img,
        url: href.startsWith('http') ? href : `https://xhamster.com${href}`,
        duration,
        views,
        source: "xhamster",
        orientation: orientation
      }));
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
  return { videos: results, totalPages, orientation: orientation };
}

export async function searchXhamster(query, orientation = "straight", page = 1) {
  const base = getBaseUrl(orientation);
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
      results.push(videojson({
        id: href.split('/').filter(Boolean).pop(),
        title,
        thumbnail: img,
        url: href.startsWith('http') ? href : `https://xhamster.com${href}`,
        duration,
        views,
        source: "xhamster",
        orientation: orientation
      }));
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

  return { results, totalPages, orientation: orientation };
}

export async function featuredXhamster(orientation = "straight") {
  const base = getBaseUrl(orientation);
  const url = `${base}/hd`;
  try {
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
        results.push(videojson({
          id: href.split('/').filter(Boolean).pop(),
          title,
          thumbnail: img,
          url: href.startsWith('http') ? href : `https://xhamster.com${href}`,
          duration,
          views,
          source: "xhamster",
          orientation: orientation
        }));
      }
    });

    if (results.length === 0) {
      console.error('[xhamster/featured] Keine Videos gefunden!');
      throw new Error('Keine Videos gefunden. Möglicherweise Blockierung oder HTML geändert.');
    }
    return results;
  } catch (err) {
    console.error('[xhamster/featured] Fehler:', err.message);
    throw err;
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

export async function getCategory(category, page = 1, req) {
  const orientation = req?.query?.orientation || "straight";
  return getXhamsterCategory(category, page, orientation);
}
export async function search(query, page = 1, req) {
  const orientation = req?.query?.orientation || "straight";
  return searchXhamster(query, orientation, page);
}
export async function featured(req) {
  const orientation = req?.query?.orientation || "straight";
  return featuredXhamster(orientation);
}
export function getVidUrl(url) {
  return getDirectXhamsterUrl(url);
}
export async function proxy(url, res) {
  const response = await axios.get(url, { headers: XHAMSTER_HEADERS, responseType: 'stream' });
  res.set(response.headers);
  response.data.pipe(res);
}

export const platformId = "xhamster";
export const platformLabel = "xHamster";
export const platformComment = "Free Porn Videos & XXX Movies: Sex Videos Tube | xHamster";
export const platformSettings = { orientation: ["straight", "gay", "shemale"] };

export function getPlatformInfo() {
  return platformjson({
    id: platformId,
    label: platformLabel,
    comment: platformComment,
    settings: platformSettings
  });
}

export function registerRoutes(app, basePath) {
  registerPlatformRoutes(app, basePath, {
    getCategories,
    getCategory,
    search,
    featured,
    getVidUrl,
    proxy,
  });
}