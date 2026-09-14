import {test} from "node:test";
import assert from "node:assert/strict";
import {persistLatestWorkspace, serializeLatestWorkspace} from "../src/workspace/persistence.ts";

test("lifecycle persistence serializes the latest book held by the ref", () => {
  const storage = new Map();
  const target = {setItem(key, value) { storage.set(key, value); }};
  const book = {current: {version: 1, active: "root", workspaces: [{id: "root", surfaces: ["NOW"]}]}};
  const persist = () => persistLatestWorkspace(book, target, "oi-cradle.workspaces.v1");
  book.current = {version: 1, active: "root", workspaces: [{id: "root", surfaces: ["NOW", "working"]}]};
  persist();
  assert.deepEqual(JSON.parse(storage.get("oi-cradle.workspaces.v1")), book.current);
});

test("workspace serialization preserves exact structured state", () => {
  const book = {version: 1, active: "root", workspaces: [{id: "root", layout: {root: {type: "tabs", active: "agents"}}}]};
  assert.equal(serializeLatestWorkspace(book), JSON.stringify(book));
});
