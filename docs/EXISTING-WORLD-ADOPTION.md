# Existing-world adoption

Status: O:I whole-level integration for #93.

O:I starts from the technological world that already exists. Adoption therefore means **making an existing world mutually legible without silently relocating its source, identity or authority into O:I**.

The minimal whole-level operation is:

```text
oi adopt PATH
```

or the machine-readable form:

```text
oi adopt PATH --json
```

It is intentionally read-only. The command discovers a small set of recognisable source/configuration apertures, records their present location and owner standing, and returns the native owner contracts required for any deeper adoption work. `changes` is empty by construction in this tranche.

## Why read-only first

A directory can prove that a file or source aperture exists. It cannot by itself prove:

- that a model is currently acting through an Actuation;
- that a Skill-like directory is human-authored source rather than generated projection;
- that a target harness loaded a generated file;
- that a Workcell service is reachable from the actor that needs it;
- that a named QL Context Frame is the right reading of the composition.

Those are owner observations. O:I therefore preserves the world and hands the next determination to the product that owns it.

## Owner handoff

The returned account keeps these relations separate:

```text
Actuation
  WHAT realised Agency / acting loop exists?
  contract: actuation.realised/v1

AIKit
  HOW is that Actuation provisioned here?
  Context · Skill/Method refs · target-native projection · activation truth
  contract: aikit.harness-adapter/v1

Central
  Where is human-authored Project Ground, governance and visible praxis source?

Software Factory
  What developmental Run/evidence should retain the operative praxis condition?

Workcell
  What material hosting/provider bindings are actually required?

QL-MEF
  Optional named/formal reading over an explicit sixfold mapping
  contract: ql.mef.context-frame-reading/1.0.0
```

None is required merely for a directory to remain a valid existing world. In particular, `ql_required` is always false for ordinary adoption.

## Native praxis/source discovery

The command can notice locations such as:

```text
ProjectCentral/user
ProjectCentral/agents/governance
ProjectCentral/skills
ProjectCentral/methods
skills
.claude/skills
.agents/skills
.hermes/skills
AGENTS.md
CLAUDE.md
.aikit
```

A location is evidence of presence, not automatic source authority. ProjectCentral apertures retain Central ownership where the ProjectCentral contract is conformant. Other Skill/instruction locations are returned as candidates to retain in place and expose to AIKit/native-source inspection. `.aikit` is never reclassified as canonical Skill/Method source merely because it contains projected or indexed material.

## Native activation law

Generated projection material is not target uptake evidence.

When an admitted harness is available, AIKit #114 must obtain the target-native activation/reload observation for the exact projected generation. Unsupported targets route through AIKit's public adapter SDK + `skill/aikit/harness-adapter-authoring` rather than O:I manufacturing a compatibility implementation.

## QL relation

The technological composition can have latent sixfold contextual structure simply by being a sixfold whole. That does not make CF1–CF7 ordinary O:I configuration.

When an explicit mapping and a formal reading are useful, QL-MEF #66 can derive/propose/recognise a named Context Frame reading with provenance. The reading remains optional and carries no runtime authority.

## Developmental/physical evidence

Cloud CI can prove the read-only adoption account, owner-contract shape and non-mutation laws. It cannot prove the user's actual harness reload state, private Central world, provider reachability or workstation material topology.

Route those observations to O:I #65 and the native evidence owners. Do not add O:I-local shortcuts to make a cloud fixture look like physical acceptance.
