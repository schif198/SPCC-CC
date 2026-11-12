import json, re, csv
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
import os
P=json.load(open('out/pdf_votes.json')); W=json.load(open('out/votes_web.json')) if os.path.exists('out/votes_web.json') else []
pdf_dates=set(); rows=[]
for f,d in P.items():
    L=open('pdftxt/'+f).read().split('\n')
    meeting='Regular' if d['time']=='3:30 PM' else 'Special'
    pdf_dates.add(d['date'])
    for v in d['votes']:
        it=v['item']
        if it is None and not v['block']:
            for k in range(v['line'],0,-1):
                m=re.match(r'^\s{5,14}((?:RES PH|RES|Ord|RLH \w+|ABZA|APC|PH)\s*[\d-]+)\s{2,}(.*)',L[k])
                if m: it=dict(file=m[1],title=m[2].strip()); break
            if it is None: it=dict(file='Motion',title=v['section'].title()+': '+v['action'])
        file='Consent block: '+v['section'].title() if v['block'] else it['file']
        title=(v['section'].title()+' (block vote)') if v['block'] else re.sub(r'\s+',' ',it['title'])[:110]
        yea,nay=v['yea'],v['nay']; items=v.get('items',1) if v['block'] else 1
        action=v['action'][:90]
        rows.append(dict(date=d['date'],meeting=meeting,file=file,title=title,action=action,items=items,consent_block=v['block'],
            procedural=bool(re.search(r'close|continue|laid over|refer',action,re.I)),yeas=len(yea),nays=len(nay),nay_names=', '.join(nay),
            absent_names=', '.join(m for m in M if m not in yea and m not in nay),unanimous=not nay,
            passed=not re.search(r'fail|denied',action,re.I),source='Minutes PDF (uploaded)',
            **{m:('Y' if m in yea else 'N' if m in nay else 'A') for m in M}))
for r in W:
    if r['date'] not in pdf_dates: r['source']='Legistar minutes (web)'; rows.append(r)
rows.sort(key=lambda r:(r['date'],r['meeting']))
json.dump(rows,open('out/votes.json','w'))
with open('out/votes_2026.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(len(rows),'votes', len({(r['date'],r['meeting']) for r in rows}),'meetings', sum(r['source'].startswith('Minutes') for r in rows),'from PDFs')
