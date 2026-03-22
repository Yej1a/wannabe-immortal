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
        effect.time -= dt;
        if (effect.kind === "bulwark-shell") {
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
              target.burn = Math.max(target.burn || 0, effect.burnDuration);
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
        if (effect.time <= 0 && effect.kind === "guard-counter-window") {
          deps.triggerGuardCounterFinale(effect);
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
            spawnProjectileImpact(projectile, enemy);
            dealDamage(enemy, projectile.damage, projectile.kind);
            if (projectile.pierce > 0) projectile.pierce -= 1;
            else alive = false;
          }
        });
        if (alive && state.boss && distance(projectile, state.boss) < projectile.radius + state.boss.radius) {
          spawnProjectileImpact(projectile, state.boss);
          dealDamage(state.boss, projectile.damage, projectile.kind);
          if (projectile.pierce > 0) projectile.pierce -= 1;
          else alive = false;
        }
        return alive;
      });

      state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        const counterEffect = getGuardCounterEffect();
        if (counterEffect && distance(projectile, state.player) < counterEffect.radius + projectile.radius) {
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
              dealDamage(target, pulseItem.damage, "thunderstorm");
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
              dealDamage(enemy, pulseItem.damage, pulseItem.kind);
              if (pulseItem.kind === "flame") enemy.burn = 2.5;
              if (pulseItem.kind === "meteor") enemy.burn = 4;
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
            dealDamage(state.boss, pulseItem.damage, pulseItem.kind);
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
      const template = enemies.boss;
      const speedMult = boss.phase === 3 ? 1.4 : boss.phase === 2 ? 1.2 : 1;
      const slowMult = boss.slowUntil > state.time ? Math.max(0.45, boss.slowMult || 1) : 1;
      boss.x += (dx / dist) * enemies.boss.speed * speedMult * slowMult * dt;
      boss.y += (dy / dist) * enemies.boss.speed * speedMult * slowMult * dt;
      boss.attackTimer -= dt;
      if (distance(boss, state.player) < boss.radius + state.player.radius && boss.attackTimer <= 0.18) {
        hitPlayer(boss.damage, boss);
      }
      if (boss.attackTimer <= 0) {
        boss.pattern = (boss.pattern + 1) % 3;
        if (boss.pattern === 0) {
          pulse(boss.x, boss.y, template.waveRadius, boss.damage * template.waveDamageMult, "bosswave", false);
        } else if (boss.pattern === 1) {
          for (let i = 0; i < template.radialProjectileCount; i += 1) {
            const angle = (Math.PI * 2 * i) / template.radialProjectileCount;
            state.enemyProjectiles.push({
              x: boss.x,
              y: boss.y,
              vx: Math.cos(angle) * template.radialProjectileSpeed,
              vy: Math.sin(angle) * template.radialProjectileSpeed,
              radius: 7,
              damage: boss.damage * 0.52,
              life: 4,
            });
          }
        } else {
          for (let i = 0; i < template.fanProjectileCount; i += 1) {
            const angle = Math.atan2(dy, dx) + (i - (template.fanProjectileCount - 1) / 2) * 0.18;
            state.enemyProjectiles.push({
              x: boss.x,
              y: boss.y,
              vx: Math.cos(angle) * template.fanProjectileSpeed,
              vy: Math.sin(angle) * template.fanProjectileSpeed,
              radius: 8,
              damage: boss.damage * 0.62,
              life: 4,
            });
          }
          const summonCount = boss.phase === 3 ? template.summonCountPhase3 : boss.phase === 2 ? template.summonCountPhase2 : 0;
          for (let i = 0; i < summonCount; i += 1) {
            spawnEnemy(i % 2 === 0 ? "charger" : "ranged", Math.random() < 0.5 ? "white" : "black");
          }
        }
        boss.attackTimer = boss.phase === 1 ? template.attackCooldowns.phase1 : boss.phase === 2 ? template.attackCooldowns.phase2 : template.attackCooldowns.phase3;
      }
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
          if (drop.kind === "path") fillPath(drop.color, drop.value);
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
          onComplete: () => advanceCampaign(),
        }));
      }
    }

    function updateStatuses(dt) {
      state.statuses = state.statuses.filter((status) => {
        status.remaining -= dt;
        if (status.effects.drain) {
          state.player.hp -= state.player.maxHp * status.effects.drain * dt;
          if (state.player.hp <= 0) finishGame(RESULT_DEATH);
        }
        if (status.remaining > 0) return true;
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
