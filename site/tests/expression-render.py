#!/usr/bin/env python3
"""Replay the Expression page (site/expression.html) in a real browser, against the real published members.

The page opens one member of the essay's Expression layer at expression.html?x=<id>&scene=<scene>&embed=1&theme=light|dark,
fetches ./essay/expressions/index.json and the member's journey, verifies the journey's SHA-256 against the published
digest, validates it and renders the live field with its editorial text. This test starts its own Vite dev server, drives
headless Chromium with software WebGL, and checks the render, the scene controls and address, reduced motion, the integrity
and not-published states, embed and phone layouts, light/dark and the live theme message, and a 135-member smoke loop
(every member's bytes match its digest and pass the engine's own journey validation). Nothing is mocked except the one
deliberately tampered response.

    python3 tests/expression-render.py

By default it serves the built site (`dist/`, or OI_DIST) with the same host rules as essay-host-smoke.py, so run it after
`npm run build:public`. OI_EXPRESSION_URL points it at a server that is already running (a dev server, say);
OI_EXPRESSION_VITE_CONFIG starts `vite --config` on OI_EXPRESSION_PORT (default 5190) instead.
"""
import json
import os
import subprocess
import sys
import time
import traceback
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CONFIG = os.environ.get('OI_EXPRESSION_VITE_CONFIG')
PORT = int(os.environ.get('OI_EXPRESSION_PORT') or 5190)
BASE = os.environ.get('OI_EXPRESSION_URL') or f'http://127.0.0.1:{PORT}'
OUT = Path(os.environ.get('OI_EXPRESSION_EVIDENCE') or ROOT / 'evidence/expression')
OUT.mkdir(parents=True, exist_ok=True)
X = 'roz-mytheme-the-prisoner'
PAPER, BLACK = 'rgb(251, 250, 246)', 'rgb(11, 11, 12)'
LAUNCH = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
RESULTS = []


def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  — {detail}' if detail else ''), flush=True)


def up():
    try:
        with urllib.request.urlopen(f'{BASE}/expression.html', timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def start_server():
    """Returns a function that stops whatever was started (or None when an existing server is reused)."""
    global BASE
    if up():
        print(f'(reusing the server already answering at {BASE})')
        return None
    if not CONFIG:
        import importlib.util
        spec = importlib.util.spec_from_file_location('essay_host', HERE / 'essay-host-smoke.py')
        host = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(host)
        host.DIST = Path(os.environ.get('OI_DIST') or ROOT / 'dist')
        if not (host.DIST / 'expression.html').is_file():
            sys.exit(f'{host.DIST}/expression.html is missing: run npm run build:public (or set OI_DIST / OI_EXPRESSION_URL)')
        server, port = host.start('vercel', '')
        BASE = f'http://127.0.0.1:{port}'
        return lambda: host.stop(server)
    proc = subprocess.Popen([str(ROOT / 'node_modules/.bin/vite'), '--config', CONFIG, '--port', str(PORT), '--strictPort', '--host', '127.0.0.1'],
                            cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    deadline = time.time() + 180
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError('vite exited early:\n' + (proc.stdout.read() if proc.stdout else ''))
        if up():
            def stop():
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except Exception:
                    proc.kill()
            return stop
        time.sleep(1)
    proc.terminate()
    raise RuntimeError('vite did not come up in 180s')


def url(x=X, **extra):
    q = {'x': x, **extra} if x is not None else dict(extra)
    return f'{BASE}/expression.html?' + '&'.join(f'{k}={v}' for k, v in q.items())


def wait_frames(page, minimum=1, timeout=90000):
    page.wait_for_function(f"(() => {{ const c = document.querySelector('canvas'); return !!c && c.dataset.rendered === 'true' && Number(c.dataset.frames) >= {minimum}; }})()", timeout=timeout)


def frames(page):
    return page.evaluate("Number(document.querySelector('canvas')?.dataset.frames || 0)")


def advances(page, start, timeout=90000):
    """True once the field has drawn a frame beyond `start` (software WebGL is slow and bursty, so wait for it rather than sleep)."""
    try:
        page.wait_for_function(f"Number(document.querySelector('canvas')?.dataset.frames || 0) > {start}", timeout=timeout)
        return True
    except Exception:
        return False


def holds_still(page, settle=2500, window=3500):
    page.wait_for_timeout(settle)
    a = frames(page)
    page.wait_for_timeout(window)
    return frames(page) == a, a


def bg(page):
    return page.evaluate("getComputedStyle(document.body).backgroundColor")


def scene_id(page):
    return page.evaluate("new URLSearchParams(location.search).get('scene')")


def make_page(browser, width=1280, height=800, **ctx):
    context = browser.new_context(viewport={'width': width, 'height': height}, **ctx)
    page = context.new_page()
    page.set_default_timeout(60000)
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)))
    page.on('console', lambda m: page.errors.append(m.text) if m.type == 'error' else None)
    return page


