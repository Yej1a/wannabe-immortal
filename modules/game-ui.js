(function initGameUI(global) {
  const { PATH_THRESHOLDS, skills, skillRouteTable } = global.GameData;

  function getSkillTheme(skillId) {
    return skills[skillId]?.art || {
      primary: "#eef5f7",
      secondary: "#7ca0b8",
      glow: "rgba(255,255,255,0.12)",
    };
  }

  function renderSkillIcon(skillId) {
    const theme = getSkillTheme(skillId);
    const style = `style="--skill-primary:${theme.primary};--skill-secondary:${theme.secondary};--skill-glow:${theme.glow};"`;
    if (skillId === "sword") {
      return `
        <div class="skill-icon skill-icon-sword" ${style}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" class="skill-icon-bg" />
            <path d="M31 9l5 5-11 11-4 1 1-4 9-13z" class="skill-icon-main" />
            <path d="M19 28l6 1-1 6-4 4-3-3 4-4z" class="skill-icon-edge" />
            <path d="M11 30c6-5 15-7 26-5" class="skill-icon-ring" />
          </svg>
        </div>
      `;
    }
    if (skillId === "thunder") {
      return `
        <div class="skill-icon skill-icon-thunder" ${style}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" class="skill-icon-bg" />
            <path d="M25 8l-8 15h6l-3 17 11-18h-6l4-14z" class="skill-icon-main" />
            <path d="M10 33c7-6 16-7 28-3" class="skill-icon-ring" />
          </svg>
        </div>
      `;
    }
    if (skillId === "flame") {
      return `
        <div class="skill-icon skill-icon-flame" ${style}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" class="skill-icon-bg" />
            <circle cx="24" cy="24" r="11.5" class="skill-icon-ring" />
            <path d="M24 11c3 4 7 7 7 13 0 5-3 9-7 9s-7-4-7-9c0-5 3-8 7-13z" class="skill-icon-main" />
            <path d="M24 18c2 3 4 4 4 7a4 4 0 1 1-8 0c0-2 1-4 4-7z" class="skill-icon-edge" />
          </svg>
        </div>
      `;
    }
    if (skillId === "guard") {
      return `
        <div class="skill-icon skill-icon-guard" ${style}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" class="skill-icon-bg" />
            <path d="M24 10c8 0 12 3 12 3v10c0 8-6 13-12 15-6-2-12-7-12-15V13s4-3 12-3z" class="skill-icon-main" />
            <path d="M16 21c5 2 11 2 16 0" class="skill-icon-ring" />
            <path d="M18 29c4 1 8 1 12 0" class="skill-icon-edge" />
          </svg>
        </div>
      `;
    }
    return `
      <div class="skill-icon skill-icon-empty">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" class="skill-icon-empty-ring" />
          <path d="M16 24h16" class="skill-icon-empty-line" />
        </svg>
      </div>
    `;
  }

  function formatTime(totalSeconds) {
    const seconds = Math.ceil(totalSeconds);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function getSkillBranchCount(skill, routeId) {
    if (!skill || !skill.routePoints || !routeId) return 0;
    return Number(skill.routePoints[routeId] || 0);
  }

  function getSkillRouteSnapshot(skillId, skill) {
    const routeTable = skillRouteTable[skillId];
    if (!routeTable) return null;
    const routeId = skill?.route || routeTable.defaultRoute || null;
    const route = routeId ? routeTable.routes?.[routeId] || null : null;
    if (!route) return null;
    const branchCount = getSkillBranchCount(skill, routeId);
    const graduated = !!skill?.capstone && skill.capstone === routeId;
    const stage = !skill?.route
      ? "prototype"
      : graduated
        ? "graduated"
        : branchCount >= 2
          ? "formed"
          : "branched";
    return {
      routeId,
      route,
      branchCount,
      graduated,
      stage,
      label: !skill?.route ? `未分路（当前按 ${route.label} 原型）` : route.label,
    };
  }

  function getSkillRouteStageLabel(routeStage) {
    if (!routeStage) return "未分路";
    if (routeStage.stage === "graduated") return "已毕业";
    if (routeStage.stage === "formed") return "成型";
    if (routeStage.stage === "branched") return "分路锁定";
    return "原型";
  }

  function setToast(dom, uiState, message, tone = "") {
    dom.toast.textContent = message;
    dom.toast.className = "toast";
    if (tone) dom.toast.classList.add(`toast-${tone}`);
    dom.toast.classList.add("show");
    clearTimeout(uiState.toastTimeout);
    uiState.toastTimeout = setTimeout(() => {
      dom.toast.classList.remove("show");
      dom.toast.className = "toast";
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
    dom.pauseBtn.textContent = state.manualPause ? "继续" : "暂停";
  }

  function describePathStage(path) {
    const tier1Name = path.color === "white" ? "清明" : "煞燃";
    const tier2Name = path.color === "white" ? "灵护" : "魔驰";
    const fullName = path.color === "white" ? "天息" : "魔沸";
    const key = path.color === "white" ? "Q" : "E";
    if (path.full) return `${fullName}就绪，${key}可释放`;
    if (path.value >= PATH_THRESHOLDS.tier2) return `${tier2Name}已触发`;
    if (path.value >= PATH_THRESHOLDS.tier1) return `${tier1Name}已触发`;
    return `下一节点 ${path.value < PATH_THRESHOLDS.tier1 ? PATH_THRESHOLDS.tier1 : PATH_THRESHOLDS.tier2}`;
  }

  function hasStatus(state, name) {
    return state.statuses.some((status) => status.name === name);
  }

  function buildPathStageHtml(path, state) {
    const isWhite = path.color === "white";
    const key = isWhite ? "Q" : "E";
    const tier1Name = isWhite ? "清明" : "煞燃";
    const tier2Name = isWhite ? "灵护" : "魔驰";
    const fullName = isWhite ? "天息" : "魔沸";
    let label = `下一节点 ${path.value < PATH_THRESHOLDS.tier1 ? PATH_THRESHOLDS.tier1 : PATH_THRESHOLDS.tier2}`;
    let tone = "path-stage-neutral";
    if (path.full) {
      label = `${fullName}就绪`;
      tone = "path-stage-ready";
    } else if (path.value >= PATH_THRESHOLDS.tier2) {
      label = `${tier2Name}已触发`;
      tone = "path-stage-tier2";
    } else if (path.value >= PATH_THRESHOLDS.tier1) {
      label = `${tier1Name}已触发`;
      tone = "path-stage-tier1";
    }
    const releaseActive = hasStatus(state, isWhite ? "天息" : "魔沸");
    return `
      <span class="path-stage-wrap ${tone}${releaseActive ? " is-release-active" : ""}">
        <span class="path-stage-label">${label}</span>
        <span class="path-key${path.full ? " ready" : ""}">${key}</span>
      </span>
    `;
  }

  function syncPathHudBlock(fill, path, state) {
    const meter = fill?.parentElement;
    const block = fill?.closest?.(".panel-block");
    if (!meter || !block) return;
    const isWhite = path.color === "white";
    const tier1Active = hasStatus(state, isWhite ? "清明" : "煞燃");
    const tier2Active = hasStatus(state, isWhite ? "灵护" : "魔驰");
    const releaseActive = hasStatus(state, isWhite ? "天息" : "魔沸");
    meter.classList.add("path-meter");
    block.classList.add("path-block");
    block.classList.toggle("path-block-white", isWhite);
    block.classList.toggle("path-block-black", !isWhite);
    block.classList.toggle("is-tier-1", path.value >= PATH_THRESHOLDS.tier1);
    block.classList.toggle("is-tier-2", path.value >= PATH_THRESHOLDS.tier2);
    block.classList.toggle("is-ready", path.full);
    block.classList.toggle("is-tier-active", tier1Active || tier2Active);
    block.classList.toggle("is-release-active", releaseActive);
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

  function renderSkillBar({ dom, skillCards }) {
    const slots = skillCards.map((card) => `
      <button
        class="skill-card inspectable ${card.stageClass ? `skill-card-${card.stageClass}` : ""}"
        type="button"
        data-inspect-group="skill"
        data-inspect-key="${card.key}"
      >
        ${renderSkillIcon(card.key)}
        <div class="skill-copy">
          <div class="skill-name">${card.name}</div>
          ${card.badges?.length ? `
            <div class="skill-badges">
              ${card.badges.map((badge) => `<span class="skill-badge">${badge}</span>`).join("")}
            </div>
          ` : ""}
          <div class="skill-detail">${card.detail}</div>
          ${card.climaxText ? `<div class="skill-climax">${card.climaxText}</div>` : ""}
        </div>
      </button>
    `);
    while (slots.length < 3) {
      slots.push(`
        <div class="skill-card empty">
          ${renderSkillIcon("empty")}
          <div class="skill-copy">
            <div class="skill-name">空术法位</div>
            <div class="skill-detail">升级时可获得新的主动术法。</div>
          </div>
        </div>
      `);
    }
    dom.skillBar.innerHTML = slots.join("");
  }

  function updateHud({
    dom,
    state,
    syncPauseButton,
    xpNeeded,
    describePathStage,
    renderSkillBar,
    statusItems,
    destinyItems,
    pathHintHtml,
  }) {
    syncPauseButton();
    dom.healthFill.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
    dom.healthText.textContent = `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`;
    dom.levelText.textContent = state.player.level;
    dom.xpFill.style.width = `${(state.player.xp / xpNeeded(state.player.level)) * 100}%`;
    dom.xpText.textContent = `${Math.floor(state.player.xp)} / ${xpNeeded(state.player.level)}`;
    dom.phaseText.textContent = state.phaseLabel;
    dom.whiteFill.style.width = `${(state.whitePath.value / state.whitePath.cap) * 100}%`;
    dom.blackFill.style.width = `${(state.blackPath.value / state.blackPath.cap) * 100}%`;
    dom.whiteText.textContent = `${Math.floor(state.whitePath.value)} / ${state.whitePath.cap}`;
    dom.blackText.textContent = `${Math.floor(state.blackPath.value)} / ${state.blackPath.cap}`;
    dom.whiteStageText.innerHTML = buildPathStageHtml(state.whitePath, state);
    dom.blackStageText.innerHTML = buildPathStageHtml(state.blackPath, state);
    syncPathHudBlock(dom.whiteFill, state.whitePath, state);
    syncPathHudBlock(dom.blackFill, state.blackPath, state);
    if (dom.nodeHint) dom.nodeHint.innerHTML = pathHintHtml;
    dom.statusList.innerHTML = statusItems
      .slice(0, 6)
      .map((item) => `
        <button
          class="status-pill inspectable ${item.tone ? `status-pill-${item.tone}` : ""}"
          type="button"
          data-inspect-group="status"
          data-inspect-key="${item.key}"
        >${item.label}</button>
      `)
      .join("");
    if (dom.destinyList) {
      dom.destinyList.innerHTML = destinyItems
        .map((item) => item.inspectable
          ? `
            <button
              class="destiny-card inspectable"
              type="button"
              data-inspect-group="destiny"
              data-inspect-key="${item.key}"
            >
              <strong>${item.title}</strong>
              <span>${item.body}</span>
            </button>
          `
          : `
            <div class="destiny-card empty">
              <strong>${item.title}</strong>
              <span>${item.body}</span>
            </div>
          `)
        .join("");
    }
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
        skills: state.player.skillOrder.map((id) => {
          const skill = state.player.skills[id];
          const routeState = getSkillRouteSnapshot(id, skill);
          const activeRoute = routeState?.route || null;
          return {
            id,
            rank: skill.rank,
            route: routeState?.routeId || null,
            route_label: routeState?.label || "未分路",
            route_stage: getSkillRouteStageLabel(routeState),
            route_stage_key: routeState?.stage || "prototype",
            branch_count: routeState?.branchCount || 0,
            graduated: !!routeState?.graduated,
            capstone_name: activeRoute?.capstoneName || null,
            identity_tags: activeRoute?.identityTags || [],
            active_climax_text: activeRoute?.activeClimaxText || "",
            graduation_summary: activeRoute?.graduationSummary || "",
            active_name: activeRoute?.activeName || skills[id]?.name || id,
            active_ready: skill.activeTimer <= 0,
          };
        }),
      },
      paths: {
        white: { value: Math.round(state.whitePath.value), cap: state.whitePath.cap, full: state.whitePath.full, stage: describePathStage(state.whitePath) },
        black: { value: Math.round(state.blackPath.value), cap: state.blackPath.cap, full: state.blackPath.full, stage: describePathStage(state.blackPath) },
      },
      infusion_points: {
        total: state.whiteInfusionPoints + state.blackInfusionPoints,
        white: state.whiteInfusionPoints,
        black: state.blackInfusionPoints,
      },
      destinies: {
        owned: getOwnedDestinyEntries().map((entry) => ({ id: entry.id, alignment: getEntryAlignment(entry) })),
        equipped: metaState.destiny.equipped,
      },
      destiny_runtime: {
        white_point_total: Math.round(state.destinyRuntime?.whitePointTotal || 0),
        black_point_total: Math.round(state.destinyRuntime?.blackPointTotal || 0),
        skill_rewrites: Object.values(state.destinyRuntime?.skillRewriteState || {}).map((entry) => ({
          skill_id: entry.skillId,
          learned: !!entry.learned,
          route_locked: !!entry.routeLocked,
          route_id: entry.routeId,
          entries: (entry.entries || [])
            .filter((item) => item.equipped)
            .map((item) => ({ destiny_id: item.destinyId, layer: item.layer, route_id: item.routeId })),
        })),
        recent_log: (state.destinyRuntime?.log || []).slice(-8).map((item) => ({
          type: item.type,
          time: item.time,
          payload: item.payload,
        })),
      },
      enemy_count: state.enemies.length,
      statuses: state.statuses.map((status) => ({ name: status.name, remaining: Number(status.remaining.toFixed(1)) })),
      visible_enemies: state.enemies.slice(0, 8).map((enemy) => ({
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: Math.round(enemy.hp),
        color: enemy.color,
        is_mini_boss: !!enemy.isMiniBoss,
        mini_boss_kind: enemy.miniBossKind || null,
        mini_boss_state: enemy.miniBossState || null,
        teleport_target: enemy.miniBossTeleportTarget
          ? {
            x: Math.round(enemy.miniBossTeleportTarget.x),
            y: Math.round(enemy.miniBossTeleportTarget.y),
          }
          : null,
      })),
      boss: state.boss ? {
        id: state.boss.bossId || null,
        name: state.boss.name || "Boss",
        role: state.boss.role || null,
        hp: Math.round(state.boss.hp),
        phase: state.boss.phase,
        phase_name: state.boss.phaseNames?.[state.boss.phase - 1] || `阶段${state.boss.phase}`,
        current_skill: state.boss.intentLabel || null,
        current_skill_category: state.boss.intentCategory || null,
        counterable_window: !!state.boss.intentCounterable,
        exposed_timer: Number((state.boss.exposedTimer || 0).toFixed(2)),
      } : null,
      active_effects: state.activeEffects.slice(0, 6).map((effect) => ({
        kind: effect.kind,
        x: Math.round(effect.x ?? effect.startX ?? 0),
        y: Math.round(effect.y ?? effect.startY ?? 0),
        time: Number((effect.time || 0).toFixed(2)),
      })),
      pulses: state.pulses.slice(0, 6).map((pulse) => ({
        kind: pulse.kind,
        x: Math.round(pulse.x ?? 0),
        y: Math.round(pulse.y ?? 0),
        radius: Math.round(pulse.radius ?? 0),
        time: Number((pulse.time || pulse.duration || 0).toFixed(2)),
      })),
      pending_levelups: state.pendingLevelUps,
      current_modal: state.currentModal,
      economy: {
        dao_marks: state.daoMarks,
        last_run_dao_marks: state.lastRunDaoMarks,
        reincarnation_points: metaState.points,
      },
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
