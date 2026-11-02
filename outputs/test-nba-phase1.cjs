'use strict';
// Phase 1 reliability: paid-request fixes F1 to F8 ported from NFL, safe LOG
// writes, the 160-credit nightly cap and the stuck-spinner fix. Offline,
// mock-only: no network, no credentials, no email.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const m=require('./nba-mock-env.cjs');
const mobile=fs.readFileSync(path.join(__dirname,'Mobile.html'),'utf8');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n').slice(0,process.env.VERBOSE?12:2).join(' | '));}}
const plain=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
function setup(options){const env=m.makeEnv(options);const games=m.defaultGames(env,options&&options.offsetHours);m.seedIndex(env,games);return {env,games};}
function queueStandard(env,games,credits){games.forEach(g=>env.responses.push({body:m.standardEvent(env,g),headers:m.okHeaders(credits||5)}));}
function lastExport(env){return JSON.parse(env.props.get('NBA_MOBILE_LAST_EXPORT')||'null');}
function op(env,run,kind,event){return JSON.parse(env.props.get('NBA_STAGE_OPERATION_'+run+'_'+kind+'_'+event)||'null');}
function noSecrets(env){const all=JSON.stringify([...env.props.values()])+JSON.stringify(env.tab('LOG'))+[...env.files.values()].map(f=>f.text).join('');assert.doesNotMatch(all,/LEAK_CHECK_SECRET|MOCK_SECRET/);}

// ---------------------------------------------------------------- F1 and F2
test('F1: a failed ledger write after a paid response keeps the data and settles later under the same reservation',()=>{
 const {env,games}=setup();queueStandard(env,games);env.libraryFaults.response=2; // response write and the step-end retry both fail
 m.startLoad(env,false,'req-f1-aaaa');const state=m.runWorker(env);
 assert.equal(env.fetches.length,2,'exactly one paid request per game');
 assert.ok(env.file('nba_run_req-f1-aaaa_raw_standard_event1.json'),'raw response saved');
 assert.equal(env.tab('PROPS').filter(r=>r.includes('event1')).length,2,'paid-for props committed');
 const o=op(env,'req-f1-aaaa','standard','event1');assert.equal(o.status,'COMMITTED');assert.equal(o.ledger_state,'SETTLED','sweep settled it');
 const row=env.ledger.get('nba:req-f1-aaaa:standard-event1');assert.equal(row.state,'SETTLED');assert.equal(row.actual,5);assert.equal(row.settle_count,1);
 assert.deepEqual(plain(lastExport(env).receipt.ledger_pending),[]);assert.equal(state.state==='FAILED',false);
 assert.equal(env.charged(),10);noSecrets(env);
});
test('F1: when the ledger stays unavailable, the export still publishes and the receipt names the pending write',()=>{
 const {env,games}=setup();queueStandard(env,games);env.libraryFaults.response=99;
 m.startLoad(env,false,'req-f1-bbbb');const state=m.runWorker(env);
 assert.equal(state.state,'PARTIAL');assert.equal(env.fetches.length,2);
 const receipt=lastExport(env).receipt;assert.equal(receipt.ledger_pending.length,2);
 assert.ok(receipt.warnings.some(w=>/ledger update.*still pending.*nothing was bought twice/.test(w)));
 assert.equal(env.tab('PROPS').length,4,'both games committed');
 assert.ok([...env.props.keys()].some(k=>k.startsWith('NBA_LEDGER_PENDING_')),'pending record kept for the next sweep');
 env.libraryFaults.response=0;const swept=env.run('nbaLedgerSweep_(null,null)');assert.equal(swept.settled,2);assert.equal(env.fetches.length,2,'settling makes no provider request');
 assert.equal([...env.props.keys()].filter(k=>k.startsWith('NBA_LEDGER_PENDING_')).length,0);
});
test('F1: settling twice for the same operation records exactly one charge',()=>{
 const {env,games}=setup();queueStandard(env,[games[0]]);env.sheet('INDEX').data[2][env.run('IDX').LOAD]=false;env.libraryFaults.response=1;
 m.startLoad(env,false,'req-f1-cccc');m.runWorker(env);
 const id='nba:req-f1-cccc:standard-event1';env.run('nbaLedgerSettleOne_('+JSON.stringify(id)+',200,{"x-requests-last":"5"})');env.run('nbaLedgerSettleOne_('+JSON.stringify(id)+',200,{"x-requests-last":"5"})');
 assert.equal(env.ledger.get(id).settle_count,1);assert.equal(env.charged(),5);
});
test('F1: a busy ledger after the send is reported truthfully, never as "No request was sent"',()=>{
 const {env}=setup();env.libraryFaults.response=1;
 env.run("var __r=SharedNFL.runtime('reserve',{run_id:'r',operation:'o',expected_credits:5});SharedNFL.runtime('sent',{reservation_id:__r.reservation_id});");
 assert.throws(()=>env.run("nbaSharedCall_('response',{reservation_id:__r.reservation_id,http_code:200,headers:{}})"),/Ledger update pending; the request was sent and its saved response is kept/);
});
test('F2: the worker start sweep settles a pending write left by an earlier execution',()=>{
 const {env}=setup();
 env.run("var __r=SharedNFL.runtime('reserve',{run_id:'old',operation:'game-lines',expected_credits:3});SharedNFL.runtime('sent',{reservation_id:__r.reservation_id});nbaLedgerPendingSave_(__r.reservation_id,200,{'x-requests-last':'3'},'Odds','');");
 const {env:_}= {env};queueStandard(env,m.defaultGames(env));
 m.startLoad(env,false,'req-f2-aaaa');env.run('continueNbaMobileLoad()');
 assert.equal(env.ledger.get('nba:old:game-lines').state,'SETTLED');assert.equal(env.ledger.get('nba:old:game-lines').actual,3);
});

