(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, chipEl, numberField, seg, verdict, pageHead, money, pct } = UI;
  const B = { level: 'standard', session: { n: 0, ok: 0 } };

  function render(el) {
    const settings = CC.store.state.settings;
    const cfg = settings.betting;
    el.appendChild(pageHead('Virtual chips only', 'Betting Coach', 'Propose a bet for the count, then compare it with your ramp. Everything here uses a fictional bankroll.'));

    const practice = h('section', { class: 'stack' });
    const config = h('aside', { class: 'panel stack' });
    el.appendChild(h('div', { class: 'split' }, practice, config));

    // ---------- config ----------
    function drawConfig() {
      config.innerHTML = '';
      const errs = h('div', { class: 'stack' });
      const draft = JSON.parse(JSON.stringify(cfg));
      const commit = () => {
        const e = CC.validateConfig(draft);
        errs.innerHTML = '';
        e.forEach((m) => errs.appendChild(h('p', { class: 'small bad-t' }, m)));
        if (!e.length) {
          Object.assign(cfg, JSON.parse(JSON.stringify(draft)));
          CC.store.save();
          spreadEl.textContent = spreadText();
        }
        return !e.length;
      };
      const spreadText = () => {
        const s = CC.spread(cfg);
        return 'Spread ' + money(s.low) + ' to ' + money(s.high) + ' (1 to ' + (Math.round(s.ratio * 10) / 10) + ')';
      };
      const spreadEl = h('span', { class: 'mono small acc-t' }, spreadText());
      const num = (id, key, label) => {
        const i = h('input', { id, class: 'input', type: 'number', min: 1, step: 1, value: draft[key], oninput: (e) => { draft[key] = Number(e.target.value); i.classList.toggle('bad', !commit()); } });
        return UI.field(label, i, id);
      };
      const rampBox = h('div', { class: 'stack' });
      const drawRamp = () => {
        rampBox.innerHTML = '';
        draft.ramp.forEach((row, i) => {
          rampBox.appendChild(
            h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
              h('span', { class: 'small muted', style: { width: '28px' } }, 'TC'),
              h('input', { id: 'bc-tc-' + i, class: 'input', type: 'number', step: 1, value: row.tc, style: { width: '76px' }, 'aria-label': 'True count for row ' + (i + 1), oninput: (e) => { row.tc = e.target.value === '' ? NaN : Number(e.target.value); commit(); } }),
              h('span', { class: 'small muted' }, '→'),
              h('input', { id: 'bc-u-' + i, class: 'input', type: 'number', min: 1, step: 1, value: row.units, style: { width: '76px' }, 'aria-label': 'Units for row ' + (i + 1), oninput: (e) => { row.units = e.target.value === '' ? NaN : Number(e.target.value); commit(); } }),
              h('span', { class: 'small muted' }, 'units'),
              h('button', { class: 'btn sm ghost', 'aria-label': 'Remove row', disabled: draft.ramp.length <= 1, onclick: () => { draft.ramp.splice(i, 1); drawRamp(); commit(); } }, '✕')
            )
          );
        });
        rampBox.appendChild(h('p', { class: 'small muted' }, 'The lowest row also covers every count below it; the highest covers every count above it.'));
      };
      drawRamp();
      config.append(
        h('div', { class: 'panel-title' }, 'Bankroll and limits'),
        h('div', { class: 'grid-2' }, num('bc-bank', 'bankroll', 'Bankroll'), num('bc-unit', 'unit', 'Unit size'), num('bc-min', 'minBet', 'Min bet'), num('bc-max', 'maxBet', 'Max bet')),
        h('hr', { class: 'hr' }),
        h('div', { class: 'row spread' }, h('div', { class: 'panel-title' }, 'True-count ramp'), spreadEl),
        rampBox,
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', onclick: () => { const s = CC.sortRamp(draft.ramp); const last = s[s.length - 1]; draft.ramp.push({ tc: (last ? last.tc : 0) + 1, units: (last ? last.units : 1) + 2 }); drawRamp(); commit(); } }, 'Add row'),
          h('button', { class: 'btn sm ghost', onclick: () => { draft.ramp = CC.PRESET_RAMP.map((r) => Object.assign({}, r)); drawRamp(); commit(); } }, 'Reset to preset')
        ),
        errs,
        h('div', { class: 'feedback', style: { background: 'var(--ink)', border: '1px solid var(--line)', color: 'var(--muted)' } }, 'This ramp is a configurable training example, not a universally optimal strategy. Sensible ramps depend on rules, penetration, bankroll and risk tolerance. A positive count shifts the odds; it never guarantees a winning hand.')
      );
    }

    // ---------- practice ----------
    function drawPractice() {
      practice.innerHTML = '';
      const conv = settings.conv === 'exact' ? 'floor' : settings.conv;
      const s = CC.tcScenario(Math.random, B.level === 'easy' ? 'beginner' : 'advanced');
      const tc = CC.trueCount(s.rc, s.decks, conv);
      const bankroll = cfg.bankroll;
      const betF = numberField({ id: 'bc-bet', signed: false, step: cfg.unit, large: true, allowNegative: false, placeholder: String(cfg.minBet), onEnter: () => submit() });
      const errs = h('div');
      const result = h('div');
      const btn = h('button', { class: 'btn primary lg', onclick: () => submit() }, 'Submit bet');
      const chips = h('div', { class: 'chip-tray', style: { justifyContent: 'flex-start' } });
      [5, 25, 100, 500].forEach((v) => chips.appendChild(chipEl(v, { onClick: () => { const cur = isNaN(betF.value) ? 0 : betF.value; betF.set(String(cur + v)); } })));
      chips.appendChild(h('button', { class: 'btn sm ghost', onclick: () => betF.set('') }, 'Clear'));

      practice.append(
        h('div', { class: 'row spread' }, seg([{ value: 'easy', label: 'True count given' }, { value: 'standard', label: 'Running count + decks' }], B.level, (v) => { B.level = v; drawPractice(); }), h('span', { class: 'small muted' }, B.session.n ? 'Session: ' + B.session.ok + ' / ' + B.session.n + ' matched' : 'Session: no bets yet')),
        h('div', { class: 'felt', style: { padding: '22px' } },
          h('div', { class: 'felt-print', style: { marginBottom: '14px' } }, 'Before the next deal'),
          h('div', { class: 'counts' },
            B.level === 'easy'
              ? h('div', { class: 'count tc', style: { gridColumn: 'span 3' } }, h('div', { class: 'k' }, 'True count'), h('div', { class: 'v' }, f(tc)))
              : [h('div', { class: 'count rc' }, h('div', { class: 'k' }, 'Running count'), h('div', { class: 'v' }, f(s.rc))), h('div', { class: 'count' }, h('div', { class: 'k' }, 'Decks remaining'), h('div', { class: 'v' }, String(s.decks))), h('div', { class: 'count' }, h('div', { class: 'k' }, 'Bankroll'), h('div', { class: 'v', style: { fontSize: '1.2rem' } }, money(bankroll)))]
          )
        ),
        h('div', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Your virtual bet'), h('div', { style: { maxWidth: '320px' } }, betF.el), chips, h('p', { class: 'small muted' }, 'Unit ' + money(cfg.unit) + ' · limits ' + money(cfg.minBet) + ' to ' + money(cfg.maxBet)), btn, errs),
        result
      );
      setTimeout(() => betF.focus(), 50);

      function submit() {
        if (btn.disabled) return;
        const v = CC.validateBet(betF.raw.trim() === '' ? '' : betF.value, cfg, bankroll);
        errs.innerHTML = '';
        if (!v.ok) {
          v.errors.forEach((m) => errs.appendChild(h('p', { class: 'small bad-t' }, m)));
          betF.el.animate && !UI.reducedMotion() && betF.el.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 });
          return;
        }
        btn.disabled = true;
        const sug = CC.suggestedBet(tc, Object.assign({}, cfg, { bankroll }));
        const ok = v.value === sug.bet;
        B.session.n++;
        if (ok) B.session.ok++;
        CC.store.record('bet', ok, null, { given: v.value, answer: sug.bet, src: 'coach' });
        const diff = v.value - sug.bet;
        const tb = h('tbody');
        CC.sortRamp(cfg.ramp).forEach((r, i) => tb.appendChild(h('tr', { class: i === sug.index ? 'hit' : '' }, h('td', null, CC.rangeLabel(i, cfg.ramp)), h('td', { class: 'mono' }, r.units), h('td', { class: 'mono' }, money(Math.min(Math.max(r.units * cfg.unit, cfg.minBet), cfg.maxBet))))));
        const row = (k, val, cls) => h('div', { class: 'row spread', style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } }, h('span', { class: 'muted' }, k), h('b', { class: 'mono ' + (cls || '') }, val));
        result.innerHTML = '';
        result.appendChild(
          h('div', { class: 'panel stack' },
            verdict(ok, ok ? 'Matches the ramp' : diff > 0 ? 'Bigger than the ramp' : 'Smaller than the ramp', ok ? 'Proposed and suggested bets are the same.' : 'Off by ' + money(Math.abs(diff)) + ' (' + (Math.round((Math.abs(diff) / cfg.unit) * 10) / 10) + ' units).'),
            h('div', null,
              B.level !== 'easy' ? row('True count', f(s.rc) + ' ÷ ' + s.decks + ' = ' + (s.rc / s.decks).toFixed(2) + ' → ' + f(tc) + ' (' + conv + ')') : null,
              row('Applicable range', sug.range),
              row('Your bet', money(v.value) + ' · ' + (Math.round((v.value / cfg.unit) * 10) / 10) + ' u'),
              row('Ramp suggests', money(sug.bet) + ' · ' + sug.units + ' u' + (sug.note ? ' · ' + sug.note : ''), 'acc-t'),
              row('Difference', (diff > 0 ? '+' : diff < 0 ? '−' : '') + money(Math.abs(diff)), diff === 0 ? 'good-t' : 'warn-t'),
              row('Bankroll exposure', (CC.exposure(v.value, bankroll) * 100).toFixed(2) + '% of ' + money(bankroll) + ' (ramp: ' + (CC.exposure(sug.bet, bankroll) * 100).toFixed(2) + '%)')
            ),
            h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Range'), h('th', null, 'Units'), h('th', null, 'Bet'))), tb)),
            h('p', { class: 'small muted' }, 'A higher true count means a slightly better expected return per hand, not a guaranteed win. Bankroll exposure shows what a single hand puts at risk.'),
            h('button', { class: 'btn', onclick: drawPractice, style: { alignSelf: 'flex-start' } }, 'Next count')
          )
        );
        const st = CC.store.stats('bet', { last: 30 });
        if (st.n >= 5) result.firstChild.appendChild(h('p', { class: 'small muted' }, 'Last 30 betting decisions: ' + pct(st.acc) + ' matched the ramp.'));
      }
    }

    drawConfig();
    drawPractice();
  }

  UI.register({ id: 'betting', label: 'Betting Coach', icon: 'chips', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
