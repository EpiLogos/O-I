"""Validate the GitHub handover; never imports or builds the Cradle app.

Run check_specimen.py first to produce a fresh standalone-browser receipt.
This validator records no claim about local Cradle implementation or tests.
"""
from pathlib import Path
import hashlib, json, re, subprocess
ROOT = Path(__file__).resolve().parents[1]
checks = []
def record(name, passed):
    if not passed:
        raise AssertionError(name)
    checks.append({'check': name, 'status': 'passed'})
specs = sorted((ROOT / 'docs/cradle/surface-specs').glob('*.md'))
record('eight surface specifications', len(specs) == 8)
for p in specs:
    text = p.read_text()
    record(p.name + ' subtraction, layout, acceptance', all(x in text.lower() for x in ['subtraction', '```text', 'acceptance']))
    record(p.name + ' state coverage', all(x in text.lower() for x in ['empty', 'working', 'needs-you', 'error', 'refused', 'live']))
for p in ROOT.rglob('*.md'):
    text = p.read_text()
    record(p.relative_to(ROOT).as_posix() + ' balanced fences', sum(1 for s in text.splitlines() if s.startswith('```')) % 2 == 0)
    for link in re.findall(r'\]\(([^)]+)\)', text):
        if re.match(r'^[a-zA-Z]+:', link) or link.startswith('#'):
            continue
        target = (p.parent / link.split('#')[0]).resolve()
        record('local link ' + p.name + ' → ' + link, target.exists())
    for script in re.findall(r'^```(?:sh|bash)\n(.*?)^```', text, re.M | re.S):
        test = subprocess.run(['bash', '-n'], input=script, text=True, capture_output=True)
        record('shell syntax in ' + p.name, test.returncode == 0)
expected = json.loads((ROOT / 'review/v1-inventory-manifest.json').read_text())
for name, meta in expected.items():
    text = (ROOT / 'docs/cradle/surface-specs' / name).read_text()
    before_accept = text.split('## Acceptance — interaction and visual proof')[0]
    chunks = re.split(r'(?=^## Appendix )', before_accept, flags=re.M)
    actual = '\n\n'.join(c.strip() for c in chunks[1:] if 'acceptance' not in c.splitlines()[0].lower())
    record('retained v1 binding inventory ' + name, hashlib.sha256(actual.encode()).hexdigest() == meta['sha256'])
record('six separate worker prompts', len(list((ROOT / 'handover/prompts').glob('*.md'))) == 6)
record('lead execution prompt present', (ROOT / 'docs/cradle/UI-LOCAL-EXECUTION.md').exists())
html = (ROOT / 'control-specimen.html').read_text()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
record('one self-contained specimen script', len(scripts) == 1)
test = subprocess.run(['node', '--check', '--input-type=commonjs'], input=scripts[0], text=True, capture_output=True)
record('specimen JavaScript syntax', test.returncode == 0)
record('no external script dependencies', 'src=' not in re.sub(r'<script>.*?</script>', '', html, flags=re.S))
receipt_path = ROOT / 'review/specimen-validation.json'
record('browser receipt exists; run check_specimen.py first', receipt_path.exists())
browser = json.loads(receipt_path.read_text())
record('standalone browser receipt distinct from app proof', browser.get('passed') == 24 and browser.get('cradle_application_tests_run') is False)
report = {'standing': 'handover-documents-and-standalone-specimen-only', 'document_checks_passed': len(checks), 'checks': checks, 'standalone_browser_checks_passed': browser['passed'], 'cradle_build': 'not run by this validator', 'cradle_walks': 'not run by this validator', 'local_checkout': 'not modified by this validator', 'publication': 'GitHub handover; not implementation acceptance'}
(ROOT / 'review/validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'checks'}, indent=2))
