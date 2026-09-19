/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Trash2, ArrowUpDown } from 'lucide-react';
import { PlacedInteractionPoint } from '../engine/types';
import { SpatialGridMode } from '../engine/PointCloudField';
import { PinGhostState } from '../engine/pinMarkers';

export interface SpatialScaffoldOverlayProps {
  points: PlacedInteractionPoint[];
  activePointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onUpdatePoint: (id: string, updates: Partial<PlacedInteractionPoint>) => void;
  onDeletePoint: (id: string) => void;
  /** keepPlacing = true when the user shift-clicks to drop several pins in a row */
  onAddPointAt: (pos: { x: number; y: number; z: number }, keepPlacing: boolean) => void;
  isPlacementMode: boolean;
  onExitPlacementMode: () => void;
  gridMode: SpatialGridMode;
  isLight: boolean;
  /** Radius the ghost pin previews while placing (matches the pin that will be created) */
  placementRadius?: number;
  /** Mode the ghost pin previews while placing (matches the pin that will be created) */
  placementMode?: 'repel' | 'attract' | 'vortex';
  /** Reports the live placement-preview position/radius/mode so the engine can draw the ghost as a real 3D object; null when not placing. */
  onGhostChange: (ghost: PinGhostState | null) => void;
  /** Optional engine-side nearest-pin hit test (screen space) — used as a courtesy pick when clicking near an existing pin instead of dropping a new one. */
  onPickPin?: (screenX: number, screenY: number) => string | null;
  projectWorldToScreen: (x: number, y: number, z?: number) => { x: number; y: number; visible: boolean };
  unprojectScreenToWorld: (screenX: number, screenY: number, planeZ?: number) => { x: number; y: number; z: number };
}

