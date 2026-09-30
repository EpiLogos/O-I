// The standalone Flow form in a real browser: plural rendering, the ambiguous
// shared initial, explicit legacy upgrade, and no script errors. No server and
// no native host — the page must stand alone.
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {fileURLToPath} from "node:url";
import {readFileSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const template = readFileSync(root + "documents/ql-flow.html", "utf8");
const fixtures = JSON.parse(readFileSync(root + "documents/fixtures/plural-flow-cases.json", "utf8"));
const island = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const dir = mkdtempSync(join(tmpdir(), "plural-flow-"));
const withDoc = (name, doc) => { const file = join(dir, name); writeFileSync(file, template.replace(island, () => '<script type="application/json" id="ql-doc">' + JSON.stringify(doc).replace(/<\/script/gi, "<\\/script") + "</script>")); return "file://" + file; };
const caseDoc = name => JSON.parse(JSON.stringify(fixtures.cases.find(c => c.name === name).doc));

const plural = caseDoc("thread-branch-convergence");
plural.meta.view = "dialogue";
plural.entries[1].addressees = ["p-ann"]; plural.entries[1].attribution = {basis: "verified", session: "agent-session/ada-1", workcell: "workcell:mac"};
plural.entries[2].attribution = {basis: "verified", session: "agent-session/ash-1"};
plural.entries.push({id: "e-join", author: "A", authorKey: "p-ann", at: "2026-09-30T09:30:00.000Z", html: "<p>Both answers together.</p>", replyTo: null, touched: false, relations: [{type: "converge", entryId: "e-a1"}, {type: "converge", entryId: "e-a2"}, {type: "artifact", ref: "expression:demo"}]});
const legacy = caseDoc("upgrade-fh-preserves-everything");

const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(withDoc("plural.html", plural));
  await page.waitForSelector("article.entry");
  const initials = await page.$$eval("article.entry .ini", els => els.map(el => el.getAttribute("aria-label")));
  assert.equal(initials.length, 4);
  assert.match(initials[0], /Declared author A, Ann/);
  assert.match(initials[1], /Attributed author A, Ada/, "a verified entry names its participant by key, not by the shared initial");
  assert.match(initials[2], /Attributed author S, Ash/);
  assert.ok(!/click to change/.test(initials[1]), "a natively attributed entry is not reassignable in the page");
  const kinds = await page.$$eval("article.entry", els => els.map(el => el.dataset.k));
  assert.deepEqual(kinds, ["person", "agent", "agent", "person"]);
  const text = await page.locator("#app").innerText();
  assert.match(text, /Answers\s*entry 1/);
  assert.match(text, /Brings together\s*entry 2/);
  assert.match(text, /Brings together\s*entry 3/);
  assert.match(text, /Artifact expression:demo/);
  assert.match(text, /To\s*Ann/);
  assert.match(text, /Recorded by the native owner from agent-session\/ada-1 on workcell:mac/);
  assert.equal(await page.locator(".legacy").count(), 0, "a plural document shows no legacy notice");

  // Participants dialog reads the roster and adds one more without starting anything.
  await page.click('button[aria-label="Document menu"]');
  await page.click('button[role="menuitem"]:has-text("Participants")');
  const people = await page.locator("#people-list li").allInnerTexts();
  assert.equal(people.length, 3);
  await page.fill("#people-name", "Bo"); await page.selectOption("#people-kind", "agent"); await page.click("#people-add");
  assert.equal(await page.locator("#people-list li").count(), 4);
  await page.keyboard.press("Escape");

  // A legacy document opens as before, says so, and upgrades only on the person's choice.
  await page.goto(withDoc("legacy.html", legacy));
  await page.waitForSelector("article.entry");
  assert.equal(await page.locator(".legacy").count(), 1);
  assert.equal(await page.locator("article.entry").count(), 3);
  await page.click('button[aria-label="Document menu"]');
  await page.click('button[role="menuitem"]:has-text("Upgrade to the plural form")');
  await page.waitForSelector("article.entry");
  assert.equal(await page.locator(".legacy").count(), 0);
  assert.equal(await page.locator("article.entry").count(), 3, "every entry is kept");
  assert.match(await page.locator("#app").innerText(), /Answers\s*entry 1/, "the legacy reply keeps its meaning");

  // Branch and correct are offered only in the plural form and record typed relations.
  await page.goto(withDoc("plural2.html", plural));
  await page.waitForSelector("article.entry");
  await page.locator("article.entry").first().hover();
  await page.locator("article.entry").first().locator('button[aria-label="Entry actions"]').click();
  await page.click('button[role="menuitem"]:has-text("Branch from this entry")');
  await page.waitForSelector("section.flow");
  assert.match(await page.locator("section.flow").innerText(), /Branches from\s*entry 1/);

  // A copy to share carries no journal, notes, packet, media or entries restricted to some of the group;
  // the complete copy stays the person's own, with everything.
  const withPrivate = JSON.parse(JSON.stringify(plural));
  withPrivate.entries.push({id: "e-priv", author: "A", authorKey: "p-ann", at: "2026-09-30T09:40:00.000Z", html: "<p>PRIVATE-ASIDE</p>", replyTo: null, touched: false, audience: {keys: ["p-ann"]}});
  withPrivate.journal = [{id: "j1", at: "2026-09-30T09:00:00.000Z", html: "<p>SECRET-JOURNAL</p>"}];
  withPrivate.notes = [{id: "n1", entryId: "e-a1", text: "<p>SECRET-NOTE</p>", at: "x", replies: [], author: "A", timing: "x"}];
  await page.goto(withDoc("plural-share.html", withPrivate));
  await page.waitForSelector("article.entry");
  const saved = async label => {
    await page.click('button[aria-label="Document menu"]');
    const [download] = await Promise.all([page.waitForEvent("download"), page.click(`button[role="menuitem"]:has-text("${label}")`)]);
    const target = join(dir, label.replace(/\W+/g, "-") + ".html"); await download.saveAs(target); return readFileSync(target, "utf8");
  };
  const complete = await saved("Save complete copy");
  for (const text of ["SECRET-JOURNAL", "SECRET-NOTE", "PRIVATE-ASIDE"]) assert.ok(complete.includes(text), `the person's own complete copy keeps ${text}`);
  const shared = await saved("Save a copy to share");
  for (const text of ["SECRET-JOURNAL", "SECRET-NOTE", "PRIVATE-ASIDE"]) assert.ok(!shared.includes(text), `a copy to share leaves out ${text}, in the data and in the readable snapshot`);
  assert.ok(shared.includes("Both answers together"), "what the whole group may read is kept");
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], "the standalone form raises no script errors");
console.log("plural-flow browser: ok");
