'use strict';

(() => {
  // ============================================================
  // CONFIG / CONSTANTS
  // ============================================================
  const STORAGE = {
    best: 'skyward-sprout-best-score-v1',
    muted: 'skyward-sprout-muted-v1',
  };

  const CONFIG = {
    gravity: 1850,
    jumpVelocity: 910,
    moveAcceleration: 3600,
    maxMoveSpeed: 430,
    groundFriction: 0.86,
    airFriction: 0.985,
    playerW: 34,
    playerH: 44,
    cameraLead: 0.38,
    deathMargin: 140,
    cleanupMargin: 360,
    dprCap: 2,
    coinScore: 35,
    heightScoreFactor: 1,
  };

  // Physics-derived values used by procedural generation.
  // maxJumpHeight = v² / 2g. totalAirTime approximates the jump arc.
  const PHYSICS = {
    maxJumpHeight: (CONFIG.jumpVelocity * CONFIG.jumpVelocity) / (2 * CONFIG.gravity),
    timeToApex: CONFIG.jumpVelocity / CONFIG.gravity,
    totalAirTime: (2 * CONFIG.jumpVelocity) / CONFIG.gravity,
  };
  PHYSICS.maxHorizontalReach = CONFIG.maxMoveSpeed * PHYSICS.totalAirTime;

  const BIOMES = [
    { id: 'grass', name: 'Луг', from: 0, to: 500, skyTop: '#67c9ff', skyBottom: '#c2f78d', platform: '#4eb66a', platformTop: '#a2f27e', particle: '#dcff94' },
    { id: 'clouds', name: 'Облака', from: 500, to: 1200, skyTop: '#8ad9ff', skyBottom: '#f7fbff', platform: '#dff4ff', platformTop: '#ffffff', particle: '#ffffff' },
    { id: 'snow', name: 'Снег', from: 1200, to: 2200, skyTop: '#4874b9', skyBottom: '#d9f6ff', platform: '#98d9ff', platformTop: '#eefcff', particle: '#dff7ff' },
    { id: 'space', name: 'Космос', from: 2200, to: 3500, skyTop: '#090824', skyBottom: '#28206b', platform: '#7b64e8', platformTop: '#c0a7ff', particle: '#d4c8ff' },
    { id: 'neon', name: 'Неон', from: 3500, to: Infinity, skyTop: '#070011', skyBottom: '#29105d', platform: '#00e8d6', platformTop: '#ff4df8', particle: '#48fff3' },
  ];

  const PLATFORM = {
    normal: 'normal',
    moving: 'moving',
    fragile: 'fragile',
    boost: 'boost',
    hazard: 'hazard',
  };

  const PERKS = {
    spring: { label: 'Пружина', icon: '↟', color: '#ffe45c', duration: 0, oneShot: true },
    jetpack: { label: 'Ракета', icon: '🚀', color: '#ff8f4d', duration: 4.3 },
    shield: { label: 'Щит', icon: '⬡', color: '#69f7ff', duration: 9 },
    magnet: { label: 'Магнит', icon: '◎', color: '#ff6bd6', duration: 8 },
    doubleJump: { label: 'Дубль', icon: '◆', color: '#bfff69', duration: 10 },
    multiplier: { label: 'x2', icon: '×2', color: '#ffd166', duration: 9 },
    lowGravity: { label: 'Лёгкость', icon: '◌', color: '#bca7ff', duration: 7 },
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const canvasPanel = $('canvasPanel');
  const overlay = $('screenOverlay');
  const primaryAction = $('primaryAction');
  const pauseBtn = $('pauseBtn');
  const muteBtn = $('muteBtn');
  const heightValue = $('heightValue');
  const scoreValue = $('scoreValue');
  const bestValue = $('bestValue');
  const perkTray = $('perkTray');
  const stateEyebrow = $('stateEyebrow');
  const stateTitle = $('stateTitle');
  const stateText = $('stateText');
  const stateStats = $('stateStats');
  const mobileJumpBtn = $('mobileJumpBtn');

  // ============================================================
  // UTILS
  // ============================================================
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function chance(p) { return Math.random() < p; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function mixColor(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
  }
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function formatInt(v) { return Math.max(0, Math.floor(v)).toLocaleString('ru-RU'); }

  // ============================================================
  // AUDIO MANAGER — unlocks only after user interaction
  // ============================================================
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.muted = localStorage.getItem(STORAGE.muted) === '1';
      this.updateButton();
    }
    unlock() {
      if (this.unlocked) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.unlocked = true;
        const g = this.ctx.createGain();
        g.gain.value = 0.0001;
        g.connect(this.ctx.destination);
        const o = this.ctx.createOscillator();
        o.connect(g);
        o.start();
        o.stop(this.ctx.currentTime + 0.02);
      } catch (_) {}
    }
    setMuted(value) {
      this.muted = value;
      localStorage.setItem(STORAGE.muted, value ? '1' : '0');
      this.updateButton();
    }
    toggleMute() {
      this.unlock();
      this.setMuted(!this.muted);
      if (!this.muted) this.play('button');
    }
    updateButton() {
      muteBtn.textContent = this.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', this.muted ? 'Включить звук' : 'Выключить звук');
    }
    play(type) {
      if (this.muted) return;
      this.unlock();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const out = this.ctx.createGain();
      out.connect(this.ctx.destination);
      out.gain.setValueAtTime(0.0001, now);

      const tone = (freq, start, dur, wave = 'sine', vol = 0.16) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(0.0001, now + start);
        g.gain.exponentialRampToValueAtTime(vol, now + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        o.connect(g); g.connect(out);
        o.start(now + start); o.stop(now + start + dur + 0.02);
      };

      switch (type) {
        case 'jump': tone(310, 0, .09, 'triangle', .12); tone(470, .035, .08, 'sine', .08); break;
        case 'collect': tone(780, 0, .06, 'sine', .11); tone(1180, .045, .08, 'sine', .09); break;
        case 'perk': tone(520, 0, .08, 'triangle', .12); tone(760, .06, .1, 'triangle', .11); tone(1080, .13, .14, 'sine', .09); break;
        case 'damage': tone(170, 0, .18, 'sawtooth', .16); break;
        case 'shield': tone(240, 0, .09, 'square', .1); tone(520, .03, .14, 'triangle', .09); break;
        case 'gameover': tone(230, 0, .16, 'sawtooth', .13); tone(150, .14, .22, 'sawtooth', .12); tone(92, .32, .32, 'sine', .12); break;
        case 'biome': tone(360, 0, .18, 'sine', .09); tone(620, .1, .22, 'triangle', .1); tone(880, .24, .28, 'sine', .08); break;
        case 'button': tone(430, 0, .055, 'triangle', .08); break;
      }
      out.gain.exponentialRampToValueAtTime(0.95, now + 0.02);
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    }
  }

  // ============================================================
  // INPUT HANDLING
  // ============================================================
  const input = {
    left: false,
    right: false,
    emergencyPressed: false,
  };

  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  function preventGameScroll(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
  }

  window.addEventListener('keydown', (e) => {
    preventGameScroll(e);
    audio.unlock();
    if (keyMap[e.code]) input[keyMap[e.code]] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
      if (game.state === 'start' || game.state === 'gameover') game.startRun();
      else if (game.state === 'playing') game.tryEmergencyJump();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') game.togglePause();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) input[keyMap[e.code]] = false;
  });

  function bindHoldButton(button, dir) {
    const start = (e) => { e.preventDefault(); audio.unlock(); input[dir] = true; button.classList.add('is-down'); };
    const end = (e) => { if (e) e.preventDefault(); input[dir] = false; button.classList.remove('is-down'); };
    button.addEventListener('touchstart', start, { passive: false });
    button.addEventListener('touchend', end, { passive: false });
    button.addEventListener('touchcancel', end, { passive: false });
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointerleave', end);
  }

  document.querySelectorAll('.move-btn').forEach((button) => bindHoldButton(button, button.dataset.dir));
  mobileJumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); audio.unlock(); game.tryEmergencyJump(); }, { passive: false });
  mobileJumpBtn.addEventListener('click', (e) => { e.preventDefault(); audio.unlock(); game.tryEmergencyJump(); });

  document.addEventListener('touchmove', (e) => {
    if (game.state === 'playing') e.preventDefault();
  }, { passive: false });

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('has-touch');

  // ============================================================
  // CANVAS SETUP / MOBILE VIEWPORT
  // ============================================================
  const viewport = { w: 420, h: 700, dpr: 1 };

  function resizeCanvas() {
    // CSS owns layout: .game-shell is 100dvh, canvas-panel is flex:1, controls are fixed height.
    // JS only syncs the internal canvas buffer to the actual visible container size.
    const rect = canvasPanel.getBoundingClientRect();
    // Use the actual flex-allocated panel size. A large JS-side minimum height
    // makes short mobile viewports overflow behind the touch controls, so only
    // keep tiny safety floors for pathological/embed cases.
    viewport.w = Math.max(260, Math.round(rect.width));
    viewport.h = Math.max(260, Math.round(rect.height));
    viewport.dpr = Math.min(CONFIG.dprCap, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.w * viewport.dpr);
    canvas.height = Math.round(viewport.h * viewport.dpr);
    canvas.style.width = `${viewport.w}px`;
    canvas.style.height = `${viewport.h}px`;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    game.onResize();
  }

  // ============================================================
  // PARTICLES
  // ============================================================
  class ParticleSystem {
    constructor() { this.items = []; }
    burst(x, y, color, count = 10, power = 120) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(power * .25, power);
        this.items.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rand(20, 80), size: rand(2, 6), life: rand(.35, .9), maxLife: 1, color });
      }
    }
    update(dt) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.items[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt;
        if (p.life <= 0) this.items.splice(i, 1);
      }
    }
    draw(cameraY) {
      for (const p of this.items) {
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ============================================================
  // PLAYER
  // ============================================================
  class Player {
    constructor() { this.reset(); }
    reset() {
      this.x = viewport.w * .5 - CONFIG.playerW * .5;
      this.y = viewport.h - 160;
      this.w = CONFIG.playerW;
      this.h = CONFIG.playerH;
      this.vx = 0;
      this.vy = -CONFIG.jumpVelocity * .8;
      this.facing = 1;
      this.squash = 0;
      this.invuln = 0;
      this.doubleReady = false;
      this.lastSafeY = this.y;
    }
    update(dt, game) {
      const accel = CONFIG.moveAcceleration;
      if (input.left) { this.vx -= accel * dt; this.facing = -1; }
      if (input.right) { this.vx += accel * dt; this.facing = 1; }
      this.vx = clamp(this.vx, -CONFIG.maxMoveSpeed, CONFIG.maxMoveSpeed);
      this.vx *= input.left || input.right ? 1 : (this.vy > 0 ? CONFIG.airFriction : CONFIG.groundFriction);

      const gravFactor = game.hasPerk('lowGravity') ? 0.58 : 1;
      if (game.hasPerk('jetpack')) {
        this.vy = Math.min(this.vy, -430);
        this.vy -= 460 * dt;
      } else {
        this.vy += CONFIG.gravity * gravFactor * dt;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x + this.w < 0) this.x = viewport.w;
      if (this.x > viewport.w) this.x = -this.w;
      this.squash = Math.max(0, this.squash - dt * 5.8);
      this.invuln = Math.max(0, this.invuln - dt);
    }
    jump(power = 1) {
      this.vy = -CONFIG.jumpVelocity * power;
      this.squash = 1;
    }
    draw(cameraY, game) {
      const sx = this.x + this.w / 2;
      const sy = this.y - cameraY + this.h / 2;
      const stretch = this.vy < 0 ? clamp(Math.abs(this.vy) / 1600, 0, .18) : 0;
      const squash = this.squash * .14;
      const drawW = this.w * (1 + squash - stretch * .35);
      const drawH = this.h * (1 - squash + stretch);
      const x = sx - drawW / 2;
      const y = sy - drawH / 2;

      ctx.save();
      if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = .55;

      if (game.hasPerk('shield')) {
        ctx.strokeStyle = 'rgba(105,247,255,.72)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 34 + Math.sin(game.time * 7) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (game.hasPerk('magnet')) {
        ctx.strokeStyle = 'rgba(255,107,214,.34)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 58 + Math.sin(game.time * 5) * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (game.hasPerk('jetpack')) {
        ctx.fillStyle = 'rgba(255,143,77,.88)';
        ctx.beginPath();
        ctx.moveTo(sx - 10, y + drawH - 2);
        ctx.lineTo(sx, y + drawH + 28 + Math.sin(game.time * 20) * 7);
        ctx.lineTo(sx + 10, y + drawH - 2);
        ctx.fill();
      }

      const grad = ctx.createLinearGradient(x, y, x, y + drawH);
      grad.addColorStop(0, game.hasPerk('multiplier') ? '#ffe45c' : '#54f2bd');
      grad.addColorStop(1, game.hasPerk('lowGravity') ? '#a78bff' : '#2d9dff');
      ctx.fillStyle = grad;
      roundRect(x, y, drawW, drawH, 14);
      ctx.fill();

      // Leaf ears / original sprout silhouette.
      ctx.fillStyle = '#7cff8a';
      ctx.beginPath();
      ctx.ellipse(sx - 7, y - 4, 8, 14, -0.7, 0, Math.PI * 2);
      ctx.ellipse(sx + 7, y - 4, 8, 14, 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#071021';
      const eyeY = y + drawH * .34;
      ctx.beginPath();
      ctx.arc(sx + this.facing * 7 - 5, eyeY, 3.2, 0, Math.PI * 2);
      ctx.arc(sx + this.facing * 7 + 6, eyeY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(7,16,33,.78)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx + 2, eyeY + 11, 7, 0.1, Math.PI - 0.1);
      ctx.stroke();

      if (Math.abs(this.vx) > 70) {
        ctx.strokeStyle = 'rgba(7,16,33,.45)';
        ctx.lineWidth = 3;
        const leg = Math.sin(game.time * 18) * 5;
        ctx.beginPath();
        ctx.moveTo(sx - 7, y + drawH - 1); ctx.lineTo(sx - 12, y + drawH + 7 + leg);
        ctx.moveTo(sx + 7, y + drawH - 1); ctx.lineTo(sx + 12, y + drawH + 7 - leg);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ============================================================
  // PLATFORM SYSTEM WITH REACHABILITY VALIDATION
  // ============================================================
  class PlatformSystem {
    constructor(game) {
      this.game = game;
      this.items = [];
      this.lastY = 0;
      this.lastAnchor = null;
    }
    reset() {
      this.items = [];
      const startY = viewport.h - 92;
      const start = this.create(viewport.w * .5 - 60, startY, 122, PLATFORM.normal);
      start.safe = true;
      this.items.push(start);
      this.lastY = startY;
      this.lastAnchor = start;
      while (this.lastY > -viewport.h * 2.2) this.generateNext();
    }
    difficulty(height) { return clamp(height / 4200, 0, 1); }
    create(x, y, w, type) {
      const p = { x, baseX: x, y, w, h: 15, type, active: true, hit: false, t: rand(0, 10), amp: 0, speed: 0, landingPulse: 0 };
      if (type === PLATFORM.moving) { p.amp = rand(34, 76); p.speed = rand(1.1, 1.9); }
      return p;
    }
    chooseType(height, previousType) {
      const d = this.difficulty(height);
      let pool = [PLATFORM.normal];
      if (height > 350) pool.push(PLATFORM.boost);
      if (height > 650) pool.push(PLATFORM.moving, PLATFORM.moving);
      if (height > 1000) pool.push(PLATFORM.fragile);
      if (height > 1500) pool.push(PLATFORM.hazard);
      let type = pool[Math.floor(Math.random() * pool.length)];
      if (previousType === PLATFORM.hazard && type === PLATFORM.hazard) type = PLATFORM.normal;
      if (chance(.16 - d * .07)) type = PLATFORM.normal; // recovery platform
      return type;
    }
    isReachable(from, to, boostBefore = false) {
      // Reachability is based on actual physics:
      // - vertical gap must stay below maxJumpHeight with a safety margin.
      // - horizontal gap must stay below maxMoveSpeed * airTime with a safety margin.
      // Moving platforms use their center range; hazard platforms never count as required anchors.
      const d = this.difficulty(Math.abs(to.y));
      const verticalGap = from.y - to.y;
      const maxJump = PHYSICS.maxJumpHeight * (boostBefore ? 1.48 : lerp(.66, .82, d));
      if (verticalGap <= 38 || verticalGap > maxJump) return false;

      const fromCenter = from.x + from.w / 2;
      const toMin = to.x;
      const toMax = to.x + to.w;
      const horizontalGap = fromCenter < toMin ? toMin - fromCenter : fromCenter > toMax ? fromCenter - toMax : 0;
      const reach = PHYSICS.maxHorizontalReach * lerp(.64, .82, d) + from.w * .35;
      return horizontalGap <= reach;
    }
    generateNext() {
      const height = Math.max(0, Math.floor(-this.lastY));
      const d = this.difficulty(height);
      const prev = this.lastAnchor || this.items[this.items.length - 1];
      const prevType = prev ? prev.type : PLATFORM.normal;
      const width = lerp(118, 64, d) + rand(-12, 16);
      const safeMaxGap = PHYSICS.maxJumpHeight * lerp(.54, .76, d);
      const minGap = lerp(58, 82, d);
      let candidate = null;
      for (let attempt = 0; attempt < 32; attempt++) {
        const gap = rand(minGap, safeMaxGap);
        const y = this.lastY - gap;
        const horizontalReach = PHYSICS.maxHorizontalReach * lerp(.45, .74, d);
        const prevCenter = prev.x + prev.w / 2;
        const xCenter = clamp(prevCenter + rand(-horizontalReach, horizontalReach), width * .55, viewport.w - width * .55);
        let type = this.chooseType(height, prevType);
        if (attempt > 18) type = PLATFORM.normal; // force an easy recovery if random attempts fail.
        const p = this.create(xCenter - width / 2, y, width, type);
        const anchorType = p.type === PLATFORM.hazard ? PLATFORM.normal : p.type;
        const validationPlatform = { ...p, type: anchorType };
        if (this.isReachable(prev, validationPlatform, prev.type === PLATFORM.boost)) {
          candidate = p;
          break;
        }
      }
      if (!candidate) {
        const fallbackW = Math.max(92, width);
        candidate = this.create(clamp(prev.x + rand(-45, 45), 8, viewport.w - fallbackW - 8), this.lastY - minGap, fallbackW, PLATFORM.normal);
      }
      const spawned = [candidate];
      if (candidate.type === PLATFORM.hazard) {
        // Spike platforms are optional danger, never the only route upward.
        // A normal twin platform at the same altitude guarantees a safe path.
        const safeW = Math.max(82, Math.min(118, width + 10));
        let safeX = candidate.x + candidate.w / 2 < viewport.w / 2
          ? candidate.x + candidate.w + 28
          : candidate.x - safeW - 28;
        safeX = clamp(safeX, 8, viewport.w - safeW - 8);
        const safe = this.create(safeX, candidate.y + rand(-8, 8), safeW, PLATFORM.normal);
        if (!this.isReachable(prev, safe, prev.type === PLATFORM.boost)) {
          const prevCenter = prev.x + prev.w / 2;
          const dir = prevCenter < viewport.w / 2 ? 1 : -1;
          safe.x = clamp(prevCenter + dir * 70 - safeW / 2, 8, viewport.w - safeW - 8);
          safe.baseX = safe.x;
          safe.y = candidate.y;
        }
        spawned.push(safe);
        this.lastAnchor = safe;
      } else {
        this.lastAnchor = candidate;
      }

      this.items.push(...spawned);
      this.lastY = candidate.y;
      for (const p of spawned) this.game.spawnAroundPlatform(p, height);
    }
    ensureAhead(cameraY) {
      while (this.lastY > cameraY - viewport.h * 2.4) this.generateNext();
    }
    update(dt, cameraY) {
      for (const p of this.items) {
        p.t += dt;
        p.landingPulse = Math.max(0, p.landingPulse - dt * 4);
        if (p.type === PLATFORM.moving) p.x = p.baseX + Math.sin(p.t * p.speed) * p.amp;
      }
      const cutoff = cameraY + viewport.h + CONFIG.cleanupMargin;
      this.items = this.items.filter(p => p.y < cutoff && (p.active || p.y < cameraY + viewport.h));
    }
    draw(cameraY, biome) {
      for (const p of this.items) {
        if (!p.active) continue;
        const y = p.y - cameraY;
        if (y < -80 || y > viewport.h + 80) continue;
        ctx.save();
        const pulse = p.landingPulse;
        ctx.translate(p.x + p.w / 2, y + p.h / 2);
        ctx.scale(1 + pulse * .06, 1 - pulse * .18);
        ctx.translate(-(p.x + p.w / 2), -(y + p.h / 2));
        if (p.type === PLATFORM.hazard) {
          ctx.fillStyle = '#3b1831';
          roundRect(p.x, y, p.w, p.h, 8); ctx.fill();
          ctx.fillStyle = '#ff4f72';
          for (let x = p.x + 8; x < p.x + p.w - 4; x += 14) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y - 18); ctx.lineTo(x + 14, y); ctx.fill();
          }
        } else {
          ctx.fillStyle = p.type === PLATFORM.fragile ? '#c9893b' : p.type === PLATFORM.boost ? '#ffd166' : biome.platform;
          roundRect(p.x, y, p.w, p.h, 9); ctx.fill();
          ctx.fillStyle = p.type === PLATFORM.fragile ? '#ffe0a3' : p.type === PLATFORM.boost ? '#fff2a8' : biome.platformTop;
          roundRect(p.x + 4, y + 2, p.w - 8, 4, 4); ctx.fill();
          if (p.type === PLATFORM.moving) {
            ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x + 12, y + 9); ctx.lineTo(p.x + p.w - 12, y + 9); ctx.stroke();
          }
          if (p.type === PLATFORM.fragile) {
            ctx.strokeStyle = p.hit ? '#5b321f' : 'rgba(91,50,31,.55)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x + p.w * .28, y + 1); ctx.lineTo(p.x + p.w * .42, y + p.h - 2); ctx.moveTo(p.x + p.w * .62, y + 1); ctx.lineTo(p.x + p.w * .72, y + p.h - 2); ctx.stroke();
          }
          if (p.type === PLATFORM.boost) drawSpring(p.x + p.w / 2, y - 5, p.t);
        }
        ctx.restore();
      }
    }
  }

  // ============================================================
  // COLLECTIBLES / PERKS / HAZARDS
  // ============================================================
  class EntitySystem {
    constructor(game) { this.game = game; this.coins = []; this.perks = []; this.hazards = []; }
    reset() { this.coins = []; this.perks = []; this.hazards = []; }
    spawnCoin(x, y) { this.coins.push({ x, y, r: 7, t: rand(0, 10), taken: false }); }
    spawnPerk(type, x, y) { this.perks.push({ type, x, y, r: 13, t: rand(0, 10), taken: false }); }
    spawnEnemy(x, y) { this.hazards.push({ x, y, w: 34, h: 25, baseX: x, amp: rand(28, 92), speed: rand(.9, 1.7), t: rand(0, 10), dead: false }); }
    update(dt, cameraY, player) {
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const magnet = this.game.hasPerk('magnet');
      for (const c of this.coins) {
        c.t += dt;
        if (magnet) {
          const dx = px - c.x, dy = py - c.y, dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 1) { c.x += dx / dist * 330 * dt; c.y += dy / dist * 330 * dt; }
        }
      }
      for (const p of this.perks) p.t += dt;
      for (const h of this.hazards) {
        h.t += dt;
        h.x = h.baseX + Math.sin(h.t * h.speed) * h.amp;
      }
      const cutoff = cameraY + viewport.h + CONFIG.cleanupMargin;
      this.coins = this.coins.filter(c => c.y < cutoff && !c.taken);
      this.perks = this.perks.filter(p => p.y < cutoff && !p.taken);
      this.hazards = this.hazards.filter(h => h.y < cutoff && !h.dead);
    }
    collide(player) {
      const body = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 8 };
      for (const c of this.coins) {
        if (!c.taken && circleRect(c, body)) {
          c.taken = true;
          this.game.addScore(CONFIG.coinScore * (this.game.hasPerk('multiplier') ? 2 : 1));
          this.game.particles.burst(c.x, c.y, '#ffd166', 8, 90);
          audio.play('collect');
        }
      }
      for (const p of this.perks) {
        if (!p.taken && circleRect(p, body)) {
          p.taken = true;
          this.game.applyPerk(p.type);
          this.game.particles.burst(p.x, p.y, PERKS[p.type].color, 14, 130);
          audio.play('perk');
        }
      }
      for (const h of this.hazards) {
        if (!h.dead && aabb(body, h)) this.game.takeDamage(h);
      }
    }
    draw(cameraY) {
      for (const c of this.coins) {
        const y = c.y - cameraY;
        if (y < -40 || y > viewport.h + 40) continue;
        const bob = Math.sin(c.t * 4) * 3;
        ctx.save(); ctx.translate(c.x, y + bob); ctx.rotate(c.t * 2.4);
        ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 7 + Math.sin(c.t * 5) * 1.2, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      for (const p of this.perks) {
        const meta = PERKS[p.type];
        const y = p.y - cameraY;
        if (y < -50 || y > viewport.h + 50) continue;
        ctx.save(); ctx.translate(p.x, y + Math.sin(p.t * 4) * 4);
        ctx.shadowColor = meta.color; ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(7,16,33,.82)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = meta.color; ctx.lineWidth = 3; ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = meta.color; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(meta.icon, 0, 1);
        ctx.restore();
      }
      for (const h of this.hazards) {
        const y = h.y - cameraY;
        if (y < -60 || y > viewport.h + 60) continue;
        ctx.save(); ctx.translate(h.x + h.w / 2, y + h.h / 2);
        ctx.fillStyle = '#ff5e7a';
        ctx.beginPath(); ctx.ellipse(0, 0, h.w / 2, h.h / 2, Math.sin(h.t) * .12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a0b1b'; ctx.beginPath(); ctx.arc(-7, -2, 3, 0, Math.PI * 2); ctx.arc(7, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a0b1b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, 8); ctx.quadraticCurveTo(0, 3, 8, 8); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ============================================================
  // GAME STATE MANAGER
  // ============================================================
  class Game {
    constructor() {
      this.state = 'start';
      this.time = 0;
      this.player = new Player();
      this.platforms = new PlatformSystem(this);
      this.entities = new EntitySystem(this);
      this.particles = new ParticleSystem();
      this.cameraY = 0;
      this.targetCameraY = 0;
      this.height = 0;
      this.score = 0;
      this.lastHeightForScore = 0;
      this.best = Number(localStorage.getItem(STORAGE.best) || 0);
      this.activePerks = new Map();
      this.biome = BIOMES[0];
      this.prevBiomeId = this.biome.id;
      this.transitionFlash = 0;
      this.gameOverShake = 0;
      this.lastFrame = performance.now();
      this.lastPlatformContact = null;
      this.resetWorld(false);
      this.updateHud();
      this.showStart();
    }
    onResize() {
      if (!this.player) return;
      if (this.state === 'start') this.resetWorld(false);
    }
    resetWorld(startingRun = true) {
      this.time = 0;
      this.cameraY = 0;
      this.targetCameraY = 0;
      this.height = 0;
      this.score = 0;
      this.lastHeightForScore = 0;
      this.activePerks.clear();
      this.player.reset();
      this.entities.reset();
      this.platforms.reset();
      this.particles.items = [];
      this.lastPlatformContact = null;
      this.biome = BIOMES[0];
      this.prevBiomeId = this.biome.id;
      if (startingRun) this.updateHud();
    }
    startRun() {
      audio.unlock(); audio.play('button');
      this.resetWorld(true);
      this.state = 'playing';
      overlay.classList.remove('is-visible');
      pauseBtn.textContent = 'Ⅱ';
      canvas.focus();
    }
    showStart() {
      this.state = 'start';
      overlay.classList.add('is-visible');
      stateEyebrow.textContent = 'arcade vertical jumper';
      stateTitle.textContent = 'Skyward Sprout';
      stateText.textContent = 'Прыгай всё выше, собирай орбы и бонусы, избегай шипов и летающих тварей. Рекорд сохраняется локально.';
      stateStats.innerHTML = `<span class="stat-pill">Рекорд: ${formatInt(this.best)}</span><span class="stat-pill">5 биомов</span><span class="stat-pill">7 бонусов</span>`;
      primaryAction.textContent = 'Начать';
    }
    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        pauseBtn.textContent = '▶';
        this.showPause();
        audio.play('button');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        pauseBtn.textContent = 'Ⅱ';
        overlay.classList.remove('is-visible');
        this.lastFrame = performance.now();
        audio.play('button');
      }
    }
    showPause() {
      overlay.classList.add('is-visible');
      stateEyebrow.textContent = 'пауза';
      stateTitle.textContent = 'Передышка';
      stateText.textContent = 'Продолжай, когда будешь готов. Высота и бонусы сохранены.';
      stateStats.innerHTML = `<span class="stat-pill">Высота: ${formatInt(this.height)} м</span><span class="stat-pill">Счёт: ${formatInt(this.score)}</span>`;
      primaryAction.textContent = 'Продолжить';
    }
    gameOver(reason = 'Падение') {
      if (this.state === 'gameover') return;
      this.state = 'gameover';
      this.gameOverShake = .55;
      audio.play('gameover');
      const final = Math.floor(this.score);
      if (final > this.best) {
        this.best = final;
        localStorage.setItem(STORAGE.best, String(this.best));
      }
      overlay.classList.add('is-visible');
      stateEyebrow.textContent = reason;
      stateTitle.textContent = 'Забег окончен';
      stateText.textContent = 'Росток сорвался вниз. Нажми рестарт и попробуй улучшить траекторию.';
      stateStats.innerHTML = `<span class="stat-pill">Высота: ${formatInt(this.height)} м</span><span class="stat-pill">Счёт: ${formatInt(this.score)}</span><span class="stat-pill">Рекорд: ${formatInt(this.best)}</span>`;
      primaryAction.textContent = 'Играть снова';
      this.updateHud();
    }
    addScore(points) { this.score += points; }
    hasPerk(type) { return this.activePerks.has(type) && this.activePerks.get(type) > 0; }
    applyPerk(type) {
      const meta = PERKS[type];
      if (!meta) return;
      if (type === 'spring') {
        this.player.jump(1.42);
        return;
      }
      if (type === 'doubleJump') this.player.doubleReady = true;
      if (type === 'shield') this.player.invuln = .8;
      this.activePerks.set(type, meta.duration);
    }
    tryEmergencyJump() {
      audio.unlock();
      if (this.state === 'start' || this.state === 'gameover') { this.startRun(); return; }
      if (this.state === 'paused') { this.togglePause(); return; }
      if (this.state !== 'playing') return;
      if (this.hasPerk('doubleJump') && this.player.doubleReady) {
        this.player.doubleReady = false;
        this.player.jump(.92);
        this.particles.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h, '#bfff69', 14, 130);
        audio.play('jump');
      }
    }
    takeDamage(hazard) {
      if (this.player.invuln > 0) return;
      if (this.hasPerk('shield')) {
        this.activePerks.delete('shield');
        this.player.invuln = 1.2;
        if (hazard) hazard.dead = true;
        this.particles.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#69f7ff', 18, 190);
        audio.play('shield');
      } else {
        audio.play('damage');
        this.gameOver('Столкновение');
      }
    }
    spawnAroundPlatform(p, height) {
      if (p.type !== PLATFORM.hazard && chance(.56)) {
        const count = chance(.22) ? 3 : 1;
        for (let i = 0; i < count; i++) this.entities.spawnCoin(p.x + p.w * (.28 + i * .22), p.y - rand(28, 54) - i * 5);
      }
      if (p.type !== PLATFORM.hazard && height > 160 && chance(.075)) {
        const keys = Object.keys(PERKS);
        const type = keys[Math.floor(Math.random() * keys.length)];
        this.entities.spawnPerk(type, clamp(p.x + p.w / 2 + rand(-22, 22), 24, viewport.w - 24), p.y - rand(42, 78));
      }
      if (height > 900 && chance(clamp(height / 9000, .04, .15))) this.entities.spawnEnemy(rand(38, viewport.w - 72), p.y - rand(70, 135));
    }
    update(dt) {
      if (this.state !== 'playing') return;
      this.time += dt;
      this.player.update(dt, this);

      const desiredCamera = this.player.y - viewport.h * CONFIG.cameraLead;
      if (desiredCamera < this.targetCameraY) this.targetCameraY = desiredCamera;
      this.cameraY = lerp(this.cameraY, this.targetCameraY, 1 - Math.pow(.0009, dt));
      this.height = Math.max(this.height, Math.floor(-this.cameraY));
      const gainedHeight = Math.max(0, this.height - this.lastHeightForScore);
      if (gainedHeight > 0) {
        this.score += gainedHeight * CONFIG.heightScoreFactor * (this.hasPerk('multiplier') ? 2 : 1);
        this.lastHeightForScore = this.height;
      }

      this.updateBiome();
      this.platforms.ensureAhead(this.cameraY);
      this.platforms.update(dt, this.cameraY);
      this.entities.update(dt, this.cameraY, this.player);
      this.particles.update(dt);
      this.handlePlatformCollisions(dt);
      this.entities.collide(this.player);
      this.updatePerks(dt);
      if (this.player.y > this.cameraY + viewport.h + CONFIG.deathMargin) this.gameOver('Падение');
      this.updateHud();
    }
    handlePlatformCollisions(dt) {
      if (this.player.vy <= 0) return;
      const prevBottom = this.player.y + this.player.h - this.player.vy * dt;
      const body = { x: this.player.x + 3, y: this.player.y, w: this.player.w - 6, h: this.player.h };
      for (const p of this.platforms.items) {
        if (!p.active || !aabb(body, p)) continue;
        const currentBottom = this.player.y + this.player.h;
        const landedFromAbove = prevBottom <= p.y + 6 && currentBottom >= p.y;
        if (!landedFromAbove) continue;
        if (p.type === PLATFORM.hazard) { this.takeDamage(p); return; }
        this.player.y = p.y - this.player.h;
        let power = 1;
        if (p.type === PLATFORM.boost) power = 1.36;
        if (p.type === PLATFORM.fragile) {
          p.active = false;
          this.particles.burst(p.x + p.w / 2, p.y, '#c9893b', 14, 130);
        }
        this.player.jump(power);
        this.player.doubleReady = this.hasPerk('doubleJump');
        p.landingPulse = 1;
        this.lastPlatformContact = p;
        this.particles.burst(this.player.x + this.player.w / 2, p.y, this.biome.particle, 10, 110);
        audio.play(p.type === PLATFORM.boost ? 'perk' : 'jump');
        break;
      }
    }
    updatePerks(dt) {
      for (const [type, t] of [...this.activePerks.entries()]) {
        const next = t - dt;
        if (next <= 0) this.activePerks.delete(type);
        else this.activePerks.set(type, next);
      }
    }
    updateBiome() {
      const current = getBiome(this.height);
      if (current.id !== this.prevBiomeId) {
        this.transitionFlash = 1;
        this.prevBiomeId = current.id;
        audio.play('biome');
      }
      this.biome = current;
      this.transitionFlash = Math.max(0, this.transitionFlash - 0.012);
    }
    updateHud() {
      heightValue.textContent = `${formatInt(this.height)} м`;
      scoreValue.textContent = formatInt(this.score);
      bestValue.textContent = formatInt(this.best);
      perkTray.innerHTML = '';
      for (const [type, time] of this.activePerks.entries()) {
        const meta = PERKS[type];
        const chip = document.createElement('span');
        chip.className = 'perk-chip';
        chip.style.borderColor = meta.color;
        chip.innerHTML = `<b style="color:${meta.color}">${meta.icon}</b> ${meta.label} ${Math.ceil(time)}s`;
        perkTray.appendChild(chip);
      }
    }
    render() {
      drawBackground(this.cameraY, this.height, this.biome, this.time);
      const shake = this.gameOverShake;
      if (shake > 0) {
        this.gameOverShake = Math.max(0, shake - 0.018);
        ctx.save();
        ctx.translate(rand(-8, 8) * shake, rand(-8, 8) * shake);
      }
      this.platforms.draw(this.cameraY, this.biome);
      this.entities.draw(this.cameraY);
      this.particles.draw(this.cameraY);
      this.player.draw(this.cameraY, this);
      if (shake > 0) ctx.restore();

      if (this.transitionFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.transitionFlash * .16})`;
        ctx.fillRect(0, 0, viewport.w, viewport.h);
      }
      if (this.state === 'start') drawAttractMode(this.time);
    }
    loop(now) {
      const dt = Math.min((now - this.lastFrame) / 1000, 0.033);
      this.lastFrame = now;
      this.update(dt);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // ============================================================
  // DRAW HELPERS / BIOMES
  // ============================================================
  function getBiome(height) {
    const idx = BIOMES.findIndex(b => height >= b.from && height < b.to);
    const current = BIOMES[Math.max(0, idx)];
    const next = BIOMES[Math.min(BIOMES.length - 1, Math.max(0, idx) + 1)];
    if (!next || next === current || !Number.isFinite(current.to)) return current;
    const span = current.to - current.from;
    const t = clamp((height - (current.to - span * .25)) / (span * .25), 0, 1);
    return {
      ...current,
      skyTop: mixColor(current.skyTop, next.skyTop, t),
      skyBottom: mixColor(current.skyBottom, next.skyBottom, t),
      platform: mixColor(current.platform, next.platform, t),
      platformTop: mixColor(current.platformTop, next.platformTop, t),
      particle: mixColor(current.particle, next.particle, t),
      name: t > .55 ? next.name : current.name,
      id: t > .9 ? next.id : current.id,
    };
  }

  function drawBackground(cameraY, height, biome, time) {
    const g = ctx.createLinearGradient(0, 0, 0, viewport.h);
    g.addColorStop(0, biome.skyTop);
    g.addColorStop(1, biome.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewport.w, viewport.h);

    const layerColor = biome.id === 'space' || biome.id === 'neon' ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.38)';
    ctx.fillStyle = layerColor;
    const count = biome.id === 'space' || biome.id === 'neon' ? 70 : 26;
    for (let i = 0; i < count; i++) {
      const px = ((i * 97 + Math.sin(i) * 40) % viewport.w + viewport.w) % viewport.w;
      const speed = biome.id === 'space' || biome.id === 'neon' ? .22 : .09;
      const py = ((i * 173 + cameraY * speed) % (viewport.h + 90)) - 45;
      const r = biome.id === 'space' || biome.id === 'neon' ? (i % 3 === 0 ? 1.8 : 1) : 2 + (i % 4);
      ctx.globalAlpha = biome.id === 'clouds' ? .48 : .3 + (i % 4) * .08;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (biome.id === 'neon') {
      ctx.strokeStyle = 'rgba(255,77,248,.16)';
      ctx.lineWidth = 1;
      for (let y = ((cameraY * .35) % 44) - 44; y < viewport.h; y += 44) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewport.w, y + Math.sin(time + y) * 14); ctx.stroke();
      }
    }
  }

  function drawAttractMode(time) {
    ctx.save();
    ctx.globalAlpha = .22 + Math.sin(time * 3) * .06;
    ctx.fillStyle = '#fff';
    ctx.font = '900 72px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('↑', viewport.w / 2, viewport.h * .78);
    ctx.restore();
  }

  function drawSpring(x, y, t) {
    ctx.save();
    ctx.strokeStyle = '#ad4d00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const px = x + (i % 2 ? 10 : -10);
      const py = y - i * (4 + Math.sin(t * 5) * .4);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSpringIcon(x, y) { drawSpring(x, y, 0); }

  function circleRect(circle, rect) {
    const nx = clamp(circle.x, rect.x, rect.x + rect.w);
    const ny = clamp(circle.y, rect.y, rect.y + rect.h);
    return Math.hypot(circle.x - nx, circle.y - ny) < circle.r + 2;
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  const audio = new AudioManager();
  const game = new Game();

  primaryAction.addEventListener('click', () => {
    audio.unlock();
    if (game.state === 'paused') game.togglePause(); else game.startRun();
  });
  pauseBtn.addEventListener('click', () => { audio.unlock(); game.togglePause(); });
  muteBtn.addEventListener('click', () => audio.toggleMute());
  canvas.addEventListener('pointerdown', () => { audio.unlock(); if (game.state === 'start') game.startRun(); });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 180));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);

  resizeCanvas();
  requestAnimationFrame((t) => { game.lastFrame = t; game.loop(t); });

  // Expose a tiny debug surface for automated/manual verification without polluting gameplay.
  window.__SkywardSprout = { game, resizeCanvas, PHYSICS, CONFIG };
})();
