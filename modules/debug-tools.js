(function initGameDebug(global) {
  function installDebugHooks({
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
    onDestinyLoadoutChanged = () => {},
    onSkillRouteChanged = () => {},
    applyDebugRouteCapstone = () => false,
    spawnBoss = () => {},
    fillPath = () => {},
    tryUseActiveSlot = () => false,
  }) {
    global.render_game_to_text = renderGameToText;
    global.__debug_set_destinies = (ids = []) => {
      const equipped = ids.filter((id) => !!destinyCatalog[id]);
      metaState.destiny.owned = Object.fromEntries(
        equipped.map((id) => [id, { alignment: destinyCatalog[id].alignment }]),
      );
      metaState.destiny.equipped = [...equipped];
      metaState.destiny.unlocked = Object.keys(destinyCatalog);
      saveMetaState();
      onDestinyLoadoutChanged("debug_set_destinies");
      render();
      return renderGameToText();
    };
    global.__debug_fill_path = (color, amount, context = {}) => {
      fillPath(color, amount, { source: "debug_fill_path", ...context });
      render();
      return renderGameToText();
    };
    global.__debug_set_spawn_suppressed = (value = true) => {
      state.debugSpawnSuppressed = !!value;
      render();
      return renderGameToText();
    };
    global.__debug_set_player_state = ({ hp = null, barrier = null, guardShield = null } = {}) => {
      if (Number.isFinite(hp)) {
        state.player.hp = Math.max(1, Math.min(state.player.maxHp, hp));
      }
      if (Number.isFinite(barrier)) {
        state.player.barrier = Math.max(0, barrier);
      }
      if (Number.isFinite(guardShield) && state.player.skills.guard) {
        state.player.skills.guard.shield = Math.max(0, Math.min(state.player.skills.guard.maxShield || guardShield, guardShield));
      }
      render();
      return renderGameToText();
    };
    global.__debug_cast_active = (slotIndex = 0) => {
      const fired = tryUseActiveSlot(slotIndex);
      render();
      return {
        fired,
        snapshot: JSON.parse(renderGameToText()),
      };
    };
    global.__debug_snapshot_runtime = () => ({
      render: JSON.parse(renderGameToText()),
      player: {
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        barrier: state.player.barrier,
        x: state.player.x,
        y: state.player.y,
      },
      skills: Object.fromEntries(
        Object.entries(state.player.skills).map(([id, skill]) => [id, {
          rank: skill.rank,
          route: skill.route,
          capstone: skill.capstone || null,
          cooldown: skill.cooldown || 0,
          timer: skill.timer || 0,
          projectiles: skill.projectiles,
          damage: skill.damage,
          pierce: skill.pierce,
          chain: skill.chain,
          chainFocus: skill.chainFocus,
          chainRangeBonus: skill.chainRangeBonus,
          chainNewTargetBias: skill.chainNewTargetBias,
          stormFocus: skill.stormFocus,
          stormDurationBonus: skill.stormDurationBonus,
          stormStrikeBonus: skill.stormStrikeBonus,
          radius: skill.radius,
          burst: !!skill.burst,
          meteorFocus: skill.meteorFocus,
          meteorBurstBonus: skill.meteorBurstBonus,
          zoneFocus: skill.zoneFocus,
          zoneRadiusBonus: skill.zoneRadiusBonus,
          zoneDurationBonus: skill.zoneDurationBonus,
          zoneSlowBonus: skill.zoneSlowBonus,
          maxShield: skill.maxShield,
          shield: skill.shield,
          recharge: skill.recharge,
          bulwarkFocus: skill.bulwarkFocus,
          counterFocus: skill.counterFocus,
          counterWindowBonus: skill.counterWindowBonus,
          counterShockBonus: skill.counterShockBonus,
          swarmVolleyBonus: skill.swarmVolleyBonus,
          greatswordWidthBonus: skill.greatswordWidthBonus,
          greatswordDurationBonus: skill.greatswordDurationBonus,
          greatswordPressureBonus: skill.greatswordPressureBonus,
        }]),
      ),
      projectiles: state.projectiles.map((projectile) => ({
        kind: projectile.kind,
        routeStyle: projectile.routeStyle || null,
        radius: projectile.radius,
        speed: projectile.speed || Math.hypot(projectile.vx || 0, projectile.vy || 0),
        turnRate: projectile.turnRate || 0,
        damage: projectile.damage,
      })),
      activeEffects: state.activeEffects.map((effect) => ({
        kind: effect.kind,
        routeStyle: effect.routeStyle || null,
        width: effect.width || 0,
        radius: effect.radius || 0,
          duration: effect.duration || effect.time || 0,
          damage: effect.damage || 0,
          finalDamage: effect.finalDamage || 0,
          maxJumps: effect.maxJumps || 0,
          chainRange: effect.chainRange || 0,
          newTargetBias: effect.newTargetBias || 0,
          strikeCount: effect.strikeCount || 0,
          slow: effect.slow || 0,
          reflectDamageMult: effect.reflectDamageMult || 0,
          pushMult: effect.pushMult || 0,
          pressureBonus: effect.pressureBonus || 0,
        })),
      pulses: state.pulses.map((pulse) => ({
        kind: pulse.kind,
        routeStyle: pulse.routeStyle || null,
        radius: pulse.radius || 0,
        duration: pulse.duration || pulse.time || 0,
        damage: pulse.damage || 0,
        strikeCount: pulse.strikeCount || 0,
        bossOpenerMult: pulse.bossOpenerMult || 0,
        burnDuration: pulse.burnDuration || 0,
        startDelay: pulse.startDelay || 0,
      })),
      destinyRuntimeLog: structuredClone(state.destinyRuntime?.log || []),
      enemies: state.enemies.map((enemy) => ({
        type: enemy.type,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        x: enemy.x,
        y: enemy.y,
        isMiniBoss: !!enemy.isMiniBoss,
      })),
      statuses: state.statuses.map((status) => ({
        name: status.name,
        remaining: status.remaining,
      })),
      pendingShopBonuses: {
        freeRefreshes: state.pendingFreeShopRefreshes,
        forcedWhiteOffers: state.pendingForcedWhiteOffers,
        whiteDiscount: state.pendingWhiteDestinyDiscount,
        dandingTriggerCount: state.dandingTriggerCount,
        activeSacrificeBoost: state.pendingActiveSacrificeBoost,
      },
    });
    global.__debug_setup_mini_boss_reward_flow = (color = "white") => {
      metaState.destiny.owned = {
        qingxin: { alignment: destinyCatalog.qingxin.alignment },
        xuezhan: { alignment: destinyCatalog.xuezhan.alignment },
      };
      metaState.destiny.equipped = ["qingxin", "xuezhan"];
      metaState.destiny.unlocked = Object.keys(destinyCatalog);
      saveMetaState();
      onDestinyLoadoutChanged("debug_reward_flow");
      resetGame();
      closeModal();
      state.paused = false;
      state.currentModal = null;
      state.pendingLevelUps = 0;
      state.campaign.stageIndex = 1;
      state.campaign.stageType = "small";
      state.campaign.miniBossSpawned = true;
      state.campaign.miniBossDefeated = true;
      state.pendingMiniBossReward = true;
      state.enemies = [];
      state.enemyProjectiles = [];
      state.drops = [
        { x: state.player.x + 80, y: state.player.y, kind: "xp", value: 4, color: COLORS.xp, radius: 6, autoCollect: false },
        { x: state.player.x - 70, y: state.player.y + 20, kind: "path", value: 8, color, radius: 7, autoCollect: false },
      ];
      state.whitePath.value = color === "white" ? state.whitePath.cap : 0;
      state.whitePath.full = color === "white";
      state.blackPath.value = color === "black" ? state.blackPath.cap : 0;
      state.blackPath.full = color === "black";
      state.whiteInfusionPoints = color === "white" ? 1 : 0;
      state.blackInfusionPoints = color === "black" ? 1 : 0;
      render();
      return renderGameToText();
    };
    global.__debug_setup_route_active = (skillId, routeId, options = {}) => {
      const normalized = typeof options === "boolean" ? { graduated: options } : options;
      const graduated = !!normalized.graduated;
      resetGame();
      closeModal();
      state.paused = false;
      state.currentModal = null;
      state.pendingLevelUps = 0;
      state.player.level = 7;
      state.player.xp = 0;
      const wanted = [skillId];
      wanted.forEach((id) => {
        if (!state.player.skills[id] && typeof global.unlockSkill === "function") {
          global.unlockSkill(state, id);
        }
      });
      const skill = state.player.skills[skillId];
      if (skill) {
        skill.rank = Math.max(skill.rank, 7);
        skill.activeTimer = 0;
        skill.baseUpgrades = Math.max(skill.baseUpgrades || 0, BRANCH_UNLOCK_BASE_UPGRADES);
        state.player.skillOrder = [
          skillId,
          ...state.player.skillOrder.filter((id) => id !== skillId),
        ];
        if (skill.routePoints) {
          Object.keys(skill.routePoints).forEach((key) => { skill.routePoints[key] = 0; });
          if (routeId in skill.routePoints) skill.routePoints[routeId] = 2;
        }
        skill.route = routeId;
        skill.capstone = null;
        onSkillRouteChanged(skillId, routeId);
        if (graduated) {
          const applied = applyDebugRouteCapstone(skillId, routeId);
          if (!applied) skill.capstone = routeId;
        }
      }
      state.enemies = [
        { type: "grunt", x: state.player.x + 72, y: state.player.y - 10, hp: 46, maxHp: 46, damage: 11, speed: 0, radius: 13, color: "white", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "grunt", x: state.player.x + 116, y: state.player.y + 22, hp: 46, maxHp: 46, damage: 11, speed: 0, radius: 13, color: "black", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "ranged", x: state.player.x + 168, y: state.player.y - 54, hp: 44, maxHp: 44, damage: 13, speed: 0, radius: 12, color: "white", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "elite", x: state.player.x + 188, y: state.player.y + 8, hp: 1000, maxHp: 1000, damage: 24, speed: 0, radius: 32, color: "black", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0, isMiniBoss: true },
      ];
      state.enemyProjectiles = skillId === "guard" && routeId === "counter"
        ? [
          { x: state.player.x + 160, y: state.player.y - 20, vx: -180, vy: 12, radius: 7, damage: 14, life: 3 },
          { x: state.player.x + 190, y: state.player.y + 26, vx: -200, vy: -10, radius: 7, damage: 14, life: 3 },
        ]
        : [];
      state.activeEffects = [];
      state.pulses = [];
      render();
      return renderGameToText();
    };
    global.__debug_setup_route_graduated = (skillId, routeId) => global.__debug_setup_route_active(skillId, routeId, { graduated: true });
    global.__debug_spawn_boss_round = (runIndex = 1) => {
      const targetRun = Math.max(1, Math.min(3, Math.floor(runIndex) || 1));
      resetGame();
      closeModal();
      state.paused = false;
      state.currentModal = null;
      state.pendingLevelUps = 0;
      state.debugSpawnSuppressed = true;
      state.enemies = [];
      state.projectiles = [];
      state.enemyProjectiles = [];
      state.activeEffects = [];
      state.pulses = [];
      state.drops = [];
      state.campaign.runIndex = targetRun;
      state.campaign.stageIndex = 4;
      state.campaign.stageType = "boss";
      state.campaign.stageKills = 0;
      state.campaign.targetKills = 0;
      state.campaign.miniBossSpawned = false;
      state.campaign.miniBossDefeated = false;
      state.campaign.bossSpawned = false;
      state.phaseLabel = `第${targetRun}轮 大Boss`;
      spawnBoss();
      render();
      return renderGameToText();
    };
    global.__debug_set_boss_hp = (value, mode = "ratio") => {
      if (!state.boss) return renderGameToText();
      if (mode === "ratio") {
        const ratio = Math.max(0, Math.min(1, Number(value)));
        state.boss.hp = state.boss.maxHp * ratio;
      } else {
        const hp = Math.max(0, Math.min(state.boss.maxHp, Number(value)));
        state.boss.hp = hp;
      }
      render();
      return renderGameToText();
    };
    global.__debug_force_boss_phase = (phase = 1) => {
      if (!state.boss) return renderGameToText();
      const maxPhase = Math.max(1, state.boss.phaseNames?.length || state.boss.phaseThresholds?.length + 1 || 1);
      state.boss.phase = Math.max(1, Math.min(maxPhase, Math.floor(phase) || 1));
      state.boss.sequenceCursor = 0;
      state.boss.attackTimer = 0.1;
      state.boss.exposedTimer = 0;
      state.boss.intent = null;
      state.boss.intentLabel = "";
      state.boss.intentCategory = null;
      state.boss.intentCounterable = false;
      state.activeEffects = state.activeEffects.filter((effect) => !effect.fromBoss);
      state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => !projectile.fromBoss);
      state.pulses = state.pulses.filter((pulse) => !pulse.fromBoss);
      render();
      return renderGameToText();
    };
    global.__debug_prepare_branch_choice = (skillId) => {
      resetGame();
      closeModal();
      state.paused = false;
      state.currentModal = null;
      state.pendingLevelUps = 0;
      state.player.level = 6;
      state.player.xp = 0;
      if (!state.player.skills[skillId] && typeof global.unlockSkill === "function") {
        global.unlockSkill(state, skillId);
      }
      const skill = state.player.skills[skillId];
      if (skill) {
        skill.rank = ACTIVE_UNLOCK_RANK - 1;
        skill.activeTimer = 0;
        skill.baseUpgrades = BRANCH_UNLOCK_BASE_UPGRADES;
        state.branchWindowCounter = 1;
        skill.branchReadyOrder = 1;
        onSkillRouteChanged(skillId, null);
      }
      render();
      return renderGameToText();
    };
    global.advanceTime = (ms) => {
      const step = 1000 / 60;
      const count = Math.max(1, Math.round(ms / step));
      for (let i = 0; i < count; i += 1) update(step / 1000);
      render();
    };
  }

  global.GameDebug = {
    installDebugHooks,
  };
})(window);
