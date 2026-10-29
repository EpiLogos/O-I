/** The system's own folder chooser, in the native host: the main window's `choose_folder` route (desktop/cradle/src-tauri
 * ground_dialog.rs, allowed by capabilities/main-window.json), titled by its purpose — where a new ground goes (Setup's Ground step,
 * manual §10.11) and a folder of work to bring in (the browser's Work place, Add folder…). The chooser only selects: what the folder
 * is, and what is made of it, are its owners' readings and Accepts. */

/** Why a window that is not the native host has no folder chooser. */
export const NO_NATIVE_FOLDER_CHOOSER = 'The system\'s folder chooser is the native app\'s: this window (the development browser) has none. Type the folder\'s path instead.'

/** Whether this window is the native host's (the Tauri webview), which carries the folder chooser. */
export const nativeFolderChooser = (): boolean => typeof window !== 'undefined' && !!(window as unknown as {__TAURI_INTERNALS__?: unknown}).__TAURI_INTERNALS__

/** What a folder is chosen for: where a new ground goes, or a folder of work to bring in. */
export type FolderPurpose = 'ground' | 'work'
/** The folder the person chooses in the system's chooser, or null when they cancel. Refused, in words, outside the native host. */
export async function chooseFolder(purpose: FolderPurpose): Promise<string | null> {
  if (!nativeFolderChooser()) throw new Error(NO_NATIVE_FOLDER_CHOOSER)
  const {invoke} = await import('@tauri-apps/api/core')
  const picked = await invoke<string | null>('choose_folder', {purpose})
  return typeof picked === 'string' && picked.trim() ? picked : null
}
