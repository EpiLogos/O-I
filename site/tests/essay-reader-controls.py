#!/usr/bin/env python3
"""Replay the real essay reader — the Quartz layout redesigned as essay + field — in a real browser.

Serves the built essay (.public-edition/essay) under both host bases (site root and the /O-I Pages prefix), then
drives it at desktop, tablet and phone widths: one locus drives every region; the graph is draggable and filterable;
following things from the field or the text opens a tangent tab beside the essay; the explorer, pager and
breadcrumbs turn the main page itself. Nothing is mocked.

    python3 tests/essay-reader-controls.py            (after `npm run build:essay-quartz`)
"""
import importlib.util
import json
import os
import sys
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
spec = importlib.util.spec_from_file_location('essay_host', HERE / 'essay-host-smoke.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
host.DIST = Path(os.environ.get('OI_ESSAY_PUBLIC') or ROOT / '.public-edition')   # the essay alone is enough: /essay/** is what the reader serves
OUT = Path(os.environ.get('OI_READER_EVIDENCE', str(ROOT / 'evidence/essay-reader')))
OUT.mkdir(parents=True, exist_ok=True)
MS = 'THE-RETURN-OF-ZERO'
M16 = 'section-rooms/02-return-of-zero/movements/16-s1-p3-crossed-zero'
RESULTS = []


def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  — {detail}' if detail else ''), flush=True)


def ready(page, settle=900):
    page.wait_for_selector('body[data-ready="1"]', timeout=30000)
    page.wait_for_timeout(settle)


def desktop(page, base, prefix, label):
    ev = page.evaluate
    url = f'{base}{prefix}/essay/{MS}?m=16'
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('requestfailed', lambda r: errors.append(f'request failed: {r.url}'))
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    response = page.goto(url, wait_until='load')
    check(f'[{label}] manuscript loads', response.status == 200)
    ready(page, 1500)

    # anatomy and styling
    big = ev("[...document.querySelectorAll('svg:not(#graph-svg)')].filter(s=>!s.closest('.katex')).filter(s=>s.getBoundingClientRect().width>24).map(s=>s.outerHTML.slice(0,90)+' '+s.getBoundingClientRect().width)")
    check(f'[{label}] every icon is at most 24px (the stylesheet applied)', not big, str(big[:2]))
    cols = ev("(()=>{const r=id=>document.querySelector(id).getBoundingClientRect();return [r('#left').width,r('#center').width,r('#right').width]})()")
    check(f'[{label}] left sidebar · centre · right sidebar side by side', cols[0] > 250 and cols[1] > 500 and cols[2] > 300, '%.0f / %.0f / %.0fpx' % tuple(cols))
    check(f'[{label}] the real corpus', ev('OI.D.nodes.length') >= 800 and len(ev('Object.keys(OI.D.moves)')) == 48, f"{ev('OI.D.nodes.length')} pages")
    check(f'[{label}] contract: the right sidebar keeps .graph-container', ev("!!document.querySelector('#right .graph-container svg')"))
    check(f'[{label}] contract: the shell link goes to the site root', ev("new URL(document.querySelector('.page-title__mark').href).pathname") == (prefix or '') + '/')
    check(f'[{label}] corpus scaffolding is not shown (Where you are / Write here)', ev("![...document.querySelectorAll('article p')].some(p=>/^(Write here|Where you are|Open beside it)\\s*:/.test(p.textContent))"))
    check(f'[{label}] no literal [[wikilinks]] left in the manuscript', ev("!document.querySelector('article').textContent.includes('[[')"))

    # one locus drives every region
    check(f'[{label}] deep link: position chip M16', 'M16' in ev("document.querySelector('#head-pos').innerText"))
    check(f'[{label}] graph centred on M16', 'M16' in ev("document.querySelector('.gn--focus text').textContent"))
    check(f'[{label}] contents marks M16', ev("document.querySelector('#toc a.is-here')?.dataset.m") == '16')
    check(f'[{label}] explorer marks the reading room', ev("document.querySelectorAll('.tn__row.is-reading').length") >= 1)
    check(f'[{label}] connections grouped by register', ev("document.querySelectorAll('#conn-body .conn__g').length") >= 3)
    check(f'[{label}] the movements are not listed in the explorer (the contents list is their one menu)', ev("![...document.querySelectorAll('#tree .tn__label')].some(l=>l.textContent.trim()==='Movements')"))
    check(f'[{label}] plates are not a first-class group', ev("![...document.querySelectorAll('#tree .tn--section .tn__label, #tree .tn--folder > .tn__row .tn__label')].some(l=>/^Plates/i.test(l.textContent.trim()))"))
    plate = ev("[...document.querySelectorAll('figure.fig')].some(x=>x.textContent.includes('Plate 2'))")
    check(f'[{label}] the authored plate follows its M16 anchor as a figure with a caption' + ('' if plate else ' (this edition carries no plate: skipped)'), not plate or ev("(()=>{const f=[...document.querySelectorAll('figure.fig')].find(x=>x.textContent.includes('Plate 2'));const a=document.querySelector('a#M16');return !!f&&a.getBoundingClientRect().top<f.getBoundingClientRect().top&&f.querySelector('img').alt.length>40&&f.querySelector('figcaption').innerText.length>150})()"))
    check(f'[{label}] the figure image really loaded', not plate or ev("(()=>{const f=[...document.querySelectorAll('figure.fig')].find(x=>x.textContent.includes('Plate 2'));const i=f.querySelector('img');return i.complete&&i.naturalWidth>100})()"))
    page.screenshot(path=str(OUT / f'{label}-01-manuscript-m16.png'))

    # reading moves the graph
    ev("(()=>{const s=document.querySelector('#scroller');const a=document.querySelector('a#M30');s.scrollTo({top:a.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop+10})})()")
    page.wait_for_timeout(900)
    check(f'[{label}] scroll to M30: state, rail, contents and graph follow', ev('OI.S.cur.m') == 30 and ev("document.querySelector('.mrail__t.is-here')?.dataset.m") == '30' and ev("document.querySelector('#toc a.is-here')?.dataset.m") == '30' and 'M30' in ev("document.querySelector('.gn--focus text').textContent"))
    check(f'[{label}] the address bar follows the reading position (?m=)', ev("new URLSearchParams(location.search).get('m')") == '30')

    # graph: click selects, drag moves, double-click opens a tangent
    nid = ev("+document.querySelector('.gn:not(.gn--focus)').dataset.i")
    box = page.locator(f'.gn[data-i="{nid}"] circle.n').bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.click(cx, cy); page.wait_for_timeout(300)
    check(f'[{label}] click selects (card with an Open button) and does not navigate', ev("!document.querySelector('#gcard').hidden") and ev('OI.S.cur.m') == 30 and ev('OI.T.list.length') == 1)
    before = ev(f"document.querySelector('.gn[data-i=\"{nid}\"]').getAttribute('transform')")
    page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 40, cy + 30, steps=6); page.mouse.up(); page.wait_for_timeout(400)
    after = ev(f"document.querySelector('.gn[data-i=\"{nid}\"]').getAttribute('transform')")
    check(f'[{label}] dragging a node moves it', before != after and ev('OI.T.list.length') == 1, f'{before} → {after}')
    b2 = page.locator(f'.gn[data-i="{nid}"] circle.n').bounding_box()
    page.mouse.dblclick(b2['x'] + b2['width'] / 2, b2['y'] + b2['height'] / 2); page.wait_for_timeout(1500)
    check(f'[{label}] double-click opens a tangent tab; the essay tab is kept', ev('OI.T.list.length') == 2 and ev('OI.T.list[1].preview') is True and ev('OI.S.cur.i') == nid and ev('OI.T.list[0].main'), ev('OI.D.nodes[OI.S.cur.i].lab'))
    check(f'[{label}] the tangent shows its own text, the essay stays mounted', ev("!document.querySelector('#tangent-pane').hidden && document.querySelector('#essay-pane').hidden && document.querySelector('#tangent-pane .ahead__title')?.textContent.length>3 && !!document.querySelector('#tangent-pane article')"))
    check(f'[{label}] the tab strip shows both pages, the tangent in italics', ev("document.querySelectorAll('.tab').length") == 2 and ev("!!document.querySelector('.tab--preview')"))
    page.screenshot(path=str(OUT / f'{label}-02-tangent.png'))
    nid2 = ev("+document.querySelector('.gn:not(.gn--focus)').dataset.i")
    b3 = page.locator(f'.gn[data-i="{nid2}"] circle.n').bounding_box()
    page.mouse.dblclick(b3['x'] + b3['width'] / 2, b3['y'] + b3['height'] / 2); page.wait_for_timeout(1200)
    check(f'[{label}] a second tangent replaces the preview instead of piling up', ev('OI.T.list.length') == 2)
    page.dblclick('.tab--preview'); page.wait_for_timeout(200)
    check(f'[{label}] double-clicking a preview tab keeps it', ev("!document.querySelector('.tab--preview')"))
    page.click('.tab--main'); page.wait_for_timeout(1200)
    check(f'[{label}] back on the essay tab the position is kept (M30)', ev('OI.S.cur.m') == 30 and 'M30' in ev("document.querySelector('#head-pos').innerText") and ev("document.querySelector('#essay-pane').hidden") is False)
    page.click('.tab >> nth=1 >> .tab__x:not(.tab__up)'); page.wait_for_timeout(700)
    check(f'[{label}] closing a tangent returns to the essay', ev('OI.T.list.length') == 1 and ev('OI.T.list[0].main'))

    # in-text link → tangent; connections → tangent; promote → main
    link = page.locator('#essay-pane article a.internal[data-slug]').first
    href = link.get_attribute('data-slug')
    link.scroll_into_view_if_needed(); link.click(); page.wait_for_timeout(1500)
    check(f'[{label}] a link in the text opens a tangent (the essay keeps its place)', ev('OI.T.list.length') == 2 and ev('OI.T.list[0].main') and href.split('/')[-1] in ev('OI.D.nodes[OI.S.cur.i].s'), href)
    page.click('.tab--preview .tab__up'); page.wait_for_timeout(1800)
    check(f'[{label}] "open as the main page" is a real navigation', ev('OI.T.list.length') == 1 and href.split('/')[-1] in ev("document.body.dataset.slug") and href.split('/')[-1] in ev('location.pathname'))

    # filters: one toolbar menu, shared by graph and connections
    page.goto(f'{base}{prefix}/essay/{M16}'); ready(page)
    n0 = ev("document.querySelectorAll('.gn').length"); c0 = ev("document.querySelectorAll('#conn-body li').length")
    page.click('#graph-filter'); page.wait_for_timeout(200)
    check(f'[{label}] filter is one icon that opens one menu', ev("!document.querySelector('#gmenu').hidden") and ev("document.querySelectorAll('#gmenu .gm__row').length") >= 5)
    page.click('#gmenu input[data-reg="essay"] + i'); page.wait_for_timeout(400)
    n1 = ev("document.querySelectorAll('.gn').length"); c1 = ev("document.querySelectorAll('#conn-body li').length")
    check(f'[{label}] hiding a register removes its nodes from graph and connections', n1 < n0 and c1 < c0 and ev("![...document.querySelectorAll('.gn:not(.gn--focus)')].some(g=>OI.D.nodes[+g.dataset.i].r==='essay')"), f'{n0}→{n1} nodes, {c0}→{c1} rows')
    check(f'[{label}] a dot says a filter is active', ev("document.querySelector('#graph-filter').classList.contains('is-on')"))
    page.click('#gmenu [data-all]'); page.wait_for_timeout(300)
    page.click('#gmenu [data-depth="2"]'); page.wait_for_timeout(400)
    check(f'[{label}] two hops reaches further', ev("document.querySelectorAll('.gn').length") > n0)
    page.click('#gmenu [data-depth="1"]'); page.keyboard.press('Escape')
    page.click('#graph-filter'); page.wait_for_timeout(200)   # closes the menu

    # footer breadcrumbs and the pager turn the main page
    crumbs = ev("[...document.querySelectorAll('#crumbs .cr__l')].map(e=>e.textContent.trim())")
    check(f'[{label}] footer breadcrumbs are structural, not slugs', crumbs[:2] == ['Essay', 'Section-rooms'] and crumbs[-1] == 'The Crossed Zero' and ev("document.querySelector('.center-foot').getBoundingClientRect().bottom") >= ev('innerHeight') - 4, ' › '.join(crumbs))
    check(f'[{label}] every crumb is a way back (a link, or a button that opens what is in the folder)', ev("[...document.querySelectorAll('#crumbs .cr:not(.cr--cur) .cr__l')].every(e=>e.tagName==='A'||e.tagName==='BUTTON')"))
    page.click('#crumbs .cr__f'); page.wait_for_timeout(300)
    check(f'[{label}] a folder crumb opens its contents (the movements of the room)', ev("document.querySelectorAll('.cpop li').length") >= 5 and 'Movements' in ev("document.querySelector('.cpop__h').textContent"))
    page.keyboard.press('Escape'); page.mouse.click(5, 5)
    page.click('#crumbs a.cr__l >> nth=1'); page.wait_for_timeout(1500)
    check(f'[{label}] clicking a crumb goes back through the pages', 'section-rooms' in ev('location.pathname') and 'movements/16' not in ev('location.pathname'), ev('location.pathname'))
    page.go_back(); page.wait_for_timeout(1500)
    page.click('#crumbs .cr__s >> nth=2'); page.wait_for_timeout(300)
    check(f'[{label}] a separator opens that level\'s siblings', ev("document.querySelectorAll('.cpop li').length") >= 3)
    page.keyboard.press('Escape')
    page.click('.pager__next'); page.wait_for_timeout(1800)
    check(f'[{label}] the pager turns the main page (single page application navigation, no reload)', 'movements/17-' in ev('location.pathname') and ev('OI.T.list.length') == 1)
    check(f'[{label}] after the turn the explorer and graph follow', ev("!!document.querySelector('.tn.has-current')") and 'M17' in ev("document.querySelector('.gn--focus text').textContent"))

    # explorer rows navigate the main page; tangents survive the turn
    page.go_back(); page.wait_for_timeout(1500)
    page.evaluate("OI.openTangent(OI.D.bySlug.get('symbolon/README').i)"); page.wait_for_timeout(1200)
    row = page.locator('#tree .tn__label', has_text='Reading home').first
    row.scroll_into_view_if_needed(); row.click(); page.wait_for_timeout(1800)
    check(f'[{label}] an explorer row turns the main page and the tangent tab stays', ev('OI.T.list.length') == 2 and ev('OI.T.list[0].main') and ev('document.body.dataset.slug') == 'index')

    # search
    page.keyboard.press('Control+k'); page.wait_for_timeout(200)
    page.keyboard.type('sunya', delay=30); page.wait_for_timeout(900)
    check(f'[{label}] titles and paths answer at once, before the full text arrives', ev("document.querySelectorAll('#results .hit').length") >= 1)
    try:
        page.wait_for_function("/· full text$/.test(document.querySelector('#q-status').textContent)", timeout=45000)
    except Exception:
        raise AssertionError('full text never arrived: status=%r query=%r errors=%s' % (ev("document.querySelector('#q-status').textContent"), ev("document.querySelector('#q').value"), errors[:4]))
    hits = ev("document.querySelectorAll('#results .hit').length")
    check(f'[{label}] full text finds pages and says where each lives', hits >= 3 and ev("document.querySelector('#results .hit__where').textContent.length") > 3 and ev("document.querySelectorAll('#q-hist .sh').length") == 6, f'{hits} hits')
    page.keyboard.press('Enter'); page.wait_for_timeout(1500)
    check(f'[{label}] Enter opens the best hit as a tangent', ev("!!document.querySelector('.tab--preview')") or ev('OI.T.list.length') >= 2)
    page.keyboard.press('Escape')

    # lightbox, theme, views
    page.goto(f'{base}{prefix}/essay/{MS}?m=16'); ready(page, 1500)
    if ev("!!document.querySelector('figure.fig img')"):
        page.locator('figure.fig img').first.click(); page.wait_for_timeout(400)
        check(f'[{label}] clicking a figure opens the lightbox', ev("document.querySelector('#lightbox').open") and ev("document.querySelector('#lightbox img').naturalWidth")>100)
        page.keyboard.press('Escape'); page.wait_for_timeout(200)
    theme0 = ev("document.documentElement.getAttribute('saved-theme')"); bg0 = ev("getComputedStyle(document.body).backgroundColor")
    page.click('[data-act="theme"]'); page.wait_for_timeout(300)
    theme1 = ev("document.documentElement.getAttribute('saved-theme')"); bg1 = ev("getComputedStyle(document.body).backgroundColor")
    check(f'[{label}] theme toggles light/dark and remembers it', theme0 != theme1 and bg0 != bg1 and ev("localStorage.getItem('theme')") == theme1, f'{theme0}:{bg0} → {theme1}:{bg1}')
    page.screenshot(path=str(OUT / f'{label}-03-{theme1}.png'))
    page.click('[data-act="theme"]')
    page.keyboard.press('2'); page.wait_for_timeout(700)
    cols = ev("(()=>{const r=id=>document.querySelector(id).getBoundingClientRect();return [r('#center').width,r('#right').width]})()")
    check(f'[{label}] Split gives the field half the width', abs(cols[0] - cols[1]) < 140, '%.0f / %.0f' % tuple(cols))
    page.screenshot(path=str(OUT / f'{label}-04-split.png'))
    page.keyboard.press('3'); page.wait_for_timeout(700)
    cols = ev("(()=>{const r=id=>document.querySelector(id).getBoundingClientRect();return [r('#center').width,r('#right').width]})()")
    check(f'[{label}] Field makes the graph the large pane', cols[1] > cols[0] and ev("document.querySelector('#graph-container').getBoundingClientRect().width") > 500, '%.0f / %.0f' % tuple(cols))
    page.screenshot(path=str(OUT / f'{label}-05-field.png'))
    page.keyboard.press('1'); page.wait_for_timeout(500)
    page.click('#right [data-act="right-toggle"]'); page.wait_for_timeout(500)
    check(f'[{label}] the field can be put away to a rail and the essay widens', ev("document.querySelector('#right').getBoundingClientRect().width") < 80)
    page.click('.rail-right [data-act="right-toggle"]'); page.wait_for_timeout(400)
    check(f'[{label}] no horizontal overflow', ev('document.documentElement.scrollWidth <= innerWidth + 1'))
    library(page, base, prefix, label)
    check(f'[{label}] no page errors', not errors, '; '.join(errors[:3]))
    graph_interaction_checks(page, base, prefix, label)


