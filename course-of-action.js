(() => {
  const NA = 'NOT AVAILABLE';
  const fPct = d3.format('.0%');
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const date = (s, f = '%b %-d') => d3.utcFormat(f)(new Date(s + 'T00:00:00Z'));
  const isNA = (v) => !v || String(v).trim() === '' || String(v).toUpperCase().startsWith(NA);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const naSpan = (v) => { const s = el('span', isNA(v) ? 'na' : '', isNA(v) ? (v && String(v).length > NA.length ? v : NA) : v); return s; };
  const rankColor = (r) => dash.colors[(+r - 1) % dash.colors.length];
  const members = () => { const m = ok('c_members'); return m ? m.slice().sort((a, b) => +a.rank - +b.rank) : null; };

  // ---------- tabs ----------
  const TABS = ['plan', 'search', 'priorities'];
  const setTabUI = () => {
    const t = TABS.includes(dash.params().tab) ? dash.params().tab : 'plan';
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'));
    document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  };
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => dash.setParams({ tab: b.dataset.tab })));
  dash.onData(setTabUI);
  setTabUI();

  // ---------- search input ----------
  const qIn = document.querySelector('.q');
  const go = (v) => dash.setParams({ q: (v || '').trim(), tab: 'search' });
  if (qIn) {
    qIn.value = dash.params().q || '';
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(qIn.value); });
    qIn.addEventListener('change', () => go(qIn.value));
  }
  document.querySelector('.go')?.addEventListener('click', () => go(qIn.value));
  document.querySelector('.clearq')?.addEventListener('click', () => { qIn.value = ''; go(''); });
  document.querySelectorAll('.ex').forEach((b) => b.addEventListener('click', () => { qIn.value = b.dataset.q; go(b.dataset.q); }));

  const tipIn = (box) => { const t = el('div', 'tip'); t.hidden = true; box.appendChild(t); return t; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(); tip.appendChild(el('div', 'k', head));
    for (const l of lines) tip.appendChild(el('div', '', l));
    const b = box.getBoundingClientRect(); let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
    tip.hidden = false; const w = tip.offsetWidth;
    if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };

  const gauge = (box, value, label, sub) => {
    box.replaceChildren();
    const W = Math.max(120, box.clientWidth || 136), H = Math.min(84, W * 0.62), r = Math.min(W / 2 - 4, H - 10), cx = W / 2, cy = H - 6;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H + 14}`).attr('height', H + 14);
    const arc = d3.arc().innerRadius(r * 0.72).outerRadius(r).cornerRadius(3);
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('fill', 'var(--color-border-line)');
    if (value != null && !isNaN(value)) g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + Math.PI * Math.max(0, Math.min(1, value)) })).attr('fill', dash.colors[0]);
    g.append('text').attr('y', -r * 0.12).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', Math.round(r * 0.42)).attr('fill', 'var(--color-fg)').text(label);
    svg.append('text').attr('x', cx).attr('y', H + 11).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(sub);
  };
  const meterRow = (parent, k, v, max, txt, color) => {
    const row = el('div', 'mrow'); row.appendChild(el('span', 'k', k));
    const tr = el('div', 'mtrack'); const s = el('span'); s.style.width = (max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0) + '%'; s.style.background = color || dash.colors[0]; tr.appendChild(s);
    row.appendChild(tr); row.appendChild(el('span', 'v', txt)); parent.appendChild(row);
  };

  // ---------- ladder ----------
  dash.draw('ladder', (box) => {
    const m = members(), k = (ok('b_kpis') || [])[0];
    box.replaceChildren(); if (!m) return;
    const need = k ? +k.min_winning_yeas : 4;
    const W = Math.max(520, box.clientWidth), H = 230, pad = 30, step = (W - pad * 2) / m.length;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const tip = tipIn(box);
    const xL = pad + step * need;
    svg.append('line').attr('x1', xL).attr('x2', xL).attr('y1', 8).attr('y2', H - 8).attr('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '4 4');
    svg.append('text').attr('x', xL - 6).attr('y', 18).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(`${need} yeas carry a vote →`);
    svg.append('text').attr('x', xL + 6).attr('y', 18).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text('persuade or keep informed');
    const rr = Math.min(30, step * 0.28);
    const arc = d3.arc().innerRadius(rr - 6).outerRadius(rr);
    m.forEach((d, i) => {
      const cx = pad + step * i + step / 2, cy = 82;
      const g = svg.append('g').attr('transform', `translate(${cx},${cy})`).attr('data-row', d.member).style('cursor', 'default');
      g.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI })).attr('fill', 'var(--color-border-line)');
      g.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI * +d.majority_share })).attr('fill', rankColor(d.rank));
      g.append('text').attr('text-anchor', 'middle').attr('y', 5).attr('font-size', 14).attr('font-family', 'var(--font-anthropic-serif)').attr('fill', 'var(--color-fg)').text(d.rank);
      g.append('text').attr('text-anchor', 'middle').attr('y', rr + 18).attr('font-size', 13).attr('font-weight', 500).attr('fill', 'var(--color-fg)').text(d.member);
      const bw = step * 0.7, bv = +d.biz_lead_max > 0 ? +d.biz_lead / +d.biz_lead_max : 0;
      g.append('rect').attr('x', -bw / 2).attr('y', rr + 30).attr('width', bw).attr('height', 7).attr('rx', 3).attr('fill', 'var(--color-border-line)');
      g.append('rect').attr('x', -bw / 2).attr('y', rr + 30).attr('width', bw * bv).attr('height', 7).attr('rx', 3).attr('fill', rankColor(d.rank));
      g.append('text').attr('text-anchor', 'middle').attr('y', rr + 52).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(d.biz_lead);
      g.append('circle').attr('r', rr + 4).attr('fill', 'transparent')
        .on('pointermove', (ev) => showTip(box, tip, ev, d.full_name, [d.stance, `With majority on split votes: ${fPct(+d.majority_share)}`, `Business-item motions/remarks: ${d.biz_lead}`, `Votes most with: ${d.closest} (${fPct(+d.closest_share)})`]))
        .on('pointerleave', () => { tip.hidden = true; });
    });
  });

  // ---------- member plans ----------
  dash.draw('plans', (box) => {
    const m = members(); box.replaceChildren(); if (!m) return;
    for (const d of m) {
      const c = el('article', 'plan'); c.dataset.row = d.member; c.style.borderTopColor = rankColor(d.rank);
      const top = el('div', 'top'); const t = el('div');
      t.appendChild(el('div', 'rl', `#${d.rank} in outreach order · ${d.role}`));
      t.appendChild(el('div', 'nm', d.full_name));
      const tag = el('span', 'tag', d.stance); tag.style.borderColor = rankColor(d.rank); t.appendChild(tag);
      top.appendChild(t); const gb = el('div', 'gauge'); top.appendChild(gb); c.appendChild(top);
      requestAnimationFrame(() => gauge(gb, +d.majority_share, fPct(+d.majority_share), 'with majority on splits'));
      const ms = el('div');
      meterRow(ms, 'Votes cast', +d.participation, 1, fPct(+d.participation));
      meterRow(ms, 'Business lead', +d.biz_lead, +d.biz_lead_max, d.biz_lead, rankColor(d.rank));
      meterRow(ms, 'Pushback', +d.biz_pushback, +d.biz_pushback_max, d.biz_pushback, 'var(--color-bad)');
      c.appendChild(ms);
      const sec = (h, v) => { const s = el('div', 'sec'); s.appendChild(el('b', '', h)); s.appendChild(naSpan(v)); c.appendChild(s); };
      sec('Recommended approach', d.approach);
      sec('Engage on', d.engage_on);
      sec('Lead with (Chamber value)', d.lead_with);
      sec('Cautions', d.cautions);
      sec('Chamber relationship', d.chamber_relationship);
      const det = el('details'); det.appendChild(el('summary', '', 'On the record'));
      det.appendChild(el('p', '', d.record));
      det.appendChild(el('p', '', `Votes most often with ${d.closest} (${fPct(+d.closest_share)} on split votes); least with ${d.farthest} (${fPct(+d.farthest_share)}). ${d.coalition}.`));
      c.appendChild(det); box.appendChild(c);
    }
  });

  // ---------- next meeting ----------
  dash.draw('next', (box) => {
    const w = ok('b_watch'), iss = ok('c_issues'); box.replaceChildren(); if (!w) return;
    const byI = new Map((iss || []).map((r) => [r.issue, r]));
    const wrap = el('div', 'tbl-wrap'); const tb = el('table'); const th = el('thead'); const hr = el('tr');
    ['File', 'Item', 'Issue', 'Stage', 'Last vote', 'Call first'].forEach((h) => hr.appendChild(el('th', '', h))); th.appendChild(hr); tb.appendChild(th);
    const body = el('tbody');
    for (const r of w) {
      const tr = el('tr'); tr.dataset.row = r.file; const i = byI.get(r.issue);
      tr.appendChild(el('td', '', r.file)); tr.appendChild(el('td', '', r.item));
      tr.appendChild(el('td', '', r.issue)); tr.appendChild(el('td', '', `${r.stage} · ${date(r.next_meeting)}`));
      const lv = el('td'); lv.appendChild(naSpan(r.last_tally)); tr.appendChild(lv);
      const cf = el('td'); cf.appendChild(naSpan(i ? `${i.lead_1}, ${i.lead_2} (most active on ${r.issue.toLowerCase()}); Coleman as Chamber champion` : NA)); tr.appendChild(cf);
      body.appendChild(tr);
    }
    tb.appendChild(body); wrap.appendChild(tb); box.appendChild(wrap);
  });

  // ---------- search engine ----------
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'city', 'saint', 'paul', 'council', 'ordinance', 'resolution', 'proposed', 'new', 'policy', 'issue', 'topic', 'our', 'on', 'of', 'in', 'to', 'a', 'an']);
  const words = (q) => (q || '').toLowerCase().replace(/\bthru\b/g, 'through').replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  const stem = (w) => w.replace(/(ing|ion|ies|es|s)$/, '');
  const match = (q) => {
    const iss = ok('c_issues') || [], items = ok('c_items') || [];
    const ql = (q || '').toLowerCase(), ws = words(q); if (!ws.length) return null;
    const score = new Map();
    for (const r of iss) {
      let s = 0;
      for (const kw of r.keywords.split(';').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
        if (ql.includes(kw)) s += 3;
        else if (ws.some((w) => kw.split(/\s+/).some((p) => stem(p) === stem(w) || (w.length >= 5 && p.startsWith(stem(w)))))) s += 1;
      }
      if (s) score.set(r.issue, s);
    }
    const rx = ws.map((w) => new RegExp('\\b' + stem(w).replace(/[-]/g, '.?'), 'i'));
    const pre = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => i);
    let hits = [];
    for (const it of items) { const n = rx.filter((x) => x.test(it.title)).length; if (n === rx.length) hits.push({ it, n }); }
    if (!hits.length && pre.length) {
      const wt = rx.map((x) => 1 / Math.log(2 + items.filter((it) => x.test(it.title)).length));
      for (const it of items) {
        const n = rx.reduce((a, x, j) => a + (x.test(it.title) ? wt[j] : 0), 0);
        if (n && it.issues.split(';').map((x) => x.trim()).some((i) => pre.includes(i))) hits.push({ it, n });
      }
    }
    hits.sort((a, b) => b.n - a.n || b.it.date.localeCompare(a.it.date));
    const top = hits.slice(0, 60).map((h) => h.it);
    for (const it of top) for (const i of it.issues.split(';').map((x) => x.trim())) if (!isNA(i)) score.set(i, (score.get(i) || 0) + 0.5);
    const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => iss.find((r) => r.issue === i)).filter(Boolean);
    return { ws, issues: ranked.slice(0, 3), items: top };
  };

  dash.draw('coa', (box) => {
    box.replaceChildren();
    const q = dash.params().q || ''; const m = members(); const k = (ok('b_kpis') || [])[0];
    if (!q) {
      const c = el('div', 'card'); c.appendChild(el('h3', '', 'Enter a topic to build a course of action'));
      c.appendChild(el('p', 'note', 'The output lists the Chamber position and framing, whom to call first, how to reach four votes, expected pushback, timing and the matching 2026 record.'));
      box.appendChild(c); return;
    }
    if (!m || !ok('c_issues') || !ok('c_items')) return;
    const r = match(q);
    const main = r && r.issues[0];
    const card = el('div', 'card'); box.appendChild(card);
    card.appendChild(el('h2', '', `Course of action: “${q}”`));
    if (!r || (!r.issues.length && !r.items.length)) {
      const p = el('p'); p.appendChild(el('span', 'na', NA)); p.append(': no matching issue area or item in the 2026 council minutes, and the Chamber documents supplied do not state a position on it.'); card.appendChild(p);
      const ol = el('ol');
      ['Set the Chamber position first through the Public Affairs committee; the 2025–26 Policy Platform was not supplied (NOT AVAILABLE here).',
        'Brief Coleman (Chamber champion) and ask her to identify a sponsor and the committee path.',
        'Frame the ask with “A strong business climate equals a strong community,” backed by member-business data on jobs and the tax base.',
        'Line up four votes before any hearing; St. Paul ordinances took a median of ' + (k ? k.ord_median_days : NA) + ' days from first reading to adoption in 2026, so engage before first reading.',
        'Submit written comments by noon the day before the hearing and coordinate testimony from affected member businesses.'].forEach((s) => ol.appendChild(el('li', '', s)));
      card.appendChild(ol); return;
    }
    const tags = el('div'); tags.appendChild(el('span', 'note', 'Matched issue areas: '));
    if (r.issues.length) r.issues.forEach((i) => tags.appendChild(el('span', 'tag', i.issue))); else tags.appendChild(el('span', 'na', NA));
    tags.appendChild(el('span', 'note', ` · ${r.items.length} related 2026 items · ${r.items.filter((x) => x.split === 'Yes').length} split votes`));
    card.appendChild(tags);

    // who
    const leadSet = new Map(); const nays = new Map();
    const bump = (mp, n, v = 1) => mp.set(n, (mp.get(n) || 0) + v);
    for (const i of r.issues) { [i.lead_1, i.lead_2, i.lead_3].forEach((n, j) => n && !isNA(n) && bump(leadSet, n, 3 - j)); }
    for (const it of r.items) {
      if (!isNA(it.movers)) for (const mm of m) if (it.movers.includes(mm.member)) bump(leadSet, mm.member, 1);
      if (it.nays) for (const mm of m) if (it.nays.includes(mm.member)) bump(nays, mm.member);
    }
    const pushback = new Map();
    for (const i of r.issues) if (!isNA(i.pushback) && i.pushback !== 'None recorded') for (const mm of m) if (i.pushback.includes(mm.member)) bump(pushback, mm.member);
    const leads = [...leadSet.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const first = ['Coleman', ...leads.filter((n) => n !== 'Coleman')].slice(0, 3);
    const rest = m.filter((x) => !first.includes(x.member)).sort((a, b) => +b.majority_share - +a.majority_share);
    const toFour = rest.slice(0, Math.max(0, (k ? +k.min_winning_yeas : 4) - first.length + 1));
    const watch = m.filter((x) => nays.has(x.member) || pushback.has(x.member)).map((x) => x.member);

    const pos = main ? main.chamber_position : NA;
    const steps = [
      ['Chamber position', main ? `${isNA(main.chamber_priority) ? 'Chamber priority: NOT AVAILABLE' : 'Ties to: ' + main.chamber_priority}. Position: ` : 'Position: ', pos],
      ['Frame the ask', 'Lead with ', main ? main.value_frame : NA],
      ['First calls', `${first.join(', ')}. ` + (leads.length ? `${leads.slice(0, 3).join(', ')} moved or spoke most on these items; Coleman is the Chamber's PAC-endorsed partner.` : 'No recorded movers on matching items (NOT AVAILABLE); Coleman is the Chamber\'s PAC-endorsed partner.'), null],
      ['Build to four votes', `Then ${toFour.map((x) => `${x.member} (with majority ${fPct(+x.majority_share)} on splits)`).join(', ')}. ${main ? (main.splits === '0' ? `All ${main.votes} recorded votes on ${main.issue.toLowerCase()} were unanimous, so aim for consensus language early.` : `${main.splits} of ${main.votes} votes on ${main.issue.toLowerCase()} split; count votes before the hearing.`) : ''}`, null],
      ['Expect pushback', watch.length ? `${watch.join(', ')} voted no or raised concerns on related items. Meet them on their terms (see their cards) and bring data on equity and neighborhood impact.` : 'None recorded on related items. ', watch.length ? null : (main ? main.dissenters : NA)],
      ['Timing', k ? `Engage before first reading: ordinances took a median of ${k.ord_median_days} days to adoption and ${fPct(+k.ord_amended_share)} were amended along the way. ${fPct(+k.delays_adopted_share)} of delayed items were later adopted, so a layover is a window to shape amendments, not a defeat.` : NA, null],
      ['Show up', 'Submit written comments by noon the day before the public hearing, line up member-business testimony, and follow city lobbyist registration and reporting rules.', null],
    ];
    const ol = el('ol');
    for (const [h, t, v] of steps) { const li = el('li'); li.appendChild(el('b', '', h + ': ')); li.append(t); if (v !== null && v !== undefined) li.appendChild(naSpan(v)); ol.appendChild(li); }
    card.appendChild(ol);

    // member grid
    const gc = el('div', 'card'); gc.appendChild(el('h3', '', 'Role of each member on this topic')); const grid = el('div', 'grid'); gc.appendChild(grid); box.appendChild(gc);
    for (const x of m) {
      const role = first.includes(x.member) ? 'Lead / first call' : toFour.some((y) => y.member === x.member) ? 'Fourth-vote target' : watch.includes(x.member) ? 'Persuade: has pushed back' : 'Keep informed';
      const w = el('div', 'who'); w.dataset.row = x.member; w.style.borderLeftColor = rankColor(x.rank);
      w.appendChild(el('b', '', `${x.member} · ${role}`));
      w.appendChild(el('span', '', x.approach.split('. ')[0] + '.'));
      const lw = el('span'); lw.append('Frame: '); lw.appendChild(naSpan(x.lead_with)); w.appendChild(lw);
      if (nays.has(x.member)) w.appendChild(el('span', '', `Voted no on ${nays.get(x.member)} related item(s).`));
      grid.appendChild(w);
    }
  });

  dash.draw('related', (tb) => {
    tb.replaceChildren(); const q = dash.params().q || ''; if (!q || !ok('c_items')) return;
    const r = match(q); const rows = r ? r.items.slice().sort((a, b) => b.date.localeCompare(a.date)) : [];
    for (const it of rows) {
      const tr = el('tr'); tr.dataset.key = it.id;
      tr.appendChild(el('td', '', it.date)); tr.appendChild(el('td', '', it.file)); tr.appendChild(el('td', '', it.title));
      const tv = el('td'); tv.appendChild(naSpan(it.tally)); tr.appendChild(tv);
      tr.appendChild(el('td', '', it.action)); const mv = el('td'); mv.appendChild(naSpan(it.movers)); tr.appendChild(mv);
      tb.appendChild(tr);
    }
  });

  // ---------- priorities ----------
  dash.draw('priorities', (box) => {
    const p = ok('c_priorities'); box.replaceChildren(); if (!p) return;
    for (const d of p) {
      const c = el('article', 'pcard'); c.dataset.row = d.priority;
      c.appendChild(el('div', 't', d.priority)); c.appendChild(el('div', 'note', d.source));
      const s = (h, v) => { const x = el('div'); x.appendChild(el('b', '', h + ': ')); x.appendChild(naSpan(v)); c.appendChild(x); };
      s('Council record', d.council_record); s('Who led', d.leads); s('Status', d.status);
      const g = el('div', 'gap'); g.appendChild(el('b', '', 'Gap: ')); g.appendChild(el('span', /NOT AVAILABLE/.test(d.gap) ? 'na' : '', d.gap)); c.appendChild(g);
      s('Next step', d.next_step); box.appendChild(c);
    }
  });
})();
