/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlacedInteractionPoint } from './types';

/** Live placement-preview state, mirrored from the overlay while a pin is being dropped. */
export interface PinGhostState {
  x: number;
  y: number;
  z: number;
  radius: number;
  mode: 'repel' | 'attract' | 'vortex';
}

const MODE_COLOR: Record<string, number> = {
  repel: 0xef4444,
  attract: 0x10b981,
  vortex: 0x06b6d4,
};
const GHOST_COLOR = 0x22d3ee;

function modeColorHex(mode: string): number {
  return MODE_COLOR[mode] ?? MODE_COLOR.repel;
}

// Rendered after everything else in the scene so the tiny dots always read through the particle field.
const RENDER_ORDER = 9999;

// Matches the dpr clamp PointCloudField uses for its own renderer so dot sizes feel consistent.
const DPR = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2.0);

const DOT_BASE_PX = 6; // ~3px radius for an unselected / inactive pin
const DOT_SELECTED_MULT = 1.5;

const DOT_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize;
  }
`;

const DOT_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float edge = 1.0 - smoothstep(0.34, 0.5, d);
    gl_FragColor = vec4(vColor, vAlpha * edge);
  }
`;

interface HighlightItem {
  x: number;
  y: number;
  z: number;
  radius: number;
  mode: 'repel' | 'attract' | 'vortex';
  colorHex: number;
  alpha: number;
}

/**
 * Owns the in-scene 3D representation of spatial pins: a tiny always-visible dot per pin, and a
 * (only-when-selected-or-ghost) wireframe influence-volume readout. Rebuilds its geometry only
 * when the underlying data actually changes (cheap signature compare) — never allocates per frame.
 */
export class PinMarkerLayer {
  private scene: THREE.Scene;
  private group: THREE.Group;

  private dotsGeometry: THREE.BufferGeometry;
  private dotsMaterial: THREE.ShaderMaterial;
  private dotsPoints: THREE.Points;

  private volumeGroup: THREE.Group;
  // Shared unit geometries (radius 1, centered at origin) reused across every highlighted pin —
  // per-instance placement/scale is applied via the wrapping Object3D, so these never get rebuilt.
  private sphereWireGeo: THREE.BufferGeometry;
  private ringGeo: THREE.BufferGeometry;

  private lastSignature: string = '';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.renderOrder = RENDER_ORDER;
    this.group.frustumCulled = false;

    this.dotsGeometry = new THREE.BufferGeometry();
    this.dotsMaterial = new THREE.ShaderMaterial({
      vertexShader: DOT_VERTEX_SHADER,
      fragmentShader: DOT_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.dotsPoints = new THREE.Points(this.dotsGeometry, this.dotsMaterial);
    this.dotsPoints.renderOrder = RENDER_ORDER;
    this.dotsPoints.frustumCulled = false;
    this.group.add(this.dotsPoints);

    this.volumeGroup = new THREE.Group();
    this.volumeGroup.renderOrder = RENDER_ORDER;
    this.group.add(this.volumeGroup);

    this.sphereWireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 18, 12));
    this.ringGeo = buildUnitCircleGeometry(64);

