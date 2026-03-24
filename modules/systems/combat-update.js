(function initGameCombatSystems(global) {
  function createCombatSystems(deps) {
    const {
      state,
      keys,
      WIDTH,
      HEIGHT,
      enemies,
      RESULT_DEATH,
      clamp,
      distance,
      getMoveMult,
      getCombatTargets,
      distancePointToSegment,
      dealDamage,
      pickChainJumpTarget,
      nearestEnemyFromPoint,
      getGuardCounterEffect,
      reflectEnemyProjectile,
      hitPlayer,
      getTargetsWithinRadius,
      pulse,
      spawnEnemy,
      getPickupRange,
      getDropAttractProfile,
      markTargetHitFx,
      addXp,
      fillPath,
      onDropCollected,
      onHpChanged,
      onStatusExpired,
      maybeOpenPendingLevelUp,
      maybeHandlePostBossInfusion,
      openDestinyOffer,
      advanceCampaign,
      finishGame,
      updateSpawn,
      updateSkills,
      updatePathBehavior,
      refreshPhase,
      isGameplayRunning,
    } = deps;

    function markProjectileHitFx(projectile, target) {
      if (projectile.kind === "guard-counter-shot") {
        markTargetHitFx(target, "guard", projectile.routeStyle || "counter", projectile.palette || null, 0.28, 1.08);
        return;
      }
      if (projectile.kind === "sword" || projectile.kind === "sword-active" || projectile.kind === "sword-chain") {
        markTargetHitFx(
          target,
          "sword",
          projectile.routeStyle || null,
          projectile.palette || null,
          projectile.kind === "sword-active" ? 0.3 : 0.22,
          projectile.routeStyle === "greatsword" ? 1.12 : projectile.kind === "sword-active" ? 1.04 : 0.88,
        );
      }
    }

    function getPulseHitEffectKind(pulseItem) {
      if (
        pulseItem.kind === "flame"
        || pulseItem.kind === "burst"
        || pulseItem.kind === "meteor"
        || pulseItem.kind === "meteor-burst"
        || pulseItem.kind === "flame-zone-burst"
      ) {
        return "flame";
      }
      if (
        pulseItem.kind === "guard"
        || pulseItem.kind === "guard-counter-shock"
        || pulseItem.kind === "guard-counter-finale"
      ) {
        return "guard";
      }
      return null;
    }

    function getBossPhaseConfig(boss = state.boss) {
      if (!boss?.config?.phases?.length) return null;
      return boss.config.phases[Math.min((boss.phase || 1) - 1, boss.config.phases.length - 1)] || null;
    }

    function getBossSkillConfig(boss, skillId) {
      return boss?.config?.skills?.[skillId] || null;
    }

    function clearBossIntent(boss) {
      if (!boss) return;
      boss.intent = null;
      boss.intentLabel = "";
      boss.intentCategory = null;
      boss.intentCounterable = false;
    }

    function pushBossVisualPulse(x, y, radius, kind = "burst", extra = {}) {
      state.pulses.push({
        x,
        y,
        radius,
        damage: 0,
        kind,
        time: 0.24,
        duration: 0.24,
        hit: new Set(),
        affectsBoss: false,
        fromBoss: true,
        ...extra,
      });
    }

    function clampArenaPoint(x, y, margin = 24) {
      return {
        x: clamp(x, margin, WIDTH - margin),
        y: clamp(y, margin, HEIGHT - margin),
      };
    }

    function pushMiniBossVisual(enemy, radius) {
      state.pulses.push({
        x: enemy.x,
        y: enemy.y,
        radius,
        damage: 0,
        kind: "burst",
        time: 0.22,
        duration: 0.22,
        hit: new Set(),
        affectsBoss: false,
      });
    }

    function getMiniBossTeleportTarget(enemy, profile) {
      const baseAngle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
      const angleOffset = profile.teleportAngleOffset || 0.92;
      const sideSeed = Math.floor((state.time + enemy.radius) * 2.2) % 2 === 0 ? 1 : -1;
      const targetAngle = baseAngle + sideSeed * angleOffset;
      const targetDistance = profile.teleportDistance || 112;
      const target = clampArenaPoint(
        state.player.x + Math.cos(targetAngle) * targetDistance,
        state.player.y + Math.sin(targetAngle) * targetDistance,
        enemy.radius + 18,
      );
      const minRange = profile.teleportMinRange || 88;
      const targetDist = distance(target, state.player);
      if (targetDist >= minRange) return target;
      const scaled = clampArenaPoint(
        state.player.x + Math.cos(targetAngle) * minRange,
        state.player.y + Math.sin(targetAngle) * minRange,
        enemy.radius + 18,
      );
      return scaled;
    }

    function beginRangedEliteTeleport(enemy, profile) {
      const target = getMiniBossTeleportTarget(enemy, profile);
      if (!target) return false;
      const duration = profile.teleportTelegraph || 0.82;
      enemy.miniBossState = "teleport-windup";
      enemy.miniBossStateTimer = duration;
      enemy.miniBossTeleportTimer = profile.teleportCooldown || 5.2;
      enemy.miniBossTeleportTarget = target;
      enemy.miniBossTeleportMarkerUntil = state.time + duration;
      enemy.miniBossTeleportMarkerDuration = duration;
      enemy.miniBossTeleportRadius = profile.teleportDamageRadius || enemy.radius + 20;
      enemy.miniBossTelegraphDuration = duration;
      enemy.miniBossShieldUntil = state.time + duration;
      enemy.attackTimer = Math.max(enemy.attackTimer, duration);
      pushMiniBossVisual(enemy, enemy.radius + 24);
      return true;
    }

    function spawnEnemyProjectile(enemy, angle, speed, radius, damageMult = 1) {
      state.enemyProjectiles.push({
        kind: enemy.isMiniBoss ? "mini-boss-shot" : "enemy-shot",
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        damage: enemy.damage * damageMult,
        life: 3.5,
        color: enemy.color === "white" ? "rgba(255, 240, 210, 0.96)" : "rgba(255, 122, 122, 0.96)",
      });
    }

    function maybeFireMiniBossProjectile(enemy, profile, dt, dx, dy, dist) {
      if (!profile?.shotCooldown || !profile?.projectileSpeed || !profile?.projectileCount) return false;
      enemy.miniBossShotTimer = (enemy.miniBossShotTimer ?? (profile.shotCooldown * 0.6)) - dt;
      if (enemy.miniBossShotTimer > 0) return false;
      if (dist < (profile.minRangedDistance || 0)) return false;
      const baseAngle = Math.atan2(dy, dx);
      const projectileCount = profile.projectileCount || 1;
      const spread = profile.spread || 0;
      for (let i = 0; i < projectileCount; i += 1) {
        const angle = baseAngle + (i - (projectileCount - 1) / 2) * spread;
        spawnEnemyProjectile(
          enemy,
          angle,
          profile.projectileSpeed,
          profile.projectileRadius || 7,
          profile.projectileDamageMult || 1,
        );
      }
      enemy.miniBossShotTimer = profile.shotCooldown;
      pushMiniBossVisual(enemy, enemy.radius + 18);
      return true;
    }

    function moveEnemyTowardPlayer(enemy, dt, dx, dy, dist, speed, overlap, tangentScale = 0.55) {
      if (overlap > 0) {
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        enemy.x += tangentX * speed * tangentScale * dt;
        enemy.y += tangentY * speed * tangentScale * dt;
        return;
      }
      enemy.x += (dx / dist) * speed * dt;
      enemy.y += (dy / dist) * speed * dt;
    }

    function applyEnemyContactHit(enemy, cooldown) {
      if (distance(enemy, state.player) >= enemy.radius + state.player.radius || enemy.attackTimer > 0) return false;
      hitPlayer(enemy.damage, enemy);
      enemy.attackTimer = cooldown;
      return true;
    }

    function getMiniBossProfile(enemy, template) {
      if (enemy.miniBossConfig) return enemy.miniBossConfig;
      if (enemy.type === "ranged") {
        return {
          behavior: "ranged_elite",
          preferredRange: 220,
          retreatRange: 152,
          shotCooldown: template.shotCooldown || 1.65,
          projectileSpeed: template.projectileSpeed || 250,
          projectileCount: 3,
          spread: 0.2,
          strafeSpeedMult: 0.34,
          teleportCooldown: 5.2,
          teleportTelegraph: 0.82,
          teleportDistance: 112,
          teleportAngleOffset: 0.92,
          teleportTriggerRange: 260,
          teleportMinRange: 88,
          teleportRecovery: 0.35,
          meleeCooldown: template.meleeCooldown || 0.72,
        };
      }
      if (enemy.type === "charger") {
        return {
          behavior: "charger_elite",
          dashCooldown: template.dashCooldown || 2.7,
          windup: 0.4,
          dashDuration: 0.34,
          dashSpeedMult: template.dashSpeedMult || 3.7,
          dashDamageMult: 1.25,
          dashShockRadius: 78,
          dashShockDamageMult: 0.85,
          dashRecovery: 0.4,
          meleeCooldown: template.meleeCooldown || 0.82,
        };
      }
      return {
        behavior: "elite_guard",
        pulseCooldown: 2.8,
        pulseTelegraph: 0.78,
        pulseTriggerRange: 176,
        pulseRadius: 94,
        pulseDamageMult: 0.9,
        shieldDamageMult: 0.42,
        pulseRecovery: 0.45,
        orbitSpeedMult: 0.56,
        meleeCooldown: template.meleeCooldown || 0.82,
      };
    }

    function updateMiniBoss(enemy, template, dt, dx, dy, dist, overlap, speedMult) {
      const profile = getMiniBossProfile(enemy, template);
      const meleeCooldown = profile.meleeCooldown || template.meleeCooldown || 0.72;

      if (profile.behavior === "ranged_elite") {
        enemy.miniBossState = enemy.miniBossState || "idle";
        enemy.shotTimer = (enemy.shotTimer ?? profile.shotCooldown) - dt;
        enemy.miniBossTeleportTimer = (enemy.miniBossTeleportTimer ?? ((profile.teleportCooldown || 5.2) * 0.65)) - dt;
        const preferredRange = profile.preferredRange || 220;
        const retreatRange = profile.retreatRange || preferredRange * 0.7;
        const moveSpeed = enemy.speed * speedMult;
        if (enemy.miniBossState === "teleport-windup") {
          enemy.miniBossStateTimer = Math.max(0, (enemy.miniBossStateTimer || 0) - dt);
          if (enemy.miniBossStateTimer <= 0 && enemy.miniBossTeleportTarget) {
            pushMiniBossVisual(enemy, enemy.radius + 20);
            enemy.x = enemy.miniBossTeleportTarget.x;
            enemy.y = enemy.miniBossTeleportTarget.y;
            pushMiniBossVisual(enemy, enemy.miniBossTeleportRadius || enemy.radius + 28);
            if (
              (profile.teleportDamage || 0) > 0
              && distance(enemy, state.player) <= (enemy.miniBossTeleportRadius || enemy.radius + 28) + state.player.radius
            ) {
              hitPlayer(profile.teleportDamage, enemy);
            }
            enemy.miniBossState = "teleport-recover";
            enemy.miniBossStateTimer = profile.teleportRecovery || 0.35;
            enemy.miniBossTeleportMarkerUntil = 0;
            enemy.miniBossShieldUntil = 0;
            enemy.shotTimer = Math.min(enemy.shotTimer, Math.max(0.28, (profile.shotCooldown || 1.48) * 0.35));
          }
          const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
          enemy.x = clamped.x;
          enemy.y = clamped.y;
          return;
        }
        if (enemy.miniBossState === "teleport-recover") {
          enemy.miniBossStateTimer = Math.max(0, (enemy.miniBossStateTimer || 0) - dt);
          const tangentX = -dy / dist;
          const tangentY = dx / dist;
          enemy.x += tangentX * moveSpeed * 0.3 * dt;
          enemy.y += tangentY * moveSpeed * 0.3 * dt;
          if (enemy.miniBossStateTimer <= 0) {
            enemy.miniBossState = "idle";
            enemy.miniBossTeleportTarget = null;
          }
          const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
          enemy.x = clamped.x;
          enemy.y = clamped.y;
          applyEnemyContactHit(enemy, meleeCooldown);
          return;
        }
        if (dist > preferredRange + 14) {
          enemy.x += (dx / dist) * moveSpeed * dt;
          enemy.y += (dy / dist) * moveSpeed * dt;
        } else if (dist < retreatRange) {
          enemy.x -= (dx / dist) * moveSpeed * 0.88 * dt;
          enemy.y -= (dy / dist) * moveSpeed * 0.88 * dt;
        } else {
          const tangentX = -dy / dist;
          const tangentY = dx / dist;
          const strafeDir = Math.floor(state.time * 1.8) % 2 === 0 ? 1 : -1;
          enemy.x += tangentX * moveSpeed * (profile.strafeSpeedMult || 0.34) * strafeDir * dt;
          enemy.y += tangentY * moveSpeed * (profile.strafeSpeedMult || 0.34) * strafeDir * dt;
        }
        if (enemy.shotTimer <= 0) {
          const baseAngle = Math.atan2(dy, dx);
          const projectileCount = profile.projectileCount || 3;
          const spread = profile.spread || 0.2;
          for (let i = 0; i < projectileCount; i += 1) {
            const angle = baseAngle + (i - (projectileCount - 1) / 2) * spread;
            spawnEnemyProjectile(
              enemy,
              angle,
              profile.projectileSpeed || 250,
              profile.projectileRadius || 7,
              profile.projectileDamageMult || 1,
            );
          }
          enemy.shotTimer = profile.shotCooldown || 1.65;
          pushMiniBossVisual(enemy, enemy.radius + 18);
        }
        if (enemy.miniBossTeleportTimer <= 0 && dist <= (profile.teleportTriggerRange || 260)) {
          if (beginRangedEliteTeleport(enemy, profile)) return;
        }
        const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
        enemy.x = clamped.x;
        enemy.y = clamped.y;
        applyEnemyContactHit(enemy, meleeCooldown);
        return;
      }

      if (profile.behavior === "charger_elite") {
        enemy.miniBossState = enemy.miniBossState || "idle";
        enemy.miniBossStateTimer = enemy.miniBossStateTimer ?? ((profile.dashCooldown || 2.7) * 0.6);
        if (enemy.miniBossState === "windup") {
          enemy.miniBossStateTimer -= dt;
          enemy.x -= (dx / dist) * enemy.speed * speedMult * 0.16 * dt;
          enemy.y -= (dy / dist) * enemy.speed * speedMult * 0.16 * dt;
          if (enemy.miniBossStateTimer <= 0) {
            enemy.miniBossState = "dash";
            enemy.miniBossStateTimer = profile.dashDuration || 0.34;
            enemy.miniBossDashHit = false;
            enemy.miniBossDashVector = { x: dx / dist, y: dy / dist };
          }
        } else if (enemy.miniBossState === "dash") {
          const dashVector = enemy.miniBossDashVector || { x: dx / dist, y: dy / dist };
          const dashSpeed = enemy.speed * (profile.dashSpeedMult || 3.7) * speedMult;
          enemy.x += dashVector.x * dashSpeed * dt;
          enemy.y += dashVector.y * dashSpeed * dt;
          enemy.miniBossStateTimer -= dt;
          if (!enemy.miniBossDashHit && distance(enemy, state.player) < enemy.radius + state.player.radius + 6) {
            hitPlayer(enemy.damage * (profile.dashDamageMult || 1.25), enemy);
            enemy.miniBossDashHit = true;
          }
          if (enemy.miniBossStateTimer <= 0) {
            pushMiniBossVisual(enemy, profile.dashShockRadius || 78);
            if (distance(enemy, state.player) <= (profile.dashShockRadius || 78) + state.player.radius) {
              hitPlayer(enemy.damage * (profile.dashShockDamageMult || 0.85), enemy);
            }
            enemy.miniBossState = "recover";
            enemy.miniBossStateTimer = profile.dashRecovery || 0.4;
            enemy.attackTimer = Math.max(enemy.attackTimer, profile.dashRecovery || 0.4);
          }
        } else if (enemy.miniBossState === "recover") {
          enemy.miniBossStateTimer -= dt;
          maybeFireMiniBossProjectile(enemy, profile, dt, dx, dy, dist);
          if (enemy.miniBossStateTimer <= 0) {
            enemy.miniBossState = "idle";
            enemy.miniBossStateTimer = profile.dashCooldown || 2.7;
          }
        } else {
          enemy.miniBossStateTimer -= dt;
          moveEnemyTowardPlayer(enemy, dt, dx, dy, dist, enemy.speed * speedMult * 0.9, overlap, 0.48);
          maybeFireMiniBossProjectile(enemy, profile, dt, dx, dy, dist);
          if (enemy.miniBossStateTimer <= 0) {
            enemy.miniBossState = "windup";
            enemy.miniBossStateTimer = profile.windup || 0.4;
            enemy.miniBossDashVector = { x: dx / dist, y: dy / dist };
            pushMiniBossVisual(enemy, enemy.radius + 22);
          }
          applyEnemyContactHit(enemy, meleeCooldown);
        }
        const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
        enemy.x = clamped.x;
        enemy.y = clamped.y;
        return;
      }

      enemy.miniBossState = enemy.miniBossState || "idle";
      if (enemy.miniBossState === "pulse-windup") {
        enemy.miniBossStateTimer = Math.max(0, (enemy.miniBossStateTimer || 0) - dt);
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        enemy.x += tangentX * enemy.speed * speedMult * 0.26 * dt;
        enemy.y += tangentY * enemy.speed * speedMult * 0.26 * dt;
        if (enemy.miniBossStateTimer <= 0) {
          enemy.miniBossPulseTimer = profile.pulseCooldown || 2.8;
          enemy.miniBossState = "idle";
          enemy.miniBossTelegraphUntil = 0;
          enemy.miniBossShieldUntil = 0;
          pushMiniBossVisual(enemy, profile.pulseRadius || 94);
          if (distance(enemy, state.player) <= (profile.pulseRadius || 94) + state.player.radius) {
            hitPlayer(enemy.damage * (profile.pulseDamageMult || 0.9), enemy);
          }
          enemy.attackTimer = Math.max(enemy.attackTimer, profile.pulseRecovery || 0.45);
        }
        const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
        enemy.x = clamped.x;
        enemy.y = clamped.y;
        return;
      }

      enemy.miniBossPulseTimer = (enemy.miniBossPulseTimer ?? ((profile.pulseCooldown || 2.8) * 0.75)) - dt;
      if (dist > (profile.pulseRadius || 94) * 0.72) {
        moveEnemyTowardPlayer(enemy, dt, dx, dy, dist, enemy.speed * speedMult, overlap, profile.orbitSpeedMult || 0.56);
      } else {
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        enemy.x += tangentX * enemy.speed * speedMult * (profile.orbitSpeedMult || 0.56) * dt;
        enemy.y += tangentY * enemy.speed * speedMult * (profile.orbitSpeedMult || 0.56) * dt;
      }
      maybeFireMiniBossProjectile(enemy, profile, dt, dx, dy, dist);
      if (enemy.miniBossPulseTimer <= 0 && dist <= (profile.pulseTriggerRange || 176)) {
        enemy.miniBossState = "pulse-windup";
        enemy.miniBossStateTimer = profile.pulseTelegraph || 0.78;
        enemy.miniBossTelegraphDuration = profile.pulseTelegraph || 0.78;
        enemy.miniBossTelegraphUntil = state.time + (profile.pulseTelegraph || 0.78);
        enemy.miniBossShieldUntil = state.time + (profile.pulseTelegraph || 0.78);
        enemy.miniBossShieldMult = profile.shieldDamageMult || 0.42;
        enemy.miniBossPulseRadius = profile.pulseRadius || 94;
      }
      const clamped = clampArenaPoint(enemy.x, enemy.y, enemy.radius + 12);
      enemy.x = clamped.x;
      enemy.y = clamped.y;
      applyEnemyContactHit(enemy, meleeCooldown);
    }

    function queueBossLaneStrike({
      boss,
      skillId,
      skill,
      angle,
      width,
      length,
      startDelay = 0,
    }) {
      const halfLength = length * 0.5;
      state.activeEffects.push({
        kind: "boss-lane-telegraph",
        x: boss.x,
        y: boss.y,
        startX: boss.x - Math.cos(angle) * halfLength,
        startY: boss.y - Math.sin(angle) * halfLength,
        endX: boss.x + Math.cos(angle) * halfLength,
        endY: boss.y + Math.sin(angle) * halfLength,
        width,
        time: skill.windup + 0.18,
        duration: skill.windup + 0.18,
        windup: skill.windup,
        damage: boss.damage * skill.damageMult,
        resolved: false,
        startDelay,
        fromBoss: true,
        skillId,
        category: skill.category,
      });
    }

    function queueBossZoneBurst({
      boss,
      skillId,
      skill,
      x,
      y,
      startDelay = 0,
      hazardDuration = 0,
      hazardTick = 0.5,
      hazardDamage = 0,
    }) {
      const point = clampArenaPoint(x, y, skill.radius + 8);
      state.activeEffects.push({
        kind: "boss-zone-telegraph",
        x: point.x,
        y: point.y,
        radius: skill.radius,
        time: skill.windup + 0.2,
        duration: skill.windup + 0.2,
        windup: skill.windup,
        damage: boss.damage * skill.damageMult,
        resolved: false,
        startDelay,
        fromBoss: true,
        skillId,
        category: skill.category,
        hazardDuration,
        hazardTick,
        hazardDamage,
      });
    }

    function queueBossRingCollapse(boss, skill, safeMode) {
      state.activeEffects.push({
        kind: "boss-ring-telegraph",
        x: boss.x,
        y: boss.y,
        innerRadius: skill.innerRadius,
        outerRadius: skill.outerRadius,
        safeMode,
        time: skill.windup + 0.24,
        duration: skill.windup + 0.24,
        windup: skill.windup,
        damage: boss.damage * skill.damageMult,
        resolved: false,
        fromBoss: true,
        skillId: "ringCollapse",
        category: skill.category,
      });
    }

    function queueBossConeTelegraph(boss, skill, angle, spread, radius) {
      state.activeEffects.push({
        kind: "boss-cone-telegraph",
        x: boss.x,
        y: boss.y,
        angle,
        spread,
        radius,
        time: skill.windup + 0.1,
        duration: skill.windup + 0.1,
        windup: skill.windup,
        fromBoss: true,
        skillId: boss.lastSkillId,
        category: skill.category,
      });
    }

    function spawnBossProjectileFan(boss, skill, projectileCount, spread, speed, radius) {
      const dx = state.player.x - boss.x;
      const dy = state.player.y - boss.y;
      const baseAngle = Math.atan2(dy, dx);
      for (let i = 0; i < projectileCount; i += 1) {
        const angle = baseAngle + (i - (projectileCount - 1) / 2) * spread;
        state.enemyProjectiles.push({
          kind: "boss-shot",
          fromBoss: true,
          counterable: skill.category === "counterable",
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius,
          damage: boss.damage * skill.damageMult,
          life: skill.projectileLife || 4,
          routeStyle: skill.category === "counterable" ? "counterable" : "uncounterable",
        });
      }
    }

    function startBossSkill(boss, skillId) {
      const skill = getBossSkillConfig(boss, skillId);
      if (!skill) return;
      boss.lastSkillId = skillId;
      let resolveDelay = 0;
      boss.intent = {
        skillId,
        timer: skill.windup,
        moveMult: skill.category === "counterable" ? 0.26 : 0.18,
      };
      boss.intentLabel = skill.name;
      boss.intentCategory = skill.category;
      boss.intentCounterable = skill.category === "counterable";
      const dx = state.player.x - boss.x;
      const dy = state.player.y - boss.y;
      const angleToPlayer = Math.atan2(dy, dx);
      if (skill.kind === "lane-sweep") {
        const laneCount = skill.laneCount + (boss.phase >= 2 && boss.config.id === "route-pressure" ? 1 : 0);
        resolveDelay = Math.max(0, laneCount - 1) * (skill.sequentialDelay || 0);
        for (let i = 0; i < laneCount; i += 1) {
          const angle = angleToPlayer + (i - (laneCount - 1) / 2) * skill.angleSpread;
          queueBossLaneStrike({
            boss,
            skillId,
            skill,
            angle,
            width: skill.laneWidth,
            length: skill.laneLength,
            startDelay: i * skill.sequentialDelay,
          });
        }
      } else if (skill.kind === "lane-cross") {
        resolveDelay = skill.sequentialDelay || 0.16;
        const baseAngle = angleToPlayer + (boss.config.id === "endgame-truth" && boss.phase >= 2 ? Math.PI * 0.25 : 0);
        queueBossLaneStrike({
          boss,
          skillId,
          skill,
          angle: baseAngle,
          width: skill.laneWidth,
          length: skill.laneLength,
          startDelay: 0,
        });
        queueBossLaneStrike({
          boss,
          skillId,
          skill,
          angle: baseAngle + Math.PI / 2,
          width: skill.laneWidth,
          length: skill.laneLength,
          startDelay: skill.sequentialDelay || 0.16,
        });
      } else if (skill.kind === "focus-burst" || skill.kind === "seal-zones") {
        const count = skill.zoneCount + (boss.config.id === "endgame-truth" ? boss.phase - 1 : 0);
        resolveDelay = Math.max(0, count - 1) * (skill.sequentialDelay || 0);
        const baseAngle = state.time * 1.7;
        for (let i = 0; i < count; i += 1) {
          const angle = baseAngle + (Math.PI * 2 * i) / count;
          const offset = i === 0 ? 0 : skill.spread;
          queueBossZoneBurst({
            boss,
            skillId,
            skill,
            x: state.player.x + Math.cos(angle) * offset,
            y: state.player.y + Math.sin(angle) * offset,
            startDelay: i * (skill.sequentialDelay || 0),
            hazardDuration: skill.hazardDuration || 0,
            hazardTick: skill.hazardTick || 0.5,
            hazardDamage: boss.damage * (skill.hazardDamageMult || 0),
          });
        }
      } else if (skill.kind === "ring-collapse") {
        boss.ringMode = boss.ringMode === "outer" ? "inner" : "outer";
        queueBossRingCollapse(boss, skill, boss.ringMode);
      } else if (skill.kind === "counter-fan") {
        const projectileCount = skill.projectileCount + (boss.config.id === "endgame-truth" ? boss.phase - 1 : 0);
        queueBossConeTelegraph(
          boss,
          skill,
          angleToPlayer,
          Math.max(0.16, skill.spread * (projectileCount * 0.7)),
          160,
        );
      } else if (skill.kind === "escort-call") {
        state.activeEffects.push({
          kind: "boss-cone-telegraph",
          x: boss.x,
          y: boss.y,
          angle: angleToPlayer,
          spread: 1.2,
          radius: skill.pulseRadius + 24,
          time: skill.windup,
          duration: skill.windup,
          windup: skill.windup,
          fromBoss: true,
          skillId,
          category: skill.category,
        });
      }
      boss.intent.timer = skill.windup + resolveDelay;
    }

    function resolveBossSkill(boss) {
      const intent = boss.intent;
      if (!intent) return;
      const skill = getBossSkillConfig(boss, intent.skillId);
      const phaseConfig = getBossPhaseConfig(boss);
      if (!skill) {
        clearBossIntent(boss);
        return;
      }
      if (skill.kind === "escort-call") {
        const pairCount = skill.summonPairs + (boss.phase >= 2 ? 1 : 0) + (boss.phase >= 3 ? 1 : 0);
        const summonTypes = ["ranged", "charger"];
        for (let i = 0; i < pairCount; i += 1) {
          const typeId = summonTypes[i % summonTypes.length];
          spawnEnemy(typeId, i % 2 === 0 ? "white" : "black");
        }
        if (distance(boss, state.player) <= skill.pulseRadius + state.player.radius) {
          hitPlayer(boss.damage * skill.damageMult, boss);
        }
        pushBossVisualPulse(boss.x, boss.y, skill.pulseRadius, "burst");
      } else if (skill.kind === "counter-fan") {
        const projectileCount = skill.projectileCount + (boss.config.id === "endgame-truth" ? boss.phase - 1 : 0);
        spawnBossProjectileFan(
          boss,
          skill,
          projectileCount,
          skill.spread,
          skill.projectileSpeed + (boss.phase - 1) * 14,
          skill.projectileRadius,
        );
      }
      boss.exposedTimer = Math.max(boss.exposedTimer || 0, skill.opening || 0);
      boss.attackTimer = Math.max(phaseConfig?.cooldown || 0.7, skill.recovery || 0.2);
      clearBossIntent(boss);
    }

    function updatePlayer(dt) {
      const moveX = ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0);
      const moveY = ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
      const len = Math.hypot(moveX, moveY) || 1;
      if (Math.hypot(moveX, moveY) > 0.1) {
        state.player.facingX = moveX / len;
        state.player.facingY = moveY / len;
      }
      const moveSpeed = state.player.speed * getMoveMult();
      state.player.x = clamp(state.player.x + (moveX / len) * moveSpeed * dt, 20, WIDTH - 20);
      state.player.y = clamp(state.player.y + (moveY / len) * moveSpeed * dt, 20, HEIGHT - 20);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.regen * dt);
      state.player.invulnTimer = Math.max(0, state.player.invulnTimer - dt);
    }

    function updateActiveEffects(dt) {
      state.activeEffects = state.activeEffects.filter((effect) => {
        if (effect.startDelay > 0) {
          effect.startDelay = Math.max(0, effect.startDelay - dt);
          return true;
        }
        effect.time -= dt;
        const elapsed = (effect.duration || 0) - effect.time;
        if (effect.kind === "bulwark-shell") {
          effect.x = state.player.x;
          effect.y = state.player.y;
        }
        if (effect.kind === "bulwark-last-stand") {
          effect.x = state.player.x;
          effect.y = state.player.y;
        }
        if (effect.kind === "greatsword-field") {
          effect.tickTimer -= dt;
          effect.oscillation += dt * 2.4;
          while (effect.tickTimer <= 0) {
            effect.tickTimer += effect.tickInterval;
            const start = { x: effect.startX, y: effect.startY };
            const end = { x: effect.endX, y: effect.endY };
            getCombatTargets().forEach((target) => {
              const nextAllowedAt = effect.hitCooldowns.get(target) || 0;
              if (nextAllowedAt > state.time) return;
              const distToLane = distancePointToSegment(target, start, end);
              if (distToLane > effect.width + target.radius) return;
              const heavyTarget = target.type === "boss" || target.isMiniBoss || target.type === "elite";
              const damageMult = target.type === "boss"
                ? 1.55 + effect.pressureBonus
                : heavyTarget
                  ? 1.3 + effect.pressureBonus
                  : 0.62;
              markTargetHitFx(
                target,
                "sword",
                effect.routeStyle || "greatsword",
                effect.palette || null,
                heavyTarget ? 0.3 : 0.24,
                heavyTarget ? 1.16 : 0.96,
              );
              dealDamage(target, effect.damage * damageMult, "sword-greatsword");
              effect.hitCooldowns.set(target, state.time + effect.tickInterval * (heavyTarget ? 0.72 : 1));
              state.pulses.push({
                x: target.x,
                y: target.y,
                radius: heavyTarget ? 26 : 18,
                damage: 0,
                kind: "greatsword-hit",
                time: 0.18,
                duration: 0.18,
                hit: new Set(),
                affectsBoss: false,
                angle: effect.angle,
                palette: effect.palette || null,
                routeStyle: "greatsword",
              });
            });
          }
        }
        if (effect.kind === "chain-lightning-storm") {
          effect.tickTimer -= dt;
          while (effect.tickTimer <= 0) {
            effect.tickTimer += effect.tickInterval;
            const source = effect.currentTarget || state.player;
            if (!getCombatTargets().length) break;
            if (effect.visited.size >= getCombatTargets().length) effect.visited.clear();
            const target = pickChainJumpTarget(source, effect);
            if (!target) break;
            const hitCount = effect.hitCounts.get(target) || 0;
            const damageScale = Math.pow(effect.decay, effect.jumpCount) * Math.pow(0.82, hitCount);
            markTargetHitFx(target, "thunder", effect.routeStyle || "chain", effect.palette || null, 0.26, 1.02);
            dealDamage(target, effect.damage * damageScale, "thunder-active-chain");
            effect.visited.add(target);
            effect.hitCounts.set(target, hitCount + 1);
            effect.currentTarget = target;
            effect.x = target.x;
            effect.y = target.y;
            effect.jumpCount = (effect.jumpCount + 1) % Math.max(1, effect.maxJumps);
            state.pulses.push({
              x: target.x,
              y: target.y,
              radius: 26,
              damage: 0,
              kind: "chain-arc",
              time: 0.16,
              duration: 0.16,
              hit: new Set(),
              affectsBoss: true,
              fromX: source.x,
              fromY: source.y,
              palette: effect.palette || null,
              routeStyle: "chain",
            });
            state.pulses.push({
              x: target.x,
              y: target.y,
              radius: 24,
              damage: 0,
              kind: "chain-node",
              time: 0.18,
              duration: 0.18,
              hit: new Set(),
              affectsBoss: true,
              palette: effect.palette || null,
              routeStyle: "chain",
            });
          }
        }
        if (effect.kind === "flame-zone") {
          effect.tickTimer -= dt;
          while (effect.tickTimer <= 0) {
            effect.tickTimer += effect.tickInterval;
            getCombatTargets().forEach((target) => {
              const nextAllowedAt = effect.hitCooldowns.get(target) || 0;
              if (nextAllowedAt > state.time) return;
              if (distance(target, effect) > effect.radius + target.radius) return;
              markTargetHitFx(target, "flame", effect.routeStyle || "zone", effect.palette || null, 0.3, 0.94);
              dealDamage(target, effect.damage, "flame-zone");
              target.burn = Math.max(target.burn || 0, effect.burnDuration || 1.7);
              target.slowUntil = Math.max(target.slowUntil || 0, state.time + effect.tickInterval + 0.08);
              target.slowMult = Math.min(target.slowMult || 1, 1 - effect.slow);
              effect.hitCooldowns.set(target, state.time + effect.tickInterval * 0.88);
            });
          }
        }
        if (effect.kind === "guard-counter-window") {
          effect.x = state.player.x;
          effect.y = state.player.y;
          effect.shockCooldown = Math.max(0, effect.shockCooldown - dt);
        }
        if (effect.kind === "boss-lane-telegraph" && !effect.resolved && elapsed >= effect.windup) {
          effect.resolved = true;
          const distToLane = distancePointToSegment(state.player, { x: effect.startX, y: effect.startY }, { x: effect.endX, y: effect.endY });
          if (distToLane <= effect.width * 0.5 + state.player.radius) {
            hitPlayer(effect.damage, { type: "boss", skillId: effect.skillId, category: effect.category });
          }
          pushBossVisualPulse((effect.startX + effect.endX) * 0.5, (effect.startY + effect.endY) * 0.5, effect.width * 0.72, "burst", {
            angle: Math.atan2(effect.endY - effect.startY, effect.endX - effect.startX),
          });
        }
        if (effect.kind === "boss-zone-telegraph" && !effect.resolved && elapsed >= effect.windup) {
          effect.resolved = true;
          if (distance(effect, state.player) <= effect.radius + state.player.radius) {
            hitPlayer(effect.damage, { type: "boss", skillId: effect.skillId, category: effect.category });
          }
          pushBossVisualPulse(effect.x, effect.y, effect.radius, "burst");
          if (effect.hazardDuration > 0) {
            state.activeEffects.push({
              kind: "boss-hazard-zone",
              x: effect.x,
              y: effect.y,
              radius: effect.radius,
              time: effect.hazardDuration,
              duration: effect.hazardDuration,
              tickTimer: effect.hazardTick || 0.5,
              tickInterval: effect.hazardTick || 0.5,
              damage: effect.hazardDamage || effect.damage * 0.35,
              fromBoss: true,
              skillId: effect.skillId,
              category: effect.category,
            });
          }
        }
        if (effect.kind === "boss-hazard-zone") {
          effect.tickTimer -= dt;
          while (effect.tickTimer <= 0) {
            effect.tickTimer += effect.tickInterval;
            if (distance(effect, state.player) <= effect.radius + state.player.radius) {
              hitPlayer(effect.damage, { type: "boss", skillId: effect.skillId, category: effect.category });
            }
          }
        }
        if (effect.kind === "boss-ring-telegraph" && !effect.resolved && elapsed >= effect.windup) {
          effect.resolved = true;
          const distToCenter = distance(effect, state.player);
          const isSafe = effect.safeMode === "inner"
            ? distToCenter <= effect.innerRadius + state.player.radius
            : distToCenter >= effect.outerRadius - state.player.radius;
          if (!isSafe) {
            hitPlayer(effect.damage, { type: "boss", skillId: effect.skillId, category: effect.category });
          }
          pushBossVisualPulse(effect.x, effect.y, effect.safeMode === "inner" ? effect.outerRadius : effect.innerRadius + 34, "burst");
        }
        if (effect.time <= 0 && effect.kind === "flame-zone" && effect.leaveEmbers && !effect.emberSpawned) {
          effect.emberSpawned = true;
          state.activeEffects.push({
            kind: "flame-zone",
            x: effect.x,
            y: effect.y,
            radius: effect.emberRadius || effect.radius * 0.72,
            time: effect.emberDuration || 3,
            duration: effect.emberDuration || 3,
            tickTimer: 0.05,
            tickInterval: Math.max(0.22, effect.tickInterval || 0.3),
            damage: effect.emberDamage || effect.damage * 0.58,
            slow: effect.emberSlow || 0,
            burnDuration: Math.max(1.6, (effect.burnDuration || 1.7) * 0.8),
            hitCooldowns: new Map(),
            placement: effect.placement || "embers",
            palette: effect.palette || null,
            routeStyle: "zone",
            isEmberField: true,
          });
        }
        if (effect.time <= 0 && effect.kind === "guard-counter-window") {
          deps.triggerGuardCounterFinale(effect);
          return false;
        }
        if (effect.time <= 0 && effect.kind === "bulwark-last-stand") {
          const guard = state.player.skills.guard;
          if (guard) {
            guard.shield = Math.min(guard.maxShield, guard.shield + (effect.restoreShield || 0));
          }
          state.pulses.push({
            x: state.player.x,
            y: state.player.y,
            radius: effect.radius || state.player.radius + 24,
            damage: 0,
            kind: "guard-reform",
            time: 0.3,
            duration: 0.3,
            hit: new Set(),
            affectsBoss: false,
            routeStyle: effect.routeStyle || "bulwark",
            palette: effect.palette || null,
          });
          return false;
        }
        return effect.time > 0;
      });
    }

    function updateProjectiles(dt) {
      function spawnProjectileImpact(projectile, target) {
        if (!projectile.impactKind) return;
        markProjectileHitFx(projectile, target);
        state.pulses.push({
          x: target.x,
          y: target.y,
          radius: projectile.impactKind === "guard-counter-hit" ? 18 : target.type === "boss" ? 24 : 18,
          damage: 0,
          kind: projectile.impactKind,
          time: 0.18,
          duration: 0.18,
          hit: new Set(),
          affectsBoss: false,
          angle: Math.atan2(projectile.vy, projectile.vx),
          routeStyle: projectile.routeStyle || null,
          palette: projectile.palette || null,
        });
      }

      state.projectiles = state.projectiles.filter((projectile) => {
        if (projectile.homing) {
          const target = nearestEnemyFromPoint(projectile);
          if (target) {
            const dx = target.x - projectile.x;
            const dy = target.y - projectile.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const desiredVx = (dx / dist) * projectile.speed;
            const desiredVy = (dy / dist) * projectile.speed;
            const turn = clamp(projectile.turnRate * dt, 0, 1);
            projectile.vx += (desiredVx - projectile.vx) * turn;
            projectile.vy += (desiredVy - projectile.vy) * turn;
          }
        }
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        let alive = projectile.life > 0 && projectile.x > -50 && projectile.x < WIDTH + 50 && projectile.y > -50 && projectile.y < HEIGHT + 50;
        state.enemies.forEach((enemy) => {
          if (!alive) return;
          if (distance(projectile, enemy) < projectile.radius + enemy.radius) {
            const vanishOnHit = projectile.kind === "sword-active" && projectile.routeStyle === "swarm";
            spawnProjectileImpact(projectile, enemy);
            dealDamage(enemy, projectile.damage, projectile.kind);
            if (vanishOnHit) alive = false;
            else if (projectile.pierce > 0) projectile.pierce -= 1;
            else alive = false;
          }
        });
        if (alive && state.boss && distance(projectile, state.boss) < projectile.radius + state.boss.radius) {
          const vanishOnHit = projectile.kind === "sword-active" && projectile.routeStyle === "swarm";
          spawnProjectileImpact(projectile, state.boss);
          dealDamage(state.boss, projectile.damage, projectile.kind);
          if (vanishOnHit) alive = false;
          else if (projectile.pierce > 0) projectile.pierce -= 1;
          else alive = false;
        }
        return alive;
      });

      state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        const counterEffect = getGuardCounterEffect();
        if (
          counterEffect
          && projectile.counterable !== false
          && distance(projectile, state.player) < counterEffect.radius + projectile.radius
        ) {
          reflectEnemyProjectile(projectile, counterEffect);
          return false;
        }
        if (distance(projectile, state.player) < projectile.radius + state.player.radius) {
          hitPlayer(projectile.damage, projectile);
          return false;
        }
        return projectile.life > 0;
      });
    }

    function updatePulses(dt) {
      state.pulses = state.pulses.filter((pulseItem) => {
        if (pulseItem.startDelay > 0) {
          pulseItem.startDelay = Math.max(0, pulseItem.startDelay - dt);
          return true;
        }
        if (pulseItem.followPlayer) {
          pulseItem.x = state.player.x;
          pulseItem.y = state.player.y;
        }
        if (pulseItem.kind === "thunderstorm") {
          pulseItem.tickTimer -= dt;
          while (pulseItem.tickTimer <= 0) {
            pulseItem.tickTimer += pulseItem.tickInterval;
            const targets = getTargetsWithinRadius(pulseItem, pulseItem.radius);
            if (!targets.length) break;
            const ordered = targets
              .sort((a, b) => distance(a, pulseItem) - distance(b, pulseItem))
              .slice(0, pulseItem.strikeCount);
            ordered.forEach((target, index) => {
              const heavyTarget = target.type === "boss" || target.isMiniBoss || target.type === "elite";
              state.pulses.push({
                x: target.x,
                y: target.y,
                radius: 24,
                damage: 0,
                kind: "storm-strike",
                time: 0.18,
                duration: 0.18,
                hit: new Set(),
                fromX: target.x + (index % 2 === 0 ? -16 : 16),
                fromY: -90 - index * 16,
                palette: pulseItem.palette || null,
                routeStyle: pulseItem.routeStyle || "storm",
              });
              markTargetHitFx(target, "thunder", pulseItem.routeStyle || "storm", pulseItem.palette || null, 0.3, 1.04);
              let damage = pulseItem.damage;
              if (target.type === "boss" && !pulseItem.bossOpenerConsumed) {
                damage *= pulseItem.bossOpenerMult || 1;
              } else if (heavyTarget && pulseItem.heavyFirstHitMult > 1 && !pulseItem.heavyTargetsHit?.has(target)) {
                damage *= pulseItem.heavyFirstHitMult;
                pulseItem.heavyTargetsHit?.add(target);
              }
              dealDamage(target, damage, "thunderstorm");
              if (target.type === "boss") pulseItem.bossOpenerConsumed = true;
            });
          }
        }
        pulseItem.time -= dt;
        const duration = pulseItem.duration || 0.18;
        const scale = 1 - pulseItem.time / duration;
        if (pulseItem.kind === "meteor" && !pulseItem.landed && scale >= (pulseItem.impactAt || 0.72)) {
          pulseItem.landed = true;
        }
        const hitRadius = pulseItem.radius * clamp(scale, 0.2, 1);
        if (pulseItem.kind === "bosswave" && !pulseItem.hit.has(state.player) && distance(pulseItem, state.player) <= hitRadius + state.player.radius) {
          pulseItem.hit.add(state.player);
          hitPlayer(pulseItem.damage);
        }
        state.enemies.forEach((enemy) => {
          if (pulseItem.hit.has(enemy)) return;
          if (distance(pulseItem, enemy) <= hitRadius + enemy.radius) {
            if (pulseItem.damage > 0 && (pulseItem.kind !== "meteor" || pulseItem.landed)) {
              pulseItem.hit.add(enemy);
              const effectKind = getPulseHitEffectKind(pulseItem);
              if (effectKind) {
                markTargetHitFx(enemy, effectKind, pulseItem.routeStyle || null, pulseItem.palette || null, 0.26, 0.94);
              }
              const flameMult = pulseItem.kind === "flame"
                && pulseItem.innerRadius > 0
                && distance(pulseItem, enemy) <= pulseItem.innerRadius + enemy.radius
                ? (pulseItem.innerDamageMult || 1)
                : 1;
              dealDamage(enemy, pulseItem.damage * flameMult, pulseItem.kind);
              if (pulseItem.kind === "flame") enemy.burn = pulseItem.burnDuration || 2.5;
              if (pulseItem.kind === "meteor") enemy.burn = pulseItem.burnDuration || 4;
            }
          }
        });
        if (pulseItem.affectsBoss && state.boss && !pulseItem.hit.has(state.boss) && distance(pulseItem, state.boss) <= hitRadius + state.boss.radius) {
          if (pulseItem.damage > 0 && (pulseItem.kind !== "meteor" || pulseItem.landed)) {
            pulseItem.hit.add(state.boss);
            const effectKind = getPulseHitEffectKind(pulseItem);
            if (effectKind) {
              markTargetHitFx(state.boss, effectKind, pulseItem.routeStyle || null, pulseItem.palette || null, 0.3, 1.04);
            }
            const flameMult = pulseItem.kind === "flame"
              && pulseItem.innerRadius > 0
              && distance(pulseItem, state.boss) <= pulseItem.innerRadius + state.boss.radius
              ? (pulseItem.innerDamageMult || 1)
              : 1;
            dealDamage(
              state.boss,
              pulseItem.damage * flameMult * (pulseItem.bossDamageMult || 1),
              pulseItem.kind,
            );
          }
        }
        return pulseItem.time > 0;
      });
    }

    function updateEnemies(dt) {
      state.enemies.forEach((enemy) => {
        const template = enemies[enemy.type];
        const speedMult = enemy.slowUntil > state.time ? Math.max(0.28, enemy.slowMult || 1) : 1;
        if (enemy.burn > 0) {
          enemy.burn -= dt;
          dealDamage(enemy, 8 * dt, "burn");
        }
        const dx = state.player.x - enemy.x;
        const dy = state.player.y - enemy.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const overlap = enemy.radius + state.player.radius - dist;
        enemy.attackTimer -= dt;
        if (enemy.isMiniBoss) {
          updateMiniBoss(enemy, template, dt, dx, dy, dist, overlap, speedMult);
          return;
        }
        if (enemy.type === "elite") {
          enemy.eliteState = enemy.eliteState || "idle";
          enemy.eliteHeavyTimer = (enemy.eliteHeavyTimer ?? ((template.heavyCooldown || 3.4) * 0.65)) - dt;
          if (enemy.eliteState === "heavy-windup") {
            enemy.eliteStateTimer = Math.max(0, (enemy.eliteStateTimer || 0) - dt);
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            enemy.x += tangentX * enemy.speed * speedMult * 0.18 * dt;
            enemy.y += tangentY * enemy.speed * speedMult * 0.18 * dt;
            if (enemy.eliteStateTimer <= 0) {
              enemy.eliteHeavyTelegraphUntil = 0;
              state.pulses.push({
                x: enemy.x,
                y: enemy.y,
                radius: template.heavyRadius || 88,
                damage: 0,
                kind: "burst",
                time: 0.24,
                duration: 0.24,
                hit: new Set(),
                affectsBoss: false,
              });
              if (distance(enemy, state.player) <= (template.heavyRadius || 88) + state.player.radius) {
                hitPlayer(enemy.damage * (template.heavyDamageMult || 1.9), enemy);
              }
              enemy.eliteState = "heavy-recover";
              enemy.eliteStateTimer = template.heavyRecovery || 0.4;
              enemy.attackTimer = Math.max(enemy.attackTimer, template.heavyRecovery || 0.4);
            }
            return;
          }
          if (enemy.eliteState === "heavy-recover") {
            enemy.eliteStateTimer = Math.max(0, (enemy.eliteStateTimer || 0) - dt);
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            enemy.x += tangentX * enemy.speed * speedMult * 0.26 * dt;
            enemy.y += tangentY * enemy.speed * speedMult * 0.26 * dt;
            if (enemy.eliteStateTimer <= 0) {
              enemy.eliteState = "idle";
            }
            return;
          }
          if (enemy.eliteHeavyTimer <= 0 && dist <= (template.heavyTriggerRange || 118) && enemy.attackTimer <= 0) {
            enemy.eliteState = "heavy-windup";
            enemy.eliteStateTimer = template.heavyWindup || 0.7;
            enemy.eliteHeavyTimer = template.heavyCooldown || 3.4;
            enemy.eliteHeavyTelegraphUntil = state.time + (template.heavyWindup || 0.7);
            enemy.eliteHeavyTelegraphDuration = template.heavyWindup || 0.7;
            enemy.eliteHeavyRadius = template.heavyRadius || 88;
            return;
          }
        }
        if (enemy.type === "ranged") {
          enemy.shotTimer -= dt;
          if (dist > (template.preferredRange || 160)) {
            enemy.x += (dx / dist) * enemy.speed * speedMult * dt;
            enemy.y += (dy / dist) * enemy.speed * speedMult * dt;
          }
          if (enemy.shotTimer <= 0) {
            state.enemyProjectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx: (dx / dist) * (template.projectileSpeed || 180),
              vy: (dy / dist) * (template.projectileSpeed || 180),
              radius: 6,
              damage: enemy.damage,
              life: 3,
            });
            enemy.shotTimer = template.shotCooldown || 1.8;
          }
        } else if (enemy.type === "charger") {
          enemy.dashTimer -= dt;
          const speed = (enemy.dashTimer < 0.28 ? enemy.speed * (template.dashSpeedMult || 2.1) : enemy.speed) * speedMult;
          if (overlap > 0) {
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            enemy.x += tangentX * enemy.speed * speedMult * 0.7 * dt;
            enemy.y += tangentY * enemy.speed * speedMult * 0.7 * dt;
          } else {
            enemy.x += (dx / dist) * speed * dt;
            enemy.y += (dy / dist) * speed * dt;
          }
          if (enemy.dashTimer <= 0) enemy.dashTimer = template.dashCooldown || 1.4;
        } else {
          if (overlap > 0) {
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            enemy.x += tangentX * enemy.speed * speedMult * 0.55 * dt;
            enemy.y += tangentY * enemy.speed * speedMult * 0.55 * dt;
          } else {
            enemy.x += (dx / dist) * enemy.speed * speedMult * dt;
            enemy.y += (dy / dist) * enemy.speed * speedMult * dt;
          }
        }
        if (overlap > 0 && enemy.attackTimer <= 0) {
          hitPlayer(enemy.damage, enemy);
          enemy.attackTimer = template.meleeCooldown || 0.5;
        }
      });
    }

    function updateBoss(dt) {
      if (!state.boss) return;
      const boss = state.boss;
      const dx = state.player.x - boss.x;
      const dy = state.player.y - boss.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const phaseConfig = getBossPhaseConfig(boss);
      const slowMult = boss.slowUntil > state.time ? Math.max(0.45, boss.slowMult || 1) : 1;
      boss.attackTimer = Math.max(0, boss.attackTimer - dt);
      boss.exposedTimer = Math.max(0, boss.exposedTimer - dt);
      boss.contactTimer = Math.max(0, boss.contactTimer - dt);
      let moveMult = (phaseConfig?.moveMult || 1) * slowMult;
      if (boss.intent?.moveMult != null) moveMult *= boss.intent.moveMult;
      if (boss.exposedTimer > 0) moveMult *= 0.28;
      const desiredRange = phaseConfig?.desiredRange || 0;
      if (desiredRange > 0) {
        const rangeDelta = dist - desiredRange;
        if (Math.abs(rangeDelta) > 16) {
          const direction = rangeDelta > 0 ? 1 : -0.72;
          boss.x += (dx / dist) * boss.speed * moveMult * direction * dt;
          boss.y += (dy / dist) * boss.speed * moveMult * direction * dt;
        } else {
          const tangentX = -dy / dist;
          const tangentY = dx / dist;
          const strafeDir = (Math.floor((state.time - (boss.phaseStartedAt || 0)) * 1.25) % 2 === 0) ? 1 : -1;
          boss.x += tangentX * boss.speed * moveMult * 0.32 * strafeDir * dt;
          boss.y += tangentY * boss.speed * moveMult * 0.32 * strafeDir * dt;
        }
      } else {
        boss.x += (dx / dist) * boss.speed * moveMult * dt;
        boss.y += (dy / dist) * boss.speed * moveMult * dt;
      }
      boss.x = clamp(boss.x, boss.radius + 10, WIDTH - boss.radius - 10);
      boss.y = clamp(boss.y, boss.radius + 10, HEIGHT - boss.radius - 10);
      if (distance(boss, state.player) < boss.radius + state.player.radius && boss.contactTimer <= 0) {
        hitPlayer(boss.damage * (boss.config?.contactDamageMult || 1), boss);
        boss.contactTimer = boss.config?.contactCooldown || enemies.boss.contactCooldown || 0.55;
      }
      if (boss.intent) {
        boss.intent.timer -= dt;
        if (boss.intent.timer <= 0) resolveBossSkill(boss);
        return;
      }
      if (boss.attackTimer > 0 || boss.exposedTimer > 0) return;
      const sequence = phaseConfig?.sequence || [];
      if (!sequence.length) return;
      const skillId = sequence[boss.sequenceCursor % sequence.length];
      boss.sequenceCursor += 1;
      startBossSkill(boss, skillId);
    }

    function updateDrops(dt) {
      if (state.pendingMiniBossReward) {
        state.drops.forEach((drop) => {
          drop.autoCollect = true;
        });
      }
      state.drops = state.drops.filter((drop) => {
        const dist = distance(drop, state.player);
        const pickupRange = getPickupRange();
        const attract = getDropAttractProfile(drop);
        const inAttractRange = attract.radius > 0 && dist < attract.radius;
        if (drop.autoCollect || inAttractRange || dist < pickupRange) {
          const baseSpeed = drop.autoCollect ? 960 : inAttractRange ? Math.max(320, attract.speed) : 320;
          const speed = baseSpeed * dt;
          drop.x += ((state.player.x - drop.x) / Math.max(1, dist)) * speed;
          drop.y += ((state.player.y - drop.y) / Math.max(1, dist)) * speed;
        }
        if (dist < state.player.radius + drop.radius + 4) {
          if (drop.kind === "xp") addXp(drop.value);
          if (typeof onDropCollected === "function") {
            onDropCollected(drop, {
              autoCollect: !!drop.autoCollect,
              inAttractRange,
            });
          }
          if (drop.kind === "path") fillPath(drop.color, drop.value, {
            kind: "drop_pickup",
            dropKind: drop.kind,
            isEliteReward: !!drop.isEliteReward,
            isMiniBossReward: !!drop.isMiniBossReward,
            highValueKey: drop.destinyRuntimeHighValueKey || null,
            autoCollect: !!drop.autoCollect,
          });
          return false;
        }
        return true;
      });
      if (state.pendingMiniBossReward && state.drops.length === 0) {
        if (state.currentModal) return;
        if (state.pendingLevelUps > 0) {
          maybeOpenPendingLevelUp();
          return;
        }
        state.pendingMiniBossReward = false;
        maybeHandlePostBossInfusion(() => openDestinyOffer({
          title: "道途进了一步",
          body: "击败小关首领后，从三枚命格中择一收入命盘，再进入下一场战斗。",
          rewardType: "smallBoss",
          rewardRunIndex: state.campaign.runIndex,
          onComplete: () => advanceCampaign(),
        }));
      }
    }

    function updateStatuses(dt) {
      state.statuses = state.statuses.filter((status) => {
        const previousHp = state.player.hp;
        status.remaining -= dt;
        if (status.effects.drain) {
          state.player.hp -= state.player.maxHp * status.effects.drain * dt;
          if (typeof onHpChanged === "function" && state.player.hp !== previousHp) {
            onHpChanged(`status_drain_${status.name}`, previousHp);
          }
          if (state.player.hp <= 0) finishGame(RESULT_DEATH);
        }
        if (status.remaining > 0) return true;
        if (typeof onStatusExpired === "function") {
          onStatusExpired(status.name, "status_timer");
        }
        if (typeof status.effects.onExpire === "function") status.effects.onExpire();
        return false;
      });
    }

    function update(dt) {
      if (!isGameplayRunning() || state.paused || state.manualPause) return;
      state.time += dt;
      updatePlayer(dt);
      updateSpawn(dt);
      updateSkills(dt);
      updateActiveEffects(dt);
      updateProjectiles(dt);
      updateEnemies(dt);
      updateBoss(dt);
      updatePulses(dt);
      updateDrops(dt);
      updateStatuses(dt);
      updatePathBehavior(dt);
      refreshPhase();
    }

    return {
      update,
    };
  }

  global.GameCombatSystems = {
    createCombatSystems,
  };
})(window);
