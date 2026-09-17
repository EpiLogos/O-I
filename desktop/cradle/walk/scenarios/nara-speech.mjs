/**
 * Nara speech experience — the joined desktop walk (#336, OI-E in the
 * expression-atelier suite map).
 *
 * The joined chain runs the Nara consumer modules against the REAL kernel
 * through the walk bridge: the chain lives in
 * `walk/fixtures/nara-joined-chain.mjs`, spawned with the repo's own TS
 * test flags (the same way tests/nara-speech-conformance.mjs runs), so the
 * TypeScript modules import exactly as they do in the test harness. Its
 * checks arrive here as one JSON result and are recorded verbatim; this
 * scenario adds the in-page leg proving the mounted app reads the same
 * Expression through the same bridge.
 *
 * The live audio leg (real microphone + real provider speech) is NOT
 * claimed here: the presence surface's capture path is proven with a
 * synthetic source in tests/nara-presence-lifecycle.mjs. Live-mic and
 * live-provider walks remain the owner's G3 acceptance.
 */

import {spawn} from "node:child_process";

import { setup as editorSetup } from "./editor.mjs";
export async function setup(args){
  const provisioned=await editorSetup(args);
  return {...provisioned,cradleRoot:args.cradleRoot};
}

export default async function run({page,baseUrl,check,shot,channel,bridgeUrl,provision}) {
  const cradleRoot=provision?.cradleRoot;
  const child=spawn("node",[
    "--experimental-strip-types","--import","./tests/ts-register.mjs",
    "walk/fixtures/nara-joined-chain.mjs",bridgeUrl,
  ],{cwd:cradleRoot,stdio:["ignore","pipe","pipe"]});
  let out="",err="";
  child.stdout.on("data",chunk=>{out+=chunk;process.stdout.write(`  [chain] ${chunk}`);});
  child.stderr.on("data",chunk=>{err+=chunk;process.stdout.write(`  [chain!] ${chunk}`);});
  const code=await new Promise(resolve=>child.on("exit",resolve));
  if(code!==0)throw new Error(`the joined Nara chain failed (${code}):\n${err||out}`);

  const tail=out.slice(out.lastIndexOf("\n{",out.length-2)).trim();
  const result=JSON.parse(tail);
  const expressionRef=result.expression_ref;
  for(const entry of result.checks){
    check(entry.ok,`[chain] ${entry.label}`,entry.ok?entry.data:entry.error);
  }

  // In-page: the mounted walk bundle reads the same Expression through the
  // same bridge — one kernel, one seam, no second authority path.
  await page.goto(baseUrl);
  await channel("info");
  const inspected=await channel("invoke.kernel_op",[{op:"expression",request:{operation:"inspect",expression_ref:expressionRef}}]);
  const pageDocument=inspected.data?.outcome?.data?.document;
  check(inspected.ok===true&&pageDocument?.expression_ref===expressionRef,
  "The page reads the same Expression through the same kernel seam",{revision:pageDocument?.revision,page_revision:pageDocument?.revision,chain_revision:"latest"});
  const naraSurfaceOpen=await channel("invoke.kernel_op",[{op:"surface_open",surface_id:"nara-walk",kind:"nara",title:"Nara",ref:expressionRef}]);
  check(naraSurfaceOpen.ok===true,"The Nara presence surface binding opens through the kernel seam");
  await shot("nara-joined-world");
}
