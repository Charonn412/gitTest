/* ═══════════════════════════════════════════════
   main.js — App controller: screen management,
              mission flow, UI orchestration
   ═══════════════════════════════════════════════ */

const App = (() => {

  /* ── Internal state ─────────────────────── */
  let currentModule  = null;
  let currentActIdx  = 0;
  let sessionScore   = 0;
  let sessionMax     = 0;
  let streak         = 0;

  /* ── Screen management ──────────────────── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const el = document.getElementById(id);
    el.style.display = 'flex';
    el.classList.add('active');
  }

  /* ── HOME ───────────────────────────────── */
  function showHome() {
    showScreen('screen-home');
    const stats = document.getElementById('home-stats');
    const lvl   = getLevel(G.xp);
    const done  = Object.values(G.moduleProgress).filter(p => p.completed).length;
    const ach   = G.achievements.length;
    stats.innerHTML = `
      <div class="home-stat"><span class="home-stat-val">${G.xp}</span><span class="home-stat-lbl">Total XP</span></div>
      <div class="home-stat"><span class="home-stat-val">${lvl.label.split(' ')[1] || lvl.label}</span><span class="home-stat-lbl">Level</span></div>
      <div class="home-stat"><span class="home-stat-val">${done}/16</span><span class="home-stat-lbl">Missions</span></div>
      <div class="home-stat"><span class="home-stat-val">${ach}/${ACHIEVEMENTS.length}</span><span class="home-stat-lbl">Badges</span></div>`;
  }

  /* ── MISSION MAP ────────────────────────── */
  function showMap() {
    showScreen('screen-map');
    updateMapHUD();

    const grid = document.getElementById('mission-grid');
    grid.innerHTML = '';
    MODULES.forEach((mod, i) => {
      const prog = G.moduleProgress[mod.id] || {};
      const isLocked = i > 0 && !G.moduleProgress[MODULES[i - 1].id]?.completed;
      const stars = prog.stars || 0;

      const card = document.createElement('div');
      card.className = `mission-card${isLocked ? ' locked' : ''}${prog.completed ? ' completed' : ''}`;
      card.style.setProperty('--accent', mod.color);
      card.innerHTML = `
        <div class="mission-num">${mod.mission}</div>
        <div class="mission-icon">${mod.icon}</div>
        <div class="mission-name">${mod.title}</div>
        <div class="mission-sub">${mod.subtitle}</div>
        ${isLocked
          ? '<div class="mission-lock">🔒</div>'
          : `<div class="mission-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`}`;

      if (!isLocked) {
        card.addEventListener('click', () => {
          Sound.play('click');
          showBriefing(mod);
        });
      }
      grid.appendChild(card);
    });
  }

  function updateMapHUD() {
    const lvl = getLevel(G.xp);
    document.getElementById('map-level-label').textContent = lvl.label;
    document.getElementById('map-xp-bar').style.width = getXPPercent(G.xp) + '%';
    document.getElementById('map-xp-label').textContent = `${G.xp} XP`;
  }

  /* ── BRIEFING ───────────────────────────── */
  function showBriefing(mod) {
    currentModule  = mod;
    currentActIdx  = 0;
    sessionScore   = 0;
    sessionMax     = 0;
    streak         = 0;

    document.getElementById('brief-badge').textContent   = mod.icon;
    document.getElementById('brief-mission').textContent = `${mod.mission} · ${mod.subtitle}`;
    document.getElementById('brief-title').textContent   = mod.title;
    document.getElementById('brief-context').textContent = mod.context;

    const ul = document.getElementById('brief-bullets');
    ul.innerHTML = mod.bullets.map(b => `<li>${b}</li>`).join('');

    showScreen('screen-briefing');
  }

  /* ── MISSION START ──────────────────────── */
  function startMission() {
    showScreen('screen-game');
    loadActivity();
  }

  /* ── LOAD ACTIVITY ──────────────────────── */
  function loadActivity() {
    const mod = currentModule;
    const act = mod.activities[currentActIdx];
    const total = mod.activities.length;

    // HUD
    document.getElementById('game-mission-label').textContent   = `${mod.mission}: ${mod.title}`;
    document.getElementById('activity-prog-label').textContent  = `Activity ${currentActIdx + 1} of ${total}`;
    document.getElementById('activity-prog-fill').style.width   = `${((currentActIdx) / total) * 100}%`;
    document.getElementById('streak-display').textContent       = `🔥 ${streak}`;
    document.getElementById('score-display').textContent        = `${sessionScore} XP`;

    const content = document.getElementById('game-content');
    content.innerHTML = '';
    hideFeedback();

    const onComplete = ({ score, maxScore }) => {
      const isGood = score / maxScore >= 0.6;
      sessionScore += score * 25;
      sessionMax   += maxScore * 25;
      if (isGood) streak++; else streak = 0;
      document.getElementById('streak-display').textContent = `🔥 ${streak}`;
      document.getElementById('score-display').textContent  = `${sessionScore} XP`;
      // Auto-advance after a short pause if feedback was already shown by mechanic
      setTimeout(() => nextActivity(), isGood ? 0 : 0);
    };

    if (act.type === 'sort')      Mechanics.renderSort(act, content, onComplete);
    else if (act.type === 'connect')   Mechanics.renderConnect(act, content, onComplete);
    else if (act.type === 'configure') Mechanics.renderConfigure(act, content, onComplete);
    else if (act.type === 'flow')      Mechanics.renderFlow(act, content, onComplete);
  }

  /* ── FEEDBACK OVERLAY ───────────────────── */
  function showFeedback(isCorrect, title, body) {
    const overlay = document.getElementById('feedback-overlay');
    const card    = document.getElementById('feedback-card');
    card.className = `feedback-card ${isCorrect ? 'correct' : 'wrong'}`;
    document.getElementById('feedback-icon').textContent  = isCorrect ? '✅' : '⚠️';
    document.getElementById('feedback-title').textContent = title;
    document.getElementById('feedback-body').textContent  = body;
    overlay.classList.remove('hidden');
    Sound.play(isCorrect ? 'correct' : 'wrong');
  }

  function hideFeedback() {
    document.getElementById('feedback-overlay').classList.add('hidden');
  }

  /* ── NEXT ACTIVITY ──────────────────────── */
  function nextActivity() {
    hideFeedback();
    currentActIdx++;
    if (currentActIdx < currentModule.activities.length) {
      loadActivity();
    } else {
      completeMission();
    }
  }

  /* ── MISSION COMPLETE ───────────────────── */
  function completeMission() {
    const mod   = currentModule;
    const pct   = sessionMax > 0 ? sessionScore / sessionMax : 0;
    const stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : 1;
    const xpEarned = mod.xpReward + (stars - 1) * 50 + streak * 10;

    // Update state
    const prev = G.moduleProgress[mod.id] || {};
    G.moduleProgress[mod.id] = {
      completed: true,
      stars: Math.max(prev.stars || 0, stars),
      xpEarned: (prev.xpEarned || 0) + xpEarned,
    };
    G.xp += xpEarned;
    State.save(G);

    // Check achievements
    const newAch = checkAchievements(mod.id, stars, xpEarned);

    Sound.play('complete');
    showScreen('screen-complete');

    document.getElementById('complete-title').textContent = `Mission ${mod.mission} Complete!`;
    document.getElementById('complete-stars').innerHTML   = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('complete-xp').textContent   = `+${xpEarned} XP`;

    const conceptsEl = document.getElementById('complete-concepts');
    conceptsEl.innerHTML = `<h4>WHAT YOU LEARNED</h4><ul>
      ${mod.concepts.map(c => `<li>${c}</li>`).join('')}
    </ul>`;

    const achEl = document.getElementById('complete-achievements');
    achEl.innerHTML = newAch.map(a => {
      const def = ACHIEVEMENTS.find(x => x.id === a);
      return def ? `<div class="ach-unlock-badge">${def.icon} ${def.name} unlocked!</div>` : '';
    }).join('');
    if (newAch.length) Sound.play('achieve');

    const nextMod = MODULES.find(m => m.id === mod.id + 1);
    document.getElementById('btn-next-mission').style.display = nextMod ? '' : 'none';
  }

  /* ── NEXT MISSION ───────────────────────── */
  function nextMission() {
    const next = MODULES.find(m => m.id === currentModule.id + 1);
    if (next) showBriefing(next);
    else showMap();
  }

  /* ── EXIT TO MAP ────────────────────────── */
  function exitToMap() {
    if (confirm('Exit this mission? Progress in the current activity will be lost.')) {
      showMap();
    }
  }

  /* ── ACHIEVEMENTS SCREEN ────────────────── */
  function showAchievements() {
    showScreen('screen-achievements');
    document.getElementById('ach-count').textContent = `${G.achievements.length} / ${ACHIEVEMENTS.length} unlocked`;

    const grid = document.getElementById('ach-grid');
    grid.innerHTML = ACHIEVEMENTS.map(a => {
      const earned = G.achievements.includes(a.id);
      return `<div class="ach-card ${earned ? 'earned' : 'locked'}">
        <div class="ach-icon">${earned ? a.icon : '🔒'}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${earned ? a.desc : '???'}</div>
      </div>`;
    }).join('');
  }

  /* ── INIT ───────────────────────────────── */
  function init() {
    Particles.init();
    showHome();
  }

  return {
    showHome, showMap, showBriefing, startMission,
    nextActivity, nextMission, exitToMap,
    showAchievements, showFeedback, hideFeedback,
    init,
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
