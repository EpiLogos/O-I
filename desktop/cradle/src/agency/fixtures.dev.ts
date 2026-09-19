/**
 * Agency dev fixtures — imported ONLY behind
 * `import.meta.env.DEV && new URLSearchParams(location.search).has("fixtures")`
 * (COMMON-BRIEF fixture rule). Every fixture-backed reading a component
 * shows carries a visible "Fixture — not native data" label; these sources
 * exist so the search/inference/mint/guardian flows can be exercised
 * before their real AIKit/Factory producers land, never as a production
 * data path.
 */
import { registerAgentMintSource, registerGuardianSource, registerSetupInferenceSource, registerSkillSearchSource } from "./agencySources";
import type { SkillCandidate } from "./agencySources";
import type { AgentDraft, GuardianRecord, SetupProposalRecord } from "./agencyTypes";

const FIXTURE_CATALOGUE_REVISION = "fixture-catalogue-r0";

const FIXTURE_CANDIDATES: SkillCandidate[] = [
  { ref: "skill:central.day-close", title: "Central day close", kind: "skill", revision: "rev-14", source: "Central", steward: "Central Guardian", summary: "Close a NOW day boundary honestly, with a dated reading.", prerequisites: ["ctrl native day authority"], targets: ["root"], fixture: true },
  { ref: "method:factory.claim-reception", title: "Factory claim reception", kind: "method", revision: "rev-7", source: "Software Factory", steward: "Software Factory Guardian", summary: "Receive a sender's claim against a subject with an assessed basis.", prerequisites: ["Factory session"], targets: ["project"], fixture: true },
  { ref: "skillset:aikit.search-and-discovery", title: "AIKit search & discovery", kind: "skillset", revision: "rev-3", source: "AIKit", steward: "AIKit Guardian", summary: "Permission-aware content and capability search across the world.", prerequisites: [], targets: ["root", "project"], fixture: true },
];

export function installAgencyFixtures(): () => void {
  const unregisterSearch = registerSkillSearchSource({
    async search(query) {
      const text = query.text.trim().toLowerCase();
      const candidates = text ? FIXTURE_CANDIDATES.filter((candidate) => candidate.title.toLowerCase().includes(text) || (candidate.summary ?? "").toLowerCase().includes(text)) : FIXTURE_CANDIDATES;
      return { candidates, coverage: "partial", reason: "Fixture catalogue — a fraction of the real AIKit/Factory Method census." };
    },
  });
  const unregisterInference = registerSetupInferenceSource({
    async propose(input): Promise<SetupProposalRecord> {
      const chosen = input.candidates.slice(0, 2);
      return {
        suggestions: chosen.map((candidate, index) => ({
          candidateRef: candidate.ref,
          revision: candidate.revision,
          reason: `Fixture relation to "${input.intent.slice(0, 60)}" — no real inference ran.`,
          requirement: index === 0 ? "required" : "optional",
          prerequisites: candidate.prerequisites,
          targetCompatibility: "unknown",
          proposedScope: input.project ?? "unscoped",
          stewardship: candidate.steward ?? candidate.source,
          sourceLabel: candidate.source,
        })),
        gaps: chosen.length === 0 ? ["No fixture candidate matched this intent."] : [],
        conflicts: [],
        duplicates: [],
        basis: { intent: input.intent, catalogueRevision: FIXTURE_CATALOGUE_REVISION, target: input.project ?? "unscoped" },
      };
    },
  });
  const unregisterMint = registerAgentMintSource({
    async validate(draft: AgentDraft) {
      const problems: string[] = [];
      if (!draft.intentExpression.trim()) problems.push("Fixture check: an intent expression is required.");
      return { ok: problems.length === 0, problems };
    },
    async create(draft: AgentDraft) {
      return { agentRef: `fixture:agent:${draft.name?.trim() || "untitled"}-${Date.now()}` };
    },
  });
  const guardians: GuardianRecord[] = [
    { agentRef: "fixture:guardian:central", name: "Central Guardian (fixture)", product: "Central", repertoireSourceRef: "fixture:repertoire:central", readiness: "Adapter-inferred", pendingPracticeProposals: [], verifiedChanges: [] },
  ];
  const unregisterGuardian = registerGuardianSource({
    async list() { return guardians; },
  });
  return () => { unregisterSearch(); unregisterInference(); unregisterMint(); unregisterGuardian(); };
}
