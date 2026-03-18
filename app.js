const WIDTH = 960;
const HEIGHT = 540;
const BALANCE = window.GAME_BALANCE;
const GAME_DURATION = BALANCE.progression.duration;
const FIRST_PATH_CAP = BALANCE.progression.firstPathCap;
const SECOND_PATH_CAP = BALANCE.progression.secondPathCap;
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
  if (key === "f") toggleFullscreen();
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

document.addEventListener("fullscreenchange", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

const baseStats = BALANCE.playerTable;
const xpCurve = BALANCE.playerTable.xpCurve;

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
    description: "对最近敌人施落雷，可溅射。",
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

const enemies = BALANCE.monsterTable;

function createMetaState() {
  return {
    points: 0,
    upgrades: {},
    runs: 0,
    bestKills: 0,
    lastResult: null,
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

function makePathState(color) {
  return {
    color,
    stage: 1,
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
  return {
    mode: "menu",
    running: false,
    paused: false,
    time: 0,
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
    avatar: null,
    phaseLabel: "待开始",
    currentModal: null,
    pendingLevelUps: 0,
    whiteNodeTriggered: { one: false, two: false },
    blackNodeTriggered: { one: false, two: false },
    forcedTransform: false,
    statuses: [],
    totalKills: 0,
    modalOptions: null,
  };
}

const state = createState();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  let mult = 1;
  if (state.avatar === "black" && state.player.hp < state.player.maxHp * 0.4) mult *= 1.25;
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
  let mult = 1;
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
    gameState.player.skills.sword = { id, rank: 1, cooldown: base.baseCooldown, damage: base.baseDamage, projectiles: 1, pierce: 0, timer: 0.2 };
  } else if (id === "thunder") {
    gameState.player.skills.thunder = { id, rank: 1, cooldown: base.baseCooldown, damage: base.baseDamage, timer: 0.6, chain: 0, splash: base.splash };
  } else if (id === "flame") {
    gameState.player.skills.flame = { id, rank: 1, radius: base.radius, timer: 0.1, tick: base.tick, damage: base.damage, burst: false };
  } else if (id === "guard") {
    gameState.player.skills.guard = { id, rank: 1, maxShield: base.shield, shield: base.shield, recharge: base.recharge, timer: 0, burst: false };
  }
  gameState.player.skillOrder.push(id);
  gameState.player.skillFocus[id] = (gameState.player.skillFocus[id] || 0) + 1;
}

function resetGame() {
  dom.startBtn.blur();
  const fresh = createState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  unlockSkill(state, "sword");
  showOverlay(false);
  dom.startBtn.textContent = "重新开始";
  state.mode = "playing";
  state.running = true;
  state.phaseLabel = "混元试炼";
  closeModal();
  setToast("试炼开始");
  maybeOpenStarterChoice();
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
    name: "急雷",
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
    desc: "被点燃敌人死亡会爆炸。",
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
    name: "金钟再铸",
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
  if (main && choice.id.includes(main)) score += 5;
  if (choice.id === "life" && state.player.hp < state.player.maxHp * 0.55) score += 3;
  if (choice.id.startsWith("guard") && state.player.hp < state.player.maxHp * 0.6) score += 2;
  return score + Math.random();
}

function availableChoices() {
  const pool = levelChoices.filter((choice) => choice.canTake(state));
  const main = chooseMainSkill(state);
  return pool.sort((a, b) => scoreChoice(b, main) - scoreChoice(a, main)).slice(0, 3);
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

function openTransformation() {
  state.paused = true;
  state.currentModal = "transform";
  const bothFull = state.whitePath.full && state.blackPath.full;
  const choices = [];
  if (bothFull || state.whitePath.full) {
    choices.push({
      title: "化身白修士",
      body: "回复和护体更强，所有敌人都掉白点。",
      onClick: () => transformTo("white"),
    });
  }
  if (bothFull || state.blackPath.full) {
    choices.push({
      title: "化身黑修士",
      body: "暴击与爆发更强，所有敌人都掉黑点。",
      onClick: () => transformTo("black"),
    });
  }
  renderModal({
    title: bothFull ? "阴阳俱满，必须定道" : "道心已成，是否定道",
    body: bothFull
      ? "你的道途不能再拖延，立刻选择成仙或化魔。"
      : "你可顺势化身，也可暂缓抉择，继续积蓄另一极之力。",
    choices,
    actions: bothFull ? [] : [{
      label: "暂不选择",
      onClick: () => {
        closeModal();
        state.paused = false;
      },
    }],
  });
}

function transformTo(color) {
  state.avatar = color;
  if (color === "white") {
    state.whitePath.stage = 2;
    state.whitePath.value = 0;
    state.whitePath.cap = SECOND_PATH_CAP;
    state.phaseLabel = "白修士冲关";
  } else {
    state.blackPath.stage = 2;
    state.blackPath.value = 0;
    state.blackPath.cap = SECOND_PATH_CAP;
    state.phaseLabel = "黑修士冲关";
  }
  closeModal();
  state.paused = false;
  setToast(color === "white" ? "化身白修士" : "化身黑修士");
}

function fillPath(color, amount) {
  const path = color === "white" ? state.whitePath : state.blackPath;
  const gainMult = color === "white" ? state.whiteGainMult : state.blackGainMult;
  if (path.full && path.stage === 1) return;
  path.value = Math.min(path.cap, path.value + amount * gainMult);
  if (path.stage === 1) {
    if (color === "white") {
      if (!state.whiteNodeTriggered.one && path.value >= path.cap / 3) {
        state.whiteNodeTriggered.one = true;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * 0.2);
        setToast("白槽 1/3：顿悟");
      }
      if (!state.whiteNodeTriggered.two && path.value >= (path.cap * 2) / 3) {
        state.whiteNodeTriggered.two = true;
        grantMainSkillUpgrade();
        state.player.pickupRange *= 1.1;
        setToast("白槽 2/3：明心");
      }
    } else {
      if (!state.blackNodeTriggered.one && path.value >= path.cap / 3) {
        state.blackNodeTriggered.one = true;
        addStatus("魔念", 8, { damageMult: 1.35, drain: 0.02 });
        setToast("黑槽 1/3：魔念");
      }
      if (!state.blackNodeTriggered.two && path.value >= (path.cap * 2) / 3) {
        state.blackNodeTriggered.two = true;
        addStatus("入障", 12, { castMult: 1.4, incomingMult: 1.2 });
        setToast("黑槽 2/3：入障");
      }
    }
    if (path.value >= path.cap) {
      path.full = true;
      if (!state.avatar) openTransformation();
    }
  } else if (path.value >= path.cap && !state.bossFight) {
    spawnBoss();
  }
}

function enemyHealthMult() {
  return BALANCE.waves.healthBands.find((band) => state.time < band.until).mult;
}

function enemyDamageMult() {
  return BALANCE.waves.damageBands.find((band) => state.time < band.until).mult;
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

function updateSpawn(dt) {
  if (state.bossFight) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const waveCount = state.time < 120
      ? BALANCE.waves.countEarly
      : state.time < 240
        ? BALANCE.waves.countMid
        : state.time < 360
          ? BALANCE.waves.countLate
          : BALANCE.waves.countEnd;
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
    const levelReduction = Math.max(0, state.player.level - 1) * BALANCE.waves.levelIntervalReduction;
    state.spawnTimer = Math.max(BALANCE.waves.minSpawnInterval, baseInterval - levelReduction);
  }
  while (state.eliteIndex < state.eliteSchedule.length && state.time >= state.eliteSchedule[state.eliteIndex]) {
    spawnEnemy("elite");
    state.eliteIndex += 1;
    setToast("精英护法现身");
  }
}

function spawnBoss() {
  state.bossFight = true;
  state.phaseLabel = "Boss 战";
  state.enemies = [];
  state.enemyProjectiles = [];
  state.boss = {
    type: "boss",
    x: WIDTH / 2,
    y: 90,
    hp: enemies.boss.hp,
    maxHp: enemies.boss.hp,
    damage: enemies.boss.damage,
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
  state.pulses.push({ x, y, radius, damage, kind, time: 0.18, hit: new Set(), affectsBoss });
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
    if (target.type === "boss") finishGame(state.avatar === "white" ? "成仙" : "化魔");
    else killEnemy(target, source);
  }
}

function strikeEnemy(enemy, damage) {
  state.pulses.push({ x: enemy.x, y: enemy.y, radius: 18, damage: 0, kind: "thunder", time: 0.15, hit: new Set() });
  dealDamage(enemy, computeDamage(damage));
}

function castThunder(skill) {
  const target = nearestEnemies(1)[0];
  if (!target) return;
  strikeEnemy(target, skill.damage);
  state.enemies
    .filter((enemy) => enemy !== target)
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, skill.chain)
    .forEach((enemy) => strikeEnemy(enemy, skill.damage * 0.65));
}

function updateSkills(dt) {
  const castScale = getCastMult();
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
  const orbColor = state.avatar ? state.avatar : (enemy.color === "black" ? "white" : "black");
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
  if (state.player.skills.flame?.burst && enemy.burn > 0) pulse(enemy.x, enemy.y, 44, state.player.skills.flame.damage * 2.2, "burst");
  if (state.avatar === "black" && source === "player") pulse(enemy.x, enemy.y, 30, 18, "blackburst");
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
  if (state.player.hp <= 0) finishGame("陨落");
}

function calculateRunPoints(result) {
  const fromTime = Math.floor(state.time / META.pointsFromTimeDivisor);
  const fromKills = Math.floor(state.totalKills / META.pointsFromKillsDivisor);
  const transform = state.avatar ? META.transformBonus : 0;
  const boss = result === "成仙" || result === "化魔" ? META.bossWinBonus : 0;
  const path = result === "成仙" || result === "化魔" ? META.pathWinBonus : 0;
  return Math.max(1, fromTime + fromKills + transform + boss + path);
}

function buyUpgrade(id) {
  const upgrade = META.upgrades[id];
  const level = metaState.upgrades[id] || 0;
  if (!upgrade || level >= upgrade.maxLevel || metaState.points < upgrade.cost) return;
  metaState.points -= upgrade.cost;
  metaState.upgrades[id] = level + 1;
  saveMetaState();
  openReincarnationModal(state.result, state.lastRunPoints);
}

function openReincarnationModal(result, gainedPoints) {
  state.currentModal = "reincarnation";
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
      title: `${upgrade.name}  Lv.${level}/${upgrade.maxLevel}${locked ? " · 已满" : ""}`,
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
        <div class="summary-value">${result}</div>
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
  state.mode = "result";
  state.running = false;
  state.result = result;
  state.paused = true;
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
    pulseItem.time -= dt;
    const scale = 1 - pulseItem.time / 0.18;
    const hitRadius = pulseItem.radius * clamp(scale, 0.2, 1);
    if (pulseItem.kind === "bosswave" && !pulseItem.hit.has(state.player) && distance(pulseItem, state.player) <= hitRadius + state.player.radius) {
      pulseItem.hit.add(state.player);
      hitPlayer(pulseItem.damage);
    }
    state.enemies.forEach((enemy) => {
      if (pulseItem.hit.has(enemy)) return;
      if (distance(pulseItem, enemy) <= hitRadius + enemy.radius) {
        pulseItem.hit.add(enemy);
        if (pulseItem.damage > 0) {
          dealDamage(enemy, pulseItem.damage);
          if (pulseItem.kind === "flame") enemy.burn = 2.5;
        }
      }
    });
    if (pulseItem.affectsBoss && state.boss && !pulseItem.hit.has(state.boss) && distance(pulseItem, state.boss) <= hitRadius + state.boss.radius) {
      pulseItem.hit.add(state.boss);
      if (pulseItem.damage > 0) dealDamage(state.boss, pulseItem.damage);
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
      if (state.player.hp <= 0) finishGame("陨落");
    }
    return status.remaining > 0;
  });
}

