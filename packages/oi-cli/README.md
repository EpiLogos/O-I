# `@epi-logos/oi`

This package is the **distribution surface for the native Rust `oi` command**.

It is deliberately distinct from O:I's `oi.package/v1` extension envelope. The extension envelope describes contributions that target independently owned native product SDKs. `@epi-logos/oi` does not implement that ontology and does not reimplement the CLI in JavaScript; it only installs and launches the native O:I binary.

## Current standing

The npm and GitHub Release paths are developed **distribution channels**, not evidence that O:I currently has a stable, verified or known-good release.

Ordinary `main` development produces exact-commit build artifacts and attestations through the pre-local build workflow. It does not mint or select a GitHub Release. A known-good suite state remains downstream of the convergence and physical-acceptance protocol.

Until a release is deliberately selected, the npm installer has no default GitHub release tag. To exercise the GitHub Release download channel explicitly, set:

```sh
OI_NPM_RELEASE_TAG=<tag> npm install -g <package-or-tarball>
```

`OI_NPM_SKIP_DOWNLOAD=1` remains available for package inspection/testing that should not fetch a native binary.

## Registry bootstrap and trusted publishing

npm requires a package to exist in the registry before a trusted publisher can be attached to it. The first `@epi-logos/oi` publication must therefore be performed once by an authenticated npm account that owns the `@epi-logos` scope.

After that bootstrap publication, configure the package's GitHub Actions trusted publisher as:

```text
organization/user   EpiLogos
repository          O-I
workflow filename   npm-publish.yml
allowed action      npm publish
```

`.github/workflows/npm-publish.yml` is the tokenless OIDC publication path after that point. It is manually dispatched and does not require or infer a corresponding GitHub Release; publication through one channel does not establish acceptance standing in another.

## What the GitHub Release download channel does

When `OI_NPM_RELEASE_TAG` is explicitly supplied, the package resolves the current platform, downloads the corresponding O:I archive and SHA-256 sidecar from that GitHub Release, verifies the archive bytes, extracts the native `oi` executable into the package, and exposes it through npm's normal `bin` mechanism.

The current prebuilt channel supports:

- Apple Silicon macOS (`aarch64-apple-darwin`)
- x64 Linux (`x86_64-unknown-linux-gnu`)

Other platforms fail explicitly rather than silently building a different artifact. Source operation remains available from an O:I checkout.

GitHub Release artifacts may carry GitHub artifact attestations when that channel is deliberately exercised. The normal pre-local build channel also attests its exact-commit Actions artifacts. Neither fact by itself constitutes physical or known-good suite acceptance.
