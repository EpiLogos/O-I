/**
 * O:I-owned retained-field capability over the vendored upstream production
 * adapter. THIS FILE IS NOT VENDORED: `vendor-expressions-engine.mjs`
 * rewrites only `engine/` and `shell/` from the upstream source, so this
 * extension survives engine refreshes by construction. It subclasses the
 * upstream `ProductionAdapter` and adds exactly one narrow capability: a
 * retained target lease over the adapter's already-created native field.
 *
 * O:I keeps renderer, simulation clock and lifecycle ownership. K8 may only
 * replace the two attraction target textures and ask O:I to checkpoint or
 * restore resident position+velocity through the existing binding.
 *
 * PointCloudField normally reasserts its authored entity targets every GPU
 * step. While this lease stands we suppress only those internal target
 * writes; the rest of O:I's physics/render path continues unchanged.
 *
 * The upstream adapter's internals are consumed by their published shapes
 * (`engine.simulator`, `engine.renderer`, `engine.entities`, `signature`,
 * `dirty`, `contextLost`); a signature-capture guard mirrors the upstream
 * frame signature computation so the lease is released before an authored
 * scene replacement.
 */
import { ProductionAdapter } from "../shell/production.mjs";
import { ExpressionConnectionLayer } from "./expressionBindings.mjs";
import { WORLD_SCALE } from "../shell/nativeParameters.mjs";

export class RetainedProductionAdapter extends ProductionAdapter {
  constructor(canvas) {
    super(canvas);
    // The upstream constructor registered its own context-lost handler while
    // its fields were initialising; these additional listeners carry only the
    // retained-lease bookkeeping (upstream lost-handling is unchanged).
    canvas.addEventListener("webglcontextlost", this.retainedLost);
    canvas.addEventListener("webglcontextrestored", this.restored);
  }

  // Field initialisers run after the upstream constructor, so the upstream
  // capabilities instance field is readable here through `this`.
  capabilities = {
    ...this.capabilities,
    runtimeCheckpoints: true,
    notes: this.capabilities.notes.map((note) =>
      note === "10 formations / 8 pins. Configuration saves are not runtime checkpoints."
        ? "10 formations / 8 pins. Configuration saves are not runtime checkpoints; an admitted retained-field lease can checkpoint resident GPU position + velocity for recovery."
        : note,
    ),
  };

  expressionBindings = [];
  connectionLayer = null;
  setExpressionBindings(bindings = []) {
    this.expressionBindings = bindings;
    this.dirty = true;
  }
  render(frame) {
    // Install on the actual field, never another renderer. onBeforeRender
    // sees the current evaluated 3D poses after the native simulation step.
    if (this.connectionLayer && this.connectionLayer.engine !== this.engine) {
      this.connectionLayer.dispose(); this.connectionLayer = null;
    }
    this.connectionLayer?.configure(this.expressionBindings, frame.selectedIds);
    super.render(frame);
    if (this.expressionBindings.length && !this.connectionLayer && this.engine) {
      this.connectionLayer = new ExpressionConnectionLayer(this.engine);
      this.connectionLayer.configure(this.expressionBindings, frame.selectedIds);
      // First attachment paints once without advancing/reseeding the clock.
      this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }
  }
  hitTestExpression(x, y) {
    if (!this.engine || this.contextLost) return null;
    const relation = this.connectionLayer?.hitTest(x, y);
    // Prefer an actual member centre within 12px; connections retain their
    // own independently selectable midpoints, including parallel records.
    let member = null, distance = 12;
    for (const pose of this.engine.lastPoses ?? []) {
      const p = this.engine.projectWorldToScreen(pose.x, pose.y, pose.z ?? 0);
      if (!p.visible) continue;
      const d = Math.hypot(x-p.x,y-p.y);
      if (d <= distance) {distance=d;member={kind:"entity",entity_ref:pose.entityId,distance:d};}
    }
    return member ?? relation ?? null;
  }
  expressionBindingSnapshot() {
    return this.connectionLayer?.inspect() ?? {rendered:[],unavailable:this.expressionBindings.map(b=>b.binding_ref)};
  }

  retained = null;
  recoveryListeners = new Set();

  retainedLost = () => {
    if (!this.retained) return;
    this.retained.recoveryRequired = true;
    for (const listener of this.recoveryListeners) listener("lost");
  };

