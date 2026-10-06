#!/usr/bin/env python3
"""Deep-link smoke against the built dist for the Quartz essay publication.

Vercel mode mirrors vercel.json: folder pages live at trailing-slash URLs
(the pages' relative asset paths require it), file pages resolve path.html,
legacy vault aliases enter the essay, and a missing essay path falls back to
the reading root (200) — an existing page always wins. Pages mode (prefix
/O-I) serves a missing path as essay/404.html with status 404. The essay
must paint the reading surface (the O:I shell's paper or black ground) with the field's graph, the explorer and
the footer breadcrumbs present; / retains the original O:I hero and developed home.
"""
import json, os, sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = Path(os.environ.get('OI_DIST') or ROOT / 'dist')
GROUNDS = ('rgb(251, 250, 246)', 'rgb(11, 11, 12)')  # the shell's paper and black: the essay follows the visitor's light or dark

LEGACY_ALIASES = (
    ('/section-rooms', '/essay/section-rooms/'),
    ('/symbolon', '/essay/symbolon/'),
    ('/manuscript', '/essay/THE-RETURN-OF-ZERO'),
)

CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}


def dist_guards():
    index = (DIST / 'essay' / 'index.html').read_text()
    assert '<title>' in index, 'essay/index.html has no title'
    assert 'graph-container' in index, 'essay/index.html missing the Quartz graph'
    manuscript = (DIST / 'essay' / 'THE-RETURN-OF-ZERO.html').read_text()
    assert 'ahead__title' in manuscript, 'a vault alias overwrote the manuscript reading address'
    assert 'http-equiv="refresh"' not in manuscript, 'manuscript address became an alias redirect'
    stamp = json.loads((DIST / 'essay' / 'quartz-source.json').read_text())
    assert stamp.get('vault_commit'), 'quartz-source.json missing vault commit'
    assert not (DIST / 'essay.html').exists(), 'the stood-down shell stub must not ship'
    assert not (DIST / 'essay-shell').exists(), 'the stood-down shell catalog must not ship'
    assert (DIST / '404.html').read_bytes() == (DIST / 'essay' / '404.html').read_bytes(), \
        '404.html must be the Quartz not-found page'


