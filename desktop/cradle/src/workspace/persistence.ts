export interface WorkspaceStorage {
  setItem(key: string, value: string): void;
}

/** Serialize the ref at the moment of the lifecycle callback, not a captured render. */
export function serializeLatestWorkspace<T>(book: T): string {
  return JSON.stringify(book);
}

export function persistLatestWorkspace<T>(book: { current: T }, storage: WorkspaceStorage, key: string): void {
  storage.setItem(key, serializeLatestWorkspace(book.current));
}
