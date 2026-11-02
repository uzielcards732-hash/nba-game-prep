'use strict';
// Offline mock of the Google services NbaOddsLoader.gs uses: Sheets, Drive,
// Script Properties, locks, triggers, UrlFetch and the shared key library.
// No network, no credentials. Each test builds a fresh environment.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {formatDate}=require('./nba-test-dates.cjs');
const SOURCE_PATH=process.env.NBA_SOURCE||path.join(__dirname,'NbaOddsLoader.gs');

function makeEnv(options){
 options=options||{};
 const cells={read:0,written:0},faults=[];
 // A fault is {service,match,remaining}; matching calls throw a plain Error
 // whose text imitates a native Google error with a URL holding a key.
 function fault(service,detail){
  for(const f of faults){if(f.service===service&&f.remaining>0&&(!f.match||f.match(detail))){f.remaining--;if(f.after)f.after(detail);throw new Error(f.message||'Exception: Service '+service+' failed while accessing https://example.test/x?apiKey=LEAK_CHECK_SECRET');}}
 }
 // ---------------- Sheets ----------------
 const sheets=new Map();
 function makeSheet(name){
  const sh={name,data:[],frozen:0};
  const lastRow=()=>{let n=sh.data.length;while(n>0&&sh.data[n-1].every(v=>v===''||v===null||v===undefined))n--;return n;};
  const ensure=(r,c)=>{while(sh.data.length<r)sh.data.push([]);sh.data.forEach(row=>{while(row.length<c)row.push('');});};
  function range(row,col,numRows,numCols){
   numRows=numRows||1;numCols=numCols||1;
   const r={
    getValues(){fault('SPREADSHEET',{sheet:name,op:'read'});cells.read+=numRows*numCols;ensure(row+numRows-1,col+numCols-1);return sh.data.slice(row-1,row-1+numRows).map(x=>x.slice(col-1,col-1+numCols).map(v=>v===undefined?'':v));},
    setValues(values){fault('SPREADSHEET',{sheet:name,op:'write',row});ensure(row+numRows-1,col+numCols-1);cells.written+=numRows*numCols;values.forEach((v,i)=>v.forEach((x,j)=>{sh.data[row-1+i][col-1+j]=x;}));return r;},
    setValue(v){fault('SPREADSHEET',{sheet:name,op:'write',row});ensure(row,col);cells.written++;sh.data[row-1][col-1]=v;return r;},
    clearContent(){ensure(row+numRows-1,col+numCols-1);cells.written+=numRows*numCols;for(let i=0;i<numRows;i++)for(let j=0;j<numCols;j++)sh.data[row-1+i][col-1+j]='';return r;},
    setFontWeight(){return r;},insertCheckboxes(){return r;},setNumberFormat(){return r;}
   };return r;
  }
  return Object.assign(sh,{
   getName:()=>name,getLastRow:lastRow,getLastColumn:()=>Math.max(0,...sh.data.map(r=>r.length)),getRange:range,setFrozenRows(n){sh.frozen=n;},
   appendRow(values){fault('SPREADSHEET',{sheet:name,op:'append',values});const n=lastRow();sh.data.splice(n,0,values.slice());cells.written+=values.length;},
   deleteRows(start,n){fault('SPREADSHEET',{sheet:name,op:'delete'});sh.data.splice(start-1,n);cells.written+=n;},
   getMaxRows:()=>sh.data.length,
  });
 }
 const ss={getId:()=>'SS_TEST',getSheetByName:n=>sheets.get(n)||null,insertSheet(n){const s=makeSheet(n);sheets.set(n,s);return s;},toast(){}};
 // ---------------- Drive ----------------
 const files=new Map();let fileSeq=0;const driveWrites=[];
 function makeFile(name,text){const id='file-'+(++fileSeq);const f={name,text,id,getId:()=>id,getUrl:()=>'https://drive.example/'+id,getName:()=>name,
  getBlob:()=>({getDataAsString:()=>{fault('DRIVE',{name,op:'read'});return f.text;}}),
  setContent(t){fault('DRIVE',{name,op:'write'});driveWrites.push(name);f.text=t;}};files.set(id,f);return f;}
 const iter=list=>{let i=0;return {hasNext:()=>i<list.length,next:()=>list[i++]};};
 const folder={getId:()=>'folder-1',getUrl:()=>'https://drive.example/folder-1',getFilesByName:n=>iter([...files.values()].filter(f=>f.name===n)),
  createFile(name,text){const f=makeFile(name,text);driveWrites.push(name);fault('DRIVE',{name,op:'create'});return f;}};
 // ---------------- Properties ----------------
 const props=new Map(Object.entries(options.properties||{}));
 const scriptProperties={
  getProperty(k){fault('PROPERTIES',{key:k,op:'read'});return props.has(k)?props.get(k):null;},
  setProperty(k,v){fault('PROPERTIES',{key:k,op:'write'});props.set(k,String(v));return scriptProperties;},
  deleteProperty(k){props.delete(k);return scriptProperties;},
  getProperties(){return Object.fromEntries(props);}
 };
 // ---------------- Triggers ----------------
 const triggers=[];let triggerSeq=0;
 const builder=handler=>{const b={timeBased:()=>b,after:()=>b,atHour:()=>b,nearMinute:()=>b,everyDays:()=>b,inTimezone:()=>b,create(){const id=String(++triggerSeq);const t={getHandlerFunction:()=>handler,getUniqueId:()=>id};triggers.push(t);return t;}};return b;};
 // ---------------- Odds API transport ----------------
 const fetches=[],responses=[];
 const UrlFetchApp={fetch(url){fetches.push(url.replace(/apiKey=[^&]+/,'apiKey=REDACTED'));if(!responses.length)throw new Error('No mock response queued');const r=responses.shift();if(r.throws)throw new Error(r.throws);
  return {getResponseCode:()=>r.code||200,getAllHeaders:()=>r.headers||{},getContentText:()=>typeof r.body==='string'?r.body:JSON.stringify(r.body)};}};
 // ---------------- Shared key library ----------------
 const ledger=new Map(),libraryCalls=[];let charged=0;
 const libraryFaults={response:0,reserve:0};
 const SharedNFL={registerNBA:()=>({registered:true}),admin:()=>({slots:[]}),runtime(action,data){
  libraryCalls.push(action);
  const busy=()=>{const e=new Error('Shared key store is busy. No request was sent.');e.sharedSafe=true;throw e;};
  if(action==='free_key')return {slot:{label:'KEY 1',key:'MOCK_SECRET'}};
  if(action==='slots')return {slots:[{id:'KEY 1',preferred:true,available:400,used:100,last_cost:5,enabled:true,state:'HEALTHY',checked_utc:'2026-11-02T12:00:00Z'}]};
  if(action==='reserve'){if(libraryFaults.reserve>0){libraryFaults.reserve--;busy();}const id='nba:'+data.run_id+':'+data.operation;ledger.set(id,{state:'HELD',expected:data.expected_credits,actual:null,settle_count:0});return {slot:{label:'KEY 1',key:'MOCK_SECRET'},reservation_id:id};}
  const row=ledger.get(data.reservation_id);if(!row)throw new Error('Reservation missing');
  if(action==='sent'){if(row.state!=='HELD')throw new Error('already submitted');row.state='SENT';return {state:'SENT'};}
  if(action==='unknown'){if(row.state!=='SETTLED')row.state='UNKNOWN';return {state:row.state};}
  if(action==='response'){
   if(libraryFaults.response>0){libraryFaults.response--;busy();}
   if(row.state==='SETTLED')return {state:'SETTLED',replayed:true};
   const v=data.headers&&data.headers['x-requests-last'];row.actual=v===undefined?null:Number(v);row.state=row.actual===null?'UNKNOWN':'SETTLED';row.settle_count++;if(row.actual)charged+=row.actual;return {state:row.state};
  }
  throw new Error('unknown action '+action);
 }};
 // ---------------- Context ----------------
 let clock=Date.parse(options.now||'2026-11-02T20:00:00.000Z');
 const RealDate=Date;
 class MockDate extends RealDate{constructor(...a){if(a.length)super(...a);else super(clock);}static now(){return clock;}}
 const log=[];
 const context=vm.createContext({
  console:{log:()=>{},warn:()=>{},error:()=>{}},Date:MockDate,JSON,Math,
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,getUi:()=>{throw new Error('No UI in tests');}},
  DriveApp:{getFolderById:()=>folder,getFoldersByName:()=>iter([folder]),createFolder:()=>folder,getFilesByName:n=>iter([...files.values()].filter(f=>f.name===n)),createFile:(n,t)=>makeFile(n,t)},
  PropertiesService:{getScriptProperties:()=>scriptProperties},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){},hasLock:()=>false}),getDocumentLock:()=>({tryLock:()=>true,releaseLock(){}})},
  ScriptApp:{getProjectTriggers:()=>triggers.slice(),newTrigger:builder,deleteTrigger(t){const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1);},requireScopes(){},AuthMode:{FULL:'FULL'}},
  UrlFetchApp,SharedNFL,
  Utilities:{getUuid:(()=>{let n=0;return ()=>'uuid-'+(++n);})(),formatDate:(d,tz,p)=>formatDate(d,tz,p),sleep(){}},
  MimeType:{PLAIN_TEXT:'text/plain'},Session:{getEffectiveUser:()=>({getEmail:()=>''}),getActiveUser:()=>({getEmail:()=>''})},
  MailApp:{sendEmail(){throw new Error('email must not be sent in tests');},getRemainingDailyQuota:()=>0}
 });
 vm.runInContext(fs.readFileSync(SOURCE_PATH,'utf8'),context,{filename:'NbaOddsLoader.gs'});
 const env={context,sheets,ss,files,props,triggers,fetches,responses,ledger,libraryCalls,libraryFaults,faults,cells,driveWrites,log,
  run:code=>vm.runInContext(code,context),
  advance(ms){clock+=ms;},now:()=>clock,setNow(iso){clock=Date.parse(iso);},
  charged:()=>charged,
  sheet(name){return sheets.get(name)||ss.insertSheet(name);},
  tab(name){const s=sheets.get(name);return s?s.data.slice(1,s.getLastRow()):[];},
  file(name){return [...files.values()].find(f=>f.name===name)||null;},
 };
 return env;
}

