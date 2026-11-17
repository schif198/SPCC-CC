window.dash = (() => {
  const RAW = window.__DASH_DATA__, DATA = {};
  for (const k in RAW) DATA[k] = d3.csvParse(RAW[k]);
  const params = Object.assign({}, window.__DASH_PARAMS__);
  const MEMBERS = ['Noecker', 'Yang', 'Kim', 'Bowie', 'Jost', 'Johnson', 'Coleman'];
  let fromHash = false;
  try { const h = new URLSearchParams(location.hash.slice(1)); h.forEach((v, k) => { if (k in params) { params[k] = v; if (k === 'member') fromHash = true; } }); } catch (e) {}
  // the member picked on any page stays picked on the others (this browser only)
  try {
    const saved = localStorage.getItem('spcc-member');
    if ('member' in params && !fromHash && MEMBERS.includes(saved)) params.member = saved;
    if (fromHash && MEMBERS.includes(params.member)) localStorage.setItem('spcc-member', params.member);
  } catch (e) {}
  const draws = [], listeners = [], after = [];
  let pending = false;
  const run = () => {
    pending = false;
    for (const f of listeners) { try { f(); } catch (e) { console.error(e); } }
    for (const [name, fn] of draws) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { fn(el); } catch (e) { console.error(name, e); }
    });
    for (const f of after) { try { f(); } catch (e) { console.error(e); } }
    fitText(); ellText(); autoContrast();
  };
  // white labels on bright fills (e.g. Chamber orange) switch to dark text when white would be hard to read
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]); };
  const autoContrast = () => document.querySelectorAll('svg').forEach((svg) => {
    const texts = [...svg.querySelectorAll('text')].filter((t) => { const f = getComputedStyle(t).fill; return /255, 255, 255/.test(f) || t.dataset.ac; });
    if (!texts.length) return;
    const shapes = [...svg.querySelectorAll('rect, circle, path')];
    for (const t of texts) {
      if (!t.dataset.ac) t.dataset.ac = '1';
      const b = t.getBoundingClientRect(); if (!b.width) continue; const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      let under = null;
      for (const sh of shapes) { if (!(sh.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)) continue; const r = sh.getBoundingClientRect(); if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { const f = getComputedStyle(sh).fill; if (f && f !== 'none' && !/rgba\(.*, 0\)/.test(f)) under = f; } }
      const L = under && lum(under); if (L == null) continue;
      const white = 1.05 / (L + 0.05), dark = (L + 0.05) / 0.0617;
      t.style.fill = white < 4.5 && dark > white ? '#22182c' : '';
    }
  });
  // shrink any SVG label marked data-fit="<max width>" so it never spills past its gauge
  // re-shorten long labels once the real font has loaded (it is wider than the fallback used at first draw)
  const ellText = () => document.querySelectorAll('svg text[data-ell]').forEach((t) => {
    const max = +t.getAttribute('data-ell'), full = t.getAttribute('data-full'); if (!max || !full) return;
    t.textContent = full; if (!t.getComputedTextLength()) return;
    while (t.getComputedTextLength() > max && t.textContent.length > 8) t.textContent = t.textContent.slice(0, -2) + '…';
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(ellText, 0));
  // charts size their label columns from text widths, so draw them again once the real font is in
  if (document.fonts && document.fonts.load) Promise.all(['400 11px Montserrat', '600 11px Montserrat', '700 11px Montserrat'].map((f) => document.fonts.load(f))).then(() => setTimeout(() => { schedule(); ellText(); }, 0)).catch(() => {});
  const fitText = () => document.querySelectorAll('svg text[data-fit]').forEach((t) => {
    const max = +t.getAttribute('data-fit'); if (!max) return;
    const fs0 = +(t.getAttribute('data-fs') || t.getAttribute('font-size')); t.setAttribute('data-fs', fs0);
    let fs = fs0; t.setAttribute('font-size', fs);
    let w = t.getComputedTextLength(); if (!w) return;
    if (w > max) { fs = Math.max(7, Math.floor(fs * max / w * 10) / 10); t.setAttribute('font-size', fs); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(fitText, 0));
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  let lw = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lw) { lw = window.innerWidth; schedule(); } });
  const syncHash = () => { try { const u = new URLSearchParams(); for (const k in params) if (params[k] !== '' && params[k] != null) u.set(k, params[k]); history.replaceState(null, '', '#' + u.toString()); } catch (e) {} };
  return {
    // colorblind-safe categorical palette (Okabe-Ito family, tuned to the site's terracotta)
    colors: ['#f15a25', '#2f6eb5', '#e0a030', '#1f8a78', '#6aaed6', '#b5658f', '#8c8577', '#3b3a37'],
    data: (id) => DATA[id] ? { status: 'ok', data: DATA[id], rows: DATA[id], columns: DATA[id].columns, meta: [] } : { status: 'missing', data: [], columns: [], meta: [] },
    draw: (name, fn) => {
      if (fn === undefined) { for (const [n, f] of draws) if (n === name) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => { if (!el.closest('[hidden]')) { try { f(el); } catch (e) { console.error(name, e); } } }); return; }
      if (typeof fn === 'function') draws.push([name, fn]);
      else { const st = new WeakMap(); draws.push([name, (el) => { if (!st.has(el)) st.set(el, fn.mount ? fn.mount(el) : undefined); if (fn.update) fn.update(el, st.get(el)); }]); }
      schedule();
    },
    onData: (fn) => { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => Object.assign({}, params),
    setParams: (p) => { Object.assign(params, p); if ('member' in p) { try { if (MEMBERS.includes(p.member)) localStorage.setItem('spcc-member', p.member); else localStorage.removeItem('spcc-member'); } catch (e) {} } syncHash(); schedule(); },
    afterDraw: (fn) => { after.push(fn); schedule(); },
    resetParams: () => { Object.assign(params, window.__DASH_PARAMS__); syncHash(); schedule(); },
    setLink: () => {}, refresh: () => {}, calc: () => {}, loader: () => {},
  };
})();

