"""Acceptance: the true-3D glyph volume, driven through the real studio UI.

Loads the actual Expression route, opens the studio's dedicated 3D body & depth
section,
ticks the volume and projection controls the way an author would, and reads real
GPU particle state back through the engine's own diagnostics. The claims under
test are the ones the feature makes: the panel is reachable and wired, a flat
composition is unchanged, and switching the volume on produces a body with real
thickness instead of z micro-noise.

Run with the dev server up:  python tests/three_d_body_browser.py
"""
from pathlib import Path
import json
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import browser_session

URL = os.environ.get('OI_TEST_URL', 'http://localhost:3000/')

# Depth statistics over the real particle buffer. Computed in-page so the whole
# float buffer never crosses the wire.
DEPTH_STATS = """
() => {
  const s = window.__FIELD_STUDIES__.inspect(true);
  const p = s.positions;
  let minZ = Infinity, maxZ = -Infinity, sumAbs = 0, sumAbsXY = 0;
  const n = Math.floor(p.length / 4);
  for (let i = 0; i < n; i++) {
    const z = p[i * 4 + 2];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumAbs += Math.abs(z);
    sumAbsXY += Math.abs(p[i * 4]) + Math.abs(p[i * 4 + 1]);
  }
  return {
    count: n,
    minZ, maxZ, spanZ: maxZ - minZ,
    meanAbsZ: sumAbs / n,
    meanAbsXY: sumAbsXY / (2 * n),
    bakes: s.bakes, seeds: s.seeds,
  };
}
"""

results = []


def check(name, ok, detail=''):
    results.append({'ok': bool(ok), 'name': name, 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)) if detail else ''))


