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
    }) {
    global.render_game_to_text = renderGameToText;
    global.__debug_setup_mini_boss_reward_flow = (color = "white") => {
      metaState.destiny.owned = {
        qingxin: { alignment: destinyCatalog.qingxin.alignment },
        xuezhan: { alignment: destinyCatalog.xuezhan.alignment },
        taiji: { alignment: destinyCatalog.taiji.alignment },
      };
      metaState.destiny.equipped = ["qingxin", "xuezhan"];
      metaState.destiny.unlocked = Object.keys(destinyCatalog);
      saveMetaState();
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
    global.__debug_setup_route_active = (skillId, routeId) => {
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
        if (skill.routePoints) {
          Object.keys(skill.routePoints).forEach((key) => { skill.routePoints[key] = 0; });
          if (routeId in skill.routePoints) skill.routePoints[routeId] = 2;
        }
        skill.route = routeId;
      }
      state.enemies = [
        { type: "grunt", x: state.player.x + 120, y: state.player.y - 10, hp: 46, maxHp: 46, damage: 11, speed: 0, radius: 13, color: "white", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "grunt", x: state.player.x + 170, y: state.player.y + 28, hp: 46, maxHp: 46, damage: 11, speed: 0, radius: 13, color: "black", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "ranged", x: state.player.x + 210, y: state.player.y - 70, hp: 44, maxHp: 44, damage: 13, speed: 0, radius: 12, color: "white", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0 },
        { type: "elite", x: state.player.x + 240, y: state.player.y + 8, hp: 1000, maxHp: 1000, damage: 24, speed: 0, radius: 32, color: "black", shotTimer: 99, dashTimer: 99, attackTimer: 99, burn: 0, isMiniBoss: true },
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
