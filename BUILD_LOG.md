# NBA Game Prep build log

## Current state

**Phase 1 reliability, speed, deploy button (2026-11-02, cloud session,
branch `claude/phase1-reliability`, build `2026.11.02-nba-reliability.1`,
pushed to GitHub 2026-11-02 on owner OK, NOT DEPLOYED; live stays version 13):**

- Paid request fixes ported from NFL F1 to F8. F1: a failed shared ledger
  write after a paid response no longer throws the response away; it is saved,
  committed, and the ledger write is retried under the same reservation ID
  (the library replays SETTLED rows, so never two charges). F2: settlement
  sweep at every worker start and before the receipt; the receipt lists
  anything still pending. F3: saved response pointers `NBA_LAST_RAW_<kind>_<event>`
  let a later plan reuse a paid response within 90 minutes of capture (same
  event, markets, bookmaker; force refresh ignores it). F4: started games are
  excluded from the plan at 0 credits; an all started confirm is refused. F5:
  "Export saved, but no game is eligible for analysis" result text. F6: safe
  error categories (service, step, error class; never native text). F7: one
  bad load step is marked FAILED and the run continues to a PARTIAL export.
  F8: `nbaOperationRecordsPruneDryRun()` lists old records, never deletes.
- Safe LOG writes: `log_` never fails a load (count marker
  `NBA_LOG_WRITE_FAILED`); PLANNED rows use `logRequired_`, so nothing is
  reserved or sent without its expected cost recorded.
- Nightly cap 160 credits per Eastern date (`NBA_NIGHT_CREDITS_<date>`),
  owner set 2026-11-02. Shown on the review screen; over cap loads and game
  odds refreshes are refused before any request.
- Speed: `replaceRows_` for PROPS, ALT_PROPS and NBA_PROPS; LINE_HISTORY
  dedupe reads only the ID column; the duplicate second history pass is
  dropped; unchanged run checkpoints are not rewritten; receipts carry
  `timings`. Mock measure: load stage cells touched 1,055,592 to 41,117
  (41,117 / 1,055,592 = 3.9%), tabs byte identical.
- Stuck spinner: the phone shows the real error 15 seconds after a request
  that never started, and stops waiting after 2 minutes for a saved run ID the
  server has no record of.
- Deploy button: `.github/workflows/deploy-nba.yml`, `deploy/deploy.cjs`,
  `deploy/test.cjs`, `docs/DEPLOY_BUTTON.md`. Needs owner secrets
  `CLASPRC_JSON` and `NBA_SCRIPT_ID`. First `check` needs live_commit
  `140074aaafddf4039af20a624c9c7616ef50e982` to record tag `nba-v13`.
- Removed the copied NFL `outputs/test-loader.cjs`. Test mocks updated in
  three existing suites (build pin, mocks for the new cap and `logRequired_`,
  polling assertion now checks the new stop logic).
- Offline: 10 suites pass (7 existing, `test-nba-phase1.cjs` 25,
  `test-nba-speed.cjs` 5, `deploy/test.cjs` 11). Against the live v13 source,
  22 of 22 server side Phase 1 tests fail, so they test real changes.
- Credits: building and testing used 0. Running it adds 0 credits per load;
  F3 can only save credits. The cap limits the worst month to
  160 x 30 = 4,800.
- Owner added secrets `CLASPRC_JSON` and `NBA_SCRIPT_ID` (2026-11-02). The
  workflow file alone was pushed to `main` (commit `9151000`, owner OK) so
  GitHub lists the button.
- Deploy button `check` PASSED (run 41499630532, 2026-11-02 18:20 to 18:21Z, on
  `claude/phase1-reliability` at `f7b430e`): all suites green, library pin NBA
  only, web app on version 13 (next would be 14), live HEAD and version 13 both
  byte-match commit `140074a`. Tag `nba-v13` recorded. Repo equals live is now
  verified, not just recorded. Secrets were masked in the log.
- Next: owner says "deploy now" (creates version 14), then one supervised paid
  test (one game, standard only, maximum 5 credits).

**Phase 0 baseline (2026-11-02, cloud session, free checks only, branch
`claude/phase0-baseline`, pushed to GitHub 2026-11-02 on owner OK, not merged, nothing deployed):**

