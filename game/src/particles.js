// Particles and floating text: the juice. Sparks fly when a bolt lands, a ring bursts
// when a big enemy dies, damage numbers float up from hits. Everything here is visual
// only — it never changes the rules — and the arrays are capped so a busy fight stays
// fast. Sparks draw additively, like light.

const MAX_PARTICLES = 500;
const MAX_TEXTS = 40;

export function spawnBurst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= MAX_PARTICLES) return;
    const angle = state.rng.angle();
    const v = speed * (0.3 + state.rng.next() * 0.7);
    state.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      life: life * (0.6 + state.rng.next() * 0.4), maxLife: life,
      size: size * (0.6 + state.rng.next() * 0.8), color, drag: 0.9,
    });
  }
}

export function spawnRing(state, x, y, color, maxR) {
  state.particles.push({
    kind: 'ring', x, y, vx: 0, vy: 0,
    life: 0.45, maxLife: 0.45, size: maxR, color, drag: 1,
  });
}

export function spawnGlow(state, x, y, color, size, life) {
  if (state.particles.length >= MAX_PARTICLES) return;
  state.particles.push({
    kind: 'glow', x, y, vx: 0, vy: 0,
    life, maxLife: life, size, color, drag: 1,
  });
}

export function spawnText(state, x, y, text, color, size = 14) {
  if (state.texts.length >= MAX_TEXTS) state.texts.shift();
  // A little horizontal jitter so numbers from one spot do not stack into one blob.
  const jx = state.rng ? state.rng.range(-12, 12) : 0;
  state.texts.push({ x: x + jx, y, vy: -70, life: 0.75, maxLife: 0.75, text, color, size });
}

export function updateParticles(state, dt) {
  const { particles, texts } = state;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = Math.pow(p.drag, dt * 60);
    p.vx *= drag;
    p.vy *= drag;
  }
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) {
      texts.splice(i, 1);
      continue;
    }
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.92, dt * 60);
  }
}

export function drawParticles(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'glow') {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ring: an expanding circle, fading as it grows
      const t = 1 - a;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * a + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  for (const t of state.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = a;
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
