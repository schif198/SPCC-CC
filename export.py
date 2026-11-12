import json, csv
A=json.load(open('out/analysis.json')); M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
def w(name,rows):
    with open(f'out/{name}','w',newline='') as f:
        d=csv.DictWriter(f,fieldnames=list(rows[0])); d.writeheader(); d.writerows(rows)
t=A['totals']
w('totals.csv',[dict(meetings=t['meetings'],votes=t['votes'],items=t['items'],unanimous=t['unanimous'],contested=t['contested'],failed=t['failed'],unanimous_share=round(t['unanimous']/t['votes'],4),first_meeting=t['first'],last_meeting=t['last'])])
w('members.csv',[dict(member=m,yea=d['yea'],nay=d['nay'],absent=d['absent'],participation=round(1-d['absent']/d['total'],4),split_votes_cast=d['contested_voted'],with_majority=d['with_majority'],majority_share=round(d['with_majority']/d['contested_voted'],4),dissents=len(d['dissents'])) for m,d in A['members'].items()])
w('monthly.csv',[dict(month=mo,meetings=d['meetings'],votes=d['votes'],items=d['items'],contested=d['contested'],votes_with_absence=d['with_absence'],failed=d['failed']) for mo,d in A['monthly'].items()])
w('member_monthly.csv',[dict(month=mo,member=m,votes=v['n'],absent=v['a'],nay=v['nay'],participation=round(1-v['a']/v['n'],4)) for m,d in A['members'].items() for mo,v in d['monthly'].items()])
w('contested.csv',[dict(date=c['date'],file=c['file'],title=c['title'],action=c['action'],tally=c['tally'],yea=', '.join(c['yea']),nay=', '.join(c['nay']),absent=', '.join(c['absent'])) for c in A['contested']])
rows=[]
for a in M:
  for b in M:
    if a==b: rows.append(dict(a=a,b=b,n='',agree='',share='')); continue
    k=f"{a}|{b}" if f"{a}|{b}" in A['agreement'] else f"{b}|{a}"; v=A['agreement'][k]
    rows.append(dict(a=a,b=b,n=v['n'],agree=v['agree'],share=round(v['agree']/v['n'],4)))
w('agreement.csv',rows)
