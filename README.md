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

## Adding new minutes (every week): right on the website

1. Download the new minutes PDF from the city’s Legistar page. The site has a **Council minutes on Legistar** link at the top of every page.
2. On the site, open the **Minutes library** and click **Upload new minutes**.
3. Drag the PDF into the box, or click **choose files**. Before anything is sent, the site reads the file and shows one of these:
   - **Ready**: the meeting it found, such as "Wednesday, November 4, 2026 · 3:30 PM · 8 pages".
   - **Already added**: that meeting is already in the library.
   - **Can’t use**: not a City Council minutes PDF.
4. Paste the **upload key** (only needed the first time on each computer or phone). Click **Publish**.
5. A progress checklist shows: **Send the files → Add to the minutes library → Rebuild the dashboards → Live on the site**. It takes about 3 minutes. You can close the window, and the update keeps going. The library page also shows a notice while an update is running.

### The upload key (one-time setup by the site owner)

The upload key is what lets the website save files to the site. Without it, nobody can add or change anything. To create one:

1. While signed in to GitHub, open <https://github.com/settings/personal-access-tokens/new>.
2. **Token name:** "Minutes upload". **Expiration:** up to one year. Put a reminder in your calendar to make a new key before it expires.
3. **Repository access:** choose **Only select repositories**, then pick this repository (for example SPCC-CC).
4. **Permissions → Repository permissions:**
   - **Contents:** Read and write
   - **Actions:** Read-only (this lets the website show progress)
5. Click **Generate token**. Copy the key; it starts with `github_pat_`.

Share the key only with people who should add minutes. Anyone with it can change files in this repository, so treat it like a password. The key is stored only in the browser of the computer where it was entered, and only if **Remember on this device** is checked. To revoke it, delete the token on the same GitHub page; then create a new one.

If you prefer, uploading through GitHub still works: in the upload window, use **Prefer GitHub? Upload there instead**.

## If an update fails (red X in the Actions tab)

Click the failed run, then the red step, to see the message.

- **"Site files not found"** or **"exit code 2"**: GitHub can't find the site's files. Open the repository's main page. You should see the folders `minutes`, `narrative`, `pipeline` and `web`, either at the top level or inside one folder such as `stpaul-council-site`. If any of them are missing, upload them from the package (**Add file → Upload files**), keeping their subfolders.
- **"Missing file"**: one subfolder didn't upload, often `web/vendor`. Upload it again.
- **Deploy step fails with "Get Pages site failed" or a 404**: go to **Settings → Pages** and set **Source** to **GitHub Actions**. Then use **Actions → Update site → Run workflow**.
- **The upload window says the key wasn’t accepted**: the key is mistyped, expired or revoked. Create a new one (see above).
- **The upload window says the key can’t see this repository, or doesn’t allow saving**: recreate the key, choosing this repository and setting **Contents: Read and write**.
- **"Step ... failed" while reading minutes**: a PDF couldn't be read as City Council minutes. Remove the most recent upload from the `minutes` folder, then send me the file and the message.

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