def library(page, base, prefix, label):
    """The Expression layer: marks on the field, chips on the page, the gallery as a view, an Expression as a tab."""
    ev = page.evaluate
    # a stand-in for the shell's renderer: the real one is the shell's expression.html (tests/expression-render.py)
    real = (host.DIST / 'expression.html').is_file()    # served from a built dist: the real renderer; else a stand-in
    if not real:
        page.route('**/expression.html*', lambda route: route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>x</title><p id="x">expression frame</p>'))
    page.evaluate("sessionStorage.clear()")
    page.goto(f'{base}{prefix}/essay/{M16}'); ready(page)
    check(f'[{label}] a page with an Expression says so, under its title', ev("document.querySelectorAll('#essay-pane .ahead__x .xchip').length") >= 1 and ev("document.querySelector('.xchip').dataset.x") == 'roz-room-02-return-of-zero')
    check(f'[{label}] explorer rows mark the pages that have an Expression', ev("document.querySelectorAll('#tree .tn__x').length") >= 3)
    check(f'[{label}] the graph rings the nodes that have an Expression', ev("document.querySelectorAll('.gn.has-x circle.xr').length") >= 3)
    page.keyboard.press('4'); page.wait_for_timeout(1500)
    check(f'[{label}] the Library is a fourth view: the gallery in the centre, the field beside it', ev("document.querySelector('#quartz-root').dataset.view") == 'library' and ev("!document.querySelector('#library-pane').hidden") and ev("document.querySelector('#essay-pane').hidden") and ev("document.querySelector('#right').getBoundingClientRect().width") > 250)
    cards = ev("document.querySelectorAll('#library-pane .xcard').length")
    check(f'[{label}] the gallery carries the whole curated collection (135 Expressions)', cards == 135, str(cards))
    check(f'[{label}] covers are real images', ev("(()=>{const i=document.querySelector('#library-pane .xcard img'); return i && (i.complete ? i.naturalWidth > 100 : true)})()"))
    here = ev("document.querySelector('#library-pane [data-here]').textContent")
    check(f'[{label}] "Here" counts the Expressions about this page and its neighbourhood', 'Here · ' in here and int(here.split('·')[1]) >= 3, here)
    page.click('#library-pane [data-here]'); page.wait_for_timeout(300)
    check(f'[{label}] "Here" narrows the gallery to them, and marks them', 3 <= ev("document.querySelectorAll('#library-pane .xcard').length") < 20 and ev("document.querySelectorAll('#library-pane .xcard.is-here').length") == ev("document.querySelectorAll('#library-pane .xcard').length"))
    page.click('#library-pane [data-here]'); page.click('#library-pane [data-coll="mytheme"]'); page.wait_for_timeout(300)
    check(f'[{label}] a collection filters the gallery', ev("document.querySelectorAll('#library-pane .xcard').length") == 25)
    page.fill('#library-pane .xsearch input', 'prisoner'); page.wait_for_timeout(400)
    check(f'[{label}] search finds an Expression by what it says', ev("document.querySelectorAll('#library-pane .xcard').length") == 1 and 'Prisoner' in ev("document.querySelector('#library-pane .xcard strong').textContent"))
    page.click('#library-pane [data-mode="rows"]'); page.wait_for_timeout(300)
    check(f'[{label}] the column view is the same list in rows', ev("!!document.querySelector('#library-pane .xrows')"))
    page.click('#library-pane .xcard__open'); page.wait_for_timeout(1500)
    check(f'[{label}] opening a card opens the Expression as a tab, in the centre, with the full renderer in a frame', ev('OI.T.list.length') == 2 and ev('OI.T.list[1].x') == 'roz-mytheme-the-prisoner' and ev("document.querySelector('#quartz-root').dataset.view") == 'essay' and ev("document.querySelector('#tangent-pane iframe.xframe')?.src.includes('expression.html?x=roz-mytheme-the-prisoner')"))
    check(f'[{label}] the frame is told the theme and embedded', 'embed=1' in ev("document.querySelector('iframe.xframe').src") and 'theme=' in ev("document.querySelector('iframe.xframe').src"))
    check(f'[{label}] the tab strip shows it as an Expression', ev("!!document.querySelector('.tab--x')") and ev("document.querySelector('.tab--x').getAttribute('aria-selected')") == 'true')
    scenes = ev("document.querySelectorAll('#toc a[data-xscene]').length")
    check(f'[{label}] its contents are its scenes', scenes == 5, str(scenes))
    check(f'[{label}] the graph follows the pages it is about (the Prisoner\'s record)', 'Prisoner' in ev("document.querySelector('.gn--focus text')?.textContent || ''"))
    if real:
        frame = next(f for f in page.frames if 'expression.html' in f.url)
        frame.wait_for_function("(()=>{const c=document.querySelector('canvas');return !!c && c.dataset.rendered==='true' && Number(c.dataset.frames)>=1})()", timeout=120000)
        check(f'[{label}] the real renderer plays the Expression inside the tab (live field, verified body)', True)
        sc = ev("document.querySelectorAll('#toc a[data-xscene]')[2].dataset.xscene")
        page.click("#toc a[data-xscene] >> nth=2"); page.wait_for_timeout(1200)
        check(f'[{label}] choosing a scene in the essay\'s contents changes the scene in the frame', frame.evaluate("new URLSearchParams(location.search).get('scene')") == sc)
        frame.click('.xp-essay a >> nth=0'); page.wait_for_timeout(1500)
        check(f'[{label}] a page named inside the Expression opens as its own tab, the Expression stays', ev('OI.T.list.length') == 3 and ev("OI.T.list.some(t=>t.x==='roz-mytheme-the-prisoner')") and ev("!OI.T.list[OI.T.active].x"))
        page.click('.tab:not(.tab--x):not(.tab--main) .tab__x:not(.tab__up)'); page.wait_for_timeout(500)
        page.click('.tab--x'); page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / f'{label}-06-expression-tab.png'))
    page.click('.tab--x .tab__x:not(.tab__up)'); page.wait_for_timeout(600)
    check(f'[{label}] closing it returns to the page', ev("!OI.T.list.some(t=>t.x)") and ev("!document.querySelector('iframe.xframe')"))
    page.keyboard.press('4'); page.wait_for_timeout(600)
    check(f'[{label}] the gallery keeps its filters', ev("document.querySelector('#library-pane .xsearch input').value") == 'prisoner')
    page.keyboard.press('1'); page.wait_for_timeout(600)
    check(f'[{label}] back to reading: the page is where it was left', ev("!document.querySelector('#essay-pane').hidden") and ev("document.querySelector('#library-pane').hidden"))
    # a page's own chip opens its Expression the same way
    page.click('#essay-pane .xchip'); page.wait_for_timeout(1200)
    check(f'[{label}] a page\'s Expression chip opens it as a tab', ev('OI.T.list.length') == 2 and ev('OI.T.list[1].x') == 'roz-room-02-return-of-zero')


