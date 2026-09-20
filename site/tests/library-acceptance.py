#!/usr/bin/env python3
"""Real browser / real native GPU checks. No mocked renderer and no H verdict.
Run from site/ with the production preview on port 4173. Test-only Playwright.
"""
import json, os, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect, Error as PlaywrightError
BASE=os.environ.get('LIBRARY_BASE_URL','http://127.0.0.1:4173/')
OUT=Path('evidence/library');OUT.mkdir(parents=True,exist_ok=True)
INDEX=json.loads(Path('public/data/library/index.json').read_text())
FIRST=INDEX['entries'][0]
RESULTS=[]
def url(entry=None, scene=None, **params):
    from urllib.parse import urlencode
    if entry:
        params={'scene':scene or entry['scenes'][0]['ref'],'edition':entry['revision'],**params}
    return BASE+'#/library'+('/'+entry['id'] if entry else '')+('?' + urlencode(params) if params else '')
def check(name, fn, page=None):
    try:
        fn();RESULTS.append({'case':name,'passed':True});print('PASS',name,flush=True)
    except Exception as e:
        RESULTSS=None
        RESULTS.append({'case':name,'passed':False,'error':str(e),'traceback':traceback.format_exc()});print('FAIL',name,str(e),flush=True)
        if page:
            try:page.screenshot(path=str(OUT/(name+'-failure.png')),full_page=True)
            except Exception:pass

def live(page):
    expect(page.locator('.native-stage>canvas')).to_have_attribute('data-rendered','true',timeout=30000)
    expect(page.locator('.field-error')).to_have_count(0)
