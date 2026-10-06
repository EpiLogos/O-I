# Desktop profiles

`central-field.oi-profile.json` — the `oi.profile/v1` for the minimal Central installation (Central, Actuation, AIKit,
QL-MEF; the Epi-Logos world and its reader praxis). Sparse desired state only: the `epi-logos-reader` SkillSet is
enabled by default. It installs no product and applies nothing on import (`oi profile import <path>` stores it as
inspectable desired state; `oi profile diff|use` compose with it).

Machine-local things are deliberately not in it: the Kev and Redis services are provisioned and elected on first run
(`aikit decide service …`, `aikit now-context service …`, then the `ai-kit:local-services:*` elections), and model
login / API keys stay inside Pi or Prime setup.

Tested: exported from `oi profile` in an isolated `OI_HOME`; imported into a second fresh `OI_HOME` and listed.
