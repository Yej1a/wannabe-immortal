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
    destinyCatalog,
    renderGameToText,
  }) {
    global.render_game_to_text = renderGameToText;
    global.__debug_setup_mini_boss_reward_flow = (color = "white") => {
      metaState.destiny.owned = {
        vital: { level: 2, alignment: destinyCatalog.vital.alignment },
        blade: { level: 1, alignment: destinyCatalog.blade.alignment },
        river: { level: 1, alignment: destinyCatalog.river.alignment },
      };
      metaState.destiny.equipped = ["vital", "blade"];
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
