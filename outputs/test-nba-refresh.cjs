const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'NbaOddsLoader.gs'), 'utf8');
const mobile = fs.readFileSync(path.join(__dirname, 'Mobile.html'), 'utf8');
const properties = new Map();
const lock = {tryLock: () => true, releaseLock: () => {}};
const context = vm.createContext({
  console,
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, String(value)),
    deleteProperty: key => properties.delete(key)
  })},
  LockService: {getScriptLock: () => lock},
  ScriptApp: {getProjectTriggers: () => []}
});
vm.runInContext(source, context, {filename: 'NbaOddsLoader.gs'});

let refreshCount = 0;
const actualRefreshIndex = context.refreshIndexCore_;
context.now_ = () => '2026-10-20T13:00:00.000Z';
context.refreshIndexCore_ = () => {refreshCount++;};
context.mobileIndexTable_ = () => [['game-1'], ['game-2']];
context.nbaStageState_ = () => null;
let result = context.nbaDailyGamesRefresh();
assert.equal(result.status, 'SUCCEEDED');
assert.equal(result.game_count, 2);
assert.equal(refreshCount, 1);
assert.equal(result.credits, 0);
context.nbaStageState_ = () => ({state: 'RUNNING'});
result = context.nbaDailyGamesRefresh();
assert.equal(result.status, 'BUSY');
assert.equal(refreshCount, 1, 'daily refresh must not rewrite INDEX during an export');

const indexShape = vm.runInContext('({width:INDEX_HEADERS.length+INDEX_EXTRA.length,load:IDX.LOAD,linesUpdated:IDX.LINES_UPDATED})', context);
const existingRow = Array(indexShape.width).fill('');
existingRow[0] = 'preserved-event';
existingRow[1] = 'Away @ Home';
existingRow[indexShape.load] = true;
existingRow[indexShape.linesUpdated] = '2026-10-20T12:00:00Z';
let writtenIndex;
context.odds_ = (endpoint, _params, paid) => {
  assert.match(endpoint, /\/events$/);
  assert.equal(paid, false, 'daily game-list refresh cannot call a paid endpoint');
  return [{id: 'preserved-event',home_team: 'Home',away_team: 'Away',
    commence_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()}];
};
context.read_ = () => [existingRow.slice()];
context.write_ = (_tab, _headers, rows) => {writtenIndex = rows;};
context.sheet_ = () => ({getRange: () => ({insertCheckboxes: () => {}})});
context.log_ = () => {};
context.Utilities = {formatDate: require('./nba-test-dates.cjs').formatDate};
actualRefreshIndex();
assert.equal(writtenIndex[0][indexShape.load], true, 'checked event remains checked after free refresh');
assert.equal(writtenIndex[0][indexShape.linesUpdated], '2026-10-20T12:00:00Z',
  'free game-list refresh must not pretend to refresh paid game prices');

const oddsRow = Array(24).fill('');
const oddsIndexes = vm.runInContext('({LINES_UPDATED:IDX.LINES_UPDATED,LINES_SOURCE:IDX.LINES_SOURCE})', context);
oddsRow[oddsIndexes.LINES_UPDATED] = '2026-10-20T12:30:00.000Z';
oddsRow[oddsIndexes.LINES_SOURCE] = JSON.stringify({h2h: '2026-10-20T12:25:00Z',spreads: '2026-10-20T12:25:00Z',totals: '2026-10-20T12:25:00Z'});
assert.equal(context.nbaGameOddsFresh_(oddsRow, '2026-10-20T13:00:00Z').fresh, true);
oddsRow[oddsIndexes.LINES_SOURCE] = JSON.stringify({h2h: '2026-10-20T12:25:00Z',spreads: '2026-10-20T10:00:00Z',totals: '2026-10-20T12:25:00Z'});
assert.equal(context.nbaGameOddsFresh_(oddsRow, '2026-10-20T13:00:00Z').fresh, false,
  'a recent Sheet write cannot make an old bookmaker price actionable');

