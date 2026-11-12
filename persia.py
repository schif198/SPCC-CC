import json, re, csv, collections
exec(open('scripts/biz.py').read().split('# pending items')[0])
L=[('Political', r'appoint|electing|officers|council committee|appendix a-2|legislative agenda|special counsel|ballot|urging|calling (on|upon)|denounc|defending|immigra|\bICE\b|federal (immigration|agents|operations|government|administration)|administrative ordinance|department of safety|disposition of city property|scrivener|animal control|planning commission|law enforcement|surveillance|\bflock\b|rule of law|constitution|charter|city clerk|city council staff|mayor.s |governor|state of minnesota|divest|data practices|audit committee|rules'),
 ('Economic', r'budget|grant|bonds?\b|levy|assessment|tax increment|\bTIF\b|\bSTAR\b|DEED|redevelop|economic|license|liquor|tobacco|adverse action|penalty|franchise|fees?\b|rates?\b|wage|labor|business|contract|lease|financ|fund|donation|port authority|opportunity zone|commercial|valet|purchase|rezon|zoning|plat\b|development|paving|overlay|sewer|transit|\bline\b|vacate|easement|right-of-way|special service district|operating plan|golf|salt storage|developers?|utility|energy|opt-in|drive-through|ford.s area|appendix c-2|minnesota department of'),
 ('Religious', r'church|faith|\bEid\b|ramadan|religio|dalai lama|tibetan|congregation|temple|mosque|synagogue|nativity|parish|diocese|catholic|lutheran|christian|islamic|jewish|buddhist|interfaith|ministry|ministries'),
 ('Social', r'^RLH|housing|tenant|\brent(al|ers?)?\b|evict|homeless|encampment|shelter|public safety|police|fire\b|violence|crime|health|youth|senior|heritage|juneteenth|pride|lgbt|gender|immigrant|refugee|community|recover|sober|disab|equity|families|neighborhood|domestic|day of|month\b|celebrat|honor|recogniz|commemorat|peace|traffic safety|accessib|food|child|\bday\b|climate|resilien|parks?\b|abatement|nuisance|razing|tree preservation'),
 ('Intellectual', r'librar|study|report|research|universit|college|school|academy|education|training|data practices|audit committee|wilder|bookstore|history|professor|scholar|learning|science|census'),
 ('Artistic', r'\barts?\b|artist|music|jazz|blues|festival|concert|cultural|culture|statue|mural|theat|ordway|sound level|sound variance|dance|drill team|film|museum|heritage|celebration|fest\b|fair\b|light the night|tree of lights'),
]
def lenses(file,title):
    s=file+' '+title
    out=[n for n,rx in L if re.search(rx,s,re.I)]
    return out
LEAD={'motion to approve','amendment / version','motion to deny','spoke in favor','spoke against','raised concerns'}
PUSH={'spoke against','raised concerns','motion to delay','motion to deny'}
for v in V: v['lenses']=[] if v['consent_block'] else lenses(v['file'],full.get((v['date'],v['file']),v['title']))
for a in A: a['lenses']=lenses(a['file'],a['title'])
nv=[v for v in V if not v['consent_block']]
print('items w/o lens',sum(not v['lenses'] for v in nv),'of',len(nv))
print(collections.Counter(l for v in nv for l in v['lenses']))
for v in nv:
    if not v['lenses']: print('  none:',v['file'],full.get((v['date'],v['file']),v['title'])[:90])
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
LN=[n for n,_ in L]
def w(n,rows,fields=None):
    with open('out/'+n,'w',newline='') as f: d=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else fields); d.writeheader(); d.writerows(rows)
lm=[];
tot_lead=collections.Counter(l for a in A if a['action'] in LEAD for l in a['lenses']); tl=sum(tot_lead.values())
for m in M:
    ma=[a for a in A if a['member']==m]
    ml=collections.Counter(l for a in ma if a['action'] in LEAD for l in a['lenses']); mt=sum(ml.values()) or 1
    for l in LN:
        vs=[v for v in nv if l in v['lenses']]
        lm.append(dict(member=m,lens=l,lead=ml[l],share=round(ml[l]/mt,4),council_share=round(tot_lead[l]/tl,4),index=round((ml[l]/mt)/(tot_lead[l]/tl),3) if tot_lead[l] else 0,
            pushback=sum(1 for a in ma if a['action'] in PUSH and l in a['lenses']),nay=sum(v[m]=='N' for v in vs),absent=sum(v[m]=='A' for v in vs),votes=len(vs)))
