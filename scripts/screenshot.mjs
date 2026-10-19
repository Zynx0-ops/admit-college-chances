// Captures README screenshots with Chrome's DevTools protocol (no dependencies).
// Usage: npm start   (in another terminal), then: node scripts/screenshot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const SHOTS = [
  { name: 'desktop-light', w: 1280, h: 820, mobile: false, url: '/?theme=light&major=cs' },
  { name: 'desktop-dark', w: 1280, h: 820, mobile: false, url: '/?theme=dark&major=cs' },
  { name: 'mobile-schools', w: 390, h: 844, mobile: true, url: '/?theme=light&major=cs' },
  { name: 'mobile-detail', w: 390, h: 844, mobile: true, url: '/?theme=light&major=cs&school=umich' },
  { name: 'mobile-profile', w: 390, h: 844, mobile: true, url: '/?theme=dark&tab=profile' },
];

const port = 9333;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'admit-shot-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    target = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    pending.get(msg.id)?.(msg.result);
  });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  for (const s of SHOTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: s.mobile });
    await send('Page.navigate', { url: BASE + s.url });
    await sleep(1800); // let entrance animations finish
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`docs/screenshots/${s.name}.png`, Buffer.from(data, 'base64'));
    console.log('saved', s.name);
  }
  ws.close();
} finally {
  chrome.kill();
}