// ---------------------------------------------------------------- F3
test('F3: a saved response whose Sheet write failed is reused by the next run with zero credits and its original time',()=>{
 const {env,games}=setup();queueStandard(env,[games[0]]);env.sheet('INDEX').data[2][env.run('IDX').LOAD]=false;
 env.faults.push({service:'SPREADSHEET',match:d=>d.sheet==='PROPS'&&d.op==='write',remaining:1});
 m.startLoad(env,false,'req-f3-aaaa');m.runWorker(env);
 assert.equal(op(env,'req-f3-aaaa','standard','event1').status,'FAILED');assert.equal(env.tab('PROPS').length,0);
 const captured=JSON.parse(env.file('nba_run_req-f3-aaaa_raw_standard_event1.json').text).retrieved_utc;
 env.advance(20*60000);
 const plan=env.run('mobilePropsPlan_(false,false)');
 assert.equal(plan.max_total_odds_api_credits,0);assert.equal(plan.reusable_props[0].reason,'Reused saved response — 0 credits.');
 const before=env.fetches.length;env.context.__plan=plan;env.run("mobileLoadAndExport(__plan,'req-f3-bbbb')");m.runWorker(env);
 assert.equal(env.fetches.length,before,'no second purchase');
 assert.equal(env.tab('PROPS').length,2);const updated=env.run("propsHeaders_().indexOf('Updated')");assert.equal(String(env.tab('PROPS')[0][updated]),captured,'keeps the original capture time');
 assert.equal(op(env,'req-f3-bbbb','standard','event1').reused_from,'req-f3-aaaa');assert.equal(lastExport(env).receipt.confirmed_credits,0);
});
test('F3: the pointer is ignored when older than 90 minutes, for other markets or events, or on force refresh',()=>{
 const {env}=setup();const now=env.now(),iso=ms=>new Date(ms).toISOString();
 const set=(captured,markets,event,books)=>env.props.set('NBA_LAST_RAW_standard_event1',JSON.stringify({run_id:'x',kind:'standard',event_id:event||'event1',captured_utc:iso(captured),markets:markets||env.run('PROP_MARKETS.slice()'),bookmaker:books||env.run("requestedBooks_().join(',')")}));
 set(now-89*60000);assert.ok(env.run('nbaSavedResponsePointer_("standard","event1",Date.now())'));
 set(now-91*60000);assert.equal(env.run('nbaSavedResponsePointer_("standard","event1",Date.now())'),null,'91 minutes old');
 set(now-5*60000,['player_points']);assert.equal(env.run('nbaSavedResponsePointer_("standard","event1",Date.now())'),null,'different markets');
 set(now-5*60000,null,null,'draftkings');assert.equal(env.run('nbaSavedResponsePointer_("standard","event1",Date.now())'),null,'a pointer from a DraftKings-only request');
 set(now-5*60000,null,'event2');assert.equal(env.run('nbaSavedResponsePointer_("standard","event1",Date.now())'),null,'different event');
 set(now-5*60000);const forced=env.run('mobilePropsPlan_(true,false)');assert.equal(forced.max_prop_credits,10,'force refresh buys again');
 const normal=env.run('mobilePropsPlan_(false,false)');assert.equal(normal.max_prop_credits,5);
});

