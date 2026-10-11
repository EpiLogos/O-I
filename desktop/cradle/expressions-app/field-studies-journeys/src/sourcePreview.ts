import {summarizeAnalysis, SOURCE_WORK_MAX, type SourceAnalysis, type InternalMode} from '../../src/engine/sourceSampling';
import {GlyphSampler} from '../../src/engine/GlyphSampler';

/** Analysis and front projection of the engine's actual sampled source pool.
 * Sampling, threshold recovery, mode shaping and polarity remain producer-owned.
 * This is source geometry; the entity's body and Field material apply later.
 */

export interface SourceVisual {
	analysis: SourceAnalysis;
	previewDataUrl: string;
}

export interface SourceTheme {
	paper: string;
	ink: string;
}

export interface SourceVisualOptions {
	mode?: InternalMode;
	threshold?: number;
	invert?: boolean;
	scale?: number;
	fontFamily?: string;
	fontSize?: number;
}

let sampler: GlyphSampler | null = null;
const visualCache = new Map<string, Map<string, SourceVisual>>();

function cacheKey(kind: 'image' | 'ascii', opts: SourceVisualOptions, theme: SourceTheme): string {
	return JSON.stringify([kind, opts.mode, opts.threshold, opts.invert, opts.scale, opts.fontFamily, opts.fontSize, theme.paper, theme.ink]);
}

function hashPayload(payload: string): string {
	return payload;
}

async function decodePayload(payload: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
	const image = new Image();
	image.decoding = 'async';
	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error('The embedded image could not be decoded for preview.'));
		image.src = payload;
	});
	const fit = Math.min(1, SOURCE_WORK_MAX / Math.max(image.naturalWidth, image.naturalHeight));
	const w = Math.max(2, Math.round(image.naturalWidth * fit));
	const h = Math.max(2, Math.round(image.naturalHeight * fit));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas is unavailable for source preview.');
	ctx.drawImage(image, 0, 0, w, h);
	const drawn = ctx.getImageData(0, 0, w, h);
	return { data: drawn.data, width: w, height: h };
}

export interface SampledPreview {
	width: number;
	height: number;
	pixels: Uint8ClampedArray;
	/** Actual source coordinates; the image never stretches either axis. */
	bounds: {x0: number; y0: number; x1: number; y1: number} | null;
	worldUnitsPerPixel: number;
}

/** Project actual sampled cells, with y up in source space. A 400-unit frame
 * retains smaller authored source scales; larger sources expand it uniformly
 * so every candidate remains visible. Collisions retain the strongest sample.
 * No inferred contour, inversion or threshold is introduced here. */
export function sampledSourcePreviewPixels(
	candidates: readonly {x: number; y: number; density: number}[],
	theme: SourceTheme,
	maxSide = 260
): SampledPreview {
	const side = Number.isFinite(maxSide) ? Math.max(2, Math.min(512, Math.floor(maxSide))) : 260;
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const candidate of candidates) {
		if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) || !Number.isFinite(candidate.density)) throw new Error('Source preview received a non-finite sampled candidate.');
		x0 = Math.min(x0, candidate.x); y0 = Math.min(y0, candidate.y);
		x1 = Math.max(x1, candidate.x); y1 = Math.max(y1, candidate.y);
	}
	const half = candidates.length ? Math.max(200, Math.abs(x0), Math.abs(y0), Math.abs(x1), Math.abs(y1)) : 200;
	const worldUnitsPerPixel = 2 * half / (side - 1);
	const strength = new Float32Array(side * side);
	for (const candidate of candidates) {
		const x = Math.max(0, Math.min(side - 1, Math.round((candidate.x + half) / worldUnitsPerPixel)));
		const y = Math.max(0, Math.min(side - 1, Math.round((half - candidate.y) / worldUnitsPerPixel)));
		const index = y * side + x;
		strength[index] = Math.max(strength[index], Math.max(0, Math.min(1, candidate.density)));
	}
	const pixels = new Uint8ClampedArray(side * side * 4), paper = parseHex(theme.paper), mark = parseHex(theme.ink);
	for (let index = 0; index < strength.length; index++) {
		const offset = index * 4, density = strength[index];
		for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(paper[channel] + (mark[channel] - paper[channel]) * density);
		pixels[offset + 3] = 255;
	}
	return {width: side, height: side, pixels, bounds: candidates.length ? {x0,y0,x1,y1} : null, worldUnitsPerPixel};
}

