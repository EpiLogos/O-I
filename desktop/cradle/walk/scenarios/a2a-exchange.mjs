// a2a-exchange (wave 7): an agent-to-agent exchange over the A2A v1 wire,
// brought home through the same receiving seam. The human selects a passage
// of the real native document, seeds a bounded message to a peer agent, and
// sends it from the strip beside the document. The peer is a controlled
// fixture speaking the exact wire the portable floor's conformance tests
// assert (Agent Card discovery, POST /message:send, application/a2a+json,
// A2A-Version 1.0). Binding, presence, exchange authority and the returned
// difference are the owner floor's own contracts composed in the desktop —
// nothing reaches the network before the human's explicit send, the peer's
// Agent Card must advertise exactly the published interface, the returned
// difference lands pending admission, and only an admitted contribution is
// source-Returned through Central's receiving operations (installed Central
// frozen cut 5d1b8bf) for human review and inclusion.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as sharedFieldSetup} from "./shared-field-return.mjs";
import {prepareA2aContributionIngress} from "../../../../shared-field/a2a.mjs";
import {createAdmission,createContributionIngressReceipt} from "../../../../shared-field/admission.mjs";

const sha256=value=>createHash("sha256").update(value).digest("hex");
const fixtureScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","a2a-peer.py");

function startPeer(args,log){
  const child=spawn("python3",["-u",fixtureScript,...args],{stdio:["ignore","pipe","pipe"]});
  let out="";
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`peer fixture did not announce a port:\n${out}`)),10000);
    child.stdout.on("data",chunk=>{
      out+=chunk;
      const match=out.match(/LISTENING (\d+)/);
      if(match){clearTimeout(timer);resolve({child,port:Number(match[1]),log});}
    });
    child.stderr.on("data",chunk=>{out+=chunk;});
    child.on("exit",code=>{clearTimeout(timer);reject(new Error(`peer fixture exited ${code}:\n${out}`));});
  });
}

export async function setup(args) {
  const source = await sharedFieldSetup(args);
  const peerLog=join(source.root,"a2a-peer.log");
  const mismatchLog=join(source.root,"a2a-peer-mismatch.log");
  const peer=await startPeer(["0",peerLog],peerLog);
  const mismatch=await startPeer(["0",mismatchLog,"mismatch"],mismatchLog);
  const peerLogLines=()=>{
    try{return readFileSync(peerLog,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line));}
    catch{return [];}
  };
  const mismatchLogLines=()=>{
    try{return readFileSync(mismatchLog,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line));}
    catch{return [];}
  };
  return {...source,peer:{port:peer.port,log:peerLogLines},mismatch:{port:mismatch.port,log:mismatchLogLines},
    cleanup:()=>{for(const fixture of [peer,mismatch]){try{process.kill(-fixture.child.pid,"SIGTERM");}catch{fixture.child.kill("SIGTERM");}}
      source.cleanup();}};
}

