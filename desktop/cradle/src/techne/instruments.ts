/**
 * The Technè arrangement's instrument constellation — Technē's six deep
 * instruments, named by their work (O-I #375, Technè section; ql.techne/v1's
 * instrument set: project, canvas, timeline, journey, place, palace; they
 * carry no M′ numbers since the owner withdrew that reading on 19 Oct 2026;
 * `expressions` is the conjugate 3:3 reading and lives on the Expressions
 * side, never a seventh tab here).
 *
 * The first instrument — Project/Wiki/Graph, the source-backed ground — is the
 * arrangement's MAIN FIRST VIEW. The rail itself is static vocabulary; what
 * each tab STANDS ON at runtime is the selected subject's disclosed
 * TechneReading (techneReading.ts) — availability with stated reasons, never
 * a hard-coded six.
 */
import type {GlyphName} from "../workspace/Glyph";
import type {TechneInstrumentId} from "./techneReading";

export interface DeepInstrument {
  /** The ql.techne/v1 disclosure vocabulary id. */
  instrument: TechneInstrumentId;
  /** The tab's name — the owner commission's own pairing. */
  label: string;
  /** One line naming what the office is. */
  office: string;
  glyph: GlyphName;
}

export const DEEP_INSTRUMENTS: readonly DeepInstrument[] = [
  {instrument: "project", label: "Project · Wiki · Graph", office: "the source-backed ground", glyph: "material"},
  {instrument: "canvas", label: "Canvas · Constellation", office: "the composed surface", glyph: "field"},
  {instrument: "timeline", label: "Relation · Timeline", office: "the relation field in time", glyph: "history"},
  {instrument: "journey", label: "Journey · Scenes", office: "the traversal of scenes", glyph: "explore"},
  {instrument: "place", label: "World · Places", office: "the world's places", glyph: "home"},
  {instrument: "palace", label: "Palace · Integral Whole", office: "the integral whole", glyph: "release"},
] as const;

export const GROUND_INSTRUMENT = DEEP_INSTRUMENTS[0];
export const deepInstrument = (instrument: TechneInstrumentId): DeepInstrument | undefined =>
  DEEP_INSTRUMENTS.find(entry => entry.instrument === instrument);
