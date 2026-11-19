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
  const blank = () => ({ sel: [], active: '', topic: '', item: '', issue: '', issueSet: false, ask: '', facts: [{ t: '', s: '' }, { t: '', s: '' }, { t: '', s: '' }], table: null, story: '', solution: '', why: {}, from: '', contact: '' });
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
      const a = h('textarea'); a.rows = 1; a.maxLength = 180;
      const grow = () => { a.style.height = 'auto'; a.style.height = a.scrollHeight + 2 + 'px'; }; a.placeholder = ['e.g. 42 drive-thru restaurants employ 600 St. Paul residents.', 'e.g. 70% of drive-thru sales come after 5 p.m.', 'e.g. Minneapolis reversed its ban in 2025.'][i] || 'Another fact'; a.value = f.t; a.setAttribute('aria-label', `Fact ${i + 1}`);
      const s = h('input'); s.maxLength = 70; s.placeholder = 'Source'; s.value = f.s; s.setAttribute('aria-label', `Source for fact ${i + 1}`);
      a.addEventListener('input', () => { f.t = a.value; grow(); update(false); });
      requestAnimationFrame(grow);
      s.addEventListener('input', () => { f.s = s.value; update(false); });
      box.append(a, s); row.append(box); factsBox.appendChild(row);
    });
  };


  // ---------- pull facts from a document: read it in the browser, skim for key takeaways ----------
  // Nothing is uploaded anywhere; the file is read on this computer only.
  const td = new TextDecoder();
  async function unzip(buf) {
    const v = new DataView(buf), u8 = new Uint8Array(buf), files = {};
    let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not a zip');
    let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
    for (let i = 0; i < n; i++) {
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      files[name] = async () => {
        const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), raw = u8.subarray(start, start + size);
        if (method === 0) return td.decode(raw);
        const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return td.decode(await new Response(ds).arrayBuffer());
      };
    }
    return files;
  }
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const tagText = (el, ns) => [...el.getElementsByTagName(ns)].map((t) => t.textContent).join('');
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

  async function readDoc(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase(), buf = await file.arrayBuffer();
    if (ext === 'pdf') {
      const pdfjs = await import(new URL('vendor/pdfjs.min.js', location.href).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs.worker.min.js', location.href).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise, pages = [];
      for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
        const items = (await (await doc.getPage(i)).getTextContent()).items.filter((t) => t.str && t.str.trim());
        const rows = [];
        items.forEach((t) => { const y = t.transform[5], r = rows.find((r) => Math.abs(r.y - y) < Math.max(2, (t.height || 8) * 0.45)); (r || (rows.push({ y, it: [] }), rows[rows.length - 1])).it.push(t); });
        rows.sort((a, b) => b.y - a.y);
        const tidy = (o) => o.replace(/ +/g, ' ').replace(/ ?\t ?/g, '\t').trim();
        pages.push(rows.flatMap((r) => {
          r.it.sort((a, b) => a.transform[4] - b.transform[4]);
          const segs = []; let out = '', end = null;
          r.it.forEach((t) => {
            const x = t.transform[4], fs = t.height || 8;
            if (end != null && x < end - fs) { segs.push(tidy(out)); out = ''; end = null; } // overlapping text: a separate stream
            if (end != null) out += x - end > fs * 0.8 ? '\t' : (x - end > fs * 0.15 || /\s$/.test(out) ? ' ' : '');
            out += t.str; end = x + (t.width || 0);
          });
          segs.push(tidy(out)); return segs.reverse().filter(Boolean);
        }));
      }
      return pages;
    }
    if (ext === 'docx') {
      const z = await unzip(buf); const d = xml(await z['word/document.xml']()); const out = [];
      const body = d.getElementsByTagName('w:body')[0] || d.documentElement;
      [...body.children].forEach((el) => {
        if (el.localName === 'tbl') [...el.getElementsByTagName('w:tr')].forEach((tr) => out.push([...tr.getElementsByTagName('w:tc')].map((tc) => tagText(tc, 'w:t').trim()).join('\t')));
        else if (el.localName === 'p') { const style = (el.getElementsByTagName('w:pStyle')[0] || {}).getAttribute?.('w:val') || ''; const num = el.getElementsByTagName('w:numPr').length; const t = tagText(el, 'w:t').trim(); if (t) out.push((/heading|title/i.test(style) ? '#' : num ? '• ' : '') + t); }
      });
      return [out];
    }
    if (ext === 'pptx') {
      const z = await unzip(buf); const names = Object.keys(z).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(natural);
      return Promise.all(names.map(async (n) => [...xml(await z[n]()).getElementsByTagName('a:p')].map((p) => tagText(p, 'a:t').trim()).filter(Boolean)));
    }
    if (ext === 'xlsx') {
      const z = await unzip(buf);
      const ss = z['xl/sharedStrings.xml'] ? [...xml(await z['xl/sharedStrings.xml']()).getElementsByTagName('si')].map((si) => tagText(si, 't')) : [];
      const names = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(natural);
      return Promise.all(names.map(async (n) => [...xml(await z[n]()).getElementsByTagName('row')].map((row) => [...row.getElementsByTagName('c')].map((c) => {
        const t = c.getAttribute('t'), vv = (c.getElementsByTagName('v')[0] || {}).textContent || '';
        if (t === 's') return ss[+vv] || ''; if (t === 'inlineStr') return tagText(c, 't');
        const s = c.getAttribute('s'); return vv && !isNaN(vv) && Math.abs(+vv) >= 1000 && !/^\d{4}$/.test(vv) ? Math.round(+vv).toLocaleString('en-US') : vv; // keep years as-is
      }).map((x) => String(x).trim()).filter(Boolean).join('\t')).filter(Boolean)));
    }
    const text = td.decode(buf);
    if (ext === 'csv') return [text.split(/\r?\n/).map((l) => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur.trim()); cur = ''; } else cur += ch; } c.push(cur.trim()); return c.filter(Boolean).join('\t'); }).filter(Boolean)];
    return [text.split(/\r?\n/).map((l) => l.replace(/^#+\s*/, (m) => '#')).map((l) => l.trim()).filter(Boolean)];
  }

  const NUM = /(\$\s?\d|\d[\d,.]*\s?%|\b\d{1,3}(,\d{3})+\b|\b\d+(\.\d+)?\s?(x|times|percent|jobs|businesses|residents|people|days|weeks|months|years|million|billion|thousand|k)\b|\b(one|two|three|four|five|half|double|triple)\b(?= (of|times|as))|\b\d{3,}\b(?!\s*(·|-|–)\s*\d))/i;
  const ABBR = /\b(St|Mr|Mrs|Ms|Dr|vs|No|Inc|Co|Jr|Sr|Ave|Blvd|approx|est|Jan|Feb|Mar|Apr|Aug|Sept?|Oct|Nov|Dec|e\.g|i\.e|U\.S|a\.m|p\.m)\./g;
  const sentences = (t) => (t.replace(ABBR, (m) => m.replace(/\./g, '\u2024')).match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [t]).map((x) => x.replace(/\u2024/g, '.').trim()).filter(Boolean);
  const COMPARE = /\b(highest|lowest|most|least|more|less|fewer|double|triple|twice|half|times|than|above|below|only|every|increase[sd]?|decrease[sd]?|rose|fell|grew|cut|drop(ped)?|gap|cost(s|ly)?|save[sd]?|lose|lost)\b/i;
  const KEYHEAD = /(key\s+(takeaways?|findings?|points?|facts?|messages?)|takeaways?|highlights?|summary|executive summary|conclusions?|bottom line|what we found|findings|recommendations?|at a glance)/i;
  const isHeading = (l) => l.startsWith('#') || (l.length <= 40 && KEYHEAD.test(l) && !/[.;,]$/.test(l)) || (/^[A-Z][a-z’']*( [a-z&’'/-]+| [A-Z][\w’'/-]*){0,4}$/.test(l) && !/\t/.test(l)) || (l.length <= 70 && !/[.;:,]$/.test(l) && !NUM.test(l) && !l.includes('\t') && (/^[A-Z0-9 &/,'’()-]{4,}$/.test(l) || /^([A-Z][\w’'&/-]*\s?){1,7}$/.test(l)));

  function skim(pages, fname) {
    // 1. stitch lines that a print cut across pages (a spreadsheet printed in two halves, for example)
    let lines = [];
    const first = new Set();
    pages.forEach((pg, pi) => pg.forEach((l) => { const k = l.toLowerCase(); if (first.has(k)) return; first.add(k); lines.push({ t: l, pg: pi }); })); // repeated page headers and columns
    const tailLen = 22;
    for (const a of lines) {
      if (a.dead || a.t.length < 40) continue;
      for (let guard = 0; guard < 4; guard++) {
        const tail = a.t.slice(-tailLen); let hit = false;
        for (const b of lines) {
          if (b === a || b.dead || b.pg === a.pg || b.t.length < tailLen + 4) continue;
          const i = b.t.indexOf(tail);
          if (i >= 0 && i + tailLen < b.t.length && !a.t.includes(b.t.slice(i + tailLen, i + tailLen + 12))) { a.t += b.t.slice(i + tailLen); b.dead = true; hit = true; break; }
        }
        if (!hit) break;
      }
    }
    lines = lines.filter((l) => !l.dead).map((l) => l.t);
    // drop fragments that are just a piece of a longer line (the cut-off half of a stitched line)
    lines = lines.filter((l) => l.length < 14 || !lines.some((m) => m !== l && m.length > l.length && m.includes(l)));
    // 2. title, sections, paragraphs and table rows
    const okTitle = (l) => l.length >= 8 && l.length <= 100 && !l.includes('\t') && !/[.:;,]$/.test(l) && !/^(page \d|key take)/i.test(l) && !/^\s*(\d+[.)]|[•●▪\-–*])\s/.test(l);
    const title = (lines.find((l) => l.startsWith('#') && okTitle(l.slice(1))) || lines.slice(0, 6).find(okTitle) || fname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')).replace(/^#/, '').trim();
    const paras = [], rows = []; let sec = '', cur = null, header = null;
    const bulletRe = /^\s*(\d{1,2}[.)]|[•●▪◦\-–*])\s+/;
    for (const raw of lines) {
      const l = raw.replace(/^#/, '').trim(); if (!l || l === title) continue;
      const cells = l.split('\t').map((c) => c.trim()).filter(Boolean).flatMap((c, i) => { const m = i && c.match(/^([$\-–(]?\s?[\d,.]+%?\)?)\s+(.+)$/); return m ? [m[1], m[2]] : [c]; });
      const numCells = cells.filter((c) => /^[$\-–(]?\s?[\d,.]+%?\)?$|^n\/?a$|^—$/i.test(c));
      if (cells.length >= 3 && numCells.length === cells.length - 1 && cells.slice(1).every((c) => /^(19|20)\d{2}$/.test(c))) { header = cells; cur = null; continue; } // a row of years is a header
      if (cells.length >= 2 && numCells.length >= 1 && !numCells.includes(cells[0]) && (numCells.length >= 2 || header) && cells.length - numCells.length <= 3) {
        const label = cells[0].replace(/\s*\([^)]*$/, '').trim(), vals = cells.slice(1);
        const hd = header ? header.slice(header.length > vals.length ? 1 : 0).slice(0, vals.length) : [];
        const old = rows.find((r) => r.label === label);
        if (old) { old.vals.push(...vals); old.hd.push(...hd.concat(Array(vals.length - hd.length).fill(''))); }
        else rows.push({ label, vals, hd: hd.concat(Array(vals.length - hd.length).fill('')), sec });
        cur = null; continue;
      }
      if (cells.length >= 3 && !numCells.length && cells.every((c) => c.length < 40)) { header = cells; cur = null; continue; }
      const cellish = cells.length > 1 ? cells.join(' ') : l;
      if (raw.startsWith('#') || isHeading(cellish)) { sec = cellish; cur = null; continue; }
      const cont = cur && !bulletRe.test(cellish) && !/[.!?:)”"]$/.test(cur.t) && (/^[a-z(“"$0-9]/.test(cellish) || (cur.list && cellish.length > 30));
      if (!cont) { cur = { t: cellish.replace(bulletRe, ''), sec, list: bulletRe.test(cellish) }; paras.push(cur); }
      else cur.t += ' ' + cellish;
    }
    // 3. score points: a list item or a sentence that carries a number, a comparison, St. Paul, or sits under "Key takeaways"
    const pts = [];
    paras.forEach((p, pi) => {
      const key = KEYHEAD.test(p.sec);
      const parts = p.list || key ? [p.t] : sentences(p.t);
      parts.forEach((t, si) => {
        if (t.length < 25 || t.length > 900) return;
        let sc = 0;
        if (key) sc += 6; if (p.list) sc += 2; if (NUM.test(t)) sc += 3; if (COMPARE.test(t)) sc += 2;
        if (/\b(st\.?|saint)\s+paul\b/i.test(t)) sc += 1.5; if (/\b(business(es)?|jobs?|employ|owners?|tax|fees?|costs?|permits?|licen[sc]e)/i.test(t)) sc += 1;
        if (/\b(see|click|page \d|table of contents|copyright|prepared (by|for)|all rights)\b/i.test(t) && !NUM.test(t)) sc -= 4;
        if (si === 0) sc += 0.5; sc -= pi * 0.01;
        if (/·/.test(t) && /prepared|schedules?|vs\./i.test(t)) sc -= 5;
        pts.push({ t, sc, key, i: pts.length });
      });
    });
    pts.sort((a, b) => b.sc - a.sc);
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const take = []; for (const p of pts) { const n = norm(p.t); if (p.sc < 2.5 || take.some((q) => norm(q.t).includes(n) || n.includes(norm(q.t)))) continue; take.push(p); if (take.length >= 8) break; }
    // keep key takeaways in the document's own order
    if (take.filter((p) => p.key).length >= 3) take.sort((a, b) => (b.key - a.key) || (a.i - b.i));
    const points = take.map((p) => ({ full: p.t, short: shorten(p.t) }));
    const isNum = (v) => /^[$\-–(]?\s?[\d,.]+%?\)?$/.test(v);
    const data = rows.slice(0, 40).map((r) => {
      const parts = r.vals.map((v, i) => [r.hd[i] || '', v]).filter(([, v]) => !/^(n\/?a|—|-)$/i.test(v));
      const nums = parts.filter(([, v]) => isNum(v)).map(([k, v]) => (k ? `${k} ${v}` : v));
      const words = parts.filter(([, v]) => !isNum(v)).map(([k, v]) => (k ? `${k.toLowerCase()}: ${v}` : v));
      const t = `${r.label}: ${nums.join(' · ')}${words.length ? ` (${words.join('; ')})` : ''}`;
      return { full: t, short: shorten(t) };
    }).filter((r) => r.full.length > 8);
    const groups = [];
    rows.forEach((r) => {
      const n = r.vals.length, hd = r.hd.map((x, i) => x || (n > 1 ? `Value ${i + 1}` : 'Value'));
      let g = groups.find((g) => g.cols.length === hd.length && g.cols.every((c, i) => c === hd[i]));
      if (!g) { g = { cols: hd, rows: [] }; groups.push(g); }
      g.rows.push({ g: r.sec || '', label: r.label, vals: r.vals.map((v) => (/^(n\/?a|—|-)$/i.test(v) ? '' : v)) });
    });
    const tables = groups.filter((g) => g.rows.length >= 2 || g.cols.length >= 2).sort((a, b) => b.rows.length * b.cols.length - a.rows.length * a.cols.length)
      .map((g) => { // drop columns with no values
        const keep = g.cols.map((c, i) => g.rows.some((r) => r.vals[i]));
        return { cols: g.cols.filter((c, i) => keep[i]), rows: g.rows.slice(0, 20).map((r) => ({ g: r.g, label: r.label, vals: r.vals.filter((v, i) => keep[i]), on: true })) };
      }).filter((t) => t.cols.length);
    return { title, points, data, tables };
  }
  function shorten(t) {
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length <= 180) return t;
    const ss = sentences(t); let acc = '';
    for (const x of ss) { if ((acc + ' ' + x).trim().length > 180) break; acc = (acc + ' ' + x).trim(); }
    if (acc.length >= 90 || (acc.length >= 40 && NUM.test(acc))) return acc;
    const cut = t.slice(0, 178); const at = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', '), cut.lastIndexOf(' – '));
    return (at > 90 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,;:\s]+$/, '') + '…';
  }

  const skimBox = $('#op-skim'); let SK = null;
  function drawSkim() {
    skimBox.replaceChildren(); skimBox.hidden = !SK; if (!SK) return;
    const hd = h('div', 'op-skim-h'); const ti = h('div'); ti.append(h('b', '', SK.title || SK.name));
    if (SK.busy) ti.append(h('small', '', 'Reading the document…'));
    else if (SK.err) ti.append(h('small', '', SK.err));
    else ti.append(h('small', '', `${SK.points.length} key point${SK.points.length === 1 ? '' : 's'}${(SK.tables || []).length ? ` · ${SK.tables.length} table${SK.tables.length === 1 ? '' : 's'}` : ''} · click 1, 2 or 3 to use as a fact`));
    const x = h('button', 'op-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => { SK = null; drawSkim(); });
    hd.append(ti, x); skimBox.appendChild(hd);
    if (SK.busy || SK.err) return;
    if (!SK.points.length && !SK.data.length) { skimBox.appendChild(h('div', 'op-msg', 'No clear takeaways found. Try a document with written findings or a summary.')); return; }
    const acts = h('div', 'op-skim-acts');
    const all = SK.points.length >= 3 ? SK.points : [...SK.points, ...SK.data];
    if (all.length) { const b = h('button', 'op-q', `Use the top ${Math.min(3, all.length)} as facts`); b.type = 'button'; b.addEventListener('click', () => { all.slice(0, 3).forEach((p, i) => { S.facts[i] = { t: p.short, s: SK.source }; }); drawFacts(); update(false); drawSkim(); }); acts.appendChild(b); }
    if (SK.title && S.topic !== SK.title.slice(0, 90)) { const b = h('button', 'op-q', 'Use its title as the topic'); b.type = 'button'; b.addEventListener('click', () => { S.topic = SK.title.slice(0, 90); $('#f-topic').value = S.topic; detect(); refreshWhy(); update(); drawSkim(); }); acts.appendChild(b); }
    skimBox.appendChild(acts);
    const list = (head, arr) => {
      if (!arr.length) return;
      skimBox.appendChild(h('h4', '', head)); const ul = h('ul');
      arr.forEach((p) => {
        const used = S.facts.findIndex((f) => f.t === p.short);
        const li = h('li', 'op-pt' + (used >= 0 ? ' used' : '')); const tx = h('p');
        const m = p.short.match(/^([^:]{3,48}):\s(.+)$/); if (m) tx.append(h('i', '', m[1] + ': '), m[2]); else tx.textContent = p.short;
        if (p.short !== p.full) tx.title = p.full;
        const use = h('div', 'op-use'); use.setAttribute('role', 'group'); use.setAttribute('aria-label', 'Use as fact');
        [0, 1, 2].forEach((i) => { const b = h('button', '', String(i + 1)); b.type = 'button'; b.setAttribute('aria-pressed', String(used === i)); b.setAttribute('aria-label', `Use as fact ${i + 1}`); b.title = `Use as fact ${i + 1}`;
          b.addEventListener('click', () => { S.facts[i] = used === i ? { t: '', s: '' } : { t: p.short, s: SK.source }; drawFacts(); update(false); drawSkim(); }); use.appendChild(b); });
        li.append(tx, use); ul.appendChild(li);
      });
      skimBox.appendChild(ul);
    };
    list('Key points', SK.points);
    (SK.tables || []).forEach((tb, ti) => {
      const on = !!(S.table && S.table.key === SK.name + '#' + ti);
      const head = h('div', 'op-tbh'); const lab = h('label', 'op-tbon'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = on;
      cb.addEventListener('change', () => { S.table = cb.checked ? Object.assign(JSON.parse(JSON.stringify(tb)), { key: SK.name + '#' + ti, source: SK.source }) : null; update(false); drawSkim(); });
      lab.append(cb, h('span', '', on ? 'Table is on the one-pager' : 'Put this table on the one-pager'));
      head.append(h('h4', '', `Table${SK.tables.length > 1 ? ' ' + (ti + 1) : ''}: ${tb.rows.length} rows × ${tb.cols.length} columns`), lab);
      skimBox.appendChild(head);
      const ul = h('ul');
      tb.rows.forEach((r, ri) => {
        const vals = r.vals.map((v, i) => (v ? `${tb.cols[i]} ${v}` : '')).filter(Boolean).join(' · ');
        const txt = `${r.label}: ${vals}`; const short = shorten(txt);
        const used = S.facts.findIndex((f) => f.t === short);
        const li = h('li', 'op-pt' + (used >= 0 ? ' used' : '')); const tx = h('p');
        if (on) { const c = h('input'); c.type = 'checkbox'; c.checked = S.table.rows[ri].on; c.title = 'Show this row in the table'; c.setAttribute('aria-label', `Show ${r.label} in the table`); c.className = 'op-rowon';
          c.addEventListener('change', () => { S.table.rows[ri].on = c.checked; update(false); }); tx.appendChild(c); }
        tx.append(h('i', '', r.label + ': '), vals); if (short !== txt) tx.title = txt;
        const use = h('div', 'op-use'); use.setAttribute('role', 'group'); use.setAttribute('aria-label', 'Use as fact');
        [0, 1, 2].forEach((i) => { const b = h('button', '', String(i + 1)); b.type = 'button'; b.setAttribute('aria-pressed', String(used === i)); b.setAttribute('aria-label', `Use as fact ${i + 1}`); b.title = `Use as fact ${i + 1}`;
          b.addEventListener('click', () => { S.facts[i] = used === i ? { t: '', s: '' } : { t: short, s: SK.source }; drawFacts(); update(false); drawSkim(); }); use.appendChild(b); });
        li.append(tx, use); ul.appendChild(li);
      });
      skimBox.appendChild(ul);
    });
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { SK = { name: file.name, err: 'That file is over 25 MB. Try a shorter version.' }; drawSkim(); return; }
    SK = { name: file.name, busy: true }; drawSkim();
    try {
      const r = skim(await readDoc(file), file.name);
      SK = Object.assign({ name: file.name, source: r.title.slice(0, 70) }, r);
      if (r.tables.length) { S.table = Object.assign(JSON.parse(JSON.stringify(r.tables[0])), { key: file.name + '#0', source: SK.source }); update(false); }
    } catch (e) { SK = { name: file.name, err: 'Could not read this file. Save it as PDF, Word, Excel or text and try again.' }; console.warn(e); }
    drawSkim(); skimBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  window.__opSkim = skim; // used by the site's tests
  const drop = $('#op-drop'), fileIn = $('#op-file');
  fileIn.addEventListener('change', () => { importFile(fileIn.files[0]); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => importFile(e.dataTransfer.files[0]));

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
    const T = S.table, trs = T ? T.rows.filter((r) => r.on) : [];
    if (T && trs.length) {
      p.appendChild(h('h2', '', 'By the numbers'));
      const tb = h('table', 'pg-tb'); const hr = h('tr'); hr.appendChild(h('th', '', ''));
      const home = T.cols.map((c) => /\b(st\.?|saint)\s*paul\b/i.test(c) && !/south/i.test(c));
      T.cols.forEach((c, i) => { const th = h('th', home[i] ? 'home' : '', c); hr.appendChild(th); });
      const thead = h('thead'); thead.appendChild(hr); tb.appendChild(thead); const body = h('tbody'); let g = null;
      trs.forEach((r) => {
        if (r.g && r.g !== g && trs.some((x) => x.g !== r.g)) { const gr = h('tr', 'grp'); const td = h('td', '', r.g); td.colSpan = T.cols.length + 1; gr.appendChild(td); body.appendChild(gr); }
        g = r.g; const tr = h('tr'); tr.appendChild(h('th', '', r.label));
        T.cols.forEach((c, i) => { const v = r.vals[i] || ''; const td = h('td', (home[i] ? 'home ' : '') + (/^[$\-–(]?\s?[\d,.]+%?\)?$/.test(v) ? 'n' : v ? '' : 'e'), v || '—'); tr.appendChild(td); });
        body.appendChild(tr);
      });
      tb.appendChild(body); p.appendChild(tb);
      if (T.source) p.appendChild(h('div', 'pg-tsrc', 'Source: ' + T.source));
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
      [fits ? 'ok' : 'warn', fits ? 'Fits on one page' : (S.table && S.table.rows.some((r) => r.on) ? 'Too long: trim text or untick table rows' : 'Too long: trim text')],
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
    if (S.table && S.table.rows.some((r) => r.on)) {
      L.push('By the numbers:'); S.table.rows.filter((r) => r.on).forEach((r) => L.push(`- ${r.label}: ${r.vals.map((v, i) => (v ? `${S.table.cols[i]} ${v}` : '')).filter(Boolean).join(', ')}`));
      if (S.table.source) L.push(`(Source: ${S.table.source})`); L.push('');
    }
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
