const WIDTH = 960;
const HEIGHT = 540;
const BALANCE = window.GAME_BALANCE;
const GAME_DURATION = BALANCE.progression.duration;
const FIRST_PATH_CAP = BALANCE.progression.firstPathCap;
const META = BALANCE.reincarnationTable;
const PATH_COMBAT = BALANCE.pathCombat;
const PATH_THRESHOLDS = PATH_COMBAT.thresholds;

const COLORS = {
  bg: "#091019",
  grid: "rgba(255,255,255,0.05)",
  player: "#d8c88d",
  white: "#efe8d2",
  black: "#35284c",
  enemyWhite: "#e7dcc2",
  enemyBlack: "#4f4067",
  xp: "#59b8ff",
  boss: "#a44a4a",
};

const dom = {
  canvas: document.getElementById("game"),
  ctx: document.getElementById("game").getContext("2d"),
  startBtn: document.getElementById("start-btn"),
  healthFill: document.getElementById("health-fill"),
  healthText: document.getElementById("health-text"),
  xpFill: document.getElementById("xp-fill"),
  xpText: document.getElementById("xp-text"),
  levelText: document.getElementById("level-text"),
  timerText: document.getElementById("timer-text"),
  phaseText: document.getElementById("phase-text"),
  whiteFill: document.getElementById("white-fill"),
  blackFill: document.getElementById("black-fill"),
  whiteText: document.getElementById("white-text"),
  blackText: document.getElementById("black-text"),
  whiteStageText: document.getElementById("white-stage-text"),
  blackStageText: document.getElementById("black-stage-text"),
  statusList: document.getElementById("status-list"),
  skillBar: document.getElementById("skill-bar"),
  overlayMessage: document.getElementById("overlay-message"),
  toast: document.getElementById("toast"),
  modalRoot: document.getElementById("modal-root"),
};

const keys = {};
let toastTimeout = null;

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (handleModalHotkeys(key)) {
    event.preventDefault();
    return;
  }
  if (key === "q" && tryReleasePath("white")) {
    event.preventDefault();
    return;
  }
  if (key === "e" && tryReleasePath("black")) {
    event.preventDefault();
    return;
  }
  if (["1", "2", "3"].includes(key) && tryUseActiveSlot(Number(key) - 1)) {
    event.preventDefault();
    return;
  }
  if (key === "f") toggleFullscreen();
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

document.addEventListener("fullscreenchange", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

const baseStats = BALANCE.playerTable;
const xpCurve = BALANCE.playerTable.xpCurve;
const STAGES_PER_RUN = 4;
const TOTAL_RUNS = 3;
const DESTINY_SLOT_CAP = 4;
const RESULT_DEATH = "death";
const RESULT_CLEAR = "clear";
const ACTIVE_UNLOCK_RANK = 6;
const HUMAN_ENDING_DESTINY_ID = "lotus";
const DAO_POINTIFY_WEIGHTS = {
  white: [
    { value: "white", weight: 94 },
    { value: "mixed", weight: 4 },
    { value: "black", weight: 2 },
  ],
  black: [
    { value: "black", weight: 94 },
    { value: "mixed", weight: 4 },
    { value: "white", weight: 2 },
  ],
};

const destinyCatalog = {
  vital: {
    id: "vital",
    name: "命元诀",
    tier: "common",
    alignment: "white",
    category: "combat",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升最大生命与回复。",
      black: "提升伤害。",
      mixed: "提升拾取范围。",
    },
  },
  spirit: {
    id: "spirit",
    name: "聚灵印",
    tier: "common",
    alignment: "white",
    category: "support",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升经验获取。",
      black: "提升暴击率。",
      mixed: "提升移动速度。",
    },
  },
  river: {
    id: "river",
    name: "归元息",
    tier: "common",
    alignment: "mixed",
    category: "support",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升白槽获取。",
      black: "提升黑槽获取。",
      mixed: "同时微量提升黑白槽获取。",
    },
  },
  blade: {
    id: "blade",
    name: "剑意骨",
    tier: "true",
    alignment: "black",
    category: "combat",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升护体与减伤。",
      black: "提升暴伤与输出。",
      mixed: "少量提升冷却效率。",
    },
  },
  thunder: {
    id: "thunder",
    name: "惊雷纹",
    tier: "true",
    alignment: "black",
    category: "combat",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升回复与经验。",
      black: "提升伤害与施法频率。",
      mixed: "提升移动速度与拾取。",
    },
  },
  ward: {
    id: "ward",
    name: "护命符",
    tier: "true",
    alignment: "white",
    category: "support",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升最大生命与白道收益。",
      black: "提升暴击与黑道收益。",
      mixed: "提升基础增伤。",
    },
  },
  reaper: {
    id: "reaper",
    name: "修罗契",
    tier: "fate",
    alignment: "black",
    category: "combat",
    baseCost: 42,
    maxLevel: 3,
    upgradeCosts: [20, 28],
    text: {
      white: "高额提升生存。",
      black: "高额提升伤害与暴击。",
      mixed: "均衡提升输出与资源。",
    },
  },
  lotus: {
    id: "lotus",
    name: "净世莲",
    tier: "fate",
    alignment: "mixed",
    category: "support",
    baseCost: 42,
    maxLevel: 3,
    upgradeCosts: [20, 28],
    text: {
      white: "高额提升回复与经验。",
      black: "高额提升黑槽与爆发。",
      mixed: "高额提升移动与拾取。",
    },
  },
};

function createCampaignState() {
  return {
    runIndex: 1,
    stageIndex: 1,
    stageType: "small",
    stageKills: 0,
    targetKills: 12,
    miniBossSpawned: false,
    miniBossDefeated: false,
    bossSpawned: false,
  };
}

const skills = {
  sword: {
    id: "sword",
    name: "飞剑诀",
    description: "自动追踪最近敌人的飞剑术。",
    baseCooldown: 0.9,
    baseDamage: 24,
    baseProjectiles: 1,
  },
  thunder: {
    id: "thunder",
    name: "掌心雷",
    description: "对最近敌人施加落雷，可连锁。",
    baseCooldown: 1.4,
    baseDamage: 28,
    splash: 54,
  },
  flame: {
    id: "flame",
    name: "火环术",
    description: "环身火域持续灼烧近身敌人。",
    radius: 90,
    tick: 0.5,
    damage: 22,
  },
  guard: {
    id: "guard",
    name: "金钟罩",
    description: "生成护盾并在破裂时反震。",
    shield: 60,
    recharge: 12,
  },
};

const activeSkillTable = {
  sword: { baseCooldown: 3 },
  thunder: { baseCooldown: 3 },
  guard: { baseCooldown: 3 },
  flame: { baseCooldown: 3 },
};

const enemies = BALANCE.monsterTable;

function createMetaState() {
  return {
    points: 0,
    upgrades: {},
    runs: 0,
    bestKills: 0,
    lastResult: null,
    destiny: {
      owned: {},
      equipped: [],
      maxSlots: DESTINY_SLOT_CAP,
    },
  };
}

function loadMetaState() {
  try {
    const raw = localStorage.getItem(META.storageKey);
    if (!raw) return createMetaState();
    return { ...createMetaState(), ...JSON.parse(raw) };
  } catch {
    return createMetaState();
  }
}

function saveMetaState() {
  localStorage.setItem(META.storageKey, JSON.stringify(metaState));
}

const metaState = loadMetaState();
let pendingInfusionContinuation = null;

function ensureMetaCollections() {
  if (!metaState.destiny) metaState.destiny = { owned: {}, equipped: [], maxSlots: DESTINY_SLOT_CAP };
  if (!metaState.destiny.owned) metaState.destiny.owned = {};
  if (!metaState.destiny.equipped) metaState.destiny.equipped = [];
  if (!metaState.destiny.maxSlots) metaState.destiny.maxSlots = DESTINY_SLOT_CAP;
}

ensureMetaCollections();

function getOwnedDestinyEntries() {
  return Object.entries(metaState.destiny.owned).map(([id, entry]) => ({ id, ...entry, def: destinyCatalog[id] })).filter((entry) => entry.def);
}

function getEquippedDestinyEntries() {
  return metaState.destiny.equipped
    .map((id) => metaState.destiny.owned[id] ? { id, ...metaState.destiny.owned[id], def: destinyCatalog[id] } : null)
    .filter(Boolean);
}

function getUnequippedOwnedDestinyEntries() {
  const equippedSet = new Set(metaState.destiny.equipped);
  return getOwnedDestinyEntries().filter((entry) => !equippedSet.has(entry.id));
}

function getAlignmentCounts() {
  const counts = { white: 0, black: 0, mixed: 0 };
  getEquippedDestinyEntries().forEach((entry) => {
    counts[entry.def.alignment || "mixed"] += 1;
  });
  return counts;
}

function getAlignmentResult() {
  const counts = getAlignmentCounts();
  const hasHumanEnding = getEquippedDestinyEntries().some((entry) => entry.id === HUMAN_ENDING_DESTINY_ID);
  if (hasHumanEnding) return "成人（Be Human）";
  if (counts.white > counts.black) return "成仙";
  if (counts.black > counts.white) return "化魔";
  if (state.whitePath.value > state.blackPath.value) return "成仙";
  if (state.blackPath.value > state.whitePath.value) return "化魔";
  return "成仙";
}

function getDestinyWeight(alignment) {
  let weight = alignment === "mixed" ? 0.9 : 1;
  const counts = getAlignmentCounts();
  if (alignment === "white" && state?.whitePath?.full) weight *= 1.1;
  if (alignment === "black" && state?.blackPath?.full) weight *= 1.1;
  if (alignment === "white" && counts.white >= 2) weight *= 1.25;
  if (alignment === "black" && counts.black >= 2) weight *= 1.25;
  if (alignment === "white" && counts.white >= 4) weight *= 1.6;
  if (alignment === "black" && counts.black >= 4) weight *= 1.6;
  return weight;
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function getMissingDestinyIds() {
  return Object.keys(destinyCatalog).filter((id) => !metaState.destiny.owned[id]);
}

function getRandomDestinyOffers(count = 3) {
  const pool = getMissingDestinyIds();
  const offers = [];
  while (pool.length > 0 && offers.length < count) {
    const id = weightedPick(
      pool.map((destinyId) => ({
        value: destinyId,
        weight: getDestinyWeight(destinyCatalog[destinyId].alignment),
      })),
    );
    pool.splice(pool.indexOf(id), 1);
    offers.push({ id });
  }
  return offers;
}

function describeDestiny(id, alignment = destinyCatalog[id].alignment, level = 1) {
  const def = destinyCatalog[id];
  return `${def.name} [${alignment}] Lv.${level} - ${def.text[alignment]}`;
}

function getAlignmentLabel(alignment) {
  if (alignment === "white") return "白道";
  if (alignment === "black") return "黑道";
  return "混元";
}

function getDaoPointifyDistributionText(color) {
  return color === "white"
    ? "白道 94% / 混元 4% / 黑道 2%"
    : "黑道 94% / 混元 4% / 白道 2%";
}

function formatResultLabel(result) {
  if (result === RESULT_DEATH) return "陨落";
  if (result === RESULT_CLEAR) return "通关";
  return result;
}

function getDestinyEntriesFromEquippedIds(equippedIds) {
  return equippedIds
    .map((id) => metaState.destiny.owned[id] ? { id, ...metaState.destiny.owned[id], def: destinyCatalog[id] } : null)
    .filter((entry) => entry?.def);
}

function applyDestinyBonusesFromEntries(entries, player, mods) {
  entries.forEach((entry) => {
    const level = entry.level || 1;
    const alignment = entry.def.alignment || "mixed";
    switch (entry.id) {
      case "vital":
        if (alignment === "white") {
          player.maxHp += 18 * level;
          player.regen += 0.08 * level;
        } else if (alignment === "black") {
          mods.damageMult += 0.06 * level;
        } else {
          player.pickupRange += 10 * level;
        }
        break;
      case "spirit":
        if (alignment === "white") mods.xpGainMult += 0.1 * level;
        else if (alignment === "black") player.critChance += 0.04 * level;
        else player.speed += 10 * level;
        break;
      case "river":
        if (alignment === "white") mods.whiteGainMult += 0.12 * level;
        else if (alignment === "black") mods.blackGainMult += 0.12 * level;
        else {
          mods.whiteGainMult += 0.05 * level;
          mods.blackGainMult += 0.05 * level;
        }
        break;
      case "blade":
        if (alignment === "white") mods.incomingMult *= Math.max(0.65, 1 - 0.08 * level);
        else if (alignment === "black") player.critDamage += 0.18 * level;
        else player.globalCooldown *= Math.max(0.75, 1 - 0.06 * level);
        break;
      case "thunder":
        if (alignment === "white") {
          player.regen += 0.06 * level;
          mods.xpGainMult += 0.06 * level;
        } else if (alignment === "black") {
          mods.damageMult += 0.05 * level;
          player.globalCooldown *= Math.max(0.72, 1 - 0.05 * level);
        } else {
          player.speed += 8 * level;
          player.pickupRange += 8 * level;
        }
        break;
      case "ward":
        if (alignment === "white") {
          player.maxHp += 14 * level;
          mods.whiteGainMult += 0.08 * level;
        } else if (alignment === "black") {
          player.critChance += 0.03 * level;
          mods.blackGainMult += 0.08 * level;
        } else {
          mods.damageMult += 0.04 * level;
        }
        break;
      case "reaper":
        if (alignment === "white") {
          player.maxHp += 24 * level;
          player.regen += 0.1 * level;
        } else if (alignment === "black") {
          mods.damageMult += 0.1 * level;
          player.critChance += 0.04 * level;
        } else {
          mods.damageMult += 0.05 * level;
          mods.xpGainMult += 0.06 * level;
        }
        break;
      case "lotus":
        if (alignment === "white") {
          mods.xpGainMult += 0.14 * level;
          player.regen += 0.1 * level;
        } else if (alignment === "black") {
          mods.blackGainMult += 0.14 * level;
          mods.damageMult += 0.06 * level;
        } else {
          player.speed += 12 * level;
          player.pickupRange += 12 * level;
        }
        break;
      default:
        break;
    }
  });
}

function applyDestinyBonuses(player, mods) {
  applyDestinyBonusesFromEntries(getEquippedDestinyEntries(), player, mods);
}

function createDestinyPreviewSnapshot(equippedIds = metaState.destiny.equipped) {
  const hpBonus = (metaState.upgrades.hp1 || 0) * META.upgrades.hp1.effectPerLevel;
  const xpGainMult = 1 + (metaState.upgrades.xp1 || 0) * META.upgrades.xp1.effectPerLevel;
  const pickupMult = 1 + (metaState.upgrades.pickup1 || 0) * META.upgrades.pickup1.effectPerLevel;
  const whiteGainMult = 1 + (metaState.upgrades.white1 || 0) * META.upgrades.white1.effectPerLevel;
  const blackGainMult = 1 + (metaState.upgrades.black1 || 0) * META.upgrades.black1.effectPerLevel;
  const player = {
    maxHp: baseStats.maxHp + hpBonus,
    speed: baseStats.speed,
    critChance: baseStats.critChance,
    critDamage: baseStats.critDamage,
    globalCooldown: 1,
    pickupRange: baseStats.pickupRange * pickupMult,
    regen: baseStats.regen,
  };
  const mods = {
    xpGainMult,
    whiteGainMult,
    blackGainMult,
    damageMult: 1,
    incomingMult: 1,
  };
  applyDestinyBonusesFromEntries(getDestinyEntriesFromEquippedIds(equippedIds), player, mods);
  return {
    maxHp: player.maxHp,
    regen: player.regen,
    speed: player.speed,
    pickupRange: player.pickupRange,
    critChance: player.critChance,
    critDamage: player.critDamage,
    cooldownRate: 1 / player.globalCooldown,
    damageMult: mods.damageMult,
    incomingMult: mods.incomingMult,
    xpGainMult: mods.xpGainMult,
    whiteGainMult: mods.whiteGainMult,
    blackGainMult: mods.blackGainMult,
  };
}

function formatSignedStat(value, digits = 0) {
  const rounded = digits > 0 ? value.toFixed(digits) : Math.round(value).toString();
  return `${value >= 0 ? "+" : ""}${rounded}`;
}

function describeDestinyStatDelta(before, after) {
  const deltas = [];
  if (after.maxHp !== before.maxHp) deltas.push(`生命 ${formatSignedStat(after.maxHp - before.maxHp)}`);
  if (after.regen !== before.regen) deltas.push(`回复 ${formatSignedStat(after.regen - before.regen, 2)}`);
  if (after.damageMult !== before.damageMult) deltas.push(`伤害 ${formatSignedStat((after.damageMult - before.damageMult) * 100)}%`);
  if (after.incomingMult !== before.incomingMult) deltas.push(`承伤 ${formatSignedStat((after.incomingMult - before.incomingMult) * 100)}%`);
  if (after.critChance !== before.critChance) deltas.push(`暴击 ${formatSignedStat((after.critChance - before.critChance) * 100)}%`);
  if (after.critDamage !== before.critDamage) deltas.push(`暴伤 ${formatSignedStat((after.critDamage - before.critDamage) * 100)}%`);
  if (after.speed !== before.speed) deltas.push(`移速 ${formatSignedStat(after.speed - before.speed)}`);
  if (after.pickupRange !== before.pickupRange) deltas.push(`拾取 ${formatSignedStat(after.pickupRange - before.pickupRange)}`);
  if (after.cooldownRate !== before.cooldownRate) deltas.push(`冷却效率 ${formatSignedStat((after.cooldownRate - before.cooldownRate) * 100)}%`);
  if (after.xpGainMult !== before.xpGainMult) deltas.push(`经验 ${formatSignedStat((after.xpGainMult - before.xpGainMult) * 100)}%`);
  if (after.whiteGainMult !== before.whiteGainMult) deltas.push(`白槽 ${formatSignedStat((after.whiteGainMult - before.whiteGainMult) * 100)}%`);
  if (after.blackGainMult !== before.blackGainMult) deltas.push(`黑槽 ${formatSignedStat((after.blackGainMult - before.blackGainMult) * 100)}%`);
  return deltas.length ? `预览：${deltas.join(" | ")}` : "预览：属性无变化";
}

function getPointifyPreviewRows(targetId, color) {
  const poolIds = Object.keys(destinyCatalog).filter((id) => id === targetId || !metaState.destiny.owned[id]);
  const availableAlignments = [...new Set(poolIds.map((id) => destinyCatalog[id].alignment))];
  const table = (DAO_POINTIFY_WEIGHTS[color] || DAO_POINTIFY_WEIGHTS.white)
    .filter((entry) => availableAlignments.includes(entry.value));
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return table.map((entry) => {
    const candidates = poolIds.filter((id) => destinyCatalog[id].alignment === entry.value);
    const names = candidates.map((id) => destinyCatalog[id].name);
    return {
      alignment: entry.value,
      chance: (entry.weight / totalWeight) * 100,
      names,
    };
  });
}

function describePointifyPreview(targetId, color) {
  return getPointifyPreviewRows(targetId, color)
    .map((row) => `${getAlignmentLabel(row.alignment)} ${row.chance.toFixed(1)}% -> ${row.names.join(" / ")}`)
    .join(" | ");
}

function getPointifyEquipPreview(nextId) {
  if (metaState.destiny.equipped.length >= metaState.destiny.maxSlots) {
    return "当前命盘已满，可在“更换命格”中查看替换后的属性变化。";
  }
  const before = createDestinyPreviewSnapshot(metaState.destiny.equipped);
  const after = createDestinyPreviewSnapshot([...metaState.destiny.equipped, nextId]);
  return `若稍后装配：${describeDestinyStatDelta(before, after).replace("预览：", "")}`;
}

function makePathState(color) {
  return {
    color,
    value: 0,
    cap: PATH_COMBAT.cap || FIRST_PATH_CAP,
    full: false,
    tier1Triggered: false,
    tier2Triggered: false,
  };
}

function createState() {
  const hpBonus = (metaState.upgrades.hp1 || 0) * META.upgrades.hp1.effectPerLevel;
  const xpGainMult = 1 + (metaState.upgrades.xp1 || 0) * META.upgrades.xp1.effectPerLevel;
  const pickupMult = 1 + (metaState.upgrades.pickup1 || 0) * META.upgrades.pickup1.effectPerLevel;
  const whiteGainMult = 1 + (metaState.upgrades.white1 || 0) * META.upgrades.white1.effectPerLevel;
  const blackGainMult = 1 + (metaState.upgrades.black1 || 0) * META.upgrades.black1.effectPerLevel;
  const mods = {
    xpGainMult,
    whiteGainMult,
    blackGainMult,
    damageMult: 1,
    incomingMult: 1,
  };
  const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    radius: 16,
    maxHp: baseStats.maxHp + hpBonus,
    hp: baseStats.maxHp + hpBonus,
    speed: baseStats.speed,
    critChance: baseStats.critChance,
    critDamage: baseStats.critDamage,
    globalCooldown: 1,
    pickupRange: baseStats.pickupRange * pickupMult,
    regen: baseStats.regen,
    barrier: 0,
    invulnTimer: 0,
    skills: {},
    skillOrder: [],
    level: 1,
    xp: 0,
    skillFocus: {},
  };
  applyDestinyBonuses(player, mods);
  player.hp = player.maxHp;
  return {
    mode: "menu",
    running: false,
    paused: false,
    time: 0,
    runStartTime: 0,
    realLast: 0,
    spawnTimer: 0,
    eliteSchedule: [...BALANCE.waves.eliteSchedule],
    eliteIndex: 0,
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    drops: [],
    pulses: [],
    boss: null,
    bossFight: false,
    result: null,
    player,
    xpGainMult,
    whiteGainMult,
    blackGainMult,
    whitePath: makePathState("white"),
    blackPath: makePathState("black"),
    phaseLabel: "待开始",
    currentModal: null,
    pendingLevelUps: 0,
    statuses: [],
    totalKills: 0,
    modalOptions: null,
    campaign: createCampaignState(),
    currentDestinyOffers: [],
    lastRunPoints: 0,
    pendingMiniBossReward: false,
    whiteInfusionPoints: 0,
    blackInfusionPoints: 0,
    noHitTimer: 0,
    whiteUntouchedRewardTimer: 0,
    whiteKillHealCooldown: 0,
    blackLowHpKillCooldown: 0,
    blackMomentumStacks: 0,
    blackMomentumTimer: 0,
    blackMomentumCooldown: 0,
  };
}

