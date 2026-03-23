(function initGameShopFlow(global) {
  function createShopFlow(deps) {
    const {
      state,
      metaState,
      TOTAL_RUNS,
      RESULT_DEATH,
      destinyCatalog,
      getOwnedDestinyEntries,
      getRandomDestinyOffers,
      saveMetaState,
      setToast,
      closeModal,
      renderModal,
      resetGame,
      startCurrentStage,
      openEquipDestinyModal,
      openReincarnationModal,
    } = deps;

    const SHOP_REFRESH_COST = 4;
    const SHOP_HEALING_POTION_COST = 3;
    const SHOP_HEALING_POTION_RATIO = 0.35;

    function saveAndRefreshShop(message = "") {
      saveMetaState();
      if (state.currentModal === "reincarnation" || state.result === RESULT_DEATH) {
        openReincarnationModal(state.result || RESULT_DEATH, state.lastRunPoints);
        return;
      }
      openRunShopModal(!!state.pendingShopResult, message || state.pendingShopMessage || "");
    }

    function buyDestinyOffer(id) {
      const def = destinyCatalog[id];
      if (!def || state.daoMarks < def.baseCost || metaState.destiny.owned[id]) return;
      if (metaState.destiny.equipped.length < metaState.destiny.maxSlots) {
        state.daoMarks -= def.baseCost;
        metaState.destiny.owned[id] = {
          alignment: def.alignment,
        };
        metaState.destiny.equipped.push(id);
        saveAndRefreshShop(`购入 ${def.name}`);
        return;
      }
      openEquipDestinyModal(id, {
        title: "购入前确认",
        body: `购入 ${def.name} 需要 ${def.baseCost} 道痕。由于命格槽已满，本次购买会直接替换一枚当前命格；确认替换目标后才会真正扣点。`,
        onConfirm: () => {
          if (state.daoMarks < def.baseCost) {
            setToast("道痕不足");
            return false;
          }
          state.daoMarks -= def.baseCost;
          return true;
        },
        onComplete: () => saveAndRefreshShop(`购入 ${def.name}`),
        onAbandon: () => saveAndRefreshShop(`取消购入 ${def.name}`),
      });
    }

    function buildHealingPotionChoice() {
      const missingHp = Math.max(0, state.player.maxHp - state.player.hp);
      const healAmount = Math.max(1, Math.ceil(state.player.maxHp * SHOP_HEALING_POTION_RATIO));
      const restored = Math.min(missingHp, healAmount);
      return {
        title: state.shopHealingPotionSoldOut ? "回血药水已售罄" : "购入 回血药水",
        body: state.shopHealingPotionSoldOut
          ? "这一轮商店里的回血药水已经卖完。"
          : restored <= 0
            ? `花费 ${SHOP_HEALING_POTION_COST} 道痕，当场回复 35% 最大生命。当前气血已满。`
            : `花费 ${SHOP_HEALING_POTION_COST} 道痕，当场回复 ${restored} 点生命。`,
        disabled: state.shopHealingPotionSoldOut || restored <= 0 || state.daoMarks < SHOP_HEALING_POTION_COST,
        onClick: () => {
          if (state.shopHealingPotionSoldOut) return;
          if (restored <= 0) {
            setToast("气血已满，无需服药");
            return;
          }
          if (state.daoMarks < SHOP_HEALING_POTION_COST) {
            setToast("道痕不足");
            return;
          }
          state.daoMarks -= SHOP_HEALING_POTION_COST;
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
          state.shopHealingPotionSoldOut = true;
          saveAndRefreshShop(`服下回血药水，恢复 ${restored} 点生命`);
        },
      };
    }

    function buildShopChoices() {
      const choices = [buildHealingPotionChoice()];
      state.shopDestinyOffers
        .filter((id) => !!destinyCatalog[id] && !metaState.destiny.owned[id])
        .forEach((id) => {
          const def = destinyCatalog[id];
          choices.push({
            title: `购入 ${def.name}`,
            body: `花费 ${def.baseCost} 道痕`,
            disabled: state.daoMarks < def.baseCost,
            onClick: () => buyDestinyOffer(id),
          });
        });
      return choices.slice(0, 7);
    }

    function rerollShopDestinyOffers() {
      state.shopDestinyOffers = getRandomDestinyOffers(3).map((offer) => offer.id);
    }

    function refreshRunShop() {
      if (state.shopFreeRefreshes > 0) {
        state.shopFreeRefreshes -= 1;
      } else if (state.daoMarks >= SHOP_REFRESH_COST) {
        state.daoMarks -= SHOP_REFRESH_COST;
      } else {
        setToast("道痕不足，无法刷新命格商店");
        return;
      }
      rerollShopDestinyOffers();
      openRunShopModal(
        !!state.pendingShopResult,
        `命格商店已刷新${state.shopFreeRefreshes > 0 ? `，剩余免费刷新 ${state.shopFreeRefreshes} 次` : ""}`,
      );
    }

    function openRunShopModal(finalStep, message) {
      state.mode = finalStep ? "result" : "shop";
      state.running = false;
      state.paused = true;
      state.currentModal = "run-shop";
      state.pendingShopResult = finalStep;
      state.pendingShopMessage = message;
      if (state.pendingFreeShopRefreshes > 0) {
        state.shopFreeRefreshes += state.pendingFreeShopRefreshes;
        state.pendingFreeShopRefreshes = 0;
      }
      if (!state.shopDestinyOffers.length) rerollShopDestinyOffers();
      const choices = buildShopChoices();
      renderModal({
        title: finalStep ? state.result : `第${state.campaign.runIndex}轮结算`,
        body: `${message || "整备命盘，准备进入下一轮试炼。"} 当前持有 ${state.daoMarks} 道痕。`,
        bodyHtml: `
          <div class="reincarnation-summary">
            <div class="summary-card"><div class="summary-label">当前道痕</div><div class="summary-value">${state.daoMarks}</div></div>
            <div class="summary-card"><div class="summary-label">本轮道痕</div><div class="summary-value">+${state.lastRunDaoMarks}</div></div>
            <div class="summary-card"><div class="summary-label">当前气血</div><div class="summary-value">${Math.ceil(state.player.hp)}/${Math.ceil(state.player.maxHp)}</div></div>
            <div class="summary-card"><div class="summary-label">命格槽位</div><div class="summary-value">${metaState.destiny.equipped.length}/${metaState.destiny.maxSlots}</div></div>
            <div class="summary-card"><div class="summary-label">当前命格</div><div class="summary-value">${getOwnedDestinyEntries().length}</div></div>
            <div class="summary-card"><div class="summary-label">当前轮次</div><div class="summary-value">${state.campaign.runIndex}/${TOTAL_RUNS}</div></div>
            <div class="summary-card"><div class="summary-label">丹鼎收益</div><div class="summary-value">+${state.dandingTriggerCount * 2}</div></div>
            <div class="summary-card"><div class="summary-label">免费刷新</div><div class="summary-value">${state.shopFreeRefreshes}</div></div>
          </div>
        `,
        choices,
        className: "reincarnation-modal",
        actions: [
          {
            label: state.shopFreeRefreshes > 0
              ? `刷新命格（免费 ${state.shopFreeRefreshes} 次）`
              : `刷新命格（${SHOP_REFRESH_COST} 道痕）`,
            onClick: () => refreshRunShop(),
          },
          {
            label: finalStep ? "再入轮回" : "进入下一轮",
            onClick: () => {
              closeModal();
              state.paused = false;
              if (finalStep) {
                resetGame();
              } else {
                state.mode = "playing";
                state.running = true;
                state.campaign.runIndex += 1;
                state.campaign.stageIndex = 1;
                state.runStartTime = state.time;
                state.lastRunDaoMarks = 0;
                state.dandingTriggerCount = 0;
                state.pendingFreeShopRefreshes = 0;
                state.shopFreeRefreshes = 0;
                state.shopDestinyOffers = [];
                state.shopHealingPotionSoldOut = false;
                startCurrentStage();
              }
            },
          },
        ],
      });
    }

    return {
      saveAndRefreshShop,
      openRunShopModal,
    };
  }

  global.GameShopFlow = {
    createShopFlow,
  };
})(window);
