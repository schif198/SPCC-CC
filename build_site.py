"""Build the website in _site/ from build/out (made by run.py) and web/.

Usage (from the repository root):  python3 pipeline/build_site.py
Optional environment: GITHUB_REPOSITORY (owner/repo) and GITHUB_REF_NAME (branch) set the upload button target;
both are set automatically inside GitHub Actions.
"""
import csv, datetime, html, io, json, os, re, shutil
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'out')
WEB = os.path.join(ROOT, 'web')
SITE = os.path.join(ROOT, '_site')
NARR = os.path.join(ROOT, 'narrative')
def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'<[^>]+>', '', t).lower()).strip('-')[:48]


def narr(name):
    p = os.path.join(NARR, name)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else ''
def narr_rows(name):
    t = narr(name)
    return list(csv.DictReader(io.StringIO(t))) if t else []
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
    ('Council Activity', [('voting-trends.html', 'Voting trends', 'Totals, months and every split vote'),
                          ('member-by-member.html', 'Member breakdown', 'One member’s votes, allies and focus'),
                          ('platforms.html', 'Platforms vs. votes', 'Campaign promise and voting alignment')]),
    ('Chamber strategy', [('course-of-action.html', 'Course of action', 'Who to talk to, and how, on any issue',
                           [('course-of-action.html#tab=plan', 'Course of action', 'Outreach order and a plan for each member'),
                            ('course-of-action.html#tab=search', 'Topic search', 'A plan for any issue you type in'),
                            ('course-of-action.html#tab=priorities', 'Chamber priorities', 'Where each Chamber priority stands')]),
                          ('playbook.html', 'Chamber playbook', 'Business items, coalitions and timing'),
                          ('outreach.html', 'One-pager builder', 'Persuasive one-pagers tailored to each member')]),
    ('Ward Feedback', [('research.html', 'Ward Feedback', 'How to reach each council member')]),
    ('Meeting minutes', [('library.html', 'Minutes library', 'Every meeting, with the original PDFs'),
                         ('@latest', 'Latest minutes', 'Open the newest meeting minutes (PDF)'),
                         ('library.html#upload', 'Add new minutes', 'Upload the latest minutes PDF')]),
    ('Help', [('help.html', 'About this site', 'Its three goals and the yearly update guide'),
              ('glossary.html', 'Glossary', 'What the terms on this site mean')]),
]
LATEST_PDF = ''  # set in main() to the newest minutes file
GUIDES = {
    'voting-trends.html': ('How the whole council votes: agreement, splits and voting blocs.',
                           'Votes only, not campaign promises.',
                           [('platforms.html', 'Votes vs. campaign promises', 'Platforms vs. votes'), ('member-by-member.html', 'One member in detail', 'Member breakdown')]),
    'member-by-member.html': ('One member’s votes, absences, allies and topics.',
                              'Votes show what happened, not why or what was promised.',
                              [('platforms.html', 'Her campaign vs. her record', 'Platforms vs. votes'), ('voting-trends.html', 'The whole council', 'Voting trends')]),
    'platforms.html': ('Campaign promise and voting alignment: what each member ran on, next to what they work on.',
                       'It counts council activity on each theme; it cannot say whether a promise was kept.',
                       [('member-by-member.html', 'Her full voting record', 'Member breakdown'), ('voting-trends.html', 'How the whole council votes', 'Voting trends')]),
}
PAGE_INFO = {
    'voting-trends.html': ('Council Activity', 'Voting trends', 'How does the council vote as a whole?'),
    'member-by-member.html': ('Council Activity', 'Member breakdown', 'How does each member vote, and who does she vote with?'),
    'platforms.html': ('Council Activity', 'Platforms vs. votes', 'Campaign promise and voting alignment: does each member’s council work match what she ran on?'),
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
    ('focus', 'Leads on', r'leads? on|take the lead|focus', 'Topics where a member’s motions and remarks make up a bigger share of her activity than the council average. Often reflects their own ward.'),
    ('coalition', 'Coalition', r'coalition', 'Members who usually vote together on split votes.'),
    ('persia', 'PERSIA', r'persia|lens', 'A way to sort issues by their Political, Economic, Religious, Social, Intellectual and Artistic (cultural) dimensions.'),
    ('readings', 'Readings and layovers', r'reading|layover|laid over|delay|ordinance clock|days to', 'Ordinances get first, second and third readings and a public hearing before final adoption. A layover moves an item to a later meeting.'),
    ('towin', 'Votes to win', r'votes to win|carry a', 'Four of the seven members’ votes carry a vote.'),
    ('active', 'Active record', r'active record|campaign priorities and council activity', 'On Platforms vs. votes: 4 or more motions or remarks on a theme (Active), or 4+ at an above-average share (Leading).'),
]
GLOSSARY_JS = [dict(id=i, term=t, rx=rx, df=d) for i, t, rx, d in GLOSSARY]
for g in GLOSSARY_JS: g['def'] = g.pop('df')
SEARCH_PAGES = [dict(href=it[0], title=it[1], desc=it[2] + ' (' + grp + ')') for grp, items in GROUPS for it in items if not it[0].startswith('@')] + \
    [dict(href=h, title=t, desc=desc) for _, items in GROUPS for it in items if len(it) > 3 for h, t, desc in it[3] if t != it[1]]


HEAD_RX = re.compile(r'<(h[23])((?:(?!data-draw)[^>])*)>([^<]+)</\1>')
PAGE_TITLES = {'voting-trends.html': 'Voting trends', 'member-by-member.html': 'Member breakdown', 'platforms.html': 'Platforms vs. votes',
               'course-of-action.html': 'Course of action', 'playbook.html': 'Chamber playbook'}


def heading_ids(page):
    """Give every fixed h2/h3 heading an id, so search results can jump straight to it."""
    def add(m):
        if 'id=' in m.group(2): return m.group(0)
        return f'<{m.group(1)}{m.group(2)} id="s-{slug(m.group(3))}">{m.group(3)}</{m.group(1)}>'
    return HEAD_RX.sub(add, page)


