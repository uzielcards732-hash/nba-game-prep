const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const properties = new Map();
let held = false;
const lock = {hasLock: () => held, tryLock: () => {held = true; return true;}, releaseLock: () => {held = false;}};
const context = vm.createContext({
  console: {log: () => {}},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value)
  })},
  LockService: {getScriptLock: () => lock},
  ScriptApp: {AuthMode: {FULL: 'FULL'}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'NbaOddsLoader.gs'), 'utf8'), context);
context.now_ = () => '2026-10-21T00:30:00Z';
let reads = 0;
const consent = new Error('consent required');
context.ScriptApp.requireScopes = (_mode, scopes) => {
  assert.deepEqual(Array.from(scopes), ['https://www.googleapis.com/auth/script.scriptapp']);
  throw consent;
};
context.ScriptApp.getProjectTriggers = () => {reads++; return [];};
assert.throws(() => context.authorizeNbaBackgroundLoading(), error => error === consent);
assert.equal(reads, 0, 'the consent signal must escape before trigger access');

let stage = {run_id: 'failed-run', state: 'RUNNING', stage: 'LOAD', cursor: 0, stage_attempts: 0};
let saved = {state: 'FAILED', message: 'startup failed'};
context.nbaStageState_ = () => stage;
context.mobileExportRun_ = () => saved;
context.nbaSaveStageState_ = value => {stage = value;};
context.ScriptApp.requireScopes = () => {};
assert.equal(context.authorizeNbaBackgroundLoading().status, 'READY');
assert.equal(stage.state, 'FAILED');
assert.equal(stage.message, 'startup failed');
stage = {...stage, state: 'RUNNING', stage_attempts: 1};
assert.equal(context.nbaReconcileUnstartedRun_().state, 'RUNNING', 'a claimed run must retain its recovery state');
stage = {...stage, stage_attempts: 0}; saved = {state: 'STARTED'};
assert.equal(context.nbaReconcileUnstartedRun_().state, 'RUNNING', 'an accepted run must not be cancelled');

let deleted = 0;
const trigger = {getUniqueId: () => 'probe-id', getHandlerFunction: () => 'nbaBackgroundTriggerProbe'};
context.ScriptApp.getProjectTriggers = () => [];
context.ScriptApp.newTrigger = handler => {
  assert.equal(handler, 'nbaBackgroundTriggerProbe');
  return {timeBased: () => ({after: delay => {
    assert.equal(delay, 60000); return {create: () => trigger};
  }})};
};
assert.equal(context.verifyNbaBackgroundLoading().status, 'PENDING');
context.ScriptApp.getProjectTriggers = () => [trigger];
context.ScriptApp.deleteTrigger = value => {assert.equal(value, trigger); deleted++;};
context.nbaBackgroundTriggerProbe({triggerUid: 'different-id'});
assert.equal(context.nbaBackgroundTriggerCheckStatus().status, 'PENDING');
context.nbaBackgroundTriggerProbe({triggerUid: 'probe-id'});
assert.equal(context.nbaBackgroundTriggerCheckStatus().status, 'SUCCEEDED');
assert.equal(context.nbaBackgroundTriggerCheckStatus().provider_calls, 0);
assert.equal(deleted, 1, 'the successful probe removes its own trigger');
context.nbaBackgroundTriggerProbe({triggerUid: 'probe-id'});
assert.equal(deleted, 1, 'replayed probe is a no-op');
console.log('PASS NBA consent propagation, safe orphan reconciliation, and zero-provider background probe');