async function selectRange(editor,start,end) {
  await editor.focus();await editor.press("Meta+ArrowUp");
  for(let i=0;i<start;i++)await editor.press("ArrowRight");
  for(let i=start;i<end;i++)await editor.press("Shift+ArrowRight");
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const passage="Shared field vertical";
  const docPath=join(p.root,"Work/Editor",p.doc.source.path);
  const content=readFileSync(docPath,"utf8");
  const start=content.indexOf(`"${passage}"`);
  if(start<0)throw new Error(`the created document does not carry its title: ${content.slice(0,200)}`);

  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  // 1 — the real document opens through the ordinary navigator file route.
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  for(const folder of ["ProjectCentral/agents","ProjectCentral/agents/now","ProjectCentral/agents/now/flows"]) {
    await nav.locator(`[data-file-path="Work/Editor/${folder}"]`).click();
  }
  await nav.locator(`[data-file-path="Work/Editor/${p.doc.source.path}"]`).click();
  const editor=page.locator(`.cm-content[data-source-ref="${p.doc.source.ref}"]`);
  await editor.waitFor({timeout:15000});
  check((await editor.innerText()).includes(passage),"The native document opens and renders its own bytes");
  check(await page.locator(".shared-field-material").count()===0,"No exchange form is advertised before the human asks for one");

  // 2 — select a passage; the tray seeds the A2A exchange form with it.
  await selectRange(editor,start+1,start+1+passage.length);
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await page.getByRole("button",{name:"Attach selection",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Include selected context"});await dialog.waitFor();
  await dialog.getByRole("button",{name:"Exchange over A2A"}).click();
  await dialog.waitFor({state:"detached"});

  // 3 — the exchange form composes beside the document, message pre-filled
  // with the exact selected passage. Nothing has touched any network yet.
  const strip=page.locator(".shared-field-material");
  await strip.waitFor();
  check((await strip.getByLabel("A2A message text").inputValue())===passage,"The A2A message is pre-filled with the exact selected passage");
  check(p.peer.log().length===0&&p.mismatch.log().length===0,"No A2A request exists before the human's explicit send");

  // 4 — a peer whose Agent Card does not advertise the published interface is
  // refused by the owner floor before any message exchange.
  await strip.getByLabel("Peer agent ref").fill("agent:a2a-mismatch-walk");
  await strip.getByLabel("Peer A2A endpoint URL").fill(`http://127.0.0.1:${p.mismatch.port}/a2a`);
  await strip.getByLabel("Peer Agent Card URL").fill(`http://127.0.0.1:${p.mismatch.port}/.well-known/agent-card.json`);
  await strip.getByRole("button",{name:"Send over A2A"}).click();
  await page.waitForFunction(()=>document.querySelector(".shared-field-material p[role=alert]")?.textContent?.includes("does not advertise the explicitly published interface"),null,{timeout:15000});
  check(true,"A peer whose Agent Card does not advertise the published interface is refused before any message exchange");
  const mismatchRequests=p.mismatch.log();
  check(mismatchRequests.length===1&&mismatchRequests[0].url==="/.well-known/agent-card.json","The refused exchange fetched only the peer's Agent Card — zero message sends");
  await shot("a2a-card-mismatch-refused");

  // 5 — the real peer: bounded message send over the A2A v1 wire.
  await strip.getByLabel("Peer agent ref").fill("agent:a2a-peer-walk");
  await strip.getByLabel("Peer A2A endpoint URL").fill(`http://127.0.0.1:${p.peer.port}/a2a`);
  await strip.getByLabel("Peer Agent Card URL").fill(`http://127.0.0.1:${p.peer.port}/.well-known/agent-card.json`);
  await strip.getByRole("button",{name:"Send over A2A"}).click();
  await page.waitForFunction(()=>document.querySelector(".shared-field-a2a-difference")!==null,null,{timeout:20000});
  const difference=JSON.parse(await page.locator(".shared-field-a2a-difference").getAttribute("data-a2a-difference"));
  check(difference.schema==="oi.a2a-difference/v1"&&difference.admission==="pending","The returned difference is a real oi.a2a-difference/v1, pending admission");
  check(difference.transport_result.kind==="task"&&difference.transport_result.ref==="a2a-task:peer-1","The peer answered with an A2A Task");
  check(difference.agent_ref==="agent:a2a-peer-walk"&&difference.initiator_participant_ref==="participant:desktop-operator","The difference records the exact initiator and counterparty participants");
  const sends=p.peer.log().filter(entry=>entry.url.endsWith("/message:send"));
  check(p.peer.log().filter(entry=>entry.url.includes("agent-card")).length===1&&sends.length===1,"The exchange reached the peer exactly once — one card discovery, one message send");
  check(sends[0].content_type==="application/a2a+json"&&sends[0].a2a_version==="1.0"&&sends[0].body.message.role==="ROLE_USER","The send speaks the A2A HTTP+JSON v1 binding — media type, version header, ROLE_USER message");
  check(sends[0].body.message.parts?.[0]?.text===passage,"The peer received the exact selected passage and nothing else");
  await shot("a2a-exchange-returned");

  // 6 — the returned difference is untrusted material: it becomes a generic
  // contribution ingress (no receiving policy attached), quarantined, then
  // admitted by the receiving side — the owner floor's own chain.
  const reply="The peer agent's returned difference for the A2A vertical";
  const ingress=prepareA2aContributionIngress(difference,{contribution_ref:"contribution:a2a-walk",created_at:new Date().toISOString(),target:{ref:p.doc.source.ref,kind:"central.document"}});
  check(ingress.schema==="oi.a2a-contribution-ingress/v1"&&ingress.contribution.representation.kind==="a2a-return","The difference becomes a generic contribution ingress carrying the a2a-return representation");
  const fingerprint=sha256(JSON.stringify(ingress.contribution.representation.payload));
  const ingressReceipt=createContributionIngressReceipt({ingress_ref:"ingress:a2a-walk",field_ref:ingress.field_ref,contribution_ref:ingress.contribution.contribution_ref,state:"quarantined",received_at:new Date().toISOString(),payload_fingerprint:fingerprint});
  const admission=createAdmission({decision_ref:"admission:a2a-walk",field_ref:ingress.field_ref,subject:{ref:"ingress:a2a-walk",kind:"oi.contribution-ingress"},disposition:"admitted",admission_actor_ref:"agent:reader-walk",decided_at:new Date().toISOString(),reason:"The admitted A2A return is covered by the field's admission law for this walk fixture",evidence:{ingress_ref:ingressReceipt.ingress_ref,payload_fingerprint:fingerprint},provenance:{schema:"oi.contribution-ingress-receipt/v1",ingress_ref:ingressReceipt.ingress_ref},visibility:"restricted",audience_refs:["agent:reader-walk"]});
  check(ingressReceipt.state==="quarantined"&&admission.disposition==="admitted","The A2A return was quarantined under a payload fingerprint, then admitted as its own receiving-side decision");

  // 7 — the receiver source-Returns the admitted material with its A2A
  // lineage (host-supplied credential, never document JSON).
  const submitted=p.reader("central.receiving.submit",{project:"Editor",producer_key:"producer:a2a-walk",source_ref:p.doc.source.ref,document_id:p.doc.document_id,expected_source_revision:p.doc.revision.revision,occurred_at_unix_seconds:42,task_ref:difference.exchange_ref,proposal:{operation:"entry.add",entry_id:"entry:a2a",contribution_id:"part:a2a",html:`<p>${reply}</p>`,a2a:{exchange_ref:difference.exchange_ref,transport_kind:difference.transport_result.kind,transport_ref:difference.transport_result.ref,binding_ref:difference.binding_ref,binding_revision:difference.binding_revision,exchange_grant_ref:difference.exchange_authority.grant_ref}}});
  if(submitted.record.status!=="pending")throw new Error(`the A2A return arrived ${submitted.record.status}`);

  // 8 — the human reviews beside the document: the return discloses its A2A
  // lineage, the exact peer reply, then lands through the owner's
  // revision-checked include.
  const returns=page.locator(".document-returns");
  await returns.getByRole("button",{name:"Refresh this document's returns"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns header small")?.textContent?.includes("1 in the receiving field"),null,{timeout:20000});
  await returns.locator(".document-return").first().click();
  const detail=returns.locator(".return-detail");await detail.waitFor();
  const detailText=await detail.innerText();
  check(detailText.includes("Agent — agent:reader-walk"),"The A2A return's producer is the receiving participant");
  check(detailText.includes("A2A exchange")&&detailText.includes(difference.exchange_ref)&&detailText.includes("a2a-task:peer-1"),"The return discloses its A2A lineage — the exchange and the task it came back as");
  check(detailText.includes(reply),"The exact peer reply is shown before any decision");
  await returns.getByRole("button",{name:"Accept current basis"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-detail")?.textContent?.includes("accepted by"),null,{timeout:20000});
  await returns.getByRole("button",{name:"Include into the document"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-status")?.textContent==="included",null,{timeout:20000});
  check(true,"Inclusion lands through the owner's revision-checked operation on the exact reviewed basis");
  await shot("a2a-return-included");

  // 9 — the document holds the peer's reply as native facts.
  const finalDoc=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});
  const contributions=finalDoc.document.contributions;
  check(contributions.length===1&&contributions[0].html.includes(reply)&&contributions[0].author_ref==="agent:reader-walk"&&contributions[0].reviewed_by==="human:walk","The document holds the admitted A2A material with distinct producer and human-review facts");
  check(finalDoc.revision.revision!==p.doc.revision.revision,"The document source revision advanced through the inclusion");
  check(readFileSync(docPath,"utf8").includes("entry:a2a"),"The proposed entry anchor exists in the real document bytes");
}
