import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { symlink, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { resolveEssaySource, readEssayInputs, stageEssayInputs, dedupeFrontmatter, unlinkWithheldWikilinks, exactCaseWikilinks } from './essay-source.mjs';

test('a real cached Git source refreshes main and stages figures while withholding notes', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'essay-source-'));
  try {
    const remote=join(dir,'remote'),site=join(dir,'site');await mkdir(remote);await mkdir(site);
    const git=(...args)=>execFileSync('git',args,{cwd:remote,stdio:'pipe'}).toString().trim();
    git('init','-b','main');git('config','user.name','Essay Source Test');git('config','user.email','essay-source-test@example.invalid');
    const essay=join(remote,'submission-package/essay');await mkdir(join(essay,'section-rooms/00-integral-threshold'),{recursive:true});
    await writeFile(join(essay,'README.md'),'# Foundation\n');
    await writeFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'# §0/1\n');
    const visual=join(essay,'symbolon/matheme/diagrams');await mkdir(visual,{recursive:true});
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5"/></svg>\n';
    await writeFile(join(visual,'relation.md'),'# Relation\n![Relation](relation.svg)\nConsumer: [working draft](../../../../../working/s01/M05.md)\nInternal: [private ledger](../quilt/README.md)\nEncounter: [private author note](relation-NOTES.md)\nPublic: [foundation](../../../section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md)\n');await writeFile(join(visual,'relation.svg'),svg);
    await mkdir(join(essay,'symbolon/matheme/quilt'),{recursive:true});
    await writeFile(join(essay,'symbolon/matheme/quilt/README.md'),'Private ledger\n');
    await writeFile(join(visual,'relation-NOTES.md'),'Private author encounter\n');
    git('add','.');git('commit','-m','First actual essay source');
    const first=await resolveEssaySource({siteDirectory:site,candidates:[],remote,ref:'main'});
    await writeFile(join(essay,'README.md'),'# Updated Foundation\n');git('add','.');git('commit','-m','Second actual essay source');
    const second=await resolveEssaySource({siteDirectory:site,candidates:[],remote,ref:'main'});
    assert.notEqual(first.commit,second.commit);assert.equal(second.commit,git('rev-parse','HEAD'));
    const inputs=await readEssayInputs(second.essay),staged=join(dir,'staged');
    const result=await stageEssayInputs(inputs,staged);
    assert.equal(result.assets,1);assert.equal(await readFile(join(staged,'symbolon/matheme/diagrams/relation.svg'),'utf8'),svg);
    assert.equal(await readFile(join(staged,'index.md'),'utf8'),'# Updated Foundation\n');
    await assert.rejects(readFile(join(staged,'symbolon/matheme/diagrams/relation-NOTES.md')),{code:'ENOENT'});
    assert.equal((await readFile(join(staged,'symbolon/matheme/diagrams/relation.md'),'utf8')).includes('Consumer: working draft'),true);
    assert.equal((await readFile(join(staged,'symbolon/matheme/diagrams/relation.md'),'utf8')).includes('Internal: private ledger'),true);
    assert.equal((await readFile(join(staged,'symbolon/matheme/diagrams/relation.md'),'utf8')).includes('Encounter: private author note'),true);
    assert.equal((await readFile(join(staged,'symbolon/matheme/diagrams/relation.md'),'utf8')).includes('Public: [foundation]'),true);
    await assert.rejects(readFile(join(staged,'symbolon/matheme/quilt/README.md')),{code:'ENOENT'});
    assert.equal((await readFile(join(visual,'relation.md'),'utf8')).includes('[working draft]'),true);
    assert.equal((await readFile(join(visual,'relation.md'),'utf8')).includes('[private ledger]'),true);
    assert.equal(inputs.foundationSlug,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold');
    assert.match(inputs.inputSha256,/^[a-f0-9]{64}$/);
    git('checkout','--detach','HEAD');
    const detached = await resolveEssaySource({siteDirectory:site,candidates:[remote],remote,ref:'main'});
    assert.equal(detached.ref,detached.commit); // never label an explicit pinned snapshot as canonical main
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('frontmatter keeps the last native source identity without touching prose',()=>{
  const prose='\n# Original authorial body\n';
  const input='---\nsource_id: original-import-uuid\ntitle: Source\nsource_id: admitted-source-slug\n---'+prose;
  const result=dedupeFrontmatter(input);
  assert.equal(result.changed,true);assert.equal(result.text,'---\ntitle: Source\nsource_id: admitted-source-slug\n---'+prose);
});

test('raster images publish from an images/ folder beside the record that cites them; nothing else rides along', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'essay-images-'));
  try {
    const essay = join(dir, 'submission-package/essay');
    await mkdir(join(essay, 'section-rooms/00-integral-threshold'), { recursive: true });
    await writeFile(join(essay, 'README.md'), '# Foundation\n');
    await writeFile(join(essay, 'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'), '# §0/1\n');
    const record = join(essay, 'symbolon/mytheme/worlds/hellenic/ares');
    await mkdir(join(record, 'images'), { recursive: true });
    await writeFile(join(record, 'WHOLE.md'), '# Ares\n\n![A painting](images/ares.jpg)\n');
    await writeFile(join(record, 'images/ares.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await writeFile(join(record, 'images/ares.gen.py'), 'print("generator")\n');
    await writeFile(join(record, 'stray.png'), Buffer.from([1, 2, 3]));
    await mkdir(join(essay, 'working/images'), { recursive: true });
    await writeFile(join(essay, 'working/images/draft.png'), Buffer.from([1]));
    const inputs = await readEssayInputs(essay);
    const assets = inputs.entries.filter((e) => e.kind === 'asset').map((e) => e.rel);
    assert.deepEqual(assets, ['symbolon/mytheme/worlds/hellenic/ares/images/ares.jpg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('wikilinks into withheld desks become labels at staging, like markdown links; everything else is left alone',()=>{
  const names={ withheldNames:new Set(['agentworld-response-matrix','secret note','both']),publishedNames:new Set(['both','public note']) };
  const out=unlinkWithheldWikilinks([
    'quilt: [[quilt/27-07-26-QUILTING]] and [[symbolon/matheme/quilt/README|the ledger]] and ![[quilt/figure]]',
    'working: [[working/sources/Paper-One#intro|Paper One]] [[../../working/x.md]]',
    'other desks: [[reference-notes/antikythera-mechanism]] [[private/a]] [[templates/t]]',
    'table escape: [[quilt/q\\|shown]]',
    'bare: [[agentworld-response-matrix|the matrix]] [[Secret Note]] [[Public Note]] [[Both]]',
    'fragment with code: [[quilt/27-07-26-Q#17. The `25 -> 36` gnomon|the cross-reading]] and `[[quilt/x]]` inline',
    'kept: [[section-rooms/03-two-logics/ROOM]] [[A bare title]] [[quilt]] [[symbolon/episteme/etymologies/x/WHOLE-FIELD]] [[Sym-Ballein#frag|alias]]',
    'code is untouched: `[[quilt/in-code]]`',
    '```\n[[working/in-fence]]\n```',
  ].join('\n'),names);
  assert.match(out,/^bare: the matrix Secret Note \[\[Public Note\]\] \[\[Both\]\]$/m);
  assert.match(out,/^quilt: 27-07-26-QUILTING and the ledger and figure$/m);
  assert.match(out,/^working: Paper One x$/m);
  assert.match(out,/^other desks: antikythera-mechanism a t$/m);
  assert.match(out,/^table escape: shown$/m);
  assert.match(out,/^fragment with code: the cross-reading and `\[\[quilt\/x\]\]` inline$/m);
  assert.match(out,/^kept: \[\[section-rooms\/03-two-logics\/ROOM\]\] \[\[A bare title\]\] \[\[quilt\]\] \[\[symbolon\/episteme\/etymologies\/x\/WHOLE-FIELD\]\] \[\[Sym-Ballein#frag\|alias\]\]$/m);
  assert.match(out,/`\[\[quilt\/in-code\]\]`/);
  assert.match(out,/\[\[working\/in-fence\]\]/);
});

test('staging unlinks withheld wikilinks in the written page and leaves the source bytes alone',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'essay-wikilink-'));
  try {
    const essay=join(dir,'submission-package/essay');await mkdir(join(essay,'section-rooms/00-integral-threshold'),{recursive:true});
    await writeFile(join(essay,'README.md'),'# Foundation\n');
    await writeFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'# §0/1\nSee [[quilt/ledger|a ledger]] and [[README]], [[ledger-bare]], [[AUTHORIAL-TEXT]], [[a-private-NOTES]], [[no-such-note]].\n');
    await mkdir(join(essay,'quilt'),{recursive:true});await writeFile(join(essay,'quilt/ledger-bare.md'),'private\n');
    await writeFile(join(essay,'a-private-NOTES.md'),'private\n');
    await symlink('../../../working/paper.md',join(essay,'AUTHORIAL-TEXT.md'));
    const inputs=await readEssayInputs(essay),staged=join(dir,'staged');
    await stageEssayInputs(inputs,staged);
    assert.equal(await readFile(join(staged,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'utf8'),'# §0/1\nSee a ledger and [[README]], ledger-bare, AUTHORIAL-TEXT, a-private-NOTES, [[no-such-note]].\n');
    assert.equal((await readFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'utf8')).includes('[[quilt/ledger|a ledger]]'),true);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('markdown links into withheld desks are unlinked in the angle-bracket and %-escaped forms too',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'essay-angle-'));
  try {
    const essay=join(dir,'submission-package/essay');await mkdir(join(essay,'section-rooms/00-integral-threshold'),{recursive:true});
    await writeFile(join(essay,'README.md'),'# Foundation\n');
    await writeFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'# §0/1\n[Advent manuscript](<../../../working/papers/The Advent — Subject.md>) [Brief](../../../working/a%20b/Brief.md) [Root](../../README.md) [Quilt](<../../quilt/led ger.md#x>)\n');
    const inputs=await readEssayInputs(essay),staged=join(dir,'staged');await stageEssayInputs(inputs,staged);
    assert.equal(await readFile(join(staged,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'utf8'),'# §0/1\nAdvent manuscript Brief [Root](../../README.md) Quilt\n');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('a wikilink that differs from one published note only in case is written with the exact name and keeps what the reader saw',()=>{
  const ctx={
    publishedByLowerName:new Map([['parasociety',['parasociety']],['j-space',['J-Space']],['twin',['Twin','TWIN']],['exact',['exact']]]),
    publishedByLowerPath:new Map([['section-rooms/arguments/concepts/j-space',['section-rooms/arguments/concepts/J-Space']]]),
  };
  const out=exactCaseWikilinks([
    'alias: [[Parasociety|parasocial]] bare: [[Parasociety]] fragment: [[j-space#Part One|the J]] escaped: [[J-space\\|shown]]',
    'path: [[section-rooms/arguments/concepts/j-SPACE|J-Space]] embed: ![[Parasociety]]',
    'left alone: [[parasociety]] [[exact]] [[Twin]] [[twin]] [[unknown note]] `[[Parasociety]]`',
    '```\n[[Parasociety]]\n```',
  ].join('\n'),ctx);
  assert.match(out,/^alias: \[\[parasociety\|parasocial\]\] bare: \[\[parasociety\|Parasociety\]\] fragment: \[\[J-Space#Part One\|the J\]\] escaped: \[\[J-Space\\\|shown\]\]$/m);
  assert.match(out,/^path: \[\[section-rooms\/arguments\/concepts\/J-Space\|J-Space\]\] embed: !\[\[parasociety\|Parasociety\]\]$/m);
  assert.match(out,/^left alone: \[\[parasociety\]\] \[\[exact\]\] \[\[Twin\]\] \[\[twin\]\] \[\[unknown note\]\] `\[\[Parasociety\]\]`$/m);
  assert.match(out,/```\n\[\[Parasociety\]\]\n```/);
});

test('staging writes the exact-case wikilink and leaves the source bytes alone',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'essay-case-'));
  try {
    const essay=join(dir,'submission-package/essay');await mkdir(join(essay,'section-rooms/00-integral-threshold'),{recursive:true});await mkdir(join(essay,'section-rooms/arguments/concepts'),{recursive:true});
    await writeFile(join(essay,'README.md'),'# Foundation\n');
    await writeFile(join(essay,'section-rooms/arguments/concepts/parasociety.md'),'# Parasociety\n');
    const source='# §0/1\nSee [[Parasociety|the double]] and [[Parasociety]].\n';
    await writeFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),source);
    const inputs=await readEssayInputs(essay),staged=join(dir,'staged');await stageEssayInputs(inputs,staged);
    assert.equal(await readFile(join(staged,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'utf8'),'# §0/1\nSee [[parasociety|the double]] and [[parasociety|Parasociety]].\n');
    assert.equal(await readFile(join(essay,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'),'utf8'),source);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('the essay edition does not turn prose #tags into links to tag pages it does not emit',async()=>{
  const config=await readFile(new URL('./vendor/quartz/quartz.config.ts',import.meta.url),'utf8');
  assert.match(config,/Plugin\.ObsidianFlavoredMarkdown\(\{[^}]*parseTags:\s*false[^}]*\}\)/);
});
