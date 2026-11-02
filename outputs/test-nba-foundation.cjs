const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'NbaOddsLoader.gs'), 'utf8');
const mobile = fs.readFileSync(path.join(__dirname, 'Mobile.html'), 'utf8');

function between(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'expected source section was not found');
  return text.slice(from, to);
}

assert.match(source, /const SPORT = 'basketball_nba';/);
assert.match(source, /const SGO_LEAGUE = 'NBA';/);
assert.match(source, /const MOBILE_SPREADSHEET_ID_PROPERTY = 'NBA_MOBILE_SPREADSHEET_ID';/);
assert.match(source, /const KEY_POOL_PROPERTY_PREFIX = 'NBA_ODDS_API_KEY_';/);
assert.match(source, /const KEY_POOL_MAX_SLOTS = 8;/);
assert.match(source, /'player_points'/);
assert.match(source, /'player_rebounds'/);
assert.match(source, /'player_assists'/);
assert.match(source, /'player_threes'/);
assert.match(source, /'player_points_rebounds_assists'/);
assert.match(source, /'player_points_alternate'/);
assert.match(source, /'player_threes_alternate'/);
assert.ok(!source.includes("const SPORT = 'americanfootball_nfl'"));
assert.ok(!source.includes('NFL_MOBILE_SPREADSHEET_ID'));
assert.match(source, /const SPORTS_GAME_ODDS_NBA_ENABLED = false;/);
assert.match(source, /DISABLED_PENDING_COVERAGE_TEST/);
assert.ok(!between(source, 'function mobileLoadAndExport', 'function safeError_').includes('fetchRoster_'));
assert.ok(!between(source, 'function loadCheckedProps', 'function gameLines_').includes('fetchRoster_'));

const keySave = between(source, 'function mobileSaveApiKey', 'function nbaLegacySaveApiKey_');
assert.match(keySave, /Manage keys in the owner dashboard/);
assert.doesNotMatch(keySave, /setProperty|log_|request_/);
assert.match(source, /function nbaSharedCall_/);

assert.match(mobile, /var APP_BUILD='2026\.11\.02-nba-candidates\.2';/);
const activeSettings = between(mobile, 'function renderCreditPool(pool){', "byId('settings').onclick");
assert.match(activeSettings, /same owner-managed key pool as NFL and Friends/);
assert.doesNotMatch(activeSettings, /Add key|Replace key|mobileSaveApiKey|window\.prompt/);
assert.match(mobile, /NBA Tools/);
assert.ok(!mobile.includes('NFL_MOBILE_ES5'));
assert.match(mobile, /Points, rebounds, assists, threes, and PRA/);

console.log('NBA foundation checks passed');
