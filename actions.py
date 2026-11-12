import re, glob, os, json, collections
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
MON={m:i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}
ITEM=re.compile(r'^(\d+)?\s*((?:RES PH|RES|Ord|RLH \w+|ABZA|APC|AO|PH|SR)\s*[\d-]*)\s{2,}(\S.*)')
def clean(L):
    L=[x.replace('\f','') for x in L]
    return ['' if (re.match(r'^City of Saint Paul\s+Page \d+',x) or re.match(r'^City Council\s+Meeting Minutes',x)) else x for x in L]
def items(path):
    L=clean(open(path).read().split('\n'))
    date=None
    for l in L[:40]:
        m=re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December) (\d+), (\d{4})',l)
        if m: date=f"{m[3]}-{MON[m[1]]:02d}-{int(m[2]):02d}"; break
    out=[];cur=None;section=''
    for l in L:
        if re.match(r'^\s{5,14}[A-Z][A-Z0-9 &/,\'()\-]{5,}$',l) and 'Councilmember' not in l and 'ROLL CALL' not in l:
            section=l.strip(); cur=None; continue
        m=re.match(r'^(\d+)\s{2,}((?:RES PH|RES|Ord|RLH \w+|ABZA|APC|AO|PH|SR)\s*[\d-]*)\s{2,}(\S.*)',l) or re.match(r'^\s{5,14}((?:RES PH|RES|Ord|RLH \w+|ABZA|APC|PH))(\s*[\d-]+)\s{2,}(\S.*)',l)
        if m:
            if m.re.pattern.startswith('^(\\d'): file,t=m[2].strip(),m[3]
            else: file,t=(m[1]+m[2]).strip(),m[3]
            cur=dict(date=date,file=file,section=section,title=t.strip(),body=[],intitle=True); out.append(cur); continue
        if cur is None: continue
        s=l.strip()
        if not s: cur['intitle']=False; continue
        if cur['intitle'] and not re.search(r'moved|Adopted|Laid over|spoke|Yea:|remarks|Received',s): cur['title']+=' '+s
        else: cur['intitle']=False; cur['body'].append(s)
    return out
TOPICS=[
 ('Immigration & federal enforcement', r'immigra|\bICE\b|federal (immigration|agents|operations|rule)|law enforcement|divest|refugee'),
 ('Policing & public safety', r'\bpolice|\bfire\b|firefight|emergency management|public safety|surveillance|\bflock\b|crime|violence|traffic safety|homeland'),
 ('Recognitions & resolutions of support', r'recogniz|\bhonor|proclaim|celebrat|commemorat|co-nam|\burging\b|calling upon|denounc|defending|memorial|legacy'),
 ('Appointments & council governance', r'appoint|electing|officers of the city council|staff positions|legislative agenda|city clerk|special counsel|rate of pay|qualifications|appendix a-2|administrative code relating to city council|chapter 16 of the admin|audit committee|data practices'),
 ('Housing, tenants & homelessness', r'\bhousing\b|\btenants?\b|\brental\b|rent stabilization|\bevict\w*|pre-eviction|homeless\w*|encampment|\bshelter\b|HOME-ARP|\bHOME\b|affordable|shutoff|homeownership|sober house'),
 ('Property appeals & nuisance orders', r'^RLH|abatement|nuisance|razing|vacant building|correction (order|notice)'),
 ('Zoning, land use & development', r'\brezon|zoning|\bBZA\b|board of zoning|\bplat\b|site plan|interim use|tax increment|\bTIF\b|drive-through|right-of-way|land survey|^ABZA|^APC|redevelopment'),
 ('Licenses & business regulation', r'license|liquor|tobacco|adverse action|penalty|franchise|transportation network|minimum wage|prevailing wage|labor standards|valet|business'),
 ('Events & sound permits', r'sound level|sound variance|festivals and events'),
 ('Streets, parks & environment', r'\bstreet|sewer|paving|mill and overlay|\btrail|\bparks?\b|\btrees?\b|canopy|climate|solar|transit|\bline\b|bridge|library|zoo|\bsalt\b|organics|electric vehicle|\bEV\b|geothermal|water|golf|solid waste|parking|alley|energy|lighting|sidewalk'),
 ('Budget, finance & grants', r'budget|grant|\bbonds?\b|levy|donation|financ|\bfunds?\b|assessment|appropriat|\bSTAR\b|special service district'),
]
def topic(file,title,section=''):
    if re.search(r'eviction moratorium|shutoff moratorium',title,re.I): return 'Housing, tenants & homelessness'
    if file.startswith('Consent block'):
        return 'Property appeals & nuisance orders' if 'Legislative' in file else 'Consent agenda (routine block)'
    if 'sound level' in title.lower() or 'sound variance' in title.lower(): return 'Events & sound permits'
    s=file+' '+title
    for name,rx in TOPICS:
        if re.search(rx,s,re.I): return name
    return 'Other'
NAMES=r'((?:(?:Council President|Vice President|Councilmembers?|CM)\s+)?(?:' + '|'.join(M) + r')(?:(?:,\s*|\s*,?\s*and\s+)(?:Councilmembers?\s+)?(?:' + '|'.join(M) + r'))*)'
ACT=re.compile(NAMES+r'\s+(moved|spoke in favor|spoke in support|spoke against|spoke in opposition|expressed (?:a )?concerns?|spoke to (?:legal )?concerns|spoke to|spoke|gave remarks|changed (?:her|his|their) motion|offered|requested)([^.;]*)')
def classify(verb,rest):
    if verb=='moved' or verb.startswith('changed'):
        r=rest.lower()
        if 'close' in r and 'hearing' in r: return 'procedural motion'
        if 'lay over' in r or 'layover' in r or 'laid over' in r or 'continue' in r or 'refer' in r: return 'motion to delay'
        if 'denial' in r or 'deny' in r: return 'motion to deny'
        if 'version' in r or 'amend' in r or 'substitut' in r: return 'amendment / version'
        if 'suspend' in r or 'reconsider' in r: return 'procedural motion'
        return 'motion to approve'
    if verb in ('spoke in favor','spoke in support'):
        return 'spoke against' if re.search(r'denial|against',rest,re.I) and 'approval' not in rest.lower() else 'spoke in favor'
    if verb.startswith('expressed') or 'concerns' in verb: return 'raised concerns'
    if verb in ('spoke against','spoke in opposition'): return 'spoke against'
    return 'remarks'
rows=[]
for f in sorted(glob.glob('pdftxt/*.txt')):
    for it in items(f):
        text=' '.join(it['body'])
        tp=topic(it['file'],it['title'])
        for m in ACT.finditer(text):
            who=[x for x in M if re.search(r'\b'+x+r'\b',m[1])]
            kind=classify(m[2],m[3])
            for w in who: rows.append(dict(date=it['date'],member=w,file=it['file'],title=it['title'][:140],topic=tp,action=kind,text=(m[0][:160])))
json.dump(rows,open('out/actions.json','w'),indent=0)
c=collections.Counter((r['action']) for r in rows); print(len(rows),c)
print(collections.Counter(r['topic'] for r in rows).most_common())
print(collections.Counter(r['member'] for r in rows))
