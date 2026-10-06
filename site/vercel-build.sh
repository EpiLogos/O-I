#!/usr/bin/env bash
# Vercel build for oi.epi-logos.org — reproduces the site workflow's build steps
# (.github/workflows/site.yml) so the custom domain deploys the same bytes CI
# verifies. The pinned source refs are READ from the workflow file: one source
# of truth, and the pin moves in the same merge that moves the corpus.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
SOURCES="$ROOT/.publication-sources"

WF=".github/workflows/site.yml"
PCD_REF=$(awk '/repository: EpiLogos\/Point-Cloud-Demo/{f=1} f && /ref:/{print $2; exit}' "$WF")
ESSAY_REF=$(awk '/repository: EpiLogos\/Antykathera-Essay-Work/{f=1} f && /ref:/{print $2; exit}' "$WF")
test -n "$PCD_REF" && test -n "$ESSAY_REF" || { echo "could not read pins from $WF" >&2; exit 1; }
echo "vercel-build: Point-Cloud-Demo @ $PCD_REF"
echo "vercel-build: Antykathera-Essay-Work @ $ESSAY_REF"

mkdir -p "$SOURCES"
clone_at() { # repo-ref clone-path  — GitHub allows fetching any object sha
  local url="https://github.com/$1" ref="$2" path="$3"
  rm -rf "$path"
  git init -q "$path"
  git -C "$path" remote add origin "$url"
  git -C "$path" fetch -q --depth 1 origin "$ref"
  git -C "$path" checkout -q FETCH_HEAD
}
clone_at "EpiLogos/Point-Cloud-Demo" "$PCD_REF" "$SOURCES/Point-Cloud-Demo"
clone_at "EpiLogos/Antykathera-Essay-Work" "$ESSAY_REF" "$SOURCES/essay-reading"

echo "vercel-build: installs"
(cd site && npm install --no-audit --no-fund)
(cd site && npm install --prefix ../packages/oi-design-system --no-audit --no-fund)
(cd site && npm install --prefix ../shared-field/spacetimedb --no-audit --no-fund)
(cd site && npm ci --prefix vendor/quartz --no-audit --no-fund)

echo "vercel-build: SpaceTimeDB CLI 2.8.1"
curl -sSf https://install.spacetimedb.com | \
  SPACETIME_DOWNLOAD_ROOT="https://github.com/clockworklabs/SpacetimeDB/releases/download/v2.8.1" \
  sh -s -- -y
export PATH="$HOME/.local/bin:$PATH"
spacetime version install 2.8.1 && spacetime version use 2.8.1

echo "vercel-build: full site build"
(cd site && npm run build)

echo "vercel-build: admitted public reading edition"
cd site
OI_PUBLICATION_ENVELOPE="$ROOT/desktop/cradle/expressions-app/collections/return-of-zero/PUBLICATION-CURATED.json" \
OI_PCD_S_PRODUCTS_ROOT="$SOURCES/Point-Cloud-Demo/production/s-products" \
OI_ESSAY_REPO="$SOURCES/essay-reading" \
OI_ESSAY_BROWSER_REPO="$SOURCES/essay-reading/published-reading/2026-10-04" \
npm run build:public
echo "vercel-build: done"