// ---------- visual keys ----------
// A key is a row of small examples (swatches, sample cells, dots, lines, rings, gradient strips), each with a short label.
// Write one in a page as <div class="dkey" data-key='[{"k":"sw","c":"c0","l":"Yea"}, …]'></div>, or build one in code with dash.key([...]).
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const tok = (c) => {
    if (c == null) return 'none';
    const m = /^c(\d)$/.exec(c); if (m) return dash.colors[+m[1]];
    return ({ yea: dash.colors[0], nay: '#2a0157', muted: 'var(--cds-chart-muted)', crit: 'var(--cds-chart-status-critical)', line: 'var(--color-border-line)', panel: 'var(--color-panel)', fg: 'var(--color-fg)', ref: 'var(--color-fg-muted)' })[c] || c;
  };
  const svg = (w, h, inner) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; return s; };
  let gid = 0;
  const mark = (it) => {
    const c = tok(it.c);
    switch (it.k) {
      case 'sw': return svg(14, 14, `<rect x="1" y="1" width="12" height="12" rx="3" fill="${c}" ${it.op != null ? `fill-opacity="${it.op}"` : ''} ${it.stroke ? `stroke="${tok(it.stroke)}"` : ''}/>`);
      case 'cell': return svg(30, 18, `<rect x="1" y="1" width="28" height="16" rx="3" fill="${it.empty ? '#fff' : c}" ${it.op != null ? `fill-opacity="${it.op}"` : ''} stroke="${it.outline ? 'var(--color-fg)' : it.empty ? 'var(--color-border-line)' : 'none'}" stroke-width="${it.outline ? 2 : 1}"/>${it.text ? `<text x="15" y="12.5" text-anchor="middle" font-size="9.5" fill="${it.tc || 'var(--color-fg)'}">${it.text}</text>` : ''}`);
      case 'dot': return svg(16, 16, `<circle cx="8" cy="8" r="5.5" fill="${it.hollow ? '#fff' : c}" stroke="${c}" stroke-width="2"/>`);
      case 'line': return svg(30, 14, `<line x1="2" y1="7" x2="28" y2="7" stroke="${c}" stroke-width="${it.w || 2}" ${it.op != null ? `stroke-opacity="${it.op}"` : ''} ${it.dash ? 'stroke-dasharray="3 3"' : ''} stroke-linecap="${it.dash ? 'butt' : 'round'}"/>`);
      case 'vline': return svg(12, 18, `<line x1="6" y1="1" x2="6" y2="17" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 2"/>`);
      case 'bar': return svg(34, 12, `<rect x="1" y="3" width="32" height="6" rx="3" fill="var(--color-border-line)"/><rect x="1" y="3" width="${32 * (it.pct ?? 0.65)}" height="6" rx="3" fill="${c}"/>`);
      case 'ring': { const r = 7, C = 2 * Math.PI * r, p = it.pct ?? 0.75; return svg(20, 20, `<circle cx="10" cy="10" r="${r}" fill="none" stroke="var(--color-border-line)" stroke-width="3"/><circle cx="10" cy="10" r="${r}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="${C * p} ${C}" transform="rotate(-90 10 10)"/>`); }
      case 'num': return svg(18, 18, `<circle cx="9" cy="9" r="8" fill="${c}"/><text x="9" y="12.5" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${it.n ?? 1}</text>`);
      case 'edge': return svg(30, 18, `<rect x="1" y="1" width="28" height="16" rx="3" fill="#fff" stroke="var(--color-border-line)"/><rect x="1" y="1" width="4" height="16" rx="1.5" fill="${c}"/>`);
      case 'ghost': return svg(26, 18, `<polygon points="13,1 24,5.5 24,12.5 13,17 2,12.5 2,5.5" fill="#8c8577" fill-opacity=".16" stroke="#8c8577" stroke-width="1.2" stroke-dasharray="4 3"/>`);
      case 'shape': return svg(26, 18, `<polygon points="13,2 23,6 21,12 13,16 4,13 5,6" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`);
      case 'dots': { const n = it.of || 7, f = it.n ?? 4; let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${5 + i * 8}" cy="7" r="3" fill="${i < f ? c : '#fff'}" stroke="${c}" stroke-width="1.2"/>`; return svg(8 * n + 2, 14, s); }
      case 'ramp': { const id = 'dkr' + (++gid); const lo = tok(it.lo || 'panel'); const stops = (it.stops || [[0, lo], [1, c]]).map(([o, sc]) => `<stop offset="${o}" stop-color="${tok(sc)}"/>`).join(''); return svg(90, 14, `<defs><linearGradient id="${id}">${stops}</linearGradient></defs><rect x="1" y="2" width="88" height="10" rx="3" fill="url(#${id})" stroke="var(--color-border-line)"/>`); }
      default: return null;
    }
  };
  const key = (items, cls) => {
    const box = document.createElement('div'); box.className = 'dkey' + (cls ? ' ' + cls : ''); box.setAttribute('role', 'note'); box.setAttribute('aria-label', 'Key');
    for (const it of items) {
      const s = document.createElement('span'); s.className = 'dk-i' + (it.k === 'ramp' ? ' dk-ramp' : '');
      if (it.k === 'ramp') {
        if (it.title) { const t = document.createElement('b'); t.innerHTML = it.title; s.appendChild(t); }
        const a = document.createElement('span'); a.className = 'dk-end'; a.textContent = it.a || ''; s.appendChild(a);
        s.appendChild(mark(it));
        const b = document.createElement('span'); b.className = 'dk-end'; b.textContent = it.b || ''; s.appendChild(b);
      } else if (it.k === 'txt') {
        const ex = document.createElement('span'); ex.className = 'dk-ex'; ex.innerHTML = it.ex; s.appendChild(ex);
        if (it.l) { const l = document.createElement('span'); l.innerHTML = it.l; s.appendChild(l); }
      } else if (it.k === 'chip') {
        const ch = document.createElement('span'); ch.className = 'dk-chip'; ch.textContent = it.text; ch.style.borderColor = tok(it.c); if (it.dashed) ch.style.borderStyle = 'dashed'; if (it.fill) { ch.style.background = tok(it.fill); ch.style.color = it.tc || '#fff'; ch.style.fontWeight = '600'; } s.appendChild(ch);
        if (it.l) { const l = document.createElement('span'); l.innerHTML = it.l; s.appendChild(l); }
      } else if (it.k === 'let') {
        const ex = document.createElement('span'); ex.className = 'dk-let';
        for (const [L, c] of it.items) { const b = document.createElement('b'); b.textContent = L; b.style.color = tok(c); ex.appendChild(b); }
        s.appendChild(ex); if (it.l) { const l = document.createElement('span'); l.innerHTML = it.l; s.appendChild(l); }
      } else {
        const m = mark(it); if (m) s.appendChild(m);
        if (it.l) { const l = document.createElement('span'); l.innerHTML = it.l; s.appendChild(l); }
      }
      box.appendChild(s);
    }
    return box;
  };
  const render = (root = document) => root.querySelectorAll('.dkey[data-key]').forEach((el) => {
    try { const k = key(JSON.parse(el.getAttribute('data-key')), el.className.replace(/\bdkey\b/, '').trim()); el.replaceWith(k); } catch (e) { console.error('key', e); }
  });
  dash.key = key; dash.renderKeys = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render()); else render();
})();
