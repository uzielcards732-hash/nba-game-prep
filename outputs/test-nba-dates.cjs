const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {formatDate} = require('./nba-test-dates.cjs');
const source = fs.readFileSync(path.join(__dirname, 'NbaOddsLoader.gs'), 'utf8');
const mobile = fs.readFileSync(path.join(__dirname, 'Mobile.html'), 'utf8');
const now = Date.parse('2026-10-21T00:00:00Z');
class FixedDate extends Date {static now() {return now;}}
const server = vm.createContext({Date: FixedDate, Utilities: {formatDate}});
vm.runInContext(source, server);
assert.equal(server.nbaGameTime_('2026-10-21T00:30:00Z', now).full_label, 'Tue, Oct 20 · 8:30 PM ET');
assert.equal(server.nbaGameTime_('2026-10-21T03:59:00Z', now).date_key, '2026-10-20');
assert.equal(server.nbaGameTime_('2026-10-21T04:00:00Z', now).group_label, 'Tomorrow · Wed, Oct 21');
assert.equal(server.nbaGameTime_('2026-10-19T23:00:00Z', now).group_label, 'Past · Mon, Oct 19');
assert.equal(server.nbaGameTime_('2026-03-08T06:30:00Z', now).time_label, '1:30 AM ET');
assert.equal(server.nbaGameTime_('2026-03-08T07:30:00Z', now).time_label, '3:30 AM ET');
assert.equal(server.nbaGameTime_('2026-11-01T05:30:00Z', now).time_label, '1:30 AM ET');
assert.equal(server.nbaGameTime_('2026-11-01T06:30:00Z', now).time_label, '1:30 AM ET');
assert.equal(server.nbaGameTime_('', now).date_key, 'unknown');

const shape = vm.runInContext('({width:INDEX_HEADERS.length+INDEX_EXTRA.length,idx:IDX})', server);
function row(id, tipoff) {
  const value = Array(shape.width).fill(''), idx = shape.idx;
  value[idx.EVENT] = id; value[idx.MATCHUP] = id + ' away @ ' + id + ' home';
  value[idx.AWAY] = id + ' away'; value[idx.HOME] = id + ' home'; value[idx.KICKOFF] = tipoff;
  // These are the bad display cells that caused the previous UI failure.
  value[2] = new Date('2026-10-20T00:00:00Z'); value[idx.SLATE] = new Date('2026-10-21T00:00:00Z');
  return value;
}
const rows = [row('tomorrow', '2026-10-21T23:00:00Z'), row('late', '2026-10-21T02:00:00Z'),
  row('past', '2026-10-19T23:00:00Z'), row('tonight', '2026-10-21T00:30:00Z')];
server.mobileIndexTable_ = () => rows;
server.mobileLastExport_ = server.mobileRunStatus_ = () => null;
server.nbaDailyGamesStatus_ = () => ({});
server.nbaGameOddsFresh_ = () => ({fresh: false, reason: 'MISSING'});
const dashboard = server.mobileDashboard();
assert.deepEqual(Array.from(dashboard.games, game => game.event_id), ['past', 'tonight', 'late', 'tomorrow']);
assert.equal(dashboard.games[1].game_day_label, 'Today · Tue, Oct 20');
assert.equal(dashboard.games[1].kickoff_et, 'Tue, Oct 20 · 8:30 PM ET');
assert.equal(dashboard.games[1].kickoff_utc, '2026-10-21T00:30:00Z');
assert.equal(dashboard.games[2].game_date_et, '2026-10-20');
assert.equal(dashboard.games[0].game_state, 'STARTED');

function element() {
  return {innerHTML: '', textContent: '', getElementsByTagName(tag) {
    if(this.cachedHtml===this.innerHTML&&this.cachedTag===tag)return this.cachedElements;
    const found = [], regex = new RegExp('<' + tag + '\\b([^>]*)>', 'g'); let match;
    while ((match = regex.exec(this.innerHTML))) {
      const attrs = match[1], data = {};
      for (const attr of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) data[attr[1]] = attr[2];
      found.push({checked: /\bchecked\b/.test(attrs), getAttribute: key => data[key] || null});
    }
    this.cachedHtml=this.innerHTML;this.cachedTag=tag;this.cachedElements=found;return found;
  }};
}
const elements = {}, client = vm.createContext({Intl, Date, isFinite,
  byId: id => elements[id] || (elements[id] = element()),
  state: {games: JSON.parse(JSON.stringify(dashboard.games)), slate: ''},
  review: () => {}, refreshGamesFree: () => {}, refresh: () => {},
  selected: () => client.state.games.filter(game => game.selected).map(game => game.event_id)
});
vm.runInContext(mobile.slice(mobile.indexOf('function text('), mobile.indexOf('function setStatus(')), client);
vm.runInContext(mobile.slice(mobile.indexOf('function gameDayKey('), mobile.indexOf('function fail(')), client);
client.renderGames();
assert.equal(client.state.slate, '2026-10-20', 'default is the next upcoming game day');
assert.match(elements.tabs.innerHTML, /Today · Tue, Oct 20/);
assert.match(elements.games.innerHTML, /8:30 PM ET/);
assert.match(elements.games.innerHTML, /10:00 PM ET/);
assert.doesNotMatch(elements.games.innerHTML, /GMT|T00:30:00|Mon Oct/);
let buttons = elements.tabs.getElementsByTagName('button');
buttons.find(button => button.getAttribute('data-slate') === '2026-10-21').onclick.call(
  buttons.find(button => button.getAttribute('data-slate') === '2026-10-21'));
assert.equal(client.selectedGames().length, 1);
assert.equal(client.selectedGames()[0].event_id, 'tomorrow');
elements['select-slate'].onclick();
assert.deepEqual(client.state.games.filter(game => game.selected).map(game => game.event_id), ['tomorrow']);
assert.match(elements.games.innerHTML, /Wed, Oct 21 · 7:00 PM ET/);
assert.equal(client.formatEasternStamp('2026-10-21T00:30:00Z').includes('8:30 PM'), true);
assert.equal(client.formatEasternStamp('bad'), 'Time unavailable');
console.log('PASS NBA Eastern grouping, UTC midnight, DST, corrupted Sheet labels, and actual day selection');
