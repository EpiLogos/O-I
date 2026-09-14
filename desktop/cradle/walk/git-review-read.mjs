// Real owner-reading boundary walk for reviewed Git snapshots. The sole positive
// input is the current public AIKit Development Field response; negatives are
// corrupt derivatives. An owner-reported worktree mismatch remains retained
// evidence and is withheld by the Git projection rather than rejected.
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdirSync,writeFileSync} from "node:fs";
const bridge=process.env.WALK_KERNEL_BRIDGE??"http://127.0.0.1:4179";
const project=process.env.WALK_PROJECT??"O-I";
const cwd=process.env.WALK_GIT_CWD??"/home/frank/Central/Work/O-I";
const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
const bundleModule=async entry=>{
  const bundled=await build({entryPoints:[entry],bundle:true,format:"esm",platform:"node",write:false,logLevel:"silent"});
  return import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].text).toString("base64"));
};
const helper=await bundleModule("src/surface/development-field-snapshot.ts");
const gitProjection=await bundleModule("src/returns/git.ts");
const read=async base=>{
  const response=await fetch(bridge+"/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"development_field_read",project,cwd,base_revision:base,refs:[]})});
  assert.ok(response.ok,"Kernel bridge responds to public Development Field read");
  const result=await response.json();
  assert.equal(result.outcome?.result,"development_field_reading","AIKit returns a Development Field reading");
  assert.equal(result.outcome.project,project,"Kernel preserves requested display Project identity");
  assert.equal(result.outcome.cwd,cwd,"Kernel returns the exact canonical worktree identity");
  return result.outcome;
};
const reject=(label,value,expected)=>{
  const reason=helper.developmentFieldSnapshotError(value,expected);
  check(typeof reason==="string"&&reason.length>0,label+": "+reason);
  assert.equal(helper.exactDevelopmentFieldSnapshot(value,expected),undefined,label+" has no accepted snapshot");
};
const probe=await read("HEAD");
const observedHead=probe.reading.git?.current_diff_from_base?.observed_head;
assert.ok(observedHead,"Actual HEAD probe discloses the observed owner HEAD for exact review");
const exact=await read(observedHead);
const expected={project,cwd,requestedBase:"HEAD"};
const snapshot={project,cwd,requestedBase:"HEAD",resolvedBase:observedHead,reading:exact.reading};
check(helper.developmentFieldSnapshotError(snapshot,expected)===undefined,"Actual owner exact-base reading is retainable");
check(helper.exactDevelopmentFieldSnapshot(snapshot,expected)?.reading===exact.reading,"Exact decoder returns the actual owner reading");
const swappedProject=structuredClone(snapshot);swappedProject.project="Factory";reject("Rejects a snapshot for another display Project",swappedProject,expected);
const swappedCwd=structuredClone(snapshot);swappedCwd.cwd="/tmp/not-the-owner-worktree";reject("Rejects a snapshot for another worktree identity",swappedCwd,expected);
const swappedBase=structuredClone(snapshot);swappedBase.requestedBase="another-base";reject("Rejects a snapshot for another requested comparison base",swappedBase,expected);
const wrongResolved=structuredClone(snapshot);wrongResolved.resolvedBase="not-the-owner-observed-head";reject("Rejects a resolved base that differs from the retained owner diff",wrongResolved,expected);
const oversized=structuredClone(snapshot);oversized.reading.git.current_diff_from_base.patch=snapshot.reading.git.current_diff_from_base.patch.repeat(20);reject("Rejects an oversized retained native patch",oversized,expected);
const corrupt=structuredClone(snapshot);corrupt.reading.git.world.repository.ahead=-1;reject("Rejects a corrupt native repository field",corrupt,expected);
check(snapshot.reading.git.world.project!==project,"Keeps owner ProjectRef distinct from the desktop display Project");
const worktreeMismatch=structuredClone(snapshot);worktreeMismatch.reading.git.world.repository.worktree_root="/tmp/other-owner-worktree";
check(helper.developmentFieldSnapshotError(worktreeMismatch,expected)===undefined,"Retains an owner-reported worktree mismatch under the exact requested Surface identity");
const withheld=gitProjection.developmentFieldWorktreeMismatch(worktreeMismatch.reading,cwd);
check(withheld?.requested===cwd&&withheld.observed==="/tmp/other-owner-worktree","Git projection detects the retained owner/request worktree mismatch");
check(!worktreeMismatch.reading.git.current_diff_from_base||!!withheld,"A retained mismatched reading cannot be treated as a matching-worktree patch");
const matchingView={cwd,baseRevision:"HEAD",snapshot};
const retainedView=helper.exactDevelopmentFieldView(matchingView,expected);
check(retainedView?.snapshot?.reading===exact.reading,"Matching outer view retains the actual reviewed snapshot");
const wrongViewCwd={...matchingView,cwd:"/tmp/other-view-worktree"};
check(helper.exactDevelopmentFieldView(wrongViewCwd,expected)===undefined,"Rejects a valid snapshot under a wrong outer worktree");
const wrongViewBase={...matchingView,baseRevision:"other-base"};
check(helper.exactDevelopmentFieldView(wrongViewBase,expected)===undefined,"Rejects a valid snapshot under a wrong outer comparison base");
const unavailableView={cwd,baseRevision:"HEAD",snapshotUnavailable:"AIKit exact-base refresh is unavailable; refresh explicitly to replace this review."};
const retainedUnavailable=helper.exactDevelopmentFieldView(unavailableView,expected);
check(retainedUnavailable?.snapshot===undefined&&retainedUnavailable?.snapshotUnavailable===unavailableView.snapshotUnavailable,"Retains a bounded recovery notice without an old snapshot");
const oversizedNotice={cwd,baseRevision:"HEAD",snapshotUnavailable:"x".repeat(1025)};
check(helper.exactDevelopmentFieldView(oversizedNotice,expected)===undefined,"Rejects an oversized recovery notice");
mkdirSync("walk/artifacts",{recursive:true});
writeFileSync("walk/artifacts/git-review-read.json",JSON.stringify({standing:"C: current public AIKit Development Field reads plus corrupt derivatives; no Git command or owner mutation",checks,source:{project,cwd,requestedBase:"HEAD",resolvedBase:observedHead,readingVersion:exact.reading.version,ownerProjectRef:exact.reading.git?.world.project,patchChars:exact.reading.git?.current_diff_from_base?.patch.length},decoder:{maxBytes:helper.DEVELOPMENT_FIELD_SNAPSHOT_MAX_BYTES,ownerWorktreeMismatch:"retained as owner evidence; developmentFieldWorktreeMismatch withholds its patch"}},null,2));
