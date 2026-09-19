/**
 * Dev-only fixture claims source. Imported ONLY behind
 * `import.meta.env.DEV && new URLSearchParams(location.search).has("fixtures")`
 * (see ClaimsEvidencePlane.tsx's module-scope gate) — never bundled into a
 * production build's reachable path, and never registered ahead of a real
 * source. Every claim it returns carries `source:"fixture"`, and
 * ClaimsEvidencePlane shows the visible "Fixture — not native data" label
 * whenever the active source's kind is "fixture".
 */
import {registerClaimsSource,type ClaimsReading} from "./deskTypes";

const READING:ClaimsReading={
 claims:[
  {ref:"claim:fixture:1",source:"fixture",assertion:"The change compiles and the affected tests pass.",subjectRef:"source:fixture/example.ts",subjectRevision:"rev-a1b2c3",sender:"agent-session:fixture",basis:["tool block 12: cargo test output"],observedAtUnixMs:Date.now()-60000},
  {ref:"claim:fixture:2",source:"fixture",assertion:"The change compiles and the affected tests pass.",subjectRef:"source:fixture/example.ts",subjectRevision:"rev-a1b2c3",sender:"agent-session:fixture",basis:["tool block 19: cargo test output, repeated"],observedAtUnixMs:Date.now()-30000},
 ],
 evidence:[
  {ref:"evidence:fixture:1",source:"fixture",claimRef:"claim:fixture:1",relation:"supports",summary:"cargo test reported 42 passed, 0 failed.",originRef:"trajectory-block:12"},
 ],
 assessments:[
  {ref:"assessment:fixture:1",source:"fixture",claimRef:"claim:fixture:1",assessment:"Evidence covers the stated change; no independent re-run was performed by the receiver.",obligationsOpen:["Human acceptance of the affected source"]},
 ],
};

export function installDeskFixtures() {
 registerClaimsSource({id:"desk-fixture",label:"Desk fixture (dev only)",kind:"fixture",read:async()=>READING});
}
