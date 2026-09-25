#!/usr/bin/env python3
"""Plate A public-entrance acceptance. Run from site/ with preview on port 4173.

The public home is two doors. It does not scrub a hero, open a menu, or
present the six products as installable tiles. Point-cloud media is no longer
part of this entrance.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SHELL_BASE_URL', 'http://127.0.0.1:4173/shell.html')
OUT = Path('evidence/shell-v2')
OUT.mkdir(parents=True, exist_ok=True)
ENTRANCE = json.loads(subprocess.check_output(['node', 'tests/read-shell-source.mjs'], text=True))
RESULTS = []
FAILURES = []


def check(name, action, page=None):
    try:
        detail = action()
        RESULTS.append({'case': name, 'passed': True, 'detail': detail})
        print('PASS', name, flush=True)
    except Exception as error:
        FAILURES.append({'case': name, 'error': str(error), 'traceback': traceback.format_exc()})
        RESULTS.append({'case': name, 'passed': False})
        print('FAIL', name, str(error), flush=True)
        if page:
            try:
                page.screenshot(path=str(OUT / (name.replace('/', '-') + '-failure.png')))
            except Exception:
                pass


def home(browser, engine, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    name = f'{engine}-plate-a-{width}x{height}'

    def run():
        page.goto(BASE + '#/', wait_until='load')
        expect(page.locator('main')).to_have_attribute('data-page', 'home')
        expect(page.locator('.sn__toggle, dialog, .office-grid, .pl, .band')).to_have_count(0)
        expect(page.get_by_role('button', name='Menu')).to_have_count(0)
        heading = page.locator('main h1')
        expect(heading).to_have_count(1)
        text = heading.inner_text()
        assert ENTRANCE['title'][0] in text and ENTRANCE['title'][1] in text, text
        expect(page.locator('.entrance__eyebrow')).to_have_text(ENTRANCE['eyebrow'])
        expect(page.locator('.entrance__lede')).to_have_text(ENTRANCE['lede'])
        expect(page.locator('.entrance__coming')).to_have_text(ENTRANCE['coming'])
        doors = page.locator('.entrance__door')
        expect(doors).to_have_count(2)
        for index, source in enumerate(ENTRANCE['doors']):
            door = doors.nth(index)
            expect(door).to_have_attribute('href', source['href'])
            assert source['label'] in door.inner_text()
            assert source['body'] in door.inner_text()
            if source.get('accessibleName'):
                assert source['accessibleName'] in (door.text_content() or '')
        nav = page.locator('nav[aria-label="Primary"] a')
        expect(nav).to_have_count(2)
        expect(nav.nth(0)).to_have_text('Library')
        expect(nav.nth(0)).to_have_attribute('href', ENTRANCE['doors'][0]['href'])
        expect(nav.nth(1)).to_have_text('Essay')
        expect(nav.nth(1)).to_have_attribute('href', './essay/')
        assert ENTRANCE['essayTitle'] in (nav.nth(1).get_attribute('aria-label') or '')
        expect(page.locator('.sn__brand small')).to_have_text(ENTRANCE['brand'])
        hrefs = page.locator('a').evaluate_all('nodes => nodes.map(node => node.getAttribute("href") || "")')
        assert not any('INSTALL' in href or 'github.com' in href for href in hrefs), hrefs
        assert 'World and Life' not in page.locator('body').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'horizontal overflow'
        columns = page.locator('.entrance__doors').evaluate(
            "node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length"
        )
        assert columns == (1 if width <= 720 else 2), columns
        assert not errors, errors
        if engine == 'chromium' and width in (390, 1440):
            page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)
        return {'columns': columns, 'width': width}

    check(name, run, page)
    context.close()


def library_door(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def run():
        page.goto(BASE + '#/', wait_until='load')
        page.locator('.entrance__door').nth(0).click()
        expect(page.locator('.native-public-library')).to_be_visible()
        expect(page).to_have_url(re.compile(r'published=1'))
        page.screenshot(path=str(OUT / 'library-from-door.png'))
        page.go_back()
        expect(page.locator('main.entrance')).to_be_visible()
        expect(page.locator('.sn__links a').nth(1)).to_have_attribute('href', './essay/')
        assert not errors, errors
        return {'library': 'published'}

    check('library-door-opens-published-expressions', run, page)
    context.close()


with sync_playwright() as playwright:
    for engine in ['chromium', 'firefox', 'webkit']:
        browser = getattr(playwright, engine).launch()
        sizes = [(390, 844), (1440, 900)] if engine != 'chromium' else [(320, 740), (390, 844), (768, 1024), (1440, 900)]
        for width, height in sizes:
            home(browser, engine, width, height)
        if engine == 'chromium':
            library_door(browser)
        browser.close()

summary = {'passed': len(RESULTS) - len(FAILURES), 'failed': len(FAILURES), 'cases': RESULTS, 'failures': FAILURES}
(OUT / 'results.json').write_text(json.dumps(summary, indent=2))
print(json.dumps({'passed': summary['passed'], 'failed': summary['failed']}), flush=True)
raise SystemExit(1 if FAILURES else 0)