// ---------------------------------------------------------------- F4
test('F4: started games are excluded from the plan, cost nothing and get no request',()=>{
 const {env,games}=setup();env.sheet('INDEX').data[1][env.run('IDX').KICKOFF]=new Date(env.now()-600000).toISOString();
 const plan=env.run('mobilePropsPlan_(false,true)');
 assert.equal(plan.max_total_odds_api_credits,10,'only the future game: 5 standard + 5 alternate');
 assert.equal(plan.started_games.length,1);assert.equal(plan.started_games[0].reason,'Started — not loadable, 0 credits.');
 env.responses.push({body:m.standardEvent(env,games[1]),headers:m.okHeaders(5)},{body:m.alternateEvent(env,games[1]),headers:m.okHeaders(5)});
 env.context.__plan=plan;env.run("mobileLoadAndExport(__plan,'req-f4-aaaa')");m.runWorker(env);
 assert.equal(env.fetches.length,2);assert.ok(env.fetches.every(u=>u.includes('event2')));
});
test('F4: a confirm with only started games is refused before any request',()=>{
 const {env}=setup({offsetHours:-1});const plan=env.run('mobilePropsPlan_(false,false)');
 assert.equal(plan.max_total_odds_api_credits,0);env.context.__plan=plan;
 assert.throws(()=>env.run("mobileLoadAndExport(__plan,'req-f4-bbbb')"),/Every selected game has started/);
 assert.equal(env.fetches.length,0);assert.equal(env.run('nbaStageState_()'),null);
});

// ---------------------------------------------------------------- F5
test('F5: the result screen says when no game is eligible for analysis',()=>{
 assert.match(mobile,/Export saved, but no game is eligible for analysis/);
 assert.match(mobile,/data\.eligibleEventIds&&data\.eligibleEventIds\.length===0/);
});

// ---------------------------------------------------------------- F6
test('F6: a Drive error after the raw file was written is verified, not treated as a lost purchase',()=>{
 const {env,games}=setup();queueStandard(env,games);
 env.faults.push({service:'DRIVE',match:d=>d.op==='create'&&/raw_standard_event1/.test(d.name),remaining:1});
 m.startLoad(env,false,'req-f6-aaaa');m.runWorker(env);
 const o=op(env,'req-f6-aaaa','standard','event1');assert.equal(o.status,'COMMITTED');assert.equal(o.raw_saved,true);
 assert.equal(env.fetches.length,2);assert.equal(env.charged(),10);
});
test('F6: a Script Properties error after the send does not lose the response',()=>{
 const {env,games}=setup();queueStandard(env,games);let n=0;
 env.faults.push({service:'PROPERTIES',match:d=>d.op==='write'&&/NBA_STAGE_OPERATION_req-f6-bbbb_standard_event1/.test(d.key)&&++n===2,remaining:1});
 m.startLoad(env,false,'req-f6-bbbb');m.runWorker(env);
 assert.equal(op(env,'req-f6-bbbb','standard','event1').status,'COMMITTED');assert.equal(env.fetches.length,2);
});
test('F6: unexpected errors are recorded as a safe category without native text',()=>{
 const {env,games}=setup();queueStandard(env,games);
 env.faults.push({service:'SPREADSHEET',match:d=>d.sheet==='PROPS'&&d.op==='write',remaining:1});
 m.startLoad(env,false,'req-f6-cccc');m.runWorker(env);
 const o=op(env,'req-f6-cccc','standard','event1');assert.equal(o.status,'FAILED');
 assert.deepEqual(plain(o.error),{service:'SPREADSHEET',step:'LOAD standard-event1',error_class:'Error'});
 assert.match(o.message,/Operation failed \(SPREADSHEET · LOAD standard-event1 · Error\)/);noSecrets(env);
});

