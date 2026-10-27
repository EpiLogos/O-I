import sys, json, time
from playwright.sync_api import sync_playwright
out = sys.argv[1]; scenarios = json.loads(sys.argv[2])
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': 1100, 'height': 760})
    logs = []
    pg.on('console', lambda m: logs.append(m.text) if m.type in ('error', 'warning') else None)
    pg.goto('http://127.0.0.1:5391/app/index.html')
    pg.wait_for_function('window.READY || window.FAILED', timeout=90000)
    print('FAILED:', pg.evaluate('window.FAILED')) if pg.evaluate('!!window.FAILED') else print('mounted')
    for s in scenarios:
        pg.evaluate("""([rec, look, lat, lon, dist, t]) => { const e = window.H.engine; e.setBody(rec, look); e.rig.flyTo(lat, lon, dist, {instant: true}); }""",
                    [s.get('body'), s.get('look'), s['lat'], s['lon'], s['dist'], 0])
        time.sleep(s.get('wait', 7))
        pg.screenshot(path=f"{out}/{s['name']}.png")
        print('shot', s['name'], pg.evaluate('window.H.engine.bodyPictureState && JSON.stringify(window.H.engine.bodyPictureState)'))
    print('console:', [l[:140] for l in logs][:6])
    b.close()