const state = createState();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getActiveLevel(skill) {
  return Math.max(0, skill.rank - (ACTIVE_UNLOCK_RANK - 1));
}

function getActiveCooldown(id, level) {
  const base = activeSkillTable[id]?.baseCooldown || 18;
  return Math.max(base * 0.55, base - (level - 1) * 1.2);
}

function isActiveUnlocked(skill) {
  return getActiveLevel(skill) > 0;
}

function nearestEnemyFromPoint(origin) {
  const targets = [...state.enemies];
  if (state.boss) targets.push(state.boss);
  return targets.sort((a, b) => distance(a, origin) - distance(b, origin))[0] || null;
}

function getTargetsWithinRadius(origin, radius) {
  const targets = state.enemies.filter((enemy) => distance(origin, enemy) <= radius + enemy.radius);
  if (state.boss && distance(origin, state.boss) <= radius + state.boss.radius) targets.push(state.boss);
  return targets;
}

function formatTime(totalSeconds) {
  const seconds = Math.ceil(totalSeconds);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function setToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 1800);
}

function closeModal() {
  state.currentModal = null;
  state.modalOptions = null;
  dom.modalRoot.classList.add("hidden");
  dom.modalRoot.innerHTML = "";
}

function renderModal({ title, body, bodyHtml = "", choices, actions = [], className = "" }) {
  state.modalOptions = { choices, actions };
  dom.modalRoot.classList.remove("hidden");
  dom.modalRoot.innerHTML = `
    <div class="modal-card ${className}">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${body}</div>
      ${bodyHtml}
      <div class="choice-list">
        ${choices.map((choice, index) => `
          <button class="choice-card" type="button" data-choice="${index}" ${choice.disabled ? "disabled" : ""}>
            <strong>${choice.title}</strong>
            <span>${choice.body}</span>
          </button>
        `).join("")}
      </div>
      <div class="modal-actions">
        ${actions.map((action, index) => `<button class="action-btn" type="button" data-action="${index}">${action.label}</button>`).join("")}
      </div>
    </div>
  `;
  dom.modalRoot.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => choices[Number(button.dataset.choice)].onClick());
  });
  dom.modalRoot.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => actions[Number(button.dataset.action)].onClick());
  });
}

function handleModalHotkeys(key) {
  if (!state.modalOptions) return false;
  const { choices, actions } = state.modalOptions;
  if (key === "1" && choices[0]) { choices[0].onClick(); return true; }
  if (key === "2" && choices[1]) { choices[1].onClick(); return true; }
  if (key === "3" && choices[2]) { choices[2].onClick(); return true; }
  if ((key === "enter" || key === "space") && choices[0]) { choices[0].onClick(); return true; }
  if (key === "escape" && actions[0]) { actions[0].onClick(); return true; }
  return false;
}

function showOverlay(show) {
  dom.overlayMessage.classList.toggle("show", show);
}

function xpNeeded(level) {
  return xpCurve[Math.min(level - 1, xpCurve.length - 1)];
}

function chooseMainSkill(gameState) {
  let main = null;
  let score = -1;
  Object.entries(gameState.player.skillFocus).forEach(([id, value]) => {
    if (value > score) {
      score = value;
      main = id;
    }
  });
  return main;
}

function grantMainSkillUpgrade() {
  const main = chooseMainSkill(state);
  if (!main || !state.player.skills[main]) return;
  const skill = state.player.skills[main];
  skill.rank += 1;
  if (main === "sword") skill.damage *= 1.2;
  if (main === "flame") skill.damage *= 1.18;
  if (main === "guard") {
    skill.maxShield *= 1.2;
    skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * 0.3);
  }
}

function addStatus(name, duration, effects) {
  const existing = state.statuses.find((status) => status.name === name);
  if (existing) {
    existing.duration = duration;
    existing.remaining = duration;
    existing.effects = effects;
    return existing;
  }
  const next = { name, duration, remaining: duration, effects };
  state.statuses.push(next);
  return next;
}

function hasStatus(name) {
  return state.statuses.some((status) => status.name === name);
}

function getStatus(name) {
  return state.statuses.find((status) => status.name === name) || null;
}

function getMoveMult() {
  let mult = 1;
  state.statuses.forEach((status) => {
    if (status.effects.moveMult) mult *= status.effects.moveMult;
  });
  return mult;
}

function getPickupRange() {
  let bonus = 0;
  state.statuses.forEach((status) => {
    if (status.effects.pickupBonus) bonus += status.effects.pickupBonus;
  });
  return state.player.pickupRange + bonus;
}

function getCritChance() {
  let bonus = 0;
  state.statuses.forEach((status) => {
    if (status.effects.critChanceBonus) bonus += status.effects.critChanceBonus;
  });
  return state.player.critChance + bonus;
}

function getActiveCooldownRate() {
  let mult = 1;
  state.statuses.forEach((status) => {
    if (status.effects.activeCooldownRate) mult *= status.effects.activeCooldownRate;
  });
  return mult;
}

function getKillHealProfile() {
  let healPct = 0;
  let cooldown = 0;
  state.statuses.forEach((status) => {
    if (status.effects.onKillHealPct) {
      healPct += status.effects.onKillHealPct;
      cooldown = Math.max(cooldown, status.effects.onKillHealCooldown || 0);
    }
  });
  return { healPct, cooldown };
}

function getDropAttractProfile(drop) {
  let radius = 0;
  let speed = 0;
  let speedMult = 1;
  const eliteReward = drop.isEliteReward || drop.isMiniBossReward;
  state.statuses.forEach((status) => {
    const effects = status.effects;
    if (effects.attractRadius && effects.attractSpeed) {
      radius = Math.max(radius, effects.attractRadius);
      speed = Math.max(speed, effects.attractSpeed);
    }
    if (eliteReward && effects.eliteAttractSpeedMult && (!effects.requireBarrier || state.player.barrier > 0)) {
      radius = Math.max(radius, PATH_COMBAT.white.fullAttractRadius);
      speed = Math.max(speed, PATH_COMBAT.white.fullAttractSpeed / effects.eliteAttractSpeedMult);
      speedMult = Math.max(speedMult, effects.eliteAttractSpeedMult);
    }
  });
  return { radius, speed: speed * speedMult };
}

function getExecuteDamageMult(target) {
  let mult = 1;
  state.statuses.forEach((status) => {
    const effects = status.effects;
    if (!effects.execute) return;
    const hpRatio = target.hp / Math.max(1, target.maxHp);
    if (target.type === "boss") {
      if (hpRatio <= effects.execute.bossThreshold) mult = Math.max(mult, effects.execute.bossMult);
      return;
    }
    if (target.isMiniBoss || target.type === "elite") {
      if (hpRatio <= effects.execute.eliteThreshold) mult = Math.max(mult, effects.execute.eliteMult);
      return;
    }
    if (hpRatio <= effects.execute.normalThreshold) mult = Math.max(mult, effects.execute.normalMult);
  });
  return mult;
}

function getBlackBurstProfile() {
  let radius = 0;
  let base = 0;
  let enemyMaxHpPct = 0;
  let radiusMult = 1;
  state.statuses.forEach((status) => {
    const effects = status.effects;
    if (effects.blackBurstRadius) {
      radius = Math.max(radius, effects.blackBurstRadius);
      base = Math.max(base, effects.blackBurstBase || 0);
      enemyMaxHpPct = Math.max(enemyMaxHpPct, effects.blackBurstEnemyMaxHpPct || 0);
    }
    if (effects.blackBurstRadiusMult) radiusMult = Math.max(radiusMult, effects.blackBurstRadiusMult);
  });
  return { radius: radius * radiusMult, base, enemyMaxHpPct };
}

function hasGuardFocus() {
  return hasStatus("灵护") && state.player.barrier > 0;
}

function grantBarrier(amount) {
  state.player.barrier = Math.max(0, state.player.barrier + amount);
}

function getPlayerAttackPower() {
  const learned = state.player.skillOrder.map((id) => state.player.skills[id]).filter(Boolean);
  if (!learned.length) return skills.sword.baseDamage;
  const total = learned.reduce((sum, skill) => {
    if (skill.damage) return sum + skill.damage;
    if (skill.maxShield) return sum + skill.maxShield * 0.35;
    return sum + 24;
  }, 0);
  return total / learned.length;
}

function getDamageMult() {
  let mult = state.bonusDamageMult || 1;
  state.statuses.forEach((status) => {
    if (status.effects.damageMult) mult *= status.effects.damageMult;
  });
  if (state.blackMomentumStacks > 0 && state.blackMomentumTimer > 0) {
    mult *= 1 + state.blackMomentumStacks * PATH_COMBAT.black.tier2AssaultStackMult;
  }
  return mult;
}

function getCastMult() {
  let mult = 1;
  state.statuses.forEach((status) => {
    if (status.effects.castMult) mult *= status.effects.castMult;
  });
  return mult;
}

function getIncomingMult() {
  let mult = state.incomingMult || 1;
  state.statuses.forEach((status) => {
    if (status.effects.incomingMult) mult *= status.effects.incomingMult;
  });
  return mult;
}

function computeDamage(base) {
  let damage = base * getDamageMult();
  if (Math.random() < getCritChance()) damage *= state.player.critDamage;
  return damage;
}

function getThunderDamage(skill) {
  if (!skill) return 0;
  const rankBonus = Math.max(0, skill.rank - 1) * 0.2;
  const deepenBonus = (skill.deepenStacks || 0) * 0.4;
  return skill.baseDamage * (1 + rankBonus + deepenBonus);
}

function resetPathCharge(path) {
  path.value = 0;
  path.full = false;
  path.tier1Triggered = false;
  path.tier2Triggered = false;
}

