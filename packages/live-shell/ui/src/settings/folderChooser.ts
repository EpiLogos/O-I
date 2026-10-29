/** The system's own folder chooser, in the native host: the main window's `choose_central_folder` route (desktop/cradle/src-tauri
 * ground_dialog.rs, allowed by capabilities/main-window.json), the one the cradle's ground chooser already presses (GroundChooser.tsx).
 * Setup's Ground step chooses the folder a new ground goes in with it (manual §10.11), and the browser's Work place its Add folder….
 * The chooser only selects: what the folder is, and what is made of it, are its owners' readings and Accepts. */

/** Why a window that is not the native host has no folder chooser. */
export const NO_NATIVE_FOLDER_CHOOSER = 'The system\'s folder chooser is the native app\'s: this window (the development browser) has none. Type the folder\'s path instead.'

/** Whether this window is the native host's (the Tauri webview), which carries the folder chooser. */
export const nativeFolderChooser = (): boolean => typeof window !== 'undefined' && !!(window as unknown as {__TAURI_INTERNALS__?: unknown}).__TAURI_INTERNALS__

/** The folder the person chooses in the system's chooser, or null when they cancel. Refused, in words, outside the native host. */
export async function chooseFolder(): Promise<string | null> {
  if (!nativeFolderChooser()) throw new Error(NO_NATIVE_FOLDER_CHOOSER)
  const {invoke} = await import('@tauri-apps/api/core')
  const picked = await invoke<string | null>('choose_central_folder')
  return typeof picked === 'string' && picked.trim() ? picked : null
}
