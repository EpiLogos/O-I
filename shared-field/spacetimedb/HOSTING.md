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
