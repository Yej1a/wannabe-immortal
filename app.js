const WIDTH = 960;
const HEIGHT = 540;
const dom = {
  canvas: document.getElementById("game"),
  ctx: document.getElementById("game").getContext("2d"),
  startBtn: document.getElementById("start-btn"),
  clearSaveBtn: document.getElementById("clear-save-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  healthFill: document.getElementById("health-fill"),
  healthText: document.getElementById("health-text"),
  xpFill: document.getElementById("xp-fill"),
  xpText: document.getElementById("xp-text"),
  levelText: document.getElementById("level-text"),
  phaseText: document.getElementById("phase-text"),
  whiteFill: document.getElementById("white-fill"),
  blackFill: document.getElementById("black-fill"),
  whiteText: document.getElementById("white-text"),
  blackText: document.getElementById("black-text"),
  whiteStageText: document.getElementById("white-stage-text"),
  blackStageText: document.getElementById("black-stage-text"),
  nodeHint: document.querySelector(".node-hint"),
  statusList: document.getElementById("status-list"),
  destinyList: document.getElementById("destiny-list"),
  skillBar: document.getElementById("skill-bar"),
  inspectPanel: document.getElementById("inspect-panel"),
  overlayMessage: document.getElementById("overlay-message"),
  toast: document.getElementById("toast"),
  modalRoot: document.getElementById("modal-root"),
};

const keys = {};
const uiState = {
  toastTimeout: null,
};

let combatSystems = null;
let gameRenderer = null;
let inspectSystem = null;

function update(dt) {
  return combatSystems?.update?.(dt);
}

function render() {
  return gameRenderer?.render?.();
}

function resizeCanvas() {
  return gameRenderer?.resizeCanvas?.();
}

async function toggleFullscreen() {
  return gameRenderer?.toggleFullscreen?.();
}

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

const {
  BALANCE,
  META,
  PATH_COMBAT,
  PATH_THRESHOLDS,
  COLORS,
  baseStats,
  xpCurve,
  STAGES_PER_RUN,
  TOTAL_RUNS,
  DESTINY_SLOT_CAP,
  RESULT_DEATH,
  RESULT_CLEAR,
  BRANCH_UNLOCK_BASE_UPGRADES,
  BRANCH_CHOICE_GUARANTEE_COUNT,
  ACTIVE_UNLOCK_RANK,
  HUMAN_ENDING_DESTINY_ID,
  DESTINY_RUNTIME_RULES,
  destinyCatalog,
  skills,
  skillRouteTable,
  activeSkillTable,
  enemies,
} = window.GameData;
const SKILL_ART = Object.fromEntries(
  Object.entries(skills).map(([id, skill]) => [id, skill.art || {}]),
);
const TECHNIQUE_DESTINY_SKILL_MAP = Object.fromEntries(
  Object.values(DESTINY_RUNTIME_RULES.skillRewriteBindings || {}).map((binding) => [binding.destinyId, binding.skillId]),
);
const {
  createCampaignState: createCampaignStateImpl,
  createMetaState: createMetaStateImpl,
  loadMetaState: loadMetaStateImpl,
  saveMetaState: saveMetaStateImpl,
  createState: createStateImpl,
} = window.RuntimeState;
const {
  ensureMetaCollections: ensureMetaCollectionsImpl,
  getEntryAlignment: getEntryAlignmentImpl,
  getDestinyText: getDestinyTextImpl,
  getOwnedDestinyEntries: getOwnedDestinyEntriesImpl,
  getEquippedDestinyEntries: getEquippedDestinyEntriesImpl,
  getAlignmentCounts: getAlignmentCountsImpl,
  getAlignmentResult: getAlignmentResultImpl,
  getDestinyTierLabel: getDestinyTierLabelImpl,
  getDestinyWeight: getDestinyWeightImpl,
  getMissingDestinyIds: getMissingDestinyIdsImpl,
  weightedPick: weightedPickImpl,
  isDestinyOfferEligible: isDestinyOfferEligibleImpl,
  getDestinyOfferQualityScore: getDestinyOfferQualityScoreImpl,
  getRandomDestinyOffers: getRandomDestinyOffersImpl,
  getAlignmentLabel: getAlignmentLabelImpl,
  formatResultLabel: formatResultLabelImpl,
  applyDestinyBonuses: applyDestinyBonusesImpl,
  createDestinyPreviewSnapshot: createDestinyPreviewSnapshotImpl,
  describeDestinyStatDelta: describeDestinyStatDeltaImpl,
  getPointifyPreviewRows: getPointifyPreviewRowsImpl,
  describePointifyPreview: describePointifyPreviewImpl,
  getPointifyEquipPreview: getPointifyEquipPreviewImpl,
} = window.DestinyHelpers;
const {
  formatTime: formatTimeImpl,
  setToast: setToastImpl,
  closeModal: closeModalImpl,
  renderModal: renderModalImpl,
  handleModalHotkeys: handleModalHotkeysImpl,
  showOverlay: showOverlayImpl,
  syncPauseButton: syncPauseButtonImpl,
  describePathStage: describePathStageImpl,
  refreshPhase: refreshPhaseImpl,
  renderSkillBar: renderSkillBarImpl,
  updateHud: updateHudImpl,
  renderGameToText: renderGameToTextImpl,
} = window.GameUI;
const {
  createGameplayHelpers,
} = window.GameplayHelpers;
const {
  createDestinyRuntime,
} = window.GameDestinyRuntime;
const {
  createInspectSystem,
} = window.GameInspectSystem;
const {
  createRunFlow,
} = window.GameRunFlow;
const {
  createDestinyFlow,
} = window.GameDestinyFlow;
const {
  createShopFlow,
} = window.GameShopFlow;
const {
  createReincarnationFlow,
} = window.GameReincarnationFlow;
const {
  createCombatSystems,
} = window.GameCombatSystems;
const {
  createGameRenderer,
} = window.GameRenderer;
const {
  installDebugHooks,
} = window.GameDebug;

function createCampaignState() {
  return createCampaignStateImpl();
}

function createMetaState() {
  return createMetaStateImpl();
}

function loadMetaState() {
  return loadMetaStateImpl();
}

const metaState = loadMetaState();

function saveMetaState() {
  saveMetaStateImpl(metaState);
}

function clearSavedProgress() {
  localStorage.removeItem(META.storageKey);
  const freshMeta = createMetaState();
  Object.keys(metaState).forEach((key) => delete metaState[key]);
  Object.assign(metaState, freshMeta);
  ensureMetaCollections();
  clearPendingInfusionContinuation();
  const freshState = createState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, freshState);
  closeModal();
  dom.startBtn.textContent = "开始试炼";
  showOverlay(true);
  syncPauseButton();
  render();
  setToast("已清空存档");
}

function ensureMetaCollections() {
  ensureMetaCollectionsImpl(metaState);
}

ensureMetaCollections();

function getEntryAlignment(entry) {
  return getEntryAlignmentImpl(entry);
}

function getDestinyText(def, alignment) {
  return getDestinyTextImpl(def, alignment);
}

function getOwnedDestinyEntries() {
  return getOwnedDestinyEntriesImpl(metaState);
}

function getEquippedDestinyEntries() {
  return getEquippedDestinyEntriesImpl(metaState);
}

function getAlignmentCounts() {
  return getAlignmentCountsImpl(metaState);
}

function normalizeAlignmentResult(result) {
  if (!result) return result;
  if (result.includes("Be Human")) return "成人（Be Human）";
  if (result.includes("鎴愪粰")) return "成仙";
  if (result.includes("鍖栭瓟")) return "化魔";
  return result;
}

function getAlignmentResult() {
  return normalizeAlignmentResult(getAlignmentResultImpl(state, metaState));
}

function getMissingDestinyIds() {
  return getMissingDestinyIdsImpl(metaState);
}

function getRandomDestinyOffers(count = 3) {
  return getRandomDestinyOffersImpl(metaState, state, count);
}

function getDestinyOfferQualityScore(offers = []) {
  return getDestinyOfferQualityScoreImpl(offers);
}

function describeDestiny(id, alignment = destinyCatalog[id].alignment) {
  const def = destinyCatalog[id];
  return `${def.name} [${alignment}] - ${def.text[alignment]}`;
}

function getAlignmentLabel(alignment) {
  return getAlignmentLabelImpl(alignment);
}

function formatResultLabel(result) {
  return formatResultLabelImpl(result);
}

function applyDestinyBonuses(player, mods) {
  applyDestinyBonusesImpl(metaState, player, mods);
}

function createDestinyPreviewSnapshot(equippedIds = metaState.destiny.equipped) {
  return createDestinyPreviewSnapshotImpl(metaState, equippedIds);
}

function describeDestinyStatDelta(before, after) {
  return describeDestinyStatDeltaImpl(before, after);
}

function getPointifyPreviewRows(targetId, color) {
  return getPointifyPreviewRowsImpl(metaState, targetId, color);
}

function describePointifyPreview(targetId, color) {
  return describePointifyPreviewImpl(metaState, targetId, color);
}

function getPointifyEquipPreview(nextId) {
  return getPointifyEquipPreviewImpl(metaState, nextId);
}

function createState() {
  return createStateImpl(metaState, applyDestinyBonuses, WIDTH, HEIGHT);
}

const state = createState();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const {
  hasEquippedDestiny,
  isWhiteCombatStatusActive,
  isBlackCombatStatusActive,
  isBloodBattleWindowActive,
  isGuiyuanActive,
  getActiveLevel,
  getSkillRouteState,
  getSkillRouteStage,
  getSkillRouteDisplayLabel,
  getSkillRouteLabel,
  getSkillActiveProfile,
  getSkillRouteVfx,
  getActiveCooldown,
  isActiveUnlocked,
  getSkillBranchCount,
  canTakeBranchUpgrade,
  canTakeCapstoneUpgrade,
  markRouteSwitch,
  markRouteGraduation,
  applySkillBaseUpgrade,
  applySkillBranchUpgrade,
  applySkillCapstoneUpgrade,
  nearestEnemyFromPoint,
  getTargetsWithinRadius,
  getCombatTargets,
  getThreatScore,
  pickPriorityTarget,
  getEnemyClusterCenter,
  getForwardPoint,
  addStatus,
  hasStatus,
  getStatus,
  getMoveMult,
  getPickupRange,
  getCritChance,
  getActiveCooldownRate,
  getKillHealProfile,
  getDropAttractProfile,
  getExecuteDamageMult,
  getBlackBurstProfile,
  hasGuardFocus,
  grantBarrier,
  healPlayer,
  markTargetHitFx,
  getPlayerAttackPower,
  getDamageMult,
  getCastMult,
  getIncomingMult,
  computeDamage,
  getThunderDamage,
} = createGameplayHelpers({
  state,
  metaState,
  WIDTH,
  HEIGHT,
  PATH_COMBAT,
  BRANCH_UNLOCK_BASE_UPGRADES,
  ACTIVE_UNLOCK_RANK,
  skills,
  skillRouteTable,
  activeSkillTable,
  clamp,
  distance,
  getAlignmentCounts,
});

function formatTime(totalSeconds) {
  return formatTimeImpl(totalSeconds);
}

function setToast(message) {
  let tone = "";
  if (typeof message === "object" && message) {
    tone = message.tone || "";
    setToastImpl(dom, uiState, message.text || "", tone);
    return;
  }
  setToastImpl(dom, uiState, message, tone);
}

const destinyRuntime = createDestinyRuntime({
  state,
  metaState,
  DESTINY_RUNTIME_RULES,
  getSkillRouteState,
  grantBarrier,
  healPlayer,
  fillPath,
  pulse,
  setToast,
});

function notifyDestinyHpChanged(source, previousHp) {
  destinyRuntime.emit("hp_changed", {
    source,
    previousHp,
    nextHp: state.player.hp,
  });
}

function notifyDestinyProtectiveLayer(layer, source, previousValue, nextValue = null) {
  const resolvedNextValue = nextValue == null
    ? (layer === "guard-shield" ? (state.player.skills.guard?.shield || 0) : state.player.barrier)
    : nextValue;
  destinyRuntime.emit("protective_layer_changed", {
    layer,
    source,
    previousValue,
    nextValue: resolvedNextValue,
  });
}

function notifyDestinyLoadoutChanged(reason) {
  destinyRuntime.emit("destiny_loadout_changed", { reason });
  state.enemies.forEach((enemy) => applyDestinyEnemySpawnModifiers(enemy));
  if (state.player.skills.guard) syncGuardRewriteState(state.player.skills.guard);
}

function closeModal() {
  closeModalImpl(state, dom, syncPauseButton);
}

function renderModal({ title, body, bodyHtml = "", choices, actions = [], className = "" }) {
  renderModalImpl(state, dom, { title, body, bodyHtml, choices, actions, className }, syncPauseButton);
}

function handleModalHotkeys(key) {
  return handleModalHotkeysImpl(state, key);
}

function showOverlay(show) {
  showOverlayImpl(dom, show);
}

function isGameplayRunning() {
  return state.mode === "playing" && state.running;
}

function isGameplayInputBlocked() {
  return !isGameplayRunning() || state.paused || state.manualPause || !!state.currentModal;
}

function canToggleManualPause() {
  return isGameplayRunning() && !state.currentModal;
}

function syncPauseButton() {
  syncPauseButtonImpl(dom, state, canToggleManualPause);
}

