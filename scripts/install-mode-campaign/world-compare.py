#!/usr/bin/env python3
"""Per-product position comparison between two current-world position files.

Usage: world-compare.py <before.json> <after.json> <unchanged-product>...
Exits 0 iff every named product's position row is byte-identical between
the two canonical position files. Products NOT named may change (that is
the composition change under test). Prints what moved.
"""
import json
import sys

before = {r["product_id"]: r for r in json.load(open(sys.argv[1]))}
after = {r["product_id"]: r for r in json.load(open(sys.argv[2]))}
unchanged = sys.argv[3:]

failures = 0
for product in unchanged:
    b, a = before.get(product), after.get(product)
    if b != a:
        print(f"DRIFT: {product} changed:")
        print(f"  before: {json.dumps(b, sort_keys=True)}")
        print(f"  after:  {json.dumps(a, sort_keys=True)}")
        failures += 1

if failures:
    print(f"{failures} product(s) drifted")
    sys.exit(1)
print(f"no drift: {', '.join(unchanged)} identical")
