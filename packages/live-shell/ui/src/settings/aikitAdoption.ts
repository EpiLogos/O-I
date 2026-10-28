// AIKit's adoption plan, read once for every face that adopts a skill root: Setup's Harnesses and skills step (windowPages.ts) and the
// Skillset rack's Adopt page (agent/devices/designBindings.ts). `aikit adopt ROOT [--namespace N] --json` without --yes answers the plan
// (ai-kit crates/aikit-cli/src/main.rs cmd_adopt): the root it surveyed (`source`, canonical), the namespace, the capsules it adopts, and two
// digests. `review_digest` binds a confirmation to the surveyed bytes, paths, links and modes, and is the one `aikit adopt ROOT --yes
// --expect-digest` takes; `digest` is the saved Procedure's own, which only `aikit procedure run` takes.
import type {AikitWriteRequest} from '../../../../../desktop/cradle/src/kernel/types'

/** The plan as AIKit names it. */
export interface AikitAdoptionPlan {
  /** The root AIKit surveyed, as it resolved it. */
  readonly source: string
  readonly namespace: string
  /** The capsules it adopts (`skill/<namespace>/<name>`). */
  readonly capsules: readonly string[]
  /** What `--yes --expect-digest` confirms. */
  readonly reviewDigest: string
}

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/** AIKit's plan, or null when the answer is not a plan to confirm (an applied adoption, a refusal, another shape). Pure. */
export function aikitAdoptionPlan(answer: unknown): AikitAdoptionPlan | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null
  const plan = answer as Record<string, unknown>
  if (plan.applied !== false || !text(plan.source) || !text(plan.namespace) || !text(plan.review_digest)) return null
  if (!Array.isArray(plan.capsules) || !plan.capsules.every(text)) return null
  return {source: plan.source, namespace: plan.namespace, capsules: [...plan.capsules], reviewDigest: plan.review_digest}
}

/** The confirmation of exactly this plan (the kernel's aikit_write adopt: `aikit adopt SOURCE --namespace N --expect-digest REVIEW --yes`). */
export function aikitAdoptRequest(plan: AikitAdoptionPlan): Extract<AikitWriteRequest, {kind: 'adopt'}> {
  return {kind: 'adopt', root: plan.source, namespace: plan.namespace, expect_digest: plan.reviewDigest}
}
