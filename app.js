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
  destinyCatalog,
  skills,
  skillRouteTable,
  activeSkillTable,
  enemies,
} = window.GameData;
const SKILL_ART = Object.fromEntries(
  Object.entries(skills).map(([id, skill]) => [id, skill.art || {}]),
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
  getMissingDestinyIds: getMissingDestinyIdsImpl,
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
  getSkillRouteLabel,
  getSkillActiveProfile,
  getSkillRouteVfx,
  getActiveCooldown,
  isActiveUnlocked,
  getSkillBranchCount,
  canTakeBranchUpgrade,
  markRouteSwitch,
  applySkillBaseUpgrade,
  applySkillBranchUpgrade,
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
  setToastImpl(dom, uiState, message);
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
  getSkillRouteLabel,
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
  if (isGameplayInputBlocked()) return false;
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
  healPlayer(state.player.maxHp * profile.healPct, "white-destiny");
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

function triggerQingxinDestiny(enemy) {
  if (!hasEquippedDestiny("qingxin")) return;
  if (hasStatus("灵护")) {
    grantBarrier(12);
  }
  if (hasStatus("天息")) {
    healPlayer(state.player.maxHp * 0.035, "white-destiny");
  }
}

function recordDandingTrigger(targetType) {
  if (!hasEquippedDestiny("danding") || !isWhiteCombatStatusActive()) return;
  if (!(targetType === "elite" || targetType === "boss")) return;
  state.dandingTriggerCount += 1;
  setToast(`丹鼎真解：本轮结算额外收益 ${state.dandingTriggerCount}`);
}

function queueSwordChainFrom(enemy) {
  const sword = state.player.skills.sword;
  if (!sword || !hasEquippedDestiny("jianyigu")) return;
  const routeVfx = getSkillRouteVfx("sword", sword);
  const nextTarget = [...state.enemies, state.boss].filter(Boolean)
    .sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
  if (!nextTarget) return;
  const dist = Math.max(1, distance(enemy, nextTarget));
  state.projectiles.push({
    x: enemy.x,
    y: enemy.y,
    vx: ((nextTarget.x - enemy.x) / dist) * 420,
    vy: ((nextTarget.y - enemy.y) / dist) * 420,
    radius: 6,
    damage: computeDamage(sword.damage * 0.9),
    pierce: Math.max(0, sword.pierce),
    life: 1.2,
    color: routeVfx.palette?.primary || "#f0ddb0",
    kind: "sword-chain",
    routeStyle: routeVfx.auto?.style || "swarm",
    palette: routeVfx.palette || null,
    visualScale: routeVfx.auto?.projectileScale || 1,
    trailLength: routeVfx.auto?.trailLength || 18,
    trailWidth: routeVfx.auto?.trailWidth || 2.4,
    impactKind: routeVfx.auto?.impactPulseKind || "sword-hit",
  });
}

function isSwordSource(source) {
  return typeof source === "string" && source.startsWith("sword");
}

function getActiveSacrificeBoost() {
  return state.pendingActiveSacrificeBoost > 0 ? state.pendingActiveSacrificeBoost : 1;
}

function clearActiveSacrificeBoost() {
  state.pendingActiveSacrificeBoost = 0;
}

function prepareRanshouActiveBoost() {
  if (!hasEquippedDestiny("ranshou")) return;
  const cost = state.player.maxHp * 0.05;
  state.player.hp = Math.max(1, state.player.hp - cost);
  state.pendingActiveSacrificeBoost = 1.43;
  setToast(`燃寿魔功：耗血 ${Math.ceil(cost)}，强化本次主动`);
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
  healPlayer(state.player.maxHp * 0.04, "generic");
}

function getSwordTargets(count) {
  const targets = [...state.enemies];
  if (state.boss) targets.push(state.boss);
  if (!hasEquippedDestiny("jianyigu")) {
    return targets.sort((a, b) => distance(a, state.player) - distance(b, state.player)).slice(0, count);
  }
  return targets
    .sort((a, b) => {
      const ratioDelta = (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp));
      if (Math.abs(ratioDelta) > 0.01) return ratioDelta;
      return distance(a, state.player) - distance(b, state.player);
    })
    .slice(0, count);
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
    x: clamp(start.x + Math.cos(angle) * laneLength, 40, WIDTH - 40),
    y: clamp(start.y + Math.sin(angle) * laneLength, 40, HEIGHT - 40),
  };
  return {
    start,
    end,
    angle,
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
    pushEnemyAway(target, state.player, target.type === "boss" ? 18 : 32 + effect.shockCount * 2);
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
    pushEnemyAway(target, state.player, target.type === "boss" ? 26 : 46);
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
    damage: effect.damage * 0.72 + projectile.damage * 1.25,
    pierce: 1,
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
      routePoints,
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
      routePoints,
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
      routePoints,
      meteorFocus: 0,
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
      maxShield: base.shield,
      shield: base.shield,
      recharge: base.recharge,
      timer: 0,
      burst: false,
      activeTimer: 0,
      baseUpgrades: 0,
      route: null,
      routePoints,
      bulwarkFocus: 0,
      counterFocus: 0,
      counterWindowBonus: 0,
      counterShockBonus: 0,
    };
  }
  gameState.player.skillOrder.push(id);
  gameState.player.skillFocus[id] = (gameState.player.skillFocus[id] || 0) + 1;
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
    desc: "飞剑数量额外 +2，并锁定飞剑到剑潮流。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "swarm"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "swarm", (skill) => {
      skill.projectiles += 2;
      skill.swarmVolleyBonus += 1;
    }),
  },
  {
    id: "sword-swarm-2",
    name: "万刃同调",
    desc: "飞剑伤害 +20%，万剑归宗追加剑雨数量。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "swarm"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "swarm", (skill) => {
      skill.damage *= 1.2;
      skill.swarmVolleyBonus += 2;
    }),
  },
  {
    id: "sword-great-1",
    name: "巨刃凝形",
    desc: "解锁大剑流，巨阙镇场体积与切割宽度提升。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "greatsword"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "greatsword", (skill) => {
      skill.greatswordWidthBonus += 1;
      skill.damage *= 1.12;
    }),
  },
  {
    id: "sword-great-2",
    name: "斩界延锋",
    desc: "巨阙镇场持续更久，并更擅长压制精英与 Boss。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "sword", "greatsword"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "sword", "greatsword", (skill) => {
      skill.greatswordDurationBonus += 0.45;
      skill.greatswordPressureBonus += 0.18;
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
    desc: "锁定雷法到连锁流，主动优先追链未命中目标。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "chain"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "chain", (skill) => {
      skill.chain += 1;
      skill.chainFocus += 1;
      skill.chainRangeBonus += 22;
    }),
  },
  {
    id: "thunder-branch-chain-2",
    name: "穿电成网",
    desc: "连锁更爱追新目标，目标不足时回跳衰减更平滑。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "chain"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "chain", (skill) => {
      skill.chainFocus += 1;
      skill.chainRangeBonus += 30;
      skill.chainNewTargetBias += 1;
    }),
  },
  {
    id: "thunder-branch-storm-1",
    name: "雷云积势",
    desc: "锁定雷法到天罚流，掌心雷·天罚范围与持续时间提升。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "storm"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "storm", (skill) => {
      skill.stormFocus += 1;
      skill.stormDurationBonus += 0.35;
    }),
  },
  {
    id: "thunder-branch-storm-2",
    name: "千击雷幕",
    desc: "掌心雷·天罚落雷密度提高，并补强主动爆发。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "thunder", "storm"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "thunder", "storm", (skill) => {
      skill.stormFocus += 1;
      skill.stormStrikeBonus += 1;
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
    desc: "锁定火环到爆落流，陨火天坠每波伤害更高。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "meteor"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "meteor", (skill) => {
      skill.damage *= 1.16;
      skill.meteorFocus += 1;
    }),
  },
  {
    id: "flame-meteor-2",
    name: "薪火催燃",
    desc: "陨火天坠追加爆燃余波，并强化点燃收割。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "meteor"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "meteor", (skill) => {
      skill.meteorFocus += 1;
      skill.meteorBurstBonus += 1;
      skill.burst = true;
    }),
  },
  {
    id: "flame-zone-1",
    name: "焰域外推",
    desc: "锁定火环到封区流，留焰封区范围更大。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "zone"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "zone", (skill) => {
      skill.zoneFocus += 1;
      skill.zoneRadiusBonus += 24;
    }),
  },
  {
    id: "flame-zone-2",
    name: "火幕成圏",
    desc: "留焰封区持续更久，减速更强。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "flame", "zone"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "flame", "zone", (skill) => {
      skill.zoneFocus += 1;
      skill.zoneDurationBonus += 0.7;
      skill.zoneSlowBonus += 0.08;
    }),
  },
  {
    id: "guard-strong",
    name: "厚钟",
    desc: "护盾值 +35%。",
    canTake: (stateRef) => !!stateRef.player.skills.guard,
    apply: (stateRef) => applySkillBaseUpgrade(stateRef, "guard", (skill) => {
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
    desc: "锁定金钟到护体流，护盾更厚且震荡更稳。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "bulwark"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "bulwark", (skill) => {
      skill.maxShield *= 1.18;
      skill.shield = Math.min(skill.maxShield, skill.shield + skill.maxShield * 0.35);
      skill.bulwarkFocus += 1;
    }),
  },
  {
    id: "guard-bulwark-2",
    name: "钟体回潮",
    desc: "金钟震荡后更快重整护体，护盾恢复节奏更强。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "bulwark"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "bulwark", (skill) => {
      skill.recharge *= 0.86;
      skill.bulwarkFocus += 1;
    }),
  },
  {
    id: "guard-counter-1",
    name: "镜返",
    desc: "锁定金钟到弹反流，返天钟鸣反制窗口更长。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "counter"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "counter", (skill) => {
      skill.counterFocus += 1;
      skill.counterWindowBonus += 0.18;
    }),
  },
  {
    id: "guard-counter-2",
    name: "钟鸣反震",
    desc: "返天钟鸣的弹道回击与近身反震更强。",
    canTake: (stateRef) => canTakeBranchUpgrade(stateRef, "guard", "counter"),
    apply: (stateRef) => applySkillBranchUpgrade(stateRef, "guard", "counter", (skill) => {
      skill.counterFocus += 1;
      skill.counterShockBonus += 1;
    }),
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

window.__debug_apply_level_choice = (choiceId) => {
  const choice = levelChoices.find((entry) => entry.id === choiceId);
  if (!choice || !choice.canTake(state)) return false;
  state.routeShiftNotice = "";
  choice.apply(state);
  render();
  return true;
};

function scoreChoice(choice, main) {
  let score = 1;
  const skillTag = getChoiceSkillTag(choice);
  const skill = skillTag ? state.player.skills[skillTag] : null;
  const branchMeta = getChoiceBranchMeta(choice);
  if (choice.id.startsWith("new-") && state.player.skillOrder.length < 3) score += 3;
  if (main && choice.id.includes(main)) score += 3;
  if (skillTag && state.player.skills[skillTag] && skillTag !== main) score += 2.5;
  if (branchMeta) {
    score += 1.25;
    if (skill?.route) score += 1.6;
  }
  if (choice.id === "life" && state.player.hp < state.player.maxHp * 0.55) score += 3;
  if (choice.id.startsWith("guard") && state.player.hp < state.player.maxHp * 0.6) score += 2;
  return score + Math.random();
}

function getChoiceSkillTag(choice) {
  const prefixes = ["sword", "thunder", "flame", "guard"];
  return prefixes.find((prefix) => choice.id === `new-${prefix}` || choice.id.startsWith(`${prefix}-`)) || null;
}

function getChoiceBranchMeta(choice) {
  if (choice.id.startsWith("sword-swarm-")) return { skillId: "sword", routeId: "swarm" };
  if (choice.id.startsWith("sword-great-")) return { skillId: "sword", routeId: "greatsword" };
  if (choice.id.startsWith("thunder-branch-chain-")) return { skillId: "thunder", routeId: "chain" };
  if (choice.id.startsWith("thunder-branch-storm-")) return { skillId: "thunder", routeId: "storm" };
  if (choice.id.startsWith("flame-meteor-")) return { skillId: "flame", routeId: "meteor" };
  if (choice.id.startsWith("flame-zone-")) return { skillId: "flame", routeId: "zone" };
  if (choice.id.startsWith("guard-bulwark-")) return { skillId: "guard", routeId: "bulwark" };
  if (choice.id.startsWith("guard-counter-")) return { skillId: "guard", routeId: "counter" };
  return null;
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
    if (target.type === "boss") {
      triggerQingxinDestiny(target);
      recordDandingTrigger("boss");
      healFromBlackMeleeKill(target);
      finishGame(RESULT_CLEAR);
    } else {
      killEnemy(target, source);
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
  const damage = getThunderDamage(skill);
  strikeEnemy(target, damage, state.player, {
    pulseKind: routeVfx.auto?.strikePulseKind || "thunder",
    nodePulseKind: routeVfx.auto?.nodePulseKind || null,
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || null,
  });
  state.enemies
    .filter((enemy) => enemy !== target)
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, skill.chain)
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
  if (routeState?.routeId === "chain") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const opener = pickPriorityTarget(state.player, { preferLowHp: true }) || nearestEnemyFromPoint(state.player);
    if (!opener) return false;
    const maxJumps = 10 + level * 2 + getSkillBranchCount(skill, "chain") * 2;
    state.activeEffects.push({
      kind: "chain-lightning-storm",
      x: opener.x,
      y: opener.y,
      time: 1.8 + level * 0.14 + skill.chainFocus * 0.18,
      duration: 1.8 + level * 0.14 + skill.chainFocus * 0.18,
      tickTimer: 0.04,
      tickInterval: Math.max(0.07, 0.15 - level * 0.006),
      damage: computeDamage(getThunderDamage(skill) * (1.28 + level * 0.12) * sacrificeBoost),
      decay: 0.9,
      maxJumps,
      jumpCount: 0,
      chainRange: 180 + level * 12 + skill.chainRangeBonus,
      currentTarget: opener,
      visited: new Set(),
      hitCounts: new Map(),
      newTargetBias: skill.chainNewTargetBias || 0,
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
    setToast(`连锁雷暴 (${level})`);
    return true;
  }
  const radius = Math.min(WIDTH, HEIGHT) * 0.46;
  const extraDuration = hasGuardFocus() ? 1 : 0;
  const sacrificeBoost = getActiveSacrificeBoost();
  const damage = getThunderDamage(skill) * sacrificeBoost;
  const target = resolveThunderStormTarget();
  state.pulses.push({
    x: target.x,
    y: target.y,
    radius,
    damage: computeDamage(damage * (1.55 + level * 0.22)),
    kind: "thunderstorm",
    time: 2 + extraDuration + (skill.stormDurationBonus || 0),
    duration: 2 + extraDuration + (skill.stormDurationBonus || 0),
    hit: new Set(),
    affectsBoss: true,
    tickTimer: 0.18,
    tickInterval: Math.max(0.16, 0.34 - level * 0.02),
    strikeCount: 2 + level + (skill.stormStrikeBonus || 0),
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "storm",
    placement: target.reason,
  });
  setToast(`掌心雷·天罚 (${level})`);
  return true;
}

function castActiveSword(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("sword", skill);
  const routeVfx = getSkillRouteVfx("sword", skill);
  if (routeState?.routeId === "greatsword") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const lane = resolveGreatswordLane(skill);
    const width = 30 + level * 4 + skill.greatswordWidthBonus * 10;
    const duration = 2.3 + level * 0.18 + skill.greatswordDurationBonus;
    const tickInterval = Math.max(0.18, 0.34 - level * 0.015);
    const baseDamage = skill.damage * (1.8 + level * 0.24) * sacrificeBoost;
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
      bladeLength: Math.hypot(lane.end.x - lane.start.x, lane.end.y - lane.start.y),
      duration,
      time: duration,
      tickTimer: 0.05,
      tickInterval,
      damage: computeDamage(baseDamage),
      pressureBonus: skill.greatswordPressureBonus || 0,
      oscillation: 0,
      focusType: lane.priorityTarget?.type || (lane.focus?.count ? "cluster" : "forward"),
      hitCooldowns: new Map(),
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    state.pulses.push({
      x: lane.start.x,
      y: lane.start.y,
      radius: 64 + level * 4,
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
  const count = Math.round((8 + level * 2 + (hasGuardFocus() ? 1 : 0)) * (1 + (sacrificeBoost - 1) * 0.35));
  const damage = computeDamage(skill.damage * (1.35 + level * 0.18) * sacrificeBoost);
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius: 34 + level * 3,
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
    state.projectiles.push({
      x: state.player.x + Math.cos(angle) * 18,
      y: state.player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 220,
      vy: Math.sin(angle) * 220,
      radius: 7,
      damage,
      pierce: 1 + Math.floor(level / 2),
      life: 2.8 + level * 0.18,
      color: routeVfx.palette?.primary || "#e8d79c",
      kind: "sword-active",
      homing: true,
      turnRate: 7 + level * 0.4,
      speed: 220 + level * 18,
      routeStyle: routeVfx.auto?.style || "swarm",
      palette: routeVfx.palette || null,
      visualScale: routeVfx.auto?.projectileScale || 1.16,
      trailLength: (routeVfx.auto?.trailLength || 20) + 6,
      trailWidth: Math.max(3.2, routeVfx.auto?.trailWidth || 3.2),
      impactKind: routeVfx.auto?.impactPulseKind || "sword-hit",
    });
  }
  setToast(`万剑归宗 (${level})`);
  return true;
}

function castActiveGuard(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("guard", skill);
  const routeVfx = getSkillRouteVfx("guard", skill);
  if (routeState?.routeId === "counter") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const duration = 1.25 + level * 0.08 + skill.counterWindowBonus;
    const radius = 92 + level * 6 + skill.counterFocus * 8;
    state.activeEffects.push({
      kind: "guard-counter-window",
      x: state.player.x,
      y: state.player.y,
      radius,
      time: duration,
      duration,
      damage: computeDamage((38 + skill.maxShield * 0.18 + level * 12 + skill.counterShockBonus * 10) * sacrificeBoost),
      finalDamage: computeDamage((56 + skill.maxShield * 0.28 + level * 16 + skill.counterShockBonus * 14) * sacrificeBoost),
      reflectedCount: 0,
      shockCount: 0,
      shockCooldown: 0.05,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
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
  const radius = (110 + level * 16 + skill.bulwarkFocus * 10) * (1 + (sacrificeBoost - 1) * 0.2);
  const damage = computeDamage((48 + skill.maxShield * 0.35 + level * 18 + skill.bulwarkFocus * 10) * sacrificeBoost);
  const pushScale = hasGuardFocus() ? 1.35 : 1;
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
    time: 0.58,
    duration: 0.58,
    palette: routeVfx.palette || null,
    routeStyle: routeState?.routeId || "bulwark",
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
  setToast(`金钟震荡 (${level})`);
  return true;
}

function castActiveFlame(skill) {
  const level = getActiveLevel(skill);
  if (level <= 0) return false;
  const routeState = getSkillRouteState("flame", skill);
  const routeVfx = getSkillRouteVfx("flame", skill);
  if (routeState?.routeId === "zone") {
    const sacrificeBoost = getActiveSacrificeBoost();
    const target = resolveFlameZoneTarget();
    const radius = 86 + level * 8 + skill.zoneRadiusBonus;
    const duration = 3 + level * 0.18 + skill.zoneDurationBonus;
    const slow = Math.min(0.55, 0.2 + level * 0.025 + skill.zoneSlowBonus);
    const damage = computeDamage(skill.damage * (1.2 + level * 0.15) * sacrificeBoost);
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
      burnDuration: 1.7 + level * 0.08,
      hitCooldowns: new Map(),
      placement: target.reason,
      palette: routeVfx.palette || null,
      routeStyle: routeState.routeId,
    });
    setToast(`留焰封区 (${level})`);
    return true;
  }
  const sacrificeBoost = getActiveSacrificeBoost();
  const meteorCount = 2 + level + (skill.meteorFocus || 0);
  const waveCount = 3 + (hasGuardFocus() ? 1 : 0);
  const waveInterval = 0.7;
  const waveDuration = 0.7;
  const damage = computeDamage(skill.damage * (3 + level * 0.45 + (skill.meteorFocus || 0) * 0.18) * sacrificeBoost);
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
        fromX: clamp(field.x + jitterX * 0.35, 30, WIDTH - 30),
        fromY: -120 - (wave * meteorCount + i) * 36,
        impactAt: 0.72,
        landed: false,
        palette: routeVfx.palette || null,
        routeStyle: routeState?.routeId || "meteor",
        wave,
      });
      if (skill.meteorBurstBonus > 0) {
        state.pulses.push({
          x: clamp(field.x + jitterX * 0.6, 30, WIDTH - 30),
          y: clamp(field.y + jitterY * 0.6, 30, HEIGHT - 30),
          radius: 34 + skill.meteorBurstBonus * 4,
          damage: damage * 0.35,
          kind: routeVfx.active?.burstPulseKind || "meteor-burst",
          time: waveDuration,
          duration: waveDuration,
          startDelay: startDelay + 0.08,
          hit: new Set(),
          affectsBoss: true,
          palette: routeVfx.palette || null,
          routeStyle: routeState?.routeId || "meteor",
        });
      }
    }
  }
  setToast(`陨火天坠 (${level})`);
  return true;
}

