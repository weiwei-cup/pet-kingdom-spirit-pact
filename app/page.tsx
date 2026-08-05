"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLLISION_MASK_BITS, COLLISION_MASK_SIZE } from "./collision-mask-data";

type Phase =
  | "title"
  | "name"
  | "shelter"
  | "road"
  | "capture"
  | "city"
  | "exam"
  | "festival"
  | "rupture"
  | "boss"
  | "aftermath"
  | "ending";

type PartnerId = "leaf" | "metal" | "tide";
type PetArtId = PartnerId | "wild" | "bird" | "guardian";
type PetSpeciesId = PetArtId;
type RouteEncounterId = "wild" | "bird";
type CharacterVariant = "player" | "keeper" | "noah" | "jingjing" | "sergi" | "angela";
type Position = { x: number; y: number };
type Size = { width: number; height: number };
type MapRect = { x1: number; y1: number; x2: number; y2: number };
type ExplorationPhase = "road" | "city" | "festival" | "rupture" | "aftermath";
type CollectionView = "bag" | "dex";
type PetElement = "plant" | "metal" | "water" | "beast" | "wind" | "spirit";
type PetStats = { hp: number; attack: number; defense: number; spirit: number; speed: number };
type PetSkill = { name: string; level: number; element: PetElement; power: number | null; description: string };
type PetSpecies = {
  id: PetSpeciesId;
  number: number;
  name: string;
  element: PetElement;
  elementLabel: string;
  category: string;
  role: string;
  habitat: string;
  rarity: "常见" | "少见" | "珍稀" | "传说";
  defaultLevel: number;
  description: string;
  stats: PetStats;
  skills: PetSkill[];
};
type SaveData = {
  phase: Phase;
  playerName: string;
  partnerId: PartnerId | null;
  captured: boolean;
  capturedPetId?: RouteEncounterId;
  ownedPetIds?: PetSpeciesId[];
  seenPetIds?: PetSpeciesId[];
};

type Partner = {
  id: PartnerId;
  name: string;
  kind: string;
  nature: string;
  quote: string;
  color: string;
  hp: number;
  attack: string;
  support: string;
};

type DialogueLine = {
  speaker: string;
  role?: string;
  text: string;
  tone?: "normal" | "warning" | "soft";
};

type RoadFacing = "up" | "down" | "left" | "right";
type BattleSide = "ally" | "enemy" | "trainer";
type BattleFxKind = PartnerId | "wind" | "guard" | "heal" | "calm" | "capsule" | "memory" | "call" | "claw";
type BattleFxStage = "announce" | "charge" | "launch" | "impact";

type BattleFx = {
  id: number;
  skill: string;
  kind: BattleFxKind;
  attacker: BattleSide;
  target: Exclude<BattleSide, "trainer">;
  stage: BattleFxStage;
  value?: string;
  positive?: boolean;
};

type BattleFxInput = Omit<BattleFx, "id" | "stage">;

type RouteEncounter = {
  id: RouteEncounterId;
  name: string;
  kind: string;
  level: number;
  maxHp: number;
};

type ExplorationMapDefinition = {
  id: ExplorationPhase;
  image: string;
  name: string;
  start: Position;
  interaction: Position;
  grass?: MapRect[];
  missionTitle: string;
  missionText: string;
  collisionText: string;
};

const SAVE_KEY = "pet-kingdom-spirit-pact-prologue-v1";

const PARTNERS: Record<PartnerId, Partner> = {
  leaf: {
    id: "leaf",
    name: "叶团子",
    kind: "植物系",
    nature: "胆小 · 体贴",
    quote: "躲在叶筐里，只肯把果子分给信任的人。",
    color: "#62a86f",
    hp: 66,
    attack: "芽叶拍击",
    support: "新芽守护",
  },
  metal: {
    id: "metal",
    name: "铆钉狐",
    kind: "金属系",
    nature: "骄傲 · 可靠",
    quote: "会向每个靠近的人挑战，却悄悄守着照护所的大门。",
    color: "#8397a8",
    hp: 58,
    attack: "银尾突进",
    support: "反光甲片",
  },
  tide: {
    id: "tide",
    name: "潮尾獭",
    kind: "海洋系",
    nature: "顽皮 · 好奇",
    quote: "把推荐信藏进水桶，只为看看你会不会追上来。",
    color: "#4f9eb7",
    hp: 62,
    attack: "潮泡连弹",
    support: "清凉水幕",
  },
};

const PET_ART: Record<PetArtId, string> = {
  leaf: "./pixel/pet-leaf.png?v=2",
  metal: "./pixel/pet-metal.png?v=2",
  tide: "./pixel/pet-tide.png?v=2",
  wild: "./pixel/pet-wild.png?v=2",
  bird: "./pixel/pet-bird.png?v=2",
  guardian: "./pixel/pet-guardian.png?v=2",
};

const PET_SPECIES_ORDER: PetSpeciesId[] = ["leaf", "metal", "tide", "wild", "bird", "guardian"];

const PET_SPECIES: Record<PetSpeciesId, PetSpecies> = {
  leaf: {
    id: "leaf",
    number: 1,
    name: "叶团子",
    element: "plant",
    elementLabel: "植物系",
    category: "新芽宠物",
    role: "守护 · 回复",
    habitat: "临虹村果园与温暖林地",
    rarity: "少见",
    defaultLevel: 5,
    description: "会把积攒的阳光藏进头顶嫩叶。胆子虽小，却会在伙伴受伤时第一个挡在前面。",
    stats: { hp: 66, attack: 42, defense: 54, spirit: 67, speed: 36 },
    skills: [
      { name: "芽叶拍击", level: 1, element: "plant", power: 38, description: "以卷起的嫩叶连续拍击目标。" },
      { name: "新芽守护", level: 4, element: "plant", power: null, description: "恢复少量体力，并提高一回合防御。" },
      { name: "藤蔓牵引", level: 9, element: "plant", power: 58, description: "从地面唤出藤蔓，较低概率降低速度。" },
    ],
  },
  metal: {
    id: "metal",
    number: 2,
    name: "铆钉狐",
    element: "metal",
    elementLabel: "金属系",
    category: "铆甲宠物",
    role: "强攻 · 反击",
    habitat: "彩虹城旧工坊与矿石仓",
    rarity: "少见",
    defaultLevel: 5,
    description: "尾巴上的铆片会随情绪开合。认定训练师后，会把每一次挑衅都当成守护伙伴的挑战。",
    stats: { hp: 58, attack: 69, defense: 72, spirit: 38, speed: 48 },
    skills: [
      { name: "银尾突进", level: 1, element: "metal", power: 44, description: "用硬化尾甲高速冲撞目标。" },
      { name: "反光甲片", level: 4, element: "metal", power: null, description: "展开甲片，本回合受到的伤害减半。" },
      { name: "铆钉连射", level: 10, element: "metal", power: 62, description: "射出两轮金属碎片，擅长击破护盾。" },
    ],
  },
  tide: {
    id: "tide",
    number: 3,
    name: "潮尾獭",
    element: "water",
    elementLabel: "海洋系",
    category: "潮汐宠物",
    role: "均衡 · 控场",
    habitat: "青崖水道与彩虹城水渠",
    rarity: "少见",
    defaultLevel: 5,
    description: "能用尾巴感知水流的细微变化。喜欢恶作剧，却从不把伙伴遗失的东西留在水底。",
    stats: { hp: 62, attack: 55, defense: 46, spirit: 64, speed: 63 },
    skills: [
      { name: "潮泡连弹", level: 1, element: "water", power: 40, description: "连续发射压缩水泡攻击目标。" },
      { name: "清凉水幕", level: 4, element: "water", power: null, description: "清除一种负面状态并恢复少量体力。" },
      { name: "回流尾击", level: 9, element: "water", power: 60, description: "借回流摆尾攻击，先手时威力提高。" },
    ],
  },
  wild: {
    id: "wild",
    number: 4,
    name: "茸角鼠",
    element: "beast",
    elementLabel: "猛兽系",
    category: "藏果宠物",
    role: "耐久 · 干扰",
    habitat: "临虹村外的金色高草",
    rarity: "常见",
    defaultLevel: 4,
    description: "茸角会随季节长出不同形状。它会记住分享食物的人，也会用落叶掩好对方走过的痕迹。",
    stats: { hp: 71, attack: 48, defense: 57, spirit: 33, speed: 41 },
    skills: [
      { name: "角芽冲撞", level: 1, element: "beast", power: 42, description: "低头冲撞，有小概率使目标畏缩。" },
      { name: "藏果", level: 5, element: "plant", power: null, description: "吃掉藏起的果实，恢复最大体力的四分之一。" },
      { name: "滚叶突袭", level: 11, element: "beast", power: 64, description: "裹着落叶高速翻滚，防御越高威力越大。" },
    ],
  },
  bird: {
    id: "bird",
    number: 5,
    name: "银羽雀",
    element: "wind",
    elementLabel: "飞行系",
    category: "巡风宠物",
    role: "高速 · 连击",
    habitat: "彩虹学院尖塔与青崖上空",
    rarity: "常见",
    defaultLevel: 5,
    description: "银色飞羽能分辨灵契的方向。学院常让它们担任信使，但它们只把信送给真正尊重宠物的人。",
    stats: { hp: 49, attack: 58, defense: 39, spirit: 52, speed: 78 },
    skills: [
      { name: "疾速啄击", level: 1, element: "wind", power: 36, description: "依靠速度发动的先制攻击。" },
      { name: "回旋风刃", level: 5, element: "wind", power: 52, description: "盘旋后斩出风刃，较容易连续行动。" },
      { name: "羽光加速", level: 10, element: "wind", power: null, description: "抖落银羽，大幅提高自身速度。" },
    ],
  },
  guardian: {
    id: "guardian",
    number: 6,
    name: "白裂狮",
    element: "spirit",
    elementLabel: "灵契系",
    category: "晶核守卫",
    role: "首领 · 灵能",
    habitat: "万灵神殿深层",
    rarity: "传说",
    defaultLevel: 18,
    description: "曾负责守护万灵晶核。灵契断裂后，它仍凭残存的三段记忆守在神殿，等待有人再次呼唤其名。",
    stats: { hp: 86, attack: 76, defense: 73, spirit: 91, speed: 59 },
    skills: [
      { name: "裂痕爪", level: 1, element: "spirit", power: 68, description: "撕开短暂裂隙，对守护效果造成额外伤害。" },
      { name: "断契咆哮", level: 12, element: "spirit", power: null, description: "扰乱双方灵契，降低目标攻击与灵力。" },
      { name: "记忆回响", level: 18, element: "spirit", power: 82, description: "记忆越完整，造成的灵契伤害越高。" },
    ],
  },
};

