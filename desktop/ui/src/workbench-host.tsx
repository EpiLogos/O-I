import React, { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './workbench-host.css';

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

export type SurfacePresentationBinding = {
  bindingId: string;
  surfaceRef: string;
  subjectRef?: string;
  pinned: boolean;
};

type CanvasGroup = {
  groupId: string;
  tabs: SurfacePresentationBinding[];
  activeBindingId?: string;
};

type RegionLayout = {
  navigatorCollapsed: boolean;
  sidecarCollapsed: boolean;
  lowerCollapsed: boolean;
  systemCollapsed: boolean;
  navigatorWidth: number;
  sidecarWidth: number;
  systemWidth: number;
  lowerHeight: number;
};

type WorkbenchLayout = {
  version: 1;
  regions: RegionLayout;
  split: WorkbenchSplit;
  groups: CanvasGroup[];
  focusedGroupId: string;
  focusRegion: WorkbenchHostRegion;
  closed: SurfacePresentationBinding[];
};

const STORAGE_KEY = 'oi.desktop.workbench-layout/v1';
const DEFAULT_REGIONS: RegionLayout = {
  navigatorCollapsed: false,
  sidecarCollapsed: false,
  lowerCollapsed: false,
  systemCollapsed: true,
  navigatorWidth: 252,
  sidecarWidth: 328,
  systemWidth: 300,
  lowerHeight: 220,
};

export function ProfessionalWorkbenchHost({
  surfaces,
  initialSurfaceRef,
  navigator,
  sidecar,
  lower,
  system,
  status,
  command,
  onSurfaceFocus,
  renderSurface,
  renderRegionSurface,
}: {
  surfaces: HostSurfaceDescriptor[];
  initialSurfaceRef: string;
  navigator: ReactNode;
  sidecar: ReactNode;
  lower: ReactNode;
  system: ReactNode;
  status: ReactNode;
  command: ReactNode;
  onSurfaceFocus?: (focus: SurfaceFocus) => void;
  renderSurface: (surface: HostSurfaceDescriptor, binding: SurfacePresentationBinding) => ReactNode;
  renderRegionSurface?: (surface: HostSurfaceDescriptor, region: Exclude<WorkbenchHostRegion, 'canvas'>) => ReactNode;
}) {
  const surfaceMap = useMemo(() => new Map(surfaces.map((surface) => [surface.surfaceRef, surface])), [surfaces]);
  const [layout, setLayout] = useState<WorkbenchLayout>(() => initialLayout(initialSurfaceRef));
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setLayout((current) => reconcileLayout(current, surfaceMap, initialSurfaceRef));
  }, [surfaceMap, initialSurfaceRef]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Provider-local persistence is optional. Native semantic state is never
      // recreated when browser storage is unavailable.
    }
  }, [layout]);

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
        closeActive();
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
      if (commandKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleRegion('navigator');
        return;
      }
      if (commandKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggleRegion('lower');
        return;
      }
      if (commandKey && event.key === '.') {
        event.preventDefault();
        toggleRegion('sidecar');
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

  function focusBinding(groupId: string, bindingId: string) {
    setLayout((current) => ({
      ...current,
      focusedGroupId: groupId,
      focusRegion: 'canvas',
      groups: current.groups.map((group) => group.groupId === groupId ? { ...group, activeBindingId: bindingId } : group),
    }));
    const group = layout.groups.find((candidate) => candidate.groupId === groupId);
    const binding = group?.tabs.find((candidate) => candidate.bindingId === bindingId);
    if (binding) onSurfaceFocus?.({ surfaceRef: binding.surfaceRef, subjectRef: binding.subjectRef });
  }

  function openSurface(surfaceRef: string, pinned = false) {
    const surface = surfaceMap.get(surfaceRef);
    if (!surface || !surfaceRegions(surface).includes('canvas')) return;
    setLayout((current) => {
      for (const group of current.groups) {
        const existing = group.tabs.find((tab) => tab.surfaceRef === surfaceRef && tab.subjectRef === surface.subjectRef);
        if (existing) {
          onSurfaceFocus?.({ surfaceRef, subjectRef: existing.subjectRef });
          return {
            ...current,
            focusedGroupId: group.groupId,
            focusRegion: 'canvas',
            groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, activeBindingId: existing.bindingId } : candidate),
          };
        }
      }
      const groupId = current.focusedGroupId || current.groups[0]?.groupId || 'group-1';
      const binding = bindingFor(surface, pinned);
      const groups = current.groups.map((group) => {
        if (group.groupId !== groupId) return group;
        const active = group.tabs.find((tab) => tab.bindingId === group.activeBindingId);
        if (active && !active.pinned && !pinned) {
          return {
            ...group,
            tabs: group.tabs.map((tab) => tab.bindingId === active.bindingId ? binding : tab),
            activeBindingId: binding.bindingId,
          };
        }
        return { ...group, tabs: [...group.tabs, binding], activeBindingId: binding.bindingId };
      });
      onSurfaceFocus?.({ surfaceRef, subjectRef: surface.subjectRef });
      return { ...current, groups, focusedGroupId: groupId, focusRegion: 'canvas' };
    });
  }

  function closeActive() {
    setLayout((current) => {
      const group = current.groups.find((candidate) => candidate.groupId === current.focusedGroupId) ?? current.groups[0];
      if (!group?.activeBindingId) return current;
      const closing = group.tabs.find((tab) => tab.bindingId === group.activeBindingId);
      if (!closing) return current;
      const remaining = group.tabs.filter((tab) => tab.bindingId !== closing.bindingId);
      const nextActive = remaining.at(-1)?.bindingId;
      return {
        ...current,
        closed: [closing, ...current.closed].slice(0, 20),
        groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, tabs: remaining, activeBindingId: nextActive } : candidate),
      };
    });
  }

  function reopenClosed() {
    setLayout((current) => {
      const [binding, ...closed] = current.closed;
      if (!binding) return current;
      const surface = surfaceMap.get(binding.surfaceRef);
      if (!surface || !surfaceRegions(surface).includes('canvas')) return { ...current, closed };
      const groupId = current.focusedGroupId || current.groups[0]?.groupId || 'group-1';
      const restored = { ...binding, bindingId: presentationId(binding.surfaceRef) };
      return {
        ...current,
        closed,
        groups: current.groups.map((group) => group.groupId === groupId ? { ...group, tabs: [...group.tabs, restored], activeBindingId: restored.bindingId } : group),
      };
    });
  }

  function cycleTab(delta: number) {
    setLayout((current) => {
      const group = current.groups.find((candidate) => candidate.groupId === current.focusedGroupId) ?? current.groups[0];
      if (!group?.tabs.length) return current;
      const index = Math.max(0, group.tabs.findIndex((tab) => tab.bindingId === group.activeBindingId));
      const next = group.tabs[(index + delta + group.tabs.length) % group.tabs.length];
      onSurfaceFocus?.({ surfaceRef: next.surfaceRef, subjectRef: next.subjectRef });
      return {
        ...current,
        groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, activeBindingId: next.bindingId } : candidate),
      };
    });
  }

  function openCurrentInSplit(split: Exclude<WorkbenchSplit, 'single'>) {
    setLayout((current) => {
      const source = current.groups.find((candidate) => candidate.groupId === current.focusedGroupId) ?? current.groups[0];
      const active = source?.tabs.find((tab) => tab.bindingId === source.activeBindingId);
      if (!active) return current;
      const second = current.groups[1] ?? { groupId: 'group-2', tabs: [], activeBindingId: undefined };
      const duplicate = { ...active, bindingId: presentationId(active.surfaceRef) };
      const groups = current.groups.length > 1
        ? current.groups.map((group) => group.groupId === second.groupId ? { ...group, tabs: [...group.tabs, duplicate], activeBindingId: duplicate.bindingId } : group)
        : [current.groups[0], { ...second, tabs: [duplicate], activeBindingId: duplicate.bindingId }];
      return { ...current, split, groups, focusedGroupId: second.groupId, focusRegion: 'canvas' };
    });
  }

  function moveActiveToSplit(split: Exclude<WorkbenchSplit, 'single'>) {
    setLayout((current) => {
      const source = current.groups.find((candidate) => candidate.groupId === current.focusedGroupId) ?? current.groups[0];
      const active = source?.tabs.find((tab) => tab.bindingId === source.activeBindingId);
      if (!active) return current;
      const second = current.groups.find((group) => group.groupId !== source.groupId) ?? { groupId: source.groupId === 'group-1' ? 'group-2' : 'group-1', tabs: [], activeBindingId: undefined };
      const sourceTabs = source.tabs.filter((tab) => tab.bindingId !== active.bindingId);
      const updatedSource = { ...source, tabs: sourceTabs, activeBindingId: sourceTabs.at(-1)?.bindingId };
      const updatedSecond = { ...second, tabs: [...second.tabs, active], activeBindingId: active.bindingId };
      const groups = current.groups.filter((group) => group.groupId !== source.groupId && group.groupId !== second.groupId);
      groups.push(updatedSource, updatedSecond);
      return { ...current, split, groups, focusedGroupId: updatedSecond.groupId, focusRegion: 'canvas' };
    });
  }

  function togglePinned(groupId: string, bindingId: string) {
    setLayout((current) => ({
      ...current,
      groups: current.groups.map((group) => group.groupId === groupId ? {
        ...group,
        tabs: group.tabs.map((tab) => tab.bindingId === bindingId ? { ...tab, pinned: !tab.pinned } : tab),
      } : group),
    }));
  }

  function toggleRegion(region: Exclude<WorkbenchHostRegion, 'canvas'>) {
    const key = `${region}Collapsed` as keyof RegionLayout;
    setLayout((current) => ({
      ...current,
      regions: { ...current.regions, [key]: !current.regions[key] },
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
        if (region === 'navigator') regions.navigatorWidth = clamp(initial.navigatorWidth + move.clientX - startX, 180, 440);
        if (region === 'sidecar') regions.sidecarWidth = clamp(initial.sidecarWidth + startX - move.clientX, 240, 520);
        if (region === 'system') regions.systemWidth = clamp(initial.systemWidth + startX - move.clientX, 240, 520);
        if (region === 'lower') regions.lowerHeight = clamp(initial.lowerHeight + startY - move.clientY, 120, 520);
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

  const style = {
    '--oi-nav-width': `${layout.regions.navigatorCollapsed ? 44 : layout.regions.navigatorWidth}px`,
    '--oi-sidecar-width': `${layout.regions.sidecarCollapsed ? 0 : layout.regions.sidecarWidth}px`,
    '--oi-system-width': `${layout.regions.systemCollapsed ? 0 : layout.regions.systemWidth}px`,
    '--oi-lower-height': `${layout.regions.lowerCollapsed ? 34 : layout.regions.lowerHeight}px`,
  } as React.CSSProperties;

  const visibleGroups = layout.split === 'single' ? layout.groups.slice(0, 1) : layout.groups.slice(0, 2);
  const regionSurfaceProps = { surfaces, renderRegionSurface, onSurfaceFocus };

  return (
    <main ref={rootRef} className="oi-professional-host oi-surface-light" style={style} data-split={layout.split}>
      <aside className="oi-host-region oi-host-navigator" data-host-region="navigator" tabIndex={-1} aria-label="Navigator">
        <div className="oi-host-region__toolbar">
          <strong>{layout.regions.navigatorCollapsed ? 'O:I' : 'Navigator'}</strong>
          <button type="button" aria-label="Toggle navigator" onClick={() => toggleRegion('navigator')}>⇤</button>
        </div>
        {!layout.regions.navigatorCollapsed && (
          <div className="oi-host-region__body">
            {navigator}
            <HostRegionSurfaces region="navigator" {...regionSurfaceProps} />
          </div>
        )}
        {!layout.regions.navigatorCollapsed && <div className="oi-resize-handle oi-resize-handle--x" onPointerDown={(event) => beginResize('navigator', event)} />}
      </aside>

      <section className="oi-host-canvas" data-host-region="canvas" tabIndex={-1} aria-label="Primary Canvas">
        <div className="oi-host-canvas__toolbar">
          <div className="oi-host-canvas__surface-menu">
            {surfaces.filter((surface) => surfaceRegions(surface).includes('canvas')).map((surface) => (
              <button key={surface.surfaceRef} type="button" onClick={() => openSurface(surface.surfaceRef)}>{surface.title}</button>
            ))}
          </div>
          <div className="oi-host-canvas__layout-actions">
            <button type="button" title="Open current Surface in horizontal split" onClick={() => openCurrentInSplit('horizontal')}>Split H</button>
            <button type="button" title="Open current Surface in vertical split" onClick={() => openCurrentInSplit('vertical')}>Split V</button>
            <button type="button" title="Move current Surface to split" onClick={() => moveActiveToSplit(layout.split === 'vertical' ? 'vertical' : 'horizontal')}>Move</button>
            <button type="button" onClick={() => setLayout((current) => ({ ...current, split: 'single', groups: current.groups.slice(0, 1) }))}>Single</button>
          </div>
          {command}
        </div>

        <div className="oi-host-canvas__groups">
          {visibleGroups.map((group) => {
            const active = group.tabs.find((tab) => tab.bindingId === group.activeBindingId) ?? group.tabs[0];
            return (
              <section key={group.groupId} className="oi-editor-group" data-focused={layout.focusedGroupId === group.groupId} onPointerDown={() => setLayout((current) => ({ ...current, focusedGroupId: group.groupId, focusRegion: 'canvas' }))}>
                <div className="oi-editor-tabs" role="tablist" aria-label={`${group.groupId} Surface tabs`}>
                  {group.tabs.map((binding) => {
                    const descriptor = surfaceMap.get(binding.surfaceRef);
                    return (
                      <div key={binding.bindingId} className="oi-editor-tab" data-active={binding.bindingId === active?.bindingId} data-stale={!descriptor}>
                        <button type="button" role="tab" aria-selected={binding.bindingId === active?.bindingId} onClick={() => focusBinding(group.groupId, binding.bindingId)}>
                          {binding.pinned ? '● ' : ''}{descriptor?.title ?? 'Unavailable Surface'}
                        </button>
                        <button type="button" aria-label="Pin presentation" onClick={() => togglePinned(group.groupId, binding.bindingId)}>{binding.pinned ? '◇' : '◆'}</button>
                        <button type="button" aria-label="Close presentation" onClick={() => {
                          setLayout((current) => ({ ...current, focusedGroupId: group.groupId, groups: current.groups.map((candidate) => candidate.groupId === group.groupId ? { ...candidate, activeBindingId: binding.bindingId } : candidate) }));
                          queueMicrotask(closeActive);
                        }}>×</button>
                      </div>
                    );
                  })}
                </div>
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
      </section>

      <aside className="oi-host-region oi-host-sidecar" data-host-region="sidecar" tabIndex={-1} aria-label="Agency Sidecar">
        {!layout.regions.sidecarCollapsed && <div className="oi-resize-handle oi-resize-handle--left" onPointerDown={(event) => beginResize('sidecar', event)} />}
        <div className="oi-host-region__toolbar">
          {!layout.regions.sidecarCollapsed && <strong>Agency / Inspector</strong>}
          <button type="button" aria-label="Toggle sidecar" onClick={() => toggleRegion('sidecar')}>⇥</button>
        </div>
        {!layout.regions.sidecarCollapsed && (
          <div className="oi-host-region__body oi-shell__inspector">
            {sidecar}
            <HostRegionSurfaces region="sidecar" {...regionSurfaceProps} />
          </div>
        )}
      </aside>

      <aside className="oi-host-region oi-host-system" data-host-region="system" tabIndex={-1} aria-label="System region">
        {!layout.regions.systemCollapsed && <div className="oi-resize-handle oi-resize-handle--left" onPointerDown={(event) => beginResize('system', event)} />}
        <div className="oi-host-region__toolbar">
          {!layout.regions.systemCollapsed && <strong>System</strong>}
          <button type="button" aria-label="Toggle system region" onClick={() => toggleRegion('system')}>⚙</button>
        </div>
        {!layout.regions.systemCollapsed && (
          <div className="oi-host-region__body">
            {system}
            <HostRegionSurfaces region="system" {...regionSurfaceProps} />
          </div>
        )}
      </aside>

      <section className="oi-host-region oi-host-lower" data-host-region="lower" tabIndex={-1} aria-label="Lower deep region">
        {!layout.regions.lowerCollapsed && <div className="oi-resize-handle oi-resize-handle--y" onPointerDown={(event) => beginResize('lower', event)} />}
        <div className="oi-host-region__toolbar">
          <strong>Lower / Deep</strong>
          <button type="button" aria-label="Toggle lower region" onClick={() => toggleRegion('lower')}>⌄</button>
        </div>
        {!layout.regions.lowerCollapsed && (
          <div className="oi-host-region__body">
            {lower}
            <HostRegionSurfaces region="lower" {...regionSurfaceProps} />
          </div>
        )}
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
}: {
  surfaces: HostSurfaceDescriptor[];
  region: Exclude<WorkbenchHostRegion, 'canvas'>;
  renderRegionSurface?: (surface: HostSurfaceDescriptor, region: Exclude<WorkbenchHostRegion, 'canvas'>) => ReactNode;
  onSurfaceFocus?: (focus: SurfaceFocus) => void;
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
          {renderRegionSurface ? renderRegionSurface(surface, region) : <DefaultRegionSurface surface={surface} />}
        </section>
      ))}
    </div>
  );
}

function DefaultRegionSurface({ surface }: { surface: HostSurfaceDescriptor }) {
  return (
    <div className="oi-host-region-surface__descriptor">
      <strong>{surface.title}</strong>
      <code>{surface.surfaceRef}</code>
      <small>{surface.nativeOwner}{surface.provenance ? ` · ${surface.provenance}` : ''}</small>
    </div>
  );
}

function HostEmptyState({ surfaces, onOpen }: { surfaces: HostSurfaceDescriptor[]; onOpen: (surfaceRef: string, pinned?: boolean) => void }) {
  return (
    <div className="oi-host-empty">
      <p>No Surface is open in this editor group.</p>
      <div>{surfaces.map((surface) => <button type="button" key={surface.surfaceRef} onClick={() => onOpen(surface.surfaceRef, true)}>Open {surface.title}</button>)}</div>
    </div>
  );
}

function initialLayout(initialSurfaceRef: string): WorkbenchLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WorkbenchLayout;
      if (parsed.version === 1 && Array.isArray(parsed.groups)) return parsed;
    }
  } catch {
    // Fall through to provider-local defaults.
  }
  const initialBinding: SurfacePresentationBinding = {
    bindingId: presentationId(initialSurfaceRef),
    surfaceRef: initialSurfaceRef,
    pinned: true,
  };
  return {
    version: 1,
    regions: DEFAULT_REGIONS,
    split: 'single',
    groups: [{ groupId: 'group-1', tabs: [initialBinding], activeBindingId: initialBinding.bindingId }],
    focusedGroupId: 'group-1',
    focusRegion: 'canvas',
    closed: [],
  };
}

function reconcileLayout(layout: WorkbenchLayout, surfaces: Map<string, HostSurfaceDescriptor>, initialSurfaceRef: string): WorkbenchLayout {
  const groups = layout.groups.length ? layout.groups : [{ groupId: 'group-1', tabs: [], activeBindingId: undefined }];
  const hasAnyBinding = groups.some((group) => group.tabs.length > 0);
  if (hasAnyBinding) return { ...layout, groups };
  const initial = surfaces.get(initialSurfaceRef);
  const surface = initial && surfaceRegions(initial).includes('canvas')
    ? initial
    : [...surfaces.values()].find((candidate) => surfaceRegions(candidate).includes('canvas'));
  if (!surface) return { ...layout, groups };
  const binding = bindingFor(surface, true);
  return {
    ...layout,
    groups: groups.map((group, index) => index === 0 ? { ...group, tabs: [binding], activeBindingId: binding.bindingId } : group),
  };
}

function surfaceRegions(surface: HostSurfaceDescriptor): WorkbenchHostRegion[] {
  const regions = surface.regions?.length ? surface.regions : surface.region ? [surface.region] : ['canvas'];
  return [...new Set(regions)];
}

function bindingFor(surface: HostSurfaceDescriptor, pinned: boolean): SurfacePresentationBinding {
  return {
    bindingId: presentationId(surface.surfaceRef),
    surfaceRef: surface.surfaceRef,
    subjectRef: surface.subjectRef,
    pinned,
  };
}

function presentationId(surfaceRef: string) {
  return `presentation:${surfaceRef}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