const standardHeaders = vm.runInContext('propsHeaders_()', context);
const standardRow = Array(standardHeaders.length).fill('');
standardRow[standardHeaders.indexOf('Event ID')] = 'game-1';
standardRow[standardHeaders.indexOf('Updated')] = new Date(Date.now() - 5 * 60000).toISOString();
standardRow[standardHeaders.indexOf('Market Source Times JSON')] = JSON.stringify({player_points: new Date(Date.now() - 5 * 60000).toISOString()});
assert.equal(context.nbaStandardCacheFresh_('game-1', [standardRow], Date.now()), true);
standardRow[standardHeaders.indexOf('Market Source Times JSON')] = JSON.stringify({player_points: new Date(Date.now() - 3 * 3600000).toISOString()});
assert.equal(context.nbaStandardCacheFresh_('game-1', [standardRow], Date.now()), false);
const alternateHeaders = vm.runInContext('ALT_PROPS_HEADERS', context);
const alternateRow = Array(alternateHeaders.length).fill('');
alternateRow[alternateHeaders.indexOf('Event ID')] = 'game-1';
alternateRow[alternateHeaders.indexOf('Updated')] = new Date(Date.now() - 5 * 60000).toISOString();
alternateRow[alternateHeaders.indexOf('Market Source UTC')] = new Date(Date.now() - 3 * 3600000).toISOString();
assert.equal(context.nbaAlternateCacheFresh_('game-1', [alternateRow], Date.now()), false);

let paidCalls = 0;
let operation = {status: 'INTENT', event_id: 'game-1', kind: 'standard'};
let savedRaw = null;
context.nbaOperation_ = (_run, _kind, _event, value) => {
  if (value !== undefined) operation = value;
  return operation;
};
context.nbaRunFile_ = (_run, _kind, value) => {
  if (value !== undefined) savedRaw = value;
  return savedRaw;
};
context.oddsRequest_ = () => {paidCalls++; throw Error('must not call provider');};
const run = {run_id: 'run-12345678'};
const job = {warnings: []};
const step = {event_id: 'game-1', kind: 'standard', credits: 5};
const game = {id: 'game-1', matchup: 'Away @ Home'};
assert.equal(context.nbaPaidStep_(run, job, step, game), 'UNKNOWN');
assert.equal(paidCalls, 0, 'an interrupted request with no raw response must not repeat');

operation = {status: 'INTENT', event_id: 'game-1', kind: 'standard'};
savedRaw = {text: '{"id":"game-1"}', actual_credits: 5, key_slot: 'KEY 1'};
context.propsRows_ = () => [['prop']];
context.propsHeaders_ = () => ['one'];
context.read_ = () => [];
context.write_ = () => {};
context.mergeProps_ = (_old, rows) => rows;
context.replacePropsRows_ = () => ({removed: 0, added: 1});
context.writeLatestNormalizedProps_ = () => {};
context.normalizeOddsApiEvent_ = () => ({});
context.recordOddsApiLineHistorySafely_ = () => {};
context.sheet_ = () => ({getRange: () => ({setValue: () => {}})});
assert.equal(context.nbaPaidStep_(run, job, step, game), 'SUCCESS');
assert.equal(operation.status, 'COMMITTED');
assert.equal(paidCalls, 0, 'a saved raw response must be parsed without another paid call');

context.nbaOperation_ = (_run, _kind, _event, value) => {
  if (value !== undefined) operation = value;
  return operation;
};
operation = null;
savedRaw = null;
const sequence = [];
context.nbaOperation_ = (_run, _kind, _event, value) => {
  if (value !== undefined) {operation = value; sequence.push(value.status);}
  return operation;
};
context.nbaRunFile_ = (_run, _kind, value) => {
  if (value !== undefined) {savedRaw = value; sequence.push('RAW_SAVED');}
  return savedRaw;
};
context.log_ = () => {};
context.logRequired_ = () => {};
context.oddsRequest_ = () => {
  paidCalls++;
  return {text: '{"id":"game-1"}', slot: {label: 'KEY 2'}, headers: {'x-requests-last': '5'}};
};
assert.equal(context.nbaPaidStep_(run, {warnings: []}, step, game), 'SUCCESS');
assert.equal(paidCalls, 1);
assert.deepEqual(sequence.slice(0, 3), ['INTENT', 'RAW_SAVED', 'RESPONSE_SAVED']);
assert.equal(operation.actual_credits, 5);

