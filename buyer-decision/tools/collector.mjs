// Minimal event collector for buyer tests. Zero dependencies.
//   node tools/collector.mjs [port] [out.ndjson]
// Then set <meta name="ci-track-endpoint" content="http://<host>:<port>/e"> in app/index.html.
// It also serves the app at /app/index.html so one process covers a moderated test on a laptop or LAN.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = +(process.argv[2] || 8787);
const out = process.argv[3] || 'events.ndjson';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
const MAX = 16 * 1024;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'POST' && req.url === '/e') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > MAX) req.destroy(); });
    req.on('end', () => {
      try {
        const e = JSON.parse(body);
        if (typeof e.event !== 'string' || typeof e.session_id !== 'string') throw new Error('shape');
        e.received_at = new Date().toISOString();
        fs.appendFileSync(out, JSON.stringify(e) + '\n');
        res.writeHead(204); res.end();
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }
  if (req.method === 'GET') {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile() && !f.includes('node_modules')) {
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404); res.end();
}).listen(port, () => console.log(`collector on :${port} → ${out}; app at http://localhost:${port}/app/index.html`));
