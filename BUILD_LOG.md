# NBA Game Prep build log

## Current state

**What exists:** An isolated NBA Sheet and bound Apps Script project exist,
alongside local source, mobile UI, and foundation tests under `outputs/`. No NBA
deployment, credential, Drive export folder, or live provider data exists yet.

**What is in flight:** Checkpoint 1, isolated foundation and secure NBA key-pool
code. SportsGameOdds is disabled pending its separately approved coverage test.

**Next action:** Complete the NBA mobile load/export implementation locally,
then report its offline tests before any deployment or paid provider test.

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
