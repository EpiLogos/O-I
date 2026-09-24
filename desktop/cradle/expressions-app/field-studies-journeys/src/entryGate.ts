import {esc} from './icons.js';

export interface EntryGateOptions {
  hasContinue: boolean;
  continueLabel?: string;
  hasNative?: boolean;
}

/** New / Continue / Open — creation-first front door. Modes/starters stay secondary. */
export function entryGateHTML(options: EntryGateOptions): string {
  const continueLabel = options.continueLabel?.trim() || 'Continue last work';
  return `<section class="entry-gate-card" aria-labelledby="entry-gate-title">
 <p class="eyebrow">EXPRESSIONS</p>
 <h1 id="entry-gate-title">Start an Expression</h1>
 <p class="entry-gate-lede">Place material, shape it, sequence scenes, then save. The living field is the body.</p>
 <div class="entry-gate-actions">
  <button type="button" class="primary" data-action="entry-new">New blank Expression</button>
  <button type="button" data-action="entry-continue" ${options.hasContinue ? '' : 'disabled'}>${esc(continueLabel)}</button>
  <button type="button" data-action="entry-open">Open Library</button>
  ${options.hasNative ? '<button type="button" data-action="entry-open-native">Open native Expression</button>' : ''}
 </div>
 <p class="entry-gate-standing">Browser draft ≠ saved Scene ≠ committed native Expression ≠ saved native file ≠ publication.</p>
 <div class="entry-gate-starters">
  <p>Optional starters — editable starting material, not application modes.</p>
  <button type="button" data-action="entry-starter-mark">Start from the O:I mark</button>
  <button type="button" data-action="entry-dismiss">Continue into the open field</button>
 </div>
</section>`;
}
