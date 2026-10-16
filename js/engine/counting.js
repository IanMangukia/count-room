// Counting engine: cards, shoes, Hi-Lo values, running count, deck estimates, true count.
(function (root) {
  const CC = (root.CC = root.CC || {});

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const CARDS_PER_DECK = 52;

  // Deterministic seeded RNG (mulberry32) so tests and examples are repeatable.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hiLo(rank) {
    if (rank === '2' || rank === '3' || rank === '4' || rank === '5' || rank === '6') return 1;
    if (rank === '7' || rank === '8' || rank === '9') return 0;
    if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A') return -1;
    throw new Error('Unknown rank: ' + rank);
  }

  let uid = 0;
  function makeCard(rank, suit) {
    if (!RANKS.includes(rank)) throw new Error('Unknown rank: ' + rank);
    return { rank, suit: suit || SUITS[0], id: 'c' + ++uid };
  }

  function isRed(card) {
    return card.suit === '♥' || card.suit === '♦';
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function createShoe(decks, rng) {
    if (!(decks >= 1)) throw new Error('A shoe needs at least one deck');
    const cards = [];
    for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push(makeCard(r, s));
    shuffle(cards, rng || Math.random);
    return { decks, total: cards.length, cards, dealt: 0 };
  }

  function drawCard(shoe) {
    if (!shoe.cards.length) throw new Error('Shoe is empty');
    shoe.dealt++;
    return shoe.cards.pop();
  }

  // n random cards drawn without replacement from a fresh multi-deck shoe.
  function randomCards(n, rng, decks) {
    const shoe = createShoe(decks || Math.max(6, Math.ceil(n / 52) + 1), rng);
    const out = [];
    for (let i = 0; i < n; i++) out.push(drawCard(shoe));
    return out;
  }

  function runningCount(cards) {
    let rc = 0;
    for (const c of cards) rc += hiLo(c.rank);
    return rc;
  }

  // Cumulative count after each card, useful for breakdowns.
  function countTrail(cards) {
    let rc = 0;
    return cards.map((c) => {
      const v = hiLo(c.rank);
      rc += v;
      return { card: c, value: v, rc };
    });
  }

  function decksRemaining(cardsLeft) {
    return cardsLeft / CARDS_PER_DECK;
  }

  // Practical estimate to the nearest step (half deck by default), never below one step.
  function estimateDecks(cardsLeft, step) {
    step = step || 0.5;
    const est = Math.round(cardsLeft / CARDS_PER_DECK / step) * step;
    return Math.max(step, est);
  }

  const CONVENTIONS = {
    truncate: 'Truncate (drop the fraction, toward zero)',
    floor: 'Floor (always round down)',
    round: 'Round to nearest',
    exact: 'Exact (one decimal)',
  };

  function applyConvention(x, conv) {
    let v;
    switch (conv) {
      case 'floor':
        v = Math.floor(x + 1e-9);
        break;
      case 'round':
        v = Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
        break;
      case 'exact':
        v = Math.round(x * 10) / 10;
        break;
      case 'truncate':
      default:
        v = Math.trunc(x + (x >= 0 ? 1e-9 : -1e-9));
    }
    return v === 0 ? 0 : v; // normalise -0
  }

  function trueCount(rc, decks, conv) {
    if (!(decks > 0)) throw new Error('Decks remaining must be positive');
    return applyConvention(rc / decks, conv || 'truncate');
  }

  function fmtSigned(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    const v = n === 0 ? 0 : n;
    return (v > 0 ? '+' : '') + (Number.isInteger(v) ? v : v.toFixed(1));
  }

  Object.assign(CC, {
    RANKS,
    SUITS,
    CARDS_PER_DECK,
    CONVENTIONS,
    mulberry32,
    hiLo,
    makeCard,
    isRed,
    shuffle,
    createShoe,
    drawCard,
    randomCards,
    runningCount,
    countTrail,
    decksRemaining,
    estimateDecks,
    applyConvention,
    trueCount,
    fmtSigned,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
