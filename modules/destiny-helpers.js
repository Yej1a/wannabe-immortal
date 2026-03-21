(function initDestinyHelpers(global) {
  const {
    META,
    baseStats,
    DESTINY_SLOT_CAP,
    RESULT_DEATH,
    RESULT_CLEAR,
    HUMAN_ENDING_DESTINY_ID,
    destinyCatalog,
  } = global.GameData;

  const ALL_DESTINY_IDS = Object.keys(destinyCatalog);

  function ensureMetaCollections(metaState) {
    if (!metaState.destiny) metaState.destiny = {
      owned: {},
      equipped: [],
      unlocked: [...ALL_DESTINY_IDS],
      maxSlots: DESTINY_SLOT_CAP,
    };
    if (!metaState.destiny.owned) metaState.destiny.owned = {};
    if (!metaState.destiny.equipped) metaState.destiny.equipped = [];
    if (!Array.isArray(metaState.destiny.unlocked)) metaState.destiny.unlocked = [...ALL_DESTINY_IDS];
    metaState.destiny.maxSlots = DESTINY_SLOT_CAP;
    metaState.destiny.unlocked = [...new Set(
      metaState.destiny.unlocked
        .filter((id) => !!destinyCatalog[id])
        .concat(Object.keys(metaState.destiny.owned).filter((id) => !!destinyCatalog[id])),
    )];
    Object.entries(metaState.destiny.owned).forEach(([id, entry]) => {
      const def = destinyCatalog[id];
      if (!def) return;
      if (!entry || typeof entry !== "object") {
        metaState.destiny.owned[id] = { level: 1, alignment: def.alignment };
        return;
      }
      if (!entry.level) entry.level = 1;
      if (!entry.alignment) entry.alignment = def.alignment;
    });
    metaState.destiny.owned = Object.fromEntries(
      Object.entries(metaState.destiny.owned).filter(([id, entry]) => !!destinyCatalog[id] && !!entry),
    );
    const equippedIds = [];
    metaState.destiny.equipped.forEach((id) => {
      if (!metaState.destiny.owned[id] || equippedIds.includes(id) || equippedIds.length >= DESTINY_SLOT_CAP) return;
      equippedIds.push(id);
    });
    if (!equippedIds.length) {
      Object.keys(metaState.destiny.owned).some((id) => {
        if (equippedIds.length >= DESTINY_SLOT_CAP) return true;
        equippedIds.push(id);
        return false;
      });
    }
    metaState.destiny.equipped = equippedIds;
    metaState.destiny.owned = Object.fromEntries(
      equippedIds
        .map((id) => [id, metaState.destiny.owned[id]])
        .filter(([, entry]) => !!entry),
    );
  }

  function getEntryAlignment(entry) {
    return entry?.def?.alignment || entry?.alignment || "mixed";
  }

  function getDestinyText(def, alignment) {
    return def?.text?.[alignment] || def?.text?.[def?.alignment] || "";
  }

  function getOwnedDestinyEntries(metaState) {
    return Object.entries(metaState.destiny.owned)
      .map(([id, entry]) => ({ id, ...entry, def: destinyCatalog[id] }))
      .filter((entry) => entry.def);
  }

  function getEquippedDestinyEntries(metaState) {
    return metaState.destiny.equipped
      .map((id) => (metaState.destiny.owned[id] ? { id, ...metaState.destiny.owned[id], def: destinyCatalog[id] } : null))
      .filter(Boolean);
  }

  function getUnequippedOwnedDestinyEntries(metaState) {
    const equippedSet = new Set(metaState.destiny.equipped);
    return getOwnedDestinyEntries(metaState).filter((entry) => !equippedSet.has(entry.id));
  }

  function getAlignmentCounts(metaState) {
    const counts = { white: 0, black: 0, mixed: 0 };
    getEquippedDestinyEntries(metaState).forEach((entry) => {
      const alignment = getEntryAlignment(entry);
      counts[alignment] = (counts[alignment] || 0) + 1;
    });
    return counts;
  }

  function getAlignmentResult(state, metaState) {
    const counts = getAlignmentCounts(metaState);
    const hasHumanEnding = getEquippedDestinyEntries(metaState).some((entry) => entry.id === HUMAN_ENDING_DESTINY_ID);
    if (!hasHumanEnding && counts.white === counts.black) return "鎴愪粰";
    if (hasHumanEnding) return "成人（Be Human）";
    if (counts.white > counts.black) return "成仙";
    if (counts.black > counts.white) return "化魔";
    if ((state?.whitePath?.value || 0) > (state?.blackPath?.value || 0)) return "成仙";
    if ((state?.blackPath?.value || 0) > (state?.whitePath?.value || 0)) return "化魔";
    return "成仙";
  }

  function getDestinyWeight(alignment, state, metaState) {
    let weight = alignment === "mixed" ? 0.9 : 1;
    const counts = getAlignmentCounts(metaState);
    state = {
      ...state,
      whitePath: { ...state?.whitePath, full: false },
      blackPath: { ...state?.blackPath, full: false },
    };
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

  function getMissingDestinyIds(metaState) {
    const unlockedIds = Array.isArray(metaState?.destiny?.unlocked) && metaState.destiny.unlocked.length
      ? metaState.destiny.unlocked.filter((id) => !!destinyCatalog[id])
      : ALL_DESTINY_IDS;
    return unlockedIds.filter((id) => !metaState.destiny.owned[id]);
  }

  function getRandomDestinyOffers(metaState, state, count = 3) {
    const pool = getMissingDestinyIds(metaState);
    const offers = [];
    while (pool.length > 0 && offers.length < count) {
      const id = weightedPick(
        pool.map((destinyId) => ({
          value: destinyId,
          weight: getDestinyWeight(destinyCatalog[destinyId].alignment, state, metaState),
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

  function formatResultLabel(result) {
    if (result === RESULT_DEATH) return "陨落";
    if (result === RESULT_CLEAR) return "通关";
    return result;
  }

  function getDestinyEntriesFromEquippedIds(metaState, equippedIds) {
    return equippedIds
      .map((id) => (metaState.destiny.owned[id] ? { id, ...metaState.destiny.owned[id], def: destinyCatalog[id] } : null))
      .filter((entry) => entry?.def);
  }

  const DESTINY_BONUS_HANDLERS = {
    vital: {
      white: (level, player) => {
        player.maxHp += 18 * level;
        player.regen += 0.08 * level;
      },
      black: (level, player, mods) => {
        mods.damageMult += 0.06 * level;
      },
      mixed: (level, player) => {
        player.pickupRange += 10 * level;
      },
    },
    spirit: {
      white: (level, player, mods) => {
        mods.xpGainMult += 0.1 * level;
      },
      black: (level, player) => {
        player.critChance += 0.04 * level;
      },
      mixed: (level, player) => {
        player.speed += 10 * level;
      },
    },
    river: {
      white: (level, player, mods) => {
        mods.whiteGainMult += 0.12 * level;
      },
      black: (level, player, mods) => {
        mods.blackGainMult += 0.12 * level;
      },
      mixed: (level, player, mods) => {
        mods.whiteGainMult += 0.05 * level;
        mods.blackGainMult += 0.05 * level;
      },
    },
    blade: {
      white: (level, player, mods) => {
        mods.incomingMult *= Math.max(0.65, 1 - 0.08 * level);
      },
      black: (level, player) => {
        player.critDamage += 0.18 * level;
      },
      mixed: (level, player) => {
        player.globalCooldown *= Math.max(0.75, 1 - 0.06 * level);
      },
    },
    thunder: {
      white: (level, player, mods) => {
        player.regen += 0.06 * level;
        mods.xpGainMult += 0.06 * level;
      },
      black: (level, player, mods) => {
        mods.damageMult += 0.05 * level;
        player.globalCooldown *= Math.max(0.72, 1 - 0.05 * level);
      },
      mixed: (level, player) => {
        player.speed += 8 * level;
        player.pickupRange += 8 * level;
      },
    },
    ward: {
      white: (level, player, mods) => {
        player.maxHp += 14 * level;
        mods.whiteGainMult += 0.08 * level;
      },
      black: (level, player, mods) => {
        player.critChance += 0.03 * level;
        mods.blackGainMult += 0.08 * level;
      },
      mixed: (level, player, mods) => {
        mods.damageMult += 0.04 * level;
      },
    },
    reaper: {
      white: (level, player) => {
        player.maxHp += 24 * level;
        player.regen += 0.1 * level;
      },
      black: (level, player, mods) => {
        mods.damageMult += 0.1 * level;
        player.critChance += 0.04 * level;
      },
      mixed: (level, player, mods) => {
        mods.damageMult += 0.05 * level;
        mods.xpGainMult += 0.06 * level;
      },
    },
    lotus: {
      white: (level, player, mods) => {
        mods.xpGainMult += 0.14 * level;
        player.regen += 0.1 * level;
      },
      black: (level, player, mods) => {
        mods.blackGainMult += 0.14 * level;
        mods.damageMult += 0.06 * level;
      },
      mixed: (level, player) => {
        player.speed += 12 * level;
        player.pickupRange += 12 * level;
      },
    },
  };

  function applyDestinyBonusesFromEntries(entries, player, mods) {
    entries.forEach((entry) => {
      const level = entry.level || 1;
      const alignment = getEntryAlignment(entry);
      const handler = DESTINY_BONUS_HANDLERS[entry.id]?.[alignment];
      if (handler) handler(level, player, mods);
    });
  }

  function applyDestinyBonuses(metaState, player, mods) {
    applyDestinyBonusesFromEntries(getEquippedDestinyEntries(metaState), player, mods);
  }

  function createDestinyPreviewSnapshot(metaState, equippedIds = metaState.destiny.equipped) {
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
    applyDestinyBonusesFromEntries(getDestinyEntriesFromEquippedIds(metaState, equippedIds), player, mods);
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

  function getPointifyPreviewRows(metaState, targetId, color) {
    const poolIds = Object.keys(destinyCatalog).filter((id) => {
      const def = destinyCatalog[id];
      if (!def || def.alignment !== color) return false;
      return id === targetId || !metaState.destiny.owned[id];
    });
    const rerollIds = poolIds.filter((id) => id !== targetId);
    const candidateIds = rerollIds.length ? rerollIds : poolIds;
    return [{
      alignment: color,
      chance: 100,
      names: candidateIds.map((id) => destinyCatalog[id].name),
    }];
  }

  function describePointifyPreview(metaState, targetId, color) {
    return getPointifyPreviewRows(metaState, targetId, color)
      .map((row) => `${getAlignmentLabel(row.alignment)} ${row.chance.toFixed(1)}% -> ${row.names.join(" / ")}`)
      .join(" | ");
  }

  function getPointifyEquipPreview(metaState, nextId) {
    if (metaState.destiny.equipped.length >= metaState.destiny.maxSlots) {
      return "当前命盘已满，可在“更换命格”中查看替换后的属性变化。";
    }
    const before = createDestinyPreviewSnapshot(metaState, metaState.destiny.equipped);
    const after = createDestinyPreviewSnapshot(metaState, [...metaState.destiny.equipped, nextId]);
    return `若稍后装配：${describeDestinyStatDelta(before, after).replace("预览：", "")}`;
  }

  global.DestinyHelpers = {
    ensureMetaCollections,
    getEntryAlignment,
    getDestinyText,
    getOwnedDestinyEntries,
    getEquippedDestinyEntries,
    getUnequippedOwnedDestinyEntries,
    getAlignmentCounts,
    getAlignmentResult,
    getDestinyWeight,
    weightedPick,
    getMissingDestinyIds,
    getRandomDestinyOffers,
    describeDestiny,
    getAlignmentLabel,
    formatResultLabel,
    getDestinyEntriesFromEquippedIds,
    applyDestinyBonusesFromEntries,
    applyDestinyBonuses,
    createDestinyPreviewSnapshot,
    formatSignedStat,
    describeDestinyStatDelta,
    getPointifyPreviewRows,
    describePointifyPreview,
    getPointifyEquipPreview,
  };
})(window);
