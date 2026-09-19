"""Manual verification: scene transport, automation-editor transport, physics pause.

Run with the dev server up:  /usr/local/bin/python3 tests/verify_studio_ux.py
"""
from pathlib import Path
import json, os, sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import browser_session

URL = os.environ.get('OI_TEST_URL', 'http://localhost:4173/')
results = []

def check(name, ok, detail=''):
    results.append({'ok': bool(ok), 'name': name, 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)) if detail else ''))

def click_section(page, value):
    page.evaluate(f"""() => {{
      const b = document.querySelector('[data-action="studio-section"][data-value="{value}"]');
      if (b) b.click();
    }}""")

def section_current(page):
    return page.evaluate("""() => document.querySelector('[data-action="studio-section"][aria-current="page"]')?.dataset.value ?? null""")

def state(page):
    return page.evaluate("() => window.__FIELD_STUDIES__.getState()")

with browser_session({'width': 1280, 'height': 900}) as (_, ctx, page):
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(URL, wait_until='load')
    page.wait_for_function('() => !!window.__FIELD_STUDIES__', timeout=45000)
    page.wait_for_timeout(3000)

    # ---- 0. The ad-hoc studio transport is gone -------------------------------
    check('the studio header has no ad-hoc automation button',
          page.evaluate("() => !document.getElementById('studio-play') && !document.getElementById('automation-loop')"))

    # ---- 1. The field breathes without any transport press --------------------
    sim_a = state(page)['simTime']
    page.wait_for_timeout(600)
    sim_b = state(page)['simTime']
    check('physics and morph run by default, with nothing playing', sim_b > sim_a, f'{sim_a:.2f} → {sim_b:.2f}')
    check('the scene playhead starts held', not state(page)['scenePlaying'])

    # ---- 2. Menu memory: open, move somewhere, scroll, close, reopen ----------
    page.evaluate("""() => document.querySelector('[data-action="studio"]').click()""")
    page.wait_for_timeout(400)
    first = section_current(page)
    check('first studio open lands on a section', first is not None, first)
    click_section(page, 'resonance')
    page.wait_for_timeout(300)
    page.evaluate("""() => { document.getElementById('inspector-content').scrollTop = 340; }""")
    page.wait_for_timeout(300)
    scroll_before = page.evaluate("() => document.getElementById('inspector-content').scrollTop")
    page.evaluate("""() => document.querySelector('[data-action="close-studio"]').click()""")
    page.wait_for_timeout(300)
    page.evaluate("""() => document.querySelector('[data-action="studio"]').click()""")
    page.wait_for_timeout(400)
    check('reopen returns to the same studio section', section_current(page) == 'resonance', section_current(page))
    scroll_after = page.evaluate("() => document.getElementById('inspector-content').scrollTop")
    check('reopen restores the scroll position', abs(scroll_after - scroll_before) <= 30, f'{scroll_before} → {scroll_after}')

    # ---- 3. 3D body & depth has its own section ------------------------------
    click_section(page, 'volume')
    page.wait_for_timeout(300)
    vol = page.evaluate("""() => {
      const g = document.querySelector('[data-detail="volume"]');
      return {present: !!g, binds: g ? [...g.querySelectorAll('[data-bind]')].map(e => e.getAttribute('data-bind')) : []};
    }""")
    check('the volume group lives in its own section', vol['present'])
    check('it still carries the volume master toggle', 'engine.volumeEnabled' in vol['binds'])
    click_section(page, 'appearance')
    page.wait_for_timeout(300)
    app_now = page.evaluate("""() => ({
      volume: !!document.querySelector('[data-detail="volume"]'),
      palette: !!document.querySelector('[data-detail="palette"]'),
      material: !!document.querySelector('[data-detail="material"]'),
    })""")
    check('Colour & material no longer contains the 3D group', not app_now['volume'], app_now)

    # ---- 4. Pause physics: the deep studio option ----------------------------
    click_section(page, 'physics')
    page.wait_for_timeout(300)
    page.evaluate("""() => {
      const el = document.getElementById('pause-physics');
      el.checked = true;
      el.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_timeout(200)
    sim_a = state(page)['simTime']
    page.wait_for_timeout(700)
    sim_b = state(page)['simTime']
    st = state(page)
    check('Pause physics freezes the field', st['fieldPaused'] and sim_b == sim_a, f'sim held at {sim_b:.2f}')
    page.evaluate("""() => {
      const el = document.getElementById('pause-physics');
      el.checked = false;
      el.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_timeout(700)
    sim_c = state(page)['simTime']
    check('lifting Pause physics releases the field', sim_c > sim_b, f'{sim_b:.2f} → {sim_c:.2f}')

    # ---- 5. The transport plays the scene — and only the scene ----------------
    # Shorten the scene so its end is reachable.
    click_section(page, 'scene')
    page.wait_for_timeout(300)
    page.evaluate("""() => {
      const el = document.querySelector('input[data-bind="duration"]');
      el.value = '2.5';
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_timeout(300)
    sim_a = state(page)['simTime']
    page.evaluate("""() => document.getElementById('play-button').click()""")
    page.wait_for_timeout(400)
    st = state(page)
    check('play runs the scene', st['scenePlaying'] and st['playing'], st)
    sim_b = state(page)['simTime']
    check('playing the scene never touches the physics clock', sim_b > sim_a, f'sim {sim_a:.2f} → {sim_b:.2f}')
    head_a = page.evaluate("() => document.getElementById('global-time').textContent")
    page.wait_for_timeout(800)
    head_b = page.evaluate("() => document.getElementById('global-time').textContent")
    check('the playhead advances while the scene plays', head_a != head_b, f'{head_a} → {head_b}')
    # The scene ends by itself and the transport returns to Play.
    try:
        page.wait_for_function("() => !window.__FIELD_STUDIES__.getState().scenePlaying", timeout=8000)
        ended = True
    except Exception:
        ended = False
    check('the scene stops at its end; the transport returns to Play', ended and not state(page)['scenePlaying'])
    icon_now = page.evaluate("() => document.getElementById('play-button').getAttribute('aria-label')")
    check('the transport reads Play again after the scene ends', icon_now == 'Play scene (Space)', icon_now)
    head_c = page.evaluate("() => document.getElementById('global-time').textContent")
    page.evaluate("""() => document.getElementById('play-button').click()""")
    page.wait_for_timeout(300)
    head_d = page.evaluate("() => document.getElementById('global-time').textContent")
    check('pressing Play again restarts the scene from its top', head_d.startswith('0.'), f'{head_c} → {head_d}')

    # ---- 6. The automation editor holds the automation transport -------------
    click_section(page, 'automation')
    page.wait_for_timeout(300)
    page.evaluate("""() => document.querySelector('[data-action="add-lane"]')?.click()""")
    page.wait_for_timeout(300)
    created = page.evaluate("""() => {
      const sel = document.getElementById('assignment-target');
      if (!sel) return false;
      sel.value = sel.options[0].value;
      sel.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector('[data-action="confirm-group-target"]')?.click();
      return true;
    }""")
    check('a new automation lane was authored', created)
    page.wait_for_timeout(400)
    lane = page.evaluate("""() => {
      const lane = window.__FIELD_STUDIES__.getDocument().scenes[0].automation.at(-1);
      return lane ? {id: lane.id, type: lane.type} : null;
    }""")
    page.evaluate("""(lane) => {
      const type = document.querySelector(`select[data-bind="lane.${lane.id}.type"]`);
      if (type) { type.value = 'ramp'; type.dispatchEvent(new Event('change', {bubbles: true})); }
      const dur = document.querySelector(`input[data-bind="lane.${lane.id}.duration"]`);
      if (dur) { dur.value = '1.2'; dur.dispatchEvent(new Event('input', {bubbles: true})); dur.dispatchEvent(new Event('change', {bubbles: true})); }
    }""", lane)
    page.wait_for_timeout(400)

    def lane_phase(page):
        return page.evaluate("""() => {
          const lane = window.__FIELD_STUDIES__.getDocument().scenes[0].automation.at(-1);
          const live = (window.__FIELD_STUDIES__.telemetry()?.live ?? []).find(v => v.id === (lane.nativeId ?? lane.id));
          return live ? {phase: live.phase, done: live.done} : null;
        }""")

    page.evaluate("""() => document.querySelector('[data-action="automation-play"]').click()""")
    page.wait_for_timeout(400)
    ph = lane_phase(page)
    check('the editor transport plays the automations', ph is not None and not ph['done'], ph)
    check('editor play re-enabled and fired the lane',
          page.evaluate("() => window.__FIELD_STUDIES__.getDocument().scenes[0].automation.at(-1).enabled"))

    page.evaluate("""() => document.querySelector('[data-action="automation-pause"]').click()""")
    page.wait_for_timeout(400)
    check('editor pause holds every group at base',
          not page.evaluate("() => window.__FIELD_STUDIES__.getDocument().scenes[0].automation.at(-1).enabled")
          and lane_phase(page) is None, lane_phase(page))

    # Loop latch: play, and the finished ramp re-arms itself.
    page.evaluate("""() => document.querySelector('[data-action="automation-play"]').click()""")
    page.evaluate("""() => document.querySelector('[data-action="automation-loop"]').click()""")
    page.wait_for_timeout(300)
    latch = page.evaluate("""() => document.querySelector('[data-action="automation-loop"]').getAttribute('aria-pressed')""")
    check('the loop latch reports on in the editor', latch == 'true', latch)
    trace = page.evaluate("""() => new Promise(res => {
      const lane = window.__FIELD_STUDIES__.getDocument().scenes[0].automation.at(-1);
      const nativeId = lane.nativeId ?? lane.id;
      const phases = [];
      const t0 = performance.now();
      const step = () => {
        const live = (window.__FIELD_STUDIES__.telemetry()?.live ?? []).find(v => v.id === nativeId);
        phases.push(live ? live.phase : -1);
        const wraps = phases.slice(1).filter((p, i) => p < 0.5 && phases[i] > 0.8).length;
        (wraps < 2 && performance.now() - t0 < 40000) ? setTimeout(step, 150) : res({phases, wraps, ms: performance.now() - t0});
      };
      step();
    })""")
    check('loop re-arms the finished ramp (phase wraps)', trace['wraps'] >= 2, f"{trace['wraps']} wraps in {trace['ms']:.0f}ms")

    # ---- 7. Health ------------------------------------------------------------
    check('no page errors were reported', not errors, errors[:3])

print()
failed = [r for r in results if not r['ok']]
print(json.dumps({'results': results}, indent=2))
sys.exit(1 if failed else 0)
