# `@epi-logos/oi`

This package is the **distribution surface for the native Rust `oi` command**.

It is deliberately distinct from O:I's `oi.package/v1` extension envelope. The extension envelope describes contributions that target independently owned native product SDKs. `@epi-logos/oi` does not implement that ontology and does not reimplement the CLI in JavaScript; it only installs and launches the native O:I binary.

## Install

Once the npm registry entry is published:

```sh
npm install -g @epi-logos/oi
```

Before that registry publication, the same npm package is attached to the immutable O:I pre-local release and can be installed directly from its tarball:

```sh
npm install -g https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.4/epi-logos-oi-0.1.0-prelocal.4.tgz
```

Then:

```sh
oi help
```

## Registry bootstrap and trusted publishing

npm requires a package to exist in the registry before a trusted publisher can be attached to it. The first `@epi-logos/oi` publication must therefore be performed once by an authenticated npm account that owns the `@epi-logos` scope.

After that bootstrap publication, configure the package's GitHub Actions trusted publisher as:

```text
organization/user   EpiLogos
repository          O-I
workflow filename   npm-publish.yml
allowed action      npm publish
```

`.github/workflows/npm-publish.yml` is the tokenless OIDC publication path after that point and deliberately refuses to pretend it can create the initial npm registry entry.

## What install does

The package resolves the current platform, downloads the corresponding immutable O:I release archive and SHA-256 sidecar, verifies the archive bytes, extracts the native `oi` executable into the package, and exposes it through npm's normal `bin` mechanism.

The pre-local release currently provides native binaries for:

- Apple Silicon macOS (`aarch64-apple-darwin`)
- x64 Linux (`x86_64-unknown-linux-gnu`)

Other platforms fail explicitly rather than silently building a different or unverified artifact. The source install remains available from an O:I checkout.

The GitHub release workflow also produces GitHub artifact attestations for the native archive. This npm installer verifies the published SHA-256 sidecar; it does not replace GitHub's release-attestation verification model.
