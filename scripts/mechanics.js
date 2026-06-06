/* ═══════════════════════════════════════════════
   mechanics.js — Game mechanic renderers
   Each activity type renders itself and returns
   a Promise that resolves with { score, maxScore }.
   ═══════════════════════════════════════════════ */

const Mechanics = (() => {

  /* ── SORT mechanic ──────────────────────────
     Items appear one at a time. Player clicks
     the correct bin. Immediate feedback per item.
  ─────────────────────────────────────────────── */
  function renderSort(activity, container, onComplete) {
    const { bins, items } = activity;
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    let current = 0, correct = 0;

    container.innerHTML = `
      <div class="activity-wrap">
        <h2 class="activity-title">${activity.title}</h2>
        <p class="activity-instruction">${activity.instruction}</p>
        <div class="sort-wrap">
          <div class="sort-card-display">
            <div class="sort-card-label">SORT THIS INTO →</div>
            <div class="sort-card-text" id="sort-text"></div>
            <div class="sort-card-sub" id="sort-sub"></div>
          </div>
          <div class="sort-progress" id="sort-prog"></div>
          <div class="sort-bins" id="sort-bins"></div>
          <div class="sort-score" id="sort-score"></div>
        </div>
      </div>`;

    const binsEl = container.querySelector('#sort-bins');
    bins.forEach(bin => {
      const el = document.createElement('div');
      el.className = 'sort-bin';
      el.style.borderColor = bin.color;
      el.dataset.bin = bin.id;
      el.innerHTML = `<div class="sort-bin-icon">${bin.icon}</div>
                      <div class="sort-bin-label" style="color:${bin.color}">${bin.label}</div>
                      <div class="sort-bin-desc">${bin.desc}</div>`;
      el.addEventListener('click', () => handleBinClick(bin.id, el));
      binsEl.appendChild(el);
    });

    function handleBinClick(binId, binEl) {
      const item = shuffled[current];
      const isCorrect = binId === item.bin;
      if (isCorrect) {
        correct++;
        binEl.classList.add('correct-flash');
        Sound.play('correct');
      } else {
        binEl.classList.add('wrong-flash');
        Sound.play('wrong');
        // also briefly highlight the correct bin
        const correctEl = binsEl.querySelector(`[data-bin="${item.bin}"]`);
        setTimeout(() => correctEl && correctEl.classList.add('correct-flash'), 400);
      }

      // Show explanation momentarily
      container.querySelector('#sort-sub').textContent = item.explain;

      setTimeout(() => {
        document.querySelectorAll('.sort-bin').forEach(b => {
          b.classList.remove('correct-flash', 'wrong-flash');
        });
        current++;
        if (current < shuffled.length) {
          showItem();
        } else {
          onComplete({ score: correct, maxScore: shuffled.length });
        }
      }, isCorrect ? 900 : 1800);
    }

    function showItem() {
      const item = shuffled[current];
      container.querySelector('#sort-text').textContent = item.text;
      container.querySelector('#sort-sub').textContent = '';
      container.querySelector('#sort-prog').textContent = `${current + 1} of ${shuffled.length}`;
      container.querySelector('#sort-score').textContent = `✓ ${correct} correct`;
    }

    showItem();
  }

  /* ── CONNECT mechanic ───────────────────────
     Two columns. Click left item, then right
     item to draw a connection line.
  ─────────────────────────────────────────────── */
  function renderConnect(activity, container, onComplete) {
    const { pairs } = activity;
    const shuffledRight = [...pairs].sort(() => Math.random() - 0.5);
    let selectedLeft = null;
    let matchCount = 0;
    const matched = new Set();

    container.innerHTML = `
      <div class="activity-wrap">
        <h2 class="activity-title">${activity.title}</h2>
        <p class="activity-instruction">${activity.instruction}</p>
        <div class="connect-wrap" id="connect-wrap">
          <div class="connect-col left" id="connect-left"></div>
          <svg class="connect-svg" id="connect-svg"></svg>
          <div class="connect-col right" id="connect-right"></div>
        </div>
        <div style="margin-top:16px;text-align:center">
          <button class="btn-primary" id="connect-check" style="display:none" onclick="">Check Connections</button>
        </div>
      </div>`;

    const leftCol  = container.querySelector('#connect-left');
    const rightCol = container.querySelector('#connect-right');

    pairs.forEach(p => {
      const el = document.createElement('div');
      el.className = 'connect-node';
      el.dataset.leftId = p.leftId;
      el.dataset.rightId = p.rightId;
      el.textContent = p.left;
      el.addEventListener('click', () => selectLeft(el, p));
      leftCol.appendChild(el);
    });

    shuffledRight.forEach(p => {
      const el = document.createElement('div');
      el.className = 'connect-node';
      el.dataset.rightId = p.rightId;
      el.dataset.leftId = p.leftId;
      el.textContent = p.right;
      el.addEventListener('click', () => selectRight(el, p));
      rightCol.appendChild(el);
    });

    function selectLeft(el, pair) {
      if (matched.has(pair.leftId)) return;
      document.querySelectorAll('.connect-col.left .connect-node').forEach(n => n.classList.remove('selected'));
      el.classList.add('selected');
      selectedLeft = { el, pair };
    }

    function selectRight(el, pair) {
      if (!selectedLeft || matched.has(pair.rightId)) return;
      const leftPair = selectedLeft.pair;
      const isCorrect = leftPair.leftId === pair.leftId;

      if (isCorrect) {
        selectedLeft.el.classList.remove('selected');
        selectedLeft.el.classList.add('matched');
        el.classList.add('matched');
        matched.add(leftPair.leftId);
        matched.add(leftPair.rightId);
        drawLine(selectedLeft.el, el, true);
        Sound.play('correct');
        matchCount++;
        selectedLeft = null;
        if (matchCount === pairs.length) {
          setTimeout(() => onComplete({ score: matchCount, maxScore: pairs.length }), 800);
        }
      } else {
        selectedLeft.el.classList.remove('selected');
        el.classList.add('wrong');
        Sound.play('wrong');
        setTimeout(() => el.classList.remove('wrong'), 600);
        selectedLeft = null;
      }
    }

    function drawLine(leftEl, rightEl, isCorrect) {
      // On desktop: draw SVG Bézier curve
      const svg = container.querySelector('#connect-svg');
      if (svg && window.innerWidth > 640) {
        const wrap = container.querySelector('#connect-wrap');
        const wrapRect = wrap.getBoundingClientRect();
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();
        const x1 = lRect.right  - wrapRect.left;
        const y1 = lRect.top + lRect.height / 2 - wrapRect.top;
        const x2 = rRect.left  - wrapRect.left;
        const y2 = rRect.top + rRect.height / 2 - wrapRect.top;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const mx = (x1 + x2) / 2;
        line.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        line.setAttribute('class', isCorrect ? 'connect-line' : 'connect-line-pending');
        svg.appendChild(line);
      }
      // On mobile: badge the right-side node with a match number
      if (isCorrect) {
        const n = container.querySelectorAll('.connect-node.matched').length;
        leftEl.style.borderLeftColor = `var(--green)`;
        rightEl.dataset.matchNum = n;
      }
    }
  }

  /* ── CONFIGURE mechanic ─────────────────────
     Toggle settings and see impact scores update
     in real time. Hit Apply when satisfied.
  ─────────────────────────────────────────────── */
  function renderConfigure(activity, container, onComplete) {
    const { scenarios, toggles, targetToggles, successMessage } = activity;
    const scenario = scenarios[0];
    const state = {};
    toggles.forEach(t => state[t.id] = false);

    let scores = computeScores();

    container.innerHTML = `
      <div class="activity-wrap">
        <h2 class="activity-title">${activity.title}</h2>
        <p class="activity-instruction">${activity.instruction}</p>
        <div class="configure-wrap">
          <div class="scenario-panel">
            <div class="scenario-tag">SCENARIO</div>
            <div class="scenario-icon">${scenario.icon}</div>
            <div class="scenario-name">${scenario.name}</div>
            <div class="scenario-details">${scenario.context}<br><br>${scenario.details}</div>
          </div>
          <div class="config-panel">
            <h4>CONFIGURATION</h4>
            <div id="toggle-list"></div>
          </div>
        </div>
        <div class="impact-panel">
          <h4>LIVE IMPACT</h4>
          <div class="impact-bars" id="impact-bars"></div>
          <button class="btn-primary apply-btn" onclick="Mechanics._applyConfig()">Apply Configuration →</button>
        </div>
      </div>`;

    renderToggles();
    renderImpact();

    function renderToggles() {
      const list = container.querySelector('#toggle-list');
      list.innerHTML = '';
      toggles.forEach(t => {
        const row = document.createElement('div');
        row.className = 'config-toggle';
        row.innerHTML = `<div>
            <div class="config-toggle-label">${t.label}</div>
            <div class="config-toggle-sub">${t.sub}</div>
          </div>
          <div class="toggle-switch ${state[t.id] ? 'on' : ''}" id="toggle-${t.id}"></div>`;
        row.querySelector('.toggle-switch').addEventListener('click', () => {
          state[t.id] = !state[t.id];
          row.querySelector('.toggle-switch').classList.toggle('on', state[t.id]);
          scores = computeScores();
          renderImpact();
        });
        list.appendChild(row);
      });
    }

    function computeScores() {
      const s = {};
      toggles.forEach(t => {
        if (!state[t.id]) return;
        Object.entries(t.impact).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
      });
      return s;
    }

    function renderImpact() {
      const barsEl = container.querySelector('#impact-bars');
      const keys = [...new Set(toggles.flatMap(t => Object.keys(t.impact)))];
      barsEl.innerHTML = keys.map(k => {
        const raw = scores[k] || 0;
        const pct = Math.max(0, Math.min(100, 50 + raw));
        const color = k === 'risk' ? '#ef4444' : k === 'friction' ? '#f59e0b' : '#10b981';
        const label = k.charAt(0).toUpperCase() + k.slice(1);
        return `<div class="impact-bar-row">
          <div class="impact-bar-label">${label}</div>
          <div class="impact-bar-track"><div class="impact-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="impact-score">${pct}%</div>
        </div>`;
      }).join('');
    }

    // Exposed for onclick
    Mechanics._applyConfig = function() {
      const active = Object.entries(state).filter(([,v]) => v).map(([k]) => k);
      const correct = targetToggles.filter(t => active.includes(t)).length;
      const wrong   = active.filter(t => !targetToggles.includes(t)).length;
      const score   = Math.max(0, correct - wrong);
      App.showFeedback(
        score >= targetToggles.length - 1,
        score >= targetToggles.length - 1 ? '✅ Configuration Applied!' : '⚠️ Not Quite Right',
        successMessage
      );
      setTimeout(() => onComplete({ score, maxScore: targetToggles.length }), 200);
    };
  }

  /* ── FLOW mechanic ──────────────────────────
     Click steps from the bank in correct order
     to fill the sequence slots.
  ─────────────────────────────────────────────── */
  function renderFlow(activity, container, onComplete) {
    const { steps, correctOrder } = activity;
    const shuffled = [...steps].sort(() => Math.random() - 0.5);
    const playerSeq = [];
    let correct = 0;

    container.innerHTML = `
      <div class="activity-wrap">
        <h2 class="activity-title">${activity.title}</h2>
        <p class="activity-instruction">${activity.instruction}</p>
        <div class="flow-wrap">
          <div class="flow-bank" id="flow-bank"></div>
          <div class="flow-sequence">
            <h4>YOUR SEQUENCE — click steps above in the correct order</h4>
            <div id="flow-slots"></div>
          </div>
        </div>
      </div>`;

    const bank  = container.querySelector('#flow-bank');
    const slots = container.querySelector('#flow-slots');

    // Render sequence slots
    correctOrder.forEach((_, i) => {
      const slot = document.createElement('div');
      slot.className = 'flow-slot';
      slot.id = `slot-${i}`;
      slot.innerHTML = `<span class="slot-num">${i + 1}</span><span class="slot-text" style="color:var(--muted)">— waiting —</span>`;
      slots.appendChild(slot);
    });

    // Render step buttons
    shuffled.forEach(step => {
      const btn = document.createElement('div');
      btn.className = 'flow-step';
      btn.textContent = step;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('used')) return;
        const idx = playerSeq.length;
        if (idx >= correctOrder.length) return;

        const isCorrect = step === correctOrder[idx];
        btn.classList.add('used');
        const slot = container.querySelector(`#slot-${idx}`);
        slot.classList.add('filled');
        slot.querySelector('.slot-text').textContent = step;
        slot.querySelector('.slot-text').style.color = isCorrect ? 'var(--green)' : 'var(--red)';

        if (isCorrect) { correct++; Sound.play('correct'); }
        else { Sound.play('wrong'); }

        playerSeq.push(step);

        if (playerSeq.length === correctOrder.length) {
          setTimeout(() => {
            if (correct === correctOrder.length) {
              App.showFeedback(true, '✅ Perfect Sequence!', activity.successMessage);
            } else {
              App.showFeedback(false, '⚠️ Some Steps Were Wrong', activity.successMessage + ' Review the correct order above.');
            }
            setTimeout(() => onComplete({ score: correct, maxScore: correctOrder.length }), 300);
          }, 600);
        }
      });
      bank.appendChild(btn);
    });
  }

  return { renderSort, renderConnect, renderConfigure, renderFlow };

})();
