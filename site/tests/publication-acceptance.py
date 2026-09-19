"""Browser receiving-contract tests. Fixtures are intercepted in tests, never built into dist."""
import json
import os
import subprocess
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('OI_SITE_TEST_URL', 'http://127.0.0.1:4173')
OUT = Path('evidence/library')
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output(['node', 'tests/publication-fixtures.mjs'], text=True))
results = []

def record(name):
    results.append({'test': name, 'status': 'passed', 'basis': 'explicit test-only native publication fixture'})

def query(page):
    return parse_qs(urlparse(page.url).fragment.split('?', 1)[-1])

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    context = browser.new_context(viewport={'width': 1360, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/library.html')
    expect(page.get_by_text('The corpus has not been published to this edition yet.', exact=True)).to_be_visible()
    assert not page.get_by_text('Fixture collection', exact=True).count()
    record('real production build has an honest empty native catalogue, not fixture entries')

    def receive(route):
        path = urlparse(route.request.url).path
        if path.endswith('/published.json'):
            route.fulfill(json=fixture['seed'])
        elif path.endswith('/edition-manifests.json'):
            route.fulfill(json=fixture['manifests'])
        else:
            for edition in fixture['editions']:
                if path.endswith('/editions/' + edition['directory'] + '/index.html'):
                    return route.fulfill(body=edition['html'], content_type='text/html')
                if path.endswith('/editions/' + edition['directory'] + '/projection.json'):
                    return route.fulfill(json=edition['projection'])
            route.continue_()
    context.route('**/data/library/**', receive)
    page.reload()
    page.get_by_role('link', name='Fixture collection', exact=True).first.click()
    expect(page.get_by_role('heading', name='Fixture collection', exact=True)).to_be_visible()
    page.get_by_role('link', name='Fixture subject', exact=True).click()
    expect(page.locator('h1')).to_have_text('Fixture subject')
    assert query(page)['revision'] == ['3']
    record('Library → real-ref collection membership → subject; source revision pinned in URL')

    block = page.locator('[data-reading-at="17"]')
    block.evaluate('(node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 100)')
    page.wait_for_function("new URLSearchParams(location.hash.split('?')[1]).get('at') === '17'")
    before = query(page)['at']
    page.get_by_role('link', name='Expression', exact=True).click()
    expect(page.locator('.native-stage canvas[data-ready="yes"]')).to_be_visible(timeout=45000)
    expect(page.get_by_role('button', name='Play field motion', exact=True)).to_be_visible()
    assert query(page)['expression_revision'] == ['2']
    assert query(page)['expression_projection_revision'] == ['4']
    record('accepted NativeStage renders native Expression; separate revisions and reduced motion retained')
    page.screenshot(path=str(OUT / 'publication-expression-test-fixture.png'), full_page=True)

    page.get_by_role('link', name='Return to Fixture subject at the same reading position').click()
    assert query(page)['at'] == before
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    page.reload()
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    assert query(page)['revision'] == ['3']
    page.go_back()
    expect(page.locator('.native-stage')).to_be_visible()
    page.go_forward()
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    record('Expression → same subject and paragraph; refresh and back/forward preserve exact reading')

    page.get_by_role('link', name='Graph relations', exact=True).click()
    expect(page.get_by_role('heading', name='Declared graph neighbourhood')).to_be_visible()
    expect(page.locator('.publication-relations')).to_contain_text('wiki.contains')
    page.get_by_role('link', name='Source & edition', exact=True).click()
    expect(page.locator('.publication-basis')).to_contain_text('fixture-r1')
    with context.expect_page() as opened:
        page.get_by_role('link', name='Standalone native reading', exact=True).click()
    source = opened.value
    expect(source.locator('body')).to_contain_text('Test-only publication')
    source.close()
    page.get_by_role('link', name='Return to Fixture subject at the same reading position').click()
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    record('permitted native graph/source depth and standalone edition return to unchanged reading')

    exact_url = page.url
    page.goto(exact_url.replace('revision=3', 'revision=99'))
    expect(page.get_by_role('heading', name='This exact reading is unavailable.')).to_be_visible()
    assert not page.locator('[data-reading-at]').count()
    record('missing exact edition is unavailable, never replaced with latest or fixture fallback')

    page.goto(exact_url)
    page.set_viewport_size({'width': 375, 'height': 812})
    expect(page.locator('h1')).to_have_text('Fixture subject')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.keyboard.press('Tab')
    assert page.evaluate("document.activeElement.matches('a,button,input,summary')")
    page.screenshot(path=str(OUT / 'publication-reading-mobile-test-fixture.png'), full_page=True)
    record('narrow screen has no horizontal overflow; keyboard focus reaches controls')

    context.unroute('**/data/library/**', receive)
    page.goto(BASE + '/library.html')
    expect(page.get_by_text('The corpus has not been published to this edition yet.', exact=True)).to_be_visible()
    context.set_offline(True)
    page.get_by_role('link', name='All published subjects', exact=True).click()
    expect(page.get_by_text('You are offline.', exact=False)).to_be_visible()
    record('uncached offline native reading reports unavailability without local/key fallback')
    assert not errors, errors
    browser.close()

(OUT / 'publication-results.json').write_text(json.dumps({'scope': 'receiver contract only, not corpus/hosting acceptance', 'tests': results, 'page_errors': errors}, indent=2))
print(json.dumps({'passed': len(results), 'fixture_scope': 'tests only', 'hosted_acceptance': False}))