- Secret scan of all 12 commits and every tracked file: no API keys, tokens,
  OAuth or clasp credentials, private keys or invitation links. The public
  repo does contain the owner only web app URL (README, `NbaOddsLoader.gs`)
  and the shared library script ID (`appsscript.json`). Neither is a
  credential: the web app is `MYSELF` access and the library needs Google
  sharing to use.
- clasp: no clasp install or `.clasprc.json` in the cloud container, so live
  vs repo was NOT verified here. Repo source carries build
  `2026.10.22-nba-team-labels.1`, which the log records as live version 13.
  Treat "repo equals live v13" as recorded, not reverified, until an isolated
  `clasp pull` or the Phase 1 deploy button check runs.
- Offline: all seven NBA suites pass. `outputs/test-loader.cjs` is a copied
  NFL suite that crashes on test 1 (`MAX_ROSTER_AGE_HOURS` undefined). Dead
  NFL code also remains in `NbaOddsLoader.gs` (nflverse grading, roster CSV
  with undefined `ROSTER_URL`); not on any active NBA path.
- Inventory: one book (`bookmakers=draftkings`, no `regions`). Game lines
  h2h/spreads/totals = 3 credits per refresh; standard props points,
  rebounds, assists, threes, PRA = 5 per game; opt in alternates (same five,
  alternate) = 5 per game; free game list = 0. 90 minute caches for each.
  No per night credit cap exists. SportsGameOdds disabled.
- Night cost: 15 games standard only = 3 + 15 x 5 = 78; with alternates
  = 3 + 15 x 10 = 153.
- Triggers: no daily trigger (owner choice). Each paid load arms one short
  `continueNbaMobileLoad` trigger and clears it when done. The trigger list
  itself cannot be read without editor access.
- Docs: added `CLAUDE.md`; added edge thesis, credit budget, credential
  access and deployment sections to `AGENTS.md`.
- Next: owner review of Phase 0, then Phase 1 on a new branch.

**What exists:** An isolated NBA Sheet, bound Apps Script project, and owner-only
NBA Game Prep web app at version 13 exist. Source, mobile UI, and NBA offline
tests are under `outputs/`. Standard and alternate prop loading, immutable
exports, three AI sharing choices, and shared owner key access are deployed.

**What is in flight:** NBA version 10 repairs granular trigger consent and
abandoned queues. All five offline suites pass. The owner completed Google's
permission flow; the live setup check returned READY and reconciled the old
unclaimed startup to FAILED. The live temporary background probe SUCCEEDED
from 2026-10-21T00:25:35.762Z to 00:26:37.748Z with zero provider calls. The
Triggers page then showed zero triggers, confirming probe cleanup. The app
reopens on game selection. The real paid NBA load/export path still needs
verification during the next normally approved load.
The date/time repair is DEPLOYED in version 11. It derives Eastern game dates
and tipoff labels from canonical event timestamps instead of auto-converted
Sheet display cells, uses Today/Tomorrow day tabs, defaults to the next
upcoming day, and formats cost-review/export times consistently. All six NBA
offline suites pass, including UTC-midnight and DST boundaries. No provider
credits or Sheet columns are added. Live UI verification showed Today/Tomorrow
day tabs and readable Eastern tipoff/update times on the existing app URL.
The shared-key library v2 and NBA adapter are published; NFL/Friends remain
pinned to library v1. The owner chose no daily trigger.
SportsGameOdds remains disabled pending its separately approved NBA coverage
test. The version 4 deployment remains available for rollback.

**Deployed recommendation update (2026-10-21):** All three active AI handoffs now
use best-supported basketball judgment without requiring proven mispricing.
Five classified candidates per game remain; the final shortlist is up to ten
RECOMMENDED/CONDITIONAL only, without padding. Guidance and actual Share-button
tests are aligned. Six existing NBA suites and 17 new checks pass. The isolated
live pull matched local app files before editing. Version 12 is deployed at the
existing URL, build 2026.10.21-nba-selection.1; version 11 remains the rollback.
Deployment listing confirms version 12. External AI reasoning and the updated
iPhone page have not yet been validated. Compatible version 11 exports remain usable.

