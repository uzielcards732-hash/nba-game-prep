'use strict';
// Phase 3 usage context: last five team games per prop player from the free
// hoopR box score file, plus team rest and back-to-back flags. Offline,
// mock-only: no network, no credentials, zero Odds API credits.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const m=require('./nba-mock-env.cjs');
const mobile=fs.readFileSync(path.join(__dirname,'Mobile.html'),'utf8');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n').slice(0,process.env.VERBOSE?12:2).join(' | '));}}
const plain=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
const URL='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_player_boxscores/player_box_2027.csv';
const COLS=['game_id','season','game_date','athlete_id','athlete_display_name','team_display_name','team_abbreviation','opponent_team_abbreviation','home_away','minutes','field_goals_attempted','three_point_field_goals_made','three_point_field_goals_attempted','free_throws_attempted','offensive_rebounds','defensive_rebounds','rebounds','assists','turnovers','points','starter','did_not_play','reason','team_logo'];
// Export clock 2026-11-02 20:00Z; both games tip 23:00Z = Nov 2 Eastern.
// Celtics (BOS) games: Oct 25, Oct 27, Oct 29, Oct 30, Oct 31, Nov 1 (six games;
// the last five are shown). Knicks (NY): Oct 28, Oct 30 only.
// Player One event1 (BOS) plays every game except Oct 30 (DNP, rest).
// Each BOS game has Player One plus a teammate so team totals are known.
function row(o){const r={season:'2027',home_away:'home',started:'',team_logo:'https://x/y.png, with comma',reason:'',did_not_play:'false',starter:'true',offensive_rebounds:'1',defensive_rebounds:'5',three_point_field_goals_made:'2',three_point_field_goals_attempted:'6',turnovers:'2'};Object.assign(r,o);return COLS.map(c=>{const v=String(r[c]===undefined?'':r[c]);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}
function boxCsv(extra){
 const lines=[COLS.join(',')];
 const bos=['2026-10-25','2026-10-27','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
 bos.forEach((d,i)=>{
  const id='bos'+i,team={team_display_name:'Boston Celtics',team_abbreviation:'BOS',opponent_team_abbreviation:'OPP'+i,game_id:id,game_date:d};
  if(d==='2026-10-30')lines.push(row(Object.assign({},team,{athlete_id:'1',athlete_display_name:'Player One event1',did_not_play:'true',reason:'REST',minutes:'',field_goals_attempted:'',free_throws_attempted:'',rebounds:'',assists:'',points:'',turnovers:'',starter:'false'})));
  else lines.push(row(Object.assign({},team,{athlete_id:'1',athlete_display_name:'Player One event1',minutes:'30',field_goals_attempted:'20',free_throws_attempted:'5',rebounds:'6',assists:'4',points:'25'})));
  lines.push(row(Object.assign({},team,{athlete_id:'9',athlete_display_name:'Teammate',minutes:'210',field_goals_attempted:'60',free_throws_attempted:'15',turnovers:'10',rebounds:'34',assists:'16',points:'80',starter:'false'})));
 });
 ['2026-10-28','2026-10-30'].forEach((d,i)=>lines.push(row({game_id:'ny'+i,game_date:d,team_display_name:'New York Knicks',team_abbreviation:'NY',opponent_team_abbreviation:'X',athlete_id:'2',athlete_display_name:'Player Two event1',minutes:'35',field_goals_attempted:'15',free_throws_attempted:'4',rebounds:'10',assists:'7',points:'22'})));
 (extra||[]).forEach(o=>lines.push(row(o)));
 return lines.join('\n')+'\n';
}
function setup(extra){const env=m.makeEnv();const games=m.defaultGames(env).slice(0,1);m.seedIndex(env,games);env.web.set(URL,{body:boxCsv(extra)});return {env,game:games[0]};}
function loadAndExport(env,game){env.responses.push({body:m.standardEvent(env,game),headers:m.okHeaders(5)});m.startLoad(env,false,'req-usage-'+Math.random().toString(36).slice(2,10));return m.runWorker(env);}
function exported(env){return plain(env.run('buildAnalysisExport_(requireGames_(),now_(),null)'));}
const usageFor=(env)=>exported(env).usage_context.event1;

test('usage comes from one free box score download, with no Odds API calls',()=>{
 const {env,game}=setup();env.sheet('PROPS');loadAndExport(env,game);
 assert.equal(env.fetches.length,1,'only the one paid props request');assert.deepEqual(env.webFetches,[URL]);
 const u=lastUsage(env);assert.equal(u.status,'OK');assert.equal(u.source.url,URL);assert.equal(u.source.season,2027);assert.equal(u.source.last_game_date_in_file,'2026-11-01');
});
function lastUsage(env){const latest=JSON.parse(env.props.get('NBA_MOBILE_LAST_EXPORT'));const audit=[...env.files.values()].find(f=>f.name===latest.filename);return JSON.parse(audit.text).usage_context.event1;}
test('the last five team games before tipoff are shown game by game, newest first, with a rest day as DID_NOT_PLAY',()=>{
 const {env,game}=setup();loadAndExport(env,game);const p=usageFor(env).players.find(x=>x.player==='Player One event1');
 assert.equal(p.team_abbreviation,'BOS');assert.equal(p.team_games_shown,5);assert.equal(p.games_played,4);
 assert.deepEqual(p.games.map(g=>g.date),['2026-11-01','2026-10-31','2026-10-30','2026-10-29','2026-10-27']);
 assert.deepEqual(p.games[2],{date:'2026-10-30',opponent:'OPP3',home_away:'home',status:'DID_NOT_PLAY',reason:'REST'});
});
test('numbers match the box score exactly; usage and shares are box score arithmetic',()=>{
 const {env,game}=setup();loadAndExport(env,game);const g=usageFor(env).players.find(x=>x.player==='Player One event1').games[0];
 assert.equal(g.minutes,30);assert.equal(g.points,25);assert.equal(g.rebounds,6);assert.equal(g.assists,4);assert.equal(g.threes_made,2);assert.equal(g.threes_attempted,6);assert.equal(g.started,true);
 // Team: minutes 30+210 = 240; FGA 20+60 = 80; FTA 5+15 = 20; TOV 2+10 = 12.
 // Usage = 100 x (20 + 0.44x5 + 2) x (240/5) / (30 x (80 + 0.44x20 + 12)) = 100 x 24.2 x 48 / (30 x 100.8) = 38.4
 assert.equal(g.usage_rate_pct,38.4);
 // Rebound share 6 / (6+34) = 15.0%; assist share 4 / (4+16) = 20.0%.
 assert.equal(g.team_rebound_share_pct,15);assert.equal(g.team_assist_share_pct,20);
});
test('rest and back-to-back flags come from each team\'s last game before tipoff',()=>{
 const {env,game}=setup();loadAndExport(env,game);const r=usageFor(env).rest;
 // BOS last played Nov 1, tipoff Nov 2: 0 rest days, back to back. Games within 7 days: Oct 27 to Nov 1 = 5.
 assert.deepEqual({d:r.home.last_game_date,rest:r.home.rest_days,b2b:r.home.back_to_back,n:r.home.games_in_last_7_days,abbr:r.home.abbreviation},{d:'2026-11-01',rest:0,b2b:true,n:5,abbr:'BOS'});
 // NY last played Oct 30: Oct 31 and Nov 1 off = 2 rest days.
 assert.equal(r.away.last_game_date,'2026-10-30');assert.equal(r.away.rest_days,2);assert.equal(r.away.back_to_back,false);
});
test('players with no box score rows, or only on another team, are listed as not found, never guessed',()=>{
 const {env,game}=setup([{game_id:'z1',game_date:'2026-10-29',team_display_name:'Utah Jazz',team_abbreviation:'UTA',opponent_team_abbreviation:'X',athlete_id:'77',athlete_display_name:'Player Two event1 Other',minutes:'10',points:'2'}]);
 loadAndExport(env,game);const u=usageFor(env);
 // The standard fixture lists Player One and Player Two; Player Two exists for NY (an away team row).
 assert.ok(u.players.some(p=>p.player==='Player Two event1'&&p.team_abbreviation==='NY'));
 const lonely=plain(env.run("nbaPlayerUsage_(nbaLoadBoxScores_(2027),'Nobody Here',['Boston Celtics','New York Knicks'],'2026-11-02')"));assert.deepEqual(lonely.not_found,{player:'Nobody Here',reason:'NO_BOX_SCORE_ROWS'});
 const elsewhere=plain(env.run("nbaPlayerUsage_(nbaLoadBoxScores_(2027),'Player Two event1 Other',['Boston Celtics','New York Knicks'],'2026-11-02')"));assert.equal(elsewhere.not_found.reason,'ONLY_FOUND_ON_ANOTHER_TEAM');
});
test('two players with the same name on the two teams are not merged',()=>{
 const {env}=setup([{game_id:'ny9',game_date:'2026-10-31',team_display_name:'New York Knicks',team_abbreviation:'NY',opponent_team_abbreviation:'X',athlete_id:'55',athlete_display_name:'Player One event1',minutes:'5',points:'1'}]);
 const r=plain(env.run("nbaPlayerUsage_(nbaLoadBoxScores_(2027),'Player One event1',['Boston Celtics','New York Knicks'],'2026-11-02')"));assert.equal(r.not_found.reason,'SAME_NAME_ON_BOTH_TEAMS');
});
test('a traded player shows only his current team\'s games and lists the earlier team',()=>{
 const {env}=setup([{game_id:'mia1',game_date:'2026-10-24',team_display_name:'Miami Heat',team_abbreviation:'MIA',opponent_team_abbreviation:'X',athlete_id:'1',athlete_display_name:'Player One event1',minutes:'20',points:'10'}]);
 const r=plain(env.run("nbaPlayerUsage_(nbaLoadBoxScores_(2027),'Player One event1',['Boston Celtics','New York Knicks'],'2026-11-02')")).player;
 assert.deepEqual(r.earlier_teams_this_season,['Miami Heat']);assert.ok(r.games.every(g=>g.opponent!=='X'));
});
test('a download failure marks usage UNAVAILABLE and the paid load and export still finish',()=>{
 const {env,game}=setup();env.web.set(URL,{throws:'Address unavailable: '+URL});const state=loadAndExport(env,game);
 assert.notEqual(state.state,'FAILED');const u=lastUsage(env);assert.equal(u.status,'UNAVAILABLE');assert.match(u.note,/never a reason to pass/);
 assert.equal(env.fetches.length,1);assert.equal(env.webFetches.length,3,'free download: bounded 3 attempts, never a paid retry');
});
test('a file that has fallen behind is flagged SOURCE_BEHIND',()=>{
 const {env,game}=setup();env.setNow('2026-11-05T20:00:00.000Z');m.seedIndex(env,[Object.assign({},game,{kickoff:'2026-11-05T23:00:00.000Z'})]);
 assert.match(usageFor(env).source_freshness,/^SOURCE_BEHIND: the file ends 2026-11-01/);
});
test('the season is named by its end year: October 2026 is 2027, March 2027 is 2027',()=>{
 const {env}=setup();assert.equal(env.run("nbaSeasonEndYear_(Date.parse('2026-10-20T12:00:00Z'))"),2027);assert.equal(env.run("nbaSeasonEndYear_(Date.parse('2027-03-01T12:00:00Z'))"),2027);assert.equal(env.run("nbaSeasonEndYear_(Date.parse('2027-07-01T12:00:00Z'))"),2027);
});
test('each compact game file carries its own usage_context and the instructions',()=>{
 const {env,game}=setup();loadAndExport(env,game);const latest=JSON.parse(env.props.get('NBA_MOBILE_LAST_EXPORT'));
 const compact=[...env.files.values()].find(f=>f.name.includes('event1')&&f.text.includes('nba_compact_game_analysis'));const c=JSON.parse(compact.text);
 assert.equal(c.usage_context.status,'OK');assert.ok(c.usage_context.players.length>=1);assert.match(c.usage_instructions,/not a projection/);assert.ok(latest);
});
test('no usage field is an average, rate per minute, projection or expected value',()=>{
 const {env,game}=setup();loadAndExport(env,game);const keys=new Set();const walk=v=>{if(v&&typeof v==='object')Object.keys(v).forEach(k=>{keys.add(k);walk(v[k]);});};walk(usageFor(env));
 [...keys].forEach(k=>assert.doesNotMatch(k,/avg|average|mean|per_minute|per_36|project|expect|forecast|predict/i,k));
});
test('handoffs explain usage_context as history to verify, not a projection',()=>{
 assert.match(mobile,/usage_context gives each prop player\\'s last five team games from box scores/);assert.match(mobile,/never average it into an expected number/);
 const {env}=setup();assert.match(env.run('usageInstructions_()'),/never a reason to pass/);
});
console.log('\n'+count+' passed, '+failures.length+' failed (NBA Phase 3 usage context; offline, mock-only, zero provider credits).');
if(failures.length)process.exitCode=1;
