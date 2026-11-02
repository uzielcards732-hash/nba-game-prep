# NBA Game Prep

This is a separate NBA application. Its Sheet, script, deployment, exports,
and provider data remain isolated from NFL. The owner's existing shared key
library supplies Odds API keys and conservative quota accounting to both apps;
do not read credentials from or deploy the NFL personal app.

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
