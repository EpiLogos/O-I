import React, { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './workbench-host.css';
import {
  closeBinding,
  dismissRegion,
  findBinding,
  isAtRest,
  moveBindingToSplit,
  parseLayout,
  promoteBinding,
  restLayout,
  returnBinding,
  returnToRest,
  serializeLayout,
  splitBinding,
  summonRegion,
  summonSurface,
  toggleRegion,
  WORKBENCH_LAYOUT_STORAGE_KEY,
  type WorkbenchLayout,
} from './workbench-layout.mjs';

export type WorkbenchHostRegion = 'navigator' | 'canvas' | 'sidecar' | 'lower' | 'system';
export type WorkbenchSplit = 'single' | 'horizontal' | 'vertical';

export type SurfaceFocus = {
  surfaceRef: string;
  subjectRef?: string;
};

/// Host placement metadata for an already-existing native Surface.
///
/// `surfaceRef` remains the canonical Surface identity. `region` is retained for
/// the first P1 callers; `regions` allows one native Surface to be projected into
/// several host regions without minting a second Surface identity.
export type HostSurfaceDescriptor = {
  surfaceRef: string;
  title: string;
  nativeOwner: string;
  region?: WorkbenchHostRegion;
  regions?: WorkbenchHostRegion[];
  provenance?: string;
  state?: 'ready' | 'degraded' | 'unavailable';
  subjectRef?: string;
};

/// One Surface binding (02 §8): which presentation, which subject, which
/// provider, which region, which mode. The binding is presentation identity and
/// can move (summoned → centre → split → back) without ever minting a second
/// one; the *subject* stays canonical and kernel-owned.
export type SurfacePresentationBinding = {
  bindingId: string;
  surfaceRef: string;
  subjectRef?: string;
  provider?: string;
  presentation?: string;
  region: WorkbenchHostRegion;
  /** Where a promoted binding was summoned from — the region it returns to. */
  homeRegion?: Exclude<WorkbenchHostRegion, 'canvas'>;
  pinned: boolean;
};

const REGION_LABELS: Record<Exclude<WorkbenchHostRegion, 'canvas'>, string> = {
  navigator: 'Navigator',
  sidecar: 'Agency',
  lower: 'Lower / Deep',
  system: 'System',
};

/** What the shell can ask the host to do on a person's behalf — the same acts
 * the host's own keyboard and pointer paths perform, so parity is structural:
 * there is exactly one implementation of summon, open, promote and rest. */
export type WorkbenchHostHandle = {
  openSurface: (surfaceRef: string, region?: WorkbenchHostRegion, subjectRef?: string) => void;
  summonRegion: (region: Exclude<WorkbenchHostRegion, 'canvas'>) => void;
  rest: () => void;
};

const SUMMON_KEYS: Record<string, Exclude<WorkbenchHostRegion, 'canvas'>> = {
  b: 'navigator',
  j: 'lower',
  '/': 'system',
  '.': 'sidecar',
};

const SUMMON_KEY_HINT: Record<string, string> = {
  navigator: 'B',
  sidecar: '.',
  lower: 'J',
  system: '/',
};

export function ProfessionalWorkbenchHost({
  surfaces,
  restSurfaceRef,
  navigator,
  sidecar,
  lower,
  system,
  status,
  command,
  identity,
  onSurfaceFocus,
  onHostReady,
  renderSurface,
  renderRegionSurface,
}: {
  surfaces: HostSurfaceDescriptor[];
  /** The canvas's resting Surface — the World tree (01 §2). Rest returns to it. */
  restSurfaceRef: string;
  navigator: ReactNode;
  sidecar: ReactNode;
  lower: ReactNode;
  system: ReactNode;
  status: ReactNode;
  command: ReactNode;
  /** The quiet identity line beside the title (01 §4): World/Project, no chrome. */
  identity?: ReactNode;
  onSurfaceFocus?: (focus: SurfaceFocus) => void;
  /** Called with the host's single act set (open/summon/rest) whenever it changes. */
  onHostReady?: (handle: WorkbenchHostHandle) => void;
  renderSurface: (surface: HostSurfaceDescriptor, binding: SurfacePresentationBinding) => ReactNode;
  renderRegionSurface?: (surface: HostSurfaceDescriptor, region: Exclude<WorkbenchHostRegion, 'canvas'>) => ReactNode;
}) {
  const surfaceMap = useMemo(() => new Map(surfaces.map((surface) => [surface.surfaceRef, surface])), [surfaces]);
  const [layout, setLayout] = useState<WorkbenchLayout>(() => restLayout(restSurfaceRef));
  // Presentation focus lives in the layout itself, so every act that moves a
  // binding also moves focus in one state update — no two setters can race.
  const focusedBindingId = layout.focusedBindingId;
  const rootRef = useRef<HTMLElement | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  // Restore the persisted layout once. The restore carries no semantic fact:
  // the kernel's focus is pulled from the kernel, never from storage.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);
    } catch {
      stored = null;
    }
    setLayout(parseLayout(stored, restSurfaceRef));
    setStorageReady(true);
  }, [restSurfaceRef]);

  useEffect(() => {
    setLayout((current) => reconcileLayout(current, surfaceMap, restSurfaceRef));
  }, [surfaceMap, restSurfaceRef]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      // Persisted without semantic selection (02 §6 rule 3).
      localStorage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, serializeLayout(layout));
    } catch {
      // Provider-local persistence is optional. Native semantic state is never
      // recreated when browser storage is unavailable.
    }
  }, [layout, storageReady]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && (event.key.toLowerCase() === 'k' || event.key.toLowerCase() === 'p')) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('oi:open-command', { detail: { mode: event.key.toLowerCase() === 'p' ? 'search' : 'command' } }));
        return;
      }
      if (event.altKey && ['1', '2', '3', '4', '5'].includes(event.key)) {
        event.preventDefault();
        focusRegion((['navigator', 'canvas', 'sidecar', 'lower', 'system'] as WorkbenchHostRegion[])[Number(event.key) - 1]);
        return;
      }
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        cycleTab(event.shiftKey ? -1 : 1);
        return;
      }
      if (commandKey && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        dismissFocused();
        return;
      }
      if (commandKey && event.key === 'Enter') {
        event.preventDefault();
        promoteFocused();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        // An unpinned focused binding dismisses; a pinned one (the resting
        // surface) is left alone — Escape never closes rest, it recovers it.
        const focused = focusedBindingId ? findBinding(layout, focusedBindingId).tab : null;
        if (focused && !focused.pinned) {
          dismissFocused();
        } else if (!isAtRest(layout, restSurfaceRef)) {
          setLayout((current) => returnToRest(current, restSurfaceRef));
        }
        return;
      }
      if (commandKey && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        reopenClosed();
        return;
      }
      if (commandKey && event.key === '\\') {
        event.preventDefault();
        openCurrentInSplit(event.shiftKey ? 'vertical' : 'horizontal');
        return;
      }
      if (commandKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        returnFocused();
        return;
      }
      if (commandKey && !event.shiftKey) {
        const key = event.key === '/' ? '/' : event.key.toLowerCase();
        const region = SUMMON_KEYS[key];
        if (region) {
          event.preventDefault();
          setLayout((current) => toggleRegion(current, region));
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function focusRegion(region: WorkbenchHostRegion) {
    setLayout((current) => ({ ...current, focusRegion: region }));
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-host-region="${region}"]`)?.focus();
    });
  }

  /** Presentation focus only: which binding the person is looking at. The
   * semantic focus stays the kernel's (02 §6, §7) — a tab click never mints
   * selection. */
  function focusBinding(groupId: string, bindingId: string) {
    setLayout((current) => ({
      ...current,
      focusedBindingId: bindingId,
      focusedGroupId: groupId,
      focusRegion: 'canvas',
      groups: current.groups.map((group) => group.groupId === groupId ? { ...group, activeBindingId: bindingId } : group),
    }));
    const group = layout.groups.find((candidate) => candidate.groupId === groupId);
    const binding = group?.tabs.find((candidate) => candidate.bindingId === bindingId);
    if (binding) onSurfaceFocus?.({ surfaceRef: binding.surfaceRef, subjectRef: binding.subjectRef });
  }

  function openSurface(surfaceRef: string, region: WorkbenchHostRegion = 'canvas', subjectRef?: string) {
    const surface = surfaceMap.get(surfaceRef);
    if (!surface) return;
    if (region === 'canvas') {
      // Everything — the duplicate check and the placement — happens against
      // the updater's `current`, so two opens in one tick can never mint two
      // bindings for one subject (02 §8: one binding per Surface + subject).
      setLayout((current) => {
        for (const group of current.groups) {
          const existing = group.tabs.find((tab) => tab.surfaceRef === surfaceRef && tab.subjectRef === subjectRef);
          if (existing) {
            return {
              ...current,
              focusedBindingId: existing.bindingId,
              focusedGroupId: group.groupId,
              focusRegion: 'canvas',
              groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, activeBindingId: existing.bindingId } : candidate),
            };
          }
        }
        const groupId = current.focusedGroupId || current.groups[0]?.groupId || 'group-1';
        const binding: SurfacePresentationBinding = {
          bindingId: `presentation:${surfaceRef}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          surfaceRef,
          subjectRef,
          provider: surface.nativeOwner,
          presentation: surface.provenance,
          region: 'canvas',
          pinned: false,
        };
        return {
          ...current,
          focusedBindingId: binding.bindingId,
          focusedGroupId: groupId,
          focusRegion: 'canvas',
          groups: current.groups.map((group) => {
            if (group.groupId !== groupId) return group;
            const active = group.tabs.find((tab) => tab.bindingId === group.activeBindingId);
            if (active && !active.pinned) {
              return {
                ...group,
                tabs: group.tabs.map((tab) => tab.bindingId === active.bindingId ? binding : tab),
                activeBindingId: binding.bindingId,
              };
            }
            return { ...group, tabs: [...group.tabs, binding], activeBindingId: binding.bindingId };
          }),
        };
      });
      return;
    }
    setLayout((current) => summonSurface(current, surfaceRef, region, { provider: surface.nativeOwner, presentation: surface.provenance }));
  }

  /** Dismiss the focused binding: a summoned surface leaves no residue, and a
   * canvas surface closes back into the tree (03 §J invariants). A pinned
   * binding — the resting surface — has no dismiss: rest cannot dismiss
   * itself, by Escape, by Cmd+W, or by the strip. */
  function dismissFocused() {
    if (!focusedBindingId) return;
    const target = focusedBindingId;
    const { tab } = findBinding(layout, target, layout.focusedGroupId);
    if (!tab || tab.pinned) return;
    setLayout((current) => ({ ...closeBinding(current, target, current.focusedGroupId), focusedBindingId: undefined }));
  }

  /** Promote the focused summoned surface to the centre (03 §B B3): same
   * binding, same subject, larger region. */
  function promoteFocused() {
    if (!focusedBindingId) return;
    setLayout((current) => promoteBinding(current, focusedBindingId));
  }

  /** Return a promoted surface to the region it was summoned from (03 §B B5). */
  function returnFocused() {
    if (!focusedBindingId) return;
    setLayout((current) => returnBinding(current, focusedBindingId));
  }

  /** Return to rest (03 §J): agency field + canvas, nothing else. */
  function rest() {
    setLayout((current) => returnToRest(current, restSurfaceRef));
  }

  function reopenClosed() {
    setLayout((current) => {
      const [binding, ...closed] = current.closed;
      if (!binding) return current;
      const surface = surfaceMap.get(binding.surfaceRef);
      if (!surface) return { ...current, closed };
      const groupId = current.focusedGroupId || current.groups[0]?.groupId || 'group-1';
      const restored: SurfacePresentationBinding = { ...binding, bindingId: `presentation:${binding.surfaceRef}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, region: 'canvas' };
      return {
        ...current,
        closed,
        groups: current.groups.map((group) => group.groupId === groupId ? { ...group, tabs: [...group.tabs, restored], activeBindingId: restored.bindingId } : group),
      };
    });
  }

  function cycleTab(delta: number) {
    const group = layout.groups.find((candidate) => candidate.groupId === layout.focusedGroupId) ?? layout.groups[0];
    if (!group?.tabs.length) return;
    const index = Math.max(0, group.tabs.findIndex((tab) => tab.bindingId === group.activeBindingId));
    const next = group.tabs[(index + delta + group.tabs.length) % group.tabs.length];
    onSurfaceFocus?.({ surfaceRef: next.surfaceRef, subjectRef: next.subjectRef });
    setLayout((current) => ({
      ...current,
      focusedBindingId: next.bindingId,
      groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, activeBindingId: next.bindingId } : candidate),
    }));
  }

  /** Open the current Surface in a second group (03 §B B2): the same subject,
   * one more area — never a second identity. */
  function openCurrentInSplit(split: Exclude<WorkbenchSplit, 'single'>) {
    setLayout((current) => splitBinding(current, split));
  }

  function moveActiveToSplit(split: Exclude<WorkbenchSplit, 'single'>) {
    setLayout((current) => moveBindingToSplit(current, split));
  }

  function togglePinned(groupId: string, bindingId: string) {
    // The resting surface is pinned by grammar, not by preference: it can
    // never be unpinned into dismissibility.
    const group = layout.groups.find((candidate) => candidate.groupId === groupId);
    const target = group?.tabs.find((tab) => tab.bindingId === bindingId);
    if (!target || target.surfaceRef === restSurfaceRef) return;
    setLayout((current) => ({
      ...current,
      groups: current.groups.map((candidate) => candidate.groupId === groupId ? {
        ...candidate,
        tabs: candidate.tabs.map((tab) => tab.bindingId === bindingId ? { ...tab, pinned: !tab.pinned } : tab),
      } : candidate),
    }));
  }

  function beginResize(region: 'navigator' | 'sidecar' | 'system' | 'lower', event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = layout.regions;
    function onMove(move: PointerEvent) {
      setLayout((current) => {
        const regions = { ...current.regions };
        if (region === 'navigator') regions.navigator.width = clamp(initial.navigator.width + move.clientX - startX, 180, 440);
        if (region === 'sidecar') regions.sidecar.width = clamp(initial.sidecar.width + startX - move.clientX, 240, 520);
        if (region === 'system') regions.system.width = clamp(initial.system.width + startX - move.clientX, 240, 520);
        if (region === 'lower') regions.lower.height = clamp(initial.lower.height + startY - move.clientY, 120, 520);
        return { ...current, regions };
      });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const regions = layout.regions;
  const columns: Array<{ name: string; area: string; size: string }> = [];

  const handle = useMemo<WorkbenchHostHandle>(() => ({
    openSurface,
    summonRegion: (region) => setLayout((current) => summonRegion(current, region)),
    rest,
  }), [layout, surfaceMap, onSurfaceFocus]);

  useEffect(() => {
    onHostReady?.(handle);
  }, [handle, onHostReady]);

  if (regions.sidecar.present) columns.push({ name: 'sidecar', area: 'side', size: 'var(--oi-sidecar-width)' });
  if (regions.navigator.present) columns.push({ name: 'navigator', area: 'nav', size: 'var(--oi-nav-width)' });
  columns.push({ name: 'canvas', area: 'canvas', size: 'minmax(0, 1fr)' });
  if (regions.system.present) columns.push({ name: 'system', area: 'sys', size: 'var(--oi-system-width)' });
  const mainRow = columns.map((column) => column.area).join(' ');
  const lowerRow = columns.map((column) => (column.name === 'canvas' && regions.lower.present ? 'lower' : '.')).join(' ');
  const stripRow = columns.map((column) => (column.name === 'canvas' ? 'strip' : '.')).join(' ');
  const statusRow = columns.map((column) => (column.name === 'canvas' ? 'status' : '.')).join(' ');
  const style = {
    '--oi-nav-width': `${regions.navigator.width}px`,
    '--oi-sidecar-width': `${regions.sidecar.width}px`,
    '--oi-system-width': `${regions.system.width}px`,
    '--oi-lower-height': `${regions.lower.height}px`,
    gridTemplateColumns: columns.map((column) => column.size).join(' '),
    gridTemplateRows: [
      regions.lower.present ? 'minmax(0, 1fr) var(--oi-lower-height)' : 'minmax(0, 1fr)',
      'auto',
      'auto',
    ].join(' '),
    gridTemplateAreas: `"${mainRow}" "${lowerRow}" "${stripRow}" "${statusRow}"`,
  } as React.CSSProperties;

  const visibleGroups = layout.split === 'single' ? layout.groups.slice(0, 1) : layout.groups.slice(0, 2);
  const regionSurfaceProps = { surfaces, renderRegionSurface, onSurfaceFocus, onSummonSurface: openSurface };
  const atRest = isAtRest(layout, restSurfaceRef);
  /** The binding the person is looking at, if it can be acted on. The pinned
   * resting surface is deliberately excluded: rest offers nothing to promote,
   * return or dismiss — it IS rest. */
  const focusedBinding = focusedBindingId ? findBinding(layout, focusedBindingId, layout.focusedGroupId).tab : null;
  const summonTargets: Array<{ region: Exclude<WorkbenchHostRegion, 'canvas'>; label: string }> = [
    { region: 'navigator', label: 'World navigator' },
    { region: 'sidecar', label: 'Agency field' },
    { region: 'lower', label: 'Lower / deep' },
    { region: 'system', label: 'System' },
  ];

  const regionSurfaces: Record<Exclude<WorkbenchHostRegion, 'canvas'>, ReactNode> = {
    navigator: <HostRegionSurfaces region="navigator" {...regionSurfaceProps} />,
    sidecar: <HostRegionSurfaces region="sidecar" {...regionSurfaceProps} />,
    lower: <HostRegionSurfaces region="lower" {...regionSurfaceProps} />,
    system: <HostRegionSurfaces region="system" {...regionSurfaceProps} />,
  };

  const regionBodies: Record<Exclude<WorkbenchHostRegion, 'canvas'>, ReactNode> = {
    navigator,
    sidecar,
    system,
    lower,
  };

  return (
    <main ref={rootRef} className="oi-professional-host oi-surface-light" style={style} data-split={layout.split} data-at-rest={atRest}>
      {(['navigator', 'sidecar', 'system', 'lower'] as const).map((region) => {
        if (!regions[region].present) return null;
        const collapsedToStrip = region === 'sidecar' && regions.sidecar.width <= 72;
        return (
          <aside
            key={region}
            className={`oi-host-region oi-host-${region}`}
            data-host-region={region}
            tabIndex={-1}
            aria-label={REGION_LABELS[region]}
          >
            {region !== 'sidecar' && <div className="oi-resize-handle oi-resize-handle--left" onPointerDown={(event) => beginResize(region, event)} />}
            {region === 'lower' && <div className="oi-resize-handle oi-resize-handle--y" onPointerDown={(event) => beginResize(region, event)} />}
            <div className="oi-host-region__toolbar">
              {!collapsedToStrip && <strong>{REGION_LABELS[region]}</strong>}
              <button
                type="button"
                aria-label={`Dismiss ${REGION_LABELS[region]}`}
                title={`Dismiss (Esc) — keyboard and pointer do the same thing`}
                onClick={() => setLayout((current) => dismissRegion(current, region))}
              >⇥</button>
            </div>
            {!collapsedToStrip && (
              <div className={`oi-host-region__body${region === 'sidecar' ? ' oi-shell__inspector' : ''}`}>
                {regionBodies[region]}
                {regionSurfaces[region]}
              </div>
            )}
          </aside>
        );
      })}

      <section className="oi-host-canvas" data-host-region="canvas" tabIndex={-1} aria-label="Primary Canvas">
        <div className="oi-host-canvas__toolbar">
          <div className="oi-host-canvas__identity">{identity}</div>
          {/* Compose has one grammar for pointer and keyboard: these buttons
           * call the exact functions the Cmd+\ / Cmd+Shift+\ paths call. */}
          <div className="oi-host-canvas__layout-actions" role="toolbar" aria-label="Editor group layout">
            <button type="button" data-split-action="horizontal" title="Open current Surface in horizontal split (⌘\)" onClick={() => openCurrentInSplit('horizontal')}>Split H</button>
            <button type="button" data-split-action="vertical" title="Open current Surface in vertical split (⌘⇧\)" onClick={() => openCurrentInSplit('vertical')}>Split V</button>
            <button type="button" data-split-action="move" title="Move current Surface to the split" onClick={() => moveActiveToSplit(layout.split === 'vertical' ? 'vertical' : 'horizontal')}>Move</button>
            <button
              type="button"
              data-split-action="single"
              title="Collapse back to one group"
              onClick={() => setLayout((current) => ({
                ...current,
                split: 'single',
                groups: current.groups.slice(0, 1),
                focusedGroupId: current.groups[0]?.groupId ?? current.focusedGroupId,
                focusedBindingId: current.groups[0]?.activeBindingId,
              }))}
            >Single</button>
          </div>
          {command}
        </div>

        <div className="oi-host-canvas__groups">
          {visibleGroups.map((group) => {
            const active = group.tabs.find((tab) => tab.bindingId === group.activeBindingId) ?? group.tabs[0];
            return (
              <section key={group.groupId} className="oi-editor-group" data-focused={layout.focusedGroupId === group.groupId} onPointerDown={() => setLayout((current) => ({ ...current, focusedGroupId: group.groupId, focusRegion: 'canvas' }))}>
                {group.tabs.length > 1 && (
                  <div className="oi-editor-tabs" role="tablist" aria-label={`${group.groupId} Surface tabs`}>
                    {group.tabs.map((binding) => {
                      const descriptor = surfaceMap.get(binding.surfaceRef);
                      return (
                        <div key={binding.bindingId} className="oi-editor-tab" data-active={binding.bindingId === active?.bindingId} data-stale={!descriptor}>
                          <button type="button" role="tab" aria-selected={binding.bindingId === active?.bindingId} onClick={() => focusBinding(group.groupId, binding.bindingId)}>
                            {binding.pinned ? '● ' : ''}{descriptor?.title ?? 'Unavailable Surface'}
                          </button>
                          <button type="button" aria-label="Pin presentation" onClick={() => togglePinned(group.groupId, binding.bindingId)}>{binding.pinned ? '◇' : '◆'}</button>
                          {/* A pinned binding is the resting surface: it has no
                           * close, so no × is rendered for it at all. */}
                          {!binding.pinned && (
                            <button type="button" aria-label="Close presentation" onClick={() => {
                              setLayout((current) => closeBinding(current, binding.bindingId, group.groupId));
                            }}>×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="oi-editor-surface" role="tabpanel">
                  {!active && <HostEmptyState surfaces={surfaces.filter((surface) => surfaceRegions(surface).includes('canvas'))} onOpen={openSurface} />}
                  {active && !surfaceMap.has(active.surfaceRef) && (
                    <div className="oi-host-stale">
                      <strong>Surface no longer available</strong>
                      <p>{active.surfaceRef}</p>
                      <p>This provider-local presentation binding is stale. O:I will not recreate the missing native Surface or semantic subject.</p>
                    </div>
                  )}
                  {active && surfaceMap.has(active.surfaceRef) && renderSurface(surfaceMap.get(active.surfaceRef)!, active)}
                </div>
              </section>
            );
          })}
        </div>

        {/* The resting shape's one quiet affordance line (01 §4): everything
         * here is summoned depth, dismissible back to rest. Pointer and
         * keyboard do exactly the same thing. */}
        <div className="oi-host-summon" role="toolbar" aria-label="Summoned depth">
          {!atRest && <button type="button" onClick={rest} title="Return to rest (Esc)">Rest</button>}
          {summonTargets.map((target) => (
            <button
              key={target.region}
              type="button"
              data-region={target.region}
              aria-pressed={regions[target.region].present}
              onClick={() => setLayout((current) => toggleRegion(current, target.region))}
              title={`Summon or dismiss ${REGION_LABELS[target.region]} (⌘${SUMMON_KEY_HINT[target.region]})`}
            >{REGION_LABELS[target.region]}</button>
          ))}
          {focusedBinding && !focusedBinding.pinned && (
            <>
              <button type="button" onClick={promoteFocused} title="Promote the focused surface to the centre (⌘Enter)">Promote</button>
              <button type="button" onClick={returnFocused} title="Return the focused surface to its summoned region (⌘R)">Return</button>
              <button type="button" onClick={dismissFocused} title="Dismiss the focused surface (⌘W or Esc)">Dismiss</button>
            </>
          )}
        </div>
      </section>

      <footer className="oi-host-status" aria-label="Status and context bar">{status}</footer>
    </main>
  );
}

function HostRegionSurfaces({
  surfaces,
  region,
  renderRegionSurface,
  onSurfaceFocus,
  onSummonSurface,
}: {
  surfaces: HostSurfaceDescriptor[];
  region: Exclude<WorkbenchHostRegion, 'canvas'>;
  renderRegionSurface?: (surface: HostSurfaceDescriptor, region: Exclude<WorkbenchHostRegion, 'canvas'>) => ReactNode;
  onSurfaceFocus?: (focus: SurfaceFocus) => void;
  onSummonSurface?: (surfaceRef: string, region: WorkbenchHostRegion) => void;
}) {
  const placed = surfaces.filter((surface) => surfaceRegions(surface).includes(region));
  if (!placed.length) return null;
  return (
    <div className="oi-host-region-surfaces" data-surface-region={region}>
      {placed.map((surface) => (
        <section
          key={`${region}:${surface.surfaceRef}`}
          className="oi-host-region-surface"
          data-surface-ref={surface.surfaceRef}
          data-surface-state={surface.state ?? 'ready'}
          onPointerDown={() => onSurfaceFocus?.({ surfaceRef: surface.surfaceRef, subjectRef: surface.subjectRef })}
        >
          {renderRegionSurface ? renderRegionSurface(surface, region) : <DefaultRegionSurface surface={surface} onOpen={() => onSummonSurface?.(surface.surfaceRef, region)} />}
        </section>
      ))}
    </div>
  );
}

/** A region surface the vertical's scope has not reached yet renders as what it
 * is — a placement descriptor with an explicit summon act — never as a fake
 * reading (02 §11 Retire). */
function DefaultRegionSurface({ surface, onOpen }: { surface: HostSurfaceDescriptor; onOpen: () => void }) {
  return (
    <div className="oi-host-region-surface__descriptor">
      <strong>{surface.title}</strong>
      <code>{surface.surfaceRef}</code>
      <small>{surface.nativeOwner}{surface.provenance ? ` · ${surface.provenance}` : ''}</small>
      <button type="button" onClick={onOpen}>Summon to centre</button>
    </div>
  );
}

function HostEmptyState({ surfaces, onOpen }: { surfaces: HostSurfaceDescriptor[]; onOpen: (surfaceRef: string, region?: WorkbenchHostRegion) => void }) {
  return (
    <div className="oi-host-empty">
      <p>No Surface is open in this editor group.</p>
      <div>{surfaces.map((surface) => <button type="button" key={surface.surfaceRef} onClick={() => onOpen(surface.surfaceRef, 'canvas')}>Open {surface.title}</button>)}</div>
    </div>
  );
}

function reconcileLayout(layout: WorkbenchLayout, surfaces: Map<string, HostSurfaceDescriptor>, restSurfaceRef: string): WorkbenchLayout {
  const groups = layout.groups.length ? layout.groups : [{ groupId: 'group-1', tabs: [], activeBindingId: undefined }];
  const hasAnyBinding = groups.some((group) => group.tabs.length > 0);
  if (hasAnyBinding) return { ...layout, groups };
  if (!surfaces.has(restSurfaceRef)) return { ...layout, groups };
  const binding: SurfacePresentationBinding = {
    bindingId: `presentation:${restSurfaceRef}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    surfaceRef: restSurfaceRef,
    region: 'canvas',
    pinned: true,
    presentation: 'rest',
  };
  return {
    ...layout,
    groups: groups.map((group, index) => index === 0 ? { ...group, tabs: [binding], activeBindingId: binding.bindingId } : group),
  };
}

function surfaceRegions(surface: HostSurfaceDescriptor): WorkbenchHostRegion[] {
  const regions: WorkbenchHostRegion[] = surface.regions?.length
    ? surface.regions
    : surface.region
      ? [surface.region]
      : ['canvas'];
  return [...new Set(regions)];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export type { WorkbenchLayout };
