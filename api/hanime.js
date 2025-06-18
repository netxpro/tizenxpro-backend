import axios from 'axios';
import crypto from 'crypto';
import UserAgent from 'fake-useragent';
import { videojson, formatViews } from '../utils/video.js';
import { categoryjson } from '../utils/category.js';
import { registerPlatformRoutes } from '../utils/platformRouter.js';
import { platformjson } from '../utils/platform.js';
import { videoArrJson, subtitlesArrJson } from '../utils/arr.js';

// Returns headers for Hanime API requests
function getApiHeaders() {
  return {
    'X-Signature-Version': 'web2',
    'X-Signature': crypto.randomBytes(32).toString('hex'),
    'User-Agent': new UserAgent().random,
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://hanime.tv/',
    'Origin': 'https://hanime.tv',
  };
}

// Fetch all categories from Hanime
export async function getCategories() {
  const url = 'https://hanime.tv/api/v8/browse';
  const { data } = await axios.get(url, { headers: getApiHeaders() });
  return (data.hentai_tags || []).map(tag =>
    categoryjson({
      id: tag.text,
      name: tag.text,
      image: tag.wide_image_url || tag.tall_image_url || null,
      description: tag.description || null,
      url: `/api/hanime/category?name=${encodeURIComponent(tag.text)}`,
      source: "hanime"
    })
  );
}

// Fetch videos for a category and page
export async function getCategory(category, page = 1) {
  const tagsUrl = 'https://hanime.tv/api/v8/browse';
  const { data: tagsData } = await axios.get(tagsUrl, { headers: getApiHeaders() });
  const tagObj = (tagsData.hentai_tags || []).find(
    t => t.text.toLowerCase() === category.toLowerCase()
  );
  if (!tagObj) {
    return { videos: [], totalPages: 1, orientation: null, notFound: true };
  }

  const tagApiUrl = `https://h.freeanimehentai.net/api/v8/browse/hentai-tags/${encodeURIComponent(tagObj.text)}?page=${page}&order_by=created_at_unix&ordering=desc`;
  const { data } = await axios.get(tagApiUrl, { headers: getApiHeaders() });
  const results = (data.hentai_videos || []).map(x =>
    videojson({
      id: x.id,
      title: x.name,
      thumbnail: x.poster_url,
      url: `https://hanime.tv/videos/hentai/${x.slug}`,
      duration: x.duration,
      views: formatViews(x.views),
      source: "hanime",
      orientation: null
    })
  );
  const totalPages = data.number_of_pages || 1;
  return { videos: results, totalPages, orientation: null };
}

// Search videos by query and page
export async function search(query, page = 1) {
  const url = 'https://search.htv-services.com/search';
  const body = {
    search_text: query,
    tags: [],
    tags_mode: "AND",
    brands: [],
    blacklist: [],
    order_by: "created_at_unix",
    ordering: "desc",
    page: page - 1,
  };
  const { data } = await axios.post(url, body, { headers: getApiHeaders() });

  let hits = [];
  if (typeof data.hits === "string") {
    try {
      hits = JSON.parse(data.hits);
    } catch (e) {
      hits = [];
    }
  } else if (Array.isArray(data.hits)) {
    hits = data.hits;
  }

  const results = hits.map(x =>
    videojson({
      id: x.id,
      title: x.name,
      thumbnail: x.poster_url || x.cover_url || null,
      url: `https://hanime.tv/videos/hentai/${x.slug}`,
      duration: null,
      views: formatViews(x.views),
      source: "hanime",
      orientation: null
    })
  );
  const totalPages = data.nbPages || Math.ceil((data.nbHits || 0) / (data.hitsPerPage || 24));
  return { results, totalPages };
}

