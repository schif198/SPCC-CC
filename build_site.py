"""Build the website in _site/ from build/out (made by run.py) and web/.

Usage (from the repository root):  python3 pipeline/build_site.py
Optional environment: GITHUB_REPOSITORY (owner/repo) and GITHUB_REF_NAME (branch) set the upload button target;
both are set automatically inside GitHub Actions.
"""
import csv, datetime, html, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'out')
WEB = os.path.join(ROOT, 'web')
SITE = os.path.join(ROOT, '_site')
LEGISTAR = 'https://stpaul.legistar.com/DepartmentDetail.aspx?ID=11351&GUID=54C2264A-286D-435B-85A5-F0C20155343F&Mode=MainBody'
REPO = os.environ.get('GITHUB_REPOSITORY', '').strip()
BRANCH = os.environ.get('GITHUB_REF_NAME', 'main').strip() or 'main'
UPLOAD_URL = f'https://github.com/{REPO}/upload/{BRANCH}/minutes' if REPO else ''
ACTIONS_URL = f'https://github.com/{REPO}/actions' if REPO else ''


def rd(p): return open(os.path.join(WEB, p), encoding='utf-8').read()
def js(s): return s.replace('</script', '<\\/script').replace('<!--', '<\\!--')
def esc(s): return html.escape(s, quote=True)
def csvtext(n): return open(os.path.join(OUT, n + '.csv'), encoding='utf-8').read()


D3, SHIM, PRINTJS, THEME, SITECSS = rd('vendor/d3.min.js'), rd('shim.js'), rd('print.js'), rd('theme.css'), rd('site.css')
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
PAGES = [('index.html', 'Home'), ('library.html', 'Minutes library'), ('voting-trends.html', 'Voting trends'), ('member-by-member.html', 'Members'),
         ('playbook.html', 'Playbook'), ('course-of-action.html', 'Course of action')]


def nav(current, printable):
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{h}"{cur if h == current else ""}>{t}</a>' for h, t in PAGES)
    pr = f'<button id="sa-print" class="sa-btn" type="button" title="Print a one-page summary of what this page shows">{PRINT_ICON}Print one-pager</button>' if printable else ''
    return (f'<nav class="sa-nav" aria-label="Site"><a class="brand" href="index.html">St. Paul City Council 2026</a><div class="links">{links}</div>'
            f'<div class="act"><a class="sa-btn ghost" href="{LEGISTAR}" target="_blank" rel="noopener" title="The city’s official list of City Council meetings, agendas and minutes">Council minutes on Legistar ↗</a>{pr}</div></nav>')


def template(page):
    """Swap fixed date wording in the page sources for the dates in the current data."""
    page = re.sub(r'January 7 (–|through) October 28(, 2026)?', lambda m: f'{LONG(FIRST)} {m[1]} {LONG(LAST)}', page)
    page = page.replace('; the November 4 meeting had no minutes yet.', '.')
    nxt = f'Next meeting: {d(NEXT, "%A, %B %d")}' if NEXT else 'Next meeting: no items scheduled to return in the latest minutes'
    page = page.replace('Next meeting: Wednesday, November 4', nxt)
    return page


def shell(title, body, head_extra='', scripts=''):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
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
    page = template(rd('pages/' + page_file))
    page = re.sub(r'<meta name="dash-one-writer">\s*', '', page)
    page = re.sub(r'<script src="app\.js"></script>\s*', '', page)
    app = rd('pages/' + app_file) if app_file else ''
    raw = {k: (v if isinstance(v, str) and '\n' in v else csvtext(v)) for k, v in data.items()}
    head = (f'<script>{js(D3)}</script>\n<script>window.__DASH_DATA__ = {js(json.dumps(raw))}; window.__DASH_PARAMS__ = {json.dumps(params)}; '
            f'window.__META__ = {json.dumps(META)};</script>\n<script>{js(SHIM)}</script>')
    body = (f'{nav(out, True)}\n<div id="dash-root">\n{page}\n<p class="sa-foot">Data: St. Paul City Council meeting minutes, {SPAN_LONG}. '
            f'Updates automatically when new minutes are added to the <a href="library.html">minutes library</a>.</p>\n</div>')
    scripts = f'<script>{js(app)}</script>\n<script>window.__PRINT_KIND__ = {json.dumps(kind)};</script>\n<script>{js(PRINTJS)}</script>'
    open(os.path.join(SITE, out), 'w', encoding='utf-8').write(shell(title, body, head, scripts))


