from pathlib import Path
import json

ux = Path('docs/experience/WIKI-CONSTELLATION-UX.md')
assert '## 6. Adaptive Wiki' not in ux.read_text()
ux.write_text(ux.read_text() + r'''

## 6. Adaptive Wiki–user–agent interaction

**Owner-directed extension, 20 September 2026.** The person's correction must change what the next act receives, not merely become another note that future agents may or may not find. This is the operational continuation of activities D, F and G, not a new Wiki, memory service or story family. The native bounded delivery is [AIKit #366](https://github.com/EpiLogos/ai-kit/pull/366); the Wiki and constructive consumers remain #418 and #420. Code, source proof, actual harness use and human experience retain different standing.

### I. Correct the collaboration and see the next turn change

**Existing stories:** GV01, GV03, GV04, AG01, AG03, AG06, AG09, KN04, KN05, KN08, WR03, WR04, PX05, UI06. The relevant existing practice is selected through the story spine, not replaced by this activity.

I tell the agent that it is applying an old instruction too literally, or I select an unhelpful response and choose **Use this correction**. The agent explains the behavioural change in ordinary language and makes the smallest useful update to its operational reading. A compact inline item says what changed, where it applies, and whether it has reached the next act. An explicit instruction from me is already an instruction: the system does not make me approve a second modal merely to repeat it. An inferred preference is presented as an inference, not silently converted into my instruction.

I can open the underlying Markdown in the same Wiki editor, revise it myself, inspect its evidence, limit it to this project or session, suspend it, or undo the update. The next answer is based on the new reading. If it is not, Context shows the real failed handoff: saved but not selected, not delivered, unsupported live refresh, or awaiting the next supported act. It does not say “learned” because a file was written.

Later, I can review recurring corrections beside the governance passages they reinterpret. This review can simplify or amend the durable source, retain an intentional local exception, or retire a correction. It is not necessary before the immediately authorised operational change is useful. Repetition is evidence for review, not a vote that automatically creates a universal law.

### AP01 — Keep authority and knowledge organisation orthogonal

There are two knowledge layers: ordinary source relations, and deliberately authored QL constellations over them. Separately, there are human governance, agent-maintained operational interpretation, and session evidence. These are roles and provenance within one connected corpus, not three stores or three Wikis.

Ordinary Markdown links, exact passage selectors, backlinks and tags are the usable basis. AIKit's bkmr source pool and ripgrep search are native source/retrieval providers, not rival semantic universes. Preserve provider identity, query/selector, source revision, access and provenance. A search hit is not a permanent relation; reading a bookmark does not promote its instructions into governance. Constellation membership may organise governance, corrections, examples and interpretations creatively without changing their authority. Saving an attributed QL relation is different from drawing a nearby glyph.

### AP02 — Governance, interpretation and feedback have different effects

Human-authored governance retains its existing Central authority and reviewed mutation path. The agent's operational projection lives as ordinary agent-maintained Wiki source and can change through a tool inside its granted scope. Generated harness files remain rebuildable products of composition, never the editable master.

A correction retains its exact evidence reference, attributed actor, source/basis revision, intended scope, reason and replacement interpretation. Agent inference remains distinguishable from an explicit human correction. A string naming a user or an evidence URI is attribution, not authenticated authority. Publication, credentials, permission changes and source recognition are never inferred from that string.

The effective reading combines eligible governance, selected operational interpretation, relevant project/skill knowledge and the current task. It does not indiscriminately concatenate all of them. It exposes conflicts and omitted material rather than silently choosing whichever paragraph happens to appear last. An immediate correction can change the intended application of a rule without rewriting the rule's durable source.

### AP03 — Express purpose, scope and useful exceptions

A behavioural rule should explain the value it protects, when it applies, useful counterexamples and the expected alternative. This need not become a compulsory data-entry schema: clear Markdown is sufficient; typed links can enrich it.

For example, “verify before claiming completion” means preserve the distinction between implementation, executed evidence and acceptance. It does not mean stop useful implementation because installed hardware is unavailable. A useful correction is: “Complete and test the remote work that is possible; report the remaining hardware boundary separately.” Another example is “be concise”: give the direct answer first, but do not omit the derivation when the task explicitly requires it.

This is contextual interpretation, not an automatic negation of every constraint. Privacy boundaries, denied source access, actual authority and security checks do not acquire a counter-law merely because an agent finds them inconvenient. A changed human preference is not permission to bypass an unrelated native gate.

### AP04 — Preserve the user and the actual Central/workcell relation

The user is a durable subject linked to the containing Central root; the guardian field is a maintained collaboration around that subject, not a freshly minted identity on every prompt. Product guardian Agencies remain their actual Actuation-owned collaborators. A guardian's interpretation is not the user and cannot confer recognition on itself.

Distinguish the person's default/main Central world, the current workcell's Central materialisation, a child ProjectCentral, and the Central product's source repository. Central remains the root meta-project even when no child project is active. Workcell placement does not redefine user identity; ProjectCentral repeats the source/Wiki relation at narrower scope. “Current Central” must resolve from the actual bound workcell/root, never from a guessed home path or silent fallback to the primary machine.

Portable preferences may be explicitly inherited from the primary world. Local observations, host paths, credentials and machine-specific corrections stay with the actual materialisation unless deliberately transferred. Two sibling projects or two workcells with similar directory names must not share a correction accidentally. The UI should show a human-readable scope label with exact identity available on inspection, not demand that the person enter raw world IDs.

### AP05 — Close both the write path and the delivery path

The supported product–harness composition supplies a small bootstrap map: current user/guardian/root/project context, Wiki route, relevant skill/document procedure, selected projection sources and the native correction tool. Do not dump the full Wiki into AGENTS.md. Do not make the agent rediscover an undisclosed tool or repair its own strap every session.

A real correction performs: resolve exact source → read current basis → apply scoped revision-checked change → retain evidence → invalidate the affected current reading → compose the next act → deliver through a supported harness event → record actual acknowledgement/use where available. Compaction, restart, resume and context switching must return to this same relation. A generation existing on disk is not a running agent's loaded context.

AIKit #366 supplies an initial native slice: `aikit wiki projection read/update`, selected `hook/continuity/wiki-projection` reread at SessionStart/UserPromptSubmit, and actual Claude-compatible hook context output. It does not silently enable the capability, authenticate a submitted actor, create a full expiry policy, or pretend every harness accepts Claude's protocol. Unsupported live delivery remains explicit; a fresh supported session or the correct native adapter is the route, not an invented acknowledgement.

Document skills must use this same context route before writing: recover the relevant project vision, exact source and current correction, then author the requested document. A correction to one report should not automatically rewrite every writing skill. Per-skill overlays and the project/user interpretation cooperate through existing composition, with ownership and precedence inspectable.

### AP06 — Make the feedback loop visible without turning it into administration

Use the existing chat/selection and Run / Agents / Context surfaces. An inline correction control offers the inferred narrow scope and editable text, with a deliberate broader-scope choice. No participant modal, compulsory QL form or separate memory dashboard is required. User-initiated source editing remains ordinary Wiki editing.

Context presents **effective guidance** as source-bound items: scope, current revision, reason for inclusion and delivery state. Inspect reveals governance basis, correction evidence, omitted/conflicting sources and the exact act receipt. Run records the delivery/act boundary; Agents exposes the actual guardian and selected capabilities. “Saved”, “Selected”, “Emitted”, “Acknowledged” and “Observed in use” are different claims. Do not label a model self-report alone as reliable proof of behavioural change.

The Wiki offers a linked view of governance, current interpretations and feedback. QL constellation work can compare purposes, exceptions, recurring failures and alternatives over those same subjects. It is an optional richer working medium, not a required taxonomy before a plain-language correction takes effect. The next human or agent edit advances the actual shared revision; a stale proposal cannot overwrite it.

### AP07 — Review governance from evidence, not self-reinforcing summaries

The review view groups relevant corrections with the exact governance clauses and scoped outcomes. Retain contradictory examples, superseded interpretations and their dates. Multiple generated summaries of one event are one source lineage, not independent corroboration. A narrowly successful exception need not become a global preference.

The human can accept a proposed governance diff through the existing source-return mechanism. Until then, it remains a proposal; authorised operational guidance can still function. When governance changes, mark dependent interpretations for re-evaluation and show what would change, rather than stacking contradictory old and new laws indefinitely. Undo, suspension, expiry and deletion invalidate future delivery without rewriting historical act receipts. Session-only material expires with its actual scope and must not leak into global projection.

### AP08 — Prove changed use, privacy and recovery

The minimum joined walk starts with a real strapped agent applying an overly literal project instruction. The person corrects it once; the tool changes the exact selected Wiki source; the next prompt receives its new revision; an independent reviewer observes the requested behavioural difference. Restart and compaction preserve the durable correction. A different project and workcell do not inherit it accidentally. An explicit session exception does not survive its scope.

Repeat with a deliberately disconnected context consumer: source save may pass, but the joined case must fail. Include simultaneous edits, stale basis, denied or removed source, whole-fragment budget exclusion, unsupported harness event, clear/suspend, conflicting guidance and QL absent. Removing or denying a source must not resurrect its cached interpretation. Byte/readback, emitted protocol, actual harness receipt and human experience each retain their evidence grade.

**Delivery boundary:** this source extension defines the complete interaction. AIKit #366 is a bounded native implementation, not a claim that the existing desktop has all controls, that every document skill is strapped, or that installed/live-model acceptance is complete. The receiving Wiki/agent-shell owners must join those consumers and record the actual integrated source/build/install/run cut.
''')

