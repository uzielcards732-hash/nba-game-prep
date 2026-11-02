# Deploy button (NBA app)

A GitHub Actions workflow, `.github/workflows/deploy-nba.yml`, that deploys the
NBA Game Prep app without the Mac. It runs only when the owner presses
**Run workflow**. Nothing triggers it automatically, and it never touches the
NFL apps, the Friends app, or the shared key library.

## What it does

| Mode | Cost | What happens |
|---|---|---|
| `check` | free | Runs every offline suite, confirms the shared library pin is still NBA only (version 2, never NFL's version 1), then confirms the live code (HEAD and the web app version) matches the commit that version was deployed from. Never touches the live app. |
| `deploy` | free (no Odds API calls) | Everything in `check`, then `clasp push`, a new version, and the web app moved to it. Then it pulls the live code again to confirm a byte match and tags the commit `nba-v<N>`. |
| `rollback` | free | Pushes the source of tag `nba-v<N>` and points the web app back at version N. Works even when the live code is already wrong. |

The job stops before changing anything when:
* the tests fail
* the manifest would pin shared library version 1 or development mode
* "deploy now" was not typed
* either secret is missing
* the live code does not match its recorded commit

There is no clock window: the NBA app has no scheduled trigger. The one timing
rule is not to deploy while a load is running, because its background step
runs whatever code is live.

The run summary always says which of these happened:
* "Stopped before anything changed"
* "The app change worked and was verified. Only a bookkeeping step failed."
* "Something stopped partway". In this case, run `rollback` to the version it names.

## One time setup (Mac, Claude Desktop app, Code tab, Local)

Two secrets: the same Google sign in clasp already uses on the Mac, and the
NBA Apps Script project ID from the NBA project's local `.clasp.json`. Paste
this into the Desktop app:

```
Set up the GitHub deploy button secrets for uzielcards732-hash/nba-game-prep.
1. Run `gh auth status`. If gh is missing, run `brew install gh`, then `gh auth login` (GitHub.com, HTTPS, browser) and let me finish in the browser.
2. Run exactly: gh secret set CLASPRC_JSON --repo uzielcards732-hash/nba-game-prep < ~/.clasprc.json
   It reads the file directly. Never print, cat, or copy the file's contents anywhere.
3. In my local NBA project folder (the one with .clasp.json for NBA Game Prep, not NFL), run exactly:
   node -e 'process.stdout.write(require("./.clasp.json").scriptId)' | gh secret set NBA_SCRIPT_ID --repo uzielcards732-hash/nba-game-prep
   Confirm first that this .clasp.json belongs to the NBA project, not NFL. Do not print the ID.
4. Run `gh secret list --repo uzielcards732-hash/nba-game-prep` and confirm CLASPRC_JSON and NBA_SCRIPT_ID are listed (names only).
Report only whether each step succeeded.
```

GitHub stores secrets encrypted. Workflow logs mask them, and Claude sessions
cannot read them. Running `clasp logout` on the Mac or revoking access in your
Google account also disables the button. To turn the button off, delete the
secret: `gh secret delete CLASPRC_JSON --repo uzielcards732-hash/nba-game-prep`.

## First run: recording version 13

No version tag exists yet. The first `check` stops and asks which commit
version 13 came from. Rerun `check` with **live_commit** set to
`140074aaafddf4039af20a624c9c7616ef50e982` (the `main` commit that published
the version 13 source). If the live code matches byte for byte, the workflow
records tag `nba-v13` itself and later runs need no input. If it does not
match, nothing is changed and the summary lists which file differs.

## Using it

1. Open github.com/uzielcards732-hash/nba-game-prep in your phone's browser,
   then go to **Actions**, then **Deploy NBA app**, then **Run workflow**.
2. **Use workflow from:** choose the branch Claude names, for example `claude/phase1-reliability`.
3. **Mode:** `check` first. When it is green, run it again with `deploy`, and type `deploy now`.
4. Open the run to read the summary: the version before and after, the build, and the commit.

## Rules that still apply

* The owner approves every deploy. Pressing the button with "deploy now" is that approval.
* Claude starts this workflow only after the owner says "deploy now" in chat, for that specific deploy, and never on its own.
* After a deploy, Claude records it in BUILD_LOG.md.
* A manual `clasp push` from the Mac remains the fallback.
