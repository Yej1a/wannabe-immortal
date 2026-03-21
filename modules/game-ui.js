(function initGameUI(global) {
  const {
    ACTIVE_UNLOCK_RANK,
    PATH_THRESHOLDS,
  } = global.GameData;

  function formatTime(totalSeconds) {
    const seconds = Math.ceil(totalSeconds);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function setToast(dom, uiState, message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(uiState.toastTimeout);
    uiState.toastTimeout = setTimeout(() => {
      dom.toast.classList.remove("show");
    }, 1800);
  }

  function closeModal(state, dom, syncPauseButton) {
    state.currentModal = null;
    state.modalOptions = null;
    dom.modalRoot.classList.add("hidden");
    dom.modalRoot.innerHTML = "";
    syncPauseButton();
  }

  function renderModal(state, dom, { title, body, bodyHtml = "", choices, actions = [], className = "" }, syncPauseButton) {
    state.modalOptions = { choices, actions };
    dom.modalRoot.classList.remove("hidden");
    syncPauseButton();
    const choiceListClass = choices.length === 1 ? "choice-list single-item" : "choice-list";
    const actionListClass = actions.length === 1 ? "modal-actions single-item" : "modal-actions";
    dom.modalRoot.innerHTML = `
      <div class="modal-card ${className}">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${body}</div>
        ${bodyHtml}
        <div class="${choiceListClass}">
          ${choices.map((choice, index) => `
            <button class="choice-card" type="button" data-choice="${index}" ${choice.disabled ? "disabled" : ""}>
              <strong>${choice.title}</strong>
              <span>${choice.body}</span>
            </button>
          `).join("")}
        </div>
        <div class="${actionListClass}">
          ${actions.map((action, index) => `<button class="action-btn" type="button" data-action="${index}">${action.label}</button>`).join("")}
        </div>
      </div>
    `;
    dom.modalRoot.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => choices[Number(button.dataset.choice)].onClick());
    });
    dom.modalRoot.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => actions[Number(button.dataset.action)].onClick());
    });
  }

  function handleModalHotkeys(state, key) {
    if (!state.modalOptions) return false;
    const { choices, actions } = state.modalOptions;
    if (key === "1" && choices[0]) { choices[0].onClick(); return true; }
    if (key === "2" && choices[1]) { choices[1].onClick(); return true; }
    if (key === "3" && choices[2]) { choices[2].onClick(); return true; }
    if ((key === "enter" || key === "space") && choices[0]) { choices[0].onClick(); return true; }
    if (key === "escape" && actions[0]) { actions[0].onClick(); return true; }
    return false;
  }

  function showOverlay(dom, show) {
    dom.overlayMessage.classList.toggle("show", show);
  }

  function syncPauseButton(dom, state, canToggleManualPause) {
    const canToggle = canToggleManualPause();
    dom.pauseBtn.disabled = !canToggle && !state.manualPause;
    dom.pauseBtn.textContent = state.manualPause ? "\u7ee7\u7eed" : "\u6682\u505c";
  }

  function describePathStage(path) {
    if (path.full) return `已满槽 ${path.color === "white" ? "Q" : "E"} 释放`;
    if (path.value >= PATH_THRESHOLDS.tier2) return "2/3 已触发";
    if (path.value >= PATH_THRESHOLDS.tier1) return "1/3 已触发";
    return `下一节点 ${path.value < PATH_THRESHOLDS.tier1 ? PATH_THRESHOLDS.tier1 : PATH_THRESHOLDS.tier2}`;
  }

  function refreshPhase(state) {
    const prefix = `第${state.campaign.runIndex}轮 第${state.campaign.stageIndex}关`;
    if (state.bossFight) {
      state.phaseLabel = `第${state.campaign.runIndex}轮 大Boss`;
      return;
    }
    if (state.campaign.miniBossSpawned && !state.campaign.miniBossDefeated) {
      state.phaseLabel = `${prefix} 小Boss`;
      return;
    }
    state.phaseLabel = `${prefix} 击破 ${state.campaign.stageKills}/${state.campaign.targetKills}`;
  }

  function renderSkillBar({ dom, state, skills, getActiveLevel, getThunderDamage }) {
    const slots = state.player.skillOrder.map((id) => {
      const skill = state.player.skills[id];
      const template = skills[id];
      const slotIndex = state.player.skillOrder.indexOf(id) + 1;
      const activeLevel = getActiveLevel(skill);
      const activeText = activeLevel > 0
        ? (skill.activeTimer > 0 ? `主动 ${slotIndex}键 ${skill.activeTimer.toFixed(1)}s` : `主动 ${slotIndex}键 就绪`)
        : `主动 ${slotIndex}键 ${ACTIVE_UNLOCK_RANK}阶解锁`;
      let detail = `Rank ${skill.rank}`;
      if (id === "guard") detail += ` | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`;
      else if (id === "sword") detail += ` | ${skill.projectiles} 剑`;
      else if (id === "thunder") detail += ` | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`;
      else if (id === "flame") detail += ` | 半径 ${Math.floor(skill.radius)}`;
      return `<div class="skill-card"><div class="skill-name">${slotIndex}. ${template.name}</div><div class="skill-detail">${detail}<br>${activeText}<br>${template.description}</div></div>`;
    });
    while (slots.length < 3) {
      slots.push('<div class="skill-card"><div class="skill-name">空术法位</div><div class="skill-detail">升级时可获得新的主动术法。</div></div>');
    }
    dom.skillBar.innerHTML = slots.join("");
  }

  function updateHud({
    dom,
    state,
    syncPauseButton,
    xpNeeded,
    describePathStage,
    getAlignmentCounts,
    renderSkillBar,
  }) {
    syncPauseButton();
    dom.healthFill.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
    dom.healthText.textContent = `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`;
    dom.levelText.textContent = state.player.level;
    dom.xpFill.style.width = `${(state.player.xp / xpNeeded(state.player.level)) * 100}%`;
    dom.xpText.textContent = `${Math.floor(state.player.xp)} / ${xpNeeded(state.player.level)}`;
    dom.timerText.textContent = `R${state.campaign.runIndex}-${state.campaign.stageIndex}`;
    dom.phaseText.textContent = state.phaseLabel;
    dom.whiteFill.style.width = `${(state.whitePath.value / state.whitePath.cap) * 100}%`;
    dom.blackFill.style.width = `${(state.blackPath.value / state.blackPath.cap) * 100}%`;
    dom.whiteText.textContent = `${Math.floor(state.whitePath.value)} / ${state.whitePath.cap}`;
    dom.blackText.textContent = `${Math.floor(state.blackPath.value)} / ${state.blackPath.cap}`;
    dom.whiteStageText.textContent = describePathStage(state.whitePath);
    dom.blackStageText.textContent = describePathStage(state.blackPath);
    dom.statusList.innerHTML = "";
    const counts = getAlignmentCounts();
    const statusLabels = state.statuses.map((item) => `${item.name} ${item.remaining.toFixed(1)}s`);
    if (state.player.barrier > 0) statusLabels.push(`护体 ${Math.ceil(state.player.barrier)}`);
    if (state.blackMomentumStacks > 0 && state.blackMomentumTimer > 0) {
      statusLabels.push(`袭势 ${state.blackMomentumStacks}层 ${state.blackMomentumTimer.toFixed(1)}s`);
    }
    statusLabels.push(`白点化 ${state.whiteInfusionPoints}`);
    statusLabels.push(`黑点化 ${state.blackInfusionPoints}`);
    statusLabels.push(`白命格 ${counts.white}`);
    statusLabels.push(`黑命格 ${counts.black}`);
    statusLabels.push(`混元命格 ${counts.mixed}`);
    statusLabels.slice(0, 6).forEach((label) => {
      const pill = document.createElement("div");
      pill.className = "status-pill";
      pill.textContent = label;
      dom.statusList.appendChild(pill);
    });
    renderSkillBar();
  }

  function renderGameToText({ state, metaState, getOwnedDestinyEntries, getEntryAlignment }) {
    return JSON.stringify({
      mode: state.mode,
      phase: state.phaseLabel,
      run_stage: `run-${state.campaign.runIndex}-stage-${state.campaign.stageIndex}`,
      total_time: formatTime(Math.max(0, state.time)),
      coordinate_system: "origin top-left, x right, y down",
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        hp: Math.round(state.player.hp),
        max_hp: Math.round(state.player.maxHp),
        barrier: Math.round(state.player.barrier),
        level: state.player.level,
        skills: state.player.skillOrder.map((id) => ({ id, rank: state.player.skills[id].rank })),
      },
      paths: {
        white: { value: Math.round(state.whitePath.value), cap: state.whitePath.cap, full: state.whitePath.full, stage: describePathStage(state.whitePath) },
        black: { value: Math.round(state.blackPath.value), cap: state.blackPath.cap, full: state.blackPath.full, stage: describePathStage(state.blackPath) },
      },
      infusion_points: {
        white: state.whiteInfusionPoints,
        black: state.blackInfusionPoints,
      },
      destinies: {
        owned: getOwnedDestinyEntries().map((entry) => ({ id: entry.id, level: entry.level, alignment: getEntryAlignment(entry) })),
        equipped: metaState.destiny.equipped,
      },
      enemy_count: state.enemies.length,
      statuses: state.statuses.map((status) => ({ name: status.name, remaining: Number(status.remaining.toFixed(1)) })),
      visible_enemies: state.enemies.slice(0, 8).map((enemy) => ({
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: Math.round(enemy.hp),
        color: enemy.color,
      })),
      boss: state.boss ? { hp: Math.round(state.boss.hp), phase: state.boss.phase } : null,
      pending_levelups: state.pendingLevelUps,
      current_modal: state.currentModal,
      meta: {
        points: metaState.points,
        upgrades: metaState.upgrades,
        runs: metaState.runs,
        last_result: metaState.lastResult,
      },
    });
  }

  global.GameUI = {
    formatTime,
    setToast,
    closeModal,
    renderModal,
    handleModalHotkeys,
    showOverlay,
    syncPauseButton,
    describePathStage,
    refreshPhase,
    renderSkillBar,
    updateHud,
    renderGameToText,
  };
})(window);
