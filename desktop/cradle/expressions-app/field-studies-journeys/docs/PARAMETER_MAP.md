# Parameter map

49 registered shell controls. This is an inventory of this shell, not a claim to contain the entire native registry. Per-entity transforms, forces, tint, sequences, text and composition controls are additional contextual controls rather than entries in this field-only table.

The alternate's especially useful material additions are size distribution; lattice irregularity; mark roundness, softness and ragged edges; elongation/orientation; density scale, phase and contrast; edge emphasis; halo; form thickness; and warp. Preserve their material intent while mapping into the real engine.

The WebGL preview implements the material/appearance controls and procedural visual motion. Its forces are deformations, not integrated acceleration. The simple Canvas2D fallback is intentionally reduced. The frequency range and seven marks are illustrative UI bounds pending native calibration. Production values and units remain authoritative.

| Control | Key | Context | Shell bounds | Status |
|---|---|---|---|---|
| Particle allocation | `count` | material | 4000–100000 | Live preview |
| Grain size | `size` | material | 0.25–3 | Live preview |
| Size distribution | `sizeBias` | material | 0.2–4 | Live preview |
| Opacity | `opacity` | material | 0.05–1 | Live preview |
| Roundness | `roundness` | material | 0–1 | Live preview |
| Edge softness | `softness` | material | 0–1 | Live preview |
| Imperfect edges | `irregularity` | material | 0–1 | Live preview |
| Elongation | `elongation` | material | 0–3 | Live preview |
| Mark orientation | `orientation` | material | -180–180 | Live preview |
| Lattice irregularity | `jitter` | material | 0–1 | Live preview |
| Paper grain | `grain` | material | 0–0.2 | Live preview |
| Density contrast | `contrast` | density | 0–1 | Live preview |
| Density scale | `densityScale` | density | 0.1–3 | Live preview |
| Density phase | `densityPhase` | density | 0–6.28 | Live preview |
| Edge emphasis | `edgeWeight` | density | 0–1 | Live preview |
| Dust halo | `halo` | density | 0–0.6 | Live preview |
| Form thickness | `thickness` | density | -0.05–0.12 | Live preview |
| Form warp | `warp` | density | 0–1 | Live preview |
| Motion rate | `speed` | motion | 0–3 | Live preview |
| Circulation | `circulation` | motion | 0–3 | Live preview |
| Restlessness | `turbulence` | motion | 0–2 | Live preview |
| Flow scale | `turbulenceScale` | motion | 0.2–5 | Live preview |
| Dissolution | `dispersion` | motion | 0–1 | Live preview |
| Spatial depth | `depth` | motion | 0–1 | Live preview |
| Pointer strength | `pointerStrength` | motion | 0–3 | Live preview |
| Pointer radius | `pointerRadius` | motion | 0.03–0.8 | Live preview |
| Return to formation | `recovery` | physics | 0–12 | Production integration |
| Damping | `damping` | physics | 0.05–8 | Production integration |
| Fluid coupling | `flow` | physics | 0–5 | Production integration |
| Snap rigidity | `snapRigidity` | physics | 0–5 | Production integration |
| Density tether | `densityTether` | physics | 0–5 | Production integration |
| Curl depth | `curlDepth` | physics | 0–3 | Production integration |
| Vortex radius | `vortexRadius` | physics | 0.01–3 | Production integration |
| Gravity X | `gravityX` | physics | -5–5 | Production integration |
| Gravity Y | `gravityY` | physics | -5–5 | Production integration |
| Gravity Z | `gravityZ` | physics | -5–5 | Production integration |
| Quadratic drag | `quadraticDrag` | physics | 0–5 | Production integration |
| Thermal jitter | `thermalJitter` | physics | 0–3 | Production integration |
| Speed limit | `speedLimit` | physics | 0.1–20 | Production integration |
| Z confinement | `zConfinement` | physics | 0–1 | Production integration |
| Gravity softening | `gravitySoftening` | physics | 0.01–2 | Production integration |
| Gravity falloff | `gravityFalloff` | physics | 0.1–5 | Production integration |
| Swirl radius | `swirlRadius` | physics | 0.01–3 | Production integration |
| Pointer falloff | `pointerFalloff` | physics | 0.1–5 | Production integration |
| Time scale | `timeScale` | physics | 0.1–3 | Live preview |
| Shared frequency | `frequency` | resonance | 80–800 | Production integration |
| Formation ↔ resonance | `dominance` | resonance | 0–1 | Production integration |
| Resonator damping | `resonanceDamping` | resonance | 0.005–0.5 | Production integration |
| Excitation | `excitation` | resonance | 0–2 | Production integration |

The production integration must retain the native registry's useful slider ranges, broader validated numeric bounds, field/local scope and automation support. Do not clamp existing user configurations to this preview's illustrative limits.
