// Blackjack rules engine: hand values, dealer play, round state machine, payouts, basic strategy.
(function (root) {
  const CC = (root.CC = root.CC || {});

  const DEFAULT_RULES = {
    decks: 6,
    hitSoft17: false, // false = dealer stands on soft 17 (S17)
    bjPayout: 1.5, // 1.5 = 3:2, 1.2 = 6:5
    doubleOn: 'any', // 'any' | '9-11' | '10-11'
    das: true, // double after split
    surrender: true, // late surrender
    penetration: 0.75, // fraction of the shoe dealt before reshuffle
    maxHands: 4,
  };

  function cardPoints(rank) {
    if (rank === 'A') return 1;
    if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
    return parseInt(rank, 10);
  }

  function handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      total += cardPoints(c.rank);
      if (c.rank === 'A') aces++;
    }
    let soft = false;
    if (aces > 0 && total + 10 <= 21) {
      total += 10;
      soft = true;
    }
    return { total, soft, bust: total > 21, twentyOne: total === 21, natural: cards.length === 2 && total === 21 };
  }

  function describeHand(cards) {
    const v = handValue(cards);
    if (v.bust) return 'Bust (' + v.total + ')';
    if (v.natural) return 'Blackjack';
    return (v.soft ? 'Soft ' : '') + v.total;
  }

  function dealerShouldHit(cards, hitSoft17) {
    const v = handValue(cards);
    if (v.total < 17) return true;
    if (v.total === 17 && v.soft && hitSoft17) return true;
    return false;
  }

  function canPair(a, b) {
    return cardPoints(a.rank) === cardPoints(b.rank);
  }

  function doubleAllowedForTotal(cards, rule) {
    if (rule === 'any') return true;
    const v = handValue(cards);
    if (v.soft) return false;
    if (rule === '9-11') return v.total >= 9 && v.total <= 11;
    if (rule === '10-11') return v.total === 10 || v.total === 11;
    return true;
  }

  // Cards left in the shoe at which we reshuffle before the next round. Clamped so a round can finish.
  function reshufflePoint(rules) {
    const total = rules.decks * 52;
    return Math.max(15, Math.round(total * (1 - rules.penetration)));
  }

  function newHand(bet) {
    return { cards: [], bet, baseBet: bet, doubled: false, surrendered: false, done: false, fromSplit: false, splitAces: false, result: null, payout: 0 };
  }

  function createGame(rules, opts) {
    opts = opts || {};
    const g = {
      rules: Object.assign({}, DEFAULT_RULES, rules || {}),
      rng: opts.rng || Math.random,
      bankroll: opts.bankroll != null ? opts.bankroll : 10000,
      phase: 'betting', // betting | player | done
      dealer: [],
      holeHidden: false,
      hands: [],
      active: 0,
      discard: [],
      seen: [], // every card the player has been able to see since the last shuffle
      history: [],
      roundId: 0,
      shuffles: 0,
      justShuffled: false,
      log: [],
    };
    reshuffle(g);
    return g;
  }

  function reshuffle(g) {
    g.shoe = CC.createShoe(g.rules.decks, g.rng);
    g.discard = [];
    g.seen = [];
    g.shuffles++;
    g.justShuffled = true;
  }

  function draw(g, faceUp) {
    if (!g.shoe.cards.length) {
      // Emergency mid-round shuffle (only possible with extreme settings). Count restarts from visible table cards.
      const onTable = g.dealer.concat(...g.hands.map((h) => h.cards));
      g.shoe = CC.createShoe(g.rules.decks, g.rng);
      g.discard = [];
      g.seen = onTable.filter((c) => !(g.holeHidden && c === g.dealer[1]));
      g.shuffles++;
      g.log.push('Shoe ran out mid-round and was reshuffled.');
    }
    const c = CC.drawCard(g.shoe);
    g.seq = (g.seq || 0) + 1;
    c.seq = g.seq; // deal order, used by the UI to stagger animations
    if (faceUp) g.seen.push(c);
    return c;
  }

  function seenCount(g) {
    return CC.runningCount(g.seen);
  }

  function clearTable(g) {
    for (const c of g.dealer) g.discard.push(c);
    for (const h of g.hands) for (const c of h.cards) g.discard.push(c);
    g.dealer = [];
    g.hands = [];
    g.active = 0;
  }

  function startRound(g, bet) {
    if (g.phase === 'player') throw new Error('Finish the current round first');
    if (!Number.isFinite(bet) || bet <= 0) throw new Error('Bet must be a positive amount');
    if (bet > g.bankroll) throw new Error('Bet exceeds bankroll');
    clearTable(g);
    g.justShuffled = false;
    if (g.shoe.cards.length <= reshufflePoint(g.rules)) reshuffle(g);
    g.roundId++;
    g.log = [];
    g.bankroll -= bet;
    const h = newHand(bet);
    g.hands = [h];
    g.active = 0;
    h.cards.push(draw(g, true));
    g.dealer.push(draw(g, true));
    h.cards.push(draw(g, true));
    g.dealer.push(draw(g, false)); // hole card, not counted until revealed
    g.holeHidden = true;
    g.phase = 'player';
    g.roundStartBet = bet;

    const up = g.dealer[0];
    const dealerBJ = handValue(g.dealer).natural;
    const playerBJ = handValue(h.cards).natural;
    const upIsTenOrAce = cardPoints(up.rank) === 10 || up.rank === 'A';
    if (upIsTenOrAce && dealerBJ) {
      g.log.push('Dealer checked and has blackjack.');
      revealHole(g);
      return settle(g);
    }
    if (upIsTenOrAce) g.log.push('Dealer checked for blackjack: none.');
    if (playerBJ) {
      revealHole(g);
      return settle(g);
    }
    return g;
  }

  function revealHole(g) {
    if (g.holeHidden) {
      g.holeHidden = false;
      g.seen.push(g.dealer[1]);
    }
  }

  function activeHand(g) {
    return g.hands[g.active];
  }

  function availableActions(g) {
    if (g.phase !== 'player') return [];
    const h = activeHand(g);
    const r = g.rules;
    const acts = [];
    if (!h.splitAces) acts.push('hit');
    acts.push('stand');
    if (
      h.cards.length === 2 &&
      !h.splitAces &&
      g.bankroll >= h.bet &&
      doubleAllowedForTotal(h.cards, r.doubleOn) &&
      (!h.fromSplit || r.das)
    )
      acts.push('double');
    if (h.cards.length === 2 && canPair(h.cards[0], h.cards[1]) && g.hands.length < r.maxHands && g.bankroll >= h.bet && !h.splitAces)
      acts.push('split');
    if (r.surrender && g.hands.length === 1 && h.cards.length === 2 && !h.fromSplit) acts.push('surrender');
    return acts;
  }

  function requireAction(g, a) {
    if (!availableActions(g).includes(a)) throw new Error('Action not available: ' + a);
  }

  function hit(g) {
    requireAction(g, 'hit');
    const h = activeHand(g);
    h.cards.push(draw(g, true));
    const v = handValue(h.cards);
    if (v.bust || v.total === 21) return advance(g);
    return g;
  }

  function stand(g) {
    requireAction(g, 'stand');
    return advance(g);
  }

  function double(g) {
    requireAction(g, 'double');
    const h = activeHand(g);
    g.bankroll -= h.bet;
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw(g, true));
    return advance(g);
  }

  function split(g) {
    requireAction(g, 'split');
    const h = activeHand(g);
    const [a, b] = h.cards;
    g.bankroll -= h.bet;
    const isAces = a.rank === 'A';
    const h1 = newHand(h.bet);
    const h2 = newHand(h.bet);
    h1.cards = [a];
    h2.cards = [b];
    h1.fromSplit = h2.fromSplit = true;
    h1.splitAces = h2.splitAces = isAces;
    g.hands.splice(g.active, 1, h1, h2);
    h1.cards.push(draw(g, true));
    if (isAces) {
      h2.cards.push(draw(g, true));
      h1.done = true;
      h2.done = true;
      return advance(g, true);
    }
    if (handValue(h1.cards).total === 21) return advance(g);
    return g;
  }

  function surrender(g) {
    requireAction(g, 'surrender');
    const h = activeHand(g);
    h.surrendered = true;
    return advance(g);
  }

  // Move to the next unfinished hand, or to the dealer.
  function advance(g, skipMark) {
    if (!skipMark) activeHand(g).done = true;
    for (let i = 0; i < g.hands.length; i++) {
      const h = g.hands[i];
      if (h.done) continue;
      g.active = i;
      if (h.cards.length === 1) h.cards.push(draw(g, true));
      if (handValue(h.cards).total === 21) {
        h.done = true;
        continue;
      }
      return g;
    }
    return dealerPlay(g);
  }

  function dealerPlay(g) {
    revealHole(g);
    const live = g.hands.some((h) => !h.surrendered && !handValue(h.cards).bust);
    if (live) {
      while (dealerShouldHit(g.dealer, g.rules.hitSoft17)) g.dealer.push(draw(g, true));
    }
    return settle(g);
  }

  function settle(g) {
    const d = handValue(g.dealer);
    const dealerBJ = d.natural;
    let wagered = 0;
    let returned = 0;
    for (const h of g.hands) {
      const v = handValue(h.cards);
      const natural = v.natural && !h.fromSplit && g.hands.length === 1;
      wagered += h.bet;
      if (h.surrendered) {
        h.result = 'surrender';
        h.payout = h.bet / 2;
      } else if (dealerBJ) {
        h.result = natural ? 'push' : 'lose';
        h.payout = natural ? h.bet : 0;
      } else if (natural) {
        h.result = 'blackjack';
        h.payout = h.bet + h.bet * g.rules.bjPayout;
      } else if (v.bust) {
        h.result = 'lose';
        h.payout = 0;
      } else if (d.bust || v.total > d.total) {
        h.result = 'win';
        h.payout = h.bet * 2;
      } else if (v.total === d.total) {
        h.result = 'push';
        h.payout = h.bet;
      } else {
        h.result = 'lose';
        h.payout = 0;
      }
      h.done = true;
      returned += h.payout;
    }
    g.bankroll += returned;
    g.phase = 'done';
    const net = returned - wagered;
    g.lastRound = {
      id: g.roundId,
      wagered,
      returned,
      net,
      dealer: describeHand(g.dealer),
      hands: g.hands.map((h) => ({ desc: describeHand(h.cards), result: h.result, bet: h.bet })),
      rc: seenCount(g),
      cardsLeft: g.shoe.cards.length,
    };
    g.history.unshift(g.lastRound);
    if (g.history.length > 50) g.history.pop();
    return g;
  }

  // ---------- Basic strategy (multi-deck, late surrender, DAS by default) ----------
  // Codes: H hit, S stand, D double (else hit), Ds double (else stand), P split, R surrender
  function upVal(card) {
    return card.rank === 'A' ? 11 : cardPoints(card.rank);
  }

  function hardCode(t, u, h17) {
    if (t >= 17) return 'S';
    if (t >= 13) return u <= 6 ? 'S' : 'H';
    if (t === 12) return u >= 4 && u <= 6 ? 'S' : 'H';
    if (t === 11) return u === 11 ? (h17 ? 'D' : 'H') : 'D';
    if (t === 10) return u <= 9 ? 'D' : 'H';
    if (t === 9) return u >= 3 && u <= 6 ? 'D' : 'H';
    return 'H';
  }

  function softCode(t, u, h17) {
    if (t >= 20) return 'S';
    if (t === 19) return h17 && u === 6 ? 'Ds' : 'S';
    if (t === 18) {
      if (u === 2) return h17 ? 'Ds' : 'S';
      if (u <= 6) return 'Ds';
      if (u <= 8) return 'S';
      return 'H';
    }
    if (t === 17) return u >= 3 && u <= 6 ? 'D' : 'H';
    if (t === 16 || t === 15) return u >= 4 && u <= 6 ? 'D' : 'H';
    if (t <= 12) return 'H'; // A,A when splitting is not possible
    return u >= 5 && u <= 6 ? 'D' : 'H'; // 13, 14
  }

  function pairCode(p, u, das) {
    // p is the point value of one card (A = 11)
    if (p === 11 || p === 8) return 'P';
    if (p === 10) return 'S';
    if (p === 9) return u === 7 || u === 10 || u === 11 ? 'S' : 'P';
    if (p === 7) return u <= 7 ? 'P' : 'H';
    if (p === 6) return u <= 6 && (das || u >= 3) ? 'P' : 'H';
    if (p === 5) return null; // play as hard 10
    if (p === 4) return das && (u === 5 || u === 6) ? 'P' : null;
    if (p === 3 || p === 2) return u <= 7 && (das || u >= 4) ? 'P' : 'H';
    return null;
  }

  const ACTION_LABELS = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };
  const ACTION_TO_CODE = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };

  function basicStrategy(cards, upCard, opts) {
    opts = Object.assign({ canDouble: true, canSplit: true, canSurrender: false, hitSoft17: false, das: true }, opts || {});
    const u = upVal(upCard);
    const v = handValue(cards);
    const isPair = cards.length === 2 && canPair(cards[0], cards[1]);
    const p = isPair ? (cards[0].rank === 'A' ? 11 : cardPoints(cards[0].rank)) : 0;
    let kind = v.soft ? 'soft' : 'hard';
    let code = null;

    // Late surrender first
    if (opts.canSurrender && cards.length === 2 && !v.soft) {
      const t = v.total;
      const sur =
        (t === 16 && p !== 8 && (u === 9 || u === 10 || u === 11)) ||
        (t === 15 && u === 10) ||
        (opts.hitSoft17 && u === 11 && (t === 15 || t === 17 || (t === 16 && p === 8)));
      if (sur) {
        code = 'R';
        kind = 'surrender';
      }
    }
    if (!code && isPair && opts.canSplit) {
      const pc = pairCode(p, u, opts.das);
      if (pc === 'P') {
        code = 'P';
        kind = 'pair';
      }
    }
    if (!code) code = v.soft ? softCode(v.total, u, opts.hitSoft17) : hardCode(v.total, u, opts.hitSoft17);
    if (v.total >= 21) code = 'S';

    let action = code;
    if (code === 'D') action = opts.canDouble ? 'D' : 'H';
    if (code === 'Ds') action = opts.canDouble ? 'D' : 'S';
    const situation = (kind === 'pair' ? 'Pair of ' + (p === 11 ? 'aces' : p + 's') : kind === 'soft' ? 'Soft ' + v.total : 'Hard ' + v.total) + ' vs dealer ' + (u === 11 ? 'A' : u);
    return { code: action, label: ACTION_LABELS[action], situation, kind: isPair ? 'pair' : v.soft ? 'soft' : 'hard' };
  }

  Object.assign(CC, {
    DEFAULT_RULES,
    cardPoints,
    handValue,
    describeHand,
    dealerShouldHit,
    canPair,
    doubleAllowedForTotal,
    reshufflePoint,
    createGame,
    reshuffle,
    startRound,
    availableActions,
    hit,
    stand,
    double,
    split,
    surrender,
    seenCount,
    clearTable,
    basicStrategy,
    ACTION_LABELS,
    ACTION_TO_CODE,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
