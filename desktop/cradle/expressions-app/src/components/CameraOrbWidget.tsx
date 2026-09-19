/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Hand, Rotate3d, Grid3x3, Axis3d, ChevronUp } from 'lucide-react';
import { CameraOrbState } from '../engine/types';
import { SpatialGridMode } from '../engine/PointCloudField';

export type CameraPreset = 'faceOn' | 'perspective' | 'top' | 'side';

export interface CameraOrbWidgetProps {
  cameraState: CameraOrbState | null;
  onSetOrbit: (pitch: number, yaw: number) => void;
  onSetPan: (panX: number, panY: number) => void;
  onSetZoom: (zoom: number) => void;
  onReset: (preset?: CameraPreset) => void;
  isLight: boolean;
  isUIHidden?: boolean;
  gridMode: SpatialGridMode;
  onCycleGridMode: () => void;
  isPanMode: boolean;
  onTogglePanMode: () => void;
}

const R = 34;
const CX = 40;
const CY = 40;
const PITCH_LIMIT = Math.PI * 0.47;

interface Projected {
  x: number;
  y: number;
  depth: number;
}

export const CameraOrbWidget: React.FC<CameraOrbWidgetProps> = ({
  cameraState,
  onSetOrbit,
  onSetPan,
  onSetZoom,
  onReset,
  isLight,
  isUIHidden = false,
  gridMode,
  onCycleGridMode,
  isPanMode,
  onTogglePanMode,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, pitch: 0, yaw: 0, panX: 0, panY: 0 });

  const pitch = cameraState?.pitch ?? 0.0;
  const yaw = cameraState?.yaw ?? 0.0;
  const zoom = cameraState?.zoom ?? 1.0;
  const panX = cameraState?.panX ?? 0;
  const panY = cameraState?.panY ?? 0;

  const pitchDeg = Math.round((pitch * 180) / Math.PI);
  const yawDeg = Math.round((((yaw * 180) / Math.PI + 540) % 360) - 180);

  // ---- Camera basis (matches PointCloudField.updateCameraTransform) ----
  // right = (cosY, 0, -sinY); up ∝ (-sinP sinY, cosP, -sinP cosY); toward-camera n = (cosP sinY, sinP, cosP cosY)
  const basis = useMemo(() => {
    const cP = Math.cos(pitch);
    const sP = Math.sin(pitch);
    const cY = Math.cos(yaw);
    const sY = Math.sin(yaw);
    return {
      right: [cY, 0, -sY] as const,
      up: [-sP * sY, cP, -sP * cY] as const,
      n: [cP * sY, sP, cP * cY] as const,
    };
  }, [pitch, yaw]);

  const project = (x: number, y: number, z: number): Projected => {
    const { right, up, n } = basis;
    return {
      x: CX + (x * right[0] + y * right[1] + z * right[2]) * R,
      y: CY - (x * up[0] + y * up[1] + z * up[2]) * R,
      depth: x * n[0] + y * n[1] + z * n[2],
    };
  };

  /** Sample a circle on the unit sphere and split into front / back path strings */
  const circlePaths = (pointAt: (t: number) => [number, number, number], samples = 64) => {
    const pts: Projected[] = [];
    for (let i = 0; i <= samples; i++) {
      const [x, y, z] = pointAt((i / samples) * Math.PI * 2);
      pts.push(project(x, y, z));
    }
    let front = '';
    let back = '';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const seg = `M${a.x.toFixed(2)},${a.y.toFixed(2)}L${b.x.toFixed(2)},${b.y.toFixed(2)}`;
      if (a.depth + b.depth >= 0) front += seg;
      else back += seg;
    }
    return { front, back };
  };

  const wire = useMemo(() => {
    const lat: Array<{ front: string; back: string; isEquator: boolean }> = [];
    [-60, -30, 0, 30, 60].forEach((deg) => {
      const phi = (deg * Math.PI) / 180;
      const r = Math.cos(phi);
      const y = Math.sin(phi);
      lat.push({ ...circlePaths((t) => [r * Math.cos(t), y, r * Math.sin(t)]), isEquator: deg === 0 });
    });
    const lon: Array<{ front: string; back: string; isPrime: boolean }> = [];
    [0, 45, 90, 135].forEach((deg) => {
      const th = (deg * Math.PI) / 180;
      lon.push({
        ...circlePaths((t) => [Math.cos(t) * Math.sin(th), Math.sin(t), Math.cos(t) * Math.cos(th)]),
        isPrime: deg === 0,
      });
    });
    return { lat, lon };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, yaw]);

  const markers = [
    { key: 'N', v: [0, 1, 0], color: isLight ? '#0369a1' : '#22d3ee', label: 'N' },
    { key: 'S', v: [0, -1, 0], color: '#f59e0b', label: 'S' },
    { key: 'E', v: [1, 0, 0], color: isLight ? '#c2410c' : '#ff6b81', label: 'E' },
    { key: 'W', v: [-1, 0, 0], color: isLight ? '#c2410c' : '#ff6b81', label: 'W' },
    { key: 'F', v: [0, 0, 1], color: isLight ? '#1c1917' : '#ffffff', label: 'F' },
    { key: 'B', v: [0, 0, -1], color: isLight ? '#57534e' : '#a1a1aa', label: 'B' },
  ].map((m) => ({ ...m, p: project(m.v[0], m.v[1], m.v[2]) }));

  // ---- Interaction ----
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, pitch, yaw, panX, panY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const panning = isPanMode || e.shiftKey || e.buttons === 4;
    if (panning) {
      onSetPan(dragStart.current.panX - (dx * 2.0) / zoom, dragStart.current.panY + (dy * 2.0) / zoom);
    } else {
      // Grab-the-globe: drag right spins the scene to the right (yaw decreases),
      // drag down tips the top of the scene toward the viewer (pitch increases).
      const nextYaw = dragStart.current.yaw - dx * 0.012;
      const nextPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, dragStart.current.pitch + dy * 0.012));
      onSetOrbit(nextPitch, nextYaw);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // React wheel listeners are passive: no preventDefault (the page cannot scroll anyway)
    e.stopPropagation();
    onSetZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  if (isUIHidden) return null;

  const stroke = isLight ? 'rgba(28,25,23,' : 'rgba(244,244,245,';
  const btn = `p-1 rounded border transition-all ${isLight ? 'border-stone-300 hover:bg-stone-200/70' : 'border-zinc-800 hover:bg-zinc-800'}`;

  const presetBtn = (label: string, hint: string, preset: CameraPreset, accent?: boolean) => (
    <button
      type="button"
      onClick={() => {
        onReset(preset);
        setShowMenu(false);
      }}
      className={`w-full text-left px-2 py-1.5 rounded hover:bg-stone-500/10 transition-colors flex items-center justify-between ${accent ? 'text-cyan-400 font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span className="opacity-50 text-[9px]">{hint}</span>
    </button>
  );

  return (
    <div
      id="persistent-camera-orb"
      className="fixed bottom-3 left-3 z-40 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showMenu && (
        <div
          className={`absolute bottom-full left-0 mb-2 w-56 rounded-lg border shadow-2xl p-1.5 backdrop-blur-2xl flex flex-col gap-0.5 text-[11px] font-mono z-50 ${
            isLight ? 'bg-white/98 border-stone-200 text-stone-900 shadow-stone-400/25' : 'bg-zinc-900/98 border-zinc-800 text-zinc-200 shadow-black/80'
          }`}
        >
          <div className="px-2 py-1 text-[9px] uppercase tracking-wider opacity-50 border-b border-inherit font-semibold">Camera views</div>
          {presetBtn('Face-on (front, centred)', 'P 0° · Y 0°', 'faceOn', true)}
          {presetBtn('Perspective (isometric)', 'P 30° · Y 12°', 'perspective')}
          {presetBtn('Top-down (planar)', 'P 85°', 'top')}
          {presetBtn('Side (profile)', 'Y 90°', 'side')}
          <div className="border-t border-inherit my-0.5" />
          <div className="px-2 py-1 text-[8.5px] opacity-50 leading-tight">
            Globe: drag to orbit · shift-drag to pan · wheel to zoom · double-click resets.
            <br />Canvas: right-drag orbits · middle / shift-drag pans · Pan mode makes left-drag pan.
          </div>
        </div>
      )}

      <div
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl border backdrop-blur-md transition-all duration-300 shadow-xl ${
          isHovered || showMenu || isPanMode ? 'opacity-100' : 'opacity-60 hover:opacity-100'
        } ${isLight ? 'bg-white/95 border-stone-200 text-stone-900 shadow-stone-300/30' : 'bg-zinc-950/95 border-zinc-800 text-zinc-200 shadow-black/60'}`}
      >
        {/* Globe */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onDoubleClick={() => onReset('faceOn')}
          title={`Camera globe · ${isPanMode ? 'PAN' : 'ORBIT'}\nDrag to ${isPanMode ? 'pan' : 'orbit'} · shift-drag to pan · wheel to zoom · double-click to reset face-on`}
          className={`relative w-20 h-20 rounded-full shrink-0 cursor-grab active:cursor-grabbing transition-shadow ${
            isPanMode ? 'ring-2 ring-amber-500/70' : 'hover:ring-2 hover:ring-cyan-500/40'
          }`}
        >
          <svg viewBox="0 0 80 80" className="w-full h-full pointer-events-none">
            <defs>
              <radialGradient id="globeShade" cx="38%" cy="34%" r="70%">
                <stop offset="0%" stopColor={isLight ? '#ffffff' : '#3f3f46'} stopOpacity="0.9" />
                <stop offset="65%" stopColor={isLight ? '#e7e5e4' : '#18181b'} stopOpacity="0.85" />
                <stop offset="100%" stopColor={isLight ? '#c7c2bd' : '#050507'} stopOpacity="1" />
              </radialGradient>
            </defs>
            <circle cx={CX} cy={CY} r={R} fill="url(#globeShade)" stroke={`${stroke}0.25)`} strokeWidth="1" />

            {/* Back hemisphere wire (faint) */}
            {wire.lat.map((c, i) => (
              <path key={`lb${i}`} d={c.back} stroke={c.isEquator ? (isLight ? '#0369a1' : '#22d3ee') : `${stroke}1)`} strokeWidth={c.isEquator ? 0.8 : 0.5} opacity={c.isEquator ? 0.25 : 0.12} fill="none" />
            ))}
            {wire.lon.map((c, i) => (
              <path key={`ob${i}`} d={c.back} stroke={`${stroke}1)`} strokeWidth={c.isPrime ? 0.8 : 0.5} opacity={c.isPrime ? 0.2 : 0.12} fill="none" />
            ))}
            {/* Front hemisphere wire */}
            {wire.lat.map((c, i) => (
              <path key={`lf${i}`} d={c.front} stroke={c.isEquator ? (isLight ? '#0369a1' : '#22d3ee') : `${stroke}1)`} strokeWidth={c.isEquator ? 1.1 : 0.6} opacity={c.isEquator ? 0.85 : 0.35} fill="none" />
            ))}
            {wire.lon.map((c, i) => (
              <path key={`of${i}`} d={c.front} stroke={c.isPrime ? (isLight ? '#1c1917' : '#ffffff') : `${stroke}1)`} strokeWidth={c.isPrime ? 1.0 : 0.6} opacity={c.isPrime ? 0.6 : 0.35} fill="none" />
            ))}

            {/* Axis poles / cardinal markers (back ones drawn dim, then front) */}
            {markers
              .slice()
              .sort((a, b) => a.p.depth - b.p.depth)
              .map((m) => {
                const front = m.p.depth >= 0;
                const isF = m.key === 'F';
                return (
                  <g key={m.key} opacity={front ? 1 : 0.28}>
                    {isF ? (
                      <>
                        <circle cx={m.p.x} cy={m.p.y} r={front ? 3.2 : 2.2} fill="none" stroke={m.color} strokeWidth="1.2" />
                        <circle cx={m.p.x} cy={m.p.y} r="1" fill={m.color} />
                      </>
                    ) : (
                      <circle cx={m.p.x} cy={m.p.y} r={front ? 2.6 : 1.8} fill={m.color} stroke={isLight ? '#ffffff' : '#000000'} strokeWidth="0.8" />
                    )}
                    {front && (
                      <text x={m.p.x + 4} y={m.p.y + 3} fill={m.color} fontSize="7" fontWeight="bold" fontFamily="monospace">
                        {m.label}
                      </text>
                    )}
                  </g>
                );
              })}

            {/* Rim highlight */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={`${stroke}0.35)`} strokeWidth="0.8" />
          </svg>

          {isPanMode && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-black text-[7px] font-bold px-1 rounded-sm shadow">PAN</div>
          )}
        </div>

        {/* Telemetry + controls */}
        <div className="flex flex-col justify-between text-[10px] font-mono leading-tight min-w-[132px]">
          <div className="flex items-center justify-between gap-2">
            <span className="opacity-50 text-[9px] uppercase tracking-wider font-semibold">Camera</span>
            <button
              type="button"
              onClick={() => setShowMenu((p) => !p)}
              className="flex items-center gap-0.5 text-[9px] opacity-70 hover:opacity-100 hover:text-cyan-400 transition-opacity"
              title="Camera view presets"
            >
              <span>Views</span>
              <ChevronUp className={`w-2.5 h-2.5 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5 mt-1 tabular-nums">
            <div className="flex justify-between"><span className="opacity-40">Pitch</span><span className="font-semibold">{pitchDeg}°</span></div>
            <div className="flex justify-between"><span className="opacity-40">Yaw</span><span className="font-semibold">{yawDeg}°</span></div>
            <div className="flex justify-between"><span className="opacity-40">Zoom</span><span className="font-semibold">{zoom.toFixed(2)}×</span></div>
            <div className="flex justify-between"><span className="opacity-40">Pan</span><span className="font-semibold">{Math.round(panX)},{Math.round(panY)}</span></div>
          </div>

          <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-inherit/40">
            <button
              type="button"
              onClick={() => onReset('faceOn')}
              title="Reset camera: central face-on view (R)"
              className={`${btn} px-1.5 flex items-center gap-1 text-[8.5px] uppercase font-medium hover:text-cyan-400`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onTogglePanMode}
              title={isPanMode ? 'Pan mode ON: left-drag pans the canvas (P)' : 'Orbit mode: enable pan mode (P)'}
              className={`${btn} ${isPanMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/60' : 'opacity-70 hover:opacity-100'}`}
            >
              {isPanMode ? <Hand className="w-2.5 h-2.5" /> : <Rotate3d className="w-2.5 h-2.5" />}
            </button>
            <button
              type="button"
              onClick={onCycleGridMode}
              title={`Spatial scaffold: ${gridMode.toUpperCase()} (G cycles off → axis → grid)`}
              className={`${btn} ${gridMode !== 'off' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/60' : 'opacity-70 hover:opacity-100'}`}
            >
              {gridMode === 'grid' ? <Grid3x3 className="w-2.5 h-2.5" /> : <Axis3d className="w-2.5 h-2.5" />}
            </button>
            <button type="button" onClick={() => onSetZoom(zoom * 1.15)} title="Zoom in" className={`${btn} opacity-70 hover:opacity-100`}>
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
            <button type="button" onClick={() => onSetZoom(zoom * 0.87)} title="Zoom out" className={`${btn} opacity-70 hover:opacity-100`}>
              <ZoomOut className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
