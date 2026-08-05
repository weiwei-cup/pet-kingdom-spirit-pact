export type HighlandSideQuestId = "frost_medicine" | "wind_courier" | "lost_bellsheep";

export type HighlandSideQuestProgress = Record<HighlandSideQuestId, number>;

export const INITIAL_HIGHLAND_SIDE_QUESTS: HighlandSideQuestProgress = {
  frost_medicine: 0,
  wind_courier: 0,
  lost_bellsheep: 0,
};

export const HIGHLAND_SIDE_QUESTS = {
  frost_medicine: {
    title: "缺角鹿的退烧草",
    giver: "营地医师 · 禾婶",
    region: "断风调查营地",
    reward: "180 金币 · 莓果 3 · 灵契晶片 1",
  },
  wind_courier: {
    title: "送不到的三封口信",
    giver: "记录员 · 洛弥",
    region: "东之高原全域",
    reward: "260 金币 · 召唤胶囊 3 · 灵契晶片 2",
  },
  lost_bellsheep: {
    title: "不肯回家的风铃羊",
    giver: "牧铃人 · 芙禾",
    region: "云铃牧场",
    reward: "220 金币 · 莓果 2 · 灵契晶片 2",
  },
} as const;

export function normalizeHighlandSideQuests(value: unknown): HighlandSideQuestProgress {
  const source = value && typeof value === "object" ? value as Partial<Record<HighlandSideQuestId, unknown>> : {};
  return {
    frost_medicine: clampStage(source.frost_medicine, 2),
    wind_courier: clampStage(source.wind_courier, 5),
    lost_bellsheep: clampStage(source.lost_bellsheep, 2),
  };
}

function clampStage(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

export function sideQuestObjective(input: {
  id: HighlandSideQuestId;
  stage: number;
  ownsFrostPet?: boolean;
  ownsBellsheep?: boolean;
}) {
  const { id, stage } = input;
  if (id === "frost_medicine") {
    if (stage >= 2) return "已完成：禾婶已经配好高原退烧药。";
    if (stage === 0) return "前往断风营地，与医师禾婶交谈。";
    return input.ownsFrostPet ? "带晶角幼鹿返回断风营地。" : "在高原草丛寻找并捕捉晶角幼鹿。";
  }
  if (id === "wind_courier") {
    if (stage >= 5) return "已完成：三封口信已经收入营地档案。";
    if (stage === 0) return "前往断风营地，接受洛弥的口信委托。";
    if (stage === 1) return "通过栈道试炼后，把第一封口信带给岚绪。";
    if (stage === 2) return "前往云铃牧场，把第二封口信带给芙禾。";
    if (stage === 3) return "取得观测记录后，把第三封口信带给朔。";
    return "返回断风营地，向洛弥复述三人的回信。";
  }
  if (stage >= 2) return "已完成：芙禾终于明白风铃羊为何不愿回家。";
  if (stage === 0) return "在云铃牧场寻找牧铃人芙禾。";
  return input.ownsBellsheep ? "带风铃羊去见芙禾。" : "在牧场草甸寻找并捕捉风铃羊。";
}

