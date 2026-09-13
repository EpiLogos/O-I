# Source projection and native capability binding

This tooling supports the existing story/capability conventions. It is **not** an execution engine, a substitute for normal AIKit discovery, or a verifier of the user's experience.

## Source checks

From the O:I checkout containing this publication:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/experience -p 'test_*.py' -v
python3 scripts/experience_map.py
```

A successful command means the declared local story rows and their practice/source relationships parse and agree. It returns `feature_verdict: null` and `runtime_readiness: not-assessed`. Without a QL checkout it explicitly reports `source-root-required`; it does not silently claim the delegated field was imported.

## Read the complete selected QL source and actual native matrices

After the operator has established the real checkout paths, use a **new** output directory:

```sh
python3 scripts/experience_map.py \
  --ql-root "$QL_ROOT" \
  --matrix "EpiLogos/Central=$CENTRAL_ROOT/ProjectCentral/user/capability-matrix.csv" \
  --matrix "EpiLogos/ai-kit=$AIKIT_ROOT/ProjectCentral/user/capability-matrix.csv" \
  --matrix "EpiLogos/Factory=$FACTORY_ROOT/ProjectCentral/user/capability-matrix.csv" \
  --matrix "EpiLogos/Workcell=$WORKCELL_ROOT/ProjectCentral/user/capability-matrix.csv" \
  --output-dir "$EVIDENCE_ROOT/experience-source-reading"
```

The variables must name the inspected actual paths; they are not commands for discovering or creating a private World. Check each owner's current inventory location. Add further real CSV inventories with repeated `--matrix OWNER=PATH`. An owner with a different registry/Markdown source needs its actual source-specific reading, not an invented CSV. In particular, enumerate QL's registered deeper matrices rather than assume its product summary exhausts them. O:I's host capabilities and Actuation's current inventory also remain required coverage inputs at C0; the example command is not the whole seven-owner inventory.

Outputs:

- `ux-reading.json` — lossless structured reading of existing UX fields, `extensions.agent_ux`, source hashes, declared proof references, actual supplied native capability records and the full QL trace/standing when supplied;
- `matrix.csv` and `matrix.json` — relation-only `ql-capability-matrix/1` reading of story/practice requirements, retaining the explicit conditions and qualified external capability links when bound.

The output directory is newly created with private access; no native source or matrix is edited. Treat output as private until reviewed because supplied native records can refer to local paths. A source digest identifies actual bytes, not runtime acceptance or cryptographic attestation of the operator.

## Bind capabilities without inventing IDs

The first inventory gives every actual capability an explicit `uncovered` disposition. Read its meaning and the story, then supply a reviewed JSON **list** of qualified bindings. Example shape, not a ready-to-run value:

```json
[
  {
    "repository": "EpiLogos/Central",
    "capability_id": "cap.central.action-discovery",
    "source_digest": "COPY_THE_EXACT_DIGEST_FROM_THE_CURRENT_INVENTORY",
    "disposition": "direct",
    "story_ids": ["WK01", "GV03", "PX01"],
    "reason": "These acts must discover the installed native operation and understand its input/result before invoking it.",
    "operation_binding": "Record the actual Action IDs and contract revisions at episode preparation, not a guessed command."
  }
]
```

Run the same reading with `--bindings "$BINDINGS_FILE"` and another new output directory. Stale digest, fabricated capability, unknown story and unsupported coverage disposition are rejected. `transitive` additionally requires the support path; `deferred` requires reason, owner and re-entry. Extra native columns/metadata and binding extensions are preserved. A QL story is qualified as `QL-MEF:UX01` and is only accepted when the actual QL source was supplied.

One valid relation does **not** mark the story fully bound or executed. The complete selected episode still needs every required operation, practice, context, permission, actual surface and machine. Exact Action invocation/loading evidence remains in the current native campaign, not this source tool. The compiler deliberately does not accept a self-authored `passed` flag as proof.

## Integrate the typed reading through existing owners

The publication supplies a concrete source profile and planning projection now. Ordinary agents can read its Markdown/JSON and follow source references. The matrix extension is preserved by the generic matrix convention, but existing AIKit/native readers must not be assumed to traverse every new `extensions.ux` edge automatically.

At C0/C2, inspect the current existing Knowledge/SourcePool/ProjectMap and UX-field reader. Use it if it supports these source/ref relations. If it does not, record the precise source-adapter/typed-relation delta at the existing native owner and implement it there within the ongoing programme; no new Wiki, renderer, scheduler or capability registry is required. Until then the exact source reading is an explicit usable bootstrap, not evidence of automatic graph/discovery support.

The full forward/reverse inventory is deliberately performed against the selected current cut. No static hand-authored list can guarantee that later native capabilities were not added. Uncovered rows require a story or explicit supporting/deferred/inapplicable disposition before full campaign coverage is claimed. Refer to `STORY-PROFILE.md` for the retained source and standing rules.

## Continue with real execution

After source binding, the operator follows `LOCAL-CAMPAIGN.md` and the existing `CONTINUOUS-WORK-PROVING.md`/native campaign commands. Source compilation is not a substitute for those tests. Do not stop after generating a large map: select the first ready ordinary-use story, perform it through an actual agent/human entry, observe the handoffs, repair within scope and repeat.
