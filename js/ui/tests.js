(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, cardEl, numberField, seg, verdict, pageHead, pct, secs, timerRing, toggle, bump, toast } = UI;
  const CFG = { diff: 'beginner', timed: false };
  const CAT_NAMES = Object.assign({}, CC.store.CATS);

  function fmtAnswer(q, v) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    if (q.choices) {
      const c = q.choices.find((x) => x.value === v);
      if (c) return c.label;
    }
    if (q.cat === 'rc' || q.cat === 'tc') return f(v);
    return String(v);
  }

  function render(el, opts) {
    el.appendChild(pageHead('Assessments', 'Tests', 'Scored, randomised tests for each skill. Every answer is graded with the same engine the trainers use.'));
    const body = h('div');
    el.appendChild(body);
    let cleanup = null;
    const setCleanup = (fn) => { if (cleanup) cleanup(); cleanup = fn; };

    function hub() {
      setCleanup(null);
      body.innerHTML = '';
      const st = CC.store.state;
      body.append(
        h('div', { class: 'row spread', style: { marginBottom: '16px' } },
          seg(CC.DIFFICULTIES.map((d) => ({ value: d, label: CC.DIFF[d].label })), CFG.diff, (v) => { CFG.diff = v; hub(); }, { label: 'Difficulty' }),
          toggle('Timed (per-question limit of ' + CC.DIFF[CFG.diff].perQ + ' s)', CFG.timed, (v) => { CFG.timed = v; hub(); }, 'ts-timed')
        )
      );
      const grid = h('div', { class: 'grid-3' });
      CC.TESTS.forEach((t, i) => {
        const key = t.id + '-' + CFG.diff + (CFG.timed ? '-t' : '');
        const best = st.bests[key];
        const runs = st.tests.filter((x) => x.id === t.id);
        const n = t.counts ? t.counts[CC.DIFFICULTIES.indexOf(CFG.diff)] : Math.floor((CC.DIFF[CFG.diff].shoeDecks * 52) / CC.DIFF[CFG.diff].checkpoint);
        grid.appendChild(
          h('div', { class: 'panel test-card' },
            h('div', { class: 'row spread' }, h('span', { class: 'eyebrow' }, 'Test ' + (i + 1)), best ? h('span', { class: 'pill ' + (best.pct >= 90 ? 'good' : best.pct >= 70 ? 'warn' : 'bad') }, 'Best ' + best.pct + '%') : h('span', { class: 'pill' }, 'Not taken')),
            h('h3', null, t.name),
            h('p', { class: 'small muted' }, t.blurb),
            h('div', { class: 'best' }, n + ' questions · ' + runs.length + ' attempt' + (runs.length === 1 ? '' : 's') + (best ? ' · best time ' + Math.round(best.secs) + ' s' : '')),
            h('button', { class: 'btn primary', style: { marginTop: 'auto' }, onclick: () => start(t.id) }, 'Start')
          )
        );
      });
      body.appendChild(grid);
    }

    function start(id) {
      const st = CC.store.state;
      const test = CC.buildTest(id, CFG.diff, Math.random, { conv: st.settings.conv, betting: st.settings.betting, rules: st.settings.rules });
      const meta = CC.TESTS.find((t) => t.id === id);
      const run = { test, meta, i: 0, answers: [], t0: performance.now(), timed: CFG.timed, diff: CFG.diff };
      if (id === 'shoe') shoeRunner(run);
      else runner(run);
    }

    function header(run, extra) {
      const n = run.test.questions.length;
      return h('div', { class: 'stack', style: { marginBottom: '16px' } },
        h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'eyebrow' }, run.meta.name + ' · ' + CC.DIFF[run.diff].label + (run.timed ? ' · timed' : '')), h('h2', { style: { marginTop: '4px' } }, 'Question ' + Math.min(run.i + 1, n) + ' of ' + n)), h('div', { class: 'row' }, extra, h('button', { class: 'btn sm ghost', onclick: () => quit(run) }, 'Quit'))),
        h('div', { class: 'bar' }, h('i', { style: { width: (run.i / n) * 100 + '%' } }))
      );
    }

    function quit(run) {
      UI.modal({ title: 'Quit this test?', body: h('p', { class: 'muted' }, 'Answers so far will not be scored.'), actions: [{ label: 'Keep going' }, { label: 'Quit test', danger: true, onClick: () => hub() }] });
    }

    function recordAnswer(run, q, given, ms) {
      const ok = given != null && !(typeof given === 'number' && isNaN(given)) && q.accept(given);
      run.answers.push({ q, given, ok, ms });
      const extra = { given: typeof given === 'number' ? given : null, answer: typeof q.answer === 'number' ? q.answer : null, src: 'test' };
      if (q.cat === 'card') extra.rank = q.cards[0].rank;
      if (q.cat === 'tc') { extra.raw = q.raw; extra.rc = null; }
      if (q.cat === 'deck') extra.exact = q.exact;
      if (q.cat === 'strategy') extra.kind = q.handKind;
      CC.store.record(q.cat, ok, ms, extra);
      return ok;
    }

    function questionView(q) {
      const parts = [h('h3', null, q.title)];
      if (q.dealerUp) parts.push(h('div', { class: 'row', style: { gap: '28px', alignItems: 'flex-end' } }, h('div', null, h('div', { class: 'label' }, 'Dealer shows'), h('div', { class: 'cards-row', style: { justifyContent: 'flex-start' } }, cardEl(q.dealerUp, { size: 'sm', deal: true }))), h('div', null, h('div', { class: 'label' }, 'Your hand'), h('div', { class: 'cards-row', style: { justifyContent: 'flex-start' } }, q.cards.map((c, i) => cardEl(c, { size: 'sm', deal: true, delay: 80 * (i + 1) }))))));
      else if (q.cards) parts.push(h('div', { class: 'cards-row', style: { justifyContent: 'flex-start', gap: q.cards.length > 1 ? '6px' : '10px' } }, q.cards.map((c, i) => cardEl(c, { size: q.cards.length > 1 ? 'sm' : 'lg', deal: true, delay: Math.min(i * 45, 700) }))));
      if (q.info) parts.push(h('div', { class: 'counts' }, q.info.map((x) => h('div', { class: 'count' }, h('div', { class: 'k' }, x.label), h('div', { class: 'v', style: { fontSize: '1.25rem' } }, x.value)))));
      if (q.visual && q.visual.type === 'tray') parts.push(UI.trayViz(q.visual.total, q.visual.dealt, { markers: false }));
      return parts;
    }

    function runner(run) {
      const q = run.test.questions[run.i];
      if (!q) return finish(run);
      body.innerHTML = '';
      const limit = CC.DIFF[run.diff].perQ;
      const ring = run.timed ? timerRing(limit) : null;
      body.appendChild(header(run, ring));
      const card = h('div', { class: 'panel stack', style: { padding: '24px' } });
      body.appendChild(card);
      card.append(...questionView(q));
      const fb = h('div');
      let answered = false;
      const t0 = performance.now();
      let iv = null;
      let input = null;
      const answer = (given) => {
        if (answered) return;
        answered = true;
        clearInterval(iv);
        const ok = recordAnswer(run, q, given, performance.now() - t0);
        if (q.kind === 'choice') card.querySelectorAll('.choice').forEach((b) => { b.disabled = true; if (b.dataset.v === String(q.answer)) b.classList.add('right'); else if (b.dataset.v === String(given) && !ok) b.classList.add('wrong'); });
        fb.innerHTML = '';
        const next = h('button', { class: 'btn primary', onclick: go }, run.i + 1 < run.test.questions.length ? 'Next question' : 'See results');
        fb.append(verdict(ok, ok ? 'Correct' : given == null ? 'Time ran out' : 'Incorrect', ok ? null : 'Answer: ' + fmtAnswer(q, q.answer) + '. Explanation in the review.'), h('div', { style: { marginTop: '12px' } }, next));
        next.focus({ preventScroll: true });
        if (run.timed) setTimeout(() => { if (UI.current === 'tests' && fb.isConnected) go(); }, ok ? 700 : 1500);
      };
      let went = false;
      function go() { if (went) return; went = true; run.i++; runner(run); }
      if (q.kind === 'choice') {
        const ch = h('div', { class: 'choices' });
        q.choices.forEach((c) => ch.appendChild(h('button', { class: 'choice', 'data-v': String(c.value), style: { minWidth: '76px', textAlign: 'center' }, onclick: () => answer(c.value) }, c.label)));
        card.appendChild(ch);
      } else {
        input = numberField({ id: 'ts-ans', large: true, step: q.step || 1, signed: q.cat !== 'deck' && q.cat !== 'bet', onEnter: () => submitNum() });
        const submitNum = () => {
          if (answered) return;
          const v = input.value;
          if (isNaN(v)) { input.el.classList.add('bad'); return; }
          answer(v);
        };
        card.append(h('div', { class: 'row', style: { alignItems: 'stretch' } }, h('div', { style: { width: '260px', maxWidth: '100%' } }, input.el), h('button', { class: 'btn primary', onclick: submitNum }, 'Submit')));
        setTimeout(() => input.focus(), 60);
      }
      card.appendChild(fb);
      if (ring) iv = setInterval(() => { const left = limit - (performance.now() - t0) / 1000; ring.update(left); if (left <= 0) answer(null); }, 200);
      const onKey = (e) => {
        if (q.kind !== 'choice' || answered || e.target.closest('input')) return;
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < q.choices.length) answer(q.choices[idx].value);
      };
      document.addEventListener('keydown', onKey);
      setCleanup(() => { clearInterval(iv); document.removeEventListener('keydown', onKey); });
    }

    function shoeRunner(run) {
      const { cards, speed, flash } = run.test;
      let dealt = 0;
      let timer = null;
      body.innerHTML = '';
      const head = h('div');
      const flashEl = h('div', { class: 'flash' });
      const meta = h('span', { class: 'mono' });
      const prog = h('i', { style: { width: '0%' } });
      const ask = h('div');
      body.append(head, h('div', { class: 'felt stage' }, h('div', { class: 'stage-meta' }, h('span', null, 'Cards ', meta), h('span', null, run.test.questions.length + ' checkpoints')), flashEl, h('div', { class: 'bar', style: { width: '100%' } }, prog)), ask);
      const drawHead = () => { head.innerHTML = ''; head.appendChild(header(run)); };
      drawHead();
      const step = () => {
        const q = run.test.questions[run.i];
        if (!q) return finish(run);
        if (dealt >= q.checkpoint) return checkpoint(q);
        const n = Math.min(flash, q.checkpoint - dealt);
        flashEl.innerHTML = '';
        for (let i = 0; i < n; i++) flashEl.appendChild(cardEl(cards[dealt + i], { deal: true, delay: i * 50, from: [140, -90] }));
        dealt += n;
        meta.textContent = dealt + ' / ' + cards.length;
        prog.style.width = (dealt / cards.length) * 100 + '%';
        timer = setTimeout(step, speed * 1000);
      };
      const checkpoint = (q) => {
        flashEl.innerHTML = '';
        flashEl.appendChild(h('div', { class: 'felt-print' }, 'Checkpoint'));
        const input = numberField({ id: 'ts-shoe', large: true, onEnter: () => submit() });
        const limit = CC.DIFF[run.diff].perQ;
        const ring = run.timed ? timerRing(limit) : null;
        const t0 = performance.now();
        let iv = null;
        let done = false;
        const submit = (timeout) => {
          if (done) return;
          const v = input.value;
          if (!timeout && isNaN(v)) return;
          done = true;
          clearInterval(iv);
          const ok = recordAnswer(run, q, isNaN(v) ? null : v, performance.now() - t0);
          ask.innerHTML = '';
          ask.appendChild(h('div', { class: 'panel', style: { marginTop: '14px' } }, verdict(ok, ok ? 'Correct: ' + f(q.answer) : 'The count was ' + f(q.answer), ok ? 'Dealing resumes.' : 'Carry on from ' + f(q.answer) + '.')));
          run.i++;
          drawHead();
          setTimeout(() => { if (UI.current === 'tests' && ask.isConnected) { ask.innerHTML = ''; step(); } }, ok ? 900 : 1800);
        };
        ask.innerHTML = '';
        ask.appendChild(h('div', { class: 'panel stack', style: { marginTop: '14px' } }, h('div', { class: 'row spread' }, h('h3', null, q.title), ring), h('div', { class: 'row' }, h('div', { style: { width: '260px', maxWidth: '100%' } }, input.el), h('button', { class: 'btn primary', onclick: () => submit() }, 'Submit'))));
        setTimeout(() => input.focus(), 50);
        if (ring) iv = setInterval(() => { const left = limit - (performance.now() - t0) / 1000; ring.update(left); if (left <= 0) submit(true); }, 200);
        setCleanup(() => { clearTimeout(timer); clearInterval(iv); });
      };
      setCleanup(() => clearTimeout(timer));
      timer = setTimeout(step, 600);
    }

    function finish(run) {
      setCleanup(null);
      const n = run.answers.length;
      const correct = run.answers.filter((a) => a.ok).length;
      const pctScore = n ? Math.round((correct / n) * 100) : 0;
      const secsTotal = (performance.now() - run.t0) / 1000;
      const key = run.meta.id + '-' + run.diff + (run.timed ? '-t' : '');
      const res = { id: run.meta.id, name: run.meta.name, key, difficulty: run.diff, timed: run.timed, pct: pctScore, correct, n, secs: Math.round(secsTotal), t: Date.now(), byCat: {} };
      run.answers.forEach((a) => {
        const c = (res.byCat[a.q.cat] = res.byCat[a.q.cat] || { n: 0, ok: 0 });
        c.n++;
        if (a.ok) c.ok++;
      });
      const { isBest, prev } = CC.store.recordTest(res);
      body.innerHTML = '';
      const wrong = run.answers.filter((a) => !a.ok);
      const avgMs = run.answers.reduce((s, a) => s + a.ms, 0) / Math.max(1, n);
      const scoreEl = h('div', { class: 'mono', style: { fontSize: '3.4rem', fontWeight: 700, lineHeight: 1 } }, '0%');
      body.append(
        h('div', { class: 'grid-2' },
          h('div', { class: 'panel stack' },
            h('div', { class: 'eyebrow' }, run.meta.name + ' · ' + CC.DIFF[run.diff].label + (run.timed ? ' · timed' : '')),
            h('div', { class: 'row', style: { alignItems: 'baseline', gap: '14px' } }, scoreEl, isBest ? h('span', { class: 'pill acc' }, prev ? 'New personal best (was ' + prev.pct + '%)' : 'First result recorded') : h('span', { class: 'pill' }, 'Best ' + CC.store.state.bests[key].pct + '%')),
            h('div', { class: 'row', style: { gap: '20px' } }, h('span', null, h('b', { class: 'mono' }, correct + ' / ' + n), h('span', { class: 'muted' }, ' correct')), h('span', null, h('b', { class: 'mono' }, Math.round(secsTotal) + ' s'), h('span', { class: 'muted' }, ' total')), h('span', null, h('b', { class: 'mono' }, secs(avgMs)), h('span', { class: 'muted' }, ' per answer'))),
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => start(run.meta.id) }, 'Retake'), h('button', { class: 'btn', onclick: hub }, 'All tests'))
          ),
          h('div', { class: 'panel stack' },
            h('div', { class: 'panel-title' }, 'Skill breakdown'),
            UI.barChart(Object.entries(res.byCat).map(([c, v]) => ({ label: CAT_NAMES[c] || c, value: v.ok / v.n, display: v.ok + '/' + v.n, color: v.ok / v.n >= 0.9 ? 'var(--good)' : v.ok / v.n >= 0.7 ? 'var(--warn)' : 'var(--bad)' })), { max: 1, label: 'Accuracy by skill in this test' })
          )
        )
      );
      // count-up animation for the score
      if (UI.reducedMotion()) scoreEl.textContent = pctScore + '%';
      else {
        const t0 = performance.now();
        const tick = () => { const p = Math.min(1, (performance.now() - t0) / 700); scoreEl.textContent = Math.round(pctScore * (1 - Math.pow(1 - p, 3))) + '%'; if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      scoreEl.style.color = pctScore >= 90 ? 'var(--good)' : pctScore >= 70 ? 'var(--warn)' : 'var(--bad)';
      const review = h('div', { class: 'panel stack', style: { marginTop: '18px' } }, h('div', { class: 'panel-title' }, wrong.length ? 'Review: ' + wrong.length + ' incorrect' : 'Review'));
      if (!wrong.length) review.appendChild(h('p', { class: 'muted' }, 'Every answer was correct. Try the next difficulty or the timed version.'));
      wrong.forEach((a, i) =>
        review.appendChild(
          h('div', { class: 'stack', style: { padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 'none' } },
            h('div', { class: 'row spread' }, h('b', null, a.q.title), h('span', { class: 'mono small' }, 'you: ', h('span', { class: 'bad-t' }, fmtAnswer(a.q, a.given)), ' · answer: ', h('span', { class: 'good-t' }, fmtAnswer(a.q, a.q.answer)))),
            a.q.cards && a.q.cards.length <= 18 ? h('div', { class: 'cards-row', style: { justifyContent: 'flex-start', gap: '4px', minHeight: 0 } }, (a.q.dealerUp ? [a.q.dealerUp] : []).concat(a.q.cards).map((c) => cardEl(c, { size: 'xs' }))) : null,
            h('p', { class: 'small muted' }, a.q.explain())
          )
        )
      );
      body.appendChild(review);
      if (isBest && prev) toast('New personal best on ' + run.meta.name, 'good');
      if (CC.cloud) {
        const named = (CC.store.state.settings.displayName || '').trim().length >= 2;
        const lbNote = h('p', { class: 'small muted' });
        review.before(h('div', { class: 'panel row spread', style: { marginTop: '18px', padding: '14px 18px' } }, lbNote, h('button', { class: 'btn sm', onclick: () => UI.go('leaderboard') }, 'Leaderboard')));
        if (!named) lbNote.textContent = 'Set a leaderboard name to post results like this one.';
        else if (CC.cloud.status !== 'ready') lbNote.textContent = 'Not posted: the cloud is not connected.';
        else {
          lbNote.textContent = 'Posting to the leaderboard…';
          CC.cloud.submitScore(res).then((r) => { lbNote.textContent = r.error ? 'Could not post: ' + r.error.message : 'Posted. The leaderboard keeps your best result for this test and level.'; });
        }
      }
    }

    if (opts && opts.start) start(opts.start);
    else hub();
    return () => setCleanup(null);
  }

  UI.register({ id: 'tests', label: 'Tests', icon: 'check', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
