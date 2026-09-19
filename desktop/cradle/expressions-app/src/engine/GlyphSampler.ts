import {asciiLayout} from './asciiLayout';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  SpatialChakraNode,
  SpatialChakraGlyphType,
  SpatialChakraPlane,
  ChakraGeometryMode,
  CymaticsConfig,
  CymaticPlateGeometry,
  CymaticDimension,
} from './types';
import {renderChladniPlate,sampleVolumetric3DNodalPoints,deriveCymaticTemplateModes} from './cymatics';
import {CHAKRA_CYMATIC_PROFILES} from './legacy/chakraCymaticProfiles'
import { sampleImageSource, sampleAlphaSource, SOURCE_WORK_MAX, type SourceAnalysis } from './sourceSampling';
import {
  buildGlyphDepthFields,
  cellVolumeShape,
  applyGlyphVolume,
  hashString,
  DEFAULT_GLYPH_VOLUME,
  type GlyphDepthFields,
  type GlyphVolumeStats,
} from './glyphVolume';
import type {GlyphVolumeConfig} from './types';

/** A sampled cell. `hz`/`cw` carry the 3D body: half-thickness and flank weight. */
export interface SampleCandidate {
  x: number;
  y: number;
  z?: number;
  density: number;
  /** Half-thickness of the glyph body at this cell, in stage units. */
  hz?: number;
  /** 0..1 flank weight (1 at the contour). Present only when volume is on. */
  cw?: number;
}

export interface BakeResult {
  textureA: THREE.DataTexture;
  textureB: THREE.DataTexture;
  centerA: THREE.Vector2;
  centerB: THREE.Vector2;
  vortexCenter: THREE.Vector2;
  attractorCenters: THREE.Vector2[];
}

export const FALLBACK_FONT_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';

