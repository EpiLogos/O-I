#!/usr/bin/env python3
"""Demote pre-local artifact publication from release standing to build evidence.

This migration preserves historical artifact locators/checksums/attestations while
making current native-main source truth the only pre-#97 acceptance authority.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"missing migration anchor in {path}: {old!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


# Historical artifact record: retain reproducibility evidence, remove ratification.
manifest_path = ROOT / "suite/manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
accepted_at = manifest.pop("accepted_at", None)
if accepted_at is None and "recorded_at" not in manifest:
    raise SystemExit("suite manifest has neither accepted_at nor recorded_at")
manifest["recorded_at"] = manifest.get("recorded_at", accepted_at)
manifest["standing"] = "historical-unratified-prelocal-build-record"
manifest["purpose"] = (
    "Historical checksummed and attested pre-local build evidence retained for "
    "reproducibility and deterministic installation tests; not release ratification, "
    "product acceptance, or current-main authority."
)
for product in manifest["products"]:
    tag = product.pop("release_tag", None)
    if tag is not None:
        product["historical_tag"] = tag
    elif "historical_tag" not in product:
        raise SystemExit(f"{product.get('id')} has neither release_tag nor historical_tag")
write_json(manifest_path, manifest)

# Mainline source truth points at the build record without granting it release standing.
mainline_path = ROOT / "suite/mainline.json"
mainline = json.loads(mainline_path.read_text(encoding="utf-8"))
legacy = mainline.pop("release_manifest", None)
if legacy is not None:
    mainline["build_record"] = {
        "path": legacy["path"],
        "suite_version": legacy["suite_version"],
        "recorded_at": legacy.get("accepted_at", manifest["recorded_at"]),
        "standing": "historical-unratified-prelocal-build-record",
        "relation": "historical-build-evidence-not-current-main-authority",
    }
elif "build_record" not in mainline:
    raise SystemExit("mainline snapshot has neither release_manifest nor build_record")
write_json(mainline_path, mainline)

# Runtime language: retain exact artifact mechanics but stop calling them accepted releases.
suite = ROOT / "cli/src/suite_v2.rs"
replacements = [
    ("    accepted_at: String,\n", "    recorded_at: String,\n    standing: String,\n"),
    ("    release_tag: String,\n", "    historical_tag: String,\n"),
    ('println!("{{O:I}} — accepted six-product suite operator");', 'println!("{{O:I}} — pre-local six-product artifact operator");'),
    ('println!("Suite: {} (accepted {})", manifest.suite_version, manifest.accepted_at);', 'println!("Build record: {} (recorded {}; {})", manifest.suite_version, manifest.recorded_at, manifest.standing);'),
    ('return Err(format!("unsupported suite manifest schema {}", manifest.schema));\n    }', 'return Err(format!("unsupported suite manifest schema {}", manifest.schema));\n    }\n    if manifest.standing != "historical-unratified-prelocal-build-record" {\n        return Err(format!("unsupported suite build standing {}", manifest.standing));\n    }'),
    ('"no accepted first-suite binary target for {os}/{arch}"', '"no recorded pre-local build target for {os}/{arch}"'),
    ('"{} has no accepted artifact for {target}"', '"{} has no recorded pre-local build artifact for {target}"'),
    ('println!("Installed accepted suite {}.", manifest.suite_version);', 'println!("Installed recorded pre-local build set {}.", manifest.suite_version);'),
    ('product.release_tag', 'product.historical_tag'),
    ('"managed product root {} exists without the accepted marker; refusing to rewrite it"', '"managed product root {} exists without the recorded build marker; refusing to rewrite it"'),
    ('"tar is required to unpack accepted suite artifacts"', '"tar is required to unpack recorded pre-local build artifacts"'),
    ('"release_tag": product.historical_tag', '"historical_tag": product.historical_tag'),
    ('"curl is required for release-artifact installation"', '"curl is required for pre-local build-artifact installation"'),
    ('println!("Updating only to accepted suite manifest {} (never arbitrary latest).", manifest.suite_version);', 'println!("Updating only to recorded pre-local build set {} (never arbitrary latest).", manifest.suite_version);'),
    ('println!("  {:<18} accepted  {}", product.public_name, product.revision)', 'println!("  {:<18} recorded  {}", product.public_name, product.revision)'),
    ('println!("  {:<18} drift     {} (accepted {})", product.public_name, installed.revision, product.revision)', 'println!("  {:<18} drift     {} (recorded {})", product.public_name, installed.revision, product.revision)'),
    ('println!("  {:<18} missing   accepted {}", product.public_name, product.revision)', 'println!("  {:<18} missing   recorded {}", product.public_name, product.revision)'),
    ('"verified release archive missing from managed cache"', '"recorded build archive missing from managed cache"'),
    ('"cached release archive checksum mismatch"', '"cached build archive checksum mismatch"'),
]
for old, new in replacements:
    replace(suite, old, new)

replace(
    ROOT / "cli/src/main.rs",
    "// O:I 0.1.0-prelocal.4 release-candidate front door.",
    "// O:I pre-local verification/build front door; no release standing is implied.",
)

# Mainline verifier: source acceptance and historical build evidence are distinct.
verifier = ROOT / "scripts/verify-mainline-snapshot.py"
verifier_text = verifier.read_text(encoding="utf-8")
verifier_text = verifier_text.replace(
    "1. suite/manifest.json is an immutable released-artifact snapshot;",
    "1. suite/manifest.json is a historical unratified pre-local build record;",
)
verifier_text = verifier_text.replace('release = load("suite/manifest.json")', 'build_record = load("suite/manifest.json")')
verifier_text = verifier_text.replace('release_relation = snapshot.get("release_manifest", {})', 'record_relation = snapshot.get("build_record", {})')
verifier_text = verifier_text.replace('release_relation.get("relation") != "historical-immutable-release-snapshot"', 'record_relation.get("relation") != "historical-build-evidence-not-current-main-authority"')
verifier_text = verifier_text.replace('die("release/mainline provenance relation is not explicit")', 'die("build-record/mainline provenance relation is not explicit")')
verifier_text = verifier_text.replace('release_relation.get("suite_version") != release.get("suite_version")', 'record_relation.get("suite_version") != build_record.get("suite_version")')
verifier_text = verifier_text.replace('die("recorded historical release version does not match suite/manifest.json")', 'die("recorded historical build version does not match suite/manifest.json")')
verifier_text = verifier_text.replace('release_relation.get("accepted_at") != release.get("accepted_at")', 'record_relation.get("recorded_at") != build_record.get("recorded_at")')
verifier_text = verifier_text.replace('die("recorded historical release date does not match suite/manifest.json")', 'die("recorded historical build date does not match suite/manifest.json")')
verifier_text = verifier_text.replace(
    'print(\n        f"release snapshot remains distinct: {release[\'suite_version\']} accepted {release[\'accepted_at\']}"\n    )',
    'if build_record.get("standing") != "historical-unratified-prelocal-build-record":\n        die("historical build record has release/acceptance standing")\n    print(\n        f"historical build record remains distinct: {build_record[\'suite_version\']} "\n        f"recorded {build_record[\'recorded_at\']}; unratified"\n    )',
)
verifier.write_text(verifier_text, encoding="utf-8")

# O:I pre-local workflow: verify/build/attest only; never publish a release or fixed tag.
(ROOT / ".github/workflows/prelocal-release.yml").write_text("""name: Pre-local O:I verification

