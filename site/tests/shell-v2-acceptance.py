#!/usr/bin/env python3
"""Built-shell acceptance. Run from site/ with preview serving on port 4173.

Test-only dependency: playwright==1.51.0 and its browsers. No app dependency.
Screenshots, source coverage and viewport results are retained even on failure.
"""
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SHELL_BASE_URL', 'http://127.0.0.1:4173/shell.html')
OUT = Path('evidence/shell-v2')
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = json.loads(subprocess.check_output(['node', 'tests/read-shell-source.mjs'], text=True))
PAGES = SOURCE['pages']
READING_LINKS = SOURCE['readingLinks']
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
        expect(page.locator('.pl')).to_have_count(1)
        expect(page.locator('[data-pl-layer]')).to_have_count(4)
        # The six facets and their products are one component; the office tiles are gone.
        expect(page.locator('.facets__grid .facet')).to_have_count(6)
        expect(page.locator('.office-grid, .office-tile')).to_have_count(0)
        # The home is O:I with its six facets and their products, the Cradle, the essay and its authorship.
        expect(page.locator('.band')).to_have_count(0)
        expect(page.locator('[data-layout="band"]')).to_have_count(0)
        expect(page.locator('.entrance__door')).to_have_count(0)
        # Header: one right-aligned cluster, the essay then O:I on GitHub. No
        # mark, menu foldout or Library entrance anywhere on the home.
        github = page.locator('.sn__cluster > a.sn__github')
        expect(github).to_have_attribute('href', SOURCE['github']['href'])
        expect(github).to_have_attribute('aria-label', 'O:I on GitHub')
        expect(github).to_be_visible()
        expect(page.locator('.sn a')).to_have_count(len(READING_LINKS) + 1)
        expect(page.locator('.sn svg')).to_have_count(1)
        expect(page.locator('.sn button, .sn dialog, .sn__toggle, .sn__brand, .sn__mark')).to_have_count(0)
        g, e = github.bounding_box(), page.locator('.sn__reading a').last.bounding_box()
        assert e['x'] + e['width'] <= g['x'] + 1, 'GitHub icon is not after the essay link'
        assert g['x'] + g['width'] >= width * .85 and g['y'] < 120, ('GitHub icon is not top-right', g, width)
        assert e['x'] > width / 2, ('header cluster is not right-aligned', e, width)
        expect(page.locator('.sn__reading a')).to_have_count(len(READING_LINKS))
        expect(page.locator('a[href^="#/library"]')).to_have_count(0)
        for source in READING_LINKS:
            header = page.locator('.sn__reading a').filter(has_text=source['label'])
            expect(header).to_have_attribute('href', source['href'])
            expect(header).to_be_visible()
            landing = page.locator('.sec__reading a').filter(has_text=source['label']).first
            expect(landing).to_have_attribute('href', source['href'])
            if source.get('accessibleName'):
                expect(header).to_have_attribute('aria-label', source['accessibleName'])
        sections = page.locator('[data-layout]')
        expect(sections).to_have_count(len(expected['sections']))
        count = 0
        for index, source in enumerate(expected['sections']):
            section = sections.nth(index)
            assert section.locator('h2').text_content() == source['title']
            paragraphs = section.locator('.sec__prose > p').all_text_contents()
            wanted = [re.sub(r'\*([^*\n]+)\*', r'\1', paragraph) for paragraph in source.get('body', '').split('\n\n')] if source.get('body') else []
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
        if route == 'home':
            # Hero, then What is O:I with the six facets and their products, the Cradle, the essay, authorship.
            expect(sections.nth(0).locator('h2')).to_have_text(expected['sections'][0]['title'])
            expect(sections.nth(0).locator('h2')).to_have_text('The world an agent acts from.')
            expect(sections.nth(0).locator('.sec__prose > p').first).to_contain_text('O:I stands for Objective : Internality')
            expect(sections.nth(0).locator('.sec__prose em')).to_have_count(0)
            assert len(sections.nth(0).locator('.sec__prose > p').all()) == 2, 'What is O:I runs to two paragraphs'
            # Each facet shows its role, its line, then the product: name linked to its repository, and its command.
            facet_set = expected['sections'][0]['facetSet']
            facets = sections.nth(0).locator('.facets__grid > li.facet')
            expect(facets).to_have_count(len(facet_set['facets']))
            for i, source in enumerate(facet_set['facets']):
                facet = facets.nth(i)
                expect(facet.locator('h3.facet__role')).to_have_text(source['role'])
                expect(facet.locator('.facet__line')).to_have_text(source['line'])
                link = facet.locator('a.facet__product')
                expect(link).to_have_attribute('href', source['repo'])
                expect(link).to_contain_text(source['product'])
                expect(facet.locator('code.facet__cli')).to_have_text('$' + source['cli'])
                assert link.bounding_box()['height'] >= 44, ('repository target too small', source['product'])
                assert facet.evaluate('node => node.scrollWidth <= node.clientWidth + 1'), ('facet clips', source['role'])
            assert sections.nth(0).locator('.facets__grid').get_attribute('aria-label') == facet_set['label']
            note = sections.nth(0).locator('.facets__note')
            expect(note).to_contain_text('All six are in use and still developing')
            expect(note.locator('a')).to_have_attribute('href', facet_set['readme']['href'])
            columns = sections.nth(0).locator('.facets__grid').evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').length")
            assert columns == (1 if width <= 640 else 2 if width <= 1000 else 3), ('facet columns', width, columns)
            expect(sections.nth(1).locator('h2')).to_have_text('Before the harness.')
            assert len(sections.nth(1).locator('.sec__prose > p').all()) <= 2, 'the Cradle runs to two paragraphs at most'
            home_text = page.locator('main').inner_text()
            for gone in ('A living field', 'capable model', 'The means can become a question', 'Library', 'harness before the harness', 'Six products, one for each facet', 'Central holds the ground'):
                assert gone not in home_text, ('removed home copy still rendered', gone)
            expect(sections.nth(2).locator('.sec__prose em')).to_have_count(3)
            expect(sections.nth(2).locator('.sec__entrance a[href="./essay/"]')).to_have_count(1)
            expect(page.locator('main .sec__reading a[href="./essay/"]')).to_have_count(1)
            # Rhythm: no section becomes a wall. The facet section carries the six facets, so it has its own bound.
            heights = sections.evaluate_all('nodes => nodes.map(node => node.getBoundingClientRect().height)')
            if width >= 1280:
                assert heights[0] <= 1600 and all(h <= 1000 for h in heights[1:]), ('section heights', width, heights)
            elif width >= 760:
                assert heights[0] <= 1800 and all(h <= 1200 for h in heights[1:]), ('section heights', width, heights)
            elif width >= 375:
                assert heights[0] <= 2600 and all(h <= 1300 for h in heights[1:]), ('section heights', width, heights)
        for panel in page.locator('[data-presentation]').all():
            kind = panel.get_attribute('data-presentation')
            selector = {'sequence': '.method-sequence', 'atlas': '.resource-atlas'}[kind]
            grid = panel.locator(selector)
            columns = grid.evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').length")
            expected_columns = (2 if width <= 900 else 5) if kind == 'sequence' else (2 if width <= 1100 else 3)
            assert columns == expected_columns, (kind, width, columns)
            if kind == 'sequence' and width >= 1000:
                assert grid.bounding_box()['height'] < 400, 'method returned to a sprawling vertical list'
        assert page.locator('.sec__rows').count() == 0, 'obsolete full-width index renderer remains'
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
        assert abs(float(page.locator('.pl__field').evaluate('node => getComputedStyle(node).opacity')) - .8) < .01
        assert float(page.locator('.pl__mark').evaluate('node => getComputedStyle(node).opacity')) == 1
        frame = page.locator('.pl .vf__frame').bounding_box()
        assert abs(frame['width'] - frame['height']) < 1, 'mask does not follow the square media frame'
        assert float(page.locator('.pl .vf').evaluate("node => getComputedStyle(node).getPropertyValue('--vf-zoom')")) > 1.03
        page.screenshot(path=str(OUT / 'hero-rest.png'))
        mid = positions(300)
        mark_mid = float(page.locator('.pl__mark').evaluate('node => getComputedStyle(node).opacity'))
        field_mid = float(page.locator('.pl__field').evaluate('node => getComputedStyle(node).opacity'))
        assert mark_mid > .95 and mark_mid > field_mid + .2, (mark_mid, field_mid)
        page.screenshot(path=str(OUT / 'hero-scroll-300.png'))
        end = positions(650)
        mark_late = float(page.locator('.pl__mark').evaluate('node => getComputedStyle(node).opacity'))
        assert mark_late >= .78 and abs(end[0] - end[3]) > 100, (mark_late, end)
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
        assert page.get_by_role('button', name='Pause motion').count() == 0, 'motion is unconditional; no pause control may exist'
    check('live-os-preference', preference, page)

    def header():
        expect(page.get_by_role('dialog')).to_have_count(0)
        expect(page.get_by_role('button', name='Menu')).to_have_count(0)
        github = page.get_by_role('link', name='O:I on GitHub', exact=True)
        expect(github).to_have_attribute('href', 'https://github.com/EpiLogos/O-I')
        essay = page.locator('.sn__reading a[href="./essay/"]')
        expect(essay).to_have_attribute('aria-label', READING_LINKS[0]['accessibleName'])
        page.screenshot(path=str(OUT / 'header-desktop.png'))
        # The Library keeps its own address even without a home entrance.
        page.evaluate("location.hash = '/library?published=1'")
        expect(page.locator('.native-public-library')).to_be_visible()
        assert not page.evaluate("document.documentElement.classList.contains('lenis')")
        page.go_back()
        expect(page.locator('main')).to_have_attribute('data-page', 'home')
    check('header-essay-then-github-no-menu-and-library-address', header, page)

    def rapid():
        page.evaluate("location.hash = '/oi'")
        page.wait_for_timeout(60)
        page.evaluate("location.hash = '/research'")
        page.wait_for_timeout(60)
        page.evaluate("location.hash = '/build'")
        expect(page.locator('.expression-reader')).to_have_attribute('data-expression-ref', 'expression:oi:site:build')
        page.wait_for_timeout(700)
        assert page.locator('.expression-reader').evaluate('node => getComputedStyle(node).opacity') == '1'
        page.evaluate("location.hash = '/not-a-route'")
        expect(page.locator('main')).to_have_attribute('data-page', 'home')
        page.emulate_media(reduced_motion='reduce')
        page.evaluate("location.hash = '/oi'")
        expect(page.locator('.expression-reader')).to_have_attribute('data-expression-ref', 'expression:oi:site:oi')
        assert not errors, errors
    check('rapid-route-interruption-unknown-hash-and-static-route', rapid, page)
    context.close()

    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page = context.new_page()
    page.goto(route_url('home'))
    def mobile_header():
        bar = page.locator('header.sn')
        expect(page.locator('.sn button, .sn dialog')).to_have_count(0)
        github = page.locator('.sn__github')
        essay = page.locator('.sn__reading a[href="./essay/"]')
        expect(github).to_be_visible()
        expect(essay).to_be_visible()
        g, e, b = github.bounding_box(), essay.bounding_box(), bar.bounding_box()
        vw = page.evaluate('innerWidth')
        assert g['x'] + g['width'] >= vw * .85 and g['y'] < b['y'] + b['height'], ('GitHub icon not top-right', g)
        assert e['x'] + e['width'] <= g['x'] + 1 and e['x'] > vw / 2, ('essay link not beside GitHub on the right', e)
        assert g['width'] >= 44 and g['height'] >= 44, ('GitHub target too small', g)
        assert g['x'] + g['width'] <= vw + 1, ('GitHub icon overflows', g)
        assert abs((g['y'] + g['height'] / 2) - (e['y'] + e['height'] / 2)) < 4, 'header controls are not on one row'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(OUT / 'header-mobile.png'))
        return {'github': g, 'essay': e}
    check('mobile-header-essay-and-github-top-right', mobile_header, page)
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
    for engine in os.environ.get('SHELL_BROWSERS', 'chromium,firefox,webkit').split(','):
        launch = {}
        if engine == 'chromium':
            launch['args'] = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
            if os.environ.get('CHROMIUM_EXECUTABLE'):
                launch['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        browser = getattr(p, engine).launch(**launch)
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
