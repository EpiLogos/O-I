// lane-2 T12 + T13 — honest clusters at the broad tier, and the scale-window minimap.
// Cluster membership is pinned to the authority's aggregate() buckets; the minimap is pinned
// to the camera's own window computation. Server renders check markup; the on-screen craft
// (the look, the drag feel, the broad-tier cut-over) is the lead's native pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const compiled=await build({stdin:{contents:[
 "export * as clusters from '../../vendor/research-canvas/packages/canvas/src/timeline/clusters.ts';",
 "export * as minimap from '../../vendor/research-canvas/packages/canvas/src/timeline/minimapGeometry.ts';",
 "export * as labels from '../../vendor/research-canvas/packages/canvas/src/timeline/labels.ts';",
 "export * as instant from '../../vendor/research-canvas/packages/canvas/src/timeline/instant.ts';",
 "export * as scale from '../../vendor/research-canvas/packages/canvas/src/timeline/scale.ts';",
 "export {TimelineClusters} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineClusters.tsx';",
 "export {TimelineMinimap} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineMinimap.tsx';",
 "export * as authorityLanes from '../../../src/techne/m0m5/timeline/lanes.ts';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {clusters,minimap,labels,instant,scale,authorityLanes,TimelineClusters,TimelineMinimap,createElement,renderToStaticMarkup}=api;

const DAY_MS=86_400_000;
// Forty year-precision placements, a quarter-year apart, across 1601–1610: one decade.
const DECADE=Array.from({length:40},(_,i)=>{const fromMs=instant.yearToMs(1601+i/4);return {fromMs,toMs:fromMs+DAY_MS,category:'historical-event'};});
// A millennium-tier window: 1650 ± 2500 years at 0.2 px/yr (the marker band), 1000px wide.
const MILLENNIUM={fromMs:instant.yearToMs(1650-2500),toMs:instant.yearToMs(1650+2500)};
const SCATTERED=[1200,1500,1900,2100,2400].map(year=>{const fromMs=instant.yearToMs(year);return {fromMs,toMs:fromMs+DAY_MS,category:'source'};});

test('forty events in one decade at the broad tier are one cluster marked 40, members exactly the authority buckets',()=>{
 assert.equal(scale.densityBandForPixelsPerYear(0.2),'marker');
 const found=clusters.clusterBroadItems(DECADE,MILLENNIUM);
 assert.equal(found.length,1);
 assert.equal(found[0].count,40);
 assert.deepEqual(found[0].memberIndexes,Array.from({length:40},(_,i)=>i));
 // The authority's own aggregate over the same placements decides membership, bucket by bucket.
 const lane={id:'x',owner:'events',label:'Events',ref:null,items:DECADE.map((item,index)=>({id:String(index),facet_ref:null,kind:'occurrence',lane_id:'x',positioned:true,fromMs:item.fromMs,toMs:item.toMs}))};
 const buckets=authorityLanes.aggregate([lane],MILLENNIUM,48)[0].buckets;
 const expected=buckets.filter(bucket=>bucket.count>=2).map(bucket=>bucket.item_ids.map(Number));
 assert.deepEqual(found.map(cluster=>cluster.memberIndexes),expected);
});

test('a lone placement is never clustered: it keeps its own card, and nothing is counted twice or dropped',()=>{
 assert.deepEqual(clusters.clusterBroadItems([DECADE[0]],MILLENNIUM),[]);
 assert.deepEqual(clusters.clusterBroadItems(SCATTERED,MILLENNIUM),[]);
 const all=[...DECADE,...SCATTERED];
 const found=clusters.clusterBroadItems(all,MILLENNIUM);
 const clustered=found.flatMap(cluster=>cluster.memberIndexes);
 assert.equal(new Set(clustered).size,clustered.length,'no item in two clusters');
 assert.equal(clustered.length,40,'the decade is the only cluster; the five scattered placements keep their cards');
 assert.ok(clustered.every(index=>index<40));
});

test('a cluster of events says events; any other member makes it items, and the count is always the bucket count',()=>{
 const [events]=clusters.clusterBroadItems(DECADE,MILLENNIUM);
 assert.equal(events.allEvents,true);
 assert.equal(clusters.clusterLabel(events,0),'40 events, 1601 – 1610');
 // One non-event member (a source) makes the same decade an honest count of items.
 const mixed=DECADE.map((item,index)=>index===7?{...item,category:'source'}:item);
 const [items]=clusters.clusterBroadItems(mixed,MILLENNIUM);
 assert.equal(items.count,40);
 assert.equal(items.allEvents,false);
 assert.equal(clusters.clusterLabel(items,0),'40 items, 1601 – 1610');
 // Every category other than historical-event is an item.
 const sources=DECADE.map(item=>({...item,category:'claim'}));
 const [claims]=clusters.clusterBroadItems(sources,MILLENNIUM);
 assert.equal(clusters.clusterLabel(claims,0),'40 items, 1601 – 1610');
});