on:
  pull_request:
    paths:
      - 'cli/**'
      - 'suite/**'
      - 'surfaces.json'
      - 'desktop/**'
      - 'packages/oi-design-system/**'
      - 'packages/oi-cli/**'
      - '.github/workflows/prelocal-release.yml'
  push:
    branches: [main]
    paths:
      - 'cli/**'
      - 'suite/**'
      - 'surfaces.json'
      - 'desktop/**'
      - 'packages/oi-design-system/**'
      - 'packages/oi-cli/**'
      - '.github/workflows/prelocal-release.yml'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --manifest-path cli/Cargo.toml --locked

  desktop-bundle:
    runs-on: macos-15
    permissions:
      contents: read
      id-token: write
      attestations: write
      artifact-metadata: write
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: desktop/ui/package-lock.json
      - name: Install locked desktop UI graph
        run: npm ci --prefix desktop/ui --no-audit --no-fund
      - name: Prove locked native-shell graph
        run: cargo check --manifest-path desktop/src-tauri/Cargo.toml --locked --target aarch64-apple-darwin
      - name: Build Apple Silicon Tauri app bundle
        shell: bash
        run: |
          set -euo pipefail
          cd desktop/src-tauri
          ../ui/node_modules/.bin/tauri build --bundles app --target aarch64-apple-darwin
      - name: Prove build did not rewrite locks
        run: git diff --exit-code -- desktop/src-tauri/Cargo.lock desktop/ui/package-lock.json
      - name: Package exact-SHA desktop artifact
        shell: bash
        run: |
          set -euo pipefail
          bundle_dir='desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos'
          app="$(find "$bundle_dir" -maxdepth 1 -type d -name '*.app' -print -quit)"
          test -n "$app"
          short_sha="${GITHUB_SHA:0:12}"
          mkdir -p dist
          archive="dist/oi-desktop-prelocal-${short_sha}-aarch64-apple-darwin.app.tar.gz"
          tar -C "$(dirname "$app")" -czf "$archive" "$(basename "$app")"
          shasum -a 256 "$archive" > "$archive.sha256"
      - uses: actions/attest@v4
        if: github.event_name == 'push'
        with:
          subject-path: dist/*.tar.gz
      - uses: actions/upload-artifact@v4
        if: github.event_name == 'push'
        with:
          name: oi-desktop-prelocal-${{ github.sha }}-aarch64-apple-darwin
          retention-days: 14
          path: |
            dist/*.tar.gz
            dist/*.sha256

  artifact:
    if: github.event_name == 'push'
    needs: verify
    permissions:
      contents: read
      id-token: write
      attestations: write
      artifact-metadata: write
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
          - os: macos-15
            target: aarch64-apple-darwin
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - name: Build locked O:I bootstrap
        run: cargo build --manifest-path cli/Cargo.toml --locked --release --target '${{ matrix.target }}' --bin oi
      - name: Package exact-SHA pre-local artifact
        shell: bash
        run: |
          set -euo pipefail
          short_sha="${GITHUB_SHA:0:12}"
          name="oi-prelocal-${short_sha}-${{ matrix.target }}"
          mkdir -p "dist/$name"
          cp "cli/target/${{ matrix.target }}/release/oi" "dist/$name/oi"
          cp suite/manifest.json "dist/$name/suite-build-record.json"
          printf '%s\n' "$GITHUB_SHA" > "dist/$name/COMMIT"
          tar -C dist -czf "dist/$name.tar.gz" "$name"
          shasum -a 256 "dist/$name.tar.gz" > "dist/$name.tar.gz.sha256"
      - uses: actions/attest@v4
        with:
          subject-path: dist/*.tar.gz
      - uses: actions/upload-artifact@v4
        with:
          name: oi-prelocal-${{ github.sha }}-${{ matrix.target }}
          retention-days: 14
          path: |
            dist/*.tar.gz
            dist/*.sha256

  npm-package:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      attestations: write
      artifact-metadata: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Verify npm distribution package
        working-directory: packages/oi-cli
        run: npm test
      - name: Pack npm distribution artifact
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p dist
          npm pack ./packages/oi-cli --pack-destination dist
          for archive in dist/*.tgz; do
            sha256sum "$archive" > "$archive.sha256"
          done
      - uses: actions/attest@v4
        with:
          subject-path: dist/*.tgz
      - uses: actions/upload-artifact@v4
        with:
          name: oi-npm-prelocal-${{ github.sha }}
          retention-days: 14
          path: |
            dist/*.tgz
            dist/*.sha256
""", encoding="utf-8")

# Existing preflight keeps exercising the historical build set but stops granting it release standing.
preflight = ROOT / ".github/workflows/full-suite-preflight.yml"
text = preflight.read_text(encoding="utf-8")
for old, new in [
    ("name: Released suite preflight", "name: Pre-local suite verification"),
    ("Install immutable six-product release suite twice", "Install recorded six-product pre-local build set twice"),
    ("Release status and doctor match immutable release manifest", "Status and doctor match recorded pre-local build manifest"),
    ("Release truth and current-main truth remain explicitly distinct", "Recorded build evidence and current-main truth remain explicitly distinct"),
    ("release = json.load(open('suite/manifest.json'))", "build_record = json.load(open('suite/manifest.json'))"),
    ("release_by_id = {p['id']: p['revision'] for p in release['products']}", "build_by_id = {p['id']: p['revision'] for p in build_record['products']}") ,
    ("assert set(release_by_id) == set(current_by_id)", "assert set(build_by_id) == set(current_by_id)"),
    ("assert any(release_by_id[k] != current_by_id[k] for k in release_by_id), (", "assert any(build_by_id[k] != current_by_id[k] for k in build_by_id), ("),
    ("'historical release and current-main source world unexpectedly collapsed into one revision set'", "'historical build record and current-main source world unexpectedly collapsed into one revision set'"),
    ("Upload released-suite evidence", "Upload pre-local suite verification evidence"),
    ("oi-released-suite-preflight-${{ github.sha }}", "oi-prelocal-suite-verification-${{ github.sha }}"),
]:
    if old not in text:
        raise SystemExit(f"missing preflight anchor: {old}")
    text = text.replace(old, new)
old_jq = "jq -e '.schema == \"oi.suite-manifest/v1\" and .suite_version == \"0.1.0-prelocal.2\" and (.products | length == 6)' \"$RUNNER_TEMP/manifest.json\""
new_jq = "jq -e '.schema == \"oi.suite-manifest/v1\" and .suite_version == \"0.1.0-prelocal.2\" and .standing == \"historical-unratified-prelocal-build-record\" and (.products | length == 6)' \"$RUNNER_TEMP/manifest.json\""
if old_jq not in text:
    raise SystemExit("missing preflight manifest jq anchor")
text = text.replace(old_jq, new_jq)
preflight.write_text(text, encoding="utf-8")

print("pre-#97 release-standing migration applied")
