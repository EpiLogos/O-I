// Run-in-Expressions walk (O:I #220 presentation lane): compose a
// `oi.expression/v1` document from the owner's own Factory readings and
// verify the SSSF structure survives verbatim — every node kind, every edge
// kind, declared barriers, attempt verifications, the readable Return, and
// disclosed actions that keep their native authority.
// Usage: node walk/factory-run-expression.mjs <factory-bin> <state-path> <run-ref>
import {readFile} from "node:fs/promises"
import {spawnSync} from "node:child_process"
import ts from "typescript"

const [factoryBin, statePath, runRef] = process.argv.slice(2)
if (!factoryBin || !statePath || !runRef) {
  throw new Error("usage: node walk/factory-run-expression.mjs <factory-bin> <state-path> <run-ref>")
}
const checks = []
const check = (name, ok, detail="") => { checks.push({name, ok, detail}); if (!ok) throw new Error(`check failed: ${name} ${detail}`) }

const runSh = spawnSync(factoryBin, ["development", "run", statePath, runRef, "--json"], {encoding:"utf8"})
if (runSh.status !== 0) throw new Error(runSh.stderr || runSh.stdout || "factory development run failed")
const unitsSh = spawnSync(factoryBin, ["development", "workflow-units", statePath, runRef, "--json"], {encoding:"utf8"})
if (unitsSh.status !== 0) throw new Error(unitsSh.stderr || unitsSh.stdout || "factory development workflow-units failed")
const attemptSh = spawnSync(factoryBin, ["attempt", "read", statePath, runRef, "--json"], {encoding:"utf8"})
const run = JSON.parse(runSh.stdout), units = JSON.parse(unitsSh.stdout)
let attempt
let attemptsSkipped = null
if (attemptSh.status === 0) { attempt = JSON.parse(attemptSh.stdout) }
else {
  const refusal = String(attemptSh.stderr || attemptSh.stdout || "")
  if (!refusal.includes("no native attempt field")) throw new Error(refusal || "factory attempt read failed")
  // Honest refusal for attempt-less runs: compose topology-only and name it.
  attemptsSkipped = refusal.trim().split("\n")[0]
}
if (attempt && attempt.contract !== "factory.attempt-reading/v1") throw new Error("incompatible attempt reading: " + attempt.contract)

check("run reading contract", run.contract === "factory.run-reading/v1", run.contract)
check("attempt reading contract", !attempt || attempt.contract === "factory.attempt-reading/v1", attempt?.contract ?? "absent (attempt-less run)")
check("unit list contract", units.contract === "factory.workflow-unit-list-reading/v1", units.contract)

const transpile = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), "utf8")
  // The data-URL module cannot resolve relative imports; the transport
  // helpers are not exercised here (this walk runs the owner CLI directly),
  // so the import is stubbed for this probe only.
  const stubbed = source.replace(/import \{ *developmentRead *, *attemptRead *\} *from *"\.\/development";/, "const developmentRead = undefined, attemptRead = undefined")
  const js = ts.transpileModule(stubbed, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  return (await import("data:text/javascript," + encodeURIComponent(js)))
}
const adapter = await transpile("../src/contributions/factory/run-expression.ts")
const expressionRef = "expression:walk-factory-run-expression"
const document = adapter.composeRunExpression({run, attempt, units, statePath}, expressionRef)

check("expression schema", document.schema === "oi.expression/v1", document.schema)
check("subject bound to the run", document.entities[`${expressionRef}:entity:run`]?.subject?.subject_ref === run.runRef, "")
check("subject names its native owner", document.entities[`${expressionRef}:entity:run`]?.subject?.native_owner === "software-factory", "")
check("subject is a Being, not a thing", document.entities[`${expressionRef}:entity:run`]?.subject?.presentation_role === "being", "")

// SSSF preservation: the topology survives verbatim, under the kernel's
// composition law (expression-local refs, kinds as readings).
const sanitize = (ref) => ref.replace(/[^A-Za-z0-9-_.]/g, "-")
const entityFor = (suffix) => `${expressionRef}:entity:${sanitize(suffix)}`
check("entity refs are expression-local", Object.keys(document.entities).every(k => k.startsWith(`${expressionRef}:entity:`)), "")
check("scene refs are expression-local", document.scenes.every(scn => scn.scene_ref.startsWith(`${expressionRef}:scene:`)), "")
check("kernel scene budget respected (<=10 entities)", document.scenes.every(scn => scn.entity_refs.length <= 10), String(Math.max(...document.scenes.map(scn => scn.entity_refs.length))))
const nodeIds = Object.keys(run.runMap.nodes)
check("every native node has an entity", nodeIds.every(id => document.entities[entityFor(id)]), String(nodeIds.length))
const kindSet = new Set(Object.values(run.runMap.nodes).map(n => n.kind))
check("node kinds preserved as readings", [...kindSet].every(kind => Object.values(document.entities).some(e => e.subject?.readings?.some(r => r.ref === `factory.run-node/${kind}`))), [...kindSet].join(","))
check("every native edge has a relation", run.runMap.edges.every((edge, i) => document.relations[`${expressionRef}:relation:edge-${i}-${edge.relation}`]), String(run.runMap.edges.length))
const edgeKinds = new Set(run.runMap.edges.map(e => e.relation))
check("edge kinds preserved verbatim", [...edgeKinds].every(kind => Object.values(document.relations).some(r => r.relation.ref === `factory.run-edge/${kind}`)), [...edgeKinds].join(","))
// Gate/barrier nodes are the owner's own topology projection of barriers.
const gateNodes = Object.values(run.runMap.nodes).filter(n => n.kind === "gate" || n.kind === "Gate")
check("gate/barrier nodes render as entities", gateNodes.every(n => document.entities[entityFor(n.id)]), String(gateNodes.length))

// Attempts with their actual verification evidence.
if (attempt) {
  check("every attempt has an entity", attempt.attempts.every(a => document.entities[entityFor(a.attemptRef)]), String(attempt.attempts.length))
  check("attempt subject names the native attempt", attempt.attempts.every(a => document.entities[entityFor(a.attemptRef)]?.subject?.subject_ref === a.attemptRef), "")
  const returned = attempt.attempts.find(a => a.readableReturn)
  check("readable Return has its scene", Boolean(returned) === document.scenes.some(scn => scn.scene_ref.endsWith(":scene:return")), "")
} else {
  check("attempt-less run discloses the refusal", Boolean(attemptsSkipped), attemptsSkipped ?? "")
  check("attempt-less run invents no attempts", !document.scenes.some(scn => scn.scene_ref.endsWith(":scene:executions-1")), "")
}

// The renderer is registered for the world-presentation map.
const presentation = await readFile(new URL("../src/explore/presentation.tsx", import.meta.url), "utf8")
check("factory-run presentation registered", presentation.includes(`"oi.presentation/factory-run/v1"`), "")

console.log(JSON.stringify({expression:document.expression_ref, entities:Object.keys(document.entities).length, relations:Object.keys(document.relations).length, scenes:document.scenes.length, attemptsSkipped, checks:checks.length, passed:checks.filter(c => c.ok).length}))
