#!/usr/bin/env python3
"""door.py IDLE_S MAX_S OUT.tsv — emulate the shell's kernel load against the bridge on $BRIDGE_PORT (default 4271).

Phase idle (IDLE_S): the dev transport's /event-replay pull every 250 ms (used as a kernel-lock
probe: the handler only takes the kernel mutex and reads the event log) + the AgentSessionsProvider
agency_read poll every 3 s with its in-flight guard.
Phase door: keep both going, and fire what a first Technē door fires on the kernel side:
17 register chains (files_list -> file_read -> knowledge relations, all chains at once, no cap),
graph x3 (suite provider: central_wiki, shared_field, aikit_resolution), temporal_events_read,
config_registry_read. Stops when the door ops are all back or MAX_S passes.
"""
import json, sys, time, threading, http.client, re

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from op import post  # noqa

IDLE, MAXS, OUT = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
T0 = time.time()
rows, lock = [], threading.Lock()
stop = threading.Event()


def rec(kind, name, start, dur, res):
    with lock:
        rows.append((kind, name, start - T0, dur, res))


def probe():
    while not stop.is_set():
        t = time.time()
        try:
            c = http.client.HTTPConnection("127.0.0.1", int(__import__("os").environ.get("BRIDGE_PORT", "4271")), timeout=600)
            c.request("GET", "/event-replay?cursor=1&limit=1")
            c.getresponse().read()
            c.close()
            res = "ok"
        except Exception as e:  # noqa
            res = f"err {e}"
        rec("probe", "event-replay", t, time.time() - t, res)
        time.sleep(0.25)


def agency_poll():
    while not stop.is_set():
        t = time.time()
        dt, _, res, _ = post({"op": "agency_read", "project": ""})
        rec("poll", "agency_read", t, dt, res)
        # setInterval(3000) with an in-flight guard: next tick is the next 3 s boundary after return
        nxt = T0 + (int((time.time() - T0) / 3) + 1) * 3
        while time.time() < nxt and not stop.is_set():
            time.sleep(0.05)


def timed(name, op):
    t = time.time()
    dt, _, res, n = post(op)
    rec("door", name, t, dt, res)
    return res


def call(op):
    c = http.client.HTTPConnection("127.0.0.1", int(__import__("os").environ.get("BRIDGE_PORT", "4271")), timeout=900)
    t = time.time()
    c.request("POST", "/op", json.dumps(op), {"content-type": "application/json"})
    body = json.loads(c.getresponse().read()); c.close()
    return t, time.time() - t, body


def register_chain(name, wiki_dir, project):
    t, dt, body = call({"op": "files_list", "path": wiki_dir})
    rec("door", f"files_list {name}", t, dt, "ok" if body.get("ok") else str(body.get("error"))[:80])
    entries = (body.get("outcome") or {}).get("directory", {}).get("entries", [])
    entry = next((e for e in entries if e.get("name") == "wiki.json"), None)
    if not entry:
        rec("door", f"chain {name}", t, 0, "absent")
        return
    t, dt, body = call({"op": "file_read", "location": entry["location"]})
    rec("door", f"file_read {name}", t, dt, "ok" if body.get("ok") else str(body.get("error"))[:80])
    o = body.get("outcome") or {}
    content = o.get("content") or (o.get("reading") or {}).get("content") or (o.get("file") or {}).get("content") or ""
    focus = None
    try:
        doc = json.loads(content)
        objs = doc if isinstance(doc, list) else doc.get("objects", [])
        focus = next((o2.get("ref") for o2 in objs if o2.get("object") == "space"), None)
    except Exception:
        pass
    if not focus:
        rec("door", f"chain {name}", t, 0, "no space " + ",".join(o.keys()))
        return
    timed(f"knowledge relations {name}", {"op": "knowledge", "project": project,
          "request": {"action": "relations", "address": {"kind": "wiki", "value": focus}}})


def main():
    world = json.load(open(__file__.rsplit("/", 1)[0] + "/world.json"))["data"]
    regs = [("central", "Control/agents/wiki", None)]
    for p in world["work"]["projects"]:
        regs.append((p["name"], p["path"] + "/ProjectCentral/agents/wiki", p["name"]))
    threading.Thread(target=probe, daemon=True).start()
    threading.Thread(target=agency_poll, daemon=True).start()
    time.sleep(IDLE)
    door_start = time.time()
    rec("mark", "door", door_start, 0, "")
    ts = [threading.Thread(target=register_chain, args=r) for r in regs]
    for g in ("central_wiki", "shared_field", "aikit_resolution"):
        ts.append(threading.Thread(target=timed, args=(f"graph {g}", {"op": "graph", "query": "", "options": {"input": g, "max_nodes": 4096, "max_edges": 16384}})))
    now_ms = int(time.time() * 1000)
    ts.append(threading.Thread(target=timed, args=("temporal_events_read", {"op": "temporal_events_read", "query": {"window": {"window": "between", "from_unix_ms": now_ms - 7 * 86400000, "to_unix_ms": now_ms}}})))
    ts.append(threading.Thread(target=timed, args=("config_registry_read", {"op": "config_registry_read"})))
    for t in ts:
        t.start()
    for t in ts:
        t.join(max(0.1, MAXS - (time.time() - door_start)))
    rec("mark", "door-done", time.time(), time.time() - door_start, "")
    time.sleep(6)
    stop.set()
    time.sleep(1)
    with open(OUT, "w") as f:
        for r in sorted(rows, key=lambda r: r[2]):
            f.write("\t".join([r[0], r[1], f"{r[2]:.2f}", f"{r[3]:.2f}", str(r[4])]) + "\n")


main()