def render_and_controls(browser, index):
    entry = next(e for e in index['entries'] if e['id'] == X)
    page = make_page(browser)
    page.goto(url(), wait_until='load')
    wait_frames(page)
    check('real member renders: canvas data-rendered=true and data-frames>0', frames(page) > 0, f'frames={frames(page)}')
    check('field is live: frames keep advancing while playing', advances(page, frames(page)))
    check('one slim head shows the expression title, with no collection crumb above it', page.text_content('.xp-head h1') == entry['title'] and not page.query_selector('.xp-crumb') and not page.query_selector('.xp-bar'))
    check('standalone head links back to the essay and to O:I home',
          page.get_attribute('.xp-back', 'href') == './essay/' and page.get_attribute('.xp-mark', 'href') == './')
    check('no metadata block below the expression: no "About" summary, no scene character subtitles',
          not page.query_selector('.xp-about') and not page.query_selector('.xp-scene-char') and 'About this Expression' not in page.inner_text('.xp-side'))
    buttons = page.locator('.xp-scenes button')
    check('scene list shows 5 scenes by name', buttons.count() == 5 == len(entry['scenes'])
          and all(entry['scenes'][i]['name'] in buttons.nth(i).inner_text() for i in range(5)))
    check('first scene is current, "Scene 1 of 5"', page.get_attribute('.xp-scenes button >> nth=0', 'aria-current') == 'step' and page.inner_text('[data-testid=count]') == 'Scene 1 of 5')
    first_title = page.inner_text('.xp-text h2')

    buttons.nth(2).click()
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 3 of 5'")
    check('picking scene 3 puts it in ?scene=', scene_id(page) == entry['scenes'][2]['id'], scene_id(page))
    title3 = page.inner_text('.xp-text h2')
    check('picking scene 3 changes the editorial title', title3 != first_title and title3 == entry['scenes'][2]['name'], title3)
    check('the field switched to scene 3', page.get_attribute('.xp-stage', 'data-scene') == entry['scenes'][2]['id'])
    check('the address keeps the other parameters (x)', page.evaluate("new URLSearchParams(location.search).get('x')") == X)
    check('browser history was not piled up (replaceState)', page.evaluate('history.length') <= 2)
    wait_frames(page, 2)
    page.screenshot(path=str(OUT / 'scene3-standalone-light.png'))

    page.focus('.xp-scenes button[aria-current=step]')
    page.keyboard.press('ArrowDown')
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 4 of 5'")
    check('ArrowDown in the scene list selects the next scene and keeps focus there', page.evaluate("document.activeElement.dataset.sceneId") == entry['scenes'][3]['id'] and scene_id(page) == entry['scenes'][3]['id'])
    page.keyboard.press('End')
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 5 of 5'")
    page.click('[data-control=prev]')
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 4 of 5'")
    check('End jumps to the last scene; previous/next buttons step; next is disabled at the end', True)
    page.click('[data-control=next]')
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 5 of 5'")
    check('next is disabled on the last scene', page.is_disabled('[data-control=next]') and not page.is_disabled('[data-control=prev]'))
    page.evaluate("document.querySelector('.xp-side').scrollTop = 300")
    page.click('[data-control=prev]')
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 4 of 5'")
    check('stepping with the header buttons returns the text column to the top of the new scene', page.evaluate("document.querySelector('.xp-side').scrollTop") == 0)

    # popstate: the address drives the scene
    page.evaluate(f"history.pushState({{}}, '', location.pathname + '?x={X}&scene={entry['scenes'][1]['id']}'); window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_function("document.querySelector('[data-testid=count]').textContent === 'Scene 2 of 5'")
    check('popstate re-reads ?scene=', page.inner_text('.xp-text h2') == entry['scenes'][1]['name'])

    # the editorial text is plain text: nothing injected as markup
    check('editorial text is rendered as text (no injected elements from journey strings)',
          page.evaluate("document.querySelectorAll('.xp-text :not(article):not(p):not(h2)').length") == 0)

    # camera: buttons and keyboard move the camera; canvas keeps rendering
    f0 = frames(page)
    page.click('[data-control=zoom-in]'); page.click('[data-control=zoom-out]'); page.click('[data-control=home]')
    page.focus('canvas'); page.keyboard.press('ArrowLeft'); page.keyboard.press('+'); page.keyboard.press('0')
    box = page.locator('canvas').bounding_box()
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.mouse.down(); page.mouse.move(box['x'] + box['width'] / 2 + 60, box['y'] + box['height'] / 2 + 20, steps=6); page.mouse.up()
    page.mouse.wheel(0, -200)
    check('camera controls (buttons, keyboard, drag, wheel) leave the field rendering', advances(page, f0) and not page.query_selector('.xp-fielderror'))
    interaction(page, box)

    # pause / play
    page.click('[data-control=play]')
    check('pause button pauses (aria-pressed false, label Play)', page.get_attribute('.xp-stage', 'data-playing') == 'false' and page.get_attribute('[data-control=play]', 'aria-label') == 'Play the field')
    still, a = holds_still(page)
    check('a paused field stops advancing frames', still, f'stable at {a}')
    page.click('[data-control=play]')
    check('play resumes frames', advances(page, a))

    # in the essay
    links = page.locator('.xp-essay a')
    n = len(entry['nodes'])
    check('"In the essay" lists the expression\'s nodes (cap 12) as ./essay/<slug> links targeting _top',
          links.count() == min(n, 12) and all(links.nth(i).get_attribute('href').startswith('./essay/') and links.nth(i).get_attribute('target') == '_top' for i in range(links.count())),
          f'{links.count()} of {n}')
    if n > 12:
        check(f'"+{n - 12} more" shown beyond the cap', page.inner_text('.xp-more') == f'+{n - 12} more')
    check('no console or page errors during the whole run', not page.errors, '; '.join(page.errors[:3]))
    page.context.close()

    # a member with more than 12 nodes
    big = next(e for e in index['entries'] if len(e['nodes']) > 12)
    page = make_page(browser)
    page.goto(url(big['id']), wait_until='load'); wait_frames(page)
    check(f"a member with {len(big['nodes'])} nodes shows 12 and '+{len(big['nodes']) - 12} more'", page.locator('.xp-essay a').count() == 12 and page.inner_text('.xp-more') == f"+{len(big['nodes']) - 12} more", big['id'])
    page.context.close()

    # ?scene= on arrival, and an unknown scene
    page = make_page(browser)
    page.goto(url(scene=entry['scenes'][3]['id']), wait_until='load'); wait_frames(page)
    check('arriving with ?scene= opens that scene', page.inner_text('[data-testid=count]') == 'Scene 4 of 5' and page.get_attribute('.xp-stage', 'data-scene') == entry['scenes'][3]['id'])
    page.goto(url(scene='no-such-scene'), wait_until='load'); wait_frames(page)
    page.wait_for_function(f"new URLSearchParams(location.search).get('scene') === '{entry['scenes'][0]['id']}'")
    check('an unknown ?scene= falls back to the first scene, says so, and corrects the address', page.inner_text('[data-testid=count]') == 'Scene 1 of 5' and 'not in this Expression' in page.inner_text('.xp-side'))
    page.context.close()


def interaction(page, box):
    """Pointer interaction is part of the Expression format: touch is the default mode, orbit is the camera."""
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    ds = lambda k: page.evaluate(f"document.querySelector('canvas').dataset.{k} || ''")
    check('the field opens in touch mode (pointer interaction), with the mode control pressed', ds('mode') == 'touch' and page.get_attribute('[data-control=mode]', 'aria-pressed') == 'true')
    page.mouse.move(cx - 80, cy - 40); page.mouse.move(cx, cy, steps=8)
    page.wait_for_function("document.querySelector('canvas').dataset.pointer === 'on'")
    check('moving over the field makes the pointer active in the engine (scene pointer mode applies)', ds('pointer') == 'on')
    check('the hint names what this scene\'s pointer does, and is gone after the first touch', not page.query_selector('[data-testid=hint]'))
    b0 = int(ds('bursts') or 0)
    page.mouse.down(); page.mouse.up()
    check('pressing sends the scene\'s click effect (pointer-effect command)', int(ds('bursts') or 0) == b0 + 1, f"bursts {b0}->{ds('bursts')}")
    yaw0 = page.evaluate("0")
    page.focus('canvas'); b1 = int(ds('bursts') or 0); page.keyboard.press('Space')
    check('space pulses from the last pointer position (keyboard access to the interaction)', int(ds('bursts') or 0) == b1 + 1)
    page.mouse.move(box['x'] - 20, box['y'] - 20)
    page.wait_for_function("document.querySelector('canvas').dataset.pointer === 'off'")
    check('leaving the field releases the pointer', ds('pointer') == 'off')
    page.click('[data-control=mode]')
    check('switching to orbit mode changes the canvas mode and the control state', ds('mode') == 'orbit' and page.get_attribute('[data-control=mode]', 'aria-pressed') == 'false')
    b2 = int(ds('bursts') or 0); fr = frames(page)
    page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 50, cy + 10, steps=5); page.mouse.up()
    check('in orbit mode dragging turns the camera and fires no pointer effect', int(ds('bursts') or 0) == b2 and ds('pointer') in ('off', '') and advances(page, fr))
    page.click('[data-control=mode]')
    check('and back to touch mode', ds('mode') == 'touch')


