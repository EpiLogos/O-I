// A1 — harness names come from the connection's protocol and command, never its label.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/harness-naming.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const H = await import("../src/agent/chat/harness.ts");

test("the configured providers on this machine name their harnesses, whatever their labels say", () => {
  const rows = [
    {id: "pi", label: "Pi · programme verification", protocol: "pi-rpc", command: "pi"},
    {id: "hermes-acp-tycho", label: "Hermes ACP (AG campaign second harness)", protocol: "acp", command: "hermes-acp"},
    {id: "gemini-acp", label: "Gemini CLI ACP (AG65 campaign test body)", protocol: "acp", command: "gemini"},
    {id: "codex-sol-joined", label: "Codex Sol low for the joined field", protocol: "pi-rpc", command: "node", entry: "sf6-codex-resident.mjs"},
    {id: "oi-programme-acp", label: "Pi · programme verification", protocol: "acp", command: "node", entry: "index.js"},
    {id: "cc", label: "anything", protocol: "acp", command: "claude-agent-acp"},
  ];
  assert.deepEqual(rows.map(H.harnessChip), ["Pi", "Hermes", "Gemini CLI", "Codex", "ACP agent", "Claude Code"]);
  for (const row of rows) assert.ok(!H.harnessChip(row).includes("campaign"), "a label never reaches the chip");
});

test("without owner facts the chip names the kind of connection, not the label", () => {
  assert.equal(H.harnessChip({id: "x", label: "My favourite campaign body"}), "Harness");
  assert.equal(H.harnessChip({id: "x", label: "Label", protocol: "acp"}), "ACP agent");
  assert.equal(H.harnessChip({id: "x", label: "Label", protocol: "pi-rpc"}), "Pi");
});

test("the session's own binding supplies the facts; the picker groups by harness name", () => {
  const facts = H.factsFromBinding({protocol: "pi-rpc", effective_launch_argv: ["/Users/admin/.local/bin/pi", "--mode", "rpc", "-e", "/x/pi-mcp-bridge/mcp-bridge.ts"]});
  assert.deepEqual(facts, {protocol: "pi-rpc", command: "pi", entry: "mcp-bridge.ts"});
  assert.equal(H.harnessChip({id: "p", label: "l", ...facts}), "Pi");
  const groups = H.groupByHarness([{id: "a", label: "A", command: "pi"}, {id: "b", label: "B", command: "hermes-acp"}, {id: "c", label: "C", command: "pi", sandboxed: true}]);
  assert.deepEqual(groups.map(g => [g.name, g.connections.map(c => c.id)]), [["Pi", ["a", "c"]], ["Hermes", ["b"]]]);
  assert.equal(H.harnessVariant({id: "c", label: "C", sandboxed: true}), "sandboxed");
});