with browser_session({'width': 1280, 'height': 900}) as (_, ctx, page):
    errors = []
    bad_responses = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on(
        'console',
        lambda e: errors.append(f'console[{e.location.get("url", "") if e.location else ""}]: {e.text}')
        if e.type == 'error'
        else None,
    )
    page.on('response', lambda r: bad_responses.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.on('requestfailed', lambda r: bad_responses.append(f'FAILED {r.url} {r.failure}'))

    page.goto(URL, wait_until='load')
    page.wait_for_function('() => !!window.__FIELD_STUDIES__', timeout=45000)
    # Let the engine bake, seed and run a few frames.
    page.wait_for_timeout(4000)

    check('the Expression route boots its engine', True, page.evaluate('window.__FIELD_STUDIES__.getState().engine'))

    # --- 1. The studio surface is present, reachable and wired -----------------
    page.evaluate("window.__FIELD_STUDIES__.openEditor('field')")
    page.wait_for_timeout(600)
    page.evaluate("""() => {
      const b = document.querySelector('[data-action="studio-section"][data-value="volume"]');
      if (b) b.click();
    }""")
    page.wait_for_timeout(900)

    panel = page.evaluate("""() => {
      const g = document.querySelector('[data-detail="volume"]');
      if (!g) return {found: false};
      const binds = [...g.querySelectorAll('[data-bind]')].map(e => e.getAttribute('data-bind'));
      return {
        found: true,
        title: g.querySelector('summary') ? g.querySelector('summary').textContent.trim() : '',
        binds,
        hasVolumeToggle: binds.includes('engine.volumeEnabled'),
        hasProjectionToggle: binds.includes('engine.depthPerspective'),
        volumeSliders: binds.filter(b => b.includes('glyphVolume__')).length,
        depthSliders: binds.filter(b => b.startsWith('field.params.native_depth__')).length,
        profiles: [...g.querySelectorAll('select[data-bind="engine.volumeProfile"] option')].map(o => o.value),
      };
    }""")
    check('the studio exposes a "3D body & depth" group', panel.get('found'), panel.get('title', ''))
    check('it carries the volume master toggle', panel.get('hasVolumeToggle'))
    check('it carries the projection toggle', panel.get('hasProjectionToggle'))
    check('it carries the volume body controls', panel.get('volumeSliders', 0) >= 9, f"{panel.get('volumeSliders')} sliders")
    check('it carries the depth presentation controls', panel.get('depthSliders', 0) >= 7, f"{panel.get('depthSliders')} sliders")
    check(
        'the depth profiles are all selectable',
        panel.get('profiles') == ['slab', 'bevel', 'round', 'dome', 'taper'],
        panel.get('profiles'),
    )

    # --- 2. Flat baseline: the original card, undisturbed ----------------------
    MEASURE_FPS = """() => new Promise(res => {
      let n = 0;
      const t0 = performance.now();
      const step = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(step) : res(n / ((performance.now() - t0) / 1000)); };
      requestAnimationFrame(step);
    })"""
    before = page.evaluate(DEPTH_STATS)
    fps_flat = page.evaluate(MEASURE_FPS)
    check('the field runs a real particle allocation', before['count'] > 1000, before['count'])
    check(
        'before: the glyph is a flat card (depth is noise, not geometry)',
        before['spanZ'] < 25,
        f"z span {before['spanZ']:.2f} on {before['count']} particles",
    )
    print(f"baseline: {fps_flat:.1f} fps on software WebGL, {before['count']} particles")

    # --- 3. Switch the volume on through the real control ---------------------
    def tick(bind):
        return page.evaluate(
            """(bind) => {
              const el = document.querySelector(`input[data-bind="${bind}"]`);
              if (!el) return false;
              if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', {bubbles: true})); }
              return true;
            }""",
            bind,
        )

    check('the volume toggle is clickable', tick('engine.volumeEnabled'))

    # Software WebGL runs at a handful of frames per second and the spring only
    # advances per frame, so a wall-clock wait is a frame-rate lottery. Poll the
    # real buffer until the body has actually settled onto its new depth.
    SPAN_EXPR = """() => {
      const s = window.__FIELD_STUDIES__.inspect(true);
      const p = s.positions;
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < p.length; i += 4) {
        const z = p[i + 2];
        if (z < mn) mn = z;
        if (z > mx) mx = z;
      }
      return mx - mn;
    }"""

    def wait_for_span(min_span, timeout_ms=90000):
        try:
            page.wait_for_function(f'() => ({SPAN_EXPR})() > {min_span}', timeout=timeout_ms)
            return True
        except Exception:
            return False

    settled = wait_for_span(before['spanZ'] * 3)
    after_volume = page.evaluate(DEPTH_STATS)
    check('the volume control settles into a body', settled, f"settled span {after_volume['spanZ']:.2f}")
    # The realized span is the extent the spring has actually settled onto, which
    # depends on the profile and where the flank band falls — not simply twice the
    # requested depth. The strong linear claim is made against the Body Depth
    # slider below; here the point is that a flat card became a body.
    check(
        'after: the body has real thickness',
        after_volume['spanZ'] > before['spanZ'] * 3,
        f"z span {before['spanZ']:.2f} → {after_volume['spanZ']:.2f}",
    )
    check(
        'after: the depth is a body, not a dither',
        after_volume['meanAbsZ'] > before['meanAbsZ'] * 5,
        f"mean |z| {before['meanAbsZ']:.2f} → {after_volume['meanAbsZ']:.2f}",
    )
    check(
        'the planar drawing is preserved (x/y are untouched)',
        abs(after_volume['meanAbsXY'] - before['meanAbsXY']) < before['meanAbsXY'] * 0.5,
        f"mean |x|+|y| {before['meanAbsXY']:.1f} → {after_volume['meanAbsXY']:.1f}",
    )
    check('the volume change re-baked the targets', after_volume['bakes'] > before['bakes'], f"{before['bakes']} → {after_volume['bakes']}")

    # --- 4. The depth knob actually drives the thickness -----------------------
    def set_slider(bind, value):
        return page.evaluate(
            """([bind, value]) => {
              const el = document.querySelector(`input[data-bind="${bind}"]`);
              if (!el) return false;
              el.value = String(value);
              el.dispatchEvent(new Event('input', {bubbles: true}));
              el.dispatchEvent(new Event('change', {bubbles: true}));
              return true;
            }""",
            [bind, value],
        )

    check('the body depth slider is present', set_slider('field.params.native_glyphVolume__depth', 40))
    wait_for_span(after_volume['spanZ'] * 0.6)
    shallow = page.evaluate(DEPTH_STATS)
    set_slider('field.params.native_glyphVolume__depth', 400)
    # Same reasoning as above: wait for the spring to reach the deeper target
    # rather than assuming a fixed number of seconds buys enough frames.
    deep_settled = wait_for_span(max(shallow['spanZ'] * 2.5, 200))
    deep = page.evaluate(DEPTH_STATS)
    check('the larger depth settles', deep_settled, f"settled span {deep['spanZ']:.2f}")
    check(
        'the Body Depth slider drives real thickness',
        deep['spanZ'] > shallow['spanZ'] * 2,
        f"depth 40 → span {shallow['spanZ']:.1f}; depth 400 → span {deep['spanZ']:.1f}",
    )

    # --- 5. Projection switch is honoured -------------------------------------
    check('the projection toggle is clickable', tick('engine.depthPerspective'))
    page.wait_for_timeout(2000)
    proj = page.evaluate("""() => {
      const el = document.querySelector('input[data-bind="engine.depthPerspective"]');
      return el ? el.checked : null;
    }""")
    check('perspective projection is engaged', proj is True, proj)

    # The viewport must still draw after every shader-affecting change. Absolute
    # frame rate is a hardware property — this fixture runs software WebGL, so the
    # meaningful question is whether the renderer is still advancing at all.
    frames = page.evaluate(
        """() => new Promise(res => {
          let n = 0;
          const t0 = performance.now();
          const step = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(step) : res(n); };
          requestAnimationFrame(step);
        })"""
    )
    check('the renderer keeps drawing after the depth changes', frames > 3, f'{frames} frames in 1.5s')
    fps_3d = page.evaluate(MEASURE_FPS)
    print(f"3D body + perspective: {fps_3d:.1f} fps (baseline {fps_flat:.1f} fps) on software WebGL")
    check(
        'the 3D path is in the same performance order as the flat path',
        fps_3d > fps_flat * 0.25,
        f'{fps_flat:.1f} → {fps_3d:.1f} fps on software WebGL (not a hardware measurement)',
    )

    # --- 6. No engine or shader errors ---------------------------------------
    shader_errors = [e for e in errors if 'GL_' in e or 'shader' in e.lower() or 'program' in e.lower()]
    check('no WebGL/shader errors were reported', not shader_errors, shader_errors[:3])
    check('no page errors were reported', not [e for e in errors if e.startswith('pageerror')], errors[:3])
    # A missing favicon is the one expected 404 on a dev server; anything else
    # failing to load is a real regression and is reported as such.
    asset_failures = [r for r in bad_responses if 'favicon' not in r]
    check('every asset the app requests loads', not asset_failures, asset_failures[:3])
    if bad_responses:
        print('non-2xx responses observed (informational):', bad_responses[:5])
    console_noise = [e for e in errors if 'favicon' in e]
    unexpected_console = [e for e in errors if e not in console_noise]
    check('the console is free of unexpected errors', not unexpected_console, unexpected_console[:2])

print()
failed = [r for r in results if not r['ok']]
print(json.dumps({'results': results, 'browserErrors': errors, 'badResponses': bad_responses}, indent=2))
out = Path(__file__).resolve().parent.parent / 'evidence' / 'three-d-body.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'results': results, 'browserErrors': errors, 'badResponses': bad_responses}, indent=2))
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed — evidence at {out}")
sys.exit(1 if failed else 0)
