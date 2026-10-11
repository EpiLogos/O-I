/** Workcell's native declaration and connection receipt, not a reachability model.
 * Source: workcell-control/machines.rs and workcell-wire/connection.rs. */
import type { ScopeAddress } from './adapter'
export interface RemoteMachineDeclaration {
  label: string; endpoint: string; credential_ref: string | null; operations: string[]; note: string | null
}
export interface MachineConnection {
  connection_ref: string; label: string; endpoint: string; protocol: string
  remote_workcell_ref: string | null; remote_software: string | null; local_software: string
  granted_operations: string[]; credential_ref: string | null
  state: 'connected' | 'disconnected' | 'refused' | 'incompatible'
  detail: string | null; connected_at_unix_ms: number | null; expires_at_unix_ms?: number | null
  last_reconciled_at_unix_ms: number; provenance: Record<string, string>
}
export interface MachineOperationResult {
  status: 'acknowledged' | 'pending' | 'refused' | 'failed'
  /** Native adapter must redact credential material before returning a message. */
  message: string
}
/** Additive receiving surface over existing Workcell CLI operations. Scope is
 * the actual workcell/state-root owner; declarations do not inherit globally. */
export interface RemoteMachinesSource {
  scope: ScopeAddress
  allowedOperations: readonly string[]
  readMachines(): Promise<RemoteMachineDeclaration[]>
  readConnections(): Promise<MachineConnection[]>
  add(declaration: RemoteMachineDeclaration): Promise<MachineOperationResult>
  connect(label: string): Promise<MachineOperationResult>
  disconnect(label: string): Promise<MachineOperationResult>
  remove(label: string): Promise<MachineOperationResult>
}
export function validateMachine(value: RemoteMachineDeclaration, allowed: readonly string[], existing: readonly RemoteMachineDeclaration[]): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!value.label || !/^[A-Za-z0-9._-]+$/.test(value.label) || value.label === 'grants') errors.label = 'Use letters, digits, dots, hyphens or underscores. “grants” is reserved.'
  else if (existing.some(row => row.label === value.label)) errors.label = 'This label is already declared. Choose a different label.'
  if (!value.endpoint || /\s/.test(value.endpoint)) errors.endpoint = 'Enter the control endpoint as HOST:PORT, without spaces.'
  else if (!/^(?:\[[^\]]+\]|[^:]+):[0-9]+$/.test(value.endpoint)) errors.endpoint = 'Include a host and port, for example host.example:7777.'
  else { const port = Number(value.endpoint.slice(value.endpoint.lastIndexOf(':') + 1)); if (!Number.isInteger(port) || port < 1 || port > 65535) errors.endpoint = 'Use a port from 1 to 65535.' }
  if (value.credential_ref && !/^(keychain:\/\/|linux-secret-service:\/\/)/.test(value.credential_ref)) errors.credential_ref = 'Choose a keychain:// or linux-secret-service:// reference. Do not enter a token.'
  if (value.operations.some(operation => !allowed.includes(operation))) errors.operations = 'An operation is no longer offered by this Workcell.'
  if (new Set(value.operations).size !== value.operations.length) errors.operations = 'Choose each operation once.'
  return errors
}
/** Stable comparison of the native fields consumed by an operation. */
export function machineBasis(rows: readonly RemoteMachineDeclaration[]): string {
  return JSON.stringify([...rows].sort((a,b) => a.label.localeCompare(b.label)).map(row => [row.label,row.endpoint,row.credential_ref,[...row.operations].sort(),row.note]))
}
export function connectionBasis(row?: MachineConnection): string {
  return row ? JSON.stringify([row.connection_ref,row.label,row.endpoint,row.state,row.last_reconciled_at_unix_ms,row.expires_at_unix_ms??null,[...row.granted_operations].sort()]) : 'absent'
}
