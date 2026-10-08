# NBA Game Prep

This is an isolated NBA application. Never edit, push, read credentials from,
or deploy to the NFL project from this repository.

## Safety and costs

- NBA Odds API credentials are entered only in the owner-only mobile Settings
  screen and stored in this script project's Script Properties.
- Never return, log, export, or place a credential in source or a Sheet cell.
- Every paid request needs an exact preview and owner confirmation. No automatic
  retries or key rotation to evade a rate limit.
- Standard props and alternate ladders have independent 90-minute caches.
- SportsGameOdds is disabled until a separately approved NBA coverage test.

## Workflow

The mobile flow is: select games, review exact cost, load/export, choose an
analysis app. Exports are immutable and are the audit record. NBA research
handoffs must assess rotations, minutes, usage, injuries/restrictions, defense,
pace, rest, and live news before recommendations.

## Deployment

Local source is under `outputs/`. Do not create a Google Apps Script project,
push, deploy, or make a live provider request without explicit owner approval.
