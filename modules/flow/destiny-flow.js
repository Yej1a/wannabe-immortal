(function initGameDestinyFlow(global) {
  function createDestinyFlow(deps) {
    const {
      state,
      metaState,
      destinyCatalog,
      getAlignmentLabel,
      getEntryAlignment,
      getDestinyText,
      createDestinyPreviewSnapshot,
      describeDestinyStatDelta,
      describePointifyPreview,
      getRandomDestinyOffers,
      getEquippedDestinyEntries,
      hasInfusionPoints,
      onDestinyLoadoutChanged = () => {},
      saveMetaState,
      setToast,
      closeModal,
      renderModal,
    } = deps;

    let pendingInfusionContinuation = null;

    function clearPendingInfusionContinuation() {
      pendingInfusionContinuation = null;
    }

    function replaceEquippedDestiny(oldId, newId) {
      const index = metaState.destiny.equipped.indexOf(oldId);
      if (index < 0) return false;
      delete metaState.destiny.owned[oldId];
      metaState.destiny.equipped[index] = newId;
      metaState.destiny.owned[newId] = {
        alignment: destinyCatalog[newId].alignment,
      };
      return true;
    }

    function openAcquireDestinyModal(newId, {
      title = "获得命格",
      body = `你获得了 ${destinyCatalog[newId].name}。选择是否将它装备到命格槽。`,
      onComplete = () => {},
      onAbandon = () => {},
    } = {}) {
      const currentSnapshot = createDestinyPreviewSnapshot(metaState.destiny.equipped);
      const nextSnapshot = createDestinyPreviewSnapshot([...metaState.destiny.equipped, newId]);
      state.paused = true;
      state.currentModal = "acquire-destiny";
      renderModal({
        title,
        body,
        choices: [{
          title: `装备 ${destinyCatalog[newId].name}`,
          body: `${getAlignmentLabel(destinyCatalog[newId].alignment)} | 装备到空位<br>${describeDestinyStatDelta(currentSnapshot, nextSnapshot)}`,
          onClick: () => {
            metaState.destiny.owned[newId] = {
              alignment: destinyCatalog[newId].alignment,
            };
            metaState.destiny.equipped.push(newId);
            onDestinyLoadoutChanged("acquire");
            saveMetaState();
            setToast(`获得命格 ${destinyCatalog[newId].name}`);
            closeModal();
            state.paused = false;
            onComplete();
          },
        }],
        actions: [{
          label: "放弃新命格",
          onClick: () => {
            closeModal();
            state.paused = false;
            onAbandon();
            onComplete();
          },
        }],
        className: "reincarnation-modal",
      });
    }

    function continueInfusionFlow() {
      const continuation = pendingInfusionContinuation;
      pendingInfusionContinuation = null;
      if (typeof continuation === "function") continuation();
    }

    function maybeHandlePostBossInfusion(continuation) {
      if (hasInfusionPoints()) {
        openDaoPointifyModal(continuation);
        return true;
      }
      continuation();
      return false;
    }

    function acquireDestiny(id, onComplete = () => {}) {
      if (metaState.destiny.owned[id]) {
        onComplete();
        return;
      }
      if (metaState.destiny.equipped.length < metaState.destiny.maxSlots) {
        openAcquireDestinyModal(id, {
          title: "获得命格",
          body: `你获得了 ${destinyCatalog[id].name}。当前命格槽未满，可以选择装备它，或直接放弃本次奖励。`,
          onComplete,
        });
        return;
      }
      openEquipDestinyModal(id, {
        title: "命格槽已满",
        body: `命格槽最多 ${metaState.destiny.maxSlots} 个。你获得了 ${destinyCatalog[id].name}，现在只能替换一枚现有命格，或放弃这枚新命格。`,
        onComplete,
        onAbandon: onComplete,
      });
    }

    function openEquipDestinyModal(newId, {
      title = "命格槽已满",
      body = "选择一枚当前命格进行替换。",
      onComplete = () => {},
      onConfirm = () => true,
      onAbandon = () => onComplete(),
    } = {}) {
      state.paused = true;
      state.currentModal = "equip-destiny";
      const currentSnapshot = createDestinyPreviewSnapshot(metaState.destiny.equipped);
      const choices = getEquippedDestinyEntries().map((entry) => ({
        title: `替换 ${entry.def.name}`,
        body: (() => {
          const nextEquipped = metaState.destiny.equipped.map((id) => (id === entry.id ? newId : id));
          const nextSnapshot = createDestinyPreviewSnapshot(nextEquipped);
          return `以 ${destinyCatalog[newId].name} 取代当前装备位<br>${describeDestinyStatDelta(currentSnapshot, nextSnapshot)}`;
        })(),
        onClick: () => {
          if (!onConfirm(entry.id)) return;
          replaceEquippedDestiny(entry.id, newId);
          onDestinyLoadoutChanged("replace");
          saveMetaState();
          setToast(`获得命格 ${destinyCatalog[newId].name}`);
          closeModal();
          state.paused = false;
          onComplete();
        },
      }));
      renderModal({
        title,
        body,
        choices,
        actions: [{
          label: "放弃新命格",
          onClick: () => {
            closeModal();
            state.paused = false;
            onAbandon();
          },
        }],
      });
    }

    function getPointifyBoardPreview(targetId, nextId) {
      const currentEquipped = [...metaState.destiny.equipped];
      const before = createDestinyPreviewSnapshot(currentEquipped);
      const afterIds = currentEquipped.map((id) => (id === targetId ? nextId : id));
      const after = createDestinyPreviewSnapshot(afterIds);
      return describeDestinyStatDelta(before, after);
    }

    function pointifyDestiny(targetId, color) {
      const entry = metaState.destiny.owned[targetId];
      if (!entry) return;
      if (color === "white" && state.whiteInfusionPoints <= 0) return;
      if (color === "black" && state.blackInfusionPoints <= 0) return;
      const previousDef = destinyCatalog[targetId];
      if (!previousDef) return;
      const previousAlignment = getEntryAlignment({ ...entry, def: previousDef });
      const candidateIds = Object.keys(destinyCatalog).filter((id) => {
        const def = destinyCatalog[id];
        if (!def || def.alignment !== color) return false;
        return id === targetId || !metaState.destiny.owned[id];
      });
      const rerollIds = candidateIds.filter((id) => id !== targetId);
      const finalCandidateIds = rerollIds.length ? rerollIds : candidateIds;
      if (!finalCandidateIds.length) {
        setToast(`${color === "white" ? "白道" : "黑道"}命格池当前没有可重抽结果`);
        return;
      }
      const nextId = finalCandidateIds[Math.floor(Math.random() * finalCandidateIds.length)] || targetId;
      const nextDef = destinyCatalog[nextId];
      const equipIndex = metaState.destiny.equipped.indexOf(targetId);
      delete metaState.destiny.owned[targetId];
      metaState.destiny.owned[nextId] = {
        alignment: nextDef.alignment,
      };
      if (equipIndex >= 0) {
        metaState.destiny.equipped[equipIndex] = nextId;
      }
      if (color === "white") {
        state.whiteInfusionPoints -= 1;
      } else {
        state.blackInfusionPoints -= 1;
      }
      onDestinyLoadoutChanged(color === "white" ? "pointify_white" : "pointify_black");
      saveMetaState();
      openDaoPointifyResultModal({
        color,
        previousId: targetId,
        previousDef,
        previousAlignment,
        nextId,
        nextDef,
        nextAlignment: nextDef.alignment,
      });
    }

    function openPointifyConfirmModal(targetId, color) {
      const entry = metaState.destiny.owned[targetId];
      const def = destinyCatalog[targetId];
      if (!entry || !def) return;
      state.paused = true;
      state.currentModal = "dao-pointify-confirm";
      renderModal({
        title: "确认点化",
        body: `${color === "white" ? "白道" : "黑道"}点化会立刻消耗 1 点${color === "white" ? "白" : "黑"}点化点，并永久替换这枚当前命格，本次操作不可逆转。`,
        bodyHtml: `
          <div class="reincarnation-summary dao-pointify-summary">
            <div class="summary-card">
              <div class="summary-label">当前目标</div>
              <div class="summary-value">${def.name}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">当前阵营</div>
              <div class="summary-value">${getAlignmentLabel(getEntryAlignment({ ...entry, def }))}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">点化结果</div>
              <div class="summary-value">重抽替换</div>
            </div>
          </div>
          <div class="dao-pointify-note">点化执行后，这枚命格会先回到公共池，再从${color === "white" ? "白道" : "黑道"}命格池重抽一枚新命格替换它；结果一旦生成，本次点化无法撤销。</div>
          <div class="dao-pointify-note">结果预览：${describePointifyPreview(targetId, color)}</div>
        `,
        choices: [{
          title: "确认点化",
          body: "执行本次不可逆的点化操作。",
          onClick: () => pointifyDestiny(targetId, color),
        }],
        actions: [{
          label: "返回目标选择",
          onClick: () => openDaoPointifyTargetModal(color),
        }],
        className: "reincarnation-modal dao-pointify-modal",
      });
    }

    function openDaoPointifyModal(continuation = null) {
      if (continuation) pendingInfusionContinuation = continuation;
      const targets = getEquippedDestinyEntries();
      if (!hasInfusionPoints()) {
        continueInfusionFlow();
        return;
      }
      if (!targets.length) {
        setToast("暂无已镶嵌命格可供点化，本次机会保留。");
        continueInfusionFlow();
        return;
      }
      const choices = [];
      if (state.whiteInfusionPoints > 0) {
        choices.push({
          title: "白道点化",
          body: `消耗 1 点白点化点，重抽一枚当前命格。当前白点化点：${state.whiteInfusionPoints}`,
          onClick: () => openDaoPointifyTargetModal("white"),
        });
      }
      if (state.blackInfusionPoints > 0) {
        choices.push({
          title: "黑道点化",
          body: `消耗 1 点黑点化点，重抽一枚当前命格。当前黑点化点：${state.blackInfusionPoints}`,
          onClick: () => openDaoPointifyTargetModal("black"),
        });
      }
      if (!choices.length) {
        continueInfusionFlow();
        return;
      }
      state.paused = true;
      state.currentModal = "dao-pointify";
      renderModal({
        title: "道途点化",
        body: "消耗白/黑点化点，将一枚当前命格放回池中，再从对应颜色命格池重抽一枚。点化点来自局内黑白槽累计满槽次数，不消耗当前黑白槽。",
        bodyHtml: `
          <div class="reincarnation-summary dao-pointify-summary">
            <div class="summary-card">
              <div class="summary-label">可点化目标</div>
              <div class="summary-value">${targets.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">白点化点</div>
              <div class="summary-value">${state.whiteInfusionPoints}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">黑点化点</div>
              <div class="summary-value">${state.blackInfusionPoints}</div>
            </div>
          </div>
          <div class="dao-pointify-note">点化会将所选当前命格放回命格池，再从你选择的白道或黑道命格池重抽一枚；命格本身的黑白归属是固定的，不会被点化改色。点化结果会立刻替换当前槽位生效。当前黑白槽只负责战斗状态，不会在此被消耗。</div>
        `,
        choices,
        className: "reincarnation-modal dao-pointify-modal",
        actions: [{
          label: "暂不点化",
          onClick: () => {
            closeModal();
            state.paused = false;
            continueInfusionFlow();
          },
        }],
      });
    }

    function openDaoPointifyTargetModal(color) {
      const targetEntries = getEquippedDestinyEntries();
      state.paused = true;
      state.currentModal = "dao-pointify-target";
      renderModal({
        title: color === "white" ? "白道点化目标" : "黑道点化目标",
        body: `选择一枚当前命格，消耗 1 点${color === "white" ? "白" : "黑"}点化点后，会将它放回池中，并从对应颜色命格池重抽一枚。`,
        bodyHtml: `
          <div class="reincarnation-summary dao-pointify-summary">
            <div class="summary-card">
              <div class="summary-label">重抽池子</div>
              <div class="summary-value">${color === "white" ? "白道命格池" : "黑道命格池"}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">剩余点化点</div>
              <div class="summary-value">${color === "white" ? state.whiteInfusionPoints : state.blackInfusionPoints}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">处理方式</div>
              <div class="summary-value">重抽替换</div>
            </div>
          </div>
          <div class="dao-pointify-note">当前目标是你点击的那枚已镶嵌命格。它会先回到公共池中，然后从所选颜色池重抽一枚；命格颜色由命格池决定，不会被强制改写。</div>
        `,
        choices: targetEntries.map((entry) => ({
          title: `${entry.def.name} [${getAlignmentLabel(getEntryAlignment(entry))}]`,
          body: `当前目标 | 当前阵营 ${getAlignmentLabel(getEntryAlignment(entry))} | 操作：重抽并替换<br>结果预览：${describePointifyPreview(entry.id, color)}`,
          onClick: () => openPointifyConfirmModal(entry.id, color),
        })),
        className: "reincarnation-modal dao-pointify-modal",
        actions: [{
          label: "返回上一步",
          onClick: () => openDaoPointifyModal(),
        }],
      });
    }

    function openDaoPointifyResultModal({ color, previousId, previousDef, previousAlignment, nextId, nextDef, nextAlignment }) {
      const canContinuePointify = hasInfusionPoints() && getEquippedDestinyEntries().length > 0;
      const resultChanged = previousId !== nextId;
      const resultSummary = resultChanged
        ? `${previousDef.name} 已从${color === "white" ? "白道" : "黑道"}命格池重抽为 ${nextDef.name}`
        : `${previousDef.name} 在本次重抽中回到了自己`;
      state.paused = true;
      state.currentModal = "dao-pointify-result";
      renderModal({
        title: "点化结果",
        body: `${color === "white" ? "白道" : "黑道"}点化完成，${resultSummary}。`,
        bodyHtml: `
          <div class="reincarnation-summary dao-pointify-summary">
            <div class="summary-card">
              <div class="summary-label">重抽池子</div>
              <div class="summary-value">${color === "white" ? "白道命格池" : "黑道命格池"}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">结果处理</div>
              <div class="summary-value">已替换</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">白点化点</div>
              <div class="summary-value">${state.whiteInfusionPoints}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">黑点化点</div>
              <div class="summary-value">${state.blackInfusionPoints}</div>
            </div>
          </div>
          <div class="dao-pointify-result-grid">
            <div class="summary-card dao-pointify-destiny-card">
              <div class="summary-label">点化前</div>
              <div class="summary-value">${previousDef.name}</div>
              <div class="dao-pointify-destiny-meta">${getAlignmentLabel(previousAlignment)}</div>
              <div class="dao-pointify-destiny-text">${getDestinyText(previousDef, previousAlignment)}</div>
            </div>
            <div class="summary-card dao-pointify-destiny-card">
              <div class="summary-label">点化后</div>
              <div class="summary-value">${nextDef.name}</div>
              <div class="dao-pointify-destiny-meta">${getAlignmentLabel(nextAlignment)}</div>
              <div class="dao-pointify-destiny-text">${getDestinyText(nextDef, nextAlignment)}</div>
            </div>
          </div>
          <div class="dao-pointify-note">
            点化目标来自当前命格槽，结果会立刻生效。${getPointifyBoardPreview(previousId, nextId)}
          </div>
        `,
        choices: canContinuePointify
          ? [{
            title: "继续点化",
            body: "还有剩余点化点或可点化命格，继续处理下一枚当前命格。",
            onClick: () => openDaoPointifyModal(),
          }]
          : [],
        className: "reincarnation-modal dao-pointify-modal dao-pointify-result-modal",
        actions: [{
          label: "确认结果",
          onClick: () => {
            closeModal();
            state.paused = false;
            continueInfusionFlow();
          },
        }],
      });
    }

    function openDestinyOffer({ title = "道途进了一步", body = "从三枚命格中择一，作为本次新命格。", onComplete = () => {} } = {}) {
      const offers = getRandomDestinyOffers(3);
      if (!offers.length) {
        onComplete();
        return;
      }
      state.currentDestinyOffers = offers;
      state.paused = true;
      state.currentModal = "stage-destiny";
      renderModal({
        title,
        body,
        choices: offers.map((offer) => ({
          title: `${destinyCatalog[offer.id].name} [${getAlignmentLabel(destinyCatalog[offer.id].alignment)}]`,
          body: destinyCatalog[offer.id].text[destinyCatalog[offer.id].alignment],
          onClick: () => {
            closeModal();
            state.paused = false;
            acquireDestiny(offer.id, onComplete);
          },
        })),
        actions: [{
          label: "放弃本次新命格",
          onClick: () => {
            closeModal();
            state.paused = false;
            onComplete();
          },
        }],
      });
    }

    return {
      clearPendingInfusionContinuation,
      openEquipDestinyModal,
      openDaoPointifyModal,
      openDestinyOffer,
      maybeHandlePostBossInfusion,
    };
  }

  global.GameDestinyFlow = {
    createDestinyFlow,
  };
})(window);
