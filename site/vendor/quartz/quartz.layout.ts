import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

/**
 * The essay's reading layout: Quartz's own anatomy — left sidebar (title · search · explorer),
 * centre (head · article · footer), right sidebar (graph · contents · connections) — redesigned so
 * the right sidebar is a first-class view of the field. See site/redesign-materials/essay-projection-mockup
 * for the approved mockup this is ported from.
 */

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.FieldHead()],
  afterBody: [Component.Pager()],
  // the centre's footer carries the breadcrumbs
  footer: Component.FieldFoot(),
}

const left = () => [Component.FieldTitle(), Component.FieldSearch(), Component.FieldExplorer()]
const right = () => [Component.FieldGraph(), Component.FieldContents(), Component.FieldConnections()]

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [Component.ArticleHead()],
  left: left(),
  right: right(),
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle()],
  left: left(),
  right: right(),
}