class DistHandler(BaseHTTPRequestHandler):
    mode = 'vercel'  # 'vercel' resolves clean URLs and falls back to the root; 'pages' 404s
    prefix = ''

    def log_message(self, *args):
        pass

    def resolve(self, raw_path):
        path = raw_path.split('?')[0].split('#')[0]
        if self.prefix and path.startswith(self.prefix):
            path = path[len(self.prefix):]
        rel = path or '/'
        if self.mode == 'vercel':
            for alias, target in LEGACY_ALIASES:
                if rel == alias or rel.startswith(alias + '/'):
                    return ('redirect', target.rstrip('/') + rel[len(alias):])
        if rel == '/essay':
            return ('redirect', '/essay/')
        if rel.startswith('/essay/'):
            tail = rel[len('/essay/'):]
            if not tail:
                file = DIST / 'essay' / 'index.html'
                return (file, 200) if file.is_file() else self.fallback(rel)
            if tail.endswith('/'):
                file = DIST / 'essay' / tail / 'index.html'
                return (file, 200) if file.is_file() else self.fallback(rel)
            if '.' in tail.rsplit('/', 1)[-1]:
                file = DIST / 'essay' / tail
                return (file, 200) if file.is_file() else self.fallback(rel)
            file = DIST / 'essay' / f'{tail}.html'
            if file.is_file():
                return file, 200
            file = DIST / 'essay' / tail / 'index.html'
            if file.is_file():
                return ('redirect', f'/essay/{tail}/')
            return self.fallback(rel)
        if rel == '/' or rel == '':
            file = DIST / 'index.html'
            return (file, 200) if file.is_file() else self.fallback('/')
        if rel.endswith('/'):
            file = DIST / rel.lstrip('/') / 'index.html'
            return (file, 200) if file.is_file() else self.fallback(rel)
        tail = rel.lstrip('/')
        file = DIST / tail
        if file.is_file():
            return file, 200
        file = DIST / f'{tail}.html'
        if file.is_file():
            return file, 200
        return self.fallback(rel)

    def fallback(self, rel):
        if self.mode == 'vercel' and rel.startswith('/essay'):
            return DIST / 'essay' / 'index.html', 200
        return DIST / '404.html', 404

    def do_GET(self):
        resolved = self.resolve(self.path)
        if isinstance(resolved[0], str):
            self.send_response(301)
            self.send_header('Location', resolved[1])
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        file, status = resolved
        body = file.read_bytes()
        self.send_response(status)
        self.send_header('Content-Type', CONTENT_TYPES.get(file.suffix, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def start(mode, prefix):
    handler = type('Handler', (DistHandler,), {'mode': mode, 'prefix': prefix})
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


def stop(server):
    server.shutdown()
    server.server_close()


def main():
    os.chdir(ROOT)
    dist_guards()
    pages_server, pages_port = start('pages', '/O-I')
    vercel_server, vercel_port = start('vercel', '')
    failures = []
    try:
        pages = f'http://127.0.0.1:{pages_port}'
        vercel = f'http://127.0.0.1:{vercel_port}'
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,
                                        args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
            ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
            cases = [
                (f'{vercel}/essay', 200, 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'),
                (f'{vercel}/essay/symbolon/matheme/README', 200, None),
                (f'{vercel}/essay/section-rooms/00-integral-threshold/ROOM-00-integral-threshold', 200, None),
                (f'{vercel}/essay/section-rooms/arguments/A01-Subject-God-and-Faithful-Definition', 200, None),
                (f'{vercel}/essay/symbolon/matheme/diagrams/torus-square-quotient-and-winding', 200, None),
                (f'{vercel}/essay/THE-RETURN-OF-ZERO', 200, 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'),
                (f'{vercel}/essay/section-rooms/00-integral-threshold/movements/01-s01-p0-question-before-mechanism', 200, None),
                (f'{vercel}/essay/section-rooms', 200, None),
                (f'{vercel}/essay/not-a-real-page', 200, 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'),
                (f'{vercel}/symbolon/matheme/README', 200, None),
                (f'{vercel}/manuscript', 200, 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'),
                (f'{pages}/O-I/essay', 200, 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality.'),
                (f'{pages}/O-I/essay/not-a-real-page', 404, None),
            ]
            for url, status, heading in cases:
                page = ctx.new_page()
                errors = []
                page.on('pageerror', (lambda bucket: lambda err: bucket.append(str(err)))(errors))
                try:
                    response = page.goto(url, wait_until='load')
                    assert response is not None and response.status == status, f'status {None if response is None else response.status}'
                    if status == 200:
                        expect(page.locator('.graph-container').first).to_be_attached(timeout=20000)
                        expect(page.locator('.graph-container svg').first).to_be_visible(timeout=20000)
                        expect(page.locator('.explorer').first).to_be_visible(timeout=20000)
                        expect(page.locator('#crumbs')).to_be_visible(timeout=20000)
                        expect(page.locator('body')).to_have_attribute('data-ready', '1', timeout=30000)
                        assert page.locator('.tags').count() == 0, 'tag dump still on the page'
                        assert page.locator('.content-meta').count() == 0, 'content meta still on the page'
                        if page.locator('article p').count() > 0:
                            lh = page.evaluate('parseFloat(getComputedStyle(document.querySelector("article p")).lineHeight) / parseFloat(getComputedStyle(document.querySelector("article p")).fontSize)')
                            assert lh >= 1.6, f'body line-height too tight: {lh}'
                        background = page.evaluate('getComputedStyle(document.body).backgroundColor')
                        assert background in GROUNDS, f'essay background {background}, expected the shell paper or black'
                        if heading:
                            expect(page.locator('#essay-pane .ahead__title')).to_have_text(heading, timeout=20000)
                    else:
                        assert 'Not Found' in page.content(), 'missing path lost the not-found page'
                    assert errors == [], errors
                    shot = None
                    if url.endswith('/essay') and status == 200: shot = 'essay-vercel-root.png'
                    elif url.endswith('/THE-RETURN-OF-ZERO'): shot = 'essay-vercel-manuscript.png'
                    elif 'not-a-real-page' in url: shot = 'essay-vercel-missing.png'
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
                response = page.goto(f'{pages}/O-I/not-a-plate', wait_until='load')
                assert response is not None and response.status == 404
                assert 'Not Found' in page.content()
                print('PASS pages non-essay 404 stays out of the essay', flush=True)
            except Exception as exc:
                failures.append(f'non-essay: {exc}')
                print('FAIL non-essay', exc, flush=True)
            page = ctx.new_page()
            try:
                response = page.goto(f'{vercel}/', wait_until='load')
                assert response is not None and response.status == 200
                expect(page.locator('.graph-container')).to_have_count(0)
                expect(page.locator('.pl')).to_be_visible()
                expect(page.get_by_role('heading', name='The world an agent acts from.', exact=True)).to_have_count(1)
                expect(page.locator('nav[aria-label="Primary"]')).to_be_visible()
                Path('evidence/library').mkdir(parents=True, exist_ok=True)
                page.screenshot(path='evidence/library/essay-vercel-restored-home.png')
                print('PASS vercel / retains the original hero and the redesigned home', flush=True)
            except Exception as exc:
                failures.append(f'restored-home: {exc}')
                print('FAIL restored-home', exc, flush=True)
            browser.close()
    finally:
        stop(pages_server)
        stop(vercel_server)
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
