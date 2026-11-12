import json, csv, collections, statistics, re
exec(open('scripts/biz.py').read().split('# pending items')[0])
T=json.load(open('out/biz_tmp.json'))
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
FULL={'Noecker':('Rebecca Noecker','Council President'),'Yang':('Nelsie Yang','Vice President'),'Kim':('HwaJeong Kim','Councilmember'),'Bowie':('Anika Bowie','Councilmember'),'Jost':('Saura Jost','Councilmember'),'Johnson':('Cheniqua Johnson','Councilmember'),'Coleman':('Molly Coleman','Councilmember')}
ISS=[n for n,_ in BIZ]
LEAD={'motion to approve','amendment / version','motion to deny','spoke in favor','spoke against','raised concerns'}
PUSH={'spoke against','raised concerns','motion to delay','motion to deny'}
ba=[a for a in A if a['biz']]
prof={r['member']:r for r in csv.DictReader(open('out/m_profile.csv'))}
def w(n,rows,fields=None):
    with open('out/'+n,'w',newline='') as f: d=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else fields); d.writeheader(); d.writerows(rows)
# issue x member
im=[]
for m in M:
    for i in ISS:
        x=[a for a in ba if a['member']==m and a['biz']==i]
        im.append(dict(member=m,issue=i,lead=sum(a['action'] in LEAD for a in x),motions=sum(a['action'] in ('motion to approve','amendment / version','motion to deny') for a in x),
            spoke_for=sum(a['action']=='spoke in favor' for a in x),pushback=sum(a['action'] in PUSH for a in x)))
w('b_issue_member.csv',im)
# issues
bv=[v for v in V if v['biz']]
iss=[]
for i in ISS:
    vs=[v for v in bv if v['biz']==i]; rows=[r for r in im if r['issue']==i]
    ch=sorted(rows,key=lambda r:-r['lead'])
    iss.append(dict(issue=i,votes=len(vs),unanimous_share=round(sum(not v['nays'] for v in vs)/len(vs),4) if vs else '',splits=sum(bool(v['yeas'] and v['nays']) for v in vs),
        lead_actions=sum(r['lead'] for r in rows),champion_1=ch[0]['member'] if ch[0]['lead'] else '—',champion_1_n=ch[0]['lead'],champion_2=ch[1]['member'] if ch[1]['lead'] else '—',champion_2_n=ch[1]['lead']))
w('b_issues.csv',iss)
# members
splits_biz=[v for v in bv if v['yeas'] and v['nays']]
bm=[]
for m in M:
    x=[a for a in ba if a['member']==m]
    rows=[r for r in im if r['member']==m]; top=sorted(rows,key=lambda r:-r['lead'])
    cast=[v for v in splits_biz if v[m]!='A']; maj=lambda v:'Y' if v['yeas']>v['nays'] else 'N'
    p=prof[m]; ms=float(p['majority_share'])
    bm.append(dict(member=m,full_name=FULL[m][0],role=FULL[m][1],participation=p['participation'],majority_share=p['majority_share'],
        coalition=('Usually in the majority' if ms>=0.8 else 'Often in the minority'),
        biz_lead=sum(r['lead'] for r in rows),biz_motions=sum(r['motions'] for r in rows),biz_spoke_for=sum(r['spoke_for'] for r in rows),biz_pushback=sum(r['pushback'] for r in rows),
        biz_splits_cast=len(cast),biz_splits_with_majority=sum(v[m]==maj(v) for v in cast),
        top_issue_1=top[0]['issue'] if top[0]['lead'] else '—',top_issue_2=top[1]['issue'] if top[1]['lead'] else '—',closest=p['closest'],farthest=p['farthest']))
mx=max(r['biz_lead'] for r in bm); px=max(r['biz_pushback'] for r in bm) or 1
for r in bm: r['biz_lead_max']=mx; r['biz_pushback_max']=px
w('b_members.csv',bm)
# split votes (business) per member
sp=[r for r in csv.DictReader(open('out/m_splits.csv')) if any(r['date']==v['date'] and r['file']==v['file'] for v in splits_biz)]
iss_of={(v['date'],v['file']):v['biz'] for v in splits_biz}
w('b_splits.csv',[dict(member=r['member'],date=r['date'],file=r['file'],question=r['issue'],issue=iss_of[(r['date'],r['file'])],vote=r['vote'],tally=r['tally'],outcome=r['outcome'],with_majority=r['with_majority']) for r in sp])
# watch list
wl=[]
for p in T['pend']:
    d0,f,nd,t,b=p[:5]; stg=p[5] if len(p)>5 else 'Pending'
    if not b: continue
    lastv=[v for v in V if v['file']==f]; lv=lastv[-1] if lastv else None
    wl.append(dict(file=f,item=t,issue=b,next_meeting=nd,stage=stg,last_action_date=d0,last_tally=(f"{lv['yeas']}-{lv['nays']}" if lv else 'no roll call yet'),
        movers=', '.join(sorted({a['member'] for a in A if a['file']==f and a['action'] in LEAD})) or 'none recorded'))
w('b_watch.csv',wl,['file','item','issue','next_meeting','stage','last_action_date','last_tally','movers'])
# ordinance clock
w('b_ordinances.csv',T['ordc'])
# delays
w('b_delays.csv',[{k:d[k] for k in ['date','member','file','title','biz','outcome','final_date']} for d in T['dd']])
# kpis
oc=T['ordc']; dd=T['dd']; back=[d for d in dd if d['outcome'] in ('Adopted','Failed or denied')]
win=[v['yeas'] for v in V if v['yeas'] and v['nays'] and v['passed']]
w('b_kpis.csv',[dict(biz_votes=len(bv),biz_unanimous_share=round(sum(not v['nays'] for v in bv)/len(bv),4),biz_splits=len(splits_biz),
    ord_count=len(oc),ord_median_days=statistics.median([o['days'] for o in oc]),ord_amended_share=round(sum(o['changed']=='Yes' for o in oc)/len(oc),4),
    delays=len(dd),delays_returned=len(back),delays_adopted=sum(d['outcome']=='Adopted' for d in back),delays_adopted_share=round(sum(d['outcome']=='Adopted' for d in back)/len(back),4) if back else '',
    min_winning_yeas=min(win),seats=7,next_meeting=min((r['next_meeting'] for r in wl),default=''),watch_items=len(wl))])
# business action log
w('b_log.csv',[dict(id=i+1,date=a['date'],member=a['member'],issue=a['biz'],action=a['action'],file=a['file'],item=a['title'][:110],minutes_text=a['text']) for i,a in enumerate(sorted(ba,key=lambda a:a['date'])) if a['action']!='procedural motion'])
for n in ['b_members','b_issues','b_watch','b_kpis']:
    print(open('out/'+n+'.csv').read()[:1500]); print('---')
