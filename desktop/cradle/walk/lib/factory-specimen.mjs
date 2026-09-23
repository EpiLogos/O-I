// factory-specimen: a DISPOSABLE Factory developmental ground carrying a
// realistic, owner-produced run, for the O:I desktop's Factory UI walks.
//
// Every byte of Factory state here is produced by the installed owner CLI
// (`factory`, default from PATH or OI_FACTORY_BIN): project setup, typed
// workflow commission, native attempt Actions and developmental mutations.
// Nothing writes Factory state JSON by hand, and nothing dispatches a real
// Agent or provider: `attempt owner-action`, `attempt prepare` and
// `attempt material` are never called, and AIKit, Workcell, Actuation and
// Central are never contacted. The owner receipts the attempts carry (AIKit
// delivery phases, Actuation carrier/usage) are CONTROLLED SPECIMEN RECEIPTS:
// their payloads say `providerContacted: false`, and their refs are all under
// the `specimen` namespace, so no walk can mistake them for live provider work.
//
// What the specimen contains (the walks assert against the returned readings,
// never against these comments):
//   run A  — typed workflow `specimen-release-notes`, four units:
//            survey → {draft, review} (fork) → integrate (join), plus the
//            `draft-reviewed` barrier (a gate node in the run map).
//            survey: attempt started, dispatched, verified (a partial pass
//              first, then complete), returned; a readable Return is recorded
//              and the Journey carries the owner Return, so Recognition is the
//              open step.
//            review: attempt started and dispatched (running), carrying the
//              caller's session ref; one of its two checks recorded, one
//              outstanding.
//            draft, integrate: no attempts.
//            Both executions are admitted with their Agencies and correlated
//              (telemetry) with the ground's real Git basis.
//   run B  — typed workflow `specimen-changelog-lint`, two units, queued, no
//            attempts.
//   run C  — a commission with no workflow source: zero work units.
//
// Native Actions the owner offers on these runs are exported as helpers
// below (recognise, requestEvidence); the operations the owner does NOT offer
// are named in OWNER_GAPS rather than simulated.

import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "factory-specimen");

/** Fixed specimen clock: every timestamp the specimen supplies is one of
 * these, so two builds from scratch produce the same refs and readings. */
export const SPECIMEN_CLOCK = Object.freeze({
  gitCommit: "2026-09-23T08:00:00Z",
  commissionA: "2026-09-23T09:00:00Z",
  commissionB: "2026-09-23T09:10:00Z",
  commissionC: "2026-09-23T09:20:00Z",
  surveyDecided: "2026-09-23T09:01:00Z",
  surveyStarted: "2026-09-23T09:02:00Z",
  surveyReturned: "2026-09-23T09:14:30Z",
  reviewDecided: "2026-09-23T09:15:00Z",
  reviewStarted: "2026-09-23T09:16:00Z",
  ownerReturn: "2026-09-23T09:17:00Z",
  recognition: "2026-09-23T09:30:00Z",
});

/** Deterministic Crockford ULID refs under the `01M3SPEC` specimen prefix. */
const specimenUlid = tag => `01M3SPEC${"0".repeat(26 - 8 - tag.length)}${tag}`;

/** The contracts and refs the specimen speaks, gathered for the walks. */
export const SPECIMEN_CONTRACTS = Object.freeze({
  commissionRequest: "factory.commission-request/v1",
  attemptAction: "factory.attempt-action/v1",
  mutationRequest: "factory.developmental-mutation-request/v1",
  actionProjection: "factory.action-projection/v1",
  requestEvidenceActionRef: "action:01ARZ3NDEKTSV4RRFFQ69G5FAP",
  requestEvidenceCapabilityRef: "capability/factory/request-evidence",
  attemptCapabilityRef: "capability/factory/operate-attempt",
});

/** Operations the O:I desktop may want that the Factory owner does NOT
 * offer on a run like this one. Established by reading the owner's command
 * surface (factory --help, capabilities --json) and its source at the
 * installed revision; kept here so a walk names the gap instead of faking it. */
export const OWNER_GAPS = Object.freeze({
  requestChanges: "No native request-changes operation exists: no Action, attempt operation or developmental mutation carries it. The only projected Action is request-more-evidence.",
  requestEvidenceSubjects: "request-more-evidence (action:01ARZ3NDEKTSV4RRFFQ69G5FAP) applies only to subject kind `candidate`; no owner operation can create a Candidate in a commissioned developmental state, so on this specimen it is listed but never applicable and invoking it is refused (subject not found).",
  openHumanRequest: "No owner operation opens a human request on a Run. Build-view humanRequests are created only as a side effect of request-more-evidence on a Candidate (human-request/request-evidence/<candidate>).",
  answerHumanRequest: "No owner operation answers, resolves or withdraws a human request.",
  partialVerificationPass: "A `passed` verification receipt must cover every verification obligation of the attempt (VerificationIncomplete otherwise), and Return requires the latest verification to be a complete pass. Per-obligation passes are therefore not native: partial progress is recorded as an `unknown` receipt naming the checked obligations.",
  runLifecycle: "No owner operation advances a Run's lifecycle past `seeded`: attempt Actions move legs and the run map, not the Run. So the build view reports every specimen Run as status `queued`, including run A with a returned and a running attempt; the live state is in the run map node states, the attempt legs and the build frontier.",
  centralTemporal: "A disposable ground from central.init has no recognised work or civil-time policy, so no Central NOW or day ref exists to correlate: temporal.childNowRef/dayRefs stay empty and telemetry names that gap.",
});

