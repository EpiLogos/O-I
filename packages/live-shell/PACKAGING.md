# Candidate native payload

This packet qualifies and packages candidate bytes. It does not establish native
operation, authority, installed usability or the programme's 126 targets.
Source basis: `Work/reverse-engineering/2026-10-07-techne-instrument-re/PROGRAMME.md`
(2026-10-07 owner amendments), native `desktop/install-footprint.json`,
`cli/src/desktop_install.rs`, and the existing `desktop/cradle/package-bundle.sh`.

`package-payload.py` accepts a real adapted Darwin Tauri `.app`, this candidate's
two built application directories, the native desktop footprint, explicit native
product bindings and actual third-party notices. It neither builds nor installs
anything. Linux packaging is pending actual native host/resource adaptation;
this packet does not relabel the development `walk-bridge` as a shipped host.

The existing installer consumes the unchanged outer contract:

```
oi-desktop-bundle/
  BUNDLE.json                 oi.desktop-bundle/v1
  footprint.json              oi.desktop-footprint/v1
  app/O-I Shell Candidate.app/
    Contents/MacOS/oi-cradle   actual Tauri/native owner host
    Contents/Resources/live-shell-host.json
    Contents/Resources/SHELL-PAYLOAD.json   oi.live-shell-payload/v1
    Contents/Resources/live-shell/
      shell/                  built shell assets, /app/index.html
      expressions/            built Expressions assets
      native-products/<id>/   exact selected owner binaries/descriptors/notices
      notices/                actual candidate third-party notices
```

Everything the separately copied macOS application needs stays inside `.app`.
Outer archive, checksum sidecar and `.asset.json` use the existing installer
layout. A native install still previews and records owned resources using
`oi desktop install --bundle ...`; the script performs no install operation.

The adapted native host emits `live-shell-host.json` after its actual build:
schema `oi.live-shell-native-host/v1`; exact `source_revision` (40 lowercase hex),
`source_tree_sha256` (64 lowercase hex, actual compiled source basis),
`executable_sha256` (actual `oi-cradle` bytes), and this exact `bootstrap` object:

```json
{"shell_entry":"/app/index.html","expressions_entry":"/__application/expressions/index.html","transport":"tauri-kernel","configuration":"native-owner-discovery","product_resolution":"payload-only"}
```

This is the host producer/packager contract, not an independent acceptance
verdict. The native host must actually mount the candidate entries, use its real
kernel transport, read owner configuration, and resolve selected binaries from
the qualified payload. Host adaptation belongs in the existing Tauri owner;
`app_assets.rs` already admits exact Expressions resources and distinguishes
embedded release bytes from development-checkout assets.

The explicit product input is `oi.live-shell-products/v1`, with `products`
records containing `id`, `source_revision`, `descriptor` (native owner's real
`.oi/product.json`), `executables` (`path`, captured `sha256` per actual native
binary, including owner-declared companions), and `notices` (real source paths).
Selection comes only from the native footprint's `backing.options[backing_id]`;
the default comes from `backing.default`. Exact identity sets must match. Extra
installed products do not enter the candidate. No PATH/catalogue/managed-global
search fills a missing binding. Full six-product membership requires its actual
native footprint backing entry; this script cannot invent one from a count.
The commissioned native extension adds `full-suite` with the six named owners,
keeping `0/1`, `0/1/2` and the `0/1/2` default intact. It is a Desktop backing
offer permitted by the composition lock's richer-backing rule, not a new World
mode or an instruction to install six products for ordinary smaller use.

`runtime.rs::qualify(app_root, footprint_bytes)` verifies source/marker identity,
all declared bytes, exact asset inventory, notice bytes, native product descriptor
identity and on-disk membership. It returns asset roots and owner executable
paths without fallback. Parent integration adds `sha2 = "0.10"`, declares this
module, and calls it from the real native host before bootstrap. A source-tree
development path remains explicitly separate; a package failure cannot fall back
to a source checkout or the owner's globally managed products.

Lightweight source gate:

```
python3 -B packages/live-shell/tests/package_payload_test.py
```

Those tests exercise actual candidate build inventory, actual managed native
binary reading, footprint selection, excluded-but-installed product refusal,
actual filesystem containment and symlink refusal. They do not fake a package.
The missing/unadapted native app is tested as a refusal.

Required artifact gate after actual host adaptation: package the real `.app`,
install via the native installer into an isolated owned destination, disconnect
the source checkout from resolution, launch the actual installed app, and
exercise same-origin Expressions, native owner discovery, retained document
read/edit/save/reopen and mode continuity. Repeat with a native smaller backing,
excluded products genuinely absent from its payload, and managed-global products
present but unavailable as fallback. Remove/tamper an asset and a required owner
binary; observe refusal, repair through the owner, and replay the original task.
Record exact source/build/installed digests and independent verification. Until
then the standing is prepared source and packaged bytes, with functional native
installation acceptance pending.