// ---------------------------------------------------------------- F7
test('F7: one bad step gives a PARTIAL run with an export for the other games and no retry',()=>{
 const {env,games}=setup();queueStandard(env,games);
 env.faults.push({service:'PROPERTIES',match:d=>d.op==='read'&&/NBA_STAGE_OPERATION_req-f7-aaaa_standard_event1/.test(d.key),remaining:2}); // the start sweep reads it first
 m.startLoad(env,false,'req-f7-aaaa');const state=m.runWorker(env);
 assert.equal(state.state,'PARTIAL');const latest=lastExport(env);assert.equal(latest.event_ids.length,2);
 assert.ok(latest.receipt.warnings.some(w=>/standard step stopped and was skipped; nothing was retried/.test(w)));
 assert.equal(env.fetches.length,1,'only the healthy game was requested; the failed step was not retried');
});

// ---------------------------------------------------------------- F8
test('F8: the prune dry run lists only old finished records, keeps unresolved ones and deletes nothing',()=>{
 const {env}=setup();const old='2026-10-01T00:00:00.000Z',recent=new Date(env.now()-3600000).toISOString();
 const put=(run,kind,event,v)=>env.props.set('NBA_STAGE_OPERATION_'+run+'_'+kind+'_'+event,JSON.stringify(v));
 put('old-done','standard','e1',{status:'COMMITTED',committed_utc:old});put('old-done','alternate','e1',{status:'NOT_SENT',started_utc:old});
 put('old-unknown','standard','e1',{status:'UNKNOWN',started_utc:old});
 put('old-ledger','standard','e1',{status:'COMMITTED',committed_utc:old,ledger_state:'SETTLEMENT_PENDING',reservation_id:'r1'});
 put('new-done','standard','e1',{status:'COMMITTED',committed_utc:recent});
 env.props.set('NBA_STAGE_OPERATION_bad_standard_e1','{not json');
 const before=env.props.size,r=plain(env.run('nbaOperationRecordsPruneDryRun()'));
 assert.equal(r.dry_run,true);assert.equal(r.deleted,0);assert.equal(env.props.size,before);assert.equal(env.fetches.length,0);
 assert.deepEqual(r.would_delete.sort(),['NBA_STAGE_OPERATION_old-done_alternate_e1','NBA_STAGE_OPERATION_old-done_standard_e1']);
 const reasons=Object.fromEntries(r.kept_runs.map(k=>[k.run_id,k.reason]));
 assert.equal(reasons['old-unknown'],'UNRESOLVED_OR_UNKNOWN_CHARGE');assert.equal(reasons['old-ledger'],'LEDGER_NOT_SETTLED');assert.equal(reasons['new-done'],'NEWER_THAN_14_DAYS');assert.equal(reasons.bad,'UNREADABLE_RECORD');
});

