/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Palette,
  Wind,
  Circle,
  Square,
  Orbit,
  Plus,
  Minus,
  Save,
  Upload,
  Download,
  Trash2,
  Copy,
  Image as ImageIcon,
  Terminal,
  Type,
  MousePointer,
  Layers,
  Radio,
  RefreshCw,
  Waves,
  Boxes,
} from 'lucide-react';
import {
  PointCloudConfig,
  ThemeColorProfile,
  MaterialParticleProfile,
  BackgroundAtmosphereMode,
  MorphTelemetry,
  CompositionTelemetry,
} from '../engine/types';
import { Entity } from '../engine/fieldModel';
import { entityParamDefs } from '../engine/paramRegistry';
import { ParamRow } from './ParamRow';
import { MorphPanel } from './MorphPanel';
import { CymaticMediumPanel } from './CymaticMediumPanel';
import { CompositionPanel } from './CompositionPanel';
import { AutomationPanel } from './AutomationPanel';
import { EntitiesPanel, PlacementTarget } from './EntitiesPanel';
import { EntityEditor } from './EntityEditor';
import { RegistryRow } from './RegistryRow';
import { PARAM_REGISTRY } from '../engine/paramRegistry';
import { AutomationLiveValue } from '../engine/automation';
import { SavedSnapshot } from '../engine/configMigration';

export interface StudioInspectorProps {
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  setConfig: React.Dispatch<React.SetStateAction<PointCloudConfig>>;
  isOpen: boolean;
  onClose: () => void;
  isLight: boolean;
  onOpenImageModal: () => void;
  onOpenAsciiModal: () => void;
  onTriggerDisperse: (strength?: number) => void;
  onSaveState: (name: string) => void;
  savedStates: SavedSnapshot[];
  activeSnapshotId?: string | null;
  onLoadState: (state: SavedSnapshot) => void;
  onDeleteState: (id: string, name: string) => void;
  onExportStateJson: (state: SavedSnapshot) => void;
  onOpenImportJsonModal: () => void;
  compositionTelemetry?: CompositionTelemetry | null;
  morphTelemetry?: MorphTelemetry | null;
  automationLive?: AutomationLiveValue[];
  onFireAutomation: (id: string) => void;
  onResetMorphPhases: () => void;
  onImportLibraryFile?: (file: File) => void;

  // Entities scope
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onAddEntity: (entity: Entity) => void;
  onRemoveEntity: (id: string) => void;
  onDuplicateEntity: (id: string) => void;
  onMoveEntity: (id: string, dir: 1 | -1) => void;
  onUpdateEntity: (id: string, patch: Partial<Entity>) => void;
  onSetEntities: (next: Entity[]) => void;
  isPlacementMode: boolean;
  placementTarget: PlacementTarget;
  onStartPlaceNewPin: () => void;
  onStartPlaceSelected: () => void;

  // Composition scope
  onApplyCompositionPreset: (id: string) => void;
}

const THEMES_STORAGE_KEY = 'pointcloud_saved_themes_v2';
const MATERIALS_STORAGE_KEY = 'pointcloud_saved_materials_v2';

const DEFAULT_THEME_PROFILES: ThemeColorProfile[] = [
  {
    id: 'theme_cyberpunk',
    name: 'Cyberpunk Neon',
    timestamp: 1,
    colorMode: 'whiteOnBlack',
    backgroundColor: '#09090b',
    backgroundMode: 'ambientGlow',
    backgroundGlowIntensity: 0.5,
    color: {
      enabled: true,
      mode: 'velocityThermal',
      primaryColor: '#00f0ff',
      secondaryColor: '#f43f5e',
      accentColor: '#ffe600',
      cycleSpeed: 0.8,
      hueShiftSpeed: 0.2,
      waveFrequency: 2.0,
      angle: 45,
      fieldCenterOffset: [0, 0],
      turbulenceModulation: 0.35,
      speedReactiveIntensity: 0.8,
      densityWeight: 0.6,
      contrast: 1.2,
    },
  },
  {
    id: 'theme_obsidian_amber',
    name: 'Obsidian Amber',
    timestamp: 2,
    colorMode: 'whiteOnBlack',
    backgroundColor: '#0c0a09',
    backgroundMode: 'ambientGlow',
    backgroundGlowIntensity: 0.4,
    color: {
      enabled: true,
      mode: 'linearGradient',
      primaryColor: '#f59e0b',
      secondaryColor: '#d97706',
      accentColor: '#fef3c7',
      cycleSpeed: 0.5,
      hueShiftSpeed: 0.1,
      waveFrequency: 1.5,
      angle: 69,
      fieldCenterOffset: [0, 0],
      turbulenceModulation: 0.25,
      speedReactiveIntensity: 0.5,
      densityWeight: 0.5,
      contrast: 1.1,
    },
  },
  {
    id: 'theme_alabaster_noir',
    name: 'Alabaster Noir',
    timestamp: 3,
    colorMode: 'blackOnWhite',
    backgroundColor: '#fafaf9',
    backgroundMode: 'solid',
    backgroundGlowIntensity: 0.0,
    color: {
      enabled: true,
      mode: 'linearGradient',
      primaryColor: '#1c1917',
      secondaryColor: '#44403c',
      accentColor: '#09090b',
      cycleSpeed: 0.0,
      hueShiftSpeed: 0.0,
      waveFrequency: 1.0,
      angle: 0,
      fieldCenterOffset: [0, 0],
      turbulenceModulation: 0.0,
      speedReactiveIntensity: 0.2,
      densityWeight: 0.8,
      contrast: 1.4,
    },
  },
  {
    id: 'theme_aurora_emerald',
    name: 'Aurora Emerald',
    timestamp: 4,
    colorMode: 'whiteOnBlack',
    backgroundColor: '#022c22',
    backgroundMode: 'vignette',
    backgroundGlowIntensity: 0.6,
    color: {
      enabled: true,
      mode: 'waveInterference',
      primaryColor: '#10b981',
      secondaryColor: '#06b6d4',
      accentColor: '#a7f3d0',
      cycleSpeed: 0.9,
      hueShiftSpeed: 0.25,
      waveFrequency: 3.0,
      angle: 29,
      fieldCenterOffset: [0, 0],
      turbulenceModulation: 0.45,
      speedReactiveIntensity: 0.9,
      densityWeight: 0.7,
      contrast: 1.3,
    },
  },
  {
    id: 'theme_spectral_rainbow',
    name: 'Chrono Spectral',
    timestamp: 5,
    colorMode: 'whiteOnBlack',
    backgroundColor: '#050508',
    backgroundMode: 'ambientGlow',
    backgroundGlowIntensity: 0.55,
    color: {
      enabled: true,
      mode: 'rainbowSpectral',
      primaryColor: '#8b5cf6',
      secondaryColor: '#ec4899',
      accentColor: '#38bdf8',
      cycleSpeed: 1.2,
      hueShiftSpeed: 0.4,
      waveFrequency: 2.5,
      angle: 0,
      fieldCenterOffset: [0, 0],
      turbulenceModulation: 0.3,
      speedReactiveIntensity: 1.0,
      densityWeight: 0.6,
      contrast: 1.25,
    },
  },
];

