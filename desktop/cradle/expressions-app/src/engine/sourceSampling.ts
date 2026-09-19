/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * sourceSampling — normalized image/ASCII → particle-candidate sampling.
 *
 * Every embedded source (photo, line art, transparent cutout, ASCII drawing)
 * passes through the same normalization law before it becomes formation
 * geometry:
 *
 *  1. Background estimation from the border ring (luminance + alpha).
 *  2. Ink polarity — auto-detected (dark ink on light paper, or light ink on
 *     dark paper) so a black-on-white drawing samples its strokes, not its
 *     paper. A legacy explicit `invert` still forces the polarity.
 *  3. Content crop to the ink bounding box, so margins never dilute the
 *     sampling resolution and `scale` means the size of the actual content.
 *  4. Mode shaping — ink luminance, Sobel edges, or a true silhouette cutout
 *     (border flood fill: enclosed regions such as dark eyes belong to the
 *     subject, not the background).
 *  5. Candidate emission in stage units: the content bbox is mapped uniformly
 *     to a 400-unit box (`norm:'stage400'`), centred on the origin, y up.
 *     Entity width/height then carry the display aspect, exactly as for glyphs.
 *  6. True-3D body — when the glyph volume law is on, every emitted candidate
 *     also carries its place in the solid (`hz` half-thickness, `cw` flank
 *     weight), measured by the same distance transform letterforms use. An
 *     image mask or typed drawing therefore extrudes exactly like a glyph.
 *
 * The module is DOM-free so the engine and the Node test-suite share one law.
 * DOM decoding lives with the callers (GlyphSampler, UI preview).
 */

import {
  buildDepthFieldsFromMask,
  cellVolumeShape,
  type GlyphDepthFields,
} from './glyphVolume';
import type {GlyphVolumeConfig} from './types';

export type SourceMode = 'luminance' | 'edgeSobel' | 'silhouette';
/** Internal mode: ink equals alpha (ASCII drawings rasterized white-on-transparent). */
export type InternalMode = SourceMode | 'alpha';

export interface SourceSampleOptions {
	mode?: InternalMode;
	/** 0..1 minimum ink strength that gathers particles. */
	threshold?: number;
	/** Legacy explicit polarity: true forces dark ink on light paper. */
	invert?: boolean;
	/** Display scale multiplier applied to emitted stage units. */
	scale?: number;
	/** Soft cap on emitted candidates. */
	maxCandidates?: number;
	/** True-3D body law: when enabled and `depth > 0`, candidates carry `hz`/`cw`. */
	volume?: GlyphVolumeConfig;
}

/** One sampled source point. `hz`/`cw` are present only under the volume law. */
export interface SourceCandidatePoint {
	x: number;
	y: number;
	density: number;
	/** Half-thickness of the solid at this cell, in body-law units. */
	hz?: number;
	/** 0..1 flank weight: 1 at the contour, 0 well inside it. */
	cw?: number;
}

export type SourceCandidatePool = Array<SourceCandidatePoint> & { norm?: 'stage400' };

export interface SourceAnalysis {
	mode: InternalMode;
	/** The threshold actually used (auto-recovered downward when nothing matched). */
	threshold: number;
	polarity: 'lightInk' | 'darkInk';
	polarityAuto: boolean;
	backgroundLuminance: number;
	backgroundIsTransparent: boolean;
	sourcePx: { w: number; h: number };
	contentPx: { w: number; h: number };
	/** Share of the content box whose ink reached the threshold. */
	coverage: number;
	candidates: number;
	/** True when nothing was detected and a visibility ring was emitted instead. */
	fallback: boolean;
}

export interface SampledSource {
	candidates: SourceCandidatePool;
	analysis: SourceAnalysis;
}

export interface InkField {
	width: number;
	height: number;
	ink: Float32Array;
	crop: { x0: number; y0: number; x1: number; y1: number };
	polarity: 'lightInk' | 'darkInk';
	polarityAuto: boolean;
	backgroundLuminance: number;
	backgroundIsTransparent: boolean;
}

