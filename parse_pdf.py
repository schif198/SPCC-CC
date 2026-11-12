import re, sys, json, glob, os
M=["Noecker","Yang","Kim","Bowie","Jost","Johnson","Coleman"]
MON={m:i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}
def names(s): return [m for m in M if re.search(r'\b'+m+r'\b',s)]
def parse(path):
    L=open(path).read().split('\n')
    L=[x.replace('\f','') for x in L]
    L=['' if (re.match(r'^City of Saint Paul\s+Page \d+',x) or re.match(r'^City Council\s+Meeting Minutes',x)) else x for x in L]
    date=None;time=None
    for l in L[:40]:
        m=re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December) (\d+), (\d{4})\s+(\d+:\d+ [AP]M)',l)
        if m: date=f"{m[3]}-{MON[m[1]]:02d}-{int(m[2]):02d}"; time=m[4]; break
    section='';item=None;sec_items={};votes=[];present=list(M);pending=[]
    i=0
    while i<len(L):
        l=L[i]
        if re.match(r'^\s{5,14}[A-Z][A-Z0-9 &/,\'()\-]{5,}$',l) and 'Councilmember' not in l and 'ROLL CALL' not in l:
            section=l.strip(); item=None; sec_items.setdefault(section,0)
        m=re.match(r'^(\d+)\s{2,}((?:RES PH|RES|Ord|RLH \w+|ABZA|APC|AO|PH|SR|ABZ|Min)\s*[\d-]*)\s{2,}(.*)',l)
        if m:
            item=dict(no=int(m[1]),file=m[2].strip(),title=m[3].strip()); sec_items[section]=sec_items.get(section,0)+1
            # grab next line of title
            if i+1<len(L) and L[i+1].strip() and not re.search(r'Yea:|moved|Adopted',L[i+1]): item['title']+=' '+L[i+1].strip()
        if re.search(r'\bPresent\s+\d+\s*-',l):
            blk=l; j=i+1
            while j<len(L) and L[j].strip() and not re.search(r'Absent|Excused',L[j]): blk+=L[j]; j+=1
            present=names(blk)
        mf=re.search(r'failed (\d+)\s*-\s*(\d+)\s*\(Those opposed being (?:Councilmembers? )?([^)]*)\)',l+' '+(L[i+1] if i+1<len(L) else ''),re.I)
        if mf and 'Yea:' not in l:
            opp=[m for m in M if m in mf[3]]
            pre=l.strip()
            votes.append(dict(section=section,item=item,action='Failed ('+pre[:60]+')',yea=[p for p in present if p not in opp],nay=opp,abstain=[],block=False,narrative=True,line=i))
        if re.match(r'^\s+Yea:',l):
            k=i-1
            while k>0 and not L[k].strip(): k-=1
            action=L[k].strip()
            groups={'Yea':'','Nay':'','Abstain':'','Absent':'','Excused':''};cur=None;j=i
            while j<len(L):
                s=L[j]
                mm=re.match(r'^\s+(Yea|Nay|Abstain|Absent|Excused):\s*(.*)',s)
                if mm: cur=mm[1]; groups[cur]+=' '+mm[2]
                elif s.strip()=='' :
                    nxt=next((x for x in L[j+1:j+10] if x.strip()),'')
                    if not re.match(r'^\s+(Yea|Nay|Abstain|Absent|Excused):',nxt): break
                elif cur and re.match(r'^\s{20,}\S',s) and any(m in s for m in M): groups[cur]+=' '+s
                else: break
                j+=1
            block = item is None and 'CONSENT' in section.upper()
            votes.append(dict(section=section,item=None if block else item,action=action,yea=names(groups['Yea']),nay=names(groups['Nay']) if groups['Nay'].strip() not in ('0','') else [],
                abstain=names(groups['Abstain']) if groups['Abstain'].strip() not in ('0','') else [],block=block,line=i,
                ycount=int(re.match(r'\s*(\d+)',groups['Yea'])[1]) if re.match(r'\s*(\d+)',groups['Yea']) else None))
            i=j; continue
        i+=1
    for v in votes:
        if v['block']:
            pulled={x['item']['no'] for x in votes if x['section']==v['section'] and x['item']}
            v['items']=sec_items.get(v['section'],0)-len(pulled)
    return date,time,votes
if __name__=='__main__':
    out={}
    for f in sorted(glob.glob('pdftxt/*.txt')):
        d,t,v=parse(f); out[os.path.basename(f)]=dict(date=d,time=t,votes=v)
        bad=[x for x in v if x.get('ycount') is not None and x['ycount']!=len(x['yea'])]
        print(os.path.basename(f),d,t,len(v),'blocks',[(x['section'][:25],x['items']) for x in v if x['block']],'BADCOUNT',len(bad))
    json.dump(out,open('out/pdf_votes.json','w'),indent=1,default=str)
