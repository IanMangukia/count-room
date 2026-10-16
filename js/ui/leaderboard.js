(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, seg, toggle, pageHead, toast } = UI;
  const L = { test: 'rc', diff: 'beginner', timed: false };

  function nameValid(n) {
    return /^[A-Za-z0-9 _.-]{2,20}$/.test(n.trim());
  }

  function render(el) {
    const settings = CC.store.state.settings;
    el.appendChild(pageHead('Community', 'Leaderboard', 'Best test scores from everyone using this deployment. Ranked by score, then by time.'));

    const status = h('div');
    const board = h('div', { class: 'panel stack' });
    const nameIn = h('input', { id: 'lb-name', class: 'input', maxlength: 20, placeholder: 'Pick a name (2 to 20 characters)', value: settings.displayName || '', style: { fontFamily: 'var(--body)' } });
    const saveName = h('button', { class: 'btn', onclick: () => {
      const v = nameIn.value.trim();
      if (v && !nameValid(v)) return toast('Use 2 to 20 letters, numbers, spaces, dots, dashes or underscores.', 'bad');
      settings.displayName = v;
      CC.store.save();
      toast(v ? 'Name saved. Your next test results will be posted.' : 'Name cleared. Results stay private.');
    } }, 'Save name');

    el.appendChild(
      h('div', { class: 'split' },
        h('div', { class: 'stack' },
          h('div', { class: 'row spread' },
            seg(CC.TESTS.map((t) => ({ value: t.id, label: t.name })), L.test, (v) => { L.test = v; load(); }, { label: 'Test' })
          ),
          h('div', { class: 'row spread' },
            seg(CC.DIFFICULTIES.map((d) => ({ value: d, label: CC.DIFF[d].label })), L.diff, (v) => { L.diff = v; load(); }, { label: 'Difficulty' }),
            toggle('Timed', L.timed, (v) => { L.timed = v; load(); }, 'lb-timed')
          ),
          board
        ),
        h('aside', { class: 'panel stack' },
          h('div', { class: 'panel-title' }, 'Your leaderboard name'),
          h('p', { class: 'small muted' }, 'Results are posted only after you choose a name. Without one, everything stays private.'),
          nameIn,
          saveName,
          h('hr', { class: 'hr' }),
          status
        )
      )
    );

    function drawStatus() {
      const c = CC.cloud;
      status.innerHTML = '';
      const pill = c.status === 'ready' ? h('span', { class: 'pill good' }, 'Connected') : c.status === 'connecting' ? h('span', { class: 'pill' }, 'Connecting…') : h('span', { class: 'pill warn' }, 'Offline');
      status.append(h('div', { class: 'row spread' }, h('span', { class: 'panel-title' }, 'Cloud'), pill), h('p', { class: 'small muted' }, c.status === 'ready' ? (c.isAnon() ? 'Saving to an anonymous cloud account for this browser.' : 'Signed in as ' + c.email() + '.') : c.message || 'Waiting for the cloud connection.'));
    }

    let seq = 0;
    async function load() {
      const my = ++seq;
      board.innerHTML = '';
      const t = CC.TESTS.find((x) => x.id === L.test);
      board.appendChild(h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, t.name + ' · ' + CC.DIFF[L.diff].label + (L.timed ? ' · timed' : '')), h('button', { class: 'btn sm ghost', onclick: load }, 'Refresh')));
      if (CC.cloud.status !== 'ready') {
        board.appendChild(h('div', { class: 'empty' }, CC.cloud.status === 'connecting' ? 'Connecting to the leaderboard…' : 'The leaderboard needs the cloud connection. ' + (CC.cloud.message || '')));
        return;
      }
      const loading = h('p', { class: 'small muted' }, 'Loading…');
      board.appendChild(loading);
      try {
        const rows = await CC.cloud.leaderboard(L.test, L.diff, L.timed);
        if (my !== seq) return;
        loading.remove();
        if (!rows.length) {
          board.appendChild(h('div', { class: 'empty' }, 'No scores yet for this test and level. Finish it with a leaderboard name set to post the first one.'));
          return;
        }
        const me = CC.cloud.user && CC.cloud.user.id;
        const tb = h('tbody');
        rows.forEach((r, i) =>
          tb.appendChild(
            h('tr', { class: r.user_id === me ? 'hit' : '' },
              h('td', { class: 'mono' }, String(i + 1)),
              h('td', null, r.display_name, r.user_id === me ? h('span', { class: 'muted small' }, ' (you)') : null),
              h('td', { class: 'mono' }, r.pct + '%'),
              h('td', { class: 'mono' }, r.correct + '/' + r.n),
              h('td', { class: 'mono' }, r.secs + ' s'),
              h('td', { class: 'small muted' }, new Date(r.created_at).toLocaleDateString())
            )
          )
        );
        board.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['#', 'Name', 'Score', 'Correct', 'Time', 'Date'].map((x) => h('th', null, x)))), tb)));
      } catch (e) {
        if (my !== seq) return;
        loading.textContent = 'Could not load the leaderboard: ' + e.message;
      }
    }

    drawStatus();
    load();
    let prev = CC.cloud.status;
    const off = CC.cloud.on(() => {
      drawStatus();
      if (CC.cloud.status === 'ready' && prev !== 'ready') load();
      prev = CC.cloud.status;
    });
    return off;
  }

  UI.register({ id: 'leaderboard', label: 'Leaderboard', icon: 'trophy', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
