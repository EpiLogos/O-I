"""Public receiver regression on real browser components; synthetic input is intercepted only here."""
import json
import io
from PIL import Image
import os
import subprocess
from pathlib import Path
from urllib.parse import urlencode, urlparse
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('OI_SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
OUT=Path('evidence/receiver');OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','tests/publication-receiver-fixtures.mjs'],text=True))
subject='world:fixture/wiki:subject';collection='world:fixture/wiki:collection'
results=[]
def passed(name):
    results.append({'test':name,'standing':'passed','input':'controlled native producer fixture; not real corpus acceptance'})
    (OUT/'receiver-browser.json').write_text(json.dumps(results,indent=2))
    print('PASS',name,flush=True)
def route(**kwargs):
    return BASE+'/library.html#/library?'+urlencode({'published':'1',**kwargs})

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    context=browser.new_context(viewport={'width':1280,'height':900},reduced_motion='reduce')
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:requests.append((request.url,request.method)))
    def receive(interception):
        path=urlparse(interception.request.url).path
        if path.endswith('/published.json'):interception.fulfill(json=fixture['seed'])
        elif path.endswith('/edition-manifests.json'):interception.fulfill(json=fixture['manifests'])
        else:
            for edition in fixture['editions']:
                if edition.get('native_body') and path.endswith('/editions/' + edition['directory'] + '/native-body.journey.json'):
                    return interception.fulfill(body=edition['native_body']['bytes'],content_type='application/json')
            interception.continue_()
    context.route('**/data/library/**',receive)
    page.goto(route(collection_ref=collection,q='Record',page='79'))
    expect(page.locator('.publication-cards article')).to_have_count(3)
    expect(page.locator('.publication-count')).to_contain_text('1875 published subjects')
    assert not any('native-player-' in url for url,_ in requests),'GPU renderer loaded before Expression was requested'
    page.get_by_role('link',name='Record 1874',exact=True).click()
    expect(page.locator('h1')).to_have_text('Record 1874')
    expect(page.locator('.publication-reading')).to_contain_text('Test-only native reading for Record 1874.')
    page.reload();expect(page.locator('h1')).to_have_text('Record 1874')
    page.get_by_role('link',name='Return to results',exact=True).click()
    expect(page.get_by_role('searchbox')).to_have_value('Record')
    expect(page.locator('.publication-count')).to_contain_text('page 79 of 79')
    expect(page.get_by_role('link',name='Record 1874',exact=True)).to_be_focused()
    page.go_back();expect(page.locator('h1')).to_have_text('Record 1874')
    page.go_forward();expect(page.locator('.publication-count')).to_contain_text('page 79 of 79')
    passed('all 1875 native members are addressable; page/search/card return survives refresh and browser history')
    page.set_viewport_size({'width':375,'height':812})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.get_by_role('link',name='Previous results').focus();page.keyboard.press('Enter')
    expect(page.locator('.publication-count')).to_contain_text('page 78 of 79')
    expect(page.locator('.publication-cards article')).to_have_count(24)
    page.screenshot(path=str(OUT/'results-mobile.png'),full_page=True)
    passed('native result paging remains bounded, narrow and keyboard-operable')
    page.goto(route(ref=subject,at='17'))
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    page.get_by_role('link',name='Expression',exact=True).click()
    canvas=page.locator('.native-stage canvas[data-rendered="true"]')
    expect(canvas).to_be_visible(timeout=45000)
    # Canvas pixels, not a data-rendered flag, must prove a visible native field.
    def assert_ink():
        pixels=Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
        dark=sum(1 for r,g,b in pixels.getdata() if max(r,g,b)<180)
        assert dark>250, f'Native field is blank or off-screen: only {dark} ink pixels'
        target=page.locator('.field-object').first.bounding_box()
        box=canvas.bounding_box()
        assert target and box and box['x']<target['x']<box['x']+box['width'] and box['y']<target['y']<box['y']+box['height'], 'Native selection target is not inside its measured field'
    assert_ink()
    canvas.screenshot(path=str(OUT/'native-publication-field.png'))
    canvas.evaluate("node=>node.dataset.residentMarker='same-native-instance'")
    expect(page.get_by_role('button',name='Play field motion',exact=True)).to_be_visible()
    page.get_by_role('link',name='Return to Fixture subject at the same reading position').click()
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    expect(canvas).to_be_hidden()
    page.get_by_role('link',name='Expression',exact=True).click()
    expect(canvas).to_be_visible();expect(canvas).to_have_attribute('data-resident-marker','same-native-instance')
    assert_ink()
    page.locator('.field-object').first.click()
    expect(page.locator('[data-reading-at="17"]')).to_be_in_viewport()
    passed('actual native field remains resident but hidden between depths; selecting the same subject retains its paragraph')
    # Deliberately simulate an incoherent deployment, not a fake success fallback.
    context.unroute('**/data/library/**',receive)
    def mixed(interception):
        if interception.request.url.endswith('/published.json'):interception.fulfill(json=fixture['seed'])
        elif interception.request.url.endswith('/edition-manifests.json'):interception.fulfill(json=[])
        else:interception.continue_()
    context.route('**/data/library/**',mixed)
    page.reload()
    expect(page.get_by_role('heading',name='This exact reading is unavailable.')).to_be_visible()
    expect(page.locator('[data-reading-at]')).to_have_count(0)
    expect(page.get_by_role('link',name='Exact public Projection JSON')).to_have_count(0)
    passed('mixed native edition files are unavailable before any source download or substituted reading')
    assert not errors,errors
    assert all(method in ('GET','HEAD','OPTIONS') for _,method in requests),requests
    assert all(url.startswith(BASE+'/') or url.startswith('data:') for url,_ in requests),requests
    passed('public route performs no mutation, off-host inference, daemon or credential-dependent request')
    browser.close()