const DEFAULT_MATERIAL_PROFILES: MaterialParticleProfile[] = [
  {
    id: 'mat_ink_stipple',
    name: 'Fine Ink Stipple',
    timestamp: 1,
    style: 'stipple',
    dotShape: 'circle',
    particleSize: { min: 0.8, max: 2.2 },
    particleCount: 65536,
    fluid: { curlScale: 1.0, curlSpeed: 0.8, vortexStrength: 1.2, viscosity: 0.94, returnSpeed: 1.5, turbulence: 0.8, dispersion: 0.4 },
  },
  {
    id: 'mat_halftone_matrix',
    name: 'Halftone Print Matrix',
    timestamp: 2,
    style: 'halftone',
    dotShape: 'square',
    particleSize: { min: 1.5, max: 5.5 },
    particleCount: 40000,
    fluid: { curlScale: 0.8, curlSpeed: 0.6, vortexStrength: 0.8, viscosity: 0.96, returnSpeed: 2.2, turbulence: 0.4, dispersion: 0.2 },
  },
  {
    id: 'mat_superfluid_plasma',
    name: 'Superfluid Plasma',
    timestamp: 3,
    style: 'stipple',
    dotShape: 'circle',
    particleSize: { min: 1.2, max: 3.8 },
    particleCount: 80000,
    fluid: { curlScale: 2.2, curlSpeed: 1.8, vortexStrength: 3.2, viscosity: 0.91, returnSpeed: 0.6, turbulence: 2.4, dispersion: 1.2 },
  },
  {
    id: 'mat_granular_sand',
    name: 'Granular Micro-Sand',
    timestamp: 4,
    style: 'stipple',
    dotShape: 'circle',
    particleSize: { min: 0.4, max: 1.2 },
    particleCount: 120000,
    fluid: { curlScale: 1.5, curlSpeed: 1.0, vortexStrength: 1.8, viscosity: 0.88, returnSpeed: 0.9, turbulence: 1.6, dispersion: 2.0 },
  },
  {
    id: 'mat_liquid_mercury',
    name: 'Liquid Heavy Mercury',
    timestamp: 5,
    style: 'stipple',
    dotShape: 'circle',
    particleSize: { min: 1.6, max: 4.8 },
    particleCount: 50000,
    fluid: { curlScale: 0.6, curlSpeed: 0.4, vortexStrength: 1.5, viscosity: 0.975, returnSpeed: 3.0, turbulence: 0.3, dispersion: 0.1 },
  },
];

