export type AdventureInventory = {
  coins: number;
  capsules: number;
  berries: number;
  crystals: number;
};

export type FieldResearch = {
  encounteredSpecies: string[];
  resolvedBattles: number;
  capturedPets: number;
  claimed: boolean;
};

export type SupplyOfferId = "capsule" | "berry" | "field-kit";

export const INITIAL_INVENTORY: AdventureInventory = {
  coins: 80,
  capsules: 5,
  berries: 3,
  crystals: 0,
};

export const INITIAL_FIELD_RESEARCH: FieldResearch = {
  encounteredSpecies: [],
  resolvedBattles: 0,
  capturedPets: 0,
  claimed: false,
};

export const FIELD_RESEARCH_REQUIREMENTS = {
  species: 3,
  battles: 3,
  captures: 2,
} as const;

export const SUPPLY_OFFERS: Record<SupplyOfferId, {
  name: string;
  description: string;
  price: number;
  capsules: number;
  berries: number;
}> = {
  capsule: { name: "召唤胶囊", description: "捕捉野生宠物所需", price: 20, capsules: 1, berries: 0 },
  berry: { name: "香甜莓果", description: "降低野生宠物的戒备", price: 12, capsules: 0, berries: 1 },
  "field-kit": { name: "野外调查包", description: "胶囊 ×2、莓果 ×2", price: 55, capsules: 2, berries: 2 },
};

function finiteNonNegative(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

export function normalizeInventory(value: unknown): AdventureInventory {
  if (!value || typeof value !== "object") return { ...INITIAL_INVENTORY };
  const saved = value as Partial<AdventureInventory>;
  return {
    coins: finiteNonNegative(saved.coins, INITIAL_INVENTORY.coins),
    capsules: finiteNonNegative(saved.capsules, INITIAL_INVENTORY.capsules),
    berries: finiteNonNegative(saved.berries, INITIAL_INVENTORY.berries),
    crystals: finiteNonNegative(saved.crystals, INITIAL_INVENTORY.crystals),
  };
}

export function normalizeFieldResearch(value: unknown): FieldResearch {
  if (!value || typeof value !== "object") return { ...INITIAL_FIELD_RESEARCH };
  const saved = value as Partial<FieldResearch>;
  return {
    encounteredSpecies: Array.isArray(saved.encounteredSpecies)
      ? Array.from(new Set(saved.encounteredSpecies.filter((item): item is string => typeof item === "string")))
      : [],
    resolvedBattles: finiteNonNegative(saved.resolvedBattles, 0),
    capturedPets: finiteNonNegative(saved.capturedPets, 0),
    claimed: Boolean(saved.claimed),
  };
}

export function recordEncounter(research: FieldResearch, speciesId: string): FieldResearch {
  return {
    ...research,
    encounteredSpecies: Array.from(new Set([...research.encounteredSpecies, speciesId])),
  };
}

export function recordBattleResolution(research: FieldResearch, captured: boolean): FieldResearch {
  return {
    ...research,
    resolvedBattles: research.resolvedBattles + 1,
    capturedPets: research.capturedPets + (captured ? 1 : 0),
  };
}

export function isFieldResearchComplete(research: FieldResearch) {
  return research.encounteredSpecies.length >= FIELD_RESEARCH_REQUIREMENTS.species
    && research.resolvedBattles >= FIELD_RESEARCH_REQUIREMENTS.battles
    && research.capturedPets >= FIELD_RESEARCH_REQUIREMENTS.captures;
}

export function claimFieldResearch(research: FieldResearch, inventory: AdventureInventory) {
  if (research.claimed || !isFieldResearchComplete(research)) return { research, inventory, claimed: false };
  return {
    research: { ...research, claimed: true },
    inventory: {
      coins: inventory.coins + 120,
      capsules: inventory.capsules + 3,
      berries: inventory.berries + 2,
      crystals: inventory.crystals + 2,
    },
    claimed: true,
  };
}

export function buySupply(inventory: AdventureInventory, offerId: SupplyOfferId) {
  const offer = SUPPLY_OFFERS[offerId];
  if (inventory.coins < offer.price) return { inventory, purchased: false };
  return {
    inventory: {
      coins: inventory.coins - offer.price,
      capsules: inventory.capsules + offer.capsules,
      berries: inventory.berries + offer.berries,
      crystals: inventory.crystals,
    },
    purchased: true,
  };
}

const STRONG_AGAINST: Record<string, string[]> = {
  plant: ["water", "earth"],
  metal: ["beast", "ice"],
  water: ["fire", "earth"],
  beast: ["spirit", "plant"],
  wind: ["plant", "beast"],
  spirit: ["metal", "lightning"],
  fire: ["plant", "ice"],
  earth: ["fire", "lightning"],
  lightning: ["water", "wind"],
  ice: ["wind", "plant"],
};

export function elementMultiplier(attacker: string, defender: string) {
  if (attacker === defender) return 0.82;
  if (STRONG_AGAINST[attacker]?.includes(defender)) return 1.45;
  if (STRONG_AGAINST[defender]?.includes(attacker)) return 0.68;
  return 1;
}

export function calculateSkillDamage(input: {
  power: number;
  level: number;
  attack: number;
  defense: number;
  multiplier: number;
  random?: number;
}) {
  const variance = 0.9 + Math.max(0, Math.min(1, input.random ?? Math.random())) * 0.2;
  const base = input.power * 0.15 + input.level * 0.8 + input.attack * 0.08 - input.defense * 0.035;
  return Math.max(3, Math.round(base * input.multiplier * variance));
}

export function calculateWildCounterDamage(input: {
  enemyLevel: number;
  enemyPower?: number;
  defense: number;
  guarding?: boolean;
  random?: number;
}) {
  const variance = 0.9 + Math.max(0, Math.min(1, input.random ?? Math.random())) * 0.2;
  const base = (input.enemyPower ?? 38) * 0.12 + input.enemyLevel * 0.9 - input.defense * 0.025;
  const guarded = input.guarding ? 0.48 : 1;
  return Math.max(2, Math.round(base * variance * guarded));
}

export function captureChance(input: {
  hp: number;
  maxHp: number;
  calm: number;
  alreadyOwned?: boolean;
}) {
  const healthLost = 1 - Math.max(0, Math.min(1, input.hp / Math.max(1, input.maxHp)));
  const calmBonus = Math.max(0, Math.min(3, input.calm)) * 0.15;
  const repeatBonus = input.alreadyOwned ? 0.08 : 0;
  return Math.max(0.08, Math.min(0.92, 0.1 + healthLost * 0.58 + calmBonus + repeatBonus));
}

export function battleRewards(level: number, captured: boolean) {
  return {
    coins: 12 + level * 3 + (captured ? 4 : 0),
    experience: 28 + level * 7 + (captured ? 8 : 0),
  };
}