function refreshPhase() {
  if (state.bossFight) state.phaseLabel = "Boss 战";
  else if (state.avatar) state.phaseLabel = state.avatar === "white" ? "白修士冲关" : "黑修士冲关";
  else if (state.whitePath.full || state.blackPath.full) state.phaseLabel = "可化身";
  else if (state.time < 150) state.phaseLabel = "混元试炼";
  else if (state.time < 330) state.phaseLabel = "中期成型";
  else state.phaseLabel = "道途偏转";
}

function update(dt) {
  if (!state.running || state.paused) return;
  state.time += dt;
  if (state.time >= GAME_DURATION && !state.bossFight) spawnBoss();
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
    ctx.strokeStyle = "rgba(255,140,70,0.32)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.skills.flame.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (state.player.skills.guard?.shield > 0) {
    ctx.strokeStyle = "rgba(204, 224, 255, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = state.avatar === "white" ? COLORS.white : state.avatar === "black" ? COLORS.black : COLORS.player;
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

function drawProjectiles(ctx) {
  state.projectiles.forEach((projectile) => {
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

function drawPulses(ctx) {
  state.pulses.forEach((pulseItem) => {
    const alpha = clamp(pulseItem.time / 0.18, 0, 1);
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
    let detail = `Rank ${skill.rank}`;
    if (id === "guard") detail += ` | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`;
    else if (id === "sword") detail += ` | ${skill.projectiles} 剑`;
    else if (id === "thunder") detail += ` | 链 ${skill.chain}`;
    else if (id === "flame") detail += ` | 半径 ${Math.floor(skill.radius)}`;
    return `<div class="skill-card"><div class="skill-name">${template.name}</div><div class="skill-detail">${detail}<br>${template.description}</div></div>`;
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
  dom.timerText.textContent = formatTime(Math.max(0, GAME_DURATION - state.time));
  dom.phaseText.textContent = state.phaseLabel;
  dom.whiteFill.style.width = `${(state.whitePath.value / state.whitePath.cap) * 100}%`;
  dom.blackFill.style.width = `${(state.blackPath.value / state.blackPath.cap) * 100}%`;
  dom.whiteText.textContent = `${Math.floor(state.whitePath.value)} / ${state.whitePath.cap}`;
  dom.blackText.textContent = `${Math.floor(state.blackPath.value)} / ${state.blackPath.cap}`;
  dom.whiteStageText.textContent = `白槽 ${state.whitePath.stage} 阶段`;
  dom.blackStageText.textContent = `黑槽 ${state.blackPath.stage} 阶段`;
  dom.statusList.innerHTML = "";
  const statusLabels = state.statuses.map((item) => `${item.name} ${item.remaining.toFixed(1)}s`);
  if (state.avatar === "white") statusLabels.push("白修士");
  if (state.avatar === "black") statusLabels.push("黑修士");
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

function renderGameToText() {
  return JSON.stringify({
    mode: state.mode,
    phase: state.phaseLabel,
    time_left: formatTime(Math.max(0, GAME_DURATION - state.time)),
    coordinate_system: "origin top-left, x right, y down",
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      hp: Math.round(state.player.hp),
      max_hp: Math.round(state.player.maxHp),
      level: state.player.level,
      avatar: state.avatar || "none",
      skills: state.player.skillOrder.map((id) => ({ id, rank: state.player.skills[id].rank })),
    },
    paths: {
      white: { stage: state.whitePath.stage, value: Math.round(state.whitePath.value), cap: state.whitePath.cap, full: state.whitePath.full },
      black: { stage: state.blackPath.stage, value: Math.round(state.blackPath.value), cap: state.blackPath.cap, full: state.blackPath.full },
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