function toggleManualPause() {
  if (!canToggleManualPause()) return;
  state.manualPause = !state.manualPause;
  if (!state.manualPause) state.realLast = 0;
  syncPauseButton();
  render();
  setToast(state.manualPause ? "\u5df2\u6682\u505c" : "\u7ee7\u7eed\u8bd5\u70bc");
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

inspectSystem = createInspectSystem({
  state,
  dom,
  PATH_COMBAT,
  ACTIVE_UNLOCK_RANK,
  DESTINY_SLOT_CAP,
  skills,
  getThunderDamage,
  getSkillActiveProfile,
  getSkillRouteLabel: getSkillRouteDisplayLabel,
  getSkillRouteStage,
  getActiveLevel,
  isActiveUnlocked,
  getEquippedDestinyEntries,
  getEntryAlignment,
  getAlignmentLabel,
  getDestinyText,
});

function resetPathCharge(path) {
  path.value = 0;
  path.full = false;
  path.tier1Triggered = false;
  path.tier2Triggered = false;
}

function getPathPalette(color, level = "tier1") {
  if (color === "white") {
    if (level === "release") return { primary: "#f7f1dc", secondary: "#c6dbed", accent: "#ffffff" };
    if (level === "ready") return { primary: "#efe6ca", secondary: "#b9d6ea", accent: "#fffdf5" };
    return { primary: "#efe7d2", secondary: "#b7cee0", accent: "#ffffff" };
  }
  if (level === "release") return { primary: "#ffbe74", secondary: "#a3475f", accent: "#ffd8ab" };
  if (level === "ready") return { primary: "#ffb26f", secondary: "#7a3c5a", accent: "#ffd0a0" };
  return { primary: "#ff9c63", secondary: "#6c334f", accent: "#ffc68f" };
}

function emitPathThresholdCue(color, tier) {
  const radius = tier === 1 ? 58 : 86;
  const duration = tier === 1 ? 0.22 : 0.28;
  pulse(state.player.x, state.player.y, radius, 0, color === "white" ? "guard" : "burst", false, {
    duration,
    time: duration,
    palette: getPathPalette(color, tier === 2 ? "tier2" : "tier1"),
    routeStyle: color === "white" ? "bulwark" : "meteor",
  });
}

function emitPathReadyCue(color) {
  const radius = color === "white" ? 104 : 118;
  const duration = 0.34;
  pulse(state.player.x, state.player.y, radius, 0, color === "white" ? "guard" : "burst", false, {
    duration,
    time: duration,
    palette: getPathPalette(color, "ready"),
    routeStyle: color === "white" ? "bulwark" : "meteor",
  });
}

function markPathImpact(color, radius) {
  const effectKind = color === "white" ? "guard" : "flame";
  const routeStyle = color === "white" ? "bulwark" : "meteor";
  const palette = getPathPalette(color, "release");
  state.enemies.forEach((enemy) => {
    if (distance(state.player, enemy) <= radius + enemy.radius) {
      markTargetHitFx(enemy, effectKind, routeStyle, palette, 0.34, 1.08);
    }
  });
  if (state.boss && distance(state.player, state.boss) <= radius + state.boss.radius) {
    markTargetHitFx(state.boss, effectKind, routeStyle, palette, 0.38, 1.12);
  }
}

function triggerPathTier(color, tier) {
  if (color === "white" && tier === 1) {
    addStatus("清明", PATH_COMBAT.white.tier1Duration, {
      pickupBonus: PATH_COMBAT.white.tier1PickupBonus,
      moveMult: PATH_COMBAT.white.tier1MoveMult,
      attractRadius: PATH_COMBAT.white.tier1AttractRadius,
      attractSpeed: PATH_COMBAT.white.tier1AttractSpeed,
      onKillHealPct: PATH_COMBAT.white.tier1HealPct,
      onKillHealCooldown: PATH_COMBAT.white.tier1HealCooldown,
    });
    destinyRuntime.emit("status_applied", {
      name: "清明",
      duration: PATH_COMBAT.white.tier1Duration,
      source: "path_threshold_tier1",
    });
    emitPathThresholdCue("white", 1);
    setToast({ text: "清明已触发", tone: "white-tier" });
    return;
  }
  if (color === "white" && tier === 2) {
    const barrier = clamp(
      state.player.maxHp * PATH_COMBAT.white.tier2BarrierPct,
      PATH_COMBAT.white.tier2BarrierMin,
      PATH_COMBAT.white.tier2BarrierMax,
    );
    const previousBarrier = state.player.barrier;
    grantBarrier(barrier);
    notifyDestinyProtectiveLayer("barrier", "path_threshold_tier2", previousBarrier);
    addStatus("灵护", PATH_COMBAT.white.tier2Duration, {
      onExpire: () => {
        if (state.player.hp / Math.max(1, state.player.maxHp) >= PATH_COMBAT.white.tier2RefundThreshold) {
          fillPath("white", PATH_COMBAT.white.tier2RefundValue, {
            kind: "status_refund",
            statusName: "灵护",
          });
          setToast("灵护善终：返还白道值");
        }
      },
    });
    destinyRuntime.emit("status_applied", {
      name: "灵护",
      duration: PATH_COMBAT.white.tier2Duration,
      source: "path_threshold_tier2",
    });
    emitPathThresholdCue("white", 2);
    setToast({ text: "灵护已触发", tone: "white-tier" });
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
    });
    destinyRuntime.emit("status_applied", {
      name: "煞燃",
      duration: PATH_COMBAT.black.tier1Duration,
      source: "path_threshold_tier1",
    });
    emitPathThresholdCue("black", 1);
    setToast({ text: "煞燃已触发", tone: "black-tier" });
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
    destinyRuntime.emit("status_applied", {
      name: "魔驰",
      duration: PATH_COMBAT.black.tier2Duration,
      source: "path_threshold_tier2",
    });
    emitPathThresholdCue("black", 2);
    setToast({ text: "魔驰已触发", tone: "black-tier" });
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
      emitPathReadyCue("white");
      setToast({ text: "白槽已满，点化机会 +1", tone: "white-ready" });
    } else {
      state.blackInfusionPoints += 1;
      emitPathReadyCue("black");
      setToast({ text: "黑槽已满，点化机会 +1", tone: "black-ready" });
    }
  }
}

function hasInfusionPoints() {
  return state.whiteInfusionPoints > 0 || state.blackInfusionPoints > 0;
}

function emitStabilizePulse(radius, extra = null) {
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
    ...(extra && typeof extra === "object" ? extra : {}),
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
  if (isGameplayInputBlocked()) return false;
  const path = color === "white" ? state.whitePath : state.blackPath;
  if (!path.full) return false;
  if (color === "white") {
    destinyRuntime.emit("release_started", {
      color: "white",
      statusName: "天息",
      source: "manual_q",
    });
    emitStabilizePulse(PATH_COMBAT.white.fullPulseRadius, {
      duration: 0.38,
      time: 0.38,
      palette: getPathPalette("white", "release"),
      routeStyle: "bulwark",
    });
    const previousBarrier = state.player.barrier;
    grantBarrier(clamp(
      state.player.maxHp * PATH_COMBAT.white.fullBarrierPct,
      PATH_COMBAT.white.fullBarrierMin,
      PATH_COMBAT.white.fullBarrierMax,
    ));
    notifyDestinyProtectiveLayer("barrier", "white_release", previousBarrier);
    addStatus("天息", PATH_COMBAT.white.fullDuration, {
      incomingMult: PATH_COMBAT.white.fullIncomingMult,
      pickupBonus: PATH_COMBAT.white.fullPickupBonus,
      attractRadius: PATH_COMBAT.white.fullAttractRadius,
      attractSpeed: PATH_COMBAT.white.fullAttractSpeed,
      onKillHealPct: PATH_COMBAT.white.fullHealPct,
      onKillHealCooldown: PATH_COMBAT.white.fullHealCooldown,
    });
    destinyRuntime.emit("status_applied", {
      name: "天息",
      duration: PATH_COMBAT.white.fullDuration,
      source: "white_release",
    });
    markPathImpact("white", PATH_COMBAT.white.fullPulseRadius);
    setToast({ text: "天息已启", tone: "white-release" });
  } else {
    destinyRuntime.emit("release_started", {
      color: "black",
      statusName: "魔沸",
      source: "manual_e",
    });
    pulse(
      state.player.x,
      state.player.y,
      PATH_COMBAT.black.fullPulseRadius,
      computeDamage(PATH_COMBAT.black.fullPulseBase + getPlayerAttackPower() * 1.1),
      "burst",
      true,
      {
        duration: 0.42,
        time: 0.42,
        palette: getPathPalette("black", "release"),
        routeStyle: "meteor",
      },
    );
    addStatus("魔沸", PATH_COMBAT.black.fullDuration, {
      damageMult: PATH_COMBAT.black.fullDamageMult,
      critChanceBonus: PATH_COMBAT.black.fullCritChanceBonus,
      activeCooldownRate: PATH_COMBAT.black.fullActiveCooldownRate,
      blackBurstRadiusMult: PATH_COMBAT.black.fullBurstRadiusMult,
      drain: PATH_COMBAT.black.fullDrain,
    });
    destinyRuntime.emit("status_applied", {
      name: "魔沸",
      duration: PATH_COMBAT.black.fullDuration,
      source: "black_release",
    });
    markPathImpact("black", PATH_COMBAT.black.fullPulseRadius);
    setToast({ text: "魔沸已启", tone: "black-release" });
  }
  resetPathCharge(path);
  return true;
}

function maybeTriggerBlackMomentum(source = "auto") {
  state.blackMomentumCooldown = 0;
  state.blackMomentumTimer = 0;
  state.blackMomentumStacks = 0;
}

function maybeTriggerKillHeal() {
  const profile = getKillHealProfile();
  if (profile.healPct <= 0 || state.whiteKillHealCooldown > 0) return;
  const previousHp = state.player.hp;
  healPlayer(state.player.maxHp * profile.healPct, "white-destiny");
  notifyDestinyHpChanged("white_kill_heal", previousHp);
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

function queueSwordChainFrom(enemy) {
  return enemy;
}

function isSwordSource(source) {
  return typeof source === "string" && source.startsWith("sword");
}

function normalizeSourceId(source) {
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && typeof source.source === "string") return source.source;
  return "player";
}

function buildKillRuntimePayload(enemy, source, extra = {}) {
  const sourceId = normalizeSourceId(source);
  const distanceToPlayer = distance(state.player, enemy);
  const isHighValue = enemy.type === "elite" || enemy.type === "boss" || !!enemy.isMiniBoss;
  return {
    enemy,
    enemyType: enemy.isMiniBoss ? "miniBoss" : enemy.type,
    source: sourceId,
    isHighValue,
    isMeleeKill: distanceToPlayer <= DESTINY_RUNTIME_RULES.meleeRange,
    isExecuteKill: !!extra.isExecuteKill,
    distanceToPlayer,
  };
}

function getActiveSacrificeBoost() {
  return state.pendingActiveSacrificeBoost > 0 ? state.pendingActiveSacrificeBoost : 1;
}

function clearActiveSacrificeBoost() {
  state.pendingActiveSacrificeBoost = 0;
}

function hasRouteCapstone(skillId, skill, routeId = null) {
  const routeStage = getSkillRouteStage(skillId, skill);
  if (!routeStage?.graduated) return false;
  return routeId ? routeStage.routeId === routeId : true;
}

function getSkillRewriteLayer(skillId, destinyId) {
  const rewriteState = destinyRuntime.getSkillRewriteState(skillId);
  return rewriteState.entries.find((entry) => entry.destinyId === destinyId)?.layer || "inactive";
}

function applyRewriteNumbers(target, source) {
  if (!source) return;
  Object.entries(source).forEach(([key, value]) => {
    if (!Number.isFinite(value)) return;
    if (key.endsWith("Mult")) {
      target[key] = (target[key] ?? 1) * value;
      return;
    }
    target[key] = (target[key] ?? 0) + value;
  });
}

function getSwordRewriteProfile() {
  const profile = {
    autoVolleyBonus: 0,
    projectileSpeedMult: 1,
    activeVolleyBonus: 0,
    activeProjectileSpeedMult: 1,
    turnRateMult: 1,
    damageMult: 1,
    projectileRadiusMult: 1,
    activeDamageMult: 1,
    activeWidthMult: 1,
    activeDurationBonus: 0,
    pressureBonus: 0,
  };
  const bindings = DESTINY_RUNTIME_RULES.skillRewriteBindings;
  [
    ["wanjian", bindings.wanjian],
    ["juque", bindings.juque],
  ].forEach(([destinyId, binding]) => {
    const layer = getSkillRewriteLayer("sword", destinyId);
    if (layer === "base") applyRewriteNumbers(profile, binding.base);
    if (layer === "signature") applyRewriteNumbers(profile, binding.signature);
  });
  return profile;
}

function getThunderRewriteProfile() {
  const profile = {
    chainCountBonus: 0,
    chainRangeBonus: 0,
    newTargetBias: 0,
    activeRangeMult: 1,
    activeDurationBonus: 0,
    activeJumpBonus: 0,
    activeRadiusMult: 1,
    activeStrikeBonus: 0,
    bossOpenerMult: 1,
  };
  const bindings = DESTINY_RUNTIME_RULES.skillRewriteBindings;
  [
    ["jiuzhuan", bindings.jiuzhuan],
    ["leiyu", bindings.leiyu],
  ].forEach(([destinyId, binding]) => {
    const layer = getSkillRewriteLayer("thunder", destinyId);
    if (layer === "base") applyRewriteNumbers(profile, binding.base);
    if (layer === "signature") applyRewriteNumbers(profile, binding.signature);
  });
  return profile;
}

function getFlameRewriteProfile() {
  const profile = {
    innerDamageMult: 1,
    burnDurationBonus: 0,
    outerRadiusMult: 1,
    lingerDurationBonus: 0,
    meteorDamageMult: 1,
    meteorCountBonus: 0,
    meteorBurstBonus: 0,
    zoneRadiusBonus: 0,
    zoneDurationBonus: 0,
    zoneSlowBonus: 0,
  };
  const bindings = DESTINY_RUNTIME_RULES.skillRewriteBindings;
  [
    ["jiehuo", bindings.jiehuo],
    ["lihuo", bindings.lihuo],
  ].forEach(([destinyId, binding]) => {
    const layer = getSkillRewriteLayer("flame", destinyId);
    if (layer === "base") applyRewriteNumbers(profile, binding.base);
    if (layer === "signature") applyRewriteNumbers(profile, binding.signature);
  });
  return profile;
}

function getGuardRewriteProfile() {
  const profile = {
    maxShieldMult: 1,
    barrierShellDurationBonus: 0,
    bulwarkRadiusMult: 1,
    shieldRegenPctPerSecond: 0,
    counterPushMult: 1,
    counterShockMult: 1,
    reflectDamageMult: 1,
    finaleDamageMult: 1,
    reflectGuaranteed: 0,
  };
  const bindings = DESTINY_RUNTIME_RULES.skillRewriteBindings;
  [
    ["xuangang", bindings.xuangang],
    ["fantian", bindings.fantian],
  ].forEach(([destinyId, binding]) => {
    const layer = getSkillRewriteLayer("guard", destinyId);
    if (layer === "base") applyRewriteNumbers(profile, binding.base);
    if (layer === "signature") applyRewriteNumbers(profile, binding.signature);
  });
  return profile;
}

function syncGuardRewriteState(skill) {
  if (!skill) return getGuardRewriteProfile();
  const profile = getGuardRewriteProfile();
  skill.baseMaxShield = Number.isFinite(skill.baseMaxShield) ? skill.baseMaxShield : skill.maxShield;
  const previousMult = Number.isFinite(skill.appliedGuardRewriteMaxShieldMult)
    ? skill.appliedGuardRewriteMaxShieldMult
    : 1;
  const previousMaxShield = Math.max(1, skill.baseMaxShield * previousMult);
  const nextMaxShield = Math.max(1, skill.baseMaxShield * profile.maxShieldMult);
  if (!Number.isFinite(skill.shield)) skill.shield = nextMaxShield;
  if (Math.abs(previousMaxShield - nextMaxShield) > 0.001) {
    const ratio = clamp(skill.shield / previousMaxShield, 0, 1.5);
    skill.maxShield = nextMaxShield;
    skill.shield = clamp(nextMaxShield * ratio, 0, nextMaxShield);
  } else {
    skill.maxShield = nextMaxShield;
    skill.shield = clamp(skill.shield, 0, nextMaxShield);
  }
  skill.appliedGuardRewriteMaxShieldMult = profile.maxShieldMult;
  return profile;
}

function activateGuiyuanHealBuff() {
  if (!isGuiyuanActive()) return;
  addStatus("归元", 3.2, {
    damageMult: 1.12,
  });
}

function healFromBlackMeleeKill(enemy) {
  if (!isGuiyuanActive()) return;
  if (distance(state.player, enemy) > PATH_COMBAT.gain.meleeRange) return;
  const previousHp = state.player.hp;
  healPlayer(state.player.maxHp * 0.04, "generic");
  notifyDestinyHpChanged("guiyuan_melee_kill_heal", previousHp);
}

