(() => {
  const D = window.__LIB__;
  const meetings = D.meetings;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (d, o) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', o);
  const monthKey = (d) => d.slice(0, 7);
  const months = [...new Set(meetings.map((m) => monthKey(m.date)))];

  // summary
  $('#lib-count').textContent = meetings.length;
  $('#lib-range').textContent = meetings.length ? `${fmt(meetings[meetings.length - 1].date, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(meetings[0].date, { month: 'short', day: 'numeric', year: 'numeric' })}` : '—';
  $('#lib-latest').textContent = meetings.length ? fmt(meetings[0].date, { weekday: 'long', month: 'long', day: 'numeric' }) : '—';
  $('#lib-built').textContent = new Date(D.built).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  // month chips
  const chips = $('#lib-months');
  let month = 'all';
  const mkChip = (key, label) => { const b = el('button', 'lib-chip', label); b.type = 'button'; b.dataset.m = key; b.setAttribute('aria-pressed', key === month ? 'true' : 'false'); b.addEventListener('click', () => { month = key; chips.querySelectorAll('.lib-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.m === month ? 'true' : 'false')); render(); }); chips.appendChild(b); };
  mkChip('all', 'All');
  months.forEach((m) => mkChip(m, fmt(m + '-01', { month: 'short' })));

  const q = $('#lib-q');
  q.addEventListener('input', () => render());

  function render() {
    const words = q.value.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const list = $('#lib-list'); list.replaceChildren();
    let shown = 0, lastMonth = '';
    for (const m of meetings) {
      if (month !== 'all' && monthKey(m.date) !== month) continue;
      const hay = (m.date + ' ' + fmt(m.date, { weekday: 'long', month: 'long', day: 'numeric' }) + ' ' + m.kind + ' ' + m.items.map((i) => i.join(' ')).join(' ')).toLowerCase();
      if (words.length && !words.every((w) => hay.includes(w))) continue;
      const hits = words.length ? m.items.filter(([f, t]) => words.some((w) => (f + ' ' + t).toLowerCase().includes(w))) : [];
      if (monthKey(m.date) !== lastMonth) { lastMonth = monthKey(m.date); list.appendChild(el('h2', 'lib-month', fmt(m.date, { month: 'long', year: 'numeric' }))); }
      const card = el('article', 'lib-card');
      const top = el('div', 'lib-top');
      const when = el('div', 'lib-when');
      when.appendChild(el('div', 'lib-date', fmt(m.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })));
      when.appendChild(el('div', 'lib-kind', `${m.kind} · ${m.time}${m.pages ? ` · ${m.pages} pages` : ''}`));
      top.appendChild(when);
      const acts = el('div', 'lib-acts');
      const open = el('a', 'sa-btn', 'Open minutes (PDF)'); open.href = 'minutes/' + encodeURIComponent(m.file); open.target = '_blank'; open.rel = 'noopener';
      const dl = el('a', 'sa-btn ghost', 'Download'); dl.href = 'minutes/' + encodeURIComponent(m.file); dl.setAttribute('download', m.file);
      const lg = el('a', 'sa-btn ghost', 'City’s Legistar page ↗'); lg.href = D.legistar; lg.target = '_blank'; lg.rel = 'noopener'; lg.title = 'Opens the City Council page on the city’s Legistar site, where every meeting’s official agenda and minutes are listed';
      acts.append(open, dl, lg); top.appendChild(acts); card.appendChild(top);
      const facts = el('div', 'lib-facts');
      const fact = (k, v) => { const f = el('span', 'lib-fact'); f.appendChild(el('b', '', v)); f.append(' ' + k); facts.appendChild(f); };
      fact('roll-call votes', String(m.votes)); fact(m.splits === 1 ? 'split vote' : 'split votes', String(m.splits)); fact('agenda items', String(m.item_count));
      const ab = el('span', 'lib-fact'); ab.append(m.absent ? `Absent: ${m.absent}` : 'All members present'); facts.appendChild(ab);
      card.appendChild(facts);
      if (m.items.length) {
        const det = el('details', 'lib-items'); if (hits.length) det.open = true;
        det.appendChild(el('summary', '', hits.length ? `${hits.length} matching item${hits.length > 1 ? 's' : ''} (of ${m.items.length})` : `Agenda items (${m.items.length})`));
        const ul = el('ul');
        for (const [f, t] of (hits.length ? hits : m.items)) { const li = el('li'); li.appendChild(el('b', '', f)); li.append(' ' + t); ul.appendChild(li); }
        det.appendChild(ul); card.appendChild(det);
      }
      list.appendChild(card); shown++;
    }
    $('#lib-shown').textContent = shown === meetings.length ? `Showing all ${shown} meetings` : `Showing ${shown} of ${meetings.length} meetings`;
    if (!shown) list.appendChild(el('p', 'lib-empty', 'No meetings match. Try fewer words, or pick “All” months.'));
  }
  render();

})();
