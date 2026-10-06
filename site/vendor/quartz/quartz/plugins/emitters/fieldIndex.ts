import { FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { fieldModel, REGS, STATIONS } from "../../util/essayField"
import { expressionLayer } from "../../util/expressionIndex"

/**
 * `static/fieldIndex.json` — the essay's structure, links and explorer tree.
 * Everything the browser needs to draw the graph, explorer, search results and
 * footer breadcrumbs, without the 12 MB full-text index (which only search reads,
 * and only when it is first used).
 */
export const FieldIndex: QuartzEmitterPlugin = () => ({
  name: "FieldIndex",
  async *emit(ctx, content) {
    const model = fieldModel(content.map(([, file]) => file.data))
    // pages that have an Expression say which (ids; the gallery fetches the full index when it opens)
    const layer = expressionLayer()
    const x: Record<number, string[]> = {}
    for (const n of model.nodes) { const ms = layer.byPage.get(n.s); if (ms?.length) x[n.i] = ms.map((m) => m.id) }
    const payload = {
      v: 1,
      regs: REGS,
      stations: STATIONS,
      nodes: model.nodes,
      links: model.links,
      rooms: model.rooms,
      moves: model.moves,
      tree: model.tree,
      x,
    }
    yield write({
      ctx,
      content: JSON.stringify(payload),
      slug: joinSegments("static", "fieldIndex") as FullSlug,
      ext: ".json",
    })
  },
  async *partialEmit() {},
})
