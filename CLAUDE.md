@AGENTS.md

# Owner hard rules (Claude Code)

The project owner is not a coder. Do the technical work and explain results
in plain English, conclusion first, short bullets, arithmetic shown for every
number.

1. Ask the owner before: any Apps Script deploy (NBA app or a shared library
   version), any paid Odds API or SportsGameOdds request (show max credits
   first), sending any email, creating a GitHub repo, pushing anything, or
   changing Drive file sharing.
2. Never print, log, commit, or push API keys, tokens, invitation links, or
   clasp credentials. Redact all scan output.
3. Never touch the NFL apps (personal, Friends) or the shared library version
   they pin (version 1). If NBA needs a shared library change, it ships as a
   new library version that only NBA pins, with the owner's OK.
4. Every credit spending feature states its projected monthly cost before it
   is built. Dry run mode on every paid function. No automatic retries on paid
   endpoints. Reruns are idempotent.
5. No forecasting or projection methods. The edge thesis is price based
   (DraftKings vs Fanatics vs median no vig consensus), never a prediction.
6. Before the candidate log phase (Phase 3) and the bet log phase (Phase 4),
   remind the owner to raise effort to the highest level in /model and wait
   for confirmation.
7. At the end of every session, update the STATE section of BUILD_LOG.md and
   say whether anything is deployed or local only.
8. Follow AGENTS.md and the STATE section of BUILD_LOG.md. If they conflict
   with the owner's instructions, stop and ask.
9. Routine reads and offline tests do not need the owner's OK.

## Upgrade plan (NFL v34 to v46, adapted for NBA)

The NFL repo `uzielcards732-hash/nfl-game-prep` is the read only blueprint.
Never write to it or deploy from it. Phases run one at a time: build on a
branch, offline mock tests, owner says "deploy now", then one supervised
paid test.

0. Baseline (free): secret scan, live vs repo check, docs, inventory.
1. Reliability, speed, deploy button (NFL F1 to F8, safe LOG writes,
   `replaceRows_`, receipt timings, stuck spinner fix, GitHub deploy button).
   Checkpoints and caps are per night (slates of up to 15 games).
2. Price comparison: Fanatics plus the ten book request, MARKET_CONSENSUS,
   `price_gap_pp`. Ten books in one region keeps per call cost unchanged.
3. Usage context and candidate log (free source; test hoopR NBA releases from
   Apps Script, else parse only path). Raise effort first.
4. Bet log and slip reading (Claude API reads slip screenshots only). Raise
   effort first.

## Offline test suites

Run from the repo root; all are offline and mock only.

- `node outputs/test-nba-foundation.cjs`
- `node outputs/test-nba-workflow.cjs`
- `node outputs/test-nba-refresh.cjs`
- `node outputs/test-nba-shared-pool.cjs`
- `node outputs/test-nba-trigger-repair.cjs`
- `node outputs/test-nba-dates.cjs`
- `node outputs/test-nba-recommendations.cjs`

`outputs/test-loader.cjs` is an NFL suite copied at project creation. It is
not an NBA suite and fails on its first test (NFL roster constants are absent
from NBA source). Do not count it; Phase 1 decides whether to delete it.
