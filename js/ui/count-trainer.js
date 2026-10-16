(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, cardEl, numberField, seg, verdict, bump, pageHead, toggle, pct, secs, timerRing } = UI;

  const LIMIT = { beginner: 15, intermediate: 12, advanced: 10, expert: 8 };
  const T = { mode: 'practice', diff: 'beginner', length: 'drill', speed: null, flash: null, limit: false, showLive: null, session: { n: 0, ok: 0, ms: 0 } };

  function render(el) {
    let phase = 'idle';
    let cards = [];
    let idx = 0;
    let timer = null;
    let answerTimer = null;
    let t0 = 0;
    const p = () => CC.DIFF[T.diff];
    const speed = () => T.speed || p().speed;
    const flashN = () => T.flash || p().flash;
    if (T.showLive == null) T.showLive = CC.store.hintLevel() === 2;

    el.appendChild(pageHead('Running count', 'Count Trainer', 'Cards are dealt one flash at a time. Keep the running count in your head, then enter it when the sequence ends.'));

    // ---- controls ----
    const speedLabel = h('span', { class: 'mono acc-t' });
    const speedSlider = h('input', { id: 'ct-speed', type: 'range', class: 'range', min: 0.25, max: 2.5, step: 0.05, value: speed(), oninput: (e) => { T.speed = +e.target.value; updSpeed(); } });
    const updSpeed = () => (speedLabel.textContent = speed().toFixed(2) + ' s per flash');
    updSpeed();
    const modeSeg = seg([{ value: 'practice', label: 'Practice' }, { value: 'test', label: 'Test' }], T.mode, (v) => { T.mode = v; redrawStage(); });
    const diffSeg = seg(CC.DIFFICULTIES.map((d) => ({ value: d, label: CC.DIFF[d].label })), T.diff, (v) => { T.diff = v; T.speed = null; T.flash = null; speedSlider.value = speed(); flashSeg.setValue(flashN()); updSpeed(); lenInfo(); });
    const lenSeg = seg([{ value: 'drill', label: 'Short drill' }, { value: 'long', label: 'Long sequence' }], T.length, (v) => { T.length = v; lenInfo(); });
    const lenNote = h('span', { class: 'small muted' });
    const lenInfo = () => (lenNote.textContent = total() + ' cards');
    const total = () => (T.length === 'drill' ? p().drill : p().long);
    lenInfo();
    const flashSeg = seg([1, 2, 3].map((n) => ({ value: n, label: n + (n === 1 ? ' card' : ' cards') })), flashN(), (v) => (T.flash = v));
    const limitT = toggle('Answer time limit', T.limit, (v) => (T.limit = v), 'ct-limit');
    const startBtn = h('button', { class: 'btn primary lg', onclick: () => start() }, 'Start');

    const controls = h('aside', { class: 'panel stack' },
      h('div', { class: 'panel-title' }, 'Setup'),
      UI.field('Mode', modeSeg),
      UI.field('Difficulty', diffSeg),
      UI.field('Length', h('div', { class: 'row' }, lenSeg, lenNote)),
      UI.field('Cards per flash', flashSeg),
      h('div', { class: 'field' }, h('div', { class: 'row spread' }, h('label', { for: 'ct-speed' }, 'Dealing speed'), speedLabel), speedSlider),
      limitT,
      h('p', { class: 'small muted' }, 'Test mode hides the live count and hints, disables pausing, and only reveals the answer after you submit.'),
      startBtn
    );

    // ---- stage ----
    const stage = h('section', { class: 'stack' });
    const sessionBox = h('div', { class: 'tiles' });
    const drawSession = () => {
      sessionBox.innerHTML = '';
      const s = CC.store.stats('rc', { last: 50 });
      sessionBox.append(
        UI.tile('This session', T.session.n ? T.session.ok + ' / ' + T.session.n : '—', T.session.n ? pct(T.session.ok / T.session.n) + ' correct' : 'No drills yet'),
        UI.tile('Last 50 overall', pct(s.acc), s.n + ' answers'),
        UI.tile('Avg answer time', secs(T.session.n ? T.session.ms / T.session.n : s.avgMs), T.session.n ? 'this session' : 'overall')
      );
    };
    el.appendChild(h('div', { class: 'split' }, h('div', { class: 'stack' }, stage, sessionBox), controls));
    drawSession();

    function lockSetup(lock) {
      [modeSeg, diffSeg, lenSeg, flashSeg].forEach((s) => s.setDisabled(lock));
      limitT.querySelector('input').disabled = lock;
      startBtn.disabled = lock;
    }

    function redrawStage() {
      if (phase === 'idle') drawIdle();
    }

    function drawIdle() {
      stage.innerHTML = '';
      stage.appendChild(
        h('div', { class: 'felt stage' },
          h('div', { class: 'felt-print' }, T.mode === 'test' ? 'Test mode' : 'Practice mode'),
          h('div', { class: 'flash' }, cardEl(CC.makeCard('K', '♠'), { down: true }), cardEl(CC.makeCard('5', '♥'), { down: true })),
          h('p', { class: 'felt-arc' }, CC.DIFF[T.diff].label + ' · ' + total() + ' cards · ' + speed().toFixed(2) + ' s per flash'),
          h('button', { class: 'btn primary', onclick: () => start() }, 'Deal')
        )
      );
    }

    let flashEl, progEl, metaCount, liveEl, pauseBtn;
    function start() {
      stop();
      cards = CC.randomCards(total(), Math.random, total() > 100 ? 8 : 6);
      idx = 0;
      phase = 'dealing';
      lockSetup(true);
      stage.innerHTML = '';
      flashEl = h('div', { class: 'flash', 'aria-live': 'off' });
      progEl = h('i', { style: { width: '0%' } });
      metaCount = h('span', { class: 'mono' }, '0 / ' + cards.length);
      liveEl = h('span', { class: 'live' }, '0');
      const practice = T.mode === 'practice';
      const liveWrap = h('span', { hidden: !(practice && T.showLive) }, 'Live count ', liveEl);
      pauseBtn = h('button', { class: 'btn sm', disabled: !practice, onclick: togglePause }, 'Pause');
      const liveBtn = practice ? h('button', { class: 'btn sm ghost', onclick: (e) => { T.showLive = !T.showLive; liveWrap.hidden = !T.showLive; e.currentTarget.textContent = T.showLive ? 'Hide live count' : 'Show live count'; } }, T.showLive ? 'Hide live count' : 'Show live count') : null;
      stage.appendChild(
        h('div', { class: 'felt stage' },
          h('div', { class: 'stage-meta' }, h('span', null, 'Cards ', metaCount), liveWrap),
          flashEl,
          h('div', { class: 'bar', style: { width: '100%' } }, progEl),
          h('div', { class: 'row', style: { justifyContent: 'center' } }, pauseBtn, h('button', { class: 'btn sm', onclick: () => start() }, 'Restart'), liveBtn, h('button', { class: 'btn sm ghost', onclick: () => { stop(); phase = 'idle'; lockSetup(false); drawIdle(); } }, 'Stop'))
        )
      );
      tick();
    }

    function tick() {
      if (phase !== 'dealing') return;
      if (idx >= cards.length) return toAnswer();
      const n = Math.min(flashN(), cards.length - idx);
      flashEl.innerHTML = '';
      for (let i = 0; i < n; i++) flashEl.appendChild(cardEl(cards[idx + i], { deal: true, delay: i * 50, from: [140, -90] }));
      idx += n;
      metaCount.textContent = idx + ' / ' + cards.length;
      progEl.style.width = (idx / cards.length) * 100 + '%';
      liveEl.textContent = f(CC.runningCount(cards.slice(0, idx)));
      bump(liveEl);
      timer = setTimeout(tick, speed() * 1000);
    }

    function togglePause() {
      if (phase === 'dealing') {
        phase = 'paused';
        clearTimeout(timer);
        pauseBtn.textContent = 'Resume';
      } else if (phase === 'paused') {
        phase = 'dealing';
        pauseBtn.textContent = 'Pause';
        tick();
      }
    }

    function toAnswer() {
      phase = 'answer';
      setTimeout(() => {
        if (phase !== 'answer') return;
        flashEl.innerHTML = '';
        const ans = numberField({ id: 'ct-answer', large: true, onEnter: () => submit(ans.value) });
        const ring = T.limit ? timerRing(LIMIT[T.diff]) : null;
        const box = h('div', { class: 'stack', style: { width: 'min(340px, 100%)', alignItems: 'stretch' } },
          h('div', { class: 'row', style: { justifyContent: 'center' } }, h('h3', null, 'What is the running count?'), ring),
          ans.el,
          h('button', { class: 'btn primary lg', onclick: () => submit(ans.value) }, 'Submit')
        );
        flashEl.replaceWith(box);
        flashEl = box;
        pauseBtn.disabled = true;
        ans.focus();
        t0 = performance.now();
        if (ring) {
          const lim = LIMIT[T.diff];
          answerTimer = setInterval(() => {
            const left = lim - (performance.now() - t0) / 1000;
            ring.update(left);
            if (left <= 0) submit(ans.value, true);
          }, 200);
        }
      }, Math.min(600, speed() * 1000));
    }

    function submit(val, timedOut) {
      if (phase !== 'answer') return;
      clearInterval(answerTimer);
      const ms = performance.now() - t0;
      const rc = CC.runningCount(cards);
      const given = isNaN(val) ? null : val;
      const ok = given === rc;
      phase = 'result';
      T.session.n++;
      if (ok) T.session.ok++;
      T.session.ms += ms;
      CC.store.record('rc', ok, ms, { given, answer: rc, speed: speed(), mode: T.mode, diff: T.diff, n: cards.length, src: 'trainer' });
      lockSetup(false);
      drawResult(ok, given, rc, ms, timedOut);
      drawSession();
    }

    function drawResult(ok, given, rc, ms, timedOut) {
      stage.innerHTML = '';
      const trail = CC.countTrail(cards);
      const bd = h('div', { class: 'breakdown' });
      trail.forEach((t, i) => bd.appendChild(h('div', { class: 'bd-item' }, cardEl(t.card, { size: 'xs', deal: true, delay: Math.min(i * 18, 900), from: [0, -20] }), h('span', { class: 'v ' + (t.value > 0 ? 'good-t' : t.value < 0 ? 'bad-t' : 'muted') }, t.value === 0 ? '0' : f(t.value)), h('span', { class: 'r' }, f(t.rc)))));
      const lows = trail.filter((t) => t.value > 0).length;
      const highs = trail.filter((t) => t.value < 0).length;
      stage.append(
        h('div', { class: 'panel stack' },
          verdict(ok, ok ? 'Correct' : timedOut ? 'Time ran out' : 'Not quite', ok ? 'You kept the count through ' + cards.length + ' cards.' : given == null ? 'No answer entered.' : 'Off by ' + Math.abs(given - rc) + '.'),
          h('div', { class: 'counts' },
            h('div', { class: 'count' }, h('div', { class: 'k' }, 'Your answer'), h('div', { class: 'v' }, given == null ? '—' : f(given))),
            h('div', { class: 'count rc' }, h('div', { class: 'k' }, 'Correct count'), h('div', { class: 'v' }, f(rc))),
            h('div', { class: 'count' }, h('div', { class: 'k' }, 'Response time'), h('div', { class: 'v' }, secs(ms)))
          ),
          h('div', { class: 'row spread' }, h('div', { class: 'panel-title' }, 'Card-by-card breakdown'), h('span', { class: 'small muted' }, lows + ' low (+1) · ' + (cards.length - lows - highs) + ' neutral · ' + highs + ' high (−1)')),
          h('div', { class: 'small muted' }, 'Under each card: its tag, then the running count after it.'),
          bd,
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => start() }, 'Next drill'), h('button', { class: 'btn', onclick: () => { phase = 'idle'; drawIdle(); } }, 'Change setup'))
        )
      );
    }

    function stop() {
      clearTimeout(timer);
      clearInterval(answerTimer);
    }

    drawIdle();
    return stop;
  }

  UI.register({ id: 'count', label: 'Count Trainer', icon: 'layers', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
