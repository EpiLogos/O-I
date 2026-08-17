from pathlib import Path

path = Path('.github/workflows/verify.yml')
text = path.read_text()
old = '          assert central["version"].startswith("ctrl ")\n'
new = '          assert central["version"] == "78a545214ad70e055fae38ccae2d78443112f283"\n'
if old not in text:
    raise SystemExit('legacy Central version assertion not found')
path.write_text(text.replace(old, new, 1))
