/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from "three";
import {
  simulationVertexShader,
  positionSimulationShader,
  velocitySimulationShader
} from "./shaders/simulationShaders.mjs";
class GPGPUSimulator {
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
  // Quad setup for GPGPU render pass
  quadScene;
  quadCamera;
  quadMesh;
  // Simulation shader materials
  posMaterial;
  velMaterial;
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
        uZConfinement: { value: 1 }
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
          value: [
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
          ]
        },
        uAttractorSpin: { value: [1, -1, 1, -1, 1, -1, 1, -1, 1, -1] },
        uRelationalGravity: { value: 1.5 },
        uRelationalSpin: { value: 1.2 },
        uChaosFactor: { value: 0 },
        // Entities (first-class centres of formation)
        uEntityCount: { value: 0 },
        uEntityBounds: { value: new Float32Array(10) },
        uEntityCenter: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 200)) },
        uEntityMorph: { value: new Float32Array(10) },
        uEntityDepthScale: { value: new Float32Array(10).fill(1) },
        uEntityNormalized: { value: new Float32Array(10) },
        uEntityTransform: { value: Array.from({ length: 10 }, () => new THREE.Vector3(1, 1, 0)) },
        uEntityForce: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uTexSize: { value: new THREE.Vector2(1, 1) },
        uCompPlane: { value: 0 },
        uResDominance: { value: 1 },
        // Continuous modal cymatic resonator (live per-mode complex envelopes)
        uResEnabled: { value: 0 },
        uResModeCount: { value: 0 },
        uResRe: { value: new Float32Array(64) },
        uResIm: { value: new Float32Array(64) },
        uResPlateSize: { value: 700 },
        uResTransport: { value: 1 },
        uResAgitation: { value: 0.3 },
        uResBoundary: { value: 6 },
        uResPlane: { value: 0 },
        uResDriveScale: { value: 1 },
        // Dual-Phase Toroidal/Poloidal Morph & Inverse Hopf Fibration System
        uMorphTrajectory: { value: 1 },
        uFiberPhaseOffset: { value: 0 },
        uToroidalWinding: { value: 3 },
        uPoloidalWinding: { value: 2 },
        uChiralCoupling: { value: 0.75 },
        uOscillationAmp: { value: 1.2 },
        uOscillationFreq: { value: 0.8 },
        uManifoldRadius: { value: 180 },
        uTorusDepthScale: { value: 1 },
        // Pointer
        uPointerPos: { value: new THREE.Vector2(-99999, -99999) },
        uBurstPosition: { value: new THREE.Vector2() },
        uBurstVelocity: { value: new THREE.Vector2() },
        uPointerVelocity: { value: new THREE.Vector2(0, 0) },
        uPointerZ: { value: 0 },
        uPointerRadius: { value: 150 },
        uPointerStrength: { value: 1 },
        uInteractionMode: { value: 0 },
        // Placed persistent interaction points in 3D
        uPlacedPointCount: { value: 0 },
        uPlacedPoints: {
          value: Array.from({ length: 8 }, () => new THREE.Vector4(-99999, -99999, 0, 0))
        },
        uPlacedPointParams: {
          value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0))
        }
      },
      depthTest: false,
      depthWrite: false
    });
    this.quadMesh = new THREE.Mesh(quadGeom, this.posMaterial);
    this.quadScene.add(this.quadMesh);
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
  /** Push the entity uniform set (partition bounds, centres, morph, forces) to the velocity material */
  setEntityState(u) {
    const vU = this.velMaterial.uniforms;
    vU.uEntityCount.value = Math.min(10, u.count);
    vU.uEntityBounds.value.set(u.bounds.subarray(0, 10));
    vU.uEntityMorph.value.set(u.morph.subarray(0, 10));
    vU.uEntityDepthScale.value.set(u.depthScales ?? new Float32Array(10).fill(1));
    vU.uEntityNormalized.value.set(u.normalized ?? new Float32Array(10));
    const cU = vU.uEntityCenter.value;
    const fU = vU.uEntityForce.value;
    for (let i = 0; i < 10; i++) {
      cU[i].copy(u.centers[i]);
      fU[i].copy(u.forces[i]);
      vU.uEntityTransform.value[i].copy(u.transforms[i]);
    }
    vU.uTexSize.value.set(this.texWidth, this.texHeight);
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
  /** Push the live modal envelopes + coupling parameters of the cymatic resonator */
  setResonatorState(enabled, modeCount, re, im, plateSize, transport, agitation, boundary, plane, driveScale) {
    const vU = this.velMaterial.uniforms;
    vU.uResEnabled.value = enabled ? 1 : 0;
    vU.uResModeCount.value = Math.max(0, Math.min(64, Math.round(modeCount)));
    vU.uResRe.value.set(re.subarray(0, 64));
    vU.uResIm.value.set(im.subarray(0, 64));
    vU.uResPlateSize.value = plateSize;
    vU.uResTransport.value = transport;
    vU.uResAgitation.value = agitation;
    vU.uResBoundary.value = boundary;
    vU.uResPlane.value = plane;
    vU.uResDriveScale.value = driveScale;
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
  /** Running phases of the two conjugate morph oscillators (radians) */
  setMorphPhases(toroidal, poloidal) {
    this.velMaterial.uniforms.uTorPhase.value = toroidal;
    this.velMaterial.uniforms.uPolPhase.value = poloidal;
  }
  /**
   * Advances simulation by dt seconds
   */
  /** Native disperse command; independent of editor pointer ownership. */
  setBurst(position, velocity) {
    this.velMaterial.uniforms.uBurstPosition.value.copy(position);
    this.velMaterial.uniforms.uBurstVelocity.value.copy(velocity);
  }
  step(dt, time, config, morphProgress, pointerPos, pointerVel, pointerZ = 0) {
    if (!(dt > 0)) return;
    this.stepCount++;
    const vUniforms = this.velMaterial.uniforms;
    vUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    vUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    vUniforms.uMorphProgress.value = morphProgress;
    vUniforms.uDelta.value = Math.min(dt, 0.033);
    vUniforms.uTime.value = time;
    vUniforms.uCurlScale.value = config.fluid.curlScale;
    vUniforms.uCurlSpeed.value = config.fluid.curlSpeed;
    vUniforms.uTurbulence.value = config.fluid.turbulence ?? 1;
    vUniforms.uVortexStrength.value = config.fluid.vortexStrength;
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
      vUniforms.uManifoldRadius.value = 180;
      vUniforms.uTorusDepthScale.value = 1;
    }
    const rel = config.relational;
    vUniforms.uRelationalEnabled.value = rel?.enabled ? 1 : 0;
    vUniforms.uAttractorCount.value = Math.max(1, Math.min(10, rel?.attractorCount ?? 2));
    vUniforms.uRelationalGravity.value = rel?.attractorGravity ?? 1.5;
    vUniforms.uRelationalSpin.value = rel?.relationalSpin ?? 1.2;
    vUniforms.uChaosFactor.value = rel?.chaosFactor ?? 0;
    vUniforms.uGravitySoftening.value = rel?.gravitySoftening ?? 45;
    vUniforms.uGravityFalloff.value = rel?.gravityFalloff ?? 1.45;
    vUniforms.uSwirlRadius.value = rel?.swirlRadius ?? 500;
    vUniforms.uPointerPos.value.copy(pointerPos);
    vUniforms.uPointerZ.value = pointerZ;
    vUniforms.uPointerVelocity.value.copy(pointerVel).multiplyScalar(config.interaction.velocityInfluence ?? 1);
    vUniforms.uPointerRadius.value = config.interaction.radius;
    vUniforms.uPointerStrength.value = config.interaction.strength;
    let modeVal = 0;
    if (config.interaction.mode === "attract") modeVal = 1;
    else if (config.interaction.mode === "vortex") modeVal = 2;
    vUniforms.uInteractionMode.value = modeVal;
    const placed = config.interaction.placedPoints || [];
    vUniforms.uPlacedPointCount.value = Math.min(8, placed.length);
    for (let i = 0; i < 8; i++) {
      const p = placed[i];
      if (p && p.active !== false) {
        vUniforms.uPlacedPoints.value[i].set(
          p.x,
          p.y,
          p.z ?? 0,
          p.radius
        );
        let pMode = 0;
        if (p.mode === "attract") pMode = 1;
        else if (p.mode === "vortex") pMode = 2;
        vUniforms.uPlacedPointParams.value[i].set(p.strength, pMode, p.spin ?? 0, p.falloff === "gaussian" ? 1 : 0);
      } else {
        vUniforms.uPlacedPoints.value[i].set(-99999, -99999, 0, 0);
        vUniforms.uPlacedPointParams.value[i].set(0, 0, 0, 0);
      }
    }
    this.quadMesh.material = this.velMaterial;
    this.renderer.setRenderTarget(this.nextVelTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    const tempVel = this.currentVelTarget;
    this.currentVelTarget = this.nextVelTarget;
    this.nextVelTarget = tempVel;
    const pUniforms = this.posMaterial.uniforms;
    pUniforms.uPositionTexture.value = this.currentPosTarget.texture;
    pUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
    pUniforms.uDelta.value = Math.min(dt, 0.033);
    pUniforms.uMorphTrajectory.value = tm && tm.enabled !== false && tm.trajectory !== "linear" ? 1 : 0;
    pUniforms.uZDepthRetention.value = tm?.enabled ? 1 : 0;
    pUniforms.uZConfinement.value = config.fluid.zConfinement ?? 1;
    this.quadMesh.material = this.posMaterial;
    this.renderer.setRenderTarget(this.nextPosTarget);
    this.renderer.render(this.quadScene, this.quadCamera);
    const tempPos = this.currentPosTarget;
    this.currentPosTarget = this.nextPosTarget;
    this.nextPosTarget = tempPos;
    this.renderer.setRenderTarget(null);
  }
  destroy() {
    this.posTarget0.dispose();
    this.posTarget1.dispose();
    this.velTarget0.dispose();
    this.velTarget1.dispose();
    this.posMaterial.dispose();
    this.velMaterial.dispose();
  }
}
export {
  GPGPUSimulator
};