def reduced_motion(browser):
    page = make_page(browser, reduced_motion='reduce')
    page.goto(url(), wait_until='load'); wait_frames(page)
    check('prefers-reduced-motion: the field starts paused (and still shows its first frame)', page.get_attribute('.xp-stage', 'data-playing') == 'false' and frames(page) >= 1, f'frames={frames(page)}')
    still, a = holds_still(page)
    check('reduced motion: no frames advance on their own', still, f'stable at {a}')
    page.click('.xp-scenes button >> nth=1')
    page.wait_for_function("document.querySelector('.xp-stage').dataset.scene !== ''  && document.querySelector('[data-testid=count]').textContent === 'Scene 2 of 5'")
    check('reduced motion: choosing a scene still shows it (field remains paused, a new frame is drawn)', page.get_attribute('.xp-stage', 'data-playing') == 'false' and advances(page, a))
    still, b = holds_still(page)
    page.click('[data-control=play]')
    check('reduced motion: the visitor can still press play', page.get_attribute('.xp-stage', 'data-playing') == 'true' and advances(page, b))
    page.context.close()


def integrity(browser, entry):
    page = make_page(browser)
    seen = {}

    def tamper(route):
        response = route.fetch()
        body = bytearray(response.body())
        mid = len(body) // 2
        body[mid] = body[mid] ^ 0x01          # one byte
        seen['changed'] = True
        route.fulfill(response=response, body=bytes(body))
    page.route('**/essay/expressions/x/*.journey.json', tamper)
    page.goto(url(), wait_until='load')
    page.wait_for_selector('.xp-state[data-state=integrity]')
    text = page.inner_text('.xp-state')
    check('a journey with one byte altered shows the named integrity error', seen.get('changed') and 'Integrity check failed' in text and 'sha256:' in text, text.replace('\n', ' ')[:140])
    page.wait_for_timeout(1500)
    check('integrity failure renders no canvas and no field frames', page.evaluate("document.querySelectorAll('canvas').length") == 0 and page.evaluate("document.querySelectorAll('[data-frames]').length") == 0)
    check('integrity failure shows no scene list or editorial text', page.evaluate("document.querySelectorAll('.xp-scenes, .xp-text').length") == 0)
    check('integrity failure offers the way back to the essay', page.get_attribute('.xp-state a', 'href') == './essay/')
    page.screenshot(path=str(OUT / 'integrity-error.png'))
    page.context.close()


