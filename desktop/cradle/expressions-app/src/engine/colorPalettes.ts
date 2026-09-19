/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorDistributionMode } from './types';

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  recommendedMode: ColorDistributionMode;
  recommendedAngle?: number;
  recommendedFrequency?: number;
  recommendedSpeed?: number;
  recommendedTurbulence?: number;
  tags: string[];
}

export const COLOR_DISTRIBUTION_MODES: {
  id: ColorDistributionMode;
  label: string;
  shortDesc: string;
  iconName: string;
}[] = [
  {
    id: 'linearGradient',
    label: 'Linear Wave',
    shortDesc: 'Directional planar gradient wave sweeping across the glyph at an angle',
    iconName: 'MoveRight',
  },
  {
    id: 'radialGradient',
    label: 'Concentric Rings',
    shortDesc: 'Expanding ripple wave rings radiating outward from the glyph center',
    iconName: 'Radio',
  },
  {
    id: 'angularSweep',
    label: 'Conic Sweep',
    shortDesc: 'Rotary chromatic sweep revolving 360° around the glyph center',
    iconName: 'RotateCw',
  },
  {
    id: 'velocityThermal',
    label: 'Kinetic Energy',
    shortDesc: 'Dynamic thermal mapping directly reacting to particle speed and turbulence',
    iconName: 'Flame',
  },
  {
    id: 'densityDepth',
    label: 'Density Depth',
    shortDesc: 'Tonal separation between the dense core strokes and fine peripheral mist',
    iconName: 'Layers',
  },
  {
    id: 'waveInterference',
    label: 'Interference',
    shortDesc: 'Dual orthogonal standing harmonic waves forming cymatic nodal bands',
    iconName: 'Activity',
  },
  {
    id: 'rainbowSpectral',
    label: 'Iridescent',
    shortDesc: 'Multi-spectral prismatic dispersion with continuous chromatic phase',
    iconName: 'Sparkles',
  },
  {
    id: 'monochrome',
    label: 'Monochrome Tint',
    shortDesc: 'Solid uniform tint with fine typographic stippling',
    iconName: 'Circle',
  },
];

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    description: 'Electric cyan, laser magenta, and acid yellow with high chromatic punch',
    primary: '#00f0ff',
    secondary: '#ff007f',
    accent: '#ffe600',
    recommendedMode: 'linearGradient',
    recommendedAngle: 45,
    recommendedSpeed: 1.4,
    recommendedFrequency: 1.8,
    recommendedTurbulence: 0.4,
    tags: ['cyber', 'neon', 'vibrant', 'high-contrast'],
  },
  {
    id: 'aurora_borealis',
    name: 'Aurora Borealis',
    description: 'Ethereal arctic greens, polar electric blue, and twilight ultraviolet',
    primary: '#00ff87',
    secondary: '#60efff',
    accent: '#7928ca',
    recommendedMode: 'waveInterference',
    recommendedAngle: 120,
    recommendedSpeed: 0.9,
    recommendedFrequency: 2.2,
    recommendedTurbulence: 0.6,
    tags: ['nature', 'ethereal', 'aurora', 'cool'],
  },
  {
    id: 'solar_flare',
    name: 'Solar Plasma',
    description: 'Blazing thermonuclear gold, molten magma orange, and deep incandescent crimson',
    primary: '#ffd200',
    secondary: '#ff2a2a',
    accent: '#ff7700',
    recommendedMode: 'velocityThermal',
    recommendedSpeed: 1.8,
    recommendedFrequency: 1.5,
    recommendedTurbulence: 0.5,
    tags: ['warm', 'fire', 'thermal', 'kinetic'],
  },
  {
    id: 'tokyo_twilight',
    name: 'Tokyo Twilight',
    description: 'Nocturnal velvet purple, neon sunset magenta, and luminous warm coral',
    primary: '#8a2387',
    secondary: '#e94057',
    accent: '#f27121',
    recommendedMode: 'angularSweep',
    recommendedSpeed: 1.2,
    recommendedFrequency: 1.0,
    recommendedTurbulence: 0.35,
    tags: ['dusk', 'sunset', 'gradient', 'synthwave'],
  },
  {
    id: 'matrix_hacker',
    name: 'Matrix Acid',
    description: 'Radioactive green, bright phosphorescent chartreuse, and abyssal emerald',
    primary: '#00ff66',
    secondary: '#76ff03',
    accent: '#003311',
    recommendedMode: 'densityDepth',
    recommendedSpeed: 0.8,
    recommendedFrequency: 2.0,
    recommendedTurbulence: 0.25,
    tags: ['terminal', 'hacker', 'green', 'monochrome'],
  },
  {
    id: 'prismatic_opal',
    name: 'Prismatic Opal',
    description: 'Iridescent pearl luster, pastel rose, and liquid seafoam sheen',
    primary: '#ff9a9e',
    secondary: '#fecfef',
    accent: '#96e6a1',
    recommendedMode: 'rainbowSpectral',
    recommendedAngle: 60,
    recommendedSpeed: 1.5,
    recommendedFrequency: 2.5,
    recommendedTurbulence: 0.5,
    tags: ['pastel', 'rainbow', 'soap-bubble', 'sheen'],
  },
  {
    id: 'infrared_flir',
    name: 'Infrared Thermal',
    description: 'Scientific thermographic spectrum from cold cryogenic violet to white-hot peak',
    primary: '#05004e',
    secondary: '#ff0000',
    accent: '#ffff00',
    recommendedMode: 'velocityThermal',
    recommendedSpeed: 2.0,
    recommendedFrequency: 2.0,
    recommendedTurbulence: 0.7,
    tags: ['scientific', 'flir', 'heat-map', 'contrast'],
  },
  {
    id: 'deep_ocean',
    name: 'Deep Abyss',
    description: 'Subterranean marine indigo, bioluminescent cyan, and deep trench teal',
    primary: '#0f2027',
    secondary: '#203a43',
    accent: '#2c5364',
    recommendedMode: 'radialGradient',
    recommendedSpeed: 0.7,
    recommendedFrequency: 2.8,
    recommendedTurbulence: 0.45,
    tags: ['ocean', 'subdued', 'moody', 'calm'],
  },
  {
    id: 'royal_amethyst',
    name: 'Royal Velvet',
    description: 'Regal imperial violet, vivid electric magenta, and bright lavender aura',
    primary: '#4a00e0',
    secondary: '#8e2de2',
    accent: '#f355da',
    recommendedMode: 'linearGradient',
    recommendedAngle: 135,
    recommendedSpeed: 1.1,
    recommendedFrequency: 1.6,
    recommendedTurbulence: 0.3,
    tags: ['luxury', 'purple', 'royal', 'vibrant'],
  },
  {
    id: 'cosmic_nebula',
    name: 'Cosmic Nebula',
    description: 'Deep interstellar void, stellar hydrogen emission pink, and supergiant cyan',
    primary: '#12002f',
    secondary: '#ff2d75',
    accent: '#4df0ff',
    recommendedMode: 'waveInterference',
    recommendedAngle: 30,
    recommendedSpeed: 1.3,
    recommendedFrequency: 2.0,
    recommendedTurbulence: 0.65,
    tags: ['space', 'cosmic', 'astronomy', 'glow'],
  },
  {
    id: 'bauhaus_primary',
    name: 'Bauhaus Triad',
    description: 'Classical modernist primaries: pure cobalt blue, vermilion red, and cadmium yellow',
    primary: '#0047bb',
    secondary: '#e52521',
    accent: '#f3c300',
    recommendedMode: 'angularSweep',
    recommendedSpeed: 0.9,
    recommendedFrequency: 1.0,
    recommendedTurbulence: 0.1,
    tags: ['art', 'modern', 'geometric', 'triad'],
  },
  {
    id: 'gold_leaf',
    name: 'Gilded Gold',
    description: 'Polished 24k gold leaf, champagne luster, and dark burnished bronze',
    primary: '#d4af37',
    secondary: '#f9f1a5',
    accent: '#8c6d23',
    recommendedMode: 'radialGradient',
    recommendedSpeed: 0.8,
    recommendedFrequency: 1.4,
    recommendedTurbulence: 0.3,
    tags: ['gold', 'metallic', 'warm', 'refined'],
  },
];