def playbook_watch():
    rows = list(csv.DictReader(open(os.path.join(OUT, 'b_watch.csv'))))
    for r in rows:
        if r.get('last_tally') == 'NOT AVAILABLE': r['last_tally'] = 'no roll call yet'
        if r.get('movers') == 'NOT AVAILABLE': r['movers'] = ''
    if not rows:
        return 'file,item,issue,next_meeting,stage,last_action_date,last_tally,movers,persia\n'
    import io
    s = io.StringIO(); w = csv.DictWriter(s, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    return s.getvalue()


def library(meetings):
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
  <dialog id="lib-upload" class="lib-dialog">
    <h2>Add the latest meeting minutes</h2>
    <ol>
      <li>Download the new minutes PDF from the city’s <a href="{LEGISTAR}" target="_blank" rel="noopener">Legistar page</a> (the “Minutes” link for the meeting).</li>
      <li>Click <b>Open the upload page</b> below and sign in to GitHub if asked.</li>
      <li>Drag the PDF onto the page, then click <b>Commit changes</b>.</li>
      <li>In about 3 minutes every dashboard, one-pager and this library update for everyone. {status}</li>
    </ol>
    <p class="lib-small">Only PDFs of City Council meeting minutes are used. Other files and duplicates are skipped automatically, and a meeting uploaded twice is counted once.</p>
    <div class="lib-dacts">{up_btn}<button class="sa-btn ghost lib-close" type="button">Close</button></div>
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
.lib-card { background: var(--color-panel); border: 1px solid var(--color-border-line); border-left: 4px solid #c96442; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
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
</style>"""
    data = dict(meetings=meetings, built=BUILT, legistar=LEGISTAR)
    scripts = f'<script>window.__LIB__ = {js(json.dumps(data))};</script>\n<script>{js(rd("library.js"))}</script>'
    open(os.path.join(SITE, 'library.html'), 'w', encoding='utf-8').write(shell('City Council meeting minutes library', body, css, scripts))


def home(meetings):
    latest = meetings[0]['date'] if meetings else LAST
    cards = [
        ('library.html', 'Minutes library', 'Every meeting’s minutes with the original PDFs, searchable by item, file number or date. Upload new minutes here.'),
        ('course-of-action.html', 'Chamber course of action', 'Member-by-member engagement plan, Chamber priorities on the record, and a topic search that builds a course of action for any issue.'),
        ('playbook.html', 'Chamber lobbying playbook', 'Business items coming up, the agenda through the PERSIA lenses, the coalition map, split votes and how long ordinances take.'),
        ('member-by-member.html', 'Member by member', 'Each councilmember’s votes, majority alignment, debate activity and allies, with a month slider.'),
        ('voting-trends.html', 'Voting trends', 'Council-wide totals, participation by month, who votes together, and every split vote.'),
    ]
    cg = ''.join(f'<a class="hm-card" href="{h}"><h2>{t}</h2><p>{p}</p></a>' for h, t, p in cards)
    body = f"""{nav('index.html', False)}
<main class="hm">
  <h1>St. Paul City Council, 2026</h1>
  <p class="hm-lede">Interactive dashboards built from the City Council meeting minutes ({SPAN_LONG}; {len(meetings)} meetings) for the St. Paul Area Chamber. Each page has a <b>Print one-pager</b> button for a one-page summary.</p>
  <div class="hm-quick">
    <a class="sa-btn" href="{LEGISTAR}" target="_blank" rel="noopener">City Council minutes on Legistar ↗</a>
    <a class="sa-btn ghost" href="library.html">Browse all minutes</a>
    <span class="hm-latest">Latest minutes: {d(latest, '%A, %B %d, %Y')}</span>
  </div>
  <div class="hm-grid">{cg}</div>
  <footer class="hm-foot">Site updated {datetime.datetime.now(datetime.timezone.utc).strftime('%B %d, %Y').replace(' 0', ' ')}. Data refreshes automatically when new minutes are uploaded in the minutes library.</footer>
</main>"""
    css = """<style>
.hm { max-width: 900px; margin: 0 auto; padding: 36px 20px 60px; font-family: var(--font-anthropic-sans); }
.hm h1 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 2.2rem; margin: 0 0 8px; }
.hm-lede { color: var(--color-fg-muted); line-height: 1.5; margin: 0 0 16px; }
.hm-quick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 24px; }
.hm-quick .sa-btn { font-size: .95rem; padding: 9px 18px; }
.hm-latest { font-size: .85rem; color: var(--color-fg-muted); }
.hm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; }
.hm-card { display: block; text-decoration: none; color: inherit; background: var(--color-panel); border: 1px solid var(--color-border-line); border-top: 4px solid #c96442; border-radius: 10px; padding: 16px 18px; }
.hm-card:hover { border-color: var(--color-fg-muted); border-top-color: #c96442; }
.hm-card h2 { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: 1.25rem; margin: 0 0 6px; }
.hm-card p { margin: 0; color: var(--color-fg-muted); font-size: .9rem; line-height: 1.45; }
.hm-foot { margin-top: 28px; font-size: .75rem; color: var(--color-fg-muted); border-top: 1px solid var(--color-border-line); padding-top: 10px; }
</style>"""
    open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(shell('St. Paul City Council 2026: dashboards', body, css))


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
    dashboard('playbook.html', 'Chamber of Commerce playbook: St. Paul City Council, 2026', 'playbook.html', 'playbook.js', pb, {'member': 'All'}, 'playbook')
    dashboard('course-of-action.html', 'St. Paul Chamber course of action: City Council 2026', 'course-of-action.html', 'course-of-action.js',
              {k: k for k in ['c_members', 'c_priorities', 'c_issues', 'c_items', 'b_kpis', 'b_watch']}, {'tab': 'plan', 'q': ''}, 'coa')
    library(meetings)
    home(meetings)
    open(os.path.join(SITE, '.nojekyll'), 'w').write('')
    print('[site] built', len(meetings), 'meetings;', 'upload target:', UPLOAD_URL or '(not set: built outside GitHub)')


if __name__ == '__main__':
    main()
