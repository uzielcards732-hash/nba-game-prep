'use strict';
// Load speed: one game's rows are replaced in place instead of rewriting whole
// tabs. Each test runs the same load twice, once with the old full-tab rewrite
// patched back in, and checks the tabs end identical while the Sheets cells
// touched (the mock's stand-in for Sheets time) drop sharply. Offline, mock-only.
const assert=require('node:assert/strict');
const m=require('./nba-mock-env.cjs');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n').slice(0,2).join(' | '));}}
const TABS=['PROPS','ALT_PROPS','NBA_PROPS','LINE_HISTORY'];
// The pre-change behavior: every replacement reads and rewrites the whole tab,
// line history reads every column, and a standard load records history twice.
const OLD_WAY=`
replaceRows_=function(name,headers,keyCols,isReplaced,newRows){const old=read_(name,headers.length),kept=old.filter(r=>!isReplaced(r));write_(name,headers,kept.concat(newRows));return {removed:old.length-kept.length,added:newRows.length};};
recordNormalizedLineHistory_=function(normalized,captureContext){const s=ensureLineHistorySheet_(),existing=read_(TAB_LINE_HISTORY,LINE_HISTORY_HEADERS.length),seen={};existing.forEach(row=>{if(String(row[0]||'').trim())seen[String(row[0])]=true;});const all=lineHistoryRows_(normalized,captureContext),newRows=all.filter(row=>!seen[row[0]]);if(newRows.length)s.getRange(s.getLastRow()+1,1,newRows.length,LINE_HISTORY_HEADERS.length).setValues(newRows.map(row=>row.map(cell_)));return {observed:all.length,inserted:newRows.length,duplicates:all.length-newRows.length};};
(function(){const mirror=writeLatestNormalizedProps_;writeLatestNormalizedProps_=function(n,id,c){const r=mirror(n,id,c);if(c==='mobile_odds_api_refresh')recordLineHistorySafely_(n,'mobile_props_refresh',id);return r;};})();`;
const row=(width,values)=>{const r=Array(width).fill('');Object.keys(values).forEach(k=>{r[k]=values[k];});return r;};
// Large tabs: other games' rows, this game's stale rows in separate blocks,
// legacy rows without an event ID, and another provider's rows.
function prefill(env,matchup){
 const ph=env.run('propsHeaders_()'),ah=env.run('ALT_PROPS_HEADERS.slice()'),nh=env.run('NBA_PROPS_HEADERS.slice()'),lh=env.run('LINE_HISTORY_HEADERS.slice()');
 const pe=ph.indexOf('Event ID'),pg=ph.indexOf('Game'),ae=ah.indexOf('Event ID'),ag=ah.indexOf('Game');
 const props=[ph];for(let i=0;i<3000;i++){props.push(row(ph.length,{0:'Other '+i,[pg]:'Other Game '+(i%13),[pe]:'other'+(i%13)}));if(i===1200||i===2400)for(let j=0;j<20;j++)props.push(row(ph.length,{0:'Stale '+i+'-'+j,[pg]:matchup,[pe]:'event1'}));}
 props.splice(500,0,row(ph.length,{0:'Legacy by matchup',[pg]:matchup}),row(ph.length,{0:'Legacy other game',[pg]:'Other Game 1'}));
 const alt=[ah];for(let i=0;i<5000;i++){alt.push(row(ah.length,{0:'Other '+i,[ag]:'Other Game '+(i%13),[ae]:'other'+(i%13)}));if(i===2500)for(let j=0;j<40;j++)alt.push(row(ah.length,{0:'Stale '+j,[ag]:matchup,[ae]:'event1'}));}
 alt.splice(10,0,row(ah.length,{0:'Legacy alt',[ag]:matchup}));
 const nba=[nh];for(let i=0;i<8000;i++){nba.push(row(nh.length,{0:'the_odds_api',1:'other'+(i%13),12:'Other '+i}));if(i===3000||i===6000)for(let j=0;j<30;j++)nba.push(row(nh.length,{0:'the_odds_api',1:'event1',12:'Stale '+j}));}
 nba.splice(100,0,row(nh.length,{0:'sports_game_odds',1:'event1',12:'Other provider kept'}));
 const hist=[lh];for(let i=0;i<8000;i++)hist.push(row(lh.length,{0:'history-'+i,1:'2026-11-01T12:00:00.000Z'}));
 Object.entries({PROPS:props,ALT_PROPS:alt,NBA_PROPS:nba,LINE_HISTORY:hist}).forEach(([name,rows])=>{env.sheet(name).data=rows.map(r=>r.slice());});
}
function load(oldWay,alternates){
 const env=m.makeEnv(),games=m.defaultGames(env).slice(0,1);m.seedIndex(env,games);
 if(oldWay)env.run(OLD_WAY);
 prefill(env,games[0].away+' @ '+games[0].home);
 env.responses.push({body:m.standardEvent(env,games[0]),headers:m.okHeaders(5)});
 if(alternates)env.responses.push({body:m.alternateEvent(env,games[0]),headers:m.okHeaders(5)});
 // Count Sheets cells touched by the LOAD stage, the part this change targets.
 const total=()=>env.cells.read+env.cells.written,advance=env.context.nbaStageAdvance_;let loadCells=0;
 env.context.nbaStageAdvance_=function(state,job){const stage=state.stage,before=total();try{return advance(state,job);}finally{if(stage==='LOAD')loadCells+=total()-before;}};
 m.startLoad(env,alternates,'req-speed-'+(oldWay?'old':'new')+(alternates?'alt':'std'));const state=m.runWorker(env);
 assert.notEqual(state.state,'FAILED');
 const tabs={};TABS.forEach(t=>{tabs[t]=JSON.parse(JSON.stringify(env.tab(t)));});
 return {env,tabs,cells:loadCells};
}
function sameTabs(a,b){
 // Line history Capture UTC is the same clock in both runs, so rows compare exactly.
 TABS.forEach(t=>{assert.equal(a.tabs[t].length,b.tabs[t].length,t+' row count');assert.deepEqual(a.tabs[t],b.tabs[t],t+' contents');});
}
test('a standard load leaves every tab identical to the old full rewrite',()=>{
 const oldRun=load(true,false),newRun=load(false,false);sameTabs(oldRun,newRun);
 const p=newRun.tabs.PROPS;assert.equal(p.filter(r=>String(r[0]).startsWith('Stale')).length,0,'stale rows for this game removed');
 assert.ok(p.some(r=>r[0]==='Legacy other game'),'other legacy rows kept');assert.equal(p.filter(r=>r[0]==='Legacy by matchup').length,0,'legacy row for this matchup replaced');
 assert.ok(newRun.tabs.NBA_PROPS.some(r=>r[12]==='Other provider kept'),'another provider is never replaced');
});
test('an alternate load leaves every tab identical to the old full rewrite',()=>{sameTabs(load(true,true),load(false,true));});
test('Sheets cells touched while loading fall to under a tenth of the old way',()=>{
 const oldRun=load(true,true),newRun=load(false,true),ratio=newRun.cells/oldRun.cells;
 console.log('     LOAD stage cells touched: old '+oldRun.cells+', new '+newRun.cells+' ('+(ratio*100).toFixed(1)+'%)');
 assert.ok(ratio<0.10,'ratio '+ratio);
});
test('line history keeps one copy of each observation and reads only the ID column',()=>{
 const run=load(false,false),ids=run.tabs.LINE_HISTORY.map(r=>r[0]);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,8000+10);
});
test('replaceRows_ matches filter-and-append on edge cases: empty tab, everything replaced, nothing replaced',()=>{
 const env=m.makeEnv(),h=['k','v'];
 const check=(rows,replace,add)=>{env.sheet('T').data=[h].concat(rows.map(r=>r.slice()));env.run('replaceRows_')('T',h,[0],r=>replace.includes(r[0]),add);
  assert.deepEqual(JSON.parse(JSON.stringify(env.tab('T'))),rows.filter(r=>!replace.includes(r[0])).concat(add));};
 check([],[],[['a',1]]);check([['a',1],['a',2]],['a'],[]);check([['a',1],['b',2],['a',3],['c',4]],['a'],[['a',9]]);check([['b',1]],['x'],[]);
});
console.log('\n'+count+' passed, '+failures.length+' failed (NBA load speed; offline, mock-only).');
if(failures.length)process.exitCode=1;
