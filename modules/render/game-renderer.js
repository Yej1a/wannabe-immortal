(function initGameRenderer(global) {
  function createGameRenderer(deps) {
    const {
      state,
      dom,
      WIDTH,
      HEIGHT,
      COLORS,
      SKILL_ART,
      skillRouteTable,
      clamp,
      updateHud,
    } = deps;

    function getSkillRouteVfx(skillId, skill) {
      const routeConfig = skillRouteTable[skillId];
      const routeId = skill?.route || routeConfig?.defaultRoute;
      const route = routeId ? routeConfig?.routes?.[routeId] : null;
      return route?.vfx || {
        palette: SKILL_ART[skillId] || {},
        auto: {},
        active: {},
      };
    }

    function withAlpha(color, alpha, fallback = "255,255,255") {
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
        const value = color.slice(1);
        const r = Number.parseInt(value.slice(0, 2), 16);
        const g = Number.parseInt(value.slice(2, 4), 16);
        const b = Number.parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return `rgba(${fallback}, ${alpha})`;
    }

    function drawGrid(ctx) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
    }

    function drawArena(ctx) {
      const glow = 180 + Math.sin(state.time * 0.5) * 12;
      const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 320);
      gradient.addColorStop(0, "rgba(124, 224, 184, 0.06)");
      gradient.addColorStop(1, "rgba(124, 224, 184, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(WIDTH / 2, HEIGHT / 2, glow, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawDrops(ctx) {
      state.drops.forEach((drop) => {
        ctx.fillStyle = drop.kind === "xp" ? COLORS.xp : drop.color === "white" ? COLORS.white : COLORS.black;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function getTargetHitFx(target) {
      if (!target?.hitFx) return null;
      return target.hitFx.until > state.time ? target.hitFx : null;
    }

    function drawTargetStatusFx(ctx, target, scale = 1) {
      const burnAlpha = clamp(Math.min(target.burn || 0, 2.4) / 2.4, 0, 1);
      const slowAlpha = target.slowUntil > state.time
        ? clamp((target.slowUntil - state.time) / 1.4, 0, 1)
        : 0;
      const hitFx = getTargetHitFx(target);

      ctx.save();
      ctx.translate(target.x, target.y);

      if (burnAlpha > 0.02) {
        const burnRadius = target.radius + 6 * scale;
        ctx.fillStyle = withAlpha("#ff7e3a", 0.12 + burnAlpha * 0.16, "255, 126, 58");
        ctx.beginPath();
        ctx.arc(0, 0, burnRadius + 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        const tongues = Math.max(6, Math.round(8 * scale));
        for (let i = 0; i < tongues; i += 1) {
          const angle = (Math.PI * 2 * i) / tongues + state.time * 0.9;
          const inner = burnRadius - 2 * scale;
          const outer = burnRadius + 6 * scale + (i % 2) * 3 * scale;
          ctx.strokeStyle = withAlpha("#ffc36f", 0.18 + burnAlpha * 0.42, "255, 195, 111");
          ctx.lineWidth = 1.3 * scale;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }
      }

      if (slowAlpha > 0.02) {
        const slowRadius = target.radius + 10 * scale;
        ctx.strokeStyle = withAlpha("#b9e9ff", 0.14 + slowAlpha * 0.42, "185, 233, 255");
        ctx.lineWidth = 1.5 * scale;
        ctx.setLineDash([4 * scale, 5 * scale]);
        ctx.beginPath();
        ctx.arc(0, 0, slowRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 4; i += 1) {
          const angle = state.time * 0.6 + (Math.PI * 2 * i) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (slowRadius - 3 * scale), Math.sin(angle) * (slowRadius - 3 * scale));
          ctx.lineTo(Math.cos(angle) * (slowRadius + 5 * scale), Math.sin(angle) * (slowRadius + 5 * scale));
          ctx.stroke();
        }
      }

      if (hitFx) {
        const palette = hitFx.palette || {};
        const alpha = clamp((hitFx.until - state.time) / Math.max(0.01, hitFx.duration || 0.22), 0, 1);
        const intensity = hitFx.intensity || 1;
        const fxRadius = target.radius + (5 + intensity * 4) * scale;
        const primary = palette.primary || "#f4f4f4";
        const secondary = palette.secondary || "#d0d0d0";
        const accent = palette.accent || "#ffffff";
        if (hitFx.effectKind === "sword") {
          ctx.rotate(state.time * 0.8);
          if (hitFx.routeStyle === "greatsword") {
            ctx.strokeStyle = withAlpha(accent, alpha * 0.92, "255, 245, 220");
            ctx.lineWidth = 2.8 * scale;
            ctx.beginPath();
            ctx.moveTo(-fxRadius, -fxRadius * 0.42);
            ctx.lineTo(fxRadius * 0.95, fxRadius * 0.18);
            ctx.stroke();
            ctx.strokeStyle = withAlpha(primary, alpha * 0.58, "240, 201, 124");
            ctx.lineWidth = 5.4 * scale;
            ctx.beginPath();
            ctx.moveTo(-fxRadius * 0.72, fxRadius * 0.22);
            ctx.lineTo(fxRadius * 0.82, -fxRadius * 0.26);
            ctx.stroke();
          } else {
            for (let i = 0; i < 3; i += 1) {
              const angle = (Math.PI * 2 * i) / 3 + state.time * 0.35;
              const x = Math.cos(angle) * fxRadius * 0.7;
              const y = Math.sin(angle) * fxRadius * 0.7;
              ctx.globalAlpha = 0.18 + alpha * 0.6;
              drawBladeGlyph(ctx, x, y, angle, 0.42 * scale, primary, secondary);
            }
            ctx.globalAlpha = 1;
          }
        } else if (hitFx.effectKind === "thunder") {
          ctx.strokeStyle = withAlpha(secondary, alpha * 0.9, "89, 124, 255");
          ctx.lineWidth = hitFx.routeStyle === "chain" ? 2.4 * scale : 2.8 * scale;
          if (hitFx.routeStyle === "chain") {
            ctx.beginPath();
            ctx.arc(0, 0, fxRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 3; i += 1) {
              const offset = (i - 1) * 7 * scale;
              ctx.beginPath();
              ctx.moveTo(-fxRadius * 0.75, offset);
              ctx.lineTo(-fxRadius * 0.15, -offset * 0.5);
              ctx.lineTo(fxRadius * 0.22, offset);
              ctx.lineTo(fxRadius * 0.78, -offset * 0.35);
              ctx.stroke();
            }
          } else {
            ctx.beginPath();
            ctx.moveTo(0, -fxRadius);
            ctx.lineTo(0, fxRadius * 0.18);
            ctx.lineTo(-fxRadius * 0.28, fxRadius * 0.18);
            ctx.lineTo(fxRadius * 0.18, fxRadius);
            ctx.stroke();
            ctx.strokeStyle = withAlpha(primary, alpha * 0.58, "201, 219, 255");
            ctx.beginPath();
            ctx.arc(0, 0, fxRadius * 0.72, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (hitFx.effectKind === "flame") {
          if (hitFx.routeStyle === "zone") {
            ctx.strokeStyle = withAlpha(primary, alpha * 0.88, "255, 212, 142");
            ctx.lineWidth = 2 * scale;
            ctx.setLineDash([5 * scale, 4 * scale]);
            ctx.beginPath();
            ctx.arc(0, 0, fxRadius * 0.88, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = withAlpha(secondary, alpha * 0.5, "214, 90, 53");
            ctx.beginPath();
            ctx.arc(0, 0, fxRadius * 0.56, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            const rays = 7;
            ctx.strokeStyle = withAlpha(primary, alpha * 0.88, "255, 194, 120");
            ctx.lineWidth = 2.1 * scale;
            for (let i = 0; i < rays; i += 1) {
              const angle = (Math.PI * 2 * i) / rays + state.time * 0.15;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * (fxRadius * 0.22), Math.sin(angle) * (fxRadius * 0.22));
              ctx.lineTo(Math.cos(angle) * fxRadius, Math.sin(angle) * fxRadius);
              ctx.stroke();
            }
          }
          ctx.fillStyle = withAlpha(secondary, alpha * 0.18, "255, 114, 71");
          ctx.beginPath();
          ctx.arc(0, 0, fxRadius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (hitFx.effectKind === "guard") {
          ctx.strokeStyle = withAlpha(primary, alpha * 0.86, "231, 243, 255");
          ctx.lineWidth = 2.6 * scale;
          ctx.beginPath();
          ctx.arc(0, 0, fxRadius * 0.76, 0, Math.PI * 2);
          ctx.stroke();
          if (hitFx.routeStyle === "counter") {
            const rays = 6;
            for (let i = 0; i < rays; i += 1) {
              const angle = (Math.PI * 2 * i) / rays + state.time * 0.22;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * (fxRadius * 0.24), Math.sin(angle) * (fxRadius * 0.24));
              ctx.lineTo(Math.cos(angle) * fxRadius, Math.sin(angle) * fxRadius);
              ctx.stroke();
            }
          } else {
            for (let i = 0; i < 4; i += 1) {
              const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * (fxRadius * 0.58), Math.sin(angle) * (fxRadius * 0.58));
              ctx.lineTo(Math.cos(angle) * (fxRadius * 0.95), Math.sin(angle) * (fxRadius * 0.95));
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore();
    }

    function drawGreatswordBlade(ctx, {
      x,
      y,
      angle = 0,
      length,
      width,
      primary,
      secondary,
      accent,
      alpha = 1,
      glowStrength = 1,
      capstone = false,
    }) {
      const safeLength = Math.max(24, length);
      const safeWidth = Math.max(12, width);
      const halfWidth = safeWidth * 0.5;
      const bodyLength = safeLength * 0.86;
      const tipLength = safeLength - bodyLength;
      const innerHalfWidth = halfWidth * 0.76;
      const ridgeHalfWidth = halfWidth * 0.28;
      const outerGlowWidth = safeWidth * (1.34 + glowStrength * 0.22);
      const innerGlowWidth = safeWidth * (1.02 + glowStrength * 0.16);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.strokeStyle = withAlpha(primary, (0.05 + alpha * 0.09) * glowStrength, "255, 222, 138");
      ctx.lineWidth = outerGlowWidth;
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.06, 0);
      ctx.lineTo(bodyLength + tipLength * 0.55, 0);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(accent, (0.14 + alpha * 0.14) * glowStrength, "255, 244, 214");
      ctx.lineWidth = innerGlowWidth;
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.12, 0);
      ctx.lineTo(bodyLength, 0);
      ctx.stroke();

      const outerFill = ctx.createLinearGradient(0, 0, safeLength, 0);
      outerFill.addColorStop(0, withAlpha(secondary, 0.86 * alpha, "142, 97, 48"));
      outerFill.addColorStop(0.3, withAlpha(primary, 0.94 * alpha, "240, 201, 124"));
      outerFill.addColorStop(0.58, withAlpha(accent, 0.98 * alpha, "255, 241, 202"));
      outerFill.addColorStop(0.84, withAlpha(primary, 0.9 * alpha, "240, 201, 124"));
      outerFill.addColorStop(1, withAlpha(secondary, 0.88 * alpha, "142, 97, 48"));

      ctx.fillStyle = outerFill;
      ctx.beginPath();
      ctx.moveTo(0, -halfWidth);
      ctx.lineTo(bodyLength, -halfWidth * 0.94);
      ctx.lineTo(safeLength, 0);
      ctx.lineTo(bodyLength, halfWidth * 0.94);
      ctx.lineTo(0, halfWidth);
      ctx.lineTo(-safeWidth * 0.12, halfWidth * 0.28);
      ctx.lineTo(-safeWidth * 0.12, -halfWidth * 0.28);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = withAlpha(secondary, 0.74 * alpha, "142, 97, 48");
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -halfWidth);
      ctx.lineTo(bodyLength, -halfWidth * 0.94);
      ctx.lineTo(safeLength, 0);
      ctx.lineTo(bodyLength, halfWidth * 0.94);
      ctx.lineTo(0, halfWidth);
      ctx.lineTo(-safeWidth * 0.12, halfWidth * 0.28);
      ctx.lineTo(-safeWidth * 0.12, -halfWidth * 0.28);
      ctx.closePath();
      ctx.stroke();

      const innerFill = ctx.createLinearGradient(0, 0, safeLength, 0);
      innerFill.addColorStop(0, withAlpha(primary, 0.26 * alpha, "240, 201, 124"));
      innerFill.addColorStop(0.42, withAlpha(accent, 0.64 * alpha, "255, 241, 202"));
      innerFill.addColorStop(0.72, withAlpha(primary, 0.38 * alpha, "240, 201, 124"));
      innerFill.addColorStop(1, withAlpha(primary, 0.18 * alpha, "240, 201, 124"));
      ctx.fillStyle = innerFill;
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.04, -innerHalfWidth);
      ctx.lineTo(bodyLength - safeWidth * 0.1, -innerHalfWidth);
      ctx.lineTo(safeLength - tipLength * 0.62, 0);
      ctx.lineTo(bodyLength - safeWidth * 0.1, innerHalfWidth);
      ctx.lineTo(safeLength * 0.04, innerHalfWidth);
      ctx.lineTo(0, innerHalfWidth * 0.42);
      ctx.lineTo(0, -innerHalfWidth * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = withAlpha(accent, 0.62 * alpha, "255, 241, 202");
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.1, -ridgeHalfWidth);
      ctx.lineTo(bodyLength - safeWidth * 0.2, -ridgeHalfWidth);
      ctx.lineTo(safeLength - tipLength * 0.94, 0);
      ctx.lineTo(bodyLength - safeWidth * 0.2, ridgeHalfWidth);
      ctx.lineTo(safeLength * 0.1, ridgeHalfWidth);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = withAlpha(accent, 0.24 * alpha, "255, 241, 202");
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.06, 0);
      ctx.lineTo(safeLength - tipLength * 0.24, 0);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(primary, 0.24 * alpha, "240, 201, 124");
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(safeLength * 0.06, -halfWidth * 0.62);
      ctx.lineTo(bodyLength - safeWidth * 0.16, -halfWidth * 0.58);
      ctx.moveTo(safeLength * 0.06, halfWidth * 0.62);
      ctx.lineTo(bodyLength - safeWidth * 0.16, halfWidth * 0.58);
      ctx.stroke();

      if (capstone) {
        ctx.strokeStyle = withAlpha(accent, 0.3 * alpha, "255, 241, 202");
        ctx.lineWidth = safeWidth * 0.18;
        ctx.beginPath();
        ctx.moveTo(safeLength * 0.14, 0);
        ctx.lineTo(bodyLength - safeWidth * 0.22, 0);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawGreatswordField(ctx, effect) {
      const palette = effect.palette || {};
      const primary = palette.primary || "#ffde8a";
      const secondary = palette.secondary || "#966f36";
      const accent = palette.accent || "#fff4d6";
      const dx = effect.endX - effect.startX;
      const dy = effect.endY - effect.startY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const bladeWidth = effect.width * (1.78 + Math.sin(effect.oscillation) * 0.08);

      drawGreatswordBlade(ctx, {
        x: effect.startX,
        y: effect.startY,
        angle: effect.angle,
        length,
        width: bladeWidth,
        primary,
        secondary,
        accent,
        alpha: 0.88 + alpha * 0.12,
        glowStrength: 1.1 + (effect.capstone ? 0.18 : 0),
        capstone: effect.capstone,
      });
    }

    function drawFlameZoneEffect(ctx, effect) {
      const palette = effect.palette || {};
      const primary = palette.primary || "#ffd780";
      const secondary = palette.secondary || "#ff6b38";
      const glow = palette.glow || "#ff9d62";
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const phase = state.time * 2.8;
      const ringRadius = effect.radius * (0.94 + Math.sin(phase) * 0.02);
      ctx.save();
      ctx.translate(effect.x, effect.y);
      const heat = ctx.createRadialGradient(0, 0, effect.radius * 0.18, 0, 0, effect.radius + 18);
      heat.addColorStop(0, withAlpha(primary, 0.12 + alpha * 0.08, "255, 212, 124"));
      heat.addColorStop(0.55, withAlpha(secondary, 0.16 + alpha * 0.14, "255, 126, 58"));
      heat.addColorStop(1, withAlpha(glow, 0, "255, 72, 38"));
      ctx.fillStyle = heat;
      ctx.beginPath();
      ctx.arc(0, 0, effect.radius + 12, 0, Math.PI * 2);
      ctx.fill();

      const tongues = 16;
      for (let i = 0; i < tongues; i += 1) {
        const angle = (Math.PI * 2 * i) / tongues + phase * 0.22;
        const inner = effect.radius - 12 + Math.sin(phase + i) * 2;
        const outer = effect.radius + 10 + Math.sin(phase * 1.4 + i) * 4;
        ctx.strokeStyle = withAlpha(primary, 0.2 + alpha * 0.28, "255, 188, 92");
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }

      ctx.strokeStyle = withAlpha(primary, 0.5 + alpha * 0.26, "255, 215, 128");
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(secondary, 0.38 + alpha * 0.22, "255, 98, 40");
      ctx.lineWidth = effect.isEmberField ? 4.2 : 6.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(12, effect.radius - 9), 0, Math.PI * 2);
      ctx.stroke();
      if (effect.isEmberField) {
        ctx.strokeStyle = withAlpha(primary, 0.34 + alpha * 0.2, "255, 215, 128");
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, effect.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    function drawGuardCounterEffect(ctx, effect) {
      const palette = effect.palette || {};
      const primary = palette.primary || "#dcecff";
      const secondary = palette.secondary || "#82abeb";
      const accent = palette.accent || "#f0f8ff";
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const phase = state.time * 2.4;
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.strokeStyle = withAlpha(primary, 0.38 + alpha * 0.28, "220, 236, 255");
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.arc(0, 0, effect.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(secondary, 0.28 + alpha * 0.22, "130, 171, 235");
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const arcRadius = effect.radius - 12 + i * 10;
        ctx.beginPath();
        ctx.arc(0, 0, arcRadius, phase * 0.6 + i * 0.8, phase * 0.6 + i * 0.8 + Math.PI * 0.92);
        ctx.stroke();
      }

      const spokes = 8;
      ctx.strokeStyle = withAlpha(accent, 0.22 + alpha * 0.18, "240, 248, 255");
      ctx.lineWidth = 1.2;
      for (let i = 0; i < spokes; i += 1) {
        const angle = (Math.PI * 2 * i) / spokes + phase * 0.12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (effect.radius - 10), Math.sin(angle) * (effect.radius - 10));
        ctx.lineTo(Math.cos(angle) * (effect.radius + 8), Math.sin(angle) * (effect.radius + 8));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBulwarkShellEffect(ctx, effect) {
      const palette = effect.palette || {};
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.4 + progress * 0.6);
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.strokeStyle = withAlpha(palette.primary || "#f0e1b1", alpha * 0.9, "240, 225, 177");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.secondary || "#9eaed2", alpha * 0.6, "158, 174, 210");
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + progress * 0.18;
        const inner = radius - 8;
        const outer = radius + 10 + (i % 2) * 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBulwarkLastStandEffect(ctx, effect) {
      const palette = effect.palette || {};
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const pulse = 0.94 + Math.sin(state.time * 7.2) * 0.06;
      ctx.save();
      ctx.translate(effect.x, effect.y);
      const shell = ctx.createRadialGradient(0, 0, effect.radius * 0.3, 0, 0, effect.radius + 28);
      shell.addColorStop(0, withAlpha(palette.accent || "#fff6de", 0.1 + alpha * 0.12, "255, 246, 222"));
      shell.addColorStop(0.55, withAlpha(palette.primary || "#f0e1b1", 0.16 + alpha * 0.18, "240, 225, 177"));
      shell.addColorStop(1, withAlpha(palette.secondary || "#9eaed2", 0, "158, 174, 210"));
      ctx.fillStyle = shell;
      ctx.beginPath();
      ctx.arc(0, 0, effect.radius + 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = withAlpha(palette.primary || "#f0e1b1", 0.7 + alpha * 0.18, "240, 225, 177");
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, effect.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(palette.accent || "#fff6de", 0.42 + alpha * 0.22, "255, 246, 222");
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, effect.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawChainLightningEffect(ctx, effect) {
      if (!effect.currentTarget) return;
      const palette = effect.palette || {};
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      ctx.save();
      ctx.strokeStyle = withAlpha(palette.secondary || "#39bdf1", 0.36 + alpha * 0.28, "57, 189, 241");
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(effect.currentTarget.x, effect.currentTarget.y, 18 + Math.sin(state.time * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.primary || "#baf4ff", 0.24 + alpha * 0.24, "186, 244, 255");
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i += 1) {
        const t = i - 1;
        ctx.beginPath();
        ctx.moveTo(state.player.x, state.player.y + t * 6);
        ctx.lineTo((state.player.x + effect.currentTarget.x) / 2 + t * 10, (state.player.y + effect.currentTarget.y) / 2 - t * 8);
        ctx.lineTo(effect.currentTarget.x, effect.currentTarget.y - t * 5);
        ctx.stroke();
      }
      ctx.fillStyle = withAlpha(palette.accent || "#f2fdff", 0.2 + alpha * 0.16, "242, 253, 255");
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 14 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBossLaneTelegraph(ctx, effect) {
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      ctx.save();
      ctx.strokeStyle = effect.resolved
        ? withAlpha("#ffcc9b", 0.16 + alpha * 0.12, "255, 204, 155")
        : withAlpha("#ff7a5b", 0.22 + alpha * 0.24, "255, 122, 91");
      ctx.lineWidth = effect.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(effect.startX, effect.startY);
      ctx.lineTo(effect.endX, effect.endY);
      ctx.stroke();
      ctx.strokeStyle = effect.resolved
        ? withAlpha("#fff2d7", 0.14 + alpha * 0.08, "255, 242, 215")
        : withAlpha("#fff1d0", 0.36 + alpha * 0.24, "255, 241, 208");
      ctx.lineWidth = Math.max(2, effect.width * 0.14);
      ctx.beginPath();
      ctx.moveTo(effect.startX, effect.startY);
      ctx.lineTo(effect.endX, effect.endY);
      ctx.stroke();
      ctx.restore();
    }

    function drawBossZoneTelegraph(ctx, effect) {
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      ctx.save();
      ctx.fillStyle = effect.resolved
        ? withAlpha("#ff915e", 0.08 + alpha * 0.04, "255, 145, 94")
        : withAlpha("#ff714d", 0.08 + alpha * 0.1, "255, 113, 77");
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = effect.resolved
        ? withAlpha("#ffd1a2", 0.26 + alpha * 0.08, "255, 209, 162")
        : withAlpha("#ffd6ab", 0.48 + alpha * 0.22, "255, 214, 171");
      ctx.lineWidth = effect.resolved ? 2.2 : 3.2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawBossHazardZone(ctx, effect) {
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      const phase = state.time * 3.2;
      ctx.save();
      const gradient = ctx.createRadialGradient(effect.x, effect.y, effect.radius * 0.2, effect.x, effect.y, effect.radius + 10);
      gradient.addColorStop(0, withAlpha("#ffcf9c", 0.05 + alpha * 0.06, "255, 207, 156"));
      gradient.addColorStop(0.58, withAlpha("#ff8f57", 0.12 + alpha * 0.1, "255, 143, 87"));
      gradient.addColorStop(1, withAlpha("#6f1421", 0.02 + alpha * 0.12, "111, 20, 33"));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + Math.sin(phase) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha("#ffd7a6", 0.2 + alpha * 0.18, "255, 215, 166");
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawBossRingTelegraph(ctx, effect) {
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.strokeStyle = withAlpha("#ff8f61", 0.4 + alpha * 0.22, "255, 143, 97");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, effect.innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, effect.outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha("#ffe1bc", 0.34 + alpha * 0.18, "255, 225, 188");
      ctx.lineWidth = 2;
      const safeRadius = effect.safeMode === "inner" ? effect.innerRadius : effect.outerRadius;
      ctx.beginPath();
      ctx.arc(0, 0, safeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawBossConeTelegraph(ctx, effect) {
      const alpha = clamp(effect.time / Math.max(0.01, effect.duration), 0, 1);
      ctx.save();
      ctx.fillStyle = withAlpha("#ff9e74", 0.08 + alpha * 0.08, "255, 158, 116");
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.arc(effect.x, effect.y, effect.radius, effect.angle - effect.spread * 0.5, effect.angle + effect.spread * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha("#ffe0b8", 0.28 + alpha * 0.16, "255, 224, 184");
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.arc(effect.x, effect.y, effect.radius, effect.angle - effect.spread * 0.5, effect.angle + effect.spread * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function drawActiveEffects(ctx) {
      state.activeEffects.forEach((effect) => {
        if (effect.startDelay > 0) return;
        if (effect.kind === "greatsword-field") {
          drawGreatswordField(ctx, effect);
        } else if (effect.kind === "flame-zone") {
          drawFlameZoneEffect(ctx, effect);
        } else if (effect.kind === "guard-counter-window") {
          drawGuardCounterEffect(ctx, effect);
        } else if (effect.kind === "bulwark-shell") {
          drawBulwarkShellEffect(ctx, effect);
        } else if (effect.kind === "bulwark-last-stand") {
          drawBulwarkLastStandEffect(ctx, effect);
        } else if (effect.kind === "chain-lightning-storm") {
          drawChainLightningEffect(ctx, effect);
        } else if (effect.kind === "boss-lane-telegraph") {
          drawBossLaneTelegraph(ctx, effect);
        } else if (effect.kind === "boss-zone-telegraph") {
          drawBossZoneTelegraph(ctx, effect);
        } else if (effect.kind === "boss-hazard-zone") {
          drawBossHazardZone(ctx, effect);
        } else if (effect.kind === "boss-ring-telegraph") {
          drawBossRingTelegraph(ctx, effect);
        } else if (effect.kind === "boss-cone-telegraph") {
          drawBossConeTelegraph(ctx, effect);
        }
      });
    }

    function drawBladeGlyph(ctx, x, y, angle, scale = 1, fill = "#efe2a3", stroke = "#a7884b") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-2.1, -2.5);
      ctx.lineTo(-4.2, 0);
      ctx.lineTo(-2.1, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = stroke;
      ctx.fillRect(-3.2, -2.2, 1.2, 4.4);
      ctx.fillStyle = "#fff7cf";
      ctx.fillRect(-5.7, -1.1, 3.1, 2.2);
      ctx.fillStyle = "#d0b46c";
      ctx.fillRect(-7.1, -0.8, 1.4, 1.6);
      ctx.restore();
    }

    function drawSwordOrbitHints(ctx) {
      const skill = state.player.skills.sword;
      if (!skill) return;
      const routeVfx = getSkillRouteVfx("sword", skill);
      const palette = routeVfx.palette || {};
      const capstoneRoute = skill.capstone || null;
      const orbitCount = Math.max(1, (routeVfx.auto?.orbitCount || 3) + (capstoneRoute === "swarm" ? 3 : 0));
      const orbitRadius = (routeVfx.auto?.orbitRadius || 18) + (capstoneRoute === "swarm" ? 6 : capstoneRoute === "greatsword" ? 2 : 0);
      const readyRatio = clamp(1 - (skill.timer || 0) / Math.max(0.0001, skill.cooldown || 1), 0, 1);
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      for (let i = 0; i < orbitCount; i += 1) {
        const angle = state.time * 1.4 + (Math.PI * 2 * i) / orbitCount;
        const radius = orbitRadius + (routeVfx.auto?.style === "greatsword" ? (i % 2) * 6 : Math.sin(state.time * 2 + i) * 2);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx.globalAlpha = 0.08 + readyRatio * 0.22 + (routeVfx.auto?.style === "greatsword" ? 0.08 : 0) + (capstoneRoute ? 0.08 : 0);
        drawBladeGlyph(
          ctx,
          x,
          y,
          angle + Math.PI / 2,
          (routeVfx.auto?.projectileScale || 1) * (routeVfx.auto?.style === "greatsword" ? 0.88 : 0.62) * (capstoneRoute === "greatsword" ? 1.12 : capstoneRoute === "swarm" ? 1.05 : 1),
          palette.primary || "#efe2a3",
          palette.secondary || "#a7884b",
        );
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawFlameAura(ctx) {
      const skill = state.player.skills.flame;
      if (!skill) return;
      const routeVfx = getSkillRouteVfx("flame", skill);
      const palette = routeVfx.palette || {};
      const routeStyle = routeVfx.auto?.pulseStyle || "meteor";
      const capstoneRoute = skill.capstone || null;
      const radius = skill.radius;
      const phase = state.time * 2.6;
      const tongues = routeStyle === "zone" ? 20 + (capstoneRoute === "zone" ? 4 : 0) : 14 + (capstoneRoute === "meteor" ? 2 : 0);
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      const heat = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius + 24);
      heat.addColorStop(0, withAlpha(palette.primary || "#ffcc7a", routeStyle === "zone" ? 0.05 : 0.1, "255, 204, 122"));
      heat.addColorStop(0.45, withAlpha(palette.secondary || "#ff8448", routeStyle === "zone" ? 0.12 : 0.18, "255, 132, 72"));
      heat.addColorStop(1, withAlpha(palette.secondary || "#ff582c", 0, "255, 88, 44"));
      ctx.fillStyle = heat;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 18, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < tongues; i += 1) {
        const angle = (Math.PI * 2 * i) / tongues + phase * 0.22;
        if (routeStyle === "zone") {
          const inner = radius - 10 + Math.sin(phase + i) * 2;
          const outer = radius + 12 + (i % 2) * 6;
          ctx.strokeStyle = withAlpha(palette.primary || "#ffd688", 0.22 + (i % 3) * 0.05, "255, 214, 136");
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        } else {
          const base = radius - 7 + Math.sin(phase + i) * 2;
          const tip = radius + 12 + Math.sin(phase * 1.4 + i * 0.8) * 4;
          const spread = 0.1;
          ctx.fillStyle = withAlpha(palette.secondary || "#ff803c", 0.16 + (i % 3) * 0.05, "255, 128, 60");
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle - spread) * base, Math.sin(angle - spread) * base);
          ctx.quadraticCurveTo(Math.cos(angle) * (radius + 4), Math.sin(angle) * (radius + 4), Math.cos(angle) * tip, Math.sin(angle) * tip);
          ctx.quadraticCurveTo(Math.cos(angle + spread) * (radius + 4), Math.sin(angle + spread) * (radius + 4), Math.cos(angle + spread) * base, Math.sin(angle + spread) * base);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.strokeStyle = withAlpha(palette.primary || "#ffce7d", routeStyle === "zone" ? 0.84 : 0.92, "255, 206, 125");
      ctx.lineWidth = routeStyle === "zone" ? 3 : 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (routeStyle === "zone") {
        ctx.strokeStyle = withAlpha(palette.secondary || "#d65a35", 0.3, "214, 90, 53");
        ctx.setLineDash([8, 10]);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(12, radius - 2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (capstoneRoute === "zone") {
          ctx.strokeStyle = withAlpha(palette.primary || "#ffd48e", 0.42, "255, 212, 142");
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, radius + 12 + Math.sin(phase) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = withAlpha(palette.secondary || "#ff5e2a", 0.48, "255, 94, 42");
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(12, radius - 4), 0, Math.PI * 2);
        ctx.stroke();
        if (capstoneRoute === "meteor") {
          const core = radius * 0.58;
          ctx.fillStyle = withAlpha(palette.accent || "#fff0bf", 0.14, "255, 240, 191");
          ctx.beginPath();
          ctx.arc(0, 0, core, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = withAlpha(palette.primary || "#ffc278", 0.62, "255, 194, 120");
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.arc(0, 0, core, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawGuardAura(ctx) {
      const guard = state.player.skills.guard;
      if (!guard || guard.shield <= 0) return;
      const routeVfx = getSkillRouteVfx("guard", guard);
      const palette = routeVfx.palette || {};
      const routeStyle = routeVfx.auto?.style || "bulwark";
      const capstoneRoute = guard.capstone || null;
      const shieldRatio = clamp(guard.shield / Math.max(1, guard.maxShield), 0, 1);
      const radius = state.player.radius + 8;
      const phase = state.time * 1.8;
      ctx.save();
      ctx.translate(state.player.x, state.player.y);

      const shell = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius + 18);
      shell.addColorStop(0, withAlpha(palette.primary || "#dceaff", 0.05, "220, 234, 255"));
      shell.addColorStop(0.6, withAlpha(palette.secondary || "#a2c2f6", 0.11 + shieldRatio * 0.08, "162, 194, 246"));
      shell.addColorStop(1, withAlpha(palette.secondary || "#6891d4", 0, "104, 145, 212"));
      ctx.fillStyle = shell;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = withAlpha(palette.primary || "#d6e8ff", 0.45 + shieldRatio * 0.35, "214, 232, 255");
      ctx.lineWidth = (routeStyle === "bulwark" ? 4.8 : 3.2) + (capstoneRoute === routeStyle ? 1 : 0);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(palette.secondary || "#84aee8", 0.34 + shieldRatio * 0.28, "132, 174, 232");
      ctx.lineWidth = 2.2;
      if (routeStyle === "counter") {
        for (let i = 0; i < 3; i += 1) {
          const arcRadius = radius + 4 + i * 3;
          ctx.beginPath();
          ctx.arc(0, 0, arcRadius, phase * 0.7 + i * 0.6, phase * 0.7 + i * 0.6 + Math.PI * 0.56);
          ctx.stroke();
        }
        for (let i = 0; i < 4; i += 1) {
          const angle = phase * 0.25 + (Math.PI * 2 * i) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (radius - 4), Math.sin(angle) * (radius - 4));
          ctx.lineTo(Math.cos(angle) * (radius + 12), Math.sin(angle) * (radius + 12));
          ctx.stroke();
        }
        if (capstoneRoute === "counter") {
          ctx.strokeStyle = withAlpha(palette.accent || "#f6fbff", 0.42 + shieldRatio * 0.22, "246, 251, 255");
          ctx.lineWidth = 1.8;
          for (let i = 0; i < 8; i += 1) {
            const angle = phase * 0.42 + (Math.PI * 2 * i) / 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2));
            ctx.lineTo(Math.cos(angle) * (radius + 16), Math.sin(angle) * (radius + 16));
            ctx.stroke();
          }
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 5, phase * 0.5, phase * 0.5 + Math.PI * 1.22);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, radius + 5, phase * 0.5 + Math.PI, phase * 0.5 + Math.PI * 2.08);
        ctx.stroke();
        if (capstoneRoute === "bulwark") {
          ctx.strokeStyle = withAlpha(palette.primary || "#f0e1b1", 0.38 + shieldRatio * 0.18, "240, 225, 177");
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, radius + 11, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function getStatus(name) {
      return state.statuses.find((status) => status.name === name) || null;
    }

    function drawPathAura(ctx) {
      const qingming = getStatus("清明");
      const linghu = getStatus("灵护");
      const tianxi = getStatus("天息");
      const sharan = getStatus("煞燃");
      const mochi = getStatus("魔驰");
      const mofei = getStatus("魔沸");
      const whiteWeight = (qingming ? 0.22 : 0) + (linghu ? 0.34 : 0) + (tianxi ? 0.48 : 0) + (state.whitePath.full ? 0.22 : 0);
      const blackWeight = (sharan ? 0.22 : 0) + (mochi ? 0.34 : 0) + (mofei ? 0.5 : 0) + (state.blackPath.full ? 0.22 : 0);
      if (whiteWeight <= 0 && blackWeight <= 0) return;

      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      const baseRadius = state.player.radius + 8;

      if (whiteWeight > 0) {
        const whitePulse = 0.92 + Math.sin(state.time * 2.6) * 0.05;
        const whiteRadius = baseRadius + 14 + whiteWeight * 26;
        const glow = ctx.createRadialGradient(0, 0, baseRadius * 0.35, 0, 0, whiteRadius + 22);
        glow.addColorStop(0, `rgba(244, 241, 225, ${0.05 + whiteWeight * 0.08})`);
        glow.addColorStop(0.5, `rgba(210, 227, 241, ${0.08 + whiteWeight * 0.14})`);
        glow.addColorStop(1, "rgba(210, 227, 241, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, whiteRadius + 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(242, 235, 212, ${0.24 + whiteWeight * 0.42})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, whiteRadius * whitePulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(196, 220, 240, ${0.18 + whiteWeight * 0.34})`;
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i += 1) {
          const angle = state.time * 0.45 + (Math.PI * 2 * i) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, whiteRadius + 6 + i * 5, angle, angle + Math.PI * 0.72);
          ctx.stroke();
        }
      }

      if (blackWeight > 0) {
        const blackRadius = baseRadius + 12 + blackWeight * 28;
        const heat = ctx.createRadialGradient(0, 0, baseRadius * 0.3, 0, 0, blackRadius + 20);
        heat.addColorStop(0, `rgba(255, 132, 70, ${0.06 + blackWeight * 0.1})`);
        heat.addColorStop(0.55, `rgba(124, 56, 96, ${0.08 + blackWeight * 0.16})`);
        heat.addColorStop(1, "rgba(124, 56, 96, 0)");
        ctx.fillStyle = heat;
        ctx.beginPath();
        ctx.arc(0, 0, blackRadius + 16, 0, Math.PI * 2);
        ctx.fill();

        const sparks = 10;
        for (let i = 0; i < sparks; i += 1) {
          const angle = state.time * 1.1 + (Math.PI * 2 * i) / sparks;
          const inner = blackRadius - 8 + (i % 2) * 2;
          const outer = blackRadius + 10 + (i % 3) * 4;
          ctx.strokeStyle = `rgba(255, 156, 82, ${0.18 + blackWeight * 0.34})`;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }

        ctx.strokeStyle = `rgba(255, 196, 116, ${0.22 + blackWeight * 0.26})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, blackRadius * (0.95 + Math.sin(state.time * 3.4) * 0.04), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawPlayer(ctx) {
      drawPathAura(ctx);
      drawSwordOrbitHints(ctx);
      drawFlameAura(ctx);
      drawGuardAura(ctx);
      const invulnActive = state.player.invulnTimer > 0;
      const invulnPulse = invulnActive
        ? 0.35 + (Math.sin(state.time * 42) * 0.5 + 0.5) * 0.55
        : 1;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(state.player.x - 17, state.player.y - state.player.radius - 12, 34, 4);
      ctx.fillStyle = "#d65b5b";
      ctx.fillRect(
        state.player.x - 17,
        state.player.y - state.player.radius - 12,
        34 * clamp(state.player.hp / Math.max(1, state.player.maxHp), 0, 1),
        4,
      );
      if (invulnActive) {
        ctx.save();
        ctx.translate(state.player.x, state.player.y);
        ctx.strokeStyle = `rgba(255, 244, 196, ${0.24 + invulnPulse * 0.42})`;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, state.player.radius + 6 + Math.sin(state.time * 18) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = invulnPulse;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function getExecuteThreshold(target) {
      const mochi = getStatus("魔驰");
      if (!mochi?.effects?.execute) return 0;
      if (target.type === "boss") return mochi.effects.execute.bossThreshold || 0;
      if (target.isMiniBoss || target.type === "elite") return mochi.effects.execute.eliteThreshold || 0;
      return mochi.effects.execute.normalThreshold || 0;
    }

    function drawExecuteMarker(ctx, target) {
      const threshold = getExecuteThreshold(target);
      if (!threshold) return;
      const hpRatio = target.hp / Math.max(1, target.maxHp);
      if (hpRatio > threshold) return;
      const pulse = 0.88 + Math.sin(state.time * 8) * 0.08;
      const radius = (target.radius + 10) * pulse;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.strokeStyle = `rgba(255, 118, 72, ${target.type === "boss" ? 0.78 : 0.9})`;
      ctx.lineWidth = target.type === "boss" ? 3 : 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      const marks = target.type === "boss" ? 6 : 4;
      for (let i = 0; i < marks; i += 1) {
        const angle = (Math.PI * 2 * i) / marks + state.time * 0.28;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (radius - 6), Math.sin(angle) * (radius - 6));
        ctx.lineTo(Math.cos(angle) * (radius + 8), Math.sin(angle) * (radius + 8));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMiniBossTelegraph(ctx, enemy) {
      if (!enemy.isMiniBoss) return;
      const telegraphUntil = enemy.miniBossTelegraphUntil || 0;
      const shieldUntil = enemy.miniBossShieldUntil || 0;
      const pulseRadius = enemy.miniBossPulseRadius || (enemy.radius + 48);
      const teleportUntil = enemy.miniBossTeleportMarkerUntil || 0;
      const teleportTarget = enemy.miniBossTeleportTarget || null;
      const teleportRadius = enemy.miniBossTeleportRadius || (enemy.radius + 18);
      if (telegraphUntil > state.time) {
        const remaining = Math.max(0, telegraphUntil - state.time);
        const duration = Math.max(0.01, enemy.miniBossTelegraphDuration || 0.78);
        const ratio = clamp(remaining / duration, 0, 1);
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        const ringRadius = enemy.radius + (pulseRadius - enemy.radius) * (1 - ratio * 0.08);
        ctx.fillStyle = `rgba(255, 196, 96, ${0.06 + (1 - ratio) * 0.08})`;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 222, 136, ${0.44 + (1 - ratio) * 0.28})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const glyphCount = 6;
        for (let i = 0; i < glyphCount; i += 1) {
          const angle = (Math.PI * 2 * i) / glyphCount + state.time * 0.8;
          const inner = ringRadius - 10;
          const outer = ringRadius + 10;
          ctx.strokeStyle = `rgba(255, 238, 188, ${0.38 + (1 - ratio) * 0.22})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (teleportUntil > state.time && teleportTarget) {
        const remaining = Math.max(0, teleportUntil - state.time);
        const duration = Math.max(0.01, enemy.miniBossTeleportMarkerDuration || 0.82);
        const ratio = clamp(remaining / duration, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(150, 232, 255, ${0.22 + (1 - ratio) * 0.22})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(teleportTarget.x, teleportTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        ctx.translate(teleportTarget.x, teleportTarget.y);
        const ringRadius = teleportRadius * (0.94 + (1 - ratio) * 0.08);
        ctx.fillStyle = `rgba(98, 198, 255, ${0.06 + (1 - ratio) * 0.1})`;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(184, 241, 255, ${0.52 + (1 - ratio) * 0.24})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 4; i += 1) {
          const angle = (Math.PI * 2 * i) / 4 + state.time * 0.4;
          ctx.strokeStyle = `rgba(225, 250, 255, ${0.4 + (1 - ratio) * 0.18})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (ringRadius - 14), Math.sin(angle) * (ringRadius - 14));
          ctx.lineTo(Math.cos(angle) * (ringRadius + 14), Math.sin(angle) * (ringRadius + 14));
          ctx.stroke();
        }
        ctx.restore();
      }
      if (shieldUntil > state.time) {
        const ratio = clamp((shieldUntil - state.time) / Math.max(0.01, (enemy.miniBossTelegraphDuration || 0.78)), 0, 1);
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        const shieldRadius = enemy.radius + 12 + Math.sin(state.time * 7) * 1.6;
        ctx.strokeStyle = `rgba(132, 204, 255, ${0.55 + (1 - ratio) * 0.18})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(220, 244, 255, ${0.38 + (1 - ratio) * 0.16})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawEnemies(ctx) {
      state.enemies.forEach((enemy) => {
        drawMiniBossTelegraph(ctx, enemy);
        ctx.fillStyle = enemy.color === "white" ? COLORS.enemyWhite : COLORS.enemyBlack;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        drawTargetStatusFx(ctx, enemy, Math.max(0.9, enemy.radius / 16));
        drawExecuteMarker(ctx, enemy);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 4);
        ctx.fillStyle = "#89d3b4";
        ctx.fillRect(
          enemy.x - enemy.radius,
          enemy.y - enemy.radius - 10,
          clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1) * enemy.radius * 2,
          4,
        );
      });
    }

    function drawBoss(ctx) {
      if (!state.boss) return;
      const boss = state.boss;
      ctx.fillStyle = COLORS.boss;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,180,180,0.5)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      drawTargetStatusFx(ctx, boss, Math.max(1.2, boss.radius / 18));
      drawExecuteMarker(ctx, boss);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(200, 18, 560, 12);
      ctx.fillStyle = "#d97878";
      ctx.fillRect(200, 18, 560 * (boss.hp / boss.maxHp), 12);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${boss.name} · ${boss.phaseNames?.[boss.phase - 1] || `阶段${boss.phase}`}`, 200, 14);
      if (boss.intentLabel) {
        const tag = boss.intentCounterable ? "可反制" : "不可反制";
        ctx.fillStyle = boss.intentCounterable ? "rgba(255,232,178,0.95)" : "rgba(255,205,183,0.95)";
        ctx.fillText(`${boss.intentLabel} · ${tag}`, 200, 46);
      }
      if (boss.exposedTimer > 0) {
        ctx.strokeStyle = "rgba(255,240,196,0.78)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.radius + 18 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawSwordProjectile(ctx, projectile) {
      const palette = projectile.palette || {};
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const isActive = projectile.kind === "sword-active";
      const isChain = projectile.kind === "sword-chain";
      const isGreat = projectile.routeStyle === "greatsword";
      const scaleBase = projectile.visualScale || (isActive ? 1.28 : isChain ? 0.95 : 1);
      const scale = scaleBase * (isGreat && !isActive ? 1.08 : 1);
      const trailLength = projectile.trailLength || (isActive ? 24 : isChain ? 14 : 18);
      const trailWidth = projectile.trailWidth || (isActive ? 4 : 2.4);
      const fill = palette.primary || (isActive ? "#fff1bc" : isChain ? "#f8e7b8" : "#efe2a3");
      const stroke = palette.secondary || (isActive ? "#d19a4a" : isChain ? "#b58a54" : "#a7884b");
      const trailColor = palette.accent || (isActive ? "#ffe6b0" : "#efe2a3");
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(angle);
      const trailGap = isActive ? 8 : isChain ? 7 : 6;
      const trailEnd = -trailGap;
      const trailStart = -trailLength - trailGap;
      const glowGradient = ctx.createLinearGradient(trailStart, 0, trailEnd, 0);
      glowGradient.addColorStop(0, withAlpha(trailColor, 0, "239, 226, 163"));
      glowGradient.addColorStop(0.35, withAlpha(trailColor, isActive ? 0.08 : isChain ? 0.05 : 0.04, "239, 226, 163"));
      glowGradient.addColorStop(1, withAlpha(trailColor, isActive ? 0.24 : isChain ? 0.16 : 0.12, "239, 226, 163"));
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.moveTo(trailStart, 0);
      ctx.quadraticCurveTo(
        trailStart + trailLength * 0.34,
        -trailWidth * (isActive ? 0.95 : 0.72),
        trailEnd,
        -trailWidth * (isActive ? 0.42 : 0.3),
      );
      ctx.lineTo(trailEnd, trailWidth * (isActive ? 0.42 : 0.3));
      ctx.quadraticCurveTo(
        trailStart + trailLength * 0.34,
        trailWidth * (isActive ? 0.95 : 0.72),
        trailStart,
        0,
      );
      ctx.fill();

      const streakGradient = ctx.createLinearGradient(trailStart, 0, trailEnd, 0);
      streakGradient.addColorStop(0, withAlpha(palette.accent || "#fff4d1", 0, "255, 244, 209"));
      streakGradient.addColorStop(0.55, withAlpha(palette.accent || "#fff4d1", isActive ? 0.16 : 0.08, "255, 244, 209"));
      streakGradient.addColorStop(1, withAlpha(palette.accent || "#fff4d1", isActive ? 0.3 : 0.16, "255, 244, 209"));
      ctx.strokeStyle = streakGradient;
      ctx.lineCap = "round";
      ctx.lineWidth = isActive ? 2.1 : isChain ? 1.25 : 1;
      ctx.beginPath();
      ctx.moveTo(trailStart + trailLength * 0.24, -trailWidth * 0.18);
      ctx.lineTo(trailEnd - 0.5, -trailWidth * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(trailStart + trailLength * 0.38, trailWidth * 0.16);
      ctx.lineTo(trailEnd - 2, trailWidth * 0.08);
      ctx.stroke();

      if (isActive || isGreat) {
        ctx.strokeStyle = withAlpha(palette.accent || "#fff4d1", isActive ? 0.22 : 0.12, "255, 244, 209");
        ctx.lineWidth = isActive ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(trailStart + trailLength * 0.52, 0);
        ctx.lineTo(trailEnd - 1, 0);
        ctx.stroke();
      }
      drawBladeGlyph(ctx, 0, 0, 0, scale, fill, stroke);
      ctx.restore();
    }

    function drawGuardCounterShotProjectile(ctx, projectile) {
      const palette = projectile.palette || {};
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(angle);
      ctx.strokeStyle = withAlpha(palette.secondary || "#78a6ea", 0.52, "120, 166, 234");
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-2, 0);
      ctx.stroke();
      ctx.fillStyle = withAlpha(palette.primary || "#dff2ff", 0.94, "223, 242, 255");
      ctx.strokeStyle = withAlpha(palette.accent || "#f6fbff", 0.8, "246, 251, 255");
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function drawProjectiles(ctx) {
      state.projectiles.forEach((projectile) => {
        if (
          projectile.kind === "sword"
          || projectile.kind === "sword-active"
          || projectile.kind === "sword-chain"
        ) {
          drawSwordProjectile(ctx, projectile);
          return;
        }
        if (projectile.kind === "guard-counter-shot") {
          drawGuardCounterShotProjectile(ctx, projectile);
          return;
        }
        ctx.fillStyle = projectile.color;
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      state.enemyProjectiles.forEach((projectile) => {
        if (projectile.fromBoss && projectile.counterable !== false) {
          ctx.fillStyle = "rgba(255, 221, 166, 0.96)";
          ctx.strokeStyle = "rgba(255, 247, 212, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(projectile.x, projectile.y, projectile.radius + 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          return;
        }
        if (projectile.fromBoss && projectile.counterable === false) {
          ctx.save();
          ctx.translate(projectile.x, projectile.y);
          ctx.rotate(state.time * 2.4);
          ctx.fillStyle = "rgba(201, 97, 97, 0.96)";
          ctx.beginPath();
          ctx.moveTo(projectile.radius + 3, 0);
          ctx.lineTo(0, -projectile.radius - 3);
          ctx.lineTo(-projectile.radius - 3, 0);
          ctx.lineTo(0, projectile.radius + 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          return;
        }
        ctx.fillStyle = "#c66161";
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawLightningPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const startX = pulseItem.fromX ?? pulseItem.x;
      const startY = pulseItem.fromY ?? pulseItem.y;
      const endX = pulseItem.x;
      const endY = pulseItem.y;
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / dist;
      const ny = dx / dist;
      const segments = 5;

      ctx.save();
      ctx.strokeStyle = withAlpha(palette.secondary || "#98d7ff", alpha, "152, 215, 255");
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let i = 1; i < segments; i += 1) {
        const t = i / segments;
        const jitter = (i % 2 === 0 ? -1 : 1) * 8 * alpha;
        ctx.lineTo(startX + dx * t + nx * jitter, startY + dy * t + ny * jitter);
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(palette.accent || "#ebfaff", alpha * 0.75, "235, 250, 255");
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.fillStyle = withAlpha(palette.accent || "#ffffff", alpha * 0.55, "255,255,255");
      ctx.beginPath();
      ctx.arc(endX, endY, 5 + alpha * 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = withAlpha(palette.primary || "#bae6ff", alpha * 0.42, "186, 230, 255");
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(endX, endY, 12 + alpha * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawThunderstormPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const capstoneStorm = (pulseItem.heavyFirstHitMult || 1) > 1;
      ctx.save();
      const ringPulse = 0.92 + Math.sin(pulseItem.time * 5.2) * 0.04;
      ctx.strokeStyle = withAlpha(palette.secondary || "#7cc4ff", alpha * 0.62, "124, 196, 255");
      ctx.lineWidth = 3.8 + (capstoneStorm ? 0.8 : 0);
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * ringPulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = withAlpha(palette.secondary || "#5894ff", alpha * 0.14, "88, 148, 255");
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = withAlpha(palette.primary || "#d8ecff", alpha * 0.08, "216, 236, 255");
      for (let i = 0; i < 5; i += 1) {
        const angle = state.time * 0.32 + (Math.PI * 2 * i) / 5;
        const cloudX = pulseItem.x + Math.cos(angle) * pulseItem.radius * 0.36;
        const cloudY = pulseItem.y + Math.sin(angle) * pulseItem.radius * 0.24;
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 18 + (i % 2) * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const sparks = pulseItem.routeStyle === "storm" ? 8 : 6;
      for (let i = 0; i < sparks; i += 1) {
        const angle = (Math.PI * 2 * i) / sparks + pulseItem.time * 3.2;
        const dist = pulseItem.radius * (0.25 + (i % 3) * 0.2);
        const x = pulseItem.x + Math.cos(angle) * dist;
        const y = pulseItem.y + Math.sin(angle) * dist;
        ctx.strokeStyle = withAlpha(palette.accent || "#d2f2ff", alpha * 0.65, "210, 242, 255");
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 10);
        ctx.lineTo(x + 2, y);
        ctx.lineTo(x - 3, y + 10);
        ctx.stroke();
      }

      if (pulseItem.placement) {
        ctx.setLineDash([12, 10]);
      }
      ctx.strokeStyle = withAlpha(palette.primary || "#d0efff", alpha * 0.3, "208, 239, 255");
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      if (capstoneStorm) {
        ctx.strokeStyle = withAlpha(palette.accent || "#f4f8ff", alpha * 0.34, "244, 248, 255");
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * 0.82, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawFlamePulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const routeStyle = pulseItem.routeStyle || "meteor";
      const duration = pulseItem.duration || 0.18;
      const progress = clamp(1 - pulseItem.time / duration, 0, 1);
      const radius = pulseItem.radius * progress;
      const tongues = routeStyle === "zone" ? 10 : 14;

      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      for (let i = 0; i < tongues; i += 1) {
        const angle = (Math.PI * 2 * i) / tongues + progress * 0.8;
        if (routeStyle === "zone") {
          ctx.strokeStyle = withAlpha(palette.primary || "#ffd28a", alpha * 0.42, "255, 210, 138");
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * Math.max(8, radius - 10), Math.sin(angle) * Math.max(8, radius - 10));
          ctx.lineTo(Math.cos(angle) * (radius + 8 + (i % 2) * 6), Math.sin(angle) * (radius + 8 + (i % 2) * 6));
          ctx.stroke();
        } else {
          const tip = radius + 10 + Math.sin(progress * 8 + i) * 3;
          const base = Math.max(6, radius - 8);
          const spread = 0.11;
          ctx.fillStyle = withAlpha(palette.secondary || "#ff7f36", alpha * 0.45, "255, 127, 54");
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle - spread) * base, Math.sin(angle - spread) * base);
          ctx.quadraticCurveTo(Math.cos(angle) * (radius + 4), Math.sin(angle) * (radius + 4), Math.cos(angle) * tip, Math.sin(angle) * tip);
          ctx.quadraticCurveTo(Math.cos(angle + spread) * (radius + 4), Math.sin(angle + spread) * (radius + 4), Math.cos(angle + spread) * base, Math.sin(angle + spread) * base);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.strokeStyle = withAlpha(palette.primary || "#ffcc76", alpha * 0.95, "255, 204, 118");
      ctx.lineWidth = routeStyle === "zone" ? 2.8 : 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(palette.secondary || "#ff5e2d", alpha * 0.75, "255, 94, 45");
      ctx.lineWidth = routeStyle === "zone" ? 2.6 : 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, radius - 3), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = withAlpha(palette.primary || "#ffaa4e", alpha * (routeStyle === "zone" ? 0.08 : 0.16), "255, 170, 78");
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(5, radius - 10), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawMeteorPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const duration = pulseItem.duration || 0.5;
      const progress = clamp(1 - pulseItem.time / duration, 0, 1);
      const impactAt = pulseItem.impactAt || 0.72;
      const startX = pulseItem.fromX ?? pulseItem.x;
      const startY = pulseItem.fromY ?? -120;
      const endX = pulseItem.x;
      const endY = pulseItem.y;
      const travel = clamp(progress / impactAt, 0, 1);
      const meteorX = startX + (endX - startX) * travel;
      const meteorY = startY + (endY - startY) * travel;

      ctx.save();
      if (progress < impactAt) {
        ctx.strokeStyle = withAlpha(palette.secondary || "#ff9b5c", alpha * 0.45, "255, 155, 92");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(meteorX, meteorY);
        ctx.stroke();

        ctx.fillStyle = withAlpha(palette.primary || "#ffc479", alpha, "255, 196, 121");
        ctx.beginPath();
        ctx.arc(meteorX, meteorY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(palette.primary || "#ffc479", alpha * 0.38, "255, 196, 121");
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(endX, endY, pulseItem.radius * 0.26, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (progress >= impactAt) {
        const shock = clamp((progress - impactAt) / (1 - impactAt), 0, 1);
        ctx.strokeStyle = withAlpha(palette.primary || "#ffb054", alpha, "255, 176, 84");
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(endX, endY, pulseItem.radius * shock, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = withAlpha(palette.secondary || "#ff6e38", alpha * 0.45, "255, 110, 56");
        ctx.beginPath();
        ctx.arc(endX, endY, 14 + shock * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawGuardPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const routeStyle = pulseItem.routeStyle || "bulwark";
      const duration = pulseItem.duration || 0.26;
      const progress = clamp(1 - pulseItem.time / duration, 0, 1);
      const radius = pulseItem.radius * (0.22 + progress * 0.78);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);

      ctx.strokeStyle = withAlpha(palette.primary || "#d6e8ff", alpha * 0.9, "214, 232, 255");
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(palette.secondary || "#7ba3eb", alpha * 0.55, "123, 163, 235");
      ctx.lineWidth = 2.2;
      if (routeStyle === "bulwark") {
        for (let i = 0; i < 3; i += 1) {
          const arcRadius = radius - 12 + i * 10;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(10, arcRadius), progress * 0.8 + i * 0.7, progress * 0.8 + i * 0.7 + Math.PI * 0.8);
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI * 2 * i) / 6 + progress * 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (radius * 0.22), Math.sin(angle) * (radius * 0.22));
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          ctx.stroke();
        }
      }

      const spikes = 10;
      ctx.strokeStyle = withAlpha(palette.accent || "#eff7ff", alpha * 0.45, "239, 247, 255");
      ctx.lineWidth = 1.5;
      for (let i = 0; i < spikes; i += 1) {
        const angle = (Math.PI * 2 * i) / spikes + progress * 0.3;
        const inner = radius - 6;
        const outer = radius + 10 + (i % 2) * 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawGuardBreakPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const routeStyle = pulseItem.routeStyle || "bulwark";
      const duration = pulseItem.duration || 0.38;
      const progress = clamp(1 - pulseItem.time / duration, 0, 1);
      const radius = pulseItem.radius * (0.18 + progress * 0.82);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.strokeStyle = withAlpha(palette.primary || "#ddecff", alpha * 0.9, "221, 236, 255");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      const shards = routeStyle === "counter" ? 12 : 8;
      ctx.strokeStyle = withAlpha(palette.secondary || "#a8c2ff", alpha * 0.68, "168, 194, 255");
      ctx.lineWidth = routeStyle === "counter" ? 1.6 : 2;
      for (let i = 0; i < shards; i += 1) {
        const angle = (Math.PI * 2 * i) / shards + progress * 0.5;
        const start = radius - 8;
        const mid = radius + 8;
        const end = radius + 18 + (routeStyle === "counter" ? 4 : (i % 2) * 6);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
        ctx.lineTo(Math.cos(angle) * mid, Math.sin(angle) * mid);
        ctx.lineTo(Math.cos(angle + (routeStyle === "counter" ? 0.04 : 0.12)) * end, Math.sin(angle + (routeStyle === "counter" ? 0.04 : 0.12)) * end);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawGreatswordCastPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const radius = pulseItem.radius * (0.38 + alpha * 0.62);
      drawGreatswordBlade(ctx, {
        x: pulseItem.x - Math.cos(pulseItem.angle || 0) * radius * 0.42,
        y: pulseItem.y - Math.sin(pulseItem.angle || 0) * radius * 0.42,
        angle: pulseItem.angle || 0,
        length: radius * 1.7,
        width: radius * 0.78,
        primary: palette.primary || "#ffe6a6",
        secondary: palette.secondary || "#9b6c33",
        accent: palette.accent || "#fff5dc",
        alpha,
        glowStrength: 0.95,
      });
    }

    function drawGreatswordHitPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.rotate(pulseItem.angle || 0);
      ctx.strokeStyle = withAlpha(palette.accent || "#fff0d2", alpha * 0.82, "255, 240, 210");
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(14, 0);
      ctx.lineTo(-12, 10);
      ctx.stroke();
      ctx.restore();
    }

    function drawChainArcPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const startX = pulseItem.fromX ?? pulseItem.x;
      const startY = pulseItem.fromY ?? pulseItem.y;
      const dx = pulseItem.x - startX;
      const dy = pulseItem.y - startY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / dist;
      const ny = dx / dist;
      const segments = 7;
      ctx.save();
      ctx.strokeStyle = withAlpha(palette.secondary || "#81d6ff", alpha * 0.95, "129, 214, 255");
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let i = 1; i < segments; i += 1) {
        const t = i / segments;
        const jitter = (i % 2 === 0 ? -1 : 1) * (8 + i) * alpha;
        ctx.lineTo(startX + dx * t + nx * jitter, startY + dy * t + ny * jitter);
      }
      ctx.lineTo(pulseItem.x, pulseItem.y);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.accent || "#effaff", alpha * 0.56, "239, 250, 255");
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(pulseItem.x, pulseItem.y);
      ctx.stroke();
      ctx.restore();
    }

    function drawChainNodePulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.fillStyle = withAlpha(palette.primary || "#bce7ff", alpha * 0.3, "188, 231, 255");
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, 10 + alpha * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(palette.accent || "#f0fcff", alpha * 0.9, "240, 252, 255");
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, 8 + alpha * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawFlameZoneBurst(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const radius = pulseItem.radius * (0.3 + alpha * 0.7);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      const petals = 10;
      for (let i = 0; i < petals; i += 1) {
        const angle = (Math.PI * 2 * i) / petals + alpha * 0.25;
        ctx.strokeStyle = withAlpha(palette.primary || "#ffc26e", alpha * 0.72, "255, 194, 110");
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (radius * 0.35), Math.sin(angle) * (radius * 0.35));
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx.stroke();
      }
      ctx.strokeStyle = withAlpha(palette.secondary || "#ff7e34", alpha * 0.8, "255, 126, 52");
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawGuardCounterStartPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.strokeStyle = withAlpha(palette.primary || "#e6f2ff", alpha * 0.82, "230, 242, 255");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawGuardCounterShockPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.strokeStyle = withAlpha(palette.primary || "#e0efff", alpha * 0.9, "224, 239, 255");
      ctx.lineWidth = 2.8;
      const rays = 6;
      for (let i = 0; i < rays; i += 1) {
        const angle = (Math.PI * 2 * i) / rays + alpha * 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
        ctx.lineTo(Math.cos(angle) * (14 + alpha * 10), Math.sin(angle) * (14 + alpha * 10));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawGuardCounterFinalePulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.strokeStyle = withAlpha(palette.primary || "#e7f3ff", alpha * 0.9, "231, 243, 255");
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * (0.28 + alpha * 0.72), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.secondary || "#96baf5", alpha * 0.55, "150, 186, 245");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * (0.18 + alpha * 0.62), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawStormStrikePulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const startX = pulseItem.fromX ?? pulseItem.x;
      const startY = pulseItem.fromY ?? -120;
      ctx.save();
      ctx.strokeStyle = withAlpha(palette.secondary || "#7cc4ff", alpha * 0.9, "124, 196, 255");
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(pulseItem.x, pulseItem.y);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.accent || "#f4f8ff", alpha * 0.7, "244, 248, 255");
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(startX + 6, startY + 10);
      ctx.lineTo(pulseItem.x, pulseItem.y);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.primary || "#c9dbff", alpha * 0.7, "201, 219, 255");
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(pulseItem.x, pulseItem.y, 14 + alpha * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawSwordAutoCastPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const bladeCount = Math.max(3, Math.min(12, pulseItem.bladeCount || 4));
      const radius = pulseItem.radius * (0.52 + (1 - alpha) * 0.38);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.rotate(pulseItem.angle || 0);
      if (pulseItem.routeStyle === "greatsword") {
        ctx.restore();
        drawGreatswordBlade(ctx, {
          x: pulseItem.x + Math.cos(pulseItem.angle || 0) * radius * 0.05,
          y: pulseItem.y + Math.sin(pulseItem.angle || 0) * radius * 0.05,
          angle: pulseItem.angle || 0,
          length: radius * 1.36,
          width: radius * 0.74,
          primary: palette.primary || "#f0c97c",
          secondary: palette.secondary || "#8e6130",
          accent: palette.accent || "#fff1ca",
          alpha: 0.74 + alpha * 0.26,
          glowStrength: 0.82,
        });
        return;
      }
      ctx.strokeStyle = withAlpha(palette.primary || "#f7e6a7", alpha * 0.72, "247, 230, 167");
      ctx.lineWidth = pulseItem.routeStyle === "greatsword" ? 3.4 : 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < bladeCount; i += 1) {
        const angle = (Math.PI * 2 * i) / bladeCount;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx.globalAlpha = 0.2 + alpha * 0.55;
        drawBladeGlyph(
          ctx,
          x,
          y,
          angle,
          pulseItem.routeStyle === "greatsword" ? 0.78 : 0.56,
          palette.primary || "#f7e6a7",
          palette.secondary || "#cc9d48",
        );
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawSwordHitPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.rotate(pulseItem.angle || 0);
      ctx.strokeStyle = withAlpha(palette.accent || "#fff8e2", alpha * 0.88, "255, 248, 226");
      ctx.lineWidth = pulseItem.routeStyle === "greatsword" ? 3.6 : 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -9);
      ctx.lineTo(12, 0);
      ctx.lineTo(-12, 9);
      ctx.stroke();
      if (pulseItem.routeStyle !== "greatsword") {
        ctx.beginPath();
        ctx.moveTo(-8, -12);
        ctx.lineTo(10, -2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMeteorBurstPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const radius = pulseItem.radius * (0.35 + alpha * 0.65);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8 + alpha * 0.18;
        ctx.strokeStyle = withAlpha(palette.primary || "#ffc278", alpha * 0.78, "255, 194, 120");
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (radius * 0.22), Math.sin(angle) * (radius * 0.22));
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx.stroke();
      }
      ctx.strokeStyle = withAlpha(palette.secondary || "#ff7247", alpha * 0.76, "255, 114, 71");
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawGuardBlockPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const radius = pulseItem.radius * (0.58 + (1 - alpha) * 0.24);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.strokeStyle = withAlpha(palette.primary || "#e6f2ff", alpha * 0.82, "230, 242, 255");
      ctx.lineWidth = pulseItem.kind === "guard-counter-block" ? 2.2 : 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.secondary || "#9eaed2", alpha * 0.5, "158, 174, 210");
      ctx.lineWidth = 1.8;
      for (let i = 0; i < (pulseItem.kind === "guard-counter-block" ? 6 : 4); i += 1) {
        const angle = (Math.PI * 2 * i) / (pulseItem.kind === "guard-counter-block" ? 6 : 4);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (radius - 6), Math.sin(angle) * (radius - 6));
        ctx.lineTo(Math.cos(angle) * (radius + (pulseItem.kind === "guard-counter-block" ? 10 : 4)), Math.sin(angle) * (radius + (pulseItem.kind === "guard-counter-block" ? 10 : 4)));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawGuardReformPulse(ctx, pulseItem, alpha) {
      const palette = pulseItem.palette || {};
      const routeStyle = pulseItem.routeStyle || "bulwark";
      const radius = pulseItem.radius * (0.48 + (1 - alpha) * 0.52);
      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.strokeStyle = withAlpha(palette.primary || "#f0e1b1", alpha * 0.84, "240, 225, 177");
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(palette.secondary || "#9eaed2", alpha * 0.52, "158, 174, 210");
      ctx.lineWidth = 1.6;
      if (routeStyle === "counter") {
        for (let i = 0; i < 5; i += 1) {
          const angle = (Math.PI * 2 * i) / 5 + alpha * 0.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (radius - 12), Math.sin(angle) * (radius - 12));
          ctx.lineTo(Math.cos(angle) * (radius + 4), Math.sin(angle) * (radius + 4));
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSwordBurstPulse(ctx, pulseItem, alpha) {
      const duration = pulseItem.duration || 0.26;
      const progress = clamp(1 - pulseItem.time / duration, 0, 1);
      const radius = pulseItem.radius * (0.52 + progress * 0.48);
      const bladeCount = Math.min(16, Math.max(6, Math.round((pulseItem.bladeCount || 8) * 0.7)));
      const palette = pulseItem.palette || SKILL_ART.sword || {};
      const fill = palette.primary || "#f4e3a4";
      const stroke = palette.secondary || "#8d6b35";

      ctx.save();
      ctx.translate(pulseItem.x, pulseItem.y);
      ctx.strokeStyle = `rgba(255, 230, 156, ${alpha * 0.8})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < bladeCount; i += 1) {
        const angle = (Math.PI * 2 * i) / bladeCount + progress * 0.18;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx.globalAlpha = 0.18 + alpha * 0.6;
        drawBladeGlyph(ctx, x, y, angle, 0.72, fill, stroke);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawPulses(ctx) {
      state.pulses.forEach((pulseItem) => {
        if (pulseItem.startDelay > 0) return;
        const duration = pulseItem.duration || 0.18;
        const alpha = clamp(pulseItem.time / duration, 0, 1);
        if (pulseItem.kind === "thunder") {
          drawLightningPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "storm-strike") {
          drawStormStrikePulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "thunderstorm") {
          drawThunderstormPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "flame") {
          drawFlamePulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "burst") {
          drawFlamePulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "meteor") {
          drawMeteorPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard") {
          drawGuardPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-break") {
          drawGuardBreakPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-block" || pulseItem.kind === "guard-counter-block") {
          drawGuardBlockPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-reform" || pulseItem.kind === "guard-counter-hit") {
          drawGuardReformPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "sword-auto-cast") {
          drawSwordAutoCastPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "sword-hit") {
          drawSwordHitPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "sword-burst") {
          drawSwordBurstPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "greatsword-cast") {
          drawGreatswordCastPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "greatsword-hit") {
          drawGreatswordHitPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "chain-arc") {
          drawChainArcPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "chain-node") {
          drawChainNodePulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "flame-zone-burst") {
          drawFlameZoneBurst(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "meteor-burst") {
          drawMeteorBurstPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-counter-start") {
          drawGuardCounterStartPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-counter-shock") {
          drawGuardCounterShockPulse(ctx, pulseItem, alpha);
          return;
        }
        if (pulseItem.kind === "guard-counter-finale") {
          drawGuardCounterFinalePulse(ctx, pulseItem, alpha);
          return;
        }
        ctx.strokeStyle = pulseItem.kind === "thunder"
          ? `rgba(131, 197, 255, ${alpha})`
          : pulseItem.kind === "flame"
            ? `rgba(255, 130, 66, ${alpha})`
            : `rgba(226, 204, 142, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pulseItem.x, pulseItem.y, pulseItem.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function render() {
      const ctx = dom.ctx;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawGrid(ctx);
      drawArena(ctx);
      drawDrops(ctx);
      drawActiveEffects(ctx);
      drawPlayer(ctx);
      drawEnemies(ctx);
      drawProjectiles(ctx);
      drawPulses(ctx);
      drawBoss(ctx);
      updateHud();
    }

    function resizeCanvas() {
      if (!document.fullscreenElement) {
        dom.canvas.width = WIDTH;
        dom.canvas.height = HEIGHT;
        return;
      }
      dom.canvas.width = window.innerWidth - 40;
      dom.canvas.height = Math.floor((window.innerWidth - 40) * 9 / 16);
    }

    async function toggleFullscreen() {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dom.canvas.requestFullscreen();
    }

    return {
      render,
      resizeCanvas,
      toggleFullscreen,
    };
  }

  global.GameRenderer = {
    createGameRenderer,
  };
})(window);
