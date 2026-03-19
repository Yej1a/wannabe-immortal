const WIDTH = 960;
const HEIGHT = 540;
const BALANCE = window.GAME_BALANCE;
const GAME_DURATION = BALANCE.progression.duration;
const FIRST_PATH_CAP = BALANCE.progression.firstPathCap;
const META = BALANCE.reincarnationTable;

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

const destinyCatalog = {
  vital: {
    id: "vital",
    name: "命元诀",
    tier: "common",
    category: "combat",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升最大生命与回复。",
      black: "提升伤害。",
      neutral: "提升拾取范围。",
    },
  },
  spirit: {
    id: "spirit",
    name: "聚灵印",
    tier: "common",
    category: "support",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升经验获取。",
      black: "提升暴击率。",
      neutral: "提升移动速度。",
    },
  },
  river: {
    id: "river",
    name: "归元息",
    tier: "common",
    category: "support",
    baseCost: 8,
    maxLevel: 3,
    upgradeCosts: [6, 10],
    text: {
      white: "提升白槽获取。",
      black: "提升黑槽获取。",
      neutral: "同时微量提升黑白槽获取。",
    },
  },
  blade: {
    id: "blade",
    name: "剑意骨",
    tier: "true",
    category: "combat",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升护体与减伤。",
      black: "提升暴伤与输出。",
      neutral: "少量提升冷却效率。",
    },
  },
  thunder: {
    id: "thunder",
    name: "惊雷纹",
    tier: "true",
    category: "combat",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升回复与经验。",
      black: "提升伤害与施法频率。",
      neutral: "提升移动速度与拾取。",
    },
  },
  ward: {
    id: "ward",
    name: "护命符",
    tier: "true",
    category: "support",
    baseCost: 20,
    maxLevel: 3,
    upgradeCosts: [12, 18],
    text: {
      white: "提升最大生命与白道收益。",
      black: "提升暴击与黑道收益。",
      neutral: "提升基础增伤。",
    },
  },
  reaper: {
    id: "reaper",
    name: "修罗契",
    tier: "fate",
    category: "combat",
    baseCost: 42,
    maxLevel: 3,
    upgradeCosts: [20, 28],
    text: {
      white: "高额提升生存。",
      black: "高额提升伤害与暴击。",
      neutral: "均衡提升输出与资源。",
    },
  },
  lotus: {
    id: "lotus",
    name: "净世莲",
    tier: "fate",
    category: "support",
    baseCost: 42,
    maxLevel: 3,
    upgradeCosts: [20, 28],
    text: {
      white: "高额提升回复与经验。",
      black: "高额提升黑槽与爆发。",
      neutral: "高额提升移动与拾取。",
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
    baseDamage: 40,
    splash: 54,
  },
  flame: {
    id: "flame",
    name: "火环术",
    description: "环身火域持续灼烧近身敌人。",
    radius: 90,
    tick: 0.5,
    damage: 12,
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
  sword: { baseCooldown: 18 },
  thunder: { baseCooldown: 16 },
  guard: { baseCooldown: 18 },
  flame: { baseCooldown: 20 },
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

function getPolarityCounts() {
  const counts = { white: 0, black: 0, neutral: 0 };
  getEquippedDestinyEntries().forEach((entry) => {
    counts[entry.currentPolarity || "neutral"] += 1;
  });
  return counts;
}

function getAlignmentResult() {
  if (state.whitePath.value === state.blackPath.value) {
    const counts = getPolarityCounts();
    if (counts.black > counts.white) return "鍖栭瓟";
    return "鎴愪粰";
  }
  return state.whitePath.value > state.blackPath.value ? "鎴愪粰" : "鍖栭瓟";
}

function getDestinyWeight(polarity) {
  let weight = polarity === "neutral" ? 0.9 : 1;
  const counts = getPolarityCounts();
  if (polarity === "white" && state.whitePath.full) weight *= 1.1;
  if (polarity === "black" && state.blackPath.full) weight *= 1.1;
  if (polarity === "white" && counts.white >= 2) weight *= 1.25;
  if (polarity === "black" && counts.black >= 2) weight *= 1.25;
  if (polarity === "white" && counts.white >= 4) weight *= 1.6;
  if (polarity === "black" && counts.black >= 4) weight *= 1.6;
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

function rollDestinyPolarity() {
  return weightedPick([
    { value: "white", weight: getDestinyWeight("white") },
    { value: "black", weight: getDestinyWeight("black") },
    { value: "neutral", weight: getDestinyWeight("neutral") },
  ]);
}

function getMissingDestinyIds() {
  return Object.keys(destinyCatalog).filter((id) => !metaState.destiny.owned[id]);
}

function getRandomDestinyOffers(count = 3) {
  const pool = getMissingDestinyIds();
  const offers = [];
  while (pool.length > 0 && offers.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const id = pool.splice(index, 1)[0];
    offers.push({ id, polarity: rollDestinyPolarity() });
  }
  return offers;
}

function describeDestiny(id, polarity, level = 1) {
  const def = destinyCatalog[id];
  return `${def.name} [${polarity}] Lv.${level} - ${def.text[polarity]}`;
}

function formatResultLabel(result) {
  if (result === RESULT_DEATH) return "陨落";
  if (result === RESULT_CLEAR) return "閫氬叧";
  return result;
}

function applyDestinyBonuses(player, mods) {
  getEquippedDestinyEntries().forEach((entry) => {
    const level = entry.level || 1;
    const polarity = entry.currentPolarity || "neutral";
    switch (entry.id) {
      case "vital":
        if (polarity === "white") {
          player.maxHp += 18 * level;
          player.regen += 0.08 * level;
        } else if (polarity === "black") {
          mods.damageMult += 0.06 * level;
        } else {
          player.pickupRange += 10 * level;
        }
        break;
      case "spirit":
        if (polarity === "white") mods.xpGainMult += 0.1 * level;
        else if (polarity === "black") player.critChance += 0.04 * level;
        else player.speed += 10 * level;
        break;
      case "river":
        if (polarity === "white") mods.whiteGainMult += 0.12 * level;
        else if (polarity === "black") mods.blackGainMult += 0.12 * level;
        else {
          mods.whiteGainMult += 0.05 * level;
          mods.blackGainMult += 0.05 * level;
        }
        break;
      case "blade":
        if (polarity === "white") mods.incomingMult *= Math.max(0.65, 1 - 0.08 * level);
        else if (polarity === "black") player.critDamage += 0.18 * level;
        else player.globalCooldown *= Math.max(0.75, 1 - 0.06 * level);
        break;
      case "thunder":
        if (polarity === "white") {
          player.regen += 0.06 * level;
          mods.xpGainMult += 0.06 * level;
        } else if (polarity === "black") {
          mods.damageMult += 0.05 * level;
          player.globalCooldown *= Math.max(0.72, 1 - 0.05 * level);
        } else {
          player.speed += 8 * level;
          player.pickupRange += 8 * level;
        }
        break;
      case "ward":
        if (polarity === "white") {
          player.maxHp += 14 * level;
          mods.whiteGainMult += 0.08 * level;
        } else if (polarity === "black") {
          player.critChance += 0.03 * level;
          mods.blackGainMult += 0.08 * level;
        } else {
          mods.damageMult += 0.04 * level;
        }
        break;
      case "reaper":
        if (polarity === "white") {
          player.maxHp += 24 * level;
          player.regen += 0.1 * level;
        } else if (polarity === "black") {
          mods.damageMult += 0.1 * level;
          player.critChance += 0.04 * level;
        } else {
          mods.damageMult += 0.05 * level;
          mods.xpGainMult += 0.06 * level;
        }
        break;
      case "lotus":
        if (polarity === "white") {
          mods.xpGainMult += 0.14 * level;
          player.regen += 0.1 * level;
        } else if (polarity === "black") {
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

function makePathState(color) {
  return {
    color,
    value: 0,
    cap: FIRST_PATH_CAP,
    full: false,
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
    phaseLabel: "寰呭紑濮?",
    currentModal: null,
    pendingLevelUps: 0,
    statuses: [],
    totalKills: 0,
    modalOptions: null,
    campaign: createCampaignState(),
    currentDestinyOffers: [],
    pendingPolarityColor: null,
    lastRunPoints: 0,
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
  if (main === "thunder") skill.damage *= 1.22;
  if (main === "flame") skill.damage *= 1.18;
  if (main === "guard") {
    skill.maxShield *= 1.2;
    skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * 0.3);
  }
}

function addStatus(name, duration, effects) {
  state.statuses.push({ name, duration, remaining: duration, effects });
}

function getDamageMult() {
  let mult = state.bonusDamageMult || 1;
  state.statuses.forEach((status) => {
    if (status.effects.damageMult) mult *= status.effects.damageMult;
  });
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
  if (Math.random() < state.player.critChance) damage *= state.player.critDamage;
  return damage;
}

function unlockSkill(gameState, id) {
  if (gameState.player.skills[id]) return;
  const base = skills[id];
  if (!base) return;
  if (id === "sword") {
    gameState.player.skills.sword = { id, rank: 1, cooldown: base.baseCooldown, damage: base.baseDamage, projectiles: 1, pierce: 0, timer: 0.2, activeTimer: 0 };
  } else if (id === "thunder") {
    gameState.player.skills.thunder = { id, rank: 1, cooldown: base.baseCooldown, damage: base.baseDamage, timer: 0.6, chain: 0, splash: base.splash, activeTimer: 0 };
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

function advanceCampaign() {
  if (state.campaign.stageIndex < STAGES_PER_RUN) {
    state.campaign.stageIndex += 1;
    startCurrentStage();
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

function acquireDestiny(id, polarity) {
  if (metaState.destiny.owned[id]) return;
  metaState.destiny.owned[id] = {
    level: 1,
    basePolarity: polarity,
    currentPolarity: polarity,
    polarityLocked: polarity !== "neutral",
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

function openPolarityInfusionModal() {
  const choices = [];
  if (state.whitePath.full) {
    choices.push({
      title: "白意改命",
      body: "将一枚已拥有命格定为白道，并清空白槽。",
      onClick: () => openPolarityTargetModal("white"),
    });
  }
  if (state.blackPath.full) {
    choices.push({
      title: "黑念改命",
      body: "将一枚已拥有命格定为黑道，并清空黑槽。",
      onClick: () => openPolarityTargetModal("black"),
    });
  }
  if (!choices.length || !getOwnedDestinyEntries().length) {
    openStageDestinyOffer();
    return;
  }
  state.paused = true;
  state.currentModal = "polarity-infuse";
  renderModal({
    title: "命格改道",
    body: "黑白槽已满，可以改写一枚命格的当前道性。",
    choices,
    actions: [{
      label: "稍后再说",
      onClick: () => {
        closeModal();
        state.paused = false;
        openStageDestinyOffer();
      },
    }],
  });
}

function openPolarityTargetModal(color) {
  state.pendingPolarityColor = color;
  renderModal({
    title: color === "white" ? "白意灌注" : "黑念灌注",
    body: "选择一枚已拥有命格，改写其当前道性。",
    choices: getOwnedDestinyEntries().map((entry) => ({
      title: `${entry.def.name} [${entry.currentPolarity}]`,
      body: `改写为${color === "white" ? "白道" : "黑道"}`,
      onClick: () => {
        metaState.destiny.owned[entry.id].currentPolarity = color;
        metaState.destiny.owned[entry.id].polarityLocked = true;
        if (color === "white") {
          state.whitePath.value = 0;
          state.whitePath.full = false;
        } else {
          state.blackPath.value = 0;
          state.blackPath.full = false;
        }
        saveMetaState();
        closeModal();
        state.paused = false;
        openStageDestinyOffer();
      },
    })),
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
      title: `${destinyCatalog[offer.id].name} [${offer.polarity}]`,
      body: destinyCatalog[offer.id].text[offer.polarity],
      onClick: () => {
        closeModal();
        state.paused = false;
        acquireDestiny(offer.id, offer.polarity);
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
    basePolarity: "neutral",
    currentPolarity: "neutral",
    polarityLocked: false,
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
      stateRef.player.skills.thunder.damage *= 1.4;
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

function addXp(amount) {
  state.player.xp += amount * state.xpGainMult;
  while (state.player.xp >= xpNeeded(state.player.level)) {
    state.player.xp -= xpNeeded(state.player.level);
    state.player.level += 1;
    state.pendingLevelUps += 1;
  }
  if (state.pendingLevelUps > 0 && !state.currentModal && state.mode === "playing") {
    openLevelUp();
  }
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
  target.hp -= amount;
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
  strikeEnemy(target, skill.damage, state.player);
  state.enemies
    .filter((enemy) => enemy !== target)
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, skill.chain)
    .forEach((enemy) => strikeEnemy(enemy, skill.damage * 0.65, target));
}

function castActiveThunder(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const radius = Math.min(WIDTH, HEIGHT) * 0.46;
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius,
    damage: computeDamage(skill.damage * (1.55 + level * 0.22)),
    kind: "thunderstorm",
    time: 2,
    duration: 2,
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
  const count = 8 + level * 2;
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
  pulse(state.player.x, state.player.y, radius, damage, "guard");
  state.enemies.forEach((enemy) => {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist <= radius + enemy.radius) {
      const push = 36 + level * 12;
      enemy.x = clamp(enemy.x + (dx / dist) * push, 20, WIDTH - 20);
      enemy.y = clamp(enemy.y + (dy / dist) * push, 20, HEIGHT - 20);
    }
  });
  if (state.boss) {
    const dx = state.boss.x - state.player.x;
    const dy = state.boss.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist <= radius + state.boss.radius) {
      const push = 18 + level * 5;
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
  const waveCount = 3;
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
  skill.activeTimer = getActiveCooldown(skillId, getActiveLevel(skill));
  return true;
}

function updateSkills(dt) {
  const castScale = getCastMult();
  Object.values(state.player.skills).forEach((skill) => {
    if (typeof skill.activeTimer === "number") skill.activeTimer = Math.max(0, skill.activeTimer - dt);
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
  state.drops.push({ x: enemy.x, y: enemy.y, kind: "xp", value: enemies[enemy.type].xp, color: COLORS.xp, radius: 6 });
  const orbColor = enemy.color === "black" ? "white" : "black";
  state.drops.push({
    x: enemy.x + (Math.random() * 10 - 5),
    y: enemy.y + (Math.random() * 10 - 5),
    kind: "path",
    value: enemies[enemy.type].orb,
    color: orbColor,
    radius: 7,
  });
}

function killEnemy(enemy, source) {
  const index = state.enemies.indexOf(enemy);
  if (index >= 0) state.enemies.splice(index, 1);
  addXp(enemies[enemy.type].xp);
  spawnDrops(enemy);
  state.totalKills += 1;
  if (!enemy.isMiniBoss) state.campaign.stageKills += 1;
  if (state.player.skills.flame?.burst && enemy.burn > 0) pulse(enemy.x, enemy.y, 44, state.player.skills.flame.damage * 2.2, "burst");
  if (enemy.isMiniBoss) {
    state.campaign.miniBossDefeated = true;
    state.paused = false;
    openPolarityInfusionModal();
  }
}

function hitPlayer(amount) {
  if (state.player.invulnTimer > 0 || state.mode !== "playing") return;
  let incoming = amount * getIncomingMult();
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

function finishGame(result) {
  if (result !== RESULT_DEATH) {
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
      openRunShopModal(true, `最终大Boss已破，${finalResult}`);
    } else {
      openRunShopModal(false, `第${state.campaign.runIndex}轮已破，道途又进了一步。`);
    }
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
  state.player.x = clamp(state.player.x + (moveX / len) * state.player.speed * dt, 20, WIDTH - 20);
  state.player.y = clamp(state.player.y + (moveY / len) * state.player.speed * dt, 20, HEIGHT - 20);
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
  state.drops = state.drops.filter((drop) => {
    const dist = distance(drop, state.player);
    if (dist < state.player.pickupRange) {
      const speed = 320 * dt;
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
}

function updateStatuses(dt) {
  state.statuses = state.statuses.filter((status) => {
    status.remaining -= dt;
    if (status.effects.drain) {
      state.player.hp -= state.player.maxHp * status.effects.drain * dt;
      if (state.player.hp <= 0) finishGame(RESULT_DEATH);
    }
    return status.remaining > 0;
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
    else if (id === "thunder") detail += ` | 链 ${skill.chain}`;
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
  path.value = Math.min(path.cap, path.value + amount * gainMult);
  if (path.value >= path.cap) {
    path.full = true;
    setToast(color === "white" ? "白槽已满，可改命格" : "黑槽已满，可改命格");
  }
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
  dom.whiteStageText.textContent = state.whitePath.full ? "白槽已满" : "白槽推进";
  dom.blackStageText.textContent = state.blackPath.full ? "黑槽已满" : "黑槽推进";
  dom.statusList.innerHTML = "";
  const counts = getPolarityCounts();
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
      level: state.player.level,
      skills: state.player.skillOrder.map((id) => ({ id, rank: state.player.skills[id].rank })),
    },
    paths: {
      white: { value: Math.round(state.whitePath.value), cap: state.whitePath.cap, full: state.whitePath.full },
      black: { value: Math.round(state.blackPath.value), cap: state.blackPath.cap, full: state.blackPath.full },
    },
    destinies: {
      owned: getOwnedDestinyEntries().map((entry) => ({ id: entry.id, level: entry.level, polarity: entry.currentPolarity })),
      equipped: metaState.destiny.equipped,
    },
    enemy_count: state.enemies.length,
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
