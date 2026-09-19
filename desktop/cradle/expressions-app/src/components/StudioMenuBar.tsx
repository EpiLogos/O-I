/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Flame,
  Orbit,
  Sun,
  Moon,
  Circle,
  Square,
  EyeOff,
  Download,
  Upload,
  Camera,
  RotateCcw,
  ChevronDown,
  Pin,
  PinOff,
  Image as ImageIcon,
  Terminal,
  Radio,
  Grip,
  Grid2x2,
  Grid3x3,
  Axis3d,
  Bookmark,
  Check,
  Hand,
  Trash2,
  Layers,
} from 'lucide-react';
import { PointCloudConfig } from '../engine/types';
import { SpatialGridMode } from '../engine/PointCloudField';
import { SavedSnapshot } from '../engine/configMigration';
import { COMPOSITION_PRESETS } from '../engine/fieldModel';

export type FieldToggleKey = 'morph' | 'cymatics' | 'relational';

export interface StudioMenuBarProps {
  config: PointCloudConfig;
  isLight: boolean;
  onToggleTheme: () => void;
  onToggleStyle: () => void;
  onToggleDotShape: () => void;
  onTriggerDisperse: () => void;
  onOpenImageModal: () => void;
  onOpenAsciiModal: () => void;
  onOpenImportJsonModal: () => void;
  onExportJson: () => void;
  onTakeSnapshot: () => void;
  onResetScene: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
  onToggleZenMode: () => void;
  isZenMode: boolean;
  presets: Array<{ id: string; name: string; description: string }>;
  activePresetId?: string | null;
  onSelectPreset: (id: string) => void;
  savedStates: SavedSnapshot[];
  activeSnapshotId?: string | null;
  onLoadState: (state: SavedSnapshot) => void;
  onDeleteState?: (id: string, name: string) => void;
  onApplyPreset: (id: string) => void;
  onToggleField: (key: FieldToggleKey) => void;
  gridMode: SpatialGridMode;
  onCycleGridMode: () => void;
  isPanMode: boolean;
  onTogglePanMode: () => void;
  onImportLibraryFile?: (file: File) => void;
}

