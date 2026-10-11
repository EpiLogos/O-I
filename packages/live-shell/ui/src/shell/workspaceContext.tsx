import {createContext, useContext, type ReactNode} from 'react'
import type {WorkspaceReading} from './workspaceTypes'

export const Workspace = createContext<WorkspaceReading | null>(null)

export function useWorkspace() {
  const workspace = useContext(Workspace)
  if (!workspace) throw Error('The shell workspace provider is absent')
  return workspace
}

export function StubWorkspaceProvider({
  children,
  transport,
}: {
  children: ReactNode
  transport: WorkspaceReading['transport']
}) {
  const value = {
    workspaceId: 'agent-shell-fixture',
    resources: null,
    residency: null,
    accessEpoch: 1,
    accessReady: true,
    nativeScope: null,
    nativeAccessCurrent: () => true,
    attachNativeAccess: () => {},
    sourceError: null,
    sourceRecoveryReady: true,
    sourceReadingCurrent: true,
    prepareSource: () => '',
    publishSource: () => {},
    browserPath: '',
    navigateFiles: () => {},
    nativeWorks: [],
    publishWorks: () => {},
    expressionToOpen: null,
    requestExpression: () => {},
    mode: 'expressions',
    setMode: () => {},
    transport,
    attachTransport: () => {},
    reading: {document: {name: 'Agent sessions'}},
    publishReading: () => {},
    editor: null,
    attachEditor: () => {},
    editorReading: null,
    publishEditorReading: () => {},
    receipts: [],
    publishReceipts: () => {},
    revalidateSource: async () => true,
    selectedSource: null,
    selectedRef: null,
    selectSource: () => {},
  } as unknown as WorkspaceReading
  return <Workspace.Provider value={value}>{children}</Workspace.Provider>
}
