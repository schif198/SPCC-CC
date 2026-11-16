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
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  let lw = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lw) { lw = window.innerWidth; schedule(); } });
  const syncHash = () => { try { const u = new URLSearchParams(); for (const k in params) if (params[k] !== '' && params[k] != null) u.set(k, params[k]); history.replaceState(null, '', '#' + u.toString()); } catch (e) {} };
  return {
    // colorblind-safe categorical palette (Okabe-Ito family, tuned to the site's terracotta)
    colors: ['#c96442', '#2f6eb5', '#e0a030', '#1f8a78', '#6aaed6', '#b5658f', '#8c8577', '#3b3a37'],
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