function getSwordTargets(count, extraCount = 0) {
  const targets = [...state.enemies];
  if (state.boss) targets.push(state.boss);
  return targets
    .sort((a, b) => distance(a, state.player) - distance(b, state.player))
    .slice(0, Math.max(0, count + extraCount));
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return distance(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  const projX = start.x + dx * t;
  const projY = start.y + dy * t;
  return Math.hypot(point.x - projX, point.y - projY);
}

function resolveGreatswordLane(skill) {
  const priorityTarget = pickPriorityTarget(state.player);
  const cluster = getEnemyClusterCenter(state.player);
  const focus = priorityTarget || cluster || getForwardPoint(120);
  const angle = Math.atan2(focus.y - state.player.y, focus.x - state.player.x);
  const laneLength = 260 + getSkillBranchCount(skill, "greatsword") * 28;
  const laneLead = 46;
  const start = {
    x: clamp(state.player.x + Math.cos(angle) * laneLead, 40, WIDTH - 40),
    y: clamp(state.player.y + Math.sin(angle) * laneLead, 40, HEIGHT - 40),
  };
  const end = {
    x: start.x + Math.cos(angle) * laneLength,
    y: start.y + Math.sin(angle) * laneLength,
  };
  return {
    start,
    end,
    angle,
    length: laneLength,
    focus,
    priorityTarget,
  };
}

function resolveThunderStormTarget() {
  const cluster = getEnemyClusterCenter(state.player, 190);
  if (cluster && cluster.count >= 3) {
    return {
      x: clamp(cluster.x, 80, WIDTH - 80),
      y: clamp(cluster.y, 80, HEIGHT - 80),
      reason: "cluster",
    };
  }
  const threat = pickPriorityTarget(state.player) || nearestEnemyFromPoint(state.player);
  if (threat) {
    return {
      x: clamp(threat.x, 80, WIDTH - 80),
      y: clamp(threat.y, 80, HEIGHT - 80),
      reason: "threat",
    };
  }
  const forward = getForwardPoint(120);
  return {
    x: clamp(forward.x, 80, WIDTH - 80),
    y: clamp(forward.y, 80, HEIGHT - 80),
    reason: "forward",
  };
}

function scoreChainTarget(target, origin, effect) {
  const visitPenalty = effect.visited.has(target) ? 220 : 0;
  const repeatPenalty = (effect.hitCounts.get(target) || 0) * 160;
  const eliteBonus = target.type === "boss" || target.isMiniBoss || target.type === "elite" ? 160 : 0;
  const newTargetBonus = effect.visited.has(target) ? 0 : 180 + effect.newTargetBias * 65;
  return getThreatScore(target, origin, { preferLowHp: true }) + eliteBonus + newTargetBonus - visitPenalty - repeatPenalty;
}

function pickChainJumpTarget(origin, effect) {
  const targets = getCombatTargets().filter((target) => target !== effect.currentTarget);
  if (!targets.length) return null;
  const inRange = targets.filter((target) => distance(target, origin) <= effect.chainRange + target.radius);
  const pool = inRange.length ? inRange : targets;
  const unvisited = pool.filter((target) => !effect.visited.has(target));
  const candidates = unvisited.length ? unvisited : pool;
  return candidates
    .slice()
    .sort((a, b) => scoreChainTarget(b, origin, effect) - scoreChainTarget(a, origin, effect))[0] || null;
}

function resolveFlameZoneTarget() {
  const cluster = getEnemyClusterCenter(state.player, 150);
  if (cluster && cluster.count >= 3) {
    return {
      x: clamp(cluster.x, 60, WIDTH - 60),
      y: clamp(cluster.y, 60, HEIGHT - 60),
      reason: "cluster",
    };
  }
  const threat = pickPriorityTarget(state.player) || nearestEnemyFromPoint(state.player);
  if (threat) {
    const dx = threat.x - state.player.x;
    const dy = threat.y - state.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    return {
      x: clamp(state.player.x + (dx / dist) * 90, 60, WIDTH - 60),
      y: clamp(state.player.y + (dy / dist) * 90, 60, HEIGHT - 60),
      reason: "front-threat",
    };
  }
  const forward = getForwardPoint(96);
  return {
    x: forward.x,
    y: forward.y,
    reason: "forward",
  };
}

function resolveMeteorFieldTarget() {
  const cluster = getEnemyClusterCenter(state.player, 170);
  if (cluster && cluster.count >= 2) {
    return {
      x: clamp(cluster.x, 70, WIDTH - 70),
      y: clamp(cluster.y, 70, HEIGHT - 70),
      reason: "cluster",
    };
  }
  const threat = pickPriorityTarget(state.player, { preferLowHp: true }) || nearestEnemyFromPoint(state.player);
  if (threat) {
    return {
      x: clamp(threat.x, 70, WIDTH - 70),
      y: clamp(threat.y, 70, HEIGHT - 70),
      reason: "threat",
    };
  }
  const forward = getForwardPoint(108);
  return {
    x: clamp(forward.x, 70, WIDTH - 70),
    y: clamp(forward.y, 70, HEIGHT - 70),
    reason: "forward",
  };
}

function getGuardCounterEffect() {
  return state.activeEffects.find((effect) => effect.kind === "guard-counter-window") || null;
}

function pushEnemyAway(target, source, distanceValue) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  target.x = clamp(target.x + (dx / dist) * distanceValue, 20, WIDTH - 20);
  target.y = clamp(target.y + (dy / dist) * distanceValue, 20, HEIGHT - 20);
}

function triggerGuardCounterShock(effect, scale = 1, source = null) {
  if (!effect || effect.shockCooldown > 0) return;
  effect.shockCooldown = 0.18;
  effect.shockCount += 1;
  const radius = effect.radius * (0.72 + scale * 0.12);
  const damage = effect.damage * (0.78 + scale * 0.18 + effect.shockCount * 0.04);
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius,
    damage: 0,
    kind: "guard-counter-shock",
    time: 0.24,
    duration: 0.24,
    hit: new Set(),
    affectsBoss: true,
    palette: effect.palette || null,
    routeStyle: "counter",
  });
  getCombatTargets().forEach((target) => {
    if (distance(target, state.player) > radius + target.radius) return;
    markTargetHitFx(target, "guard", "counter", effect.palette || null, 0.28, 1.04);
    dealDamage(target, damage, "guard-counter");
    pushEnemyAway(
      target,
      state.player,
      (target.type === "boss" ? 18 : 32 + effect.shockCount * 2) * (effect.pushMult || 1),
    );
  });
  if (source && source.type) {
    state.pulses.push({
      x: source.x,
      y: source.y,
      radius: 20,
      damage: 0,
      kind: "guard-counter-shock",
      time: 0.18,
        duration: 0.18,
        hit: new Set(),
        affectsBoss: true,
        palette: effect.palette || null,
        routeStyle: "counter",
      });
  }
}

function isGuardCounterReactiveSource(source) {
  if (!source || typeof source !== "object") return false;
  if (source.kind === "boss-shot") return true;
  return source.skillId != null || source.category != null;
}

function triggerGuardCounterFinale(effect) {
  const radius = effect.radius + 34;
  const damage = effect.finalDamage * (1 + effect.reflectedCount * 0.06 + effect.shockCount * 0.08);
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius,
    damage: 0,
    kind: "guard-counter-finale",
    time: 0.34,
    duration: 0.34,
    hit: new Set(),
    affectsBoss: true,
    palette: effect.palette || null,
    routeStyle: "counter",
  });
  getCombatTargets().forEach((target) => {
    if (distance(target, state.player) > radius + target.radius) return;
    markTargetHitFx(target, "guard", "counter", effect.palette || null, 0.32, 1.16);
    dealDamage(target, damage, "guard-counter-finale");
    pushEnemyAway(target, state.player, (target.type === "boss" ? 26 : 46) * (effect.pushMult || 1));
  });
}

function reflectEnemyProjectile(projectile, effect) {
  effect.reflectedCount += 1;
  const target = pickPriorityTarget(projectile, { preferLowHp: true });
  const guard = state.player.skills.guard;
  const routeVfx = getSkillRouteVfx("guard", guard);
  let vx = -projectile.vx * 1.18;
  let vy = -projectile.vy * 1.18;
  if (target) {
    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.max(260, Math.hypot(projectile.vx, projectile.vy) * 1.22);
    vx = (dx / dist) * speed;
    vy = (dy / dist) * speed;
  }
  state.projectiles.push({
    x: projectile.x,
    y: projectile.y,
    vx,
    vy,
    radius: projectile.radius + 0.5,
    damage: (effect.damage * 0.72 + projectile.damage * 1.25) * (effect.reflectDamageMult || 1),
    pierce: 1 + (effect.reflectGuaranteed || 0),
    life: 2.4,
    color: routeVfx.palette?.primary || "#dce9ff",
    kind: "guard-counter-shot",
    routeStyle: "counter",
    palette: routeVfx.palette || effect.palette || null,
    impactKind: "guard-counter-hit",
  });
  state.pulses.push({
    x: projectile.x,
    y: projectile.y,
    radius: 18,
    damage: 0,
    kind: "guard-counter-shock",
    time: 0.18,
    duration: 0.18,
    hit: new Set(),
    affectsBoss: true,
  });
}

