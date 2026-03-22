(function initGameData(global) {
  if (!global.GAME_BALANCE) {
    throw new Error("GAME_BALANCE must load before modules/game-data.js");
  }

  const BALANCE = global.GAME_BALANCE;
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
  const DESTINY_POOL_VERSION = "rule-rewriter-v1";
  const RESULT_DEATH = "death";
  const RESULT_CLEAR = "clear";
  const BRANCH_UNLOCK_BASE_UPGRADES = 4;
  const BRANCH_CHOICE_GUARANTEE_COUNT = 2;
  const ACTIVE_UNLOCK_RANK = BRANCH_UNLOCK_BASE_UPGRADES + 2;
  const UNIFIED_ACTIVE_BASE_COOLDOWN = 5;
  const HUMAN_ENDING_DESTINY_ID = null;

  const destinyCatalog = {
    qingxin: {
      id: "qingxin",
      name: "凡命·清心护元",
      tier: "common",
      alignment: "white",
      category: "white-state",
      baseCost: 8,
      text: {
        white: "灵护期间击杀修补护体，天息期间击杀回复生命。",
      },
    },
    xuezhan: {
      id: "xuezhan",
      name: "凡命·血战成狂",
      tier: "common",
      alignment: "black",
      category: "black-state",
      baseCost: 8,
      text: {
        black: "低血时强化煞燃血爆范围，并提高魔驰斩杀伤害。",
      },
    },
    danding: {
      id: "danding",
      name: "真传·丹鼎真解",
      tier: "true",
      alignment: "white",
      category: "white-economy",
      baseCost: 20,
      text: {
        white: "白道状态下击杀精英或 Boss 可转化为结算道痕，达标后下个商店首刷免费。",
      },
    },
    ranshou: {
      id: "ranshou",
      name: "真传·燃寿魔功",
      tier: "true",
      alignment: "black",
      category: "black-risk",
      baseCost: 20,
      text: {
        black: "施放主动技额外损失生命，作为代价强化本次主动效果。",
      },
    },
    jianyigu: {
      id: "jianyigu",
      name: "真传·剑意骨",
      tier: "true",
      alignment: "black",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        black: "飞剑优先锁定残血目标，飞剑击杀后会立刻再追一次附近目标。",
      },
    },
    taiji: {
      id: "taiji",
      name: "真传·太极归元法",
      tier: "true",
      alignment: "mixed",
      category: "hybrid-rewrite",
      baseCost: 20,
      text: {
        mixed: "一白一黑配对时激活归元：白道回复附带增伤，黑道近身击杀附带回复。",
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
      art: {
        primary: "#f4e3a4",
        secondary: "#8d6b35",
        glow: "rgba(244, 227, 164, 0.24)",
      },
    },
    thunder: {
      id: "thunder",
      name: "掌心雷",
      description: "对最近敌人施加落雷，可连锁。",
      baseCooldown: 1.4,
      baseDamage: 28,
      splash: 54,
      art: {
        primary: "#9edbff",
        secondary: "#4c7cff",
        glow: "rgba(110, 180, 255, 0.26)",
      },
    },
    flame: {
      id: "flame",
      name: "火环术",
      description: "环身火域持续灼烧近身敌人。",
      radius: 90,
      tick: 0.5,
      damage: 22,
      art: {
        primary: "#ffb16a",
        secondary: "#ff623c",
        glow: "rgba(255, 120, 70, 0.28)",
      },
    },
    guard: {
      id: "guard",
      name: "金钟罩",
      description: "生成护盾并在破裂时反震。",
      shield: 60,
      recharge: 12,
      art: {
        primary: "#dce9ff",
        secondary: "#82a9d8",
        glow: "rgba(168, 196, 255, 0.26)",
      },
    },
  };

  const skillRouteTable = {
    sword: {
      defaultRoute: "swarm",
      routes: {
        swarm: {
          label: "剑潮流",
          shortLabel: "剑潮",
          activeName: "万剑归宗",
          activeDescription: "以成群飞剑瞬时爆发压场，负责短时清线与集群收割。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#f7e6a7",
              secondary: "#cc9d48",
              glow: "rgba(247, 230, 167, 0.24)",
              accent: "#fff7df",
            },
            auto: {
              orbitCount: 6,
              orbitRadius: 22,
              trailLength: 18,
              trailWidth: 2.6,
              projectileScale: 0.96,
              castPulseKind: "sword-auto-cast",
              impactPulseKind: "sword-hit",
              style: "swarm",
            },
            active: {
              castPulseKind: "sword-burst",
            },
          },
        },
        greatsword: {
          label: "大剑流",
          shortLabel: "大剑",
          activeName: "巨阙镇场",
          activeDescription: "召出持续切场的巨剑，负责压精英、压 Boss 与切开路径。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#f0c97c",
              secondary: "#8e6130",
              glow: "rgba(240, 201, 124, 0.26)",
              accent: "#fff1ca",
            },
            auto: {
              orbitCount: 2,
              orbitRadius: 18,
              trailLength: 28,
              trailWidth: 4,
              projectileScale: 1.34,
              castPulseKind: "sword-auto-cast",
              impactPulseKind: "sword-hit",
              style: "greatsword",
            },
            active: {
              castPulseKind: "greatsword-cast",
            },
          },
        },
      },
    },
    thunder: {
      defaultRoute: "storm",
      routes: {
        storm: {
          label: "天罚流",
          shortLabel: "天罚",
          activeName: "掌心雷·天罚",
          activeDescription: "在大范围内持续落雷，负责主动技高潮爆发。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#c9dbff",
              secondary: "#597cff",
              glow: "rgba(126, 158, 255, 0.26)",
              accent: "#f4f8ff",
            },
            auto: {
              strikePulseKind: "storm-strike",
              style: "storm",
            },
            active: {
              fieldPulseKind: "thunderstorm",
              strikePulseKind: "storm-strike",
            },
          },
        },
        chain: {
          label: "连锁流",
          shortLabel: "连锁",
          activeName: "连锁雷暴",
          activeDescription: "锁定关键目标并高速追链，负责补漏与点杀高威胁。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#baf4ff",
              secondary: "#39bdf1",
              glow: "rgba(78, 215, 255, 0.24)",
              accent: "#f2fdff",
            },
            auto: {
              strikePulseKind: "chain-arc",
              nodePulseKind: "chain-node",
              style: "chain",
            },
            active: {
              strikePulseKind: "chain-arc",
              nodePulseKind: "chain-node",
            },
          },
        },
      },
    },
    flame: {
      defaultRoute: "meteor",
      routes: {
        meteor: {
          label: "爆落流",
          shortLabel: "爆落",
          activeName: "陨火天坠",
          activeDescription: "多波陨火爆落，负责主动技爆燃清场。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#ffc278",
              secondary: "#ff7247",
              glow: "rgba(255, 142, 82, 0.28)",
              accent: "#fff0bf",
            },
            auto: {
              pulseStyle: "meteor",
            },
            active: {
              burstPulseKind: "meteor-burst",
            },
          },
        },
        zone: {
          label: "封区流",
          shortLabel: "封区",
          activeName: "留焰封区",
          activeDescription: "在敌群与路径上留下持续留焰区，负责封路与逼位。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#ffd48e",
              secondary: "#d65a35",
              glow: "rgba(255, 126, 66, 0.22)",
              accent: "#ffecc7",
            },
            auto: {
              pulseStyle: "zone",
            },
            active: {
              burstPulseKind: "flame-zone-burst",
            },
          },
        },
      },
    },
    guard: {
      defaultRoute: "bulwark",
      routes: {
        bulwark: {
          label: "护体流",
          shortLabel: "护体",
          activeName: "金钟震荡",
          activeDescription: "以玩家为中心稳场震退，负责开路与护体。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#f0e1b1",
              secondary: "#9eaed2",
              glow: "rgba(214, 225, 255, 0.24)",
              accent: "#fff6de",
            },
            auto: {
              blockPulseKind: "guard-block",
              reformPulseKind: "guard-reform",
              style: "bulwark",
            },
            active: {
              pulseKind: "guard",
            },
          },
        },
        counter: {
          label: "弹反流",
          shortLabel: "弹反",
          activeName: "返天钟鸣",
          activeDescription: "开启短时反制窗口，把敌人的攻势转化为反打。",
          baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN,
          vfx: {
            palette: {
              primary: "#dff2ff",
              secondary: "#78a6ea",
              glow: "rgba(164, 208, 255, 0.24)",
              accent: "#f6fbff",
            },
            auto: {
              blockPulseKind: "guard-counter-block",
              reformPulseKind: "guard-reform",
              style: "counter",
            },
            active: {
              pulseKind: "guard-counter-start",
            },
          },
        },
      },
    },
  };

  const activeSkillTable = {
    sword: { baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN },
    thunder: { baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN },
    guard: { baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN },
    flame: { baseCooldown: UNIFIED_ACTIVE_BASE_COOLDOWN },
  };

  const enemies = BALANCE.monsterTable;

  global.GameData = {
    BALANCE,
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
    DESTINY_POOL_VERSION,
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
  };
})(window);
