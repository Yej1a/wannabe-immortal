(function initRuntimeState(global) {
  const {
    BALANCE,
    META,
    PATH_COMBAT,
    FIRST_PATH_CAP,
    DESTINY_SLOT_CAP,
    DESTINY_POOL_VERSION,
    baseStats,
    destinyCatalog,
  } = global.GameData;

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
        unlocked: Object.keys(destinyCatalog),
        maxSlots: DESTINY_SLOT_CAP,
        version: DESTINY_POOL_VERSION,
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

  function saveMetaState(metaState) {
    localStorage.setItem(META.storageKey, JSON.stringify(metaState));
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

  function createDestinyRuntimeState() {
    return {
      seq: 0,
      log: [],
      whitePointTotal: 0,
      blackPointTotal: 0,
      hpBand: "safe",
      activeWhiteStatuses: [],
      activeBlackStatuses: [],
      whiteStability: {
        active: false,
        stableTime: 0,
        lifeLossCount: 0,
        firstKillRegistered: false,
        repairByStatus: {},
      },
      protectiveLayers: {
        barrier: {
          active: false,
          value: 0,
        },
        guardShield: {
          active: false,
          value: 0,
        },
      },
      releaseSessions: {
        white: null,
        black: null,
      },
      highValueDrops: {},
      highValueDropSerial: 0,
      skillRewriteState: {},
    };
  }

  function createState(metaState, applyDestinyBonuses, width, height) {
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
      x: width / 2,
      y: height / 2,
      facingX: 1,
      facingY: 0,
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
      manualPause: false,
      time: 0,
      runStartTime: 0,
      realLast: 0,
      spawnTimer: 0,
      eliteSchedule: [...BALANCE.waves.eliteSchedule],
      eliteIndex: 0,
      enemies: [],
      projectiles: [],
      enemyProjectiles: [],
      activeEffects: [],
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
      lastRunDaoMarks: 0,
      daoMarks: 0,
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
      branchWindowCounter: 0,
      pendingFreeShopRefreshes: 0,
      pendingForcedWhiteOffers: 0,
      pendingWhiteDestinyDiscount: 0,
      shopFreeRefreshes: 0,
      shopDestinyOffers: [],
      dandingTriggerCount: 0,
      pendingActiveSacrificeBoost: 0,
      debugSpawnSuppressed: false,
      routeShiftNotice: "",
      destinyRuntime: createDestinyRuntimeState(),
    };
  }

  global.RuntimeState = {
    createCampaignState,
    createMetaState,
    loadMetaState,
    saveMetaState,
    makePathState,
    createDestinyRuntimeState,
    createState,
  };
})(window);
