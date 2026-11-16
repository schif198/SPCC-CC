"""Build the website in _site/ from build/out (made by run.py) and web/.

Usage (from the repository root):  python3 pipeline/build_site.py
Optional environment: GITHUB_REPOSITORY (owner/repo) and GITHUB_REF_NAME (branch) set the upload button target;
both are set automatically inside GitHub Actions.
"""
import csv, datetime, html, io, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'out')
WEB = os.path.join(ROOT, 'web')
SITE = os.path.join(ROOT, '_site')
LEGISTAR = 'https://stpaul.legistar.com/DepartmentDetail.aspx?ID=11351&GUID=54C2264A-286D-435B-85A5-F0C20155343F&Mode=MainBody'
REPO = os.environ.get('GITHUB_REPOSITORY', '').strip()
BRANCH = os.environ.get('GITHUB_REF_NAME', 'main').strip() or 'main'
_ws = os.environ.get('GITHUB_WORKSPACE', '')
_rel = os.path.relpath(ROOT, _ws).replace(os.sep, '/') if _ws else '.'
MINUTES_PATH = 'minutes' if _rel in ('.', '') else f'{_rel}/minutes'
if 'MINUTES_UPLOAD_PATH' in os.environ:  # set by the workflow, which knows where the minutes live in the repository
    MINUTES_PATH = os.environ['MINUTES_UPLOAD_PATH'].strip('/')
UPLOAD_URL = (f'https://github.com/{REPO}/upload/{BRANCH}' + (f'/{MINUTES_PATH}' if MINUTES_PATH else '')) if REPO else ''
ACTIONS_URL = f'https://github.com/{REPO}/actions' if REPO else ''


def rd(p): return open(os.path.join(WEB, p), encoding='utf-8').read()
def js(s): return s.replace('</script', '<\\/script').replace('<!--', '<\\!--')
def esc(s): return html.escape(s, quote=True)
def csvtext(n): return open(os.path.join(OUT, n + '.csv'), encoding='utf-8').read()


D3, SHIM, PRINTJS, THEME, SITECSS, SITEJS = rd('vendor/d3.min.js'), rd('shim.js'), rd('print.js'), rd('theme.css'), rd('site.css'), rd('site.js')
import base64
def b64(p): return base64.b64encode(open(os.path.join(WEB, p), 'rb').read()).decode()
FONTS = ''.join(f"@font-face{{font-family:'Montserrat';font-weight:{w};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{b64(f'vendor/montserrat-latin-{w}-normal.woff2')}) format('woff2');}}" for w in (400, 500, 600, 700, 800))
LOGO_URI = 'data:image/png;base64,' + b64('vendor/chamber-logo.png')
FAVICON = '<link rel="icon" type="image/png" href="data:image/png;base64,' + b64('vendor/favicon.png') + '">'
THEME = FONTS + '\n:root { --brand-logo: url(' + LOGO_URI + '); }\n' + THEME
totals = list(csv.DictReader(open(os.path.join(OUT, 'totals.csv'))))[0]
kp = list(csv.DictReader(open(os.path.join(OUT, 'b_kpis.csv'))))[0]
FIRST, LAST, NEXT = totals['first_meeting'], totals['last_meeting'], kp.get('next_meeting', '')
BUILT = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def d(s, f):
    return datetime.date.fromisoformat(s).strftime(f).replace(' 0', ' ') if s else ''


LONG = lambda s: d(s, '%B %d, %Y')
SPAN_LONG = f'{LONG(FIRST)} – {LONG(LAST)}'
META = dict(first=FIRST, last=LAST, next=NEXT, built=BUILT)

PRINT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
GROUPS = [
    ('Council record', [('voting-trends.html', 'Voting trends', 'Totals, months and every split vote'),
                        ('member-by-member.html', 'Members', 'One member’s votes, allies and focus'),
                        ('platforms.html', 'Platforms vs. votes', 'Campaign priorities next to the record')]),
    ('Chamber strategy', [('course-of-action.html', 'Course of action', 'Who to talk to, and how, on any issue'),
                          ('playbook.html', 'Chamber playbook', 'Business items, coalitions and timing')]),
    ('Minutes & help', [('library.html', 'Minutes library', 'Every meeting, with the original PDFs'),
                        ('library.html#upload', 'Add new minutes', 'Upload the latest minutes PDF'),
                        ('glossary.html', 'Glossary', 'What the terms on this site mean')]),
]
PAGE_INFO = {
    'voting-trends.html': ('Council record', 'Voting trends', 'How does the council vote as a whole?'),
    'member-by-member.html': ('Council record', 'Members', 'How does each member vote, and who do they vote with?'),
    'platforms.html': ('Council record', 'Platforms vs. votes', 'How does each member’s council activity line up with their campaign?'),
    'course-of-action.html': ('Chamber strategy', 'Course of action', 'Who should the Chamber talk to, and how?'),
    'playbook.html': ('Chamber strategy', 'Chamber playbook', 'Which business items are coming, and who decides them?'),
}
GLOSSARY = [
    ('split', 'Split vote', r'split vote|\bsplits?\b', 'A roll-call vote with at least one yea and one nay. Most council votes are unanimous, so split votes show where members differ.'),
    ('unanimous', 'Unanimous', r'unanimous|no dissent', 'Every member who voted cast the same vote.'),
    ('consent', 'Consent agenda', r'consent', 'Routine items approved together in a single vote unless a member pulls one out for discussion.'),
    ('majority', 'With the majority', r'with (the )?majority|sided with', 'How often a member voted on the winning side of split votes.'),
    ('dissent', 'Dissent', r'dissent', 'A vote on the losing side of a split vote.'),
    ('pushback', 'Pushback', r'pushback|push back', 'Times a member spoke against an item, raised concerns, or moved to delay or deny it.'),
    ('motions', 'Motions', r'\bmotions?\b', 'Motions a member made to approve, amend or deny an item.'),
    ('participation', 'Participation', r'participation|votes cast', 'The share of roll-call votes a member took part in (was not absent for).'),
    ('focus', 'Leads on', r'leads? on|take the lead|focus', 'Topics where a member’s motions and remarks make up a bigger share of their activity than the council average. Often reflects their own ward.'),
    ('coalition', 'Coalition', r'coalition', 'Members who usually vote together on split votes.'),
    ('persia', 'PERSIA', r'persia|lens', 'A way to sort issues by their Political, Economic, Religious, Social, Intellectual and Artistic (cultural) dimensions.'),
    ('readings', 'Readings and layovers', r'reading|layover|laid over|delay|ordinance clock|days to', 'Ordinances get first, second and third readings and a public hearing before final adoption. A layover moves an item to a later meeting.'),
    ('towin', 'Votes to win', r'votes to win|carry a', 'Four of the seven members’ votes carry a vote.'),
    ('active', 'Active record', r'active record|campaign priorities and council activity', 'On Platforms vs. votes: 4 or more motions or remarks on a theme (Active), or 4+ at an above-average share (Leading).'),
]
GLOSSARY_JS = [dict(id=i, term=t, rx=rx, df=d) for i, t, rx, d in GLOSSARY]
for g in GLOSSARY_JS: g['def'] = g.pop('df')
SEARCH_PAGES = [dict(href=h, title=t, desc=desc) for _, items in GROUPS for h, t, desc in items]


