// The native menu bar's commands (manual §10.9: every command has one home in the menu bar; desktop/cradle/src-tauri/src/menus.rs).
// The host emits each item's id as `oi:command`; the frame (App.tsx) routes it. An Edit or Create item acts on the selection of the
// view that stands, through that view's object acts (frame/menu/TracksMenu.tsx publishes them here); a View item is the view keys'
// own (shell/workspaceAreas.ts); Undo and Redo are the undo list's (frame/menu/undo.ts), or the text field's own while one holds the
// focus. Pure TypeScript.

/** The menu bar's item ids and what each is. The host's menu (menus.rs) carries the same ids. */
export const MENU_COMMANDS = {
  'edit.undo': 'Undo', 'edit.redo': 'Redo', 'edit.duplicate': 'Duplicate', 'edit.delete': 'Delete', 'edit.rename': 'Rename',
  'create.clip': 'Insert Clip', 'create.row': 'Insert Row',
  'view.session': 'Session View', 'view.arrangement': 'Arrangement View', 'view.pane': 'Pane View', 'view.browser': 'Browser', 'view.pool': 'Pool',
  'view.rail': 'Widget Rail', 'view.clip': 'Clip View', 'view.device': 'Device View', 'view.detail': 'Hide or Restore Clip and Device Views',
  'view.expand-clip': 'Expand Clip View', 'view.mixer': 'Mixer', 'view.io': 'In/Out', 'app.settings': 'Settings…',
  // The field's (manual §20.1, O-I #747): the frame hands each to the mode that stands (App.tsx MENU_ACT); Expressions answers them.
  'view.present': 'Present', 'view.grid': 'Grid', 'view.snap': 'Snap', 'view.guides': 'Guides', 'view.flat': '2D', 'view.depth': '3D', 'view.face-plane': 'Face Plane',
  'file.export.picture': 'Export Picture…', 'file.export.film': 'Export Film', 'file.export.json': 'Export Expression JSON',
  'file.export.html': 'Export Living HTML', 'file.export.native': 'Export Native Configuration',
} as const
export type MenuCommand = keyof typeof MENU_COMMANDS

/** The object act an Edit or Create item runs on the selection (frame/menu/objectActions.ts ids). Pure. */
export const OBJECT_ACT_OF: Partial<Readonly<Record<MenuCommand, string>>> = {
  'edit.duplicate': 'duplicate', 'edit.delete': 'delete', 'edit.rename': 'rename', 'create.clip': 'insert', 'create.row': 'insert',
}

let objectCommands: ((act: string) => boolean)[] = []

/** A view that stands publishes how it runs an act on its selection; the returned function withdraws it. */
export function publishObjectCommands(run: (act: string) => boolean): () => void {
  objectCommands = [...objectCommands, run]
  return () => { objectCommands = objectCommands.filter(entry => entry !== run) }
}

/** Run an object act on the selection of whichever view stands; true when one ran it. */
export function runObjectCommand(act: string): boolean {
  for (const run of objectCommands) if (run(act)) return true
  return false
}