/** Working-resolution cap: sampling runs on a bounded copy, never the raw pixels. */
export const SOURCE_WORK_MAX = 512;
export const DEFAULT_SOURCE_THRESHOLD = 0.24;
/** Ink bbox margin, as a fraction of the larger content dimension. */
const CROP_MARGIN = 0.02;
/** Floor that counts a pixel toward the content bounding box. */
const CROP_INK_FLOOR = 0.12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function median(values: number[]): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[sorted.length >> 1];
}

/** Oriented ink: how far a pixel sits from the estimated paper, 0..1. */
function orientedInk(lum: number, bg: number, polarity: 'lightInk' | 'darkInk'): number {
	if (polarity === 'darkInk') return clamp01((bg - lum) / Math.max(0.08, bg));
	return clamp01((lum - bg) / Math.max(0.08, 1 - bg));
}

/**
 * Normalizes raw RGBA pixels into an ink field: background estimate, polarity,
 * crop, and per-pixel ink strength in 0..1.
 */
export function computeInkField(
	px: Uint8ClampedArray | Uint8Array,
	w: number,
	h: number,
	options: SourceSampleOptions = {}
): InkField {
	const n = w * h;
	const mode = options.mode ?? 'luminance';

	// One strided pass collects border-ring statistics and alpha presence.
	const ringDepth = Math.max(2, Math.round(Math.min(w, h) * 0.04));
	const ringLum: number[] = [];
	const ringAlpha: number[] = [];
	let seesTransparency = false;
	const stride = Math.max(1, Math.round(Math.sqrt(n / 65536)));
	for (let y = 0; y < h; y += stride) {
		for (let x = 0; x < w; x += stride) {
			const onRing = x < ringDepth || y < ringDepth || x >= w - ringDepth || y >= h - ringDepth;
			const idx = (y * w + x) * 4;
			const a = px[idx + 3] / 255;
			if (a < 0.85) seesTransparency = true;
			if (!onRing) continue;
			ringAlpha.push(a);
			if (a > 0.05) {
				ringLum.push((px[idx] * 0.2126 + px[idx + 1] * 0.7152 + px[idx + 2] * 0.0722) / 255);
			}
		}
	}
	const bgAlpha = median(ringAlpha);
	const backgroundIsTransparent = mode !== 'alpha' && seesTransparency && bgAlpha < 0.5;
	const backgroundLuminance = clamp01(median(ringLum));

	let polarity: 'lightInk' | 'darkInk';
	let polarityAuto: boolean;
	if (options.invert === true) {
		polarity = 'darkInk';
		polarityAuto = false;
	} else if (backgroundIsTransparent || mode === 'alpha') {
		polarity = backgroundLuminance >= 0.5 ? 'darkInk' : 'lightInk';
		polarityAuto = true;
	} else {
		polarity = backgroundLuminance >= 0.5 ? 'darkInk' : 'lightInk';
		polarityAuto = true;
	}

	const buildInk = (flip: boolean): Float32Array => {
		const ink = new Float32Array(n);
		const effective = flip ? (polarity === 'darkInk' ? 'lightInk' : 'darkInk') : polarity;
		for (let i = 0; i < n; i++) {
			const a = px[i * 4 + 3] / 255;
			if (a <= 0.05) continue;
			if (backgroundIsTransparent || mode === 'alpha') {
				ink[i] = a;
			} else {
				const lum = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
				ink[i] = orientedInk(lum, backgroundLuminance, effective) * a;
			}
		}
		return ink;
	};

	let ink = buildInk(false);
	if (polarityAuto && !backgroundIsTransparent && mode !== 'alpha') {
		// A polarity guess that claims nearly everything is ink is a guess about a
		// blank or uniform frame; prefer the reading that isolates a minority.
		let swept = 0;
		const sampleStep = Math.max(1, Math.round(Math.sqrt(n / 20000)));
		for (let i = 0; i < n; i += sampleStep) if (ink[i] > CROP_INK_FLOOR) swept++;
		if (swept / Math.ceil(n / sampleStep) > 0.82) ink = buildInk(true);
	}

	const crop = inkBoundingBox(ink, w, h);
	return {
		width: w,
		height: h,
		ink,
		crop,
		polarity,
		polarityAuto,
		backgroundLuminance,
		backgroundIsTransparent,
	};
}

