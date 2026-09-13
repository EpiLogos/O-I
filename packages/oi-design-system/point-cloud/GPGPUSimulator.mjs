/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GPGPU ping-pong simulator, ported from EpiLogos/Point-Cloud-Demo@7616489
 * src/engine/GPGPUSimulator.ts with the integration repairs:
 *  - the texture ladder starts at 32 (a small requested count actually saves
 *    resources — the demo's 256×256 floor made small anchors pay full price);
 *  - the float target type is chosen from *verified* framebuffer support
 *    passed in by the host, never inferred from the WebGL version alone;
 *  - `||` defaults on relational values are replaced by nullish coalescing
 *    upstream (the simulator only reads the config it is given).
 */

export function createGPGPUSimulator(THREE, simulationShaders) {
  class GPGPUSimulator {
    /**
     * @param renderer a shared THREE.WebGLRenderer
     * @param particleCount requested particle budget
     * @param floatType THREE.FloatType | THREE.HalfFloatType, verified by the host
     */
    constructor(renderer, particleCount = 120000, floatType = THREE.FloatType) {
      this.renderer = renderer;

      // Optimal square texture dimensions. The ladder reaches down to
      // 32×32 = 1,024 particles for small component-relative anchors and up
      // to 512×512 = 262,144 for the reference field.
      const side = Math.ceil(Math.sqrt(particleCount));
      const ladder = [32, 48, 64, 96, 128, 192, 256, 384, 512];
      let texSide = ladder[ladder.length - 1];
      for (const step of ladder) {
        if (side <= step) { texSide = step; break; }
      }

      this.texWidth = texSide;
      this.texHeight = texSide;
      this.particleCount = this.texWidth * this.texHeight;

      const rtOptions = {
        type: floatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        stencilBuffer: false,
        depthBuffer: false,
      };

      this.posTarget0 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
      this.posTarget1 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
      this.velTarget0 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);
      this.velTarget1 = new THREE.WebGLRenderTarget(this.texWidth, this.texHeight, rtOptions);

      this.currentPosTarget = this.posTarget0;
      this.nextPosTarget = this.posTarget1;
      this.currentVelTarget = this.velTarget0;
      this.nextVelTarget = this.velTarget1;

      // Quad setup for GPGPU render pass
      this.quadScene = new THREE.Scene();
      this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeom = new THREE.PlaneGeometry(2, 2);

      // Position simulation material
      this.posMaterial = new THREE.ShaderMaterial({
        vertexShader: simulationShaders.simulationVertexShader,
        fragmentShader: simulationShaders.positionSimulationShader,
        uniforms: {
          uPositionTexture: { value: null },
          uVelocityTexture: { value: null },
          uDelta: { value: 0.016 },
        },
        depthTest: false,
        depthWrite: false,
      });

      // Velocity simulation material
      this.velMaterial = new THREE.ShaderMaterial({
        vertexShader: simulationShaders.simulationVertexShader,
        fragmentShader: simulationShaders.velocitySimulationShader,
        uniforms: {
          uPositionTexture: { value: null },
          uVelocityTexture: { value: null },
          uTargetATexture: { value: null },
          uTargetBTexture: { value: null },
          uMorphProgress: { value: 0.0 },
          uDelta: { value: 0.016 },
          uTime: { value: 0.0 },

          // Fluid forces
          uCurlScale: { value: 1.0 },
          uCurlSpeed: { value: 0.8 },
          uTurbulence: { value: 1.0 },
          uVortexStrength: { value: 1.2 },
          uVortexCenter: { value: new THREE.Vector2(0, 0) },
          uViscosity: { value: 0.94 },
          uReturnSpeed: { value: 1.0 },
          uDispersion: { value: 0.5 },
          uStyleMode: { value: 0.0 },

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
            ],
          },
          uAttractorSpin: { value: [1.0, -1.0, 1.0, -1.0, 1.0, -1.0] },
          uRelationalGravity: { value: 1.5 },
          uRelationalSpin: { value: 1.2 },
          uChaosFactor: { value: 0.0 },

          // Pointer
          uPointerPos: { value: new THREE.Vector2(-99999, -99999) },
          uPointerVelocity: { value: new THREE.Vector2(0, 0) },
          uPointerRadius: { value: 150.0 },
          uPointerStrength: { value: 1.0 },
          uInteractionMode: { value: 0.0 },
        },
        depthTest: false,
        depthWrite: false,
      });

      this.quadMesh = new THREE.Mesh(quadGeom, this.posMaterial);
      this.quadScene.add(this.quadMesh);
      this.quadGeometry = quadGeom;
    }

    /**
     * Initializes position and velocity textures with seed data from target A
     */
    seedInitialState(initialData) {
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
        vertexShader: simulationShaders.simulationVertexShader,
        fragmentShader: `
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
        vertexShader: simulationShaders.simulationVertexShader,
        fragmentShader: `
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
    setTargetTextures(texA, texB, vortexCenter) {
      this.velMaterial.uniforms.uTargetATexture.value = texA;
      this.velMaterial.uniforms.uTargetBTexture.value = texB;
      this.velMaterial.uniforms.uVortexCenter.value.copy(vortexCenter);
    }

    /**
     * Updates dynamic attractor positions and polarities for relational orbital dynamics.
     * Writes into the preallocated uniform arrays — no per-frame allocation.
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

    /**
     * Advances simulation by dt seconds
     */
    step(
      dt,
      time,
      config,
      morphProgress,
      pointerPos,
      pointerVel
    ) {
      // 1. Update uniforms for velocity simulation
      const vUniforms = this.velMaterial.uniforms;
      vUniforms.uPositionTexture.value = this.currentPosTarget.texture;
      vUniforms.uVelocityTexture.value = this.currentVelTarget.texture;
      vUniforms.uMorphProgress.value = morphProgress;
      vUniforms.uDelta.value = Math.min(dt, 0.033);
      vUniforms.uTime.value = time;

      vUniforms.uCurlScale.value = config.fluid.curlScale;
      vUniforms.uCurlSpeed.value = config.fluid.curlSpeed;
      vUniforms.uTurbulence.value = config.fluid.turbulence;
      vUniforms.uVortexStrength.value = config.fluid.vortexStrength;
      vUniforms.uViscosity.value = config.fluid.viscosity;
      vUniforms.uReturnSpeed.value = config.fluid.returnSpeed;
      vUniforms.uDispersion.value = config.fluid.dispersion;
      vUniforms.uStyleMode.value = config.style === 'halftone' ? 1.0 : 0.0;

      // Relational system uniforms — nullish defaults so a valid 0 survives
      const rel = config.relational;
      vUniforms.uRelationalEnabled.value = rel?.enabled ? 1.0 : 0.0;
      vUniforms.uAttractorCount.value = Math.max(1, Math.min(6, rel?.attractorCount ?? 2));
      vUniforms.uRelationalGravity.value = rel?.attractorGravity ?? 1.5;
      vUniforms.uRelationalSpin.value = rel?.relationalSpin ?? 1.2;
      vUniforms.uChaosFactor.value = rel?.chaosFactor ?? 0.0;

      vUniforms.uPointerPos.value.copy(pointerPos);
      vUniforms.uPointerVelocity.value.copy(pointerVel);
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
      pUniforms.uDelta.value = Math.min(dt, 0.033);

      // 4. Render position simulation pass
      this.quadMesh.material = this.posMaterial;
      this.renderer.setRenderTarget(this.nextPosTarget);
      this.renderer.render(this.quadScene, this.quadCamera);

      // Swap position targets
      const tempPos = this.currentPosTarget;
      this.currentPosTarget = this.nextPosTarget;
      this.nextPosTarget = tempPos;

      // Reset render target
      this.renderer.setRenderTarget(null);
    }

    destroy() {
      this.posTarget0.dispose();
      this.posTarget1.dispose();
      this.velTarget0.dispose();
      this.velTarget1.dispose();
      this.posMaterial.dispose();
      this.velMaterial.dispose();
      this.quadGeometry.dispose();
    }
  }

  return GPGPUSimulator;
}
