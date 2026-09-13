# Human and Agent stories — campaign entry

This is the source-led expansion of the existing **[O:I #65 alpha campaign](https://github.com/EpiLogos/O-I/issues/65)**. It includes CAW, rather than making the Factory/desktop path the whole product. People can keep using existing tools and deliberately summon deeper knowledge, agency, machine and development faculties.

Read in this order:

1. [Wayfinder and prior-test map](EXISTING-WORK-CAMPAIGN.md) — purpose, complete activity field, installation/composition axes, CP0–CP5 and where existing tickets/tests remain authoritative.
2. [85 child stories](EXISTING-WORK-STORIES.md) — plain-language human acts beside the Agent's context/practice/work, actual outcomes, preserved invariants and meaningful failure/recovery branches.
3. [Participation profile](STORY-PARTICIPATION-PROFILE.md) — the existing UX `extensions` carries Agent-facing conditions and practices; native capability matrices retain their identities and schema.
4. [Local orchestrator protocol](LOCAL-CAMPAIGN-PROTOCOL.md) — one orchestrator prepares, delegates, observes, diagnoses, repairs and independently retests real activities. The human is not its cross-chat message bus.

[participation-bindings.json](participation-bindings.json) links every child to a family and each family to current native capability/practice sources and earlier acceptance. These are **candidate dependencies**, not a claim that all listed capabilities apply to every child or that any story has run. Exact step/context/operation bindings are resolved before execution. Unresolved IDs/recipes remain named, never invented.

## Source reading and capability-matrix view

The small reader extends the existing CAW tooling. It has no network, runtime,
Agent launcher or authority interpretation. It emits the existing UX fields and
an optional `ql-capability-matrix/1` named-axis view of **candidate** dependencies.
Source hashes, unknown installed bindings and empty evidence remain explicit.
Native capability meanings remain in their owner records.

From a clean source checkout:

```sh
python3 -m unittest discover -s tests/continuous-work -p 'test_story_participation.py' -v

# Use a new destination; the reader never overwrites existing output.
OUT="$(mktemp -d "${TMPDIR:-/tmp}/oi-stories.XXXXXXXX")"
python3 scripts/caw_story_map.py \
  --output "$OUT/stories.json" \
  --matrix-output "$OUT/candidate-matrix"
```

Without native matrices, all external capability identity checks remain
unresolved. Where the actual owner sources are available, supply their CSVs:

```sh
python3 scripts/caw_story_map.py \
  --matrix central=../Central/ProjectCentral/user/capability-matrix.csv \
  --matrix actuation=../Actuation/ProjectCentral/user/capability-matrix.csv \
  --matrix aikit=../ai-kit/ProjectCentral/user/capability-matrix.csv \
  --matrix factory=../Factory/ProjectCentral/user/capability-matrix.csv \
  --matrix workcell=../Workcell/ProjectCentral/user/capability-matrix.csv \
  --matrix ql=../QL-MEF/ProjectCentral/user/capability-matrix.csv \
  --output "$OUT/stories-identity-checked.json"
```

Use actual checkout paths; no tool moves or mutates them. A successful identity
check means the referenced capability records exist in those exact supplied
sources. It does not verify their intended meaning, current runtime support,
actual context/Skill loading or the experience. A derived candidate matrix is
not copied capability canon or proof of all relationships. Resolve selected
step edges and original full inventories through the current native contracts.

The source tests detect malformed/duplicate stories, missing family links,
missing context/practice/acceptance, unknown owner or practice, injected success
claims, nonexistent native capability identities and invalid JSON examples.
They prove this published map's structural integrity, not the user's stories.
Ordinary CAW runner tests discover them with the existing test pattern.

## Operative practice

AIKit's source `skill/aikit/experience-campaign` is a thin METHOD-classified
procedure over existing runtime-operation, verification and native practices.
It is included in the existing `aikit-operator` set through its normal gates.
Discover the actually installed source and current description; source
publication/selection is not proof of a harness link, loaded text or use.

When it is not installed, a local operator may explicitly read this source
protocol as a bounded bootstrap. Do not install or overwrite private practice
merely to prepare a test. Central#164's existing repertoire and the owner's
approved #299 first-time-link procedure remain intact.

## What the local Agent does next

Select an actual useful batch, starting with an ordinary task in an existing
tool, an instruction/context task and a knowledge task. Prepare only the
necessary source/context/permission and exact native bindings. Run it through
real Agents or rendered controls as the story requires. Record failures before
assistance, fix the correct owner and independently repeat. Continue across
all relevant story families and original proving obligations as readiness
permits. No total inventory or full-suite install blocks safe initial work.

The campaign and its compiled map have no `passed` receipt import and no
whole-feature verdict. Keep human EX separate. Only complete independent and
required actual machine/provider/human proof supports **usable end-to-end feature.**
