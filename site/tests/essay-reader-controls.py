#!/usr/bin/env python3
"""Replay the real Quartz reader: both host bases, four widths, genuine canvases.

Uses the same built-dist host model as essay-host-smoke.py. Nothing is mocked;
search, explorer, graph, focus and links run the shipped native browser scripts.
"""
import importlib.util
import io
import json
import os
import re
import traceback
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('essay_host', HERE / 'essay-host-smoke.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
OUT = Path(os.environ.get('OI_READER_EVIDENCE', str(HERE.parent / 'evidence/essay-reader')))
OUT.mkdir(parents=True, exist_ok=True)
TITLE = 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'
FOUNDATION = 'section-rooms/00-integral-threshold/ROOM-00-integral-threshold'
RESULTS = []


def no_overflow(page):
    dims = page.evaluate('({ viewport: innerWidth, document: document.documentElement.scrollWidth })')
    assert dims['document'] <= dims['viewport'] + 1, dims
    return dims


def live_canvas(page, global_graph=False):
    selector = '.global-graph-container' if global_graph else '.graph-container'
    canvas = page.locator(selector + ' canvas')
    expect(canvas).to_be_visible(timeout=30000)
    page.wait_for_function('''selector => {
      const box = document.querySelector(selector), canvas = box?.querySelector('canvas');
      return canvas && box.offsetWidth > 100 && Math.abs(canvas.getBoundingClientRect().width - box.offsetWidth) <= 2;
    }''', arg=selector, timeout=30000)
    # Inspect real rendered pixels, beyond the existence of a canvas element.
    pixels = Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
    colors = pixels.getcolors(pixels.width * pixels.height)
    assert len(colors) >= 5, f'graph canvas has only {len(colors)} colours'
    return {'box': canvas.bounding_box(), 'colours': len(colors)}


def controls(page, base, prefix, width, label):
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    response = page.goto(base + prefix + '/essay/', wait_until='load')
    assert response.status == 200
    expect(page.locator('article > h1')).to_have_text(TITLE)
    expect(page.locator('h1').filter(has_text=TITLE)).to_have_count(1)
    expect(page.locator('.content-meta, ul.tags')).to_have_count(0)
    expect(page.locator('.essay-reader-toolbar')).to_be_visible()
    dims = no_overflow(page)
    assert page.locator('.essay-site-home').evaluate('a => new URL(a.href).pathname') == prefix + '/'
    for name in ['pages', 'connections']:
        button = page.locator(f'[data-essay-panel="{name}"]')
        expect(button).to_be_visible()
        expect(button).to_have_attribute('aria-expanded', 'true' if width >= 1280 else 'false')
    if width >= 1280: live_canvas(page)
    page.screenshot(path=str(OUT / f'{label}-entrance.png'))

    pages = page.locator('#essay-pages')
    connections = page.locator('#essay-connections')
    pages_button = page.locator('[data-essay-panel="pages"]')
    graph_button = page.locator('[data-essay-panel="connections"]')
    if width >= 1280:
        before = page.locator('#quartz-body').evaluate('p => parseFloat(getComputedStyle(p).gridTemplateColumns.split(" ")[1])')
        graph_button.click()
        expect(connections).not_to_be_visible()
        assert page.locator('#quartz-body').evaluate('p => parseFloat(getComputedStyle(p).gridTemplateColumns.split(" ")[1])') > before
        assert page.locator('.center').bounding_box()['width'] <= 864 + 1
        pages_button.click()
        expect(pages).not_to_be_visible()
    pages_button.click()
    expect(pages).to_be_visible()
    expect(page.locator('.explorer-content .folder-container').first).to_be_visible(timeout=20000)
    if width < 1280:
        assert pages.evaluate('p => p.matches(":modal")')
        assert page.evaluate('document.querySelector("#essay-pages").contains(document.activeElement)')
        page.keyboard.press('Shift+Tab')
        assert page.evaluate('document.querySelector("#essay-pages").contains(document.activeElement)'), 'focus escaped modal'
    # The folder icon folds children; the title still navigates to the actual folder.
    folder = page.locator('.explorer-content .folder-container').first
    children = folder.locator('xpath=following-sibling::*[1]')
    was_open = 'open' in (children.get_attribute('class') or '').split()
    folder.locator('.folder-icon').click()
    expect(children).to_have_class('folder-outer' if was_open else 'folder-outer open')
    folder.locator('.folder-icon').click()
    expect(children).to_have_class('folder-outer open' if was_open else 'folder-outer')
    assert all(not re.match(r'^\d{2}-', name) for name in page.locator('.folder-title').all_text_contents()), 'numeric folder prefix still exposed'
    page.screenshot(path=str(OUT / f'{label}-pages.png'))
    if width < 1280:
        page.keyboard.press('Escape')
    else:
        pages.locator('[data-essay-close]').click()
    expect(pages).not_to_be_visible()
    expect(pages_button).to_be_focused()

    # Keyboard shortcut also opens a closed rail; native graph renders immediately.
    page.keyboard.press('Control+g')
    expect(connections).to_be_visible()
    expect(page.locator('.global-graph-outer')).to_have_class('global-graph-outer active')
    full = live_canvas(page, True)
    page.locator('.global-graph-close').click()
    expect(page.locator('.global-graph-outer')).not_to_be_visible()
    expect(connections).to_be_visible()
    local = live_canvas(page)
    page.locator('.global-graph-icon').click()
    live_canvas(page, True)
    expect(page.locator('.tag-filter .tag-chip').first).to_be_visible()
    if width == 900:
        chip = page.locator('.tag-filter .tag-chip').first
        namespace = chip.text_content().strip()
        chip.click()
        expect(page.locator('.tag-chip').filter(has_text=namespace).first).to_have_attribute('aria-pressed', 'true')
        assert namespace in page.evaluate('JSON.parse(localStorage.getItem("oi-graph-tag-namespaces"))')
        live_canvas(page, True)
        page.set_viewport_size({'width': 1100, 'height': 850})
        live_canvas(page, True)
        page.set_viewport_size({'width': width, 'height': 850})
        live_canvas(page, True)
    page.keyboard.press('Escape')
    expect(page.locator('.global-graph-outer')).not_to_be_visible()
    expect(connections).to_be_visible()
    if width < 1280:
        assert connections.evaluate('p => p.matches(":modal")')
    expect(page.locator('.global-graph-icon')).to_be_focused()
    expect(connections.locator('.toc')).to_be_visible()
    # Native backlinks stay absent when a page has no incoming source links.
    if connections.locator('.backlinks').count():
        expect(connections.locator('.backlinks a').first).to_be_visible()
    page.screenshot(path=str(OUT / f'{label}-connections.png'))
    if width == 390:
        old_width = page.locator('.graph-container canvas').bounding_box()['width']
        page.set_viewport_size({'width': 900, 'height': 850})
        live_canvas(page)
        assert page.locator('.graph-container canvas').bounding_box()['width'] > old_width
        page.set_viewport_size({'width': width, 'height': 850})
        live_canvas(page)
    if width < 1280:
        old_scroll = page.evaluate('scrollY')
        page.mouse.wheel(0, 800)
        assert page.evaluate('scrollY') == old_scroll, 'background moved behind drawer'
        page.keyboard.press('Escape')
    else:
        graph_button.click()
    expect(connections).not_to_be_visible()
    expect(graph_button).to_be_focused()
    no_overflow(page)
    expect(page.locator('article a').filter(has_text='§0/1 — The Integral Threshold').first).to_be_visible()
    assert not errors, errors
    return {'dimensions': dims, 'local_graph': local, 'global_graph': full, 'page_errors': errors}


def deep_routes(page, base, prefix, label):
    width = page.viewport_size['width']
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    response = page.goto(base + prefix + '/essay/' + FOUNDATION, wait_until='load')
    assert response.status == 200
    expect(page.locator('.essay-reader-toolbar')).to_be_visible()
    assert page.locator('.essay-site-home').evaluate('a => new URL(a.href).pathname') == prefix + '/'
    if not page.locator('#essay-connections').is_visible():
        page.locator('[data-essay-panel="connections"]').click()
    backlinks = page.locator('#essay-connections .backlinks a')
    expect(backlinks.first).to_be_visible(timeout=20000)
    backlink_count = backlinks.count()
    backlink_target = backlinks.first.get_attribute('href')
    assert backlink_count > 0 and backlink_target
    page.screenshot(path=str(OUT / f'{label}-foundation-backlinks.png'))
    page.locator('#essay-connections [data-essay-close]').click()
    page.locator('.essay-site-home').click()
    expect(page.locator('.pl')).to_be_visible(timeout=20000)
    assert urlparse(page.url).path == prefix + '/'
    page.goto(base + prefix + '/essay/')
    page.locator('.essay-anchor a').filter(has_text='§0/1').click()
    expect(page.locator('body')).to_have_attribute('data-slug', FOUNDATION)
    page.locator('.essay-anchor a').filter(has_text='Reading home').click()
    expect(page.locator('body')).to_have_attribute('data-slug', 'index')
    # Search uses the native index and repeats the same query after SPA visits.
    search_states = []
    def search():
        if not page.locator('#essay-pages').is_visible():
            page.locator('[data-essay-panel="pages"]').click()
        page.locator('.search-button').click()
        query = page.locator('.search-container.active .search-bar')
        expect(query).to_be_focused()
        state = query.evaluate('''e => ({
          value: e.value, connected: e.isConnected,
          layoutConnected: e.closest('.search').querySelector('.search-layout').isConnected,
          results: [...e.closest('.search').querySelectorAll('.results-container')].map(r => ({ connected: r.isConnected, children: r.children.length }))
        })''')
        assert state['value'] == '' and state['connected'] and state['layoutConnected'], state
        assert len(state['results']) == 1 and state['results'][0]['connected'], state
        search_states.append(state)
        if width >= 1280:
            # Actual hit testing proves the Search overlay covers the toolbar.
            assert page.evaluate('''() => {
              const b = document.querySelector('[data-essay-panel="pages"]').getBoundingClientRect();
              return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.search-container.active');
            }'''), 'toolbar sits above Search'
        query.fill('Integral Threshold')
        expect(page.locator('.search-container.active .result-card:not(.no-match)').first).to_be_visible(timeout=20000)
        expect(page.locator('.search-container.active .preview-inner')).to_be_visible(timeout=20000)
        expect(page.locator('.essay-reader-toolbar')).to_have_count(1)
        expect(page.locator('#essay-pages')).to_have_count(1)
        expect(page.locator('#essay-connections')).to_have_count(1)
    search()
    page.locator('.search-container.active .result-card').first.click()
    expect(page).not_to_have_url(base + prefix + '/essay/')
    searched_slug = page.locator('body').get_attribute('data-slug')
    assert searched_slug and searched_slug != 'index'
    expect(page.locator('article')).to_be_visible()
    page.locator('.essay-anchor a').filter(has_text='Reading home').click()
    expect(page.locator('body')).to_have_attribute('data-slug', 'index')
    search()
    page.screenshot(path=str(OUT / f'{label}-repeated-search.png'))
    page.keyboard.press('Escape')
    expect(page.locator('.search-container')).not_to_be_visible()
    expect(page.locator('#essay-pages')).to_be_visible()
    if width < 1280:
        page.keyboard.press('Escape')
    else:
        page.locator('#essay-pages [data-essay-close]').click()
    expect(page.locator('#essay-pages')).not_to_be_visible()
    assert not errors, errors
    return {'root_home': prefix + '/', 'foundation': FOUNDATION, 'native_search': True, 'search_states': search_states, 'searched_record': searched_slug, 'foundation_backlinks': backlink_count, 'first_backlink': backlink_target, 'page_errors': errors}


def main():
    host.dist_guards()
    servers = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for mode, prefix in [('vercel', ''), ('pages', '/O-I')]:
            if mode not in os.environ.get('OI_READER_MODES', 'vercel,pages').split(','): continue
            server, port = host.start(mode, prefix)
            servers.append(server)
            base = f'http://127.0.0.1:{port}'
            for width in map(int, os.environ.get('OI_READER_WIDTHS', '1440,1100,900,390').split(',')):
                label = f'{mode}-{width}'
                context = browser.new_context(viewport={'width': width, 'height': 850}, reduced_motion='reduce')
                page = context.new_page()
                try:
                    evidence = controls(page, base, prefix, width, label)
                    RESULTS.append({'case': label, 'passed': True, **evidence})
                    print('PASS', label, flush=True)
                except Exception as err:
                    RESULTS.append({'case': label, 'passed': False, 'error': str(err), 'traceback': traceback.format_exc()})
                    print('FAIL', label, str(err), flush=True)
                    (OUT / 'reader-controls.json').write_text(json.dumps(RESULTS, indent=2) + '\n')
                    try: page.screenshot(path=str(OUT / f'{label}-failure.png'), timeout=5000)
                    except Exception as screenshot_error: RESULTS[-1]['failure_screenshot_error'] = str(screenshot_error)
                context.close()
            if os.environ.get('OI_READER_DEEP', '1') == '0': continue
            for width in [900, 1440]:
                label = f'{mode}-{width}-deep-routes-and-search'
                context = browser.new_context(viewport={'width': width, 'height': 850})
                page = context.new_page()
                try:
                    evidence = deep_routes(page, base, prefix, label)
                    RESULTS.append({'case': label, 'passed': True, **evidence})
                    print('PASS', label, flush=True)
                except Exception as err:
                    RESULTS.append({'case': label, 'passed': False, 'error': str(err), 'traceback': traceback.format_exc()})
                    print('FAIL', label, str(err), flush=True)
                    (OUT / 'reader-controls.json').write_text(json.dumps(RESULTS, indent=2) + '\n')
                    try: page.screenshot(path=str(OUT / f'{label}-failure.png'), timeout=5000)
                    except Exception as screenshot_error: RESULTS[-1]['failure_screenshot_error'] = str(screenshot_error)
                context.close()
        browser.close()
    for server in servers:
        host.stop(server)
    (OUT / 'reader-controls.json').write_text(json.dumps(RESULTS, indent=2) + '\n')
    raise SystemExit(1 if any(not result['passed'] for result in RESULTS) else 0)


if __name__ == '__main__':
    main()
