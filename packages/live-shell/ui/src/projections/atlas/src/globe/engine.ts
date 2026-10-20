// The globe: renderer, camera rig, layers, atmosphere and per-frame plumbing.
import type { ScopeInfo } from '../data/scope';
import * as THREE from 'three';
import type { Model } from '../data/model';
import { replaceModelOccurrence, type SeamChange } from '../data/occurrenceSeam';
import type { Family, Occurrence } from '../types/field';
import { clonePalette, easeInOutCubic, mixPalette, WORLD_PALETTE, type RGBPalette } from '../data/palette';
import type { Vec3 } from '../data/geo';
import type { TimeModel } from '../state/timeModel';
import { DEFAULT_RAMP } from '../data/time';
import { CameraRig } from './controls';
import { Arcs, Marker } from './arcs';
import { Aura, AtmosphereShell, Backdrop, Earth, bodyTexture, hiResChoice, loadBaseHi, loadBaseLo } from './earth';
import { airOf, barrenOf, bodyImage, bodySunDir, BODY_WIDTHS, type BodyLook, type WorldBodyRecord } from './body';
import { WEATHER_BANDS, weatherClock, weatherScale } from './bodyWeather';
import { bodyTileSource, renderBody } from './bodyRender';
import { hasTiles, tileLevelFor } from './bodyTiles';
import { Presences } from './presences';
import { createShared, type Shared } from './shared';
import { gibsSource, TileLayer } from './tiles';
import { depthPlanes, stageDistance, sunWeight, surfaceWeight } from '../sky/stages';
import type { SkyLayer } from '../sky/layer';
import type { BodyKey } from '../types/sky';
import { wrapLon } from '../data/geo';
import { hostSize } from '../ui/hostSize';
import { followSize, listen, later, nextFrame } from '../ui/lifetime';

export interface ScreenPoint {
  x: number;
  y: number;
  /** >0 when the point faces the camera (0 at the horizon) */
  facing: number;
}

export interface EngineCallbacks {
  onPick(index: number): void;
  onHover(index: number, x: number, y: number): void;
  onInteract(): void;
  onGrab(): void;
  onPalette(p: RGBPalette): void;
  /** a body of the sky layer was picked */
  onSkyPick?(key: BodyKey): void;
}

export const FOV = 38;

/** Free the GPU resources under an object: each geometry, each material, and every texture a material holds (its maps and
 * its shader uniforms). Resources shared between objects are freed more than once, which three.js allows. */
function releaseObjectTree(root: THREE.Object3D): void {
  const release = (material: THREE.Material) => {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
    for (const uniform of Object.values((material as THREE.ShaderMaterial).uniforms ?? {})) {
      if (uniform?.value instanceof THREE.Texture) uniform.value.dispose();
    }
    material.dispose();
  };
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach(release);
    else if (material) release(material);
  });
}