function triggerPathTier(color, tier) {
  if (color === "white" && tier === 1) {
    addStatus("清明", PATH_COMBAT.white.tier1Duration, {
      pickupBonus: PATH_COMBAT.white.tier1PickupBonus,
      attractRadius: PATH_COMBAT.white.tier1AttractRadius,
      attractSpeed: PATH_COMBAT.white.tier1AttractSpeed,
      onKillHealPct: PATH_COMBAT.white.tier1HealPct,
      onKillHealCooldown: PATH_COMBAT.white.tier1HealCooldown,
    });
    setToast("白道 1/3：清明");
    return;
  }
  if (color === "white" && tier === 2) {
    const barrier = clamp(
      state.player.maxHp * PATH_COMBAT.white.tier2BarrierPct,
      PATH_COMBAT.white.tier2BarrierMin,
      PATH_COMBAT.white.tier2BarrierMax,
    );
    grantBarrier(barrier);
    addStatus("灵护", PATH_COMBAT.white.tier2Duration, {
      eliteAttractSpeedMult: PATH_COMBAT.white.tier2EliteAttractMult,
      requireBarrier: true,
      onExpire: () => {
        if (state.player.hp / Math.max(1, state.player.maxHp) >= PATH_COMBAT.white.tier2RefundThreshold) {
          fillPath("white", PATH_COMBAT.white.tier2RefundValue);
          setToast("灵护善终：返还白道值");
        }
      },
    });
    setToast("白道 2/3：灵护");
    return;
  }
  if (color === "black" && tier === 1) {
    addStatus("煞燃", PATH_COMBAT.black.tier1Duration, {
      damageMult: PATH_COMBAT.black.tier1DamageMult,
      castMult: PATH_COMBAT.black.tier1CastMult,
      moveMult: PATH_COMBAT.black.tier1MoveMult,
      blackBurstRadius: PATH_COMBAT.black.tier1BurstRadius,
      blackBurstBase: PATH_COMBAT.black.tier1BurstBase,
      blackBurstEnemyMaxHpPct: PATH_COMBAT.black.tier1BurstEnemyMaxHpPct,
      drain: PATH_COMBAT.black.tier1Drain,
    });
    setToast("黑道 1/3：煞燃");
    return;
  }
  if (color === "black" && tier === 2) {
    addStatus("魔驰", PATH_COMBAT.black.tier2Duration, {
      incomingMult: PATH_COMBAT.black.tier2IncomingMult,
      activeCooldownRate: PATH_COMBAT.black.tier2ActiveCooldownRate,
      execute: {
        normalThreshold: PATH_COMBAT.black.tier2NormalExecuteThreshold,
        normalMult: PATH_COMBAT.black.tier2NormalExecuteMult,
        eliteThreshold: PATH_COMBAT.black.tier2EliteExecuteThreshold,
        eliteMult: PATH_COMBAT.black.tier2EliteExecuteMult,
        bossThreshold: PATH_COMBAT.black.tier2BossExecuteThreshold,
        bossMult: PATH_COMBAT.black.tier2BossExecuteMult,
      },
    });
    setToast("黑道 2/3：魔驰");
  }
}

function maybeTriggerPathThresholds(path, previousValue) {
  if (!path.tier1Triggered && previousValue < PATH_THRESHOLDS.tier1 && path.value >= PATH_THRESHOLDS.tier1) {
    path.tier1Triggered = true;
    triggerPathTier(path.color, 1);
  }
  if (!path.tier2Triggered && previousValue < PATH_THRESHOLDS.tier2 && path.value >= PATH_THRESHOLDS.tier2) {
    path.tier2Triggered = true;
    triggerPathTier(path.color, 2);
  }
  if (!path.full && previousValue < PATH_THRESHOLDS.full && path.value >= PATH_THRESHOLDS.full) {
    path.full = true;
    path.value = path.cap;
    if (path.color === "white") {
      state.whiteInfusionPoints += 1;
      setToast(`白槽已满，可按 Q 释放；白点化点 +1（当前 ${state.whiteInfusionPoints}）`);
    } else {
      state.blackInfusionPoints += 1;
      setToast(`黑槽已满，可按 E 释放；黑点化点 +1（当前 ${state.blackInfusionPoints}）`);
    }
  }
}

function hasInfusionPoints() {
  return state.whiteInfusionPoints > 0 || state.blackInfusionPoints > 0;
}

function emitStabilizePulse(radius) {
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius,
    damage: 0,
    kind: "guard",
    time: 0.24,
    duration: 0.24,
    hit: new Set(),
    affectsBoss: true,
  });
  state.enemies.forEach((enemy) => {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist <= radius + enemy.radius) {
      const push = 28 + Math.max(0, radius - dist) * 0.12;
      enemy.x = clamp(enemy.x + (dx / dist) * push, 20, WIDTH - 20);
      enemy.y = clamp(enemy.y + (dy / dist) * push, 20, HEIGHT - 20);
    }
  });
  if (!state.boss) return;
  const dx = state.boss.x - state.player.x;
  const dy = state.boss.y - state.player.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  if (dist <= radius + state.boss.radius) {
    const push = 16 + Math.max(0, radius - dist) * 0.08;
    state.boss.x = clamp(state.boss.x + (dx / dist) * push, 80, WIDTH - 80);
    state.boss.y = clamp(state.boss.y + (dy / dist) * push, 60, HEIGHT - 60);
  }
}

function tryReleasePath(color) {
  if (state.mode !== "playing" || state.paused || state.currentModal) return false;
  const path = color === "white" ? state.whitePath : state.blackPath;
  if (!path.full) return false;
  if (color === "white") {
    emitStabilizePulse(PATH_COMBAT.white.fullPulseRadius);
    grantBarrier(clamp(
      state.player.maxHp * PATH_COMBAT.white.fullBarrierPct,
      PATH_COMBAT.white.fullBarrierMin,
      PATH_COMBAT.white.fullBarrierMax,
    ));
    addStatus("天息", PATH_COMBAT.white.fullDuration, {
      incomingMult: PATH_COMBAT.white.fullIncomingMult,
      pickupBonus: PATH_COMBAT.white.fullPickupBonus,
      attractRadius: PATH_COMBAT.white.fullAttractRadius,
      attractSpeed: PATH_COMBAT.white.fullAttractSpeed,
      onKillHealPct: PATH_COMBAT.white.fullHealPct,
      onKillHealCooldown: PATH_COMBAT.white.fullHealCooldown,
    });
    setToast("白道满槽：天息");
  } else {
    pulse(
      state.player.x,
      state.player.y,
      PATH_COMBAT.black.fullPulseRadius,
      computeDamage(PATH_COMBAT.black.fullPulseBase + getPlayerAttackPower() * 1.1),
      "guard",
    );
    addStatus("魔沸", PATH_COMBAT.black.fullDuration, {
      damageMult: PATH_COMBAT.black.fullDamageMult,
      critChanceBonus: PATH_COMBAT.black.fullCritChanceBonus,
      activeCooldownRate: PATH_COMBAT.black.fullActiveCooldownRate,
      blackBurstRadiusMult: PATH_COMBAT.black.fullBurstRadiusMult,
      drain: PATH_COMBAT.black.fullDrain,
    });
    setToast("黑道满槽：魔沸");
  }
  resetPathCharge(path);
  return true;
}

function maybeTriggerBlackMomentum(source = "auto") {
  if (!hasStatus("魔驰")) return;
  if (state.blackMomentumCooldown > 0) return;
  if (source === "active") {
    const nearby = getTargetsWithinRadius(state.player, PATH_COMBAT.gain.activeThreatRange);
    if (!nearby.length) return;
  }
  state.blackMomentumCooldown = PATH_COMBAT.black.tier2AssaultCooldown;
  state.blackMomentumTimer = PATH_COMBAT.black.tier2AssaultDuration;
  state.blackMomentumStacks = Math.min(PATH_COMBAT.black.tier2AssaultMaxStacks, state.blackMomentumStacks + 1);
}

function maybeTriggerKillHeal() {
  const profile = getKillHealProfile();
  if (profile.healPct <= 0 || state.whiteKillHealCooldown > 0) return;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * profile.healPct);
  state.whiteKillHealCooldown = profile.cooldown;
}

function triggerBlackBurst(enemy) {
  const burst = getBlackBurstProfile();
  if (burst.radius <= 0) return;
  pulse(
    enemy.x,
    enemy.y,
    burst.radius,
    computeDamage(burst.base + enemy.maxHp * burst.enemyMaxHpPct),
    "burst",
  );
}

function updatePathBehavior(dt) {
  state.noHitTimer += dt;
  state.whiteKillHealCooldown = Math.max(0, state.whiteKillHealCooldown - dt);
  state.blackLowHpKillCooldown = Math.max(0, state.blackLowHpKillCooldown - dt);
  state.blackMomentumCooldown = Math.max(0, state.blackMomentumCooldown - dt);
  state.blackMomentumTimer = Math.max(0, state.blackMomentumTimer - dt);
  if (state.blackMomentumTimer <= 0) state.blackMomentumStacks = 0;

  if (!state.whitePath.full && state.noHitTimer >= PATH_COMBAT.gain.whiteUntouchedDelay) {
    state.whiteUntouchedRewardTimer += dt;
    if (state.whiteUntouchedRewardTimer >= PATH_COMBAT.gain.whiteUntouchedInterval) {
      state.whiteUntouchedRewardTimer -= PATH_COMBAT.gain.whiteUntouchedInterval;
      fillPath("white", PATH_COMBAT.gain.whiteUntouchedValue);
      setToast("白道感悟：清心未伤");
    }
  } else {
    state.whiteUntouchedRewardTimer = 0;
  }
}

function unlockSkill(gameState, id) {
  if (gameState.player.skills[id]) return;
  const base = skills[id];
  if (!base) return;
  if (id === "sword") {
    gameState.player.skills.sword = { id, rank: 1, cooldown: base.baseCooldown, damage: base.baseDamage, projectiles: 1, pierce: 0, timer: 0.2, activeTimer: 0 };
  } else if (id === "thunder") {
    gameState.player.skills.thunder = { id, rank: 1, cooldown: base.baseCooldown, baseDamage: base.baseDamage, deepenStacks: 0, timer: 0.6, chain: 0, splash: base.splash, activeTimer: 0 };
  } else if (id === "flame") {
    gameState.player.skills.flame = { id, rank: 1, radius: base.radius, timer: 0.1, tick: base.tick, damage: base.damage, burst: false, activeTimer: 0 };
  } else if (id === "guard") {
    gameState.player.skills.guard = { id, rank: 1, maxShield: base.shield, shield: base.shield, recharge: base.recharge, timer: 0, burst: false, activeTimer: 0 };
  }
  gameState.player.skillOrder.push(id);
  gameState.player.skillFocus[id] = (gameState.player.skillFocus[id] || 0) + 1;
}

function resetGame() {
  dom.startBtn.blur();
  const fresh = createState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  state.pendingShopResult = false;
  state.pendingShopMessage = "";
  unlockSkill(state, "sword");
  showOverlay(false);
  dom.startBtn.textContent = "重新开始";
  state.mode = "playing";
  state.running = true;
  state.phaseLabel = "混元试炼";
  closeModal();
  setToast("试炼开始");
  startCurrentStage();
  maybeOpenStarterChoice();
}

function getStageTargetKills() {
  return 12 + (state.campaign.runIndex - 1) * 5 + (state.campaign.stageIndex - 1) * 3;
}

function getEnemyProgressMult() {
  return 1 + (state.campaign.runIndex - 1) * 0.35 + (state.campaign.stageIndex - 1) * 0.14;
}

function clearCombatEntities() {
  state.enemies = [];
  state.projectiles = [];
  state.enemyProjectiles = [];
  state.drops = [];
  state.pulses = [];
  state.boss = null;
  state.bossFight = false;
  state.spawnTimer = 0.25;
}

function startCurrentStage() {
  clearCombatEntities();
  state.campaign.stageType = state.campaign.stageIndex === STAGES_PER_RUN ? "boss" : "small";
  state.campaign.stageKills = 0;
  state.campaign.targetKills = getStageTargetKills();
  state.campaign.miniBossSpawned = false;
  state.campaign.miniBossDefeated = false;
  state.campaign.bossSpawned = false;
  state.eliteIndex = state.eliteSchedule.length;
  state.player.x = WIDTH / 2;
  state.player.y = HEIGHT / 2;
  state.phaseLabel = `第${state.campaign.runIndex}轮 第${state.campaign.stageIndex}关`;
  if (state.campaign.stageType === "boss") spawnBoss();
}

function getNextStageLabel() {
  const nextStageIndex = state.campaign.stageIndex + 1;
  if (nextStageIndex === STAGES_PER_RUN) return `第${state.campaign.runIndex}轮 大Boss`;
  return `第${state.campaign.runIndex}轮 第${nextStageIndex}关`;
}

function buildStagePreparationHtml() {
  const equipped = getEquippedDestinyEntries();
  const backpack = getUnequippedOwnedDestinyEntries();
  const skillsHtml = state.player.skillOrder.length
    ? state.player.skillOrder.map((id, index) => {
      const skill = state.player.skills[id];
      const detail = id === "thunder"
        ? `Rank ${skill.rank} | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`
        : id === "sword"
          ? `Rank ${skill.rank} | ${skill.projectiles} 剑`
          : id === "guard"
            ? `Rank ${skill.rank} | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`
            : `Rank ${skill.rank} | 半径 ${Math.floor(skill.radius)}`;
      return `<div class="choice-card"><strong>${index + 1}. ${skills[id].name}</strong><span>${detail}</span></div>`;
    }).join("")
    : '<div class="choice-card"><strong>暂无法术</strong><span>当前没有已习得法术。</span></div>';
  const equippedHtml = equipped.length
    ? equipped.map((entry) => `<div class="choice-card"><strong>${entry.def.name}</strong><span>${getAlignmentLabel(entry.def.alignment)} | Lv.${entry.level}</span></div>`).join("")
    : '<div class="choice-card"><strong>未装备命格</strong><span>当前没有已装备命格。</span></div>';
  const backpackHtml = backpack.length
    ? backpack.map((entry) => `<div class="choice-card"><strong>${entry.def.name}</strong><span>${getAlignmentLabel(entry.def.alignment)} | Lv.${entry.level}</span></div>`).join("")
    : '<div class="choice-card"><strong>背包为空</strong><span>当前没有未装配命格。</span></div>';
  return `
    <div class="reincarnation-summary">
      <div class="summary-card"><div class="summary-label">下一场</div><div class="summary-value">${getNextStageLabel()}</div></div>
      <div class="summary-card"><div class="summary-label">已装备命格</div><div class="summary-value">${equipped.length}</div></div>
      <div class="summary-card"><div class="summary-label">背包命格</div><div class="summary-value">${backpack.length}</div></div>
      <div class="summary-card"><div class="summary-label">当前法术</div><div class="summary-value">${state.player.skillOrder.length}</div></div>
      <div class="summary-card"><div class="summary-label">白点化点</div><div class="summary-value">${state.whiteInfusionPoints}</div></div>
      <div class="summary-card"><div class="summary-label">黑点化点</div><div class="summary-value">${state.blackInfusionPoints}</div></div>
    </div>
    <div class="reincarnation-section-title">已装备命格</div>
    <div class="choice-list">${equippedHtml}</div>
    <div class="reincarnation-section-title">命格背包</div>
    <div class="choice-list">${backpackHtml}</div>
    <div class="reincarnation-section-title">当前法术</div>
    <div class="choice-list">${skillsHtml}</div>
  `;
}

function openReplaceEquippedModalForBackpack(backpackId) {
  const backpackEntry = metaState.destiny.owned[backpackId];
  const backpackDef = destinyCatalog[backpackId];
  if (!backpackEntry || !backpackDef) return;
  const currentSnapshot = createDestinyPreviewSnapshot(metaState.destiny.equipped);
  state.paused = true;
  state.currentModal = "replace-equipped";
  renderModal({
    title: "替换已装备命格",
    body: `选择一枚已装备命格，用 ${backpackDef.name} 替换。`,
    choices: getEquippedDestinyEntries().map((entry) => ({
      title: `替换 ${entry.def.name}`,
      body: (() => {
        const nextEquipped = metaState.destiny.equipped.map((id) => (id === entry.id ? backpackId : id));
        const nextSnapshot = createDestinyPreviewSnapshot(nextEquipped);
        return `${getAlignmentLabel(entry.def.alignment)} | Lv.${entry.level} -> ${backpackDef.name} ${getAlignmentLabel(backpackDef.alignment)} | Lv.${backpackEntry.level}<br>${describeDestinyStatDelta(currentSnapshot, nextSnapshot)}`;
      })(),
      onClick: () => {
        const index = metaState.destiny.equipped.indexOf(entry.id);
        if (index >= 0) metaState.destiny.equipped[index] = backpackId;
        saveMetaState();
        openStageLoadoutModal();
      },
    })),
    actions: [{
      label: "返回整备",
      onClick: () => openStagePreparationModal(),
    }],
    className: "reincarnation-modal",
  });
}

