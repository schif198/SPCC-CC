(() => {
  const M = ['Noecker', 'Yang', 'Kim', 'Bowie', 'Jost', 'Johnson', 'Coleman'];
  const FILL = ['#fbefe8', '#f8c1a4', '#f15a25', '#a33a0a'];
  const TEXT = ['#6b6478', '#5a2306', '#22182c', '#ffffff'];
  const RING = '#2a0157';
  const LBL = ['None recorded', 'Some', 'Active', 'Leading'];
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (v) => Math.round(+v * 100) + '%';
  const dfmt = (s) => d3.utcFormat('%b %-d')(new Date(s + 'T00:00:00Z'));
  const P = () => dash.params();
  const cur = () => (M.includes(P().member) ? P().member : 'Noecker');
  const themes = () => { const t = ok('pv_theme'); return t ? t.map((r) => r.theme) : []; };
  const curTheme = () => { const t = themes(); return t.includes(P().theme) ? P().theme : (t[0] || ''); };
  const tipIn = (box) => { const t = el('div', 'tip'); t.hidden = true; box.appendChild(t); return t; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(el('b', '', head)); lines.forEach((l) => tip.appendChild(el('div', '', l)));
    const b = box.getBoundingClientRect(); tip.hidden = false;
    let x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
    if (x + tip.offsetWidth > b.width) x = ev.clientX - b.left - tip.offsetWidth - 14;
    tip.style.left = Math.max(0, x) + 'px'; tip.style.top = y + 'px';
  };

  // ---------- KPI tiles ----------
  dash.draw('kpis', (box) => {
    const c = ok('pv_cells'), p = ok('pv_platforms'), t = ok('pv_theme'); box.replaceChildren(); if (!c || !p || !t) return;
    const st = c.filter((r) => r.stated === 'Yes'); const act = st.filter((r) => +r.level >= 2);
    const top = t.slice().sort((a, b) => +b.members_stated - +a.members_stated)[0];
    const busy = t.slice().sort((a, b) => +b.lead_share - +a.lead_share)[0];
    const tiles = [[String(st.length), 'Campaign priorities'], [pct(act.length / (st.length || 1)), 'Priorities with an active record'],
      [top ? top.theme : '—', `Most-promised (${top ? top.members_stated : 0} of 7)`], [busy ? busy.theme : '—', `Most debated (${busy ? pct(busy.lead_share) : ''})`]];
    for (const [v, l] of tiles) { const k = el('div', 'kpi'); const kv = el('div', 'kv', v); if (v.length > 6) kv.style.fontSize = '1.25rem'; k.append(kv, el('div', 'kl', l)); box.appendChild(k); }
  });

  // ---------- matrix ----------
  dash.draw('matrix', (box) => {
    const c = ok('pv_cells'); box.replaceChildren(); if (!c) return;
    const T = themes(); const sel = cur(), selT = curTheme();
    const W = Math.max(560, box.clientWidth), left = Math.min(190, W * 0.3), top = 34;
    const cw = (W - left - 8) / M.length, ch = Math.min(46, Math.max(34, cw * 0.62)), H = top + ch * T.length + 6;
    const narrow = box.clientWidth < 560; box.style.overflowX = narrow ? 'auto' : '';
    const svg = d3.select(box).append('svg').attr('width', narrow ? W : '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', 'Campaign priorities and council activity by member and theme');
    const tip = tipIn(box);
    M.forEach((m, j) => {
      const x = left + j * cw + cw / 2;
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => dash.setParams({ member: m }));
      if (m === sel) g.append('rect').attr('x', left + j * cw + 2).attr('y', 2).attr('width', cw - 4).attr('height', H - 4).attr('rx', 10).attr('fill', 'none').attr('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      g.append('text').attr('x', x).attr('y', 22).attr('text-anchor', 'middle').attr('font-size', 13).attr('font-weight', m === sel ? 700 : 500).attr('fill', 'var(--color-fg)').text(m);
    });
    T.forEach((t, i) => {
      const y = top + i * ch;
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => dash.setParams({ theme: t }));
      g.append('text').attr('x', left - 10).attr('y', y + ch / 2 + 4).attr('text-anchor', 'end').attr('font-size', 13).attr('font-weight', t === selT ? 700 : 400).attr('fill', 'var(--color-fg)').text(t);
      if (t === selT) g.append('rect').attr('x', 2).attr('y', y + 2).attr('width', left - 6).attr('height', ch - 4).attr('rx', 6).attr('fill', 'var(--color-border-line)').attr('opacity', .5).lower();
      M.forEach((m, j) => {
        const r = c.find((x) => x.member === m && x.theme === t); if (!r) return;
        const lv = +r.level, cx = left + j * cw + cw / 2, cy = y + ch / 2, s = Math.min(cw, ch) - 10;
        const cg = svg.append('g').style('cursor', 'pointer').on('click', () => dash.setParams({ member: m, theme: t }))
          .on('pointermove', (ev) => showTip(box, tip, ev, `${m} · ${t}`, [r.stated === 'Yes' ? 'Campaigned on it' : 'Not in campaign platform', `${LBL[lv]}: ${r.lead} motions/remarks`, `${r.votes} votes · ${r.nay} nay · ${r.absent} absent`]))
          .on('pointerleave', () => { tip.hidden = true; });
        const rad = Math.min(s / 2, 17);
        cg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rad).attr('fill', FILL[lv]).attr('stroke', lv === 0 ? '#f0d9cc' : 'none');
        if (r.stated === 'Yes') cg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rad + 3.5).attr('fill', 'none').attr('stroke', RING).attr('stroke-width', 3);
        cg.append('text').attr('x', cx).attr('y', cy + 4).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600).attr('fill', TEXT[lv]).text(+r.lead || '');
      });
    });
  });

  // ---------- member chips + panel ----------
  dash.draw('memberchips', (box) => {
    box.replaceChildren();
    for (const m of M) { const b = el('button', 'chip', m); b.type = 'button'; b.setAttribute('aria-pressed', m === cur() ? 'true' : 'false'); b.addEventListener('click', () => dash.setParams({ member: m })); box.appendChild(b); }
  });
  dash.draw('member', (box) => {
    const c = ok('pv_cells'), p = ok('pv_platforms'); box.replaceChildren(); if (!c || !p) return;
    const m = cur(); const rows = c.filter((r) => r.member === m); const plat = p.filter((r) => r.member === m);
    const st = rows.filter((r) => r.stated === 'Yes'); const act = st.filter((r) => +r.level >= 2);
    const W = Math.max(320, box.clientWidth);
    // header: gauge
    const head = el('div'); head.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:8px';
    const g = d3.select(head).append('svg').attr('width', 74).attr('height', 74).attr('viewBox', '0 0 74 74');
    const arc = d3.arc().innerRadius(26).outerRadius(35);
    g.append('path').attr('transform', 'translate(37,37)').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI })).attr('fill', '#f1e8f0');
    g.append('path').attr('transform', 'translate(37,37)').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI * (act.length / (st.length || 1)) })).attr('fill', '#f15a25');
    g.append('text').attr('x', 37).attr('y', 42).attr('text-anchor', 'middle').attr('font-size', 16).attr('font-weight', 600).attr('data-fit', 46).attr('font-family', 'var(--font-anthropic-serif)').attr('fill', 'var(--color-fg)').text(`${act.length}/${st.length}`);
    const ht = el('div'); ht.append(el('div', '', '')); ht.firstChild.style.cssText = 'font-family:var(--font-anthropic-serif);font-size:1.4rem';
    ht.firstChild.textContent = m; const pl = plat[0];
    ht.appendChild(el('div', 'note', `${pl ? pl.ward + ' · elected ' + pl.election : ''} · ${act.length} of ${st.length} priorities with an active record`));
    head.appendChild(ht); box.appendChild(head);
    // rows for stated themes
    const lmax = Math.max(1, ...rows.map((r) => +r.lead));
    const list = el('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    for (const r of st.sort((a, b) => +b.level - +a.level || +b.lead - +a.lead)) {
      const lv = +r.level; const row = el('div', 'pv-row');
      row.addEventListener('click', () => dash.setParams({ theme: r.theme }));
      const nm = el('div'); nm.appendChild(el('div', '', r.theme)); nm.firstChild.style.fontWeight = '600'; nm.firstChild.style.fontSize = '.9rem';
      const pr = plat.find((x) => x.theme === r.theme); if (pr) { const s = el('div', 'note', `“${pr.statement}”`); s.style.margin = '0'; nm.appendChild(s); }
      const chip = el('span', '', LBL[lv]); chip.style.cssText = `display:inline-block;text-align:center;font-size:.75rem;font-weight:600;padding:3px 8px;border-radius:999px;background:${FILL[lv]};color:${TEXT[lv]};border:${lv ? 'none' : '1px solid #c9d3e3'}`;
      const barw = el('div'); const tr = el('div'); tr.style.cssText = 'height:8px;border-radius:4px;background:#f1e8f0;overflow:hidden';
      const f = el('div'); f.style.cssText = `height:100%;width:${(+r.lead / lmax) * 100}%;background:#f15a25`; tr.appendChild(f);
      const lab = el('div', 'note', `${r.lead} motions/remarks · ${r.votes} votes, ${r.nay} nay`); lab.style.margin = '2px 0 0';
      barw.append(tr, lab);
      row.append(nm, chip, barw); list.appendChild(row);
    }
    box.appendChild(list);
    const extra = rows.filter((r) => r.stated === 'No' && +r.level >= 2).sort((a, b) => +b.level - +a.level || +b.lead - +a.lead);
    if (extra.length) {
      const ex = el('div'); ex.style.marginTop = '12px';
      ex.appendChild(el('div', 'note', 'Also active on (not in platform):'));
      const ch = el('div', 'chips');
      extra.forEach((r) => { const b = el('button', 'chip', `${r.theme} · ${r.lead}`); b.type = 'button'; b.style.background = FILL[+r.level]; b.style.color = TEXT[+r.level]; b.style.borderColor = FILL[+r.level]; b.addEventListener('click', () => dash.setParams({ theme: r.theme })); ch.appendChild(b); });
      ex.appendChild(ch); box.appendChild(ex);
    }
  });

  // ---------- council chart ----------
  dash.draw('council', (box) => {
    const t = ok('pv_theme'); box.replaceChildren(); if (!t) return;
    const W = Math.max(300, box.clientWidth), rh = 34, H = rh * t.length + 26, fs = W < 420 ? 11 : 12.5;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    let lw = 0; for (const r of t) { const n = svg.append('text').attr('font-size', fs).attr('font-weight', 700).text(r.theme); lw = Math.max(lw, n.node().getComputedTextLength()); n.remove(); }
    const left = Math.min(W * 0.5, lw + 14);
    const tip = tipIn(box);
    const pipW = 9, pipsW = 7 * pipW + 6, bx = left + pipsW + 14, bw = W - bx - 40;
    const mx = d3.max(t, (r) => +r.lead_share) || 1;
    // column meaning is shown in the key above the chart
    t.forEach((r, i) => {
      const y = 22 + i * rh, cy = y + rh / 2;
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => dash.setParams({ theme: r.theme }))
        .on('pointermove', (ev) => showTip(box, tip, r.theme, [`${r.members_stated} of 7 campaigned on it`, `${pct(r.lead_share)} of motions and remarks`, `${r.votes} votes · ${r.splits} split`]))
        .on('pointerleave', () => { tip.hidden = true; });
      g.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent');
      g.append('text').attr('x', left - 8).attr('y', cy + 4).attr('text-anchor', 'end').attr('font-size', fs).attr('font-weight', r.theme === curTheme() ? 700 : 400).attr('fill', 'var(--color-fg)').text(r.theme);
      for (let k = 0; k < 7; k++) g.append('circle').attr('cx', left + k * pipW + 4).attr('cy', cy).attr('r', 3.6).attr('fill', k < +r.members_stated ? RING : 'none').attr('stroke', RING).attr('stroke-width', 1.2);
      g.append('rect').attr('x', bx).attr('y', cy - 6).attr('width', bw).attr('height', 12).attr('rx', 6).attr('fill', '#f1e8f0');
      g.append('rect').attr('x', bx).attr('y', cy - 6).attr('width', bw * (+r.lead_share / mx)).attr('height', 12).attr('rx', 6).attr('fill', '#f15a25');
      g.append('text').attr('x', bx + bw + 6).attr('y', cy + 4).attr('font-size', 11.5).attr('fill', 'var(--color-fg)').text(pct(r.lead_share));
    });
  });

  // ---------- related votes ----------
  dash.draw('itemstitle', (h) => { h.textContent = `Related votes: ${curTheme()}`; });
  dash.draw('itemrows', (tb) => {
    const it = ok('pv_items'); tb.replaceChildren(); if (!it) return;
    for (const r of it.filter((x) => x.theme === curTheme()).slice(0, 40)) {
      const tr = el('tr'); tr.dataset.key = r.id;
      tr.append(el('td', '', dfmt(r.date)), el('td', '', r.file), el('td', '', r.title), el('td', '', r.tally + (r.nays ? ` (nay: ${r.nays})` : '')), el('td', '', r.movers || '—'));
      tb.appendChild(tr);
    }
  });

  dash.draw('sources', (ul) => {
    const p = ok('pv_platforms'); ul.replaceChildren(); if (!p) return;
    for (const m of M) {
      const rs = p.filter((r) => r.member === m); if (!rs.length) continue;
      const li = el('li'); li.appendChild(el('b', '', m + ': '));
      const srcs = [...new Map(rs.map((r) => [r.source_url, r.source_title])).entries()];
      srcs.forEach(([u, t], i) => { const a = el('a', '', t); a.href = u; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); if (i < srcs.length - 1) li.append('; '); });
      ul.appendChild(li);
    }
  });
})();