w('b_persia_member.csv',lm)
NOTE={'Political':'Appointments, council rules and resolutions on state and federal matters. Signals coalitions and the relationship with the mayor; split votes cluster here.',
'Economic':'Budgets, grants, licenses, fees, wages, zoning and development. The chamber\'s core lane: most items pass without dissent, so shaping them early matters more than whipping votes.',
'Religious':'Items involving faith institutions or religious observances, such as church property petitions and holiday recognitions. Rare, but useful for coalition-building with faith-based employers and nonprofits.',
'Social':'Housing, tenants, public safety, health and community recognitions. Tenant and housing rules are where business interests have met the council\'s sharpest splits.',
'Intellectual':'Libraries, schools and universities, studies, reports and training. Studies the council commissions, such as the business sign zoning study, often come before regulation.',
'Artistic':'Festivals, arts districts, cultural events and sound permits. High volume, low conflict, and closely tied to hospitality, restaurants and downtown traffic.'}
AV={'Political':('Appointments, council rules and officers, resolutions on state and federal matters, roll-call splits.','Party affiliation, endorsements, campaign contributions, and negotiations outside the meeting.'),
'Economic':('Budgets, grants, levies, fees, licenses, wages, zoning and development votes.','Fiscal-impact estimates for most items, effects on specific businesses, and members\' business ties.'),
'Religious':('Church property petitions, faith-based event permits and religious observances.','Members\' religious affiliations or faith-based positions, and congregations\' stances on items.'),
'Social':('Housing and tenant rules, public safety, health, property appeals and community recognitions.','Ward demographics, constituent sentiment, and what public commenters said (the minutes mostly note how many people spoke).'),
'Intellectual':('Libraries, schools and universities, commissioned studies, reports and training.','The content of studies and staff reports, expert testimony, and members\' policy writing.'),
'Artistic':('Festivals, arts districts, cultural events, statues and sound permits.','Arts-funding totals across the budget, and the attendance or economic impact of events.')}
NA='NOT AVAILABLE'
ls=[]
for l in LN:
    vs=[v for v in nv if l in v['lenses']]; rows=sorted([r for r in lm if r['lens']==l],key=lambda r:-r['lead'])
    ls.append(dict(lens=l,letter=l[0],votes=len(vs),unanimous_share=round(sum(not v['nays'] for v in vs)/len(vs),4) if vs else '',splits=sum(bool(v['yeas'] and v['nays']) for v in vs),
        lead_actions=tot_lead[l],champion_1=rows[0]['member'] if rows[0]['lead'] else NA,champion_1_n=rows[0]['lead'],champion_2=rows[1]['member'] if rows[1]['lead'] else NA,champion_2_n=rows[1]['lead'],note=NOTE[l],available=AV[l][0],not_available=AV[l][1]))
w('b_persia.csv',ls)
# add lenses to splits, watch, log
def addcol(fn,keyfn):
    rd=csv.DictReader(open('out/'+fn)); rows=list(rd)
    for r in rows: r['persia']=' · '.join(keyfn(r))
    w(fn,rows,list(rd.fieldnames or [])+['persia'])
tit={}
for (d,f),t in full.items(): tit[f]=t
addcol('b_splits.csv',lambda r: lenses(r['file'],full.get((r['date'],r['file']),'')))
addcol('b_watch.csv',lambda r: lenses(r['file'],tit.get(r['file'],r['item'])))
wr=list(csv.DictReader(open('out/b_watch.csv')))
for r in wr:
    if r['movers'] in ('none recorded',''): r['movers']=NA
    if r['last_tally']=='no roll call yet': r['last_tally']=NA
    if not r['persia']: r['persia']=NA
w('b_watch.csv',wr,['file','item','issue','next_meeting','stage','last_action_date','last_tally','movers','persia'])
addcol('b_log.csv',lambda r: lenses(r['file'],r['item']))
for r in ls: print(r['lens'],r['votes'],r['unanimous_share'],r['splits'],r['champion_1'],r['champion_2'])
print(open('out/b_watch.csv').read())
print(set((r['file'],r['persia']) for r in csv.DictReader(open('out/b_splits.csv'))))
