/** 02-ARCHITECTURE §12: no generic shell/filesystem/network/secret authority in the renderer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {files,registry,rendererAuthority,read,rustCode,rustRuntime} from './source.mjs';
const rules=registry('authority-registry');
test('Lane A §2: each renderer network/window seam is exact; privileged imports and new sites fail',()=>{
 const actual=files('src',/\.(?:ts|tsx|mjs)$/).flatMap(file=>rendererAuthority(file));
 assert.deepEqual(actual,rules.renderer.map(({rationale,spec_ref,debt_id,...site})=>site));
 for(const site of rules.renderer){assert.ok(site.rationale&&site.spec_ref);if(site.debt_id)assert.ok(registry('violation-baseline').debts.some(d=>d.id===site.debt_id));}
});
test('Lane A §2: all registered native commands have a bounded role',()=>{
 const code=rustCode(read('src-tauri/src/main.rs'));
 const registered=[...code.matchAll(/generate_handler!\s*\[([^\]]*)\]/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()).filter(Boolean)).sort();
 assert.ok(registered.length);assert.deepEqual(registered,rules.commands.map(r=>r.command).sort());
 for(const row of rules.commands)assert.ok(['kernel_op','presentation-lease','dialog','menu','window-lifecycle','diagnostics'].includes(row.classification)&&row.rationale&&row.spec_ref);
});
test('Lane A §2: native shell filesystem access is limited to its two declared host duties',()=>{
 const actual=files('src-tauri/src',/\.rs$/).flatMap(owner=>[...rustRuntime(read(owner)).matchAll(/(?:std::fs|tokio::fs|fs)::[A-Za-z_]+/g)].map(m=>({owner,operation:m[0]})));
 assert.deepEqual(actual,rules.filesystem.map(({rationale,spec_ref,...site})=>site));
 const imports=files('src-tauri/src',/\.rs$/).flatMap(file=>[...rustRuntime(read(file)).matchAll(/use\s+(?:std|tokio)::fs\b/g)].map(m=>`${file}:${m[0]}`));assert.deepEqual(imports,[],'new fs import/alias needs explicit owner review, not a scanner bypass');
});
test('the authority guard detects introduced direct egress, dynamic privileged imports and window mutation',()=>{
 for(const snippet of ['fetch("https://example.invalid")','new WebSocket("wss://example.invalid")','navigator.sendBeacon("/egress", data)','import("@tauri-apps/plugin-shell")','getCurrentWindow().setTitle("x")'])assert.ok(rendererAuthority('probe.ts',snippet).length,snippet);
 assert.deepEqual(rendererAuthority('probe.ts','// fetch("no")\nconst label="getCurrentWindow()";'),[]);
});
test('Lane E §6: renderer cannot invoke the decision provider outside the typed native facility',()=>{
 const findings=files('src',/\.(?:ts|tsx|mjs)$/).flatMap(file=>{const text=read(file);return /\bjev\s+invoke\b|["']jev["']\s*,\s*["']invoke["']/.test(text)?[file]:[];});assert.deepEqual(findings,[]);
});

test('Rust source scan preserves code around URL strings and excludes only test module bodies',()=>{
 const sample='const URL: &str = "https://example.invalid"; std::fs::read(path); #[cfg(test)] mod tests { fn scratch(){ std::fs::remove_dir_all(path); } }';
 assert.match(rustRuntime(sample),/std::fs::read/);assert.doesNotMatch(rustRuntime(sample),/remove_dir_all/);
});

test('Lane E §6: direct native decision-provider dispatch exists only in the bounded facility',()=>{
 const dispatch=text=>/\[\s*"jev"\s*,\s*"invoke"/.test(text)||/\bjev\s+invoke\b/.test(text);
 // Strip prose comments, retaining argv literals: a command mention in a
 // comment grants no authority, while aliases outside the owner need review.
 const runtime=text=>text.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
 const sites=files('kernel/src',/\.rs$/).filter(file=>dispatch(runtime(read(file))));
 assert.deepEqual(sites,['kernel/src/decision.rs']);
 assert.ok(dispatch('Command::new(owner).args(["jev", "invoke"])'));
 assert.ok(!dispatch('Command::new(owner).args(["status"])'));
});
