#!/usr/bin/env bash
# The foundation gate (O-I #1000; docs/architecture/world-shell.md §9.5): the spine's five acts against the installed owners, each
# in its own fresh, isolated home (desktop/cradle/kernel/tests/foundation.rs), checked against the board (gates/foundation/acts.json),
# and the foundation's two rules over device and view code (gates/foundation/lint.mjs). One command runs all of it; the landing tier
# runs this command (gates/manifest.json `foundation`).
#
#   gates/foundation/run.sh                    every act, then the lint
#   gates/foundation/run.sh --act NAME         one act (its name in acts.json), then the lint
#   gates/foundation/run.sh --lint-only        the lint alone (what CI runners, which hold no installed owners, run)
#
# The board holds when every act listed green passes and every act listed red fails; an act listed red that passes fails the gate
# until its row is flipped in the same change. A refusal or a dimmed control is never a pass: each act reads its effect back from the
# owner that holds it. Owners come from OI_AIKIT_BIN, OI_CENTRAL_CTRL_BIN, OI_FACTORY_BIN, … (else the installed suite). An agent's
# own sign-in stays the person's (Claude Code's login keychain, Codex's and Pi's auth.json, linked into each act's fresh home);
# nothing else of theirs is reached: each agent's settings, models and sessions stay in the fresh home.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
here="$repo/gates/foundation"
kernel="$repo/desktop/cradle/kernel"
only=""
lint_only=0
while [ $# -gt 0 ]; do
  case "$1" in
    --act) only="$2"; shift ;;
    --lint-only) lint_only=1 ;;
    *) echo "foundation: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

lint_status=0
node "$here/lint.mjs" || lint_status=$?
if [ "$lint_only" = 1 ]; then exit "$lint_status"; fi

# The acts drive the installed owners; a machine that holds none (a CI runner) runs the lint alone, and says so.
suite="$HOME/Library/Application Support/OI/bin"
if [ -z "${OI_CENTRAL_CTRL_BIN:-}" ] && [ ! -x "$suite/ctrl" ]; then
  echo "foundation: this machine holds no installed owners, so the five acts did not run here; the lint alone ran"
  exit "$lint_status"
fi

receipts="${FOUNDATION_RECEIPTS:-$repo/target/foundation}"
mkdir -p "$receipts"
board="$here/acts.json"

# Isolated home and history for cargo and everything it starts; the toolchain stays the caller's. Each act makes its own fresh
# World under /tmp (a short path: the owners' Unix sockets are bounded in length).
real_home="$HOME"
export CARGO_HOME="${CARGO_HOME:-$real_home/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$real_home/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR="${FOUNDATION_CARGO_TARGET_DIR:-${CARGO_TARGET_DIR:-$repo/target/foundation-gate}}"
scratch="$(mktemp -d /tmp/oi-fg-run.XXXXXX)"
trap 'rm -rf "$scratch"' EXIT
# A GIT_* exported around a suite aims its git at the wrong repository.
for name in $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p'); do unset "$name"; done
# The agents' own sign-in, never their state: the files of the person's that hold it, linked into each act's fresh home
# (foundation.rs World::fresh) — Claude Code's login keychain (macOS finds it under HOME), Codex's and Pi's auth.json.
sign_in=""
for file in Library/Keychains/login.keychain-db .codex/auth.json .pi/agent/auth.json; do
  if [ -f "$real_home/$file" ]; then sign_in="${sign_in:+$sign_in:}$file"; fi
done
export FOUNDATION_REAL_HOME="$real_home" FOUNDATION_SIGN_IN="$sign_in"

(cd "$kernel" && cargo test --locked --test foundation --no-run >"$receipts/build.log" 2>&1) || {
  echo "foundation: the act scripts did not build; see $receipts/build.log" >&2
  exit 1
}

acts="$(python3 -c 'import json,sys; [print(r["act"]) for r in json.load(open(sys.argv[1]))]' "$board")"
results="$receipts/results.tsv"
: >"$results"
for act in $acts; do
  if [ -n "$only" ] && [ "$act" != "$only" ]; then continue; fi
  test_name="$(python3 -c 'import json,sys; print(next(r["test"] for r in json.load(open(sys.argv[1])) if r["act"]==sys.argv[2]))' "$board" "$act")"
  log="$receipts/$act.log"
  echo "foundation: $act"
  started=$(date +%s)
  if (cd "$kernel" && HOME="$scratch" HISTFILE=/dev/null \
      cargo test --locked --test foundation -- --ignored --exact --nocapture "$test_name") >"$log" 2>&1; then
    status=passed; detail=passed
  else
    status=failed
    detail="$(sed -n 's/^FOUNDATION-FAIL [^:]*: //p' "$log" | head -1)"
    detail="${detail:-the act failed before it ran; see $log}"
  fi
  printf '%s\t%s\t%s\t%s\n' "$act" "$status" "$(( $(date +%s) - started ))" "$detail" >>"$results"
  echo "  $status: $detail"
done

verdict="$(python3 - "$board" "$results" "$receipts" "$(git -C "$repo" rev-parse HEAD 2>/dev/null || echo unknown)" <<'PY'
import json, sys, datetime
board_path, results_path, out, commit = sys.argv[1:5]
board = {r["act"]: r for r in json.load(open(board_path))}
acts, problems = [], []
for line in open(results_path):
    act, status, seconds, detail = line.rstrip("\n").split("\t", 3)
    standing = board[act]["standing"]
    acts.append({"act": act, "standing": standing, "status": status, "seconds": int(seconds), "detail": detail})
    if standing == "green" and status != "passed":
        problems.append(f"{act} is listed green and failed: {detail}")
    if standing == "red" and status == "passed":
        problems.append(f"{act} is listed red and passed: flip its row in gates/foundation/acts.json")
receipt = {"schema": "oi.foundation-gate/v1", "commit": commit, "acts": acts, "problems": problems,
           "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}
json.dump(receipt, open(f"{out}/receipt.json", "w"), indent=2)
for p in problems:
    print(p, file=sys.stderr)
print("fail" if problems else "pass")
PY
)"
echo "foundation: receipt $receipts/receipt.json"
if [ "$verdict" = pass ] && [ "$lint_status" = 0 ]; then
  echo "foundation: the board holds"
  exit 0
fi
echo "foundation: the board does not hold" >&2
exit 1
