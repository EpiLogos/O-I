#!/usr/bin/env python3
"""Built-shell acceptance. Run from site/ with preview serving on port 4173.

Test-only dependency: playwright==1.51.0 and its browsers. No app dependency.
Screenshots, source coverage and viewport results are retained even on failure.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SHELL_BASE_URL', 'http://127.0.0.1:4173/shell.html')
OUT = Path('evidence/shell-v2')
OUT.mkdir(parents=True, exist_ok=True)
PAGES = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', """
import fs from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(fs.readFileSync('src/shell/content.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
}).outputText;
const content = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
console.log(JSON.stringify(content.PAGES));
"""], text=True))
RESULTS = []
FAILURES = []
BLOCKED = []
ASSETS = [f'oi-pointcloud-{letter}.mp4' for letter in 'abcd'] + [f'oi-pointcloud-poster-{n}.jpg' for n in (1, 2, 3)]
MISSING_ASSETS = [name for name in ASSETS if not (Path('public/media/motion') / name).is_file()]
MEDIA_READY = not MISSING_ASSETS

class Blocked(Exception):
    pass


def check(name, action, page=None):
    try:
        detail = action()
        RESULTS.append({'case': name, 'passed': True, 'detail': detail})
        print('PASS', name, flush=True)
    except Blocked as error:
        BLOCKED.append({'case': name, 'reason': str(error)})
        RESULTS.append({'case': name, 'passed': False, 'blocked': True})
        print('BLOCKED', name, str(error), flush=True)
    except Exception as error:
        FAILURES.append({'case': name, 'error': str(error), 'traceback': traceback.format_exc()})
        RESULTS.append({'case': name, 'passed': False})
        print('FAIL', name, str(error), flush=True)
        if page:
            try:
                page.screenshot(path=str(OUT / (name.replace('/', '-') + '-failure.png')))
            except Exception:
                pass


def route_url(route):
    return BASE + '#/' + ('' if route == 'home' else route)


def inspect_route(browser, engine, width, height, reduced, expected):
    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce' if reduced else 'no-preference')
    page = context.new_page()
    errors, missing, movies = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: missing.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: movies.append(request.url) if '.mp4' in request.url else None)
    route = expected['id']
    name = f'{engine}-layout-copy-{route}-{width}x{height}-' + ('still' if reduced else 'motion')

    def run():
        page.goto(route_url(route), wait_until='load')
        expect(page.locator('main')).to_have_attribute('data-page', route)
        expect(page.locator('h1')).to_have_count(1)
        sections = page.locator('[data-layout]')
        expect(sections).to_have_count(len(expected['sections']))
        count = 0
        for index, source in enumerate(expected['sections']):
            section = sections.nth(index)
            assert section.locator('h2').text_content() == source['title']
            paragraphs = section.locator('.sec__prose > p').all_text_contents()
            wanted = source.get('body', '').split('\n\n') if source.get('body') else []
            assert paragraphs == wanted, f'{route}/{index}: body changed or omitted'
            count += len(wanted)
            if source.get('sub'):
                assert section.locator('.sec__sub').text_content() == source['sub']
            names = section.locator('.sec__item-name, .sec__cell-name, .sec__row-name, .sec__meta-name').all_text_contents()
            assert names == [item['name'] for item in source.get('items', [])], f'{route}/{index}: items changed or omitted'
            section.scroll_into_view_if_needed()
            if not reduced:
                expect(section.locator('[data-reveal]')).not_to_have_attribute('data-reveal', 'pending')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'horizontal overflow'
        overflow = page.locator('main h1:not(.sr-only), main h2, main p, .sec__detail').evaluate_all('''nodes => nodes.filter(node => {
          const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
        }).map(node => node.textContent.slice(0, 80))''')
        assert not overflow, overflow
        media = page.locator('.vf__poster, .sec__figure img')
        for i in range(media.count()):
            image = media.nth(i)
            image.scroll_into_view_if_needed()
            if MEDIA_READY:
                expect(image).not_to_have_js_property('naturalWidth', 0)
            assert image.evaluate('node => getComputedStyle(node).objectFit') == 'contain'
        if reduced:
            expect(page.locator('video')).to_have_count(0)
            assert not movies, 'reduced motion downloaded a video'
            assert not page.evaluate("document.documentElement.classList.contains('lenis')")
        assert not errors, errors
        unexpected = [url for url in missing if url.rsplit('/', 1)[-1] not in MISSING_ASSETS]
        assert not unexpected, unexpected
        if engine == 'chromium' and width in (390, 1440):
            page.evaluate('window.scrollTo(0, 0)')
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)
        return {'paragraphs_preserved': count, 'sections': len(expected['sections']), 'horizontal_overflow': False, 'video_requests': len(movies), 'media_verified': MEDIA_READY, 'missing_media': MISSING_ASSETS}

    check(name, run, page)
    context.close()


def interactions(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(route_url('home'))
    expect(page.locator('main')).to_have_attribute('data-page', 'home')

    def hero():
        def positions(y):
            page.evaluate('(y) => window.scrollTo(0, y)', y)
            page.wait_for_timeout(800)
            return page.locator('[data-pl-layer]').evaluate_all("nodes => nodes.map(n => new DOMMatrix(getComputedStyle(n).transform).m42)")
        rest = positions(0)
        mid = positions(300)
        end = positions(650)
        assert all(abs(value) < 1 for value in rest), rest
        assert all(value < -0.1 for value in mid), mid
        assert all(abs(b) > abs(a) for a, b in zip(mid, end)), (mid, end)
        assert abs(mid[0]) > abs(mid[1]) > abs(mid[2]) > abs(mid[3]), mid
        page.screenshot(path=str(OUT / 'hero-scroll-650.png'))
        returned = positions(0)
        assert all(abs(value) < 1 for value in returned), returned
        return {'rest': rest, 'mid': mid, 'later': end, 'returned': returned}
    check('hero-one-way-separation-and-reversal', hero, page)

    def preference():
        page.emulate_media(reduced_motion='reduce')
        expect(page.locator('.shell')).to_have_attribute('data-motion', 'still')
        expect(page.locator('video')).to_have_count(0)
        assert not page.evaluate("document.documentElement.classList.contains('lenis')")
        positions = page.locator('[data-pl-layer]').evaluate_all("nodes => nodes.map(n => getComputedStyle(n).transform)")
        assert all(value == 'none' for value in positions), positions
        page.screenshot(path=str(OUT / 'hero-reduced-motion.png'))
        page.emulate_media(reduced_motion='no-preference')
        expect(page.locator('.shell')).to_have_attribute('data-motion', 'full')
        expect(page.locator('.pl video')).to_have_count(1)
        toggle = page.get_by_role('button', name='Pause motion', exact=True)
        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('video')).to_have_count(0)
        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'false')
        expect(page.locator('.pl video')).to_have_count(1)
    check('live-os-preference-and-user-pause', preference, page)

    def menu():
        trigger = page.locator('.sn > .sn__toggle')
        trigger.click()
        dialog = page.get_by_role('dialog', name='Site navigation')
        expect(dialog).to_be_visible()
        expect(dialog.locator('[aria-current="page"]')).to_have_attribute('href', '#/')
        for _ in range(12):
            page.keyboard.press('Tab')
            assert page.evaluate("!document.querySelector('main').contains(document.activeElement)"), 'focus escaped modal into content'
        dialog.evaluate('node => Promise.all(node.getAnimations().map(animation => animation.finished))')
        page.screenshot(path=str(OUT / 'menu-desktop.png'))
        page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        expect(trigger).to_be_focused()
        assert page.evaluate('document.body.style.overflow') != 'hidden'
        trigger.click()
        dialog.locator('a[href="#/products"]').click()
        expect(page.locator('main')).to_have_attribute('data-page', 'products')
        expect(page.locator('main')).to_be_focused()
        assert page.evaluate('scrollY') < 2
        assert not page.evaluate("document.documentElement.classList.contains('lenis')")
        page.go_back()
        expect(page.locator('main')).to_have_attribute('data-page', 'home')
        page.go_forward()
        expect(page.locator('main')).to_have_attribute('data-page', 'products')
    check('modal-focus-escape-links-history-and-route-focus', menu, page)

    def rapid():
        page.evaluate("location.hash = '/oi'")
        page.wait_for_timeout(60)
        page.evaluate("location.hash = '/research'")
        page.wait_for_timeout(60)
        page.evaluate("location.hash = '/build'")
        expect(page.locator('main')).to_have_attribute('data-page', 'build')
        page.wait_for_timeout(700)
        assert page.locator('main').evaluate('node => getComputedStyle(node).opacity') == '1'
        page.evaluate("location.hash = '/not-a-route'")
        expect(page.locator('main')).to_have_attribute('data-page', 'home')
        page.emulate_media(reduced_motion='reduce')
        page.evaluate("location.hash = '/oi'")
        expect(page.locator('main')).to_have_attribute('data-page', 'oi')
        assert not errors, errors
    check('rapid-route-interruption-unknown-hash-and-static-route', rapid, page)
    context.close()

    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page = context.new_page()
    page.goto(route_url('home'))
    def mobile_menu():
        for source in PAGES:
            page.locator('.sn > .sn__toggle').click()
            dialog = page.get_by_role('dialog')
            expect(dialog).to_be_visible()
            assert dialog.evaluate('node => node.scrollWidth <= innerWidth + 1')
            href = '#/' + ('' if source['id'] == 'home' else source['id'])
            link = dialog.locator(f'.sn__link[href="{href}"]')
            link.scroll_into_view_if_needed()
            if source == PAGES[-1]:
                page.screenshot(path=str(OUT / 'menu-mobile.png'))
            link.click()
            expect(page.locator('main')).to_have_attribute('data-page', source['id'])
            assert page.evaluate('document.body.style.overflow') != 'hidden'
        return {'routes_reached': [source['id'] for source in PAGES]}
    check('mobile-menu-every-source-route-reachable', mobile_menu, page)
    context.close()

    context = browser.new_context()
    context.add_init_script("HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'))")
    page = context.new_page()
    page.goto(route_url('home'))
    def blocked():
        if not MEDIA_READY:
            raise Blocked('Original point-cloud assets absent; no replacement image used.')
        expect(page.locator('.pl .vf')).to_have_attribute('data-media-state', 'poster')
        image = page.locator('.pl .vf__poster')
        expect(image).to_have_js_property('complete', True)
        assert image.evaluate('node => node.naturalWidth > 0')
        assert page.locator('video[autoplay]').count() == 0
        page.screenshot(path=str(OUT / 'hero-autoplay-blocked.png'))
    check('autoplay-refusal-keeps-readable-poster', blocked, page)
    context.close()


def media_contract():
    assert not MISSING_ASSETS, 'Missing original delivery assets: ' + ', '.join(MISSING_ASSETS)
    manifest = {}
    for name in ASSETS:
        data = (Path('public/media/motion') / name).read_bytes()
        assert len(data) > 128, f'{name}: empty or placeholder asset'
        assert (data[4:8] == b'ftyp') if name.endswith('.mp4') else data.startswith(b'\xff\xd8'), f'{name}: wrong media format'
        manifest[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    return manifest

check('original-media-delivery-contract', media_contract)

with sync_playwright() as p:
    for engine in ['chromium', 'firefox', 'webkit']:
        browser = getattr(p, engine).launch()
        sizes = [(320,740),(390,844),(768,1024),(1440,900),(2560,1080),(844,390)] if engine == 'chromium' else [(390,844),(1440,900)]
        for width, height in sizes:
            for reduced in ([False, True] if engine == 'chromium' else [True]):
                for expected in PAGES:
                    inspect_route(browser, engine, width, height, reduced, expected)
        if engine == 'chromium':
            interactions(browser)
        browser.close()

summary = {'passed': len(RESULTS) - len(FAILURES) - len(BLOCKED), 'failed': len(FAILURES), 'blocked': BLOCKED, 'media_complete': MEDIA_READY, 'cases': RESULTS, 'failures': FAILURES}
(OUT / 'results.json').write_text(json.dumps(summary, indent=2))
print(json.dumps({'passed': summary['passed'], 'failed': summary['failed']}), flush=True)
raise SystemExit(1 if FAILURES or BLOCKED else 0)
