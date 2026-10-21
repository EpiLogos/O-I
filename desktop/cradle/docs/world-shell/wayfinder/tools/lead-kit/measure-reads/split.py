"""Split a kernel trace by the load phases in a marks file and count owner processes, ops and read outcomes per phase.
Usage: python3 split.py TRACE MARKS"""
import collections, re, sys

trace, marks = sys.argv[1], sys.argv[2]
phases = [line.split(None, 1) for line in open(marks).read().splitlines() if line.strip()]
phases = [(int(t), label) for t, label in phases]
bounds = {label: t for t, label in phases}
windows = [("first load", bounds["first-load"], bounds["reload"]), ("reload", bounds["reload"], bounds["end"])]

line_re = re.compile(r"\[(\w+)\] (\d+) (\S+) (.*)")
rows = []
for line in open(trace, errors="replace"):
    m = line_re.match(line)
    if m:
        rows.append((m.group(1), int(m.group(2)), m.group(3), m.group(4)))

for name, start, end in windows:
    inside = [r for r in rows if start <= r[1] < end]
    procs = [r for r in inside if r[0] == "owner" and r[2] == "process"]
    ops = [r for r in inside if r[0] == "native" and r[2] == "op"]
    reads = collections.Counter(r[3].rsplit(" ", 1)[-1] for r in inside if r[0] == "read")
    proc_ms = 0.0
    by_cmd = collections.Counter()
    for r in procs:
        ms = re.search(r"total_ms=([\d.]+)", r[3])
        proc_ms += float(ms.group(1)) if ms else 0
        by_cmd[re.sub(r" (ok|err) total_ms=.*", "", r[3])] += 1
    op_names = collections.Counter(r[3].split()[0] for r in ops)
    last_op = max((r[1] for r in ops), default=start) - start
    print(f"== {name}: {len(procs)} owner processes ({proc_ms/1000:.1f} s process wall), {len(ops)} ops, "
          f"last op at +{last_op/1000:.1f} s, reads {dict(reads)}")
    for cmd, n in by_cmd.most_common(12):
        print(f"   {n:3d}  {cmd}")
    print("   ops:", ", ".join(f"{k} x{v}" for k, v in op_names.most_common(14)))
