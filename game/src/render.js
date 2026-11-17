// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. The game is drawn as light against dark: a warm glowing warden,
// neon shadow creatures, additive sparks. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.

import { FIELD, FONT, PALETTE, FINAL_WAVE } from './config.js';
import { PICKUP_DEFS } from './pickups.js';
import { drawParticles } from './particles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const CARD = { width: 300, height: 200, gap: 24, top: 300 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let vignette = null;
  let cardRects = [];
  const fonts = new Map();
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    vignette = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  }

  function font(size, bold = false) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function panel(x, y, w, h, alpha = 0.88) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.backdropTop);
    g.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint grid, so motion reads.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    // Arena wall: a glowing border the player and the shadows stay inside.
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, FIELD.width - 16, FIELD.height - 16);
    ctx.strokeStyle = PALETTE.wallGlow;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, FIELD.width - 28, FIELD.height - 28);
    ctx.globalAlpha = 1;
    // Drifting embers.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of state.embers) {
      ctx.globalAlpha = e.alpha * (0.7 + 0.3 * Math.sin(e.phase * 2));
      ctx.fillStyle = '#ffb52e';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const def = PICKUP_DEFS[pk.kind];
      const blink = pk.life < 3 ? (Math.sin(pk.t * 14) > 0 ? 1 : 0.25) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, def.r + 6, 0, Math.PI * 2);
      ctx.globalAlpha = blink * 0.35;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = def.color;
      ctx.font = font(20, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, pk.x, pk.y + 1);
      ctx.restore();
    }
  }

  function enemyShape(e) {
    const { x, y, r } = e;
    ctx.beginPath();
    if (e.kind === 'skitter') {
      // A dart: a diamond pointing where it goes.
      const a = Math.atan2(e.vy, e.vx);
      ctx.moveTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
      ctx.lineTo(x + Math.cos(a + 2.4) * r, y + Math.sin(a + 2.4) * r);
      ctx.lineTo(x + Math.cos(a - 2.4) * r, y + Math.sin(a - 2.4) * r);
      ctx.closePath();
    } else if (e.kind === 'brute' || e.kind === 'herald' || e.kind === 'king') {
      // A heavy blob: a many-sided lump with spikes for the bosses.
      const spikes = e.kind === 'king' ? 9 : e.kind === 'herald' ? 7 : 0;
      const points = spikes || 8;
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const rr = spikes && i % 2 === 0 ? r + 8 : r;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const alpha = e.spawnIn > 0 ? 1 - e.spawnIn / 0.35 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Glow underneath.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = e.def.glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.def.color;
      enemyShape(e);
      // A darker core, so the shape reads at a glance.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Eyes, always toward the player.
      const p = state.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const ex = Math.cos(a);
      const ey = Math.sin(a);
      const px = -ey;
      const py = ex;
      const eyeR = Math.max(2, e.r * 0.16);
      const eyeOff = e.r * 0.36;
      ctx.fillStyle = e.def.eye;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + ex * e.r * 0.25 + px * eyeOff * s, e.y + ey * e.r * 0.25 + py * eyeOff * s, eyeR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hit flash: a lavender glint, not a white-out, so a boss keeps its
      // dark-purple silhouette and still reads as "just hit".
      if (e.flash > 0) {
        const isBoss = e.kind === 'herald' || e.kind === 'king';
        ctx.globalAlpha = alpha * Math.min(1, e.flash / 0.09) * (isBoss ? 0.45 : 0.8);
        ctx.fillStyle = '#c9a7ff';
        enemyShape(e);
      }
      ctx.restore();
      // Health bar for the tough ones.
      if ((e.kind === 'brute' || e.kind === 'herald' || e.kind === 'king') && e.hp < e.maxHp) {
        const w = e.r * 2;
        const y = e.y - e.r - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - w / 2, y, w, 5);
        ctx.fillStyle = e.def.color;
        ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return; // mercy blink
    ctx.save();
    // Glow: a soft halo that breathes.
    const flicker = 1 + Math.sin(state.time * 9) * 0.1;
    const halo = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r * 3.4 * flicker);
    halo.addColorStop(0, 'rgba(255,157,46,0.5)');
    halo.addColorStop(0.5, 'rgba(255,157,46,0.16)');
    halo.addColorStop(1, 'rgba(255,157,46,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 3.4 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Body: a warm lantern orb, white-hot at the centre.
    const g = ctx.createRadialGradient(p.x - 4, p.y - 5, 1, p.x, p.y, p.r + 2);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.45, PALETTE.playerCore);
    g.addColorStop(0.75, PALETTE.player);
    g.addColorStop(1, '#d97e14');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a4d12';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Face: two eyes toward the aim, a small flame on top.
    const ex = Math.cos(p.aimAngle);
    const ey = Math.sin(p.aimAngle);
    ctx.fillStyle = '#3a2408';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(p.x + ex * 4 - ey * 5 * s, p.y + ey * 4 + ex * 5 * s, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Aim tick.
    ctx.strokeStyle = 'rgba(255,233,168,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + ex * (p.r + 4), p.y + ey * (p.r + 4));
    ctx.lineTo(p.x + ex * (p.r + 12), p.y + ey * (p.r + 12));
    ctx.stroke();
    // Shield ring.
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(160,190,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Rapid-fire ring.
    if (p.rapidTimer > 0) {
      ctx.strokeStyle = 'rgba(255,224,102,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 13, state.time * 4, state.time * 4 + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
    // Crosshair at the mouse.
    ctx.save();
    ctx.strokeStyle = 'rgba(238,241,245,0.75)';
    ctx.lineWidth = 1.5;
    const ax = state.aim.x;
    const ay = state.aim.y;
    ctx.beginPath();
    ctx.arc(ax, ay, 9, 0, Math.PI * 2);
    ctx.moveTo(ax - 14, ay);
    ctx.lineTo(ax - 6, ay);
    ctx.moveTo(ax + 6, ay);
    ctx.lineTo(ax + 14, ay);
    ctx.moveTo(ax, ay - 14);
    ctx.lineTo(ax, ay - 6);
    ctx.moveTo(ax, ay + 6);
    ctx.lineTo(ax, ay + 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawBolts(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bolts) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = PALETTE.bulletGlow;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBolts) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#c04ae0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8b6ff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHud(state, best) {
    const p = state.player;
    // Top-left: health bar.
    ctx.save();
    text('HP', 28, 40, 15, PALETTE.muted, 'left', true);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(62, 26, 210, 16);
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = hpFrac > 0.5 ? PALETTE.heal : hpFrac > 0.25 ? PALETTE.gold : PALETTE.danger;
    ctx.fillRect(62, 26, 210 * hpFrac, 16);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(62, 26, 210, 16);
    text(`${Math.ceil(p.hp)} / ${p.maxHp}`, 278, 40, 14, PALETTE.text);
    if (p.shield > 0) text('⛨ WARD', 62, 62, 13, '#a0beff', 'left', true);
    if (p.rapidTimer > 0) text(`★ RAPID ${p.rapidTimer.toFixed(1)}s`, 150, 62, 13, PALETTE.star, 'left', true);
    // Top-centre: wave and shadows left. A dark plate behind the boss name + bar,
    // so floating damage numbers rising from the boss never tangle with the label.
    if (state.boss) {
      ctx.fillStyle = 'rgba(5,7,15,0.78)';
      ctx.fillRect(FIELD.width / 2 - 250, 46, 500, 46);
    }
    const left = state.enemies.length + state.spawnQueue.length;
    text(waveLabel(state.wave), FIELD.width / 2, 40, 18, PALETTE.text, 'center', true);
    text(state.boss ? state.boss.def.name : `${left} shadow${left === 1 ? '' : 's'} left`,
      FIELD.width / 2, 62, 13, state.boss ? PALETTE.danger : PALETTE.muted, 'center');
    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      const w = 420;
      const x = FIELD.width / 2 - w / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, 72, w, 10);
      ctx.fillStyle = b.def.color;
      ctx.fillRect(x, 72, w * Math.max(0, b.hp / b.maxHp), 10);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.strokeRect(x, 72, w, 10);
    }
    // Top-right: score, best, combo.
    text(scoreLabel(state.score), FIELD.width - 28, 40, 18, PALETTE.text, 'right', true);
    text(bestLabel(Math.max(best, state.score)), FIELD.width - 28, 62, 13, PALETTE.muted, 'right');
    if (state.combo >= 2) {
      const mult = 1 + Math.min(state.combo, 25) * 0.04;
      text(`COMBO x${mult.toFixed(2)}  (${state.combo})`, FIELD.width - 28, 86, 14, PALETTE.gold, 'right', true);
    }
    // Bottom hints, quiet so they never fight the play.
    text('WASD move · Mouse aim · Hold click / Space to fire · P pause · M mute',
      28, FIELD.height - 18, 13, PALETTE.dim);
    text(formatTime(state.time), FIELD.width - 28, FIELD.height - 18, 13, PALETTE.dim, 'right');
    ctx.restore();
  }

  function drawBanner(state) {
    if (!state.banner) return;
    const a = Math.min(1, state.banner.timer / 0.6, (2.4 - state.banner.timer) / 0.25 + 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    text(state.banner.title, FIELD.width / 2, 240, 46, PALETTE.gold, 'center', true);
    text(state.banner.sub, FIELD.width / 2, 274, 17, PALETTE.text, 'center');
    ctx.restore();
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Glow: a soft radial halo behind the title, not a solid disc.
    ctx.save();
    ctx.translate(FIELD.width / 2, 218);
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, -6, 8, 0, -6, 130);
    halo.addColorStop(0, 'rgba(255,157,46,0.55)');
    halo.addColorStop(0.55, 'rgba(255,157,46,0.18)');
    halo.addColorStop(1, 'rgba(255,157,46,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, -6, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text('EMBERWARD', FIELD.width / 2, 230, 76, PALETTE.gold, 'center', true);
    text('The last ember must not go out', FIELD.width / 2, 272, 20, PALETTE.text, 'center');
    text('Hold the light. Break the dark. Survive 10 waves.', FIELD.width / 2, 302, 15, PALETTE.muted, 'center');
    if (best > 0) text(`BEST  ${best}`, FIELD.width / 2, 344, 17, PALETTE.gold, 'center', true);
    panel(FIELD.width / 2 - 290, 392, 580, 132, 0.85);
    text('HOW TO PLAY', FIELD.width / 2, 424, 14, PALETTE.gold, 'center', true);
    text('WASD / Arrows — move      Mouse — aim      Hold Click / Space — fire', FIELD.width / 2, 452, 15, PALETTE.text, 'center');
    text('Clear each wave, choose an upgrade, defeat the Hollow King on wave 10.', FIELD.width / 2, 480, 15, PALETTE.text, 'center');
    text('P pause · M mute · R restart', FIELD.width / 2, 506, 13, PALETTE.muted, 'center');
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('— Click or press Enter to start —', FIELD.width / 2, 580, 19, PALETTE.player, 'center', true);
    ctx.restore();
  }

  function drawUpgrade(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('WAVE CLEARED', FIELD.width / 2, 150, 40, PALETTE.gold, 'center', true);
    text('Choose an upgrade — press 1, 2 or 3, or click a card', FIELD.width / 2, 186, 16, PALETTE.text, 'center');
    text(`Score ${state.score}   ·   Wave ${state.wave} cleared`, FIELD.width / 2, 214, 14, PALETTE.muted, 'center');
    const total = CARD.width * 3 + CARD.gap * 2;
    const x0 = (FIELD.width - total) / 2;
    cardRects = [];
    state.upgradeChoices.forEach((choice, i) => {
      const x = x0 + i * (CARD.width + CARD.gap);
      const y = CARD.top;
      cardRects.push({ x, y, w: CARD.width, h: CARD.height });
      panel(x, y, CARD.width, CARD.height, 0.95);
      text(`[${i + 1}]`, x + CARD.width / 2, y + 34, 13, PALETTE.muted, 'center', true);
      text(choice.def.icon, x + CARD.width / 2, y + 92, 44, PALETTE.gold, 'center');
      text(choice.def.name, x + CARD.width / 2, y + 128, 19, PALETTE.text, 'center', true);
      text(choice.def.desc, x + CARD.width / 2, y + 156, 14, PALETTE.muted, 'center');
      const levelText = choice.def.max >= 99 ? '—' : `Level ${choice.level} / ${choice.def.max}`;
      text(levelText, x + CARD.width / 2, y + 182, 13, PALETTE.dim, 'center');
    });
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.65)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 330, 52, PALETTE.text, 'center', true);
    text('Press P or Esc to resume · R to restart the run', FIELD.width / 2, 372, 16, PALETTE.muted, 'center');
    ctx.restore();
  }

  function statsLines(state) {
    const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
    return [
      ['Score', String(state.score)],
      ['Wave reached', String(state.wave)],
      ['Shadows broken', String(state.kills)],
      ['Time', formatTime(state.time)],
      ['Bolt accuracy', `${acc}%`],
    ];
  }

  function drawOver(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE EMBER DIES', FIELD.width / 2, 210, 54, PALETTE.danger, 'center', true);
    text(`The dark takes wave ${state.wave}.`, FIELD.width / 2, 250, 18, PALETTE.text, 'center');
    panel(FIELD.width / 2 - 230, 290, 460, 190, 0.9);
    const lines = statsLines(state);
    lines.forEach(([label, value], i) => {
      const y = 326 + i * 32;
      text(label, FIELD.width / 2 - 200, y, 16, PALETTE.muted);
      text(value, FIELD.width / 2 + 200, y, 16, PALETTE.text, 'right', true);
    });
    if (state.score >= best && state.score > 0) {
      text('★ NEW BEST SCORE ★', FIELD.width / 2, 516, 18, PALETTE.gold, 'center', true);
    } else {
      text(`Best ${best}`, FIELD.width / 2, 516, 16, PALETTE.muted, 'center');
    }
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('— Press R or click to play again —', FIELD.width / 2, 566, 18, PALETTE.player, 'center', true);
    ctx.restore();
  }

  function drawVictory(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE HOLLOW KING FALLS', FIELD.width / 2, 190, 48, PALETTE.gold, 'center', true);
    text('The light endures. You win the run.', FIELD.width / 2, 230, 18, PALETTE.text, 'center');
    panel(FIELD.width / 2 - 230, 268, 460, 190, 0.9);
    const lines = statsLines(state);
    lines.forEach(([label, value], i) => {
      const y = 304 + i * 32;
      text(label, FIELD.width / 2 - 200, y, 16, PALETTE.muted);
      text(value, FIELD.width / 2 + 200, y, 16, PALETTE.text, 'right', true);
    });
    text(`Best ${Math.max(best, state.score)}`, FIELD.width / 2, 494, 16, PALETTE.muted, 'center');
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('— C to keep playing endless · R or click to play again —', FIELD.width / 2, 544, 18, PALETTE.player, 'center', true);
    ctx.restore();
  }

  function draw(state, screen, best) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeAmp = state.shake * state.shake * 13;
    const sx = (Math.random() * 2 - 1) * shakeAmp;
    const sy = (Math.random() * 2 - 1) * shakeAmp;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground(state);
    drawPickups(state);
    drawEnemies(state);
    drawPlayer(state);
    drawBolts(state);
    drawParticles(ctx, state);
    if (vignette) {
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) {
      drawHud(state, best);
      drawBanner(state);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_VICTORY) drawVictory(state, best);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return {
    draw,
    /** Which upgrade card (0, 1, 2) holds the logical point, or -1. */
    cardAt(x, y) {
      for (let i = 0; i < cardRects.length; i += 1) {
        const r = cardRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    },
  };
}
