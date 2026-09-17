# Hosting the shared-field module

The hosted SharedField is the `shared-field/spacetimedb` module published to a
SpaceTimeDB server. Nothing here is a second service layer: the module, the
generated client and the acceptance scripts are the deployment.

## Targets

`hosting.json` names the targets. `local` and `ci` publish to a standalone
server on `127.0.0.1:3000`; `hosted` publishes to `maincloud.spacetimedb.com`
as `epilogos-oi-shared-field` (the production field) and `hosted-acceptance` as
`epilogos-oi-shared-field-acceptance` (where live acceptance runs). Change the database name there, not in scripts.

## Credentials stay outside the repository

- The CLI login (`spacetime login`) is the owner's and lives in
  `~/.config/spacetime/cli.toml`. Scripts never perform or store it.
- The SDK owner token — the transport identity that owns the SharedField — is
  persisted by `publish-world.ts` under
  `${OI_STATE_HOME:-~/.local/state/oi}/spacetimedb/<database>.owner-token`
  (mode 0600). It is a transport identity, not a Human, Agent or Participant
  identity, and it never enters a Projection.
- The site build reads only the public URI and database name from repository
  variables (`OI_SPACETIMEDB_URI`, `OI_SPACETIMEDB_DATABASE`).

## Runbook: publish a real world to the hosted field

```bash
# 0. once per machine: pinned CLI and owner login (owner performs the login)
spacetime version install 2.8.1 && spacetime version use 2.8.1
spacetime login                      # opens the browser; owner's account

# 1. publish the module (build → publish → regenerate bindings)
npm --prefix shared-field/spacetimedb run deploy:hosted

# 2. local publication step from the owner's real Central (no network)
node shared-field/scripts/publish-world.mjs \
  --selection ~/Central/Work/O-I/ProjectCentral/user/publication/o-i.selection.json \
  --from-ctrl --central ~/Central \
  --sentinel identity.md --sentinel 'wiki:node:identity' \
  --explore-base https://epilogos.github.io/O-I/explore.html \
  --out /tmp/oi-world

# 3. hosted push (owner token created on first run and reused afterwards)
SPACETIMEDB_URI=wss://maincloud.spacetimedb.com SPACETIMEDB_DATABASE=epilogos-oi-shared-field \
  npm --prefix shared-field/spacetimedb run publish:world -- --bundle /tmp/oi-world/bundle.json --receipt /tmp/oi-world/hosted-receipt.json

# 4. point the public site's Explore at the hosted field (Pages redeploys on the next main push)
gh variable set OI_SPACETIMEDB_URI --body wss://maincloud.spacetimedb.com
gh variable set OI_SPACETIMEDB_DATABASE --body epilogos-oi-shared-field

# 5. prove the two-world circuit on the hosted *acceptance* database (never the production field:
#    each run leaves its withdrawn run-scoped worlds behind), World A from the real readings
npm --prefix shared-field/spacetimedb run deploy:hosted-acceptance
mkdir -p /tmp/oi-readings && cd ~/Central \
  && ctrl --json action run central.wiki.read '{}' | jq .data > /tmp/oi-readings/root.json \
  && ctrl --json action run projectcentral.wiki.read '{"project":"O-I"}' | jq .data > /tmp/oi-readings/project.json
OI_WORLD_A_READINGS=/tmp/oi-readings SPACETIMEDB_URI=wss://maincloud.spacetimedb.com SPACETIMEDB_DATABASE=epilogos-oi-shared-field-acceptance \
  npm --prefix shared-field/spacetimedb run acceptance:two-world
```

Step 5 run from a second machine with its own Central is the two-machine
topology; the contracts do not encode which machine is which.

## Hosted editions

`publish-world.mjs` writes `edition/index.html`, `projection.json` and
`manifest.json`. They are static bytes any host can serve while the source
workstation is offline. The Explore page resolves a semantic ref through
`/explore.html?ref=<ref>`; the edition links there. Committing an edition under
`site/public/projections/<slug>/` publishes it through GitHub Pages; that is a
publication decision of the owner, taken per world.

## Re-projection

Run step 2 with `--previous /tmp/oi-world/bundle.json` after the source moved;
the new bundle is revision n+1 with `supersedes` and the new source revision.
Push it with step 3. A withdrawn revision is pushed the same way with state
`withdrawn`; the world stays addressable, its representation does not.

## Self-hosted field on the second machine (target `frank`)

