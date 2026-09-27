/**
 * CharacterPreview — a small live canvas of a character's body in one state
 * or gesture. It plays the state's authored entity `sequence` (each step's
 * hold, transition and easing; per-step source/tint/scale/rotation), draws
 * the glyph, ASCII or embedded image source with its compound layers and
 * tint, and moves lightly with the body's force (vortex spins, attract/repel
 * breathe, a small jitter). Choosing another state or gesture cross-fades
 * over that Scene's authored transition duration.
 *
 * It is a legible preview of the authored material, not a second engine: the
 * particle field, physics and sound belong to the Expressions engine. One rAF
 * loop per preview, paused while offscreen or the page is hidden, stopped on
 * unmount; reduced motion draws a still frame. The static layered drawing
 * stays inside the canvas as its accessible/no-canvas fallback.
 *
 * `CharacterPreview` draws a prepared material; `LiveCharacterPreview` reads
 * the character document by its Central file ref first. The creator and the
 * Agent Card both use `LiveCharacterPreview`.
 */
import {useEffect, useMemo, useRef, type CSSProperties} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {characterPreview, type CharacterChoice, type CharacterLayerPreview, type CharacterPreviewMaterial} from "./characterModel";
import {useCharacterDocument} from "./characterMaterial";
import {ease} from "./characterAnimation";
import {drawMaterial, type Ctx} from "./characterDraw";

export interface CharacterPreviewProps {
  material: CharacterPreviewMaterial | null;
  /** Edge length in CSS pixels (default 96). */
  size?: number;
  /** Accessible name; defaults to the character title and state. */
  label?: string;
  /** false draws a still frame (default: animate). */
  animate?: boolean;
}

/** Tint is authored data, so it is applied inline; weight mixes it with ink. */
export function tintStyle(tint: string | null, weight: number): CSSProperties {
  if (!tint || weight <= 0) return {};
  const percent = Math.round(Math.min(1, weight) * 100);
  return {color: percent >= 100 ? tint : `color-mix(in srgb, ${tint} ${percent}%, currentColor)`};
}

function Layer({layer, size}: {layer: CharacterLayerPreview; size: number}) {
  const style: CSSProperties = {transform: `scale(${layer.scale})`};
  if (layer.imageDataUrl) return <img className="character-preview-layer character-preview-image" style={style} src={layer.imageDataUrl} alt="" draggable={false}/>;
  if (layer.ascii) return <pre className="character-preview-layer character-preview-ascii" style={{...style, fontSize: Math.max(6, size / 12)}} aria-hidden="true">{layer.ascii}</pre>;
  if (!layer.text) return null;
  return <span className="character-preview-layer character-preview-glyph" style={{...style, fontSize: size * .5}} aria-hidden="true">{layer.text}</span>;
}

// ——— canvas drawing (characterDraw.ts) ———————————————————————————————
const images = new Map<string, HTMLImageElement>();
function image(url: string): HTMLImageElement | null {
  let value = images.get(url);
  if (!value) { value = new Image(); value.src = url; images.set(url, value); if (images.size > 64) images.delete(images.keys().next().value!); }
  return value.complete && value.naturalWidth > 0 ? value : null;
}
function inkOf(canvas: HTMLCanvasElement): [number, number, number] {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(canvas).color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [40, 40, 36];
}

interface Showing {material: CharacterPreviewMaterial; since: number}

