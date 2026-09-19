/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Repeat,
  Play,
  Pause,
  Sliders,
  Compass,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Radio,
  Eye,
  Zap,
  Disc,
  Waves,
  Activity,
  Volume2,
  Box,
} from 'lucide-react';
import {
  PointCloudConfig,
  SpatialChakraConfig,
  SpatialChakraNode,
  SpatialChakraTimelineState,
  CymaticsConfig,
  CymaticPlateGeometry,
  CymaticDimension,
  CymaticsEngineMode,
  CymaticsSweepDirection,
  ChakraGeometryMode,
} from '../engine/types';
import {
  CANONICAL_CHAKRAS,
  createDefaultChakraConfig,
  CHAKRA_SPATIAL_PRESETS,
} from '../engine/chakraSystem';
import { CHAKRA_CYMATIC_PROFILES } from '../engine/cymatics';
import { CymaticResonator } from '../engine/cymaticResonator';
import { EditableNumber } from './EditableNumber';
import { ParamRow } from './ParamRow';

export interface ChakraPanelProps {
  config: PointCloudConfig;
  setConfig: React.Dispatch<React.SetStateAction<PointCloudConfig>>;
  timelineState: SpatialChakraTimelineState | null;
  onJumpToNode: (index: number) => void;
  onStepNode: (direction: 1 | -1) => void;
  isLight: boolean;
}

