// App shell: navigation and boot.
(function (root) {
  const CC = root.CC;
  const UI = CC.UI;
  const { h, svg } = UI;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M5 4h9a4 4 0 014 4v12H9a4 4 0 01-4-4z"/><path d="M5 16a4 4 0 014-4h9"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="11" height="15" rx="2"/><path d="M4 7v12a2 2 0 002 2h9"/></svg>',
    divide: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.4"/><circle cx="12" cy="18" r="1.4"/><path d="M5 12h14"/></svg>',
    table: '<svg viewBox="0 0 24 24"><path d="M3 7h18v3a9 9 0 01-18 0z"/><circle cx="12" cy="11" r="2"/></svg>',
    chips: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/></svg>',
    check: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12l3 3 5-6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
  };

  function boot() {
    CC.store.load();
    UI.applyMotion();
    if (root.matchMedia) {
      const mq = root.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener && mq.addEventListener('change', UI.applyMotion);
    }
    const nav = document.getElementById('nav');
    UI.views.forEach((v) =>
      nav.appendChild(
        h('a', { href: '#' + v.id, 'data-view': v.id, onclick: (e) => { e.preventDefault(); UI.navigate(v.id); } }, svg(ICONS[v.icon] || ICONS.home), v.label)
      )
    );
    root.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (id && id !== UI.current && UI.views.some((v) => v.id === id)) UI.navigate(id);
    });
    const start = location.hash.slice(1);
    UI.navigate(UI.views.some((v) => v.id === start) ? start : 'dashboard');
    if (CC.cloud) {
      CC.store.onSave = () => CC.cloud.schedulePush();
      CC.cloud.init();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
