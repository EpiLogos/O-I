#!/usr/bin/env python3
"""Read-only real-host/local-preview acceptance. No intercepted data or sample subjects.
Run the byte/set verifier first. This bounded browser walk records what it actually visits;
it does not certify unvisited corpus members or an installed native Agent/voice system.
"""
import argparse
import json
import os
import platform
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True,help='Actual public host or explicitly served local build base')
parser.add_argument('--ref',action='append',default=[],help='Exact producer subject ref; repeat for essay/product/Bimba')
parser.add_argument('--browser',choices=['chromium','webkit','firefox'],default='chromium')
parser.add_argument('--headed',action='store_true')
parser.add_argument('--require-expression',action='store_true')
parser.add_argument('--out',default='evidence/receiver/local-browser-receipt.json')
args=parser.parse_args()
base=args.url.rstrip('/')+'/'
parsed=urlparse(base)
if parsed.scheme not in ('http','https') or parsed.username or parsed.password or parsed.query or parsed.fragment:
    parser.error('Use an HTTP(S) base without credentials, query or fragment.')
if parsed.scheme=='http' and parsed.hostname not in ('localhost','127.0.0.1','::1'):
    parser.error('Non-loopback hosts require HTTPS.')
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
receipt={'standing':'not-accepted','host':base,'machine':{'os':platform.system(),'architecture':platform.machine()},'visited':[],'native_mac_application':'not tested by this public-browser walk','model_provider':'not invoked; public reading must not require inference','microphone_audio':'capture permission is not granted or requested for public reading'}

def save():out.write_text(json.dumps(receipt,indent=2)+'\n')
try:
    with sync_playwright() as pw:
        kwargs={'headless':not args.headed}
        if args.browser=='chromium':
            kwargs['args']=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] if not args.headed else []
            if os.environ.get('CHROMIUM_EXECUTABLE'):kwargs['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
        browser=getattr(pw,args.browser).launch(**kwargs)
        receipt['browser']={'engine':args.browser,'version':browser.version,'headed':args.headed,'software_gpu_requested':args.browser=='chromium' and not args.headed}
        context=browser.new_context(reduced_motion='reduce',viewport={'width':1280,'height':900})
        # A forbidden permission request fails the walk rather than opening a
        # microphone or silently satisfying it with a fake device.
        context.add_init_script("window.__oiCaptureCalls=0; if(navigator.mediaDevices) navigator.mediaDevices.getUserMedia=async()=>{window.__oiCaptureCalls++;throw new Error('Public reading must not request capture');};")
        response=context.request.get(urljoin(base,'data/library/published.json'))
        assert response.ok,'Actual public seed is unavailable'
        seed=response.json()
        assert seed.get('schema')=='oi.explore-browser-seed/v1','Unexpected publication contract'
        assert seed.get('entries') and seed.get('presentation_projections'),'No admitted native corpus is deployed; no substitute is accepted'
        refs=args.ref or [e['ref'] for e in seed['entries'][:3]]
        entries={e['ref']:e for e in seed['entries']}
        assert all(ref in entries for ref in refs),'An exact requested subject is absent from the deployed edition'
        page=context.new_page();errors=[];requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:requests.append((request.url,request.method)))
        for ref in refs:
            entry=entries[ref]
            page.goto(urljoin(base,'library.html')+'#/library?'+urlencode({'published':'1','ref':ref,'projection':entry.get('projection_ref','')}))
            expect(page.locator('h1')).to_have_text(entry['label'])
            blocks=page.locator('[data-reading-at]');count=blocks.count()
            visited={'ref':ref,'text_blocks':count,'expression':'not published or not yet inspected'}
            if count:
                paragraph=min(17,count-1);block=blocks.nth(paragraph)
                block.evaluate('(node)=>window.scrollTo(0,node.getBoundingClientRect().top+scrollY-100)')
                expect(block).to_be_in_viewport()
            page.get_by_role('link',name='Graph relations',exact=True).click()
            expect(page.get_by_role('heading',name='Declared graph neighbourhood')).to_be_visible()
            page.get_by_role('link',name='Source & edition',exact=True).click()
            expect(page.get_by_role('link',name='Exact public Projection JSON',exact=True)).to_be_visible()
            page.get_by_role('link',name='Expression',exact=True).click()
            canvas=page.locator('.native-stage canvas[data-rendered="true"]')
            if page.locator('.native-stage').count():
                expect(canvas).to_be_visible(timeout=45000)
                expect(page.get_by_role('button',name='Play field motion',exact=True)).to_be_visible()
                canvas.focus();page.keyboard.press('ArrowRight');page.keyboard.press('0')
                visited['expression']='native renderer observed in this browser'
            elif args.require_expression:raise AssertionError('A requested interactive Expression is not available')
            else:visited['expression']='unavailable in this edition; not counted as a renderer pass'
            page.get_by_role('link',name='Return to '+entry['label']+' at the same reading position').click()
            if count:expect(page.locator(f'[data-reading-at="{paragraph}"]')).to_be_in_viewport()
            exact=page.url;page.reload();expect(page.locator('h1')).to_have_text(entry['label'])
            if count:expect(page.locator(f'[data-reading-at="{paragraph}"]')).to_be_in_viewport()
            page.go_back();page.go_forward();expect(page.locator('h1')).to_have_text(entry['label'])
            page.set_viewport_size({'width':375,'height':812})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'Narrow layout overflows'
            assert page.evaluate('window.__oiCaptureCalls===0'),'Public reading requested microphone/camera capture'
            page.screenshot(path=str(out.parent/(str(len(receipt['visited']))+'-public-reading.png')),full_page=True)
            visited['exact_route']=exact;receipt['visited'].append(visited);save()
        assert not errors,errors
        assert all(method in ('GET','HEAD','OPTIONS') for _,method in requests),'Public reader attempted a mutation'
        assert all(urlparse(url).netloc==parsed.netloc or url.startswith('data:') for url,_ in requests),'Public reading contacted an additional runtime/provider host'
        receipt.update(standing='observed-public-browser',unvisited_native_subjects=len(entries)-len(set(refs)),page_errors=errors,request_count=len(requests),capture_requests=0)
        browser.close()
except Exception as error:
    receipt['failure']=str(error);save();raise
save();print(json.dumps(receipt,indent=2))
