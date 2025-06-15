import axios from 'axios';
import * as cheerio from 'cheerio';
import { videojson } from '../utils/video.js';
import { categoryjson } from '../utils/category.js';
import { registerPlatformRoutes } from '../utils/platformRouter.js';
import { platformjson } from '../utils/platform.js';
import puppeteer from 'puppeteer';
import JSON5 from 'json5';
import { videoArrJson, subtitlesArrJson } from '../utils/arr.js';

// Default headers for all xHamster requests
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

// Helper for GET requests with default headers
function xhamsterGet(url, options = {}) {
  return axios.get(url, { headers: XHAMSTER_HEADERS, ...options });
}

// Get base URL depending on orientation
function getBaseUrl(orientation = "straight") {
  switch (orientation) {
    case "gay": return "https://xhamster.com/gay";
    case "shemale": return "https://xhamster.com/shemale";
    default: return "https://xhamster.com";
  }
}

// Fetch categories for a given orientation
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

// Fetch all categories (main page)
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

// Fetch videos for a category and page
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

  // Pagination detection
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

// Search videos by query and orientation
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

  // Pagination detection
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

// Fetch featured videos for a given orientation
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
      console.error('[xhamster/featured] No videos found!');
      throw new Error('No videos found. Possibly blocked or HTML changed.');
    }
    return results;
  } catch (err) {
    console.error('[xhamster/featured] Error:', err.message);
    throw err;
  }
}

// Try to extract direct MP4 URL from video page
export async function getDirectXhamsterUrl(videoPageUrl) {
  try {
    const { data } = await xhamsterGet(videoPageUrl);
    const match = data.match(/<video[^>]+src="([^"]+\.mp4[^"]*)"/i);
    if (match && match[1]) return match[1];
    console.warn('[XHAMSTER] No videos found in <noscript>');
  } catch (err) {
    console.error(`[XHAMSTER] ERROR: ${videoPageUrl}`, err.message);
  }
  return null;
}

// Category API for platformRouter
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

// Extract video and subtitle URLs from a video page
export async function getVidUrl(url) {
  // 1. Extract video URLs (Cheerio + M3U8)
  const { data } = await xhamsterGet(url);
  const $ = cheerio.load(data);

  // Try to find M3U8 URL in HTML or JS
  const m3u8Match = data.match(/"(https:\/\/[^"]+\.m3u8[^"]*)"/i);
  let videoArr = [];
  if (m3u8Match && m3u8Match[1]) {
    try {
      const m3u8Text = (await axios.get(m3u8Match[1], { headers: XHAMSTER_HEADERS })).data;
      const lines = m3u8Text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
          if (resMatch) {
            let quality = resMatch[1];
            // Treat 3840 as 2160 (4K)
            if (quality === "3840") quality = "2160";
            const streamUrl = lines[i + 1].startsWith('http') ? lines[i + 1] : m3u8Match[1].replace(/\/[^/]*$/, '/') + lines[i + 1];
            videoArr.push(videoArrJson({ quality, url: streamUrl, source: "xhamster" }));
          }
        }
      }
      videoArr.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
    } catch (err) {
      let quality = "hls";
      let url = m3u8Match[1];
      videoArr = [videoArrJson({ quality, url, source: "xhamster" })];
    }
  } else {
    // Fallback: MP4 from <noscript>
    const noscriptMatch = data.match(/<video[^>]+src="([^"]+\/(\d{3,4})p\.h264\.mp4)"/i);
    if (noscriptMatch && noscriptMatch[1] && noscriptMatch[2]) {
      let quality = noscriptMatch[2] === "3840" ? "2160" : noscriptMatch[2];
      videoArr = [videoArrJson({ quality, url: noscriptMatch[1], source: "xhamster" })];
    }
  }

  // TODO: Subtitles for xHamster

  // Try to extract subtitles from JS object
  const scriptTagMatch = data.match(/<script[^>]+id=["']initials-script["'][^>]*>([\s\S]*?)<\/script>/i);
  let subtitlesArr = [];
  if (scriptTagMatch && scriptTagMatch[1]) {
    const initialsObjStr = extractObjectFromScript(scriptTagMatch[1], 'window.initials');
    let initials = null;
    try {
      if (initialsObjStr) initials = JSON5.parse(initialsObjStr);
    } catch (e) {
      console.error('[XHAMSTER] Error parsing:', e.message);
    }

    // Try to find subtitles in all possible structures
    const tracks =
      initials?.xplayerPluginSettings?.subtitles?.tracks ||
      initials?.xplayerSettings?.subtitles?.tracks ||
      initials?.subtitles?.tracks;

    if (Array.isArray(tracks)) {
      subtitlesArr = tracks.map(track => {
        const url = track.urls?.vtt;
        return url ? subtitlesArrJson({
          lang: track.lang,
          label: track.label,
          url
        }) : null;
      }).filter(Boolean);

      // Always put English first
      subtitlesArr.sort((a, b) => (a.lang === "en" ? -1 : b.lang === "en" ? 1 : 0));
    }
  }

  // Return like hstream
  return {
    source: {
      videoArr,
      subtitlesArr
    }
  };
}

// Proxy a video stream with default headers
export async function proxy(url, res) {
  const response = await axios.get(url, { headers: XHAMSTER_HEADERS, responseType: 'stream' });
  res.set(response.headers);
  response.data.pipe(res);
}

// Platform info
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

// Register all routes for this platform
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

// Extract JS object from script tag by variable name
function extractObjectFromScript(script, varName) {
  // Allow any whitespace and optional semicolon
  const regex = new RegExp(varName.replace('.', '\\.') + '\\s*=\\s*({)', 'm');
  const match = script.match(regex);
  if (!match) return null;
  const start = match.index + match[0].lastIndexOf('{');
  let open = 1, end = start + 1;
  while (open > 0 && end < script.length) {
    if (script[end] === '{') open++;
    else if (script[end] === '}') open--;
    end++;
  }
  if (open !== 0) return null;
  return script.slice(start, end);
}