const STARTER_SIGHTINGS: PetSpeciesId[] = ["leaf", "metal", "tide"];

function mergePetIds(...groups: PetSpeciesId[][]) {
  return Array.from(new Set(groups.flat()));
}

function isPetSpeciesId(value: unknown): value is PetSpeciesId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PET_SPECIES, value);
}

function storySightingsForPhase(phase: Phase) {
  const sightings = [...STARTER_SIGHTINGS];
  if (["exam", "festival", "rupture", "boss", "aftermath", "ending"].includes(phase)) sightings.push("bird");
  if (["boss", "aftermath", "ending"].includes(phase)) sightings.push("guardian");
  return sightings;
}

const CHARACTER_ART: Record<CharacterVariant, string> = {
  player: "./pixel/character-player.png?v=2",
  keeper: "./pixel/character-keeper.png?v=2",
  noah: "./pixel/character-noah.png?v=2",
  jingjing: "./pixel/character-jingjing.png?v=2",
  sergi: "./pixel/character-sergi.png?v=2",
  angela: "./pixel/character-angela.png?v=2",
};

const MAP_PLAYER_ART = "./pixel/player-walk-atlas.webp?v=3";

const SCENE_ART: Record<Phase, string> = {
  title: "./pixel/title-landscape.webp?v=2",
  name: "./pixel/shelter-interior.webp?v=2",
  shelter: "./pixel/shelter-interior.webp?v=2",
  road: "./pixel/route-map-v2.webp?v=3",
  capture: "./pixel/route-map-v2.webp?v=3",
  city: "./pixel/map-rainbow-city.webp?v=4",
  exam: "./pixel/academy-arena.webp?v=2",
  festival: "./pixel/map-golden-festival.webp?v=4",
  rupture: "./pixel/map-ruptured-plaza.webp?v=4",
  boss: "./pixel/spirit-sanctum.webp?v=2",
  aftermath: "./pixel/map-spirit-temple.webp?v=4",
  ending: "./pixel/map-east-highland.webp?v=4",
};

const FESTIVAL_HEROES: Array<{ name: string; variant: CharacterVariant }> = [
  { name: "晶晶", variant: "jingjing" },
  { name: "帅帅", variant: "player" },
  { name: "卢克", variant: "noah" },
  { name: "米罗", variant: "angela" },
  { name: "塞其", variant: "sergi" },
];

const FESTIVAL_LINES: DialogueLine[] = [
  { speaker: "塞其", role: "现任黄金训练师", text: "欢迎来到彩虹学院。今天之后，你们之中会有人第一次与宠物立下灵契。" },
  { speaker: "帅帅", role: "前代黄金训练师", text: "先说好，考核输给姐姐不丢人——我小时候也只输过那么一点点。" },
  { speaker: "晶晶", role: "训练师协会会长", text: "是每一次都输。还有，别教坏新人。" },
  { speaker: "卢克", role: "金属地区代表", text: "五座旧国的共鸣灯已经点亮。仪式可以开始了。" },
  { speaker: "米罗", role: "宠物小村守望者", text: "奇怪……从刚才开始，宠物们都在看神殿的方向。" },
  { speaker: "塞其", text: "以万灵晶核为证——愿每一份选择，都被世界听见。", tone: "soft" },
  { speaker: "？？？", text: "归零程序，启动。", tone: "warning" },
];

const AFTERMATH_LINES: DialogueLine[] = [
  { speaker: "旁白", text: "守护宠物恢复意识的同一刻，彩虹神殿传来一声巨响。" },
  { speaker: "安琪儿", role: "调查员", text: "塞其，别让他们重新连接共鸣台。三年前我们打败的，从来都不是幕后的人。", tone: "warning" },
  { speaker: "塞其", text: "安琪儿，把晶核放下。至少告诉我，你看见了谁。" },
  { speaker: "安琪儿", text: "现在说出来，只会让真正的内应知道我们掌握了多少。" },
  { speaker: "旁白", text: "她跃上飞行宠物，带着破裂的万灵晶核消失在云层中。学院随后公布证据，将她列为首要嫌疑人。" },
  { speaker: "塞其", text: "我会在所有人面前追捕她。但你看见了守护宠物的记忆——去东之高原，找到那枚黑色铃铛。" },
  { speaker: "塞其", text: "还有一件事：不要让任何人替你的伙伴补办灵契登记。包括我。", tone: "soft" },
  { speaker: "安琪儿的残影", text: "如果你听见这段记忆，说明还有一种灵契没有被他们控制。不要把晶核交给任何人。", tone: "warning" },
];

const MEMORY_TEXT = [
  "幼年的塞其曾在雨中抱住受伤的白裂狮。",
  "黑色手套把一枚铃铛装进共鸣台下方。",
  "安琪儿冲进神殿，她是在阻止仪式。",
];

const ROUTE_ENCOUNTERS: Record<RouteEncounterId, RouteEncounter> = {
  wild: { id: "wild", name: "茸角鼠", kind: "猛兽系", level: 4, maxHp: 32 },
  bird: { id: "bird", name: "银羽雀", kind: "飞行系", level: 5, maxHp: 36 },
};

const MAP_PIXEL_SIZE = { width: 1536, height: 1024 };
const ROAD_STEP = { x: 100 / 48, y: 100 / 32 };
const ROAD_START: Position = { x: 16.7, y: 84.4 };
const CITY_GATE: Position = { x: 84.5, y: 15.5 };

const EXPLORATION_MAPS: Record<ExplorationPhase, ExplorationMapDefinition> = {
  road: {
    id: "road",
    image: SCENE_ART.road,
    name: "临虹村外 · 青崖水道",
    start: ROAD_START,
    interaction: CITY_GATE,
    missionTitle: "第一次野外捕捉",
    missionText: "沿真实道路穿过高草，再从中央石阶绕向东北城门。",
    collisionText: "这里是河面、峭壁或装饰障碍，不能通行。",
    grass: [
      { x1: 31, y1: 42, x2: 47, y2: 61 },
      { x1: 58, y1: 22, x2: 74, y2: 43 },
      { x1: 56, y1: 60, x2: 72, y2: 75 },
    ],
  },
  city: {
    id: "city",
    image: SCENE_ART.city,
    name: "彩虹城 · 学院区",
    start: { x: 50, y: 91 },
    interaction: { x: 50, y: 20 },
    missionTitle: "拜访彩虹学院",
    missionText: "沿中央大道绕过星泉，在学院门前与诺亚交谈。",
    collisionText: "水渠、花坛、雕像和建筑都不能穿过。",
  },
  festival: {
    id: "festival",
    image: SCENE_ART.festival,
    name: "黄金庆典 · 万灵广场",
    start: { x: 50, y: 91 },
    interaction: { x: 50, y: 51 },
    missionTitle: "走向庆典共鸣环",
    missionText: "穿过灯市，前往中央彩虹纹章与历代训练师会合。",
    collisionText: "摊位、花台、灯架和舞台边缘不能穿过。",
  },
  rupture: {
    id: "rupture",
    image: SCENE_ART.rupture,
    name: "异变城区 · 断契浮台",
    start: { x: 11, y: 88 },
    interaction: { x: 50, y: 13 },
    missionTitle: "稳定三处灵契节点",
    missionText: "沿三条安全石路逐一接近发光晶柱，最后前往上方裂隙台。",
    collisionText: "深渊、断桥、裂缝和坍塌建筑都不能通行。",
  },
  aftermath: {
    id: "aftermath",
    image: SCENE_ART.aftermath,
    name: "万灵神殿 · 月白回廊",
    start: { x: 50, y: 92 },
    interaction: { x: 50, y: 18 },
    missionTitle: "追上安琪儿",
    missionText: "中央晶核阻断了直路，从左右回廊绕行至记忆祭台。",
    collisionText: "虚空、能量渠、立柱、雕像和破碎晶核不能穿过。",
  },
};

const SCENE_PRELOADS: Partial<Record<Phase, string[]>> = {
  name: [SCENE_ART.road],
  shelter: [SCENE_ART.road],
  road: [SCENE_ART.city],
  capture: [SCENE_ART.city],
  city: [SCENE_ART.exam],
  exam: [SCENE_ART.festival],
  festival: [SCENE_ART.rupture],
  rupture: [SCENE_ART.boss],
  boss: [SCENE_ART.aftermath],
  aftermath: [SCENE_ART.ending],
};

const RUPTURE_NODE_POSITIONS: Position[] = [
  { x: 19, y: 36 },
  { x: 81, y: 38 },
  { x: 50, y: 74 },
];

const collisionMaskCache = new Map<ExplorationPhase, Uint8Array>();

function inMapRect(position: Position, rect: MapRect) {
  return position.x >= rect.x1 && position.x <= rect.x2 && position.y >= rect.y1 && position.y <= rect.y2;
}

function isMapWalkable(map: ExplorationMapDefinition, position: Position) {
  const encoded = COLLISION_MASK_BITS[map.id];
  let bytes = collisionMaskCache.get(map.id);
  if (!bytes) {
    const binary = globalThis.atob(encoded);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    collisionMaskCache.set(map.id, bytes);
  }

  // Sample the width of the character's feet, not the middle of the sprite.
  // This prevents a single green edge pixel from letting the body overlap a cliff.
  return [-0.58, 0, 0.58].every((offsetX) => {
    const x = position.x + offsetX;
    const y = position.y;
    if (x < 0 || x >= 100 || y < 0 || y >= 100) return false;
    const maskX = Math.floor((x / 100) * COLLISION_MASK_SIZE.width);
    const maskY = Math.floor((y / 100) * COLLISION_MASK_SIZE.height);
    const index = maskY * COLLISION_MASK_SIZE.width + maskX;
    return Boolean(bytes[index >> 3] & (1 << (index & 7)));
  });
}