function openStageLoadoutModal() {
  const backpack = getUnequippedOwnedDestinyEntries();
  const equipped = getEquippedDestinyEntries();
  const currentSnapshot = createDestinyPreviewSnapshot(metaState.destiny.equipped);
  state.paused = true;
  state.currentModal = "stage-loadout";
  renderModal({
    title: "更换命格",
    body: "从命格背包中挑一枚进行装备；如果装备位已满，则选择一枚已装备命格进行替换。",
    bodyHtml: `
      <div class="reincarnation-summary">
        <div class="summary-card"><div class="summary-label">已装备命格</div><div class="summary-value">${equipped.length}/${metaState.destiny.maxSlots}</div></div>
        <div class="summary-card"><div class="summary-label">背包命格</div><div class="summary-value">${backpack.length}</div></div>
      </div>
    `,
    choices: backpack.length
      ? backpack.map((entry) => ({
        title: `${metaState.destiny.equipped.length < metaState.destiny.maxSlots ? "装备" : "替换为"} ${entry.def.name}`,
        body: metaState.destiny.equipped.length < metaState.destiny.maxSlots
          ? (() => {
            const nextSnapshot = createDestinyPreviewSnapshot([...metaState.destiny.equipped, entry.id]);
            return `${getAlignmentLabel(entry.def.alignment)} | Lv.${entry.level} | 直接装备到空位<br>${describeDestinyStatDelta(currentSnapshot, nextSnapshot)}`;
          })()
          : `${getAlignmentLabel(entry.def.alignment)} | Lv.${entry.level} | 选择后可查看每个替换方案的属性预览`,
        onClick: () => {
          if (metaState.destiny.equipped.length < metaState.destiny.maxSlots) {
            metaState.destiny.equipped.push(entry.id);
            saveMetaState();
            openStageLoadoutModal();
            return;
          }
          openReplaceEquippedModalForBackpack(entry.id);
        },
      }))
      : [{
        title: "暂无可更换命格",
        body: "命格背包为空，当前没有可装备或可替换的命格。",
        onClick: () => openStagePreparationModal(),
      }],
    actions: [{
      label: "返回整备",
      onClick: () => openStagePreparationModal(),
    }],
    className: "reincarnation-modal",
  });
}

function proceedToNextStage() {
  state.campaign.stageIndex += 1;
  closeModal();
  state.paused = false;
  startCurrentStage();
  maybeOpenPendingLevelUp();
}

function openNextBattleConfirmModal() {
  state.paused = true;
  state.currentModal = "stage-confirm";
  renderModal({
    title: "确认开战",
    body: `即将进入 ${getNextStageLabel()}。确认后将立刻开始战斗。`,
    choices: [{
      title: "确认进入下一战",
      body: "结束整备，立刻进入下一场战斗。",
      onClick: () => proceedToNextStage(),
    }],
    actions: [{
      label: "返回整备",
      onClick: () => openStagePreparationModal(),
    }],
    className: "reincarnation-modal",
  });
}

function openStagePreparationModal() {
  const canPointify = hasInfusionPoints() && getUnequippedOwnedDestinyEntries().length > 0;
  state.paused = true;
  state.currentModal = "stage-prep";
  renderModal({
    title: "战前整备",
    body: "击败小Boss后，先查看命格背包和当前法术；确认无误后再进入下一场战斗。",
    bodyHtml: buildStagePreparationHtml(),
    choices: [
      {
        title: "更换命格",
        body: "查看命格背包，并将背包命格装备到空位或替换已装备命格。",
        onClick: () => openStageLoadoutModal(),
      },
      {
        title: "道途点化",
        body: canPointify
          ? `消耗白/黑点化点重铸未装配命格。当前白点 ${state.whiteInfusionPoints} | 黑点 ${state.blackInfusionPoints}`
          : "当前没有可用点化点，或没有未装配命格可供点化。",
        onClick: () => {
          if (!canPointify) return;
          openDaoPointifyModal(() => openStagePreparationModal());
        },
        disabled: !canPointify,
      },
      {
        title: "前往确认开战",
        body: `查看完毕，准备进入 ${getNextStageLabel()}。`,
        onClick: () => openNextBattleConfirmModal(),
      },
    ],
    actions: [],
    className: "reincarnation-modal",
  });
}

function advanceCampaign() {
  if (state.campaign.stageIndex < STAGES_PER_RUN) {
    openStagePreparationModal();
    return;
  }
  openRunShopModal(false, `第${state.campaign.runIndex}轮已破，道途又进了一步。`);
}

function maybeOpenStarterChoice() {
  if (!(metaState.upgrades.starter > 0)) return;
  const options = ["thunder", "flame", "guard"]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  state.paused = true;
  state.currentModal = "starter";
  renderModal({
    title: "前世所悟",
    body: "选择一个额外开局术法，带着前世残悟重入轮回。",
    choices: options.map((id) => ({
      title: `习得${skills[id].name}`,
      body: skills[id].description,
      onClick: () => {
        unlockSkill(state, id);
        closeModal();
        state.paused = false;
        setToast(`前世所悟：${skills[id].name}`);
      },
    })),
  });
}

function saveAndRefreshShop(message = "") {
  saveMetaState();
  if (state.currentModal === "reincarnation" || state.result === RESULT_DEATH) {
    openReincarnationModal(state.result || RESULT_DEATH, state.lastRunPoints);
    return;
  }
  openRunShopModal(!!state.pendingShopResult, message || state.pendingShopMessage || "");
}

function continueInfusionFlow() {
  const continuation = pendingInfusionContinuation;
  pendingInfusionContinuation = null;
  if (typeof continuation === "function") continuation();
}

function maybeHandlePostBossInfusion(continuation) {
  if (hasInfusionPoints()) {
    openDaoPointifyModal(continuation);
    return true;
  }
  continuation();
  return false;
}

function acquireDestiny(id) {
  if (metaState.destiny.owned[id]) return;
  metaState.destiny.owned[id] = {
    level: 1,
  };
  if (metaState.destiny.equipped.length < metaState.destiny.maxSlots) {
    metaState.destiny.equipped.push(id);
    saveMetaState();
    setToast(`获得命格 ${destinyCatalog[id].name}`);
    advanceCampaign();
    return;
  }
  openEquipDestinyModal(id);
}

function openEquipDestinyModal(newId) {
  state.paused = true;
  state.currentModal = "equip-destiny";
  const choices = getEquippedDestinyEntries().map((entry) => ({
    title: `替换 ${entry.def.name}`,
    body: `以 ${destinyCatalog[newId].name} 取代当前装备位`,
    onClick: () => {
      const index = metaState.destiny.equipped.indexOf(entry.id);
      if (index >= 0) metaState.destiny.equipped[index] = newId;
      saveMetaState();
      closeModal();
      state.paused = false;
      advanceCampaign();
    },
  }));
  renderModal({
    title: "命盘已满",
    body: "选择一枚已装备命格进行替换，或先收入藏库。",
    choices,
    actions: [{
      label: "收入藏库",
      onClick: () => {
        saveMetaState();
        closeModal();
        state.paused = false;
        advanceCampaign();
      },
    }],
  });
}

function rollDaoPointifyAlignment(color, availableAlignments) {
  const table = DAO_POINTIFY_WEIGHTS[color] || DAO_POINTIFY_WEIGHTS.white;
  const filtered = table.filter((entry) => availableAlignments.includes(entry.value));
  if (!filtered.length) return availableAlignments[0] || "mixed";
  return weightedPick(filtered);
}

function pointifyDestiny(targetId, color) {
  const entry = metaState.destiny.owned[targetId];
  if (!entry) return;
  if (color === "white" && state.whiteInfusionPoints <= 0) return;
  if (color === "black" && state.blackInfusionPoints <= 0) return;
  const previousDef = destinyCatalog[targetId];
  if (!previousDef) return;
  const poolIds = Object.keys(destinyCatalog).filter((id) => id === targetId || !metaState.destiny.owned[id]);
  const availableAlignments = [...new Set(poolIds.map((id) => destinyCatalog[id].alignment))];
  const nextAlignment = rollDaoPointifyAlignment(color, availableAlignments);
  const candidateIds = poolIds.filter((id) => destinyCatalog[id].alignment === nextAlignment);
  const nextId = candidateIds[Math.floor(Math.random() * candidateIds.length)] || targetId;
  const nextDef = destinyCatalog[nextId];
  delete metaState.destiny.owned[targetId];
  metaState.destiny.owned[nextId] = { level: entry.level || 1 };
  if (color === "white") {
    state.whiteInfusionPoints -= 1;
  } else {
    state.blackInfusionPoints -= 1;
  }
  saveMetaState();
  openDaoPointifyResultModal({
    color,
    previousId: targetId,
    previousDef,
    nextId,
    nextDef,
    level: entry.level || 1,
  });
}

function openDaoPointifyModal(continuation = null) {
  if (continuation) pendingInfusionContinuation = continuation;
  const targets = getUnequippedOwnedDestinyEntries();
  if (!hasInfusionPoints()) {
    continueInfusionFlow();
    return;
  }
  if (!targets.length) {
    setToast("暂无未装配命格可供点化，本次机会保留。");
    continueInfusionFlow();
    return;
  }
  const choices = [];
  if (state.whiteInfusionPoints > 0) {
    choices.push({
      title: "白道点化",
      body: `消耗 1 点白点化点，重铸一枚未装配命格。当前白点化点：${state.whiteInfusionPoints}`,
      onClick: () => openDaoPointifyTargetModal("white"),
    });
  }
  if (state.blackInfusionPoints > 0) {
    choices.push({
      title: "黑道点化",
      body: `消耗 1 点黑点化点，重铸一枚未装配命格。当前黑点化点：${state.blackInfusionPoints}`,
      onClick: () => openDaoPointifyTargetModal("black"),
    });
  }
  if (!choices.length) {
    continueInfusionFlow();
    return;
  }
  state.paused = true;
  state.currentModal = "dao-pointify";
  renderModal({
    title: "道途点化",
    body: "消耗白/黑点化点，重铸一枚未装配命格。点化点来自局内黑白槽累计满槽次数，不消耗当前黑白槽。",
    bodyHtml: `
      <div class="reincarnation-summary dao-pointify-summary">
        <div class="summary-card">
          <div class="summary-label">可点化目标</div>
          <div class="summary-value">${targets.length}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">白点化点</div>
          <div class="summary-value">${state.whiteInfusionPoints}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">黑点化点</div>
          <div class="summary-value">${state.blackInfusionPoints}</div>
        </div>
      </div>
      <div class="dao-pointify-note">点化会将所选未装配命格放回命格池，并按对应颜色倾向随机重抽；点化后保留原等级。当前黑白槽只负责战斗状态，不会在此被消耗。</div>
    `,
    choices,
    className: "reincarnation-modal dao-pointify-modal",
    actions: [{
      label: "暂不点化",
      onClick: () => {
        closeModal();
        state.paused = false;
        continueInfusionFlow();
      },
    }],
  });
}

function openDaoPointifyTargetModal(color) {
  const targetEntries = getUnequippedOwnedDestinyEntries();
  renderModal({
    title: color === "white" ? "白道点化目标" : "黑道点化目标",
    body: `选择一枚未装配命格，消耗 1 点${color === "white" ? "白" : "黑"}点化点后按对应颜色进行重抽。`,
    bodyHtml: `
      <div class="reincarnation-summary dao-pointify-summary">
        <div class="summary-card">
          <div class="summary-label">重抽倾向</div>
          <div class="summary-value">${color === "white" ? "偏白" : "偏黑"}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">剩余点化点</div>
          <div class="summary-value">${color === "white" ? state.whiteInfusionPoints : state.blackInfusionPoints}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">等级保留</div>
          <div class="summary-value">是</div>
        </div>
      </div>
      <div class="dao-pointify-note">当前目标是你点击的那枚未装配命格。点化后会保留该命格的等级，再替换成新的命格结果。</div>
    `,
    choices: targetEntries.map((entry) => ({
      title: `${entry.def.name} [${getAlignmentLabel(entry.def.alignment)}]`,
      body: `当前目标 | 当前阵营 ${getAlignmentLabel(entry.def.alignment)} | 当前等级 Lv.${entry.level} | 保留等级：是<br>结果预览：${describePointifyPreview(entry.id, color)}`,
      onClick: () => pointifyDestiny(entry.id, color),
    })),
    className: "reincarnation-modal dao-pointify-modal",
    actions: [{
      label: "返回上一步",
      onClick: () => openDaoPointifyModal(),
    }],
  });
}

function openDaoPointifyResultModal({ color, previousId, previousDef, nextId, nextDef, level }) {
  const canContinuePointify = hasInfusionPoints() && getUnequippedOwnedDestinyEntries().length > 0;
  const resultChanged = previousId !== nextId;
  const resultSummary = resultChanged
    ? `${previousDef.name} 已重铸为 ${nextDef.name}`
    : `${previousDef.name} 在本次点化中维持原状`;
  state.paused = true;
  state.currentModal = "dao-pointify-result";
  renderModal({
    title: "点化结果",
    body: `${color === "white" ? "白道" : "黑道"}点化完成，${resultSummary}。`,
    bodyHtml: `
      <div class="reincarnation-summary dao-pointify-summary">
        <div class="summary-card">
          <div class="summary-label">点化颜色</div>
          <div class="summary-value">${color === "white" ? "白道" : "黑道"}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">保留等级</div>
          <div class="summary-value">Lv.${level}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">白点化点</div>
          <div class="summary-value">${state.whiteInfusionPoints}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">黑点化点</div>
          <div class="summary-value">${state.blackInfusionPoints}</div>
        </div>
      </div>
      <div class="dao-pointify-result-grid">
        <div class="summary-card dao-pointify-destiny-card">
          <div class="summary-label">点化前</div>
          <div class="summary-value">${previousDef.name}</div>
          <div class="dao-pointify-destiny-meta">${getAlignmentLabel(previousDef.alignment)} | Lv.${level}</div>
          <div class="dao-pointify-destiny-text">${previousDef.text[previousDef.alignment]}</div>
        </div>
        <div class="summary-card dao-pointify-destiny-card">
          <div class="summary-label">点化后</div>
          <div class="summary-value">${nextDef.name}</div>
          <div class="dao-pointify-destiny-meta">${getAlignmentLabel(nextDef.alignment)} | Lv.${level}</div>
          <div class="dao-pointify-destiny-text">${nextDef.text[nextDef.alignment]}</div>
        </div>
      </div>
      <div class="dao-pointify-note">
        当前战力不会立刻变化，因为点化目标来自未装配命格背包。${getPointifyEquipPreview(nextId)}
      </div>
    `,
    choices: canContinuePointify
      ? [{
        title: "继续点化",
        body: "还有剩余点化点或可点化命格，继续处理下一枚未装配命格。",
        onClick: () => openDaoPointifyModal(),
      }]
      : [],
    className: "reincarnation-modal dao-pointify-modal dao-pointify-result-modal",
    actions: [{
      label: "确认结果",
      onClick: () => {
        closeModal();
        state.paused = false;
        continueInfusionFlow();
      },
    }],
  });
}

function openStageDestinyOffer() {
  const offers = getRandomDestinyOffers(3);
  if (!offers.length) {
    advanceCampaign();
    return;
  }
  state.currentDestinyOffers = offers;
  state.paused = true;
  state.currentModal = "stage-destiny";
  renderModal({
    title: "道途进了一步",
    body: "击败小关首领后，从三枚命格中择一永久收入命盘。",
    choices: offers.map((offer) => ({
      title: `${destinyCatalog[offer.id].name} [${getAlignmentLabel(destinyCatalog[offer.id].alignment)}]`,
      body: destinyCatalog[offer.id].text[destinyCatalog[offer.id].alignment],
      onClick: () => {
        closeModal();
        state.paused = false;
        acquireDestiny(offer.id);
      },
    })),
    actions: [{
      label: "换取轮回点",
      onClick: () => {
        metaState.points += 2;
        saveMetaState();
        closeModal();
        state.paused = false;
        advanceCampaign();
      },
    }],
  });
}

function buyDestinyOffer(id) {
  const def = destinyCatalog[id];
  if (!def || metaState.points < def.baseCost || metaState.destiny.owned[id]) return;
  metaState.points -= def.baseCost;
  metaState.destiny.owned[id] = {
    level: 1,
  };
  saveAndRefreshShop(`购入 ${def.name}`);
}