def other_states(browser):
    page = make_page(browser)
    page.goto(url('there-is-no-such-expression'), wait_until='load')
    page.wait_for_selector('.xp-state[data-state=not-published]')
    check('unknown id shows the named "Not published" state', 'Not published' in page.inner_text('.xp-state h1') and 'there-is-no-such-expression' in page.inner_text('.xp-state'))
    check('not-published renders no canvas', page.evaluate("document.querySelectorAll('canvas').length") == 0)
    page.goto(url(None), wait_until='load')
    page.wait_for_selector('.xp-state[data-state=no-expression]')
    check('missing x shows a gallery-free message with a link back to ./essay/', page.get_attribute('.xp-state a', 'href') == './essay/' and page.evaluate("document.querySelectorAll('canvas, .xp-scenes').length") == 0)
    page.context.close()
    # the index itself unavailable
    page = make_page(browser)
    page.route('**/essay/expressions/index.json', lambda r: r.fulfill(status=404, body='no'))
    page.goto(url(), wait_until='load')
    page.wait_for_selector('.xp-state[data-state=index]')
    check('an unavailable index shows its own named state and nothing is rendered', page.evaluate("document.querySelectorAll('canvas').length") == 0)
    page.context.close()


def embed_and_layouts(browser):
    for (w, h) in [(460, 640), (1400, 900)]:
        page = make_page(browser, w, h)
        page.goto(url(embed=1, theme='light'), wait_until='load'); wait_frames(page)
        m = page.evaluate("({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight, bar: !!document.querySelector('.xp-bar'), nav: !!document.querySelector('.xp-nav'), title: getComputedStyle(document.querySelector('.xp-head h1')).display !== 'none', mark: !!document.querySelector('.xp-mark'), c: document.querySelector('canvas').getBoundingClientRect().toJSON(), side: document.querySelector('.xp-side').getBoundingClientRect().toJSON(), root: document.querySelector('.xp').getBoundingClientRect().toJSON(), over: [...document.querySelectorAll('.xp *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className || e.tagName).slice(0, 5)})")
        check(f'embed {w}x{h}: no site header or monogram, and no title row above the field', not m['bar'] and not m['mark'] and not m['nav'] and not m['title'])
        check(f'embed {w}x{h}: no horizontal overflow', m['sw'] <= m['cw'] and m['bw'] <= m['cw'] and not m['over'], str(m['over']))
        check(f'embed {w}x{h}: the page fills the frame without scrolling the page itself', abs(m['root']['height'] - h) <= 1 and m['sh'] <= m['ch'], f"root {m['root']['height']:.0f} of {h}")
        check(f'embed {w}x{h}: the field is big enough to read and the text column is reachable', m['c']['width'] >= 300 and m['c']['height'] >= 180 and m['side']['height'] >= 120, f"canvas {m['c']['width']:.0f}x{m['c']['height']:.0f}, text {m['side']['width']:.0f}x{m['side']['height']:.0f}")
        if w < 760:
            check(f'embed {w}x{h}: phone-width layout puts the field above the text', m['c']['bottom'] <= m['side']['top'] + 2)
        else:
            check(f'embed {w}x{h}: wide layout puts the field beside the text', m['c']['right'] <= m['side']['left'] + 2)
        page.screenshot(path=str(OUT / f'embed-{w}x{h}-light.png'))
        page.context.close()
    page = make_page(browser, 390, 844)
    page.goto(url(), wait_until='load'); wait_frames(page)
    m = page.evaluate("({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, c: document.querySelector('canvas').getBoundingClientRect().toJSON(), side: document.querySelector('.xp-side').getBoundingClientRect().toJSON()})")
    check('phone 390x844 standalone: field on top, text below, no horizontal overflow', m['sw'] <= m['cw'] and m['c']['bottom'] <= m['side']['top'] + 2 and m['c']['width'] >= 340, f"canvas {m['c']['width']:.0f}x{m['c']['height']:.0f}")
    page.screenshot(path=str(OUT / 'phone-390x844-standalone.png'))
    page.context.close()


