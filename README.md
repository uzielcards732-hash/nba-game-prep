# NBA Game Prep

Separate NBA mobile companion for NBA game selection, priced props, alternate
ladders, immutable exports, and AI research handoffs. It deliberately has no
shared deployment, state, triggers, Sheet, or Drive folder with NFL. It uses
the owner's existing shared Odds API key pool; keys remain server-side in the
private library and are not entered in the NBA app.

Current production deployment: owner-only NBA Game Prep version 13 at
https://script.google.com/macros/s/AKfycbzRSWWd4ktxD1aKObbeDa5aHvRU1VdWfRQR8vhb724N3gVDNE5Y6XtEx6M_AFCAZhkO/exec.
The free game-list refresh, staged loads, source-aware price freshness,
repaired completion email, and updated NBA handoffs are deployed. The owner
chose on-demand game-list refresh; no daily trigger is installed. The app now
uses the owner-managed shared Odds API keys without another key-entry step.
Version 6 remains available for rollback. The game-list smoke test used a
free Odds API call; no paid request or email was made.

## Recommendation update (version 12)

ChatGPT, Claude and Perplexity now share the best-supported basketball-judgment
standard: sourced minutes/role/opportunities, specific defense/coaching matchup,
exact line/price, and meaningful contrary evidence. Normal uncertainty does not
alone reject a pick, and proven mispricing is not required. Five classified
candidates per game remain where available; the final shortlist has up to ten
RECOMMENDED or CONDITIONAL picks only. No padding, invented probabilities or
unsupported alternate rungs. Existing freshness, quotes and parlay rules remain.

Run `node outputs/test-nba-recommendations.cjs` for 17 active-controller Share
button, clipboard fallback, guard and report-contract checks. These validate
payloads, not external AI reasoning; a fresh analysis review is still required.
Build 2026.10.21-nba-selection.1 is deployed at the existing URL; version 11 remains
available for rollback. The update adds zero provider credits and changes no
backend endpoints. Compatible existing exports remain usable.

Version 13 adds verified team abbreviations beside player names in game tables,
shortlists and parlays for all three AI handoffs, with (team unverified) instead
of a guessed team. Build: 2026.10.22-nba-team-labels.1; version 12 is retained for
rollback. All seven offline suites pass; live AI report rendering is unverified.
