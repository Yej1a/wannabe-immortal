(function initGameData(global) {
  if (!global.GAME_BALANCE) {
    throw new Error("GAME_BALANCE must load before modules/game-data.js");
  }

  const BALANCE = global.GAME_BALANCE;
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

  const baseStats = BALANCE.playerTable;
  const xpCurve = BALANCE.playerTable.xpCurve;
  const STAGES_PER_RUN = 4;
  const TOTAL_RUNS = 3;
  const DESTINY_SLOT_CAP = 3;
  const RESULT_DEATH = "death";
  const RESULT_CLEAR = "clear";
  const ACTIVE_UNLOCK_RANK = 6;
  const HUMAN_ENDING_DESTINY_ID = "lotus";

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

  global.GameData = {
    BALANCE,
    GAME_DURATION,
    FIRST_PATH_CAP,
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
    ACTIVE_UNLOCK_RANK,
    HUMAN_ENDING_DESTINY_ID,
    destinyCatalog,
    skills,
    activeSkillTable,
    enemies,
  };
})(window);