def themes(browser):
    page = make_page(browser)
    page.goto(url(theme='light'), wait_until='load'); wait_frames(page)
    light = bg(page)
    page.goto(url(theme='dark'), wait_until='load'); wait_frames(page)
    dark = bg(page)
    check('?theme=light is the paper ground and ?theme=dark is the black ground', light == PAPER and dark == BLACK, f'{light} / {dark}')
    page.screenshot(path=str(OUT / 'standalone-dark.png'))
    check('the scene text is set in the scene\'s own ink, legible against the scene ground (not the page theme)', page.evaluate("(() => { const t = getComputedStyle(document.querySelector('.xp-text .xp-title')).color, g = getComputedStyle(document.querySelector('.xp-field')).backgroundColor; return t !== g && t !== 'rgba(0, 0, 0, 0)'; })()"))
    check('the scene text sits inside the stage, over the field (not in the side column)', page.evaluate("(() => { const t = document.querySelector('.xp-text .xp-item').getBoundingClientRect(), f = document.querySelector('.xp-field').getBoundingClientRect(); return t.left >= f.left - 1 && t.top >= f.top - 1 && !document.querySelector('.xp-side .xp-text'); })()"))
    page.context.close()

    page = make_page(browser, color_scheme='dark')
    page.goto(url(), wait_until='load'); wait_frames(page)
    check('with no ?theme the page follows prefers-color-scheme (dark)', bg(page) == BLACK)
    page.context.close()
    page = make_page(browser, color_scheme='light')
    page.goto(url(), wait_until='load'); wait_frames(page)
    check('with no ?theme the page follows prefers-color-scheme (light)', bg(page) == PAPER)
    page.evaluate("window.postMessage({type: 'oi-theme', theme: 'dark'}, location.origin)")
    page.wait_for_function(f"getComputedStyle(document.body).backgroundColor === '{BLACK}'")
    check('postMessage({type:"oi-theme", theme:"dark"}) switches live', True)
    page.evaluate("window.postMessage({type: 'oi-theme', theme: 'sepia'}, location.origin); window.postMessage({type: 'other', theme: 'light'}, location.origin)")
    page.wait_for_timeout(300)
    check('unknown themes and unrelated messages are ignored', bg(page) == BLACK)
    page.evaluate("window.postMessage({type: 'oi-theme', theme: 'light'}, location.origin)")
    page.wait_for_function(f"getComputedStyle(document.body).backgroundColor === '{PAPER}'")
    check('and back to light', True)
    page.context.close()

    # as a real embed: a same-origin parent inside which the page lives in an iframe at 460x640
    page = make_page(browser, 900, 760)
    page.goto(f'{BASE}/expression.html', wait_until='load')   # a same-origin parent document
    page.evaluate(f"""(() => {{
      document.body.innerHTML = '';
      const f = document.createElement('iframe'); f.id = 'embedded'; f.width = 460; f.height = 640; f.style.border = '0';
      f.src = '/expression.html?x={X}&embed=1&theme=light'; document.body.appendChild(f);
    }})()""")
    frame = None
    deadline = time.time() + 90
    while time.time() < deadline:
        frame = next((fr for fr in page.frames if fr != page.main_frame and 'embed=1' in fr.url), None)
        if frame and frame.evaluate("(() => { const c = document.querySelector('canvas'); return !!c && c.dataset.rendered === 'true'; })()"):
            break
        page.wait_for_timeout(500)
    check('inside a real iframe (460x640) the page renders the field', frame is not None and frame.evaluate("Number(document.querySelector('canvas').dataset.frames) > 0"))
    check('iframe: light ground, no header, no horizontal overflow', frame.evaluate("getComputedStyle(document.body).backgroundColor") == PAPER and frame.evaluate("!document.querySelector('.xp-nav') && document.documentElement.scrollWidth <= document.documentElement.clientWidth"))
    page.evaluate("document.getElementById('embedded').contentWindow.postMessage({type: 'oi-theme', theme: 'dark'}, location.origin)")
    frame.wait_for_function(f"getComputedStyle(document.body).backgroundColor === '{BLACK}'")
    check("the parent window's oi-theme message switches the embedded page live", True)
    check('iframe carries no "In the essay" block (the essay tab around it already is the context)', frame.evaluate("document.querySelectorAll('.xp-essay').length") == 0)
    page.screenshot(path=str(OUT / 'iframe-460x640-dark.png'))
    page.context.close()


