/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
  Eye,
  Layers,
  Disc,
} from 'lucide-react';
import { CameraOrbState } from '../engine/types';

export interface CameraOrbControlProps {
  cameraState: CameraOrbState | null;
  onSetOrbit: (pitch: number, yaw: number) => void;
  onSetPan: (panX: number, panY: number) => void;
  onSetZoom: (zoom: number) => void;
  onReset: (preset?: 'perspective' | 'flat' | 'top') => void;
  isLight: boolean;
  isUIHidden?: boolean;
}

export const CameraOrbControl: React.FC<CameraOrbControlProps> = ({
  cameraState,
  onSetOrbit,
  onSetPan,
  onSetZoom,
  onReset,
  isLight,
  isUIHidden = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<'orbit' | 'pan'>('orbit');

  const orbRef = useRef<HTMLDivElement | null>(null);
  const isDraggingOrb = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, pitch: 0, yaw: 0, panX: 0, panY: 0 });

  const pitch = cameraState?.pitch ?? 0.55;
  const yaw = cameraState?.yaw ?? 0.35;
  const zoom = cameraState?.zoom ?? 1.0;
  const panX = cameraState?.panX ?? 0;
  const panY = cameraState?.panY ?? 0;

  // Degrees for human display
  const pitchDeg = Math.round((pitch * 180) / Math.PI);
  const yawDeg = Math.round((yaw * 180) / Math.PI);

  // Pointer drag handling on the 3D Orb gimbal
  const handleOrbPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingOrb.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      pitch,
      yaw,
      panX,
      panY,
    };
  };

  const handleOrbPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingOrb.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (activeMode === 'orbit') {
      const nextYaw = dragStart.current.yaw + dx * 0.015;
      const nextPitch = Math.max(-1.5, Math.min(1.5, dragStart.current.pitch + dy * 0.015));
      onSetOrbit(nextPitch, nextYaw);
    } else {
      // Pan mode
      const nextPanX = dragStart.current.panX - dx * 1.5;
      const nextPanY = dragStart.current.panY + dy * 1.5;
      onSetPan(nextPanX, nextPanY);
    }
  };

  const handleOrbPointerUp = (e: React.PointerEvent) => {
    if (isDraggingOrb.current) {
      isDraggingOrb.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture already released
      }
    }
  };

  // Step zoom in / out
  const handleZoomDelta = (delta: number) => {
    const nextZoom = Math.max(0.35, Math.min(3.5, zoom + delta));
    onSetZoom(nextZoom);
  };

  // Step pan
  const handlePanStep = (dx: number, dy: number) => {
    onSetPan(panX + dx, panY + dy);
  };

  // Spherical wireframe math for the glowing orb gizmo
  const orbRadius = 38;
  const cx = 45;
  const cy = 45;

  // Calculate projected rotation vectors for visual rings
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  // Normal vector facing the camera
  const nx = sinYaw * cosPitch;
  const ny = sinPitch;
  const nz = cosYaw * cosPitch;

  return (
    <div
      id="camera-orb-control"
      className={`fixed bottom-3 left-3 z-30 pointer-events-auto transition-all duration-300 ${
        isUIHidden ? 'translate-y-40 -translate-x-12 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      <div
        className={`rounded-xl border backdrop-blur-xl shadow-2xl transition-all overflow-hidden ${
          isLight
            ? 'bg-white/95 border-stone-200 shadow-stone-400/25 text-stone-800'
            : 'bg-zinc-900/95 border-zinc-800 shadow-black/60 text-zinc-200'
        } ${isExpanded ? 'w-64 sm:w-72' : 'w-auto'}`}
      >
        {/* Header Bar */}
        <div
          className={`flex items-center justify-between px-2.5 py-1.5 border-b text-[10px] font-mono select-none ${
            isLight ? 'border-stone-200 bg-stone-50/70' : 'border-zinc-800 bg-zinc-950/60'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase">
            <Compass className="w-3 h-3 text-emerald-500 animate-spin-slow" />
            <span>3D Camera Orb</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-cam-reset"
              onClick={() => onReset('perspective')}
              title="Reset to 3D Orbit View"
              className={`p-1 rounded text-[9px] border hover:opacity-100 transition-all ${
                isLight ? 'border-stone-200 hover:bg-stone-200/60' : 'border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              id="btn-cam-toggle-expand"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Minimize Camera Controls' : 'Expand Camera Controls'}
              className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-2.5 space-y-2.5 select-none">
            {/* Row 1: Interactive Orb Gimbal + Angle Readouts */}
            <div className="flex items-center gap-3">
              {/* Virtual 3D Trackball Orb */}
              <div
                ref={orbRef}
                id="virtual-camera-trackball"
                onPointerDown={handleOrbPointerDown}
                onPointerMove={handleOrbPointerMove}
                onPointerUp={handleOrbPointerUp}
                onPointerCancel={handleOrbPointerUp}
                title={`Click and drag to ${activeMode === 'orbit' ? 'orbit camera angle' : 'pan around space'}`}
                className={`relative w-[90px] h-[90px] shrink-0 rounded-full border cursor-grab active:cursor-grabbing flex items-center justify-center transition-all group overflow-hidden ${
                  activeMode === 'orbit'
                    ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                } ${isLight ? 'bg-stone-100/80 hover:bg-stone-100' : 'bg-zinc-950/80 hover:bg-zinc-950'}`}
              >
                {/* SVG 3D Gyroscope Indicator */}
                <svg width="90" height="90" viewBox="0 0 90 90" className="pointer-events-none">
                  <defs>
                    <radialGradient id="orbGrad" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor={isLight ? '#ffffff' : '#3f3f46'} stopOpacity="0.8" />
                      <stop offset="70%" stopColor={isLight ? '#e7e5e4' : '#18181b'} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={isLight ? '#d6d3d1' : '#09090b'} stopOpacity="0.9" />
                    </radialGradient>
                  </defs>

                  {/* Shaded sphere backdrop */}
                  <circle cx={cx} cy={cy} r={orbRadius} fill="url(#orbGrad)" />

                  {/* Outer meridian ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={orbRadius}
                    fill="none"
                    stroke={isLight ? '#a8a29e' : '#52525b'}
                    strokeWidth="1.2"
                    strokeDasharray="2 3"
                    opacity="0.7"
                  />

                  {/* Equator disc (representing the horizontal chakra plane) */}
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={orbRadius * 0.92}
                    ry={Math.max(2, Math.abs(orbRadius * 0.92 * sinPitch))}
                    fill="none"
                    stroke={activeMode === 'orbit' ? '#10b981' : '#06b6d4'}
                    strokeWidth="1.6"
                    opacity="0.85"
                  />

                  {/* Longitudinal meridian ring */}
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={Math.max(2, Math.abs(orbRadius * 0.92 * Math.cos(yaw)))}
                    ry={orbRadius * 0.92}
                    fill="none"
                    stroke={isLight ? '#78716c' : '#71717a'}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.5"
                  />

                  {/* Camera Aim Vector dot */}
                  <circle
                    cx={cx + nx * (orbRadius * 0.72)}
                    cy={cy - ny * (orbRadius * 0.72)}
                    r="4.5"
                    fill={activeMode === 'orbit' ? '#10b981' : '#06b6d4'}
                    stroke={isLight ? '#ffffff' : '#000000'}
                    strokeWidth="1.5"
                    className="filter drop-shadow-md"
                  />

                  {/* Center origin crosshair */}
                  <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#71717a" strokeWidth="0.8" opacity="0.6" />
                  <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#71717a" strokeWidth="0.8" opacity="0.6" />
                </svg>

                {/* Mode Label Overlay inside Orb */}
                <div className="absolute bottom-1.5 left-0 right-0 text-center pointer-events-none">
                  <span
                    className={`text-[8px] font-mono uppercase font-bold tracking-wider px-1 py-0.2 rounded ${
                      activeMode === 'orbit' ? 'text-emerald-400 bg-emerald-950/70' : 'text-cyan-400 bg-cyan-950/70'
                    }`}
                  >
                    {activeMode}
                  </span>
                </div>
              </div>

              {/* Mode Toggle & Numerical Values */}
              <div className="flex-1 space-y-2">
                {/* Orbit vs Pan Mode Toggle */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    id="btn-cam-mode-orbit"
                    onClick={() => setActiveMode('orbit')}
                    className={`flex-1 py-1 px-1.5 text-[9.5px] font-mono uppercase rounded border text-center transition-all ${
                      activeMode === 'orbit'
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-500 font-bold'
                        : isLight
                        ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                        : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Orbit
                  </button>
                  <button
                    type="button"
                    id="btn-cam-mode-pan"
                    onClick={() => setActiveMode('pan')}
                    className={`flex-1 py-1 px-1.5 text-[9.5px] font-mono uppercase rounded border text-center transition-all ${
                      activeMode === 'pan'
                        ? 'bg-cyan-500 text-zinc-950 border-cyan-500 font-bold'
                        : isLight
                        ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                        : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Pan
                  </button>
                </div>

                {/* Readouts */}
                <div className="text-[10px] font-mono space-y-0.5 opacity-80">
                  <div className="flex justify-between">
                    <span>Pitch:</span>
                    <span className="font-semibold text-emerald-400">{pitchDeg}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Yaw:</span>
                    <span className="font-semibold text-emerald-400">{yawDeg}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pan:</span>
                    <span>
                      {Math.round(panX)}, {Math.round(panY)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Pan D-Pad & Zoom Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-inherit">
              {/* Pan Step D-Pad */}
              <div className="space-y-1">
                <span className="block text-[9px] font-mono opacity-70 uppercase tracking-wider">Pan Step</span>
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    id="btn-pan-up"
                    onClick={() => handlePanStep(0, -40)}
                    title="Pan Up"
                    className={`p-1 rounded border text-[10px] ${
                      isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      id="btn-pan-left"
                      onClick={() => handlePanStep(-40, 0)}
                      title="Pan Left"
                      className={`p-1 rounded border text-[10px] ${
                        isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      id="btn-pan-center"
                      onClick={() => onSetPan(0, 0)}
                      title="Center Pan (0, 0)"
                      className={`px-1.5 py-1 rounded border text-[8.5px] font-mono ${
                        isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      <Move className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      id="btn-pan-right"
                      onClick={() => handlePanStep(40, 0)}
                      title="Pan Right"
                      className={`p-1 rounded border text-[10px] ${
                        isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    id="btn-pan-down"
                    onClick={() => handlePanStep(0, 40)}
                    title="Pan Down"
                    className={`p-1 rounded border text-[10px] ${
                      isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-mono opacity-70 uppercase tracking-wider">
                  <span>Zoom</span>
                  <span className="font-semibold">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    id="btn-zoom-out"
                    onClick={() => handleZoomDelta(-0.15)}
                    title="Zoom Out (Wheel Down)"
                    className={`flex-1 py-1 rounded border flex items-center justify-center ${
                      isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    id="btn-zoom-reset"
                    onClick={() => onSetZoom(1.0)}
                    title="Reset Zoom to 100%"
                    className={`px-1.5 py-1 rounded border text-[9px] font-mono ${
                      isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    id="btn-zoom-in"
                    onClick={() => handleZoomDelta(0.15)}
                    title="Zoom In (Wheel Up)"
                    className={`flex-1 py-1 rounded border flex items-center justify-center ${
                      isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>

                {/* Zoom Slider */}
                <input
                  id="slider-cam-zoom"
                  type="range"
                  min={0.35}
                  max={3.0}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => onSetZoom(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 mt-1"
                />
              </div>
            </div>

            {/* Row 3: Planar Presets for Viewing Chakras */}
            <div className="pt-1 border-t border-inherit">
              <span className="block text-[8.5px] font-mono opacity-60 uppercase tracking-wider mb-1">
                Camera Angle Presets
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  id="preset-cam-perspective"
                  onClick={() => onReset('perspective')}
                  title="3D Orbit Angle - Shows stacked horizontal planar discs"
                  className={`py-1 px-1 text-[9px] font-mono uppercase rounded border flex items-center justify-center gap-1 transition-all ${
                    Math.abs(pitch - 0.55) < 0.1 && Math.abs(yaw - 0.35) < 0.1
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                      : isLight
                      ? 'border-stone-200 hover:bg-stone-100'
                      : 'border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>3D Orbit</span>
                </button>
                <button
                  type="button"
                  id="preset-cam-flat"
                  onClick={() => onReset('flat')}
                  title="Horizontal Edge View - Look straight through flat chakra plates"
                  className={`py-1 px-1 text-[9px] font-mono uppercase rounded border flex items-center justify-center gap-1 transition-all ${
                    Math.abs(pitch - 1.48) < 0.1
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                      : isLight
                      ? 'border-stone-200 hover:bg-stone-100'
                      : 'border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  <Disc className="w-2.5 h-2.5" />
                  <span>Flat Edge</span>
                </button>
                <button
                  type="button"
                  id="preset-cam-top"
                  onClick={() => onReset('top')}
                  title="Top Axial View - Look down directly into vortex geometries"
                  className={`py-1 px-1 text-[9px] font-mono uppercase rounded border flex items-center justify-center gap-1 transition-all ${
                    Math.abs(pitch) < 0.05
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                      : isLight
                      ? 'border-stone-200 hover:bg-stone-100'
                      : 'border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>Top Axial</span>
                </button>
              </div>
            </div>

            {/* Gesture Guide Hint */}
            <div className="text-[8px] font-mono opacity-50 text-center leading-tight">
              Right-Click Drag: Orbit • Shift+Drag: Pan • Wheel: Zoom
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
