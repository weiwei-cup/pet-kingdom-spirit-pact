import assert from "node:assert/strict";
import { build } from "esbuild";

const [{ text: bundledRules }] = (await build({
  entryPoints: ["app/trainer-battle-rules.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
})).outputFiles;

const rulesUrl = `data:text/javascript;base64,${Buffer.from(bundledRules).toString("base64")}`;
const rules = await import(rulesUrl);

assert.equal(rules.statusForElement("fire"), "burn");
assert.equal(rules.statusForElement("plant"), "poison");
assert.equal(rules.statusForElement("ice"), "freeze");
assert.equal(rules.statusForElement("metal"), null);
assert.equal(rules.shouldInflictStatus({ element: "fire", power: 50, roll: 0.2 }), true);
assert.equal(rules.shouldInflictStatus({ element: "fire", power: null, roll: 0 }), false);

const poisoned = rules.applyStatusTick({ hp: 50, maxHp: 80, status: "poison" });
assert.equal(poisoned.damage, 8);
assert.equal(poisoned.hp, 42);
const frozen = rules.applyStatusTick({ hp: 50, maxHp: 80, status: "freeze" });
assert.equal(frozen.skipTurn, true);
assert.equal(frozen.cleared, true);

assert.equal(rules.enemyAction({ hp: 20, maxHp: 80, hasSupportSkill: true, roll: 0.2 }), "support");
assert.equal(rules.enemyAction({ hp: 70, maxHp: 80, hasSupportSkill: true, roll: 0.2 }), "attack");

console.log("Trainer battle verification passed: statuses, damage ticks and enemy decisions.");
