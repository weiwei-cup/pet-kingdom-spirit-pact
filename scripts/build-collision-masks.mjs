import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const MASK_WIDTH = 192;
const MASK_HEIGHT = 128;
const PREVIEW_DIR = process.env.COLLISION_PREVIEW_DIR;

const maps = [
  {
    id: "road",
    source: "public/pixel/route-map-v2.webp",
    start: [16.7, 84.4],
    goals: [[84.5, 15.5, 8]],
    floor: ({ r, g, b, light, spread }) => {
      const grass = g > 82 && g > r * 1.04 && g > b * 1.28 && light > 88;
      const earth = r > 132 && g > 105 && b < 132 && r > b * 1.28 && light > 118;
      const stone = spread < 44 && light > 116;
      return grass || earth || stone;
    },
    forceWalkable: [
      // The two river bridges and the two cliff stairways.
      [17.7, 52.5, 23.5, 61.5],
      [15.5, 61, 23.4, 70.5],
      [42.2, 68.0, 47.0, 80.5],
      [43.1, 24.7, 48.1, 35.3],
    ],
    forceBlocked: [
      // Castle walls. Only the central doorstep remains reachable.
      [70.5, 0, 100, 13.8],
      [70.5, 13.8, 80.8, 18.5],
      [88, 13.8, 100, 18.5],
    ],
  },
  {
    id: "city",
    source: "public/pixel/map-rainbow-city.webp",
    start: [50, 91],
    goals: [[50, 20, 8]],
    floor: ({ r, g, b, light, spread }) =>
      light > 132 && spread < 82 && r > b * 1.02 && g > b * 0.98,
    forceWalkable: [
      // Two broad stone lanes around the star fountain keep the grid route open.
      [38, 30, 41.5, 67],
      [58.5, 30, 62, 67],
      [38, 29, 62, 36],
      [38, 61, 62, 68],
    ],
    forceBlocked: [
      // Academy facade, fountain basin and four guardian statues.
      [0, 0, 43.7, 18.5],
      [56.3, 0, 100, 18.5],
      { ellipse: [50, 48.8, 6.2, 6.5] },
      { circle: [43.1, 38.5, 2.7] },
      { circle: [56.9, 38.5, 2.7] },
      { circle: [43.1, 57.2, 2.7] },
      { circle: [56.9, 57.2, 2.7] },
    ],
  },
  {
    id: "festival",
    source: "public/pixel/map-golden-festival.webp",
    start: [50, 91],
    goals: [[50, 51, 10]],
    floor: ({ r, g, b, light }) =>
      light > 103 && r > 92 && g > 62 && r > b * 1.08,
    forceWalkable: [
      [44, 80, 56, 100],
      [8, 44, 92, 57],
      // The rainbow mosaic is floor, not a raised obstacle.
      { circle: [50, 49, 10.5] },
    ],
    forceBlocked: [
      // Five raised ceremonial pads surrounding the walkable mosaic.
      { ellipse: [50, 35.2, 4.7, 4.9] },
      { ellipse: [38.2, 43.2, 4.4, 5.1] },
      { ellipse: [61.8, 43.2, 4.4, 5.1] },
      { ellipse: [38.8, 59.3, 4.5, 5.1] },
      { ellipse: [61.2, 59.3, 4.5, 5.1] },
      { ellipseArc: [50, 50, 33, 27.5, 2.8, 15, 75] },
      { ellipseArc: [50, 50, 33, 27.5, 2.8, 105, 165] },
      { ellipseArc: [50, 50, 33, 27.5, 2.8, 195, 255] },
      { ellipseArc: [50, 50, 33, 27.5, 2.8, 285, 345] },
      [34, 0, 66, 22],
    ],
  },
  {
    id: "rupture",
    source: "public/pixel/map-ruptured-plaza.webp",
    start: [11, 88],
    goals: [[19, 36, 8], [81, 38, 8], [50, 74, 8], [50, 13, 9]],
    floor: ({ r, g, b, light }) =>
      light > 48 && b > 42 && b > g * 1.03 && r > g * 0.88,
    forceWalkable: [
      // Narrow repairs only where bright stair edges interrupt the sampled floor.
      [16.4, 42.5, 23.5, 48.5],
      [52, 44, 78.5, 52.5],
      [76.5, 43, 83.5, 49],
      [46.3, 67, 54.5, 73],
      [47, 21, 53, 28],
    ],
    forceBlocked: [
      { ellipse: [17, 35, 6.6, 7.2] },
      { ellipse: [83, 38, 6.4, 7.3] },
      { ellipse: [52, 73, 6.2, 7.5] },
    ],
  },
  {
    id: "aftermath",
    source: "public/pixel/map-spirit-temple.webp",
    start: [50, 92],
    goals: [[50, 18, 9]],
    floor: ({ r, g, b, light, spread }) =>
      light > 113 && spread < 88 && r > b * 0.93 && g > b * 0.91,
    forceWalkable: [
      [45, 84, 55, 100],
      [45, 18, 55, 39],
      // Narrow stone ring around the central crystal; the surrounding void stays blocked.
      [39, 34, 43, 63],
      [57, 34, 61, 63],
      [39, 33, 61, 39],
      [39, 56, 61, 63],
    ],
    forceBlocked: [
      { ellipse: [50, 47, 7.4, 8.5] },
      { ellipse: [50, 10, 5, 7] },
      { circle: [27, 35.5, 2.8] },
      { circle: [73, 35.5, 2.8] },
      { circle: [27, 56, 2.8] },
      { circle: [73, 56, 2.8] },
      { circle: [38.2, 31.5, 2.2] },
      { circle: [61.8, 31.5, 2.2] },
      { circle: [38.2, 55, 2.2] },
      { circle: [61.8, 55, 2.2] },
      { circle: [38.2, 78, 2.5] },
      { circle: [61.8, 78, 2.5] },
      { ellipse: [9.8, 44, 5.4, 7] },
      { ellipse: [90.2, 44, 5.4, 7] },
      { ellipse: [9.8, 69, 5.4, 7] },
      { ellipse: [90.2, 69, 5.4, 7] },
    ],
  },
];

