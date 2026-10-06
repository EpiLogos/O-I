/* The essay reader: structure, search, graph, tabs and reading position, bound to Quartz's page lifecycle.
   Each page turn replaces the markup, so everything is mounted from scratch on `nav` and unmounted on the
   next one; what must outlive a turn (tabs, open folders, the full-text index) lives in module state. */
import { D, loadModel, resetMount, S } from "./field/core"
import { mountExplorer } from "./field/explorer"
import { mountSearch } from "./field/search"
import { mountReader } from "./field/reader"
import { mountGraph } from "./field/graph"
import { mountTabs } from "./field/tabs"
import { mountLibrary } from "./field/library"
import { mountShell } from "./field/shell"

document.addEventListener("nav", async () => {
  await loadModel()
  resetMount()
  window.addCleanup(resetMount)
  const root = document.getElementById("quartz-root")
  if (!root) return
  S.cur = S.cur || { i: null, m: null, h: null }
  // order matters: the reader and the graph listen for the first locus that the tabs emit
  mountExplorer()
  mountSearch()
  mountShell()
  mountReader()
  mountGraph()
  mountLibrary()
  mountTabs()
  ;(window as any).OI = Object.assign((window as any).OI ?? {}, { D, S })
  document.body.dataset.ready = "1"
})
