import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['next', 'start', '-p', '3300'], { env: { ...process.env, CI_ENV: 'preview' } });
await new Promise(r => setTimeout(r, 4000));
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 1800 } })).newPage();
await p.goto('http://localhost:3300/en/cars/hyundai-tucson'); await p.screenshot({ path: 'test-results/tucson.png' });
await p.goto('http://localhost:3300/ar/market'); await p.locator('#changes').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'test-results/market-ar.png' });
await b.close(); srv.kill();