def narrow(page, base, prefix, label):
    ev = page.evaluate
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'{base}{prefix}/essay/{MS}?m=20', wait_until='load'); ready(page, 1500)
    check(f'[{label}] no horizontal overflow', ev('document.documentElement.scrollWidth <= innerWidth + 1'))
    check(f'[{label}] bottom bar: Essay · Split · Field · Library · Search (Browse lives in the header, once)', ev("document.querySelectorAll('.bottombar button').length") == 5 and ev("document.querySelectorAll('[data-act=browse-drawer]').length") == 1 and ev("getComputedStyle(document.querySelector('.bottombar')).display") != 'none')
    check(f'[{label}] the explorer is a drawer, closed at first', ev("document.querySelector('#left').getBoundingClientRect().right") <= 2)
    page.click('.head-browse'); page.wait_for_timeout(500)
    ex = ev("(()=>{const e=document.querySelector('#explorer');const r=e.getBoundingClientRect();return [e.scrollHeight,e.clientHeight,r.top,r.bottom,innerHeight]})()")
    check(f'[{label}] the drawer is as tall as the screen, so the explorer can scroll', ex[3] <= ex[4] + 1 and ex[2] >= 0 and ex[0] > ex[1], str(ex))
    page.mouse.move(150, 300); page.mouse.wheel(0, 500); page.wait_for_timeout(300)
    check(f'[{label}] the explorer scrolls', ev("document.querySelector('#explorer').scrollTop") > 0)
    check(f'[{label}] Browse opens the drawer', ev("document.querySelector('#left').getBoundingClientRect().left") >= -2 and ev("document.querySelector('#left').getBoundingClientRect().width") > 250)
    page.screenshot(path=str(OUT / f'{label}-01-drawer.png'))
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    check(f'[{label}] Escape puts the drawer away', ev("document.querySelector('#left').getBoundingClientRect().right") <= 2)
    page.click('.bottombar [data-view="field"]'); page.wait_for_timeout(800)
    check(f'[{label}] Field shows the graph alone', ev("document.querySelector('#graph-container').getBoundingClientRect().width") > 300 and ev("document.querySelector('#center').getBoundingClientRect().height") < 5)
    page.screenshot(path=str(OUT / f'{label}-02-field.png'))
    page.click('.bottombar [data-view="split"]'); page.wait_for_timeout(800)
    check(f'[{label}] Split stacks essay over field', ev("document.querySelector('#center').getBoundingClientRect().bottom") <= ev("document.querySelector('#right').getBoundingClientRect().top") + 2)
    page.click('.bottombar [data-view="essay"]'); page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f'{label}-03-essay.png'))
    check(f'[{label}] no page errors', not errors, '; '.join(errors[:3]))
    graph_touch_checks(page, base, prefix, label)