function isGrassTile(map: ExplorationMapDefinition, position: Position) {
  return map.grass?.some((zone) => inMapRect(position, zone)) ?? false;
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function PetSprite({ id, size = "md", sleeping = false, glitched = false }: { id: PetArtId; size?: "sm" | "md" | "lg" | "xl"; sleeping?: boolean; glitched?: boolean }) {
  return (
    <div className={`pet-sprite pet-${id} pet-${size}${sleeping ? " sleeping" : ""}${glitched ? " glitched" : ""}`} aria-hidden="true">
      <i className="sprite-shadow" />
      <img src={PET_ART[id]} alt="" draggable={false} />
      {sleeping && <b className="sleep-mark">z</b>}
    </div>
  );
}

function Character({ name, variant = "player", small = false }: { name: string; variant?: CharacterVariant; small?: boolean }) {
  return (
    <div className={`character character-${variant}${small ? " character-small" : ""}`} aria-label={name}>
      <i className="sprite-shadow" />
      <img src={CHARACTER_ART[variant]} alt="" draggable={false} />
    </div>
  );
}

function MapPlayerSprite({ facing, moving, step }: { facing: RoadFacing; moving: boolean; step: number }) {
  const row = { down: 0, left: 1, right: 2, up: 3 }[facing];
  const column = moving ? (step % 2 === 0 ? 0 : 2) : 1;
  const x = column === 0 ? 0 : column === 1 ? 50 : 100;
  const y = row === 0 ? 0 : row === 1 ? 100 / 3 : row === 2 ? 200 / 3 : 100;
  return (
    <span
      className="map-player-frame"
      style={{ backgroundImage: `url(${MAP_PLAYER_ART})`, backgroundPosition: `${x}% ${y}%` }}
      aria-hidden="true"
    />
  );
}

function Meter({ value, max, kind = "hp" }: { value: number; max: number; kind?: "hp" | "calm" | "memory" }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter meter-${kind}`}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

const PET_STAT_LABELS: Array<{ key: keyof PetStats; label: string }> = [
  { key: "hp", label: "体力" },
  { key: "attack", label: "攻击" },
  { key: "defense", label: "防御" },
  { key: "spirit", label: "灵力" },
  { key: "speed", label: "速度" },
];

function PetCollectionModal({
  initialView,
  ownedPetIds,
  seenPetIds,
  starterId,
  onClose,
}: {
  initialView: CollectionView;
  ownedPetIds: PetSpeciesId[];
  seenPetIds: PetSpeciesId[];
  starterId: PartnerId | null;
  onClose: () => void;
}) {
  const initialSelection = initialView === "bag" ? ownedPetIds[0] ?? starterId ?? "leaf" : starterId ?? PET_SPECIES_ORDER[0];
  const [view, setView] = useState<CollectionView>(initialView);
  const [selectedId, setSelectedId] = useState<PetSpeciesId>(initialSelection);
  const owned = useMemo(() => new Set(ownedPetIds), [ownedPetIds]);
  const seen = useMemo(() => new Set(seenPetIds), [seenPetIds]);
  const selected = PET_SPECIES[selectedId];
  const selectedKnown = owned.has(selectedId) || seen.has(selectedId);
  const list = view === "bag" ? ownedPetIds : PET_SPECIES_ORDER;

  const changeView = (next: CollectionView) => {
    setView(next);
    if (next === "bag" && !owned.has(selectedId)) setSelectedId(ownedPetIds[0] ?? starterId ?? "leaf");
  };

  return (
    <div className="modal-backdrop collection-backdrop" onClick={onClose}>
      <section className="collection-modal" onClick={(event) => event.stopPropagation()} aria-label={view === "bag" ? "宠物背包" : "宠物图鉴"}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <header className="collection-header">
          <div><small>SPIRIT ARCHIVE</small><h2>{view === "bag" ? "宠物背包" : "宠物图鉴"}</h2></div>
          <div className="collection-progress">
            <span>{view === "bag" ? "同行席位" : "已发现"}</span>
            <b>{view === "bag" ? `${ownedPetIds.length} / 6` : `${seen.size} / ${PET_SPECIES_ORDER.length}`}</b>
          </div>
        </header>

        <nav className="collection-tabs" aria-label="宠物资料分类">
          <button type="button" className={view === "bag" ? "active" : ""} onClick={() => changeView("bag")}><i>包</i><span>宠物背包<small>同行伙伴</small></span></button>
          <button type="button" className={view === "dex" ? "active" : ""} onClick={() => changeView("dex")}><i>鉴</i><span>宠物图鉴<small>发现记录</small></span></button>
        </nav>

        <div className="collection-content">
          <div className={`pet-entry-list ${view === "dex" ? "dex-grid" : "bag-list"}`}>
            {list.length === 0 && <div className="empty-pet-bag"><b>背包还是空的</b><p>选择第一位伙伴后，宠物资料会出现在这里。</p></div>}
            {list.map((id, index) => {
              const species = PET_SPECIES[id];
              const isOwned = owned.has(id);
              const isSeen = seen.has(id) || isOwned;
              const state = isOwned ? (id === starterId ? "出战" : "同行") : isSeen ? "发现" : "未知";
              return (
                <button
                  type="button"
                  key={id}
                  className={`pet-entry element-${species.element}${selectedId === id ? " selected" : ""}${isSeen ? "" : " undiscovered"}`}
                  onClick={() => setSelectedId(id)}
                  aria-label={`${String(species.number).padStart(3, "0")} ${isSeen ? species.name : "未记录"}`}
                >
                  <span className="pet-entry-number">No.{String(species.number).padStart(3, "0")}</span>
                  <div className="pet-entry-sprite"><PetSprite id={id} size={view === "bag" ? "md" : "sm"} /></div>
                  <span className="pet-entry-copy"><b>{isSeen ? species.name : "未记录"}</b><small>{isSeen ? species.elementLabel : "???"}</small></span>
                  <em>{view === "bag" ? `Lv.${species.defaultLevel}` : state}</em>
                  {view === "bag" && <i className="party-slot">{String(index + 1).padStart(2, "0")}</i>}
                </button>
              );
            })}
          </div>

          <article className={`pet-detail-card element-${selected.element}${selectedKnown ? "" : " detail-locked"}`}>
            {!selectedKnown ? (
              <div className="locked-pet-detail">
                <span>No.{String(selected.number).padStart(3, "0")}</span>
                <div><PetSprite id={selected.id} size="xl" /></div>
                <h3>尚未发现</h3>
                <p>图鉴只留下了一条栖息线索：{selected.habitat}。</p>
              </div>
            ) : (
              <>
                <div className="pet-detail-hero">
                  <div className="pet-detail-sprite"><PetSprite id={selected.id} size="xl" /><span>Lv.{selected.defaultLevel}</span></div>
                  <div className="pet-detail-title">
                    <small>No.{String(selected.number).padStart(3, "0")} · {selected.category}</small>
                    <h3>{selected.name}</h3>
                    <div><span>{selected.elementLabel}</span><span>{selected.rarity}</span><span>{selected.role}</span></div>
                  </div>
                </div>
                <p className="pet-description">{selected.description}</p>
                <div className="pet-habitat"><span>主要栖息地</span><b>{selected.habitat}</b></div>
                <div className="pet-detail-columns">
                  <section className="pet-stat-panel">
                    <h4>基础能力</h4>
                    {PET_STAT_LABELS.map(({ key, label }) => <div className="pet-stat-row" key={key}><span>{label}</span><i><b style={{ width: `${selected.stats[key]}%` }} /></i><em>{selected.stats[key]}</em></div>)}
                    <small>基础能力上限为 100，实际数值会随等级成长。</small>
                  </section>
                  <section className="pet-skill-panel">
                    <h4>技能记录</h4>
                    {selected.skills.map((skill) => <div className={`pet-skill element-${skill.element}`} key={skill.name}><span><i>Lv.{skill.level}</i><b>{skill.name}</b><em>{skill.power === null ? "变化" : `威力 ${skill.power}`}</em></span><p>{skill.description}</p></div>)}
                  </section>
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function battleActorClass(side: Exclude<BattleSide, "trainer">, fx: BattleFx | null) {
  const classes = ["battle-pet", `${side}-pet`];
  if (!fx) return classes.join(" ");
  if (fx.attacker === side && fx.stage === "charge") classes.push("is-charging");
  if (fx.attacker === side && fx.stage === "launch") classes.push("is-attacking");
  if (fx.target === side && fx.stage === "impact") classes.push(fx.positive ? "is-buffed" : "is-hit");
  return classes.join(" ");
}

function BattleEffects({ fx }: { fx: BattleFx | null }) {
  if (!fx) return null;
  const isAction = fx.attacker === "trainer" ? "TRAINER ACTION" : fx.attacker === "ally" ? "PARTNER SKILL" : "ENEMY MOVE";
  return (
    <div className={`battle-fx-layer fx-${fx.kind} stage-${fx.stage}`} aria-live="polite">
      <div className="skill-banner"><small>{isAction}</small><b>{fx.skill}</b><i /></div>
      <div className={`fx-stream from-${fx.attacker} to-${fx.target}`} aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => <i key={index} />)}
      </div>
      {fx.stage === "impact" && (
        <>
          <div className={`impact-burst target-${fx.target}`} aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => <i key={index} />)}
          </div>
          {fx.value && <div className={`damage-pop target-${fx.target}${fx.positive ? " positive" : ""}`}>{fx.value}</div>}
        </>
      )}
      <div className="battle-speedlines" aria-hidden="true">{Array.from({ length: 9 }).map((_, index) => <i key={index} />)}</div>
    </div>
  );
}

function Dialogue({ lines, onComplete, backdrop }: { lines: DialogueLine[]; onComplete: () => void; backdrop?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const line = lines[index];
  const next = useCallback(() => {
    if (index >= lines.length - 1) onComplete();
    else setIndex((current) => current + 1);
  }, [index, lines.length, onComplete]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next]);

  return (
    <section className="dialogue-scene">
      <div className="dialogue-backdrop">{backdrop}</div>
      <div className={`dialogue-box dialogue-${line.tone ?? "normal"}`} onClick={next} role="button" tabIndex={0} aria-label="继续对话">
        <div className="speaker-seal">{line.speaker.slice(0, 1)}</div>
        <div className="dialogue-copy">
          <div className="speaker-line"><strong>{line.speaker}</strong>{line.role && <span>{line.role}</span>}</div>
          <p>{line.text}</p>
        </div>
        <div className="dialogue-progress"><span>{String(index + 1).padStart(2, "0")}</span> / {String(lines.length).padStart(2, "0")}</div>
        <button type="button" className="dialogue-next" onClick={(event) => { event.stopPropagation(); next(); }} aria-label="下一句">›</button>
      </div>
    </section>
  );
}

function DPad({ disabled, onMove, onInteract }: { disabled?: boolean; onMove: (dx: number, dy: number) => void; onInteract: () => void }) {
  return (
    <div className="touch-controls">
      <div className="dpad" aria-label="移动控制">
        <button type="button" disabled={disabled} onClick={() => onMove(0, -1)} aria-label="向上">▲</button>
        <button type="button" disabled={disabled} onClick={() => onMove(-1, 0)} aria-label="向左">◀</button>
        <i />
        <button type="button" disabled={disabled} onClick={() => onMove(1, 0)} aria-label="向右">▶</button>
        <button type="button" disabled={disabled} onClick={() => onMove(0, 1)} aria-label="向下">▼</button>
      </div>
      <button type="button" className="interact-button" disabled={disabled} onClick={onInteract}><span>E</span>互动</button>
    </div>
  );
}

function ExplorationScene({
  map,
  mapCamera,
  fieldViewportRef,
  partner,
  roadPos,
  roadFacing,
  roadMoving,
  roadStep,
  roadBumped,
  roadInGrass,
  toast,
  encounterPending,
  missionTitle,
  missionText,
  missionItems,
  markers,
  mapReady,
  onMapReady,
  onMove,
  onInteract,
}: {
  map: ExplorationMapDefinition;
  mapCamera: { width: number; height: number; x: number; y: number };
  fieldViewportRef: React.RefObject<HTMLDivElement | null>;
  partner: Partner;
  roadPos: Position;
  roadFacing: RoadFacing;
  roadMoving: boolean;
  roadStep: number;
  roadBumped: boolean;
  roadInGrass: boolean;
  toast: string;
  encounterPending: boolean;
  missionTitle: string;
  missionText: string;
  missionItems: Array<{ label: string; done?: boolean }>;
  markers?: React.ReactNode;
  mapReady: boolean;
  onMapReady: (mapId: ExplorationPhase) => void;
  onMove: (dx: number, dy: number) => void;
  onInteract: () => void;
}) {
  const [mapLoadError, setMapLoadError] = useState(false);
  const [mapLoadAttempt, setMapLoadAttempt] = useState(0);
  const mapSource = mapLoadAttempt === 0
    ? map.image
    : `${map.image}${map.image.includes("?") ? "&" : "?"}retry=${mapLoadAttempt}`;

  const handleMapLoaded = (image: HTMLImageElement) => {
    setMapLoadError(false);
    const decoding = typeof image.decode === "function" ? image.decode() : Promise.resolve();
    void decoding.catch(() => undefined).finally(() => onMapReady(map.id));
  };

  return (
    <section className={`field-screen area-${map.id} ${mapReady ? "map-ready" : "map-loading"}`} aria-busy={!mapReady}>
      <div className="mission-card">
        <small>{map.name}</small><h3>{missionTitle}</h3><p>{missionText}</p>
        <div className="mission-items">
          {missionItems.map((item) => <span key={item.label} className={item.done ? "done" : ""}>◇ {item.label}</span>)}
        </div>
      </div>
      <div className="field-world" ref={fieldViewportRef} aria-label={`${map.name}可探索地图`}>
        <div className="rpg-map" style={{ width: `${mapCamera.width}px`, height: `${mapCamera.height}px`, transform: `translate3d(${mapCamera.x}px, ${mapCamera.y}px, 0)` }}>
          <img
            className={`rpg-map-image${mapReady ? " is-ready" : ""}`}
            src={mapSource}
            alt={map.name}
            draggable={false}
            onLoad={(event) => handleMapLoaded(event.currentTarget)}
            onError={() => setMapLoadError(true)}
          />
          {markers}
          <div className={`map-player facing-${roadFacing}${roadMoving ? " is-walking" : ""}${roadBumped ? " is-bumping" : ""}${roadInGrass ? " in-grass" : ""}`} style={{ left: `${roadPos.x}%`, top: `${roadPos.y}%` }}>
            <i className="map-player-shadow" aria-hidden="true" />
            <MapPlayerSprite facing={roadFacing} moving={roadMoving} step={roadStep} />
            <div className="map-companion" aria-hidden="true"><PetSprite id={partner.id} size="sm" /></div>
            {roadInGrass && <i className="grass-foreground" aria-hidden="true" />}
          </div>
        </div>
      </div>
      {!mapReady && (
        <div className={`map-loading-overlay${mapLoadError ? " has-error" : ""}`} role="status" aria-live="polite">
          <i aria-hidden="true" />
          <strong>{mapLoadError ? "地图载入失败" : `正在进入${map.name}`}</strong>
          <p>{mapLoadError ? "场景资源没有成功抵达，请重新载入。" : "正在同步地图画面与可通行区域……"}</p>
          {mapLoadError && (
            <button type="button" onClick={() => { setMapLoadError(false); setMapLoadAttempt((attempt) => attempt + 1); }}>重新载入</button>
          )}
        </div>
      )}
      {encounterPending && <div className="encounter-transition"><i /><i /><strong>!</strong><p>{toast}</p></div>}
      <div className="field-toast"><span>{roadInGrass ? "草" : map.id === "rupture" ? "契" : map.id === "aftermath" ? "忆" : "路"}</span><p>{toast}</p><kbd>E</kbd></div>
      <DPad disabled={!mapReady} onMove={onMove} onInteract={onInteract} />
      <span className="map-control-hint">WASD / 方向键移动 · E 互动</span>
    </section>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("title");
  const [playerName, setPlayerName] = useState("小澈");
  const [draftName, setDraftName] = useState("小澈");
  const [partnerId, setPartnerId] = useState<PartnerId | null>(null);
  const [saveAvailable, setSaveAvailable] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [collectionView, setCollectionView] = useState<CollectionView | null>(null);
  const [ownedPetIds, setOwnedPetIds] = useState<PetSpeciesId[]>([]);
  const [seenPetIds, setSeenPetIds] = useState<PetSpeciesId[]>([]);
  const [toast, setToast] = useState("沿着石径前往彩虹城");
  const [battleFx, setBattleFx] = useState<BattleFx | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const battleFxId = useRef(0);

  const [roadPos, setRoadPos] = useState<Position>(ROAD_START);
  const [roadFacing, setRoadFacing] = useState<RoadFacing>("right");
  const [roadMoving, setRoadMoving] = useState(false);
  const [roadStep, setRoadStep] = useState(0);
  const [roadBumped, setRoadBumped] = useState(false);
  const [roadInGrass, setRoadInGrass] = useState(false);
  const [loadedMapId, setLoadedMapId] = useState<ExplorationPhase | null>(null);
  const [fieldSize, setFieldSize] = useState<Size>({ width: 1280, height: 720 });
  const [encounterPending, setEncounterPending] = useState(false);
  const [routeEncounterId, setRouteEncounterId] = useState<RouteEncounterId>("wild");
  const fieldViewportRef = useRef<HTMLDivElement | null>(null);
  const preloadedAssetsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const grassStepsRef = useRef(0);
  const roadStopTimer = useRef<number | null>(null);
  const roadBumpTimer = useRef<number | null>(null);
  const [berry, setBerry] = useState(true);
  const [wildHp, setWildHp] = useState(32);
  const [wildCalm, setWildCalm] = useState(0);
  const [balls, setBalls] = useState(3);
  const [captureWon, setCaptureWon] = useState(false);
  const [captureLog, setCaptureLog] = useState("茸角鼠被荆棘缠住，正警惕地望着你。");
  const [cityDialogueOpen, setCityDialogueOpen] = useState(false);
  const [festivalDialogueOpen, setFestivalDialogueOpen] = useState(false);
  const [aftermathDialogueOpen, setAftermathDialogueOpen] = useState(false);

  const [examHp, setExamHp] = useState(62);
  const [examEnemy, setExamEnemy] = useState(48);
  const [examWon, setExamWon] = useState(false);
  const [examGuard, setExamGuard] = useState(false);
  const [examLog, setExamLog] = useState("诺亚派出了银羽雀。考核开始！");

  const [ruptureNodes, setRuptureNodes] = useState<number[]>([]);
  const [bossHp, setBossHp] = useState(86);
  const [bossPlayerHp, setBossPlayerHp] = useState(68);
  const [memories, setMemories] = useState<string[]>([]);
  const [bossLog, setBossLog] = useState("白裂狮忘记了自己的名字。攻击只会让它更加狂暴。");
  const [bossWon, setBossWon] = useState(false);

  const partner = partnerId ? PARTNERS[partnerId] : null;
  const routeEncounter = ROUTE_ENCOUNTERS[routeEncounterId];
  const activeMap = (["road", "city", "festival", "rupture", "aftermath"] as Phase[]).includes(phase)
    ? EXPLORATION_MAPS[phase as ExplorationPhase]
    : null;
  const mapAssetReady = activeMap !== null && loadedMapId === activeMap.id;

  const mapCamera = useMemo(() => {
    const scale = Math.max(fieldSize.width / MAP_PIXEL_SIZE.width, fieldSize.height / MAP_PIXEL_SIZE.height, fieldSize.width < 700 ? 0.72 : 0.82);
    const width = MAP_PIXEL_SIZE.width * scale;
    const height = MAP_PIXEL_SIZE.height * scale;
    const playerX = (roadPos.x / 100) * width;
    const playerY = (roadPos.y / 100) * height;
    return {
      width,
      height,
      x: Math.min(0, Math.max(fieldSize.width - width, fieldSize.width / 2 - playerX)),
      y: Math.min(0, Math.max(fieldSize.height - height, fieldSize.height / 2 - playerY)),
    };
  }, [fieldSize, roadPos]);

  useEffect(() => {
    let hasSavedGame = false;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SaveData;
      if (saved.playerName && saved.phase) {
        hasSavedGame = true;
      }
    } catch {
      window.localStorage.removeItem(SAVE_KEY);
    }
    const timer = window.setTimeout(() => setSaveAvailable(hasSavedGame), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "title" || phase === "name") return;
    const save: SaveData = {
      phase,
      playerName,
      partnerId,
      captured,
      capturedPetId: captured ? routeEncounterId : undefined,
      ownedPetIds,
      seenPetIds,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [captured, ownedPetIds, partnerId, phase, playerName, routeEncounterId, seenPetIds]);

  useEffect(() => {
    for (const source of SCENE_PRELOADS[phase] ?? []) {
      if (preloadedAssetsRef.current.has(source)) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      preloadedAssetsRef.current.set(source, image);
    }
  }, [phase]);

  useEffect(() => () => {
    if (roadStopTimer.current !== null) window.clearTimeout(roadStopTimer.current);
    if (roadBumpTimer.current !== null) window.clearTimeout(roadBumpTimer.current);
  }, []);

  useEffect(() => {
    if (!activeMap || !fieldViewportRef.current) return;
    const viewport = fieldViewportRef.current;
    const updateSize = () => setFieldSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeMap, phase]);

  const playTone = useCallback((pitch = 440) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      // Audio is optional; game input should never depend on it.
    }
  }, [soundOn]);

  const animateBattleFx = useCallback(async (input: BattleFxInput, onImpact?: () => void) => {
    const id = ++battleFxId.current;
    const show = (stage: BattleFxStage) => setBattleFx({ ...input, id, stage });
    show("announce");
    playTone(input.positive ? 620 : input.attacker === "enemy" ? 180 : 390);
    await wait(320);
    show("charge");
    await wait(190);
    show("launch");
    playTone(input.kind === "tide" ? 540 : input.kind === "leaf" ? 470 : input.kind === "metal" ? 280 : 330);
    await wait(290);
    show("impact");
    onImpact?.();
    playTone(input.positive ? 760 : input.attacker === "enemy" ? 130 : 220);
    await wait(430);
    setBattleFx((current) => current?.id === id ? null : current);
    await wait(90);
  }, [playTone]);

  const prepareExplorationMap = useCallback((next: Phase) => {
    if (!(next in EXPLORATION_MAPS)) return;
    setLoadedMapId(null);
    if (next === "road") return;
    const map = EXPLORATION_MAPS[next as ExplorationPhase];
    setRoadPos(map.start);
    setRoadFacing("up");
    setRoadMoving(false);
    setRoadBumped(false);
    setRoadInGrass(false);
    setToast(map.missionText);
  }, []);

  const registerPetSightings = useCallback((ids: PetSpeciesId[]) => {
    setSeenPetIds((current) => mergePetIds(current, ids));
  }, []);

  const go = useCallback((next: Phase) => {
    playTone(next === "rupture" || next === "boss" ? 170 : 520);
    prepareExplorationMap(next);
    if (next === "shelter") registerPetSightings(STARTER_SIGHTINGS);
    if (next === "exam") registerPetSightings(["bird"]);
    if (next === "boss") registerPetSightings(["guardian"]);
    if (next === "city") setCityDialogueOpen(false);
    if (next === "festival") setFestivalDialogueOpen(false);
    if (next === "aftermath") setAftermathDialogueOpen(false);
    setPhase(next);
  }, [playTone, prepareExplorationMap, registerPetSightings]);

  const newGame = () => {
    window.localStorage.removeItem(SAVE_KEY);
    setPlayerName("小澈");
    setDraftName("小澈");
    setPartnerId(null);
    setCaptured(false);
    setCollectionView(null);
    setOwnedPetIds([]);
    setSeenPetIds([]);
    setBattleFx(null);
    setBattleBusy(false);
    setRoadPos(ROAD_START);
    setRoadFacing("right");
    setRoadMoving(false);
    setRoadStep(0);
    setRoadBumped(false);
    setRoadInGrass(false);
    setLoadedMapId(null);
    setEncounterPending(false);
    setRouteEncounterId("wild");
    grassStepsRef.current = 0;
    setBerry(true);
    setWildHp(32);
    setWildCalm(0);
    setBalls(3);
    setCaptureWon(false);
    setCaptureLog("高草突然晃动，一只茸角鼠警惕地跳了出来！");
    setCityDialogueOpen(false);
    setFestivalDialogueOpen(false);
    setAftermathDialogueOpen(false);
    setToast("沿道路前进，在高草里寻找野生宠物");
    setExamHp(62);
    setExamEnemy(48);
    setExamWon(false);
    setRuptureNodes([]);
    setBossHp(86);
    setBossPlayerHp(68);
    setMemories([]);
    setBossWon(false);
    go("name");
  };

  const continueGame = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return newGame();
      const saved = JSON.parse(raw) as SaveData;
      const restoredPartnerId = saved.partnerId && saved.partnerId in PARTNERS ? saved.partnerId : null;
      const restoredCapturedId: RouteEncounterId | null = saved.captured
        ? saved.capturedPetId === "bird" ? "bird" : "wild"
        : null;
      const restoredOwned = mergePetIds(
        (saved.ownedPetIds ?? []).filter(isPetSpeciesId),
        restoredPartnerId ? [restoredPartnerId] : [],
        restoredCapturedId ? [restoredCapturedId] : [],
      );
      const restoredPhase = saved.phase === "title" || saved.phase === "name" ? "shelter" : saved.phase;
      const restoredSeen = mergePetIds(
        storySightingsForPhase(restoredPhase),
        (saved.seenPetIds ?? []).filter(isPetSpeciesId),
        restoredOwned,
      );
      setPlayerName(saved.playerName || "小澈");
      setDraftName(saved.playerName || "小澈");
      setPartnerId(restoredPartnerId);
      setExamHp(restoredPartnerId ? PARTNERS[restoredPartnerId].hp : 62);
      setCaptured(Boolean(saved.captured));
      setRouteEncounterId(restoredCapturedId ?? "wild");
      setOwnedPetIds(restoredOwned);
      setSeenPetIds(restoredSeen);
      prepareExplorationMap(restoredPhase);
      setPhase(restoredPhase);
    } catch {
      newGame();
    }
  };

  const selectPartner = (id: PartnerId) => {
    setPartnerId(id);
    setOwnedPetIds([id]);
    registerPetSightings(STARTER_SIGHTINGS);
    setExamHp(PARTNERS[id].hp);
    playTone(id === "leaf" ? 480 : id === "metal" ? 330 : 580);
  };

  const triggerRoadMotion = useCallback((dx: number, dy: number, duration: number) => {
    if (Math.abs(dx) > Math.abs(dy)) setRoadFacing(dx < 0 ? "left" : "right");
    else if (dy !== 0) setRoadFacing(dy < 0 ? "up" : "down");
    setRoadMoving(true);
    setRoadStep((step) => step + 1);
    if (roadStopTimer.current !== null) window.clearTimeout(roadStopTimer.current);
    roadStopTimer.current = window.setTimeout(() => setRoadMoving(false), duration + 70);
  }, []);

  const beginRouteEncounter = useCallback((id: RouteEncounterId) => {
    const encounter = ROUTE_ENCOUNTERS[id];
    registerPetSightings([id]);
    setRouteEncounterId(id);
    setWildHp(encounter.maxHp);
    setWildCalm(0);
    setBalls(3);
    setCaptureWon(false);
    setCaptureLog(`高草突然晃动，${encounter.name}警惕地跳了出来！`);
    setToast(`野生的${encounter.name}出现了！`);
    setEncounterPending(true);
    playTone(210);
  }, [playTone, registerPetSightings]);

  const moveRoad = useCallback((dx: number, dy: number) => {
    if (encounterPending || !activeMap || !mapAssetReady || collectionView !== null || helpOpen) return;
    if (Math.abs(dx) > Math.abs(dy)) setRoadFacing(dx < 0 ? "left" : "right");
    else if (dy !== 0) setRoadFacing(dy < 0 ? "up" : "down");

    const next = {
      x: roadPos.x + Math.sign(dx) * ROAD_STEP.x,
      y: roadPos.y + Math.sign(dy) * ROAD_STEP.y,
    };
    if (!isMapWalkable(activeMap, next)) {
      setRoadMoving(false);
      setRoadBumped(true);
      setToast(activeMap.collisionText);
      playTone(115);
      if (roadBumpTimer.current !== null) window.clearTimeout(roadBumpTimer.current);
      roadBumpTimer.current = window.setTimeout(() => setRoadBumped(false), 190);
      return;
    }

    triggerRoadMotion(dx, dy, 125);
    setRoadPos(next);
    const inGrass = isGrassTile(activeMap, next);
    setRoadInGrass(inGrass);
    if (!inGrass) {
      grassStepsRef.current = 0;
      if (phase === "road") setToast(captured ? "沿石阶和道路绕向东北城门。" : "金色高草里有野生宠物活动的痕迹。");
      else setToast(activeMap.missionText);
      return;
    }
    if (captured) {
      setToast("高草沙沙作响。图鉴里已经有这片区域的记录。");
      return;
    }

    grassStepsRef.current += 1;
    const steps = grassStepsRef.current;
    const chance = steps < 3 ? 0 : Math.min(0.18 + (steps - 3) * 0.12, 0.72);
    setToast(steps < 3 ? "高草在脚边晃动……" : "附近传来了野生宠物的叫声！");
    if (steps >= 9 || Math.random() < chance) {
      grassStepsRef.current = 0;
      beginRouteEncounter(Math.random() < 0.28 ? "bird" : "wild");
    }
  }, [activeMap, beginRouteEncounter, captured, collectionView, encounterPending, helpOpen, mapAssetReady, phase, playTone, roadPos, triggerRoadMotion]);

  const exploreInteraction = useCallback(() => {
    if (!activeMap || !mapAssetReady || collectionView !== null || helpOpen) return;
    if (phase === "road" && distance(roadPos, activeMap.interaction) < 8) {
      if (!captured) {
        setToast("学院要求先完成一次野外捕捉练习。去高草区看看吧。");
        playTone(150);
        return;
      }
      setToast("城门守卫确认了图鉴记录。欢迎来到彩虹城！");
      go("city");
      return;
    }
    if (phase === "city" && distance(roadPos, activeMap.interaction) < 8) {
      setCityDialogueOpen(true);
      playTone(650);
      return;
    }
    if (phase === "festival" && distance(roadPos, activeMap.interaction) < 10) {
      setFestivalDialogueOpen(true);
      playTone(720);
      return;
    }
    if (phase === "rupture") {
      const node = RUPTURE_NODE_POSITIONS.findIndex((position, index) => !ruptureNodes.includes(index) && distance(roadPos, position) < 8);
      if (node >= 0) {
        const next = [...ruptureNodes, node];
        setRuptureNodes(next);
        playTone(300 + node * 120);
        setToast(next.length === 3 ? "三处灵契已稳定。沿中央石路前往上方裂隙台。" : `第 ${next.length} 处灵契已稳定，继续寻找其余晶柱。`);
        return;
      }
      if (ruptureNodes.length === 3 && distance(roadPos, activeMap.interaction) < 9) {
        go("boss");
        return;
      }
    }
    if (phase === "aftermath" && distance(roadPos, activeMap.interaction) < 9) {
      setAftermathDialogueOpen(true);
      playTone(620);
      return;
    }

    if (phase === "road") setToast(captured ? "沿可见道路前往东北城门，靠近后按 E。" : "进入金色高草移动，野生宠物会随机出现。");
    if (phase === "city") setToast("学院门位于地图上方；星泉、水渠和花坛均不可穿越。");
    if (phase === "festival") setToast("中央彩虹纹章是庆典会合点，靠近后按 E。");
    if (phase === "rupture") setToast(ruptureNodes.length === 3 ? "前往上方裂隙台。" : "靠近尚未稳定的发光晶柱后按 E。");
    if (phase === "aftermath") setToast("从左右回廊绕过中央晶核，前往上方记忆祭台。");
  }, [activeMap, captured, collectionView, go, helpOpen, mapAssetReady, phase, playTone, roadPos, ruptureNodes]);

  useEffect(() => {
    if (!encounterPending) return;
    const timer = window.setTimeout(() => {
      setEncounterPending(false);
      go("capture");
    }, 760);
    return () => window.clearTimeout(timer);
  }, [encounterPending, go]);

  useEffect(() => {
    if (!activeMap) return;
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e"].includes(key)) event.preventDefault();
      if (key === "arrowup" || key === "w") moveRoad(0, -1);
      if (key === "arrowdown" || key === "s") moveRoad(0, 1);
      if (key === "arrowleft" || key === "a") moveRoad(-1, 0);
      if (key === "arrowright" || key === "d") moveRoad(1, 0);
      if (key === "e") exploreInteraction();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeMap, exploreInteraction, moveRoad]);

  const captureAction = async (action: "attack" | "calm" | "ball") => {
    if (captureWon || battleBusy || !partner) return;
    setBattleBusy(true);
    try {
      if (action === "attack") {
        const damage = partnerId === "metal" ? 11 : 8;
        const nextHp = Math.max(4, wildHp - damage);
        setCaptureLog(`${partner.name}压低身体，准备使出${partner.attack}！`);
        await animateBattleFx({ skill: partner.attack, kind: partner.id, attacker: "ally", target: "enemy", value: `-${wildHp - nextHp}` }, () => setWildHp(nextHp));
        setCaptureLog(`${partner.attack}命中！${routeEncounter.name}踉跄后退，动作慢了下来。`);
        return;
      }
      if (action === "calm") {
        const nextCalm = Math.min(3, wildCalm + 1);
        setCaptureLog("你没有逼近，而是把香甜莓果轻轻放到了地上。");
        await animateBattleFx({ skill: "安抚 · 香甜莓果", kind: "calm", attacker: "trainer", target: "enemy", value: "戒备 ↓", positive: true }, () => setWildCalm(nextCalm));
        setCaptureLog(berry ? `${routeEncounter.name}嗅了嗅莓果，戒备的姿势慢慢放松下来。` : `${routeEncounter.name}仍然很戒备。`);
        return;
      }
      if (balls <= 0) {
        setCaptureLog("召唤胶囊已经用完了。黎叔的备用包里又滚出了两枚。");
        setBalls(2);
        return;
      }
      const captureThreshold = Math.ceil(routeEncounter.maxHp / 2);
      const success = wildHp <= captureThreshold && wildCalm >= 1;
      setCaptureLog(`召唤胶囊划出一道弧光，落在${routeEncounter.name}面前……`);
      await animateBattleFx({ skill: "召唤胶囊", kind: "capsule", attacker: "trainer", target: "enemy", value: success ? "灵契成立" : "挣脱！", positive: success }, () => {
        setBalls((value) => value - 1);
        if (success) {
          setCaptured(true);
          setCaptureWon(true);
          setOwnedPetIds((current) => mergePetIds(current, [routeEncounter.id]));
          registerPetSightings([routeEncounter.id]);
        }
      });
      setCaptureLog(success ? `胶囊没有强行关闭。${routeEncounter.name}主动触碰按钮，接受了你的邀请。` : wildHp > captureThreshold ? `${routeEncounter.name}还有力气挣脱。先让它停下来。` : "它的体力已经很低，但仍不信任你。试着安抚它。");
    } finally {
      setBattleBusy(false);
    }
  };

  const examAction = async (action: "attack" | "support") => {
    if (examWon || battleBusy || !partner) return;
    setBattleBusy(true);
    try {
      if (action === "support") {
        const isGuard = partnerId === "metal";
        setExamLog(`${partner.name}使出${partner.support}，银羽雀正在寻找反击角度。`);
        await animateBattleFx({ skill: partner.support, kind: isGuard ? "guard" : "heal", attacker: "ally", target: "ally", value: isGuard ? "伤害减半" : "HP +10", positive: true }, () => {
          if (isGuard) setExamGuard(true);
          else setExamHp((value) => Math.min(partner.hp, value + 10));
        });
        const incoming = isGuard ? 3 : 6;
        setExamLog("银羽雀振翅升空——风刃反击！");
        await animateBattleFx({ skill: "回旋风刃", kind: "wind", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
          setExamHp((value) => Math.max(8, value - incoming));
          setExamGuard(false);
        });
        setExamLog(isGuard ? `${partner.support}挡住了大半风刃，只受到 ${incoming} 点伤害。` : `${partner.support}稳住了阵脚，风刃造成 ${incoming} 点伤害。`);
        return;
      }
      const damage = partnerId === "metal" ? 13 : partnerId === "tide" ? 11 : 10;
      const nextEnemy = Math.max(0, examEnemy - damage);
      setExamLog(`${partner.name}锁定银羽雀，${partner.attack}即将发动！`);
      await animateBattleFx({ skill: partner.attack, kind: partner.id, attacker: "ally", target: "enemy", value: `-${examEnemy - nextEnemy}` }, () => setExamEnemy(nextEnemy));
      if (nextEnemy === 0) {
        setExamWon(true);
        setExamLog(`${partner.name}稳稳停在边线前。银羽雀失去战斗能力——考核通过！`);
        playTone(820);
        return;
      }
      const incoming = examGuard ? 3 : 7;
      setExamLog("银羽雀从冲击中翻身，立刻使出回旋风刃！");
      await animateBattleFx({ skill: "回旋风刃", kind: "wind", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
        setExamGuard(false);
        setExamHp((value) => Math.max(8, value - incoming));
      });
      setExamLog(`${partner.attack}造成 ${damage} 点伤害；银羽雀反击造成 ${incoming} 点伤害。`);
    } finally {
      setBattleBusy(false);
    }
  };

  const bossAction = async (action: "attack" | "protect" | "soothe" | "call") => {
    if (bossWon || battleBusy || !partner) return;
    setBattleBusy(true);
    try {
      if (action === "call") {
        const ready = memories.length === 3;
        setBossLog(ready ? `${playerName}没有下令攻击，而是大声呼唤那段记忆里的名字。` : "记忆还不完整。你仍试着穿过黑铃的噪声呼唤它……");
        await animateBattleFx({ skill: ready ? "真名呼唤 · 白裂狮" : "未完成的呼唤", kind: "call", attacker: "trainer", target: "enemy", value: ready ? "记忆苏醒" : "回应微弱", positive: true }, () => {
          if (ready) setBossWon(true);
        });
        setBossLog(ready ? "“白裂狮——塞其还在等你。” 它身上的灵纹重新亮起，利爪停在了你面前。" : "白裂狮似乎听见了一瞬，但记忆很快又被铃声淹没。");
        if (ready) playTone(880);
        return;
      }

      let incoming = 9;
      if (action === "attack") {
        const nextHp = Math.max(18, bossHp - 9);
        incoming = 10;
        setBossLog(`${partner.name}迎着利爪冲了上去——${partner.attack}！`);
        await animateBattleFx({ skill: partner.attack, kind: partner.id, attacker: "ally", target: "enemy", value: `-${bossHp - nextHp}` }, () => setBossHp(nextHp));
        setBossLog(nextHp === 18 ? "白裂狮已经到达极限，但黑铃仍在强迫它战斗！" : "白裂狮被击退半步，随即在黑铃声中再次扑来！");
      }
      if (action === "soothe") {
        incoming = 5;
        setBossLog(`${partner.name}没有攻击，而是展开${partner.support}守在你身前。`);
        await animateBattleFx({ skill: partner.support, kind: "guard", attacker: "ally", target: "ally", value: "伤害降低", positive: true });
      }
      if (action === "protect") {
        incoming = memories.length < 3 ? 4 : 3;
        const memory = memories.length < 3 ? MEMORY_TEXT[memories.length] : null;
        setBossLog(memory ? "一枚记忆碎片正从黑色裂隙中坠落——护住它！" : "三段记忆已经完整，继续守住它们！");
        await animateBattleFx({ skill: memory ? "守护记忆碎片" : "维系完整记忆", kind: "memory", attacker: "trainer", target: "ally", value: memory ? `记忆 ${memories.length + 1}/3` : "记忆稳定", positive: true }, () => {
          if (memory) setMemories((current) => [...current, memory]);
        });
        setBossLog(memory ? `你护住了记忆碎片：${memory}` : "三段记忆已经完整。现在，呼唤它真正的名字。");
      }

      setBossLog((current) => `${current} 白裂狮撕开黑雾，发动裂痕爪！`);
      await animateBattleFx({ skill: "裂痕爪", kind: "claw", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
        setBossPlayerHp((value) => {
          const next = value - incoming;
          return next <= 0 ? 22 : next;
        });
      });
      setBossLog((current) => `${current.replace(" 白裂狮撕开黑雾，发动裂痕爪！", "")} 你承受了 ${incoming} 点冲击。`);
    } finally {
      setBattleBusy(false);
    }
  };

  const chapterLabel = useMemo(() => {
    if (["title", "name", "shelter", "road", "capture"].includes(phase)) return "序章 · 临虹村";
    if (["city", "exam", "festival"].includes(phase)) return "序章 · 黄金庆典";
    if (["rupture", "boss", "aftermath"].includes(phase)) return "序章 · 灵契断裂";
    return "序章 · 没有登记的伙伴";
  }, [phase]);

  return (
    <main className={`game-shell phase-${phase}`}>
      <img className="scene-image" src={SCENE_ART[phase]} alt="" aria-hidden="true" draggable={false} />
      <div className="world-noise" />
      {phase !== "title" && (
        <header className="game-hud">
          <button type="button" className="mini-brand" onClick={() => setPhase("title")} aria-label="返回标题">
            <span className="brand-orb">契</span>
            <span><b>宠物王国</b><small>SPIRIT PACT</small></span>
          </button>
          <div className="chapter-label"><span />{chapterLabel}</div>
          <div className="hud-actions">
            {partner && <div className="partner-chip"><PetSprite id={partner.id} size="sm" /><span><small>{partner.kind}</small><b>{partner.name}</b></span></div>}
            {partner && <button type="button" className="icon-button collection-button" onClick={() => { setHelpOpen(false); setCollectionView("bag"); }} aria-label="打开宠物背包"><b>包</b><small>{ownedPetIds.length}/6</small></button>}
            {partner && <button type="button" className="icon-button collection-button" onClick={() => { setHelpOpen(false); setCollectionView("dex"); }} aria-label="打开宠物图鉴"><b>鉴</b><small>{seenPetIds.length}/{PET_SPECIES_ORDER.length}</small></button>}
            <button type="button" className="icon-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭音效" : "开启音效"}>{soundOn ? "♪" : "×"}</button>
            <button type="button" className="icon-button" onClick={() => { setCollectionView(null); setHelpOpen(true); }} aria-label="打开帮助">?</button>
          </div>
        </header>
      )}

      {phase === "title" && (
        <section className="title-screen">
          <div className="sky-layers"><i /><i /><i /></div>
          <div className="distant-city">
            <i className="city-tower tower-one" /><i className="city-tower tower-two" /><i className="city-tower tower-three" />
            <i className="rainbow-bridge" />
          </div>
          <div className="title-pets"><PetSprite id="leaf" size="lg" /><PetSprite id="metal" size="xl" /><PetSprite id="tide" size="lg" /></div>
          <div className="title-copy">
            <div className="title-kicker"><span>华娱经典世界观 · 非商业同人续作</span></div>
            <h1><small>宠物王国</small><strong>灵契</strong></h1>
            <p>当契约断裂，曾经的陪伴还会留下吗？</p>
            <div className="title-actions">
              <button type="button" className="primary-action" onClick={newGame}><span>新的旅程</span><b>›</b></button>
              {saveAvailable && <button type="button" className="secondary-action" onClick={continueGame}>继续上次进度</button>}
            </div>
            <div className="title-meta"><span>序章</span><i />没有登记的伙伴<i />单人剧情 RPG</div>
          </div>
          <div className="title-version">PROLOGUE BUILD 01</div>
        </section>
      )}

      {phase === "name" && (
        <section className="paper-screen name-screen">
          <div className="paper-card name-card">
            <div className="paper-kicker">TRAINER APPLICATION · 001</div>
            <h2>在推荐信上<br />写下你的名字</h2>
            <p>这个名字会被伙伴记住，也会出现在彩虹学院的新生档案里。</p>
            <label className="name-field">
              <span>训练师姓名</span>
              <input value={draftName} maxLength={8} onChange={(event) => setDraftName(event.target.value)} autoFocus aria-label="训练师姓名" />
            </label>
            <button type="button" className="primary-action dark" disabled={!draftName.trim()} onClick={() => { setPlayerName(draftName.trim()); go("shelter"); }}><span>收好推荐信</span><b>›</b></button>
            <div className="seal-stamp">临虹<br />照护所</div>
          </div>
        </section>
      )}

      {phase === "shelter" && (
        <section className="shelter-screen">
          <div className="shelter-scene">
            <div className="window-light"><i /><i /></div>
            <div className="shelf shelf-one" /><div className="shelf shelf-two" />
            <div className="keeper"><Character name="黎叔" variant="keeper" /><span>黎叔</span></div>
            <div className="shelter-copy">
              <div className="scene-index">01 · 临虹村宠物照护所</div>
              <h2>它们也在<br />挑选自己的伙伴</h2>
              <p>黎叔把三枚封印球放回抽屉。今天，不由训练师先做决定。</p>
            </div>
            <div className="partner-selection">
              {(Object.values(PARTNERS) as Partner[]).map((candidate) => (
                <button type="button" key={candidate.id} className={`partner-card${partnerId === candidate.id ? " selected" : ""}`} onClick={() => selectPartner(candidate.id)}>
                  <div className="partner-art"><PetSprite id={candidate.id} size="lg" /><span>{candidate.kind}</span></div>
                  <div className="partner-copy"><small>{candidate.nature}</small><b>{candidate.name}</b><p>{candidate.quote}</p></div>
                  <i className="select-mark">{partnerId === candidate.id ? "已靠近" : "靠近它"}</i>
                </button>
              ))}
            </div>
            <div className="shelter-footer">
              <p>{partner ? `“${partner.name}没有进入封印球，而是站到了${playerName}身边。”` : "选择一只你想先了解的宠物。"}</p>
              <button type="button" className="primary-action" disabled={!partnerId} onClick={() => go("road")}><span>一起出发</span><b>›</b></button>
            </div>
          </div>
        </section>
      )}

      {activeMap && partner && (
        <ExplorationScene
          key={activeMap.id}
          map={activeMap}
          mapCamera={mapCamera}
          fieldViewportRef={fieldViewportRef}
          partner={partner}
          roadPos={roadPos}
          roadFacing={roadFacing}
          roadMoving={roadMoving}
          roadStep={roadStep}
          roadBumped={roadBumped}
          roadInGrass={roadInGrass}
          toast={toast}
          encounterPending={encounterPending}
          missionTitle={phase === "road" && captured ? "前往彩虹城" : activeMap.missionTitle}
          missionText={phase === "road" && captured ? "从下方营地沿道路向东，经中央石阶绕往东北城门。" : activeMap.missionText}
          missionItems={phase === "road" ? [
            { label: "在高草中遭遇宠物", done: captured },
            { label: "完成一次捕捉", done: captured },
            { label: "沿正确道路抵达城门" },
          ] : phase === "city" ? [
            { label: "从南门进入学院区", done: roadPos.y < 82 },
            { label: "绕过中央星泉", done: roadPos.y < 42 },
            { label: "与诺亚交谈" },
          ] : phase === "festival" ? [
            { label: "穿过黄金灯市", done: roadPos.y < 78 },
            { label: "登上彩虹共鸣环" },
          ] : phase === "rupture" ? [
            ...RUPTURE_NODE_POSITIONS.map((_, index) => ({ label: `稳定灵契节点 ${index + 1}`, done: ruptureNodes.includes(index) })),
            { label: "前往上方裂隙台", done: false },
          ] : [
            { label: "绕开破碎万灵晶核", done: roadPos.y < 58 },
            { label: "抵达上方记忆祭台" },
          ]}
          mapReady={mapAssetReady}
          onMapReady={setLoadedMapId}
          markers={<>
            {phase === "road" && <button type="button" className={`map-landmark gate-landmark${captured ? " landmark-ready" : ""}`} style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={exploreInteraction}><span>{captured ? "彩虹城 · 可进入" : "彩虹城"}</span><i>按 E</i></button>}
            {phase === "city" && <button type="button" className="map-landmark npc-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={exploreInteraction}><Character name="诺亚" variant="noah" small /><span>诺亚 · 学院门前</span><i>按 E</i></button>}
            {phase === "festival" && <>
              {FESTIVAL_HEROES.map((hero, index) => {
                const positions = [{ x: 39, y: 45 }, { x: 45, y: 38 }, { x: 55, y: 38 }, { x: 61, y: 45 }, { x: 50, y: 31 }];
                return <div key={hero.name} className="map-character-marker" style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }}><Character name={hero.name} variant={hero.variant} small /><span>{hero.name}</span></div>;
              })}
              <button type="button" className="map-landmark ceremony-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={exploreInteraction}><span>万灵共鸣环</span><i>按 E</i></button>
            </>}
            {phase === "rupture" && <>
              {RUPTURE_NODE_POSITIONS.map((position, index) => <button type="button" key={index} className={`spirit-map-node${ruptureNodes.includes(index) ? " restored" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={exploreInteraction} aria-label={`灵契节点${index + 1}`}><i>{ruptureNodes.includes(index) ? "✓" : "!"}</i><span>{ruptureNodes.includes(index) ? "已稳定" : `节点 ${index + 1}`}</span></button>)}
              {ruptureNodes.length === 3 && <button type="button" className="map-landmark rift-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={exploreInteraction}><span>裂隙中央</span><i>按 E</i></button>}
            </>}
            {phase === "aftermath" && <>
              <div className="map-character-marker temple-sergi" style={{ left: "46%", top: "18%" }}><Character name="塞其" variant="sergi" small /><span>塞其</span></div>
              <div className="map-character-marker temple-angela" style={{ left: "54%", top: "18%" }}><Character name="安琪儿" variant="angela" small /><span>安琪儿</span></div>
              <button type="button" className="map-landmark memory-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={exploreInteraction}><span>记忆祭台</span><i>按 E</i></button>
            </>}
          </>}
          onMove={moveRoad}
          onInteract={exploreInteraction}
        />
      )}

      {phase === "capture" && partner && (
        <section className={`battle-screen capture-battle${battleBusy ? " battle-busy" : ""}${battleFx?.stage === "impact" ? " battle-impact" : ""}`}>
          <div className="battle-backdrop field-battle-bg"><i /><i /><i /></div>
          <BattleEffects fx={battleFx} />
          <div className="battle-heading"><small>WILD ENCOUNTER</small><h2>高草遭遇</h2><p>先降低体力，再用莓果安抚，最后投出召唤胶囊。</p></div>
          <div className="enemy-side">
            <div className="combatant-info"><span><b>{routeEncounter.name}</b><small>{routeEncounter.kind} · Lv.{routeEncounter.level}</small></span><em>{wildHp} / {routeEncounter.maxHp}</em><Meter value={wildHp} max={routeEncounter.maxHp} /></div>
            <div className={battleActorClass("enemy", battleFx)}><PetSprite id={routeEncounter.id} size="xl" /></div>
            <div className="calm-indicator"><span>戒备</span><Meter value={wildCalm} max={3} kind="calm" /></div>
          </div>
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.5</small></span><em>状态良好</em><Meter value={partner.hp} max={partner.hp} /></div></div>
          <div className="battle-command">
            <div className="battle-log"><span>行动记录</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "演出中" : "等待指令"}</i><p>{captureLog}</p></div>
            {!captureWon ? <div className="command-grid">
              <button type="button" disabled={battleBusy} onClick={() => captureAction("attack")}><span>攻击</span><b>{partner.attack}</b><small>降低体力</small></button>
              <button type="button" disabled={battleBusy} onClick={() => captureAction("calm")}><span>安抚</span><b>放下莓果</b><small>降低戒备</small></button>
              <button type="button" disabled={battleBusy} className="ball-command" onClick={() => captureAction("ball")}><span>道具 · {balls}</span><b>召唤胶囊</b><small>邀请同行</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => { setToast("捕捉完成。沿道路前往东北方的彩虹城门。"); setRoadInGrass(false); go("road"); }}><span>带新伙伴返回地图</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "city" && cityDialogueOpen && (
        <Dialogue lines={[
          { speaker: "旁白", text: "越过最后一座石桥，彩虹城的高塔第一次出现在你眼前。" },
          { speaker: "诺亚", role: "学院考生", text: `你就是${playerName}？档案上说，你的宠物还没有登记灵契。` },
          { speaker: playerName, text: "它不是我的所有物。是它自己决定跟我来的。" },
          { speaker: "诺亚", text: "没有登记就无法证明关系。考场上，感情可不会替你计算胜负。" },
          { speaker: "晶晶", role: "训练师协会会长", text: "那就让考核回答吧。双方准备，点到为止。" },
        ]} onComplete={() => go("exam")} backdrop={<div className="city-dialogue-bg"><div className="city-buildings"><i /><i /><i /><i /></div><div className="dialogue-characters"><div><Character name={playerName} variant="player" /><span>{playerName}</span></div><div><Character name="诺亚" variant="noah" /><span>诺亚</span></div></div></div>} />
      )}

      {phase === "exam" && partner && (
        <section className={`battle-screen exam-battle${battleBusy ? " battle-busy" : ""}${battleFx?.stage === "impact" ? " battle-impact" : ""}`}>
          <div className="battle-backdrop arena-bg"><i /><i /><i /><i /></div>
          <BattleEffects fx={battleFx} />
          <div className="battle-heading light"><small>RAINBOW ACADEMY · ENTRY TEST</small><h2>新生考核</h2><p>击败诺亚的银羽雀，取得临时训练师徽章。</p></div>
          <div className="enemy-side"><div className="combatant-info"><span><b>银羽雀</b><small>飞行系 · Lv.6</small></span><em>{examEnemy} / 48</em><Meter value={examEnemy} max={48} /></div><div className={battleActorClass("enemy", battleFx)}><PetSprite id="bird" size="xl" /></div><div className="trainer-label"><Character name="诺亚" variant="noah" small /><span>诺亚</span></div></div>
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.6</small></span><em>{examHp} / {partner.hp}</em><Meter value={examHp} max={partner.hp} /></div><div className="trainer-label"><Character name={playerName} variant="player" small /><span>{playerName}</span></div></div>
          <div className="battle-command">
            <div className="battle-log"><span>裁判记录</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "回合演出" : "等待指令"}</i><p>{examLog}</p></div>
            {!examWon ? <div className="command-grid two">
              <button type="button" disabled={battleBusy} onClick={() => examAction("attack")}><span>技能 01</span><b>{partner.attack}</b><small>稳定伤害</small></button>
              <button type="button" disabled={battleBusy} onClick={() => examAction("support")}><span>技能 02</span><b>{partner.support}</b><small>{partnerId === "metal" ? "减轻伤害" : "恢复体力"}</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => go("festival")}><span>参加黄金庆典</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "festival" && festivalDialogueOpen && (
        <Dialogue lines={FESTIVAL_LINES} onComplete={() => go("rupture")} backdrop={<div className="festival-bg"><div className="rainbow-ring"><i /><i /><i /><i /><i /></div><div className="hero-line">{FESTIVAL_HEROES.map((hero, index) => <div key={hero.name} className={`hero-token hero-${index}`}><Character name={hero.name} variant={hero.variant} /><span>{hero.name}</span></div>)}</div><div className="crowd-line">{Array.from({ length: 18 }).map((_, index) => <i key={index} />)}</div></div>} />
      )}

      {phase === "boss" && partner && (
        <section className={`battle-screen boss-battle${battleBusy ? " battle-busy" : ""}${battleFx?.stage === "impact" ? " battle-impact" : ""}`}>
          <div className="battle-backdrop boss-bg"><i /><i /><i /></div>
          <BattleEffects fx={battleFx} />
          <div className="battle-heading light"><small>AWAKENING BATTLE · NOT A HUNT</small><h2>被遗忘的名字</h2><p>保护浮现的记忆。不要让白裂狮在狂乱中耗尽自己。</p></div>
          <div className="enemy-side guardian-side"><div className="combatant-info danger"><span><b>白裂狮</b><small>金属系 · 灵契断裂</small></span><em>{bossHp} / 86</em><Meter value={bossHp} max={86} /></div><div className={battleActorClass("enemy", battleFx)}><PetSprite id="guardian" size="xl" glitched={!bossWon} /></div><div className="black-bell">◆<span>黑铃共鸣</span></div></div>
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>未登记灵契</small></span><em>{bossPlayerHp} / 68</em><Meter value={bossPlayerHp} max={68} /></div></div>
          <div className="memory-ribbon">{[0, 1, 2].map((slot) => <div key={slot} className={memories[slot] ? "found" : ""}><span>{slot + 1}</span><p>{memories[slot] ?? "记忆尚未浮现"}</p></div>)}</div>
          <div className="battle-command boss-command">
            <div className="battle-log"><span>灵契回声</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "共鸣进行中" : "等待指令"}</i><p>{bossLog}</p></div>
            {!bossWon ? <div className="command-grid four">
              <button type="button" disabled={battleBusy} onClick={() => bossAction("attack")}><span>战斗</span><b>{partner.attack}</b><small>挡开攻击</small></button>
              <button type="button" disabled={battleBusy} className="memory-command" onClick={() => bossAction("protect")}><span>核心</span><b>守护记忆</b><small>{memories.length} / 3</small></button>
              <button type="button" disabled={battleBusy} onClick={() => bossAction("soothe")}><span>协力</span><b>{partner.support}</b><small>减少伤害</small></button>
              <button type="button" disabled={battleBusy} className={memories.length === 3 ? "call-ready" : ""} onClick={() => bossAction("call")}><span>唤灵</span><b>呼唤名字</b><small>{memories.length === 3 ? "可以使用" : "需要完整记忆"}</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => go("aftermath")}><span>赶往彩虹神殿</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "aftermath" && aftermathDialogueOpen && (
        <Dialogue lines={AFTERMATH_LINES} onComplete={() => go("ending")} backdrop={<div className="temple-bg"><div className="temple-columns"><i /><i /><i /><i /></div><div className="crystal-core"><i /><span>万灵晶核</span></div><div className="temple-characters"><div><Character name="塞其" variant="sergi" /><span>塞其</span></div><div><Character name="安琪儿" variant="angela" /><span>安琪儿</span></div></div></div>} />
      )}

      {phase === "ending" && partner && (
        <section className="ending-screen">
          <div className="ending-landscape"><div className="dawn-orb" /><div className="ending-city"><i /><i /><i /></div><div className="ending-party"><Character name={playerName} /><PetSprite id={partner.id} size="lg" />{captured && <PetSprite id={routeEncounter.id} size="md" />}</div></div>
          <div className="ending-card">
            <div className="ending-kicker">PROLOGUE COMPLETE</div>
            <h2>没有登记的伙伴</h2>
            <p>彩虹城在身后封锁。东之高原的风里，传来了黑色铃铛的声音。</p>
            <div className="ending-record">
              <div><small>训练师</small><b>{playerName}</b></div>
              <div><small>初始伙伴</small><b>{partner.name}</b></div>
              <div><small>图鉴记录</small><b>{seenPetIds.length} / {PET_SPECIES_ORDER.length}</b></div>
              <div><small>下一目标</small><b>东之高原</b></div>
            </div>
            <div className="next-chapter"><span>第一章</span><div><b>不愿回家的宠物</b><small>TO BE CONTINUED</small></div></div>
            <div className="ending-actions"><button type="button" className="primary-action dark" onClick={() => setPhase("title")}><span>保存并返回标题</span><b>›</b></button><button type="button" className="text-action" onClick={newGame}>重新体验序章</button></div>
          </div>
        </section>
      )}

      {collectionView && partner && (
        <PetCollectionModal
          initialView={collectionView}
          ownedPetIds={ownedPetIds}
          seenPetIds={seenPetIds}
          starterId={partnerId}
          onClose={() => setCollectionView(null)}
        />
      )}

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭">×</button>
            <small>TRAINER HANDBOOK</small><h2>旅行手册</h2>
            <div className="help-grid"><div><kbd>WASD</kbd><b>格子移动</b><p>也支持方向键；水面和峭壁不能通行。</p></div><div><kbd>E</kbd><b>互动</b><p>靠近城门、发光物体或人物。</p></div><div><kbd>高草</kbd><b>野外遭遇</b><p>在金色高草里移动会遇到野生宠物。</p></div><div><kbd>自动</kbd><b>保存进度</b><p>每次进入新场景都会保存在本机。</p></div></div>
            <p className="help-note">这是《宠物王国：灵契》的可玩序章原型，玩法与剧情会在后续章节中继续扩展。</p>
          </section>
        </div>
      )}
    </main>
  );
}
