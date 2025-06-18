import axios from 'axios';
import * as cheerio from 'cheerio';
import { videojson } from '../utils/video.js';
import { categoryjson } from '../utils/category.js';
import { registerPlatformRoutes } from '../utils/platformRouter.js';
import { platformjson } from '../utils/platform.js';
import puppeteer from 'puppeteer';
import { videoArrJson, subtitlesArrJson } from '../utils/arr.js';

// Default headers for all hstream.moe requests
const HSTREAM_HEADERS = {
  'Referer': 'https://hstream.moe/',
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

// Fetch all categories from homepage
export async function getCategories() {
  const url = 'https://hstream.moe/';
  const { data } = await axios.get(url, { headers: HSTREAM_HEADERS });
  const $ = cheerio.load(data);
  const categories = [];
  // Find all category links in the grid
  $('div.grid a[href*="tags%5B0%5D="]').each((_, el) => {
    const href = $(el).attr('href');
    const name = $(el).find('h2').text().trim();
    const img = $(el).find('img').first().attr('src');
    // Extract tag
    const tagMatch = href.match(/tags%5B0%5D=([^&]+)/);
    const id = tagMatch ? tagMatch[1] : name.toLowerCase();
    if (name && href && id) {
      categories.push(categoryjson({
        id,
        name,
        image: img ? (img.startsWith('http') ? img : `https://hstream.moe${img}`) : null,
        description: null,
        url: `/api/hstream/category?name=${encodeURIComponent(id)}`,
        source: "hstream"
      }));
    }
  });
  // Filter duplicates
  return categories.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
}

// Fetch videos for a category and page
export async function getCategory(category, page = 1) {
  const url = `https://hstream.moe/search?order=recently-uploaded&tags%5B0%5D=${encodeURIComponent(category)}&page=${page}`;
  const { data } = await axios.get(url, { headers: HSTREAM_HEADERS });
  const $ = cheerio.load(data);
  const results = [];
  $('div.relative.p-1.mb-8.w-full').each((_, el) => {
    const a = $(el).find('a').first();
    const href = a.attr('href');
    const title = a.find('img').attr('alt') || a.find('p.text-sm').text().trim();
    const img = a.find('img').attr('src');
    const duration = a.find('p.absolute.right-2.top-2').text().trim() || null;
    // Views (bottom left, after the eye icon)
    let views = null;
    a.find('p.absolute.left-2.bottom-2').each((_, p) => {
      const text = $(p).text();
      const match = text.match(/(\d+(\.\d+)?[kM]?)/i);
      if (match) views = match[1];
    });
    if (href && title && img) {
      results.push(videojson({
        id: href.split('/').filter(Boolean).pop(),
        title,
        thumbnail: img.startsWith('http') ? img : `https://hstream.moe${img}`,
        url: href.startsWith('http') ? href : `https://hstream.moe${href}`,
        duration: duration || null,
        views,
        source: "hstream",
        orientation: null
      }));
    }
  });
  // Pagination: find last page
  let totalPages = 1;
  $('a[aria-label^="Go to page"]').each((_, el) => {
    const num = parseInt($(el).text().trim(), 10);
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });
  return { videos: results, totalPages };
}

// Search videos by query and page
export async function search(query, page = 1) {
  const url = `https://hstream.moe/search?search=${encodeURIComponent(query)}&page=${page}`;
  const { data } = await axios.get(url, { headers: HSTREAM_HEADERS });
  const $ = cheerio.load(data);
  const results = [];
  $('div.relative.p-1.mb-8.w-full').each((_, el) => {
    const a = $(el).find('a').first();
    const href = a.attr('href');
    const title = a.find('img').attr('alt') || a.find('p.text-sm').text().trim();
    const img = a.find('img').attr('src');
    const duration = a.find('p.absolute.right-2.top-2').text().trim() || null;
    // Views (bottom left, after the eye icon)
    let views = null;
    a.find('p.absolute.left-2.bottom-2').each((_, p) => {
      const text = $(p).text();
      const match = text.match(/(\d+(\.\d+)?[kM]?)/i);
      if (match) views = match[1];
    });
    if (href && title && img) {
      results.push(videojson({
        id: href.split('/').filter(Boolean).pop(),
        title,
        thumbnail: img.startsWith('http') ? img : `https://hstream.moe${img}`,
        url: href.startsWith('http') ? href : `https://hstream.moe${href}`,
        duration: duration || null,
        views,
        source: "hstream",
        orientation: null
      }));
    }
  });
  // Pagination
  let totalPages = 1;
  $('a[aria-label^="Go to page"]').each((_, el) => {
    const num = parseInt($(el).text().trim(), 10);
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });
  return { results, totalPages };
}

// Fetch featured videos (homepage)
export async function featured() {
  const url = 'https://hstream.moe/search?order=featured';
  const { data } = await axios.get(url, { headers: HSTREAM_HEADERS });
  const $ = cheerio.load(data);
  const results = [];
  $('div.relative.p-1.mb-8.w-full').each((_, el) => {
    const a = $(el).find('a').first();
    const href = a.attr('href');
    const title = a.find('img').attr('alt') || a.find('p.text-sm').text().trim();
    const img = a.find('img').attr('src');
    const duration = a.find('p.absolute.right-2.top-2').text().trim() || null;
    // Views (bottom left, after the eye icon)
    let views = null;
    a.find('p.absolute.left-2.bottom-2').each((_, p) => {
      const text = $(p).text();
      const match = text.match(/(\d+(\.\d+)?[kM]?)/i);
      if (match) views = match[1];
    });
    if (href && title && img) {
      results.push(videojson({
        id: href.split('/').filter(Boolean).pop(),
        title,
        thumbnail: img.startsWith('http') ? img : `https://hstream.moe${img}`,
        url: href.startsWith('http') ? href : `https://hstream.moe${href}`,
        duration,
        views: views ? views + ' views' : null,
        source: "hstream",
        orientation: null
      }));
    }
  });
  return results;
}

// Get video and subtitle URLs for a given video page
export async function getVidUrl(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders(HSTREAM_HEADERS);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Collect video sources
  const sources = await page.$$eval('video source', els =>
    els.map(el => ({
      url: el.src,
      quality: el.getAttribute('size')
    }))
  );
  // Sort by quality: 2160i/2161 > 2160 > 1080i/1081 > 1080 > 720
  const qualityOrder = ["2161", "2160i", "2160", "1081", "1080i", "1080", "720"];
  sources.sort((a, b) => {
    const aQ = String(a.quality);
    const bQ = String(b.quality);
    const aIdx = qualityOrder.indexOf(aQ);
    const bIdx = qualityOrder.indexOf(bQ);
    if (aIdx === -1 && bIdx === -1) return parseInt(bQ) - parseInt(aQ); // fallback: numeric
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Build video array
  let videoArr = [];
  for (const s of sources) {
    if (s.quality && s.url) {
      videoArr.push(videoArrJson({ quality: s.quality, url: s.url, source: "hstream" }));
    }
  }

  // Collect subtitles (.ass, .srt, .vtt)
  const assLinks = await page.$$eval('a[href$=".ass"],a[href$=".srt"],a[href$=".vtt"]', els =>
    els.map(el => ({
      href: el.href,
      text: el.textContent.trim().toLowerCase()
    }))
  );
  let subtitlesArr = [];
  for (const link of assLinks) {
    // Guess language (from text or href)
    let lang = "unknown";
    if (link.text.includes('english') || link.href.toLowerCase().includes('eng')) lang = "en";
    else if (link.text.includes('japan') || link.href.toLowerCase().includes('jpn')) lang = "jp";
    else if (link.text.includes('german') || link.href.toLowerCase().includes('ger')) lang = "de";
    else if (link.text.includes('spanish') || link.href.toLowerCase().includes('spa')) lang = "es";
    else if (link.text.includes('french') || link.href.toLowerCase().includes('fre')) lang = "fr";
    else if (link.text.includes('chinese') || link.href.toLowerCase().includes('chi')) lang = "ch";
    else if (link.text.includes('russian') || link.href.toLowerCase().includes('ru')) lang = "ru";
    else if (link.text.includes('hindi') || link.href.toLowerCase().includes('hin')) lang = "hi";
    else if (link.text.includes('portuguese') || link.href.toLowerCase().includes('pt')) lang = "pt";

    // Always use proxy for subtitles
    subtitlesArr.push(subtitlesArrJson({
      lang,
      label: lang,
      url: `${encodeURIComponent(link.href)}`
    }));
  }

  // Always put English first
  subtitlesArr.sort((a, b) => (a.lang === "en" ? -1 : b.lang === "en" ? 1 : 0));

  await browser.close();

  return { source: { videoArr, subtitlesArr } };
}

// No subtitle proxy/convert logic here! Handled globally in platformRouter.js

export const platformId = "hstream";
export const platformLabel = "hstream.moe";
export const platformComment = "Watch Hentai Streams Online - hstream.moe";
export const platformSettings = {};

// Returns platform info for platformRouter
export function getPlatformInfo() {
  return platformjson({
    id: platformId,
    label: platformLabel,
    comment: platformComment,
    settings: platformSettings
  });
}

// Proxy headers function
function getProxyHeaders(url, req) {
  if (url.includes('hstream.moe')) {
    return HSTREAM_HEADERS;
  }
  return {};
}

// Registers all routes for this platform
export function registerRoutes(app, basePath) {
  registerPlatformRoutes(app, basePath, {
    getCategories,
    getCategory,
    search,
    featured,
    getVidUrl,
    getProxyHeaders,
  });
}