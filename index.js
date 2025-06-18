import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

const apiDir = path.join(process.cwd(), 'api');
const platformFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));

for (const file of platformFiles) {
  const platform = file.replace('.js', '');

  import(`./api/${file}`).then(module => {
    if (typeof module.registerRoutes === 'function') {
      module.registerRoutes(app, `/api/${platform}`);
    }
  });
}


app.get('/api/platforms', async (req, res) => {
  const platforms = await Promise.all(platformFiles.map(async f => {
    const id = f.replace('.js', '');
    const module = await import(`./api/${f}`);
    // Nutze getPlatformInfo, falls vorhanden
    if (typeof module.getPlatformInfo === 'function') {
      return module.getPlatformInfo();
    }
    // Fallback falls alt
    return {
      id,
      label: module.platformLabel || "",
      comment: module.platformComment || "",
      settings: null
    };
  }));
  res.json(platforms);
});

const PORT = process.env.PORT || 3001;
const interfaces = os.networkInterfaces();
let localIp = 'localhost';

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIp = iface.address;
      break;
    }
  }
}

app.listen(PORT, '0.0.0.0', () =>
  console.log(`API xpro-server running on:
  → http://0.0.0.0:${PORT}
  → http://${localIp}:${PORT}`)
);