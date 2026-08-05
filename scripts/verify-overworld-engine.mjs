import assert from "node:assert/strict";
import { build } from "esbuild";

const [{ text: bundledEngine }] = (await build({
  entryPoints: ["app/overworld-engine.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
})).outputFiles;

const engineUrl = `data:text/javascript;base64,${Buffer.from(bundledEngine).toString("base64")}`;
const { canStandAt, integrateActorMovement, isEncounterTerrain, terrainAt } = await import(engineUrl);

const routes = [
  { map: "road", start: { x: 16.7, y: 84.4 }, goal: { x: 84.5, y: 15.5 }, radius: 8 },
  { map: "city", start: { x: 50, y: 91 }, goal: { x: 50, y: 20 }, radius: 8 },
  { map: "festival", start: { x: 50, y: 91 }, goal: { x: 50, y: 51 }, radius: 10 },
  { map: "rupture", start: { x: 11, y: 88 }, goal: { x: 50, y: 13 }, radius: 9 },
  { map: "aftermath", start: { x: 50, y: 92 }, goal: { x: 50, y: 18 }, radius: 9 },
];

function hasRoute({ map, start, goal, radius }) {
  const scale = 2;
  const startCell = [Math.round(start.x * scale), Math.round(start.y * scale)];
  const queue = [startCell];
  const visited = new Set([startCell.join(",")]);

  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    const position = { x: x / scale, y: y / scale };
    if (Math.hypot(position.x - goal.x, position.y - goal.y) < radius) return true;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy];
      const key = next.join(",");
      if (next[0] < 0 || next[0] > 200 || next[1] < 0 || next[1] > 200 || visited.has(key)) continue;
      if (!canStandAt(map, { x: next[0] / scale, y: next[1] / scale })) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

for (const route of routes) {
  assert.equal(canStandAt(route.map, route.start), true, `${route.map} start must be walkable`);
  assert.equal(canStandAt(route.map, route.goal), true, `${route.map} goal must be walkable`);
  assert.equal(hasRoute(route), true, `${route.map} must have a traversable route from start to goal`);
}

for (const y of [80, 78, 76, 74, 72, 70, 68]) {
  assert.equal(canStandAt("road", { x: 45, y }), true, `road central stairs must be open at y=${y}`);
}

for (const position of [{ x: 39, y: 51 }, { x: 66, y: 32 }, { x: 64, y: 68 }]) {
  assert.equal(isEncounterTerrain("road", position), true, `road grass must trigger encounters at ${JSON.stringify(position)}`);
}
assert.equal(terrainAt("road", { x: 16.7, y: 84.4 }), "ground");
assert.equal(isEncounterTerrain("city", { x: 50, y: 91 }), false);

const wallSlide = integrateActorMovement({
  position: { x: 40, y: 40 },
  deltaPixels: { x: 600, y: 300 },
  worldSize: { width: 1000, height: 1000 },
  isWalkable: ({ x }) => x < 50,
});
assert.equal(wallSlide.blockedX, true);
assert.equal(wallSlide.position.x < 50, true, "substeps must prevent tunneling through walls");
assert.equal(wallSlide.position.y > 40, true, "free axis must keep sliding along a wall");

console.log(`Overworld verification passed: ${routes.length} maps, stairs, grass, collision substeps.`);
