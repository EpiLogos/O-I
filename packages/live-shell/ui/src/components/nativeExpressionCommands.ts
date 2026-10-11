import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor';

/** Pure models for the Expressions file and library commands in the shell. The
 * transport bar and the Expressions browser make the owner calls; this module
 * decides what is offered, why an action is not, and what a reply may claim. */

export interface SaveInput {
  /** The retained editor is attached to the presented Expression. */
  attached: boolean;
  busy: boolean;
  standing: {dirty: boolean; pending: boolean} | null;
}
export interface SaveState {disabled: boolean; reason: string | null}

/** Save commits the working edit to the native Expression: the owner's `save`
 * operation (hostEditor.ts commit). A saved native file is a separate act and
 * is not offered here. */
export function saveState(input: SaveInput): SaveState {
  if (!input.attached || !input.standing) return {disabled: true, reason: 'No native Expression is open to save.'};
  if (input.busy || input.standing.pending) return {disabled: true, reason: 'The native owner is still answering the last request.'};
  if (!input.standing.dirty) return {disabled: true, reason: 'Nothing to save: this Expression matches the native owner.'};
  return {disabled: false, reason: null};
}

/** "Saved" is said only when the owner's own reading reports a clean draft after a successful save. */
export function saveNotice(reply: Extract<NativeEditorReply, {ok: true}>): string {
  return reply.reading.standing.dirty
    ? 'The native owner answered, but this draft still differs from it. Nothing is marked saved.'
    : 'Saved to the native Expression.';
}

export type CollectionGroup = 'Featured' | 'Material' | 'Composition' | 'Native' | 'Source studies';
export interface CollectionItem {id: string; name: string; description: string; group: CollectionGroup}
export interface CollectionRow {id: string; name: string; description: string; open: {disabled: true; reason: string}}
export interface CollectionSection {id: 'featured' | 'starters' | 'presets'; title: string; rows: CollectionRow[]}

/** Opening any built-in or featured Expression creates a fork. The fork needs the
 * native save_as owner operation, which the shell cannot call. */
export const FORK_REASON = 'Opening this creates a fork, and the fork needs the native save_as owner operation, which the shell cannot call.';

/** The app's own groups (expressions.ts startingPoints and featuredExpressions).
 * Starters are the starting material; presets are the built-in compositions and
 * factory configurations. */
export function collectionSections(items: readonly CollectionItem[], query: string): CollectionSection[] {
  const needle = query.trim().toLocaleLowerCase();
  const section = (id: CollectionSection['id'], title: string, groups: readonly CollectionGroup[]): CollectionSection => ({id, title,
    rows: items.filter(item => groups.includes(item.group) && (!needle || `${item.name} ${item.description}`.toLocaleLowerCase().includes(needle)))
      .map(item => ({id: item.id, name: item.name, description: item.description, open: {disabled: true, reason: FORK_REASON}}))});
  return [section('featured', 'Featured', ['Featured']), section('starters', 'Starters', ['Material', 'Source studies']),
    section('presets', 'Built-in presets', ['Composition', 'Native'])];
}

/** Shell help copy. The quick guide is the app's own text (field-studies-journeys/src/shell.ts, the guide dialog). */
export const QUICK_GUIDE: readonly {heading: string; text: string}[] = [
  {heading: 'Shape the setup', text: 'Place a formation. Edit its glyph sequence on the left. Use the framed image icon at top right to create image or ASCII states. Pin useful controls to the expression’s shared toolbelt on the right.'},
  {heading: 'Save a scene', text: 'Open Scenes, give this setup a name, then Save scene. This fixes a saved version of its settings, formations and camera. Later edits remain a draft until you save again.'},
  {heading: 'Make the next scene', text: 'Save & make next copies this setup. Tweak the copy; your previous saved scene stays intact. In Formation sequence, “Add state to earlier scene” folds a refined object back into a sequence. Set duration and the incoming transition, then save.'},
  {heading: 'Play and keep the expression', text: 'Play saved scenes in order. Glyph sequences run inside each scene. The library keeps browser drafts in this browser; a saved Scene is not yet a committed native Expression. Export JSON or living HTML for a portable copy; commit/save native separately when hosted.'},
];
export const QUICK_GUIDE_STANDING = 'Browser draft ≠ saved Scene ≠ committed native Expression ≠ saved native file ≠ publication.';

/** The shortcuts the shell binds, each with the handler that binds it. */
export const BOUND_SHORTCUTS: readonly {keys: string; action: string; source: string}[] = [
  {keys: 'Space', action: 'Play or pause the working Scene, when no control has focus', source: 'NativeTransportBar.tsx'},
  {keys: 'Ctrl or ⌘ S', action: 'Save the open Expression to the native owner', source: 'NativeTransportBar.tsx'},
  {keys: '← → ↑ ↓ Home End', action: 'Seek the working Scene on the position slider (Shift steps 1 s)', source: 'NativeTransportBar.tsx'},
  {keys: 'Tab', action: 'Switch Session and Arrangement in the Expressions, session and arrangement views, outside text fields', source: 'App.tsx'},
  {keys: '⌘ Option B', action: 'Show or hide the browser', source: 'App.tsx'},
  {keys: '⌘ Option L', action: 'Show or hide the detail panel', source: 'App.tsx'},
  {keys: '⌘ ,', action: 'Open Preferences', source: 'App.tsx'},
  {keys: '↑ ↓ Home End', action: 'Move between browser rows; Esc clears the browser search', source: 'WorldBrowser.tsx'},
  {keys: 'Space, then Enter', action: 'Preview a saved work, then open it', source: 'WorldBrowser.tsx'},
];

/** About copy, from the app's About section (expressions.ts libraryHTML). */
export const ABOUT = {
  title: 'A field to inhabit. A space to compose.',
  lede: 'Place, shape, relate, animate, capture. An expression holds the whole composition: its scenes, material, relationships and passage through time.',
  living: 'The native GPU engine carries persistent particles through shared forces, local sequences and continuous resonance. Selecting an object inspects it; it does not tune the field.',
  editable: 'Every starting point opens as editable composition data. Branch an expression, change its entities, or shape a completely different performance.',
  kept: 'Browser draft / autosave stays in this browser. A saved Scene is a named composition snapshot. A committed native Expression and a saved native file are separate durable acts. Publication is another step again.',
};