p = Path('docs/experience/wiki-constellation.json')
data = json.loads(p.read_text())
data['obligation_sources']['adaptive65'] = {
    'source_ref': 'docs/experience/WIKI-CONSTELLATION-UX.md#6-adaptive-wikiuseragent-interaction',
    'issue': 'https://github.com/EpiLogos/O-I/issues/65',
    'consumer_issues': [375, 414, 418, 420],
    'policy': 'Extend existing stories and WC01–WC15; source coverage is not runtime, installed or human acceptance.'
}
rows = [
 ('AP01', ['KN02','KN04','KN08','AG03'], 'Ordinary source links, bkmr/ripgrep retrieval and authored QL constellations remain distinct from governance, interpretation and feedback authority.', ['D','C','P'], 'Search hits and geometry cannot acquire governance or semantic assertion authority.', ['WCT19','WCT24']),
 ('AP02', ['GV01','GV03','GV04','AG09','WR04'], 'Authorised operational correction changes agent-maintained Wiki source without silently mutating human governance or accepting agent inference.', ['D','C','P','H'], 'Exact basis and evidence survive; stale/concurrent edits and claimed-actor authority are checked separately.', ['WCT19','WCT20']),
 ('AP03', ['GV01','GV04','WR03','PX05'], 'Guidance carries purpose, applicability, exceptions and useful alternatives, without bypassing native privacy or authority.', ['D','C','P','H'], 'Useful reinterpretation does not weaken consent, disclosure or completion-evidence requirements.', ['WCT19','WCT23']),
 ('AP04', ['AG01','AG06','KN05','MC02'], 'User/guardian, root meta-project Central, current workcell, primary world and child ProjectCentral retain distinct identity and scope.', ['D','C','P','M'], 'Root-only use, sibling projects and two workcells have no silent primary-machine fallback or identity remint.', ['WCT21']),
 ('AP05', ['AG03','AG06','AG09','WR03','WR04','KN08'], 'A correction reaches the next actual act through the native source tool, selected composition and supported harness transport.', ['D','C','P','M','H'], 'Stored, selected, emitted, acknowledged and observed-use remain distinct; disconnected transport fails.', ['WCT19','WCT22','WCT25']),
 ('AP06', ['UI06','AG03','AG09','KN04','WR04'], 'Chat/selection and existing Context/Run/Agents surfaces expose a small correction operation and inspectable effective guidance.', ['D','C','P','H'], 'No participant modal or compulsory QL; human and agent operate one revisioned source with clear/suspend/undo.', ['WCT19','WCT24','WCT25']),
 ('AP07', ['GV03','GV04','KN04','KN05','PX05'], 'Accumulated scoped feedback supports a separately accepted governance revision and re-evaluation of dependent interpretations.', ['D','C','P','H'], 'Contradictions and common lineage remain visible; repetition never auto-ratifies governance; expiry revokes future delivery.', ['WCT20','WCT23']),
 ('AP08', ['AG06','KN05','WR04','UI06'], 'The joined loop proves changed use and survives denial, stale basis, budgets, unsupported transport, compaction and restart.', ['D','C','P','M','H'], 'Independent disconnected-consumer negative distinguishes saved files from a working collaboration.', ['WCT19','WCT20','WCT21','WCT22','WCT23','WCT24','WCT25'])
]
for n, stories, requirement, evidence, branch, tests in rows:
    key = 'adaptive65:' + n
    data['required_obligation_ids'].append(key)
    data['obligations'].append(dict(id=key,source='adaptive65',native_locator='Wiki UX section 6 '+n,requirement=requirement,story_ids=stories,required_evidence=evidence,required_branches=[branch],test_refs=tests))
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

