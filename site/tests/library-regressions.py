"""Regression of returned browser/visual failures; actual public build + GPU."""
from io import BytesIO
from pathlib import Path
import json, os
from PIL import Image
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('LIBRARY_BASE_URL','http://127.0.0.1:4173/')
OUT=Path('evidence/library');OUT.mkdir(exist_ok=True,parents=True)
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
 page=context.new_page();page.goto(BASE+'#/library/central')
 expect(page.locator('.native-stage>canvas')).to_have_attribute('data-rendered','true',timeout=30000)
 assert 'scene=' in page.url and 'edition=' in page.url
 page.get_by_role('button',name='Next Scene',exact=True).click()
 expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref','expression:oi:site:central:scene:what')
 page.locator('.reader-scenes button').first.click()
 expect(page.locator('.native-stage')).to_have_attribute('data-scene-ref','expression:oi:site:central:scene:overview')
 page.wait_for_timeout(180)
 image=Image.open(BytesIO(page.screenshot())).convert('RGB')
 for obj in page.locator('.field-object').all():
  box=obj.bounding_box();x=int(box['x']+box['width']/2);y=int(box['y']+box['height']/2)
  pixels=list(image.crop((x-35,y-35,x+35,y+35)).getdata())
  assert sum(max(rgb)<160 for rgb in pixels)>15, 'Selected Scene did not reach its particle body: '+obj.get_attribute('data-entity-ref')
 page.screenshot(path=str(OUT/'expression-paused-configurations.png'))
 for width in [320,390]:
  page.set_viewport_size({'width':width,'height':844})
  for label in ['Library','Read & sources']:
   icon=page.get_by_role('button',name=label,exact=True).locator('.library-icon')
   expect(icon).to_be_visible();assert icon.bounding_box()['width']>10
 page.get_by_role('button',name='Library',exact=True).click()
 expect(page.get_by_role('button',name='Return to Central',exact=True).locator('.library-icon')).to_be_visible()
 page.set_viewport_size({'width':1440,'height':900})
 for card in page.locator('.expression-card').all():card.scroll_into_view_if_needed();page.wait_for_timeout(30)
 page.evaluate('scrollTo(0,0)');page.wait_for_timeout(100)
 page.screenshot(path=str(OUT/'library-complete-covers.png'),full_page=True)
 # The band's original multiply treatment erased a successfully loaded poster
 # against its black ground. Pixel evidence must reject that false success.
 page.goto(BASE)
 band=page.locator('.band');band.scroll_into_view_if_needed()
 expect(band.locator('.vf__poster')).not_to_have_js_property('naturalWidth',0)
 image=Image.open(BytesIO(band.screenshot(path=str(OUT/'home-video-band.png')))).convert('RGB')
 w,h=image.size
 pixels=list(image.crop((int(w*.25),int(h*.12),int(w*.75),int(h*.38))).getdata())
 assert sum(max(rgb)>40 for rgb in pixels)>len(pixels)*.01, 'The loaded band media is visually erased against the dark ground'
 checks=['Direct links pin exact edition and Scene','Paused Scene change renders every native formation','Mobile Library/source/Return icons remain visible and named','Video-band media remains visible on its actual dark ground']
 (OUT/'regressions.json').write_text(json.dumps({'passed':len(checks),'failed':0,'checks':checks,'standing':'Controlled browser/pixel evidence, not owner visual acceptance'},indent=2))
 browser.close()
print('PASS 4 returned-reality regressions')
