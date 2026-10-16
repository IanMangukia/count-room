// Exercise and test generators. Every answer is computed with the engine; nothing is hard-coded.
(function (root) {
  const CC = (root.CC = root.CC || {});
  const f = (n) => CC.fmtSigned(n);

  const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'];
  const DIFF = {
    beginner: { label: 'Beginner', rcCards: 5, drill: 10, long: 52, speed: 1.3, flash: 1, perQ: 25, shoeDecks: 1, checkpoint: 13 },
    intermediate: { label: 'Intermediate', rcCards: 8, drill: 20, long: 52, speed: 0.9, flash: 1, perQ: 18, shoeDecks: 1, checkpoint: 13 },
    advanced: { label: 'Advanced', rcCards: 12, drill: 30, long: 104, speed: 0.6, flash: 2, perQ: 12, shoeDecks: 2, checkpoint: 13 },
    expert: { label: 'Expert', rcCards: 18, drill: 40, long: 104, speed: 0.4, flash: 3, perQ: 8, shoeDecks: 2, checkpoint: 13 },
  };

  const TESTS = [
    { id: 'card', name: 'Card values', cat: 'card', blurb: 'Name the Hi-Lo tag of each card.', counts: [12, 16, 20, 24] },
    { id: 'rc', name: 'Running count', cat: 'rc', blurb: 'Count a row of cards.', counts: [6, 8, 10, 12] },
    { id: 'tc', name: 'True count', cat: 'tc', blurb: 'Divide the running count by decks remaining.', counts: [6, 8, 10, 12] },
    { id: 'deck', name: 'Deck estimation', cat: 'deck', blurb: 'Read the discard tray.', counts: [6, 8, 10, 12] },
    { id: 'bet', name: 'Betting ramp', cat: 'bet', blurb: 'Pick the ramp bet for the count.', counts: [6, 8, 10, 12] },
    { id: 'shoe', name: 'Full-shoe counting', cat: 'rc', blurb: 'Keep the count through a dealt shoe, with checkpoints.', counts: null },
    { id: 'sim', name: 'Blackjack simulation', cat: 'mixed', blurb: 'Count, size the bet and play the hand.', counts: [6, 9, 12, 15] },
  ];

  function pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function randInt(lo, hi, rng) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  function card(rank, rng) {
    return CC.makeCard(rank, pick(CC.SUITS, rng));
  }

  function qCard(rng) {
    const c = CC.randomCards(1, rng)[0];
    const v = CC.hiLo(c.rank);
    const kind = v === 1 ? 'low card (2 to 6)' : v === 0 ? 'neutral card (7 to 9)' : 'high card (10, face card or ace)';
    return {
      cat: 'card',
      kind: 'choice',
      title: 'What is this card worth in Hi-Lo?',
      cards: [c],
      choices: [{ value: 1, label: '+1' }, { value: 0, label: '0' }, { value: -1, label: '−1' }],
      answer: v,
      accept: (x) => Number(x) === v,
      explain: () => c.rank + ' is a ' + kind + ', so it counts ' + f(v) + '.',
    };
  }

  function qRC(rng, d, nOverride) {
    const n = nOverride || DIFF[d].rcCards;
    const cards = CC.randomCards(n, rng);
    const rc = CC.runningCount(cards);
    return {
      cat: 'rc',
      kind: 'number',
      title: 'Running count for these ' + n + ' cards?',
      cards,
      answer: rc,
      accept: (x) => Number(x) === rc,
      explain: () =>
        'Card by card: ' +
        CC.countTrail(cards)
          .map((t) => t.card.rank + ' ' + f(t.value))
          .join(', ') +
        '. Total ' +
        f(rc) +
        '.',
    };
  }

  function tcScenario(rng, d) {
    let decks, rc;
    if (d === 'beginner') {
      decks = randInt(1, 6, rng);
      rc = decks * randInt(-3, 5, rng);
    } else if (d === 'intermediate') {
      decks = randInt(2, 12, rng) / 2;
      rc = randInt(-8, 14, rng);
    } else {
      decks = randInt(1, 14, rng) / 2;
      rc = randInt(-14, 20, rng);
    }
    return { rc, decks };
  }

  function qTC(rng, d, conv) {
    const { rc, decks } = tcScenario(rng, d);
    const ans = CC.trueCount(rc, decks, conv);
    const raw = rc / decks;
    return {
      cat: 'tc',
      kind: 'number',
      step: conv === 'exact' ? 0.1 : 1,
      title: 'What is the true count?',
      info: [
        { label: 'Running count', value: f(rc) },
        { label: 'Decks remaining', value: String(decks) },
        { label: 'Convention', value: conv[0].toUpperCase() + conv.slice(1) },
      ],
      answer: ans,
      raw,
      accept: (x) => Math.abs(Number(x) - ans) < 1e-9,
      explain: () => f(rc) + ' ÷ ' + decks + ' = ' + raw.toFixed(2) + ', which becomes ' + f(ans) + ' when you ' + (conv === 'exact' ? 'keep one decimal' : conv) + '.',
    };
  }

  function deckScenario(rng, d) {
    const total = d === 'expert' ? 8 : d === 'advanced' ? 8 : 6;
    const fraction = 0.08 + rng() * 0.8;
    const dealt = Math.round(total * 52 * fraction);
    const left = total * 52 - dealt;
    return { total, dealt, left, exact: left / 52 };
  }

  function qDeck(rng, d) {
    const s = deckScenario(rng, d);
    return {
      cat: 'deck',
      kind: 'number',
      step: 0.5,
      title: 'How many decks remain in the ' + s.total + '-deck shoe?',
      visual: { type: 'tray', total: s.total, dealt: s.dealt },
      answer: CC.estimateDecks(s.left),
      exact: s.exact,
      accept: (x) => x !== '' && Math.abs(Number(x) - s.exact) <= 0.5 + 1e-9,
      explain: () => s.dealt + ' cards are in the tray, so ' + s.left + ' remain: ' + s.exact.toFixed(2) + ' decks. Answers within half a deck count as correct.',
    };
  }

  function qBet(rng, d, conv, cfg) {
    let rc, decks, tc, info;
    if (d === 'beginner') {
      tc = randInt(-2, 6, rng);
      info = [{ label: 'True count', value: f(tc) }];
    } else {
      const s = tcScenario(rng, d === 'intermediate' ? 'beginner' : d);
      rc = s.rc;
      decks = s.decks;
      tc = CC.trueCount(rc, decks, conv === 'exact' ? 'floor' : conv);
      info = [
        { label: 'Running count', value: f(rc) },
        { label: 'Decks remaining', value: String(decks) },
      ];
    }
    const s = CC.suggestedBet(tc, Object.assign({}, cfg, { bankroll: null }));
    return {
      cat: 'bet',
      kind: 'number',
      title: 'How many units does your ramp call for?',
      info,
      answer: s.units,
      accept: (x) => Number(x) === s.units,
      explain: () => (rc != null ? 'True count ' + f(tc) + ' (' + f(rc) + ' ÷ ' + decks + '). ' : '') + s.range + ' on your ramp: ' + s.units + ' unit' + (s.units === 1 ? '' : 's') + '.',
    };
  }

  function strategyHand(rng) {
    const kind = pick(['hard', 'hard', 'hard', 'soft', 'pair'], rng);
    const ten = () => pick(['10', 'J', 'Q', 'K'], rng);
    let a, b;
    if (kind === 'pair') {
      const r = pick(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'], rng);
      a = card(r === '10' ? ten() : r, rng);
      b = card(r === '10' ? ten() : r, rng);
    } else if (kind === 'soft') {
      a = card('A', rng);
      b = card(pick(['2', '3', '4', '5', '6', '7', '8', '9'], rng), rng);
    } else {
      const total = randInt(8, 17, rng);
      let x = randInt(Math.max(2, total - 10), Math.min(10, total - 2), rng);
      let y = total - x;
      if (x === y) {
        x = x > 2 ? x - 1 : x + 1;
        y = total - x;
      }
      if (y > 10 || y < 2) {
        x = total - 10;
        y = 10;
      }
      a = card(x === 10 ? ten() : String(x), rng);
      b = card(y === 10 ? ten() : String(y), rng);
    }
    const up = card(pick(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], rng), rng);
    return { cards: [a, b], up };
  }

  function qStrategy(rng, d, rules) {
    const { cards, up } = strategyHand(rng);
    const isPair = CC.canPair(cards[0], cards[1]);
    const opts = { canDouble: true, canSplit: true, canSurrender: !!rules.surrender, hitSoft17: !!rules.hitSoft17, das: rules.das !== false };
    const bs = CC.basicStrategy(cards, up, opts);
    const choices = [
      { value: 'H', label: 'Hit' },
      { value: 'S', label: 'Stand' },
      { value: 'D', label: 'Double' },
    ];
    if (isPair) choices.push({ value: 'P', label: 'Split' });
    if (rules.surrender) choices.push({ value: 'R', label: 'Surrender' });
    return {
      cat: 'strategy',
      kind: 'choice',
      title: 'Basic strategy play?',
      cards,
      dealerUp: up,
      handKind: bs.kind,
      choices,
      answer: bs.code,
      accept: (x) => x === bs.code,
      explain: () => bs.situation + ': ' + bs.label + ' (multi-deck chart' + (rules.hitSoft17 ? ', H17' : ', S17') + ').',
    };
  }

  // A table snapshot: count the visible cards from two rounds.
  function qTableCount(rng, d) {
    const n = { beginner: 6, intermediate: 9, advanced: 12, expert: 15 }[d];
    const cards = CC.randomCards(n, rng);
    const q = qRC(rng, d, n);
    q.cards = cards;
    q.answer = CC.runningCount(cards);
    const ans = q.answer;
    q.accept = (x) => Number(x) === ans;
    q.title = 'These cards hit the table this round. Running count?';
    q.explain = () => 'Tags: ' + CC.countTrail(cards).map((t) => t.card.rank + ' ' + f(t.value)).join(', ') + '. Total ' + f(ans) + '.';
    return q;
  }

  function makeQuestion(testId, rng, d, ctx) {
    ctx = ctx || {};
    const conv = ctx.conv || 'truncate';
    switch (testId) {
      case 'card':
        return qCard(rng);
      case 'rc':
        return qRC(rng, d);
      case 'tc':
        return qTC(rng, d, conv);
      case 'deck':
        return qDeck(rng, d);
      case 'bet':
        return qBet(rng, d, conv, ctx.betting || CC.DEFAULT_BETTING);
      case 'strategy':
        return qStrategy(rng, d, ctx.rules || CC.DEFAULT_RULES);
      case 'sim': {
        const kinds = ['table', 'strategy', 'bet', 'tc'];
        const k = kinds[(ctx.index || 0) % kinds.length];
        if (k === 'table') return qTableCount(rng, d);
        if (k === 'strategy') return qStrategy(rng, d, ctx.rules || CC.DEFAULT_RULES);
        if (k === 'bet') return qBet(rng, d === 'beginner' ? 'intermediate' : d, conv, ctx.betting || CC.DEFAULT_BETTING);
        return qTC(rng, d, conv);
      }
      default:
        throw new Error('Unknown test ' + testId);
    }
  }

  function buildTest(testId, d, rng, ctx) {
    const t = TESTS.find((x) => x.id === testId);
    if (testId === 'shoe') return buildShoeTest(d, rng);
    const n = t.counts[DIFFICULTIES.indexOf(d)];
    const qs = [];
    for (let i = 0; i < n; i++) qs.push(makeQuestion(testId, rng, d, Object.assign({}, ctx, { index: i })));
    return { id: testId, difficulty: d, questions: qs };
  }

  // Full-shoe test: the cards are dealt as a stream with checkpoint questions.
  function buildShoeTest(d, rng) {
    const p = DIFF[d];
    const shoe = CC.createShoe(p.shoeDecks, rng);
    const cards = shoe.cards.slice().reverse();
    const checkpoints = [];
    for (let i = p.checkpoint; i <= cards.length; i += p.checkpoint) checkpoints.push(i);
    const questions = checkpoints.map((idx) => {
      const ans = CC.runningCount(cards.slice(0, idx));
      return {
        cat: 'rc',
        kind: 'number',
        title: 'Checkpoint after ' + idx + ' cards: running count?',
        checkpoint: idx,
        answer: ans,
        accept: (x) => Number(x) === ans,
        explain: () => 'After ' + idx + ' cards the running count is ' + f(ans) + '.' + (idx === cards.length ? ' A complete balanced shoe always ends at 0.' : ''),
      };
    });
    return { id: 'shoe', difficulty: d, cards, questions, speed: p.speed, flash: p.flash };
  }

  Object.assign(CC, { DIFFICULTIES, DIFF, TESTS, makeQuestion, buildTest, deckScenario, tcScenario, strategyHand, randInt, pick });
})(typeof globalThis !== 'undefined' ? globalThis : this);
