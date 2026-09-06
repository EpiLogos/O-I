#!/usr/bin/env python3
"""Render the derived harness context files at the Central root.

Compiles the field-and-now and authorship governance statements into
`AGENTS.md` and `CLAUDE.md` (byte-identical twins) at the Central root, with a
derived-source provenance header carrying exact content revisions.

Projection law (Control/agents/governance/repos/repo-content-and-structure.md):
native instruction files may carry governance, and a generated suggestion stays
generated until adopted — so these files state their derived standing in the
header and never become the source. Edit the statements under
Control/agents/governance/ and re-run this script; never edit the outputs.

Byte-idempotent: same sources in, same bytes out (no timestamps).
"""

import json
import sys
from pathlib import Path

RENDERER = "central-session-strap/render-context.py@1"

SOURCES = [
    ("Where session work lives", "Control/agents/governance/field-and-now/session-work-placement.md"),
    ("The day closes", "Control/agents/governance/field-and-now/day-close.md"),
    ("One wiki per register", "Control/agents/governance/field-and-now/wiki-field-law.md"),
    ("You may propose", "Control/agents/governance/authorship-and-return/propose-not-write.md"),
]

INTRO = """This is the derived session ground of the Central personal world. Every harness
session that starts here — any harness — stands on this file. It is a
projection of authored governance, not the source: standing is
generated-derived until the owner adopts it in place.
"""

FIELD = """## The field you stand in

```text
~/Central                         the personal ground (no repo at the root)
├── Control/                      human source, agent material, root register
│   ├── user/                     authored human ground (propose, never write)
│   ├── agents/governance/        the governance you are reading the shadow of
│   ├── agents/wiki/wiki.json     root wiki (agent-maintained; never edit directly)
│   ├── agents/now/               root NOW/DAY field — cross-project session work
│   └── machines/                 machine roles
└── Work/<Name>/                  projects
    └── ProjectCentral/           the same shape per project
        ├── user/  agents/  now/  project registers of the same law
```

Two registers, one law. Decide which register your work belongs to: inside one
project's concern → that project; cross-project, suite-level, world-keeping →
the root. Work one register at a time.
"""

COMMANDS = """## The command surface

Project register (canonical Actions):

```text
ctrl --json action run projectcentral.now.inspect   '{"project":"<Name>"}'
ctrl --json action run projectcentral.now.init      '{"project":"<Name>"}'
ctrl --json action run projectcentral.now.return    '{"project":"<Name>","actor":"<you>","kind":"handoff|question|note|learning","subject":"...","result":"...","status":"active"}'
ctrl --json action run projectcentral.now.rollover  '{"project":"<Name>","day":"YYYY-MM-DD","next_day":"YYYY-MM-DD"}'
ctrl --json action run projectcentral.now.promote   '{"project":"<Name>","source":"...","target":"human-ground|agent-wiki","destination":"...","acceptance":"human-accepted|agent-return"}'
```

Root register (same semantics; `now.py` mirrors the Actions until Central
ships native root Actions):

```text
python3 Control/user/skills/central-session-strap/now.py inspect
python3 Control/user/skills/central-session-strap/now.py return --actor <you> --kind note --subject "..." --result "..." --status active
python3 Control/user/skills/central-session-strap/now.py rollover --day YYYY-MM-DD --next-day YYYY-MM-DD
```

Orientation: `ctrl central.world`, `ctrl control.search <term>`, `aikit status`.
Durable Control change: propose (target, reason, context, diff) — never write.
"""

STRAP = """## Strapping fully

This file is the floor, not the ceiling. The `central-session-strap` skill
(projected into your harness tree through AIKit) carries the full procedure:
session orientation, NOW/DAY lifecycle at both registers, wiki return routing,
and re-rendering these derived files when governance moves. If your harness
did not load it as a skill, read
`Control/user/skills/central-session-strap/SKILL.md`.

Engineering ground (how code work is done here): the statements under
`Control/agents/governance/engineering/`, compiled to
`Control/agents/governance/engineering/foundational-prompt.md`.

Session end, every session: return what remains to the register's NOW field,
close the day you were standing in, leave no loose folders at the Work root.
"""


FNV_OFFSET_BASIS = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3


def revision(path: Path) -> str:
    content = path.read_bytes()
    return f"central.content-fnv1a64/v1:{len(content)}:{fnv1a64(content):016x}"


def fnv1a64(data: bytes) -> int:
    value = FNV_OFFSET_BASIS
    for byte in data:
        value ^= byte
        value = (value * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
    return value


def source_ref(path_str: str) -> str:
    escaped = path_str.replace("%", "%25").replace(":", "%3A").replace(" ", "%20")
    return f"central:source:control:root:{escaped}"


def body_without_h1(text: str) -> str:
    lines = text.splitlines()
    if lines and lines[0].strip() == "---":
        try:
            end = lines.index("---", 1)
            lines = lines[end + 1:]
        except ValueError:
            pass
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
    return "\n".join(lines).rstrip()


def main():
    root = Path(__file__).resolve().parents[4]
    derived = []
    sections = [INTRO.strip(), FIELD.strip()]
    for title, rel in SOURCES:
        path = root / rel
        if not path.is_file():
            print(f"missing statement source: {rel}", file=sys.stderr)
            sys.exit(1)
        derived.append(f"- {source_ref(rel)} @ {revision(path)}")
        sections.append(f"## {title}\n\n{body_without_h1(path.read_text(encoding='utf-8'))}")
    sections.append(COMMANDS.strip())
    sections.append(STRAP.strip())

    header = "\n".join(
        [
            f"# Central — session ground (derived; do not edit)",
            "",
            f"<!-- derived source — provenance: generated-derived.",
            f"Do not edit this file; edit the governance statements under Control/agents/governance/",
            f"and re-run Control/user/skills/central-session-strap/render-context.py.",
            f"renderer: {RENDERER}",
            "derived-from:",
            *derived,
            "twin: AGENTS.md and CLAUDE.md are byte-identical projections of the same sources.",
            "-->",
            "",
        ]
    )
    document = header + "\n\n" + "\n\n".join(sections) + "\n"

    for name in ("AGENTS.md", "CLAUDE.md"):
        target = root / name
        previous = target.read_text(encoding="utf-8") if target.exists() else None
        if previous != document:
            target.write_text(document, encoding="utf-8")
            print(json.dumps({"ok": True, "file": name, "changed": True}))
        else:
            print(json.dumps({"ok": True, "file": name, "changed": False}))


if __name__ == "__main__":
    main()