const artifacts = new Map();
const actualCompact = context.compactEventAnalysisPayload_;
const compact = actualCompact({snapshot_id: 'snap',game_markets: [],prop_markets: [
  {event_id: 'game-1',source_updated_utc: '2026-10-20T12:30:00Z',updated_utc: '2026-10-20T12:31:00Z'},
  {event_id: 'game-1',source_updated_utc: '2026-10-20T10:00:00Z',updated_utc: '2026-10-20T12:31:00Z'}
],alternate_prop_markets: [
  {event_id: 'game-1',source_updated_utc: '2026-10-20T10:00:00Z',updated_utc: '2026-10-20T12:31:00Z'}
]}, {event_id: 'game-1',home_team: 'Home',away_team: 'Away',kickoff_utc: '2026-10-20T23:00:00Z',odds: {actionable: false}},
'2026-10-20T13:00:00Z', {filename: 'audit.json',drive_url: 'https://drive.example/audit'});
assert.equal(compact.prop_markets.length, 1);
assert.equal(compact.alternate_prop_markets.length, 0,
  'a recent Sheet write must not revive an old alternate-market quote');
assert.equal(compact.data_quality.stale_prop_market_count, 1);
const savedRuns = [];
const publications = [];
const stagedState = {run_id: 'staged-12345678', state: 'RUNNING', stage: 'LOAD', cursor: 0,
  started_utc: '2026-10-20T13:00:00.000Z', cap: 10, include_alternates: false, signature: 'approved'};
const stagedJob = {games: [
  {id: 'game-1', matchup: 'A @ B', kickoff: '2027-10-20T23:00:00Z'},
  {id: 'game-2', matchup: 'C @ D', kickoff: '2027-10-20T23:00:00Z'}
], items: [{event_id: 'game-1', standard_credits: 5, alternate_credits: 0},
  {event_id: 'game-2', standard_credits: 5, alternate_credits: 0}],
load_status: {'game-1': {}, 'game-2': {}}, warnings: [], files: [], stop_paid: false};
context.nbaPaidStep_ = (_state, stagedJobValue, _step, selectedGame) => {
  if (selectedGame.id === 'game-1') return 'SUCCESS';
  stagedJobValue.warnings.push('Game 2 provider failed; Game 1 was preserved.');
  return 'FAILED';
};
context.nbaRunFile_ = (_run, kind, value) => {
  if (value !== undefined) artifacts.set(kind, value);
  return artifacts.get(kind) || null;
};
context.buildAnalysisExport_ = (games, timestamp) => ({
  export_timestamp_utc: timestamp, event_ids: games.map(g => g.id),
  games: games.map(g => ({event_id: g.id, matchup: g.matchup, kickoff_utc: g.kickoff})),
  provider_coverage_summary: 'Odds API only', data_quality: {warnings: []}
});
context.analysisSnapshotId_ = () => 'snapshot-1';
context.analysisExportFilename_ = () => 'audit.json';
context.compactAnalysisGameFilename_ = (_date, event) => `${event}.json`;
context.analysisManifestFilename_ = () => 'manifest.json';
context.compactEventAnalysisPayload_ = (_payload, g) => ({event_id: g.event_id, analysis_eligible: true});
context.nbaEnsureSnapshot_ = name => {
  artifacts.set(name, true);
  return {getUrl: () => `https://drive.example/${name}`, getId: () => name};
};
context.nbaRunCharges_ = () => [];
context.mobileExportReceipt_ = () => ({confirmed_credits: 0, total_charge_unconfirmed: false});
context.nbaOperation_ = () => null;
context.saveMobileLastExport_ = () => {
  assert.ok(artifacts.has('audit.json'));
  assert.ok(artifacts.has('game-1.json'));
  assert.ok(artifacts.has('game-2.json'));
  assert.ok(artifacts.has('manifest.json'));
  publications.push('LATEST');
};
context.saveMobileExportRun_ = (_id, runValue) => savedRuns.push(runValue.state);
context.mobileSaveAndNotifyExport_ = () => publications.push('EMAIL');
context.mobileFinishRun_ = () => publications.push('DONE');
let checkpoints = 0;
while (stagedState.state === 'RUNNING' && checkpoints++ < 20)
  context.nbaStageAdvance_(stagedState, stagedJob);
