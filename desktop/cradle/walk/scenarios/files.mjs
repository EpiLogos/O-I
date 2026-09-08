import {setup as sourceSetup} from './editor.mjs';
import {writeFileSync,mkdirSync,existsSync,readFileSync,unlinkSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
export async function setup(args) {
  const p=await sourceSetup(args);
  mkdirSync(join(p.root,'Work/Other/src'));
  const path='Work/Other/src/ordinary.ts',content='export const actualOwnerFile = "Central native bytes";\n';
  writeFileSync(join(p.root,path),content);
  writeFileSync(join(p.root,'root-note.md'),'An actual root file.\n');
  symlinkSync('/etc/passwd',join(p.root,'Work/Other/outside'));
  return {...p,path,content};
}
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl);await channel('info');
  const nav=page.getByRole('complementary',{name:'World navigator'});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
  check(await nav.getByRole('button',{name:'Other: chats and tasks',exact:true}).getAttribute('aria-pressed')==='true','An unvisited project defaults to chats and tasks');
  check(await page.locator('.desktop-bar').count()===0,'No web-rendered app menu or extra topbar row');
  check(await page.getByRole('button',{name:/^(Toggle|Collapse) left region$/}).count()===1,'Visible chrome offers exactly one left-panel control');
  const authored=p.sources[0];
  await nav.locator(`[data-file-path="Work/Editor/${authored.binding.path}"]`).click();
  const draft='Unsaved native authored source remains here.\n';
  await page.locator('.source-editor .source-textarea').fill(draft);
  const arrangement=(await channel('read.layout')).data.layout;
  check(Object.keys(arrangement.surfaces).length>0&&arrangement.root!==null,'Arrangement evidence reads the actual mounted authored surface');
  await nav.locator('[data-project-path="Work/Other"]').click();
  if(await page.getByRole('button',{name:'Other: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Other: files',exact:true}).click();
  check(JSON.stringify((await channel('read.layout')).data.layout.root)===JSON.stringify(arrangement.root),'Project browsing preserves the app-wide pane arrangement');
  await nav.getByRole('button',{name:'Expand folder src',exact:true}).click();
  await nav.locator(`[data-file-path="${p.path}"]`).click();
  const reading=page.getByRole('textbox',{name:/^(Reading|Editing) ordinary\.ts$/});
  await reading.waitFor();
  check(await reading.inputValue()===p.content,'Ordinary project file displays exact native owner bytes');
  await page.getByRole('button',{name:'Toggle right region',exact:true}).click();
  // Owner correction (FND-02): the right layer is the accompanying agent; the
  // subject's History is a disclosure inside its Context plane, present only
  // when the owner exposes a history operation.
  await page.getByRole('navigation',{name:'Right region planes'}).getByRole('button',{name:'Context',exact:true}).click();
  const agentLayer=page.getByRole('region',{name:'Accompanying agent'});
  await agentLayer.locator('details.agent-section summary',{hasText:'History'}).click();
  await page.getByRole('region',{name:'Central file history'}).getByText('No changes recorded by Central.',{exact:true}).waitFor();
  check(true,'Ordinary-file History renders its actual empty native history, never source context');
  check(await agentLayer.locator('.source-history').count()===0,'Previous subject history is absent for an ordinary file');
  await page.getByRole('button',{name:'Collapse right region',exact:true}).click();
  await nav.getByRole('button',{name:'Other: chats and tasks',exact:true}).click();
  check(await reading.inputValue()===p.content,'Project mode changes retain the active surface');
  await nav.getByRole('button',{name:'Other: files',exact:true}).click();
  check(await reading.getAttribute('readonly')===null,'Ordinary-file editing follows the available native write operation');
  check(!existsSync(join(p.root,'Work/Other/ProjectCentral')),'Browsing and opening an ordinary project never adopts it');
  check(await nav.locator('[data-file-path="Work/Other/outside"]').isDisabled(),'Symlink is visible but cannot escape the owner root');
  const focus=(await channel('read.focus')).data;
  check(focus.subject?.kind==='file'&&!focus.project,'Owner file focus clears stale project authority without inventing adoption');
  await page.locator('.tab').filter({hasText:authored.binding.path.split('/').pop()}).click();
  check(await page.locator('.source-editor .source-textarea').inputValue()===draft,'Native ordinary-file browsing retains the dirty authored source');
  await page.locator('.tab').filter({hasText:'ordinary.ts'}).click();
  await page.keyboard.press('Meta+w');await page.keyboard.press('Meta+Shift+t');
  await reading.waitFor();
  check(await reading.inputValue()===p.content,'Close and reopen revalidate the same native location');
  await page.reload();await channel('info');await reading.waitFor();
  check(await reading.inputValue()===p.content,'Saved file bindings restore through Central');
  check(await nav.getByRole('button',{name:'Other: files',exact:true}).getAttribute('aria-pressed')==='true','Workspace restore retains the directory Files mode without minting a ProjectRef');
  writeFileSync(join(p.root,p.path),'External native update.\n');
  await page.getByRole('region',{name:'File ordinary.ts'}).getByRole('button',{name:'Refresh',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.native-file-surface textarea')?.value==='External native update.\n');
  check(true,'Refresh reads the actual changed file, without a desktop index');
  unlinkSync(join(p.root,p.path));
  await page.getByRole('region',{name:'File ordinary.ts'}).getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByText('Last reading · Read only',{exact:true}).waitFor();
  check(await reading.inputValue()==='External native update.\n','Unavailable file retains a labelled last reading without redirecting');
  check(readFileSync(join(p.projectRoot,authored.binding.path),'utf8')===p.originals.get(authored.binding.path),'Browsing never writes the dirty authored draft to disk');
  await nav.getByRole('button',{name:'Central: files',exact:true}).click();
  await nav.locator('[data-file-path="root-note.md"]').click();
  // .md is a material kind (src/material): it opens on the rendered iframe
  // view by default, with the real FileSurface editor mounted under the
  // "Source" tab of its Rendered/Source toggle.
  await page.getByRole('tab',{name:'Source'}).click();
  check(await page.getByRole('textbox',{name:'Editing root-note.md'}).inputValue()==='An actual root file.\n','Central parent browses actual root files as well as Work projects');
  await shot('native-root-and-project-files');
}