export class GlobeEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.04, 60);
  readonly shared: Shared = createShared();
  readonly rig: CameraRig;
  readonly arcs: Arcs;
  readonly markers: { sel: Marker; hover: Marker; head: Marker };
  presences!: Presences;
  earth!: Earth;
  tiles!: TileLayer;
  /** the sky layer, once its data has loaded (absent: the atlas exactly as it was) */
  sky: SkyLayer | null = null;
  /** false once the globe is too small for its constant-pixel surface layers to read (sky stages) */
  private surfaceOn = true;
  private backdrop: Backdrop;
  private aura: Aura;
  private shell: AtmosphereShell;
  readonly ready: Promise<void>;

  private last = performance.now();
  private elapsed = 0;
  width = 1;
  height = 1;
  private pr = 1;
  private frameCbs: ((dt: number, t: number) => void)[] = [];

  // palette tween
  private curPal = clonePalette(WORLD_PALETTE);
  private fromPal = clonePalette(WORLD_PALETTE);
  private toPal = clonePalette(WORLD_PALETTE);
  private palT = 1;
  private palDur = 1.6;
  private palDirty = true;

  private pointer = { x: 0, y: 0, inside: false, dirty: false };
  private hoverIdx = -1;
  private tmpV = new THREE.Vector3();
  /** cancels the frame the loop has scheduled next (ui/lifetime.ts: released with the atlas) */
  private cancelFrame: () => void = () => {};
  baseKind: '2k' | '4k' | '8k' = '2k';
  /** the first tile level the Earth's own sharp base is less dense than (GIBS tiles start there); a generated body sets its own */
  private earthMinEmit = 6;
  baseUploadMs = 0;
  private running = true;
  private paused = false;

  constructor(private parent: HTMLElement, private model: Model, private time: TimeModel, private cb: EngineCallbacks, readonly reduced: boolean) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x02030a, 1);
    this.renderer.domElement.className = 'globe-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.renderer.domElement);

    this.rig = new CameraRig(this.camera, this.renderer.domElement, {
      reduced,
      onInteract: () => cb.onInteract(),
      onGrab: () => cb.onGrab(),
      onClick: (x, y) => this.handleClick(x, y),
      isOverPresence: (x, y) => !!this.presences && this.surfaceOn && this.presences.pick(x, y, this.camera, this.width, this.height, this.pickRadius()) >= 0,
      onHover: (x, y, inside) => {
        this.pointer.x = x;
        this.pointer.y = y;
        this.pointer.inside = inside;
        this.pointer.dirty = true;
      },
    });

    this.backdrop = new Backdrop(this.shared);
    this.shell = new AtmosphereShell(this.shared);
    this.aura = new Aura(this.shared);
    this.arcs = new Arcs(this.shared);
    this.markers = { sel: new Marker(this.shared, 26), hover: new Marker(this.shared, 17), head: new Marker(this.shared, 30) };

    this.ready = this.init();
    // the window's resize carries a change of devicePixelRatio (a zoom, another screen); the pane's own size changes without
    // the window (a browser, rail or detail toggle, a split): the observer of the parent follows those (ui/lifetime.ts followSize)
    listen(window, 'resize', this.onResize);
    followSize(this.parent, this.onResize);
    this.onResize();
  }

  private async init() {
    const lo = await loadBaseLo(this.renderer);
    if (this.released) return; // disposed while the base loaded: nothing of the globe is built
    this.presences = new Presences(this.model, this.shared, this.renderer);
    this.earth = new Earth(this.shared, lo, this.presences.densityTarget.texture);
    this.tiles = new TileLayer(this.renderer, this.earth.u, this.reduced);
    // a body asked for before the Earth stood is drawn now
    if (this.bodyRecord) { this.drawBody(this.bodyRecord, this.bodyLook, this.bodyKey); this.applyWeather(); }
    this.scene.add(this.backdrop.mesh, this.earth.mesh, this.tiles.group, this.shell.mesh, this.presences.mesh, this.arcs.group, this.aura.points, this.markers.sel.mesh, this.markers.hover.mesh, this.markers.head.mesh);
    this.palDirty = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.cancelFrame = nextFrame(loop);
      this.frame();
    };
    loop();
    void this.upgradeBase();
  }

  /** After first paint: fetch the sharp base, upload it quietly, then blend it in. */
  private async upgradeBase() {
    const which = hiResChoice(this.renderer);
    this.earthMinEmit = which === '8k' ? 6 : 5;
    if (!this.earth.generated) this.tiles.minEmit = this.earthMinEmit;
    if (!which) return;
    try {
      await new Promise<void>((r) => { later(() => r(), 700); });
      const hi = await loadBaseHi(this.renderer, which);
      // wait for a calm frame: the upload of a big texture is one long GPU call
      await new Promise<void>((r) => { nextFrame(() => r()); });
      if (this.released) return;
      const t0 = performance.now();
      this.renderer.initTexture(hi);
      this.baseUploadMs = performance.now() - t0;
      this.earth.setHi(hi);
      this.baseKind = which;
    } catch (err) {
      console.warn('hi-res base unavailable', err);
    }
  }

  /**
   * Stop drawing the globe (the graph mode is up) without stopping the clock: time, the camera rig, the
   * palette tween and frame callbacks keep running; the GPU work (presences, tiles, markers, render) does not.
   */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.last = performance.now();
  }

  /**
   * Release the globe: the frame loop and its pending base upload stop, and the GPU resources the scene holds are freed
   * (geometries, materials with their textures, the presence density target, the tiles), then the renderer's context is
   * lost, so a later mount takes a fresh one. Window listeners are released with the atlas lifetime (ui/lifetime.ts).
   */
  dispose() {
    if (this.released) return;
    this.released = true;
    this.running = false;
    this.cancelFrame();
    this.tiles?.release();
    // a generated body gives the Earth's imagery back first, so the release frees both (the held imagery is in no material)
    this.earth?.setGenerated(null);
    releaseObjectTree(this.scene);
    this.presences?.densityTarget.dispose();
    try {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    } catch {
      /* the context may already be gone with its pane */
    }
    this.renderer.domElement.remove();
  }
  /** set once dispose has run: no frame, upload or listener is started again */
  released = false;

  onFrame(cb: (dt: number, t: number) => void) {
    this.frameCbs.push(cb);
  }

  // ── palette ────────────────────────────────────────────────────────────
  setPalette(p: RGBPalette, seconds = 1.6) {
    this.fromPal = clonePalette(this.curPal);
    this.toPal = clonePalette(p);
    this.palT = 0;
    this.palDur = this.reduced ? Math.min(seconds, 0.5) : seconds;
  }

  get palette(): RGBPalette {
    return this.curPal;
  }

  // ── emphasis ───────────────────────────────────────────────────────────
  /**
   * Emphasis composes with the field filter here, in one place (MODES-RFC §4): an occurrence the filter excludes is
   * neither drawn nor picked, whatever a lens asks for it. Lenses never see the filter.
   */
  setEmphasis(targets: Float32Array | null, tint: [number, number, number] | null, scope: ScopeInfo | null = null) {
    this.emphasis = targets ? Float32Array.from(targets) : null;
    this.scope = targets ? scope : null;
    this.presences.setTargets(this.composeFilter(this.emphasis));
    this.presences.setFocusTint(tint ?? [1, 1, 1], !!tint);
    this.onScope?.(this.scope, this.wholeField);
  }

  /** The mode's scope as last set (null: the whole field, or an emphasis that is not a mode's set). */
  scope: ScopeInfo | null = null;
  /** told whenever the scope (or the whole-field choice) changes: the shell names what is shown */
  onScope: ((scope: ScopeInfo | null, wholeField: boolean) => void) | null = null;
  /** the visitor asked for the whole field back: what a scope sets aside is drawn again, receded */
  private wholeField = false;
  setWholeField(on: boolean) {
    this.wholeField = on;
    this.presences.setTargets(this.composeFilter(this.emphasis));
    this.onScope?.(this.scope, on);
  }

  /** The filter's mask (1 passes, 0 excluded), or null for the whole field. Re-applies the standing emphasis. */
  setFilterMask(mask: Float32Array | null) {
    this.filterMask = mask;
    this.presences.setTargets(this.composeFilter(this.emphasis));
  }

  /**
   * [T-ATLAS-SEAM] One occurrence of the mounted field replaced in place (the Sun follows the shared window): the model's
   * arrays and the globe's buffers take that one change, and nothing else is rebuilt (data/occurrenceSeam.ts). The lens
   * emphasis and the field filter are sized to the new count here; the controller re-derives the filter after it.
   */
  replaceOccurrence(occ: Occurrence | null, id: string, family?: Family): SeamChange {
    const change = replaceModelOccurrence(this.model, occ, id, family);
    if (!change.changed) return change;
    const n = this.model.occ.length;
    this.presences.sync(change.removed ? null : change.index);
    // an occurrence the lens did not name is receded, as the controller recedes the unnamed (REL_RECEDED)
    if (this.emphasis && this.emphasis.length !== n) {
      const next = new Float32Array(n).fill(0.07);
      next.set(this.emphasis.subarray(0, Math.min(n, this.emphasis.length)));
      this.emphasis = next;
    }
    if (this.filterMask && this.filterMask.length !== n) {
      const next = new Float32Array(n).fill(1);
      next.set(this.filterMask.subarray(0, Math.min(n, this.filterMask.length)));
      this.filterMask = next;
    }
    if (this.hoverIdx >= n) {
      this.hoverIdx = -1;
      this.cb.onHover(-1, 0, 0);
    }
    this.presences.setTargets(this.composeFilter(this.emphasis));
    return change;
  }

  private emphasis: Float32Array | null = null;
  private filterMask: Float32Array | null = null;

  private composeFilter(targets: Float32Array | null): Float32Array | null {
    const mask = this.filterMask;
    // a scope's set-aside presences return at the old receded level when the whole field is asked for
    const lifted = targets && this.scope && this.wholeField ? targets.map((v) => Math.max(v, 0.07)) : targets;
    if (!mask) return lifted;
    const out = lifted ? Float32Array.from(lifted) : new Float32Array(mask.length).fill(1);
    for (let i = 0; i < out.length; i++) if (!mask[i]) out[i] = 0;
    return out;
  }

  // ── projection helpers for DOM overlays ────────────────────────────────
  project(dir: Vec3, out: ScreenPoint, radius = 1): ScreenPoint {
    const v = this.tmpV.set(dir[0] * radius, dir[1] * radius, dir[2] * radius).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (1 - (v.y * 0.5 + 0.5)) * this.height;
    const cd = this.camera.position.length();
    out.facing = (dir[0] * this.camera.position.x + dir[1] * this.camera.position.y + dir[2] * this.camera.position.z) / cd - 1 / cd;
    return out;
  }

  /** Screen position of the globe's centre and its radius in px. */
  globeDisc(out: { x: number; y: number; r: number }) {
    const v = this.tmpV.set(0, 0, 0).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (1 - (v.y * 0.5 + 0.5)) * this.height;
    const d = this.camera.position.length();
    const t = Math.tan((FOV * Math.PI) / 360);
    out.r = (1 / Math.sqrt(Math.max(d * d - 1, 0.01)) / t) * 0.5 * this.height;
  }

  /** Add the sky layer to the scene. Idempotent. */
  attachSky(layer: SkyLayer) {
    if (this.sky === layer) return;
    this.sky = layer;
    layer.reduced = this.reduced;
    this.scene.add(layer.group);
    layer.setSize(this.width, this.height, this.pr);
    // compile the sky's programs now, while the Earth is on screen, so the first pull-back does not hitch
    const was: [THREE.Object3D, boolean][] = [];
    layer.group.traverse((o) => { was.push([o, o.visible]); o.visible = true; });
    try { this.renderer.compile(this.scene, this.camera); } catch { /* compiled on first draw instead */ }
    for (const [o, v] of was) o.visible = v;
  }

  /**
   * The distance the sky's stage model reads (src/sky/stages.ts): the camera's distance from the focus, or, while a
   * planet is approached, from the Earth's centre floored at the system edge. Exactly the rig's distance wherever no
   * body is approached, so the atlas and every other view are unchanged.
   */
  get stageDist(): number {
    return stageDistance(this.rig.dist, this.camera.position.length(), this.sky?.approach ?? 0);
  }

  /**
   * The Earth's light: the atlas's composed key light near the surface, the true Sun's from the lunar stage outward.
   * The share eases (never pops) when the sky's data arrives or the distance changes quickly; where the sky cannot
   * say where the Sun is (a moment outside the generated span) it stays the atlas's.
   */
  private sunShare = 0;
  private stepSun(dt: number) {
    const target = this.sky?.sunKnown ? sunWeight(this.stageDist) : 0;
    this.sunShare = this.reduced || Math.abs(target - this.sunShare) < 1e-4 ? target : this.sunShare + (target - this.sunShare) * (1 - Math.exp(-dt * 3.5));
    if (this.sky?.sunKnown) {
      this.earth.sunDir.value.copy(this.sky.sunDir);
      // [T-WORLDS §5 W3] a generated body is lit at its own season: the Sun at the declination its axial tilt gives (body.ts bodySunDir)
      if (this.bodyRecord) {
        const lit = bodySunDir(this.sky.sunDir, this.sky.sunLongitude(), this.bodyRecord.sky.axial_tilt_deg);
        this.earth.sunDir.value.set(lit.x, lit.y, lit.z);
      }
    }
    this.earth.sunMix.value = this.sunShare;
  }

  private onResize = () => {
    const w = this.parent.clientWidth || hostSize(this.parent).w;
    const h = this.parent.clientHeight || hostSize(this.parent).h;
    // a hidden pane (its mode's tree parked, the pane folded) measures 0: the globe keeps its last size until it stands again
    // (an aspect of 0/0 would put NaN into the camera)
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.shared.res.value.set(w * this.pr, h * this.pr);
    this.shared.px.value = this.pr;
    this.sky?.setSize(w, h, this.pr);
  };

  // ── picking ────────────────────────────────────────────────────────────
  private pickRadius(): number {
    // generous and magnetic: the nearest live presence within reach is the one you mean
    return matchMedia('(pointer: coarse)').matches ? 34 : 22;
  }

  private handleClick(x: number, y: number) {
    const body = this.sky?.pick(x, y, this.pickRadius() * 0.8);
    if (body) {
      this.cb.onSkyPick?.(body);
      return;
    }
    const idx = this.presences && this.surfaceOn ? this.presences.pick(x, y, this.camera, this.width, this.height, this.pickRadius() * 1.2) : -1;
    this.cb.onPick(idx);
  }

  // ── frame ──────────────────────────────────────────────────────────────
  /**
   * Test/diagnostic hook: stop the real-time loop and step the simulation by
   * a fixed dt (rendering only the last frame). Deterministic under load.
   */
  advance(seconds: number, step = 1 / 30) {
    this.running = false;
    this.cancelFrame();
    const n = Math.max(1, Math.ceil(seconds / step));
    for (let i = 0; i < n; i++) this.frame(step, i === n - 1);
  }

  private frame(dtOverride?: number, render = true) {
    const now = performance.now();
    const dt = dtOverride ?? Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.elapsed += dt;
    const t = this.elapsed;
    const S = this.shared;
    S.time.value = t;

    this.time.update(dt);
    S.cursor.value = this.time.cursorU;
    S.trail.value = this.time.trail;
    S.ramp.value = DEFAULT_RAMP;
    S.timeOn.value = this.time.on;

    // the sky: where the camera looks, and carrying the camera with the sky as the pull-back hands off
    if (this.sky) {
      const { focus, dLon } = this.sky.prepare(this.stageDist, dt);
      this.rig.focus.copy(this.rig.focusPin ?? focus);
      if (dLon) this.rig.lon = wrapLon(this.rig.lon + dLon);
    }
    this.stepSun(dt);
    if (this.bodyRecord && this.bodyTime === null && !this.reduced) this.earth.weatherT.value = weatherClock(this.bodyRecord.seed, Date.now());
    this.rig.update(dt);
    // the clip planes follow the altitude so depth stays precise from orbit to the ground
    const camDist = this.camera.position.length();
    // the radians of the body one pixel spans, under the camera (the sky's finest detail is drawn only where a pixel is smaller than it)
    this.earth.pxRad.value = (2 * Math.tan((FOV * Math.PI) / 360) * Math.max(camDist - 1, 0.02)) / Math.max(this.height, 1);
    // the far plane follows the Earth's distance (the sky is drawn about the Sun); the near plane may follow the focus
    const planes = depthPlanes(camDist, !!this.sky, this.rig.dist, this.sky?.approach ?? 0);
    this.camera.near = planes.near;
    this.camera.far = planes.far;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    const e = this.camera.projectionMatrix.elements;
    e[8] = -this.rig.shiftX;
    e[9] = -this.rig.shiftY;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    this.sky?.update(this.camera, this.stageDist, this.width, this.height);

    const dist = this.camera.position.length();
    S.camDist.value = dist;
    S.camDir.value.copy(this.camera.position).divideScalar(dist);

    // palette
    if (this.palT < 1) {
      this.palT = Math.min(1, this.palT + dt / this.palDur);
      mixPalette(this.fromPal, this.toPal, easeInOutCubic(this.palT), this.curPal);
      this.palDirty = true;
    }
    if (this.palDirty) {
      this.palDirty = false;
      const p = this.curPal;
      S.glow.value.set(...p.glow);
      S.core.value.set(...p.core);
      S.fog.value.set(...p.fog);
      S.deep.value.set(...p.deep);
      S.spec.value = p.spectrum;
      this.cb.onPalette(p);
    }

    if (this.paused) {
      for (const f of this.frameCbs) f(dt, t);
      return;
    }

    // light follows the camera: always a soft key from upper-left
    const m = this.camera.matrixWorld.elements;
    this.earth.lightDir.value.set(
      S.camDir.value.x * 0.9 - m[0] * 0.55 + m[4] * 0.6,
      S.camDir.value.y * 0.9 - m[1] * 0.55 + m[5] * 0.6,
      S.camDir.value.z * 0.9 - m[2] * 0.55 + m[6] * 0.6,
    ).normalize();

    // backdrop anchors to the globe's screen position
    const c = this.tmpV.set(0, 0, 0).project(this.camera);
    this.backdrop.center.value.set(c.x, c.y);
    const tanH = Math.tan((FOV * Math.PI) / 360);
    this.backdrop.radius.value = 1 / Math.sqrt(Math.max(dist * dist - 1, 0.01)) / tanH;
    this.backdrop.parallax.value.set(this.rig.lon * 0.018, this.rig.lat * 0.018);

    const surface = this.sky ? surfaceWeight(this.stageDist) : 1;
    this.presences.setSizeFor(dist, surface);
    this.setSurface(surface);
    this.presences.step(dt);
    if (render && !this.earth.generated) this.presences.renderDensity(); // the glow of the Earth's presences is the Earth's
    this.earth.step(dt, this.reduced);
    // the close-zoom tiles: the Earth's are NASA GIBS's (tilemath.ts); a generated body's are made by its own generator in a worker (bodyTiles.ts), never fetched
    this.tiles.update(this.camera, dt, this.width, this.height);
    this.markers.sel.step(dt, this.camera, this.height);
    this.markers.hover.step(dt, this.camera, this.height);
    this.markers.head.step(dt, this.camera, this.height);

    // hover (CPU pick, once per frame, only when the pointer moved)
    if (this.pointer.dirty) {
      this.pointer.dirty = false;
      let idx = -1;
      if (this.pointer.inside && this.surfaceOn && !this.rig.dragging && !this.rig.flying) {
        idx = this.presences.pick(this.pointer.x, this.pointer.y, this.camera, this.width, this.height, this.pickRadius());
      }
      this.hoverIdx = idx;
      this.cb.onHover(idx, this.pointer.x, this.pointer.y);
    } else if (this.hoverIdx >= 0 && (this.rig.dragging || this.rig.flying)) {
      this.hoverIdx = -1;
      this.cb.onHover(-1, 0, 0);
    }

    for (const f of this.frameCbs) f(dt, t);
    if (render) this.renderer.render(this.scene, this.camera);
  }

  /** The atlas's surface layers fade as the pull-back passes the Moon; fully off, they are not drawn. */
  private setSurface(w: number) {
    const on = w > 0.002;
    // [T-PROCEDURAL-BODY] the presences, their arcs and markers are the Earth's occurrences: a generated body in the Earth's place carries none of them, drawn or picked
    // (its tiles and its air are its own); they are the Earth's again when the Earth is
    const earthly = on && !this.earth.generated;
    this.surfaceOn = earthly;
    this.presences.mesh.visible = earthly;
    this.aura.points.visible = on;
    this.arcs.group.visible = earthly;
    this.tiles.group.visible = on;
    for (const m of [this.markers.sel, this.markers.hover, this.markers.head]) m.suppressed = !earthly;
  }

  // ── the body the globe draws (T-WORLDS §5 W3; manual §17.2 "Build a planet") ─────────────────────────────────────────────
  //
  // The Earth's imagery by default: the atlas exactly as it was. Given an owner's record (`aikit.world-body/v1`, read by the
  // kernel's world_body_read), the generated body (body.ts) stands in the Earth's place through the Earth's own texture seam:
  // a small base at once, the sharp one a moment later and blended in, as the Earth's own 2k and 4k/8k are. Earth stays given.

  private bodyRecord: WorldBodyRecord | null = null;
  private bodyLook: BodyLook | undefined = undefined;
  private bodyKey = '';
  /** the occasion the body's weather is shown at (ms); null is Now */
  private bodyTime: number | null = null;

  /** Draw the owner's body in the Earth's place, or (null) the Earth. The same record and look twice does nothing; an absent look, an empty one and barren 0 are one look. */
  setBody(record: WorldBodyRecord | null, look?: BodyLook) {
    const barren = barrenOf(look);
    const key = record ? JSON.stringify([record, barren]) : '';
    if (key === this.bodyKey) return;
    this.bodyKey = key;
    this.bodyRecord = record;
    this.bodyLook = record ? { barren } : undefined;
    if (!this.earth || this.released) return; // drawn when the Earth stands (init)
    if (!record) {
      this.earth.setGenerated(null);
      this.earth.setSky(null, 0, 1);
      this.earth.barren.value = 0;
      this.earth.detail.value = 0;
      this.earth.texRad.value = (2 * Math.PI) / 8192;
      this.shell.air.value = 1;
      this.bodyPictureState = 'earth';
      // the Earth's own tiles again
      this.tiles.setSource(gibsSource);
      this.tiles.enabled = true;
      this.tiles.minEmit = this.earthMinEmit;
      return;
    }
    this.drawBody(record, this.bodyLook, key);
    this.applyWeather();
  }

  /** The occasion the body's weather is shown at: a moment (ms), or null for Now. A past occasion shows the weather it had; Now moves slowly (the wind carries the
   * clouds a few tens of degrees a day), and reduced motion holds Now where the occasion was set. */
  setBodyTime(ms: number | null) {
    this.bodyTime = ms;
    this.applyWeather();
  }

  /** Hand the shader the body's wind and the occasion's time in days: from the occasion where there is one, from the clock for Now. */
  private applyWeather() {
    if (!this.earth) return;
    const record = this.bodyRecord;
    const scale = record && record.generator.version >= 2 ? weatherScale(record.seed) : 0;
    this.earth.weatherRate.value.set(WEATHER_BANDS[0]!.weight * scale, WEATHER_BANDS[1]!.weight * scale, WEATHER_BANDS[2]!.weight * scale);
    this.earth.weatherT.value = record ? weatherClock(record.seed, this.bodyTime ?? Date.now()) : 0;
  }

  /** The occasion the body is shown at (null: Now). */
  get occasion(): number | null {
    return this.bodyTime;
  }

  /** How far the body's pictures are made: the Earth's own, a coarse base while the sharp one is made, the sharp one with its clouds,
   * or why the sharp one could not be made (the coarse base then stands). */
  bodyPictureState: 'earth' | 'coarse' | 'sharp' | { readonly refused: string } = 'earth';

  /** The body the globe draws: its record, or null for the Earth. */
  get body(): WorldBodyRecord | null {
    return this.bodyRecord;
  }

  private drawBody(record: WorldBodyRecord, look: BodyLook | undefined, key: string) {
    const air = airOf(record, look);
    // at once, on the main thread: the first picture (BODY_WIDTHS.first wide, a few tens of milliseconds) and the body's air; its clouds come with the sharp base
    this.earth.setGenerated(bodyTexture(bodyImage(record, BODY_WIDTHS.first, look), this.renderer));
    // its ground is drawn finer than its pictures where the camera is close (shaders.ts detailOver); the texel is the first picture's until a sharper one is in
    this.earth.detail.value = 1;
    this.earth.texRad.value = (2 * Math.PI) / BODY_WIDTHS.first;
    this.earth.setSky(null, 0, air);
    this.earth.barren.value = barrenOf(look);
    this.shell.air.value = air;
    this.bodyPictureState = 'coarse';
    // its close-zoom tiles: made by its generator (a body of generator version 1 has none), wanted where they are denser than the base that will stand, as GIBS's are
    const widths = hiResChoice(this.renderer) ? [BODY_WIDTHS.lo, BODY_WIDTHS.hi] : [BODY_WIDTHS.lo];
    this.tiles.setSource(bodyTileSource(record, look));
    this.tiles.enabled = hasTiles(record);
    this.tiles.minEmit = tileLevelFor(widths[widths.length - 1]!);
    // the larger pictures are made off the main thread (bodyRender.ts: a module worker, else the main thread), in order, and each blended in as the Earth's sharp
    // base is (the Earth's 2k and 4k/8k): BODY_WIDTHS.lo where the GPU takes no more, then BODY_WIDTHS.hi where it does
    void this.drawBases(record, look, key, widths);
  }

  private async drawBases(record: WorldBodyRecord, look: BodyLook | undefined, key: string, widths: readonly number[]) {
    const air = airOf(record, look), cover = record.sky.clouds * (1 - barrenOf(look));
    for (const width of widths) {
      let pictures;
      try {
        pictures = await renderBody(record, width, Math.min(width, 1024), look);
      } catch (error: unknown) {
        // a later record, a return to the Earth or a release since: these pictures are not drawn
        if (this.released || this.bodyKey !== key) return;
        this.bodyPictureState = { refused: error instanceof Error ? error.message : String(error) };
        return;
      }
      if (this.released || this.bodyKey !== key) return;
      const hi = bodyTexture(pictures.image, this.renderer);
      this.renderer.initTexture(hi);
      this.earth.setGeneratedHi(hi);
      this.earth.texRad.value = (2 * Math.PI) / width;
      this.earth.setSky(bodyTexture(pictures.clouds, this.renderer), cover, air);
      this.bodyPictureState = 'sharp';
    }
  }

  /** Test/debug hook: current camera state. */
  get cameraState() {
    return { lat: this.rig.lat, lon: this.rig.lon, dist: this.rig.dist };
  }
}
