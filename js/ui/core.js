// UI core: DOM helper, cards, chips, inputs, modal, toast, small SVG charts, router.
(function (root) {
  const CC = root.CC;
  const UI = (CC.UI = {});

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  function svg(markup, cls) {
    const wrap = document.createElement('span');
    wrap.innerHTML = markup.trim();
    const s = wrap.firstChild;
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  const f = (n) => CC.fmtSigned(n);
  const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
  const money = (x) => (x < 0 ? '−' : '') + Math.abs(Math.round(x * 100) / 100).toLocaleString('en-US');
  const secs = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1) + ' s');

  // ---------- Motion ----------
  function reducedMotion() {
    const m = CC.store.state.settings.motion;
    if (m === 'reduce') return true;
    if (m === 'full') return false;
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function applyMotion() {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion());
  }
  function bump(el) {
    if (!el || reducedMotion()) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ---------- Playing cards ----------
  const PIPS = {
    2: [[50, 0], [50, 100]],
    3: [[50, 0], [50, 50], [50, 100]],
    4: [[0, 0], [100, 0], [0, 100], [100, 100]],
    5: [[0, 0], [100, 0], [50, 50], [0, 100], [100, 100]],
    6: [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]],
    7: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [0, 100], [100, 100]],
    8: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [50, 75], [0, 100], [100, 100]],
    9: [[0, 0], [100, 0], [0, 33], [100, 33], [50, 50], [0, 67], [100, 67], [0, 100], [100, 100]],
    10: [[0, 0], [100, 0], [50, 17], [0, 33], [100, 33], [0, 67], [100, 67], [50, 83], [0, 100], [100, 100]],
  };

  function cardEl(card, opts) {
    opts = opts || {};
    const red = CC.isRed(card);
    const cls = ['pc', red && 'red', opts.size, opts.down && 'down', opts.deal && 'dealt'].filter(Boolean).join(' ');
    const front = h('div', { class: 'pc-face pc-front' });
    const corner = (pos) => h('span', { class: 'pc-corner ' + pos + (card.rank === '10' ? ' ten' : '') }, h('b', null, card.rank), h('i', null, card.suit));
    front.appendChild(corner('tl'));
    if (card.rank === 'A') front.appendChild(h('div', { class: 'pc-ace' }, card.suit));
    else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')
      front.appendChild(h('div', { class: 'pc-court' }, h('b', null, card.rank), h('i', null, card.suit)));
    else {
      const pips = h('div', { class: 'pc-pips' });
      for (const [x, y] of PIPS[card.rank]) pips.appendChild(h('span', { class: 'pc-pip' + (y > 50 ? ' flip' : ''), style: { left: x + '%', top: y + '%' } }, card.suit));
      front.appendChild(pips);
    }
    front.appendChild(h('div', { class: 'pc-center' }, card.suit));
    front.appendChild(corner('br'));
    const el = h(
      'div',
      { class: cls, 'data-id': card.id, role: 'img', 'aria-label': opts.down ? 'Face-down card' : card.rank + ' of ' + suitName(card.suit) },
      h('div', { class: 'pc-inner' }, front, h('div', { class: 'pc-face pc-back' }))
    );
    if (opts.deal) {
      el.style.setProperty('--delay', (opts.delay || 0) + 'ms');
      if (opts.from) {
        el.style.setProperty('--dx', opts.from[0] + 'px');
        el.style.setProperty('--dy', opts.from[1] + 'px');
      }
    }
    if (opts.tag != null) {
      const v = opts.tag;
      el.appendChild(h('span', { class: 'tag ' + (v > 0 ? 'p' : v < 0 ? 'm' : '') }, v === 0 ? '0' : f(v)));
    }
    return el;
  }
  function suitName(s) {
    return { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' }[s];
  }
  function reveal(el) {
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('down')));
  }

  // ---------- Chips ----------
  const CHIP_VALUES = [1, 5, 25, 100, 500];
  function chipEl(v, opts) {
    opts = opts || {};
    return h(opts.static ? 'span' : 'button', { class: 'chip v' + v + (opts.mini ? ' mini' : ''), type: opts.static ? null : 'button', 'aria-label': 'Add ' + v + ' chip', disabled: opts.disabled, onclick: opts.onClick }, v >= 1000 ? v / 1000 + 'k' : String(v));
  }
  function chipStack(amount) {
    // Break an amount into chips for display (largest first, max 8 shown).
    const out = [];
    let rem = amount;
    for (const v of CHIP_VALUES.slice().reverse()) {
      while (rem >= v && out.length < 8) {
        out.push(v);
        rem -= v;
      }
    }
    return out;
  }

  // ---------- Inputs ----------
  function parseNum(s) {
    if (s == null) return NaN;
    const t = String(s).trim().replace(/[−–]/g, '-').replace(/^\+/, '');
    if (t === '' || t === '-') return NaN;
    return Number(t);
  }
  function numberField(opts) {
    opts = opts || {};
    const step = opts.step || 1;
    const input = h('input', { id: opts.id, class: 'num-in', type: 'text', inputmode: opts.allowNegative === false ? 'decimal' : 'text', autocomplete: 'off', 'aria-label': opts.label || 'Answer', placeholder: opts.placeholder || '0', value: opts.value != null ? opts.value : '' });
    const nudge = (d) => {
      const cur = parseNum(input.value);
      const nv = Math.round(((isNaN(cur) ? 0 : cur) + d) * 100) / 100;
      input.value = opts.signed !== false && nv > 0 ? '+' + nv : String(nv);
      input.dispatchEvent(new Event('input'));
      input.focus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && opts.onEnter) {
        e.preventDefault();
        opts.onEnter();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudge(step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudge(-step);
      }
    });
    const wrap = h(
      'div',
      { class: 'num' + (opts.large ? ' lg' : '') },
      h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => nudge(-step) }, '−'),
      input,
      h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => nudge(step) }, '+')
    );
    return { el: wrap, input, get value() { return parseNum(input.value); }, get raw() { return input.value; }, set(v) { input.value = v; }, focus() { input.focus({ preventScroll: true }); } };
  }
  function seg(options, value, onChange, opts) {
    opts = opts || {};
    const el = h('div', { class: 'seg', role: 'group', 'aria-label': opts.label || null });
    const buttons = options.map((o) =>
      h('button', { type: 'button', 'aria-pressed': String(o.value === value), disabled: opts.disabled, onclick: () => { set(o.value); onChange(o.value); } }, o.label)
    );
    function set(v) {
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === v)));
    }
    buttons.forEach((b) => el.appendChild(b));
    el.setValue = set;
    el.setDisabled = (d) => buttons.forEach((b) => (b.disabled = d));
    return el;
  }
  function toggle(label, checked, onChange, id) {
    const input = h('input', { type: 'checkbox', id, checked, onchange: (e) => onChange(e.target.checked) });
    return h('label', { class: 'switch' }, input, label);
  }
  function field(label, control, id) {
    return h('div', { class: 'field' }, h('label', { for: id || null }, label), control);
  }

  // ---------- Modal & toast ----------
  let openModalClose = null;
  function modal(opts) {
    if (openModalClose) openModalClose(true);
    const back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' });
    const box = h('div', { class: 'modal' });
    if (opts.eyebrow) box.appendChild(h('div', { class: 'eyebrow' }, opts.eyebrow));
    if (opts.title) box.appendChild(h('h2', { style: { marginBottom: '12px' } }, opts.title));
    const body = h('div', { class: 'stack' });
    if (opts.body) append(body, [opts.body]);
    box.appendChild(body);
    const acts = h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '20px' } });
    (opts.actions || [{ label: 'Close' }]).forEach((a) =>
      acts.appendChild(
        h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), type: 'button', onclick: () => { if (a.onClick && a.onClick() === false) return; close(); } }, a.label)
      )
    );
    box.appendChild(acts);
    back.appendChild(box);
    let closed = false;
    function close(immediate) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      openModalClose = null;
      if (immediate || reducedMotion()) back.remove();
      else {
        back.classList.add('closing');
        setTimeout(() => back.remove(), 190);
      }
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape' && opts.dismissable !== false) close();
    }
    back.addEventListener('click', (e) => {
      if (e.target === back && opts.dismissable !== false) close();
    });
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-root').appendChild(back);
    openModalClose = close;
    const focusEl = box.querySelector('input, .btn.primary, .btn');
    if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 30);
    return { close, body, box };
  }
  function toast(msg, kind, ms) {
    const rootEl = document.getElementById('toast-root');
    const t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, msg);
    rootEl.appendChild(t);
    while (rootEl.children.length > 3) rootEl.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 260);
    }, ms || 2600);
  }

  // ---------- Small pieces ----------
  function tile(k, v, s, cls) {
    return h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null);
  }
  function pageHead(eyebrow, title, lede, right) {
    return h('header', { class: 'page-head' }, h('div', null, h('div', { class: 'eyebrow' }, eyebrow), h('h1', null, title), lede ? h('p', { class: 'lede' }, lede) : null), right || null);
  }
  function verdict(ok, title, detail) {
    return h('div', { class: 'verdict ' + (ok ? 'ok' : 'no') }, h('div', { class: 'mark', 'aria-hidden': 'true' }, ok ? '✓' : '✕'), h('div', null, h('div', { style: { fontWeight: 800 } }, title), detail ? h('div', { class: 'small muted' }, detail) : null));
  }
  function timerRing(total) {
    const r = 19;
    const c = 2 * Math.PI * r;
    const el = svg('<svg class="timer-ring" viewBox="0 0 46 46"><circle class="bg" cx="23" cy="23" r="19"/><circle class="fg" cx="23" cy="23" r="19" stroke-dasharray="' + c + '" stroke-dashoffset="0"/><text x="23" y="27" text-anchor="middle" fill="currentColor" style="font:700 12px var(--mono)"></text></svg>');
    const fg = el.querySelector('.fg');
    const tx = el.querySelector('text');
    el.update = (left) => {
      fg.setAttribute('stroke-dashoffset', String(c * (1 - Math.max(0, left) / total)));
      tx.textContent = Math.ceil(Math.max(0, left));
      fg.style.stroke = left < total * 0.3 ? 'var(--bad)' : 'var(--acc)';
    };
    el.update(total);
    return el;
  }

  // ---------- Charts (SVG, one scale per axis) ----------
  function lineChart(points, opts) {
    opts = opts || {};
    const W = 640, H = opts.height || 220, P = { l: 44, r: 14, t: 14, b: 26 };
    if (!points.length) return h('div', { class: 'empty' }, opts.empty || 'No data yet.');
    const ys = points.map((p) => p.y);
    let lo = opts.min != null ? opts.min : Math.min(...ys);
    let hi = opts.max != null ? opts.max : Math.max(...ys);
    if (hi === lo) { hi += 1; lo -= 1; }
    const X = (i) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
    const Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const ticks = 4;
    let g = '';
    for (let i = 0; i <= ticks; i++) {
      const v = lo + ((hi - lo) * i) / ticks;
      g += '<line class="grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (P.l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : Math.round(v)) + '</text>';
    }
    const path = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    const area = path + ' L' + X(points.length - 1).toFixed(1) + ' ' + (H - P.b) + ' L' + X(0).toFixed(1) + ' ' + (H - P.b) + ' Z';
    const color = opts.color || 'var(--acc)';
    let dots = '';
    points.forEach((p, i) => {
      const last = i === points.length - 1;
      if (points.length <= 40 || last) dots += '<circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="' + (last ? 4.5 : 2.5) + '" fill="' + (p.color || color) + '"' + (last ? ' stroke="var(--ink)" stroke-width="2"' : '') + '><title>' + (p.label || '') + '</title></circle>';
    });
    const xl = opts.xLabels ? '<text x="' + P.l + '" y="' + (H - 6) + '">' + opts.xLabels[0] + '</text><text x="' + (W - P.r) + '" y="' + (H - 6) + '" text-anchor="end">' + opts.xLabels[1] + '</text>' : '';
    return svg('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.label || 'chart') + '"><defs><linearGradient id="lg' + (opts.id || '') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ea8ff" stop-opacity=".28"/><stop offset="1" stop-color="#6ea8ff" stop-opacity="0"/></linearGradient></defs>' + g + '<path d="' + area + '" fill="url(#lg' + (opts.id || '') + ')"/><path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2"/>' + dots + xl + '</svg>');
  }
  function barChart(items, opts) {
    opts = opts || {};
    const W = 640, row = 30, P = { l: 150, r: 60 };
    const H = items.length * row + 10;
    const max = opts.max != null ? opts.max : Math.max(1, ...items.map((i) => i.value || 0));
    let s = '';
    items.forEach((it, i) => {
      const y = 5 + i * row;
      const w = it.value == null ? 0 : ((W - P.l - P.r) * it.value) / max;
      s += '<text x="' + (P.l - 10) + '" y="' + (y + 18) + '" text-anchor="end" style="font:600 12px var(--body);fill:var(--text)">' + it.label + '</text>';
      s += '<rect x="' + P.l + '" y="' + (y + 6) + '" width="' + (W - P.l - P.r) + '" height="16" rx="4" fill="var(--ink)"/>';
      if (it.value != null) s += '<rect x="' + P.l + '" y="' + (y + 6) + '" width="' + w.toFixed(1) + '" height="16" rx="4" fill="' + (it.color || 'var(--acc)') + '"/>';
      s += '<text x="' + (W - P.r + 8) + '" y="' + (y + 18) + '">' + (it.display != null ? it.display : it.value) + '</text>';
    });
    return svg('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.label || 'bar chart') + '">' + s + '</svg>');
  }

  // ---------- Router ----------
  const views = [];
  let cleanup = null;
  let current = null;
  function register(v) {
    views.push(v);
  }
  function navigate(id, opts) {
    const v = views.find((x) => x.id === id) || views[0];
    if (cleanup) {
      try { cleanup(); } catch (e) { console.error(e); }
      cleanup = null;
    }
    current = v.id;
    document.querySelectorAll('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.view === v.id ? 'page' : 'false'));
    const host = document.getElementById('view');
    const fresh = h('div', { id: 'view', class: 'view' });
    host.replaceWith(fresh);
    try {
      const r = v.render(fresh, opts || {});
      if (typeof r === 'function') cleanup = r;
    } catch (e) {
      console.error(e);
      fresh.appendChild(h('div', { class: 'empty' }, 'Something went wrong loading this section: ' + e.message));
    }
    if ((!opts || !opts.keepScroll) && root.scrollTo) {
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    try {
      if (location.hash.slice(1) !== v.id) history.replaceState(null, '', '#' + v.id);
    } catch (e) {}
  }
  function go(id, opts) {
    navigate(id, opts);
  }

  Object.assign(UI, { h, append, svg, f, pct, money, secs, reducedMotion, applyMotion, bump, cardEl, reveal, chipEl, chipStack, CHIP_VALUES, parseNum, numberField, seg, toggle, field, modal, toast, tile, pageHead, verdict, timerRing, lineChart, barChart, register, navigate, go, views });
  Object.defineProperty(UI, 'current', { get: () => current });
})(typeof globalThis !== 'undefined' ? globalThis : this);
