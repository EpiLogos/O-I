/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Window host for the point-cloud expression layer. One host per native or
 * detached window owns:
 *
 *  - exactly one expression WebGL renderer/context (lazily — `three` is
 *    imported here and only here, after the first instance is requested on
 *    an enabled path; importing design tokens or running the app with the
 *    expression off never loads it);
 *  - one frame scheduler (rAF) that sleeps when no visible instance needs
 *    animation;
 *  - a bounded instance registry with explicit lifecycle: start (create),
 *    pause, resume, render-once, update, reset, release, inspect;
 *  - verified float render-target support (a real render-back test, never
 *    inferred from the WebGL version) with an honest static fallback;
 *  - per-instance and aggregate particle budgets, reported not hidden.
 *
 * GPU state stays window-local; nothing here knows about owners, sessions,
 * progress or notifications (D22 law). The overlay canvas is transparent,
 * aria-hidden and pointer-events:none — it never intercepts input.
 */

import { DEFAULT_CONFIG, hydrateConfig, applyPatch } from './config.mjs';

/** One canvas overlay per window, like the expression overlay. */
const hosts = new WeakMap();

const INSTANCE_CAP = 262144;      // per-instance particle ceiling (512²)
const MIN_PARTICLES = 1024;       // 32² — the honest floor for small anchors