// Fetch featured videos
export async function featured() {
  const url = `https://hanime.tv/api/v8/browse-trending?time=month&page=1&order_by=views&ordering=desc`;
  const { data } = await axios.get(url, { headers: getApiHeaders() });
  if (!data.hentai_videos) return [];
  return data.hentai_videos.map(x =>
    videojson({
      id: x.id,
      title: x.name,
      thumbnail: x.poster_url || x.cover_url || null,
      url: `https://hanime.tv/videos/hentai/${x.slug}`,
      duration: x.duration,
      views: formatViews(x.views),
      source: "hanime",
      orientation: null
    })
  );
}

// Get video and subtitle URLs for a given video page
export async function getVidUrl(url) {
  let slug = url;
  if (url.startsWith('http')) {
    const match = url.match(/\/videos\/hentai\/([^/?#]+)/);
    if (!match) return null;
    slug = match[1];
  }
  const apiUrl = `https://hanime.tv/api/v8/video?id=${slug}`;
  const { data } = await axios.get(apiUrl, { headers: getApiHeaders() });

  if (!data || !data.videos_manifest || !data.videos_manifest.servers) return null;

  // Collect video sources as array
  let videoArr = [];
  for (const server of data.videos_manifest.servers) {
    for (const stream of server.streams || []) {
      if (stream.url && stream.url.endsWith('.m3u8')) {
        let quality = stream.width ? String(stream.width) : null;
        const match = stream.url.match(/(\d{3,4})p/);
        if (!quality && match) quality = match[1];
        if (quality) videoArr.push({ quality, url: stream.url, source: "hanime" });
      }
    }
  }

  // Sort by quality (descending)
  videoArr.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
  videoArr = videoArr.map(videoArrJson);

  // Collect subtitles as array
  let subtitlesArr = [];
  if (data.hentai_video && Array.isArray(data.hentai_video.subtitles)) {
    subtitlesArr = data.hentai_video.subtitles
      .filter(sub => sub.url)
      .map(sub => subtitlesArrJson({
        lang: sub.language && sub.language.toLowerCase().startsWith('eng') ? 'en'
             : sub.language && sub.language.toLowerCase().startsWith('jap') ? 'jp'
             : sub.language && sub.language.toLowerCase().startsWith('chi') ? 'ch'
             : sub.language && sub.language.toLowerCase().startsWith('ger') ? 'de'
             : sub.language && sub.language.toLowerCase().startsWith('spa') ? 'es'
             : sub.language && sub.language.toLowerCase().startsWith('fre') ? 'fr'
             : sub.language && sub.language.toLowerCase().startsWith('por') ? 'pt'
             : sub.language && sub.language.toLowerCase().startsWith('rus') ? 'ru'
             : sub.language && sub.language.toLowerCase().startsWith('hin') ? 'hi'
             : 'unknown',
        label: sub.language,
        url: sub.url
      }));

    // Always put English first
    subtitlesArr.sort((a, b) => (a.lang === "en" ? -1 : b.lang === "en" ? 1 : 0));
  }

  return { source: { videoArr, subtitlesArr } };
}

// Proxy a video stream with default headers
export async function proxy(url, res) {
  try {
    const response = await axios.get(url, {
      headers: getApiHeaders(),
      responseType: 'stream',
      timeout: 15000
    });
    res.set({
      ...response.headers,
      'Access-Control-Allow-Origin': '*', // Allow CORS
    });
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy failed');
  }
}

function getProxyHeaders(url, req) {
  // Für alle Hanime-Server die speziellen Header setzen
  if (
    url.includes('hanime.tv') ||
    url.includes('htv-services.com') ||
    url.includes('freeanimehentai.net')
  ) {
    return getApiHeaders();
  }
  return {};
}

export const platformId = "hanime";
export const platformLabel = "hanime.tv";
export const platformComment = "Watch Free Hentai Video Streams Online in 720p, 1080p HD - hanime.tv";
export const platformSettings = { orientation: null };

// Returns platform info for platformRouter
export function getPlatformInfo() {
  return platformjson({
    id: platformId,
    label: platformLabel,
    comment: platformComment,
    settings: platformSettings
  });
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