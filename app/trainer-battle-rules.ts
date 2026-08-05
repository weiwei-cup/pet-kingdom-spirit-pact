export type BattleStatus = "burn" | "poison" | "freeze" | "slow";

export const BATTLE_STATUS_LABELS: Record<BattleStatus, string> = {
  burn: "灼烧",
  poison: "中毒",
  freeze: "冰封",
  slow: "迟缓",
};

export function statusForElement(element: string): BattleStatus | null {
  if (element === "fire") return "burn";
  if (element === "plant" || element === "beast") return "poison";
  if (element === "ice" || element === "water") return "freeze";
  if (element === "wind" || element === "lightning") return "slow";
  return null;
}

export function applyStatusTick(input: {
  hp: number;
  maxHp: number;
  status: BattleStatus | null;
}) {
  if (!input.status) return { hp: input.hp, damage: 0, skipTurn: false, cleared: false };
  if (input.status === "freeze") {
    return { hp: input.hp, damage: 0, skipTurn: true, cleared: true };
  }
  if (input.status === "slow") {
    return { hp: input.hp, damage: 0, skipTurn: false, cleared: false };
  }
  const ratio = input.status === "poison" ? 0.09 : 0.07;
  const damage = Math.max(2, Math.ceil(input.maxHp * ratio));
  return { hp: Math.max(0, input.hp - damage), damage, skipTurn: false, cleared: false };
}

export function shouldInflictStatus(input: {
  element: string;
  power: number | null;
  roll?: number;
}) {
  if (input.power === null || !statusForElement(input.element)) return false;
  return (input.roll ?? Math.random()) < 0.32;
}

export function enemyAction(input: {
  hp: number;
  maxHp: number;
  hasSupportSkill: boolean;
  roll?: number;
}) {
  const healthRatio = input.hp / Math.max(1, input.maxHp);
  if (input.hasSupportSkill && healthRatio < 0.42 && (input.roll ?? Math.random()) < 0.58) return "support" as const;
  return "attack" as const;
}
