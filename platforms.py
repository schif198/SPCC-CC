"""Compare each member's campaign platform (narrative/platforms.csv) with their 2026 record in the minutes.
Writes out/pv_platforms.csv, out/pv_cells.csv, out/pv_theme.csv and out/pv_items.csv."""
import csv, collections, json, re, glob
exec(open('scripts/actions.py').read().split('rows=[]')[0])
M = ["Noecker", "Yang", "Kim", "Bowie", "Jost", "Johnson", "Coleman"]
THEMES = [
    ('Housing & renters', r'\bhousing\b|\btenants?\b|\brent(al|ers?)?\b|rent stabilization|\bevict|homeless|encampment|\bshelter\b|affordab|homeowner|HOME-ARP|\bHRA\b|landlord'),
    ('Public safety', r'\bpolice|public safety|violence|\bcrime|\bfire\b|firefight|emergency|traffic safety|surveillance|\bsafety\b'),
    ('Jobs & workers', r'\bwages?\b|minimum wage|prevailing wage|labor|\bworkers?\b|employment|workforce|apprentice|job training|\bjobs\b'),
    ('Business & development', r'business|economic development|tax increment|\bTIF\b|\bSTAR\b|redevelop|commercial|downtown|DEED|Port Authority|opportunity zone|development district|\bliquor\b|license'),
    ('Climate & environment', r'climate|solar|energy|emission|\btrees?\b|canopy|organics|electric vehicle|\bEV\b|geothermal|weatheriz|resilien|environment|green|stormwater|pollut'),
    ('Streets & transit', r'\bstreets?\b|paving|mill and overlay|\broads?\b|bridge|\bbike|bikeway|\btrail|transit|sidewalk|traffic|\bbus\b|light rail|\balley|right-of-way|pedestrian'),
    ('City services & budget', r'budget|\blevy\b|librar|\bparks?\b|recreation|\btrash\b|garbage|solid waste|\bsnow|\bfees?\b|franchise|revenue|\bbonds?\b|tax base|appropriat|finance'),
    ('Child care & youth', r'child ?care|\byouth|early childhood|\bschools?\b|young people|children|\bkids\b|teen'),
]
TN = [t for t, _ in THEMES]
def themes_of(s):
    return [t for t, rx in THEMES if re.search(rx, s, re.I)]
LEAD = {'motion to approve', 'amendment / version', 'motion to deny', 'spoke in favor', 'spoke against', 'raised concerns'}

full = {}
for f in sorted(glob.glob('pdftxt/*.txt')):
    for it in items(f): full[(it['date'], it['file'])] = re.sub(r'\s+', ' ', it['title'])
V = [v for v in json.load(open('out/votes.json')) if not v['consent_block']]
A = json.load(open('out/actions.json'))
for v in V: v['th'] = [] if v['file'] == 'Motion' else themes_of(v['file'] + ' ' + full.get((v['date'], v['file']), v['title']))
for a in A: a['th'] = themes_of(a['file'] + ' ' + a['title'])
P = list(csv.DictReader(open('narrative/platforms.csv')))
stated = collections.defaultdict(set)
for p in P: stated[p['member']].add(p['theme'])

lead = [a for a in A if a['action'] in LEAD]
c_lead = collections.Counter(t for a in lead for t in a['th']); c_tot = sum(c_lead.values()) or 1
cells = []
for m in M:
    ml = [a for a in lead if a['member'] == m]
    m_lead = collections.Counter(t for a in ml for t in a['th']); m_tot = sum(m_lead.values()) or 1
    for t in TN:
        vs = [v for v in V if t in v['th']]
        ms, cs = m_lead[t] / m_tot, c_lead[t] / c_tot
        fi = round(ms / cs, 2) if cs else 0
        n = m_lead[t]
        level = 3 if (n >= 4 and fi >= 1.15) else 2 if n >= 4 or (n >= 2 and fi >= 1) else 1 if n >= 1 else 0
        ex = sorted([a for a in ml if t in a['th']], key=lambda a: a['date'])
        e = ex[-1] if ex else None
        cells.append(dict(member=m, theme=t, stated='Yes' if t in stated[m] else 'No', votes=len(vs),
                          yea=sum(v[m] == 'Y' for v in vs), nay=sum(v[m] == 'N' for v in vs), absent=sum(v[m] == 'A' for v in vs),
                          lead=n, member_share=round(ms, 4), council_share=round(cs, 4), focus=fi, level=level,
                          level_label=['None recorded', 'Some', 'Active', 'Leading'][level],
                          example=(e['title'][:110] if e else ''), example_action=(e['action'] if e else ''), example_date=(e['date'] if e else '')))
th = []
for t in TN:
    vs = [v for v in V if t in v['th']]
    th.append(dict(theme=t, members_stated=sum(t in stated[m] for m in M), members=len(M), votes=len(vs),
                   vote_share=round(len(vs) / len(V), 4) if V else 0, splits=sum(bool(v['yeas'] and v['nays']) for v in vs),
                   lead=c_lead[t], lead_share=round(c_lead[t] / c_tot, 4)))
acts = collections.defaultdict(list)
for a in A:
    if a['action'] != 'procedural motion': acts[(a['date'], a['file'])].append(a['member'])
it, seen = [], set()
for v in sorted(V, key=lambda v: v['date'], reverse=True):
    k = (v['date'], v['file'], v['action'])
    if k in seen or not v['th']: continue
    seen.add(k)
    for t in v['th']:
        it.append(dict(id=len(it) + 1, theme=t, date=v['date'], file=v['file'], title=full.get((v['date'], v['file']), v['title'])[:150],
                       tally=f"{v['yeas']}-{v['nays']}", split='Yes' if v['yeas'] and v['nays'] else 'No', nays=v['nay_names'] or '',
                       movers=', '.join(dict.fromkeys(acts.get((v['date'], v['file']), [])))))
def w(n, rows):
    with open('out/' + n, 'w', newline='') as fh:
        d = csv.DictWriter(fh, fieldnames=list(rows[0])); d.writeheader(); d.writerows(rows)
w('pv_platforms.csv', P); w('pv_cells.csv', cells); w('pv_theme.csv', th); w('pv_items.csv', it)
