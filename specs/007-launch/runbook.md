# Runbook: roll back production

How to put `https://work.ethayer.design` back on a good release, check it, and move forward again. Covers [FR-651](./spec.md). You need the Netlify dashboard and a terminal, nothing else.

- Netlify project: `ethayer-design`. Deploys list: <https://app.netlify.com/sites/ethayer-design/deploys>
- Netlify's own docs for everything below: <https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/> (sections "Rollbacks" and "Locked deploys", read 2026-11-07, page last updated 2026-09-30).

## What Netlify does (from its docs)

- **A restore is instant and builds nothing.** Netlify republishes an older deploy that it still has. It "doesn't trigger a new deploy".
- **The next push to `main` undoes a restore, unless you lock.** The docs say that with auto publishing on, any new Git-triggered production deploy "will overwrite the previously rolled back version". That includes an `/admin` publish, because it commits to `main`.
- **Locking stops that.** While locked, Netlify still builds every push to `main` but does not publish it. The built deploys wait in the Deploys list until you publish one.
- **Unlocking doesn't say what it publishes.** The docs don't state whether unlocking publishes the deploys built while locked. So this runbook always publishes the deploy you want by hand after unlocking.
- **How far back you can go.** Netlify deletes deploys after 30 days (90 on paid plans). It never deletes the deploy that is live or the latest successful production deploy.
- **Not stated in the docs:** whether publishing an older deploy locks auto publishing on its own, and a Netlify CLI command for a restore. Step 3 below locks by hand, so you don't depend on either.

## 1. Check first

Spend two minutes here before restoring anything.

1. **The monitor alert** (once T610 is done), if one fired: it says when `/` stopped answering.
2. **Netlify:** open the [Deploys list](https://app.netlify.com/sites/ethayer-design/deploys). The top entry marked **Published** is what visitors see. Note its time and commit.
3. **GitHub:** open <https://github.com/ericthayer/ethayer-design-timeline/actions> and find the CI run for that commit. Netlify publishes before CI finishes, so a red run here can mean a bad deploy is already live.
4. **The commit:** on GitHub, open the commit. A subject like `content: update dmns via admin` means it came from `/admin`.

If the site is broken, restore first (sections 2 to 4) and fix the cause afterwards (section 6).

## 2. Find the last good deploy

1. Open the [Deploys list](https://app.netlify.com/sites/ethayer-design/deploys).
2. Below the live deploy, find the newest **Production** deploy of `main` from before the problem began. Skip any marked failed or canceled: only successful deploys can be published.
3. Click it to open its detail page. Click the deploy's own preview link (it has the deploy ID in it, like `https://<id>--ethayer-design.netlify.app`) and check that page looks right.

## 3. Restore it and lock

1. On that deploy's detail page, click **Publish deploy**. Confirm if asked.
2. Go back to the [Deploys list](https://app.netlify.com/sites/ethayer-design/deploys). If it shows **Lock to stop auto publishing**, click it. If it already shows **Unlock to start auto publishing**, it is locked, so leave it.
3. Write down the time. The target from US34 is under five minutes from step 2.1 to here.

While locked, pushes and `/admin` publishes still build, but nothing goes live until section 5.

## 4. Confirm the restore

Run each line in a terminal. Each prints the HTTP status code.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://work.ethayer.design/
```

Expect `200`.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://work.ethayer.design/work/dmns
```

Expect `200`.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://work.ethayer.design/nope
```

Expect `404`.

Then open <https://work.ethayer.design> in a browser and check that the problem is gone. If any check fails, go back to section 2 and pick an older deploy.

## 5. Roll forward again

Do this once `main` has a fix (section 6), or right away if the restore was only a test (T612).

1. Wait until the newest **Production** deploy of `main` in the [Deploys list](https://app.netlify.com/sites/ethayer-design/deploys) has finished building, and its CI run on GitHub Actions is green.
2. In the Deploys list, click **Unlock to start auto publishing**.
3. Click that newest deploy, and on its detail page click **Publish deploy**. Do this even if it already looks published, since the docs don't say what unlocking publishes.
4. Check that the top entry marked **Published** is that deploy, then run the three `curl` lines in section 4 again.

Pushes to `main` publish on their own again from here.

## 6. Fix the cause on `main`

A restore only changes what Netlify serves. `main` still holds the bad change, and the next published deploy will bring it back. Remove it on `main` before section 5.

### A bad commit or merged PR

```bash
git switch main
```

```bash
git pull
```

```bash
git switch -c revert/<short-name>
```

```bash
git revert --no-edit <sha>
```

Replace `<sha>` with the bad commit's ID from GitHub. Then push and open a PR:

```bash
git push -u origin HEAD
```

```bash
gh pr create --fill --base main
```

Merge it once CI is green. Netlify builds it, but doesn't publish it while locked. Then do section 5.

### A bad `/admin` publish

Each `/admin` publish is one commit on `main`, with a subject like `content: update <slug> via admin` and the line `Published-With: admin editor`. To list them:

```bash
git log --oneline --grep='Published-With: admin editor' -10
```

Revert that commit the same way as above. Or open `/admin`, correct the project, and publish again. While locked, that publish builds but doesn't go live until section 5.

## Records

T612 runs this runbook once for real. Record the date, the time to restore, and any step that was wrong here, and fix the step in this file.