function upgradeDestiny(id) {
  const entry = metaState.destiny.owned[id];
  const def = destinyCatalog[id];
  if (!entry || !def || entry.level >= def.maxLevel) return;
  const cost = def.upgradeCosts[entry.level - 1];
  if (metaState.points < cost) return;
  metaState.points -= cost;
  entry.level += 1;
  saveAndRefreshShop(`提升 ${def.name} 至 Lv.${entry.level}`);
}

function buildShopChoices() {
  const choices = [];
  getMissingDestinyIds().slice(0, 3).forEach((id) => {
    const def = destinyCatalog[id];
    choices.push({
      title: `购入 ${def.name}`,
      body: `花费 ${def.baseCost} 轮回点`,
      disabled: metaState.points < def.baseCost,
      onClick: () => buyDestinyOffer(id),
    });
  });
  getOwnedDestinyEntries().filter((entry) => entry.level < entry.def.maxLevel).slice(0, 3).forEach((entry) => {
    const cost = entry.def.upgradeCosts[entry.level - 1];
    choices.push({
      title: `升级 ${entry.def.name}`,
      body: `Lv.${entry.level} -> Lv.${entry.level + 1} | 花费 ${cost}`,
      disabled: metaState.points < cost,
      onClick: () => upgradeDestiny(entry.id),
    });
  });
  Object.entries(META.upgrades).slice(0, 3).forEach(([id, upgrade]) => {
    const level = metaState.upgrades[id] || 0;
    if (level >= upgrade.maxLevel) return;
    choices.push({
      title: `基础提升 ${upgrade.name}`,
      body: `Lv.${level}/${upgrade.maxLevel} | 花费 ${upgrade.cost}`,
      disabled: metaState.points < upgrade.cost,
      onClick: () => buyUpgrade(id),
    });
  });
  return choices.slice(0, 7);
}

function openRunShopModal(finalStep, message) {
  state.mode = finalStep ? "result" : "shop";
  state.running = false;
  state.paused = true;
  state.currentModal = "run-shop";
  state.pendingShopResult = finalStep;
  state.pendingShopMessage = message;
  const choices = buildShopChoices();
  renderModal({
    title: finalStep ? state.result : `第${state.campaign.runIndex}轮结算`,
    body: message || "整备命盘，准备进入下一轮试炼。",
    bodyHtml: `
      <div class="reincarnation-summary">
        <div class="summary-card"><div class="summary-label">轮回点</div><div class="summary-value">${metaState.points}</div></div>
        <div class="summary-card"><div class="summary-label">已拥有命格</div><div class="summary-value">${getOwnedDestinyEntries().length}</div></div>
        <div class="summary-card"><div class="summary-label">已装备命格</div><div class="summary-value">${metaState.destiny.equipped.length}</div></div>
        <div class="summary-card"><div class="summary-label">当前轮次</div><div class="summary-value">${state.campaign.runIndex}/${TOTAL_RUNS}</div></div>
      </div>
    `,
    choices,
    className: "reincarnation-modal",
    actions: [{
      label: finalStep ? "再入轮回" : "进入下一轮",
      onClick: () => {
        closeModal();
        state.paused = false;
        if (finalStep) resetGame();
        else {
          state.mode = "playing";
          state.running = true;
          state.campaign.runIndex += 1;
          state.campaign.stageIndex = 1;
          state.runStartTime = state.time;
          startCurrentStage();
        }
      },
    }],
  });
}

const levelChoices = [
  {
    id: "new-sword",
    name: "习得飞剑诀",
    desc: "获得自动追踪飞剑。",
    canTake: (stateRef) => !stateRef.player.skills.sword && stateRef.player.skillOrder.length < 3,
    apply: (stateRef) => unlockSkill(stateRef, "sword"),
  },
  {
    id: "new-thunder",
    name: "习得掌心雷",
    desc: "获得自动落雷术。",
    canTake: (stateRef) => !stateRef.player.skills.thunder && stateRef.player.skillOrder.length < 3,
    apply: (stateRef) => unlockSkill(stateRef, "thunder"),
  },
  {
    id: "new-flame",
    name: "习得火环术",
    desc: "获得近身持续火环。",
    canTake: (stateRef) => !stateRef.player.skills.flame && stateRef.player.skillOrder.length < 3,
    apply: (stateRef) => unlockSkill(stateRef, "flame"),
  },
  {
    id: "new-guard",
    name: "习得金钟罩",
    desc: "获得护盾和反震能力。",
    canTake: (stateRef) => !stateRef.player.skills.guard && stateRef.player.skillOrder.length < 3,
    apply: (stateRef) => unlockSkill(stateRef, "guard"),
  },
  {
    id: "sword-plus",
    name: "分光御剑",
    desc: "飞剑数量 +1。",
    canTake: (stateRef) => !!stateRef.player.skills.sword,
    apply: (stateRef) => {
      stateRef.player.skills.sword.projectiles += 1;
      stateRef.player.skills.sword.rank += 1;
      stateRef.player.skillFocus.sword += 1;
    },
  },
  {
    id: "sword-dmg",
    name: "御剑增幅",
    desc: "飞剑伤害 +35%。",
    canTake: (stateRef) => !!stateRef.player.skills.sword,
    apply: (stateRef) => {
      stateRef.player.skills.sword.damage *= 1.35;
      stateRef.player.skills.sword.rank += 1;
      stateRef.player.skillFocus.sword += 1;
    },
  },
  {
    id: "sword-pierce",
    name: "贯心",
    desc: "飞剑可穿透 1 个目标。",
    canTake: (stateRef) => !!stateRef.player.skills.sword,
    apply: (stateRef) => {
      stateRef.player.skills.sword.pierce += 1;
      stateRef.player.skills.sword.rank += 1;
      stateRef.player.skillFocus.sword += 1;
    },
  },
  {
    id: "thunder-fast",
    name: "疾雷",
    desc: "掌心雷冷却 -20%。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => {
      stateRef.player.skills.thunder.cooldown *= 0.8;
      stateRef.player.skills.thunder.rank += 1;
      stateRef.player.skillFocus.thunder += 1;
    },
  },
  {
    id: "thunder-dmg",
    name: "雷息加深",
    desc: "掌心雷伤害 +40%。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => {
      stateRef.player.skills.thunder.deepenStacks += 1;
      stateRef.player.skills.thunder.rank += 1;
      stateRef.player.skillFocus.thunder += 1;
    },
  },
  {
    id: "thunder-chain",
    name: "连锁惊雷",
    desc: "落雷会再弹射 2 个目标。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => {
      stateRef.player.skills.thunder.chain += 2;
      stateRef.player.skills.thunder.rank += 1;
      stateRef.player.skillFocus.thunder += 1;
    },
  },
  {
    id: "flame-radius",
    name: "炎环扩张",
    desc: "火环半径 +20%。",
    canTake: (stateRef) => !!stateRef.player.skills.flame,
    apply: (stateRef) => {
      stateRef.player.skills.flame.radius *= 1.2;
      stateRef.player.skills.flame.rank += 1;
      stateRef.player.skillFocus.flame += 1;
    },
  },
  {
    id: "flame-dmg",
    name: "烈焰",
    desc: "火环伤害 +30%。",
    canTake: (stateRef) => !!stateRef.player.skills.flame,
    apply: (stateRef) => {
      stateRef.player.skills.flame.damage *= 1.3;
      stateRef.player.skills.flame.rank += 1;
      stateRef.player.skillFocus.flame += 1;
    },
  },
  {
    id: "flame-burst",
    name: "焚爆",
    desc: "被点燃敌人死亡时会爆炸。",
    canTake: (stateRef) => !!stateRef.player.skills.flame && !stateRef.player.skills.flame.burst,
    apply: (stateRef) => {
      stateRef.player.skills.flame.burst = true;
      stateRef.player.skills.flame.rank += 1;
      stateRef.player.skillFocus.flame += 1;
    },
  },
  {
    id: "guard-strong",
    name: "厚钟",
    desc: "护盾值 +35%。",
    canTake: (stateRef) => !!stateRef.player.skills.guard,
    apply: (stateRef) => {
      stateRef.player.skills.guard.maxShield *= 1.35;
      stateRef.player.skills.guard.shield = Math.min(stateRef.player.skills.guard.maxShield, stateRef.player.skills.guard.shield * 1.35);
      stateRef.player.skills.guard.rank += 1;
      stateRef.player.skillFocus.guard += 1;
    },
  },
  {
    id: "guard-recharge",
    name: "金钟重铸",
    desc: "护盾恢复时间 -20%。",
    canTake: (stateRef) => !!stateRef.player.skills.guard,
    apply: (stateRef) => {
      stateRef.player.skills.guard.recharge *= 0.8;
      stateRef.player.skills.guard.rank += 1;
      stateRef.player.skillFocus.guard += 1;
    },
  },
  {
    id: "guard-burst",
    name: "震返",
    desc: "破盾时释放冲击波。",
    canTake: (stateRef) => !!stateRef.player.skills.guard && !stateRef.player.skills.guard.burst,
    apply: (stateRef) => {
      stateRef.player.skills.guard.burst = true;
      stateRef.player.skills.guard.rank += 1;
      stateRef.player.skillFocus.guard += 1;
    },
  },
  {
    id: "life",
    name: "炼体",
    desc: "最大生命 +25，当前回复 25。",
    canTake: () => true,
    apply: (stateRef) => {
      stateRef.player.maxHp += 25;
      stateRef.player.hp = Math.min(stateRef.player.maxHp, stateRef.player.hp + 25);
    },
  },
  {
    id: "cooldown",
    name: "凝神",
    desc: "全局冷却缩减 10%。",
    canTake: () => true,
    apply: (stateRef) => {
      stateRef.player.globalCooldown *= 0.9;
    },
  },
  {
    id: "pickup",
    name: "摄气",
    desc: "拾取范围 +30%。",
    canTake: () => true,
    apply: (stateRef) => {
      stateRef.player.pickupRange *= 1.3;
    },
  },
  {
    id: "crit",
    name: "破势",
    desc: "暴击率 +8%。",
    canTake: () => true,
    apply: (stateRef) => {
      stateRef.player.critChance += 0.08;
    },
  },
];

function scoreChoice(choice, main) {
  let score = 1;
  if (choice.id.startsWith("new-") && state.player.skillOrder.length < 3) score += 3;
  if (main && choice.id.includes(main)) score += 3;
  const skillTag = getChoiceSkillTag(choice);
  if (skillTag && state.player.skills[skillTag] && skillTag !== main) score += 2.5;
  if (choice.id === "life" && state.player.hp < state.player.maxHp * 0.55) score += 3;
  if (choice.id.startsWith("guard") && state.player.hp < state.player.maxHp * 0.6) score += 2;
  return score + Math.random();
}

function getChoiceSkillTag(choice) {
  const prefixes = ["sword", "thunder", "flame", "guard"];
  return prefixes.find((prefix) => choice.id === `new-${prefix}` || choice.id.startsWith(`${prefix}-`)) || null;
}

function availableChoices() {
  const pool = levelChoices.filter((choice) => choice.canTake(state));
  const main = chooseMainSkill(state);
  if (pool.length <= 3) return pool;

  const scoredPool = pool
    .map((choice) => ({ choice, score: scoreChoice(choice, main) }))
    .sort((a, b) => b.score - a.score);
  const picked = [];
  const pickedIds = new Set();

  const takeChoice = (entry) => {
    if (!entry || pickedIds.has(entry.choice.id) || picked.length >= 3) return;
    picked.push(entry.choice);
    pickedIds.add(entry.choice.id);
  };

  const learnedSkillEntries = state.player.skillOrder
    .map((skillId) => scoredPool.find((entry) => getChoiceSkillTag(entry.choice) === skillId && !entry.choice.id.startsWith("new-")))
    .filter(Boolean);

  learnedSkillEntries.forEach((entry) => takeChoice(entry));

  const newSkillEntry = scoredPool.find((entry) => entry.choice.id.startsWith("new-"));
  takeChoice(newSkillEntry);

  scoredPool.forEach((entry) => takeChoice(entry));

  return picked.slice(0, 3);
}

function openLevelUp() {
  state.paused = true;
  state.currentModal = "level";
  const choices = availableChoices();
  renderModal({
    title: "境界提升",
    body: "选择一项强化，继续你的修行构筑。",
    choices: choices.map((choice) => ({
      title: choice.name,
      body: choice.desc,
      onClick: () => {
        choice.apply(state);
        state.pendingLevelUps -= 1;
        closeModal();
        setToast(`获得 ${choice.name}`);
        if (state.pendingLevelUps > 0) openLevelUp();
        else state.paused = false;
      },
    })),
  });
}

function maybeOpenPendingLevelUp() {
  if (state.pendingLevelUps <= 0) return;
  if (state.currentModal) return;
  if (state.pendingMiniBossReward) return;
  if (state.mode !== "playing") return;
  openLevelUp();
}

function addXp(amount) {
  state.player.xp += amount * state.xpGainMult;
  while (state.player.xp >= xpNeeded(state.player.level)) {
    state.player.xp -= xpNeeded(state.player.level);
    state.player.level += 1;
    state.pendingLevelUps += 1;
  }
  maybeOpenPendingLevelUp();
}


function enemyHealthMult() {
  return getEnemyProgressMult();
}

function enemyDamageMult() {
  return 1 + (state.campaign.runIndex - 1) * 0.22 + (state.campaign.stageIndex - 1) * 0.1;
}

function spawnEnemy(typeName, forcedAlign = null) {
  const template = enemies[typeName];
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) { x = -30; y = Math.random() * HEIGHT; }
  if (edge === 1) { x = WIDTH + 30; y = Math.random() * HEIGHT; }
  if (edge === 2) { x = Math.random() * WIDTH; y = -30; }
  if (edge === 3) { x = Math.random() * WIDTH; y = HEIGHT + 30; }
  const color = forcedAlign || (Math.random() < 0.5 ? "white" : "black");
  state.enemies.push({
    type: typeName,
    x,
    y,
    hp: template.hp * enemyHealthMult(),
    maxHp: template.hp * enemyHealthMult(),
    damage: template.damage * enemyDamageMult(),
    speed: template.speed,
    radius: template.radius,
    color,
    shotTimer: (template.shotCooldown || 1.2) + Math.random() * 0.35,
    dashTimer: (template.dashCooldown || 1.4) + Math.random() * 0.5,
    attackTimer: template.meleeCooldown || 0.5,
    burn: 0,
  });
}

function spawnMiniBoss() {
  const template = enemies.elite;
  const color = Math.random() < 0.5 ? "white" : "black";
  state.enemies.push({
    type: "elite",
    x: WIDTH / 2,
    y: 90,
    hp: template.hp * enemyHealthMult() * 1.1,
    maxHp: template.hp * enemyHealthMult() * 1.1,
    damage: template.damage * enemyDamageMult(),
    speed: template.speed,
    radius: template.radius + 4,
    color,
    shotTimer: 0,
    dashTimer: 0,
    attackTimer: template.meleeCooldown || 0.5,
    burn: 0,
    isMiniBoss: true,
  });
  state.campaign.miniBossSpawned = true;
  setToast("小Boss现身");
}

function updateSpawn(dt) {
  if (state.bossFight || state.campaign.stageType === "boss" || state.campaign.miniBossSpawned) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const waveCount = 2 + state.campaign.runIndex + Math.min(3, state.campaign.stageIndex);
    for (let i = 0; i < waveCount; i += 1) {
      const roll = Math.random();
      if (roll < 0.55) spawnEnemy("grunt");
      else if (roll < 0.8) spawnEnemy("charger");
      else spawnEnemy("ranged");
    }
    const baseInterval = state.time < 180
      ? BALANCE.waves.spawnIntervalEarly
      : state.time < 360
        ? BALANCE.waves.spawnIntervalMid
        : BALANCE.waves.spawnIntervalLate;
    state.spawnTimer = Math.max(0.55, 1.75 - state.campaign.runIndex * 0.12 - state.campaign.stageIndex * 0.08);
  }
  while (state.eliteIndex < state.eliteSchedule.length && state.time >= state.eliteSchedule[state.eliteIndex]) {
    spawnEnemy("elite");
    state.eliteIndex += 1;
    setToast("精英护法现身");
  }
  if (!state.campaign.miniBossSpawned && state.campaign.stageKills >= state.campaign.targetKills) {
    spawnMiniBoss();
  }
}

