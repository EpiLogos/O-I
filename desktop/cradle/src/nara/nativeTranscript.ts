/** The native transcript's serializable block, with no renderer transport dependency. */
interface NativeBlock {id: number; kind: string; text: string}
export interface NativeTextRun extends NativeBlock {blockIds: number[]}

/** Native view storage splits long text into bounded blocks. Rejoin only
 * adjacent text from the same speaker; tools and terminal markers stay exact
 * boundaries. Every original block id remains available for attribution. */
export function nativeTextRuns(blocks: readonly NativeBlock[]): NativeTextRun[] {
  const runs: NativeTextRun[] = [];
  for (const block of blocks) {
    const previous = runs[runs.length - 1];
    if ((block.kind === 'user' || block.kind === 'assistant') && previous?.kind === block.kind) {
      previous.text += block.text;
      previous.blockIds.push(block.id);
    } else runs.push({...block, blockIds: [block.id]});
  }
  return runs;
}
