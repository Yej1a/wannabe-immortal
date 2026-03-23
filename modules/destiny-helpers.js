(function initDestinyHelpers(global) {
  const {
    META,
    baseStats,
    DESTINY_SLOT_CAP,
    DESTINY_POOL_VERSION,
    DESTINY_RUNTIME_RULES,
    RESULT_DEATH,
    RESULT_CLEAR,
    HUMAN_ENDING_DESTINY_ID,
    destinyCatalog,
  } = global.GameData;

  const ALL_DESTINY_IDS = Object.keys(destinyCatalog);
  const SKILL_REWRITE_DESTINY_TO_SKILL = Object.fromEntries(
    Object.values(DESTINY_RUNTIME_RULES.skillRewriteBindings || {}).map((binding) => [binding.destinyId, binding.skillId]),
  );

  function createFreshDestinyState() {
    return {
      owned: {},
      equipped: [],
      unlocked: [...ALL_DESTINY_IDS],
      maxSlots: DESTINY_SLOT_CAP,
      version: DESTINY_POOL_VERSION,
    };
  }

  function getDefaultEquippedIds(ownedState) {
    return Object.keys(ownedState || {})
      .filter((id) => !!destinyCatalog[id])
      .slice(0, DESTINY_SLOT_CAP);
  }

  function createMigratedDestinyState(destinyState) {
    if (!destinyState || typeof destinyState !== "object") return createFreshDestinyState();
    const owned = destinyState.owned && typeof destinyState.owned === "object"
      ? { ...destinyState.owned }
      : {};
    const equipped = Array.isArray(destinyState.equipped) ? [...destinyState.equipped] : [];
    const unlocked = Array.isArray(destinyState.unlocked) ? [...destinyState.unlocked] : [...ALL_DESTINY_IDS];
    return {
      owned,
      equipped: equipped.length ? equipped : getDefaultEquippedIds(owned),
      unlocked,
      maxSlots: DESTINY_SLOT_CAP,
      version: DESTINY_POOL_VERSION,
    };
  }

  function ensureMetaCollections(metaState) {
    if (!metaState.destiny || typeof metaState.destiny !== "object") {
      metaState.destiny = createFreshDestinyState();
    } else if (metaState.destiny.version !== DESTINY_POOL_VERSION) {
      metaState.destiny = createMigratedDestinyState(metaState.destiny);
    }
    if (!metaState.destiny.owned || typeof metaState.destiny.owned !== "object") metaState.destiny.owned = {};
    if (!Array.isArray(metaState.destiny.equipped)) metaState.destiny.equipped = [];
    if (!Array.isArray(metaState.destiny.unlocked)) metaState.destiny.unlocked = [...ALL_DESTINY_IDS];
    metaState.destiny.maxSlots = DESTINY_SLOT_CAP;
    metaState.destiny.version = DESTINY_POOL_VERSION;
    metaState.destiny.unlocked = [...new Set(
      metaState.destiny.unlocked
        .filter((id) => !!destinyCatalog[id])
        .concat(Object.keys(metaState.destiny.owned).filter((id) => !!destinyCatalog[id])),
    )];
    if (!metaState.destiny.unlocked.length) metaState.destiny.unlocked = [...ALL_DESTINY_IDS];

    Object.entries(metaState.destiny.owned).forEach(([id, entry]) => {
      const def = destinyCatalog[id];
      if (!def) return;
      if (!entry || typeof entry !== "object") {
        metaState.destiny.owned[id] = { alignment: def.alignment };
        return;
      }
      entry.alignment = def.alignment;
      delete entry.level;
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
      getDefaultEquippedIds(metaState.destiny.owned).forEach((id) => {
        if (!equippedIds.includes(id) && equippedIds.length < DESTINY_SLOT_CAP) equippedIds.push(id);
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
      counts[getEntryAlignment(entry)] += 1;
    });
    return counts;
  }

  function getAlignmentResult(state, metaState) {
    const counts = getAlignmentCounts(metaState);
    const hasHumanEnding = HUMAN_ENDING_DESTINY_ID
      ? getEquippedDestinyEntries(metaState).some((entry) => entry.id === HUMAN_ENDING_DESTINY_ID)
      : false;
    if (hasHumanEnding) return "成人（Be Human）";
    if (counts.white > counts.black) return "成仙";
    if (counts.black > counts.white) return "化魔";
    if ((state?.whitePath?.value || 0) > (state?.blackPath?.value || 0)) return "成仙";
    if ((state?.blackPath?.value || 0) > (state?.whitePath?.value || 0)) return "化魔";
    return "成人（Be Human）";
  }

  function getDestinyWeight(alignment, state, metaState) {
    let weight = alignment === "mixed" ? 0.92 : 1;
    const counts = getAlignmentCounts(metaState);
    if (alignment === "white" && counts.white > counts.black) weight *= 1.2;
    if (alignment === "black" && counts.black > counts.white) weight *= 1.2;
    if (alignment === "mixed" && counts.white > 0 && counts.black > 0) weight *= 1.25;
    if (alignment === "white" && (state?.whiteInfusionPoints || 0) > (state?.blackInfusionPoints || 0)) weight *= 1.08;
    if (alignment === "black" && (state?.blackInfusionPoints || 0) > (state?.whiteInfusionPoints || 0)) weight *= 1.08;
    return weight;
  }

  function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1]?.value;
  }

  function getMissingDestinyIds(metaState) {
    const unlockedIds = Array.isArray(metaState?.destiny?.unlocked) && metaState.destiny.unlocked.length
      ? metaState.destiny.unlocked.filter((id) => !!destinyCatalog[id])
      : ALL_DESTINY_IDS;
    return unlockedIds.filter((id) => !metaState.destiny.owned[id]);
  }

  function getRandomDestinyOffers(metaState, state, count = 3) {
    const pool = getMissingDestinyIds(metaState).filter((id) => {
      const def = destinyCatalog[id];
      if (!def) return false;
      if (def.category !== "skill-rewrite") return true;
      const skillId = SKILL_REWRITE_DESTINY_TO_SKILL[id];
      return !!skillId && !!state?.player?.skills?.[skillId];
    });
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

  function describeDestiny(id, alignment = destinyCatalog[id].alignment) {
    const def = destinyCatalog[id];
    return `${def.name} [${alignment}] - ${getDestinyText(def, alignment)}`;
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

  const DESTINY_BONUS_HANDLERS = {};

  function applyDestinyBonusesFromEntries(entries, player, mods) {
    entries.forEach((entry) => {
      const alignment = getEntryAlignment(entry);
      const handler = DESTINY_BONUS_HANDLERS[entry.id]?.[alignment];
      if (handler) handler(1, player, mods);
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
    return deltas.length ? `预览：${deltas.join(" | ")}` : "预览：规则效果型命格，基础属性无变化";
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
      return "当前命盘已满，可在“更换命格”中查看替换后的变化。";
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