function spawnBoss() {
  state.bossFight = true;
  state.phaseLabel = `第${state.campaign.runIndex}轮 大Boss`;
  state.enemies = [];
  state.enemyProjectiles = [];
  state.campaign.bossSpawned = true;
  const bossScale = 1 + (state.campaign.runIndex - 1) * 0.45;
  state.boss = {
    type: "boss",
    x: WIDTH / 2,
    y: 90,
    hp: enemies.boss.hp * bossScale,
    maxHp: enemies.boss.hp * bossScale,
    damage: enemies.boss.damage * (1 + (state.campaign.runIndex - 1) * 0.2),
    radius: enemies.boss.radius,
    phase: 1,
    attackTimer: enemies.boss.attackCooldowns.phase1,
    pattern: 0,
  };
  setToast("Boss 降临");
}

function nearestEnemies(count) {
  const targets = [...state.enemies];
  if (state.boss) targets.push(state.boss);
  return targets.sort((a, b) => distance(a, state.player) - distance(b, state.player)).slice(0, count);
}

function pulse(x, y, radius, damage, kind, affectsBoss = true) {
  const duration = kind === "flame" ? 0.32 : 0.18;
  state.pulses.push({
    x,
    y,
    radius,
    damage,
    kind,
    time: duration,
    duration,
    hit: new Set(),
    affectsBoss,
    followPlayer: kind === "flame",
  });
}

function dealDamage(target, amount, source = "player") {
  const finalAmount = amount * getExecuteDamageMult(target);
  target.hp -= finalAmount;
  if (source === "player" && distance(state.player, target) <= PATH_COMBAT.gain.meleeRange) {
    maybeTriggerBlackMomentum("close");
  }
  if (target.type === "boss" && target.hp <= target.maxHp * enemies.boss.phaseTwoAt && target.phase === 1) {
    target.phase = 2;
    target.attackTimer = 0.8;
    setToast("Boss 二阶段");
  }
  if (target.type === "boss" && target.hp <= target.maxHp * enemies.boss.phaseThreeAt && target.phase === 2) {
    target.phase = 3;
    target.attackTimer = 0.55;
    setToast("Boss 三阶段");
  }
  if (target.hp <= 0) {
    if (target.type === "boss") finishGame(RESULT_CLEAR);
    else killEnemy(target, source);
  }
}

function strikeEnemy(enemy, damage, source = state.player) {
  state.pulses.push({
    x: enemy.x,
    y: enemy.y,
    radius: 18,
    damage: 0,
    kind: "thunder",
    time: 0.15,
    hit: new Set(),
    fromX: source.x,
    fromY: source.y,
  });
  dealDamage(enemy, computeDamage(damage));
}

function castThunder(skill) {
  const target = nearestEnemies(1)[0];
  if (!target) return;
  const damage = getThunderDamage(skill);
  strikeEnemy(target, damage, state.player);
  state.enemies
    .filter((enemy) => enemy !== target)
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, skill.chain)
    .forEach((enemy) => strikeEnemy(enemy, damage * 0.65, target));
}

function castActiveThunder(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const radius = Math.min(WIDTH, HEIGHT) * 0.46;
  const extraDuration = hasGuardFocus() ? 1 : 0;
  const damage = getThunderDamage(skill);
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius,
    damage: computeDamage(damage * (1.55 + level * 0.22)),
    kind: "thunderstorm",
    time: 2 + extraDuration,
    duration: 2 + extraDuration,
    hit: new Set(),
    affectsBoss: true,
    tickTimer: 0.05,
    tickInterval: Math.max(0.16, 0.34 - level * 0.02),
    strikeCount: 2 + level,
  });
  setToast(`掌心雷·天罚 (${level})`);
  return true;
}

function castActiveSword(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const count = 8 + level * 2 + (hasGuardFocus() ? 1 : 0);
  const damage = computeDamage(skill.damage * (1.35 + level * 0.18));
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    state.projectiles.push({
      x: state.player.x + Math.cos(angle) * 18,
      y: state.player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 220,
      vy: Math.sin(angle) * 220,
      radius: 7,
      damage,
      pierce: 1 + Math.floor(level / 2),
      life: 2.8 + level * 0.18,
      color: "#e8d79c",
      kind: "sword-active",
      homing: true,
      turnRate: 7 + level * 0.4,
      speed: 220 + level * 18,
    });
  }
  setToast(`万剑归宗 (${level})`);
  return true;
}

function castActiveGuard(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const radius = 110 + level * 16;
  const damage = computeDamage(48 + skill.maxShield * 0.35 + level * 18);
  const pushScale = hasGuardFocus() ? 1.35 : 1;
  pulse(state.player.x, state.player.y, radius, damage, "guard");
  state.enemies.forEach((enemy) => {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist <= radius + enemy.radius) {
      const push = (36 + level * 12) * pushScale;
      enemy.x = clamp(enemy.x + (dx / dist) * push, 20, WIDTH - 20);
      enemy.y = clamp(enemy.y + (dy / dist) * push, 20, HEIGHT - 20);
    }
  });
  if (state.boss) {
    const dx = state.boss.x - state.player.x;
    const dy = state.boss.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist <= radius + state.boss.radius) {
      const push = (18 + level * 5) * pushScale;
      state.boss.x = clamp(state.boss.x + (dx / dist) * push, 80, WIDTH - 80);
      state.boss.y = clamp(state.boss.y + (dy / dist) * push, 60, HEIGHT - 60);
    }
  }
  setToast(`金钟震荡 (${level})`);
  return true;
}

function castActiveFlame(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const meteorCount = 2 + level;
  const waveCount = 3 + (hasGuardFocus() ? 1 : 0);
  const waveInterval = 0.7;
  const waveDuration = 0.7;
  const damage = computeDamage(skill.damage * (3 + level * 0.45));
  for (let wave = 0; wave < waveCount; wave += 1) {
    const startDelay = wave * waveInterval;
    for (let i = 0; i < meteorCount; i += 1) {
      const target = nearestEnemyFromPoint(state.player) || { x: state.player.x + (Math.random() * 160 - 80), y: state.player.y + (Math.random() * 120 - 60), radius: 0 };
      const jitterX = Math.random() * 80 - 40;
      const jitterY = Math.random() * 60 - 30;
      state.pulses.push({
        x: clamp(target.x + jitterX, 30, WIDTH - 30),
        y: clamp(target.y + jitterY, 30, HEIGHT - 30),
        radius: 52 + level * 5,
        damage,
        kind: "meteor",
        time: waveDuration,
        duration: waveDuration,
        startDelay,
        hit: new Set(),
        affectsBoss: true,
        fromX: clamp(target.x + jitterX * 0.4, 30, WIDTH - 30),
        fromY: -120 - (wave * meteorCount + i) * 36,
        impactAt: 0.72,
        landed: false,
      });
    }
  }
  setToast(`陨火天坠 (${level})`);
  return true;
}

function tryUseActiveSlot(slotIndex) {
  if (state.mode !== "playing" || state.paused || state.currentModal) return false;
  const skillId = state.player.skillOrder[slotIndex];
  if (!skillId) return false;
  const skill = state.player.skills[skillId];
  if (!skill || !isActiveUnlocked(skill) || skill.activeTimer > 0) return false;
  let fired = false;
  if (skillId === "thunder") fired = castActiveThunder(skill);
  else if (skillId === "sword") fired = castActiveSword(skill);
  else if (skillId === "guard") fired = castActiveGuard(skill);
  else if (skillId === "flame") fired = castActiveFlame(skill);
  if (!fired) return false;
  maybeTriggerBlackMomentum("active");
  skill.activeTimer = getActiveCooldown(skillId, getActiveLevel(skill));
  return true;
}

function updateSkills(dt) {
  const castScale = getCastMult();
  Object.values(state.player.skills).forEach((skill) => {
    if (typeof skill.activeTimer === "number") {
      skill.activeTimer = Math.max(0, skill.activeTimer - dt * getActiveCooldownRate());
    }
  });
  if (state.player.skills.sword) {
    const skill = state.player.skills.sword;
    skill.timer -= dt * castScale / state.player.globalCooldown;
    if (skill.timer <= 0) {
      const targets = nearestEnemies(skill.projectiles);
      targets.forEach((enemy) => {
        const dist = Math.max(1, distance(state.player, enemy));
        state.projectiles.push({
          x: state.player.x,
          y: state.player.y,
          vx: ((enemy.x - state.player.x) / dist) * 380,
          vy: ((enemy.y - state.player.y) / dist) * 380,
          radius: 6,
          damage: computeDamage(skill.damage),
          pierce: skill.pierce,
          life: 1.5,
          color: "#d8c88d",
          kind: "sword",
        });
      });
      skill.timer = skill.cooldown * state.player.globalCooldown;
    }
  }
  if (state.player.skills.thunder) {
    const skill = state.player.skills.thunder;
    skill.timer -= dt * castScale / state.player.globalCooldown;
    if (skill.timer <= 0) {
      castThunder(skill);
      skill.timer = skill.cooldown * state.player.globalCooldown;
    }
  }
  if (state.player.skills.flame) {
    const skill = state.player.skills.flame;
    skill.timer -= dt * castScale;
    if (skill.timer <= 0) {
      pulse(state.player.x, state.player.y, skill.radius, computeDamage(skill.damage), "flame");
      skill.timer = skill.tick;
    }
  }
  if (state.player.skills.guard) {
    const skill = state.player.skills.guard;
    if (skill.shield <= 0) {
      skill.timer -= dt;
      if (skill.timer <= 0) skill.shield = skill.maxShield;
    }
  }
}

function spawnDrops(enemy) {
  const eliteReward = enemy.type === "elite";
  state.drops.push({
    x: enemy.x,
    y: enemy.y,
    kind: "xp",
    value: enemies[enemy.type].xp,
    color: COLORS.xp,
    radius: 6,
    isEliteReward: eliteReward,
    isMiniBossReward: !!enemy.isMiniBoss,
  });
  const orbColor = enemy.color === "black" ? "white" : "black";
  state.drops.push({
    x: enemy.x + (Math.random() * 10 - 5),
    y: enemy.y + (Math.random() * 10 - 5),
    kind: "path",
    value: enemies[enemy.type].orb,
    color: orbColor,
    radius: 7,
    isEliteReward: eliteReward,
    isMiniBossReward: !!enemy.isMiniBoss,
  });
}

function triggerMiniBossRewardVacuum() {
  state.enemies = [];
  state.enemyProjectiles = [];
  state.drops.forEach((drop) => {
    drop.autoCollect = true;
  });
}

function killEnemy(enemy, source) {
  const index = state.enemies.indexOf(enemy);
  if (index >= 0) state.enemies.splice(index, 1);
  if (enemy.isMiniBoss) {
    state.campaign.miniBossDefeated = true;
    state.paused = false;
    state.pendingMiniBossReward = true;
  }
  addXp(enemies[enemy.type].xp);
  spawnDrops(enemy);
  state.totalKills += 1;
  if (!enemy.isMiniBoss) state.campaign.stageKills += 1;
  if (state.player.skills.flame?.burst && enemy.burn > 0) pulse(enemy.x, enemy.y, 44, state.player.skills.flame.damage * 2.2, "burst");
  maybeTriggerKillHeal();
  triggerBlackBurst(enemy);
  const eliteLike = enemy.type === "elite" || enemy.isMiniBoss;
  if (eliteLike && state.player.hp / Math.max(1, state.player.maxHp) > 0.75) {
    fillPath("white", PATH_COMBAT.gain.whiteEliteHighHpValue);
    setToast("白道进益：高气血斩精英");
  }
  if (
    state.player.hp / Math.max(1, state.player.maxHp) < PATH_COMBAT.gain.blackLowHpKillThreshold
    && state.blackLowHpKillCooldown <= 0
  ) {
    fillPath("black", PATH_COMBAT.gain.blackLowHpKillValue);
    state.blackLowHpKillCooldown = PATH_COMBAT.gain.blackLowHpKillCooldown;
  }
  if (eliteLike && distance(state.player, enemy) <= PATH_COMBAT.gain.meleeRange) {
    fillPath("black", PATH_COMBAT.gain.blackEliteMeleeValue);
    setToast("黑道进益：近身斩精英");
  }
  if (enemy.isMiniBoss) {
    triggerMiniBossRewardVacuum();
  }
}

function hitPlayer(amount) {
  if (state.player.invulnTimer > 0 || state.mode !== "playing") return;
  let incoming = amount * getIncomingMult();
  state.noHitTimer = 0;
  state.whiteUntouchedRewardTimer = 0;
  if (state.player.barrier > 0) {
    state.player.barrier -= incoming;
    if (state.player.barrier >= 0) {
      state.player.invulnTimer = baseStats.invuln;
      return;
    }
    incoming = Math.abs(state.player.barrier);
    state.player.barrier = 0;
  }
  const guard = state.player.skills.guard;
  if (guard && guard.shield > 0) {
    guard.shield -= incoming;
    if (guard.shield <= 0) {
      if (guard.burst) pulse(state.player.x, state.player.y, 80, 38, "guard");
      guard.timer = guard.recharge;
      incoming = Math.abs(guard.shield) * 0.35;
    } else {
      incoming *= 0.2;
    }
  }
  state.player.hp -= incoming;
  state.player.invulnTimer = baseStats.invuln;
  if (state.player.hp <= 0) finishGame(RESULT_DEATH);
}

function calculateRunPoints(result) {
  const runElapsed = Math.max(0, state.time - state.runStartTime);
  const fromTime = Math.floor(runElapsed / META.pointsFromTimeDivisor);
  const fromKills = Math.floor(state.totalKills / META.pointsFromKillsDivisor);
  const boss = result === "成仙" || result === "化魔" ? META.bossWinBonus : 0;
  return Math.max(1, fromTime + fromKills + boss);
}

function buyUpgrade(id) {
  const upgrade = META.upgrades[id];
  const level = metaState.upgrades[id] || 0;
  if (!upgrade || level >= upgrade.maxLevel || metaState.points < upgrade.cost) return;
  metaState.points -= upgrade.cost;
  metaState.upgrades[id] = level + 1;
  saveMetaState();
  saveAndRefreshShop(`基础属性 ${upgrade.name} 提升完成`);
}