function tryUseActiveSlot(slotIndex) {
  if (isGameplayInputBlocked()) return false;
  const skillId = state.player.skillOrder[slotIndex];
  if (!skillId) return false;
  const skill = state.player.skills[skillId];
  if (!skill || !isActiveUnlocked(skill) || skill.activeTimer > 0) return false;
  if (hasEquippedDestiny("ranshou")) prepareRanshouActiveBoost();
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
    skill.timer -= dt * castScale / state.player.globalCooldown;
    if (skill.timer <= 0) {
      const targets = getSwordTargets(skill.projectiles);
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
        state.projectiles.push({
          x: state.player.x + Math.cos(sideAngle) * sideIndex * offsetStrength,
          y: state.player.y + Math.sin(sideAngle) * sideIndex * offsetStrength,
          vx: ((enemy.x - state.player.x) / dist) * 380,
          vy: ((enemy.y - state.player.y) / dist) * 380,
          radius: 6,
          damage: computeDamage(skill.damage),
          pierce: skill.pierce,
          life: 1.5,
          color: routeVfx.palette?.primary || "#d8c88d",
          kind: "sword",
          routeStyle,
          palette: routeVfx.palette || null,
          visualScale: routeVfx.auto?.projectileScale || 1,
          trailLength: routeVfx.auto?.trailLength || 18,
          trailWidth: routeVfx.auto?.trailWidth || 2.4,
          impactKind: routeVfx.auto?.impactPulseKind || "sword-hit",
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
    const routeState = getSkillRouteState("flame", skill);
    const routeVfx = getSkillRouteVfx("flame", skill);
    skill.timer -= dt * castScale;
    if (skill.timer <= 0) {
      pulse(state.player.x, state.player.y, skill.radius, computeDamage(skill.damage), "flame", true, {
        routeStyle: routeState?.routeId || routeVfx.auto?.pulseStyle || "meteor",
        palette: routeVfx.palette || null,
      });
      skill.timer = skill.tick;
    }
  }
  if (state.player.skills.guard) {
    const skill = state.player.skills.guard;
    if (skill.shield <= 0) {
      skill.timer -= dt;
      if (skill.timer <= 0) {
        const routeState = getSkillRouteState("guard", skill);
        const routeVfx = getSkillRouteVfx("guard", skill);
        skill.shield = skill.maxShield;
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
  triggerQingxinDestiny(enemy);
  healFromBlackMeleeKill(enemy);
  const eliteLike = enemy.type === "elite" || enemy.isMiniBoss;
  if (eliteLike) recordDandingTrigger("elite");
  if (isSwordSource(source)) queueSwordChainFrom(enemy);
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

function hitPlayer(amount, source = null) {
  if (state.player.invulnTimer > 0 || state.mode !== "playing") return;
  const counterEffect = getGuardCounterEffect();
  let incoming = amount * getIncomingMult();
  state.noHitTimer = 0;
  state.whiteUntouchedRewardTimer = 0;
  if (counterEffect && source && source.type) {
    triggerGuardCounterShock(counterEffect, 1, source);
    incoming *= 0.52;
  }
  if (state.player.barrier > 0) {
    state.player.barrier -= incoming;
    if (state.player.barrier >= 0) {
      if (counterEffect) triggerGuardCounterShock(counterEffect, 0.85, source && source.type ? source : null);
      state.player.invulnTimer = baseStats.invuln;
      return;
    }
    incoming = Math.abs(state.player.barrier);
    state.player.barrier = 0;
  }
  const guard = state.player.skills.guard;
  if (guard && guard.shield > 0) {
    const guardRouteState = getSkillRouteState("guard", guard);
    const guardRouteVfx = getSkillRouteVfx("guard", guard);
    guard.shield -= incoming;
    if (guard.shield <= 0) {
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
      if (counterEffect) triggerGuardCounterShock(counterEffect, 1.15, source && source.type ? source : null);
      incoming = Math.abs(guard.shield) * 0.35;
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
      if (counterEffect) triggerGuardCounterShock(counterEffect, 0.92, source && source.type ? source : null);
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
  describePointifyPreview,
  getRandomDestinyOffers,
  getEquippedDestinyEntries,
  hasInfusionPoints,
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

function fillPath(color, amount) {
  const path = color === "white" ? state.whitePath : state.blackPath;
  const gainMult = color === "white" ? state.whiteGainMult : state.blackGainMult;
  if (path.full) return;
  const previousValue = path.value;
  path.value = Math.min(path.cap, path.value + amount * gainMult);
  maybeTriggerPathThresholds(path, previousValue);
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
