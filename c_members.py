"""Member course-of-action plans: written recommendations (narrative/c_members_text.csv) plus figures refreshed from the latest minutes."""
import csv
COLS = ['member','full_name','role','rank','stance','record','approach','engage_on','lead_with','cautions','chamber_relationship','participation','majority_share',
        'biz_lead','biz_lead_max','biz_pushback','biz_pushback_max','closest','closest_share','farthest','farthest_share','coalition']
text = list(csv.DictReader(open('narrative/c_members_text.csv')))
b = {r['member']: r for r in csv.DictReader(open('out/b_members.csv'))}
p = {r['member']: r for r in csv.DictReader(open('out/m_profile.csv'))}
out = []
for t in text:
    m = t['member']; r = dict(t)
    for k in ['participation','majority_share','biz_lead','biz_lead_max','biz_pushback','biz_pushback_max','coalition']: r[k] = b[m][k]
    for k in ['closest','closest_share','farthest','farthest_share']: r[k] = p[m][k]
    out.append({k: r[k] for k in COLS})
with open('out/c_members.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(out)
import shutil; shutil.copy('narrative/c_priorities.csv', 'out/c_priorities.csv')
