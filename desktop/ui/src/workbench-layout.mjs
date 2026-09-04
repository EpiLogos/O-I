// Workbench presentation layout (02 §6, 02 §8, 03 §J).
//
// The desktop's presentation state — which regions exist, which surfaces are
// bound where, how the canvas is split — is real product state: persisted
// professionally, versioned, restorable. It is also *only* presentation: this
// module owns the two rules that keep it that way.
//
//  - **Rest is the product** (03 §J `J-rest`): the agency field and the canvas,
//    nothing else. Every other region is *absent* — absence is a state, not a
//    collapsed husk — and every summoned surface dismisses back to rest without
//    residue.
//  - **Persistence never persists semantic selection** (02 §6 rule 3). Bindings
//    are serialised without their `subjectRef`; a restored layout knows which
//    surfaces were open and where, and knows nothing about what was in focus.
//
// Pure module: layout in, layout out, no React, no storage, no Tauri.

export const WORKBENCH_LAYOUT_STORAGE_KEY = 'oi.desktop.workbench-layout/v2';
export const WORKBENCH_LAYOUT_VERSION = 2;

/** The five host regions. `sidecar` is the agency field (01 §4: agency at the left). */
export const WORKBENCH_REGIONS = Object.freeze(['navigator', 'sidecar', 'system', 'lower']);
export const FOCUSABLE_REGIONS = Object.freeze(['navigator', 'canvas', 'sidecar', 'lower', 'system']);

/** Region a binding is summoned into, and the canvas it can be promoted to. */
export const BINDING_REGIONS = Object.freeze(['canvas', 'navigator', 'sidecar', 'system', 'lower']);