export const StudioMenuBar: React.FC<StudioMenuBarProps> = ({
  config,
  isLight,
  onToggleTheme,
  onToggleStyle,
  onToggleDotShape,
  onTriggerDisperse,
  onOpenImageModal,
  onOpenAsciiModal,
  onOpenImportJsonModal,
  onExportJson,
  onTakeSnapshot,
  onResetScene,
  onToggleInspector,
  isInspectorOpen,
  onToggleZenMode,
  isZenMode,
  presets,
  activePresetId,
  onSelectPreset,
  savedStates,
  activeSnapshotId,
  onLoadState,
  onDeleteState,
  onApplyPreset,
  onToggleField,
  gridMode,
  onCycleGridMode,
  isPanMode,
  onTogglePanMode,
  onImportLibraryFile,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'file' | 'setup' | 'presets' | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#studio-menubar')) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  // Setup trigger: shows the composition layout name (or 'Custom') + which field toggles are live
  const morphOn = !!config.toroidalMorph?.enabled;
  const cymaticsOn = !!config.cymatics?.enabled;
  const relationalOn = !!config.relational?.enabled;
  const layoutLabel = config.composition?.layoutName || 'Custom';
  const isBarVisible = isPinned || isHovered || activeMenu !== null;

  if (isZenMode) return null;

  const menuPanel = `absolute top-full left-0 mt-1 rounded-lg border shadow-2xl py-1 backdrop-blur-2xl flex flex-col z-50 ${
    isLight ? 'bg-white/98 border-stone-200 text-stone-900' : 'bg-zinc-900/98 border-zinc-800 text-zinc-200'
  }`;
  const menuItem = 'w-full text-left px-3 py-1.5 hover:bg-stone-500/10 flex items-center gap-2';
  const iconBtn = 'p-1.5 rounded border transition-all';
  const iconIdle = 'border-inherit opacity-75 hover:opacity-100 hover:bg-stone-500/10';

  const toggleItem = (key: FieldToggleKey, label: string, hint: string, icon: React.ReactNode, active: boolean) => (
    <button
      type="button"
      onClick={() => onToggleField(key)}
      className={`${menuItem} justify-between ${active ? 'bg-stone-500/10' : ''}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className="flex items-center gap-1.5 opacity-50 text-[9px]">
        {hint}
        {active && <Check className="w-2.5 h-2.5 text-cyan-400" />}
      </span>
    </button>
  );

  return (
    <div
      id="studio-menubar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveMenu(null);
      }}
      className="fixed top-0 inset-x-0 z-50 pointer-events-auto"
    >
      <div className="h-1.5 w-full bg-transparent hover:bg-cyan-500/30 transition-colors cursor-pointer" />

      <div
        className={`w-full px-3 py-1 text-[11px] font-mono border-b backdrop-blur-2xl transition-all duration-300 flex items-center justify-between shadow-lg select-none ${
          isBarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        } ${isLight ? 'bg-white/95 border-stone-200 text-stone-800 shadow-stone-300/30' : 'bg-zinc-950/95 border-zinc-800/90 text-zinc-300 shadow-black/70'}`}
      >
        {/* Left: brand + menus */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 pr-2 border-r border-inherit">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" />
            <span className="font-bold tracking-widest text-[10.5px] uppercase text-cyan-400">AEON</span>
          </div>

          {/* FILE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium ${
                activeMenu === 'file' ? (isLight ? 'bg-stone-200 text-black' : 'bg-zinc-800 text-white') : 'hover:bg-stone-500/10'
              }`}
            >
              <span>File</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
            {activeMenu === 'file' && (
              <div className={`${menuPanel} w-56`}>
                <button type="button" onClick={() => { onOpenImageModal(); setActiveMenu(null); }} className={menuItem}>
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Import Image to Glyph…</span>
                </button>
                <button type="button" onClick={() => { onOpenAsciiModal(); setActiveMenu(null); }} className={menuItem}>
                  <Terminal className="w-3.5 h-3.5 text-purple-500" />
                  <span>Import ASCII Art…</span>
                </button>
                <div className="border-t border-inherit my-1" />
                <button type="button" onClick={() => { onOpenImportJsonModal(); setActiveMenu(null); }} className={menuItem}>
                  <Upload className="w-3.5 h-3.5 opacity-70" />
                  <span>Load Configuration JSON…</span>
                </button>
                {onImportLibraryFile && (
                  <label className={`${menuItem} cursor-pointer`}>
                    <Upload className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Import Snapshot Library (.json)…</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImportLibraryFile(f);
                        e.target.value = '';
                        setActiveMenu(null);
                      }}
                    />
                  </label>
                )}
                <button type="button" onClick={() => { onExportJson(); setActiveMenu(null); }} className={menuItem}>
                  <Download className="w-3.5 h-3.5 opacity-70" />
                  <span>Export State JSON (Copy)</span>
                </button>
                <button type="button" onClick={() => { onTakeSnapshot(); setActiveMenu(null); }} className={menuItem}>
                  <Camera className="w-3.5 h-3.5 opacity-70" />
                  <span>Save High-Res PNG</span>
                </button>
                <div className="border-t border-inherit my-1" />
                <button type="button" onClick={() => { onResetScene(); setActiveMenu(null); }} className={`${menuItem} text-amber-500`}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Scene Defaults</span>
                </button>
              </div>
            )}
          </div>

          {/* SETUP: composition presets + independent field toggles (trigger shows live layout + which fields are on) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'setup' ? null : 'setup')}
              title="Setup: composition presets and field toggles"
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1.5 font-medium border border-transparent ${
                activeMenu === 'setup'
                  ? isLight ? 'bg-stone-200 text-black border-stone-300' : 'bg-zinc-800 text-white border-zinc-700'
                  : 'hover:bg-stone-500/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>{layoutLabel}</span>
              <span className="flex items-center gap-0.5">
                {morphOn && <Orbit className="w-3 h-3 text-cyan-400" />}
                {cymaticsOn && <Flame className="w-3 h-3 text-emerald-400" />}
                {relationalOn && <Radio className="w-3 h-3 text-amber-400" />}
              </span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
            {activeMenu === 'setup' && (
              <div className={`${menuPanel} w-72 max-h-[70vh]`}>
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider opacity-40 font-semibold border-b border-inherit">Composition presets</div>
                <div className="overflow-y-auto custom-scrollbar max-h-[34vh]">
                  {COMPOSITION_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onApplyPreset(p.id); setActiveMenu(null); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-stone-500/10 flex flex-col transition-colors ${
                        layoutLabel === p.name ? 'bg-purple-500/10 font-semibold text-purple-400' : ''
                      }`}
                    >
                      <span className="text-[11px] truncate">{p.name}</span>
                      <span className="text-[9px] opacity-50 truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-inherit my-1" />
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider opacity-40 font-semibold">Field toggles</div>
                {toggleItem('morph', 'Morph Manifold', 'dual-phase', <Orbit className="w-3.5 h-3.5 text-cyan-400" />, morphOn)}
                {toggleItem('cymatics', 'Cymatic Medium', 'resonator', <Flame className="w-3.5 h-3.5 text-emerald-400" />, cymaticsOn)}
                {toggleItem('relational', 'Relational Field', 'N-body', <Radio className="w-3.5 h-3.5 text-amber-400" />, relationalOn)}
              </div>
            )}
          </div>

          {/* PRESETS: user snapshots first, factory profiles pinned underneath */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'presets' ? null : 'presets')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium ${
                activeMenu === 'presets' ? (isLight ? 'bg-stone-200 text-black' : 'bg-zinc-800 text-white') : 'hover:bg-stone-500/10'
              }`}
            >
              <Bookmark className="w-3 h-3 text-cyan-400" />
              <span>Presets</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
            {activeMenu === 'presets' && (
              <div className={`${menuPanel} w-72 max-h-[70vh]`}>
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-cyan-400 font-bold border-b border-inherit bg-stone-500/5">
                  Saved snapshots ({savedStates.length})
                </div>
                <div className="overflow-y-auto custom-scrollbar max-h-[34vh]">
                  {savedStates.length > 0 ? (
                    savedStates.map((st) => (
                      <div
                        key={st.id}
                        className={`w-full px-3 py-1.5 hover:bg-stone-500/10 flex items-center justify-between transition-colors group ${
                          activeSnapshotId === st.id ? 'bg-cyan-500/10' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => { onLoadState(st); setActiveMenu(null); }}
                          className="min-w-0 flex-1 text-left pr-2"
                        >
                          <span className={`text-[11px] font-medium block truncate group-hover:text-cyan-400 ${activeSnapshotId === st.id ? 'text-cyan-400' : ''}`}>
                            {st.name}
                          </span>
                          <span className="text-[8.5px] opacity-40 block">
                            {new Date(st.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </button>
                        {activeSnapshotId === st.id && <Check className="w-2.5 h-2.5 text-cyan-400 mr-1" />}
                        {onDeleteState && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteState(st.id, st.name); }}
                            title="Delete snapshot"
                            className="p-1 rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[9.5px] opacity-40 italic">No snapshots yet — Inspector ▸ Profiles ▸ Snapshots.</div>
                  )}
                </div>

                <div className="px-3 py-1 text-[9px] uppercase tracking-wider opacity-40 font-semibold border-y border-inherit bg-stone-500/5">Factory profiles</div>
                <div className="overflow-y-auto custom-scrollbar max-h-[30vh]">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onSelectPreset(p.id); setActiveMenu(null); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-stone-500/10 flex flex-col transition-colors ${
                        activePresetId === p.id ? 'bg-cyan-500/15 font-semibold text-cyan-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] truncate">{p.name}</span>
                        {activePresetId === p.id && <Check className="w-2.5 h-2.5 text-cyan-400" />}
                      </div>
                      <span className="text-[9px] opacity-50 truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: icon strip */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={onTriggerDisperse} title="Disperse impulse (Space)" className={`${iconBtn} border-inherit hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-400`}>
            <Flame className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleStyle}
            title={`Render style: ${config.style === 'halftone' ? 'Halftone matrix' : 'Organic stipple'} (click to switch)`}
            className={`${iconBtn} ${iconIdle}`}
          >
            {config.style === 'halftone' ? <Grid2x2 className="w-3.5 h-3.5" /> : <Grip className="w-3.5 h-3.5" />}
          </button>

          <button type="button" onClick={onToggleDotShape} title={`Particle shape: ${config.dotShape || 'circle'}`} className={`${iconBtn} ${iconIdle}`}>
            {config.dotShape === 'square' ? <Square className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          </button>

          <span className="w-px h-4 bg-current opacity-15 mx-0.5" />

          <button
            type="button"
            onClick={onCycleGridMode}
            title={`Spatial scaffold: ${gridMode === 'off' ? 'off' : gridMode === 'axis' ? 'subtle axis' : 'full 3D grid'} (G cycles)`}
            className={`${iconBtn} ${gridMode !== 'off' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/60 shadow-sm' : iconIdle}`}
          >
            {gridMode === 'grid' ? <Grid3x3 className="w-3.5 h-3.5" /> : <Axis3d className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onTogglePanMode}
            title={isPanMode ? 'Pan mode ON: left-drag pans the camera (P)' : 'Pan mode OFF: left-drag stirs the fluid (P)'}
            className={`${iconBtn} ${isPanMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/60 shadow-sm' : iconIdle}`}
          >
            <Hand className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-current opacity-15 mx-0.5" />

          <button type="button" onClick={onToggleTheme} title="Toggle light / dark" className={`${iconBtn} ${iconIdle}`}>
            {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            title="Inspector (Tab / I)"
            className={`${iconBtn} ${
              isInspectorOpen
                ? isLight ? 'bg-stone-900 text-white border-stone-900 shadow-sm' : 'bg-white text-zinc-950 border-white shadow-sm'
                : iconIdle
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${isInspectorOpen ? '' : 'text-cyan-400'}`} />
          </button>

          <button type="button" onClick={onToggleZenMode} title="Hide UI (H)" className={`${iconBtn} border-inherit opacity-60 hover:opacity-100 hover:bg-stone-500/10`}>
            <EyeOff className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin menu bar (auto-hide)' : 'Pin menu bar'}
            className={`p-1.5 rounded transition-colors ${isPinned ? 'text-cyan-400' : 'opacity-40 hover:opacity-100'}`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
