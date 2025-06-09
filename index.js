import express from 'express';
import fs from 'fs';
import path from 'path';

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


app.get('/api/platforms', (req, res) => {
  const label = {
    xhamster: "xHamster",
    // TODO: Add more platform here
  };
  const comments = {
    xhamster: "Free Porn Videos & XXX Movies: Sex Videos Tube | xHamster",
    // TODO: Add more platform here
  };
  const platforms = platformFiles.map(f => {
    const id = f.replace('.js', '');
    return {
      id,
      label: label[id] || "",
      comment: comments[id] || ""
    };
  });
  res.json(platforms);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`API server running on http://0.0.0.0:${PORT}`)
);