def site_data():
    mem = [dict(m=r['member'], full=r['full_name']) for r in csv.DictReader(open(os.path.join(OUT, 'c_members.csv')))]
    return f'<script>window.__SITE__ = {js(json.dumps(dict(members=mem, glossary=GLOSSARY_JS, pages=SEARCH_PAGES)))};</script>'


def nav(current, printable):
    cur = ' aria-current="page"'
    grp = ''
    for name, items in GROUPS:
        on = any(h == current for h, _, _ in items)
        links = ''.join(f'<a href="{h}"{cur if h == current else ""}><b>{t}</b><span>{desc}</span></a>' for h, t, desc in items)
        grp += f'<div class="sa-grp{" cur" if on else ""}"><button class="sa-grp-b" type="button" aria-expanded="false">{name}</button><div class="sa-grp-p">{links}</div></div>'
    pr = f'<button id="sa-print" class="sa-btn" type="button" title="Print a one-page summary of what this page shows">{PRINT_ICON}Print one-pager</button>' if printable else ''
    return (f'<nav class="sa-nav" aria-label="Site"><a class="brand" href="index.html" aria-label="St. Paul Area Chamber: council dashboards home">St. Paul Area Chamber</a>'
            f'<button class="sa-toggle" type="button" aria-expanded="false">Menu</button>'
            f'<div class="sa-menu"><a class="sa-home" href="index.html"{cur if current == "index.html" else ""}>Home</a>{grp}</div>'
            f'<form class="sa-search" role="search" autocomplete="off"><input type="search" placeholder="Search members, items, topics" aria-label="Search the site"><div class="sa-sugg" role="listbox" hidden></div></form>'
            f'<div class="act"><a class="sa-btn ghost" href="{LEGISTAR}" target="_blank" rel="noopener" title="The city’s official list of City Council meetings, agendas and minutes">Legistar ↗</a>{pr}</div></nav>')


def template(page, out=None):
    """Swap fixed date wording in the page sources for the dates in the current data, and give every page the same top."""
    page = re.sub(r'January 7 (–|through) October 28(, 2026)?', lambda m: f'{LONG(FIRST)} {m[1]} {LONG(LAST)}', page)
    page = page.replace('; the November 4 meeting had no minutes yet.', '.')
    nxt = f'Next meeting: {d(NEXT, "%A, %B %d")}' if NEXT else 'Next meeting: no items scheduled to return in the latest minutes'
    page = page.replace('Next meeting: Wednesday, November 4', nxt)
    if out in PAGE_INFO:
        group, title, ask = PAGE_INFO[out]
        page = re.sub(r'<p class="(lede|sub)">.*?</p>', '', page, count=1, flags=re.S)
        top = (f'<div class="sa-crumb">{group}</div><h1>{title}</h1><p class="sa-ask">{ask}</p>'
               f'<div id="sa-glance" class="sa-glance" aria-live="polite" hidden></div>')
        page = re.sub(r'<h1>.*?</h1>', lambda m: top, page, count=1, flags=re.S)
    return page


