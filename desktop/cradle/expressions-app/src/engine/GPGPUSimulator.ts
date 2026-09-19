/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PointCloudConfig, MediumConfig } from './types';
import type { ForceEmitterState } from './forceRuntime';
import {
  simulationVertexShader,
  positionSimulationShader,
  velocitySimulationShader,
} from './shaders/simulationShaders';
import {
  mediumSplatVertexShader,
  mediumSplatFragmentShader,
  mediumAdvectShader,
  mediumDivergenceShader,
  mediumPressureShader,
  mediumGradientSubtractShader,
  MEDIUM_PRESSURE_DECAY,
} from './shaders/mediumShaders';
import { mediumVolumeSideFor } from './mediumGrid';
import {
  pairwiseCellIdShader,
  pairwiseForceShader,
  pairwiseRangeShader,
  pairwiseSortShader,
} from './shaders/pairwiseShaders';
import {
  bitonicSchedule,
  cellGridDims,
  PAIRWISE_MAX_PARTICLES,
  PAIRWISE_MAX_SPEED_FRACTION,
  PairwiseSortPass,
  sortSideForParticleTexSide,
} from './pairwiseSchedule';

export class GPGPUSimulator {
  private renderer: THREE.WebGLRenderer;
  public texWidth: number;
  public texHeight: number;
  public particleCount: number;
  public seedGeneration = 0;
  public stepCount = 0;

  // Ping-pong render targets
  private posTarget0: THREE.WebGLRenderTarget;
  private posTarget1: THREE.WebGLRenderTarget;
  private velTarget0: THREE.WebGLRenderTarget;
  private velTarget1: THREE.WebGLRenderTarget;

  public currentPosTarget: THREE.WebGLRenderTarget;
  public nextPosTarget: THREE.WebGLRenderTarget;
  public currentVelTarget: THREE.WebGLRenderTarget;
  public nextVelTarget: THREE.WebGLRenderTarget;

  // Shared medium (Eulerian grid): ping-pong velocity + divergence + ping-pong pressure.
  // Allocated lazily at the configured grid resolution; in 3D mode the side is
  // N² (an N×N×N voxel volume tiled into the texture, see mediumGrid.ts).
  private mediumRes = 0;
  private medium3D = false;
  private mediumVel0: THREE.WebGLRenderTarget | null = null;
  private mediumVel1: THREE.WebGLRenderTarget | null = null;
  private mediumDivergenceTarget: THREE.WebGLRenderTarget | null = null;
  private mediumPressure0: THREE.WebGLRenderTarget | null = null;
  private mediumPressure1: THREE.WebGLRenderTarget | null = null;
  public mediumVelRead: THREE.WebGLRenderTarget | null = null;
  private mediumVelWrite: THREE.WebGLRenderTarget | null = null;
  private mediumPressureRead: THREE.WebGLRenderTarget | null = null;
  private mediumPressureWrite: THREE.WebGLRenderTarget | null = null;
  private mediumSplatMaterial: THREE.ShaderMaterial;
  private mediumAdvectMaterial: THREE.ShaderMaterial;
  private mediumDivergenceMaterial: THREE.ShaderMaterial;
  private mediumPressureMaterial: THREE.ShaderMaterial;
  private mediumGradientMaterial: THREE.ShaderMaterial;
  private splatScene: THREE.Scene;
  private splatPoints: THREE.Points;

  // Quad setup for GPGPU render pass
  private quadScene: THREE.Scene;
  private quadCamera: THREE.Camera;
  private quadMesh: THREE.Mesh;

  // Simulation shader materials
  private posMaterial: THREE.ShaderMaterial;
  private velMaterial: THREE.ShaderMaterial;

  // Sorted-grid pairwise collision passes (allocated lazily; zero draw calls while disabled)
  private pairCellIdMaterial: THREE.ShaderMaterial;
  private pairSortMaterial: THREE.ShaderMaterial;
  private pairRangeMaterial: THREE.ShaderMaterial;
  private pairForceMaterial: THREE.ShaderMaterial;
  private pairSortA: THREE.WebGLRenderTarget | null = null;
  private pairSortB: THREE.WebGLRenderTarget | null = null;
  private pairCellTable: THREE.WebGLRenderTarget | null = null;
  private pairForceTarget: THREE.WebGLRenderTarget | null = null;
  private pairForceFallback: THREE.DataTexture;
  private pairSchedule: PairwiseSortPass[] | null = null;
  private pairSide = 0;
  private pairCells = new THREE.Vector2(0, 0);
  private pairWarned = false;
  private rtTemplate: THREE.RenderTargetOptions;