**Deployed team-label update (2026-10-22):** Shared ChatGPT/Claude/Perplexity
instructions label players with verified NBA abbreviations in game tables,
shortlists and parlays, e.g. Shai Gilgeous-Alexander (OKC). Unresolved mappings
show (team unverified); exact exported identities and quotes stay unchanged.
All seven NBA suites pass, including 17 Share-button/fallback checks with the
new label requirements. Isolated live source matched before editing. Version 13
is deployed at the existing URL, build 2026.10.22-nba-team-labels.1. Deployment
listing confirms it; version 12 remains rollback. Compatible prior exports work.

**Next action:** Open the updated app and verify a fresh analysis renders
the labels. Version 13 is production.
External AI compliance remains unverified. No extra paid test is authorized.
NFL and Friends are unchanged.

**Repository publication (2026-11-02):** Owner requested publication to
https://github.com/uzielcards732-hash/nba-game-prep.git (public, initially empty).
Source and full existing history passed the credential scanner. Local deployment
configuration, generated artifacts and the stale pulled .js duplicate are excluded.

**Credit position:** Integration and offline checks made zero paid provider
calls; the live game-list smoke test used the free endpoint. On-demand game-list
refresh is free; confirmed game-odds refresh costs three. Standard props are
up to five per game and opted-in alternates up to five, now drawing from the
same owner pool as NFL/Friends.

## Chronology

