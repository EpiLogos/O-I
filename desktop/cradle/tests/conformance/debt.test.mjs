/** Canonical plan: green-with-debt is a shrinking bounded register, never a blanket exemption. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {registry,root} from './source.mjs';
// Explicit commissioned ceiling. Removing a resolved row is always permitted;
// another debt requires a new authorial/commission review, not baseline regeneration.
const ceiling=new Set(['B-theme-persistence','B-theme-imports','B-theme-window','B-arrangement-disclosure','B-nara-decisions','C-harness-disclosure','C-owner-catalogue','D-surface-catalogue','D-hosted-contributions','D-world-presentation','C-capsule-paths','E-decision-substrate','A-kernel-starvation','B-dictation-endpoint','B-dictation-network','B-source-reading-cache','C-advertised-mode-cache','B-settings-effect-events']);
test('every retained architecture debt is individually bounded, owned and source-bound',()=>{
 const {debts}=registry('violation-baseline');assert.equal(new Set(debts.map(d=>d.id)).size,debts.length);
 for(const debt of debts){assert.ok(ceiling.has(debt.id),`uncommissioned debt ${debt.id}; never auto-accept a regression`);assert.ok(debt.owner_lane&&debt.description&&debt.spec_ref);assert.equal(debt.status,'open','resolved debt must leave the active register');assert.ok(existsSync(join(root,debt.source)),`${debt.id}: source moved or disappeared; review and shrink the register`);}
});