function inkBoundingBox(ink: Float32Array, w: number, h: number): InkField['crop'] {
	let x0 = w, y0 = h, x1 = -1, y1 = -1;
	for (let y = 0; y < h; y++) {
		const row = y * w;
		for (let x = 0; x < w; x++) {
			if (ink[row + x] > CROP_INK_FLOOR) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	}
	if (x1 < 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
	const margin = Math.round(Math.max(x1 - x0, y1 - y0) * CROP_MARGIN);
	return {
		x0: Math.max(0, x0 - margin),
		y0: Math.max(0, y0 - margin),
		x1: Math.min(w - 1, x1 + margin),
		y1: Math.min(h - 1, y1 + margin),
	};
}

/** Sobel magnitude over the ink field; strokes become ridges. */
function sobelInk(ink: Float32Array, w: number, h: number): Float32Array {
	const out = new Float32Array(ink.length);
	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const i = y * w + x;
			const tl = ink[i - w - 1], t = ink[i - w], tr = ink[i - w + 1];
			const l = ink[i - 1], r = ink[i + 1];
			const bl = ink[i + w - 1], b = ink[i + w], br = ink[i + w + 1];
			const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
			const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
			out[i] = clamp01(Math.sqrt(gx * gx + gy * gy) * 0.6);
		}
	}
	return out;
}

/**
 * Silhouette cutout: flood fill from the frame marks true background. Enclosed
 * background pockets stay with the subject only when they are substantial —
 * a portrait's inner face region fills solid, but the tiny sealed cells of a
 * wireframe mesh remain the open lattice the artist drew.
 */
function silhouetteInk(ink: Float32Array, w: number, h: number, threshold: number): Float32Array {
	const floor = Math.max(0.08, Math.min(0.6, threshold));
	const n = w * h;
	const background = new Uint8Array(n);
	const queue = new Int32Array(n);
	let head = 0, tail = 0;
	const push = (i: number) => {
		if (!background[i] && ink[i] < floor) {
			background[i] = 1;
			queue[tail++] = i;
		}
	};
	for (let x = 0; x < w; x++) {
		push(x);
		push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		push(y * w);
		push(y * w + w - 1);
	}
	while (head < tail) {
		const i = queue[head++];
		const x = i % w, y = (i / w) | 0;
		if (x > 0) push(i - 1);
		if (x < w - 1) push(i + 1);
		if (y > 0) push(i - w);
		if (y < h - 1) push(i + w);
	}

	// Label the unreached low-ink region (enclosed pockets; strokes are already
	// subject by definition); fill only roomy pockets.
	let cropArea = 0;
	for (let i = 0; i < n; i++) if (ink[i] > CROP_INK_FLOOR) cropArea++;
	const minPocket = Math.max(64, Math.round(cropArea * 0.006));
	const out = new Float32Array(ink);
	const label = new Int32Array(n).fill(-1);
	const compQueue = new Int32Array(n);
	const pocketFill: boolean[] = [];
	for (let start = 0; start < n; start++) {
		if (background[start] || ink[start] >= floor || label[start] >= 0) continue;
		const id = pocketFill.length;
		let head2 = 0, tail2 = 0, area = 0;
		label[start] = id;
		compQueue[tail2++] = start;
		while (head2 < tail2) {
			const i = compQueue[head2++];
			area++;
			const x = i % w, y = (i / w) | 0;
			const visit = (j: number) => {
				if (!background[j] && ink[j] < floor && label[j] < 0) {
					label[j] = id;
					compQueue[tail2++] = j;
				}
			};
			if (x > 0) visit(i - 1);
			if (x < w - 1) visit(i + 1);
			if (y > 0) visit(i - w);
			if (y < h - 1) visit(i + w);
		}
		pocketFill.push(area >= minPocket);
	}
	for (let i = 0; i < n; i++) {
		if (!background[i] && ink[i] < floor && label[i] >= 0 && pocketFill[label[i]]) out[i] = 1;
	}
	return out;
}

