#!/usr/bin/env python3
"""op.py: POST kernel ops to the bridge on 127.0.0.1:$BRIDGE_PORT (default 4271) and time them.
usage: op.py '<json op>' [label]       -> one op, prints duration, result, and shim calls made during it
library: post(op) -> (seconds, outcome_kind_or_error)
"""
import json, sys, time, http.client, os

BRIDGE = ("127.0.0.1", int(__import__("os").environ.get("BRIDGE_PORT", "4271")))
SHIM = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs", "shim.tsv")


def post(op, timeout=600):
    body = json.dumps(op).encode()
    t = time.time()
    c = http.client.HTTPConnection(*BRIDGE, timeout=timeout)
    try:
        c.request("POST", "/op", body, {"Content-Type": "application/json", "Connection": "close"})
        r = c.getresponse()
        data = r.read()
    except Exception as e:  # noqa
        return time.time() - t, t, f"transport:{e}", 0
    finally:
        c.close()
    dt = time.time() - t
    try:
        v = json.loads(data)
    except Exception:
        return dt, t, f"unparsable {len(data)}B", len(data)
    if v.get("ok"):
        res = v.get("outcome", {}).get("result")
        if isinstance(res, dict):
            res = res.get("result") or next(iter(res.keys()), "?")
        return dt, t, f"ok:{res}", len(data)
    return dt, t, "err:" + str(v.get("error"))[:140], len(data)


def shim_between(t0, t1):
    rows = []
    try:
        for line in open(SHIM):
            a, b, exe, rc, argv = line.rstrip("\n").split("\t", 4)
            a, b = float(a), float(b)
            if a >= t0 - 0.05 and b <= t1 + 0.2:
                rows.append((a - t0, b - a, exe, rc, argv))
    except FileNotFoundError:
        pass
    return rows


if __name__ == "__main__":
    op = json.loads(sys.argv[1])
    label = sys.argv[2] if len(sys.argv) > 2 else op.get("op")
    dt, t0, res, n = post(op)
    print(f"{label:40s} {dt:7.2f}s  {res}  ({n}B)")
    for off, d, exe, rc, argv in shim_between(t0, t0 + dt):
        print(f"    +{off:6.2f}s {d:6.2f}s {exe:6s} rc={rc} {argv[:110]}")
