/**
 * Factory's INTENT section (10-SIDEBARS §3.2, §3.7, ruling D5): the scoped
 * project's own intent documents, read from its ProjectCentral human ground —
 *
 *   Vision     ProjectCentral/user/<project>.html  (marked "review" when the
 *              page says it is an agent-recovered candidate)
 *   Goals      ProjectCentral/user/telos/<goal>/    (goal.html, else goal.md),
 *              a goal file in telos/ (goal-<stamp>.html — what "Write one"
 *              creates, since no native Action makes a folder), or a
 *              goal-<stamp>.html at the human ground's root where the project
 *              has no telos folder yet; "No goals yet — Write one" when none
 *   Learnings  ProjectCentral/user/learnings/       (a folder with a count)
 *
 * The root register keeps the same law at Control/user/ (Central scope): its
 * telos is Control/user/telos; a vision page is a project's alone.
 *
 * Writing a goal or a vision creates a copy of the Goal / Vision form IN
 * PLACE under the scope's human ground (the frame's create-in-place route),
 * never an edit of the template.
 */
import {useCallback, useEffect, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {listFiles, readFile} from "../../files/client";
import type {CentralLocation, NativeFileEntry} from "../../kernel/types";
import {FileTree} from "../../files/FileTree";
import {Glyph} from "../Glyph";
import {MaterialRow, Section, type SectionState} from "./rows";
import {useLeftHost} from "./host";

export interface IntentGoal {name: string; location: CentralLocation; folder: CentralLocation}
export interface IntentReading {
  vision?: {location: CentralLocation; name: string; recovered: boolean};
  goals: IntentGoal[];
  learnings?: {location: CentralLocation; count: number};
}

const missing = (reason: unknown) => /No such file or directory|not found|does not exist/i.test(String(reason));
async function listOrEmpty(transport: Parameters<typeof listFiles>[0], path: string): Promise<NativeFileEntry[] | undefined> {
  try { return (await listFiles(transport, path, true)).entries; }
  catch (reason) { if (missing(reason)) return undefined; throw reason; }
}

/** The page's own words decide the review mark — never a guess from the name. */
export const RECOVERED = /agent[- ]recovered|recovered (candidate )?seed|agent-inference candidate|human review pending/i;

export async function readIntent(transport: Parameters<typeof listFiles>[0], base: string, project?: string): Promise<IntentReading> {
  const top = await listOrEmpty(transport, base) ?? [];
  const reading: IntentReading = {goals: []};
  if (project) {
    const pages = top.filter(entry => entry.kind === "file" && /\.html$/i.test(entry.name) && !/-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?\.html$/i.test(entry.name));
    const slug = project.toLowerCase().replace(/[^a-z0-9]/g, "");
    const page = pages.find(entry => entry.name.toLowerCase().replace(/\.html$/, "").replace(/[^a-z0-9]/g, "") === slug) ?? pages[0];
    if (page) {
      let recovered = false;
      try { recovered = RECOVERED.test((await readFile(transport, page.location)).content.slice(0, 200_000)); } catch { /* unreadable: no mark claimed */ }
      reading.vision = {location: page.location, name: page.name, recovered};
    }
  }
  const telos = await listOrEmpty(transport, `${base}/telos`);
  for (const folder of (telos ?? []).filter(entry => entry.kind === "directory")) {
    const inner = await listOrEmpty(transport, folder.location.path) ?? [];
    const main = inner.find(entry => entry.name === "goal.html") ?? inner.find(entry => entry.name === "goal.md") ?? inner.find(entry => entry.kind === "file");
    if (main) reading.goals.push({name: folder.name, location: main.location, folder: folder.location});
  }
  const GOAL_FILE = /^goal-.+\.html$/i;
  for (const file of [...(telos ?? []), ...top].filter(entry => entry.kind === "file" && GOAL_FILE.test(entry.name))) {
    reading.goals.push({name: file.name.replace(/\.html$/i, ""), location: file.location, folder: file.location});
  }
  const learnings = top.find(entry => entry.kind === "directory" && entry.name === "learnings");
  if (learnings) {
    const inner = await listOrEmpty(transport, learnings.location.path) ?? [];
    reading.learnings = {location: learnings.location, count: inner.filter(entry => entry.kind === "file" && entry.name !== "README.md").length};
  }
  return reading;
}

export function IntentSection({project, refresh = 0}: {project?: string; refresh?: number}) {
  const kernel = useKernel();
  const host = useLeftHost();
  const base = project ? `Work/${project}/ProjectCentral/user` : "Control/user";
  const [reading, setReading] = useState<IntentReading>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [learningsOpen, setLearningsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<string>();
  useEffect(() => {
    let live = true;
    setReading(undefined); setError(undefined);
    void readIntent(kernel.transport, base, project).then(value => { if (live) setReading(value); }).catch(reason => { if (live) setError(String(reason instanceof Error ? reason.message : reason)); });
    return () => { live = false; };
  }, [kernel.transport, base, project, refresh, attempt]);
  // A created goal or vision lands in the ground: re-read when the frame
  // announces a create-in-place for this register.
  useEffect(() => {
    const created = () => setAttempt(value => value + 1);
    window.addEventListener("oi:form-created", created);
    return () => window.removeEventListener("oi:form-created", created);
  }, []);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const focused = kernel.snapshot.focus?.subject?.ref;
  const state: SectionState = error ? {kind: "error", message: `Couldn't read ${project ?? "Central"}'s intent.`, onRetry: retry}
    : !reading ? {kind: "loading", what: `Reading ${project ?? "Central"}…`}
    : {kind: "ready", rows: 1};
  // A refused create says so HERE, beside the row that asked (the owner's
  // words stay in the tooltip); nothing is written anywhere else instead.
  const create = (kind: string) => { setRefusal(undefined); void Promise.resolve(host.onCreateForm?.(kind)).catch(reason => setRefusal(String(reason instanceof Error ? reason.message : reason))); };
  return <Section id="intent" label="Intent" state={state}>
    {reading && <div className="left-intent" data-intent-base={base}>
      {reading.vision
        ? <MaterialRow location={reading.vision.location} label="Vision" glyph="file" title={reading.vision.location.path} current={focused === reading.vision.location.ref}
            badge={reading.vision.recovered ? <span className="left-review-badge" title="An agent-recovered candidate page, awaiting your review">review</span> : undefined}/>
        : project && host.onCreateForm && <div className="left-row left-intent-empty"><Glyph name="file" size={13}/><span className="left-row-label">No vision yet</span><button type="button" className="left-link" onClick={() => create("document-vision")}>Write it</button></div>}
      {reading.goals.map(goal => <MaterialRow key={goal.location.ref} location={goal.location} label={goal.name} glyph="verify" title={goal.location.path} current={focused === goal.location.ref}/>)}
      {!reading.goals.length && <div className="left-row left-intent-empty" data-goals-absent="true"><Glyph name="verify" size={13}/><span className="left-row-label">No goals yet</span>{host.onCreateForm && <button type="button" className="left-link" onClick={() => create("document-goal")}>Write one</button>}</div>}
      {refusal && <p className="left-refusal" role="alert" title={refusal}>{refusal.split(" (Central:")[0]}</p>}
      {reading.learnings && <>
        <button type="button" className="left-row left-learnings" aria-expanded={learningsOpen} onClick={() => setLearningsOpen(value => !value)}>
          <span className="left-chevron" aria-hidden="true"><Glyph name="down" size={9}/></span><Glyph name="folder" size={13}/><span className="left-row-label">Learnings</span><span className="left-row-badge">{reading.learnings.count}</span>
        </button>
        {learningsOpen && <div className="left-learnings-tree"><FileTree path={reading.learnings.location.path} onOpen={async location => { await host.onOpenFile?.(location); }} refresh={refresh} expanded={expanded} onExpansion={setExpanded} onRootRef={() => {}}/></div>}
      </>}
    </div>}
  </Section>;
}