  restored = () => {
    if (!this.retained) {
      // Ordinary authored expression recovery remains the existing explicit
      // recover-context/reseed path. A browser restoration alone is not a
      // claim that its physical state survived.
      this.dirty = true;
      return;
    }
    this.contextLost = false;
    this.retained.recoveryRequired = true;
    this.dirty = true;
    for (const listener of this.recoveryListeners) listener("restored");
  };

  configuration(frame) {
    const { toolbelt, propertyTracks, ...renderScene } = frame.scene;
    const sig = frame.authoringRevision === undefined ? JSON.stringify(renderScene) : frame.scene.id + ":" + frame.authoringRevision;
    if (this.retained?.lockedSignature && sig !== this.retained.lockedSignature) {
      throw new Error("A retained native field is attached; release it before replacing the authored expression scene.");
    }
    return super.configuration(frame);
  }

  command(command) {
    if (command.type === "recover-context" && this.retained) {
      throw new Error("A retained field cannot be reseeded; restore its acknowledged GPU checkpoint through the retained lease.");
    }
    return super.command(command);
  }

  retainedTargetPort() {
    if (!this.engine || this.contextLost) throw new Error("The production field must be live before a retained target lease can attach.");
    if (!this.retained) {
      const simulator = this.engine.simulator;
      const originalOwn = Object.prototype.hasOwnProperty.call(simulator, "setTargetTextures") ? simulator.setTargetTextures : null;
      const original = simulator.setTargetTextures;
      const state = {
        simulator,
        originalOwn,
        original,
        external: false,
        recoveryRequired: false,
        presentation: null,
        lockedSignature: this.signature,
        port: null
      };
      // Internal PointCloudField entity-target writes continue until the first
      // admitted external target set. From that point onward only the retained
      // port may change target textures until the lease is released.
      simulator.setTargetTextures = (...args) => {
        if (!this.retained || !this.retained.external) return original.call(simulator, ...args);
      };
      this.retained = state;
    }
    const state = this.retained;
    if (!state.port) {
      const adapter = this;
      state.port = Object.freeze({
        get texWidth() { return state.simulator.texWidth; },
        get texHeight() { return state.simulator.texHeight; },
        get particleCount() { return state.simulator.particleCount; },
        get currentPosTarget() { return state.simulator.currentPosTarget; },
        get currentVelTarget() { return state.simulator.currentVelTarget; },
        get nextPosTarget() { return state.simulator.nextPosTarget; },
        get nextVelTarget() { return state.simulator.nextVelTarget; },
        // Authored target textures are exposed only as admission material. The
        // retained binding copies them before taking target ownership.
        get targetA() { return adapter.engine?.entities?.textureA ?? null; },
        get targetB() { return adapter.engine?.entities?.textureB ?? null; },
        setTargetTextures(targetA, targetB, centre) {
          if (adapter.retained !== state || adapter.contextLost || state.recoveryRequired) throw new Error("Retained target write is unavailable during field recovery.");
          state.external = true;
          state.original.call(state.simulator, targetA, targetB, centre);
          adapter.dirty = true;
        }
      });
    }
    return state.port;
  }

