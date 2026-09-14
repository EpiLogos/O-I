import {readFile} from "node:fs/promises"
import {spawnSync} from "node:child_process"
import ts from "typescript"

const [factoryBin, statePath, runRef] = process.argv.slice(2)
if (!factoryBin || !statePath || !runRef) {
  throw new Error("usage: node walk/factory-run-read.mjs <factory-bin> <state-path> <run-ref>")
}
const native=spawnSync(factoryBin, ["development", "run", statePath, runRef, "--json"], {encoding:"utf8"})
if (native.status !== 0) throw new Error(native.stderr || native.stdout || "Factory run read failed")
const source=await readFile(new URL("../src/contributions/factory/run-reading.ts", import.meta.url), "utf8")
const javascript=ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const decoder=await import("data:text/javascript,"+encodeURIComponent(javascript))
const reading=JSON.parse(native.stdout)
if (!decoder.runReading(reading)) throw new Error("Factory Run reading was rejected by the desktop decoder")
if (reading.runMap.nodes.destination?.state !== null) throw new Error("expected actual destination node to retain nullable state")
if (!Array.isArray(reading.runMap.edges) || reading.runMap.edges.length!==1 || reading.runMap.edges[0].relation!=="branches_to") throw new Error("expected exact native RunMap edge reading")
if (reading.runMap.nodes["work-verify-header-continuity"]?.semanticRef!=="workflow-unit:6WE8KR1PMA9F4NDBH44FCC63NR") throw new Error("expected exact native semantic reference")
console.log(JSON.stringify({contract:reading.contract,runRef:reading.runRef,destination:reading.destination,nodes:Object.keys(reading.runMap.nodes).length,edges:reading.runMap.edges.length,decoded:true}))
