const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'NbaOddsLoader.gs'), 'utf8');
const mobile = fs.readFileSync(path.join(__dirname, 'Mobile.html'), 'utf8');

for (const market of ['player_points','player_rebounds','player_assists','player_threes','player_points_rebounds_assists']) {
  assert.match(source, new RegExp("'" + market + "'"));
  assert.match(source, new RegExp("'" + market + "_alternate'"));
}
assert.match(source, /max_prop_credits:toLoad\.length\*PROP_MARKETS\.length/);
assert.match(source, /max_alternate_prop_credits:alternateToLoad\.length\*MOBILE_ALTERNATE_MARKETS\.length/);
assert.match(source, /DISABLED_PENDING_COVERAGE_TEST/);
assert.ok(!source.slice(source.indexOf('function mobileLoadAndExport'), source.indexOf('function safeError_')).includes('fetchRoster_'));
assert.match(source, /league:'NBA',sport:SPORT/);
assert.match(mobile, /Analyze this NBA slate/);
assert.match(mobile, /minutes, rotation and usage/);
assert.match(mobile, /Points, rebounds, assists, threes, and PRA/);
assert.match(mobile, /same owner-managed key pool as NFL and Friends/);
assert.doesNotMatch(mobile.split('function renderCreditPool(pool){')[1].split("byId('settings').onclick")[0], /mobileSaveApiKey|window\.prompt/);
assert.match(mobile, /Use Perplexity Research.*NBA game\(s\)/);
assert.ok(!mobile.includes('SportsGameOdds coverage is limited to passing and receiving yards'));
assert.match(mobile, /class="basketball-mark"/);
assert.match(mobile, /<circle cx="16" cy="16" r="11\.5"/);
assert.ok(!mobile.includes('NFL_MOBILE_ES5'));
console.log('NBA workflow checks passed');
