/* One-page, at-a-glance print summary for each dashboard.
   Builds a compact sheet from the page's data (respecting the current member, months or topic),
   fits it to one US-letter page and opens the print dialog. */
(() => {
  const KIND = window.__PRINT_KIND__;
  const META = window.__META__ || {};
  const NA = 'NOT AVAILABLE';
  const ACC = '#c96442', DARK = '#6e1f14', MUTE = '#d9d5cb';
  const rows = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : []; };
  const P = () => dash.params();
  const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const pct = (v) => num(v) == null ? '—' : Math.round(+v * 100) + '%';
  const int = (v) => num(v) == null ? '—' : d3.format(',')(+v);
  const mfmt = (m) => d3.utcFormat('%b %Y')(new Date(m + '-01T00:00:00Z'));
  const mshort = (m) => d3.utcFormat('%b')(new Date(m + '-01T00:00:00Z'));
  const dfmt = (s) => s ? d3.utcFormat('%b %-d')(new Date(s + 'T00:00:00Z')) : '—';
  const dlong = (s) => s ? d3.utcFormat('%A, %B %-d')(new Date(s + 'T00:00:00Z')) : '—';
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const first = (s) => { s = String(s || ''); const i = s.search(/\.\s/); return i > 0 ? s.slice(0, i + 1) : s; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const span = META.first && META.last ? `${dfmt(META.first)} – ${dfmt(META.last)}, ${META.last.slice(0, 4)}` : '';

  // ---------- building blocks ----------
  const glance = (items) => { const b = el('div', 'ps-glance'); b.appendChild(el('div', 'ps-gh', 'At a glance')); const ul = el('ul'); for (const t of items.filter(Boolean)) ul.appendChild(el('li', '', t)); b.appendChild(ul); return b; };
  const kpis = (items) => { const w = el('div', 'ps-kpis'); for (const [label, value, sub] of items) { const k = el('div', 'ps-kpi'); k.appendChild(el('div', 'ps-kv', value)); k.appendChild(el('div', 'ps-kl', label)); if (sub) k.appendChild(el('div', 'ps-ks', sub)); w.appendChild(k); } return w; };
  const section = (title, ...kids) => { const s = el('section', 'ps-sec'); s.appendChild(el('h3', '', title)); kids.forEach((k) => k && s.appendChild(k)); return s; };
  const cols = (...kids) => { const c = el('div', 'ps-cols'); kids.forEach((k) => c.appendChild(k)); return c; };
  const note = (t) => el('p', 'ps-note', t);
  const chip = (t, strong) => el('span', 'ps-chip' + (strong ? ' strong' : ''), t);
  const bar = (v, max = 1, color = ACC, label) => {
    const w = el('div', 'ps-bar'); const t = el('div', 'ps-track'); const f = el('div', 'ps-fill');
    const x = num(v) == null || !max ? 0 : Math.max(0, Math.min(1, +v / max));
    f.style.width = (x * 100) + '%'; f.style.background = color; t.appendChild(f); w.appendChild(t);
    w.appendChild(el('span', 'ps-bv', label != null ? label : pct(v))); return w;
  };
  // grid of rows: spec = [{h, w, cell: (r) => Node|string, cls}]
  const grid = (spec, data) => {
    const g = el('div', 'ps-grid'); g.style.gridTemplateColumns = spec.map((s) => s.w || 'auto').join(' ');
    for (const s of spec) g.appendChild(el('div', 'ps-gh2' + (s.cls ? ' ' + s.cls : ''), s.h));
    data.forEach((r, i) => { for (const s of spec) { const c = el('div', 'ps-gc' + (i % 2 ? ' alt' : '') + (s.cls ? ' ' + s.cls : '')); const v = s.cell(r); if (v instanceof Node) c.appendChild(v); else c.textContent = v == null ? '' : v; g.appendChild(c); } });
    return g;
  };
  const stack = (parts) => { // parts: [[value, color]]
    const t = el('div', 'ps-track stack'); const tot = parts.reduce((a, p) => a + (+p[0] || 0), 0) || 1;
    for (const [v, c] of parts) { const f = el('div', 'ps-fill'); f.style.width = ((+v || 0) / tot * 100) + '%'; f.style.background = c; t.appendChild(f); }
    return t;
  };
  const columnChart = (data, { w = 330, h = 92, label, val, mark }) => {
    const svg = d3.create('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('class', 'ps-svg');
    const x = d3.scaleBand().domain(data.map(label)).range([4, w - 4]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(data, val) || 1]).range([h - 16, 12]);
    data.forEach((d) => {
      svg.append('rect').attr('x', x(label(d))).attr('y', y(val(d))).attr('width', x.bandwidth()).attr('height', h - 16 - y(val(d))).attr('fill', ACC).attr('rx', 1.5);
      svg.append('text').attr('x', x(label(d)) + x.bandwidth() / 2).attr('y', y(val(d)) - 2).attr('text-anchor', 'middle').attr('font-size', 7.5).attr('fill', '#1f1e1d').text(val(d));
      svg.append('text').attr('x', x(label(d)) + x.bandwidth() / 2).attr('y', h - 5).attr('text-anchor', 'middle').attr('font-size', 7.5).attr('fill', '#5b5a56').text(label(d));
      if (mark && mark(d)) svg.append('circle').attr('cx', x(label(d)) + x.bandwidth() / 2).attr('cy', h - 21).attr('r', 3.2).attr('fill', DARK);
    });
    return svg.node();
  };
  const legend = (items) => { const l = el('div', 'ps-legend'); for (const [c, t] of items) { const s = el('span', 'ps-sw'); s.style.background = c; l.appendChild(s); l.appendChild(el('span', '', t)); } return l; };
  const range = () => {
    const ms = rows('p_months').map((r) => r.month);
    const f = P().from || ms[0], t = P().to || ms[ms.length - 1];
    return { from: f, to: t, label: f === t ? mfmt(f) : `${mfmt(f)} – ${mfmt(t)}` };
  };
  const minBy = (a, f) => a.reduce((m, r) => (m == null || f(r) < f(m) ? r : m), null);
  const maxBy = (a, f) => a.reduce((m, r) => (m == null || f(r) > f(m) ? r : m), null);

  // ---------- one builder per dashboard ----------
  const B = {
    trends(S) {
      const t = rows('totals')[0] || {}, mem = rows('members'), mon = rows('monthly'), con = rows('contested');
      const ag = rows('agreement').filter((r) => r.a < r.b && +r.n > 0).sort((x, y) => +y.share - +x.share || +y.n - +x.n);
      const splitMonths = new Set(con.map((r) => r.date.slice(0, 7)));
      const desc = new Map(rows('m_splits').map((r) => [r.date + '|' + r.file + '|' + r.tally, r.issue]));
      S.sub = `Every recorded roll-call vote · ${span}`;
      const minority = minBy(mem.filter((r) => +r.split_votes_cast), (r) => +r.majority_share);
      const absent = maxBy(mem, (r) => +r.absent);
      S.add(glance([
        `${pct(t.unanimous_share)} of ${int(t.votes)} votes were unanimous. Only ${int(t.contested)} split and ${int(t.failed)} failed, so most decisions are settled before the vote.`,
        minority && `${minority.member} was most often on the losing side of split votes: with the majority on ${minority.with_majority} of ${minority.split_votes_cast}.`,
        absent && `${absent.member} missed the most votes: ${int(absent.absent)} (${pct(absent.participation)} participation).`,
        ag[0] && `Closest voting pair on split votes: ${ag[0].a} and ${ag[0].b} (${ag[0].agree} of ${ag[0].n}).`,
      ]));
      S.add(kpis([['Meetings', int(t.meetings)], ['Recorded votes', int(t.votes)], ['Agenda items', int(t.items)], ['Unanimous', pct(t.unanimous_share)], ['Split votes', int(t.contested)], ['Failed', int(t.failed)]]));
      S.add(section('Member scorecard', grid([
        { h: 'Member', w: '1.1fr', cell: (r) => r.member, cls: 'b' },
        { h: 'Participation', w: '2fr', cell: (r) => bar(r.participation) },
        { h: 'With majority on split votes', w: '2fr', cell: (r) => bar(r.majority_share, 1, DARK, `${r.with_majority}/${r.split_votes_cast}`) },
        { h: 'Nay votes', w: '.8fr', cell: (r) => int(r.nay), cls: 'n' },
        { h: 'Absent', w: '.8fr', cell: (r) => int(r.absent), cls: 'n' },
      ], mem)));
      S.add(cols(
        section('Votes per month', columnChart(mon, { label: (d) => mshort(d.month), val: (d) => +d.votes, mark: (d) => splitMonths.has(d.month) }), legend([[ACC, 'Recorded votes'], [DARK, 'Month had a split vote']])),
        section('Who votes together on split votes', grid([
          { h: 'Pair', w: '1.4fr', cell: (r) => `${r.a} & ${r.b}` },
          { h: 'Agreed', w: '2fr', cell: (r) => bar(r.share, 1, ACC, `${r.agree}/${r.n}`) },
        ], ag.slice(0, 6)))));
      S.add(section(`The ${con.length} split votes`, grid([
        { h: 'Date', w: '.55fr', cell: (r) => dfmt(r.date) },
        { h: 'Question', w: '3.2fr', cell: (r) => cut(desc.get(r.date + '|' + r.file + '|' + r.tally) || `${r.file} · ${r.title}`, 84) },
        { h: 'Tally', w: '.45fr', cell: (r) => r.tally, cls: 'n' },
        { h: 'Voted nay', w: '1.6fr', cell: (r) => r.nay },
      ], con.slice().sort((a, b) => b.date.localeCompare(a.date)))));
    },

    members(S) {
      const R = range(), who = P().member || 'All';
      const c = rows('p_council').find((r) => r.from === R.from && r.to === R.to) || {};
      const inR = (d) => d.slice(0, 7) >= R.from && d.slice(0, 7) <= R.to;
      const pm = rows('p_member').filter((r) => r.from === R.from && r.to === R.to);
      const splits = rows('m_splits').filter((r) => inR(r.date));
      if (who === 'All') {
        S.sub = `All members · ${R.label}`;
        const minority = minBy(pm.filter((r) => num(r.majority_share) != null), (r) => +r.majority_share);
        const active = maxBy(pm, (r) => +r.motions);
        const push = maxBy(pm, (r) => +r.pushback);
        S.add(glance([
          `${pct(c.unanimous_share)} of ${int(c.votes)} votes in ${R.label} were unanimous; ${int(c.splits)} split.`,
          minority && `${minority.member} sided with the majority least often on split votes (${pct(minority.majority_share)}).`,
          active && `${active.member} made the most motions (${int(active.motions)}); ${push.member} pushed back most (${int(push.pushback)}: spoke against, raised concerns, or moved to delay or deny).`,
        ]));
        S.add(kpis([['Meetings', int(c.meetings)], ['Recorded votes', int(c.votes)], ['Agenda items', int(c.items)], ['Unanimous', pct(c.unanimous_share)], ['Split votes', int(c.splits)], ['Failed', int(c.failed)]]));
        S.add(section('Member scorecard', grid([
          { h: 'Member', w: '1fr', cell: (r) => r.member, cls: 'b' },
          { h: 'Participation', w: '1.6fr', cell: (r) => bar(r.participation) },
          { h: 'With majority (splits)', w: '1.6fr', cell: (r) => bar(r.majority_share, 1, DARK) },
          { h: 'Motions', w: '1.3fr', cell: (r) => bar(r.motions, +r.motions_max, ACC, int(r.motions)) },
          { h: 'Pushback', w: '1.3fr', cell: (r) => bar(r.pushback, +r.pushback_max, DARK, int(r.pushback)) },
          { h: 'Leads on', w: '1.7fr', cell: (r) => cut(r.top_focus, 34) },
          { h: 'Votes most like', w: '.9fr', cell: (r) => r.closest },
        ], pm)));
        const by = d3.group(splits, (r) => r.date + '|' + r.file + '|' + r.issue);
        const list = [...by.values()].map((g) => ({ date: g[0].date, issue: g[0].issue, tally: g[0].tally, outcome: g[0].outcome, nay: g.filter((x) => x.vote === 'Nay').map((x) => x.member).join(', ') || '—' }));
        S.add(section(`Split votes in ${R.label}`, list.length ? grid([
          { h: 'Date', w: '.5fr', cell: (r) => dfmt(r.date) },
          { h: 'Question', w: '3fr', cell: (r) => cut(r.issue, 80) },
          { h: 'Tally', w: '.45fr', cell: (r) => r.tally, cls: 'n' },
          { h: 'Result', w: '.6fr', cell: (r) => r.outcome },
          { h: 'Voted nay', w: '1.6fr', cell: (r) => r.nay },
        ], list) : note('No split votes in these months.')));
        return;
      }
      const r = pm.find((x) => x.member === who) || {};
      S.title = r.full_name || who; S.sub = `${r.role || 'Councilmember'} · ${R.label}`;
      const mine = splits.filter((x) => x.member === who);
      const lost = mine.filter((x) => x.with_majority === 'No').length;
      S.add(glance([
        `Voted on ${pct(r.participation)} of ${int(r.votes)} recorded votes (${int(r.absent)} absent, ${int(r.nay)} nay).`,
        num(r.majority_share) != null ? `Sided with the majority on ${r.with_majority} of ${r.split_votes_cast} split votes${lost ? `; on the losing side ${lost} time${lost > 1 ? 's' : ''}` : ''}.` : 'No split votes cast in these months.',
        `Leads most on ${r.top_focus || '—'}; made ${int(r.motions)} motions and pushed back ${int(r.pushback)} times.`,
        r.closest && r.closest !== '—' ? `Votes most like ${r.closest} (${pct(r.closest_share)}) and least like ${r.farthest} (${pct(r.farthest_share)}) on split votes.` : null,
      ]));
      S.add(kpis([['Participation', pct(r.participation)], ['With majority', pct(r.majority_share), 'on split votes'], ['Nay votes', int(r.nay)], ['Absent', int(r.absent)], ['Motions', int(r.motions)], ['Pushback', int(r.pushback)]]));
      const tv = rows('p_topic').filter((x) => x.from === R.from && x.to === R.to && x.member === who).sort((a, b) => +b.votes - +a.votes).slice(0, 9);
      const ag = rows('p_agree').filter((x) => x.from === R.from && x.to === R.to && (x.a === who || x.b === who) && +x.n > 0)
        .map((x) => ({ other: x.a === who ? x.b : x.a, n: x.n, agree: x.agree, share: x.share })).sort((a, b) => +b.share - +a.share);
      S.add(cols(
        section('Votes by topic', grid([
          { h: 'Topic', w: '1.5fr', cell: (x) => cut(x.topic, 32) },
          { h: 'Yea · nay · absent', w: '1.4fr', cell: (x) => stack([[x.yea, ACC], [x.nay, DARK], [x.absent, MUTE]]) },
          { h: 'Votes', w: '.4fr', cell: (x) => int(x.votes), cls: 'n' },
        ], tv), legend([[ACC, 'Yea'], [DARK, 'Nay'], [MUTE, 'Absent']])),
        section('Agreement with colleagues (split votes)', ag.length ? grid([
          { h: 'Colleague', w: '1fr', cell: (x) => x.other },
          { h: 'Voted alike', w: '2fr', cell: (x) => bar(x.share, 1, ACC, `${x.agree}/${x.n}`) },
        ], ag) : note('No shared split votes in these months.'))));
      S.add(section('Their side on each split vote', mine.length ? grid([
        { h: 'Date', w: '.5fr', cell: (x) => dfmt(x.date) },
        { h: 'Question', w: '3fr', cell: (x) => cut(x.issue, 82) },
        { h: 'Vote', w: '.5fr', cell: (x) => chip(x.vote, x.vote === 'Nay') },
        { h: 'Tally', w: '.45fr', cell: (x) => x.tally, cls: 'n' },
        { h: 'With majority', w: '.7fr', cell: (x) => x.with_majority },
      ], mine) : note('No split votes in these months.')));
    },

    playbook(S) {
      const k = rows('b_kpis')[0] || {}, watch = rows('b_watch'), bm = rows('b_members'), lens = rows('b_persia'), iss = rows('b_issues');
      S.sub = `Business-related decisions, coalitions and timing · ${span}`;
      const usual = bm.filter((r) => r.coalition.startsWith('Usually')).map((r) => r.member);
      S.add(glance([
        watch.length ? `Next meeting ${dlong(k.next_meeting)}: ${watch.length} business item${watch.length > 1 ? 's' : ''} return (${watch.map((w) => w.file).join(', ')}).` : 'No business items are scheduled to return in the latest minutes.',
        `${pct(k.biz_unanimous_share)} of ${int(k.biz_votes)} business votes were unanimous: shape items before they reach the floor.`,
        `${k.min_winning_yeas} of ${k.seats} votes carry a split vote. Usually in the majority: ${usual.join(', ') || '—'}.`,
        `Ordinances take a median of ${int(k.ord_median_days)} days to adoption and ${pct(k.ord_amended_share)} are amended; ${pct(k.delays_adopted_share)} of delayed items were later adopted.`,
      ]));
      S.add(kpis([['Business votes', int(k.biz_votes)], ['Unanimous', pct(k.biz_unanimous_share)], ['Split', int(k.biz_splits)], ['Days to adopt', int(k.ord_median_days), 'ordinance median'], ['Amended', pct(k.ord_amended_share), 'of ordinances'], ['Votes to win', `${k.min_winning_yeas}/${k.seats}`]]));
      S.add(section(`On the next agenda${k.next_meeting ? ' · ' + dlong(k.next_meeting) : ''}`, watch.length ? grid([
        { h: 'File', w: '.7fr', cell: (r) => r.file, cls: 'b' },
        { h: 'Item', w: '3fr', cell: (r) => cut(r.item, 84) },
        { h: 'Issue', w: '1.2fr', cell: (r) => r.issue },
        { h: 'Stage', w: '.9fr', cell: (r) => r.stage },
        { h: 'Last vote', w: '.7fr', cell: (r) => r.last_tally || '—' },
      ], watch) : note('Nothing pending in the latest minutes.')));
      S.add(section('Coalition map', grid([
        { h: 'Member', w: '.9fr', cell: (r) => r.member, cls: 'b' },
        { h: 'Coalition', w: '1.3fr', cell: (r) => chip(r.coalition, !r.coalition.startsWith('Usually')) },
        { h: 'With majority', w: '1.5fr', cell: (r) => bar(r.majority_share, 1, DARK) },
        { h: 'Leads on business', w: '1.5fr', cell: (r) => bar(r.biz_lead, +r.biz_lead_max, ACC, int(r.biz_lead)) },
        { h: 'Pushback', w: '1.2fr', cell: (r) => bar(r.biz_pushback, +r.biz_pushback_max, DARK, int(r.biz_pushback)) },
        { h: 'Top issue', w: '1.7fr', cell: (r) => cut(r.top_issue_1, 32) },
      ], bm)));
      const lmax = d3.max(lens, (r) => +r.votes) || 1, imax = d3.max(iss, (r) => +r.votes) || 1;
      S.add(cols(
        section('PERSIA lenses (votes)', grid([
          { h: 'Lens', w: '.9fr', cell: (r) => r.lens, cls: 'b' },
          { h: 'Votes · split', w: '1.6fr', cell: (r) => bar(r.votes, lmax, ACC, `${r.votes} · ${r.splits}`) },
          { h: 'Champions', w: '1.2fr', cell: (r) => [r.champion_1, r.champion_2].filter((x) => x && x !== NA).join(', ') || '—' },
        ], lens)),
        section('Business issues (votes)', grid([
          { h: 'Issue', w: '1.6fr', cell: (r) => cut(r.issue, 30) },
          { h: 'Votes · split', w: '1.3fr', cell: (r) => bar(r.votes, imax, ACC, `${r.votes} · ${r.splits}`) },
          { h: 'Champion', w: '.8fr', cell: (r) => r.champion_1 || '—' },
        ], iss))));
    },

    coa(S) {
      const q = (P().q || '').trim();
      const k = rows('b_kpis')[0] || {};
      if (P().tab === 'search' && q) {
        S.title = `Course of action: “${q}”`;
        S.sub = `St. Paul Area Chamber · from the council minutes (${span}) and Chamber documents`;
        const card = document.querySelector('.coa .card');
        if (card) {
          const tags = [...card.querySelectorAll('.tag')].map((t) => t.textContent);
          if (tags.length) S.add(glance([`Matched issue areas: ${tags.join(', ')}.`, `${k.min_winning_yeas || 4} votes carry a split vote; engage before first reading.`]));
          const ol = card.querySelector('ol'); if (ol) { const c = ol.cloneNode(true); c.className = 'ps-steps'; S.add(section('Recommended steps', c)); }
          else { const p = card.querySelector('p'); if (p) S.add(note(p.textContent)); }
        }
        const who = [...document.querySelectorAll('.coa .who')].map((w) => { const b = w.querySelector('b'); const parts = (b ? b.textContent : '').split(' · '); const sp = [...w.querySelectorAll('span')].map((s) => s.textContent); return { m: parts[0], role: parts[1] || '', a: sp[0] || '' }; });
        if (who.length) S.add(section('Role of each member on this topic', grid([
          { h: 'Member', w: '.8fr', cell: (r) => r.m, cls: 'b' },
          { h: 'Role', w: '1.3fr', cell: (r) => chip(r.role, /Lead/.test(r.role)) },
          { h: 'Approach', w: '4fr', cell: (r) => cut(r.a, 120) },
        ], who)));
        const rel = [...document.querySelectorAll('[data-draw=related] tr')].slice(0, 8).map((tr) => [...tr.children].map((x) => x.textContent));
        S.add(section('Related council actions', rel.length ? grid([
          { h: 'Date', w: '.55fr', cell: (r) => dfmt(r[0]) }, { h: 'File', w: '.7fr', cell: (r) => r[1] },
          { h: 'Item', w: '3fr', cell: (r) => cut(r[2], 80) }, { h: 'Vote', w: '.4fr', cell: (r) => r[3], cls: 'n' },
        ], rel) : note(`${NA}: no matching items in the minutes.`)));
        return;
      }
      const cm = rows('c_members').slice().sort((a, b) => +a.rank - +b.rank), pri = rows('c_priorities'), watch = rows('b_watch');
      const iss = new Map(rows('c_issues').map((r) => [r.issue, r]));
      S.sub = `Recommended engagement plan · council minutes ${span} and Chamber documents`;
      S.add(glance([
        cm[0] && `Start with ${cm[0].full_name} (${cm[0].stance.toLowerCase()}), then build to ${k.min_winning_yeas || 4} of ${k.seats || 7} votes in the order below.`,
        watch.length ? `Next meeting ${dlong(watch[0].next_meeting)}: ${watch.map((w) => w.file).join(', ')}. Written comments are due by noon the day before.` : 'No business items are scheduled to return in the latest minutes.',
        `Frame every ask in the Chamber's own values: a strong business climate is a strong community; equity is the lens.`,
      ]));
      S.add(section('Outreach order', grid([
        { h: '#', w: '.25fr', cell: (r) => r.rank, cls: 'n b' },
        { h: 'Member', w: '1.1fr', cell: (r) => r.full_name, cls: 'b' },
        { h: 'Stance', w: '1.3fr', cell: (r) => chip(r.stance.split(/[:(]/)[0].trim(), +r.rank <= 2) },
        { h: 'Approach', w: '3.2fr', cell: (r) => cut(first(r.approach), 115) },
        { h: 'With majority', w: '1.2fr', cell: (r) => bar(r.majority_share, 1, DARK) },
      ], cm)));
      S.add(section('Chamber priorities', grid([
        { h: 'Priority', w: '1.2fr', cell: (r) => r.priority, cls: 'b' },
        { h: 'Where it stands', w: '2fr', cell: (r) => cut(r.status, 95) },
        { h: 'Next step', w: '2.6fr', cell: (r) => cut(r.next_step, 125) },
      ], pri)));
      if (watch.length) S.add(section('Next meeting: call first', grid([
        { h: 'File', w: '.7fr', cell: (r) => r.file, cls: 'b' },
        { h: 'Item', w: '2.6fr', cell: (r) => cut(r.item, 72) },
        { h: 'Stage', w: '.9fr', cell: (r) => r.stage },
        { h: 'Call first', w: '1.6fr', cell: (r) => { const i = iss.get(r.issue); return i ? [...new Set(['Coleman', i.lead_1, i.lead_2].filter((x) => x && x !== NA))].join(', ') : NA; } },
      ], watch)));
    },
  };

  // ---------- assemble, fit to one page, print ----------
  const PAGE_W = 739, PAGE_H = 965; // US letter at 96 dpi with 0.4in margins
  const build = () => {
    document.getElementById('print-sheet')?.remove();
    const root = el('div'); root.id = 'print-sheet';
    const S = { title: document.title, sub: '', body: el('div', 'ps-body'), add(x) { this.body.appendChild(x); } };
    B[KIND](S);
    const head = el('header', 'ps-head'); const hl = el('div');
    hl.appendChild(el('h1', '', S.title)); if (S.sub) hl.appendChild(el('div', 'ps-sub', S.sub));
    head.appendChild(hl);
    head.appendChild(el('div', 'ps-stamp', `Printed ${d3.timeFormat('%b %-d, %Y')(new Date())}`));
    root.appendChild(head); root.appendChild(S.body);
    root.appendChild(el('footer', 'ps-foot', `Source: St. Paul City Council meeting minutes (stpaul.legistar.com)${span ? ', ' + span : ''}. Counts are roll-call votes; “split” means at least one yea and one nay.`));
    document.body.appendChild(root);
    let z = 1;
    for (let i = 0; i < 6; i++) {
      root.style.zoom = z; root.style.width = PAGE_W / z + 'px';
      const h = root.scrollHeight * z;
      if (h <= PAGE_H + 1) break;
      z = Math.max(0.5, z * (PAGE_H / h) * 0.995);
    }
    return root;
  };
  const btn = document.getElementById('sa-print');
  if (btn) btn.addEventListener('click', () => { build(); requestAnimationFrame(() => setTimeout(() => window.print(), 60)); });
  window.addEventListener('afterprint', () => document.getElementById('print-sheet')?.remove());
  window.__buildPrintSheet = build;
})();
