import {docText, waitForDoc} from '../editor-doc.mjs';
import { execFileSync } from 'node:child_process';
export default async function run({ page, baseUrl, check, metric, shot, channel }) {
  const owner = (action, input = {}) => {
    const args = ['--json'];
    if (process.env.OI_CENTRAL_ROOT) args.push('--root', process.env.OI_CENTRAL_ROOT);
    args.push('action', 'run', action, JSON.stringify(input));
    const result = JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl', args, { encoding: 'utf8' }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    return result.data;
  };
  const expected = owner('central.world');
  await page.goto(baseUrl);
  await channel('info');
  // Writing is a real Flow in its register's NOW field, so the anchor this
  // scenario explores around is that Flow's editor, not a local canvas.
  const writingText='Keep this writing while I explore my world.';
  const writingProject=expected.work.projects.find(p=>p.projectcentral.state!=='absent')?.name;
  if(!writingProject)throw new Error('A ProjectCentral-bound project is required to open a Flow');
  const writingPath=expected.work.projects.find(p=>p.name===writingProject).path;
  await page.locator(`[data-project-path="${writingPath}"]`).click();
  // The row click browses asynchronously; the workspace project scope (which
  // names the Flow's register) settles only when that browse lands. Wait for
  // the selection like every other row interaction here — otherwise a fast
  // "Start writing" legitimately opens in the root register (no project named
  // YET) and the race, not the semantics, decides the outcome.
  await page.waitForFunction(path => !!document.querySelector(`[data-project-path="${path}"][aria-current="true"]`), writingPath);
  await page.getByRole('button',{name:'Start writing',exact:true}).click();
  const writing=page.locator('.flow-surface .cm-content');
  await writing.waitFor({timeout:20000});
  await writing.click();
  await page.keyboard.type(writingText);
  await page.waitForFunction(t=>(document.querySelector('.flow-surface .text-editor-host')?.__oiDocument?.() ?? [...document.querySelectorAll('.flow-surface .cm-content .cm-line')].map(l=>l.textContent.replace(/\u00a0/g,' ')).join('\n'))===t,writingText);
  const flowSubjectRef=(await channel('read.focus')).data.subject?.ref;
  // Opening the Flow is itself a focus movement (a Flow is a real Central
  // subject); browsing after it must publish World readings and nothing else.
  const browseCursor=(await channel('read.events',[0])).data.receipts.length;
  check(typeof flowSubjectRef==='string'&&flowSubjectRef.startsWith('central:source:project:'),
    'Writing opens as a real Central subject in the register, not a buffer with no identity',{flowSubjectRef});
  const started = Date.now();
  if (!await page.getByRole('complementary',{name:'World navigator'}).isVisible()) await page.keyboard.press('Meta+b');
  const nav = page.getByRole('complementary', { name: 'World navigator' });
  const settled = () => page.waitForFunction(() => document.querySelector('.world-navigator')?.getAttribute('aria-busy') === 'false');
  await nav.locator('[data-project-path]').first().waitFor(); await settled();
  metric('world_summon_ms', Date.now() - started);
  const paths = await nav.locator('[data-project-path]').evaluateAll(rows => rows.map(r => r.dataset.projectPath));
  check(JSON.stringify(paths) === JSON.stringify(expected.work.projects.map(p => p.path)), 'Every project row matches the real Central World map in owner order', paths);
  check(await docText(page,'.flow-surface .cm-content') === writingText, 'Summoning retains the open Flow buffer');
  check(await nav.getByRole('searchbox').count() === 0, 'Search is not a persistent sidebar input');
  const project = expected.work.projects.find(p => p.name === 'O-I');
  if (!project) throw new Error('Real O-I project required');
  await nav.locator(`[data-project-path="${project.path}"]`).click();
  await nav.getByRole("button",{name:`${project.name}: files`,exact:true}).click();
  await settled();
  await page.waitForFunction(() => document.querySelector('[data-project-path="Work/O-I"]')?.getAttribute('aria-current') === 'true');
  const state = (await channel('read.state')).data;
  const snapshot = state.snapshot ?? state;
  const ground = owner('projectcentral.inspect', { project: 'O-I' });
  check(snapshot.navigator.project.project.path === project.path, 'Kernel holds the selected owner project reading');
  check(snapshot.navigator.project_ref === ground.manifest.project_id, 'Project ref is the owner manifest identity verbatim');
  check(snapshot.focus.subject?.ref===flowSubjectRef, 'Browsing a project leaves the open Flow as the focused subject');
  check(snapshot.navigator.project.project.projectcentral.relations.path === project.projectcentral.relations.path, 'Native ground relations remain available without a permanent diagnostic footer');
  const rootWiki = expected.control.agent_wiki.wiki;
  check(snapshot.navigator.root.control.agent_wiki.wiki.space_ref === rootWiki.space_ref, 'Root wiki identity remains the exact owner reference');
  check(snapshot.navigator.project.project.projectcentral.agent_wiki.wiki.space_ref === project.projectcentral.agent_wiki.wiki.space_ref, 'Distinct project wiki identity is preserved');
  check(JSON.stringify(snapshot.navigator.root.control.agent_wiki.wiki.child_space_refs) === JSON.stringify(rootWiki.child_space_refs), 'Native federation retains real root wiki children');
  check(await nav.locator('.world-evidence').count() === 0 && await page.getByText('Ground & identity',{exact:true}).count() === 0, 'Project browsing has no Ground & identity footer');
  await shot('project-ground');
  await nav.locator('.world-root').click(); await settled();
  const rootState = (await channel('read.state')).data;
  check(!rootState.navigator.project && !rootState.focus.project, 'Selecting the root clears the old project selection');
  check(rootState.focus.subject?.ref===flowSubjectRef, 'Selecting the root does not close or unfocus the writing the reader had open');
  await page.keyboard.press('Escape');
  check(await nav.count() === 0 && await docText(page,'.flow-surface .cm-content') === writingText, 'Escape dismisses to the same Flow');
  await page.waitForFunction(() => !!document.activeElement?.closest('.flow-surface .cm-editor'), null, { timeout: 5000 });
  check(true, 'Dismiss restores writing caret');
  await page.getByRole('button',{name:'Toggle left region',exact:true}).click();
  await nav.waitFor();
  check(await nav.isVisible(), 'Pointer context menu summons the same World surface');
  const unbound = expected.work.projects.find(p => p.projectcentral.state === 'absent');
  if (unbound) {

    await nav.locator(`[data-project-path="${unbound.path}"]`).click();
    await settled();
    await page.waitForFunction(path => document.querySelector(`[data-project-path="${path}"]`)?.getAttribute('aria-current') === 'true', unbound.path);
    check(await nav.getByRole('button', {name:`Open ${unbound.name} wiki`,exact:true}).count() === 0, 'Ordinary Work project offers no fabricated wiki binding');
    const current = (await channel('read.state')).data;
    const unboundState = current.snapshot ?? current;
    check(!unboundState.focus.project && !unboundState.focus.world && !unboundState.navigator.project_ref, 'Unbound project clears stale focus and fabricates no identity');
  }
  await page.getByRole('button', { name: 'Toggle left region' }).click();
  check(await nav.count() === 0, 'Pointer close returns to rest');
  await page.waitForFunction(() => !!document.activeElement?.closest('.flow-surface .cm-editor'), null, { timeout: 5000 });
  check(true, 'Pointer summon and close restore the original caret rather than the removed menu item');
  const events = (await channel('read.events', [0])).data.receipts;
  check(events.every((e, i) => e.seq === i + 1), 'World event log is contiguous and ordered', events);
  const browsed=events.slice(browseCursor);
  check(browsed.some(e => e.event === 'world_changed') && !browsed.some(e => e.event === 'focus_changed'), 'Browsing publishes World readings without semantic focus movement', browsed.map(e=>e.event));
  await shot('restored-writing');
  await page.addInitScript(() => { delete window.__OI_KERNEL_BRIDGE__; });
  await page.reload(); await channel('info');
  if (!await page.getByRole('complementary',{name:'World navigator'}).isVisible()) await page.keyboard.press('Meta+b');
  await nav.getByRole('status').filter({ hasText: 'no kernel transport' }).waitFor();
  check(await nav.locator('[data-project-path]').count() === 0, 'Unavailable owner transport fabricates no project rows');
  check(await nav.getByRole('status').isVisible(), 'Unavailable transport is disclosed locally in the navigator');
}
