import json, csv, glob, collections, itertools
exec(open('scripts/actions.py').read().split('rows=[]')[0])
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
FULL={'Noecker':('Rebecca Noecker','Council President'),'Yang':('Nelsie Yang','Vice President'),'Kim':('HwaJeong Kim','Councilmember'),
      'Bowie':('Anika Bowie','Councilmember'),'Jost':('Saura Jost','Councilmember'),'Johnson':('Cheniqua Johnson','Councilmember'),'Coleman':('Molly Coleman','Councilmember')}
full={}
for f in sorted(glob.glob('pdftxt/*.txt')):
    for it in items(f): full[(it['date'],it['file'])]=it['title']
V=json.load(open('out/votes.json')); A=json.load(open('out/actions.json'))
for v in V: v['topic']=topic(v['file'], full.get((v['date'],v['file']), v['title'])); v['month']=v['date'][:7]
for a in A: a['month']=a['date'][:7]
months=sorted({v['month'] for v in V})
LEAD={'motion to approve','amendment / version','motion to deny','spoke in favor','spoke against','raised concerns'}
topics=sorted({v['topic'] for v in V})
P,PT,PF,PA,PC=[],[],[],[],[]
for i,j in itertools.combinations_with_replacement(range(len(months)),2):
    fr,to=months[i],months[j]
    vs=[v for v in V if fr<=v['month']<=to]; acts=[a for a in A if fr<=a['month']<=to]
    splits=[v for v in vs if v['yeas'] and v['nays']]
    PC.append(dict(**{'from':fr,'to':to},meetings=len({(v['date'],v['meeting']) for v in vs}),votes=len(vs),items=sum(v['items'] for v in vs),
        unanimous_share=round(sum(not v['nays'] for v in vs)/len(vs),4),splits=len(splits),failed=sum(not v['passed'] for v in vs)))
    lead=[a for a in acts if a['action'] in LEAD]; council=collections.Counter(a['topic'] for a in lead); ctot=sum(council.values()) or 1
    agree={}
    for a,b in itertools.permutations(M,2):
        both=[v for v in splits if v[a]!='A' and v[b]!='A']; n=len(both); ag=sum(v[a]==v[b] for v in both)
        agree[(a,b)]=(n,ag)
        if a<b or True: pass
    for a,b in itertools.combinations(M,2):
        n,ag=agree[(a,b)]; PA.append(dict(**{'from':fr,'to':to},a=a,b=b,n=n,agree=ag,share=round(ag/n,4) if n else ''))
    for m in M:
        y=sum(v[m]=='Y' for v in vs); nn=sum(v[m]=='N' for v in vs); ab=sum(v[m]=='A' for v in vs)
        cast=[v for v in splits if v[m]!='A']; maj=lambda v:'Y' if v['yeas']>v['nays'] else 'N'
        wm=sum(v[m]==maj(v) for v in cast)
        ma=collections.Counter(a['action'] for a in acts if a['member']==m)
        mc=collections.Counter(a['topic'] for a in lead if a['member']==m); mt=sum(mc.values())
        foc=[]
        for t in sorted(council):
            ms=mc[t]/mt if mt else 0; cs=council[t]/ctot
            fi=round(ms/cs,3) if cs else 0
            foc.append((t,mc[t],fi)); PF.append(dict(**{'from':fr,'to':to},member=m,topic=t,lead_actions=mc[t],member_share=round(ms,4),council_share=round(cs,4),focus_index=fi))
        cand=[x for x in foc if x[1]>=2 and x[0]!='Other']
        top=max(cand,key=lambda x:x[2])[0] if cand else '—'
        pr=[(b,)+agree[(m,b)] for b in M if b!=m and agree[(m,b)][0]>0]
        cl=max(pr,key=lambda r:r[2]/r[1]) if pr else None; fa=min(pr,key=lambda r:r[2]/r[1]) if pr else None
        pushback=ma['spoke against']+ma['raised concerns']+ma['motion to delay']+ma['motion to deny']
        P.append(dict(**{'from':fr,'to':to},member=m,full_name=FULL[m][0],role=FULL[m][1],votes=len(vs),yea=y,nay=nn,absent=ab,
            participation=round((y+nn)/len(vs),4),yea_share=round(y/len(vs),4),nay_share=round(nn/len(vs),4),absent_share=round(ab/len(vs),4),
            split_votes_cast=len(cast),with_majority=wm,majority_share=round(wm/len(cast),4) if cast else '',dissents=len(cast)-wm,
            motions=ma['motion to approve']+ma['amendment / version']+ma['motion to deny'],delay_motions=ma['motion to delay'],
            spoke_favor=ma['spoke in favor'],spoke_against=ma['spoke against'],raised_concerns=ma['raised concerns'],pushback=pushback,
            top_focus=top,closest=cl[0] if cl else '—',closest_share=round(cl[2]/cl[1],4) if cl else '',farthest=fa[0] if fa else '—',farthest_share=round(fa[2]/fa[1],4) if fa else ''))
        for t in topics:
            tv=[v for v in vs if v['topic']==t]
            if tv: PT.append(dict(**{'from':fr,'to':to},member=m,topic=t,yea=sum(v[m]=='Y' for v in tv),nay=sum(v[m]=='N' for v in tv),absent=sum(v[m]=='A' for v in tv),votes=len(tv)))
# maxima per range for meter scales live in data
mx={}
for r in P: k=(r['from'],r['to']); mx[k]=(max(mx.get(k,(0,0))[0],r['motions']),max(mx.get(k,(0,0))[1],r['pushback']))
for r in P: r['motions_max']=mx[(r['from'],r['to'])][0]; r['pushback_max']=mx[(r['from'],r['to'])][1]
def w(name,rows):
    with open('out/'+name,'w',newline='') as fh:
        d=csv.DictWriter(fh,fieldnames=list(rows[0])); d.writeheader(); d.writerows(rows)
w('p_member.csv',P); w('p_topic.csv',PT); w('p_focus.csv',PF); w('p_agree.csv',PA); w('p_council.csv',PC)
w('p_months.csv',[dict(month=m,label=m) for m in months])
import os
for n in ['p_member','p_topic','p_focus','p_agree','p_council']: print(n, os.path.getsize(f'out/{n}.csv'))
full_year=[r for r in P if r['from']==months[0] and r['to']==months[-1]]
for r in full_year: print(r['member'],r['participation'],r['majority_share'],r['motions'],r['pushback'],r['top_focus'],r['closest'],r['farthest'])
