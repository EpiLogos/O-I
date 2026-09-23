import { defineWorkflow } from "@epilogos/factory-workflow";
import { basisRevision, subjectRef } from "./basis.ts";

// Factory specimen workflow for the O:I desktop Factory walks (run A).
// Owner-compiled through `factory workflow commission`; never evaluated.
// basis.ts is written beside this file by walk/lib/factory-specimen.mjs so the
// units carry the disposable ground's real Git basis.
// Shape: one survey unit forks into a draft and an independent review; both
// converge on an integration unit, gated by the `draft-reviewed` barrier.

const stopConditions =
  "Stop on a changed basis revision, missing authority or any write outside the permitted paths; retain every partial outcome.";
const escalationConditions =
  "Escalate when the section order is decided somewhere other than the release-notes generator, or when a test cannot be run.";

export default defineWorkflow({
  "source": {
    "ref": "workflow-source:01M3SPEC0000000000000000A1",
    "revision": "specimen-release-notes-v1"
  },
  "workflowKey": "specimen-release-notes",
  "units": [
    {
      "key": "survey-section-order",
      "developmentalConcern": "Release notes list their sections alphabetically, so readers meet Fixes before Breaking changes.",
      "requiredDifference": "An exact account of where the generator decides section order, citing file and line at the basis revision.",
      "returnContract": "Return the cited decision point, the current test result and the section order the generator produces today.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-surveyor"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": [],
      "independenceFrom": [],
      "permittedEffects": [
        "read: the Specimen repository at its basis revision",
        "execute: the existing release-notes tests"
      ],
      "verificationObligations": [
        "Every cited file and line exists at the basis revision.",
        "The existing release-notes tests were run and their result is quoted.",
        "The account names the one function that orders sections."
      ],
      "returnAddress": "return:specimen/release-notes",
      "stopConditions": stopConditions,
      "escalationConditions": escalationConditions
    },
    {
      "key": "draft-section-order",
      "developmentalConcern": "The generator must order sections by the changelog's declared order, not alphabetically.",
      "requiredDifference": "Sections render in the changelog's declared order: Breaking changes, Features, Fixes.",
      "returnContract": "Return the change, the tests that pin the new order and any section the changelog does not declare.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-author"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": ["survey-section-order"],
      "independenceFrom": [],
      "permittedEffects": [
        "read: the Specimen repository at its basis revision",
        "write: src/release_notes.txt and its direct tests in the Specimen repository",
        "execute: the release-notes tests"
      ],
      "verificationObligations": [
        "A test fails before the change and passes after it.",
        "Undeclared sections keep their relative order after the declared ones.",
        "No file outside the permitted paths changed."
      ],
      "returnAddress": "return:specimen/release-notes",
      "stopConditions": stopConditions,
      "escalationConditions": escalationConditions
    },
    {
      "key": "review-section-order",
      "developmentalConcern": "The ordering rule needs an independent reading against the changelog before it is integrated.",
      "requiredDifference": "An independent judgement of whether the declared order is the one readers need, with counter-examples.",
      "returnContract": "Return the judgement, the counter-examples tried and any disagreement with the survey.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-reviewer"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": ["survey-section-order"],
      "independenceFrom": ["draft-section-order"],
      "permittedEffects": [
        "read: the Specimen repository and the survey Return",
        "execute: the release-notes tests"
      ],
      "verificationObligations": [
        "At least two counter-examples were tried against the declared order.",
        "The judgement cites the changelog, not the draft."
      ],
      "returnAddress": "return:specimen/release-notes",
      "stopConditions": stopConditions,
      "escalationConditions": escalationConditions
    },
    {
      "key": "integrate-release-notes",
      "developmentalConcern": "The draft and the review must meet in one change a person can recognise.",
      "requiredDifference": "One integrated change whose release notes follow the declared order, with the review's findings answered.",
      "returnContract": "Return the integrated change, the answered review findings and the final test result.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-integrator"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": ["draft-section-order", "review-section-order"],
      "independenceFrom": [],
      "permittedEffects": [
        "read: the draft and review Returns",
        "write: src/release_notes.txt in the Specimen repository",
        "execute: the release-notes tests"
      ],
      "verificationObligations": [
        "Every review finding is answered or carried forward by name.",
        "The full release-notes test suite passes.",
        "The rendered notes for the sample changelog read Breaking changes, Features, Fixes."
      ],
      "returnAddress": "return:specimen/release-notes",
      "stopConditions": stopConditions,
      "escalationConditions": escalationConditions
    }
  ],
  "barriers": [
    {
      "key": "draft-reviewed",
      "waitsFor": ["draft-section-order", "review-section-order"],
      "releases": ["integrate-release-notes"]
    }
  ],
  "nesting": []
});
