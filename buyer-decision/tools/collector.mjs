// Buyer-test server: serves the app, records funnel events, shows live KPIs. Zero dependencies.
//   node tools/collector.mjs [port] [events.ndjson]
// Prints the links to give testers. If `cloudflared` is installed, also opens a public https link.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = +(process.argv[2] || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[3] || path.join(root, 'events.ndjson'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
const MAX = 16 * 1024;
const quiet = process.env.CI_QUIET === '1';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  const url = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'POST' && url === '/e') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > MAX) req.destroy(); });
    req.on('end', () => {
      try {
        const e = JSON.parse(body);
        if (typeof e.event !== 'string' || typeof e.session_id !== 'string') throw new Error('shape');
        e.received_at = new Date().toISOString();
        fs.appendFileSync(out, JSON.stringify(e) + '\n');
        if (!quiet && ['fmc_start', 'result_view', 'feedback_answer', 'feedback_text'].includes(e.event))
          console.log(`${e.received_at.slice(11, 19)}  ${e.session_id.slice(0, 6)}  ${e.lang}  ${e.event}  ${e.props.hero_id || e.props.helped || ''}`);
        res.writeHead(204); res.end();
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }
  if (req.method === 'GET' && (url === '/' || url === '/start')) { res.writeHead(302, { location: '/app/index.html' }); return res.end(); }
  if (req.method === 'GET' && url === '/kpi') {
    let text = 'No events yet.';
    if (fs.existsSync(out)) { try { text = execFileSync(process.execPath, [path.join(root, 'tools/kpi_report.mjs'), out], { encoding: 'utf8' }); } catch (err) { text = String(err.stdout || err); } }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', refresh: '15' });
    return res.end(text);
  }
  if (req.method === 'GET' && url === '/events.ndjson' && fs.existsSync(out)) { res.writeHead(200, { 'content-type': 'application/x-ndjson' }); return fs.createReadStream(out).pipe(res); }
  if (req.method === 'GET') {
    const f = path.join(root, decodeURIComponent(url));
    if (f.startsWith(root + path.sep) && /^(app|data)[\\/]/.test(path.relative(root, f)) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404); res.end();
});

server.listen(port, '0.0.0.0', () => {
  if (quiet) return;
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\nCarIndex buyer test is running. Keep this window open.\n');
  console.log(`  On this computer:        http://localhost:${port}/`);
  lan.forEach(ip => console.log(`  Phones on the same Wi-Fi: http://${ip}:${port}/        (Arabic: add ?lang=ar)`));
  console.log(`  Live KPIs:               http://localhost:${port}/kpi`);
  console.log(`  Events file:             ${out}\n`);
  const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  cf.on('error', () => console.log('  (For testers outside this Wi-Fi, install cloudflared and restart: a public https link will appear here.)\n'));
  cf.stderr.on('data', d => { const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) console.log(`  PUBLIC LINK for any tester: ${m[0]}/\n`); });
  process.on('exit', () => cf.kill());
  process.on('SIGINT', () => process.exit(0));
});