p = Path('.wayfinder/maps/wiki-constellation-development.md')
p.write_text(p.read_text() + '''

## 9. Adaptive projection continuation of WC-W4/W5/W6 and WC-T3

Read UX section 6 and AP01–AP08 before implementation. The core objective is feedback changing the next act, not a new memory registry. Existing WC01–WC15 and WCT01–WCT18 remain required.

**Native slice:** AIKit #366, based on `579a1cdaf202b3b0de74a2ce25ec240fe857a91b`, supplies ordinary Agent Wiki Markdown read/update, revision/evidence retention, selected live hook reading and actual Claude hook context transport. Source files are `crates/aikit-cli/src/wiki_projection.rs`, existing Wiki/continuity/CLI registrations and `hook.rs`. Its CLI regression must exercise source update and plain harness stdout, not merely the JSON diagnostic envelope. Read the PR's exact latest test receipt; this map does not assert a pass.

**Receiving sequence:** preserve #418's reader/index/Return and #420's constructive field. Agent/bootstrap owner binds actual user, guardian, current root/workcell and project; declares eligible projection sources and the real tool in the selected composition. Shared shell owner joins chat correction and existing Context/Run/Agents receipts. Wiki owner exposes the source/evidence links and optional constellation view. Document skill owners consume the same current vision/projection route. Central retains separately reviewed governance source changes; Actuation retains Agency/permission and session identity; AIKit retains effective composition and harness delivery. No new writer of a shared file is introduced by this plan.

The source tool's submitted actor is attribution, not verified human identity. The first native slice requires explicit source selection and does not yet supply every session-expiry, desktop or live-harness adapter. Implement those at the existing owners; do not declare them permanently out of scope or close the complete loop from a fixture pass. Central root-only activity is not absent merely because no child Project is bound.

| Case | Required observation and negative |
|---|---|
| WCT19 | A person corrects actual agent behaviour once; exact Wiki source changes; the next act receives its revision and independently shows the desired change. Disconnect delivery: source save succeeds but joined acceptance fails. |
| WCT20 | Two writers using one basis cannot both win; conflict retains the human draft and evidence. Inference is not self-accepted; governance bytes do not change with projection edits. |
| WCT21 | Root-only Central, sibling ProjectCentrals, primary world and a second workcell retain scope and identities. No fallback to another root when current source is absent. |
| WCT22 | Resume, compaction and fresh session reload the current selected reading; unsupported events/harnesses report absent delivery, never a fabricated loaded receipt. |
| WCT23 | Source denied/deleted, projection cleared/suspended, budget exclusion and session expiry prevent future stale delivery. Exact source history remains attributable. |
| WCT24 | Plain Markdown correction and document skills work with QL absent; optional QL organisation preserves source authority, common evidence lineage and deliberate relation authorship. |
| WCT25 | Existing chat/Context/Run/Agents controls show saved/selected/emitted/acknowledged/use separately. No extra participant modal; independent actual-harness and human review retained. |

**Return:** exact native source/build refs, selected configuration, tool/skill discovery, source and next-act receipt, negative controls, privacy/scope outcomes and actual provider/human verdict. User machines and local installation are not mutated by this remote development. Reconcile the incoming integrated branch before joining consumer files.
''')

