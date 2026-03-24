(function initDestinyHelpers(global) {
  const {
    BALANCE,
    META,
    baseStats,
    DESTINY_SLOT_CAP,
    DESTINY_POOL_VERSION,
    DESTINY_RUNTIME_RULES,
    DESTINY_TIER_WEIGHTS,
    RESULT_DEATH,
    RESULT_CLEAR,
    HUMAN_ENDING_DESTINY_ID,
    destinyCatalog,
  } = global.GameData;

  const ALL_DESTINY_IDS = Object.keys(destinyCatalog);
  const DESTINY_TIER_ORDER = ["common", "true", "fated"];
  const SKILL_REWRITE_DESTINY_TO_SKILL = Object.fromEntries(
    Object.values(DESTINY_RUNTIME_RULES.skillRewriteBindings || {}).map((binding) => [binding.destinyId, binding.skillId]),
  );
  const DESTINY_TABLE = BALANCE.destinyTable || {};
  const DESTINY_REWARD_TIER_WEIGHTS = DESTINY_TABLE.rewardTierWeights || {};
  const DESTINY_MIXED_ALIGNMENT_WEIGHT_MULT = DESTINY_TABLE.mixedAlignmentWeightMult || 0.5;
  const DESTINY_QUALITY_SCORES = DESTINY_TABLE.qualityScores || {
    common: 1,
    true: 2.5,
    fated: 5,
  };
  const DESTINY_BOSS_QUALITY_REROLLS = DESTINY_TABLE.bossQualityRerolls || 2;
  const DESTINY_MAX_UNLEARNED_TECHNIQUE_OFFERS = DESTINY_TABLE.maxUnlearnedTechniqueOffers || 1;
  const DESTINY_FORTUNE_UPGRADE_ID = DESTINY_TABLE.fortuneUpgradeId || "fortune1";
  const DESTINY_FORTUNE_PER_LEVEL = DESTINY_TABLE.fortunePerLevel || {
    true: 0.12,
    fated: 0.06,
  };

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
    const counts = { white: 0, black: 0, mixed: 0, technique: 0 };
    getEquippedDestinyEntries(metaState).forEach((entry) => {
      const alignment = getEntryAlignment(entry);
      counts[alignment] = (counts[alignment] || 0) + 1;
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

  function getDestinyTierLabel(tier) {
    if (tier === "common") return "凡命";
    if (tier === "true") return "真传";
    if (tier === "fated") return "天命";
    return "未知";
  }

  function getDestinyRewardTierWeights(source = "generic", runIndex = 1) {
    const rewardWeights = DESTINY_REWARD_TIER_WEIGHTS[source];
    if (!rewardWeights) return DESTINY_TIER_WEIGHTS;
    if (typeof rewardWeights.common === "number") return rewardWeights;
    return rewardWeights[runIndex] || rewardWeights[3] || rewardWeights[1] || DESTINY_TIER_WEIGHTS;
  }

  function getDestinyFortuneLevel(metaState) {
    return Math.max(0, metaState?.upgrades?.[DESTINY_FORTUNE_UPGRADE_ID] || 0);
  }

  function getDestinyFortuneMultiplier(tier, metaState) {
    const level = getDestinyFortuneLevel(metaState);
    if (level <= 0) return 1;
    const perLevel = DESTINY_FORTUNE_PER_LEVEL[tier] || 0;
    return 1 + perLevel * level;
  }

  function getDestinyOfferContext(options = {}, state = null) {
    const base = typeof options === "number" ? { count: options } : { ...(options || {}) };
    return {
      count: Math.max(1, base.count || 3),
      source: base.source || "generic",
      runIndex: Math.max(1, base.runIndex || state?.campaign?.runIndex || 1),
      applyFortune: !!base.applyFortune,
      applyCategoryModifier: base.applyCategoryModifier !== false,
      maxUnlearnedTechniqueOffers: base.maxUnlearnedTechniqueOffers ?? DESTINY_MAX_UNLEARNED_TECHNIQUE_OFFERS,
    };
  }

  function getDestinyWeight(idOrTier, options = {}) {
    const def = destinyCatalog[idOrTier] || null;
    const tier = def?.tier || idOrTier;
    const source = options.source || "generic";
    const runIndex = Math.max(1, options.runIndex || 1);
    const tierWeights = source === "generic"
      ? DESTINY_TIER_WEIGHTS
      : getDestinyRewardTierWeights(source, runIndex);
    let weight = tierWeights?.[tier] ?? DESTINY_TIER_WEIGHTS[tier] ?? 1;
    if (def?.alignment === "mixed" && options.applyCategoryModifier !== false) {
      weight *= DESTINY_MIXED_ALIGNMENT_WEIGHT_MULT;
    }
    if (options.applyFortune) {
      weight *= getDestinyFortuneMultiplier(tier, options.metaState);
    }
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

  function getTechniqueDestinySkillId(id) {
    return SKILL_REWRITE_DESTINY_TO_SKILL[id] || null;
  }

  function isUnlearnedTechniqueOffer(id, state) {
    const skillId = getTechniqueDestinySkillId(id);
    if (!skillId) return false;
    return !state?.player?.skills?.[skillId];
  }

  function isDestinyOfferEligible(id, state, options = {}) {
    const def = destinyCatalog[id];
    if (!def) return false;
    if (def.category !== "skill-rewrite") return true;
    const skillId = getTechniqueDestinySkillId(id);
    if (!skillId) return false;
    if (state?.player?.skills?.[skillId]) return true;
    return (state?.player?.skillOrder?.length || 0) < 3 && options.allowUnlearnedTechnique !== false;
  }

  function getDestinyOfferQualityScore(offers = []) {
    return offers.reduce((sum, offer) => {
      const id = typeof offer === "string" ? offer : offer?.id;
      const tier = destinyCatalog[id]?.tier || "common";
      return sum + (DESTINY_QUALITY_SCORES[tier] || 0);
    }, 0);
  }

  function drawDestinyOffers(metaState, state, context) {
    const pool = getMissingDestinyIds(metaState).filter((id) => isDestinyOfferEligible(id, state, context));
    const offers = [];
    let unlearnedTechniqueCount = 0;
    while (pool.length > 0 && offers.length < context.count) {
      const weightedPool = pool
        .filter((destinyId) => (
          !isUnlearnedTechniqueOffer(destinyId, state)
          || unlearnedTechniqueCount < context.maxUnlearnedTechniqueOffers
        ))
        .map((destinyId) => ({
          value: destinyId,
          weight: getDestinyWeight(destinyId, {
            source: context.source,
            runIndex: context.runIndex,
            metaState,
            applyFortune: context.applyFortune,
            applyCategoryModifier: context.applyCategoryModifier,
          }),
        }))
        .filter((entry) => entry.weight > 0);
      if (!weightedPool.length) break;
      const id = weightedPick(weightedPool);
      pool.splice(pool.indexOf(id), 1);
      if (isUnlearnedTechniqueOffer(id, state)) unlearnedTechniqueCount += 1;
      offers.push({ id });
    }
    return offers;
  }

  function getCurrentRunSmallBossQualityBaseline(state, runIndex) {
    if (!state?.campaign || state.campaign.runIndex !== runIndex) return 0;
    const count = state.campaign.smallBossOfferCount || 0;
    if (count <= 0) return 0;
    return (state.campaign.smallBossOfferQualityTotal || 0) / count;
  }

  function canPromoteOfferWithCandidate(offers, replaceIndex, candidateId, state, context) {
    let unlearnedTechniqueCount = 0;
    for (let index = 0; index < offers.length; index += 1) {
      const offerId = index === replaceIndex ? candidateId : offers[index].id;
      if (isUnlearnedTechniqueOffer(offerId, state)) unlearnedTechniqueCount += 1;
    }
    return unlearnedTechniqueCount <= context.maxUnlearnedTechniqueOffers;
  }

  function promoteDestinyOffers(metaState, state, offers, context, baselineScore) {
    if (!offers.length) return offers;
    let nextOffers = offers.map((offer) => ({ ...offer }));
    while (getDestinyOfferQualityScore(nextOffers) <= baselineScore) {
      let bestUpgrade = null;
      const currentIds = new Set(nextOffers.map((offer) => offer.id));
      for (let replaceIndex = 0; replaceIndex < nextOffers.length; replaceIndex += 1) {
        const currentQuality = DESTINY_QUALITY_SCORES[destinyCatalog[nextOffers[replaceIndex].id]?.tier] || 0;
        const candidates = getMissingDestinyIds(metaState)
          .filter((id) => !currentIds.has(id))
          .filter((id) => isDestinyOfferEligible(id, state, context))
          .filter((id) => (DESTINY_QUALITY_SCORES[destinyCatalog[id]?.tier] || 0) > currentQuality)
          .filter((id) => canPromoteOfferWithCandidate(nextOffers, replaceIndex, id, state, context));
        candidates.forEach((id) => {
          const candidateWeight = getDestinyWeight(id, {
            source: context.source,
            runIndex: context.runIndex,
            metaState,
            applyFortune: context.applyFortune,
            applyCategoryModifier: context.applyCategoryModifier,
          });
          if (candidateWeight <= 0) return;
          const promotedOffers = nextOffers.map((offer, index) => (index === replaceIndex ? { id } : offer));
          const promotedScore = getDestinyOfferQualityScore(promotedOffers);
          if (
            !bestUpgrade
            || promotedScore > bestUpgrade.score
            || (promotedScore === bestUpgrade.score && candidateWeight > bestUpgrade.weight)
          ) {
            bestUpgrade = {
              replaceIndex,
              id,
              score: promotedScore,
              weight: candidateWeight,
            };
          }
        });
      }
      if (!bestUpgrade || bestUpgrade.score <= getDestinyOfferQualityScore(nextOffers)) break;
      nextOffers = nextOffers.map((offer, index) => (index === bestUpgrade.replaceIndex ? { id: bestUpgrade.id } : offer));
    }
    return nextOffers;
  }

  function getRandomDestinyOffers(metaState, state, options = 3) {
    const context = getDestinyOfferContext(options, state);
    let offers = drawDestinyOffers(metaState, state, context);
    if (context.source !== "bigBoss") return offers;
    const baselineScore = getCurrentRunSmallBossQualityBaseline(state, context.runIndex);
    if (baselineScore <= 0) return offers;
    let qualityScore = getDestinyOfferQualityScore(offers);
    for (let attempt = 0; attempt < DESTINY_BOSS_QUALITY_REROLLS && qualityScore <= baselineScore; attempt += 1) {
      offers = drawDestinyOffers(metaState, state, context);
      qualityScore = getDestinyOfferQualityScore(offers);
    }
    if (qualityScore <= baselineScore) {
      offers = promoteDestinyOffers(metaState, state, offers, context, baselineScore);
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
    if (alignment === "technique") return "技法";
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

  function getPointifyPreviewRows(metaState, targetId, _color = null, state = null) {
    const poolIds = Object.keys(destinyCatalog).filter((id) => {
      if (!destinyCatalog[id]) return false;
      if (state && !isDestinyOfferEligible(id, state)) return false;
      return id === targetId || !metaState.destiny.owned[id];
    });
    const rerollIds = poolIds.filter((id) => id !== targetId);
    const candidateIds = rerollIds.length ? rerollIds : poolIds;
    const totalWeight = candidateIds.reduce((sum, id) => sum + getDestinyWeight(id, {
      source: "generic",
      runIndex: state?.campaign?.runIndex || 1,
      metaState,
      applyFortune: false,
      applyCategoryModifier: true,
    }), 0);
    return DESTINY_TIER_ORDER.map((tier) => {
      const ids = candidateIds.filter((id) => destinyCatalog[id].tier === tier);
      const tierWeight = ids.reduce((sum, id) => sum + getDestinyWeight(id, {
        source: "generic",
        runIndex: state?.campaign?.runIndex || 1,
        metaState,
        applyFortune: false,
        applyCategoryModifier: true,
      }), 0);
      return {
        tier,
        chance: totalWeight > 0 ? (tierWeight / totalWeight) * 100 : 0,
        count: ids.length,
      };
    }).filter((row) => row.count > 0);
  }

  function describePointifyPreview(metaState, targetId, color, state = null) {
    return getPointifyPreviewRows(metaState, targetId, color, state)
      .map((row) => `${getDestinyTierLabel(row.tier)} ${row.chance.toFixed(1)}% (${row.count} 种)`)
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
    getDestinyTierLabel,
    getDestinyWeight,
    weightedPick,
    getMissingDestinyIds,
    getTechniqueDestinySkillId,
    isUnlearnedTechniqueOffer,
    isDestinyOfferEligible,
    getDestinyOfferQualityScore,
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