def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'horizontal page overflow'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
    page=ctx.new_page(); errors=[]; mutations=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.on('request',lambda r:mutations.append(r.url) if r.method not in ['GET','HEAD','OPTIONS'] else None)
    def home():
        page.goto(BASE);expect(page.locator('.pl')).to_be_visible();expect(page.locator('.office-tile')).to_have_count(6)
        expect(page.locator('.band')).to_have_count(1);expect(page.locator('video')).to_have_count(0)
        assert page.locator('.pl .vf__poster').evaluate('n=>n.naturalWidth>0')
        page.screenshot(path=str(OUT/'home.png'),full_page=True)
        page.locator('.sn__library').click();expect(page.locator('.oi-library')).to_be_visible()
    check('retained-home-to-library',home,page)
    def gallery():
        expect(page.locator('.expression-card')).to_have_count(len(INDEX['entries']))
        assert not any('native-player-' in u for u in requests),'GPU code loaded during gallery-only visit'
        expect(page.locator('.native-stage')).to_have_count(0);no_overflow(page)
        page.screenshot(path=str(OUT/'library-gallery.png'),full_page=True)
        page.get_by_role('button',name='Central',exact=True).click()
        page.get_by_role('searchbox').fill('continuity');expect(page.locator('.expression-card')).to_have_count(1)
        page.get_by_role('searchbox').fill('no-such-term-82342');expect(page.locator('.library-empty')).to_be_visible()
        page.get_by_role('button',name='Clear search and filters').click();expect(page.locator('.expression-card')).to_have_count(len(INDEX['entries']))
    check('gallery-native-covers-search-and-no-eager-gpu',gallery,page)
    def rows():
        page.get_by_role('button',name='Columnar view').click();expect(page.locator('.expression-row')).to_have_count(len(INDEX['entries']))
        for rail in page.locator('.library-scene-row').all():
            tops=rail.locator('button').evaluate_all('ns=>ns.map(n=>Math.round(n.getBoundingClientRect().top))')
            assert len(set(tops))<=1;assert rail.evaluate('n=>n.scrollWidth<=n.clientWidth+1')
        no_overflow(page);page.screenshot(path=str(OUT/'library-columns.png'),full_page=True)
        page.set_viewport_size({'width':780,'height':900})
        page.get_by_role('button',name='Show all 5 Scenes in Central',exact=True).click()
        dialog=page.get_by_role('dialog',name='Scenes in Central');expect(dialog).to_be_visible()
        dialog.locator('[data-scene-ref="'+FIRST['scenes'][2]['ref']+'"]').click()
        expect(page.locator('.expression-reader')).to_have_attribute('data-expression-ref',FIRST['expression_ref'])
        expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref',FIRST['scenes'][2]['ref']);live(page)
    check('bounded-column-scenes-open-exact-ref',rows,page)
    def scene_and_source():
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='Next Scene',exact=True).click();live(page)
        expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref',FIRST['scenes'][3]['ref'])
        page.get_by_role('button',name='Read & sources',exact=True).click()
        expect(page.locator('.source-panel')).to_be_visible();assert len(page.locator('.source-prose').inner_text())>300
        subject=page.url
        page.locator('.source-scroll').first.evaluate('n=>n.scrollTop=280')
        page.get_by_role('button',name='Full source reading',exact=True).click();expect(page.locator('.is-full-reading')).to_be_visible()
        assert FIRST['id'] in page.url
        page.get_by_role('button',name='Return to the field',exact=True).click()
        expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref',FIRST['scenes'][3]['ref'])
        page.reload();live(page);expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref',FIRST['scenes'][3]['ref'])
        assert '?scene=' in subject
    check('scene-source-full-return-and-reload',scene_and_source,page)
    def selection_and_overlay():
        page.locator('.reader-scenes button').first.click();live(page)
        page.locator('.field-object[data-entity-ref$=":what"]').click()
        expect(page.locator('.source-panel')).to_be_visible();assert 'subject=' in page.url
        assert 'meaningful continuity' in page.locator('.source-prose').inner_text()
        page.get_by_role('button',name='Read in overlay',exact=True).click()
        dialog=page.get_by_role('dialog',name='Read the source');expect(dialog).to_be_visible()
        for _ in range(8):
            page.keyboard.press('Tab');assert page.evaluate('document.querySelector(".source-overlay").contains(document.activeElement)')
        page.screenshot(path=str(OUT/'source-overlay.png'))
        page.keyboard.press('Escape');expect(dialog).not_to_be_visible();live(page)
    check('direct-subject-selection-overlay-and-focus-containment',selection_and_overlay,page)
    def pause_and_library_return():
        page.get_by_role('button',name='Play field',exact=True).click();page.wait_for_timeout(250)
        canvas=page.locator('.native-stage>canvas');before=int(canvas.get_attribute('data-frames'))
        page.wait_for_timeout(200);assert int(canvas.get_attribute('data-frames'))>before
        page.get_by_role('button',name='Library',exact=True).click();expect(page.locator('.oi-library')).to_be_visible()
        expect(page.locator('.native-stage>canvas')).to_have_count(1)
        count=int(canvas.get_attribute('data-frames'));page.wait_for_timeout(300);assert int(canvas.get_attribute('data-frames'))<=count+1
        page.get_by_role('button',name='Return to Central',exact=True).click();live(page)
        expect(page.locator('.native-stage>canvas')).to_have_count(1)
        page.get_by_role('button',name='Pause field',exact=True).click()
        count=int(canvas.get_attribute('data-frames'));page.wait_for_timeout(250);assert int(canvas.get_attribute('data-frames'))<=count+1
        page.screenshot(path=str(OUT/'expression-live.png'))
    check('real-frame-loop-pauses-in-library-and-restores-one-stage',pause_and_library_return,page)
    def camera():
        canvas=page.locator('.native-stage>canvas');before=page.locator('.field-object[data-entity-ref$=":what"]').get_attribute('style')
        canvas.focus();page.keyboard.press('+');page.wait_for_timeout(150)
        after=page.locator('.field-object[data-entity-ref$=":what"]').get_attribute('style');assert before!=after
        page.get_by_role('button',name='Restore Scene view',exact=True).click()
        page.get_by_role('button',name='Read & sources',exact=True).click()
        page.get_by_role('button',name='Return to the field',exact=True).click();live(page)
    check('keyboard-camera-and-source-crossing',camera,page)
    def detached_source():
        page.get_by_role('button',name='Read & sources',exact=True).click()
        if page.get_by_role('dialog',name='Read the source').is_visible():page.get_by_role('button',name='Read beside the field',exact=True).click()
        original_expression=page.locator('.expression-reader').get_attribute('data-expression-ref')
        original_scene=page.locator('.native-stage').get_attribute('data-scene-ref')
        with page.expect_popup() as popup:page.get_by_role('button',name='Open source in a separate window',exact=True).click()
        child=popup.value;expect(child.locator('.source-prose')).to_be_visible();assert 'face=detached' in child.url
        # Re-dock intentionally closes its own window. Chromium can acknowledge
        # that close before click() completes; accept only that exact close,
        # then still verify the surviving parent and the unchanged native refs.
        with child.expect_event('close',timeout=5000):
            try:child.get_by_role('button',name='Re-dock',exact=True).click()
            except PlaywrightError as error:
                if 'Target page, context or browser has been closed' not in str(error) or not child.is_closed() or page.is_closed():raise
        expect(page.locator('.source-panel')).to_be_visible()
        expect(page.locator('.expression-reader')).to_have_attribute('data-expression-ref',original_expression)
        expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref',original_scene)
        page.get_by_role('button',name='Return to the field',exact=True).click()
    check('detached-source-redock-preserves-subject',detached_source,page)
    def stale_and_missing():
        page.goto(url(FIRST,edition=1));expect(page.get_by_role('button',name='Open the current edition')).to_be_visible()
        expect(page.locator('.native-stage')).to_have_count(0)
        page.get_by_role('button',name='Open the current edition').click();live(page)
        page.goto(url(FIRST,scene=FIRST['expression_ref']+':scene:absent'));expect(page.get_by_role('heading',name='This exact Scene is unavailable.')).to_be_visible()
        expect(page.locator('.native-stage')).to_have_count(0)
        page.get_by_role('button',name='Open this edition’s overview').click();live(page)
    check('edition-drift-and-unavailable-exact-scene-refuse-silent-substitution',stale_and_missing,page)
    def source_and_no_mutation():
        page.get_by_role('button',name='Read & sources',exact=True).click();page.locator('.source-provenance summary').click()
        expect(page.get_by_role('link',name='Published edition · JSON')).to_be_visible()
        for label in ['Save scene','Import','Fork','Create','Studio']:
            assert page.get_by_role('button',name=label,exact=True).count()==0
        assert not mutations,mutations;assert not errors,errors
        page.screenshot(path=str(OUT/'source-verso.png'))
    check('source-account-depth-and-no-authoring-or-write-requests',source_and_no_mutation,page)
    ctx.close()
    for width in [320,390,768,1440]:
        context=browser.new_context(viewport={'width':width,'height':844},reduced_motion='reduce')
        pg=context.new_page()
        def responsive():
            pg.goto(url());expect(pg.locator('.expression-card')).to_have_count(len(INDEX['entries']));no_overflow(pg)
            pg.screenshot(path=str(OUT/f'gallery-{width}.png'),full_page=True)
            pg.get_by_role('button',name='Columnar view',exact=True).click();no_overflow(pg)
            for row in pg.locator('.library-scene-row').all():assert row.evaluate('n=>n.scrollWidth<=n.clientWidth+1')
            pg.get_by_role('button',name='Open Central',exact=True).click();live(pg);no_overflow(pg)
            pg.get_by_role('button',name='Read & sources',exact=True).click();expect(pg.locator('.source-panel')).to_be_visible();no_overflow(pg)
            pg.screenshot(path=str(OUT/f'reading-{width}.png'))
            pg.get_by_role('button',name='Return to the field',exact=True).click();live(pg)
        check(f'responsive-and-reduced-motion-{width}',responsive,pg);context.close()
    context=browser.new_context(reduced_motion='reduce');context.add_init_script("Storage.prototype.getItem=()=>{throw Error('Unavailable')};Storage.prototype.setItem=()=>{throw Error('Unavailable')}")
    pg=context.new_page()
    def no_storage():
        pg.goto(url(FIRST));live(pg);pg.get_by_role('button',name='Next Scene',exact=True).click();live(pg)
        pg.get_by_role('button',name='Library',exact=True).click();expect(pg.locator('.oi-library')).to_be_visible()
    check('storage-unavailable-still-readable',no_storage,pg);context.close()
    context=browser.new_context(reduced_motion='reduce');pg=context.new_page()
    def failure():
        pg.route('**/data/library/central.json*',lambda route:route.abort())
        pg.goto(url(FIRST));expect(pg.locator('.library-state [role=alert]')).to_be_visible();expect(pg.locator('.native-stage')).to_have_count(0)
        pg.unroute('**/data/library/central.json*');pg.get_by_role('button',name='Try again',exact=True).click();live(pg)
    check('failed-publication-read-and-real-retry',failure,pg);context.close()
    browser.close()
summary={'passed':sum(r['passed'] for r in RESULTS),'failed':sum(not r['passed'] for r in RESULTS),'renderer':'native ProductionAdapter; software WebGL2','standing':'Controlled browser evidence, not owner visual acceptance or deployment','cases':RESULTS}
(OUT/'results.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='cases'}),flush=True)
raise SystemExit(1 if summary['failed'] else 0)
