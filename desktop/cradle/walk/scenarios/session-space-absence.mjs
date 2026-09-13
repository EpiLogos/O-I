import {setup as sourceSetup} from './editor.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/** The session-space absence walk: the managed `aikit-session-space` binary
 * is missing from this machine's oi application-data root, which the suite
 * route reports as `oi: cannot exec AIKit SessionSpace …`. A PATH shim
 * reproduces exactly that machine fact deterministically (every other owner
 * call still reaches the real `ctrl` behind `oi central`), and the scenario
 * asserts the panels that read SessionSpace degrade to the calm remedy
 * instead of surfacing the raw exec report. */
export async function setup(args) {
  const p = await sourceSetup(args);
  const shimDir = mkdtempSync(join(tmpdir(), 'oi-cradle-session-space-shim-'));
  const shim = join(shimDir, 'oi');
  let realOi = 'oi';
  try { realOi = execFileSync('which', ['oi'], {encoding: 'utf8'}).trim() || 'oi'; } catch { /* fall back to PATH resolution */ }
  writeFileSync(shim, `#!/bin/sh
if [ "$1" = "aikit-session-space" ]; then
  echo "oi: cannot exec AIKit SessionSpace /nonexistent/OI/bin/aikit-session-space: No such file or directory (os error 2)" >&2
  exit 1
fi
exec "${realOi}" "$@"
`);
  chmodSync(shim, 0o755);
  return {...p, shim, env: {...p.env, PATH: `${shimDir}:${process.env.PATH}`}, cleanup: () => { rmSync(shimDir, {recursive: true, force: true}); p.cleanup(); }};
}

export default async function run({page,baseUrl,check,channel,provision:p}) {
  await page.goto(baseUrl);
  // Bind the fixture ground through the real UI (editor.mjs's boot law).
  const {bindDefaultCentral} = await import('../editor-doc.mjs');
  await bindDefaultCentral(page, p.root);
  const nav = page.getByRole('complementary', {name: 'World navigator'});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  // The project's chats-and-tasks mode mounts EncounterList, whose
  // agency_read is the first session-space owner call.
  if (await page.getByRole('button', {name: 'Editor: chats and tasks', exact: true}).getAttribute('aria-pressed') !== 'true') {
    await page.getByRole('button', {name: 'Editor: chats and tasks', exact: true}).click();
  }
  const absence = page.locator('.project-encounters .project-availability', {hasText: 'AIKit SessionSpace is not installed'});
  await absence.waitFor({timeout: 20000});
  check(true, 'The project conversation list names the absent session-space binary calmly');
  const text = await absence.innerText();
  check(text.includes('oi install ai-kit'), 'The absence names the oi command that installs the session-space binary', {text});
  check(!/cannot exec|os error 2|Error:/i.test(text), 'The raw exec report never reaches the panel');
  check(await page.locator('.project-encounters [role="alert"]').count() === 0, 'The absence is a status, not an alert');
  // The navigator itself stays usable: projects, modes and file browsing
  // are independent of the session-space reading.
  await nav.getByRole('button', {name: 'Editor: files', exact: true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${p.sources[0].binding.path}"]`).click();
  await page.locator('.cm-content').first().waitFor({timeout: 20000});
  check(true, 'Navigator browsing stays usable while SessionSpace is absent');
  // The System Activity view reads the same owner: it carries the same calm
  // remedy rather than the raw exec report.
  await nav.locator('.world-system').getByRole('button', {name: 'System', exact: true}).click();
  const systemPanel = page.getByRole('region', {name: 'System composition'}).or(page.locator('.system-panel')).first();
  await systemPanel.waitFor({timeout: 20000});
  const activity = systemPanel.locator('.settings-rail').getByRole('button', {name: 'Activity', exact: true});
  await activity.click();
  const note = page.locator('.session-space-absence');
  await note.waitFor({timeout: 20000});
  check((await note.innerText()).includes('oi install ai-kit'), 'The System Activity view carries the same remedy for the absent binary');
  check(!/cannot exec|os error 2/i.test(await note.innerText()), 'The System Activity view never surfaces the raw exec report');
  await channel('info');
}
