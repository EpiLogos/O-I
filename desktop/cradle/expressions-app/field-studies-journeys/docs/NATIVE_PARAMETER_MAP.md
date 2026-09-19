# Native parameter inventory

Generated from the implementation's native registry projection. 94 field/composition/morph controls plus 24 registered targets across the initial scene's entities. Numeric sliders use soft bounds; typed values retain validated hard bounds. The factor converts authored units to native units; stage coordinates use 400 world pixels per unit and phase offsets use 2π radians per turn.

The native engine evaluates enabled automation once against simulation time. Stable entity IDs are resolved to native indices only at the adapter boundary. Base values are never overwritten by telemetry. Palette/layout/sequence/source enum and text editors are contextual controls in addition to this numeric inventory.

| Native owner path | Authored path | Context | Slider bounds | Validated bounds | Factor | Unit | Driver support |
|---|---|---|---|---|---|---|---|
| `material.sizeBias` | `field.params.sizeBias` | material | 0.2–4 | 0.1–12 | 1 |  | Native automation |
| `material.opacity` | `field.params.opacity` | material | 0–1 | 0–1 | 1 |  | Native automation |
| `material.roundness` | `field.params.roundness` | material | 0–1 | 0–1 | 1 |  | Native automation |
| `material.softness` | `field.params.softness` | material | 0–1 | 0–1 | 1 |  | Native automation |
| `material.irregularity` | `field.params.irregularity` | material | 0–1 | 0–1 | 1 |  | Native automation |
| `material.elongation` | `field.params.elongation` | material | 0–3 | 0–12 | 1 |  | Native automation |
| `material.orientation` | `field.params.orientation` | material | -180–180 | -36000–36000 | 1 | ° | Native automation |
| `material.contrast` | `field.params.contrast` | material | 0–1 | 0–1 | 1 |  | Native automation |
| `material.densityScale` | `field.params.densityScale` | material | 0.1–3 | 0.01–100 | 1 |  | Native automation |
| `material.densityPhase` | `field.params.densityPhase` | material | 0–6.283 | -1000–1000 | 1 | rad | Native automation |
| `material.edgeWeight` | `field.params.edgeWeight` | material | 0–1 | 0–5 | 1 |  | Native automation |
| `material.halo` | `field.params.halo` | material | 0–0.6 | 0–1 | 1 |  | Native automation |
| `paperGrain` | `field.params.grain` | color | 0–0.2 | 0–1 | 1 |  | Native automation |
| `color.fieldCenterOffset.0` | `field.params.native_color__fieldCenterOffset__0` | color | -3–3 | -20–20 | 1 |  | Native automation |
| `color.fieldCenterOffset.1` | `field.params.native_color__fieldCenterOffset__1` | color | -3–3 | -20–20 | 1 |  | Native automation |
| `relational.attractorCount` | `field.params.native_relational__attractorCount` | relational | 1–10 | 1–10 | 1 |  | Native automation |
| `cymatics.driveScale` | `field.params.native_cymatics__driveScale` | resonance | 0–4 | 0–100 | 1 |  | Native automation |
| `fluid.returnSpeed` | `field.params.recovery` | motion | -5–25 | -100–500 | 1 |  | Native automation |
| `fluid.viscosity` | `field.params.native_fluid__viscosity` | motion | 0.2–1.01 | 0–1.2 | 1 |  | Native automation |
| `fluid.vortexStrength` | `field.params.circulation` | motion | -25–25 | -500–500 | 1 |  | Native automation |
| `fluid.curlScale` | `field.params.turbulenceScale` | motion | 0.02–16 | 0–200 | 1 |  | Native automation |
| `fluid.curlSpeed` | `field.params.speed` | motion | -10–15 | -200–200 | 1 |  | Native automation |
| `fluid.turbulence` | `field.params.turbulence` | motion | 0–15 | -100–500 | 1 |  | Native automation |
| `fluid.dispersion` | `field.params.dispersion` | motion | 0–20 | -100–500 | 1 |  | Native automation |
| `fluid.snapRigidity` | `field.params.snapRigidity` | physics | 0–5 | -20–100 | 1 |  | Native automation |
| `fluid.densityTether` | `field.params.densityTether` | physics | 0–3 | 0–10 | 1 |  | Native automation |
| `fluid.curlDepth` | `field.params.curlDepth` | physics | 0–4 | 0–50 | 1 |  | Native automation |
| `fluid.vortexRadius` | `field.params.vortexRadius` | physics | 0.05–5 | 0.0125–50 | 400 | stage units | Native automation |
| `fluid.gravityX` | `field.params.gravityX` | physics | -10–10 | -1000–1000 | 1 |  | Native automation |
| `fluid.gravityY` | `field.params.gravityY` | physics | -10–10 | -1000–1000 | 1 |  | Native automation |
| `fluid.gravityZ` | `field.params.gravityZ` | physics | -10–10 | -1000–1000 | 1 |  | Native automation |
| `fluid.quadraticDrag` | `field.params.quadraticDrag` | physics | 0–10 | 0–1000 | 1 |  | Native automation |
| `fluid.thermalJitter` | `field.params.thermalJitter` | physics | 0–10 | 0–1000 | 1 |  | Native automation |
| `fluid.maxSpeed` | `field.params.speedLimit` | physics | 0.125–150 | 0.025–25000 | 400 | stage units | Native automation |
| `fluid.zConfinement` | `field.params.zConfinement` | physics | 0–1 | 0–10 | 1 |  | Native automation |
| `fluid.timeScale` | `field.params.timeScale` | physics | 0–4 | -10–100 | 1 |  | Native automation |
| `particleCount` | `field.params.count` | material | 1000–2000000 | 64–4000000 | 1 |  | Native automation |
| `particleSize.min` | `field.params.native_particleSize__min` | material | 0.02–40 | 0.001–500 | 1 | px | Native automation |
| `particleSize.max` | `field.params.size` | material | 0.05–80 | 0.001–1000 | 1 | px | Native automation |
| `morphProgress` | `field.params.native_morphProgress` | morph | 0–1 | 0–1 | 1 |  | Native automation |
| `autoMorphDuration` | `field.params.native_autoMorphDuration` | morph | 0.05–60 | 0.01–3600 | 1 | s | Legacy / disabled |
| `toroidalMorph.progress` | `field.params.native_toroidalMorph__progress` | morph | 0–1 | 0–1 | 1 |  | Native automation |
| `toroidalMorph.oscillationSpeed` | `morph.thetaRate` | morph | 0–10 | -100–100 | 1 | Hz | Native automation |
| `toroidalMorph.poloidalRate` | `morph.phiRate` | morph | 0–10 | -100–100 | 1 | Hz | Native automation |
| `toroidalMorph.toroidalPhase` | `morph.thetaOffset` | morph | -0.9999705074463785–0.9999705074463785 | -159.15494309189535–159.15494309189535 | 6.283185307179586 | turns | Native automation |
| `toroidalMorph.poloidalPhase` | `morph.phiOffset` | morph | -0.9999705074463785–0.9999705074463785 | -159.15494309189535–159.15494309189535 | 6.283185307179586 | turns | Native automation |
| `toroidalMorph.oscillationAmplitude` | `field.params.native_toroidalMorph__oscillationAmplitude` | morph | 0–5 | -50–100 | 1 |  | Native automation |
| `toroidalMorph.driveDepth` | `morph.depth` | morph | 0–2 | -10–10 | 1 |  | Native automation |
| `toroidalMorph.holdRatio` | `morph.dwell` | morph | 0–0.9 | 0–0.99 | 1 |  | Native automation |
| `toroidalMorph.fiberPhaseOffset` | `field.params.native_toroidalMorph__fiberPhaseOffset` | morph | -12.56–12.56 | -1000–1000 | 1 |  | Native automation |
| `toroidalMorph.chiralCoupling` | `field.params.native_toroidalMorph__chiralCoupling` | morph | -4–4 | -100–100 | 1 |  | Native automation |
| `toroidalMorph.toroidalWinding` | `field.params.native_toroidalMorph__toroidalWinding` | morph | 0–48 | 0–512 | 1 |  | Native automation |
| `toroidalMorph.poloidalWinding` | `field.params.native_toroidalMorph__poloidalWinding` | morph | 0–48 | 0–512 | 1 |  | Native automation |
| `toroidalMorph.manifoldRadius` | `field.params.native_toroidalMorph__manifoldRadius` | morph | 10–1200 | 1–20000 | 1 | px | Native automation |
| `toroidalMorph.volumetricDepthScale` | `field.params.depth` | morph | 0–6 | 0–100 | 1 |  | Native automation |
| `interaction.radius` | `field.params.pointerRadius` | pointer | 0.025–5 | 0–125 | 400 | stage units | Native automation |
| `interaction.strength` | `field.params.pointerStrength` | pointer | -30–30 | -1000–1000 | 1 |  | Native automation |
| `interaction.velocityInfluence` | `field.params.native_interaction__velocityInfluence` | pointer | 0–5 | -100–100 | 1 |  | Native automation |
| `interaction.falloffPower` | `field.params.pointerFalloff` | pointer | 0.1–6 | 0–50 | 1 |  | Native automation |
| `relational.attractorGravity` | `field.params.native_relational__attractorGravity` | relational | -50–50 | -10000–10000 | 1 |  | Native automation |
| `relational.orbitSpeed` | `field.params.native_relational__orbitSpeed` | relational | -20–20 | -1000–1000 | 1 |  | Native automation |
| `relational.orbitRadius` | `field.params.native_relational__orbitRadius` | relational | 0–2000 | 0–100000 | 1 | px | Native automation |
| `relational.relationalSpin` | `field.params.native_relational__relationalSpin` | relational | -30–30 | -1000–1000 | 1 |  | Native automation |
| `relational.chaosFactor` | `field.params.native_relational__chaosFactor` | relational | 0–30 | -1000–1000 | 1 |  | Native automation |
| `relational.wanderSpeed` | `field.params.native_relational__wanderSpeed` | relational | 0–10 | -100–100 | 1 |  | Native automation |
| `relational.gravitySoftening` | `field.params.gravitySoftening` | relational | 0.0025–1.25 | 0.0025–250 | 400 | stage units | Native automation |
| `relational.gravityFalloff` | `field.params.gravityFalloff` | relational | 0.5–3 | 0.1–10 | 1 |  | Native automation |
| `relational.swirlRadius` | `field.params.swirlRadius` | relational | 0.05–7.5 | 0.0125–250 | 400 | stage units | Native automation |
| `color.cycleSpeed` | `field.params.native_color__cycleSpeed` | color | -10–10 | -1000–1000 | 1 |  | Native automation |
| `color.hueShiftSpeed` | `field.params.native_color__hueShiftSpeed` | color | -6–6 | -1000–1000 | 1 |  | Native automation |
| `color.waveFrequency` | `field.params.native_color__waveFrequency` | color | 0.05–24 | 0–1000 | 1 |  | Native automation |
| `color.angle` | `field.params.native_color__angle` | color | -360–360 | -36000–36000 | 1 | ° | Native automation |
| `color.speedReactiveIntensity` | `field.params.native_color__speedReactiveIntensity` | color | 0–5 | -100–100 | 1 |  | Native automation |
| `color.turbulenceModulation` | `field.params.native_color__turbulenceModulation` | color | 0–3 | -100–100 | 1 |  | Native automation |
| `color.densityWeight` | `field.params.native_color__densityWeight` | color | 0–3 | -10–10 | 1 |  | Native automation |
| `color.contrast` | `field.params.native_color__contrast` | color | 0.1–5 | 0–100 | 1 |  | Native automation |
| `backgroundGlowIntensity` | `field.params.native_backgroundGlowIntensity` | color | 0–3 | 0–100 | 1 |  | Native automation |
| `cymatics.frequencyHz` | `field.params.frequency` | resonance | 20–4000 | 1–100000 | 1 | Hz | Native automation |
| `cymatics.dominance` | `field.params.dominance` | resonance | 0–1 | 0–1 | 1 |  | Native automation |
| `cymatics.dampingQFactor` | `field.params.native_cymatics__dampingQFactor` | resonance | 0.1–40 | 0.01–10000 | 1 |  | Native automation |
| `cymatics.driveStrength` | `field.params.excitation` | resonance | 0–6 | 0–100 | 1 |  | Native automation |
| `cymatics.transportGain` | `field.params.native_cymatics__transportGain` | resonance | 0–10 | 0–1000 | 1 |  | Native automation |
| `cymatics.agitation` | `field.params.native_cymatics__agitation` | resonance | 0–5 | 0–200 | 1 |  | Native automation |
| `cymatics.plateSize` | `field.params.native_cymatics__plateSize` | resonance | 100–2000 | 10–20000 | 1 | px | Native automation |
| `cymatics.modeCount` | `field.params.native_cymatics__modeCount` | resonance | 1–64 | 1–64 | 1 |  | Native automation |
| `cymatics.boundaryStrength` | `field.params.native_cymatics__boundaryStrength` | resonance | 0–30 | 0–1000 | 1 |  | Native automation |
| `cymatics.baseFrequency` | `field.params.native_cymatics__baseFrequency` | resonance | 5–200 | 0.5–2000 | 1 | Hz | Native automation |
| `cymatics.sweepSpeed` | `field.params.native_cymatics__sweepSpeed` | resonance | 0.05–600 | 0.01–100000 | 1 | s | Legacy / disabled |
| `cymatics.sweep.glideS` | `field.params.native_cymatics__sweep__glideS` | resonance | 0.1–30 | 0.01–3600 | 1 | s | Native automation |
| `cymatics.sweep.dwellS` | `field.params.native_cymatics__sweep__dwellS` | resonance | 0–30 | 0–3600 | 1 | s | Native automation |
| `composition.orchestration.dwell` | `composition.focusDwell` | composition | 0–30 | 0–3600 | 1 | s | Native automation |
| `composition.orchestration.glide` | `composition.focusDuration` | composition | 0.02–30 | 0.01–3600 | 1 | s | Native automation |
| `composition.entityTintWeight` | `field.params.native_composition__entityTintWeight` | composition | 0–1 | 0–1 | 1 |  | Native automation |
| `composition.orchestration.focusTintWeight` | `field.params.native_composition__orchestration__focusTintWeight` | composition | 0–1 | 0–1 | 1 |  | Native automation |

