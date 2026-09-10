/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Point-cloud field, ported from EpiLogos/Point-Cloud-Demo@7616489
 * src/engine/PointCloudField.ts. The simulation, baking and render material
 * are the demo's; the ownership seams changed per the integration review:
 *
 *  - no window event listeners and no own renderer/canvas: the window host
 *    (host.mjs) owns the single renderer, the frame clock, geometry and the
 *    pointer feed; a field is one instance inside that host;
 *  - updateConfig reallocates when particleCount changes (demo bug), includes
 *    fontWeight in target invalidation (demo bug), applies morphProgress to
 *    the live state (demo bug), and returns a change classification;
 *  - relational live values use nullish defaults — a valid 0 or negative
 *    survives (demo replaced them with `||` fallbacks);
 *  - the relational attractor pass reuses preallocated vectors/arrays (demo
 *    allocated fresh Vector4s every frame);
 *  - disperse targets an explicit local position, not the last pointer;
 *  - a rebake swaps target textures without reseeding — particles flow to
 *    the new glyph; seeding happens on construction and explicit reset.
 */

export function createPointCloudField(THREE, shaders, GPGPUSimulator, GlyphSampler) {
  class PointCloudField {
    /**
     * @param options {renderer, config, sampler?, floatType?, worldScale?}
     */
    constructor({ renderer, config, sampler, floatType, worldScale = 0.85 }) {
      this.renderer = renderer;
      this.config = config;
      this.worldScale = worldScale;

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      this.camera.position.z = 100;

      this.sampler = sampler ?? new GlyphSampler();
      this.ownsSampler = !sampler;

      this.simulator = new GPGPUSimulator(renderer, config.particleCount, floatType);
      this.simulatorFloatType = floatType;

      // Preallocated relational work buffers — the per-frame pass below
      // never allocates.
      this.attractorWork = Array.from({ length: 6 }, () => new THREE.Vector4(-99999, -99999, 0, 0));
      this.spinWork = [0, 0, 0, 0, 0, 0];

      // Morph state
      this.morphProgress = config.morphProgress ?? 0.0;
      this.morphDirection = 1.0;

      // Pointer state (fed by the host)
      this.pointerPos = new THREE.Vector2(-99999, -99999);
      this.pointerVel = new THREE.Vector2(0, 0);
      this.lastPointerPos = new THREE.Vector2(-99999, -99999);
      this.lastPointerTime = 0;

      this.bakeAndSwapTargets(/* seed */ true);
      this.initParticlePipeline(config.particleSize, config.style, config.dotShape, config.colorMode);
    }

    /** Glyph world scale from the anchor's current size (world = px 1:1). */
    static worldScaleForSize(width, height) {
      const side = Math.max(24, Math.min(width, height));
      return Math.min(0.85, Math.max(0.05, side / 990));
    }

    bakeAndSwapTargets(seed) {
      if (this.bakedTargets) {
        // Baked textures live in the sampler's bounded cache; release our
        // handles by simply dropping them (the sampler owns disposal).
        this.bakedTargets = undefined;
      }
      this.bakedTargets = this.sampler.bakeTargets(
        this.config.glyph,
        this.simulator.particleCount,
        this.simulator.texWidth,
        this.simulator.texHeight,
        this.config.style,
        this.config.fontFamily,
        this.config.fontWeight,
        this.worldScale
      );

      this.simulator.setTargetTextures(
        this.bakedTargets.textureA,
        this.bakedTargets.textureB,
        this.bakedTargets.vortexCenter
      );

      if (seed) {
        const initialData = this.bakedTargets.textureA.image.data;
        this.simulator.seedInitialState(initialData);
      }
    }

    initParticlePipeline(particleSize, style, dotShape, colorMode) {
      const totalCount = this.simulator.particleCount;
      const texW = this.simulator.texWidth;
      const texH = this.simulator.texHeight;

      const uvs = new Float32Array(totalCount * 2);
      for (let i = 0; i < totalCount; i++) {
        const x = i % texW;
        const y = Math.floor(i / texW);
        uvs[i * 2 + 0] = (x + 0.5) / texW;
        uvs[i * 2 + 1] = (y + 0.5) / texH;
      }

      this.particleGeometry = new THREE.BufferGeometry();
      // Dummy positions attribute; the vertex shader reads coords from the
      // simulation texture.
      this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(totalCount * 3), 3));
      this.particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      this.particleMaterial = new THREE.ShaderMaterial({
        vertexShader: shaders.particleVertexShader,
        fragmentShader: shaders.particleFragmentShader,
        uniforms: {
          uPositionTexture: { value: this.simulator.currentPosTarget.texture },
          uVelocityTexture: { value: this.simulator.currentVelTarget.texture },
          uMinParticleSize: { value: particleSize.min },
          uMaxParticleSize: { value: particleSize.max },
          uStyleMode: { value: style === 'halftone' ? 1.0 : 0.0 },
          uDotShape: { value: dotShape === 'square' ? 1.0 : 0.0 },
          uParticleColor: { value: new THREE.Color(0x0a0a0a) },
          uColorMode: { value: colorMode === 'blackOnWhite' ? 0.0 : 1.0 },
          uContrast: { value: 1.0 },
          uPixelRatio: { value: 1 },
          uCanvasSize: { value: new THREE.Vector2(2, 2) },
          uTime: { value: 0.0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });

      this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
      this.particlePoints.frustumCulled = false;
      this.scene.add(this.particlePoints);
    }

    /** Host feed: pointer in instance-local world coordinates. */
    setPointer(worldX, worldY) {
      const now = performance.now();
      const dt = Math.max(0.001, (now - this.lastPointerTime) / 1000);
      if (this.lastPointerPos.x > -90000) {
        const vx = (worldX - this.lastPointerPos.x) / dt;
        const vy = (worldY - this.lastPointerPos.y) / dt;
        this.pointerVel.x = this.pointerVel.x * 0.4 + vx * 0.6;
        this.pointerVel.y = this.pointerVel.y * 0.4 + vy * 0.6;
      }
      this.pointerPos.set(worldX, worldY);
      this.lastPointerPos.set(worldX, worldY);
      this.lastPointerTime = now;
    }

    clearPointer() {
      this.pointerPos.set(-99999, -99999);
      this.pointerVel.set(0, 0);
      this.lastPointerPos.set(-99999, -99999);
    }

    /** Host feed: geometry change. Never rebakes — glyph world size is
     * independent of the anchor's pixel rect. */
    resize(width, height, dpr) {
      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.updateProjectionMatrix();
      this.particleMaterial.uniforms.uPixelRatio.value = dpr;
      this.particleMaterial.uniforms.uCanvasSize.value.set(width, height);
    }

    /**
     * Re-world-scales and re-bakes targets (debounced by the host) after the
     * anchor's *size* changed — movement alone never reaches here.
     */
    rebakeForSize(width, height) {
      this.worldScale = PointCloudField.worldScaleForSize(width, height);
      this.bakeAndSwapTargets(false);
    }

    reset() {
      this.morphProgress = 0.0;
      this.morphDirection = 1.0;
      this.clearPointer();
      this.bakeAndSwapTargets(true);
    }

    /**
     * Apply a validated partial config. Cheap uniform changes apply inline;
     * a glyph/style/font change re-bakes target textures (particles flow to
     * the new shape); a particleCount change reallocates the simulation and
     * reseeds. Returns the strongest classification that applied.
     */
    updateConfig(next) {
      const prev = this.config;
      const reallocate = next.particleCount !== prev.particleCount;
      const rebake =
        JSON.stringify(prev.glyph) !== JSON.stringify(next.glyph) ||
        prev.style !== next.style ||
        prev.fontFamily !== next.fontFamily ||
        String(prev.fontWeight) !== String(next.fontWeight);

      this.config = next;

      if (reallocate) {
        this.simulator.destroy();
        this.simulator = new GPGPUSimulator(this.renderer, this.config.particleCount, this.simulatorFloatType);
        this.particleMaterial.uniforms.uPositionTexture.value = this.simulator.currentPosTarget.texture;
        this.particleMaterial.uniforms.uVelocityTexture.value = this.simulator.currentVelTarget.texture;
        // Re-seed and rebuild the uv attribute for the new texture dimensions.
        this.bakeAndSwapTargets(true);
        this.rebuildGeometry();
        this.applyUniforms();
        return 'reallocate';
      }

      if (rebake) {
        this.bakeAndSwapTargets(false);
      }

      if (next.morphProgress !== undefined && !next.autoMorph) {
        this.setMorphProgress(next.morphProgress);
      }

      this.applyUniforms();
      return rebake ? 'rebake' : 'uniform';
    }

    rebuildGeometry() {
      const totalCount = this.simulator.particleCount;
      const texW = this.simulator.texWidth;
      const texH = this.simulator.texHeight;
      const uvs = new Float32Array(totalCount * 2);
      for (let i = 0; i < totalCount; i++) {
        const x = i % texW;
        const y = Math.floor(i / texW);
        uvs[i * 2 + 0] = (x + 0.5) / texW;
        uvs[i * 2 + 1] = (y + 0.5) / texH;
      }
      this.particleGeometry.dispose();
      this.particleGeometry = new THREE.BufferGeometry();
      this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(totalCount * 3), 3));
      this.particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      this.particlePoints.geometry = this.particleGeometry;
    }

    applyUniforms() {
      const u = this.particleMaterial.uniforms;
      const colorMode = this.config.colorMode;
      u.uColorMode.value = colorMode === 'blackOnWhite' ? 0.0 : 1.0;
      u.uMinParticleSize.value = this.config.particleSize.min;
      u.uMaxParticleSize.value = this.config.particleSize.max;
      u.uStyleMode.value = this.config.style === 'halftone' ? 1.0 : 0.0;
      u.uDotShape.value = this.config.dotShape === 'square' ? 1.0 : 0.0;
    }

    /** followTheme ink, resolved by the host from the window's tokens. */
    setInk(colorHex) {
      this.particleMaterial.uniforms.uParticleColor.value.set(colorHex);
    }

    setMorphProgress(progress) {
      this.morphProgress = Math.max(0.0, Math.min(1.0, progress));
    }

    getMorphProgress() {
      return this.morphProgress;
    }

    /** Explicit target-local disperse — works without any pointer history. */
    triggerDisperse(x = 0, y = 0, strength = 3.0) {
      this.pointerPos.set(x, y);
      this.pointerVel.set(
        (Math.random() - 0.5) * 600 * strength,
        (Math.random() - 0.5) * 600 * strength
      );
      this.lastPointerPos.set(x, y);
      this.lastPointerTime = performance.now();
    }

    /**
     * Advance the simulation one step. Host-scheduled: called only when this
     * instance is visible and the host is running.
     */
    advance(dt, elapsedTime) {
      // Auto-morph oscillation between glyph A & B
      if (this.config.autoMorph) {
        const cycleDuration = this.config.autoMorphDuration || 4.0;
        const step = (dt / cycleDuration) * this.morphDirection;
        this.morphProgress += step;

        if (this.morphProgress >= 1.0) {
          this.morphProgress = 1.0;
          this.morphDirection = -1.0;
        } else if (this.morphProgress <= 0.0) {
          this.morphProgress = 0.0;
          this.morphDirection = 1.0;
        }
      }

      // Decay pointer velocity over time
      this.pointerVel.multiplyScalar(0.92);

      // Update dynamic relational multi-attractors — preallocated buffers
      // (nullish defaults: a valid 0 orbitSpeed/orbitRadius/wanderSpeed is
      // honoured, never replaced by a fallback).
      if (this.config.relational?.enabled && this.bakedTargets?.attractorCenters) {
        const rel = this.config.relational;
        const count = Math.max(1, Math.min(6, rel.attractorCount ?? 3));
        const baseCenters = this.bakedTargets.attractorCenters;
        const vCenter = this.bakedTargets.vortexCenter ?? new THREE.Vector2(0, 0);
        const orbitSpeed = rel.orbitSpeed ?? 0.8;
        const orbitRadius = rel.orbitRadius ?? 240;
        const wanderSpeed = rel.wanderSpeed ?? 0.5;

        for (let i = 0; i < 6; i++) {
          const work = this.attractorWork[i];
          if (i < count) {
            const basePt = baseCenters[i % baseCenters.length] ?? { x: 0, y: 0 };
            const initialAngle = (i / count) * Math.PI * 2;
            const currentAngle = initialAngle + elapsedTime * orbitSpeed;

            let posX = 0;
            let posY = 0;

            if (rel.mode === 'chaos') {
              // Non-linear harmonic wandering attractor
              const wx = Math.sin(elapsedTime * wanderSpeed * 1.4 + i * 2.1) * orbitRadius * 0.7;
              const wy = Math.cos(elapsedTime * wanderSpeed * 1.1 + i * 1.7) * orbitRadius * 0.5;
              posX = basePt.x + wx;
              posY = basePt.y + wy;
            } else if (rel.mode === 'nbody') {
              // Mutual figure-8 / Keplerian lemniscate orbit
              const t = elapsedTime * orbitSpeed + i * ((Math.PI * 2) / count);
              const denom = 1 + Math.cos(t) * Math.cos(t);
              posX = vCenter.x + (Math.sin(t) / denom) * orbitRadius * 1.4;
              posY = vCenter.y + ((Math.sin(t) * Math.cos(t)) / denom) * orbitRadius * 1.4;
            } else {
              // Standard orbital gravity around center
              const rx = Math.cos(currentAngle) * orbitRadius;
              const ry = Math.sin(currentAngle) * orbitRadius * 0.75;
              const driftX = Math.sin(elapsedTime * wanderSpeed + i) * 35;
              const driftY = Math.cos(elapsedTime * wanderSpeed + i) * 35;
              posX = vCenter.x + rx + driftX;
              posY = vCenter.y + ry + driftY;
            }

            // Individual spin sign alternation
            const spin = (i % 2 === 0 ? 1.0 : -1.0) * (1.0 + i * 0.2);
            work.set(posX, posY, 0, 1.0);
            this.spinWork[i] = spin;
          } else {
            work.set(-99999, -99999, 0, 0);
            this.spinWork[i] = 0;
          }
        }

        this.simulator.setAttractors(this.attractorWork, this.spinWork);
      }

      // Run GPGPU fluid dynamic simulation step
      this.simulator.step(
        dt,
        elapsedTime,
        this.config,
        this.morphProgress,
        this.pointerPos,
        this.pointerVel
      );

      // Bind updated simulation textures to the particle render material
      this.particleMaterial.uniforms.uPositionTexture.value = this.simulator.currentPosTarget.texture;
      this.particleMaterial.uniforms.uVelocityTexture.value = this.simulator.currentVelTarget.texture;
      this.particleMaterial.uniforms.uTime.value = elapsedTime;
    }

    /** Host renders this field's scene into the instance viewport. */
    render() {
      this.renderer.render(this.scene, this.camera);
    }

    inspect() {
      return {
        requestedParticles: this.config.particleCount,
        allocatedParticles: this.simulator.particleCount,
        texWidth: this.simulator.texWidth,
        texHeight: this.simulator.texHeight,
        morphProgress: this.morphProgress,
        glyph: this.config.glyph,
      };
    }

    dispose() {
      this.particleGeometry.dispose();
      this.particleMaterial.dispose();
      this.simulator.destroy();
      if (this.ownsSampler) this.sampler.destroy();
      this.bakedTargets = undefined;
    }
  }

  return PointCloudField;
}
