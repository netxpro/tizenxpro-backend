import axios from 'axios';
import crypto from 'crypto';
import UserAgent from 'fake-useragent';
import { videojson } from '../utils/video.js';
import { categoryjson } from '../utils/category.js';
import { registerPlatformRoutes } from '../utils/platformRouter.js';
import { platformjson } from '../utils/platform.js';

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
      views: x.views,
      source: "hanime",
      orientation: null
    })
  );
  const totalPages = data.number_of_pages || 1;
  return { videos: results, totalPages, orientation: null };
}

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
      views: x.views,
      source: "hanime",
      orientation: null
    })
  );
  const totalPages = data.nbPages || Math.ceil((data.nbHits || 0) / (data.hitsPerPage || 24));
  return { results, totalPages };
}

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
      views: x.views,
      source: "hanime",
      orientation: null
    })
  );
}

export async function getVidUrl(url) {
  let slug = url;
  if (url.startsWith('http')) {
    const match = url.match(/\/videos\/hentai\/([^/?#]+)/);
    if (!match) return null;
    slug = match[1];
  }
  const apiUrl = `https://hanime.tv/api/v8/video?id=${slug}`;
  const { data } = await axios.get(apiUrl, { headers: getApiHeaders() });

  if (
    !data ||
    !data.videos_manifest ||
    !data.videos_manifest.servers ||
    !Array.isArray(data.videos_manifest.servers)
  ) return null;

  let m3u8Streams = [];
  for (const server of data.videos_manifest.servers) {
    for (const stream of server.streams || []) {
      if (stream.url && stream.url.endsWith('.m3u8')) {
        m3u8Streams.push({
          width: stream.width || 0,
          height: stream.height || 0,
          url: stream.url
        });
      }
    }
  }

  if (m3u8Streams.length === 0) return null;
  m3u8Streams.sort((a, b) => (b.width || 0) - (a.width || 0));
  const best = m3u8Streams.find(s => s.url) || m3u8Streams[0];

  return best.url || null;
}

// 6. Proxy
export async function proxy(url, res) {
  try {
    const response = await axios.get(url, {
      headers: getApiHeaders(),
      responseType: 'stream',
      timeout: 15000
    });
    res.set(response.headers);
    response.data.pipe(res);
  } catch (err) {
    console.error('Proxy segment failed:', url, err?.code, err?.message);
    if (err.code === 'ECONNABORTED') {
      res.status(504).send('Gateway Timeout');
    } else if (err.response) {
      res.status(err.response.status).send('Upstream error');
    } else {
      res.status(500).send('Proxy failed');
    }
  }
}

export const platformId = "hanime";
export const platformLabel = "hanime.tv";
export const platformComment = "Watch Free Hentai Video Streams Online in 720p, 1080p HD - hanime.tv";
export const platformSettings = { orientation: null };

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