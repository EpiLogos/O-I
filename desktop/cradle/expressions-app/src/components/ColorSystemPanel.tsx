/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Palette,
  Sparkles,
  MoveRight,
  Radio,
  RotateCw,
  Flame,
  Layers,
  Activity,
  Circle,
  Shuffle,
  RotateCcw,
  Compass,
  Zap,
  Droplet,
  Sun,
  Moon,
  Contrast,
  Wand2,
  Maximize2,
} from 'lucide-react';
import { PointCloudConfig, PointCloudColorConfig, ColorDistributionMode, BackgroundAtmosphereMode } from '../engine/types';
import {
  COLOR_PALETTES,
  COLOR_DISTRIBUTION_MODES,
  BACKGROUND_THEMES,
  BACKGROUND_ATMOSPHERE_MODES,
  isLightHex,
  hexToRgb,
} from '../engine/colorPalettes';
import { DEFAULT_COLOR_CONFIG } from '../engine/PointCloudField';
import { CurvedSlider } from './CurvedSlider';

interface ColorSystemPanelProps {
  config: PointCloudConfig;
  setConfig: React.Dispatch<React.SetStateAction<PointCloudConfig>>;
  isLight: boolean;
}

export const ColorSystemPanel: React.FC<ColorSystemPanelProps> = ({
  config,
  setConfig,
  isLight,
}) => {
  const color = config.color || DEFAULT_COLOR_CONFIG;

  const updateColor = (partial: Partial<PointCloudColorConfig>) => {
    setConfig((prev) => ({
      ...prev,
      color: {
        ...(prev.color || DEFAULT_COLOR_CONFIG),
        ...partial,
      },
    }));
  };

  const handleSelectPalette = (paletteId: string) => {
    const pal = COLOR_PALETTES.find((p) => p.id === paletteId);
    if (!pal) return;

    updateColor({
      enabled: true,
      paletteId: pal.id,
      primaryColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      mode: pal.recommendedMode,
      angle: pal.recommendedAngle ?? color.angle,
      cycleSpeed: pal.recommendedSpeed ?? color.cycleSpeed,
      waveFrequency: pal.recommendedFrequency ?? color.waveFrequency,
      turbulenceModulation: pal.recommendedTurbulence ?? color.turbulenceModulation,
    });
  };

  const handleRandomizeHarmonious = () => {
    const pal = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    handleSelectPalette(pal.id);
  };

  const handleInvertColors = () => {
    updateColor({
      primaryColor: color.secondaryColor,
      secondaryColor: color.primaryColor,
    });
  };

  const activeBgColor =
    config.backgroundColor ||
    color.backgroundColor ||
    (isLight ? '#fafaf9' : '#09090b');
  const activeBgMode = config.backgroundMode || color.backgroundMode || 'ambientGlow';
  const activeGlowIntensity =
    config.backgroundGlowIntensity ?? color.backgroundGlowIntensity ?? 0.45;

  const updateBackground = (
    newBg: string,
    newMode?: BackgroundAtmosphereMode,
    newGlow?: number
  ) => {
    const isLightBg = isLightHex(newBg);
    setConfig((prev) => ({
      ...prev,
      backgroundColor: newBg,
      backgroundMode: newMode ?? prev.backgroundMode ?? 'ambientGlow',
      backgroundGlowIntensity: newGlow ?? prev.backgroundGlowIntensity ?? 0.45,
      colorMode: isLightBg ? 'blackOnWhite' : 'whiteOnBlack',
      color: {
        ...(prev.color || DEFAULT_COLOR_CONFIG),
        backgroundColor: newBg,
        backgroundMode: newMode ?? (prev.color?.backgroundMode || 'ambientGlow'),
        backgroundGlowIntensity: newGlow ?? (prev.color?.backgroundGlowIntensity ?? 0.45),
      },
    }));
  };

  const handleHarmonizeBackground = () => {
    // Generate an atmospheric dark void tinted with the primary particle color
    const [r, g, b] = hexToRgb(color.primaryColor);
    const deepR = Math.max(3, Math.floor(r * 0.07));
    const deepG = Math.max(3, Math.floor(g * 0.07));
    const deepB = Math.max(8, Math.floor(b * 0.12));
    const deepHex = `#${deepR.toString(16).padStart(2, '0')}${deepG.toString(16).padStart(2, '0')}${deepB.toString(16).padStart(2, '0')}`;
    updateBackground(deepHex, 'ambientGlow', 0.65);
  };

  const handleInvertBackground = () => {
    const isCurrentlyLight = isLightHex(activeBgColor);
    const newBg = isCurrentlyLight ? '#09090b' : '#fafaf9';
    updateBackground(newBg);
  };

  return (
    <div className="space-y-3 font-sans text-xs">
      {/* Header Banner & Master Activation Switch */}
      <div
        className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
          color.enabled
            ? isLight
              ? 'bg-emerald-50/80 border-emerald-300'
              : 'bg-emerald-950/20 border-emerald-600/40'
            : isLight
            ? 'bg-stone-50 border-stone-200'
            : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
              color.enabled
                ? 'bg-emerald-500 text-white shadow-xs'
                : isLight
                ? 'bg-stone-200 text-stone-600'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-xs flex items-center gap-1.5">
              <span>Procedural Color Field</span>
              {color.enabled ? (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono uppercase font-bold rounded-sm">
                  Active
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-stone-500/20 text-stone-500 text-[9px] font-mono uppercase rounded-sm">
                  Mono Ink
                </span>
              )}
            </div>
            <p className="text-[10px] text-stone-500 dark:text-zinc-400">
              Dynamic wave propagation, kinetic velocity spectra & fluid marbling
            </p>
          </div>
        </div>

        <button
          id="toggle-color-system-active-btn"
          onClick={() => updateColor({ enabled: !color.enabled })}
          className={`px-3 py-1.5 rounded-md font-mono text-xs uppercase font-semibold transition-all ${
            color.enabled
              ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs'
              : isLight
              ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {color.enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>

      {/* Live Animated Gradient Bar Preview */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-zinc-400">
          <span>CHROMATIC SPECTRUM</span>
          <span className="uppercase text-[9px]">
            {color.mode} • {color.cycleSpeed > 0 ? `${color.cycleSpeed.toFixed(1)}x speed` : 'frozen'}
          </span>
        </div>
        <div
          className="h-3.5 w-full rounded-md shadow-inner border overflow-hidden relative"
          style={{
            background: `linear-gradient(90deg, ${color.primaryColor}, ${color.accentColor}, ${color.secondaryColor}, ${color.primaryColor})`,
            backgroundSize: '200% 100%',
            animation: color.cycleSpeed !== 0 && color.enabled ? `moveGradient ${Math.max(0.5, 6 / Math.abs(color.cycleSpeed))}s linear infinite` : 'none',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/20 pointer-events-none" />
        </div>
      </div>

      {/* Curated Color Palettes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Curated Aesthetic Palettes</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRandomizeHarmonious}
              title="Pick random palette"
              className={`p-1 rounded text-[10px] flex items-center gap-0.5 border ${
                isLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Shuffle className="w-2.5 h-2.5" />
              <span>Random</span>
            </button>
            <button
              onClick={handleInvertColors}
              title="Invert Primary & Secondary colors"
              className={`p-1 rounded text-[10px] flex items-center gap-0.5 border ${
                isLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Invert</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 border rounded-md custom-scrollbar bg-black/5 dark:bg-white/5">
          {COLOR_PALETTES.map((pal) => {
            const isSelected = color.paletteId === pal.id;
            return (
              <button
                key={pal.id}
                id={`palette-btn-${pal.id}`}
                onClick={() => handleSelectPalette(pal.id)}
                className={`flex flex-col p-1.5 rounded border text-left transition-all ${
                  isSelected
                    ? isLight
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-white text-zinc-950 border-white shadow-xs'
                    : isLight
                    ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-800'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                }`}
              >
                {/* 3-color swatch bar */}
                <div className="flex h-2.5 w-full rounded-sm overflow-hidden mb-1 border border-black/10">
                  <span className="flex-1" style={{ backgroundColor: pal.primary }} />
                  <span className="flex-1" style={{ backgroundColor: pal.accent }} />
                  <span className="flex-1" style={{ backgroundColor: pal.secondary }} />
                </div>
                <span className="font-semibold text-[10px] truncate leading-tight">{pal.name}</span>
                <span className="text-[8px] opacity-70 truncate uppercase font-mono">{pal.recommendedMode}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Spatial Color Distribution Modes */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-1">
          <Compass className="w-3 h-3 text-blue-500" />
          <span>Spatial Field Distribution</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {COLOR_DISTRIBUTION_MODES.map((mode) => {
            const isSelected = color.mode === mode.id;
            let Icon = MoveRight;
            if (mode.id === 'radialGradient') Icon = Radio;
            if (mode.id === 'angularSweep') Icon = RotateCw;
            if (mode.id === 'velocityThermal') Icon = Flame;
            if (mode.id === 'densityDepth') Icon = Layers;
            if (mode.id === 'waveInterference') Icon = Activity;
            if (mode.id === 'rainbowSpectral') Icon = Sparkles;
            if (mode.id === 'monochrome') Icon = Circle;

            return (
              <button
                key={mode.id}
                id={`colormode-${mode.id}`}
                onClick={() => updateColor({ mode: mode.id, enabled: true })}
                className={`flex items-center gap-1.5 p-1.5 rounded-md border text-left transition-all ${
                  isSelected
                    ? isLight
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-white text-zinc-950 border-white font-semibold'
                    : isLight
                    ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-[10px] truncate leading-tight">{mode.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Stops Pickers */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-1">
          <Droplet className="w-3 h-3 text-pink-500" />
          <span>Color Stops & Palette Tints</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {/* Primary */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-stone-500 dark:text-zinc-400 uppercase">Primary</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                id="color-picker-primary"
                value={color.primaryColor}
                onChange={(e) => updateColor({ primaryColor: e.target.value, enabled: true })}
                className="w-6 h-6 rounded cursor-pointer border p-0 bg-transparent"
              />
              <input
                type="text"
                value={color.primaryColor}
                onChange={(e) => updateColor({ primaryColor: e.target.value, enabled: true })}
                className={`w-full text-[10px] font-mono px-1 py-0.5 rounded border ${
                  isLight ? 'bg-white border-stone-200' : 'bg-zinc-900 border-zinc-700'
                }`}
              />
            </div>
          </div>

          {/* Accent */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-stone-500 dark:text-zinc-400 uppercase">Accent / Mid</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                id="color-picker-accent"
                value={color.accentColor}
                onChange={(e) => updateColor({ accentColor: e.target.value, enabled: true })}
                className="w-6 h-6 rounded cursor-pointer border p-0 bg-transparent"
              />
              <input
                type="text"
                value={color.accentColor}
                onChange={(e) => updateColor({ accentColor: e.target.value, enabled: true })}
                className={`w-full text-[10px] font-mono px-1 py-0.5 rounded border ${
                  isLight ? 'bg-white border-stone-200' : 'bg-zinc-900 border-zinc-700'
                }`}
              />
            </div>
          </div>

          {/* Secondary */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-stone-500 dark:text-zinc-400 uppercase">Secondary</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                id="color-picker-secondary"
                value={color.secondaryColor}
                onChange={(e) => updateColor({ secondaryColor: e.target.value, enabled: true })}
                className="w-6 h-6 rounded cursor-pointer border p-0 bg-transparent"
              />
              <input
                type="text"
                value={color.secondaryColor}
                onChange={(e) => updateColor({ secondaryColor: e.target.value, enabled: true })}
                className={`w-full text-[10px] font-mono px-1 py-0.5 rounded border ${
                  isLight ? 'bg-white border-stone-200' : 'bg-zinc-900 border-zinc-700'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Canvas & Background Atmosphere */}
      <div className="p-2.5 border rounded-lg space-y-2.5 bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Contrast className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold text-stone-700 dark:text-zinc-300">Canvas & Background Atmosphere</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              id="harmonize-bg-btn"
              onClick={handleHarmonizeBackground}
              title="Tint background with deep ambient hue matching particle palette"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 border transition-all ${
                isLight
                  ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              <Wand2 className="w-2.5 h-2.5 text-indigo-400" />
              <span>Harmonize</span>
            </button>
            <button
              id="invert-bg-btn"
              onClick={handleInvertBackground}
              title="Flip between dark void and light paper canvas"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 border transition-all ${
                isLight
                  ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {isLight ? <Moon className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
              <span>Invert</span>
            </button>
          </div>
        </div>

        {/* Atmosphere Style Selector */}
        <div className="grid grid-cols-4 gap-1">
          {BACKGROUND_ATMOSPHERE_MODES.map((atm) => {
            const isSelected = activeBgMode === atm.id;
            return (
              <button
                key={atm.id}
                id={`bg-mode-${atm.id}`}
                onClick={() => updateBackground(activeBgColor, atm.id)}
                title={atm.description}
                className={`py-1 px-1.5 rounded text-center border transition-all text-[10px] font-mono uppercase ${
                  isSelected
                    ? isLight
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold shadow-xs'
                      : 'bg-white text-zinc-950 border-white font-semibold shadow-xs'
                    : isLight
                    ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-600'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
                }`}
              >
                {atm.id === 'ambientGlow' ? 'Glow' : atm.id === 'vignette' ? 'Vignette' : atm.id === 'adaptive' ? 'Adaptive' : 'Solid'}
              </button>
            );
          })}
        </div>

        {/* Curated Swatches: Dark Voids */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-mono text-stone-400 dark:text-zinc-500 uppercase">
            <span>Dark Voids & Midnight</span>
            <span>{isLightHex(activeBgColor) ? 'Light Tone Active' : 'Dark Void Active'}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {BACKGROUND_THEMES.filter((t) => t.category === 'dark').map((theme) => {
              const isSelected = activeBgColor.toLowerCase() === theme.color.toLowerCase();
              return (
                <button
                  key={theme.id}
                  id={`bg-swatch-${theme.id}`}
                  onClick={() => updateBackground(theme.color)}
                  title={`${theme.name} (${theme.color}) - ${theme.description}`}
                  className={`flex items-center gap-1.5 p-1 rounded border text-left transition-all ${
                    isSelected
                      ? 'ring-1 ring-indigo-500 border-indigo-500 font-semibold'
                      : isLight
                      ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-xs"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-[9px] truncate leading-none">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curated Swatches: Light & Editorial Canvas */}
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-stone-400 dark:text-zinc-500 uppercase">
            <span>Light & Editorial Paper</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {BACKGROUND_THEMES.filter((t) => t.category === 'light').map((theme) => {
              const isSelected = activeBgColor.toLowerCase() === theme.color.toLowerCase();
              return (
                <button
                  key={theme.id}
                  id={`bg-swatch-${theme.id}`}
                  onClick={() => updateBackground(theme.color)}
                  title={`${theme.name} (${theme.color}) - ${theme.description}`}
                  className={`flex items-center gap-1.5 p-1 rounded border text-left transition-all ${
                    isSelected
                      ? 'ring-1 ring-indigo-500 border-indigo-500 font-semibold'
                      : isLight
                      ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20 shadow-xs"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-[9px] truncate leading-none">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Color Picker & Hex Input */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-stone-500 dark:text-zinc-400">Custom Tone:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                id="custom-bg-color-picker"
                value={activeBgColor.startsWith('#') && activeBgColor.length >= 7 ? activeBgColor : '#09090b'}
                onChange={(e) => updateBackground(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border p-0 bg-transparent"
              />
              <input
                type="text"
                value={activeBgColor}
                onChange={(e) => updateBackground(e.target.value)}
                placeholder="#09090b"
                className={`w-20 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              />
            </div>
          </div>

          <div className="text-[9px] font-mono text-stone-400 dark:text-zinc-500">
            {isLightHex(activeBgColor) ? 'Luminous Canvas' : 'Deep Abyss'}
          </div>
        </div>

        {/* Ambient Glow Intensity Slider (if glow or adaptive active) */}
        {(activeBgMode === 'ambientGlow' || activeBgMode === 'adaptive') && (
          <div className="pt-1">
            <CurvedSlider
              id="bg-glow-intensity-slider"
              label="Atmospheric Back-Light Glow"
              value={activeGlowIntensity}
              min={0.0}
              max={1.0}
              step={0.05}
              unit=""
              onChange={(v) => updateBackground(activeBgColor, activeBgMode, v)}
              isLight={isLight}
            />
          </div>
        )}
      </div>

      {/* Field Motion & Temporal Dynamics */}
      <div className="p-2 border rounded-md space-y-2 bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-500" />
            Temporal Flow & Wave Dynamics
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateColor({ cycleSpeed: 0.0 })}
              className={`px-1.5 py-0.5 rounded text-[9px] ${
                color.cycleSpeed === 0 ? 'bg-amber-500 text-white' : 'bg-stone-200 dark:bg-zinc-800'
              }`}
            >
              Freeze
            </button>
            <button
              onClick={() => updateColor({ cycleSpeed: -1.2 })}
              className={`px-1.5 py-0.5 rounded text-[9px] ${
                color.cycleSpeed < 0 ? 'bg-blue-500 text-white' : 'bg-stone-200 dark:bg-zinc-800'
              }`}
            >
              Reverse
            </button>
            <button
              onClick={() => updateColor({ cycleSpeed: 1.2 })}
              className={`px-1.5 py-0.5 rounded text-[9px] ${
                color.cycleSpeed === 1.2 ? 'bg-emerald-500 text-white' : 'bg-stone-200 dark:bg-zinc-800'
              }`}
            >
              1.2x
            </button>
          </div>
        </div>

        {/* Wave Propagation Speed */}
        <CurvedSlider
          id="color-cycle-speed-slider"
          label="Wave Cycle Speed"
          value={color.cycleSpeed}
          min={-4.0}
          max={4.0}
          step={0.1}
          unit=" rad/s"
          onChange={(v) => updateColor({ cycleSpeed: v, enabled: true })}
          isLight={isLight}
        />

        {/* Continuous Hue Shift */}
        <CurvedSlider
          id="color-hue-shift-slider"
          label="Continuous Hue Rotation"
          value={color.hueShiftSpeed}
          min={-2.0}
          max={2.0}
          step={0.05}
          unit=" rev/s"
          onChange={(v) => updateColor({ hueShiftSpeed: v, enabled: true })}
          isLight={isLight}
        />

        {/* Wave Angle & Direction */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <CurvedSlider
              id="color-angle-slider"
              label="Wave Angle (Direction)"
              value={color.angle}
              min={0}
              max={360}
              step={5}
              unit="°"
              onChange={(v) => updateColor({ angle: v, enabled: true })}
              isLight={isLight}
            />
          </div>
          <div className="flex items-center gap-1 justify-end">
            {[0, 45, 90, 135, 180, 270].map((deg) => (
              <button
                key={deg}
                onClick={() => updateColor({ angle: deg, enabled: true })}
                className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
                  color.angle === deg
                    ? 'bg-stone-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                    : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>

        {/* Spatial Wave Frequency */}
        <CurvedSlider
          id="color-frequency-slider"
          label="Wave Band Frequency (Density)"
          value={color.waveFrequency}
          min={0.2}
          max={6.0}
          step={0.1}
          unit="x"
          onChange={(v) => updateColor({ waveFrequency: v, enabled: true })}
          isLight={isLight}
        />
      </div>

      {/* Fluid & Kinetic Organic Modulation */}
      <div className="p-2 border rounded-md space-y-2 bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            Fluid Marbling & Kinetic Response
          </span>
        </div>

        {/* Fluid Turbulence Marbling */}
        <CurvedSlider
          id="color-turbulence-slider"
          label="Fluid Noise Marbling (Warping)"
          value={color.turbulenceModulation}
          min={0.0}
          max={1.0}
          step={0.05}
          unit=""
          onChange={(v) => updateColor({ turbulenceModulation: v, enabled: true })}
          isLight={isLight}
        />

        {/* Speed-Reactive Velocity Boost */}
        <CurvedSlider
          id="color-speed-reactive-slider"
          label="Kinetic Velocity Ignite (Speed Boost)"
          value={color.speedReactiveIntensity}
          min={0.0}
          max={2.0}
          step={0.05}
          unit="x"
          onChange={(v) => updateColor({ speedReactiveIntensity: v, enabled: true })}
          isLight={isLight}
        />

        {/* Density Core Depth */}
        <CurvedSlider
          id="color-density-weight-slider"
          label="Stroke Density Weighting"
          value={color.densityWeight}
          min={0.0}
          max={1.0}
          step={0.05}
          unit=""
          onChange={(v) => updateColor({ densityWeight: v, enabled: true })}
          isLight={isLight}
        />

        {/* Contrast / Sharpness */}
        <CurvedSlider
          id="color-contrast-slider"
          label="Gradient Band Sharpness (Contrast)"
          value={color.contrast}
          min={0.4}
          max={2.5}
          step={0.05}
          unit=""
          onChange={(v) => updateColor({ contrast: v, enabled: true })}
          isLight={isLight}
        />
      </div>

      {/* Field Origin Center Offset */}
      <div className="space-y-1.5 p-2 border rounded-md bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-1">
            <Maximize2 className="w-3 h-3 text-indigo-500" />
            <span>Field Anchor Origin Offset</span>
          </label>
          <button
            onClick={() => updateColor({ fieldCenterOffset: [0, 0] })}
            className="text-[9px] font-mono text-stone-500 hover:text-stone-900 dark:hover:text-white underline"
          >
            Reset Center (0, 0)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CurvedSlider
            id="color-offset-x-slider"
            label="X Offset"
            value={color.fieldCenterOffset?.[0] ?? 0}
            min={-1.0}
            max={1.0}
            step={0.05}
            unit=""
            onChange={(v) =>
              updateColor({
                fieldCenterOffset: [v, color.fieldCenterOffset?.[1] ?? 0],
              })
            }
            isLight={isLight}
          />
          <CurvedSlider
            id="color-offset-y-slider"
            label="Y Offset"
            value={color.fieldCenterOffset?.[1] ?? 0}
            min={-1.0}
            max={1.0}
            step={0.05}
            unit=""
            onChange={(v) =>
              updateColor({
                fieldCenterOffset: [color.fieldCenterOffset?.[0] ?? 0, v],
              })
            }
            isLight={isLight}
          />
        </div>
      </div>
    </div>
  );
};
