// agency-a2a (wave 7 → the agency panel): the A2A v1 exchange moves into the
// agency-panel surfaces. The resident's own reply is the bounded passage: the
// human seeds the exchange from the assistant turn, composes the owner floor's
// binding/presence per send, and the returned difference lands pending
// admission inside the panel. The peer is the same controlled wire-exact
// fixture the document strip's walk uses — one Agent Card discovery, one
// application/a2a+json message send carrying the exact reply text and nothing
// else. Nothing reaches the network before the human's explicit send; a peer
// whose card does not advertise the published interface is refused before any
// message exchange.
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as agencySetup} from "./agency-planes.mjs";

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
  const source = await agencySetup(args);
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

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const reply="FIXTURE_REPLY";
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"Agency planes acceptance",exact:true}).click();
  const message=page.getByRole("textbox",{name:"Message",exact:true});
  await message.waitFor();

  // 1 — a real turn gives the panel its own resident material to share.
  check(await page.locator(".encounter-a2a-seed").count()===0,"No exchange affordance exists before a resident reply exists");
  await page.getByRole("button",{name:"Activity acceptance ACP",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});
  await message.fill("AGENCY_A2A_SOURCE");
  await page.locator(".encounter-send").click();
  const turn=page.locator(".encounter-turn.encounter-assistant").filter({hasText:reply}).first();
  await turn.waitFor({timeout:30000});
  check(await turn.locator(".encounter-a2a-seed").count()===1,"The resident's reply carries the exchange affordance in the Conversation plane");
  await shot("agency-a2a-reply-seeded");

  // 2 — seeding pre-fills the exact reply text; nothing has touched any network.
  await turn.locator(".encounter-a2a-seed").click();
  const form=page.locator(".encounter-a2a");
  await form.waitFor();
  check((await form.locator(".encounter-a2a-quote").innerText())===reply,"The exchange is seeded with the resident's exact reply text");
  check(p.peer.log().length===0&&p.mismatch.log().length===0,"No A2A request exists before the human's explicit send");

  // 3 — a peer whose Agent Card does not advertise the published interface is
  // refused by the owner floor before any message exchange.
  await form.getByLabel("Peer agent ref").fill("agent:agency-a2a-mismatch");
  await form.getByLabel("Peer A2A endpoint URL").fill(`http://127.0.0.1:${p.mismatch.port}/a2a`);
  await form.getByLabel("Peer Agent Card URL").fill(`http://127.0.0.1:${p.mismatch.port}/.well-known/agent-card.json`);
  await form.getByRole("button",{name:"Send over A2A"}).click();
  await page.waitForFunction(()=>document.querySelector(".encounter-a2a p[role=alert]")?.textContent?.includes("does not advertise the explicitly published interface"),null,{timeout:15000});
  const mismatchRequests=p.mismatch.log();
  check(mismatchRequests.length===1&&mismatchRequests[0].url==="/.well-known/agent-card.json","The refused exchange fetched only the peer's Agent Card — zero message sends");
  await shot("agency-a2a-card-mismatch-refused");

  // 4 — the real peer: exactly one card discovery, one bounded message send
  // carrying the exact resident reply.
  await form.getByLabel("Peer agent ref").fill("agent:agency-a2a-peer");
  await form.getByLabel("Peer A2A endpoint URL").fill(`http://127.0.0.1:${p.peer.port}/a2a`);
  await form.getByLabel("Peer Agent Card URL").fill(`http://127.0.0.1:${p.peer.port}/.well-known/agent-card.json`);
  await form.getByRole("button",{name:"Send over A2A"}).click();
  await page.waitForFunction(()=>document.querySelector(".encounter-a2a-difference")!==null,null,{timeout:20000});
  const difference=JSON.parse(await page.locator(".encounter-a2a-difference").getAttribute("data-a2a-difference"));
  check(difference.schema==="oi.a2a-difference/v1"&&difference.admission==="pending","The returned difference is a real oi.a2a-difference/v1, pending admission");
  check(difference.field_ref===`field:encounter:${p.ref}`,"The exchange's shared field is the encounter session itself");
  check(difference.agent_ref==="agent:agency-a2a-peer"&&difference.initiator_participant_ref==="participant:desktop-operator","The difference records the exact initiator and counterparty");
  const sends=p.peer.log().filter(entry=>entry.url.endsWith("/message:send"));
  check(p.peer.log().filter(entry=>entry.url.includes("agent-card")).length===1&&sends.length===1,"The exchange reached the peer exactly once — one card discovery, one message send");
  check(sends[0].content_type==="application/a2a+json"&&sends[0].a2a_version==="1.0"&&sends[0].body.message.role==="ROLE_USER","The send speaks the A2A HTTP+JSON v1 binding — media type, version header, ROLE_USER message");
  check(sends[0].body.message.parts?.[0]?.text===reply,"The peer received the resident's exact reply and nothing else");
  await shot("agency-a2a-exchange-returned");

  // 5 — the difference stays pending admission in the panel: rendered with its
  // exchange identity, never applied — the receiving installation's own law
  // decides what happens to the peer's return.
  const rendered=await page.locator(".encounter-a2a-difference").innerText();
  check(rendered.includes("pending admission")&&rendered.includes(difference.exchange_ref),"The panel renders the difference as pending admission with its exchange identity, applied nowhere");
}
