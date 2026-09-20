/** Existing System/Profiles ingress, now using the reusable setup/recovery flow.
 * No new shell route, configuration authority or durable evidence store.
 */
import {useMemo} from "react";
import type {SettingSpec} from "./contracts";
import type {ChangeRequest, ConfigPlaneSource} from "./source";
import {detectTransport, kernelOp} from "../kernel/bridge";
import {SetupFlow} from "./SetupFlow";
import {SetupFlowController, requestKey} from "./setupFlowController";
import {createSetupNative} from "./setupNative";
export {ChangeSetView} from "./SetupFlow";

export interface PlanDrawerProps {
  source: ConfigPlaneSource;
  requests: ChangeRequest[];
  settings: Record<string, SettingSpec>;
  onClose: () => void;
  onApplied: () => void;
}

// Only in-memory presentation drafts, scoped to the existing source object.
// Never localStorage/profiles/receipts. Cancel/reopen retains the draft or
// uncertain result; a native operation is never replayed just by remounting.
const drafts = new WeakMap<ConfigPlaneSource, Map<string, SetupFlowController>>();
function draftFor(source: ConfigPlaneSource, requests: ChangeRequest[], settings: Record<string, SettingSpec>): SetupFlowController {
  let entries = drafts.get(source);
  if (!entries) {entries = new Map(); drafts.set(source, entries);}
  const key = JSON.stringify(requests.map(requestKey).sort());
  const prior = entries.get(key);
  const candidate = new SetupFlowController(source, requests, settings);
  if (prior) {
    const state = prior.getSnapshot();
    const finished = state.step === "result" && state.changeset?.status === "verified" && state.readbackComplete && !state.busy && !state.outcomeUnknown;
    if (!finished || JSON.stringify(state.requests) === JSON.stringify(candidate.getSnapshot().requests)) return prior;
  }
  entries.set(key, candidate);
  return candidate;
}

export function PlanDrawer({source, requests, settings, onClose, onApplied}: PlanDrawerProps) {
  const identity = JSON.stringify(requests.map(requestKey).sort());
  // The request values are intentionally not a remount key: owner readback
  // can refresh the parent while this same reviewed operation is running.
  const controller = useMemo(() => draftFor(source, requests, settings), [source, identity]); // eslint-disable-line react-hooks/exhaustive-deps
  const native = useMemo(() => {
    if (source.kind !== "live") return undefined;
    const transport = detectTransport();
    if (transport.kind === "unavailable") return undefined;
    return createSetupNative(op => kernelOp(transport, op));
  }, [source]);
  return <SetupFlow controller={controller} native={native} startAtReview onClose={onClose} onApplied={onApplied}/>;
}
