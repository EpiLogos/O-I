#!/bin/bash
# Type-check the candidate shell exactly as a given git tree holds it — the commit you are about to make in a shared seat, where the
# working tree also carries other lanes' edits. Exports only the roots the shell's tsc reaches into a scratch directory, links the
# seat's node_modules into it, and runs tsc there through the same machine-wide lock as tsc-serial.sh.
# Usage, from the seat's root: tsc-tree.sh <tree-ish> <scratch dir>     (e.g. a tree from `GIT_INDEX_FILE=… git write-tree`)
# Prints tsc's output and `tsc-exit=<code>`; the script itself always exits 0. Removes the export when done.
set -u
TREE="$1"; OUT="$2"
SEAT="$(git rev-parse --show-toplevel)"
ROOTS=(packages/live-shell/ui packages/expressions-boundary packages/oi-design-system desktop/cradle/src desktop/cradle/expressions-app desktop/cradle/documents desktop/cradle/kernel/src/expression_blueprint_sixfold.json shared-field suite/configuration)
rm -rf "$OUT"; mkdir -p "$OUT"
git -C "$SEAT" archive "$TREE" "${ROOTS[@]}" | tar -x -C "$OUT"
for modules in node_modules packages/live-shell/ui/node_modules desktop/cradle/node_modules desktop/cradle/expressions-app/node_modules \
  packages/expressions-boundary/node_modules packages/oi-design-system/node_modules; do
  [ -e "$SEAT/$modules" ] && mkdir -p "$(dirname "$OUT/$modules")" && ln -s "$SEAT/$modules" "$OUT/$modules"
done
LOCK=${OI_TSC_LOCK:-/tmp/oi-tsc-serial.lock}
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null); if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  sleep 10
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
(cd "$OUT/packages/live-shell/ui" && npx tsc --noEmit -p .); echo "tsc-exit=$?"
rm -rf "$OUT"