function insideShape(x, y, shape) {
  if (Array.isArray(shape)) {
    const [x1, y1, x2, y2] = shape;
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }
  if (shape.circle) {
    const [cx, cy, radius] = shape.circle;
    return Math.hypot(x - cx, y - cy) <= radius;
  }
  if (shape.ellipse) {
    const [cx, cy, radiusX, radiusY] = shape.ellipse;
    return ((x - cx) / radiusX) ** 2 + ((y - cy) / radiusY) ** 2 <= 1;
  }
  if (shape.ellipseArc) {
    const [cx, cy, radiusX, radiusY, thickness, startAngle, endAngle] = shape.ellipseArc;
    const normalizedX = (x - cx) / radiusX;
    const normalizedY = (y - cy) / radiusY;
    const radius = Math.hypot(normalizedX, normalizedY);
    let angle = (Math.atan2(normalizedY, normalizedX) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const normalizedThickness = thickness / Math.min(radiusX, radiusY);
    return Math.abs(radius - 1) <= normalizedThickness && angle >= startAngle && angle <= endAngle;
  }
  return false;
}

function quantizedSample(pixels, width, height, gridX, gridY) {
  const centerX = Math.round(((gridX + 0.5) / MASK_WIDTH) * (width - 1));
  const centerY = Math.round(((gridY + 0.5) / MASK_HEIGHT) * (height - 1));
  const radius = 5;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 2) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 2) {
      const index = (y * width + x) * 3;
      r += pixels[index];
      g += pixels[index + 1];
      b += pixels[index + 2];
      count += 1;
    }
  }
  r /= count;
  g /= count;
  b /= count;
  return {
    r,
    g,
    b,
    light: (r + g + b) / 3,
    spread: Math.max(r, g, b) - Math.min(r, g, b),
  };
}

function setShape(mask, shape, value) {
  for (let y = 0; y < MASK_HEIGHT; y += 1) {
    for (let x = 0; x < MASK_WIDTH; x += 1) {
      const px = ((x + 0.5) / MASK_WIDTH) * 100;
      const py = ((y + 0.5) / MASK_HEIGHT) * 100;
      if (insideShape(px, py, shape)) mask[y * MASK_WIDTH + x] = value;
    }
  }
}

function floodFromStart(mask, start) {
  const output = new Uint8Array(mask.length);
  const startX = Math.max(0, Math.min(MASK_WIDTH - 1, Math.floor((start[0] / 100) * MASK_WIDTH)));
  const startY = Math.max(0, Math.min(MASK_HEIGHT - 1, Math.floor((start[1] / 100) * MASK_HEIGHT)));
  const queue = [[startX, startY]];
  output[startY * MASK_WIDTH + startX] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= MASK_WIDTH || ny < 0 || ny >= MASK_HEIGHT) continue;
      const index = ny * MASK_WIDTH + nx;
      if (!mask[index] || output[index]) continue;
      output[index] = 1;
      queue.push([nx, ny]);
    }
  }
  return output;
}

function packBits(mask) {
  const bytes = Buffer.alloc(Math.ceil(mask.length / 8));
  mask.forEach((value, index) => {
    if (value) bytes[index >> 3] |= 1 << (index & 7);
  });
  return bytes.toString("base64");
}

