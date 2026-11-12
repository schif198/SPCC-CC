(() => {
  const M = ['Noecker', 'Yang', 'Kim', 'Bowie', 'Jost', 'Johnson', 'Coleman'];
  const fInt = d3.format(','), fPct = d3.format('.0%');
  const fmt = { int: (v) => fInt(+v), pct: (v) => fPct(+v) };
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const cur = () => dash.params().member || 'All';
  const date = (s, f = '%b %-d') => d3.utcFormat(f)(new Date(s + 'T00:00:00Z'));
  const ISSUES = ['Labor & wages', 'Housing & tenant rules', 'Economic development & incentives', 'Licensing & enforcement', 'Land use & permitting', 'Utilities, franchises & fees', 'Taxes, levies & assessments', 'Events, festivals & sound permits'];
  const issueColor = (i) => dash.colors[ISSUES.indexOf(i) % dash.colors.length];
  const color = { yea: () => dash.colors[0], nay: () => '#6e1f14', absent: () => 'transparent', adopted: () => dash.colors[0], failed: () => 'var(--color-bad)', other: () => 'var(--cds-chart-muted)' };
  document.querySelectorAll('.pb [data-sw]').forEach((el) => { el.style.background = color[el.dataset.sw](); });
  document.querySelectorAll('.pb .clear').forEach((b) => b.addEventListener('click', () => dash.setParams({ member: 'All' })));

  const tipIn = (box) => { const t = document.createElement('div'); t.className = 'tip'; t.hidden = true; box.appendChild(t); return t; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(); const k = document.createElement('div'); k.className = 'k'; k.textContent = head; tip.appendChild(k);
    for (const l of lines) { const d = document.createElement('div'); d.textContent = l; tip.appendChild(d); }
    const b = box.getBoundingClientRect(); let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
    tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
    if (y + h > Math.max(b.height, h)) y = Math.max(0, ev.clientY - b.top - h - 12);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const measure = (svg, texts, size) => { let w = 0; for (const t of texts) { const n = svg.append('text').attr('font-size', size).text(t); w = Math.max(w, n.node().getComputedTextLength()); n.remove(); } return w; };
  const shortIssue = (i) => i.replace('Economic development & incentives', 'Economic development').replace('Events, festivals & sound permits', 'Events & sound permits').replace('Taxes, levies & assessments', 'Taxes & assessments').replace('Utilities, franchises & fees', 'Utilities & fees');

  const gauge = (box, value, label, sub) => {
    box.replaceChildren();
    const W = Math.max(140, box.clientWidth), H = Math.min(116, W * 0.6), r = Math.min(W / 2 - 6, H - 14), cx = W / 2, cy = H - 8;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const arc = d3.arc().innerRadius(r * 0.74).outerRadius(r).cornerRadius(3);
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('fill', 'var(--color-border-line)');
    if (value != null && !isNaN(value)) g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + Math.PI * Math.max(0, Math.min(1, value)) })).attr('fill', dash.colors[0]);
    g.append('text').attr('y', -r * 0.18).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', Math.max(18, r * 0.42)).attr('fill', 'var(--color-fg)').text(label);
    if (sub) g.append('text').attr('y', 0).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(sub);
  };
  const bigNum = (box, label, sub) => {
    box.replaceChildren();
    const W = Math.max(140, box.clientWidth), H = 100;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    svg.append('text').attr('x', W / 2).attr('y', 60).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', 44).attr('fill', 'var(--color-fg)').text(label);
    if (sub) svg.append('text').attr('x', W / 2).attr('y', 86).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(sub);
  };

  // ---------- KPI meters ----------
  const kp = () => { const d = ok('b_kpis'); return d && d[0]; };
  const SUB = {
    votes: (k) => 'of all recorded votes this year',
    seats: (k) => `of ${fInt(+k.seats)} seats carried every split vote`,
    days: (k) => `median, across ${fInt(+k.ord_count)} ordinances`,
    splits: (k) => `${fInt(+k.biz_splits)} business votes split`,
    ord: (k) => `of ${fInt(+k.ord_count)} ordinances`,
    delays: (k) => `${fInt(+k.delays_adopted)} of ${fInt(+k.delays_returned)} that came back`,
  };
  dash.draw('knum', (box) => { const k = kp(); box.dataset.row = '0'; if (!k) { box.replaceChildren(); return; } bigNum(box, fInt(+k[box.dataset.field]), SUB[box.dataset.sub](k)); });
  dash.draw('kgauge', (box) => { const k = kp(); box.dataset.row = '0'; if (!k) { box.replaceChildren(); return; } const v = +k[box.dataset.field]; gauge(box, v, fPct(v), SUB[box.dataset.sub](k)); });
  dash.draw('kv', (el) => { const k = kp(); el.dataset.row = '0'; el.textContent = k ? fmt[el.dataset.fmt](k[el.dataset.field]) : '—'; });

  // ---------- watch list ----------
  dash.draw('watch', (box) => {
    const rows = ok('b_watch'); box.replaceChildren(); if (!rows) return;
    for (const r of rows) {
      const c = document.createElement('div'); c.className = 'wcard'; c.style.borderLeftColor = issueColor(r.issue);
      const when = document.createElement('div'); when.className = 'when'; when.textContent = `${date(r.next_meeting, '%a, %b %-d')} · ${r.stage}`;
      const what = document.createElement('div'); what.className = 'what'; what.textContent = r.item.replace(/\s+\S*$/, '') + '…';
      const meta = document.createElement('div');
      const t1 = document.createElement('span'); t1.className = 'tag'; t1.textContent = r.issue;
      const t2 = document.createElement('span'); t2.className = 'tag'; t2.textContent = r.file;
      meta.append(t1, t2); lensChips(meta, r.persia);
      const last = document.createElement('div'); last.className = 'small';
      last.textContent = r.last_tally === 'no roll call yet' ? 'No roll-call vote yet' : `Last roll call ${r.last_tally} (${date(r.last_action_date)})`;
      c.append(when, what, meta, last); box.appendChild(c);
    }
  });


  // ---------- PERSIA ----------
  const LENSES = ['Political', 'Economic', 'Religious', 'Social', 'Intellectual', 'Artistic'];
  const lensColor = (l) => dash.colors[LENSES.indexOf(l) % dash.colors.length];
  const lensChips = (parent, str) => {
    for (const l of (str || '').split(' · ').filter(Boolean)) { const s = document.createElement('span'); s.className = 'tag'; s.style.borderColor = lensColor(l); s.textContent = l; parent.appendChild(s); }
  };
  dash.draw('persia', (box) => {
    const rows = ok('b_persia'); box.replaceChildren(); if (!rows) return;
    for (const l of LENSES) {
      const r = rows.find((x) => x.lens === l); if (!r) continue;
      const c = document.createElement('div'); c.className = 'ptile'; c.style.borderTopColor = lensColor(l);
      const head = document.createElement('div'); head.style.display = 'flex'; head.style.alignItems = 'baseline'; head.style.gap = '.5rem';
      const big = document.createElement('span'); big.className = 'big'; big.textContent = r.letter; big.style.color = lensColor(l);
      const ln = document.createElement('span'); ln.className = 'ln'; ln.textContent = l;
      head.append(big, ln);
      const g = document.createElement('div'); g.className = 'chart gauge'; g.style.minHeight = '5rem';
      const stats = document.createElement('div'); stats.className = 'small';
      stats.append(Object.assign(document.createElement('b'), { textContent: fInt(+r.votes) }), ' votes · ', Object.assign(document.createElement('b'), { textContent: fInt(+r.splits) }), ' split');
      const ch = document.createElement('div'); ch.className = 'small';
      ch.append('Leads: ', Object.assign(document.createElement('b'), { textContent: r.champion_1 }), ` (${fInt(+r.champion_1_n)}), `, Object.assign(document.createElement('b'), { textContent: r.champion_2 }), ` (${fInt(+r.champion_2_n)})`);
      const tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = r.note;
      c.append(head, g, stats, ch, tx); box.appendChild(c);
      requestAnimationFrame(() => gauge(g, r.unanimous_share === '' ? null : +r.unanimous_share, r.unanimous_share === '' ? '—' : fPct(+r.unanimous_share), 'no dissent'));
    }
  });
  dash.draw('lensmap', (box) => {
    const rows = ok('b_persia_member'); box.replaceChildren(); if (!rows) return;
    const W = Math.max(300, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, LENSES, 11) + 14;
    const top = 22, rh = 32, cw = (W - left) / M.length, H = top + LENSES.length * rh + 4;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const lo = getComputedStyle(box).getPropertyValue('--color-panel').trim() || '#f5f5f5';
    const idx = new Map(rows.map((r) => [r.member + '|' + r.lens, r]));
    const tip = tipIn(box);
    M.forEach((m, j) => svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', cur() === m ? 700 : 400).attr('fill', 'var(--color-fg-muted)').text(cw < 52 ? m.slice(0, 3) : m));
    LENSES.forEach((l, i) => {
      const y = top + i * rh; const ramp = d3.interpolateRgb(lo, lensColor(l));
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(l);
      M.forEach((m, j) => {
        const r = idx.get(m + '|' + l); if (!r) return; const v = +r.index, n = +r.lead;
        svg.append('rect').attr('x', left + j * cw + 2).attr('y', y + 2).attr('width', Math.max(0, cw - 4)).attr('height', rh - 4).attr('rx', 3)
          .attr('fill', n ? ramp(Math.min(1, 0.1 + v / 2.2)) : 'transparent').attr('stroke', 'var(--color-border-line)').attr('stroke-opacity', n ? 0 : 1)
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${l}`, [`${fInt(n)} motions/remarks (${fPct(+r.share)} of theirs vs ${fPct(+r.council_share)} council-wide)`, `${fInt(+r.nay)} nay · ${fInt(+r.absent)} absent of ${fInt(+r.votes)} votes · ${fInt(+r.pushback)} pushback`]))
          .on('mouseleave', () => { tip.hidden = true; });
        if (n && cw > 34) svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('pointer-events', 'none').attr('fill', v > 1.4 ? '#fff' : 'var(--color-fg)').text(d3.format('.1f')(v) + '×');
      });
    });
  });
  const radar = (box, rows) => {
    box.replaceChildren();
    const W = Math.max(160, box.clientWidth), H = 150, cx = W / 2, cy = H / 2 + 4, R = Math.min(W / 2 - 30, H / 2 - 16);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const maxV = 2.5, ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / LENSES.length;
    const pt = (i, v) => [cx + R * Math.min(v, maxV) / maxV * Math.cos(ang(i)), cy + R * Math.min(v, maxV) / maxV * Math.sin(ang(i))];
    for (const ring of [1, 2]) svg.append('polygon').attr('points', LENSES.map((_, i) => pt(i, ring).join(',')).join(' ')).attr('fill', 'none').attr('stroke', ring === 1 ? 'var(--cds-chart-reference)' : 'var(--cds-chart-grid)').attr('stroke-dasharray', ring === 1 ? '3 3' : null);
    LENSES.forEach((l, i) => {
      const [x, y] = pt(i, maxV); svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
      const [lx, ly] = [cx + (R + 11) * Math.cos(ang(i)), cy + (R + 11) * Math.sin(ang(i))];
      svg.append('text').attr('x', lx).attr('y', ly + 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', lensColor(l)).text(l[0]);
    });
    const vals = LENSES.map((l) => { const r = rows.find((x) => x.lens === l); return r ? +r.index : 0; });
    svg.append('polygon').attr('points', vals.map((v, i) => pt(i, v).join(',')).join(' ')).attr('fill', dash.colors[0]).attr('fill-opacity', 0.22).attr('stroke', dash.colors[0]).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
    const tip = tipIn(box);
    vals.forEach((v, i) => { const [x, y] = pt(i, v); svg.append('circle').attr('cx', x).attr('cy', y).attr('r', 4).attr('fill', lensColor(LENSES[i]))
      .on('mousemove', (ev) => showTip(box, tip, ev, LENSES[i], [`${d3.format('.1f')(v)}× the council's share`])).on('mouseleave', () => { tip.hidden = true; }); });
  };

  // ---------- coalition cards ----------
  const meterRow = (parent, label, share, col, valueText) => {
    const row = document.createElement('div'); row.className = 'mrow';
    const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
    const tr = document.createElement('div'); tr.className = 'mtrack';
    const s = document.createElement('span'); s.style.width = Math.max(0, Math.min(1, share)) * 100 + '%'; s.style.background = col; tr.appendChild(s);
    const v = document.createElement('span'); v.className = 'v'; v.textContent = valueText;
    row.append(k, tr, v); parent.appendChild(row);
  };
  dash.draw('cards', (box) => {
    const rows = ok('b_members'); box.replaceChildren(); if (!rows) return;
    for (const m of M) {
      const r = rows.find((x) => x.member === m); if (!r) continue;
      const c = document.createElement('button'); c.type = 'button'; c.className = 'mcard'; c.setAttribute('aria-pressed', String(cur() === m));
      c.addEventListener('click', () => { dash.setParams({ member: cur() === m ? 'All' : m }); });
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = r.full_name;
      const rl = document.createElement('div'); rl.className = 'rl'; rl.textContent = r.role;
      const tag = document.createElement('div'); const t = document.createElement('span'); t.className = 'tag'; t.textContent = r.coalition;
      t.style.borderColor = r.coalition.startsWith('Usually') ? dash.colors[0] : 'var(--color-bad)'; tag.appendChild(t);
      const g = document.createElement('div'); g.className = 'chart gauge'; g.style.minHeight = '5.5rem';
      const rd = document.createElement('div'); rd.className = 'chart'; rd.style.minHeight = '150px';
      c.append(nm, rl, tag, g, rd);
      meterRow(c, 'Business engagement', +r.biz_lead / +r.biz_lead_max, dash.colors[2], fInt(+r.biz_lead));
      meterRow(c, 'Pushback on business', +r.biz_pushback / +r.biz_pushback_max, dash.colors[3], fInt(+r.biz_pushback));
      meterRow(c, 'With majority, biz splits', +r.biz_splits_cast ? +r.biz_splits_with_majority / +r.biz_splits_cast : 0, dash.colors[1], `${fInt(+r.biz_splits_with_majority)}/${fInt(+r.biz_splits_cast)}`);
      const leads = document.createElement('div'); leads.className = 'small';
      leads.append('Leads on ');
      for (const i of [r.top_issue_1, r.top_issue_2].filter((x) => x && x !== '—')) { const s = document.createElement('span'); s.className = 'tag'; s.style.borderColor = issueColor(i); s.textContent = shortIssue(i); leads.appendChild(s); }
      const ally = document.createElement('div'); ally.className = 'small';
      ally.append('Votes most like ', Object.assign(document.createElement('b'), { textContent: r.closest }), ', least like ', Object.assign(document.createElement('b'), { textContent: r.farthest }));
      c.append(leads, ally); box.appendChild(c);
      const pm = (ok('b_persia_member') || []).filter((x) => x.member === m);
      requestAnimationFrame(() => { gauge(g, +r.majority_share, fPct(+r.majority_share), 'with majority on all splits'); radar(rd, pm); });
    }
  });

  // ---------- lead map ----------
  dash.draw('leadmap', (box) => {
    const rows = ok('b_issue_member'); box.replaceChildren(); if (!rows) return;
    const W = Math.max(300, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, ISSUES.map(shortIssue), 11) + 10;
    const top = 22, rh = 30, cw = (W - left) / M.length, H = top + ISSUES.length * rh + 4;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const lo = getComputedStyle(box).getPropertyValue('--color-panel').trim() || '#f5f5f5';
    const idx = new Map(rows.map((r) => [r.member + '|' + r.issue, r]));
    const tip = tipIn(box);
    M.forEach((m, j) => svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', cur() === m ? 700 : 400).attr('fill', 'var(--color-fg-muted)').text(cw < 52 ? m.slice(0, 3) : m));
    ISSUES.forEach((iss, i) => {
      const y = top + i * rh;
      const rowMax = d3.max(M, (m) => +(idx.get(m + '|' + iss) || {}).lead || 0) || 1;
      const ramp = d3.interpolateRgb(lo, issueColor(iss));
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(shortIssue(iss));
      M.forEach((m, j) => {
        const r = idx.get(m + '|' + iss); if (!r) return; const n = +r.lead;
        svg.append('rect').attr('x', left + j * cw + 2).attr('y', y + 2).attr('width', Math.max(0, cw - 4)).attr('height', rh - 4).attr('rx', 3)
          .attr('fill', n ? ramp(0.15 + 0.85 * (n / rowMax)) : 'transparent').attr('stroke', n === rowMax && n ? 'var(--color-fg)' : 'var(--color-border-line)').attr('stroke-width', n === rowMax && n ? 1.5 : 1).attr('stroke-opacity', n && n !== rowMax ? 0 : 1)
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${iss}`, [`${fInt(n)} motions/remarks`, `${fInt(+r.motions)} motions · ${fInt(+r.spoke_for)} spoke for · ${fInt(+r.pushback)} pushback`]))
          .on('mouseleave', () => { tip.hidden = true; });
        if (n && cw > 30) svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('pointer-events', 'none').attr('fill', n / rowMax > 0.6 ? '#fff' : 'var(--color-fg)').text(fInt(n));
      });
    });
  });

  // ---------- contested bars ----------
  dash.draw('contested', (box) => {
    const rows = ok('b_issues'); box.replaceChildren(); if (!rows) return;
    const data = rows.map((r) => ({ ...r, u: r.unanimous_share === '' ? null : +r.unanimous_share })).sort((a, b) => (a.u ?? 2) - (b.u ?? 2));
    const W = Math.max(300, box.clientWidth), rh = 30;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, data.map((r) => shortIssue(r.issue)), 11) + 10;
    const H = data.length * rh + 22; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleLinear([0.75, 1], [left, W - 70]).clamp(true);
    const tip = tipIn(box);
    data.forEach((r, i) => {
      const y = i * rh;
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(shortIssue(r.issue));
      svg.append('rect').attr('x', left).attr('y', y + 8).attr('width', W - 70 - left).attr('height', rh - 16).attr('rx', 3).attr('fill', 'var(--color-border-line)').attr('opacity', 0.5);
      if (r.u != null) svg.append('rect').attr('x', left).attr('y', y + 8).attr('width', Math.max(2, x(r.u) - left)).attr('height', rh - 16).attr('rx', 3).attr('fill', r.u < 1 ? 'var(--color-bad)' : issueColor(r.issue));
      svg.append('text').attr('x', W - 64).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(r.u == null ? '—' : `${fPct(r.u)} · ${fInt(+r.votes)}`);
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tip, ev, r.issue, [`${fInt(+r.votes)} votes · ${fInt(+r.splits)} split`, `Leads: ${r.champion_1} (${fInt(+r.champion_1_n)}), ${r.champion_2} (${fInt(+r.champion_2_n)})`]))
        .on('mouseleave', () => { tip.hidden = true; });
    });
    const ax = svg.append('g').attr('transform', `translate(0,${data.length * rh + 2})`).call(d3.axisBottom(x).ticks(3).tickFormat(fPct).tickSize(0));
    ax.attr('font-size', null).attr('font-family', null); ax.select('.domain').remove(); ax.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 10.5).attr('dy', '1em');
  });

  // ---------- split grid ----------
  dash.draw('splitgrid', (box) => {
    const all = ok('b_splits'); box.replaceChildren(); if (!all) return;
    const qs = [...new Map(all.map((r) => [r.date + '|' + r.question, r])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const W = Math.max(320, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const narrow = W < 760;
    const lab = (q) => date(q.date) + '  ' + (narrow ? q.file : q.question);
    const left = Math.min(W * 0.58, measure(svg, qs.map(lab), 11) + 52);
    const top = 22, rh = 28, cw = (W - left - 40) / M.length, H = top + qs.length * rh + 4;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const idx = new Map(all.map((r) => [r.date + '|' + r.question + '|' + r.member, r]));
    const tip = tipIn(box);
    M.forEach((m, j) => svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', cur() === m ? 700 : 400).attr('fill', 'var(--color-fg-muted)').text(cw < 52 ? m.slice(0, 3) : m));
    svg.append('text').attr('x', W - 4).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text('Tally');
    qs.forEach((q, i) => {
      const y = top + i * rh;
      svg.append('rect').attr('x', 0).attr('y', y + 6).attr('width', 6).attr('height', rh - 12).attr('rx', 2).attr('fill', issueColor(q.issue));
      const t = svg.append('text').attr('x', left - 10).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(lab(q));
      while (t.node().getComputedTextLength() > left - 52 && t.text().length > 8) t.text(t.text().slice(0, -2) + '…');
      M.forEach((m, j) => {
        const r = idx.get(q.date + '|' + q.question + '|' + m); if (!r) return;
        const k = r.vote === 'Yea' ? 'yea' : r.vote === 'Nay' ? 'nay' : 'absent';
        svg.append('rect').attr('x', left + j * cw + 3).attr('y', y + 4).attr('width', Math.max(0, cw - 6)).attr('height', rh - 8).attr('rx', 3)
          .attr('fill', color[k]()).attr('opacity', cur() === 'All' || cur() === m ? 1 : 0.35)
          .attr('stroke', r.with_majority === 'No' ? 'var(--color-fg)' : k === 'absent' ? 'var(--color-border-line)' : 'none').attr('stroke-width', r.with_majority === 'No' ? 2 : 1)
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${q.date}`, [q.question, q.issue, `Voted ${r.vote} · ${r.tally} · ${r.outcome}`]))
          .on('mouseleave', () => { tip.hidden = true; });
      });
      svg.append('text').attr('x', W - 4).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(q.tally);
      (q.persia || '').split(' · ').filter(Boolean).forEach((l, k) => svg.append('text').attr('x', 12 + k * 11).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('font-weight', 700).attr('fill', lensColor(l)).text(l[0]));
    });
  });

  // ---------- ordinance clock ----------
  dash.draw('ordclock', (box) => {
    const rows = ok('b_ordinances'); const k = kp(); box.replaceChildren(); if (!rows) return;
    const data = rows.map((r) => ({ ...r, d: +r.days })).sort((a, b) => a.d - b.d);
    const W = Math.max(300, box.clientWidth), H = 190, mg = { l: 12, r: 12, t: 24, b: 30 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleLinear([0, Math.max(30, d3.max(data, (r) => r.d))], [mg.l, W - mg.r]).nice();
    const ax = svg.append('g').attr('transform', `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((d) => d + 'd'));
    ax.attr('font-size', null).attr('font-family', null); ax.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); ax.selectAll('line').attr('stroke', 'var(--cds-chart-axis)'); ax.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 10.5);
    const stack = {}; const tip = tipIn(box);
    for (const r of data) {
      const b = Math.round(r.d / 3) * 3; stack[b] = (stack[b] || 0) + 1;
      const cy = H - mg.b - 8 - (stack[b] - 1) * 14;
      svg.append('circle').attr('cx', x(r.d)).attr('cy', cy).attr('r', 6).attr('fill', r.changed === 'Yes' ? dash.colors[0] : 'var(--color-panel)').attr('stroke', dash.colors[0]).attr('stroke-width', 1.5)
        .on('mousemove', (ev) => showTip(box, tip, ev, `${r.file} · ${fInt(r.d)} days`, [r.title, `${date(r.first_seen)} → ${date(r.adopted)}`, r.changed === 'Yes' ? 'Amended before adoption' : 'Adopted as introduced']))
        .on('mouseleave', () => { tip.hidden = true; });
    }
    if (k) {
      const mx = x(+k.ord_median_days);
      svg.append('line').attr('x1', mx).attr('x2', mx).attr('y1', mg.t - 6).attr('y2', H - mg.b).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
      svg.append('text').attr('x', mx + 4).attr('y', mg.t - 8).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(`median ${fInt(+k.ord_median_days)} days`);
    }
  });

  // ---------- delays ----------
  dash.draw('delays', (box) => {
    const rows = ok('b_delays'); box.replaceChildren(); if (!rows) return;
    const cat = (o) => (o === 'Adopted' ? 'adopted' : o === 'Failed or denied' ? 'failed' : 'other');
    const data = M.map((m) => { const x = rows.filter((r) => r.member === m); return { m, n: x.length, adopted: x.filter((r) => cat(r.outcome) === 'adopted').length, failed: x.filter((r) => cat(r.outcome) === 'failed').length, other: x.filter((r) => cat(r.outcome) === 'other').length, items: x }; }).sort((a, b) => b.n - a.n);
    const W = Math.max(300, box.clientWidth), rh = 28;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, M, 11) + 10;
    const H = data.length * rh + 6; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleLinear([0, d3.max(data, (d) => d.n) || 1], [left, W - 30]);
    const tip = tipIn(box);
    data.forEach((d, i) => {
      const y = i * rh; let x0 = left;
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('font-weight', cur() === d.m ? 700 : 400).attr('fill', 'var(--color-fg)').text(d.m);
      for (const k of ['adopted', 'failed', 'other']) {
        const w = x(d[k]) - x(0); if (w <= 0) continue;
        svg.append('rect').attr('x', x0).attr('y', y + 6).attr('width', w).attr('height', rh - 12).attr('fill', color[k]());
        x0 += w;
      }
      svg.append('text').attr('x', x0 + 6).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(fInt(d.n));
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tip, ev, `${d.m}: ${fInt(d.n)} motions to delay`, d.items.slice(0, 6).map((r) => `${date(r.date)} ${r.file} → ${r.outcome}`)))
        .on('mouseleave', () => { tip.hidden = true; });
    });
  });

  // ---------- log ----------
  dash.draw('logwho', (el) => { el.textContent = cur() === 'All' ? '(all members)' : `(${cur()})`; });
  dash.draw('logrows', (tb) => {
    const rows = ok('b_log'); tb.replaceChildren(); if (!rows) return;
    for (const r of rows.filter((x) => cur() === 'All' || x.member === cur())) {
      const tr = document.createElement('tr'); tr.dataset.key = r.id;
      for (const c of ['date', 'member', 'issue', 'action', 'file', 'minutes_text']) {
        const td = document.createElement('td'); td.textContent = r[c];
        if (c === 'action' && /against|concerns|deny|delay/.test(r.action)) td.className = 'bad';
        if (c === 'issue') td.className = 'muted';
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
  });
})();
