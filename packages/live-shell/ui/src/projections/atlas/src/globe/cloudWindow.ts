// The sky's window about the camera (T-PROCEDURAL-BODY round 3). The cloud field is analytic (bodyWeather.ts cloudField), so it can be asked at any resolution as the ground is; the mask
// the shader reads (a picture of 1024 texels round the world) cannot be, and at a region view one of its texels is sixteen pixels. Where the camera is near, this makes a texture of the
// field itself over the rectangle of the sphere the camera sees: 1024 by 1024 texels, about a texel to the pixel, in chunks of 256 (a few tens of milliseconds each, in the worker's lane
// the tiles use), shown when whole, in the mask's place (shaders.ts skyOver). It is the body's own and is never kept: not a look, not a weather, not a setting; made from the record, the
// look and the occasion, and given back with the body.
//
// It was made at one occasion and the wind has carried the sky since: the shader turns its lookup by the wind's shift between the window's occasion and the occasion drawn (`uWinT`, the
// weather's clock then, in days), so a window outlives a minute of weather; when the sky has moved further than the window's margin it is made again (the old one stands until the new is whole).
//
// Host code with no counterpart in the atlas it was ported from (PORT-PIN portNew).
import * as THREE from 'three';
import { weatherClock, weatherScale } from './bodyWeather';
import { renderCloudChunk } from './bodyRender';
import type { BodyLook, CloudRegion, WorldBodyRecord } from './body';

const D2R = Math.PI / 180;
/** The window's size in texels, and the chunk it is made in. */
export const WINDOW_N = 1024;
export const WINDOW_CHUNK = 256;
/** The camera's distance (radii) beyond which there is no window: a pixel is wider than the mask's own texel can bear, and the mask is the sky. */
const FAR = 1.95;
/** The camera's distance (radii) under which there is no window: the sky fades out at a place view (shaders.ts nearSky: a pixel under 30 micro-radians), and ground tiles want the lane. */
const NEAR = 1.04;
/** The latitude beyond which the window is not made (its longitude span grows without bound toward the pole); the mask is the sky there. */
const POLAR = 74;
const TAN_HALF_FOV = Math.tan((38 * Math.PI) / 360);
/** How far the sky may have moved since the window was made before it is made again (degrees of longitude at the fastest band): a part of the window's margin. */
const STALE_DEG = 0.4;
const FADE = 0.45;
/** A view that moves faster than this (degrees of the surface a second: the world turning at rest is 2.1) is sweeping, and no window is begun until it has stood for SETTLE_S seconds. */
const SWEEP_DEG_PER_S = 0.8;
const SETTLE_S = 0.3;

export interface SkyWindowUniforms {
  readonly win: THREE.IUniform<THREE.Texture>;
  readonly rect: THREE.IUniform<THREE.Vector4>;
  readonly on: THREE.IUniform<number>;
  readonly time: THREE.IUniform<number>;
}

/** What the window is told each frame. */
export interface SkyView {
  /** the body drawn, and how it is drawn; null for the Earth */
  readonly record: WorldBodyRecord | null;
  readonly look?: BodyLook;
  /** whether it has a sky at all (the clouds dial above 0 and the look not barren) and its cloud layer has arrived */
  readonly cloudy: boolean;
  /** the camera's distance from the body's centre (radii) and the place under it (degrees) */
  readonly dist: number;
  readonly lat: number;
  readonly lon: number;
  /** the occasion drawn (ms) */
  readonly time: number;
}

interface Building {
  readonly id: number;
  readonly region: CloudRegion;
  readonly time: number;
  readonly clock: number;
  readonly data: Uint8Array;
  readonly abort: AbortController;
  pending: number;
}

/** How much of the sphere the camera sees from `dist` radii, as a half-width in degrees (the camera looks down at the body: a point of the surface `dist - 1` below it, the view
 * 38 degrees tall, and a margin for the aspect and the tilt of the view); and how wide a window is made for it (a margin more, so that a small pan makes no new window). */
export const visibleHalf = (dist: number): number => ((dist - 1) * TAN_HALF_FOV * 1.15 + 0.015) / D2R;
const MARGIN = 1.45;

/** The region of the sphere to make a window of, for a camera at `dist` radii over a latitude and longitude (degrees): centred to half a degree, as wide as the view with its margin, so that
 * a texel is about a pixel; null where there is no window (too far, too close to be the sky, or too near a pole). */
export function wantedRegion(dist: number, lat: number, lon: number): CloudRegion | null {
  if (dist > FAR || dist < NEAR || Math.abs(lat) > POLAR) return null;
  const half = Math.min(60, visibleHalf(dist) * MARGIN);
  const lat0 = Math.round(lat * 2) / 2, lon0 = Math.round(lon * 2) / 2;
  return { lat0, lon0, halfLat: half, halfLon: Math.min(180, half / Math.max(Math.cos(lat0 * D2R), 0.27)) };
}

const wrapped = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

