(function initGameDestinyRuntime(global) {
  function createDestinyRuntime(deps) {
    const {
      state,
      metaState,
      DESTINY_RUNTIME_RULES,
      getSkillRouteState,
      grantBarrier,
      healPlayer,
      fillPath,
      pulse,
      setToast,
    } = deps;

    const WHITE_STATUS_NAMES = new Set(["清明", "灵护", "天息"]);
    const BLACK_STATUS_NAMES = new Set(["煞燃", "魔驰", "魔沸"]);
    const MAX_LOG_ENTRIES = 80;

    function ensureRuntimeState() {
      if (!state.destinyRuntime || typeof state.destinyRuntime !== "object") {
        state.destinyRuntime = {};
      }
      const runtime = state.destinyRuntime;
      runtime.seq = Number.isFinite(runtime.seq) ? runtime.seq : 0;
      runtime.log = Array.isArray(runtime.log) ? runtime.log : [];
      runtime.whitePointTotal = Number.isFinite(runtime.whitePointTotal) ? runtime.whitePointTotal : 0;
      runtime.blackPointTotal = Number.isFinite(runtime.blackPointTotal) ? runtime.blackPointTotal : 0;
      runtime.hpBand = runtime.hpBand || "safe";
      runtime.activeWhiteStatuses = Array.isArray(runtime.activeWhiteStatuses) ? runtime.activeWhiteStatuses : [];
      runtime.activeBlackStatuses = Array.isArray(runtime.activeBlackStatuses) ? runtime.activeBlackStatuses : [];
      runtime.whiteStability = runtime.whiteStability || {};
      runtime.whiteStability.active = !!runtime.whiteStability.active;
      runtime.whiteStability.stableTime = Number.isFinite(runtime.whiteStability.stableTime) ? runtime.whiteStability.stableTime : 0;
      runtime.whiteStability.lifeLossCount = Number.isFinite(runtime.whiteStability.lifeLossCount) ? runtime.whiteStability.lifeLossCount : 0;
      runtime.whiteStability.firstKillRegistered = !!runtime.whiteStability.firstKillRegistered;
      runtime.whiteStability.repairByStatus = runtime.whiteStability.repairByStatus && typeof runtime.whiteStability.repairByStatus === "object"
        ? runtime.whiteStability.repairByStatus
        : {};
      runtime.protectiveLayers = runtime.protectiveLayers || {};
      runtime.protectiveLayers.barrier = runtime.protectiveLayers.barrier || { active: false, value: 0 };
      runtime.protectiveLayers.guardShield = runtime.protectiveLayers.guardShield || { active: false, value: 0 };
      runtime.releaseSessions = runtime.releaseSessions || { white: null, black: null };
      runtime.highValueDrops = runtime.highValueDrops && typeof runtime.highValueDrops === "object" ? runtime.highValueDrops : {};
      runtime.highValueDropSerial = Number.isFinite(runtime.highValueDropSerial) ? runtime.highValueDropSerial : 0;
      runtime.recentLifePaymentUntil = Number.isFinite(runtime.recentLifePaymentUntil) ? runtime.recentLifePaymentUntil : 0;
      runtime.dandingTriggered = !!runtime.dandingTriggered;
      runtime.skillRewriteState = runtime.skillRewriteState && typeof runtime.skillRewriteState === "object"
        ? runtime.skillRewriteState
        : {};
      return runtime;
    }

    function hasEquippedDestiny(id) {
      return Array.isArray(metaState?.destiny?.equipped) && metaState.destiny.equipped.includes(id);
    }

    function getHpRatio() {
      return state.player.hp / Math.max(1, state.player.maxHp);
    }

    function getHpBand(ratio = getHpRatio()) {
      if (ratio >= DESTINY_RUNTIME_RULES.safeHpRatio) return "safe";
      if (ratio <= DESTINY_RUNTIME_RULES.dangerHpRatio) return "danger";
      return "normal";
    }

    function getAlignmentCounts() {
      const counts = { white: 0, black: 0, mixed: 0, technique: 0 };
      (metaState?.destiny?.equipped || []).forEach((id) => {
        const alignment = metaState?.destiny?.owned?.[id]?.alignment || "mixed";
        counts[alignment] = (counts[alignment] || 0) + 1;
      });
      return counts;
    }

    function hasWhiteBlackPair() {
      const counts = getAlignmentCounts();
      return counts.white > 0 && counts.black > 0;
    }

    function getMixedBonusMult() {
      return hasEquippedDestiny("hunyuan") && hasWhiteBlackPair()
        ? (DESTINY_RUNTIME_RULES.hunyuan?.mixedBonusMult || 1)
        : 1;
    }

    function getPureGainPenaltyMult() {
      return hasEquippedDestiny("hunyuan") && !hasWhiteBlackPair()
        ? (DESTINY_RUNTIME_RULES.hunyuan?.pureGainPenaltyMult || 1)
        : 1;
    }

    function hasProtectiveLayer() {
      return state.player.barrier > 0 || ((state.player.skills.guard?.shield || 0) > 0);
    }

    function pushUnique(list, value) {
      if (!list.includes(value)) list.push(value);
    }

    function removeValue(list, value) {
      const index = list.indexOf(value);
      if (index >= 0) list.splice(index, 1);
    }

    function cloneLogPayload(payload) {
      if (!payload || typeof payload !== "object") return payload;
      return JSON.parse(JSON.stringify(payload));
    }

    function log(type, payload = {}) {
      const runtime = ensureRuntimeState();
      runtime.seq += 1;
      runtime.log.push({
        seq: runtime.seq,
        time: Number(state.time.toFixed(2)),
        type,
        payload: cloneLogPayload(payload),
      });
      if (runtime.log.length > MAX_LOG_ENTRIES) {
        runtime.log.splice(0, runtime.log.length - MAX_LOG_ENTRIES);
      }
    }

    function grantPathFromDestiny(color, amount, context = {}) {
      const normalizedAmount = Math.max(0, amount || 0);
      if (normalizedAmount <= 0 || typeof fillPath !== "function") return;
      fillPath(color, normalizedAmount, {
        kind: `${color}_destiny_bonus`,
        source: "destiny_runtime",
        ...context,
      });
    }

    function repairBarrier(amount, source) {
      const normalizedAmount = Math.max(0, amount || 0);
      if (normalizedAmount <= 0) return false;
      const previousValue = state.player.barrier;
      grantBarrier(normalizedAmount);
      emit("protective_layer_changed", {
        layer: "barrier",
        previousValue,
        nextValue: state.player.barrier,
        source,
      });
      return state.player.barrier > previousValue;
    }

    function healPlayerFromDestiny(amount, source) {
      const normalizedAmount = Math.max(0, amount || 0);
      if (normalizedAmount <= 0 || typeof healPlayer !== "function") return false;
      const previousHp = state.player.hp;
      healPlayer(normalizedAmount, source);
      emit("hp_changed", {
        previousHp,
        nextHp: state.player.hp,
        source,
      });
      return state.player.hp > previousHp;
    }

    function triggerBloodBurst(payload) {
      const config = DESTINY_RUNTIME_RULES.xuezhan || {};
      const enemy = payload.enemy;
      if (!enemy || typeof pulse !== "function") return;
      let damage = config.burstDamage || 0;
      if (payload.enemyType === "boss") damage *= config.burstBossMult || 1;
      else if (payload.isHighValue) damage *= config.burstEliteMult || 1;
      if (payload.isExecuteKill) damage *= 1.12;
      pulse(enemy.x, enemy.y, config.burstRadius || 44, damage, "burst", false, {
        time: 0.24,
        duration: 0.24,
        routeStyle: "black-destiny",
      });
    }

    function emit(type, payload = {}) {
      switch (type) {
        case "path_gain_prepare":
          return handlePathGainPrepare(payload);
        case "path_gain_resolved":
          return handlePathGainResolved(payload);
        case "status_applied":
          return handleStatusApplied(payload);
        case "status_expired":
          return handleStatusExpired(payload);
        case "release_started":
          return handleReleaseStarted(payload);
        case "kill_resolved":
          return handleKillResolved(payload);
        case "high_value_drop_spawn":
          return handleHighValueDropSpawn(payload);
        case "drop_collected":
          return handleDropCollected(payload);
        case "protective_layer_changed":
          return handleProtectiveLayerChanged(payload);
        case "hp_changed":
          return handleHpChanged(payload);
        case "active_cast_started":
          return handleActiveCastStarted(payload);
        case "skill_learned":
          return handleSkillLearned(payload);
        case "skill_route_locked":
          return handleSkillRouteLocked(payload);
        case "destiny_loadout_changed":
          return handleDestinyLoadoutChanged(payload);
        default:
          log("runtime_unknown_event", { type, payload });
          return payload;
      }
    }

    function handlePathGainPrepare(payload) {
      const runtime = ensureRuntimeState();
      let amount = Math.max(0, payload.amount || 0);
      const modifiers = [];
      if (payload.color === "white" && hasEquippedDestiny("fulsheng")) {
        const safeThreshold = DESTINY_RUNTIME_RULES.fulsheng?.safeThreshold || DESTINY_RUNTIME_RULES.safeHpRatio;
        if (getHpRatio() >= safeThreshold || hasProtectiveLayer()) {
          amount *= DESTINY_RUNTIME_RULES.fulsheng?.safeGainMult || 1;
          modifiers.push("fulsheng_safe");
        }
      }
      if (payload.color === "black" && hasEquippedDestiny("fulsheng")) {
        amount *= DESTINY_RUNTIME_RULES.fulsheng?.blackGainPenaltyMult || 1;
        modifiers.push("fulsheng_black_penalty");
      }
      if (payload.color === "black" && hasEquippedDestiny("tiansha")) {
        if (getHpRatio() <= (DESTINY_RUNTIME_RULES.tiansha?.lowHpThreshold || DESTINY_RUNTIME_RULES.dangerHpRatio)) {
          amount *= DESTINY_RUNTIME_RULES.tiansha?.blackGainMult || 1;
          modifiers.push("tiansha_low_hp");
        }
        if (runtime.recentLifePaymentUntil > state.time) {
          amount *= DESTINY_RUNTIME_RULES.tiansha?.activePaymentGainMult || 1;
          modifiers.push("tiansha_recent_payment");
        }
      }
      amount *= getPureGainPenaltyMult();
      log("path_gain_prepare", {
        color: payload.color,
        amount,
        modifiers,
        context: payload.context || null,
      });
      return {
        ...payload,
        amount,
      };
    }

    function handlePathGainResolved(payload) {
      const runtime = ensureRuntimeState();
      const appliedAmount = Math.max(0, payload.appliedAmount || 0);
      if (payload.color === "white") runtime.whitePointTotal += appliedAmount;
      if (payload.color === "black") runtime.blackPointTotal += appliedAmount;
      const session = runtime.releaseSessions[payload.color];
      if (session) {
        session.pathGainDuring = (session.pathGainDuring || 0) + appliedAmount;
      }
      log("path_gain_resolved", {
        color: payload.color,
        requestedAmount: payload.requestedAmount || 0,
        finalAmount: payload.finalAmount || 0,
        appliedAmount,
        context: payload.context || null,
      });

      if (hasEquippedDestiny("danding") && !runtime.dandingTriggered && runtime.whitePointTotal >= (DESTINY_RUNTIME_RULES.danding?.whiteThreshold || Infinity)) {
        runtime.dandingTriggered = true;
        state.dandingTriggerCount = Math.max(state.dandingTriggerCount, 2);
        state.pendingFreeShopRefreshes += DESTINY_RUNTIME_RULES.danding?.shopRefreshes || 0;
        state.pendingForcedWhiteOffers += DESTINY_RUNTIME_RULES.danding?.forceWhiteOffers || 0;
        state.pendingWhiteDestinyDiscount = Math.max(
          state.pendingWhiteDestinyDiscount || 0,
          DESTINY_RUNTIME_RULES.danding?.whiteDiscount || 0,
        );
        setToast("丹鼎真解：已为下一商店备好白道机缘");
        log("danding_shop_ready", {
          whitePointTotal: runtime.whitePointTotal,
          pendingFreeShopRefreshes: state.pendingFreeShopRefreshes,
          pendingForcedWhiteOffers: state.pendingForcedWhiteOffers,
          pendingWhiteDestinyDiscount: state.pendingWhiteDestinyDiscount,
        });
      }

      if (hasEquippedDestiny("yinyang") && !payload.context?.mixedCatchup) {
        const ratioBase = hasWhiteBlackPair()
          ? (DESTINY_RUNTIME_RULES.yinyang?.pairedCatchupRatio || DESTINY_RUNTIME_RULES.yinyang?.catchupRatio || 0)
          : (DESTINY_RUNTIME_RULES.yinyang?.catchupRatio || 0);
        const ratio = ratioBase * getMixedBonusMult();
        if (ratio > 0) {
          const graceGap = hasWhiteBlackPair() ? (DESTINY_RUNTIME_RULES.yinyang?.pairedGraceGap || 0) : 0;
          if (payload.color === "white") {
            const gap = runtime.whitePointTotal - runtime.blackPointTotal;
            if (gap > 0 || (gap >= -graceGap && runtime.blackPointTotal < runtime.whitePointTotal)) {
              const catchup = Math.min(Math.ceil(appliedAmount * ratio), Math.max(1, Math.ceil(Math.max(gap, 1) * 0.6)));
              grantPathFromDestiny("black", catchup, {
                trigger: "yinyang_catchup",
                mixedCatchup: true,
              });
            }
          } else if (payload.color === "black") {
            const gap = runtime.blackPointTotal - runtime.whitePointTotal;
            if (gap > 0 || (gap >= -graceGap && runtime.whitePointTotal < runtime.blackPointTotal)) {
              const catchup = Math.min(Math.ceil(appliedAmount * ratio), Math.max(1, Math.ceil(Math.max(gap, 1) * 0.6)));
              grantPathFromDestiny("white", catchup, {
                trigger: "yinyang_catchup",
                mixedCatchup: true,
              });
            }
          }
        }
      }

      if (hasEquippedDestiny("taiji") && !payload.context?.taijiConverted) {
        const mixedMult = getMixedBonusMult();
        if (payload.color === "white") {
          const paired = hasWhiteBlackPair();
          const damageMult = paired
            ? (DESTINY_RUNTIME_RULES.taiji?.whiteOffenseDamageMultPaired || DESTINY_RUNTIME_RULES.taiji?.whiteOffenseDamageMult || 1)
            : (DESTINY_RUNTIME_RULES.taiji?.whiteOffenseDamageMult || 1);
          state.statuses = state.statuses.filter((status) => status.name !== "归元");
          state.statuses.push({
            name: "归元",
            duration: DESTINY_RUNTIME_RULES.taiji?.whiteOffenseDuration || 3.5,
            remaining: DESTINY_RUNTIME_RULES.taiji?.whiteOffenseDuration || 3.5,
            effects: {
              damageMult: 1 + ((damageMult - 1) * mixedMult),
            },
          });
          log("taiji_white_offense", {
            paired,
            damageMult: 1 + ((damageMult - 1) * mixedMult),
          });
        } else if (payload.color === "black") {
          const paired = hasWhiteBlackPair();
          const barrierGain = paired
            ? (DESTINY_RUNTIME_RULES.taiji?.blackBarrierGainPaired || DESTINY_RUNTIME_RULES.taiji?.blackBarrierGain || 0)
            : (DESTINY_RUNTIME_RULES.taiji?.blackBarrierGain || 0);
          const healPct = paired
            ? (DESTINY_RUNTIME_RULES.taiji?.blackHealPctPaired || DESTINY_RUNTIME_RULES.taiji?.blackHealPct || 0)
            : (DESTINY_RUNTIME_RULES.taiji?.blackHealPct || 0);
          if (!repairBarrier(barrierGain * mixedMult, "taiji_black_gain")) {
            healPlayerFromDestiny(state.player.maxHp * healPct * mixedMult, "taiji_black_gain");
          }
          log("taiji_black_guard", {
            paired,
            barrierGain: barrierGain * mixedMult,
            healPct: healPct * mixedMult,
          });
        }
      }

      return payload;
    }

    function handleStatusApplied(payload) {
      const runtime = ensureRuntimeState();
      if (WHITE_STATUS_NAMES.has(payload.name)) {
        pushUnique(runtime.activeWhiteStatuses, payload.name);
        runtime.whiteStability.active = true;
        runtime.whiteStability.repairByStatus[payload.name] = false;
      }
      if (BLACK_STATUS_NAMES.has(payload.name)) {
        pushUnique(runtime.activeBlackStatuses, payload.name);
      }
      log("status_applied", {
        name: payload.name,
        duration: payload.duration || 0,
        source: payload.source || null,
      });
      return payload;
    }

    function settleReleaseSession(color, extra = {}) {
      const runtime = ensureRuntimeState();
      const session = runtime.releaseSessions[color];
      if (!session) return null;
      const settled = {
        ...session,
        endedAt: state.time,
        endHpRatio: getHpRatio(),
        endHasProtectiveLayer: hasProtectiveLayer(),
        ...extra,
      };
      runtime.releaseSessions[color] = null;
      if (color === "white" && hasEquippedDestiny("fulsheng")) {
        let refund = DESTINY_RUNTIME_RULES.fulsheng?.qRefundBase || 0;
        if (!settled.protectiveLayerBroken && settled.endHasProtectiveLayer) {
          refund += DESTINY_RUNTIME_RULES.fulsheng?.qRefundStableBonus || 0;
        }
        if ((settled.endHpRatio || 0) >= (DESTINY_RUNTIME_RULES.fulsheng?.safeThreshold || DESTINY_RUNTIME_RULES.safeHpRatio)) {
          refund += DESTINY_RUNTIME_RULES.fulsheng?.qRefundStableBonus || 0;
        }
        refund += (settled.highValueKills || 0) * (DESTINY_RUNTIME_RULES.fulsheng?.qRefundHighValueKill || 0);
        refund = Math.ceil(refund);
        if (refund > 0) {
          grantPathFromDestiny("white", refund, {
            trigger: "fulsheng_release_refund",
          });
          log("fulsheng_release_refund", {
            refund,
            highValueKills: settled.highValueKills || 0,
            endHpRatio: settled.endHpRatio,
            protectiveLayerBroken: !!settled.protectiveLayerBroken,
          });
        }
      }
      if (color === "black" && hasEquippedDestiny("tiansha")) {
        const refund = Math.ceil((settled.kills || 0) * (DESTINY_RUNTIME_RULES.tiansha?.eKillRefund || 0));
        if (refund > 0) {
          grantPathFromDestiny("black", refund, {
            trigger: "tiansha_release_refund",
          });
          log("tiansha_release_refund", {
            refund,
            kills: settled.kills || 0,
          });
        }
      }
      log("release_ended", {
        color,
        statusName: settled.statusName,
        duration: Number((settled.endedAt - settled.startedAt).toFixed(2)),
        highValueKills: settled.highValueKills || 0,
        kills: settled.kills || 0,
        meleeKills: settled.meleeKills || 0,
        executeKills: settled.executeKills || 0,
        pathGainDuring: settled.pathGainDuring || 0,
        protectiveLayerBroken: !!settled.protectiveLayerBroken,
        hpBandStart: settled.startHpBand,
        hpBandEnd: getHpBand(),
      });
      return settled;
    }

    function handleStatusExpired(payload) {
      const runtime = ensureRuntimeState();
      if (WHITE_STATUS_NAMES.has(payload.name)) {
        removeValue(runtime.activeWhiteStatuses, payload.name);
        delete runtime.whiteStability.repairByStatus[payload.name];
        if (!runtime.activeWhiteStatuses.length) {
          runtime.whiteStability.active = false;
          runtime.whiteStability.stableTime = 0;
          runtime.whiteStability.lifeLossCount = 0;
          runtime.whiteStability.firstKillRegistered = false;
          runtime.whiteStability.repairByStatus = {};
        }
      }
      if (BLACK_STATUS_NAMES.has(payload.name)) {
        removeValue(runtime.activeBlackStatuses, payload.name);
      }
      log("status_expired", {
        name: payload.name,
        source: payload.source || null,
      });
      if (payload.name === "天息") settleReleaseSession("white", { reason: "status_expired" });
      if (payload.name === "魔沸") settleReleaseSession("black", { reason: "status_expired" });
      return payload;
    }

    function handleReleaseStarted(payload) {
      const runtime = ensureRuntimeState();
      runtime.releaseSessions[payload.color] = {
        color: payload.color,
        statusName: payload.statusName,
        source: payload.source || null,
        startedAt: state.time,
        startHpBand: getHpBand(),
        startHpRatio: getHpRatio(),
        startHasProtectiveLayer: hasProtectiveLayer(),
        protectiveLayerBroken: false,
        highValueKills: 0,
        kills: 0,
        meleeKills: 0,
        executeKills: 0,
        pathGainDuring: 0,
      };
      log("release_started", {
        color: payload.color,
        statusName: payload.statusName,
        source: payload.source || null,
      });
      return runtime.releaseSessions[payload.color];
    }

    function handleKillResolved(payload) {
      const runtime = ensureRuntimeState();
      const whiteSession = runtime.releaseSessions.white;
      const blackSession = runtime.releaseSessions.black;
      [whiteSession, blackSession].filter(Boolean).forEach((session) => {
        session.kills += 1;
        if (payload.isHighValue) session.highValueKills += 1;
        if (payload.isMeleeKill) session.meleeKills += 1;
        if (payload.isExecuteKill) session.executeKills += 1;
      });

      log("kill_resolved", {
        enemyType: payload.enemyType,
        source: payload.source,
        isHighValue: !!payload.isHighValue,
        isMeleeKill: !!payload.isMeleeKill,
        isExecuteKill: !!payload.isExecuteKill,
        distanceToPlayer: payload.distanceToPlayer == null ? null : Number(payload.distanceToPlayer.toFixed(1)),
      });

      if (hasEquippedDestiny("qingxin") && runtime.activeWhiteStatuses.length) {
        const nextRepairStatus = runtime.activeWhiteStatuses.find((name) => !runtime.whiteStability.repairByStatus[name]);
        if (nextRepairStatus) {
          runtime.whiteStability.repairByStatus[nextRepairStatus] = true;
          runtime.whiteStability.firstKillRegistered = true;
          repairBarrier(DESTINY_RUNTIME_RULES.qingxin?.firstKillBarrierRepair || 0, `qingxin_${nextRepairStatus}_kill`);
          log("qingxin_first_kill_repair", {
            statusName: nextRepairStatus,
            barrier: Math.round(state.player.barrier),
          });
        }
      }

      if (hasEquippedDestiny("xuezhan") && runtime.activeBlackStatuses.length && (payload.isMeleeKill || payload.isExecuteKill)) {
        const baseGain = payload.isMeleeKill ? (DESTINY_RUNTIME_RULES.xuezhan?.meleeGainAmount || 0) : 0;
        const executeGain = payload.isExecuteKill ? (DESTINY_RUNTIME_RULES.xuezhan?.executeGainAmount || 0) : 0;
        const totalGain = baseGain + executeGain;
        if (totalGain > 0) {
          grantPathFromDestiny("black", totalGain, {
            trigger: "xuezhan_kill",
            enemyType: payload.enemyType,
            melee: !!payload.isMeleeKill,
            execute: !!payload.isExecuteKill,
          });
        }
        triggerBloodBurst(payload);
        log("xuezhan_kill_bonus", {
          enemyType: payload.enemyType,
          gain: totalGain,
          melee: !!payload.isMeleeKill,
          execute: !!payload.isExecuteKill,
        });
      }

      if (hasEquippedDestiny("heguang") && runtime.activeWhiteStatuses.length && payload.isHighValue) {
        grantPathFromDestiny("white", DESTINY_RUNTIME_RULES.heguang?.highValueGainAmount || 0, {
          trigger: "heguang_high_value_kill",
          enemyType: payload.enemyType,
        });
        log("heguang_high_value_kill", {
          enemyType: payload.enemyType,
          gain: DESTINY_RUNTIME_RULES.heguang?.highValueGainAmount || 0,
        });
      }

      if (hasEquippedDestiny("xianzhong") && payload.isHighValue) {
        grantPathFromDestiny("black", DESTINY_RUNTIME_RULES.xianzhong?.killGainAmount || 0, {
          trigger: "xianzhong_high_value_kill",
          enemyType: payload.enemyType,
        });
        log("xianzhong_high_value_kill", {
          enemyType: payload.enemyType,
          gain: DESTINY_RUNTIME_RULES.xianzhong?.killGainAmount || 0,
        });
      }

      return payload;
    }

    function handleHighValueDropSpawn(payload) {
      const runtime = ensureRuntimeState();
      const key = `hv-${runtime.highValueDropSerial + 1}`;
      runtime.highValueDropSerial += 1;
      runtime.highValueDrops[key] = {
        key,
        spawnedAt: state.time,
        enemyType: payload.enemyType,
        picked: false,
        heguangBoosted: hasEquippedDestiny("heguang") && runtime.activeWhiteStatuses.length,
      };
      (payload.drops || []).forEach((drop) => {
        drop.destinyRuntimeHighValueKey = key;
        if (runtime.highValueDrops[key].heguangBoosted) {
          drop.heguangBoosted = true;
        }
      });
      log("high_value_drop_spawn", {
        key,
        enemyType: payload.enemyType,
        dropKinds: (payload.drops || []).map((drop) => drop.kind),
      });
      return key;
    }

    function handleDropCollected(payload) {
      const runtime = ensureRuntimeState();
      const key = payload.drop?.destinyRuntimeHighValueKey;
      if (!key || !runtime.highValueDrops[key] || runtime.highValueDrops[key].picked) return payload;
      runtime.highValueDrops[key].picked = true;
      runtime.highValueDrops[key].pickedAt = state.time;
      if (runtime.highValueDrops[key].heguangBoosted && hasEquippedDestiny("heguang") && runtime.activeWhiteStatuses.length) {
        grantPathFromDestiny("white", DESTINY_RUNTIME_RULES.heguang?.dropGainAmount || 0, {
          trigger: "heguang_drop_pickup",
          enemyType: runtime.highValueDrops[key].enemyType,
        });
      }
      log("high_value_drop_collected", {
        key,
        enemyType: runtime.highValueDrops[key].enemyType,
        dropKind: payload.drop.kind,
        autoCollect: !!payload.autoCollect,
      });
      return payload;
    }

    function handleProtectiveLayerChanged(payload) {
      const runtime = ensureRuntimeState();
      const layerKey = payload.layer === "guard-shield" ? "guardShield" : "barrier";
      const layerState = runtime.protectiveLayers[layerKey];
      const previousValue = Math.max(0, payload.previousValue || 0);
      const nextValue = Math.max(0, payload.nextValue || 0);
      const eventType = nextValue <= 0
        ? (previousValue > 0 ? "broken" : "none")
        : previousValue <= 0
          ? "generated"
          : nextValue > previousValue
            ? "repaired"
            : "active";
      layerState.active = nextValue > 0;
      layerState.value = nextValue;
      if (eventType === "broken") {
        if (runtime.releaseSessions.white) runtime.releaseSessions.white.protectiveLayerBroken = true;
        if (runtime.releaseSessions.black) runtime.releaseSessions.black.protectiveLayerBroken = true;
      }
      if (eventType !== "none") {
        log("protective_layer_changed", {
          layer: payload.layer,
          type: eventType,
          previousValue,
          nextValue,
          source: payload.source || null,
        });
      }
      return {
        ...payload,
        type: eventType,
      };
    }

    function handleHpChanged(payload) {
      const runtime = ensureRuntimeState();
      const previousHp = Math.max(0, payload.previousHp == null ? state.player.hp : payload.previousHp);
      const nextHp = Math.max(0, payload.nextHp == null ? state.player.hp : payload.nextHp);
      if (runtime.whiteStability.active && nextHp < previousHp) {
        runtime.whiteStability.lifeLossCount += 1;
        runtime.whiteStability.stableTime = 0;
      }
      const previousBand = runtime.hpBand;
      const nextBand = getHpBand(nextHp / Math.max(1, state.player.maxHp));
      runtime.hpBand = nextBand;
      if (previousBand !== nextBand) {
        log("hp_band_changed", {
          from: previousBand,
          to: nextBand,
          source: payload.source || null,
          ratio: Number((nextHp / Math.max(1, state.player.maxHp)).toFixed(3)),
        });
      }
      return payload;
    }

    function handleActiveCastStarted(payload) {
      log("active_cast_started", {
        skillId: payload.skillId,
        routeId: payload.routeId || null,
        slotIndex: payload.slotIndex,
      });
      if (hasEquippedDestiny("ranshou")) {
        const runtime = ensureRuntimeState();
        const cost = state.player.maxHp * (DESTINY_RUNTIME_RULES.ranshou?.hpCostPct || 0);
        const previousHp = state.player.hp;
        state.player.hp = Math.max(1, state.player.hp - cost);
        runtime.recentLifePaymentUntil = state.time + (DESTINY_RUNTIME_RULES.ranshou?.recentPaymentWindow || 4);
        state.pendingActiveSacrificeBoost = DESTINY_RUNTIME_RULES.ranshou?.activeBoost || 1;
        emit("hp_changed", {
          previousHp,
          nextHp: state.player.hp,
          source: "ranshou_active_cast",
        });
        grantPathFromDestiny("black", DESTINY_RUNTIME_RULES.ranshou?.blackGainAmount || 0, {
          trigger: "ranshou_active_cast",
          skillId: payload.skillId,
        });
        setToast(`燃寿魔功：耗血 ${Math.ceil(cost)}，黑点与本次主动同步增强`);
        log("ranshou_active_cast", {
          skillId: payload.skillId,
          cost,
          gain: DESTINY_RUNTIME_RULES.ranshou?.blackGainAmount || 0,
        });
      }
      return payload;
    }

    function evaluateSkillRewriteState(skillId, reason = "manual") {
      const runtime = ensureRuntimeState();
      const skill = state.player.skills[skillId] || null;
      const routeState = skill ? getSkillRouteState(skillId, skill) : null;
      const entries = Object.values(DESTINY_RUNTIME_RULES.skillRewriteBindings || {})
        .filter((binding) => binding.skillId === skillId)
        .map((binding) => {
          const equipped = hasEquippedDestiny(binding.destinyId);
          let layer = "inactive";
          if (equipped && skill) {
            layer = skill.route && skill.route === binding.routeId ? "signature" : "base";
          }
          return {
            destinyId: binding.destinyId,
            name: binding.name,
            routeId: binding.routeId,
            equipped,
            layer,
          };
        });
      runtime.skillRewriteState[skillId] = {
        skillId,
        learned: !!skill,
        routeLocked: !!skill?.route,
        routeId: skill?.route || null,
        defaultRouteId: routeState?.defaultRouteId || null,
        entries,
        reason,
        updatedAt: state.time,
      };
      log("skill_rewrite_evaluated", {
        skillId,
        learned: !!skill,
        routeLocked: !!skill?.route,
        routeId: skill?.route || null,
        reason,
        equippedEntries: entries.filter((entry) => entry.equipped).map((entry) => ({
          destinyId: entry.destinyId,
          layer: entry.layer,
        })),
      });
      return runtime.skillRewriteState[skillId];
    }

    function handleSkillLearned(payload) {
      log("skill_learned", {
        skillId: payload.skillId,
      });
      return evaluateSkillRewriteState(payload.skillId, "skill_learned");
    }

    function handleSkillRouteLocked(payload) {
      log("skill_route_locked", {
        skillId: payload.skillId,
        routeId: payload.routeId,
      });
      return evaluateSkillRewriteState(payload.skillId, "skill_route_locked");
    }

    function handleDestinyLoadoutChanged(payload) {
      log("destiny_loadout_changed", {
        reason: payload.reason || "unknown",
        equipped: Array.isArray(metaState?.destiny?.equipped) ? [...metaState.destiny.equipped] : [],
      });
      Object.keys(state.player.skills || {}).forEach((skillId) => {
        evaluateSkillRewriteState(skillId, payload.reason || "destiny_loadout_changed");
      });
      return payload;
    }

    function tick(dt) {
      const runtime = ensureRuntimeState();
      if (runtime.whiteStability.active && runtime.activeWhiteStatuses.length) {
        runtime.whiteStability.stableTime += dt;
      }
      if (hasEquippedDestiny("qingxin") && runtime.activeWhiteStatuses.length) {
        const stableInterval = Math.max(0.5, DESTINY_RUNTIME_RULES.stableWhiteInterval || 6);
        while (runtime.whiteStability.stableTime >= stableInterval) {
          runtime.whiteStability.stableTime -= stableInterval;
          grantPathFromDestiny("white", DESTINY_RUNTIME_RULES.qingxin?.stableGainAmount || 0, {
            trigger: "qingxin_stable",
            statuses: [...runtime.activeWhiteStatuses],
          });
          log("qingxin_stable_gain", {
            gain: DESTINY_RUNTIME_RULES.qingxin?.stableGainAmount || 0,
            statuses: [...runtime.activeWhiteStatuses],
            lifeLossCount: runtime.whiteStability.lifeLossCount,
          });
        }
      }
      const currentBand = getHpBand();
      if (runtime.hpBand !== currentBand) {
        log("hp_band_changed", {
          from: runtime.hpBand,
          to: currentBand,
          source: "tick_sync",
          ratio: Number(getHpRatio().toFixed(3)),
        });
        runtime.hpBand = currentBand;
      }
    }

    function getSkillRewriteState(skillId) {
      const runtime = ensureRuntimeState();
      return runtime.skillRewriteState[skillId] || evaluateSkillRewriteState(skillId, "query");
    }

    ensureRuntimeState();

    return {
      emit,
      tick,
      getHpBand,
      getSkillRewriteState,
    };
  }

  global.GameDestinyRuntime = {
    createDestinyRuntime,
  };
})(window);