function updatePathBehavior(dt) {
  state.noHitTimer += dt;
  state.whiteKillHealCooldown = Math.max(0, state.whiteKillHealCooldown - dt);
  state.blackLowHpKillCooldown = Math.max(0, state.blackLowHpKillCooldown - dt);
  state.blackMomentumCooldown = Math.max(0, state.blackMomentumCooldown - dt);
  state.blackMomentumTimer = Math.max(0, state.blackMomentumTimer - dt);
  if (state.blackMomentumTimer <= 0) state.blackMomentumStacks = 0;
  destinyRuntime.tick(dt);

  if (!state.whitePath.full && state.noHitTimer >= PATH_COMBAT.gain.whiteUntouchedDelay) {
    state.whiteUntouchedRewardTimer += dt;
    if (state.whiteUntouchedRewardTimer >= PATH_COMBAT.gain.whiteUntouchedInterval) {
      state.whiteUntouchedRewardTimer -= PATH_COMBAT.gain.whiteUntouchedInterval;
      fillPath("white", PATH_COMBAT.gain.whiteUntouchedValue, {
        kind: "steady_white",
        source: "untouched_loop",
      });
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
  const routeConfig = skillRouteTable[id];
  const routePoints = routeConfig
    ? Object.fromEntries(Object.keys(routeConfig.routes).map((routeId) => [routeId, 0]))
    : {};
  if (id === "sword") {
    gameState.player.skills.sword = {
      id,
      rank: 1,
      cooldown: base.baseCooldown,
      damage: base.baseDamage,
      projectiles: 1,
      pierce: 0,
      timer: 0.2,
      activeTimer: 0,
      baseUpgrades: 0,
      route: null,
      capstone: null,
      routePoints,
      takenChoices: {},
      swarmVolleyBonus: 0,
      greatswordWidthBonus: 0,
      greatswordDurationBonus: 0,
      greatswordPressureBonus: 0,
    };
  } else if (id === "thunder") {
    gameState.player.skills.thunder = {
      id,
      rank: 1,
      cooldown: base.baseCooldown,
      baseDamage: base.baseDamage,
      deepenStacks: 0,
      timer: 0.6,
      chain: 0,
      splash: base.splash,
      activeTimer: 0,
      baseUpgrades: 0,
      route: null,
      capstone: null,
      routePoints,
      takenChoices: {},
      chainFocus: 0,
      chainRangeBonus: 0,
      chainNewTargetBias: 0,
      stormFocus: 0,
      stormDurationBonus: 0,
      stormStrikeBonus: 0,
    };
  } else if (id === "flame") {
    gameState.player.skills.flame = {
      id,
      rank: 1,
      radius: base.radius,
      timer: 0.1,
      tick: base.tick,
      damage: base.damage,
      burst: false,
      activeTimer: 0,
      baseUpgrades: 0,
      route: null,
      capstone: null,
      routePoints,
      takenChoices: {},
      meteorFocus: 0,
      meteorCountBonus: 0,
      meteorBurstBonus: 0,
      zoneFocus: 0,
      zoneRadiusBonus: 0,
      zoneDurationBonus: 0,
      zoneSlowBonus: 0,
    };
  } else if (id === "guard") {
    gameState.player.skills.guard = {
      id,
      rank: 1,
      baseMaxShield: base.shield,
      maxShield: base.shield,
      shield: base.shield,
      recharge: base.recharge,
      timer: 0,
      burst: false,
      activeTimer: 0,
      baseUpgrades: 0,
      route: null,
      capstone: null,
      routePoints,
      takenChoices: {},
      bulwarkFocus: 0,
      bulwarkLastStandCooldown: 0,
      counterFocus: 0,
      counterWindowBonus: 0,
      counterShockBonus: 0,
    };
  }
  gameState.player.skillOrder.push(id);
  gameState.player.skillFocus[id] = (gameState.player.skillFocus[id] || 0) + 1;
  if (gameState === state) {
    destinyRuntime.emit("skill_learned", { skillId: id });
    if (id === "guard") {
      syncGuardRewriteState(gameState.player.skills.guard);
      notifyDestinyProtectiveLayer("guard-shield", "guard_skill_learned", 0, gameState.player.skills.guard.shield);
    }
  }
}

window.unlockSkill = unlockSkill;

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
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "sword", (skill) => {
      skill.projectiles += 1;
    }),
  },
  {
    id: "sword-dmg",
    name: "御剑增幅",
    desc: "飞剑伤害 +35%。",
    canTake: (stateRef) => !!stateRef.player.skills.sword,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "sword", (skill) => {
      skill.damage *= 1.35;
    }),
  },
  {
    id: "sword-pierce",
    name: "贯心",
    desc: "飞剑可穿透 1 个目标。",
    canTake: (stateRef) => !!stateRef.player.skills.sword,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "sword", (skill) => {
      skill.pierce += 1;
    }),
  },
  {
    id: "sword-swarm-1",
    name: "剑幕扩容",
    desc: "分路：剑潮流。御剑如潮，重在铺场清群，以连绵剑势压得敌阵难近身。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "swarm", "sword-swarm-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "swarm", "sword-swarm-1", (skill) => {
      skill.projectiles += 2;
      skill.swarmVolleyBonus += 1;
    }),
  },
  {
    id: "sword-swarm-2",
    name: "万刃同调",
    desc: "飞剑伤害 +10%，万剑归宗追加剑雨数量。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "swarm", "sword-swarm-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "swarm", "sword-swarm-2", (skill) => {
      skill.damage *= 1.1;
      skill.swarmVolleyBonus += 2;
    }),
  },
  {
    id: "sword-swarm-capstone",
    name: "万剑齐发",
    desc: "普攻飞剑数量永久 +2，主动技剑潮会瞬时铺满战场。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "sword", "swarm", "sword-swarm-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "sword", "swarm", "sword-swarm-capstone", (skill) => {
      skill.projectiles += 2;
      skill.swarmVolleyBonus += 4;
    }),
  },
  {
    id: "sword-great-1",
    name: "巨刃凝形",
    desc: "分路：大剑流。凝剑成阙，走的是少剑重斩的路数，专以沉重剑势镇压强敌。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "greatsword", "sword-great-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "greatsword", "sword-great-1", (skill) => {
      skill.greatswordWidthBonus += 1;
      skill.damage *= 1.12;
    }),
  },
  {
    id: "sword-great-2",
    name: "斩界延锋",
    desc: "巨阙镇场持续更久，并更擅长压制精英与 Boss。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "greatsword", "sword-great-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "greatsword", "sword-great-2", (skill) => {
      skill.greatswordDurationBonus += 0.45;
      skill.greatswordPressureBonus += 0.18;
    }),
  },
  {
    id: "sword-great-capstone",
    name: "巨阙镇场",
    desc: "巨剑更长、更久、更重，普攻重剑存在感也会同步抬高。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "sword", "greatsword", "sword-great-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "sword", "greatsword", "sword-great-capstone", (skill) => {
      skill.damage *= 1.12;
      skill.greatswordWidthBonus += 1;
      skill.greatswordDurationBonus += 0.8;
      skill.greatswordPressureBonus += 0.22;
    }),
  },
  {
    id: "thunder-fast",
    name: "疾雷",
    desc: "掌心雷冷却 -20%。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "thunder", (skill) => {
      skill.cooldown *= 0.8;
    }),
  },
  {
    id: "thunder-dmg",
    name: "雷息加深",
    desc: "掌心雷伤害 +40%。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "thunder", (skill) => {
      skill.deepenStacks += 1;
    }),
  },
  {
    id: "thunder-chain",
    name: "连锁惊雷",
    desc: "落雷会再弹射 2 个目标。",
    canTake: (stateRef) => !!stateRef.player.skills.thunder,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "thunder", (skill) => {
      skill.chain += 2;
    }),
  },
  {
    id: "thunder-branch-chain-1",
    name: "引雷传导",
    desc: "分路：连锁流。雷意走脉成网，讲究追杀漏网与牵连群敌，让电光不断场。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "chain", "thunder-branch-chain-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "chain", "thunder-branch-chain-1", (skill) => {
      skill.chain += 1;
      skill.chainFocus += 1;
      skill.chainRangeBonus += 22;
    }),
  },
  {
    id: "thunder-branch-chain-2",
    name: "穿电成网",
    desc: "连锁更爱追新目标，目标不足时回跳衰减更平滑。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "chain", "thunder-branch-chain-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "chain", "thunder-branch-chain-2", (skill) => {
      skill.chainFocus += 1;
      skill.chainRangeBonus += 30;
      skill.chainNewTargetBias += 1;
    }),
  },
  {
    id: "thunder-chain-capstone",
    name: "连锁天雷",
    desc: "普攻链路再扩 2 跳，主动技追链更稳更快。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "thunder", "chain", "thunder-chain-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "thunder", "chain", "thunder-chain-capstone", (skill) => {
      skill.chain += 2;
      skill.chainFocus += 1;
      skill.chainRangeBonus += 24;
      skill.chainNewTargetBias += 1;
    }),
  },
  {
    id: "thunder-branch-storm-1",
    name: "雷云积势",
    desc: "锁定天罚流。主动技会留下一个雷池，持续落雷轰击范围内敌人，并延长雷池持续时间。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "storm", "thunder-branch-storm-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "storm", "thunder-branch-storm-1", (skill) => {
      skill.stormFocus += 1;
      skill.stormDurationBonus += 0.35;
    }),
  },
  {
    id: "thunder-branch-storm-2",
    name: "千击雷幕",
    desc: "掌心雷·天罚落雷密度提高，并补强主动爆发。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "storm", "thunder-branch-storm-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "storm", "thunder-branch-storm-2", (skill) => {
      skill.stormFocus += 1;
      skill.stormStrikeBonus += 1;
    }),
  },
  {
    id: "thunder-storm-capstone",
    name: "九霄雷池",
    desc: "主动技拉成长驻雷池，区域统治和开窗爆发会明显抬高。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "thunder", "storm", "thunder-storm-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "thunder", "storm", "thunder-storm-capstone", (skill) => {
      skill.stormFocus += 1;
      skill.stormDurationBonus += 1.2;
      skill.stormStrikeBonus += 2;
    }),
  },
  {
    id: "flame-radius",
    name: "炎环扩张",
    desc: "火环半径 +20%。",
    canTake: (stateRef) => !!stateRef.player.skills.flame,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "flame", (skill) => {
      skill.radius *= 1.2;
    }),
  },
  {
    id: "flame-dmg",
    name: "烈焰",
    desc: "火环伤害 +30%。",
    canTake: (stateRef) => !!stateRef.player.skills.flame,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "flame", (skill) => {
      skill.damage *= 1.3;
    }),
  },
  {
    id: "flame-burst",
    name: "焚爆",
    desc: "被点燃敌人死亡时会爆炸。",
    canTake: (stateRef) => !!stateRef.player.skills.flame && !stateRef.player.skills.flame.burst,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "flame", (skill) => {
      skill.burst = true;
    }),
  },
  {
    id: "flame-meteor-1",
    name: "灼骨",
    desc: "分路：爆落流。火势内敛藏锋，贴身焚骨，再以陨火坠地把近前敌人一并烧穿。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "meteor", "flame-meteor-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "meteor", "flame-meteor-1", (skill) => {
      skill.damage *= 1.16;
      skill.meteorFocus += 1;
    }),
  },
  {
    id: "flame-meteor-2",
    name: "薪火催燃",
    desc: "陨火天坠追加爆燃余波，并强化点燃收割。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "meteor", "flame-meteor-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "meteor", "flame-meteor-2", (skill) => {
      skill.meteorFocus += 1;
      skill.meteorBurstBonus += 1;
      skill.burst = true;
    }),
  },
  {
    id: "flame-meteor-capstone",
    name: "烬狱轮转",
    desc: "陨火天坠每波额外追加 2 颗陨石。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "flame", "meteor", "flame-meteor-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "flame", "meteor", "flame-meteor-capstone", (skill) => {
      skill.meteorCountBonus += 2;
    }),
  },
  {
    id: "flame-zone-1",
    name: "焰域外推",
    desc: "分路：封区流。火环外扩成域，以留焰断路逼位，让敌人步步受炙、难越雷池。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "zone", "flame-zone-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "zone", "flame-zone-1", (skill) => {
      skill.zoneFocus += 1;
      skill.zoneRadiusBonus += 24;
    }),
  },
  {
    id: "flame-zone-2",
    name: "火幕成圏",
    desc: "留焰封区半径进一步扩大。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "zone", "flame-zone-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "zone", "flame-zone-2", (skill) => {
      skill.zoneFocus += 1;
      skill.zoneRadiusBonus += 32;
    }),
  },
  {
    id: "flame-zone-capstone",
    name: "焚身领域",
    desc: "留焰封区半径大幅扩大，主动技结束后仍会留下余焰继续封区。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "flame", "zone", "flame-zone-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "flame", "zone", "flame-zone-capstone", (skill) => {
      skill.zoneFocus += 1;
      skill.zoneRadiusBonus += 40;
    }),
  },
  {
    id: "guard-strong",
    name: "厚钟",
    desc: "护盾值 +35%。",
    canTake: (stateRef) => !!stateRef.player.skills.guard,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "guard", (skill) => {
      skill.baseMaxShield = (skill.baseMaxShield || skill.maxShield) * 1.35;
      skill.maxShield *= 1.35;
      skill.shield = Math.min(skill.maxShield, skill.shield * 1.35);
    }),
  },
  {
    id: "guard-recharge",
    name: "金钟重铸",
    desc: "护盾恢复时间 -20%。",
    canTake: (stateRef) => !!stateRef.player.skills.guard,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "guard", (skill) => {
      skill.recharge *= 0.8;
    }),
  },
  {
    id: "guard-burst",
    name: "震返",
    desc: "破盾时释放冲击波。",
    canTake: (stateRef) => !!stateRef.player.skills.guard && !stateRef.player.skills.guard.burst,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "guard", (skill) => {
      skill.burst = true;
    }),
  },
  {
    id: "guard-bulwark-1",
    name: "金城难破",
    desc: "分路：护体流。金钟覆体，重在镇退近身敌势与稳住场面，但主动技本身不拦远程攻势。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-1", (skill) => {
      skill.baseMaxShield = (skill.baseMaxShield || skill.maxShield) * 1.18;
      skill.maxShield *= 1.18;
      skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * 0.35);
      skill.bulwarkFocus += 1;
    }),
  },
  {
    id: "guard-bulwark-2",
    name: "钟体回潮",
    desc: "金钟震荡后更快重整护体，护盾恢复节奏更强。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-2", (skill) => {
      skill.recharge *= 0.86;
      skill.bulwarkFocus += 1;
    }),
  },
  {
    id: "guard-bulwark-capstone",
    name: "不灭金钟",
    desc: "破盾后会强撑一口气并重整护体，主动技更像稳场重置按钮。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "guard", "bulwark", "guard-bulwark-capstone", (skill) => {
      skill.baseMaxShield *= 1.15;
      skill.maxShield *= 1.15;
      skill.shield = skill.maxShield;
      skill.bulwarkFocus += 1;
    }),
  },
  {
    id: "guard-counter-1",
    name: "镜返",
    desc: "分路：弹反流。借敌势而鸣钟，主要反制远程与技能攻势，普通近身攻击不会被弹反。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "counter", "guard-counter-1", "intro"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "counter", "guard-counter-1", (skill) => {
      skill.counterFocus += 1;
      skill.counterWindowBonus += 0.18;
    }),
  },
  {
    id: "guard-counter-2",
    name: "钟鸣反震",
    desc: "返天钟鸣的弹道回击与近身反震更强。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "counter", "guard-counter-2", "followup"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "counter", "guard-counter-2", (skill) => {
      skill.counterFocus += 1;
      skill.counterShockBonus += 1;
    }),
  },
  {
    id: "guard-counter-capstone",
    name: "返天钟鸣",
    desc: "主动技窗口会被拉长，并显著抬高反震、反弹与借力反打收益。",
    canTake: (stateRef) => canTakeCapstoneUpgrade(stateRef, "guard", "counter", "guard-counter-capstone"),
    apply: (stateRef) => applySkillCapstoneUpgrade(stateRef, "guard", "counter", "guard-counter-capstone", (skill) => {
      skill.counterFocus += 1;
      skill.counterWindowBonus += 0.35;
      skill.counterShockBonus += 1;
    }),
  },
];

window.__debug_apply_level_choice = (choiceId) => {
  const choice = levelChoices.find((entry) => entry.id === choiceId);
  if (!choice || !choice.canTake(state)) return false;
  state.routeShiftNotice = "";
  choice.apply(state);
  handlePostChoiceRuntimeHooks(choice, state);
  render();
  return true;
};

function scoreChoice(choice, main) {
  let score = 1;
  const skillTag = getChoiceSkillTag(choice);
  const skill = skillTag ? state.player.skills[skillTag] : null;
  const routeMeta = getChoiceRouteMeta(choice);
  if (choice.id.startsWith("new-") && state.player.skillOrder.length < 3) {
    score += 3;
    score *= getTechniqueDestinySkillWeightMult(choice.id.replace("new-", ""));
  }
  if (main && choice.id.includes(main)) score += 3;
  if (skillTag && state.player.skills[skillTag] && skillTag !== main) score += 2.5;
  if (routeMeta) {
    score += routeMeta.kind === "capstone" ? 3.6 : 1.25;
    if (skill?.route) score += 1.6;
    if (routeMeta.kind === "capstone" && skill?.route === routeMeta.routeId) score += 2.4;
  }
  if (choice.id === "life" && state.player.hp < state.player.maxHp * 0.55) score += 3;
  if (choice.id.startsWith("guard") && state.player.hp < state.player.maxHp * 0.6) score += 2;
  return score + Math.random();
}

function getChoiceSkillTag(choice) {
  const prefixes = ["sword", "thunder", "flame", "guard"];
  return prefixes.find((prefix) => choice.id === `new-${prefix}` || choice.id.startsWith(`${prefix}-`)) || null;
}

function getTechniqueDestinySkillWeightMult(skillId, stateRef = state, metaStateRef = metaState) {
  if (!skillId || stateRef.player.skillOrder.length >= 3 || stateRef.player.skills[skillId]) return 1;
  const configuredMult = BALANCE.destinyTable?.techniqueUnlearnedNewSkillWeightMult || 1;
  return getEquippedDestinyEntriesImpl(metaStateRef).reduce((mult, entry) => {
    if (entry.def?.category !== "skill-rewrite") return mult;
    return TECHNIQUE_DESTINY_SKILL_MAP[entry.id] === skillId ? Math.max(mult, configuredMult) : mult;
  }, 1);
}

function getChoiceRouteMeta(choice) {
  if (choice.id === "sword-swarm-capstone") return { skillId: "sword", routeId: "swarm", kind: "capstone" };
  if (choice.id === "sword-great-capstone") return { skillId: "sword", routeId: "greatsword", kind: "capstone" };
  if (choice.id === "thunder-chain-capstone") return { skillId: "thunder", routeId: "chain", kind: "capstone" };
  if (choice.id === "thunder-storm-capstone") return { skillId: "thunder", routeId: "storm", kind: "capstone" };
  if (choice.id === "flame-meteor-capstone") return { skillId: "flame", routeId: "meteor", kind: "capstone" };
  if (choice.id === "flame-zone-capstone") return { skillId: "flame", routeId: "zone", kind: "capstone" };
  if (choice.id === "guard-bulwark-capstone") return { skillId: "guard", routeId: "bulwark", kind: "capstone" };
  if (choice.id === "guard-counter-capstone") return { skillId: "guard", routeId: "counter", kind: "capstone" };
  if (choice.id.startsWith("sword-swarm-")) return { skillId: "sword", routeId: "swarm", kind: "branch" };
  if (choice.id.startsWith("sword-great-")) return { skillId: "sword", routeId: "greatsword", kind: "branch" };
  if (choice.id.startsWith("thunder-branch-chain-")) return { skillId: "thunder", routeId: "chain", kind: "branch" };
  if (choice.id.startsWith("thunder-branch-storm-")) return { skillId: "thunder", routeId: "storm", kind: "branch" };
  if (choice.id.startsWith("flame-meteor-")) return { skillId: "flame", routeId: "meteor", kind: "branch" };
  if (choice.id.startsWith("flame-zone-")) return { skillId: "flame", routeId: "zone", kind: "branch" };
  if (choice.id.startsWith("guard-bulwark-")) return { skillId: "guard", routeId: "bulwark", kind: "branch" };
  if (choice.id.startsWith("guard-counter-")) return { skillId: "guard", routeId: "counter", kind: "branch" };
  return null;
}

function getChoiceBranchMeta(choice) {
  const routeMeta = getChoiceRouteMeta(choice);
  return routeMeta?.kind === "branch"
    ? { skillId: routeMeta.skillId, routeId: routeMeta.routeId }
    : null;
}

function getChoiceCapstoneMeta(choice) {
  const routeMeta = getChoiceRouteMeta(choice);
  return routeMeta?.kind === "capstone"
    ? { skillId: routeMeta.skillId, routeId: routeMeta.routeId }
    : null;
}

function handlePostChoiceRuntimeHooks(choice, stateRef = state) {
  if (stateRef !== state) return;
  const routeMeta = getChoiceRouteMeta(choice);
  if (routeMeta) {
    const currentRoute = state.player.skills[routeMeta.skillId]?.route || null;
    if (currentRoute === routeMeta.routeId) {
      destinyRuntime.emit("skill_route_locked", routeMeta);
    }
    return;
  }
  const skillId = getChoiceSkillTag(choice);
  if (skillId && state.player.skills[skillId]) {
    destinyRuntime.getSkillRewriteState(skillId);
  }
}

