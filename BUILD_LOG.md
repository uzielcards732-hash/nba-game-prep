# NBA Game Prep build log

## Current state

**What exists:** An isolated NBA Sheet and bound Apps Script project exist,
alongside local source, mobile UI, and foundation tests under `outputs/`. No NBA
deployment, credential, Drive export folder, or live provider data exists yet.

**What is in flight:** Checkpoint 2 local implementation is complete. It has not
been pushed, deployed, or tested against a live provider. SportsGameOdds remains
disabled pending its separately approved coverage test.

**Next action:** Review the local NBA workflow patch and offline tests before
authorizing a push, deployment, or a one-game paid provider test.

**Credit position:** Zero NBA provider credits spent. Future standard loads are
up to five credits per selected game; alternates add up to five more.

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