export const ChakraPanel: React.FC<ChakraPanelProps> = ({
  config,
  setConfig,
  timelineState,
  onJumpToNode,
  onStepNode,
  isLight,
}) => {
  const chakraConfig = config.spatialChakra || createDefaultChakraConfig();
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'cymatics' | 'spine' | 'coordinates' | 'presets'>('system');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const updateChakra = (updates: Partial<SpatialChakraConfig>) => {
    setConfig((prev) => ({
      ...prev,
      spatialChakra: {
        ...(prev.spatialChakra || createDefaultChakraConfig()),
        ...updates,
      },
    }));
  };

  const updateCymatics = (updates: Partial<CymaticsConfig>) => {
    updateChakra({
      cymatics: {
        ...(chakraConfig.cymatics || {
          plateGeometry: 'square',
          dimension: '2D',
          frequencyHz: 396,
          autoSweep: false,
          sweepSpeed: 8.0,
          chaosIntensity: 1.4,
          nodalAttraction: 2.8,
          dampingQFactor: 4.5,
          engine: 'resonator',
          baseFrequency: 40,
          driveStrength: 1.0,
          transportGain: 1.0,
          agitation: 0.3,
          plateSize: 700,
          modeCount: 64,
          boundaryStrength: 6.0,
          driveScale: 1.0,
          sweep: { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' },
        }),
        ...updates,
      },
    });
  };

  const updateSweep = (updates: Partial<NonNullable<CymaticsConfig['sweep']>>) => {
    updateCymatics({
      sweep: {
        enabled: chakraConfig.cymatics?.sweep?.enabled ?? false,
        glideS: chakraConfig.cymatics?.sweep?.glideS ?? 3.5,
        dwellS: chakraConfig.cymatics?.sweep?.dwellS ?? 2.0,
        direction: chakraConfig.cymatics?.sweep?.direction ?? 'ascent',
        ...updates,
      },
    });
  };

  // Resonator engine flag & its precomputed stations (display-only instance; the live
  // simulation runs its own resonator inside the engine — see cymaticResonator.ts).
  const cymaticsEngine: CymaticsEngineMode = chakraConfig.cymatics?.engine ?? 'resonator';
  const isResonatorEngine = cymaticsEngine === 'resonator';
  const resonatorPreview = useMemo(
    () =>
      new CymaticResonator({
        plateSize: chakraConfig.cymatics?.plateSize ?? 700,
        baseFrequency: chakraConfig.cymatics?.baseFrequency ?? 40,
      }),
    [chakraConfig.cymatics?.plateSize, chakraConfig.cymatics?.baseFrequency]
  );
  const resonatorStations = resonatorPreview.getStations();
  const resonatorFreqMin = resonatorStations.length > 0 ? resonatorStations[0].frequencyHz * 0.5 : 20;
  const resonatorFreqMax =
    resonatorStations.length > 0 ? resonatorStations[resonatorStations.length - 1].frequencyHz * 1.15 : 4000;

  const updateNode = (id: string, updates: Partial<SpatialChakraNode>) => {
    const nodes = (chakraConfig.nodes || CANONICAL_CHAKRAS).map((n) =>
      n.id === id ? { ...n, ...updates } : n
    );
    updateChakra({ nodes });
  };

  const applySpatialPreset = (presetNodes: SpatialChakraNode[]) => {
    updateChakra({
      nodes: presetNodes.map((n) => ({ ...n })),
    });
  };

  const currentNode = timelineState?.currentNode || CANONICAL_CHAKRAS[timelineState?.currentIndex ?? 6] || CANONICAL_CHAKRAS[6];
  const nextNode = timelineState?.nextNode || CANONICAL_CHAKRAS[timelineState?.nextIndex ?? 5] || CANONICAL_CHAKRAS[5];

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Master Chakra Mode Activation Banner */}
      <div
        className={`p-3 rounded-lg border transition-all ${
          chakraConfig.enabled
            ? 'bg-purple-950/20 border-purple-500/50 shadow-sm'
            : isLight
            ? 'bg-stone-50 border-stone-200'
            : 'bg-zinc-900/50 border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center ${
                chakraConfig.enabled
                  ? 'bg-purple-600 text-white shadow-xs'
                  : isLight
                  ? 'bg-stone-200 text-stone-600'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                Chakral Body System
              </div>
              <div className="text-[10px] opacity-70">
                Spatial coordinate morphing across 7 subtle centers
              </div>
            </div>
          </div>
          <button
            id="chakra-master-enable-toggle"
            onClick={() => updateChakra({ enabled: !chakraConfig.enabled })}
            className={`px-3 py-1 text-[11px] font-bold rounded uppercase transition-all ${
              chakraConfig.enabled
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
                : isLight
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            {chakraConfig.enabled ? 'ACTIVE' : 'ENABLE'}
          </button>
        </div>
      </div>

      {/* 2. Sub-tab Navigation */}
      <div
        className={`flex items-center p-0.5 rounded-lg border ${
          isLight ? 'bg-stone-100 border-stone-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        {[
          { id: 'system', label: 'Playback' },
          { id: 'cymatics', label: 'Cymatics' },
          { id: 'spine', label: 'Spine Transit' },
          { id: 'coordinates', label: 'Nodes / Space' },
          { id: 'presets', label: 'Layouts' },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`chakra-subtab-${tab.id}`}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 py-1 text-[10px] font-mono uppercase rounded transition-all text-center relative ${
              activeSubTab === tab.id
                ? isLight
                  ? 'bg-white text-stone-950 font-bold shadow-xs'
                  : 'bg-zinc-800 text-white font-bold shadow-xs'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            {tab.label}
            {tab.id === 'cymatics' && chakraConfig.geometryMode === 'cymatics' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1 -mt-0.5 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: SYSTEM / PLAYBACK */}
      {activeSubTab === 'system' && (
        <div className="space-y-3">
          {/* Playback Mode Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
              Spatial Manifestation Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                id="chakra-mode-simultaneous-btn"
                onClick={() => updateChakra({ playbackMode: 'simultaneousBody' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chakraConfig.playbackMode === 'simultaneousBody'
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-purple-400" />
                  <span>Simultaneous Body</span>
                </div>
                <p className="text-[9px] opacity-70 mt-1 leading-tight">
                  All 7 chakras active in space simultaneously with per-chakra chromatic radiance.
                </p>
              </button>

              <button
                id="chakra-mode-sequential-btn"
                onClick={() => updateChakra({ playbackMode: 'sequentialMorph' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chakraConfig.playbackMode === 'sequentialMorph'
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Sequential Kundalini</span>
                </div>
                <p className="text-[9px] opacity-70 mt-1 leading-tight">
                  Morphs between shapes and spatial positions along the spinal meridian.
                </p>
              </button>
            </div>
          </div>

          {/* Chakra System Geometry Mode: Mode 1 (Yantra) vs Mode 2 (Cymatics) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                Chakra Geometric System
              </label>
              <span className="text-[9px] font-mono opacity-50">Mode 1 vs Mode 2</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="chakra-mode-yantra-btn"
                onClick={() => updateChakra({ geometryMode: 'yantra' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  (chakraConfig.geometryMode ?? 'yantra') === 'yantra'
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200 font-bold shadow-xs'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>☸ Mode 1: Sacred Yantra</span>
                </div>
                <p className="text-[8.5px] opacity-70 mt-0.5 leading-tight">
                  Classical vector mandalas: Lotus Petals, Shatkona & Sacred Bija Yantras.
                </p>
              </button>

              <button
                type="button"
                id="chakra-mode-cymatics-btn"
                onClick={() => {
                  updateChakra({ geometryMode: 'cymatics' });
                  setActiveSubTab('cymatics');
                }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chakraConfig.geometryMode === 'cymatics'
                    ? 'border-cyan-500 bg-cyan-950/30 text-cyan-200 font-bold shadow-xs'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5 font-bold">
                  <Waves className="w-3 h-3 text-cyan-400" />
                  <span>〰 Mode 2: Acoustic Cymatics</span>
                </div>
                <p className="text-[8.5px] opacity-70 mt-0.5 leading-tight">
                  Chladni wave equations & deterministic harmonic attractor basins.
                </p>
              </button>
            </div>
          </div>

          {chakraConfig.geometryMode === 'cymatics' && (
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              isLight ? 'bg-cyan-50/70 border-cyan-200' : 'bg-cyan-950/20 border-cyan-800/60'
            }`}>
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase">
                    Cymatics Mode Active · {chakraConfig.cymatics?.plateGeometry ?? 'square'} Plate
                  </div>
                  <div className="text-[9px] opacity-70">
                    Harmonic frequency: {timelineState?.cymaticFrequency ?? (chakraConfig.cymatics?.frequencyHz ?? 396)} Hz
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('cymatics')}
                className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all"
              >
                Open Tuner →
              </button>
            </div>
          )}

          {/* 3D Planar Alignment: Horizontal vs Vertical */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
              Geometric Plane Alignment
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="chakra-plane-horizontal-btn"
                onClick={() => updateChakra({ plane: 'horizontal' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  (chakraConfig.plane ?? 'horizontal') === 'horizontal'
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>Horizontal (Flat Discs)</span>
                </div>
                <p className="text-[8.5px] opacity-70 mt-0.5 leading-tight">
                  Flat discs when viewed horizontally; spin around spinal axis with camera orb.
                </p>
              </button>

              <button
                type="button"
                id="chakra-plane-vertical-btn"
                onClick={() => updateChakra({ plane: 'vertical' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chakraConfig.plane === 'vertical'
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Disc className="w-3 h-3 text-cyan-400" />
                  <span>Vertical (Frontal Face)</span>
                </div>
                <p className="text-[8.5px] opacity-70 mt-0.5 leading-tight">
                  Upright front-facing mandalas aligned directly with the camera screen.
                </p>
              </button>
            </div>
          </div>

          {/* Vortex Center Swirl Strength */}
          <div>
            <div className="flex justify-between items-center text-[9px] uppercase tracking-wider mb-0.5">
              <span className="opacity-70">Per-Chakra Vortex Center Swirl</span>
              <EditableNumber
                value={chakraConfig.vortexStrength ?? 1.6}
                onChange={(v) => updateChakra({ vortexStrength: v })}
                min={-100.0}
                max={100.0}
                step={0.1}
                unit="x"
                isLight={isLight}
              />
            </div>
            <input
              id="slider-chakra-vortex-strength"
              type="range"
              min={-10.0}
              max={20.0}
              step={0.1}
              value={chakraConfig.vortexStrength ?? 1.6}
              onChange={(e) => updateChakra({ vortexStrength: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer h-1.5"
            />
            <p className="text-[8.5px] opacity-60 mt-0.5">
              Each yantra geometry maintains its own rotational vortex torque and center point.
            </p>
          </div>

          {/* Sequential Cycle Direction (When in sequential mode) */}
          {chakraConfig.playbackMode === 'sequentialMorph' && (
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
                Kundalini Transit Direction
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'ascent', label: 'Ascent (Root➔Crown)', icon: ArrowUp },
                  { id: 'descent', label: 'Descent (Crown➔Root)', icon: ArrowDown },
                  { id: 'pingpong', label: 'Oscillation', icon: Repeat },
                ].map((dir) => {
                  const Icon = dir.icon;
                  return (
                    <button
                      key={dir.id}
                      id={`chakra-dir-${dir.id}`}
                      onClick={() => updateChakra({ cycleDirection: dir.id as any })}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border transition-all ${
                        chakraConfig.cycleDirection === dir.id
                          ? 'border-purple-500 bg-purple-950/30 text-purple-200 font-bold'
                          : isLight
                          ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600'
                          : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="text-[10px]">{dir.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timing Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] uppercase tracking-wider opacity-70 block mb-0.5">
                Hold Duration
              </label>
              <EditableNumber
                value={chakraConfig.holdDuration ?? 1.2}
                onChange={(v) => updateChakra({ holdDuration: v })}
                min={0.0}
                max={120.0}
                step={0.1}
                unit="s"
                isLight={isLight}
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-wider opacity-70 block mb-0.5">
                Transition Duration
              </label>
              <EditableNumber
                value={chakraConfig.transitionDuration ?? 2.4}
                onChange={(v) => updateChakra({ transitionDuration: v })}
                min={0.02}
                max={120.0}
                step={0.2}
                unit="s"
                isLight={isLight}
              />
            </div>
          </div>

          {/* Attractor Influence & Particle Cloud Sizing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] uppercase tracking-wider opacity-70 block mb-0.5">
                Attractor Gravity
              </label>
              <EditableNumber
                value={chakraConfig.attractorInfluence ?? 1.5}
                onChange={(v) => updateChakra({ attractorInfluence: v })}
                min={-20.0}
                max={50.0}
                step={0.1}
                unit="x"
                isLight={isLight}
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-wider opacity-70 block mb-0.5">
                Particle Cloud Spread
              </label>
              <EditableNumber
                value={chakraConfig.particlePartitionSpread ?? 1.0}
                onChange={(v) => updateChakra({ particlePartitionSpread: v })}
                min={0.02}
                max={20.0}
                step={0.05}
                unit="x"
                isLight={isLight}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: ACOUSTIC CYMATICS & CHLADNI RESONATORS */}
      {activeSubTab === 'cymatics' && (
        <div className="space-y-3.5">
          {/* Master Cymatic State & Telemetry Card */}
          <div className={`p-3 rounded-lg border transition-all ${
            isLight ? 'bg-cyan-50/60 border-cyan-200' : 'bg-cyan-950/20 border-cyan-800/60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                  <Waves className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                    Acoustic Cymatic Resonator
                  </div>
                  <div className="text-[9px] opacity-70">
                    Chladni Standing Waves & Harmonic Attractor Basins
                  </div>
                </div>
              </div>

              {/* Resonance Stability Badge */}
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  timelineState?.isResonanceLocked
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : (timelineState?.cymaticCoherence ?? 0) > 0.45
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {timelineState?.cymaticStatus || (timelineState?.isResonanceLocked ? 'Resonance Lock' : 'Harmonic Transition')}
                </span>
              </div>
            </div>

            {/* Live Frequency & Modal Readout */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black/20 border border-white/5 text-[10px] mb-2">
              <div>
                <span className="opacity-60 text-[8.5px] uppercase block">Acoustic Frequency</span>
                <span className="font-bold text-cyan-300 font-mono text-sm">
                  {Math.round(timelineState?.cymaticFrequency ?? (chakraConfig.cymatics?.frequencyHz ?? 396))} Hz
                </span>
              </div>
              <div className="text-right">
                <span className="opacity-60 text-[8.5px] uppercase block">Nodal Symmetry</span>
                <span className="font-bold text-cyan-200 font-mono text-xs">
                  {chakraConfig.cymatics?.plateGeometry === 'volumetric3D'
                    ? `3D (${timelineState?.modalL ?? 3}, ${timelineState?.modalM ?? 3}, ${timelineState?.modalN ?? 3})`
                    : `m=${timelineState?.modalM ?? 2}, n=${timelineState?.modalN ?? 2}`}
                </span>
              </div>
            </div>

            {/* Live Coherence vs Chaos Meter */}
            <div className="space-y-1">
              <div className="flex justify-between text-[8.5px] uppercase opacity-75">
                <span>Harmonic Coherence (Lock)</span>
                <span className="font-mono font-bold">
                  {Math.round((timelineState?.cymaticCoherence ?? 0.85) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round((timelineState?.cymaticCoherence ?? 0.85) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] opacity-60">
                <span>Chaotic Flutter</span>
                <span>Deterministic Lock</span>
              </div>
            </div>
          </div>

          {/* Engine Toggle: continuous modal resonator vs legacy baked-template engine */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
              Cymatic Engine
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="btn-cymatics-engine-resonator"
                onClick={() => updateCymatics({ engine: 'resonator' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  isResonatorEngine
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Waves className="w-3 h-3 text-cyan-400" />
                  <span>Continuous Resonator</span>
                </div>
                <p className="text-[8px] opacity-70 mt-0.5 leading-tight">
                  One driven, damped modal plate. Particles transport into its live vibration field.
                </p>
              </button>

              <button
                type="button"
                id="btn-cymatics-engine-template"
                onClick={() => updateCymatics({ engine: 'template' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  !isResonatorEngine
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span>Legacy Templates</span>
                </div>
                <p className="text-[8px] opacity-70 mt-0.5 leading-tight">
                  Per-chakra baked Chladni target textures (original engine, kept for old snapshots).
                </p>
              </button>
            </div>
          </div>

          {isResonatorEngine ? (
            <>
              {/* Continuous Modal Resonator: frequency band + station markers */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-80">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    Resonator Drive Frequency
                  </span>
                  <EditableNumber
                    value={Math.round(chakraConfig.cymatics?.frequencyHz ?? 396)}
                    onChange={(v) => updateCymatics({ frequencyHz: v, sweep: { ...(chakraConfig.cymatics?.sweep || { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' }), enabled: false } })}
                    min={1}
                    max={20000}
                    step={1}
                    unit="Hz"
                    isLight={isLight}
                  />
                </div>

                <input
                  id="slider-cymatics-frequency"
                  type="range"
                  min={resonatorFreqMin}
                  max={resonatorFreqMax}
                  step={1}
                  value={chakraConfig.cymatics?.frequencyHz ?? 396}
                  onChange={(e) =>
                    updateCymatics({
                      frequencyHz: parseFloat(e.target.value),
                      sweep: { ...(chakraConfig.cymatics?.sweep || { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' }), enabled: false },
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-1.5"
                />

                {/* Station tick marks under the slider — click to jump straight to a station */}
                <div className="relative h-6">
                  {resonatorStations.map((st) => {
                    const pct = Math.max(0, Math.min(100, ((st.frequencyHz - resonatorFreqMin) / Math.max(1, resonatorFreqMax - resonatorFreqMin)) * 100));
                    return (
                      <button
                        key={st.index}
                        type="button"
                        id={`btn-resonator-station-${st.index}`}
                        title={`${st.name} · ${Math.round(st.frequencyHz)} Hz · m=${st.m} n=${st.n}`}
                        onClick={() =>
                          updateCymatics({
                            frequencyHz: st.frequencyHz,
                            sweep: { ...(chakraConfig.cymatics?.sweep || { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' }), enabled: false },
                          })
                        }
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5 group/tick"
                        style={{ left: `${pct}%` }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full border border-white/30 group-hover/tick:scale-125 transition-transform"
                          style={{ backgroundColor: st.color }}
                        />
                        <span className="text-[7px] font-mono opacity-60 group-hover/tick:opacity-100 whitespace-nowrap">
                          {Math.round(st.frequencyHz)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[8.5px] opacity-60">
                  Continuously retunes ONE driven, damped modal plate — nothing resets. Dwell on a station
                  and its nodal geometry settles; detune and it responds; return and the same figure re-forms.
                </p>
              </div>

              {/* Sweep all seven stations */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-cymatics-sweep-all"
                    onClick={() => updateSweep({ enabled: !(chakraConfig.cymatics?.sweep?.enabled ?? false) })}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                      chakraConfig.cymatics?.sweep?.enabled
                        ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-xs'
                        : isLight
                        ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {chakraConfig.cymatics?.sweep?.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{chakraConfig.cymatics?.sweep?.enabled ? 'Sweeping All 7 Stations' : 'Sweep All 7 Stations'}</span>
                  </button>
                  <select
                    id="select-cymatics-sweep-direction"
                    value={chakraConfig.cymatics?.sweep?.direction ?? 'ascent'}
                    onChange={(e) => updateSweep({ direction: e.target.value as CymaticsSweepDirection })}
                    className={`text-[9px] font-mono rounded-lg border px-1.5 py-1.5 ${
                      isLight ? 'border-stone-200 bg-stone-50 text-stone-700' : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <option value="ascent">Ascent</option>
                    <option value="descent">Descent</option>
                    <option value="pingpong">Ping-pong</option>
                  </select>
                </div>
                <ParamRow
                  id="row-sweep-glide"
                  label="Glide"
                  value={chakraConfig.cymatics?.sweep?.glideS ?? 3.5}
                  onChange={(v) => updateSweep({ glideS: v })}
                  min={0.1}
                  max={30}
                  step={0.1}
                  unit="s"
                  decimals={1}
                />
                <ParamRow
                  id="row-sweep-dwell"
                  label="Dwell"
                  value={chakraConfig.cymatics?.sweep?.dwellS ?? 2.0}
                  onChange={(v) => updateSweep({ dwellS: v })}
                  min={0}
                  max={30}
                  step={0.1}
                  unit="s"
                  decimals={1}
                />
                <p className="text-[8px] opacity-50">
                  An uninterrupted glide-and-dwell tour through all seven stations. Particle positions,
                  velocities and the resonator's modal state persist across the entire sweep.
                </p>
              </div>

              {/* The seven stations — actual resonances of this one instrument */}
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1.5 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-purple-400" />
                  The Seven Stations (this instrument's own resonances)
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {resonatorStations.map((st) => {
                    const isCurrent = !chakraConfig.cymatics?.sweep?.enabled && Math.abs((chakraConfig.cymatics?.frequencyHz ?? 396) - st.frequencyHz) < st.frequencyHz * 0.04;
                    return (
                      <button
                        key={st.index}
                        type="button"
                        id={`btn-cymatics-snap-${st.index}`}
                        onClick={() =>
                          updateCymatics({
                            frequencyHz: st.frequencyHz,
                            sweep: { ...(chakraConfig.cymatics?.sweep || { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' }), enabled: false },
                          })
                        }
                        className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                          isCurrent
                            ? 'border-cyan-500 bg-cyan-950/40 text-white shadow-xs'
                            : isLight
                            ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                          <div>
                            <span className="text-[10.5px] font-bold">{st.name}</span>
                            <span className="text-[8.5px] opacity-60 ml-1.5">mode ({st.m}, {st.n})</span>
                          </div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/5 text-cyan-300 font-mono">
                          {Math.round(st.frequencyHz)} Hz
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resonator physics parameters */}
              <div className="space-y-1 pt-1 border-t border-zinc-800/40">
                <ParamRow
                  id="row-res-drive-strength"
                  label="Drive Strength"
                  value={chakraConfig.cymatics?.driveStrength ?? 1.0}
                  onChange={(v) => updateCymatics({ driveStrength: v })}
                  min={0}
                  max={6}
                  step={0.05}
                  decimals={2}
                />
                <ParamRow
                  id="row-res-transport-gain"
                  label="Transport Gain"
                  value={chakraConfig.cymatics?.transportGain ?? 1.0}
                  onChange={(v) => updateCymatics({ transportGain: v })}
                  min={0}
                  max={10}
                  step={0.05}
                  decimals={2}
                  title="Gain on -grad(vibration intensity): pulls particles into nodal regions"
                />
                <ParamRow
                  id="row-res-agitation"
                  label="Agitation"
                  value={chakraConfig.cymatics?.agitation ?? 0.3}
                  onChange={(v) => updateCymatics({ agitation: v })}
                  min={0}
                  max={5}
                  step={0.02}
                  decimals={2}
                  title="Random kick scaled by sqrt(local vibration intensity) — grains bounce where the plate moves"
                />
                <ParamRow
                  id="row-res-boundary"
                  label="Boundary"
                  value={chakraConfig.cymatics?.boundaryStrength ?? 6.0}
                  onChange={(v) => updateCymatics({ boundaryStrength: v })}
                  min={0}
                  max={30}
                  step={0.1}
                  decimals={1}
                />
                <ParamRow
                  id="row-res-plate-size"
                  label="Plate Size"
                  value={chakraConfig.cymatics?.plateSize ?? 700}
                  onChange={(v) => updateCymatics({ plateSize: v })}
                  min={100}
                  max={2000}
                  step={5}
                  decimals={0}
                  unit="px"
                />
                <ParamRow
                  id="row-res-mode-count"
                  label="Mode Count"
                  value={chakraConfig.cymatics?.modeCount ?? 64}
                  onChange={(v) => updateCymatics({ modeCount: Math.round(v) })}
                  min={1}
                  max={64}
                  step={1}
                  decimals={0}
                  title="Number of participating modes, ranked by drive coupling. 64 represents the full band."
                />
                <ParamRow
                  id="row-res-drive-scale"
                  label="Drive Scale"
                  value={chakraConfig.cymatics?.driveScale ?? 1.0}
                  onChange={(v) => updateCymatics({ driveScale: v })}
                  min={0}
                  max={4}
                  step={0.01}
                  decimals={2}
                  title="Final scale on the raw envelope intensity field"
                />
              </div>
            </>
          ) : (
          <>
          {/* Continuous Frequency Spectrum Tuning (legacy template engine) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider opacity-80">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                Continuous Acoustic Spectrum
              </span>
              <EditableNumber
                value={Math.round(chakraConfig.cymatics?.frequencyHz ?? 396)}
                onChange={(v) => updateCymatics({ frequencyHz: v })}
                min={1}
                max={20000}
                step={1}
                unit="Hz"
                isLight={isLight}
              />
            </div>

            <input
              id="slider-cymatics-frequency-legacy"
              type="range"
              min={20}
              max={4000}
              step={1}
              value={chakraConfig.cymatics?.frequencyHz ?? 396}
              onChange={(e) => updateCymatics({ frequencyHz: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-1.5"
            />
            <p className="text-[8.5px] opacity-60">
              Sweep smoothly across frequencies. When traversing between harmonics, particles enter chaotic Faraday flutter before snapping into geometric nodal attractors.
            </p>

            {/* Auto-Sweep Continuous Spectrum Oscillation */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-cymatics-autosweep"
                onClick={() => updateCymatics({ autoSweep: !(chakraConfig.cymatics?.autoSweep ?? false) })}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  chakraConfig.cymatics?.autoSweep
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-xs'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                {chakraConfig.cymatics?.autoSweep ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{chakraConfig.cymatics?.autoSweep ? 'Auto-Sweep Active' : 'Auto-Sweep Spectrum'}</span>
              </button>

              <div className="w-28">
                <EditableNumber
                  value={chakraConfig.cymatics?.sweepSpeed ?? 8.0}
                  onChange={(v) => updateCymatics({ sweepSpeed: v })}
                  min={0.05}
                  max={600.0}
                  step={0.5}
                  unit="s/cycle"
                  isLight={isLight}
                />
              </div>
            </div>
          </div>

          {/* 7 Canonical Chakra Harmonic Attractor Points */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1.5 flex items-center gap-1">
              <Radio className="w-3 h-3 text-purple-400" />
              Chakra Harmonic Attractor Points (Solfeggio Resonance)
            </label>
            <div className="grid grid-cols-1 gap-1">
              {CHAKRA_CYMATIC_PROFILES.map((profile, idx) => {
                const isCurrent = Math.abs((chakraConfig.cymatics?.frequencyHz ?? 396) - profile.frequencyHz) < 8;
                const chakraNode = CANONICAL_CHAKRAS[idx] || CANONICAL_CHAKRAS[0];
                return (
                  <button
                    key={profile.chakraId}
                    type="button"
                    id={`btn-cymatics-snap-${profile.chakraId}`}
                    onClick={() => {
                      updateCymatics({ frequencyHz: profile.frequencyHz, autoSweep: false });
                      updateChakra({ geometryMode: 'cymatics' });
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                      isCurrent
                        ? 'border-cyan-500 bg-cyan-950/40 text-white shadow-xs'
                        : isLight
                        ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: chakraNode.color }}
                      />
                      <div>
                        <span className="text-[10.5px] font-bold">{profile.chakraName}</span>
                        <span className="text-[8.5px] opacity-60 ml-1.5">{profile.symmetryTitle}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/5 text-cyan-300">
                        {profile.frequencyHz} Hz
                      </span>
                      <span className="text-[8.5px] opacity-60">
                        {profile.squareM}×{profile.squareN}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plate Geometry Topology */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
              Cymatic Plate & Boundary Form
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'square', label: 'Square Plate', desc: 'Classic Chladni Matrix' },
                { id: 'circular', label: 'Circular Membrane', desc: 'Bessel Azimuthal Petals' },
                { id: 'volumetric3D', label: '3D Cavity', desc: 'Standing Wave Nodal Cage' },
              ].map((geom) => (
                <button
                  key={geom.id}
                  type="button"
                  id={`btn-plate-${geom.id}`}
                  onClick={() => updateCymatics({ plateGeometry: geom.id as CymaticPlateGeometry })}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    (chakraConfig.cymatics?.plateGeometry ?? 'square') === geom.id
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-bold'
                      : isLight
                      ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600'
                      : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <div className="text-[10px] font-bold">{geom.label}</div>
                  <p className="text-[8px] opacity-65 leading-tight mt-0.5">{geom.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dimension: 2D Planar vs 3D Volumetric */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">
              Spatial Dimensionality
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="btn-cymatics-dim-2d"
                onClick={() => updateCymatics({ dimension: '2D' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  (chakraConfig.cymatics?.dimension ?? '2D') === '2D'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>2D Planar Surface</span>
                </div>
                <p className="text-[8px] opacity-70 mt-0.5 leading-tight">
                  Chladni plates aligned along horizontal discs or vertical spine.
                </p>
              </button>

              <button
                type="button"
                id="btn-cymatics-dim-3d"
                onClick={() => updateCymatics({ dimension: '3D' })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chakraConfig.cymatics?.dimension === '3D'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-bold'
                    : isLight
                    ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1.5">
                  <Box className="w-3 h-3 text-purple-400" />
                  <span>3D Volumetric Cloud</span>
                </div>
                <p className="text-[8px] opacity-70 mt-0.5 leading-tight">
                  True 3D nodal surfaces forming spatial acoustic standing cages.
                </p>
              </button>
            </div>
          </div>

          {/* Physics Attractor Lock & Faraday Turbulence Tuning */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/40">
            <div>
              <div className="flex justify-between items-center text-[9px] uppercase tracking-wider mb-0.5">
                <span className="opacity-70">Nodal Attraction Lock</span>
                <EditableNumber
                  value={chakraConfig.cymatics?.nodalAttraction ?? 2.8}
                  onChange={(v) => updateCymatics({ nodalAttraction: v })}
                  min={-50.0}
                  max={100.0}
                  step={0.1}
                  unit="x"
                  isLight={isLight}
                />
              </div>
              <input
                type="range"
                min={0.0}
                max={20.0}
                step={0.1}
                value={chakraConfig.cymatics?.nodalAttraction ?? 2.8}
                onChange={(e) => updateCymatics({ nodalAttraction: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5"
              />
              <p className="text-[8px] opacity-50 mt-0.5">Deterministic pull into zero-vibration lines.</p>
            </div>

            <div>
              <div className="flex justify-between items-center text-[9px] uppercase tracking-wider mb-0.5">
                <span className="opacity-70">In-Between Chaos</span>
                <EditableNumber
                  value={chakraConfig.cymatics?.chaosIntensity ?? 1.4}
                  onChange={(v) => updateCymatics({ chaosIntensity: v })}
                  min={0.0}
                  max={100.0}
                  step={0.1}
                  unit="x"
                  isLight={isLight}
                />
              </div>
              <input
                type="range"
                min={0.0}
                max={15.0}
                step={0.1}
                value={chakraConfig.cymatics?.chaosIntensity ?? 1.4}
                onChange={(e) => updateCymatics({ chaosIntensity: parseFloat(e.target.value) })}
                className="w-full accent-rose-400 cursor-pointer h-1.5"
              />
              <p className="text-[8px] opacity-50 mt-0.5">Faraday shear & Brownian flutter off-resonance.</p>
            </div>
          </div>
          </>
          )}

          {/* Q-Factor Resonance Bandwidth (shared by both engines) */}
          <div>
            <div className="flex justify-between items-center text-[9px] uppercase tracking-wider mb-0.5">
              <span className="opacity-70">Resonance Q-Factor (Damping Sharpness)</span>
              <EditableNumber
                value={chakraConfig.cymatics?.dampingQFactor ?? 4.5}
                onChange={(v) => updateCymatics({ dampingQFactor: v })}
                min={0.01}
                max={200.0}
                step={0.5}
                unit="Q"
                isLight={isLight}
              />
            </div>
            <input
              type="range"
              min={0.1}
              max={40.0}
              step={0.1}
              value={chakraConfig.cymatics?.dampingQFactor ?? 4.5}
              onChange={(e) => updateCymatics({ dampingQFactor: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer h-1.5"
            />
            <p className="text-[8px] opacity-50 mt-0.5">
              Higher Q-factor produces sharper, narrower harmonic locking zones and wider chaotic transitions.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SPINE TRANSIT / LIVE KUNDALINI HUD */}
      {activeSubTab === 'spine' && (
        <div className="space-y-3">
          {/* Active Chakra HUD Banner */}
          <div
            className="p-3 rounded-lg border transition-all"
            style={{
              borderColor: `${currentNode.color}80`,
              backgroundColor: `${currentNode.color}15`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white shadow-md text-xs"
                  style={{ backgroundColor: currentNode.color }}
                >
                  {currentNode.seedSyllable}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: currentNode.color }}>
                    {currentNode.name} · {currentNode.sanskrit}
                  </div>
                  <div className="text-[9px] opacity-80">
                    {chakraConfig.geometryMode === 'cymatics'
                      ? `Cymatic Harmonic: ${Math.round(timelineState?.cymaticFrequency ?? (currentNode.frequencyHz ?? 396))} Hz · ${timelineState?.cymaticStatus || 'Harmonic Attractor'}`
                      : `${currentNode.element} · ${currentNode.frequencyHz ? `${currentNode.frequencyHz} Hz` : ''}`}
                  </div>
                </div>
              </div>

              {chakraConfig.playbackMode === 'sequentialMorph' && (
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider font-mono opacity-70">
                    {timelineState?.phase === 'hold' ? 'HOLDING' : 'TRANSITING'}
                  </div>
                  <div className="text-xs font-bold font-mono">
                    {Math.round((timelineState?.progress ?? 0) * 100)}%
                  </div>
                </div>
              )}
            </div>

            {/* Live Progress Bar */}
            {chakraConfig.playbackMode === 'sequentialMorph' && (
              <div className="mt-2 h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${(timelineState?.progress ?? 0) * 100}%`,
                    backgroundColor: currentNode.color,
                  }}
                />
              </div>
            )}

            {/* Cymatic Resonance Lock Mini-Bar when in Cymatics mode */}
            {chakraConfig.geometryMode === 'cymatics' && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[8.5px]">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-3 h-3 text-cyan-300" />
                  <span className="font-bold text-cyan-300">
                    {timelineState?.isResonanceLocked ? 'Deterministic Nodal Lock' : 'Harmonic Spectrum State'}
                  </span>
                </div>
                <div className="font-mono">
                  Coherence: {Math.round((timelineState?.cymaticCoherence ?? 0.8) * 100)}%
                </div>
              </div>
            )}
          </div>

          {/* Spine Quick Step Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              id="chakra-step-prev-btn"
              onClick={() => onStepNode(-1)}
              className={`flex-1 py-1.5 rounded-lg border text-center font-bold transition-all ${
                isLight ? 'bg-stone-50 border-stone-200 hover:bg-stone-100' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              ▲ Ascent / Prev Center
            </button>
            <button
              id="chakra-step-next-btn"
              onClick={() => onStepNode(1)}
              className={`flex-1 py-1.5 rounded-lg border text-center font-bold transition-all ${
                isLight ? 'bg-stone-50 border-stone-200 hover:bg-stone-100' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              ▼ Descent / Next Center
            </button>
          </div>

          {/* Interactive Visual Spine Diagram */}
          <div className="space-y-1">
            {(chakraConfig.nodes || CANONICAL_CHAKRAS).map((node, index) => {
              const isCurrent = timelineState?.currentIndex === index;
              return (
                <div
                  key={node.id}
                  onClick={() => onJumpToNode(index)}
                  className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                    isCurrent
                      ? 'border-purple-500 bg-purple-950/30 shadow-xs'
                      : isLight
                      ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                      : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: node.color }}
                    />
                    <span className="font-bold text-[11px]">{node.seedSyllable}</span>
                    <span className="text-[10px]">{node.name}</span>
                    <span className="text-[8px] opacity-60">({node.sanskrit})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] opacity-70 font-mono">y: {Math.round(node.y)}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{
                        backgroundColor: `${node.color}20`,
                        color: node.color,
                      }}
                    >
                      {node.frequencyHz} Hz
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: COORDINATES & SPATIAL PLACEMENT */}
      {activeSubTab === 'coordinates' && (
        <div className="space-y-2">
          <div className="text-[10px] opacity-70 mb-1">
            Place shapes anywhere in 2D space. Each node acts as an attractor vortex and morph anchor.
          </div>

          {(chakraConfig.nodes || CANONICAL_CHAKRAS).map((node) => {
            const isExpanded = expandedNodeId === node.id;
            return (
              <div
                key={node.id}
                className={`rounded-lg border transition-all overflow-hidden ${
                  isLight ? 'border-stone-200 bg-stone-50/50' : 'border-zinc-800 bg-zinc-900/40'
                }`}
              >
                <div
                  className="flex items-center justify-between p-2 cursor-pointer hover:opacity-90"
                  onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: node.color }}
                    />
                    <span className="font-bold text-[10px]">{node.name}</span>
                    <span className="text-[9px] opacity-60">
                      ({Math.round(node.x)}, {Math.round(node.y)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={node.active}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNode(node.id, { active: e.target.checked });
                      }}
                      className="rounded border-zinc-700 text-purple-600 focus:ring-0"
                    />
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className={`p-2.5 pt-0 space-y-2 border-t ${
                      isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] opacity-70 block mb-0.5">X Position</label>
                        <EditableNumber
                          value={Math.round(node.x)}
                          onChange={(v) => updateNode(node.id, { x: v })}
                          min={-4000}
                          max={4000}
                          step={10}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] opacity-70 block mb-0.5">Y Position</label>
                        <EditableNumber
                          value={Math.round(node.y)}
                          onChange={(v) => updateNode(node.id, { y: v })}
                          min={-4000}
                          max={4000}
                          step={10}
                          isLight={isLight}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] opacity-70 block mb-0.5">Scale Size</label>
                        <EditableNumber
                          value={node.scale ?? 1.0}
                          onChange={(v) => updateNode(node.id, { scale: v })}
                          min={0.01}
                          max={20.0}
                          step={0.1}
                          unit="x"
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] opacity-70 block mb-0.5">Attractor Gravity</label>
                        <EditableNumber
                          value={node.attractorStrength ?? 2.0}
                          onChange={(v) => updateNode(node.id, { attractorStrength: v })}
                          min={-50.0}
                          max={100.0}
                          step={0.2}
                          unit="g"
                          isLight={isLight}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] opacity-70 block mb-0.5">Signature Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={node.color}
                          onChange={(e) => updateNode(node.id, { color: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="font-mono text-[10px]">{node.color}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 4: PRESETS & SPATIAL ALIGNMENTS */}
      {activeSubTab === 'presets' && (
        <div className="space-y-2">
          <div className="text-[10px] opacity-70 mb-1">
            Choose pre-calculated spiritual and geometric alignments for the subtle body.
          </div>

          <div className="space-y-1.5">
            {[
              {
                id: 'spine_straight',
                name: 'Classical Spine Alignment',
                desc: 'Vertical meridian alignment spanning from root pelvic base (-260px) to crown lotus (+240px).',
                nodes: CHAKRA_SPATIAL_PRESETS.spine_straight,
              },
              {
                id: 'compact_torso',
                name: 'Compact Human Torso',
                desc: 'Tighter proportional spacing centered on the heart chakra.',
                nodes: CHAKRA_SPATIAL_PRESETS.compact_torso,
              },
              {
                id: 'kundalini_serpentine',
                name: 'Serpentine Kundalini Arc',
                desc: 'Sinusoidal Ida & Pingala subtle energetic spiral curving through space.',
                nodes: CHAKRA_SPATIAL_PRESETS.kundalini_serpentine,
              },
              {
                id: 'heart_centered_expansion',
                name: 'Heart-Centered Radial Mandala',
                desc: 'Anahata at origin (0, 0) with peripheral centers arranged in sacred symmetry.',
                nodes: CHAKRA_SPATIAL_PRESETS.heart_centered_expansion,
              },
            ].map((preset) => (
              <div
                key={preset.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  isLight ? 'border-stone-200 bg-stone-50 hover:bg-stone-100' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[11px] text-purple-400">{preset.name}</div>
                    <div className="text-[9px] opacity-70 mt-0.5 leading-tight">{preset.desc}</div>
                  </div>
                  <button
                    id={`apply-chakra-preset-${preset.id}`}
                    onClick={() => applySpatialPreset(preset.nodes)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded bg-purple-600 hover:bg-purple-500 text-white transition-all ml-2"
                  >
                    APPLY
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
