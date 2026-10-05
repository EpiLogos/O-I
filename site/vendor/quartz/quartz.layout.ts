import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Recovered from the saved September reader follow-on: display names only.
const readingExplorer = () => Component.Explorer({
  mapFn: (node) => {
    if (node.isFolder) node.displayName = node.displayName.replace(/^\d{2}-/, "").replace(/-/g, " ")
    else node.displayName = node.displayName.replace(/^§[^ ]+ · /, "")
  },
})

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.FadeToggles()],
  afterBody: [],
  footer: Component.Footer({
    links: {
      "Objective : Internality": "/",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ rootName: "Essay", showCurrentPage: false }),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.EssayAnchor(),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.slug !== "index",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    readingExplorer(),
  ],
  right: [
    Component.Graph(),
    Component.TableOfContents(),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs({ rootName: "Essay", showCurrentPage: false }), Component.EssayAnchor(), Component.ArticleTitle()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    readingExplorer(),
  ],
  right: [Component.Graph()],
}
