"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_RESEARCH_REQUIREMENTS,
  INITIAL_FIELD_RESEARCH,
  INITIAL_INVENTORY,
  SUPPLY_OFFERS,
  battleRewards,
  buySupply,
  calculateSkillDamage,
  calculateWildCounterDamage,
  captureChance,
  claimFieldResearch,
  elementMultiplier,
  isFieldResearchComplete,
  normalizeFieldResearch,
  normalizeInventory,
  recordBattleResolution,
  recordEncounter,
  type AdventureInventory,
  type FieldResearch,
  type SupplyOfferId,
} from "./adventure-rules";
import { canStandAt, integrateActorMovement, isEncounterTerrain } from "./overworld-engine";
import { BATTLE_STATUS_LABELS, applyStatusTick, enemyAction, shouldInflictStatus, statusForElement, type BattleStatus } from "./trainer-battle-rules";
import {
  HIGHLAND_SIDE_QUESTS,
  INITIAL_HIGHLAND_SIDE_QUESTS,
  normalizeHighlandSideQuests,
  sideQuestObjective,
  type HighlandSideQuestId,
  type HighlandSideQuestProgress,
} from "./quest-rules";

type Phase =
  | "title"
  | "name"
  | "home"
  | "shelter"
  | "road"
  | "capture"
  | "city"
  | "exam"
  | "festival"
  | "rupture"
  | "boss"
  | "aftermath"
  | "highland"
  | "windPass"
  | "pasture"
  | "observatory"
  | "trainerBattle"
  | "ending";

type PartnerId = "leaf" | "metal" | "tide";
type NewPetId = "ember" | "moss" | "spark" | "frost" | "lantern" | "breeze";
type PetArtId = PartnerId | "wild" | "bird" | "guardian" | NewPetId;
type PetSpeciesId = PetArtId;
type RouteEncounterId = "wild" | "bird" | "ember" | "moss" | "spark" | "frost" | "lantern" | "breeze";
type CharacterVariant = "player" | "keeper" | "noah" | "jingjing" | "sergi" | "angela";
type Position = { x: number; y: number };
type Size = { width: number; height: number };
type MapRect = { x1: number; y1: number; x2: number; y2: number };
type ExplorationPhase = "road" | "city" | "festival" | "rupture" | "aftermath" | "highland" | "windPass" | "pasture" | "observatory";
type BattleReturnPhase = "road" | "highland" | "windPass" | "pasture" | "observatory";
type CollectionView = "bag" | "storage" | "dex";
type WildBattleResult = "active" | "captured" | "victory" | "escaped" | "defeat";
type TrainerBattleResult = "active" | "victory" | "defeat";
type TrainerBattleId = "ranger" | "warden";
type ChapterQuest = "camp" | "pass" | "pasture" | "observatory" | "complete";
type ChapterDialogueId = "highland_arrival" | "altar_memory" | "ranger_meeting" | "pasture_echo" | "warden_truth" | "chapter_epilogue";
type SideQuestDialogueId = "medicine_offer" | "medicine_complete" | "courier_offer" | "courier_ranger" | "courier_pasture" | "courier_warden" | "courier_complete" | "bellsheep_offer" | "bellsheep_complete";
type HomeDiscovery = "photo" | "letter" | "breakfast";
type HomeStoryId = "wake" | HomeDiscovery | "door";
type PetElement = "plant" | "metal" | "water" | "beast" | "wind" | "spirit" | "fire" | "earth" | "lightning" | "ice";
type PetStats = { hp: number; attack: number; defense: number; spirit: number; speed: number };
type PetSkill = { name: string; level: number; element: PetElement; power: number | null; description: string };
type PetProgress = { id: PetSpeciesId; level: number; experience: number; equippedSkills: string[]; evolved: boolean };
type PetEvolution = { level: number; name: string; crystalCost: number; description: string };
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
  storedPetIds?: PetSpeciesId[];
  seenPetIds?: PetSpeciesId[];
  activePetId?: PetSpeciesId;
  petProgress?: PetProgress[];
  homeDiscoveries?: HomeDiscovery[];
  inventory?: AdventureInventory;
  fieldResearch?: FieldResearch;
  prologueComplete?: boolean;
  highlandAltarFound?: boolean;
  battleReturnPhase?: BattleReturnPhase;
  partyHealth?: Partial<Record<PetSpeciesId, number>>;
  chapterQuest?: ChapterQuest;
  highlandTrainerDefeated?: boolean;
  pastureShrines?: number[];
  observatoryNodes?: number[];
  chapterOneComplete?: boolean;
  chapterDialoguesSeen?: ChapterDialogueId[];
  highlandSideQuests?: HighlandSideQuestProgress;
};

type Partner = {
  id: PetSpeciesId;
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

type TrainerPet = { id: PetSpeciesId; level: number };
type TrainerBattleDefinition = {
  id: TrainerBattleId;
  trainerName: string;
  trainerRole: string;
  title: string;
  description: string;
  team: TrainerPet[];
  rewardCoins: number;
  rewardExperience: number;
  background: ExplorationPhase;
};

type ExplorationMapDefinition = {
  id: ExplorationPhase;
  image: string;
  name: string;
  start: Position;
  interaction: Position;
  missionTitle: string;
  missionText: string;
  collisionText: string;
};

const SAVE_KEY = "pet-kingdom-spirit-pact-prologue-v1";

const PARTNERS: Record<PartnerId, Partner & { id: PartnerId }> = {
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
  ember: "./pixel/pet-ember.png?v=1",
  moss: "./pixel/pet-moss.png?v=1",
  spark: "./pixel/pet-spark.png?v=1",
  frost: "./pixel/pet-frost.png?v=1",
  lantern: "./pixel/pet-lantern.png?v=1",
  breeze: "./pixel/pet-breeze.png?v=1",
};

const PET_SPECIES_ORDER: PetSpeciesId[] = ["leaf", "metal", "tide", "wild", "bird", "guardian", "ember", "moss", "spark", "frost", "lantern", "breeze"];

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
      { name: "藤蔓牵引", level: 5, element: "plant", power: 58, description: "从地面唤出藤蔓，较低概率降低速度。" },
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
      { name: "铆钉连射", level: 5, element: "metal", power: 62, description: "射出两轮金属碎片，擅长击破护盾。" },
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
      { name: "回流尾击", level: 5, element: "water", power: 60, description: "借回流摆尾攻击，先手时威力提高。" },
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
      { name: "羽光加速", level: 5, element: "wind", power: null, description: "抖落银羽，大幅提高自身速度。" },
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
  ember: {
    id: "ember",
    number: 7,
    name: "火绒狸",
    element: "fire",
    elementLabel: "火焰系",
    category: "火绒宠物",
    role: "强攻 · 灼烧",
    habitat: "青崖水道向阳岩坡与黄金灯市",
    rarity: "少见",
    defaultLevel: 4,
    description: "会把白天收集的热量藏进巨大耳绒，兴奋时尾巴便燃成漩涡。它很爱恶作剧，却从不让火星靠近伙伴的行囊。",
    stats: { hp: 55, attack: 72, defense: 39, spirit: 57, speed: 68 },
    skills: [
      { name: "火尾回旋", level: 1, element: "fire", power: 44, description: "旋转燃烧的尾巴横扫目标，有小概率留下灼热。" },
      { name: "余烬潜行", level: 4, element: "fire", power: null, description: "藏进余烬的微光里，提高速度与下一次攻击的威力。" },
      { name: "燎原扑击", level: 10, element: "fire", power: 70, description: "从火光中跃出猛扑，目标处于异常状态时威力提高。" },
    ],
  },
  moss: {
    id: "moss",
    number: 8,
    name: "苔甲龟",
    element: "earth",
    elementLabel: "岩土系",
    category: "苔岩宠物",
    role: "坚守 · 回复",
    habitat: "青崖水道湿润岩台与东之高原",
    rarity: "常见",
    defaultLevel: 4,
    description: "背甲由会缓慢生长的岩片组成，年长后会长出小花。迷路的人只要跟着甲片上苔藓较亮的一侧，就能找到水源。",
    stats: { hp: 80, attack: 42, defense: 82, spirit: 45, speed: 25 },
    skills: [
      { name: "岩壳撞击", level: 1, element: "earth", power: 40, description: "缩起身体推动厚重背甲，稳稳撞向目标。" },
      { name: "苔息", level: 4, element: "plant", power: null, description: "让背甲上的苔藓释放清新气息，恢复体力并提高防御。" },
      { name: "地脉震荡", level: 10, element: "earth", power: 70, description: "与地下岩层共鸣，防御越高造成的震荡越强。" },
    ],
  },
  spark: {
    id: "spark",
    number: 9,
    name: "霆尾貂",
    element: "lightning",
    elementLabel: "雷电系",
    category: "霆尾宠物",
    role: "高速 · 爆发",
    habitat: "青崖雷鸣草甸与学院避雷尖塔",
    rarity: "珍稀",
    defaultLevel: 5,
    description: "额前晶体能在雷雨到来前发亮。它会沿着训练师留下的脚印高速折返，把走散的伙伴一个个带回队伍。",
    stats: { hp: 52, attack: 70, defense: 41, spirit: 61, speed: 88 },
    skills: [
      { name: "闪尾电击", level: 1, element: "lightning", power: 44, description: "挥动闪电形长尾发动先制电击。" },
      { name: "蓄电跃迁", level: 5, element: "lightning", power: null, description: "储存游离电荷，大幅提高速度并强化下一次攻击。" },
      { name: "霆光追击", level: 12, element: "lightning", power: 74, description: "化为折线雷光追击目标，速度领先时追加一次小型电击。" },
    ],
  },
  frost: {
    id: "frost",
    number: 10,
    name: "霜角鹿",
    element: "ice",
    elementLabel: "冰霜系",
    category: "霜晶宠物",
    role: "控场 · 灵能",
    habitat: "东之高原雪线与月白回廊",
    rarity: "珍稀",
    defaultLevel: 8,
    description: "晶角会记录见过的第一场雪。它经过的草叶只会短暂结霜，不会真正冻伤，因此常被高原旅人视为平安的征兆。",
    stats: { hp: 64, attack: 50, defense: 60, spirit: 78, speed: 58 },
    skills: [
      { name: "晶角突", level: 1, element: "ice", power: 46, description: "用凝结霜晶的鹿角突击，并降低目标少量速度。" },
      { name: "冷雾屏障", level: 8, element: "ice", power: null, description: "释放柔和冷雾形成屏障，降低本回合所受伤害。" },
      { name: "极光冻结", level: 14, element: "ice", power: 76, description: "召来极光般的寒流，目标越慢威力越高。" },
    ],
  },
  lantern: {
    id: "lantern",
    number: 11,
    name: "星灯魟",
    element: "spirit",
    elementLabel: "灵契系",
    category: "星灯宠物",
    role: "灵能 · 回复",
    habitat: "万灵神殿月白回廊与无月水面",
    rarity: "珍稀",
    defaultLevel: 10,
    description: "它并不生活在海里，而是沿着灵契的微光在夜空漂游。胸前星灯会为怀念同一位伙伴的人亮起相同颜色。",
    stats: { hp: 61, attack: 44, defense: 55, spirit: 92, speed: 64 },
    skills: [
      { name: "星屑波", level: 1, element: "spirit", power: 46, description: "扇动翼鳍洒出星屑状灵能波。" },
      { name: "引灯归航", level: 10, element: "spirit", power: null, description: "点亮胸前星灯，恢复体力并清除一种负面状态。" },
      { name: "星河俯冲", level: 16, element: "spirit", power: 80, description: "沿灵契光带俯冲，队伍中伙伴越多威力越稳定。" },
    ],
  },
  breeze: {
    id: "breeze",
    number: 12,
    name: "风铃羊",
    element: "wind",
    elementLabel: "飞行系",
    category: "云绒宠物",
    role: "支援 · 提速",
    habitat: "彩虹城钟塔草坪与东之高原",
    rarity: "少见",
    defaultLevel: 6,
    description: "云朵般的卷毛能托住身体短暂滑翔。它喜欢追着钟声奔跑，颈间两枚小铃只有在真正顺风时才会一起响起。",
    stats: { hp: 68, attack: 45, defense: 51, spirit: 71, speed: 74 },
    skills: [
      { name: "风铃冲击", level: 1, element: "wind", power: 40, description: "借铃声压缩气流，远距离冲击目标。" },
      { name: "云絮轻身", level: 6, element: "wind", power: null, description: "让队伍被轻风托起，提高速度与闪避能力。" },
      { name: "回音风场", level: 12, element: "wind", power: 68, description: "展开回音风场，连续行动时威力逐步提升。" },
    ],
  },
};

const PET_EVOLUTIONS: Partial<Record<PetSpeciesId, PetEvolution>> = {
  leaf: { level: 10, name: "叶冠精灵", crystalCost: 2, description: "嫩叶舒展成冠，治愈灵力与生命力同步成长。" },
  metal: { level: 10, name: "铠尾灵狐", crystalCost: 2, description: "尾甲完成重铸，能在突进中展开反击装甲。" },
  tide: { level: 10, name: "潮汐水獭", crystalCost: 2, description: "尾部凝成潮环，能够调动更大范围的水流。" },
  wild: { level: 11, name: "森角鼠王", crystalCost: 2, description: "茸角长成林冠形态，会主动保护弱小的同伴。" },
  bird: { level: 11, name: "银翼巡风", crystalCost: 2, description: "银羽连成风翼，速度与连续攻击能力大幅提升。" },
  ember: { level: 10, name: "炽尾火狸", crystalCost: 2, description: "尾焰稳定为炽红灵火，不再畏惧寒冷与黑暗。" },
  moss: { level: 10, name: "古苔岩龟", crystalCost: 2, description: "背甲长出古老苔纹，防御与大地灵力更加坚实。" },
  spark: { level: 12, name: "雷晶灵貂", crystalCost: 2, description: "尾尖凝成雷晶，能把积蓄的电流一次释放。" },
  frost: { level: 14, name: "极光霜鹿", crystalCost: 3, description: "冰角折射出极光，成为高原风雪中的引路者。" },
  lantern: { level: 16, name: "星河灯魟", crystalCost: 3, description: "胸前星灯化作星河纹路，能回应更遥远的灵契。" },
  breeze: { level: 12, name: "云铃天羊", crystalCost: 2, description: "云绒托起全身，颈铃会召来持续不断的顺风。" },
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
  const chapterPhases: Phase[] = ["highland", "windPass", "pasture", "observatory", "trainerBattle"];
  if (["exam", "festival", "rupture", "boss", "aftermath", "ending", ...chapterPhases].includes(phase)) sightings.push("bird", "breeze");
  if (["festival", "rupture", "boss", "aftermath", "ending", ...chapterPhases].includes(phase)) sightings.push("ember", "spark");
  if (["rupture", "boss", "aftermath", "ending", ...chapterPhases].includes(phase)) sightings.push("frost", "lantern");
  if (["aftermath", "ending", ...chapterPhases].includes(phase)) sightings.push("moss");
  if (["boss", "aftermath", "ending", ...chapterPhases].includes(phase)) sightings.push("guardian");
  return sightings;
}

function experienceToNextLevel(level: number) {
  return 20 + level * 18;
}

function createPetProgress(id: PetSpeciesId): PetProgress {
  const species = PET_SPECIES[id];
  const unlocked = species.skills.filter((skill) => skill.level <= species.defaultLevel);
  const firstAttack = unlocked.find((skill) => skill.power !== null) ?? unlocked[0];
  const firstSupport = unlocked.find((skill) => skill.power === null && skill.name !== firstAttack?.name);
  const remainingSkills = unlocked.filter((skill) => skill.name !== firstAttack?.name && skill.name !== firstSupport?.name);
  return {
    id,
    level: species.defaultLevel,
    experience: 0,
    equippedSkills: [firstAttack, firstSupport, ...remainingSkills].filter((skill): skill is PetSkill => Boolean(skill)).slice(0, 4).map((skill) => skill.name),
    evolved: false,
  };
}

function normalizePetProgress(value: unknown, id: PetSpeciesId): PetProgress {
  const fallback = createPetProgress(id);
  if (!value || typeof value !== "object") return fallback;
  const saved = value as Partial<PetProgress>;
  const species = PET_SPECIES[id];
  const level = typeof saved.level === "number" ? Math.max(species.defaultLevel, Math.floor(saved.level)) : fallback.level;
  const availableNames = new Set(species.skills.filter((skill) => skill.level <= level).map((skill) => skill.name));
  const equippedSkills = Array.isArray(saved.equippedSkills)
    ? saved.equippedSkills.filter((name): name is string => typeof name === "string" && availableNames.has(name)).slice(0, 4)
    : [];
  return {
    id,
    level,
    experience: typeof saved.experience === "number" ? Math.max(0, Math.floor(saved.experience)) : 0,
    equippedSkills: equippedSkills.length > 0 ? equippedSkills : fallback.equippedSkills,
    evolved: Boolean(saved.evolved),
  };
}

function addPetExperience(progress: PetProgress, amount: number) {
  let level = progress.level;
  let experience = progress.experience + amount;
  while (experience >= experienceToNextLevel(level)) {
    experience -= experienceToNextLevel(level);
    level += 1;
  }
  const unlocked = PET_SPECIES[progress.id].skills.filter((skill) => skill.level <= level);
  const equippedSkills = [...progress.equippedSkills];
  for (const skill of unlocked) {
    if (equippedSkills.length >= 4) break;
    if (!equippedSkills.includes(skill.name)) equippedSkills.push(skill.name);
  }
  return { ...progress, level, experience, equippedSkills };
}

function scaledPetStats(species: PetSpecies, level: number, evolved = false) {
  const growth = Math.max(0, level - species.defaultLevel);
  const evolutionBonus = evolved ? 9 : 0;
  return Object.fromEntries(Object.entries(species.stats).map(([key, value]) => [key, Math.min(99, value + growth * 2 + evolutionBonus)])) as PetStats;
}

function petDisplayName(id: PetSpeciesId, progress?: PetProgress | null) {
  return progress?.evolved ? PET_EVOLUTIONS[id]?.name ?? PET_SPECIES[id].name : PET_SPECIES[id].name;
}

