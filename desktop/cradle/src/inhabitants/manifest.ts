// The inhabitant manifest — the one admission door for product families.
//
// Design: WORLD-SHELL-DESIGN.md §5.5/§12/§13. The shell core is the uncarved
// block: it knows frame, projections, encounter, rack, parameters, time —
// never a product name. A family integrates by declaring a manifest and
// being admitted; the seventh-product test is that a new family needs zero
// core change. This module is the contract and the registry; the four
// existing registries (panel slots, FIELD_FAMILIES, browser categories,
// detached kinds) migrate onto it without changing their consumers.

export const INHABITANT_MANIFEST_SCHEMA = 'oi.inhabitant-manifest/v1' as const;

/** Where a family appears. Exactly these four places and nowhere else
 * (plus time bindings and telemetry declarations) — the no-bespoke-UI law
 * stated per family (design §16). */
export type InhabitantSurface = 'browser' | 'rack' | 'projections' | 'inspectors';

/** A rack device face. The face receives the proven aperture
 * ({reading, disabled, apply, captureCurrent}); this contract names it, it
 * does not redefine the aperture. */
export interface DeviceFaceContribution {
  /** Globally unique within the family; addressed as `${family}:${id}`. */
  id: string;
  title: string;
  /** The surface kinds of encounters this face operates on (e.g.
   * 'expressions', 'source', a projection kind). Empty = any. */
  operatesOn: readonly string[];
  /** The mounted component, registered by the family's UI bundle. Kept
   * opaque here: the core never inspects a face's implementation. */
  component: unknown;
  /** Deep edit / compact / expanded presentation states exist per face
   * (landed pattern); declared, not invented, by the core. */
  presentations?: readonly ('compact' | 'expanded' | 'deep')[];
}

/** A typed parameter address (design §14): scope declared, writes through
 * the custody law — modulation deepens writeShared, never bypasses it. */
export interface ParamAddress {
  face: string;
  key: string;
  type: 'number' | 'string' | 'boolean' | 'enumerated';
  /** Declared range/unit for numbers; enumeration values for 'enumerated'. */
  range?: {min?: number; max?: number; unit?: string};
  values?: readonly string[];
  /** The typed write path (kind/key/value grammar seed). */
  writePath: string;
}

export interface BrowserCategoryContribution {
  id: string;
  title: string;
  /** Place/category entries the browser lists under this category. */
  places: readonly {id: string; title: string; ref?: string}[];
}

export interface InspectorContribution {
  id: string;
  title: string;
  /** The selection kinds this inspector reads (implicit agent/files-grade
   * contextual panel; never a competing world). */
  selectionKinds: readonly string[];
  component: unknown;
}

export interface ProjectionAdapterContribution {
  /** Which projection this adapter contributes material to. */
  projection: 'earth' | 'timeline' | 'constellation' | 'expressions';
  /** What family material binds (e.g. 'factory.run' → timeline track). */
  binds: readonly string[];
}

export interface TimeBinding {
  /** Strata are locked at the top (design §15); families bind, never fork. */
  consumes: readonly ('chronos' | 'civil' | 'cron' | 'transport' | 'occasion')[];
  contributes?: readonly ('chronos' | 'civil' | 'cron' | 'transport' | 'occasion')[];
}

export interface TelemetrySource {
  /** An observable exposed as a modulation source (design §14). */
  id: string;
  title: string;
  unit?: string;
}

export interface InhabitantManifest {
  schema: typeof INHABITANT_MANIFEST_SCHEMA;
  /** The product family id — owned by that product's native owner; the
   * core never names one. */
  family: string;
  title: string;
  browser?: readonly BrowserCategoryContribution[];
  faces?: readonly DeviceFaceContribution[];
  params?: readonly ParamAddress[];
  projections?: readonly ProjectionAdapterContribution[];
  inspectors?: readonly InspectorContribution[];
  time?: TimeBinding;
  telemetry?: readonly TelemetrySource[];
}

