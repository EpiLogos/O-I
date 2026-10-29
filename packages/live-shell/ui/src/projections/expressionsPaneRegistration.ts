// The `projection.expressions` pane kind's admission (T-EXPRESSIONS-PANE-LEASE), light: the Expressions pane body
// (projections/expressionsPane.tsx mountExpressionsPane) loads when a pane of the kind first opens, never with the shell's first frame
// (O-I #740); until it mounts the pane says what it waits for (shell/loadWhenDrawn.ts mountWhenOpened). Admitted with the shell's panels
// (panels/expressionsPanel.ts) and again, idempotently, by the centre's panel module that owns the one hosted frame.
import {registerProjectionModule} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {mountWhenOpened} from '../shell/loadWhenDrawn'

export const EXPRESSIONS_MODULE_ID = 'expressions-hosted-presenter'

let registered = false

/** Admit the Expressions body for the `projection.expressions` pane kind. Idempotent. */
export function registerExpressionsPaneHost(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: EXPRESSIONS_MODULE_ID, kind: 'projection.expressions',
    create: mountWhenOpened('Expressions', () => import('./expressionsPane').then(module => (context: {element: HTMLElement; binding: {id: string}}) =>
      module.mountExpressionsPane(context.element, context.binding.id)))})
}
