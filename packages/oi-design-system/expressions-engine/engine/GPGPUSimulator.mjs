/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from "three";
import {
  simulationVertexShader,
  positionSimulationShader,
  velocitySimulationShader,
  SIMULATION_PARAMETER_ROWS,
  SIMULATION_PARAMETER_HEIGHT
} from "./shaders/simulationShaders.mjs";
import {
  mediumSplatVertexShader,
  mediumSplatFragmentShader,
  mediumAdvectShader,
  mediumDivergenceShader,
  mediumPressureShader,
  mediumGradientSubtractShader,
  MEDIUM_PRESSURE_DECAY
} from "./shaders/mediumShaders.mjs";
import { mediumVolumeSideFor } from "./mediumGrid.mjs";
import {
  pairwiseCellIdShader,
  pairwiseForceShader,
  pairwiseRangeShader,
  pairwiseSortShader
} from "./shaders/pairwiseShaders.mjs";
import {
  bitonicSchedule,
  cellGridDims,
  PAIRWISE_MAX_PARTICLES,
  PAIRWISE_MAX_SPEED_FRACTION,
  sortSideForParticleTexSide
} from "./pairwiseSchedule.mjs";
import { MAX_FORMATIONS, MAX_PINS, MAX_FORCE_EMITTERS } from "./fieldModel.mjs";
class GPGPUSimulator {
  localModeData = new Float32Array(64 * MAX_FORMATIONS * 4);
  localModeTexture = new THREE.DataTexture(this.localModeData, 64, MAX_FORMATIONS, THREE.RGBAFormat, THREE.FloatType);
  parameterData = new Float32Array(MAX_FORCE_EMITTERS * SIMULATION_PARAMETER_HEIGHT * 4);
  parameterTexture = new THREE.DataTexture(this.parameterData, MAX_FORCE_EMITTERS, SIMULATION_PARAMETER_HEIGHT, THREE.RGBAFormat, THREE.FloatType);
  writeParameter(row, index, x, y = 0, z = 0, w = 0) {
    const at = (row * MAX_FORCE_EMITTERS + index) * 4;
    this.parameterData[at] = x;
    this.parameterData[at + 1] = y;
    this.parameterData[at + 2] = z;
    this.parameterData[at + 3] = w;
    this.parameterTexture.needsUpdate = true;
  }
  renderer;
  texWidth;
  texHeight;
  particleCount;
  seedGeneration = 0;
  stepCount = 0;
  // Ping-pong render targets
  posTarget0;
  posTarget1;
  velTarget0;
  velTarget1;
  currentPosTarget;
  nextPosTarget;
  currentVelTarget;
  nextVelTarget;
  // Shared medium (Eulerian grid): ping-pong velocity + divergence + ping-pong pressure.
  // Allocated lazily at the configured grid resolution; in 3D mode the side is
  // N² (an N×N×N voxel volume tiled into the texture, see mediumGrid.ts).
  mediumRes = 0;
  medium3D = false;
  mediumVel0 = null;
  mediumVel1 = null;
  mediumDivergenceTarget = null;
  mediumPressure0 = null;
  mediumPressure1 = null;
  mediumVelRead = null;
  mediumVelWrite = null;
  mediumPressureRead = null;
  mediumPressureWrite = null;
  mediumSplatMaterial;
  mediumAdvectMaterial;
  mediumDivergenceMaterial;
  mediumPressureMaterial;
  mediumGradientMaterial;
  splatScene;
  splatPoints;
  // Quad setup for GPGPU render pass
  quadScene;
  quadCamera;
  quadMesh;
  // Simulation shader materials
  posMaterial;
  velMaterial;
  // Sorted-grid pairwise collision passes (allocated lazily; zero draw calls while disabled)
  pairCellIdMaterial;
  pairSortMaterial;
  pairRangeMaterial;
  pairForceMaterial;
  pairSortA = null;
  pairSortB = null;
  pairCellTable = null;
  pairForceTarget = null;
  pairForceFallback;
  pairSchedule = null;
  pairSide = 0;
  pairCells = new THREE.Vector2(0, 0);
  pairWarned = false;
  rtTemplate;
  constructor(renderer, particleCount = 2e5) {
    this.renderer = renderer;
    const requested = Math.max(64, Math.min(4e6, Math.floor(particleCount)));
    const texSide = Math.max(8, Math.ceil(Math.sqrt(requested)));
    this.texWidth = texSide;
    this.texHeight = texSide;
    this.particleCount = requested;
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;
    const rtOptions = {
      type: floatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    };
    this.rtTemplate = rtOptions;
    this.posTarget0 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
    this.posTarget1 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
    this.velTarget0 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
    this.velTarget1 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
    this.currentPosTarget = this.posTarget0;
    this.nextPosTarget = this.posTarget1;
    this.currentVelTarget = this.velTarget0;
    this.nextVelTarget = this.velTarget1;
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.posMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: positionSimulationShader,
      uniforms: {
        uPositionTexture: { value: null },
        uVelocityTexture: { value: null },
        uDelta: { value: 0.016 },
        uCompPlane: { value: 0 },
        uMorphTrajectory: { value: 0 },
        uZDepthRetention: { value: 0 },
        uZConfinement: { value: 1 },
        // True-3D letterform bodies: keeps the baked depth axis from being damped away.
        uDepthGeometry: { value: 0 },
        // Glyph SDF colliders (hard projection out of obstacle interiors)
        uCollisionEnabled: { value: 0 },
        uCollisionMode: { value: 0 },
        uCollisionIntegrity: { value: 0.5 },
        uSdfAtlas: { value: null },
        uCollisionTile: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0.5, 0)) },
        uTargetATexture: { value: null },
        uTargetBTexture: { value: null },
        uPairwiseEnabled: { value: 0 },
        // 1 = volumetric bodies: pairwise contacts also correct the depth axis.
        uPairwise3D: { value: 0 },
        uPairwiseCorrectionTexture: { value: null },
        uPairwiseCorrectionZTexture: { value: null },
        uEntityCount: { value: 0 },
        uConnectionStart: { value: 1e30 },
        uConnectionMetadata: { value: null },
        uEntityBounds: { value: new Float32Array(MAX_FORMATIONS) },
        uEntityCenter: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0, 200)) },
        uEntityMorph: { value: new Float32Array(MAX_FORMATIONS) },
        // Depth scale of each partition: the slab axis conversion for the
        // extruded-body boundary test.
        uEntityDepthScale: { value: new Float32Array(MAX_FORMATIONS).fill(1) },
        uEntityTransform: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector3(1, 1, 0)) },
        uTexSize: { value: new THREE.Vector2(1, 1) }
      },
      depthTest: false,
      depthWrite: false
    });
    this.velMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: velocitySimulationShader,
      uniforms: {
        uPositionTexture: { value: null },
        uVelocityTexture: { value: null },
        uTargetATexture: { value: null },
        uTargetBTexture: { value: null },
        uTargetNoise: { value: null },
        uMorphProgress: { value: 0 },
        uDelta: { value: 0.016 },
        uTime: { value: 0 },
        // Fluid forces
        uCurlScale: { value: 1 },
        uCurlSpeed: { value: 0.8 },
        uTurbulence: { value: 1 },
        uVortexStrength: { value: 1.2 },
        uDepthGeometry: { value: 0 },
        uVortex3d: { value: 0 },
        uDispersion3d: { value: 0 },
        uVortexCenter: { value: new THREE.Vector2(0, 0) },
        uViscosity: { value: 0.94 },
        uReturnSpeed: { value: 1 },
        uDispersion: { value: 0.5 },
        uStyleMode: { value: 0 },
        // Extended physics
        uSnapRigidity: { value: 1 },
        uDensityTether: { value: 1 },
        uCurlDepth: { value: 0.57 },
        uVortexRadius: { value: 450 },
        uGravity: { value: new THREE.Vector3(0, 0, 0) },
        uQuadraticDrag: { value: 0 },
        uThermalJitter: { value: 0 },
        uMaxSpeed: { value: 35e3 },
        uGravitySoftening: { value: 45 },
        uGravityFalloff: { value: 1.45 },
        uSwirlRadius: { value: 500 },
        uPointerFalloffPower: { value: 2 },
        uTorPhase: { value: 0 },
        uPolPhase: { value: 0 },
        // Free Relational System
        uRelationalEnabled: { value: 0 },
        uAttractorCount: { value: 2 },
        uAttractors: {
          // The ten authored seed attractors, then inert poles: the uniform
          // array is sized to the shader's pin budget (MAX_PINS).
          value: Array.from({ length: MAX_PINS }, (_, index) => {
            const seeds = [
              new THREE.Vector4(-150, 0, 0, 1),
              new THREE.Vector4(150, 0, 0, 1),
              new THREE.Vector4(0, 150, 0, 1),
              new THREE.Vector4(0, -150, 0, 1),
              new THREE.Vector4(100, 100, 0, 1),
              new THREE.Vector4(-100, -100, 0, 1),
              new THREE.Vector4(0, 250, 0, 1),
              new THREE.Vector4(0, -250, 0, 1),
              new THREE.Vector4(200, 0, 0, 1),
              new THREE.Vector4(-200, 0, 0, 1)
            ];
            return index < seeds.length ? seeds[index] : new THREE.Vector4(-99999, -99999, 0, 0);
          })
        },
        uAttractorSpin: { value: Array.from({ length: MAX_PINS }, (_, index) => index % 2 ? -1 : 1) },
        uRelationalGravity: { value: 1.5 },
        uRelationalSpin: { value: 1.2 },
        uChaosFactor: { value: 0 },
        // Entities (first-class centres of formation)
        uEntityCount: { value: 0 },
        uConnectionStart: { value: 1e30 },
        uConnectionMetadata: { value: null },
        uEntityBounds: { value: new Float32Array(MAX_FORMATIONS) },
        uEntityCenter: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0, 200)) },
        uEntityMorph: { value: new Float32Array(MAX_FORMATIONS) },
        uEntityDepthScale: { value: new Float32Array(MAX_FORMATIONS).fill(1) },
        uEntityNormalized: { value: new Float32Array(MAX_FORMATIONS) },
        uEntityTransform: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector3(1, 1, 0)) },
        uTexSize: { value: new THREE.Vector2(1, 1) },
        uForceEmitterCount: { value: 0 },
        uSimulationParameters: { value: this.parameterTexture },
        uCompPlane: { value: 0 },
        uResDominance: { value: 1 },
        // Continuous modal cymatic resonator (live per-mode complex envelopes)
        uLocalResCount: { value: 0 },
        uLocalResModes: { value: this.localModeTexture },
        uLocalResOrientation: { value: new THREE.Vector4(0, 0, 0, 1) },
        uLocalResTransport: { value: 0 },
        uLocalResDriveScale: { value: 0 },
        uResEnabled: { value: 0 },
        uResModeCount: { value: 0 },
        uResPlateSize: { value: 700 },
        uResTransport: { value: 1 },
        uResAgitation: { value: 0.3 },
        uResBoundary: { value: 6 },
        uResPlane: { value: 0 },
        uResDriveScale: { value: 1 },
        uRes3D: { value: 0 },
        // Sorted-grid pairwise collisions (bound to a 1x1 zero texture while disabled)
        uPairwiseForceTexture: { value: null },
        uPairwiseForceZTexture: { value: null },
        // 3D path: depth-axis dv (force pass draw buffer 1)
        uPairwiseEnabled: { value: 0 },
        uPairwise3D: { value: 0 },
        uPairMaxDelta: { value: 5e3 },
        // Dual-Phase Toroidal/Poloidal Morph & Inverse Hopf Fibration System
        uMorphTrajectory: { value: 1 },
        uFiberPhaseOffset: { value: 0 },
        uToroidalWinding: { value: 3 },
        uPoloidalWinding: { value: 2 },
        uChiralCoupling: { value: 0.75 },
        uOscillationAmp: { value: 1.2 },
        uOscillationFreq: { value: 0.8 },
        uBreathPhase: { value: 0 },
        uBreathDepth: { value: 0.35 },
        uManifoldRadius: { value: 180 },
        uTorusDepthScale: { value: 1 },
        // Pointer
        uPointerPos: { value: new THREE.Vector2(-99999, -99999) },
        uBurstPosition: { value: new THREE.Vector2() },
        uBurstZ: { value: 0 },
        uBurstVelocity: { value: new THREE.Vector2() },
        uBurstRadius: { value: 150 },
        uBurstRadial: { value: 0 },
        uBurstSpin: { value: 0 },
        uPointerVelocity: { value: new THREE.Vector2(0, 0) },
        uPointerZ: { value: 0 },
        uPointerRadius: { value: 150 },
        uPointerStrength: { value: 1 },
        uInteractionMode: { value: 0 },
        // Shared Eulerian medium (all terms multiply the enabled guard)
        uMediumEnabled: { value: 0 },
        uMediumVelTexture: { value: null },
        uMediumPressureTexture: { value: null },
        uMediumMin: { value: new THREE.Vector2(-1400, -1400) },
        uMediumMax: { value: new THREE.Vector2(1400, 1400) },
        uMediumTexel: { value: new THREE.Vector2(1 / 192, 1 / 192) },
        uMediumGridRes: { value: 192 },
        uMediumPlane: { value: 0 },
        uMediumPressureGain: { value: 4 },
        uMediumCoupling: { value: 0.8 },
        // 3D medium: voxel volume tiled into an N²×N² texture (see mediumGrid.ts)
        uMedium3D: { value: 0 },
        uMediumN: { value: 32 },
        uMediumTexSide: { value: 1024 },
        // Glyph SDF colliders (all terms multiply the enabled guard)
        uCollisionEnabled: { value: 0 },
        uCollisionMode: { value: 0 },
        uCollisionRestitution: { value: 0.35 },
        uCollisionFriction: { value: 0.1 },
        uCollisionBand: { value: 40 },
        uCollisionStrength: { value: 4 },
        uCollisionIntegrity: { value: 0.5 },
        uSdfAtlas: { value: null },
        uCollisionTile: { value: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0.5, 0)) }
      },
      depthTest: false,
      depthWrite: false
    });
    this.quadMesh = new THREE.Mesh(quadGeom, this.posMaterial);
    this.quadScene.add(this.quadMesh);
    this.splatScene = new THREE.Scene();
    {
      const splatUv = new Float32Array(this.particleCount * 2);
      for (let i = 0; i < this.particleCount; i++) {
        splatUv[i * 2 + 0] = (i % this.texWidth + 0.5) / this.texWidth;
        splatUv[i * 2 + 1] = (Math.floor(i / this.texWidth) + 0.5) / this.texHeight;
      }
      const splatGeom = new THREE.BufferGeometry();
      splatGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.particleCount * 3), 3));
      splatGeom.setAttribute("aParticleUv", new THREE.BufferAttribute(splatUv, 2));
      this.mediumSplatMaterial = new THREE.ShaderMaterial({
        vertexShader: mediumSplatVertexShader,
        fragmentShader: mediumSplatFragmentShader,
        uniforms: {
          uPositionTexture: { value: null },
          uVelocityTexture: { value: null },
          uMediumMin: { value: new THREE.Vector2(-1400, -1400) },
          uMediumMax: { value: new THREE.Vector2(1400, 1400) },
          uMediumPlane: { value: 0 },
          uConnectionStart: { value: 1e30 },
          uConnectionMetadata: { value: null },
          uTexSize: { value: new THREE.Vector2(this.texWidth, this.texHeight) },
          uSplatGain: { value: 1 },
          // 3D medium: this draw writes the slice at round(fvz) + uSliceOffset
          uMedium3D: { value: 0 },
          uMediumN: { value: 32 },
          uSliceOffset: { value: 0 }
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      this.splatPoints = new THREE.Points(splatGeom, this.mediumSplatMaterial);
      this.splatPoints.frustumCulled = false;
      this.splatScene.add(this.splatPoints);
    }
    const unitTexel = () => new THREE.Vector2(1 / 192, 1 / 192);
    this.mediumAdvectMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumAdvectShader,
      uniforms: {
        uMediumVelocity: { value: null },
        uDelta: { value: 0.016 },
        uDissipation: { value: 0.97 },
        uMediumExtent: { value: 2800 },
        uTexel: { value: unitTexel() },
        uMedium3D: { value: 0 },
        uMediumN: { value: 32 },
        uMediumTexSide: { value: 1024 }
      },
      depthTest: false,
      depthWrite: false
    });
    this.mediumDivergenceMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumDivergenceShader,
      uniforms: { uMediumVelocity: { value: null }, uTexel: { value: unitTexel() }, uMedium3D: { value: 0 }, uMediumN: { value: 32 }, uMediumTexSide: { value: 1024 } },
      depthTest: false,
      depthWrite: false
    });
    this.mediumPressureMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumPressureShader,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexel: { value: unitTexel() },
        uPressureDecay: { value: MEDIUM_PRESSURE_DECAY },
        uMedium3D: { value: 0 },
        uMediumN: { value: 32 },
        uMediumTexSide: { value: 1024 }
      },
      depthTest: false,
      depthWrite: false
    });
    this.mediumGradientMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumGradientSubtractShader,
      uniforms: {
        uPressure: { value: null },
        uMediumVelocity: { value: null },
        uTexel: { value: unitTexel() },
        uMedium3D: { value: 0 },
        uMediumN: { value: 32 },
        uMediumTexSide: { value: 1024 }
      },
      depthTest: false,
      depthWrite: false
    });
    const pwUniforms = () => ({
      uConnectionStart: { value: 1e30 },
      uConnectionMetadata: { value: null },
      uPositionTexture: { value: null },
      uVelocityTexture: { value: null },
      uSortTexture: { value: null },
      uCellTable: { value: null },
      uTexSize: { value: new THREE.Vector2(this.texWidth, this.texHeight) },
      uCells: { value: new THREE.Vector2(1, 1) },
      uSide: { value: 1 },
      uSlots: { value: 1 },
      uParticleCount: { value: this.particleCount },
      uExtent: { value: 1400 },
      uCellSize: { value: 2.2 },
      uRadius: { value: 2.2 },
      uStiffness: { value: 1 },
      uRestitution: { value: 0.12 },
      uPairViscosity: { value: 0.06 },
      uCompPlane: { value: 0 },
      uPairwise3D: { value: 0 },
      uDelta: { value: 0.016 },
      uPartner: { value: 1 },
      uBlock: { value: 2 }
    });
    this.pairCellIdMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseCellIdShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false
    });
    this.pairSortMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseSortShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false
    });
    this.pairRangeMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseRangeShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false
    });
    this.pairForceMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseForceShader,
      glslVersion: THREE.GLSL3,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false
    });
    this.pairForceFallback = new THREE.DataTexture(new Float32Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    this.pairForceFallback.needsUpdate = true;
    this.velMaterial.uniforms.uPairwiseForceTexture.value = this.pairForceFallback;
    this.velMaterial.uniforms.uPairwiseForceZTexture.value = this.pairForceFallback;
    this.posMaterial.uniforms.uPairwiseCorrectionZTexture.value = this.pairForceFallback;
  }
  /**
   * Initializes position and velocity textures with seed data from target A
   */
  seedInitialState(initialData) {
    this.seedGeneration++;
    const initTex = new THREE.DataTexture(
      initialData,
      this.texWidth,
      this.texHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    initTex.needsUpdate = true;
    initTex.minFilter = THREE.NearestFilter;
    initTex.magFilter = THREE.NearestFilter;
    const passMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: (
        /* glsl */
        `
        uniform sampler2D uInitTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(uInitTexture, vUv);
        }
      `
      ),
      uniforms: { uInitTexture: { value: initTex } },
      depthTest: false,
      depthWrite: false
    });
    this.quadMesh.material = passMaterial;
    this.renderer.setRenderTarget(this.posTarget0);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.renderer.setRenderTarget(this.posTarget1);
    this.renderer.render(this.quadScene, this.quadCamera);
    const zeroVelMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: (
        /* glsl */
        `
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `
      ),
      depthTest: false,
      depthWrite: false
    });
    this.quadMesh.material = zeroVelMaterial;
    this.renderer.setRenderTarget(this.velTarget0);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.renderer.setRenderTarget(this.velTarget1);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.renderer.setRenderTarget(null);
    initTex.dispose();
    passMaterial.dispose();
    zeroVelMaterial.dispose();
  }
  /**
   * Updates target textures for morphing
   */
  setTargetTextures(texA, texB, vortexCenter, noise) {
    this.velMaterial.uniforms.uTargetNoise.value = noise ?? null;
    for (const material of [this.posMaterial, this.velMaterial, this.pairCellIdMaterial, this.pairForceMaterial, this.mediumSplatMaterial]) material.uniforms.uConnectionMetadata.value = noise ?? null;
    this.velMaterial.uniforms.uTargetATexture.value = texA;
    this.velMaterial.uniforms.uTargetBTexture.value = texB;
    this.velMaterial.uniforms.uVortexCenter.value.copy(vortexCenter);
  }
  /**
   * Updates dynamic attractor positions and polarities for relational orbital dynamics
   */
  setAttractors(attractors, spins) {
    const attrUniform = this.velMaterial.uniforms.uAttractors.value;
    for (let i = 0; i < Math.min(attractors.length, attrUniform.length); i++) {
      attrUniform[i].copy(attractors[i]);
    }
    const spinUniform = this.velMaterial.uniforms.uAttractorSpin.value;
    for (let i = 0; i < Math.min(spins.length, spinUniform.length); i++) {
      spinUniform[i] = spins[i];
    }
  }
  /** Push formation partition geometry/state; physical forces use the separate emitter table. */
  setEntityState(u) {
    const vU = this.velMaterial.uniforms;
    vU.uConnectionStart.value = u.connectionStart ?? this.particleCount;
    for (const material of [this.posMaterial, this.pairCellIdMaterial, this.pairForceMaterial, this.mediumSplatMaterial]) material.uniforms.uConnectionStart.value = vU.uConnectionStart.value;
    vU.uEntityCount.value = Math.min(MAX_FORMATIONS, u.count);
    vU.uEntityBounds.value.set(u.bounds.subarray(0, MAX_FORMATIONS));
    vU.uEntityMorph.value.set(u.morph.subarray(0, MAX_FORMATIONS));
    vU.uEntityDepthScale.value.set(u.depthScales ?? new Float32Array(MAX_FORMATIONS).fill(1));
    vU.uEntityNormalized.value.set(u.normalized ?? new Float32Array(MAX_FORMATIONS));
    const cU = vU.uEntityCenter.value;
    for (let i = 0; i < MAX_FORMATIONS; i++) {
      cU[i].copy(u.centers[i]);
      vU.uEntityTransform.value[i].copy(u.transforms[i]);
    }
    vU.uTexSize.value.set(this.texWidth, this.texHeight);
    const pU = this.posMaterial.uniforms;
    pU.uEntityCount.value = vU.uEntityCount.value;
    pU.uEntityBounds.value.set(u.bounds.subarray(0, MAX_FORMATIONS));
    pU.uEntityMorph.value.set(u.morph.subarray(0, MAX_FORMATIONS));
    pU.uEntityDepthScale.value.set(u.depthScales ?? new Float32Array(MAX_FORMATIONS).fill(1));
    const pC = pU.uEntityCenter.value;
    for (let i = 0; i < MAX_FORMATIONS; i++) {
      pC[i].copy(u.centers[i]);
      pU.uEntityTransform.value[i].copy(u.transforms[i]);
    }
    pU.uTexSize.value.set(this.texWidth, this.texHeight);
  }
  /**
   * Upload the glyph SDF atlas (one texture per bake cycle) plus per-partition
   * tile rects (uv origin x/y, tile width u, enabled). Scalar collision physics
   * are config-driven in step().
   */
  setCollisionState(tiles, texture) {
    const vU = this.velMaterial.uniforms;
    const pU = this.posMaterial.uniforms;
    const vTiles = vU.uCollisionTile.value;
    const pTiles = pU.uCollisionTile.value;
    for (let i = 0; i < MAX_FORMATIONS; i++) {
      vTiles[i].fromArray(tiles, i * 4);
      pTiles[i].copy(vTiles[i]);
    }
    vU.uSdfAtlas.value = texture;
    pU.uSdfAtlas.value = texture;
  }
  setForceEmitters(emitters) {
    const u = this.velMaterial.uniforms;
    const count = Math.min(MAX_FORCE_EMITTERS, emitters.length);
    u.uForceEmitterCount.value = count;
    for (let i = 0; i < count; i++) {
      const e = emitters[i];
      if (!e.enabled) {
        this.writeParameter(SIMULATION_PARAMETER_ROWS.forceCenter, i, -99999, -99999, 0, 1);
        this.writeParameter(SIMULATION_PARAMETER_ROWS.forceParams, i, 0);
        continue;
      }
      this.writeParameter(SIMULATION_PARAMETER_ROWS.forceCenter, i, e.position.x, e.position.y, e.position.z, Math.max(5, e.radius));
      const mode = e.law === "vortex" ? 3 : e.polarity === "repel" ? 2 : 1;
      this.writeParameter(SIMULATION_PARAMETER_ROWS.forceParams, i, e.strength, mode, e.spin, e.metric === "world3d" ? 1 : 0);
    }
  }
  setCompositionPlane(plane) {
    const v = plane === "horizontal" ? 1 : 0;
    this.velMaterial.uniforms.uCompPlane.value = v;
    this.posMaterial.uniforms.uCompPlane.value = v;
    this.velMaterial.uniforms.uResPlane.value = v > 0.5 ? 0 : 1;
  }
  setResonatorDominance(d) {
    this.velMaterial.uniforms.uResDominance.value = Math.max(0, Math.min(1, d));
  }
  /** Push the live modal envelopes + coupling parameters of the cymatic resonator.
   *  `threeD` switches the shader into the volumetric standing-wave mode whose slot
   *  layout is i = ((m-1)*4 + (n-1))*4 + (p-1); false keeps the legacy 2D plate. */
  setResonatorState(enabled, modeCount, re, im, plateSize, transport, agitation, boundary, plane, driveScale, threeD = false) {
    const vU = this.velMaterial.uniforms;
    vU.uResEnabled.value = enabled ? 1 : 0;
    vU.uResModeCount.value = Math.max(0, Math.min(64, Math.round(modeCount)));
    for (let i = 0; i < 64; i++) this.writeParameter(SIMULATION_PARAMETER_ROWS.resonator, i, re[i] ?? 0, im[i] ?? 0);
    vU.uResPlateSize.value = plateSize;
    vU.uResTransport.value = transport;
    vU.uResAgitation.value = agitation;
    vU.uResBoundary.value = boundary;
    vU.uResPlane.value = plane;
    vU.uResDriveScale.value = driveScale;
    vU.uRes3D.value = threeD ? 1 : 0;
  }
  /** Each independent frequency retains its own complex modes. The shader
   * adds time-averaged vibration-intensity gradients; it claims no carrier beats. */
  setLocalizedResonanceState(frames, orientation, transport, driveScale) {
    if (frames.length > MAX_FORMATIONS) throw Error("Too many localized resonance drivers");
    const u = this.velMaterial.uniforms;
    this.localModeData.fill(0);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      this.writeParameter(SIMULATION_PARAMETER_ROWS.localCenter, i, ...f.position, f.params.plateSize);
      this.writeParameter(SIMULATION_PARAMETER_ROWS.localDimension, i, f.params.dimension === "3D" ? 1 : 0);
      for (let mode = 0; mode < 64; mode++) {
        const at = (i * 64 + mode) * 4;
        this.localModeData[at] = f.re[mode];
        this.localModeData[at + 1] = f.im[mode];
      }
    }
    this.localModeTexture.needsUpdate = true;
    u.uLocalResCount.value = frames.length;
    u.uLocalResOrientation.value.set(orientation.x, orientation.y, orientation.z, orientation.w);
    u.uLocalResTransport.value = transport;
    u.uLocalResDriveScale.value = driveScale;
  }
  setToroidalMorphParams(trajectory, fiberPhaseOffset, toroidalWinding, poloidalWinding, chiralCoupling, oscillationAmp, oscillationFreq, manifoldRadius) {
    const vU = this.velMaterial.uniforms;
    vU.uMorphTrajectory.value = trajectory;
    vU.uFiberPhaseOffset.value = fiberPhaseOffset;
    vU.uToroidalWinding.value = toroidalWinding;
    vU.uPoloidalWinding.value = poloidalWinding;
    vU.uChiralCoupling.value = chiralCoupling;
    vU.uOscillationAmp.value = oscillationAmp;
    vU.uOscillationFreq.value = oscillationFreq;
    vU.uManifoldRadius.value = manifoldRadius;
  }
  /** Running phases of the two conjugate morph oscillators plus the breathing oscillator (radians) */
  setMorphPhases(toroidal, poloidal, breathPhase = poloidal) {
    this.velMaterial.uniforms.uTorPhase.value = toroidal;
    this.velMaterial.uniforms.uPolPhase.value = poloidal;
    this.velMaterial.uniforms.uBreathPhase.value = breathPhase;
  }
  /**
   * Advances simulation by dt seconds
   */
  /** Native disperse command; independent of editor pointer ownership. z is the burst centre's depth. */
  setBurst(position, velocity, radius, radial, spin, z = 0) {
    this.velMaterial.uniforms.uBurstPosition.value.copy(position);
    this.velMaterial.uniforms.uBurstZ.value = z;
    this.velMaterial.uniforms.uBurstVelocity.value.copy(velocity);
    this.velMaterial.uniforms.uBurstRadius.value = radius;
    this.velMaterial.uniforms.uBurstRadial.value = radial;
    this.velMaterial.uniforms.uBurstSpin.value = spin;
  }
  /**
   * Sorted-grid neighbour search + DEM contact response.
   * cellId -> bitonic sort (schedule-driven ping-pong) -> cell ranges -> force.
   * The force pass runs in particle-index space, so no scatter-back pass is needed.
   * pairwise3D (the glyphVolume signal, same value uDepthGeometry carries) selects
   * the full-3D contact path in the force material and its consumers.
   */
  runPairwisePasses(pw, compPlane, dt, pairwise3D) {
    const side = sortSideForParticleTexSide(this.texWidth);
    if (side === null) return;
    const radius = Math.max(0.5, pw.radius ?? 2.2);
    const extent = Math.max(1, pw.extent ?? 1400);
    const grid = cellGridDims(extent, radius);
    if (!this.pairSortA || !this.pairSortB || this.pairSide !== side) {
      this.pairSortA?.dispose();
      this.pairSortB?.dispose();
      this.pairSortA = new THREE.WebGLRenderTarget(side, side, this.rtTemplate);
      this.pairSortB = new THREE.WebGLRenderTarget(side, side, this.rtTemplate);
      this.pairSide = side;
      this.pairSchedule = null;
    }
    if (!this.pairSchedule) this.pairSchedule = bitonicSchedule(side);
    if (!this.pairCellTable || this.pairCells.x !== grid.cellsX || this.pairCells.y !== grid.cellsY) {
      this.pairCellTable?.dispose();
      this.pairCellTable = new THREE.WebGLRenderTarget(grid.cellsX, grid.cellsY, this.rtTemplate);
      this.pairCells.set(grid.cellsX, grid.cellsY);
    }
    if (!this.pairForceTarget) {
      this.pairForceTarget = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, {
        ...this.rtTemplate,
        count: 2
      });
    }
    const idU = this.pairCellIdMaterial.uniforms;
    idU.uPositionTexture.value = this.currentPosTarget.texture;
    idU.uTexSize.value.set(this.texWidth, this.texHeight);
    idU.uParticleCount.value = this.particleCount;
    idU.uExtent.value = extent;
    idU.uCellSize.value = grid.cellSize;
    idU.uCells.value.set(grid.cellsX, grid.cellsY);
    idU.uCompPlane.value = compPlane;
    let sorted = this.pairSortA;
    this.quadMesh.material = this.pairCellIdMaterial;
    this.renderer.setRenderTarget(sorted);
    this.renderer.render(this.quadScene, this.quadCamera);
    const sortU = this.pairSortMaterial.uniforms;
    sortU.uSide.value = side;
    sortU.uSlots.value = side * side;
    for (const pass of this.pairSchedule) {
      sortU.uSortTexture.value = sorted.texture;
      sortU.uPartner.value = pass.partner;
      sortU.uBlock.value = pass.block;
      const other = sorted === this.pairSortA ? this.pairSortB : this.pairSortA;
      this.quadMesh.material = this.pairSortMaterial;
      this.renderer.setRenderTarget(other);
      this.renderer.render(this.quadScene, this.quadCamera);
      sorted = other;
    }
    const rangeU = this.pairRangeMaterial.uniforms;
    rangeU.uSortTexture.value = sorted.texture;
    rangeU.uSide.value = side;
    rangeU.uSlots.value = side * side;
    rangeU.uCells.value.set(grid.cellsX, grid.cellsY);
    this.quadMesh.material = this.pairRangeMaterial;
    this.renderer.setRenderTarget(this.pairCellTable);
    this.renderer.render(this.quadScene, this.quadCamera);
    const forceU = this.pairForceMaterial.uniforms;
    forceU.uPositionTexture.value = this.currentPosTarget.texture;
    forceU.uVelocityTexture.value = this.currentVelTarget.texture;
    forceU.uSortTexture.value = sorted.texture;
    forceU.uCellTable.value = this.pairCellTable.texture;
    forceU.uTexSize.value.set(this.texWidth, this.texHeight);
    forceU.uCells.value.set(grid.cellsX, grid.cellsY);
    forceU.uSide.value = side;
    forceU.uExtent.value = extent;
    forceU.uCellSize.value = grid.cellSize;
    forceU.uRadius.value = radius;
    forceU.uStiffness.value = Math.max(0, pw.stiffness ?? 1);
    forceU.uRestitution.value = Math.max(0, Math.min(1, pw.restitution ?? 0.12));
    forceU.uPairViscosity.value = Math.max(0, Math.min(1, pw.viscosity ?? 0.06));
    forceU.uCompPlane.value = compPlane;
    forceU.uPairwise3D.value = pairwise3D;
    forceU.uParticleCount.value = this.particleCount;
    forceU.uDelta.value = dt;
    this.quadMesh.material = this.pairForceMaterial;
    this.renderer.setRenderTarget(this.pairForceTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.velMaterial.uniforms.uPairwiseForceTexture.value = this.pairForceTarget.texture;
    this.velMaterial.uniforms.uPairwiseForceZTexture.value = this.pairForceTarget.textures[1];
  }
  step(dt, time, config, morphProgress, pointerPos, pointerVel, pointerZ = 0) {
    if (!(dt > 0)) return;
    this.stepCount++;
    const clampedDt = Math.min(dt, 0.033);
    const pw = config.pairwise;
    const pwEnabled = !!(pw && pw.enabled) && this.particleCount <= PAIRWISE_MAX_PARTICLES;
    if (pw && pw.enabled && this.particleCount > PAIRWISE_MAX_PARTICLES && !this.pairWarned) {
      this.pairWarned = true;
      console.warn(
        `pairwise: ${this.particleCount} particles exceed the ${PAIRWISE_MAX_PARTICLES} sort capacity; the collision system stays disabled.`
      );
    }
    const depthGeometry = config.glyphVolume?.enabled && (config.glyphVolume?.depth ?? 0) > 0 ? 1 : 0;
    if (pwEnabled) {
      this.runPairwisePasses(pw, this.velMaterial.uniforms.uCompPlane.value, clampedDt, depthGeometry);
    }
    const vUniforms = this.velMaterial.uniforms;
    vUniforms.uPairwiseEnabled.value = pwEnabled ? 1 : 0;
    vUniforms.uPairwise3D.value = depthGeometry;
    vUniforms.uPairMaxDelta.value = Math.max(1, PAIRWISE_MAX_SPEED_FRACTION * (config.fluid.maxSpeed ?? 35e3));
    vUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    vUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    vUniforms.uMorphProgress.value = morphProgress;
    vUniforms.uDelta.value = clampedDt;
    vUniforms.uTime.value = time;
    vUniforms.uCurlScale.value = config.fluid.curlScale;
    vUniforms.uCurlSpeed.value = config.fluid.curlSpeed;
    vUniforms.uTurbulence.value = config.fluid.turbulence ?? 1;
    vUniforms.uVortexStrength.value = config.fluid.vortexStrength;
    vUniforms.uDepthGeometry.value = depthGeometry;
    vUniforms.uVortex3d.value = Math.max(0, Math.min(1, config.fluid.vortex3d ?? depthGeometry));
    vUniforms.uDispersion3d.value = Math.max(0, Math.min(1, config.fluid.dispersion3d ?? depthGeometry));
    vUniforms.uViscosity.value = config.fluid.viscosity;
    vUniforms.uReturnSpeed.value = config.fluid.returnSpeed;
    vUniforms.uDispersion.value = config.fluid.dispersion ?? 0.5;
    vUniforms.uStyleMode.value = config.style === "halftone" ? 1 : 0;
    const fl = config.fluid;
    vUniforms.uSnapRigidity.value = fl.snapRigidity ?? 1;
    vUniforms.uDensityTether.value = fl.densityTether ?? 1;
    vUniforms.uCurlDepth.value = fl.curlDepth ?? 0.57;
    vUniforms.uVortexRadius.value = fl.vortexRadius ?? 450;
    vUniforms.uGravity.value.set(fl.gravityX ?? 0, fl.gravityY ?? 0, fl.gravityZ ?? 0);
    vUniforms.uQuadraticDrag.value = fl.quadraticDrag ?? 0;
    vUniforms.uThermalJitter.value = fl.thermalJitter ?? 0;
    vUniforms.uMaxSpeed.value = fl.maxSpeed ?? 35e3;
    vUniforms.uPointerFalloffPower.value = config.interaction.falloffPower ?? 2;
    const tm = config.toroidalMorph;
    if (tm && tm.enabled) {
      let trajVal = 1;
      if (tm.trajectory === "linear") trajVal = 0;
      else if (tm.trajectory === "vortexSpiral") trajVal = 2;
      else if (tm.trajectory === "quantumInterference") trajVal = 3;
      else trajVal = 1;
      vUniforms.uMorphTrajectory.value = trajVal;
      vUniforms.uFiberPhaseOffset.value = tm.fiberPhaseOffset ?? 0;
      vUniforms.uToroidalWinding.value = tm.toroidalWinding ?? 3;
      vUniforms.uPoloidalWinding.value = tm.poloidalWinding ?? 2;
      vUniforms.uChiralCoupling.value = tm.chiralCoupling ?? 0.75;
      vUniforms.uOscillationAmp.value = tm.oscillationAmplitude ?? 1.2;
      vUniforms.uOscillationFreq.value = tm.oscillationSpeed ?? 0.8;
      vUniforms.uBreathDepth.value = tm.breathDepth ?? 0.35;
      vUniforms.uManifoldRadius.value = tm.manifoldRadius ?? 180;
      vUniforms.uTorusDepthScale.value = tm.volumetricDepthScale ?? 1;
    } else {
      vUniforms.uMorphTrajectory.value = 0;
      vUniforms.uFiberPhaseOffset.value = 0;
      vUniforms.uToroidalWinding.value = 3;
      vUniforms.uPoloidalWinding.value = 2;
      vUniforms.uChiralCoupling.value = 0.75;
      vUniforms.uOscillationAmp.value = 1.2;
      vUniforms.uOscillationFreq.value = 0.8;
      vUniforms.uBreathDepth.value = 0.35;
      vUniforms.uManifoldRadius.value = 180;
      vUniforms.uTorusDepthScale.value = 1;
    }
    const rel = config.relational;
    vUniforms.uRelationalEnabled.value = rel?.enabled ? 1 : 0;
    vUniforms.uAttractorCount.value = Math.max(1, Math.min(MAX_PINS, rel?.attractorCount ?? 2));
    vUniforms.uRelationalGravity.value = rel?.attractorGravity ?? 1.5;
    vUniforms.uRelationalSpin.value = rel?.relationalSpin ?? 1.2;
    vUniforms.uChaosFactor.value = rel?.chaosFactor ?? 0;
    vUniforms.uGravitySoftening.value = rel?.gravitySoftening ?? 45;
    vUniforms.uGravityFalloff.value = rel?.gravityFalloff ?? 1.45;
    vUniforms.uSwirlRadius.value = rel?.swirlRadius ?? 500;
    const medium = config.medium;
    const mediumEnabled = !!(medium && medium.enabled);
    vUniforms.uMediumEnabled.value = mediumEnabled ? 1 : 0;
    if (mediumEnabled && medium) {
      const mediumExtent = Math.max(200, Math.min(2e4, medium.extent ?? 1400));
      const mediumRes = Math.max(16, Math.min(1024, Math.round(medium.gridRes ?? 192)));
      const threeD = medium.dimension === "3D";
      const mediumN = threeD ? mediumVolumeSideFor(mediumRes) : mediumRes;
      const solverSide = threeD ? mediumN * mediumN : mediumRes;
      this.ensureMediumTargets(solverSide, threeD);
      const compPlane = vUniforms.uCompPlane.value;
      vUniforms.uMediumPressureGain.value = Math.max(0, medium.pressure ?? 4);
      vUniforms.uMediumCoupling.value = Math.max(0, medium.coupling ?? 0.8);
      vUniforms.uMediumMin.value.set(-mediumExtent, -mediumExtent);
      vUniforms.uMediumMax.value.set(mediumExtent, mediumExtent);
      vUniforms.uMediumTexel.value.set(1 / solverSide, 1 / solverSide);
      vUniforms.uMediumGridRes.value = mediumRes;
      vUniforms.uMedium3D.value = threeD ? 1 : 0;
      vUniforms.uMediumN.value = mediumN;
      vUniforms.uMediumTexSide.value = solverSide;
      vUniforms.uMediumPlane.value = medium.plane === "world3d" ? 1 : compPlane;
      vUniforms.uMediumVelTexture.value = this.mediumVelRead.texture;
      vUniforms.uMediumPressureTexture.value = this.mediumPressureRead.texture;
    }
    const collision = config.collision;
    const collisionEnabled = !!(collision && collision.enabled);
    vUniforms.uCollisionEnabled.value = collisionEnabled ? 1 : 0;
    this.posMaterial.uniforms.uCollisionEnabled.value = collisionEnabled ? 1 : 0;
    if (collisionEnabled && collision) {
      const modeVal2 = collision.mode === "vessel" ? 1 : 0;
      const integrity = Math.max(0, collision.integrity ?? 0.5);
      vUniforms.uCollisionMode.value = modeVal2;
      vUniforms.uCollisionRestitution.value = Math.max(0, Math.min(1, collision.restitution ?? 0.35));
      vUniforms.uCollisionFriction.value = Math.max(0, Math.min(1, collision.friction ?? 0.1));
      vUniforms.uCollisionBand.value = Math.max(1, collision.band ?? 40);
      vUniforms.uCollisionStrength.value = Math.max(0, collision.strength ?? 4);
      vUniforms.uCollisionIntegrity.value = integrity;
      this.posMaterial.uniforms.uCollisionMode.value = modeVal2;
      this.posMaterial.uniforms.uCollisionIntegrity.value = integrity;
    }
    vUniforms.uPointerPos.value.copy(pointerPos);
    vUniforms.uPointerZ.value = pointerZ;
    vUniforms.uPointerVelocity.value.copy(pointerVel).multiplyScalar(config.interaction.velocityInfluence ?? 1);
    vUniforms.uPointerRadius.value = config.interaction.radius;
    vUniforms.uPointerStrength.value = config.interaction.strength;
    let modeVal = 0;
    if (config.interaction.mode === "attract") modeVal = 1;
    else if (config.interaction.mode === "vortex") modeVal = 2;
    vUniforms.uInteractionMode.value = modeVal;
    this.quadMesh.material = this.velMaterial;
    this.renderer.setRenderTarget(this.nextVelTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    const tempVel = this.currentVelTarget;
    this.currentVelTarget = this.nextVelTarget;
    this.nextVelTarget = tempVel;
    const pUniforms = this.posMaterial.uniforms;
    pUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    pUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    pUniforms.uPairwiseEnabled.value = pwEnabled ? 1 : 0;
    pUniforms.uPairwise3D.value = depthGeometry;
    pUniforms.uPairwiseCorrectionTexture.value = pwEnabled && this.pairForceTarget ? this.pairForceTarget.texture : this.pairForceFallback;
    pUniforms.uPairwiseCorrectionZTexture.value = pwEnabled && this.pairForceTarget ? this.pairForceTarget.textures[1] : this.pairForceFallback;
    pUniforms.uDelta.value = clampedDt;
    pUniforms.uMorphTrajectory.value = tm && tm.enabled !== false && tm.trajectory !== "linear" ? 1 : 0;
    pUniforms.uZDepthRetention.value = tm?.enabled ? 1 : 0;
    pUniforms.uZConfinement.value = config.fluid.zConfinement ?? 1;
    pUniforms.uDepthGeometry.value = depthGeometry;
    pUniforms.uTargetATexture.value = vUniforms.uTargetATexture.value;
    pUniforms.uTargetBTexture.value = vUniforms.uTargetBTexture.value;
    this.quadMesh.material = this.posMaterial;
    this.renderer.setRenderTarget(this.nextPosTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    const tempPos = this.currentPosTarget;
    this.currentPosTarget = this.nextPosTarget;
    this.nextPosTarget = tempPos;
    if (mediumEnabled && medium) this.stepMedium(clampedDt, medium);
    this.renderer.setRenderTarget(null);
  }
  // ------------------------------------------------------------------ shared medium
  /** Allocate (or reallocate when the side or the dimension changes) the medium solver targets. */
  ensureMediumTargets(side, threeD) {
    if (this.mediumRes === side && this.medium3D === threeD && this.mediumVel0) return;
    this.disposeMediumTargets();
    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;
    const filter = isWebGL2 && this.renderer.extensions.has("OES_texture_float_linear") ? THREE.LinearFilter : THREE.NearestFilter;
    const options = {
      type: floatType,
      format: THREE.RGBAFormat,
      minFilter: filter,
      magFilter: filter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    };
    this.mediumVel0 = new THREE.WebGLRenderTarget(side, side, options);
    this.mediumVel1 = new THREE.WebGLRenderTarget(side, side, options);
    this.mediumDivergenceTarget = new THREE.WebGLRenderTarget(side, side, options);
    this.mediumPressure0 = new THREE.WebGLRenderTarget(side, side, options);
    this.mediumPressure1 = new THREE.WebGLRenderTarget(side, side, options);
    this.mediumVelRead = this.mediumVel0;
    this.mediumVelWrite = this.mediumVel1;
    this.mediumPressureRead = this.mediumPressure0;
    this.mediumPressureWrite = this.mediumPressure1;
    this.mediumRes = side;
    this.medium3D = threeD;
    const texel = new THREE.Vector2(1 / side, 1 / side);
    this.mediumAdvectMaterial.uniforms.uTexel.value.copy(texel);
    this.mediumDivergenceMaterial.uniforms.uTexel.value.copy(texel);
    this.mediumPressureMaterial.uniforms.uTexel.value.copy(texel);
    this.mediumGradientMaterial.uniforms.uTexel.value.copy(texel);
  }
  swapMediumVel() {
    const t = this.mediumVelRead;
    this.mediumVelRead = this.mediumVelWrite;
    this.mediumVelWrite = t;
  }
  swapMediumPressure() {
    const t = this.mediumPressureRead;
    this.mediumPressureRead = this.mediumPressureWrite;
    this.mediumPressureWrite = t;
  }
  /** One medium frame: momentum injection, advection + dissipation, pressure projection. */
  stepMedium(dt, medium) {
    if (!this.mediumVelRead || !this.mediumVelWrite || !this.mediumDivergenceTarget || !this.mediumPressureRead || !this.mediumPressureWrite) return;
    const vUniforms = this.velMaterial.uniforms;
    const threeD = vUniforms.uMedium3D.value;
    const volumeN = vUniforms.uMediumN.value;
    const solverSide = vUniforms.uMediumTexSide.value;
    const setVolume = (m) => {
      m.uniforms.uMedium3D.value = threeD;
      m.uniforms.uMediumN.value = volumeN;
      m.uniforms.uMediumTexSide.value = solverSide;
    };
    const sU = this.mediumSplatMaterial.uniforms;
    sU.uPositionTexture.value = this.currentPosTarget.texture;
    sU.uVelocityTexture.value = this.currentVelTarget.texture;
    sU.uMediumPlane.value = vUniforms.uMediumPlane.value;
    sU.uMediumMin.value.copy(vUniforms.uMediumMin.value);
    sU.uMediumMax.value.copy(vUniforms.uMediumMax.value);
    sU.uSplatGain.value = Math.max(0, medium.splatGain ?? 1);
    sU.uMedium3D.value = threeD;
    sU.uMediumN.value = volumeN;
    const prevAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    const sliceOffsets = threeD > 0.5 ? [-1, 0, 1] : [0];
    for (const sliceOffset of sliceOffsets) {
      sU.uSliceOffset.value = sliceOffset;
      this.renderer.setRenderTarget(this.mediumVelRead);
      this.renderer.render(this.splatScene, this.quadCamera);
    }
    this.renderer.autoClear = prevAutoClear;
    const aU = this.mediumAdvectMaterial.uniforms;
    aU.uMediumVelocity.value = this.mediumVelRead.texture;
    aU.uDelta.value = dt;
    aU.uDissipation.value = Math.pow(Math.max(0, Math.min(1.05, medium.persistence ?? 0.97)), dt * 60);
    aU.uMediumExtent.value = vUniforms.uMediumMax.value.x - vUniforms.uMediumMin.value.x || 1;
    setVolume(this.mediumAdvectMaterial);
    this.quadMesh.material = this.mediumAdvectMaterial;
    this.renderer.setRenderTarget(this.mediumVelWrite);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.swapMediumVel();
    this.mediumDivergenceMaterial.uniforms.uMediumVelocity.value = this.mediumVelRead.texture;
    setVolume(this.mediumDivergenceMaterial);
    this.quadMesh.material = this.mediumDivergenceMaterial;
    this.renderer.setRenderTarget(this.mediumDivergenceTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    const iterations = Math.max(1, Math.min(12, Math.round(medium.iterations ?? 4)));
    this.mediumPressureMaterial.uniforms.uDivergence.value = this.mediumDivergenceTarget.texture;
    setVolume(this.mediumPressureMaterial);
    for (let i = 0; i < iterations; i++) {
      this.mediumPressureMaterial.uniforms.uPressure.value = this.mediumPressureRead.texture;
      this.quadMesh.material = this.mediumPressureMaterial;
      this.renderer.setRenderTarget(this.mediumPressureWrite);
      this.renderer.render(this.quadScene, this.quadCamera);
      this.swapMediumPressure();
    }
    this.mediumGradientMaterial.uniforms.uMediumVelocity.value = this.mediumVelRead.texture;
    this.mediumGradientMaterial.uniforms.uPressure.value = this.mediumPressureRead.texture;
    setVolume(this.mediumGradientMaterial);
    this.quadMesh.material = this.mediumGradientMaterial;
    this.renderer.setRenderTarget(this.mediumVelWrite);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.swapMediumVel();
  }
  disposeMediumTargets() {
    this.mediumVel0?.dispose();
    this.mediumVel1?.dispose();
    this.mediumDivergenceTarget?.dispose();
    this.mediumPressure0?.dispose();
    this.mediumPressure1?.dispose();
    this.mediumVel0 = this.mediumVel1 = this.mediumDivergenceTarget = null;
    this.mediumPressure0 = this.mediumPressure1 = null;
    this.mediumVelRead = this.mediumVelWrite = null;
    this.mediumPressureRead = this.mediumPressureWrite = null;
    this.mediumRes = 0;
  }
  destroy() {
    this.localModeTexture.dispose();
    this.parameterTexture.dispose();
    this.posTarget0.dispose();
    this.posTarget1.dispose();
    this.velTarget0.dispose();
    this.velTarget1.dispose();
    this.posMaterial.dispose();
    this.velMaterial.dispose();
    this.disposeMediumTargets();
    this.mediumSplatMaterial.dispose();
    this.mediumAdvectMaterial.dispose();
    this.mediumDivergenceMaterial.dispose();
    this.mediumPressureMaterial.dispose();
    this.mediumGradientMaterial.dispose();
    this.splatPoints.geometry.dispose();
    this.pairSortA?.dispose();
    this.pairSortB?.dispose();
    this.pairCellTable?.dispose();
    this.pairForceTarget?.dispose();
    this.pairForceFallback.dispose();
    this.pairCellIdMaterial.dispose();
    this.pairSortMaterial.dispose();
    this.pairRangeMaterial.dispose();
    this.pairForceMaterial.dispose();
  }
}
export {
  GPGPUSimulator
};
