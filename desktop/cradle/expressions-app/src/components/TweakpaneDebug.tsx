/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Pane } from 'tweakpane';
import { PointCloudConfig } from '../engine/types';
import { PointCloudField } from '../engine/PointCloudField';

interface TweakpaneDebugProps {
  engine: PointCloudField | null;
  config: PointCloudConfig;
  onConfigChange: (newConfig: Partial<PointCloudConfig>) => void;
  visible: boolean;
  onClose: () => void;
}

export const TweakpaneDebug: React.FC<TweakpaneDebugProps> = ({
  engine,
  config,
  onConfigChange,
  visible,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<Pane | null>(null);

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const pane = new Pane({
      container: containerRef.current,
      title: 'Point-Cloud Engine GPGPU Inspector',
      expanded: true,
    });
    paneRef.current = pane;
    const p = pane as any;

    // Helper proxy object for Tweakpane bindings
    const params = {
      glyphA: Array.isArray(config.glyph) ? config.glyph[0] || 'O' : String(config.glyph) || 'O',
      glyphB: Array.isArray(config.glyph) ? config.glyph[1] || 'I' : String(config.glyph) || 'I',
      style: config.style,
      dotShape: config.dotShape || 'circle',
      colorMode: config.colorMode,
      minSize: config.particleSize.min,
      maxSize: config.particleSize.max,
      autoMorph: config.autoMorph ?? true,
      morphDuration: config.autoMorphDuration ?? 4.0,
      morphProgress: engine?.getMorphProgress() ?? 0.0,

      // Fluid
      curlScale: config.fluid.curlScale,
      curlSpeed: config.fluid.curlSpeed,
      turbulence: config.fluid.turbulence,
      vortexStrength: config.fluid.vortexStrength,
      viscosity: config.fluid.viscosity,
      returnSpeed: config.fluid.returnSpeed,
      dispersion: config.fluid.dispersion,

      // Free Relational System
      relationalEnabled: config.relational?.enabled ?? false,
      relationalMode: config.relational?.mode ?? 'orbital',
      attractorCount: config.relational?.attractorCount ?? 3,
      attractorGravity: config.relational?.attractorGravity ?? 1.6,
      orbitSpeed: config.relational?.orbitSpeed ?? 0.8,
      orbitRadius: config.relational?.orbitRadius ?? 240,
      relationalSpin: config.relational?.relationalSpin ?? 1.4,
      chaosFactor: config.relational?.chaosFactor ?? 0.2,
      wanderSpeed: config.relational?.wanderSpeed ?? 0.5,

      // Interaction
      interactionMode: config.interaction.mode,
      interactionRadius: config.interaction.radius,
      interactionStrength: config.interaction.strength,
    };

    // --- Tab: Typography & Style ---
    const fTypo = p.addFolder({ title: 'Typography & Rendering' });

    fTypo
      .addBinding(params, 'glyphA', { label: 'Glyph / Word A' })
      .on('change', (ev: any) => {
        onConfigChange({ glyph: [ev.value, params.glyphB] });
      });

    fTypo
      .addBinding(params, 'glyphB', { label: 'Glyph / Word B' })
      .on('change', (ev: any) => {
        onConfigChange({ glyph: [params.glyphA, ev.value] });
      });

    fTypo
      .addBinding(params, 'style', {
        label: 'Render Mode',
        options: {
          'Stochastic Stipple': 'stipple',
          'Matrix Halftone': 'halftone',
        },
      })
      .on('change', (ev: any) => {
        onConfigChange({ style: ev.value as 'stipple' | 'halftone' });
      });

    fTypo
      .addBinding(params, 'dotShape', {
        label: 'Dot Shape',
        options: {
          'Circle (Anti-aliased)': 'circle',
          'Square (Dither Matrix)': 'square',
        },
      })
      .on('change', (ev: any) => {
        onConfigChange({ dotShape: ev.value as 'circle' | 'square' });
      });

    fTypo
      .addBinding(params, 'colorMode', {
        label: 'Monochrome',
        options: {
          'Black on White': 'blackOnWhite',
          'White on Black': 'whiteOnBlack',
        },
      })
      .on('change', (ev: any) => {
        onConfigChange({ colorMode: ev.value as 'blackOnWhite' | 'whiteOnBlack' });
      });

    fTypo
      .addBinding(params, 'minSize', { label: 'Min Dot Size', min: 0.1, max: 25.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ particleSize: { min: ev.value, max: params.maxSize } });
      });

    fTypo
      .addBinding(params, 'maxSize', { label: 'Max Dot Size', min: 0.2, max: 50.0, step: 0.2 })
      .on('change', (ev: any) => {
        onConfigChange({ particleSize: { min: params.minSize, max: ev.value } });
      });

    // --- Tab: Free Relational System & Attractors ---
    const fRelational = p.addFolder({ title: 'Free Relational System' });

    fRelational
      .addBinding(params, 'relationalEnabled', { label: 'Enable Relational' })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, enabled: ev.value } });
      });

    fRelational
      .addBinding(params, 'relationalMode', {
        label: 'Relational Mode',
        options: {
          'Orbital Gravity': 'orbital',
          'Harmonic Chaos': 'chaos',
          'N-Body Lemniscate': 'nbody',
        },
      })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, mode: ev.value as any } });
      });

    fRelational
      .addBinding(params, 'attractorCount', { label: 'Attractor Poles', min: 1, max: 6, step: 1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, attractorCount: ev.value } });
      });

    fRelational
      .addBinding(params, 'attractorGravity', { label: 'Attractor Gravity', min: -15.0, max: 25.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, attractorGravity: ev.value } });
      });

    fRelational
      .addBinding(params, 'orbitSpeed', { label: 'Orbit Angular Speed', min: -10.0, max: 10.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, orbitSpeed: ev.value } });
      });

    fRelational
      .addBinding(params, 'orbitRadius', { label: 'Orbit Separation (px)', min: 0, max: 1200, step: 10 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, orbitRadius: ev.value } });
      });

    fRelational
      .addBinding(params, 'relationalSpin', { label: 'Vortex Swirl Torque', min: -20.0, max: 20.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, relationalSpin: ev.value } });
      });

    fRelational
      .addBinding(params, 'chaosFactor', { label: 'Strange Chaos Factor', min: 0.0, max: 15.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, chaosFactor: ev.value } });
      });

    fRelational
      .addBinding(params, 'wanderSpeed', { label: 'Wander Rate', min: 0.0, max: 10.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ relational: { ...config.relational, wanderSpeed: ev.value } });
      });

    // --- Tab: Fluid Dynamics & GPGPU ---
    const fFluid = p.addFolder({ title: 'GPGPU Fluid Dynamics' });

    fFluid
      .addBinding(params, 'curlScale', { label: 'Curl Scale', min: 0.0, max: 15.0, step: 0.05 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, curlScale: ev.value } });
      });

    fFluid
      .addBinding(params, 'curlSpeed', { label: 'Curl Speed', min: -5.0, max: 10.0, step: 0.05 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, curlSpeed: ev.value } });
      });

    fFluid
      .addBinding(params, 'turbulence', { label: 'Turbulence', min: 0.0, max: 20.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, turbulence: ev.value } });
      });

    fFluid
      .addBinding(params, 'vortexStrength', { label: 'Vorticity / Swirl', min: -20.0, max: 25.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, vortexStrength: ev.value } });
      });

    fFluid
      .addBinding(params, 'dispersion', { label: 'O→I Drift Advection', min: -5.0, max: 15.0, step: 0.05 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, dispersion: ev.value } });
      });

    fFluid
      .addBinding(params, 'returnSpeed', { label: 'Spring Snap (k)', min: -5.0, max: 25.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, returnSpeed: ev.value } });
      });

    fFluid
      .addBinding(params, 'viscosity', { label: 'Viscosity (Damp)', min: 0.05, max: 1.02, step: 0.005 })
      .on('change', (ev: any) => {
        onConfigChange({ fluid: { ...config.fluid, viscosity: ev.value } });
      });

    // --- Tab: Interaction ---
    const fInteract = p.addFolder({ title: 'Pointer Interaction' });

    fInteract
      .addBinding(params, 'interactionMode', {
        label: 'Force Mode',
        options: {
          'Repel (Push)': 'repel',
          'Attract (Pull)': 'attract',
          'Orbital Vortex': 'vortex',
        },
      })
      .on('change', (ev: any) => {
        onConfigChange({ interaction: { ...config.interaction, mode: ev.value as any } });
      });

    fInteract
      .addBinding(params, 'interactionRadius', { label: 'Radius', min: 10, max: 1500, step: 10 })
      .on('change', (ev: any) => {
        onConfigChange({ interaction: { ...config.interaction, radius: ev.value } });
      });

    fInteract
      .addBinding(params, 'interactionStrength', { label: 'Strength', min: -10.0, max: 15.0, step: 0.1 })
      .on('change', (ev: any) => {
        onConfigChange({ interaction: { ...config.interaction, strength: ev.value } });
      });

    // Actions
    const fActions = p.addFolder({ title: 'Triggers' });
    fActions.addButton({ title: 'Trigger Vortex Burst' }).on('click', () => {
      engine?.triggerDisperse(3.5);
    });

    fActions.addButton({ title: 'Close Inspector' }).on('click', () => {
      onClose();
    });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, [visible, engine]);

  if (!visible) return null;

  return (
    <div
      id="tweakpane-container"
      ref={containerRef}
      className="fixed top-4 right-4 z-50 w-80 shadow-2xl rounded-xl overflow-hidden pointer-events-auto text-xs"
    />
  );
};
