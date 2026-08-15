#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PREFIX=${OI_BIN_DIR:-"$HOME/.local/bin"}
CARGO_ROOT=${OI_CARGO_ROOT:-"$HOME/.local/share/oi/cargo"}

command -v cargo >/dev/null 2>&1 || {
  echo "oi install: cargo is required to build the current Rust CLI" >&2
  exit 1
}

cargo install --path "$ROOT/cli" --root "$CARGO_ROOT"
mkdir -p "$PREFIX"
ln -sf "$CARGO_ROOT/bin/oi" "$PREFIX/oi"

printf '%s\n' "Installed oi at $PREFIX/oi"
printf '%s\n' "Ensure $PREFIX is on PATH, then run: oi init"