export async function createPointCloudHost(win, options = {}) {
  if (hosts.has(win)) throw new Error('One point-cloud host per window');
  const doc = win.document;
  const {
    maxInstances = 6,
    maxAllocatedParticles = 786432,
    onLost = () => {},
  } = options;

  // --- lazy heavy load: three + engine modules ---
  const [THREE, shaders, { createGlyphSampler }, { createGPGPUSimulator }, { createPointCloudField }] = await Promise.all([
    import('three'),
    import('./shaders.mjs'),
    import('./GlyphSampler.mjs'),
    import('./GPGPUSimulator.mjs'),
    import('./PointCloudField.mjs'),
  ]);

  const GlyphSampler = createGlyphSampler(THREE);
  const GPGPUSimulator = createGPGPUSimulator(THREE, shaders);
  const PointCloudField = createPointCloudField(THREE, shaders, GPGPUSimulator, GlyphSampler);

  const media = win.matchMedia('(prefers-reduced-motion: reduce)');

  const canvas = doc.createElement('canvas');
  canvas.className = 'oi-point-cloud-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  doc.body.append(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
  } catch (cause) {
    canvas.remove();
    throw new Error(`Point-cloud host could not create a WebGL context: ${cause}`);
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  /**
   * Verify a float render target by actually rendering into it and reading
   * back — WebGL version alone proves nothing. Returns the first type that
   * round-trips, or null when neither does (static fallback mode).
   */
  function verifyFloatType(type) {
    try {
      const rt = new THREE.WebGLRenderTarget(4, 4, {
        type,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const material = new THREE.ShaderMaterial({
        vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
        fragmentShader: 'void main(){ gl_FragColor = vec4(1.0, 0.5, 0.25, 1.0); }',
        depthTest: false,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      const buffer = new Float32Array(4 * 4 * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, 4, 4, buffer);
      material.dispose();
      rt.dispose();
      scene.clear();
      // Center pixel must be finite and approximately the written values.
      const r = buffer[(2 * 4 + 2) * 4 + 0], g = buffer[(2 * 4 + 2) * 4 + 1];
      return Number.isFinite(r) && Number.isFinite(g) && Math.abs(r - 1) < 0.05 && Math.abs(g - 0.5) < 0.05 ? type : null;
    } catch {
      return null;
    }
  }

  let floatType = verifyFloatType(THREE.FloatType);
  let mode = floatType ? 'live' : (() => {
    // WebGL1 half float lives in a different constant; try FloatType first
    // (already failed), then the half type both versions expose.
    floatType = verifyFloatType(THREE.HalfFloatType);
    return floatType ? 'live' : 'static-fallback';
  })();

  let dpr = Math.min(win.devicePixelRatio || 1, 2);
  let canvasWidth = 0, canvasHeight = 0;
  function syncCanvasSize() {
    dpr = Math.min(win.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    canvasWidth = win.innerWidth;
    canvasHeight = win.innerHeight;
    renderer.setSize(canvasWidth, canvasHeight, false);
  }
  syncCanvasSize();

  const sampler = new GlyphSampler();
  const instances = new Map(); // id -> record
  let nextSerial = 0;
  let raf = 0;
  let lastFrameTime = 0;
  let elapsed = 0;
  let frames = 0;
  let drewLastFrame = false;
  let disposed = false;
  let inkCache = null;

  const sumAllocated = () => [...instances.values()].reduce((total, record) => total + record.field.simulator.particleCount, 0);

  function resolveInk(colorMode) {
    if (colorMode === 'blackOnWhite') return '#0a0a0a';
    if (colorMode === 'whiteOnBlack') return '#f5f5f5';
    if (!inkCache) {
      const probe = win.getComputedStyle(doc.body).getPropertyValue('--oi-foreground').trim();
      inkCache = probe || '#0a0a0a';
    }
    return inkCache;
  }
  function refreshInk() {
    inkCache = null;
    for (const record of instances.values()) {
      record.field.setInk(resolveInk(record.field.config.colorMode));
    }
  }

  function ensureLoop() {
    if (disposed || mode !== 'live' || raf) return;
    if (!instances.size) return;
    if (doc.hidden) return;
    if (media.matches && ![...instances.values()].some((record) => record.forceMotion)) return;
    lastFrameTime = performance.now();
    raf = win.requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    if (disposed || mode !== 'live') return;
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05) || 0.016;
    lastFrameTime = now;
    elapsed += dt;
    frames++;

    // Batch geometry reads: one rect read per visible candidate per frame.
    const drawable = [];
    for (const record of instances.values()) {
      if (record.paused || record.released) continue;
      const rect = readRect(record);
      record.rect = rect;
      if (!rect || rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.top > win.innerHeight || rect.right < 0 || rect.left > win.innerWidth) continue;
      drawable.push(record);
    }

    if (drawable.length) {
      for (const record of drawable) {
        record.field.advance(dt, elapsed);
        noteResize(record);
      }
      renderer.setScissorTest(false);
      renderer.clear(true, false, false);
      renderer.setScissorTest(true);
      for (const record of drawable) {
        const rect = record.rect;
        record.field.resize(rect.width, rect.height, dpr);
        renderer.setViewport(rect.left, win.innerHeight - rect.bottom, rect.width, rect.height);
        renderer.setScissor(rect.left, win.innerHeight - rect.bottom, rect.width, rect.height);
        record.field.render();
      }
      renderer.setScissorTest(false);
      drewLastFrame = true;
    } else if (drewLastFrame) {
      // Everything left the viewport: erase the last frame before sleeping —
      // stale ink must not float over the UI.
      renderer.clear(true, false, false);
      drewLastFrame = false;
    }

    // Sleep when nothing needs animation; any wake calls ensureLoop().
    const anyMotion = drawable.length > 0 && (!media.matches || drawable.some((record) => record.forceMotion));
    if (anyMotion) raf = win.requestAnimationFrame(frame);
  }

  function readRect(record) {
    if (typeof record.target === 'function') {
      const rect = record.target();
      if (!rect) return null;
      return { left: rect.x ?? rect.left, top: rect.y ?? rect.top, width: rect.width, height: rect.height, right: (rect.x ?? rect.left) + rect.width, bottom: (rect.y ?? rect.top) + rect.height };
    }
    if (!record.target) {
      // Window scope: the field owns the whole viewport.
      return { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight, right: win.innerWidth, bottom: win.innerHeight };
    }
    if (!record.target.isConnected) return null;
    const rects = record.target.getClientRects();
    if (!rects.length) return null;
    const style = win.getComputedStyle(record.target);
    if (style.visibility === 'hidden' || style.display === 'none') return null;
    const box = record.target.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
  }

  /** Geometry-driven rebake: quantized so scrolling/typical jitter never
   * triggers one; debounced so a live resize costs at most one bake per
   * quiet moment. */
  function noteResize(record) {
    if (!record.rect) return;
    const bucket = Math.max(24, Math.round(Math.min(record.rect.width, record.rect.height) / 32) * 32);
    if (bucket === record.sizeBucket) return;
    record.sizeBucket = bucket;
    if (record.rebakeTimer) win.clearTimeout(record.rebakeTimer);
    record.rebakeTimer = win.setTimeout(() => {
      record.rebakeTimer = 0;
      if (!record.released && !disposed) {
        record.field.rebakeForSize(record.rect.width, record.rect.height);
        if (record.paused || media.matches) drawOnce(record);
      }
    }, 250);
  }

  function drawOnce(record) {
    if (disposed || mode !== 'live') return;
    const rect = record.rect ?? readRect(record);
    record.rect = rect;
    if (!rect || rect.width < 2 || rect.height < 2) {
      if (drewLastFrame) {
        renderer.setScissorTest(false);
        renderer.clear(true, false, false);
        drewLastFrame = false;
      }
      return;
    }
    record.field.advance(0.016, elapsed);
    renderer.setScissorTest(false);
    renderer.clear(true, false, false);
    renderer.setScissorTest(true);
    field_resize_and_draw(record, rect);
    renderer.setScissorTest(false);
    drewLastFrame = true;
  }

  function field_resize_and_draw(record, rect) {
    record.field.resize(rect.width, rect.height, dpr);
    renderer.setViewport(rect.left, win.innerHeight - rect.bottom, rect.width, rect.height);
    renderer.setScissor(rect.left, win.innerHeight - rect.bottom, rect.width, rect.height);
    record.field.render();
  }

  // Pointer sampling through the host/anchor — passive, never capturing.
  function localPointer(record, clientX, clientY) {
    const rect = record.rect ?? readRect(record);
    if (!rect) return;
    record.rect = rect;
    record.field.setPointer(clientX - rect.left - rect.width / 2, -(clientY - rect.top - rect.height / 2));
    if (record.paused) drawOnce(record); else ensureLoop();
  }
  function onElementPointer(record) {
    return (event) => {
      if (media.matches && !record.forceMotion) return;
      localPointer(record, event.clientX, event.clientY);
    };
  }
  function onWindowPointer(record) {
    return (event) => {
      if (media.matches && !record.forceMotion) return;
      if (event.target !== doc && record.target !== doc.body && !doc.body.contains(event.target)) return;
      localPointer(record, event.clientX, event.clientY);
    };
  }

  const bodyThemeObserver = new win.MutationObserver(() => refreshInk());
  bodyThemeObserver.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

  function onMotionChange() {
    if (media.matches) {
      // Respect the preference: settle to a single static frame.
      for (const record of instances.values()) if (!record.forceMotion && !record.paused) drawOnce(record);
    } else ensureLoop();
  }
  function onVisibility() {
    if (!doc.hidden) ensureLoop();
  }
  // Scroll and resize wake the scheduler: an instance whose rect left the
  // viewport let the loop sleep; its return must redraw it. Capture-phase
  // scroll catches every inner scroll container.
  function onWake() {
    if (disposed || mode !== 'live') return;
    ensureLoop();
  }
  function onResize() {
    if (disposed || mode !== 'live') return;
    syncCanvasSize();
    ensureLoop();
  }
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('scroll', onWake, { capture: true, passive: true });
  win.addEventListener('resize', onResize, { passive: true });
  media.addEventListener('change', onMotionChange);

  function onContextLost(event) {
    event.preventDefault();
    mode = 'context-lost';
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    onLost(new Error('The expression renderer lost its WebGL context; the field is paused'));
  }
  canvas.addEventListener('webglcontextlost', onContextLost);

  const host = {
    canvas,
    get mode() { return mode; },
    get floatType() { return floatType === THREE.FloatType ? 'float32' : floatType ? 'float16' : 'none'; },
    get reducedMotion() { return media.matches; },

    /**
     * Create an instance. `target` is an element (its rect is read per
     * frame), a rect function, or omitted for window scope. `config` is a
     * partial config over the desktop defaults. `pointer` selects the
     * passive sampling surface. Throws when the aggregate budget cannot fit
     * even the minimum allocation.
     */
    createInstance({ id, tag, target, config = {}, pointer = 'element', forceMotion = false, paused = false }) {
      if (disposed) throw new Error('The point-cloud host is disposed');
      if (instances.has(id)) throw new Error(`Instance ${id} already exists`);
      if (instances.size >= maxInstances) throw new Error(`The expression instance budget (${maxInstances}) is full`);
      if (mode !== 'live') {
        // Honest static fallback: register a stub so callers keep working,
        // and report it as such.
        const record = {
          id, tag, target: target ?? null, pointer: null, field: null,
          paused: true, released: false, forceMotion, stub: true,
        };
        instances.set(id, record);
        return this.instance(record);
      }

      const hydrated = hydrateConfig(config);
      const requested = Math.max(MIN_PARTICLES, Math.min(INSTANCE_CAP, Math.round(hydrated.particleCount)));
      const others = sumAllocated();
      let allocated = requested;
      const nearestFit = (count) => { const side = Math.ceil(Math.sqrt(count)); let tex = 32; for (const step of [32, 48, 64, 96, 128, 192, 256, 384, 512]) { if (side <= step) { tex = step; break; } tex = step; } return tex * tex; };
      while (others + nearestFit(allocated) > maxAllocatedParticles && allocated > MIN_PARTICLES) {
        allocated = Math.max(MIN_PARTICLES, Math.floor(allocated / 2));
      }
      if (others + nearestFit(allocated) > maxAllocatedParticles) {
        throw new Error(`The expression particle budget (${maxAllocatedParticles}) is exhausted`);
      }
      hydrated.particleCount = allocated;

      const record = {
        id, tag, target: target ?? null, pointer,
        paused: Boolean(paused), released: false, forceMotion: Boolean(forceMotion),
        sizeBucket: 0, rebakeTimer: 0, rect: null, stub: false,
      };
      record.field = new PointCloudField({
        renderer,
        config: hydrated,
        sampler,
        floatType,
        worldScale: target && target.getBoundingClientRect ? PointCloudField.worldScaleForSize(target.getBoundingClientRect().width, target.getBoundingClientRect().height) : 0.85,
      });
      record.field.resize(win.innerWidth, win.innerHeight, dpr);
      record.field.setInk(resolveInk(hydrated.colorMode));
      instances.set(id, record);

      if (pointer === 'element' && target?.isConnected) {
        record.onMove = onElementPointer(record);
        record.onLeave = () => record.field.clearPointer();
        target.addEventListener('pointermove', record.onMove, { passive: true });
        target.addEventListener('pointerleave', record.onLeave, { passive: true });
      } else if (pointer === 'window') {
        record.onMove = onWindowPointer(record);
        record.onLeave = () => record.field.clearPointer();
        win.addEventListener('pointermove', record.onMove, { passive: true });
        doc.documentElement.addEventListener('pointerleave', record.onLeave, { passive: true });
      }

      if (record.paused || (media.matches && !forceMotion)) drawOnce(record);
      else ensureLoop();
      return this.instance(record);
    },

    instance(record) {
      const api = {
        id: record.id,
        pause(value = true) {
          record.paused = Boolean(value);
          if (record.paused) drawOnce(record); else ensureLoop();
          return api;
        },
        resume() { return api.pause(false); },
        renderOnce() { drawOnce(record); return api; },
        reset() { record.field?.reset(); drawOnce(record); return api; },
        disperse(x = 0, y = 0, strength = 3) {
          record.field?.triggerDisperse(x, y, strength);
          if (record.paused || (media.matches && !record.forceMotion)) drawOnce(record); else ensureLoop();
          return api;
        },
        update(patch) {
          if (record.stub || record.released) return 'none';
          const next = applyPatch(record.field.config, patch);
          // morphProgress is live state: a manual progress moves the running
          // field, not only the stored config.
          if (patch && patch.morphProgress !== undefined && !next.autoMorph) record.field.setMorphProgress(patch.morphProgress);
          const classification = record.field.updateConfig(next);
          record.field.setInk(resolveInk(next.colorMode));
          if (record.paused || (media.matches && !record.forceMotion)) drawOnce(record); else ensureLoop();
          return classification;
        },
        release() {
          if (record.released) return;
          record.released = true;
          if (record.rebakeTimer) { win.clearTimeout(record.rebakeTimer); record.rebakeTimer = 0; }
          if (record.onMove) {
            if (record.pointer === 'window') {
              win.removeEventListener('pointermove', record.onMove);
              doc.documentElement.removeEventListener('pointerleave', record.onLeave);
            } else if (record.target?.isConnected) {
              record.target.removeEventListener('pointermove', record.onMove);
              record.target.removeEventListener('pointerleave', record.onLeave);
            }
            record.onMove = undefined; record.onLeave = undefined;
          }
          record.field?.dispose();
          instances.delete(record.id);
          refreshInk();
          drawAllOnce();
        },
        inspect() {
          return {
            id: record.id,
            tag: record.tag,
            mode: record.stub ? 'static-fallback' : 'live',
            paused: record.paused,
            requestedParticles: record.field?.config.particleCount ?? 0,
            allocatedParticles: record.field?.simulator.particleCount ?? 0,
            texWidth: record.field?.simulator.texWidth ?? 0,
            texHeight: record.field?.simulator.texHeight ?? 0,
            ...(record.field?.inspect() ?? {}),
          };
        },
      };
      return api;
    },

    /** One clear + redraw pass over all instances (used after releases and
     * in static mode). */
    renderAll() { drawAllOnce(); },

    refreshTheme: refreshInk,

    inspect() {
      return {
        mode,
        floatType: floatType === THREE.FloatType ? 'float32' : floatType ? 'float16' : 'none',
        frames,
        instances: [...instances.values()].map((record) => ({
          id: record.id, tag: record.tag, paused: record.paused,
          glyph: record.field?.config.glyph ?? null,
          requestedParticles: record.field?.config.particleCount ?? 0,
          allocatedParticles: record.field?.simulator.particleCount ?? 0,
          texWidth: record.field?.simulator.texWidth ?? 0,
          texHeight: record.field?.simulator.texHeight ?? 0,
        })),
        allocatedParticles: sumAllocated(),
        particleBudget: maxAllocatedParticles,
        instanceBudget: maxInstances,
        dpr,
        canvas: { width: canvasWidth, height: canvasHeight },
        reducedMotion: media.matches,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      for (const record of [...instances.values()]) host.releaseInstance(record.id);
      bodyThemeObserver.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('scroll', onWake, { capture: true });
      win.removeEventListener('resize', onResize);
      media.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      sampler.destroy();
      renderer.dispose();
      canvas.remove();
      hosts.delete(win);
    },
  };

  function drawAllOnce() {
    if (disposed || mode !== 'live' || !instances.size) {
      if (mode === 'live') { renderer.setScissorTest(false); renderer.clear(true, false, false); }
      return;
    }
    renderer.setScissorTest(false);
    renderer.clear(true, false, false);
    renderer.setScissorTest(true);
    for (const record of instances.values()) {
      if (record.stub || record.released) continue;
      const rect = readRect(record);
      record.rect = rect;
      if (!rect || rect.width < 2 || rect.height < 2) continue;
      record.field.advance(0.016, elapsed);
      field_resize_and_draw(record, rect);
    }
    renderer.setScissorTest(false);
  }

  // Released instances are removed through the same public door.
  host.releaseInstance = (id) => {
    const record = instances.get(id);
    if (record) host.instance(record).release();
  };

  hosts.set(win, host);
  ensureLoop();
  return host;
}
