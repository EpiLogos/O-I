"""The start-up burst of each launch in a relaunch.sh stack: owner processes within 10 s of the launch's first ask (the first
[read] or [owner] line after its first-load mark), the reads answered in that window, and the whole first-load phase.
Usage: python3 burst.py STACK_DIR [STACK_DIR ...]"""
import collections, os, re, sys

for stack in sys.argv[1:]:
    # A stack's trace.log; trace.txt where it was kept as evidence (git ignores *.log).
    trace = next(name for name in (f"{stack}/trace.log", f"{stack}/trace.txt") if os.path.exists(name))
    rows = []
    for line in open(trace, errors="replace"):
        m = re.match(r"\[(\w+)\] (\d+) (\S+) (.*)", line)
        if m:
            rows.append((m.group(1), int(m.group(2)), m.group(3), m.group(4)))
    seconds = lambda procs: sum(float(re.search(r"total_ms=([\d.]+)", r[3]).group(1)) for r in procs if "total_ms" in r[3]) / 1000
    for n in (1, 2):
        marks = {line.split()[1]: int(line.split()[0]) for line in open(f"{stack}/launch-{n}.txt")}
        start, end = marks["first-load"], marks["reload"]
        procs = [r for r in rows if r[0] == "owner" and r[2] == "process" and start <= r[1] < end]
        first = min((r[1] for r in rows if r[0] in ("read", "owner") and start <= r[1] < end), default=start)
        burst = [r for r in procs if r[1] < first + 10_000]
        reads = collections.Counter(r[3].rsplit(" ", 1)[-1] for r in rows if r[0] == "read" and first <= r[1] < first + 10_000)
        names = collections.Counter(re.sub(r" (ok|err) total_ms=.*", "", r[3]) for r in burst)
        print(f"{stack} launch {n}: first ask +{(first - start) / 1000:.1f} s; burst {len(burst)} owner processes "
              f"({seconds(burst):.2f} s); whole phase {len(procs)} ({seconds(procs):.1f} s); reads {dict(reads)}")
        print("   ", ", ".join(f"{name} x{count}" for name, count in names.most_common()))
    kept = [line.split(" ", 2)[2].strip() for line in open(trace, errors="replace") if line.startswith("[kept]")]
    print("   [kept]", "; ".join(line for line in kept if not line.startswith("wrote")))
