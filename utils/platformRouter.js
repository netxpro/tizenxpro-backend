import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

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
      res.status(500).json({ error: 'Internal server error' + err });
    }
  });

  // Proxy handler for both variants
  app.get(`${basePath}/proxy`, async (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return next();
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

// Proxy/Converter
async function handleProxy(targetUrl, req, res, basePath, platformApi) {
  const getHeaders = platformApi.getProxyHeaders || (() => ({}));
  const customHeaders = getHeaders(targetUrl, req) || {};

  // convert: .ass, .ssa, .srt → .vtt
  if (targetUrl.match(/\.(ass|ssa|srt)($|\?)/i)) {
    try {
      const { data } = await axios.get(targetUrl, { responseType: 'arraybuffer', headers: customHeaders });
      const tmpDir = os.tmpdir();
      const ext = (targetUrl.match(/\.(ass|ssa|srt)/i) || [])[1] || 'ass';
      const subPath = path.join(tmpDir, `sub_${Date.now()}.${ext}`);
      const vttPath = path.join(tmpDir, `sub_${Date.now()}.vtt`);
      await fs.writeFile(subPath, Buffer.from(data));

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', subPath,
          vttPath
        ]);
        ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg failed')));
      });

      const vtt = await fs.readFile(vttPath, 'utf-8');
      
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="subtitle.vtt"');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.send(vtt);

      await fs.unlink(subPath).catch(() => {});
      await fs.unlink(vttPath).catch(() => {});
      return;
    } catch (err) {
      console.error('ffmpeg subtitle conversion failed:', err);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.status(500).send('Subtitle conversion failed');
      return;
    }
  }

  // .vtt
  if (targetUrl.match(/\.vtt($|\?)/i)) {
    try {
      const response = await axios.get(targetUrl, { responseType: 'stream', headers: customHeaders });
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      response.data.pipe(res);
    } catch (err) {
      console.error('Proxy failed for:', targetUrl, err?.response?.status, err?.message);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');


      res.status(500).send('Proxy failed');
    }
    return;
  }

  // Manifest proxy logic (unchanged)
  if (/\.(m3u8|mpd)(\?|$)/.test(targetUrl)) {
    try {
      const axiosResponse = await axios.get(targetUrl, { responseType: 'text', headers: customHeaders });
      let manifestText = axiosResponse.data;
      const baseUrl = targetUrl.replace(/\/[^\/?#]+$/, '/');

      manifestText = manifestText.replace(
        /^([^\s#][^\s?]*\.[a-z0-9]+(\?[^\s]*)?)$/gim,
        (match) => {
          if (match.startsWith('http')) return match;
          return new URL(match, baseUrl).href;
        }
      );

      manifestText = manifestText.replace(
        /(#EXT-X-MAP:URI=")([^"]+)"/g,
        (full, prefix, uri) => {
          let abs = uri;
          if (!abs.startsWith('http')) abs = new URL(uri, baseUrl).href;
          return `${prefix}${basePath}/proxy?url=${encodeURIComponent(abs)}"`;
        }
      );

      manifestText = manifestText.replace(
        /(https?:\/\/[^\s"']+\.[a-z0-9]+(\?[^\s"']*)?)/gim,
        (match) => {
          if (match.includes(`${basePath}/proxy?url=`)) return match;
          return `${basePath}/proxy?url=${encodeURIComponent(match)}`;
        }
      );

      if (/\.mpd(\?|$)/.test(targetUrl)) {
        manifestText = manifestText.replace(
          /(initialization|media)="([^"]+)"/g,
          (full, attr, val) => {
            let abs = val;
            if (!abs.startsWith('http')) abs = new URL(val, baseUrl).href;
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
      res.setHeader('Access-Control-Allow-Origin', '*');

      res.status(500).send('Proxy failed');
    }
    return;
  }

  // Default: stream
  try {
    const response = await axios.get(targetUrl, { responseType: 'stream', headers: customHeaders });
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.data.pipe(res);
  } catch (err) {
    console.error('Proxy failed for:', targetUrl, err?.response?.status, err?.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).send('Proxy failed');
  }
}