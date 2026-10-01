// Starts Chrome (or Edge) without a window and drives it over the DevTools
// protocol. Used by shoot-pages.mjs, shoot-admin.mjs and print-pdf.mjs.
// Needs Node 22 or newer (for the built-in WebSocket).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function openBrowser({ timeoutMs = 300_000 } = {}) {
  const exe = BROWSERS.find((path) => path && existsSync(path));
  if (!exe) throw new Error('Chrome or Edge was not found. Install Google Chrome, or set CHROME to the browser\'s .exe file.');
  const profile = mkdtempSync(join(tmpdir(), 'pca-report-'));
  const port = 9300 + Math.floor(Math.random() * 600);
  const child = spawn(
    exe,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
      '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
    { stdio: 'ignore' },
  );
  let ws;
  const timer = setTimeout(() => {
    console.error('The browser did not finish in time.');
    child.kill();
    process.exit(2);
  }, timeoutMs);

  let targets = [];
  for (let i = 0; i < 75; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch {
      // Not listening yet.
    }
    await sleep(200);
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    child.kill();
    throw new Error('The browser did not start.');
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const listener of listeners) listener(msg);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject, method });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  const on = (listener) => listeners.add(listener);

  /** Runs JavaScript in the page and returns its (awaited) value. */
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(`In the page: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };

  /** Opens a URL and waits until it has loaded. */
  const navigate = async (url) => {
    const loaded = new Promise((resolve) => {
      const listener = (msg) => {
        if (msg.method === 'Page.loadEventFired') {
          listeners.delete(listener);
          resolve();
        }
      };
      on(listener);
    });
    const { errorText } = await send('Page.navigate', { url });
    if (errorText) throw new Error(`Could not open ${url}: ${errorText}`);
    await Promise.race([loaded, sleep(20_000)]);
  };

  const close = async () => {
    clearTimeout(timer);
    try {
      ws.close();
    } catch {
      // Already closed.
    }
    child.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // The browser may still hold a file; the folder is in the temp folder.
    }
  };

  await send('Page.enable');
  return { send, on, evaluate, navigate, close };
}

/** Runs `work(browser)`, then closes the browser, and ends the process. */
export async function withBrowser(work) {
  let browser;
  try {
    browser = await openBrowser();
    await work(browser);
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    await browser?.close();
    process.exit(1);
  }
}