function getPendingBranchSkills(gameState) {
  const skillIndex = new Map(gameState.player.skillOrder.map((skillId, index) => [skillId, index]));
  return gameState.player.skillOrder
    .map((skillId) => {
      const skill = gameState.player.skills[skillId];
      const routeConfig = skillRouteTable[skillId];
      if (!skill || !routeConfig || skill.route || (skill.baseUpgrades || 0) < BRANCH_UNLOCK_BASE_UPGRADES) return null;
      return {
        skillId,
        routeIds: Object.keys(routeConfig.routes || {}),
        readyOrder: skill.branchReadyOrder ?? 1000 + (skillIndex.get(skillId) || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.readyOrder - b.readyOrder || (skillIndex.get(a.skillId) || 0) - (skillIndex.get(b.skillId) || 0));
}

function getPendingCapstoneSkills(gameState) {
  return gameState.player.skillOrder
    .map((skillId) => {
      const skill = gameState.player.skills[skillId];
      const routeId = skill?.route || null;
      if (!skill || !routeId) return null;
      if ((skill.routePoints?.[routeId] || 0) < 2) return null;
      if (skill.capstone === routeId) return null;
      return {
        skillId,
        routeId,
        focus: gameState.player.skillFocus[skillId] || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.focus - a.focus);
}

function collectGuaranteedBranchEntries(scoredPool, pendingBranchSkills) {
  const guaranteed = [];
  const takenIds = new Set();
  const takeEntry = (entry) => {
    if (!entry || takenIds.has(entry.choice.id) || guaranteed.length >= 3) return;
    guaranteed.push(entry);
    takenIds.add(entry.choice.id);
  };
  const getBranchEntriesForSkill = (skillId) => scoredPool.filter((entry) => {
    const branchMeta = getChoiceBranchMeta(entry.choice);
    return branchMeta?.skillId === skillId;
  });
  const primaryPending = pendingBranchSkills[0];
  if (primaryPending) {
    primaryPending.routeIds.forEach((routeId) => {
      const routeEntry = scoredPool.find((entry) => {
        const branchMeta = getChoiceBranchMeta(entry.choice);
        return branchMeta?.skillId === primaryPending.skillId && branchMeta.routeId === routeId;
      });
      takeEntry(routeEntry);
    });
    if (guaranteed.length < BRANCH_CHOICE_GUARANTEE_COUNT) {
      getBranchEntriesForSkill(primaryPending.skillId).forEach((entry) => takeEntry(entry));
    }
  }
  pendingBranchSkills.slice(1).forEach((pending) => {
    if (guaranteed.length >= 3) return;
    const branchEntry = getBranchEntriesForSkill(pending.skillId).find((entry) => !takenIds.has(entry.choice.id));
    takeEntry(branchEntry);
  });
  return guaranteed;
}

function collectGuaranteedCapstoneEntries(scoredPool, pendingCapstoneSkills) {
  const guaranteed = [];
  const takenIds = new Set();
  pendingCapstoneSkills.forEach((pending) => {
    if (guaranteed.length >= 2) return;
    const entry = scoredPool.find((candidate) => {
      const meta = getChoiceCapstoneMeta(candidate.choice);
      return meta?.skillId === pending.skillId && meta.routeId === pending.routeId && !takenIds.has(candidate.choice.id);
    });
    if (!entry) return;
    guaranteed.push(entry);
    takenIds.add(entry.choice.id);
  });
  return guaranteed;
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

  collectGuaranteedCapstoneEntries(scoredPool, getPendingCapstoneSkills(state)).forEach((entry) => takeChoice(entry));
  collectGuaranteedBranchEntries(scoredPool, getPendingBranchSkills(state)).forEach((entry) => takeChoice(entry));

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
        state.routeShiftNotice = "";
        choice.apply(state);
        handlePostChoiceRuntimeHooks(choice, state);
        state.pendingLevelUps -= 1;
        closeModal();
        setToast(state.routeShiftNotice || `获得 ${choice.name}`);
        state.routeShiftNotice = "";
        if (state.pendingLevelUps > 0) openLevelUp();
        else state.paused = false;
      },
    })),
  });
}

function maybeOpenPendingLevelUp() {
  if (state.pendingLevelUps <= 0) return;
  if (state.currentModal) return;
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
  return 1 + (state.campaign.runIndex - 1) * 0.3 + (state.campaign.stageIndex - 1) * 0.2;
}

function isXianzhongThreatEnemy(enemy) {
  return !!enemy && (enemy.type === "elite" || enemy.type === "charger" || enemy.type === "ranged");
}

function applyDestinyEnemySpawnModifiers(enemy) {
  if (!enemy || enemy.destinySpawnAdjusted) return enemy;
  enemy.destinySpawnAdjusted = true;
  if (hasEquippedDestiny("xianzhong") && isXianzhongThreatEnemy(enemy) && enemy.type !== "boss") {
    const hpMult = DESTINY_RUNTIME_RULES.xianzhong?.highThreatHpMult || 1;
    const damageMult = DESTINY_RUNTIME_RULES.xianzhong?.highThreatDamageMult || 1;
    enemy.hp *= hpMult;
    enemy.maxHp *= hpMult;
    enemy.damage *= damageMult;
    enemy.xianzhongRiskBoosted = true;
  }
  return enemy;
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
  const enemy = {
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
  };
  state.enemies.push(applyDestinyEnemySpawnModifiers(enemy));
}

function getMiniBossConfig(stageIndex = state.campaign.stageIndex) {
  return BALANCE.miniBossTable?.[stageIndex]
    || BALANCE.miniBossTable?.default
    || BALANCE.miniBossTable?.[1]
    || null;
}

function spawnMiniBoss() {
  const config = getMiniBossConfig();
  const template = enemies[config?.baseType || "elite"] || enemies.elite;
  const color = Math.random() < 0.5 ? "white" : "black";
  const enemy = {
    type: config?.baseType || "elite",
    x: WIDTH / 2,
    y: 90,
    hp: (config?.hp || template.hp) * enemyHealthMult(),
    maxHp: (config?.hp || template.hp) * enemyHealthMult(),
    damage: (config?.damage || template.damage) * enemyDamageMult(),
    speed: config?.speed || template.speed,
    radius: config?.radius || (template.radius + 4),
    color,
    shotTimer: config?.shotCooldown || template.shotCooldown || 1.2,
    dashTimer: config?.dashCooldown || template.dashCooldown || 1.4,
    attackTimer: config?.meleeCooldown || template.meleeCooldown || 0.5,
    burn: 0,
    isMiniBoss: true,
    miniBossKind: config?.id || "elite_guard",
    miniBossConfig: config ? { ...config } : null,
  };
  state.enemies.push(applyDestinyEnemySpawnModifiers(enemy));
  state.campaign.miniBossSpawned = true;
  setToast("小Boss现身");
}

function getStageElapsedTime() {
  return Math.max(0, state.time - (state.campaign.stageStartedAt || 0));
}

function getWaveStageProfile() {
  return BALANCE.waves.stageProfiles?.[state.campaign.stageIndex]
    || BALANCE.waves.stageProfiles?.[3]
    || {
      intervalOffset: 0,
      countOffset: 0,
      gruntWeight: 1,
      chargerWeight: 1,
      rangedWeight: 1,
    };
}

function pickWaveEnemyType(profile) {
  const gruntWeight = Math.max(0, profile.gruntWeight || 0);
  const chargerWeight = Math.max(0, profile.chargerWeight || 0);
  const rangedWeight = Math.max(0, profile.rangedWeight || 0);
  const total = gruntWeight + chargerWeight + rangedWeight;
  if (total <= 0) return "grunt";
  const roll = Math.random() * total;
  if (roll < gruntWeight) return "grunt";
  if (roll < gruntWeight + chargerWeight) return "charger";
  return "ranged";
}

function getActiveSpawnEnemyCount() {
  return state.enemies.filter((enemy) => !enemy.isMiniBoss && enemy.type !== "boss").length;
}

function updateSpawn(dt) {
  if (state.debugSpawnSuppressed) return;
  if (state.bossFight || state.campaign.stageType === "boss" || state.campaign.miniBossSpawned) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const stageElapsed = getStageElapsedTime();
    const profile = getWaveStageProfile();
    const baseInterval = stageElapsed < BALANCE.waves.stageBandEarly
      ? BALANCE.waves.spawnIntervalEarly
      : stageElapsed < BALANCE.waves.stageBandMid
        ? BALANCE.waves.spawnIntervalMid
        : stageElapsed < BALANCE.waves.stageBandLate
          ? BALANCE.waves.spawnIntervalLate
          : BALANCE.waves.spawnIntervalEnd;
    const baseCount = stageElapsed < BALANCE.waves.stageBandEarly
      ? BALANCE.waves.countEarly
      : stageElapsed < BALANCE.waves.stageBandMid
        ? BALANCE.waves.countMid
        : stageElapsed < BALANCE.waves.stageBandLate
          ? BALANCE.waves.countLate
          : BALANCE.waves.countEnd;
    const waveCount = Math.max(
      2,
      Math.round(baseCount + (profile.countOffset || 0) + Math.max(0, state.campaign.runIndex - 1) * 0.5),
    );
    const availableSlots = Math.max(0, (BALANCE.waves.maxActiveEnemies || Infinity) - getActiveSpawnEnemyCount());
    const spawnCount = Math.min(waveCount, availableSlots);
    for (let i = 0; i < spawnCount; i += 1) {
      spawnEnemy(pickWaveEnemyType(profile));
    }
    const intervalReduction = Math.max(0, state.campaign.runIndex - 1) * BALANCE.waves.levelIntervalReduction;
    state.spawnTimer = Math.max(
      BALANCE.waves.minSpawnInterval,
      baseInterval + (profile.intervalOffset || 0) - intervalReduction,
    );
  }
  while (state.eliteIndex < state.eliteSchedule.length && state.time >= state.eliteSchedule[state.eliteIndex]) {
    if (getActiveSpawnEnemyCount() >= (BALANCE.waves.maxActiveEnemies || Infinity)) break;
    spawnEnemy("elite");
    state.eliteIndex += 1;
    setToast("精英护法现身");
  }
  if (!state.campaign.miniBossSpawned && state.campaign.stageKills >= state.campaign.targetKills) {
    spawnMiniBoss();
  }
}

function getBossRoundConfig(runIndex = state.campaign.runIndex) {
  return BALANCE.bossRoundTable?.[runIndex] || BALANCE.bossRoundTable?.[3] || null;
}

function getBossPhaseConfig(boss = state.boss) {
  if (!boss?.config?.phases?.length) return null;
  const index = clamp((boss.phase || 1) - 1, 0, boss.config.phases.length - 1);
  return boss.config.phases[index];
}

function getBossSkillConfig(skillId, boss = state.boss) {
  return boss?.config?.skills?.[skillId] || null;
}

function clearBossIntent(boss) {
  if (!boss) return;
  boss.intent = null;
  boss.intentLabel = "";
  boss.intentCategory = null;
  boss.intentCounterable = false;
}

function spawnBoss() {
  const config = getBossRoundConfig(state.campaign.runIndex);
  const phaseConfig = config?.phases?.[0] || null;
  const bossScale = 1 + (state.campaign.runIndex - 1) * 0.18;
  const baseDamageScale = 1 + (state.campaign.runIndex - 1) * 0.1;
  state.bossFight = true;
  state.phaseLabel = `第${state.campaign.runIndex}轮 大Boss`;
  state.enemies = [];
  state.enemyProjectiles = [];
  state.projectiles = [];
  state.pulses = [];
  state.activeEffects = state.activeEffects.filter((effect) => !effect.fromBoss);
  state.campaign.bossSpawned = true;
  state.boss = {
    type: "boss",
    bossId: config?.id || `boss-${state.campaign.runIndex}`,
    name: config?.name || enemies.boss.name,
    role: config?.role || "Boss",
    x: WIDTH / 2,
    y: 90,
    hp: enemies.boss.hp * bossScale * (config?.hpMult || 1),
    maxHp: enemies.boss.hp * bossScale * (config?.hpMult || 1),
    damage: enemies.boss.damage * baseDamageScale * (config?.damageMult || 1),
    radius: config?.radius || enemies.boss.radius,
    speed: enemies.boss.speed * (config?.speedMult || 1),
    phase: 1,
    phaseThresholds: [...(config?.phaseThresholds || [])],
    phaseNames: (config?.phases || []).map((phase, index) => phase.name || `阶段${index + 1}`),
    config,
    attackTimer: phaseConfig?.cooldown || 1,
    contactTimer: 0.2,
    exposedTimer: 0.35,
    sequenceCursor: 0,
    ringMode: "outer",
    phaseChangedAt: state.time,
    phaseStartedAt: state.time,
    lastSkillId: null,
    intent: null,
    intentLabel: "",
    intentCategory: null,
    intentCounterable: false,
  };
  setToast(`${state.boss.name} 降临`);
}

function nearestEnemies(count) {
  const targets = [...state.enemies];
  if (state.boss) targets.push(state.boss);
  return targets.sort((a, b) => distance(a, state.player) - distance(b, state.player)).slice(0, count);
}

function pulse(x, y, radius, damage, kind, affectsBoss = true, extra = null) {
  const durationMap = {
    flame: 0.32,
    burst: 0.24,
    guard: 0.26,
    "guard-break": 0.38,
    "sword-burst": 0.26,
  };
  const duration = durationMap[kind] || 0.18;
  const pulsePayload = {
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
  };
  if (extra && typeof extra === "object") Object.assign(pulsePayload, extra);
  state.pulses.push(pulsePayload);
}

function dealDamage(target, amount, source = "player") {
  const executeMult = getExecuteDamageMult(target);
  let finalAmount = amount * executeMult;
  if (target?.isMiniBoss && target.miniBossShieldUntil > state.time) {
    finalAmount *= target.miniBossShieldMult || 1;
  }
  target.hp -= finalAmount;
  if (source === "player" && distance(state.player, target) <= PATH_COMBAT.gain.meleeRange) {
    maybeTriggerBlackMomentum("close");
  }
  if (target.type === "boss") {
    const thresholds = target.phaseThresholds || [];
    while (thresholds[target.phase - 1] != null && target.hp > 0 && target.hp <= target.maxHp * thresholds[target.phase - 1]) {
      target.phase += 1;
      target.sequenceCursor = 0;
      target.attackTimer = target.config?.phaseShiftPause || 0.72;
      target.exposedTimer = Math.max(target.exposedTimer || 0, 0.28);
      target.phaseChangedAt = state.time;
      target.phaseStartedAt = state.time;
      clearBossIntent(target);
      state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => !projectile.fromBoss);
      state.activeEffects = state.activeEffects.filter((effect) => !effect.fromBoss);
      state.pulses = state.pulses.filter((pulseItem) => !pulseItem.fromBoss);
      const phaseName = target.phaseNames?.[target.phase - 1] || `第${target.phase}阶段`;
      setToast(`${target.name}·${phaseName}`);
    }
  }
  if (target.hp <= 0) {
    const killRuntimePayload = buildKillRuntimePayload(target, source, {
      isExecuteKill: executeMult > 1,
    });
    if (target.type === "boss") {
      destinyRuntime.emit("kill_resolved", killRuntimePayload);
      healFromBlackMeleeKill(target);
      finishGame(RESULT_CLEAR);
    } else {
      killEnemy(target, {
        source,
        isExecuteKill: executeMult > 1,
      });
    }
  }
}

