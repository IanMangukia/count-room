// Local progress store: settings, practice events, test history, table results. Browser storage when available.
(function (root) {
  const CC = (root.CC = root.CC || {});
  const KEY = 'countroom.v1';
  const CATS = {
    card: 'Card recognition',
    rc: 'Running count',
    tc: 'True count',
    deck: 'Deck estimation',
    bet: 'Betting decisions',
    strategy: 'Basic strategy',
  };

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function freshSettings() {
    return {
      conv: 'truncate',
      hints: 'auto',
      displayName: '',
      motion: 'system',
      tableMode: 'training',
      showCount: true,
      coachStrategy: true,
      rules: clone(CC.DEFAULT_RULES),
      betting: clone(CC.DEFAULT_BETTING),
    };
  }

  function fresh() {
    return {
      v: 1,
      settings: freshSettings(),
      lessons: {},
      events: [],
      tests: [],
      bests: {},
      table: { bankroll: 10000, rounds: 0, net: 0, wins: 0, losses: 0, pushes: 0, curve: [10000] },
      days: [],
    };
  }

  let state = null;
  let storageOk = true;

  function normalize(p) {
    const st = Object.assign(fresh(), p);
    st.settings = Object.assign(freshSettings(), p.settings || {});
    st.settings.rules = Object.assign(clone(CC.DEFAULT_RULES), (p.settings && p.settings.rules) || {});
    st.settings.betting = Object.assign(clone(CC.DEFAULT_BETTING), (p.settings && p.settings.betting) || {});
    st.table = Object.assign(fresh().table, p.table || {});
    return st;
  }

  function load() {
    state = fresh();
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) state = normalize(JSON.parse(raw));
    } catch (e) {
      storageOk = false;
    }
    return state;
  }

  // Swap in progress pulled from the cloud.
  function replace(p) {
    state = normalize(p);
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    return state;
  }

  // True when this browser has no practice history worth keeping.
  function isEmpty() {
    return !state.events.length && !state.tests.length && !Object.keys(state.lessons).length && !state.table.rounds;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    state.savedAt = Date.now();
    saveTimer = setTimeout(() => {
      if (CC.store.onSave) {
        try { CC.store.onSave(); } catch (e) {}
      }
      try {
        root.localStorage.setItem(KEY, JSON.stringify(state));
        storageOk = true;
      } catch (e) {
        storageOk = false;
      }
    }, 120);
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function markDay() {
    const t = today();
    if (!state.days.includes(t)) state.days.push(t);
  }

  function record(cat, ok, ms, extra) {
    state.events.push(Object.assign({ t: Date.now(), cat, ok: !!ok, ms: ms != null ? Math.round(ms) : null }, extra || {}));
    if (state.events.length > 4000) state.events.splice(0, state.events.length - 4000);
    markDay();
    save();
  }

  function stats(cat, opts) {
    opts = opts || {};
    let ev = state.events.filter((e) => e.cat === cat);
    if (opts.last) ev = ev.slice(-opts.last);
    const n = ev.length;
    const ok = ev.filter((e) => e.ok).length;
    const timed = ev.filter((e) => e.ms != null);
    return {
      n,
      ok,
      acc: n ? ok / n : null,
      avgMs: timed.length ? timed.reduce((s, e) => s + e.ms, 0) / timed.length : null,
      errors: n - ok,
      events: ev,
    };
  }

  // 2 = full hints, 1 = hints on request, 0 = no hints. Based on the last 20 counting answers.
  function hintLevel() {
    const mode = state.settings.hints;
    if (mode === 'always') return 2;
    if (mode === 'never') return 0;
    const ev = state.events.filter((e) => e.cat === 'card' || e.cat === 'rc').slice(-20);
    if (ev.length < 8) return 2;
    const acc = ev.filter((e) => e.ok).length / ev.length;
    if (acc >= 0.9) return 0;
    if (acc >= 0.7) return 1;
    return 2;
  }

  function streak() {
    const set = new Set(state.days);
    let n = 0;
    const d = new Date();
    if (!set.has(today())) d.setDate(d.getDate() - 1); // streak still alive if you practised yesterday
    for (;;) {
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!set.has(k)) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function recordTest(result) {
    state.tests.push(result);
    const prev = state.bests[result.key];
    let isBest = false;
    if (!prev || result.pct > prev.pct || (result.pct === prev.pct && result.secs < prev.secs)) {
      state.bests[result.key] = { pct: result.pct, secs: result.secs, t: result.t };
      isBest = true;
    }
    markDay();
    save();
    return { isBest, prev };
  }

  // Recommendations computed from actual mistakes.
  function recommendations() {
    const out = [];
    const f = CC.fmtSigned;
    const rc = stats('rc', { last: 40 });
    if (rc.n >= 4 && rc.acc < 0.85) {
      const wrong = rc.events.filter((e) => !e.ok && e.given != null && e.answer != null);
      const avgErr = wrong.length ? wrong.reduce((s, e) => s + Math.abs(e.given - e.answer), 0) / wrong.length : null;
      const fast = rc.events.filter((e) => !e.ok && e.speed != null && e.speed < 0.7).length;
      let msg = 'Running count accuracy is ' + Math.round(rc.acc * 100) + '% over your last ' + rc.n + ' answers';
      if (avgErr != null) msg += ', and misses are off by ' + avgErr.toFixed(1) + ' on average';
      msg += '. ';
      msg += fast > wrong.length / 2 ? 'Most misses came at fast speeds: slow the dealer down until you hit 90%, then speed up.' : 'Drop one difficulty level and practise cancelling pairs (a low card and a high card together are 0).';
      out.push({ cat: 'rc', text: msg, go: 'count' });
    }
    const card = stats('card', { last: 40 });
    if (card.n >= 6 && card.acc < 0.95) {
      const miss = {};
      card.events.filter((e) => !e.ok && e.rank).forEach((e) => (miss[e.rank] = (miss[e.rank] || 0) + 1));
      const worst = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
      out.push({ cat: 'card', text: 'Card values should be automatic before counting speed matters. ' + (worst.length ? 'You missed ' + worst.join(', ') + ' most often. ' : '') + 'Re-run the Hi-Lo lesson and the Card values test.', go: 'learn' });
    }
    const tc = stats('tc', { last: 40 });
    if (tc.n >= 4 && tc.acc < 0.85) {
      const wrong = tc.events.filter((e) => !e.ok && e.raw != null && e.given != null);
      const rounded = wrong.filter((e) => e.given === Math.sign(e.raw) * Math.round(Math.abs(e.raw)) && e.given !== e.answer).length;
      const noDivide = wrong.filter((e) => e.rc != null && e.given === e.rc).length;
      let msg = 'True count accuracy is ' + Math.round(tc.acc * 100) + '%. ';
      if (noDivide) msg += noDivide + ' miss' + (noDivide > 1 ? 'es' : '') + ' gave the running count as the true count; always divide by decks remaining. ';
      if (rounded) msg += rounded + ' miss' + (rounded > 1 ? 'es' : '') + ' rounded to the nearest number instead of using your ' + state.settings.conv + ' setting. ';
      if (!noDivide && !rounded) msg += 'Practise the division with half-deck values (dividing by 2.5 is the same as multiplying by 0.4).';
      out.push({ cat: 'tc', text: msg.trim(), go: 'truecount' });
    }
    const deck = stats('deck', { last: 30 });
    if (deck.n >= 4 && deck.acc < 0.8) {
      const signed = deck.events.filter((e) => e.given != null && e.exact != null);
      const bias = signed.length ? signed.reduce((s, e) => s + (e.given - e.exact), 0) / signed.length : 0;
      out.push({ cat: 'deck', text: 'Deck estimates are ' + Math.round(deck.acc * 100) + '% accurate. ' + (Math.abs(bias) >= 0.25 ? 'You tend to ' + (bias > 0 ? 'overestimate' : 'underestimate') + ' decks remaining by about ' + Math.abs(bias).toFixed(1) + ', which makes your true counts too ' + (bias > 0 ? 'small' : 'large') + '.' : 'Turn on deck markers in the tray drill until estimates settle.'), go: 'truecount' });
    }
    const bet = stats('bet', { last: 30 });
    if (bet.n >= 4 && bet.acc < 0.8) {
      const wrong = bet.events.filter((e) => !e.ok && e.given != null && e.answer != null);
      const over = wrong.filter((e) => e.given > e.answer).length;
      out.push({ cat: 'bet', text: 'Betting decisions match your ramp ' + Math.round(bet.acc * 100) + '% of the time. ' + (wrong.length ? (over >= wrong.length / 2 ? 'You usually bet more than the ramp suggests.' : 'You usually bet less than the ramp suggests.') : '') + ' Keep the ramp table visible in the Betting Coach while you practise.', go: 'betting' });
    }
    const st = stats('strategy', { last: 40 });
    if (st.n >= 6 && st.acc < 0.9) {
      const kinds = {};
      st.events.filter((e) => !e.ok && e.kind).forEach((e) => (kinds[e.kind] = (kinds[e.kind] || 0) + 1));
      const worst = Object.entries(kinds).sort((a, b) => b[1] - a[1])[0];
      out.push({ cat: 'strategy', text: 'Basic strategy accuracy is ' + Math.round(st.acc * 100) + '%. ' + (worst ? 'Most misses were ' + worst[0] + ' hands. ' : '') + 'Play training-mode rounds with strategy coaching on.', go: 'learn' });
    }
    const slow = stats('rc', { last: 20 });
    if (slow.n >= 5 && slow.acc >= 0.85 && slow.avgMs > 6000) out.push({ cat: 'rc', text: 'Your counts are accurate but answers take ' + (slow.avgMs / 1000).toFixed(1) + ' s on average. Turn on the answer time limit to build speed.', go: 'count' });
    return out;
  }

  function reset() {
    state = fresh();
    save();
    return state;
  }

  CC.store = {
    KEY,
    CATS,
    load,
    save,
    replace,
    isEmpty,
    record,
    stats,
    hintLevel,
    streak,
    recordTest,
    recommendations,
    reset,
    get state() {
      return state;
    },
    get storageOk() {
      return storageOk;
    },
    today,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