function bindingId(surfaceRef) {
  return `presentation:${surfaceRef}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The resting shape (03 §J `J-rest`): agency field + canvas, nothing else.
 *
 * `restSurfaceRef` is the canvas's resting surface — the World tree (01 §2).
 * It is pinned, so a promoted or opened surface never displaces the tree
 * permanently: dismissing returns to it.
 */
export function restLayout(restSurfaceRef) {
  const binding = {
    bindingId: bindingId(restSurfaceRef),
    surfaceRef: restSurfaceRef,
    region: 'canvas',
    pinned: true,
    presentation: 'rest',
  };
  return {
    version: WORKBENCH_LAYOUT_VERSION,
    regions: {
      navigator: { present: false, width: 252 },
      sidecar: { present: true, width: 328 },
      system: { present: false, width: 300 },
      lower: { present: false, height: 220 },
    },
    split: 'single',
    groups: [{ groupId: 'group-1', tabs: [binding], activeBindingId: binding.bindingId }],
    summoned: [],
    focusedGroupId: 'group-1',
    /** Which binding the person is looking at — presentation focus only
     * (02 §6): the kernel's focus relation is never derived from it. */
    focusedBindingId: binding.bindingId,
    focusRegion: 'canvas',
    closed: [],
  };
}

function clone(layout) {
  return {
    ...layout,
    regions: Object.fromEntries(Object.entries(layout.regions).map(([region, state]) => [region, { ...state }])),
    groups: layout.groups.map((group) => ({ ...group, tabs: group.tabs.map((tab) => ({ ...tab })) })),
    summoned: layout.summoned.map((tab) => ({ ...tab })),
    closed: layout.closed.map((tab) => ({ ...tab })),
  };
}

export function summonRegion(layout, region) {
  if (!(region in layout.regions)) return layout;
  const next = clone(layout);
  next.regions[region].present = true;
  next.focusRegion = region;
  return next;
}

export function dismissRegion(layout, region) {
  if (!(region in layout.regions)) return layout;
  const next = clone(layout);
  next.regions[region].present = false;
  // No residue: a region that dismisses takes its summoned bindings with it.
  next.summoned = next.summoned.filter((tab) => tab.region !== region);
  if (next.focusRegion === region) next.focusRegion = 'canvas';
  return next;
}

export function toggleRegion(layout, region) {
  return layout.regions[region]?.present ? dismissRegion(layout, region) : summonRegion(layout, region);
}

/**
 * Find a binding by id, wherever it lives — a canvas group or a summoned
 * region. Exported so the host's keyboard and pointer paths can both ask the
 * same question about the focused binding (e.g. whether it is pinned).
 *
 * `preferredGroup` resolves which copy when one binding is shown in two
 * groups (a split): the copy in the preferred group wins.
 */
export function findBinding(layout, bindingId, preferredGroup) {
  const groups = preferredGroup
    ? [...layout.groups].sort((a, b) => (a.groupId === preferredGroup ? -1 : b.groupId === preferredGroup ? 1 : 0))
    : layout.groups;
  for (const group of groups) {
    const tab = group.tabs.find((candidate) => candidate.bindingId === bindingId);
    if (tab) return { tab, group };
  }
  const summoned = layout.summoned.find((candidate) => candidate.bindingId === bindingId);
  if (summoned) return { tab: summoned, group: null };
  return { tab: null, group: null };
}

/**
 * Summon `surfaceRef` into `region` (pointer and keyboard paths both land here).
 *
 * An existing binding for the same surface in the same region is reused —
 * summoning never mints a second identity for a surface already present (02 §8).
 */
export function summonSurface(layout, surfaceRef, region, descriptor = {}) {
  const next = clone(layout);
  const existing = next.summoned.find((tab) => tab.surfaceRef === surfaceRef && tab.region === region);
  if (!existing) {
    next.summoned.push({
      bindingId: bindingId(surfaceRef),
      surfaceRef,
      region,
      pinned: false,
      presentation: descriptor.presentation,
      provider: descriptor.provider,
      subjectRef: undefined,
    });
  }
  next.regions[region] = next.regions[region] ?? { present: true, width: 252, height: 220 };
  next.regions[region].present = true;
  next.focusRegion = region;
  return next;
}

/**
 * Promote a binding into the focused canvas group (03 §B `B3`).
 *
 * The binding moves — the same `bindingId`, the same `surfaceRef`, the same
 * `subjectRef` — only its region and area change. Promotion never mints
 * identity and never moves semantic state (02 §8).
 */
export function promoteBinding(layout, bindingId) {
  const { tab, group } = findBinding(layout, bindingId);
  if (!tab || group) return layout;
  if (tab.region === 'canvas') return layout;
  const next = clone(layout);
  const moved = { ...tab, region: 'canvas', homeRegion: tab.region };
  next.summoned = next.summoned.filter((candidate) => candidate.bindingId !== bindingId);
  const targetId = next.focusedGroupId || next.groups[0]?.groupId || 'group-1';
  const groups = next.groups.map((candidate) => candidate.groupId === targetId
    ? { ...candidate, tabs: [...candidate.tabs, moved], activeBindingId: moved.bindingId }
    : candidate);
  return { ...next, groups, focusedGroupId: targetId, focusRegion: 'canvas' };
}

/**
 * Return a promoted binding to the region it was summoned from (03 §B `B5`).
 * Same binding, original region — detaching and returning never mint identity.
 */
export function returnBinding(layout, bindingId) {
  const { tab, group } = findBinding(layout, bindingId);
  if (!tab || !group || tab.region !== 'canvas' || !tab.homeRegion) return layout;
  const home = tab.homeRegion;
  const next = clone(layout);
  next.groups = next.groups.map((candidate) => candidate.groupId !== group.groupId ? candidate : ({
    ...candidate,
    tabs: candidate.tabs.filter((candidateTab) => candidateTab.bindingId !== bindingId),
    activeBindingId: candidate.activeBindingId === bindingId
      ? candidate.tabs.filter((candidateTab) => candidateTab.bindingId !== bindingId).at(-1)?.bindingId
      : candidate.activeBindingId,
  }));
  next.summoned.push({ ...tab, region: home, homeRegion: undefined });
  next.regions[home] = next.regions[home] ?? { present: true, width: 252, height: 220 };
  next.regions[home].present = true;
  next.focusRegion = home;
  return next;
}

/**
 * Close a binding. Canvas tabs are kept for reopen; summoned ones are not.
 *
 * A pinned binding — the resting surface, which IS rest — is refused: it has
 * no close, by keyboard or by pointer (03 §J: rest is the product, and the
 * tree is the surface that owns the canvas).
 */
export function closeBinding(layout, bindingId, preferredGroup) {
  const { tab, group } = findBinding(layout, bindingId, preferredGroup);
  if (!tab || tab.pinned) return layout;
  const next = clone(layout);
  if (group) {
    next.closed = [tab, ...next.closed].slice(0, 20);
    next.groups = next.groups.map((candidate) => candidate.groupId !== group.groupId ? candidate : ({
      ...candidate,
      tabs: candidate.tabs.filter((candidateTab) => candidateTab.bindingId !== bindingId),
      activeBindingId: candidate.activeBindingId === bindingId
        ? candidate.tabs.filter((candidateTab) => candidateTab.bindingId !== bindingId).at(-1)?.bindingId
        : candidate.activeBindingId,
    }));
  } else {
    const region = tab.region;
    next.summoned = next.summoned.filter((candidate) => candidate.bindingId !== bindingId);
    const stillUsed = next.summoned.some((candidate) => candidate.region === region);
    if (!stillUsed && next.regions[region]) next.regions[region].present = false;
  }
  return next;
}

/** Bind a subject into an existing binding — presentation only, never focus. */
export function bindSubject(layout, bindingId, subjectRef) {
  const { tab } = findBinding(layout, bindingId);
  if (!tab) return layout;
  const next = clone(layout);
  next.groups = next.groups.map((group) => ({
    ...group,
    tabs: group.tabs.map((candidate) => candidate.bindingId === bindingId ? { ...candidate, subjectRef } : candidate),
  }));
  next.summoned = next.summoned.map((candidate) => candidate.bindingId === bindingId ? { ...candidate, subjectRef } : candidate);
  return next;
}

/**
 * Return to rest (03 §J): every summoned region absent, every non-pinned
 * canvas binding closed, the resting surface owning the canvas again.
 * Pinned bindings are the person's own; nothing else survives.
 */
export function returnToRest(layout, restSurfaceRef) {
  const next = clone(layout);
  for (const region of Object.keys(next.regions)) {
    if (region !== 'sidecar') next.regions[region].present = false;
  }
  next.summoned = [];
  next.groups = next.groups.map((group) => {
    const kept = group.tabs.filter((tab) => tab.pinned);
    const rest = kept.some((tab) => tab.surfaceRef === restSurfaceRef)
      ? kept
      : [...kept, {
        bindingId: bindingId(restSurfaceRef),
        surfaceRef: restSurfaceRef,
        region: 'canvas',
        pinned: true,
        presentation: 'rest',
      }];
    return { ...group, tabs: rest, activeBindingId: rest.at(-1).bindingId };
  });
  next.focusRegion = 'canvas';
  next.focusedBindingId = next.groups[0]?.activeBindingId;
  return next;
}

/**
 * Split the focused group's active binding into a second group (03 §B `B2`).
 * The same binding, one more area — the `bindingId` and the `subjectRef` are
 * carried untouched: one canonical Surface binding shown twice, never a second
 * identity minted for it (02 §8).
 */
export function splitBinding(layout, split) {
  if (split !== 'horizontal' && split !== 'vertical') return layout;
  const next = clone(layout);
  const source = next.groups.find((group) => group.groupId === next.focusedGroupId) ?? next.groups[0];
  const active = source?.tabs.find((tab) => tab.bindingId === source.activeBindingId);
  // A pinned binding is the resting surface itself; rest is one shape and is
  // not composed into two panes of it.
  if (!active || active.pinned) return next;
  const second = next.groups[1] ?? { groupId: 'group-2', tabs: [], activeBindingId: undefined };
  const duplicate = { ...active, pinned: false };
  next.groups = next.groups.length > 1
    ? next.groups.map((group) => group.groupId === second.groupId
      ? { ...group, tabs: [...group.tabs, duplicate], activeBindingId: duplicate.bindingId }
      : group)
    : [next.groups[0], { ...second, tabs: [duplicate], activeBindingId: duplicate.bindingId }];
  return { ...next, split, focusedGroupId: second.groupId, focusRegion: 'canvas' };
}

/**
 * Move (not copy) the focused group's active binding into the second group —
 * the same binding with a new area. Like `splitBinding`, the `subjectRef` is
 * carried untouched: splitting never mints identity (02 §8).
 */
export function moveBindingToSplit(layout, split) {
  if (split !== 'horizontal' && split !== 'vertical') return layout;
  const next = clone(layout);
  const source = next.groups.find((group) => group.groupId === next.focusedGroupId) ?? next.groups[0];
  const active = source?.tabs.find((tab) => tab.bindingId === source.activeBindingId);
  if (!active || active.pinned) return next;
  const second = next.groups[1] ?? { groupId: 'group-2', tabs: [], activeBindingId: undefined };
  const moved = { ...active, region: 'canvas', homeRegion: undefined };
  next.groups = next.groups.map((group) => group.groupId !== source.groupId ? group : ({
    ...group,
    tabs: group.tabs.filter((tab) => tab.bindingId !== active.bindingId),
    activeBindingId: group.activeBindingId === active.bindingId
      ? group.tabs.filter((tab) => tab.bindingId !== active.bindingId).at(-1)?.bindingId
      : group.activeBindingId,
  }));
  next.groups = next.groups.length > 1
    ? next.groups.map((group) => group.groupId === second.groupId
      ? { ...group, tabs: [...group.tabs, moved], activeBindingId: moved.bindingId }
      : group)
    : [next.groups[0], { ...second, tabs: [moved], activeBindingId: moved.bindingId }];
  return { ...next, split, focusedGroupId: second.groupId, focusRegion: 'canvas' };
}

/**
 * Serialise the layout for persistence (02 §6 rule 2): professional, versioned
 * — and **without any semantic fact** (rule 3). `subjectRef` is presentation's
 * record of what a surface was showing; it is exactly the kernel's selection
 * under another name, so it never survives persistence.
 */
export function serializeLayout(layout) {
  const strip = (tab) => {
    const { subjectRef, ...rest } = tab;
    return rest;
  };
  return JSON.stringify({
    version: WORKBENCH_LAYOUT_VERSION,
    regions: layout.regions,
    split: layout.split,
    groups: layout.groups.map((group) => ({ ...group, tabs: group.tabs.map(strip) })),
    summoned: layout.summoned.map(strip),
    focusedGroupId: layout.focusedGroupId,
    focusedBindingId: layout.focusedBindingId,
    focusRegion: layout.focusRegion,
    closed: layout.closed.map(strip),
  });
}

/**
 * Parse a persisted layout, failing closed to rest.
 *
 * Anything that is not a current-version layout — including one that still
 * carries semantic facts from an older shape, or one whose sub-objects are not
 * the shape they claim — restores as rest. A restored layout is presentation
 * only; the kernel's focus is pulled from the kernel.
 */
export function parseLayout(raw, restSurfaceRef) {
  if (!raw) return restLayout(restSurfaceRef);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return restLayout(restSurfaceRef);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return restLayout(restSurfaceRef);
  if (parsed.version !== WORKBENCH_LAYOUT_VERSION) return restLayout(restSurfaceRef);
  const base = restLayout(restSurfaceRef);
  if (!parsed.groups?.length && !parsed.summoned?.length) return base;
  // Defence in depth: even a same-version layout that smuggles a `subjectRef`
  // restores without it. Presentation is restored; selection never is.
  const strip = (tab) => {
    const { subjectRef: _discarded, ...rest } = tab ?? {};
    return rest;
  };
  // Shape checks (fail closed): a same-version payload whose sub-objects are
  // strings or arrays would otherwise spread into indexed props.
  const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const isTab = (tab) => isRecord(tab)
    && typeof tab.bindingId === 'string'
    && typeof tab.surfaceRef === 'string'
    && (tab.subjectRef === undefined || typeof tab.subjectRef === 'string');
  const isGroup = (group) => isRecord(group)
    && typeof group.groupId === 'string'
    && Array.isArray(group.tabs)
    && group.tabs.every(isTab);
  if (typeof parsed.regions !== 'undefined' && !isRecord(parsed.regions)) return base;
  if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.summoned) || !Array.isArray(parsed.closed)) return base;
  if (!parsed.groups.every(isGroup) || !parsed.summoned.every(isTab) || !parsed.closed.every(isTab)) return base;
  const regions = {};
  for (const [region, state] of Object.entries(parsed.regions ?? {})) {
    if (!(region in base.regions)) continue;
    if (!isRecord(state) || typeof state.present !== 'boolean') return base;
    if (state.width !== undefined && typeof state.width !== 'number') return base;
    if (state.height !== undefined && typeof state.height !== 'number') return base;
    regions[region] = { ...base.regions[region], ...state };
  }
  return {
    ...base,
    regions: { ...base.regions, ...regions },
    split: parsed.split === 'horizontal' || parsed.split === 'vertical' ? parsed.split : 'single',
    groups: parsed.groups.length
      ? parsed.groups.map((group) => ({
        ...group,
        tabs: group.tabs.map(strip),
        activeBindingId: typeof group?.activeBindingId === 'string' ? group.activeBindingId : undefined,
      }))
      : base.groups,
    summoned: parsed.summoned.map(strip),
    focusedGroupId: typeof parsed.focusedGroupId === 'string' ? parsed.focusedGroupId : base.focusedGroupId,
    focusedBindingId: typeof parsed.focusedBindingId === 'string' ? parsed.focusedBindingId : undefined,
    focusRegion: FOCUSABLE_REGIONS.includes(parsed.focusRegion) ? parsed.focusRegion : base.focusRegion,
    closed: parsed.closed.map(strip),
  };
}

/** Whether the layout currently is the resting shape (03 §J `J-rest`). */
export function isAtRest(layout, restSurfaceRef) {
  const summonedRegions = Object.entries(layout.regions).filter(([region, state]) => region !== 'sidecar' && state.present);
  const extraTabs = layout.groups.flatMap((group) => group.tabs).filter((tab) => tab.surfaceRef !== restSurfaceRef);
  return summonedRegions.length === 0 && layout.summoned.length === 0 && extraTabs.length === 0;
}