test('a cluster label names the calendar years of its span, inclusive, BCE explicit',()=>{
 const [found]=clusters.clusterBroadItems(DECADE,MILLENNIUM);
 assert.equal(labels.spanLabel(found.fromMs,found.toMs,0),'1601 – 1610');
 assert.equal(labels.spanLabel(instant.yearToMs(1601),instant.yearToMs(1651),0),'1601 – 1650');
 // An exclusive end at the start of -400 is the last millisecond of -401: 402 BCE, read inclusively.
 assert.equal(labels.spanLabel(instant.yearToMs(-500),instant.yearToMs(-400),0),'501 BCE – 402 BCE');
 assert.equal(labels.spanLabel(instant.yearToMs(1850),instant.yearToMs(1851),0),'1850');
});

test('a cluster zooms once to its span: centred on it, filling 80% of the width',()=>{
 const span={fromMs:instant.yearToMs(1601),toMs:instant.yearToMs(1611)};
 const view=clusters.clusterZoomView(span,1000);
 assert.ok(Math.abs(view.centerYear-1606)<0.01,String(view.centerYear));
 const spanYears=(span.toMs-span.fromMs)/scale.MS_PER_YEAR;
 assert.ok(Math.abs(view.pixelsPerYear*spanYears-800)<1e-6,String(view.pixelsPerYear*spanYears));
});

test('cluster labels that would overlap take separate rows, capped at the row limit',()=>{
 assert.deepEqual(clusters.clusterRows([{left:0,width:100},{left:50,width:100},{left:200,width:100}]),[0,1,0]);
 const rows=clusters.clusterRows([{left:0,width:100},{left:10,width:100},{left:20,width:100},{left:30,width:100}],{maxRows:3});
 assert.ok(rows.every(row=>row>=0&&row<3),JSON.stringify(rows));
 assert.equal(new Set(rows).size,3);
});

test('the minimap highlights the visible span (centre ± half the width in time); the query window is unchanged',()=>{
 // 1000px at 2 px/yr shows 500 years: centre ± 250.
 assert.deepEqual(minimap.visibleSpanForViewport(1700,2,1000),{startYear:1450,endYear:1950});
 // 1000px at 1000 px/yr shows one year: centre ± 0.5.
 assert.deepEqual(minimap.visibleSpanForViewport(1700,1000,1000),{startYear:1699.5,endYear:1700.5});
 // The query window the surface fetches is still the padded one.
 assert.deepEqual(minimap.timelineWindowForViewport(1700,2,1000),{startYear:1325,endYear:2075});
 assert.deepEqual(minimap.timelineWindowForViewport(1700,1000,1000),{startYear:1680,endYear:1720});
});

test('the highlight is clamped to the strip, and a window holding the whole domain hides it',()=>{
 const domain={startYear:1000,endYear:2000};
 const extent=minimap.minimapExtent({startYear:1325,endYear:2075},domain);
 assert.ok(Math.abs(extent.leftFraction-0.325)<1e-12);
 assert.equal(extent.rightFraction,1);
 assert.equal(minimap.minimapCoversDomain({startYear:1325,endYear:2075},domain),false);
 assert.equal(minimap.minimapCoversDomain({startYear:900,endYear:2100},domain),true);
});

test('dragging pans with the pointer; an edge drag zooms proportionally about the centre',()=>{
 const domain={startYear:1000,endYear:2000};
 assert.equal(minimap.minimapPanCentre(1700,50,500,domain),1800);
 assert.equal(minimap.minimapYearAt(domain,500,250),1500);
 assert.equal(minimap.minimapZoom(2,100,50),4);
 assert.equal(minimap.minimapZoom(2,100,100),2);
});

test('the strip renders the window as a projection and renders nothing when it covers the domain',()=>{
 const domain={startYear:1000,endYear:2000};
 const html=renderToStaticMarkup(createElement(TimelineMinimap,{domain,visible:{startYear:1450,endYear:1950},centerYear:1700,pixelsPerYear:2,onPan:()=>{},onZoom:()=>{}}));
 assert.match(html,/data-testid="timeline-minimap"/);
 assert.match(html,/role="group"/);
 const left=Number(/left:([\d.]+)%/.exec(html)[1]);
 const width=Number(/width:([\d.]+)%/.exec(html)[1]);
 assert.ok(Math.abs(left-45)<1e-9,String(left));
 assert.ok(Math.abs(width-50)<1e-9,String(width));
 const hidden=renderToStaticMarkup(createElement(TimelineMinimap,{domain,visible:{startYear:900,endYear:2100},centerYear:1500,pixelsPerYear:0.5,onPan:()=>{},onZoom:()=>{}}));
 assert.equal(hidden,'');
});

test('a cluster renders as a count button with its label, never as a timeline node',()=>{
 const [found]=clusters.clusterBroadItems(DECADE,MILLENNIUM);
 const mark={cluster:found,label:'40 events, 1601 – 1610',startPx:100,endPx:140,row:0,tone:'#79c0d4'};
 const html=renderToStaticMarkup(createElement(TimelineClusters,{marks:[mark],onZoom:()=>{}}));
 assert.match(html,/data-testid="timeline-cluster-0"/);
 assert.match(html,/<button/);
 assert.match(html,/40 events, 1601 – 1610/);
 assert.doesNotMatch(html,/timeline-node-/);
});