function isFootWalkable(mask, position) {
  return [-0.58, 0, 0.58].every((offsetX) => {
    const x = position[0] + offsetX;
    const y = position[1];
    if (x < 0 || x >= 100 || y < 0 || y >= 100) return false;
    const maskX = Math.floor((x / 100) * MASK_WIDTH);
    const maskY = Math.floor((y / 100) * MASK_HEIGHT);
    return Boolean(mask[maskY * MASK_WIDTH + maskX]);
  });
}

function pathLengthToGoal(mask, start, goal) {
  const step = [100 / 48, 100 / 32];
  const queue = [[0, 0, 0]];
  const visited = new Set(["0,0"]);
  for (let head = 0; head < queue.length; head += 1) {
    const [offsetX, offsetY, distance] = queue[head];
    const position = [start[0] + offsetX * step[0], start[1] + offsetY * step[1]];
    if (Math.hypot(position[0] - goal[0], position[1] - goal[1]) < goal[2]) return distance;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nextOffsetX = offsetX + dx;
      const nextOffsetY = offsetY + dy;
      const key = `${nextOffsetX},${nextOffsetY}`;
      if (visited.has(key)) continue;
      const next = [start[0] + nextOffsetX * step[0], start[1] + nextOffsetY * step[1]];
      if (!isFootWalkable(mask, next)) continue;
      visited.add(key);
      queue.push([nextOffsetX, nextOffsetY, distance + 1]);
    }
  }
  const reachable = queue.map(([offsetX, offsetY]) => [start[0] + offsetX * step[0], start[1] + offsetY * step[1]]);
  const bounds = reachable.reduce((current, position) => ({
    minX: Math.min(current.minX, position[0]),
    maxX: Math.max(current.maxX, position[0]),
    minY: Math.min(current.minY, position[1]),
    maxY: Math.max(current.maxY, position[1]),
  }), { minX: 100, maxX: 0, minY: 100, maxY: 0 });
  console.error(`reachable bounds: ${JSON.stringify(bounds)} (${queue.length} grid positions)`);
  return null;
}

async function buildMap(map) {
  const image = sharp(path.join(ROOT, map.source)).removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const candidate = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
  for (let y = 0; y < MASK_HEIGHT; y += 1) {
    for (let x = 0; x < MASK_WIDTH; x += 1) {
      candidate[y * MASK_WIDTH + x] = map.floor(quantizedSample(data, info.width, info.height, x, y)) ? 1 : 0;
    }
  }
  for (const shape of map.forceWalkable ?? []) setShape(candidate, shape, 1);
  for (const shape of map.forceBlocked ?? []) setShape(candidate, shape, 0);
  const connected = floodFromStart(candidate, map.start);

  if (PREVIEW_DIR) {
    const rgba = Buffer.alloc(MASK_WIDTH * MASK_HEIGHT * 4);
    connected.forEach((value, index) => {
      rgba[index * 4] = value ? 65 : 222;
      rgba[index * 4 + 1] = value ? 255 : 42;
      rgba[index * 4 + 2] = value ? 113 : 42;
      rgba[index * 4 + 3] = value ? 150 : 105;
    });
    const overlay = await sharp(rgba, { raw: { width: MASK_WIDTH, height: MASK_HEIGHT, channels: 4 } })
      .resize(info.width, info.height, { kernel: "nearest" })
      .png()
      .toBuffer();
    await fs.mkdir(PREVIEW_DIR, { recursive: true });
    await sharp(path.join(ROOT, map.source))
      .composite([{ input: overlay, blend: "over" }])
      .png()
      .toFile(path.join(PREVIEW_DIR, `collision-${map.id}-preview.png`));
  }

  return { id: map.id, bits: packBits(connected), mask: connected, map };
}

const entries = [];
for (const map of maps) entries.push(await buildMap(map));

for (const entry of entries) {
  for (const goal of entry.map.goals) {
    const length = pathLengthToGoal(entry.mask, entry.map.start, goal);
    if (length === null) throw new Error(`${entry.id}: no grid path to ${goal.slice(0, 2).join(",")}`);
    console.log(`${entry.id}: ${length} steps to ${goal.slice(0, 2).join(",")}`);
  }
}

const output = `// Generated by scripts/build-collision-masks.mjs.\n` +
  `export const COLLISION_MASK_SIZE = { width: ${MASK_WIDTH}, height: ${MASK_HEIGHT} } as const;\n\n` +
  `export const COLLISION_MASK_BITS = ${JSON.stringify(Object.fromEntries(entries.map(({ id, bits }) => [id, bits])), null, 2)} as const;\n`;
await fs.writeFile(path.join(ROOT, "app/collision-mask-data.ts"), output);
console.log(`Generated ${entries.length} collision masks at ${MASK_WIDTH}x${MASK_HEIGHT}.`);