function petBattleFxKind(element: PetElement): BattleFxKind {
  if (element === "plant") return "leaf";
  if (element === "metal") return "metal";
  if (element === "water") return "tide";
  if (element === "fire") return "claw";
  if (element === "earth") return "guard";
  if (element === "lightning") return "wind";
  if (element === "ice") return "tide";
  if (element === "wind") return "wind";
  if (element === "spirit") return "memory";
  return "claw";
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
  name: "./pixel/protagonist-home-v1.webp?v=1",
  home: "./pixel/protagonist-home-v1.webp?v=1",
  shelter: "./pixel/shelter-interior.webp?v=2",
  road: "./pixel/route-map-v2.webp?v=3",
  capture: "./pixel/route-map-v2.webp?v=3",
  city: "./pixel/map-rainbow-city.webp?v=4",
  exam: "./pixel/academy-arena.webp?v=2",
  festival: "./pixel/map-golden-festival.webp?v=4",
  rupture: "./pixel/map-ruptured-plaza.webp?v=4",
  boss: "./pixel/spirit-sanctum.webp?v=2",
  aftermath: "./pixel/map-spirit-temple.webp?v=4",
  highland: "./pixel/map-east-highland.webp?v=4",
  windPass: "./pixel/map-wind-pass.webp?v=1",
  pasture: "./pixel/map-cloudbell-pasture.webp?v=1",
  observatory: "./pixel/map-froststar-observatory.webp?v=1",
  trainerBattle: "./pixel/map-wind-pass.webp?v=1",
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

const CHAPTER_DIALOGUE_IDS: ChapterDialogueId[] = ["highland_arrival", "altar_memory", "ranger_meeting", "pasture_echo", "warden_truth", "chapter_epilogue"];

function chapterDialogueLines(id: ChapterDialogueId, playerName: string): DialogueLine[] {
  const lines: Record<ChapterDialogueId, DialogueLine[]> = {
    highland_arrival: [
      { speaker: "旁白", text: "索道越过云层时，同行宠物忽然一起望向北方。那里没有钟塔，却传来一声低沉的铃响。" },
      { speaker: "栖川", role: "断风调查队长", text: "你就是塞其派来的新人？三天前安琪儿也到过这里。她拒绝护送，只借走一盏风灯。" },
      { speaker: playerName, text: "学院说她带走了万灵晶核。她在这里找什么？" },
      { speaker: "栖川", text: "一座没有铃舌、却会自己响的黑铃。昨夜它每响一次，营地的宠物就忘掉一件与主人有关的事。", tone: "warning" },
      { speaker: "栖川", text: "先去东北祭台确认她留下的坐标。路上也问问营地的人——他们知道的，比报告里写的多。" },
    ],
    altar_memory: [
      { speaker: "旁白", text: "黑铃下没有灰尘。有人最近拆开过基座，又把每一块石砖原样放了回去。" },
      { speaker: "安琪儿的留声", role: "观测记录 07", text: "黑铃不是遗物。它在模仿宠物记忆中的声音，然后把名字从灵契里抹掉。" },
      { speaker: "安琪儿的留声", text: "如果来的是塞其，不要继续。如果是那个没有登记灵契的孩子——去找朔，他保存着没有被学院改写的原始记录。", tone: "warning" },
      { speaker: playerName, text: "她早就知道我会来……还是说，她只相信没有登记的灵契？" },
      { speaker: "旁白", text: "基座内还夹着半张栈道通行证，上面写着巡风员岚绪的名字。" },
    ],
    ranger_meeting: [
      { speaker: "岚绪", role: "高原巡风员", text: "安琪儿救过我的风铃羊。学院来信要我抓她，我却只收到一页没有署名的命令。" },
      { speaker: playerName, text: "我不是来替学院抓人的。我想知道黑铃对宠物做了什么。" },
      { speaker: "岚绪", text: "回答得很好听。但黑铃最会复制人说过的话。要过山门，就让你的三只伙伴轮流作战。" },
      { speaker: "岚绪", text: "我看的不是输赢，是它们倒下时，你会不会记得收回它们。准备好就开始。", tone: "soft" },
    ],
    pasture_echo: [
      { speaker: "旁白", text: "第三座云铃苏醒后，牧场没有立刻恢复风声。三道铃音反而拼出了一句陌生的呼唤。" },
      { speaker: "芙禾", role: "云铃牧场守铃人", text: "那是我母亲的名字。她去世十年了，只有小时候养过的风铃羊听过这个读音。" },
      { speaker: playerName, text: "黑铃不是凭空制造声音。它从宠物记忆里拿走了它。" },
      { speaker: "芙禾", text: "安琪儿也这样说。她让我把三座云铃倒过来接入观测站——不是为了开门，是为了让朔看见谁在偷听。" },
      { speaker: "旁白", text: "山顶阶梯逐级亮起。与此同时，观测站深处有人切断了最后一条通讯。", tone: "warning" },
    ],
    warden_truth: [
      { speaker: "朔", role: "无籍观测员", text: "停下。安琪儿告诉我，来取记录的人会带着一份不存在的灵契。" },
      { speaker: playerName, text: "我的伙伴没有登记，所以黑铃无法替我们改写过去。" },
      { speaker: "朔", text: "也可能因为你根本没有过去。学院档案里，你家的照护所、推荐信，甚至你的入学编号，都像是同一天补进去的。" },
      { speaker: playerName, text: "那就别相信档案。看它们怎么选择。" },
      { speaker: "朔", text: "正合我意。三场接力。如果你的伙伴仍会在黑铃声中回应自己的名字，记录就交给你。", tone: "warning" },
    ],
    chapter_epilogue: [
      { speaker: "朔", text: "这是完整记录。过去半年，被列为‘失踪’的宠物其实都曾自行回家——只是那些地址在地图上不存在。" },
      { speaker: "栖川的通讯", text: "营地收到学院急令：立刻销毁观测记录，并把你带回彩虹城接受问询。" },
      { speaker: playerName, text: "学院为什么害怕一份宠物回家的记录？" },
      { speaker: "朔", text: "因为所有不存在的地址，都指向同一个地方：西境废弃育成所。那里在十六年前就被从王国地图上抹掉了。" },
      { speaker: "安琪儿的留声", text: "如果你决定继续，先别急着追我。去问那些被称作‘支线’的人——被主线忽略的记忆，才最难伪造。", tone: "soft" },
      { speaker: "旁白", text: "第一章 · 黑铃回声 完。新的坐标在观测记录背面缓慢显现。" },
    ],
  };
  return lines[id];
}

function sideQuestDialogueLines(id: SideQuestDialogueId, playerName: string): DialogueLine[] {
  const lines: Record<SideQuestDialogueId, DialogueLine[]> = {
    medicine_offer: [
      { speaker: "禾婶", role: "营地医师", text: "昨夜黑铃响过以后，营地几只幼宠一直高烧。普通药草压不住，得借晶角幼鹿角上的薄霜降温。" },
      { speaker: playerName, text: "要把它带回来吗？" },
      { speaker: "禾婶", text: "带来让我看看就好，别伤它的角。好医师和好训练师都不该为了材料毁掉一个生命。", tone: "soft" },
    ],
    medicine_complete: [
      { speaker: "禾婶", text: "它愿意主动靠近药箱，说明很信任你。借一点落在草叶上的霜就够了。" },
      { speaker: "旁白", text: "晶角幼鹿轻轻甩头，药钵覆上一层薄霜。营地幼宠的体温终于降了下来。" },
      { speaker: "禾婶", text: "这枚晶片是在病宠项圈里发现的。黑铃响过后才出现，也许对你的调查有用。" },
    ],
    courier_offer: [
      { speaker: "洛弥", role: "营地记录员", text: "学院切断了高原通讯。我有三封不能写在纸上的口信，分别给岚绪、芙禾和朔。" },
      { speaker: playerName, text: "为什么不能写下来？" },
      { speaker: "洛弥", text: "因为学院派来的每封信，墨迹都在第二天变成同一句话：‘一切正常’。记住这句——我们还记得第一声铃。" },
    ],
    courier_ranger: [
      { speaker: playerName, text: "洛弥让我转告：我们还记得第一声铃。" },
      { speaker: "岚绪", text: "那我回他：第一声铃之后，安琪儿救走的不是犯人，是一只被抹掉名字的宠物。" },
      { speaker: "岚绪", text: "把下一封带给芙禾。她会告诉你，那只宠物原本想回哪里。" },
    ],
    courier_pasture: [
      { speaker: playerName, text: "洛弥的第二封口信：第一声铃之后，安琪儿救走的是被抹掉名字的宠物。" },
      { speaker: "芙禾", text: "我的回信是：它一直朝西叫。西边没有村庄，只有一座早已废弃的育成所。" },
      { speaker: "芙禾", text: "最后一封给朔。告诉他，牧场的人还记得那座育成所。" },
    ],
    courier_warden: [
      { speaker: playerName, text: "最后一封口信：牧场的人还记得那座育成所。" },
      { speaker: "朔", text: "很好。学院可以改地图，却不能同时改掉每个人的童年。" },
      { speaker: "朔", text: "回洛弥：把三封口信写进同一页档案，标题就叫‘大家都记得’。" },
    ],
    courier_complete: [
      { speaker: "洛弥", text: "岚绪、芙禾、朔……三个人的记忆能互相印证。这一次，档案不会再被一句‘一切正常’盖过去。" },
      { speaker: "洛弥", text: "谢谢你，口信不是跑腿。它让分散的人重新知道，自己并没有记错。", tone: "soft" },
    ],
    bellsheep_offer: [
      { speaker: "芙禾", role: "牧铃人", text: "有只风铃羊一直躲在草甸，不肯回栏。我以为它受了黑铃影响，可它只是反复朝观测站叫。" },
      { speaker: playerName, text: "我带一只愿意亲近人的风铃羊来，也许能听懂它在传什么。" },
      { speaker: "芙禾", text: "别强抓。让它自己选择跟来——真正的口信，只有愿意回来的宠物才说得清。" },
    ],
    bellsheep_complete: [
      { speaker: "旁白", text: "同行的风铃羊靠近旧围栏，颈边铃片发出三短一长的声音。草甸深处传来完全相同的回应。" },
      { speaker: "芙禾", text: "我懂了。它不是不肯回家，是在替失踪的同伴守着回家的方向。" },
      { speaker: "芙禾", text: "让你的伙伴继续跟着你吧。等我们把其他风铃羊接回来，我会亲自去营地报平安。", tone: "soft" },
    ],
  };
  return lines[id];
}

const MEMORY_TEXT = [
  "幼年的塞其曾在雨中抱住受伤的白裂狮。",
  "黑色手套把一枚铃铛装进共鸣台下方。",
  "安琪儿冲进神殿，她是在阻止仪式。",
];

const ROUTE_ENCOUNTERS: Record<RouteEncounterId, RouteEncounter> = {
  wild: { id: "wild", name: "茸角鼠", kind: "猛兽系", level: 4, maxHp: 32 },
  bird: { id: "bird", name: "银羽雀", kind: "飞行系", level: 5, maxHp: 36 },
  ember: { id: "ember", name: "火绒狸", kind: "火焰系", level: 4, maxHp: 34 },
  moss: { id: "moss", name: "苔甲龟", kind: "岩土系", level: 4, maxHp: 42 },
  spark: { id: "spark", name: "霆尾貂", kind: "雷电系", level: 5, maxHp: 30 },
  frost: { id: "frost", name: "霜角鹿", kind: "冰霜系", level: 8, maxHp: 48 },
  lantern: { id: "lantern", name: "星灯魟", kind: "灵契系", level: 10, maxHp: 52 },
  breeze: { id: "breeze", name: "风铃羊", kind: "飞行系", level: 7, maxHp: 44 },
};

const TRAINER_BATTLES: Record<TrainerBattleId, TrainerBattleDefinition> = {
  ranger: {
    id: "ranger",
    trainerName: "岚绪",
    trainerRole: "高原巡风员",
    title: "栈道通行试炼",
    description: "岚绪会根据体力选择防守，并连续派出三只高原宠物。",
    team: [{ id: "breeze", level: 8 }, { id: "frost", level: 9 }, { id: "spark", level: 9 }],
    rewardCoins: 180,
    rewardExperience: 130,
    background: "windPass",
  },
  warden: {
    id: "warden",
    trainerName: "朔",
    trainerRole: "无籍观测员",
    title: "黑铃观测记录",
    description: "朔拒绝交出安琪儿的记录。击败他的三宠队伍，证明你的灵契不会被黑铃控制。",
    team: [{ id: "lantern", level: 12 }, { id: "frost", level: 12 }, { id: "guardian", level: 14 }],
    rewardCoins: 360,
    rewardExperience: 260,
    background: "observatory",
  },
};

function isRouteEncounterId(value: unknown): value is RouteEncounterId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROUTE_ENCOUNTERS, value);
}

function randomRouteEncounter(mapId: BattleReturnPhase): RouteEncounterId {
  const roll = Math.random();
  if (mapId === "windPass") {
    if (roll < 0.48) return "breeze";
    if (roll < 0.78) return "spark";
    return "frost";
  }
  if (mapId === "pasture") {
    if (roll < 0.52) return "breeze";
    if (roll < 0.72) return "bird";
    if (roll < 0.91) return "frost";
    return "lantern";
  }
  if (mapId === "observatory") {
    if (roll < 0.46) return "frost";
    if (roll < 0.76) return "spark";
    return "lantern";
  }
  if (mapId === "highland") {
    if (roll < 0.46) return "breeze";
    if (roll < 0.84) return "frost";
    return "lantern";
  }
  if (roll < 0.34) return "wild";
  if (roll < 0.52) return "bird";
  if (roll < 0.70) return "ember";
  if (roll < 0.88) return "moss";
  return "spark";
}

const MAP_PIXEL_SIZE = { width: 1536, height: 1024 };
const HOME_PIXEL_SIZE = { width: 1672, height: 941 };
const ROAD_START: Position = { x: 16.7, y: 84.4 };
const CITY_GATE: Position = { x: 84.5, y: 15.5 };
const HOME_START: Position = { x: 42, y: 49 };

const HOME_INTERACTIONS: Record<HomeDiscovery, { position: Position; marker: Position; label: string; hint: string }> = {
  photo: { position: { x: 55, y: 34 }, marker: { x: 56, y: 22 }, label: "褪色合影", hint: "墙上那张合影似乎被人重新摆正过。" },
  letter: { position: { x: 67, y: 43 }, marker: { x: 69, y: 28 }, label: "学院推荐信", hint: "书桌上的推荐信墨迹未干。" },
  breakfast: { position: { x: 59, y: 59 }, marker: { x: 70, y: 58 }, label: "早餐与便笺", hint: "餐桌上留着一份早餐和母亲的字条。" },
};

const HOME_OBSTACLES: MapRect[] = [
  { x1: 13, y1: 28, x2: 33, y2: 48 },
  { x1: 12, y1: 48, x2: 22, y2: 78 },
  { x1: 62, y1: 26, x2: 79, y2: 42 },
  { x1: 78, y1: 34, x2: 86, y2: 77 },
  { x1: 62, y1: 49, x2: 80, y2: 75 },
];

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
  highland: {
    id: "highland",
    image: SCENE_ART.highland,
    name: "东之高原 · 断风遗迹",
    start: { x: 17, y: 84 },
    interaction: { x: 81, y: 13 },
    missionTitle: "第一章 · 黑铃回声",
    missionText: "从调查营地出发，穿过两座悬空石桥，前往东北方的黑铃祭台。",
    collisionText: "云海、悬崖、石墙和遗迹残柱都无法通行。",
  },
  windPass: {
    id: "windPass",
    image: SCENE_ART.windPass,
    name: "东之高原 · 风蚀栈道",
    start: { x: 18, y: 91 },
    interaction: { x: 78, y: 20 },
    missionTitle: "穿越风蚀栈道",
    missionText: "沿悬崖石路通过巡风员的三宠试炼，再从东北山门进入云铃牧场。",
    collisionText: "这里是云海、峭壁、围墙或遗迹装饰，不能通行。",
  },
  pasture: {
    id: "pasture",
    image: SCENE_ART.pasture,
    name: "东之高原 · 云铃牧场",
    start: { x: 9, y: 89 },
    interaction: { x: 78, y: 20 },
    missionTitle: "唤醒三座牧场风铃",
    missionText: "穿过溪流与银蓝草甸，依次调查三座石铃，再前往山顶观测站。",
    collisionText: "溪流、瀑布、悬崖、围栏、树木和建筑都不能穿越。",
  },
  observatory: {
    id: "observatory",
    image: SCENE_ART.observatory,
    name: "东之高原 · 冻星观测站",
    start: { x: 50, y: 91 },
    interaction: { x: 50, y: 19 },
    missionTitle: "重新连接观测回路",
    missionText: "从左右回廊激活三枚紫晶节点，解除圆形观测台的封锁。",
    collisionText: "破损墙体、虚空、机械、残柱与坍塌地面无法通行。",
  },
};

const SCENE_PRELOADS: Partial<Record<Phase, string[]>> = {
  name: [SCENE_ART.home],
  home: [SCENE_ART.shelter],
  shelter: [SCENE_ART.road, PET_ART.wild, PET_ART.bird, PET_ART.ember, PET_ART.moss, PET_ART.spark],
  road: [SCENE_ART.city],
  capture: [SCENE_ART.city],
  city: [SCENE_ART.exam, PET_ART.breeze],
  exam: [SCENE_ART.festival, PET_ART.ember, PET_ART.spark],
  festival: [SCENE_ART.rupture, PET_ART.frost, PET_ART.lantern],
  rupture: [SCENE_ART.boss],
  boss: [SCENE_ART.aftermath],
  aftermath: [SCENE_ART.ending, SCENE_ART.highland, PET_ART.frost, PET_ART.lantern, PET_ART.breeze],
  highland: [SCENE_ART.city, SCENE_ART.windPass],
  windPass: [SCENE_ART.pasture, PET_ART.spark, PET_ART.breeze, PET_ART.frost],
  pasture: [SCENE_ART.observatory, PET_ART.bird, PET_ART.lantern],
  observatory: [PET_ART.guardian],
  trainerBattle: [SCENE_ART.windPass, SCENE_ART.observatory],
};

const RUPTURE_NODE_POSITIONS: Position[] = [
  { x: 19, y: 36 },
  { x: 81, y: 38 },
  { x: 50, y: 74 },
];

const WIND_PASS_RANGER_POSITION: Position = { x: 55, y: 47 };
const PASTURE_KEEPER_POSITION: Position = { x: 26, y: 72 };
const PASTURE_SHRINE_POSITIONS: Position[] = [
  { x: 43, y: 39 },
  { x: 63, y: 68 },
  { x: 68, y: 36 },
];
const OBSERVATORY_NODE_POSITIONS: Position[] = [
  { x: 21, y: 58 },
  { x: 50, y: 55 },
  { x: 79, y: 58 },
];

