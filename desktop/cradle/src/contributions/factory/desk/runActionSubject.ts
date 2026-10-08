/** Factory owns subjects and admission. This controller joins its two real
 * readings; it never derives a subject from a node, label or agent name. */
export interface RunActionTarget { statePath: string; projectRef: string; runRef: string; actionRef: string }
export interface RunActionSubjectReading {
  target: RunActionTarget;
  label: string;
  requiredCapabilityRef: string;
  factoryStateRevision: number;
  runRevision: number;
  subjects: {ref: string; label: string}[];
}
export interface RunActionSubjectDraft { target: RunActionTarget; label: string; selected: string; reading?: RunActionSubjectReading; error?: string }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Factory returned an invalid action reading.");
  return value as Record<string, unknown>;
};
const ref = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) throw new Error("Factory returned a missing or invalid native reference.");
  return value;
};
const revision = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error("Factory did not disclose a valid action source revision.");
  return value as number;
};
export function sameActionTarget(a: RunActionTarget, b: RunActionTarget): boolean {
  return a.statePath === b.statePath && a.projectRef === b.projectRef && a.runRef === b.runRef && a.actionRef === b.actionRef;
}
export function mergeActionSubjectRead(draft: RunActionSubjectDraft, reading: RunActionSubjectReading): RunActionSubjectDraft {
  if (!sameActionTarget(draft.target, reading.target)) throw new Error("Factory action readback belongs to another source, project, Run or action.");
  return {...draft, reading, error: undefined};
}
export function actionSubjectReading(target: RunActionTarget, listed: unknown, runValue: unknown): RunActionSubjectReading {
  for (const value of Object.values(target)) ref(value);
  if (!Array.isArray(listed) || listed.length > 10000) throw new Error("Factory returned an invalid action list.");
  const listMatches = listed.map(object).filter(action => action.actionRef === target.actionRef);
  if (listMatches.length !== 1) throw new Error("This action is no longer uniquely disclosed by Factory.");
  const run = object(runValue), provenance = object(run.provenance);
  if (run.contract !== "factory.run-reading/v1" || provenance.owner !== "factory" || run.projectRef !== target.projectRef || run.runRef !== target.runRef)
    throw new Error("Factory action readback changed its owner, project or Run.");
  if (!Array.isArray(run.actions) || run.actions.length > 10000) throw new Error("Factory did not disclose this Run's actions.");
  const matches = run.actions.map(object).filter(action => action.actionRef === target.actionRef);
  if (matches.length !== 1) throw new Error("This action is no longer uniquely disclosed in the Run.");
  const action = matches[0], listedAction = listMatches[0];
  if (action.authorityOwner !== "factory" || action.inputContract !== "factory.action-projection/v1" || action.resultContract !== "factory.action-projection/v1")
    throw new Error("Factory disclosed an unsupported action owner or contract.");
  const requiredCapabilityRef = ref(action.requiredCapabilityRef);
  if (listedAction.requiredCapabilityRef !== requiredCapabilityRef) throw new Error("Factory's action capability changed between readings. Read again.");
  if (!Array.isArray(action.applicableSubjectRefs) || action.applicableSubjectRefs.length > 10000) throw new Error("Factory did not disclose applicable native subjects.");
  const refs = action.applicableSubjectRefs.map(ref);
  if (new Set(refs).size !== refs.length) throw new Error("Factory disclosed duplicate subject identities.");
  if (action.currentlyApplicable !== true || !refs.length) throw new Error("Factory reports no applicable subjects for this action.");
  const candidates = Array.isArray(run.candidates) ? run.candidates.map(object) : [];
  const runRevision = revision(run.revision);
  if (revision(provenance.subjectRevision) !== runRevision) throw new Error("Factory's Run source revision disagrees with its provenance.");
  return {target: {...target}, label: ref(action.label), requiredCapabilityRef,
    factoryStateRevision: revision(provenance.factoryStateRevision), runRevision,
    subjects: refs.map(subject => {
      const candidate = candidates.find(row => row.candidateRef === subject);
      return {ref: subject, label: typeof candidate?.label === "string" && candidate.label.trim() ? candidate.label : subject};
    })};
}
/** Draft selection survives reads, even when no longer applicable. It must
 * never become a different subject merely because the owner's list changed. */
export function actionSubjectRefusal(reading: RunActionSubjectReading, selected: string): string | undefined {
  if (!selected) return "Choose a subject disclosed by Factory.";
  if (!reading.subjects.some(subject => subject.ref === selected)) return "The selected subject is no longer applicable. Choose explicitly from the current reading.";
  return undefined;
}
export const FACTORY_ACTION_ADMISSION_MISSING = "Factory has not disclosed a native desktop caller and authority/capability grant for this action. Invocation is unavailable; no request was sent.";