  /** Atomically updates only the live per-entity presentation uniforms. The
   * retained target textures, partitions, shapes and clock remain owned by
   * their existing producers. */
  updateRetainedPresentation(request) {
    const state = this.retained;
    if (!state?.external || !this.engine || this.contextLost || state.recoveryRequired) {
      throw new Error("A live retained-field binding must own targets before presentation can update.");
    }
    if (!request || request.schema !== "oi.retained-presentation/v1" || Object.keys(request).sort().join(",") !== "entities,eventRef,personalGeneration,profileGeneration,schema,subjectRef") throw new Error("Unsupported retained presentation envelope.");
    const text = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0");
    const integer = (value) => Number.isSafeInteger(value) && value >= 0;
    if (!text(request.eventRef) || !text(request.subjectRef) || !integer(request.profileGeneration) || !integer(request.personalGeneration)) {
      throw new Error("Retained presentation identity and generation must be explicit.");
    }
    const existing = this.engine.config?.entities;
    if (!Array.isArray(existing) || !Array.isArray(request.entities) || request.entities.length !== existing.length) {
      throw new Error("Retained presentation must cover the existing entity set exactly.");
    }
    const previous = state.presentation;
    if (previous && (request.eventRef !== previous.eventRef || request.subjectRef !== previous.subjectRef || request.profileGeneration !== previous.profileGeneration || request.personalGeneration < previous.personalGeneration)) {
      throw new Error("Retained presentation is stale or belongs to another owner event.");
    }
    const byId = new Map(request.entities.map((entity) => [entity?.id, entity]));
    if (byId.size !== existing.length || existing.some((entity) => !byId.has(entity.id))) throw new Error("Retained presentation entity order and identity changed.");
    const next = existing.map((entity, index) => {
      const patch = request.entities[index];
      if (!patch || Object.keys(patch).sort().join(",") !== "id,scale,tint,tintWeight,x,y,z" || patch.id !== entity.id || !Number.isFinite(patch.x) || Math.abs(patch.x)>10 || !Number.isFinite(patch.y) || Math.abs(patch.y)>10 || !Number.isFinite(patch.z) || Math.abs(patch.z)>10 || !Number.isFinite(patch.scale) || patch.scale < 0.02 || patch.scale > 4 || !/^#[0-9a-fA-F]{6}$/.test(patch.tint) || !Number.isFinite(patch.tintWeight) || patch.tintWeight < 0 || patch.tintWeight > 1) {
        throw new Error("Retained presentation contains an invalid or reordered entity patch.");
      }
      // The envelope uses the authoring coordinate convention; native entity
      // coordinates use the engine's established 400-unit stage scale.
      return { ...entity, x: patch.x * WORLD_SCALE, y: patch.y * WORLD_SCALE, z: patch.z * WORLD_SCALE, scale: patch.scale, tint: patch.tint, tintWeight: patch.tintWeight };
    });
    const fingerprint = JSON.stringify({schema:request.schema,eventRef:request.eventRef,subjectRef:request.subjectRef,profileGeneration:request.profileGeneration,personalGeneration:request.personalGeneration,entities:request.entities});
    if (previous && request.personalGeneration === previous.personalGeneration) {
      if (fingerprint !== previous.fingerprint) throw new Error("A personal generation cannot be rewritten.");
      return this.inspect();
    }
    // All validation precedes this single engine mutation.
    this.engine.updateConfig({ entities: next });
    state.presentation = { eventRef: request.eventRef, subjectRef: request.subjectRef, profileGeneration: request.profileGeneration, personalGeneration: request.personalGeneration, fingerprint };
    this.dirty = true;
    return this.inspect();
  }

  checkpointRetainedField(binding) {
    if (!this.retained?.external || !this.engine || this.contextLost || this.retained.recoveryRequired || typeof binding?.checkpoint !== "function") {
      throw new Error("A live retained-field binding must own targets before checkpointing.");
    }
    return binding.checkpoint(this.engine.renderer);
  }

  restoreRetainedField(binding, checkpoint) {
    const state = this.retained;
    if (!state?.external || !this.engine || this.contextLost || !state.recoveryRequired || typeof binding?.restore !== "function") {
      throw new Error("Retained-field restore is only admitted after this same WebGL surface has returned.");
    }
    // Allow binding.restore() to call its port rebind while recovery is held.
    state.recoveryRequired = false;
    try {
      binding.restore(this.engine.renderer, checkpoint);
    } catch (error) {
      state.recoveryRequired = true;
      throw error;
    }
    this.dirty = true;
    return this;
  }

  onRetainedRecoveryRequired(listener) {
    if (typeof listener !== "function") throw new Error("Retained recovery listener must be callable.");
    this.recoveryListeners.add(listener);
    if (this.retained?.recoveryRequired) queueMicrotask(() => listener(this.contextLost ? "lost" : "restored"));
    return () => this.recoveryListeners.delete(listener);
  }

  releaseRetainedField() {
    const state = this.retained;
    if (!state) return;
    if (state.originalOwn) state.simulator.setTargetTextures = state.originalOwn;
    else delete state.simulator.setTargetTextures;
    this.retained = null;
    this.recoveryListeners.clear();
    if (this.engine?.entities?.textureA && this.engine?.entities?.textureB) {
      state.original.call(state.simulator, this.engine.entities.textureA, this.engine.entities.textureB, this.engine.entities.fieldCentre(), this.engine.entities.noiseTexture);
    }
    this.dirty = true;
  }

  dispose() {
    this.connectionLayer?.dispose(); this.connectionLayer = null;
    this.releaseRetainedField();
    this.canvas.removeEventListener("webglcontextlost", this.retainedLost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    super.dispose();
  }
}

export { RetainedProductionAdapter as ProductionAdapter };
