/**
 * The Story instrument's beat model (L5 Technē T5) — pure derivation, no
 * store, no persistence. A Story beat is ONE expression binding's scene:
 * `expressions[]` entries that carry a `scene_ref`, with scene refs carried
 * verbatim (never re-keyed, never shortened — the Expression substrate
 * `oi.expression/v1` stays the only persistence; this model persists
 * nothing and proposes nothing).
 *
 * The scene frame is read from the same reading's own facets — never from a
 * second ontology: temporal frame (the reading's occurrence/day facets),
 * spatial frame (spatial[] names/precision), subject frame (the reading's
 * subject_ref) and source frame (provenance[] source_ref + selector). A
 * reading whose expressions carry no scene refs yields zero beats and an
 * honest unavailableReason (the surface host already renders the disclosure's
 * own reason; this model's reason is the data-side statement of the same
 * honesty).
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  TechnePlacePrecision,
  TechneReading,
  TechneSourceSelector,
  TechneTemporalFacet,
} from "../contract.ts";

/** One beat's frame, composed only of facets the reading itself discloses. */
export interface StoryBeatFrame {
  /** The reading's subject — every beat discloses the same subject. */
  subject_ref: string;
  /** The reading's occurrence/day temporal facets, verbatim and in reading
   * order. Other kinds (receipt, now, session, run, …) belong to the
   * timeline instrument, not to the story's scene time. */
  temporal: TechneTemporalFacet[];
  /** Spatial frame: place ref, current names and precision, verbatim. */
  places: { place_ref: string; names: string[]; precision: TechnePlacePrecision }[];
  /** Source frame: each provenance entry's source_ref and its exact
   * selector (whose `unit` is the chip's selector unit). */
  sources: {
    source_ref: string;
    source_revision: string | null;
    selector: TechneSourceSelector | null;
  }[];
}

/** One beat: one scene of one Expression binding, framed by the reading. */
export interface StoryBeat {
  expression_ref: string;
  revision: string | null;
  scene_ref: string;
  /** The scene_ref tail — a display title derived from the ref, never a
   * replacement for it. */
  title: string;
  frame: StoryBeatFrame;
}

/** The story a reading supports: its beats, or the honest reason it
 * supports none. */
export interface StoryModel {
  beats: StoryBeat[];
  /** Present exactly when beats is empty. */
  unavailableReason?: string;
}

/** The scene_ref tail: display text derived from the ref itself. */
export function sceneTitle(sceneRef: string): string {
  const tail = sceneRef.slice(sceneRef.lastIndexOf("/") + 1);
  return tail.length > 0 ? tail : sceneRef;
}

function frameOf(reading: TechneReading): StoryBeatFrame {
  const temporal = (reading.temporal ?? []).filter(
    (facet) => facet.kind === "occurrence" || facet.kind === "day",
  );
  const places = (reading.spatial ?? []).map((place) => ({
    place_ref: place.place_ref,
    names: (place.identity?.names ?? []).map((entry) => entry.name),
    precision: place.precision,
  }));
  const sources = (reading.provenance ?? []).map((entry) => ({
    source_ref: entry.source_ref,
    source_revision: entry.source_revision ?? null,
    selector: entry.selector ?? null,
  }));
  return { subject_ref: reading.subject.subject_ref, temporal, places, sources };
}

/** Derive the story beats of one reading: one beat per scene-bearing
 * Expression binding, in binding order. No Expression scenes bound means
 * zero beats plus the honest unavailable reason — data, never an error. */
export function beats(reading: TechneReading): StoryModel {
  const frame = frameOf(reading);
  const sceneBeats: StoryBeat[] = [];
  for (const binding of reading.expressions ?? []) {
    if (!binding.scene_ref) continue;
    sceneBeats.push({
      expression_ref: binding.expression_ref,
      revision: binding.revision ?? null,
      scene_ref: binding.scene_ref,
      title: sceneTitle(binding.scene_ref),
      frame,
    });
  }
  if (sceneBeats.length > 0) return { beats: sceneBeats };
  // The disclosure's own story reason is the owner's honesty — prefer it
  // verbatim; derive from the data when the disclosure is silent or
  // contradicts it (capability honesty never papers over absent data).
  const story = reading.disclosure.instruments.find((entry) => entry.instrument === "story");
  if (story && !story.available && story.reason) return { beats: [], unavailableReason: story.reason };
  if (!(reading.expressions ?? []).length) {
    return { beats: [], unavailableReason: "no Expression is bound to this subject" };
  }
  return { beats: [], unavailableReason: "bound Expressions disclose no scene refs" };
}
