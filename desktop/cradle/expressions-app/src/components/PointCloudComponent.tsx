/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { PointCloudConfig, BackgroundAtmosphereMode, CameraOrbState, MorphTelemetry, PlacedInteractionPoint, CompositionTelemetry } from '../engine/types';
import { AutomationLiveValue } from '../engine/automation';
import { PointCloudField, DEFAULT_CONFIG, SpatialGridMode } from '../engine/PointCloudField';
import { PinGhostState } from '../engine/pinMarkers';
import { computeBackgroundCSS } from '../engine/colorPalettes';

export interface PointCloudComponentProps extends Partial<PointCloudConfig> {
  className?: string;
  styleObj?: React.CSSProperties;
  backgroundColor?: string;
  backgroundMode?: BackgroundAtmosphereMode;
  backgroundGlowIntensity?: number;
  onEngineReady?: (engine: PointCloudField) => void;
  onCameraChange?: (state: CameraOrbState) => void;
  onCompositionUpdate?: (t: CompositionTelemetry) => void;
  onMorphUpdate?: (t: MorphTelemetry) => void;
  onAutomationUpdate?: (live: AutomationLiveValue[]) => void;
}

export interface PointCloudComponentRef {
  getEngine: () => PointCloudField | null;
  triggerDisperse: (strength?: number) => void;
  setCameraOrbit: (pitch: number, yaw: number) => void;
  setCameraPan: (panX: number, panY: number) => void;
  setCameraZoom: (zoom: number) => void;
  resetCamera: (preset?: 'perspective' | 'flat' | 'top') => void;
  getCameraState: () => CameraOrbState | null;
  setCameraState: (state: Partial<CameraOrbState>) => void;
  setGridVisible: (visible: boolean) => void;
  getGridVisible: () => boolean;
  setGridMode: (mode: SpatialGridMode) => void;
  getGridMode: () => SpatialGridMode;
  setPanMode: (enabled: boolean) => void;
  projectWorldToScreen: (x: number, y: number, z?: number) => { x: number; y: number; visible: boolean };
  unprojectScreenToWorld: (screenX: number, screenY: number, planeZ?: number) => { x: number; y: number; z: number };
  fireAutomation: (id: string, delayS?: number) => void;
  resetMorphPhases: () => void;
  setPinMarkers: (points: PlacedInteractionPoint[], activeId: string | null, ghost: PinGhostState | null) => void;
  pickPin: (screenX: number, screenY: number, points: PlacedInteractionPoint[], thresholdPx?: number) => string | null;
}