/**
 * The source-agnostic half of the body law: threshold the shaped ink into the
 * exact mask the candidates are selected from, then measure it with the same
 * distance transform letterforms use. Returns null when the law is off, so the
 * emitted pool stays exactly the classic flat one.
 */
function sourceVolume(
	shaped: Float32Array,
	w: number,
	h: number,
	threshold: number,
	volume: GlyphVolumeConfig | undefined
): { law: GlyphVolumeConfig; fields: GlyphDepthFields } | null {
	if (!volume || !volume.enabled || !(volume.depth > 0)) return null;
	const mask = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) if (shaped[i] >= threshold) mask[i] = 1;
	return { law: volume, fields: buildDepthFieldsFromMask(mask, w, h) };
}

function coverageOf(ink: Float32Array, w: number, h: number, crop: InkField['crop'], threshold: number): number {
	const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
	let inked = 0, total = 0;
	for (let y = crop.y0; y <= crop.y1; y += 1) {
		for (let x = crop.x0; x <= crop.x1; x += 1) {
			total++;
			if (ink[y * w + x] >= threshold) inked++;
		}
	}
	return total ? inked / total : 0;
}

/**
 * Emits deterministic candidate points from an ink field. The content box is
 * mapped uniformly into a centred 400-unit stage box; density carries the ink
 * strength so the material's own size/density response follows the image.
 * Under the volume law each point also carries its measured place in the
 * solid, so images extrude exactly like letterforms.
 */
export function candidatesFromInkField(
	field: InkField,
	options: SourceSampleOptions & { threshold: number }
): SourceCandidatePool {
	const { width: w, height: h, ink, crop } = field;
	const mode = options.mode ?? 'luminance';
	const threshold = options.threshold;
	const scale = options.scale ?? 1;
	const maxCandidates = options.maxCandidates ?? 90000;

	let shaped = ink;
	if (mode === 'edgeSobel') shaped = sobelInk(ink, w, h);
	else if (mode === 'silhouette') shaped = silhouetteInk(ink, w, h, threshold);

	const volume = sourceVolume(shaped, w, h, threshold, options.volume);
	const law = volume?.law;
	const fields = volume?.fields;

	const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
	const cx = (crop.x0 + crop.x1 + 1) / 2;
	const cy = (crop.y0 + crop.y1 + 1) / 2;
	const unit = (400 * scale) / Math.max(cw, ch);
	const step = Math.max(1, Math.round(Math.max(cw, ch) / 220));

	const out: SourceCandidatePool = Object.assign([], { norm: 'stage400' as const });
	const stride = Math.max(1, Math.ceil((((cw / step) | 0) * ((ch / step) | 0)) / maxCandidates));
	for (let y = crop.y0, row = 0; y <= crop.y1; y += step, row++) {
		for (let x = crop.x0 + (row % stride) * step; x <= crop.x1; x += step * stride) {
			const v = shaped[y * w + x];
			if (v < threshold) continue;
			const density = mode === 'silhouette' ? 1 : mode === 'edgeSobel' ? clamp01(v * 1.4) : clamp01(v);
			const point: SourceCandidatePoint = {
				x: (x + 0.5 - cx) * unit,
				y: -(y + 0.5 - cy) * unit,
				density,
			};
			if (fields && law) {
				const cell = y * w + x;
				const shape = cellVolumeShape(fields.distInside[cell], fields.distToInk[cell], fields.referenceThickness, density, law);
				point.hz = shape.half;
				point.cw = shape.contourness;
			}
			out.push(point);
		}
	}
	return out;
}

const FALLBACK_RING = 500;

function visibilityRing(): SourceCandidatePool {
	const ring: Array<{ x: number; y: number; density: number }> = [];
	for (let i = 0; i < FALLBACK_RING; i++) {
		const ang = (i / FALLBACK_RING) * Math.PI * 2;
		ring.push({ x: Math.cos(ang) * 120, y: Math.sin(ang) * 120, density: 0.8 });
	}
	return ring;
}

