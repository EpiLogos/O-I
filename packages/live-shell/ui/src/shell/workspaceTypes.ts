import type {HostedAppState} from '@epilogos/expressions-boundary'
import type {KernelReceipt, KernelTransportStatus, NativeFileReading} from '@epilogos/expressions-boundary/cradle'
import type {NativeEditorController, NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import type {ContinuityResidency, ContinuityResources, FileResourceAccess, ResourceIntent} from '../continuity'
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/location'
import type {FileResourceScope} from '../../../../../desktop/cradle/src/files/resources'

/**
 * The spine's CUT reading — audio (Live) versus the native body's cuts
 * (Expressions, Technē). The Rev-5 modes (Base·Central, Factory) ride the
 * continuity ShellMode above this: Base·Central is the Central world context
 * over the audio cut, Factory presents the agency surface on the Expressions
 * cut. This narrow union is what the native consumers key on; the frame's
 * mode system composes on top of it (modeGrammar.ts).
 */
export type WorkspaceMode = 'audio' | 'expressions' | 'techne'

/** Presentation readings of native work. This context never owns or saves a document. */
export interface WorkspaceReading {
  workspaceId: string
  resources: ContinuityResources
  residency: ContinuityResidency
  accessEpoch: number
  accessReady: boolean
  readonly nativeScope: Readonly<FileResourceScope> | null
  nativeAccessCurrent: (epoch: number) => boolean
  attachNativeAccess: (access: FileResourceAccess | null) => void
  sourceError: string | null
  sourceRecoveryReady: boolean
  sourceReadingCurrent: boolean
  prepareSource: (location: CentralLocation) => string
  publishSource: (source: NativeFileReading, intent: ResourceIntent) => void
  browserPath: string
  navigateFiles: (path: string) => void
  nativeWorks: readonly {expression_ref: string; title: string; revision: number}[]
  publishWorks: (works: readonly {expression_ref: string; title: string; revision: number}[]) => void
  expressionToOpen: {ref: string; request: number} | null
  requestExpression: (ref: string) => void
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
  transport: KernelTransportStatus
  attachTransport: (transport: KernelTransportStatus) => void
  reading: HostedAppState | null
  publishReading: (reading: HostedAppState | null) => void
  editor: NativeEditorController | null
  attachEditor: (editor: NativeEditorController | null) => void
  editorReading: NativeEditorReading | null
  publishEditorReading: (reading: NativeEditorReading | null) => void
  receipts: readonly KernelReceipt[]
  publishReceipts: (receipts: readonly KernelReceipt[]) => void
  revalidateSource: (invalidate?: boolean) => Promise<boolean>
  selectedSource: NativeFileReading | null
  selectedRef: string | null
  selectSource: (source: NativeFileReading | null) => void
}