export function CharacterPreview({material, size = 96, label, animate = true}: CharacterPreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef<{current: Showing | null; previous: Showing | null; switchAt: number}>({current: null, previous: null, switchAt: 0});
  const wake = useRef<() => void>(() => {});
  // A new state/gesture: keep the old one to cross-fade over the target Scene's transition.
  useEffect(() => {
    const now = performance.now() / 1000, held = shown.current;
    // A re-derived but identical material is not a state change.
    if (held.current && material && JSON.stringify(held.current.material) === JSON.stringify(material)) { held.current.material = material; return; }
    held.previous = held.current && material ? held.current : null;
    held.current = material ? {material, since: now} : null;
    held.switchAt = now;
    wake.current();
  }, [material]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof window === "undefined") return;
    const context = element.getContext("2d");
    if (!context) return;
    const ctx = context as unknown as Ctx & {setTransform: CanvasRenderingContext2D["setTransform"]; clearRect: CanvasRenderingContext2D["clearRect"]};
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    element.width = Math.round(size * dpr); element.height = Math.round(size * dpr);
    const still = !animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let frame = 0, visible = true, alive = true;
    const ink = inkOf(element);
    const draw = () => {
      frame = 0;
      if (!alive) return;
      const now = performance.now() / 1000, {current, previous, switchAt} = shown.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (current) {
        const span = current.material.transition;
        const k = previous && span > 0 ? ease((now - switchAt) / span, "smoothstep") : 1;
        if (previous && k < 1) drawMaterial(ctx, previous.material, still ? 0 : now - previous.since, size, 1 - k, ink, still, image);
        else shown.current.previous = null;
        drawMaterial(ctx, current.material, still ? 0 : now - current.since, size, k, ink, still, image);
      }
      const settling = !!shown.current.previous;
      if (visible && (!still || settling) && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const schedule = () => { if (alive && !frame) frame = requestAnimationFrame(draw); };
    wake.current = schedule;
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) schedule(); }) : null;
    observer?.observe(element);
    const onVisibility = () => { if (!document.hidden) schedule(); };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => { alive = false; if (frame) cancelAnimationFrame(frame); observer?.disconnect(); document.removeEventListener("visibilitychange", onVisibility); wake.current = () => {}; };
  }, [size, animate]);
  // The canvas is ALWAYS mounted: the drawing loop binds to it once, so a
  // preview whose material arrives after mount (the usual case — the
  // character is read by ref) must not start without a canvas.
  if (!material) {
    return <figure className="character-preview" data-empty="true" style={{width: size, height: size}} role="img" aria-label={label ?? "No expressive character"}>
      <canvas ref={canvas} className="character-preview-canvas" style={{width: size, height: size}} aria-hidden="true"/>
      <span className="character-preview-empty">No character</span>
    </figure>;
  }
  const name = label ?? `${material.title}${material.showing ? ` — ${material.showing}` : ""}`;
  const body: CharacterLayerPreview = {id: "body", text: material.glyph, scale: material.scale, z: 0, ascii: material.ascii, imageDataUrl: material.imageDataUrl};
  const layers = [...material.layers.filter(layer => layer.z < 0), body, ...material.layers.filter(layer => layer.z >= 0)];
  return <figure className="character-preview" data-shape={material.shape} data-live={animate ? "true" : undefined} style={{width: size, height: size, ...tintStyle(material.tint, material.tintWeight)}} role="img" aria-label={name}>
    <canvas ref={canvas} className="character-preview-canvas" style={{width: size, height: size}} aria-hidden="true">
      <span className="character-preview-stage">{layers.map(layer => <Layer key={layer.id} layer={layer} size={size}/>)}</span>
    </canvas>
    {(material.force || material.sound || material.steps.length > 1) && <figcaption className="character-preview-marks">
      {material.steps.length > 1 && <span title={material.steps.join(" → ")}>{material.steps.length} states</span>}
      {material.force && <span>{material.force}</span>}
      {material.sound && <span>sound</span>}
    </figcaption>}
  </figure>;
}

/** Reads the character by ref and draws the chosen state/gesture (default:
 * its `preview_state`). A failed read is named, never an empty drawing. */
export function LiveCharacterPreview({characterRef, choice, size = 96}: {characterRef: string; choice?: CharacterChoice; size?: number}) {
  const kernel = useKernel();
  const reading = useCharacterDocument(kernel.transport, characterRef);
  const material = useMemo(() => reading.document ? characterPreview(reading.document, choice) : null, [reading.document, choice?.state, choice?.gesture]);
  if (reading.state === "error") return <p className="oi-refusal" role="status">The character could not be read: {reading.error}</p>;
  if (reading.state !== "ready" || !reading.document) return <div className="character-preview" style={{width: size, height: size}} aria-busy="true"><span className="character-preview-empty">Reading…</span></div>;
  return <CharacterPreview material={material} size={size}/>;
}
