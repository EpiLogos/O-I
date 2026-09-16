/**
 * The Journey instrument's beat model (L5 Technē T5) — pure derivation, no
 * store, no persistence. A Journey beat is ONE expression binding's scene:
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
export interface JourneyBeatFrame {
  /** The reading's subject — every beat discloses the same subject. */
  subject_ref: string;
  /** The reading's occurrence/day temporal facets, verbatim and in reading
   * order. Other kinds (receipt, now, session, run, …) belong to the
   * timeline instrument, not to the journey's scene time. */
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
export interface JourneyBeat {
  expression_ref: string;
  revision: string | null;
  scene_ref: string;
  /** The scene_ref tail — a display title derived from the ref, never a
   * replacement for it. */
  title: string;
  frame: JourneyBeatFrame;
}

/** The journey a reading supports: its beats, or the honest reason it
 * supports none. */
export interface JourneyModel {
  beats: JourneyBeat[];
  /** Present exactly when beats is empty. */
  unavailableReason?: string;
}

/** The scene_ref tail: display text derived from the ref itself. */
export function sceneTitle(sceneRef: string): string {
  const tail = sceneRef.slice(sceneRef.lastIndexOf("/") + 1);
  return tail.length > 0 ? tail : sceneRef;
}

function frameOf(reading: TechneReading): JourneyBeatFrame {
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

/** Derive the journey beats of one reading: one beat per scene-bearing
 * Expression binding, in binding order. No Expression scenes bound means
 * zero beats plus the honest unavailable reason — data, never an error. */
export function beats(reading: TechneReading): JourneyModel {
  const frame = frameOf(reading);
  const sceneBeats: JourneyBeat[] = [];
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
  // The disclosure's own journey reason is the owner's honesty — prefer it
  // verbatim; derive from the data when the disclosure is silent or
  // contradicts it (capability honesty never papers over absent data).
  const journey = reading.disclosure.instruments.find((entry) => entry.instrument === "journey");
  if (journey && !journey.available && journey.reason) return { beats: [], unavailableReason: journey.reason };
  if (!(reading.expressions ?? []).length) {
    return { beats: [], unavailableReason: "no Expression is bound to this subject" };
  }
  return { beats: [], unavailableReason: "bound Expressions disclose no scene refs" };
}
