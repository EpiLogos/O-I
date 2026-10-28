# Read the kernel's Graph op through the private walk-bridge; keep counts and timings only in the public record.
import json, sys, time, urllib.request, os, resource, collections
S = sys.argv[1]; port = sys.argv[2]; tag = sys.argv[3]; project = None if sys.argv[4] == '-' else sys.argv[4]
inp = sys.argv[5]; max_nodes = int(sys.argv[6]); max_edges = int(sys.argv[7]); fresh = sys.argv[8] == 'fresh'
body = {"op": "graph", "project": project, "query": "", "options": {"input": inp, "max_nodes": max_nodes, "max_edges": max_edges, "fresh": fresh}}
req = urllib.request.Request(f"http://127.0.0.1:{port}/op", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
load = os.getloadavg()
t0 = time.perf_counter()
raw = urllib.request.urlopen(req, timeout=600).read()
wall = time.perf_counter() - t0
t1 = time.perf_counter(); doc = json.loads(raw); parse = time.perf_counter() - t1
row = {"tag": tag, "project": "root" if project is None else "project", "input": inp, "max_nodes": max_nodes, "max_edges": max_edges, "fresh": fresh,
       "wall_s": round(wall, 3), "bytes": len(raw), "py_json_parse_s": round(parse, 4), "load_1m": round(load[0], 2), "at": time.strftime('%Y-%m-%dT%H:%M:%S')}
if not doc.get("ok"):
    row["error_class"] = (doc.get("error") or "")[:0] + "refused"; row["ok"] = False
else:
    r = doc["outcome"]["reading"]; row["ok"] = True
    row["nodes"] = len(r["nodes"]); row["edges"] = len(r["edges"]); row["truncated"] = bool(r.get("truncated"))
    row["formations"] = len(r.get("formations") or []); row["unresolved_links"] = len(r.get("unresolved_links") or [])
    row["inputs"] = {k: v.get("state") for k, v in r["inputs"].items()}
    row["nodes_by_kind"] = dict(collections.Counter(n.get("kind") for n in r["nodes"]).most_common())
    row["nodes_by_owner"] = dict(collections.Counter(n.get("native_owner") for n in r["nodes"]).most_common())
    row["edges_by_relation"] = dict(collections.Counter(e.get("relation") for e in r["edges"]).most_common(25))
    deg = collections.Counter()
    for e in r["edges"]: deg[e["from_ref"]] += 1; deg[e["to_ref"]] += 1
    ds = sorted(deg.values()); row["degree_max"] = ds[-1] if ds else 0; row["degree_median"] = ds[len(ds)//2] if ds else 0
    row["isolated_nodes"] = sum(1 for n in r["nodes"] if deg.get(n["ref"], 0) == 0)
    # the private copy (owner text) stays in scratch, never in the repository
    open(f"{S}/private/{tag}.json", "wb").write(raw)
print(json.dumps(row))
