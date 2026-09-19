/** Presentation-only validators for Factory's public developmental read models.
 * They retain the owner's words and leave absent outcome/workflow facts absent. */
export interface JourneyReturnReading { return_ref: string; run_refs: string[]; summary: string }
export interface JourneyCommissionReading { purpose: string; commission_ref?: string|null }
export interface JourneySummaryReading { journeyRef: string; revision?: number; status?: string; frontier?: string; runRefs: string[] }
export interface ProjectReading { contract: "factory.project-reading/v1"; projectRef: string; journeys: JourneySummaryReading[] }
export interface JourneyReading { contract: "factory.journey-reading/v1"; journeyRef: string; projectRef: string; commission: JourneyCommissionReading; status: string; frontier: string; runRefs: string[]; returns: JourneyReturnReading[] }
export interface RunMapNode { id: string; kind: string; label: string; state?: string|null; semanticRef?: string|null }
export interface RunMapEdge { from: string; to: string; relation: string }
export interface RunReading { contract: "factory.run-reading/v1"; runRef: string; projectRef: string; lifecycle: string; destination: string; runMap: {nodes: Record<string, RunMapNode>; edges: RunMapEdge[]} }

function object(value: unknown): Record<string, unknown>|undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
function string(value: unknown): value is string { return typeof value === "string" }
function strings(value: unknown): string[]|undefined { return Array.isArray(value) && value.every(string) ? value : undefined }
function runMap(value: unknown): RunReading["runMap"]|undefined {
 const source=object(value), nodes=source&&object(source.nodes), edges=source?.edges; if (!nodes || !Array.isArray(edges)) return undefined
 const parsed: Record<string, RunMapNode>={}
 for (const [key,node] of Object.entries(nodes)) { const record=object(node); if (!record || !string(record.id) || !string(record.kind) || !string(record.label) || (record.state !== undefined && record.state !== null && !string(record.state)) || (record.semanticRef !== undefined && record.semanticRef !== null && !string(record.semanticRef))) return undefined; parsed[key]={id:record.id,kind:record.kind,label:record.label,...(record.state===null?{state:null}:string(record.state)?{state:record.state}:{}),...(record.semanticRef===null?{semanticRef:null}:string(record.semanticRef)?{semanticRef:record.semanticRef}:{})} }
 const parsedEdges: RunMapEdge[]=[]
 for (const edge of edges) { const record=object(edge); if (!record || !string(record.from) || !string(record.to) || !string(record.relation) || !parsed[record.from] || !parsed[record.to]) return undefined; parsedEdges.push({from:record.from,to:record.to,relation:record.relation}) }
 return {nodes:parsed,edges:parsedEdges}
}
export function projectReading(value: unknown): value is ProjectReading { const source=object(value); return !!source && source.contract==="factory.project-reading/v1" && string(source.projectRef) && Array.isArray(source.journeys) && source.journeys.every(item=>{const journey=object(item); return !!journey && string(journey.journeyRef) && (journey.status===undefined || string(journey.status)) && (journey.frontier===undefined || string(journey.frontier)) && strings(journey.runRefs)!==undefined}) }
export function journeyReading(value: unknown): value is JourneyReading { const source=object(value), commission=source&&object(source.commission); return !!source && source.contract==="factory.journey-reading/v1" && string(source.journeyRef) && string(source.projectRef) && string(source.status) && string(source.frontier) && !!commission && string(commission.purpose) && (commission.commission_ref===undefined || commission.commission_ref===null || string(commission.commission_ref)) && strings(source.runRefs)!==undefined && Array.isArray(source.returns) && source.returns.every(item=>{const returned=object(item); return !!returned && string(returned.return_ref) && strings(returned.run_refs)!==undefined && string(returned.summary)}) }
export function runReading(value: unknown): value is RunReading { const source=object(value); return !!source && source.contract==="factory.run-reading/v1" && string(source.runRef) && string(source.projectRef) && string(source.lifecycle) && string(source.destination) && runMap(source.runMap)!==undefined }
export function runMapNodes(reading: RunReading): RunMapNode[] { return Object.values(reading.runMap.nodes) }
export function runOutcome(journey: JourneyReading|undefined, runRef: string): string|undefined { return journey?.returns.find(returned=>returned.run_refs.includes(runRef))?.summary }
export function titleCase(value: string): string { return value.replaceAll("_"," ").replace(/\b\w/g, letter=>letter.toUpperCase()) }
