(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, f, cardEl, reveal, chipEl, chipStack, seg, verdict, toast, bump, pageHead, money, numberField, modal } = UI;

  const DEAL_GAP = 170;
  const T = { game: null, rulesKey: '', bet: 0, lastBet: 0, rendered: new Set(), downRendered: new Set(), roundLog: [], betCheck: null, reviewed: true };

  function rulesKey() {
    return JSON.stringify(CC.store.state.settings.rules);
  }
  function ensureGame() {
    const st = CC.store.state;
    if (!T.game || (T.rulesKey !== rulesKey() && T.game.phase !== 'player')) {
      T.game = CC.createGame(st.settings.rules, { bankroll: st.table.bankroll });
      T.rulesKey = rulesKey();
      T.rendered = new Set();
      T.downRendered = new Set();
      return true;
    }
    return false;
  }
  CC.UI.resetTable = () => { T.game = null; };

  function countNow(g) {
    const rc = CC.seenCount(g);
    const left = g.shoe.cards.length;
    const decks = CC.estimateDecks(left);
    const conv = CC.store.state.settings.conv;
    return { rc, left, decks, exactDecks: left / 52, tc: CC.trueCount(rc, decks, conv), betTC: CC.trueCount(rc, decks, conv === 'exact' ? 'floor' : conv) };
  }

  function render(el) {
    const st = CC.store.state;
    const settings = st.settings;
    const fresh = ensureGame();
    const g = T.game;
    const cfg = settings.betting;
    if (fresh && !T.bet) T.bet = Math.min(cfg.minBet, g.bankroll);
    const training = () => settings.tableMode === 'training';

    const modeSeg = seg([{ value: 'training', label: 'Training' }, { value: 'challenge', label: 'Challenge' }], settings.tableMode, (v) => { settings.tableMode = v; CC.store.save(); drawSide(); drawControls(); });
    el.appendChild(pageHead('Simulator', 'Blackjack Table', 'A multi-deck shoe dealt with the rules from Settings. Training shows the count and coaches your plays; Challenge hides both until you review each round.', modeSeg));

    const felt = h('div', { class: 'felt bj-felt' });
    const controls = h('div', { class: 'panel stack', style: { padding: '16px' } });
    const side = h('aside', { class: 'stack' });
    el.appendChild(h('div', { class: 'split' }, h('div', { class: 'table-wrap' }, felt, controls), side));

    // persistent felt structure
    const trayFill = h('i');
    const shoeFill = h('i');
    const dealerRow = h('div', { class: 'cards-row fan' });
    const dealerLabel = h('div', { class: 'hand-label' }, 'Dealer');
    const handsRow = h('div', { class: 'hands' });
    const msg = h('div', { class: 'felt-arc', style: { minHeight: '1.5em' }, 'aria-live': 'polite' });
    const r = g.rules;
    felt.append(
      h('div', { class: 'bj-top' },
        h('div', null, h('div', { class: 'mini-tray' }, trayFill), h('div', { class: 'zone-cap' }, 'Discards')),
        h('div', { class: 'bj-zone' }, dealerLabel, dealerRow),
        h('div', null, h('div', { class: 'mini-shoe', style: { marginLeft: 'auto' } }, shoeFill), h('div', { class: 'zone-cap' }, 'Shoe'))
      ),
      h('div', { class: 'felt-print' }, 'Blackjack pays ' + (r.bjPayout === 1.5 ? '3 to 2' : '6 to 5')),
      h('div', { class: 'felt-arc' }, 'Dealer ' + (r.hitSoft17 ? 'hits' : 'stands on') + ' soft 17' + (r.surrender ? ' · late surrender' : '')),
      msg,
      h('div', { class: 'bj-zone', style: { marginTop: 'auto' } }, handsRow)
    );

    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    // ---------- drawing ----------
    function drawFelt() {
      timers.forEach(clearTimeout);
      timers = [];
      const total = r.decks * 52;
      trayFill.style.height = (g.discard.length / total) * 58 + 'px';
      shoeFill.style.width = (g.shoe.cards.length / total) * 70 + 'px';

      const all = g.dealer.concat(...g.hands.map((x) => x.cards));
      const newCards = all.filter((c) => !T.rendered.has(c.id)).sort((a, b) => a.seq - b.seq);
      const hole = g.dealer[1];
      const holeReveal = hole && !g.holeHidden && T.downRendered.has(hole.id);
      const base = holeReveal ? 380 : 0;
      const delayOf = (c) => base + newCards.indexOf(c) * DEAL_GAP;
      const lastDelay = newCards.length ? delayOf(newCards[newCards.length - 1]) + 420 : base + 200;

      dealerRow.innerHTML = '';
      g.dealer.forEach((c, i) => {
        const isNew = !T.rendered.has(c.id);
        const down = i === 1 && (g.holeHidden || holeReveal);
        const ce = cardEl(c, { down, deal: isNew, delay: isNew ? delayOf(c) : 0, from: [180, -40] });
        dealerRow.appendChild(ce);
        if (i === 1 && holeReveal) later(() => reveal(ce), 40);
      });
      if (hole) {
        if (g.holeHidden) T.downRendered.add(hole.id);
        else T.downRendered.delete(hole.id);
      }
      const dv = g.dealer.length ? CC.handValue(g.holeHidden ? [g.dealer[0]] : g.dealer) : null;
      dealerLabel.innerHTML = '';
      dealerLabel.append('Dealer');
      if (dv) {
        const tot = h('span', { class: 'hand-total' }, g.holeHidden ? 'shows ' + (dv.soft ? 'A' : dv.total) : CC.describeHand(g.dealer));
        if (!g.holeHidden && holeReveal) tot.style.visibility = 'hidden';
        dealerLabel.appendChild(tot);
        if (tot.style.visibility === 'hidden') later(() => { tot.style.visibility = ''; bump(tot); }, lastDelay);
      }

      handsRow.innerHTML = '';
      if (g.phase === 'betting' || !g.hands.length) {
        const stack = h('div', { class: 'stack' });
        chipStack(T.bet).forEach((v, i) => stack.appendChild(h('span', { class: 'chip mini v' + v, style: { bottom: i * 4 + 'px', animationDelay: i * 40 + 'ms' } }, v)));
        handsRow.appendChild(h('div', { class: 'betspot' }, stack, h('span', { class: 'amt' }, T.bet ? money(T.bet) : 'Place a bet')));
      } else {
        g.hands.forEach((hand, hi) => {
          const v = CC.handValue(hand.cards);
          const row = h('div', { class: 'cards-row fan' });
          hand.cards.forEach((c) => {
            const isNew = !T.rendered.has(c.id);
            row.appendChild(cardEl(c, { deal: isNew, delay: isNew ? delayOf(c) : 0, from: [140, -260] }));
          });
          const label = h('div', { class: 'hand-label' }, g.hands.length > 1 ? 'Hand ' + (hi + 1) : 'You', h('span', { class: 'hand-total' }, CC.describeHand(hand.cards)), h('span', { class: 'mono small', style: { color: 'var(--acc-hi)' } }, money(hand.bet) + (hand.doubled ? ' · doubled' : '')));
          const badge = hand.result ? h('span', { class: 'result-badge ' + hand.result }, hand.result === 'blackjack' ? 'Blackjack' : hand.result) : null;
          const box = h('div', { class: 'hand' + (g.phase === 'player' && hi === g.active && g.hands.length > 1 ? ' active' : '') }, row, label, badge);
          if (badge) { badge.style.visibility = 'hidden'; later(() => (badge.style.visibility = ''), lastDelay); }
          handsRow.appendChild(box);
        });
      }
      newCards.forEach((c) => T.rendered.add(c.id));
      later(() => drawSide(), newCards.length ? lastDelay : 0);
      msg.textContent = '';
      if (g.phase === 'done' && g.lastRound) {
        const n = g.lastRound.net;
        later(() => { msg.textContent = n > 0 ? 'You won ' + money(n) : n < 0 ? 'You lost ' + money(-n) : 'Push: stake returned'; }, lastDelay);
      } else if (g.phase === 'player' && g.log.length) msg.textContent = g.log[g.log.length - 1];
    }

    // ---------- side panel ----------
    const countBox = h('section', { class: 'panel stack' });
    const bankBox = h('section', { class: 'panel stack' });
    const histBox = h('section', { class: 'panel stack' });
    const rulesBox = h('section', { class: 'panel stack' });
    side.append(countBox, bankBox, histBox, rulesBox);
    let lastRC = null;
    function drawSide() {
      const c = countNow(g);
      countBox.innerHTML = '';
      const showIt = training() && settings.showCount;
      const rcV = h('span', { class: 'v' + (showIt ? '' : ' hidden-val') }, showIt ? f(c.rc) : '•••');
      const tcV = h('span', { class: 'v' + (showIt ? '' : ' hidden-val') }, showIt ? f(c.tc) : '•••');
      countBox.append(
        h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Count'), training() ? UI.toggle('Show', settings.showCount, (v) => { settings.showCount = v; CC.store.save(); drawSide(); }, 'tb-show') : h('span', { class: 'pill' }, 'Hidden in challenge')),
        h('div', { class: 'counts' },
          h('div', { class: 'count rc' }, h('div', { class: 'k' }, 'Running'), rcV),
          h('div', { class: 'count' }, h('div', { class: 'k' }, 'Decks left'), h('span', { class: 'v' + (showIt ? '' : ' hidden-val') }, showIt ? String(c.decks) : '•••')),
          h('div', { class: 'count tc' }, h('div', { class: 'k' }, 'True'), tcV)
        ),
        h('p', { class: 'small muted' }, showIt ? 'Counts only cards you have seen. The dealer’s hole card is added when it turns over.' : training() ? 'Count display is off. Keep it in your head.' : 'You will be asked for the count after each round.')
      );
      if (showIt && lastRC !== null && lastRC !== c.rc) bump(rcV);
      lastRC = c.rc;

      bankBox.innerHTML = '';
      const sug = CC.suggestedBet(c.betTC, Object.assign({}, cfg, { bankroll: g.bankroll }));
      bankBox.append(
        h('div', { class: 'panel-title' }, 'Virtual bankroll'),
        h('div', { class: 'row spread' }, h('span', { class: 'mono', style: { fontSize: '1.6rem', fontWeight: 700 } }, money(g.bankroll)), h('span', { class: 'mono small ' + (st.table.net >= 0 ? 'good-t' : 'bad-t') }, (st.table.net >= 0 ? '+' : '−') + money(Math.abs(st.table.net)) + ' all time')),
        training() && g.phase !== 'player'
          ? h('div', { class: 'row spread small', style: { padding: '8px 10px', background: 'var(--ink)', borderRadius: '10px' } }, h('span', null, 'Ramp suggests ', h('b', { class: 'mono acc-t' }, money(sug.bet)), h('span', { class: 'muted' }, ' (' + sug.range + ')')), h('button', { class: 'btn sm', disabled: g.phase === 'player', onclick: () => { T.bet = sug.bet; drawFelt(); drawControls(); } }, 'Use'))
          : null,
        g.bankroll < cfg.minBet && g.phase !== 'player' ? h('button', { class: 'btn', onclick: resetBankroll }, 'Reset virtual bankroll to ' + money(cfg.bankroll)) : null
      );

      histBox.innerHTML = '';
      histBox.appendChild(h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Round history'), h('span', { class: 'small muted' }, st.table.rounds + ' rounds')));
      if (!g.history.length) histBox.appendChild(h('p', { class: 'small muted' }, 'Rounds from this shoe session appear here.'));
      else {
        const list = h('div', { class: 'history' });
        g.history.slice(0, 20).forEach((x) => list.appendChild(h('div', { class: 'h-row' }, h('span', { class: 'mono muted' }, '#' + x.id), h('span', null, x.hands.map((hh) => hh.desc).join(' / '), h('span', { class: 'muted' }, ' vs ' + x.dealer)), h('span', { class: 'net ' + (x.net > 0 ? 'good-t' : x.net < 0 ? 'bad-t' : 'muted') }, (x.net > 0 ? '+' : x.net < 0 ? '−' : '') + money(Math.abs(x.net))))));
        histBox.appendChild(list);
      }

      rulesBox.innerHTML = '';
      rulesBox.append(
        h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Rules'), h('button', { class: 'btn sm ghost', onclick: () => UI.go('settings') }, 'Edit')),
        h('p', { class: 'small muted' }, [r.decks + ' decks', r.hitSoft17 ? 'H17' : 'S17', 'blackjack ' + (r.bjPayout === 1.5 ? '3:2' : '6:5'), 'double ' + (r.doubleOn === 'any' ? 'any two' : r.doubleOn), r.das ? 'DAS' : 'no DAS', r.surrender ? 'late surrender' : 'no surrender', Math.round(r.penetration * 100) + '% penetration', 'no insurance'].join(' · ')),
        T.rulesKey !== rulesKey() ? h('p', { class: 'small warn-t' }, 'New rules apply when this round ends.') : null
      );
    }

    // ---------- controls ----------
    function drawControls() {
      controls.innerHTML = '';
      if (g.phase === 'player') {
        const acts = CC.availableActions(g);
        const defs = [['hit', 'Hit', 'H'], ['stand', 'Stand', 'S'], ['double', 'Double', 'D'], ['split', 'Split', 'P'], ['surrender', 'Surrender', 'R']];
        const row = h('div', { class: 'actions' });
        defs.forEach(([a, label, key]) => {
          if (a === 'surrender' && !r.surrender) return;
          row.appendChild(h('button', { class: 'btn' + (a === 'stand' ? ' primary' : ''), disabled: !acts.includes(a), title: 'Shortcut: ' + key, onclick: () => act(a) }, label));
        });
        controls.append(row, h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'Keys: H hit · S stand · D double · P split' + (r.surrender ? ' · R surrender' : '')));
        return;
      }
      if (g.phase === 'done') {
        if (!training() && !T.reviewed) {
          controls.append(h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary lg', onclick: openReview }, 'Review this round')));
          return;
        }
        controls.append(h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary lg', onclick: () => { T.bet = Math.min(T.lastBet, g.bankroll); deal(); }, disabled: T.lastBet > g.bankroll || T.lastBet < cfg.minBet }, 'Deal again · ' + money(T.lastBet)), h('button', { class: 'btn lg', onclick: () => { CC.clearTable(g); g.phase = 'betting'; refresh(); } }, 'Change bet')));
        return;
      }
      // betting
      const amt = h('span', { class: 'mono acc-t', style: { fontSize: '1.3rem', fontWeight: 700, minWidth: '90px', textAlign: 'center' } }, money(T.bet));
      const tray = h('div', { class: 'chip-tray' });
      [5, 25, 100, 500].forEach((v) => tray.appendChild(chipEl(v, { disabled: T.bet + v > Math.min(cfg.maxBet, g.bankroll), onClick: () => { T.bet += v; drawFelt(); drawControls(); } })));
      const valid = CC.validateBet(T.bet, cfg, g.bankroll);
      controls.append(
        tray,
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn sm ghost', onclick: () => { T.bet = 0; drawFelt(); drawControls(); } }, 'Clear'),
          amt,
          h('button', { class: 'btn primary lg', disabled: !valid.ok, onclick: deal }, 'Deal')
        ),
        h('p', { class: 'small ' + (valid.ok ? 'muted' : 'warn-t'), style: { textAlign: 'center' } }, valid.ok ? 'Table limits ' + money(cfg.minBet) + ' to ' + money(cfg.maxBet) + ' in virtual chips. Enter deals.' : valid.errors[0])
      );
    }

    // The side panel (and its count) is redrawn by drawFelt once the new cards have landed.
    function refresh() {
      drawFelt();
      drawControls();
    }

    // ---------- actions ----------
    function deal() {
      if (g.phase === 'player') return;
      const v = CC.validateBet(T.bet, cfg, g.bankroll);
      if (!v.ok) return toast(v.errors[0], 'bad');
      if (T.rulesKey !== rulesKey()) {
        ensureGame();
        return UI.navigate('table', { keepScroll: true });
      }
      const c = countNow(g);
      const sug = CC.suggestedBet(c.betTC, Object.assign({}, cfg, { bankroll: g.bankroll }));
      T.betCheck = { bet: T.bet, suggested: sug.bet, range: sug.range, tc: c.betTC, rc: c.rc, ok: T.bet === sug.bet };
      CC.store.record('bet', T.betCheck.ok, null, { given: T.bet, answer: sug.bet, src: 'table' });
      T.roundLog = [];
      T.lastBet = T.bet;
      T.reviewed = training();
      try {
        CC.startRound(g, T.bet);
      } catch (e) {
        return toast(e.message, 'bad');
      }
      if (g.justShuffled && g.roundId > 1) toast('Shuffle: new shoe, running count back to 0.');
      afterChange();
    }

    function act(a) {
      if (!CC.availableActions(g).includes(a)) return;
      const hand = g.hands[g.active];
      const acts = CC.availableActions(g);
      const bs = CC.basicStrategy(hand.cards, g.dealer[0], { canDouble: acts.includes('double'), canSplit: acts.includes('split'), canSurrender: acts.includes('surrender'), hitSoft17: r.hitSoft17, das: r.das });
      const code = CC.ACTION_TO_CODE[a];
      const ok = code === bs.code;
      T.roundLog.push({ situation: bs.situation, chose: CC.ACTION_LABELS[code], best: bs.label, ok });
      CC.store.record('strategy', ok, null, { kind: bs.kind, src: 'table' });
      if (!ok && training() && settings.coachStrategy) toast('Basic strategy: ' + bs.label + ' · ' + bs.situation, 'bad', 3600);
      CC[a](g);
      afterChange();
    }

    function afterChange() {
      if (g.phase === 'done') {
        const tb = st.table;
        tb.bankroll = g.bankroll;
        tb.rounds++;
        tb.net += g.lastRound.net;
        g.lastRound.hands.forEach((x) => { if (x.result === 'win' || x.result === 'blackjack') tb.wins++; else if (x.result === 'push') tb.pushes++; else tb.losses++; });
        tb.curve.push(g.bankroll);
        if (tb.curve.length > 500) tb.curve.splice(0, tb.curve.length - 500);
        CC.store.save();
      }
      refresh();
      if (g.phase === 'done' && !training()) setTimeout(() => { if (UI.current === 'table' && !T.reviewed) openReview(); }, UI.reducedMotion() ? 50 : 1300);
    }

    function openReview() {
      const c = countNow(g);
      const conv = settings.conv;
      const rcF = numberField({ id: 'rv-rc', label: 'Running count' });
      const tcF = numberField({ id: 'rv-tc', label: 'True count', step: conv === 'exact' ? 0.1 : 1 });
      const body = h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, 'Enter what you are holding in your head, then see how the round went.'),
        h('div', { class: 'grid-2' }, UI.field('Running count', rcF.el, 'rv-rc'), UI.field('True count (' + c.decks + ' decks left, ' + conv + ')', tcF.el, 'rv-tc'))
      );
      const m = modal({
        eyebrow: 'Round ' + g.roundId + ' review',
        title: 'What is the count?',
        body,
        dismissable: false,
        actions: [
          { label: 'Skip', onClick: () => { T.reviewed = true; drawControls(); drawSide(); } },
          { label: 'Check', primary: true, onClick: () => { showReview(rcF.value, tcF.value, c); return true; } },
        ],
      });
      [rcF, tcF].forEach((x) => x.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { m.close(); showReview(rcF.value, tcF.value, c); } }));
    }

    function showReview(uRC, uTC, c) {
      if (T.reviewed) return;
      T.reviewed = true;
      const rcOk = uRC === c.rc;
      const tcOk = !isNaN(uTC) && Math.abs(uTC - c.tc) < 1e-9;
      CC.store.record('rc', rcOk, null, { given: isNaN(uRC) ? null : uRC, answer: c.rc, src: 'table' });
      CC.store.record('tc', tcOk, null, { given: isNaN(uTC) ? null : uTC, answer: c.tc, raw: c.rc / c.decks, rc: c.rc, src: 'table' });
      const lr = g.lastRound;
      const decisions = T.roundLog.length
        ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Situation'), h('th', null, 'You'), h('th', null, 'Chart'))), h('tbody', null, T.roundLog.map((d) => h('tr', null, h('td', null, d.situation), h('td', { class: d.ok ? 'good-t' : 'bad-t' }, d.chose), h('td', null, d.best))))))
        : h('p', { class: 'small muted' }, 'No decisions this round (natural or dealer blackjack).');
      const bc = T.betCheck;
      modal({
        eyebrow: 'Round ' + g.roundId + ' review',
        title: rcOk && tcOk ? 'Count on track' : 'Count check',
        body: h('div', { class: 'stack' },
          verdict(rcOk, 'Running count ' + f(c.rc), 'You said ' + (isNaN(uRC) ? 'nothing' : f(uRC)) + '.'),
          verdict(tcOk, 'True count ' + f(c.tc), f(c.rc) + ' ÷ ' + c.decks + ' decks (' + c.left + ' cards left), ' + settings.conv + '. You said ' + (isNaN(uTC) ? 'nothing' : f(uTC)) + '.'),
          verdict(bc.ok, 'Bet ' + money(bc.bet) + (bc.ok ? ' matched the ramp' : ' vs ramp ' + money(bc.suggested)), 'Before the deal the true count was ' + f(bc.tc) + ' (' + bc.range + ').'),
          h('div', { class: 'panel-title' }, 'Decisions'),
          decisions,
          h('p', { class: 'small muted' }, 'Hand result: ' + (lr.net > 0 ? 'won ' + money(lr.net) : lr.net < 0 ? 'lost ' + money(-lr.net) : 'push') + '. The result says little about decision quality; the count and the chart do.')
        ),
        actions: [{ label: 'Continue', primary: true }],
        onClose: () => { drawControls(); drawSide(); },
      });
    }

    function resetBankroll() {
      modal({
        title: 'Reset virtual bankroll?',
        body: h('p', { class: 'muted' }, 'Your fictional bankroll goes back to ' + money(cfg.bankroll) + '. Table history stays in Analytics.'),
        actions: [{ label: 'Cancel' }, { label: 'Reset bankroll', primary: true, onClick: () => { g.bankroll = cfg.bankroll; st.table.bankroll = cfg.bankroll; st.table.curve.push(cfg.bankroll); CC.store.save(); T.bet = Math.min(T.bet || cfg.minBet, g.bankroll); refresh(); drawSide(); } }],
      });
    }

    function onKey(e) {
      if (e.target.closest('input, textarea, select') || document.querySelector('.modal-back')) return;
      const k = e.key.toLowerCase();
      if (g.phase === 'player') {
        const map = { h: 'hit', s: 'stand', d: 'double', p: 'split', r: 'surrender' };
        if (map[k]) { e.preventDefault(); act(map[k]); }
      } else if (k === 'enter' && g.phase === 'betting') { e.preventDefault(); deal(); }
    }
    document.addEventListener('keydown', onKey);

    // initial paint: treat cards already on the table as rendered (no replayed deal animation)
    if (!fresh) {
      g.dealer.concat(...g.hands.map((x) => x.cards)).forEach((c) => T.rendered.add(c.id));
      if (g.holeHidden && g.dealer[1]) T.downRendered.add(g.dealer[1].id);
    }
    drawFelt();
    drawControls();
    drawSide();
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
    };
  }

  UI.register({ id: 'table', label: 'Blackjack Table', icon: 'table', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