function strikeEnemy(enemy, damage, source = state.player, options = {}) {
  const pulseKind = options.pulseKind || "thunder";
  const nodePulseKind = options.nodePulseKind || null;
  const fromX = pulseKind === "storm-strike"
    ? enemy.x + (Math.random() * 26 - 13)
    : source.x;
  const fromY = pulseKind === "storm-strike"
    ? -140 - Math.random() * 24
    : source.y;
  const pulsePayload = {
    x: enemy.x,
    y: enemy.y,
    radius: 18,
    damage: 0,
    kind: pulseKind,
    time: 0.15,
    duration: 0.15,
    hit: new Set(),
    fromX,
    fromY,
    palette: options.palette || null,
    routeStyle: options.routeStyle || null,
  };
  state.pulses.push(pulsePayload);
  if (nodePulseKind) {
    state.pulses.push({
      x: enemy.x,
      y: enemy.y,
      radius: 20,
      damage: 0,
      kind: nodePulseKind,
      time: 0.18,
      duration: 0.18,
      hit: new Set(),
      affectsBoss: true,
      palette: options.palette || null,
      routeStyle: options.routeStyle || null,
    });
  }
  markTargetHitFx(
    enemy,
    "thunder",
    options.routeStyle || null,
    options.palette || null,
    nodePulseKind ? 0.28 : 0.22,
    nodePulseKind ? 1.04 : 0.88,
  );
  dealDamage(enemy, computeDamage(damage), "thunder");
}

function castThunder(skill) {
  const target = nearestEnemies(1)[0];
  if (!target) return;
  const routeState = getSkillRouteState("thunder", skill);
  const routeVfx = getSkillRouteVfx("thunder", skill);
  const rewrite = getThunderRewriteProfile();
  const capstoneChain = hasRouteCapstone("thunder", skill, "chain");
  const damage = getThunderDamage(skill);
  strikeEnemy(target, damage, state.player, {
    pulseKind: routeVfx.auto?.strikePulseKind || "thunder",
    nodePulseKind: routeVfx.auto?.nodePulseKind || null,
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || null,
  });
  state.enemies
    .filter((enemy) => enemy !== target && distance(enemy, target) <= skill.splash + rewrite.chainRangeBonus)
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, skill.chain + rewrite.chainCountBonus + (capstoneChain ? 2 : 0))
    .forEach((enemy) => strikeEnemy(enemy, damage * 0.65, target, {
      pulseKind: routeVfx.auto?.strikePulseKind || "thunder",
      nodePulseKind: routeVfx.auto?.nodePulseKind || null,
      palette: routeVfx.palette || null,
      routeStyle: routeState?.routeId || null,
    }));
}

function castActiveThunder(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("thunder", skill);
  const routeVfx = getSkillRouteVfx("thunder", skill);
  const rewrite = getThunderRewriteProfile();
  if (routeState?.routeId === "chain") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const capstoneChain = hasRouteCapstone("thunder", skill, "chain");
    const opener = pickPriorityTarget(state.player, { preferLowHp: true }) || nearestEnemyFromPoint(state.player);
    if (!opener) return false;
    const maxJumps = 10 + level * 2 + getSkillBranchCount(skill, "chain") * 2 + rewrite.activeJumpBonus + (capstoneChain ? 4 : 0);
    const duration = 1.8 + level * 0.14 + skill.chainFocus * 0.18 + rewrite.activeDurationBonus + (capstoneChain ? 0.45 : 0);
    state.activeEffects.push({
      kind: "chain-lightning-storm",
      x: opener.x,
      y: opener.y,
      time: duration,
      duration,
      tickTimer: 0.04,
      tickInterval: Math.max(0.06, 0.15 - level * 0.006 - (capstoneChain ? 0.02 : 0)),
      damage: computeDamage(getThunderDamage(skill) * (1.28 + level * 0.12 + (capstoneChain ? 0.08 : 0)) * sacrificeBoost),
      decay: capstoneChain ? 0.92 : 0.9,
      maxJumps,
      jumpCount: 0,
      chainRange: (180 + level * 12 + skill.chainRangeBonus + rewrite.chainRangeBonus) * rewrite.activeRangeMult,
      currentTarget: opener,
      visited: new Set(),
      hitCounts: new Map(),
      newTargetBias: (skill.chainNewTargetBias || 0) + rewrite.newTargetBias,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    state.pulses.push({
      x: opener.x,
      y: opener.y,
      radius: 22,
      damage: 0,
      kind: "chain-node",
      time: 0.22,
      duration: 0.22,
      hit: new Set(),
      affectsBoss: true,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    setToast(`${capstoneChain ? "连锁天雷" : "连锁雷暴"} (${level})`);
    return true;
  }
  const capstoneStorm = hasRouteCapstone("thunder", skill, "storm");
  const radius = Math.min(WIDTH, HEIGHT) * 0.46 * rewrite.activeRangeMult * rewrite.activeRadiusMult * (capstoneStorm ? 1.12 : 1);
  const extraDuration = hasGuardFocus() ? 1 : 0;
  const sacrificeBoost = getActiveSacrificeBoost();
  const damage = getThunderDamage(skill) * sacrificeBoost;
  const target = resolveThunderStormTarget();
  const duration = Math.max(
    capstoneStorm ? 5 : 0,
    2 + extraDuration + (skill.stormDurationBonus || 0) + rewrite.activeDurationBonus,
  );
  state.pulses.push({
    x: target.x,
    y: target.y,
    radius,
    damage: computeDamage(damage * (1.55 + level * 0.22 + (capstoneStorm ? 0.12 : 0))),
    kind: "thunderstorm",
    time: duration,
    duration,
    hit: new Set(),
    affectsBoss: true,
    tickTimer: 0.18,
    tickInterval: Math.max(0.14, 0.34 - level * 0.02 - (capstoneStorm ? 0.04 : 0)),
    strikeCount: 2 + level + (skill.stormStrikeBonus || 0) + rewrite.activeStrikeBonus + (capstoneStorm ? 2 : 0),
    bossOpenerMult: rewrite.bossOpenerMult,
    bossOpenerConsumed: false,
    heavyFirstHitMult: capstoneStorm ? 1.4 : 1,
    heavyTargetsHit: new Set(),
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "storm",
    placement: target.reason,
  });
  setToast(`${capstoneStorm ? "九霄雷池" : "掌心雷·天罚"} (${level})`);
  return true;
}

function castActiveSword(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("sword", skill);
  const routeVfx = getSkillRouteVfx("sword", skill);
  const rewrite = getSwordRewriteProfile();
  const swarmRoute = routeState?.routeId === "swarm";
  if (routeState?.routeId === "greatsword") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const capstoneGreat = hasRouteCapstone("sword", skill, "greatsword");
    const lane = resolveGreatswordLane(skill);
    const width = (30 + level * 4 + skill.greatswordWidthBonus * 10 + (capstoneGreat ? 16 : 0)) * rewrite.activeWidthMult;
    const duration = Math.max(
      capstoneGreat ? 4 : 0,
      2.3 + level * 0.18 + skill.greatswordDurationBonus + rewrite.activeDurationBonus,
    );
    const tickInterval = Math.max(0.18, 0.34 - level * 0.015);
    const baseDamage = skill.damage * (1.8 + level * 0.24 + (capstoneGreat ? 0.14 : 0)) * sacrificeBoost * rewrite.activeDamageMult;
    state.activeEffects.push({
      kind: "greatsword-field",
      x: lane.start.x,
      y: lane.start.y,
      startX: lane.start.x,
      startY: lane.start.y,
      endX: lane.end.x,
      endY: lane.end.y,
      targetX: lane.end.x,
      targetY: lane.end.y,
      angle: lane.angle,
      width,
      bladeLength: lane.length,
      duration,
      time: duration,
      tickTimer: 0.05,
      tickInterval,
      damage: computeDamage(baseDamage),
      pressureBonus: (skill.greatswordPressureBonus || 0) + rewrite.pressureBonus + (capstoneGreat ? 0.16 : 0),
      oscillation: 0,
      focusType: lane.priorityTarget?.type || (lane.focus?.count ? "cluster" : "forward"),
      hitCooldowns: new Map(),
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
      capstone: capstoneGreat,
    });
    state.pulses.push({
      x: lane.start.x,
      y: lane.start.y,
      radius: 64 + level * 4 + (capstoneGreat ? 10 : 0),
      damage: 0,
      kind: "greatsword-cast",
      time: 0.42,
      duration: 0.42,
      hit: new Set(),
      affectsBoss: false,
      angle: lane.angle,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    setToast(`巨阙镇场 (${level})`);
    return true;
  }
  const sacrificeBoost = getActiveSacrificeBoost();
  const capstoneSwarm = hasRouteCapstone("sword", skill, "swarm");
  const swarmPerSwordDamageMult = capstoneSwarm ? 0.6 : 0.72;
  const count = Math.round(
    (8 + level * 2 + (hasGuardFocus() ? 1 : 0) + rewrite.activeVolleyBonus + (capstoneSwarm ? 6 : 0))
    * (1 + (sacrificeBoost - 1) * 0.35),
  );
  const damage = computeDamage(
    skill.damage
    * (1.08 + level * 0.12)
    * sacrificeBoost
    * rewrite.activeDamageMult
    * swarmPerSwordDamageMult,
  );
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius: 34 + level * 3 + (capstoneSwarm ? 10 : 0),
    damage: 0,
    kind: "sword-burst",
    time: 0.26,
    duration: 0.26,
    hit: new Set(),
    affectsBoss: false,
    bladeCount: count + (skill.swarmVolleyBonus || 0),
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "swarm",
  });
  const totalCount = count + (skill.swarmVolleyBonus || 0);
  for (let i = 0; i < totalCount; i += 1) {
    const angle = (Math.PI * 2 * i) / totalCount;
    const activeProjectileSpeed = (220 + level * 18) * rewrite.activeProjectileSpeedMult;
    state.projectiles.push({
      x: state.player.x + Math.cos(angle) * 18,
      y: state.player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * activeProjectileSpeed,
      vy: Math.sin(angle) * activeProjectileSpeed,
      radius: 7 * rewrite.projectileRadiusMult,
      damage,
      pierce: 1 + Math.floor(level / 2),
      life: 2.8 + level * 0.18,
      color: routeVfx.palette?.primary || "#e8d79c",
      kind: "sword-active",
      homing: true,
      turnRate: (7 + level * 0.4) * rewrite.turnRateMult,
      speed: activeProjectileSpeed,
      routeStyle: routeVfx.auto?.style || "swarm",
      palette: routeVfx.palette || null,
      visualScale: (routeVfx.auto?.projectileScale || 1.16) * rewrite.projectileRadiusMult,
      trailLength: (routeVfx.auto?.trailLength || 20) + 6,
      trailWidth: Math.max(3.2, routeVfx.auto?.trailWidth || 3.2),
      impactKind: routeVfx.auto?.impactPulseKind || "sword-hit",
    });
  }
  setToast(`${capstoneSwarm ? "万剑齐发" : "万剑归宗"} (${level})`);
  return true;
}

function castActiveGuard(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("guard", skill);
  const routeVfx = getSkillRouteVfx("guard", skill);
  const rewrite = syncGuardRewriteState(skill);
  if (routeState?.routeId === "counter") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const capstoneCounter = hasRouteCapstone("guard", skill, "counter");
    const duration = Math.max(capstoneCounter ? 4 : 0, 1.08 + level * 0.08 + skill.counterWindowBonus);
    const radius = 92 + level * 6 + skill.counterFocus * 8 + (capstoneCounter ? 12 : 0);
    state.activeEffects.push({
      kind: "guard-counter-window",
      x: state.player.x,
      y: state.player.y,
      radius,
      time: duration,
      duration,
      damage: computeDamage((38 + skill.maxShield * 0.18 + level * 12 + skill.counterShockBonus * 10) * sacrificeBoost * rewrite.counterShockMult * (capstoneCounter ? 2 : 1)),
      finalDamage: computeDamage((56 + skill.maxShield * 0.28 + level * 16 + skill.counterShockBonus * 14) * sacrificeBoost * rewrite.finaleDamageMult * (capstoneCounter ? 1.7 : 1)),
      reflectedCount: 0,
      shockCount: 0,
      shockCooldown: 0.05,
      pushMult: rewrite.counterPushMult * (capstoneCounter ? 1.4 : 1),
      reflectDamageMult: rewrite.reflectDamageMult,
      reflectGuaranteed: rewrite.reflectGuaranteed + (capstoneCounter ? 2 : 0),
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
      capstone: capstoneCounter,
    });
    state.pulses.push({
      x: state.player.x,
      y: state.player.y,
      radius,
      damage: 0,
      kind: "guard-counter-start",
      time: 0.26,
      duration: 0.26,
      hit: new Set(),
      affectsBoss: false,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    setToast(`返天钟鸣 (${level})`);
    return true;
  }
  const sacrificeBoost = getActiveSacrificeBoost();
  const capstoneBulwark = hasRouteCapstone("guard", skill, "bulwark");
  const radius = (110 + level * 16 + skill.bulwarkFocus * 10 + (capstoneBulwark ? 18 : 0)) * rewrite.bulwarkRadiusMult * (1 + (sacrificeBoost - 1) * 0.2);
  const damage = computeDamage((48 + skill.maxShield * 0.35 + level * 18 + skill.bulwarkFocus * 10) * sacrificeBoost);
  const pushScale = hasGuardFocus() ? 1.35 : 1;
  if (capstoneBulwark) {
    skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * 0.35);
  }
  pulse(state.player.x, state.player.y, radius, damage, "guard", true, {
    time: 0.34,
    duration: 0.34,
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "bulwark",
  });
  state.activeEffects.push({
    kind: "bulwark-shell",
    x: state.player.x,
    y: state.player.y,
    radius: radius * 0.82,
    time: 0.58 + rewrite.barrierShellDurationBonus + (capstoneBulwark ? 0.4 : 0),
    duration: 0.58 + rewrite.barrierShellDurationBonus + (capstoneBulwark ? 0.4 : 0),
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "bulwark",
    capstone: capstoneBulwark,
  });
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
  setToast(`${capstoneBulwark ? "不灭金钟" : "金钟震荡"} (${level})`);
  return true;
}

function castActiveFlame(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("flame", skill);
  const routeVfx = getSkillRouteVfx("flame", skill);
  const rewrite = getFlameRewriteProfile();
  if (routeState?.routeId === "zone") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const capstoneZone = hasRouteCapstone("flame", skill, "zone");
    const target = resolveFlameZoneTarget();
    const radius = (86 + level * 8 + skill.zoneRadiusBonus + rewrite.zoneRadiusBonus) * rewrite.outerRadiusMult;
    const duration = 3 + level * 0.18 + skill.zoneDurationBonus + rewrite.zoneDurationBonus + rewrite.lingerDurationBonus + (capstoneZone ? 0.8 : 0);
    const slow = Math.min(0.55, 0.2 + level * 0.025 + skill.zoneSlowBonus + rewrite.zoneSlowBonus);
    const damage = computeDamage(skill.damage * rewrite.innerDamageMult * (1.2 + level * 0.15) * sacrificeBoost);
    state.pulses.push({
      x: target.x,
      y: target.y,
      radius: radius * 0.72,
      damage: damage * 1.15,
      kind: "flame-zone-burst",
      time: 0.4,
      duration: 0.4,
      hit: new Set(),
      affectsBoss: true,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    state.activeEffects.push({
      kind: "flame-zone",
      x: target.x,
      y: target.y,
      radius,
      time: duration,
      duration,
      tickTimer: 0.05,
      tickInterval: Math.max(0.24, 0.44 - level * 0.02),
      damage,
      slow,
      burnDuration: 1.7 + level * 0.08 + rewrite.burnDurationBonus + rewrite.lingerDurationBonus,
      hitCooldowns: new Map(),
      placement: target.reason,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
      leaveEmbers: capstoneZone,
      emberDuration: capstoneZone ? 3 : 0,
      emberRadius: radius * 0.72,
      emberDamage: damage * 0.58,
      emberSlow: slow * 0.7,
    });
    setToast(`${capstoneZone ? "焚身领域" : "留焰封区"} (${level})`);
    return true;
  }
  const sacrificeBoost = getActiveSacrificeBoost();
  const capstoneMeteor = hasRouteCapstone("flame", skill, "meteor");
  const meteorCount = 2 + level + (skill.meteorFocus || 0) + (skill.meteorCountBonus || 0) + rewrite.meteorCountBonus;
  const waveCount = 3 + (hasGuardFocus() ? 1 : 0);
  const waveInterval = 0.7;
  const waveDuration = 0.7;
  const damage = computeDamage(
    skill.damage
    * rewrite.innerDamageMult
    * rewrite.meteorDamageMult
    * (2.05 + level * 0.28 + (skill.meteorFocus || 0) * 0.12 + (capstoneMeteor ? 0.16 : 0))
    * sacrificeBoost,
  );
  const meteorBurstBonus = (skill.meteorBurstBonus || 0) + rewrite.meteorBurstBonus;
  const field = resolveMeteorFieldTarget();
  const baseRotation = Math.random() * Math.PI * 2;
  for (let wave = 0; wave < waveCount; wave += 1) {
    const startDelay = wave * waveInterval;
    for (let i = 0; i < meteorCount; i += 1) {
      const angle = baseRotation + wave * 0.42 + (Math.PI * 2 * i) / Math.max(1, meteorCount);
      const spread = 18 + wave * 14 + (i % 2) * 12 + (skill.meteorFocus || 0) * 4;
      const jitterX = Math.cos(angle) * spread + (Math.random() * 16 - 8);
      const jitterY = Math.sin(angle) * spread + (Math.random() * 16 - 8);
      const impactX = clamp(field.x + jitterX, 30, WIDTH - 30);
      const impactY = clamp(field.y + jitterY, 30, HEIGHT - 30);
      state.pulses.push({
        x: impactX,
        y: impactY,
        radius: 52 + level * 5,
        damage,
        kind: "meteor",
        time: waveDuration,
        duration: waveDuration,
        startDelay,
        hit: new Set(),
        affectsBoss: true,
        bossDamageMult: 0.32,
        fromX: clamp(field.x + jitterX * 0.35, 30, WIDTH - 30),
        fromY: -120 - (wave * meteorCount + i) * 36,
        impactAt: 0.72,
        landed: false,
        burnDuration: 4 + rewrite.burnDurationBonus,
        palette: routeVfx.palette || null,
        routeStyle: routeState?.routeId || "meteor",
        wave,
      });
      if (meteorBurstBonus > 0) {
        state.pulses.push({
          x: clamp(field.x + jitterX * 0.6, 30, WIDTH - 30),
          y: clamp(field.y + jitterY * 0.6, 30, HEIGHT - 30),
          radius: 34 + meteorBurstBonus * 4,
          damage: damage * 0.35,
          kind: routeVfx.active?.burstPulseKind || "meteor-burst",
          time: waveDuration,
          duration: waveDuration,
          startDelay: startDelay + 0.08,
          hit: new Set(),
          affectsBoss: true,
          bossDamageMult: 0.2,
          palette: routeVfx.palette || null,
          routeStyle: routeState?.routeId || "meteor",
        });
      }
    }
  }
  if (capstoneMeteor) {
    state.activeEffects.push({
      kind: "flame-zone",
      x: field.x,
      y: field.y,
      radius: 48 + level * 4,
      time: 1.8,
      duration: 1.8,
      tickTimer: 0.05,
      tickInterval: 0.22,
      damage: damage * 0.4,
      bossDamageMult: 0.28,
      slow: 0,
      burnDuration: 2.8 + rewrite.burnDurationBonus,
      hitCooldowns: new Map(),
      placement: field.reason,
      palette: routeVfx.palette || null,
      routeStyle: "meteor",
    });
  }
  setToast(`${capstoneMeteor ? "烬狱轮转" : "陨火天坠"} (${level})`);
  return true;
}

function tryUseActiveSlot(slotIndex) {
  if (isGameplayInputBlocked()) return false;
  const skillId = state.player.skillOrder[slotIndex];
  if (!skillId) return false;
  const skill = state.player.skills[skillId];
  if (!skill || !isActiveUnlocked(skill) || skill.activeTimer > 0) return false;
  destinyRuntime.emit("active_cast_started", {
    skillId,
    routeId: skill.route || null,
    slotIndex,
  });
  let fired = false;
  if (skillId === "thunder") fired = castActiveThunder(skill);
  else if (skillId === "sword") fired = castActiveSword(skill);
  else if (skillId === "guard") fired = castActiveGuard(skill);
  else if (skillId === "flame") fired = castActiveFlame(skill);
  if (!fired) {
    clearActiveSacrificeBoost();
    return false;
  }
  maybeTriggerBlackMomentum("active");
  skill.activeTimer = getActiveCooldown(skillId, getActiveLevel(skill));
  clearActiveSacrificeBoost();
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
    const routeState = getSkillRouteState("sword", skill);
    const routeVfx = getSkillRouteVfx("sword", skill);
    const rewrite = getSwordRewriteProfile();
    const capstoneSwarm = hasRouteCapstone("sword", skill, "swarm");
    const capstoneGreat = hasRouteCapstone("sword", skill, "greatsword");
    const swarmRoute = routeState?.routeId === "swarm";
    skill.timer -= dt * castScale / state.player.globalCooldown;
    if (skill.timer <= 0) {
      const targets = getSwordTargets(skill.projectiles, rewrite.autoVolleyBonus);
      if (targets.length) {
        const aim = targets.reduce((acc, target) => {
          acc.x += target.x;
          acc.y += target.y;
          return acc;
        }, { x: 0, y: 0 });
        const aimX = aim.x / targets.length;
        const aimY = aim.y / targets.length;
        state.pulses.push({
          x: state.player.x,
          y: state.player.y,
          radius: 26 + Math.min(24, skill.projectiles * 2),
          damage: 0,
          kind: routeVfx.auto?.castPulseKind || "sword-auto-cast",
          time: 0.18,
          duration: 0.18,
          hit: new Set(),
          affectsBoss: false,
          angle: Math.atan2(aimY - state.player.y, aimX - state.player.x),
          bladeCount: skill.projectiles,
          routeStyle: routeState?.routeId || routeVfx.auto?.style || "swarm",
          palette: routeVfx.palette || null,
        });
      }
      targets.forEach((enemy) => {
        const dist = Math.max(1, distance(state.player, enemy));
        const routeStyle = routeVfx.auto?.style || routeState?.routeId || "swarm";
        const sideIndex = targets.indexOf(enemy) - (targets.length - 1) / 2;
        const sideAngle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x) + Math.PI / 2;
        const offsetStrength = routeStyle === "greatsword" ? 6 : 12;
        const projectileSpeed = 380 * rewrite.projectileSpeedMult * (capstoneSwarm ? 1.06 : capstoneGreat ? 0.88 : 1);
        const projectileRadius = 6 * rewrite.projectileRadiusMult * (capstoneGreat ? 1.18 : 1);
        const autoDamageMult = capstoneGreat ? 1.08 : swarmRoute ? (capstoneSwarm ? 0.72 : 0.84) : 1;
        state.projectiles.push({
          x: state.player.x + Math.cos(sideAngle) * sideIndex * offsetStrength,
          y: state.player.y + Math.sin(sideAngle) * sideIndex * offsetStrength,
          vx: ((enemy.x - state.player.x) / dist) * projectileSpeed,
          vy: ((enemy.y - state.player.y) / dist) * projectileSpeed,
          radius: projectileRadius,
          damage: computeDamage(skill.damage * rewrite.damageMult * autoDamageMult),
          pierce: skill.pierce,
          life: 1.5,
          color: routeVfx.palette?.primary || "#d8c88d",
          kind: "sword",
          routeStyle,
          palette: routeVfx.palette || null,
          visualScale: (routeVfx.auto?.projectileScale || 1) * rewrite.projectileRadiusMult * (capstoneGreat ? 1.12 : capstoneSwarm ? 1.06 : 1),
          trailLength: (routeVfx.auto?.trailLength || 18) + (capstoneGreat ? 4 : capstoneSwarm ? 2 : 0),
          trailWidth: (routeVfx.auto?.trailWidth || 2.4) + (capstoneGreat ? 0.8 : capstoneSwarm ? 0.2 : 0),
          impactKind: routeVfx.auto?.impactPulseKind || "sword-hit",
        });
      });
      skill.timer = skill.cooldown * state.player.globalCooldown;
    }
  }
  if (state.player.skills.thunder) {
    const skill = state.player.skills.thunder;
    const rewrite = getThunderRewriteProfile();
    skill.timer -= dt * castScale / state.player.globalCooldown;
    if (skill.timer <= 0) {
      skill.chain = Math.max(0, skill.chain);
      castThunder(skill);
      skill.timer = skill.cooldown * state.player.globalCooldown;
    }
  }
  if (state.player.skills.flame) {
    const skill = state.player.skills.flame;
    const routeState = getSkillRouteState("flame", skill);
    const routeVfx = getSkillRouteVfx("flame", skill);
    const rewrite = getFlameRewriteProfile();
    const capstoneMeteor = hasRouteCapstone("flame", skill, "meteor");
    skill.timer -= dt * castScale;
    if (skill.timer <= 0) {
      pulse(state.player.x, state.player.y, skill.radius * rewrite.outerRadiusMult, computeDamage(skill.damage * rewrite.innerDamageMult), "flame", true, {
        routeStyle: routeState?.routeId || routeVfx.auto?.pulseStyle || "meteor",
        palette: routeVfx.palette || null,
        burnDuration: 2.5 + rewrite.burnDurationBonus + rewrite.lingerDurationBonus,
        innerRadius: capstoneMeteor ? skill.radius * 0.6 : 0,
        innerDamageMult: capstoneMeteor ? 1.8 : 1,
      });
      skill.timer = skill.tick;
    }
  }
  if (state.player.skills.guard) {
    const skill = state.player.skills.guard;
    const rewrite = syncGuardRewriteState(skill);
    skill.bulwarkLastStandCooldown = Math.max(0, skill.bulwarkLastStandCooldown || 0);
    if (skill.bulwarkLastStandCooldown > 0) skill.bulwarkLastStandCooldown -= dt;
    if (skill.shield > 0 && skill.route === "bulwark" && rewrite.shieldRegenPctPerSecond > 0) {
      skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * rewrite.shieldRegenPctPerSecond * dt);
    }
    if (skill.shield <= 0) {
      skill.timer -= dt;
      if (skill.timer <= 0) {
        const previousShield = skill.shield;
        const routeState = getSkillRouteState("guard", skill);
        const routeVfx = getSkillRouteVfx("guard", skill);
        skill.shield = skill.maxShield;
        notifyDestinyProtectiveLayer("guard-shield", "guard_regenerate", previousShield, skill.shield);
        state.pulses.push({
          x: state.player.x,
          y: state.player.y,
          radius: state.player.radius + 22,
          damage: 0,
          kind: routeVfx.auto?.reformPulseKind || "guard-reform",
          time: 0.32,
          duration: 0.32,
          hit: new Set(),
          affectsBoss: false,
          routeStyle: routeState?.routeId || routeVfx.auto?.style || "bulwark",
          palette: routeVfx.palette || null,
        });
      }
    }
  }
}