The tranche's target is the self-hosted field over the tailnet (wayfinder §5);
maincloud stays an interim public-reachable host. Target `frank` in
`hosting.json` points at the standalone server on the Workcell host; nothing
about it is public, and publish/management stays on the tailnet.

```text
host            frank (Linux/Omarchy), tailnet 100.92.62.101 — the server listens ONLY on that address
server          spacetimedb-standalone 2.8.1 (pinned; the release tarball, not `spacetime version upgrade`)
                ~/.local/share/spacetime/bin/2.8.1/
unit            ~/.config/systemd/user/oi-shared-field.service   (target-owned, Restart=on-failure,
                ExecStartPost readiness probe: GET /v1/ping on the tailnet address; no BindsTo — the
                O-I #154 finding: the service must outlive a control-service restart)
data            ~/.local/state/workcell/shared-field/spacetimedb/data      (Workcell-owned state)
keys            ~/.local/state/workcell/shared-field/keys/id_ecdsa{,.pub} (ES256, PKCS#8, 0600 — host material,
                never in a repository; the CLI's server fingerprint is the public half)
snapshots       ~/.local/state/workcell/shared-field/snapshots/spacetimedb-data-<ts>-{pre-live,post-live}.tar.gz
                (taken with the unit stopped; restore = stop, move `data` aside, untar, start)
site            oi-shared-field-site.service — python http.server on 100.92.62.101:4180 serving the built
                Explore page and the hosted editions under /projections/<slug>/
declaration     both units are declared target-owned in ~/.local/state/workcell/smoke/services.json with a
                `systemctl --user is-active --quiet <unit>` status probe
databases       oi-shared-field (retained), oi-shared-field-acceptance (acceptance runs only)
```

Runbook from the primary machine (the owner's CLI login is not needed for a
standalone server; the server's fingerprint is recorded by `spacetime server add`):

```bash
spacetime server add --url http://100.92.62.101:3000 frank         # once per machine
npm --prefix shared-field/spacetimedb run deploy:frank              # module → oi-shared-field
npm --prefix shared-field/spacetimedb run deploy:frank-acceptance   # module → oi-shared-field-acceptance

# world publication (local step as above, explore base on frank) then the hosted push
node shared-field/scripts/publish-world.mjs --selection <sel> --from-ctrl --central ~/Central \
  --sentinel identity.md --sentinel 'wiki:node:identity' --explore-base http://100.92.62.101:4180/explore.html --out /tmp/oi-world
SPACETIMEDB_URI=ws://100.92.62.101:3000 SPACETIMEDB_DATABASE=oi-shared-field \
  npm --prefix shared-field/spacetimedb run publish:world -- --bundle /tmp/oi-world/bundle.json

# a curated HTML artifact (Lane C step 4): local step, then the push through the field client
node shared-field/scripts/publish-artifact.mjs --selection <sel> --flow Control/user/flows/<instance>.html \
  --central ~/Central --wiki-reading <project reading> --sentinel PRIVATE_SENTINEL --sentinel 'id="ql-doc"' \
  --explore-base http://100.92.62.101:4180/explore.html --edition-base http://100.92.62.101:4180/projections/<slug> --out /tmp/oi-artifact
jq '{kind:"publish", args:.}' /tmp/oi-artifact/hosted-args.json | OI_SHARED_FIELD_TARGET=frank shared-field/spacetimedb/field.sh

# serve the edition beside Explore on the host
rsync -a /tmp/oi-artifact/edition/ frank:~/.local/state/workcell/shared-field/site/projections/<slug>/

# the Explore page reads the field it is told to (query parameters override the built-in variables)
open 'http://100.92.62.101:4180/explore.html?ref=<ref>&spacetimedb_uri=ws://100.92.62.101:3000&spacetimedb_database=oi-shared-field'
```

`shared-field/spacetimedb/field.sh` is the O:I-owned client the desktop kernel
calls (`OI_SHARED_FIELD_TARGET=<target name>`; one JSON request on stdin, one
envelope on stdout; the transport token stays under `OI_STATE_HOME`). A second
world on the host runs `lived-circuit.ts` against the same server under its own
token label.

Host-layer facts exercised on 2026-09-15 (`INHABITED-SHARED-FIELD-LIVE-ACCEPTANCE.md` §8):
unit restart (new PID, field unchanged), restore from the post-live snapshot
(field unchanged, the second world's identity, watch and contact intact), the
primary machine off the tailnet (its calls refused as unavailable; the second
world on the host kept reading). Not exercised: relocation to another host, and
the server's own linger across a host reboot (user lingering is enabled).