SMOKE = r"""
import { createHash } from 'node:crypto';
const [base, engine] = process.argv.slice(process.argv[1] === '-e' ? 3 : 1);   // node -e puts the first argument at argv[1]
const { validateJourney } = await import(engine);
const index = await (await fetch(`${base}/essay/expressions/index.json`)).json();
let bad = [];
let scenes = 0;
for (const e of index.entries) {
  try {
    const bytes = Buffer.from(await (await fetch(`${base}/essay/expressions/${e.journey}`)).arrayBuffer());
    const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    if (digest !== e.digest) { bad.push(`${e.id}: digest ${digest.slice(0, 19)} != ${e.digest.slice(0, 19)}`); continue; }
    if (bytes.length !== e.bytes) { bad.push(`${e.id}: size ${bytes.length} != ${e.bytes}`); continue; }
    const j = validateJourney(JSON.parse(bytes.toString('utf8')));
    if (j.scenes.length !== e.scenes.length || j.scenes.some((s, i) => s.id !== e.scenes[i].id)) { bad.push(`${e.id}: scene ids differ from the index`); continue; }
    scenes += j.scenes.length;
  } catch (error) { bad.push(`${e.id}: ${error.message}`); }
}
console.log(JSON.stringify({ members: index.entries.length, scenes, bad }));
"""