// ---------------------------------------------------------------------------
// Owner process plumbing

/** Run one owner CLI command; expected refusals are data, not exceptions. */
export function ownerCall(factory, args, {input, env} = {}) {
  const done = spawnSync(factory, args, {encoding: "utf8", input, env: env ?? process.env, maxBuffer: 64 * 1024 * 1024});
  if (done.error) throw done.error;
  return {ok: done.status === 0, status: done.status, stdout: done.stdout, stderr: done.stderr.trim()};
}

/** Run one owner CLI command that must succeed and answer JSON. */
export function ownerJson(factory, args, options) {
  const done = ownerCall(factory, args, options);
  if (!done.ok) {
    const error = new Error(`factory ${args.slice(0, 2).join(" ")} refused: ${done.stderr || done.stdout}`);
    error.ownerStderr = done.stderr;
    error.args = args;
    throw error;
  }
  return JSON.parse(done.stdout);
}

function git(cwd, args) {
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Specimen Author",
    GIT_AUTHOR_EMAIL: "specimen@example.invalid",
    GIT_AUTHOR_DATE: SPECIMEN_CLOCK.gitCommit,
    GIT_COMMITTER_NAME: "Specimen Author",
    GIT_COMMITTER_EMAIL: "specimen@example.invalid",
    GIT_COMMITTER_DATE: SPECIMEN_CLOCK.gitCommit,
  };
  const done = spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {cwd, env, encoding: "utf8"});
  if (done.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${done.stderr}`);
  return done.stdout.trim();
}

// ---------------------------------------------------------------------------
// Owner Actions the specimen drives, exported so a walk can drive more

/** Submit one native attempt operation at the attempt field's current
 * revision (compare-and-set). Returns the owner's receipt. */
export function attemptAction({factory = defaultFactory(), statePath, runRef, operation, callerRef = "agent/specimen-operator"}) {
  const reading = ownerJson(factory, ["attempt", "read", statePath, runRef, "--json"]);
  const request = {
    contract: SPECIMEN_CONTRACTS.attemptAction,
    projectionRef: `projection:specimen:${runRef}:${reading.revision}`,
    caller: {callerRef, projectionKind: "headless", lineage: [callerRef]},
    runRef,
    expectedRevision: reading.revision,
    authority: {
      authorityRef: "authority:specimen/attempt-operator",
      nativeOwner: "factory",
      capabilityRef: SPECIMEN_CONTRACTS.attemptCapabilityRef,
      capabilityGranted: true,
      actionAuthorised: true,
    },
    operation,
  };
  return ownerJson(factory, ["attempt", "action", statePath, "-", "--json"], {input: JSON.stringify(request)});
}

/** Apply one developmental mutation (`factory development mutate`). */
export function mutate({factory = defaultFactory(), statePath, mutationRef, source, observedAt, mutation}) {
  const request = {
    contract: SPECIMEN_CONTRACTS.mutationRequest,
    mutationRef,
    occurrenceRef: mutationRef.replace(/^mutation:/, "occurrence:"),
    source: {standing: "owner-native-observation", ...source},
    observedAt,
    mutation,
  };
  return ownerJson(factory, ["development", "mutate", statePath, "-", "--json"], {input: JSON.stringify(request)});
}

/**
 * Recognise a returned Return: `factory development mutate` with a
 * `record-owner-recognition` mutation (contract
 * factory.developmental-mutation-request/v1). The owner requires the
 * request's source ref to be among the recognition's basis refs; the
 * Recognition's subject is the Return ref. Returns the owner's receipt
 * (factory.developmental-mutation-receipt/v1). Replaying the same request is
 * idempotent (status `already-applied`); the same recognitionRef with a
 * different body is a replay conflict.
 */
export function recognise({factory = defaultFactory(), statePath, journeyRef, returnRef, recognitionRef = `recognition:specimen/${returnRef.replace(/^return:/, "").replace(/[^A-Za-z0-9-]/g, "-")}`, observedAt = SPECIMEN_CLOCK.recognition, sourceOwner = "central", sourceRevision = "1"}) {
  return mutate({
    factory, statePath, observedAt,
    mutationRef: `mutation:${recognitionRef}`,
    source: {owner: sourceOwner, reference: recognitionRef, revision: sourceRevision},
    mutation: {
      kind: "record-owner-recognition",
      journeyRef,
      recognition: {recognition_ref: recognitionRef, subject_ref: returnRef, basis_refs: [recognitionRef, returnRef]},
    },
  });
}

/** The owner's projected Actions for one Run (`factory action list`). */
export function listActions({factory = defaultFactory(), statePath, projectRef, runRef}) {
  return ownerJson(factory, ["action", "list", statePath, projectRef, runRef, "--json"]);
}

/**
 * Request more evidence: `factory action invoke <state> <project> <run> -`
 * with a factory.action-projection/v1 request for
 * action:01ARZ3NDEKTSV4RRFFQ69G5FAP. The owner applies it only to a
 * Candidate subject (see OWNER_GAPS.requestEvidenceSubjects); any other
 * subject is refused. Never throws on refusal: returns
 * {ok, receipt} or {ok: false, refusal} carrying the owner's own words.
 */
export function requestEvidence({factory = defaultFactory(), statePath, projectRef, runRef, subjectRef, callerRef = "person/specimen-owner"}) {
  const request = {
    contract: SPECIMEN_CONTRACTS.actionProjection,
    projectionRef: `projection:specimen:request-evidence:${subjectRef}`,
    caller: {callerRef, projectionKind: "desktop-human", lineage: [callerRef]},
    actionRef: SPECIMEN_CONTRACTS.requestEvidenceActionRef,
    subjectRef,
    runRef,
    authority: {
      authorityRef: "authority:specimen/request-evidence",
      nativeOwner: "factory",
      capabilityRef: SPECIMEN_CONTRACTS.requestEvidenceCapabilityRef,
      capabilityGranted: true,
      actionAuthorised: true,
    },
  };
  const done = ownerCall(factory, ["action", "invoke", statePath, projectRef, runRef, "-", "--json"], {input: JSON.stringify(request)});
  return done.ok ? {ok: true, receipt: JSON.parse(done.stdout)} : {ok: false, refusal: done.stderr.replace(/^factory:\s*/, "")};
}

function defaultFactory() {
  return process.env.OI_FACTORY_BIN ?? "factory";
}

// ---------------------------------------------------------------------------
// The specimen

function executionDisposition({unit, source, projectRef, runRef, agentRef, agencyRef, sessionRef, decidedAt, useType, grantRef}) {
  const selection = {
    roster_version: "aikit.model-roster/v1",
    model_ref: "model:specimen/text-model",
    provider_ref: "provider:specimen/no-provider",
    ranking_policy: "specimen-fixed",
    ranking_explanation: {specimen: true, note: "Fixed specimen selection; no AIKit roster was consulted."},
    provenance: ["selection:specimen/fixed"],
  };
  return {
    selection: {
      schema_version: "factory.execution-intelligence/v1",
      demand: {
        project_ref: projectRef,
        run_ref: runRef,
        workflow_unit_ref: unit.workflowUnitRef,
        agency_ref: agencyRef,
        profile_ref: null,
        use_type: useType,
        required_capabilities: unit.capabilityRefs,
        required_modalities: ["text"],
        required_actions: [],
        required_tools: [],
        context_characteristics: [],
        independence_from: [],
        cost_ceiling_usd: null,
        latency_preference_ms: null,
        requires_local_materialisation: false,
      },
      selection,
      decided_at: decidedAt,
    },
    participant: {
      agentRef,
      agencyRef,
      worldBindingRef: "binding:specimen/disposable-ground",
      sourceRef: source.ref,
      sourceRevision: source.revision,
      sourceDigest: `blake3:${source.semanticDigest}`,
    },
    contextRefs: ["context:specimen/release-notes"],
    praxisRefs: unit.praxisRefs,
    capabilityRefs: unit.capabilityRefs,
    body: {
      modelRef: selection.model_ref,
      providerRef: selection.provider_ref,
      routeRef: "route:specimen/none",
      harnessRef: "harness:specimen",
      harnessCompositionRef: "composition:specimen",
      agentSessionRef: sessionRef,
      sessionSpaceRef: "session-space/specimen",
    },
    permittedEffects: unit.permittedEffects,
    verificationObligations: unit.requiredVerification,
    returnAddress: unit.requiredReturn.address,
    stopConditions: unit.stopConditions,
    escalationConditions: unit.escalationConditions,
    budget: {wallClockTimeoutMs: 1_800_000, retryGrantRef: grantRef, maximumAttempts: 2},
  };
}

/** A controlled AIKit delivery receipt. No provider was contacted. */
function deliveryReceipt({operationRef, receiptRef, phase, evidenceRefs = [], sessionRef}) {
  return {
    ownerRef: "aikit",
    contract: "aikit.encounter-delivery/v1",
    operationRef,
    receiptRef,
    sourceRevision: "specimen-fixture-r1",
    phase,
    evidenceRefs,
    partialEffectRefs: [],
    payload: {specimen: true, providerContacted: false, agentSessionRef: sessionRef},
  };
}

function specimenUsageObservation({usageRef, agentRef, agencyRef, sessionRef, startedAt, completedAt}) {
  return {
    owner: "actuation",
    ref: usageRef,
    revision: "specimen-fixture-r1",
    standing: "estimated",
    contractSchemaDigest: "42215b3f06dffe5bfba53b0f51db6400d5b8739098c4fb1275f7a006579615cb",
    modelUsage: {
      schema: "actuation.model-usage/v1",
      usage_ref: usageRef,
      actuation_ref: "actuation:specimen/surveyor",
      invocation_ref: "invocation:specimen/survey-1",
      correlation: {agent_ref: agentRef, agency_ref: agencyRef, agent_session_ref: sessionRef, harness_ref: "harness:specimen", external_refs: []},
      provider: {standing: "estimated", ref: "provider:specimen/no-provider", name: "Specimen (no provider contacted)"},
      model: {standing: "estimated", ref: "model:specimen/text-model", name: "specimen-text-model"},
      tokens: {standing: "estimated", input: 18240, output: 2310},
      cache: {standing: "not-reported"},
      timing: {started_at: startedAt, completed_at: completedAt, latency: {standing: "estimated", milliseconds: 750000}},
      cost: {standing: "estimated", amount: 0.42, currency: "USD"},
      outcome: {state: "completed", standing: "estimated"},
      provenance: {
        reporter_ref: "reporter:factory-specimen-fixture",
        native_event_ref: "event:specimen/survey-1-usage",
        native_schema: "specimen-fixture/v1",
        observed_at: completedAt,
        raw_evidence_refs: ["evidence:specimen/fixture-usage-not-provider-reported"],
      },
    },
  };
}

function prepareGitRepository(projectRoot, basisSubject) {
  if (existsSync(join(projectRoot, ".git"))) throw new Error(`${projectRoot} already carries a Git repository; the specimen needs its own`);
  mkdirSync(join(projectRoot, "src"), {recursive: true});
  // The Factory store, the workflow sources and any ProjectCentral the caller
  // stamps are ground furniture, not the subject's source: ignored so the
  // recorded basis is the subject alone and the worktree reads clean.
  writeFileSync(join(projectRoot, ".gitignore"), ".factory/\nworkflows/\nProjectCentral/\n");
  writeFileSync(join(projectRoot, "README.md"), `# ${basisSubject}\n\nA disposable specimen project for the O:I desktop Factory walks.\nIts release notes are generated from CHANGELOG.md.\n`);
  writeFileSync(join(projectRoot, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n\n### Fixes\n- Release notes no longer drop empty sections.\n\n### Breaking changes\n- The notes command now requires --since.\n\n### Features\n- Release notes can be rendered as HTML.\n");
  writeFileSync(join(projectRoot, "src", "release_notes.txt"), "sections: sorted alphabetically by heading\n");
  git(projectRoot, ["init", "-q", "-b", "main"]);
  git(projectRoot, ["add", ".gitignore", "README.md", "CHANGELOG.md", "src/release_notes.txt"]);
  git(projectRoot, ["commit", "-q", "-m", "Specimen: release notes generated from the changelog"]);
  const head = git(projectRoot, ["rev-parse", "HEAD"]);
  const clean = git(projectRoot, ["status", "--porcelain"]) === "";
  return {repository: projectRoot, baseHead: head, branch: "main", worktreeClean: clean};
}

function commissionRequest({requestRef, projectKey, purpose, frontier, runDestination, commissionedAt, agentRef, participants}) {
  return {
    contract: SPECIMEN_CONTRACTS.commissionRequest,
    requestRef,
    projectKey,
    purpose,
    frontier,
    runDestination,
    writeOwner: "factory",
    commissionedAt,
    participantRequirements: participants.map(([ref, description]) => ({
      ref, description, sourceOwner: "central", sourceRef: `central:source:specimen:${ref}`, sourceRevision: "r1",
    })),
    rootAct: {
      actRef: `act:${requestRef.replace(/^commission-request:/, "")}`,
      agentRef,
      purpose: `Commission: ${purpose}`,
      scopeRefs: [projectKey],
      standing: "commissioned-not-executed",
    },
  };
}

/**
 * Build the specimen inside an existing disposable Central ground `root`
 * (the caller already ran central.init). Returns every ref and the owner's
 * own readings, each the parsed owner JSON.
 */
export async function makeFactorySpecimen({root: givenRoot, project = "Specimen", factory = process.env.OI_FACTORY_BIN ?? "factory", sessionRef}) {
  // The owner canonicalises paths (/var → /private/var on macOS); so must we.
  const root = givenRoot && existsSync(givenRoot) ? realpathSync(givenRoot) : givenRoot;
  if (!root || !existsSync(join(root, "Work"))) throw new Error(`root ${root} is not an initialised Central ground (no Work/)`);
  const projectRoot = join(root, "Work", project);
  const projectKey = `central-project:${project}`;
  mkdirSync(projectRoot, {recursive: true});

  // 1. The subject repository and the Factory source.
  const gitBasis = prepareGitRepository(projectRoot, project);
  const basisRevision = `${project}@${gitBasis.baseHead}`;
  const setup = ownerJson(factory, ["project", "setup", projectRoot, projectKey, "--json"]);
  const statePath = setup.statePath;
  const projectRef = setup.projectRef;

  // 2. Workflow sources: the fixtures plus a generated data module carrying
  // this ground's basis (the restricted compiler reads it; nothing evaluates).
  const workflows = join(projectRoot, "workflows");
  mkdirSync(workflows, {recursive: true});
  for (const file of ["release-notes.workflow.ts", "changelog-lint.workflow.ts"]) {
    writeFileSync(join(workflows, file), readFileSync(join(FIXTURES, file)));
  }
  writeFileSync(join(workflows, "basis.ts"), `// Generated by walk/lib/factory-specimen.mjs for this disposable ground.\nexport const basisRevision = ${JSON.stringify(basisRevision)};\nexport const subjectRef = ${JSON.stringify(projectKey)};\n`);
  const commission = (name, request, source) => {
    const requestPath = join(workflows, `${name}.commission.json`);
    writeFileSync(requestPath, JSON.stringify(request, null, 2));
    return source
      ? ownerJson(factory, ["workflow", "commission", statePath, requestPath, join(workflows, source), "--root", workflows, "--json"]).commission.commission
      : ownerJson(factory, ["development", "commission", statePath, requestPath, "--json"]).commission;
  };

  const purposeA = "Make the Specimen release notes follow the changelog's declared section order, so readers meet breaking changes first.";
  const commissionA = commission("run-a", commissionRequest({
    requestRef: "commission-request:specimen-release-notes",
    projectKey, purpose: purposeA,
    frontier: "Commissioned: survey where section order is decided, then draft the change and review it independently.",
    runDestination: "specimen/release-notes-section-order",
    commissionedAt: SPECIMEN_CLOCK.commissionA,
    agentRef: "agent/specimen-surveyor",
    participants: [
      ["agent/specimen-surveyor", "Surveys where the generator decides section order"],
      ["agent/specimen-author", "Drafts the ordering change"],
      ["agent/specimen-reviewer", "Reviews the declared order independently of the draft"],
      ["agent/specimen-integrator", "Integrates the draft with the review's findings"],
    ],
  }), "release-notes.workflow.ts");
  const purposeB = "Lint the changelog for headings the release-notes generator does not declare.";
  const commissionB = commission("run-b", commissionRequest({
    requestRef: "commission-request:specimen-changelog-lint",
    projectKey, purpose: purposeB,
    frontier: "Commissioned and queued: no attempt has started.",
    runDestination: "specimen/changelog-lint",
    commissionedAt: SPECIMEN_CLOCK.commissionB,
    agentRef: "agent/specimen-author",
    participants: [
      ["agent/specimen-author", "Writes the changelog lint"],
      ["agent/specimen-reviewer", "Confirms the lint against past releases"],
    ],
  }), "changelog-lint.workflow.ts");
  const purposeC = "Decide whether the release notes should also carry a migration guide.";
  const commissionC = commission("run-c", commissionRequest({
    requestRef: "commission-request:specimen-migration-guide-question",
    projectKey, purpose: purposeC,
    frontier: "Commissioned without a workflow: no work units yet.",
    runDestination: "specimen/migration-guide-question",
    commissionedAt: SPECIMEN_CLOCK.commissionC,
    agentRef: "agent/specimen-author",
    participants: [["agent/specimen-author", "Frames the migration-guide question"]],
  }), null);

  const runA = commissionA.runRef;
  const journeyA = commissionA.journeyRef;
  const inspectBefore = ownerJson(factory, ["workflow", "inspect", statePath, runA, "--json"]);
  const units = Object.fromEntries(inspectBefore.units.map(unit => [unit.key, unit]));
  const source = inspectBefore.source;
  const act = operation => attemptAction({factory, statePath, runRef: runA, operation});

  // 3a. The survey unit: started, dispatched, partially then completely
  // verified, returned with a readable Return.
  const survey = units["survey-section-order"];
  const surveyAttempt = "attempt:specimen-survey-1";
  const surveyExecution = "execution:specimen-survey-1";
  const surveySession = "agent-session/specimen-survey";
  const surveyDelivery = "delivery:specimen-survey-1";
  const surveyGrant = "grant:specimen/survey";
  act({
    operation: "start-serial",
    attempt_ref: surveyAttempt,
    task_ref: "task:specimen/survey-section-order",
    parent_journey_ref: journeyA,
    workflow_unit_ref: survey.workflowUnitRef,
    disposition: executionDisposition({unit: survey, source, projectRef, runRef: runA, agentRef: "agent/specimen-surveyor", agencyRef: "agency:specimen/surveyor", sessionRef: surveySession, decidedAt: SPECIMEN_CLOCK.surveyDecided, useType: "survey", grantRef: surveyGrant}),
    retry_grant: {grantRef: surveyGrant, attemptsAllowed: 2, attemptsSpent: 0, revoked: false},
    tracking: [{factRef: "fact:specimen-survey-1/session", kind: "session", ownerRef: "aikit", subjectRef: surveySession, sourceRevision: "specimen-fixture-r1", evidenceRefs: ["receipt:specimen-survey-1/submitted"]}],
  });
  act({operation: "bind-dispatch", attempt_ref: surveyAttempt, execution_ref: surveyExecution, receipt: deliveryReceipt({operationRef: surveyDelivery, receiptRef: "receipt:specimen-survey-1/submitted", phase: "submitted", sessionRef: surveySession})});
  const [surveyCheckCitations, surveyCheckTests, surveyCheckFunction] = survey.requiredVerification;
  act({operation: "record-verification", attempt_ref: surveyAttempt, verification: {
    verificationRef: "verification:specimen-survey-1/first-pass", ownerRef: "factory", sourceRevision: "specimen-fixture-r1", outcome: "unknown",
    obligations: [surveyCheckCitations, surveyCheckTests], evidenceRefs: ["evidence:specimen/survey-citations", "evidence:specimen/survey-test-run"],
  }});
  act({operation: "record-observation", attempt_ref: surveyAttempt, receipt: deliveryReceipt({operationRef: surveyDelivery, receiptRef: "receipt:specimen-survey-1/returned", phase: "returned", evidenceRefs: ["evidence:specimen/survey-transcript"], sessionRef: surveySession})});
  act({operation: "record-verification", attempt_ref: surveyAttempt, verification: {
    verificationRef: "verification:specimen-survey-1/complete", ownerRef: "factory", sourceRevision: "specimen-fixture-r1", outcome: "passed",
    obligations: survey.requiredVerification, evidenceRefs: ["evidence:specimen/survey-citations", "evidence:specimen/survey-test-run", "evidence:specimen/survey-ordering-function"],
  }});
  const surveyArtifact = "artifact:specimen/survey-section-order";
  const surveyReturnRef = "return:specimen/survey-section-order-1";
  const surveyReturnSummary = "Section order is decided in one place: the generator sorts headings alphabetically in src/release_notes.txt line 1, so Breaking changes renders after Fixes. The existing release-notes tests pass and do not pin order. The draft should replace the alphabetical sort with the changelog's declared order.";
  const surveyEvidence = ["evidence:specimen/survey-citations", "evidence:specimen/survey-test-run", "evidence:specimen/survey-ordering-function"];
  act({operation: "return-artifact", attempt_ref: surveyAttempt,
    artifact: {artifactRef: surveyArtifact, subjectRef: survey.subjectRef, subjectRevision: survey.basisRevision, producingExecutionRef: surveyExecution, evidenceRefs: surveyEvidence, semanticDifference: "The ordering decision point is located and cited at the basis revision."},
    readable_return: {returnRef: surveyReturnRef, summary: surveyReturnSummary, artifactRefs: [surveyArtifact], evidenceRefs: surveyEvidence},
  });

  // 3b. The review unit: started and dispatched (running), on the caller's
  // session; one check recorded, one outstanding.
  const review = units["review-section-order"];
  const reviewAttempt = "attempt:specimen-review-1";
  const reviewExecution = "execution:specimen-review-1";
  const reviewSession = sessionRef ?? "agent-session/specimen-review";
  const reviewGrant = "grant:specimen/review";
  act({
    operation: "start-serial",
    attempt_ref: reviewAttempt,
    task_ref: "task:specimen/review-section-order",
    parent_journey_ref: journeyA,
    workflow_unit_ref: review.workflowUnitRef,
    disposition: executionDisposition({unit: review, source, projectRef, runRef: runA, agentRef: "agent/specimen-reviewer", agencyRef: "agency:specimen/reviewer", sessionRef: reviewSession, decidedAt: SPECIMEN_CLOCK.reviewDecided, useType: "review", grantRef: reviewGrant}),
    retry_grant: {grantRef: reviewGrant, attemptsAllowed: 2, attemptsSpent: 0, revoked: false},
    tracking: [{factRef: "fact:specimen-review-1/session", kind: "session", ownerRef: "aikit", subjectRef: reviewSession, sourceRevision: "specimen-fixture-r1", evidenceRefs: ["receipt:specimen-review-1/submitted"]}],
  });
  act({operation: "bind-dispatch", attempt_ref: reviewAttempt, execution_ref: reviewExecution, receipt: deliveryReceipt({operationRef: "delivery:specimen-review-1", receiptRef: "receipt:specimen-review-1/submitted", phase: "submitted", sessionRef: reviewSession})});
  const [reviewCheckCounterExamples, reviewCheckChangelog] = review.requiredVerification;
  act({operation: "record-verification", attempt_ref: reviewAttempt, verification: {
    verificationRef: "verification:specimen-review-1/in-progress", ownerRef: "factory", sourceRevision: "specimen-fixture-r1", outcome: "unknown",
    obligations: [reviewCheckCounterExamples], evidenceRefs: ["evidence:specimen/review-counter-examples"],
  }});

  // 3c. Situated Agencies and executions, then their telemetry correlations
  // with the ground's real Git basis.
  const observedBy = (reference, revision = "specimen-fixture-r1") => ({owner: "factory", ref: reference, revision, standing: "observed"});
  const admit = (kind, record, key, observedAt) => mutate({factory, statePath, observedAt, mutationRef: `mutation:specimen/${kind}/${record[key].replace(/[^A-Za-z0-9-]/g, "-")}`, source: {owner: "actuation", reference: record[key], revision: "specimen-fixture-r1"}, mutation: {kind, [kind === "admit-situated-agency" ? "agency" : "execution"]: record}});
  admit("admit-situated-agency", {runRef: runA, agencyRef: "agency:specimen/surveyor", agentRef: "agent/specimen-surveyor", label: "Specimen surveyor", metagencyGrantRefs: [], actuationRef: "actuation:specimen/surveyor", returnRef: surveyReturnRef, returnState: "returned"}, "agencyRef", SPECIMEN_CLOCK.surveyReturned);
  admit("admit-situated-execution", {runRef: runA, executionRef: surveyExecution, status: "returned", agencyRef: "agency:specimen/surveyor", agentRef: "agent/specimen-surveyor", harnessRef: "harness:specimen", harnessCompositionRef: "composition:specimen", agentSessionRef: surveySession, sessionSpaceRef: "session-space/specimen", surfaceRefs: [], workcellBindingRefs: []}, "executionRef", SPECIMEN_CLOCK.surveyReturned);
  admit("admit-situated-agency", {runRef: runA, agencyRef: "agency:specimen/reviewer", agentRef: "agent/specimen-reviewer", label: "Specimen reviewer", metagencyGrantRefs: [], actuationRef: "actuation:specimen/reviewer"}, "agencyRef", SPECIMEN_CLOCK.reviewStarted);
  admit("admit-situated-execution", {runRef: runA, executionRef: reviewExecution, status: "running", agencyRef: "agency:specimen/reviewer", agentRef: "agent/specimen-reviewer", harnessRef: "harness:specimen", harnessCompositionRef: "composition:specimen", agentSessionRef: reviewSession, sessionSpaceRef: "session-space/specimen", surfaceRefs: [], workcellBindingRefs: []}, "executionRef", SPECIMEN_CLOCK.reviewStarted);

  const surveyTelemetryRef = `telemetry:${specimenUlid("TM01")}`;
  const reviewTelemetryRef = `telemetry:${specimenUlid("TM02")}`;
  const correlate = (correlation, observedAt) => mutate({factory, statePath, observedAt, mutationRef: `mutation:specimen/correlation/${correlation.telemetryRef.replace(/[^A-Za-z0-9-]/g, "-")}`, source: {owner: "factory", reference: correlation.correlationRef, revision: "specimen-fixture-r1"}, mutation: {kind: "record-execution-correlation", correlation}});
  const carrier = agency => ({mechanism: "native-harness", carrierRef: "harness:specimen", determinationRef: `determination:specimen/${agency}`, source: {owner: "actuation", ref: `actuation:specimen/${agency}`, revision: "specimen-fixture-r1", standing: "derived"}});
  const materialAbsent = {owner: "workcell", availability: "unavailable", observations: [], reason: "The specimen runs in no Workcell; no resource usage exists to observe."};
  correlate({
    correlationRef: `execution-correlation:${specimenUlid("CR01")}`,
    telemetryRef: surveyTelemetryRef,
    runRef: runA, workflowUnitRef: survey.workflowUnitRef, executionRef: surveyExecution, agencyRef: "agency:specimen/surveyor",
    carrier: carrier("surveyor"),
    temporal: {
      started: {value: SPECIMEN_CLOCK.surveyStarted, source: observedBy(surveyAttempt)},
      completed: {value: SPECIMEN_CLOCK.surveyReturned, source: observedBy(surveyAttempt)},
      activityRefs: [], sourceChanges: [], dayRefs: [],
    },
    modelUsage: {owner: "actuation", availability: "available", observations: [specimenUsageObservation({usageRef: "usage:specimen/survey-1", agentRef: "agent/specimen-surveyor", agencyRef: "agency:specimen/surveyor", sessionRef: surveySession, startedAt: SPECIMEN_CLOCK.surveyStarted, completedAt: SPECIMEN_CLOCK.surveyReturned})]},
    materialUsage: materialAbsent,
    gitBasis,
  }, SPECIMEN_CLOCK.surveyReturned);
  correlate({
    correlationRef: `execution-correlation:${specimenUlid("CR02")}`,
    telemetryRef: reviewTelemetryRef,
    runRef: runA, workflowUnitRef: review.workflowUnitRef, executionRef: reviewExecution, agencyRef: "agency:specimen/reviewer",
    carrier: carrier("reviewer"),
    temporal: {started: {value: SPECIMEN_CLOCK.reviewStarted, source: observedBy(reviewAttempt)}, activityRefs: [], sourceChanges: [], dayRefs: []},
    modelUsage: {owner: "actuation", availability: "unavailable", observations: [], reason: "The review attempt is still running; no usage has been reported."},
    materialUsage: materialAbsent,
    gitBasis,
  }, SPECIMEN_CLOCK.reviewStarted);

  // 3d. The owner Return on the Journey: Recognition is now the open step.
  const ownerReturn = mutate({
    factory, statePath, observedAt: SPECIMEN_CLOCK.ownerReturn,
    mutationRef: "mutation:specimen/owner-return/survey-section-order-1",
    source: {owner: "factory", reference: surveyReturnRef, revision: "specimen-fixture-r1"},
    mutation: {kind: "record-owner-return", journeyRef: journeyA, returned: {
      return_ref: surveyReturnRef, run_refs: [runA], basis_refs: [surveyArtifact], evidence_refs: [surveyReturnRef, ...surveyEvidence],
      recognition_ref: null, summary: surveyReturnSummary,
    }},
  });

  // 4. The owner's own readings, captured after every write.
  const read = args => ownerJson(factory, [...args, "--json"]);
  const readings = {
    locate: read(["project", "locate", projectRoot]),
    projectReading: read(["development", "project", statePath, projectRef]),
    journeyReading: read(["development", "journey", statePath, journeyA]),
    runReading: read(["development", "run", statePath, runA]),
    inspect: read(["workflow", "inspect", statePath, runA]),
    attemptList: read(["attempt", "list", statePath, runA]),
    attemptRead: read(["attempt", "read", statePath, runA]),
    attemptReturn: read(["attempt", "return", statePath, runA, surveyAttempt]),
    telemetryStatus: read(["telemetry", "status", statePath]),
    telemetryInspect: read(["telemetry", "inspect", statePath, surveyTelemetryRef]),
    telemetryInspectRunning: read(["telemetry", "inspect", statePath, reviewTelemetryRef]),
    buildSnapshot: read(["build", "snapshot", statePath, projectRef, runA]),
    actions: listActions({factory, statePath, projectRef, runRef: runA}),
  };
  const runBRef = commissionB.runRef;
  const runCRef = commissionC.runRef;
  const inspectB = read(["workflow", "inspect", statePath, runBRef]);
  const unitRefsA = Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, unit.workflowUnitRef]));

  return {
    root, projectRoot, statePath, projectRef, projectKey, gitBasis, basisRevision,
    sessionRef: reviewSession,
    sessionRefSupplied: Boolean(sessionRef),
    runs: {
      A: {
        runRef: runA, journeyRef: journeyA, purpose: purposeA,
        commissionRequestRef: commissionA.request.requestRef,
        workflowSourceRef: source.ref, workflowSourceRevision: source.revision,
        unitRefs: unitRefsA,
        edges: readings.runReading.runMap.edges,
        gateNodeIds: Object.values(readings.runReading.runMap.nodes).filter(node => node.kind === "gate").map(node => node.id),
        // The owner's own frontier (build view): the running review leg.
        frontierUnitRef: readings.buildSnapshot.view.frontier.subjectRef,
        attemptRefs: {survey: surveyAttempt, review: reviewAttempt},
        executionRefs: {survey: surveyExecution, review: reviewExecution},
        agencyRefs: {survey: "agency:specimen/surveyor", review: "agency:specimen/reviewer"},
        sessionRefs: {survey: surveySession, review: reviewSession},
        returnRef: surveyReturnRef, returnSummary: surveyReturnSummary, artifactRef: surveyArtifact,
        verifications: {
          survey: {passed: survey.requiredVerification, outstanding: [], history: ["unknown: 2 of 3 checked", "passed: 3 of 3"]},
          review: {checked: [reviewCheckCounterExamples], outstanding: [reviewCheckChangelog]},
        },
        telemetryRefs: {survey: surveyTelemetryRef, review: reviewTelemetryRef},
        ownerReturn,
      },
      B: {runRef: runBRef, journeyRef: commissionB.journeyRef, purpose: purposeB, workflowSourceRef: inspectB.source.ref, unitRefs: Object.fromEntries(inspectB.units.map(unit => [unit.key, unit.workflowUnitRef])), attemptRefs: {}, buildSnapshot: read(["build", "snapshot", statePath, projectRef, runBRef])},
      C: {runRef: runCRef, journeyRef: commissionC.journeyRef, purpose: purposeC, unitRefs: {}, attemptRefs: {}, runReading: read(["development", "run", statePath, runCRef]), buildSnapshot: read(["build", "snapshot", statePath, projectRef, runCRef])},
    },
    readings,
    // The owner's own refusal words for request-more-evidence on the
    // specimen's only kind of subject (a Return, not a Candidate).
    requestEvidenceOnReturn: requestEvidence({factory, statePath, projectRef, runRef: runA, subjectRef: surveyReturnRef}),
    gaps: OWNER_GAPS,
  };
}
