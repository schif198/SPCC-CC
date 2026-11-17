(() => {
  const M = ['Noecker', 'Yang', 'Kim', 'Bowie', 'Jost', 'Johnson', 'Coleman'];
  const fInt = d3.format(','), fPct = d3.format('.0%');
  const fmt = { int: (v) => fInt(+v), pct: (v) => fPct(+v) };
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const cur = () => dash.params().member || 'All';
  const date = (s, f = '%b %-d') => d3.utcFormat(f)(new Date(s + 'T00:00:00Z'));
  const ISSUES = ['Labor & wages', 'Housing & tenant rules', 'Economic development & incentives', 'Licensing & enforcement', 'Land use & permitting', 'Utilities, franchises & fees', 'Taxes, levies & assessments', 'Events, festivals & sound permits'];
  const issueColor = (i) => dash.colors[ISSUES.indexOf(i) % dash.colors.length];
  const color = { yea: () => dash.colors[0], nay: () => '#2a0157', absent: () => 'transparent', adopted: () => dash.colors[0], failed: () => 'var(--color-bad)', other: () => 'var(--cds-chart-muted)' };
  document.querySelectorAll('.pb [data-sw]').forEach((el) => { if (color[el.dataset.sw]) el.style.background = color[el.dataset.sw](); });
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
    g.append('text').attr('y', -r * 0.18).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', Math.max(18, r * 0.40)).attr('font-weight', 600).attr('data-fit', r * 0.74 * 1.7).attr('fill', 'var(--color-fg)').text(label);
    if (sub) g.append('text').attr('y', 0).attr('text-anchor', 'middle').attr('font-size', 10).attr('data-fit', r * 0.74 * 1.9).attr('fill', 'var(--color-fg-muted)').text(sub);
  };
  const bigNum = (box, label, sub) => {
    box.replaceChildren();
    const W = Math.max(140, box.clientWidth), H = 100;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    svg.append('text').attr('x', W / 2).attr('y', 60).attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', 44).attr('font-weight', 600).attr('data-fit', W - 16).attr('fill', 'var(--color-fg)').text(label);
    if (sub) svg.append('text').attr('x', W / 2).attr('y', 86).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('data-fit', W - 16).attr('fill', 'var(--color-fg-muted)').text(sub);
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
  // ---------- next-agenda items: card → pop-up summary ----------
  const lname = (s) => d3.utcFormat('%A, %B %-d')(new Date(s + 'T00:00:00Z'));
  const dayBefore = (s) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d3.utcFormat('%A, %B %-d')(d); };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const linkTo = (href, text, ext) => { const a = h('a', 'wd-link', text); a.href = href; if (ext) { a.target = '_blank'; a.rel = 'noopener'; } return a; };
  let dlg = null;
  const openWatch = (r) => {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'wd'; document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    }
    dlg.replaceChildren();
    const hist = (ok('b_watch_hist') || []).filter((x) => x.file === r.file).sort((a, b) => a.date.localeCompare(b.date));
    const iss = (ok('b_issues') || []).find((x) => x.issue === r.issue);
    const im = (ok('b_issue_member') || []).filter((x) => x.issue === r.issue && +x.lead > 0).sort((a, b) => +b.lead - +a.lead);
    const full = hist.length ? hist[hist.length - 1].title : r.item;

    const top = h('div', 'wd-top'); top.style.borderTopColor = issueColor(r.issue);
    const x = h('button', 'wd-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => dlg.close());
    const kick = h('div', 'wd-kick', `${r.file} · ${r.stage} · ${lname(r.next_meeting)}`);
    const t = h('h2', 'wd-t', r.short || full.replace(/\.$/, '')); const ft = h('p', 'wd-full', full);
    const chips = h('div', 'wd-chips'); const ic = h('span', 'tag', r.issue); ic.style.borderColor = issueColor(r.issue); chips.appendChild(ic); lensChips(chips, r.persia);
    top.append(x, kick, t, ft, chips); dlg.appendChild(top);
    let pbSlot = h('div', 'wd-actions'); top.appendChild(pbSlot);

    const body = h('div', 'wd-body');
    // summary
    const sum = h('section', 'wd-sec'); sum.appendChild(h('h3', '', 'Summary'));
    const ul = h('ul', 'wd-sum');
    const li = (parts) => { const l = h('li'); for (const p of parts) l.append(p); ul.appendChild(l); };
    const B = (s) => h('b', '', s);
    li([B(`${r.stage} on ${lname(r.next_meeting)}.`), ` Written comments are due by noon ${dayBefore(r.next_meeting)} to be attached to the public record.`]);
    if (hist.length) {
      const f0 = hist[0];
      li(['First seen in the minutes ', B(date(f0.date, '%B %-d')), hist.length > 1 ? `; it has come before the council ${hist.length} times since.`.replace(' since.', '.') : '.']);
      const amended = hist.some((x) => /amend|version/i.test(x.action + ' ' + x.notes));
      if (amended) li([B('Amended along the way'), ', so the current language may differ from the original.']);
    }
    li([r.last_tally === 'no roll call yet' ? B('No roll-call vote yet.') : ['Last roll call: ', B(r.last_tally), ` on ${date(r.last_action_date, '%B %-d')}.`]].flat());
    if (iss && iss.unanimous_share !== '') {
      const u = +iss.unanimous_share;
      li([`${r.issue} items passed with no dissent `, B(fPct(u)), ` of the time this year (${fInt(+iss.splits)} split vote${+iss.splits === 1 ? '' : 's'}). `, u < 1 ? 'This is an issue that has divided the council, so early outreach can change the outcome.' : 'These almost always pass unanimously, so the time to shape the details is before the final vote.']);
    }
    if (r.persia) li(['Reads through the ', B(r.persia.replace(' · ', ' and ')), ` lens${r.persia.includes('·') ? 'es' : ''}: frame the ask in those terms.`]);
    sum.appendChild(ul); body.appendChild(sum);

    // who to call
    if (im.length) {
      const wc = h('section', 'wd-sec'); wc.appendChild(h('h3', '', `Who carries ${shortIssue(r.issue).toLowerCase()} items`));
      const row = h('div', 'wd-who');
      im.slice(0, 4).forEach((x, i) => { const c = h('div', 'wd-pc' + (i === 0 ? ' first' : '')); c.append(h('b', '', x.member), h('span', '', `${fInt(+x.lead)} motion${+x.lead === 1 ? '' : 's'}/remark${+x.lead === 1 ? '' : 's'}${+x.pushback ? ` · ${fInt(+x.pushback)} pushback` : ''}`)); row.appendChild(c); });
      wc.appendChild(row); body.appendChild(wc);
    }

    // history
    if (hist.length) {
      const hs = h('section', 'wd-sec'); hs.appendChild(h('h3', '', 'How it got here'));
      const ol = h('ol', 'wd-tl');
      for (const e of hist) {
        const l = h('li');
        const d = h('div', 'wd-d'); d.append(h('b', '', date(e.date, '%b %-d')), e.tally ? h('span', 'wd-tally', e.tally) : '');
        const a = h('div', 'wd-a', e.action || 'On the agenda');
        l.append(d, a);
        if (e.notes) l.appendChild(h('div', 'wd-n', e.notes));
        l.appendChild(linkTo('minutes/' + encodeURIComponent(e.pdf), 'Read these minutes (PDF) ↗', true));
        ol.appendChild(l);
      }
      hs.appendChild(ol); body.appendChild(hs);
    }

    // read more
    const rm = h('section', 'wd-sec wd-more'); rm.appendChild(h('h3', '', 'Read more'));
    const links = h('div', 'wd-links');
    const last = hist[hist.length - 1];
    if (last) { const a = linkTo('minutes/' + encodeURIComponent(last.pdf), `Latest minutes (${date(last.date, '%b %-d')}) ↗`, true); a.classList.add('primary'); links.appendChild(a); }
    links.appendChild(linkTo('library.html#q=' + encodeURIComponent(r.file), `Every mention of ${r.file} in the minutes library`));
    const lg = linkTo(window.__LEGISTAR__ || 'https://stpaul.legistar.com/Legislation.aspx', 'Full text and attachments on the city’s Legistar site ↗', true); links.appendChild(lg);
    rm.appendChild(links);
    rm.appendChild(h('p', 'wd-hint', `On Legistar, search for “${r.file}” to see the ordinance text, staff report and attachments.`));
    const pb = h('button', 'wd-print', ''); pb.type = 'button';
    pb.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg><span>Print one-pager</span>';
    pb.addEventListener('click', () => {
      if (!window.__printItem) return;
      dlg.close();
      window.addEventListener('afterprint', () => openWatch(r), { once: true });
      window.__printItem(r);
    });
    pbSlot.appendChild(pb);
    body.appendChild(rm);
    dlg.appendChild(body);
    dlg.showModal(); x.focus();
  };
  dash.draw('watch', (box) => {
    const rows = ok('b_watch'); box.replaceChildren(); if (!rows) return;
    for (const r of rows) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'wcard'; c.style.borderLeftColor = issueColor(r.issue);
      c.setAttribute('aria-haspopup', 'dialog'); c.title = 'Open the full summary';
      const when = document.createElement('div'); when.className = 'when'; when.textContent = `${date(r.next_meeting, '%a, %b %-d')} · ${r.stage}`;
      const head = h('div', 'whead', r.short || r.item);
      const what = document.createElement('div'); what.className = 'what'; what.textContent = r.item.replace(/\s+\S*$/, '') + '…';
      const meta = document.createElement('div'); meta.className = 'wmeta';
      const t1 = document.createElement('span'); t1.className = 'tag'; t1.textContent = r.issue; t1.style.borderColor = issueColor(r.issue); t1.style.borderWidth = '2px';
      const t2 = document.createElement('span'); t2.className = 'tag'; t2.textContent = r.file;
      meta.append(t1, t2); lensChips(meta, r.persia);
      const last = document.createElement('div'); last.className = 'small';
      last.textContent = r.last_tally === 'no roll call yet' ? 'No roll-call vote yet' : `Last roll call ${r.last_tally} (${date(r.last_action_date)})`;
      const more = h('div', 'wmore', 'Full summary and links →');
      c.append(when, head, what, meta, last, more); c.addEventListener('click', () => openWatch(r)); box.appendChild(c);
    }
  });


  // ---------- PERSIA ----------
  const LENSES = ['Political', 'Economic', 'Religious', 'Social', 'Intellectual', 'Artistic'];
  const lensColor = (l) => dash.colors[LENSES.indexOf(l) % dash.colors.length];
  const lensChips = (parent, str) => {
    for (const l of (str || '').split(' · ').filter(Boolean)) { const s = document.createElement('span'); s.className = 'tag'; s.style.borderColor = lensColor(l); s.textContent = l; parent.appendChild(s); }
  };
  // ---------- shared focus: one PERSIA lens and/or one business issue at a time ----------
  const F = { lens: null, issue: null };
  window.__PB__ = { F, lensColor: (l) => lensColor(l), issueColor: (i) => issueColor(i), member: () => cur(), LENSES };
  const refocus = () => dash.setParams({});
  const dimmed = (m, l, key) => (cur() !== 'All' && m && m !== cur()) || (F[key] && l && l !== F[key]);
  (() => { // CSS for focusing one lens in the coalition radars
    const st = document.createElement('style');
    st.textContent = '#coalition[data-focus] .rad [data-l]{opacity:.18;transition:opacity .15s}#coalition[data-focus] .rad line[data-l]{stroke-dasharray:2 3}#coalition[data-focus] .rad .shape{fill-opacity:.08}.rad .rv{display:none}'
      + LENSES.map((l) => `#coalition[data-focus="${l}"] .rad [data-l="${l}"]{opacity:1}#coalition[data-focus="${l}"] .rad line[data-l="${l}"]{stroke:${lensColor(l)};stroke-width:2.5;stroke-dasharray:none}#coalition[data-focus="${l}"] .rad .rv[data-l="${l}"]{display:block}#coalition[data-focus="${l}"] .lenspick [data-l="${l}"]{background:${lensColor(l)};color:#fff;border-color:${lensColor(l)}}`).join('');
    document.head.appendChild(st);
  })();
  const setFocusAttr = (l) => { const s = document.getElementById('coalition'); if (s) { if (l) s.dataset.focus = l; else delete s.dataset.focus; } };

  // ---------- PERSIA tiles ----------
  const noteRich = (note) => {
    const tx = document.createElement('div'); tx.className = 'tx';
    const i = note.indexOf('. '); const first = i > 0 ? note.slice(0, i + 1) : note, rest = i > 0 ? note.slice(i + 2) : '';
    const items = first.replace(/\.$/, '').split(/, such as |, | and | or |^Items involving /).map((x) => x.trim()).filter(Boolean);
    const inc = document.createElement('div'); inc.className = 'inc';
    inc.append(Object.assign(document.createElement('span'), { className: 'inc-l', textContent: 'Includes: ' }), items.map((x, k) => k ? x : x[0].toUpperCase() + x.slice(1)).join(', '));
    const use = document.createElement('div'); use.className = 'tx use';
    if (rest) { const it = document.createElement('i'); it.textContent = rest; use.appendChild(it); }
    tx.appendChild(inc);
    return [tx, use];
  };
  dash.draw('persia', (box) => {
    const rows = ok('b_persia'); box.replaceChildren(); if (!rows) return;
    for (const l of LENSES) {
      const r = rows.find((x) => x.lens === l); if (!r) continue;
      const on = F.lens === l;
      const c = document.createElement('div'); c.className = 'ptile' + (on ? ' on' : '') + (F.lens && !on ? ' off' : ''); c.style.borderTopColor = lensColor(l); c.style.setProperty('--lc', lensColor(l));
      c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-pressed', String(on));
      c.title = on ? 'Clear the lens focus' : `Focus the ${l} lens on the coalition map and lens map`;
      const pickL = () => { F.lens = on ? null : l; refocus(); };
      c.addEventListener('click', (e) => { if (e.target.closest('a')) return; pickL(); });
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickL(); } });
      c.addEventListener('mouseenter', () => setFocusAttr(l)); c.addEventListener('mouseleave', () => setFocusAttr(F.lens));
      const head = document.createElement('div'); head.style.display = 'flex'; head.style.alignItems = 'baseline'; head.style.gap = '.5rem';
      const big = document.createElement('span'); big.className = 'big'; big.textContent = r.letter; big.style.color = lensColor(l);
      const ln = document.createElement('span'); ln.className = 'ln'; ln.textContent = l;
      head.append(big, ln);
      const g = document.createElement('div'); g.className = 'chart gauge'; g.style.minHeight = '5rem';
      const stats = document.createElement('div'); stats.className = 'small';
      stats.append(Object.assign(document.createElement('b'), { textContent: fInt(+r.votes) }), ' votes · ', Object.assign(document.createElement('b'), { textContent: fInt(+r.splits) }), ' split');
      const ch = document.createElement('div'); ch.className = 'small';
      ch.append('Leads: ', Object.assign(document.createElement('b'), { textContent: r.champion_1 }), ` (${fInt(+r.champion_1_n)}), `, Object.assign(document.createElement('b'), { textContent: r.champion_2 }), ` (${fInt(+r.champion_2_n)})`);
      const act = h('div', 'pact');
      if (on) {
        act.append(h('span', 'pon', 'Focused ✓'));
        for (const [href, txt] of [['#coalition', 'Coalition map'], ['#issues', 'Lens map']]) { const a = h('a', '', txt + ' ↓'); a.href = href; a.addEventListener('click', (e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); act.appendChild(a); }
      } else act.append(h('span', 'poff', 'Click to focus this lens'));
      ch.classList.add('leads-l');
      c.append(head, ch, g, stats, ...noteRich(r.note), act); box.appendChild(c);
      requestAnimationFrame(() => gauge(g, r.unanimous_share === '' ? null : +r.unanimous_share, r.unanimous_share === '' ? '—' : fPct(+r.unanimous_share), 'no dissent'));
    }
  });

  // ---------- comparison bars under a map ----------
  const compare = (box, o) => {
    const wrap = document.createElement('div'); wrap.className = 'cmp';
    if (!o.items) {
      const h = document.createElement('div'); h.className = 'cmp-hint'; h.textContent = o.hint; wrap.appendChild(h);
      const chips = document.createElement('div'); chips.className = 'cmp-chips';
      for (const c of o.choices) { const b = document.createElement('button'); b.type = 'button'; b.className = 'cmp-chip'; b.style.borderColor = c.color; b.textContent = c.label; b.addEventListener('click', c.pick); chips.appendChild(b); }
      wrap.appendChild(chips); box.appendChild(wrap); return;
    }
    const hd = document.createElement('div'); hd.className = 'cmp-h';
    const t = document.createElement('b'); t.textContent = o.title; t.style.borderLeftColor = o.color; hd.appendChild(t);
    const x = document.createElement('button'); x.type = 'button'; x.className = 'cmp-x'; x.textContent = 'Clear ×'; x.addEventListener('click', o.clear); hd.appendChild(x);
    wrap.appendChild(hd);
    const max = Math.max(o.ref || 0, ...o.items.map((d) => d.v)) || 1;
    for (const d of o.items) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'cmp-row' + (cur() === d.m ? ' sel' : '');
      row.title = cur() === d.m ? 'Show all members' : `Spotlight ${d.m}`;
      row.addEventListener('click', () => dash.setParams({ member: cur() === d.m ? 'All' : d.m }));
      const k = document.createElement('span'); k.className = 'k'; k.textContent = d.m;
      const tr = document.createElement('span'); tr.className = 'tr';
      const bar = document.createElement('span'); bar.style.width = (d.v / max * 100) + '%'; bar.style.background = o.color; tr.appendChild(bar);
      if (o.ref) { const rf = document.createElement('i'); rf.style.left = (o.ref / max * 100) + '%'; tr.appendChild(rf); }
      const v = document.createElement('span'); v.className = 'v'; v.textContent = d.label;
      row.append(k, tr, v); wrap.appendChild(row);
    }
    if (o.foot) { const f = document.createElement('div'); f.className = 'cmp-foot'; f.textContent = o.foot; wrap.appendChild(f); }
    box.appendChild(wrap);
  };
  // column headers: click a member to spotlight them; the selected one becomes a filled pill
  const memberHeads = (svg, left, cw, H) => {
    const sel = cur();
    if (sel !== 'All') { const j = M.indexOf(sel); svg.append('rect').attr('x', left + j * cw).attr('y', 1).attr('width', cw).attr('height', H - 2).attr('rx', 8).attr('fill', 'rgba(42,1,87,.05)').attr('stroke', '#2a0157').attr('stroke-width', 2); }
    M.forEach((m, j) => {
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => dash.setParams({ member: sel === m ? 'All' : m }));
      g.append('title').text(sel === m ? 'Show all members' : `Spotlight ${m}`);
      const lab = cw < 52 ? m.slice(0, 3) : m;
      if (sel === m) g.append('rect').attr('x', left + j * cw + 4).attr('y', 4).attr('width', cw - 8).attr('height', 18).attr('rx', 9).attr('fill', '#2a0157');
      g.append('rect').attr('x', left + j * cw).attr('y', 2).attr('width', cw).attr('height', 22).attr('fill', 'transparent');
      g.append('text').attr('x', left + j * cw + cw / 2).attr('y', 17).attr('text-anchor', 'middle').attr('font-size', cw < 38 ? 9 : 11).attr('font-weight', sel === m ? 700 : 500)
        .attr('fill', sel === m ? '#fff' : (sel !== 'All' ? 'var(--color-fg-muted)' : 'var(--color-fg)')).text(lab);
    });
  };
  // row labels: click to focus one row; the focused one gets a colored marker
  const rowLabel = (svg, left, y, rh, text, color, on, onClick, tipText) => {
    const g = svg.append('g').style('cursor', 'pointer').on('click', onClick); g.append('title').text(tipText);
    g.append('rect').attr('x', 0).attr('y', y).attr('width', left - 2).attr('height', rh).attr('fill', 'transparent');
    if (on) g.append('rect').attr('x', 0).attr('y', y + 5).attr('width', 4).attr('height', rh - 10).attr('rx', 2).attr('fill', color);
    g.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('font-weight', on ? 700 : 400).attr('fill', 'var(--color-fg)').attr('text-decoration', on ? null : 'underline').attr('text-decoration-color', 'var(--color-border-line)').text(text);
  };

  // ---------- PERSIA lens map ----------
  dash.draw('lensmap', (box) => {
    const rows = ok('b_persia_member'); box.replaceChildren(); if (!rows) return;
    const W = Math.max(300, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, LENSES, 11) + 22;
    const top = 28, rh = 32, cw = (W - left) / M.length, H = top + LENSES.length * rh + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const lo = '#ffffff';
    const idx = new Map(rows.map((r) => [r.member + '|' + r.lens, r]));
    const tip = tipIn(box);
    memberHeads(svg, left, cw, H);
    LENSES.forEach((l, i) => {
      const y = top + i * rh; const ramp = d3.interpolateRgb(lo, lensColor(l));
      rowLabel(svg, left, y, rh, l, lensColor(l), F.lens === l, () => { F.lens = F.lens === l ? null : l; refocus(); }, F.lens === l ? 'Clear lens focus' : `Compare members on the ${l} lens`);
      M.forEach((m, j) => {
        const r = idx.get(m + '|' + l); if (!r) return; const v = +r.index, n = +r.lead; const op = dimmed(m, l, 'lens') ? 0.22 : 1;
        svg.append('rect').attr('x', left + j * cw + 2).attr('y', y + 2).attr('width', Math.max(0, cw - 4)).attr('height', rh - 4).attr('rx', 3).attr('opacity', op)
          .attr('fill', n ? ramp(Math.min(1, 0.1 + v / 2.2)) : 'transparent').attr('stroke', 'var(--color-border-line)').attr('stroke-opacity', n ? 0 : 1).style('cursor', 'pointer')
          .on('click', () => { F.lens = l; dash.setParams({ member: m }); })
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${l}`, [`${fInt(n)} motions/remarks (${fPct(+r.share)} of theirs vs ${fPct(+r.council_share)} council-wide)`, `${fInt(+r.nay)} nay · ${fInt(+r.absent)} absent of ${fInt(+r.votes)} votes · ${fInt(+r.pushback)} pushback`, 'Click to spotlight']))
          .on('mouseleave', () => { tip.hidden = true; });
        if (n && cw > 34) svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('opacity', op).attr('pointer-events', 'none').attr('fill', v > 1.4 ? '#fff' : 'var(--color-fg)').text(d3.format('.1f')(v) + '×');
      });
    });
    if (F.lens) {
      const l = F.lens;
      const items = M.map((m) => { const r = idx.get(m + '|' + l); return { m, v: r ? +r.index : 0, label: r ? d3.format('.1f')(+r.index) + '×' : '—' }; }).sort((a, b) => b.v - a.v);
      compare(box, { title: `${l}: who works this lens most`, color: lensColor(l), items, ref: 1, foot: 'Line = council average (1.0×). Click a name to spotlight that member.', clear: () => { F.lens = null; refocus(); } });
    } else compare(box, { hint: 'Compare members on one lens:', choices: LENSES.map((l) => ({ label: `${l[0]} · ${l}`, color: lensColor(l), pick: () => { F.lens = l; refocus(); } })) });
  });

  const radar = (box, rows, m) => {
    box.replaceChildren();
    const W = Math.max(180, box.clientWidth), R = Math.max(34, Math.min(W / 2 - 40, 56)), cx = W / 2, cy = R + 28, H = cy + R + 28 + 20;
    const svg = d3.select(box).append('svg').attr('class', 'rad').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / LENSES.length;
    // radius grows as v / (v + 1): the even spread (1.0×) sits well inside, 2× and 3× spread out, and very large values stop at the rim
    const rad = (v) => Math.min(R, R * Math.max(0, v) / (Math.max(0, v) + 1) * 1.25);
    const pt = (i, v) => [cx + rad(v) * Math.cos(ang(i)), cy + rad(v) * Math.sin(ang(i))];
    svg.append('polygon').attr('points', LENSES.map((_, i) => pt(i, 2).join(',')).join(' ')).attr('fill', 'none').attr('stroke', 'var(--cds-chart-grid)');
    // ghost underlay: an even spread, matching the council's average share on every lens (1.0×)
    svg.append('polygon').attr('class', 'ghost').attr('points', LENSES.map((_, i) => pt(i, 1).join(',')).join(' '))
      .attr('fill', '#8c8577').attr('fill-opacity', 0.16).attr('stroke', '#8c8577').attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3')
      .append('title').text('Even spread: the council-average share on every lens (1.0×)');
    const vals = LENSES.map((l) => { const r = rows.find((x) => x.lens === l); return r ? +r.index : 0; });
    LENSES.forEach((l, i) => { const [x, y] = [cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i))]; svg.append('line').attr('data-l', l).attr('x1', cx).attr('y1', cy).attr('x2', x).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)'); });
    svg.append('polygon').attr('class', 'shape').attr('points', vals.map((v, i) => pt(i, v).join(',')).join(' ')).attr('fill', dash.colors[0]).attr('fill-opacity', 0.22).attr('stroke', dash.colors[0]).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
    LENSES.forEach((l, i) => {
      const [lx, ly] = [cx + (R + 14) * Math.cos(ang(i)), cy + (R + 14) * Math.sin(ang(i))];
      const g = svg.append('g').attr('data-l', l).style('cursor', 'pointer');
      g.append('circle').attr('cx', lx).attr('cy', ly).attr('r', 10).attr('fill', '#fff').attr('stroke', lensColor(l)).attr('stroke-width', 1.2);
      g.append('text').attr('x', lx).attr('y', ly + 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 700).attr('fill', lensColor(l)).text(l[0]);
      g.append('title').text(`${l}: ${d3.format('.1f')(vals[i])}× the council's share. Click to focus this lens on every card.`);
      g.on('mouseenter', () => setFocusAttr(l)).on('mouseleave', () => setFocusAttr(F.lens))
        .on('click', (ev) => { ev.stopPropagation(); F.lens = F.lens === l ? null : l; refocus(); });
      const [x, y] = pt(i, vals[i]);
      svg.append('circle').attr('data-l', l).attr('cx', x).attr('cy', y).attr('r', 4.5).attr('fill', lensColor(l)).attr('stroke', '#fff').attr('stroke-width', 1);
      svg.append('text').attr('class', 'rv').attr('data-l', l).attr('x', cx).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('font-weight', 700).attr('fill', '#2a0157').text(`${l}: ${d3.format('.1f')(vals[i])}× council share`);
    });
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
  dash.draw('lenspick', (box) => {
    box.replaceChildren();
    const lab = document.createElement('span'); lab.className = 'lp-l'; lab.textContent = 'Focus a lens:'; box.appendChild(lab);
    const all = document.createElement('button'); all.type = 'button'; all.textContent = 'All'; all.setAttribute('aria-pressed', String(!F.lens));
    all.addEventListener('click', () => { F.lens = null; refocus(); }); box.appendChild(all);
    for (const l of LENSES) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.l = l; b.style.borderColor = lensColor(l); b.setAttribute('aria-pressed', String(F.lens === l));
      const L = document.createElement('b'); L.textContent = l[0]; b.append(L, ' ' + l);
      b.addEventListener('mouseenter', () => setFocusAttr(l)); b.addEventListener('mouseleave', () => setFocusAttr(F.lens));
      b.addEventListener('click', () => { F.lens = F.lens === l ? null : l; refocus(); });
      box.appendChild(b);
    }
    setFocusAttr(F.lens);
  });
  dash.draw('cards', (box) => {
    const rows = ok('b_members'); box.replaceChildren(); if (!rows) return;
    for (const m of M) {
      const r = rows.find((x) => x.member === m); if (!r) continue;
      const c = document.createElement('div'); c.className = 'mcard'; c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-pressed', String(cur() === m));
      const pick = () => { dash.setParams({ member: cur() === m ? 'All' : m }); };
      c.addEventListener('click', pick); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = r.full_name;
      const rl = document.createElement('div'); rl.className = 'rl'; rl.textContent = r.role;
      const tag = document.createElement('div'); const t = document.createElement('span'); t.className = 'tag'; t.textContent = r.coalition;
      t.style.borderColor = r.coalition.startsWith('Usually') ? dash.colors[0] : 'var(--color-bad)'; if (!r.coalition.startsWith('Usually')) t.style.borderStyle = 'dashed'; tag.appendChild(t);
      const g = document.createElement('div'); g.className = 'chart gauge'; g.style.minHeight = '5.5rem';
      const rd = document.createElement('div'); rd.className = 'chart'; rd.style.minHeight = '180px';
      c.append(nm, rl, tag, g, rd);
      meterRow(c, 'Business engagement', +r.biz_lead / +r.biz_lead_max, dash.colors[2], fInt(+r.biz_lead));
      meterRow(c, 'Pushback on business', +r.biz_pushback / +r.biz_pushback_max, dash.colors[3], fInt(+r.biz_pushback));
      meterRow(c, 'With majority, biz splits', +r.biz_splits_cast ? +r.biz_splits_with_majority / +r.biz_splits_cast : 0, dash.colors[1], `${fInt(+r.biz_splits_with_majority)}/${fInt(+r.biz_splits_cast)}`);
      const leads = document.createElement('div'); leads.className = 'small leads';
      leads.append('Leads on');
      for (const i of [r.top_issue_1, r.top_issue_2].filter((x) => x && x !== '—')) {
        const s = document.createElement('button'); s.type = 'button'; s.className = 'tag'; s.style.borderColor = issueColor(i); s.textContent = shortIssue(i); s.title = 'Compare members on this issue';
        if (F.issue === i) { s.style.background = issueColor(i); s.style.color = '#fff'; }
        s.addEventListener('click', (ev) => { ev.stopPropagation(); F.issue = F.issue === i ? null : i; refocus(); document.getElementById('issues')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        leads.appendChild(s);
      }
      const ally = document.createElement('div'); ally.className = 'small';
      ally.append('Votes most like ', Object.assign(document.createElement('b'), { textContent: r.closest }), ', least like ', Object.assign(document.createElement('b'), { textContent: r.farthest }));
      c.append(leads, ally); box.appendChild(c);
      const pm = (ok('b_persia_member') || []).filter((x) => x.member === m);
      requestAnimationFrame(() => { gauge(g, +r.majority_share, fPct(+r.majority_share), 'with majority on all splits'); radar(rd, pm, m); });
    }
  });

  // ---------- lead map ----------
  dash.draw('leadmap', (box) => {
    const rows = ok('b_issue_member'); box.replaceChildren(); if (!rows) return;
    const W = Math.max(300, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, ISSUES.map(shortIssue), 11) + 22;
    const top = 28, rh = 30, cw = (W - left) / M.length, H = top + ISSUES.length * rh + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const lo = '#ffffff';
    const idx = new Map(rows.map((r) => [r.member + '|' + r.issue, r]));
    const tip = tipIn(box);
    memberHeads(svg, left, cw, H);
    ISSUES.forEach((iss, i) => {
      const y = top + i * rh;
      const rowMax = d3.max(M, (m) => +(idx.get(m + '|' + iss) || {}).lead || 0) || 1;
      const ramp = d3.interpolateRgb(lo, issueColor(iss));
      rowLabel(svg, left, y, rh, shortIssue(iss), issueColor(iss), F.issue === iss, () => { F.issue = F.issue === iss ? null : iss; refocus(); }, F.issue === iss ? 'Clear issue focus' : `Compare members on ${shortIssue(iss)}`);
      M.forEach((m, j) => {
        const r = idx.get(m + '|' + iss); if (!r) return; const n = +r.lead; const op = dimmed(m, iss, 'issue') ? 0.22 : 1;
        svg.append('rect').attr('x', left + j * cw + 2).attr('y', y + 2).attr('width', Math.max(0, cw - 4)).attr('height', rh - 4).attr('rx', 3).attr('opacity', op)
          .attr('fill', n ? ramp(0.15 + 0.85 * (n / rowMax)) : 'transparent').attr('stroke', n === rowMax && n ? 'var(--color-fg)' : 'var(--color-border-line)').attr('stroke-width', n === rowMax && n ? 1.5 : 1).attr('stroke-opacity', n && n !== rowMax ? 0 : 1).style('cursor', 'pointer')
          .on('click', () => { F.issue = iss; dash.setParams({ member: m }); })
          .on('mousemove', (ev) => showTip(box, tip, ev, `${m} · ${iss}`, [`${fInt(n)} motions/remarks`, `${fInt(+r.motions)} motions · ${fInt(+r.spoke_for)} spoke for · ${fInt(+r.pushback)} pushback`, 'Click to spotlight']))
          .on('mouseleave', () => { tip.hidden = true; });
        if (n && cw > 30) svg.append('text').attr('x', left + j * cw + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('opacity', op).attr('pointer-events', 'none').attr('fill', n / rowMax > 0.6 ? '#fff' : 'var(--color-fg)').text(fInt(n));
      });
    });
    if (F.issue) {
      const iss = F.issue;
      const items = M.map((m) => { const r = idx.get(m + '|' + iss); const n = r ? +r.lead : 0; return { m, v: n, label: fInt(n) }; }).sort((a, b) => b.v - a.v);
      compare(box, { title: `${shortIssue(iss)}: who carries it`, color: issueColor(iss), items, foot: 'Motions and remarks on this issue. Click a name to spotlight that member.', clear: () => { F.issue = null; refocus(); } });
    } else compare(box, { hint: 'Compare members on one issue:', choices: ISSUES.map((i) => ({ label: shortIssue(i), color: issueColor(i), pick: () => { F.issue = i; refocus(); } })) });
  });

  // ---------- contested bars ----------
  const SPLIT_C = '#2a0157', CALM_C = '#f3b496';
  document.querySelectorAll('.pb [data-sw=split]').forEach((e) => { e.style.background = SPLIT_C; });
  document.querySelectorAll('.pb [data-sw=calm]').forEach((e) => { e.style.background = CALM_C; });
  dash.draw('contested', (box) => {
    const rows = ok('b_issues'); box.replaceChildren(); if (!rows) return;
    const data = rows.map((r) => ({ ...r, u: r.unanimous_share === '' ? null : +r.unanimous_share })).sort((a, b) => (a.u ?? 2) - (b.u ?? 2));
    const W = Math.max(300, box.clientWidth), rh = 30;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const left = measure(svg, data.map((r) => shortIssue(r.issue)), 11) + 22;
    const narrow = W < 560, right = narrow ? 78 : 150;
    const H = data.length * rh + 22; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const x = d3.scaleLinear([0.75, 1], [left, W - right]).clamp(true);
    const tip = tipIn(box);
    data.forEach((r, i) => {
      const y = i * rh; const on = F.issue === r.issue, op = F.issue && !on ? 0.3 : 1;
      const g = svg.append('g').style('cursor', 'pointer').attr('opacity', op);
      if (on) g.append('rect').attr('x', 0).attr('y', y + 1).attr('width', W).attr('height', rh - 2).attr('rx', 6).attr('fill', 'rgba(42,1,87,.05)').attr('stroke', '#2a0157');
      g.append('text').attr('x', left - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('font-weight', on ? 700 : 400).attr('fill', 'var(--color-fg)').text(shortIssue(r.issue));
      g.append('rect').attr('x', left).attr('y', y + 8).attr('width', W - right - left).attr('height', rh - 16).attr('rx', 3).attr('fill', 'var(--color-border-line)').attr('opacity', 0.5);
      if (r.u != null) g.append('rect').attr('x', left).attr('y', y + 8).attr('width', Math.max(2, x(r.u) - left)).attr('height', rh - 16).attr('rx', 3).attr('fill', r.u < 1 ? SPLIT_C : CALM_C);
      g.append('text').attr('x', W - right + 8).attr('y', y + rh / 2 + 4).attr('font-size', 10.5).attr('fill', 'var(--color-fg-muted)')
        .text(r.u == null ? '—' : narrow ? `${fPct(r.u)} · ${fInt(+r.splits)} split` : `${fPct(r.u)} no dissent · ${fInt(+r.splits)} split`);
      g.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', 'transparent')
        .on('click', () => { F.issue = on ? null : r.issue; refocus(); })
        .on('mousemove', (ev) => showTip(box, tip, ev, r.issue, [`${fInt(+r.votes)} votes · ${fInt(+r.splits)} split`, `Leads: ${r.champion_1} (${fInt(+r.champion_1_n)}), ${r.champion_2} (${fInt(+r.champion_2_n)})`, on ? 'Click to clear' : 'Click to compare who carries it']))
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
      t.attr('data-full', lab(q)).attr('data-ell', left - 52);
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
    const data = rows.map((r) => ({ ...r, d: +r.days })).sort((a, b) => a.d - b.d || (a.changed === 'Yes' ? -1 : 1));
    // key
    const key = document.createElement('div'); key.className = 'okey';
    const sw = (fill, dash_) => `<svg width="16" height="16" aria-hidden="true">${dash_ ? '<line x1="8" y1="1" x2="8" y2="15" stroke="#8c8577" stroke-dasharray="3 2" stroke-width="1.5"/>' : `<circle cx="8" cy="8" r="5.5" fill="${fill}" stroke="${dash.colors[0]}" stroke-width="1.6"/>`}</svg>`;
    key.innerHTML = `<span>${sw(dash.colors[0])}Amended before adoption</span><span>${sw('#fff')}Adopted as introduced</span><span>${sw(null, true)}Median${k ? ` (${fInt(+k.ord_median_days)} days)` : ''}</span><span class="okey-n">Number above a column = ordinances in it</span>`;
    box.appendChild(key);
    const W = Math.max(300, box.clientWidth), r0 = 5.5, gap = 13.5, mg = { l: 14, r: 14, t: 26, b: 30 };
    const x = d3.scaleLinear([0, Math.max(30, d3.max(data, (r) => r.d))], [mg.l + 6, W - mg.r - 6]).nice();
    const cols = [];
    for (const r of data) { const px = x(r.d); let c = cols.find((c) => Math.abs(c.x - px) < gap); if (!c) { c = { x: px, items: [] }; cols.push(c); } c.items.push(r); }
    const maxStack = d3.max(cols, (c) => c.items.length) || 1;
    const H = mg.t + 14 + maxStack * gap + mg.b;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const base = H - mg.b - 10;
    for (let d = 7; d <= x.domain()[1]; d += 7) svg.append('line').attr('x1', x(d)).attr('x2', x(d)).attr('y1', mg.t).attr('y2', H - mg.b).attr('stroke', 'var(--cds-chart-grid)').attr('stroke-opacity', 0.6);
    const ax = svg.append('g').attr('transform', `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(Math.min(10, Math.round(x.domain()[1] / 7))).tickFormat((d) => d + 'd'));
    ax.attr('font-size', null).attr('font-family', null); ax.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); ax.selectAll('line').attr('stroke', 'var(--cds-chart-axis)'); ax.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 10.5);
    if (k) {
      const mx = x(+k.ord_median_days);
      svg.append('line').attr('x1', mx).attr('x2', mx).attr('y1', 14).attr('y2', H - mg.b).attr('stroke', '#8c8577').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2');
      svg.append('text').attr('x', mx).attr('y', 10).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('font-weight', 600).attr('fill', 'var(--color-fg-muted)').text(`median ${fInt(+k.ord_median_days)} days`);
    }
    const tip = tipIn(box);
    for (const c of cols) {
      c.items.forEach((r, i) => {
        svg.append('circle').attr('cx', c.x).attr('cy', base - i * gap).attr('r', r0).attr('fill', r.changed === 'Yes' ? dash.colors[0] : '#fff').attr('stroke', dash.colors[0]).attr('stroke-width', 1.6).style('cursor', 'pointer')
          .on('mousemove', (ev) => showTip(box, tip, ev, `${r.file} · ${fInt(r.d)} days`, [r.title, `${date(r.first_seen)} → ${date(r.adopted)}`, r.changed === 'Yes' ? 'Amended before adoption' : 'Adopted as introduced']))
          .on('mouseleave', () => { tip.hidden = true; });
      });
      svg.append('text').attr('x', c.x + (k && Math.abs(c.x - x(+k.ord_median_days)) < 4 ? 0 : 0)).attr('y', base - (c.items.length - 1) * gap - 10).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', 'var(--color-fg)')
        .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3).text(c.items.length);
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