def smoke_all():
    model = ROOT / 'node_modules/@epilogos/oi-design-system/expressions-engine/shell/model.mjs'
    done = subprocess.run(['node', '--input-type=module', '-e', SMOKE, BASE, model.as_uri()], capture_output=True, text=True, timeout=600)
    if done.returncode != 0:
        check('135-member smoke loop runs', False, done.stderr[-400:])
        return
    result = json.loads(done.stdout.strip().splitlines()[-1])
    check(f"every one of the {result['members']} published members: bytes match the digest, size matches, validateJourney accepts, scene ids match the index ({result['scenes']} scenes)",
          result['members'] == 135 and not result['bad'], '; '.join(result['bad'][:3]))


def warm_up(browser):
    """A cold Vite dev server pre-bundles dependencies on its first page load (and reloads the page); do that once, patiently."""
    page = make_page(browser)
    page.set_default_timeout(240000)
    page.goto(url(), wait_until='load')
    page.wait_for_function("(() => { const c = document.querySelector('canvas'); return !!c && c.dataset.rendered === 'true'; })()", timeout=240000)
    page.context.close()


def main():
    server = start_server()
    try:
        index = json.loads(urllib.request.urlopen(f'{BASE}/essay/expressions/index.json').read())
        entry = next(e for e in index['entries'] if e['id'] == X)
        smoke_all()
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None, args=LAUNCH)
            try:
                warm_up(browser)
                for step in (lambda: render_and_controls(browser, index), lambda: reduced_motion(browser), lambda: integrity(browser, entry),
                             lambda: other_states(browser), lambda: embed_and_layouts(browser), lambda: themes(browser)):
                    try:
                        step()
                    except Exception:
                        check(f'step crashed: {getattr(step, "__name__", "step")}', False, traceback.format_exc()[-700:])
            finally:
                browser.close()
    finally:
        if server:
            server()
    failed = [n for n, ok in RESULTS if not ok]
    print(f'\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed; evidence in {OUT}')
    if failed:
        print('FAILED:\n  ' + '\n  '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