// ---------------------------------------------------------------- Safe LOG writes
test('LOG: a LOG write failure after the send never fails the load and records only a count',()=>{
 const {env,games}=setup();queueStandard(env,games);
 // PLANNED rows go through; every audit row written after a response fails.
 env.faults.push({service:'SPREADSHEET',match:d=>d.sheet==='LOG'&&d.op==='append'&&d.values[3]!=='PLANNED'&&env.fetches.length>0,remaining:99});
 m.startLoad(env,false,'req-log-aaaa');const state=m.runWorker(env);
 assert.notEqual(state.state,'FAILED');assert.equal(env.tab('PROPS').length,4);
 const marker=JSON.parse(env.props.get('NBA_LOG_WRITE_FAILED'));assert.ok(marker.count>=1);assert.deepEqual(Object.keys(marker).sort(),['count','first_utc','last_action','last_utc']);
 assert.ok(lastExport(env).receipt.log_write_failures>=1);noSecrets(env);
});
test('LOG: if the PLANNED row cannot be written, nothing is reserved or sent',()=>{
 const {env,games}=setup();queueStandard(env,games);
 env.faults.push({service:'SPREADSHEET',match:d=>d.sheet==='LOG'&&d.op==='append',remaining:99});
 m.startLoad(env,false,'req-log-bbbb');const state=m.runWorker(env);
 assert.equal(env.fetches.length,0);assert.equal(env.libraryCalls.filter(c=>c==='reserve').length,0);assert.equal(state.state,'PARTIAL');
});

