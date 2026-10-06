/**
 * The Expression layer, as the essay build sees it.
 *
 * site/build-essay-quartz.mjs plans the curated Expression collection (essay-expressions.mjs) and writes its index
 * to `.generated/expressions.json`, naming this file in OI_ESSAY_EXPRESSIONS. Each member lists the essay pages it is
 * about; this reads that once and answers the other way round: which Expressions does a page have. A missing index is
 * an essay without the layer, not a failed build.
 */
import fs from "fs"
import path from "path"

export interface ExpressionMember {
  id: string
  title: string
  summary: string
  collection: string
  group: string
  scenes: { id: string; name: string; character: string }[]
  nodes: string[]
  cover: string
}
export interface ExpressionLayer {
  members: ExpressionMember[]
  byPage: Map<string, ExpressionMember[]>
}

let cached: ExpressionLayer | undefined
export function expressionLayer(): ExpressionLayer {
  if (cached) return cached
  const file = process.env.OI_ESSAY_EXPRESSIONS || path.join(process.cwd(), ".generated", "expressions.json")
  const members: ExpressionMember[] = []
  try {
    const index = JSON.parse(fs.readFileSync(file, "utf8"))
    if (index.schema === "oi.essay-expressions/v1") members.push(...index.entries)
  } catch {
    /* no layer */
  }
  const byPage = new Map<string, ExpressionMember[]>()
  for (const m of members) for (const slug of m.nodes) byPage.set(slug, [...(byPage.get(slug) ?? []), m])
  return (cached = { members, byPage })
}
