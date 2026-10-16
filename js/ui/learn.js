(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, cardEl, numberField, seg, verdict, toast, bump, pageHead } = UI;
  const rng = () => Math.random();

  function mcq(choices) {
    return choices;
  }

  function trayViz(total, dealt, opts) {
    opts = opts || {};
    const H = 210;
    const tray = h('div', { class: 'tray' });
    const fill = h('div', { class: 'stackfill', style: { height: Math.max(2, (dealt / (total * 52)) * (H - 12)) + 'px' } });
    tray.appendChild(fill);
    if (opts.markers) for (let d = 1; d < total; d++) tray.appendChild(h('div', { class: 'tick', style: { bottom: 6 + (d / total) * (H - 12) + 'px' } }, d));
    const shoe = h('div', { class: 'shoebox' }, h('div', { class: 'stackfill', style: { width: Math.max(2, ((total * 52 - dealt) / (total * 52)) * 166) + 'px' } }));
    const wrap = h('div', { class: 'shoe-viz' }, h('div', null, tray, h('div', { class: 'viz-label' }, 'Discard tray')), h('div', null, shoe, h('div', { class: 'viz-label' }, total + '-deck shoe')));
    wrap.set = (d) => {
      fill.style.height = Math.max(2, (d / (total * 52)) * (H - 12)) + 'px';
      shoe.firstChild.style.width = Math.max(2, ((total * 52 - d) / (total * 52)) * 166) + 'px';
    };
    return wrap;
  }
  CC.UI.trayViz = trayViz;

  const LESSONS = [
    {
      id: 'fundamentals',
      title: 'Blackjack fundamentals',
      body: [
        'You play against the dealer, not the other players. Get closer to 21 than the dealer without going over. Number cards count their face value, J Q K count 10, and an ace counts 11 unless that would bust you, in which case it counts 1.',
        'A hand with an ace counted as 11 is soft: it cannot bust on the next card. A two-card 21 is a natural (blackjack) and usually pays 3:2. The dealer has no choices: they draw to 16 and stand on 17, with a house rule for soft 17.',
      ],
      example(box) {
        let cards = [];
        const row = h('div', { class: 'cards-row', style: { justifyContent: 'flex-start' } });
        const out = h('div', { class: 'mono acc-t', style: { fontSize: '1.2rem' } });
        const draw = () => {
          const c = CC.randomCards(1, rng)[0];
          cards.push(c);
          row.appendChild(cardEl(c, { size: 'sm', deal: true, from: [60, -40] }));
          const v = CC.handValue(cards);
          out.textContent = cards.length < 2 ? '' : CC.describeHand(cards) + (v.soft && !v.natural ? ' (ace counted as 11)' : '');
          bump(out);
          hitBtn.disabled = v.total >= 21;
        };
        const dealBtn = h('button', { class: 'btn sm', onclick: () => { cards = []; row.innerHTML = ''; draw(); draw(); } }, 'Deal two cards');
        const hitBtn = h('button', { class: 'btn sm', disabled: true, onclick: draw }, 'Hit');
        box.append(h('p', { class: 'small muted' }, 'Deal a hand and hit to watch soft totals turn hard.'), row, out, h('div', { class: 'row' }, dealBtn, hitBtn));
        dealBtn.click();
      },
      check: () => ({ q: 'You hold A, 6, 9. What is the total?', choices: ['Soft 16', 'Hard 16', '26', 'Bust'], answer: 1, explain: 'Counting the ace as 11 gives 26, so it drops to 1: 1 + 6 + 9 = hard 16.' }),
    },
    {
      id: 'hilo',
      title: 'The Hi-Lo system',
      body: [
        'Hi-Lo gives every card a tag. Low cards (2 to 6) are +1, neutral cards (7 to 9) are 0, and high cards (10, J, Q, K, A) are −1.',
        'Low cards help the dealer and high cards help you, so when many low cards are gone the remaining shoe is richer in tens and aces. A full deck has twenty +1 cards and twenty −1 cards, so the tags of a complete deck add up to zero.',
      ],
      example(box) {
        const lvl = CC.store.hintLevel();
        const grid = h('div', { class: 'hi-grid' });
        CC.RANKS.forEach((r, i) => {
          const c = CC.makeCard(r, CC.SUITS[i % 4]);
          const wrap = h('div', { style: { position: 'relative' } });
          const card = cardEl(c, { tag: lvl === 2 ? CC.hiLo(r) : null });
          card.title = 'Tap to show its tag';
          card.addEventListener('click', () => {
            if (!card.querySelector('.tag')) card.appendChild(cardEl(c, { tag: CC.hiLo(r) }).querySelector('.tag'));
          });
          wrap.appendChild(card);
          grid.appendChild(wrap);
        });
        // quick-fire recognition
        const qArea = h('div', { class: 'row', style: { alignItems: 'center', gap: '16px' } });
        const fb = h('div', { class: 'small' });
        let t0 = 0;
        const next = () => {
          qArea.innerHTML = '';
          const c = CC.randomCards(1, rng)[0];
          t0 = performance.now();
          qArea.appendChild(cardEl(c, { size: 'sm', deal: true }));
          [[1, '+1'], [0, '0'], [-1, '−1']].forEach(([v, l]) =>
            qArea.appendChild(
              h('button', { class: 'btn sm', onclick: () => {
                const ok = v === CC.hiLo(c.rank);
                CC.store.record('card', ok, performance.now() - t0, { rank: c.rank, given: v, answer: CC.hiLo(c.rank), src: 'lesson' });
                fb.className = 'small ' + (ok ? 'good-t' : 'bad-t');
                fb.textContent = ok ? 'Right: ' + c.rank + ' is ' + f(CC.hiLo(c.rank)) + '.' : c.rank + ' is ' + f(CC.hiLo(c.rank)) + ', not ' + f(v) + '.';
                next();
              } }, l)
            )
          );
        };
        box.append(h('p', { class: 'small muted' }, lvl === 2 ? 'Tags are shown while you learn. They hide automatically once your accuracy is high.' : 'Tap a card to check its tag.'), grid, h('div', { class: 'label' }, 'Quick fire'), qArea, fb);
        next();
      },
      check: () => {
        const r = CC.pick(['3', '7', 'K', 'A', '5', '9', '10'], rng);
        const v = CC.hiLo(r);
        return { q: 'What is the Hi-Lo tag of a ' + r + '?', choices: ['+1', '0', '−1'], answer: v === 1 ? 0 : v === 0 ? 1 : 2, explain: r + ' is ' + (v === 1 ? 'a low card (2–6)' : v === 0 ? 'a neutral card (7–9)' : 'a high card (10–A)') + ', so its tag is ' + f(v) + '.' };
      },
    },
    {
      id: 'running',
      title: 'Running counts',
      body: [
        'The running count is the sum of the tags of every card you have seen since the shuffle. Start at 0 after each shuffle and update as each card is exposed, including other players’ cards and the dealer’s cards.',
        'Only count what you can see. The dealer’s hole card enters the count when it is turned over, not before.',
      ],
      example(box) {
        const lvl = CC.store.hintLevel();
        let cards = CC.randomCards(8, rng);
        let i = 0;
        let rc = 0;
        const row = h('div', { class: 'cards-row', style: { justifyContent: 'flex-start', paddingBottom: '22px', gap: '8px' } });
        const rcEl = h('span', { class: 'v' }, '0');
        const btn = h('button', { class: 'btn sm primary', onclick: () => {
          if (i >= cards.length) return;
          const c = cards[i++];
          rc += CC.hiLo(c.rank);
          row.appendChild(cardEl(c, { size: 'sm', deal: true, from: [80, -30], tag: lvl >= 1 ? CC.hiLo(c.rank) : null }));
          rcEl.textContent = f(rc);
          bump(rcEl);
          if (i >= cards.length) btn.disabled = true;
        } }, 'Next card');
        const reset = h('button', { class: 'btn sm', onclick: () => { cards = CC.randomCards(8, rng); i = 0; rc = 0; row.innerHTML = ''; rcEl.textContent = '0'; btn.disabled = false; } }, 'New sequence');
        box.append(h('div', { class: 'count rc', style: { maxWidth: '180px' } }, h('div', { class: 'k' }, 'Running count'), rcEl), row, h('div', { class: 'row' }, btn, reset));
      },
      check: () => {
        const cards = CC.randomCards(5, rng);
        const rc = CC.runningCount(cards);
        const opts = [...new Set([rc, rc + 1, rc - 1, rc + 2])].sort((a, b) => a - b);
        return { q: 'Running count for ' + cards.map((c) => c.rank).join(', ') + '?', choices: opts.map(f), answer: opts.indexOf(rc), explain: CC.countTrail(cards).map((t) => t.card.rank + ' ' + f(t.value)).join(', ') + ' → ' + f(rc) + '.' };
      },
    },
    {
      id: 'true',
      title: 'True counts',
      body: [
        'A running count of +6 means much more with one deck left than with six. The true count adjusts for that: True count = Running count ÷ Decks remaining. A running count of +8 with 4 decks remaining is a true count of +2.',
        'You need a whole number to act on, so pick a convention and use it every time. Truncating drops the fraction (+2.8 becomes +2, −2.8 becomes −2). Flooring always rounds down (−2.8 becomes −3). Rounding goes to the nearest whole number. Many players floor or truncate for betting because it is conservative. Your current setting is used everywhere in the app and can be changed in Settings.',
      ],
      example(box) {
        const rcF = numberField({ id: 'l-true-rc', value: '+8' });
        const dF = numberField({ id: 'l-true-d', value: '4', step: 0.5, signed: false });
        const out = h('div', { class: 'tbl-wrap' });
        const calc = () => {
          const rc = rcF.value;
          const d = dF.value;
          out.innerHTML = '';
          if (isNaN(rc) || !(d > 0)) return out.appendChild(h('p', { class: 'small bad-t' }, 'Enter a running count and a positive number of decks.'));
          const conv = CC.store.state.settings.conv;
          const t = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Convention'), h('th', null, 'True count'))));
          const tb = h('tbody');
          tb.appendChild(h('tr', null, h('td', null, 'Exact division'), h('td', { class: 'mono' }, (rc / d).toFixed(2))));
          ['truncate', 'floor', 'round'].forEach((c) => tb.appendChild(h('tr', { class: c === conv ? 'hit' : '' }, h('td', null, c[0].toUpperCase() + c.slice(1) + (c === conv ? ' (your setting)' : '')), h('td', { class: 'mono' }, f(CC.trueCount(rc, d, c))))));
          t.appendChild(tb);
          out.appendChild(t);
        };
        rcF.input.addEventListener('input', calc);
        dF.input.addEventListener('input', calc);
        box.append(h('div', { class: 'grid-2' }, UI.field('Running count', rcF.el), UI.field('Decks remaining', dF.el)), out);
        calc();
      },
      check: () => {
        const conv = CC.store.state.settings.conv === 'exact' ? 'truncate' : CC.store.state.settings.conv;
        const rc = CC.pick([9, -7, 11, 13, -5], rng);
        const d = CC.pick([2, 2.5, 3, 4], rng);
        const tc = CC.trueCount(rc, d, conv);
        const opts = [...new Set([tc, tc + 1, tc - 1, rc])].sort((a, b) => a - b);
        return { q: 'Running count ' + f(rc) + ', ' + d + ' decks remaining, ' + conv + ' convention. True count?', choices: opts.map(f), answer: opts.indexOf(tc), explain: f(rc) + ' ÷ ' + d + ' = ' + (rc / d).toFixed(2) + ', and ' + conv + ' gives ' + f(tc) + '.' };
      },
    },
    {
      id: 'decks',
      title: 'Estimating decks remaining',
      body: [
        'You cannot count every card dealt, so you estimate. Look at the discard tray, judge how many decks are in it to the nearest half deck, and subtract from the shoe size. In a 6-deck shoe with 2½ decks discarded, 3½ decks remain.',
        'Errors here go straight into the true count. Overestimating decks remaining makes the true count too small; underestimating makes it too large.',
      ],
      example(box) {
        const total = 6;
        let dealt = 130;
        const viz = trayViz(total, dealt, { markers: true });
        const out = h('div', { class: 'mono acc-t', style: { fontSize: '1.1rem', textAlign: 'center' } });
        const slider = h('input', { id: 'l-decks-slider', type: 'range', class: 'range', min: 10, max: 300, value: dealt });
        const upd = () => {
          dealt = +slider.value;
          viz.set(dealt);
          out.textContent = (dealt / 52).toFixed(1) + ' decks discarded → ' + ((total * 52 - dealt) / 52).toFixed(2) + ' remain (≈ ' + CC.estimateDecks(total * 52 - dealt) + ')';
        };
        slider.addEventListener('input', upd);
        box.append(viz, slider, out);
        upd();
      },
      check: () => ({ q: 'A 6-deck shoe has about 2½ decks in the discard tray. How many decks remain?', choices: ['2½', '3', '3½', '4'], answer: 2, explain: '6 − 2½ = 3½ decks remaining.' }),
    },
    {
      id: 'ramp',
      title: 'Simulated betting ramps',
      body: [
        'A betting ramp maps the true count to a bet size in units. The example preset bets 1 unit at +1 or below, 2 units at +2, 4 at +3 and 6 at +4 or above. Betting uses a whole-number true count; fractions are floored.',
        'A ramp is a training example, not a universally optimal plan. The right ramp depends on rules, penetration, bankroll and risk tolerance, and a positive count never guarantees a winning hand.',
      ],
      example(box) {
        const cfg = CC.store.state.settings.betting;
        const slider = h('input', { id: 'l-ramp-slider', type: 'range', class: 'range', min: -3, max: 7, value: 2 });
        const out = h('div');
        const upd = () => {
          const s = CC.suggestedBet(+slider.value, Object.assign({}, cfg, { bankroll: null }));
          out.innerHTML = '';
          const tb = h('tbody');
          CC.sortRamp(cfg.ramp).forEach((r, i) => tb.appendChild(h('tr', { class: i === s.index ? 'hit' : '' }, h('td', null, CC.rangeLabel(i, cfg.ramp)), h('td', { class: 'mono' }, r.units + ' u'), h('td', { class: 'mono' }, Math.min(Math.max(r.units * cfg.unit, cfg.minBet), cfg.maxBet)))));
          out.append(
            h('p', { class: 'mono acc-t', style: { fontSize: '1.1rem' } }, 'TC ' + f(+slider.value) + ' → ' + s.units + ' unit' + (s.units > 1 ? 's' : '') + ' = ' + s.bet + ' chips'),
            h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Range'), h('th', null, 'Units'), h('th', null, 'Bet'))), tb))
          );
        };
        slider.addEventListener('input', upd);
        box.append(h('div', { class: 'label' }, 'True count'), slider, out);
        upd();
      },
      check: () => {
        const tc = CC.pick([-1, 2, 3, 5], rng);
        const u = CC.rampUnits(tc, CC.PRESET_RAMP);
        const opts = [1, 2, 4, 6];
        return { q: 'With the preset ramp, how many units at a true count of ' + f(tc) + '?', choices: opts.map((x) => x + ' unit' + (x > 1 ? 's' : '')), answer: opts.indexOf(u), explain: CC.rangeLabel(CC.rampIndex(tc, CC.PRESET_RAMP), CC.PRESET_RAMP) + ' maps to ' + u + ' unit' + (u > 1 ? 's' : '') + '.' };
      },
    },
    {
      id: 'speed',
      title: 'Counting under time pressure',
      body: [
        'At a real table cards come fast and several at a time. Count in groups: a low card and a high card together cancel to 0, so you can skip pairs instead of adding each card. Two low cards are +2, two high cards are −2.',
        'Speed comes from accuracy, not the other way round. Raise the speed only after you hit about 90% at the current one.',
      ],
      example(box) {
        let speed = 0.8;
        const stage = h('div', { class: 'flash', style: { minHeight: '100px' } });
        const ans = numberField({ id: 'l-speed-ans', onEnter: () => submit() });
        const fb = h('div');
        const inputRow = h('div', { class: 'row', hidden: true }, h('div', { style: { width: '200px' } }, ans.el), h('button', { class: 'btn primary', onclick: () => submit() }, 'Check'));
        let cards = [];
        let t0 = 0;
        let timer = null;
        const start = () => {
          clearInterval(timer);
          fb.innerHTML = '';
          inputRow.hidden = true;
          cards = CC.randomCards(10, rng);
          let i = 0;
          const tick = () => {
            stage.innerHTML = '';
            if (i >= cards.length) {
              clearInterval(timer);
              inputRow.hidden = false;
              ans.set('');
              ans.focus();
              t0 = performance.now();
              return;
            }
            stage.appendChild(cardEl(cards[i], { size: 'sm', deal: true, from: [0, -30] }));
            if (cards[i + 1]) stage.appendChild(cardEl(cards[i + 1], { size: 'sm', deal: true, from: [0, -30], delay: 40 }));
            i += 2;
          };
          tick();
          timer = setInterval(tick, speed * 1000);
        };
        function submit() {
          if (!cards.length || inputRow.hidden) return;
          const rc = CC.runningCount(cards);
          const ok = ans.value === rc;
          CC.store.record('rc', ok, performance.now() - t0, { given: ans.value, answer: rc, speed, src: 'lesson' });
          fb.innerHTML = '';
          fb.appendChild(verdict(ok, ok ? 'Correct: ' + f(rc) : 'The count was ' + f(rc), 'Pairs: ' + cards.reduce((a, c, i) => (i % 2 ? a : a.concat(c.rank + '+' + (cards[i + 1] ? cards[i + 1].rank : ''))), []).join('  ·  ')));
          inputRow.hidden = true;
        }
        box.append(
          h('div', { class: 'row' }, seg([{ value: 1.2, label: 'Slow' }, { value: 0.8, label: 'Medium' }, { value: 0.45, label: 'Fast' }], speed, (v) => (speed = v)), h('button', { class: 'btn sm primary', onclick: start }, 'Flash 10 cards in pairs')),
          h('div', { class: 'felt', style: { padding: '16px' } }, stage),
          inputRow,
          fb
        );
        return () => clearInterval(timer);
      },
      check: () => ({ q: 'You see 5 and K together. What is the quickest way to count them?', choices: ['Add +1 then −1', 'They cancel: 0', 'Count only the K', 'Wait for the next card'], answer: 1, explain: 'A low and a high card cancel, so the pair changes nothing.' }),
    },
    {
      id: 'mistakes',
      title: 'Common counting mistakes',
      body: [
        'The usual errors: counting the dealer’s hole card before it is shown, forgetting cards that get scooped quickly after a bust, dividing by decks dealt instead of decks remaining, using the running count as if it were the true count, and forgetting to reset to 0 after a shuffle.',
        'Find the error below. Someone kept a running tally and made one mistake. Tap the first card where the tally goes wrong.',
      ],
      example(box) {
        const area = h('div');
        const fb = h('div');
        const build = () => {
          area.innerHTML = '';
          fb.innerHTML = '';
          const cards = CC.randomCards(7, rng);
          const errAt = 1 + Math.floor(rng() * 6);
          let rc = 0;
          const row = h('div', { class: 'breakdown' });
          cards.forEach((c, i) => {
            rc += CC.hiLo(c.rank) + (i === errAt ? (CC.hiLo(c.rank) >= 0 ? -1 : 1) : 0);
            const item = h('button', { class: 'bd-item choice', style: { padding: '6px' }, onclick: () => {
              const ok = i === errAt;
              fb.innerHTML = '';
              fb.appendChild(verdict(ok, ok ? 'Found it' : 'Not that one', 'The ' + cards[errAt].rank + ' is ' + f(CC.hiLo(cards[errAt].rank)) + ', but the tally moved as if it were ' + f(CC.hiLo(cards[errAt].rank) + (CC.hiLo(cards[errAt].rank) >= 0 ? -1 : 1)) + '. Every number after it is off by one too.'));
            } }, cardEl(c, { size: 'sm' }), h('span', { class: 'r' }, 'tally ' + f(rc)));
            row.appendChild(item);
          });
          area.appendChild(row);
        };
        box.append(area, fb, h('button', { class: 'btn sm', onclick: build }, 'New example'));
        build();
      },
      check: () => ({ q: 'The dealer has a face-down hole card. When does it enter your count?', choices: ['Right away, assume it is a ten', 'When it is turned face up', 'Never', 'At the next shuffle'], answer: 1, explain: 'Count only exposed cards. The hole card is counted when the dealer reveals it.' }),
    },
    {
      id: 'strategy',
      title: 'Blackjack strategy basics',
      body: [
        'Counting only helps if you also play your hands well. Basic strategy is the mathematically best play for each hand against each dealer upcard. The chart used here assumes a multi-deck shoe with double after split and late surrender where available.',
        'Some anchors: always split aces and eights, never split tens or fives, stand on hard 12 against 4 to 6, double 11 against everything but an ace in S17 games, and hit soft 18 against 9, 10 or ace.',
      ],
      example(box) {
        const area = h('div', { class: 'stack' });
        const build = () => {
          area.innerHTML = '';
          const { cards, up } = CC.strategyHand(rng);
          const rules = CC.store.state.settings.rules;
          const bs = CC.basicStrategy(cards, up, { canSurrender: rules.surrender, hitSoft17: rules.hitSoft17, das: rules.das });
          const fb = h('div');
          const t0 = performance.now();
          const opts = [['H', 'Hit'], ['S', 'Stand'], ['D', 'Double']];
          if (CC.canPair(cards[0], cards[1])) opts.push(['P', 'Split']);
          if (rules.surrender) opts.push(['R', 'Surrender']);
          const buttons = h('div', { class: 'choices' });
          opts.forEach(([code, label]) =>
            buttons.appendChild(
              h('button', { class: 'choice', onclick: (e) => {
                const ok = code === bs.code;
                CC.store.record('strategy', ok, performance.now() - t0, { kind: bs.kind, src: 'lesson' });
                buttons.querySelectorAll('button').forEach((b) => (b.disabled = true));
                e.currentTarget.classList.add(ok ? 'right' : 'wrong');
                fb.appendChild(h('div', { class: 'feedback ' + (ok ? 'ok' : 'no') }, (ok ? 'Correct. ' : 'Basic strategy says ' + bs.label + '. ') + bs.situation + '.'));
              } }, label)
            )
          );
          area.append(
            h('div', { class: 'row', style: { gap: '28px', alignItems: 'flex-end' } },
              h('div', null, h('div', { class: 'label' }, 'Dealer shows'), h('div', { class: 'cards-row', style: { justifyContent: 'flex-start' } }, cardEl(up, { size: 'sm', deal: true }))),
              h('div', null, h('div', { class: 'label' }, 'Your hand'), h('div', { class: 'cards-row', style: { justifyContent: 'flex-start' } }, cards.map((c, i) => cardEl(c, { size: 'sm', deal: true, delay: 80 * (i + 1) }))))
            ),
            buttons,
            fb,
            h('button', { class: 'btn sm', onclick: build, style: { alignSelf: 'flex-start' } }, 'Next hand')
          );
        };
        box.append(area);
        build();
      },
      check: () => ({ q: 'Hard 16 against a dealer 10, and surrender is not offered. What does basic strategy say?', choices: ['Stand', 'Hit', 'Double', 'Split'], answer: 1, explain: 'Without surrender, hard 16 against a 10 is a hit. It is a losing hand either way; hitting loses slightly less.' }),
    },
    {
      id: 'variance',
      title: 'Variance and limitations',
      body: [
        'Even with a real edge, results swing hard. A counter’s overall advantage is often around 1% or less of the money bet, while the standard deviation of a single hand is about 1.15 bets. Over a few hundred hands the swings dwarf the edge.',
        'The simulation below draws sessions of 300 hands with a small positive edge. Watch how many still finish behind. It is a simplified model (fixed bet, normal approximation), included to set expectations, not to estimate real-world returns. Casinos also counter counting with shuffles, bet limits and by asking players to leave.',
      ],
      example(box) {
        const out = h('div');
        let edge = 0.01;
        const run = () => {
          const sessions = 12, hands = 300, sd = 1.15;
          const paths = [];
          let losing = 0;
          for (let s = 0; s < sessions; s++) {
            let b = 0;
            const p = [0];
            for (let i = 0; i < hands; i++) {
              const u1 = Math.random() || 1e-9, u2 = Math.random();
              b += edge + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
              if (i % 5 === 4) p.push(b);
            }
            if (b < 0) losing++;
            paths.push(p);
          }
          const all = paths.flat();
          const lo = Math.min(...all), hi = Math.max(...all);
          const W = 640, H = 220, P = 30;
          const X = (i) => P + (i / (paths[0].length - 1)) * (W - P * 2);
          const Y = (v) => 10 + (1 - (v - lo) / (hi - lo || 1)) * (H - 30);
          let s = '<line class="grid" x1="' + P + '" x2="' + (W - P) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/><text x="' + (P - 4) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>';
          s += '<text x="' + (P - 4) + '" y="' + (Y(hi) + 4) + '" text-anchor="end">' + Math.round(hi) + '</text><text x="' + (P - 4) + '" y="' + (Y(lo) + 4) + '" text-anchor="end">' + Math.round(lo) + '</text>';
          paths.forEach((p) => {
            const end = p[p.length - 1];
            s += '<path d="' + p.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ') + '" fill="none" stroke="' + (end >= 0 ? '#63c890' : '#e2675e') + '" stroke-opacity=".75" stroke-width="1.4"/>';
          });
          s += '<text x="' + P + '" y="' + (H - 4) + '">hand 0</text><text x="' + (W - P) + '" y="' + (H - 4) + '" text-anchor="end">hand ' + hands + '</text>';
          out.innerHTML = '';
          out.append(UI.svg('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Simulated session results in bets">' + s + '</svg>'), h('p', { class: 'small' }, losing + ' of ' + sessions + ' sessions finished behind despite a ' + (edge * 100).toFixed(1) + '% edge. Expected gain over 300 hands: ' + (edge * hands).toFixed(1) + ' bets; one standard deviation: ' + (sd * Math.sqrt(hands)).toFixed(1) + ' bets.'));
        };
        box.append(h('div', { class: 'row' }, seg([{ value: -0.005, label: '−0.5% edge' }, { value: 0.01, label: '+1% edge' }, { value: 0.02, label: '+2% edge' }], edge, (v) => { edge = v; run(); }), h('button', { class: 'btn sm', onclick: run }, 'Run again')), out);
        run();
      },
      check: () => ({ q: 'Your true count is +4 and you lose five hands in a row. What does that tell you?', choices: ['The count was wrong', 'Lower your bets permanently', 'Very little: short-term results are dominated by variance', 'The shoe is now negative'], answer: 2, explain: 'A favourable count shifts the odds slightly. Five hands say almost nothing about whether your decisions were right.' }),
    },
  ];
  CC.LESSONS = LESSONS;

  let currentId = null;
  function render(el) {
    const st = CC.store.state;
    if (!currentId) currentId = (LESSONS.find((l) => !st.lessons[l.id]) || LESSONS[0]).id;
    const done = Object.keys(st.lessons).length;
    el.appendChild(pageHead('Curriculum', 'Learn', 'Ten short lessons. Each has an interactive example and a knowledge check; answer the check correctly to complete it.', h('div', { style: { minWidth: '200px' } }, h('div', { class: 'row spread small' }, h('span', { class: 'muted' }, 'Progress'), h('b', { class: 'mono' }, done + ' / ' + LESSONS.length)), h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: (done / LESSONS.length) * 100 + '%' } })))));
    const list = h('nav', { class: 'lessons', 'aria-label': 'Lessons' });
    const pane = h('div', { class: 'panel stack', style: { padding: '24px' } });
    let lessonCleanup = null;
    const draw = () => {
      list.innerHTML = '';
      LESSONS.forEach((l, i) => list.appendChild(h('button', { class: 'lesson-link' + (st.lessons[l.id] ? ' done' : ''), 'aria-current': String(l.id === currentId), onclick: () => { currentId = l.id; draw(); } }, h('span', { class: 'lesson-dot' }, st.lessons[l.id] ? '✓' : i + 1), l.title)));
      if (lessonCleanup) lessonCleanup();
      lessonCleanup = drawLesson(pane, LESSONS.find((l) => l.id === currentId), () => { draw(); });
    };
    el.appendChild(h('div', { class: 'learn' }, h('div', { class: 'panel', style: { padding: '10px' } }, list), pane));
    draw();
    return () => lessonCleanup && lessonCleanup();
  }

  function drawLesson(pane, L, onDone) {
    const st = CC.store.state;
    const idx = LESSONS.indexOf(L);
    pane.innerHTML = '';
    pane.style.animation = 'none';
    void pane.offsetWidth;
    pane.style.animation = 'viewIn .35s var(--ease) both';
    const ex = h('div', { class: 'example stack' });
    pane.append(
      h('div', { class: 'row spread' }, h('div', { class: 'eyebrow' }, 'Lesson ' + (idx + 1) + ' of ' + LESSONS.length), st.lessons[L.id] ? h('span', { class: 'pill good' }, 'Completed') : h('span', { class: 'pill' }, 'Not completed')),
      h('h2', null, L.title),
      h('div', { class: 'lesson-body' }, L.body.map((p) => h('p', null, p))),
      h('div', { class: 'label' }, 'Try it'),
      ex
    );
    const cleanup = L.example(ex);

    const checkBox = h('div', { class: 'stack' });
    const drawCheck = () => {
      checkBox.innerHTML = '';
      const c = L.check();
      const fb = h('div');
      const choices = h('div', { class: 'choices' });
      c.choices.forEach((label, i) =>
        choices.appendChild(
          h('button', { class: 'choice', onclick: (e) => {
            const ok = i === c.answer;
            choices.querySelectorAll('button').forEach((b, j) => { b.disabled = true; if (j === c.answer) b.classList.add('right'); });
            if (!ok) e.currentTarget.classList.add('wrong');
            fb.appendChild(h('div', { class: 'feedback ' + (ok ? 'ok' : 'no') }, (ok ? 'Correct. ' : 'Not quite. ') + c.explain));
            if (ok && !st.lessons[L.id]) {
              st.lessons[L.id] = Date.now();
              CC.store.save();
              toast('Lesson complete: ' + L.title, 'good');
              setTimeout(onDone, 900);
            } else if (!ok) fb.appendChild(h('button', { class: 'btn sm', style: { marginTop: '8px' }, onclick: drawCheck }, 'Try another question'));
          } }, label)
        )
      );
      checkBox.append(h('p', { style: { fontWeight: 700 } }, c.q), choices, fb);
    };
    drawCheck();
    pane.append(h('div', { class: 'label' }, 'Knowledge check'), checkBox);
    const next = LESSONS[idx + 1];
    pane.append(
      h('div', { class: 'row spread', style: { marginTop: '6px' } },
        idx > 0 ? h('button', { class: 'btn ghost', onclick: () => { currentId = LESSONS[idx - 1].id; onDone(); } }, '← ' + LESSONS[idx - 1].title) : h('span'),
        next ? h('button', { class: 'btn', onclick: () => { currentId = next.id; onDone(); } }, next.title + ' →') : h('button', { class: 'btn', onclick: () => UI.go('count') }, 'Go to Count Trainer →')
      )
    );
    return typeof cleanup === 'function' ? cleanup : null;
  }

  UI.register({ id: 'learn', label: 'Learn', icon: 'book', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
