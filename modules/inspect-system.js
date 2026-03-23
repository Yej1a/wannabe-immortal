(function initGameInspectSystem(global) {
  function createInspectSystem(deps) {
    const {
      state,
      dom,
      PATH_COMBAT,
      ACTIVE_UNLOCK_RANK,
      DESTINY_SLOT_CAP,
      skills,
      getThunderDamage,
      getSkillActiveProfile,
      getSkillRouteLabel,
      getSkillRouteStage,
      getActiveLevel,
      isActiveUnlocked,
      getEquippedDestinyEntries,
      getEntryAlignment,
      getAlignmentLabel,
      getDestinyText,
    } = deps;

    const registry = {
      status: {},
      skill: {},
      destiny: {},
    };
    let hoveredInspect = null;
    let pinnedInspect = null;

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatPercent(value, digits = 0) {
      return `${(value * 100).toFixed(digits)}%`;
    }

    function formatSignedPercent(value, digits = 0) {
      const sign = value >= 0 ? "+" : "-";
      return `${sign}${Math.abs(value * 100).toFixed(digits)}%`;
    }

    function formatSeconds(value) {
      return `${Math.max(0, value).toFixed(value >= 10 ? 0 : 1)}s`;
    }

    function getRouteStageLabel(routeStage) {
      if (!routeStage) return "未分路";
      if (routeStage.stage === "graduated") return "已毕业";
      if (routeStage.stage === "formed") return "成型";
      if (routeStage.stage === "branched") return "分路锁定";
      return "原型";
    }

    function getRouteSummaryText(routeStage, activeProfile) {
      const route = routeStage?.route || activeProfile;
      if (!route) return "";
      if (routeStage?.graduated && route.graduationSummary) return route.graduationSummary;
      return route.activeClimaxText || route.activeDescription || "";
    }

    function describeIncomingMult(mult) {
      if (mult < 1) return `承伤 ${formatSignedPercent(1 - mult)} `;
      if (mult > 1) return `承伤 +${((mult - 1) * 100).toFixed(0)}%`;
      return "承伤不变";
    }

    function setInspectEntries(group, items) {
      registry[group] = Object.fromEntries(items.map((item) => [String(item.key), item]));
    }

    function getInspectEntry(selection) {
      if (!selection) return null;
      return registry[selection.group]?.[String(selection.key)] || null;
    }

    function getActiveInspectSelection() {
      return getInspectEntry(pinnedInspect) ? pinnedInspect : hoveredInspect;
    }

    function buildInspectPanelHtml(entry, pinned) {
      if (!entry) {
        return `
          <div class="inspect-title">悬停查看当前构筑</div>
          <div class="inspect-meta">悬停或点击状态、术法、命格，都能在这里查看详细信息。</div>
          <div class="inspect-body">点击后会锁定当前条目，再点一次即可取消锁定。</div>
        `;
      }
      const gains = entry.gains || entry.lines || [];
      const losses = entry.losses || [];
      const fixed = entry.fixed || [];
      const renderSection = (title, items) => `
        <div class="inspect-section">
          <div class="inspect-section-title">${title}</div>
          ${items.length
            ? items.map((line) => `<div class="inspect-line">${escapeHtml(line)}</div>`).join("")
            : '<div class="inspect-line inspect-line-empty">无</div>'}
        </div>
      `;
      return `
        <div class="inspect-title">${escapeHtml(entry.title)}</div>
        <div class="inspect-meta">${escapeHtml(entry.meta || (pinned ? "已锁定" : "悬停查看"))}</div>
        <div class="inspect-body">${escapeHtml(entry.body || "")}</div>
        <div class="inspect-sections">
          ${renderSection("得到", gains)}
          ${renderSection("失去", losses)}
          ${renderSection("固定说明", fixed)}
        </div>
      `;
    }

    function updateInspectSelectionStyles() {
      const active = getActiveInspectSelection();
      document.querySelectorAll(".inspectable").forEach((node) => {
        const group = node.dataset.inspectGroup;
        const key = node.dataset.inspectKey;
        const match = !!active && active.group === group && String(active.key) === String(key);
        node.classList.toggle("is-inspected", match);
      });
    }

    function renderPanel() {
      if (!dom.inspectPanel) return;
      const pinned = !!getInspectEntry(pinnedInspect);
      const active = getActiveInspectSelection();
      const entry = getInspectEntry(active);
      dom.inspectPanel.classList.toggle("empty", !entry);
      dom.inspectPanel.innerHTML = buildInspectPanelHtml(entry, pinned);
      updateInspectSelectionStyles();
    }

    function normalizeInspectSelection(selection) {
      return selection ? { group: selection.group, key: String(selection.key) } : null;
    }

    function setHoveredInspect(selection) {
      if (pinnedInspect) return;
      hoveredInspect = normalizeInspectSelection(selection);
      renderPanel();
    }

    function clearHoveredInspect(selection = null) {
      if (pinnedInspect) return;
      if (!selection) {
        hoveredInspect = null;
        renderPanel();
        return;
      }
      const normalized = normalizeInspectSelection(selection);
      if (
        hoveredInspect
        && hoveredInspect.group === normalized.group
        && hoveredInspect.key === normalized.key
      ) {
        hoveredInspect = null;
        renderPanel();
      }
    }

    function togglePinnedInspect(selection) {
      const normalized = normalizeInspectSelection(selection);
      if (
        pinnedInspect
        && pinnedInspect.group === normalized.group
        && pinnedInspect.key === normalized.key
      ) {
        pinnedInspect = null;
      } else {
        pinnedInspect = normalized;
      }
      hoveredInspect = null;
      renderPanel();
    }

    function syncSelection() {
      if (!getInspectEntry(pinnedInspect)) pinnedInspect = null;
      if (!getInspectEntry(hoveredInspect)) hoveredInspect = null;
      renderPanel();
    }

    function getStatusDescription(status) {
      const effects = status.effects || {};
      if (status.name === "清明") return "白道 1/3 状态，提供拾取、移速、吸附与击杀回复。";
      if (status.name === "灵护") return "白道 2/3 状态，提供护体与状态结束返还判定。";
      if (status.name === "天息") return "白槽满后手动释放的白道状态，会触发安定脉冲并提供持续护持。";
      if (status.name === "煞燃") return "黑道 1/3 状态，提供爆发式的伤害、施法与移速强化。";
      if (status.name === "魔驰") return "黑道 2/3 状态，提供更强的主动冷却流速与低血斩杀窗口。";
      if (status.name === "魔沸") return "黑槽满后手动释放的黑道状态，会触发杀伐冲击并进入收割态。";
      if (status.name === "归元") return "混道互转状态，当前白道回复会短暂转成伤害提升。";
      if (effects.onKillHealPct) return "击杀触发型战斗增益状态。";
      if (effects.damageMult) return "当前提供伤害强化的战斗状态。";
      return "当前生效中的战斗状态。";
    }

    function getStatusEffectLines(status) {
      const effects = status.effects || {};
      const lines = [`剩余时间 ${formatSeconds(status.remaining)}`];
      if (effects.pickupBonus) lines.push(`额外拾取范围 +${Math.round(effects.pickupBonus)}`);
      if (effects.attractRadius && effects.attractSpeed) lines.push(`掉落会在 ${Math.round(effects.attractRadius)} 范围内被吸向角色`);
      if (effects.onKillHealPct) lines.push(`击杀回复 ${formatPercent(effects.onKillHealPct)} 最大生命`);
      if (effects.damageMult) lines.push(`伤害 ${formatSignedPercent(effects.damageMult - 1)}`);
      if (effects.castMult) lines.push(`自动施法频率 ${formatSignedPercent(effects.castMult - 1)}`);
      if (effects.moveMult) lines.push(`移速 ${formatSignedPercent(effects.moveMult - 1)}`);
      if (effects.incomingMult) lines.push(describeIncomingMult(effects.incomingMult).trim());
      if (effects.activeCooldownRate) lines.push(`主动冷却流速 ${formatSignedPercent(effects.activeCooldownRate - 1)}`);
      if (effects.blackBurstRadius) lines.push(`击杀时触发黑焰爆裂，半径 ${Math.round(effects.blackBurstRadius)}`);
      if (effects.blackBurstRadiusMult) lines.push(`黑焰爆裂范围额外提升 ${formatSignedPercent(effects.blackBurstRadiusMult - 1)}`);
      if (effects.critChanceBonus) lines.push(`暴击率 ${formatSignedPercent(effects.critChanceBonus)}`);
      if (effects.drain) lines.push(`每秒损失 ${formatPercent(effects.drain, 1)} 最大生命`);
      if (effects.execute) {
        lines.push(
          `斩杀线：普通 ${formatPercent(effects.execute.normalThreshold)} / 精英 ${formatPercent(effects.execute.eliteThreshold)} / Boss ${formatPercent(effects.execute.bossThreshold)}`,
        );
      }
      return lines;
    }

    function getStatusTone(name) {
      if (name === "清明" || name === "灵护" || name === "天息" || name === "护体") return "white";
      if (name === "煞燃" || name === "魔驰" || name === "魔沸") return "black";
      return "neutral";
    }

    function getStatusRoleLabel(status) {
      if (status.name === "清明") return "吸附/回复";
      if (status.name === "灵护") return "护体/返还";
      if (status.name === "天息") return "稳场/吸附";
      if (status.name === "煞燃") return "爆裂/疾行";
      if (status.name === "魔驰") return "斩杀/主动";
      if (status.name === "魔沸") return "开杀/爆发";
      if (status.name === "护体") return "护体";
      return "战斗状态";
    }

    function getStatusMeta(status) {
      if (status.name === "清明") return `白道 1/3 | 剩余 ${formatSeconds(status.remaining)}`;
      if (status.name === "灵护") return `白道 2/3 | 剩余 ${formatSeconds(status.remaining)}`;
      if (status.name === "天息") return `白道满槽 | 剩余 ${formatSeconds(status.remaining)}`;
      if (status.name === "煞燃") return `黑道 1/3 | 剩余 ${formatSeconds(status.remaining)}`;
      if (status.name === "魔驰") return `黑道 2/3 | 剩余 ${formatSeconds(status.remaining)}`;
      if (status.name === "魔沸") return `黑道满槽 | 剩余 ${formatSeconds(status.remaining)}`;
      return `剩余 ${formatSeconds(status.remaining)}`;
    }

    function getStatusRuleSections(status) {
      const effects = status.effects || {};
      const gains = getStatusEffectLines(status).filter((line) => (
        !line.startsWith("每秒损失")
        && !line.startsWith("承伤 +")
      ));
      const losses = [];
      if (effects.drain) losses.push(`每秒损失 ${formatPercent(effects.drain, 1)} 最大生命`);
      if (effects.incomingMult > 1) losses.push(describeIncomingMult(effects.incomingMult).trim());
      const fixed = [];
      if (status.name === "清明" || status.name === "煞燃") fixed.push("同一充能周期内只触发一次");
      if (status.name === "灵护" || status.name === "魔驰") fixed.push("同一充能周期内只触发一次");
      if (status.name === "天息" || status.name === "魔沸") fixed.push("同名状态不可叠加，释放后对应槽位清空");
      if (status.name === "灵护") fixed.push("结束时若生命仍高于 70%，返还 8 点白道值");
      if (status.name === "护体") fixed.push("护体会优先承受伤害，不会新增第二护体条");
      return { gains, losses, fixed };
    }

    function buildStatusInspectItems() {
      const items = state.statuses.map((status) => {
        const sections = getStatusRuleSections(status);
        return {
          key: `status-${status.name}`,
          tone: getStatusTone(status.name),
          label: `${status.name} ${getStatusRoleLabel(status)} ${formatSeconds(status.remaining)}`,
          title: `状态：${status.name}`,
          meta: getStatusMeta(status),
          body: getStatusDescription(status),
          gains: sections.gains,
          losses: sections.losses,
          fixed: sections.fixed,
        };
      });
      if (state.player.barrier > 0) {
        items.push({
          key: "barrier",
          tone: "white",
          label: `护体 ${Math.ceil(state.player.barrier)}`,
          title: "护体",
          meta: `当前护体 ${Math.ceil(state.player.barrier)}`,
          body: "护体会优先承受伤害，是当前白道稳场与护体体系的直接结果。",
          gains: [
            `当前护体值 ${Math.ceil(state.player.barrier)}`,
            `生命 ${Math.ceil(state.player.hp)} / ${Math.ceil(state.player.maxHp)}`,
          ],
          losses: [],
          fixed: ["护体不会改写 Q / E 的基底逻辑，也不会新增第二护体条"],
        });
      }
      return items;
    }

    function getSkillInspectLines(skillId, skill, slotIndex) {
      const lines = [`当前 Rank ${skill.rank}`];
      const activeProfile = getSkillActiveProfile(skillId, skill);
      const routeStage = getSkillRouteStage(skillId, skill);
      const route = routeStage?.route || activeProfile;
      lines.push(`当前路线 ${getSkillRouteLabel(skillId, skill)}`);
      if (route?.identityTags?.length) lines.push(`路线标签 ${route.identityTags.join(" / ")}`);
      if (route?.activeClimaxText) lines.push(`主动高潮 ${route.activeClimaxText}`);
      lines.push(`当前主动 ${activeProfile.activeName}`);
      const activeLevel = getActiveLevel(skill);
      if (isActiveUnlocked(skill)) {
        lines.push(`主动术法已解锁，按 ${slotIndex} 释放`);
        lines.push(skill.activeTimer > 0 ? `主动冷却剩余 ${formatSeconds(skill.activeTimer)}` : "主动术法已就绪");
        lines.push(`主动等级 ${activeLevel}`);
      } else {
        lines.push(`主动术法将在 Rank ${ACTIVE_UNLOCK_RANK} 解锁`);
      }
      if (skillId === "sword") {
        lines.push(`单发伤害 ${Math.floor(skill.damage)}`);
        lines.push(`飞剑数量 ${skill.projectiles}`);
        lines.push(`穿透次数 ${skill.pierce}`);
        lines.push(`自动冷却 ${skill.cooldown.toFixed(2)}s`);
      } else if (skillId === "thunder") {
        lines.push(`落雷伤害 ${Math.floor(getThunderDamage(skill))}`);
        lines.push(`额外弹射 ${skill.chain}`);
        lines.push(`雷息加深 ${skill.deepenStacks || 0} 层`);
        lines.push(`自动冷却 ${skill.cooldown.toFixed(2)}s`);
      } else if (skillId === "flame") {
        lines.push(`火环伤害 ${Math.floor(skill.damage)}`);
        lines.push(`火环半径 ${Math.floor(skill.radius)}`);
        lines.push(`持续触发间隔 ${skill.tick.toFixed(2)}s`);
        lines.push(skill.burst ? "已习得焚爆" : "尚未习得焚爆");
      } else if (skillId === "guard") {
        lines.push(`护盾上限 ${Math.ceil(skill.maxShield)}`);
        lines.push(`当前护盾 ${Math.max(0, Math.ceil(skill.shield))}`);
        lines.push(`重铸时间 ${skill.recharge.toFixed(2)}s`);
        lines.push(skill.burst ? "破盾会触发震返冲击" : "尚未习得震返");
      }
      return lines;
    }

    function buildSkillInspectItems() {
      const items = state.player.skillOrder.map((id, index) => {
        const skill = state.player.skills[id];
        const template = skills[id];
        const slotIndex = index + 1;
        const activeProfile = getSkillActiveProfile(id, skill);
        const routeStage = getSkillRouteStage(id, skill);
        const route = routeStage?.route || activeProfile;
        const routeLabel = getSkillRouteLabel(id, skill);
        const activeLevel = getActiveLevel(skill);
        const activeText = activeLevel > 0
          ? (skill.activeTimer > 0 ? `主动 ${slotIndex} 键 ${formatSeconds(skill.activeTimer)}` : `主动 ${slotIndex} 键 已就绪`)
          : `主动 ${slotIndex} 键 Rank ${ACTIVE_UNLOCK_RANK} 解锁`;
        let detail = `Rank ${skill.rank}`;
        if (id === "guard") detail += ` | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`;
        else if (id === "sword") detail += ` | ${skill.projectiles} 剑`;
        else if (id === "thunder") detail += ` | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`;
        else if (id === "flame") detail += ` | 半径 ${Math.floor(skill.radius)}`;
        return {
          key: id,
          name: `${slotIndex}. ${template.name}`,
          detail: `${detail}<br>${activeProfile.activeName}<br>${activeText}`,
          badges: [routeLabel],
          stageClass: routeStage?.stage || "prototype",
          climaxText: route?.activeClimaxText || "",
          title: `${slotIndex}. ${template.name}`,
          meta: activeLevel > 0
            ? `${routeLabel} | 主动已解锁`
            : `${routeLabel} | 主动未解锁`,
          body: getRouteSummaryText(routeStage, activeProfile) || template.description,
          gains: getSkillInspectLines(id, skill, slotIndex),
          losses: activeLevel > 0 ? [] : [`主动术法需 Rank ${ACTIVE_UNLOCK_RANK} 才会解锁`],
          fixed: skill.route
            ? [
              "选择流派后不可更改",
              "另一条路线会移出本局词池",
              ...(route?.graduationSummary ? [route.graduationSummary] : []),
            ]
            : ["未分路前仍按当前原型出手，分路后会立刻切换对应主动技"],
        };
      });
      setInspectEntries("skill", items);
      return items;
    }

    function buildDestinyInspectItems() {
      const equipped = getEquippedDestinyEntries();
      const items = equipped.map((entry, index) => {
        const alignment = getEntryAlignment(entry);
        return {
          key: entry.id,
          title: `${index + 1}. ${entry.def.name}`,
          body: `${getAlignmentLabel(alignment)} | ${entry.def.tier}`,
          inspectable: true,
          meta: `${getAlignmentLabel(alignment)} | ${entry.def.tier} | ${entry.def.category}`,
          panelTitle: entry.def.name,
          panelBody: getDestinyText(entry.def, alignment),
          panelGains: [getDestinyText(entry.def, alignment)],
          panelLosses: [],
          panelFixed: [
            `当前道性 ${getAlignmentLabel(alignment)}`,
            `类型 ${entry.def.category}`,
            `品阶 ${entry.def.tier}`,
          ],
        };
      });
      while (items.length < DESTINY_SLOT_CAP) {
        items.push({
          key: `empty-${items.length}`,
          title: `空命格位 ${items.length + 1}`,
          body: "获得新命格后可选择镶嵌到这里。",
          inspectable: false,
        });
      }
      setInspectEntries(
        "destiny",
        items
          .filter((item) => item.inspectable)
          .map((item) => ({
            key: item.key,
            title: item.panelTitle,
            meta: item.meta,
            body: item.panelBody,
            gains: item.panelGains,
            losses: item.panelLosses,
            fixed: item.panelFixed,
          })),
      );
      return items;
    }

    function buildPathHintHtml() {
      const whiteRelease = state.whitePath.full
        ? "当前白槽已满，按 Q 可释放天息。"
        : `白槽 ${PATH_COMBAT.thresholds.tier1} 触发清明，${PATH_COMBAT.thresholds.tier2} 触发灵护，${PATH_COMBAT.thresholds.full} 满槽后按 Q 可释放天息。`;
      const blackRelease = state.blackPath.full
        ? "当前黑槽已满，按 E 可释放魔沸。"
        : `黑槽 ${PATH_COMBAT.thresholds.tier1} 触发煞燃，${PATH_COMBAT.thresholds.tier2} 触发魔驰，${PATH_COMBAT.thresholds.full} 满槽后按 E 可释放魔沸。`;
      return `
        <div class="path-hint-block">
          <strong class="path-hint-title">白槽说明</strong>
          <div class="path-hint-body">${whiteRelease}</div>
          <div class="path-hint-body">白道感悟：持续 4 秒未受伤后，每 6 秒额外获得 3 点白道值；生命高于 75% 时击杀精英或小 Boss，额外获得 8 点白道值。</div>
          <div class="path-hint-body">白槽每累计满 1 次，点化机会 +1。当前白槽累计提供 ${state.whiteInfusionPoints} 次机会；点化统一从同一个命格池抽取，不消耗当前白槽。</div>
        </div>
        <div class="path-hint-block">
          <strong class="path-hint-title">黑槽说明</strong>
          <div class="path-hint-body">${blackRelease}</div>
          <div class="path-hint-body">黑道感悟：生命低于 45% 时完成击杀，额外获得 2 点黑道值，内置冷却 1.2 秒；近身击杀精英或小 Boss，额外获得 8 点黑道值。</div>
          <div class="path-hint-body">黑槽每累计满 1 次，点化机会 +1。当前黑槽累计提供 ${state.blackInfusionPoints} 次机会；点化统一从同一个命格池抽取，不消耗当前黑槽。</div>
        </div>
      `;
    }

    function buildHudViewModel() {
      const statusItems = buildStatusInspectItems();
      setInspectEntries("status", statusItems);
      const skillCards = buildSkillInspectItems();
      const destinyItems = buildDestinyInspectItems();
      const pathHintHtml = buildPathHintHtml();
      return {
        statusItems,
        skillCards,
        destinyItems,
        pathHintHtml,
      };
    }

    function bindContainer(container) {
      if (!container) return;
      const readSelection = (target) => {
        const node = target?.closest?.("[data-inspect-group][data-inspect-key]");
        if (!node || !container.contains(node)) return null;
        return {
          group: node.dataset.inspectGroup,
          key: node.dataset.inspectKey,
        };
      };
      container.addEventListener("mouseover", (event) => {
        const selection = readSelection(event.target);
        if (selection) setHoveredInspect(selection);
      });
      container.addEventListener("mouseout", (event) => {
        const selection = readSelection(event.target);
        const related = event.relatedTarget && readSelection(event.relatedTarget);
        if (selection && (!related || related.group !== selection.group || related.key !== selection.key)) {
          clearHoveredInspect(selection);
        }
      });
      container.addEventListener("focusin", (event) => {
        const selection = readSelection(event.target);
        if (selection) setHoveredInspect(selection);
      });
      container.addEventListener("focusout", (event) => {
        const selection = readSelection(event.target);
        const related = event.relatedTarget && readSelection(event.relatedTarget);
        if (selection && (!related || related.group !== selection.group || related.key !== selection.key)) {
          clearHoveredInspect(selection);
        }
      });
      container.addEventListener("click", (event) => {
        const selection = readSelection(event.target);
        if (selection) togglePinnedInspect(selection);
      });
    }

    // Keep skill copy effect-focused: only branch choice cards explain route branching.
    function getSkillInspectLines(skillId, skill, slotIndex) {
      const lines = [`当前 Rank ${skill.rank}`];
      const activeProfile = getSkillActiveProfile(skillId, skill);
      const activeLevel = getActiveLevel(skill);
      lines.push(`当前主动 ${activeProfile.activeName}`);
      if (isActiveUnlocked(skill)) {
        lines.push(`主动技已解锁，按 ${slotIndex} 释放`);
        lines.push(skill.activeTimer > 0 ? `主动冷却剩余 ${formatSeconds(skill.activeTimer)}` : "主动技已就绪");
        lines.push(`主动等级 ${activeLevel}`);
      } else {
        lines.push(`主动技将在 Rank ${ACTIVE_UNLOCK_RANK} 解锁`);
      }
      if (skillId === "sword") {
        lines.push(`单发伤害 ${Math.floor(skill.damage)}`);
        lines.push(`飞剑数量 ${skill.projectiles}`);
        lines.push(`穿透次数 ${skill.pierce}`);
        lines.push(`自动冷却 ${skill.cooldown.toFixed(2)}s`);
      } else if (skillId === "thunder") {
        lines.push(`落雷伤害 ${Math.floor(getThunderDamage(skill))}`);
        lines.push(`额外弹射 ${skill.chain}`);
        lines.push(`雷息加深 ${skill.deepenStacks || 0} 层`);
        lines.push(`自动冷却 ${skill.cooldown.toFixed(2)}s`);
      } else if (skillId === "flame") {
        lines.push(`火环伤害 ${Math.floor(skill.damage)}`);
        lines.push(`火环半径 ${Math.floor(skill.radius)}`);
        lines.push(`持续触发间隔 ${skill.tick.toFixed(2)}s`);
        lines.push(skill.burst ? "已习得焚爆" : "尚未习得焚爆");
      } else if (skillId === "guard") {
        lines.push(`护盾上限 ${Math.ceil(skill.maxShield)}`);
        lines.push(`当前护盾 ${Math.max(0, Math.ceil(skill.shield))}`);
        lines.push(`重铸时间 ${skill.recharge.toFixed(2)}s`);
        lines.push(skill.burst ? "破盾会触发震返冲击" : "尚未习得震返");
      }
      return lines;
    }

    function buildSkillInspectItems() {
      const items = state.player.skillOrder.map((id, index) => {
        const skill = state.player.skills[id];
        const template = skills[id];
        const slotIndex = index + 1;
        const activeProfile = getSkillActiveProfile(id, skill);
        const routeStage = getSkillRouteStage(id, skill);
        const activeLevel = getActiveLevel(skill);
        const activeText = activeLevel > 0
          ? (skill.activeTimer > 0 ? `主动 ${slotIndex} 键 ${formatSeconds(skill.activeTimer)}` : `主动 ${slotIndex} 键 已就绪`)
          : `主动 ${slotIndex} 键 Rank ${ACTIVE_UNLOCK_RANK} 解锁`;
        let detail = `Rank ${skill.rank}`;
        if (id === "guard") detail += ` | 护盾 ${Math.max(0, Math.ceil(skill.shield))}`;
        else if (id === "sword") detail += ` | ${skill.projectiles} 剑`;
        else if (id === "thunder") detail += ` | 伤害 ${Math.floor(getThunderDamage(skill))} | 链 ${skill.chain}`;
        else if (id === "flame") detail += ` | 半径 ${Math.floor(skill.radius)}`;
        return {
          key: id,
          name: `${slotIndex}. ${template.name}`,
          detail: `${detail}<br>${activeProfile.activeName}<br>${activeText}`,
          badges: skill.route ? [getSkillRouteLabel(id, skill)] : [],
          stageClass: routeStage?.stage || "prototype",
          climaxText: "",
          title: `${slotIndex}. ${template.name}`,
          meta: activeLevel > 0
            ? `当前主动：${activeProfile.activeName}`
            : `当前主动：${activeProfile.activeName} | Rank ${ACTIVE_UNLOCK_RANK} 解锁`,
          body: template.description,
          gains: getSkillInspectLines(id, skill, slotIndex),
          losses: activeLevel > 0 ? [] : [`主动技需 Rank ${ACTIVE_UNLOCK_RANK} 才会解锁`],
          fixed: [],
        };
      });
      setInspectEntries("skill", items);
      return items;
    }

    return {
      buildHudViewModel,
      bindContainer,
      syncSelection,
      renderPanel,
    };
  }

  global.GameInspectSystem = {
    createInspectSystem,
  };
})(window);
