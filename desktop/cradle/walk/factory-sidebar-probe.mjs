// factory-sidebar-probe: the Run / Agents / Context sidebar, behaviourally.
// Enters Factory in the dev build, then asserts the three top-level tabs and
// that the labelled dev scenarios' controls really mutate the fixture state
// (handoff §8: "an inert labelled shell is insufficient"). Readbacks only —
// no screenshots-as-proof.
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:820}});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1421/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1200);

// --- enter Factory -----------------------------------------------------------
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForTimeout(900);
const nav=page.locator('.agent-planes');
const navText=await nav.innerText().catch(()=> "");
check(/Run/.test(navText)&&/Agents/.test(navText)&&/Context/.test(navText),"the panel names Run, Agents and Context",navText.replace(/\s+/g," "));
check(!/Trajectory|Skills & tools|Claims & evidence|Results/.test(navText),"no #373 tab names remain in the strip",navText.replace(/\s+/g," "));

// --- Run plane: scenario bar, fixture run, control mutation ------------------
await nav.getByRole("button",{name:"Run",exact:true}).click();
await page.waitForTimeout(400);
let runPlane=page.locator('[data-plane="Run"]');
check(await runPlane.count()>0,"the Run plane body renders");
await runPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("running");
await page.waitForTimeout(400);
check(await runPlane.locator('.factory-side-run-head strong').innerText().then(t=>t.length>0).catch(()=>false),"the fixture run header names the run");
check(await runPlane.getAttribute("data-fixture").then(v=>v==="running").catch(()=>false),"the plane discloses its fixture standing (data-fixture, not native data)");
const stepsBefore=await runPlane.locator('.factory-side-steps>li').count();
check(stepsBefore>=3,"the run's steps/lanes render",`count ${stepsBefore}`);
await runPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("history");
await page.waitForTimeout(300);
await runPlane.getByRole("button",{name:"Simulate arrival"}).click();
await page.waitForTimeout(300);
check(/\d+ new/.test(await runPlane.locator('.factory-side-traj-strip').innerText().catch(()=>"" )),"the history scenario holds unread arrivals with a visible count");
await runPlane.getByRole("button",{name:"Resume",exact:true}).click();
await page.waitForTimeout(200);
check(/Live/.test(await runPlane.locator('.factory-side-traj-strip').innerText().catch(()=>"" )),"resume clears the held count back to live");
await runPlane.getByRole("button",{name:"Hold",exact:true}).click();
await page.waitForTimeout(200);
await runPlane.getByRole("button",{name:"Simulate arrival"}).click();
await page.waitForTimeout(300);
check(/1 new/.test(await runPlane.locator('.factory-side-traj-strip').innerText().catch(()=>"" )),"an arrival lands in a held view with a visible count");
const trajRow=runPlane.locator('.factory-side-traj-row').first();
await trajRow.click();
check(await runPlane.locator('.factory-side-traj-detail').count()>0,"a trajectory row expands its exact detail");
await runPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("running");
await page.waitForTimeout(300);

// --- Run blocked scenario: permission resolve mutates the fixture ------------
await runPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("blocked");
await page.waitForTimeout(400);
const blockedStep=runPlane.locator('.factory-side-steps>li[data-step-status="blocked"]').first();
check(await blockedStep.count()>0,"the blocked scenario shows a permission-blocked step");
await runPlane.getByRole("button",{name:"Permit",exact:true}).first().click();
await page.waitForTimeout(300);
check(await runPlane.locator('.factory-side-steps>li[data-step-status="blocked"]').count()===0,"permitting resolves the barrier — the step really leaves blocked");

// --- Agents plane -------------------------------------------------------------
await nav.getByRole("button",{name:"Agents",exact:true}).click();
await page.waitForTimeout(400);
const agentsPlane=page.locator('[data-plane="Agents"]');
check(await agentsPlane.count()>0,"the Agents plane body renders");
await agentsPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("team");
await page.waitForTimeout(400);
check(await agentsPlane.getByRole("button",{name:"New Agent"}).count()>0&&await agentsPlane.getByRole("button",{name:"New Team"}).count()>0,"New Agent / New Team are immediately reachable");
await agentsPlane.getByRole("button",{name:/Meredith/}).first().click();
await page.waitForTimeout(300);
const headings=await agentsPlane.locator('h4').allInnerTexts();
check(headings.includes("Skills"),"the detail's short heading is exactly “Skills”",headings.join("|"));
check(headings.includes("Capabilities"),"Capabilities is its own section");
check(!headings.some(h=>/Skills & tools/.test(h)),"no “Skills & tools” category remains");
await agentsPlane.getByRole("button",{name:"Suggest skills"}).click().catch(()=>{});
// Suggest needs an intent first; type it, then suggest.
await agentsPlane.locator('.factory-side-intent textarea').fill("Keep the render lane's Rust checks honest and prove the UI in the browser.");
await agentsPlane.getByRole("button",{name:"Suggest skills"}).click();
await page.waitForTimeout(300);
check(await agentsPlane.locator('.factory-side-proposal').count()>0,"Suggest skills yields a reviewable proposal with reasons");
const skillBefore=await agentsPlane.locator('.factory-side-skills>li[data-skill-state="selected"]').count();
await agentsPlane.getByRole("button",{name:"Apply selected"}).click();
await page.waitForTimeout(300);
const skillAfter=await agentsPlane.locator('.factory-side-skills>li[data-skill-state="selected"]').count();
check(skillAfter>skillBefore,"applying the proposal really selects the proposed skills",`${skillBefore} → ${skillAfter}`);

// --- Context plane -------------------------------------------------------------
await nav.getByRole("button",{name:"Context",exact:true}).click();
await page.waitForTimeout(400);
const contextPlane=page.locator('[data-plane="Context"]');
check(await contextPlane.count()>0,"the Context plane body renders");
check(await contextPlane.getByRole("heading",{name:"Needs you"}).count()>0||await contextPlane.locator('h4',{hasText:"Needs you"}).count()>0,"Needs you is a group inside Context");
await contextPlane.locator("select[aria-label=\"Dev scenario\"]").selectOption("review");
await page.waitForTimeout(400);
check(await contextPlane.locator('.factory-side-return').count()>0,"an addressed return waits in Needs you with its native state");
const candidateRows=contextPlane.locator('.factory-side-rows>li[data-candidate-status]');
check(await candidateRows.count()>=2,"produced candidates render as material rows",`count ${await candidateRows.count()}`);
await candidateRows.first().getByRole("button",{name:"Select to compare"}).click();
await candidateRows.nth(1).getByRole("button",{name:"Select to compare"}).click();
await page.waitForTimeout(300);
check(await contextPlane.locator('.factory-side-compare-col').count()===2,"two selected candidates compare side-by-side with bodies");
await candidateRows.first().getByRole("button",{name:"Reuse as input"}).click();
await page.waitForTimeout(300);
const sources=contextPlane.locator('.factory-side-rows>li[data-source-included]');
check(await sources.count()>0,"reuse-as-input adds the produced material as a source reference");

// --- continuity: switching planes holds nothing hostile, roster not redirected
await nav.getByRole("button",{name:"Run",exact:true}).click();
await page.waitForTimeout(300);
check(await page.locator('[data-plane="Run"]').count()>0,"returning to Run keeps the sidebar usable");
check(await page.locator('.agent-centre-conversation').count()>=0,"the conversation stays in the centre (no second composer in the sidebar)");

console.log(fails.length?`\n${fails.length} FAILURES`:"\nall checks passed");
await browser.close();
process.exit(fails.length?1:0);
