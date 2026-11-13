/* Upload new minutes straight from the website.
   Files are checked in the browser (is it City Council minutes? which meeting? already in the library?),
   then saved to the site's GitHub repository with an upload key, which starts the automatic rebuild.
   Progress is shown until the updated site is live. */
(() => {
  const CFG = window.__UPLOAD__ || {};
  const LIB = window.__LIB__ || { meetings: [] };
  const API = CFG.api || 'https://api.github.com';
  const KEY_STORE = 'spcc-upload-key';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const longDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const store = { get() { try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } },
    set(k, remember) { try { (remember ? localStorage : sessionStorage).setItem(KEY_STORE, k); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch (e) {} } };
  let memKey = '';

  const dlg = $('#up'), openBtn = $('#lib-upload-open');
  if (!dlg || !openBtn) return;
  const files = []; // {file, name, size, status, info, buf}
  let busy = false;

  // ---------- PDF reading (pdf.js) ----------
  let pdfjsP = null;
  const loadPdfjs = () => pdfjsP || (pdfjsP = import(new URL('vendor/pdfjs.min.js', location.href).href).then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs.worker.min.js', location.href).href; return m;
  }).catch(() => null));
  async function inspect(buf) {
    const head = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 1024)));
    if (!head.includes('%PDF')) return { kind: 'bad', why: 'This isn’t a PDF file.' };
    const pdfjs = await loadPdfjs();
    if (!pdfjs) return { kind: 'unknown' };
    try {
      const task = pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) });
      const doc = await task.promise;
      const page = await doc.getPage(1);
      const text = (await page.getTextContent()).items.map((i) => i.str).join(' ').replace(/\s+/g, ' ');
      const pages = doc.numPages; try { task.destroy(); } catch (e) {}
      if (!/Meeting Minutes/i.test(text) || !/City Council/i.test(text)) return { kind: 'bad', why: 'This doesn’t look like City Council meeting minutes.', pages };
      const m = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i);
      if (!m) return { kind: 'bad', why: 'No meeting date found on the first page.', pages };
      const iso = `${m[4]}-${String(MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
      // the scheduled time sits next to the date (before or after it, depending on the PDF's text order)
      let time = '', best = 1e9;
      for (const t of text.matchAll(/(\d{1,2}:\d{2})\s*([AP]M)/gi)) {
        if (/(started|adjourned|recessed|reconvened)[^.]{0,12}$/i.test(text.slice(Math.max(0, t.index - 25), t.index))) continue;
        const d = Math.abs(t.index - m.index); if (d < best && d < 160) { best = d; time = `${t[1]} ${t[2].toUpperCase()}`; }
      }
      const dup = LIB.meetings.some((x) => x.date === iso && (!time || x.time === time));
      return { kind: dup ? 'dup' : 'ok', date: iso, time, pages };
    } catch (e) { console.warn('PDF check failed:', e); return { kind: 'bad', why: 'This PDF couldn’t be read.' }; }
  }

  // ---------- rendering ----------
  const list = $('#up-files'), keyBox = $('#up-key'), keyIn = $('#up-key-in'), remember = $('#up-remember'), pub = $('#up-publish'), msg = $('#up-msg');
  const savedKey = () => memKey || store.get();
  function renderKey() {
    const k = savedKey();
    $('#up-key-saved').hidden = !k; $('#up-key-new').hidden = !!k;
  }
  function ready() { return files.filter((f) => f.status === 'ok' || f.status === 'unknown'); }
  function render() {
    list.replaceChildren();
    for (const f of files) {
      const row = el('div', 'up-row s-' + f.status);
      const ic = el('div', 'up-ic'); ic.textContent = { checking: '…', ok: '✓', unknown: '✓', dup: '=', bad: '!' }[f.status] || '';
      const mid = el('div', 'up-mid');
      mid.appendChild(el('div', 'up-name', f.name));
      const sub = el('div', 'up-sub');
      if (f.status === 'checking') sub.textContent = `${fmtSize(f.size)} · Checking…`;
      else if (f.status === 'ok') sub.textContent = `City Council minutes · ${longDate(f.info.date)} · ${f.info.time} · ${f.info.pages} pages`;
      else if (f.status === 'unknown') sub.textContent = `${fmtSize(f.size)} · Couldn’t preview here; it will be checked during the update`;
      else if (f.status === 'dup') sub.textContent = `Already in the library: ${longDate(f.info.date)} (${f.info.time}). It won’t be added again.`;
      else sub.textContent = f.info.why;
      mid.appendChild(sub);
      const chip = el('span', 'up-chip', { checking: 'Checking', ok: 'Ready', unknown: 'Ready', dup: 'Already added', bad: 'Can’t use' }[f.status]);
      const rm = el('button', 'up-rm', '×'); rm.type = 'button'; rm.title = 'Remove'; rm.setAttribute('aria-label', 'Remove ' + f.name); rm.disabled = busy;
      rm.addEventListener('click', () => { files.splice(files.indexOf(f), 1); render(); });
      row.append(ic, mid, chip, rm); list.appendChild(row);
    }
    $('#up-drop').classList.toggle('compact', files.length > 0);
    const n = ready().length;
    pub.disabled = busy || !n || files.some((f) => f.status === 'checking');
    pub.textContent = n ? `Publish ${n} meeting${n > 1 ? 's' : ''}` : 'Publish';
  }
  async function addFiles(fl) {
    for (const file of fl) {
      if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
      const f = { file, name: file.name, size: file.size, status: 'checking', info: {} };
      files.push(f); render();
      if (file.size > 50 * 1048576) { f.status = 'bad'; f.info = { why: 'This file is larger than 50 MB.' }; render(); continue; }
      f.buf = await file.arrayBuffer();
      const r = await inspect(f.buf);
      f.info = r; f.status = r.kind;
      if (r.kind === 'ok' && files.some((o) => o !== f && o.status === 'ok' && o.info.date === r.date && o.info.time === r.time)) { f.status = 'dup'; f.info = r; }
      render();
    }
  }

  // drop zone + browse
  const drop = $('#up-drop'), input = $('#up-input');
  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  // allow dropping anywhere on the dialog
  dlg.addEventListener('dragover', (e) => e.preventDefault());
  dlg.addEventListener('drop', (e) => { e.preventDefault(); if (e.target.closest('#up-drop')) return; addFiles([...e.dataTransfer.files]); });

  $('#up-key-forget').addEventListener('click', () => { store.clear(); memKey = ''; renderKey(); });
  $('#up-key-show').addEventListener('click', () => { keyIn.type = keyIn.type === 'password' ? 'text' : 'password'; });

  // ---------- GitHub API ----------
  async function gh(path, key, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { Accept: 'application/vnd.github+json', ...(key ? { Authorization: 'Bearer ' + key } : {}), ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
    let body = null; try { body = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((body && body.message) || r.statusText); err.status = r.status; throw err; }
    return body;
  }
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const friendly = (e) => {
    if (e.status === 401) return 'The upload key wasn’t accepted. It may be mistyped or expired. Enter a new key and try again.';
    if (e.status === 403) return 'The upload key doesn’t allow saving files to this site. It needs “Contents: Read and write” access to the repository.';
    if (e.status === 404) return 'The upload key can’t see this site’s repository. When creating the key, choose this repository under “Repository access”.';
    if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
    return 'Something went wrong while saving (' + (e.message || 'unknown error') + '). Nothing was changed; please try again.';
  };

  // ---------- progress ----------
  const prog = $('#up-progress'), steps = [...prog.querySelectorAll('.up-step')];
  let timer = null;
  function setStep(i, state, detail) {
    const DONE = ['Files sent.', 'Saved in the minutes library.', 'Every dashboard and one-pager rebuilt.'];
    steps.forEach((s, k) => { s.classList.remove('active', 'done', 'fail'); if (k < i) { s.classList.add('done'); $('.up-sd', s).textContent = DONE[k] || ''; delete $('.up-sd', s).dataset.elapsed; } });
    const s = steps[i]; if (s) { s.classList.add(state); if (detail != null) $('.up-sd', s).textContent = detail; }
  }
  function view(which) { $('#up-form').hidden = which !== 'form'; prog.hidden = which !== 'progress'; }

  async function publish() {
    if (busy) return;
    let key = savedKey();
    if (!key) {
      key = keyIn.value.trim();
      if (!key) { msg.textContent = 'Enter the upload key to publish.'; keyIn.focus(); return; }
    }
    const todo = ready();
    if (!todo.length) return;
    busy = true; msg.textContent = ''; render(); view('progress');
    $('#up-reload').hidden = true; $('#up-retry').hidden = true; $('#up-runlink').hidden = true;
    steps.forEach((x) => { $('.up-sd', x).textContent = ''; delete $('.up-sd', x).dataset.elapsed; });
    const repo = CFG.repo, branch = CFG.branch || 'main', base = (CFG.path || '').replace(/^\/|\/$/g, '');
    try {
      setStep(0, 'active', `Sending ${todo.length} file${todo.length > 1 ? 's' : ''}…`);
      const ref = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, key);
      // key works: remember it if asked
      if (!savedKey()) { if (remember.checked) store.set(key, true); else memKey = key; renderKey(); }
      const head = ref.object.sha;
      const commit = await gh(`/repos/${repo}/git/commits/${head}`, key);
      let existing = [];
      try { existing = (await gh(`/repos/${repo}/contents${base ? '/' + base.split('/').map(encodeURIComponent).join('/') : ''}?ref=${encodeURIComponent(branch)}`, key)).map((x) => x.name); } catch (e) { if (e.status !== 404) throw e; }
      const tree = [];
      for (const [i, f] of todo.entries()) {
        setStep(0, 'active', `Sending ${f.name} (${i + 1} of ${todo.length})…`);
        const blob = await gh(`/repos/${repo}/git/blobs`, key, { method: 'POST', body: JSON.stringify({ content: b64(f.buf), encoding: 'base64' }) });
        let name = f.name.replace(/[^\w.\- ]+/g, '_');
        if (!/\.pdf$/i.test(name)) name += '.pdf';
        if (existing.includes(name) || tree.some((t) => t.path.endsWith('/' + name) || t.path === name)) name = name.replace(/\.pdf$/i, '') + (f.info.date ? '_' + f.info.date : '_' + Date.now()) + '.pdf';
        tree.push({ path: (base ? base + '/' : '') + name, mode: '100644', type: 'blob', sha: blob.sha });
      }
      setStep(1, 'active', 'Adding to the minutes library…');
      const t = await gh(`/repos/${repo}/git/trees`, key, { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
      const label = todo.map((f) => f.info.date ? longDate(f.info.date) : f.name).join('; ');
      const c = await gh(`/repos/${repo}/git/commits`, key, { method: 'POST', body: JSON.stringify({ message: `Add City Council minutes: ${label} (uploaded from the website)`, tree: t.sha, parents: [head] }) });
      try { await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, key, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) }); }
      catch (e) { if (e.status === 422) throw Object.assign(new Error('Someone else updated the site at the same moment. Please try again.'), { status: 0 }); throw e; }
      setStep(2, 'active', 'Waiting for the update to start…');
      await watch(c.sha, key);
    } catch (e) {
      const i = steps.findIndex((s) => s.classList.contains('active'));
      setStep(Math.max(0, i), 'fail', e.status === 0 ? e.message : friendly(e));
      if (e.status === 401 || e.status === 403 || e.status === 404) { store.clear(); memKey = ''; renderKey(); }
      $('#up-retry').hidden = false;
    } finally { busy = false; clearInterval(timer); render(); }
  }

  async function watch(sha, key) {
    const t0 = Date.now();
    const el2 = $('.up-sd', steps[2]);
    timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); el2.dataset.elapsed = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let run = null;
    while (Date.now() - t0 < 20 * 60 * 1000) {
      try {
        const r = await gh(`/repos/${CFG.repo}/actions/runs?head_sha=${sha}&per_page=5`, key);
        run = (r.workflow_runs || [])[0] || null;
      } catch (e) { if (e.status === 403 || e.status === 404) { run = { status: 'unknown' }; } }
      if (run && run.status === 'unknown') {
        setStep(2, 'active', 'Saved. The dashboards are rebuilding now; this usually takes about 3 minutes. (Progress can’t be shown with this upload key.)');
        await wait(4 * 60 * 1000); break;
      }
      if (run && run.html_url) $('#up-runlink').href = run.html_url, $('#up-runlink').hidden = false;
      if (!run || run.status === 'queued' || run.status === 'waiting' || run.status === 'pending' || run.status === 'requested') setStep(2, 'active', 'Saved. The update is about to start…');
      else if (run.status !== 'completed') setStep(2, 'active', 'Reading the minutes and rebuilding every dashboard (about 3 minutes)…');
      else if (run.conclusion === 'success') break;
      else { setStep(2, 'fail', 'The minutes were saved, but the update didn’t finish. The site still shows the previous version. Open the details to see why.'); $('#up-retry').hidden = true; return; }
      await wait(8000);
    }
    setStep(3, 'done', 'The library, dashboards and one-pagers now include the new minutes.');
    files.splice(0, files.length, ...files.filter((f) => !ready().includes(f)));
    $('#up-reload').hidden = false;
  }

  pub.addEventListener('click', publish);
  $('#up-retry').addEventListener('click', () => { view('form'); render(); });
  $('#up-reload').addEventListener('click', () => { location.href = location.pathname + '?v=' + Date.now(); });
  openBtn.addEventListener('click', () => { if (!busy) view(prog.hidden ? 'form' : (steps[3].classList.contains('done') ? 'form' : 'progress')); renderKey(); render(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
  dlg.querySelectorAll('.up-close').forEach((b) => b.addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }));
  if (!CFG.repo) { $('#up-setup-warn').hidden = false; }

  // ---------- site status banner (public, no key needed) ----------
  const banner = $('#lib-status');
  async function status() {
    if (!CFG.repo || !banner) return;
    try {
      const r = await gh(`/repos/${CFG.repo}/actions/runs?per_page=1&branch=${encodeURIComponent(CFG.branch || 'main')}`);
      const run = (r.workflow_runs || [])[0];
      if (!run) return;
      const builtAt = new Date(LIB.built).getTime(), started = new Date(run.created_at).getTime();
      if (run.status !== 'completed') {
        const mins = Math.max(0, Math.round((Date.now() - started) / 60000));
        banner.className = 'lib-status busy'; banner.hidden = false;
        banner.textContent = `New minutes are being added to the site (started ${mins ? mins + ' min' : 'moments'} ago). This page will refresh when it’s done.`;
        setTimeout(status, 20000); banner.dataset.watching = '1';
      } else if (run.conclusion === 'success' && started > builtAt + 60000) {
        banner.className = 'lib-status ok'; banner.hidden = false; banner.replaceChildren();
        banner.append('An update has finished. ');
        const a = el('a', '', 'Reload to see the latest minutes'); a.href = location.pathname + '?v=' + Date.now(); banner.appendChild(a);
        if (banner.dataset.watching) location.href = a.href;
      } else if (run.conclusion && run.conclusion !== 'success' && run.conclusion !== 'cancelled') {
        banner.className = 'lib-status fail'; banner.hidden = false; banner.replaceChildren();
        banner.append('The most recent update didn’t finish, so the site shows the previous version. ');
        const a = el('a', '', 'See what happened'); a.href = run.html_url; a.target = '_blank'; a.rel = 'noopener'; banner.appendChild(a);
      }
    } catch (e) { /* status is optional */ }
  }
  status();
})();
