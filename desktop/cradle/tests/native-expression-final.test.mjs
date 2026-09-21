import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const policy = JSON.parse(readFileSync(`${root}src-tauri/tauri.conf.json`, 'utf8')).app.security.csp;
const hash = code => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
for (const document of ['index.html', ...(existsSync(`${root}dist/index.html`) ? ['dist/index.html'] : [])]) {
  test(`${document}: native CSP admits exact bootstrap bytes, not changed code`, () => {
    const scripts = [...readFileSync(`${root}${document}`, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes, code]) => !/\bsrc\s*=/i.test(attributes) && code.trim());
    assert.ok(scripts.length > 0, 'a missing bootstrap must not silently pass');
    const allowed = String(policy['script-src']).split(/\s+/);
    assert.ok(!allowed.includes("'unsafe-inline'") && !allowed.includes("'unsafe-eval'"));
    for (const [, , code] of scripts) {
      assert.ok(allowed.includes(hash(code)), `CSP hash must match ${document}'s exact inline bytes`);
      assert.ok(!allowed.includes(hash(`${code}\nwindow.__tamperedBootstrapRan=true;`)), 'changed code requires explicit review');
    }
  });
}
