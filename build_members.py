import json, csv, glob, collections, re
exec(open('scripts/actions.py').read().split('rows=[]')[0])
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
FULL={'Noecker':('Rebecca Noecker','Council President'),'Yang':('Nelsie Yang','Vice President'),'Kim':('HwaJeong Kim','Councilmember'),
      'Bowie':('Anika Bowie','Councilmember'),'Jost':('Saura Jost','Councilmember'),'Johnson':('Cheniqua Johnson','Councilmember'),'Coleman':('Molly Coleman','Councilmember')}
full={}
for f in sorted(glob.glob('pdftxt/*.txt')):
    for it in items(f): full[(it['date'],it['file'])]=it['title']
V=json.load(open('out/votes.json')); A=json.load(open('out/actions.json'))
for v in V: v['topic']=topic(v['file'], full.get((v['date'],v['file']), v['title']))
def w(name,rows):
    with open('out/'+name,'w',newline='') as fh:
        d=csv.DictWriter(fh,fieldnames=list(rows[0])); d.writeheader(); d.writerows(rows)
# votes by topic
topics=sorted({v['topic'] for v in V})
tv=[]
for m in M:
    for t in topics:
        rs=[v for v in V if v['topic']==t]
        if not rs: continue
        tv.append(dict(member=m,topic=t,yea=sum(v[m]=='Y' for v in rs),nay=sum(v[m]=='N' for v in rs),absent=sum(v[m]=='A' for v in rs),votes=len(rs)))
w('m_topic_votes.csv',tv)
# actions
LEAD={'motion to approve','amendment / version','motion to deny','spoke in favor','spoke against','raised concerns'}
lead=[a for a in A if a['action'] in LEAD]
council=collections.Counter(a['topic'] for a in lead); ctot=sum(council.values())
fo=[]
for m in M:
    mc=collections.Counter(a['topic'] for a in lead if a['member']==m); mt=sum(mc.values())
    for t in sorted(council):
        ms=mc[t]/mt if mt else 0; cs=council[t]/ctot
        fo.append(dict(member=m,topic=t,lead_actions=mc[t],member_share=round(ms,4),council_share=round(cs,4),focus_index=round(ms/cs,3) if cs else 0))
w('m_topic_focus.csv',fo)
ACTS=['motion to approve','amendment / version','motion to deny','motion to delay','spoke in favor','spoke against','raised concerns','procedural motion','remarks']
w('m_actions.csv',[dict(member=m,action=k,count=sum(1 for a in A if a['member']==m and a['action']==k)) for m in M for k in ACTS])
w('m_action_log.csv',[dict(id=i+1,date=a['date'],member=a['member'],file=a['file'],topic=a['topic'],action=a['action'],item=a['title'][:120],minutes_text=a['text']) for i,a in enumerate([a for a in sorted(A,key=lambda a:(a['date'],a['member'])) if a['action']!='procedural motion'])])
# splits
ISSUE={('2026-02-18','ABZA 26-1'):'Fence variance appeal (Phalen Blvd): intent to deny the appeal',
 ('2026-02-25','RES PH 26-59'):'Lay over: writing off police staffing costs for free community festivals',
 ('2026-03-04','RLH SAO 26-11'):'Nuisance finding, 1079 Western Ave N: authorize city abatement',
 ('2026-03-25','Ord 26-18'):'Pre-eviction notice (30 to 60 days): Noecker\'s Version 3 amendment',
 ('2026-04-22','RES 26-619'):'Lay over: resolution urging European divestment from firms enabling DHS/ICE',
 ('2026-05-13','RES 26-791'):'Lay over: Melanie McMahon as Planning & Economic Development director',
 ('2026-05-27','RES 26-791'):'Approve Melanie McMahon as Planning & Economic Development director',
 ('2026-08-05','RES 26-1253'):'Put a tenant-repair ballot question on the Nov. 2026 ballot',
 ('2026-08-12','RLH SAO 26-62'):'Abatement appeal, 369 Dale St N: extend compliance to Oct 26',
 ('2026-09-09','RES 26-1543'):'Co-name Milton St & Iglehart Ave for Prof. Mahmoud El-Kati',
 ('2026-10-28','ABZA 26-5'):'Zoning appeal, 2094 Goodrich Ave: intent to deny the appeal'}
sp=[]
for v in V:
    if not(v['yeas'] and v['nays']): continue
    iss=ISSUE.get((v['date'],v['file'])) or (v['action'].rstrip('.')+': '+re.sub(r'\s+',' ',full.get((v['date'],v['file']),v['title']))[:80])
    if v['file']=='RES 26-1502': iss='Street co-naming policy: '+('Version 1 (failed)' if v['yeas']==3 else 'Version 2 (adopted)')
    maj='Y' if v['yeas']>v['nays'] else 'N'
    for m in M:
        sp.append(dict(member=m,date=v['date'],file=v['file'],issue=iss,topic=v['topic'],vote={'Y':'Yea','N':'Nay','A':'Absent'}[v[m]],
            tally=f"{v['yeas']}-{v['nays']}",outcome='Passed' if v['passed'] else 'Failed',
            with_majority='—' if v[m]=='A' else ('Yes' if v[m]==maj else 'No')))
w('m_splits.csv',sp)
# profile
ag=list(csv.DictReader(open('out/agreement.csv')))
mem={r['member']:r for r in csv.DictReader(open('out/members.csv'))}
prof=[]
for m in M:
    acts=collections.Counter(a['action'] for a in A if a['member']==m)
    f=[x for x in fo if x['member']==m and x['lead_actions']>=3 and x['topic']!='Other']
    top=max(f,key=lambda x:x['focus_index']) if f else None
    pr=[r for r in ag if r['a']==m and r['b']!=m]
    cl=max(pr,key=lambda r:float(r['share'])); fa=min(pr,key=lambda r:float(r['share']))
    d=mem[m]; cast=int(d['yea'])+int(d['nay'])
    prof.append(dict(member=m,full_name=FULL[m][0],role=FULL[m][1],votes=sum(1 for _ in V),yea=d['yea'],nay=d['nay'],absent=d['absent'],
        participation=d['participation'],nay_rate=round(int(d['nay'])/cast,4),split_votes_cast=d['split_votes_cast'],with_majority=d['with_majority'],
        majority_share=d['majority_share'],dissents=d['dissents'],
        motions=acts['motion to approve']+acts['amendment / version']+acts['motion to deny'],delay_motions=acts['motion to delay'],
        spoke_favor=acts['spoke in favor'],spoke_against=acts['spoke against'],raised_concerns=acts['raised concerns'],
        top_focus=top['topic'] if top else '',top_focus_index=top['focus_index'] if top else '',
        closest=cl['b'],closest_share=cl['share'],farthest=fa['b'],farthest_share=fa['share']))
w('m_profile.csv',prof)
for p in prof: print({k:p[k] for k in ['member','motions','delay_motions','spoke_favor','spoke_against','raised_concerns','top_focus','top_focus_index','closest','farthest']})