function inMapRect(position: Position, rect: MapRect) {
  return position.x >= rect.x1 && position.x <= rect.x2 && position.y >= rect.y1 && position.y <= rect.y2;
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isHomeWalkable(position: Position) {
  const inMainFloor = position.x >= 14 && position.x <= 85 && position.y >= 30 && position.y <= 78;
  const inDoorCorridor = position.x >= 43 && position.x <= 57 && position.y >= 76 && position.y <= 87;
  return (inMainFloor || inDoorCorridor) && !HOME_OBSTACLES.some((rect) => inMapRect(position, rect));
}

function homeStoryLines(story: HomeStoryId, playerName: string): DialogueLine[] {
  if (story === "wake") return [
    { speaker: "旁白", text: "临虹村的晨钟敲了七下。推荐信上的墨迹还没有干，窗外已经有人带着宠物赶往黄金庆典。" },
    { speaker: playerName, text: "今天就要去黎叔那里了……先把该带的东西收好，也跟家里好好道个别。" },
  ];
  if (story === "photo") return [
    { speaker: "旁白", text: "褪色的合影里，年轻时的母亲和黎叔站在彩虹学院门前。画面边缘还有一只白色宠物，却没有留下名字。" },
    { speaker: playerName, text: "这张照片以前一直收在箱底。母亲为什么偏偏在今天把它挂出来？" },
  ];
  if (story === "letter") return [
    { speaker: "旁白", text: `推荐信写着：“兹推荐临虹村居民${playerName}参加彩虹学院新生考核。”纸角还有黎叔添上的一行小字。` },
    { speaker: "黎叔的字迹", text: "真正的契约从来不是让宠物服从，而是让彼此都愿意回头。", tone: "soft" },
  ];
  if (story === "breakfast") return [
    { speaker: "母亲的便笺", text: "面包要趁热吃。到了照护所，别急着挑最强的那只——看看谁愿意先走向你。" },
    { speaker: "母亲的便笺", text: "无论谁跟你回来，家里都已经给它留好了一只碗。晚上记得把你们的故事讲给我听。", tone: "soft" },
  ];
  return [
    { speaker: playerName, text: "推荐信、围巾，还有母亲的便笺……都带齐了。" },
    { speaker: "母亲", role: "从屋外传来", text: `${playerName}，黎叔已经在等你了。去吧，别让你的第一位伙伴等太久。`, tone: "soft" },
    { speaker: playerName, text: "我出发了！" },
  ];
}

function shelterIntroLines(playerName: string): DialogueLine[] {
  return [
    { speaker: "黎叔", role: "临虹村照护员", text: `${playerName}，你母亲刚派人捎过话。看来你已经把家里的那张旧照片看见了。` },
    { speaker: playerName, text: "照片里的白色宠物是谁？为什么它的名字被裁掉了？" },
    { speaker: "黎叔", text: "等你真正拥有愿意并肩同行的伙伴，我会把知道的都告诉你。现在，先别看封印球。" },
    { speaker: "黎叔", text: "这三个小家伙等了你一早。今天不是你单方面挑选它们——你们要互相选择。", tone: "soft" },
  ];
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

function MapPlayerSprite({ facing, moving, step, frameRef }: { facing: RoadFacing; moving: boolean; step: number; frameRef?: React.Ref<HTMLSpanElement> }) {
  const row = { down: 0, left: 1, right: 2, up: 3 }[facing];
  const column = moving ? (Math.floor(step / 2) % 2 === 0 ? 0 : 2) : 1;
  const x = column === 0 ? 0 : column === 1 ? 50 : 100;
  const y = row === 0 ? 0 : row === 1 ? 100 / 3 : row === 2 ? 200 / 3 : 100;
  return (
    <span
      ref={frameRef}
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
  storedPetIds,
  seenPetIds,
  starterId,
  activePetId,
  petProgress,
  inventory,
  managementLocked,
  onSetActivePet,
  onEquipSkill,
  onMoveToStorage,
  onMoveToParty,
  onEvolve,
  onClose,
}: {
  initialView: CollectionView;
  ownedPetIds: PetSpeciesId[];
  storedPetIds: PetSpeciesId[];
  seenPetIds: PetSpeciesId[];
  starterId: PartnerId | null;
  activePetId: PetSpeciesId | null;
  petProgress: PetProgress[];
  inventory: AdventureInventory;
  managementLocked: boolean;
  onSetActivePet: (id: PetSpeciesId) => void;
  onEquipSkill: (id: PetSpeciesId, slot: number, skillName: string) => void;
  onMoveToStorage: (id: PetSpeciesId) => void;
  onMoveToParty: (id: PetSpeciesId) => void;
  onEvolve: (id: PetSpeciesId) => void;
  onClose: () => void;
}) {
  const initialSelection = initialView === "bag"
    ? activePetId ?? ownedPetIds[0] ?? starterId ?? "leaf"
    : initialView === "storage" ? storedPetIds[0] ?? ownedPetIds[0] ?? starterId ?? "leaf" : starterId ?? PET_SPECIES_ORDER[0];
  const [view, setView] = useState<CollectionView>(initialView);
  const [selectedId, setSelectedId] = useState<PetSpeciesId>(initialSelection);
  const owned = useMemo(() => new Set(ownedPetIds), [ownedPetIds]);
  const seen = useMemo(() => new Set(seenPetIds), [seenPetIds]);
  const progressById = useMemo(() => new Map(petProgress.map((entry) => [entry.id, entry])), [petProgress]);
  const selected = PET_SPECIES[selectedId];
  const selectedProgress = progressById.get(selectedId);
  const selectedLevel = selectedProgress?.level ?? selected.defaultLevel;
  const selectedStats = scaledPetStats(selected, selectedLevel, selectedProgress?.evolved);
  const selectedKnown = owned.has(selectedId) || seen.has(selectedId);
  const evolution = PET_EVOLUTIONS[selectedId];
  const list = view === "bag" ? ownedPetIds : view === "storage" ? storedPetIds : PET_SPECIES_ORDER;

  const changeView = (next: CollectionView) => {
    setView(next);
    if (next === "bag" && !owned.has(selectedId)) setSelectedId(ownedPetIds[0] ?? starterId ?? "leaf");
    if (next === "storage" && !storedPetIds.includes(selectedId)) setSelectedId(storedPetIds[0] ?? ownedPetIds[0] ?? starterId ?? "leaf");
  };

  return (
    <div className="modal-backdrop collection-backdrop" onClick={onClose}>
      <section className="collection-modal" onClick={(event) => event.stopPropagation()} aria-label={view === "bag" ? "宠物背包" : view === "storage" ? "宠物仓库" : "宠物图鉴"}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <header className="collection-header">
          <div><small>SPIRIT ARCHIVE</small><h2>{view === "bag" ? "宠物背包" : view === "storage" ? "宠物仓库" : "宠物图鉴"}</h2></div>
          <div className="collection-progress">
            <span>{view === "bag" ? "同行席位" : view === "storage" ? "寄存伙伴" : "已发现"}</span>
            <b>{view === "bag" ? `${ownedPetIds.length} / 6` : view === "storage" ? storedPetIds.length : `${seen.size} / ${PET_SPECIES_ORDER.length}`}</b>
          </div>
        </header>

        <nav className="collection-tabs" aria-label="宠物资料分类">
          <button type="button" className={view === "bag" ? "active" : ""} onClick={() => changeView("bag")}><i>包</i><span>宠物背包<small>同行伙伴</small></span></button>
          <button type="button" className={view === "storage" ? "active" : ""} onClick={() => changeView("storage")}><i>仓</i><span>宠物仓库<small>队伍调度</small></span></button>
          <button type="button" className={view === "dex" ? "active" : ""} onClick={() => changeView("dex")}><i>鉴</i><span>宠物图鉴<small>发现记录</small></span></button>
        </nav>

        <div className="collection-content">
          <div className={`pet-entry-list ${view === "dex" ? "dex-grid" : "bag-list"}`}>
            {list.length === 0 && <div className="empty-pet-bag"><b>{view === "storage" ? "仓库还是空的" : "背包还是空的"}</b><p>{view === "storage" ? "队伍满员后，新捕捉的宠物会自动来到这里。" : "选择第一位伙伴后，宠物资料会出现在这里。"}</p></div>}
            {list.map((id, index) => {
              const species = PET_SPECIES[id];
              const isOwned = owned.has(id);
              const isSeen = seen.has(id) || isOwned;
              const progress = progressById.get(id);
              const state = isOwned ? (id === activePetId ? "首发" : "同行") : isSeen ? "发现" : "未知";
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
                  <span className="pet-entry-copy"><b>{isSeen ? petDisplayName(id, progress) : "未记录"}</b><small>{isSeen ? species.elementLabel : "???"}</small></span>
                  <em>{view === "bag" || view === "storage" ? `Lv.${progress?.level ?? species.defaultLevel}` : state}</em>
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
                <div className={`pet-detail-hero${selectedProgress?.evolved ? " is-evolved" : ""}`}>
                  <div className="pet-detail-sprite"><PetSprite id={selected.id} size="xl" /><span>Lv.{selectedLevel}</span></div>
                  <div className="pet-detail-title">
                    <small>No.{String(selected.number).padStart(3, "0")} · {selected.category}</small>
                    <h3>{petDisplayName(selected.id, selectedProgress)}</h3>
                    <div><span>{selected.elementLabel}</span><span>{selected.rarity}</span><span>{selected.role}</span></div>
                  </div>
                </div>
                <p className="pet-description">{selected.description}</p>
                <div className="pet-habitat"><span>主要栖息地</span><b>{selected.habitat}</b></div>
                {(view === "bag" || view === "storage") && selectedProgress && (
                  <div className="pet-roster-controls">
                    <div className="pet-exp-block">
                      <span><b>成长经验</b><em>{selectedProgress.experience} / {experienceToNextLevel(selectedProgress.level)}</em></span>
                      <i><b style={{ width: `${(selectedProgress.experience / experienceToNextLevel(selectedProgress.level)) * 100}%` }} /></i>
                    </div>
                    {view === "bag" ? <>
                      <button type="button" disabled={selectedId === activePetId || managementLocked} onClick={() => onSetActivePet(selectedId)}>{selectedId === activePetId ? "当前首发" : managementLocked ? "战斗中不可调整" : "设为首发伙伴"}</button>
                      <button type="button" disabled={selectedId === activePetId || managementLocked || ownedPetIds.length <= 1} onClick={() => onMoveToStorage(selectedId)}>送往仓库</button>
                    </> : <button type="button" disabled={ownedPetIds.length >= 6 || managementLocked} onClick={() => onMoveToParty(selectedId)}>{ownedPetIds.length >= 6 ? "队伍已满" : "加入同行队伍"}</button>}
                  </div>
                )}
                {selectedProgress && evolution && (
                  <div className={`pet-evolution-card${selectedProgress.evolved ? " evolved" : ""}`}>
                    <span><small>{selectedProgress.evolved ? "EVOLUTION COMPLETE" : "EVOLUTION"}</small><b>{selectedProgress.evolved ? evolution.name : `${selected.name} → ${evolution.name}`}</b><p>{evolution.description}</p></span>
                    <button type="button" disabled={selectedProgress.evolved || selectedProgress.level < evolution.level || inventory.crystals < evolution.crystalCost || managementLocked} onClick={() => onEvolve(selectedId)}>{selectedProgress.evolved ? "进化完成" : selectedProgress.level < evolution.level ? `需要 Lv.${evolution.level}` : inventory.crystals < evolution.crystalCost ? `灵契晶片 ${inventory.crystals}/${evolution.crystalCost}` : `消耗 ${evolution.crystalCost} 晶片进化`}</button>
                  </div>
                )}
                <div className="pet-detail-columns">
                  <section className="pet-stat-panel">
                    <h4>基础能力</h4>
                    {PET_STAT_LABELS.map(({ key, label }) => <div className="pet-stat-row" key={key}><span>{label}</span><i><b style={{ width: `${selectedStats[key]}%` }} /></i><em>{selectedStats[key]}</em></div>)}
                    <small>基础能力上限为 100，实际数值会随等级成长。</small>
                  </section>
                  <section className="pet-skill-panel">
                    <h4>{(view === "bag" || view === "storage") && selectedProgress ? "技能配置 · 4 个技能槽" : "技能记录"}</h4>
                    {selected.skills.map((skill) => {
                      const unlocked = skill.level <= selectedLevel;
                      const equippedSlot = selectedProgress?.equippedSkills.indexOf(skill.name) ?? -1;
                      return <div className={`pet-skill element-${skill.element}${unlocked ? "" : " skill-locked"}`} key={skill.name}>
                        <span><i>Lv.{skill.level}</i><b>{unlocked ? skill.name : "尚未领悟"}</b><em>{unlocked ? skill.power === null ? "变化" : `威力 ${skill.power}` : `Lv.${skill.level} 解锁`}</em></span>
                        <p>{unlocked ? skill.description : "继续获得经验并提升等级后即可查看。"}</p>
                        {(view === "bag" || view === "storage") && selectedProgress && unlocked && <div className="skill-slot-actions"><span>{equippedSlot >= 0 ? `已装备在技能 ${equippedSlot + 1}` : "可装备"}</span>{[0, 1, 2, 3].map((slot) => <button type="button" key={slot} className={equippedSlot === slot ? "active" : ""} disabled={managementLocked} onClick={() => onEquipSkill(selectedId, slot, skill.name)}>技能 {slot + 1}</button>)}</div>}
                      </div>;
                    })}
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

function FieldCampModal({
  inventory,
  research,
  onBuy,
  onClaim,
  onClose,
}: {
  inventory: AdventureInventory;
  research: FieldResearch;
  onBuy: (offerId: SupplyOfferId) => void;
  onClaim: () => void;
  onClose: () => void;
}) {
  const researchReady = isFieldResearchComplete(research);
  return (
    <div className="modal-backdrop field-camp-backdrop" onClick={onClose}>
      <section className="field-camp-modal" onClick={(event) => event.stopPropagation()} aria-label="青崖调查营地">
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <header><small>QINGYA FIELD CAMP</small><h2>青崖调查营地</h2><p>休整、补充捕捉用品，并提交这片水道的生态记录。</p></header>
        <div className="camp-wallet"><span>持有金币</span><b>{inventory.coins}</b><i>胶囊 {inventory.capsules}</i><i>莓果 {inventory.berries}</i><i>灵契晶片 {inventory.crystals}</i></div>
        <div className="camp-layout">
          <section className="camp-shop">
            <h3>旅行补给</h3>
            {(Object.entries(SUPPLY_OFFERS) as Array<[SupplyOfferId, (typeof SUPPLY_OFFERS)[SupplyOfferId]]>).map(([id, offer]) => (
              <button type="button" key={id} disabled={inventory.coins < offer.price} onClick={() => onBuy(id)}>
                <span><b>{offer.name}</b><small>{offer.description}</small></span><em>{offer.price} 金币</em>
              </button>
            ))}
          </section>
          <section className={`camp-research${researchReady ? " is-ready" : ""}${research.claimed ? " is-claimed" : ""}`}>
            <h3>支线 · 青崖生态调查</h3>
            <p>黎叔希望确认水道异变前后的宠物活动。战斗或捕捉都能留下有效记录。</p>
            <div><span>发现不同宠物</span><b>{Math.min(research.encounteredSpecies.length, FIELD_RESEARCH_REQUIREMENTS.species)} / {FIELD_RESEARCH_REQUIREMENTS.species}</b></div>
            <div><span>完成野外战斗</span><b>{Math.min(research.resolvedBattles, FIELD_RESEARCH_REQUIREMENTS.battles)} / {FIELD_RESEARCH_REQUIREMENTS.battles}</b></div>
            <div><span>完成捕捉</span><b>{Math.min(research.capturedPets, FIELD_RESEARCH_REQUIREMENTS.captures)} / {FIELD_RESEARCH_REQUIREMENTS.captures}</b></div>
            <button type="button" disabled={!researchReady || research.claimed} onClick={onClaim}>{research.claimed ? "报酬已领取" : researchReady ? "提交记录 · 领取报酬" : "调查尚未完成"}</button>
            <small>报酬：金币 120 · 召唤胶囊 3 · 香甜莓果 2 · 灵契晶片 2</small>
          </section>
        </div>
      </section>
    </div>
  );
}

function QuestLogModal({
  chapterDialoguesSeen,
  highlandAltarFound,
  highlandTrainerDefeated,
  pastureShrines,
  observatoryNodes,
  chapterOneComplete,
  sideQuests,
  ownsFrostPet,
  ownsBellsheep,
  onClose,
}: {
  chapterDialoguesSeen: ChapterDialogueId[];
  highlandAltarFound: boolean;
  highlandTrainerDefeated: boolean;
  pastureShrines: number[];
  observatoryNodes: number[];
  chapterOneComplete: boolean;
  sideQuests: HighlandSideQuestProgress;
  ownsFrostPet: boolean;
  ownsBellsheep: boolean;
  onClose: () => void;
}) {
  const mainSteps = [
    { title: "抵达断风调查营地", detail: "向栖川了解安琪儿留下的调查路线。", done: chapterDialoguesSeen.includes("highland_arrival") },
    { title: "聆听黑铃留声", detail: "调查断风遗迹东北方的无舌黑铃。", done: highlandAltarFound },
    { title: "通过三宠通行试炼", detail: "让岚绪确认伙伴仍会回应自己的名字。", done: highlandTrainerDefeated },
    { title: "唤醒三座云铃", detail: "恢复牧场与冻星观测站之间的风力回路。", done: pastureShrines.length >= 3 },
    { title: "连接三枚紫晶节点", detail: "解除观测圆台的封锁。", done: observatoryNodes.length >= 3 },
    { title: "取得未改写的记录", detail: "通过朔的接力战，验证未登记灵契。", done: chapterOneComplete },
    { title: "确认下一处坐标", detail: "阅读被王国地图抹去的西境育成所记录。", done: chapterDialoguesSeen.includes("chapter_epilogue") },
  ];
  const sideEntries: Array<{ id: HighlandSideQuestId; unlocked: boolean; ready: boolean; maximum: number }> = [
    { id: "frost_medicine", unlocked: true, ready: sideQuests.frost_medicine === 1 && ownsFrostPet, maximum: 2 },
    { id: "wind_courier", unlocked: true, ready: sideQuests.wind_courier === 4, maximum: 5 },
    { id: "lost_bellsheep", unlocked: highlandTrainerDefeated || sideQuests.lost_bellsheep > 0, ready: sideQuests.lost_bellsheep === 1 && ownsBellsheep, maximum: 2 },
  ];
  return (
    <div className="modal-backdrop quest-log-backdrop" onClick={onClose}>
      <section className="quest-log-modal" onClick={(event) => event.stopPropagation()} aria-label="任务日志">
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <header><small>TRAINER FIELD NOTES</small><h2>任务日志</h2><p>主线记录真相，支线记录那些不会出现在学院报告里的人。</p></header>
        <div className="quest-log-columns">
          <section className="main-quest-log">
            <div className="quest-section-title"><span>MAIN STORY</span><h3>第一章 · 黑铃回声</h3><b>{mainSteps.filter((step) => step.done).length}/{mainSteps.length}</b></div>
            <div className="quest-step-list">{mainSteps.map((step, index) => <article key={step.title} className={`${step.done ? "complete" : ""}${!step.done && mainSteps.slice(0, index).every((entry) => entry.done) ? " current" : ""}`}><i>{step.done ? "✓" : String(index + 1).padStart(2, "0")}</i><span><b>{step.title}</b><small>{step.detail}</small></span></article>)}</div>
          </section>
          <section className="side-quest-log">
            <div className="quest-section-title"><span>SIDE STORIES</span><h3>东之高原委托</h3><b>{sideEntries.filter((entry) => sideQuests[entry.id] >= entry.maximum).length}/{sideEntries.length}</b></div>
            <div className="side-quest-list">{sideEntries.map(({ id, unlocked, ready, maximum }) => {
              const definition = HIGHLAND_SIDE_QUESTS[id];
              const stage = sideQuests[id];
              const complete = stage >= maximum;
              const status = complete ? "已完成" : !unlocked ? "未发现" : stage === 0 ? "可接取" : ready ? "可提交" : "进行中";
              return <article key={id} className={`${complete ? "complete " : ""}${ready ? "ready " : ""}${!unlocked ? "locked" : ""}`}><header><span><small>{definition.region}</small><b>{definition.title}</b></span><em>{status}</em></header><p>{unlocked ? sideQuestObjective({ id, stage, ownsFrostPet, ownsBellsheep }) : "继续推进主线并与地图上的居民交谈。"}</p><footer><span>{definition.giver}</span><small>{definition.reward}</small></footer></article>;
            })}</div>
          </section>
        </div>
      </section>
    </div>
  );
}

function HighlandCampModal({
  inventory,
  partyIds,
  petProgress,
  partyHealth,
  quest,
  sideQuests,
  ownsFrostPet,
  onRest,
  onBuy,
  onSideQuest,
  onReturnCity,
  onClose,
}: {
  inventory: AdventureInventory;
  partyIds: PetSpeciesId[];
  petProgress: PetProgress[];
  partyHealth: Partial<Record<PetSpeciesId, number>>;
  quest: ChapterQuest;
  sideQuests: HighlandSideQuestProgress;
  ownsFrostPet: boolean;
  onRest: () => void;
  onBuy: (offerId: SupplyOfferId) => void;
  onSideQuest: (id: HighlandSideQuestId) => void;
  onReturnCity: () => void;
  onClose: () => void;
}) {
  const questText: Record<ChapterQuest, string> = {
    camp: "调查东北方黑铃祭台，确认安琪儿留下的坐标。",
    pass: "沿黑铃坐标进入风蚀栈道，寻找冻星观测站。",
    pasture: "通过巡风员岚绪的三宠试炼，前往云铃牧场。",
    observatory: "唤醒牧场三座石铃，恢复观测站的风力回路。",
    complete: "观测记录已经取回。第一章调查完成，可继续收集与培养宠物。",
  };
  return (
    <div className="modal-backdrop field-camp-backdrop" onClick={onClose}>
      <section className="field-camp-modal highland-camp-modal" onClick={(event) => event.stopPropagation()} aria-label="断风调查营地">
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <header><small>GALEBREAK EXPEDITION CAMP</small><h2>断风调查营地</h2><p>高原巡逻员会治疗同行宠物，也能补充远行物资。</p></header>
        <div className="camp-wallet"><span>持有金币</span><b>{inventory.coins}</b><i>胶囊 {inventory.capsules}</i><i>莓果 {inventory.berries}</i><i>灵契晶片 {inventory.crystals}</i></div>
        <div className="camp-layout">
          <section className="camp-shop camp-party-care">
            <h3>同行队伍 · 免费休整</h3>
            <div className="camp-party-list">{partyIds.map((id) => {
              const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
              const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
              const hp = partyHealth[id] ?? maximum;
              return <div key={id}><PetSprite id={id} size="sm" /><span><b>{petDisplayName(id, progress)}</b><small>Lv.{progress.level} · {hp}/{maximum}</small><Meter value={hp} max={maximum} /></span></div>;
            })}</div>
            <button type="button" onClick={onRest}><span><b>全队休整</b><small>恢复全部同行宠物的体力并清除异常状态</small></span><em>免费</em></button>
            {(Object.entries(SUPPLY_OFFERS) as Array<[SupplyOfferId, (typeof SUPPLY_OFFERS)[SupplyOfferId]]>).map(([id, offer]) => (
              <button type="button" key={id} disabled={inventory.coins < offer.price} onClick={() => onBuy(id)}><span><b>{offer.name}</b><small>{offer.description}</small></span><em>{offer.price} 金币</em></button>
            ))}
          </section>
          <section className="camp-research is-ready">
            <h3>主线 · 黑铃回声</h3><p>{questText[quest]}</p>
            <div><span>当前调查阶段</span><b>{quest === "complete" ? "完成" : `${["camp", "pass", "pasture", "observatory"].indexOf(quest) + 1} / 4`}</b></div>
            <button type="button" onClick={onClose}>{quest === "complete" ? "继续高原探索" : "返回地图继续调查"}</button>
            <div className="camp-quest-divider"><span>营地委托</span><i /></div>
            <button type="button" className="camp-sidequest-button" disabled={sideQuests.frost_medicine === 1 && !ownsFrostPet || sideQuests.frost_medicine >= 2} onClick={() => onSideQuest("frost_medicine")}><span>{HIGHLAND_SIDE_QUESTS.frost_medicine.title}</span><b>{sideQuests.frost_medicine >= 2 ? "已完成" : sideQuests.frost_medicine === 0 ? "接取" : ownsFrostPet ? "提交" : "寻找霜角鹿"}</b></button>
            <button type="button" className="camp-sidequest-button" disabled={(sideQuests.wind_courier > 0 && sideQuests.wind_courier < 4) || sideQuests.wind_courier >= 5} onClick={() => onSideQuest("wind_courier")}><span>{HIGHLAND_SIDE_QUESTS.wind_courier.title}</span><b>{sideQuests.wind_courier >= 5 ? "已完成" : sideQuests.wind_courier === 0 ? "接取" : sideQuests.wind_courier === 4 ? "提交" : `${sideQuests.wind_courier - 1}/3 口信`}</b></button>
            <button type="button" className="camp-return-button" onClick={onReturnCity}>搭乘索道返回彩虹学院</button>
          </section>
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
  const completedRef = useRef(false);
  const line = lines[index];
  const next = useCallback(() => {
    if (index >= lines.length - 1) {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }
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

function moveToward(current: number, target: number, maxDelta: number) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function useSmoothActor(options: {
  worldKey: string;
  enabled: boolean;
  startPosition: Position;
  initialFacing: RoadFacing;
  worldSize: Size;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  maxSpeed: number;
  isWalkable: (position: Position) => boolean;
  onPosition: (position: Position, distancePixels: number) => void;
  onCommit: (position: Position) => void;
  onInteract: (position: Position) => void;
  onBump: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const configRef = useRef(options);
  const keysRef = useRef<Set<string>>(new Set());
  const touchDirectionRef = useRef<Position>({ x: 0, y: 0 });
  const runtimeRef = useRef({
    worldKey: options.worldKey,
    position: { ...options.startPosition },
    previousPosition: { ...options.startPosition },
    velocity: { x: 0, y: 0 },
    camera: { x: 0, y: 0, initialized: false },
    facing: options.initialFacing,
    moving: false,
    travel: 0,
    lastCommit: 0,
    lastBump: 0,
  });

  useEffect(() => {
    configRef.current = options;
    if (runtimeRef.current.worldKey !== options.worldKey) {
      runtimeRef.current = {
        worldKey: options.worldKey,
        position: { ...options.startPosition },
        previousPosition: { ...options.startPosition },
        velocity: { x: 0, y: 0 },
        camera: { x: 0, y: 0, initialized: false },
        facing: options.initialFacing,
        moving: false,
        travel: 0,
        lastCommit: 0,
        lastBump: 0,
      };
      keysRef.current.clear();
      touchDirectionRef.current = { x: 0, y: 0 };
    }
    if (!options.enabled) {
      keysRef.current.clear();
      touchDirectionRef.current = { x: 0, y: 0 };
      runtimeRef.current.velocity = { x: 0, y: 0 };
      runtimeRef.current.moving = false;
    }
  }, [options]);

  const startTouchDirection = useCallback((dx: number, dy: number) => {
    if (!configRef.current.enabled) return;
    touchDirectionRef.current = { x: dx, y: dy };
  }, []);

  const stopTouchDirection = useCallback(() => {
    touchDirectionRef.current = { x: 0, y: 0 };
  }, []);

  const interact = useCallback(() => {
    const config = configRef.current;
    if (config.enabled) config.onInteract({ ...runtimeRef.current.position });
  }, []);

  useEffect(() => {
    const movementKeys = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
    const keys = keysRef.current;
    let animationFrame = 0;
    let lastFrame = performance.now();
    let accumulator = 0;

    const stopInput = () => {
      keys.clear();
      touchDirectionRef.current = { x: 0, y: 0 };
    };

    const keydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const config = configRef.current;
      if (movementKeys.has(key)) {
        event.preventDefault();
        if (config.enabled) keys.add(key);
        return;
      }
      if (key === "e") {
        event.preventDefault();
        if (!event.repeat && config.enabled) config.onInteract({ ...runtimeRef.current.position });
      }
    };

    const keyup = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      keys.delete(key);
    };

    const renderFrame = (now: number) => {
      const config = configRef.current;
      const runtime = runtimeRef.current;
      const elapsed = Math.min(0.08, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      const fixedStep = 1 / 60;
      accumulator = Math.min(accumulator + elapsed, fixedStep * 5);
      const keyboardX = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      const keyboardY = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
      const rawX = config.enabled ? keyboardX + touchDirectionRef.current.x : 0;
      const rawY = config.enabled ? keyboardY + touchDirectionRef.current.y : 0;
      const inputMagnitude = Math.hypot(rawX, rawY);
      const inputX = inputMagnitude > 0 ? rawX / inputMagnitude : 0;
      const inputY = inputMagnitude > 0 ? rawY / inputMagnitude : 0;
      const worldWidth = Math.max(1, config.worldSize.width);
      const worldHeight = Math.max(1, config.worldSize.height);
      let movedPixels = 0;
      let requestedPixels = 0;
      let blocked = false;
      let simulationSteps = 0;

      while (accumulator >= fixedStep && simulationSteps < 5) {
        runtime.previousPosition = { ...runtime.position };
        const acceleration = inputMagnitude > 0 ? 3200 : 4400;
        runtime.velocity.x = moveToward(runtime.velocity.x, inputX * config.maxSpeed, acceleration * fixedStep);
        runtime.velocity.y = moveToward(runtime.velocity.y, inputY * config.maxSpeed, acceleration * fixedStep);
        if (Math.abs(runtime.velocity.x) < 0.5) runtime.velocity.x = 0;
        if (Math.abs(runtime.velocity.y) < 0.5) runtime.velocity.y = 0;

        const deltaPixels = {
          x: runtime.velocity.x * fixedStep,
          y: runtime.velocity.y * fixedStep,
        };
        requestedPixels += Math.hypot(deltaPixels.x, deltaPixels.y);
        const movement = integrateActorMovement({
          position: runtime.position,
          deltaPixels,
          worldSize: { width: worldWidth, height: worldHeight },
          isWalkable: config.isWalkable,
        });
        runtime.position = movement.position;
        runtime.travel += movement.movedPixels;
        movedPixels += movement.movedPixels;
        if (movement.blockedX) runtime.velocity.x = 0;
        if (movement.blockedY) runtime.velocity.y = 0;
        blocked ||= movement.blockedX || movement.blockedY;
        accumulator -= fixedStep;
        simulationSteps += 1;
      }

      if (movedPixels > 0.001) {
        config.onPosition({ ...runtime.position }, movedPixels);
      }
      if (blocked && inputMagnitude > 0 && movedPixels < Math.max(0.4, requestedPixels * 0.35) && now - runtime.lastBump > 300) {
        runtime.lastBump = now;
        config.onBump();
      }
      if (movedPixels > 0 && now - runtime.lastCommit > 200) {
        runtime.lastCommit = now;
        config.onCommit({ ...runtime.position });
      }

      const moving = (simulationSteps === 0 ? runtime.moving : movedPixels > 0.04) && Math.hypot(runtime.velocity.x, runtime.velocity.y) > 10;
      const facingX = inputMagnitude > 0 ? inputX : runtime.velocity.x;
      const facingY = inputMagnitude > 0 ? inputY : runtime.velocity.y;
      if (Math.abs(facingX) > 0.05 || Math.abs(facingY) > 0.05) {
        runtime.facing = Math.abs(facingX) >= Math.abs(facingY) ? (facingX < 0 ? "left" : "right") : (facingY < 0 ? "up" : "down");
      }
      runtime.moving = moving;

      const player = playerRef.current;
      const frame = frameRef.current;
      const stage = stageRef.current;
      const viewport = config.viewportRef.current;
      if (player && frame && stage && viewport) {
        const interpolation = Math.min(1, accumulator / fixedStep);
        const renderPosition = {
          x: runtime.previousPosition.x + (runtime.position.x - runtime.previousPosition.x) * interpolation,
          y: runtime.previousPosition.y + (runtime.position.y - runtime.previousPosition.y) * interpolation,
        };
        const actorX = (renderPosition.x / 100) * worldWidth;
        const actorY = (renderPosition.y / 100) * worldHeight;
        player.style.transform = `translate3d(${actorX}px, ${actorY}px, 0) translate(-50%, -68%)`;
        player.classList.toggle("is-walking", moving);
        for (const direction of ["up", "down", "left", "right"] as RoadFacing[]) player.classList.toggle(`facing-${direction}`, runtime.facing === direction);
        const row = { down: 0, left: 1, right: 2, up: 3 }[runtime.facing];
        const walkCycle = [0, 1, 2, 1];
        const column = moving ? walkCycle[Math.floor(runtime.travel / 16) % walkCycle.length] : 1;
        const backgroundX = column === 0 ? 0 : column === 1 ? 50 : 100;
        const backgroundY = row === 0 ? 0 : row === 1 ? 100 / 3 : row === 2 ? 200 / 3 : 100;
        frame.style.backgroundPosition = `${backgroundX}% ${backgroundY}%`;

        const targetCameraX = Math.min(0, Math.max(viewport.clientWidth - worldWidth, viewport.clientWidth / 2 - actorX));
        const targetCameraY = Math.min(0, Math.max(viewport.clientHeight - worldHeight, viewport.clientHeight / 2 - actorY));
        if (!runtime.camera.initialized) {
          runtime.camera = { x: targetCameraX, y: targetCameraY, initialized: true };
        } else {
          const cameraBlend = 1 - Math.exp(-16 * elapsed);
          runtime.camera.x += (targetCameraX - runtime.camera.x) * cameraBlend;
          runtime.camera.y += (targetCameraY - runtime.camera.y) * cameraBlend;
        }
        stage.style.transform = `translate3d(${runtime.camera.x}px, ${runtime.camera.y}px, 0)`;
      }
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", stopInput);
    animationFrame = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      stopInput();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", stopInput);
    };
  }, []);

  return { stageRef, playerRef, frameRef, startTouchDirection, stopTouchDirection, interact };
}

function DPad({ disabled, onDirectionStart, onDirectionEnd, onInteract }: { disabled?: boolean; onDirectionStart: (dx: number, dy: number) => void; onDirectionEnd: () => void; onInteract: () => void }) {
  const keyboardPulse = (event: React.MouseEvent<HTMLButtonElement>, dx: number, dy: number) => {
    if (event.detail !== 0 || disabled) return;
    onDirectionStart(dx, dy);
    window.setTimeout(onDirectionEnd, 110);
  };
  return (
    <div className="touch-controls">
      <div className="dpad" aria-label="移动控制">
        <button type="button" disabled={disabled} onPointerDown={() => onDirectionStart(0, -1)} onPointerUp={onDirectionEnd} onPointerCancel={onDirectionEnd} onPointerLeave={onDirectionEnd} onClick={(event) => keyboardPulse(event, 0, -1)} aria-label="向上">▲</button>
        <button type="button" disabled={disabled} onPointerDown={() => onDirectionStart(-1, 0)} onPointerUp={onDirectionEnd} onPointerCancel={onDirectionEnd} onPointerLeave={onDirectionEnd} onClick={(event) => keyboardPulse(event, -1, 0)} aria-label="向左">◀</button>
        <i />
        <button type="button" disabled={disabled} onPointerDown={() => onDirectionStart(1, 0)} onPointerUp={onDirectionEnd} onPointerCancel={onDirectionEnd} onPointerLeave={onDirectionEnd} onClick={(event) => keyboardPulse(event, 1, 0)} aria-label="向右">▶</button>
        <button type="button" disabled={disabled} onPointerDown={() => onDirectionStart(0, 1)} onPointerUp={onDirectionEnd} onPointerCancel={onDirectionEnd} onPointerLeave={onDirectionEnd} onClick={(event) => keyboardPulse(event, 0, 1)} aria-label="向下">▼</button>
      </div>
      <button type="button" className="interact-button" disabled={disabled} onClick={onInteract}><span>E</span>互动</button>
    </div>
  );
}

function HomeScene({
  mapCamera,
  fieldViewportRef,
  playerName,
  startPosition,
  bumped,
  discoveries,
  toast,
  disabled,
  onPosition,
  onCommit,
  onInteract,
  onBump,
}: {
  mapCamera: { width: number; height: number; x: number; y: number };
  fieldViewportRef: React.RefObject<HTMLDivElement | null>;
  playerName: string;
  startPosition: Position;
  bumped: boolean;
  discoveries: HomeDiscovery[];
  toast: string;
  disabled: boolean;
  onPosition: (position: Position, distancePixels: number) => void;
  onCommit: (position: Position) => void;
  onInteract: (position: Position) => void;
  onBump: () => void;
}) {
  const readyToLeave = discoveries.length === Object.keys(HOME_INTERACTIONS).length;
  const { stageRef: homeStageRef, playerRef: homePlayerRef, frameRef: homeFrameRef, startTouchDirection: startHomeTouch, stopTouchDirection: stopHomeTouch, interact: interactAtHome } = useSmoothActor({
    worldKey: "home",
    enabled: !disabled,
    startPosition,
    initialFacing: "down",
    worldSize: { width: mapCamera.width, height: mapCamera.height },
    viewportRef: fieldViewportRef,
    maxSpeed: 205,
    isWalkable: isHomeWalkable,
    onPosition,
    onCommit,
    onInteract,
    onBump,
  });
  return (
    <section className="home-screen">
      <div className="mission-card home-mission-card">
        <small>临虹村 · {playerName}的家</small>
        <h3>离家之前</h3>
        <p>收好重要的东西，也看看家人今天特意留下了什么。</p>
        <div className="mission-items">
          {(Object.entries(HOME_INTERACTIONS) as Array<[HomeDiscovery, (typeof HOME_INTERACTIONS)[HomeDiscovery]]>).map(([id, item]) => <span key={id} className={discoveries.includes(id) ? "done" : ""}>◇ {item.label}</span>)}
          <span className={readyToLeave ? "ready" : ""}>◇ 从正门前往照护所</span>
        </div>
      </div>
      <div className="home-world" ref={fieldViewportRef} aria-label={`${playerName}的家，可探索室内地图`}>
        <div ref={homeStageRef} className="home-map-stage" style={{ width: `${mapCamera.width}px`, height: `${mapCamera.height}px` }}>
          <img src={SCENE_ART.home} alt={`${playerName}的家`} draggable={false} />
          {(Object.entries(HOME_INTERACTIONS) as Array<[HomeDiscovery, (typeof HOME_INTERACTIONS)[HomeDiscovery]]>).map(([id, item]) => (
            <button type="button" key={id} className={`home-hotspot${discoveries.includes(id) ? " discovered" : ""}`} style={{ left: `${item.marker.x}%`, top: `${item.marker.y}%` }} onClick={interactAtHome} aria-label={item.label}>
              <i>{discoveries.includes(id) ? "✓" : "!"}</i><span>{item.label}</span>
            </button>
          ))}
          <button type="button" className={`home-hotspot home-door-hotspot${readyToLeave ? " ready" : ""}`} style={{ left: "50%", top: "84%" }} onClick={interactAtHome} aria-label="前往照护所">
            <i>{readyToLeave ? "→" : "×"}</i><span>{readyToLeave ? "前往照护所" : "离家前再看看"}</span>
          </button>
          <div ref={homePlayerRef} className={`map-player home-player facing-down${bumped ? " is-bumping" : ""}`} style={{ transform: `translate3d(${(startPosition.x / 100) * mapCamera.width}px, ${(startPosition.y / 100) * mapCamera.height}px, 0) translate(-50%, -68%)` }}>
            <i className="map-player-shadow" aria-hidden="true" />
            <MapPlayerSprite facing="down" moving={false} step={0} frameRef={homeFrameRef} />
          </div>
        </div>
      </div>
      <div className="field-toast home-toast"><span>家</span><p>{toast}</p><kbd>E</kbd></div>
      <DPad disabled={disabled} onDirectionStart={startHomeTouch} onDirectionEnd={stopHomeTouch} onInteract={interactAtHome} />
      <span className="map-control-hint">WASD / 方向键移动 · E 调查</span>
    </section>
  );
}

function ExplorationScene({
  map,
  mapCamera,
  fieldViewportRef,
  partner,
  startPosition,
  initialFacing,
  roadBumped,
  roadInGrass,
  toast,
  encounterPending,
  missionTitle,
  missionText,
  missionItems,
  markers,
  mapReady,
  movementDisabled,
  onMapReady,
  onPosition,
  onCommit,
  onBump,
  onInteract,
}: {
  map: ExplorationMapDefinition;
  mapCamera: { width: number; height: number; x: number; y: number };
  fieldViewportRef: React.RefObject<HTMLDivElement | null>;
  partner: Partner;
  startPosition: Position;
  initialFacing: RoadFacing;
  roadBumped: boolean;
  roadInGrass: boolean;
  toast: string;
  encounterPending: boolean;
  missionTitle: string;
  missionText: string;
  missionItems: Array<{ label: string; done?: boolean }>;
  markers?: React.ReactNode;
  mapReady: boolean;
  movementDisabled: boolean;
  onMapReady: (mapId: ExplorationPhase) => void;
  onPosition: (position: Position, distancePixels: number) => void;
  onCommit: (position: Position) => void;
  onBump: () => void;
  onInteract: (position: Position) => void;
}) {
  const [mapLoadError, setMapLoadError] = useState(false);
  const [mapLoadAttempt, setMapLoadAttempt] = useState(0);
  const mapSource = mapLoadAttempt === 0
    ? map.image
    : `${map.image}${map.image.includes("?") ? "&" : "?"}retry=${mapLoadAttempt}`;
  const { stageRef, playerRef, frameRef, startTouchDirection, stopTouchDirection, interact } = useSmoothActor({
    worldKey: map.id,
    enabled: mapReady && !movementDisabled,
    startPosition,
    initialFacing,
    worldSize: { width: mapCamera.width, height: mapCamera.height },
    viewportRef: fieldViewportRef,
    maxSpeed: 230,
    isWalkable: (position) => canStandAt(map.id, position),
    onPosition,
    onCommit,
    onInteract,
    onBump,
  });

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
        <div ref={stageRef} className="rpg-map" style={{ width: `${mapCamera.width}px`, height: `${mapCamera.height}px` }}>
          <img
            className={`rpg-map-image${mapReady ? " is-ready" : ""}`}
            src={mapSource}
            alt={map.name}
            draggable={false}
            onLoad={(event) => handleMapLoaded(event.currentTarget)}
            onError={() => setMapLoadError(true)}
          />
          {markers}
          <div ref={playerRef} className={`map-player facing-${initialFacing}${roadBumped ? " is-bumping" : ""}${roadInGrass ? " in-grass" : ""}`} style={{ transform: `translate3d(${(startPosition.x / 100) * mapCamera.width}px, ${(startPosition.y / 100) * mapCamera.height}px, 0) translate(-50%, -68%)` }}>
            <i className="map-player-shadow" aria-hidden="true" />
            <MapPlayerSprite facing={initialFacing} moving={false} step={0} frameRef={frameRef} />
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
      <div className="field-toast"><span>{roadInGrass ? "草" : map.id === "rupture" ? "契" : map.id === "aftermath" ? "忆" : map.id === "highland" ? "原" : "路"}</span><p>{toast}</p><kbd>E</kbd></div>
      <DPad disabled={!mapReady || movementDisabled} onDirectionStart={startTouchDirection} onDirectionEnd={stopTouchDirection} onInteract={interact} />
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
  const [fieldCampOpen, setFieldCampOpen] = useState(false);
  const [highlandCampOpen, setHighlandCampOpen] = useState(false);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [ownedPetIds, setOwnedPetIds] = useState<PetSpeciesId[]>([]);
  const [storedPetIds, setStoredPetIds] = useState<PetSpeciesId[]>([]);
  const [seenPetIds, setSeenPetIds] = useState<PetSpeciesId[]>([]);
  const [activePetId, setActivePetId] = useState<PetSpeciesId | null>(null);
  const [petProgress, setPetProgress] = useState<PetProgress[]>([]);
  const [homePos, setHomePos] = useState<Position>(HOME_START);
  const [homeBumped, setHomeBumped] = useState(false);
  const [homeDiscoveries, setHomeDiscoveries] = useState<HomeDiscovery[]>([]);
  const [homeStory, setHomeStory] = useState<HomeStoryId | null>(null);
  const [homeToast, setHomeToast] = useState("先看看书桌上的推荐信。");
  const [shelterIntroOpen, setShelterIntroOpen] = useState(false);
  const [toast, setToast] = useState("沿着石径前往彩虹城");
  const [battleFx, setBattleFx] = useState<BattleFx | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const battleFxId = useRef(0);

  const [roadPos, setRoadPos] = useState<Position>(ROAD_START);
  const [roadFacing, setRoadFacing] = useState<RoadFacing>("right");
  const [roadBumped, setRoadBumped] = useState(false);
  const [roadInGrass, setRoadInGrass] = useState(false);
  const [loadedMapId, setLoadedMapId] = useState<ExplorationPhase | null>(null);
  const [fieldSize, setFieldSize] = useState<Size>({ width: 1280, height: 720 });
  const [encounterPending, setEncounterPending] = useState(false);
  const [inventory, setInventory] = useState<AdventureInventory>({ ...INITIAL_INVENTORY });
  const [fieldResearch, setFieldResearch] = useState<FieldResearch>({ ...INITIAL_FIELD_RESEARCH });
  const [prologueComplete, setPrologueComplete] = useState(false);
  const [highlandAltarFound, setHighlandAltarFound] = useState(false);
  const [partyHealth, setPartyHealth] = useState<Partial<Record<PetSpeciesId, number>>>({});
  const [chapterQuest, setChapterQuest] = useState<ChapterQuest>("camp");
  const [highlandTrainerDefeated, setHighlandTrainerDefeated] = useState(false);
  const [pastureShrines, setPastureShrines] = useState<number[]>([]);
  const [observatoryNodes, setObservatoryNodes] = useState<number[]>([]);
  const [chapterOneComplete, setChapterOneComplete] = useState(false);
  const [chapterDialoguesSeen, setChapterDialoguesSeen] = useState<ChapterDialogueId[]>([]);
  const [chapterDialogue, setChapterDialogue] = useState<ChapterDialogueId | null>(null);
  const [sideQuestDialogue, setSideQuestDialogue] = useState<SideQuestDialogueId | null>(null);
  const [highlandSideQuests, setHighlandSideQuests] = useState<HighlandSideQuestProgress>({ ...INITIAL_HIGHLAND_SIDE_QUESTS });
  const [battleReturnPhase, setBattleReturnPhase] = useState<BattleReturnPhase>("road");
  const [routeEncounterId, setRouteEncounterId] = useState<RouteEncounterId>("wild");
  const fieldViewportRef = useRef<HTMLDivElement | null>(null);
  const preloadedAssetsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const grassStepsRef = useRef(0);
  const grassTravelDistanceRef = useRef(0);
  const roadBumpTimer = useRef<number | null>(null);
  const homeBumpTimer = useRef<number | null>(null);
  const homePositionLiveRef = useRef<Position>(HOME_START);
  const roadPositionLiveRef = useRef<Position>(ROAD_START);
  const roadInGrassRef = useRef(false);
  const homeHintZoneRef = useRef("");
  const encounterPendingRef = useRef(false);
  const [wildHp, setWildHp] = useState(32);
  const [wildPlayerHp, setWildPlayerHp] = useState(66);
  const [wildCalm, setWildCalm] = useState(0);
  const [wildBattleResult, setWildBattleResult] = useState<WildBattleResult>("active");
  const [wildPartyHp, setWildPartyHp] = useState<Partial<Record<PetSpeciesId, number>>>({});
  const [battlePartyOpen, setBattlePartyOpen] = useState(false);
  const [captureLog, setCaptureLog] = useState("茸角鼠被荆棘缠住，正警惕地望着你。");
  const [trainerBattleId, setTrainerBattleId] = useState<TrainerBattleId>("ranger");
  const [trainerBattleResult, setTrainerBattleResult] = useState<TrainerBattleResult>("active");
  const [trainerEnemyIndex, setTrainerEnemyIndex] = useState(0);
  const [trainerEnemyHp, setTrainerEnemyHp] = useState(1);
  const [trainerPartyHp, setTrainerPartyHp] = useState<Partial<Record<PetSpeciesId, number>>>({});
  const [trainerPlayerStatus, setTrainerPlayerStatus] = useState<BattleStatus | null>(null);
  const [trainerEnemyStatus, setTrainerEnemyStatus] = useState<BattleStatus | null>(null);
  const [trainerPartyOpen, setTrainerPartyOpen] = useState(false);
  const [trainerLog, setTrainerLog] = useState("巡风员正在检查你的队伍。");
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

  const activeProgress = activePetId ? petProgress.find((entry) => entry.id === activePetId) ?? createPetProgress(activePetId) : null;
  const activeSpecies = activePetId ? PET_SPECIES[activePetId] : null;
  const activeStats = activeSpecies && activeProgress ? scaledPetStats(activeSpecies, activeProgress.level, activeProgress.evolved) : null;
  const activePetHp = activeStats?.hp;
  const activePetHpRef = useRef(activePetHp);
  const equippedSkillDefinitions = activeSpecies && activeProgress
    ? activeProgress.equippedSkills.map((name) => activeSpecies.skills.find((skill) => skill.name === name)).filter((skill): skill is PetSkill => Boolean(skill))
    : [];
  const primaryBattleSkill = equippedSkillDefinitions.find((skill) => skill.power !== null) ?? equippedSkillDefinitions[0] ?? null;
  const secondaryBattleSkill = equippedSkillDefinitions.find((skill) => skill.power === null) ?? equippedSkillDefinitions[1] ?? equippedSkillDefinitions[0] ?? null;
  const partner: Partner | null = activeSpecies && activeStats ? {
    id: activeSpecies.id,
    name: petDisplayName(activeSpecies.id, activeProgress),
    kind: activeSpecies.elementLabel,
    nature: activeSpecies.role,
    quote: activeSpecies.description,
    color: "#78b79e",
    hp: activeStats.hp,
    attack: primaryBattleSkill?.name ?? "基础冲撞",
    support: secondaryBattleSkill?.name ?? primaryBattleSkill?.name ?? "守护姿态",
  } : null;
  const routeEncounter = ROUTE_ENCOUNTERS[routeEncounterId];
  const trainerDefinition = TRAINER_BATTLES[trainerBattleId];
  const trainerEnemyPet = trainerDefinition.team[Math.min(trainerEnemyIndex, trainerDefinition.team.length - 1)];
  const trainerEnemySpecies = PET_SPECIES[trainerEnemyPet.id];
  const trainerEnemyStats = scaledPetStats(trainerEnemySpecies, trainerEnemyPet.level);
  const activeMap = (["road", "city", "festival", "rupture", "aftermath", "highland", "windPass", "pasture", "observatory"] as Phase[]).includes(phase)
    ? EXPLORATION_MAPS[phase as ExplorationPhase]
    : null;
  const mapAssetReady = activeMap !== null && loadedMapId === activeMap.id;

  useEffect(() => {
    activePetHpRef.current = activePetHp;
  }, [activePetHp]);

  const mapCamera = useMemo(() => {
    const scale = Math.max(fieldSize.width / MAP_PIXEL_SIZE.width, fieldSize.height / MAP_PIXEL_SIZE.height, fieldSize.width < 700 ? 0.72 : 0.82);
    const width = MAP_PIXEL_SIZE.width * scale;
    const height = MAP_PIXEL_SIZE.height * scale;
    return { width, height, x: 0, y: 0 };
  }, [fieldSize]);

  const homeCamera = useMemo(() => {
    const scale = Math.max(fieldSize.width / HOME_PIXEL_SIZE.width, fieldSize.height / HOME_PIXEL_SIZE.height, fieldSize.width < 700 ? 0.7 : 0.82);
    const width = HOME_PIXEL_SIZE.width * scale;
    const height = HOME_PIXEL_SIZE.height * scale;
    return { width, height, x: 0, y: 0 };
  }, [fieldSize]);

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
      storedPetIds,
      seenPetIds,
      activePetId: activePetId ?? undefined,
      petProgress,
      homeDiscoveries,
      inventory,
      fieldResearch,
      prologueComplete,
      highlandAltarFound,
      battleReturnPhase,
      partyHealth,
      chapterQuest,
      highlandTrainerDefeated,
      pastureShrines,
      observatoryNodes,
      chapterOneComplete,
      chapterDialoguesSeen,
      highlandSideQuests,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [activePetId, battleReturnPhase, captured, chapterDialoguesSeen, chapterOneComplete, chapterQuest, fieldResearch, highlandAltarFound, highlandSideQuests, highlandTrainerDefeated, homeDiscoveries, inventory, observatoryNodes, ownedPetIds, partnerId, partyHealth, pastureShrines, petProgress, phase, playerName, prologueComplete, routeEncounterId, seenPetIds, storedPetIds]);

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
    if (roadBumpTimer.current !== null) window.clearTimeout(roadBumpTimer.current);
    if (homeBumpTimer.current !== null) window.clearTimeout(homeBumpTimer.current);
  }, []);

  useEffect(() => {
    if ((!activeMap && phase !== "home") || !fieldViewportRef.current) return;
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
    if (["road", "highland", "windPass", "pasture", "observatory"].includes(next)) return;
    const map = EXPLORATION_MAPS[next as ExplorationPhase];
    setRoadPos(map.start);
    roadPositionLiveRef.current = map.start;
    setRoadFacing("up");
    setRoadBumped(false);
    setRoadInGrass(false);
    roadInGrassRef.current = false;
    grassTravelDistanceRef.current = 0;
    setToast(map.missionText);
  }, []);

  const registerPetSightings = useCallback((ids: PetSpeciesId[]) => {
    setSeenPetIds((current) => mergePetIds(current, ids));
  }, []);

  const grantPetExperience = useCallback((id: PetSpeciesId, amount: number) => {
    setPetProgress((current) => current.map((entry) => entry.id === id ? addPetExperience(entry, amount) : entry));
  }, []);

  const go = useCallback((next: Phase) => {
    playTone(next === "rupture" || next === "boss" ? 170 : 520);
    prepareExplorationMap(next);
    if (next === "shelter") registerPetSightings(STARTER_SIGHTINGS);
    if (next === "exam") registerPetSightings(["bird", "breeze"]);
    if (next === "festival") registerPetSightings(["ember", "spark"]);
    if (next === "rupture") registerPetSightings(["frost", "lantern"]);
    if (next === "aftermath") registerPetSightings(["moss"]);
    if (next === "boss") registerPetSightings(["guardian"]);
    if (next === "highland") registerPetSightings(["frost", "lantern", "breeze"]);
    if (next === "windPass") registerPetSightings(["breeze", "spark", "frost"]);
    if (next === "pasture") registerPetSightings(["breeze", "bird", "frost", "lantern"]);
    if (next === "observatory") registerPetSightings(["frost", "spark", "lantern", "guardian"]);
    if (next === "exam" && activePetHpRef.current) setExamHp(activePetHpRef.current);
    if (next === "boss" && activePetHpRef.current) setBossPlayerHp(activePetHpRef.current);
    if (next === "city") setCityDialogueOpen(false);
    if (next === "festival") setFestivalDialogueOpen(false);
    if (next === "aftermath") setAftermathDialogueOpen(false);
    setPhase(next);
  }, [playTone, prepareExplorationMap, registerPetSightings]);

  const enterExploration = useCallback((next: BattleReturnPhase) => {
    const map = EXPLORATION_MAPS[next];
    setRoadPos(map.start);
    roadPositionLiveRef.current = map.start;
    setRoadFacing("up");
    setRoadBumped(false);
    setRoadInGrass(false);
    roadInGrassRef.current = false;
    grassStepsRef.current = 0;
    grassTravelDistanceRef.current = 0;
    setToast(map.missionText);
    go(next);
  }, [go]);

  const enterHighland = useCallback(() => {
    setPrologueComplete(true);
    enterExploration("highland");
    if (!chapterDialoguesSeen.includes("highland_arrival")) setChapterDialogue("highland_arrival");
  }, [chapterDialoguesSeen, enterExploration]);

  const startTrainerBattle = useCallback((battleId: TrainerBattleId) => {
    const definition = TRAINER_BATTLES[battleId];
    const battleParty = ownedPetIds.slice(0, 3);
    if (battleParty.length === 0) return;
    const health = Object.fromEntries(battleParty.map((id) => {
      const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
      const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
      return [id, Math.max(0, Math.min(maximum, partyHealth[id] ?? maximum))];
    })) as Partial<Record<PetSpeciesId, number>>;
    const lead = battleParty.find((id) => (health[id] ?? 0) > 0);
    if (!lead) {
      setToast("同行宠物都无法战斗。先回断风营地休整吧。");
      setHighlandCampOpen(true);
      playTone(130);
      return;
    }
    const firstEnemy = definition.team[0];
    setTrainerBattleId(battleId);
    setTrainerBattleResult("active");
    setTrainerEnemyIndex(0);
    setTrainerEnemyHp(scaledPetStats(PET_SPECIES[firstEnemy.id], firstEnemy.level).hp);
    setTrainerPartyHp(health);
    setActivePetId(lead);
    setTrainerPlayerStatus(null);
    setTrainerEnemyStatus(null);
    setTrainerPartyOpen(false);
    setTrainerLog(`${definition.trainerName}派出了${PET_SPECIES[firstEnemy.id].name}。三宠接力战开始！`);
    setBattleBusy(false);
    registerPetSightings(definition.team.map((entry) => entry.id));
    go("trainerBattle");
  }, [go, ownedPetIds, partyHealth, petProgress, playTone, registerPetSightings]);

  const completeChapterDialogue = useCallback(() => {
    if (!chapterDialogue) return;
    const completed = chapterDialogue;
    setChapterDialoguesSeen((current) => current.includes(completed) ? current : [...current, completed]);
    setChapterDialogue(null);
    if (completed === "highland_arrival") {
      setHighlandCampOpen(true);
      setToast("营地里出现了新的居民委托。可从任务日志随时追踪。 ");
    }
    if (completed === "ranger_meeting") startTrainerBattle("ranger");
    if (completed === "warden_truth") startTrainerBattle("warden");
    if (completed === "chapter_epilogue") setToast("观测记录指向西境废弃育成所。高原支线仍可继续完成。 ");
  }, [chapterDialogue, startTrainerBattle]);

  const completeSideQuestDialogue = useCallback(() => {
    if (!sideQuestDialogue) return;
    const completed = sideQuestDialogue;
    setSideQuestDialogue(null);
    if (completed === "medicine_offer") setHighlandSideQuests((current) => ({ ...current, frost_medicine: Math.max(1, current.frost_medicine) }));
    if (completed === "medicine_complete") {
      setHighlandSideQuests((current) => ({ ...current, frost_medicine: 2 }));
      setInventory((current) => ({ ...current, coins: current.coins + 180, berries: current.berries + 3, crystals: current.crystals + 1 }));
      setToast("支线完成：获得 180 金币、3 份莓果与 1 枚灵契晶片。 ");
    }
    if (completed === "courier_offer") setHighlandSideQuests((current) => ({ ...current, wind_courier: Math.max(1, current.wind_courier) }));
    if (completed === "courier_ranger") setHighlandSideQuests((current) => ({ ...current, wind_courier: Math.max(2, current.wind_courier) }));
    if (completed === "courier_pasture") setHighlandSideQuests((current) => ({ ...current, wind_courier: Math.max(3, current.wind_courier) }));
    if (completed === "courier_warden") setHighlandSideQuests((current) => ({ ...current, wind_courier: Math.max(4, current.wind_courier) }));
    if (completed === "courier_complete") {
      setHighlandSideQuests((current) => ({ ...current, wind_courier: 5 }));
      setInventory((current) => ({ ...current, coins: current.coins + 260, capsules: current.capsules + 3, crystals: current.crystals + 2 }));
      setToast("支线完成：获得 260 金币、3 枚召唤胶囊与 2 枚灵契晶片。 ");
    }
    if (completed === "bellsheep_offer") setHighlandSideQuests((current) => ({ ...current, lost_bellsheep: Math.max(1, current.lost_bellsheep) }));
    if (completed === "bellsheep_complete") {
      setHighlandSideQuests((current) => ({ ...current, lost_bellsheep: 2 }));
      setInventory((current) => ({ ...current, coins: current.coins + 220, berries: current.berries + 2, crystals: current.crystals + 2 }));
      setToast("支线完成：获得 220 金币、2 份莓果与 2 枚灵契晶片。 ");
    }
    playTone(completed.endsWith("complete") ? 880 : 610);
  }, [playTone, sideQuestDialogue]);

  const openCampSideQuest = useCallback((id: HighlandSideQuestId) => {
    if (id === "frost_medicine") {
      if (highlandSideQuests.frost_medicine === 0) setSideQuestDialogue("medicine_offer");
      else if (highlandSideQuests.frost_medicine === 1 && mergePetIds(ownedPetIds, storedPetIds).includes("frost")) setSideQuestDialogue("medicine_complete");
      else return;
    }
    if (id === "wind_courier") {
      if (highlandSideQuests.wind_courier === 0) setSideQuestDialogue("courier_offer");
      else if (highlandSideQuests.wind_courier === 4) setSideQuestDialogue("courier_complete");
      else return;
    }
    setHighlandCampOpen(false);
  }, [highlandSideQuests, ownedPetIds, storedPetIds]);

  const newGame = () => {
    window.localStorage.removeItem(SAVE_KEY);
    setPlayerName("小澈");
    setDraftName("小澈");
    setPartnerId(null);
    setCaptured(false);
    setCollectionView(null);
    setFieldCampOpen(false);
    setHighlandCampOpen(false);
    setQuestLogOpen(false);
    setOwnedPetIds([]);
    setStoredPetIds([]);
    setSeenPetIds([]);
    setActivePetId(null);
    setPetProgress([]);
    setHomePos(HOME_START);
    homePositionLiveRef.current = HOME_START;
    homeHintZoneRef.current = "";
    setHomeBumped(false);
    setHomeDiscoveries([]);
    setHomeStory(null);
    setHomeToast("先看看书桌上的推荐信。");
    setShelterIntroOpen(false);
    setBattleFx(null);
    setBattleBusy(false);
    setRoadPos(ROAD_START);
    roadPositionLiveRef.current = ROAD_START;
    setRoadFacing("right");
    setRoadBumped(false);
    setRoadInGrass(false);
    roadInGrassRef.current = false;
    setLoadedMapId(null);
    setEncounterPending(false);
    encounterPendingRef.current = false;
    setRouteEncounterId("wild");
    setInventory({ ...INITIAL_INVENTORY });
    setFieldResearch({ ...INITIAL_FIELD_RESEARCH });
    setPrologueComplete(false);
    setHighlandAltarFound(false);
    setPartyHealth({});
    setChapterQuest("camp");
    setHighlandTrainerDefeated(false);
    setPastureShrines([]);
    setObservatoryNodes([]);
    setChapterOneComplete(false);
    setChapterDialoguesSeen([]);
    setChapterDialogue(null);
    setSideQuestDialogue(null);
    setHighlandSideQuests({ ...INITIAL_HIGHLAND_SIDE_QUESTS });
    setBattleReturnPhase("road");
    grassStepsRef.current = 0;
    grassTravelDistanceRef.current = 0;
    setWildHp(32);
    setWildPlayerHp(66);
    setWildCalm(0);
    setWildBattleResult("active");
    setWildPartyHp({});
    setBattlePartyOpen(false);
    setTrainerBattleId("ranger");
    setTrainerBattleResult("active");
    setTrainerEnemyIndex(0);
    setTrainerEnemyHp(1);
    setTrainerPartyHp({});
    setTrainerPlayerStatus(null);
    setTrainerEnemyStatus(null);
    setTrainerPartyOpen(false);
    setTrainerLog("巡风员正在检查你的队伍。");
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
        ? isRouteEncounterId(saved.capturedPetId) ? saved.capturedPetId : "wild"
        : null;
      const allRestoredOwned = mergePetIds(
        (saved.ownedPetIds ?? []).filter(isPetSpeciesId),
        restoredPartnerId ? [restoredPartnerId] : [],
        restoredCapturedId ? [restoredCapturedId] : [],
      );
      const restoredOwned = allRestoredOwned.slice(0, 6);
      const restoredStored = mergePetIds(
        (saved.storedPetIds ?? []).filter(isPetSpeciesId),
        allRestoredOwned.slice(6),
      ).filter((id) => !restoredOwned.includes(id));
      const restoredPhase = saved.phase === "title" || saved.phase === "name"
        ? "shelter"
        : saved.phase === "trainerBattle" ? (saved.chapterQuest === "observatory" ? "observatory" : "windPass") : saved.phase;
      const restoredSeen = mergePetIds(
        storySightingsForPhase(restoredPhase),
        (saved.seenPetIds ?? []).filter(isPetSpeciesId),
        restoredOwned,
        restoredStored,
      );
      const savedProgress = new Map((saved.petProgress ?? []).filter((entry) => isPetSpeciesId(entry?.id)).map((entry) => [entry.id, entry]));
      const restoredProgress = mergePetIds(restoredOwned, restoredStored).map((id) => normalizePetProgress(savedProgress.get(id), id));
      const restoredActivePetId = isPetSpeciesId(saved.activePetId) && restoredOwned.includes(saved.activePetId)
        ? saved.activePetId
        : restoredPartnerId ?? restoredOwned[0] ?? null;
      const restoredPartyHealth = Object.fromEntries(mergePetIds(restoredOwned, restoredStored).map((id) => {
        const progress = restoredProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
        const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
        const savedHp = saved.partyHealth?.[id];
        return [id, typeof savedHp === "number" ? Math.max(0, Math.min(maximum, Math.round(savedHp))) : maximum];
      })) as Partial<Record<PetSpeciesId, number>>;
      setPlayerName(saved.playerName || "小澈");
      setDraftName(saved.playerName || "小澈");
      setPartnerId(restoredPartnerId);
      setExamHp(restoredPartnerId ? PARTNERS[restoredPartnerId].hp : 62);
      setCaptured(Boolean(saved.captured));
      setRouteEncounterId(restoredCapturedId ?? "wild");
      setOwnedPetIds(restoredOwned);
      setStoredPetIds(restoredStored);
      setSeenPetIds(restoredSeen);
      setActivePetId(restoredActivePetId);
      setPetProgress(restoredProgress);
      setPartyHealth(restoredPartyHealth);
      setInventory(normalizeInventory(saved.inventory));
      setFieldResearch(normalizeFieldResearch(saved.fieldResearch));
      setPrologueComplete(Boolean(saved.prologueComplete) || ["ending", "highland", "windPass", "pasture", "observatory"].includes(restoredPhase));
      setHighlandAltarFound(Boolean(saved.highlandAltarFound));
      setChapterQuest(saved.chapterQuest ?? (saved.highlandAltarFound ? "pass" : "camp"));
      setHighlandTrainerDefeated(Boolean(saved.highlandTrainerDefeated));
      setPastureShrines((saved.pastureShrines ?? []).filter((value) => Number.isInteger(value) && value >= 0 && value < PASTURE_SHRINE_POSITIONS.length));
      setObservatoryNodes((saved.observatoryNodes ?? []).filter((value) => Number.isInteger(value) && value >= 0 && value < OBSERVATORY_NODE_POSITIONS.length));
      setChapterOneComplete(Boolean(saved.chapterOneComplete));
      setChapterDialoguesSeen((saved.chapterDialoguesSeen ?? []).filter((id): id is ChapterDialogueId => CHAPTER_DIALOGUE_IDS.includes(id as ChapterDialogueId)));
      setChapterDialogue(null);
      setSideQuestDialogue(null);
      setHighlandSideQuests(normalizeHighlandSideQuests(saved.highlandSideQuests));
      setBattleReturnPhase(["road", "highland", "windPass", "pasture", "observatory"].includes(saved.battleReturnPhase ?? "") ? saved.battleReturnPhase as BattleReturnPhase : "road");
      setFieldCampOpen(false);
      setHighlandCampOpen(false);
      setQuestLogOpen(false);
      const restoredHomeDiscoveries = (saved.homeDiscoveries ?? []).filter((entry): entry is HomeDiscovery => entry === "photo" || entry === "letter" || entry === "breakfast");
      setHomePos(HOME_START);
      homePositionLiveRef.current = HOME_START;
      homeHintZoneRef.current = "";
      setHomeDiscoveries(restoredHomeDiscoveries);
      setHomeStory(null);
      setHomeToast(restoredHomeDiscoveries.length === 3 ? "东西都收好了。到正门按 E 前往照护所。" : "离家前，再看看房间里发光的地方。");
      setShelterIntroOpen(false);
      if (restoredActivePetId) {
        const restoredActiveProgress = restoredProgress.find((entry) => entry.id === restoredActivePetId) ?? createPetProgress(restoredActivePetId);
        const restoredHp = scaledPetStats(PET_SPECIES[restoredActivePetId], restoredActiveProgress.level, restoredActiveProgress.evolved).hp;
        setExamHp(restoredHp);
        setBossPlayerHp(restoredHp);
        setWildPlayerHp(restoredHp);
      }
      prepareExplorationMap(restoredPhase);
      setPhase(restoredPhase);
    } catch {
      newGame();
    }
  };

  const selectPartner = (id: PartnerId) => {
    setPartnerId(id);
    setOwnedPetIds([id]);
    setStoredPetIds([]);
    setActivePetId(id);
    setPetProgress([createPetProgress(id)]);
    setPartyHealth({ [id]: PARTNERS[id].hp });
    registerPetSightings(STARTER_SIGHTINGS);
    setExamHp(PARTNERS[id].hp);
    setBossPlayerHp(PARTNERS[id].hp);
    setWildPlayerHp(PARTNERS[id].hp);
    playTone(id === "leaf" ? 480 : id === "metal" ? 330 : 580);
  };

  const setLeadPet = useCallback((id: PetSpeciesId) => {
    if (!ownedPetIds.includes(id)) return;
    const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
    const hp = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
    setActivePetId(id);
    setExamHp(hp);
    setBossPlayerHp(hp);
    setWildPlayerHp(hp);
    setToast(`${petDisplayName(id, progress)}成为了新的首发伙伴。`);
    playTone(680);
  }, [ownedPetIds, petProgress, playTone]);

  const movePetToStorage = useCallback((id: PetSpeciesId) => {
    if (id === activePetId || !ownedPetIds.includes(id) || ownedPetIds.length <= 1) return;
    setOwnedPetIds((current) => current.filter((petId) => petId !== id));
    setStoredPetIds((current) => mergePetIds(current, [id]));
    setToast(`${petDisplayName(id, petProgress.find((entry) => entry.id === id))}已送往宠物仓库。`);
    playTone(520);
  }, [activePetId, ownedPetIds, petProgress, playTone]);

  const movePetToParty = useCallback((id: PetSpeciesId) => {
    if (!storedPetIds.includes(id) || ownedPetIds.length >= 6) return;
    setStoredPetIds((current) => current.filter((petId) => petId !== id));
    setOwnedPetIds((current) => mergePetIds(current, [id]).slice(0, 6));
    setToast(`${petDisplayName(id, petProgress.find((entry) => entry.id === id))}加入了同行队伍。`);
    playTone(680);
  }, [ownedPetIds.length, petProgress, playTone, storedPetIds]);

  const evolvePet = useCallback((id: PetSpeciesId) => {
    const evolution = PET_EVOLUTIONS[id];
    const progress = petProgress.find((entry) => entry.id === id);
    if (!evolution || !progress || progress.evolved || progress.level < evolution.level || inventory.crystals < evolution.crystalCost) return;
    setInventory((current) => ({ ...current, crystals: Math.max(0, current.crystals - evolution.crystalCost) }));
    setPetProgress((current) => current.map((entry) => entry.id === id ? { ...entry, evolved: true } : entry));
    setToast(`${PET_SPECIES[id].name}回应灵契晶片，进化为${evolution.name}！`);
    playTone(920);
  }, [inventory.crystals, petProgress, playTone]);

  const equipPetSkill = useCallback((id: PetSpeciesId, slot: number, skillName: string) => {
    setPetProgress((current) => current.map((entry) => {
      if (entry.id !== id) return entry;
      const species = PET_SPECIES[id];
      const skill = species.skills.find((candidate) => candidate.name === skillName);
      if (!skill || skill.level > entry.level || slot < 0 || slot > 3) return entry;
      const next = [...entry.equippedSkills];
      const previousSlot = next.indexOf(skillName);
      if (previousSlot === slot) return entry;
      if (previousSlot >= 0) {
        const replaced = next[slot];
        next[slot] = skillName;
        if (replaced) next[previousSlot] = replaced;
        else next.splice(previousSlot, 1);
      } else {
        next[slot] = skillName;
      }
      return { ...entry, equippedSkills: next.filter(Boolean).slice(0, 4) };
    }));
    playTone(740);
  }, [playTone]);

  const purchaseSupply = useCallback((offerId: SupplyOfferId) => {
    const result = buySupply(inventory, offerId);
    if (!result.purchased) {
      setToast("金币不够。完成野外战斗或提交生态调查可以获得报酬。");
      playTone(130);
      return;
    }
    setInventory(result.inventory);
    setToast(`购入${SUPPLY_OFFERS[offerId].name}。用品已经放进训练师背包。`);
    playTone(720);
  }, [inventory, playTone]);

  const claimResearchReward = useCallback(() => {
    const result = claimFieldResearch(fieldResearch, inventory);
    if (!result.claimed) return;
    setFieldResearch(result.research);
    setInventory(result.inventory);
    setToast("青崖生态调查完成：获得 120 金币、3 枚胶囊、2 份莓果和 2 枚灵契晶片。");
    playTone(860);
  }, [fieldResearch, inventory, playTone]);

  const healPartyAtCamp = useCallback(() => {
    const healed = Object.fromEntries(ownedPetIds.map((id) => {
      const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
      return [id, scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp];
    })) as Partial<Record<PetSpeciesId, number>>;
    setPartyHealth((current) => ({ ...current, ...healed }));
    setTrainerPlayerStatus(null);
    setTrainerEnemyStatus(null);
    setToast("巡逻员完成了全队治疗。所有同行宠物恢复到最佳状态。");
    playTone(820);
  }, [ownedPetIds, petProgress, playTone]);

  const handleHomePosition = useCallback((position: Position) => {
    homePositionLiveRef.current = position;
    const nearby = (Object.entries(HOME_INTERACTIONS) as Array<[HomeDiscovery, (typeof HOME_INTERACTIONS)[HomeDiscovery]]>)
      .find(([, item]) => distance(position, item.position) < 8);
    const zone = nearby?.[0] ?? (distance(position, { x: 50, y: 84 }) < 9 ? "door" : "floor");
    if (zone === homeHintZoneRef.current) return;
    homeHintZoneRef.current = zone;
    if (nearby) setHomeToast(`${nearby[1].hint} 靠近后按 E 调查。`);
    else if (zone === "door") setHomeToast(homeDiscoveries.length === 3 ? "东西已经收好，按 E 出发。" : "似乎还有东西没有确认。看看发光的地方。可按 E 调查。");
  }, [homeDiscoveries.length]);

  const bumpHome = useCallback(() => {
    setHomeBumped(true);
    setHomeToast("家具挡住了这边，沿着边缘移动可以自然绕开。");
    playTone(115);
    if (homeBumpTimer.current !== null) window.clearTimeout(homeBumpTimer.current);
    homeBumpTimer.current = window.setTimeout(() => setHomeBumped(false), 180);
  }, [playTone]);

  const interactHome = useCallback((position: Position) => {
    if (phase !== "home" || homeStory !== null || collectionView !== null || helpOpen) return;
    homePositionLiveRef.current = position;
    setHomePos(position);
    if (distance(position, { x: 50, y: 84 }) < 9) {
      if (homeDiscoveries.length < 3) {
        setHomeToast(`还有 ${3 - homeDiscoveries.length} 处重要的东西没有确认。`);
        playTone(145);
        return;
      }
      setHomeStory("door");
      playTone(680);
      return;
    }
    const nearby = (Object.entries(HOME_INTERACTIONS) as Array<[HomeDiscovery, (typeof HOME_INTERACTIONS)[HomeDiscovery]]>)
      .find(([, item]) => distance(position, item.position) < 9);
    if (nearby) {
      setHomeStory(nearby[0]);
      playTone(homeDiscoveries.includes(nearby[0]) ? 520 : 640);
      return;
    }
    setHomeToast("这里没有需要带走的东西。靠近发光标记后按 E 调查。");
  }, [collectionView, helpOpen, homeDiscoveries, homeStory, phase, playTone]);

  const completeHomeStory = useCallback(() => {
    if (!homeStory) return;
    if (homeStory === "door") {
      setHomeStory(null);
      setShelterIntroOpen(true);
      go("shelter");
      return;
    }
    if (homeStory === "wake") {
      setHomeStory(null);
      setHomeToast("调查旧合影、推荐信和餐桌上的便笺。");
      return;
    }
    const discovery = homeStory;
    const next = homeDiscoveries.includes(discovery) ? homeDiscoveries : [...homeDiscoveries, discovery];
    setHomeDiscoveries(next);
    setHomeStory(null);
    setHomeToast(next.length === 3 ? "重要的东西都确认过了。到正门按 E 前往照护所。" : `记住了这段线索。还剩 ${3 - next.length} 处。`);
  }, [go, homeDiscoveries, homeStory]);

  const beginRouteEncounter = useCallback((id: RouteEncounterId, returnPhase: BattleReturnPhase) => {
    if (encounterPendingRef.current) return;
    encounterPendingRef.current = true;
    const encounter = ROUTE_ENCOUNTERS[id];
    grassTravelDistanceRef.current = 0;
    registerPetSightings([id]);
    setFieldResearch((current) => recordEncounter(current, id));
    setBattleReturnPhase(returnPhase);
    setRouteEncounterId(id);
    setWildHp(encounter.maxHp);
    const battleHealth = Object.fromEntries(ownedPetIds.map((petId) => {
      const progress = petProgress.find((entry) => entry.id === petId) ?? createPetProgress(petId);
      const maximum = scaledPetStats(PET_SPECIES[petId], progress.level, progress.evolved).hp;
      return [petId, Math.max(0, Math.min(maximum, partyHealth[petId] ?? maximum))];
    })) as Partial<Record<PetSpeciesId, number>>;
    const leadHealth = activePetId ? battleHealth[activePetId] ?? activePetHpRef.current ?? 60 : activePetHpRef.current ?? 60;
    setWildPlayerHp(leadHealth);
    setWildPartyHp(battleHealth);
    setBattlePartyOpen(false);
    setWildCalm(0);
    setWildBattleResult("active");
    setCaptureLog(`高草突然晃动，${encounter.name}警惕地跳了出来！`);
    setToast(`野生的${encounter.name}出现了！`);
    setEncounterPending(true);
    playTone(210);
  }, [activePetId, ownedPetIds, partyHealth, petProgress, playTone, registerPetSightings]);

  const handleRoadPosition = useCallback((position: Position, distancePixels: number) => {
    roadPositionLiveRef.current = position;
    if (!activeMap || encounterPendingRef.current) return;
    const inGrass = isEncounterTerrain(activeMap.id, position);
    if (inGrass !== roadInGrassRef.current) {
      roadInGrassRef.current = inGrass;
      setRoadInGrass(inGrass);
      if (inGrass) setToast(phase !== "road" ? "草丛里传来陌生铃声。这里栖息着高原宠物。" : captured ? "高草沙沙作响。继续调查可能遇到不同的宠物。" : "高草在脚边晃动……");
      else if (phase === "road") setToast(captured ? "沿石阶和道路绕向东北城门。" : "金色高草里有野生宠物活动的痕迹。");
      else setToast(activeMap.missionText);
    }
    if (!inGrass) {
      grassStepsRef.current = 0;
      grassTravelDistanceRef.current = 0;
      return;
    }
    grassTravelDistanceRef.current += distancePixels;
    if (grassTravelDistanceRef.current < 72) return;
    grassTravelDistanceRef.current -= 72;
    grassStepsRef.current += 1;
    const steps = grassStepsRef.current;
    const chance = steps < 3 ? 0 : Math.min(0.18 + (steps - 3) * 0.12, 0.72);
    setToast(steps < 3 ? "高草在脚边晃动……" : "附近传来了野生宠物的叫声！");
    if (steps >= 9 || Math.random() < chance) {
      grassStepsRef.current = 0;
      setRoadPos(position);
      const returnPhase: BattleReturnPhase = ["highland", "windPass", "pasture", "observatory"].includes(phase) ? phase as BattleReturnPhase : "road";
      beginRouteEncounter(randomRouteEncounter(returnPhase), returnPhase);
    }
  }, [activeMap, beginRouteEncounter, captured, phase]);

  const bumpRoad = useCallback(() => {
    if (!activeMap) return;
    setRoadBumped(true);
    setToast(activeMap.collisionText);
    playTone(115);
    if (roadBumpTimer.current !== null) window.clearTimeout(roadBumpTimer.current);
    roadBumpTimer.current = window.setTimeout(() => setRoadBumped(false), 180);
  }, [activeMap, playTone]);

  const exploreInteraction = useCallback((position: Position) => {
    if (!activeMap || !mapAssetReady || collectionView !== null || fieldCampOpen || highlandCampOpen || questLogOpen || chapterDialogue || sideQuestDialogue || helpOpen) return;
    roadPositionLiveRef.current = position;
    setRoadPos(position);
    if (phase === "road" && distance(position, ROAD_START) < 9) {
      setFieldCampOpen(true);
      setToast(isFieldResearchComplete(fieldResearch) && !fieldResearch.claimed ? "生态调查已经完成，可以在营地提交记录。" : "青崖调查营地提供补给和生态调查委托。");
      playTone(610);
      return;
    }
    if (phase === "road" && distance(position, activeMap.interaction) < 8) {
      if (!captured) {
        setToast("学院要求先完成一次野外捕捉练习。去高草区看看吧。");
        playTone(150);
        return;
      }
      setToast("城门守卫确认了图鉴记录。欢迎来到彩虹城！");
      go("city");
      return;
    }
    if (phase === "city" && distance(position, EXPLORATION_MAPS.city.start) < 8) {
      setRoadPos(CITY_GATE);
      roadPositionLiveRef.current = CITY_GATE;
      setToast("穿过南门，重新回到了青崖水道。营地和高草调查仍会保留进度。");
      go("road");
      return;
    }
    if (phase === "city" && distance(position, activeMap.interaction) < 8) {
      if (prologueComplete) {
        setToast("学院北门的升降索道已经恢复，正在前往东之高原。");
        enterHighland();
        return;
      }
      setCityDialogueOpen(true);
      playTone(650);
      return;
    }
    if (phase === "festival" && distance(position, activeMap.interaction) < 10) {
      setFestivalDialogueOpen(true);
      playTone(720);
      return;
    }
    if (phase === "rupture") {
      const node = RUPTURE_NODE_POSITIONS.findIndex((nodePosition, index) => !ruptureNodes.includes(index) && distance(position, nodePosition) < 8);
      if (node >= 0) {
        const next = [...ruptureNodes, node];
        setRuptureNodes(next);
        playTone(300 + node * 120);
        setToast(next.length === 3 ? "三处灵契已稳定。沿中央石路前往上方裂隙台。" : `第 ${next.length} 处灵契已稳定，继续寻找其余晶柱。`);
        return;
      }
      if (ruptureNodes.length === 3 && distance(position, activeMap.interaction) < 9) {
        go("boss");
        return;
      }
    }
    if (phase === "aftermath" && distance(position, activeMap.interaction) < 9) {
      setAftermathDialogueOpen(true);
      playTone(620);
      return;
    }
    if (phase === "highland" && distance(position, activeMap.start) < 9) {
      if (!chapterDialoguesSeen.includes("highland_arrival")) setChapterDialogue("highland_arrival");
      else setHighlandCampOpen(true);
      setToast("断风调查营地可以治疗全队、补充物资或搭乘索道返回学院。");
      playTone(610);
      return;
    }
    if (phase === "highland" && distance(position, activeMap.interaction) < 9) {
      if (!highlandAltarFound) {
        setHighlandAltarFound(true);
        setChapterQuest("pass");
        setChapterDialoguesSeen((current) => current.includes("altar_memory") ? current : [...current, "altar_memory"]);
        setChapterDialogue("altar_memory");
        setInventory((current) => ({ ...current, coins: current.coins + 160, crystals: current.crystals + 3 }));
        setToast("在黑铃基座下发现了安琪儿留下的坐标。获得 160 金币与 3 枚灵契晶片。");
        playTone(880);
      } else {
        setToast("黑铃坐标指向前方的风蚀栈道。正在进入新的高原区域。");
        enterExploration("windPass");
      }
      return;
    }
    if (phase === "windPass" && distance(position, activeMap.start) < 9) {
      enterExploration("highland");
      return;
    }
    if (phase === "windPass" && distance(position, WIND_PASS_RANGER_POSITION) < 8) {
      if (!highlandTrainerDefeated) {
        if (!chapterDialoguesSeen.includes("ranger_meeting")) {
          setChapterDialoguesSeen((current) => [...current, "ranger_meeting"]);
          setChapterDialogue("ranger_meeting");
        } else startTrainerBattle("ranger");
      } else if (highlandSideQuests.wind_courier === 1) setSideQuestDialogue("courier_ranger");
      else setToast("岚绪：山门已经为你开放。去云铃牧场调查三座石铃吧。");
      return;
    }
    if (phase === "windPass" && distance(position, activeMap.interaction) < 9) {
      if (!highlandTrainerDefeated) {
        setToast("山门需要巡风员的通行许可。先在中央栈道通过三宠试炼。");
        playTone(150);
      } else enterExploration("pasture");
      return;
    }
    if (phase === "pasture" && distance(position, activeMap.start) < 9) {
      enterExploration("windPass");
      return;
    }
    if (phase === "pasture") {
      if (distance(position, PASTURE_KEEPER_POSITION) < 8) {
        if (highlandSideQuests.wind_courier === 2) setSideQuestDialogue("courier_pasture");
        else if (highlandSideQuests.lost_bellsheep === 0) setSideQuestDialogue("bellsheep_offer");
        else if (highlandSideQuests.lost_bellsheep === 1 && mergePetIds(ownedPetIds, storedPetIds).includes("breeze")) setSideQuestDialogue("bellsheep_complete");
        else setToast(highlandSideQuests.lost_bellsheep >= 2 ? "芙禾：它们已经开始沿着铃声回家了。" : "芙禾：别追得太急。让风铃羊自己决定是否靠近。 ");
        return;
      }
      const shrine = PASTURE_SHRINE_POSITIONS.findIndex((shrinePosition, index) => !pastureShrines.includes(index) && distance(position, shrinePosition) < 8);
      if (shrine >= 0) {
        const next = [...pastureShrines, shrine];
        setPastureShrines(next);
        if (next.length === PASTURE_SHRINE_POSITIONS.length) {
          setChapterQuest("observatory");
          setChapterDialoguesSeen((current) => current.includes("pasture_echo") ? current : [...current, "pasture_echo"]);
          setChapterDialogue("pasture_echo");
          setInventory((current) => ({ ...current, berries: current.berries + 2, crystals: current.crystals + 1 }));
          setToast("三座云铃同时回应，观测站阶梯重新亮起。获得 2 份莓果与 1 枚灵契晶片。");
          playTone(880);
        } else {
          setToast(`第 ${next.length} 座云铃已经唤醒。风正把铃声送往观测站。`);
          playTone(480 + shrine * 100);
        }
        return;
      }
      if (distance(position, activeMap.interaction) < 9) {
        if (pastureShrines.length < PASTURE_SHRINE_POSITIONS.length) {
          setToast(`观测站没有回应。还需唤醒 ${PASTURE_SHRINE_POSITIONS.length - pastureShrines.length} 座云铃。`);
          playTone(150);
        } else enterExploration("observatory");
        return;
      }
    }
    if (phase === "observatory" && distance(position, activeMap.start) < 9) {
      enterExploration("pasture");
      return;
    }
    if (phase === "observatory") {
      const node = OBSERVATORY_NODE_POSITIONS.findIndex((nodePosition, index) => !observatoryNodes.includes(index) && distance(position, nodePosition) < 8);
      if (node >= 0) {
        const next = [...observatoryNodes, node];
        setObservatoryNodes(next);
        setToast(next.length === OBSERVATORY_NODE_POSITIONS.length ? "三枚紫晶节点完成连接。圆形观测台的封锁已经解除。" : `观测回路 ${next.length}/3 已连接。`);
        playTone(420 + node * 130);
        return;
      }
      if (distance(position, activeMap.interaction) < 9) {
        if (chapterOneComplete) {
          if (!chapterDialoguesSeen.includes("chapter_epilogue")) {
            setChapterDialoguesSeen((current) => [...current, "chapter_epilogue"]);
            setChapterDialogue("chapter_epilogue");
          } else if (highlandSideQuests.wind_courier === 3) setSideQuestDialogue("courier_warden");
          else setToast("朔留在圆台旁整理记录。安琪儿的下一组坐标仍在显现。");
        } else if (observatoryNodes.length < OBSERVATORY_NODE_POSITIONS.length) {
          setToast(`圆台仍被封锁。还需连接 ${OBSERVATORY_NODE_POSITIONS.length - observatoryNodes.length} 枚紫晶节点。`);
          playTone(150);
        } else if (!chapterDialoguesSeen.includes("warden_truth")) {
          setChapterDialoguesSeen((current) => [...current, "warden_truth"]);
          setChapterDialogue("warden_truth");
        } else startTrainerBattle("warden");
        return;
      }
    }

    if (phase === "road") setToast(captured ? "沿可见道路前往东北城门，靠近后按 E。" : "进入金色高草移动，野生宠物会随机出现。");
    if (phase === "city") setToast("学院门位于地图上方；星泉、水渠和花坛均不可穿越。");
    if (phase === "festival") setToast("中央彩虹纹章是庆典会合点，靠近后按 E。");
    if (phase === "rupture") setToast(ruptureNodes.length === 3 ? "前往上方裂隙台。" : "靠近尚未稳定的发光晶柱后按 E。");
    if (phase === "aftermath") setToast("从左右回廊绕过中央晶核，前往上方记忆祭台。");
    if (phase === "highland") setToast("沿金色道路穿过悬桥；进入灌丛会遇到高原宠物。");
    if (phase === "windPass") setToast("沿石路寻找中央栈道的巡风员岚绪。通过三宠试炼才能打开山门。");
    if (phase === "pasture") setToast("靠近尚未回应的云铃后按 E。银蓝草甸里会出现稀有宠物。");
    if (phase === "observatory") setToast("连接左右回廊与中央阶梯旁的三枚紫晶节点。");
  }, [activeMap, captured, chapterDialogue, chapterDialoguesSeen, chapterOneComplete, collectionView, enterExploration, enterHighland, fieldCampOpen, fieldResearch, go, helpOpen, highlandAltarFound, highlandCampOpen, highlandSideQuests, highlandTrainerDefeated, mapAssetReady, observatoryNodes, ownedPetIds, pastureShrines, phase, playTone, prologueComplete, questLogOpen, ruptureNodes, sideQuestDialogue, startTrainerBattle, storedPetIds]);

  useEffect(() => {
    if (!encounterPending) return;
    const timer = window.setTimeout(() => {
      setEncounterPending(false);
      encounterPendingRef.current = false;
      go("capture");
    }, 760);
    return () => window.clearTimeout(timer);
  }, [encounterPending, go]);


  const finishWildBattle = (wasCaptured: boolean) => {
    const rewards = battleRewards(routeEncounter.level, wasCaptured);
    const crystalReward = battleReturnPhase !== "road" && routeEncounter.level >= 8 ? 1 : 0;
    const alreadyOwned = ownedPetIds.includes(routeEncounter.id) || storedPetIds.includes(routeEncounter.id);
    const sentToStorage = wasCaptured && !alreadyOwned && ownedPetIds.length >= 6;
    setWildBattleResult(wasCaptured ? "captured" : "victory");
    setBattlePartyOpen(false);
    setInventory((current) => ({ ...current, coins: current.coins + rewards.coins, crystals: current.crystals + crystalReward }));
    setFieldResearch((current) => recordBattleResolution(current, wasCaptured));
    setPetProgress((current) => {
      const withCaptured = wasCaptured && !current.some((entry) => entry.id === routeEncounter.id)
        ? [...current, createPetProgress(routeEncounter.id)]
        : current;
      return withCaptured.map((entry) => {
        if (entry.id === activePetId) return addPetExperience(entry, rewards.experience);
        if (wasCaptured && entry.id === routeEncounter.id) return addPetExperience(entry, 12);
        return entry;
      });
    });
    if (wasCaptured) {
      setCaptured(true);
      if (!alreadyOwned) {
        if (sentToStorage) setStoredPetIds((current) => mergePetIds(current, [routeEncounter.id]));
        else setOwnedPetIds((current) => mergePetIds(current, [routeEncounter.id]).slice(0, 6));
        setPartyHealth((current) => ({ ...current, [routeEncounter.id]: PET_SPECIES[routeEncounter.id].stats.hp }));
      }
      registerPetSightings([routeEncounter.id]);
    }
    return { ...rewards, crystalReward, sentToStorage, alreadyOwned };
  };

  const wildCounterAttack = async (
    guarding = false,
    hpBeforeCounter = wildPlayerHp,
    targetId = activePetId,
    defense = activeStats?.defense ?? 45,
    targetName = partner?.name ?? "伙伴",
  ) => {
    if (!targetId) return false;
    const incoming = calculateWildCounterDamage({
      enemyLevel: routeEncounter.level,
      enemyPower: 36 + routeEncounter.level * 2,
      defense,
      guarding,
    });
    const nextHp = Math.max(0, hpBeforeCounter - incoming);
    setCaptureLog(`${routeEncounter.name}抓住空隙发动反击！`);
    await animateBattleFx({ skill: `${routeEncounter.name}的反击`, kind: "claw", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
      setWildPlayerHp(nextHp);
      setWildPartyHp((current) => ({ ...current, [targetId]: nextHp }));
      setPartyHealth((current) => ({ ...current, [targetId]: nextHp }));
    });
    if (nextHp <= 0) {
      const reserve = ownedPetIds.find((id) => id !== targetId && (wildPartyHp[id] ?? 0) > 0);
      if (reserve) {
        setBattlePartyOpen(true);
        setCaptureLog(`${targetName}失去了战斗能力！请选择一只仍能战斗的同行伙伴。`);
        return true;
      }
      const loss = Math.min(18, inventory.coins);
      setInventory((current) => ({ ...current, coins: Math.max(0, current.coins - loss) }));
      setWildBattleResult("defeat");
      setCaptureLog(`同行队伍全部失去了战斗能力。巡逻员送你们回到安全地带，遗失了 ${loss} 枚金币。`);
      return true;
    }
    setCaptureLog(`${routeEncounter.name}的反击造成 ${incoming} 点伤害。`);
    return false;
  };

  const switchWildPet = async (id: PetSpeciesId) => {
    if (battleBusy || wildBattleResult !== "active" || id === activePetId || !ownedPetIds.includes(id)) return;
    const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
    const stats = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved);
    const storedHp = wildPartyHp[id] ?? stats.hp;
    if (storedHp <= 0) return;
    const forcedSwitch = wildPlayerHp <= 0;
    if (activePetId) setWildPartyHp((current) => ({ ...current, [activePetId]: wildPlayerHp }));
    setBattleBusy(true);
    setActivePetId(id);
    setWildPlayerHp(storedHp);
    setBattlePartyOpen(false);
    const nextName = petDisplayName(id, progress);
    setCaptureLog(`${nextName}接替首发，进入战斗！`);
    try {
      await animateBattleFx({ skill: forcedSwitch ? "伙伴接力" : "主动换宠", kind: "call", attacker: "trainer", target: "ally", value: nextName, positive: true });
      if (!forcedSwitch) await wildCounterAttack(false, storedHp, id, stats.defense, nextName);
    } finally {
      setBattleBusy(false);
    }
  };

  const captureAction = async (action: number | "calm" | "ball" | "escape") => {
    if (wildBattleResult !== "active" || battleBusy || wildPlayerHp <= 0 || !partner || !activeSpecies || !activeProgress || !activeStats) return;
    setBattleBusy(true);
    try {
      if (typeof action === "number") {
        const skill = equippedSkillDefinitions[action];
        if (!skill) return;
        if (skill.power === null) {
          const guarding = skill.description.includes("防御") || skill.description.includes("伤害减半") || ["metal", "earth"].includes(skill.element);
          const healing = guarding ? 0 : Math.max(8, Math.round(activeStats.spirit * 0.16));
          const healedHp = Math.min(partner.hp, wildPlayerHp + healing);
          setCaptureLog(`${partner.name}准备使出${skill.name}。`);
          await animateBattleFx({ skill: skill.name, kind: guarding ? "guard" : "heal", attacker: "ally", target: "ally", value: guarding ? "防御提升" : `HP +${healing}`, positive: true }, () => {
            if (healing > 0) {
              setWildPlayerHp(healedHp);
              if (activePetId) setWildPartyHp((current) => ({ ...current, [activePetId]: healedHp }));
              if (activePetId) setPartyHealth((current) => ({ ...current, [activePetId]: healedHp }));
            }
          });
          await wildCounterAttack(guarding, healedHp);
          return;
        }
        const targetSpecies = PET_SPECIES[routeEncounter.id];
        const multiplier = elementMultiplier(skill.element, targetSpecies.element);
        const damage = calculateSkillDamage({
          power: skill.power,
          level: activeProgress.level,
          attack: activeStats.attack,
          defense: targetSpecies.stats.defense,
          multiplier,
        });
        const nextHp = Math.max(0, wildHp - damage);
        const effectiveness = multiplier > 1.1 ? "效果拔群！" : multiplier < 0.8 ? "效果不太理想。" : "";
        setCaptureLog(`${partner.name}锁定目标，使出${skill.name}！`);
        await animateBattleFx({ skill: skill.name, kind: petBattleFxKind(skill.element), attacker: "ally", target: "enemy", value: `-${wildHp - nextHp}` }, () => setWildHp(nextHp));
        if (nextHp <= 0) {
          const rewards = finishWildBattle(false);
          setCaptureLog(`${routeEncounter.name}失去战斗能力。${effectiveness} 获得 ${rewards.experience} 经验、${rewards.coins} 金币${rewards.crystalReward ? `与 ${rewards.crystalReward} 枚灵契晶片` : ""}。`);
          playTone(820);
          return;
        }
        setCaptureLog(`${skill.name}造成 ${damage} 点伤害。${effectiveness}`);
        await wildCounterAttack(false);
        return;
      }
      if (action === "calm") {
        if (inventory.berries <= 0) {
          setCaptureLog("香甜莓果已经用完。可以撤退后到青崖调查营地补给。");
          playTone(130);
          return;
        }
        const nextCalm = Math.min(3, wildCalm + 1);
        setCaptureLog("你没有逼近，而是把香甜莓果轻轻放到了地上。");
        await animateBattleFx({ skill: "安抚 · 香甜莓果", kind: "calm", attacker: "trainer", target: "enemy", value: "戒备 ↓", positive: true }, () => {
          setInventory((current) => ({ ...current, berries: Math.max(0, current.berries - 1) }));
          setWildCalm(nextCalm);
        });
        setCaptureLog(`${routeEncounter.name}嗅了嗅莓果，戒备的姿势慢慢放松下来。`);
        await wildCounterAttack(true);
        return;
      }
      if (action === "escape") {
        const targetSpeed = PET_SPECIES[routeEncounter.id].stats.speed;
        const successChance = Math.max(0.45, Math.min(0.9, 0.68 + (activeStats.speed - targetSpeed) / 180));
        const success = Math.random() < successChance;
        setCaptureLog(success ? `${partner.name}掩护你退出了高草。` : `${routeEncounter.name}挡住了撤退路线！`);
        await animateBattleFx({ skill: "撤离战斗", kind: "wind", attacker: "ally", target: success ? "ally" : "enemy", value: success ? "成功撤离" : "撤离失败", positive: success });
        if (success) {
          setWildBattleResult("escaped");
          return;
        }
        await wildCounterAttack(false);
        return;
      }
      if (inventory.capsules <= 0) {
        setCaptureLog("召唤胶囊已经用完。可以继续战斗获取金币，再到青崖调查营地补给。");
        playTone(130);
        return;
      }
      const chance = captureChance({ hp: wildHp, maxHp: routeEncounter.maxHp, calm: wildCalm, alreadyOwned: ownedPetIds.includes(routeEncounter.id) || storedPetIds.includes(routeEncounter.id) });
      const success = Math.random() < chance;
      setCaptureLog(`捕捉成功率约 ${Math.round(chance * 100)}%。召唤胶囊划出一道弧光……`);
      await animateBattleFx({ skill: "召唤胶囊", kind: "capsule", attacker: "trainer", target: "enemy", value: success ? "灵契成立" : "挣脱！", positive: success }, () => {
        setInventory((current) => ({ ...current, capsules: Math.max(0, current.capsules - 1) }));
      });
      if (success) {
        const rewards = finishWildBattle(true);
        setCaptureLog(`${routeEncounter.name}主动触碰胶囊，接受了你的邀请。${rewards.alreadyOwned ? "你们的灵契变得更加稳固。" : rewards.sentToStorage ? "同行队伍已满，它已前往宠物仓库。" : "它加入了同行队伍。"} 获得 ${rewards.experience} 经验与 ${rewards.coins} 金币。`);
        playTone(860);
        return;
      }
      setCaptureLog(`${routeEncounter.name}挣脱了胶囊！当前成功率约 ${Math.round(chance * 100)}%。`);
      await wildCounterAttack(false);
    } finally {
      setBattleBusy(false);
    }
  };

  const finishTrainerVictory = (battleId: TrainerBattleId) => {
    const definition = TRAINER_BATTLES[battleId];
    const battleParty = ownedPetIds.slice(0, 3);
    setTrainerBattleResult("victory");
    setTrainerPartyOpen(false);
    setTrainerPlayerStatus(null);
    setTrainerEnemyStatus(null);
    setInventory((current) => ({
      ...current,
      coins: current.coins + definition.rewardCoins,
      crystals: current.crystals + (battleId === "warden" ? 4 : 0),
    }));
    setPetProgress((current) => current.map((entry) => battleParty.includes(entry.id) ? addPetExperience(entry, definition.rewardExperience) : entry));
    if (battleId === "ranger") {
      setHighlandTrainerDefeated(true);
      setChapterQuest("pasture");
      setTrainerLog(`岚绪收起风铃：三场接力都很稳。获得 ${definition.rewardExperience} 经验与 ${definition.rewardCoins} 金币，山门通行许可已经开放。`);
    } else {
      setChapterOneComplete(true);
      setChapterQuest("complete");
      registerPetSightings(["guardian"]);
      setTrainerLog(`朔交出了安琪儿的观测记录。获得 ${definition.rewardExperience} 经验、${definition.rewardCoins} 金币与 4 枚灵契晶片。第一章完成！`);
    }
    playTone(920);
  };

  const advanceTrainerEnemy = async (nextIndex: number) => {
    if (nextIndex >= trainerDefinition.team.length) {
      finishTrainerVictory(trainerBattleId);
      return true;
    }
    const nextPet = trainerDefinition.team[nextIndex];
    const nextStats = scaledPetStats(PET_SPECIES[nextPet.id], nextPet.level);
    setTrainerEnemyIndex(nextIndex);
    setTrainerEnemyHp(nextStats.hp);
    setTrainerEnemyStatus(null);
    setTrainerLog(`${trainerDefinition.trainerName}收回倒下的伙伴，派出了${PET_SPECIES[nextPet.id].name}！`);
    await animateBattleFx({ skill: `第 ${nextIndex + 1} 只 · ${PET_SPECIES[nextPet.id].name}`, kind: "call", attacker: "enemy", target: "enemy", value: `Lv.${nextPet.level}`, positive: true });
    return true;
  };

  const trainerEnemyTurn = async (options: {
    enemyHp: number;
    playerHp: number;
    guarding?: boolean;
    enemyStatus?: BattleStatus | null;
    playerId?: PetSpeciesId | null;
  }) => {
    const playerId = options.playerId ?? activePetId;
    if (!playerId) return;
    const playerProgress = petProgress.find((entry) => entry.id === playerId) ?? createPetProgress(playerId);
    const playerStats = scaledPetStats(PET_SPECIES[playerId], playerProgress.level, playerProgress.evolved);
    let currentEnemyHp = options.enemyHp;
    const currentEnemyStatus = options.enemyStatus === undefined ? trainerEnemyStatus : options.enemyStatus;
    const tick = applyStatusTick({ hp: currentEnemyHp, maxHp: trainerEnemyStats.hp, status: currentEnemyStatus });
    if (tick.damage > 0) {
      await animateBattleFx({ skill: `${BATTLE_STATUS_LABELS[currentEnemyStatus!]}持续伤害`, kind: "memory", attacker: "ally", target: "enemy", value: `-${tick.damage}` }, () => {
        currentEnemyHp = tick.hp;
        setTrainerEnemyHp(tick.hp);
      });
    }
    if (currentEnemyHp <= 0) {
      await advanceTrainerEnemy(trainerEnemyIndex + 1);
      return;
    }
    if (tick.skipTurn) {
      setTrainerEnemyStatus(null);
      setTrainerLog(`${trainerEnemySpecies.name}被冰封，错过了行动机会！`);
      return;
    }
    const support = trainerEnemySpecies.skills.find((skill) => skill.level <= trainerEnemyPet.level && skill.power === null);
    const attack = trainerEnemySpecies.skills.find((skill) => skill.level <= trainerEnemyPet.level && skill.power !== null) ?? trainerEnemySpecies.skills[0];
    if (enemyAction({ hp: currentEnemyHp, maxHp: trainerEnemyStats.hp, hasSupportSkill: Boolean(support) }) === "support" && support) {
      const recovery = Math.max(8, Math.round(trainerEnemyStats.spirit * 0.18));
      const healed = Math.min(trainerEnemyStats.hp, currentEnemyHp + recovery);
      setTrainerLog(`${trainerDefinition.trainerName}判断体力不足，${trainerEnemySpecies.name}使出${support.name}！`);
      await animateBattleFx({ skill: support.name, kind: "heal", attacker: "enemy", target: "enemy", value: `HP +${healed - currentEnemyHp}`, positive: true }, () => setTrainerEnemyHp(healed));
      return;
    }
    const multiplier = elementMultiplier(attack.element, PET_SPECIES[playerId].element);
    const rawDamage = calculateSkillDamage({ power: attack.power ?? 36, level: trainerEnemyPet.level, attack: trainerEnemyStats.attack, defense: playerStats.defense, multiplier });
    const damage = Math.max(4, Math.round(rawDamage * (options.guarding ? 0.48 : currentEnemyStatus === "slow" ? 0.78 : 1)));
    const nextHp = Math.max(0, options.playerHp - damage);
    setTrainerLog(`${trainerEnemySpecies.name}发动${attack.name}！`);
    await animateBattleFx({ skill: attack.name, kind: petBattleFxKind(attack.element), attacker: "enemy", target: "ally", value: `-${damage}` }, () => {
      setTrainerPartyHp((current) => ({ ...current, [playerId]: nextHp }));
      setPartyHealth((current) => ({ ...current, [playerId]: nextHp }));
    });
    const inflicted = shouldInflictStatus({ element: attack.element, power: attack.power });
    const nextStatus = inflicted ? statusForElement(attack.element) : null;
    if (nextStatus) setTrainerPlayerStatus(nextStatus);
    if (nextHp <= 0) {
      const reserve = ownedPetIds.slice(0, 3).find((id) => id !== playerId && (trainerPartyHp[id] ?? partyHealth[id] ?? 0) > 0);
      if (reserve) {
        setTrainerPartyOpen(true);
        setTrainerLog(`${petDisplayName(playerId, playerProgress)}失去战斗能力！请选择接替伙伴。`);
      } else {
        setTrainerBattleResult("defeat");
        setTrainerLog("三只同行宠物都失去了战斗能力。巡逻员将队伍送回断风营地。");
      }
      return;
    }
    setTrainerLog(`${attack.name}造成 ${damage} 点伤害${nextStatus ? `，并附加${BATTLE_STATUS_LABELS[nextStatus]}` : ""}。`);
  };

  const switchTrainerPet = async (id: PetSpeciesId) => {
    if (battleBusy || trainerBattleResult !== "active" || id === activePetId || !ownedPetIds.slice(0, 3).includes(id)) return;
    const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
    const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
    const hp = trainerPartyHp[id] ?? partyHealth[id] ?? maximum;
    if (hp <= 0) return;
    const forced = activePetId ? (trainerPartyHp[activePetId] ?? 0) <= 0 : true;
    setBattleBusy(true);
    setActivePetId(id);
    setTrainerPlayerStatus(null);
    setTrainerPartyOpen(false);
    setTrainerLog(`${petDisplayName(id, progress)}接替上场！`);
    try {
      await animateBattleFx({ skill: forced ? "接力换宠" : "战术换宠", kind: "call", attacker: "trainer", target: "ally", value: petDisplayName(id, progress), positive: true });
      if (!forced) await trainerEnemyTurn({ enemyHp: trainerEnemyHp, playerHp: hp, playerId: id });
    } finally {
      setBattleBusy(false);
    }
  };

  const trainerAction = async (slot: number) => {
    if (battleBusy || trainerBattleResult !== "active" || !activePetId || !activeSpecies || !activeProgress || !activeStats) return;
    const skill = equippedSkillDefinitions[slot];
    if (!skill) return;
    setBattleBusy(true);
    try {
      const currentHp = trainerPartyHp[activePetId] ?? partyHealth[activePetId] ?? activeStats.hp;
      const playerTick = applyStatusTick({ hp: currentHp, maxHp: activeStats.hp, status: trainerPlayerStatus });
      if (playerTick.damage > 0) {
        await animateBattleFx({ skill: `${BATTLE_STATUS_LABELS[trainerPlayerStatus!]}持续伤害`, kind: "memory", attacker: "enemy", target: "ally", value: `-${playerTick.damage}` }, () => {
          setTrainerPartyHp((current) => ({ ...current, [activePetId]: playerTick.hp }));
          setPartyHealth((current) => ({ ...current, [activePetId]: playerTick.hp }));
        });
      }
      if (playerTick.hp <= 0) {
        setTrainerPartyOpen(true);
        setTrainerLog(`${petDisplayName(activePetId, activeProgress)}被异常状态耗尽体力，请选择接替伙伴。`);
        return;
      }
      if (playerTick.skipTurn) {
        setTrainerPlayerStatus(null);
        setTrainerLog(`${petDisplayName(activePetId, activeProgress)}挣脱了冰封，但本回合无法行动。`);
        await trainerEnemyTurn({ enemyHp: trainerEnemyHp, playerHp: playerTick.hp });
        return;
      }
      if (skill.power === null) {
        const guarding = skill.description.includes("防御") || skill.description.includes("伤害") || ["metal", "earth", "ice", "wind"].includes(skill.element);
        const recovery = guarding ? 0 : Math.max(9, Math.round(activeStats.spirit * 0.18));
        const healed = Math.min(activeStats.hp, playerTick.hp + recovery);
        setTrainerLog(`${petDisplayName(activePetId, activeProgress)}使出${skill.name}！`);
        await animateBattleFx({ skill: skill.name, kind: guarding ? "guard" : "heal", attacker: "ally", target: "ally", value: guarding ? "伤害减半" : `HP +${healed - playerTick.hp}`, positive: true }, () => {
          setTrainerPartyHp((current) => ({ ...current, [activePetId]: healed }));
          setPartyHealth((current) => ({ ...current, [activePetId]: healed }));
          if (skill.description.includes("清除")) setTrainerPlayerStatus(null);
        });
        await trainerEnemyTurn({ enemyHp: trainerEnemyHp, playerHp: healed, guarding });
        return;
      }
      const multiplier = elementMultiplier(skill.element, trainerEnemySpecies.element);
      const damage = calculateSkillDamage({ power: skill.power, level: activeProgress.level, attack: activeStats.attack, defense: trainerEnemyStats.defense, multiplier });
      const nextEnemyHp = Math.max(0, trainerEnemyHp - damage);
      const nextStatus = shouldInflictStatus({ element: skill.element, power: skill.power }) ? statusForElement(skill.element) : null;
      setTrainerLog(`${petDisplayName(activePetId, activeProgress)}使出${skill.name}！`);
      await animateBattleFx({ skill: skill.name, kind: petBattleFxKind(skill.element), attacker: "ally", target: "enemy", value: `-${damage}` }, () => {
        setTrainerEnemyHp(nextEnemyHp);
        if (nextStatus) setTrainerEnemyStatus(nextStatus);
      });
      if (nextEnemyHp <= 0) {
        await advanceTrainerEnemy(trainerEnemyIndex + 1);
        return;
      }
      setTrainerLog(`${skill.name}造成 ${damage} 点伤害${nextStatus ? `，附加${BATTLE_STATUS_LABELS[nextStatus]}` : ""}。`);
      await trainerEnemyTurn({ enemyHp: nextEnemyHp, playerHp: playerTick.hp, enemyStatus: nextStatus ?? trainerEnemyStatus });
    } finally {
      setBattleBusy(false);
    }
  };

  const examAction = async (slot: number) => {
    if (examWon || battleBusy || !partner) return;
    const skill = equippedSkillDefinitions[slot];
    if (!skill) return;
    setBattleBusy(true);
    try {
      if (skill.power === null) {
        const isGuard = ["metal", "beast", "spirit"].includes(skill.element) || skill.description.includes("防御") || skill.description.includes("伤害减半");
        setExamLog(`${partner.name}使出${skill.name}，银羽雀正在寻找反击角度。`);
        await animateBattleFx({ skill: skill.name, kind: isGuard ? "guard" : "heal", attacker: "ally", target: "ally", value: isGuard ? "伤害减半" : "HP +10", positive: true }, () => {
          if (isGuard) setExamGuard(true);
          else setExamHp((value) => Math.min(partner.hp, value + 10));
        });
        const incoming = isGuard ? 3 : 6;
        setExamLog("银羽雀振翅升空——风刃反击！");
        await animateBattleFx({ skill: "回旋风刃", kind: "wind", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
          setExamHp((value) => Math.max(8, value - incoming));
          setExamGuard(false);
        });
        setExamLog(isGuard ? `${skill.name}挡住了大半风刃，只受到 ${incoming} 点伤害。` : `${skill.name}稳住了阵脚，风刃造成 ${incoming} 点伤害。`);
        return;
      }
      const damage = Math.max(9, Math.round(skill.power / 5) + Math.floor((activeProgress?.level ?? 5) / 4));
      const nextEnemy = Math.max(0, examEnemy - damage);
      setExamLog(`${partner.name}锁定银羽雀，${skill.name}即将发动！`);
      await animateBattleFx({ skill: skill.name, kind: petBattleFxKind(skill.element), attacker: "ally", target: "enemy", value: `-${examEnemy - nextEnemy}` }, () => setExamEnemy(nextEnemy));
      if (nextEnemy === 0) {
        setExamWon(true);
        if (activePetId) grantPetExperience(activePetId, 90);
        setExamLog(`${partner.name}稳稳停在边线前。银羽雀失去战斗能力——考核通过！获得 90 点经验。`);
        playTone(820);
        return;
      }
      const incoming = examGuard ? 3 : 7;
      setExamLog("银羽雀从冲击中翻身，立刻使出回旋风刃！");
      await animateBattleFx({ skill: "回旋风刃", kind: "wind", attacker: "enemy", target: "ally", value: `-${incoming}` }, () => {
        setExamGuard(false);
        setExamHp((value) => Math.max(8, value - incoming));
      });
      setExamLog(`${skill.name}造成 ${damage} 点伤害；银羽雀反击造成 ${incoming} 点伤害。`);
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
          if (ready) {
            setBossWon(true);
            if (activePetId) grantPetExperience(activePetId, 170);
          }
        });
        setBossLog(ready ? `“白裂狮——塞其还在等你。” 它身上的灵纹重新亮起；${partner.name}获得 170 点经验。` : "白裂狮似乎听见了一瞬，但记忆很快又被铃声淹没。");
        if (ready) playTone(880);
        return;
      }

      let incoming = 9;
      if (action === "attack") {
        const damage = Math.max(9, Math.round((primaryBattleSkill?.power ?? 40) / 6));
        const nextHp = Math.max(18, bossHp - damage);
        incoming = 10;
        setBossLog(`${partner.name}迎着利爪冲了上去——${partner.attack}！`);
        await animateBattleFx({ skill: partner.attack, kind: petBattleFxKind(primaryBattleSkill?.element ?? activeSpecies?.element ?? "beast"), attacker: "ally", target: "enemy", value: `-${bossHp - nextHp}` }, () => setBossHp(nextHp));
        setBossLog(nextHp === 18 ? "白裂狮已经到达极限，但黑铃仍在强迫它战斗！" : "白裂狮被击退半步，随即在黑铃声中再次扑来！");
      }
      if (action === "soothe") {
        incoming = 5;
        setBossLog(`${partner.name}没有攻击，而是展开${partner.support}守在你身前。`);
        await animateBattleFx({ skill: partner.support, kind: secondaryBattleSkill?.power === null ? "guard" : petBattleFxKind(secondaryBattleSkill?.element ?? "beast"), attacker: "ally", target: "ally", value: "伤害降低", positive: true });
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
    if (["title", "name", "home", "shelter", "road", "capture"].includes(phase)) return "序章 · 临虹村";
    if (["city", "exam", "festival"].includes(phase)) return "序章 · 黄金庆典";
    if (["rupture", "boss", "aftermath"].includes(phase)) return "序章 · 灵契断裂";
    if (["highland", "windPass", "pasture", "observatory", "trainerBattle"].includes(phase)) return "第一章 · 黑铃回声";
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
            {partner && <div className="adventure-wallet" aria-label="训练师背包资源"><span>金<b>{inventory.coins}</b></span><span>球<b>{inventory.capsules}</b></span><span>果<b>{inventory.berries}</b></span><span>晶<b>{inventory.crystals}</b></span></div>}
            {partner && <div className="partner-chip"><PetSprite id={partner.id} size="sm" /><span><small>{partner.kind}</small><b>{partner.name}</b></span></div>}
            {partner && <button type="button" className="icon-button collection-button" onClick={() => { setHelpOpen(false); setQuestLogOpen(false); setCollectionView("bag"); }} aria-label="打开宠物背包"><b>包</b><small>{ownedPetIds.length}/6</small></button>}
            {partner && <button type="button" className="icon-button collection-button" onClick={() => { setHelpOpen(false); setQuestLogOpen(false); setCollectionView("dex"); }} aria-label="打开宠物图鉴"><b>鉴</b><small>{seenPetIds.length}/{PET_SPECIES_ORDER.length}</small></button>}
            {partner && prologueComplete && <button type="button" className="icon-button collection-button quest-button" onClick={() => { setHelpOpen(false); setCollectionView(null); setQuestLogOpen(true); }} aria-label="打开任务日志"><b>任</b><small>{Object.values(highlandSideQuests).filter((stage, index) => stage >= [2, 5, 2][index]).length}/3</small></button>}
            <button type="button" className="icon-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭音效" : "开启音效"}>{soundOn ? "♪" : "×"}</button>
            <button type="button" className="icon-button" onClick={() => { setCollectionView(null); setQuestLogOpen(false); setHelpOpen(true); }} aria-label="打开帮助">?</button>
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
            <button type="button" className="primary-action dark" disabled={!draftName.trim()} onClick={() => { setPlayerName(draftName.trim()); setHomeStory("wake"); setHomePos(HOME_START); homePositionLiveRef.current = HOME_START; setHomeDiscoveries([]); go("home"); }}><span>收好推荐信</span><b>›</b></button>
            <div className="seal-stamp">临虹<br />照护所</div>
          </div>
        </section>
      )}

      {phase === "home" && (
        <HomeScene
          mapCamera={homeCamera}
          fieldViewportRef={fieldViewportRef}
          playerName={playerName}
          startPosition={homePos}
          bumped={homeBumped}
          discoveries={homeDiscoveries}
          toast={homeToast}
          disabled={homeStory !== null || collectionView !== null || helpOpen}
          onPosition={handleHomePosition}
          onCommit={setHomePos}
          onInteract={interactHome}
          onBump={bumpHome}
        />
      )}

      {phase === "home" && homeStory && (
        <Dialogue lines={homeStoryLines(homeStory, playerName)} onComplete={completeHomeStory} />
      )}

      {phase === "shelter" && (
        <section className="shelter-screen">
          <div className="shelter-scene">
            <div className="window-light"><i /><i /></div>
            <div className="shelf shelf-one" /><div className="shelf shelf-two" />
            <div className="keeper"><Character name="黎叔" variant="keeper" /><span>黎叔</span></div>
            <div className="shelter-copy">
              <div className="scene-index">01 · 临虹村宠物照护所</div>
              <h2>不是领取宠物<br />而是互相选择</h2>
              <p>黎叔没有拿出封印球。三只宠物记得你靠近时的每一步，也会用自己的方式作出回应。</p>
            </div>
            <div className="partner-selection">
              {Object.values(PARTNERS).map((candidate) => (
                <button type="button" key={candidate.id} className={`partner-card${partnerId === candidate.id ? " selected" : ""}`} onClick={() => selectPartner(candidate.id)}>
                  <div className="partner-art"><PetSprite id={candidate.id} size="lg" /><span>{candidate.kind}</span></div>
                  <div className="partner-copy"><small>{candidate.nature}</small><b>{candidate.name}</b><p>{candidate.quote}</p></div>
                  <i className="select-mark">{partnerId === candidate.id ? "已靠近" : "靠近它"}</i>
                </button>
              ))}
            </div>
            <div className="shelter-footer">
              <p>{partner ? `“${partner.name}看了看黎叔，又主动站到了${playerName}身边。”` : "先了解它们的性格，再看看谁愿意向你走来。"}</p>
              <button type="button" className="primary-action" disabled={!partnerId} onClick={() => go("road")}><span>一起出发</span><b>›</b></button>
            </div>
          </div>
        </section>
      )}

      {phase === "shelter" && shelterIntroOpen && (
        <Dialogue lines={shelterIntroLines(playerName)} onComplete={() => setShelterIntroOpen(false)} />
      )}

      {activeMap && partner && (
        <ExplorationScene
          key={activeMap.id}
          map={activeMap}
          mapCamera={mapCamera}
          fieldViewportRef={fieldViewportRef}
          partner={partner}
          startPosition={roadPos}
          initialFacing={roadFacing}
          roadBumped={roadBumped}
          roadInGrass={roadInGrass}
          toast={toast}
          encounterPending={encounterPending}
          missionTitle={phase === "road" && captured ? "支线 · 青崖生态调查" : activeMap.missionTitle}
          missionText={phase === "road" && captured ? "继续调查高草生态，或沿石阶前往东北方的彩虹城门。" : activeMap.missionText}
          missionItems={phase === "road" ? captured ? [
            { label: `发现不同宠物 ${Math.min(fieldResearch.encounteredSpecies.length, FIELD_RESEARCH_REQUIREMENTS.species)}/${FIELD_RESEARCH_REQUIREMENTS.species}`, done: fieldResearch.encounteredSpecies.length >= FIELD_RESEARCH_REQUIREMENTS.species },
            { label: `完成战斗 ${Math.min(fieldResearch.resolvedBattles, FIELD_RESEARCH_REQUIREMENTS.battles)}/${FIELD_RESEARCH_REQUIREMENTS.battles}`, done: fieldResearch.resolvedBattles >= FIELD_RESEARCH_REQUIREMENTS.battles },
            { label: fieldResearch.claimed ? "调查报酬已领取" : `捕捉宠物 ${Math.min(fieldResearch.capturedPets, FIELD_RESEARCH_REQUIREMENTS.captures)}/${FIELD_RESEARCH_REQUIREMENTS.captures}`, done: fieldResearch.capturedPets >= FIELD_RESEARCH_REQUIREMENTS.captures },
          ] : [
            { label: "在高草中遭遇宠物", done: false },
            { label: "完成第一次捕捉", done: false },
            { label: "返回营地或前往城门", done: false },
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
          ] : phase === "aftermath" ? [
            { label: "绕开破碎万灵晶核", done: roadPos.y < 58 },
            { label: "抵达上方记忆祭台" },
          ] : phase === "highland" ? [
            { label: "在断风营地整备", done: chapterQuest !== "camp" },
            { label: "穿过两座悬空石桥", done: roadPos.y < 46 },
            { label: highlandAltarFound ? "黑铃坐标已记录" : "调查黑铃祭台", done: highlandAltarFound },
          ] : phase === "windPass" ? [
            { label: "抵达中央巡风哨", done: highlandTrainerDefeated },
            { label: "完成三宠接力试炼", done: highlandTrainerDefeated },
            { label: "从东北山门进入牧场", done: false },
          ] : phase === "pasture" ? [
            ...PASTURE_SHRINE_POSITIONS.map((_, index) => ({ label: `唤醒云铃 ${index + 1}`, done: pastureShrines.includes(index) })),
            { label: "前往山顶观测站", done: false },
          ] : phase === "observatory" ? [
            ...OBSERVATORY_NODE_POSITIONS.map((_, index) => ({ label: `连接紫晶节点 ${index + 1}`, done: observatoryNodes.includes(index) })),
            { label: chapterOneComplete ? "取得安琪儿的观测记录" : "挑战无籍观测员朔", done: chapterOneComplete },
          ] : [
            { label: "继续探索", done: false },
          ]}
          mapReady={mapAssetReady}
          movementDisabled={encounterPending || cityDialogueOpen || festivalDialogueOpen || aftermathDialogueOpen || chapterDialogue !== null || sideQuestDialogue !== null || collectionView !== null || fieldCampOpen || highlandCampOpen || questLogOpen || helpOpen}
          onMapReady={setLoadedMapId}
          markers={<>
            {phase === "road" && <>
              <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${ROAD_START.x}%`, top: `${ROAD_START.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>{isFieldResearchComplete(fieldResearch) && !fieldResearch.claimed ? "调查营地 · 可提交" : "青崖调查营地"}</span><i>补给 / 委托</i></button>
              <button type="button" className={`map-landmark gate-landmark${captured ? " landmark-ready" : ""}`} style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>{captured ? "彩虹城 · 可进入" : "彩虹城"}</span><i>按 E</i></button>
            </>}
            {phase === "city" && <button type="button" className="map-landmark npc-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}>{!prologueComplete && <Character name="诺亚" variant="noah" small />}<span>{prologueComplete ? "学院北门 · 高原索道" : "诺亚 · 学院门前"}</span><i>{prologueComplete ? "前往东之高原" : "按 E"}</i></button>}
            {phase === "city" && <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${EXPLORATION_MAPS.city.start.x}%`, top: `${EXPLORATION_MAPS.city.start.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>南门 · 青崖水道</span><i>返回野外</i></button>}
            {phase === "festival" && <>
              {FESTIVAL_HEROES.map((hero, index) => {
                const positions = [{ x: 39, y: 45 }, { x: 45, y: 38 }, { x: 55, y: 38 }, { x: 61, y: 45 }, { x: 50, y: 31 }];
                return <div key={hero.name} className="map-character-marker" style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }}><Character name={hero.name} variant={hero.variant} small /><span>{hero.name}</span></div>;
              })}
              <button type="button" className="map-landmark ceremony-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>万灵共鸣环</span><i>按 E</i></button>
            </>}
            {phase === "rupture" && <>
              {RUPTURE_NODE_POSITIONS.map((position, index) => <button type="button" key={index} className={`spirit-map-node${ruptureNodes.includes(index) ? " restored" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)} aria-label={`灵契节点${index + 1}`}><i>{ruptureNodes.includes(index) ? "✓" : "!"}</i><span>{ruptureNodes.includes(index) ? "已稳定" : `节点 ${index + 1}`}</span></button>)}
              {ruptureNodes.length === 3 && <button type="button" className="map-landmark rift-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>裂隙中央</span><i>按 E</i></button>}
            </>}
            {phase === "aftermath" && <>
              <div className="map-character-marker temple-sergi" style={{ left: "46%", top: "18%" }}><Character name="塞其" variant="sergi" small /><span>塞其</span></div>
              <div className="map-character-marker temple-angela" style={{ left: "54%", top: "18%" }}><Character name="安琪儿" variant="angela" small /><span>安琪儿</span></div>
              <button type="button" className="map-landmark memory-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>记忆祭台</span><i>按 E</i></button>
            </>}
            {phase === "highland" && <>
              <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${activeMap.start.x}%`, top: `${activeMap.start.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>断风调查营地</span><i>治疗 / 委托</i></button>
              <button type="button" className="map-landmark rift-landmark landmark-ready" style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>{highlandAltarFound ? "黑铃坐标 · 风蚀栈道" : "黑铃祭台"}</span><i>按 E</i></button>
            </>}
            {phase === "windPass" && <>
              <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${activeMap.start.x}%`, top: `${activeMap.start.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>返回断风遗迹</span><i>按 E</i></button>
              <button type="button" className={`map-landmark npc-landmark${!highlandTrainerDefeated || highlandSideQuests.wind_courier === 1 ? " landmark-ready" : ""}`} style={{ left: `${WIND_PASS_RANGER_POSITION.x}%`, top: `${WIND_PASS_RANGER_POSITION.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>巡风员 · 岚绪</span><i>{!highlandTrainerDefeated ? "三宠试炼" : highlandSideQuests.wind_courier === 1 ? "口信待送" : "试炼完成"}</i></button>
              <button type="button" className={`map-landmark gate-landmark${highlandTrainerDefeated ? " landmark-ready" : ""}`} style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>云铃牧场山门</span><i>{highlandTrainerDefeated ? "可进入" : "需要许可"}</i></button>
            </>}
            {phase === "pasture" && <>
              <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${activeMap.start.x}%`, top: `${activeMap.start.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>返回风蚀栈道</span><i>按 E</i></button>
              <button type="button" className="map-landmark npc-landmark landmark-ready" style={{ left: `${PASTURE_KEEPER_POSITION.x}%`, top: `${PASTURE_KEEPER_POSITION.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>牧铃人 · 芙禾</span><i>{highlandSideQuests.wind_courier === 2 ? "口信待送" : highlandSideQuests.lost_bellsheep === 0 ? "有委托" : highlandSideQuests.lost_bellsheep === 1 ? "寻找风铃羊" : "牧场守铃"}</i></button>
              {PASTURE_SHRINE_POSITIONS.map((position, index) => <button type="button" key={index} className={`spirit-map-node${pastureShrines.includes(index) ? " restored" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><i>{pastureShrines.includes(index) ? "✓" : "铃"}</i><span>{pastureShrines.includes(index) ? "已回应" : `云铃 ${index + 1}`}</span></button>)}
              <button type="button" className={`map-landmark gate-landmark${pastureShrines.length === 3 ? " landmark-ready" : ""}`} style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>冻星观测站</span><i>{pastureShrines.length === 3 ? "回路已恢复" : `${pastureShrines.length}/3 云铃`}</i></button>
            </>}
            {phase === "observatory" && <>
              <button type="button" className="map-landmark camp-landmark landmark-ready" style={{ left: `${activeMap.start.x}%`, top: `${activeMap.start.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>返回云铃牧场</span><i>按 E</i></button>
              {OBSERVATORY_NODE_POSITIONS.map((position, index) => <button type="button" key={index} className={`spirit-map-node${observatoryNodes.includes(index) ? " restored" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><i>{observatoryNodes.includes(index) ? "✓" : "◆"}</i><span>{observatoryNodes.includes(index) ? "已连接" : `紫晶 ${index + 1}`}</span></button>)}
              <button type="button" className={`map-landmark rift-landmark${observatoryNodes.length === 3 ? " landmark-ready" : ""}`} style={{ left: `${activeMap.interaction.x}%`, top: `${activeMap.interaction.y}%` }} onClick={() => exploreInteraction(roadPositionLiveRef.current)}><span>{chapterOneComplete ? "观测员朔 · 圆形观测台" : "圆形观测台"}</span><i>{chapterOneComplete ? highlandSideQuests.wind_courier === 3 ? "口信待送" : "观测记录已取得" : `${observatoryNodes.length}/3 回路`}</i></button>
            </>}
          </>}
          onPosition={handleRoadPosition}
          onCommit={setRoadPos}
          onBump={bumpRoad}
          onInteract={exploreInteraction}
        />
      )}

      {phase === "capture" && partner && (
        <section className={`battle-screen capture-battle${battleBusy ? " battle-busy" : ""}${battleFx?.stage === "impact" ? " battle-impact" : ""}`}>
          <div className="battle-backdrop field-battle-bg" style={{ backgroundImage: `linear-gradient(rgba(8, 23, 29, 0.1), rgba(8, 23, 29, 0.3)), url(${SCENE_ART[battleReturnPhase]})` }}><i /><i /><i /></div>
          <BattleEffects fx={battleFx} />
          <div className="battle-heading"><small>WILD ENCOUNTER</small><h2>{battleReturnPhase === "road" ? "青崖野外战" : "东之高原野外战"}</h2><p>观察属性与戒备，灵活换宠，选择击败、捕捉或撤离。</p></div>
          <div className="enemy-side">
            <div className="combatant-info"><span><b>{routeEncounter.name}</b><small>{routeEncounter.kind} · Lv.{routeEncounter.level}</small></span><em>{wildHp} / {routeEncounter.maxHp}</em><Meter value={wildHp} max={routeEncounter.maxHp} /></div>
            <div className={battleActorClass("enemy", battleFx)}><PetSprite id={routeEncounter.id} size="xl" /></div>
            <div className="calm-indicator"><span>安抚 {wildCalm}/3 · 捕捉率 {Math.round(captureChance({ hp: wildHp, maxHp: routeEncounter.maxHp, calm: wildCalm, alreadyOwned: ownedPetIds.includes(routeEncounter.id) || storedPetIds.includes(routeEncounter.id) }) * 100)}%</span><Meter value={wildCalm} max={3} kind="calm" /></div>
          </div>
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.{activeProgress?.level ?? 5}</small></span><em>{wildPlayerHp} / {partner.hp}</em><Meter value={wildPlayerHp} max={partner.hp} /></div></div>
          {battlePartyOpen && <div className="battle-party-panel">
            <header><span><small>PARTY</small><b>{wildPlayerHp <= 0 ? "选择接替伙伴" : "同行队伍"}</b></span><button type="button" disabled={wildPlayerHp <= 0 || battleBusy} onClick={() => setBattlePartyOpen(false)}>×</button></header>
            <div>{ownedPetIds.map((id, index) => {
              const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
              const stats = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved);
              const hp = id === activePetId ? wildPlayerHp : wildPartyHp[id] ?? stats.hp;
              return <button type="button" key={id} className={`${id === activePetId ? "active " : ""}${hp <= 0 ? "fainted" : ""}`} disabled={battleBusy || id === activePetId || hp <= 0} onClick={() => switchWildPet(id)}>
                <i>{index + 1}</i><PetSprite id={id} size="sm" /><span><b>{petDisplayName(id, progress)}</b><small>Lv.{progress.level} · {hp <= 0 ? "无法战斗" : `${hp}/${stats.hp}`}</small><Meter value={hp} max={stats.hp} /></span>
              </button>;
            })}</div>
          </div>}
          <div className="battle-command">
            <div className="battle-log"><span>行动记录 · 金币 {inventory.coins} · 晶片 {inventory.crystals}</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "回合演出" : wildBattleResult === "active" ? "等待指令" : "战斗结束"}</i><p>{captureLog}</p></div>
            {wildBattleResult === "active" ? <div className="command-grid wild-command-grid">
              {equippedSkillDefinitions.map((skill, slot) => <button type="button" key={skill.name} disabled={battleBusy || wildPlayerHp <= 0} onClick={() => captureAction(slot)}><span>技能 {String(slot + 1).padStart(2, "0")}</span><b>{skill.name}</b><small>{skill.power === null ? "变化技能" : `${skill.element === PET_SPECIES[routeEncounter.id].element ? "同系" : "属性"} · 威力 ${skill.power}`}</small></button>)}
              <button type="button" disabled={battleBusy || wildPlayerHp <= 0 || inventory.berries <= 0} onClick={() => captureAction("calm")}><span>道具 · {inventory.berries}</span><b>香甜莓果</b><small>安抚并减轻反击</small></button>
              <button type="button" disabled={battleBusy || wildPlayerHp <= 0 || inventory.capsules <= 0} className="ball-command" onClick={() => captureAction("ball")}><span>胶囊 · {inventory.capsules}</span><b>尝试捕捉</b><small>当前 {Math.round(captureChance({ hp: wildHp, maxHp: routeEncounter.maxHp, calm: wildCalm, alreadyOwned: ownedPetIds.includes(routeEncounter.id) || storedPetIds.includes(routeEncounter.id) }) * 100)}%</small></button>
              <button type="button" disabled={battleBusy} className="party-command" onClick={() => setBattlePartyOpen(true)}><span>队伍 · {ownedPetIds.length}</span><b>更换伙伴</b><small>{ownedPetIds.filter((id) => (id === activePetId ? wildPlayerHp : wildPartyHp[id] ?? 0) > 0).length} 只可战斗</small></button>
              <button type="button" disabled={battleBusy || wildPlayerHp <= 0} onClick={() => captureAction("escape")}><span>行动</span><b>撤离战斗</b><small>速度越高越容易成功</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => {
              const defeated = wildBattleResult === "defeat";
              const researchReady = isFieldResearchComplete(fieldResearch) && !fieldResearch.claimed;
              if (defeated) {
                const recovered = Object.fromEntries(ownedPetIds.map((id) => {
                  const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
                  const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
                  return [id, Math.max(1, Math.round(maximum * 0.35))];
                })) as Partial<Record<PetSpeciesId, number>>;
                setPartyHealth((current) => ({ ...current, ...recovered }));
                if (battleReturnPhase !== "road") {
                  enterExploration("highland");
                  setHighlandCampOpen(true);
                  return;
                }
                const safeStart = EXPLORATION_MAPS[battleReturnPhase].start;
                setRoadPos(safeStart);
                roadPositionLiveRef.current = safeStart;
              }
              setToast(defeated ? "巡逻员把你送回了青崖调查营地。" : battleReturnPhase !== "road" ? "高原的风再次响起。可继续调查当前区域。" : researchReady ? "生态调查已经完成，返回下方营地提交记录。" : captured ? "可以继续调查高草，也可以前往东北方的彩虹城门。" : "返回高草后仍可继续尝试捕捉。 ");
              setRoadInGrass(false);
              roadInGrassRef.current = false;
              grassStepsRef.current = 0;
              grassTravelDistanceRef.current = 0;
              go(battleReturnPhase);
            }}><span>{wildBattleResult === "captured" ? "带新伙伴返回地图" : wildBattleResult === "victory" ? "领取战利品并返回" : wildBattleResult === "defeat" ? "返回调查营地" : "退出高草"}</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "trainerBattle" && partner && activePetId && activeStats && (
        <section className={`battle-screen trainer-battle${battleBusy ? " battle-busy" : ""}${battleFx?.stage === "impact" ? " battle-impact" : ""}`}>
          <div className="battle-backdrop field-battle-bg trainer-battle-bg" style={{ backgroundImage: `linear-gradient(rgba(8, 18, 29, 0.18), rgba(8, 18, 29, 0.5)), url(${SCENE_ART[trainerDefinition.background]})` }}><i /><i /><i /></div>
          <BattleEffects fx={battleFx} />
          <div className="battle-heading light"><small>TRAINER TEAM BATTLE · 3 VS 3</small><h2>{trainerDefinition.title}</h2><p>{trainerDefinition.description}</p></div>
          <div className="trainer-team-ribbon enemy-team-ribbon">{trainerDefinition.team.map((entry, index) => <div key={`${entry.id}-${index}`} className={`${index === trainerEnemyIndex ? "active " : ""}${index < trainerEnemyIndex ? "fainted" : ""}`}><PetSprite id={entry.id} size="sm" /><span>{index < trainerEnemyIndex ? "失去战斗能力" : `Lv.${entry.level}`}</span></div>)}</div>
          <div className="enemy-side">
            <div className="combatant-info danger"><span><b>{trainerEnemySpecies.name}</b><small>{trainerEnemySpecies.elementLabel} · Lv.{trainerEnemyPet.level}{trainerEnemyStatus ? ` · ${BATTLE_STATUS_LABELS[trainerEnemyStatus]}` : ""}</small></span><em>{trainerEnemyHp} / {trainerEnemyStats.hp}</em><Meter value={trainerEnemyHp} max={trainerEnemyStats.hp} /></div>
            <div className={battleActorClass("enemy", battleFx)}><PetSprite id={trainerEnemyPet.id} size="xl" glitched={trainerBattleId === "warden" && trainerEnemyPet.id === "guardian"} /></div>
            <div className="trainer-nameplate"><small>{trainerDefinition.trainerRole}</small><b>{trainerDefinition.trainerName}</b><span>{trainerEnemyIndex + 1} / {trainerDefinition.team.length}</span></div>
          </div>
          <div className="ally-side">
            <div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div>
            <div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.{activeProgress?.level ?? 5}{trainerPlayerStatus ? ` · ${BATTLE_STATUS_LABELS[trainerPlayerStatus]}` : ""}</small></span><em>{trainerPartyHp[activePetId] ?? 0} / {activeStats.hp}</em><Meter value={trainerPartyHp[activePetId] ?? 0} max={activeStats.hp} /></div>
          </div>
          {trainerPartyOpen && <div className="battle-party-panel trainer-party-panel">
            <header><span><small>3-PET PARTY</small><b>{(trainerPartyHp[activePetId] ?? 0) <= 0 ? "选择接替伙伴" : "战术换宠"}</b></span><button type="button" disabled={(trainerPartyHp[activePetId] ?? 0) <= 0 || battleBusy} onClick={() => setTrainerPartyOpen(false)}>×</button></header>
            <div>{ownedPetIds.slice(0, 3).map((id, index) => {
              const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
              const stats = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved);
              const hp = trainerPartyHp[id] ?? partyHealth[id] ?? stats.hp;
              return <button type="button" key={id} className={`${id === activePetId ? "active " : ""}${hp <= 0 ? "fainted" : ""}`} disabled={battleBusy || id === activePetId || hp <= 0} onClick={() => switchTrainerPet(id)}><i>{index + 1}</i><PetSprite id={id} size="sm" /><span><b>{petDisplayName(id, progress)}</b><small>Lv.{progress.level} · {hp <= 0 ? "无法战斗" : `${hp}/${stats.hp}`}</small><Meter value={hp} max={stats.hp} /></span></button>;
            })}</div>
          </div>}
          <div className="battle-command trainer-command">
            <div className="battle-log"><span>{trainerDefinition.trainerName}的队伍 · 我方前 3 只参战</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "回合演出" : trainerBattleResult === "active" ? "等待指令" : trainerBattleResult === "victory" ? "试炼通过" : "队伍败北"}</i><p>{trainerLog}</p></div>
            {trainerBattleResult === "active" ? <div className="command-grid trainer-command-grid">
              {equippedSkillDefinitions.map((skill, slot) => <button type="button" key={skill.name} disabled={battleBusy || (trainerPartyHp[activePetId] ?? 0) <= 0} onClick={() => trainerAction(slot)}><span>技能 {String(slot + 1).padStart(2, "0")}</span><b>{skill.name}</b><small>{skill.power === null ? "支援 / 防御" : `${skill.element} · 威力 ${skill.power}`}</small></button>)}
              <button type="button" className="party-command" disabled={battleBusy} onClick={() => setTrainerPartyOpen(true)}><span>队伍 · 3</span><b>战术换宠</b><small>{ownedPetIds.slice(0, 3).filter((id) => (trainerPartyHp[id] ?? partyHealth[id] ?? 0) > 0).length} 只可战斗</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => {
              if (trainerBattleResult === "defeat") {
                const recovered = Object.fromEntries(ownedPetIds.map((id) => {
                  const progress = petProgress.find((entry) => entry.id === id) ?? createPetProgress(id);
                  const maximum = scaledPetStats(PET_SPECIES[id], progress.level, progress.evolved).hp;
                  return [id, Math.max(1, Math.round(maximum * 0.35))];
                })) as Partial<Record<PetSpeciesId, number>>;
                setPartyHealth((current) => ({ ...current, ...recovered }));
                enterExploration("highland");
                setHighlandCampOpen(true);
              } else {
                go(trainerDefinition.background);
                if (trainerBattleId === "warden" && !chapterDialoguesSeen.includes("chapter_epilogue")) {
                  setChapterDialoguesSeen((current) => [...current, "chapter_epilogue"]);
                  setChapterDialogue("chapter_epilogue");
                }
              }
            }}><span>{trainerBattleResult === "victory" ? (trainerBattleId === "warden" ? "带着观测记录返回圆台" : "穿过山门继续调查") : "返回断风营地休整"}</span><b>›</b></button>}
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
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.{activeProgress?.level ?? 5}</small></span><em>{examHp} / {partner.hp}</em><Meter value={examHp} max={partner.hp} /></div><div className="trainer-label"><Character name={playerName} variant="player" small /><span>{playerName}</span></div></div>
          <div className="battle-command">
            <div className="battle-log"><span>裁判记录</span><i className={battleBusy ? "turn-status running" : "turn-status"}>{battleBusy ? "回合演出" : "等待指令"}</i><p>{examLog}</p></div>
            {!examWon ? <div className="command-grid two">
              {equippedSkillDefinitions.map((skill, slot) => <button type="button" key={skill.name} disabled={battleBusy} onClick={() => examAction(slot)}><span>技能 {String(slot + 1).padStart(2, "0")}</span><b>{skill.name}</b><small>{skill.power === null ? "变化技能" : `威力 ${skill.power}`}</small></button>)}
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
          <div className="ally-side"><div className={battleActorClass("ally", battleFx)}><PetSprite id={partner.id} size="xl" /></div><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.{activeProgress?.level ?? 5}</small></span><em>{bossPlayerHp} / {partner.hp}</em><Meter value={bossPlayerHp} max={partner.hp} /></div></div>
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
        <Dialogue lines={AFTERMATH_LINES} onComplete={() => { setPrologueComplete(true); go("ending"); }} backdrop={<div className="temple-bg"><div className="temple-columns"><i /><i /><i /><i /></div><div className="crystal-core"><i /><span>万灵晶核</span></div><div className="temple-characters"><div><Character name="塞其" variant="sergi" /><span>塞其</span></div><div><Character name="安琪儿" variant="angela" /><span>安琪儿</span></div></div></div>} />
      )}

      {phase === "ending" && partner && (
        <section className="ending-screen">
          <div className="ending-landscape"><div className="dawn-orb" /><div className="ending-city"><i /><i /><i /></div><div className="ending-party"><Character name={playerName} /><PetSprite id={partner.id} size="lg" />{captured && routeEncounter.id !== partner.id && <PetSprite id={routeEncounter.id} size="md" />}</div></div>
          <div className="ending-card">
            <div className="ending-kicker">PROLOGUE COMPLETE</div>
            <h2>没有登记的伙伴</h2>
            <p>彩虹城在身后封锁。东之高原的风里，传来了黑色铃铛的声音。</p>
            <div className="ending-record">
              <div><small>训练师</small><b>{playerName}</b></div>
              <div><small>首发伙伴</small><b>{partner.name} · Lv.{activeProgress?.level ?? 5}</b></div>
              <div><small>图鉴记录</small><b>{seenPetIds.length} / {PET_SPECIES_ORDER.length}</b></div>
              <div><small>下一目标</small><b>东之高原</b></div>
            </div>
            <div className="next-chapter"><span>第一章</span><div><b>不愿回家的宠物</b><small>TO BE CONTINUED</small></div></div>
            <div className="ending-actions"><button type="button" className="primary-action dark" onClick={enterHighland}><span>进入第一章 · 东之高原</span><b>›</b></button><button type="button" className="text-action" onClick={() => setPhase("title")}>保存并返回标题</button></div>
          </div>
        </section>
      )}

      {collectionView && partner && (
        <PetCollectionModal
          initialView={collectionView}
          ownedPetIds={ownedPetIds}
          storedPetIds={storedPetIds}
          seenPetIds={seenPetIds}
          starterId={partnerId}
          activePetId={activePetId}
          petProgress={petProgress}
          inventory={inventory}
          managementLocked={battleBusy || ["capture", "trainerBattle", "exam", "boss"].includes(phase)}
          onSetActivePet={setLeadPet}
          onEquipSkill={equipPetSkill}
          onMoveToStorage={movePetToStorage}
          onMoveToParty={movePetToParty}
          onEvolve={evolvePet}
          onClose={() => setCollectionView(null)}
        />
      )}

      {fieldCampOpen && (
        <FieldCampModal
          inventory={inventory}
          research={fieldResearch}
          onBuy={purchaseSupply}
          onClaim={claimResearchReward}
          onClose={() => setFieldCampOpen(false)}
        />
      )}

      {highlandCampOpen && partner && (
        <HighlandCampModal
          inventory={inventory}
          partyIds={ownedPetIds}
          petProgress={petProgress}
          partyHealth={partyHealth}
          quest={chapterQuest}
          sideQuests={highlandSideQuests}
          ownsFrostPet={mergePetIds(ownedPetIds, storedPetIds).includes("frost")}
          onRest={healPartyAtCamp}
          onBuy={purchaseSupply}
          onSideQuest={openCampSideQuest}
          onReturnCity={() => { setHighlandCampOpen(false); go("city"); }}
          onClose={() => setHighlandCampOpen(false)}
        />
      )}

      {questLogOpen && (
        <QuestLogModal
          chapterDialoguesSeen={chapterDialoguesSeen}
          highlandAltarFound={highlandAltarFound}
          highlandTrainerDefeated={highlandTrainerDefeated}
          pastureShrines={pastureShrines}
          observatoryNodes={observatoryNodes}
          chapterOneComplete={chapterOneComplete}
          sideQuests={highlandSideQuests}
          ownsFrostPet={mergePetIds(ownedPetIds, storedPetIds).includes("frost")}
          ownsBellsheep={mergePetIds(ownedPetIds, storedPetIds).includes("breeze")}
          onClose={() => setQuestLogOpen(false)}
        />
      )}

      {chapterDialogue && (
        <Dialogue lines={chapterDialogueLines(chapterDialogue, playerName)} onComplete={completeChapterDialogue} backdrop={<div className="chapter-dialogue-bg"><i /><i /><i /><div><span>BLACK BELL RECORD</span><b>东之高原调查档案</b></div></div>} />
      )}

      {sideQuestDialogue && (
        <Dialogue lines={sideQuestDialogueLines(sideQuestDialogue, playerName)} onComplete={completeSideQuestDialogue} backdrop={<div className="sidequest-dialogue-bg"><i /><i /><div><span>SIDE STORY</span><b>那些没有写进报告的人</b></div></div>} />
      )}

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭">×</button>
            <small>TRAINER HANDBOOK</small><h2>旅行手册</h2>
            <div className="help-grid"><div><kbd>WASD</kbd><b>流畅移动</b><p>支持方向键与斜向行走；贴近障碍会自然沿边滑动。</p></div><div><kbd>E</kbd><b>互动</b><p>靠近城门、营地、发光物体或人物。</p></div><div><kbd>队伍</kbd><b>六宠接力</b><p>野外战可随时换宠；一只倒下后由其他同行伙伴接替。</p></div><div><kbd>任务</kbd><b>主线与支线</b><p>推进高原剧情后，可在顶部“任”按钮追踪全部目标。</p></div><div><kbd>仓库</kbd><b>调度伙伴</b><p>队伍满员后新宠自动寄存，可在宠物背包中随时调整。</p></div><div><kbd>进化</kbd><b>灵契晶片</b><p>达到指定等级后消耗晶片进化，全面提高五项能力。</p></div></div>
            <p className="help-note">宠物拥有四个技能槽。等级、攻防、属性克制、全队体力、安抚程度与剩余物资都会影响野外战结果。</p>
          </section>
        </div>
      )}
    </main>
  );
}