def shell(title, body, head_extra='', scripts=''):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
{FAVICON}
<style>{THEME}
{SITECSS}</style>
{head_extra}
</head>
<body>
{body}
{scripts}
</body>
</html>
"""


def dashboard(out, title, page_file, app_file, data, params, kind):
    page = template(rd('pages/' + page_file), out)
    page = re.sub(r'<meta name="dash-one-writer">\s*', '', page)
    page = re.sub(r'<script src="app\.js"></script>\s*', '', page)
    app = rd('pages/' + app_file) if app_file else ''
    raw = {k: (v if isinstance(v, str) and '\n' in v else csvtext(v)) for k, v in data.items()}
    head = (f'<script>{js(D3)}</script>\n<script>window.__DASH_DATA__ = {js(json.dumps(raw))}; window.__DASH_PARAMS__ = {json.dumps(params)}; '
            f'window.__META__ = {json.dumps(META)}; window.__LOGO__ = {json.dumps(LOGO_URI)}; window.__LEGISTAR__ = {json.dumps(LEGISTAR)};</script>\n<script>{js(SHIM)}</script>')
    body = (f'{nav(out, True)}\n<div id="dash-root">\n{page}\n<p class="sa-foot">Data: St. Paul City Council meeting minutes, {SPAN_LONG}. '
            f'Updates automatically when new minutes are added to the <a href="library.html">minutes library</a>.</p>\n</div>')
    scripts = (f'<script>{js(app)}</script>\n<script>window.__PRINT_KIND__ = {json.dumps(kind)};</script>\n<script>{js(PRINTJS)}</script>\n'
               f'{site_data()}\n<script>{js(SITEJS)}</script>')
    open(os.path.join(SITE, out), 'w', encoding='utf-8').write(shell(title, body, head, scripts))


def short_title(t):
    """A plain-language headline for a council item, for at-a-glance reading."""
    t = re.sub(r'\s+', ' ', t or '').strip().rstrip('.')
    cap = lambda x: x[:1].upper() + x[1:]
    m = re.search(r'rezone property at (.+?) from .+? to ([A-Z]\w*) ([a-z ]+?) district', t)
    if m: return f'Rezone {m.group(1)} to {m.group(3).strip()} ({m.group(2)})'
    m = re.match(r'Adding Chapter [\w.]+, (.+?), to the Legislative Code', t)
    if m: return f'{cap(m.group(1).lower())}: new rules' + (' and license fee' if re.search(r'licen[cs]e fee|licensing fee', t, re.I) else '')
    m = re.search(r'set rates for (.+?) to be effective \w+ \d+, (\d{4})', t)
    if m: return f'{cap(re.sub(r"^base level ", "", m.group(1)))} rates for {m.group(2)}'
    m = re.search(r'sound level variance .*?for the (.+?) (?:event )?on ', t)
    if m: return f'Sound variance: {m.group(1)}'
    m = re.search(r'pertaining to (.+)$', t)
    if m and t.startswith('Amending'): return cap(re.split(r'[;,] (?:and )?(?:amending|to )', m.group(1))[0]) + ': code change'
    m = re.match(r'Approving the application of (.+?) for (?:a |an )?(.+?)(?: in order| at |$)', t)
    if m: return f'{cap(m.group(2))}: {m.group(1)}'
    t = re.sub(r'^(Amending|Approving|Authorizing|Establishing|Granting|Accepting|Adding|Ratifying)\s+(the\s+)?', '', t)
    t = re.sub(r' of the (Legislative|Administrative) Code', '', t)
    t = re.sub(r' in (Chapter|Section)s? [\w.]+( and [\w.]+)?', '', t)
    if len(t) > 70: t = t[:70].rsplit(' ', 1)[0] + '…'
    return cap(t)


def playbook_watch():
    rows = list(csv.DictReader(open(os.path.join(OUT, 'b_watch.csv'))))
    try: hist = list(csv.DictReader(io.StringIO(watch_history())))
    except Exception: hist = []
    for r in rows:
        if r.get('last_tally') == 'NOT AVAILABLE': r['last_tally'] = 'no roll call yet'
        if r.get('movers') == 'NOT AVAILABLE': r['movers'] = ''
        full = r['item']
        for h in hist:
            if h['file'] == r['file'] and len(h['title']) > len(full): full = h['title']
        r['short'] = short_title(full)
    if not rows:
        return 'file,item,issue,next_meeting,stage,last_action_date,last_tally,movers,persia,short\n'
    s = io.StringIO(); w = csv.DictWriter(s, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    return s.getvalue()


def watch_history():
    """Every appearance of each upcoming business item in the minutes: date, action, remarks and vote."""
    watch = list(csv.DictReader(open(os.path.join(OUT, 'b_watch.csv'))))
    files = [w['file'] for w in watch]
    cols = ['file', 'date', 'pdf', 'title', 'action', 'notes', 'tally']
    rows = []
    try: meetings = sorted(json.load(open(os.path.join(OUT, 'meetings.json')))['meetings'], key=lambda m: m['date'])
    except Exception: meetings = []
    head = re.compile(r'^\s*\d{1,3}\s+([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)* \d{2}-\d+)\s{2,}(\S.*)$')
    stop = re.compile(r'^\s*(Yea:|Nay:|Absent:|City of Saint Paul\b|City Council\s{3,}|Page \d)')
    ACT = re.compile(r'^(Laid over|Adopted|Approved|Denied|Withdrawn|Referred|Continued|Received and filed|Rejected|Failed|Amended|Public hearing (?:held|closed)|Moved to)', re.I)
    NOTE = re.compile(r'\b(Councilmember|Council President|Council Vice President|spoke|moved|answered|testified|remarks|raised)\b')
    for m in meetings:
        p = os.path.join(ROOT, 'build', 'pdftxt', m.get('txt', ''))
        if not files or not os.path.exists(p): continue
        lines = open(p, encoding='utf-8', errors='ignore').read().split('\n')
        for i, ln in enumerate(lines):
            h = head.match(ln)
            if not h or h.group(1) not in files: continue
            title = [h.group(2).strip()]; acts = []; notes = []; tally = ''; in_vote = False; body = False
            for ln2 in lines[i + 1:i + 60]:
                if head.match(ln2): break
                t = ln2.strip()
                if not t: in_vote = False; continue
                if re.match(r'^[A-Z][A-Z &,\-]{5,}$', t.split('  ')[0]) and not t.startswith('NOT '): break  # next section heading
                if stop.match(ln2):
                    if t.startswith('Yea:'): tally = re.sub(r'\D', '', t[4:9]); in_vote = True
                    elif t.startswith('Nay:'): tally = f"{tally}-{re.sub(r'[^0-9]', '', t[4:9]) or '0'}"; in_vote = True
                    elif t.startswith('Absent:'): in_vote = True
                    continue
                if in_vote: continue
                if ACT.match(t): acts.append(t); body = True
                elif body or NOTE.search(t): notes.append(t); body = True
                else: title.append(t)
            action = acts[-1] if acts else ''
            note_txt = ' '.join(notes + acts[:-1])
            rows.append(dict(file=h.group(1), date=m['date'], pdf=m['file'], title=' '.join(title), action=action, notes=note_txt, tally=tally))
    import io
    s = io.StringIO(); w = csv.DictWriter(s, fieldnames=cols); w.writeheader(); w.writerows(rows)
    return s.getvalue()


def library(meetings):
    REPO_NAME = REPO.split('/')[-1] if REPO else 'this site’s repository'
    GH_FALLBACK = (f'<p class="up-alt">Prefer GitHub? <a href="{UPLOAD_URL}" target="_blank" rel="noopener">Upload there instead ↗</a></p>' if UPLOAD_URL else '')
    if UPLOAD_URL:
        up_btn = f'<a class="sa-btn" href="{UPLOAD_URL}" target="_blank" rel="noopener">Open the upload page ↗</a>'
        status = f'<a href="{ACTIONS_URL}" target="_blank" rel="noopener">Check update progress ↗</a>'
    else:
        up_btn = '<span class="lib-warn">The upload page will work once the site is set up on GitHub (see the setup guide).</span>'
        status = ''
    body = f"""{nav('library.html', False)}
