"""Rebuild every dataset from the minutes PDFs in minutes/.

Usage (from the repository root):  python3 pipeline/run.py
Needs pdftotext and pdfinfo (poppler-utils). Writes build/out/*.csv and build/out/meetings.json.
"""
import glob, hashlib, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
STEPS = ['parse_pdf', 'merge', 'analyze', 'export', 'actions', 'build_members', 'build_periods', 'biz', 'biz_build', 'persia', 'coa', 'c_members']
MON = {m: i for i, m in enumerate(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], 1)}


def log(*a):
    print('[pipeline]', *a, flush=True)


def main():
    shutil.rmtree(BUILD, ignore_errors=True)
    for d in ('pdftxt', 'out', 'scripts', 'narrative'):
        os.makedirs(os.path.join(BUILD, d))
    for f in glob.glob(os.path.join(ROOT, 'pipeline', '*.py')):
        shutil.copy(f, os.path.join(BUILD, 'scripts'))
    for f in glob.glob(os.path.join(ROOT, 'narrative', '*')):
        shutil.copy(f, os.path.join(BUILD, 'narrative'))

    meetings, seen, skipped = [], {}, []
    for pdf in sorted(glob.glob(os.path.join(ROOT, 'minutes', '*.pdf')) + glob.glob(os.path.join(ROOT, 'minutes', '*.PDF'))):
        name = os.path.basename(pdf)
        stem = re.sub(r'[^A-Za-z0-9_.-]+', '_', os.path.splitext(name)[0])
        txt = os.path.join(BUILD, 'pdftxt', stem + '.txt')
        r = subprocess.run(['pdftotext', '-layout', pdf, txt], capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(txt):
            skipped.append((name, 'could not read the PDF')); continue
        text = open(txt, errors='replace').read()
        head = text[:4000]
        if not (re.search(r'Meeting Minutes', head) and re.search(r'City Council', head)):
            os.remove(txt); skipped.append((name, 'not City Council meeting minutes')); continue
        h = hashlib.sha256(re.sub(r'\s+', ' ', text).encode()).hexdigest()
        if h in seen:
            os.remove(txt); skipped.append((name, f'duplicate of {seen[h]}')); continue
        seen[h] = name
        m = re.search(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) (\d+), (\d{4})\s+(\d+:\d+ [AP]M)', head)
        if not m:
            os.remove(txt); skipped.append((name, 'no meeting date found')); continue
        pages = re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout)
        absent = re.search(r'Absent\s+\d+\s*-\s*([^\n]+(?:\n\s{20,}[^\n]+)*)', text)
        meetings.append(dict(file=name, txt=stem + '.txt', date=f'{m[4]}-{MON[m[2]]:02d}-{int(m[3]):02d}', weekday=m[1], time=m[5],
                             kind='Regular meeting' if m[5] == '3:30 PM' else 'Special or additional meeting',
                             pages=int(pages[1]) if pages else None, size_kb=round(os.path.getsize(pdf) / 1024),
                             absent=', '.join(re.findall(r'Councilmember (?:\w+ )?(\w+)', absent[1])) if absent else ''))
    if not meetings:
        sys.exit('No City Council minutes PDFs found in minutes/.')
    for s in skipped:
        log('skipped', s[0], '-', s[1])
    log(len(meetings), 'minutes PDFs read')

    os.chdir(BUILD)
    for step in STEPS:
        log('running', step)
        r = subprocess.run([sys.executable, os.path.join('scripts', step + '.py')], capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-3000:]); print(r.stderr[-3000:])
            sys.exit(f'Step {step} failed.')

    # per-meeting figures for the library
    pv = json.load(open('out/pdf_votes.json'))
    sys.path.insert(0, 'scripts')
    src = open('scripts/actions.py').read().split('rows=[]')[0]
    ns = {}; exec(src, ns)
    for mt in meetings:
        v = pv.get(mt['txt'], {}).get('votes', [])
        mt['votes'] = len(v)
        mt['splits'] = sum(1 for x in v if x['yea'] and x['nay'])
        its = ns['items'](os.path.join('pdftxt', mt['txt']))
        seen_f, lst = set(), []
        for it in its:
            if it['file'] in seen_f: continue
            seen_f.add(it['file']); lst.append([it['file'], re.sub(r'\s+', ' ', it['title'])[:160]])
        mt['item_count'] = len(lst)
        mt['items'] = lst
    meetings.sort(key=lambda x: (x['date'], x['time']), reverse=True)
    json.dump(dict(meetings=meetings, skipped=skipped), open('out/meetings.json', 'w'), indent=0)
    log('done:', meetings[-1]['date'], 'to', meetings[0]['date'])


if __name__ == '__main__':
    main()