export class GlyphSampler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Bounded scratch buffer for image source normalization. */
  private workCanvas: HTMLCanvasElement = document.createElement('canvas');
  private targetCache = new Map<
    string,
    {
      data: Float32Array;
      center: THREE.Vector2;
      subCenters: THREE.Vector2[];
    }
  >();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to create offscreen 2D canvas context for glyph rasterization');
    }
    this.ctx = context;
  }

  /**
   * The true-3D body law. Set by the field; when enabled, every rasterized
   * letterform carries a real half-thickness per cell instead of z micro-noise.
   */
  private volume: GlyphVolumeConfig = DEFAULT_GLYPH_VOLUME;
  private volumeSignature = 'off';
  private depthFieldsCache = new Map<string, GlyphDepthFields>();
  public lastVolumeStats: GlyphVolumeStats | null = null;

  public setVolume(config: GlyphVolumeConfig | undefined): boolean {
    const next = config ?? DEFAULT_GLYPH_VOLUME;
    const sig = [
      next.enabled ? 1 : 0,
      next.depth,
      next.profile,
      next.referenceFalloff,
      next.wallShare,
      next.faceBias,
      next.interiorFill,
      next.jitter,
      next.densityDepth,
      next.surfaceThickness,
      next.wallBand,
      next.outsideTaper,
    ].join('|');
    if (sig === this.volumeSignature) return false;
    this.volumeSignature = sig;
    this.volume = next;
    // Thickness is baked into the candidate pool, so a law change invalidates it.
    this.depthFieldsCache.clear();
    this.clearCache();
    return true;
  }

  public getVolume(): GlyphVolumeConfig {
    return this.volume;
  }

  public clearCache() {
    this.targetCache.clear();
  }

  /**
   * Renders a glyph or arbitrary string onto the offscreen canvas with automatic font-size scaling
   */
  private rasterizeGlyph(
    glyphText: string,
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900
  ): {
    imageData: ImageData;
    bbox: { minX: number; maxX: number; minY: number; maxY: number };
    center: THREE.Vector2;
    subCenters: THREE.Vector2[];
  } {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    const safeText = glyphText.trim() || 'O';

    // Auto-scale font size dynamically to fit width & height without clipping
    let targetFontSize = Math.floor(h * 0.52);
    ctx.font = `${fontWeight} ${targetFontSize}px ${fontFamily}`;
    const initialMeasure = ctx.measureText(safeText);
    const maxAllowableWidth = w * 0.88;

    if (initialMeasure.width > maxAllowableWidth) {
      const scale = maxAllowableWidth / initialMeasure.width;
      targetFontSize = Math.max(36, Math.floor(targetFontSize * scale));
    }

    ctx.font = `${fontWeight} ${targetFontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    const cx = w / 2;
    const cy = h / 2;
    ctx.fillText(safeText, cx, cy);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let totalWeight = 0;

    // Scan bounding box and global center of mass
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          sumX += x * alpha;
          sumY += y * alpha;
          totalWeight += alpha;
        }
      }
    }

    if (totalWeight === 0) {
      minX = w * 0.3;
      maxX = w * 0.7;
      minY = h * 0.3;
      maxY = h * 0.7;
      sumX = cx;
      sumY = cy;
      totalWeight = 1;
    }

    const glyphCenter = new THREE.Vector2(
      sumX / totalWeight - cx,
      -(sumY / totalWeight - cy)
    );

    // Identify sub-centers for individual characters (for multi-attractor orbital simulation)
    const subCenters: THREE.Vector2[] = [];
    const chars = Array.from(safeText).filter((c) => c !== ' ');

    if (chars.length > 1) {
      // Split canvas horizontally across character segments to locate individual centroids
      const spanWidth = Math.max(50, maxX - minX);
      const segmentWidth = spanWidth / chars.length;

      for (let i = 0; i < chars.length && i < 6; i++) {
        const segMinX = minX + i * segmentWidth;
        const segMaxX = segMinX + segmentWidth;

        let segSumX = 0;
        let segSumY = 0;
        let segWeight = 0;

        for (let y = minY; y <= maxY; y += 4) {
          for (let x = Math.floor(segMinX); x <= Math.floor(segMaxX); x += 4) {
            const idx = (y * w + x) * 4;
            const alpha = data[idx + 3];
            if (alpha > 20) {
              segSumX += x * alpha;
              segSumY += y * alpha;
              segWeight += alpha;
            }
          }
        }

        if (segWeight > 0) {
          subCenters.push(
            new THREE.Vector2(
              segSumX / segWeight - cx,
              -(segSumY / segWeight - cy)
            )
          );
        } else {
          // Fallback evenly distributed position
          const segCenterX = segMinX + segmentWidth * 0.5;
          subCenters.push(new THREE.Vector2(segCenterX - cx, glyphCenter.y));
        }
      }
    } else {
      subCenters.push(glyphCenter.clone());
    }

    return {
      imageData: imgData,
      bbox: { minX, maxX, minY, maxY },
      center: glyphCenter,
      subCenters,
    };
  }

  /**
   * Generates target particle positions for a given glyph.
   * Supports both Stochastic Stipple (with perimeter falloff scatter) and Ordered Halftone Matrix.
   */
  public generateTargetData(
    glyphText: string,
    particleCount: number,
    texWidth: number,
    texHeight: number,
    style: 'stipple' | 'halftone' = 'stipple',
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900,
    worldScale: number = 0.85
  ): {
    data: Float32Array;
    center: THREE.Vector2;
    subCenters: THREE.Vector2[];
  } {
    const cacheKey = `${glyphText}_${particleCount}_${texWidth}_${texHeight}_${style}_${fontFamily}_${fontWeight}_${worldScale}`;
    const cached = this.targetCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { imageData, bbox, center, subCenters } = this.rasterizeGlyph(glyphText, fontFamily, fontWeight);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pixels = imageData.data;

    const data = new Float32Array(texWidth * texHeight * 4);

    // Build dense point candidates list with density weighting
    interface SampleCandidate {
      x: number;
      y: number;
      density: number; // 0.0 to 1.0
    }

    const strokeCandidates: SampleCandidate[] = [];
    const edgeCandidates: SampleCandidate[] = [];

    // Bounding box padding for stipple scatter
    const pad = 40;
    const startX = Math.max(0, bbox.minX - pad);
    const endX = Math.min(w - 1, bbox.maxX + pad);
    const startY = Math.max(0, bbox.minY - pad);
    const endY = Math.min(h - 1, bbox.maxY + pad);

    const step = style === 'halftone' ? 4 : 2;

    for (let y = startY; y <= endY; y += step) {
      for (let x = startX; x <= endX; x += step) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255.0;

        if (alpha > 0.02) {
          // Compute local neighborhood gradient to detect edges vs core
          let edgeDist = 0;
          if (x > 2 && x < w - 2 && y > 2 && y < h - 2) {
            const aL = pixels[(y * w + (x - 2)) * 4 + 3];
            const aR = pixels[(y * w + (x + 2)) * 4 + 3];
            const aT = pixels[((y - 2) * w + x) * 4 + 3];
            const aB = pixels[((y + 2) * w + x) * 4 + 3];
            const grad = Math.abs(aR - aL) + Math.abs(aB - aT);
            edgeDist = grad / 510.0;
          }

          const cand: SampleCandidate = {
            x: (x - w / 2) * worldScale,
            y: -(y - h / 2) * worldScale,
            density: alpha,
          };

          if (alpha > 0.65 && edgeDist < 0.25) {
            strokeCandidates.push(cand);
          } else {
            edgeCandidates.push(cand);
          }
        }
      }
    }

    const allCandidates = strokeCandidates.concat(edgeCandidates);
    const candidateCount = allCandidates.length;

    if (candidateCount === 0) {
      // Fallback ring if nothing rendered
      for (let i = 0; i < particleCount; i++) {
        const theta = (i / particleCount) * Math.PI * 2;
        const r = 180 + (Math.random() - 0.5) * 40;
        data[i * 4 + 0] = Math.cos(theta) * r;
        data[i * 4 + 1] = Math.sin(theta) * r;
        data[i * 4 + 2] = (Math.random() - 0.5) * 10;
        data[i * 4 + 3] = 0.8;
      }
      return { data, center, subCenters };
    }

    if (style === 'halftone') {
      // Ordered Halftone / Dot-Matrix Grid Stippling:
      // Snap positions into a structured grid pattern where radius/density will be modulated
      const gridPitch = 8.5; // pixel spacing between halftone dots
      const gridCols = Math.ceil((bbox.maxX - bbox.minX + pad * 2) / gridPitch);
      const gridRows = Math.ceil((bbox.maxY - bbox.minY + pad * 2) / gridPitch);

      const gridNodes: SampleCandidate[] = [];

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const px = Math.floor(bbox.minX - pad + c * gridPitch);
          const py = Math.floor(bbox.minY - pad + r * gridPitch);

          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            const alpha = pixels[idx + 3] / 255.0;
            if (alpha > 0.05) {
              gridNodes.push({
                x: (px - w / 2) * worldScale,
                y: -(py - h / 2) * worldScale,
                density: alpha,
              });
            }
          }
        }
      }

      const numGridNodes = Math.max(1, gridNodes.length);
      for (let i = 0; i < particleCount; i++) {
        // Distribute particles across grid nodes with tiny micro-jitter
        const nodeIndex = i % numGridNodes;
        const node = gridNodes[nodeIndex];
        const microJitter = (Math.random() - 0.5) * 1.5;

        data[i * 4 + 0] = node.x + microJitter;
        data[i * 4 + 1] = node.y + microJitter;
        data[i * 4 + 2] = (Math.random() - 0.5) * 4.0;
        data[i * 4 + 3] = node.density;
      }
    } else {
      // Stochastic Stipple (Risograph Spray):
      // Core stroke has high concentration, dropping off into stippled scatter at perimeters
      for (let i = 0; i < particleCount; i++) {
        // 75% sampled from core stroke with jitter, 25% from outer stipple perimeter
        const isCore = Math.random() < 0.72 && strokeCandidates.length > 0;
        const pool = isCore ? strokeCandidates : allCandidates;
        const chosen = pool[Math.floor(Math.random() * pool.length)];

        // Stochastic dispersion jitter based on local density
        const scatterRadius = isCore
          ? (Math.random() - 0.5) * 5.0
          : (Math.random() - 0.5) * 22.0 * (1.05 - chosen.density);

        data[i * 4 + 0] = chosen.x + scatterRadius;
        data[i * 4 + 1] = chosen.y + scatterRadius;
        data[i * 4 + 2] = (Math.random() - 0.5) * 8.0;
        data[i * 4 + 3] = chosen.density;
      }
    }

    // True 3D body: replace the flat z micro-noise above with a real, measured
    // thickness over the same x/y footprint. Applied last so the planar law —
    // and therefore the face-on drawing — is untouched.
    if (this.volume.enabled && this.volume.depth > 0) {
      const fields = buildGlyphDepthFields(pixels, w, h);
      this.lastVolumeStats = applyGlyphVolume(
        data,
        particleCount,
        fields,
        worldScale,
        this.volume,
        hashString(`${glyphText}|${particleCount}|${style}`)
      );
    }

    const result = { data, center, subCenters };
    this.targetCache.set(cacheKey, result);
    return result;
  }

  /**
   * Bakes target textures for glyph A and glyph B (for morphing)
   * Automatically recognizes any user-typed string, special characters, or word pairs
   */
  public bakeTargets(
    glyphInput: string | string[],
    particleCount: number,
    texWidth: number,
    texHeight: number,
    style: 'stipple' | 'halftone',
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900
  ): BakeResult {
    let textA = 'O';
    let textB = 'I';

    if (Array.isArray(glyphInput)) {
      textA = glyphInput[0] || 'O';
      textB = glyphInput[1] || textA;
    } else if (typeof glyphInput === 'string') {
      const trimmed = glyphInput.trim();
      // Check if user separated with space, comma, slash, or arrow
      const splitTokens = trimmed.split(/[\s,⇄→/\-_|]+/).filter(Boolean);
      if (splitTokens.length >= 2) {
        textA = splitTokens[0];
        textB = splitTokens[1];
      } else if (splitTokens.length === 1) {
        const token = splitTokens[0];
        if (token.length >= 2 && Array.from(token).length === 2) {
          // Exactly 2 unicode glyphs like "OI" or "✦✧"
          const chars = Array.from(token);
          textA = chars[0];
          textB = chars[1];
        } else {
          // Single word or symbol (e.g. "VOID", "✦", "§")
          textA = token;
          textB = token;
        }
      }
    }

    const resA = this.generateTargetData(textA, particleCount, texWidth, texHeight, style, fontFamily, fontWeight);
    const resB = this.generateTargetData(textB, particleCount, texWidth, texHeight, style, fontFamily, fontWeight);

    const texA = new THREE.DataTexture(
      resA.data,
      texWidth,
      texHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;

    const texB = new THREE.DataTexture(
      resB.data,
      texWidth,
      texHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;

    // Vortex center lies in the corridor bridging the two glyphs
    const vortexCenter = new THREE.Vector2(
      (resA.center.x + resB.center.x) * 0.5,
      (resA.center.y + resB.center.y) * 0.5
    );

    // Aggregate unique attractor center poles from both letterforms
    const rawAttractors = [...resA.subCenters, ...resB.subCenters];
    const uniqueAttractors: THREE.Vector2[] = [];
    for (const pt of rawAttractors) {
      const isDuplicate = uniqueAttractors.some((u) => u.distanceTo(pt) < 15);
      if (!isDuplicate) {
        uniqueAttractors.push(pt);
      }
    }

    // Ensure at least 2 distinct attractor poles for orbital mechanics
    if (uniqueAttractors.length < 2) {
      uniqueAttractors.push(new THREE.Vector2(-140, 0));
      uniqueAttractors.push(new THREE.Vector2(140, 0));
    }

    return {
      textureA: texA,
      textureB: texB,
      centerA: resA.center,
      centerB: resB.center,
      vortexCenter,
      attractorCenters: uniqueAttractors.slice(0, 6),
    };
  }

  /**
   * Vector-based drawing of sacred geometric yantras for the 7 primary chakras
   */
  /**
   * Helper to draw authentic pointed lotus petals for sacred yantras
   */
  private drawLotusPetals(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    count: number,
    phase = 0
  ) {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const midAngle = i * step + phase;
      const halfAngle = step * 0.48;
      const leftAngle = midAngle - halfAngle;
      const rightAngle = midAngle + halfAngle;

      const p1x = cx + Math.cos(leftAngle) * innerR;
      const p1y = cy + Math.sin(leftAngle) * innerR;

      const tipX = cx + Math.cos(midAngle) * outerR;
      const tipY = cy + Math.sin(midAngle) * outerR;

      const p2x = cx + Math.cos(rightAngle) * innerR;
      const p2y = cy + Math.sin(rightAngle) * innerR;

      const ctrlDist = innerR + (outerR - innerR) * 0.58;
      const c1x = cx + Math.cos(midAngle - halfAngle * 0.35) * ctrlDist;
      const c1y = cy + Math.sin(midAngle - halfAngle * 0.35) * ctrlDist;

      const c2x = cx + Math.cos(midAngle + halfAngle * 0.35) * ctrlDist;
      const c2y = cy + Math.sin(midAngle + halfAngle * 0.35) * ctrlDist;

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.quadraticCurveTo(c1x, c1y, tipX, tipY);
      ctx.quadraticCurveTo(c2x, c2y, p2x, p2y);
      ctx.stroke();
    }
  }

  /**
   * Vector-based drawing of sacred geometric yantras for the 7 primary chakras.
   * Pure sacred geometric mandala contours, sanctum rings, triangles, and bindus.
   */
  public drawSacredYantra(
    ctx: CanvasRenderingContext2D,
    chakraId: string,
    cx: number,
    cy: number,
    radius: number,
    isHarmonicB = false
  ) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(3.5, radius * 0.042);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const breath = isHarmonicB ? 1.08 : 1.0;
    const r = radius * breath;

    switch (chakraId) {
      case 'muladhara': {
        // Root Chakra Yantra: 4 Pointed Lotus Petals, Earth Bhupura Square, Inverted Shakti Triangle & Bindu
        const outerR = r * 0.95;
        const innerR = r * 0.68;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 4, -Math.PI / 2);

        // Circular boundary ring
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        // Earth Square (Bhur mandala)
        const sqSize = innerR * 1.08;
        const halfSq = sqSize / 2;
        ctx.strokeRect(cx - halfSq, cy - halfSq, sqSize, sqSize);

        // Inner nested boundary
        ctx.strokeRect(cx - halfSq * 0.82, cy - halfSq * 0.82, sqSize * 0.82, sqSize * 0.82);

        // Downward Inverted Triangle (Tejas / Shakti)
        const triR = sqSize * 0.36;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Central luminous Bindu dot
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'svadhisthana': {
        // Sacral Chakra Yantra: 6 Pointed Lotus Petals, Outer Rings, Water Crescent Moon & Bindu
        const outerR = r * 0.96;
        const innerR = r * 0.70;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 6, 0);

        // Outer and inner rings
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.82, 0, Math.PI * 2);
        ctx.stroke();

        // Crescent Moon (Chandra mandala)
        const moonR = innerR * 0.62;
        ctx.beginPath();
        ctx.arc(cx, cy + moonR * 0.15, moonR, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.arc(cx, cy - moonR * 0.22, moonR * 0.85, 0.82 * Math.PI, 0.18 * Math.PI, true);
        ctx.closePath();
        ctx.stroke();

        // Central water Bindu
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'manipura': {
        // Solar Plexus Chakra Yantra: 10 Pointed Lotus Petals, Fire Inverted Triangle & Concentric Nested Triangle
        const outerR = r * 0.96;
        const innerR = r * 0.72;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 10, -Math.PI / 2);

        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Primary Inverted Fire Triangle (Agni Trikona)
        const triR = innerR * 0.76;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Inner nested triangle for sacred geometric depth
        const triInner = triR * 0.54;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triInner);
        ctx.lineTo(cx + triInner * 0.866, cy - triInner * 0.5);
        ctx.lineTo(cx - triInner * 0.866, cy - triInner * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Central radiant solar Bindu
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.085, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'anahata': {
        // Heart Chakra Yantra: 12 Pointed Lotus Petals, Shatkona (Hexagram / 6-pointed star) & Bindu
        const outerR = r * 0.98;
        const innerR = r * 0.74;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 12, 0);

        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.88, 0, Math.PI * 2);
        ctx.stroke();

        // Shatkona: Two interlocking equilateral triangles (Shiva + Shakti)
        const starR = innerR * 0.75;
        // Upward triangle (Spirit / Shiva)
        ctx.beginPath();
        ctx.moveTo(cx, cy - starR);
        ctx.lineTo(cx + starR * 0.866, cy + starR * 0.5);
        ctx.lineTo(cx - starR * 0.866, cy + starR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Downward triangle (Nature / Shakti)
        ctx.beginPath();
        ctx.moveTo(cx, cy + starR);
        ctx.lineTo(cx + starR * 0.866, cy - starR * 0.5);
        ctx.lineTo(cx - starR * 0.866, cy - starR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Central circular sanctum
        ctx.beginPath();
        ctx.arc(cx, cy, starR * 0.35, 0, Math.PI * 2);
        ctx.stroke();

        // Central luminous Bindu (Ananda Kanda)
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'vishuddha': {
        // Throat Chakra Yantra: 16 Pointed Lotus Petals, Outer Rings, Inverted Triangle & Etheric Bindu
        const outerR = r * 0.98;
        const innerR = r * 0.75;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 16, 0);

        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // Inverted triangle
        const triR = innerR * 0.65;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Full etheric sphere / Akasha circle
        ctx.beginPath();
        ctx.arc(cx, cy, triR * 0.42, 0, Math.PI * 2);
        ctx.stroke();

        // Central Bindu
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'ajna': {
        // Third Eye Chakra Yantra: 2 Winged Lateral Lotus Petals, Sanctum Circle, Inverted Triangle & Eye Pupil Bindu
        const wingR = r * 1.05;
        const centerR = r * 0.42;

        // Left Wing Petal
        ctx.beginPath();
        ctx.moveTo(cx, cy - centerR);
        ctx.quadraticCurveTo(cx - wingR * 0.7, cy - centerR * 0.9, cx - wingR, cy);
        ctx.quadraticCurveTo(cx - wingR * 0.7, cy + centerR * 0.9, cx, cy + centerR);
        ctx.stroke();

        // Left Wing inner feather line
        ctx.beginPath();
        ctx.moveTo(cx - centerR * 0.6, cy);
        ctx.lineTo(cx - wingR * 0.85, cy);
        ctx.stroke();

        // Right Wing Petal
        ctx.beginPath();
        ctx.moveTo(cx, cy - centerR);
        ctx.quadraticCurveTo(cx + wingR * 0.7, cy - centerR * 0.9, cx + wingR, cy);
        ctx.quadraticCurveTo(cx + wingR * 0.7, cy + centerR * 0.9, cx, cy + centerR);
        ctx.stroke();

        // Right Wing inner feather line
        ctx.beginPath();
        ctx.moveTo(cx + centerR * 0.6, cy);
        ctx.lineTo(cx + wingR * 0.85, cy);
        ctx.stroke();

        // Central Sanctum Circle
        ctx.beginPath();
        ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
        ctx.stroke();

        // Inverted sacred triangle
        const triR = centerR * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();

        // Radiant Third Eye Pupil / Bindu
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'sahasrara':
      default: {
        // Crown Chakra Yantra: Thousand-Petaled Lotus (24 outer petals + 12 middle petals), Concentric Rings & 12-Spoke Sun Wheel
        const rOuter = r * 0.98;
        const rMid = r * 0.76;
        const rInner = r * 0.54;

        // Layer 1: Outer 24 pointed petals
        this.drawLotusPetals(ctx, cx, cy, rMid, rOuter, 24, 0);

        // Layer 2: Middle 12 pointed petals
        this.drawLotusPetals(ctx, cx, cy, rInner, rMid, 12, Math.PI / 12);

        // Concentric sacred boundary rings
        ctx.beginPath();
        ctx.arc(cx, cy, rMid, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
        ctx.stroke();

        // 12-Spoke Radiant Sun Wheel (Dharma Chakra)
        const spokeCount = 12;
        const spokeRot = isHarmonicB ? Math.PI / 12 : 0;
        for (let s = 0; s < spokeCount; s++) {
          const ang = (s * Math.PI * 2) / spokeCount + spokeRot;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * (r * 0.14), cy + Math.sin(ang) * (r * 0.14));
          ctx.lineTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
          ctx.stroke();
        }

        // Concentric hub ring
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
        ctx.stroke();

        // Transcendental innermost Bindu
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Renders a specific node enforcing the sacred yantra geometric form
   */
  public rasterizeSpatialNode(
    node: SpatialChakraNode,
    glyphType: SpatialChakraGlyphType = 'yantra',
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900,
    variant: 'yantraA' | 'yantraB' = 'yantraA'
  ): { candidates: SampleCandidate[] } {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const shapeKey = `${node.shape}|${node.glyphText ?? ''}|${node.id}|${fontWeight}|${fontFamily}`;

    if (node.shape === 'glyph') {
      // Free glyph / word anchor: render text scaled to the anchor cell
      const text = (node.glyphText || node.symbol || node.seedSyllable || 'O').trim() || 'O';
      let fontSize = Math.floor(h * 0.7);
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const measured = ctx.measureText(text);
      const maxW = w * 0.9;
      if (measured.width > maxW) {
        fontSize = Math.max(24, Math.floor(fontSize * (maxW / measured.width)));
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, cx, cy);
    } else {
      // Enforce pure sacred yantra geometric form for chakra anchors
      this.drawSacredYantra(ctx, node.id, cx, cy, h * 0.38, variant === 'yantraB');
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const pixels = imgData.data;
    const candidates: SampleCandidate[] = [];

    // True 3D body: a distance transform of the drawn mark gives every cell its
    // penetration depth, which becomes a real half-thickness. Off by default, so
    // the classic flat pool is unchanged.
    const volumeOn = this.volume.enabled && this.volume.depth > 0;
    let fields: GlyphDepthFields | null = null;
    if (volumeOn) {
      const cacheKey = `${shapeKey}|${w}x${h}`;
      fields = this.depthFieldsCache.get(cacheKey) ?? null;
      if (!fields) {
        fields = buildGlyphDepthFields(pixels, w, h);
        this.depthFieldsCache.set(cacheKey, fields);
        if (this.depthFieldsCache.size > 12) {
          const oldest = this.depthFieldsCache.keys().next().value;
          if (oldest !== undefined) this.depthFieldsCache.delete(oldest);
        }
      }
    }

    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255.0;
        if (alpha > 0.05) {
          const cand: SampleCandidate = {
            x: x - cx,
            y: -(y - cy),
            density: alpha,
          };
          if (fields) {
            const cell = y * w + x;
            const shape = cellVolumeShape(
              fields.distInside[cell],
              fields.distToInk[cell],
              fields.referenceThickness,
              alpha,
              this.volume
            );
            cand.hz = shape.half;
            cand.cw = shape.contourness;
          }
          candidates.push(cand);
        }
      }
    }

    if (candidates.length === 0) {
      for (let i = 0; i < 500; i++) {
        const ang = (i / 500) * Math.PI * 2;
        const rad = 100 + (Math.random() - 0.5) * 20;
        candidates.push({
          x: Math.cos(ang) * rad,
          y: Math.sin(ang) * rad,
          density: 0.8,
        });
      }
    }

    return { candidates };
  }

  /** Generic authored cymatic target. No chakra lookup or semantic correspondence. */
  public sampleCymaticTemplate(
    spec:{frequencyHz:number;plateGeometry?:CymaticPlateGeometry;dimension?:CymaticDimension;m?:number;n?:number;l?:number;a?:number;b?:number;baseFrequency?:number},
    coherence:number=1,
    chaos:number=0
  ):{candidates:Array<{x:number;y:number;z?:number;density:number}>;is3D:boolean}{
    const derived=deriveCymaticTemplateModes(spec.frequencyHz,spec.baseFrequency??40);
    const m=spec.m??derived.m,n=spec.n??derived.n,l=spec.l??derived.l,a=spec.a??derived.a,b=spec.b??derived.b;
    const geometry=spec.plateGeometry??'square',dimension=spec.dimension??'2D';
    if(dimension==='3D'||geometry==='volumetric3D'){return{candidates:sampleVolumetric3DNodalPoints(12000,l,m,n,coherence,chaos,280),is3D:true};}
    const w=this.canvas.width,h=this.canvas.height,ctx=this.ctx;
    renderChladniPlate(ctx,w,h,geometry,m,n,a,b,coherence,chaos);
    const pixels=ctx.getImageData(0,0,w,h).data,candidates:Array<{x:number;y:number;z?:number;density:number;hz?:number;cw?:number}>=[],cx=w/2,cy=h/2;
    // True 3D body over the standing-wave pattern: the nodal lines extrude with
    // the same measured thickness law as letterforms and image masks.
    const volumeOn=this.volume.enabled&&this.volume.depth>0;
    const fields=volumeOn?buildGlyphDepthFields(pixels,w,h):null;
    for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const idx=(y*w+x)*4,alpha=pixels[idx+3]/255;if(alpha>.05){const cand:{x:number;y:number;z?:number;density:number;hz?:number;cw?:number}={x:x-cx,y:-(y-cy),z:0,density:alpha};if(fields){const shape=cellVolumeShape(fields.distInside[y*w+x],fields.distToInk[y*w+x],fields.referenceThickness,alpha,this.volume);cand.hz=shape.half;cand.cw=shape.contourness;}candidates.push(cand);}}
    if(!candidates.length)for(let i=0;i<500;i++){const ang=i/500*Math.PI*2;candidates.push({x:Math.cos(ang)*120,y:Math.sin(ang)*120,z:0,density:.8});}
    return{candidates,is3D:false};
  }

  /**
   * @deprecated Legacy semantic wrapper. New authored geometry uses sampleCymaticTemplate().
   */
  public sampleCymaticNode(
    node: SpatialChakraNode,
    plateGeometry: CymaticPlateGeometry = 'square',
    dimension: CymaticDimension = '2D',
    coherence: number = 1.0,
    chaos: number = 0.0,
    frequencyOverride?: number
  ): {
    candidates: Array<{ x: number; y: number; z?: number; density: number }>;
    is3D: boolean;
  } {
    const freq = frequencyOverride ?? node.frequencyHz ?? 396;
    const profile =
      CHAKRA_CYMATIC_PROFILES.find(
        (p) => p.chakraId === node.id || p.frequencyHz === freq
      ) || CHAKRA_CYMATIC_PROFILES[0];

    if (dimension === '3D' || plateGeometry === 'volumetric3D') {
      const pts = sampleVolumetric3DNodalPoints(
        12000,
        profile.volumetricL,
        profile.volumetricM,
        profile.volumetricN,
        coherence,
        chaos,
        280
      );
      return { candidates: pts, is3D: true };
    }

    // 2D Chladni plate rasterization
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    renderChladniPlate(
      ctx,
      w,
      h,
      plateGeometry,
      profile.squareM,
      profile.squareN,
      profile.squareA,
      profile.squareB,
      coherence,
      chaos
    );

    const imgData = ctx.getImageData(0, 0, w, h);
    const pixels = imgData.data;
    const candidates: Array<{ x: number; y: number; z?: number; density: number }> = [];
    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255.0;
        if (alpha > 0.05) {
          candidates.push({
            x: x - cx,
            y: -(y - cy),
            z: 0,
            density: alpha,
          });
        }
      }
    }

    if (candidates.length === 0) {
      for (let i = 0; i < 500; i++) {
        const ang = (i / 500) * Math.PI * 2;
        candidates.push({
          x: Math.cos(ang) * 120,
          y: Math.sin(ang) * 120,
          z: 0,
          density: 0.8,
        });
      }
    }

    return { candidates, is3D: false };
  }

  /**
   * Bakes target textures for sequential Kundalini spatial morphing (Node A in space -> Node B in space)
   */
  public bakeChakraSequentialTargets(
    nodeA: SpatialChakraNode,
    nodeB: SpatialChakraNode,
    particleCount: number,
    texWidth: number,
    texHeight: number,
    style: 'stipple' | 'halftone' = 'stipple',
    glyphType: SpatialChakraGlyphType = 'yantra',
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900,
    plane: SpatialChakraPlane = 'horizontal',
    geometryMode: ChakraGeometryMode = 'yantra',
    cymatics?: CymaticsConfig
  ): BakeResult {
    const isCymatics = geometryMode === 'cymatics';
    const nodeIsCymatic = (n: SpatialChakraNode) => n.shape === 'cymatic' || (isCymatics && n.shape !== 'glyph' && n.shape !== 'yantra');
    const resA = nodeIsCymatic(nodeA)
      ? this.sampleCymaticNode(nodeA, cymatics?.plateGeometry, cymatics?.dimension, 1.0, 0.0)
      : { ...this.rasterizeSpatialNode(nodeA, glyphType, fontFamily, fontWeight, 'yantraA'), is3D: false };
    const resB = nodeIsCymatic(nodeB)
      ? this.sampleCymaticNode(nodeB, cymatics?.plateGeometry, cymatics?.dimension, 1.0, 0.0)
      : { ...this.rasterizeSpatialNode(nodeB, glyphType, fontFamily, fontWeight, 'yantraA'), is3D: false };

    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);

    const countA = resA.candidates.length;
    const countB = resB.candidates.length;

    const scaleA = nodeA.scale ?? 0.20;
    const scaleB = nodeB.scale ?? 0.20;

    for (let i = 0; i < particleCount; i++) {
      const pA = resA.candidates[i % countA];
      const pB = resB.candidates[i % countB];

      if (resA.is3D || cymatics?.dimension === '3D') {
        // Volumetric 3D standing wave nodal cage
        const jAx = (Math.random() - 0.5) * 2;
        const jAy = (Math.random() - 0.5) * 2;
        const jAz = (Math.random() - 0.5) * 2;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jAx;
        dataA[i * 4 + 1] = pA.y * scaleA - nodeA.y + jAy;
        dataA[i * 4 + 2] = (pA.z ?? 0) * scaleA + jAz;
        dataA[i * 4 + 3] = pA.density;

        const jBx = (Math.random() - 0.5) * 2;
        const jBy = (Math.random() - 0.5) * 2;
        const jBz = (Math.random() - 0.5) * 2;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jBx;
        dataB[i * 4 + 1] = pB.y * scaleB - nodeB.y + jBy;
        dataB[i * 4 + 2] = (pB.z ?? 0) * scaleB + jBz;
        dataB[i * 4 + 3] = pB.density;
      } else if (plane === 'horizontal') {
        // Horizontal Transverse Plane: flat when viewed horizontally
        const jAx = (Math.random() - 0.5) * 2;
        const jAz = (Math.random() - 0.5) * 2;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jAx;
        dataA[i * 4 + 1] = -nodeA.y;
        dataA[i * 4 + 2] = pA.y * scaleA + jAz;
        dataA[i * 4 + 3] = pA.density;

        const jBx = (Math.random() - 0.5) * 2;
        const jBz = (Math.random() - 0.5) * 2;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jBx;
        dataB[i * 4 + 1] = -nodeB.y;
        dataB[i * 4 + 2] = pB.y * scaleB + jBz;
        dataB[i * 4 + 3] = pB.density;
      } else {
        // Vertical Coronal Plane
        const jitterAx = (Math.random() - 0.5) * 3;
        const jitterAy = (Math.random() - 0.5) * 3;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jitterAx;
        dataA[i * 4 + 1] = pA.y * scaleA - nodeA.y + jitterAy;
        dataA[i * 4 + 2] = (Math.random() - 0.5) * 8;
        dataA[i * 4 + 3] = pA.density;

        const jitterBx = (Math.random() - 0.5) * 3;
        const jitterBy = (Math.random() - 0.5) * 3;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jitterBx;
        dataB[i * 4 + 1] = pB.y * scaleB - nodeB.y + jitterBy;
        dataB[i * 4 + 2] = (Math.random() - 0.5) * 8;
        dataB[i * 4 + 3] = pB.density;
      }
    }

    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;

    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;

    const vortexCenter = new THREE.Vector2(
      (nodeA.x + nodeB.x) * 0.5,
      (-nodeA.y - nodeB.y) * 0.5
    );

    const attractorCenters = [
      new THREE.Vector2(nodeA.x, -nodeA.y),
      new THREE.Vector2(nodeB.x, -nodeB.y),
    ];

    return {
      textureA: texA,
      textureB: texB,
      centerA: new THREE.Vector2(nodeA.x, -nodeA.y),
      centerB: new THREE.Vector2(nodeB.x, -nodeB.y),
      vortexCenter,
      attractorCenters,
    };
  }

  /**
   * Bakes target textures for simultaneous Chakra Subtle Body constellation.
   * Particles are partitioned across all active spatial nodes.
   * Target A = Seed syllable representation; Target B = Sacred Yantra representation.
   */
  public bakeChakraSimultaneousTargets(
    nodes: SpatialChakraNode[],
    particleCount: number,
    texWidth: number,
    texHeight: number,
    style: 'stipple' | 'halftone' = 'stipple',
    glyphType: SpatialChakraGlyphType = 'both',
    fontFamily: string = FALLBACK_FONT_STACK,
    fontWeight: string | number = 900,
    plane: SpatialChakraPlane = 'horizontal',
    geometryMode: ChakraGeometryMode = 'yantra',
    cymatics?: CymaticsConfig
  ): BakeResult {
    const isCymatics = geometryMode === 'cymatics';
    const activeNodes = nodes.filter((n) => n.active);
    const validNodes = activeNodes.length > 0 ? activeNodes : nodes;
    const K = validNodes.length;

    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);

    const particlesPerNode = Math.floor(particleCount / K);

    const attractorCenters: THREE.Vector2[] = [];
    let sumX = 0;
    let sumY = 0;

    for (let k = 0; k < K; k++) {
      const node = validNodes[k];
      attractorCenters.push(new THREE.Vector2(node.x, -node.y));
      sumX += node.x;
      sumY += -node.y;

      const nodeCym = node.shape === 'cymatic' || (isCymatics && node.shape !== 'glyph' && node.shape !== 'yantra');
      const resA = nodeCym
        ? this.sampleCymaticNode(node, cymatics?.plateGeometry, cymatics?.dimension, 1.0, 0.0)
        : { ...this.rasterizeSpatialNode(node, glyphType, fontFamily, fontWeight, 'yantraA'), is3D: false };
      const resB = nodeCym
        ? this.sampleCymaticNode(node, cymatics?.plateGeometry, cymatics?.dimension, 0.95, 0.1)
        : { ...this.rasterizeSpatialNode(node, glyphType, fontFamily, fontWeight, 'yantraB'), is3D: false };

      const startIndex = k * particlesPerNode;
      const endIndex = k === K - 1 ? particleCount : (k + 1) * particlesPerNode;
      const countA = resA.candidates.length;
      const countB = resB.candidates.length;

      const nodeScale = node.scale ?? 0.20;

      for (let i = startIndex; i < endIndex; i++) {
        const localIdx = i - startIndex;
        const pA = resA.candidates[localIdx % countA];
        const pB = resB.candidates[localIdx % countB];

        if (resA.is3D || cymatics?.dimension === '3D') {
          // Volumetric 3D
          const jAx = (Math.random() - 0.5) * 2;
          const jAy = (Math.random() - 0.5) * 2;
          const jAz = (Math.random() - 0.5) * 2;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = pA.y * nodeScale - node.y + jAy;
          dataA[i * 4 + 2] = (pA.z ?? 0) * nodeScale + jAz;
          dataA[i * 4 + 3] = pA.density;

          const jBx = (Math.random() - 0.5) * 2;
          const jBy = (Math.random() - 0.5) * 2;
          const jBz = (Math.random() - 0.5) * 2;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = pB.y * nodeScale - node.y + jBy;
          dataB[i * 4 + 2] = (pB.z ?? 0) * nodeScale + jBz;
          dataB[i * 4 + 3] = pB.density;
        } else if (plane === 'horizontal') {
          // Horizontal Transverse Plane: flat when seen horizontally
          const jAx = (Math.random() - 0.5) * 2;
          const jAz = (Math.random() - 0.5) * 2;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = -node.y; // Flat on horizontal plane!
          dataA[i * 4 + 2] = pA.y * nodeScale + jAz;
          dataA[i * 4 + 3] = pA.density;

          const jBx = (Math.random() - 0.5) * 2;
          const jBz = (Math.random() - 0.5) * 2;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = -node.y;
          dataB[i * 4 + 2] = pB.y * nodeScale + jBz;
          dataB[i * 4 + 3] = pB.density;
        } else {
          // Vertical Coronal Plane
          const jAx = (Math.random() - 0.5) * 3;
          const jAy = (Math.random() - 0.5) * 3;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = pA.y * nodeScale - node.y + jAy;
          dataA[i * 4 + 2] = (Math.random() - 0.5) * 8;
          dataA[i * 4 + 3] = pA.density;

          const jBx = (Math.random() - 0.5) * 3;
          const jBy = (Math.random() - 0.5) * 3;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = pB.y * nodeScale - node.y + jBy;
          dataB[i * 4 + 2] = (Math.random() - 0.5) * 8;
          dataB[i * 4 + 3] = pB.density;
        }
      }
    }

    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;

    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;

    const vortexCenter = new THREE.Vector2(sumX / K, sumY / K);

    return {
      textureA: texA,
      textureB: texB,
      centerA: vortexCenter.clone(),
      centerB: vortexCenter.clone(),
      vortexCenter,
      attractorCenters: attractorCenters.slice(0, 10),
    };
  }

  /**
   * Samples pixel density from a custom user image through the shared
   * normalization law (background estimate, polarity, crop, mode shaping).
   * When the true-3D body law is on, candidates carry the measured thickness
   * of the image mask, so an image extrudes exactly like a letterform.
   */
  public rasterizeCustomImage(
    img: CanvasImageSource | ImageData,
    options: {
      mode?: 'luminance' | 'edgeSobel' | 'silhouette';
      threshold?: number;
      invert?: boolean;
      scale?: number;
    } = {}
  ): {
    candidates: Array<{ x: number; y: number; density: number; hz?: number; cw?: number }>;
    center: THREE.Vector2;
    analysis: SourceAnalysis;
  } {
    const { px, w, h } = this.drawToWorkBuffer(img);
    const sampled = sampleImageSource(px, w, h, { ...options, volume: this.volume });
    return { candidates: sampled.candidates, center: new THREE.Vector2(0, 0), analysis: sampled.analysis };
  }

  /** Bounded working copy: sampling never touches raw source resolution. */
  private drawToWorkBuffer(img: CanvasImageSource | ImageData): { px: Uint8ClampedArray; w: number; h: number } {
    const naturalW = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || (img as ImageData).width || SOURCE_WORK_MAX;
    const naturalH = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || (img as ImageData).height || SOURCE_WORK_MAX;
    const fit = Math.min(1, SOURCE_WORK_MAX / Math.max(naturalW, naturalH));
    const w = Math.max(2, Math.round(naturalW * fit));
    const h = Math.max(2, Math.round(naturalH * fit));
    const work = this.workCanvas.getContext('2d', { willReadFrequently: true });
    if (!work) throw new Error('Failed to create offscreen 2D canvas context for source sampling');
    if (this.workCanvas.width !== w || this.workCanvas.height !== h) {
      this.workCanvas.width = w;
      this.workCanvas.height = h;
    }
    work.clearRect(0, 0, w, h);
    if (img instanceof ImageData) {
      work.putImageData(img, 0, 0);
      const drawn = work.getImageData(0, 0, w, h);
      return { px: drawn.data, w, h };
    }
    work.drawImage(img, 0, 0, w, h);
    const drawn = work.getImageData(0, 0, w, h);
    return { px: drawn.data, w, h };
  }

  /**
   * Samples pixel density from multi-line ASCII art text through the same
   * normalization law as images (crop, stage units, density = alpha).
   */
  public rasterizeAscii(
    asciiText: string,
    options: {
      fontFamily?: string;
      fontSize?: number;
      invert?: boolean;
    } = {}
  ): {
    candidates: Array<{ x: number; y: number; density: number; hz?: number; cw?: number }>;
    center: THREE.Vector2;
    analysis: SourceAnalysis;
  } {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const {lines,fontSize,charWidth,lineHeight}=asciiLayout(asciiText,w,h,options.fontSize);
    const maxLineLen=Math.max(1,...lines.map(l=>Array.from(l).length));const numLines=lines.length;
    ctx.font = `bold ${fontSize}px ${options.fontFamily || '"Fira Code", "Courier New", Courier, monospace'}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    const totalW = maxLineLen * charWidth;
    const totalH = numLines * lineHeight;

    const startX = (w - totalW) / 2;
    const startY = (h - totalH) / 2 + lineHeight / 2;

    for (let r = 0; r < lines.length; r++) {
      ctx.fillText(lines[r], startX, startY + r * lineHeight);
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const sampled = sampleAlphaSource(imgData.data, w, h, {
      invert: options.invert,
      volume: this.volume,
      // Preserve the actual typed contours, including sparse strokes and spaces.
      cell: { w: charWidth, h: lineHeight },
    });
    return { candidates: sampled.candidates, center: new THREE.Vector2(0, 0), analysis: sampled.analysis };
  }

  /**
   * Bakes target textures from arbitrary candidate points
   */
  public bakeCandidatePoolToTargets(
    candidatesA: Array<{ x: number; y: number; z?: number; density: number }>,
    candidatesB: Array<{ x: number; y: number; z?: number; density: number }>,
    particleCount: number,
    texWidth: number,
    texHeight: number,
    style: 'stipple' | 'halftone' = 'stipple'
  ): BakeResult {
    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);

    const countA = candidatesA.length;
    const countB = candidatesB.length;

    for (let i = 0; i < particleCount; i++) {
      const pA = candidatesA[i % countA];
      const pB = candidatesB[i % countB];

      const jAx = style === 'halftone' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5.0;
      const jAy = style === 'halftone' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5.0;
      dataA[i * 4 + 0] = pA.x + jAx;
      dataA[i * 4 + 1] = pA.y + jAy;
      dataA[i * 4 + 2] = (pA.z ?? 0) + (Math.random() - 0.5) * 4.0;
      dataA[i * 4 + 3] = pA.density;

      const jBx = style === 'halftone' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5.0;
      const jBy = style === 'halftone' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5.0;
      dataB[i * 4 + 0] = pB.x + jBx;
      dataB[i * 4 + 1] = pB.y + jBy;
      dataB[i * 4 + 2] = (pB.z ?? 0) + (Math.random() - 0.5) * 4.0;
      dataB[i * 4 + 3] = pB.density;
    }

    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;

    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;

    const zero = new THREE.Vector2(0, 0);
    return {
      textureA: texA,
      textureB: texB,
      centerA: zero.clone(),
      centerB: zero.clone(),
      vortexCenter: zero.clone(),
      attractorCenters: [zero.clone()],
    };
  }

  public destroy() {
    this.targetCache.clear();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
