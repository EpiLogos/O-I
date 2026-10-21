"""Run scripts/m3-ledger.py publish with the acceptance read from a downloaded artifact outside the shared target pool."""
import importlib.util, json, sys
from pathlib import Path
seat, artifact, reason = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
spec = importlib.util.spec_from_file_location('m3ledger', seat / 'scripts/m3-ledger.py')
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
original = mod.load
def load(p):
    if p == 'target/m3-acceptance/acceptance.json':
        return json.loads((artifact / 'm3-acceptance/acceptance.json').read_text())
    return original(p)
mod.load = load
mod.publish(reason)