function renderPreview(candidates: readonly {x: number; y: number; density: number}[], theme: SourceTheme): string {
	const preview = sampledSourcePreviewPixels(candidates, theme);
	const canvas = document.createElement('canvas');
	canvas.width = preview.width;
	canvas.height = preview.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const out = ctx.createImageData(preview.width, preview.height);
	out.data.set(preview.pixels);
	ctx.putImageData(out, 0, 0);
	return canvas.toDataURL('image/png');
}

function parseHex(hex: string): [number, number, number] {
	const clean = /^#([0-9a-f]{6})$/i.test(hex) ? hex.slice(1) : '888888';
	return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/** Analysis + preview for an embedded image (data URL) or ASCII text. */
export async function sourceVisual(
	kind: 'image' | 'ascii',
	payload: string,
	opts: SourceVisualOptions,
	theme: SourceTheme
): Promise<SourceVisual> {
	const innerKey = cacheKey(kind, opts, theme);
	let inner = visualCache.get(hashPayload(payload));
	if (!inner) {
		inner = new Map();
		visualCache.set(hashPayload(payload), inner);
	}
	const cached = inner.get(innerKey);
	if (cached) return cached;
	if (visualCache.size > 24) visualCache.clear();

	sampler ??= new GlyphSampler();
	let analysis: SourceAnalysis;
	let candidates: {x: number; y: number; density: number}[];
	if (kind === 'ascii') {
		const sampled = sampler.rasterizeAscii(payload, { fontFamily: opts.fontFamily, fontSize: opts.fontSize, invert: opts.invert });
		analysis = sampled.analysis;
		candidates = sampled.candidates;
	} else {
		const decoded = await decodePayload(payload);
		const imageData = new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
		const sampled = sampler.rasterizeCustomImage(imageData, {
			mode: opts.mode as 'luminance' | 'edgeSobel' | 'silhouette' | undefined,
			threshold: opts.threshold,
			invert: opts.invert,
			scale: opts.scale,
		});
		analysis = sampled.analysis;
		candidates = sampled.candidates;
	}
	const visual: SourceVisual = {
		analysis,
		previewDataUrl: renderPreview(candidates, theme),
	};
	inner.set(innerKey, visual);
	return visual;
}

/** Panel-facing one-liner: what was detected, distinct from the engine status line. */
export function describeAnalysis(analysis: SourceAnalysis, kind: 'image' | 'ascii'): string {
	if (analysis.fallback && kind === 'ascii') return 'No visible marks. Type or paste a drawing; empty cells contribute no ink.';
	if (analysis.fallback) return 'No ink found at this threshold — the field shows a placeholder ring. Lower the ink threshold or check the file.';
	const source = kind === 'ascii'
		? `ASCII crop ${analysis.contentPx.w}×${analysis.contentPx.h}`
		: analysis.backgroundIsTransparent
			? `Transparent cutout · subject ${analysis.contentPx.w}×${analysis.contentPx.h}`
			: `${analysis.polarity === 'darkInk' ? 'Light paper → dark ink' : 'Dark paper → light ink'} · subject ${analysis.contentPx.w}×${analysis.contentPx.h} of ${analysis.sourcePx.w}×${analysis.sourcePx.h}`;
	return `${source} · ${Math.round(analysis.coverage * 100)}% ink · ${analysis.candidates.toLocaleString()} sample points`;
}

export { summarizeAnalysis };
