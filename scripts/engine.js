/* ═══════════════════════════════════════════════
   engine.js — State, scoring, achievements,
                persistence, particles, sound
   ═══════════════════════════════════════════════ */

/* ── PERSISTENT STATE ───────────────────────── */
const State = (() => {
  const KEY = 'nexus_iam_v1';
  const defaults = {
    xp: 0,
    moduleProgress: {},   // { [moduleId]: { stars, xpEarned, completed } }
    achievements: [],
    streak: 0,
    lastPlay: null,
  };

  function load() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY)) }; }
    catch { return { ...defaults }; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function reset() { localStorage.removeItem(KEY); }

  return { load, save, reset };
})();

let G = State.load(); // global game state

/* ── LEVEL UTILITIES ────────────────────────── */
function getLevel(xp) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.min) lvl = l; }
  return lvl;
}
function getXPPercent(xp) {
  const lvl = getLevel(xp);
  const range = lvl.next - lvl.min;
  return Math.min(100, ((xp - lvl.min) / range) * 100);
}

/* ── ACHIEVEMENT CHECK ──────────────────────── */
function checkAchievements(moduleId, stars, newXP) {
  const unlocked = [];
  const mod = MODULES.find(m => m.id === moduleId);

  // Module-specific achievement
  if (mod && mod.achievementUnlock) {
    const ach = mod.achievementUnlock;
    const needStars = ach === 'mfa_evangelist' || ach === 'zero_trust';
    if (!G.achievements.includes(ach) && (!needStars || stars === 3)) {
      G.achievements.push(ach);
      unlocked.push(ach);
    }
  }

  // First mission
  if (!G.achievements.includes('first_blood') && moduleId) {
    G.achievements.push('first_blood');
    unlocked.push('first_blood');
  }

  // Speed demon (3 stars)
  if (stars === 3 && !G.achievements.includes('speed_demon')) {
    G.achievements.push('speed_demon');
    unlocked.push('speed_demon');
  }

  // All missions completed
  const allDone = MODULES.every(m => G.moduleProgress[m.id]?.completed);
  if (allDone && !G.achievements.includes('all_missions')) {
    G.achievements.push('all_missions');
    unlocked.push('all_missions');
  }

  // Perfect run: 5 consecutive 3-star modules
  const completed = MODULES.filter(m => G.moduleProgress[m.id]?.completed)
    .sort((a, b) => a.id - b.id);
  let consecutive = 0, maxConsecutive = 0;
  for (const m of completed) {
    if (G.moduleProgress[m.id]?.stars === 3) { consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive); }
    else consecutive = 0;
  }
  if (maxConsecutive >= 5 && !G.achievements.includes('perfect_run')) {
    G.achievements.push('perfect_run');
    unlocked.push('perfect_run');
  }

  State.save(G);
  return unlocked;
}

/* ── SOUND ──────────────────────────────────── */
const Sound = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, duration, type = 'sine', vol = 0.15) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.start(c.currentTime); osc.stop(c.currentTime + duration);
    } catch {}
  }
  return {
    play(event) {
      if (event === 'correct')  { tone(523, 0.1); setTimeout(() => tone(659, 0.15), 80); }
      if (event === 'wrong')    { tone(200, 0.2, 'sawtooth', 0.1); }
      if (event === 'complete') { [523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f, 0.2), i * 100)); }
      if (event === 'levelup')  { [392,523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f, 0.25), i * 80)); }
      if (event === 'achieve')  { tone(880, 0.15); setTimeout(() => tone(1047, 0.3), 120); }
      if (event === 'click')    { tone(440, 0.05, 'sine', 0.05); }
    }
  };
})();

/* ── PARTICLE BACKGROUND ────────────────────── */
const Particles = (() => {
  let canvas, ctx2d, particles, raf;
  const COUNT = 60;

  function init() {
    canvas = document.getElementById('bg-canvas');
    ctx2d  = canvas.getContext('2d');
    resize();
    particles = Array.from({ length: COUNT }, () => makeParticle());
    loop();
    window.addEventListener('resize', resize);
  }

  function makeParticle() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
    };
  }
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function loop() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.fillStyle = '#0a0a1a';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx2d.beginPath();
          ctx2d.strokeStyle = `rgba(0,212,255,${0.08 * (1 - d / 120)})`;
          ctx2d.lineWidth = 0.5;
          ctx2d.moveTo(particles[i].x, particles[i].y);
          ctx2d.lineTo(particles[j].x, particles[j].y);
          ctx2d.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;  if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(0,212,255,${p.alpha})`;
      ctx2d.fill();
    });

    raf = requestAnimationFrame(loop);
  }

  return { init };
})();