export interface BackgroundTheme {
  id: string;
  name: string;
  color: string;
  category: 'dark' | 'light';
  description: string;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  // Deep Void & Dark Tones
  { id: 'pitch_black', name: 'Pitch Void', color: '#000000', category: 'dark', description: 'Pure zero-luminance void for infinite contrast' },
  { id: 'obsidian', name: 'Obsidian Zinc', color: '#09090b', category: 'dark', description: 'Deep architectural graphite and zinc darkroom' },
  { id: 'cosmic_abyss', name: 'Cosmic Indigo', color: '#050716', category: 'dark', description: 'Interstellar abyss with faint deep indigo depth' },
  { id: 'cyber_plum', name: 'Cyberpunk Violet', color: '#0c0517', category: 'dark', description: 'Electric club ultraviolet shadow' },
  { id: 'emerald_moss', name: 'Deep Forest', color: '#03120d', category: 'dark', description: 'Midnight evergreen and damp mineral moss' },
  { id: 'charcoal_warm', name: 'Warm Charcoal', color: '#141210', category: 'dark', description: 'Warm tactile basalt with organic undertone' },
  { id: 'nocturne_crimson', name: 'Nocturne Wine', color: '#130508', category: 'dark', description: 'Deep velvet cabernet and burnt crimson' },
  { id: 'deep_slate', name: 'Deep Slate', color: '#0f172a', category: 'dark', description: 'Technical navy slate for high-tech precision' },

