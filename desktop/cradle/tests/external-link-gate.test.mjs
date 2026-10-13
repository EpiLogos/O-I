// Review-5 #1/#3: the one https gate both hosts use before the Tauri opener.
import test from 'node:test';
import assert from 'node:assert/strict';
import {externalHttpsUrl} from '../src/shared/externalLink.ts';

test('only well-formed https URLs without credentials pass, at most 2048 characters', () => {
  assert.equal(externalHttpsUrl('https://example.org/a?b=1'), 'https://example.org/a?b=1');
  for (const bad of ['http://example.org', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'https://user:pw@example.org', 'https://real.example@evil.example/', 'not a url', 42, null, 'https://x.org/' + 'a'.repeat(2048)]) {
    assert.equal(externalHttpsUrl(bad), null, String(bad).slice(0, 40));
  }
});
