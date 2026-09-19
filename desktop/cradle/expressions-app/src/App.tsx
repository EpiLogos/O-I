/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye } from 'lucide-react';
import {
  PointCloudConfig,
  CameraOrbState,
  PlacedInteractionPoint,
  MorphTelemetry,
  CompositionTelemetry,
} from './engine/types';
import { AutomationLiveValue } from './engine/automation';
import { DEFAULT_CONFIG, PointCloudField, DEFAULT_COLOR_CONFIG, DEFAULT_TOROIDAL_CONFIG, SpatialGridMode } from './engine/PointCloudField';
import { isLightHex } from './engine/colorPalettes';
import { FACTORY_PRESETS, FactoryPreset } from './engine/factoryPresets';
import {
  Entity,
  MAX_PINS,
  makePin,
  newId,
  pinsToPlacedPoints,
  COMPOSITION_PRESETS,
  DEFAULT_COMPOSITION,
  DEFAULT_CYMATIC_MEDIUM,
} from './engine/fieldModel';
import {
  CONFIG_SCHEMA_VERSION,
  SavedSnapshot,
  migrateConfig,
  loadSnapshots,
  persistSnapshots,
  createSnapshot,
  migrateSnapshot,
} from './engine/configMigration';
import { PointCloudComponent, PointCloudComponentRef } from './components/PointCloudComponent';
import { PinGhostState } from './engine/pinMarkers';
import { CameraOrbWidget, CameraPreset } from './components/CameraOrbWidget';
import { SpatialScaffoldOverlay } from './components/SpatialScaffoldOverlay';
import { StudioMenuBar, FieldToggleKey } from './components/StudioMenuBar';
import { StudioInspector } from './components/StudioInspector';
import { PlacementTarget } from './components/EntitiesPanel';
import { ImageToGlyphModal } from './components/ImageToGlyphModal';
import { AsciiToGlyphModal } from './components/AsciiToGlyphModal';

const GRID_CYCLE: SpatialGridMode[] = ['off', 'axis', 'grid'];

