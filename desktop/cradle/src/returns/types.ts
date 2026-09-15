import type {ReactNode} from "react";

export type ReturnedDocumentVariant="code"|"verification"|"report"|"preview-media"|"handoff";
export type ReturnedMaterialKind="file"|"diff"|"artifact"|"report"|"preview"|"media"|"evidence";

/** A host target is disclosed by the native owner or its existing consumer.
 * A reference by itself is deliberately not treated as a file path, diff or
 * preview URI. */
export interface ReturnedMaterial {
  kind:ReturnedMaterialKind;
  label:string;
  ref?:string;
  description?:string;
  open?:{kind:"file"|"diff"|"artifact"|"preview"|"media";ref:string};
}

export interface ReturnedEvidence {
  label:string;
  standing:"passed"|"failed"|"outstanding"|"recorded"|"missing"|"unknown";
  detail?:string;
  refs?:string[];
  required?:boolean;
}

export interface ReturnedRuntimeObservation {
  label:string;
  value:string;
  standing?:"observed"|"derived";
  basis?:string;
}

export interface ReturnedOutstanding {
  label:string;
  detail?:string;
  ref?:string;
}

export interface ReturnedContinuation {
  prompt:string;
  label?:string;
}

export interface ReturnedProvenance {
  label:string;
  value:string;
}

/** Structured presentation input. The owner remains responsible for every
 * supplied fact; O:I only chooses human-readable order and native callbacks. */
export interface ReturnedDocumentReading {
  variant:ReturnedDocumentVariant;
  subject:{title:string;ref?:string};
  outcome:{summary:string;standing?:string};
  material?:ReturnedMaterial[];
  evidence?:ReturnedEvidence[];
  runtime?:ReturnedRuntimeObservation[];
  outstanding?:ReturnedOutstanding[];
  continuations?:ReturnedContinuation[];
  provenance:ReturnedProvenance[];
}

/** Existing specialised hosts stay owners of opening. A document never turns
 * a source reference into a path or a provider operation on its own. */
export interface ReturnedDocumentCallbacks {
  onOpenMaterial?:(material:ReturnedMaterial)=>void|Promise<void>;
  /** Supplies an existing native material host only for a disclosed open
   * target. The template never resolves an opaque source ref into a host. */
  renderMaterial?:(material:ReturnedMaterial)=>ReactNode|undefined;
  onCopyContinuation?:(continuation:ReturnedContinuation)=>void|Promise<void>;
}
