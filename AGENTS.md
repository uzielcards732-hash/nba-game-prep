# NBA Game Prep

This is a separate NBA application. Its Sheet, script, deployment, exports,
and provider data remain isolated from NFL. The owner's existing shared key
library supplies Odds API keys and conservative quota accounting to both apps;
do not read credentials from or deploy the NFL personal app.

## Edge thesis (standing)

The system's edge thesis is price based, not prediction based: DraftKings
versus Fanatics versus a median no vig consensus of reference books at
identical lines. Those are market references and a line shopping aid, never
refusal reasons. It does not forecast player output. Do not propose, build,
or revive projection methods; if a task seems to need one, stop and say so.

## Credit budget (hard constraint)

Odds API cost is markets x regions per event odds call. The app sends
`bookmakers=` instead of `regions=`; up to ten books count as one region.
Since build `2026.11.02-nba-consensus.1` every paid props and game lines
request names ten books (`NBA_REQUEST_BOOKMAKERS`): draftkings, fanatics,
fanduel, betmgm, williamhill_us, betrivers, hardrockbet, pinnacle,
betonlineag, lowvig. An 11th book is refused before any request. Only
DraftKings feeds PROPS, ALT_PROPS, INDEX, line history and quotes; Fanatics
goes to COMPARE_QUOTES; the reference books feed MARKET_CONSENSUS. A charge
above the previewed maximum keeps the data and pauses all paid requests until
the owner runs `acknowledgeOverchargeHold` in the editor.
Current costs: free game list (events endpoint) 0; game lines 3 per refresh
(h2h, spreads, totals); standard props 5 per game; opted in alternates 5 per
game. Every new paid feature must state its projected monthly cost before it
is built.

- Nightly cap (owner set 2026-11-02): 160 Odds API credits per Eastern
  calendar date across every paid request (`NBA_NIGHT_CAP_CREDITS`). Each
  request counts its expected cost before it is sent and moves to the actual
  `x-requests-last` after; an unconfirmed outcome keeps its expected cost. A
  load or refresh that would exceed the cap is refused before any request.
  Worst case: 160 x 30 nights = 4,800 credits a month.
- A saved paid response is reused for 90 minutes from its capture (same event,
  markets and bookmaker) instead of being bought again. Started games cost 0
  and are never requested.
- Log expected credit cost before every paid call and the actual
  `x-requests-last` after, into LOG.
- Every credit spending function needs a dry run mode that shows the request
  and its cost without calling.
- No automatic retries on paid endpoints. Fail loudly.
- Idempotent. Rerunning must not duplicate rows.
- Do not modify existing tabs beyond adding columns. List columns added.

## Credential access

This repository and cloud sessions have no Odds API, SportsGameOdds, or
clasp credentials. Paid fetches run only inside Apps Script, where keys live
in the shared library's Script Properties. Flag missing credentials once,
then propose a parse only path. Never ask for a key in chat.

## Safety and costs

- Odds API credentials are managed only in the existing owner dashboard and
  stored in the shared library's Script Properties. NBA does not accept keys.
- Never return, log, export, or place a credential in source or a Sheet cell.
- Every paid request needs an exact preview and owner confirmation. No automatic
  retries or key rotation to evade a rate limit.
- Standard props and alternate ladders have independent 90-minute caches.
- SportsGameOdds is disabled until a separately approved NBA coverage test.
- The optional daily game-list trigger is not installed; the owner chose
  on-demand free game-list refresh instead.

## Workflow

