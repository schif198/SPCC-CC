window.dash = (() => {
  const RAW = window.__DASH_DATA__, DATA = {};
  for (const k in RAW) DATA[k] = d3.csvParse(RAW[k]);
  const params = Object.assign({}, window.__DASH_PARAMS__);
  try { const h = new URLSearchParams(location.hash.slice(1)); h.forEach((v, k) => { if (k in params) params[k] = v; }); } catch (e) {}
  const draws = [], listeners = [];
  let pending = false;
  const run = () => {
    pending = false;
    for (const f of listeners) { try { f(); } catch (e) { console.error(e); } }
    for (const [name, fn] of draws) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { fn(el); } catch (e) { console.error(name, e); }
    });
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  let lw = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lw) { lw = window.innerWidth; schedule(); } });
  const syncHash = () => { try { const u = new URLSearchParams(); for (const k in params) if (params[k] !== '' && params[k] != null) u.set(k, params[k]); history.replaceState(null, '', '#' + u.toString()); } catch (e) {} };
  return {
    colors: ['#c96442', '#3d7cc9', '#5b9e5b', '#b9874a', '#8a63c2', '#2b9c9c', '#c5577f', '#7a7a6e'],
    data: (id) => DATA[id] ? { status: 'ok', data: DATA[id], rows: DATA[id], columns: DATA[id].columns, meta: [] } : { status: 'missing', data: [], columns: [], meta: [] },
    draw: (name, fn) => {
      if (fn === undefined) { for (const [n, f] of draws) if (n === name) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => { if (!el.closest('[hidden]')) { try { f(el); } catch (e) { console.error(name, e); } } }); return; }
      if (typeof fn === 'function') draws.push([name, fn]);
      else { const st = new WeakMap(); draws.push([name, (el) => { if (!st.has(el)) st.set(el, fn.mount ? fn.mount(el) : undefined); if (fn.update) fn.update(el, st.get(el)); }]); }
      schedule();
    },
    onData: (fn) => { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => Object.assign({}, params),
    setParams: (p) => { Object.assign(params, p); syncHash(); schedule(); },
    resetParams: () => { Object.assign(params, window.__DASH_PARAMS__); syncHash(); schedule(); },
    setLink: () => {}, refresh: () => {}, calc: () => {}, loader: () => {},
  };
})();
