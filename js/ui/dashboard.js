(function (root) {
  const CC = root.CC;
  const { h, tile, pct, secs, pageHead, go, money } = CC.UI;

  const LOOP = [
    { t: 'Recognise card values', go: 'learn', cat: 'card' },
    { t: 'Keep the running count', go: 'count', cat: 'rc' },
    { t: 'Estimate decks remaining', go: 'truecount', cat: 'deck' },
    { t: 'Calculate the true count', go: 'truecount', cat: 'tc' },
    { t: 'Size the bet on a ramp', go: 'betting', cat: 'bet' },
    { t: 'Play the hand', go: 'table', cat: 'strategy' },
    { t: 'Review and improve', go: 'analytics', cat: null },
  ];

  function render(el) {
    const S = CC.store;
    const st = S.state;
    const lessonsDone = Object.keys(st.lessons).length;
    const total = CC.LESSONS ? CC.LESSONS.length : 10;
    const rc = S.stats('rc');
    const tc = S.stats('tc');
    const all = st.events.filter((e) => e.ms != null);
    const avg = all.length ? all.reduce((s, e) => s + e.ms, 0) / all.length : null;
    const streak = S.streak();

    el.appendChild(
      pageHead(
        'Hi-Lo training',
        'Count Room',
        'Practise the full counting loop with virtual chips: card values, running count, decks remaining, true count, bet sizing, then the hand itself.',
        h('div', { class: 'row' }, h('button', { class: 'btn primary lg', onclick: () => go(nextStep().go) }, 'Continue: ' + nextStep().label))
      )
    );

    el.appendChild(
      h('div', { class: 'tiles', style: { marginBottom: '22px' } },
        tile('Lessons', lessonsDone + ' / ' + total, lessonsDone === total ? 'Curriculum complete' : total - lessonsDone + ' to go'),
        tile('Running count', pct(rc.acc), rc.n ? rc.n + ' answers' : 'No answers yet'),
        tile('True count', pct(tc.acc), tc.n ? tc.n + ' answers' : 'No answers yet'),
        tile('Avg response', secs(avg), all.length ? 'across ' + all.length + ' timed answers' : 'Not measured yet'),
        tile('Streak', streak + (streak === 1 ? ' day' : ' days'), streak ? 'Practise today to extend it' : 'Practise today to start one')
      )
    );

    const loop = h('div', { class: 'loop' });
    LOOP.forEach((s, i) => {
      const stat = s.cat ? S.stats(s.cat) : null;
      loop.appendChild(
        h('a', { href: '#' + s.go, onclick: (e) => { e.preventDefault(); go(s.go); } },
          h('span', { class: 'n' }, 'Step ' + (i + 1)),
          h('span', { class: 't' }, s.t),
          h('span', { class: 's' }, stat ? (stat.n ? pct(stat.acc) + ' over ' + stat.n : 'Not started') : st.tests.length + ' tests taken')
        )
      );
    });
    el.appendChild(h('section', { class: 'stack', style: { marginBottom: '22px' } }, h('div', { class: 'panel-title' }, 'The learning loop'), loop));

    const recs = S.recommendations();
    const recPanel = h('section', { class: 'panel stack' }, h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'What to work on'), h('button', { class: 'btn sm ghost', onclick: () => go('analytics') }, 'Analytics')));
    if (recs.length) recs.slice(0, 3).forEach((r) => recPanel.appendChild(h('div', { class: 'rec' }, h('span', { class: 'sev' }), h('p', { class: 'small' }, r.text), h('button', { class: 'btn sm', onclick: () => go(r.go) }, 'Practise'))));
    else recPanel.appendChild(h('div', { class: 'empty' }, st.events.length < 8 ? 'Recommendations appear once you have answered a few drills. Start with the Hi-Lo lesson or a beginner count drill.' : 'No weak spots in your recent answers. Raise the difficulty or take a timed test.'));

    const recent = h('section', { class: 'panel stack' }, h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Recent tests'), h('button', { class: 'btn sm ghost', onclick: () => go('tests') }, 'All tests')));
    const tests = st.tests.slice(-5).reverse();
    if (tests.length)
      tests.forEach((t) =>
        recent.appendChild(
          h('div', { class: 'row spread small', style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } },
            h('span', null, h('b', null, t.name), ' ', h('span', { class: 'muted' }, t.difficulty)),
            h('span', { class: 'pill ' + (t.pct >= 90 ? 'good' : t.pct >= 70 ? 'warn' : 'bad') }, t.pct + '%')
          )
        )
      );
    else recent.appendChild(h('div', { class: 'empty' }, 'No tests yet. Tests give you a scored, timed check on each skill.'));

    const tb = st.table;
    const table = h('section', { class: 'panel stack' },
      h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, 'Practice table'), h('button', { class: 'btn sm ghost', onclick: () => go('table') }, 'Open table')),
      h('div', { class: 'row spread' }, h('span', { class: 'muted small' }, 'Virtual bankroll'), h('b', { class: 'mono' }, money(tb.bankroll))),
      h('div', { class: 'row spread' }, h('span', { class: 'muted small' }, 'Rounds played'), h('b', { class: 'mono' }, tb.rounds)),
      h('p', { class: 'small muted' }, 'Table results are tracked apart from skill accuracy. A winning session can still contain counting mistakes.')
    );
    el.appendChild(h('div', { class: 'grid-3' }, recPanel, recent, table));
  }

  function nextStep() {
    const S = CC.store;
    const st = S.state;
    if (CC.LESSONS) {
      const next = CC.LESSONS.find((l) => !st.lessons[l.id]);
      if (next && Object.keys(st.lessons).length < 3) return { go: 'learn', label: next.title };
    }
    const recs = S.recommendations();
    if (recs.length) return { go: recs[0].go, label: CC.store.CATS[recs[0].cat] || 'Practice' };
    const rc = S.stats('rc');
    if (rc.n < 10) return { go: 'count', label: 'Count drill' };
    const tc = S.stats('tc');
    if (tc.n < 10) return { go: 'truecount', label: 'True count' };
    return { go: 'table', label: 'Play a shoe' };
  }

  CC.UI.register({ id: 'dashboard', label: 'Dashboard', icon: 'home', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
