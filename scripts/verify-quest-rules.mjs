import assert from "node:assert/strict";
import { build } from "esbuild";

const [{ text: bundledRules }] = (await build({
  entryPoints: ["app/quest-rules.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
})).outputFiles;

const rulesUrl = `data:text/javascript;base64,${Buffer.from(bundledRules).toString("base64")}`;
const rules = await import(rulesUrl);

assert.deepEqual(rules.normalizeHighlandSideQuests(null), rules.INITIAL_HIGHLAND_SIDE_QUESTS);
assert.deepEqual(rules.normalizeHighlandSideQuests({
  frost_medicine: 99,
  wind_courier: 2.8,
  lost_bellsheep: -5,
}), {
  frost_medicine: 2,
  wind_courier: 2,
  lost_bellsheep: 0,
});
assert.match(rules.sideQuestObjective({ id: "frost_medicine", stage: 1, ownsFrostPet: false }), /捕捉晶角幼鹿/);
assert.match(rules.sideQuestObjective({ id: "frost_medicine", stage: 1, ownsFrostPet: true }), /返回断风营地/);
assert.match(rules.sideQuestObjective({ id: "wind_courier", stage: 3 }), /第三封口信/);
assert.match(rules.sideQuestObjective({ id: "lost_bellsheep", stage: 2 }), /已完成/);

console.log("Quest rules verification passed: normalization and branching objectives.");