export default function App() {
  const compRef = useRef<PointCloudComponentRef | null>(null);
  const [engine, setEngine] = useState<PointCloudField | null>(null);

  // Scene configuration (always a complete, migrated config)
  const [config, setConfig] = useState<PointCloudConfig>(() => migrateConfig(DEFAULT_CONFIG));

  // Snapshots: loaded + migrated synchronously through the pure migration module
  const [snapshots, setSnapshots] = useState<SavedSnapshot[]>(() => loadSnapshots());
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // UI state
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState<boolean>(() =>
    typeof window !== 'undefined' ? !window.location.search.includes('inspector=false') : true
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAsciiModal, setShowAsciiModal] = useState(false);

  // Live telemetry from the engine
  const [cameraState, setCameraState] = useState<CameraOrbState | null>(null);
  const [morphTelemetry, setMorphTelemetry] = useState<MorphTelemetry | null>(null);
  const [compositionTelemetry, setCompositionTelemetry] = useState<CompositionTelemetry | null>(null);
  const [automationLive, setAutomationLive] = useState<AutomationLiveValue[]>([]);

  // Entities: single selection shared by the Entities panel, the 3D pin markers and the
  // spatial scaffold overlay.
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => config.entities?.[0]?.id ?? null);

  // Spatial scaffold, pan mode and entity placement (new pin, or moving an existing entity)
  const [gridMode, setGridMode] = useState<SpatialGridMode>('off');
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementTarget, setPlacementTarget] = useState<PlacementTarget>(null);
  const [pinGhost, setPinGhost] = useState<PinGhostState | null>(null);
  const gridBeforePlacementRef = useRef<SpatialGridMode | null>(null);

  const toastTimer = useRef<number | null>(null);
  const triggerToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  // Keep the selected entity valid as entities are added/removed elsewhere (e.g. loading a
  // snapshot, applying a preset).
  useEffect(() => {
    const list = config.entities ?? [];
    if (selectedEntityId && !list.some((e) => e.id === selectedEntityId)) {
      setSelectedEntityId(list[0]?.id ?? null);
    } else if (!selectedEntityId && list.length > 0) {
      setSelectedEntityId(list[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.entities]);

  // ---------- Engine sync ----------
  useEffect(() => {
    compRef.current?.setGridMode(gridMode);
  }, [gridMode, engine]);

  useEffect(() => {
    compRef.current?.setActiveEntity(selectedEntityId);
  }, [selectedEntityId, engine]);

  useEffect(() => {
    compRef.current?.setPanMode(isPanMode);
  }, [isPanMode, engine]);

  // Placement mode forces the full 3D grid scaffold, then restores the previous mode on exit
  useEffect(() => {
    if (isPlacementMode) {
      gridBeforePlacementRef.current = gridMode;
      if (gridMode !== 'grid') setGridMode('grid');
    } else if (gridBeforePlacementRef.current !== null) {
      setGridMode(gridBeforePlacementRef.current);
      gridBeforePlacementRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlacementMode]);

  const cycleGridMode = useCallback(() => {
    setGridMode((prev) => {
      const next = GRID_CYCLE[(GRID_CYCLE.indexOf(prev) + 1) % GRID_CYCLE.length];
      triggerToast(next === 'off' ? 'Spatial scaffold off' : next === 'axis' ? 'Subtle axis triad' : 'Full 3D coordinate grid');
      return next;
    });
  }, [triggerToast]);

  const resetCameraTo = useCallback(
    (preset: CameraPreset = 'faceOn') => {
      const ref = compRef.current;
      if (!ref) return;
      if (preset === 'faceOn') {
        ref.resetCamera();
        triggerToast('Camera reset · central face-on view');
      } else if (preset === 'side') {
        ref.setCameraState({ pitch: 0, yaw: Math.PI / 2, panX: 0, panY: 0, zoom: 1 });
        triggerToast('Camera · side profile');
      } else {
        ref.resetCamera(preset);
        triggerToast(preset === 'top' ? 'Camera · top-down' : 'Camera · perspective');
      }
    },
    [triggerToast]
  );

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'h':
        case 'H':
          setIsUIHidden((prev) => {
            triggerToast(prev ? 'UI restored' : "UI hidden · press H or double-click to restore");
            return !prev;
          });
          break;
        case 'Tab':
        case 'i':
        case 'I':
          e.preventDefault();
          setShowInspector((prev) => !prev);
          break;
        case ' ':
          e.preventDefault();
          compRef.current?.triggerDisperse(2.2);
          triggerToast('Fluid dispersion burst');
          break;
        case 'r':
        case 'R':
          resetCameraTo('faceOn');
          break;
        case 'g':
        case 'G':
          cycleGridMode();
          break;
        case 'p':
        case 'P':
          setIsPanMode((prev) => {
            triggerToast(prev ? 'Pan mode off · left-drag stirs fluid' : 'Pan mode on · left-drag pans camera');
            return !prev;
          });
          break;
        case 'n':
        case 'N':
          setIsPlacementMode((prev) => {
            const next = !prev;
            setPlacementTarget(next ? { kind: 'newPin' } : null);
            return next;
          });
          break;
        case 'Escape':
          setSelectedEntityId(null);
          break;
        case 'Delete':
        case 'Backspace': {
          // Only pins delete directly from the keyboard — formations are removed via the
          // Entities panel to avoid accidentally destroying a composition's main shape.
          const entity = selectedEntityId ? (config.entities ?? []).find((en) => en.id === selectedEntityId) : null;
          if (entity && entity.kind === 'pin') {
            e.preventDefault();
            removeEntity(entity.id);
          }
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, config.entities, cycleGridMode, resetCameraTo, triggerToast]);

  // ---------- Snapshots ----------
  const commitSnapshots = (list: SavedSnapshot[]) => {
    setSnapshots(list);
    if (!persistSnapshots(list)) triggerToast('Warning: snapshot storage full or unavailable');
  };

  const handleSaveSnapshot = (name: string) => {
    const finalName = name.trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const snap = createSnapshot(finalName, config, {
      camera: cameraState ?? compRef.current?.getCameraState() ?? undefined,
      gridMode,
    });
    commitSnapshots([snap, ...snapshots]);
    setActiveSnapshotId(snap.id);
    setActivePresetId(null);
    triggerToast(`Saved snapshot "${finalName}"`);
  };

  const handleLoadSnapshot = (snap: SavedSnapshot) => {
    const next = migrateConfig(snap.config, snap.schemaVersion);
    setConfig(next);
    setIsPlacementMode(false);
    setPlacementTarget(null);
    setSelectedEntityId(next.entities?.[0]?.id ?? null);
    if (snap.view?.camera) compRef.current?.setCameraState(snap.view.camera);
    if (snap.view?.gridMode) setGridMode(snap.view.gridMode);
    setActiveSnapshotId(snap.id);
    setActivePresetId(null);
    compRef.current?.resetField();
    triggerToast(`Loaded snapshot "${snap.name}"`);
  };

  const handleDeleteSnapshot = (id: string, name: string) => {
    commitSnapshots(snapshots.filter((s) => s.id !== id));
    if (activeSnapshotId === id) setActiveSnapshotId(null);
    triggerToast(`Deleted snapshot "${name}"`);
  };

  const handleExportSnapshotJson = (snap: SavedSnapshot) => {
    navigator.clipboard.writeText(JSON.stringify(snap, null, 2));
    triggerToast(`Copied "${snap.name}" JSON to clipboard`);
  };

  /** Bulk-import a snapshot library (array of snapshots, or { snapshots: [...] }). Returns count added. */
  const importSnapshotLibrary = (raw: unknown): number => {
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as any).snapshots)
      ? (raw as any).snapshots
      : [];
    if (list.length === 0) return 0;
    const existingIds = new Set(snapshots.map((s) => s.id));
    const imported: SavedSnapshot[] = [];
    list.forEach((item, i) => {
      const snap = migrateSnapshot(item, i);
      if (!snap) return;
      if (existingIds.has(snap.id)) snap.id = snap.id + '_imp_' + Date.now().toString(36) + i;
      existingIds.add(snap.id);
      imported.push(snap);
    });
    if (imported.length === 0) return 0;
    commitSnapshots([...imported, ...snapshots].sort((a, b) => b.timestamp - a.timestamp));
    return imported.length;
  };

  const handleImportLibraryFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const n = importSnapshotLibrary(parsed);
      if (n > 0) {
        triggerToast(`Imported ${n} snapshot${n === 1 ? '' : 's'} from ${file.name}`);
      } else {
        const isSnapshot = parsed && typeof parsed === 'object' && parsed.config;
        setConfig(migrateConfig(isSnapshot ? parsed.config : parsed, typeof parsed?.schemaVersion === 'number' ? parsed.schemaVersion : 0));
        triggerToast(`Loaded configuration from ${file.name}`);
      }
    } catch (err: any) {
      alert('Could not import ' + file.name + ': ' + err.message);
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText.trim());
      if (!parsed || typeof parsed !== 'object') throw new Error('Not a configuration object');
      const libCount = importSnapshotLibrary(parsed);
      if (libCount > 0) {
        setShowImportModal(false);
        setImportJsonText('');
        triggerToast(`Imported ${libCount} snapshot${libCount === 1 ? '' : 's'} into your library`);
        return;
      }
      const isSnapshot = parsed.config && typeof parsed.config === 'object';
      const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : CONFIG_SCHEMA_VERSION;
      const next = migrateConfig(isSnapshot ? parsed.config : parsed, version);
      setConfig(next);
      setSelectedEntityId(next.entities?.[0]?.id ?? null);
      if (isSnapshot && parsed.view?.camera) compRef.current?.setCameraState(parsed.view.camera);
      setShowImportModal(false);
      setImportJsonText('');
      setActiveSnapshotId(null);
      setActivePresetId(null);
      compRef.current?.resetField();
      triggerToast('Imported configuration');
    } catch (err: any) {
      alert('Could not parse configuration JSON: ' + err.message);
    }
  };

  // ---------- Factory presets ----------
  const applyPreset = (preset: FactoryPreset) => {
    const next = migrateConfig(preset.config);
    setConfig(next);
    setActivePresetId(preset.id);
    setActiveSnapshotId(null);
    setIsPlacementMode(false);
    setPlacementTarget(null);
    setSelectedEntityId(next.entities?.[0]?.id ?? null);
    compRef.current?.resetField();
    triggerToast(`Applied preset: ${preset.name}`);
  };

  // ---------- Field toggles & composition presets ----------
  const toggleField = (key: FieldToggleKey) => {
    setConfig((prev) => {
      if (key === 'morph') {
        const toroidal = prev.toroidalMorph || DEFAULT_TOROIDAL_CONFIG;
        return { ...prev, toroidalMorph: { ...toroidal, enabled: !toroidal.enabled } };
      }
      if (key === 'cymatics') {
        const cym = prev.cymatics || DEFAULT_CYMATIC_MEDIUM;
        return { ...prev, cymatics: { ...cym, enabled: !cym.enabled } };
      }
      const relational = prev.relational || DEFAULT_CONFIG.relational!;
      return { ...prev, relational: { ...relational, enabled: !relational.enabled } };
    });
  };

  const applyCompositionPreset = (id: string) => {
    const preset = COMPOSITION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const built = preset.build();
    setConfig((prev) => ({
      ...prev,
      entities: built.entities,
      composition: {
        ...DEFAULT_COMPOSITION,
        ...built.composition,
        orchestration: { ...DEFAULT_COMPOSITION.orchestration, ...(built.composition.orchestration || {}) },
      },
      cymatics: { ...DEFAULT_CYMATIC_MEDIUM, ...(prev.cymatics || {}), ...(built.cymatics || {}) },
    }));
    setSelectedEntityId(built.entities[0]?.id ?? null);
    setActivePresetId(null);
    setActiveSnapshotId(null);
    setIsPlacementMode(false);
    setPlacementTarget(null);
    compRef.current?.resetField();
    triggerToast(`Applied composition: ${preset.name}`);
  };

  // ---------- Entity CRUD (single writer: config.entities) ----------
  const updateEntity = useCallback((id: string, patch: Partial<Entity>) => {
    setConfig((prev) => ({ ...prev, entities: (prev.entities ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }, []);

  const addEntity = useCallback((entity: Entity) => {
    setConfig((prev) => ({ ...prev, entities: [...(prev.entities ?? []), entity] }));
  }, []);

  const removeEntity = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, entities: (prev.entities ?? []).filter((e) => e.id !== id) }));
    setSelectedEntityId((cur) => (cur === id ? null : cur));
  }, []);

  const duplicateEntity = useCallback((id: string) => {
    setConfig((prev) => {
      const list = prev.entities ?? [];
      const idx = list.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const src = list[idx];
      const clone: Entity = { ...src, id: newId(src.kind === 'pin' ? 'pin' : 'ent'), name: `${src.name} copy`, x: src.x + 40, y: src.y - 40 };
      const next = [...list];
      next.splice(idx + 1, 0, clone);
      return { ...prev, entities: next };
    });
  }, []);

  const moveEntity = useCallback((id: string, dir: 1 | -1) => {
    setConfig((prev) => {
      const list = prev.entities ?? [];
      const idx = list.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const kind = list[idx].kind;
      let j = idx + dir;
      while (j >= 0 && j < list.length && list[j].kind !== kind) j += dir;
      if (j < 0 || j >= list.length) return prev;
      const next = [...list];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...prev, entities: next };
    });
  }, []);

  const setEntities = useCallback((next: Entity[]) => {
    setConfig((prev) => ({ ...prev, entities: next }));
  }, []);

  // ---------- Simple toggles ----------
  const toggleColorMode = () => {
    setConfig((prev) => {
      const nextMode = prev.colorMode === 'blackOnWhite' ? 'whiteOnBlack' : 'blackOnWhite';
      const nextBg = nextMode === 'blackOnWhite' ? '#fafaf9' : '#09090b';
      return {
        ...prev,
        colorMode: nextMode,
        backgroundColor: nextBg,
        color: { ...(prev.color || DEFAULT_COLOR_CONFIG), backgroundColor: nextBg },
      };
    });
  };

  const toggleStyle = () =>
    setConfig((prev) => ({ ...prev, style: prev.style === 'stipple' ? 'halftone' : 'stipple' }));

  const toggleDotShape = () =>
    setConfig((prev) => ({ ...prev, dotShape: prev.dotShape === 'circle' ? 'square' : 'circle' }));

  // ---------- Pin <-> entity bridge for SpatialScaffoldOverlay ----------
  // Pins are entities with kind 'pin'; the overlay only speaks PlacedInteractionPoint, so we
  // translate both ways here. Edits always land back on the entity (x/y/z/forces/enabled) —
  // config.interaction.placedPoints is legacy migration input only and is never written.
  const handleUpdatePlacedPoint = (id: string, updates: Partial<PlacedInteractionPoint>) => {
    const entity = (config.entities ?? []).find((e) => e.id === id);
    if (!entity) return;
    const patch: Partial<Entity> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.x !== undefined) patch.x = updates.x;
    if (updates.y !== undefined) patch.y = updates.y;
    if (updates.z !== undefined) patch.z = updates.z;
    if (updates.active !== undefined) patch.enabled = updates.active;
    if (updates.radius !== undefined || updates.strength !== undefined || updates.mode !== undefined) {
      patch.forces = {
        ...entity.forces,
        ...(updates.radius !== undefined ? { radius: updates.radius } : {}),
        ...(updates.strength !== undefined ? { strength: updates.strength } : {}),
        ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
      };
    }
    updateEntity(id, patch);
  };

  const handleDeletePlacedPoint = (id: string) => {
    removeEntity(id);
    triggerToast('Deleted pin');
  };

  const handleAddPointAt = (pos: { x: number; y: number; z: number }, keepPlacing: boolean) => {
    if (placementTarget?.kind === 'entity') {
      updateEntity(placementTarget.id, { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) });
      if (!keepPlacing) {
        setIsPlacementMode(false);
        setPlacementTarget(null);
      }
      triggerToast(`Moved entity to ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`);
      return;
    }
    const pins = (config.entities ?? []).filter((e) => e.kind === 'pin');
    if (pins.length >= MAX_PINS) {
      triggerToast(`Pin limit reached (${MAX_PINS}). Delete one first.`);
      setIsPlacementMode(false);
      setPlacementTarget(null);
      return;
    }
    const pin = makePin({
      name: `Pin ${pins.length + 1}`,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
      forces: { mode: config.interaction?.mode === 'attract' || config.interaction?.mode === 'repel' ? config.interaction.mode : 'vortex', strength: 2.0, radius: 220, spin: 0 },
    });
    addEntity(pin);
    setSelectedEntityId(pin.id);
    if (!keepPlacing) {
      setIsPlacementMode(false);
      setPlacementTarget(null);
    }
    triggerToast(`Pin placed at ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}${keepPlacing ? ' · keep clicking' : ''}`);
  };

  const startPlaceNewPin = useCallback(() => {
    setPlacementTarget({ kind: 'newPin' });
    setIsPlacementMode(true);
  }, []);

  const startPlaceSelected = useCallback(() => {
    if (!selectedEntityId) return;
    setPlacementTarget({ kind: 'entity', id: selectedEntityId });
    setIsPlacementMode(true);
  }, [selectedEntityId]);

  // ---------- Derived ----------
  const activeBgColor =
    config.backgroundColor || config.color?.backgroundColor || (config.colorMode === 'blackOnWhite' ? '#fafaf9' : '#09090b');
  const isLight = isLightHex(activeBgColor);

  // Pins are entities with kind 'pin' — derive the marker list from them and push data down
  // whenever entities (or the ghost, or the theme) change. Pins are true 3D objects owned by
  // the engine now.
  const pinPoints = pinsToPlacedPoints(config.entities ?? []);
  useEffect(() => {
    compRef.current?.setPinMarkers(pinPoints, selectedEntityId, pinGhost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.entities, selectedEntityId, pinGhost, engine, isLight]);

  return (
    <div
      id="app-container"
      onDoubleClick={() => {
        if (isUIHidden) {
          setIsUIHidden(false);
          triggerToast('UI restored');
        }
      }}
      className={`relative w-screen h-screen overflow-hidden font-sans select-none ${isLight ? 'text-[#1c1917]' : 'text-[#f4f4f5]'}`}
      style={{ backgroundColor: activeBgColor, transition: 'background-color 0.4s ease-out' }}
    >
      {/* 1. WebGL point cloud */}
      <PointCloudComponent
        ref={compRef}
        {...config}
        onEngineReady={(inst) => {
          setEngine(inst);
          (window as any).__pcEngine = inst; // debugging aid: inspect live engine state from the console
        }}
        onCameraChange={setCameraState}
        onMorphUpdate={setMorphTelemetry}
        onAutomationUpdate={setAutomationLive}
        onCompositionUpdate={setCompositionTelemetry}
        positioning="absolute"
        className="w-full h-full inset-0 z-0"
      />

      {/* 2. Spatial scaffold + pins (pins = entities with kind 'pin') */}
      <SpatialScaffoldOverlay
        points={pinPoints}
        activePointId={selectedEntityId}
        onSelectPoint={setSelectedEntityId}
        onUpdatePoint={handleUpdatePlacedPoint}
        onDeletePoint={handleDeletePlacedPoint}
        onAddPointAt={handleAddPointAt}
        isPlacementMode={isPlacementMode && !isUIHidden}
        onExitPlacementMode={() => {
          setIsPlacementMode(false);
          setPlacementTarget(null);
        }}
        gridMode={isUIHidden ? 'off' : gridMode}
        isLight={isLight}
        placementRadius={220}
        placementMode={config.interaction?.mode ?? 'vortex'}
        onGhostChange={setPinGhost}
        projectWorldToScreen={(x, y, z) =>
          compRef.current ? compRef.current.projectWorldToScreen(x, y, z) : { x: 0, y: 0, visible: false }
        }
        unprojectScreenToWorld={(sx, sy, pz) =>
          compRef.current ? compRef.current.unprojectScreenToWorld(sx, sy, pz) : { x: 0, y: 0, z: pz ?? 0 }
        }
        onPickPin={(sx, sy) => (compRef.current ? compRef.current.pickPin(sx, sy, pinPoints) : null)}
      />

      {/* 3. Camera globe */}
      <CameraOrbWidget
        cameraState={cameraState}
        onSetOrbit={(pitch, yaw) => compRef.current?.setCameraOrbit(pitch, yaw)}
        onSetPan={(panX, panY) => compRef.current?.setCameraPan(panX, panY)}
        onSetZoom={(zoom) => compRef.current?.setCameraZoom(zoom)}
        onReset={resetCameraTo}
        isLight={isLight}
        isUIHidden={isUIHidden}
        gridMode={gridMode}
        onCycleGridMode={cycleGridMode}
        isPanMode={isPanMode}
        onTogglePanMode={() => setIsPanMode((p) => !p)}
      />

      {/* Toast */}
      {toast && (
        <div
          id="status-toast"
          className={`fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full font-mono text-xs shadow-xl border pointer-events-none ${
            isLight ? 'bg-white/95 text-stone-900 border-stone-300 shadow-stone-400/20' : 'bg-zinc-900/95 text-zinc-100 border-zinc-700 shadow-black/40'
          }`}
        >
          {toast}
        </div>
      )}

      {isUIHidden && (
        <div className="fixed top-4 right-4 z-40 pointer-events-auto">
          <button
            id="restore-ui-btn"
            onClick={() => {
              setIsUIHidden(false);
              triggerToast('UI restored');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-full border backdrop-blur-md shadow-lg transition-all hover:scale-105 ${
              isLight ? 'bg-white/80 border-stone-300 text-stone-800 hover:bg-white' : 'bg-zinc-900/80 border-zinc-700 text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-500" />
            <span>Show UI (H)</span>
          </button>
        </div>
      )}

      {/* 4. Menu bar */}
      <StudioMenuBar
        config={config}
        isLight={isLight}
        onToggleTheme={toggleColorMode}
        onToggleStyle={toggleStyle}
        onToggleDotShape={toggleDotShape}
        onTriggerDisperse={() => compRef.current?.triggerDisperse(2.2)}
        onOpenImageModal={() => setShowImageModal(true)}
        onOpenAsciiModal={() => setShowAsciiModal(true)}
        onOpenImportJsonModal={() => setShowImportModal(true)}
        onExportJson={() => {
          navigator.clipboard.writeText(
            JSON.stringify({ schemaVersion: CONFIG_SCHEMA_VERSION, config, view: { camera: cameraState, gridMode } }, null, 2)
          );
          triggerToast('Configuration JSON copied to clipboard');
        }}
        onTakeSnapshot={() => {
          if (engine) {
            engine.captureSnapshot('png', 1.0);
            triggerToast('High-resolution PNG downloaded');
          }
        }}
        onResetScene={() => {
          const next = migrateConfig(DEFAULT_CONFIG);
          setConfig(next);
          setActivePresetId(null);
          setActiveSnapshotId(null);
          setSelectedEntityId(next.entities?.[0]?.id ?? null);
          setIsPlacementMode(false);
          setPlacementTarget(null);
          setIsPanMode(false);
          setGridMode('off');
          compRef.current?.resetCamera();
          compRef.current?.resetField();
          triggerToast('Scene reset to defaults');
        }}
        onToggleInspector={() => setShowInspector((prev) => !prev)}
        isInspectorOpen={showInspector}
        onToggleZenMode={() => {
          setIsUIHidden(true);
          triggerToast("UI hidden · press H or double-click to restore");
        }}
        isZenMode={isUIHidden}
        presets={FACTORY_PRESETS}
        activePresetId={activePresetId}
        onSelectPreset={(id) => {
          const p = FACTORY_PRESETS.find((x) => x.id === id);
          if (p) applyPreset(p);
        }}
        savedStates={snapshots}
        activeSnapshotId={activeSnapshotId}
        onLoadState={handleLoadSnapshot}
        onDeleteState={handleDeleteSnapshot}
        onApplyPreset={applyCompositionPreset}
        onToggleField={toggleField}
        gridMode={gridMode}
        onCycleGridMode={cycleGridMode}
        isPanMode={isPanMode}
        onTogglePanMode={() => setIsPanMode((p) => !p)}
        onImportLibraryFile={handleImportLibraryFile}
      />

      {/* 5. Pointer hint */}
      <div
        className={`absolute inset-0 pointer-events-none flex flex-col justify-end pb-3 items-center transition-opacity duration-300 ${
          isUIHidden ? 'opacity-0' : 'opacity-25 hover:opacity-75'
        }`}
      >
        <p className="text-[9px] font-mono tracking-widest uppercase text-center">
          {isPanMode
            ? 'PAN MODE · LEFT-DRAG PANS · RIGHT-DRAG ORBITS · WHEEL ZOOMS · P EXITS'
            : 'MOVE CURSOR TO STIR FLUID · RIGHT-DRAG ORBIT · SHIFT-DRAG PAN · WHEEL ZOOM · R RESET · G GRID · N PIN · H HIDE UI'}
        </p>
      </div>

      {/* 6. Inspector */}
      <StudioInspector
        config={config}
        setConfig={setConfig}
        onChange={(partial) => setConfig((prev) => ({ ...prev, ...partial }))}
        isOpen={showInspector && !isUIHidden}
        onClose={() => setShowInspector(false)}
        isLight={isLight}
        onOpenImageModal={() => setShowImageModal(true)}
        onOpenAsciiModal={() => setShowAsciiModal(true)}
        onTriggerDisperse={(strength) => compRef.current?.triggerDisperse(strength ?? 2.2)}
        onSaveState={handleSaveSnapshot}
        savedStates={snapshots}
        activeSnapshotId={activeSnapshotId}
        onLoadState={handleLoadSnapshot}
        onDeleteState={handleDeleteSnapshot}
        onExportStateJson={handleExportSnapshotJson}
        onOpenImportJsonModal={() => setShowImportModal(true)}
        compositionTelemetry={compositionTelemetry}
        morphTelemetry={morphTelemetry}
        automationLive={automationLive}
        onFireAutomation={(id) => compRef.current?.fireAutomation(id)}
        onResetMorphPhases={() => {
          compRef.current?.resetMorphPhases();
          triggerToast('Morph phases restarted');
        }}
        onImportLibraryFile={handleImportLibraryFile}
        selectedEntityId={selectedEntityId}
        onSelectEntity={setSelectedEntityId}
        onAddEntity={addEntity}
        onRemoveEntity={removeEntity}
        onDuplicateEntity={duplicateEntity}
        onMoveEntity={moveEntity}
        onUpdateEntity={updateEntity}
        onSetEntities={setEntities}
        isPlacementMode={isPlacementMode}
        placementTarget={placementTarget}
        onStartPlaceNewPin={startPlaceNewPin}
        onStartPlaceSelected={startPlaceSelected}
        onApplyCompositionPreset={applyCompositionPreset}
      />

      {/* 7. Modals */}
      <ImageToGlyphModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onBakeImage={(img, customCfg) => {
          if (engine) {
            engine.loadCustomImage(img, customCfg);
            triggerToast('Baking image into point cloud');
          }
        }}
        isLight={isLight}
      />

      <AsciiToGlyphModal
        isOpen={showAsciiModal}
        onClose={() => setShowAsciiModal(false)}
        onBakeAscii={(text, options) => {
          if (engine) {
            engine.loadAsciiArt(text, options);
            triggerToast('Baking ASCII matrix into point cloud');
          }
        }}
        isLight={isLight}
      />

      {showImportModal && (
        <div
          id="import-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowImportModal(false)}
        >
          <div
            id="import-modal-window"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl flex flex-col ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
            }`}
          >
            <h3 className="text-sm font-mono font-bold uppercase mb-1">Import configuration</h3>
            <p className="text-xs opacity-60 font-mono mb-3">
              Paste a snapshot, a bare PointCloudConfig, or a whole snapshot library array. Older formats are migrated automatically.
            </p>
            <textarea
              id="import-json-textarea"
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{ "glyph": ["✦", "✧"], "fluid": { ... } }'
              className={`w-full p-3 font-mono text-xs rounded-xl border outline-none mb-4 ${
                isLight ? 'bg-stone-50 border-stone-300' : 'bg-black border-zinc-700'
              }`}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-inherit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className={`px-4 py-1.5 text-xs font-mono uppercase rounded-lg font-medium ${isLight ? 'bg-stone-900 text-white' : 'bg-white text-zinc-950'}`}
              >
                Apply JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