const Z_LIMIT = 1500;
const XY_LIMIT = 6000;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const SpatialScaffoldOverlay: React.FC<SpatialScaffoldOverlayProps> = ({
  points,
  activePointId,
  onSelectPoint,
  onUpdatePoint,
  onDeletePoint,
  onAddPointAt,
  isPlacementMode,
  onExitPlacementMode,
  gridMode,
  isLight,
  placementRadius = 220,
  placementMode = 'vortex',
  onGhostChange,
  onPickPin,
  projectWorldToScreen,
  unprojectScreenToWorld,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // Placement ghost state: cursor on screen + depth chosen with wheel / keys / Z slider
  const [cursorScreen, setCursorScreen] = useState<{ x: number; y: number } | null>(null);
  const [placeZ, setPlaceZ] = useState<number>(0);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Dragging state for existing pins
  const draggingPointRef = useRef<{
    id: string;
    startScreenX: number;
    startScreenY: number;
    startX: number;
    startY: number;
    startZ: number;
    mode: 'xy' | 'z';
  } | null>(null);

  // Re-render every frame so SVG overlays follow camera orbit / pan / zoom
  const [, setTick] = useState(0);
  useEffect(() => {
    let animId: number;
    const loop = () => {
      setTick((t) => (t + 1) % 100000);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Reset ghost state when placement mode is toggled
  useEffect(() => {
    if (!isPlacementMode) {
      setCursorScreen(null);
    }
  }, [isPlacementMode]);

  // Keyboard: Escape exits placement, arrows / PageUp / PageDown adjust depth
  useEffect(() => {
    if (!isPlacementMode) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onExitPlacementMode();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setPlaceZ((z) => clamp(z + (e.shiftKey || e.key === 'PageUp' ? 100 : 10), -Z_LIMIT, Z_LIMIT));
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setPlaceZ((z) => clamp(z - (e.shiftKey || e.key === 'PageDown' ? 100 : 10), -Z_LIMIT, Z_LIMIT));
      } else if (e.key === '0') {
        setPlaceZ(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlacementMode, onExitPlacementMode]);

  const snap = useCallback(
    (v: number) => (snapToGrid ? Math.round(v / 10) * 10 : Math.round(v)),
    [snapToGrid]
  );

  const ghostWorld = (() => {
    if (!isPlacementMode || !cursorScreen) return null;
    const w = unprojectScreenToWorld(cursorScreen.x, cursorScreen.y, placeZ);
    return {
      x: clamp(snap(w.x), -XY_LIMIT, XY_LIMIT),
      y: clamp(snap(w.y), -XY_LIMIT, XY_LIMIT),
      z: placeZ,
    };
  })();

  // The ghost pin itself is now a real 3D object drawn by the engine — report its live state up
  // so PointCloudField can draw it, instead of rendering a DOM/SVG marker here.
  useEffect(() => {
    if (ghostWorld) {
      onGhostChange({ x: ghostWorld.x, y: ghostWorld.y, z: ghostWorld.z, radius: placementRadius, mode: placementMode });
    } else {
      onGhostChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostWorld?.x, ghostWorld?.y, ghostWorld?.z, placementRadius, placementMode]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (draggingPointRef.current) {
      const { id, startScreenX, startScreenY, startX, startY, startZ, mode } = draggingPointRef.current;
      const dy = screenY - startScreenY;
      if (mode === 'z' || e.shiftKey) {
        const newZ = Math.round(startZ - dy * 1.5);
        onUpdatePoint(id, { z: clamp(newZ, -Z_LIMIT, Z_LIMIT) });
      } else {
        const currentWorld = unprojectScreenToWorld(screenX, screenY, startZ);
        const initialWorld = unprojectScreenToWorld(startScreenX, startScreenY, startZ);
        onUpdatePoint(id, {
          x: clamp(Math.round(startX + (currentWorld.x - initialWorld.x)), -XY_LIMIT, XY_LIMIT),
          y: clamp(Math.round(startY + (currentWorld.y - initialWorld.y)), -XY_LIMIT, XY_LIMIT),
        });
      }
      return;
    }

    if (isPlacementMode) {
      setCursorScreen({ x: screenX, y: screenY });
    }
  };

  const handlePointerUp = () => {
    draggingPointRef.current = null;
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacementMode || !ghostWorld) return;
    // Clicking right on top of an existing pin selects it instead of stacking a duplicate.
    if (onPickPin) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const hitId = onPickPin(e.clientX - rect.left, e.clientY - rect.top);
        if (hitId) {
          onSelectPoint(hitId);
          return;
        }
      }
    }
    onAddPointAt({ ...ghostWorld }, e.shiftKey);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isPlacementMode) return;
    e.stopPropagation();
    const stepSize = e.shiftKey ? 50 : 10;
    setPlaceZ((z) => clamp(z + (e.deltaY < 0 ? stepSize : -stepSize), -Z_LIMIT, Z_LIMIT));
  };

  const startDragging = (
    e: React.PointerEvent,
    id: string,
    startX: number,
    startY: number,
    startZ: number,
    mode: 'xy' | 'z'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    draggingPointRef.current = {
      id,
      startScreenX: e.clientX - (rect?.left ?? 0),
      startScreenY: e.clientY - (rect?.top ?? 0),
      startX,
      startY,
      startZ,
      mode,
    };
    onSelectPoint(id);
  };

  const getModeColor = (mode: string) => {
    if (mode === 'attract') return '#10b981';
    if (mode === 'vortex') return '#06b6d4';
    return '#ef4444';
  };

  const showLabels = gridMode === 'grid';
  const showOrigin = gridMode !== 'off';

  if (!isPlacementMode && gridMode === 'off' && points.length === 0) {
    return null;
  }

  const labelFill = isLight ? 'rgba(41,37,36,0.55)' : 'rgba(228,228,231,0.5)';
  const axisFill = { x: isLight ? '#c2410c' : '#ff6b81', y: isLight ? '#047857' : '#34d399', z: isLight ? '#0369a1' : '#22d3ee' };

  /**
   * The pin itself (dot + influence-volume wireframe + stem) is now a real 3D object drawn by the
   * engine's PinMarkerLayer. All this overlay draws per-pin is the readable coordinate scaffold —
   * dashed projections onto the X/Y axes — and only while the full grid is up.
   */
  const renderCoordProjection = (key: string, x: number, y: number, z: number, color: string) => {
    if (!showLabels) return null;
    const ground = projectWorldToScreen(x, y, 0);
    if (!ground.visible) return null;
    const pos = Math.abs(z) > 0.5 ? projectWorldToScreen(x, y, z) : ground;
    const onXAxis = projectWorldToScreen(x, 0, 0);
    const onYAxis = projectWorldToScreen(0, y, 0);
    const origin = projectWorldToScreen(0, 0, 0);
    const hasZ = Math.abs(z) > 0.5;

    return (
      <g key={key}>
        <line x1={ground.x} y1={ground.y} x2={onXAxis.x} y2={onXAxis.y} stroke={axisFill.y} strokeWidth="0.75" strokeDasharray="2,3" opacity="0.4" />
        <line x1={ground.x} y1={ground.y} x2={onYAxis.x} y2={onYAxis.y} stroke={axisFill.x} strokeWidth="0.75" strokeDasharray="2,3" opacity="0.4" />
        <circle cx={onXAxis.x} cy={onXAxis.y} r="2" fill={axisFill.x} opacity="0.8" />
        <circle cx={onYAxis.x} cy={onYAxis.y} r="2" fill={axisFill.y} opacity="0.8" />
        <text x={onXAxis.x + 4} y={onXAxis.y - 4} fill={axisFill.x} fontSize="8.5" fontFamily="monospace">x {Math.round(x)}</text>
        <text x={onYAxis.x + 4} y={onYAxis.y - 4} fill={axisFill.y} fontSize="8.5" fontFamily="monospace">y {Math.round(y)}</text>
        {hasZ && pos.visible && (
          <text x={(ground.x + pos.x) / 2 + 5} y={(ground.y + pos.y) / 2} fill={axisFill.z} fontSize="8.5" fontFamily="monospace">z {Math.round(z)}</text>
        )}
        {origin.visible && <line x1={origin.x} y1={origin.y} x2={ground.x} y2={ground.y} stroke={color} strokeWidth="0.5" strokeDasharray="1,4" opacity="0.25" />}
      </g>
    );
  };

  /** Axis tick labels for the full grid so 3D coordinates are readable in the projected field */
  const renderAxisLabels = () => {
    if (!showLabels) return null;
    const ticks = [-800, -600, -400, -200, 200, 400, 600, 800];
    const nodes: React.ReactNode[] = [];
    (['x', 'y', 'z'] as const).forEach((axis) => {
      ticks.forEach((t) => {
        const p =
          axis === 'x' ? projectWorldToScreen(t, 0, 0) : axis === 'y' ? projectWorldToScreen(0, t, 0) : projectWorldToScreen(0, 0, t);
        if (!p.visible) return;
        nodes.push(
          <text
            key={`${axis}${t}`}
            x={p.x + 3}
            y={p.y - 3}
            fill={axisFill[axis]}
            fontSize="8"
            fontFamily="monospace"
            opacity="0.6"
          >
            {t}
          </text>
        );
      });
      const end = axis === 'x' ? projectWorldToScreen(900, 0, 0) : axis === 'y' ? projectWorldToScreen(0, 900, 0) : projectWorldToScreen(0, 0, 900);
      if (end.visible) {
        nodes.push(
          <text key={`${axis}label`} x={end.x + 4} y={end.y + 3} fill={axisFill[axis]} fontSize="10" fontWeight="bold" fontFamily="monospace" opacity="0.9">
            {axis.toUpperCase()}
          </text>
        );
      }
    });
    return <g>{nodes}</g>;
  };

  return (
    <div
      ref={containerRef}
      id="spatial-scaffold-overlay"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => isPlacementMode && setCursorScreen(null)}
      onClick={handleContainerClick}
      onWheel={handleWheel}
      className={`fixed inset-0 z-30 select-none ${isPlacementMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* Placement HUD */}
      {isPlacementMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-3.5 py-2 rounded-full border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 pointer-events-auto bg-zinc-950/95 border-cyan-500/50 text-white font-mono text-[11px] cursor-default"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="font-semibold text-cyan-400">Place Pin</span>
          </div>
          <span className="opacity-30">|</span>
          <span className="opacity-70 text-[10px]">Click to drop · Shift-click for several · Wheel / ↑↓ sets depth · Esc exits</span>
          <span className="opacity-30">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase opacity-60">Z</span>
            <input
              type="range"
              min={-Z_LIMIT}
              max={Z_LIMIT}
              step={10}
              value={placeZ}
              onChange={(e) => setPlaceZ(parseFloat(e.target.value))}
              className="w-28 h-3 accent-cyan-400"
              title="Pin depth (Z)"
            />
            <input
              type="number"
              min={-Z_LIMIT}
              max={Z_LIMIT}
              step={10}
              value={placeZ}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setPlaceZ(clamp(v, -Z_LIMIT, Z_LIMIT));
              }}
              className="w-14 px-1 py-0.5 text-right text-[10px] rounded bg-zinc-900 border border-zinc-700 outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => setPlaceZ(0)}
              className="px-1.5 py-0.5 rounded border border-zinc-700 text-[9px] uppercase opacity-70 hover:opacity-100 hover:bg-zinc-800"
              title="Reset depth to 0"
            >
              0
            </button>
          </div>
          <label className="flex items-center gap-1 text-[9px] uppercase opacity-70 cursor-pointer">
            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="accent-cyan-400 w-3 h-3" />
            Snap 10
          </label>
          {ghostWorld && (
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 tabular-nums">
              {ghostWorld.x}, {ghostWorld.y}, {ghostWorld.z}
            </span>
          )}
          <button
            type="button"
            onClick={onExitPlacementMode}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-[10px] uppercase transition-colors"
          >
            <Check className="w-3 h-3" />
            <span>Done</span>
          </button>
        </div>
      )}

      {/* SVG scaffold layer — origin/axis chrome + readable coordinate projections. The pins
          themselves (dot, influence volume, stem) are real 3D objects drawn by the engine. */}
      <svg className="w-full h-full absolute inset-0 pointer-events-none">
        {showOrigin &&
          (() => {
            const o = projectWorldToScreen(0, 0, 0);
            if (!o.visible) return null;
            return (
              <g opacity="0.6">
                <circle cx={o.x} cy={o.y} r="3.5" stroke={isLight ? '#0369a1' : '#00f0ff'} strokeWidth="1" fill="none" />
                {showLabels && (
                  <text x={o.x + 7} y={o.y - 6} fill={labelFill} fontSize="9" fontFamily="monospace">
                    0,0,0
                  </text>
                )}
              </g>
            );
          })()}

        {renderAxisLabels()}

        {points.map((p) => renderCoordProjection(p.id, p.x, p.y, p.z ?? 0, getModeColor(p.mode)))}

        {ghostWorld && renderCoordProjection('ghost', ghostWorld.x, ghostWorld.y, ghostWorld.z, '#22d3ee')}
      </svg>

      {/* Invisible per-pin hit targets: the visible dot / influence volume is drawn in 3D by the
          engine now — this layer only exists to make each tiny dot clickable and draggable, and
          to surface a compact label + action pill for the hovered/selected pin. */}
      {points.map((p, idx) => {
        const z = p.z ?? 0;
        const pos = projectWorldToScreen(p.x, p.y, z);
        if (!pos.visible) return null;
        const color = getModeColor(p.mode);
        const isSelected = activePointId === p.id;
        const isHovered = hoveredPointId === p.id;
        const showChrome = isSelected || isHovered;

        return (
          <div
            key={p.id}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            {/* 16px invisible hit target — click to select, drag to move in-plane, shift-drag for Z */}
            <div
              onPointerDown={(e) => startDragging(e, p.id, p.x, p.y, z, 'xy')}
              onMouseEnter={() => setHoveredPointId(p.id)}
              onMouseLeave={() => setHoveredPointId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPoint(p.id);
              }}
              title={`Pin #${idx + 1}: ${p.name || p.mode.toUpperCase()}\nX:${p.x} Y:${p.y} Z:${z}\nDrag to move in its plane · Shift-drag or the ↕ handle for elevation`}
              className="w-4 h-4 rounded-full cursor-grab active:cursor-grabbing pointer-events-auto"
            />

            {/* Z elevation handle (drag up/down) — only while hovered/selected */}
            {showChrome && (
              <div
                onPointerDown={(e) => startDragging(e, p.id, p.x, p.y, z, 'z')}
                title="Drag up / down to change elevation (Z)"
                style={{ borderColor: color, color }}
                className="absolute -top-9 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border bg-zinc-950/90 flex items-center justify-center cursor-ns-resize hover:scale-110 transition-transform pointer-events-auto"
              >
                <ArrowUpDown className="w-3 h-3" />
              </div>
            )}

            {/* Compact label, 10px to the right of the dot */}
            {showChrome && (
              <div
                style={{ left: '10px', top: '-6px' }}
                className={`absolute px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase shadow pointer-events-none whitespace-nowrap ${
                  isLight ? 'bg-stone-900 text-white' : 'bg-zinc-900 text-zinc-100 border border-zinc-700'
                }`}
              >
                #{idx + 1} {p.name || p.mode} · {p.x},{p.y},{z}
              </div>
            )}

            {/* Selected-pin action pill, 14px below the dot */}
            {isSelected && (
              <div
                style={{ top: '14px' }}
                className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg border shadow-xl backdrop-blur-xl flex items-center gap-1.5 text-[9px] font-mono z-40 whitespace-nowrap pointer-events-auto ${
                  isLight ? 'bg-white/95 border-stone-200 text-stone-900 shadow-stone-300/40' : 'bg-zinc-900/95 border-zinc-700 text-zinc-200 shadow-black/60'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="opacity-50">R</span>
                <span className="font-semibold">{Math.round(p.radius)}</span>
                <span className="opacity-40">·</span>
                <span className="opacity-50">F</span>
                <span className="font-semibold">{p.strength.toFixed(1)}</span>
                <span className="opacity-40">·</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePoint(p.id, {
                      mode: p.mode === 'repel' ? 'attract' : p.mode === 'attract' ? 'vortex' : 'repel',
                    })
                  }
                  title="Cycle Mode: Repel → Attract → Vortex"
                  className="px-1 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20 text-cyan-400 font-semibold uppercase"
                >
                  {p.mode}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdatePoint(p.id, { active: !p.active })}
                  title={p.active ? 'Mute pin' : 'Activate pin'}
                  className={`px-1 py-0.5 rounded font-semibold uppercase ${p.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-stone-500/10 opacity-60'}`}
                >
                  {p.active ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePoint(p.id)}
                  title="Remove pin"
                  className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Small coordinate readout that follows the cursor while placing — the ghost pin itself is
          drawn in 3D by the engine via onGhostChange. */}
      {isPlacementMode && ghostWorld && cursorScreen && (
        <div
          style={{ left: `${cursorScreen.x + 14}px`, top: `${cursorScreen.y + 14}px` }}
          className="absolute pointer-events-none bg-zinc-950/90 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40 text-[8.5px] font-mono whitespace-nowrap shadow tabular-nums"
        >
          {ghostWorld.x}, {ghostWorld.y}, {ghostWorld.z}
        </div>
      )}
    </div>
  );
};
