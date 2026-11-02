'use strict';
// Phase 3 candidate log and free grading. Offline, mock-only: no network, no
// credentials, zero Odds API credits for logging and grading.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const m=require('./nba-mock-env.cjs');
const mobile=fs.readFileSync(path.join(__dirname,'Mobile.html'),'utf8');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n').slice(0,process.env.VERBOSE?12:2).join(' | '));}}
const plain=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
const URL='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_player_boxscores/player_box_2027.csv';
const COLS=['team_score','game_id','game_date','athlete_id','athlete_display_name','team_display_name','team_abbreviation','opponent_team_abbreviation','home_away','minutes','field_goals_attempted','three_point_field_goals_made','three_point_field_goals_attempted','free_throws_attempted','offensive_rebounds','defensive_rebounds','rebounds','assists','turnovers','points','starter','did_not_play','reason'];
const HOME='Boston Celtics',AWAY='New York Knicks',P1='Player One event1',P2='Player Two event1';
function csv(rows){return [COLS.join(',')].concat(rows.map(o=>COLS.map(c=>String(o[c]===undefined?'':o[c])).join(','))).join('\n')+'\n';}
const stat=o=>Object.assign({minutes:'30',field_goals_attempted:'15',three_point_field_goals_made:'1',three_point_field_goals_attempted:'4',free_throws_attempted:'3',offensive_rebounds:'1',defensive_rebounds:'4',rebounds:'5',assists:'3',turnovers:'2',points:'18',starter:'true',did_not_play:'false',reason:''},o);
const bos=(o)=>stat(Object.assign({team_display_name:HOME,team_abbreviation:'BOS',opponent_team_abbreviation:'NY',home_away:'home'},o));
const ny=(o)=>stat(Object.assign({team_display_name:AWAY,team_abbreviation:'NY',opponent_team_abbreviation:'BOS',home_away:'away'},o));
// Before tipoff the file has one earlier game per team (for usage and teams).
const EARLIER=[bos({game_id:'g0',game_date:'2026-10-31',team_score:'100',athlete_id:'1',athlete_display_name:P1}),ny({game_id:'g0b',game_date:'2026-10-31',team_score:'99',athlete_id:'2',athlete_display_name:P2})];
// Final, Nov 2: Celtics 112, Knicks 105. Player One 25 pts, 6 reb, 4 ast (PRA 35).
// Player Two 7 ast, 2 threes. Bench Guy did not play.
function finalRows(extra){return EARLIER.concat([
 bos({game_id:'g1',game_date:'2026-11-02',team_score:'112',athlete_id:'1',athlete_display_name:P1,points:'25',rebounds:'6',assists:'4'}),
 ny({game_id:'g1',game_date:'2026-11-02',team_score:'105',athlete_id:'2',athlete_display_name:P2,assists:'7',three_point_field_goals_made:'2'}),
 ny({game_id:'g1',game_date:'2026-11-02',team_score:'105',athlete_id:'3',athlete_display_name:'Bench Guy',did_not_play:'true',reason:'COACH DECISION',minutes:'',points:'',rebounds:'',assists:'',three_point_field_goals_made:''})],extra||[]);}

