# W11 application return — live acceptance

This acceptance belongs to O:I #155 W11. It is an executable proof over the existing SharedField / SpaceTimeDB / Explore application path, not a new execution or frontend architecture.

The live fixture proves one shared semantic relation across several embodied contexts:

```text
local Project World
  -> explicit WorldPresentation Projection
  -> contributor-authorised SpaceTimeDB reducer
  -> subscribed renderer-neutral Explore application
  -> browser Explore reading
  -> same semantic World / Projection reading returned to desktop-shared and structured-Agent application models
```

`shared-field/spacetimedb/application-return-live-acceptance.ts` establishes that:

- desktop-shared, browser Explore and structured-Agent paths resolve the same `world_ref` and `projection_ref`;
- the authorised hosted refinement advances Projection revision `1 -> 2` while preserving the native Central source revision;
- a public reader without contributor authority cannot perform that Projection mutation;
- the returned hosted event is represented as Activity without fabricating a canonical Action identity;
- browser, desktop and structured-Agent readings consume the same renderer-neutral Explore / WorldPresentation contracts rather than rival semantic stores.

The existing `shared-field/spacetimedb.test.mjs` last-good-index acceptance is the failure-side complement: a malformed subscribed provider update does not destroy the last valid local Explore application reading.

This proof does not claim that every local desktop operation is hosted, that hosted rendering owns the source object, or that Projection authority is general execution authority. It proves the bounded local↔hosted return relation required by W11 using the already accepted authority and application seams.

## Transport and retained material

`createExploreTransportLifecycle()` is O:I's callback adapter for one connection
and its required aggregate Explore subscription. Construct it before connecting;
wire `connected(identity.toHexString())`, `connectError(error)` and
`disconnected(error)` to the actual generated connection callbacks. Wire
`subscribing()`, `applied()` and `subscriptionError(error)` to the corresponding
subscription lifecycle. Supply it as the second argument to
`createSpacetimeExploreSource(db, lifecycle)`. Transport identity is provenance,
not a Participant identity or human authentication.

The facade reports transport state separately from validated material, its last
successful observation time and current age. `healthy` requires an available
subscription and valid material. Without lifecycle input the transport is
`unknown` and cannot report health. `material_valid` describes only contract
validation. Error/offline/disposed states retain the last good semantic refs and
revisions for an explicitly stale reading. Browser provider `live` requires the
available transport state; availability and rebuild-error events are delivered
to subscribers as well as successful rebuilds. Disposing the facade removes its
listeners without cancelling a provider shared by other consumers.

The live W11 test additionally proves actual invalid-subscription refusal,
connection disconnect, cached identity/revision/observation-time retention and
consumer availability notifications. It runs exclusively against a temporary
local database and does not publish local user ground.