The mobile flow is: select games, review exact cost, load/export, choose an
analysis app. Exports are immutable and are the audit record. NBA research
handoffs must assess rotations, minutes, usage, injuries/restrictions, defense,
pace, rest, and live news before recommendations. Each candidate needs a
sourced offense-versus-defense and coaching case tied to its exact line and
price, plus contrary evidence. Unders are exceptional, not banned: require a
specific opportunity or production-reduction case. Recommend best-supported
picks using informed basketball judgment, without requiring proof of mispricing
or freedom from ordinary uncertainty. Generic blowout, missed-shot or game-script
possibilities cannot alone veto a recommendation. Preseason results, historical
averages and points-per-minute arithmetic are context, not standalone evidence.
Compare available standard and nearby alternate quotes using workload, price,
break-even and failure paths; easier lines and shorter prices are not inherently
better or worse. Never invent probabilities or claim a proven edge.
When an export carries market consensus pricing, state price_gap_pp
(consensus no-vig minus the DraftKings break-even) or its consensus_note for
every shortlisted pick. The break-even includes the DraftKings margin, so a
fairly priced -110/-110 market scores about -2.4 (50.00 - 52.38) and most gaps
are negative. Owner set 2026-11-02: a pick with a gap below -2.5 (DraftKings
pricier than a standard -110 market) needs a specific stated reason to remain
RECOMMENDED. The gap is a market reference, not a forecast
or an edge claim; a missing consensus or Fanatics price is never a refusal
reason, and the gap alone never decides a pick. DraftKings stays the quoted
price; name Fanatics when it is better at the identical line.
Exports carry usage_context: each prop player's last five team games from the
free sportsdataverse hoopR box score release (minutes, starts, shot attempts,
usage rate, rebounds, assists, team rebound and assist shares, did-not-play
reasons) and each team's rest days and back-to-back flag. It is history to
verify against live news, never a projection: do not average it into an
expected number. Rebound chances and potential assists are not in that source.
A missing or UNAVAILABLE usage context is never a refusal reason.
ChatGPT and Claude handoffs end with an NBA_CANDIDATES_V1 JSON block of the
same five classified candidates per eligible game (exact exported quotes,
snapshot_id from the manifest). The phone's "Log AI picks" validates it
against that exact snapshot, all or nothing, and appends to CANDIDATES
(append-only revisions); rows logged after tipoff are POST_KICKOFF and never
graded. "Grade finished games — free" settles from the hoopR box score file:
props (alternates by base market, PRA = points + rebounds + assists),
moneyline, spread, total. A player who did not play is VOID (DraftKings gives
no action); a player missing from the box score is UNRESOLVED for a manual
check, never guessed. CANDIDATE_SUMMARY is flat 1 unit at the logged price
with sample sizes; no probabilities. New tabs only: CANDIDATES,
CANDIDATE_RESULTS, CANDIDATE_SUMMARY.

Classify completed, credible exact-quote cases RECOMMENDED; supported cases with
a named material injury, role or price condition CONDITIONAL; plausible but
specifically unresolved/unattractive cases WATCHLIST; cases outweighed by specific
opposing evidence PASS; incomplete material research UNASSESSED. An unfinished
report must say Analysis incomplete, not declare that the slate has no bets.
Keep five distinct candidates per eligible game where available, with exact quote,
sourced support, strongest opposing evidence, working source links and closest
alternative. Draw the final up-to-ten shortlist from the same decision list using
RECOMMENDED and CONDITIONAL only; never pad it with unsupported or rejected rows.
Parlays still require exact RECOMMENDED legs and an actual sportsbook quote.
In game tables, the final shortlist and parlays, label each player with the
verified team abbreviation, e.g. Shai Gilgeous-Alexander (OKC). Use verified
export mappings or current sourced research; otherwise show (team unverified).
Never guess a team or change the underlying exported player identity/quote.

## Deployment

Local source is under `outputs/`. Do not create a Google Apps Script project,
push, deploy, or make a live provider request without explicit owner approval.

- The repo (`outputs/NbaOddsLoader.gs`, `outputs/Mobile.html`,
  `outputs/appsscript.json`) is the source of truth. Do not edit code in the
  Apps Script editor.
- `.clasp.json` is local only (gitignored). `.claspignore` is an allowlist:
  only `appsscript.json`, `NbaOddsLoader.gs` and `Mobile.html` are pushed.
- Run `clasp pull` into an isolated folder at the start of any session that
  will change Apps Script code, and compare it with the repo before editing.
- `clasp push` and deployment only on the owner's explicit "deploy now".
  Report what changed first. State at the end of every session whether a
  change is deployed or local only.
- The NBA manifest pins shared library `SharedNFL` version 2. NFL and Friends
  pin version 1; never change their pin.
- Update the STATE section at the top of BUILD_LOG.md at the end of every
  session; it is what another tool reads to pick up the project cold.
