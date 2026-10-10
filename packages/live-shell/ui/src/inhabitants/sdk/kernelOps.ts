/** The kernel's op union and the known native-owner tools, GENERATED
 * from desktop/cradle/src/kernel/types.ts (export type KernelOp) by
 * scripts/sync-kernel-ops.mjs — regenerate, never hand-edit. This is the
 * writer-membership law's registry: a `kernel:<op>` write path must name
 * one of these ops; a `<tool>:<command>` path must name one of these
 * tools. Drift is gated by tests/device-sdk.test.mjs — against the
 * WORKING TREE (the kernel the shell actually runs against); while a lane
 * carries an uncommitted kernel-op addition, the generated module carries
 * it too and a fresh HEAD checkout regenerates it identically only after
 * that lane lands.
 *
 * Pure: no view, no store, no I/O. */

export const KERNEL_OPS = [
  'file_last_reading',
  'dictation_read',
  'dictation_configure',
  'dictation_probe',
  'dictation_transcribe',
  'decision_read',
  'decision_preflight',
  'decide',
  'decision_episode_revoke',
  'git_repository_read',
  'git_diff_read',
  'presentation_read',
  'presentation_observe',
  'theme_import',
  'theme_apply',
  'theme_revert',
  'theme_remove',
  'nara_decision_record',
  'nara_epii',
  'nara_expressive_act',
  'nara_current',
  'nara_presence',
  'nara_coordinate',
  'nara_identity',
  'nara_voice',
  'nara_dialogue',
  'being_encounter',
  'hosted_native',
  'expression',
  'expression_recovery',
  'graph',
  'shared_field',
  'ground',
  'composition_read',
  'system_composition_read',
  'working_surface_read',
  'working_surface_attachment',
  'recording_capability_read',
  'protocol_read',
  'harness_agent_read',
  'harness_agent_control',
  'file_operation',
  'encounter',
  'encounter_provision',
  'flow_participant_provision',
  'encounter_task_read',
  'receiving',
  'now',
  'factory_development_read',
  'factory_build_snapshot',
  'factory_attempt_read',
  'factory_attempt_task_list_read',
  'factory_attempt_task_read',
  'factory_owner',
  'workcell_status_read',
  'temporal_events_read',
  'inhabitation_read',
  'wiki_projection_read',
  'wiki_projection_sources',
  'harness_status',
  'model_catalogue',
  'chat_default_read',
  'chat_default_hold',
  'chat_default_discard',
  'credential_list',
  'credential_discover',
  'credential_setup',
  'credential_rotate',
  'credential_verify',
  'credential_revoke',
  'harness_auth_describe',
  'client_install',
  'product_action_run',
  'settings_reveal',
  'config_diff',
  'central',
  'day_read',
  'day_source_open',
] as const

export type KernelOpName = (typeof KERNEL_OPS)[number]

export function isKernelOp(candidate: string): candidate is KernelOpName {
  return (KERNEL_OPS as readonly string[]).includes(candidate)
}

export const KNOWN_TOOLS = [
  'workcell-cli',
  'ctrl',
  'aikit',
  'oi',
] as const

export type KnownTool = (typeof KNOWN_TOOLS)[number]

export function isKnownTool(candidate: string): candidate is KnownTool {
  return (KNOWN_TOOLS as readonly string[]).includes(candidate)
}