  // Light & Editorial Paper Tones
  { id: 'studio_canvas', name: 'Paper Canvas', color: '#fafaf9', category: 'light', description: 'Warm gallery printmaking paper' },
  { id: 'pure_white', name: 'Pure White', color: '#ffffff', category: 'light', description: 'Stark modernist gallery white' },
  { id: 'warm_parchment', name: 'Warm Parchment', color: '#f5f0ea', category: 'light', description: 'Aged archival bookbinding and warm linen' },
  { id: 'cool_mist', name: 'Mist Slate', color: '#f1f5f9', category: 'light', description: 'Cool architectural stone and technical vellum' },
  { id: 'champagne_cream', name: 'Champagne Cream', color: '#f8f5ee', category: 'light', description: 'Subtle luxury ivory and silk' },
  { id: 'sand_dune', name: 'Sand Dune', color: '#eae5dc', category: 'light', description: 'Warm mineral sand with low-contrast earthiness' },
];

export const BACKGROUND_ATMOSPHERE_MODES: {
  id: 'solid' | 'vignette' | 'ambientGlow' | 'adaptive';
  label: string;
  description: string;
}[] = [
  {
    id: 'ambientGlow',
    label: 'Atmospheric Glow',
    description: 'Dynamic back-light emanating behind the glyph matching particle colors',
  },
  {
    id: 'vignette',
    label: 'Radial Vignette',
    description: 'Cinematic radial falloff focusing contrast onto the center field',
  },
  {
    id: 'adaptive',
    label: 'Chromatic Tint',
    description: 'Deeply harmonized ambient tint tuned to active color stops',
  },
  {
    id: 'solid',
    label: 'Uniform Solid',
    description: 'Flat, minimal single-tone canvas backdrop',
  },
];

/**
 * Parses any valid hex string into RGB components [0..255]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [9, 9, 11];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Determines whether a given color hex is light (relative luminance > 0.45)
 */
