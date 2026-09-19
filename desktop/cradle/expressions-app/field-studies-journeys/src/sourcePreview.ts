import {asciiLayout} from '../../src/engine/asciiLayout';
import {computeInkField, summarizeAnalysis, SOURCE_WORK_MAX, type SourceAnalysis, type InternalMode} from '../../src/engine/sourceSampling';
import {GlyphSampler} from '../../src/engine/GlyphSampler';

/** UI-side mirror of the engine's source pipeline: analysis + WYSIWYG preview.
 * The same normalization law runs twice (engine bake, panel preview) by design:
 * the preview shows exactly what the formation will sample.
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

/** Renders the ink field over the scene paper — the truth of what will be sampled. */
function renderPreview(
	ink: ReturnType<typeof computeInkField>,
	theme: SourceTheme,
	maxSide = 260
): string {
	const { x0, y0, x1, y1 } = ink.crop;
	const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
	const fit = Math.min(1, maxSide / Math.max(cw, ch));
	const w = Math.max(2, Math.round(cw * fit));
	const h = Math.max(2, Math.round(ch * fit));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.fillStyle = theme.paper;
	ctx.fillRect(0, 0, w, h);
	const out = ctx.getImageData(0, 0, w, h);
	const paper = parseHex(theme.paper);
	const mark = parseHex(theme.ink);
	for (let y = 0; y < h; y++) {
		const sy = Math.min(ink.height - 1, y0 + Math.floor(y / fit));
		for (let x = 0; x < w; x++) {
			const sx = Math.min(ink.width - 1, x0 + Math.floor(x / fit));
			const strength = Math.pow(ink.ink[sy * ink.width + sx], 0.85);
			const o = (y * w + x) * 4;
			out.data[o] = Math.round(paper[0] + (mark[0] - paper[0]) * strength);
			out.data[o + 1] = Math.round(paper[1] + (mark[1] - paper[1]) * strength);
			out.data[o + 2] = Math.round(paper[2] + (mark[2] - paper[2]) * strength);
			out.data[o + 3] = 255;
		}
	}
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
	let field: ReturnType<typeof computeInkField> | null = null;
	if (kind === 'ascii') {
		const sampled = sampler.rasterizeAscii(payload, { fontFamily: opts.fontFamily, fontSize: opts.fontSize, invert: opts.invert });
		analysis = sampled.analysis;
	} else {
		const decoded = await decodePayload(payload);
		const imageData = new ImageData(decoded.data, decoded.width, decoded.height);
		const sampled = sampler.rasterizeCustomImage(imageData, {
			mode: opts.mode as 'luminance' | 'edgeSobel' | 'silhouette' | undefined,
			threshold: opts.threshold,
			invert: opts.invert,
			scale: opts.scale,
		});
		analysis = sampled.analysis;
		field = computeInkField(decoded.data, decoded.width, decoded.height, { mode: opts.mode, threshold: opts.threshold, invert: opts.invert });
	}
	const visual: SourceVisual = {
		analysis,
		previewDataUrl: field ? renderPreview(field, theme) : asciiPreview(payload, opts, theme),
	};
	inner.set(innerKey, visual);
	return visual;
}

/** ASCII preview rasterizes the drawing itself and shows ink coverage directly. */
function asciiPreview(payload: string, opts: SourceVisualOptions, theme: SourceTheme): string {
	const canvas = document.createElement('canvas');
	const maxSide = 260;
	canvas.width = maxSide;
	canvas.height = maxSide;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return '';
	const {lines,fontSize,charWidth,lineHeight}=asciiLayout(payload,maxSide,maxSide,opts.fontSize);
	const maxLen=Math.max(1,...lines.map(l=>Array.from(l).length));
	ctx.font = `bold ${fontSize}px ${opts.fontFamily || '"Fira Code", "Courier New", Courier, monospace'}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = theme.ink;
	const startX = (maxSide - maxLen * fontSize * 0.6) / 2;
	const startY = (maxSide - lines.length * lineHeight) / 2 + lineHeight / 2;
	ctx.fillStyle = theme.paper;
	ctx.fillRect(0, 0, maxSide, maxSide);
	ctx.fillStyle = theme.ink;
	lines.forEach((line, r) => ctx.fillText(line, startX, startY + r * lineHeight));
	return canvas.toDataURL('image/png');
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
