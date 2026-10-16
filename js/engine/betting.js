// Betting logic: configurable true-count ramp, suggested bets, validation, exposure. Virtual chips only.
(function (root) {
  const CC = (root.CC = root.CC || {});

  const PRESET_RAMP = [
    { tc: 1, units: 1 },
    { tc: 2, units: 2 },
    { tc: 3, units: 4 },
    { tc: 4, units: 6 },
  ];

  const DEFAULT_BETTING = { bankroll: 10000, minBet: 10, maxBet: 300, unit: 25, ramp: PRESET_RAMP.map((r) => Object.assign({}, r)) };

  function sortRamp(ramp) {
    return ramp.slice().sort((a, b) => a.tc - b.tc);
  }

  // Index of the ramp row that applies. Row 0 also covers every count below it; the last row covers every count above it.
  function rampIndex(tc, ramp) {
    const r = sortRamp(ramp);
    let idx = 0;
    for (let i = 0; i < r.length; i++) if (tc >= r[i].tc) idx = i;
    return idx;
  }

  function rampUnits(tc, ramp) {
    return sortRamp(ramp)[rampIndex(tc, ramp)].units;
  }

  function rangeLabel(i, ramp) {
    const r = sortRamp(ramp);
    const f = CC.fmtSigned;
    if (r.length === 1) return 'Any true count';
    if (i === 0) return 'TC ' + f(r[1].tc - 1) + ' or below';
    if (i === r.length - 1) return 'TC ' + f(r[i].tc) + ' or above';
    const hi = r[i + 1].tc - 1;
    return hi === r[i].tc ? 'TC ' + f(r[i].tc) : 'TC ' + f(r[i].tc) + ' to ' + f(hi);
  }

  // Betting decisions use a whole-number true count; fractional counts are floored.
  function bettingTC(tc) {
    const v = Math.floor(tc + 1e-9);
    return v === 0 ? 0 : v;
  }

  function suggestedBet(tc, cfg) {
    const t = bettingTC(tc);
    const idx = rampIndex(t, cfg.ramp);
    const units = sortRamp(cfg.ramp)[idx].units;
    const raw = units * cfg.unit;
    let bet = Math.min(Math.max(raw, cfg.minBet), cfg.maxBet);
    let note = '';
    if (bet !== raw) note = raw < cfg.minBet ? 'Raised to the table minimum.' : 'Capped at the table maximum.';
    if (cfg.bankroll != null && bet > cfg.bankroll) {
      bet = cfg.bankroll >= cfg.minBet ? Math.floor(cfg.bankroll) : 0;
      note = 'Limited by available bankroll.';
    }
    return { tc: t, index: idx, units, raw, bet, note, range: rangeLabel(idx, cfg.ramp) };
  }

  function validateBet(bet, cfg, bankroll) {
    const errors = [];
    const b = Number(bet);
    if (bet === '' || bet == null || !Number.isFinite(b)) errors.push('Enter a bet amount.');
    else {
      if (!Number.isInteger(b)) errors.push('Use whole chip amounts.');
      if (b <= 0) errors.push('A bet must be greater than zero.');
      if (b < cfg.minBet) errors.push('Below the table minimum of ' + cfg.minBet + '.');
      if (b > cfg.maxBet) errors.push('Above the table maximum of ' + cfg.maxBet + '.');
      const br = bankroll != null ? bankroll : cfg.bankroll;
      if (b > br) errors.push('More than your virtual bankroll of ' + br + '.');
    }
    return { ok: errors.length === 0, errors, value: b };
  }

  function validateConfig(cfg) {
    const errors = [];
    if (!(cfg.bankroll > 0)) errors.push('Bankroll must be positive.');
    if (!(cfg.minBet > 0)) errors.push('Minimum bet must be positive.');
    if (!(cfg.maxBet >= cfg.minBet)) errors.push('Maximum bet must be at least the minimum.');
    if (!(cfg.unit > 0)) errors.push('Unit size must be positive.');
    if (!cfg.ramp || !cfg.ramp.length) errors.push('The ramp needs at least one row.');
    else {
      const seen = new Set();
      for (const r of cfg.ramp) {
        if (!Number.isInteger(r.tc)) errors.push('Ramp true counts must be whole numbers.');
        if (!(Number.isInteger(r.units) && r.units > 0)) errors.push('Ramp units must be whole numbers above zero.');
        if (seen.has(r.tc)) errors.push('Each true count can appear only once (TC ' + r.tc + ').');
        seen.add(r.tc);
      }
    }
    return [...new Set(errors)];
  }

  function spread(cfg) {
    const u = cfg.ramp.map((r) => r.units);
    const lo = Math.max(cfg.minBet, Math.min(...u) * cfg.unit);
    const hi = Math.min(cfg.maxBet, Math.max(...u) * cfg.unit);
    return { low: lo, high: hi, ratio: hi / lo };
  }

  function exposure(bet, bankroll) {
    return bankroll > 0 ? bet / bankroll : 0;
  }

  Object.assign(CC, { PRESET_RAMP, DEFAULT_BETTING, sortRamp, rampIndex, rampUnits, rangeLabel, bettingTC, suggestedBet, validateBet, validateConfig, spread, exposure });
})(typeof globalThis !== 'undefined' ? globalThis : this);