/** Small coloured badge naming the scope a group of controls edits. */
const ScopeBand: React.FC<{ label: string; hint: string; tone: string }> = ({ label, hint, tone }) => (
  <div className={`px-3 py-1.5 flex items-center gap-2 border-b border-inherit ${tone}`}>
    <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em]">{label}</span>
    <span className="text-[8.5px] font-mono opacity-60 truncate">{hint}</span>
  </div>
);

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  config,
  onChange,
  setConfig,
  isOpen,
  onClose,
  isLight,
  onOpenImageModal,
  onOpenAsciiModal,
  onTriggerDisperse,
  onSaveState,
  savedStates,
  onLoadState,
  onDeleteState,
  onExportStateJson,
  onOpenImportJsonModal,
  activeSnapshotId,
  compositionTelemetry,
  morphTelemetry,
  automationLive = [],
  onFireAutomation,
  onResetMorphPhases,
  onImportLibraryFile,
  selectedEntityId,
  onSelectEntity,
  onAddEntity,
  onRemoveEntity,
  onDuplicateEntity,
  onMoveEntity,
  onUpdateEntity,
  onSetEntities,
  isPlacementMode,
  placementTarget,
  onStartPlaceNewPin,
  onStartPlaceSelected,
  onApplyCompositionPreset,
}) => {
  // Accordion section states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    source: false,
    morph: true,
    cymatics: false,
    color: false,
    fluid: false,
    particles: false,
    interaction: false,
    relational: false,
    pairwise: false,
    automation: false,
    profiles: true,
    entities: true,
    entityEditor: true,
    composition: true,
  });

  const [profileTab, setProfileTab] = useState<'snapshots' | 'theme' | 'material'>('snapshots');
  const [themeProfiles, setThemeProfiles] = useState<ThemeColorProfile[]>(() => {
    try {
      const stored = localStorage.getItem(THEMES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_THEME_PROFILES;
  });
  const [materialProfiles, setMaterialProfiles] = useState<MaterialParticleProfile[]>(() => {
    try {
      const stored = localStorage.getItem(MATERIALS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MATERIAL_PROFILES;
  });

  const [newThemeName, setNewThemeName] = useState('');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const toggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  // Profile Saving Helpers
  const handleSaveTheme = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newThemeName.trim() || `Theme ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newTheme: ThemeColorProfile = {
      id: 'theme_' + Date.now(),
      name,
      timestamp: Date.now(),
      colorMode: config.colorMode,
      backgroundColor: config.backgroundColor || config.color?.backgroundColor || (config.colorMode === 'blackOnWhite' ? '#fafaf9' : '#09090b'),
      backgroundMode: config.backgroundMode || config.color?.backgroundMode || 'ambientGlow',
      backgroundGlowIntensity: config.backgroundGlowIntensity ?? config.color?.backgroundGlowIntensity ?? 0.45,
      color: JSON.parse(JSON.stringify(config.color || {})),
    };
    const updated = [newTheme, ...themeProfiles];
    setThemeProfiles(updated);
    localStorage.setItem(THEMES_STORAGE_KEY, JSON.stringify(updated));
    setNewThemeName('');
  };

  const handleApplyTheme = (theme: ThemeColorProfile) => {
    onChange({
      colorMode: theme.colorMode,
      backgroundColor: theme.backgroundColor,
      backgroundMode: theme.backgroundMode,
      backgroundGlowIntensity: theme.backgroundGlowIntensity,
      color: { ...theme.color, backgroundColor: theme.backgroundColor, backgroundMode: theme.backgroundMode, backgroundGlowIntensity: theme.backgroundGlowIntensity },
    });
  };

  const handleDeleteTheme = (id: string) => {
    const updated = themeProfiles.filter((t) => t.id !== id);
    setThemeProfiles(updated);
    localStorage.setItem(THEMES_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMaterialName.trim() || `Material ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newMat: MaterialParticleProfile = {
      id: 'mat_' + Date.now(),
      name,
      timestamp: Date.now(),
      style: config.style || 'stipple',
      dotShape: config.dotShape || 'circle',
      particleSize: { ...config.particleSize },
      particleCount: config.particleCount,
      fluid: JSON.parse(JSON.stringify(config.fluid)),
    };
    const updated = [newMat, ...materialProfiles];
    setMaterialProfiles(updated);
    localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(updated));
    setNewMaterialName('');
  };

  const handleApplyMaterial = (mat: MaterialParticleProfile) => {
    onChange({ style: mat.style, dotShape: mat.dotShape, particleSize: { ...mat.particleSize }, particleCount: mat.particleCount, fluid: { ...mat.fluid } });
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = materialProfiles.filter((m) => m.id !== id);
    setMaterialProfiles(updated);
    localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(updated));
  };

  if (!isOpen) return null;

  const colorCfg = config.color || {
    enabled: true,
    mode: 'velocityThermal',
    primaryColor: '#00f0ff',
    secondaryColor: '#f43f5e',
    accentColor: '#ffe600',
    cycleSpeed: 0.8,
    hueShiftSpeed: 0.2,
    waveFrequency: 2.0,
    angle: 45,
    fieldCenterOffset: [0, 0],
    turbulenceModulation: 0.35,
    speedReactiveIntensity: 0.8,
    densityWeight: 0.6,
    contrast: 1.2,
    backgroundColor: '#09090b',
    backgroundMode: 'ambientGlow',
    backgroundGlowIntensity: 0.45,
  };

  const entities = config.entities ?? [];
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const selectedIndex = selectedEntity ? entities.indexOf(selectedEntity) : -1;
  const selectedEntityDefs = selectedEntity && selectedIndex >= 0 ? entityParamDefs(selectedIndex, selectedEntity) : [];

  const accordionBtn = 'w-full px-3 py-2 flex items-center justify-between font-bold text-[10px] uppercase font-mono tracking-wider opacity-85 hover:opacity-100 bg-stone-500/5 transition-colors';

  return (
    <aside
      id="studio-inspector-drawer"
      className={`fixed top-8 sm:top-9 right-0 bottom-0 z-40 w-full max-w-[420px] sm:w-[380px] md:w-[420px] border-l backdrop-blur-2xl shadow-2xl flex flex-col transition-all duration-200 select-none ${
        isLight ? 'bg-white/95 border-stone-200 text-stone-900 shadow-stone-400/20' : 'bg-zinc-950/95 border-zinc-800/90 text-zinc-100 shadow-black/80'
      }`}
    >
      {/* Top Header */}
      <div className="px-3 py-2 border-b border-inherit flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-[11px] uppercase tracking-wider font-mono">Inspector Studio</span>
        </div>
        <button type="button" onClick={onClose} className="text-[10px] font-mono opacity-60 hover:opacity-100 px-1.5 py-0.5 rounded hover:bg-stone-500/20 transition-colors" title="Close Inspector">
          ESC
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ============================================================ */}
        {/* SCOPE A — FIELD */}
        {/* ============================================================ */}
        <ScopeBand label="Field" hint="shared physics, palette, particles, morph & cymatic drive" tone="bg-cyan-500/10 text-cyan-400" />
        <div className="divide-y divide-inherit">
          {/* Source & Typography */}
          <div>
            <button type="button" onClick={() => toggleSection('source')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Type className="w-3 h-3" />
                <span>Typography & Source</span>
              </div>
              {openSections.source ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.source && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between py-1 gap-2">
                  <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Font Family</span>
                  <input
                    type="text"
                    value={config.fontFamily ?? ''}
                    placeholder="system-ui, serif, 'Noto Sans Devanagari'…"
                    onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
                    className={`flex-1 min-w-0 px-2 py-1 rounded text-[9.5px] font-mono border outline-none ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`}
                  />
                </div>
                <div className="flex items-center justify-between py-1 gap-2">
                  <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Font Weight</span>
                  <select
                    value={String(config.fontWeight ?? 900)}
                    onChange={(e) => onChange({ fontWeight: parseInt(e.target.value, 10) })}
                    className={`flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`}
                  >
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button type="button" onClick={onOpenImageModal} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-stone-500/10 hover:bg-stone-500/20 text-[9px] font-mono uppercase font-semibold">
                    <ImageIcon className="w-2.5 h-2.5 text-blue-400" />
                    <span>Vector Image</span>
                  </button>
                  <button type="button" onClick={onOpenAsciiModal} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-stone-500/10 hover:bg-stone-500/20 text-[9px] font-mono uppercase font-semibold">
                    <Terminal className="w-2.5 h-2.5 text-emerald-400" />
                    <span>ASCII Matrix</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Morph drive */}
          <div>
            <button type="button" onClick={() => toggleSection('morph')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-blue-400">
                <Orbit className="w-3 h-3" />
                <span>Morph Drive</span>
              </div>
              {openSections.morph ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.morph && (
              <div className="p-3">
                <MorphPanel config={config} onChange={onChange} telemetry={morphTelemetry ?? null} onResetPhases={onResetMorphPhases} isLight={isLight} />
              </div>
            )}
          </div>

          {/* Cymatic medium */}
          <div>
            <button type="button" onClick={() => toggleSection('cymatics')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Waves className="w-3 h-3" />
                <span>Cymatic Medium</span>
              </div>
              {openSections.cymatics ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.cymatics && (
              <div className="p-3">
                <CymaticMediumPanel config={config} onChange={onChange} telemetry={compositionTelemetry?.cymatic} isLight={isLight} />
              </div>
            )}
          </div>

          {/* Colour Field & Atmosphere */}
          <div>
            <button type="button" onClick={() => toggleSection('color')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-purple-400">
                <Palette className="w-3 h-3" />
                <span>Colour Field & Atmosphere</span>
              </div>
              {openSections.color ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.color && (
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Color Field</span>
                  <select
                    value={colorCfg.mode}
                    onChange={(e) => onChange({ color: { ...colorCfg, enabled: true, mode: e.target.value as any } })}
                    className={`flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`}
                  >
                    <option value="velocityThermal">Velocity Thermal</option>
                    <option value="linearGradient">Linear Gradient</option>
                    <option value="radialGradient">Radial Gradient</option>
                    <option value="angularSweep">Angular Sweep</option>
                    <option value="waveInterference">Wave Interference</option>
                    <option value="rainbowSpectral">Spectral Chromatic</option>
                    <option value="densityDepth">Density Depth</option>
                  </select>
                </div>

                <div className="py-1">
                  <span className="text-[9px] font-mono uppercase opacity-60 block mb-1">Color Palette Stops</span>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded border border-inherit cursor-pointer">
                      <input type="color" value={colorCfg.primaryColor} onChange={(e) => onChange({ color: { ...colorCfg, primaryColor: e.target.value } })} className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent" />
                      <span className="text-[9px] font-mono uppercase opacity-80">Primary</span>
                    </label>
                    <label className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded border border-inherit cursor-pointer">
                      <input type="color" value={colorCfg.secondaryColor} onChange={(e) => onChange({ color: { ...colorCfg, secondaryColor: e.target.value } })} className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent" />
                      <span className="text-[9px] font-mono uppercase opacity-80">Second</span>
                    </label>
                    <label className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded border border-inherit cursor-pointer">
                      <input type="color" value={colorCfg.accentColor} onChange={(e) => onChange({ color: { ...colorCfg, accentColor: e.target.value } })} className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent" />
                      <span className="text-[9px] font-mono uppercase opacity-80">Accent</span>
                    </label>
                  </div>
                </div>

                {(() => {
                  const stops = colorCfg.customPaletteColors;
                  const useCustom = !!stops && stops.length >= 2;
                  const setStops = (next: string[] | undefined) => onChange({ color: { ...colorCfg, customPaletteColors: next } });
                  return (
                    <div className="py-1 border-t border-inherit/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono uppercase opacity-60">Custom Stops {useCustom ? `(${stops!.length}/8)` : ''}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setStops(useCustom ? undefined : [colorCfg.primaryColor, colorCfg.secondaryColor, colorCfg.accentColor])}
                            className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase border ${useCustom ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'border-inherit opacity-60'}`}
                            title="Use a variable number of colour stops instead of the fixed primary / secondary / accent trio"
                          >
                            {useCustom ? 'On' : 'Off'}
                          </button>
                          {useCustom && (
                            <button
                              type="button"
                              disabled={stops!.length >= 8}
                              onClick={() => setStops([...stops!, stops![stops!.length - 1]])}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[8.5px] font-mono uppercase font-bold disabled:opacity-30"
                            >
                              <Plus className="w-2.5 h-2.5" /> stop
                            </button>
                          )}
                        </div>
                      </div>
                      {useCustom && (
                        <div className="flex flex-wrap gap-1">
                          {stops!.map((c, i) => (
                            <div key={i} className="flex items-center gap-0.5 px-1 py-0.5 rounded border border-inherit">
                              <input type="color" value={c} onChange={(e) => setStops(stops!.map((x, j) => (j === i ? e.target.value : x)))} className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer" />
                              <span className="text-[8px] font-mono opacity-60">{i + 1}</span>
                              <button type="button" disabled={stops!.length <= 2} onClick={() => setStops(stops!.filter((_, j) => j !== i))} className="text-red-400 opacity-60 hover:opacity-100 disabled:opacity-20" title="Remove stop">
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          <div className="w-full h-1.5 rounded mt-1" style={{ background: `linear-gradient(90deg, ${stops!.join(', ')})` }} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="py-1 border-t border-inherit/40">
                  <span className="text-[9px] font-mono uppercase opacity-60 block mb-1">Canvas Background Atmosphere</span>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded border border-inherit cursor-pointer">
                      <input
                        type="color"
                        value={config.backgroundColor || colorCfg.backgroundColor || '#09090b'}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChange({ backgroundColor: val, color: { ...colorCfg, backgroundColor: val } });
                        }}
                        className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-[9px] font-mono uppercase opacity-80">Color</span>
                    </label>
                    <select
                      value={config.backgroundMode || colorCfg.backgroundMode || 'ambientGlow'}
                      onChange={(e) => {
                        const val = e.target.value as BackgroundAtmosphereMode;
                        onChange({ backgroundMode: val, color: { ...colorCfg, backgroundMode: val } });
                      }}
                      className={`text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none flex-1 ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`}
                    >
                      <option value="ambientGlow">Ambient Glow</option>
                      <option value="vignette">Vignette Depth</option>
                      <option value="solid">Pure Solid</option>
                      <option value="adaptive">Adaptive Radial</option>
                    </select>
                  </div>
                  <ParamRow
                    label="Glow Intensity"
                    value={config.backgroundGlowIntensity ?? colorCfg.backgroundGlowIntensity ?? 0.45}
                    onChange={(val) => onChange({ backgroundGlowIntensity: val, color: { ...colorCfg, backgroundGlowIntensity: val } })}
                    min={0.0}
                    max={3.0}
                    hardMin={0.0}
                    hardMax={10.0}
                    step={0.05}
                  />
                </div>

                <ParamRow label="Cycle Speed" value={colorCfg.cycleSpeed ?? 0.8} onChange={(val) => onChange({ color: { ...colorCfg, cycleSpeed: val } })} min={-10.0} max={10.0} hardMin={-30.0} hardMax={30.0} step={0.1} />
                <ParamRow label="Hue Shift Spd" value={colorCfg.hueShiftSpeed ?? 0.2} onChange={(val) => onChange({ color: { ...colorCfg, hueShiftSpeed: val } })} min={-6.0} max={6.0} hardMin={-20.0} hardMax={20.0} step={0.05} />
                <ParamRow label="Wave Frequency" value={colorCfg.waveFrequency ?? 2.0} onChange={(val) => onChange({ color: { ...colorCfg, waveFrequency: val } })} min={0.05} max={24.0} hardMin={0.0} hardMax={50.0} step={0.1} />
                <ParamRow label="Gradient Angle" value={colorCfg.angle ?? 45} onChange={(val) => onChange({ color: { ...colorCfg, angle: val } })} min={-360} max={360} hardMin={-3600} hardMax={3600} step={1} decimals={0} unit="°" />
                <ParamRow label="Density Weight" value={colorCfg.densityWeight ?? 0.5} onChange={(val) => onChange({ color: { ...colorCfg, densityWeight: val } })} min={0.0} max={3.0} hardMin={-10.0} hardMax={10.0} step={0.05} />
                <ParamRow label="Field Centre X" value={colorCfg.fieldCenterOffset?.[0] ?? 0} onChange={(val) => onChange({ color: { ...colorCfg, fieldCenterOffset: [val, colorCfg.fieldCenterOffset?.[1] ?? 0] } })} min={-3.0} max={3.0} hardMin={-20.0} hardMax={20.0} step={0.05} />
                <ParamRow label="Field Centre Y" value={colorCfg.fieldCenterOffset?.[1] ?? 0} onChange={(val) => onChange({ color: { ...colorCfg, fieldCenterOffset: [colorCfg.fieldCenterOffset?.[0] ?? 0, val] } })} min={-3.0} max={3.0} hardMin={-20.0} hardMax={20.0} step={0.05} />
                <ParamRow label="Velocity React" value={colorCfg.speedReactiveIntensity ?? 0.8} onChange={(val) => onChange({ color: { ...colorCfg, speedReactiveIntensity: val } })} min={0.0} max={5.0} hardMin={0.0} hardMax={20.0} step={0.05} />
                <ParamRow label="Turbulence Mod" value={colorCfg.turbulenceModulation ?? 0.35} onChange={(val) => onChange({ color: { ...colorCfg, turbulenceModulation: val } })} min={0.0} max={3.0} hardMin={0.0} hardMax={10.0} step={0.05} />
                <ParamRow label="Contrast" value={colorCfg.contrast ?? 1.2} onChange={(val) => onChange({ color: { ...colorCfg, contrast: val } })} min={0.1} max={5.0} hardMin={0.0} hardMax={10.0} step={0.05} />
              </div>
            )}
          </div>

          {/* Fluid & Physics+ */}
          <div>
            <button type="button" onClick={() => toggleSection('fluid')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Wind className="w-3 h-3" />
                <span>Fluid & Physics+</span>
              </div>
              {openSections.fluid ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.fluid && (
              <div className="p-3 space-y-1.5">
                {PARAM_REGISTRY.filter((p) => p.group === 'Fluid').map((p) => (
                  <RegistryRow key={p.path} path={p.path} config={config} onChange={onChange} />
                ))}
                <div className="pt-1.5 mt-1 border-t border-inherit/40">
                  <span className="text-[9px] font-mono uppercase opacity-60 block mb-0.5">Extended physics</span>
                  {PARAM_REGISTRY.filter((p) => p.group === 'Physics+').map((p) => (
                    <RegistryRow key={p.path} path={p.path} config={config} onChange={onChange} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shared medium & glyph colliders */}
          <div>
            <button type="button" onClick={() => toggleSection('medium')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-sky-400">
                <Wind className="w-3 h-3" />
                <span>Medium & Collision</span>
              </div>
              {openSections.medium ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.medium && (
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70">Shared Medium</span>
                  <button
                    type="button"
                    onClick={() => onChange({ medium: { ...(config.medium ?? {}), enabled: !(config.medium?.enabled ?? false) } as PointCloudConfig['medium'] })}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.medium?.enabled ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'border-inherit opacity-60'}`}
                  >
                    {config.medium?.enabled ? 'On' : 'Off'}
                  </button>
                </div>
                {PARAM_REGISTRY.filter((p) => p.group === 'Medium').map((p) => (
                  <RegistryRow key={p.path} path={p.path} config={config} onChange={onChange} />
                ))}
                <div className="pt-1.5 mt-1 border-t border-inherit/40">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[10px] font-mono uppercase opacity-70">Glyph Colliders</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChange({ collision: { ...(config.collision ?? {}), mode: 'obstacle', enabled: !(config.collision?.enabled ?? false) } as PointCloudConfig['collision'] })}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.collision?.enabled && config.collision?.mode !== 'vessel' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'border-inherit opacity-60'}`}
                      >
                        Obstacle
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ collision: { ...(config.collision ?? {}), mode: 'vessel', enabled: true } as PointCloudConfig['collision'] })}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.collision?.enabled && config.collision?.mode === 'vessel' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'border-inherit opacity-60'}`}
                      >
                        Vessel
                      </button>
                    </div>
                  </div>
                  {PARAM_REGISTRY.filter((p) => p.group === 'Collision').map((p) => (
                    <RegistryRow key={p.path} path={p.path} config={config} onChange={onChange} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Particles */}
          <div>
            <button type="button" onClick={() => toggleSection('particles')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-pink-400">
                <Sparkles className="w-3 h-3" />
                <span>Particles & Stipple Density</span>
              </div>
              {openSections.particles ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.particles && (
              <div className="p-3 space-y-2">
                <RegistryRow path="particleCount" config={config} onChange={(p) => onChange({ particleCount: Math.round((p as any).particleCount) })} />
                <RegistryRow path="particleSize.min" config={config} onChange={onChange} />
                <RegistryRow path="particleSize.max" config={config} onChange={onChange} />

                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70">Dot Shape</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onChange({ dotShape: 'circle' })} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.dotShape !== 'square' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'border-inherit opacity-60'}`}>
                      <Circle className="w-2.5 h-2.5 fill-current" />
                      <span>Circle</span>
                    </button>
                    <button type="button" onClick={() => onChange({ dotShape: 'square' })} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.dotShape === 'square' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'border-inherit opacity-60'}`}>
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>Square</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70">Style Filter</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onChange({ style: 'stipple' })} className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.style !== 'halftone' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'border-inherit opacity-60'}`}>
                      Stipple
                    </button>
                    <button type="button" onClick={() => onChange({ style: 'halftone' })} className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.style === 'halftone' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'border-inherit opacity-60'}`}>
                      Halftone
                    </button>
                  </div>
                </div>

                <button type="button" onClick={() => onTriggerDisperse()} className="w-full mt-1 py-1.5 rounded bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-mono text-[9.5px] uppercase font-bold tracking-wider border border-pink-500/20 transition-all flex items-center justify-center gap-1.5">
                  <Boxes className="w-3 h-3" />
                  <span>Trigger Velocity Disperse</span>
                </button>
              </div>
            )}
          </div>

          {/* Pointer interaction (cursor only — pins live in Entities) */}
          <div>
            <button type="button" onClick={() => toggleSection('interaction')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-cyan-400">
                <MousePointer className="w-3 h-3" />
                <span>Pointer Interaction</span>
              </div>
              {openSections.interaction ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.interaction && (
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70">Cursor Mode</span>
                  <div className="flex items-center gap-1">
                    {(['repel', 'attract', 'vortex'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onChange({ interaction: { ...config.interaction, mode: m } })}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.interaction.mode === m ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'border-inherit opacity-60'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <RegistryRow path="interaction.radius" config={config} onChange={onChange} />
                <RegistryRow path="interaction.strength" config={config} onChange={onChange} />
                <RegistryRow path="interaction.velocityInfluence" config={config} onChange={onChange} />
                <RegistryRow path="interaction.falloffPower" config={config} onChange={onChange} />
                <p className="text-[8.5px] font-mono opacity-50 pt-1">Placed 3D pins now live under the Entities scope below.</p>
              </div>
            )}
          </div>

          {/* Relational */}
          <div>
            <button type="button" onClick={() => toggleSection('relational')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Orbit className="w-3 h-3" />
                <span>Relational Attractors</span>
              </div>
              {openSections.relational ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.relational && (
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] font-mono uppercase opacity-70">Field Active</span>
                  <button
                    type="button"
                    onClick={() => onChange({ relational: { ...config.relational, enabled: !config.relational?.enabled } })}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.relational?.enabled ? 'bg-amber-400 text-black border-amber-400' : 'border-inherit opacity-60'}`}
                  >
                    {config.relational?.enabled ? 'Active' : 'Off'}
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono uppercase opacity-70">Physics</span>
                  <div className="flex items-center gap-1">
                    {(['orbital', 'chaos', 'nbody'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onChange({ relational: { ...config.relational, enabled: config.relational?.enabled ?? false, mode: m } })}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${(config.relational?.mode ?? 'orbital') === m ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'border-inherit opacity-60'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <ParamRow label="Attractor Count" value={config.relational?.attractorCount ?? 3} onChange={(val) => onChange({ relational: { ...config.relational, attractorCount: Math.round(val) } })} min={1} max={10} hardMin={1} hardMax={10} step={1} decimals={0} />
                <ParamRow label="Gravity Pull" value={config.relational?.attractorGravity ?? 1.6} onChange={(val) => onChange({ relational: { ...config.relational, attractorGravity: val } })} min={-50.0} max={50.0} hardMin={-1000.0} hardMax={1000.0} step={0.1} />
                <ParamRow label="Orbit Speed" value={config.relational?.orbitSpeed ?? 1.2} onChange={(val) => onChange({ relational: { ...config.relational, orbitSpeed: val } })} min={-20.0} max={20.0} hardMin={-200.0} hardMax={200.0} step={0.05} />
                <ParamRow label="Orbit Radius" value={config.relational?.orbitRadius ?? 220} onChange={(val) => onChange({ relational: { ...config.relational, orbitRadius: val } })} min={0} max={2000} hardMin={0} hardMax={20000} step={5} decimals={0} unit="px" />
                <ParamRow label="Relational Spin" value={config.relational?.relationalSpin ?? 1.2} onChange={(val) => onChange({ relational: { ...config.relational, relationalSpin: val } })} min={-30.0} max={30.0} hardMin={-500.0} hardMax={500.0} step={0.1} />
                <ParamRow label="Chaos Factor" value={config.relational?.chaosFactor ?? 0.0} onChange={(val) => onChange({ relational: { ...config.relational, chaosFactor: val } })} min={0.0} max={30.0} hardMin={0.0} hardMax={500.0} step={0.1} />
                <ParamRow label="Wander Speed" value={config.relational?.wanderSpeed ?? 0.5} onChange={(val) => onChange({ relational: { ...config.relational, wanderSpeed: val } })} min={0.0} max={10.0} hardMin={-100.0} hardMax={100.0} step={0.05} />
                <RegistryRow path="relational.gravitySoftening" config={config} onChange={onChange} />
                <RegistryRow path="relational.gravityFalloff" config={config} onChange={onChange} />
                <RegistryRow path="relational.swirlRadius" config={config} onChange={onChange} />
              </div>
            )}
          </div>

          {/* Pairwise */}
          <div>
            <button type="button" onClick={() => toggleSection('pairwise')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-lime-400">
                <Orbit className="w-3 h-3" />
                <span>Pairwise Collisions</span>
              </div>
              {openSections.pairwise ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.pairwise && (
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] font-mono uppercase opacity-70">Collisions Active</span>
                  <button
                    type="button"
                    onClick={() => onChange({ pairwise: { ...config.pairwise, enabled: !config.pairwise?.enabled } })}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${config.pairwise?.enabled ? 'bg-lime-400 text-black border-lime-400' : 'border-inherit opacity-60'}`}
                  >
                    {config.pairwise?.enabled ? 'Active' : 'Off'}
                  </button>
                </div>
                {PARAM_REGISTRY.filter((p) => p.group === 'Pairwise').map((p) => (
                  <RegistryRow key={p.path} path={p.path} config={config} onChange={onChange} />
                ))}
              </div>
            )}
          </div>

          {/* Automation */}
          <div>
            <button type="button" onClick={() => toggleSection('automation')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-cyan-400">
                <RefreshCw className="w-3 h-3" />
                <span>Automation · LFO & Keyframes</span>
                {(config.automations?.filter((l) => l.enabled).length ?? 0) > 0 && (
                  <span className="px-1 rounded bg-cyan-500/20 text-cyan-400 text-[8px]">{config.automations!.filter((l) => l.enabled).length} live</span>
                )}
              </div>
              {openSections.automation ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.automation && (
              <div className="p-3">
                <AutomationPanel config={config} onChange={onChange} live={automationLive} onFire={onFireAutomation} entityDefs={selectedEntityDefs} isLight={isLight} />
              </div>
            )}
          </div>

          {/* Profiles & snapshots */}
          <div>
            <button type="button" onClick={() => toggleSection('profiles')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-yellow-400">
                <Save className="w-3 h-3" />
                <span>Profiles & Presets</span>
              </div>
              {openSections.profiles ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.profiles && (
              <div className="p-3 space-y-2.5">
                <div className="flex items-center p-0.5 rounded bg-black/10 dark:bg-white/5 border border-inherit text-[9px] font-mono uppercase font-bold">
                  <button type="button" onClick={() => setProfileTab('snapshots')} className={`flex-1 py-1 rounded transition-all text-center ${profileTab === 'snapshots' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm border border-cyan-500/30' : 'opacity-60 hover:opacity-100'}`}>
                    Snapshots
                  </button>
                  <button type="button" onClick={() => setProfileTab('theme')} className={`flex-1 py-1 rounded transition-all text-center ${profileTab === 'theme' ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30' : 'opacity-60 hover:opacity-100'}`}>
                    Theme / Colour
                  </button>
                  <button type="button" onClick={() => setProfileTab('material')} className={`flex-1 py-1 rounded transition-all text-center ${profileTab === 'material' ? 'bg-pink-500/20 text-pink-400 shadow-sm border border-pink-500/30' : 'opacity-60 hover:opacity-100'}`}>
                    Material
                  </button>
                </div>

                {profileTab === 'theme' && (
                  <div className="space-y-2">
                    <form onSubmit={handleSaveTheme} className="flex items-center gap-1">
                      <input type="text" placeholder="Theme Name..." value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} className={`flex-1 px-2 py-1 rounded border outline-none text-[9.5px] font-mono ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`} />
                      <button type="submit" className="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/40 uppercase font-mono font-bold text-[9px] transition-colors">
                        Save
                      </button>
                    </form>
                    <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {themeProfiles.map((tp) => (
                        <div key={tp.id} className="p-1.5 rounded border border-inherit flex items-center justify-between gap-1.5 bg-stone-500/5 hover:bg-stone-500/10 transition-colors">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex items-center -space-x-1 shrink-0">
                              <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: tp.backgroundColor }} title="Background" />
                              <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: tp.color.primaryColor }} title="Primary" />
                              <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: tp.color.secondaryColor }} title="Secondary" />
                              <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: tp.color.accentColor }} title="Accent" />
                            </div>
                            <span className="font-mono text-[9.5px] truncate">{tp.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => handleApplyTheme(tp)} className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-mono font-bold text-[8.5px] uppercase">
                              Apply
                            </button>
                            {!DEFAULT_THEME_PROFILES.some((d) => d.id === tp.id) && (
                              <button type="button" onClick={() => handleDeleteTheme(tp.id)} className="p-0.5 rounded text-red-400 opacity-60 hover:opacity-100">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileTab === 'material' && (
                  <div className="space-y-2">
                    <form onSubmit={handleSaveMaterial} className="flex items-center gap-1">
                      <input type="text" placeholder="Material Name..." value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} className={`flex-1 px-2 py-1 rounded border outline-none text-[9.5px] font-mono ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`} />
                      <button type="submit" className="px-2.5 py-1 rounded bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/40 uppercase font-mono font-bold text-[9px] transition-colors">
                        Save
                      </button>
                    </form>
                    <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {materialProfiles.map((mp) => (
                        <div key={mp.id} className="p-1.5 rounded border border-inherit flex items-center justify-between gap-1.5 bg-stone-500/5 hover:bg-stone-500/10 transition-colors">
                          <div className="min-w-0">
                            <span className="font-mono text-[9.5px] block truncate font-semibold">{mp.name}</span>
                            <div className="flex items-center gap-1 text-[8px] font-mono opacity-60">
                              <span>{mp.style}</span>
                              <span>•</span>
                              <span>{mp.dotShape}</span>
                              <span>•</span>
                              <span>{(mp.particleCount / 1000).toFixed(0)}k</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => handleApplyMaterial(mp)} className="px-2 py-0.5 rounded bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 font-mono font-bold text-[8.5px] uppercase">
                              Apply
                            </button>
                            {!DEFAULT_MATERIAL_PROFILES.some((d) => d.id === mp.id) && (
                              <button type="button" onClick={() => handleDeleteMaterial(mp.id)} className="p-0.5 rounded text-red-400 opacity-60 hover:opacity-100">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileTab === 'snapshots' && (
                  <div className="space-y-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onSaveState(newSnapshotName);
                        setNewSnapshotName('');
                      }}
                      className="flex items-center gap-1"
                    >
                      <input type="text" placeholder="Snapshot Name..." value={newSnapshotName} onChange={(e) => setNewSnapshotName(e.target.value)} className={`flex-1 px-2 py-1 rounded border outline-none text-[9.5px] font-mono ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`} />
                      <button type="submit" className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 uppercase font-mono font-bold text-[9px] transition-colors">
                        Save
                      </button>
                    </form>
                    <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {savedStates.length === 0 && (
                        <div className="p-2 rounded border border-dashed border-inherit text-center opacity-50 text-[9.5px] font-mono">
                          No snapshots yet. Save the full scene (all systems, entities and camera) above.
                        </div>
                      )}
                      {savedStates.map((st) => (
                        <div key={st.id} className={`p-1.5 rounded border flex items-center justify-between gap-1 bg-stone-500/5 hover:bg-stone-500/10 transition-colors ${activeSnapshotId === st.id ? 'border-cyan-500/50' : 'border-inherit'}`}>
                          <div className="min-w-0">
                            <span className={`font-mono text-[9.5px] block truncate font-semibold ${activeSnapshotId === st.id ? 'text-cyan-400' : ''}`}>{st.name}</span>
                            <span className="text-[8px] font-mono opacity-45 block">
                              {new Date(st.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {st.view?.camera ? ' · cam' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => onLoadState(st)} className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[8.5px] uppercase">
                              Load
                            </button>
                            <button type="button" onClick={() => onExportStateJson(st)} title="Copy JSON" className="p-0.5 rounded hover:bg-stone-500/20 opacity-70 hover:opacity-100">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button type="button" onClick={() => onDeleteState(st.id, st.name)} title="Delete" className="p-0.5 rounded text-red-400 opacity-60 hover:opacity-100">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={onOpenImportJsonModal} className="w-full py-1.5 rounded bg-stone-500/10 hover:bg-stone-500/20 text-[9px] font-mono uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                      <Upload className="w-2.5 h-2.5" />
                      <span>Import Snapshot JSON</span>
                    </button>
                    {onImportLibraryFile && (
                      <label className="w-full py-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[9px] font-mono uppercase font-bold tracking-wider flex items-center justify-center gap-1 cursor-pointer">
                        <Upload className="w-2.5 h-2.5" />
                        <span>Import Snapshot Library File (.json)</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onImportLibraryFile(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* SCOPE B — ENTITIES */}
        {/* ============================================================ */}
        <ScopeBand label="Entities" hint="formations & pins — shape, sequence, forces, colour" tone="bg-emerald-500/10 text-emerald-400" />
        <div className="divide-y divide-inherit">
          <div>
            <button type="button" onClick={() => toggleSection('entities')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Layers className="w-3 h-3" />
                <span>Entity List ({entities.length})</span>
              </div>
              {openSections.entities ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.entities && (
              <div className="p-3">
                <EntitiesPanel
                  entities={entities}
                  selectedEntityId={selectedEntityId}
                  onSelect={onSelectEntity}
                  onAdd={onAddEntity}
                  onRemove={onRemoveEntity}
                  onDuplicate={onDuplicateEntity}
                  onMove={onMoveEntity}
                  onUpdate={onUpdateEntity}
                  telemetry={compositionTelemetry ?? null}
                  isPlacementMode={isPlacementMode}
                  placementTarget={placementTarget}
                  onStartPlaceNewPin={onStartPlaceNewPin}
                  onStartPlaceSelected={onStartPlaceSelected}
                  isLight={isLight}
                />
              </div>
            )}
          </div>

          <div>
            <button type="button" onClick={() => toggleSection('entityEditor')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-3 h-3" />
                <span>Selected Entity{selectedEntity ? ` · ${selectedEntity.name}` : ''}</span>
              </div>
              {openSections.entityEditor ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.entityEditor && (
              <div className="p-3">
                {selectedEntity ? (
                  <EntityEditor entity={selectedEntity} onUpdate={(patch) => onUpdateEntity(selectedEntity.id, patch)} telemetry={compositionTelemetry ?? null} isLight={isLight} />
                ) : (
                  <div className="p-2 rounded border border-dashed border-inherit text-center opacity-50 text-[9.5px] font-mono">
                    Select or add an entity above to edit it.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* SCOPE C — COMPOSITION */}
        {/* ============================================================ */}
        <ScopeBand label="Composition" hint="how entities share the field: plane, orchestration, tints" tone="bg-amber-500/10 text-amber-400" />
        <div className="divide-y divide-inherit">
          <div>
            <button type="button" onClick={() => toggleSection('composition')} className={accordionBtn}>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Radio className="w-3 h-3" />
                <span>Composition</span>
              </div>
              {openSections.composition ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {openSections.composition && (
              <div className="p-3">
                <CompositionPanel config={config} onChange={onChange} entities={entities} onSetEntities={onSetEntities} onApplyPreset={onApplyCompositionPreset} telemetry={compositionTelemetry ?? null} isLight={isLight} />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
