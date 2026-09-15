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
    this.releaseRetainedField();
    this.canvas.removeEventListener("webglcontextlost", this.retainedLost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    super.dispose();
  }
}

export { RetainedProductionAdapter as ProductionAdapter };
