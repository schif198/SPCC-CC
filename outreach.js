// One-pager builder: a persuasive, one-page brief per council member, built on the Chamber playbook.
(function () {
  const D = JSON.parse(document.getElementById('op-data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const byName = Object.fromEntries(D.members.map((m) => [m.m, m]));
  const KEY = 'op-draft-v1';

  // ---------- colour helpers (contrast-safe ink, light tints for print) ----------
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ink = (c) => (1.05 / (lum(c) + 0.05) >= 3 ? '#fff' : '#22182c');
  const tint = (c, a = 0.14) => '#' + rgb(c).map((v) => Math.round(255 - (255 - v) * a).toString(16).padStart(2, '0')).join('');
  const paint = (el, m) => { el.style.setProperty('--mc', m.color); el.style.setProperty('--mt', tint(m.color)); el.style.setProperty('--mtx', ink(m.color)); };

  // ---------- state ----------
  const blank = () => ({ sel: [], active: '', topic: '', item: '', issue: '', issueSet: false, ask: '', facts: [{ t: '', s: '' }, { t: '', s: '' }, { t: '', s: '' }], story: '', solution: '', why: {}, from: '', contact: '' });
  let S = blank();
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.sel)) S = Object.assign(blank(), v); } catch (e) { /* storage unavailable */ }
  S.sel = S.sel.filter((n) => byName[n]);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  // ---------- step 1: member chips ----------
  const chips = $('#op-members');
  D.members.forEach((m) => {
    const b = h('button', 'op-mb'); b.type = 'button'; b.dataset.m = m.m; paint(b, m);
    const wn = h('span', 'op-wn', m.ward);
    const t = h('span'); t.append(h('b', '', m.full), h('small', '', 'Ward ' + m.ward));
    b.append(wn, t, h('span', 'ck', '✓'));
    b.setAttribute('aria-label', `${m.full}, Ward ${m.ward}`);
    b.addEventListener('click', () => toggle(m.m));
    chips.appendChild(b);
  });
  const allBtn = h('button', 'op-q', 'Select all'); allBtn.type = 'button';
  allBtn.addEventListener('click', () => { S.sel = S.sel.length === D.members.length ? [] : D.members.map((m) => m.m); S.active = S.sel[0] || ''; S.sel.forEach(prefill); update(); });
  $('#s1').parentElement.querySelector('.op-hint').append(' ', allBtn);

  function toggle(n) {
    const i = S.sel.indexOf(n);
    if (i >= 0) { S.sel.splice(i, 1); if (S.active === n) S.active = S.sel[0] || ''; }
    else { S.sel.push(n); S.sel.sort((a, b) => byName[a].ward - byName[b].ward); S.active = n; prefill(n); }
    update();
  }

  // ---------- step 2: issue, agenda item, ask ----------
  const fItem = $('#f-item'), fIssue = $('#f-issue');
  D.watch.forEach((w, i) => { const o = h('option', '', `${w.f}: ${w.t}`); o.value = String(i); fItem.appendChild(o); });
  D.issues.forEach((x) => { const o = h('option', '', x.n); o.value = x.n; fIssue.appendChild(o); });
  const dateTxt = (d) => { if (!d) return ''; const t = new Date(d + 'T12:00'); return isNaN(t) ? d : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); };

  const detect = () => {
    if (S.issueSet) return;
    if (S.item !== '' && D.watch[+S.item]) { S.issue = D.watch[+S.item].issue; return; }
    const txt = ' ' + (S.topic + ' ' + S.ask + ' ' + S.solution).toLowerCase() + ' ';
    let best = '', score = 0;
    for (const x of D.issues) {
      const s = x.kw.reduce((a, k) => a + (txt.includes(k) ? k.length : 0), 0);
      if (s > score) { score = s; best = x.n; }
    }
    S.issue = best;
  };

  const quick = () => {
    const q = $('#op-quick'); q.replaceChildren();
    const w = S.item !== '' ? D.watch[+S.item] : null;
    const when = w && w.when ? ` on ${dateTxt(w.when)}` : '';
    const opts = w
      ? [`Vote yes on ${w.f}${when}.`, `Vote no on ${w.f}${when}.`, `Amend ${w.f} before the vote${when}.`, `Meet with us before ${w.f} comes up${when}.`]
      : ['Meet with us for 20 minutes this month.', 'Support this at the next council meeting.', 'Sponsor an ordinance to fix this.', 'Ask city staff for a report on this.'];
    opts.forEach((t) => { const b = h('button', 'op-q', t.replace(/\.$/, '')); b.type = 'button'; b.addEventListener('click', () => { S.ask = t; $('#f-ask').value = t; update(); $('#f-ask').focus(); }); q.appendChild(b); });
  };

  // ---------- step 3: facts ----------
  const factsBox = $('#op-facts');
  const drawFacts = () => {
    factsBox.replaceChildren();
    S.facts.forEach((f, i) => {
      const row = h('div', 'op-fact'); row.append(h('span', 'num', String(i + 1)));
      const box = h('div', 'in');
      const a = h('input'); a.maxLength = 180; a.placeholder = ['e.g. 42 drive-thru restaurants employ 600 St. Paul residents.', 'e.g. 70% of drive-thru sales come after 5 p.m.', 'e.g. Minneapolis reversed its ban in 2025.'][i] || 'Another fact'; a.value = f.t; a.setAttribute('aria-label', `Fact ${i + 1}`);
      const s = h('input'); s.maxLength = 70; s.placeholder = 'Source'; s.value = f.s; s.setAttribute('aria-label', `Source for fact ${i + 1}`);
      a.addEventListener('input', () => { f.t = a.value; update(false); });
      s.addEventListener('input', () => { f.s = s.value; update(false); });
      box.append(a, s); row.append(box); factsBox.appendChild(row);
    });
  };

  // ---------- step 4: tailoring ----------
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  function suggest(n) {
    const m = byName[n]; const r = m.issues[S.issue];
    const out = [];
    if (S.issue && r && r.lead > 0) out.push(`You have led on ${lc(S.issue)} this year (${r.lead} motion${r.lead === 1 ? '' : 's'} or remarks in favor), so your voice carries on this.`);
    else if (S.issue && r && r.push > 0) out.push(`We know you have raised concerns on ${lc(S.issue)} items, and we want to address them directly.`);
    return out.join(' ');
  }
  function prefill(n) { if (!S.why[n] || !S.why[n].edited) S.why[n] = { t: suggest(n), edited: false }; }
  const fWhy = $('#f-why');
  fWhy.addEventListener('input', () => { if (!S.active) return; S.why[S.active] = { t: fWhy.value, edited: true }; update(false); });
  const insertWhy = (t) => {
    if (!S.active) return;
    const cur = (S.why[S.active] && S.why[S.active].t) || '';
    const v = (cur ? cur.replace(/\s*$/, ' ') : '') + t.replace(/\s*$/, '');
    S.why[S.active] = { t: v.slice(0, 340), edited: true }; fWhy.value = S.why[S.active].t; update(false); fWhy.focus();
  };

  // ---------- inputs ----------
  const bind = (id, key) => { const el = $(id); el.value = S[key]; el.addEventListener('input', () => { S[key] = el.value; detect(); refreshWhy(); update(false); }); };
  bind('#f-topic', 'topic'); bind('#f-ask', 'ask'); bind('#f-story', 'story'); bind('#f-solution', 'solution'); bind('#f-from', 'from'); bind('#f-contact', 'contact');
  fItem.value = S.item; fIssue.value = S.issue;
  fItem.addEventListener('change', () => { S.item = fItem.value; S.issueSet = false; detect(); fIssue.value = S.issue; refreshWhy(); quick(); update(); });
  fIssue.addEventListener('change', () => { S.issue = fIssue.value; S.issueSet = !!fIssue.value; refreshWhy(); update(); });
  const refreshWhy = () => { S.sel.forEach(prefill); if (S.active && document.activeElement !== fWhy) fWhy.value = (S.why[S.active] || {}).t || ''; fIssue.value = S.issue; };

  // ---------- the page ----------
  const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const filled = (s) => (s || '').trim();
  function page(n, preview) {
    const m = byName[n]; const p = h('div', 'op-page'); paint(p, m);
    const ph = (el, txt, hint) => { if (filled(txt)) el.textContent = txt.trim(); else if (preview) { el.textContent = hint; el.classList.add('pg-ph'); } return el; };
    const head = h('div', 'pg-h'); const img = document.createElement('img'); img.src = D.logo; img.alt = 'St. Paul Area Chamber';
    const to = h('div', 'pg-to'); to.append(h('b', '', `${m.title || 'Council Member'} ${m.full}`), document.createTextNode(`Ward ${m.ward} · ${today()}`));
    head.append(img, to); p.appendChild(head);
    p.appendChild(ph(h('h1'), S.topic, 'Your topic headline'));
    const ask = h('div', 'pg-ask'); ask.append(h('span', '', 'Our ask')); ask.appendChild(ph(h('div'), S.ask, 'One clear ask: what you want her to do, and by when.')); p.appendChild(ask);
    const why = (S.why[n] && S.why[n].t) || '';
    if (filled(why) || preview) { p.append(h('h2', '', `Why it matters to Ward ${m.ward}`), ph(h('p', 'pg-why'), why, `What Ward ${m.ward} residents and businesses gain or lose.`)); }
    const facts = S.facts.filter((f) => filled(f.t));
    if (facts.length || preview) {
      p.appendChild(h('h2', '', facts.length === 1 ? 'The key fact' : `${facts.length > 1 ? ['', '', 'Two', 'Three', 'Four', 'Five'][facts.length] : 'Three'} facts to know`));
      const ol = h('ol', 'pg-facts');
      (facts.length ? facts : [{ t: '' }, { t: '' }, { t: '' }]).forEach((f, i) => {
        const li = h('li'); li.dataset.n = String(i + 1); const d = h('div');
        ph(d, f.t, 'A short fact staff can repeat'); if (filled(f.s)) d.appendChild(h('small', '', 'Source: ' + f.s.trim()));
        li.appendChild(d); ol.appendChild(li);
      });
      p.appendChild(ol);
    }
    if (filled(S.story) || preview) p.append(h('h2', '', 'A local story'), ph(h('blockquote'), S.story, 'A business in her ward, in its own words.'));
    if (filled(S.solution) || preview) p.append(h('h2', '', 'Our proposed solution'), ph(h('p', 'pg-sol'), S.solution, 'The fix you bring to the table.'));
    const foot = h('div', 'pg-f'); const l = h('div');
    if (filled(S.from)) { l.append(h('b', '', S.from.trim())); if (filled(S.contact)) l.append(document.createTextNode(' · ' + S.contact.trim())); }
    else l.textContent = 'St. Paul Area Chamber';
    const w = S.item !== '' ? D.watch[+S.item] : null;
    foot.append(l, h('div', '', w ? `${w.f}${w.when ? ' · council ' + dateTxt(w.when) : ''}` : 'St. Paul Area Chamber of Commerce'));
    p.appendChild(foot);
    return p;
  }
  // shrink type until the page fits; report whether it fits at the smallest size
  function fit(p) {
    let fs = 13; p.style.setProperty('--fs', fs + 'pt');
    const over = () => p.scrollHeight > p.clientHeight + 1;
    while (over() && fs > 9.5) { fs -= 0.25; p.style.setProperty('--fs', fs + 'pt'); }
    return !over();
  }

  // ---------- preview, tabs, tips, checklist ----------
  const stage = $('#op-stage'), tabs = $('#op-tabs'), tips = $('#op-tips'), check = $('#op-check');
  let fits = true;
  function drawPreview() {
    stage.replaceChildren();
    if (!S.active) { stage.appendChild(h('div', 'op-empty', 'Pick a member in step 1 to see her one-pager here.')); fits = true; return; }
    const wrap = h('div', 'op-scale'); const p = page(S.active, true); wrap.appendChild(p); stage.appendChild(wrap);
    fits = fit(p);
    scale();
  }
  function scale() {
    const wrap = $('.op-scale', stage); if (!wrap) return;
    const w = stage.clientWidth - 28, pw = wrap.firstChild.offsetWidth, k = Math.min(1, w / pw);
    wrap.style.transform = `scale(${k})`; wrap.style.height = wrap.firstChild.offsetHeight * k + 'px'; wrap.style.width = pw * k + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(scale).observe(stage); else window.addEventListener('resize', scale);

  function drawTabs() {
    tabs.replaceChildren();
    if (S.sel.length < 2) return;
    S.sel.forEach((n) => {
      const m = byName[n]; const b = h('button', 'op-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(n === S.active)); paint(b, m);
      b.append(h('span', 'op-wn', m.ward), document.createTextNode(m.m));
      b.addEventListener('click', () => { S.active = n; update(); });
      tabs.appendChild(b);
    });
  }

  function drawTips() {
    tips.replaceChildren();
    if (!S.active) return;
    const m = byName[S.active]; paint(tips, m);
    tips.appendChild(h('h3', '', `Coaching for ${m.m}: not printed`));
    const dl = h('dl');
    const row = (k, v) => { if (!v || (Array.isArray(v) && !v.length)) return; const dd = h('dd'); if (v instanceof Node) dd.appendChild(v); else dd.textContent = v; dl.append(h('dt', '', k), dd); };
    row('Lead with', m.lead_with);
    row('She engages on', m.engage_on);
    const r = m.issues[S.issue];
    if (S.issue) row('Her record', r && (r.lead || r.push) ? `On ${lc(S.issue)}: ${r.lead} lead${r.lead === 1 ? '' : 's'}, ${r.push} pushback${r.push === 1 ? '' : 's'} this year.` : `No recorded lead or pushback on ${lc(S.issue)} this year.`);
    row('Be careful', m.cautions);
    const add = (list) => {
      if (!list.length) return null;
      const box = h('div'); list.forEach((t) => { const b = h('button', 'op-q', '+ ' + t.replace(/\.$/, '')); b.type = 'button'; b.title = 'Add to “Why it matters”'; b.style.margin = '0 4px 4px 0'; b.addEventListener('click', () => insertWhy(t)); box.appendChild(b); });
      return box;
    };
    row('Ward cares about', add([...m.prio, ...m.biz].slice(0, 6)));
    const iss = D.issues.find((x) => x.n === S.issue);
    if (iss && (iss.pos || iss.frame)) row('Chamber frame', add([iss.pos, iss.frame].filter(Boolean).map((s) => s.replace(/"/g, ''))));
    const reach = h('div');
    if (m.best.length) reach.append(document.createTextNode(m.best.slice(0, 2).join(' ')), h('br'));
    if (m.aide) reach.append(document.createTextNode(`Aide: ${m.aide}`), h('br'));
    if (m.phone) reach.append(document.createTextNode(m.phone + (m.email ? ' · ' : '')));
    if (m.email) { const a = h('a', '', m.email); a.href = 'mailto:' + m.email; reach.appendChild(a); }
    if (reach.childNodes.length) row('Deliver it', reach);
    const more = h('a', '', 'Full ward notes →'); more.href = 'research.html#member=' + encodeURIComponent(m.m); row('More', more);
    tips.appendChild(dl);
  }

  function drawCheck() {
    check.replaceChildren();
    if (!S.sel.length) return;
    check.appendChild(h('h3', '', 'Playbook check'));
    const ul = h('ul');
    const facts = S.facts.filter((f) => filled(f.t)); const unsourced = facts.filter((f) => !filled(f.s)).length;
    const noWhy = S.sel.filter((n) => !filled((S.why[n] || {}).t));
    const items = [
      [filled(S.topic) ? 'ok' : 'no', 'Clear headline'],
      [filled(S.ask) ? 'ok' : 'no', 'One clear ask'],
      [facts.length >= 3 ? (unsourced ? 'warn' : 'ok') : 'no', facts.length >= 3 ? (unsourced ? `Add ${unsourced === 1 ? 'a source' : unsourced + ' sources'}` : 'Three facts, sourced') : `Three facts (${facts.length} of 3)`],
      [noWhy.length ? 'no' : 'ok', noWhy.length ? `Ward stake: ${noWhy.join(', ')}` : 'Ward stake for each member'],
      [filled(S.story) ? 'ok' : 'no', 'A local story'],
      [filled(S.solution) ? 'ok' : 'no', 'A proposed solution'],
      [fits ? 'ok' : 'warn', fits ? 'Fits on one page' : 'Too long: trim text'],
      [filled(S.from) ? 'ok' : 'no', 'Signed with your name'],
    ];
    items.forEach(([c, t]) => { const li = h('li', c); li.append(h('i', '', c === 'ok' ? '✓' : c === 'warn' ? '!' : '')); li.append(h('span', '', t)); ul.appendChild(li); });
    check.appendChild(ul);
  }

  function update(full = true) {
    if (full) {
      chips.querySelectorAll('.op-mb').forEach((b) => b.setAttribute('aria-pressed', String(S.sel.includes(b.dataset.m))));
      allBtn.textContent = S.sel.length === D.members.length ? 'Clear all' : 'Select all';
      drawTabs(); drawTips();
      const m = byName[S.active];
      $('#why-who').textContent = m ? `Ward ${m.ward} (${m.m})` : 'her ward';
      fWhy.disabled = !m; fWhy.placeholder = m ? `What Ward ${m.ward} residents and businesses gain or lose.` : 'Pick a member first.';
      if (document.activeElement !== fWhy) fWhy.value = m ? (S.why[S.active] || {}).t || '' : '';
    } else if (S.issue !== (tips.dataset.issue || '')) drawTips();
    tips.dataset.issue = S.issue;
    drawPreview(); drawCheck();
    $('#op-print').disabled = !S.sel.length; $('#op-copy').disabled = !S.active;
    $('#op-print span').textContent = S.sel.length > 1 ? `Print ${S.sel.length} one-pagers` : 'Print one-pager';
    save();
  }

  // ---------- actions ----------
  const sheet = $('#print-sheet');
  $('#op-print').addEventListener('click', () => {
    if (!S.sel.length) return;
    sheet.replaceChildren(...S.sel.map((n) => page(n, false)));
    sheet.style.visibility = 'visible';
    sheet.querySelectorAll('.op-page').forEach(fit);
    sheet.style.visibility = '';
    window.print();
  });
  window.addEventListener('afterprint', () => sheet.replaceChildren());

  const toast = (msg, undo) => {
    let t = $('#op-toast'); if (!t) { t = h('div'); t.id = 'op-toast'; t.setAttribute('role', 'status'); Object.assign(t.style, { position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)', background: '#2a0157', color: '#fff', padding: '10px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '.88rem', zIndex: 60, display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.2)' }); document.body.appendChild(t); }
    t.replaceChildren(h('span', '', msg));
    if (undo) { const b = h('button', '', 'Undo'); Object.assign(b.style, { font: 'inherit', color: '#fff', background: 'transparent', border: '1.5px solid #fff', borderRadius: '6px', padding: '2px 10px', cursor: 'pointer' }); b.addEventListener('click', () => { undo(); t.remove(); }); t.appendChild(b); }
    clearTimeout(t._h); t._h = setTimeout(() => t.remove(), undo ? 7000 : 2500);
  };

  $('#op-copy').addEventListener('click', () => {
    const m = byName[S.active]; if (!m) return;
    const facts = S.facts.filter((f) => filled(f.t));
    const L = [`Subject: ${filled(S.topic) || 'A request from the St. Paul Area Chamber'}`, '', `${m.title || 'Council Member'} ${m.full.split(' ').slice(-1)[0]},`, ''];
    if (filled(S.ask)) L.push(`Our ask: ${S.ask.trim()}`, '');
    const why = filled((S.why[S.active] || {}).t); if (why) L.push(`Why it matters to Ward ${m.ward}: ${why}`, '');
    if (facts.length) { L.push(facts.length >= 3 ? 'Three facts to know:' : 'Key facts:'); facts.forEach((f, i) => L.push(`${i + 1}. ${f.t.trim()}${filled(f.s) ? ` (${f.s.trim()})` : ''}`)); L.push(''); }
    if (filled(S.story)) L.push(`A local story: ${S.story.trim()}`, '');
    if (filled(S.solution)) L.push(`Our proposed solution: ${S.solution.trim()}`, '');
    L.push('Thank you,', filled(S.from) || '', filled(S.contact) || '', 'St. Paul Area Chamber');
    const text = L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim();
    const done = () => toast(`Copied the email for ${m.m}`);
    const fallback = () => { const ta = h('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed: select the text manually'); } ta.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });

  $('#op-reset').addEventListener('click', () => {
    const prev = JSON.stringify(S);
    S = blank(); load(); toast('Cleared. Starting over.', () => { S = JSON.parse(prev); load(); });
  });

  function load() {
    ['topic', 'ask', 'story', 'solution', 'from', 'contact'].forEach((k) => { $('#f-' + k).value = S[k]; });
    fItem.value = S.item; fIssue.value = S.issue; drawFacts(); quick(); update();
  }

  // #member=Name (or Name,Name) preselects members
  const fromHash = () => {
    const q = new URLSearchParams(location.hash.slice(1)).get('member'); if (!q) return;
    const names = q.split(',').filter((n) => byName[n]); if (!names.length) return;
    names.forEach((n) => { if (!S.sel.includes(n)) S.sel.push(n); prefill(n); });
    S.sel.sort((a, b) => byName[a].ward - byName[b].ward); S.active = names[0]; update();
  };
  if (!S.active && S.sel.length) S.active = S.sel[0];
  load(); fromHash(); window.addEventListener('hashchange', fromHash);
})();
