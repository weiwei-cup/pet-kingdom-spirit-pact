import { TERRAIN_GRID_SIZE, WALKABLE_TERRAIN_BITS } from "./collision-mask-data";

export type OverworldMapId = keyof typeof WALKABLE_TERRAIN_BITS;
export type WorldPosition = { x: number; y: number };
export type WorldSize = { width: number; height: number };
export type TerrainKind = "blocked" | "ground" | "grass";
export type SceneDialogueLocks = {
  city: boolean;
  festival: boolean;
  aftermath: boolean;
};

type TerrainRect = { x1: number; y1: number; x2: number; y2: number; kind: Exclude<TerrainKind, "blocked"> };

// These zones are authored game data. Artwork can now be replaced without
// silently changing collision or encounter behavior.
const TERRAIN_ZONES: Partial<Record<OverworldMapId, TerrainRect[]>> = {
  road: [
    { x1: 31, y1: 42, x2: 47, y2: 61, kind: "grass" },
    { x1: 58, y1: 22, x2: 74, y2: 43, kind: "grass" },
    { x1: 56, y1: 60, x2: 72, y2: 75, kind: "grass" },
  ],
  highland: [
    { x1: 10, y1: 26, x2: 36, y2: 45, kind: "grass" },
    { x1: 57, y1: 56, x2: 83, y2: 78, kind: "grass" },
    { x1: 64, y1: 16, x2: 75, y2: 27, kind: "grass" },
  ],
  windPass: [
    { x1: 38, y1: 26, x2: 53, y2: 40, kind: "grass" },
    { x1: 37, y1: 47, x2: 51, y2: 61, kind: "grass" },
    { x1: 70, y1: 69, x2: 86, y2: 84, kind: "grass" },
  ],
  pasture: [
    { x1: 36, y1: 10, x2: 54, y2: 23, kind: "grass" },
    { x1: 76, y1: 29, x2: 91, y2: 44, kind: "grass" },
    { x1: 55, y1: 46, x2: 72, y2: 59, kind: "grass" },
    { x1: 48, y1: 79, x2: 66, y2: 91, kind: "grass" },
  ],
  observatory: [
    { x1: 20, y1: 23, x2: 34, y2: 41, kind: "grass" },
    { x1: 68, y1: 31, x2: 83, y2: 48, kind: "grass" },
    { x1: 34, y1: 53, x2: 45, y2: 68, kind: "grass" },
    { x1: 64, y1: 71, x2: 78, y2: 87, kind: "grass" },
  ],
};

const decodedTerrain = new Map<OverworldMapId, Uint8Array>();

function walkabilityFor(mapId: OverworldMapId) {
  const cached = decodedTerrain.get(mapId);
  if (cached) return cached;
  const binary = globalThis.atob(WALKABLE_TERRAIN_BITS[mapId]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  decodedTerrain.set(mapId, bytes);
  return bytes;
}

function isPointWalkable(mapId: OverworldMapId, position: WorldPosition) {
  if (position.x < 0 || position.x >= 100 || position.y < 0 || position.y >= 100) return false;
  const gridX = Math.min(TERRAIN_GRID_SIZE.width - 1, Math.floor((position.x / 100) * TERRAIN_GRID_SIZE.width));
  const gridY = Math.min(TERRAIN_GRID_SIZE.height - 1, Math.floor((position.y / 100) * TERRAIN_GRID_SIZE.height));
  const index = gridY * TERRAIN_GRID_SIZE.width + gridX;
  const bytes = walkabilityFor(mapId);
  return Boolean(bytes[index >> 3] & (1 << (index & 7)));
}

export function terrainAt(mapId: OverworldMapId, position: WorldPosition): TerrainKind {
  if (!isPointWalkable(mapId, position)) return "blocked";
  const zone = TERRAIN_ZONES[mapId]?.find((item) => (
    position.x >= item.x1 && position.x <= item.x2 && position.y >= item.y1 && position.y <= item.y2
  ));
  return zone?.kind ?? "ground";
}

export function hasActiveSceneDialogue(mapId: OverworldMapId, locks: SceneDialogueLocks) {
  if (mapId === "city") return locks.city;
  if (mapId === "festival") return locks.festival;
  if (mapId === "aftermath") return locks.aftermath;
  return false;
}

// The coordinate is the center of the actor's feet, not the center of the art.
// Five probes approximate the 16x16 foot box used by the original engine while
// keeping narrow stairways and bridges usable.
const FOOT_PROBES: WorldPosition[] = [
  { x: -0.58, y: -0.32 },
  { x: 0, y: -0.4 },
  { x: 0.58, y: -0.32 },
  { x: -0.58, y: 0.24 },
  { x: 0.58, y: 0.24 },
];

export function canStandAt(mapId: OverworldMapId, position: WorldPosition) {
  return FOOT_PROBES.every((probe) => isPointWalkable(mapId, {
    x: position.x + probe.x,
    y: position.y + probe.y,
  }));
}

export function isEncounterTerrain(mapId: OverworldMapId, position: WorldPosition) {
  return [-0.45, 0, 0.45].some((offsetX) => terrainAt(mapId, { x: position.x + offsetX, y: position.y }) === "grass");
}

export function integrateActorMovement(options: {
  position: WorldPosition;
  deltaPixels: WorldPosition;
  worldSize: WorldSize;
  isWalkable: (position: WorldPosition) => boolean;
  maxSubstep?: number;
}) {
  const { deltaPixels, worldSize, isWalkable } = options;
  const maxSubstep = options.maxSubstep ?? 3;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaPixels.x), Math.abs(deltaPixels.y)) / maxSubstep));
  const stepPercent = {
    x: (deltaPixels.x / steps / Math.max(1, worldSize.width)) * 100,
    y: (deltaPixels.y / steps / Math.max(1, worldSize.height)) * 100,
  };
  let position = { ...options.position };
  let blockedX = false;
  let blockedY = false;

  for (let index = 0; index < steps; index += 1) {
    const diagonal = { x: position.x + stepPercent.x, y: position.y + stepPercent.y };
    if (isWalkable(diagonal)) {
      position = diagonal;
      continue;
    }

    // Resolve each axis separately when a diagonal step touches a wall. This is
    // the original games' wall-slide behavior and avoids sticky cliff corners.
    const horizontalFirst = Math.abs(deltaPixels.x) >= Math.abs(deltaPixels.y);
    const attempts = horizontalFirst ? ["x", "y"] as const : ["y", "x"] as const;

    for (const axis of attempts) {
      if ((axis === "x" ? stepPercent.x : stepPercent.y) === 0) continue;
      const candidate = axis === "x"
        ? { x: position.x + stepPercent.x, y: position.y }
        : { x: position.x, y: position.y + stepPercent.y };
      if (isWalkable(candidate)) position = candidate;
      else if (axis === "x") blockedX = true;
      else blockedY = true;
    }
  }

  const movedPixels = Math.hypot(
    ((position.x - options.position.x) / 100) * worldSize.width,
    ((position.y - options.position.y) / 100) * worldSize.height,
  );
  return { position, movedPixels, blockedX, blockedY };
}
