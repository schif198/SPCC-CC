import json, re, glob, collections, csv, datetime
exec(open('scripts/actions.py').read().split('rows=[]')[0])
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
BIZ=[
 ('Labor & wages', r'minimum wage|prevailing wage|labor standards|labor and community|wage rate|workers?\b|employment standard'),
 ('Housing & tenant rules', r'evict|tenant|rental|rent stabilization|\brent\b|landlord|shutoff'),
 ('Economic development & incentives', r'tax increment|\bTIF\b|\bSTAR\b|DEED|redevelop|economic development|Port Authority|opportunity zone|Planning and Economic Development|commercial corridor|business sign|contamination cleanup|livable communities|LCDA|Metropolitan Council grant|\bHRA\b|Housing and Redevelopment'),
 ('Licensing & enforcement', r'license|liquor|tobacco|adverse action|penalty|matrix|valet|second hand|gambling|change of ownership'),
 ('Land use & permitting', r'rezon|zoning|variance appeal|board of zoning|\bBZA\b|\bplat\b|site plan|interim use|drive-through|walk-up|right-of-way|commercial development district'),
 ('Utilities, franchises & fees', r'franchise|Xcel|Northern States Power|transportation network|license fees|utility|rates\b|District Energy|geothermal'),
 ('Taxes, levies & assessments', r'levy|special service district|assessment|bonds?\b'),
 ('Events, festivals & sound permits', r'sound level|sound variance|festival'),
]
def biz(file,title):
    s=file+' '+title
    if file.startswith('RLH'): return None
    for n,rx in BIZ:
        if re.search(rx,s,re.I): return n
    return None
full={}; items_all=[]
for f in sorted(glob.glob('pdftxt/*.txt')):
    for it in items(f):
        full[(it['date'],it['file'])]=it['title']; it['body_text']=' '.join(it['body']); items_all.append(it)
V=json.load(open('out/votes.json')); A=json.load(open('out/actions.json'))
for v in V: v['biz']=None if v['consent_block'] else biz(v['file'],full.get((v['date'],v['file']),v['title']))
for a in A: a['biz']=biz(a['file'],a['title'])
bv=[v for v in V if v['biz']]
print('biz votes',len(bv),collections.Counter(v['biz'] for v in bv))
print('biz splits',[(v['date'],v['file'],v['biz']) for v in bv if v['yeas'] and v['nays']])
print('biz actions',len([a for a in A if a['biz']]))
# pending items: last body mentions Laid over to / continued to a date after 10/28
pend=[]
LASTD=datetime.date.fromisoformat(max(v['date'] for v in V))
last={}
for it in sorted(items_all,key=lambda x:x['date']): last[it['file']]=it
for f,it in last.items():
    m=re.search(r'(Laid over|continued|Public hearing continued|Referred)[^.]*?(?:to|until)\s+(January|February|March|April|May|June|July|August|September|October|November|December) (\d+), (\d{4})',it['body_text'],re.I)
    if m:
        d=datetime.date(int(m[4]),['January','February','March','April','May','June','July','August','September','October','November','December'].index(m[2])+1,int(m[3]))
        if d>LASTD:
            st=re.search(r'(?:to|until)\s+\w+ \d+, \d{4},?\s+for\s+(Final Adoption|Second Reading|Third Reading|First Reading|Public Hearing)',it['body_text'],re.I)
            pend.append((it['date'],f,d.isoformat(),it['title'][:120],biz(f,it['title']),st[1].capitalize() if st else 'Pending'))
for p in pend: print('PEND',p)
# layover outcomes
byfile=collections.defaultdict(list)
for v in sorted(V,key=lambda v:v['date']): byfile[v['file']].append(v)
lay=[]
for f,vs in byfile.items():
    if f.startswith('Consent') or f=='Motion' or f.startswith('PH '): continue
    for i,v in enumerate(vs):
        if re.search(r'laid over|lay over|continued',v['action'],re.I) and not re.search(r'hearing closed|close',v['action'],re.I) or re.search(r'^laid over',v['action'],re.I):
            later=[x for x in vs[i+1:] if not re.search(r'laid over|continued|close|amend|version|approved',x['action'],re.I) or re.search(r'adopted',x['action'],re.I)]
            fin=later[0] if later else None
            out='Still pending' if any(p[1]==f for p in pend) else ('Adopted' if fin and re.search(r'adopt|approv|grant|deny the appeal|motion of intent',fin['action'],re.I) else ('Failed or denied' if fin and re.search(r'fail|denied',fin['action'],re.I) else 'No further vote recorded'))
            days=(datetime.date.fromisoformat(fin['date'])-datetime.date.fromisoformat(v['date'])).days if fin else ''
            lay.append(dict(date=v['date'],file=f,title=full.get((v['date'],f),v['title'])[:110],biz=v['biz'] or '',split=('Yes' if v['nays'] else 'No'),tally=f"{v['yeas']}-{v['nays']}",outcome=out,final_date=fin['date'] if fin else '',days_to_decision=days))
            break
print(len(lay),collections.Counter(l['outcome'] for l in lay))
for l in lay:
    if l['outcome']!='Adopted': print(l)
import statistics
print('median days',statistics.median([l['days_to_decision'] for l in lay if l['days_to_decision']!='']))
json.dump(dict(lay=lay,pend=pend),open('out/biz_tmp.json','w'))
for f in ['Ord 26-51','Ord 26-53','Ord 26-55','Ord 26-56']:
    for it in items_all:
        if it['file']==f: print(f,it['date'],it['body_text'][:300])
# ordinance clock
first=collections.defaultdict(lambda:'9999'); 
for it in items_all:
    if it['file'].startswith('Ord'): first[it['file']]=min(first[it['file']],it['date'])
ordc=[]
for f,d0 in first.items():
    ad=[v for v in byfile.get(f,[]) if re.match(r'adopted',v['action'],re.I)]
    if ad:
        d1=ad[-1]['date']; ordc.append(dict(file=f,title=full.get((d0,f),'')[:110],biz=biz(f,full.get((d0,f),'')) or '',first_seen=d0,adopted=d1,days=(datetime.date.fromisoformat(d1)-datetime.date.fromisoformat(d0)).days,
            changed='Yes' if any(re.search(r'amend|version',v['action'],re.I) for v in byfile[f]) else 'No'))
print('ordinances',len(ordc),'median days',statistics.median([o['days'] for o in ordc]),'amended share',sum(o['changed']=='Yes' for o in ordc)/len(ordc))
# member-moved delays
dl=[a for a in A if a['action']=='motion to delay']
dd=[]
for a in dl:
    later=[v for v in byfile.get(a['file'],[]) if v['date']>a['date'] and re.search(r'^adopted|^failed|denied|motion of intent',v['action'],re.I)]
    fin=later[0] if later else None
    dd.append(dict(date=a['date'],member=a['member'],file=a['file'],title=a['title'][:110],biz=a['biz'] or '',outcome=('Adopted' if fin and re.search('adopt|intent',fin['action'],re.I) else 'Failed or denied' if fin else ('Pending' if any(p[1]==a['file'] for p in pend) else 'No separate vote recorded later')),final_date=fin['date'] if fin else '',text=a['text']))
print(len(dd),collections.Counter(d['outcome'] for d in dd),collections.Counter(d['member'] for d in dd))
json.dump(dict(lay=lay,pend=pend,ordc=ordc,dd=dd),open('out/biz_tmp.json','w'))
