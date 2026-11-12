import json, collections, itertools
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
R=json.load(open('out/votes.json'))
for r in R: r['contested']=r['yeas']>0 and r['nays']>0; r['month']=r['date'][:7]
out={}
# per member
mem={}
for m in M:
    v=[r[m] for r in R]
    cont=[r for r in R if r['contested']]
    maj=lambda r:'Y' if r['yeas']>r['nays'] else 'N'
    cv=[r for r in cont if r[m]!='A']
    mem[m]=dict(total=len(R),yea=v.count('Y'),nay=v.count('N'),absent=v.count('A'),
        participation=round(100*(1-v.count('A')/len(R)),1),
        contested_voted=len(cv),with_majority=sum(r[m]==maj(r) for r in cv),
        dissents=[dict(date=r['date'],file=r['file'],title=r['title'],vote=r[m],result=f"{r['yeas']}-{r['nays']}") for r in cont if r[m]!='A' and r[m]!=maj(r)],
        monthly={})
    for mo in sorted({r['month'] for r in R}):
        rs=[r for r in R if r['month']==mo]
        mem[m]['monthly'][mo]=dict(n=len(rs),y=sum(r[m]=='Y' for r in rs),nay=sum(r[m]=='N' for r in rs),a=sum(r[m]=='A' for r in rs))
out['members']=mem
# agreement on contested votes
agree={}
cont=[r for r in R if r['contested']]
for a,b in itertools.combinations(M,2):
    both=[r for r in cont if r[a]!='A' and r[b]!='A']
    agree[f"{a}|{b}"]=dict(n=len(both),agree=sum(r[a]==r[b] for r in both))
out['agreement']=agree
# council monthly
mon={}
for mo in sorted({r['month'] for r in R}):
    rs=[r for r in R if r['month']==mo]
    mon[mo]=dict(meetings=len({(r['date'],r['meeting']) for r in rs}),votes=len(rs),items=sum(r['items'] for r in rs),
        contested=sum(r['contested'] for r in rs),unanimous_fullroll=sum(r['nays']==0 and r['yeas']==7 for r in rs),
        with_absence=sum(r['yeas']+r['nays']<7 for r in rs),failed=sum(not r['passed'] for r in rs))
out['monthly']=mon
out['contested']=[dict(date=r['date'],file=r['file'],title=r['title'],action=r['action'],tally=f"{r['yeas']}-{r['nays']}",
    yea=[m for m in M if r[m]=='Y'],nay=[m for m in M if r[m]=='N'],absent=[m for m in M if r[m]=='A']) for r in cont]
out['totals']=dict(votes=len(R),items=sum(r['items'] for r in R),meetings=len({(r['date'],r['meeting']) for r in R}),
    contested=len(cont),unanimous=len(R)-len(cont),failed=sum(not r['passed'] for r in R),
    consent_blocks=sum(r['consent_block'] for r in R),consent_items=sum(r['items'] for r in R if r['consent_block']),
    first=min(r['date'] for r in R),last=max(r['date'] for r in R))
json.dump(out,open('out/analysis.json','w'),indent=1)
print(json.dumps(out['totals'],indent=1))
for m in M: d=mem[m]; print(m,d['yea'],d['nay'],d['absent'],d['participation'],f"{d['with_majority']}/{d['contested_voted']}",len(d['dissents']))
for mo,d in mon.items(): print(mo,d)
for k,v in sorted(agree.items(),key=lambda x:x[1]['agree']/max(1,x[1]['n'])): print(k,v)
