import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(`${root}src-tauri/tauri.conf.json`, 'utf8'));
const policy = Object.entries(config.app.security.csp)
  .map(([directive, sources]) => `${directive} ${Array.isArray(sources) ? sources.join(' ') : sources}`)
  .join('; ');
const documents = ['index.html', ...(existsSync(`${root}dist/index.html`) ? ['dist/index.html'] : [])];

// Run the real bootstrap before the module can repair a missed prepaint theme.
// External module/style loading is outside this isolated policy check.
function bootstrapHtml(path, tampered = false) {
  const html = readFileSync(`${root}${path}`, 'utf8')
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');
  assert.match(html, /<script\b[^>]*>[\s\S]*oi-cradle\.visuals\.v1[\s\S]*?<\/script>/);
  return tampered ? html.replace('</script>', '\nwindow.__tamperedBootstrapRan = true;\n</script>') : html;
}

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.searchParams.get('built') === '1' ? 'dist/index.html' : 'index.html';
  response.writeHead(200, {'content-type': 'text/html', 'content-security-policy': policy});
  response.end(bootstrapHtml(path, url.searchParams.get('tampered') === '1'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
const cases = [
  {label: 'persisted dark overrides light system', saved: '{"theme":"dark"}', system: 'light', dark: true},
  {label: 'persisted light overrides dark system', saved: '{"theme":"light"}', system: 'dark', dark: false},
  {label: 'system preference resolves dark', saved: '{"theme":"system"}', system: 'dark', dark: true},
  {label: 'system preference resolves light', saved: '{"theme":"system"}', system: 'light', dark: false},
  {label: 'new profile follows dark system', saved: null, system: 'dark', dark: true},
  {label: 'corrupt persistence follows dark system', saved: '{', system: 'dark', dark: true},
  {label: 'completed opening keeps the selected ground', saved: '{"theme":"light"}', system: 'dark', dark: false, completed: true, opening: false},
  {label: 'disabled Expression keeps the selected ground', saved: '{"theme":"dark","enabled":false}', system: 'light', dark: true, opening: false},
  {label: 'disabled welcome keeps the selected ground', saved: '{"theme":"light","welcomeEnabled":false}', system: 'dark', dark: false, opening: false},
  {label: 'detached window skips the opening ground', saved: '{"theme":"dark"}', system: 'light', dark: true, detached: true, opening: false},
];
let passed = 0;
try {
  for (const document of documents) {
    for (const entry of cases) {
      const context = await browser.newContext({colorScheme: entry.system});
      try {
        await context.addInitScript(({saved, completed, detached}) => {
          if (saved === null) localStorage.removeItem('oi-cradle.visuals.v1');
          else localStorage.setItem('oi-cradle.visuals.v1', saved);
          if (completed) sessionStorage.setItem('oi-cradle.welcome.v1', '1');
          // Tauri's window initialization script sets this before HTML runs.
          if (detached) window.__OI_DETACHED__ = true;
          window.__prepaintPolicyViolations = [];
          addEventListener('securitypolicyviolation', event => {
            if (event.effectiveDirective === 'script-src-elem') window.__prepaintPolicyViolations.push(event.blockedURI);
          });
        }, entry);
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/?built=${Number(document.startsWith('dist/'))}`);
        const actual = await page.evaluate(() => ({dark: document.body.dataset.theme === 'dark', opening: document.body.dataset.oiOpening === 'true', saved: localStorage.getItem('oi-cradle.visuals.v1'), violations: window.__prepaintPolicyViolations}));
        assert.equal(actual.dark, entry.dark, `${document}: ${entry.label}`);
        assert.equal(actual.opening, entry.opening ?? true, `${document}: opening ground must match the real welcome admission gate`);
        assert.equal(actual.saved, entry.saved, `${document}: opening must not rewrite the saved appearance`);
        assert.deepEqual(actual.violations, [], `${document}: configured native CSP must permit the unchanged bootstrap`);
        passed++;
      } finally {await context.close();}
    }
    const context = await browser.newContext({colorScheme: 'light'});
    try {
      await context.addInitScript(() => localStorage.setItem('oi-cradle.visuals.v1', '{"theme":"dark"}'));
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/?built=${Number(document.startsWith('dist/'))}&tampered=1`);
      assert.equal(await page.evaluate(() => window.__tamperedBootstrapRan), undefined, 'altered inline bytes must still be refused');
      assert.notEqual(await page.getAttribute('body', 'data-theme'), 'dark', 'a rejected altered script does not execute the bootstrap');
      passed++;
    } finally {await context.close();}
  }
  console.log(`Native CSP prepaint: ${passed} browser-enforced cases passed across ${documents.join(', ')}; exact inline script allowed, altered script refused.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