# ───────── graph interaction checks (own block: the graph is a live force layout you can handle) ─────────
# Corpus-agnostic: nothing here names a page other than the manuscript's movement 16, which every edition carries.


def g_centre(page, nid):
    b = page.locator(f'.gn[data-i="{nid}"] circle.n').bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2


def g_positions(page):
    return page.evaluate("Object.fromEntries(OI.graph.nodes().map(n=>[n.i,[n.x,n.y]]))")


def g_still(page):
    """Wait for the graph's own animation (fit, zoom buttons, a held drag) to finish: frames can be slow in software GL."""
    page.wait_for_function('!OI.graph.moving()', timeout=60000)


def g_empty_spot(page):
    """A point inside the graph that is neither a node, nor the card, nor a control."""
    return page.evaluate("""(()=>{const r=document.querySelector('#graph-svg').getBoundingClientRect();
      for(let y=r.top+r.height*0.9;y>r.top+20;y-=14)for(let x=r.left+r.width*0.35;x<r.right-20;x+=14){const t=document.elementFromPoint(x,y);
        if(t&&t.closest('#graph-svg')&&!t.closest('.gn')&&!t.closest('.gcard')&&!t.closest('.gzoom'))return [x,y]}return null})()""")


def graph_interaction_checks(page, base, prefix, label):
    """Click selects, double-click opens, drag moves the node and its neighbours without navigating, the view pans and zooms
    about the cursor, the keyboard walks the graph, and it all survives a single-page navigation."""
    ev = page.evaluate
    errs = []
    on_err = lambda e: errs.append(str(e))
    on_con = lambda m: errs.append(m.text) if m.type == 'error' else None
    page.on('pageerror', on_err); page.on('console', on_con)
    page.goto(f'{base}{prefix}/essay/{MS}?m=16&view=field'); ready(page, 1500)
    L = f'[{label}] graph:'
    check(f'{L} the graph is one tab stop, announced as an interactive graph', ev("(()=>{const s=document.querySelector('#graph-svg');return s.tabIndex===0&&s.getAttribute('role')==='application'&&/Arrow keys/.test(s.getAttribute('aria-label'))})()"))
    ids = ev("OI.graph.nodes().filter(n=>!n.focus).map(n=>n.i)")
    check(f'{L} there are nodes to handle (at least 6)', len(ids) >= 6, str(len(ids)))
    nid = ids[0]
    # a 4 px dot is still a fair target: 8 px off its centre still lands on it
    x, y = g_centre(page, nid)
    hit = ev(f"(()=>{{const t=document.elementFromPoint({x + 8},{y});return t&&t.closest('.gn')?.dataset.i}})()")
    check(f'{L} the hit area is larger than the dot', str(hit) == str(nid), f'{hit} vs {nid}')
    # click selects: the node and its neighbourhood stay lit, the card offers the page; it does not navigate
    page.mouse.click(x, y); page.wait_for_timeout(300)
    check(f'{L} click selects one node and lights its neighbourhood', ev("document.querySelectorAll('.gn.is-sel').length") == 1 and ev("document.querySelector('#graph-svg').classList.contains('has-sel')") and ev("document.querySelectorAll('.gn.is-near').length") >= 2 and ev('OI.graph.selected()') == nid)
    check(f'{L} the card names the page, its neighbours, and offers Open page', ev("!document.querySelector('#gcard').hidden") and 'Open page' in ev("document.querySelector('#gcard [data-open]')?.textContent||''") and 'neighbours' in ev("document.querySelector('#gcard').textContent") and ev('OI.T.list.length') == 1)
    page.wait_for_timeout(1000); x, y = g_centre(page, nid)   # a second click, after the double-click window, keeps the selection
    page.mouse.click(x, y); page.wait_for_timeout(300)
    check(f'{L} clicking the selected node again does not toggle it off', ev('OI.graph.selected()') == nid)
    spot = g_empty_spot(page)
    check(f'{L} there is empty space to pan', spot is not None)
    if spot:
        page.mouse.click(*spot); page.wait_for_timeout(200)
        check(f'{L} clicking empty space lets go', ev('OI.graph.selected()') is None and ev("document.querySelector('#gcard').hidden"))
    # drag: the node follows, the others re-settle, nothing is opened or selected by the drag
    x, y = g_centre(page, nid)
    before = g_positions(page); mid = None
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 20, y + 15, steps=4); page.mouse.move(x + 70, y + 50, steps=8); page.wait_for_timeout(250)
    mid = g_positions(page)
    held = ev(f"OI.graph.nodes().find(n=>n.i=={nid}).fx!=null")
    page.mouse.up(); page.wait_for_timeout(900)
    after = g_positions(page)
    d = lambda a, b, i: ((a[str(i)][0] - b[str(i)][0]) ** 2 + (a[str(i)][1] - b[str(i)][1]) ** 2) ** 0.5
    others = [i for i in before if int(i) != nid and d(mid, before, i) > 0.5]
    check(f'{L} dragging pins the node under the pointer while held', held and 60 < d(mid, before, nid) < 120, f'{d(mid, before, nid):.0f}px')
    check(f'{L} dragging a node moves what it is linked to (live re-simulation)', len(others) >= 2, f'{len(others)} others moved')
    check(f'{L} a dropped node stays where it was dropped', d(after, mid, nid) < 6, f'{d(after, mid, nid):.1f}px')
    check(f'{L} a drag neither navigates nor selects (no click after a drag)', ev('OI.T.list.length') == 1 and ev('OI.graph.selected()') is None and ev("document.querySelector('#gcard').hidden"))
    # shift-drag pins for good; shift-click lets go
    x, y = g_centre(page, nid)
    page.keyboard.down('Shift'); page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x - 40, y - 20, steps=5); page.mouse.up(); page.keyboard.up('Shift'); page.wait_for_timeout(500)
    check(f'{L} shift-drag pins a node', ev(f"document.querySelector('.gn[data-i=\"{nid}\"]').classList.contains('is-pinned')") and ev(f"OI.graph.nodes().find(n=>n.i=={nid}).fx!=null"))
    x, y = g_centre(page, nid)
    page.keyboard.down('Shift'); page.mouse.click(x, y); page.keyboard.up('Shift'); page.wait_for_timeout(400)
    check(f'{L} shift-click lets a pinned node go', not ev(f"document.querySelector('.gn[data-i=\"{nid}\"]').classList.contains('is-pinned')"))
    # wheel zooms about the cursor
    v0 = ev('OI.graph.view()'); spot = g_empty_spot(page) or [700, 300]
    r = ev("(()=>{const r=document.querySelector('#graph-svg').getBoundingClientRect();return [r.left,r.top]})()")
    wx0 = (spot[0] - r[0] - v0['x']) / v0['k']; wy0 = (spot[1] - r[1] - v0['y']) / v0['k']
    page.mouse.move(*spot); page.mouse.wheel(0, -400); page.wait_for_timeout(200)
    v1 = ev('OI.graph.view()')
    wx1 = (spot[0] - r[0] - v1['x']) / v1['k']; wy1 = (spot[1] - r[1] - v1['y']) / v1['k']
    check(f'{L} the wheel zooms in about the cursor (the point under it stays put)', v1['k'] > v0['k'] * 1.2 and abs(wx1 - wx0) < 1.5 and abs(wy1 - wy0) < 1.5, f"k {v0['k']:.2f}→{v1['k']:.2f}")
    page.mouse.wheel(0, 3000); page.wait_for_timeout(200)
    check(f'{L} zoom is bounded', 0.29 < ev("OI.graph.view().k") < 6.01)
    # pan: drag on empty space
    page.keyboard.press('0'); g_still(page)
    spot = g_empty_spot(page)
    if spot:
        v0 = ev('OI.graph.view()')
        page.mouse.move(*spot); page.mouse.down(); page.mouse.move(spot[0] + 50, spot[1] + 30, steps=6); page.mouse.up(); page.wait_for_timeout(150)
        v1 = ev('OI.graph.view()')
        check(f'{L} dragging empty space pans the view without moving a node', abs((v1['x'] - v0['x']) - 50) < 1.5 and abs((v1['y'] - v0['y']) - 30) < 1.5 and abs(v1['k'] - v0['k']) < 1e-6 and ev('OI.T.list.length') == 1, f"{v0} → {v1}")
    # the on-graph buttons
    k0 = ev('OI.graph.view().k')
    page.click('.gzoom [data-z="in"]'); g_still(page)
    k1 = ev('OI.graph.view().k')
    page.click('.gzoom [data-z="out"]'); page.click('.gzoom [data-z="out"]'); g_still(page)
    k2 = ev('OI.graph.view().k')
    check(f'{L} + and − buttons zoom', k1 > k0 and k2 < k1, f'{k0:.2f} {k1:.2f} {k2:.2f}')
    page.click('#graph-fit'); g_still(page)
    inside = ev("(()=>{const v=OI.graph.view(),s=OI.graph.size();return OI.graph.nodes().every(n=>{const x=n.x*v.k+v.x,y=n.y*v.k+v.y;return x>=0&&x<=s.W&&y>=0&&y<=s.H})})()")
    check(f'{L} fit frames every node', inside)
    # keyboard: arrows walk, Escape lets go, Enter opens
    page.focus('#graph-svg'); page.keyboard.press('ArrowRight'); page.wait_for_timeout(250)
    first = ev('OI.graph.selected()')
    page.keyboard.press('ArrowDown'); page.wait_for_timeout(250)
    second = ev('OI.graph.selected()')
    check(f'{L} arrow keys select and move between nodes', first is not None and second is not None and ev("document.querySelectorAll('.gn.is-sel').length") == 1 and ev("document.querySelector('#graph-svg').classList.contains('kb-focus')"), f'{first} → {second}')
    page.keyboard.press('Escape'); page.wait_for_timeout(150)
    check(f'{L} Escape lets go', ev('OI.graph.selected()') is None and ev("document.querySelector('#gcard').hidden"))
    page.keyboard.press('ArrowLeft'); page.wait_for_timeout(200)
    target = ev('OI.graph.selected()')
    page.keyboard.press('Enter'); page.wait_for_timeout(1600)
    check(f'{L} Enter opens the selected page as a tangent, the essay tab is kept', ev('OI.T.list.length') == 2 and ev('OI.S.cur.i') == target and ev('OI.T.list[0].main') and ev('OI.T.list[1].preview'), f'{target}')
    # double-click opens a reader page; from here (a tangent) the graph is still alive
    ids = ev("OI.graph.nodes().filter(n=>!n.focus).map(n=>n.i)")
    if ids:
        x, y = g_centre(page, ids[0])
        page.mouse.dblclick(x, y); page.wait_for_timeout(1500)
        check(f'{L} double-click opens the page (reader and graph follow)', ev('OI.S.cur.i') == ids[0] and ev('OI.T.list.length') == 2 and ev("!document.querySelector('#tangent-pane').hidden"), str(ids[0]))
    # a single-page navigation rebuilds the graph: the handlers must not be doubled, and nothing leaks
    nxt = ev("OI.graph.nodes().find(n=>!n.focus).i")
    ev(f'OI.openMain({nxt})'); page.wait_for_timeout(2500)
    ids = ev("OI.graph.nodes().filter(n=>!n.focus).map(n=>n.i)")
    if ids:
        x, y = g_centre(page, ids[0])
        page.mouse.click(x, y); page.wait_for_timeout(300)
        check(f'{L} after a page turn one click selects (handlers mounted once)', ev("document.querySelectorAll('.gn.is-sel').length") == 1 and ev('OI.graph.selected()') == ids[0])
        before = g_positions(page); page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 40, y + 30, steps=6); page.mouse.up(); page.wait_for_timeout(500)
        after = g_positions(page)
        check(f'{L} after a page turn dragging still works', d(after, before, ids[0]) > 30 and ev('OI.T.list.length') >= 1)
    check(f'{L} one live region and one set of zoom buttons after the turn', ev("document.querySelectorAll('.gzoom').length") == 1 and ev("document.querySelectorAll('#graph-container .sr-only').length") == 1)
    # the force layout holds up: 400 nodes settle quickly and a step costs a few milliseconds
    cost = ev("""(()=>{const D=OI.D,top=[...D.nodes.keys()].sort((a,b)=>D.deg[b]-D.deg[a]).slice(0,400);OI.graph.stress(top);
      const t=performance.now();for(let k=0;k<30;k++)OI.graph.step(0.5);return (performance.now()-t)/30})()""")
    check(f'{L} a 400-node layout steps in under 12 ms', cost < 12, f'{cost:.2f} ms/step')
    page.remove_listener('pageerror', on_err); page.remove_listener('console', on_con)
    check(f'{L} no console or page errors during all of it', not errs, '; '.join(errs[:3]))


