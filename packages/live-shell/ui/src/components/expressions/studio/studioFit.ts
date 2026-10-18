// The Studio's columns fit the detail row by the plate's own fold (frame/devices/plateFit.ts, where the fold law now stands for every
// plate: a column folds to its title as the runtime's strip — manual §10.4 "A device can also fold down to its title. Click the title
// to open it again"; the mockup's .ifold). Capture is the plate's last column and the one that says where an export landed: while the
// row is wider than it shows, the columns before it fold to their titles from the one nearest it back toward Tools, until Capture
// stands in view. The person's own folds and opens always hold. Pure: nothing here touches the page.
import {foldsToFit as plateFoldsToFit, pressFold, sameSet, type FitInput as PlateFitInput} from '../../../frame/devices/plateFit'

/** The columns that may fold to make room, in the order they fold: the Studio's chains from the last (the holder table's, semantics.ts
 * STUDIO_SECTIONS; R4 drew the Studio as its design, whose Chains page lists them, and its old eight columns left). */
export const STUDIO_FOLD_ORDER = ['studio:nara', 'studio:body', 'studio:motion', 'studio:material'] as const

export type FitInput = Omit<PlateFitInput, 'order'> & {readonly order?: readonly string[]}

/** The columns that stand folded: the person's own, then as few of the fold order (the Studio's own when absent) as bring the row
 * within its width. */
export const foldsToFit = ({order = STUDIO_FOLD_ORDER, ...input}: FitInput): Set<string> => plateFoldsToFit({...input, order})

export {pressFold, sameSet}
