(function initGameReincarnationFlow(global) {
  function createReincarnationFlow(deps) {
    const {
      state,
      metaState,
      META,
      TOTAL_RUNS,
      RESULT_DEATH,
      RESULT_CLEAR,
      formatResultLabel,
      formatTime,
      getAlignmentCounts,
      getAlignmentResult,
      saveMetaState,
      renderModal,
      resetGame,
      saveAndRefreshShop,
      openRunShopModal,
      openDestinyOffer,
      maybeHandlePostBossInfusion,
      calculateRunPoints,
      calculateRunDaoMarks,
    } = deps;

    const DANDING_FREE_REFRESH_THRESHOLD = 2;

    function buyUpgrade(id) {
      const upgrade = META.upgrades[id];
      const level = metaState.upgrades[id] || 0;
      if (!upgrade || level >= upgrade.maxLevel || metaState.points < upgrade.cost) return;
      metaState.points -= upgrade.cost;
      metaState.upgrades[id] = level + 1;
      saveMetaState();
      saveAndRefreshShop(`基础属性 ${upgrade.name} 提升完成`);
    }

    function openReincarnationModal(result, gainedPoints) {
      state.currentModal = "reincarnation";
      const resultLabel = formatResultLabel(result);
      const title = result === RESULT_DEATH ? "轮回结算" : `结局：${resultLabel}`;
      const lines = Object.entries(META.upgrades).map(([id, upgrade]) => {
        const level = metaState.upgrades[id] || 0;
        const locked = level >= upgrade.maxLevel;
        const effectText = id === "hp1"
          ? `开局生命 +${upgrade.effectPerLevel}`
          : id === "xp1"
            ? `经验获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
            : id === "pickup1"
              ? `拾取范围 +${Math.round(upgrade.effectPerLevel * 100)}%`
              : id === "white1"
                ? `白点获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
                : id === "black1"
                  ? `黑点获取 +${Math.round(upgrade.effectPerLevel * 100)}%`
                  : "开局自选一个额外术法";
        return {
          title: `${upgrade.name}  Lv.${level}/${upgrade.maxLevel}${locked ? " | 已满" : ""}`,
          body: `${effectText} | 花费 ${upgrade.cost} 轮回点${metaState.points < upgrade.cost && !locked ? " | 轮回点不足" : ""}`,
          onClick: () => buyUpgrade(id),
          disabled: locked || metaState.points < upgrade.cost,
        };
      });

      const survived = formatTime(Math.max(0, state.time));
      const summaryHtml = `
        <div class="reincarnation-summary">
          <div class="summary-card">
            <div class="summary-label">本局结局</div>
            <div class="summary-value">${resultLabel}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">本局轮回点</div>
            <div class="summary-value">+${gainedPoints}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">当前轮回点</div>
            <div class="summary-value">${metaState.points}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">击杀数</div>
            <div class="summary-value">${state.totalKills}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">存活时间</div>
            <div class="summary-value">${survived}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">总轮回次数</div>
            <div class="summary-value">${metaState.runs}</div>
          </div>
        </div>
        <div class="reincarnation-section-title">继承项</div>
      `;

      renderModal({
        title,
        body: "你已带着这一世的残痕返回轮回殿。购买继承项，或者立刻再入轮回。",
        bodyHtml: summaryHtml,
        choices: lines,
        className: "reincarnation-modal",
        actions: [
          {
            label: "再入轮回",
            onClick: () => resetGame(),
          },
        ],
      });
    }

    function openEndingModal(result) {
      state.currentModal = "ending";
      const endingTheme = result.includes("成仙")
        ? "ending-modal ending-immortal"
        : result.includes("化魔")
          ? "ending-modal ending-demon"
          : "ending-modal ending-human";
      const title = result.includes("成仙")
        ? "你已成仙"
        : result.includes("化魔")
          ? "你已化魔"
          : "你成了人";
      const subtitle = result.includes("成仙")
        ? "白道命格占优，此世修行终证仙途。"
        : result.includes("化魔")
          ? "黑道命格占优，此世杀伐终入魔途。"
          : "最强混元命格改写了结局，你从仙魔之间走回人间。";
      const counts = getAlignmentCounts();
      renderModal({
        title,
        body: subtitle,
        bodyHtml: `
          <div class="ending-hero">
            <div class="ending-result">${result}</div>
            <div class="ending-copy">白道命格 ${counts.white} · 黑道命格 ${counts.black} · 混元命格 ${counts.mixed}</div>
            <div class="ending-copy">此世已终，轮回余烬归于命盘，下一世仍可继续修行。</div>
          </div>
        `,
        choices: [],
        actions: [
          {
            label: "重开试炼",
            onClick: () => resetGame(),
          },
        ],
        className: endingTheme,
      });
    }

    function finishGame(result) {
      if (result !== RESULT_DEATH) {
        const settleClear = () => {
          const finalResult = state.campaign.runIndex >= TOTAL_RUNS ? getAlignmentResult() : `第${state.campaign.runIndex}轮已破`;
          state.result = finalResult;
          if (state.campaign.runIndex >= TOTAL_RUNS) {
            state.lastRunPoints = calculateRunPoints(finalResult);
            metaState.points += state.lastRunPoints;
            metaState.runs += 1;
            metaState.bestKills = Math.max(metaState.bestKills, state.totalKills);
            metaState.lastResult = finalResult;
            saveMetaState();
            state.daoMarks = 0;
            state.lastRunDaoMarks = 0;
            state.pendingFreeShopRefreshes = 0;
            state.shopFreeRefreshes = 0;
            state.shopDestinyOffers = [];
            state.mode = "result";
            state.running = false;
            state.paused = true;
            openEndingModal(finalResult);
          } else {
            state.lastRunDaoMarks = calculateRunDaoMarks(finalResult);
            state.daoMarks += state.lastRunDaoMarks;
            if (state.dandingTriggerCount >= DANDING_FREE_REFRESH_THRESHOLD) {
              state.pendingFreeShopRefreshes += 1;
            }
            openRunShopModal(false, `第${state.campaign.runIndex}轮已破，道途又进了一步。本轮道痕 +${state.lastRunDaoMarks}。`);
          }
        };
        if (state.campaign.stageType === "boss") {
          const bossClearContinuation = () => {
            openDestinyOffer({
              title: "大劫既破",
              body: `第${state.campaign.runIndex}个大 Boss 已败，从三枚命格中择一收入命盘。`,
              onComplete: settleClear,
            });
          };
          maybeHandlePostBossInfusion(bossClearContinuation);
          return;
        }
        settleClear();
        return;
      }
      state.mode = "result";
      state.running = false;
      state.result = result;
      state.paused = true;
      state.pendingShopResult = false;
      state.pendingShopMessage = "";
      state.daoMarks = 0;
      state.lastRunDaoMarks = 0;
      state.pendingFreeShopRefreshes = 0;
      state.shopFreeRefreshes = 0;
      state.shopDestinyOffers = [];
      state.lastRunPoints = calculateRunPoints(result);
      metaState.points += state.lastRunPoints;
      metaState.runs += 1;
      metaState.bestKills = Math.max(metaState.bestKills, state.totalKills);
      metaState.lastResult = result;
      saveMetaState();
      openReincarnationModal(result, state.lastRunPoints);
    }

    return {
      openReincarnationModal,
      finishGame,
    };
  }

  global.GameReincarnationFlow = {
    createReincarnationFlow,
  };
})(window);
