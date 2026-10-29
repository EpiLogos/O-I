// The Expressions application's panel (panels/expressions.tsx), registered with the shell's first frame and loaded when the centre
// first shows it — Expressions' centre, or Live's torus over it (O-I #740: a mode loads when first entered). Until it arrives its
// place shows the shell's waiting line (shell/loadWhenDrawn.ts). The Factory pane's Expressions kind is admitted here, at once, as the
// panel module admitted it before, so a pane restored with the world finds its kind; its body loads when the pane opens.
import {registerPanel, type PanelContext} from '../shell/panels'
import {loadWhenDrawn} from '../shell/loadWhenDrawn'
import {registerExpressionsPaneHost} from '../projections/expressionsPaneRegistration'

const ExpressionsPanel = loadWhenDrawn<PanelContext>('Expressions', () => import('./expressions').then(module => module.ExpressionsPanel))

registerPanel({id: 'world.expressions', title: 'Expressions', slot: 'center', component: ExpressionsPanel,
  order: 10, note: 'The native Expressions application and its deep instruments over one retained document'})
registerExpressionsPaneHost()
