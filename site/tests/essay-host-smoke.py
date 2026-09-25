#!/usr/bin/env python3
"""Deep-link smoke against the built dist, not Vite's rewrite middleware.

Pages mode (prefix /O-I) serves a missing path as 404.html with status 404 and
keeps the URL. Vercel mode rewrites essay routes to essay.html with status 200.
Both must paint the Plate B shell. A planted Quartz file is not part of dist:
the build deletes essay/.
"""
import json, os, signal, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
CATALOG = json.loads((DIST / 'essay-shell' / 'catalog.json').read_text())

def page_json(page_id):
    return json.loads((DIST / 'essay-shell' / 'pages' / f'{page_id}.json').read_text())

ROOT_PAGE = page_json(CATALOG['readingRoot'])
MATHEME = page_json('symbolon/matheme/README')
MANUSCRIPT = page_json(CATALOG['manuscript'])
PHRASE = 'The Integral Threshold'
assert PHRASE in MANUSCRIPT['html'], 'manuscript publication lost its opening section'

def dist_guards():
    essay_html = (DIST / 'essay.html').read_text()
    assert '__OI_SITE_BASE__' in essay_html, 'essay.html missing host bootstrap'
    assert (DIST / '404.html').read_text() == essay_html, '404.html must be the essay shell'
    assert not (DIST / 'essay').exists(), 'Quartz essay/ directory must not be published'
    quartz = [p for p in DIST.rglob('*.html') if 'essay/' in p.relative_to(DIST).as_posix() or p.relative_to(DIST).as_posix() == 'essay']
    assert quartz == [], quartz
    assert 'http-equiv="refresh"' not in essay_html.lower() and "http-equiv='refresh'" not in essay_html.lower()

def start(mode, prefix):
    Path('evidence/library').mkdir(parents=True, exist_ok=True)
    err = open(Path('evidence/library') / f'essay-host-{mode}.log', 'w')
    proc = subprocess.Popen(
        ['node', '--experimental-strip-types', 'essay-host-server.ts', '--mode', mode, '--prefix', prefix, '--dist', 'dist', '--port', '0'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=err, text=True,
    )
    line = proc.stdout.readline().strip()
    if not line.startswith('essay-host '):
        err.flush()
        detail = (Path('evidence/library') / f'essay-host-{mode}.log').read_text()
        raise RuntimeError(f'essay host failed to start: {line} {detail}')
    return proc, int(line.split()[1])

def stop(proc):
    if proc.poll() is None:
        proc.send_signal(signal.SIGTERM)
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired: proc.kill()

def main():
    os.chdir(ROOT)
    dist_guards()
    pages_proc, pages_port = start('pages', '/O-I')
    vercel_proc, vercel_port = start('vercel', '')
    failures = []
    try:
        pages = f'http://127.0.0.1:{pages_port}'
        vercel = f'http://127.0.0.1:{vercel_port}'
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None)
            ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
            cases = [
                (f'{pages}/O-I/essay', 404, ROOT_PAGE['title'], '/O-I/essay', False),
                (f'{pages}/O-I/essay/symbolon/matheme', 404, MATHEME['title'], '/O-I/essay/symbolon/matheme', False),
                (f'{pages}/O-I/essay/read.html', 404, MANUSCRIPT['title'], '/O-I/essay/manuscript/THE-RETURN-OF-ZERO', True),
                (f'{pages}/O-I/essay/not-a-real-page', 404, 'This page is not in the publication.', '/O-I/essay/not-a-real-page', False),
                (f'{pages}/O-I/section-rooms', 404, None, '/O-I/essay/section-rooms', False),
                (f'{vercel}/essay', 200, ROOT_PAGE['title'], '/essay', False),
                (f'{vercel}/essay/symbolon/matheme', 200, MATHEME['title'], '/essay/symbolon/matheme', False),
                (f'{vercel}/essay/read.html', 200, MANUSCRIPT['title'], '/essay/manuscript/THE-RETURN-OF-ZERO', True),
                (f'{vercel}/essay/not-a-real-page', 200, 'This page is not in the publication.', '/essay/not-a-real-page', False),
                (f'{vercel}/symbolon/matheme', 200, MATHEME['title'], '/essay/symbolon/matheme', False),
            ]
            for url, status, heading, address, manuscript in cases:
                page = ctx.new_page()
                errors = []
                page.on('pageerror', (lambda bucket: lambda err: bucket.append(str(err)))(errors))
                try:
                    response = page.goto(url, wait_until='domcontentloaded')
                    assert response is not None and response.status == status, f'status {None if response is None else response.status}'
                    expect(page.locator('.essay-top')).to_be_visible(timeout=20000)
                    if heading:
                        expect(page.locator('h1')).to_have_text(heading, timeout=20000)
                    else:
                        expect(page.locator('h1')).to_be_visible(timeout=20000)
                        assert 'not on the site' not in page.locator('h1').inner_text()
                    assert address in page.url, page.url
                    if manuscript:
                        body = page.locator('.body').inner_text()
                        assert PHRASE in body, 'manuscript body missing'
                        assert 'http-equiv' not in page.locator('.body').inner_html()
                    if 'not-a-real-page' in url:
                        assert 'Choose a file from the folder on the left.' in page.locator('.read').inner_text()
                    assert errors == [], errors
                    shot = None
                    if url.endswith('/O-I/essay/symbolon/matheme'): shot = 'essay-pages-matheme.png'
                    elif url.endswith('/O-I/essay/read.html'): shot = 'essay-pages-manuscript.png'
                    elif url.endswith('/O-I/essay/not-a-real-page'): shot = 'essay-pages-missing.png'
                    elif url.endswith('/essay') and status == 200: shot = 'essay-vercel-root.png'
                    if shot:
                        target = Path('evidence/library')
                        target.mkdir(parents=True, exist_ok=True)
                        page.screenshot(path=str(target / shot))
                    print('PASS', url, flush=True)
                except Exception as exc:
                    failures.append(f'{url}: {exc}')
                    print('FAIL', url, exc, flush=True)
                finally:
                    page.close()
            page = ctx.new_page()
            try:
                response = page.goto(f'{pages}/O-I/not-a-plate', wait_until='domcontentloaded')
                assert response is not None and response.status == 404
                expect(page.locator('h1')).to_have_text('This page is not on the site.')
                expect(page.locator('.essay-top')).to_have_count(0)
                print('PASS pages non-essay 404 stays out of the shell', flush=True)
            except Exception as exc:
                failures.append(f'non-essay: {exc}')
                print('FAIL non-essay', exc, flush=True)
            page = ctx.new_page()
            try:
                response = page.goto(f'{vercel}/', wait_until='domcontentloaded')
                assert response is not None and response.status == 200
                expect(page.locator('.essay-top')).to_have_count(0)
                expect(page.locator('.pl')).to_be_visible()
                Path('evidence/library').mkdir(parents=True, exist_ok=True)
                page.screenshot(path='evidence/library/essay-vercel-plate-a.png')
                print('PASS vercel / stays on Plate A', flush=True)
            except Exception as exc:
                failures.append(f'plate-a: {exc}')
                print('FAIL plate-a', exc, flush=True)
            browser.close()
    finally:
        stop(pages_proc)
        stop(vercel_proc)
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
