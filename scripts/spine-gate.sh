#!/usr/bin/env bash
# The spine gate: the five acts a person does on a fresh Mac, each run
# against the real programs in a fresh isolated home
# (desktop/cradle/kernel/tests/spine.rs), checked against the honest board
# (desktop/cradle/kernel/tests/spine-acts.json), receipted under
# target/spine/, and posted as the commit status `spine/<act>` that landing
# and ticket close read.
#
#   scripts/spine-gate.sh            run on HEAD: clean, pushed tree; posts statuses
#   scripts/spine-gate.sh --local [--kernel DIR] [--commit SHA] [--receipt-dir DIR]
#                                    run without git checks and without posting
#                                    (`oi dev gate` runs this on its captured kernel)
#
# The gate fails when an act listed green fails, or an act listed red passes
# (flip its row in the same change). A red act posts `failure` with its
# reason. Owner binaries come from OI_AIKIT_BIN, OI_CENTRAL_CTRL_BIN,
# OI_FACTORY_BIN, … (else the installed suite). talk-to-an-agent also needs
# PI_CODING_AGENT_DIR and AIKIT_AGENCY_MINT_TEMPLATE from the caller.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kernel="$repo/desktop/cradle/kernel"
local_mode=0
commit=""
receipt_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --local) local_mode=1 ;;
    --kernel) kernel="$(cd "$2" && pwd)"; shift ;;
    --commit) commit="$2"; shift ;;
    --receipt-dir) receipt_dir="$2"; shift ;;
    *) echo "spine-gate: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
board="$kernel/tests/spine-acts.json"
[ -f "$board" ] || { echo "spine-gate: no board at $board" >&2; exit 2; }

if [ "$local_mode" = 0 ]; then
  cd "$repo"
  if [ -n "$(git status --porcelain)" ]; then
    echo "spine-gate: refused: the tree is dirty; commit first, the statuses name a commit" >&2
    exit 2
  fi
  commit="$(git rev-parse HEAD)"
  if [ -z "$(git branch -r --contains "$commit")" ]; then
    echo "spine-gate: refused: HEAD $commit is on no remote branch; push it first" >&2
    exit 2
  fi
fi
commit="${commit:-unknown}"
receipt_dir="${receipt_dir:-$repo/target/spine}"
mkdir -p "$receipt_dir"

# Isolated home and history for cargo and everything it starts; the toolchain
# stays the caller's. Each act makes its own fresh World under TMPDIR.
real_home="${HOME}"
export CARGO_HOME="${CARGO_HOME:-$real_home/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$real_home/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/oi-spine-gate.XXXXXX")"
export HOME="$scratch/home" HISTFILE=/dev/null TMPDIR="$scratch/tmp"
mkdir -p "$HOME" "$TMPDIR"
export CARGO_TARGET_DIR="${SPINE_CARGO_TARGET_DIR:-$receipt_dir/cargo-target}"
# A GIT_* exported around a suite aims its git at the wrong repository.
for name in $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p'); do unset "$name"; done

acts="$(python3 -c 'import json,sys; [print(r["act"]) for r in json.load(open(sys.argv[1]))]' "$board")"
(cd "$kernel" && cargo test --locked --test spine --no-run >"$receipt_dir/build.log" 2>&1) || {
  echo "spine-gate: the spine tests did not build; see $receipt_dir/build.log" >&2
  exit 1
}

results="$receipt_dir/results.tsv"
: >"$results"
for act in $acts; do
  test_name="spine_${act//-/_}"
  log="$receipt_dir/$act.log"
  echo "spine-gate: $act"
  if (cd "$kernel" && cargo test --locked --test spine -- --ignored --exact --nocapture "$test_name") >"$log" 2>&1; then
    status=passed
    detail="passed"
  else
    status=failed
    detail="$(sed -n 's/^SPINE-FAIL [^:]*: //p' "$log" | head -1)"
    detail="${detail:-the test failed before its act ran; see $act.log}"
  fi
  printf '%s\t%s\t%s\n' "$act" "$status" "$detail" >>"$results"
done

# Check against the board, write the receipt, and say what each status is.
verdict="$(python3 - "$board" "$results" "$commit" "$receipt_dir" <<'PY'
import json, sys, datetime
board_path, results_path, commit, out = sys.argv[1:5]
board = {r["act"]: r for r in json.load(open(board_path))}
acts, problems, statuses = [], [], []
for line in open(results_path):
    act, status, detail = line.rstrip("\n").split("\t", 2)
    acts.append({"act": act, "status": status, "detail": detail})
    standing = board[act]["standing"]
    if standing == "green" and status != "passed":
        problems.append(f"{act} is listed green and failed: {detail}")
    if standing == "red" and status == "passed":
        problems.append(f"{act} is listed red and passed: flip its row in spine-acts.json")
    if status == "passed":
        state, words = "success", "passed" + ("" if standing == "green" else " (listed red: flip the row)")
    else:
        state, words = "failure", ("red: " if standing == "red" else "") + detail
    statuses.append({"act": act, "state": state, "description": words[:140]})
receipt = {"schema": "oi.spine-receipt/v1", "commit": commit, "acts": acts,
           "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}
json.dump(receipt, open(f"{out}/receipt.json", "w"), indent=2)
json.dump(statuses, open(f"{out}/statuses.json", "w"), indent=2)
for p in problems:
    print(p, file=sys.stderr)
print("fail" if problems else "pass")
PY
)"
echo "spine-gate: receipt $receipt_dir/receipt.json"

if [ "$local_mode" = 0 ]; then
  python3 -c 'import json,sys; [print("\t".join([s["act"], s["state"], s["description"]])) for s in json.load(open(sys.argv[1]))]' \
    "$receipt_dir/statuses.json" | while IFS=$'\t' read -r act state description; do
    HOME="$real_home" gh api "repos/EpiLogos/O-I/statuses/$commit" -f state="$state" \
      -f context="spine/$act" -f description="$description" >/dev/null
    echo "spine-gate: posted spine/$act=$state on $commit"
  done
fi
rm -rf "$scratch"

if [ "$verdict" = pass ]; then
  echo "spine-gate: the board holds"
  exit 0
fi
echo "spine-gate: the board does not hold" >&2
exit 1