    this.scene.add(this.group);
  }

  public update(
    points: PlacedInteractionPoint[],
    activeId: string | null,
    ghost: PinGhostState | null,
    isLight: boolean,
    _camera: THREE.Camera
  ): void {
    const signature = JSON.stringify({
      p: points.map((p) => [p.id, r1(p.x), r1(p.y), r1(p.z ?? 0), r1(p.radius), p.mode, p.active]),
      a: activeId,
      g: ghost ? [r1(ghost.x), r1(ghost.y), r1(ghost.z), r1(ghost.radius), ghost.mode] : null,
      l: isLight,
    });
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.rebuildDots(points, activeId, ghost);
    this.rebuildVolumes(points, activeId, ghost);
  }

  private rebuildDots(points: PlacedInteractionPoint[], activeId: string | null, ghost: PinGhostState | null) {
    const count = points.length + (ghost ? 1 : 0);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    let i = 0;
    for (const p of points) {
      const isSelected = p.id === activeId;
      const c = new THREE.Color(modeColorHex(p.mode));
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z ?? 0;
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = (isSelected ? DOT_BASE_PX * DOT_SELECTED_MULT : DOT_BASE_PX) * DPR;
      alphas[i] = p.active ? (isSelected ? 1.0 : 1.0) : 0.35;
      // Inactive pins stay dim regardless of selection so "off" reads visually distinct.
      if (!p.active) alphas[i] = 0.35;
      i++;
    }
    if (ghost) {
      const c = new THREE.Color(GHOST_COLOR);
      positions[i * 3 + 0] = ghost.x;
      positions[i * 3 + 1] = ghost.y;
      positions[i * 3 + 2] = ghost.z;
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = DOT_BASE_PX * DOT_SELECTED_MULT * DPR;
      alphas[i] = 0.5;
      i++;
    }

    this.dotsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dotsGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.dotsGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.dotsGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.dotsGeometry.computeBoundingSphere();
  }

  private rebuildVolumes(points: PlacedInteractionPoint[], activeId: string | null, ghost: PinGhostState | null) {
    this.clearVolumeGroup();

    const items: HighlightItem[] = [];
    const active = activeId ? points.find((p) => p.id === activeId) : undefined;
    if (active) {
      items.push({
        x: active.x,
        y: active.y,
        z: active.z ?? 0,
        radius: active.radius,
        mode: active.mode,
        colorHex: modeColorHex(active.mode),
        alpha: 1.0,
      });
    }
    if (ghost) {
      items.push({
        x: ghost.x,
        y: ghost.y,
        z: ghost.z,
        radius: ghost.radius,
        mode: ghost.mode,
        colorHex: GHOST_COLOR,
        alpha: 0.5,
      });
    }

    for (const item of items) {
      this.buildVolumeFor(item);
    }
  }

  private buildVolumeFor(item: HighlightItem) {
    const wrap = new THREE.Group();
    wrap.position.set(item.x, item.y, 0); // local origin = ground point beneath the pin
    wrap.renderOrder = RENDER_ORDER;

    const color = new THREE.Color(item.colorHex);
    const hasZ = Math.abs(item.z) > 1;

    // Low-poly wireframe sphere = the influence volume, centered at the pin's actual elevation.
    const sphereMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22 * item.alpha,
      depthTest: false,
      depthWrite: false,
    });
    // Two faint meridian circles (XZ and YZ planes) give the sphere its 3D silhouette without a dense wire mesh
    for (const axis of ['x', 'y'] as const) {
      const meridian = new THREE.LineLoop(this.ringGeo, sphereMat);
      meridian.scale.setScalar(Math.max(1, item.radius));
      meridian.position.set(0, 0, item.z);
      if (axis === 'x') meridian.rotation.x = Math.PI / 2;
      else meridian.rotation.y = Math.PI / 2;
      meridian.renderOrder = RENDER_ORDER;
      wrap.add(meridian);
    }

    // Brighter equator ring in the pin's acting plane (XY), so the volume reads even top-down.
    const ringMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5 * item.alpha,
      depthTest: false,
      depthWrite: false,
    });
    const ring = new THREE.LineLoop(this.ringGeo, ringMat);
    ring.scale.setScalar(Math.max(1, item.radius));
    ring.position.set(0, 0, item.z);
    ring.renderOrder = RENDER_ORDER;
    wrap.add(ring);

    // Mode directional cue, sitting on the equator ring.
    const tickGeo = buildModeTickGeometry(item.radius, item.mode);
    const tickMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6 * item.alpha,
      depthTest: false,
      depthWrite: false,
    });
    const ticks = new THREE.LineSegments(tickGeo, tickMat);
    ticks.position.set(0, 0, item.z);
    ticks.renderOrder = RENDER_ORDER;
    wrap.add(ticks);

    // Vertical stem down to the ground plane + a tiny footprint ring, only when elevated.
    if (hasZ) {
      const stemGeo = new THREE.BufferGeometry();
      stemGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, item.z]), 3)
      );
      const stemMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45 * item.alpha,
        depthTest: false,
        depthWrite: false,
      });
      const stem = new THREE.Line(stemGeo, stemMat);
      stem.renderOrder = RENDER_ORDER;
      wrap.add(stem);

      const footprintRadius = Math.min(30, Math.max(4, item.radius * 0.05));
      const footprintMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55 * item.alpha,
        depthTest: false,
        depthWrite: false,
      });
      const footprint = new THREE.LineLoop(this.ringGeo, footprintMat);
      footprint.scale.setScalar(footprintRadius);
      footprint.renderOrder = RENDER_ORDER;
      wrap.add(footprint);
    }

    this.volumeGroup.add(wrap);
  }

  /** Disposes every per-instance geometry/material owned by the current highlight set (shared unit geometries are kept). */
  private clearVolumeGroup() {
    for (const wrap of this.volumeGroup.children.slice()) {
      wrap.traverse((obj) => {
        const geometry: THREE.BufferGeometry | undefined = (obj as any).geometry;
        const material: THREE.Material | undefined = (obj as any).material;
        if (geometry && geometry !== this.sphereWireGeo && geometry !== this.ringGeo) {
          geometry.dispose();
        }
        if (material) {
          material.dispose();
        }
      });
      this.volumeGroup.remove(wrap);
    }
  }

  public dispose(): void {
    this.clearVolumeGroup();
    this.scene.remove(this.group);
    this.dotsGeometry.dispose();
    this.dotsMaterial.dispose();
    this.sphereWireGeo.dispose();
    this.ringGeo.dispose();
  }
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

function buildUnitCircleGeometry(segments: number): THREE.BufferGeometry {
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(a);
    positions[i * 3 + 1] = Math.sin(a);
    positions[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}

/** Short radial ticks (repel/attract) or a small arrowed arc (vortex), scaled to the influence radius. */
function buildModeTickGeometry(radius: number, mode: 'repel' | 'attract' | 'vortex'): THREE.BufferGeometry {
  const pts: number[] = [];

  if (mode === 'vortex') {
    const arms = 4;
    const arcSpan = 0.5;
    const steps = 3;
    for (let i = 0; i < arms; i++) {
      const a0 = (i / arms) * Math.PI * 2;
      for (let s = 0; s < steps; s++) {
        const t0 = a0 + (s / steps) * arcSpan;
        const t1 = a0 + ((s + 1) / steps) * arcSpan;
        pts.push(
          Math.cos(t0) * radius * 1.08, Math.sin(t0) * radius * 1.08, 0,
          Math.cos(t1) * radius * 1.08, Math.sin(t1) * radius * 1.08, 0
        );
      }
      // Tangential tick at the head of each arc, hinting at spin direction.
      const endA = a0 + arcSpan;
      const ex = Math.cos(endA) * radius * 1.08;
      const ey = Math.sin(endA) * radius * 1.08;
      const tangent = endA + Math.PI / 2 - 0.5;
      pts.push(ex, ey, 0, ex + Math.cos(tangent) * radius * 0.14, ey + Math.sin(tangent) * radius * 0.14, 0);
    }
  } else {
    const n = 8;
    const inner = mode === 'attract' ? radius * 1.35 : radius * 1.02;
    const outer = mode === 'attract' ? radius * 1.02 : radius * 1.35;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      pts.push(cx * inner, sy * inner, 0, cx * outer, sy * outer, 0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}