function openReincarnationModal(result, gainedPoints) {
  state.currentModal = "reincarnation";
  const resultLabel = formatResultLabel(result);
  const lines = Object.entries(META.upgrades).map(([id, upgrade]) => {
    const level = metaState.upgrades[id] || 0;
    const locked = level >= upgrade.maxLevel;
    const effectText = id === "hp1"
      ? `开局生命 +${upgrade.effectPerLevel}`
      : id === "xp1"
        ? `经验获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
        : id === "pickup1"
          ? `拾取范围 +${Math.round(upgrade.effectPerLevel * 100)}%`
          : id === "white1"
            ? `白点获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
            : id === "black1"
              ? `黑点获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
              : "开局自选一个额外术法";
    return {
      title: `${upgrade.name}  Lv.${level}/${upgrade.maxLevel}${locked ? " | 已满" : ""}`,
      body: `${effectText} | 花费 ${upgrade.cost} 轮回点${metaState.points < upgrade.cost && !locked ? " | 轮回点不足" : ""}`,
      onClick: () => buyUpgrade(id),
      disabled: locked || metaState.points < upgrade.cost,
    };
  });

  const survived = formatTime(Math.max(0, state.time));
  const summaryHtml = `
    <div class="reincarnation-summary">
      <div class="summary-card">
        <div class="summary-label">本局结局</div>
        <div class="summary-value">${resultLabel}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">本局轮回点</div>
        <div class="summary-value">+${gainedPoints}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">当前轮回点</div>
        <div class="summary-value">${metaState.points}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">击杀数</div>
        <div class="summary-value">${state.totalKills}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">存活时间</div>
        <div class="summary-value">${survived}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总轮回次数</div>
        <div class="summary-value">${metaState.runs}</div>
      </div>
    </div>
    <div class="reincarnation-section-title">继承项</div>
  `;

  renderModal({
    title: result === "陨落" ? "轮回结算" : `结局：${result}`,
    body: `你已带着这一世的残痕返回轮回殿。购买继承项，或者立刻再入轮回。`,
    bodyHtml: summaryHtml,
    choices: lines,
    className: "reincarnation-modal",
    actions: [
      {
        label: "再入轮回",
        onClick: () => resetGame(),
      },
    ],
  });
}

function openEndingModal(result) {
  state.currentModal = "ending";
  const endingTheme = result.includes("成仙")
    ? "ending-modal ending-immortal"
    : result.includes("化魔")
      ? "ending-modal ending-demon"
      : "ending-modal ending-human";
  const title = result.includes("成仙")
    ? "你已成仙"
    : result.includes("化魔")
      ? "你已化魔"
      : "你成了人";
  const subtitle = result.includes("成仙")
    ? "白道命格占优，此世修行终证仙途。"
    : result.includes("化魔")
      ? "黑道命格占优，此世杀伐终入魔途。"
      : "最强混元命格改写了结局，你从仙魔之间走回人间。";
  const counts = getAlignmentCounts();
  renderModal({
    title,
    body: subtitle,
    bodyHtml: `
      <div class="ending-hero">
        <div class="ending-result">${result}</div>
        <div class="ending-copy">白道命格 ${counts.white} · 黑道命格 ${counts.black} · 混元命格 ${counts.mixed}</div>
        <div class="ending-copy">此世已终，轮回余烬归于命盘，下一世仍可继续修行。</div>
      </div>
    `,
    choices: [],
    actions: [
      {
        label: "重开试炼",
        onClick: () => resetGame(),
      },
    ],
    className: endingTheme,
  });
}

function finishGame(result) {
  if (result !== RESULT_DEATH) {
    const settleClear = () => {
      const finalResult = state.campaign.runIndex >= TOTAL_RUNS ? getAlignmentResult() : `第${state.campaign.runIndex}轮已破`;
      state.result = finalResult;
      state.lastRunPoints = calculateRunPoints(finalResult);
      metaState.points += state.lastRunPoints;
      metaState.runs += 1;
      metaState.bestKills = Math.max(metaState.bestKills, state.totalKills);
      metaState.lastResult = finalResult;
      saveMetaState();
      if (state.campaign.runIndex >= TOTAL_RUNS) {
        state.mode = "result";
        state.running = false;
        state.paused = true;
        openEndingModal(finalResult);
      } else {
        openRunShopModal(false, `第${state.campaign.runIndex}轮已破，道途又进了一步。`);
      }
    };
    if (state.campaign.stageType === "boss" && (state.whitePath.full || state.blackPath.full)) {
      maybeHandlePostBossInfusion(settleClear);
      return;
    }
    settleClear();
    return;
  }
  state.mode = "result";
  state.running = false;
  state.result = result;
  state.paused = true;
  state.pendingShopResult = false;
  state.pendingShopMessage = "";
  state.lastRunPoints = calculateRunPoints(result);
  metaState.points += state.lastRunPoints;
  metaState.runs += 1;
  metaState.bestKills = Math.max(metaState.bestKills, state.totalKills);
  metaState.lastResult = result;
  saveMetaState();
  openReincarnationModal(result, state.lastRunPoints);
}

function updatePlayer(dt) {
  const moveX = ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0);
  const moveY = ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  const len = Math.hypot(moveX, moveY) || 1;
  const moveSpeed = state.player.speed * getMoveMult();
  state.player.x = clamp(state.player.x + (moveX / len) * moveSpeed * dt, 20, WIDTH - 20);
  state.player.y = clamp(state.player.y + (moveY / len) * moveSpeed * dt, 20, HEIGHT - 20);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.regen * dt);
  state.player.invulnTimer = Math.max(0, state.player.invulnTimer - dt);
}

function updateProjectiles(dt) {
  state.projectiles = state.projectiles.filter((projectile) => {
    if (projectile.homing) {
      const target = nearestEnemyFromPoint(projectile);
      if (target) {
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const desiredVx = (dx / dist) * projectile.speed;
        const desiredVy = (dy / dist) * projectile.speed;
        const turn = clamp(projectile.turnRate * dt, 0, 1);
        projectile.vx += (desiredVx - projectile.vx) * turn;
        projectile.vy += (desiredVy - projectile.vy) * turn;
      }
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    let alive = projectile.life > 0 && projectile.x > -50 && projectile.x < WIDTH + 50 && projectile.y > -50 && projectile.y < HEIGHT + 50;
    state.enemies.forEach((enemy) => {
      if (!alive) return;
      if (distance(projectile, enemy) < projectile.radius + enemy.radius) {
        dealDamage(enemy, projectile.damage);
        if (projectile.pierce > 0) projectile.pierce -= 1;
        else alive = false;
      }
    });
    if (alive && state.boss && distance(projectile, state.boss) < projectile.radius + state.boss.radius) {
      dealDamage(state.boss, projectile.damage);
      if (projectile.pierce > 0) projectile.pierce -= 1;
      else alive = false;
    }
    return alive;
  });

  state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (distance(projectile, state.player) < projectile.radius + state.player.radius) {
      hitPlayer(projectile.damage);
      return false;
    }
    return projectile.life > 0;
  });
}

function updatePulses(dt) {
  state.pulses = state.pulses.filter((pulseItem) => {
    if (pulseItem.startDelay > 0) {
      pulseItem.startDelay = Math.max(0, pulseItem.startDelay - dt);
      return true;
    }
    if (pulseItem.followPlayer) {
      pulseItem.x = state.player.x;
      pulseItem.y = state.player.y;
    }
    if (pulseItem.kind === "thunderstorm") {
      pulseItem.tickTimer -= dt;
      while (pulseItem.tickTimer <= 0) {
        pulseItem.tickTimer += pulseItem.tickInterval;
        const targets = getTargetsWithinRadius(pulseItem, pulseItem.radius);
        if (!targets.length) break;
        const ordered = targets
          .sort((a, b) => distance(a, pulseItem) - distance(b, pulseItem))
          .slice(0, pulseItem.strikeCount);
        ordered.forEach((target, index) => {
          state.pulses.push({
            x: target.x,
            y: target.y,
            radius: 24,
            damage: 0,
            kind: "thunder",
            time: 0.18,
            duration: 0.18,
            hit: new Set(),
            fromX: target.x + (index % 2 === 0 ? -16 : 16),
            fromY: -90 - index * 16,
          });
          dealDamage(target, pulseItem.damage);
        });
      }
    }
    pulseItem.time -= dt;
    const duration = pulseItem.duration || 0.18;
    const scale = 1 - pulseItem.time / duration;
    if (pulseItem.kind === "meteor" && !pulseItem.landed && scale >= (pulseItem.impactAt || 0.72)) {
      pulseItem.landed = true;
    }
    const hitRadius = pulseItem.radius * clamp(scale, 0.2, 1);
    if (pulseItem.kind === "bosswave" && !pulseItem.hit.has(state.player) && distance(pulseItem, state.player) <= hitRadius + state.player.radius) {
      pulseItem.hit.add(state.player);
      hitPlayer(pulseItem.damage);
    }
    state.enemies.forEach((enemy) => {
      if (pulseItem.hit.has(enemy)) return;
      if (distance(pulseItem, enemy) <= hitRadius + enemy.radius) {
        if (pulseItem.damage > 0 && (pulseItem.kind !== "meteor" || pulseItem.landed)) {
          pulseItem.hit.add(enemy);
          dealDamage(enemy, pulseItem.damage);
          if (pulseItem.kind === "flame") enemy.burn = 2.5;
          if (pulseItem.kind === "meteor") enemy.burn = 4;
        }
      }
    });
    if (pulseItem.affectsBoss && state.boss && !pulseItem.hit.has(state.boss) && distance(pulseItem, state.boss) <= hitRadius + state.boss.radius) {
      if (pulseItem.damage > 0 && (pulseItem.kind !== "meteor" || pulseItem.landed)) {
        pulseItem.hit.add(state.boss);
        dealDamage(state.boss, pulseItem.damage);
      }
    }
    return pulseItem.time > 0;
  });
}

function updateEnemies(dt) {
  state.enemies.forEach((enemy) => {
    const template = enemies[enemy.type];
    if (enemy.burn > 0) {
      enemy.burn -= dt;
      dealDamage(enemy, 8 * dt);
    }
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const overlap = enemy.radius + state.player.radius - dist;
    enemy.attackTimer -= dt;
    if (enemy.type === "ranged") {
      enemy.shotTimer -= dt;
      if (dist > (template.preferredRange || 160)) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      }
      if (enemy.shotTimer <= 0) {
        state.enemyProjectiles.push({
          x: enemy.x,
          y: enemy.y,
          vx: (dx / dist) * (template.projectileSpeed || 180),
          vy: (dy / dist) * (template.projectileSpeed || 180),
          radius: 6,
          damage: enemy.damage,
          life: 3,
        });
        enemy.shotTimer = template.shotCooldown || 1.8;
      }
    } else if (enemy.type === "charger") {
      enemy.dashTimer -= dt;
      const speed = enemy.dashTimer < 0.28 ? enemy.speed * (template.dashSpeedMult || 2.1) : enemy.speed;
      if (overlap > 0) {
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        enemy.x += tangentX * enemy.speed * 0.7 * dt;
        enemy.y += tangentY * enemy.speed * 0.7 * dt;
      } else {
        enemy.x += (dx / dist) * speed * dt;
        enemy.y += (dy / dist) * speed * dt;
      }
      if (enemy.dashTimer <= 0) enemy.dashTimer = template.dashCooldown || 1.4;
    } else {
      if (overlap > 0) {
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        enemy.x += tangentX * enemy.speed * 0.55 * dt;
        enemy.y += tangentY * enemy.speed * 0.55 * dt;
      } else {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      }
    }
    if (overlap > 0 && enemy.attackTimer <= 0) {
      hitPlayer(enemy.damage);
      enemy.attackTimer = template.meleeCooldown || 0.5;
    }
  });
}

function updateBoss(dt) {
  if (!state.boss) return;
  const boss = state.boss;
  const dx = state.player.x - boss.x;
  const dy = state.player.y - boss.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const template = enemies.boss;
  const speedMult = boss.phase === 3 ? 1.4 : boss.phase === 2 ? 1.2 : 1;
  boss.x += (dx / dist) * enemies.boss.speed * speedMult * dt;
  boss.y += (dy / dist) * enemies.boss.speed * speedMult * dt;
  boss.attackTimer -= dt;
  if (distance(boss, state.player) < boss.radius + state.player.radius && boss.attackTimer <= 0.18) {
    hitPlayer(boss.damage);
  }
  if (boss.attackTimer <= 0) {
    boss.pattern = (boss.pattern + 1) % 3;
    if (boss.pattern === 0) {
      pulse(boss.x, boss.y, template.waveRadius, boss.damage * template.waveDamageMult, "bosswave", false);
    } else if (boss.pattern === 1) {
      for (let i = 0; i < template.radialProjectileCount; i += 1) {
        const angle = (Math.PI * 2 * i) / template.radialProjectileCount;
        state.enemyProjectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * template.radialProjectileSpeed,
          vy: Math.sin(angle) * template.radialProjectileSpeed,
          radius: 7,
          damage: boss.damage * 0.52,
          life: 4,
        });
      }
    } else {
      for (let i = 0; i < template.fanProjectileCount; i += 1) {
        const angle = Math.atan2(dy, dx) + (i - (template.fanProjectileCount - 1) / 2) * 0.18;
        state.enemyProjectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * template.fanProjectileSpeed,
          vy: Math.sin(angle) * template.fanProjectileSpeed,
          radius: 8,
          damage: boss.damage * 0.62,
          life: 4,
        });
      }
      const summonCount = boss.phase === 3 ? template.summonCountPhase3 : boss.phase === 2 ? template.summonCountPhase2 : 0;
      for (let i = 0; i < summonCount; i += 1) {
        spawnEnemy(i % 2 === 0 ? "charger" : "ranged", Math.random() < 0.5 ? "white" : "black");
      }
    }
    boss.attackTimer = boss.phase === 1 ? template.attackCooldowns.phase1 : boss.phase === 2 ? template.attackCooldowns.phase2 : template.attackCooldowns.phase3;
  }
}

function updateDrops(dt) {
  if (state.pendingMiniBossReward) {
    state.drops.forEach((drop) => {
      drop.autoCollect = true;
    });
  }
  state.drops = state.drops.filter((drop) => {
    const dist = distance(drop, state.player);
    const pickupRange = getPickupRange();
    const attract = getDropAttractProfile(drop);
    const inAttractRange = attract.radius > 0 && dist < attract.radius;
    if (drop.autoCollect || inAttractRange || dist < pickupRange) {
      const baseSpeed = drop.autoCollect ? 960 : inAttractRange ? Math.max(320, attract.speed) : 320;
      const speed = baseSpeed * dt;
      drop.x += ((state.player.x - drop.x) / Math.max(1, dist)) * speed;
      drop.y += ((state.player.y - drop.y) / Math.max(1, dist)) * speed;
    }
    if (dist < state.player.radius + drop.radius + 4) {
      if (drop.kind === "xp") addXp(drop.value);
      if (drop.kind === "path") fillPath(drop.color, drop.value);
      return false;
    }
    return true;
  });
  if (state.pendingMiniBossReward && state.drops.length === 0) {
    state.pendingMiniBossReward = false;
    maybeHandlePostBossInfusion(() => openStageDestinyOffer());
  }
}

function updateStatuses(dt) {
  state.statuses = state.statuses.filter((status) => {
    status.remaining -= dt;
    if (status.effects.drain) {
      state.player.hp -= state.player.maxHp * status.effects.drain * dt;
      if (state.player.hp <= 0) finishGame(RESULT_DEATH);
    }
    if (status.remaining > 0) return true;
    if (typeof status.effects.onExpire === "function") status.effects.onExpire();
    return false;
  });
}

function refreshPhase() {
  const prefix = `第${state.campaign.runIndex}轮 第${state.campaign.stageIndex}关`;
  if (state.bossFight) {
    state.phaseLabel = `第${state.campaign.runIndex}轮 大Boss`;
    return;
  }
  if (state.campaign.miniBossSpawned && !state.campaign.miniBossDefeated) {
    state.phaseLabel = `${prefix} 小Boss`;
    return;
  }
  state.phaseLabel = `${prefix} 击破 ${state.campaign.stageKills}/${state.campaign.targetKills}`;
}

function update(dt) {
  if (!state.running || state.paused) return;
  state.time += dt;
  updatePlayer(dt);
  updateSpawn(dt);
  updateSkills(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updatePulses(dt);
  updateDrops(dt);
  updateStatuses(dt);
  updatePathBehavior(dt);
  refreshPhase();
  render();
}

function drawGrid(ctx) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawArena(ctx) {
  const glow = 180 + Math.sin(state.time * 0.5) * 12;
  const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 320);
  gradient.addColorStop(0, "rgba(124, 224, 184, 0.06)");
  gradient.addColorStop(1, "rgba(124, 224, 184, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, glow, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrops(ctx) {
  state.drops.forEach((drop) => {
    ctx.fillStyle = drop.kind === "xp" ? COLORS.xp : drop.color === "white" ? COLORS.white : COLORS.black;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer(ctx) {
  if (state.player.skills.flame) {
    ctx.strokeStyle = "rgba(255, 146, 84, 0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.skills.flame.radius, 0, Math.PI * 2);
    ctx.stroke();
    const glow = ctx.createRadialGradient(state.player.x, state.player.y, 4, state.player.x, state.player.y, 26);
    glow.addColorStop(0, "rgba(255, 220, 150, 0.45)");
    glow.addColorStop(1, "rgba(255, 120, 60, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.player.skills.guard?.shield > 0) {
    ctx.strokeStyle = "rgba(204, 224, 255, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemies(ctx) {
  state.enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color === "white" ? COLORS.enemyWhite : COLORS.enemyBlack;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 4);
    ctx.fillStyle = "#89d3b4";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, (enemy.hp / enemy.maxHp) * enemy.radius * 2, 4);
  });
}

function drawBoss(ctx) {
  if (!state.boss) return;
  const boss = state.boss;
  ctx.fillStyle = COLORS.boss;
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,180,180,0.5)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(200, 18, 560, 12);
  ctx.fillStyle = "#d97878";
  ctx.fillRect(200, 18, 560 * (boss.hp / boss.maxHp), 12);
}

function drawSwordProjectile(ctx, projectile) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#efe2a3";
  ctx.strokeStyle = "#a7884b";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-3, -2.6);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-3, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff7cf";
  ctx.fillRect(-7, -1.2, 5, 2.4);
  ctx.fillStyle = "#d0b46c";
  ctx.fillRect(-9, -0.9, 2, 1.8);
  ctx.restore();
}

function drawProjectiles(ctx) {
  state.projectiles.forEach((projectile) => {
    if (projectile.kind === "sword" || projectile.kind === "sword-active") {
      drawSwordProjectile(ctx, projectile);
      return;
    }
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  state.enemyProjectiles.forEach((projectile) => {
    ctx.fillStyle = "#c66161";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawLightningPulse(ctx, pulseItem, alpha) {
  const startX = pulseItem.fromX ?? pulseItem.x;
  const startY = pulseItem.fromY ?? pulseItem.y;
  const endX = pulseItem.x;
  const endY = pulseItem.y;
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / dist;
  const ny = dx / dist;
  const segments = 5;

  ctx.save();
  ctx.strokeStyle = `rgba(152, 215, 255, ${alpha})`;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const jitter = (i % 2 === 0 ? -1 : 1) * 8 * alpha;
    ctx.lineTo(startX + dx * t + nx * jitter, startY + dy * t + ny * jitter);
  }
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.strokeStyle = `rgba(235, 250, 255, ${alpha * 0.75})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

function drawThunderstormPulse(ctx, pulseItem, alpha) {
  ctx.save();
  ctx.strokeStyle = `rgba(124, 196, 255, ${alpha * 0.45})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(88, 148, 255, ${alpha * 0.08})`;
  ctx.beginPath();
  ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius, 0, Math.PI * 2);
  ctx.fill();

  const sparks = 6;
  for (let i = 0; i < sparks; i += 1) {
    const angle = (Math.PI * 2 * i) / sparks + pulseItem.time * 3.2;
    const dist = pulseItem.radius * (0.25 + (i % 3) * 0.2);
    const x = pulseItem.x + Math.cos(angle) * dist;
    const y = pulseItem.y + Math.sin(angle) * dist;
    ctx.strokeStyle = `rgba(210, 242, 255, ${alpha * 0.65})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 10);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x - 3, y + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlamePulse(ctx, pulseItem, alpha) {
  const duration = pulseItem.duration || 0.18;
  const progress = clamp(1 - pulseItem.time / duration, 0, 1);
  const radius = pulseItem.radius * progress;
  const tongues = 14;

  ctx.save();
  ctx.translate(pulseItem.x, pulseItem.y);
  for (let i = 0; i < tongues; i += 1) {
    const angle = (Math.PI * 2 * i) / tongues + progress * 0.8;
    const tip = radius + 10 + Math.sin(progress * 8 + i) * 3;
    const base = Math.max(6, radius - 8);
    const spread = 0.11;

    ctx.fillStyle = `rgba(255, 127, 54, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle - spread) * base, Math.sin(angle - spread) * base);
    ctx.quadraticCurveTo(Math.cos(angle) * (radius + 4), Math.sin(angle) * (radius + 4), Math.cos(angle) * tip, Math.sin(angle) * tip);
    ctx.quadraticCurveTo(Math.cos(angle + spread) * (radius + 4), Math.sin(angle + spread) * (radius + 4), Math.cos(angle + spread) * base, Math.sin(angle + spread) * base);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(255, 204, 118, ${alpha * 0.95})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 94, 45, ${alpha * 0.75})`;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(4, radius - 3), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMeteorPulse(ctx, pulseItem, alpha) {
  const duration = pulseItem.duration || 0.5;
  const progress = clamp(1 - pulseItem.time / duration, 0, 1);
  const impactAt = pulseItem.impactAt || 0.72;
  const startX = pulseItem.fromX ?? pulseItem.x;
  const startY = pulseItem.fromY ?? -120;
  const endX = pulseItem.x;
  const endY = pulseItem.y;
  const travel = clamp(progress / impactAt, 0, 1);
  const meteorX = startX + (endX - startX) * travel;
  const meteorY = startY + (endY - startY) * travel;

  ctx.save();
  if (progress < impactAt) {
    ctx.strokeStyle = `rgba(255, 155, 92, ${alpha * 0.45})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(meteorX, meteorY);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 196, 121, ${alpha})`;
    ctx.beginPath();
    ctx.arc(meteorX, meteorY, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  if (progress >= impactAt) {
    const shock = clamp((progress - impactAt) / (1 - impactAt), 0, 1);
    ctx.strokeStyle = `rgba(255, 176, 84, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(endX, endY, pulseItem.radius * shock, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 110, 56, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 14 + shock * 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPulses(ctx) {
  state.pulses.forEach((pulseItem) => {
    if (pulseItem.startDelay > 0) return;
    const duration = pulseItem.duration || 0.18;
    const alpha = clamp(pulseItem.time / duration, 0, 1);
    if (pulseItem.kind === "thunder") {
      drawLightningPulse(ctx, pulseItem, alpha);
      return;
    }
    if (pulseItem.kind === "thunderstorm") {
      drawThunderstormPulse(ctx, pulseItem, alpha);
      return;
    }
    if (pulseItem.kind === "flame") {
      drawFlamePulse(ctx, pulseItem, alpha);
      return;
    }
    if (pulseItem.kind === "meteor") {
      drawMeteorPulse(ctx, pulseItem, alpha);
      return;
    }
    ctx.strokeStyle = pulseItem.kind === "thunder"
      ? `rgba(131, 197, 255, ${alpha})`
      : pulseItem.kind === "flame"
        ? `rgba(255, 130, 66, ${alpha})`
        : `rgba(226, 204, 142, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
    ctx.stroke();
  });
}

function renderSkillBar() {
  const slots = state.player.skillOrder.map((id) => {
    const skill = state.player.skills[id];
    const template = skills[id];
    const slotIndex = state.player.skillOrder.indexOf(id) + 1;
    const activeLevel = getActiveLevel(skill);
    const activeText = activeLevel > 0
      ? (skill.activeTimer > 0 ? `主动 ${slotIndex}键 ${skill.activeTimer.toFixed(1)}s` : `主动 ${slotIndex}键 就绪`)
      : `主动 ${slotIndex}键 ${ACTIVE_UNLOCK_RANK}阶解锁`;
    let detail = `Rank ${skill.rank}`;
    if (id === "guard") detail += ` | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`;
    else if (id === "sword") detail += ` | ${skill.projectiles} 剑`;
    else if (id === "thunder") detail += ` | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`;
    else if (id === "flame") detail += ` | 半径 ${Math.floor(skill.radius)}`;
    return `<div class="skill-card"><div class="skill-name">${slotIndex}. ${template.name}</div><div class="skill-detail">${detail}<br>${activeText}<br>${template.description}</div></div>`;
  });
  while (slots.length < 3) {
    slots.push('<div class="skill-card"><div class="skill-name">空术法位</div><div class="skill-detail">升级时可获得新的主动术法。</div></div>');
  }
  dom.skillBar.innerHTML = slots.join("");
}

function updateHud() {
  dom.healthFill.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
  dom.healthText.textContent = `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`;
  dom.levelText.textContent = state.player.level;
  dom.xpFill.style.width = `${(state.player.xp / xpNeeded(state.player.level)) * 100}%`;
  dom.xpText.textContent = `${Math.floor(state.player.xp)} / ${xpNeeded(state.player.level)}`;
  dom.timerText.textContent = `R${state.campaign.runIndex}-${state.campaign.stageIndex}`;
  dom.phaseText.textContent = state.phaseLabel;
  dom.whiteFill.style.width = `${(state.whitePath.value / state.whitePath.cap) * 100}%`;
  dom.blackFill.style.width = `${(state.blackPath.value / state.blackPath.cap) * 100}%`;
  dom.whiteText.textContent = `${Math.floor(state.whitePath.value)} / ${state.whitePath.cap}`;
  dom.blackText.textContent = `${Math.floor(state.blackPath.value)} / ${state.blackPath.cap}`;
  dom.whiteStageText.textContent = state.whitePath.full ? "白槽已满" : "白槽推进";
  dom.blackStageText.textContent = state.blackPath.full ? "黑槽已满" : "黑槽推进";
  dom.statusList.innerHTML = "";
  const statusLabels = state.statuses.map((item) => `${item.name} ${item.remaining.toFixed(1)}s`);
  statusLabels.push(`白命格 ${counts.white}`);
  statusLabels.push(`黑命格 ${counts.black}`);
  statusLabels.slice(0, 6).forEach((label) => {
    const pill = document.createElement("div");
    pill.className = "status-pill";
    pill.textContent = label;
    dom.statusList.appendChild(pill);
  });
  renderSkillBar();
}

function render() {
  const ctx = dom.ctx;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawGrid(ctx);
  drawArena(ctx);
  drawDrops(ctx);
  drawPlayer(ctx);
  drawEnemies(ctx);
  drawProjectiles(ctx);
  drawPulses(ctx);
  drawBoss(ctx);
  updateHud();
}

function resizeCanvas() {
  if (!document.fullscreenElement) {
    dom.canvas.width = WIDTH;
    dom.canvas.height = HEIGHT;
    return;
  }
  dom.canvas.width = window.innerWidth - 40;
  dom.canvas.height = Math.floor((window.innerWidth - 40) * 9 / 16);
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await dom.canvas.requestFullscreen();
}

function fillPath(color, amount) {
  const path = color === "white" ? state.whitePath : state.blackPath;
  const gainMult = color === "white" ? state.whiteGainMult : state.blackGainMult;
  if (path.full) return;
  const previousValue = path.value;
  path.value = Math.min(path.cap, path.value + amount * gainMult);
  maybeTriggerPathThresholds(path, previousValue);
}

function describePathStage(path) {
  if (path.full) return `已满槽 ${path.color === "white" ? "Q" : "E"} 释放`;
  if (path.value >= PATH_THRESHOLDS.tier2) return "2/3 已触发";
  if (path.value >= PATH_THRESHOLDS.tier1) return "1/3 已触发";
  return `下一节点 ${path.value < PATH_THRESHOLDS.tier1 ? PATH_THRESHOLDS.tier1 : PATH_THRESHOLDS.tier2}`;
}

function refreshPhase() {
  const prefix = `第${state.campaign.runIndex}轮 第${state.campaign.stageIndex}关`;
  if (state.bossFight) {
    state.phaseLabel = `第${state.campaign.runIndex}轮 大Boss`;
    return;
  }
  if (state.campaign.miniBossSpawned && !state.campaign.miniBossDefeated) {
    state.phaseLabel = `${prefix} 小Boss`;
    return;
  }
  state.phaseLabel = `${prefix} 击破 ${state.campaign.stageKills}/${state.campaign.targetKills}`;
}

function updateHud() {
  dom.healthFill.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
  dom.healthText.textContent = `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`;
  dom.levelText.textContent = state.player.level;
  dom.xpFill.style.width = `${(state.player.xp / xpNeeded(state.player.level)) * 100}%`;
  dom.xpText.textContent = `${Math.floor(state.player.xp)} / ${xpNeeded(state.player.level)}`;
  dom.timerText.textContent = `R${state.campaign.runIndex}-${state.campaign.stageIndex}`;
  dom.phaseText.textContent = state.phaseLabel;
  dom.whiteFill.style.width = `${(state.whitePath.value / state.whitePath.cap) * 100}%`;
  dom.blackFill.style.width = `${(state.blackPath.value / state.blackPath.cap) * 100}%`;
  dom.whiteText.textContent = `${Math.floor(state.whitePath.value)} / ${state.whitePath.cap}`;
  dom.blackText.textContent = `${Math.floor(state.blackPath.value)} / ${state.blackPath.cap}`;
  dom.whiteStageText.textContent = describePathStage(state.whitePath);
  dom.blackStageText.textContent = describePathStage(state.blackPath);
  dom.statusList.innerHTML = "";
  const counts = getAlignmentCounts();
  const statusLabels = state.statuses.map((item) => `${item.name} ${item.remaining.toFixed(1)}s`);
  if (state.player.barrier > 0) statusLabels.push(`护体 ${Math.ceil(state.player.barrier)}`);
  if (state.blackMomentumStacks > 0 && state.blackMomentumTimer > 0) {
    statusLabels.push(`袭势 ${state.blackMomentumStacks}层 ${state.blackMomentumTimer.toFixed(1)}s`);
  }
  statusLabels.push(`白点化 ${state.whiteInfusionPoints}`);
  statusLabels.push(`黑点化 ${state.blackInfusionPoints}`);
  statusLabels.push(`白命格 ${counts.white}`);
  statusLabels.push(`黑命格 ${counts.black}`);
  statusLabels.push(`混元命格 ${counts.mixed}`);
  statusLabels.slice(0, 6).forEach((label) => {
    const pill = document.createElement("div");
    pill.className = "status-pill";
    pill.textContent = label;
    dom.statusList.appendChild(pill);
  });
  renderSkillBar();
}

function renderGameToText() {
  return JSON.stringify({
    mode: state.mode,
    phase: state.phaseLabel,
    run_stage: `run-${state.campaign.runIndex}-stage-${state.campaign.stageIndex}`,
    total_time: formatTime(Math.max(0, state.time)),
    coordinate_system: "origin top-left, x right, y down",
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      hp: Math.round(state.player.hp),
      max_hp: Math.round(state.player.maxHp),
      barrier: Math.round(state.player.barrier),
      level: state.player.level,
      skills: state.player.skillOrder.map((id) => ({ id, rank: state.player.skills[id].rank })),
    },
    paths: {
      white: { value: Math.round(state.whitePath.value), cap: state.whitePath.cap, full: state.whitePath.full, stage: describePathStage(state.whitePath) },
      black: { value: Math.round(state.blackPath.value), cap: state.blackPath.cap, full: state.blackPath.full, stage: describePathStage(state.blackPath) },
    },
    infusion_points: {
      white: state.whiteInfusionPoints,
      black: state.blackInfusionPoints,
    },
    destinies: {
      owned: getOwnedDestinyEntries().map((entry) => ({ id: entry.id, level: entry.level, alignment: entry.def.alignment })),
      equipped: metaState.destiny.equipped,
    },
    enemy_count: state.enemies.length,
    statuses: state.statuses.map((status) => ({ name: status.name, remaining: Number(status.remaining.toFixed(1)) })),
    visible_enemies: state.enemies.slice(0, 8).map((enemy) => ({
      type: enemy.type,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      hp: Math.round(enemy.hp),
      color: enemy.color,
    })),
    boss: state.boss ? { hp: Math.round(state.boss.hp), phase: state.boss.phase } : null,
    pending_levelups: state.pendingLevelUps,
    current_modal: state.currentModal,
    meta: {
      points: metaState.points,
      upgrades: metaState.upgrades,
      runs: metaState.runs,
      last_result: metaState.lastResult,
    },
  });
}

window.render_game_to_text = renderGameToText;
window.__debug_setup_mini_boss_reward_flow = (color = "white") => {
  metaState.destiny.owned = {
    vital: { level: 2 },
    blade: { level: 1 },
    river: { level: 1 },
  };
  metaState.destiny.equipped = ["vital", "blade"];
  saveMetaState();
  resetGame();
  closeModal();
  state.paused = false;
  state.currentModal = null;
  state.pendingLevelUps = 0;
  state.campaign.stageIndex = 1;
  state.campaign.stageType = "small";
  state.campaign.miniBossSpawned = true;
  state.campaign.miniBossDefeated = true;
  state.pendingMiniBossReward = true;
  state.enemies = [];
  state.enemyProjectiles = [];
  state.drops = [
    { x: state.player.x + 80, y: state.player.y, kind: "xp", value: 4, color: COLORS.xp, radius: 6, autoCollect: false },
    { x: state.player.x - 70, y: state.player.y + 20, kind: "path", value: 8, color, radius: 7, autoCollect: false },
  ];
  state.whitePath.value = color === "white" ? state.whitePath.cap : 0;
  state.whitePath.full = color === "white";
  state.blackPath.value = color === "black" ? state.blackPath.cap : 0;
  state.blackPath.full = color === "black";
  state.whiteInfusionPoints = color === "white" ? 1 : 0;
  state.blackInfusionPoints = color === "black" ? 1 : 0;
  render();
  return renderGameToText();
};
window.advanceTime = (ms) => {
  const step = 1000 / 60;
  const count = Math.max(1, Math.round(ms / step));
  for (let i = 0; i < count; i += 1) update(step / 1000);
  render();
};

function gameLoop(ts) {
  if (!state.realLast) state.realLast = ts;
  const dt = Math.min(0.033, (ts - state.realLast) / 1000);
  state.realLast = ts;
  update(dt);
  if (state.mode !== "menu") render();
  requestAnimationFrame(gameLoop);
}

dom.startBtn.addEventListener("click", resetGame);

showOverlay(true);
render();
requestAnimationFrame(gameLoop);
