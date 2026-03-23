(function initGameRunFlow(global) {
  function createRunFlow(deps) {
    const {
      state,
      metaState,
      dom,
      WIDTH,
      HEIGHT,
      STAGES_PER_RUN,
      skills,
      createState,
      closeModal,
      showOverlay,
      setToast,
      renderModal,
      unlockSkill,
      getEquippedDestinyEntries,
      getAlignmentLabel,
      getEntryAlignment,
      getThunderDamage,
      hasInfusionPoints,
      spawnBoss,
      maybeOpenPendingLevelUp,
      openDaoPointifyModal,
      openDestinyOffer,
      openRunShopModal,
    } = deps;
    const STARTER_SKILL_POOL = ["sword", "thunder", "flame"];

    function resetGame() {
      dom.startBtn.blur();
      state.manualPause = false;
      const fresh = createState();
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, fresh);
      state.pendingShopResult = false;
      state.pendingShopMessage = "";
      showOverlay(false);
      dom.startBtn.textContent = "重新开始";
      state.mode = "playing";
      state.running = true;
      state.phaseLabel = "混元试炼";
      closeModal();
      setToast("试炼开始");
      maybeOpenInitialSkillChoice(() => {
        startCurrentStage();
        maybeOpenStarterChoice(() => {
          openDestinyOffer({
            title: "命格初定",
            body: "轮回初启，从三枚命格中择一带入本局。",
          });
        });
      });
    }

    function getStageTargetKills() {
      if (state.campaign.stageIndex === 1) return 40;
      if (state.campaign.stageIndex === 2) return 50;
      if (state.campaign.stageIndex === 3) return 60;
      return 60;
    }

    function getEnemyProgressMult() {
      return 1 + (state.campaign.runIndex - 1) * 0.5 + (state.campaign.stageIndex - 1) * 0.4;
    }

    function clearCombatEntities() {
      state.enemies = [];
      state.projectiles = [];
      state.enemyProjectiles = [];
      state.drops = [];
      state.pulses = [];
      state.boss = null;
      state.bossFight = false;
      state.spawnTimer = 0.25;
    }

    function startCurrentStage() {
      clearCombatEntities();
      state.campaign.stageType = state.campaign.stageIndex === STAGES_PER_RUN ? "boss" : "small";
      state.campaign.stageStartedAt = state.time;
      state.campaign.stageKills = 0;
      state.campaign.targetKills = getStageTargetKills();
      state.campaign.miniBossSpawned = false;
      state.campaign.miniBossDefeated = false;
      state.campaign.bossSpawned = false;
      state.player.x = WIDTH / 2;
      state.player.y = HEIGHT / 2;
      state.phaseLabel = `第${state.campaign.runIndex}轮 第${state.campaign.stageIndex}关`;
      if (state.campaign.stageType === "boss") spawnBoss();
    }

    function getNextStageLabel() {
      const nextStageIndex = state.campaign.stageIndex + 1;
      if (nextStageIndex === STAGES_PER_RUN) return `第${state.campaign.runIndex}轮 大Boss`;
      return `第${state.campaign.runIndex}轮 第${nextStageIndex}关`;
    }

    function buildStagePreparationHtml() {
      const equipped = getEquippedDestinyEntries();
      const skillsHtml = state.player.skillOrder.length
        ? state.player.skillOrder.map((id, index) => {
          const skill = state.player.skills[id];
          const detail = id === "thunder"
            ? `Rank ${skill.rank} | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`
            : id === "sword"
              ? `Rank ${skill.rank} | ${skill.projectiles} 剑`
              : id === "guard"
                ? `Rank ${skill.rank} | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`
                : `Rank ${skill.rank} | 半径 ${Math.floor(skill.radius)}`;
          return `<div class="choice-card"><strong>${index + 1}. ${skills[id].name}</strong><span>${detail}</span></div>`;
        }).join("")
        : '<div class="choice-card"><strong>暂无法术</strong><span>当前没有已习得法术。</span></div>';
      const equippedHtml = equipped.length
        ? equipped.map((entry) => `<div class="choice-card"><strong>${entry.def.name}</strong><span>${getAlignmentLabel(getEntryAlignment(entry))} | ${entry.def.tier}</span></div>`).join("")
        : '<div class="choice-card"><strong>未装备命格</strong><span>当前没有已装备命格。</span></div>';
      return `
        <div class="reincarnation-summary">
          <div class="summary-card"><div class="summary-label">下一场</div><div class="summary-value">${getNextStageLabel()}</div></div>
          <div class="summary-card"><div class="summary-label">命格槽</div><div class="summary-value">${equipped.length}/${metaState.destiny.maxSlots}</div></div>
          <div class="summary-card"><div class="summary-label">当前法术</div><div class="summary-value">${state.player.skillOrder.length}</div></div>
          <div class="summary-card"><div class="summary-label">白点化点</div><div class="summary-value">${state.whiteInfusionPoints}</div></div>
          <div class="summary-card"><div class="summary-label">黑点化点</div><div class="summary-value">${state.blackInfusionPoints}</div></div>
        </div>
        <div class="reincarnation-section-title">当前命格</div>
        <div class="choice-list">${equippedHtml}</div>
        <div class="reincarnation-section-title">当前法术</div>
        <div class="choice-list">${skillsHtml}</div>
      `;
    }

    function proceedToNextStage() {
      state.campaign.stageIndex += 1;
      closeModal();
      state.paused = false;
      startCurrentStage();
      maybeOpenPendingLevelUp();
    }

    function openNextBattleConfirmModal() {
      state.paused = true;
      state.currentModal = "stage-confirm";
      renderModal({
        title: "确认开战",
        body: `即将进入 ${getNextStageLabel()}。确认后将立刻开始战斗。`,
        choices: [{
          title: "确认进入下一战",
          body: "结束整备，立刻进入下一场战斗。",
          onClick: () => proceedToNextStage(),
        }],
        actions: [{
          label: "返回整备",
          onClick: () => openStagePreparationModal(),
        }],
        className: "reincarnation-modal",
      });
    }

    function openStagePreparationModal() {
      const canPointify = hasInfusionPoints() && getEquippedDestinyEntries().length > 0;
      state.paused = true;
      state.currentModal = "stage-prep";
      renderModal({
        title: "战前整备",
        body: "击败小Boss后，先查看当前已镶嵌命格和法术；确认无误后再进入下一场战斗。",
        bodyHtml: buildStagePreparationHtml(),
        choices: [
          {
            title: "道途点化",
            body: canPointify
              ? `消耗白/黑点化点重抽当前已镶嵌命格。当前白点 ${state.whiteInfusionPoints} | 黑点 ${state.blackInfusionPoints}`
              : "当前没有可用点化点，或没有已镶嵌命格可供点化。",
            onClick: () => {
              if (!canPointify) return;
              openDaoPointifyModal(() => openStagePreparationModal());
            },
            disabled: !canPointify,
          },
          {
            title: "前往确认开战",
            body: `查看完毕，准备进入 ${getNextStageLabel()}。`,
            onClick: () => openNextBattleConfirmModal(),
          },
        ],
        actions: [],
        className: "reincarnation-modal",
      });
    }

    function advanceCampaign() {
      if (state.campaign.stageIndex < STAGES_PER_RUN) {
        openStagePreparationModal();
        return;
      }
      openRunShopModal(false, `第${state.campaign.runIndex}轮已破，道途又进了一步。`);
    }

    function maybeOpenInitialSkillChoice(onComplete = () => {}) {
      state.paused = true;
      state.currentModal = "starter-skill";
      renderModal({
        title: "起手术法",
        body: "从飞剑诀、掌心雷、火环术中自选 1 个开始本局。",
        choices: STARTER_SKILL_POOL.map((id) => ({
          title: `习得${skills[id].name}`,
          body: skills[id].description,
          onClick: () => {
            unlockSkill(state, id);
            closeModal();
            state.paused = false;
            setToast(`起手术法：${skills[id].name}`);
            onComplete();
          },
        })),
      });
    }

    function maybeOpenStarterChoice(onComplete = () => {}) {
      if (!(metaState.upgrades.starter > 0)) {
        onComplete();
        return;
      }
      const options = STARTER_SKILL_POOL.filter((id) => !state.player.skills[id])
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      if (!options.length) {
        onComplete();
        return;
      }
      state.paused = true;
      state.currentModal = "starter";
      renderModal({
        title: "前世所悟",
        body: "额外再选 1 个起手术法，候选只来自飞剑诀、掌心雷、火环术。",
        choices: options.map((id) => ({
          title: `习得${skills[id].name}`,
          body: skills[id].description,
          onClick: () => {
            unlockSkill(state, id);
            closeModal();
            state.paused = false;
            setToast(`前世所悟：${skills[id].name}`);
            onComplete();
          },
        })),
      });
    }

    return {
      resetGame,
      getEnemyProgressMult,
      startCurrentStage,
      advanceCampaign,
      openStagePreparationModal,
    };
  }

  global.GameRunFlow = {
    createRunFlow,
  };
})(window);