export function isLightHex(hex?: string): boolean {
  if (!hex) return false;
  const [r, g, b] = hexToRgb(hex);
  // Standard sRGB relative luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.45;
}

/**
 * Generates an rgba string with adjusted alpha
 */
export function hexToRgbaStr(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Computes an ultra-smooth CSS background string incorporating solid, vignette, or particle ambient glow
 */
export function computeBackgroundCSS(options: {
  backgroundColor?: string;
  backgroundMode?: 'solid' | 'vignette' | 'ambientGlow' | 'adaptive';
  glowColor?: string;
  accentColor?: string;
  glowIntensity?: number;
  isLightModeFallback?: boolean;
}): string {
  const isLightFallback = options.isLightModeFallback ?? false;
  const baseBg = options.backgroundColor || (isLightFallback ? '#fafaf9' : '#09090b');
  const mode = options.backgroundMode || 'ambientGlow';
  const intensity = options.glowIntensity ?? 0.45;
  const isLight = isLightHex(baseBg);

  if (mode === 'solid') {
    return baseBg;
  }

  const [r, g, b] = hexToRgb(baseBg);

  if (mode === 'vignette') {
    if (isLight) {
      // Darker vignette on edges
      const edge = `rgb(${Math.max(0, Math.floor(r * 0.88))}, ${Math.max(0, Math.floor(g * 0.88))}, ${Math.max(0, Math.floor(b * 0.88))})`;
      return `radial-gradient(circle at 50% 50%, ${baseBg} 35%, ${edge} 100%)`;
    } else {
      // Deeper pitch black on edges
      const edge = `rgb(${Math.max(0, Math.floor(r * 0.35))}, ${Math.max(0, Math.floor(g * 0.35))}, ${Math.max(0, Math.floor(b * 0.35))})`;
      return `radial-gradient(circle at 50% 50%, ${baseBg} 25%, ${edge} 100%)`;
    }
  }

  const primaryGlow = options.glowColor || (isLight ? '#3b82f6' : '#00f0ff');
  const accentGlow = options.accentColor || (isLight ? '#ec4899' : '#ff007f');

  if (mode === 'adaptive') {
    const alphaPrim = isLight ? intensity * 0.12 : intensity * 0.22;
    const alphaAcc = isLight ? intensity * 0.08 : intensity * 0.15;
    const centerGlow = hexToRgbaStr(primaryGlow, alphaPrim);
    const midGlow = hexToRgbaStr(accentGlow, alphaAcc);
    const edge = isLight
      ? `rgb(${Math.max(0, Math.floor(r * 0.92))}, ${Math.max(0, Math.floor(g * 0.92))}, ${Math.max(0, Math.floor(b * 0.92))})`
      : `rgb(${Math.max(0, Math.floor(r * 0.4))}, ${Math.max(0, Math.floor(g * 0.4))}, ${Math.max(0, Math.floor(b * 0.4))})`;

    return `radial-gradient(ellipse 75% 70% at 50% 50%, ${centerGlow} 0%, ${midGlow} 40%, ${baseBg} 75%, ${edge} 100%)`;
  }

  // 'ambientGlow' mode:
  const alphaCenter = isLight ? intensity * 0.15 : intensity * 0.28;
  const centerGlow = hexToRgbaStr(primaryGlow, alphaCenter);
  const edge = isLight
    ? `rgb(${Math.max(0, Math.floor(r * 0.9))}, ${Math.max(0, Math.floor(g * 0.9))}, ${Math.max(0, Math.floor(b * 0.9))})`
    : `rgb(${Math.max(0, Math.floor(r * 0.3))}, ${Math.max(0, Math.floor(g * 0.3))}, ${Math.max(0, Math.floor(b * 0.3))})`;

  return `radial-gradient(circle at 50% 50%, ${centerGlow} 0%, ${baseBg} 58%, ${edge} 100%)`;
}

