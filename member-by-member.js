(() => {
  const M = ['Noecker', 'Yang', 'Kim', 'Bowie', 'Jost', 'Johnson', 'Coleman'];
  const fInt = d3.format(','), fPct = d3.format('.0%'), fPct1 = d3.format('.1%');
  const fmt = { int: (v) => fInt(+v), pct: (v) => (v === '' ? '—' : fPct(+v)), text: (v) => v, x: (v) => d3.format('.1f')(+v) + '×' };
  const monthName = (m, f = '%b') => d3.utcFormat(f)(new Date(m + '-01T00:00:00Z'));
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const P = () => dash.params();
  const cur = () => P().member || 'All';
  const months = () => { const ms = ok('p_months'); return ms ? ms.map((r) => r.month) : []; };
  const range = () => ({ from: P().from || '2026-01', to: P().to || '2026-12' });
  const inRange = (r) => { const { from, to } = range(); const m = (r.month || r.date || '').slice(0, 7); return m >= from && m <= to; };
  const where = (extra) => { const { from, to } = range(); return Object.assign({ from, to }, extra); };
  const pick = (rows, crit) => rows && rows.find((r) => Object.entries(crit).every(([k, v]) => r[k] === v));
  const enc = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const color = { yea: () => dash.colors[0], nay: () => '#6e1f14', absent: () => 'var(--color-border-line)' };
  document.querySelectorAll('.cg [data-sw]').forEach((el) => { el.style.background = color[el.dataset.sw](); });

  // ---------- member chips & views ----------
  const go = (m) => { dash.setParams({ member: m }); dash.setLink(m === 'All' ? 'overview' : 'm-' + m.toLowerCase()); };
  document.querySelectorAll('.cg .chip').forEach((b) => b.addEventListener('click', () => go(b.dataset.pick)));
  const hashM = M.find((m) => location.hash === '#m-' + m.toLowerCase());
  if (hashM) dash.setParams({ member: hashM });
  dash.onData(() => {
    const c = cur();
    document.querySelectorAll('.cg [data-view]').forEach((s) => { s.hidden = (s.dataset.view === 'All') !== (c === 'All'); });
    document.querySelectorAll('.cg .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === c)));
  });

  // ---------- tooltip ----------
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
  const short = (t) => t.replace('Recognitions & resolutions of support', 'Recognitions & resolutions').replace('Consent agenda (routine block)', 'Consent agenda block');

  // ---------- month range slider ----------
  let pending = null;
  const paintSlider = (wrap) => {
    const list = months(); if (!list.length) return;
    const [a, b] = wrap.querySelectorAll('input');
    const fill = wrap.querySelector('.fill');
    const lo = Math.min(+a.value, +b.value), hi = Math.max(+a.value, +b.value), n = Math.max(1, list.length - 1);
    fill.style.left = (lo / n) * 100 + '%'; fill.style.width = ((hi - lo) / n) * 100 + '%'; fill.style.background = dash.colors[0];
  };
  dash.draw('slider', {
    mount: (wrap) => {
      wrap.replaceChildren();
      const track = document.createElement('div'); track.className = 'track';
      const fill = document.createElement('div'); fill.className = 'fill';
      const a = document.createElement('input'); a.type = 'range'; a.setAttribute('aria-label', 'From month');
      const b = document.createElement('input'); b.type = 'range'; b.setAttribute('aria-label', 'To month');
      wrap.append(track, fill, a, b);
      const commit = () => {
        const list = months(); const lo = Math.min(+a.value, +b.value), hi = Math.max(+a.value, +b.value);
        pending = null; dash.setParams({ from: list[lo], to: list[hi] });
      };
      const live = () => { const list = months(); pending = [list[Math.min(+a.value, +b.value)], list[Math.max(+a.value, +b.value)]]; paintSlider(wrap); dash.draw('rangelabel'); };
      for (const el of [a, b]) { el.addEventListener('input', live); el.addEventListener('change', commit); }
      return { a, b };
    },
    update: (wrap, made) => {
      const list = months(); const { from, to } = range(); if (!list.length) return;
      for (const el of [made.a, made.b]) { el.min = 0; el.max = list.length - 1; el.step = 1; }
      if (!pending) { made.a.value = Math.max(0, list.indexOf(from)); made.b.value = Math.max(0, list.indexOf(to)); }
      paintSlider(wrap);
    },
  });
  dash.draw('rangelabel', (el) => {
    const list = months(); const { from, to } = range(); if (!list.length) { el.textContent = '—'; return; }
    const [f, t] = pending || [from, to];
    el.textContent = f === t ? monthName(f, '%B %Y') : monthName(f) + ' – ' + monthName(t, '%b %Y');
  });

  // ---------- gauge ----------
  const gauge = (box, value, label, sub) => {
    box.replaceChildren();
    const W = Math.max(140, box.clientWidth), H = Math.min(120, W * 0.6), r = Math.min(W / 2 - 6, H - 14), cx = W / 2, cy = H - 8;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const arc = d3.arc().innerRadius(r * 0.74).outerRadius(r).cornerRadius(3);
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('fill', 'var(--color-border-line)');
    if (value != null && !isNaN(value)) {
      const v = Math.max(0, Math.min(1, value));
      g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + Math.PI * v })).attr('fill', v < 0.75 ? 'var(--cds-chart-status-critical)' : dash.colors[0]);
    }
    g.append('text').attr('y', -r * 0.18).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', Math.max(18, r * 0.42)).attr('fill', 'var(--color-fg)').text(label);
    if (sub) g.append('text').attr('y', 0).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(sub);
  };
  const bigNum = (box, label, sub) => {
    box.replaceChildren();
    const W = Math.max(140, box.clientWidth), H = 96;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    svg.append('text').attr('x', W / 2).attr('y', 58).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', 44).attr('fill', 'var(--color-fg)').text(label);
    if (sub) svg.append('text').attr('x', W / 2).attr('y', 84).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(sub);
  };

  // ---------- council meters ----------
  const councilRow = () => pick(ok('p_council'), where({}));
  dash.draw('cgauge', (box) => {
    const r = councilRow(); box.dataset.where = enc(where({}));
    if (!r) { box.replaceChildren(); return; }
    gauge(box, +r[box.dataset.field], fPct1(+r[box.dataset.field]), 'of ' + fInt(+r.votes) + ' votes');
  });
  dash.draw('cnum', (box) => {
    const r = councilRow(); box.dataset.where = enc(where({}));
    if (!r) { box.replaceChildren(); return; }
    const f = box.dataset.field;
    const sub = f === 'splits' ? fInt(+r.failed) + ' motions failed' : f === 'votes' ? fInt(+r.items) + ' agenda items decided' : 'regular and special';
    bigNum(box, fInt(+r[f]), sub);
  });

  // ---------- member cards ----------
  const meterRow = (parent, label, parts, valueText, tipText) => {
    const row = document.createElement('div'); row.className = 'mrow';
    const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
    const tr = document.createElement('div'); tr.className = 'mtrack';
    for (const [share, col] of parts) { const s = document.createElement('span'); s.style.width = Math.max(0, Math.min(1, share)) * 100 + '%'; s.style.background = col; tr.appendChild(s); }
    const v = document.createElement('span'); v.className = 'v'; v.textContent = valueText;
    row.append(k, tr, v); parent.appendChild(row);
  };
  dash.draw('cards', (box) => {
    const rows = ok('p_member'); box.replaceChildren(); if (!rows) return;
    const sel = rows.filter((r) => r.from === range().from && r.to === range().to);
    for (const m of M) {
      const r = sel.find((x) => x.member === m); if (!r) continue;
      const c = document.createElement('button'); c.className = 'mcard'; c.type = 'button';
      c.addEventListener('click', () => { go(m); document.getElementById('top').scrollIntoView(); });
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = r.full_name;
      const rl = document.createElement('div'); rl.className = 'rl'; rl.textContent = r.role;
      const g = document.createElement('div'); g.className = 'chart gauge'; g.style.minHeight = '5.5rem';
      c.append(nm, rl, g);
      meterRow(c, 'Yea / nay / absent', [[+r.yea_share, color.yea()], [+r.nay_share, color.nay()], [+r.absent_share, 'transparent']], fInt(+r.nay) + ' nay');
      meterRow(c, 'With majority', [[r.majority_share === '' ? 0 : +r.majority_share, dash.colors[1]]], r.majority_share === '' ? '—' : fPct(+r.majority_share));
      meterRow(c, 'Motions made', [[+r.motions_max ? +r.motions / +r.motions_max : 0, dash.colors[2]]], fInt(+r.motions));
      meterRow(c, 'Pushback', [[+r.pushback_max ? +r.pushback / +r.pushback_max : 0, dash.colors[3]]], fInt(+r.pushback));
      const ld = document.createElement('div'); ld.className = 'lead';
      ld.append('Leads on ', Object.assign(document.createElement('b'), { textContent: r.top_focus }));
      c.appendChild(ld);
      box.appendChild(c);
      requestAnimationFrame(() => gauge(g, +r.participation, fPct(+r.participation), 'participation'));
    }
  });

  // ---------- network ----------
  dash.draw('network', (box) => {
    const rows = ok('p_agree'); box.replaceChildren(); if (!rows) return;
    const sel = rows.filter((r) => r.from === range().from && r.to === range().to && r.share !== '');
    const W = Math.max(300, box.clientWidth), H = Math.min(420, Math.max(300, W * 0.75));
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const R = Math.min(W, H) / 2 - 46, cx = W / 2, cy = H / 2;
    const pos = Object.fromEntries(M.map((m, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / M.length; return [m, [cx + R * Math.cos(a), cy + R * Math.sin(a)]]; }));
    const tip = tipIn(box);
    if (!sel.length) {
      svg.append('text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', 'var(--color-fg-muted)').text('No split votes in these months');
    }
    const op = d3.scaleLinear([0, 1], [0.08, 0.95]);
    const sw = d3.scaleLinear([0, 1], [1, 12]);
    for (const r of sel.sort((a, b) => +a.share - +b.share)) {
      const [x1, y1] = pos[r.a], [x2, y2] = pos[r.b], s = +r.share;
      svg.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', dash.colors[0]).attr('stroke-opacity', op(s)).attr('stroke-width', sw(s)).attr('stroke-linecap', 'round')
        .on('mousemove', (ev) => showTip(box, tip, ev, `${r.a} & ${r.b}`, [`Voted alike ${fPct(s)}`, `${fInt(+r.agree)} of ${fInt(+r.n)} split votes`]))
        .on('mouseleave', () => { tip.hidden = true; });
    }
    for (const m of M) {
      const [x, y] = pos[m];
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => go(m));
      g.append('circle').attr('cx', x).attr('cy', y).attr('r', 22).attr('fill', 'var(--color-panel)').attr('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      g.append('text').attr('x', x).attr('y', y + 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', 'var(--color-fg)').text(m.length > 6 ? m.slice(0, 5) + '.' : m);
    }
  });

  // ---------- focus heatmap ----------
  dash.draw('focusmap', (box) => {
    const rows = ok('p_focus'); box.replaceChildren(); if (!rows) return;
    const sel = rows.filter((r) => r.from === range().from && r.to === range().to && r.topic !== 'Other');
    const topics = [...new Set(sel.map((r) => r.topic))];
    const W = Math.max(300, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, topics.map(short), 11) + 10;
    const top = 22, rh = 26, cw = (W - left) / M.length, H = top + topics.length * rh + 4;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const lo = getComputedStyle(box).getPropertyValue('--color-panel').trim() || '#f5f5f5';
    const ramp = d3.interpolateRgb(lo, dash.colors[0]);
    const idx = new Map(sel.map((r) => [r.member + '|' + r.topic, r]));
    const tip = tipIn(box);
    M.forEach((m, j) => svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(cw < 52 ? m.slice(0, 3) : m));
    topics.forEach((t, i) => {
      const y = top + i * rh;
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(short(t));
      M.forEach((m, j) => {
        const r = idx.get(m + '|' + t); if (!r) return; const n = +r.lead_actions, fi = +r.focus_index;
        svg.append('rect').attr('x', left + j * cw + 1).attr('y', y + 1).attr('width', Math.max(0, cw - 2)).attr('height', rh - 2).attr('rx', 3)
          .attr('fill', n ? ramp(Math.min(1, fi / 2.5)) : 'transparent').attr('stroke', 'var(--color-border-line)').attr('stroke-opacity', n ? 0 : 1)
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${t}`, [`${fInt(n)} motions/remarks`, `${fPct(+r.member_share)} of theirs vs ${fPct(+r.council_share)} of the council's`, `Focus ${fmt.x(fi)}`]))
          .on('mouseleave', () => { tip.hidden = true; });
      });
    });
  });

  // ---------- split grid ----------
  dash.draw('splitgrid', (box) => {
    const all = ok('m_splits'); box.replaceChildren(); if (!all) return;
    const rows = all.filter(inRange);
    const qs = [...new Map(rows.map((r) => [r.date + '|' + r.issue, r])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const W = Math.max(320, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    if (!qs.length) { svg.attr('viewBox', `0 0 ${W} 60`).attr('height', 60); svg.append('text').attr('x', W / 2).attr('y', 34).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', 'var(--color-fg-muted)').text('Every vote in these months was unanimous'); return; }
    const narrow = W < 760;
    const lab = (q) => monthName(q.date.slice(0, 7)) + ' ' + +q.date.slice(8) + '  ' + (narrow ? q.file : q.issue);
    const left = Math.min(W * 0.6, measure(svg, qs.map(lab), 11) + 12);
    const top = 22, rh = 24, cw = (W - left - 40) / M.length, H = top + qs.length * rh + 4;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const idx = new Map(rows.map((r) => [r.date + '|' + r.issue + '|' + r.member, r]));
    const tip = tipIn(box);
    M.forEach((m, j) => svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(cw < 52 ? m.slice(0, 3) : m));
    svg.append('text').attr('x', W - 4).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text('Tally');
    qs.forEach((q, i) => {
      const y = top + i * rh;
      const t = svg.append('text').attr('x', left - 10).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(lab(q));
      while (t.node().getComputedTextLength() > left - 14 && t.text().length > 8) t.text(t.text().slice(0, -2) + '…');
      M.forEach((m, j) => {
        const r = idx.get(q.date + '|' + q.issue + '|' + m); if (!r) return;
        const k = r.vote === 'Yea' ? 'yea' : r.vote === 'Nay' ? 'nay' : 'absent';
        svg.append('rect').attr('x', left + j * cw + 3).attr('y', y + 3).attr('width', Math.max(0, cw - 6)).attr('height', rh - 6).attr('rx', 3)
          .attr('fill', k === 'absent' ? 'transparent' : color[k]()).attr('stroke', r.with_majority === 'No' ? 'var(--color-fg)' : k === 'absent' ? 'var(--color-border-line)' : 'none').attr('stroke-width', r.with_majority === 'No' ? 2 : 1)
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${q.date}`, [q.issue, `Voted ${r.vote} · ${r.tally} · ${r.outcome}`]))
          .on('mouseleave', () => { tip.hidden = true; });
      });
      svg.append('text').attr('x', W - 4).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(q.tally);
    });
  });

  // ---------- tables ----------
  const fillRows = (tb, rows, cols, keyFn) => {
    tb.replaceChildren();
    for (const r of rows) {
      const tr = document.createElement('tr'); if (keyFn) tr.dataset.key = keyFn(r);
      for (const [c, f, cls] of cols) { const td = document.createElement('td'); td.className = (typeof cls === 'function' ? cls(r) : cls) || ''; td.textContent = f(r[c]); tr.appendChild(td); }
      tb.appendChild(tr);
    }
  };
  const t = (v) => v;
  dash.draw('comparerows', (tb) => {
    const rows = ok('p_member'); if (!rows) { tb.replaceChildren(); return; }
    const sel = rows.filter((r) => r.from === range().from && r.to === range().to);
    fillRows(tb, sel, [['member', t, ''], ['participation', fmt.pct, 'n'], ['yea', fmt.int, 'n'], ['nay', fmt.int, 'n'], ['absent', fmt.int, 'n'], ['majority_share', fmt.pct, 'n'], ['dissents', fmt.int, 'n'],
      ['motions', fmt.int, 'n'], ['pushback', fmt.int, 'n'], ['top_focus', t, ''], ['closest', t, ''], ['farthest', t, '']], (r) => [r.member, r.from, r.to].map(encodeURIComponent).join(','));
  });
  dash.draw('splitrows', (tb) => {
    const all = ok('m_splits'); if (!all) { tb.replaceChildren(); return; }
    const rows = all.filter((r) => r.member === cur() && inRange(r)).sort((a, b) => a.date.localeCompare(b.date));
    fillRows(tb, rows, [['date', t, ''], ['issue', t, ''], ['vote', t, (r) => (r.vote === 'Nay' ? 'bad' : r.vote === 'Absent' ? 'muted' : '')], ['tally', t, 'n'], ['outcome', t, ''], ['with_majority', t, (r) => (r.with_majority === 'No' ? 'bad' : '')]]);
  });
  dash.draw('logrows', (tb) => {
    const all = ok('m_action_log'); if (!all) { tb.replaceChildren(); return; }
    const rows = all.filter((r) => r.member === cur() && inRange(r));
    fillRows(tb, rows, [['date', t, ''], ['action', t, (r) => (/against|concerns|deny|delay/.test(r.action) ? 'bad' : '')], ['topic', t, 'muted'], ['file', t, ''], ['minutes_text', t, '']], (r) => r.id);
  });

  // ---------- member view ----------
  const memberRow = () => pick(ok('p_member'), where({ member: cur() }));
  dash.draw('mv', (el) => {
    const r = memberRow(); el.dataset.where = enc(where({ member: cur() }));
    el.textContent = r ? fmt[el.dataset.fmt](r[el.dataset.field]) : '—';
  });
  dash.draw('mgauge', (box) => {
    const r = memberRow(); box.dataset.where = enc(where({ member: cur() }));
    if (!r) { box.replaceChildren(); return; }
    const f = box.dataset.field, v = r[f];
    const sub = f === 'participation' ? `absent on ${fInt(+r.absent)} of ${fInt(+r.votes)}` : `${fInt(+r.with_majority)} of ${fInt(+r.split_votes_cast)} split votes`;
    gauge(box, v === '' ? null : +v, v === '' ? '—' : fPct(+v), sub);
  });
  dash.draw('mmeters', (box) => {
    const r = memberRow(); box.replaceChildren(); if (!r) return;
    const wrap = document.createElement('div'); wrap.style.display = 'grid'; wrap.style.gap = '.55rem'; wrap.style.marginTop = '.6rem';
    meterRow(wrap, 'Motions made', [[+r.motions_max ? +r.motions / +r.motions_max : 0, dash.colors[2]]], fInt(+r.motions));
    meterRow(wrap, 'Spoke in favor', [[Math.min(1, +r.spoke_favor / 50), dash.colors[0]]], fInt(+r.spoke_favor));
    meterRow(wrap, 'Pushback', [[+r.pushback_max ? +r.pushback / +r.pushback_max : 0, dash.colors[3]]], fInt(+r.pushback));
    meterRow(wrap, 'Dissents', [[+r.split_votes_cast ? +r.dissents / +r.split_votes_cast : 0, 'var(--color-bad)']], fInt(+r.dissents));
    box.appendChild(wrap);
  });
  dash.draw('ballot', (box) => {
    const r = memberRow(); box.replaceChildren(); if (!r) return;
    const W = Math.max(300, box.clientWidth), H = 56;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    let x = 0; const tip = tipIn(box);
    for (const [k, share, n] of [['yea', +r.yea_share, +r.yea], ['nay', +r.nay_share, +r.nay], ['absent', +r.absent_share, +r.absent]]) {
      const w = share * W; if (w <= 0) continue;
      svg.append('rect').attr('x', x).attr('y', 4).attr('width', w).attr('height', 26).attr('fill', k === 'absent' ? 'transparent' : color[k]()).attr('stroke', k === 'absent' ? 'var(--color-border-line)' : 'none')
        .on('mousemove', (ev) => showTip(box, tip, ev, k[0].toUpperCase() + k.slice(1), [`${fInt(n)} votes · ${fPct1(share)}`])).on('mouseleave', () => { tip.hidden = true; });
      if (w > 70) svg.append('text').attr('x', x + 6).attr('y', 48).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(`${k[0].toUpperCase() + k.slice(1)} ${fInt(n)}`);
      x += w;
    }
  });
  const hbars = (box, rows, valFn, labelFn, colorFn, tipFn, ref) => {
    box.replaceChildren();
    const W = Math.max(300, box.clientWidth), rh = 26;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, rows.map(labelFn), 11) + 10;
    const H = rows.length * rh + (ref ? 22 : 6); svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const max = Math.max(ref ? 2 : 0, d3.max(rows, valFn) || 1);
    const x = d3.scaleLinear([0, max], [left, W - 46]);
    const tip = tipIn(box);
    rows.forEach((r, i) => {
      const y = i * rh;
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(labelFn(r));
      svg.append('rect').attr('x', left).attr('y', y + 6).attr('width', W - 46 - left).attr('height', rh - 12).attr('rx', 3).attr('fill', 'var(--color-border-line)').attr('opacity', 0.5);
      svg.append('rect').attr('x', left).attr('y', y + 6).attr('width', Math.max(0, x(valFn(r)) - left)).attr('height', rh - 12).attr('rx', 3).attr('fill', colorFn(r));
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tip, ev, labelFn(r), tipFn(r))).on('mouseleave', () => { tip.hidden = true; });
      svg.append('text').attr('x', W - 40).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').attr('pointer-events', 'none').text(ref ? fmt.x(valFn(r)) : fPct(valFn(r)));
    });
    if (ref) {
      svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', rows.length * rh).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
      svg.append('text').attr('x', x(1)).attr('y', H - 5).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text('council average');
    }
  };
  dash.draw('topicvotes', (box) => {
    const all = ok('p_topic'); box.replaceChildren(); if (!all) return;
    const rows = all.filter((r) => r.member === cur() && r.from === range().from && r.to === range().to).map((r) => ({ ...r, yea: +r.yea, nay: +r.nay, absent: +r.absent, votes: +r.votes })).sort((a, b) => b.votes - a.votes);
    const W = Math.max(300, box.clientWidth), rh = 26;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, rows.map((r) => short(r.topic)), 11) + 10;
    const H = rows.length * rh + 6; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleLinear([0, d3.max(rows, (r) => r.votes) || 1], [left, W - 40]);
    const tip = tipIn(box);
    rows.forEach((r, i) => {
      const y = i * rh; let x0 = left;
      svg.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg)').text(short(r.topic));
      for (const k of ['yea', 'nay', 'absent']) {
        const w = x(r[k]) - x(0); if (w <= 0) continue;
        svg.append('rect').attr('x', x0).attr('y', y + 5).attr('width', w).attr('height', rh - 10).attr('fill', k === 'absent' ? 'transparent' : color[k]()).attr('stroke', k === 'absent' ? 'var(--color-border-line)' : 'none');
        x0 += w;
      }
      svg.append('text').attr('x', x0 + 6).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)').text(fInt(r.votes));
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tip, ev, r.topic, [`Yea ${fInt(r.yea)}`, `Nay ${fInt(r.nay)}`, `Absent ${fInt(r.absent)}`])).on('mouseleave', () => { tip.hidden = true; });
    });
  });
  dash.draw('focusbars', (box) => {
    const all = ok('p_focus'); if (!all) { box.replaceChildren(); return; }
    const rows = all.filter((r) => r.member === cur() && r.from === range().from && r.to === range().to && r.topic !== 'Other').sort((a, b) => +b.focus_index - +a.focus_index);
    hbars(box, rows, (r) => +r.focus_index, (r) => short(r.topic), (r) => (+r.focus_index >= 1 ? dash.colors[0] : 'var(--cds-chart-muted)'),
      (r) => [`${fInt(+r.lead_actions)} motions/remarks`, `${fPct(+r.member_share)} of theirs vs ${fPct(+r.council_share)} of the council's`], true);
  });
  dash.draw('allies', (box) => {
    const all = ok('p_agree'); if (!all) { box.replaceChildren(); return; }
    const m = cur();
    const rows = all.filter((r) => r.from === range().from && r.to === range().to && (r.a === m || r.b === m) && r.share !== '')
      .map((r) => ({ ...r, other: r.a === m ? r.b : r.a })).sort((a, b) => +b.share - +a.share);
    if (!rows.length) { box.replaceChildren(); const p = document.createElement('p'); p.className = 'note'; p.textContent = '—'; box.appendChild(p); return; }
    hbars(box, rows, (r) => +r.share, (r) => r.other, (r) => (+r.share >= 0.75 ? dash.colors[0] : +r.share >= 0.5 ? dash.colors[1] : 'var(--color-bad)'),
      (r) => [`Voted alike ${fPct(+r.share)}`, `${fInt(+r.agree)} of ${fInt(+r.n)} split votes`], false);
  });
  dash.draw('monthbars', (box) => {
    const all = ok('member_monthly'); box.replaceChildren(); if (!all) return;
    const rows = all.filter((r) => r.member === cur()).map((r) => ({ month: r.month, p: +r.participation, a: +r.absent, v: +r.votes, n: +r.nay }));
    const W = Math.max(300, box.clientWidth), H = 200, mg = { t: 10, r: 6, b: 24, l: 40 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleBand(rows.map((r) => r.month), [mg.l, W - mg.r]).padding(0.25);
    const y = d3.scaleLinear([0, 1], [H - mg.b, mg.t]);
    const ga = svg.append('g').attr('transform', `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(fPct).tickSize(-(W - mg.l - mg.r)));
    ga.attr('font-size', null).attr('font-family', null); ga.select('.domain').remove(); ga.selectAll('line').attr('stroke', 'var(--cds-chart-grid)'); ga.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 11);
    const gx = svg.append('g').attr('transform', `translate(0,${H - mg.b})`).call(d3.axisBottom(x).tickSize(0).tickFormat((mo) => monthName(mo)));
    gx.attr('font-size', null).attr('font-family', null); gx.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); gx.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 11).attr('dy', '1.2em');
    const tip = tipIn(box); const bw = Math.min(32, x.bandwidth());
    svg.selectAll('rect.b').data(rows).join('rect').attr('class', 'b').attr('x', (r) => x(r.month) + (x.bandwidth() - bw) / 2).attr('width', bw).attr('y', (r) => y(r.p)).attr('height', (r) => y(0) - y(r.p)).attr('rx', 3)
      .attr('fill', (r) => (r.p < 0.75 ? 'var(--cds-chart-status-critical)' : dash.colors[0])).attr('opacity', (r) => (inRange(r) ? 1 : 0.25))
      .on('mousemove', (ev, r) => showTip(box, tip, ev, monthName(r.month, '%B'), [`Participation ${fPct1(r.p)}`, `Absent on ${fInt(r.a)} of ${fInt(r.v)} votes`, `Nay ${fInt(r.n)}`]))
      .on('mouseleave', () => { tip.hidden = true; });
  });
  dash.draw('positions', (box) => {
    const all = ok('m_splits'); box.replaceChildren(); if (!all) return;
    const rows = all.filter((r) => r.member === cur() && inRange(r)).sort((a, b) => a.date.localeCompare(b.date));
    const W = Math.max(300, box.clientWidth), H = 150, mg = { l: 44, r: 16, t: 20, b: 26 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    if (!rows.length) { svg.append('text').attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', 'var(--color-fg-muted)').text('No split votes in these months'); return; }
    const { from, to } = range();
    const x = d3.scaleUtc([new Date(from + '-01T00:00:00Z'), d3.utcMonth.offset(new Date(to + '-01T00:00:00Z'), 1)], [mg.l, W - mg.r]);
    const ys = { Yea: mg.t + 18, Nay: H - mg.b - 18, Absent: (H - mg.b + mg.t) / 2 };
    for (const [k, yv] of Object.entries(ys)) {
      svg.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', yv).attr('y2', yv).attr('stroke', 'var(--cds-chart-grid)');
      svg.append('text').attr('x', mg.l - 6).attr('y', yv + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(k);
    }
    const gx = svg.append('g').attr('transform', `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(Math.min(10, Math.max(2, Math.floor(W / 80)))).tickFormat(d3.utcFormat('%b')).tickSize(0));
    gx.attr('font-size', null).attr('font-family', null); gx.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); gx.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 11).attr('dy', '1.2em');
    const tip = tipIn(box); const seen = {};
    for (const r of rows) {
      const k = r.date + r.vote; seen[k] = (seen[k] || 0) + 1;
      const cx = x(new Date(r.date + 'T12:00:00Z')) + (seen[k] - 1) * 12, cy = ys[r.vote];
      const won = r.with_majority === 'Yes';
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 7)
        .attr('fill', r.vote === 'Absent' ? 'transparent' : won ? (r.vote === 'Yea' ? color.yea() : color.nay()) : 'var(--color-panel)')
        .attr('stroke', r.vote === 'Yea' ? color.yea() : r.vote === 'Nay' ? color.nay() : 'var(--color-fg-muted)').attr('stroke-width', 2)
        .on('mousemove', (ev) => showTip(box, tip, ev, r.date, [r.issue, `Voted ${r.vote} · ${r.tally} · ${r.outcome}`, r.with_majority === 'No' ? 'On the losing side' : r.with_majority === 'Yes' ? 'With the majority' : 'Absent']))
        .on('mouseleave', () => { tip.hidden = true; });
    }
  });
})();
