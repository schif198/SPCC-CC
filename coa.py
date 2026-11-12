import json, re, csv, glob, collections, statistics
exec(open('scripts/persia.py').read().split("M=[\"Noecker\"")[0].replace("print(","(lambda *a,**k:None)("))
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
NA='NOT AVAILABLE'
def w(n,rows):
    with open('out/'+n,'w',newline='') as f: d=csv.DictWriter(f,fieldnames=list(rows[0])); d.writeheader(); d.writerows(rows)
EXTRA=[('Workforce & talent', r'workforce|talent|apprentice|job training|employment|career|youth employ|skills'),
       ('Public safety', r'police|public safety|crime|violence|fire department|emergency|surveillance|security')]
ISS=[n for n,_ in BIZ]+[n for n,_ in EXTRA]
def issues_of(file,title):
    out=[]; b=biz(file,title)
    if b: out.append(b)
    for n,rx in EXTRA:
        if re.search(rx,file+' '+title,re.I): out.append(n)
    return out
LEAD={'motion to approve','amendment / version','motion to deny','spoke in favor','spoke against','raised concerns'}
PUSH={'spoke against','raised concerns','motion to delay','motion to deny'}
for a in A: a['iss']=issues_of(a['file'],a['title'])
for v in V: v['iss']=[] if v['consent_block'] else issues_of(v['file'],full.get((v['date'],v['file']),v['title']))
KW={'Labor & wages':'wage;minimum wage;prevailing wage;labor;workers;paid leave;sick time;scheduling;labor standards;union',
'Housing & tenant rules':'housing;rent;rental;tenant;eviction;landlord;rent stabilization;affordable;homeless;encampment;shelter;cub;tax credit;apartment',
'Economic development & incentives':'downtown;tif;tax increment;development;redevelopment;star;deed;grant;incentive;opportunity zone;port authority;business district;revitalization;galtier;small business;investment',
'Licensing & enforcement':'license;licensing;liquor;tobacco;cannabis;penalty;adverse action;inspection;enforcement;permit',
'Land use & permitting':'zoning;rezone;drive-thru;drive-through;drive thru;variance;land use;site plan;parking;height;building;permitting;comprehensive plan;sign',
'Utilities, franchises & fees':'fee;fees;franchise;xcel;utility;utilities;garbage;trash;water rate;energy;rates;transportation network;rideshare',
'Taxes, levies & assessments':'tax;taxes;levy;budget;assessment;bond;sales tax;property tax;special service district',
'Events, festivals & sound permits':'event;festival;sound;music;concert;hospitality;restaurant;bar;nightlife;sports;arts',
'Workforce & talent':'workforce;talent;training;apprenticeship;jobs;employment;career;skills;child care;childcare',
'Public safety':'safety;police;crime;security;violence;fire;emergency;public safety;downtown safety'}
CH={ # chamber link from supplied documents
'Labor & wages':('Strong business climate; Grow Leaders',NA,'"A strong business climate equals a strong community" and "Grow Leaders" (Strategic Plan 2024-2026)'),
'Housing & tenant rules':('CUB Tax Credit and Housing (2026 priority)','Support housing access and production; the 2026 report cites amending rent stabilization to permanently exempt buildings built after 2004 as a win.','"Equity is the lens through which we do all our work" and "Quality of life matters"; policy platform: people need access to employment and housing'),
'Economic development & incentives':('Downtown Revitalization (2026 priority); Drive Progress','Support downtown revitalization and economic development; the 2026 report cites amending the 2026-2027 Qualified Allocation Plan to support downtown revitalization as a win.','"Drive Progress": advocate for an environment that supports business growth and job creation, including new economic development opportunities'),
'Licensing & enforcement':('Strong business climate',NA,'"Support an economic environment that promotes business growth and success"'),
'Land use & permitting':('Stop Drive-thru Ban (2026 priority)','Oppose a drive-thru ban; the 2026 report cites exempting Urban Core building heights from the river corridor ordinance and state permitting reform that shortened timelines and made regulation more certain.','Regulatory certainty that supports investment; "Drive Progress"'),
'Utilities, franchises & fees':('Strong business climate',NA,'"Support an economic environment that promotes business growth and success"'),
'Taxes, levies & assessments':('Strong business climate',NA,'"Strong businesses invest in the community through good jobs and a tax base that supports infrastructure, public safety, schools"'),
'Events, festivals & sound permits':('Quality of life; Downtown Revitalization',NA,'"Quality of life matters": a livable community that attracts and retains top talent'),
'Workforce & talent':('Grow Leaders; Twin Cities Talent Hub (DEED Drive for 5 grant)','Support a ready workforce: talent development, retention and upskilling, career pathways.','"Grow Leaders" and "Equity is the lens": fully engage our diverse labor force'),
'Public safety':('Policy platform: people feel safe',"Support public safety as a condition for economic vitality (2026 report: \"it's essential that people feel safe\").",'"A strong business climate equals a strong community" (tax base that supports public safety)')}
km=collections.defaultdict(lambda:collections.Counter()); kp=collections.defaultdict(lambda:collections.Counter())
for a in A:
    for i in a['iss']:
        if a['action'] in LEAD: km[i][a['member']]+=1
        if a['action'] in PUSH: kp[i][a['member']]+=1
