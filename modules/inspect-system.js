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
      const lines = (entry.lines || [])
        .map((line) => `<div class="inspect-line">${escapeHtml(line)}</div>`)
        .join("");
      return `
        <div class="inspect-title">${escapeHtml(entry.title)}</div>
        <div class="inspect-meta">${escapeHtml(entry.meta || (pinned ? "已锁定" : "悬停查看"))}</div>
        <div class="inspect-body">${escapeHtml(entry.body || "")}</div>
        ${lines ? `<div class="inspect-lines">${lines}</div>` : ""}
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
      if (status.name === "清明") return "白道一段状态。强化拾取、吸附与击杀回复，让战场资源更容易滚起来。";
      if (status.name === "灵护") return "白道二段状态。提供护体与更强掉落吸附，结束时若血线健康还会返还部分白槽。";
      if (status.name === "天息") return "白槽满后手动释放的守成状态。提高生存与资源吸附，适合稳住场面。";
      if (status.name === "煞燃") return "黑道一段状态。提高伤害、施法频率与移速，但会持续损失生命。";
      if (status.name === "魔驰") return "黑道二段状态。主动术法转得更快，低血敌人更容易被斩杀。";
      if (status.name === "魔沸") return "黑槽满后手动释放的爆发状态。大幅强化输出、暴击与黑焰爆裂。";
      if (status.name === "归元") return "太极归元法激活后的互转增益。白道回复会短暂转成伤害提升。";
      if (effects.onKillHealPct) return "击杀触发型增益状态。";
      if (effects.damageMult) return "伤害强化状态。";
      return "战斗中的临时增益状态。";
    }

    function getStatusEffectLines(status) {
      const effects = status.effects || {};
      const lines = [`剩余时间 ${formatSeconds(status.remaining)}`];
      if (effects.pickupBonus) lines.push(`额外拾取范围 +${Math.round(effects.pickupBonus)}`);
      if (effects.attractRadius && effects.attractSpeed) lines.push(`掉落会在 ${Math.round(effects.attractRadius)} 范围内被吸向角色`);
      if (effects.eliteAttractSpeedMult) lines.push(`精英与Boss奖励吸附速度提升 ${formatSignedPercent(effects.eliteAttractSpeedMult - 1)}`);
      if (effects.onKillHealPct) lines.push(`击杀回复 ${formatPercent(effects.onKillHealPct)} 最大生命`);
      if (effects.damageMult) lines.push(`伤害 ${formatSignedPercent(effects.damageMult - 1)}`);
      if (effects.castMult) lines.push(`自动施法频率 ${formatSignedPercent(effects.castMult - 1)}`);
      if (effects.moveMult) lines.push(`移速 ${formatSignedPercent(effects.moveMult - 1)}`);
      if (effects.incomingMult) lines.push(describeIncomingMult(effects.incomingMult).trim());
      if (effects.activeCooldownRate) lines.push(`主动冷却流速 ${formatSignedPercent(effects.activeCooldownRate - 1)}`);
      if (effects.blackBurstRadius) lines.push(`击杀时触发黑焰爆裂，半径 ${Math.round(effects.blackBurstRadius)}`);
      if (effects.blackBurstRadiusMult) lines.push(`黑焰爆裂范围额外提升 ${formatSignedPercent(effects.blackBurstRadiusMult - 1)}`);
      if (effects.critChanceBonus) lines.push(`暴击率 ${formatSignedPercent(effects.critChanceBonus)}`);
      if (effects.drain) lines.push(`每秒损失 ${effects.drain.toFixed(1)} 生命`);
      if (effects.execute) {
        lines.push(
          `斩杀线：普通 ${formatPercent(effects.execute.normalThreshold)} / 精英 ${formatPercent(effects.execute.eliteThreshold)} / Boss ${formatPercent(effects.execute.bossThreshold)}`,
        );
      }
      if (effects.requireBarrier) lines.push("需要护体存在时，灵护的掉落吸附效果才会完全生效");
      return lines;
    }

    function buildStatusInspectItems() {
      const items = state.statuses.map((status) => ({
        key: `status-${status.name}`,
        label: `${status.name} ${formatSeconds(status.remaining)}`,
        title: `状态：${status.name}`,
        meta: `剩余 ${formatSeconds(status.remaining)}`,
        body: getStatusDescription(status),
        lines: getStatusEffectLines(status),
      }));
      if (state.player.barrier > 0) {
        items.push({
          key: "barrier",
          label: `护体 ${Math.ceil(state.player.barrier)}`,
          title: "护体",
          meta: `当前护体 ${Math.ceil(state.player.barrier)}`,
          body: "护体会优先承受伤害，是白道灵护、天息和金钟罩维持生存的重要资源。",
          lines: [
            `当前护体值 ${Math.ceil(state.player.barrier)}`,
            `生命 ${Math.ceil(state.player.hp)} / ${Math.ceil(state.player.maxHp)}`,
          ],
        });
      }
      if (state.blackMomentumStacks > 0 && state.blackMomentumTimer > 0) {
        items.push({
          key: "black-momentum",
          label: `袭势 ${state.blackMomentumStacks}层`,
          title: "袭势",
          meta: `剩余 ${formatSeconds(state.blackMomentumTimer)}`,
          body: "黑道连杀节奏状态。层数越高，当前爆发期的伤害越高。",
          lines: [
            `当前层数 ${state.blackMomentumStacks}`,
            `剩余时间 ${formatSeconds(state.blackMomentumTimer)}`,
            `每层额外伤害 ${formatSignedPercent(PATH_COMBAT.black.tier2AssaultStackMult)}`,
          ],
        });
      }
      return items;
    }

    function getSkillInspectLines(skillId, skill, slotIndex) {
      const lines = [`当前 Rank ${skill.rank}`];
      const activeProfile = getSkillActiveProfile(skillId, skill);
      lines.push(`当前路线 ${getSkillRouteLabel(skillId, skill)}`);
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
          detail: `${detail}<br>${routeLabel}<br>${activeProfile.activeName}<br>${activeText}`,
          title: `${slotIndex}. ${template.name}`,
          meta: activeLevel > 0 ? `${routeLabel} | 主动已解锁` : `${routeLabel} | 主动未解锁`,
          body: activeProfile.activeDescription || template.description,
          lines: getSkillInspectLines(id, skill, slotIndex),
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
          panelLines: [
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
            lines: item.panelLines,
          })),
      );
      return items;
    }

    function buildPathHintHtml() {
      const whiteRelease = state.whitePath.full
        ? "当前已满槽，可按 Q 立刻释放天息。"
        : "满槽后可按 Q 释放天息，获得护体、掉落吸附与击杀回复。";
      const blackRelease = state.blackPath.full
        ? "当前已满槽，可按 E 立刻释放魔沸。"
        : "满槽后可按 E 释放魔沸，获得爆发伤害、暴击率与黑焰范围强化。";
      return `
        <div class="path-hint-block">
          <strong class="path-hint-title">白槽满说明</strong>
          <div class="path-hint-body">${whiteRelease}</div>
          <div class="path-hint-body">白槽每累计满 1 次，白点化点 +1。当前白点 ${state.whiteInfusionPoints}，用于白道点化命格，不消耗当前白槽。</div>
        </div>
        <div class="path-hint-block">
          <strong class="path-hint-title">黑槽满说明</strong>
          <div class="path-hint-body">${blackRelease}</div>
          <div class="path-hint-body">黑槽每累计满 1 次，黑点化点 +1。当前黑点 ${state.blackInfusionPoints}，用于黑道点化命格，不消耗当前黑槽。</div>
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