- 2026-10-07: Created a separate local NBA repository.
- 2026-10-07: Verified the live NFL source in an isolated temporary pull.
- 2026-10-07: Copied the proven mobile workflow without NFL credentials or deployment configuration.
- 2026-10-07: Added NBA sport, five standard markets, five alternate markets, and isolated key slots.
- 2026-10-07: Disabled SportsGameOdds pending a separately approved NBA coverage test.
- 2026-10-07: Created the separate NBA Sheet and its bound Apps Script project.
- 2026-10-07: Created the NBA-only core tabs without changing the NFL Sheet.
- 2026-10-07: Added NBA standard points, rebounds, assists, threes, and PRA market handling.
- 2026-10-07: Added opt-in NBA alternate ladders with independent 90-minute caching.
- 2026-10-07: Removed NFL roster loading from active NBA load paths.
- 2026-10-07: Updated the primary ChatGPT handoff for NBA minutes, rotations, usage, and rest research.
- 2026-10-07: Passed local NBA foundation and workflow checks with zero provider calls.
- 2026-10-07: Pushed the NBA source to its separate Apps Script project.
- 2026-10-07: Deployed NBA Game Prep version 1 as an owner-only web app.
- 2026-10-07: No provider request was made during push or deployment.
- 2026-10-07: Confirmed the deployed NBA web app opens successfully for the owner.
- 2026-10-07: Started local-only checkpoint 3 preparation; no provider request was made.
- 2026-10-07: Corrected the Perplexity handoff from leftover NFL wording to NBA research wording.
- 2026-10-07: Added offline checks for the NBA Perplexity handoff and removed obsolete NFL provider-scope wording.
- 2026-10-07: Passed source syntax, foundation, and workflow checks; the correction remains local only.
- 2026-10-07: Pulled the live NBA script before publishing and found no conflicting remote edit.
- 2026-10-07: Pushed the tested NBA handoff correction with no provider request.
- 2026-10-07: Created immutable NBA Game Prep version 2 for the Perplexity handoff correction.
- 2026-10-07: Created a separate version 2 web-app deployment; version 1 remains available for rollback.
- 2026-10-07: No Odds API or SportsGameOdds request was made during the publication.
- 2026-10-07: Pulled the live NBA source before the requested visual update.
- 2026-10-07: Added a Knicks-inspired navy, royal-blue, orange, and white color layer locally.
- 2026-10-07: Preserved all NBA workflow behavior, controls, and provider handling.
- 2026-10-07: Passed the NBA foundation and workflow checks after the visual update.
- 2026-10-07: Made no provider request or deployment during the visual-update session.
- 2026-10-07: Pushed the approved Knicks-inspired palette to the separate NBA script.
- 2026-10-07: Created immutable NBA Game Prep version 3 for the visual update.
- 2026-10-07: Created a separate version 3 web-app deployment; versions 1 and 2 remain available for rollback.
- 2026-10-07: Made no Odds API or SportsGameOdds request during palette deployment.
- 2026-10-07: Recorded version 3 as the current published NBA visual state.
- 2026-10-07: Replaced the generic top-left mark with an inline orange basketball icon locally.
- 2026-10-07: Kept the mark self-contained with no external image dependency.
- 2026-10-07: Retained the Knicks-inspired blue app shell around the basketball mark.
- 2026-10-07: Passed NBA foundation and workflow checks after the mark update.
- 2026-10-07: Made no provider request or deployment during the basketball-mark session.
- 2026-10-07: Pulled the live NBA source before publishing the basketball-mark update.
- 2026-10-07: Pushed the approved basketball-mark update to the separate NBA script.
- 2026-10-07: Created immutable NBA Game Prep version 4 for the basketball mark.
- 2026-10-07: Created a separate version 4 web-app deployment; version 3 remains available for rollback.
- 2026-10-07: Made no Odds API or SportsGameOdds request during icon deployment.
- 2026-10-20: Compared an isolated pull of live NBA v4 with local source; no drift found.
- 2026-10-20: Built local-only daily free games refresh and source-aware price freshness.
- 2026-10-20: Added checkpointed manual loading with raw receipts and exact-run recovery.
- 2026-10-20: Repaired email content and updated all three NBA research handoffs.
- 2026-10-20: Passed isolated offline mocks and NBA tests; no provider call, push, deployment, or trigger installation.
- 2026-10-20: Rechecked live NBA source against the local upgrade and found no conflicting remote edits.
- 2026-10-20: Passed foundation, workflow, refresh, syntax, and diff checks without provider calls.
- 2026-10-20: Published NBA source as immutable versions 5 and 6 and deployed version 6 at a new owner-only app link.
- 2026-10-20: Corrected the completion email link to the new deployment; version 4 remains available for rollback.
- 2026-10-20: Confirmed the deployed app opens; daily trigger installation awaits Google authorization, and no paid call or email was sent.
- 2026-10-20: Reopened the production NBA script after the owner's first Google authorization.
- 2026-10-20: Confirmed the Apps Script project still had zero daily triggers.
- 2026-10-20: Ran the trigger installer; Google rejected `ScriptApp.getProjectTriggers` without `script.scriptapp` permission.
- 2026-10-20: Reopened Google's permission review for the owner to approve trigger management.
- 2026-10-20: Left daily automation inactive; no provider request or email was sent.
- 2026-10-20: Confirmed the NBA Apps Script trigger page still showed zero triggers.
- 2026-10-20: Configured one time-driven `nbaDailyGamesRefresh` trigger for the 9–10 a.m. Eastern window.
- 2026-10-20: Google opened an unverified-app approval page before the trigger could be saved.
- 2026-10-20: Brought the grouped Google approval tab to the front for the owner to review.
- 2026-10-20: No trigger was claimed active; no paid provider request or email was sent.
- 2026-10-20: Checked the NBA Apps Script trigger page again after the owner reported no visible approval tab.
- 2026-10-20: Confirmed the project still shows zero installed triggers.
- 2026-10-20: Verified the script timezone remains `America/New_York`.
- 2026-10-20: Switched to a stable direct Triggers-page link for owner authorization and setup.
- 2026-10-20: Left automatic refresh inactive; no provider request or email was sent.
- 2026-10-20: Compared isolated live pulls of the NBA app and shared library with local sources before editing.
- 2026-10-20: Added owner-only NBA registration and conservative shared-key reservations to a local library v2 candidate.
- 2026-10-20: Routed NBA free and paid Odds API requests through the shared pool; removed key entry from the active mobile Settings.
- 2026-10-20: Passed the NBA offline suites and shared-store mock tests with no real provider calls or email.
- 2026-10-20: Kept the shared library and NBA changes local only; no app was pushed or deployed.
- 2026-10-20: Published the private shared library as immutable version 2; existing NFL/Friends apps remain pinned to version 1.
- 2026-10-20: Pushed the NBA shared-key adapter and deployed versions 7 then 8 on the existing owner-only web-app URL.
- 2026-10-20: Ran the live free game-list refresh through the deployed app; INDEX showed 18 games.
- 2026-10-20: Confirmed NBA Settings displayed four shared slots without key-entry controls or credential values.
- 2026-10-20: Made no paid Odds API request or email; paid NBA loads remain unverified until normal use.
- 2026-10-20: Inspected three failed NBA version 8 load executions and found no continuation-worker executions.
- 2026-10-20: Confirmed the NBA Apps Script project showed zero installed triggers; exact root exception remains hidden by the generic error wrapper.
- 2026-10-20: Isolated live-source pull confirmed production matches local source except this repair; credential-cache save hit a sandbox permission error.
- 2026-10-20: Fixed blank-lease recovery and added local-only trigger preflight, startup errors, and failed-stage cleanup; all four NBA offline suites passed.
- 2026-10-20: Made no paid provider call, email, push, or deployment during diagnosis.
- 2026-10-20: Compared an isolated live-source pull with the NBA repair and found no unrelated source drift.
- 2026-10-20: Passed all four NBA offline suites before publication; no provider request or email was sent.
- 2026-10-20: Pushed the repair and redeployed the existing owner-only NBA link as immutable version 9; version 8 remains in history.
- 2026-10-20: Confirmed the deployed app opens and shows 18 games without making a paid request.
- 2026-10-20: Deferred the safe trigger-permission check because Google authorization needs explicit owner approval; paid loading is still unverified.
- 2026-10-20: Received explicit owner approval and ran `authorizeNbaBackgroundLoading` from the NBA Apps Script editor.
- 2026-10-20: The check failed at `ScriptApp.getProjectTriggers`; Google showed no new consent screen.
- 2026-10-20: Inspected project settings and confirmed the last failed export record coexists with an orphaned RUNNING stage.
- 2026-10-20: No continuation trigger, paid provider call, email, or fresh load was started by the permission check.
- 2026-10-20: Trigger OAuth scope repair and safe state reconciliation remain to be implemented before paid testing.
- 2026-10-20: Compared an isolated live pull with local NBA source; version 9 matched before this follow-up repair.
- 2026-10-20: Applied Google's documented granular-consent setup using `requireScopes` outside exception handling.
- 2026-10-20: Added locked reconciliation for failed unclaimed startups and a temporary zero-provider trigger probe.
- 2026-10-20: Passed all five NBA offline suites, including consent propagation, reconciliation boundaries, and probe idempotence.
- 2026-10-20: Automatic approval review blocked the production push pending explicit follow-up deployment approval; no code, odds call, or email was published.
- 2026-10-20: Received explicit owner deployment approval and pushed the tested NBA trigger-consent repair.
- 2026-10-20: Published immutable version 10 on the existing NBA app URL; version 9 remains available in version history.
- 2026-10-20: Ran the approved setup function in the editor and confirmed it now opens Google's Authorization required dialog.
- 2026-10-20: The owner completed Google consent; setup returned READY and reconciled the old orphaned startup to FAILED.
- 2026-10-20: Confirmed the live background probe SUCCEEDED with zero provider calls and removed its trigger; no paid call or email was made.
- 2026-10-20: Compared live NBA version 10 with local source before the date/time repair; no source drift was found.
- 2026-10-20: Traced confusing dates to auto-converted Sheet display cells and direct rendering of Date/UTC values.
- 2026-10-20: Added canonical Eastern day grouping, readable tipoff times, upcoming-day default, and dated review/export summaries locally.
- 2026-10-20: Passed six NBA suites covering midnight UTC, DST, corrupted display cells, day selection, and existing workflow safeguards.
- 2026-10-20: Made no provider call, email, Sheet change, push, or deployment; date/time changes await deployment approval.
- 2026-10-20: Received owner approval and pushed the tested NBA date/time changes.
- 2026-10-20: Created immutable version 11 and updated the existing owner-only NBA deployment; version 10 remains available for rollback.
- 2026-10-20: Verified the live app shows Today/Tomorrow tabs and Eastern tipoff times derived from canonical event timestamps.
- 2026-10-20: Confirmed the live update label is readable and started games retain their pregame-closed label.
- 2026-10-20: Made no provider call or email during deployment; real paid load/export verification remains for normal approved use.
- 2026-10-21: Compared an isolated live NBA pull; app source and manifest matched before this edit, preserving existing local changes.
- 2026-10-21: Updated the shared policy and three destination endings for informed judgment, five classified candidates and an unpadded up-to-ten shortlist.
- 2026-10-21: Aligned NBA guidance and passed six existing suites plus 17 actual-controller sharing, fallback and contract-fixture checks.
- 2026-10-21: Made zero provider calls, emails, Sheet changes, pushes or deployments; NFL and Friends remain unchanged.
- 2026-10-21: Awaiting deployment approval and a fresh analysis behavior review; offline prompt tests do not establish external AI compliance.
- 2026-10-21: Received owner deployment approval and compared a new isolated live pull, finding only the approved handoff changes.
- 2026-10-21: Added matching page/server build 2026.10.21-nba-selection.1 and retained compatible version 11 exports.
- 2026-10-21: Passed all seven NBA offline suites, including 17 active Share-button and fallback checks, before publishing.
- 2026-10-21: Published immutable version 12 and verified the existing NBA deployment now points to it; version 11 is retained for rollback.
- 2026-10-21: Made no provider call, email or NFL/Friends change; iPhone and fresh AI report verification remain pending.
- 2026-10-22: Compared an isolated live NBA pull against local app files; no remote drift found and existing changes preserved.
- 2026-10-22: Added verified team abbreviations to shared NBA reporting instructions, with (team unverified) fallback and unchanged exact quotes.
- 2026-10-22: Aligned project guidance and tested all three actual Share-button payloads plus native/clipboard failure fallbacks.
- 2026-10-22: Passed all seven NBA offline suites, including 17 sharing checks; made zero provider calls, emails or Sheet changes.
- 2026-10-22: Team-label change remains local pending deployment approval; production version 12 and NFL/Friends remain unchanged.
- 2026-10-22: Received owner approval and compared another isolated production pull; only the approved shared label instruction differed.
- 2026-10-22: Updated matching page/server build to 2026.10.22-nba-team-labels.1 and preserved compatible prior exports.
- 2026-10-22: Repassed all seven NBA suites, including 17 actual sharing and clipboard-fallback checks, before publication.
- 2026-10-22: Published immutable version 13 and verified the existing app deployment points to it; version 12 retained for rollback.
- 2026-10-22: Made zero provider calls, emails or NFL/Friends changes; real AI report rendering remains unverified.
- 2026-11-02: Confirmed the NBA project has its own repository; the newer ChatGPT/NBA directory is empty and is not the source checkout.
- 2026-11-02: Verified the requested GitHub repository is public and initially empty; no force push is needed.
- 2026-11-02: Scanned current NBA files and all existing commits for credentials; no leaks found.
- 2026-11-02: Excluded local credentials, environment files and the stale pulled .js duplicate; preserved generated-file exclusions.
- 2026-11-02: Prepared source, guidance and NBA tests for GitHub publication; no app deployment, provider request or email is part of this task.
- 2026-11-02: Phase 0 baseline in a cloud session: redacted secret scan of all commits found no credentials; web app URL and library ID are public but not secrets.
- 2026-11-02: No clasp or clasp credentials in the cloud container; live vs repo not reverified (recorded live: version 13, build 2026.10.22-nba-team-labels.1).
- 2026-11-02: Seven NBA offline suites pass; the copied NFL `test-loader.cjs` fails and is not an NBA suite.
- 2026-11-02: Inventoried markets, costs and triggers; added CLAUDE.md and AGENTS.md standing sections modeled on NFL.
- 2026-11-02: Zero provider calls, emails, pushes or deployments; NFL untouched. Local branch only.
- 2026-11-02: Phase 1 built on `claude/phase1-reliability`: NFL F1 to F8 ported, safe LOG writes, 160 credit nightly cap, in place row replacement, receipt timings, stuck spinner fix.
- 2026-11-02: Added the NBA deploy button (check, deploy, rollback) with byte match checks and an NBA only library pin guard; needs CLASPRC_JSON and NBA_SCRIPT_ID secrets.
- 2026-11-02: New suites test-nba-phase1 (25) and test-nba-speed (5) plus deploy/test (11); all 10 suites pass; 22 server side tests fail on live v13 as expected.
- 2026-11-02: Removed the copied NFL test-loader.cjs; adjusted three existing suites' mocks for the new cap, required PLANNED log and build.
- 2026-11-02: Zero provider calls, emails or deployments; NFL untouched. Branch pushed on owner OK; not merged or deployed.
- 2026-11-02: Workflow file pushed to main (owner OK); first deploy button check passed; live v13 byte-matches 140074a; tag nba-v13 recorded. Nothing deployed.