export class SkyWindow {
  private texture: THREE.DataTexture | null = null;
  private region: CloudRegion | null = null;
  private clock = 0;
  private building: Building | null = null;
  private serial = 0;
  private target = 0;
  /** where the camera was last frame and for how long it has stood nearly still (seconds): a window is not begun while the view is sweeping (the world turning, a flight), only when it settles */
  private last: { lat: number; lon: number } | null = null;
  private still = 0;

  constructor(private readonly u: SkyWindowUniforms, private readonly renderer: THREE.WebGLRenderer) {}

  /** The window as it stands: its region, and whether a window is being made. */
  get standing(): CloudRegion | null { return this.region; }
  get making(): boolean { return this.building !== null; }

  /** One frame: fade, and ask for a window where one is wanted and none stands that serves. */
  update(dt: number, view: SkyView): void {
    const moved = this.last ? Math.hypot(view.lat - this.last.lat, wrapped(view.lon - this.last.lon) * Math.cos(view.lat * D2R)) : 0;
    this.last = { lat: view.lat, lon: view.lon };
    this.still = dt > 0 && moved / dt > SWEEP_DEG_PER_S ? 0 : this.still + dt;
    const want = view.record && view.cloudy && view.record.generator.version >= 2 ? wantedRegion(view.dist, view.lat, view.lon) : null;
    if (!want) {
      this.cancel();
      this.target = 0;
    } else {
      this.target = this.region ? 1 : 0; // shown once a window has been made, not before
      const standing = this.region && this.serves(this.region, this.clock, view), coming = this.building && this.serves(this.building.region, this.building.clock, view);
      if (!standing && !coming && this.still >= SETTLE_S) this.make(view.record!, view.look, want, view.time);
    }
    const on = this.u.on.value, step = dt / FADE;
    this.u.on.value = on < this.target ? Math.min(this.target, on + step) : Math.max(this.target, on - step);
    if (this.u.on.value === 0 && !this.building && !want) this.release();
  }

  /** Whether a window made over `have` at the weather's clock `clock` serves the view: it holds what the camera sees, is not much coarser than wanted, and the sky has not moved far from
   * where it was made. */
  private serves(have: CloudRegion, clock: number, view: SkyView): boolean {
    const seen = visibleHalf(view.dist), cos = Math.max(Math.cos(view.lat * D2R), 0.27);
    if (have.halfLat > 2.4 * Math.min(60, seen * MARGIN)) return false; // a window much larger than wanted is a coarse one
    if (Math.abs(have.lat0 - view.lat) + seen > have.halfLat * 0.97) return false;
    if (Math.abs(wrapped(have.lon0 - view.lon)) + seen / cos > have.halfLon * 0.97) return false;
    const record = view.record!;
    return weatherScale(record.seed) * Math.abs(weatherClock(record.seed, view.time) - clock) <= STALE_DEG;
  }

  private make(record: WorldBodyRecord, look: BodyLook | undefined, region: CloudRegion, time: number): void {
    this.building?.abort.abort();
    const id = ++this.serial, abort = new AbortController(), data = new Uint8Array(WINDOW_N * WINDOW_N);
    const building: Building = { id, region, time, clock: weatherClock(record.seed, time), data, abort, pending: 0 };
    this.building = building;
    const per = WINDOW_N / WINDOW_CHUNK;
    for (let cj = 0; cj < per; cj++) {
      for (let ci = 0; ci < per; ci++) {
        const part = { i0: ci * WINDOW_CHUNK, j0: cj * WINDOW_CHUNK, w: WINDOW_CHUNK, h: WINDOW_CHUNK };
        building.pending++;
        renderCloudChunk(record, region, WINDOW_N, part, time, look, abort.signal).then((image) => {
          if (this.building !== building) return;
          for (let j = 0; j < part.h; j++) for (let i = 0; i < part.w; i++) data[(part.j0 + j) * WINDOW_N + part.i0 + i] = image.data[(j * part.w + i) * 4]!;
          if (--building.pending === 0) this.arrive(building);
        }, () => { /* given up on, or refused: the window that stands, or the mask, is the sky */ });
      }
    }
  }

  private arrive(building: Building): void {
    this.building = null;
    const tex = new THREE.DataTexture(building.data, WINDOW_N, WINDOW_N, THREE.RedFormat);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false; // the data's row 0 is the north edge (the first row is v = 0, which the shader reads as north)
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.renderer.initTexture(tex);
    const old = this.texture;
    this.texture = tex;
    this.region = building.region;
    this.clock = building.clock;
    const r = building.region;
    this.u.win.value = tex;
    this.u.rect.value.set(r.lon0 * D2R, r.lat0 * D2R, 1 / (2 * r.halfLon * D2R), 1 / (2 * r.halfLat * D2R));
    this.u.time.value = building.clock;
    old?.dispose();
  }

  private cancel(): void {
    this.building?.abort.abort();
    this.building = null;
  }

  /** The window is given up (the body is put down, or the camera has gone far): nothing is kept. */
  private release(): void {
    this.texture?.dispose();
    this.texture = null;
    this.region = null;
  }

  /** The body is put down: no window, shown or made. */
  clear(): void {
    this.cancel();
    this.target = 0;
    this.u.on.value = 0;
    this.release();
  }

  dispose(): void {
    this.clear();
  }
}