def graph_touch_checks(page, base, prefix, label):
    """Phone: tap selects, a touch drag moves a node, two fingers pinch, and the graph takes the touches the page must not."""
    ev = page.evaluate
    L = f'[{label}] graph (touch):'
    errs = []
    on_err = lambda e: errs.append(str(e)); page.on('pageerror', on_err)
    page.goto(f'{base}{prefix}/essay/{MS}?m=16&view=field'); ready(page, 1500)
    cdp = page.context.new_cdp_session(page)
    touch = lambda typ, pts: cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': a, 'y': b, 'id': i} for i, (a, b) in enumerate(pts)]})
    check(f'{L} the graph owns its touches (touch-action none), the rest of the page keeps scrolling', ev("getComputedStyle(document.querySelector('#graph-svg')).touchAction")  in ('none',) or ev("getComputedStyle(document.querySelector('#graph-container')).touchAction") == 'none')
    ids = ev("OI.graph.nodes().filter(n=>!n.focus).map(n=>n.i)"); nid = ids[0]
    x, y = g_centre(page, nid)
    page.touchscreen.tap(x, y); page.wait_for_timeout(350)
    check(f'{L} a tap selects and shows the card', ev('OI.graph.selected()') == nid and ev("!document.querySelector('#gcard').hidden"))
    page.touchscreen.tap(*(g_empty_spot(page) or [20, 100])); page.wait_for_timeout(300)
    x, y = g_centre(page, nid); p0 = g_positions(page)[str(nid)]
    touch('touchStart', [(x, y)])
    for k in range(1, 9): touch('touchMove', [(x + k * 6, y + k * 5)]); page.wait_for_timeout(16)
    touch('touchEnd', []); page.wait_for_timeout(500)
    p1 = g_positions(page)[str(nid)]
    check(f'{L} a touch drag moves the node, and neither selects nor navigates', ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5 > 30 and ev('OI.graph.selected()') is None and ev('OI.T.list.length') == 1)
    c = ev("(()=>{const r=document.querySelector('#graph-svg').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    k0 = ev('OI.graph.view().k')
    touch('touchStart', [(c[0] - 30, c[1]), (c[0] + 30, c[1])])
    for k in range(1, 9): touch('touchMove', [(c[0] - 30 - k * 8, c[1]), (c[0] + 30 + k * 8, c[1])]); page.wait_for_timeout(16)
    touch('touchEnd', []); page.wait_for_timeout(300)
    k1 = ev('OI.graph.view().k')
    check(f'{L} two fingers pinch to zoom', k1 > k0 * 1.8 and ev('OI.graph.selected()') is None, f'{k0:.2f}→{k1:.2f}')
    ok_zoom = ev("(()=>{const r=document.querySelector('.gzoom button').getBoundingClientRect();return r.width>=36&&r.height>=34})()")
    check(f'{L} the zoom buttons are finger-sized', ok_zoom)
    page.remove_listener('pageerror', on_err)
    check(f'{L} no page errors', not errs, '; '.join(errs[:3]))


def main():
    os.chdir(ROOT)
    if not (host.DIST / 'essay' / 'index.html').is_file():
        sys.exit('the essay is not built: run npm run build:essay-quartz')
    servers = [host.start('vercel', ''), host.start('pages', '/O-I')]
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None, args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
            for (server, port), prefix, label in ((servers[0], '', 'root'), (servers[1], '/O-I', 'pages')):
                base = f'http://127.0.0.1:{port}'
                sizes = [(1440, 900, 'desktop', desktop), (390, 844, 'phone', narrow)] if prefix == '' else [(1280, 800, 'desktop', desktop)]
                for w, h, name, fn in sizes:
                    ctx = browser.new_context(viewport={'width': w, 'height': h}, color_scheme='light', has_touch=(name == 'phone'), is_mobile=(name == 'phone'))
                    page = ctx.new_page()
                    try:
                        fn(page, base, prefix, f'{label}-{name}')
                    except Exception:
                        check(f'[{label}-{name}] ran to the end', False, traceback.format_exc().strip().splitlines()[-1])
                        traceback.print_exc()
                    finally:
                        ctx.close()
            browser.close()
    finally:
        for server, _ in servers:
            host.stop(server)
    failed = [n for n, ok in RESULTS if not ok]
    print(f'\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed')
    (OUT / 'results.json').write_text(json.dumps([{'check': n, 'ok': ok} for n, ok in RESULTS], indent=1))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