export const PointCloudComponent = forwardRef<PointCloudComponentRef, PointCloudComponentProps>(
  (props, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<PointCloudField | null>(null);

    const {
      className = '',
      styleObj,
      onEngineReady,
      onCameraChange,
      onCompositionUpdate,
      onMorphUpdate,
      onAutomationUpdate,
      positioning = 'absolute',
      ...configOverrides
    } = props;

    useImperativeHandle(ref, () => ({
      getEngine: () => engineRef.current,
      triggerDisperse: (strength?: number) => {
        engineRef.current?.triggerDisperse(strength);
      },
      setCameraOrbit: (pitch: number, yaw: number) => {
        engineRef.current?.setCameraOrbit(pitch, yaw);
      },
      setCameraPan: (panX: number, panY: number) => {
        engineRef.current?.setCameraPan(panX, panY);
      },
      setCameraZoom: (zoom: number) => {
        engineRef.current?.setCameraZoom(zoom);
      },
      resetCamera: (preset?: 'perspective' | 'flat' | 'top') => {
        engineRef.current?.resetCamera(preset);
      },
      getCameraState: () => {
        return engineRef.current ? engineRef.current.getCameraState() : null;
      },
      setCameraState: (state: Partial<CameraOrbState>) => {
        engineRef.current?.setCameraState(state);
      },
      setGridMode: (mode: SpatialGridMode) => {
        engineRef.current?.setGridMode(mode);
      },
      getGridMode: () => {
        return engineRef.current ? engineRef.current.getGridMode() : 'off';
      },
      setPanMode: (enabled: boolean) => {
        engineRef.current?.setPanMode(enabled);
      },
      fireAutomation: (id: string, delayS?: number) => {
        engineRef.current?.fireAutomation(id, delayS);
      },
      resetMorphPhases: () => {
        engineRef.current?.resetMorphPhases();
      },
      setActiveEntity: (id: string | null) => {
        engineRef.current?.setActiveEntity(id);
      },
      resetField: () => {
        engineRef.current?.resetField();
      },
      getEntityCentre: (id: string) => {
        return engineRef.current ? engineRef.current.getEntityCentre(id) : null;
      },
      setGridVisible: (visible: boolean) => {
        engineRef.current?.setGridVisible(visible);
      },
      getGridVisible: () => {
        return engineRef.current ? engineRef.current.getGridVisible() : false;
      },
      projectWorldToScreen: (x: number, y: number, z?: number) => {
        return engineRef.current ? engineRef.current.projectWorldToScreen(x, y, z ?? 0) : { x: 0, y: 0, visible: false };
      },
      unprojectScreenToWorld: (screenX: number, screenY: number, planeZ?: number) => {
        return engineRef.current ? engineRef.current.unprojectScreenToWorld(screenX, screenY, planeZ ?? 0) : { x: 0, y: 0, z: planeZ ?? 0 };
      },
      setPinMarkers: (points: PlacedInteractionPoint[], activeId: string | null, ghost: PinGhostState | null) => {
        engineRef.current?.setPinMarkers(points, activeId, ghost);
      },
      pickPin: (screenX: number, screenY: number, points: PlacedInteractionPoint[], thresholdPx?: number) => {
        return engineRef.current ? engineRef.current.pickPin(screenX, screenY, points, thresholdPx ?? 10) : null;
      },
    }));

    useEffect(() => {
      if (!canvasRef.current) return;

      const engine = new PointCloudField(canvasRef.current, {
        ...DEFAULT_CONFIG,
        ...configOverrides,
        positioning,
      });

      engineRef.current = engine;
      if (onEngineReady) {
        onEngineReady(engine);
      }
      if (onCameraChange) {
        engine.setOnCameraChange(onCameraChange);
      }
      if (onMorphUpdate) engine.setOnMorphUpdate(onMorphUpdate);
      if (onCompositionUpdate) engine.setOnCompositionUpdate(onCompositionUpdate);
      if (onAutomationUpdate) engine.setOnAutomationUpdate(onAutomationUpdate);

      // ResizeObserver to handle fluid container resizing
      const resizeObserver = new ResizeObserver(() => {
        engine.resize();
      });

      if (canvasRef.current.parentElement) {
        resizeObserver.observe(canvasRef.current.parentElement);
      }

      return () => {
        resizeObserver.disconnect();
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    // Update onCameraChange listener if it changes
    useEffect(() => {
      if (engineRef.current && onCameraChange) {
        engineRef.current.setOnCameraChange(onCameraChange);
      }
    }, [onCameraChange]);

    useEffect(() => {
      if (engineRef.current) engineRef.current.setOnMorphUpdate(onMorphUpdate ?? null);
    }, [onMorphUpdate]);

    useEffect(() => {
      if (engineRef.current) engineRef.current.setOnAutomationUpdate(onAutomationUpdate ?? null);
    }, [onAutomationUpdate]);

    useEffect(() => {
      if (engineRef.current) engineRef.current.setOnCompositionUpdate(onCompositionUpdate ?? null);
    }, [onCompositionUpdate]);

    // Reactively update config when props change without tearing down the WebGL context
    useEffect(() => {
      if (engineRef.current) {
        engineRef.current.updateConfig(configOverrides);
      }
    }, [
      JSON.stringify(props.entities),
      JSON.stringify(props.composition),
      JSON.stringify(props.cymatics),
      props.particleCount,
      props.fontFamily,
      props.colorMode,
      props.style,
      props.dotShape,
      props.particleSize?.min,
      props.particleSize?.max,
      props.fluid?.curlScale,
      props.fluid?.curlSpeed,
      props.fluid?.vortexStrength,
      props.fluid?.viscosity,
      props.fluid?.returnSpeed,
      props.fluid?.turbulence,
      props.fluid?.dispersion,
      JSON.stringify(props.fluid),
      props.interaction?.falloffPower,
      props.interaction?.radius,
      props.interaction?.strength,
      props.interaction?.mode,
      props.interaction?.velocityInfluence,
      JSON.stringify(props.toroidalMorph),
      props.relational?.enabled,
      props.relational?.mode,
      props.relational?.attractorCount,
      props.relational?.attractorGravity,
      props.relational?.orbitSpeed,
      props.relational?.orbitRadius,
      props.relational?.relationalSpin,
      props.relational?.chaosFactor,
      props.relational?.wanderSpeed,
      props.relational?.gravitySoftening,
      props.relational?.gravityFalloff,
      props.relational?.swirlRadius,
      JSON.stringify(props.automations),
      props.fontFamily,
      props.fontWeight,
      props.morphProgress,
      props.color?.enabled,
      props.color?.mode,
      props.color?.primaryColor,
      props.color?.secondaryColor,
      props.color?.accentColor,
      props.color?.cycleSpeed,
      props.color?.waveFrequency,
      props.color?.angle,
      props.color?.turbulenceModulation,
      props.color?.speedReactiveIntensity,
      props.color?.densityWeight,
      props.color?.hueShiftSpeed,
      props.color?.contrast,
      props.color?.fieldCenterOffset?.[0],
      props.color?.fieldCenterOffset?.[1],
      props.color?.backgroundColor,
      props.color?.backgroundMode,
      props.color?.backgroundGlowIntensity,
      props.backgroundColor,
      props.backgroundMode,
      props.backgroundGlowIntensity,
      props.autoMorph,
      props.autoMorphDuration,
    ]);

    const positionClass =
      positioning === 'fixed'
        ? 'fixed inset-0'
        : positioning === 'relative'
        ? 'relative'
        : 'absolute inset-0';

    const effectiveBgColor = props.backgroundColor || props.color?.backgroundColor;
    const effectiveBgMode = props.backgroundMode || props.color?.backgroundMode || 'ambientGlow';
    const effectiveGlowIntensity =
      props.backgroundGlowIntensity ?? props.color?.backgroundGlowIntensity ?? 0.45;

    const backgroundCss = useMemo(() => {
      return computeBackgroundCSS({
        backgroundColor: effectiveBgColor,
        backgroundMode: effectiveBgMode,
        glowColor: props.color?.primaryColor || '#00f0ff',
        accentColor: props.color?.accentColor || '#ffe600',
        glowIntensity: effectiveGlowIntensity,
        isLightModeFallback: props.colorMode === 'blackOnWhite',
      });
    }, [
      effectiveBgColor,
      effectiveBgMode,
      effectiveGlowIntensity,
      props.color?.primaryColor,
      props.color?.accentColor,
      props.colorMode,
    ]);

    return (
      <canvas
        ref={canvasRef}
        id="point-cloud-canvas"
        className={`w-full h-full block select-none pointer-events-auto touch-none ${positionClass} ${className}`}
        style={{
          background: backgroundCss,
          transition: 'background 0.4s ease-out',
          ...styleObj,
        }}
      />
    );
  }
);

PointCloudComponent.displayName = 'PointCloudField';
export default PointCloudComponent;
