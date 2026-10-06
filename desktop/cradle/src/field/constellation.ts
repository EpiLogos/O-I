/**
 * A constellation gathered in the field, handed to Technè through the existing wiki construction and selection path — no
 * Technè redesign, no export, no second canvas.
 *
 * Gathering is the encounter's (`enter-constellation`): the refs the person collected from the graph. Working it in Technè
 * means it must exist where Technè reads constellations — the Project's own Wiki. So the hand-off is the same act the wiki
 * map's "+" performs (`aikit.constellation.apply` via `saveConstruction`, then re-read the projection, seat the new scene,
 * `requestWikiSelection` on it, enter Technè by the frame's own `oi:epi-examine` hop), with each gathered page as a member
 * that cites its exact source at the exact revision the owner just disclosed. Created and its members added in ONE request, so
 * a refusal leaves nothing half-made; the owner's refusal is returned in its own words.
 *
 * A page that is not a Central source a Wiki can cite (a published edition's page is read, not cited, from here) is named and
 * the whole hand-off refused — nothing is substituted.
 */
import type {KernelTransportStatus} from "../kernel/types";
import type {ApplyKernel} from "../knowledge/construction";
import {memberChange, newConstruction, readRegister, saveConstruction} from "../knowledge/construction";
import type {WikiPassage} from "../knowledge/selection";
import {projectSpaceRefOf, wikiRegistersFrom, type WikiRegister} from "../techne/wikiExpression";
import {getWikiProjectionState, rereadWikiProjection, requestWikiSelection, setWikiProjectionRegisters} from "../techne/wikiProjectionStore";
import {seatWikiConstellation} from "../techne/wikiNativeExpression";
import type {FieldRef} from "./model";
import type {FieldSource, NativeSourceFacts} from "./source";

const enc = new TextEncoder();
/** The page's first paragraph — the passage a member cites (never the whole page: a selection is a bounded span). */
export function firstPassage(content: string, fallbackTitle: string): {text: string; start_byte: number; end_byte: number} {
  let offset = 0, inFront = false, first = true;
  for (const line of content.split("\n")) {
    const at = offset; offset += line.length + 1;
    if (first && line.trim() === "---") { inFront = true; first = false; continue; }
    first = false;
    if (inFront) { if (line.trim() === "---") inFront = false; continue; }
    if (!line.trim() || /^\s*#{1,6}\s/.test(line)) continue;
    const text = line.trim();
    const lead = line.length - line.trimStart().length;
    const start = enc.encode(content.slice(0, at + lead)).length;
    return {text, start_byte: start, end_byte: start + enc.encode(text).length};
  }
  // an empty page cites itself by its title only
  return {text: fallbackTitle, start_byte: 0, end_byte: Math.max(1, enc.encode(content).length)};
}

export class ConstellationRefused extends Error {
  refs: FieldRef[];
  constructor(message: string, refs: FieldRef[] = []) { super(message); this.name = "ConstellationRefused"; this.refs = refs; }
}

export interface GatherRequest {
  transport: KernelTransportStatus;
  apply?: ApplyKernel;
  source: FieldSource;
  refs: FieldRef[];
  title: string;
  question: string;
  /** The Projects the kernel discloses (to name the register); absent → read from the owner. */
  projects: {name: string; path: string}[];
  /** Where the person was, so Technè's return lands on the field. */
  returnTo?: unknown;
}
export interface Gathered { frame_ref: string; sceneRef: string; project: string; members: number }

export async function gatherToTechne(req: GatherRequest): Promise<Gathered> {
  if (!req.refs.length) throw new ConstellationRefused("Gather at least one page first.");
  if (!req.title.trim() || !req.question.trim()) throw new ConstellationRefused("Name the constellation and give it its question.");
  if (!req.source.nativeSource) throw new ConstellationRefused("This corpus does not disclose its pages as Central sources, so a Wiki cannot cite them.", req.refs);
  const facts: NativeSourceFacts[] = [];
  const missing: FieldRef[] = [];
  for (const ref of req.refs) { const f = await req.source.nativeSource(ref).catch(() => undefined); if (f) facts.push(f); else missing.push(ref); }
  if (missing.length) throw new ConstellationRefused(`${missing.length} of the ${req.refs.length} gathered pages are not Central sources a Wiki can cite from here (a published edition's pages are read, not cited): ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`, missing);
  const projects = new Set(facts.map(f => f.project));
  if (projects.size !== 1) throw new ConstellationRefused(`The gathered pages belong to ${projects.size} Projects; a constellation is held by one Project's Wiki.`);
  const project = facts[0].project;
  const row = req.projects.find(p => p.name === project);
  if (!row) throw new ConstellationRefused(`${project} is outside the Central world the kernel discloses.`);
  const register: WikiRegister = {key: project, title: project, project, projectPath: row.path};

  const passages: WikiPassage[] = facts.map((f, i) => {
    const p = firstPassage(f.content, f.title);
    return {schema: "oi.wiki-passage/v1", address: {kind: "source", value: req.refs[i]}, source_ref: req.refs[i], source_revision: f.revision, selector: {start_byte: p.start_byte, end_byte: p.end_byte}, source_text: p.text, text: p.text, title: f.title, provider: "central"};
  });
  const basis = await readRegister(req.transport, project);
  const space = projectSpaceRefOf(basis.spaces, project);
  if (!space) throw new ConstellationRefused(`${project}'s Wiki has no space to hold a constellation.`);
  const create = newConstruction(req.title, req.question, space);
  const request = {...create, changes: [...create.changes, ...passages.map(p => memberChange(p))]};
  // the owner verifies every cited source at its location and revision; a stale or foreign one is refused with its own words
  const result = await saveConstruction(req.transport, project, basis, request, [], req.apply, facts.map((f, i) => ({source_ref: req.refs[i], revision: f.revision, location: f.location})));
  const anchor = result.reading.frame.constellations[0]?.anchor_ref;

  if (!getWikiProjectionState().registers.some(r => r.key === register.key)) setWikiProjectionRegisters(wikiRegistersFrom(req.projects));
  const projection = await rereadWikiProjection(register, req.transport);
  const constellation = projection.constellations.find(row => row.kind === "frame" && row.wholeRef === anchor);
  if (!constellation) throw new ConstellationRefused("Created in the Wiki, but the fresh reading does not yet carry it; open it from Technè's map.");
  await seatWikiConstellation(req.transport, register, constellation.sceneRef);
  requestWikiSelection({registerKey: register.key, sceneRef: constellation.sceneRef, entityRef: null, subjectRef: constellation.wholeRef, title: constellation.title, origin: "external", lens: "canvas"});
  window.dispatchEvent(new CustomEvent("oi:epi-examine", {detail: {returnTo: req.returnTo ?? {}}}));
  return {frame_ref: request.frame_ref, sceneRef: constellation.sceneRef, project, members: constellation.members.length};
}
