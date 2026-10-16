(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, seg, toggle, pageHead, modal, toast, field } = UI;

  function render(el) {
    let cleanup = null;
    const S = CC.store;
    const s = S.state.settings;
    const r = s.rules;
    const save = (msg) => { S.save(); if (msg) toast(msg); };
    el.appendChild(pageHead('Preferences', 'Settings', 'Changes save automatically in this browser.'));

    const pen = h('span', { class: 'mono acc-t' }, Math.round(r.penetration * 100) + '%');
    const penSlider = h('input', { id: 'st-pen', type: 'range', class: 'range', min: 50, max: 90, step: 5, value: Math.round(r.penetration * 100), oninput: (e) => { r.penetration = +e.target.value / 100; pen.textContent = e.target.value + '%'; penNote.textContent = penText(); save(); } });
    const penText = () => 'Reshuffle when ' + CC.reshufflePoint(r) + ' of ' + r.decks * 52 + ' cards remain.';
    const penNote = h('p', { class: 'small muted' }, penText());
    const ruleSeg = (key, opts, msg) => seg(opts, r[key], (v) => { r[key] = v; penNote.textContent = penText(); save(msg || 'Rule saved. It applies from the next round.'); });

    el.appendChild(
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel stack' },
          h('div', { class: 'panel-title' }, 'Counting'),
          field('True count convention', seg([{ value: 'truncate', label: 'Truncate' }, { value: 'floor', label: 'Floor' }, { value: 'round', label: 'Round' }, { value: 'exact', label: 'Exact' }], s.conv, (v) => { s.conv = v; save('Convention saved.'); })),
          h('p', { class: 'small muted' }, 'Used by every trainer, test and the table. Betting always floors fractional counts.'),
          field('Hints', seg([{ value: 'auto', label: 'Fade as I improve' }, { value: 'always', label: 'Always show' }, { value: 'never', label: 'Never show' }], s.hints, (v) => { s.hints = v; save('Hint setting saved.'); })),
          h('p', { class: 'small muted' }, 'Current hint level: ' + ['none', 'on request', 'full'][S.hintLevel()] + '. In auto mode hints fade once your last 20 counting answers are 70% and then 90% correct.'),
          h('hr', { class: 'hr' }),
          h('div', { class: 'panel-title' }, 'Motion'),
          field('Animations', seg([{ value: 'system', label: 'Follow system' }, { value: 'reduce', label: 'Reduced' }, { value: 'full', label: 'Full' }], s.motion, (v) => { s.motion = v; UI.applyMotion(); save('Motion setting saved.'); }))
        ),
        h('section', { class: 'panel stack' },
          h('div', { class: 'panel-title' }, 'Table rules'),
          field('Decks in the shoe', ruleSeg('decks', [1, 2, 4, 6, 8].map((n) => ({ value: n, label: String(n) })))),
          field('Dealer on soft 17', ruleSeg('hitSoft17', [{ value: false, label: 'Stands (S17)' }, { value: true, label: 'Hits (H17)' }])),
          field('Blackjack pays', ruleSeg('bjPayout', [{ value: 1.5, label: '3 to 2' }, { value: 1.2, label: '6 to 5' }])),
          field('Doubling allowed on', ruleSeg('doubleOn', [{ value: 'any', label: 'Any two cards' }, { value: '9-11', label: '9 to 11' }, { value: '10-11', label: '10 or 11' }])),
          h('div', { class: 'row', style: { gap: '22px' } },
            toggle('Double after split', r.das, (v) => { r.das = v; save('Rule saved. It applies from the next round.'); }, 'st-das'),
            toggle('Late surrender', r.surrender, (v) => { r.surrender = v; save('Rule saved. It applies from the next round.'); }, 'st-sur')
          ),
          h('div', { class: 'field' }, h('div', { class: 'row spread' }, h('label', { for: 'st-pen' }, 'Penetration'), pen), penSlider, penNote),
          h('hr', { class: 'hr' }),
          h('div', { class: 'panel-title' }, 'Table assistance'),
          field('Mode', seg([{ value: 'training', label: 'Training' }, { value: 'challenge', label: 'Challenge' }], s.tableMode, (v) => { s.tableMode = v; save(); })),
          toggle('Show count in training mode', s.showCount, (v) => { s.showCount = v; save(); }, 'st-show'),
          toggle('Coach basic-strategy mistakes in training mode', s.coachStrategy, (v) => { s.coachStrategy = v; save(); }, 'st-coach')
        )
      )
    );

    if (CC.cloud) {
      const acct = h('section', { class: 'panel stack', style: { marginTop: '18px' } });
      const drawAcct = () => {
        const c = CC.cloud;
        acct.innerHTML = '';
        acct.appendChild(h('div', { class: 'panel-title' }, 'Cloud account'));
        if (c.status !== 'ready') {
          acct.appendChild(h('p', { class: 'small muted' }, c.status === 'connecting' ? 'Connecting…' : c.message || 'The cloud is not connected, so progress stays in this browser.'));
          return;
        }
        const last = c.lastSync ? 'Last synced ' + new Date(c.lastSync).toLocaleTimeString() + '.' : '';
        if (c.isAnon()) {
          acct.append(
            h('p', { class: 'small muted' }, 'Progress is backed up to an anonymous account tied to this browser. Sign in with Google to keep it if you clear the browser or switch devices. ' + last),
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { try { await c.signInWithGoogle(); } catch (e) { toast('Google sign-in failed: ' + e.message, 'bad', 5000); } } }, 'Sign in with Google'), h('button', { class: 'btn', onclick: async () => { await c.push(); toast('Synced.'); } }, 'Sync now'))
          );
        } else {
          acct.append(
            h('p', { class: 'small muted' }, 'Signed in as ' + c.email() + '. Progress syncs across devices. ' + last),
            h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { await c.push(); toast('Synced.'); } }, 'Sync now'), h('button', { class: 'btn ghost', onclick: async () => { await c.signOut(); toast('Signed out. This browser keeps a local copy.'); } }, 'Sign out'))
          );
        }
      };
      drawAcct();
      el.appendChild(acct);
      cleanup = CC.cloud.on(drawAcct);
    }

    const exportBox = h('textarea', { id: 'st-export', class: 'input', rows: 5, readonly: true, style: { fontSize: '.75rem', display: 'none', resize: 'vertical' } });
    el.appendChild(
      h('section', { class: 'panel stack', style: { marginTop: '18px' } },
        h('div', { class: 'panel-title' }, 'Your data'),
        h('p', { class: 'small muted' }, S.storageOk ? 'Progress is stored locally in this browser only. Nothing is sent anywhere.' : 'This browser is blocking local storage, so progress lasts only until you close the page.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: async () => {
            const json = JSON.stringify(S.state);
            exportBox.style.display = 'block';
            exportBox.value = json;
            try { await navigator.clipboard.writeText(json); toast('Progress copied to the clipboard.', 'good'); } catch (e) { exportBox.select(); toast('Copy blocked here. The text is selected below; copy it manually.'); }
          } }, 'Copy progress as JSON'),
          h('button', { class: 'btn danger', onclick: () => modal({
            title: 'Reset all progress?',
            body: h('p', { class: 'muted' }, 'This clears lessons, practice history, tests, personal bests, table results and settings in this browser. It cannot be undone.'),
            actions: [{ label: 'Cancel' }, { label: 'Reset everything', danger: true, onClick: () => { S.reset(); UI.resetTable(); UI.applyMotion(); toast('Progress reset.'); UI.navigate('dashboard'); } }],
          }) }, 'Reset progress')
        ),
        exportBox
      )
    );
    return () => cleanup && cleanup();
  }

  UI.register({ id: 'settings', label: 'Settings', icon: 'gear', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
