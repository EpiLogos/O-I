#!/usr/bin/env python3
"""Evidence-derived completion gate: missing native proofs cannot become a green suite."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    out = parser.parse_args().out.resolve()
    raw_cut = (ROOT / 'tests/development-field/cut.json').read_bytes()
    cut = json.loads(raw_cut)
    cut_sha = hashlib.sha256(raw_cut).hexdigest()
    expected = {o['id']: o['revision'] for o in cut['owners']}
    def read(relative):
        path = out / relative
        return json.loads(path.read_text()) if path.exists() else {}
    probe = read('specimen/bounded-conformance.json')
    central = read('specimen/central-s1.json')
    dispatch = read('source-dispatch.json')
    lock = read('dependency-lock.json')
    activation = read('source-activation.json')
    lifecycle = read('suite-lifecycle.json')
    operative = read('specimen/aikit-development-field.json')
    remaining = []
    if probe.get('status') != 'passed' or probe.get('cut') != cut:
        remaining.append('Joined native-owner specimen has not passed on this exact cut.')
    if central.get('status') != 'passed':
        remaining.append('Native S1 self/tier/UX and non-fabricated EX boundaries have not passed in the specimen.')
    if lock.get('standing') != 'committed-lock':
        remaining.append('The joined dependency lock is still a bootstrap candidate, not a committed reproducibility input.')
    if dispatch.get('status') != 'passed' or {p['owner']: p['revision'] for p in dispatch.get('products', [])} != {k:v for k,v in expected.items() if k != 'oi'}:
        remaining.append('Source-built six-product dispatch has not passed for the exact cut.')
    if lifecycle.get('status') != 'passed' or lifecycle.get('cut_sha256') != cut_sha:
        remaining.append('S0 native exact-source activation, active-receipt dispatch and install/update/repair/rollback still need joined proof; source-activation.json records the actual attempt.')
    if operative.get('status') != 'passed' or operative.get('cut_sha256') != cut_sha:
        remaining.append('S3 native bounded Development Field packet, accepted QL carrier consumption and CLI/application parity still need joined proof on accepted main.')
    result = {'schema': 'oi.development-field-whole-conformance/v1', 'status': 'passed' if not remaining else 'incomplete',
        'cut_sha256': cut_sha, 'owners': expected,
        'bounded_specimen': probe.get('status', 'not-established'), 'S1': central.get('status', 'not-established'),
        'source_dispatch': dispatch.get('status', 'not-established'), 'source_activation': activation.get('status', 'not-established'),
        'deterministic_remaining': remaining,
        'blocked_on_QL_123': ['Final Vāk/C′/Wiki/Context-Frame conformance; not a prerequisite for the stable carrier proof above.'],
        'physical_provider_human_only': ['Live model/provider P', 'owner-machine and supported VM/remote/cloud material M', 'real human EX and Recognition H'],
        'P': 'not-exercised', 'M': 'not-exercised', 'H': 'not-exercised'}
    (out / 'whole-development-field.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps(result, indent=2))
    return bool(remaining)

if __name__ == '__main__':
    sys.exit(main())
