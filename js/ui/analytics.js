(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, pageHead, tile, pct, secs, money, lineChart, barChart, go } = UI;

  function render(el) {
    const S = CC.store;
    const st = S.state;
    el.appendChild(pageHead('Progress', 'Analytics', 'Built only from answers you have given in this browser. Skill accuracy and table results are kept apart on purpose.'));

    if (!st.events.length && !st.tests.length && !st.table.rounds) {
      el.appendChild(h('div', { class: 'empty' }, 'No practice recorded yet. Answer a few questions in Learn, the Count Trainer or a test and your numbers will appear here.', h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn primary', onclick: () => go('count') }, 'Start a count drill'))));
      return;
    }

    const cats = Object.keys(S.CATS);
    const stats = Object.fromEntries(cats.map((c) => [c, S.stats(c)]));
    const all = st.events;
    const timed = all.filter((e) => e.ms != null);

    el.appendChild(
      h('div', { class: 'tiles', style: { marginBottom: '18px' } },
        tile('Answers recorded', all.length, timed.length + ' with a response time'),
        tile('Average response', secs(timed.length ? timed.reduce((s, e) => s + e.ms, 0) / timed.length : null), 'all timed answers'),
        tile('Learning streak', S.streak() + ' d', st.days.length + ' active day' + (st.days.length === 1 ? '' : 's') + ' in total'),
        tile('Tests taken', st.tests.length, st.tests.length ? 'avg ' + Math.round(st.tests.reduce((s, t) => s + t.pct, 0) / st.tests.length) + '%' : 'none yet')
      )
    );

    const color = (a) => (a == null ? 'var(--line-2)' : a >= 0.9 ? 'var(--good)' : a >= 0.75 ? 'var(--warn)' : 'var(--bad)');
    const accItems = cats.map((c) => ({ label: S.CATS[c], value: stats[c].acc, display: stats[c].n ? pct(stats[c].acc) + ' · ' + stats[c].n : 'no data', color: color(stats[c].acc) }));
    const errItems = cats.map((c) => ({ label: S.CATS[c], value: stats[c].errors, display: String(stats[c].errors), color: 'var(--bad)' }));
    const timeItems = cats.map((c) => ({ label: S.CATS[c], value: stats[c].avgMs != null ? stats[c].avgMs / 1000 : null, display: secs(stats[c].avgMs), color: 'var(--acc)' }));

    el.appendChild(
      h('div', { class: 'grid-2', style: { marginBottom: '18px' } },
        h('section', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Accuracy by skill'), barChart(accItems, { max: 1, label: 'Accuracy by skill' })),
        h('section', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Errors by category'), barChart(errItems, { label: 'Errors by category' }))
      )
    );

    // Running-count trend: rolling accuracy over the last 100 answers (window 10)
    const rcEv = stats.rc.events.slice(-100);
    const roll = [];
    for (let i = 9; i < rcEv.length; i++) {
      const w = rcEv.slice(i - 9, i + 1);
      roll.push({ y: (w.filter((e) => e.ok).length / 10) * 100, label: 'Answer ' + (i + 1) });
    }
    const testPts = st.tests.slice(-40).map((t) => ({ y: t.pct, label: t.name + ' (' + t.difficulty + '): ' + t.pct + '%', color: t.pct >= 90 ? '#63c890' : t.pct >= 70 ? '#e0b45c' : '#e2675e' }));
    el.appendChild(
      h('div', { class: 'grid-2', style: { marginBottom: '18px' } },
        h('section', { class: 'panel stack' }, h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Test results over time'), h('span', { class: 'small muted' }, 'last ' + testPts.length)), lineChart(testPts, { min: 0, max: 100, fmt: (v) => Math.round(v) + '%', empty: 'Take a test to start this chart.', id: 't', label: 'Test scores over time' })),
        h('section', { class: 'panel stack' }, h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Running count trend'), h('span', { class: 'small muted' }, 'rolling 10-answer accuracy')), lineChart(roll, { min: 0, max: 100, fmt: (v) => Math.round(v) + '%', empty: 'Needs at least 10 running-count answers.', id: 'r', label: 'Running count rolling accuracy' }))
      )
    );

    // Areas needing improvement + recommendations
    const weak = cats.filter((c) => stats[c].n >= 5 && stats[c].acc < 0.85).sort((a, b) => stats[a].acc - stats[b].acc);
    const recs = S.recommendations();
    const recBox = h('section', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Recommendations'));
    if (recs.length) recs.forEach((r) => recBox.appendChild(h('div', { class: 'rec' }, h('span', { class: 'sev' }), h('p', { class: 'small' }, r.text), h('button', { class: 'btn sm', onclick: () => go(r.go) }, 'Practise'))));
    else recBox.appendChild(h('p', { class: 'small muted' }, 'Nothing flagged in your recent answers. Recommendations need at least four to six answers in a skill before they say anything.'));
    const weakBox = h('section', { class: 'panel stack' }, h('div', { class: 'panel-title' }, 'Areas needing improvement'));
    if (weak.length) weak.forEach((c) => weakBox.appendChild(h('div', { class: 'row spread' }, h('span', null, S.CATS[c]), h('span', { class: 'pill ' + (stats[c].acc < 0.7 ? 'bad' : 'warn') }, pct(stats[c].acc) + ' of ' + stats[c].n))));
    else weakBox.appendChild(h('p', { class: 'small muted' }, 'No skill with five or more answers is below 85%.'));
    weakBox.appendChild(h('div', { class: 'panel-title', style: { marginTop: '8px' } }, 'Average response time'));
    weakBox.appendChild(barChart(timeItems, { label: 'Average response time by skill' }));
    el.appendChild(h('div', { class: 'grid-2', style: { marginBottom: '18px' } }, recBox, weakBox));

    // Test history
    if (st.tests.length) {
      const tb = h('tbody');
      st.tests.slice(-15).reverse().forEach((t) => tb.appendChild(h('tr', null, h('td', null, new Date(t.t).toLocaleDateString()), h('td', null, t.name), h('td', null, t.difficulty + (t.timed ? ' · timed' : '')), h('td', { class: 'mono' }, t.correct + '/' + t.n), h('td', { class: 'mono' }, t.pct + '%'), h('td', { class: 'mono' }, t.secs + ' s'))));
      el.appendChild(h('section', { class: 'panel stack', style: { marginBottom: '18px' } }, h('div', { class: 'panel-title' }, 'Recent tests'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Date', 'Test', 'Level', 'Score', '%', 'Time'].map((x) => h('th', null, x)))), tb))));
    }

    // Table results, separate from skill
    const tb = st.table;
    const curve = tb.curve.map((v, i) => ({ y: v, label: 'Round ' + i + ': ' + money(v) }));
    el.appendChild(
      h('section', { class: 'panel stack' },
        h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Simulated table results'), h('span', { class: 'pill' }, 'Not a skill measure')),
        h('div', { class: 'tiles' }, tile('Rounds', tb.rounds), tile('Net (virtual)', (tb.net >= 0 ? '+' : '−') + money(Math.abs(tb.net)), null, tb.net >= 0 ? 'good-t' : 'bad-t'), tile('Hands W / L / P', tb.wins + ' / ' + tb.losses + ' / ' + tb.pushes), tile('Bankroll', money(tb.bankroll))),
        curve.length > 1 ? lineChart(curve, { fmt: (v) => money(v), id: 'b', label: 'Virtual bankroll by round' }) : h('p', { class: 'small muted' }, 'Play rounds at the table to chart your virtual bankroll.'),
        h('p', { class: 'small muted' }, 'Winning a simulated hand is not proof of a good decision, and losing one is not proof of a bad one. Judge yourself on the accuracy numbers above.')
      )
    );
  }

  UI.register({ id: 'analytics', label: 'Analytics', icon: 'chart', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
