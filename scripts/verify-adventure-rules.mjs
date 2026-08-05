import assert from "node:assert/strict";
import { build } from "esbuild";

const [{ text: bundledRules }] = (await build({
  entryPoints: ["app/adventure-rules.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
})).outputFiles;

const rulesUrl = `data:text/javascript;base64,${Buffer.from(bundledRules).toString("base64")}`;
const rules = await import(rulesUrl);

assert.deepEqual(rules.normalizeInventory(null), rules.INITIAL_INVENTORY);
assert.deepEqual(rules.normalizeInventory({ coins: -3, capsules: 2.8, berries: "bad" }), { coins: 0, capsules: 2, berries: 3 });

let research = rules.INITIAL_FIELD_RESEARCH;
for (const species of ["wild", "bird", "moss", "wild"]) research = rules.recordEncounter(research, species);
research = rules.recordBattleResolution(research, true);
research = rules.recordBattleResolution(research, false);
research = rules.recordBattleResolution(research, true);
assert.equal(rules.isFieldResearchComplete(research), true);

const claimed = rules.claimFieldResearch(research, rules.INITIAL_INVENTORY);
assert.equal(claimed.claimed, true);
assert.deepEqual(claimed.inventory, { coins: 200, capsules: 8, berries: 5 });
assert.equal(rules.claimFieldResearch(claimed.research, claimed.inventory).claimed, false);

assert.equal(rules.buySupply({ coins: 19, capsules: 0, berries: 0 }, "capsule").purchased, false);
assert.deepEqual(rules.buySupply({ coins: 20, capsules: 0, berries: 0 }, "capsule").inventory, { coins: 0, capsules: 1, berries: 0 });

assert.ok(rules.elementMultiplier("fire", "plant") > 1);
assert.ok(rules.elementMultiplier("plant", "fire") < 1);
assert.ok(rules.calculateSkillDamage({ power: 50, level: 5, attack: 60, defense: 40, multiplier: 1, random: 0.5 }) >= 3);

const healthy = rules.captureChance({ hp: 30, maxHp: 30, calm: 0 });
const weakened = rules.captureChance({ hp: 5, maxHp: 30, calm: 2 });
assert.ok(weakened > healthy);
assert.ok(weakened <= 0.92);

console.log("Adventure rules verification passed: economy, research, damage, elements and capture probability.");
