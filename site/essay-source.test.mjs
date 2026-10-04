import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { resolveEssaySource, readEssayInputs, stageEssayInputs, dedupeFrontmatter } from './essay-source.mjs';

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
    await writeFile(join(visual,'relation.md'),'# Relation\n![Relation](relation.svg)\n');await writeFile(join(visual,'relation.svg'),svg);
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
    assert.equal(inputs.foundationSlug,'section-rooms/00-integral-threshold/ROOM-00-integral-threshold');
    assert.match(inputs.inputSha256,/^[a-f0-9]{64}$/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('frontmatter keeps the last native source identity without touching prose',()=>{
  const prose='\n# Original authorial body\n';
  const input='---\nsource_id: original-import-uuid\ntitle: Source\nsource_id: admitted-source-slug\n---'+prose;
  const result=dedupeFrontmatter(input);
  assert.equal(result.changed,true);assert.equal(result.text,'---\ntitle: Source\nsource_id: admitted-source-slug\n---'+prose);
});
