'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'NbaOddsLoader.gs'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'Mobile.html'),'utf8');
const calls=[];
let transportCalls=0,transportFailure=false;
const ctx=vm.createContext({
  SharedNFL:{
    registerNBA(){calls.push('register');return {registered:true};},
    runtime(action,data){calls.push([action,data]);
      if(action==='slots')return {slots:[{id:'KEY 1',preferred:true,available:24,used:6,last_cost:0,enabled:true,state:'HEALTHY',checked_utc:'2026-10-20T12:00:00Z'}]};
      if(action==='free_key')return {slot:{label:'KEY 1',key:'MOCK_SECRET'}};
      if(action==='reserve')return {slot:{label:'KEY 1',key:'MOCK_SECRET'},reservation_id:'nba:'+data.run_id+':'+data.operation};
      return {state:'SETTLED'};
    },
    admin(action){calls.push('admin:'+action);return {slots:[]};}
  },
  UrlFetchApp:{fetch(url){transportCalls++;assert.match(url,/apiKey=MOCK_SECRET/);
    if(transportFailure)throw Error('offline');
    return {getResponseCode:()=>200,getAllHeaders:()=>({'x-requests-last':'5','x-requests-used':'6','x-requests-remaining':'24'}),getContentText:()=>'{"ok":true}'};
  }},
  Utilities:{getUuid:()=> 'random-id'},
  PropertiesService:{getScriptProperties:()=>({getProperty(key){if(key.startsWith('NBA_ODDS_API_KEY_'))throw Error('read local key');return null;}})},
  console
});
vm.runInContext(source,ctx,{filename:'NbaOddsLoader.gs'});
ctx.log_=()=>{};
ctx.mobileEmailSettings_=()=>({enabled:false,recipient:''});
const view=ctx.mobileKeyPoolView_();
assert.equal(view.shared,true);
assert.equal(view.slots[0].remaining,'24');
assert.doesNotMatch(JSON.stringify(view),/MOCK_SECRET/);
assert.equal(calls.filter(x=>x==='register').length,1);
const free=ctx.oddsRequest_('/sports/basketball_nba/events','',false,'',0);
assert.equal(free.slot.label,'KEY 1');
assert.equal(transportCalls,1);
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='reserve').length,0);
const paid=ctx.oddsRequest_('/sports/basketball_nba/events/game-1/odds','markets=player_points',true,'game-1',5,'run-1','standard-game-1');
assert.equal(paid.text,'{"ok":true}');
assert.equal(transportCalls,2);
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='reserve')[0][1].run_id,'run-1');
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='reserve')[0][1].operation,'standard-game-1');
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='response').length,1);
transportFailure=true;
assert.throws(()=>ctx.oddsRequest_('/sports/basketball_nba/events/game-2/odds','markets=player_points',true,'game-2',5,'run-2','standard-game-2'),/transport failure/);
assert.equal(transportCalls,3,'paid transport failure must not retry');
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='unknown').length,1);
const active=mobile.split('function renderCreditPool(pool){')[1].split("byId('settings').onclick")[0];
assert.doesNotMatch(active,/mobileSaveApiKey|mobileSetActiveKey|data-add|data-replace|window\.prompt/);
assert.match(active,/same owner-managed key pool as NFL and Friends/);
console.log('PASS NBA shares owner keys, keeps credentials server-side, settles receipts, and never retries paid requests.');