Path('tests/test_adaptive_wiki_ux.py').write_text('''import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("experience_map", ROOT / "scripts/experience_map.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AdaptiveWikiSource(unittest.TestCase):
    def setUp(self):
        self.reading = module.load_sources(ROOT)
    def test_all_adaptive_obligations_are_compiled_into_existing_stories(self):
        obligations = {o["id"]: o for o in self.reading["inherited_obligations"]}
        for n in range(1, 9):
            item = obligations[f"adaptive65:AP{n:02}"]
            self.assertTrue(item["story_ids"])
            self.assertEqual(item["mapping_status"], "specified-not-exercised")
        for n in range(1, 16):
            self.assertIn(f"wc65:WC{n:02}", obligations)
    def test_complete_interaction_text_is_in_the_hashed_source_reading(self):
        source = self.reading["source_documents"]["docs/experience/WIKI-CONSTELLATION-UX.md"]
        for text in ["Use this correction", "root meta-project", "bkmr", "ripgrep", "additional", "AP08"]:
            if text == "additional":
                continue
            self.assertIn(text, source["text"])
        self.assertTrue(source["digest"].startswith("sha256:"))
    def test_extension_does_not_confer_runtime_or_human_acceptance(self):
        self.assertIsNone(self.reading["feature_verdict"])
        for story in self.reading["stories"]:
            if any(o["id"].startswith("adaptive65:") for o in story["extensions"]["inherited_obligations"]):
                self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
                self.assertIsNone(story["extensions"]["human_experience"])
    def test_original_and_new_walks_are_retained(self):
        text = (ROOT / ".wayfinder/maps/wiki-constellation-development.md").read_text()
        for n in range(1, 26):
            self.assertIn(f"WCT{n:02}", text)

if __name__ == "__main__":
    unittest.main()
''')
