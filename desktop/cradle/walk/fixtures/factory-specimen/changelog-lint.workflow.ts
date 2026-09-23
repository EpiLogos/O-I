import { defineWorkflow } from "@epilogos/factory-workflow";
import { basisRevision, subjectRef } from "./basis.ts";

// Factory specimen workflow for the O:I desktop Factory walks (run B).
// Commissioned and left queued: no attempt is ever started on it.

export default defineWorkflow({
  "source": {
    "ref": "workflow-source:01M3SPEC0000000000000000B1",
    "revision": "specimen-changelog-lint-v1"
  },
  "workflowKey": "specimen-changelog-lint",
  "units": [
    {
      "key": "lint-changelog-headings",
      "developmentalConcern": "Changelog entries use headings the release-notes generator does not declare, so they fall to the end.",
      "requiredDifference": "A lint that names every undeclared heading in the changelog before release.",
      "returnContract": "Return the lint, the headings it flags today and the command that runs it.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-author"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": [],
      "independenceFrom": [],
      "permittedEffects": [
        "read: the Specimen repository at its basis revision",
        "execute: the changelog lint"
      ],
      "verificationObligations": [
        "The lint flags a heading planted outside the declared set.",
        "The lint passes on a changelog that uses only declared headings."
      ],
      "returnAddress": "return:specimen/changelog-lint",
      "stopConditions": "Stop on a changed basis revision or missing authority; retain every partial outcome.",
      "escalationConditions": "Escalate when the declared heading set itself is in dispute."
    },
    {
      "key": "confirm-changelog-lint",
      "developmentalConcern": "The lint must be confirmed by someone other than its author before it gates releases.",
      "requiredDifference": "An independent run of the lint against the last three releases' changelogs.",
      "returnContract": "Return the three runs and any heading the lint missed.",
      "subjectRef": subjectRef,
      "basisRevision": basisRevision,
      "agentRequirements": { "agentRefs": ["agent/specimen-reviewer"] },
      "praxisRefs": ["praxis:specimen/cite-before-claiming"],
      "capabilityRefs": ["capability/factory/operate-attempt"],
      "dependencies": ["lint-changelog-headings"],
      "independenceFrom": [],
      "permittedEffects": [
        "read: the lint and the last three releases' changelogs",
        "execute: the changelog lint"
      ],
      "verificationObligations": [
        "Each of the three runs is quoted with its exit status."
      ],
      "returnAddress": "return:specimen/changelog-lint",
      "stopConditions": "Stop on a changed basis revision or missing authority; retain every partial outcome.",
      "escalationConditions": "Escalate when a release changelog cannot be found."
    }
  ],
  "barriers": [],
  "nesting": []
});