assert.equal(stagedState.state, 'PARTIAL');
assert.equal(stagedJob.load_status['game-1'].standard, 'SUCCESS');
assert.equal(stagedJob.load_status['game-2'].standard, 'FAILED');
assert.deepEqual(publications, ['LATEST', 'EMAIL', 'DONE']);
assert.deepEqual(savedRuns, ['SUCCEEDED', 'SUCCEEDED']);

let emailCount = 0;
let lastEmail;
context.Session = {getEffectiveUser: () => ({getEmail: () => 'owner@example.test'})};
context.MailApp = {sendEmail: message => {emailCount++; lastEmail = message;}};
properties.set('NBA_MOBILE_EMAIL_NOTIFICATIONS', 'true');
const receipt = {games: [{matchup: 'A @ B'}], receipt: {confirmed_credits: 5},
  exportTimestampUtc: '2026-10-20T13:00:00Z', driveUrl: 'https://drive.example/audit',
  analysisManifestDriveUrl: 'https://drive.example/manifest', warnings: []};
assert.equal(context.mobileExportEmailAttempt_('email-run-12345678', receipt).status, 'SENT');
assert.equal(context.mobileExportEmailAttempt_('email-run-12345678', receipt).status, 'SENT');
assert.equal(emailCount, 1, 'a completed run may send at most one email');
assert.equal(lastEmail.subject, 'NBA export ready · 1 game');
assert.match(lastEmail.body, /https:\/\/drive\.example\/manifest/);
assert.match(lastEmail.body, /Open NBA Game Prep: https:\/\/script\.google\.com\/macros\//);
properties.delete('NBA_MOBILE_EMAIL_NOTIFICATIONS');
assert.equal(context.mobileExportEmailAttempt_('disabled-run-12345678', receipt).status, 'DISABLED');
assert.equal(emailCount, 1);
properties.set('NBA_MOBILE_EMAIL_NOTIFICATIONS', 'true');
context.MailApp = {sendEmail: () => {emailCount++; throw Error('mock mail outage');}};
assert.equal(context.mobileExportEmailAttempt_('failed-run-12345678', receipt).status, 'FAILED');
assert.equal(context.mobileExportEmailAttempt_('failed-run-12345678', receipt).status, 'FAILED');
assert.equal(emailCount, 2, 'email failure must not trigger another send attempt');

const leasedState = {run_id: 'lease-12345678',state: 'RUNNING',lease_until_utc: new Date(Date.now() + 60000).toISOString()};
context.nbaStageState_ = () => leasedState;
assert.equal(context.continueNbaMobileLoad().status, 'LEASED');
assert.equal(paidCalls, 1, 'a second worker must not submit a paid request during another lease');

const approvedPlan = {event_ids: ['game-1'],selection_signature: '["game-1"]',
  force_refresh: false,include_alternate_props: false,max_total_odds_api_credits: 5,
  sports_game_odds: {max_returned_event_objects: 0}};
const savedSignature = context.mobileExportRunSignature_(approvedPlan);
context.run_ = (_label, action) => action();
context.mobileExportRun_ = () => ({state: 'STARTED',signature: savedSignature});
context.mobileOperationStatus = () => ({operation: {id: 'duplicate-12345678',state: 'RUNNING'}});
assert.equal(context.mobileLoadAndExport(approvedPlan, 'duplicate-12345678').reused_request_id, true);
assert.equal(paidCalls, 1, 'duplicate tap must not submit a second paid request');

context.mobileExportRun_ = () => null;
context.mobileAssertPlan_ = () => approvedPlan;
const actualMobileRunStatus = context.mobileRunStatus_;
context.mobileRunStatus_ = () => null;
context.nbaStageState_ = () => null;
context.ScriptApp.getProjectTriggers = () => {throw Error('mock missing trigger scope');};
assert.throws(() => context.mobileLoadAndExport(approvedPlan, 'new-run-12345678'),
  /background trigger access failed/);
assert.equal(paidCalls, 1, 'trigger authorization failure must precede any paid request');

const orphan = {run_id: 'orphan-12345678',state: 'RUNNING',stage: 'LOAD',cursor: 0,
  stage_attempts: 0,started_utc: '2026-10-20T13:00:00Z',signature: savedSignature};
let recoveredRun;
context.mobileRunStatus_ = actualMobileRunStatus;
context.nbaStageState_ = () => orphan;
context.nbaSaveStageState_ = () => {};
context.saveMobileExportRun_ = (_id, value) => {recoveredRun = value;};
const runStatusKey = vm.runInContext('MOBILE_RUN_STATUS_PROPERTY', context);
properties.set(runStatusKey, JSON.stringify({id: orphan.run_id,state: 'RUNNING',action: 'load_and_export',
  started_utc: orphan.started_utc,updated_utc: orphan.started_utc}));
assert.equal(context.mobileRunStatus_().state, 'FAILED');
assert.equal(orphan.state, 'FAILED');
assert.equal(recoveredRun.state, 'FAILED');
assert.equal(paidCalls, 1, 'an unclaimed queued run must fail cleanly without a paid retry');

assert.match(source, /\.atHour\(9\)\.nearMinute\(0\)\.everyDays\(1\)\.inTimezone\('America\/New_York'\)/);
assert.match(source, /const SPORTS_GAME_ODDS_NBA_ENABLED = false;/);
assert.match(source, /subject:'NBA export ready · '/);
assert.match(source, /analysisManifestDriveUrl/);
assert.match(mobile, /id="daily-games-status"/);
assert.match(mobile, /Refresh games — free/);
assert.match(mobile, /Refresh game odds — 3 credits/);
assert.match(mobile, /mobileOperationStatus\(id\)/);
assert.match(mobile, /if\(stopWaitingForMissingRun\(status,id\)\)return;state\.statusMissingCount\+\+;if\(state\.statusMissingCount>=45\)/);
assert.match(mobile, /forgetRunId\(\);stopOperationTimers\(\);loadDashboard\(\)/);
assert.match(mobile, /function researchWorkflow_\(\).*offense-versus-defense and coaching case/);
assert.match(mobile, /Unders are exceptional, not banned/);
assert.match(mobile, /Return five distinct classified candidates per eligible game where available/);
assert.match(mobile, /Share to ChatGPT/);
assert.match(mobile, /Share to Claude/);
assert.match(mobile, /Share to Perplexity/);

const promptStart = mobile.indexOf('function researchWorkflow_()');
const promptEnd = mobile.indexOf('function copyRequest(', promptStart);
assert.ok(promptStart >= 0 && promptEnd > promptStart);
const promptContext = vm.createContext({APP_BUILD: '2026.10.20-nba-shared.1'});
vm.runInContext(mobile.slice(promptStart, promptEnd), promptContext);
const handoff = {filename: 'audit.json',driveUrl: 'https://drive.example/audit',
  analysisManifestFilename: 'manifest.json',analysisManifestDriveUrl: 'https://drive.example/manifest',
  exportTimestampUtc: '2026-10-20T13:00:00Z',eventIds: ['game-1','game-2'],
  providerCoverageSummary: 'DraftKings only'};
for (const destination of ['analysisRequest','claudeRequest','perplexityRequest']) {
  const request = promptContext[destination](handoff);
  assert.match(request, /manifest\.json/);
  assert.match(request, /https:\/\/drive\.example\/manifest/);
  assert.match(request, /game-1, game-2/);
  assert.match(request, /2026-10-20T13:00:00Z/);
  assert.match(request, /defens|coaching/i);
  assert.match(request, /Unders are exceptional/);
  assert.ok(!request.includes('NBA_ODDS_API_KEY_'));
}

console.log('NBA daily refresh, uncertain-call recovery, raw-response ordering, and handoff checks passed');
