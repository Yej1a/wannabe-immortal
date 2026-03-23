(function initGameplayHelpers(global) {
  function createGameplayHelpers(deps) {
    const {
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
    } = deps;

    function hasEquippedDestiny(id) {
      return metaState.destiny.equipped.includes(id);
    }

    function addStatus(name, duration, effects) {
      const existing = state.statuses.find((status) => status.name === name);
      if (existing) {
        existing.duration = duration;
        existing.remaining = duration;
        existing.effects = effects;
        return existing;
      }
      const next = { name, duration, remaining: duration, effects };
      state.statuses.push(next);
      return next;
    }

    function hasStatus(name) {
      return state.statuses.some((status) => status.name === name);
    }

    function getStatus(name) {
      return state.statuses.find((status) => status.name === name) || null;
    }

    function isWhiteCombatStatusActive() {
      return hasStatus("清明") || hasStatus("灵护") || hasStatus("天息");
    }

    function isBlackCombatStatusActive() {
      return hasStatus("煞燃") || hasStatus("魔驰") || hasStatus("魔沸");
    }

    function isBloodBattleWindowActive() {
      return false;
    }

    function isGuiyuanActive() {
      return false;
    }

    function getActiveLevel(skill) {
      return Math.max(0, skill.rank - (ACTIVE_UNLOCK_RANK - 1));
    }

    function getSkillRouteState(skillId, skill) {
      const routeTable = skillRouteTable[skillId];
      if (!routeTable) return null;
      const activeRouteId = skill?.route || routeTable.defaultRoute;
      return {
        routeId: activeRouteId,
        route: routeTable.routes[activeRouteId],
        locked: !!skill?.route,
        defaultRouteId: routeTable.defaultRoute,
        defaultRoute: routeTable.routes[routeTable.defaultRoute],
      };
    }

    function getSkillRouteStage(skillId, skill) {
      const routeState = getSkillRouteState(skillId, skill);
      if (!routeState) return null;
      const branchCount = getSkillBranchCount(skill, routeState.routeId);
      const graduated = !!skill?.capstone && skill.capstone === routeState.routeId;
      const stage = !routeState.locked
        ? "prototype"
        : graduated
          ? "graduated"
          : branchCount >= 2
            ? "formed"
            : "branched";
      return {
        ...routeState,
        branchCount,
        graduated,
        stage,
        capstoneName: routeState.route?.capstoneName || routeState.route?.activeName || "",
      };
    }

    function getSkillRouteDisplayLabel(skillId, skill) {
      const routeStage = getSkillRouteStage(skillId, skill);
      if (!routeStage) return "未分路";
      if (!routeStage.locked) return `未分路（当前按 ${routeStage.route.label} 原型）`;
      return routeStage.route.label;
    }

    function getSkillRouteLabel(skillId, skill) {
      const routeState = getSkillRouteState(skillId, skill);
      if (!routeState) return "未分路";
      return routeState.locked ? routeState.route.label : `未分路（当前按 ${routeState.route.label} 原型）`;
    }

    function getSkillActiveProfile(skillId, skill) {
      const routeState = getSkillRouteState(skillId, skill);
      if (routeState?.route) return routeState.route;
      return {
        activeName: skills[skillId]?.name || skillId,
        activeDescription: "",
        baseCooldown: activeSkillTable[skillId]?.baseCooldown || 18,
      };
    }

    function getActiveCooldown(id, level, skill = state.player.skills[id]) {
      const base = getSkillActiveProfile(id, skill).baseCooldown || activeSkillTable[id]?.baseCooldown || 18;
      return Math.max(base * 0.55, base - (level - 1) * 1.2);
    }

    function getSkillRouteVfx(skillId, skill) {
      const routeState = getSkillRouteState(skillId, skill);
      if (routeState?.route?.vfx) return routeState.route.vfx;
      return {
        palette: skills[skillId]?.art || {},
        auto: {},
        active: {},
      };
    }

    function isActiveUnlocked(skill) {
      return getActiveLevel(skill) > 0;
    }

    function getSkillBranchCount(skill, routeId) {
      return skill?.routePoints?.[routeId] || 0;
    }

    function canTakeBranchUpgrade(stateRef, skillId, routeId) {
      const skill = stateRef.player.skills[skillId];
      if (!skill) return false;
      if ((skill.baseUpgrades || 0) < BRANCH_UNLOCK_BASE_UPGRADES) return false;
      return !skill.route || skill.route === routeId;
    }

    function canTakeCapstoneUpgrade(stateRef, skillId, routeId) {
      const skill = stateRef.player.skills[skillId];
      if (!skill || skill.route !== routeId) return false;
      if (getSkillBranchCount(skill, routeId) < 2) return false;
      return skill.capstone !== routeId;
    }

    function markRouteSwitch(stateRef, skillId, routeId) {
      const route = skillRouteTable[skillId]?.routes?.[routeId];
      if (!route) return;
      stateRef.routeShiftNotice = `${skills[skillId].name}转入${route.label}：主动技切换为 ${route.activeName}`;
    }

    function markRouteGraduation(stateRef, skillId, routeId) {
      const route = skillRouteTable[skillId]?.routes?.[routeId];
      if (!route) return;
      const capstoneName = route.capstoneName || route.activeName;
      stateRef.routeShiftNotice = `${skills[skillId].name}已成：${route.label}·${capstoneName}`;
    }

    function applySkillBaseUpgrade(stateRef, skillId, mutator) {
      const skill = stateRef.player.skills[skillId];
      if (!skill) return;
      mutator(skill);
      skill.rank += 1;
      skill.baseUpgrades = (skill.baseUpgrades || 0) + 1;
      if (!skill.route && skill.baseUpgrades >= BRANCH_UNLOCK_BASE_UPGRADES && skill.branchReadyOrder == null) {
        stateRef.branchWindowCounter = (stateRef.branchWindowCounter || 0) + 1;
        skill.branchReadyOrder = stateRef.branchWindowCounter;
      }
      stateRef.player.skillFocus[skillId] = (stateRef.player.skillFocus[skillId] || 0) + 1;
    }

    function applySkillBranchUpgrade(stateRef, skillId, routeId, mutator) {
      const skill = stateRef.player.skills[skillId];
      if (!skill) return;
      mutator(skill);
      skill.rank += 1;
      if (!skill.route) {
        skill.route = routeId;
        markRouteSwitch(stateRef, skillId, routeId);
      }
      if (!skill.routePoints) skill.routePoints = {};
      skill.routePoints[routeId] = (skill.routePoints[routeId] || 0) + 1;
      stateRef.player.skillFocus[skillId] = (stateRef.player.skillFocus[skillId] || 0) + 1;
    }

    function applySkillCapstoneUpgrade(stateRef, skillId, routeId, mutator) {
      const skill = stateRef.player.skills[skillId];
      if (!skill) return;
      mutator(skill);
      skill.rank += 1;
      skill.route = routeId;
      skill.capstone = routeId;
      markRouteGraduation(stateRef, skillId, routeId);
      stateRef.player.skillFocus[skillId] = (stateRef.player.skillFocus[skillId] || 0) + 1;
    }

    function nearestEnemyFromPoint(origin) {
      const targets = [...state.enemies];
      if (state.boss) targets.push(state.boss);
      return targets.sort((a, b) => distance(a, origin) - distance(b, origin))[0] || null;
    }

    function getTargetsWithinRadius(origin, radius) {
      const targets = state.enemies.filter((enemy) => distance(origin, enemy) <= radius + enemy.radius);
      if (state.boss && distance(origin, state.boss) <= radius + state.boss.radius) targets.push(state.boss);
      return targets;
    }

    function getCombatTargets() {
      const targets = [...state.enemies];
      if (state.boss) targets.push(state.boss);
      return targets;
    }

    function getThreatScore(target, origin = state.player, { preferLowHp = false } = {}) {
      const hpRatio = target.hp / Math.max(1, target.maxHp);
      let score = 0;
      if (target.type === "boss") score += 1200;
      else if (target.isMiniBoss) score += 720;
      else if (target.type === "elite") score += 540;
      else if (target.type === "ranged") score += 220;
      else if (target.type === "charger") score += 160;
      else score += 80;
      if (preferLowHp) score += (1 - hpRatio) * 260;
      else score += (1 - hpRatio) * 90;
      score -= distance(target, origin) * 0.42;
      return score;
    }

    function pickPriorityTarget(origin = state.player, options = {}) {
      const targets = getCombatTargets();
      if (!targets.length) return null;
      return targets
        .slice()
        .sort((a, b) => getThreatScore(b, origin, options) - getThreatScore(a, origin, options))[0] || null;
    }

    function getEnemyClusterCenter(origin = state.player, clusterRadius = 130) {
      const targets = getCombatTargets();
      if (!targets.length) return null;
      let best = null;
      let bestScore = -Infinity;
      targets.forEach((anchor) => {
        const nearby = targets.filter((target) => distance(target, anchor) <= clusterRadius);
        const score = nearby.reduce((sum, target) => sum + Math.max(1, getThreatScore(target, origin) / 80), 0) + nearby.length * 3;
        if (score <= bestScore) return;
        const center = nearby.reduce((acc, target) => {
          acc.x += target.x;
          acc.y += target.y;
          return acc;
        }, { x: 0, y: 0 });
        bestScore = score;
        best = {
          x: center.x / nearby.length,
          y: center.y / nearby.length,
          score,
          count: nearby.length,
        };
      });
      return best;
    }

    function getForwardPoint(distanceAhead = 100) {
      const facingLength = Math.hypot(state.player.facingX || 0, state.player.facingY || 0) || 1;
      return {
        x: clamp(state.player.x + ((state.player.facingX || 1) / facingLength) * distanceAhead, 40, WIDTH - 40),
        y: clamp(state.player.y + ((state.player.facingY || 0) / facingLength) * distanceAhead, 40, HEIGHT - 40),
      };
    }

    function getMoveMult() {
      let mult = 1;
      state.statuses.forEach((status) => {
        if (status.effects.moveMult) mult *= status.effects.moveMult;
      });
      return mult;
    }

    function getPickupRange() {
      let bonus = 0;
      state.statuses.forEach((status) => {
        if (status.effects.pickupBonus) bonus += status.effects.pickupBonus;
      });
      return state.player.pickupRange + bonus;
    }

    function getCritChance() {
      let bonus = 0;
      state.statuses.forEach((status) => {
        if (status.effects.critChanceBonus) bonus += status.effects.critChanceBonus;
      });
      return state.player.critChance + bonus;
    }

    function getActiveCooldownRate() {
      let mult = 1;
      state.statuses.forEach((status) => {
        if (status.effects.activeCooldownRate) mult *= status.effects.activeCooldownRate;
      });
      return mult;
    }

    function getKillHealProfile() {
      let healPct = 0;
      let cooldown = 0;
      state.statuses.forEach((status) => {
        if (status.effects.onKillHealPct) {
          healPct += status.effects.onKillHealPct;
          cooldown = Math.max(cooldown, status.effects.onKillHealCooldown || 0);
        }
      });
      return { healPct, cooldown };
    }

    function getDropAttractProfile(drop) {
      let radius = 0;
      let speed = 0;
      let speedMult = 1;
      state.statuses.forEach((status) => {
        const effects = status.effects;
        if (effects.attractRadius && effects.attractSpeed) {
          radius = Math.max(radius, effects.attractRadius);
          speed = Math.max(speed, effects.attractSpeed);
        }
      });
      if (drop.heguangBoosted) {
        radius = Math.max(radius, 360);
        speed = Math.max(speed, 780);
      }
      return { radius, speed: speed * speedMult };
    }

    function getExecuteDamageMult(target) {
      let mult = 1;
      state.statuses.forEach((status) => {
        const effects = status.effects;
        if (!effects.execute) return;
        const hpRatio = target.hp / Math.max(1, target.maxHp);
        if (target.type === "boss") {
          if (hpRatio <= effects.execute.bossThreshold) mult = Math.max(mult, effects.execute.bossMult);
          return;
        }
        if (target.isMiniBoss || target.type === "elite") {
          if (hpRatio <= effects.execute.eliteThreshold) mult = Math.max(mult, effects.execute.eliteMult);
          return;
        }
        if (hpRatio <= effects.execute.normalThreshold) mult = Math.max(mult, effects.execute.normalMult);
      });
      return mult;
    }

    function getBlackBurstProfile() {
      let radius = 0;
      let base = 0;
      let enemyMaxHpPct = 0;
      let radiusMult = 1;
      state.statuses.forEach((status) => {
        const effects = status.effects;
        if (effects.blackBurstRadius) {
          radius = Math.max(radius, effects.blackBurstRadius);
          base = Math.max(base, effects.blackBurstBase || 0);
          enemyMaxHpPct = Math.max(enemyMaxHpPct, effects.blackBurstEnemyMaxHpPct || 0);
        }
        if (effects.blackBurstRadiusMult) radiusMult = Math.max(radiusMult, effects.blackBurstRadiusMult);
      });
      return { radius: radius * radiusMult, base, enemyMaxHpPct };
    }

    function hasGuardFocus() {
      return hasStatus("灵护") && state.player.barrier > 0;
    }

    function grantBarrier(amount) {
      state.player.barrier = Math.max(0, state.player.barrier + amount);
    }

    function healPlayer(amount, source = "generic") {
      if (amount <= 0) return;
      if (hasEquippedDestiny("tiansha")) {
        amount *= 0.72;
      }
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
      if (source === "white-destiny" && isGuiyuanActive()) {
        addStatus("归元", 3.2, {
          damageMult: 1.12,
        });
      }
    }

    function markTargetHitFx(target, effectKind, routeStyle = null, palette = null, duration = 0.24, intensity = 1) {
      if (!target) return;
      const nextDuration = Math.max(0.12, duration || 0);
      const nextIntensity = Math.max(0.45, intensity || 0.45);
      target.hitFx = {
        effectKind,
        routeStyle: routeStyle || null,
        palette: palette || null,
        duration: nextDuration,
        intensity: nextIntensity,
        until: state.time + nextDuration,
      };
    }

    function getPlayerAttackPower() {
      const learned = state.player.skillOrder.map((id) => state.player.skills[id]).filter(Boolean);
      if (!learned.length) return skills.sword.baseDamage;
      const total = learned.reduce((sum, skill) => {
        if (skill.damage) return sum + skill.damage;
        if (skill.maxShield) return sum + skill.maxShield * 0.35;
        return sum + 24;
      }, 0);
      return total / learned.length;
    }

    function getDamageMult() {
      let mult = state.bonusDamageMult || 1;
      state.statuses.forEach((status) => {
        if (status.effects.damageMult) mult *= status.effects.damageMult;
      });
      return mult;
    }

    function getCastMult() {
      let mult = 1;
      state.statuses.forEach((status) => {
        if (status.effects.castMult) mult *= status.effects.castMult;
      });
      return mult;
    }

    function getIncomingMult() {
      let mult = state.incomingMult || 1;
      state.statuses.forEach((status) => {
        if (status.effects.incomingMult) mult *= status.effects.incomingMult;
      });
      return mult;
    }

    function computeDamage(base) {
      let damage = base * getDamageMult();
      if (Math.random() < getCritChance()) damage *= state.player.critDamage;
      return damage;
    }

    function getThunderDamage(skill) {
      if (!skill) return 0;
      const rankBonus = Math.max(0, skill.rank - 1) * 0.2;
      const deepenBonus = (skill.deepenStacks || 0) * 0.4;
      return skill.baseDamage * (1 + rankBonus + deepenBonus);
    }

    return {
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
    };
  }

  global.GameplayHelpers = {
    createGameplayHelpers,
  };
})(window);
