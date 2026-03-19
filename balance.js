// Balance sheet
// Modify values here, save the file, then refresh the page to test changes.
window.GAME_BALANCE = {
  playerTable: {
    maxHp: 120,
    speed: 220,
    critChance: 0.05,
    critDamage: 1.5,
    pickupRange: 70,
    regen: 0.35,
    invuln: 0.38,
    xpCurve: [20, 28, 36, 46, 58, 72, 88, 106, 126, 148, 172, 198],
  },

  progression: {
    duration: 600,
    firstPathCap: 100,
    secondPathCap: 80,
  },

  reincarnationTable: {
    storageKey: "wannabe-immortal-save",
    pointsFromTimeDivisor: 60,
    pointsFromKillsDivisor: 20,
    transformBonus: 4,
    bossWinBonus: 10,
    pathWinBonus: 6,
    upgrades: {
      hp1: { name: "命元残存", cost: 6, maxLevel: 3, effectPerLevel: 10 },
      xp1: { name: "聚灵残痕", cost: 6, maxLevel: 3, effectPerLevel: 0.08 },
      pickup1: { name: "摄气残痕", cost: 4, maxLevel: 2, effectPerLevel: 0.15 },
      white1: { name: "白炁余韵", cost: 5, maxLevel: 2, effectPerLevel: 0.1 },
      black1: { name: "黑炁余烬", cost: 5, maxLevel: 2, effectPerLevel: 0.1 },
      starter: { name: "前世所悟", cost: 8, maxLevel: 1, effectPerLevel: 1 },
    },
  },

  waves: {
    spawnIntervalEarly: 2.5,
    spawnIntervalMid: 2.0,
    spawnIntervalLate: 1.5,
    levelIntervalReduction: 0.1,
    minSpawnInterval: 0.4,

    countEarly: 3,
    countMid: 5,
    countLate: 7,
    countEnd: 10,

    eliteSchedule: [140, 255, 360, 450],

    healthBands: [
      { until: 120, mult: 1.1 },
      { until: 240, mult: 1.65 },
      { until: 360, mult: 2.2 },
      { until: 480, mult: 2.95 },
      { until: Infinity, mult: 3.5 },
    ],

    damageBands: [
      { until: 120, mult: 1.15 },
      { until: 240, mult: 1.35 },
      { until: 360, mult: 1.6 },
      { until: 480, mult: 1.9 },
      { until: Infinity, mult: 2.2 },
    ],
  },

  monsterTable: {
    grunt: {
      name: "小妖",
      hp: 34,
      damage: 11,
      speed: 84,
      radius: 14,
      xp: 4,
      orb: 4,
      meleeCooldown: 0.42,
    },

    charger: {
      name: "冲锋鬼",
      hp: 52,
      damage: 16,
      speed: 108,
      radius: 15,
      xp: 6,
      orb: 6,
      meleeCooldown: 0.55,
      dashCooldown: 1.2,
      dashSpeedMult: 2.5,
    },

    ranged: {
      name: "远程灵体",
      hp: 32,
      damage: 13,
      speed: 62,
      radius: 13,
      xp: 5,
      orb: 5,
      meleeCooldown: 0.5,
      shotCooldown: 1.15,
      projectileSpeed: 260,
      preferredRange: 190,
    },

    elite: {
      name: "精英护法",
      hp: 240,
      damage: 24,
      speed: 76,
      radius: 20,
      xp: 20,
      orb: 18,
      meleeCooldown: 0.68,
    },

    boss: {
      name: "天劫法相",
      hp: 5200,
      damage: 32,
      speed: 84,
      radius: 34,
      contactCooldown: 0.55,

      phaseTwoAt: 0.7,
      phaseThreeAt: 0.35,

      attackCooldowns: {
        phase1: 0.95,
        phase2: 0.72,
        phase3: 0.52,
      },

      radialProjectileCount: 12,
      radialProjectileSpeed: 240,

      fanProjectileCount: 5,
      fanProjectileSpeed: 300,

      waveRadius: 150,
      waveDamageMult: 0.9,

      summonCountPhase2: 2,
      summonCountPhase3: 3,
    },
  },
};
