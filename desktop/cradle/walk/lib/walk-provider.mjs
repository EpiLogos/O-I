import {join} from "node:path";

/**
 * The real-model walk provider. A walk turn that reaches a real model spends
 * the owner's plan quota, so two laws hold for every walk that registers one:
 *
 *  1. PINNED — the pi argv names provider and model explicitly, so a walk
 *     session can never inherit an ambient default again. (On 2026-09-23 the
 *     cradle walks inherited glm-5.3 non-flash that way and burned the
 *     owner's GLM coding plan; the stipulated walk model is glm-5.3-flash.)
 *  2. OPT-IN — prompting a real model happens only when
 *     OI_WALK_REAL_PROVIDER=1. Without it the walk skips exactly the
 *     real-model phases and says so in its checks. The fixture-ACP walks
 *     (agent-dictation, select-send, task-basis, …) need no gate: their
 *     provider is a scripted python stub that reaches no model.
 */

export const WALK_MODEL_PROVIDER = process.env.OI_WALK_MODEL_PROVIDER ?? "zai";
export const WALK_MODEL_ID = process.env.OI_WALK_MODEL_ID ?? "glm-5.3-flash";

export function walkPiArgv() {
  const pi = process.env.OI_WALK_PI_BIN ?? join(process.env.HOME ?? "", ".local/bin/pi");
  return [pi, "--mode", "rpc", "--provider", WALK_MODEL_PROVIDER, "--model", WALK_MODEL_ID];
}

export const realProviderAuthorised = () => process.env.OI_WALK_REAL_PROVIDER === "1";

export const REAL_PROVIDER_SKIP_NOTE =
  "SKIP: real-model turns are opt-in (set OI_WALK_REAL_PROVIDER=1 to authorise plan-quota spend); no model was prompted";
