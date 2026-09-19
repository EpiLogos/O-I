from pathlib import Path
import json
from harness import browser_session
root=Path(__file__).resolve().parents[2]
with browser_session({'width':640,'height':480}) as (_,ctx,page):
    errors=[]
    page.on('console',lambda e: print(e.text,flush=True) if e.text.startswith('PARITY ') else None)
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda e: errors.append(e.text) if e.type=='error' and 'CONTEXT_LOST' not in e.text else None)
    page.set_content('<!doctype html><html><body></body></html>')
    page.add_script_tag(content=(root/'field-studies-journeys/build/parity-harness.js').read_text())
    results=page.evaluate((root/'tests/parity/gpu.js').read_text())
    report={'reference':'63e650d26a04447b973f73dded6b5046a0829e84','results':results,'browserErrors':errors,'environment':'Same Chromium software WebGL context/device, controlled 512-particle native fixtures. Geometry float32 budget 0.00013, position 0.00025 and velocity 0.001 native units/second over four steps.'}
    (root/'field-studies-journeys/evidence-native/parity-gpu.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    assert all(r['ok'] for r in results) and not errors