function seedFreshLines(env){
 const idx=env.run('IDX'),row=env.sheet('INDEX').data[1],t=new Date(env.now()).toISOString();
 row[3]=HOME;row[4]=-3.5;row[5]=220.5;row[6]=-150;row[7]=130;row[idx.HOME_SPREAD_PRICE]=-110;row[idx.AWAY_SPREAD_PRICE]=-110;row[idx.TOTAL_OVER_PRICE]=-110;row[idx.TOTAL_UNDER_PRICE]=-110;
 row[idx.LINES_UPDATED]=t;row[idx.LINES_SOURCE]=JSON.stringify({h2h:t,spreads:t,totals:t});row[idx.BOOK]='draftkings';
}
function setup(){
 const env=m.makeEnv();const game=m.defaultGames(env)[0];game.home=HOME;game.away=AWAY;m.seedIndex(env,[game]);seedFreshLines(env);
 env.web.set(URL,{body:csv(EARLIER)});
 // Standard props plus one alternate rung (Player One points 25.5 at +180).
 env.responses.push({body:m.standardEvent(env,game),headers:m.okHeaders(5)},{body:m.alternateEvent(env,game),headers:m.okHeaders(5)});
 env.context.__plan=env.run('mobilePropsPlan_(false,true)');env.run("mobileLoadAndExport(__plan,'req-cand-aaaa')");m.runWorker(env);
 const latest=JSON.parse(env.props.get('NBA_MOBILE_LAST_EXPORT'));
 return {env,game,snapshot:latest.snapshot_id,latest};
}
function rows(snapshot){return [
 {event_id:'event1',market_key:'player_points',subject:P1,side:'Over',line:20.5,price:-110,book:'draftkings',classification:'RECOMMENDED',condition:'',reason:'Starter minutes.'},
 {event_id:'event1',market_key:'player_rebounds',subject:P1,side:'Under',line:7.5,price:-110,book:'draftkings',classification:'WATCHLIST',condition:'',reason:'Rebound share.'},
 {event_id:'event1',market_key:'player_assists',subject:P2,side:'Over',line:5.5,price:-110,book:'draftkings',classification:'CONDITIONAL',condition:'Starts at point guard',reason:'Assist role.'},
 {event_id:'event1',market_key:'player_points_rebounds_assists',subject:P1,side:'Over',line:32.5,price:-110,book:'draftkings',classification:'RECOMMENDED',condition:'',reason:'Volume.'},
 {event_id:'event1',market_key:'h2h',subject:HOME,side:HOME,line:null,price:-150,book:'draftkings',classification:'PASS',condition:'',reason:'Price too short.'}];}
function answer(snapshot,list,notes,opts){opts=opts||{};const block={block:'NBA_CANDIDATES_V1',snapshot_id:snapshot,rows:list||rows(snapshot),game_notes:notes||[]};const json=JSON.stringify(block,null,opts.compact?0:2);
 return opts.bare?'Report text.\n'+json:'## Report\nThe NBA_CANDIDATES_V1 block follows.\n```NBA_CANDIDATES_V1\n'+json+'\n```\n';}
const imp=(env,text)=>plain(env.run('mobileImportCandidates('+JSON.stringify(text)+')'));
const candidates=env=>env.tab('CANDIDATES');
function grade(env,boxRows){env.web.set(URL,{body:csv(boxRows||finalRows())});env.setNow('2026-11-03T06:00:00.000Z');return plain(env.run('mobileGradeCandidates()'));}
function results(env){const out={};env.tab('CANDIDATE_RESULTS').forEach(r=>{out[r[0]+'|'+r[1]]=r;});const byKey={};candidates(env).forEach(c=>{const r=out[c[0]+'|'+c[1]];if(r)byKey[c[7]+'|'+c[8]+'|'+c[10]+'|'+c[11]]=r;});return byKey;}