ci=[]
for i in ISS:
    vs=[v for v in V if i in v['iss']]; sp=[v for v in vs if v['yeas'] and v['nays']]
    lead=km[i].most_common(3); pb=kp[i].most_common(3)
    diss=collections.Counter()
    for v in sp:
        maj='Y' if v['yeas']>v['nays'] else 'N'
        for m in M:
            if v[m] not in ('A',maj): diss[m]+=1
    pos=CH[i][1]
    ci.append(dict(issue=i,keywords=KW[i],chamber_priority=CH[i][0],chamber_position=pos,value_frame=CH[i][2],
        votes=len(vs),unanimous_share=round(sum(not v['nays'] for v in vs)/len(vs),4) if vs else NA,splits=len(sp),
        lead_1=lead[0][0] if lead else NA,lead_1_n=lead[0][1] if lead else 0,lead_2=lead[1][0] if len(lead)>1 else NA,lead_2_n=lead[1][1] if len(lead)>1 else 0,lead_3=lead[2][0] if len(lead)>2 else NA,
        pushback=', '.join(f"{m} ({n})" for m,n in pb) or 'None recorded',dissenters=', '.join(f"{m} ({n})" for m,n in diss.most_common()) or 'None: every vote on this issue was unanimous'))
w('c_issues.csv',ci)
# items for search
itemrows=[]; seen=set()
acts=collections.defaultdict(list)
for a in A:
    if a['action']!='procedural motion': acts[(a['date'],a['file'])].append(f"{a['member']} {a['action']}")
for v in V:
    if v['consent_block']: continue
    k=(v['date'],v['file'],v['action'])
    if k in seen: continue
    seen.add(k)
    t=full.get((v['date'],v['file']),v['title'])
    itemrows.append(dict(id=len(itemrows)+1,date=v['date'],file=v['file'],title=re.sub(r'\s+',' ',t)[:220],action=v['action'][:80],tally=f"{v['yeas']}-{v['nays']}",
        split='Yes' if v['yeas'] and v['nays'] else 'No',issues=' · '.join(v['iss']) or NA,persia=' · '.join(v['lenses']) or NA,
        movers='; '.join(dict.fromkeys(acts.get((v['date'],v['file']),[]))) or NA,nays=v['nay_names'] or '',absent=v['absent_names'] or ''))
w('c_items.csv',itemrows)
print(len(itemrows),'items'); 
for r in ci: print(r['issue'],r['votes'],r['splits'],r['lead_1'],r['lead_2'],'|',r['pushback'],'|',r['dissenters'][:60])