// Two upcoming games on INDEX, both selected.
const HOME1='Boston Celtics',AWAY1='New York Knicks',HOME2='Denver Nuggets',AWAY2='Los Angeles Lakers';
function seedIndex(env,games){
 const h=env.run('INDEX_HEADERS.concat(INDEX_EXTRA)'),idx=env.run('IDX');
 const rows=[h];
 games.forEach(g=>{const r=Array(h.length).fill('');r[idx.EVENT]=g.id;r[idx.MATCHUP]=g.away+' @ '+g.home;r[idx.LOAD]=true;r[idx.HOME]=g.home;r[idx.AWAY]=g.away;r[idx.KICKOFF]=g.kickoff;rows.push(r);});
 env.sheet('INDEX').data=rows;
}
function defaultGames(env,offsetHours){
 const kick=new Date(env.now()+(offsetHours===undefined?3:offsetHours)*3600000).toISOString();
 return [{id:'event1',home:HOME1,away:AWAY1,kickoff:kick},{id:'event2',home:HOME2,away:AWAY2,kickoff:kick}];
}
function standardEvent(env,game,price){
 const t=new Date(env.now()).toISOString();
 const market=(key,player,line)=>({key,last_update:t,outcomes:[{name:'Over',description:player,point:line,price:price||-110},{name:'Under',description:player,point:line,price:-110}]});
 return {id:game.id,home_team:game.home,away_team:game.away,commence_time:game.kickoff,bookmakers:[{key:'draftkings',markets:[
  market('player_points','Player One '+game.id,20.5),market('player_rebounds','Player One '+game.id,7.5),market('player_assists','Player Two '+game.id,5.5),
  market('player_threes','Player Two '+game.id,2.5),market('player_points_rebounds_assists','Player One '+game.id,32.5)]}]};
}
function alternateEvent(env,game){
 const t=new Date(env.now()).toISOString();
 return {id:game.id,home_team:game.home,away_team:game.away,commence_time:game.kickoff,bookmakers:[{key:'draftkings',markets:[
  {key:'player_points_alternate',last_update:t,outcomes:[{name:'Over',description:'Player One '+game.id,point:15.5,price:-250},{name:'Over',description:'Player One '+game.id,point:25.5,price:180}]}]}]};
}
const okHeaders=n=>({'x-requests-last':String(n),'x-requests-used':String(100+n),'x-requests-remaining':String(400-n)});
// Runs the background worker until the staged run finishes.
function runWorker(env,max){
 for(let i=0;i<(max||40);i++){
  const state=env.run('nbaStageState_()');if(!state||state.state!=='RUNNING')return state;
  env.run('continueNbaMobileLoad()');env.advance(60000);
 }
 return env.run('nbaStageState_()');
}
function startLoad(env,includeAlternates,requestId){
 const plan=env.run('mobilePropsPlan_(false,'+(includeAlternates===true)+')');
 env.context.__plan=plan;
 return {plan,result:env.run('mobileLoadAndExport(__plan,'+JSON.stringify(requestId||'req-'+Math.random().toString(36).slice(2,12))+')')};
}
module.exports={makeEnv,seedIndex,defaultGames,standardEvent,alternateEvent,okHeaders,runWorker,startLoad};