test('a valid block saves five rows with exact quotes, team, tipoff and PRE_KICKOFF timing; no Odds API call',()=>{
 const {env,snapshot}=setup();assert.match(snapshot,/^[0-9]{8,}-req-cand-aaaa$/);const before=env.fetches.length;
 const r=imp(env,answer(snapshot));assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.saved,5);assert.equal(env.fetches.length,before);
 const c=candidates(env),pts=c.find(x=>x[7]==='player_points');assert.equal(c.length,5);
 assert.deepEqual([pts[3],pts[4],pts[8],pts[9],pts[10],pts[11],pts[12],pts[14],pts[18],pts[23],pts[24]],[snapshot,'event1',P1,'BOS','Over',20.5,-110,'RECOMMENDED','PRE_KICKOFF',HOME,AWAY]);
});
test('re-importing the identical block saves nothing; a changed classification saves one linked revision',()=>{
 const {env,snapshot}=setup();imp(env,answer(snapshot));assert.equal(imp(env,answer(snapshot)).saved,0);
 const changed=rows(snapshot);changed[1].classification='PASS';const r=imp(env,answer(snapshot,changed));assert.equal(r.saved,1);assert.equal(r.revised,1);
 const reb=candidates(env).filter(x=>x[7]==='player_rebounds');assert.deepEqual(reb.map(x=>[x[1],x[2],x[14]]),[[1,'','WATCHLIST'],[2,1,'PASS']]);
});
test('one bad quote rejects the whole block, saves nothing, and returns a fix request for the AI',()=>{
 const {env,snapshot}=setup();const bad=rows(snapshot);bad[0].price=-115;bad[3].line=33.5;const r=imp(env,answer(snapshot,bad));
 assert.equal(r.ok,false);assert.equal(r.errors.length,2);assert.match(r.errors[0],/not found in the export/);assert.match(r.fix_request,/Re-send only a corrected NBA_CANDIDATES_V1 block/);assert.equal(candidates(env).length,0);
});
test('a code-box copy without the label, and curly quotes from a phone, are still read',()=>{
 const a=setup();assert.equal(imp(a.env,answer(a.snapshot,null,null,{bare:true})).saved,5);
 const b=setup();const curly=answer(b.snapshot,null,null,{compact:true}).replace(/"/g,(m,i)=>i%2?'“':'”');assert.equal(imp(b.env,curly).saved,5);
 const c=setup();const r=imp(c.env,'Here is my bet slip {"stake":10}');assert.equal(r.ok,false);assert.match(r.errors[0],/No NBA_CANDIDATES_V1 block was found/);
});
test('fewer than five rows needs a game_notes reason; more than five is refused',()=>{
 const {env,snapshot}=setup();const four=rows(snapshot).slice(0,4);
 assert.match(imp(env,answer(snapshot,four)).errors.join(),/has 4 rows; each eligible game needs 5 rows or a game_notes reason/);
 assert.equal(imp(env,answer(snapshot,four,[{event_id:'event1',reason:'Only four priced markets fit.'}])).saved,4);
 const six=rows(snapshot).concat([{event_id:'event1',market_key:'player_threes',subject:P2,side:'Over',line:2.5,price:-110,classification:'PASS',reason:'x'}]);
 assert.match(imp(env,answer(snapshot,six)).errors.join(),/more than 5 rows/);
});
test('alternate rungs must be exported quotes; CONDITIONAL needs a condition; unknown snapshots are refused',()=>{
 const {env,snapshot}=setup();const alt=rows(snapshot);alt[1]={event_id:'event1',market_key:'player_points_alternate',subject:P1,side:'Over',line:25.5,price:180,classification:'WATCHLIST',reason:'Ceiling.'};
 assert.equal(imp(env,answer(snapshot,alt)).saved,5);
 const noCondition=rows(snapshot);noCondition[2].condition='';assert.match(imp(env,answer(snapshot,noCondition)).errors.join(),/CONDITIONAL rows need a condition/);
 assert.match(imp(env,answer('20261102200000000-nope',rows())).errors[0],/was not found/);
});
test('rows logged after tipoff are saved as POST_KICKOFF and never graded',()=>{
 const {env,snapshot}=setup();env.setNow('2026-11-02T23:30:00.000Z');const r=imp(env,answer(snapshot));assert.equal(r.post_kickoff,5);
 assert.ok(candidates(env).every(c=>c[18]==='POST_KICKOFF'));assert.equal(grade(env).graded,0);
});
test('grading settles props, PRA, alternates, moneyline, spread and total from the final box score, free',()=>{
 const {env,snapshot}=setup();const list=rows(snapshot);list[1]={event_id:'event1',market_key:'player_points_alternate',subject:P1,side:'Over',line:25.5,price:180,classification:'WATCHLIST',reason:'Ceiling.'};
 imp(env,answer(snapshot,list));const before=env.fetches.length,g=grade(env);
 assert.equal(g.graded,5);assert.equal(g.unresolved,0);assert.equal(env.fetches.length,before,'no Odds API call');
 const r=results(env);
 assert.deepEqual([r['player_points|'+P1+'|Over|20.5'][2],r['player_points|'+P1+'|Over|20.5'][3]],['WIN',25]);
 assert.deepEqual([r['player_points_alternate|'+P1+'|Over|25.5'][2],r['player_points_alternate|'+P1+'|Over|25.5'][3]],['LOSS',25],'25 is under the 25.5 rung');
 assert.deepEqual([r['player_assists|'+P2+'|Over|5.5'][2],r['player_assists|'+P2+'|Over|5.5'][3]],['WIN',7]);
 assert.deepEqual([r['player_points_rebounds_assists|'+P1+'|Over|32.5'][2],r['player_points_rebounds_assists|'+P1+'|Over|32.5'][3]],['WIN',35],'25 + 6 + 4');
 assert.deepEqual([r['h2h|'+HOME+'|'+HOME+'|'][2],r['h2h|'+HOME+'|'+HOME+'|'][3]],['WIN','112-105']);
 const team={c:{market:'spreads',side:HOME,line:-7.5},t:{market:'totals',side:'Under',line:217}},game=plain(env.run("nbaFinalGame_(nbaLoadBoxScores_(2027),'"+HOME+"','"+AWAY+"','2026-11-02T23:00:00.000Z')"));
 env.context.__g=game;assert.equal(env.run("gradeTeamSelection_({market:'spreads',side:'"+HOME+"',line:-7.5},__g).result"),'LOSS','112 - 7.5 = 104.5 < 105');
 assert.equal(env.run("gradeTeamSelection_({market:'spreads',side:'"+AWAY+"',line:7},__g).result"),'PUSH','105 + 7 = 112');
 assert.equal(env.run("gradeTeamSelection_({market:'totals',side:'Under',line:217},__g).result"),'PUSH','112 + 105 = 217');
});
test('a player who did not play is VOID (no action); a player missing from the box score is UNRESOLVED, never guessed',()=>{
 const {env}=setup();const game=plain(env.run("(function(){var b=nbaLoadBoxScores_(2027);return b;})()"));env.web.set(URL,{body:csv(finalRows())});
 env.context.__g=plain(env.run("nbaFinalGame_(nbaLoadBoxScores_(2027),'"+HOME+"','"+AWAY+"','2026-11-02T23:00:00.000Z')"));
 const v=plain(env.run("settleSelection_({market:'player_points',subject:'Bench Guy',side:'Over',line:5.5},__g)"));assert.equal(v.settlement.result,'VOID');assert.match(v.settlement.detail,/did not play \(COACH DECISION\)/);
 const u=plain(env.run("settleSelection_({market:'player_points',subject:'Ghost Player',side:'Over',line:5.5},__g)"));assert.match(u.settlement.error,/PLAYER_NOT_IN_BOX_SCORE/);assert.ok(game);
});
test('a game not yet in the box score file stays pending; re-grading never duplicates and retries UNRESOLVED rows',()=>{
 const {env,snapshot}=setup();imp(env,answer(snapshot));
 const pending=grade(env,EARLIER);assert.equal(pending.graded,0);assert.equal(pending.not_final,5);assert.equal(env.tab('CANDIDATE_RESULTS').length,0);
 const missing=finalRows().filter(r=>r.athlete_display_name!==P2);grade(env,missing);assert.equal(env.tab('CANDIDATE_RESULTS').filter(r=>r[2]==='UNRESOLVED').length,1);
 const again=grade(env);assert.equal(again.graded,1,'only the unresolved row is retried');assert.equal(grade(env).graded,0,'nothing left to grade');
 const finals=env.tab('CANDIDATE_RESULTS').filter(r=>r[2]!=='UNRESOLVED');assert.equal(finals.length,5);
});
test('grading uses the latest pre-tipoff revision only',()=>{
 const {env,snapshot}=setup();imp(env,answer(snapshot));const changed=rows(snapshot);changed[0].classification='PASS';imp(env,answer(snapshot,changed));
 grade(env);const graded=env.tab('CANDIDATE_RESULTS').find(r=>candidates(env).some(c=>c[0]===r[0]&&c[7]==='player_points'));assert.equal(graded[1],2);
});
test('the summary is flat 1 unit at the logged price, with sample size and coverage dates',()=>{
 const {env,snapshot}=setup();const list=rows(snapshot);list[1].side='Over';list[1].line=7.5;
 // Player One rebounds Over 7.5 at -110 loses (6). Wins: points, assists, PRA at -110 and h2h at -150.
 imp(env,answer(snapshot,list.map(r=>r.market_key==='player_rebounds'?Object.assign({},r,{side:'Under'}):r)));const g=grade(env).summary;
 const all=g.groups.find(x=>x.type==='All');
 // Wins: 3 x (100/110) + 100/150 = 2.7273 + 0.6667; rebounds Under 7.5 also wins (6) -> + 0.9091. Total 4.30.
 assert.equal(all.graded,5);assert.equal(all.wins,5);assert.equal(all.units,4.3);assert.equal(all.first_kickoff_utc,'2026-11-02T23:00:00.000Z');
 assert.ok(g.groups.some(x=>x.type==='Price gap vs market'&&x.group==='No consensus'));
 const tab=env.tab('CANDIDATE_SUMMARY');assert.ok(tab.length>1);assert.doesNotMatch(JSON.stringify(g),/prob|edge|forecast|project/i);
});
test('handoffs ask ChatGPT and Claude for the block with the exact snapshot; the phone copy matches the server; Perplexity is unchanged',()=>{
 const {env,snapshot}=setup();const server=env.run('candidateBlockInstructions_('+JSON.stringify(snapshot)+')');
 const start=mobile.indexOf("var CANDIDATE_BLOCK='NBA_CANDIDATES_V1';"),end=mobile.indexOf('function analysisRequest(data){');const ctx=vm.createContext({});vm.runInContext(mobile.slice(start,end),ctx);
 assert.equal(ctx.candidateBlockInstructions(snapshot),server);assert.match(server,new RegExp('"snapshot_id":"'+snapshot+'"'));
 const line=n=>mobile.split('\n').find(l=>l.trim().startsWith(n));
 assert.match(line('function analysisRequest(data){'),/candidateBlockInstructions\(data\.snapshotId\)/);assert.match(line('function claudeRequest(data){'),/candidateBlockInstructions\(data\.snapshotId\)/);
 assert.doesNotMatch(line('function perplexityRequest(data){'),/candidateBlockInstructions/);
});
test('the export pointer carries the snapshot ID and the dashboard reports whether picks were logged',()=>{
 const {env,snapshot,latest}=setup();assert.equal(latest.snapshot_id,snapshot);
 assert.deepEqual(plain(env.run('candidateLogStatus_(mobileLastExport_())')),{enabled:true,snapshot_id:snapshot,logged:false,rows:0});
 imp(env,answer(snapshot));assert.deepEqual(plain(env.run('candidateLogStatus_(mobileLastExport_())')),{enabled:true,snapshot_id:snapshot,logged:true,rows:5});
 assert.match(mobile,/snapshotId:latest\.snapshot_id\|\|''/);assert.match(mobile,/Log AI picks — free/);assert.match(mobile,/Grade finished games — free/);
});
console.log('\n'+count+' passed, '+failures.length+' failed (NBA Phase 3 candidate log; offline, mock-only, zero provider credits).');
if(failures.length)process.exitCode=1;