## Entity targets

The table shows the initial scene's resolved native indices only as an example. Saved automation uses IDs, never these indices. Pins omit meaningless formation and sequence targets.

| Native owner path | Authored path | Context | Slider bounds | Validated bounds | Factor | Unit | Driver support |
|---|---|---|---|---|---|---|---|
| `entities.0.x` | `entity.position.x` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.0.y` | `entity.position.y` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.0.z` | `entity.position.z` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.0.scale` | `entity.scale` | entity | 0.02–4 | 0.001–100 | 1 |  | Native automation |
| `entities.0.forces.strength` | `entity.force.strength` | entity | -20–20 | -1000–1000 | 1 |  | Native automation |
| `entities.0.forces.radius` | `entity.force.radius` | entity | 0.05–5 | 0.0125–50 | 400 | px | Native automation |
| `entities.0.forces.spin` | `entity.force.spin` | entity | -20–20 | -1000–1000 | 1 |  | Native automation |
| `entities.0.tintWeight` | `entity.tintWeight` | entity | 0–1 | 0–1 | 1 |  | Native automation |
| `entities.0.sequence.hold` | `entity.sequence.hold` | entity | 0–30 | 0–3600 | 1 | s | Native automation |
| `entities.0.sequence.transition` | `entity.sequence.transition` | entity | 0.05–30 | 0.02–3600 | 1 | s | Native automation |
| `entities.0.sequence.rateMul` | `entity.sequence.rateMul` | entity | -5–5 | -100–100 | 1 |  | Native automation |
| `entities.0.sequence.phaseOffset` | `entity.sequence.phaseOffset` | entity | -4–4 | -1000–1000 | 1 |  | Native automation |
| `entities.1.x` | `entity.position.x` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.1.y` | `entity.position.y` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.1.z` | `entity.position.z` | entity | -3–3 | -50–50 | 400 | px | Native automation |
| `entities.1.scale` | `entity.scale` | entity | 0.02–4 | 0.001–100 | 1 |  | Native automation |
| `entities.1.forces.strength` | `entity.force.strength` | entity | -20–20 | -1000–1000 | 1 |  | Native automation |
| `entities.1.forces.radius` | `entity.force.radius` | entity | 0.05–5 | 0.0125–50 | 400 | px | Native automation |
| `entities.1.forces.spin` | `entity.force.spin` | entity | -20–20 | -1000–1000 | 1 |  | Native automation |
| `entities.1.tintWeight` | `entity.tintWeight` | entity | 0–1 | 0–1 | 1 |  | Native automation |
| `entities.1.sequence.hold` | `entity.sequence.hold` | entity | 0–30 | 0–3600 | 1 | s | Native automation |
| `entities.1.sequence.transition` | `entity.sequence.transition` | entity | 0.05–30 | 0.02–3600 | 1 | s | Native automation |
| `entities.1.sequence.rateMul` | `entity.sequence.rateMul` | entity | -5–5 | -100–100 | 1 |  | Native automation |
| `entities.1.sequence.phaseOffset` | `entity.sequence.phaseOffset` | entity | -4–4 | -1000–1000 | 1 |  | Native automation |

## Reset and target behaviour

Only count changes and explicit reset reseed live particles. Shape/source edits and particle-share changes update target geometry or allocations without resetting the live medium. Coordinates, dimensions, rotation, tint and forces update uniforms. Inspector, selection, view, layout-plane, guide visibility and capture operations do not reseed. Scene playback interpolates persistent identities; the preview's page-image dissolve is not used for physical transitions.

Image/ASCII/yantra/authored-cymatic source controls retain native target samplers. Native field parameters absent from the preview are exposed under their actual names. Native payload fields not altered by the authoring UI remain in the retained source configuration. Preview-only controls with no known reversible mapping are not guessed.
