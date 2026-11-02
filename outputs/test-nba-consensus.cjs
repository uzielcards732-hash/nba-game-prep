'use strict';
// Phase 2 price comparison: the ten-book request, DraftKings vs Fanatics,
// MARKET_CONSENSUS with price_gap_pp, and the overcharge hold. Offline,
// mock-only: no network, no credentials, no email.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const m=require('./nba-mock-env.cjs');
const mobile=fs.readFileSync(path.join(__dirname,'Mobile.html'),'utf8');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n').slice(0,process.env.VERBOSE?12:2).join(' | '));}}
const plain=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
const TEN='draftkings,fanatics,fanduel,betmgm,williamhill_us,betrivers,hardrockbet,pinnacle,betonlineag,lowvig';

// One game with DraftKings and reference books. Player One points 20.5:
//   DraftKings Over +120 / Under -150 (break-even 100/220 = 45.45%; 150/250 = 60.00%)
//   fanatics   Over +100 / Under -120 -> no-vig Over 47.83
//   fanduel    Over -105 / Under -115 -> no-vig Over 48.92
//   betmgm     Over -110 / Under -110 -> no-vig Over 50.00
//   williamhill_us at 21.5 (different line, not counted)
//   hardrockbet at 20.5 but updated 20 minutes from DraftKings (not counted)
//   pinnacle   Over only at 20.5 (counted at the line, one-sided, no no-vig)
// Consensus Over = median(47.83, 48.92, 50.00) = 48.92; gap = 48.92 - 45.45 = 3.47.
// Books at the line = fanatics, fanduel, betmgm, pinnacle = 4.
function setup(options){const env=m.makeEnv(options);const games=m.defaultGames(env).slice(0,1);m.seedIndex(env,games);return {env,game:games[0]};}
function multiBookEvent(env,game,opts){
 opts=opts||{};const t=new Date(env.now()).toISOString(),stale=new Date(env.now()-20*60000).toISOString(),P='Player One '+game.id;
 const book=(key,over,under,line,time,onlyOver)=>({key,markets:[{key:'player_points',last_update:time||t,outcomes:[{name:'Over',description:P,point:line===undefined?20.5:line,price:over}].concat(onlyOver?[]:[{name:'Under',description:P,point:line===undefined?20.5:line,price:under}])},
  {key:'player_rebounds',last_update:time||t,outcomes:[{name:'Over',description:P,point:7.5,price:-110},{name:'Under',description:P,point:7.5,price:-110}]}]});
 const books=[book('draftkings',opts.dkOver||120,-150)];
 if(!opts.dkOnly){books.push(book('fanatics',100,-120),book('fanduel',-105,-115),book('betmgm',-110,-110),book('williamhill_us',-110,-110,21.5),book('hardrockbet',-110,-110,20.5,stale),book('pinnacle',-102,null,20.5,t,true));}
 if(opts.fewBooks)books.splice(2);
 return {id:game.id,home_team:game.home,away_team:game.away,commence_time:game.kickoff,bookmakers:books};
}
function load(env,body,credits,requestId){env.responses.push({body,headers:m.okHeaders(credits||5)});m.startLoad(env,false,requestId||'req-'+Math.random().toString(36).slice(2,12));return m.runWorker(env);}
function exported(env){return plain(env.run('buildAnalysisExport_(requireGames_(),now_(),null)'));}
function overPricing(payload){return payload.prop_markets.find(q=>q.market_key==='player_points').pricing.over;}