function spawnDrops(enemy) {
  const createdDrops = [];
  const eliteReward = enemy.type === "elite";
  const xpValue = enemy.isMiniBoss ? 26 : enemies[enemy.type].xp;
  const orbValue = enemy.isMiniBoss ? 16 : enemies[enemy.type].orb;
  const xpDrop = {
    x: enemy.x,
    y: enemy.y,
    kind: "xp",
    value: xpValue,
    color: COLORS.xp,
    radius: 6,
    isEliteReward: eliteReward,
    isMiniBossReward: !!enemy.isMiniBoss,
  };
  state.drops.push(xpDrop);
  createdDrops.push(xpDrop);
  const orbColor = enemy.color === "black" ? "white" : "black";
  const pathDrop = {
    x: enemy.x + (Math.random() * 10 - 5),
    y: enemy.y + (Math.random() * 10 - 5),
    kind: "path",
    value: orbValue,
    color: orbColor,
    radius: 7,
    isEliteReward: eliteReward,
    isMiniBossReward: !!enemy.isMiniBoss,
  };
  state.drops.push(pathDrop);
  createdDrops.push(pathDrop);
  if (enemy.type === "elite" || enemy.isMiniBoss) {
    destinyRuntime.emit("high_value_drop_spawn", {
      enemyType: enemy.isMiniBoss ? "miniBoss" : enemy.type,
      drops: createdDrops,
    });
  }
  return createdDrops;
}

function triggerMiniBossRewardVacuum() {
  state.enemies = [];
  state.enemyProjectiles = [];
  state.drops.forEach((drop) => {
    drop.autoCollect = true;
  });
}

