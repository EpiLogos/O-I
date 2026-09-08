import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export async function setup({ cradleRoot }) {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-editor-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  try {
    call('central.init');
    mkdirSync(join(root, 'Work', 'Editor'));
    mkdirSync(join(root, 'Work', 'Other'));
    call('projectcentral.init', { project: 'Editor', project_id: 'editor-walk' });
    const docs = ['docs/cradle/01-DESIGN.md', 'docs/cradle/02-ARCHITECTURE.md', 'docs/cradle/03-UX-STATES.md', 'docs/cradle/04-VERIFICATION.md', 'docs/cradle/05-EXECUTION.md', 'docs/FLOW.md', 'docs/CANONICAL-PRODUCT-FIELD.md', 'docs/OI-DESKTOP-APPLICATION-SPEC.md', 'docs/OI-CENTRAL-FOUNDATION-2026-09-04.md', 'docs/positions/FOUNDING-POSITIONS.md'];
    const projectRoot = join(root, 'Work', 'Editor');
    const originals = new Map();
    for (const [i, doc] of docs.entries()) {
      const path = `ProjectCentral/user/${String(i).padStart(2, '0')} ${doc.split('/').pop()}`;
      const content = readFileSync(resolve(cradleRoot, '../..', doc), 'utf8');
      writeFileSync(join(projectRoot, path), content);
      originals.set(path, content);
    }
    const sources = call('projectcentral.change.horizon', { project: 'Editor' }).sources.filter(s => originals.has(s.binding.path));
    return { root, projectRoot, sources, originals, call, env: { OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: 'Editor' }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) { rmSync(root, { recursive: true, force: true }); throw error; }
}

export default async function run({ page, baseUrl, check, metric, shot, channel, log, provision: p }) {
  const calls = [];
  page.on('response', async response => {
    if (!response.url().endsWith('/op')) return;
    try {
      const body = await response.json();
      calls.push({ op: response.request().postDataJSON().op, result: body.outcome?.result, error: body.error, failure: body.outcome?.failure });
    } catch { /* Teardown may close a completed response's browser handle. */ }
  });
  await page.goto(baseUrl); await channel('info');
  await page.getByRole('button',{name:'Start writing',exact:true}).click();
  await page.locator('.canvas-surface').fill('This thought survives opening documents.');
  const nav = page.getByRole('complementary', { name: 'World navigator' });
  const selectProject = async name => {
    if (!await page.getByRole('complementary', {name:'World navigator'}).isVisible()) await page.keyboard.press('Meta+b');
    await nav.locator(`[data-project-path="Work/${name}"]`).click();
    await nav.getByRole("button",{name:`${name}: files`,exact:true}).click();
    await page.waitForFunction(name => document.querySelector(`[data-project-path="Work/${name}"]`)?.getAttribute('aria-current') === 'true', name);
    await page.waitForFunction(() => document.querySelector('.world-navigator')?.getAttribute('aria-busy') === 'false', null, { timeout: 10000 });
  };
  const open = async (source, select = false) => {
    if (select) await selectProject('Editor'); else if (!await page.getByRole('complementary', {name:'World navigator'}).isVisible()) await page.keyboard.press('Meta+b');
    const start = Date.now();
    await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
    await page.waitForFunction(ref => document.querySelector('.source-textarea')?.getAttribute('data-source-ref') === ref, source.binding.ref, { timeout: 10000 });
    await page.waitForFunction(content => document.querySelector('.source-textarea')?.value === content, p.originals.get(source.binding.path), { timeout: 10000 });
    return Date.now() - start;
  };
  check(p.sources.length === 10, 'Ten distinct existing documents are copied into real Central-owned test ground');
  const timings = [];
  for (let i = 0; i < p.sources.length; i++) {
    const source = p.sources[i];
    const duration = await open(source, i === 0);
    timings.push(duration);
    metric(`open_file_${i + 1}_ms`, duration);
    check(duration < 1000, `Document ${i + 1} opens through real Central in <1s (${duration}ms)`, { ref: source.binding.ref, path: source.binding.path });
    check(await page.locator('.source-textarea').inputValue() === p.originals.get(source.binding.path), `Document ${i + 1} renders the exact original content`);
  }
  metric('open_file_max_ms', Math.max(...timings));
  const activate = async source => {
    await page.locator('.tab').filter({ hasText: source.binding.path.split('/').pop() }).click();
    await page.waitForFunction(ref => document.querySelector('.source-textarea')?.getAttribute('data-source-ref') === ref, source.binding.ref, { timeout: 10000 });
  };
  const first = p.sources[0], second = p.sources[1];
  const firstText = `${p.originals.get(first.binding.path)}\nEditor walk: first document change.\n`;
  const secondText = `${p.originals.get(second.binding.path)}\nEditor walk: second document change.\n`;
  await activate(first); await page.locator('.source-textarea').fill(firstText);
  await page.waitForFunction(() => document.querySelector('.source-editor')?.getAttribute('data-dirty') === 'true');
  await activate(second); await page.locator('.source-textarea').fill(secondText);
  await page.waitForFunction(() => document.querySelector('.source-editor')?.getAttribute('data-dirty') === 'true');
  await activate(first);
  check(await page.locator('.source-textarea').inputValue() === firstText, 'Switching dirty documents preserves the first buffer');
  await activate(second);
  check(await page.locator('.source-textarea').inputValue() === secondText, 'Switching back preserves the distinct second buffer');
  await activate(first);
  await selectProject('Other'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save · ⌘S' }).click();
  await page.waitForFunction(() => document.querySelector('.source-editor')?.getAttribute('data-dirty') === 'false', null, { timeout: 10000 });
  check(readFileSync(join(p.projectRoot, first.binding.path), 'utf8') === firstText, 'After selecting another project, Save writes only to the source’s original project');
  check(readFileSync(join(p.projectRoot, second.binding.path), 'utf8') === p.originals.get(second.binding.path), 'Saving one document never commits another dirty buffer');
  const saved = p.call('projectcentral.source.read', { project: 'Editor', source_ref: first.binding.ref });
  check(saved.revision.revision !== first.revision.revision, 'Real owner revision advances on save');
  check(saved.source.ref === first.binding.ref, 'Source identity remains stable across save');
  await shot('source-saved');
  await page.keyboard.press('Meta+w');
  p.originals.set(first.binding.path, firstText);
  await open(first, true);
  check(await page.locator('.source-revision').getAttribute('data-revision') === saved.revision.revision, 'Reopening a closed source keeps the same owner revision and ref');
  // A real owner disclosure refusal: the file remains on disk; the actual
  // Central exclusion marker prevents this Action from revising it.
  writeFileSync(join(p.projectRoot, 'ProjectCentral/user/.no-agent-retrieval'), '');
  await page.locator('.source-textarea').fill(`${firstText}Refused change.\n`);
  await page.keyboard.press('Meta+s');
  try { await page.getByRole('alert').waitFor({ timeout: 5000 }); }
  catch (error) {
    await shot('refusal-debug');
    const state = (await channel('read.state')).data;
    log(JSON.stringify({ calls: calls.slice(-8), dirty: state.buffers[first.binding.ref]?.dirty, conflict: state.buffers[first.binding.ref]?.conflict, text: await page.locator('.source-editor').innerText(), events: (await channel('read.events', [0])).data.receipts.slice(-3) }));
    throw error;
  }
  check((await page.getByRole('alert').innerText()).includes('excluded'), 'Actual owner exclusion is visible as a source-scoped refusal');
  check(readFileSync(join(p.projectRoot, first.binding.path), 'utf8') === firstText, 'Refused save changes no source bytes');
  check((await page.locator('.source-textarea').inputValue()).endsWith('Refused change.\n'), 'Refusal preserves the dirty buffer');
  rmSync(join(p.projectRoot, 'ProjectCentral/user/.no-agent-retrieval'));
  await shot('owner-refusal');
  while (await page.locator('.tab').count()) await page.keyboard.press('Meta+w');
  check(await page.locator('.canvas-surface').inputValue() === 'This thought survives opening documents.', 'Closing sources restores the original writing canvas');
}