<main class="lib">
  <header class="lib-head">
    <div>
      <h1>City Council meeting minutes</h1>
      <p class="lib-lede">Every set of minutes behind the dashboards, with the original documents. Search for any item, file number or date.</p>
    </div>
    <div class="lib-cta">
      <button id="lib-upload-open" class="sa-btn" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>Upload new minutes</button>
      <a class="sa-btn ghost" href="{LEGISTAR}" target="_blank" rel="noopener">Find minutes on Legistar ↗</a>
    </div>
  </header>
  <div id="lib-status" class="lib-status" role="status" hidden></div>
  <section class="lib-stats">
    <div><b id="lib-count">—</b><span>meetings</span></div>
    <div><b id="lib-range">—</b><span>covered</span></div>
    <div><b id="lib-latest">—</b><span>latest minutes</span></div>
    <div><b id="lib-built">—</b><span>site last updated</span></div>
  </section>
  <section class="lib-tools">
    <input id="lib-q" type="search" placeholder="Search items, file numbers or dates (e.g. drive-through, Ord 26-51, October)" aria-label="Search the minutes">
    <div id="lib-months" class="lib-months" aria-label="Month"></div>
    <div id="lib-shown" class="lib-shown"></div>
  </section>
  <section id="lib-list"></section>
  <dialog id="up" class="up" aria-labelledby="up-title">
    <div class="up-headbar"><h2 id="up-title">Add meeting minutes</h2><button class="up-x up-close" type="button" aria-label="Close">×</button></div>
    <div id="up-form">
      <p id="up-setup-warn" class="up-warn" hidden>Uploading will work once this site is published from GitHub (see the setup guide).</p>
      <label id="up-drop" class="up-drop">
        <input id="up-input" type="file" accept="application/pdf,.pdf" multiple hidden>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5"/></svg>
        <span class="up-dt">Drop minutes PDFs here</span>
        <span class="up-dd">or <u>choose files</u> from your computer · get them from the <a href="{LEGISTAR}" target="_blank" rel="noopener">city’s Legistar page</a></span>
      </label>
      <div id="up-files" class="up-files" aria-live="polite"></div>
      <div id="up-key" class="up-key">
        <div id="up-key-saved" hidden>🔑 Using the upload key saved on this device. <button id="up-key-forget" class="up-link" type="button">Forget key</button></div>
        <div id="up-key-new">
          <label for="up-key-in" class="up-kl">Upload key</label>
          <div class="up-krow"><input id="up-key-in" type="password" autocomplete="off" spellcheck="false" placeholder="Paste the upload key (starts with github_pat_)"><button id="up-key-show" class="sa-btn ghost" type="button">Show</button></div>
          <label class="up-rem"><input id="up-remember" type="checkbox" checked> Remember on this device</label>
          <details class="up-help"><summary>Don’t have an upload key?</summary>
            <p>Ask the site’s owner for one. Owners create it once in GitHub:</p>
            <ol>
              <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>.</li>
              <li>Name it “Minutes upload”, pick an expiration (up to a year).</li>
              <li>Under <b>Repository access</b>, choose <b>Only select repositories</b> → <b>{REPO_NAME}</b>.</li>
              <li>Under <b>Permissions → Repository</b>, set <b>Contents</b> to <b>Read and write</b> and <b>Actions</b> to <b>Read-only</b>.</li>
              <li>Click <b>Generate token</b> and share it only with people who should add minutes.</li>
            </ol>
          </details>
        </div>
      </div>
      <p id="up-msg" class="up-msg" role="alert"></p>
      <div class="up-foot"><span class="up-fn">Only City Council minutes are added. Duplicates and other files are skipped.</span><button id="up-publish" class="sa-btn" type="button" disabled>Publish</button></div>
      {GH_FALLBACK}
    </div>
    <div id="up-progress" hidden>
      <ol class="up-steps">
        <li class="up-step"><b>Send the files</b><span class="up-sd"></span></li>
        <li class="up-step"><b>Add to the minutes library</b><span class="up-sd"></span></li>
        <li class="up-step"><b>Rebuild the dashboards</b><span class="up-sd"></span></li>
        <li class="up-step"><b>Live on the site</b><span class="up-sd"></span></li>
      </ol>
      <p class="up-fn">You can close this window; the update keeps going. <a id="up-runlink" href="#" target="_blank" rel="noopener" hidden>Technical details ↗</a></p>
      <div class="up-foot"><button id="up-retry" class="sa-btn ghost" type="button" hidden>Back</button><button id="up-reload" class="sa-btn" type="button" hidden>See the updated library</button></div>
    </div>
  </dialog>