_SECTIONS = None
def section_index():
    """Every section of every page, for the site search."""
    global _SECTIONS
    if _SECTIONS is not None: return _SECTIONS
    out = []
    for fn, title in PAGE_TITLES.items():
        p = os.path.join(WEB, 'pages', fn)
        if not os.path.exists(p): continue
        src = open(p, encoding='utf-8').read()
        for m in HEAD_RX.finditer(src):
            text = html.unescape(re.sub(r'\s+', ' ', m.group(3))).strip()
            if len(text) < 4: continue
            before = src[:m.start()]
            pane = re.findall(r'data-pane="([a-z]+)"', before)
            view = re.findall(r'data-view="([A-Za-z]+)"', before)
            hid = f's-{slug(m.group(3))}'
            if fn == 'course-of-action.html' and pane: href = f'{fn}#tab={pane[-1]}&go={hid}'
            else: href = f'{fn}#go={hid}'
            out.append(dict(t=text, p=title, h=href))
    for r in narr_rows('aide_interviews.csv'):
        if r['kind'] == 'theme': out.append(dict(t=r['heading'], p='What ward offices told us', h=f'research.html#t-{slug(r["heading"])}', d=r['text']))
    for c in narr_rows('ward_contacts.csv'):
        w = c['ward']
        txt = ' '.join(r['text'] for r in narr_rows('aide_interviews.csv') if r['ward'] == w and r['kind'] != 'theme')
        out.append(dict(t=f'{c["full_name"]}: Ward {w} office and contacts', p='What ward offices told us', h=f'research.html#member={c["member"]}', d=f'ward {w} office contact phone email {c["legislative_aide"]} {txt}'))
    for t in ('Three key goals', 'Yearly update guide', 'Update the Chamber’s priorities', 'Check ward office contacts', 'Upload the new minutes', 'Renew the upload key', 'Update campaign platforms'):
        out.append(dict(t=t, p='About this site', h=f'help.html#{"yearly" if t != "Three key goals" else "goals"}'))
    seen = set(); _SECTIONS = [x for x in out if not (x['h'] in seen or seen.add(x['h']))]
    return _SECTIONS


def site_data():
    mem = [dict(m=r['member'], full=r['full_name']) for r in csv.DictReader(open(os.path.join(OUT, 'c_members.csv')))]
    return f'<script>window.__SITE__ = {js(json.dumps(dict(members=mem, glossary=GLOSSARY_JS, pages=SEARCH_PAGES, sections=section_index())))};</script>' 


