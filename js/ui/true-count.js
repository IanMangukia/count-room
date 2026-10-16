(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, cardEl, numberField, seg, verdict, pageHead, toggle, pct } = UI;
  const S = { tab: 'calc', diff: 'beginner', markers: null };

  function render(el) {
    if (S.markers == null) S.markers = CC.store.hintLevel() >= 1;
    el.appendChild(pageHead('True count', 'True Count Trainer', 'Turn a running count into a true count: estimate the decks left in the shoe, then divide.'));

    // Convention explainer, always visible
    const settings = CC.store.state.settings;
    const convTable = h('div', { class: 'tbl-wrap' });
    const drawConv = () => {
      convTable.innerHTML = '';
      const rows = [[7, 2.5], [-7, 2.5], [9, 2], [-5, 3]];
      const tb = h('tbody');
      rows.forEach(([rc, d]) => tb.appendChild(h('tr', null, h('td', { class: 'mono' }, f(rc) + ' ÷ ' + d), h('td', { class: 'mono' }, (rc / d).toFixed(2)), ['truncate', 'floor', 'round'].map((c) => h('td', { class: 'mono' + (c === settings.conv ? ' acc-t' : '') }, f(CC.trueCount(rc, d, c)))))));
      convTable.appendChild(h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'RC ÷ decks'), h('th', null, 'Exact'), h('th', null, 'Truncate'), h('th', null, 'Floor'), h('th', null, 'Round'))), tb));
    };
    drawConv();
    const convPanel = h('section', { class: 'panel stack' },
      h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'panel-title' }, 'The formula'), h('p', { class: 'mono', style: { fontSize: '1.15rem', marginTop: '4px' } }, h('span', { class: 'acc-t' }, 'True count'), ' = ', h('span', { class: 'acc-t' }, 'Running count'), ' ÷ Decks remaining')),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Your convention'), seg([{ value: 'truncate', label: 'Truncate' }, { value: 'floor', label: 'Floor' }, { value: 'round', label: 'Round' }, { value: 'exact', label: 'Exact' }], settings.conv, (v) => { settings.conv = v; CC.store.save(); drawConv(); }))
      ),
      h('p', { class: 'small muted' }, 'Truncate drops the fraction toward zero. Floor always rounds down, so negative counts get more negative. Round goes to the nearest whole number. Exact keeps one decimal. The running count is what you keep in your head; the true count is calculated from it whenever you need to bet or decide.'),
      convTable
    );
    el.appendChild(convPanel);

    const tabs = seg([{ value: 'calc', label: 'Calculate true count' }, { value: 'deck', label: 'Estimate decks' }], S.tab, (v) => { S.tab = v; draw(); });
    const diffSeg = seg(CC.DIFFICULTIES.map((d) => ({ value: d, label: CC.DIFF[d].label })), S.diff, (v) => { S.diff = v; draw(); });
    const markerT = toggle('Deck markers on tray', S.markers, (v) => { S.markers = v; draw(); }, 'tc-markers');
    el.appendChild(h('div', { class: 'row spread', style: { margin: '22px 0 14px' } }, tabs, h('div', { class: 'row' }, diffSeg, markerT)));
    const area = h('div');
    el.appendChild(area);

    function draw() {
      area.innerHTML = '';
      area.appendChild(S.tab === 'calc' ? calcScenario() : deckScenario());
    }

    function calcScenario() {
      const d = S.diff;
      const total = d === 'advanced' || d === 'expert' ? 8 : 6;
      const burstN = { beginner: 0, intermediate: 5, advanced: 8, expert: 12 }[d];
      const dealt = Math.round(total * 52 * (0.15 + Math.random() * 0.65));
      const left = total * 52 - dealt;
      const startRC = CC.randInt(-8, 12, Math.random);
      const burst = CC.randomCards(burstN, Math.random);
      const rc = startRC + CC.runningCount(burst);
      const exact = left / 52;
      const half = CC.estimateDecks(left);
      const conv = settings.conv;
      const t0 = performance.now();

      const rcF = numberField({ id: 'tc-rc', label: 'Running count' });
      const dF = numberField({ id: 'tc-decks', label: 'Decks remaining', step: 0.5, signed: false });
      const tF = numberField({ id: 'tc-tc', label: 'True count', step: conv === 'exact' ? 0.1 : 1 });
      const fb = h('div', { class: 'stack' });
      const submitBtn = h('button', { class: 'btn primary', onclick: grade }, 'Check');
      const viz = UI.trayViz(total, dealt, { markers: S.markers });

      const scenario = h('div', { class: 'panel stack' },
        h('div', { class: 'panel-title' }, 'Scenario'),
        viz,
        burstN
          ? h('div', { class: 'stack' }, h('p', null, 'Running count before this round: ', h('b', { class: 'mono acc-t' }, f(startRC)), '. These cards were just exposed:'), h('div', { class: 'cards-row', style: { justifyContent: 'flex-start', gap: '6px' } }, burst.map((c, i) => cardEl(c, { size: 'sm', deal: true, delay: i * 60 }))))
          : h('p', null, 'Your running count is ', h('b', { class: 'mono acc-t' }, f(rc)), '. Read the tray to estimate decks remaining.')
      );
      const answer = h('div', { class: 'panel stack' },
        h('div', { class: 'panel-title' }, 'Your work'),
        UI.field('1 · Running count', rcF.el, 'tc-rc'),
        UI.field('2 · Decks remaining', dF.el, 'tc-decks'),
        UI.field('3 · True count (' + conv + ')', tF.el, 'tc-tc'),
        submitBtn,
        fb
      );
      if (!burstN) rcF.set(f(rc));
      [rcF, dF, tF].forEach((x) => x.input.addEventListener('keydown', (e) => e.key === 'Enter' && grade()));

      function grade() {
        if (submitBtn.disabled) return;
        const uRC = rcF.value, uD = dF.value, uT = tF.value;
        if (isNaN(uRC) || isNaN(uD) || isNaN(uT) || !(uD > 0)) {
          fb.innerHTML = '';
          fb.appendChild(h('p', { class: 'small bad-t' }, 'Fill in all three numbers. Decks remaining must be above zero.'));
          return;
        }
        submitBtn.disabled = true;
        const ms = performance.now() - t0;
        const rcOk = uRC === rc;
        const dOk = Math.abs(uD - exact) <= 0.5 + 1e-9;
        const tcAnswer = CC.trueCount(rc, half, conv);
        const tcOk = Math.abs(uT - tcAnswer) < 1e-9 || (dOk && Math.abs(uT - CC.trueCount(rc, uD, conv)) < 1e-9);
        const ownTC = CC.trueCount(uRC, uD, conv);
        if (burstN) CC.store.record('rc', rcOk, null, { given: uRC, answer: rc, src: 'truecount' });
        CC.store.record('deck', dOk, null, { given: uD, exact, src: 'truecount' });
        CC.store.record('tc', tcOk, ms, { given: uT, answer: tcAnswer, raw: rc / half, rc, src: 'truecount' });
        fb.innerHTML = '';
        const line = (ok, label, mine, right, note) => h('div', { class: 'row spread', style: { padding: '8px 10px', borderRadius: '10px', background: 'var(--ink)' } }, h('span', null, h('span', { class: ok ? 'good-t' : 'bad-t', style: { fontWeight: 800 } }, ok ? '✓ ' : '✕ '), label), h('span', { class: 'mono small' }, 'you ' + mine + ' · ', h('b', null, right)), note ? h('div', { class: 'small muted', style: { width: '100%' } }, note) : null);
        fb.append(
          verdict(rcOk && dOk && tcOk, rcOk && dOk && tcOk ? 'All three correct' : [rcOk, dOk, tcOk].filter(Boolean).length + ' of 3 correct'),
          line(rcOk, 'Running count', f(uRC), f(rc), burstN ? f(startRC) + ' + (' + CC.countTrail(burst).map((t) => f(t.value)).join(' ') + ') = ' + f(rc) : null),
          line(dOk, 'Decks remaining', String(uD), exact.toFixed(2), left + ' cards left of ' + total * 52 + '. Within half a deck counts as correct; the half-deck estimate is ' + half + '.'),
          line(tcOk, 'True count', f(uT), f(tcAnswer), f(rc) + ' ÷ ' + half + ' = ' + (rc / half).toFixed(2) + ' → ' + conv + ' → ' + f(tcAnswer) + '.' + (!tcOk && !rcOk && Math.abs(uT - ownTC) < 1e-9 ? ' Your division was right for your own numbers; the error came from the running count.' : '') + (!tcOk && uT === rc ? ' You entered the running count; divide it by decks remaining.' : '')),
          h('button', { class: 'btn', onclick: draw }, 'Next scenario')
        );
      }
      setTimeout(() => (burstN ? rcF : dF).focus(), 50);
      return h('div', { class: 'grid-2' }, scenario, answer);
    }

    function deckScenario() {
      const s = CC.deckScenario(Math.random, S.diff);
      const viz = UI.trayViz(s.total, s.dealt, { markers: S.markers });
      const dF = numberField({ id: 'tc-deck-only', step: 0.5, signed: false, large: true, onEnter: () => grade() });
      const fb = h('div');
      const btn = h('button', { class: 'btn primary', onclick: () => grade() }, 'Check');
      const t0 = performance.now();
      function grade() {
        if (btn.disabled) return;
        const v = dF.value;
        if (isNaN(v)) return;
        btn.disabled = true;
        const ok = Math.abs(v - s.exact) <= 0.5 + 1e-9;
        CC.store.record('deck', ok, performance.now() - t0, { given: v, exact: s.exact, src: 'deckdrill' });
        const st = CC.store.stats('deck', { last: 20 });
        fb.innerHTML = '';
        fb.append(verdict(ok, ok ? 'Good estimate' : 'Outside half a deck', s.dealt + ' cards discarded, ' + s.left + ' left: ' + s.exact.toFixed(2) + ' decks. You said ' + v + ' (' + (v > s.exact ? 'over' : 'under') + ' by ' + Math.abs(v - s.exact).toFixed(2) + '). Last 20 estimates: ' + pct(st.acc) + '.'), h('button', { class: 'btn', style: { marginTop: '10px' }, onclick: draw }, 'Next tray'));
      }
      setTimeout(() => dF.focus(), 50);
      return h('div', { class: 'grid-2' },
        h('div', { class: 'panel stack' }, h('div', { class: 'panel-title' }, s.total + '-deck shoe'), viz, h('p', { class: 'small muted' }, 'Judge the height of the discard stack, convert it to decks, and subtract from ' + s.total + '.')),
        h('div', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Decks remaining in the shoe?'), dF.el, btn, fb)
      );
    }

    draw();
  }

  UI.register({ id: 'truecount', label: 'True Count Trainer', icon: 'divide', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
