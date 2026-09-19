"""Acceptance: the true-3D body applies to image sources — the twelve-mask study.

Loads the studio's real "Twelve faces · one mask" expression (twelve scenes,
each an image-sourced formation), and drives the dedicated 3D body & depth
section the way an author would. The claims under test are the ones the
uniformity law makes: an image mask sampled while the volume is off stays a
flat card, switching the volume on gives the already-loaded mask a real body
without re-uploading it, and a second mask scene gains the same body.

Run with the dev server up:  python tests/three_d_source_body_browser.py
"""
from pathlib import Path
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import browser_session

URL = os.environ.get('OI_TEST_URL', 'http://localhost:3000/') + '#library'

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

SPAN_EXPR = """
() => {
  const s = window.__FIELD_STUDIES__.inspect(true);
  const p = s.positions;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < p.length; i += 4) {
    const z = p[i + 2];
    if (z < mn) mn = z;
    if (z > mx) mx = z;
  }
  return mx - mn;
}
"""

results = []


def check(name, ok, detail=''):
    results.append({'ok': bool(ok), 'name': name, 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)) if detail else ''))


def wait_for_span(page, min_span, timeout_ms=120000):
    try:
        page.wait_for_function(f'() => ({SPAN_EXPR})() > {min_span}', timeout=timeout_ms)
        return True
    except Exception:
        return False


with browser_session({'width': 1280, 'height': 900}) as (_, ctx, page):
    errors = []
    bad_responses = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('response', lambda r: bad_responses.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.on('requestfailed', lambda r: bad_responses.append(f'FAILED {r.url} {r.failure}'))

    page.goto(URL, wait_until='load')
    page.wait_for_function('() => !!window.__FIELD_STUDIES__', timeout=45000)

    # --- 1. Open the twelve-mask study through the library ---------------------
    opened = page.evaluate("""() => {
      const b = document.querySelector('[data-action="start-mode"][data-id="source-twelve-faces"]');
      if (!b) return false;
      b.click();
      return true;
    }""")
    check('the twelve-mask study is a library starting point', opened)
    if not opened:
        sys.exit(1)
    page.wait_for_function(
        "() => window.__FIELD_STUDIES__.getState().engine === 'Native particle field'", timeout=45000)
    page.wait_for_timeout(6000)

    scene_name = page.evaluate("window.__FIELD_STUDIES__.getDocument().scenes[0].name")
    entity_source = page.evaluate(
        "() => window.__FIELD_STUDIES__.getDocument().scenes[0].entities[0].source?.kind")
    check('the loaded scene is an image-mask formation', entity_source == 'image',
          f'{scene_name} · source={entity_source}')

    # --- 2. Flat baseline: the mask was sampled with the volume off ------------
    before = page.evaluate(DEPTH_STATS)
    check('the field runs a real particle allocation', before['count'] > 1000, before['count'])
    check(
        'before: the sampled mask is a flat card',
        before['spanZ'] < 25,
        f"z span {before['spanZ']:.2f} on {before['count']} particles",
    )

    # --- 3. Switch the volume on through the real control ----------------------
    page.evaluate("window.__FIELD_STUDIES__.openEditor('field')")
    page.wait_for_timeout(600)
    section = page.evaluate("""() => {
      const b = document.querySelector('[data-action="studio-section"][data-value="volume"]');
      if (b) b.click();
      return !!b;
    }""")
    check('the 3D body & depth section opens', section)
    page.wait_for_timeout(900)

    ticked = page.evaluate("""() => {
      const el = document.querySelector('input[data-bind="engine.volumeEnabled"]');
      if (!el) return false;
      if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', {bubbles: true})); }
      return true;
    }""")
    check('the volume toggle is clickable', ticked)

    # The mask was loaded while the law was off, so this proves the engine
    # re-derives its retained source pools — no re-upload, no reseed ritual.
    settled = wait_for_span(page, max(before['spanZ'] * 3, 30))
    after_volume = page.evaluate(DEPTH_STATS)
    check('the volume control settles the mask into a body', settled,
          f"settled span {after_volume['spanZ']:.2f}")
    check(
        'after: the image mask has real thickness',
        after_volume['spanZ'] > before['spanZ'] * 3 and after_volume['spanZ'] > 30,
        f"z span {before['spanZ']:.2f} → {after_volume['spanZ']:.2f}",
    )
    check(
        'after: the depth is a body, not a dither',
        after_volume['meanAbsZ'] > before['meanAbsZ'] * 3,
        f"mean |z| {before['meanAbsZ']:.2f} → {after_volume['meanAbsZ']:.2f}",
    )
    check(
        'the planar sampling is preserved (x/y are untouched)',
        abs(after_volume['meanAbsXY'] - before['meanAbsXY']) < before['meanAbsXY'] * 0.5,
        f"mean |x|+|y| {before['meanAbsXY']:.1f} → {after_volume['meanAbsXY']:.1f}",
    )
    check(
        'the volume change re-baked the mask targets',
        after_volume['bakes'] > before['bakes'],
        f"{before['bakes']} → {after_volume['bakes']}",
    )

    # --- 4. A second mask of the twelve gains the same body --------------------
    # The toggle is a per-scene engine setting, so scene VI starts flat again —
    # this mask is then sampled with the law already on, the fresh-load twin of
    # scene I's toggle-after-load path.
    page.evaluate("window.__FIELD_STUDIES__.setScene(5)")
    page.wait_for_timeout(3000)
    second_name = page.evaluate("window.__FIELD_STUDIES__.getDocument().scenes[5].name")
    # Not asserted: the 2.5s scene transition is still settling here, so the
    # span carries over particles from scene I's body. Scene I pins the flat
    # baseline; scene VI only has to prove the fresh-load path extrudes.
    second_ticked = page.evaluate("""() => {
      const el = document.querySelector('input[data-bind="engine.volumeEnabled"]');
      if (!el) return false;
      if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', {bubbles: true})); }
      return true;
    }""")
    check('the second scene carries its own volume toggle', second_ticked)
    second = wait_for_span(page, 30, timeout_ms=90000)
    second_stats = page.evaluate(DEPTH_STATS)
    check(f'the second mask ({second_name}) extrudes too', second and second_stats['spanZ'] > 30,
          f"z span {second_stats['spanZ']:.2f}")

    # --- 5. No engine or shader errors ----------------------------------------
    shader_errors = [e for e in errors if 'GL_' in e or 'shader' in e.lower() or 'program' in e.lower()]
    check('no WebGL/shader errors were reported', not shader_errors, shader_errors[:3])
    check('no page errors were reported', not [e for e in errors if e.startswith('pageerror')], errors[:3])
    asset_failures = [r for r in bad_responses if 'favicon' not in r]
    check('every asset the app requests loads', not asset_failures, asset_failures[:3])

failed = [r for r in results if not r['ok']]
print()
print(f"{len(results)} checks — {len(results) - len(failed)} passed, {len(failed)} failed")
if failed:
    for r in failed:
        print('  FAILED:', r['name'], '—', r['detail'])
    sys.exit(1)