/** Full normalized image → candidate pipeline with analysis. Never returns an empty pool. */
export function sampleImageSource(
	px: Uint8ClampedArray | Uint8Array,
	w: number,
	h: number,
	options: SourceSampleOptions = {}
): SampledSource {
	const mode = options.mode ?? 'luminance';
	let threshold = clamp01(options.threshold ?? DEFAULT_SOURCE_THRESHOLD);
	if (mode === 'edgeSobel') threshold = Math.max(0.02, threshold * 0.55);

	const field = computeInkField(px, w, h, options);
	let candidates: SourceCandidatePool = candidatesFromInkField(field, { ...options, threshold });
	let coverage = coverageOf(field.ink, w, h, field.crop, threshold);

	// Auto-recovery: a threshold that collects almost nothing starves the
	// formation. Step down until the subject reappears or the floor is reached.
	if (candidates.length < 32) {
		let t = threshold;
		while (candidates.length < 32 && t > 0.05) {
			t = Math.max(0.05, t * 0.6);
			candidates = candidatesFromInkField(field, { ...options, threshold: t });
			coverage = coverageOf(field.ink, w, h, field.crop, t);
		}
		threshold = t;
	}

	let fallback = false;
	if (candidates.length === 0) {
		candidates = visibilityRing();
		fallback = true;
	}

	return {
		candidates: candidates as SampledSource['candidates'],
		analysis: {
			mode,
			threshold,
			polarity: field.polarity,
			polarityAuto: field.polarityAuto,
			backgroundLuminance: field.backgroundLuminance,
			backgroundIsTransparent: field.backgroundIsTransparent,
			sourcePx: { w, h },
			contentPx: { w: field.crop.x1 - field.crop.x0 + 1, h: field.crop.y1 - field.crop.y0 + 1 },
			coverage,
			candidates: candidates.length,
			fallback,
		},
	};
}

/** ASCII drawings rasterize white-on-transparent; ink is alpha. Same normalization law.
 * With a `cell` size, candidates aggregate per character cell (quadrant means):
 * small rasterized glyphs survive as crisp typed marks instead of blurring. */
export function sampleAlphaSource(
	px: Uint8ClampedArray | Uint8Array,
	w: number,
	h: number,
	options: SourceSampleOptions & { cell?: { w: number; h: number } } = {}
): SampledSource {
	const field = computeInkField(px, w, h, { ...options, mode: 'alpha' });
	// Characters blur together below ~1/3 alpha; a firmer floor keeps each typed
	// mark crisp in the particle lattice.
	const threshold = 0.3;
	const candidates = options.cell && options.cell.w >= 3 && options.cell.h >= 3
		? candidatesFromAlphaCells(field, options.cell, threshold, options.scale ?? 1, options.volume)
		: candidatesFromInkField(field, { ...options, threshold, mode: 'alpha' });
	const coverage = coverageOf(field.ink, w, h, field.crop, threshold);
	return {
		candidates: candidates as SampledSource['candidates'],
		analysis: {
			mode: 'alpha',
			threshold,
			polarity: field.polarity,
			polarityAuto: field.polarityAuto,
			backgroundLuminance: field.backgroundLuminance,
			backgroundIsTransparent: true,
			sourcePx: { w, h },
			contentPx: { w: field.crop.x1 - field.crop.x0 + 1, h: field.crop.y1 - field.crop.y0 + 1 },
			coverage,
			candidates: candidates.length,
			fallback: candidates.length === 0,
		},
	};
}

/**
 * Per-character aggregation for ASCII sources: each character cell contributes
 * up to four quadrant candidates weighted by mean alpha, anchored on the ink
 * crop so typed marks stay crisp at any raster size. Under the volume law each
 * quadrant is measured against the drawing's own distance transform, so a
 * typed stroke extrudes like a letterform of the same weight.
 */
