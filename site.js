/* Shared behavior for every page: menu, search, term tips, cross-links and the "At a glance" box. */
(() => {
  const SITE = window.__SITE__ || { members: [], glossary: [], pages: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------- menu: grouped dropdowns, collapsible on phones ----------
  const nav = $('.sa-nav');
  if (nav) {
    const setH = () => document.documentElement.style.setProperty('--nav-h', (nav.classList.contains('menu-open') ? 56 : nav.offsetHeight) + 'px');
    setH(); window.addEventListener('resize', setH);
    const groups = $$('.sa-grp', nav);
    const closeAll = (except) => groups.forEach((g) => { if (g !== except) { g.classList.remove('open'); $('.sa-grp-b', g).setAttribute('aria-expanded', 'false'); } });
    groups.forEach((g) => {
      const b = $('.sa-grp-b', g);
      b.addEventListener('click', (e) => { e.stopPropagation(); const open = !g.classList.contains('open'); closeAll(g); g.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.sa-grp')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAll(); $('.sa-sugg', nav)?.setAttribute('hidden', ''); } });
    const tog = $('.sa-toggle', nav);
    tog?.addEventListener('click', () => { const open = !nav.classList.contains('menu-open'); nav.classList.toggle('menu-open', open); tog.setAttribute('aria-expanded', String(open)); });
  }

  // ---------- search box: members, file numbers, topics ----------
  const form = $('.sa-search'), q = form && $('input', form), sugg = form && $('.sa-sugg', form);
  const FILE_RX = /^(ord|res|res ph|ao|abza|cf|sr|min|rla|ra)\s*\d{2}-\d+/i;
  function options(text) {
    const t = text.trim(); if (!t) return [];
    const lo = t.toLowerCase(), out = [];
    for (const m of SITE.members) if (m.full.toLowerCase().includes(lo) || m.m.toLowerCase().startsWith(lo)) out.push({ label: m.full, hint: 'Member profile', href: `member-by-member.html#member=${encodeURIComponent(m.m)}` });
    for (const p of SITE.pages) if (lo.length > 2 && (p.title.toLowerCase().includes(lo) || (p.desc || '').toLowerCase().includes(lo))) out.push({ label: p.title, hint: 'Page', href: p.href });
    for (const g of SITE.glossary) if (lo.length > 3 && g.term.toLowerCase().includes(lo)) out.push({ label: g.term, hint: 'What it means', href: `glossary.html#${g.id}` });
    if (FILE_RX.test(t)) out.unshift({ label: t.toUpperCase().replace(/^RES PH/, 'RES PH').replace(/^(ORD|RES|AO|ABZA|CF|SR|MIN|RLA|RA)\b/, (x) => x[0] + x.slice(1).toLowerCase()), hint: 'Find in the minutes', href: `library.html#q=${encodeURIComponent(t)}` });
    out.push({ label: `Search the minutes for “${t}”`, hint: 'Minutes library', href: `library.html#q=${encodeURIComponent(t)}` });
    out.push({ label: `Course of action for “${t}”`, hint: 'Chamber strategy', href: `course-of-action.html#tab=search&q=${encodeURIComponent(t)}` });
    return out.slice(0, 7);
  }
  let active = 0, opts = [];
  function show() {
    opts = options(q.value); active = 0; sugg.replaceChildren();
    if (!opts.length) { sugg.hidden = true; return; }
    opts.forEach((o, i) => { const a = el('a', 'sa-opt' + (i === active ? ' on' : '')); a.href = o.href; a.setAttribute('role', 'option'); a.append(el('span', '', o.label), el('small', '', o.hint)); sugg.appendChild(a); });
    sugg.hidden = false;
  }
  if (form) {
    q.addEventListener('input', show);
    q.addEventListener('focus', () => q.value && show());
    q.addEventListener('keydown', (e) => {
      if (sugg.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length; $$('.sa-opt', sugg).forEach((a, i) => a.classList.toggle('on', i === active)); }
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); const o = options(q.value)[active] || options(q.value)[0]; if (o) location.href = o.href; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.sa-search')) sugg.hidden = true; });
  }

  // ---------- term tips (ⓘ) ----------
  let pop = null;
  function tip(btn, g) {
    pop?.remove();
    pop = el('div', 'sa-pop'); pop.setAttribute('role', 'tooltip');
    pop.append(el('b', '', g.term), el('div', '', g.def));
    const more = el('a', '', 'All terms →'); more.href = `glossary.html#${g.id}`; pop.appendChild(more);
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const x = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 10);
    pop.style.left = Math.max(8, x) + 'px'; pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.sa-gl');
    if (b) { e.preventDefault(); const g = SITE.glossary.find((x) => x.id === b.dataset.gl); if (g) tip(b, g); return; }
    if (!e.target.closest('.sa-pop')) { pop?.remove(); pop = null; }
  });
  function addTips() {
    if (!SITE.glossary.length || document.body.dataset.tips) return;
    document.body.dataset.tips = '1';
    const used = new Set();
    const cand = $$('#dash-root h2, #dash-root h3, #dash-root .lab, #dash-root .kl, #dash-root th, #dash-root summary, #dash-root .tab, main h2, main th');
    for (const g of SITE.glossary) {
      const rx = new RegExp(g.rx, 'i');
      const target = cand.find((n) => !n.closest('[data-draw]') && !n.querySelector('.sa-gl') && rx.test(n.textContent));
      if (!target || used.has(target)) continue;
      used.add(target);
      const b = el('button', 'sa-gl', 'i'); b.type = 'button'; b.dataset.gl = g.id; b.setAttribute('aria-label', `What does “${g.term}” mean?`); b.title = g.term;
      target.appendChild(b);
    }
  }

  // ---------- cross-links: file numbers → minutes library, member names → profile ----------
  const NUM = '(?:Ord|RES PH|RES|AO|ABZA|CF|SR|RLA|RA|Min)\\s\\d{2}-\\d+';
  const names = SITE.members.map((m) => m.m);
  const ANY_RX = new RegExp(`\\b(?:${NUM}${names.length ? '|' + names.join('|') : ''})\\b`, 'g');
  const IS_NUM = new RegExp(`^${NUM}$`);
  function linkify(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('a, button, svg, script, style, .sa-nav, input, textarea, #print-sheet') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const s = n.nodeValue; if (!s || s.length < 3) continue;
      const ms = [...s.matchAll(ANY_RX)]; if (!ms.length) continue;
      const frag = document.createDocumentFragment(); let i = 0;
      for (const m of ms) {
        if (m.index > i) frag.appendChild(document.createTextNode(s.slice(i, m.index)));
        const part = m[0], a = el('a', 'sa-xl', part);
        if (IS_NUM.test(part)) { a.href = `library.html#q=${encodeURIComponent(part)}`; a.title = 'Find in the minutes'; }
        else { a.href = `member-by-member.html#member=${part}`; a.title = `${part}: member profile`; }
        frag.appendChild(a); i = m.index + part.length;
      }
      if (i < s.length) frag.appendChild(document.createTextNode(s.slice(i)));
      n.parentNode.replaceChild(frag, n);
    }
  }
  // sub-menus (e.g. Course of action → its three sections)
  $$('.sa-subg').forEach((g) => {
    const b = $('.sa-sub-b', g);
    b.addEventListener('click', (e) => { e.stopPropagation(); const open = !g.classList.contains('open'); g.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); });
  });
  const markSub = () => {
    const here = location.pathname.split('/').pop() || 'index.html';
    const tab = window.dash && dash.params().tab;
    $$('.sa-sub-a').forEach((a) => { const on = a.getAttribute('href').split('#')[0] === here && a.dataset.tab === tab; if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  };
  $$('.sa-sub-a').forEach((a) => a.addEventListener('click', () => {
    $$('.sa-grp').forEach((g) => { g.classList.remove('open'); const gb = $('.sa-grp-b', g); if (gb) gb.setAttribute('aria-expanded', 'false'); });
    document.querySelector('.sa-nav')?.classList.remove('menu-open');
  }));
  if (window.dash) dash.afterDraw(markSub); markSub();
  // links that only change the #part of this page update the view
  window.addEventListener('hashchange', () => {
    if (!window.dash) return;
    const h = new URLSearchParams(location.hash.slice(1)), cur = dash.params(), upd = {};
    h.forEach((v, k) => { if (k in cur && cur[k] !== v) upd[k] = v; });
    if (Object.keys(upd).length) {
      dash.setParams(upd);
      const tabs = 'tab' in upd && document.querySelector('.tabs');
      if (tabs) window.scrollTo({ top: Math.max(0, tabs.getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64) - 8), behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  let lt = null;
  const linkAll = () => { clearTimeout(lt); lt = setTimeout(() => $$('#dash-root tbody, #dash-root .tbl-wrap td, main .lib-items').forEach((r) => linkify(r)), 50); };

  // ---------- "At a glance" answers at the top of each dashboard ----------
  function glanceBox() {
    const box = $('#sa-glance'); if (!box || !window.__glance) return;
    const items = window.__glance();
    box.replaceChildren();
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(el('div', 'sa-gh', 'At a glance'));
    const ul = el('ul'); items.forEach((t) => ul.appendChild(el('li', '', t))); box.appendChild(ul);
  }

  // ---------- jump to a section (links like page.html#go=next) ----------
  function jump() {
    const go = new URLSearchParams(location.hash.slice(1)).get('go');
    const t = go && document.getElementById(go);
    if (t) { t.scrollIntoView({ behavior: 'auto', block: 'start' }); t.classList.add('sa-flash'); setTimeout(() => t.classList.remove('sa-flash'), 1600); }
  }

  if (window.dash && dash.afterDraw) {
    let first = true;
    dash.afterDraw(() => { glanceBox(); linkAll(); if (first) { first = false; addTips(); setTimeout(jump, 500); } });
  } else {
    addTips(); linkAll(); setTimeout(jump, 250);
    new MutationObserver(linkAll).observe(document.body, { childList: true, subtree: true });
  }
})();
