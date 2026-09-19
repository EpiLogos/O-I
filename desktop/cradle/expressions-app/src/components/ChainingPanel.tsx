/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  RotateCcw,
  Plus,
  Trash2,
  Zap,
  Link2,
  Sparkles,
  Layers,
  ArrowRight,
  Sliders,
  Compass,
} from 'lucide-react';
import {
  PointCloudConfig,
  PointCloudChainingConfig,
  ChainTimelineState,
  ChainTraversalMode,
  ChainEasing,
} from '../engine/types';
import {
  GLYPH_CATEGORIES,
  CHAIN_PRESETS,
  ChainPreset,
  GlyphItem,
} from '../engine/glyphLibrary';
import { EditableNumber } from './EditableNumber';

interface ChainingPanelProps {
  config: PointCloudConfig;
  setConfig: React.Dispatch<React.SetStateAction<PointCloudConfig>>;
  timelineState: ChainTimelineState | null;
  onJumpToLink: (index: number) => void;
  onStepChain: (direction: 1 | -1) => void;
  onTogglePause: () => void;
  onScrubProgress: (progress: number) => void;
  onTriggerDisperse: (strength?: number) => void;
  isLight: boolean;
}

export const ChainingPanel: React.FC<ChainingPanelProps> = ({
  config,
  setConfig,
  timelineState,
  onJumpToLink,
  onStepChain,
  onTogglePause,
  onScrubProgress,
  onTriggerDisperse,
  isLight,
}) => {
  const chaining = config.chaining || {
    enabled: false,
    chain: ['▲', '■', '⬟', '⬢', '⯎', '◉'],
    mode: 'loop',
    stepHoldDuration: 1.0,
    transitionDuration: 2.2,
    easing: 'smoothstep',
    timingJitter: 0.15,
    disperseImpulse: 0.8,
    paused: false,
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('polygons');
  const [customInputText, setCustomInputText] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'speed' | 'library' | 'presets'>('timeline');

  const updateChaining = (updates: Partial<PointCloudChainingConfig>) => {
    setConfig((prev) => ({
      ...prev,
      chaining: {
        ...(prev.chaining || chaining),
        ...updates,
      },
    }));
  };

  const toggleChainingEnabled = () => {
    updateChaining({ enabled: !chaining.enabled });
  };

  const handleAddGlyph = (char: string) => {
    if (!char || !char.trim()) return;
    const nextChain = [...chaining.chain, char.trim()];
    updateChaining({ chain: nextChain });
  };

  const handleRemoveGlyph = (indexToRemove: number) => {
    if (chaining.chain.length <= 2) return;
    const nextChain = chaining.chain.filter((_, idx) => idx !== indexToRemove);
    updateChaining({ chain: nextChain });
  };

  const handleShuffleChain = () => {
    const shuffled = [...chaining.chain].sort(() => Math.random() - 0.5);
    updateChaining({ chain: shuffled });
  };

  const handleInvertChain = () => {
    const inverted = [...chaining.chain].reverse();
    updateChaining({ chain: inverted });
  };

  const handleChaosPick = () => {
    const allItems: GlyphItem[] = GLYPH_CATEGORIES.flatMap((c) => c.items);
    const randomPick: string[] = [];
    for (let i = 0; i < 6; i++) {
      const item = allItems[Math.floor(Math.random() * allItems.length)];
      if (item && !randomPick.includes(item.char)) {
        randomPick.push(item.char);
      }
    }
    if (randomPick.length >= 2) {
      updateChaining({ chain: randomPick });
    }
  };

  const handleApplyPreset = (preset: ChainPreset) => {
    updateChaining({
      enabled: true,
      chain: [...preset.chain],
      stepHoldDuration: preset.recommendedHold ?? chaining.stepHoldDuration,
      transitionDuration: preset.recommendedTransition ?? chaining.transitionDuration,
      easing: preset.recommendedEasing ?? chaining.easing,
    });
  };

  const currentIdx = timelineState ? timelineState.currentIndex : 0;
  const nextIdx = timelineState ? timelineState.nextIndex : 1;
  const phase = timelineState ? timelineState.phase : 'hold';
  const progress = timelineState ? timelineState.progress : 0;

  return (
    <div className="flex flex-col gap-2 p-2.5 font-mono text-xs">
      {/* 1. Master Chaining Mode Toggle & Quick Timeline Status */}
      <div
        className={`p-2 rounded-lg border flex items-center justify-between transition-colors ${
          chaining.enabled
            ? isLight
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
            : isLight
            ? 'bg-stone-50 border-stone-200 text-stone-600'
            : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              chaining.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
            }`}
          />
          <div>
            <div className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span>Chaining Mode</span>
              {chaining.enabled && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-bold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-[10px] opacity-75">
              {chaining.enabled
                ? `${chaining.chain.length} links · ${chaining.mode.toUpperCase()} · ${phase.toUpperCase()}`
                : 'Disabled · 1:1 binary morph active'}
            </div>
          </div>
        </div>

        <button
          id="toggle-chaining-mode-btn"
          onClick={toggleChainingEnabled}
          className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all border shadow-xs ${
            chaining.enabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
              : isLight
              ? 'bg-stone-900 text-white hover:bg-black border-stone-900'
              : 'bg-zinc-100 text-zinc-950 hover:bg-white border-zinc-100'
          }`}
        >
          {chaining.enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-1.5 border-stone-200 dark:border-zinc-800 text-[10px]">
        {[
          { id: 'timeline', label: 'Sequence', icon: Layers },
          { id: 'speed', label: 'Dynamics', icon: Sliders },
          { id: 'library', label: 'Glyph Library', icon: Sparkles },
          { id: 'presets', label: 'Presets', icon: Link2 },
        ].map((subTab) => {
          const Icon = subTab.icon;
          const isActive = activeSubTab === subTab.id;
          return (
            <button
              key={subTab.id}
              id={`chaining-subtab-${subTab.id}`}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all whitespace-nowrap ${
                isActive
                  ? isLight
                    ? 'bg-stone-800 text-white font-semibold'
                    : 'bg-zinc-200 text-zinc-900 font-semibold'
                  : isLight
                  ? 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Icon className="w-2.5 h-2.5" />
              <span>{subTab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-VIEW 1: TIMELINE & SEQUENCE RIBBON */}
      {activeSubTab === 'timeline' && (
        <div className="flex flex-col gap-2">
          {/* Live Dynamic Status Bar */}
          <div
            className={`p-2 rounded-lg border text-[10px] flex flex-col gap-1.5 ${
              isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-950/50 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center gap-1.5">
                <span className="opacity-60">LINK #{currentIdx + 1}:</span>
                <span className="font-bold text-sm px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                  {chaining.chain[currentIdx] || '?'}
                </span>
                <ArrowRight className="w-3 h-3 opacity-40" />
                <span className="font-bold text-sm px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                  {chaining.chain[nextIdx] || '?'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    phase === 'transition' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                <span>{phase === 'hold' ? 'Holding' : 'Morphing'}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
            </div>

            {/* Interpolation Progress Bar */}
            <div className="w-full bg-stone-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>

          {/* Interactive Chain Nodes Ribbon */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-zinc-400">
              <span>CHAIN SEQUENCE ({chaining.chain.length} GLYPHS)</span>
              <span>CLICK TO JUMP</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
              {chaining.chain.map((glyph, index) => {
                const isCurrent = index === currentIdx;
                const isNext = index === nextIdx;

                return (
                  <div
                    key={`${glyph}-${index}`}
                    className={`group relative flex-shrink-0 flex flex-col items-center justify-center min-w-[42px] h-[48px] rounded-lg border transition-all cursor-pointer select-none ${
                      isCurrent
                        ? isLight
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                          : 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105'
                        : isNext
                        ? isLight
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-amber-950/40 text-amber-200 border-amber-800'
                        : isLight
                        ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                    }`}
                    onClick={() => onJumpToLink(index)}
                    title={`Jump to link #${index + 1}: ${glyph}`}
                  >
                    <span className="text-[8px] opacity-70 font-mono">#{index + 1}</span>
                    <span className="text-base font-bold leading-tight">{glyph}</span>

                    {/* Delete Link Button on Hover */}
                    {chaining.chain.length > 2 && (
                      <button
                        id={`delete-link-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveGlyph(index);
                        }}
                        title="Remove link from chain"
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Playback & Manual Stepping Toolbar */}
          <div className="flex items-center justify-between gap-1 pt-1">
            <div className="flex items-center gap-1">
              <button
                id="chain-step-prev-btn"
                onClick={() => onStepChain(-1)}
                className={`p-1.5 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                  isLight
                    ? 'border-stone-200 text-stone-700 hover:bg-stone-100'
                    : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Previous link"
              >
                <SkipBack className="w-3 h-3" />
              </button>

              <button
                id="chain-toggle-pause-btn"
                onClick={onTogglePause}
                className={`p-1.5 px-2.5 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all ${
                  chaining.paused
                    ? isLight
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-600 text-white border-emerald-500'
                    : isLight
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-zinc-100 text-zinc-950 border-zinc-100'
                }`}
                title={chaining.paused ? 'Resume Chain' : 'Pause Chain'}
              >
                {chaining.paused ? (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              <button
                id="chain-step-next-btn"
                onClick={() => onStepChain(1)}
                className={`p-1.5 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                  isLight
                    ? 'border-stone-200 text-stone-700 hover:bg-stone-100'
                    : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Next link"
              >
                <SkipForward className="w-3 h-3" />
              </button>

              <button
                id="chain-disperse-kick-btn"
                onClick={() => onTriggerDisperse(chaining.disperseImpulse || 1.2)}
                className={`p-1.5 px-2 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                  isLight
                    ? 'border-stone-200 text-amber-600 hover:bg-amber-50'
                    : 'border-zinc-800 text-amber-400 hover:bg-amber-950/30'
                }`}
                title="Trigger Fluid Shockwave Disperse Kick"
              >
                <Zap className="w-3 h-3" />
                <span>Kick</span>
              </button>
            </div>

            {/* Quick Sequence Mutation Buttons */}
            <div className="flex items-center gap-1">
              <button
                id="chain-shuffle-order-btn"
                onClick={handleShuffleChain}
                className={`p-1.5 px-2 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                  isLight
                    ? 'border-stone-200 text-stone-700 hover:bg-stone-100'
                    : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Shuffle Link Order"
              >
                <Shuffle className="w-2.5 h-2.5" />
                <span>Shuffle</span>
              </button>

              <button
                id="chain-invert-order-btn"
                onClick={handleInvertChain}
                className={`p-1.5 px-2 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                  isLight
                    ? 'border-stone-200 text-stone-700 hover:bg-stone-100'
                    : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Invert / Reverse Chain"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Invert</span>
              </button>
            </div>
          </div>

          {/* Quick Add Custom Glyph / Word Field */}
          <div className="flex items-center gap-1 pt-1 border-t border-stone-200 dark:border-zinc-800">
            <input
              id="chain-custom-input"
              type="text"
              value={customInputText}
              onChange={(e) => setCustomInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customInputText.trim()) {
                  handleAddGlyph(customInputText);
                  setCustomInputText('');
                }
              }}
              placeholder="Type symbol or word (e.g. ⬡, ♈, VOID)..."
              className={`flex-1 px-2.5 py-1 text-[11px] font-mono rounded-md border outline-none transition-colors ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-800'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-400'
              }`}
            />
            <button
              id="chain-add-custom-btn"
              onClick={() => {
                if (customInputText.trim()) {
                  handleAddGlyph(customInputText);
                  setCustomInputText('');
                }
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all ${
                isLight
                  ? 'bg-stone-800 text-white hover:bg-black border-stone-800'
                  : 'bg-zinc-200 text-zinc-950 hover:bg-white border-zinc-200'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: DYNAMICS, TIMING & SPEED VARIABLES */}
      {activeSubTab === 'speed' && (
        <div className="flex flex-col gap-2.5">
          {/* Step Hold Duration (Dwell) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold">STEP HOLD TIME (DWELL)</span>
              <EditableNumber
                value={chaining.stepHoldDuration}
                min={0.0}
                max={300.0}
                step={0.1}
                precision={1}
                unit="s"
                onChange={(val) => updateChaining({ stepHoldDuration: val })}
                className="font-mono text-[10px] font-bold"
              />
            </div>
            <input
              id="chain-hold-duration-slider"
              type="range"
              min="0.0"
              max="30.0"
              step="0.05"
              value={chaining.stepHoldDuration}
              onChange={(e) => updateChaining({ stepHoldDuration: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[9px] opacity-60">Time particles rest assembled into each glyph</span>
          </div>

          {/* Morph Transition Duration */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold">TRANSITION DURATION (MORPH SPEED)</span>
              <EditableNumber
                value={chaining.transitionDuration}
                min={0.02}
                max={300.0}
                step={0.1}
                precision={1}
                unit="s"
                onChange={(val) => updateChaining({ transitionDuration: val })}
                className="font-mono text-[10px] font-bold"
              />
            </div>
            <input
              id="chain-transition-duration-slider"
              type="range"
              min="0.05"
              max="30.0"
              step="0.05"
              value={chaining.transitionDuration}
              onChange={(e) => updateChaining({ transitionDuration: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[9px] opacity-60">Time to complete fluid morph between consecutive links</span>
          </div>

          {/* Timing Jitter (Organic Drift) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold">TIMING JITTER (ORGANIC DRIFT)</span>
              <EditableNumber
                value={Math.round((chaining.timingJitter || 0) * 100)}
                min={0}
                max={1000}
                step={1}
                unit="%"
                onChange={(val) => updateChaining({ timingJitter: val / 100 })}
                className="font-mono text-[10px] font-bold"
              />
            </div>
            <input
              id="chain-timing-jitter-slider"
              type="range"
              min="0"
              max="3.0"
              step="0.02"
              value={chaining.timingJitter}
              onChange={(e) => updateChaining({ timingJitter: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[9px] opacity-60">Random cadence variation per link for organic breathing rhythm</span>
          </div>

          {/* Disperse Shockwave Impulse on Link Advance */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold">TRANSITION IMPULSE (SHOCKWAVE)</span>
              <EditableNumber
                value={chaining.disperseImpulse}
                min={0.0}
                max={100.0}
                step={0.1}
                precision={1}
                onChange={(val) => updateChaining({ disperseImpulse: val })}
                className="font-mono text-[10px] font-bold"
              />
            </div>
            <input
              id="chain-disperse-impulse-slider"
              type="range"
              min="0.0"
              max="20.0"
              step="0.1"
              value={chaining.disperseImpulse}
              onChange={(e) => updateChaining({ disperseImpulse: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[9px] opacity-60">Fluid burst kicked at the start of each new transition</span>
          </div>

          {/* Traversal Mode Select */}
          <div className="flex flex-col gap-1 pt-1 border-t border-stone-200 dark:border-zinc-800">
            <span className="text-[10px] font-semibold">TRAVERSAL PATTERN</span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'loop', label: 'Loop' },
                  { id: 'pingpong', label: 'Ping-Pong' },
                  { id: 'randomWalk', label: 'Walk ±1' },
                  { id: 'chaos', label: 'Chaos' },
                  { id: 'shuffle', label: 'Shuffle' },
                ] as { id: ChainTraversalMode; label: string }[]
              ).map((modeItem) => {
                const isSelected = chaining.mode === modeItem.id;
                return (
                  <button
                    key={modeItem.id}
                    id={`chain-mode-${modeItem.id}`}
                    onClick={() => updateChaining({ mode: modeItem.id })}
                    className={`py-1 px-1.5 text-[9px] font-mono rounded border transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-stone-900 text-white font-bold border-stone-900'
                          : 'bg-white text-zinc-950 font-bold border-white'
                        : isLight
                        ? 'border-stone-200 hover:bg-stone-100 text-stone-700'
                        : 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {modeItem.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Easing Curve Select */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold">TRANSITION EASING</span>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'smoothstep', label: 'Smooth' },
                  { id: 'kineticSnap', label: 'Snap' },
                  { id: 'whip', label: 'Whip' },
                  { id: 'linear', label: 'Linear' },
                ] as { id: ChainEasing; label: string }[]
              ).map((easeItem) => {
                const isSelected = chaining.easing === easeItem.id;
                return (
                  <button
                    key={easeItem.id}
                    id={`chain-easing-${easeItem.id}`}
                    onClick={() => updateChaining({ easing: easeItem.id })}
                    className={`py-1 px-1 text-[9px] font-mono rounded border transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-stone-900 text-white font-bold border-stone-900'
                          : 'bg-white text-zinc-950 font-bold border-white'
                        : isLight
                        ? 'border-stone-200 hover:bg-stone-100 text-stone-700'
                        : 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {easeItem.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: PUMPED GLYPH & POLYGON LIBRARY */}
      {activeSubTab === 'library' && (
        <div className="flex flex-col gap-2">
          {/* Category Selector Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            {GLYPH_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  id={`cat-btn-${category.id}`}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-2 py-0.5 text-[9px] font-mono whitespace-nowrap rounded-full border transition-all ${
                    isSelected
                      ? isLight
                        ? 'bg-stone-900 text-white font-bold border-stone-900'
                        : 'bg-white text-zinc-950 font-bold border-white'
                      : isLight
                      ? 'border-stone-200 text-stone-600 hover:bg-stone-100'
                      : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {category.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Active Category Description */}
          {(() => {
            const currentCat = GLYPH_CATEGORIES.find((c) => c.id === selectedCategory);
            return currentCat ? (
              <div className="text-[9px] opacity-60 font-mono italic px-0.5">
                {currentCat.description}
              </div>
            ) : null;
          })()}

          {/* Glyphs Grid */}
          <div className="grid grid-cols-6 gap-1 max-h-[160px] overflow-y-auto pr-1">
            {GLYPH_CATEGORIES.find((c) => c.id === selectedCategory)?.items.map((item) => (
              <button
                key={item.char}
                id={`add-glyph-${item.char}`}
                onClick={() => handleAddGlyph(item.char)}
                title={`${item.name} (${item.char}) - Click to append to chain`}
                className={`flex flex-col items-center justify-center h-10 rounded border transition-all ${
                  isLight
                    ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-900 hover:scale-105 hover:shadow-xs'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-100 hover:scale-105 hover:shadow-xs'
                }`}
              >
                <span className="text-base font-bold leading-none">{item.char}</span>
                <span className="text-[7px] opacity-50 truncate max-w-[40px] mt-0.5">{item.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Quick Generator: Chaos Pick */}
          <button
            id="chain-chaos-pick-btn"
            onClick={handleChaosPick}
            className={`w-full py-1.5 rounded-md border text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
              isLight
                ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
                : 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Randomize 6 New Glyphs From Library</span>
          </button>
        </div>
      )}

      {/* SUB-VIEW 4: CURATED CHAIN PRESETS */}
      {activeSubTab === 'presets' && (
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {CHAIN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              id={`chain-preset-${preset.id}`}
              onClick={() => handleApplyPreset(preset)}
              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                isLight
                  ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-900 hover:border-stone-400'
                  : 'bg-zinc-900 hover:bg-zinc-800/80 border-zinc-800 text-zinc-100 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px]">{preset.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
                  {preset.chain.length} links
                </span>
              </div>
              <p className="text-[9px] opacity-70 line-clamp-2 leading-relaxed">
                {preset.description}
              </p>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {preset.chain.slice(0, 8).join(' → ')}
                {preset.chain.length > 8 && '...'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