export interface AdmittedFace {
  /** `${family}:${face id}` — the global address. */
  address: string;
  family: string;
  face: DeviceFaceContribution;
  params: readonly ParamAddress[];
}

/** The neutral registry. It knows families, never products: nothing in
 * this module names central/actuation/ai-kit/factory/workcell/quaternal —
 * and nothing in it may grow a product conditional (neutrality law, §13). */
export class InhabitantRegistry {
  private manifests = new Map<string, InhabitantManifest>();
  private faces = new Map<string, AdmittedFace>();

  admit(manifest: InhabitantManifest): AdmittedFace[] {
    if (manifest.schema !== INHABITANT_MANIFEST_SCHEMA) {
      throw Error(`Unknown inhabitant manifest schema: ${String((manifest as {schema?: unknown}).schema)}`);
    }
    const family = manifest.family;
    if (!family || family !== family.toLowerCase() || /[^a-z0-9-]/.test(family)) {
      throw Error(`Inhabitant family id must be lowercase kebab: ${String(family)}`);
    }
    const prior = this.manifests.get(family);
    if (prior && prior !== manifest) {
      // Re-admission replaces the family's own declaration atomically —
      // a family may evolve its manifest; it may not collide with another.
      for (const [address, admitted] of this.faces) {
        if (admitted.family === family) this.faces.delete(address);
      }
    }
    this.manifests.set(family, manifest);
    const admitted: AdmittedFace[] = [];
    for (const face of manifest.faces ?? []) {
      const address = `${family}:${face.id}`;
      if (this.faces.has(address)) {
        throw Error(`Inhabitant face address collision: ${address}`);
      }
      const faceParams = (manifest.params ?? []).filter(p => p.face === face.id);
      const declaredFaceIds = new Set((manifest.faces ?? []).map(f => f.id));
      for (const p of faceParams) {
        if (!declaredFaceIds.has(p.face)) {
          throw Error(`Parameter addresses an undeclared face: ${family}:${p.face}`);
        }
      }
      const record: AdmittedFace = {address, family, face, params: faceParams};
      this.faces.set(address, record);
      admitted.push(record);
    }
    for (const p of manifest.params ?? []) {
      if (!declaredFaceIdsOf(manifest).has(p.face)) {
        throw Error(`Parameter addresses an undeclared face: ${family}:${p.face}`);
      }
    }
    return admitted;
  }

  families(): readonly string[] {
    return [...this.manifests.keys()].sort();
  }

  manifest(family: string): InhabitantManifest | undefined {
    return this.manifests.get(family);
  }

  /** Every admitted face, optionally filtered to the encounter's surface
   * kinds — the rack follows the focused pane's instrument (design §1). */
  facesFor(operatesOn?: string): readonly AdmittedFace[] {
    const all = [...this.faces.values()];
    if (!operatesOn) return all;
    return all.filter(a => a.face.operatesOn.length === 0 || a.face.operatesOn.includes(operatesOn));
  }

  browserCategories(): {family: string; category: BrowserCategoryContribution}[] {
    const out: {family: string; category: BrowserCategoryContribution}[] = [];
    for (const manifest of this.manifests.values()) {
      for (const category of manifest.browser ?? []) out.push({family: manifest.family, category});
    }
    return out.sort((a, b) => a.family.localeCompare(b.family) || a.category.id.localeCompare(b.category.id));
  }

  inspectorsFor(selectionKind: string): {family: string; inspector: InspectorContribution}[] {
    const out: {family: string; inspector: InspectorContribution}[] = [];
    for (const manifest of this.manifests.values()) {
      for (const inspector of manifest.inspectors ?? []) {
        if (inspector.selectionKinds.includes(selectionKind)) out.push({family: manifest.family, inspector});
      }
    }
    return out;
  }
}

function declaredFaceIdsOf(manifest: InhabitantManifest): Set<string> {
  return new Set((manifest.faces ?? []).map(f => f.id));
}