  constructor(renderer: THREE.WebGLRenderer, particleCount: number = 200000) {
    this.renderer = renderer;

    // Smallest square simulation texture that holds the requested count; the requested
    // count itself is honoured exactly (unused texels are never drawn).
    const requested = Math.max(64, Math.min(4_000_000, Math.floor(particleCount)));
    const texSide = Math.max(8, Math.ceil(Math.sqrt(requested)));

    this.texWidth = texSide;
    this.texHeight = texSide;
    this.particleCount = requested;

    // Determine supported float type
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

    const rtOptions: THREE.RenderTargetOptions = {
      type: floatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false,
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

    // Quad setup
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);

    // Position simulation material
    this.posMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: positionSimulationShader,
      uniforms: {
        uPositionTexture: { value: null },
        uVelocityTexture: { value: null },
        uDelta: { value: 0.016 },
        uCompPlane: { value: 0.0 },
        uMorphTrajectory: { value: 0.0 },
        uZDepthRetention: { value: 0.0 },
        uZConfinement: { value: 1.0 },
        // True-3D letterform bodies: keeps the baked depth axis from being damped away.
        uDepthGeometry: { value: 0.0 },
        // Glyph SDF colliders (hard projection out of obstacle interiors)
        uCollisionEnabled: { value: 0.0 },
        uCollisionMode: { value: 0.0 },
        uCollisionIntegrity: { value: 0.5 },
        uSdfAtlas: { value: null },
        uCollisionTile: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0.5, 0)) },
        uTargetATexture: { value: null },
        uTargetBTexture: { value: null },
        uPairwiseEnabled: { value: 0.0 },
        // 1 = volumetric bodies: pairwise contacts also correct the depth axis.
        uPairwise3D: { value: 0.0 },
        uPairwiseCorrectionTexture: { value: null },
        uPairwiseCorrectionZTexture: { value: null },
        uEntityCount: { value: 0 },
        uEntityBounds: { value: new Float32Array(10) },
        uEntityCenter: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 200)) },
        uEntityMorph: { value: new Float32Array(10) },
        // Depth scale of each partition: the slab axis conversion for the
        // extruded-body boundary test.
        uEntityDepthScale: { value: new Float32Array(10).fill(1) },
        uEntityTransform: { value: Array.from({ length: 10 }, () => new THREE.Vector3(1, 1, 0)) },
        uTexSize: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });

    // Velocity simulation material
    this.velMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: velocitySimulationShader,
      uniforms: {
        uPositionTexture: { value: null },
        uVelocityTexture: { value: null },
        uTargetATexture: { value: null },
        uTargetBTexture: { value: null },
        uTargetNoise: { value: null },
        uMorphProgress: { value: 0.0 },
        uDelta: { value: 0.016 },
        uTime: { value: 0.0 },

        // Fluid forces
        uCurlScale: { value: 1.0 },
        uCurlSpeed: { value: 0.8 },
        uTurbulence: { value: 1.0 },
        uVortexStrength: { value: 1.2 },
        uDepthGeometry: { value: 0.0 },
        uVortex3d: { value: 0.0 },
        uDispersion3d: { value: 0.0 },
        uVortexCenter: { value: new THREE.Vector2(0, 0) },
        uViscosity: { value: 0.94 },
        uReturnSpeed: { value: 1.0 },
        uDispersion: { value: 0.5 },
        uStyleMode: { value: 0.0 },

        // Extended physics
        uSnapRigidity: { value: 1.0 },
        uDensityTether: { value: 1.0 },
        uCurlDepth: { value: 0.57 },
        uVortexRadius: { value: 450.0 },
        uGravity: { value: new THREE.Vector3(0, 0, 0) },
        uQuadraticDrag: { value: 0.0 },
        uThermalJitter: { value: 0.0 },
        uMaxSpeed: { value: 35000.0 },
        uGravitySoftening: { value: 45.0 },
        uGravityFalloff: { value: 1.45 },
        uSwirlRadius: { value: 500.0 },
        uPointerFalloffPower: { value: 2.0 },
        uTorPhase: { value: 0.0 },
        uPolPhase: { value: 0.0 },

        // Free Relational System
        uRelationalEnabled: { value: 0.0 },
        uAttractorCount: { value: 2 },
        uAttractors: {
          value: [
            new THREE.Vector4(-150, 0, 0, 1.0),
            new THREE.Vector4(150, 0, 0, 1.0),
            new THREE.Vector4(0, 150, 0, 1.0),
            new THREE.Vector4(0, -150, 0, 1.0),
            new THREE.Vector4(100, 100, 0, 1.0),
            new THREE.Vector4(-100, -100, 0, 1.0),
            new THREE.Vector4(0, 250, 0, 1.0),
            new THREE.Vector4(0, -250, 0, 1.0),
            new THREE.Vector4(200, 0, 0, 1.0),
            new THREE.Vector4(-200, 0, 0, 1.0),
          ],
        },
        uAttractorSpin: { value: [1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0] },
        uRelationalGravity: { value: 1.5 },
        uRelationalSpin: { value: 1.2 },
        uChaosFactor: { value: 0.0 },

        // Entities (first-class centres of formation)
        uEntityCount: { value: 0 },
        uEntityBounds: { value: new Float32Array(10) },
        uEntityCenter: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 200)) },
        uEntityMorph: { value: new Float32Array(10) },
        uEntityDepthScale: {value: new Float32Array(10).fill(1)},
        uEntityNormalized: {value: new Float32Array(10)},
        uEntityTransform: { value: Array.from({length:10},()=>new THREE.Vector3(1,1,0)) },
        uTexSize: { value: new THREE.Vector2(1, 1) },
        uForceEmitterCount: { value: 0 },
        uForceEmitterCenter: { value: Array.from({ length: 18 }, () => new THREE.Vector4(-99999, -99999, 0, 1)) },
        uForceEmitterParams: { value: Array.from({ length: 18 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uCompPlane: { value: 0.0 },
        uResDominance: { value: 1.0 },

        // Continuous modal cymatic resonator (live per-mode complex envelopes)
        uResEnabled: { value: 0.0 },
        uResModeCount: { value: 0 },
        uResRe: { value: new Float32Array(64) },
        uResIm: { value: new Float32Array(64) },
        uResPlateSize: { value: 700.0 },
        uResTransport: { value: 1.0 },
        uResAgitation: { value: 0.3 },
        uResBoundary: { value: 6.0 },
        uResPlane: { value: 0.0 },
        uResDriveScale: { value: 1.0 },
        uRes3D: { value: 0.0 },

        // Sorted-grid pairwise collisions (bound to a 1x1 zero texture while disabled)
        uPairwiseForceTexture: { value: null },
        uPairwiseForceZTexture: { value: null }, // 3D path: depth-axis dv (force pass draw buffer 1)
        uPairwiseEnabled: { value: 0.0 },
        uPairwise3D: { value: 0.0 },
        uPairMaxDelta: { value: 5000.0 },

        // Dual-Phase Toroidal/Poloidal Morph & Inverse Hopf Fibration System
        uMorphTrajectory: { value: 1.0 },
        uFiberPhaseOffset: { value: 0.0 },
        uToroidalWinding: { value: 3.0 },
        uPoloidalWinding: { value: 2.0 },
        uChiralCoupling: { value: 0.75 },
        uOscillationAmp: { value: 1.2 },
        uOscillationFreq: { value: 0.8 },
        uBreathPhase: { value: 0.0 },
        uBreathDepth: { value: 0.35 },
        uManifoldRadius: { value: 180.0 },
        uTorusDepthScale: { value: 1.0 },

        // Pointer
        uPointerPos: { value: new THREE.Vector2(-99999, -99999) },
        uBurstPosition: {value: new THREE.Vector2()},
        uBurstZ: { value: 0.0 },
        uBurstVelocity: {value: new THREE.Vector2()},
        uBurstRadius: { value: 150.0 },
        uBurstRadial: { value: 0.0 },
        uBurstSpin: { value: 0.0 },
        uPointerVelocity: { value: new THREE.Vector2(0, 0) },
        uPointerZ: { value: 0 },
        uPointerRadius: { value: 150.0 },
        uPointerStrength: { value: 1.0 },
        uInteractionMode: { value: 0.0 },

        // Shared Eulerian medium (all terms multiply the enabled guard)
        uMediumEnabled: { value: 0.0 },
        uMediumVelTexture: { value: null },
        uMediumPressureTexture: { value: null },
        uMediumMin: { value: new THREE.Vector2(-1400, -1400) },
        uMediumMax: { value: new THREE.Vector2(1400, 1400) },
        uMediumTexel: { value: new THREE.Vector2(1 / 192, 1 / 192) },
        uMediumGridRes: { value: 192.0 },
        uMediumPlane: { value: 0.0 },
        uMediumPressureGain: { value: 4.0 },
        uMediumCoupling: { value: 0.8 },
        // 3D medium: voxel volume tiled into an N²×N² texture (see mediumGrid.ts)
        uMedium3D: { value: 0.0 },
        uMediumN: { value: 32.0 },
        uMediumTexSide: { value: 1024.0 },

        // Glyph SDF colliders (all terms multiply the enabled guard)
        uCollisionEnabled: { value: 0.0 },
        uCollisionMode: { value: 0.0 },
        uCollisionRestitution: { value: 0.35 },
        uCollisionFriction: { value: 0.1 },
        uCollisionBand: { value: 40.0 },
        uCollisionStrength: { value: 4.0 },
        uCollisionIntegrity: { value: 0.5 },
        uSdfAtlas: { value: null },
        uCollisionTile: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0.5, 0)) },

      },
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(quadGeom, this.posMaterial);
    this.quadScene.add(this.quadMesh);

    // Medium splat pass: one 1px point per particle, additive into the velocity grid.
    this.splatScene = new THREE.Scene();
    {
      const splatUv = new Float32Array(this.particleCount * 2);
      for (let i = 0; i < this.particleCount; i++) {
        splatUv[i * 2 + 0] = ((i % this.texWidth) + 0.5) / this.texWidth;
        splatUv[i * 2 + 1] = (Math.floor(i / this.texWidth) + 0.5) / this.texHeight;
      }
      const splatGeom = new THREE.BufferGeometry();
      splatGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.particleCount * 3), 3));
      splatGeom.setAttribute('aParticleUv', new THREE.BufferAttribute(splatUv, 2));
      this.mediumSplatMaterial = new THREE.ShaderMaterial({
        vertexShader: mediumSplatVertexShader,
        fragmentShader: mediumSplatFragmentShader,
        uniforms: {
          uPositionTexture: { value: null },
          uVelocityTexture: { value: null },
          uMediumMin: { value: new THREE.Vector2(-1400, -1400) },
          uMediumMax: { value: new THREE.Vector2(1400, 1400) },
          uMediumPlane: { value: 0.0 },
          uSplatGain: { value: 1.0 },
          // 3D medium: this draw writes the slice at round(fvz) + uSliceOffset
          uMedium3D: { value: 0.0 },
          uMediumN: { value: 32.0 },
          uSliceOffset: { value: 0.0 },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      this.splatPoints = new THREE.Points(splatGeom, this.mediumSplatMaterial);
      this.splatPoints.frustumCulled = false;
      this.splatScene.add(this.splatPoints);
    }

    // Solver quad materials (created eagerly; no GPU work until a pass renders).
    const unitTexel = () => new THREE.Vector2(1 / 192, 1 / 192);
    this.mediumAdvectMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumAdvectShader,
      uniforms: {
        uMediumVelocity: { value: null },
        uDelta: { value: 0.016 },
        uDissipation: { value: 0.97 },
        uMediumExtent: { value: 2800.0 },
        uTexel: { value: unitTexel() },
        uMedium3D: { value: 0.0 },
        uMediumN: { value: 32.0 },
        uMediumTexSide: { value: 1024.0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mediumDivergenceMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumDivergenceShader,
      uniforms: { uMediumVelocity: { value: null }, uTexel: { value: unitTexel() }, uMedium3D: { value: 0.0 }, uMediumN: { value: 32.0 }, uMediumTexSide: { value: 1024.0 } },
      depthTest: false,
      depthWrite: false,
    });
    this.mediumPressureMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumPressureShader,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexel: { value: unitTexel() },
        uPressureDecay: { value: MEDIUM_PRESSURE_DECAY },
        uMedium3D: { value: 0.0 },
        uMediumN: { value: 32.0 },
        uMediumTexSide: { value: 1024.0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mediumGradientMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: mediumGradientSubtractShader,
      uniforms: {
        uPressure: { value: null },
        uMediumVelocity: { value: null },
        uTexel: { value: unitTexel() },
        uMedium3D: { value: 0.0 },
        uMediumN: { value: 32.0 },
        uMediumTexSide: { value: 1024.0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    // Pairwise materials share the quad; targets are created on first enabled frame.
    const pwUniforms = () => ({
      uPositionTexture: { value: null },
      uVelocityTexture: { value: null },
      uSortTexture: { value: null },
      uCellTable: { value: null },
      uTexSize: { value: new THREE.Vector2(this.texWidth, this.texHeight) },
      uCells: { value: new THREE.Vector2(1, 1) },
      uSide: { value: 1.0 },
      uSlots: { value: 1.0 },
      uParticleCount: { value: this.particleCount },
      uExtent: { value: 1400.0 },
      uCellSize: { value: 2.2 },
      uRadius: { value: 2.2 },
      uStiffness: { value: 1.0 },
      uRestitution: { value: 0.12 },
      uPairViscosity: { value: 0.06 },
      uCompPlane: { value: 0.0 },
      uPairwise3D: { value: 0.0 },
      uDelta: { value: 0.016 },
      uPartner: { value: 1.0 },
      uBlock: { value: 2.0 },
    });
    this.pairCellIdMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseCellIdShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false,
    });
    this.pairSortMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseSortShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false,
    });
    this.pairRangeMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseRangeShader,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false,
    });
    // The force material is the one GLSL3 material in the chain: MRT needs
    // explicit layout(location) fragment outputs. three's GLSL3 prefix still
    // defines texture2D/varying, so the shared vertex shader and the shader
    // source style stay identical to the other passes.
    this.pairForceMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: pairwiseForceShader,
      glslVersion: THREE.GLSL3,
      uniforms: pwUniforms(),
      depthTest: false,
      depthWrite: false,
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
  public seedInitialState(initialData: Float32Array) {
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

    // Render initial data into both position targets
    const passMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D uInitTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(uInitTexture, vUv);
        }
      `,
      uniforms: { uInitTexture: { value: initTex } },
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh.material = passMaterial;
    this.renderer.setRenderTarget(this.posTarget0);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.renderer.setRenderTarget(this.posTarget1);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Clear velocities to 0
    const zeroVelMaterial = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: /* glsl */ `
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
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
  public setTargetTextures(texA: THREE.DataTexture, texB: THREE.DataTexture, vortexCenter: THREE.Vector2, noise?: THREE.DataTexture) {
    this.velMaterial.uniforms.uTargetNoise.value = noise ?? null;
    this.velMaterial.uniforms.uTargetATexture.value = texA;
    this.velMaterial.uniforms.uTargetBTexture.value = texB;
    this.velMaterial.uniforms.uVortexCenter.value.copy(vortexCenter);
  }

  /**
   * Updates dynamic attractor positions and polarities for relational orbital dynamics
   */
  public setAttractors(attractors: THREE.Vector4[], spins: number[]) {
    const attrUniform = this.velMaterial.uniforms.uAttractors.value as THREE.Vector4[];
    for (let i = 0; i < Math.min(attractors.length, attrUniform.length); i++) {
      attrUniform[i].copy(attractors[i]);
    }
    const spinUniform = this.velMaterial.uniforms.uAttractorSpin.value as number[];
    for (let i = 0; i < Math.min(spins.length, spinUniform.length); i++) {
      spinUniform[i] = spins[i];
    }
  }

  /** Push formation partition geometry/state; physical forces use the separate emitter table. */
  public setEntityState(u: {
    count: number;
    bounds: Float32Array;
    centers: THREE.Vector4[];
    morph: Float32Array;
    transforms: THREE.Vector3[];
    depthScales?: Float32Array;
    normalized?: Float32Array;
  }) {
    const vU = this.velMaterial.uniforms;
    vU.uEntityCount.value = Math.min(10, u.count);
    (vU.uEntityBounds.value as Float32Array).set(u.bounds.subarray(0, 10));
    (vU.uEntityMorph.value as Float32Array).set(u.morph.subarray(0, 10));
    (vU.uEntityDepthScale.value as Float32Array).set(u.depthScales ?? new Float32Array(10).fill(1));
    (vU.uEntityNormalized.value as Float32Array).set(u.normalized ?? new Float32Array(10));
    const cU = vU.uEntityCenter.value as THREE.Vector4[];
    for (let i = 0; i < 10; i++) {
      cU[i].copy(u.centers[i]);
      vU.uEntityTransform.value[i].copy(u.transforms[i]);
    }
    (vU.uTexSize.value as THREE.Vector2).set(this.texWidth, this.texHeight);
    // The position pass resolves partitions for the SDF hard projection (no depth/normalization need).
    const pU = this.posMaterial.uniforms;
    pU.uEntityCount.value = vU.uEntityCount.value;
    (pU.uEntityBounds.value as Float32Array).set(u.bounds.subarray(0, 10));
    (pU.uEntityMorph.value as Float32Array).set(u.morph.subarray(0, 10));
    (pU.uEntityDepthScale.value as Float32Array).set(u.depthScales ?? new Float32Array(10).fill(1));
    const pC = pU.uEntityCenter.value as THREE.Vector4[];
    for (let i = 0; i < 10; i++) {
      pC[i].copy(u.centers[i]);
      pU.uEntityTransform.value[i].copy(u.transforms[i]);
    }
    (pU.uTexSize.value as THREE.Vector2).set(this.texWidth, this.texHeight);
  }

  /**
   * Upload the glyph SDF atlas (one texture per bake cycle) plus per-partition
   * tile rects (uv origin x/y, tile width u, enabled). Scalar collision physics
   * are config-driven in step().
   */
  public setCollisionState(tiles: Float32Array, texture: THREE.Texture | null) {
    const vU = this.velMaterial.uniforms;
    const pU = this.posMaterial.uniforms;
    const vTiles = vU.uCollisionTile.value as THREE.Vector4[];
    const pTiles = pU.uCollisionTile.value as THREE.Vector4[];
    for (let i = 0; i < 10; i++) {
      vTiles[i].fromArray(tiles, i * 4);
      pTiles[i].copy(vTiles[i]);
    }
    vU.uSdfAtlas.value = texture;
    pU.uSdfAtlas.value = texture;
  }

  public setForceEmitters(emitters: readonly ForceEmitterState[]) {
    const u=this.velMaterial.uniforms;
    const centers=u.uForceEmitterCenter.value as THREE.Vector4[];
    const params=u.uForceEmitterParams.value as THREE.Vector4[];
    const count=Math.min(18,emitters.length);u.uForceEmitterCount.value=count;
    for(let i=0;i<18;i++){const e=emitters[i];if(!e||!e.enabled){centers[i].set(-99999,-99999,0,1);params[i].set(0,0,0,0);continue;}
      centers[i].set(e.position.x,e.position.y,e.position.z,Math.max(5,e.radius));
      const mode=e.law==='vortex'?3:e.polarity==='repel'?2:1;params[i].set(e.strength,mode,e.spin,e.metric==='world3d'?1:0);
    }
  }

  public setCompositionPlane(plane: 'vertical' | 'horizontal') {
    const v = plane === 'horizontal' ? 1.0 : 0.0;
    this.velMaterial.uniforms.uCompPlane.value = v;
    this.posMaterial.uniforms.uCompPlane.value = v;
    // resonator plate follows the composition plane (0 = horizontal XZ, 1 = vertical XY in its own convention)
    this.velMaterial.uniforms.uResPlane.value = v > 0.5 ? 0.0 : 1.0;
  }

  public setResonatorDominance(d: number) {
    this.velMaterial.uniforms.uResDominance.value = Math.max(0, Math.min(1, d));
  }

  /** Push the live modal envelopes + coupling parameters of the cymatic resonator.
   *  `threeD` switches the shader into the volumetric standing-wave mode whose slot
   *  layout is i = ((m-1)*4 + (n-1))*4 + (p-1); false keeps the legacy 2D plate. */
  public setResonatorState(
    enabled: boolean,
    modeCount: number,
    re: Float32Array,
    im: Float32Array,
    plateSize: number,
    transport: number,
    agitation: number,
    boundary: number,
    plane: number,
    driveScale: number,
    threeD: boolean = false
  ) {
    const vU = this.velMaterial.uniforms;
    vU.uResEnabled.value = enabled ? 1.0 : 0.0;
    vU.uResModeCount.value = Math.max(0, Math.min(64, Math.round(modeCount)));
    (vU.uResRe.value as Float32Array).set(re.subarray(0, 64));
    (vU.uResIm.value as Float32Array).set(im.subarray(0, 64));
    vU.uResPlateSize.value = plateSize;
    vU.uResTransport.value = transport;
    vU.uResAgitation.value = agitation;
    vU.uResBoundary.value = boundary;
    vU.uResPlane.value = plane;
    vU.uResDriveScale.value = driveScale;
    vU.uRes3D.value = threeD ? 1.0 : 0.0;
  }

  public setToroidalMorphParams(
    trajectory: number,
    fiberPhaseOffset: number,
    toroidalWinding: number,
    poloidalWinding: number,
    chiralCoupling: number,
    oscillationAmp: number,
    oscillationFreq: number,
    manifoldRadius: number
  ) {
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
  public setMorphPhases(toroidal: number, poloidal: number, breathPhase: number = poloidal) {
    this.velMaterial.uniforms.uTorPhase.value = toroidal;
    this.velMaterial.uniforms.uPolPhase.value = poloidal;
    this.velMaterial.uniforms.uBreathPhase.value = breathPhase;
  }

  /**
   * Advances simulation by dt seconds
   */
  /** Native disperse command; independent of editor pointer ownership. z is the burst centre's depth. */
  public setBurst(position: THREE.Vector2, velocity: THREE.Vector2, radius: number, radial: number, spin: number, z: number = 0) {
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
  private runPairwisePasses(
    pw: { radius?: number; stiffness?: number; restitution?: number; viscosity?: number; extent?: number },
    compPlane: number,
    dt: number,
    pairwise3D: number
  ): void {
    const side = sortSideForParticleTexSide(this.texWidth);
    if (side === null) return; // caller has already warned once
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
    // Force output: MRT (count: 2). Buffer 0 keeps the legacy vec4(corr.xy,
    // dv.xy) packing both consumers have always read; buffer 1 carries the
    // depth-axis components (corr.z, dv.z) the 3D contact path needs — six
    // floats total. Both buffers are written every frame; with pairwise3D = 0
    // buffer 1 is exact zeros and nothing reads it. A second render pass would
    // re-run the whole candidate loop for two floats, and the legacy packing
    // has no spare channels, so one MRT draw is the cheapest mechanism.
    if (!this.pairForceTarget) {
      this.pairForceTarget = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, {
        ...this.rtTemplate,
        count: 2,
      });
    }

    // 1. Cell keys
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

    // 2. Bitonic sort network: one material, (stage, substage) uniforms per draw
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

    // 3. Per-cell (start, count) via binary search over the sorted keys
    const rangeU = this.pairRangeMaterial.uniforms;
    rangeU.uSortTexture.value = sorted.texture;
    rangeU.uSide.value = side;
    rangeU.uSlots.value = side * side;
    rangeU.uCells.value.set(grid.cellsX, grid.cellsY);
    this.quadMesh.material = this.pairRangeMaterial;
    this.renderer.setRenderTarget(this.pairCellTable);
    this.renderer.render(this.quadScene, this.quadCamera);

    // 4. Contact forces straight into particle-index space
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

  public step(
    dt: number,
    time: number,
    config: PointCloudConfig,
    morphProgress: number,
    pointerPos: THREE.Vector2,
    pointerVel: THREE.Vector2,
    pointerZ = 0
  ) {
    if (!(dt > 0)) return;
    this.stepCount++;
    const clampedDt = Math.min(dt, 0.033);

    // 0. Sorted-grid pairwise collision passes (entirely skipped while disabled)
    const pw = config.pairwise;
    const pwEnabled = !!(pw && pw.enabled) && this.particleCount <= PAIRWISE_MAX_PARTICLES;
    if (pw && pw.enabled && this.particleCount > PAIRWISE_MAX_PARTICLES && !this.pairWarned) {
      this.pairWarned = true;
      console.warn(
        `pairwise: ${this.particleCount} particles exceed the ${PAIRWISE_MAX_PARTICLES} sort capacity; the collision system stays disabled.`
      );
    }
    // Depth geometry: the vortex and dispersion gain a real depth component, so
    // forces turn through the body rather than sliding it in the picture plane.
    // The same signal turns pairwise contacts into genuine 3D interactions.
    const depthGeometry = (config.glyphVolume?.enabled && (config.glyphVolume?.depth ?? 0) > 0) ? 1.0 : 0.0;
    if (pwEnabled) {
      this.runPairwisePasses(pw!, this.velMaterial.uniforms.uCompPlane.value as number, clampedDt, depthGeometry);
    }

    // 1. Update uniforms for velocity simulation
    const vUniforms = this.velMaterial.uniforms;
    vUniforms.uPairwiseEnabled.value = pwEnabled ? 1.0 : 0.0;
    vUniforms.uPairwise3D.value = depthGeometry;
    vUniforms.uPairMaxDelta.value = Math.max(1.0, PAIRWISE_MAX_SPEED_FRACTION * (config.fluid.maxSpeed ?? 35000.0));
    vUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    vUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    vUniforms.uMorphProgress.value = morphProgress;
    vUniforms.uDelta.value = clampedDt;
    vUniforms.uTime.value = time;

    vUniforms.uCurlScale.value = config.fluid.curlScale;
    vUniforms.uCurlSpeed.value = config.fluid.curlSpeed;
    vUniforms.uTurbulence.value = config.fluid.turbulence ?? 1.0;
    vUniforms.uVortexStrength.value = config.fluid.vortexStrength;
    vUniforms.uDepthGeometry.value = depthGeometry;
    // When the body law is on, the depth components of the vortex and the bridge
    // engage by default — an author opts out by lowering the slider, not by
    // discovering it. The shader still gates on uDepthGeometry, so flat
    // compositions never see either.
    vUniforms.uVortex3d.value = Math.max(0, Math.min(1, config.fluid.vortex3d ?? depthGeometry));
    vUniforms.uDispersion3d.value = Math.max(0, Math.min(1, config.fluid.dispersion3d ?? depthGeometry));
    vUniforms.uViscosity.value = config.fluid.viscosity;
    vUniforms.uReturnSpeed.value = config.fluid.returnSpeed;
    vUniforms.uDispersion.value = config.fluid.dispersion ?? 0.5;
    vUniforms.uStyleMode.value = config.style === 'halftone' ? 1.0 : 0.0;

    // Extended physics
    const fl = config.fluid;
    vUniforms.uSnapRigidity.value = fl.snapRigidity ?? 1.0;
    vUniforms.uDensityTether.value = fl.densityTether ?? 1.0;
    vUniforms.uCurlDepth.value = fl.curlDepth ?? 0.57;
    vUniforms.uVortexRadius.value = fl.vortexRadius ?? 450.0;
    (vUniforms.uGravity.value as THREE.Vector3).set(fl.gravityX ?? 0, fl.gravityY ?? 0, fl.gravityZ ?? 0);
    vUniforms.uQuadraticDrag.value = fl.quadraticDrag ?? 0.0;
    vUniforms.uThermalJitter.value = fl.thermalJitter ?? 0.0;
    vUniforms.uMaxSpeed.value = fl.maxSpeed ?? 35000.0;
    vUniforms.uPointerFalloffPower.value = config.interaction.falloffPower ?? 2.0;

    // Toroidal / Hopf morph uniforms
    const tm = config.toroidalMorph;
    if (tm && tm.enabled) {
      let trajVal = 1.0;
      if (tm.trajectory === 'linear') trajVal = 0.0;
      else if (tm.trajectory === 'vortexSpiral') trajVal = 2.0;
      else if (tm.trajectory === 'quantumInterference') trajVal = 3.0;
      else trajVal = 1.0;

      vUniforms.uMorphTrajectory.value = trajVal;
      vUniforms.uFiberPhaseOffset.value = tm.fiberPhaseOffset ?? 0.0;
      vUniforms.uToroidalWinding.value = tm.toroidalWinding ?? 3.0;
      vUniforms.uPoloidalWinding.value = tm.poloidalWinding ?? 2.0;
      vUniforms.uChiralCoupling.value = tm.chiralCoupling ?? 0.75;
      vUniforms.uOscillationAmp.value = tm.oscillationAmplitude ?? 1.2;
      vUniforms.uOscillationFreq.value = tm.oscillationSpeed ?? 0.8;
      vUniforms.uBreathDepth.value = tm.breathDepth ?? 0.35;
      vUniforms.uManifoldRadius.value = tm.manifoldRadius ?? 180.0;
      vUniforms.uTorusDepthScale.value = tm.volumetricDepthScale ?? 1.0;
    } else {
      vUniforms.uMorphTrajectory.value = 0.0;
      vUniforms.uFiberPhaseOffset.value = 0.0;
      vUniforms.uToroidalWinding.value = 3.0;
      vUniforms.uPoloidalWinding.value = 2.0;
      vUniforms.uChiralCoupling.value = 0.75;
      vUniforms.uOscillationAmp.value = 1.2;
      vUniforms.uOscillationFreq.value = 0.8;
      vUniforms.uBreathDepth.value = 0.35;
      vUniforms.uManifoldRadius.value = 180.0;
      vUniforms.uTorusDepthScale.value = 1.0;
    }

    // Relational system uniforms
    const rel = config.relational;
    vUniforms.uRelationalEnabled.value = rel?.enabled ? 1.0 : 0.0;
    vUniforms.uAttractorCount.value = Math.max(1, Math.min(10, rel?.attractorCount ?? 2));
    vUniforms.uRelationalGravity.value = rel?.attractorGravity ?? 1.5;
    vUniforms.uRelationalSpin.value = rel?.relationalSpin ?? 1.2;
    vUniforms.uChaosFactor.value = rel?.chaosFactor ?? 0.0;
    vUniforms.uGravitySoftening.value = rel?.gravitySoftening ?? 45.0;
    vUniforms.uGravityFalloff.value = rel?.gravityFalloff ?? 1.45;
    vUniforms.uSwirlRadius.value = rel?.swirlRadius ?? 500.0;

    // Shared medium: scalar physics are config-driven; textures bind the last
    // completed solver state. Atlas tiles arrive through setCollisionState.
    const medium = config.medium;
    const mediumEnabled = !!(medium && medium.enabled);
    vUniforms.uMediumEnabled.value = mediumEnabled ? 1.0 : 0.0;
    if (mediumEnabled && medium) {
      const mediumExtent = Math.max(200, Math.min(20000, medium.extent ?? 1400));
      const mediumRes = Math.max(16, Math.min(1024, Math.round(medium.gridRes ?? 192)));
      // 3D mode derives the voxel volume side N from the same gridRes and packs
      // the N³ cells into an N²×N² texture (mapping pinned in mediumGrid.ts).
      // The solver side then jumps from mediumRes to N² — 1024 for the default
      // 192 — and every medium target is reallocated at that size.
      const threeD = medium.dimension === '3D';
      const mediumN = threeD ? mediumVolumeSideFor(mediumRes) : mediumRes;
      const solverSide = threeD ? mediumN * mediumN : mediumRes;
      this.ensureMediumTargets(solverSide, threeD);
      const compPlane = vUniforms.uCompPlane.value as number;
      vUniforms.uMediumPressureGain.value = Math.max(0, medium.pressure ?? 4);
      vUniforms.uMediumCoupling.value = Math.max(0, medium.coupling ?? 0.8);
      (vUniforms.uMediumMin.value as THREE.Vector2).set(-mediumExtent, -mediumExtent);
      (vUniforms.uMediumMax.value as THREE.Vector2).set(mediumExtent, mediumExtent);
      // 2D: one texel per solver cell. 3D: one texel per packed voxel; the §7C
      // 3D branch reads the tiling geometry from uMediumN / uMediumTexSide.
      (vUniforms.uMediumTexel.value as THREE.Vector2).set(1 / solverSide, 1 / solverSide);
      vUniforms.uMediumGridRes.value = mediumRes;
      vUniforms.uMedium3D.value = threeD ? 1.0 : 0.0;
      vUniforms.uMediumN.value = mediumN;
      vUniforms.uMediumTexSide.value = solverSide;
      // 'world3d' pins the medium to the XZ world floor; otherwise it follows the composition plane.
      vUniforms.uMediumPlane.value = medium.plane === 'world3d' ? 1.0 : compPlane;
      vUniforms.uMediumVelTexture.value = this.mediumVelRead!.texture;
      vUniforms.uMediumPressureTexture.value = this.mediumPressureRead!.texture;
    }

    const collision = config.collision;
    const collisionEnabled = !!(collision && collision.enabled);
    vUniforms.uCollisionEnabled.value = collisionEnabled ? 1.0 : 0.0;
    this.posMaterial.uniforms.uCollisionEnabled.value = collisionEnabled ? 1.0 : 0.0;
    if (collisionEnabled && collision) {
      const modeVal = collision.mode === 'vessel' ? 1.0 : 0.0;
      const integrity = Math.max(0, collision.integrity ?? 0.5);
      vUniforms.uCollisionMode.value = modeVal;
      vUniforms.uCollisionRestitution.value = Math.max(0, Math.min(1, collision.restitution ?? 0.35));
      vUniforms.uCollisionFriction.value = Math.max(0, Math.min(1, collision.friction ?? 0.1));
      vUniforms.uCollisionBand.value = Math.max(1, collision.band ?? 40);
      vUniforms.uCollisionStrength.value = Math.max(0, collision.strength ?? 4);
      vUniforms.uCollisionIntegrity.value = integrity;
      this.posMaterial.uniforms.uCollisionMode.value = modeVal;
      this.posMaterial.uniforms.uCollisionIntegrity.value = integrity;
    }

    vUniforms.uPointerPos.value.copy(pointerPos);
    vUniforms.uPointerZ.value = pointerZ;
    vUniforms.uPointerVelocity.value.copy(pointerVel).multiplyScalar(config.interaction.velocityInfluence ?? 1.0);
    vUniforms.uPointerRadius.value = config.interaction.radius;
    vUniforms.uPointerStrength.value = config.interaction.strength;

    let modeVal = 0.0;
    if (config.interaction.mode === 'attract') modeVal = 1.0;
    else if (config.interaction.mode === 'vortex') modeVal = 2.0;
    vUniforms.uInteractionMode.value = modeVal;

    // 2. Render velocity simulation pass
    this.quadMesh.material = this.velMaterial;
    this.renderer.setRenderTarget(this.nextVelTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Swap velocity targets
    const tempVel = this.currentVelTarget;
    this.currentVelTarget = this.nextVelTarget;
    this.nextVelTarget = tempVel;

    // 3. Update uniforms for position simulation
    const pUniforms = this.posMaterial.uniforms;
    pUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    pUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    pUniforms.uPairwiseEnabled.value = pwEnabled ? 1.0 : 0.0;
    pUniforms.uPairwise3D.value = depthGeometry;
    pUniforms.uPairwiseCorrectionTexture.value = pwEnabled && this.pairForceTarget
      ? this.pairForceTarget.texture
      : this.pairForceFallback;
    pUniforms.uPairwiseCorrectionZTexture.value = pwEnabled && this.pairForceTarget
      ? this.pairForceTarget.textures[1]
      : this.pairForceFallback;
    pUniforms.uDelta.value = clampedDt;
    pUniforms.uMorphTrajectory.value = tm && tm.enabled !== false && tm.trajectory !== 'linear' ? 1.0 : 0.0;
    pUniforms.uZDepthRetention.value = tm?.enabled ? 1.0 : 0.0;
    pUniforms.uZConfinement.value = config.fluid.zConfinement ?? 1.0;
    pUniforms.uDepthGeometry.value = depthGeometry;
    // Residency classification needs the same baked slots the velocity pass sees.
    pUniforms.uTargetATexture.value = vUniforms.uTargetATexture.value;
    pUniforms.uTargetBTexture.value = vUniforms.uTargetBTexture.value;

    // 4. Render position simulation pass
    this.quadMesh.material = this.posMaterial;
    this.renderer.setRenderTarget(this.nextPosTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Swap position targets
    const tempPos = this.currentPosTarget;
    this.currentPosTarget = this.nextPosTarget;
    this.nextPosTarget = tempPos;

    // 5. Shared medium update: splat → advect → diverge → Jacobi pressure → gradient
    // subtract. Every pass is skipped when the medium is disabled.
    if (mediumEnabled && medium) this.stepMedium(clampedDt, medium);

    // Reset render target
    this.renderer.setRenderTarget(null);
  }

  // ------------------------------------------------------------------ shared medium
  /** Allocate (or reallocate when the side or the dimension changes) the medium solver targets. */
  private ensureMediumTargets(side: number, threeD: boolean) {
    if (this.mediumRes === side && this.medium3D === threeD && this.mediumVel0) return;
    this.disposeMediumTargets();
    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;
    // Bilinear filtering keeps semi-Lagrangian lookups smooth when the device can
    // filter float textures; otherwise sampling falls back to nearest (blocky but valid).
    const filter = isWebGL2 && this.renderer.extensions.has('OES_texture_float_linear')
      ? THREE.LinearFilter
      : THREE.NearestFilter;
    const options: THREE.RenderTargetOptions = {
      type: floatType,
      format: THREE.RGBAFormat,
      minFilter: filter,
      magFilter: filter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false,
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
    (this.mediumAdvectMaterial.uniforms.uTexel.value as THREE.Vector2).copy(texel);
    (this.mediumDivergenceMaterial.uniforms.uTexel.value as THREE.Vector2).copy(texel);
    (this.mediumPressureMaterial.uniforms.uTexel.value as THREE.Vector2).copy(texel);
    (this.mediumGradientMaterial.uniforms.uTexel.value as THREE.Vector2).copy(texel);
  }

  private swapMediumVel() {
    const t = this.mediumVelRead;
    this.mediumVelRead = this.mediumVelWrite;
    this.mediumVelWrite = t;
  }

  private swapMediumPressure() {
    const t = this.mediumPressureRead;
    this.mediumPressureRead = this.mediumPressureWrite;
    this.mediumPressureWrite = t;
  }

  /** One medium frame: momentum injection, advection + dissipation, pressure projection. */
  private stepMedium(dt: number, medium: MediumConfig) {
    if (!this.mediumVelRead || !this.mediumVelWrite || !this.mediumDivergenceTarget || !this.mediumPressureRead || !this.mediumPressureWrite) return;
    const vUniforms = this.velMaterial.uniforms;
    const threeD = vUniforms.uMedium3D.value as number;
    const volumeN = vUniforms.uMediumN.value as number;
    const solverSide = vUniforms.uMediumTexSide.value as number;
    // One wiring point for the 3D tiling uniforms every solver material carries.
    const setVolume = (m: THREE.ShaderMaterial) => {
      m.uniforms.uMedium3D.value = threeD;
      m.uniforms.uMediumN.value = volumeN;
      m.uniforms.uMediumTexSide.value = solverSide;
    };

    // Splat: additive render of every particle into the existing velocity field
    // (no clear — the previous field must survive). In 3D the same draw runs
    // three times, one per hat-kernel slice offset; the vertex shader culls
    // zero-weight instances, and 2D keeps the single legacy draw.
    const sU = this.mediumSplatMaterial.uniforms;
    sU.uPositionTexture.value = this.currentPosTarget.texture;
    sU.uVelocityTexture.value = this.currentVelTarget.texture;
    sU.uMediumPlane.value = vUniforms.uMediumPlane.value;
    (sU.uMediumMin.value as THREE.Vector2).copy(vUniforms.uMediumMin.value as THREE.Vector2);
    (sU.uMediumMax.value as THREE.Vector2).copy(vUniforms.uMediumMax.value as THREE.Vector2);
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

    // Advect: semi-Lagrangian self-advection with dt-scaled dissipation.
    const aU = this.mediumAdvectMaterial.uniforms;
    aU.uMediumVelocity.value = this.mediumVelRead.texture;
    aU.uDelta.value = dt;
    aU.uDissipation.value = Math.pow(Math.max(0, Math.min(1.05, medium.persistence ?? 0.97)), dt * 60);
    aU.uMediumExtent.value = ((vUniforms.uMediumMax.value as THREE.Vector2).x - (vUniforms.uMediumMin.value as THREE.Vector2).x) || 1;
    setVolume(this.mediumAdvectMaterial);
    this.quadMesh.material = this.mediumAdvectMaterial;
    this.renderer.setRenderTarget(this.mediumVelWrite);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.swapMediumVel();

    // Divergence of the advected field.
    this.mediumDivergenceMaterial.uniforms.uMediumVelocity.value = this.mediumVelRead.texture;
    setVolume(this.mediumDivergenceMaterial);
    this.quadMesh.material = this.mediumDivergenceMaterial;
    this.renderer.setRenderTarget(this.mediumDivergenceTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Jacobi pressure iterations (warm-started, under-relaxed).
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

    // Gradient subtract: project the field toward divergence-free flow.
    this.mediumGradientMaterial.uniforms.uMediumVelocity.value = this.mediumVelRead.texture;
    this.mediumGradientMaterial.uniforms.uPressure.value = this.mediumPressureRead.texture;
    setVolume(this.mediumGradientMaterial);
    this.quadMesh.material = this.mediumGradientMaterial;
    this.renderer.setRenderTarget(this.mediumVelWrite);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.swapMediumVel();
  }

  private disposeMediumTargets() {
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

  public destroy() {
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
