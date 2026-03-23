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
  const DESTINY_POOL_VERSION = "rule-rewriter-v2";
  const RESULT_DEATH = "death";
  const RESULT_CLEAR = "clear";
  const BRANCH_UNLOCK_BASE_UPGRADES = 4;
  const BRANCH_CHOICE_GUARANTEE_COUNT = 2;
  const ACTIVE_UNLOCK_RANK = BRANCH_UNLOCK_BASE_UPGRADES + 2;
  const ACTIVE_SKILL_BALANCE = BALANCE.activeSkillTable || {
    sword: { baseCooldown: 12 },
    thunder: { baseCooldown: 14 },
    flame: { baseCooldown: 13 },
    guard: { baseCooldown: 10 },
  };
  const HUMAN_ENDING_DESTINY_ID = null;
  const DESTINY_RUNTIME_RULES = {
    safeHpRatio: 0.75,
    dangerHpRatio: PATH_COMBAT.gain.blackLowHpKillThreshold || 0.45,
    meleeRange: PATH_COMBAT.gain.meleeRange || 90,
    stableWhiteInterval: PATH_COMBAT.gain.whiteUntouchedInterval || 6,
    qingxin: {
      stableGainAmount: 3,
      firstKillBarrierRepair: 16,
      firstKillGuardRepair: 14,
    },
    heguang: {
      highValueGainAmount: 8,
      dropGainAmount: 4,
      attractRadius: 360,
      attractSpeed: 780,
    },
    danding: {
      whiteThreshold: 120,
      shopRefreshes: 1,
      forceWhiteOffers: 1,
      whiteDiscount: 4,
    },
    fulsheng: {
      safeGainMult: 1.35,
      qRefundBase: 8,
      qRefundHighValueKill: 6,
      qRefundStableBonus: 4,
      blackGainPenaltyMult: 0.72,
      safeThreshold: 0.78,
    },
    xuezhan: {
      meleeGainAmount: 3,
      executeGainAmount: 2,
      burstRadius: 46,
      burstDamage: 18,
      burstEliteMult: 1.2,
      burstBossMult: 0.45,
    },
    xianzhong: {
      highThreatHpMult: 1.18,
      highThreatDamageMult: 1.12,
      killGainAmount: 8,
    },
    ranshou: {
      hpCostPct: 0.06,
      blackGainAmount: 8,
      activeBoost: 1.48,
      recentPaymentWindow: 4,
    },
    tiansha: {
      lowHpThreshold: 0.58,
      blackGainMult: 1.45,
      activePaymentGainMult: 1.3,
      eKillRefund: 4,
      healingPenaltyMult: 0.72,
    },
    yinyang: {
      catchupRatio: 0.32,
      pairedCatchupRatio: 0.42,
      pairedGraceGap: 10,
    },
    taiji: {
      whiteOffenseDuration: 3.5,
      whiteOffenseDamageMult: 1.12,
      whiteOffenseDamageMultPaired: 1.18,
      blackBarrierGain: 10,
      blackBarrierGainPaired: 16,
      blackHealPct: 0.025,
      blackHealPctPaired: 0.04,
    },
    hunyuan: {
      pureGainPenaltyMult: 0.82,
      mixedBonusMult: 1.25,
    },
    skillRewriteBindings: {
      wanjian: {
        destinyId: "wanjian",
        name: "真传·万剑潮生",
        skillId: "sword",
        routeId: "swarm",
        base: {
          autoVolleyBonus: 1,
          projectileSpeedMult: 1.14,
          activeVolleyBonus: 3,
          activeProjectileSpeedMult: 1.1,
          turnRateMult: 1.08,
        },
        signature: {
          autoVolleyBonus: 3,
          projectileSpeedMult: 1.28,
          activeVolleyBonus: 10,
          activeProjectileSpeedMult: 1.2,
          turnRateMult: 1.18,
        },
      },
      juque: {
        destinyId: "juque",
        name: "真传·巨阙镇场",
        skillId: "sword",
        routeId: "greatsword",
        base: {
          damageMult: 1.16,
          projectileRadiusMult: 1.16,
          activeDamageMult: 1.14,
          activeWidthMult: 1.08,
        },
        signature: {
          damageMult: 1.38,
          projectileRadiusMult: 1.4,
          activeDamageMult: 1.34,
          activeWidthMult: 1.34,
          activeDurationBonus: 1.3,
          pressureBonus: 0.12,
        },
      },
      jiuzhuan: {
        destinyId: "jiuzhuan",
        name: "真传·九转雷脉",
        skillId: "thunder",
        routeId: "chain",
        base: {
          chainCountBonus: 1,
          chainRangeBonus: 24,
          newTargetBias: 0.25,
          activeRangeMult: 1.08,
        },
        signature: {
          chainCountBonus: 3,
          chainRangeBonus: 54,
          newTargetBias: 0.7,
          activeRangeMult: 1.16,
          activeJumpBonus: 4,
          activeDurationBonus: 0.45,
        },
      },
      leiyu: {
        destinyId: "leiyu",
        name: "真传·雷狱天章",
        skillId: "thunder",
        routeId: "storm",
        base: {
          activeRadiusMult: 1.12,
          activeDurationBonus: 0.3,
        },
        signature: {
          activeRadiusMult: 1.28,
          activeDurationBonus: 0.9,
          activeStrikeBonus: 3,
          bossOpenerMult: 1.28,
        },
      },
      jiehuo: {
        destinyId: "jiehuo",
        name: "真传·劫火焚身",
        skillId: "flame",
        routeId: "meteor",
        base: {
          innerDamageMult: 1.12,
          burnDurationBonus: 0.35,
        },
        signature: {
          innerDamageMult: 1.35,
          burnDurationBonus: 1,
          meteorDamageMult: 1.22,
          meteorCountBonus: 2,
          meteorBurstBonus: 2,
        },
      },
      lihuo: {
        destinyId: "lihuo",
        name: "真传·离火封界",
        skillId: "flame",
        routeId: "zone",
        base: {
          outerRadiusMult: 1.12,
          lingerDurationBonus: 0.45,
        },
        signature: {
          outerRadiusMult: 1.28,
          lingerDurationBonus: 1.25,
          zoneRadiusBonus: 24,
          zoneDurationBonus: 1.2,
          zoneSlowBonus: 0.08,
        },
      },
      xuangang: {
        destinyId: "xuangang",
        name: "真传·玄罡护身",
        skillId: "guard",
        routeId: "bulwark",
        base: {
          maxShieldMult: 1.12,
          barrierShellDurationBonus: 0.1,
        },
        signature: {
          maxShieldMult: 1.32,
          barrierShellDurationBonus: 0.28,
          bulwarkRadiusMult: 1.18,
          shieldRegenPctPerSecond: 0.05,
        },
      },
      fantian: {
        destinyId: "fantian",
        name: "真传·返天震岳",
        skillId: "guard",
        routeId: "counter",
        base: {
          counterPushMult: 1.12,
          counterShockMult: 1.12,
        },
        signature: {
          counterPushMult: 1.28,
          counterShockMult: 1.35,
          reflectDamageMult: 1.28,
          finaleDamageMult: 1.32,
          reflectGuaranteed: 1,
        },
      },
    },
  };

  const destinyCatalog = {
    qingxin: {
      id: "qingxin",
      name: "凡命·清心护元",
      tier: "common",
      alignment: "white",
      category: "white-state",
      baseCost: 8,
      text: {
        white: "白道状态中稳定站场会周期性多得白点；每次白道状态的首次击杀额外修补少量护体。",
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
        black: "黑道状态中近身击杀或残血处决会额外获得黑点，并在击杀点触发一次收尾血爆。",
      },
    },
    wanjian: {
      id: "wanjian",
      name: "真传·万剑潮生",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "飞剑未分路时先提高飞行速度与少量额外出手；锁定剑潮流后，显著放大剑潮数量、速度与追杂覆盖。",
      },
    },
    juque: {
      id: "juque",
      name: "真传·巨阙镇场",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "飞剑未分路时先提高单剑伤害与命中宽度；锁定大剑流后，显著放大巨剑体型、伤害与镇场持续时间。",
      },
    },
    heguang: {
      id: "heguang",
      name: "凡命·和光同尘",
      tier: "common",
      alignment: "white",
      category: "white-economy",
      baseCost: 8,
      text: {
        white: "白道状态下击杀精英、小 Boss、大 Boss，或拾取其高价值掉落时，额外获得白点并执行更强吸附。",
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
        white: "本轮累计白点达阈值后，下一商店获得免费首刷，并额外保证至少一个白道候选且首枚白道命格折价。",
      },
    },
    fulsheng: {
      id: "fulsheng",
      name: "天命·福生天眷",
      tier: "fated",
      alignment: "white",
      category: "white-capstone",
      baseCost: 42,
      text: {
        white: "高生命或护体存在时显著提高白点获取；白道满槽释放结束后按稳态表现返还白点，但黑点获取效率下降。",
      },
    },
    xianzhong: {
      id: "xianzhong",
      name: "凡命·险中求利",
      tier: "common",
      alignment: "black",
      category: "black-risk",
      baseCost: 8,
      text: {
        black: "精英与高威胁敌人会更硬更凶；击杀这些目标时额外获得黑点。",
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
        black: "施放主动技时额外损失生命并立即获得黑点，同时强化这一次主动技。",
      },
    },
    tiansha: {
      id: "tiansha",
      name: "天命·天煞孤星",
      tier: "fated",
      alignment: "black",
      category: "black-capstone",
      baseCost: 42,
      text: {
        black: "低血与主动耗血行为显著提高黑点获取；魔沸期间击杀返还黑点，但治疗衰减且危险阈值提前。",
      },
    },
    jiuzhuan: {
      id: "jiuzhuan",
      name: "真传·九转雷脉",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "雷法未分路时先提高追链稳定性；锁定连锁流后，大幅提高连锁次数、范围与补漏能力。",
      },
    },
    leiyu: {
      id: "leiyu",
      name: "真传·雷狱天章",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "雷法未分路时先提高主动技范围与落点稳定性；锁定落雷流后，大幅扩大雷区、密度与持续时间。",
      },
    },
    jiehuo: {
      id: "jiehuo",
      name: "真传·劫火焚身",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "火环未分路时先提高近身压迫与点燃持续；锁定伤害流后，大幅强化贴脸高热、灼烧叠层与陨火爆发。",
      },
    },
    lihuo: {
      id: "lihuo",
      name: "真传·离火封界",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "火环未分路时先提高外圈存在感；锁定范围流后，大幅扩大火场、留焰时长与封路稳定性。",
      },
    },
    xuangang: {
      id: "xuangang",
      name: "真传·玄罡护身",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "金钟未分路时先提高护体稳定性；锁定厚盾流后，大幅提高护体厚度、稳场覆盖与未破时的缓慢回补。",
      },
    },
    fantian: {
      id: "fantian",
      name: "真传·返天震岳",
      tier: "true",
      alignment: "mixed",
      category: "skill-rewrite",
      baseCost: 20,
      text: {
        mixed: "金钟未分路时先提高受击震荡与击退；锁定弹反流后，大幅强化反弹、反震与终结反打。",
      },
    },
    yinyang: {
      id: "yinyang",
      name: "凡命·阴阳并济",
      tier: "common",
      alignment: "mixed",
      category: "hybrid-rewrite",
      baseCost: 8,
      text: {
        mixed: "获得白点或黑点时，较低一侧获得追赶补正；若命盘已白黑配对，补正幅度进一步提高。",
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
        mixed: "获得白点后短时间转成进攻，获得黑点后转成护体/回复；白黑配对时两侧互转同时增强。",
      },
    },
    hunyuan: {
      id: "hunyuan",
      name: "天命·混元道胎",
      tier: "fated",
      alignment: "mixed",
      category: "hybrid-capstone",
      baseCost: 42,
      text: {
        mixed: "允许混道配对收益完整展开并整体增强，但单侧纯修收益收缩，资源分配更紧。",
      },
    },
  };

  const skills = {
    sword: {
      id: "sword",
      name: "飞剑诀",
      description: "自动追踪最近敌人的飞剑术。",
      baseCooldown: 0.82,
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
      baseCooldown: 0.96,
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
      radius: 60,
      tick: 0.55,
      damage: 16,
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
          label: "数量流",
          shortLabel: "数量",
          activeName: "万剑归宗",
          activeDescription: "以成群飞剑瞬时爆发压场，负责短时清线与集群收割。",
          capstoneName: "万剑齐发",
          identityTags: ["爆量", "密集", "齐射", "铺场", "剑潮"],
          activeClimaxText: "瞬时剑潮铺满战场",
          graduationSummary: "普攻会持续铺出剑潮，主动技则把战场瞬时压满。",
          baseCooldown: ACTIVE_SKILL_BALANCE.sword?.baseCooldown || 12,
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
          capstoneName: "巨阙镇场",
          identityTags: ["少量重剑", "切场", "压线", "压精英", "压 Boss"],
          activeClimaxText: "场上出现一把压场巨剑",
          graduationSummary: "普攻保持少量重剑压线，主动技则以超大巨剑接管精英与 Boss 窗口。",
          baseCooldown: ACTIVE_SKILL_BALANCE.sword?.baseCooldown || 12,
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
          label: "落雷流",
          shortLabel: "落雷",
          activeName: "掌心雷·天罚",
          activeDescription: "在大范围内持续落雷，负责主动技高潮爆发。",
          capstoneName: "九霄雷池",
          identityTags: ["区域统治", "雷池", "持续降雷", "开窗爆发"],
          activeClimaxText: "区域雷池接管战场",
          graduationSummary: "普攻负责日常补漏，主动技会把一整片区域改写成持续降雷的雷池。",
          baseCooldown: ACTIVE_SKILL_BALANCE.thunder?.baseCooldown || 14,
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
          capstoneName: "连锁天雷",
          identityTags: ["追链", "补漏", "跳电", "连续收割"],
          activeClimaxText: "高速追链收割",
          graduationSummary: "普攻会把怪群稳定串成电网，主动技专门追残血、补漏口和高威胁点杀。",
          baseCooldown: ACTIVE_SKILL_BALANCE.thunder?.baseCooldown || 14,
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
          label: "伤害流",
          shortLabel: "伤害",
          activeName: "陨火天坠",
          activeDescription: "多波陨火爆落，负责主动技爆燃清场。",
          capstoneName: "烬狱轮转",
          identityTags: ["高热", "贴脸", "融化", "内圈危险"],
          activeClimaxText: "局部高热烧穿",
          graduationSummary: "火环内圈会明显变成高热杀区，主动技则把贴脸区域直接烧穿。",
          baseCooldown: ACTIVE_SKILL_BALANCE.flame?.baseCooldown || 13,
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
          label: "范围流",
          shortLabel: "范围",
          activeName: "留焰封区",
          activeDescription: "在敌群与路径上留下持续留焰区，负责封路与逼位。",
          capstoneName: "焚身领域",
          identityTags: ["封区", "留焰", "切战场", "持续压场"],
          activeClimaxText: "留焰封区切开战场",
          graduationSummary: "火环外扩成持续火场，主动技结束后仍会留下余焰继续封路。",
          baseCooldown: ACTIVE_SKILL_BALANCE.flame?.baseCooldown || 13,
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
          label: "厚盾流",
          shortLabel: "厚盾",
          activeName: "金钟震荡",
          activeDescription: "以玩家为中心稳场震退，负责开路与护体。",
          capstoneName: "不灭金钟",
          identityTags: ["厚", "稳", "护体覆盖", "顶前不退"],
          activeClimaxText: "稳场重置局面",
          graduationSummary: "护体会变得更厚更稳，主动技不再只是震开，而是把局面强行稳回来。",
          baseCooldown: ACTIVE_SKILL_BALANCE.guard?.baseCooldown || 10,
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
          capstoneName: "返天钟鸣",
          identityTags: ["反震", "反弹", "借力反打", "强反制窗口"],
          activeClimaxText: "开反制窗口把攻势打回去",
          graduationSummary: "受击会不断炸出反震回冲，主动技则把短时窗口抬成真正的反打时机。",
          baseCooldown: ACTIVE_SKILL_BALANCE.guard?.baseCooldown || 10,
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
    sword: { baseCooldown: ACTIVE_SKILL_BALANCE.sword?.baseCooldown || 12 },
    thunder: { baseCooldown: ACTIVE_SKILL_BALANCE.thunder?.baseCooldown || 14 },
    guard: { baseCooldown: ACTIVE_SKILL_BALANCE.guard?.baseCooldown || 10 },
    flame: { baseCooldown: ACTIVE_SKILL_BALANCE.flame?.baseCooldown || 13 },
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
    DESTINY_RUNTIME_RULES,
    destinyCatalog,
    skills,
    skillRouteTable,
    activeSkillTable,
    enemies,
  };
})(window);