function candidatesFromAlphaCells(
	field: InkField,
	cell: { w: number; h: number },
	threshold: number,
	scale: number,
	volume?: GlyphVolumeConfig
): SourceCandidatePool {
	const { width: w, height: h, ink, crop } = field;
	const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
	const cx = (crop.x0 + crop.x1 + 1) / 2;
	const cy = (crop.y0 + crop.y1 + 1) / 2;
	const unit = (400 * scale) / Math.max(cw, ch);
	const volumeLaw = volume?.enabled && volume.depth > 0 ? volume : null;
	const fields = volumeLaw
		? buildDepthFieldsFromMask(
				Uint8Array.from(ink, (v) => (v >= threshold ? 1 : 0)),
				w,
				h
			)
		: null;
	const out: SourceCandidatePool = Object.assign([], { norm: 'stage400' as const });
	const cols = Math.ceil(cw / cell.w);
	const rows = Math.ceil(ch / cell.h);
	for (let row = 0; row < rows; row++) {
		// Cell bounds are integral: cell.w/h are fractional (fontSize·0.6/·1.15),
		// and a fractional pixel index would read the ink field as `undefined`
		// and poison the quadrant mean with NaN.
		const ry0 = crop.y0 + Math.round(row * cell.h);
		const ry1 = Math.min(crop.y1 + 1, crop.y0 + Math.round((row + 1) * cell.h));
		const rym = (ry0 + ry1) >> 1;
		for (let col = 0; col < cols; col++) {
			const cx0 = crop.x0 + Math.round(col * cell.w);
			const cx1 = Math.min(crop.x1 + 1, crop.x0 + Math.round((col + 1) * cell.w));
			if (cx1 <= cx0 || ry1 <= ry0) continue;
			const cxm = (cx0 + cx1) >> 1;
			for (const [qx0, qx1] of [[cx0, cxm], [cxm, cx1]] as const) {
				for (const [qy0, qy1] of [[ry0, rym], [rym, ry1]] as const) {
					let sum = 0, count = 0;
					for (let y = qy0; y < qy1; y++) {
						for (let x = qx0; x < qx1; x++) {
							sum += ink[y * w + x];
							count++;
						}
					}
					if (!count) continue;
					const mean = sum / count;
					if (mean < threshold) continue;
					const density = clamp01(mean * 1.6);
					const point: SourceCandidatePoint = {
						x: ((qx0 + qx1) / 2 - cx) * unit,
						y: -((qy0 + qy1) / 2 - cy) * unit,
						density,
					};
					if (fields && volumeLaw) {
						const px = Math.max(0, Math.min(w - 1, Math.round((qx0 + qx1) / 2)));
						const py = Math.max(0, Math.min(h - 1, Math.round((qy0 + qy1) / 2)));
						const shape = cellVolumeShape(fields.distInside[py * w + px], fields.distToInk[py * w + px], fields.referenceThickness, density, volumeLaw);
						point.hz = shape.half;
						point.cw = shape.contourness;
					}
					out.push(point);
				}
			}
		}
	}
	return out;
}

const MODE_LABEL: Record<InternalMode, string> = {
	luminance: 'Ink luminance',
	edgeSobel: 'Sobel edges',
	silhouette: 'Silhouette cutout',
	alpha: 'ASCII drawing',
};

/** Human summary for the source status line. Ends with a capture-ready marker. */
export function summarizeAnalysis(analysis: SourceAnalysis, kind: 'image' | 'ascii'): string {
	if (analysis.fallback) {
		return `${kind === 'image' ? 'Image' : 'ASCII'} source active · no ink detected above the threshold — showing a placeholder ring. Lower the ink threshold or check the file.`;
	}
	const ink = kind === 'ascii'
		? `drawn marks ${analysis.contentPx.w}×${analysis.contentPx.h}px`
		: analysis.backgroundIsTransparent
			? `transparent cutout · content ${analysis.contentPx.w}×${analysis.contentPx.h}px`
			: `${analysis.polarity === 'darkInk' ? 'light paper detected → dark ink sampled' : 'dark paper detected → light ink sampled'} · content ${analysis.contentPx.w}×${analysis.contentPx.h}px`;
	const pct = Math.round(analysis.coverage * 100);
	return `${kind === 'image' ? 'Image' : 'ASCII'} source active · ${MODE_LABEL[analysis.mode]} · ${ink} · ${pct}% ink · ${analysis.candidates.toLocaleString()} points`;
}