test('the request names exactly ten books with DraftKings first, and the reviewed cost stays 5 credits per game',()=>{
 const {env,game}=setup();const plan=env.run('mobilePropsPlan_(false,false)');
 assert.equal(plan.max_total_odds_api_credits,5);assert.deepEqual(plain(plan.bookmakers_requested),TEN.split(','));
 load(env,multiBookEvent(env,game));assert.equal(env.fetches.length,1);
 assert.match(env.fetches[0],new RegExp('bookmakers='+TEN+'&markets=player_points,player_rebounds,player_assists,player_threes,player_points_rebounds_assists&'));
 assert.doesNotMatch(env.fetches[0],/regions=/,'bookmakers replaces regions');
});
test('an 11th book, a duplicate, or a list not led by DraftKings is refused before any provider call',()=>{
 for(const list of [TEN+',bovada','draftkings,fanatics,fanatics','fanatics,draftkings']){
  const {env}=setup();env.run('NBA_REQUEST_BOOKMAKERS='+JSON.stringify(list));
  assert.throws(()=>env.run('mobilePropsPlan_(false,false)'),/bookmaker list/);
  assert.throws(()=>env.run("oddsRequest_('/x','',true,'e',5,'run','op')"),/bookmaker list/);
  assert.equal(env.fetches.length,0);assert.equal(env.libraryCalls.filter(c=>c==='reserve').length,0);
 }
});
test('consensus is the median no-vig at the identical line; the gap is consensus minus break-even',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));const p=overPricing(exported(env));
 assert.equal(p.break_even_pct,45.45);assert.equal(p.consensus_no_vig_pct,48.92);assert.equal(p.price_gap_pp,3.47);
 assert.equal(p.books_at_line,4,'fanatics, fanduel, betmgm and one-sided pinnacle');
 assert.equal(p.best_reference_price,100);assert.equal(p.best_reference_book,'fanatics');
 assert.equal(p.market_reference_no_vig_pct,noVig(120,-150));
});
function noVig(a,b){const r=p=>p>0?100/(p+100):-p/(-p+100);return Math.round(r(a)/(r(a)+r(b))*10000)/100;}
test('a negative gap means DraftKings pays less than the reference books imply',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game,{dkOver:-130}));const p=overPricing(exported(env));
 // Break-even 130/230 = 56.52; gap = 48.92 - 56.52 = -7.60.
 assert.equal(p.break_even_pct,56.52);assert.equal(p.price_gap_pp,-7.6);
});
test('a book at another line, or updated more than 15 minutes from DraftKings, is not counted',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));
 const row=env.tab('MARKET_CONSENSUS').find(r=>r[2]==='player_points'&&r[4]==='Over');
 assert.equal(row[7],4);assert.equal(row[8],3,'three two-sided books in the consensus');
 assert.doesNotMatch(String(row[11]),/williamhill|hardrock/);
});
test('consensus needs three two-sided books; fewer gives a note, never a guess',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game,{fewBooks:true}));const p=overPricing(exported(env));
 assert.equal(p.consensus_no_vig_pct,null);assert.equal(p.price_gap_pp,null);assert.equal(p.consensus_note,'FEWER_THAN_3_BOOKS');assert.equal(p.books_at_line,1);
});
test('DraftKings rows are identical to a DraftKings-only response; only Fanatics is stored quote by quote',()=>{
 const a=setup(),b=setup();load(a.env,multiBookEvent(a.env,a.game),5,'req-same-aaaa');load(b.env,multiBookEvent(b.env,b.game,{dkOnly:true}),5,'req-same-aaaa');
 ['PROPS','NBA_PROPS','LINE_HISTORY','INDEX'].forEach(t=>assert.deepEqual(plain(a.env.tab(t)),plain(b.env.tab(t)),t));
 const compare=a.env.tab('COMPARE_QUOTES');assert.ok(compare.length>0);assert.ok(compare.every(r=>r[7]==='fanatics'));
 const consensus=a.env.tab('MARKET_CONSENSUS');assert.equal(consensus.filter(r=>r[4]==='STATUS').length,1);
 assert.equal(consensus.filter(r=>r[4]!=='STATUS').length,4,'one row per DraftKings quote with a book at the line: points O/U, rebounds O/U');
});
test('Fanatics at the identical line shows its price and the better book',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));const pm=exported(env).prop_markets.find(q=>q.market_key==='player_points');
 assert.equal(pm.pricing.over.fanatics_price,100);assert.equal(pm.pricing.over.best_price_book,'draftkings','+120 beats +100');
 assert.equal(pm.pricing.under.fanatics_price,-120);assert.equal(pm.pricing.under.best_price_book,'fanatics','-120 beats -150');
});
test('with no reference books or Fanatics, quotes say so and the load is unaffected',()=>{
 const {env,game}=setup();const state=load(env,multiBookEvent(env,game,{dkOnly:true}));assert.notEqual(state.state,'FAILED');
 const p=overPricing(exported(env));assert.equal(p.consensus_note,'NO_REFERENCE_BOOKS');assert.equal(p.fanatics_note,'NOT_OFFERED');assert.equal(p.best_price_book,'draftkings');
 assert.equal(env.tab('PROPS').length,1);
});
test('MARKET_CONSENSUS and COMPARE_QUOTES replace each event family on reload and keep only 7 days',()=>{
 const {env,game}=setup();const h=env.run('MARKET_CONSENSUS_HEADERS.slice()');
 env.sheet('MARKET_CONSENSUS').data=[h,['old-event','standard','player_points','X','Over',1,-110,3,3,50,-105,'fanduel','','', '2026-10-20T00:00:00.000Z'],['kept-event','standard','player_points','Y','Over',1,-110,3,3,50,-105,'fanduel','','','2026-11-01T00:00:00.000Z']];
 load(env,multiBookEvent(env,game));const first=env.tab('MARKET_CONSENSUS').length;
 env.advance(100*60000);load(env,multiBookEvent(env,game));const rows=env.tab('MARKET_CONSENSUS');
 assert.equal(rows.length,first,'reload replaced, not appended');assert.ok(!rows.some(r=>r[0]==='old-event'),'over 7 days dropped');assert.ok(rows.some(r=>r[0]==='kept-event'));
});
test('a comparison or consensus storage failure never fails the paid load or the export',()=>{
 const {env,game}=setup();env.faults.push({service:'SPREADSHEET',match:d=>['MARKET_CONSENSUS','COMPARE_QUOTES'].includes(d.sheet),remaining:99});
 const state=load(env,multiBookEvent(env,game));assert.notEqual(state.state,'FAILED');assert.equal(env.tab('PROPS').length,1);assert.equal(env.fetches.length,1);
 // Nothing was saved, so the quote says NOT_RECORDED and the LOG names the failure.
 const p=overPricing(exported(env));assert.equal(p.consensus_note,'NOT_RECORDED');assert.equal(p.fanatics_note,'NOT_REQUESTED');
 assert.ok(env.tab('LOG').some(r=>r[1]==='Market consensus'&&r[3]==='ERROR'));assert.ok(env.tab('LOG').some(r=>r[1]==='Comparison quotes'&&r[3]==='ERROR'));
});
test('a saved but unreadable comparison or consensus tab never fails the export',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));
 env.faults.push({service:'SPREADSHEET',match:d=>['MARKET_CONSENSUS','COMPARE_QUOTES'].includes(d.sheet)&&d.op==='read',remaining:99});
 const p=overPricing(exported(env));assert.equal(p.consensus_note,'CONSENSUS_UNAVAILABLE');assert.equal(p.fanatics_note,'COMPARISON_UNAVAILABLE');assert.equal(p.break_even_pct,45.45);
});
test('a game whose consensus was never saved says NOT_RECORDED',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));env.sheet('MARKET_CONSENSUS').data=[env.run('MARKET_CONSENSUS_HEADERS.slice()')];
 assert.equal(overPricing(exported(env)).consensus_note,'NOT_RECORDED');
});
test('a DraftKings price that no longer matches the saved consensus row is flagged, not priced',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));
 const props=env.sheet('PROPS'),h=env.run('propsHeaders_()'),col=h.indexOf('Points O');props.data[1][col]=130;
 const p=overPricing(exported(env));assert.equal(p.consensus_note,'DK_PRICE_CHANGED');assert.equal(p.price_gap_pp,null);
});
test('game lines: moneyline, spread and total comparison and consensus at identical lines',()=>{
 const {env,game}=setup();const t=new Date(env.now()).toISOString();
 const lines=(key,home,away,spread,total,over,under)=>({key,last_update:t,markets:[{key:'h2h',last_update:t,outcomes:[{name:game.home,price:home},{name:game.away,price:away}]},{key:'spreads',last_update:t,outcomes:[{name:game.home,price:-110,point:-spread},{name:game.away,price:-110,point:spread}]},{key:'totals',last_update:t,outcomes:[{name:'Over',price:over,point:total},{name:'Under',price:under,point:total}]}]});
 const event={id:game.id,home_team:game.home,away_team:game.away,commence_time:game.kickoff,bookmakers:[lines('draftkings',-150,130,3.5,220.5,-110,-110),lines('fanatics',-145,125,3.5,220.5,-105,-115),lines('fanduel',-150,130,3.5,220.5,-110,-110),lines('betmgm',-155,135,3.5,220.5,-110,-110)]};
 env.responses.push({body:[{id:game.id,home_team:game.home,away_team:game.away,commence_time:game.kickoff}]},{body:[event],headers:m.okHeaders(3)});
 env.run("mobileRefreshScheduleAndOdds(3,'req-lines-aaaa')");
 assert.match(env.fetches[1],new RegExp('bookmakers='+TEN+'&markets=h2h,spreads,totals'));
 const gm=exported(env).game_markets,home=gm.find(q=>q.market_key==='h2h'&&q.selection===game.home),total=gm.find(q=>q.market_key==='totals'&&q.selection==='Over');
 assert.equal(home.pricing.fanatics_price,-145);assert.equal(home.pricing.best_price_book,'fanatics');assert.equal(home.pricing.books_at_line,3);
 assert.equal(typeof home.pricing.consensus_no_vig_pct,'number');assert.equal(total.pricing.books_at_line,3);
});
test('each game reports which books returned data and how many DraftKings sides have a consensus',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));const g=exported(env).games[0];
 assert.deepEqual(g.market_consensus.families.standard,{status:'OFFERED',books_returned:['fanatics','fanduel','betmgm','williamhill_us','hardrockbet','pinnacle']});
 assert.equal(g.market_consensus.draftkings_sides,4);// Points: 3 two-sided books each side. Rebounds at 7.5: fanatics, fanduel, betmgm, williamhill_us, pinnacle = 5.
 assert.equal(g.market_consensus.sides_with_consensus,4);
 assert.equal(g.comparison.book,'fanatics');assert.equal(g.comparison.families.standard,'OFFERED');
});
test('no exported pricing field is named as a probability, edge, projection or forecast',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));const payload=exported(env),keys=new Set();
 const walk=v=>{if(v&&typeof v==='object'){Object.keys(v).forEach(k=>{keys.add(k);walk(v[k]);});}};walk(payload.prop_markets);walk(payload.games);
 [...keys].forEach(k=>assert.doesNotMatch(k,/prob|edge|project|forecast|predict/i,k));
});
test('a charge above the reviewed maximum keeps the paid data but pauses all paid requests until acknowledged',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game),10,'req-hold-aaaa');
 assert.equal(env.tab('PROPS').length,1,'paid data kept');const hold=JSON.parse(env.props.get('NBA_PAID_HOLD'));assert.equal(hold.actual,10);assert.equal(hold.expected,5);
 env.advance(120*60000);const plan=env.run('mobilePropsPlan_(true,false)');assert.ok(plan.paid_hold);env.context.__plan=plan;
 assert.throws(()=>env.run("mobileLoadAndExport(__plan,'req-hold-bbbb')"),/Paid Odds API requests are paused/);
 assert.throws(()=>env.run("mobileRefreshScheduleAndOdds(3,'req-hold-cccc')"),/paused/);assert.equal(env.fetches.length,1,'nothing else sent');
 assert.equal(env.run('acknowledgeOverchargeHold()').cleared,true);assert.equal(env.props.get('NBA_PAID_HOLD'),undefined);
 assert.equal(JSON.parse(env.props.get(env.run('nbaNightKey_()'))).counted,10,'the nightly cap counts the actual 10');
});
test('saved-response reuse refuses a pointer saved for a DraftKings-only request',()=>{
 const {env}=setup();env.props.set('NBA_LAST_RAW_standard_event1',JSON.stringify({run_id:'x',kind:'standard',event_id:'event1',captured_utc:new Date(env.now()-60000).toISOString(),markets:env.run('PROP_MARKETS.slice()'),bookmaker:'draftkings'}));
 assert.equal(env.run('mobilePropsPlan_(false,false)').max_prop_credits,5);
});
test('handoffs carry the pricing rules: the export instructions and the phone request agree',()=>{
 const {env,game}=setup();load(env,multiBookEvent(env,game));const payload=exported(env);
 assert.match(payload.pricing_instructions,/price_gap_pp is consensus_no_vig_pct minus break_even_pct/);assert.match(payload.pricing_instructions,/never a reason to pass/);
 const compact=plain(env.run('compactEventAnalysisPayload_')(payload,payload.games[0],payload.export_timestamp_utc,{filename:'a',drive_url:'b'}));assert.equal(compact.pricing_instructions,payload.pricing_instructions);
 assert.ok(compact.prop_markets.length===0||compact.prop_markets[0].pricing,'compact quotes keep their pricing');
 assert.match(mobile,/For every shortlisted pick, state price_gap_pp or its consensus_note\..*A pick with price_gap_pp below -2\.5 \(DraftKings pricier than a standard -110 market\) needs a specific stated reason to remain RECOMMENDED\./);
 assert.match(payload.pricing_instructions,/below -2\.5/);assert.doesNotMatch(mobile+payload.pricing_instructions,/negative price_gap_pp needs/);
 assert.match(mobile,/the gap alone never decides a pick/);
});
console.log('\n'+count+' passed, '+failures.length+' failed (NBA Phase 2 price comparison; offline, mock-only, zero provider credits).');
if(failures.length)process.exitCode=1;