</main>"""
    css = """<style>
.lib { max-width: 1100px; margin: 0 auto; padding: 24px 20px 60px; font-family: var(--font-anthropic-sans); }
.lib-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; }
.lib h1 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 2rem; margin: 0; }
.lib-lede { color: var(--color-fg-muted); margin: 6px 0 0; max-width: 40rem; line-height: 1.5; }
.lib-cta { display: flex; flex-wrap: wrap; gap: 8px; }
.lib-cta .sa-btn { font-size: .95rem; padding: 9px 18px; }
.lib-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 10px; margin: 20px 0 16px; }
.lib-stats div { background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: 10px; padding: 10px 14px; }
.lib-stats b { display: block; font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 1.2rem; }
.lib-stats span { font-size: .75rem; color: var(--color-fg-muted); text-transform: uppercase; letter-spacing: .04em; }
.lib-tools { position: sticky; top: 0; z-index: 3; background: var(--color-bg); padding: 10px 0; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--color-border-line); }
#lib-q { font: inherit; font-size: 1rem; padding: 10px 14px; border: 1px solid var(--color-border-line); border-radius: 10px; background: var(--color-panel); color: var(--color-fg); }
.lib-months { display: flex; flex-wrap: wrap; gap: 4px; }
.lib-chip { font: inherit; font-size: .8rem; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--color-border-line); background: var(--color-panel); color: var(--color-fg); cursor: pointer; }
.lib-chip[aria-pressed=true] { background: var(--color-fg); color: var(--color-bg); border-color: var(--color-fg); }
.lib-shown { font-size: .8rem; color: var(--color-fg-muted); }
.lib-month { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 1.3rem; margin: 22px 0 8px; }
.lib-card { background: var(--color-panel); border: 1px solid var(--color-border-line); border-left: 4px solid #f15a25; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
.lib-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; align-items: center; }
.lib-date { font-weight: 600; font-size: 1rem; }
.lib-kind { font-size: .8rem; color: var(--color-fg-muted); margin-top: 2px; }
.lib-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.lib-facts { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: .85rem; color: var(--color-fg-muted); }
.lib-fact b { color: var(--color-fg); }
.lib-items { margin-top: 8px; font-size: .85rem; }
.lib-items summary { cursor: pointer; color: var(--color-fg-muted); }
.lib-items ul { margin: 6px 0 0; padding-left: 18px; columns: 2 26rem; column-gap: 24px; }
.lib-items li { margin-bottom: 4px; break-inside: avoid; line-height: 1.35; }
.lib-items li b { margin-right: 4px; }
.lib-empty { color: var(--color-fg-muted); padding: 20px 0; }
.lib-dialog { max-width: 34rem; border: 1px solid var(--color-border-line); border-radius: 14px; padding: 20px 24px; background: var(--color-panel); color: var(--color-fg); font-family: var(--font-anthropic-sans); }
.lib-dialog::backdrop { background: rgba(0,0,0,.35); }
.lib-dialog h2 { font-family: var(--font-anthropic-serif); font-weight: 400; margin: 0 0 8px; }
.lib-dialog ol { padding-left: 20px; line-height: 1.5; }
.lib-dialog a { color: inherit; }
.lib-small { font-size: .8rem; color: var(--color-fg-muted); }
.lib-dacts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 10px; }
.lib-warn { font-size: .85rem; color: var(--color-bad); }
.lib-status { margin: 14px 0 0; padding: 10px 14px; border-radius: 10px; font-size: .9rem; border: 1px solid var(--color-border-line); }
.lib-status.busy { background: #fff6e0; border-color: #e3c37a; color: #5a4300; }
.lib-status.ok { background: #e9f5ee; border-color: #9ccbb0; color: #1d4d33; }
.lib-status.fail { background: #fbecea; border-color: #e3a49b; color: #2a0157; }
.lib-status a { color: inherit; font-weight: 600; }
.up { width: min(640px, 94vw); max-height: 90vh; border: 1px solid var(--color-border-line); border-radius: 16px; padding: 0; background: var(--color-panel); color: var(--color-fg); font-family: var(--font-anthropic-sans); }
.up::backdrop { background: rgba(20,18,15,.45); }
.up-headbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 22px 8px; }
.up-headbar h2 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 1.5rem; margin: 0; }
.up-x { font: inherit; font-size: 1.5rem; line-height: 1; border: 0; background: none; color: var(--color-fg-muted); cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.up-x:hover { background: var(--color-bg); color: var(--color-fg); }
#up-form, #up-progress { padding: 6px 22px 20px; }
.up-drop { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 26px 16px; border: 2px dashed #f3c3ad; border-radius: 14px; background: #fdf3ee; color: #5b2a86; cursor: pointer; transition: background .15s, border-color .15s; }
.up-drop:hover, .up-drop.over { background: #fbe3d8; border-color: #f15a25; }
.up-drop.compact { flex-direction: row; justify-content: center; gap: 10px; padding: 12px 16px; }
.up-drop.compact svg { width: 22px; height: 22px; }
.up-drop.compact .up-dd { display: none; }
.up-dt { font-weight: 600; font-size: 1.05rem; color: var(--color-fg); }
.up-dd { font-size: .85rem; color: var(--color-fg-muted); }
.up-dd a { color: inherit; }
.up-files { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.up-row { display: grid; grid-template-columns: 30px 1fr auto 28px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--color-border-line); border-radius: 10px; background: var(--color-bg); }
.up-ic { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: .85rem; background: var(--color-border-line); color: var(--color-fg); }
.s-ok .up-ic, .s-unknown .up-ic { background: #2f7d4f; color: #fff; }
.s-dup .up-ic { background: #b9b6ad; color: #fff; }
.s-bad .up-ic { background: #2a0157; color: #fff; }
.s-checking .up-ic { animation: upPulse 1s infinite alternate; }
@keyframes upPulse { from { opacity: .4 } to { opacity: 1 } }
.up-name { font-weight: 600; font-size: .92rem; overflow-wrap: anywhere; }
.up-sub { font-size: .82rem; color: var(--color-fg-muted); margin-top: 1px; }
.s-bad .up-sub { color: #5b2a86; }
.up-chip { font-size: .75rem; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--color-border-line); white-space: nowrap; }
.s-ok .up-chip, .s-unknown .up-chip { border-color: #2f7d4f; color: #2f7d4f; }
.s-bad .up-chip { border-color: #2a0157; color: #2a0157; }
.up-rm { font: inherit; font-size: 1.1rem; border: 0; background: none; color: var(--color-fg-muted); cursor: pointer; border-radius: 6px; }
.up-rm:hover { background: var(--color-border-line); }
.up-key { border-top: 1px solid var(--color-border-line); padding-top: 12px; font-size: .9rem; }
.up-kl { display: block; font-weight: 600; margin-bottom: 4px; }
.up-krow { display: flex; gap: 6px; }
.up-krow input { flex: 1; font: inherit; font-size: .9rem; padding: 8px 12px; border: 1px solid var(--color-border-line); border-radius: 8px; background: var(--color-bg); color: var(--color-fg); }
.up-rem { display: inline-flex; gap: 6px; align-items: center; margin-top: 6px; font-size: .85rem; color: var(--color-fg-muted); }
.up-help { margin-top: 8px; font-size: .85rem; color: var(--color-fg-muted); }
.up-help summary { cursor: pointer; }
.up-help ol { padding-left: 20px; line-height: 1.5; }
.up-help a { color: inherit; }
.up-link { font: inherit; border: 0; background: none; color: var(--color-fg); text-decoration: underline; cursor: pointer; padding: 0; }
.up-msg { color: #5b2a86; font-size: .85rem; min-height: 1em; margin: 8px 0 0; }
.up-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; }
.up-foot .sa-btn { font-size: .95rem; padding: 9px 20px; }
.up-foot .sa-btn:disabled { opacity: .35; cursor: not-allowed; }
.up-fn { font-size: .8rem; color: var(--color-fg-muted); margin: 0; }
.up-fn a, .up-alt a { color: inherit; }
.up-alt { font-size: .78rem; color: var(--color-fg-muted); margin: 10px 0 0; text-align: right; }
.up-warn { background: #fbecea; color: #2a0157; padding: 8px 12px; border-radius: 8px; font-size: .85rem; }
.up-steps { list-style: none; margin: 8px 0 14px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.up-step { position: relative; padding: 8px 0 8px 40px; min-height: 28px; color: var(--color-fg-muted); }
.up-step::before { content: ''; position: absolute; left: 4px; top: 8px; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--color-border-line); box-sizing: border-box; background: var(--color-panel); }
.up-step:not(:last-child)::after { content: ''; position: absolute; left: 14px; top: 32px; bottom: -6px; width: 2px; background: var(--color-border-line); }
.up-step b { display: block; font-weight: 600; }
.up-sd { display: block; font-size: .85rem; margin-top: 2px; }
.up-step.active { color: var(--color-fg); }
.up-step.active::before { border-color: #f15a25; border-top-color: transparent; animation: upSpin .9s linear infinite; }
.up-step.active .up-sd[data-elapsed]::after { content: ' · ' attr(data-elapsed); font-variant-numeric: tabular-nums; color: var(--color-fg-muted); }
@keyframes upSpin { to { transform: rotate(360deg); } }
.up-step.done { color: var(--color-fg); }
.up-step.done::before { content: '✓'; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 700; background: #2f7d4f; border-color: #2f7d4f; }
.up-step.fail { color: #2a0157; }
.up-step.fail::before { content: '!'; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 700; background: #2a0157; border-color: #2a0157; }
</style>"""
    data = dict(meetings=meetings, built=BUILT, legistar=LEGISTAR)
    up = dict(repo=REPO, branch=BRANCH, path=MINUTES_PATH, api=os.environ.get('UPLOAD_API', 'https://api.github.com'))
    scripts = (f'<script>window.__LIB__ = {js(json.dumps(data))}; window.__UPLOAD__ = {js(json.dumps(up))};</script>\n'
               f'<script>{js(rd("library.js"))}</script>\n<script>{js(rd("upload.js"))}</script>\n{site_data()}\n<script>{js(SITEJS)}</script>')
    open(os.path.join(SITE, 'library.html'), 'w', encoding='utf-8').write(shell('City Council meeting minutes library', body, css, scripts))


def home(meetings):
    latest = meetings[0] if meetings else None
    watch = list(csv.DictReader(open(os.path.join(OUT, 'b_watch.csv'))))
    mem = list(csv.DictReader(open(os.path.join(OUT, 'c_members.csv'))))
    t = totals
    ICON = {
        'prep': '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 16 2 2 4-4"/>',
        'member': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
        'find': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        'plan': '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 3 5-6"/>',
        'add': '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
    }
    svg = lambda k: f'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[k]}</svg>'
    chips = ''.join(f'<a class="hm-chip" href="member-by-member.html#member={esc(r["member"])}">{esc(r["member"])}</a>' for r in mem)
    if latest:
        ab = f'Absent: {esc(latest["absent"])}' if latest['absent'] else 'All members present'
        last = (f'<div class="hm-s"><div class="hm-sl">Latest minutes</div><div class="hm-sv">{d(latest["date"], "%a, %b %d")}</div>'
                f'<div class="hm-ss">{latest["votes"]} vote{'' if int(latest["votes"]) == 1 else 's'} · {latest["splits"]} split · {ab}</div></div>')
    else:
        last = ''
    nxt = (f'<div class="hm-s"><div class="hm-sl">Next meeting</div><div class="hm-sv">{d(NEXT, "%a, %b %d") if NEXT else "Not yet set"}</div>'
           f'<div class="hm-ss">{len(watch)} business item{"s" if len(watch) != 1 else ""} returning' + (f': {", ".join(esc(w["file"]) for w in watch[:4])}' if watch else '') + '</div></div>')
    year = (f'<div class="hm-s"><div class="hm-sl">This year so far</div><div class="hm-sv">{int(t["votes"]):,} votes</div>'
            f'<div class="hm-ss">{round(float(t["unanimous_share"]) * 100)}% unanimous · {t["contested"]} split</div></div>')
    body = f"""{nav('index.html', False)}
<main class="hm">
  <h1>What do you want to do?</h1>
  <p class="hm-lede">St. Paul City Council, {SPAN_LONG} · {len(meetings)} meetings</p>
  <section class="hm-strip" aria-label="Since the last meeting">{last}{nxt}{year}</section>
  <section class="hm-tasks">
    <a class="hm-task primary" href="course-of-action.html#go=next">{svg('prep')}<b>Prepare for the next meeting</b><span>Items coming up and who to call first</span></a>
    <div class="hm-task">{svg('member')}<b>Look up a councilmember</b><span class="hm-chips">{chips}</span></div>
    <form class="hm-task" action="library.html" data-go="library.html#q=">{svg('find')}<b>Find a past vote or item</b><span class="hm-in"><input type="search" placeholder="e.g. drive-through, Ord 26-51" aria-label="Find a past vote or item"><button class="sa-btn" type="submit">Find</button></span></form>
    <form class="hm-task" action="course-of-action.html" data-go="course-of-action.html#tab=search&amp;q=">{svg('plan')}<b>Get a plan for an issue</b><span class="hm-in"><input type="search" placeholder="e.g. paid sick leave" aria-label="Get a plan for an issue"><button class="sa-btn" type="submit">Plan</button></span></form>
    <a class="hm-task" href="library.html#upload">{svg('add')}<b>Add new minutes</b><span>Upload the latest minutes PDF</span></a>
  </section>
  <section class="hm-more">
    <h2>Or explore</h2>
    <div class="hm-links">
      <a href="voting-trends.html"><b>Voting trends</b><span>The council as a whole</span></a>
      <a href="platforms.html"><b>Platforms vs. votes</b><span>Campaign priorities next to the record</span></a>
      <a href="playbook.html"><b>Chamber playbook</b><span>Business items, coalitions, timing</span></a>
      <a href="library.html"><b>Minutes library</b><span>Every meeting, original PDFs</span></a>
      <a href="{LEGISTAR}" target="_blank" rel="noopener"><b>Legistar ↗</b><span>The city’s official meeting site</span></a>
      <a href="glossary.html"><b>Glossary</b><span>What the terms mean</span></a>
    </div>
  </section>
  <footer class="hm-foot">Updated {datetime.datetime.now(datetime.timezone.utc).strftime('%B %d, %Y').replace(' 0', ' ')} · refreshes automatically when new minutes are added.</footer>
</main>"""
    css = """<style>
.hm { max-width: 1040px; margin: 0 auto; padding: 30px 20px 60px; font-family: var(--font-anthropic-sans); }
.hm h1 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 2.3rem; margin: 0; }
.hm-lede { color: var(--color-fg-muted); margin: 4px 0 18px; }
.hm-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 10px; margin-bottom: 22px; }
.hm-s { background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: 12px; padding: 12px 16px; }
.hm-sl { font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: #5b2a86; font-weight: 700; }
.hm-sv { font-family: var(--font-anthropic-serif); font-size: 1.5rem; margin-top: 2px; }
.hm-ss { font-size: .85rem; color: var(--color-fg-muted); margin-top: 2px; }
.hm-tasks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.hm-task { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: 14px; color: var(--color-fg); text-decoration: none; transition: border-color .15s, transform .15s; }
a.hm-task:hover { border-color: #f15a25; transform: translateY(-1px); }
.hm-task svg { color: #f15a25; }
.hm-task b { font-size: 1.08rem; }
.hm-task > span { color: var(--color-fg-muted); font-size: .88rem; }
.hm-task.primary { background: #f15a25; border-color: #f15a25; color: #fff; }
.hm-task.primary svg, .hm-task.primary > span { color: #fff; opacity: .95; }
.hm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.hm-chip { font-size: .85rem; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--color-border-line); color: var(--color-fg); text-decoration: none; background: var(--color-bg); }
.hm-chip:hover { border-color: #f15a25; }
.hm-in { display: flex; gap: 6px; margin-top: 2px; }
.hm-in input { flex: 1; min-width: 0; font: inherit; font-size: .9rem; padding: 8px 12px; border: 1px solid var(--color-border-line); border-radius: 999px; background: var(--color-bg); color: var(--color-fg); }
.hm-more h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--color-fg-muted); margin: 28px 0 8px; }
.hm-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 8px; }
.hm-links a { display: block; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border-line); color: var(--color-fg); text-decoration: none; }
.hm-links a:hover { border-color: var(--color-fg-muted); }
.hm-links b { display: block; font-weight: 600; }
.hm-links span { font-size: .8rem; color: var(--color-fg-muted); }
.hm-foot { margin-top: 28px; font-size: .75rem; color: var(--color-fg-muted); border-top: 1px solid var(--color-border-line); padding-top: 10px; }
</style>"""
    go = """<script>document.querySelectorAll('form.hm-task').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); const v = f.querySelector('input').value.trim(); if (v) location.href = f.dataset.go.replace('&amp;', '&') + encodeURIComponent(v); }));</script>"""
    open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(shell('St. Paul City Council 2026', body, css, go + '\n' + site_data() + f'\n<script>{js(SITEJS)}</script>'))


def glossary():
    rows = ''.join(f'<div class="gl-row" id="{i}"><dt>{esc(t)}</dt><dd>{esc(df)}</dd></div>' for i, t, _, df in GLOSSARY)
    body = f"""{nav('glossary.html', False)}
<main class="gl">
  <div class="sa-crumb">Minutes &amp; help</div>
  <h1>Glossary</h1>
  <p class="sa-ask">What the terms on this site mean. Look for the <span class="sa-gl" aria-hidden="true">i</span> next to a term on any page.</p>
  <dl>{rows}</dl>
</main>"""
    css = """<style>
.gl { max-width: 760px; margin: 0 auto; padding: 30px 20px 60px; font-family: var(--font-anthropic-sans); }
.gl h1 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 2.1rem; margin: 0; }
.gl dl { margin: 20px 0 0; }
.gl-row { padding: 12px 0; border-bottom: 1px solid var(--color-border-line); scroll-margin-top: 80px; }
.gl-row:target { background: color-mix(in srgb, #f15a25 10%, transparent); border-radius: 8px; padding-left: 10px; }
.gl dt { font-weight: 700; }
.gl dd { margin: 3px 0 0; color: var(--color-fg-muted); line-height: 1.5; }
</style>"""
    open(os.path.join(SITE, 'glossary.html'), 'w', encoding='utf-8').write(shell('Glossary', body, css, site_data() + f'\n<script>{js(SITEJS)}</script>'))


def main():
    shutil.rmtree(SITE, ignore_errors=True)
    os.makedirs(os.path.join(SITE, 'minutes'))
    lib = json.load(open(os.path.join(OUT, 'meetings.json')))
    meetings = lib['meetings']
    for m in meetings:
        shutil.copy(os.path.join(ROOT, 'minutes', m['file']), os.path.join(SITE, 'minutes', m['file']))
        m.pop('txt', None)
    months = list(csv.DictReader(open(os.path.join(OUT, 'p_months.csv'))))
    dashboard('voting-trends.html', 'St. Paul City Council voting trends, 2026', 'voting-trends.html', None,
              {k: k for k in ['totals', 'members', 'monthly', 'member_monthly', 'contested', 'agreement', 'm_splits']} | {'votes': 'votes_2026'}, {}, 'trends')
    dashboard('member-by-member.html', 'St. Paul City Council: member by member, 2026', 'member-by-member.html', 'member-by-member.js',
              {k: k for k in ['m_action_log', 'm_splits', 'member_monthly', 'p_agree', 'p_council', 'p_focus', 'p_member', 'p_months', 'p_topic']},
              {'from': months[0]['month'], 'member': 'All', 'to': months[-1]['month']}, 'members')
    pb = {k: k for k in ['b_kpis', 'b_members', 'b_issue_member', 'b_issues', 'b_splits', 'b_ordinances', 'b_delays', 'b_log', 'b_persia', 'b_persia_member']}
    pb['b_watch'] = playbook_watch()
    pb['b_watch_hist'] = watch_history()
    dashboard('playbook.html', 'Chamber of Commerce playbook: St. Paul City Council, 2026', 'playbook.html', 'playbook.js', pb, {'member': 'All'}, 'playbook')
    dashboard('course-of-action.html', 'St. Paul Chamber course of action: City Council 2026', 'course-of-action.html', 'course-of-action.js',
              {k: k for k in ['c_members', 'c_priorities', 'c_issues', 'c_items', 'b_kpis', 'b_watch']}, {'tab': 'plan', 'q': '', 'member': 'All'}, 'coa')
    dashboard('platforms.html', 'Platforms vs. votes: St. Paul City Council, 2026', 'platforms.html', 'platforms.js',
              {k: k for k in ['pv_platforms', 'pv_cells', 'pv_theme', 'pv_items']}, {'member': 'Noecker', 'theme': 'Housing & renters'}, 'platforms')
    library(meetings)
    home(meetings)
    glossary()
    os.makedirs(os.path.join(SITE, 'vendor'), exist_ok=True)
    for n in ('pdfjs.min.js', 'pdfjs.worker.min.js'):
        p = os.path.join(WEB, 'vendor', n)
        if os.path.exists(p): shutil.copy(p, os.path.join(SITE, 'vendor', n))
    open(os.path.join(SITE, '.nojekyll'), 'w').write('')
    print('[site] built', len(meetings), 'meetings;', 'upload target:', UPLOAD_URL or '(not set: built outside GitHub)')


if __name__ == '__main__':
    main()