def nav(current, printable):
    cur = ' aria-current="page"'
    grp = ''
    for name, items in GROUPS:
        on = any(it[0] == current for it in items)
        if len(items) == 1 and len(items[0]) == 3:  # a single page: a plain link, not a drop-down
            grp += f'<a class="sa-home" href="{items[0][0]}" title="{esc(items[0][2])}"{cur if on else ""}>{name}</a>'
            continue
        links = ''
        for it in items:
            h, t, desc = it[:3]
            if len(it) > 3:
                here = h == current
                sub = ''.join(f'<a class="sa-sub-a" href="{sh}" data-tab="{sh.split("tab=")[-1]}"><b>{st}</b><span>{sd}</span></a>' for sh, st, sd in it[3])
                links += (f'<div class="sa-subg open"><div class="sa-subh"><a href="{h}"{cur if here else ""}><b>{t}</b><span>{desc}</span></a>'
                          f'<button class="sa-sub-b" type="button" aria-expanded="true" aria-label="Show or hide the {t} sections"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'
                          f'<div class="sa-sub">{sub}</div></div>')
            elif h == '@latest':
                if LATEST_PDF:
                    links += f'<a href="minutes/{quote(LATEST_PDF)}" target="_blank" rel="noopener"><b>{t} ↗</b><span>{desc}</span></a>'
            else:
                links += f'<a href="{h}"{cur if h == current else ""}><b>{t}</b><span>{desc}</span></a>'
        grp += f'<div class="sa-grp{" cur" if on else ""}"><button class="sa-grp-b" type="button" aria-expanded="false">{name}</button><div class="sa-grp-p">{links}</div></div>'
    pr = f'<button id="sa-print" class="sa-btn" type="button" title="Print a one-page summary of what this page shows">{PRINT_ICON}Print one-pager</button>' if printable else ''
    return (f'<nav class="sa-nav" aria-label="Site"><a class="brand" href="index.html" aria-label="St. Paul Area Chamber: council dashboards home">St. Paul Area Chamber</a>'
            f'<button class="sa-toggle" type="button" aria-expanded="false">Menu</button>'
            f'<div class="sa-menu"><a class="sa-home" href="index.html"{cur if current == "index.html" else ""}>Home</a>{grp}</div>'
            f'<form class="sa-search" role="search" autocomplete="off"><input type="search" placeholder="Search the site" aria-label="Search the site"><div class="sa-sugg" role="listbox" hidden></div></form>'
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
        guide = ''
        if out in GUIDES:
            use, mind, links = GUIDES[out]
            ls = ''.join(f'<a href="{h}" data-carry="member"><span>{lbl}</span><b>{pg} →</b></a>' for h, lbl, pg in links)
            guide = (f'<aside class="sa-guide" aria-label="How to use this page"><div class="sa-guide-t">'
                     f'<p><b>Use this page for</b> {use}</p><p><b>Keep in mind</b> {mind}</p></div><div class="sa-guide-l">{ls}</div></aside>')
        top = (f'<div class="sa-crumb">{group}</div><h1>{title}</h1><p class="sa-ask">{ask}</p>{guide}'
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


def priorities_band(page):
    rows = sorted(narr_rows('chamber_top_priorities.csv'), key=lambda r: (r.get('year', ''), int(r.get('rank') or 0)))
    if not rows: return page
    year = max(r['year'] for r in rows); rows = [r for r in rows if r['year'] == year]
    asof = max(r.get('as_of', '') for r in rows)
    try: asof_txt = datetime.date.fromisoformat(asof).strftime('%B %d, %Y').replace(' 0', ' ')
    except ValueError: asof_txt = asof
    items = ''.join(f'<li><span class="n">{i + 1}</span>{esc(r["priority"])}</li>' for i, r in enumerate(rows))
    src = esc(rows[0].get('source', ''))
    new = (f'<div class="prio-h">{esc(year)} Priorities</div>\n        <ol class="prio-list">{items}</ol>\n'
           f'        <div class="prio-asof">As of {esc(asof_txt)}{" · " + src if src else ""}</div>')
    return re.sub(r'<div class="prio-h">.*?</ol>', lambda m: new, page, count=1, flags=re.S)


def dashboard(out, title, page_file, app_file, data, params, kind):
    page = template(rd('pages/' + page_file), out)
    if out == 'course-of-action.html': page = priorities_band(page)
    page = heading_ids(page)
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
    latest = max(meetings, key=lambda m: m['date']) if meetings else None
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
                f'<div class="hm-ss">{latest["votes"]} vote{'' if int(latest["votes"]) == 1 else 's'} · {latest["splits"]} split · {ab}</div>'
                f'<a class="hm-open" href="minutes/{quote(latest["file"])}" target="_blank" rel="noopener">Open the minutes (PDF) <span aria-hidden="true">↗</span></a></div>')
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
      <a href="platforms.html"><b>Platforms vs. votes</b><span>Campaign promise and voting alignment</span></a>
      <a href="research.html"><b>What ward offices told us</b><span>Interviews with legislative aides</span></a>
      <a href="playbook.html"><b>Chamber playbook</b><span>Business items, coalitions, timing</span></a>
      <a href="outreach.html"><b>One-pager builder</b><span>A tailored brief for any member</span></a>
      <a href="library.html"><b>Minutes library</b><span>Every meeting, original PDFs</span></a>
      <a href="{LEGISTAR}" target="_blank" rel="noopener"><b>Legistar ↗</b><span>The city’s official meeting site</span></a>
      <a href="help.html"><b>About this site</b><span>Its goals and how to keep it current</span></a>
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
  <div class="sa-crumb">Help</div>
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


MEMBER_COLORS = {'1': '#2f6eb5', '2': '#f15a25', '3': '#1f8a78', '4': '#b5658f', '5': '#e0a030', '6': '#6aaed6', '7': '#8c8577'}


def research():
    rows = narr_rows('aide_interviews.csv')
    themes = [r for r in rows if r['kind'] == 'theme']
    found = [r for r in rows if r['kind'] == 'finding']
    contacts = narr_rows('ward_contacts.csv')
    said = lambda r: [w for w in re.split(r'[ ,]+', r['ward'].strip()) if w]
    members = []
    for c in sorted(contacts, key=lambda r: int(r['ward'])):
        w = c['ward']; fr = [r for r in found if r['ward'] == w]
        secs = {}; short = {}
        for r in fr:
            secs.setdefault(r['section'], []).append(r['text'])
            short.setdefault(r['section'], []).append(r.get('short') or r['text'])
        short.pop('Best way to reach', None)
        members.append(dict(m=c['member'], full=c['full_name'], title=c['title'], ward=w, color=MEMBER_COLORS.get(w, '#8c8577'),
                            phone=c['phone'], email=c['email'], page=c['ward_page'], aide=c['legislative_aide'], room=c['room'],
                            asof=c.get('as_of', ''), interviewed=fr[0]['interviewed'] if fr else '',
                            best=secs.pop('Best way to reach', []), secs=[[k, v] for k, v in secs.items()], short=[[k, v] for k, v in short.items()],
                            themes=[i for i, t in enumerate(themes) if w in said(t)]))
    sec_help = {'Approach': 'How this office prefers to be contacted, and what makes a request land.',
                'Priorities': 'What the ward and its residents care about most right now.',
                'Business': 'What local businesses in the ward face, and ideas the office raised.',
                'Relationships': 'How trust is built with this office over time.',
                'Follow-up': 'What the office asked for after the interview.'}
    data = dict(sec_help=sec_help, members=members, themes=[dict(h=t['heading'], t=t['text'], id='t-' + slug(t['heading']), wards=said(t)) for t in themes], logo=LOGO_URI)
    n_int = sum(1 for m in members if m['interviewed'])
    kpis = (f'<div class="rs-kpi"><b>{n_int}</b><span>of {len(members)} offices interviewed</span></div>'
            f'<div class="rs-kpi"><b>{len(themes)}</b><span>shared takeaways</span></div>'
            f'<div class="rs-kpi"><b>{sum(1 for t in themes if len(said(t)) >= 2)}</b><span>said by 2 or more offices</span></div>')
    body = f"""{nav('research.html', False)}
<main class="rs">
  <div class="rs-top">
    <div><div class="sa-crumb">Ward Feedback</div>
    <h1>What ward offices told us</h1>
    <p class="sa-ask">How to reach each council member, from interviews with their offices.</p></div>
    <button type="button" class="rs-print" id="rs-print-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg><span>Print one-pager</span></button>
  </div>
  <aside class="sa-guide" aria-label="How to use this page"><div class="sa-guide-t"><p><b>Use this page for</b> planning how to reach each member.</p><p><b>Keep in mind</b> staff views from interviews, not official positions.</p></div>
  <div class="sa-guide-l"><a href="course-of-action.html"><span>Who to call first</span><b>Course of action →</b></a><a href="member-by-member.html"><span>Votes and allies</span><b>Member breakdown →</b></a></div></aside>
  <section class="rs-card" id="members"><h2>Choose a council member</h2>
    <div class="dkey" role="note" aria-label="Key"><span class="dk-i"><span class="rs-tick">●</span><span>Office interviewed</span></span><span class="dk-i"><span class="rs-tick rs-tick-no">○</span><span>Not interviewed yet</span></span></div>
    <div class="rs-strip" role="tablist" aria-label="Council members"></div>
    <div class="rs-detail" id="rs-detail" aria-live="polite"></div>
  </section>
  <section class="rs-card" id="takeaways"><h2>What offices agree on</h2><p class="rs-note">Colored dots show which member’s office said it. Click a dot to open that member.</p><div class="rs-ts"></div></section>
  <details class="rs-q"><summary>About these interviews</summary><p>Informational interviews with council legislative aides, November 2026, by Jacob Krieger (Team 7). Paraphrased from interview notes. Contacts from the city’s council page.</p></details>
</main>
<div id="print-sheet" aria-hidden="true"></div>"""
    css = """<style>
.rs { max-width: 1100px; margin: 0 auto; padding: 30px 20px 60px; font-family: var(--font-anthropic-sans); }
.rs-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.rs h1 { font-size: 2.1rem; margin: 0; }
.rs h2 { margin: 0 0 4px; font-size: 1.2rem; color: #2a0157; }
.rs-print { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: .9rem; font-weight: 700; color: #fff; background: #2a0157; border: 0; border-radius: 8px; padding: 9px 16px; cursor: pointer; }
.rs-print:hover { background: #3d0a78; }
.rs-print:focus-visible, .rs-m:focus-visible, .rs-dot:focus-visible { outline: 3px solid #f15a25; outline-offset: 2px; }
.rs-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 10px; margin: 6px 0 14px; }
.rs-kpi { background: #fff; border: 1px solid var(--color-border-line); border-radius: 10px; padding: 12px 16px; box-shadow: 0 1px 2px rgba(42,1,87,.05), 0 6px 18px rgba(42,1,87,.05); }
.rs-kpi b { display: block; font-size: 1.9rem; font-weight: 800; color: #2a0157; line-height: 1.1; }
.rs-kpi span { font-size: .82rem; color: var(--color-fg-muted); }
.rs-card { background: #fff; border: 1px solid var(--color-border-line); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; scroll-margin-top: 90px; }
.rs-note { margin: 0 0 10px; font-size: .82rem; color: var(--color-fg-muted); }
.rs-sw { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.rs-tick { color: #2a0157; font-size: .8rem; } .rs-tick-no { color: #6b6478; }
.rs-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.3rem, 1fr)); gap: 8px; margin-top: 6px; }
.rs-m { font: inherit; text-align: left; background: #fff; border: 1.5px solid var(--color-border-line); border-top: 5px solid var(--mc); border-radius: 10px; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: transform .12s, box-shadow .12s; color: var(--color-fg); }
.rs-m:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(42,1,87,.12); }
.rs-m[aria-selected=true] { border-color: var(--mc); background: var(--mt); box-shadow: 0 8px 22px rgba(42,1,87,.14); }
.rs-m .rs-mh { display: flex; align-items: center; gap: 7px; }
.rs-wn { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: .78rem; background: var(--mc); color: var(--mtx); }
.rs-m b { font-size: .9rem; line-height: 1.2; }
.rs-m small { font-size: .74rem; color: var(--color-fg-muted); }
.rs-m .rs-st { font-size: .72rem; font-weight: 700; color: #2a0157; }
.rs-m .rs-st.no { color: #6b6478; font-weight: 600; }
.rs-detail:empty::before { content: 'Click a member to see her ward office, the best ways to reach her, and what her office told us.'; display: block; margin-top: 12px; padding: 14px 16px; border: 1.5px dashed var(--color-border-line); border-radius: 10px; color: var(--color-fg-muted); font-size: .9rem; }
.rs-x { margin-top: 12px; border: 2px solid var(--mc); border-radius: 12px; overflow: hidden; }
.rs-xh { background: var(--mt); padding: 14px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rs-xh .rs-wn { width: 40px; height: 40px; font-size: 1.05rem; }
.rs-xh h3 { margin: 0; font-size: 1.3rem; color: #2a0157; }
.rs-xh .rs-sub { font-size: .85rem; color: var(--color-fg-muted); }
.rs-xh .rs-print { margin-left: auto; }
.rs-xb { padding: 14px 18px 18px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 18px; }
@media (max-width: 760px) { .rs-xb { grid-template-columns: 1fr; } }
.rs-lab { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #b9420c; margin: 10px 0 4px; }
.rs-lab:first-child { margin-top: 0; }
.rs-best { margin: 0; padding: 0; list-style: none; counter-reset: b; }
.rs-best li { counter-increment: b; position: relative; padding: 6px 0 6px 32px; font-size: .92rem; line-height: 1.4; border-bottom: 1px solid var(--color-border-line); }
.rs-best li:last-child { border-bottom: 0; }
.rs-best li::before { content: counter(b); position: absolute; left: 0; top: 6px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--mc); color: var(--mtx); font-weight: 800; font-size: .74rem; }
.rs-ct { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: .9rem; background: #f7f6fa; border-radius: 10px; padding: 10px 12px; }
.rs-ct dt { color: var(--color-fg-muted); font-size: .8rem; padding-top: 1px; }
.rs-ct dd { margin: 0; }
.rs-ct a { color: #5b2a86; font-weight: 600; }
.rs-sh { font-size: .8rem; font-style: italic; color: var(--color-fg-muted); margin: -2px 0 4px; }
.rs-xb ul { margin: 0; padding-left: 18px; font-size: .9rem; line-height: 1.5; }
.rs-xb li { margin: 4px 0; }
.rs-tk { display: flex; flex-wrap: wrap; gap: 5px; }
.rs-tk a { font-size: .78rem; border: 1.5px solid var(--mc); border-radius: 999px; padding: 2px 10px; color: var(--color-fg); text-decoration: none; background: #fff; }
.rs-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.rs-links a { font-size: .82rem; font-weight: 700; color: #2a0157; border: 1.5px solid #2a0157; border-radius: 8px; padding: 5px 11px; text-decoration: none; }
.rs-links a:hover { background: #f6f0fb; }
.rs-none { font-size: .9rem; color: var(--color-fg-muted); background: #f7f6fa; border: 1.5px dashed var(--color-border-line); border-radius: 10px; padding: 10px 12px; }
.rs-ts { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 10px; }
.rs-t { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--color-border-line); border-radius: 10px; padding: 12px 14px; scroll-margin-top: 90px; transition: opacity .15s; }
.rs-t.dim { opacity: .3; }
.rs-t h3 { margin: 0 0 3px; font-size: .98rem; color: #2a0157; }
.rs-t p { margin: 0 0 8px; font-size: .88rem; line-height: 1.45; }
.rs-n { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #c9400c, #d31d44); color: #fff; font-weight: 800; font-size: .8rem; }
.rs-dots { display: flex; flex-wrap: wrap; gap: 5px; }
.rs-dot { font: inherit; display: inline-flex; align-items: center; gap: 5px; font-size: .74rem; font-weight: 600; border: 1.5px solid var(--mc); background: #fff; border-radius: 999px; padding: 1px 8px 1px 3px; cursor: pointer; color: var(--color-fg); }
.rs-dot i { width: 12px; height: 12px; border-radius: 50%; background: var(--mc); }
.rs-q { background: #f7f6fa; border-radius: 10px; padding: 10px 16px; font-size: .85rem; }
.rs-q summary { font-weight: 700; cursor: pointer; color: #2a0157; }
.rs-q p { color: var(--color-fg-muted); margin: 6px 0 0; }
#print-sheet:empty { display: none; }
#print-sheet { font-family: var(--font-anthropic-sans); color: #22182c; font-size: 9.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { #print-sheet { position: absolute; left: -10000px; top: 0; width: 7.6in; } }
@media print { @page { size: letter; margin: .45in; } }
#print-sheet .ps-h { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--mc, #2a0157); padding-bottom: 6px; margin-bottom: 10px; }
#print-sheet .ps-h img { height: 34px; }
#print-sheet h1 { font-size: 17pt; margin: 0; color: #2a0157; }
#print-sheet .ps-s { font-size: 8.5pt; color: #6b6478; margin-top: 2px; }
#print-sheet h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .07em; color: #b9420c; margin: 12px 0 5px; }
#print-sheet .ps-cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
#print-sheet ol, #print-sheet ul { margin: 0; padding-left: 16px; line-height: 1.4; }
#print-sheet li { margin: 2px 0; }
#print-sheet table { width: 100%; border-collapse: collapse; font-size: 8.4pt; }
#print-sheet th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #6b6478; border-bottom: 1.5px solid #2a0157; padding: 3px 4px; }
#print-sheet td { border-bottom: 1px solid #e7e3ee; padding: 4px; vertical-align: top; }
#print-sheet td:nth-child(2), #print-sheet td:nth-child(3) { white-space: nowrap; }
#print-sheet .ps-wn { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; font-weight: 800; font-size: 7.5pt; margin-right: 4px; vertical-align: -3px; }
#print-sheet .ps-ct { background: #f7f6fa; border-radius: 6px; padding: 6px 8px; line-height: 1.5; }
#print-sheet .ps-tk { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
#print-sheet .ps-tk div { line-height: 1.35; }
#print-sheet .ps-know { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
#print-sheet .ps-know b { display: block; color: #2a0157; font-size: 9pt; margin-bottom: 1px; }
#print-sheet .ps-tk3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 12px; font-size: 8.4pt; }
#print-sheet .ps-tk3 .on { font-weight: 700; }
#print-sheet .ps-f { margin-top: 12px; font-size: 7.5pt; color: #6b6478; border-top: 1px solid #e7e3ee; padding-top: 4px; }
</style>"""
    script = """<script>(() => {
  const D = JSON.parse(document.getElementById('rs-data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const lum = (hex) => { const v = hex.match(/[0-9a-f]{2}/gi).map((x) => { x = parseInt(x, 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ink = (c) => (1.05 / (lum(c) + 0.05) >= 3 ? '#fff' : '#22182c');
  const tint = (c) => { const n = c.match(/[0-9a-f]{2}/gi).map((x) => parseInt(x, 16)); return `rgba(${n.join(',')},.12)`; };
  const paint = (el, m) => { el.style.setProperty('--mc', m.color); el.style.setProperty('--mt', tint(m.color)); el.style.setProperty('--mtx', ink(m.color)); };
  const byWard = Object.fromEntries(D.members.map((m) => [m.ward, m]));
  const tel = (p) => 'tel:' + p.replace(/[^0-9]/g, '');
  let sel = null;

  // member strip
  const strip = $('.rs-strip');
  for (const m of D.members) {
    const b = h('button', 'rs-m'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.m = m.m; paint(b, m);
    const hd = h('span', 'rs-mh'); hd.append(h('span', 'rs-wn', m.ward), h('b', '', m.full)); b.appendChild(hd);
    b.title = `${m.title} ${m.full}, Ward ${m.ward}`; b.append(h('small', '', `Ward ${m.ward}`), h('span', 'rs-st' + (m.interviewed ? '' : ' no'), m.interviewed ? '● Interviewed' : '○ Not yet'));
    b.addEventListener('click', () => pick(sel === m.m ? null : m.m, true));
    strip.appendChild(b);
  }

  // shared takeaways, with colored member dots
  const ts = $('.rs-ts');
  D.themes.forEach((t, i) => {
    const a = h('article', 'rs-t'); a.id = t.id; a.dataset.wards = t.wards.join(' ');
    const body = h('div'); body.append(h('h3', '', t.h), h('p', '', t.t));
    const dots = h('div', 'rs-dots');
    for (const w of t.wards) { const m = byWard[w]; if (!m) continue; const d = h('button', 'rs-dot'); d.type = 'button'; paint(d, m); d.append(h('i'), `${m.m} · W${w}`); d.title = `Open ${m.full}`; d.addEventListener('click', () => pick(m.m, true)); dots.appendChild(d); }
    body.appendChild(dots); a.append(h('span', 'rs-n', i + 1), body); ts.appendChild(a);
  });

  const printBtn = (label) => { const b = h('button', 'rs-print'); b.type = 'button'; b.innerHTML = document.getElementById('rs-print-all').innerHTML; b.lastChild.textContent = label; return b; };
  function detail(m) {
    const box = $('#rs-detail'); box.replaceChildren(); if (!m) return;
    const x = h('div', 'rs-x'); paint(x, m);
    const hd = h('div', 'rs-xh'); const nm = h('div'); nm.append(h('h3', '', m.full), h('div', 'rs-sub', `${m.title} · Ward ${m.ward} · ${m.interviewed ? 'Office interviewed ' + m.interviewed : 'Not interviewed yet'}`));
    const pb = printBtn('Print one-pager'); pb.addEventListener('click', () => print1(m));
    hd.append(h('span', 'rs-wn', m.ward), nm, pb); x.appendChild(hd);
    const bd = h('div', 'rs-xb'); const L = h('div'), R = h('div');
    L.appendChild(h('div', 'rs-lab', 'Best ways to reach her'));
    if (m.best.length) { const ol = h('ol', 'rs-best'); m.best.forEach((t) => ol.appendChild(h('li', '', t))); L.appendChild(ol); }
    else L.appendChild(h('div', 'rs-none', 'Not interviewed yet. Use the shared takeaways below, and contact the ward office.'));
    L.appendChild(h('div', 'rs-lab', `Ward ${m.ward} office`));
    const dl = h('dl', 'rs-ct');
    const row = (k, v) => { dl.append(h('dt', '', k)); const dd = h('dd'); typeof v === 'string' ? (dd.textContent = v) : dd.appendChild(v); dl.appendChild(dd); };
    const link = (href, txt, ext) => { const a = h('a', '', txt); a.href = href; if (ext) { a.target = '_blank'; a.rel = 'noopener'; } return a; };
    row('Phone', link(tel(m.phone), m.phone)); row('Email', link('mailto:' + m.email, m.email));
    if (m.aide) row('Legislative aide', m.aide); row('Office', m.room); row('Ward page', link(m.page, 'stpaul.gov ↗', true));
    L.appendChild(dl);
    if (m.secs.length) for (const [k, v] of m.secs) { R.appendChild(h('div', 'rs-lab', k)); if (D.sec_help[k]) R.appendChild(h('div', 'rs-sh', D.sec_help[k])); const ul = h('ul'); v.forEach((t) => ul.appendChild(h('li', '', t))); R.appendChild(ul); }
    else { R.appendChild(h('div', 'rs-lab', 'What her office told us')); R.appendChild(h('div', 'rs-none', 'No interview notes yet.')); }
    if (m.themes.length) { R.appendChild(h('div', 'rs-lab', 'Shared takeaways her office raised')); const tk = h('div', 'rs-tk'); m.themes.forEach((i) => { const a = h('a', '', `${i + 1}. ${D.themes[i].h}`); a.href = '#' + D.themes[i].id; tk.appendChild(a); }); R.appendChild(tk); }
    const ln = h('div', 'rs-links'); ln.append(link(`course-of-action.html#tab=plan&member=${encodeURIComponent(m.m)}`, 'Her course of action →'), link(`member-by-member.html#member=${encodeURIComponent(m.m)}`, 'Her voting record →'), link(`outreach.html#member=${encodeURIComponent(m.m)}`, 'Write her a one-pager →')); R.appendChild(ln);
    bd.append(L, R); x.appendChild(bd); box.appendChild(x);
  }
  function pick(name, scroll) {
    sel = name; const m = D.members.find((x) => x.m === name);
    document.querySelectorAll('.rs-m').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.m === name)));
    document.querySelectorAll('.rs-t').forEach((t) => t.classList.toggle('dim', !!m && !t.dataset.wards.split(' ').includes(m.ward)));
    detail(m);
    history.replaceState(null, '', name ? '#member=' + encodeURIComponent(name) : location.pathname);
    try { if (name) localStorage.setItem('spcc-member', name); } catch (e) {}
    if (scroll && m) $('#members').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // one-pagers
  const sheet = $('#print-sheet');
  const head = (title, sub, color) => { const d = h('div', 'ps-h'); const l = h('div'); l.append(h('h1', '', title), h('div', 'ps-s', sub)); const img = document.createElement('img'); img.src = D.logo; img.alt = 'St. Paul Area Chamber'; d.append(l, img); sheet.style.setProperty('--mc', color || '#2a0157'); return d; };
  const wn = (m) => { const s = h('span', 'ps-wn', m.ward); s.style.background = m.color; s.style.color = ink(m.color); return s; };
  const foot = () => h('div', 'ps-f', `St. Paul Area Chamber · Ward feedback from interviews with council legislative aides, November 2026 · contacts from stpaul.gov (as of ${new Date(D.members[0].asof + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}) · printed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
  const go = () => { requestAnimationFrame(() => setTimeout(() => window.print(), 60)); };
  function print1(m) {
    sheet.replaceChildren(head(`Reaching ${m.full}`, `${m.title} · Ward ${m.ward} · ${m.interviewed ? 'office interviewed ' + m.interviewed : 'office not interviewed yet'}`, m.color));
    const top = h('div', 'ps-cols'), L = h('div'), R = h('div');
    L.appendChild(h('h2', '', 'How to reach her'));
    if (m.best.length) { const ol = h('ol'); m.best.forEach((t) => ol.appendChild(h('li', '', t))); L.appendChild(ol); }
    else L.appendChild(h('div', '', 'Not interviewed yet. Use the shared advice below and contact the ward office.'));
    R.appendChild(h('h2', '', `Ward ${m.ward} office`));
    const ct = h('div', 'ps-ct'); ct.innerText = [`${m.phone} · ${m.email}`, m.aide && `Legislative aide: ${m.aide}`, m.room, m.page.replace('https://www.', '')].filter(Boolean).join('\\n'); R.appendChild(ct);
    top.append(L, R); sheet.appendChild(top);
    if (m.short.length) {
      sheet.appendChild(h('h2', '', 'What to know'));
      const g = h('div', 'ps-know');
      for (const [k, v] of m.short) { const c = h('div'); c.appendChild(h('b', '', k)); const ul = h('ul'); v.forEach((t) => ul.appendChild(h('li', '', t))); c.appendChild(ul); g.appendChild(c); }
      sheet.appendChild(g);
    }
    sheet.appendChild(h('h2', '', 'Advice every office gave'));
    const tk = h('div', 'ps-tk3'); D.themes.forEach((t, i) => { const on = t.wards.includes(m.ward); const d = h('div', on ? 'on' : ''); d.textContent = `${i + 1}. ${t.h}${on ? ' ★' : ''}`; tk.appendChild(d); }); sheet.appendChild(tk);
    if (m.themes.length) sheet.appendChild(h('div', 'ps-s', '★ = raised by this member’s office. Full notes: What ward offices told us, on the Chamber council site.'));
    sheet.appendChild(foot()); go();
  }
  function printAll() {
    sheet.replaceChildren(head('Reaching the St. Paul City Council', 'Ward office contacts and how each office prefers to be reached'));
    sheet.appendChild(h('h2', '', 'Council members'));
    const tb = h('table'); const tr = h('tr'); ['Member', 'Phone', 'Email', 'Legislative aide', 'Best way to reach'].forEach((x) => tr.appendChild(h('th', '', x))); tb.appendChild(tr);
    for (const m of D.members) { const r = h('tr'); const c = h('td'); c.append(wn(m), h('b', '', m.full)); r.append(c, h('td', '', m.phone), h('td', '', m.email), h('td', '', m.aide || '—'), h('td', '', m.best[0] || 'Not interviewed yet: see shared takeaways')); tb.appendChild(r); }
    sheet.appendChild(tb);
    sheet.appendChild(h('h2', '', 'What every office agrees on'));
    const tk = h('div', 'ps-tk'); D.themes.forEach((t, i) => { const d = h('div'); d.append(h('b', '', `${i + 1}. ${t.h} `), t.t, h('span', 'ps-s', ` (Ward ${t.wards.join(', ')})`)); tk.appendChild(d); }); sheet.appendChild(tk);
    sheet.appendChild(foot()); go();
  }
  $('#rs-print-all').addEventListener('click', () => (sel ? print1(D.members.find((x) => x.m === sel)) : printAll()));
  window.addEventListener('afterprint', () => sheet.replaceChildren());

  const fromHash = () => { const q = new URLSearchParams(location.hash.slice(1)).get('member'); if (q && D.members.some((m) => m.m === q)) pick(q, false); };
  fromHash(); window.addEventListener('hashchange', fromHash);
})();</script>"""
    data_tag = '<script type="application/json" id="rs-data">' + json.dumps(data).replace('</', '<\\/') + '</script>'
    open(os.path.join(SITE, 'research.html'), 'w', encoding='utf-8').write(shell('What ward offices told us', body, css, data_tag + '\n' + script + '\n' + site_data() + f'\n<script>{js(SITEJS)}</script>'))


def outreach():
    rd_out = lambda n: list(csv.DictReader(open(os.path.join(OUT, n + '.csv'), encoding='utf-8')))
    na = lambda v: '' if (v or '').strip().upper().startswith('NOT AVAILABLE') else (v or '').strip()
    clean = lambda v: ' '.join(x for x in re.split(r'(?<=[.!?])\s+', na(v)) if 'NOT AVAILABLE' not in x)
    cm = {r['member']: r for r in rd_out('c_members')}
    lead = {}
    for r in rd_out('b_issue_member'):
        lead.setdefault(r['member'], {})[r['issue']] = dict(lead=int(r['lead'] or 0), push=int(r['pushback'] or 0))
    found = [r for r in narr_rows('aide_interviews.csv') if r['kind'] == 'finding']
    members = []
    for c in sorted(narr_rows('ward_contacts.csv'), key=lambda r: int(r['ward'])):
        w = c['ward']; m = cm.get(c['member'], {})
        sec = lambda k: [(r.get('short') or r['text']) for r in found if r['ward'] == w and r['section'] == k]
        members.append(dict(m=c['member'], full=c['full_name'], title=c['title'], ward=w, color=MEMBER_COLORS.get(w, '#8c8577'),
                            aide=c['legislative_aide'], phone=c['phone'], email=c['email'],
                            lead_with=clean(m.get('lead_with')), engage_on=clean(m.get('engage_on')), cautions=clean(m.get('cautions')),
                            stance=clean(m.get('stance')), closest=m.get('closest', ''), maj=float(m.get('majority_share') or 0),
                            best=[r['text'] for r in found if r['ward'] == w and r['section'] == 'Best way to reach'],
                            prio=sec('Priorities'), biz=sec('Business'), interviewed=any(r['ward'] == w for r in found),
                            issues=lead.get(c['member'], {})))
    issues = [dict(n=r['issue'], kw=[k.strip().lower() for k in r['keywords'].split(';') if k.strip()],
                   frame=na(r['value_frame']), pos=na(r['chamber_position'])) for r in rd_out('c_issues')]
    watch = [dict(f=r['file'], t=short_title(r['item']), issue=r['issue'], when=r['next_meeting'], stage=r['stage']) for r in rd_out('b_watch')]
    prios = [r['priority'] for r in narr_rows('chamber_top_priorities.csv')]
    data = dict(members=members, issues=issues, watch=watch, prios=prios, logo=LOGO_URI)
    body = nav('outreach.html', False) + '\n' + rd('pages/outreach.html')
    data_tag = '<script type="application/json" id="op-data">' + json.dumps(data).replace('</', '<\\/') + '</script>'
    open(os.path.join(SITE, 'outreach.html'), 'w', encoding='utf-8').write(
        shell('One-pager builder', body, '', data_tag + f'\n<script>{js(rd("pages/outreach.js"))}</script>\n' + site_data() + f'\n<script>{js(SITEJS)}</script>'))


def help_page():
    goals = [('1', 'Find council information fast', 'The record, member profiles and upcoming items in a few clicks, without reading every set of minutes.', 'voting-trends.html', 'Voting trends'),
             ('2', 'Tailor outreach to each member', 'Each member’s votes, allies, priorities and ward office, so every conversation starts from what matters to her.', 'course-of-action.html', 'Course of action'),
             ('3', 'Stay current with little upkeep', 'Upload new minutes and the site rebuilds itself; a short yearly check keeps everything else accurate.', '#yearly', 'Yearly update guide')]
    g = ''.join(f'<article class="hp-goal"><span class="hp-n">{n}</span><h3>{esc(t)}</h3><p>{esc(d)}</p><a href="{h}">{esc(lk)} →</a></article>' for n, t, d, h, lk in goals)
    steps = [('After every council meeting', 'Upload the new minutes', 'Meeting minutes → Add new minutes. Every page, one-pager and agenda item updates on its own within a few minutes.', None),
             ('Each January', 'Update the Chamber’s priorities', 'Edit <code>chamber_top_priorities.csv</code>: one row per priority, the year, and today’s date in <code>as_of</code>.', 'chamber_top_priorities.csv'),
             ('Each January, and after any staff change', 'Check ward office contacts', 'Compare <code>ward_contacts.csv</code> with the city’s council page and update names, phones and the <code>as_of</code> date.', 'ward_contacts.csv'),
             ('Each January', 'Review each member’s plan', 'Read <code>c_members_text.csv</code> and update the approach, cautions and Chamber relationship for each member.', 'c_members_text.csv'),
             ('After a council election', 'Update campaign platforms', 'Replace departing members’ rows in <code>platforms.csv</code> with the new members’ platforms, and add the new members to the other files above.', 'platforms.csv'),
             ('After new interviews', 'Add what ward offices told you', 'Add rows to <code>aide_interviews.csv</code>; the “What ward offices told us” page rebuilds itself.', 'aide_interviews.csv'),
             ('Each year', 'Renew the upload key', 'Upload keys expire. Make a new one in GitHub and paste it in the Add new minutes dialog.', None)]
    st = ''.join(f'<li><div class="hp-when">{esc(w)}</div><b>{esc(t)}</b><p>{d}</p></li>' for w, t, d, _ in steps)
    body = f"""{nav('help.html', False)}
<main class="hp">
  <div class="sa-crumb">Help</div>
  <h1>About this site</h1>
  <p class="sa-ask">The St. Paul Area Chamber’s guide to the City Council, built from the council’s own meeting minutes.</p>
  <h2 id="goals">Three key goals</h2>
  <div class="hp-goals">{g}</div>
  <h2 id="yearly">Yearly update guide</h2>
  <p class="hp-lede">Most of the site updates itself from the minutes. These files hold what the minutes can’t: open the site’s GitHub repository, click the file, click the pencil icon to edit, then <b>Commit changes</b>. The site rebuilds in a few minutes.</p>
  <ol class="hp-steps">{st}</ol>
  <p class="hp-more">Not sure what a term means? See the <a href="glossary.html">Glossary</a>.</p>
</main>"""
    css = """<style>
.hp { max-width: 960px; margin: 0 auto; padding: 30px 20px 60px; font-family: var(--font-anthropic-sans); }
.hp h1 { font-size: 2.1rem; margin: 0; }
.hp h2 { margin: 28px 0 12px; font-size: 1.25rem; color: #2a0157; scroll-margin-top: 90px; }
.hp-goals { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 12px; }
.hp-goal { background: #fff; border: 1px solid var(--color-border-line); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(42,1,87,.05), 0 6px 18px rgba(42,1,87,.05); }
.hp-n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #c9400c, #d31d44); color: #fff; font-weight: 800; }
.hp-goal h3 { margin: 10px 0 6px; font-size: 1.05rem; color: #2a0157; }
.hp-goal p { margin: 0 0 10px; line-height: 1.5; font-size: .92rem; }
.hp-goal a { margin-top: auto; color: #5b2a86; font-weight: 700; }
.hp-lede { line-height: 1.55; }
.hp-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.hp-steps li { background: #fff; border: 1px solid var(--color-border-line); border-radius: 10px; padding: 12px 16px; }
.hp-when { font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #b9420c; }
.hp-steps b { display: block; margin: 2px 0; color: #2a0157; }
.hp-steps p { margin: 0; line-height: 1.5; font-size: .92rem; }
.hp-steps code { background: #f1e8f0; padding: 1px 5px; border-radius: 4px; font-size: .85em; }
.hp-more { margin-top: 18px; }
</style>"""
    open(os.path.join(SITE, 'help.html'), 'w', encoding='utf-8').write(shell('About this site', body, css, site_data() + f'\n<script>{js(SITEJS)}</script>'))


def main():
    shutil.rmtree(SITE, ignore_errors=True)
    os.makedirs(os.path.join(SITE, 'minutes'))
    lib = json.load(open(os.path.join(OUT, 'meetings.json')))
    meetings = lib['meetings']
    global LATEST_PDF
    LATEST_PDF = max(meetings, key=lambda m: m['date'])['file'] if meetings else ''
    for m in meetings:
        shutil.copy(os.path.join(ROOT, 'minutes', m['file']), os.path.join(SITE, 'minutes', m['file']))
        m.pop('txt', None)
    months = list(csv.DictReader(open(os.path.join(OUT, 'p_months.csv'))))
    dashboard('voting-trends.html', 'St. Paul City Council voting trends, 2026', 'voting-trends.html', None,
              {k: k for k in ['totals', 'members', 'monthly', 'member_monthly', 'contested', 'agreement', 'm_splits']} | {'votes': 'votes_2026'}, {}, 'trends')
    dashboard('member-by-member.html', 'St. Paul City Council: member by member, 2026', 'member-by-member.html', 'member-by-member.js',
              {k: k for k in ['m_action_log', 'm_splits', 'member_monthly', 'p_agree', 'p_council', 'p_focus', 'p_member', 'p_months', 'p_topic']} | {'ward_contacts': narr('ward_contacts.csv') or 'member\n'},
              {'from': months[0]['month'], 'member': 'All', 'to': months[-1]['month']}, 'members')
    pb = {k: k for k in ['b_kpis', 'b_members', 'b_issue_member', 'b_issues', 'b_splits', 'b_ordinances', 'b_delays', 'b_log', 'b_persia', 'b_persia_member']}
    pb['b_watch'] = playbook_watch()
    pb['b_watch_hist'] = watch_history()
    dashboard('playbook.html', 'Chamber of Commerce playbook: St. Paul City Council, 2026', 'playbook.html', 'playbook.js', pb, {'member': 'All'}, 'playbook')
    dashboard('course-of-action.html', 'St. Paul Chamber course of action: City Council 2026', 'course-of-action.html', 'course-of-action.js',
              {k: k for k in ['c_members', 'c_priorities', 'c_issues', 'c_items', 'b_kpis', 'b_watch']} | {'ward_contacts': narr('ward_contacts.csv') or 'member\n'}, {'tab': 'plan', 'q': '', 'member': 'All'}, 'coa')
    dashboard('platforms.html', 'Platforms vs. votes: St. Paul City Council, 2026', 'platforms.html', 'platforms.js',
              {k: k for k in ['pv_platforms', 'pv_cells', 'pv_theme', 'pv_items']}, {'member': 'Noecker', 'theme': 'Housing & renters'}, 'platforms')
    library(meetings)
    home(meetings)
    glossary()
    research()
    outreach()
    help_page()
    os.makedirs(os.path.join(SITE, 'vendor'), exist_ok=True)
    for n in ('pdfjs.min.js', 'pdfjs.worker.min.js'):
        p = os.path.join(WEB, 'vendor', n)
        if os.path.exists(p): shutil.copy(p, os.path.join(SITE, 'vendor', n))
    open(os.path.join(SITE, '.nojekyll'), 'w').write('')
    print('[site] built', len(meetings), 'meetings;', 'upload target:', UPLOAD_URL or '(not set: built outside GitHub)')


if __name__ == '__main__':
    main()
