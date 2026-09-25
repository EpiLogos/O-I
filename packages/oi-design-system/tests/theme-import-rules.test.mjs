import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {emitImportRules,themeVariables,themeImportRules} from '../scripts/convert.mjs';
import {THEMES} from '../themes/index.mjs';

test('kernel import rules are byte-exact producer output for the shipped theme catalogue',async()=>{
  assert.equal(await readFile(new URL('../themes/import-rules.json',import.meta.url),'utf8'),emitImportRules(THEMES));
});
test('all shipped chrome, syntax, terminal and shadow values fit the producer import contract',async()=>{
  const root=new URL('../themes/oi/',import.meta.url), rules=themeImportRules(THEMES);
  for(const file of (await readdir(root)).filter(file=>file.endsWith('.json'))) {
    const doc=JSON.parse(await readFile(new URL(file,root),'utf8'));
    assert.ok(rules.bundled_themes.some(theme=>theme.id===doc.id && theme.appearance===doc.appearance));
    for(const [role,value] of Object.entries(themeVariables(doc))) {
      assert.ok(rules.roles.includes(role),`${file}: ${role}`);
      if(role.startsWith('--oi-shadow-'))assert.ok(rules.shadow_values[role].includes(value),`${file}: ${role}`);
    }
  }
});
