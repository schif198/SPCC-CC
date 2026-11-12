# St. Paul City Council 2026: dashboards and minutes library

This repository builds a public website with:

- **Minutes library**: every City Council meeting's minutes, with the original PDF, searchable by item, file number or date, and an **Upload new minutes** button.
- **Four dashboards**: Voting trends, Member by member, the Chamber lobbying playbook and the Chamber course of action. Each has a **Print one-pager** button.
- A **Council minutes on Legistar** link at the top of every page.

When a new minutes PDF is added to the `minutes` folder, GitHub re-reads every set of minutes, recalculates all of the figures and republishes the site. This takes about 3 minutes and needs no other steps.

---

## One-time setup (about 15 minutes, on a computer)

1. **Create a free GitHub account** at <https://github.com/signup>. You can skip this if you already have one.
2. **Create a repository.** Click **+** (top right), then **New repository**.
   - Name it, for example, `stpaul-council`.
   - Choose **Public**. Free GitHub accounts can publish websites only from public repositories, so everything in it, including the Chamber course of action, will be publicly visible. Use a paid plan with a private repository if that's a concern.
   - Click **Create repository**.
3. **Upload the files.**
   - On the new repository's page, click **uploading an existing file**.
   - Unzip the package. Open the `stpaul-council-site` folder and drag everything inside it onto the page: the `minutes`, `pipeline`, `web` and `narrative` folders, plus `README.md`.
   - Click **Commit changes**.
4. **Add the automatic update.** Your computer may hide the `.github` folder, so create its file by hand:
   - Click **Add file**, then **Create new file**.
   - Name it exactly `.github/workflows/update-site.yml`.
   - Open `SETUP-update-site.yml` from the package in any text editor. Copy all of it and paste it into the editor.
   - Click **Commit changes**.
   - If a `.github` folder was already uploaded in step 3, skip this step.
5. **Turn on the website.** Go to **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
6. **Run the first build.**
   - Go to the **Actions** tab and click **Update site** on the left.
   - Click **Run workflow**, then **Run workflow** again.
   - After about 3 minutes, a green check appears. Your site is now live at `https://YOUR-USER-NAME.github.io/REPOSITORY-NAME/`. The address is also shown on the **Settings → Pages** screen.

Share that address with anyone. It works on phones and computers, and no login is needed.

## Adding new minutes (every week)

1. Open the site's **Minutes library** and click **Upload new minutes**.
2. Click **Open the upload page**, and sign in to GitHub if asked.
3. Drag in the new minutes PDF from Legistar and click **Commit changes**.
4. Wait about 3 minutes. Every dashboard, one-pager and the library update.

Notes:
- Only City Council meeting-minutes PDFs are used. Other PDFs, and copies of minutes already in the library, are skipped automatically.
- To watch an update, or to see why one failed, open the **Actions** tab. A red X means the build stopped, and the site keeps showing the last good version.
- Uploading from a phone may not work well, so use a computer if you can.

## What updates automatically, and what doesn't

These update automatically:
- vote counts, participation, split votes, agreement between members;
- topic and issue breakdowns, the PERSIA lenses;
- the next-meeting watch list, ordinance timing;
- the topic search, the library;
- all dates on the pages and one-pagers.

These are written text and stay as written until you edit them:
- **Member recommendations** (stance, approach, what to lead with, cautions), in `narrative/c_members_text.csv`. The figures beside them do refresh.
- **Chamber priorities** and their status, in `narrative/c_priorities.csv`.
- **Short descriptions of the 2026 split votes**, in `pipeline/build_members.py`. New split votes get an automatic description built from the minutes.

To edit a narrative file, open it on GitHub, click the pencil icon, change the text and commit. The site rebuilds itself.

**Limits:**
- The analysis is set up for the 2026 council: the seven current members and a 2026 calendar. If the council's membership changes, or a new year starts, the pipeline needs a small update.
- Per-meeting links on Legistar aren't available, so each meeting's "City's Legistar page" button opens the City Council page on Legistar. There, every meeting's official agenda and minutes are listed. The library's own PDF copy always opens directly.

## For maintainers

- `python3 pipeline/run.py` reads `minutes/*.pdf` and writes `build/out/`. It needs `pdftotext` and `pdfinfo` from poppler-utils.
- `python3 pipeline/build_site.py` writes the static site to `_site/`.
- `web/` holds the page sources, the shared navigation and theme, the one-pager code (`print.js`) and a vendored copy of d3 v7.
