#!/bin/sh
# Absence prover for install-mode campaign cases: for each named product,
# prove it is genuinely absent from the composition, the filesystem, the
# PATH and the service manager. Presence of an unselected dependency is a
# case failure — never a warning.
#
# Usage (inside a case phase, after the composition under test is active):
#   check-closure.sh <product>...
#
# A product counts as present if ANY of these find it:
#   - a module row in $OI_HOME/composition.json
#   - a position in `oi current-world --json`
#   - an executable resolvable on PATH or in the usual bin dirs
#   - an O:I-managed install directory under $OI_DATA_HOME/installs
#   - an enabled or loaded systemd user unit whose name mentions it

set -u

[ "$#" -ge 1 ] || { echo "usage: check-closure.sh <product>..." >&2; exit 2; }

FAILURES=0
report="${OI_EVIDENCE:-/tmp}/closure-report-$(id -u).txt"
: >"$report"

found() {
    echo "PRESENT (must be absent): $1 — $2" | tee -a "$report"
    FAILURES=$((FAILURES + 1))
}

for product in "$@"; do
    echo "checking absence of: $product" | tee -a "$report"

    # 1. composition registration
    if [ -f "${OI_HOME:-$HOME/.oi}/composition.json" ]; then
        if grep -q "\"$product\"" "${OI_HOME:-$HOME/.oi}/composition.json"; then
            found "$product" "registered in composition.json"
        fi
    fi

    # 2. current-world position (authoritative effective composition)
    if command -v oi >/dev/null 2>&1; then
        if oi current-world --json 2>/dev/null | grep -q "\"id\": *\"$product\""; then
            found "$product" "position in oi current-world"
        fi
    fi

    # 3. executable resolvable on PATH or in the usual bin dirs
    if command -v "$product" >/dev/null 2>&1; then
        found "$product" "executable on PATH: $(command -v "$product")"
    fi
    for dir in /usr/local/bin /usr/bin "$HOME/.local/bin" "$OI_DATA_HOME/cargo/bin"; do
        [ -e "$dir/$product" ] && found "$product" "binary at $dir/$product"
    done

    # 4. O:I-managed install payloads
    for base in "${OI_DATA_HOME:-$HOME/.local/share/oi}/installs" "${OI_HOME:-$HOME/.oi}/installs"; do
        [ -d "$base" ] && find "$base" -maxdepth 1 -name "*$product*" | grep -q . &&
            found "$product" "managed install payload under $base"
    done

    # 5. systemd user units
    if systemctl --user list-unit-files --no-pager 2>/dev/null | grep -qi "$product"; then
        found "$product" "systemd user unit mentions it"
    fi
done

if [ "$FAILURES" -eq 0 ]; then
    echo "closure OK: all of $* absent" | tee -a "$report"
    exit 0
fi
echo "closure FAILED: $FAILURES finding(s)" | tee -a "$report"
exit 1