// ---------------------------------------------------------------- Nightly cap
test('Cap: the plan shows tonight\'s count, and a load over 160 is refused before any request',()=>{
 const {env}=setup();const key=env.run('nbaNightKey_()');env.props.set(key,JSON.stringify({counted:155,requests:20}));
 const plan=env.run('mobilePropsPlan_(false,false)');assert.deepEqual(plain(plan.night_cap),{night_et:'2026-11-02',cap:160,counted:155,remaining:5});
 env.context.__plan=plan;assert.throws(()=>env.run("mobileLoadAndExport(__plan,'req-cap-aaaa')"),/needs up to 10 credits, but tonight's 160-credit cap has 5 left \(155 already counted\)/);
 assert.equal(env.fetches.length,0);
});
test('Cap: every paid request counts, actual charges replace expected, and an unsent request is released',()=>{
 const {env,games}=setup();queueStandard(env,games,4);m.startLoad(env,false,'req-cap-bbbb');m.runWorker(env);
 const key=env.run('nbaNightKey_()');assert.equal(JSON.parse(env.props.get(key)).counted,8,'2 requests × 4 actual credits');
 env.libraryFaults.reserve=1;assert.throws(()=>env.run("oddsRequest_('/x','',true,'e',5,'run','op')"));assert.equal(JSON.parse(env.props.get(key)).counted,8,'library refusal releases the count');
 env.props.set(key,JSON.stringify({counted:158,requests:3}));
 assert.throws(()=>env.run("oddsRequest_('/x','',true,'e',3,'run','op2')"),/cap would be exceeded \(158 counted \+ 3 requested = 161\)\. No request was sent/);
 assert.equal(env.fetches.length,2);
});
test('Cap: the night is the Eastern calendar date and game odds refresh respects it',()=>{
 const {env}=setup({now:'2026-11-03T03:30:00.000Z'});assert.equal(env.run('nbaNightKey_()'),'NBA_NIGHT_CREDITS_2026-11-02','10:30 PM Eastern counts toward Nov 2');
 env.props.set('NBA_NIGHT_CREDITS_2026-11-02',JSON.stringify({counted:158,requests:9}));
 assert.throws(()=>env.run("mobileRefreshScheduleAndOdds(3,'req-cap-cccc')"),/cap has 2 left; game odds need 3/);assert.equal(env.fetches.length,0);
 env.setNow('2026-11-03T15:00:00.000Z');assert.equal(env.run('nbaNightView_()').remaining,160,'a new Eastern day starts fresh');
});

// ---------------------------------------------------------------- Receipt, speed bookkeeping
test('Receipt: timings per stage and per paid step are recorded',()=>{
 const {env,games}=setup();queueStandard(env,games);m.startLoad(env,false,'req-tim-aaaa');m.runWorker(env);
 const t=plain(lastExport(env).receipt.timings);assert.ok('LOAD' in t.stage_seconds&&'EXPORT_MANIFEST' in t.stage_seconds);
 assert.deepEqual(Object.keys(t.load_seconds).sort(),['standard-event1','standard-event2']);assert.equal(typeof t.total_seconds,'number');
});
test('Speed: an unchanged run checkpoint is not rewritten',()=>{
 const {env}=setup();env.run("nbaRunFile_('r1','job',{a:1})");const before=env.driveWrites.length;
 env.run("nbaRunFile_('r1','job',{a:1})");assert.equal(env.driveWrites.length,before);env.run("nbaRunFile_('r1','job',{a:2})");assert.equal(env.driveWrites.length,before+1);
});
test('Regression: a transport failure stays unconfirmed, counts toward the cap and is never retried',()=>{
 const {env,games}=setup();env.responses.push({throws:'Address unavailable: https://api.the-odds-api.com/?apiKey=LEAK_CHECK_SECRET'});queueStandard(env,[games[1]]);
 m.startLoad(env,false,'req-reg-aaaa');m.runWorker(env);
 assert.equal(op(env,'req-reg-aaaa','standard','event1').status,'UNKNOWN');assert.equal(env.fetches.length,2);
 assert.equal(lastExport(env).receipt.total_charge_unconfirmed,true);assert.equal(JSON.parse(env.props.get(env.run('nbaNightKey_()'))).counted,10);noSecrets(env);
});

// ---------------------------------------------------------------- Stuck spinner (client)
test('Spinner: the phone stops waiting when the server has no record, showing the real error after 15 seconds',()=>{
 const start=mobile.indexOf('function runIdAgeMs('),end=mobile.indexOf('function handleOperationFailure(');assert.ok(start>0&&end>start);
 const calls=[];const ctx=vm.createContext({Date,isFinite,parseInt,String,
  state:{callError:null,operation:{id:'x'},requestId:'x',requestInFlight:true,statusMissingCount:3},
  forgetRunId:()=>calls.push('forget'),stopOperationTimers:()=>calls.push('stop'),renderLatestExport(){},renderGames(){},setScreen:s=>calls.push('screen:'+s),setStatus:(m,e)=>calls.push('status:'+m)});
 vm.runInContext(mobile.slice(start,end),ctx);
 const id=(Date.now()-16000).toString(36)+'-abc';ctx.state.callError={id,message:'Game selection changed. Refresh the preview before confirming.'};
 assert.equal(ctx.stopWaitingForMissingRun({requested_run_id:id,operation:null},id),true);
 assert.ok(calls.includes('screen:choose')&&calls.includes('forget'));assert.ok(calls.some(c=>/That request did not start: Game selection changed/.test(c)));
 const young=(Date.now()-5000).toString(36)+'-abc';ctx.state.callError={id:young,message:'x'};assert.equal(ctx.stopWaitingForMissingRun({requested_run_id:young,operation:null},young),false,'waits 15 seconds first');
 const saved=(Date.now()-60000).toString(36)+'-abc';ctx.state.callError=null;assert.equal(ctx.stopWaitingForMissingRun({requested_run_id:saved,operation:null},saved),false,'a saved ID waits 2 minutes');
 const old=(Date.now()-121000).toString(36)+'-abc';assert.equal(ctx.stopWaitingForMissingRun({requested_run_id:old,operation:null},old),true);
 assert.equal(ctx.stopWaitingForMissingRun({requested_run_id:old,operation:{state:'RUNNING'}},old),false,'a recorded run is never abandoned');
 assert.match(mobile,/state\.callError=\{id:id,message:error&&error\.message/);
});
test('Review screen shows started games, reused responses and tonight\'s cap',()=>{
 assert.match(mobile,/Started — not loadable, 0 credits: /);assert.match(mobile,/Reused saved response — 0 credits: /);assert.match(mobile,/Tonight: /);assert.match(mobile,/will be refused/);
});

console.log('\n'+count+' passed, '+failures.length+' failed (NBA Phase 1; offline, mock-only, zero provider credits).');
if(failures.length)process.exitCode=1;
