#!/usr/bin/env python3
"""Retain only receipts and declared captures from this exact native walk invocation."""
import argparse
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import time


def strict_json(path):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 1024 * 1024:
        raise ValueError('Missing, nonregular or oversized JSON evidence: ' + str(path))
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate evidence key: ' + key)
            result[key] = value
        return result
    def constant(value):
        raise ValueError('Nonfinite evidence value: ' + value)
    def finite_float(value):
        result = float(value)
        if not math.isfinite(result): raise ValueError('Nonfinite evidence number')
        return result
    return json.loads(path.read_text(), object_pairs_hook=pairs, parse_constant=constant, parse_float=finite_float)


def start(output, engine, scenarios):
    output.mkdir(parents=True, exist_ok=False)
    record = {'started_at_ns': time.time_ns(), 'engine': engine, 'scenarios': scenarios,
              'repository_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()}
    (output / 'invocation.json').write_text(json.dumps(record, indent=2) + '\n')


def retain(output, source):
    invocation = strict_json(output / 'invocation.json')
    finished = time.time_ns()
    results = []
    current_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    for name in invocation['scenarios']:
        result = {'scenario': name, 'passed': False, 'retained': [], 'failures': []}
        try:
            path = source / (name + '.json')
            receipt = strict_json(path)
            if receipt.get('schema') != 'oi.cradle.walk.scenario/v1' or receipt.get('scenario') != name:
                raise ValueError('Receipt schema/subject does not match the current invocation')
            environment = receipt['environment']
            if environment.get('browser_engine') != invocation['engine']:
                raise ValueError('Receipt engine does not match the current invocation')
            if current_head != invocation['repository_head'] or environment['source'].get('repository_head') != current_head:
                raise ValueError('Receipt Source does not match the current checked-out revision')
            generated = datetime.fromisoformat(receipt['generated_at'].replace('Z', '+00:00'))
            if generated.tzinfo is None:
                raise ValueError('Receipt has no qualified time zone')
            generated_ns = int(generated.timestamp() * 1e9)
            if not invocation['started_at_ns'] - 1_000_000 <= generated_ns <= finished + 1_000_000:
                raise ValueError('Receipt was not generated during this engine invocation')
            if not invocation['started_at_ns'] <= path.stat().st_mtime_ns <= finished:
                raise ValueError('Receipt file is stale for this engine invocation')
            screenshots = receipt['screenshots']
            if not isinstance(screenshots, list) or len(screenshots) > 64 or len(set(screenshots)) != len(screenshots):
                raise ValueError('Malformed or oversized capture inventory')
            # The fresh receipt is retained even when its actual body/cleanup failed.
            shutil.copy2(path, output / path.name)
            result['retained'].append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
            for filename in screenshots:
                try:
                    if not isinstance(filename, str) or not re.fullmatch(re.escape(name) + r'-[A-Za-z0-9_-]+\.png', filename):
                        raise ValueError('Capture is not a flat declared scenario PNG')
                    capture = source / filename
                    if not capture.is_file() or capture.is_symlink() or capture.stat().st_size > 16 * 1024 * 1024:
                        raise ValueError('Missing, nonregular or oversized capture')
                    if not max(invocation['started_at_ns'], generated_ns) <= capture.stat().st_mtime_ns <= finished:
                        raise ValueError('Capture is stale for this current receipt')
                    with capture.open('rb') as image:
                        if image.read(8) != b'\x89PNG\r\n\x1a\n':
                            raise ValueError('Capture does not contain PNG bytes')
                    shutil.copy2(capture, output / filename)
                    result['retained'].append({'file': filename, 'sha256': hashlib.sha256(capture.read_bytes()).hexdigest()})
                except (OSError, ValueError, TypeError) as error:
                    result['failures'].append({'kind': 'current-capture-unavailable', 'file': str(filename), 'detail': str(error)})
            if receipt.get('cleanup_errors'):
                result['failures'].append({'kind': 'native-cleanup-failed', 'detail': receipt['cleanup_errors']})
            if receipt.get('passed') is not True:
                result['failures'].append({'kind': receipt.get('failure_stage', 'application'), 'detail': receipt.get('error')})
            result['passed'] = not result['failures']
        except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:
            result['failures'].append({'kind': 'current-receipt-unavailable', 'detail': str(error)})
        results.append(result)
    record = {'invocation': invocation, 'finished_at_ns': finished, 'results': results,
              'passed': bool(results) and all(row['passed'] for row in results)}
    (output / 'qualification.json').write_text(json.dumps(record, indent=2) + '\n')
    return record['passed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['start', 'retain'])
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--engine', choices=['chromium', 'webkit'])
    parser.add_argument('--scenario', action='append', default=[])
    parser.add_argument('--source', type=Path, default=Path('walk/artifacts'))
    args = parser.parse_args()
    if args.operation == 'start':
        if not args.engine or not args.scenario or len(set(args.scenario)) != len(args.scenario) or any(not re.fullmatch(r'[a-z0-9-]+', name) for name in args.scenario):
            parser.error('Start requires an engine and unique canonical scenario names')
        start(args.output, args.engine, args.scenario)
    elif not retain(args.output, args.source):
        raise SystemExit(1)
