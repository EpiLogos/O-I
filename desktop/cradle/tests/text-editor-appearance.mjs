import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const document = readFileSync(new URL('../../../docs/cradle/01-DESIGN.md', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/editor/TextEditor.tsx', import.meta.url), 'utf8');
const server = await createServer({root, appType: 'custom', server: {host: '127.0.0.1', port: 0}, logLevel: 'error'});
server.middlewares.use('/editor-appearance', async (_, response) => {
  response.setHeader('content-type', 'text/html');
  response.end(await server.transformIndexHtml('/editor-appearance', '<body class="oi-desktop"><div id="root" style="height:950px;display:flex"></div><script type="module" src="/tests/text-editor-page.tsx"></script></body>'));
});
await server.listen();
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1100, height: 1050}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];

function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/editor-appearance`);
  await page.waitForFunction(() => window.editorAppearance);
  await page.evaluate(value => editorAppearance.render(value, '01-DESIGN.md'), document);
  await page.getByRole('textbox', {name: 'Source text'}).waitFor();
  await page.waitForFunction(() => [...window.document.querySelectorAll('.cm-content span')].some(span => span.textContent === '02-ARCHITECTURE.md'));
  await page.evaluate(() => {window.originalEditor = window.document.querySelector('.cm-editor');});

  for (const theme of ['light', 'dark', 'light']) {
    await page.evaluate(theme => {window.document.body.dataset.theme = theme;}, theme);
    const measured = await page.evaluate(() => {
      const editor = window.document.querySelector('.cm-editor');
      const spans = [...editor.querySelectorAll('.cm-content span')];
      const links = spans.filter(span => span.textContent === '02-ARCHITECTURE.md').map(span => ({
        color: getComputedStyle(span).color,
        decoration: getComputedStyle(span).textDecorationLine,
      }));
      return {links, background: getComputedStyle(editor).backgroundColor, sameEditor: editor === window.originalEditor,
        bold: spans.some(span => Number(getComputedStyle(span).fontWeight) >= 700),
        italic: spans.some(span => getComputedStyle(span).fontStyle === 'italic')};
    });
    assert.equal(measured.sameEditor, true, 'theme changes retain the editor and its state');
    assert.ok(measured.links.length >= 2, 'both Markdown label and URL are highlighted');
    assert.equal(measured.bold, true, 'Markdown heading/strong emphasis remains represented');
    assert.equal(measured.italic, true, 'Markdown emphasis remains represented');
    for (const link of measured.links) {
      const ratio = contrast(link.color, measured.background);
      assert.ok(ratio >= 4.5, `${theme}: source link contrast ${ratio.toFixed(2)} must meet 4.5:1`);
      assert.ok(link.decoration.includes('underline'), 'source links retain an underline');
      results.push({theme, color: link.color, background: measured.background, contrast: Number(ratio.toFixed(2))});
    }
  }

  await page.evaluate(source => editorAppearance.render(source, 'TextEditor.tsx'), source);
  await page.waitForFunction(() => window.document.querySelector('.text-editor-host').__oiDocument().startsWith('import'));
  const code = [];
  for (const theme of ['light', 'dark']) {
    const measured = await page.evaluate(theme => {
      window.document.body.dataset.theme = theme;
      const spans = [...window.document.querySelectorAll('.cm-content span')];
      const keyword = spans.find(span => span.textContent === 'import');
      const string = spans.find(span => span.textContent === '"react"');
      return {theme, keyword: keyword && getComputedStyle(keyword).color, string: string && getComputedStyle(string).color,
        background: getComputedStyle(window.document.querySelector('.cm-editor')).backgroundColor};
    }, theme);
    assert.ok(measured.keyword && measured.string, 'switching filename retains JavaScript keyword and string highlighting');
    assert.ok(contrast(measured.keyword, measured.background) >= 4.5);
    assert.ok(contrast(measured.string, measured.background) >= 4.5);
    code.push(measured);
  }
  await page.getByRole('textbox', {name: 'Source text'}).press('Control+Home');
  await page.keyboard.type('// verified editing\n');
  await page.waitForFunction(() => editorAppearance.changes.length > 0);
  assert.match(await page.evaluate(() => editorAppearance.changes.at(-1)), /verified editing/);

  await page.emulateMedia({forcedColors: 'active'});
  const forced = await page.getByRole('textbox', {name: 'Source text'}).evaluate(element => ({
    color: getComputedStyle(element).color,
    background: getComputedStyle(element.closest('.cm-editor')).backgroundColor,
  }));
  assert.ok(contrast(forced.color, forced.background) >= 4.5, 'forced colours preserve readable source text');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({check: 'real TextEditor appearance', links: results, code, forcedColors: forced, editing: 'passed'}, null, 2));
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