function killEnemy(enemy, sourceInfo) {
  const source = typeof sourceInfo === "object" && sourceInfo
    ? sourceInfo.source
    : sourceInfo;
  const index = state.enemies.indexOf(enemy);
  if (index >= 0) state.enemies.splice(index, 1);
  if (enemy.isMiniBoss) {
    state.campaign.miniBossDefeated = true;
    state.paused = false;
    state.pendingMiniBossReward = true;
  }
  addXp(enemy.isMiniBoss ? 26 : enemies[enemy.type].xp);
  spawnDrops(enemy);
  state.totalKills += 1;
  if (!enemy.isMiniBoss) state.campaign.stageKills += 1;
  const killRuntimePayload = buildKillRuntimePayload(enemy, source, {
    isExecuteKill: !!sourceInfo?.isExecuteKill,
  });
  destinyRuntime.emit("kill_resolved", killRuntimePayload);
  if (state.player.skills.flame?.burst && enemy.burn > 0) pulse(enemy.x, enemy.y, 44, state.player.skills.flame.damage * 2.2, "burst");
  if (
    state.player.skills.flame
    && hasRouteCapstone("flame", state.player.skills.flame, "meteor")
    && enemy.burn > 0
    && distance(state.player, enemy) <= state.player.skills.flame.radius * 0.65 + enemy.radius
  ) {
    pulse(enemy.x, enemy.y, 32, state.player.skills.flame.damage * 1.8, "burst", true, {
      palette: getSkillRouteVfx("flame", state.player.skills.flame).palette || null,
      routeStyle: "meteor",
    });
  }
  maybeTriggerKillHeal();
  triggerBlackBurst(enemy);
  healFromBlackMeleeKill(enemy);
  const eliteLike = enemy.type === "elite" || enemy.isMiniBoss;
  if (eliteLike && state.player.hp / Math.max(1, state.player.maxHp) > 0.75) {
    fillPath("white", PATH_COMBAT.gain.whiteEliteHighHpValue, {
      kind: "high_value_kill",
      enemyType: killRuntimePayload.enemyType,
      condition: "high_hp",
    });
    setToast("白道值 +8：高气血斩精英");
  }
  if (
    state.player.hp / Math.max(1, state.player.maxHp) < PATH_COMBAT.gain.blackLowHpKillThreshold
    && state.blackLowHpKillCooldown <= 0
  ) {
    fillPath("black", PATH_COMBAT.gain.blackLowHpKillValue, {
      kind: "danger_kill",
      enemyType: killRuntimePayload.enemyType,
      condition: "low_hp",
      isExecuteKill: killRuntimePayload.isExecuteKill,
    });
    state.blackLowHpKillCooldown = PATH_COMBAT.gain.blackLowHpKillCooldown;
  }
  if (eliteLike && distance(state.player, enemy) <= PATH_COMBAT.gain.meleeRange) {
    fillPath("black", PATH_COMBAT.gain.blackEliteMeleeValue, {
      kind: "high_value_kill",
      enemyType: killRuntimePayload.enemyType,
      condition: "melee",
      isExecuteKill: killRuntimePayload.isExecuteKill,
    });
    setToast("黑道值 +8：近身斩精英");
  }
  if (enemy.isMiniBoss) {
    triggerMiniBossRewardVacuum();
  }
}

function hitPlayer(amount, source = null) {
  if (state.player.invulnTimer > 0 || state.mode !== "playing") return;
  const counterEffect = getGuardCounterEffect();
  const counterReactiveSource = isGuardCounterReactiveSource(source);
  let incoming = amount * getIncomingMult();
  const previousHp = state.player.hp;
  const previousBarrier = state.player.barrier;
  state.noHitTimer = 0;
  state.whiteUntouchedRewardTimer = 0;
  if (counterEffect && counterReactiveSource) {
    triggerGuardCounterShock(counterEffect, 1, source);
    incoming *= 0.52;
  }
  if (state.player.barrier > 0) {
    state.player.barrier -= incoming;
    if (state.player.barrier >= 0) {
      notifyDestinyProtectiveLayer("barrier", "incoming_hit_absorb", previousBarrier);
      if (counterEffect && counterReactiveSource) triggerGuardCounterShock(counterEffect, 0.85, source);
      state.player.invulnTimer = baseStats.invuln;
      return;
    }
    incoming = Math.abs(state.player.barrier);
    state.player.barrier = 0;
    notifyDestinyProtectiveLayer("barrier", "incoming_hit_break", previousBarrier, 0);
  }
  const guard = state.player.skills.guard;
  if (guard) syncGuardRewriteState(guard);
  if (guard && guard.shield > 0) {
    const previousShield = guard.shield;
    const guardRouteState = getSkillRouteState("guard", guard);
    const guardRouteVfx = getSkillRouteVfx("guard", guard);
    guard.shield -= incoming;
    if (guard.shield <= 0) {
      const bulwarkCapstone = hasRouteCapstone("guard", guard, "bulwark");
      if (guard.burst) {
        pulse(state.player.x, state.player.y, 80, 38, "guard", true, {
          routeStyle: guardRouteState?.routeId || guardRouteVfx.auto?.style || "bulwark",
          palette: guardRouteVfx.palette || null,
        });
      }
      pulse(state.player.x, state.player.y, 90, 0, "guard-break", false, {
        routeStyle: guardRouteState?.routeId || guardRouteVfx.auto?.style || "bulwark",
        palette: guardRouteVfx.palette || null,
      });
      state.pulses.push({
        x: state.player.x,
        y: state.player.y,
        radius: state.player.radius + 16,
        damage: 0,
        kind: guardRouteVfx.auto?.blockPulseKind || "guard-block",
        time: 0.2,
        duration: 0.2,
        hit: new Set(),
        affectsBoss: false,
        routeStyle: guardRouteState?.routeId || guardRouteVfx.auto?.style || "bulwark",
        palette: guardRouteVfx.palette || null,
      });
      guard.timer = guard.recharge;
      notifyDestinyProtectiveLayer("guard-shield", "guard_break", previousShield, 0);
      if (counterEffect && counterReactiveSource) triggerGuardCounterShock(counterEffect, 1.15, source);
      if (bulwarkCapstone && guard.bulwarkLastStandCooldown <= 0) {
        guard.bulwarkLastStandCooldown = 20;
        state.player.invulnTimer = Math.max(state.player.invulnTimer, 2);
        state.activeEffects.push({
          kind: "bulwark-last-stand",
          x: state.player.x,
          y: state.player.y,
          radius: state.player.radius + 34,
          time: 2,
          duration: 2,
          restoreShield: guard.maxShield * 0.3,
          palette: guardRouteVfx.palette || null,
          routeStyle: "bulwark",
        });
        incoming = 0;
        setToast("不灭金钟：强撑回潮");
      } else {
        incoming = Math.abs(guard.shield) * 0.35;
      }
    } else {
      state.pulses.push({
        x: state.player.x,
        y: state.player.y,
        radius: state.player.radius + 12,
        damage: 0,
        kind: guardRouteVfx.auto?.blockPulseKind || "guard-block",
        time: 0.16,
        duration: 0.16,
        hit: new Set(),
        affectsBoss: false,
        routeStyle: guardRouteState?.routeId || guardRouteVfx.auto?.style || "bulwark",
        palette: guardRouteVfx.palette || null,
      });
      notifyDestinyProtectiveLayer("guard-shield", "guard_block", previousShield, guard.shield);
      if (counterEffect && counterReactiveSource) triggerGuardCounterShock(counterEffect, 0.92, source);
      incoming *= 0.2;
    }
  }
  state.player.hp -= incoming;
  notifyDestinyHpChanged("incoming_hit", previousHp);
  state.player.invulnTimer = baseStats.invuln;
  if (state.player.hp <= 0) finishGame(RESULT_DEATH);
}

function calculateRunPoints(result) {
  const runElapsed = Math.max(0, state.time - state.runStartTime);
  const fromTime = Math.floor(runElapsed / META.pointsFromTimeDivisor);
  const fromKills = Math.floor(state.totalKills / META.pointsFromKillsDivisor);
  const boss = result === "成仙" || result === "化魔" ? META.bossWinBonus : 0;
  const dandingBonus = state.dandingTriggerCount * 2;
  return Math.max(1, fromTime + fromKills + boss + dandingBonus);
}

function calculateRunDaoMarks(result) {
  return calculateRunPoints(result);
}

let destinyFlow = null;
let shopFlow = null;
let reincarnationFlow = null;

const runFlow = createRunFlow({
  state,
  metaState,
  dom,
  WIDTH,
  HEIGHT,
  STAGES_PER_RUN,
  skills,
  createState,
  closeModal,
  showOverlay,
  setToast,
  renderModal,
  unlockSkill,
  getEquippedDestinyEntries,
  getAlignmentLabel,
  getEntryAlignment,
  getThunderDamage,
  hasInfusionPoints,
  spawnBoss,
  maybeOpenPendingLevelUp,
  openDaoPointifyModal: (...args) => destinyFlow.openDaoPointifyModal(...args),
  openDestinyOffer: (...args) => destinyFlow.openDestinyOffer(...args),
  openRunShopModal: (...args) => shopFlow.openRunShopModal(...args),
});

destinyFlow = createDestinyFlow({
  state,
  metaState,
  destinyCatalog,
  getAlignmentLabel,
  getEntryAlignment,
  getDestinyText,
  createDestinyPreviewSnapshot,
  describeDestinyStatDelta,
  getRandomDestinyOffers,
  getDestinyOfferQualityScore,
  getEquippedDestinyEntries,
  getDestinyTierLabel: getDestinyTierLabelImpl,
  getDestinyWeight: getDestinyWeightImpl,
  weightedPick: weightedPickImpl,
  isDestinyOfferEligible: (id) => isDestinyOfferEligibleImpl(id, state),
  hasInfusionPoints,
  onDestinyLoadoutChanged: notifyDestinyLoadoutChanged,
  saveMetaState,
  setToast,
  closeModal,
  renderModal,
});

shopFlow = createShopFlow({
  state,
  metaState,
  TOTAL_RUNS,
  RESULT_DEATH,
  destinyCatalog,
  getOwnedDestinyEntries,
  getRandomDestinyOffers,
  saveMetaState,
  setToast,
  closeModal,
  renderModal,
  resetGame: (...args) => runFlow.resetGame(...args),
  startCurrentStage: (...args) => runFlow.startCurrentStage(...args),
  openEquipDestinyModal: (...args) => destinyFlow.openEquipDestinyModal(...args),
  openReincarnationModal: (...args) => reincarnationFlow.openReincarnationModal(...args),
});

reincarnationFlow = createReincarnationFlow({
  state,
  metaState,
  META,
  TOTAL_RUNS,
  RESULT_DEATH,
  RESULT_CLEAR,
  formatResultLabel,
  formatTime,
  getAlignmentCounts,
  getAlignmentResult,
  saveMetaState,
  renderModal,
  resetGame: (...args) => runFlow.resetGame(...args),
  saveAndRefreshShop: (...args) => shopFlow.saveAndRefreshShop(...args),
  openRunShopModal: (...args) => shopFlow.openRunShopModal(...args),
  openDestinyOffer: (...args) => destinyFlow.openDestinyOffer(...args),
  maybeHandlePostBossInfusion: (...args) => destinyFlow.maybeHandlePostBossInfusion(...args),
  calculateRunPoints,
  calculateRunDaoMarks,
});

const {
  resetGame,
  getEnemyProgressMult,
  startCurrentStage,
  advanceCampaign,
} = runFlow;
const {
  clearPendingInfusionContinuation,
  openDaoPointifyModal,
  openDestinyOffer,
  maybeHandlePostBossInfusion,
} = destinyFlow;
const {
  openRunShopModal,
} = shopFlow;
const {
  finishGame,
} = reincarnationFlow;

combatSystems = createCombatSystems({
  state,
  keys,
  WIDTH,
  HEIGHT,
  enemies,
  RESULT_DEATH,
  clamp,
  distance,
  getMoveMult,
  getCombatTargets,
  distancePointToSegment,
  dealDamage,
  pickChainJumpTarget,
  nearestEnemyFromPoint,
  getGuardCounterEffect,
  reflectEnemyProjectile,
  hitPlayer,
  getTargetsWithinRadius,
  pulse,
  spawnEnemy,
  getPickupRange,
  getDropAttractProfile,
  markTargetHitFx,
  addXp,
  fillPath,
  onDropCollected: (drop, context) => destinyRuntime.emit("drop_collected", { drop, ...context }),
  onHpChanged: notifyDestinyHpChanged,
  onStatusExpired: (name, source) => destinyRuntime.emit("status_expired", { name, source }),
  maybeOpenPendingLevelUp,
  maybeHandlePostBossInfusion,
  openDestinyOffer,
  advanceCampaign,
  finishGame,
  updateSpawn,
  updateSkills,
  updatePathBehavior,
  refreshPhase,
  isGameplayRunning,
  triggerGuardCounterFinale,
});


function renderSkillBar(skillCards) {
  renderSkillBarImpl({
    dom,
    skillCards,
  });
}

function fillPath(color, amount, context = {}) {
  const path = color === "white" ? state.whitePath : state.blackPath;
  if (path.full) return;
  const prepared = destinyRuntime.emit("path_gain_prepare", {
    color,
    amount,
    context,
  });
  const gainMult = color === "white" ? state.whiteGainMult : state.blackGainMult;
  const previousValue = path.value;
  const finalAmount = (prepared?.amount ?? amount) * gainMult;
  path.value = Math.min(path.cap, path.value + finalAmount);
  maybeTriggerPathThresholds(path, previousValue);
  destinyRuntime.emit("path_gain_resolved", {
    color,
    requestedAmount: amount,
    finalAmount,
    appliedAmount: Math.max(0, path.value - previousValue),
    context,
  });
}

function describePathStage(path) {
  return describePathStageImpl(path);
}

function refreshPhase() {
  refreshPhaseImpl(state);
}

function updateHud() {
  const hudView = inspectSystem.buildHudViewModel();
  updateHudImpl({
    dom,
    state,
    syncPauseButton,
    xpNeeded,
    describePathStage,
    renderSkillBar: () => renderSkillBar(hudView.skillCards),
    statusItems: hudView.statusItems,
    destinyItems: hudView.destinyItems,
    pathHintHtml: hudView.pathHintHtml,
  });
  inspectSystem.syncSelection();
}

gameRenderer = createGameRenderer({
  state,
  dom,
  WIDTH,
  HEIGHT,
  COLORS,
  SKILL_ART,
  skillRouteTable,
  clamp,
  updateHud,
});

function renderGameToText() {
  return renderGameToTextImpl({
    state,
    metaState,
    getOwnedDestinyEntries,
    getEntryAlignment,
  });
}

installDebugHooks({
  state,
  metaState,
  saveMetaState,
  resetGame,
  closeModal,
  render,
  update,
  COLORS,
  BRANCH_UNLOCK_BASE_UPGRADES,
  ACTIVE_UNLOCK_RANK,
  destinyCatalog,
  renderGameToText,
  onDestinyLoadoutChanged: notifyDestinyLoadoutChanged,
  onSkillRouteChanged: (skillId, routeId) => {
    if (!skillId) return;
    if (routeId) {
      destinyRuntime.emit("skill_route_locked", { skillId, routeId });
    } else {
      destinyRuntime.getSkillRewriteState(skillId);
    }
    if (skillId === "guard" && state.player.skills.guard) syncGuardRewriteState(state.player.skills.guard);
  },
  applyDebugRouteCapstone: (skillId, routeId) => {
    const capstoneChoice = levelChoices.find((choice) => {
      const routeMeta = getChoiceRouteMeta(choice);
      return routeMeta?.kind === "capstone" && routeMeta.skillId === skillId && routeMeta.routeId === routeId;
    });
    if (!capstoneChoice || !capstoneChoice.canTake(state)) return false;
    capstoneChoice.apply(state);
    return true;
  },
  spawnBoss,
  spawnMiniBoss,
  fillPath,
  tryUseActiveSlot,
});

function gameLoop(ts) {
  if (!state.realLast) state.realLast = ts;
  const dt = Math.min(0.033, (ts - state.realLast) / 1000);
  state.realLast = ts;
  update(dt);
  if (state.mode !== "menu") render();
  requestAnimationFrame(gameLoop);
}

dom.startBtn.addEventListener("click", resetGame);
dom.clearSaveBtn.addEventListener("click", clearSavedProgress);
dom.pauseBtn.addEventListener("click", toggleManualPause);
inspectSystem.bindContainer(dom.statusList);
inspectSystem.bindContainer(dom.skillBar);
inspectSystem.bindContainer(dom.destinyList);

syncPauseButton();
dom.startBtn.textContent = "开始试炼";
showOverlay(true);
inspectSystem.renderPanel();
resizeCanvas();
render();
requestAnimationFrame(gameLoop);
