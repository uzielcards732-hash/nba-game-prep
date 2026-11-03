/** NBA game prep + secure key pool. The NFL project is a separate application. */
const SPORT = 'basketball_nba';
const BOOK = 'draftkings';
const API_BASE = 'https://api.the-odds-api.com/v4';
// V2 secondary provider. Its key is a separate Script Property and is never
// returned, written to a sheet, or logged. This adapter is intentionally
// limited to the preregistered one-event/two-market validation scope.
const SGO_API_BASE = 'https://api.sportsgameodds.com/v2';
const SGO_API_KEY_PROPERTY = 'SPORTSGAMEODDS_API_KEY';
const SGO_LEAGUE = 'NBA';
const SGO_TEST_MARKETS = Object.freeze({
  player_points: 'points-PLAYER_ID-game-ou-over',
  player_rebounds: 'rebounds-PLAYER_ID-game-ou-over',
  player_assists: 'assists-PLAYER_ID-game-ou-over',
  player_threes: 'threePointersMade-PLAYER_ID-game-ou-over',
  player_points_rebounds_assists: 'points+rebounds+assists-PLAYER_ID-game-ou-over'
});
const SGO_STAT_TO_MARKET = Object.freeze({
  points: 'player_points', rebounds: 'player_rebounds', assists: 'player_assists',
  threePointersMade: 'player_threes', 'points+rebounds+assists': 'player_points_rebounds_assists'
});
const CROSS_PROVIDER_KICKOFF_TOLERANCE_MS = 5 * 60 * 1000;
const SGO_PHASE2_RAW_FILENAME = 'sports_game_odds_phase2_raw_latest.json';
const PHASE4_ODDS_RAW_FILENAME = 'odds_api_phase4_raw_latest.json';
const PHASE4_DIAGNOSTIC_FILENAME = 'cross_provider_phase4_latest.json';

// NBA launch markets: five requested markets, up to five credits per event
// with one bookmaker. Every paid call remains previewed and confirmed.
const PROP_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_points_rebounds_assists'
];

// SportsGameOdds is disabled until its NBA coverage test is approved and completed.
const SPORTS_GAME_ODDS_NBA_ENABLED = false;

// Optional mobile ladders. They are never fetched unless the owner opts in
// during the cost review: five requested markets add at most five credits
// per stale selected game in the DraftKings US region.
const MOBILE_ALTERNATE_MARKETS = [
  'player_points_alternate',
  'player_rebounds_alternate',
  'player_assists_alternate',
  'player_threes_alternate',
  'player_points_rebounds_assists_alternate'
];

// Column block order in PROPS. Must match PROP_MARKETS.
const OU_MARKETS = [
  ['player_points',                  'Points'],
  ['player_rebounds',                'Rebounds'],
  ['player_assists',                 'Assists'],
  ['player_threes',                  'Threes'],
  ['player_points_rebounds_assists', 'PRA']
];

const TAB_INDEX = 'INDEX';
const TAB_PROPS = 'PROPS';
const TAB_ALT_PROPS = 'ALT_PROPS';
const TAB_ROSTER = 'ROSTER';
const TAB_PARLAYS = 'PARLAYS';
const TAB_LEGS = 'LEGS';
const TAB_PARLAY_ENTRY = 'PARLAY ENTRY';
const TAB_PERFORMANCE = 'PERFORMANCE';
const TAB_EXCEPTIONS = 'EXCEPTIONS';
const TAB_LINE_HISTORY = 'LINE_HISTORY';
const TAB_NBA_PROPS = 'NBA_PROPS';
const TAB_SGO_EVENT_MAP = 'SGO_EVENT_MAP';
const SLATE_FRESHNESS_MINUTES = 90;
const SGO_FRESHNESS_MINUTES = 90;
const SGO_DISCOVERY_LIMIT = 15;
const SLATES = [];
// These properties belong only to the separate NBA Script project.
const MOBILE_SPREADSHEET_ID_PROPERTY = 'NBA_MOBILE_SPREADSHEET_ID';
const MOBILE_WEB_TITLE = 'NBA Game Prep';
const MOBILE_APP_BUILD = '2026.11.03-nba-picks.1';
const MOBILE_EXPORT_FOLDER_PROPERTY = 'NBA_MOBILE_EXPORT_FOLDER_ID';
const MOBILE_EXPORT_FOLDER_NAME = 'NBA Game Prep Analysis Exports';
const MOBILE_LAST_EXPORT_PROPERTY = 'NBA_MOBILE_LAST_EXPORT';
const MOBILE_RUN_STATUS_PROPERTY = 'NBA_MOBILE_RUN_STATUS';
const MOBILE_EXPORT_RUN_PREFIX = 'NBA_MOBILE_EXPORT_RUN_';
const MOBILE_EMAIL_NOTIFICATIONS_PROPERTY = 'NBA_MOBILE_EMAIL_NOTIFICATIONS';
const MOBILE_EXPORT_EMAIL_PREFIX = 'NBA_MOBILE_EXPORT_EMAIL_';
const NBA_STAGE_STATE_PROPERTY = 'NBA_MOBILE_STAGE_STATE';
const NBA_STAGE_OPERATION_PREFIX = 'NBA_STAGE_OPERATION_';
const MOBILE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzRSWWd4ktxD1aKObbeDa5aHvRU1VdWfRQR8vhb724N3gVDNE5Y6XtEx6M_AFCAZhkO/exec';
const MOBILE_RUN_UNCONFIRMED_MINUTES = 10;
const NBA_DAILY_GAMES_STATUS_PROPERTY = 'NBA_DAILY_GAMES_STATUS';
const NBA_GAME_PRICE_FRESHNESS_MINUTES = 90;

const INDEX_HEADERS = [
  'eventId', 'Matchup', 'Kickoff ET', 'Favorite', 'Spread', 'Total',
  'Home ML', 'Away ML', 'Home ImpTot', 'Away ImpTot', 'Slate',
  'LOAD', 'Props Updated'
];

const TEAM_CODES = {}; // Team names are validated against each returned NBA event.

function normName_(s) {
  return String(s).toLowerCase()
    .replace(/[.'`\-]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PRICE_FLOOR = -300; // Exclusive lower bound for eligibility; raw prices are always retained.
const ROSTER_HEADERS = ['key','Player','Team','Pos','Status','Player ID','Source','Source Updated UTC','Fetched UTC'];
// New INDEX fields are appended only; existing column positions stay stable.
const INDEX_EXTRA = ['Home Team','Away Team','Kickoff UTC','Lines Updated UTC','Lines Source UTC','Bookmaker',
  'Home Spread Price','Away Spread Price','Total Over Price','Total Under Price'];
const LOG_HEADERS = ['UTC','Action','Event ID','Result','Detail','Request Credits','Used','Remaining'];
// Append-only raw provider observations. These are not selections, consensus
// values, or reconstructed prices; they are the exact normalized observations
// returned by a provider at a recorded source timestamp.
const LINE_HISTORY_HEADERS = ['History ID','Capture UTC','Source Updated UTC','Provider','Provider Event ID','Canonical Event Key','Bookmaker','Market Key','Provider Market Key','Provider Quote ID','Player ID','Player Key','Player','Player Team','Line','Side','American Price','Available','Capture Context'];
// Latest normalized observations. Provider records deliberately remain
// separate: the same DraftKings market from two APIs is not two sportsbooks.
const NBA_PROPS_HEADERS = ['Provider','Provider Event ID','Odds API Event ID','Game','Home Team','Away Team','Kickoff UTC','Bookmaker','Market Key','Provider Market Key','Player ID','Player Key','Player','Player Team','Line','Side','American Price','Available','Source Updated UTC','Retrieved UTC','Provider Quote ID','Capture Context'];
const SGO_EVENT_MAP_HEADERS = ['Odds API Event ID','SportsGameOdds Event ID','Home Team','Away Team','Kickoff UTC','Resolved UTC','Source'];
const ALT_PROPS_HEADERS = ['Player','Team','Pos','Status','Market Key','Line','Side','American Price','Game','Slate','Updated','Event ID','Bookmaker','Kickoff UTC','Market Source UTC','Roster Source','Roster Source Updated UTC','Roster Fetched UTC','Join Status','Validation Notes'];
const IDX = Object.freeze({EVENT:0,MATCHUP:1,SLATE:10,LOAD:11,PROPS_UPDATED:12,HOME:13,AWAY:14,KICKOFF:15,LINES_UPDATED:16,LINES_SOURCE:17,BOOK:18,HOME_SPREAD_PRICE:19,AWAY_SPREAD_PRICE:20,TOTAL_OVER_PRICE:21,TOTAL_UNDER_PRICE:22});
const KEY_POOL_STATE_PROPERTY = 'NBA_ODDS_API_KEY_POOL_STATE';
const KEY_POOL_PROPERTY_PREFIX = 'NBA_ODDS_API_KEY_';
const KEY_POOL_MAX_SLOTS = 8;
let nbaSharedRegistered_ = false;

function nbaSharedCall_(action,data,admin) {
  try {
    if(typeof SharedNFL==='undefined')fail_('The shared key library is unavailable. No request was sent.');
    if(!nbaSharedRegistered_){SharedNFL.registerNBA();nbaSharedRegistered_=true;}
    return admin?SharedNFL.admin(action,data||{}):SharedNFL.runtime(action,data||{});
  } catch(error) {
    if(error&&error.loaderSafe)throw error;
    // After a paid request was sent, the library's busy wording ("No request
    // was sent") is wrong. Say what is true; the saved response is kept.
    if(error&&error.sharedSafe&&['response','unknown'].includes(action)&&/No request was sent/.test(error.message))failService_('LIBRARY','Ledger update pending; the request was sent and its saved response is kept. No paid retry.');
    if(error&&error.sharedSafe)failService_('LIBRARY',error.message);
    if(['response','unknown'].includes(action))failService_('LIBRARY','Ledger update pending; the request was sent and its saved response is kept. No paid retry.');
    failService_('LIBRARY','The shared key pool is unavailable. No request was sent; no local-key fallback was used.');
  }
}
function nbaSharedKeyView_() {
  const pool=nbaSharedCall_('slots',{}),slots=pool.slots||[],preferred=slots.find(s=>s.preferred);
  return {shared:true,active_slot:preferred?preferred.id:'',notifications:mobileEmailSettings_(),slots:slots.map(s=>({
    label:s.id,configured:true,active:s.preferred,remaining:poolDisplayValue_(s.available),used:poolDisplayValue_(s.used),last_cost:poolDisplayValue_(s.last_cost),
    state:s.enabled?s.state:'DISABLED',updated:s.checked_utc||'NEVER',balance_checked:s.checked_utc||'',refresh_status:s.check_status||'CACHED',refresh_attempt:s.last_check_utc||'',reserved:s.reserved||0
  }))};
}

const PARLAY_HEADERS = [
  'Parlay ID','Created UTC','Slate / Label','Bookmaker','Leg Count',
  'Combined American Odds','Stake','Potential Payout','Status','Settled UTC',
  'Actual Profit/Loss','Notes','Submission Fingerprint','Adjusted Combined American Odds',
  'Adjusted Potential Payout','Settlement Detail'
];
const LEG_HEADERS = [
  'Leg ID','Parlay ID','Leg Number','Event ID','Event / Game','Player / Team',
  'Market','Side / Selection','Line','American Price','Bookmaker','Captured UTC',
  'Reasoning','Confidence','Estimated Probability','Closing Line',
  'Closing American Price','Status','Actual Stat / Score','Notes','nflverse Player ID',
  'nflverse Source URL','nflverse Asset Updated UTC','Graded UTC','Grading Detail',
  'Manual Availability Confirm','Manual Confirmed UTC','Manual Confirmed Game Status','Availability Gate','Availability Gate Detail'
];
const EXCEPTION_HEADERS = ['Season','Week','Source Name','Source Team','Event / Game','Candidate(s)','Reason','Manual nflverse Player ID','Resolution Status','Created UTC','Updated UTC','Leg ID'];
const NFLVERSE_CACHE_HEADERS = ['Cache Key','Dataset','Season','Week','Asset ID','Asset Name','Asset URL','Asset Updated UTC','Fetched UTC','Headers JSON','Row JSON'];
const NFLVERSE_CACHE_HOURS = 1;
const NFLVERSE_CACHE_GROUPS = 12;
const GITHUB_RELEASES_API = 'https://api.github.com/repos/nflverse/nflverse-data/releases';
const TRACKER_STATUSES = ['PENDING','WIN','LOSS','PUSH','VOID'];
const ENTRY_FIRST_LEG_ROW = 10;
const ENTRY_LEG_COLUMNS = 11;
const PARLAY_LEG_COUNT_DEFAULT = 3;
const PARLAY_LEG_COUNT_MIN = 2;
const PARLAY_LEG_COUNT_MAX = 5;

// Availability gate: nflverse injuries CSV, discovered the same way as
// PLAYER_STATS/SCHEDULE (GitHub releases API, no hardcoded filename).
const STATUS_SOURCE_INJURY_REPORT = 'INJURY_REPORT';
const STATUS_SOURCE_MANUAL = 'MANUAL_INACTIVES';
const INJURY_BLOCKING_STATUSES = ['QUESTIONABLE','DOUBTFUL','OUT'];
const INJURIES_CACHE_HOURS = 3;
const AVAILABILITY_CONFIRM_WINDOW_MINUTES = 90;

function onOpen() {
  // The project is bound only to the NBA workbook. Recording this id here
  // makes the owner-only web app usable without a separate manual setup step.
  const active=SpreadsheetApp.getActiveSpreadsheet();
  if(active)PropertiesService.getScriptProperties().setProperty(MOBILE_SPREADSHEET_ID_PROPERTY,active.getId());
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('NBA Tools')
    .addItem('Refresh Schedule and Odds (3 credits)','loadWeek')
    .addItem('Load and Analyze Selected Games (credits)','loadAndAnalyzeSelectedGames')
    .addSeparator()
    .addSubMenu(ui.createMenu('Advanced')
      .addItem('Refresh INDEX only','refreshIndex')
      .addItem('Refresh Game Lines (3 credits)','refreshGameLines')
      .addItem('Pull Props on Its Own (credits)','loadCheckedProps')
      .addItem('Force Refresh Props (credits)','forceRefreshSelectedProps')
      .addItem('Export for Analysis on Its Own','exportSelectedGamesForAnalysis')
      .addItem('Clear LOAD selections','clearSelections')
      .addItem('Set up NBA Game Prep','setupMobileControlCenter')
      .addItem('Check Credit Balance','showCredits')
      .addItem('Check API Key Pool','showApiKeyPool')
      .addItem('Reset / Re-enable API Key Pool','resetApiKeyPool'))
    .addSubMenu(ui.createMenu('Diagnostics')
      .addItem('Preview SportsGameOdds NBA coverage test','sportsGameOddsAutoTestDryRun'))
    .addToUi();
}
function now_() { return new Date().toISOString(); }
function spreadsheet_() {
  // Bound-sheet calls use the active workbook. Web-app calls do not have one,
  // so they use the owner-configured ID set by setupMobileControlCenter().
  try { const active=SpreadsheetApp.getActiveSpreadsheet(); if(active)return active; } catch(ignore) {}
  const id=PropertiesService.getScriptProperties().getProperty(MOBILE_SPREADSHEET_ID_PROPERTY);
  if(!id)fail_('NBA Game Prep is not connected yet. In the NBA Sheet, use NBA Tools → Advanced → Set up NBA Game Prep.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) { const ss=spreadsheet_(); return ss.getSheetByName(name)||ss.insertSheet(name); }
function read_(name,width) {
  const s=sheet_(name); return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,width).getValues();
}
// Write new values before removing surplus old rows; do not clear whole sheets/formatting.
// Sheets is not transactional; keep the backup described in INSTALL.md.
function write_(name,headers,rows) {
  const s=sheet_(name), old=s.getLastRow();
  s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  if(rows.length) s.getRange(2,1,rows.length,headers.length).setValues(rows.map(r=>r.map(cell_)));
  if(old>rows.length+1) s.getRange(rows.length+2,1,old-rows.length-1,headers.length).clearContent();
  s.setFrozenRows(1);
}
function cell_(v) { return typeof v==='string' && /^[=+@\-]/.test(v)?"'"+v:v; }
// Replace one game's rows without rewriting the whole tab: read only the
// columns the match needs, append the new rows, then delete the replaced rows
// bottom-up in contiguous blocks. The result equals rewriting
// old.filter(row=>!isReplaced(row)).concat(newRows), with far less Sheets I/O
// as the tabs grow. isReplaced sees a sparse row holding only keyCols.
function replaceRows_(name,headers,keyCols,isReplaced,newRows) {
  const s=sheet_(name);
  s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');s.setFrozenRows(1);
  const last=s.getLastRow(),count=Math.max(0,last-1),cols={},drop=[];
  if(count)keyCols.forEach(c=>{cols[c]=s.getRange(2,c+1,count,1).getValues();});
  for(let i=0;i<count;i++){const row=[];keyCols.forEach(c=>{row[c]=cols[c][i][0];});if(isReplaced(row))drop.push(i+2);}
  if(newRows.length)s.getRange(last+1,1,newRows.length,headers.length).setValues(newRows.map(r=>r.map(cell_)));
  // Sheets refuses to delete every unfrozen row; an emptied tab is cleared instead.
  if(count&&drop.length===count&&!newRows.length){s.getRange(2,1,count,headers.length).clearContent();return {removed:count,added:0};}
  for(let i=drop.length-1;i>=0;){let n=1;while(i-n>=0&&drop[i-n]===drop[i]-n)n++;s.deleteRows(drop[i]-n+1,n);i-=n;}
  return {removed:drop.length,added:newRows.length};
}
// LOG is an audit trail, not a gate, once a paid request has been sent: a LOG
// write failure must never discard paid data or fail the load. The PLANNED row
// before a send is the one exception and uses logRequired_, so a request is
// never sent without its expected cost recorded.
const LOG_WRITE_FAILED_PROPERTY='NBA_LOG_WRITE_FAILED';
function log_(action,event,result,detail,cost,used,remaining) {
  try{logRequired_(action,event,result,detail,cost,used,remaining);return true;}
  catch(ignore){noteLogWriteFailure_(action);return false;}
}
function logWriteWarning_() {try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(LOG_WRITE_FAILED_PROPERTY)||'null');}catch(ignore){return null;}}
function noteLogWriteFailure_(action) {
  // Only a count, times and our own action label; never the native error text.
  try{
    const p=PropertiesService.getScriptProperties();let m=null;try{m=JSON.parse(p.getProperty(LOG_WRITE_FAILED_PROPERTY)||'null');}catch(ignore){}
    const time=now_();m=m&&typeof m==='object'?m:{count:0,first_utc:time};
    m.count=(Number(m.count)||0)+1;m.last_utc=time;m.last_action=String(action||'').slice(0,60);
    p.setProperty(LOG_WRITE_FAILED_PROPERTY,JSON.stringify(m));
  }catch(ignore){}
}
function logRequired_(action,event,result,detail,cost,used,remaining) {
  const s=sheet_('LOG');
  if(s.getLastRow()<=1) s.getRange(1,1,1,LOG_HEADERS.length).setValues([LOG_HEADERS]);
  s.appendRow([now_(),action,event||'',result,detail,cost===undefined?'UNKNOWN':cost,used===undefined?'':used,remaining===undefined?'':remaining]);
}
function run_(action,fn) {
  // Web apps have no document context, so fall back to the script-wide lock.
  let lock;try{lock=LockService.getDocumentLock();}catch(ignore){}if(!lock)lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Another loader is running. Try later.');
  try { return fn(); }
  catch(e) { log_(action,'','ERROR',safeError_(e)); throw new Error(safeError_(e)); }
  finally { lock.releaseLock(); }
}

// -----------------------------------------------------------------------------
// Phase 1 mobile control center. Read INDEX and synchronize only its existing
// LOAD checkboxes. No Odds API calls or other paid actions are exposed here.
function doGet(e) {
  if(e&&e.parameter&&e.parameter.health==='1')return mobileHealthPage_();
  return HtmlService.createHtmlOutputFromFile('Mobile')
    .setTitle(MOBILE_WEB_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
function mobileHealthPage_() {
  const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<body style="background:#07111e;color:#f4f7ff;font:16px -apple-system;padding:24px">'
    +'<h1>NBA Game Prep connection check</h1><p id="state">JavaScript started. Checking the Sheet…</p>'
    +'<script>var state=document.getElementById("state");if(!(window.google&&google.script&&google.script.run)){state.textContent="Browser JavaScript ran, but the Apps Script bridge is unavailable.";}else{google.script.run.withSuccessHandler(function(result){state.textContent=result.ok?"Connected. INDEX contains "+result.index_rows+" game rows.":"Apps Script ran, but Sheet access failed: "+result.error;}).withFailureHandler(function(error){state.textContent="Apps Script call failed: "+((error&&error.message)||String(error));}).mobileHealthCheck();}</script>'
    +'</body>';
  return HtmlService.createHtmlOutput(html).setTitle('NBA Game Prep connection check').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
function mobileHealthCheck() {
  try {
    const ss=spreadsheet_(),index=ss.getSheetByName(TAB_INDEX);
    return {ok:true,index_rows:index?Math.max(0,index.getLastRow()-1):0};
  } catch(e) { return {ok:false,error:safeError_(e)}; }
}
function setupMobileControlCenter() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)fail_('Open the NBA spreadsheet before setting up NBA Game Prep.');
  PropertiesService.getScriptProperties().setProperty(MOBILE_SPREADSHEET_ID_PROPERTY,ss.getId());
  SpreadsheetApp.getUi().alert('NBA Game Prep connected. It can now read this workbook and save only INDEX LOAD selections. It has no paid actions until a separately approved release.');
}
function mobileDateValue_(value) {
  if(value===undefined||value===null||value==='')return '';
  if(Object.prototype.toString.call(value)==='[object Date]')return value.toISOString();
  return String(value);
}
function nbaGameTime_(value,now) {
  const timestamp=Date.parse(mobileDateValue_(value));
  if(!Number.isFinite(timestamp))return {date_key:'unknown',day_label:'Date unavailable',group_label:'Date unavailable',time_label:'Tipoff unavailable',full_label:'Tipoff unavailable'};
  const date=new Date(timestamp),zone='America/New_York',today=Utilities.formatDate(new Date(now===undefined?Date.now():now),zone,'yyyy-MM-dd');
  const parts=today.split('-').map(Number),tomorrow=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+1)).toISOString().slice(0,10);
  const key=Utilities.formatDate(date,zone,'yyyy-MM-dd'),day=Utilities.formatDate(date,zone,'EEE, MMM d'),time=Utilities.formatDate(date,zone,'h:mm a')+' ET';
  return {date_key:key,day_label:day,group_label:(key===today?'Today · ':key===tomorrow?'Tomorrow · ':key<today?'Past · ':'')+day,time_label:time,full_label:day+' · '+time};
}
function mobileIndexTable_() {
  const ss=spreadsheet_(),s=ss.getSheetByName(TAB_INDEX);
  if(!s||s.getLastRow()<2)return [];
  return s.getRange(2,1,s.getLastRow()-1,INDEX_HEADERS.length+INDEX_EXTRA.length).getValues();
}
function mobileDashboard() {
  const now=Date.now(),rows=mobileIndexTable_();
  return {title:MOBILE_WEB_TITLE,app_build:MOBILE_APP_BUILD,generated_utc:now_(),slates:SLATES.slice(),paid_actions_available:false,last_export:mobileLastExport_(),candidate_log:candidateLogStatus_(mobileLastExport_()),operation:mobileRunStatus_(),daily_games:nbaDailyGamesStatus_(),
    games:rows.filter(r=>String(r[IDX.EVENT]||'').trim()).map(r=>{
      const updated=mobileDateValue_(r[IDX.PROPS_UPDATED]),updatedMs=Date.parse(updated),kickoffUtc=mobileDateValue_(r[IDX.KICKOFF]),kickoffMs=Date.parse(kickoffUtc);
      const started=Number.isFinite(kickoffMs)&&kickoffMs<=now,linesUtc=mobileDateValue_(r[IDX.LINES_UPDATED]),priceFreshness=nbaGameOddsFresh_(r,new Date(now).toISOString()),time=nbaGameTime_(kickoffUtc,now);
      return {event_id:String(r[IDX.EVENT]),matchup:String(r[IDX.MATCHUP]||''),slate:time.day_label,game_date_et:time.date_key,game_day_label:time.group_label,tipoff_time_et:time.time_label,
        home_team:mobileDateValue_(r[IDX.HOME]),away_team:mobileDateValue_(r[IDX.AWAY]),kickoff_et:time.full_label,kickoff_utc:kickoffUtc,selected:r[IDX.LOAD]===true,
        props_updated_utc:updated,props_fresh:Number.isFinite(updatedMs)&&now-updatedMs>=0&&now-updatedMs<SLATE_FRESHNESS_MINUTES*60000,
        game_state:started?'STARTED':(Number.isFinite(updatedMs)&&now-updatedMs>=0&&now-updatedMs<SLATE_FRESHNESS_MINUTES*60000?'FRESH':'STALE'),
        game_odds_updated_utc:linesUtc,game_odds_fresh:priceFreshness.fresh,game_odds_freshness_reason:priceFreshness.reason,
        odds:{favorite:mobileDateValue_(r[3]),spread:mobileDateValue_(r[4]),total:mobileDateValue_(r[5]),home_moneyline:mobileDateValue_(r[6]),away_moneyline:mobileDateValue_(r[7]),bookmaker:mobileDateValue_(r[IDX.BOOK])}};
    }).sort((a,b)=>(Date.parse(a.kickoff_utc)||Infinity)-(Date.parse(b.kickoff_utc)||Infinity))};
}
function nbaDailyGamesStatus_() {
  const raw=PropertiesService.getScriptProperties().getProperty(NBA_DAILY_GAMES_STATUS_PROPERTY);
  let last=null;try{last=raw?JSON.parse(raw):null;}catch(ignore){}
  if(last&&last.completed_utc)last.completed_et=nbaGameTime_(last.completed_utc).full_label;
  let triggerCount=null;
  try{triggerCount=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction&&t.getHandlerFunction()==='nbaDailyGamesRefresh').length;}catch(ignore){}
  return {schedule:'On demand (no daily trigger installed)',trigger_count:triggerCount,last_run:last};
}
function nbaDailyGamesRefresh() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY',credits:0};
  const record={status:'RUNNING',started_utc:now_(),credits:0};
  try {
    const staged=nbaStageState_();
    if(staged&&staged.state==='RUNNING'){record.status='BUSY';record.completed_utc=now_();record.message='An NBA export is running; the game list was not changed.';return record;}
    PropertiesService.getScriptProperties().setProperty(NBA_DAILY_GAMES_STATUS_PROPERTY,JSON.stringify(record));
    refreshIndexCore_();
    record.status='SUCCEEDED';record.completed_utc=now_();record.game_count=mobileIndexTable_().length;
  } catch(e) {record.status='FAILED';record.completed_utc=now_();record.message=safeError_(e);}
  finally {PropertiesService.getScriptProperties().setProperty(NBA_DAILY_GAMES_STATUS_PROPERTY,JSON.stringify(record));lock.releaseLock();}
  return record;
}
function nbaInstallDailyGamesRefresh() {
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction&&t.getHandlerFunction()==='nbaDailyGamesRefresh');
  if(existing.length>1)fail_('Multiple daily NBA game-list triggers exist. Resolve them before setup.');
  if(!existing.length)ScriptApp.newTrigger('nbaDailyGamesRefresh').timeBased().atHour(9).nearMinute(0).everyDays(1).inTimezone('America/New_York').create();
  return nbaDailyGamesStatus_();
}
function mobileRefreshGamesFree() {return nbaDailyGamesRefresh();}
function mobileLastExport_() {
  const raw=PropertiesService.getScriptProperties().getProperty(MOBILE_LAST_EXPORT_PROPERTY);
  if(!raw)return null;
  try {
    const value=JSON.parse(raw);
    if(!value||typeof value!=='object'||!Array.isArray(value.event_ids)||typeof value.drive_url!=='string'||typeof value.export_timestamp_utc!=='string')return null;
    const out={filename:String(value.filename||''),drive_url:value.drive_url,export_timestamp_utc:value.export_timestamp_utc,event_ids:value.event_ids.map(String)};
    if(typeof value.provider_coverage_summary==='string')out.provider_coverage_summary=value.provider_coverage_summary;
    if(typeof value.analysis_manifest_filename==='string')out.analysis_manifest_filename=value.analysis_manifest_filename;
    if(typeof value.analysis_manifest_drive_url==='string')out.analysis_manifest_drive_url=value.analysis_manifest_drive_url;
    if(typeof value.app_build==='string')out.app_build=value.app_build;
    if(typeof value.snapshot_id==='string')out.snapshot_id=value.snapshot_id;
    if(Array.isArray(value.analysis_eligible_event_ids))out.analysis_eligible_event_ids=value.analysis_eligible_event_ids.map(String);
    if(Array.isArray(value.analysis_ineligible_event_ids))out.analysis_ineligible_event_ids=value.analysis_ineligible_event_ids.map(String);
    if(Array.isArray(value.games))out.games=value.games.map(game=>({event_id:String(game.event_id||''),matchup:String(game.matchup||''),kickoff_et:String(game.kickoff_et||''),kickoff_utc:String(game.kickoff_utc||''),analysis_eligible:game.analysis_eligible===true}));
    if(value.receipt&&typeof value.receipt==='object')out.receipt=value.receipt;
    return out;
  } catch(e) { return null; }
}
function saveMobileLastExport_(exported) {
  const value={filename:String(exported.filename||''),drive_url:String(exported.driveUrl||''),export_timestamp_utc:String(exported.exportTimestampUtc||''),event_ids:(exported.eventIds||[]).map(String)};
  if(typeof exported.providerCoverageSummary==='string')value.provider_coverage_summary=exported.providerCoverageSummary;
  if(typeof exported.analysisManifestFilename==='string')value.analysis_manifest_filename=exported.analysisManifestFilename;
  if(typeof exported.analysisManifestDriveUrl==='string')value.analysis_manifest_drive_url=exported.analysisManifestDriveUrl;
  if(typeof exported.appBuild==='string')value.app_build=exported.appBuild;
  if(typeof exported.snapshotId==='string')value.snapshot_id=exported.snapshotId;
  if(Array.isArray(exported.eligibleEventIds))value.analysis_eligible_event_ids=exported.eligibleEventIds.map(String);
  if(Array.isArray(exported.ineligibleEventIds))value.analysis_ineligible_event_ids=exported.ineligibleEventIds.map(String);
  if(Array.isArray(exported.games))value.games=exported.games.map(game=>({event_id:String(game.event_id||''),matchup:String(game.matchup||''),kickoff_et:String(game.kickoff_et||''),kickoff_utc:String(game.kickoff_utc||''),analysis_eligible:game.analysis_eligible===true}));
  if(exported.receipt&&typeof exported.receipt==='object')value.receipt=exported.receipt;
  PropertiesService.getScriptProperties().setProperty(MOBILE_LAST_EXPORT_PROPERTY,JSON.stringify(value));
  return value;
}
function mobileEmailSettings_() {
  let recipient='';
  try { recipient=String(Session.getEffectiveUser().getEmail()||'').trim(); } catch(ignore) {}
  return {enabled:PropertiesService.getScriptProperties().getProperty(MOBILE_EMAIL_NOTIFICATIONS_PROPERTY)==='true',recipient:recipient,recipient_available:!!recipient};
}
function mobileEmailNotificationSettings() { return mobileEmailSettings_(); }
function mobileSetEmailNotifications(enabled) {
  const properties=PropertiesService.getScriptProperties();
  if(enabled===true)properties.setProperty(MOBILE_EMAIL_NOTIFICATIONS_PROPERTY,'true');
  else properties.deleteProperty(MOBILE_EMAIL_NOTIFICATIONS_PROPERTY);
  return mobileEmailSettings_();
}
function mobileExportEmailAttempt_(runId,exported) {
  const settings=mobileEmailSettings_();
  if(!settings.enabled)return {enabled:false,status:'DISABLED'};
  if(!settings.recipient_available)return {enabled:true,status:'UNAVAILABLE',message:'Owner Google account email is unavailable; export remains ready.'};
  const key=MOBILE_EXPORT_EMAIL_PREFIX+String(runId||exported.snapshotId||exported.filename),properties=PropertiesService.getScriptProperties(),existing=properties.getProperty(key);
  if(existing) {
    try { return JSON.parse(existing); } catch(ignore) { return {enabled:true,status:'ATTEMPTED',message:'A completion email was already attempted for this export.'}; }
  }
  const matchups=(exported.games||[]).map(game=>game.matchup).filter(Boolean),warnings=(exported.warnings||[]).filter(Boolean),receipt=exported.receipt||{};
  const attempt={enabled:true,status:'ATTEMPTED',recipient:settings.recipient,attempted_utc:now_()};
  properties.setProperty(key,JSON.stringify(attempt)); // Persist before sending so completed-run replays never send twice.
  try {
    const credits=receipt.total_charge_unconfirmed?'Confirmed '+Number(receipt.confirmed_credits||0)+'; total charge unconfirmed':String(Number(receipt.confirmed_credits||0))+' confirmed';
    MailApp.sendEmail({to:settings.recipient,subject:'NBA export ready · '+matchups.length+' game'+(matchups.length===1?'':'s'),body:'Your NBA Game Prep export is ready.\n\nCompleted: '+exported.exportTimestampUtc+'\nGames: '+(matchups.join(' / ')||'Unavailable')+'\nOdds API credits: '+credits+'\nWarnings: '+(warnings.join(' | ')||'None')+'\n\nAudit export: '+exported.driveUrl+'\nAnalysis manifest: '+exported.analysisManifestDriveUrl+'\n\nOpen NBA Game Prep: '+MOBILE_WEB_APP_URL});
    attempt.status='SENT';attempt.sent_utc=now_();properties.setProperty(key,JSON.stringify(attempt));return attempt;
  } catch(e) {
    attempt.status='FAILED';attempt.message='Completion email could not be sent; export remains ready.';attempt.failed_utc=now_();properties.setProperty(key,JSON.stringify(attempt));return attempt;
  }
}
// Mobile run state contains progress only. It never contains a request URL,
// response, credential, or other private provider data.
function mobileRunStatus_() {
  const properties=PropertiesService.getScriptProperties(),raw=properties.getProperty(MOBILE_RUN_STATUS_PROPERTY);
  if(!raw)return null;
  let value;try { value=JSON.parse(raw); } catch(e) { return null; }
  if(!value||typeof value!=='object'||!['RUNNING','SUCCEEDED','FAILED','UNCONFIRMED'].includes(value.state))return null;
  const out={id:String(value.id||''),state:value.state,action:String(value.action||''),step:String(value.step||''),started_utc:String(value.started_utc||''),updated_utc:String(value.updated_utc||''),event_ids:Array.isArray(value.event_ids)?value.event_ids.map(String):[],matchups:Array.isArray(value.matchups)?value.matchups.map(String):[]};
  if(typeof value.message==='string')out.message=value.message;
  const staged=out.action==='load_and_export'?nbaReconcileUnstartedRun_():null;
  if(staged&&staged.run_id===out.id){
    if(staged.state==='RUNNING'){
      out.step=String(staged.stage||'working').toLowerCase();out.updated_utc=String(staged.updated_utc||out.updated_utc);
      out.message=String(staged.message||'This load is continuing in the background.');
      out.partial=staged.partial||null;
      const leaseEnd=Date.parse(staged.lease_until_utc||'');
      if(!Number.isFinite(leaseEnd)||leaseEnd<Date.now()) {
        try {if(!nbaContinuationTriggers_().length)nbaArmContinuation_(60000);}
        catch(e) {
          out.message=safeError_(e);
          if((staged.stage_attempts||0)===0&&staged.stage==='LOAD'&&(staged.cursor||0)===0) {
            // No worker claimed this run, so no paid step could have started.
            staged.state='FAILED';staged.message=out.message;nbaSaveStageState_(staged);
            saveMobileExportRun_(staged.run_id,{state:'FAILED',signature:staged.signature,created_utc:staged.started_utc,updated_utc:now_(),message:out.message});
            out.state='FAILED';out.step='failed';
          } else {out.state='UNCONFIRMED';out.step='completion_unconfirmed';}
        }
      }
      return out;
    }
    if(staged.state==='SUCCEEDED'||staged.state==='PARTIAL'){out.state='SUCCEEDED';out.step='export_ready';out.message='Export ready.';return out;}
    if(staged.state==='FAILED'){out.state='FAILED';out.step='failed';out.message=String(staged.message||'The load stopped.');out.partial=staged.partial||null;return out;}
  }
  if(out.state==='RUNNING') {
    const started=Date.parse(out.started_utc);
    if(Number.isFinite(started)&&Date.now()-started>MOBILE_RUN_UNCONFIRMED_MINUTES*60000) {
      out.state='UNCONFIRMED';out.step='completion_unconfirmed';out.message='Completion could not be confirmed. Review the latest export before starting another request.';out.updated_utc=now_();
      properties.setProperty(MOBILE_RUN_STATUS_PROPERTY,JSON.stringify(out));
    }
  }
  return out;
}
function mobileBeginRun_(action,games,requestId) {
  const id=typeof requestId==='string'&&/^[a-z0-9-]{8,80}$/i.test(requestId)?requestId:Utilities.getUuid();
  const value={id:id,state:'RUNNING',action:String(action),step:'starting',started_utc:now_(),updated_utc:now_(),event_ids:(games||[]).map(g=>String(g.id||g)),matchups:(games||[]).map(g=>String(g.matchup||''))};
  PropertiesService.getScriptProperties().setProperty(MOBILE_RUN_STATUS_PROPERTY,JSON.stringify(value));
  return value;
}
function mobileUpdateRun_(run,step,message) {
  if(!run||!run.id)return;
  const value=mobileRunStatus_();
  if(!value||value.id!==run.id||value.state!=='RUNNING')return;
  value.step=String(step);value.updated_utc=now_();if(message)value.message=String(message);
  PropertiesService.getScriptProperties().setProperty(MOBILE_RUN_STATUS_PROPERTY,JSON.stringify(value));
}
function mobileFinishRun_(run,state,message) {
  if(!run||!run.id)return;
  const value=mobileRunStatus_();
  if(!value||value.id!==run.id)return;
  value.state=state;value.step=state==='SUCCEEDED'?'export_ready':'failed';value.updated_utc=now_();value.message=String(message||'');
  PropertiesService.getScriptProperties().setProperty(MOBILE_RUN_STATUS_PROPERTY,JSON.stringify(value));
}
function mobileOperationStatus(requestId) {
  const current=mobileRunStatus_(),latest=mobileLastExport_();
  if(requestId===undefined||requestId===null||requestId==='')return {operation:current,last_export:latest};
  if(typeof requestId!=='string'||!/^[a-z0-9-]{8,80}$/i.test(requestId))fail_('Invalid run ID.');
  const saved=mobileExportRun_(requestId),operation=current&&current.id===requestId?current:(saved?{id:requestId,action:'load_and_export',state:saved.state==='SUCCEEDED'?'SUCCEEDED':saved.state==='FAILED'?'FAILED':'UNCONFIRMED',step:saved.state==='SUCCEEDED'?'export_ready':'completion_unconfirmed',message:saved.message||'',started_utc:saved.created_utc||'',updated_utc:saved.updated_utc||'',event_ids:[],matchups:[],partial:saved.partial||null}:null);
  return {requested_run_id:requestId,operation:operation,last_export:latest,requested_export:saved&&saved.state==='SUCCEEDED'?saved.export:null};
}
function mobileClearOperationStatus(expectedId) {
  const current=mobileRunStatus_();
  // A running request belongs to the server, not the browser tab. Never make
  // a second device believe it cleared that request.
  if(current&&current.state==='RUNNING')return {operation:current,last_export:mobileLastExport_()};
  if(current&&current.id===String(expectedId||'')) {
    PropertiesService.getScriptProperties().deleteProperty(MOBILE_RUN_STATUS_PROPERTY);
    return {operation:null,last_export:mobileLastExport_()};
  }
  // Return an unexpected finished state so the client can show a recovery
  // message instead of silently accepting another paid request.
  return {operation:current,last_export:mobileLastExport_()};
}
// Mobile key-pool controls never return or log a credential. The owner-only
// app may store a replacement key directly in Script Properties.
function mobileKeyPoolView_() {
  return nbaSharedKeyView_();
}
function nbaLegacyKeyPoolView_() {
  const slots=configuredKeySlots_(true),state=readKeyPoolState_(slots),available={};slots.forEach(slot=>available[slot.label]=true);
  return {active_slot:state.active,notifications:mobileEmailSettings_(),slots:Array.from({length:KEY_POOL_MAX_SLOTS},(_,index)=>{
    const label='KEY '+(index+1),configured=available[label]===true,record=state.slots[label]||{};
    return {label:label,configured:configured,active:configured&&label===state.active,remaining:configured?poolDisplayValue_(record.remaining):'—',used:configured?poolDisplayValue_(record.used):'—',last_cost:configured?poolDisplayValue_(record.last):'—',state:configured?String(record.state||'UNKNOWN'):'NOT CONFIGURED',updated:configured?(record.updated||'NEVER'):'—',balance_checked:record.balanceChecked||'',refresh_status:record.refreshStatus||'CACHED',refresh_attempt:record.refreshAttempt||''};
  })};
}
function mobileKeyPoolStatus() { return mobileKeyPoolView_(); }
function mobileSaveApiKey(label,value,replace) {
  fail_('NBA uses the shared owner key pool. Manage keys in the owner dashboard; do not enter them again here.');
}
function nbaLegacySaveApiKey_(label,value,replace) {
  const match=/^KEY ([1-9][0-9]*)$/.exec(String(label||'').trim()),key=String(value||'').trim();
  if(!match||Number(match[1])>KEY_POOL_MAX_SLOTS)fail_('Choose a valid key slot.');
  if(key.length<12||key.length>256||/\s/.test(key))fail_('That key format is invalid. Nothing was saved.');
  return run_('NBA API key update',()=>{
    const property=KEY_POOL_PROPERTY_PREFIX+match[1],properties=PropertiesService.getScriptProperties(),all=properties.getProperties();
    Object.keys(all).forEach(name=>{
      if(name!==property&&name.indexOf(KEY_POOL_PROPERTY_PREFIX)===0&&String(all[name]).trim()===key)fail_('This API key is already configured in another NBA slot.');
    });
    if(properties.getProperty(property)&&replace!==true)fail_('That slot already has a key. Confirm replacement to continue.');
    properties.setProperty(property,key);
    properties.deleteProperty(KEY_POOL_STATE_PROPERTY);
    const slots=configuredKeySlots_(),state=readKeyPoolState_(slots);writeKeyPoolState_(state);
    log_('NBA API key update','KEY '+match[1],'SUCCESS','Credential stored in Script Properties; cached pool state reset; zero Odds API credits',0);
    return mobileKeyPoolView_();
  });
}
// Explicit free check: one request per distinct key, including exhausted slots.
// Do not use request_ here: its free-request retries and rotation are unwanted.
function mobileRefreshCreditBalances() {
  nbaSharedCall_('check_balances',{},true);
  return mobileKeyPoolView_();
}
function nbaLegacyRefreshCreditBalances_() {
  return run_('Credit balance refresh',()=>{
    const slots=configuredKeySlots_(),state=readKeyPoolState_(slots);
    slots.forEach(slot=>{
      const record=state.slots[slot.label];record.refreshAttempt=now_();
      try {
        const response=UrlFetchApp.fetch(API_BASE+'/sports?apiKey='+encodeURIComponent(slot.key),{muteHttpExceptions:true,followRedirects:false});
        const code=response.getResponseCode(),headers=response.getAllHeaders()||{};
        if(code===200){
          record.remaining=numberHeader_(headers,'x-requests-remaining');
          record.used=numberHeader_(headers,'x-requests-used');
          record.last=numberHeader_(headers,'x-requests-last');
          record.updated=record.refreshAttempt;record.errorCode='';
          record.state=record.remaining===null?'UNKNOWN':record.remaining===0?'EXHAUSTED':'HEALTHY';
          record.refreshStatus=record.remaining===null?'MISSING_HEADERS':'SUCCESS';
          record.balanceChecked=record.remaining===null?'':record.refreshAttempt;
        }else{
          const error=apiErrorCode_(response.getContentText());
          record.refreshStatus=code===429||error==='EXCEEDED_FREQ_LIMIT'?'RATE_LIMITED':'HTTP_ERROR';
          if(['INVALID_KEY','DEACTIVATED_KEY','MISSING_KEY'].includes(error)){
            record.state='DISABLED';record.errorCode=error;record.refreshStatus='INVALID_KEY';
          }else if(error==='OUT_OF_USAGE_CREDITS'){
            record.remaining=0;record.state='EXHAUSTED';record.errorCode=error;
            record.updated=record.refreshAttempt;record.balanceChecked=record.refreshAttempt;record.refreshStatus='EXHAUSTED';
          }
        }
      }catch(ignore){record.refreshStatus='CHECK_FAILED';}
      // Persist each result independently; never log a response body or URL.
      writeKeyPoolState_(state);
      log_('Credit balance refresh',slot.label,record.refreshStatus,'Free sports endpoint; active slot preserved',0);
    });
    return mobileKeyPoolView_();
  });
}

function mobileSetActiveKey(label) {
  fail_('The preferred key is shared with NFL. Change it in the owner dashboard.');
}
function nbaLegacySetActiveKey_(label) {
  const requested=String(label||'').trim();
  if(!/^KEY [1-9][0-9]*$/.test(requested))fail_('Choose a configured key slot.');
  return run_('Mobile key pool',()=>{
    const slots=configuredKeySlots_(),state=readKeyPoolState_(slots);
    if(!slots.some(slot=>slot.label===requested))fail_('That key slot is not configured in Script Properties.');
    state.active=requested;writeKeyPoolState_(state);
    log_('Mobile key pool',requested,'SUCCESS','Active slot selected manually; zero Odds API credits',0);
    return mobileKeyPoolView_();
  });
}
function mobileResetKeyPool() {
  fail_('Shared reservations cannot be reset from NBA. Use the owner dashboard.');
}
function nbaLegacyResetKeyPool_() {
  return run_('Mobile key pool reset',()=>{
    const properties=PropertiesService.getScriptProperties();properties.deleteProperty(KEY_POOL_STATE_PROPERTY);
    const slots=configuredKeySlots_(),state=readKeyPoolState_(slots);writeKeyPoolState_(state);
    log_('Mobile key pool reset','','SUCCESS','Cached slot state reset; zero Odds API credits',0);
    return mobileKeyPoolView_();
  });
}
function mobileSaveSelections(eventIds) {
  if(!Array.isArray(eventIds))fail_('Selections must be a list of event IDs.');
  const wanted={},clean=[];
  eventIds.forEach(id=>{const value=String(id||'').trim();if(!/^[A-Za-z0-9_-]+$/.test(value))fail_('Invalid event ID.');if(!wanted[value]){wanted[value]=true;clean.push(value);}});
  return run_('Mobile selections',()=>{
    return mobileSaveSelectionsCore_(clean,wanted);
  });
}
function mobileSaveSelectionsCore_(clean,wanted) {
  const ss=spreadsheet_(),s=ss.getSheetByName(TAB_INDEX);if(!s||s.getLastRow()<2)fail_('INDEX has no games. Refresh Schedule and Odds first.');
  const rows=s.getRange(2,1,s.getLastRow()-1,INDEX_HEADERS.length+INDEX_EXTRA.length).getValues(),known={};
  rows.forEach(r=>known[String(r[IDX.EVENT])]=true);
  clean.forEach(id=>{if(!known[id])fail_('Selected event is not present on INDEX. Refresh the page and try again.');});
  rows.forEach((r,i)=>s.getRange(i+2,IDX.LOAD+1).setValue(!!wanted[String(r[IDX.EVENT])]));
  log_('Mobile selections',clean.join(','),'SUCCESS',clean.length+' selected; zero Odds API credits',0);
  return {count:clean.length,selected_event_ids:clean};
}
function mobilePrepareSelections(eventIds,forceRefresh,includeAlternateProps) {
  if(!Array.isArray(eventIds))fail_('Selections must be a list of event IDs.');
  const wanted={},clean=[];
  eventIds.forEach(id=>{const value=String(id||'').trim();if(!/^[A-Za-z0-9_-]+$/.test(value))fail_('Invalid event ID.');if(!wanted[value]){wanted[value]=true;clean.push(value);}});
  if(!clean.length)fail_('Select at least one game first.');
  return run_('Mobile selection review',()=>({selection:mobileSaveSelectionsCore_(clean,wanted),plan:mobilePropsPlan_(forceRefresh===true,includeAlternateProps===true)}));
}
function altPropsUpdatedForEvent_(eventId) {
  const headers=ALT_PROPS_HEADERS,updated=headers.indexOf('Updated'),event=headers.indexOf('Event ID');
  const times=read_(TAB_ALT_PROPS,headers.length).filter(r=>String(r[event])===String(eventId)).map(r=>Date.parse(r[updated])).filter(Number.isFinite);
  return times.length?new Date(Math.max.apply(null,times)).toISOString():'';
}
function nbaQuoteTimeFresh_(value,now) {
  const updated=Date.parse(exportValue_(value)),age=now-updated;
  return Number.isFinite(updated)&&age>=0&&age<SLATE_FRESHNESS_MINUTES*60000;
}
function nbaStandardCacheFresh_(eventId,rows,now) {
  const headers=propsHeaders_(),event=headers.indexOf('Event ID'),written=headers.indexOf('Updated'),sources=headers.indexOf('Market Source Times JSON');
  const matches=rows.filter(row=>String(row[event])===String(eventId));
  if(!matches.length)return false;
  return matches.every(row=>{
    if(!nbaQuoteTimeFresh_(row[written],now))return false;
    let times;try{times=JSON.parse(String(row[sources]||''));}catch(ignore){return false;}
    const keys=Object.keys(times||{}).filter(key=>PROP_MARKETS.includes(key));
    return keys.length>0&&keys.every(key=>nbaQuoteTimeFresh_(times[key],now));
  });
}
function nbaAlternateCacheFresh_(eventId,rows,now) {
  const event=ALT_PROPS_HEADERS.indexOf('Event ID'),written=ALT_PROPS_HEADERS.indexOf('Updated'),source=ALT_PROPS_HEADERS.indexOf('Market Source UTC');
  const matches=rows.filter(row=>String(row[event])===String(eventId));
  return matches.length>0&&matches.every(row=>nbaQuoteTimeFresh_(row[written],now)&&nbaQuoteTimeFresh_(row[source],now));
}
function mobilePropsPlan_(forceRefresh,includeAlternateProps) {
  const now=Date.now(),games=requireGames_(),force=forceRefresh===true,includeAlternates=includeAlternateProps===true;
  const standardRows=read_(TAB_PROPS,propsHeaders_().length),alternateRows=includeAlternates?read_(TAB_ALT_PROPS,ALT_PROPS_HEADERS.length):[];
  const reusable=[],toLoad=[],alternateReusable=[],alternateToLoad=[],started=[];
  games.forEach(g=>{
    // A started game cannot be loaded: it costs nothing and is never requested.
    const kickoff=Date.parse(mobileDateValue_(g.kickoff));
    if(Number.isFinite(kickoff)&&kickoff<=now){started.push({event_id:g.id,matchup:g.matchup,kickoff_utc:mobileDateValue_(g.kickoff),reason:'Started — not loadable, 0 credits.'});return;}
    const fresh=nbaStandardCacheFresh_(g.id,standardRows,now),saved=!fresh&&!force?nbaSavedResponsePointer_('standard',g.id,now):null;
    if(saved){reusable.push({event_id:g.id,matchup:g.matchup,kickoff_utc:mobileDateValue_(g.kickoff),props_updated_utc:mobileDateValue_(g.propsUpdated),reason:'Reused saved response — 0 credits.',reuse_saved_response:{run_id:saved.run_id,captured_utc:saved.captured_utc}});}
    else (fresh&&!force?reusable:toLoad).push({event_id:g.id,matchup:g.matchup,kickoff_utc:mobileDateValue_(g.kickoff),props_updated_utc:mobileDateValue_(g.propsUpdated),reason:fresh&&!force?'Props are under '+SLATE_FRESHNESS_MINUTES+' minutes old.':force?'Force refresh selected.':'Props are missing or older than '+SLATE_FRESHNESS_MINUTES+' minutes.'});
    if(includeAlternates) {
      const alternateUpdated=altPropsUpdatedForEvent_(g.id),alternateFresh=nbaAlternateCacheFresh_(g.id,alternateRows,now),alternateSaved=!alternateFresh&&!force?nbaSavedResponsePointer_('alternate',g.id,now):null;
      if(alternateSaved)alternateReusable.push({event_id:g.id,matchup:g.matchup,alternate_props_updated_utc:alternateUpdated,reason:'Reused saved response — 0 credits.',reuse_saved_response:{run_id:alternateSaved.run_id,captured_utc:alternateSaved.captured_utc}});
      else (alternateFresh&&!force?alternateReusable:alternateToLoad).push({event_id:g.id,matchup:g.matchup,alternate_props_updated_utc:alternateUpdated,reason:alternateFresh&&!force?'Alternate props are under '+SLATE_FRESHNESS_MINUTES+' minutes old.':force?'Force refresh selected.':'Alternate props are missing or older than '+SLATE_FRESHNESS_MINUTES+' minutes.'});
    }
  });
  const ids=games.map(g=>g.id);
  return {generated_utc:now_(),event_ids:ids,selection_signature:JSON.stringify(ids),force_refresh:force,
    reusable_props:reusable,games_requiring_refresh:toLoad,max_prop_credits:toLoad.length*PROP_MARKETS.length,
    include_alternate_props:includeAlternates,alternate_reusable_props:alternateReusable,alternate_games_requiring_refresh:alternateToLoad,
    alternate_markets:MOBILE_ALTERNATE_MARKETS.slice(),max_alternate_prop_credits:alternateToLoad.length*MOBILE_ALTERNATE_MARKETS.length,
    max_total_odds_api_credits:toLoad.length*PROP_MARKETS.length+alternateToLoad.length*MOBILE_ALTERNATE_MARKETS.length,
    started_games:started,night_cap:nbaNightView_(),bookmakers_requested:requestBookmakers_().split(','),paid_hold:paidHold_(),
    roster_validation:'NBA player-team enrichment is not included in this load. Live research must confirm unresolved player identity.',no_automatic_paid_retries:true,
    sports_game_odds:sportsGameOddsMobilePlan_(games.filter(g=>!started.some(s=>s.event_id===g.id)),force)};
}
// -----------------------------------------------------------------------------
// Nightly credit cap. Every paid Odds API request counts its expected cost
// against tonight's cap (Eastern calendar date) before anything is sent, and
// the count moves to the actual charge once x-requests-last is known. An
// unconfirmed outcome keeps its expected cost: the cap over-counts, never
// under-counts.
const NBA_NIGHT_CAP_CREDITS=160;
const NBA_NIGHT_CREDITS_PREFIX='NBA_NIGHT_CREDITS_';
function nbaNightKey_(ms) {return NBA_NIGHT_CREDITS_PREFIX+Utilities.formatDate(new Date(ms===undefined?Date.now():ms),'America/New_York','yyyy-MM-dd');}
function nbaNightRead_(key) {
  let value=null;try{value=JSON.parse(PropertiesService.getScriptProperties().getProperty(key)||'null');}catch(ignore){value=null;}
  return value&&typeof value==='object'&&Number.isFinite(value.counted)?value:{counted:0,requests:0};
}
function nbaNightView_() {
  const key=nbaNightKey_(),value=nbaNightRead_(key);
  return {night_et:key.slice(NBA_NIGHT_CREDITS_PREFIX.length),cap:NBA_NIGHT_CAP_CREDITS,counted:value.counted,remaining:Math.max(0,NBA_NIGHT_CAP_CREDITS-value.counted)};
}
function nbaNightReserve_(expected) {
  const key=nbaNightKey_(),value=nbaNightRead_(key);
  if(value.counted+expected>NBA_NIGHT_CAP_CREDITS)failNotSent_('Tonight\'s '+NBA_NIGHT_CAP_CREDITS+'-credit cap would be exceeded ('+value.counted+' counted + '+expected+' requested = '+(value.counted+expected)+'). No request was sent.');
  const first=value.requests===0;value.counted+=expected;value.requests++;value.updated_utc=now_();
  try{PropertiesService.getScriptProperties().setProperty(key,JSON.stringify(value));}
  catch(e){failNotSent_('Tonight\'s credit count could not be recorded, so no request was sent.');}
  if(first)nbaNightPrune_(key);
  return {key:key,expected:expected};
}
function nbaNightSettle_(ticket,actual) {
  if(!ticket||actual===null||!Number.isFinite(actual)||actual===ticket.expected)return;
  try{const value=nbaNightRead_(ticket.key);value.counted=Math.max(0,value.counted+actual-ticket.expected);value.updated_utc=now_();PropertiesService.getScriptProperties().setProperty(ticket.key,JSON.stringify(value));}
  catch(ignore){/* Keeping the expected cost over-counts, which is the safe direction. */}
}
function nbaNightPrune_(currentKey) {
  try{
    const properties=PropertiesService.getScriptProperties(),cutoff=nbaNightKey_(Date.now()-14*24*60*60*1000);
    Object.keys(properties.getProperties()).filter(k=>k.indexOf(NBA_NIGHT_CREDITS_PREFIX)===0&&k!==currentKey&&k<cutoff).forEach(k=>properties.deleteProperty(k));
  }catch(ignore){}
}
// -----------------------------------------------------------------------------
// Cross-run reuse of saved paid responses. After a raw response is saved, a
// small pointer records where it is. Within 90 minutes of the original capture
// and only for the same event, markets and bookmaker, a later plan replays
// that file instead of buying it again.
const NBA_SAVED_RESPONSE_PREFIX='NBA_LAST_RAW_';
function nbaSavedResponseMarkets_(kind) {return (kind==='alternate'?MOBILE_ALTERNATE_MARKETS:PROP_MARKETS).slice();}
function nbaSaveResponsePointer_(runId,kind,eventId,capturedUtc) {
  try{PropertiesService.getScriptProperties().setProperty(NBA_SAVED_RESPONSE_PREFIX+kind+'_'+eventId,JSON.stringify({run_id:runId,kind:kind,event_id:eventId,captured_utc:capturedUtc,markets:nbaSavedResponseMarkets_(kind),bookmaker:requestedBooks_().join(',')}));}
  catch(ignore){/* Reuse is an optimization; a missing pointer only means no reuse. */}
}
function nbaSavedResponsePointer_(kind,eventId,nowMs) {
  let pointer=null;try{pointer=JSON.parse(PropertiesService.getScriptProperties().getProperty(NBA_SAVED_RESPONSE_PREFIX+kind+'_'+eventId)||'null');}catch(ignore){return null;}
  if(!pointer||pointer.kind!==kind||String(pointer.event_id)!==String(eventId)||pointer.bookmaker!==requestedBooks_().join(','))return null;
  if(JSON.stringify(pointer.markets)!==JSON.stringify(nbaSavedResponseMarkets_(kind)))return null;
  const age=nowMs-Date.parse(pointer.captured_utc||'');
  return Number.isFinite(age)&&age>=0&&age<SLATE_FRESHNESS_MINUTES*60000?pointer:null;
}
// -----------------------------------------------------------------------------
// Shared ledger settlement. When the free ledger write fails after a paid
// response arrived, the response is kept and the write is retried later under
// the same reservation ID. The library replays an already SETTLED row without a
// second charge, and no paid request is ever repeated.
const NBA_LEDGER_PENDING_PREFIX='NBA_LEDGER_PENDING_';
function nbaSafeHeaders_(headers) {
  const out={};['x-requests-last','x-requests-used','x-requests-remaining'].forEach(k=>{const v=header_(headers||{},k);if(v!==undefined&&v!==null&&v!=='')out[k]=v;});return out;
}
function nbaLedgerPendingSave_(reservationId,code,safeHeaders,label,eventId) {
  try{PropertiesService.getScriptProperties().setProperty(NBA_LEDGER_PENDING_PREFIX+reservationId,JSON.stringify({reservation_id:reservationId,http_code:code,headers:safeHeaders,label:String(label||'').slice(0,40),event_id:String(eventId||''),created_utc:now_()}));return true;}
  catch(ignore){return false;}
}
function nbaLedgerSettleOne_(reservationId,code,safeHeaders) {
  const result=nbaSharedCall_('response',{reservation_id:reservationId,http_code:code,headers:safeHeaders||{}});
  try{PropertiesService.getScriptProperties().deleteProperty(NBA_LEDGER_PENDING_PREFIX+reservationId);}catch(ignore){}
  return result&&result.state==='SETTLED'?'SETTLED':'UNKNOWN';
}
// Settles every pending ledger write: the global pending records, then the
// run's own journal entries (the backup when the pending record itself could
// not be saved). Returns what is still pending; never throws.
function nbaLedgerSweep_(state,job) {
  const out={settled:0,pending:[]},done={};
  let all={};try{all=PropertiesService.getScriptProperties().getProperties()||{};}catch(ignore){}
  Object.keys(all).filter(k=>k.indexOf(NBA_LEDGER_PENDING_PREFIX)===0).forEach(k=>{
    let record=null;try{record=JSON.parse(all[k]);}catch(ignore){}
    if(!record||!record.reservation_id){out.pending.push(k.slice(NBA_LEDGER_PENDING_PREFIX.length));return;}
    try{nbaLedgerSettleOne_(record.reservation_id,record.http_code,record.headers);done[record.reservation_id]=true;out.settled++;}
    catch(ignore){out.pending.push(record.reservation_id);}
  });
  if(state&&job){
    nbaLoadSteps_(job).forEach(step=>{
      let op=null;try{op=nbaOperation_(state.run_id,step.kind,step.event_id);}catch(ignore){}
      if(!op||op.ledger_state!=='SETTLEMENT_PENDING'||!op.reservation_id)return;
      if(!done[op.reservation_id]){
        if(out.pending.indexOf(op.reservation_id)>=0)return;
        try{nbaLedgerSettleOne_(op.reservation_id,op.http_code,op.safe_headers);out.settled++;}
        catch(ignore){out.pending.push(op.reservation_id);return;}
      }
      op.ledger_state='SETTLED';try{nbaOperation_(state.run_id,step.kind,step.event_id,op);}catch(ignore){}
    });
  }
  return out;
}
function mobileLoadPlan(forceRefresh,includeAlternateProps) { return mobilePropsPlan_(forceRefresh===true,includeAlternateProps===true); }
function mobileAssertPlan_(plan) {
  if(!plan||typeof plan!=='object'||!Array.isArray(plan.event_ids)||typeof plan.selection_signature!=='string')fail_('Refresh the mobile preview before confirming.');
  const current=mobilePropsPlan_(plan.force_refresh===true,plan.include_alternate_props===true);
  if(plan.selection_signature!==current.selection_signature)fail_('Game selection changed. Refresh the preview before confirming.');
  if(Number(plan.max_prop_credits)!==current.max_prop_credits)fail_('Prop freshness changed. Refresh the preview before confirming.');
  if(Number(plan.max_alternate_prop_credits)!==Number(current.max_alternate_prop_credits)||Number(plan.max_total_odds_api_credits)!==Number(current.max_total_odds_api_credits))fail_('Alternate-prop freshness changed. Refresh the preview before confirming.');
  if(!plan.sports_game_odds||Number(plan.sports_game_odds.max_returned_event_objects)!==Number(current.sports_game_odds.max_returned_event_objects))fail_('SportsGameOdds freshness changed. Refresh the preview before confirming.');
  return current;
}
function loadPropsForGames_(games,onProgress,preparedRoster) {
  const roster=[]; // NBA player identity remains unknown until a provider supplies it.
  let successes=0,stoppedMessage='',warnings=[],charges=[];
  for(const g of games) {
    try {
      if(onProgress)onProgress(g);
      const expected=PROP_MARKETS.length;
      logRequired_('Mobile props',g.id,'PLANNED','Expected '+expected+' credits; no automatic paid retry.',expected);
      const response=oddsRequest_('/sports/'+SPORT+'/events/'+encodeURIComponent(g.id)+'/odds','bookmakers='+requestBookmakers_()+'&markets='+PROP_MARKETS.join(',')+'&oddsFormat=american',true,g.id,expected),payload=json_(response,'Odds');
      charges.push({event_id:g.id,key_slot:response.slot?response.slot.label:'',actual_credits:numberHeader_(response.headers,'x-requests-last')});
      const time=now_(),rows=propsRows_(g,payload,roster,time);
      replacePropsRows_(rows,g);
      let mirrored=false;
      try { writeLatestNormalizedProps_(normalizeOddsApiEvent_(payload,BOOK),g.id,'mobile_odds_api_refresh');mirrored=true; }
      catch(normalizeError) { log_('NBA_PROPS',g.id,'ERROR','Odds API props loaded but normalized mirror was not updated: '+safeError_(normalizeError),0); }
      if(!mirrored)recordOddsApiLineHistorySafely_(payload,'mobile_props_refresh',g.id);
      recordComparisonQuotesSafely_(payload,'standard',time);
      const idx=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),i=idx.findIndex(r=>r[0]===g.id);
      if(i>=0)sheet_(TAB_INDEX).getRange(i+2,IDX.PROPS_UPDATED+1).setValue(time);
      log_('Mobile props',g.id,'SUCCESS',rows.length+' rows; '+rows.filter(r=>r[38]!=='MATCHED').length+' unresolved joins',0);successes++;
    } catch(e) {
      const message=safeError_(e);warnings.push(g.matchup+': '+message);log_('Mobile props',g.id,'ERROR',message,0);
      if(e&&e.stopPaidBatch){stoppedMessage=message;break;}
    }
  }
  return {successes:successes,total:games.length,warnings:warnings,stopped_message:stoppedMessage,charges:charges};
}
function mobileRefreshScheduleAndOdds(approvedCredits,requestId) {
  if(Number(approvedCredits)!==3)fail_('Refresh Schedule and Odds requires explicit approval of exactly 3 credits.');
  return run_('Mobile schedule and odds',()=>{
    const staged=nbaStageState_();
    if(staged&&staged.state==='RUNNING')fail_('An NBA export is running. Wait for it before refreshing game odds. No credits were spent.');
    try{nbaLedgerSweep_(null,null);}catch(ignore){}
    assertNoPaidHold_();
    const night=nbaNightView_();
    if(night.remaining<3)fail_('Tonight\'s '+night.cap+'-credit cap has '+night.remaining+' left; game odds need 3. No request was sent.');
    const run=mobileBeginRun_('schedule_and_odds',[],requestId);
    try {
      mobileUpdateRun_(run,'refreshing_schedule','Refreshing the NBA schedule.');
      refreshIndexCore_(); // free events refresh; preserves current checkboxes for matching events
      const rows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length);if(!rows.length)fail_('INDEX has no games after refresh.');
      mobileUpdateRun_(run,'loading_game_odds','Loading game lines.');
      logRequired_('Mobile schedule and odds','','PLANNED','Expected 3 credits for h2h, spreads, totals; no automatic paid retry.',3);
      const data=odds_('/sports/'+SPORT+'/odds','bookmakers='+requestBookmakers_()+'&markets=h2h,spreads,totals&oddsFormat=american',true,'',3,run.id,'game-lines');
      if(!Array.isArray(data))fail_('Invalid game lines response.');
      recordComparisonQuotesSafely_(data,'game',now_());
      rows.forEach(r=>{try{
        const matches=data.filter(g=>g.id===r[0]);if(matches.length!==1)fail_('Event missing/duplicated in game lines.');const g=matches[0];
        if(g.away_team+' @ '+g.home_team!==r[1])fail_('Game lines team mismatch.');const result=gameLines_(g);
        result.values.forEach((v,i)=>r[i+3]=v);r[IDX.LINES_UPDATED]=now_();r[IDX.LINES_SOURCE]=result.source;r[IDX.BOOK]=BOOK;
        r[IDX.HOME_SPREAD_PRICE]=result.prices.home_spread;r[IDX.AWAY_SPREAD_PRICE]=result.prices.away_spread;r[IDX.TOTAL_OVER_PRICE]=result.prices.total_over;r[IDX.TOTAL_UNDER_PRICE]=result.prices.total_under;
      }catch(e){log_('Mobile schedule and odds',r[0],'ERROR',safeError_(e),0);}});
      write_(TAB_INDEX,INDEX_HEADERS.concat(INDEX_EXTRA),rows);
      mobileFinishRun_(run,'SUCCEEDED','Schedule and odds are ready.');
      return {schedule_refreshed:true,odds_credits_approved:3};
    } catch(e) { mobileFinishRun_(run,'FAILED',safeError_(e));throw e; }
  });
}
function mobileExportRunId_(requestId) {
  if(requestId===undefined||requestId===null||requestId==='')return Utilities.getUuid();
  if(typeof requestId!=='string'||!/^[a-z0-9-]{8,80}$/i.test(requestId))fail_('Invalid export request ID. Review the cost and try again.');
  return requestId;
}
function mobileExportRunSignature_(plan) {
  if(!plan||!Array.isArray(plan.event_ids))fail_('Refresh the mobile preview before confirming.');
  return JSON.stringify([plan.event_ids,plan.selection_signature,plan.force_refresh===true,plan.include_alternate_props===true,
    Number(plan.max_total_odds_api_credits),Number(plan.sports_game_odds&&plan.sports_game_odds.max_returned_event_objects)]);
}
function mobileExportRun_(id) {
  const raw=PropertiesService.getScriptProperties().getProperty(MOBILE_EXPORT_RUN_PREFIX+id);
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(ignore){fail_('This export request has unreadable saved status. Use a fresh cost review; no paid request was made.');}
}
function saveMobileExportRun_(id,value) {
  PropertiesService.getScriptProperties().setProperty(MOBILE_EXPORT_RUN_PREFIX+id,JSON.stringify(value));
}
function compactMobileExport_(exported) {
  return {filename:exported.filename,driveUrl:exported.driveUrl,eventIds:exported.eventIds,exportTimestampUtc:exported.exportTimestampUtc,
    providerCoverageSummary:exported.providerCoverageSummary,warnings:exported.warnings,analysisManifestFilename:exported.analysisManifestFilename,
    analysisManifestDriveUrl:exported.analysisManifestDriveUrl,eligibleEventIds:exported.eligibleEventIds,
    ineligibleEventIds:exported.ineligibleEventIds,appBuild:exported.appBuild,snapshotId:exported.snapshotId,games:exported.games,receipt:exported.receipt};
}
function mobileExportReceipt_(exported,standardResult,alternateResult,providerResult,warnings) {
  const charges=(standardResult.charges||[]).concat(alternateResult.charges||[]),confirmed=charges.filter(charge=>Number.isFinite(charge.actual_credits));
  return {game_count:(exported.games||[]).length,completed_utc:exported.exportTimestampUtc,confirmed_credits:confirmed.reduce((total,charge)=>total+charge.actual_credits,0),
    total_charge_unconfirmed:confirmed.length!==charges.length,paid_request_count:charges.length,key_slots:Array.from(new Set(charges.map(charge=>charge.key_slot).filter(Boolean))),
    provider_result:providerResult&&providerResult.usage?providerResult.usage:{status:'UNAVAILABLE'},warnings:(warnings||[]).slice(),notification:{enabled:mobileEmailSettings_().enabled,status:'PENDING'}};
}
function mobileSaveAndNotifyExport_(exported,runId) {
  let latest=saveMobileLastExport_(exported); // The receipt is durable before an email attempt.
  const notification=mobileExportEmailAttempt_(runId,exported);
  exported.receipt.notification=notification;
  if(['FAILED','UNAVAILABLE'].includes(notification.status)) {
    const warning=notification.message||'Completion email was not delivered; the export is ready in the app.';
    if(exported.warnings.indexOf(warning)<0)exported.warnings.push(warning);
    exported.receipt.warnings=exported.warnings.slice();
  }
  latest=saveMobileLastExport_(exported);
  return latest;
}
function pruneMobileExportRuns_() {
  const properties=PropertiesService.getScriptProperties(),all=properties.getProperties(),cutoff=Date.now()-14*24*60*60*1000;
  Object.keys(all).filter(key=>key.indexOf(MOBILE_EXPORT_RUN_PREFIX)===0).forEach(key=>{
    try { const saved=JSON.parse(all[key]);if(Date.parse(saved.created_utc)<cutoff)properties.deleteProperty(key); }
    catch(ignore) {} // Keep unreadable records fail-closed rather than forgetting a paid request.
  });
}
// Lists old run records that would be safe to remove. DRY RUN ONLY: this never
// deletes. Kept: anything newer than 14 days, the active run, unreadable
// records, unresolved or unknown charges, and pending ledger writes.
function nbaOperationRecordsPruneDryRun() {const result=nbaOperationRecordsPrunePlan_(Date.now());console.log(JSON.stringify({would_delete:result.would_delete.length,kept_runs:result.kept_runs.length,deleted:0}));return result;}
function nbaOperationRecordsPrunePlan_(now) {
  const all=PropertiesService.getScriptProperties().getProperties(),cutoff=now-14*24*60*60*1000,runs={},wouldDelete=[],kept=[];
  Object.keys(all).forEach(key=>{
    if(key.indexOf(NBA_STAGE_OPERATION_PREFIX)!==0)return;
    const rest=key.slice(NBA_STAGE_OPERATION_PREFIX.length),m=/^(.+)_(standard|alternate)_([A-Za-z0-9_-]+)$/.exec(rest);
    const run=m?m[1]:'UNPARSED:'+rest,record={key:key};try{record.value=JSON.parse(all[key]);}catch(ignore){record.unreadable=true;}
    (runs[run]||(runs[run]=[])).push(record);
  });
  let active='';try{const s=JSON.parse(all[NBA_STAGE_STATE_PROPERTY]||'null');if(s&&s.state==='RUNNING')active=s.run_id;}catch(ignore){}
  const pendingLedger=Object.keys(all).filter(k=>k.indexOf(NBA_LEDGER_PENDING_PREFIX)===0).map(k=>k.slice(NBA_LEDGER_PENDING_PREFIX.length));
  Object.keys(runs).sort().forEach(run=>{
    const records=runs[run],keep=reason=>kept.push({run_id:run,reason:reason});
    if(run.indexOf('UNPARSED:')===0||records.some(r=>r.unreadable))return keep('UNREADABLE_RECORD');
    if(run===active)return keep('ACTIVE_RUN');
    const times=records.map(r=>Date.parse(r.value.committed_utc||r.value.response_saved_utc||r.value.started_utc));
    if(!times.length||times.some(t=>!Number.isFinite(t)))return keep('NO_TIMESTAMP');
    if(Math.max.apply(null,times)>=cutoff)return keep('NEWER_THAN_14_DAYS');
    if(records.some(r=>r.value.ledger_state==='SETTLEMENT_PENDING'||pendingLedger.indexOf(r.value.reservation_id)>=0))return keep('LEDGER_NOT_SETTLED');
    if(records.some(r=>['COMMITTED','NOT_SENT'].indexOf(r.value.status)<0&&!(r.value.reused_from&&r.value.status==='FAILED')))return keep('UNRESOLVED_OR_UNKNOWN_CHARGE');
    records.forEach(r=>wouldDelete.push(r.key));
  });
  return {dry_run:true,deleted:0,provider_requests:0,cutoff_utc:new Date(cutoff).toISOString(),would_delete:wouldDelete,kept_runs:kept,live_deletion:'Not available. Removal requires a separate owner approval.'};
}
function nbaStageState_() {
  const raw=PropertiesService.getScriptProperties().getProperty(NBA_STAGE_STATE_PROPERTY);
  if(!raw)return null;try{return JSON.parse(raw);}catch(ignore){return null;}
}
function nbaSaveStageState_(state) {
  state.updated_utc=now_();PropertiesService.getScriptProperties().setProperty(NBA_STAGE_STATE_PROPERTY,JSON.stringify(state));
}
function nbaContinuationTriggers_() {
  try {return ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction&&t.getHandlerFunction()==='continueNbaMobileLoad');}
  catch(e) {fail_('NBA background trigger access failed. Check this run before trying again; Google may require authorization in the NBA Apps Script editor.');}
}
function nbaClearContinuation_() {nbaContinuationTriggers_().forEach(t=>ScriptApp.deleteTrigger(t));}
function nbaArmContinuation_(delayMs) {
  nbaClearContinuation_();
  try {ScriptApp.newTrigger('continueNbaMobileLoad').timeBased().after(delayMs).create();}
  catch(e) {fail_('NBA background trigger could not start. Check this run before trying again; Google may require authorization in the NBA Apps Script editor.');}
}
function authorizeNbaBackgroundLoading() {
  // Keep this outside a catch: granular consent must be allowed to open.
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL,['https://www.googleapis.com/auth/script.scriptapp']);
  const triggers=ScriptApp.getProjectTriggers(),stage=nbaReconcileUnstartedRun_();
  const result={status:'READY',continuation_triggers:triggers.filter(t=>t.getHandlerFunction()==='continueNbaMobileLoad').length,
    previous_run:stage?{run_id:stage.run_id,state:stage.state}:null};
  console.log(JSON.stringify(result));return result;
}
function nbaReconcileUnstartedRun_() {
  const lock=LockService.getScriptLock(),held=typeof lock.hasLock==='function'&&lock.hasLock();
  if(!held&&!lock.tryLock(1000))return nbaStageState_();
  try {
    const stage=nbaStageState_();
    if(!stage||stage.state!=='RUNNING'||stage.stage!=='LOAD'||(stage.cursor||0)!==0||(stage.stage_attempts||0)!==0)return stage;
    const saved=mobileExportRun_(stage.run_id);
    if(!saved||saved.state!=='FAILED')return stage;
    // The startup request already failed, and no worker ever claimed its job.
    stage.state='FAILED';stage.message=String(saved.message||'The background load did not start. Review the games and cost again.');
    stage.lease_until_utc='';stage.reconciled_utc=now_();nbaSaveStageState_(stage);return stage;
  } finally {if(!held)lock.releaseLock();}
}
function verifyNbaBackgroundLoading() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL,['https://www.googleapis.com/auth/script.scriptapp']);
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))fail_('Another NBA setup operation is running.');
  try {
    const properties=PropertiesService.getScriptProperties(),key='NBA_BACKGROUND_TRIGGER_CHECK';
    const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nbaBackgroundTriggerProbe');
    existing.forEach(t=>ScriptApp.deleteTrigger(t));
    const check={status:'PENDING',started_utc:now_(),provider_calls:0};
    const trigger=ScriptApp.newTrigger('nbaBackgroundTriggerProbe').timeBased().after(60000).create();
    check.trigger_id=String(trigger.getUniqueId());properties.setProperty(key,JSON.stringify(check));
    console.log('Zero-credit NBA background check scheduled.');return {status:check.status,started_utc:check.started_utc};
  } finally {lock.releaseLock();}
}
function nbaBackgroundTriggerProbe(event) {
  const properties=PropertiesService.getScriptProperties(),raw=properties.getProperty('NBA_BACKGROUND_TRIGGER_CHECK');
  if(!raw)return;const check=JSON.parse(raw);
  if(!event||String(event.triggerUid)!==check.trigger_id||check.status!=='PENDING')return;
  check.status='SUCCEEDED';check.completed_utc=now_();properties.setProperty('NBA_BACKGROUND_TRIGGER_CHECK',JSON.stringify(check));
  ScriptApp.getProjectTriggers().filter(t=>String(t.getUniqueId())===check.trigger_id).forEach(t=>ScriptApp.deleteTrigger(t));
}
function nbaBackgroundTriggerCheckStatus() {
  const raw=PropertiesService.getScriptProperties().getProperty('NBA_BACKGROUND_TRIGGER_CHECK');
  const check=raw?JSON.parse(raw):{status:'NOT_RUN',provider_calls:0};
  const result={status:check.status,started_utc:check.started_utc||null,completed_utc:check.completed_utc||null,provider_calls:0};
  console.log(JSON.stringify(result));return result;
}
// Text of each run file as last read or written in this execution, so an
// unchanged checkpoint is not rewritten after every step.
const nbaRunFileText_={};
function nbaRunFile_(runId,kind,value) {
  const name='nba_run_'+runId+'_'+kind+'.json';
  if(value!==undefined&&nbaRunFileText_[name]===JSON.stringify(value))return value;
  const folder=analysisExportFolder_(),files=folder.getFilesByName(name),matches=[];
  while(files.hasNext())matches.push(files.next());
  if(matches.length>1)fail_('Duplicate saved NBA run files require owner review.');
  if(value===undefined){if(!matches.length)return null;let text;try{text=matches[0].getBlob().getDataAsString();}catch(e){throw tagService_(e,'DRIVE');}try{const parsed=JSON.parse(text);nbaRunFileText_[name]=text;return parsed;}catch(ignore){fail_('Saved NBA run file cannot be read.');}}
  const text=JSON.stringify(value);
  try{if(matches.length)matches[0].setContent(text);else folder.createFile(name,text,MimeType.PLAIN_TEXT);}catch(e){delete nbaRunFileText_[name];throw tagService_(e,'DRIVE');}
  nbaRunFileText_[name]=text;
  return value;
}
// A paid response is saved before anything is parsed. Drive can report an
// error after the file was written, so a failed save is checked and written
// once more (free; the paid request is never repeated). Returns false only
// when no exact copy could be confirmed.
function nbaSaveRawResponse_(runId,rawKind,saved) {
  for(let attempt=0;attempt<2;attempt++){
    try{nbaRunFile_(runId,rawKind,saved);return true;}
    catch(ignore){try{const back=nbaRunFile_(runId,rawKind);if(back&&JSON.stringify(back)===JSON.stringify(saved))return true;}catch(ignore2){}}
  }
  return false;
}
// Journal writes after a paid send must not lose the response; the raw file
// and the ledger sweep recover a missed write.
function nbaOperationSafe_(runId,kind,eventId,op) {try{nbaOperation_(runId,kind,eventId,op);return true;}catch(ignore){return false;}}
function nbaOperationKey_(runId,kind,eventId) {return NBA_STAGE_OPERATION_PREFIX+runId+'_'+kind+'_'+eventId;}
function nbaOperation_(runId,kind,eventId,value) {
  const properties=PropertiesService.getScriptProperties(),key=nbaOperationKey_(runId,kind,eventId);
  if(value!==undefined){properties.setProperty(key,JSON.stringify(value));return value;}
  const raw=properties.getProperty(key);if(!raw)return null;try{return JSON.parse(raw);}catch(ignore){fail_('Saved paid-request receipt cannot be read; no retry was made.');}
}
function nbaLoadSteps_(job) {
  const steps=[];job.items.forEach(item=>{
    if(item.standard_credits)steps.push({event_id:item.event_id,kind:'standard',credits:item.standard_credits});
    else if(item.standard_reuse)steps.push({event_id:item.event_id,kind:'standard',credits:0,reuse:item.standard_reuse});
    if(item.alternate_credits)steps.push({event_id:item.event_id,kind:'alternate',credits:item.alternate_credits});
    else if(item.alternate_reuse)steps.push({event_id:item.event_id,kind:'alternate',credits:0,reuse:item.alternate_reuse});
  });return steps;
}
function nbaRunCharges_(state,job) {
  return nbaLoadSteps_(job).map(step=>nbaOperation_(state.run_id,step.kind,step.event_id)).filter(op=>op&&op.response_saved===true).map(op=>({event_id:op.event_id,key_slot:op.key_slot||'',actual_credits:Number.isFinite(op.actual_credits)?op.actual_credits:null}));
}
function nbaPaidStep_(state,job,step,game) {
  const kind=step.kind,eventId=step.event_id,rawKind='raw_'+kind+'_'+eventId;
  let op=nbaOperation_(state.run_id,kind,eventId),saved=null;
  if(op&&op.status==='COMMITTED')return 'SUCCESS';
  if(step.reuse){
    // Replays a response another run already paid for; nothing is bought.
    try{saved=nbaRunFile_(step.reuse.run_id,rawKind);}catch(ignore){saved=null;}
    if(!saved||!saved.text){
      op={status:'FAILED',event_id:eventId,kind:kind,expected_credits:0,reused_from:step.reuse.run_id,message:'The saved '+kind+' response is no longer available. It was not bought again; review the cost to load it.'};
      nbaOperationSafe_(state.run_id,kind,eventId,op);job.warnings.push(game.matchup+': '+op.message);return 'FAILED';
    }
    if(!op){op={status:'RESPONSE_SAVED',event_id:eventId,kind:kind,expected_credits:0,reused_from:step.reuse.run_id,started_utc:now_()};nbaOperation_(state.run_id,kind,eventId,op);}
  } else {
    saved=nbaRunFile_(state.run_id,rawKind);
    if(!saved&&op){
      op.status='UNKNOWN';op.message='The paid request was interrupted before its response could be confirmed. It was not retried.';
      nbaOperation_(state.run_id,kind,eventId,op);job.warnings.push(game.matchup+': '+op.message);return 'UNKNOWN';
    }
  }
  if(!saved){
    op={status:'INTENT',event_id:eventId,kind:kind,expected_credits:step.credits,started_utc:now_()};
    const markets=kind==='standard'?PROP_MARKETS:MOBILE_ALTERNATE_MARKETS;
    // The expected cost is recorded before anything is reserved or sent.
    logRequired_('NBA staged '+kind,eventId,'PLANNED','Expected '+step.credits+' credits; no automatic retry.',step.credits);
    nbaOperation_(state.run_id,kind,eventId,op);
    let response;
    try {
      response=oddsRequest_('/sports/'+SPORT+'/events/'+encodeURIComponent(eventId)+'/odds','bookmakers='+requestBookmakers_()+'&markets='+markets.join(',')+'&oddsFormat=american',true,eventId,step.credits,state.run_id,kind+'-'+eventId);
    } catch(e) {
      const notSent=!!(e&&e.notSent);
      op.status=notSent?'NOT_SENT':'UNKNOWN';op.message=notSent?'No request was sent: '+safeError_(e):'Paid request outcome is unconfirmed; no automatic retry.';op.error=errorCategory_(e,'LOAD '+kind+'-'+eventId);
      nbaOperationSafe_(state.run_id,kind,eventId,op);
      job.warnings.push(game.matchup+': '+(notSent?op.message:op.message+' '+safeError_(e)));if(e&&e.stopPaidBatch)job.stop_paid=true;return notSent?'NOT_SENT':'UNKNOWN';
    }
    // From here the response is paid for. Nothing below may discard it.
    saved={text:response.text,key_slot:response.slot?response.slot.label:'',actual_credits:numberHeader_(response.headers,'x-requests-last'),retrieved_utc:now_(),
      http_code:response.http_code||200,safe_headers:response.safe_headers||{},reservation_id:response.reservation_id||''};
    const rawSaved=nbaSaveRawResponse_(state.run_id,rawKind,saved);
    op.status='RESPONSE_SAVED';op.response_saved=true;op.raw_saved=rawSaved;op.key_slot=saved.key_slot;op.actual_credits=saved.actual_credits;op.response_saved_utc=saved.retrieved_utc;
    op.reservation_id=saved.reservation_id;op.http_code=saved.http_code;op.safe_headers=saved.safe_headers;op.ledger_state=response.ledger_state||'';
    nbaOperationSafe_(state.run_id,kind,eventId,op);
    if(rawSaved)nbaSaveResponsePointer_(state.run_id,kind,eventId,saved.retrieved_utc);
    else job.warnings.push(game.matchup+': the paid '+kind+' response could not be saved to Drive; its data is still being committed.');
    if(op.ledger_state==='SETTLEMENT_PENDING'){
      // One free settlement attempt at the end of the step, same reservation ID.
      try{op.ledger_state=nbaLedgerSettleOne_(op.reservation_id,op.http_code,op.safe_headers)==='SETTLED'?'SETTLED':'UNKNOWN';nbaOperationSafe_(state.run_id,kind,eventId,op);}catch(ignore){}
    }
  }
  if(!op.response_saved&&!op.reused_from){op.response_saved=true;op.status='RESPONSE_SAVED';op.key_slot=saved.key_slot;op.actual_credits=saved.actual_credits;nbaOperationSafe_(state.run_id,kind,eventId,op);}
  try {
    const payload=json_({text:saved.text},'Saved NBA odds'),time=step.reuse?String(saved.retrieved_utc||now_()):now_();
    if(String(payload.id||'')!==String(eventId))fail_('Saved provider event does not match the selected game.');
    if(kind==='standard'){
      const rows=propsRows_(game,payload,[],time);
      replacePropsRows_(rows,game);
      let mirrored=false;
      // The mirror records line history itself; history runs separately only if the mirror write fails.
      try{writeLatestNormalizedProps_(normalizeOddsApiEvent_(payload,BOOK),eventId,'mobile_odds_api_refresh');mirrored=true;}catch(e){job.warnings.push(game.matchup+': normalized provider mirror was not updated.');}
      if(!mirrored)recordOddsApiLineHistorySafely_(payload,'mobile_props_refresh',eventId);
      recordComparisonQuotesSafely_(payload,'standard',String(saved.retrieved_utc||time));
      const index=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),at=index.findIndex(r=>String(r[IDX.EVENT])===String(eventId));
      if(at>=0)sheet_(TAB_INDEX).getRange(at+2,IDX.PROPS_UPDATED+1).setValue(time);
    } else {
      const rows=alternatePropsRows_(game,payload,[],time);
      replaceAlternateRows_(rows,game);
      recordOddsApiLineHistorySafely_(payload,'mobile_alternate_props_refresh',eventId);
      recordComparisonQuotesSafely_(payload,'alternate',String(saved.retrieved_utc||time));
    }
    op.status='COMMITTED';op.committed_utc=now_();nbaOperationSafe_(state.run_id,kind,eventId,op);return 'SUCCESS';
  } catch(e) {
    const category=errorCategory_(e,'LOAD '+kind+'-'+eventId);
    op.status='FAILED';op.message=safeError_(e,category);op.error=category;nbaOperationSafe_(state.run_id,kind,eventId,op);
    log_('NBA staged '+kind,eventId,'ERROR',op.message,0);
    job.warnings.push(game.matchup+': saved '+kind+' response could not be committed. '+op.message);return 'FAILED';
  }
}
function nbaEnsureSnapshot_(name,payload) {
  const folder=analysisExportFolder_(),files=folder.getFilesByName(name),matches=[];while(files.hasNext())matches.push(files.next());
  if(matches.length>1)fail_('Duplicate immutable NBA snapshots require owner review.');
  return matches.length?matches[0]:folder.createFile(name,JSON.stringify(payload,null,2),MimeType.PLAIN_TEXT);
}
function nbaStageAdvance_(state,job) {
  if(state.stage==='LOAD'){
    const steps=nbaLoadSteps_(job);
    if(state.cursor>=steps.length){state.stage='EXPORT_PREPARE';state.cursor=0;return;}
    const step=steps[state.cursor],game=job.games.find(g=>g.id===step.event_id);
    state.message=(step.kind==='alternate'?'Loading alternate props':'Loading standard props')+' for '+game.matchup+' ('+(state.cursor+1)+' of '+steps.length+').';
    if(Date.parse(game.kickoff)<=Date.now()){job.warnings.push(game.matchup+': tipoff passed before loading; paid request skipped.');state.cursor++;return;}
    if(job.stop_paid){job.warnings.push(game.matchup+': remaining paid requests skipped after a quota, key or nightly cap stop.');state.cursor++;return;}
    // One bad step never fails the whole run: it is marked FAILED, never
    // retried, and the run continues to a PARTIAL export.
    let result;
    try{result=nbaPaidStep_(state,job,step,game);}
    catch(e){
      const category=errorCategory_(e,'LOAD '+step.kind+'-'+step.event_id),message=safeError_(e,category);result='FAILED';
      job.warnings.push(game.matchup+': '+step.kind+' step stopped and was skipped; nothing was retried. '+message);
      log_('NBA staged '+step.kind,step.event_id,'ERROR',message,0);
      try{const op=nbaOperation_(state.run_id,step.kind,step.event_id);if(op&&op.status!=='COMMITTED'){op.error=category;if(op.status==='INTENT')op.status='UNKNOWN';nbaOperation_(state.run_id,step.kind,step.event_id,op);}}catch(ignore){}
    }
    job.load_status[game.id][step.kind]=result;state.cursor++;
    state.partial={standard_loaded_events:Object.values(job.load_status).filter(item=>item.standard==='SUCCESS').length,alternate_loaded_events:Object.values(job.load_status).filter(item=>item.alternate==='SUCCESS').length};
    return;
  }
  if(state.stage==='EXPORT_PREPARE'){
    let payload=nbaRunFile_(state.run_id,'payload');
    if(!payload){
      const timestamp=now_(),usage={odds_api:{max_credits:state.cap,alternate_requested:state.include_alternates,status:job.warnings.length?'PARTIAL':'SUCCESS'},sports_game_odds:{status:'DISABLED_PENDING_COVERAGE_TEST'}};
      payload=buildAnalysisExport_(job.games,timestamp,usage);payload.app_build=MOBILE_APP_BUILD;payload.snapshot_id=analysisSnapshotId_(timestamp,state.run_id);payload.run_load_status=job.load_status;
      nbaRunFile_(state.run_id,'payload',payload);
    }
    job.timestamp=payload.export_timestamp_utc;state.stage='EXPORT_AUDIT';return;
  }
  const payload=nbaRunFile_(state.run_id,'payload');if(!payload)fail_('Saved NBA export payload is missing.');
  if(state.stage==='EXPORT_AUDIT'){
    job.audit_filename=analysisExportFilename_(job.timestamp,payload.event_ids,payload.snapshot_id);
    const file=nbaEnsureSnapshot_(job.audit_filename,payload);job.audit_url=file.getUrl();job.audit_id=file.getId();state.stage='EXPORT_GAME';state.cursor=0;state.message='Saving per-game analysis files.';return;
  }
  if(state.stage==='EXPORT_GAME'){
    if(state.cursor>=payload.games.length){state.stage='EXPORT_MANIFEST';return;}
    const game=payload.games[state.cursor],filename=compactAnalysisGameFilename_(job.timestamp,game.event_id,payload.snapshot_id),compact=compactEventAnalysisPayload_(payload,game,job.timestamp,{filename:job.audit_filename,drive_url:job.audit_url}),file=nbaEnsureSnapshot_(filename,compact);
    job.files[state.cursor]={event_id:game.event_id,matchup:game.matchup,kickoff_utc:game.kickoff_utc,analysis_eligible:compact.analysis_eligible,ineligible_reason:compact.ineligible_reason,filename:filename,drive_url:file.getUrl()};state.cursor++;return;
  }
  if(state.stage==='EXPORT_MANIFEST'){
    const manifest={schema_version:1,kind:'nba_slate_analysis_manifest',sport:SPORT,league:'NBA',app_build:MOBILE_APP_BUILD,snapshot_id:payload.snapshot_id,export_timestamp_utc:job.timestamp,
      audit_export:{filename:job.audit_filename,drive_url:job.audit_url},event_ids:payload.event_ids,eligible_event_ids:job.files.filter(g=>g.analysis_eligible).map(g=>g.event_id),ineligible_events:job.files.filter(g=>!g.analysis_eligible).map(g=>({event_id:g.event_id,reason:g.ineligible_reason})),events:job.files,
      provider_usage:payload.provider_usage,provider_scope:'SportsGameOdds NBA coverage is disabled pending an approved coverage test.'};
    const filename=analysisManifestFilename_(job.timestamp,payload.event_ids,payload.snapshot_id),file=nbaEnsureSnapshot_(filename,manifest);
    job.export={filename:job.audit_filename,fileId:job.audit_id,driveUrl:job.audit_url,eventIds:payload.event_ids,exportTimestampUtc:job.timestamp,providerCoverageSummary:payload.provider_coverage_summary,warnings:job.warnings.concat(payload.data_quality.warnings),appBuild:MOBILE_APP_BUILD,snapshotId:payload.snapshot_id,
      analysisManifestFilename:filename,analysisManifestDriveUrl:file.getUrl(),analysisGameFiles:job.files,eligibleEventIds:manifest.eligible_event_ids,ineligibleEventIds:manifest.ineligible_events.map(g=>g.event_id),games:payload.games.map(g=>({event_id:g.event_id,matchup:g.matchup,kickoff_et:g.kickoff_et,kickoff_utc:g.kickoff_utc,analysis_eligible:manifest.eligible_event_ids.indexOf(g.event_id)>=0}))};
    // Settle any pending ledger write before the receipt is published.
    const ledger=nbaLedgerSweep_(state,job);
    if(ledger.pending.length)job.export.warnings.push(ledger.pending.length+' shared ledger update'+(ledger.pending.length===1?' is':'s are')+' still pending; the paid responses are saved and nothing was bought twice.');
    job.export.receipt=mobileExportReceipt_(job.export,{charges:nbaRunCharges_(state,job)},{charges:[]},{usage:{status:'DISABLED_PENDING_COVERAGE_TEST'}},job.export.warnings);
    job.export.receipt.ledger_pending=ledger.pending.slice();job.export.receipt.night_cap=nbaNightView_();job.export.receipt.timings=nbaRunTimings_(state,job);
    const logWarning=logWriteWarning_();if(logWarning&&logWarning.count)job.export.receipt.log_write_failures=logWarning.count;
    const uncertain=nbaLoadSteps_(job).some(step=>{const op=nbaOperation_(state.run_id,step.kind,step.event_id);return op&&op.status==='UNKNOWN';});
    if(uncertain){job.export.receipt.total_charge_unconfirmed=true;job.export.warnings.push('At least one paid request has an unconfirmed outcome; no retry was made.');}
    state.stage='PUBLISH';return;
  }
  if(state.stage==='PUBLISH'){
    saveMobileLastExport_(job.export);saveMobileExportRun_(state.run_id,{state:'SUCCEEDED',signature:state.signature,created_utc:state.started_utc,updated_utc:now_(),export:compactMobileExport_(job.export),warnings:job.export.warnings});
    state.stage='EMAIL';state.message='Export ready; recording the completion receipt.';return;
  }
  if(state.stage==='EMAIL'){
    mobileSaveAndNotifyExport_(job.export,state.run_id);
    saveMobileExportRun_(state.run_id,{state:'SUCCEEDED',signature:state.signature,created_utc:state.started_utc,updated_utc:now_(),export:compactMobileExport_(job.export),warnings:job.export.warnings});
    state.state=job.export.warnings.length?'PARTIAL':'SUCCEEDED';state.stage='DONE';state.completed_utc=now_();
    mobileFinishRun_({id:state.run_id},'SUCCEEDED','NBA export ready.');return;
  }
  fail_('Unknown NBA checkpoint stage.');
}
// Seconds per stage and per paid step, for the receipt.
function nbaTimedAdvance_(state,job) {
  const stage=state.stage,steps=stage==='LOAD'?nbaLoadSteps_(job):[],step=stage==='LOAD'?steps[state.cursor]:null,t0=Date.now();
  try{nbaStageAdvance_(state,job);}
  finally{
    const secs=(Date.now()-t0)/1000,round=v=>Math.round(v*10)/10,stages=job.stage_seconds||(job.stage_seconds={});stages[stage]=round((stages[stage]||0)+secs);
    if(step)(job.load_seconds||(job.load_seconds={}))[step.kind+'-'+step.event_id]=round(secs);
  }
}
function nbaRunTimings_(state,job) {
  const total=Date.parse(state.started_utc);
  return {stage_seconds:job.stage_seconds||{},load_seconds:job.load_seconds||{},total_seconds:Number.isFinite(total)?Math.round((Date.now()-total)/100)/10:null};
}
function continueNbaMobileLoad() {
  const claim=LockService.getScriptLock();if(!claim.tryLock(1000))return {status:'BUSY'};
  let state;
  try {
    state=nbaStageState_();if(!state||state.state!=='RUNNING')return {status:'NO_ACTIVE_RUN'};
    if(Date.parse(state.lease_until_utc||'')>Date.now())return {status:'LEASED'};
    state.stage_attempts=(state.stage_attempts||0)+1;
    if(state.stage_attempts>3){state.state='FAILED';state.message='A checkpoint could not be recovered. Uncertain paid requests were not repeated.';nbaSaveStageState_(state);nbaClearContinuation_();saveMobileExportRun_(state.run_id,{state:'FAILED',signature:state.signature,created_utc:state.started_utc,updated_utc:now_(),message:state.message,partial:state.partial});mobileFinishRun_({id:state.run_id},'FAILED',state.message);return state;}
    state.lease_until_utc=new Date(Date.now()+7*60000).toISOString();nbaSaveStageState_(state);nbaArmContinuation_(8*60000);
  } finally {claim.releaseLock();}
  const started=Date.now();
  try {
    const job=nbaRunFile_(state.run_id,'job');if(!job)fail_('Saved NBA run plan is missing.');
    // Free settlement sweep at every worker start; never repeats a paid request.
    try{nbaLedgerSweep_(state,job);}catch(ignore){}
    let workLock;try{workLock=LockService.getDocumentLock();}catch(ignore){}if(!workLock)workLock=LockService.getScriptLock();
    if(!workLock.tryLock(1000)){state.lease_until_utc='';nbaSaveStageState_(state);nbaArmContinuation_(60000);return {status:'OTHER_LOADER_RUNNING'};}
    try {
      let steps=0;
      while(state.state==='RUNNING'&&Date.now()-started<4*60000&&steps++<30){
        mobileUpdateRun_({id:state.run_id},state.stage.toLowerCase(),state.message||'Continuing NBA load.');
        nbaTimedAdvance_(state,job);nbaRunFile_(state.run_id,'job',job);state.stage_attempts=0;nbaSaveStageState_(state);
      }
    } finally {workLock.releaseLock();}
  } catch(e) {
    state.state='FAILED';state.message=safeError_(e,errorCategory_(e,'stage '+String(state.stage||'')));saveMobileExportRun_(state.run_id,{state:'FAILED',signature:state.signature,created_utc:state.started_utc,updated_utc:now_(),message:state.message,partial:state.partial});mobileFinishRun_({id:state.run_id},'FAILED',state.message);
  }
  state.lease_until_utc='';nbaSaveStageState_(state);
  if(state.state==='RUNNING')nbaArmContinuation_(60000);else nbaClearContinuation_();
  return {status:state.state,stage:state.stage,run_id:state.run_id};
}
function mobileLoadAndExport(plan,requestId) {
  const id=mobileExportRunId_(requestId),signature=mobileExportRunSignature_(plan);
  return run_('Mobile staged load',()=>{
    const prior=mobileExportRun_(id);
    if(prior) {
      if(prior.signature!==signature)fail_('This request ID was already used for a different cost plan. Review the cost again.');
      return {operation:mobileOperationStatus(id).operation,queued:prior.state==='STARTED',reused_request_id:true};
    }
    const current=mobileAssertPlan_(plan),active=mobileRunStatus_(),staged=nbaStageState_();
    if(active&&active.state==='RUNNING')fail_('Another export is still running. Wait for its result before starting a new request.');
    if(staged&&staged.state==='RUNNING')fail_('A previous NBA load needs status reconciliation before another paid request.');
    if(current.max_total_odds_api_credits>0)assertNoPaidHold_();
    const loadable=current.event_ids.length-(current.started_games||[]).length;
    if(loadable<=0)fail_('Every selected game has started, so nothing can be loaded. No credits were spent.');
    const night=current.night_cap||nbaNightView_();
    if(current.max_total_odds_api_credits>night.remaining)fail_('This load needs up to '+current.max_total_odds_api_credits+' credits, but tonight\'s '+night.cap+'-credit cap has '+night.remaining+' left ('+night.counted+' already counted). No request was sent.');
    // Fail before writing a queued run when trigger management is unavailable.
    nbaContinuationTriggers_();
    const allGames=requireGames_();
    if(JSON.stringify(allGames.map(g=>g.id))!==current.selection_signature)fail_('Game selection changed. Refresh the preview before confirming.');
    const created=now_();saveMobileExportRun_(id,{state:'STARTED',signature:signature,created_utc:created});
    const run=mobileBeginRun_('load_and_export',allGames,id);
    try {
      const standardIds=new Set(current.games_requiring_refresh.map(item=>item.event_id)),alternateIds=new Set((current.alternate_games_requiring_refresh||[]).map(item=>item.event_id));
      const reuse=list=>{const out={};(list||[]).forEach(item=>{if(item.reuse_saved_response)out[item.event_id]=item.reuse_saved_response;});return out;},standardReuse=reuse(current.reusable_props),alternateReuse=reuse(current.alternate_reusable_props);
      const items=allGames.map(g=>({event_id:g.id,standard_credits:standardIds.has(g.id)?PROP_MARKETS.length:0,alternate_credits:alternateIds.has(g.id)?MOBILE_ALTERNATE_MARKETS.length:0,standard_reuse:standardReuse[g.id]||null,alternate_reuse:alternateReuse[g.id]||null}));
      const status={};allGames.forEach(g=>status[g.id]={});
      const job={games:allGames,items:items,load_status:status,warnings:[],files:[],stop_paid:false};
      nbaRunFile_(id,'job',job);
      const state={schema_version:1,run_id:id,state:'RUNNING',stage:'LOAD',cursor:0,started_utc:created,updated_utc:created,lease_until_utc:'',stage_attempts:0,signature:signature,cap:current.max_total_odds_api_credits,include_alternates:current.include_alternate_props===true,message:'Queued NBA load.'};
      nbaSaveStageState_(state);nbaArmContinuation_(1000);
      return {operation:run,queued:true};
    } catch(e) {
      const message=safeError_(e),stage=nbaStageState_();
      if(stage&&stage.run_id===id&&stage.state==='RUNNING') {stage.state='FAILED';stage.message=message;stage.lease_until_utc='';nbaSaveStageState_(stage);}
      saveMobileExportRun_(id,{state:'FAILED',signature:signature,created_utc:created,updated_utc:now_(),message:message});
      mobileFinishRun_(run,'FAILED',message);
      throw e;
    }
  });
}
// Record only a service name, step and error class. Native messages can
// contain request URLs and therefore credentials; they are never stored.
const ERROR_SERVICES_=['DRIVE','PROPERTIES','LOCK','URLFETCH','SPREADSHEET','MAIL','LIBRARY','APP'];
function tagService_(e,service) {
  if(e&&typeof e==='object'&&!e.nbaService)e.nbaService=service;
  return e;
}
function errorCategory_(e,step) {
  let service=e&&ERROR_SERVICES_.indexOf(e.nbaService)>=0?e.nbaService:'';
  if(!service) {
    // Classify by pattern only; the message itself is discarded.
    const text=String(e&&e.message||'');
    service=/DriveApp|Drive\b/i.test(text)?'DRIVE':/Propert/i.test(text)?'PROPERTIES':/\bLock/i.test(text)?'LOCK':/UrlFetch|Address unavailable|Request failed for|DNS error|Timeout:/i.test(text)?'URLFETCH':/Spreadsheet|\bRange\b|\bSheet\b/i.test(text)?'SPREADSHEET':/Mail/i.test(text)?'MAIL':e&&e.loaderSafe?'APP':'UNKNOWN';
  }
  const name=String(e&&e.name||'Error');
  return {service:service,step:String(step||'').slice(0,80),error_class:/^[A-Za-z]{1,40}$/.test(name)?name:'Error'};
}
function safeError_(e,category) {
  // Only internal, credential-free messages are exposed. Never include URL, response body or native transport error.
  if(e&&e.loaderSafe)return e.message;
  const c=category||errorCategory_(e,'');
  return 'Operation failed ('+c.service+(c.step?' · '+c.step:'')+' · '+c.error_class+'). Existing uncommitted data retained; inspect execution and retry after diagnosis.';
}
function fail_(s) { const e=new Error(s); e.loaderSafe=true; throw e; }
function failService_(service,s) { const e=new Error(s); e.loaderSafe=true; e.nbaService=service; throw e; }
// Raised before any provider request was sent, so no charge is possible.
function failNotSent_(s) { const e=new Error(s); e.loaderSafe=true; e.notSent=true; e.stopPaidBatch=true; throw e; }
function failPaidBatch_(s) { const e=new Error(s);e.loaderSafe=true;e.stopPaidBatch=true;throw e; }
function header_(headers,key) { const k=Object.keys(headers).find(k=>k.toLowerCase()===key); return k===undefined?undefined:headers[k]; }
function numberHeader_(headers,key) {
  const value=header_(headers||{},key),n=Number(value);
  return value===undefined||value===null||value===''||!Number.isFinite(n)||n<0?null:n;
}
function configuredKeySlots_(allowEmpty) {
  const properties=PropertiesService.getScriptProperties().getProperties(),slots=[],seen=[];
  for(let index=1;index<=KEY_POOL_MAX_SLOTS;index++) {
    const property=KEY_POOL_PROPERTY_PREFIX+index,key=String(properties[property]||'').trim();
    if(key&&seen.indexOf(key)<0){slots.push({label:'KEY '+index,property:property,key:key});seen.push(key);}
  }
  if(!slots.length&&!allowEmpty)fail_('No NBA Odds API key is configured. Add one in NBA Game Prep Settings.');
  return slots;
}
function readKeyPoolState_(slots) {
  const p=PropertiesService.getScriptProperties();let state;
  try{state=JSON.parse(p.getProperty(KEY_POOL_STATE_PROPERTY)||'{}');}catch(ignore){state={};}
  if(!state||typeof state!=='object')state={};if(!state.slots||typeof state.slots!=='object')state.slots={};
  const labels=slots.map(s=>s.label),clean={};
  labels.forEach(label=>{const old=state.slots[label]||{};clean[label]={remaining:Number.isFinite(old.remaining)?old.remaining:null,used:Number.isFinite(old.used)?old.used:null,last:Number.isFinite(old.last)?old.last:null,state:String(old.state||'UNKNOWN'),updated:String(old.updated||''),errorCode:String(old.errorCode||''),balanceChecked:String(old.balanceChecked||''),refreshStatus:String(old.refreshStatus||''),refreshAttempt:String(old.refreshAttempt||'')};});
  state.slots=clean;if(labels.indexOf(state.active)<0)state.active=labels[0]||'';return state;
}
function writeKeyPoolState_(state) {PropertiesService.getScriptProperties().setProperty(KEY_POOL_STATE_PROPERTY,JSON.stringify(state));}
function keySlotEligible_(slotState,expectedCost) {
  if(slotState.state==='DISABLED')return false;
  if(expectedCost>0&&slotState.state==='EXHAUSTED')return false;
  return slotState.remaining===null||slotState.remaining>=expectedCost;
}
function chooseKeySlot_(expectedCost,excludeLabel) {
  const cost=Number(expectedCost);
  if(!Number.isFinite(cost)||cost<0)fail_('Expected Odds API request cost is missing or invalid.');
  const slots=configuredKeySlots_(),state=readKeyPoolState_(slots),activeIndex=Math.max(0,slots.findIndex(s=>s.label===state.active));
  const ordered=slots.slice(activeIndex).concat(slots.slice(0,activeIndex));
  const chosen=ordered.find(s=>s.label!==excludeLabel&&keySlotEligible_(state.slots[s.label],cost));
  if(!chosen)fail_('No configured API key slot can safely cover the expected '+cost+'-credit request. Check the cached key-pool status or repair/reset a slot; no paid request was made.');
  if(state.active!==chosen.label){state.active=chosen.label;writeKeyPoolState_(state);}
  return {slot:chosen,state};
}
function apiErrorCode_(text) {
  try{const body=JSON.parse(text),code=String(body.error_code||body.code||'').toUpperCase();return ['INVALID_KEY','DEACTIVATED_KEY','MISSING_KEY','EXCEEDED_FREQ_LIMIT','OUT_OF_USAGE_CREDITS'].includes(code)?code:(code?'UNCLASSIFIED':'');}catch(ignore){return '';}
}
function advanceKeyPool_(failedLabel,expectedCost) {
  const slots=configuredKeySlots_(),state=readKeyPoolState_(slots),start=Math.max(0,slots.findIndex(s=>s.label===failedLabel));
  const ordered=slots.slice(start+1).concat(slots.slice(0,start));
  const next=ordered.find(s=>s.label!==failedLabel&&keySlotEligible_(state.slots[s.label],expectedCost));
  if(next){state.active=next.label;writeKeyPoolState_(state);return next.label;}
  writeKeyPoolState_(state);return '';
}
function updateKeyPoolFromResponse_(slot,httpCode,headers,text,expectedCost,paid) {
  const slots=configuredKeySlots_(),state=readKeyPoolState_(slots),record=state.slots[slot.label]||{};
  record.remaining=numberHeader_(headers,'x-requests-remaining');record.used=numberHeader_(headers,'x-requests-used');record.last=numberHeader_(headers,'x-requests-last');record.updated=now_();if(httpCode===200){record.balanceChecked=record.remaining===null?'':record.updated;record.refreshStatus=record.remaining===null?'MISSING_HEADERS':'SUCCESS';}record.errorCode=httpCode===200?'':apiErrorCode_(text);
  let rotate=false,kind='OTHER';
  if(['INVALID_KEY','DEACTIVATED_KEY','MISSING_KEY'].includes(record.errorCode)){record.state='DISABLED';rotate=true;kind='AUTH';}
  else if(record.errorCode==='OUT_OF_USAGE_CREDITS'){record.remaining=0;record.state='EXHAUSTED';rotate=true;kind='QUOTA';}
  else if(httpCode===200){record.state=record.remaining===0?'EXHAUSTED':(paid&&record.remaining!==null&&record.remaining<expectedCost?'INSUFFICIENT':record.remaining===null?'UNKNOWN':'HEALTHY');rotate=paid&&(record.state==='EXHAUSTED'||record.state==='INSUFFICIENT');kind='SUCCESS';}
  else if(record.errorCode==='EXCEEDED_FREQ_LIMIT'||httpCode===429){record.state='RATE_LIMITED';kind='RATE_LIMIT';}
  else {record.state='ERROR';kind='OTHER';}
  state.slots[slot.label]=record;writeKeyPoolState_(state);
  const next=rotate?advanceKeyPool_(slot.label,expectedCost):'';
  return {kind,next,record};
}
function safeOddsFailure_(label,code,slot,result) {
  if(result.kind==='AUTH')return label+': '+slot.label+' was rejected as '+result.record.errorCode+' and is disabled. '+(result.next?'The next manual run will use '+result.next+'.':'Repair the key and reset the pool before retrying.')+' No automatic retry was made.';
  if(result.kind==='QUOTA')return label+': '+slot.label+' is out of usage credits. '+(result.next?'The next manual run will use '+result.next+'.':'No eligible replacement slot is available.')+' No automatic retry was made.';
  if(result.kind==='RATE_LIMIT')return label+': rate limited on '+slot.label+' (HTTP 429). The key pool was not rotated; wait and retry manually.';
  return label+': HTTP '+code+' on '+slot.label+'. This was not confirmed as a quota or credential failure, so the key pool was not rotated.';
}
function request_(url,label,paid,event,isOdds,slot,expectedCost) {
  const shared=!!(slot&&slot.shared_pool),reservation=slot&&slot.shared_reservation;
  if(reservation){try{nbaSharedCall_('sent',{reservation_id:reservation});}catch(e){e.notSent=true;throw e;}}
  const markUnknown=()=>{if(reservation){try{nbaSharedCall_('unknown',{reservation_id:reservation});}catch(ignore){/* The reservation stays SENT and is reported; its charge is never guessed. */}}};
  for(let attempt=0;attempt<(paid||shared?1:3);attempt++) {
    let res;
    try { res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':'NBA-Game-Prep/1.0','Accept':'application/vnd.github+json'}}); }
    catch(e) {
      markUnknown();
      if(!paid&&!shared&&attempt<2) { Utilities.sleep(500*Math.pow(2,attempt)); continue; }
      if(isOdds) log_(label,event,'TRANSPORT ERROR',(slot?slot.label+'; ':'')+'charge unknown; key pool unchanged; no automatic paid retry.');
      failService_('URLFETCH',label+': transport failure.');
    }
    const code=res.getResponseCode(), h=res.getAllHeaders()||{},safeHeaders=nbaSafeHeaders_(h);let body;
    try{body=res.getContentText();}catch(ignore){markUnknown();failService_('URLFETCH',label+': unreadable response.');}
    // The response is in hand. A failed free ledger write must not discard it:
    // record the write as pending and settle it later under this same
    // reservation ID. The paid request itself is never repeated.
    let ledgerState='';
    if(reservation){
      try{const settled=nbaSharedCall_('response',{reservation_id:reservation,http_code:code,headers:safeHeaders});ledgerState=settled&&settled.state==='SETTLED'?'SETTLED':'UNKNOWN';}
      catch(ignore){ledgerState='SETTLEMENT_PENDING';nbaLedgerPendingSave_(reservation,code,safeHeaders,label,event);log_(label,event,'LEDGER PENDING','Ledger update pending; the request was sent and its saved response is kept. No paid retry.',0);}
    }
    const errorCode=code===200?'':apiErrorCode_(body);
    const poolResult=shared?{kind:code===429?'RATE_LIMIT':['INVALID_KEY','DEACTIVATED_KEY','MISSING_KEY'].includes(errorCode)?'AUTH':errorCode==='OUT_OF_USAGE_CREDITS'?'QUOTA':code===200?'SUCCESS':'OTHER',next:'',record:{errorCode:errorCode}}:isOdds&&slot?updateKeyPoolFromResponse_(slot,code,h,body,expectedCost||0,paid):null;
    if(isOdds) log_(label,event,'HTTP '+code,slot?slot.label:'',header_(h,'x-requests-last'),header_(h,'x-requests-used'),header_(h,'x-requests-remaining'));
    if(code===200) return {text:body,headers:h,slot:slot||null,http_code:code,safe_headers:safeHeaders,ledger_state:ledgerState,reservation_id:reservation||''};
    // Free public requests only: bounded retry of 429/5xx. Never repeat 401/403.
    if(!paid&&!shared&&(code===429||code>=500)&&attempt<2) { Utilities.sleep(2000*Math.pow(2,attempt)); continue; }
    if(isOdds&&slot) {
      const message=safeOddsFailure_(label,code,slot,poolResult);
      if(paid&&['AUTH','QUOTA'].includes(poolResult.kind))failPaidBatch_(message);
      fail_(message);
    }
    fail_(label+': HTTP '+code+'. No data committed for this request.');
  }
}
function json_(r,label) { try{return JSON.parse(r.text);}catch(e){fail_(label+': invalid JSON.');} }
function oddsRequest_(path,params,paid,event,expectedCost,runId,operation) {
  if(paid&&(!Number.isFinite(expectedCost)||expectedCost<=0))fail_('Paid Odds API requests require an explicit expected cost.');
  runId=runId||Utilities.getUuid();operation=operation||'odds-'+Utilities.getUuid();
  if(paid){assertNoPaidHold_();try{requestBookmakers_();}catch(e){e.notSent=true;e.stopPaidBatch=true;throw e;}}
  const ticket=paid?nbaNightReserve_(expectedCost):null;let selected;
  try{selected=paid?nbaSharedCall_('reserve',{run_id:runId,operation:operation,expected_credits:expectedCost}):nbaSharedCall_('free_key',{});}
  catch(e){if(ticket)nbaNightSettle_(ticket,0);if(e&&typeof e==='object')e.notSent=true;throw e;}
  const slot={label:selected.slot.label,key:selected.slot.key,shared_pool:true,shared_reservation:paid?selected.reservation_id:''};
  const url=API_BASE+path+'?'+(params?params+'&':'')+'apiKey='+encodeURIComponent(slot.key);
  let response;
  try{response=request_(url,paid?'Odds':'Odds metadata',paid,event,true,slot,expectedCost||0);}
  catch(e){if(ticket&&e&&e.notSent)nbaNightSettle_(ticket,0);throw e;}
  if(ticket)nbaNightSettle_(ticket,numberHeader_(response.headers,'x-requests-last'));
  if(paid)checkOvercharge_(response.headers,expectedCost,operation);
  return response;
}
function odds_(path,params,paid,event,expectedCost,runId,operation) {
  return json_(oddsRequest_(path,params,paid,event,expectedCost,runId,operation),'Odds');
}

// -----------------------------------------------------------------------------
// V2 Phase 2: SportsGameOdds transport only. The response remains provider
// native in this phase; common-format normalization belongs to Phase 3.
function sportsGameOddsTestPlan(eventId) {
  const id=String(eventId||'').trim();
  if(id&&!/^[A-Za-z0-9_-]+$/.test(id))fail_('SportsGameOdds test requires a valid provider event ID.');
  const oddIds=Object.keys(SGO_TEST_MARKETS).map(k=>SGO_TEST_MARKETS[k]);
  const params={leagueID:SGO_LEAGUE,oddsAvailable:'true',bookmakerID:BOOK,oddID:oddIds.join(','),includeOpposingOdds:'true',limit:'1'};
  if(id)params.eventID=id;
  return {
    provider:'SportsGameOdds',
    event_id:id||'AUTO_NEXT_NFL',
    selection:id?'EXPLICIT_EVENT':'NEXT_NFL_EVENT_WITH_ODDS',
    endpoint:'/events',
    params:params,
    requested_markets:Object.keys(SGO_TEST_MARKETS),
    expected_usage:{odds_api_credits:0,sports_game_odds_requests:1,sports_game_odds_returned_objects_max:1},
    no_automatic_retries:true,
    credential_configured:!!PropertiesService.getScriptProperties().getProperty(SGO_API_KEY_PROPERTY)
  };
}
function sportsGameOddsQuery_(params) {
  return Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(String(params[k]))).join('&');
}
function sportsGameOddsRequest_(plan) {
  const key=PropertiesService.getScriptProperties().getProperty(SGO_API_KEY_PROPERTY);
  if(!key)fail_('SportsGameOdds is not configured. Add SPORTSGAMEODDS_API_KEY in the V2 project Script Properties; never paste it into the Sheet or chat.');
  const url=SGO_API_BASE+plan.endpoint+'?'+sportsGameOddsQuery_(plan.params);
  let response;
  try {
    response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'x-api-key':key,'Accept':'application/json','User-Agent':'NBA-Game-Prep-V2/1.0'}});
  } catch(e) {
    log_('SportsGameOdds',plan.event_id,'TRANSPORT ERROR','No automatic retry; source usage unknown.',0);
    fail_('SportsGameOdds: transport failure. No automatic retry was made.');
  }
  const code=response.getResponseCode(),text=response.getContentText();
  if(code!==200) {
    log_('SportsGameOdds',plan.event_id,'HTTP '+code,'No automatic retry.',0);
    fail_('SportsGameOdds: HTTP '+code+'. No automatic retry was made.');
  }
  // Keep the exact provider response before validating or interpreting it, so
  // Phase 3 can be developed against a stable, zero-cost fixture.
  const rawFilename=SGO_PHASE2_RAW_FILENAME;
  let rawFile;
  try {
    rawFile=writeDriveTextIdempotent_(rawFilename,text);
  } catch(e) {
    log_('SportsGameOdds',plan.event_id,'RAW SAVE ERROR','Response was not parsed; no automatic retry.',0);
    fail_('SportsGameOdds: could not save the raw response to Drive. Response was not parsed.');
  }
  let envelope;
  try { envelope=JSON.parse(text); } catch(e) { fail_('SportsGameOdds: invalid JSON.'); }
  if(!envelope||envelope.success!==true||!Array.isArray(envelope.data))fail_('SportsGameOdds: invalid response envelope.');
  if(envelope.data.length!==1)fail_('SportsGameOdds: expected exactly one event; no data was committed.');
  const event=envelope.data[0],returnedId=String(event.eventID||'').trim();
  if(!/^[A-Za-z0-9_-]+$/.test(returnedId))fail_('SportsGameOdds: response event ID missing or invalid.');
  if(plan.selection==='EXPLICIT_EVENT'&&returnedId!==plan.event_id)fail_('SportsGameOdds: returned event ID did not match the requested event.');
  const resolvedPlan=Object.assign({},plan,{returned_event_id:returnedId});
  const raw={filename:rawFilename,file_id:rawFile.getId(),drive_url:rawFile.getUrl()};
  log_('SportsGameOdds',returnedId,'SUCCESS','Raw response saved as '+raw.filename+' (file '+raw.file_id+'). Notice: '+(envelope.notice?'PRESENT':'none'),0);
  return {plan:resolvedPlan,event:event,notice:typeof envelope.notice==='string'?envelope.notice:'',next_cursor:typeof envelope.nextCursor==='string'?envelope.nextCursor:'',raw_file:raw};
}
function fetchSportsGameOddsTestEvent(eventId,dryRun) {
  const plan=sportsGameOddsTestPlan(eventId);
  if(dryRun!==false)return plan;
  logRequired_('SportsGameOdds',plan.event_id,'PLANNED','One event; two requested markets; 0 Odds API credits; no automatic retry.',0);
  return sportsGameOddsRequest_(plan);
}
function sportsGameOddsAutoTestDryRun() {
  const plan=fetchSportsGameOddsTestEvent('',true);
  const detail='Selection: next upcoming NFL event with available odds\nMarkets: passing yards and receiving yards\nBookmaker: DraftKings\nOdds API credits: 0\nSportsGameOdds usage: up to 1 returned event object\nAutomatic retries: none';
  log_('SportsGameOdds',plan.event_id,'DRY RUN',detail,0);
  SpreadsheetApp.getUi().alert('SportsGameOdds test preview',detail,SpreadsheetApp.getUi().ButtonSet.OK);
  return plan;
}
function sportsGameOddsAutoTestFetch() {
  const ui=SpreadsheetApp.getUi();
  const message='Fetch the next upcoming NFL event with available odds?\n\nRequested markets: passing yards and receiving yards\nBookmaker: DraftKings\nOdds API credits: 0\nSportsGameOdds usage: up to 1 returned event object\nNo automatic retry.';
  if(ui.alert('Fetch SportsGameOdds test',message,ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('SportsGameOdds',()=>fetchSportsGameOddsTestEvent('',false));
}

// -----------------------------------------------------------------------------
// V2 production SportsGameOdds path. This remains intentionally limited to
// passing and receiving yards. It is a secondary source: an SGO failure never
// discards a valid Odds API props load or blocks the export.
function sgoMobileMarkets_() { return Object.keys(SGO_TEST_MARKETS); }
function sgoRawFilename_(stage,games) {
  const ids=games.map(g=>String(g.id).replace(/[^A-Za-z0-9_-]/g,'')).sort().join('-');
  return 'sports_game_odds_'+stage+'_'+String(now_()).slice(0,10)+'_'+ids+'.json';
}
function sgoEventMaps_() {
  const rows=read_(TAB_SGO_EVENT_MAP,SGO_EVENT_MAP_HEADERS.length),out={};
  rows.forEach(r=>{const oddsId=String(r[0]||'').trim(),sgoId=String(r[1]||'').trim();if(oddsId&&sgoId)out[oddsId]={odds_api_event_id:oddsId,sgo_event_id:sgoId,home_team:r[2],away_team:r[3],kickoff_utc:exportValue_(r[4]),resolved_utc:exportValue_(r[5]),source:r[6]};});
  return out;
}
function sgoQuoteRows_() { return read_(TAB_NBA_PROPS,NBA_PROPS_HEADERS.length); }
function sgoFreshForGame_(game,forceRefresh) {
  if(forceRefresh)return false;
  const now=Date.now(),seen={};
  sgoQuoteRows_().forEach(r=>{
    if(r[0]!=='sportsgameodds'||String(r[2])!==game.id||r[17]!==true)return;
    const updated=Date.parse(r[18]);if(Number.isFinite(updated)&&now-updated>=0&&now-updated<SGO_FRESHNESS_MINUTES*60000)seen[String(r[8])]=true;
  });
  return sgoMobileMarkets_().every(m=>seen[m]);
}
function sportsGameOddsMobilePlan_(games,forceRefresh) {
  if(!SPORTS_GAME_ODDS_NBA_ENABLED)return {scope:'NBA coverage test not yet approved',status:'DISABLED_PENDING_COVERAGE_TEST',freshness_minutes:SGO_FRESHNESS_MINUTES,reusable:[],games_requiring_refresh:[],cached_event_mappings:0,event_discovery_required:false,event_discovery_cap:0,max_returned_event_objects:0,provider_requests_max:0,no_automatic_retries:true};
  const mappings=sgoEventMaps_(),reusable=[],refresh=[],unmapped=[];
  games.forEach(g=>{
    if(sgoFreshForGame_(g,forceRefresh))reusable.push({event_id:g.id,matchup:g.matchup,reason:'Passing and receiving yards are under '+SGO_FRESHNESS_MINUTES+' minutes old.'});
    else { refresh.push({event_id:g.id,matchup:g.matchup,reason:forceRefresh?'Force refresh selected.':'SportsGameOdds passing/receiving data is missing or older than '+SGO_FRESHNESS_MINUTES+' minutes.'});if(!mappings[g.id])unmapped.push(g.id); }
  });
  const discovery=unmapped.length>0;
  return {scope:'DraftKings passing and receiving yards only',freshness_minutes:SGO_FRESHNESS_MINUTES,reusable:reusable,games_requiring_refresh:refresh,
    cached_event_mappings:games.length-unmapped.length,event_discovery_required:discovery,event_discovery_cap:discovery?SGO_DISCOVERY_LIMIT:0,
    max_returned_event_objects:discovery?SGO_DISCOVERY_LIMIT:refresh.length,provider_requests_max:refresh.length?1:0,no_automatic_retries:true};
}
function sgoProviderParams_(extra) {
  const params={leagueID:SGO_LEAGUE,oddsAvailable:'true',bookmakerID:BOOK,oddID:Object.keys(SGO_TEST_MARKETS).map(k=>SGO_TEST_MARKETS[k]).join(','),includeOpposingOdds:'true'};
  Object.keys(extra||{}).forEach(k=>params[k]=extra[k]);return params;
}
function sportsGameOddsMobileRequest_(params,filename,action) {
  const key=PropertiesService.getScriptProperties().getProperty(SGO_API_KEY_PROPERTY);
  if(!key)fail_('SportsGameOdds is not configured in V2 Script Properties. The Odds API export was preserved.');
  let response;
  try { response=UrlFetchApp.fetch(SGO_API_BASE+'/events?'+sportsGameOddsQuery_(params),{muteHttpExceptions:true,followRedirects:true,headers:{'x-api-key':key,'Accept':'application/json','User-Agent':'NBA-Game-Prep-V2/1.0'}}); }
  catch(e) { log_(action,'','TRANSPORT ERROR','No automatic retry; source usage unknown.',0);fail_('SportsGameOdds transport failure. No automatic retry was made.'); }
  const code=response.getResponseCode(),text=response.getContentText();
  if(code!==200) { log_(action,'','HTTP '+code,'No automatic retry.',0);fail_('SportsGameOdds HTTP '+code+'. No automatic retry was made.'); }
  let rawFile;
  try { rawFile=writeDriveTextIdempotent_(filename,text); }
  catch(e) { log_(action,'','RAW SAVE ERROR','Response was not parsed; no automatic retry.',0);fail_('SportsGameOdds raw response could not be saved. Response was not parsed.'); }
  let envelope;try { envelope=JSON.parse(text); } catch(e) { fail_('SportsGameOdds returned invalid JSON after raw data was saved.'); }
  if(!envelope||envelope.success!==true||!Array.isArray(envelope.data))fail_('SportsGameOdds response envelope is invalid.');
  log_(action,'','SUCCESS','Raw response saved before parsing: '+filename+' (file '+rawFile.getId()+'); '+envelope.data.length+' event object(s) returned.',0);
  return {events:envelope.data,raw_file:{filename:filename,file_id:rawFile.getId(),drive_url:rawFile.getUrl()},next_cursor:envelope.nextCursor||'',notice:envelope.notice||''};
}
function sgoMatchesGame_(event,game) {
  const home=event&&event.teams&&event.teams.home&&event.teams.home.names&&event.teams.home.names.long,away=event&&event.teams&&event.teams.away&&event.teams.away.names&&event.teams.away.names.long,kickoff=event&&event.status&&event.status.startsAt;
  return normName_(home)===normName_(game.home)&&normName_(away)===normName_(game.away)&&Number.isFinite(Date.parse(kickoff))&&Math.abs(Date.parse(kickoff)-Date.parse(game.kickoff))<=CROSS_PROVIDER_KICKOFF_TOLERANCE_MS;
}
function resolveSgoEventMappings_(games,events) {
  const existing=sgoEventMaps_(),resolved={},rows=read_(TAB_SGO_EVENT_MAP,SGO_EVENT_MAP_HEADERS.length).filter(r=>!games.some(g=>g.id===String(r[0])));
  games.forEach(g=>{
    const cached=existing[g.id];if(cached) { resolved[g.id]=cached;return; }
    const matches=events.filter(e=>sgoMatchesGame_(e,g));
    if(matches.length!==1)fail_('SportsGameOdds event mapping failed for '+g.matchup+'; expected one exact team/kickoff match, found '+matches.length+'.');
    const event=matches[0],id=String(event.eventID||'').trim();if(!id)fail_('SportsGameOdds mapped event has no event ID.');
    resolved[g.id]={odds_api_event_id:g.id,sgo_event_id:id,home_team:g.home,away_team:g.away,kickoff_utc:exportValue_(g.kickoff),resolved_utc:now_(),source:'exact normalized teams + kickoff within 5 minutes'};
  });
  Object.keys(resolved).sort().forEach(id=>{const m=resolved[id];rows.push([m.odds_api_event_id,m.sgo_event_id,m.home_team,m.away_team,m.kickoff_utc,m.resolved_utc,m.source]);});
  write_(TAB_SGO_EVENT_MAP,SGO_EVENT_MAP_HEADERS,rows);
  return resolved;
}
function normalizedPropsRows_(normalized,oddsEventId,captureContext) {
  const retrieved=now_(),game=normalized.away_team+' @ '+normalized.home_team;
  return normalized.quotes.concat(normalized.unavailable_quotes).map(q=>[normalized.provider,normalized.provider_event_id,oddsEventId,game,normalized.home_team,normalized.away_team,normalized.kickoff_utc,normalized.bookmaker,q.market_key,q.provider_market_key,q.player_id||'',q.player_key,q.player,q.player_team||'',q.line===null?'':q.line,q.side,q.price,q.available===true,q.source_updated_utc,retrieved,q.provider_quote_id,captureContext]);
}
function writeLatestNormalizedProps_(normalized,oddsEventId,captureContext) {
  const replacement=normalizedPropsRows_(normalized,oddsEventId,captureContext);
  const result=replaceRows_(TAB_NBA_PROPS,NBA_PROPS_HEADERS,[0,1],r=>r[0]===normalized.provider&&String(r[1])===String(normalized.provider_event_id),replacement);
  recordLineHistorySafely_(normalized,captureContext,oddsEventId);
  return {observed:replacement.length,replaced:result.removed};
}
function loadSportsGameOddsForMobile_(games,plan) {
  if(!SPORTS_GAME_ODDS_NBA_ENABLED)return {successes:0,warnings:[],usage:{scope:'NBA coverage test not yet approved',status:'DISABLED_PENDING_COVERAGE_TEST',returned_event_objects:0,max_returned_event_objects:0,no_automatic_retries:true}};
  const targets=(plan.games_requiring_refresh||[]).map(x=>x.event_id),targetGames=games.filter(g=>targets.indexOf(g.id)>=0);
  if(!targetGames.length)return {successes:0,warnings:[],usage:{scope:'DraftKings passing and receiving yards only',status:'CACHED',returned_event_objects:0,max_returned_event_objects:0,no_automatic_retries:true}};
  let maps=sgoEventMaps_(),discovery=null,eventsBySgoId={},warnings=[];
  const unmapped=targetGames.filter(g=>!maps[g.id]);
  if(unmapped.length) {
    discovery=sportsGameOddsMobileRequest_(sgoProviderParams_({limit:SGO_DISCOVERY_LIMIT}),sgoRawFilename_('discovery',targetGames),'SportsGameOdds discovery');
    maps=resolveSgoEventMappings_(targetGames,discovery.events);discovery.events.forEach(e=>eventsBySgoId[String(e.eventID)]=e);
  }
  const needed=targetGames.filter(g=>!eventsBySgoId[maps[g.id].sgo_event_id]);
  let capture=null;
  if(needed.length) {
    const ids=needed.map(g=>maps[g.id].sgo_event_id).sort().join(',');
    capture=sportsGameOddsMobileRequest_(sgoProviderParams_({eventIDs:ids,limit:needed.length}),sgoRawFilename_('props',needed),'SportsGameOdds props');
    capture.events.forEach(e=>eventsBySgoId[String(e.eventID)]=e);
  }
  let successes=0;
  targetGames.forEach(g=>{try {
    const event=eventsBySgoId[maps[g.id].sgo_event_id];if(!event)fail_('SportsGameOdds did not return mapped event '+g.matchup+'.');
    const normalized=normalizeSportsGameOddsEvent_(event,BOOK);crossProviderEventMatch_(normalized,{provider:'the_odds_api',provider_event_id:g.id,league:'NBA',sport:SPORT,home_team:g.home,away_team:g.away,kickoff_utc:exportValue_(g.kickoff),bookmaker:BOOK,quotes:[]});
    writeLatestNormalizedProps_(normalized,g.id,'mobile_sports_game_odds_refresh');successes++;
  } catch(e) { warnings.push(g.matchup+': '+safeError_(e));log_('SportsGameOdds',g.id,'ERROR',safeError_(e),0); }});
  return {successes:successes,warnings:warnings,usage:{scope:'DraftKings passing and receiving yards only',status:warnings.length?'PARTIAL':'SUCCESS',returned_event_objects:(discovery?discovery.events.length:0)+(capture?capture.events.length:0),max_returned_event_objects:plan.max_returned_event_objects,discovery_required:!!plan.event_discovery_required,discovery_cap:plan.event_discovery_cap,raw_files:[discovery&&discovery.raw_file,capture&&capture.raw_file].filter(Boolean),no_automatic_retries:true}};
}

// -----------------------------------------------------------------------------
// V2 Phase 3: provider-neutral quote normalization. These pure functions do
// not fetch, write Sheets, infer missing fields, or compare providers. Phase 4
// owns event/player matching and duplicate-bookmaker diagnostics.
function normalizedText_(value,label) {
  const text=String(value===undefined||value===null?'':value).trim();
  if(!text)fail_('Normalized quote is missing '+label+'.');
  return text;
}
function normalizedTimestamp_(value,label) {
  const text=normalizedText_(value,label);
  if(!Number.isFinite(Date.parse(text)))fail_('Normalized quote has invalid '+label+'.');
  return text;
}
function normalizedAmericanPrice_(value,label) {
  const price=Number(value);
  if(!Number.isInteger(price)||Math.abs(price)<100)fail_('Normalized quote has invalid '+label+'.');
  return price;
}
function normalizedLine_(value,label) {
  const line=Number(value);
  if(!Number.isFinite(line))fail_('Normalized quote has invalid '+label+'.');
  return line;
}
function normalizedEventBase_(provider,eventId,home,away,kickoff,bookmaker) {
  return {schema_version:1,provider:provider,provider_event_id:normalizedText_(eventId,'provider event ID'),league:'NBA',sport:SPORT,
    home_team:normalizedText_(home,'home team'),away_team:normalizedText_(away,'away team'),kickoff_utc:normalizedTimestamp_(kickoff,'kickoff time'),
    bookmaker:normalizedText_(bookmaker,'bookmaker'),quotes:[],unavailable_quotes:[],diagnostics:{source_quote_count:0,normalized_quote_count:0,unavailable_quote_count:0,unsupported_stat_ids:[]}};
}
function normalizeOddsApiEvent_(event,bookmakerKey) {
  if(!event||typeof event!=='object')fail_('Odds API event is missing.');
  const bookmaker=normalizedText_(bookmakerKey||BOOK,'bookmaker'),books=(event.bookmakers||[]).filter(b=>b&&b.key===bookmaker);
  if(books.length!==1)fail_('Odds API normalization requires exactly one '+bookmaker+' bookmaker.');
  const out=normalizedEventBase_('the_odds_api',event.id,event.home_team,event.away_team,event.commence_time,bookmaker),seen={};
  (books[0].markets||[]).forEach(m=>{
    if(!m||!PROP_MARKETS.includes(m.key))return;
    const updated=normalizedTimestamp_(m.last_update,'Odds API market timestamp');
    (m.outcomes||[]).forEach(o=>{
      out.diagnostics.source_quote_count++;
      const player=normalizedText_(o.description,'Odds API player'),key=normName_(player);
      let side,line;
      if(m.key==='player_anytime_td') {
        if(o.name==='No')return;
        if(o.name!=='Yes'&&o.name!==player)fail_('Odds API anytime-touchdown side is invalid.');
        side='YES';line=null;
      } else {
        if(o.name!=='Over'&&o.name!=='Under')fail_('Odds API over/under side is invalid.');
        side=o.name.toUpperCase();line=normalizedLine_(o.point,'Odds API line');
      }
      const quoteId=[m.key,key,side,line===null?'':line].join('|');
      if(seen[quoteId])fail_('Duplicate normalized Odds API quote.');seen[quoteId]=true;
      out.quotes.push({provider_quote_id:quoteId,market_key:m.key,provider_market_key:m.key,player_id:'',player_key:key,player:player,player_team:'',
        line:line,side:side,price:normalizedAmericanPrice_(o.price,'Odds API price'),available:true,source_updated_utc:updated});
    });
  });
  out.diagnostics.normalized_quote_count=out.quotes.length;
  if(!out.quotes.length)fail_('Odds API normalization found no supported player-prop quotes.');
  return out;
}
function sportsGameOddsPlayerTeam_(event,teamId) {
  const home=event.teams&&event.teams.home,away=event.teams&&event.teams.away;
  if(home&&home.teamID===teamId)return normalizedText_(home.names&&home.names.long,'SportsGameOdds home team name');
  if(away&&away.teamID===teamId)return normalizedText_(away.names&&away.names.long,'SportsGameOdds away team name');
  fail_('SportsGameOdds player team is not one of the event teams.');
}
function normalizeSportsGameOddsEvent_(event,bookmakerKey) {
  if(!event||typeof event!=='object'||event.leagueID!==SGO_LEAGUE||event.type!=='match')fail_('SportsGameOdds event is invalid or not an NBA match.');
  const bookmaker=normalizedText_(bookmakerKey||BOOK,'bookmaker'),home=event.teams&&event.teams.home,away=event.teams&&event.teams.away;
  const out=normalizedEventBase_('sportsgameodds',event.eventID,home&&home.names&&home.names.long,away&&away.names&&away.names.long,event.status&&event.status.startsAt,bookmaker),unsupported={};
  const odds=event.odds;if(!odds||typeof odds!=='object'||Array.isArray(odds))fail_('SportsGameOdds odds object is missing.');
  Object.keys(odds).sort().forEach(oddId=>{
    const odd=odds[oddId],market=odd&&SGO_STAT_TO_MARKET[odd.statID];
    if(!market) {if(odd&&odd.statID)unsupported[odd.statID]=true;return;}
    if(odd.periodID!=='game'||odd.betTypeID!=='ou'||!['over','under'].includes(odd.sideID))fail_('SportsGameOdds supported quote shape is invalid.');
    out.diagnostics.source_quote_count++;
    const byBookmaker=odd.byBookmaker&&odd.byBookmaker[bookmaker];
    if(!byBookmaker) {out.diagnostics.unavailable_quote_count++;return;}
    const player=(event.players||{})[odd.playerID];
    if(!player||player.playerID!==odd.playerID)fail_('SportsGameOdds player lookup failed.');
    const quoteId=normalizedText_(odd.oddID,'SportsGameOdds quote ID');
    if(quoteId!==oddId)fail_('SportsGameOdds quote ID does not match its odds key.');
    // SportsGameOdds exposes structured legal-name fields even when its display
    // label is abbreviated (for example, Joshua versus Josh Palmer). Use those
    // fields for the canonical key; retain the display label for auditability.
    const canonicalName=normalizedText_(String(player.firstName||'')+' '+String(player.lastName||''),'SportsGameOdds player legal name');
    const quote={provider_quote_id:quoteId,market_key:market,provider_market_key:odd.statID,player_id:normalizedText_(player.playerID,'SportsGameOdds player ID'),player_key:normName_(canonicalName),
      player:normalizedText_(player.name,'SportsGameOdds player name'),player_team:sportsGameOddsPlayerTeam_(event,player.teamID),line:normalizedLine_(byBookmaker.overUnder,'SportsGameOdds line'),
      side:odd.sideID.toUpperCase(),price:normalizedAmericanPrice_(byBookmaker.odds,'SportsGameOdds price'),available:byBookmaker.available===true,source_updated_utc:normalizedTimestamp_(byBookmaker.lastUpdatedAt,'SportsGameOdds timestamp')};
    if(quote.available)out.quotes.push(quote);
    else {out.unavailable_quotes.push(quote);out.diagnostics.unavailable_quote_count++;}
  });
  out.diagnostics.normalized_quote_count=out.quotes.length;
  out.diagnostics.unsupported_stat_ids=Object.keys(unsupported).sort();
  if(!out.quotes.length)fail_('SportsGameOdds normalization found no available supported player-prop quotes.');
  return out;
}

// -----------------------------------------------------------------------------
// V2 Phase 5: append-only prop observation history. It runs only beside an
// already-authorized source fetch; it never schedules, initiates, or retries a
// request. A source timestamp is part of the identity so a later snapshot is
// retained, while reprocessing the same raw fixture is a no-op.
function canonicalEventKey_(normalized) {
  return [normName_(normalized.away_team),normName_(normalized.home_team),normalizedTimestamp_(normalized.kickoff_utc,'history kickoff')].join('|');
}
function lineHistoryIdentity_(normalized,quote) {
  return JSON.stringify([normalized.provider,normalized.provider_event_id,normalized.bookmaker,quote.provider_market_key,
    quote.provider_quote_id,quote.player_id||quote.player_key,quote.line===null?'':quote.line,quote.side,quote.price,quote.available===true,quote.source_updated_utc]);
}
function ensureLineHistorySheet_() { return ensureTrackerSheet_(TAB_LINE_HISTORY,LINE_HISTORY_HEADERS); }
function lineHistoryRows_(normalized,captureContext) {
  if(!normalized||!Array.isArray(normalized.quotes)||!Array.isArray(normalized.unavailable_quotes))fail_('Line history requires a normalized provider event.');
  const captured=now_(),eventKey=canonicalEventKey_(normalized),context=normalizedText_(captureContext,'history capture context');
  return normalized.quotes.concat(normalized.unavailable_quotes).map(quote=>[
    lineHistoryIdentity_(normalized,quote),captured,normalizedTimestamp_(quote.source_updated_utc,'history source timestamp'),normalized.provider,
    normalized.provider_event_id,eventKey,normalized.bookmaker,quote.market_key,quote.provider_market_key,quote.provider_quote_id,
    quote.player_id||'',quote.player_key,quote.player,quote.player_team||'',quote.line===null?'':quote.line,quote.side,
    quote.price,quote.available===true,context
  ]);
}
function recordNormalizedLineHistory_(normalized,captureContext) {
  // Only the History ID column is needed to skip rows already recorded.
  const s=ensureLineHistorySheet_(),seen={},count=Math.max(0,s.getLastRow()-1);
  if(count)s.getRange(2,1,count,1).getValues().forEach(row=>{if(String(row[0]||'').trim())seen[String(row[0])]=true;});
  const all=lineHistoryRows_(normalized,captureContext),newRows=all.filter(row=>!seen[row[0]]);
  if(newRows.length)s.getRange(s.getLastRow()+1,1,newRows.length,LINE_HISTORY_HEADERS.length).setValues(newRows.map(row=>row.map(cell_)));
  return {observed:all.length,inserted:newRows.length,duplicates:all.length-newRows.length};
}
function recordLineHistorySafely_(normalized,captureContext,eventId) {
  try {
    const result=recordNormalizedLineHistory_(normalized,captureContext);
    log_('Line history',eventId||normalized.provider_event_id,'SUCCESS',result.inserted+' inserted, '+result.duplicates+' already present; '+captureContext+'.',0);
    return result;
  } catch(e) {
    // History is additive telemetry. Its failure must never invalidate an
    // otherwise successful V1 props write or paid request.
    log_('Line history',eventId||'','ERROR',safeError_(e),0);
    return {observed:0,inserted:0,duplicates:0,error:safeError_(e)};
  }
}
function recordOddsApiLineHistorySafely_(payload,captureContext,eventId) {
  try { return recordLineHistorySafely_(normalizeOddsApiEvent_(payload,BOOK),captureContext,eventId); }
  catch(e) { log_('Line history',eventId||'','ERROR',safeError_(e),0);return {observed:0,inserted:0,duplicates:0,error:safeError_(e)}; }
}

// -----------------------------------------------------------------------------
// V2 Phase 4: read-only cross-provider diagnostics. Observations from the same
// sportsbook are deliberately retained by provider; they are never merged or
// chosen between here. Selection and interpretation are out of scope.
function normalizedBookmakerKey_(value) { return normalizedText_(value,'bookmaker').toLowerCase(); }
function crossProviderQuoteKey_(quote,includeLine) {
  const line=quote.line===null?'':normalizedLine_(quote.line,'quote line');
  return [normalizedText_(quote.market_key,'quote market'),normalizedText_(quote.player_key,'quote player key'),normalizedText_(quote.side,'quote side'),includeLine===false?'':line].join('|');
}
function crossProviderObservation_(provider,quote) {
  if(!quote||quote.available!==true)fail_('Cross-provider diagnostics require available normalized quotes only.');
  return {provider:normalizedText_(provider,'provider'),provider_quote_id:normalizedText_(quote.provider_quote_id,'provider quote ID'),market_key:normalizedText_(quote.market_key,'quote market'),
    player_key:normalizedText_(quote.player_key,'quote player key'),player:normalizedText_(quote.player,'quote player'),line:quote.line===null?null:normalizedLine_(quote.line,'quote line'),
    side:normalizedText_(quote.side,'quote side'),price:normalizedAmericanPrice_(quote.price,'quote price'),source_updated_utc:normalizedTimestamp_(quote.source_updated_utc,'quote timestamp')};
}
function crossProviderEventMatch_(first,second) {
  if(!first||!second||first.league!=='NBA'||second.league!=='NBA'||first.sport!==SPORT||second.sport!==SPORT)fail_('Cross-provider events must both be NBA events.');
  if(normName_(first.home_team)!==normName_(second.home_team)||normName_(first.away_team)!==normName_(second.away_team))fail_('Cross-provider event team mismatch.');
  const firstKickoff=Date.parse(first.kickoff_utc),secondKickoff=Date.parse(second.kickoff_utc),difference=Math.abs(firstKickoff-secondKickoff);
  if(!Number.isFinite(firstKickoff)||!Number.isFinite(secondKickoff)||difference>CROSS_PROVIDER_KICKOFF_TOLERANCE_MS)fail_('Cross-provider event kickoff mismatch.');
  return {home_team:first.home_team,away_team:first.away_team,first_provider_event_id:normalizedText_(first.provider_event_id,'first provider event ID'),
    second_provider_event_id:normalizedText_(second.provider_event_id,'second provider event ID'),kickoff_difference_ms:difference};
}
function crossProviderDiagnostics_(first,second) {
  if(!first||!second||first.provider===second.provider)fail_('Cross-provider diagnostics require two different providers.');
  const firstBook=normalizedBookmakerKey_(first.bookmaker),secondBook=normalizedBookmakerKey_(second.bookmaker);
  if(firstBook!==secondBook)fail_('Cross-provider diagnostics require the same sportsbook.');
  const event=crossProviderEventMatch_(first,second),groups={},softGroups={},firstOnly=[],secondOnly=[];
  const add=(source,quote)=>{
    const observation=crossProviderObservation_(source,quote),key=crossProviderQuoteKey_(quote,true),softKey=crossProviderQuoteKey_(quote,false);
    const group=groups[key]||(groups[key]=[]);
    if(group.some(item=>item.provider===source))fail_('Duplicate normalized quote within '+source+'; no observation was dropped.');
    group.push(observation);
    const soft=softGroups[softKey]||(softGroups[softKey]={});(soft[source]||(soft[source]=[])).push(observation);
  };
  (first.quotes||[]).forEach(q=>add(first.provider,q));
  (second.quotes||[]).forEach(q=>add(second.provider,q));
  const exactMatches=[],lineMismatches=[],observations=[];
  Object.keys(groups).sort().forEach(key=>{
    const group=groups[key];observations.push.apply(observations,group);
    const a=group.filter(item=>item.provider===first.provider),b=group.filter(item=>item.provider===second.provider);
    if(a.length&&b.length)exactMatches.push({quote_key:key,first:a[0],second:b[0],american_price_difference:a[0].price-b[0].price});
    else if(a.length)firstOnly.push(a[0]);else secondOnly.push(b[0]);
  });
  Object.keys(softGroups).sort().forEach(key=>{
    const group=softGroups[key],a=group[first.provider]||[],b=group[second.provider]||[];
    if(a.length===1&&b.length===1&&a[0].line!==b[0].line)lineMismatches.push({quote_key_without_line:key,first:a[0],second:b[0],line_difference:a[0].line-b[0].line});
  });
  const priceAgreements=exactMatches.filter(match=>match.american_price_difference===0).length;
  return {schema_version:1,event:event,bookmaker:firstBook,observations:observations,exact_matches:exactMatches,line_mismatches:lineMismatches,
    first_only:firstOnly,second_only:secondOnly,summary:{first_provider:first.provider,second_provider:second.provider,first_available_quote_count:(first.quotes||[]).length,
      second_available_quote_count:(second.quotes||[]).length,same_bookmaker_duplicate_observation_count:exactMatches.length,price_agreement_count:priceAgreements,
      price_difference_count:exactMatches.length-priceAgreements,line_mismatch_count:lineMismatches.length,first_only_count:firstOnly.length,second_only_count:secondOnly.length}};
}
function readUniqueDriveText_(name,label) {
  const matches=[],files=DriveApp.getFilesByName(name);
  while(files.hasNext())matches.push(files.next());
  if(matches.length!==1)fail_(label+' requires exactly one Drive file named '+name+'.');
  return {file:matches[0],text:matches[0].getBlob().getDataAsString()};
}
function phase4SgoFixture_() {
  const raw=readUniqueDriveText_(SGO_PHASE2_RAW_FILENAME,'Phase 4'),payload=json_({text:raw.text},'Phase 4 SportsGameOdds fixture');
  if(!payload||payload.success!==true||!Array.isArray(payload.data)||payload.data.length!==1)fail_('Phase 4 SportsGameOdds fixture is invalid.');
  const event=payload.data[0],normalized=normalizeSportsGameOddsEvent_(event,BOOK);
  return {file:raw.file,event:event,normalized:normalized};
}
function phase4OddsApiCapturePlan_() {
  const games=requireGames_();if(games.length!==1)fail_('Phase 4 requires exactly one checked INDEX game.');
  const game=games[0],fixture=phase4SgoFixture_(),target=fixture.normalized;
  if(normName_(game.home)!==normName_(target.home_team)||normName_(game.away)!==normName_(target.away_team))fail_('Checked INDEX game does not match the saved SportsGameOdds fixture.');
  const kickoffDifference=Math.abs(Date.parse(game.kickoff)-Date.parse(target.kickoff_utc));
  if(!Number.isFinite(kickoffDifference)||kickoffDifference>CROSS_PROVIDER_KICKOFF_TOLERANCE_MS)fail_('Checked INDEX game kickoff does not match the saved SportsGameOdds fixture.');
  const params='bookmakers='+encodeURIComponent(BOOK)+'&markets=player_pass_yds,player_reception_yds&oddsFormat=american';
  return {phase:4,odds_api_event_id:game.id,sports_game_odds_event_id:target.provider_event_id,matchup:game.matchup,params:params,
    expected_odds_api_credits:2,expected_sports_game_odds_requests:0,no_automatic_retries:true,sgo_raw_file_id:fixture.file.getId()};
}
function phase4CaptureSignature_(plan) {return JSON.stringify([plan.odds_api_event_id,plan.sports_game_odds_event_id,plan.params,plan.sgo_raw_file_id]);}
function phase4OddsApiCaptureDryRun() {
  return run_('Phase 4 Odds capture preview',()=>{
    const plan=phase4OddsApiCapturePlan_(),detail=plan.matchup+'\nMarkets: passing yards and receiving yards\nBookmaker: DraftKings\nMaximum Odds API credits: 2\nSportsGameOdds requests: 0\nNo automatic retry.';
    log_('Phase 4 Odds capture',plan.odds_api_event_id,'DRY RUN',detail,2);
    SpreadsheetApp.getUi().alert('Phase 4 Odds capture preview',detail,SpreadsheetApp.getUi().ButtonSet.OK);
    return plan;
  });
}
function phase4OddsApiCaptureFetch() {
  const planned=phase4OddsApiCapturePlan_(),ui=SpreadsheetApp.getUi();
  const message=planned.matchup+'\nMarkets: passing yards and receiving yards\nBookmaker: DraftKings\nMaximum Odds API credits: 2\nSportsGameOdds requests: 0\nNo automatic retry. Continue?';
  if(ui.alert('Capture Odds API comparison fixture?',message,ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('Phase 4 Odds capture',()=>{
    const plan=phase4OddsApiCapturePlan_();
    if(phase4CaptureSignature_(plan)!==phase4CaptureSignature_(planned))fail_('Phase 4 target changed after confirmation. Run the preview again.');
    logRequired_('Phase 4 Odds capture',plan.odds_api_event_id,'PLANNED','Two markets, DraftKings, maximum 2 Odds API credits; no automatic retry.',2);
    const response=oddsRequest_('/sports/'+SPORT+'/events/'+encodeURIComponent(plan.odds_api_event_id)+'/odds',plan.params,true,plan.odds_api_event_id,2);
    const rawFile=writeDriveTextIdempotent_(PHASE4_ODDS_RAW_FILENAME,response.text); // Persist before parsing.
    const oddsEvent=json_(response,'Phase 4 Odds API fixture'),fixture=phase4SgoFixture_(),normalizedOdds=normalizeOddsApiEvent_(oddsEvent,BOOK);
    const diagnostic=crossProviderDiagnostics_(normalizedOdds,fixture.normalized),diagnosticFile=writeDriveTextIdempotent_(PHASE4_DIAGNOSTIC_FILENAME,JSON.stringify(diagnostic,null,2));
    recordLineHistorySafely_(normalizedOdds,'phase4_capture',plan.odds_api_event_id);
    recordLineHistorySafely_(fixture.normalized,'phase4_capture',plan.odds_api_event_id);
    const summary=diagnostic.summary;
    log_('Phase 4 Odds capture',plan.odds_api_event_id,'SUCCESS','Raw Odds API response saved as '+PHASE4_ODDS_RAW_FILENAME+' (file '+rawFile.getId()+'); diagnostic saved as '+PHASE4_DIAGNOSTIC_FILENAME+' (file '+diagnosticFile.getId()+'); exact matches '+summary.same_bookmaker_duplicate_observation_count+'; line mismatches '+summary.line_mismatch_count+'.',0);
    ui.alert('Phase 4 diagnostic saved','Exact matches: '+summary.same_bookmaker_duplicate_observation_count+'\nPrice differences: '+summary.price_difference_count+'\nLine mismatches: '+summary.line_mismatch_count+'\nSee LOG and Drive for both raw fixtures and the diagnostic.',ui.ButtonSet.OK);
    return {plan:plan,odds_api_raw_file:{filename:PHASE4_ODDS_RAW_FILENAME,file_id:rawFile.getId(),drive_url:rawFile.getUrl()},diagnostic_file:{filename:PHASE4_DIAGNOSTIC_FILENAME,file_id:diagnosticFile.getId(),drive_url:diagnosticFile.getUrl()},summary:summary};
  });
}
function importPhase4FixturesToLineHistory() {
  return run_('Phase 4 line history import',()=>{
    const oddsRaw=readUniqueDriveText_(PHASE4_ODDS_RAW_FILENAME,'Phase 4 line-history import');
    const oddsEvent=json_({text:oddsRaw.text},'Phase 4 saved Odds API fixture');
    const odds=normalizeOddsApiEvent_(oddsEvent,BOOK),fixture=phase4SgoFixture_();
    crossProviderEventMatch_(odds,fixture.normalized); // Refuse an accidental cross-event import.
    const first=recordNormalizedLineHistory_(odds,'phase4_fixture_import');
    const second=recordNormalizedLineHistory_(fixture.normalized,'phase4_fixture_import');
    const result={odds_api:first,sports_game_odds:second,inserted:first.inserted+second.inserted,duplicates:first.duplicates+second.duplicates};
    log_('Phase 4 line history import',odds.provider_event_id,'SUCCESS',result.inserted+' inserted, '+result.duplicates+' already present; zero API credits.',0);
    SpreadsheetApp.getUi().alert('Phase 4 history imported',result.inserted+' observations added\n'+result.duplicates+' already present\nNo API calls or credits used.',SpreadsheetApp.getUi().ButtonSet.OK);
    return result;
  });
}
function checkedGames_() {
  const rows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),seen={};
  return rows.filter(r=>r[IDX.LOAD]===true).map(r=>{
    const parts=String(r[IDX.MATCHUP]).split(' @ '), g={id:String(r[IDX.EVENT]),matchup:String(r[IDX.MATCHUP]),home:r[IDX.HOME]||parts[1],away:r[IDX.AWAY]||parts[0],slate:nbaGameTime_(r[IDX.KICKOFF]).day_label,kickoff:r[IDX.KICKOFF],propsUpdated:r[IDX.PROPS_UPDATED]};
    if(!/^[a-zA-Z0-9_-]+$/.test(g.id)||seen[g.id]||!String(g.home||'').trim()||!String(g.away||'').trim()||g.home===g.away) fail_('Invalid or duplicate checked event/team mapping. Refresh Index.');
    seen[g.id]=true; return g;
  });
}
function requireGames_() { const games=checkedGames_(); if(!games.length)fail_('No games checked on INDEX.'); return games; }
function etTime_(iso) {return nbaGameTime_(iso).full_label;}
function slateFor_(iso) {
  return Utilities.formatDate(new Date(iso),'America/New_York','EEE, MMM d');
}
function selectedForSlate_(slate) { const rows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length); return rows.filter(r=>r[IDX.SLATE]===slate); }
function prepareSlate_(slate,force) {
  refreshIndex();
  const ui=SpreadsheetApp.getUi(), rows=selectedForSlate_(slate), now=Date.now();
  const fresh=rows.filter(r=>r[IDX.PROPS_UPDATED] && now-Date.parse(r[IDX.PROPS_UPDATED])<SLATE_FRESHNESS_MINUTES*60000);
  const requestRows=force?rows:rows.filter(r=>!fresh.includes(r));
  const estimate=requestRows.length*PROP_MARKETS.length;
  const msg='Slate: '+slate+'\nTotal games: '+rows.length+'\nFresh skipped: '+(force?0:fresh.length)+'\nGames to request: '+requestRows.length+'\nMaximum Odds API credits: '+estimate;
  if(ui.alert('Prepare '+slate,msg+'\nProceed?',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const s=sheet_(TAB_INDEX), current=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length); current.forEach((r,i)=>{if(r[IDX.SLATE]===slate)s.getRange(i+2,IDX.LOAD+1).setValue(requestRows.some(x=>x[IDX.EVENT]===r[IDX.EVENT]));});
  return loadCheckedProps(true);
}
function prepareThursdayNight(){return prepareSlate_('Thursday Night',false)}
function prepareSundayEarly(){return prepareSlate_('Sunday Early',false)}
function prepareSundayLate(){return prepareSlate_('Sunday Late',false)}
function prepareSundayNight(){return prepareSlate_('Sunday Night',false)}
function prepareMondayNight(){return prepareSlate_('Monday Night',false)}
function prepareOtherSlate(){return prepareSlate_('International/Saturday/Other',false)}
function forceRefreshSelectedProps(){return loadCheckedProps(true);}
function clearSelections(){const s=sheet_(TAB_INDEX);if(s.getLastRow()>1)s.getRange(2,INDEX_HEADERS.indexOf('LOAD')+1,s.getLastRow()-1,1).setValue(false);}
function weekEnd_() {
  // Search real UTC instants; independent of project timezone and DST transitions.
  const t=new Date(); t.setUTCMinutes(0,0,0);
  for(let h=1;h<=7*24+2;h++) { const d=new Date(t.getTime()+h*3600000); if(Utilities.formatDate(d,'America/New_York','u H')==='2 6') return d; }
  fail_('Unable to calculate week boundary.');
}
function refreshIndexCore_() {
  const data=odds_('/sports/'+SPORT+'/events','',false);
  if(!Array.isArray(data)||!data.length) fail_('Empty or invalid events response; INDEX preserved.');
  const from=Date.now()-3*3600000,to=Date.now()+7*24*3600000,seen={};
  const old=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),byId={}; old.forEach(r=>byId[r[0]]=r);
  const filtered=data.filter(g=>Date.parse(g.commence_time)>=from&&Date.parse(g.commence_time)<=to);
  if(!filtered.length) fail_('No games in this week; INDEX preserved.');
  const rows=filtered.map(g=>{
    if(!g.id||seen[g.id]||!String(g.home_team||'').trim()||!String(g.away_team||'').trim()||g.home_team===g.away_team)fail_('Invalid events schema/team mapping.');
    seen[g.id]=true; const r=byId[g.id]||Array(INDEX_HEADERS.length+INDEX_EXTRA.length).fill('');
    r[0]=g.id;r[1]=g.away_team+' @ '+g.home_team;r[2]=etTime_(g.commence_time);r[10]=slateFor_(g.commence_time);r[11]=r[11]===true;
    r[13]=g.home_team;r[14]=g.away_team;r[15]=g.commence_time;return r;
  });
  write_(TAB_INDEX,INDEX_HEADERS.concat(INDEX_EXTRA),rows); sheet_(TAB_INDEX).getRange(2,12,rows.length,1).insertCheckboxes();
  log_('Index','','SUCCESS',rows.length+' games',0);
}
function refreshIndex() {return run_('Index',refreshIndexCore_);}
function loadWeek(){ refreshIndex(); refreshGameLines(); }

function validateRoster_(table,teams,updated,fetched) {
  if(!Array.isArray(table)||table.length<2)fail_('Roster empty; previous ROSTER preserved.');
  const h=table[0],needed=['season','team','position','full_name','gsis_id','status'];
  if(needed.some(k=>h.indexOf(k)<0))fail_('Roster schema changed.');
  const age=Date.parse(fetched)-Date.parse(updated);
  if(!Number.isFinite(age)||age < -3600000 || age>MAX_ROSTER_AGE_HOURS*3600000)fail_('Roster publication timestamp missing or older than 72 hours.');
  const get=(r,k)=>r[h.indexOf(k)],out=[],seen={};
  teams.forEach(t=>{if(!TEAM_CODES[t])fail_('Unknown roster team mapping.');});
  for(const r of table.slice(1)) {
    if(r.every(x=>x===''))continue;
    if(Number(get(r,'season'))!==SEASON)fail_('Roster has wrong-season records.');
    const team=teams.find(t=>TEAM_CODES[t].toUpperCase()===get(r,'team'));
    if(!team||!['QB','RB','FB','WR','TE'].includes(get(r,'position')))continue;
    const name=get(r,'full_name'),id=get(r,'gsis_id') || (get(r,'gsis_it_id') ? 'gsis_it:'+get(r,'gsis_it_id') : '');
    if(!name||!id) fail_('Roster player name/ID missing.');
    const key=id+'|'+team;
    const row=[normName_(name),name,team,get(r,'position'),'UNKNOWN',id,get(r,'status'),SEASON,ROSTER_URL,updated,fetched,'','','',''];
    if(seen[key] && JSON.stringify(seen[key])!==JSON.stringify(row))fail_('Conflicting roster records.');
    if(!seen[key])out.push(row); seen[key]=row;
  }
  if(teams.some(t=>!out.some(r=>r[2]===t)))fail_('Roster missing a requested team; entire ROSTER preserved.');
  return out;
}
function fetchRoster_(games) {
  const teams=[...new Set(games.flatMap(g=>[g.home,g.away]))];
  const r=request_(ROSTER_URL,'Roster CSV',false);
  let csv;try {csv=Utilities.parseCsv(r.text);}catch(e){fail_('Invalid roster CSV.');}
  const fetched=now_();
  const published=header_(r.headers||{},'last-modified') || fetched;
  return validateRoster_(csv,teams,published,fetched);
}
function saveRoster_(rows,games) {
  const teams=new Set(games.flatMap(g=>[g.home,g.away]));
  write_(TAB_ROSTER,ROSTER_HEADERS,read_(TAB_ROSTER,ROSTER_HEADERS.length).filter(r=>!teams.has(r[2])).concat(rows));
}
function pullRosters() {return run_('Rosters',()=>{const games=requireGames_(),rows=fetchRoster_(games);saveRoster_(rows,games);log_('Rosters','','SUCCESS',rows.length+' skill players; injuries UNKNOWN',0);});}
function diagnoseRosterAccess() {
  // Diagnostic reads public data only; no Sheets, properties, or paid API writes/calls.
  let msg;try{const rows=fetchRoster_([{home:'New England Patriots',away:'Seattle Seahawks'},{home:'San Francisco 49ers',away:'Los Angeles Rams'}]);msg='PASS: '+rows.length+' skill players across NE, SEA, SF, LA. Publication: '+rows[0][9]+'. Injuries UNKNOWN.';}catch(e){msg='FAIL: '+safeError_(e);}
  SpreadsheetApp.getUi().alert(msg);
}
// Superseded: injury research is performed at analysis time from live sources;
// this legacy Sheet-side pull remains available only for historical recovery.
function pullInjuries() {return run_('Injuries',()=>{
  const roster=read_(TAB_ROSTER,ROSTER_HEADERS.length);
  if(!roster.length)fail_('ROSTER is empty. Pull Rosters first; no injury data was written.');
  const data=loadNflverseInjuries_(SEASON),im=data.map;
  const skillRows=data.rows.filter(r=>['QB','RB','FB','WR','TE'].includes(String(r[im.position]||'').toUpperCase()));
  const time=now_(),touched={},exceptions=[];
  skillRows.forEach(injuryRow=>{
    const resolved=matchRosterForInjuryRow_(injuryRow,im,roster);
    if(!resolved.row) {
      exceptions.push({season:SEASON,week:data.week,name:String(injuryRow[im.full_name]||''),
        team:teamFullNameForAbbr_(injuryRow[im.team])||String(injuryRow[im.team]||''),game:'',
        candidates:resolved.candidates||'',reason:resolved.reason,
        legId:'INJURY:'+String(injuryRow[im.gsis_id]||injuryRow[im.full_name])+':'+String(injuryRow[im.team])});
      return;
    }
    const row=resolved.row;
    touched[row[5]+'|'+row[2]]=true;
    row[11]=String(injuryRow[im.practice_status]||'').trim();
    row[12]=String(injuryRow[im.report_status]||'').trim().toUpperCase();
    row[13]=data.asset.updated;row[14]=STATUS_SOURCE_INJURY_REPORT;
  });
  // Skill players on ROSTER who are not on this week's injury report at all
  // are presumed not listed (no game-status concern), but the check still
  // ran for them: record that, rather than leaving them at UNKNOWN forever.
  // Manual inactives confirmations live on LEGS, scoped to one event, and
  // are never stored here, so there is nothing on ROSTER to protect.
  roster.forEach(r=>{
    if(touched[r[5]+'|'+r[2]])return;
    r[11]='';r[12]='';r[13]=data.asset.updated;r[14]=STATUS_SOURCE_INJURY_REPORT;
  });
  write_(TAB_ROSTER,ROSTER_HEADERS,roster);
  upsertExceptions_(exceptions,time);
  const matchedCount=skillRows.length-exceptions.length;
  log_('Injuries','','SUCCESS',matchedCount+' matched, '+exceptions.length+' unmatched of '+skillRows.length+' skill-position injury-report rows; week '+data.week+'; asset '+data.asset.url+'; zero Odds API credits',0);
  SpreadsheetApp.getUi().alert('Injuries updated from the official report (via nflverse): '+matchedCount+' matched, '+exceptions.length+' unmatched (see EXCEPTIONS). Week '+data.week+', asset last updated '+data.asset.updated+'.');
  return {matched:matchedCount,unmatched:exceptions.length,week:data.week,asset:data.asset.url,assetUpdated:data.asset.updated};
});}

function propsHeaders_() {
  const h=['Player','Team','Pos','Status']; OU_MARKETS.forEach(m=>h.push(m[1]+' Line',m[1]+' O',m[1]+' U'));
  h.push('Game','Slate','Updated','Event ID','Bookmaker','Kickoff UTC','Market Source Times JSON','Roster Source','Roster Source Updated UTC','Roster Fetched UTC','Join Status','Eligibility JSON','Validation Notes'); return h;
}
function eligible_(p) {return Number.isFinite(p)&& (PRICE_FLOOR===null||p>PRICE_FLOOR);}
function matchPlayer_(name,g,roster) {
  const all=roster.filter(r=>r[0]===normName_(name));
  const matches=all.filter(r=>r[2]===g.home||r[2]===g.away);
  const unique=[...new Map(matches.map(r=>[r[5]+'|'+r[2],r])).values()];
  return unique.length===1?{row:unique[0],status:'MATCHED'}:{row:[],status:unique.length>1?'AMBIGUOUS':all.length?'TEAM_MISMATCH':'UNMATCHED'};
}
function propsRows_(g,payload,roster,time) {
  if(payload.id!==g.id||payload.home_team!==g.home||payload.away_team!==g.away||!Number.isFinite(Date.parse(payload.commence_time)))fail_('Props event/team mismatch.');
  const books=(payload.bookmakers||[]).filter(b=>b.key===BOOK);
  if(books.length!==1)fail_('DraftKings missing or duplicated; previous props preserved.');
  const players={},times={},marketSeen={};
  for(const m of books[0].markets||[]) {
    if(!PROP_MARKETS.includes(m.key))continue;
    if(marketSeen[m.key])fail_('Duplicate prop market.');marketSeen[m.key]=true;
    times[m.key]=m.last_update||'';
    for(const o of m.outcomes||[]) {
      if(!o.description||!Number.isFinite(o.price)||Math.abs(o.price)<100)fail_('Malformed prop outcome.');
      const key=normName_(o.description);
      if(!players[key])players[key]={name:o.description,slots:{}};
      const p=players[key]; if(p.name!==o.description)fail_('Ambiguous normalized names in odds.');
      const s=p.slots[m.key]||(p.slots[m.key]={});
      if(!['Over','Under'].includes(o.name)||!Number.isFinite(o.point))fail_('Invalid over/under outcome.');
      const side=o.name;if(s.line!==undefined&&s.line!==o.point)fail_('Mismatched lines; previous event props preserved.');s.line=o.point;
      if(s[side]!==undefined&&s[side]!==o.price)fail_('Conflicting duplicate price.'); s[side]=o.price;
    }
  }
  const rows=Object.values(players).map(p=>{
    const meta={row:[],status:'UNKNOWN_NOT_ENRICHED'},r=meta.row,flags={},notes=[];
    const row=[p.name,r[2]||'',r[3]||'','UNKNOWN'];
    const flag=(market,side,price)=>{
      const age=Date.parse(time)-Date.parse(times[market]);
      flags[market+':'+side]={priceEligible:eligible_(price),playerTeamResolved:false,sourceFresh:Number.isFinite(age)&&age>=-60000&&age<=15*60000,injuryVerified:false};
    };
    OU_MARKETS.forEach(m=>{const s=p.slots[m[0]];if(!s){row.push('','','');return;}
      row.push(s.line,s.Over===undefined?'':s.Over,s.Under===undefined?'':s.Under);
      if(s.Over===undefined||s.Under===undefined)notes.push(m[0]+': one side missing');
      if(s.Over!==undefined)flag(m[0],'Over',s.Over);if(s.Under!==undefined)flag(m[0],'Under',s.Under);
    });
    row.push(g.matchup,g.slate||'Other',time);
    row.push(g.id,BOOK,payload.commence_time,JSON.stringify(times),r[8]||'',r[9]||'',r[10]||'',meta.status,JSON.stringify(flags),notes.join('; '));return row;
  });
  if(!rows.length)fail_('No supported props returned; previous event props preserved.');return rows;
}
function mergeProps_(old,rows,g) {
  const eventIndex=propsHeaders_().indexOf('Event ID'),gameIndex=propsHeaders_().indexOf('Game');
  return old.filter(r=>r[eventIndex]?String(r[eventIndex])!==String(g.id):r[gameIndex]!==g.matchup).concat(rows);
}
function alternatePropsRows_(g,payload,roster,time) {
  if(payload.id!==g.id||payload.home_team!==g.home||payload.away_team!==g.away||!Number.isFinite(Date.parse(payload.commence_time)))fail_('Alternate props event/team mismatch.');
  const books=(payload.bookmakers||[]).filter(b=>b.key===BOOK);if(books.length!==1)fail_('DraftKings alternate props missing or duplicated; previous alternate props preserved.');
  const rows=[],seen={};
  for(const market of books[0].markets||[]) {
    if(!MOBILE_ALTERNATE_MARKETS.includes(market.key))continue;
    const updated=market.last_update||'';
    for(const outcome of market.outcomes||[]) {
      if(!outcome.description||!Number.isFinite(outcome.price)||Math.abs(outcome.price)<100||!Number.isFinite(outcome.point))fail_('Malformed alternate-prop outcome.');
      const identity=[market.key,normName_(outcome.description),outcome.name,outcome.point,outcome.price].join('|');if(seen[identity])fail_('Duplicate alternate-prop outcome.');seen[identity]=true;
      const meta=matchPlayer_(outcome.description,g,roster),r=meta.row,age=Date.parse(time)-Date.parse(updated);
      const note=[];if(!eligible_(outcome.price))note.push('Price is visible but ineligible under the '+PRICE_FLOOR+' floor.');if(meta.status!=='MATCHED')note.push('Roster join '+meta.status+'.');if(!Number.isFinite(age)||age< -60000||age>15*60000)note.push('Market source timestamp is not fresh.');
      rows.push([outcome.description,r[2]||'',r[3]||'','UNKNOWN',market.key,outcome.point,outcome.name,outcome.price,g.matchup,g.slate||'International/Saturday/Other',time,g.id,BOOK,payload.commence_time,updated,r[8]||'',r[9]||'',r[10]||'',meta.status,note.join(' ')]);
    }
  }
  if(!rows.length)fail_('No requested alternate props returned; previous alternate props preserved.');return rows;
}
function propsRowIsGame_(r,g) {const eventIndex=propsHeaders_().indexOf('Event ID'),gameIndex=propsHeaders_().indexOf('Game');return r[eventIndex]?String(r[eventIndex])===String(g.id):r[gameIndex]===g.matchup;}
function replacePropsRows_(rows,g) {const h=propsHeaders_();return replaceRows_(TAB_PROPS,h,[h.indexOf('Game'),h.indexOf('Event ID')],r=>propsRowIsGame_(r,g),rows);}
function alternateRowIsGame_(r,g) {const event=ALT_PROPS_HEADERS.indexOf('Event ID'),game=ALT_PROPS_HEADERS.indexOf('Game');return r[event]?String(r[event])===String(g.id):r[game]===g.matchup;}
function replaceAlternateRows_(rows,g) {return replaceRows_(TAB_ALT_PROPS,ALT_PROPS_HEADERS,[ALT_PROPS_HEADERS.indexOf('Game'),ALT_PROPS_HEADERS.indexOf('Event ID')],r=>alternateRowIsGame_(r,g),rows);}
function mergeAlternateProps_(old,rows,g) {
  const event=ALT_PROPS_HEADERS.indexOf('Event ID'),game=ALT_PROPS_HEADERS.indexOf('Game');
  return old.filter(r=>r[event]?String(r[event])!==String(g.id):r[game]!==g.matchup).concat(rows);
}
function loadAlternatePropsForGames_(games,onProgress,preparedRoster) {
  const roster=[];
  let successes=0,stoppedMessage='',warnings=[],charges=[];
  for(const g of games) {
    try {
      if(onProgress)onProgress(g);
      const expected=MOBILE_ALTERNATE_MARKETS.length;
      logRequired_('Mobile alternate props',g.id,'PLANNED','Expected '+expected+' credits for '+MOBILE_ALTERNATE_MARKETS.join(', ')+'; no automatic paid retry.',expected);
      const response=oddsRequest_('/sports/'+SPORT+'/events/'+encodeURIComponent(g.id)+'/odds','bookmakers='+requestBookmakers_()+'&markets='+MOBILE_ALTERNATE_MARKETS.join(',')+'&oddsFormat=american',true,g.id,expected),payload=json_(response,'Odds');
      charges.push({event_id:g.id,key_slot:response.slot?response.slot.label:'',actual_credits:numberHeader_(response.headers,'x-requests-last')});
      const time=now_(),rows=alternatePropsRows_(g,payload,roster,time);
      replaceAlternateRows_(rows,g);
      recordOddsApiLineHistorySafely_(payload,'mobile_alternate_props_refresh',g.id);
      recordComparisonQuotesSafely_(payload,'alternate',time);
      log_('Mobile alternate props',g.id,'SUCCESS',rows.length+' ladder outcomes; '+rows.filter(r=>r[18]!=='MATCHED').length+' unresolved joins',0);successes++;
    } catch(e) {
      const message=safeError_(e);warnings.push(g.matchup+': '+message);log_('Mobile alternate props',g.id,'ERROR',message,0);
      if(e&&e.stopPaidBatch){stoppedMessage=message;break;}
    }
  }
  return {successes:successes,total:games.length,warnings:warnings,stopped_message:stoppedMessage,charges:charges};
}
function loadProps(){return loadCheckedProps();}
function loadAndAnalyzeSelectedGames(){
  const loaded=loadCheckedProps();
  if(!loaded||loaded.successes!==loaded.total)return loaded;
  return exportSelectedGamesForAnalysis();
}
function loadCheckedProps(prepared) {
  // Modal dialogs suspend Apps Script and release locks: confirm BEFORE acquiring lock.
  const selected=requireGames_(),signature=JSON.stringify(selected),ui=SpreadsheetApp.getUi();
  if(!prepared && ui.alert('Load '+selected.length+' games?', 'Up to '+selected.length*PROP_MARKETS.length+' odds credits. NBA player-team enrichment is not yet loaded. No automatic paid retries.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('Props',()=>{
    const games=requireGames_();if(JSON.stringify(games)!==signature)fail_('Selection changed; run again.');
    const roster=[];
    let successes=0,stoppedMessage='';
    for(const g of games) {
      try {
        const payload=odds_('/sports/'+SPORT+'/events/'+encodeURIComponent(g.id)+'/odds','bookmakers='+requestBookmakers_()+'&markets='+PROP_MARKETS.join(',')+'&oddsFormat=american',true,g.id,PROP_MARKETS.length);
        const time=now_(),rows=propsRows_(g,payload,roster,time);
        replacePropsRows_(rows,g);
        recordOddsApiLineHistorySafely_(payload,'desktop_props_refresh',g.id);
        recordComparisonQuotesSafely_(payload,'standard',time);
        // Stamp after the event's successful write, never for failed or absent events.
        const idx=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),i=idx.findIndex(r=>r[0]===g.id);
        if(i>=0)sheet_(TAB_INDEX).getRange(i+2,13).setValue(time);
        log_('Props',g.id,'SUCCESS',rows.length+' rows; '+rows.filter(r=>r[38]!=='MATCHED').length+' unresolved joins',0);successes++;
      } catch(e) {log_('Props',g.id,'ERROR',safeError_(e),0);if(e&&e.stopPaidBatch){stoppedMessage=safeError_(e);break;}}
    }
    SpreadsheetApp.getActiveSpreadsheet().toast(successes+'/'+games.length+' games updated. Review LOG and join/eligibility columns; injuries UNKNOWN.');
    if(stoppedMessage)ui.alert(stoppedMessage);
    return {successes:successes,total:games.length};
  });
}

function gameLines_(g) {
  const books=(g.bookmakers||[]).filter(b=>b.key===BOOK);if(books.length!==1)fail_('DraftKings game lines missing.');
  const get=k=>{const a=(books[0].markets||[]).filter(m=>m.key===k);if(a.length!==1)fail_('Incomplete/duplicate game line markets.');return a[0];};
  const s=get('spreads'),t=get('totals'),m=get('h2h');
  const one=(a,name)=>{const b=(a.outcomes||[]).filter(o=>o.name===name);if(b.length!==1)fail_('Missing/duplicate game outcome.');return b[0];};
  const homeSpread=one(s,g.home_team),awaySpread=one(s,g.away_team),overTotal=one(t,'Over'),underTotal=one(t,'Under'),hs=homeSpread.point,as=awaySpread.point,total=overTotal.point;
  if(!Number.isFinite(hs)||!Number.isFinite(as)||hs!==-as||!Number.isFinite(total)||underTotal.point!==total)fail_('Inconsistent spread/total lines.');
  const hm=one(m,g.home_team).price,am=one(m,g.away_team).price;
  if(!Number.isFinite(hm)||!Number.isFinite(am))fail_('Invalid moneyline.');
  return {values:[hs===0?'Pick':hs<0?g.home_team:g.away_team,Math.min(hs,as),total,hm,am,(total-hs)/2,(total+hs)/2],prices:{home_spread:Number.isFinite(homeSpread.price)?homeSpread.price:'',away_spread:Number.isFinite(awaySpread.price)?awaySpread.price:'',total_over:Number.isFinite(overTotal.price)?overTotal.price:'',total_under:Number.isFinite(underTotal.price)?underTotal.price:''},source:JSON.stringify({spreads:s.last_update||'',totals:t.last_update||'',h2h:m.last_update||''})};
}
function nbaGameOddsFresh_(row,atUtc) {
  const at=Date.parse(atUtc),written=Date.parse(exportValue_(row[IDX.LINES_UPDATED])),maxAge=NBA_GAME_PRICE_FRESHNESS_MINUTES*60000;
  if(!Number.isFinite(at)||!Number.isFinite(written)||at-written<0||at-written>=maxAge)return {fresh:false,reason:'GAME_ODDS_REQUEST_STALE_OR_MISSING'};
  let sources;try{sources=JSON.parse(String(row[IDX.LINES_SOURCE]||''));}catch(ignore){return {fresh:false,reason:'BOOKMAKER_TIMESTAMPS_MISSING'};}
  for(const market of ['h2h','spreads','totals']){
    const updated=Date.parse(String(sources[market]||'')),age=at-updated;
    if(!Number.isFinite(updated)||age<0||age>=maxAge)return {fresh:false,reason:'BOOKMAKER_'+market.toUpperCase()+'_STALE_OR_MISSING'};
  }
  return {fresh:true,reason:''};
}
function refreshGameLines() {
  const ui=SpreadsheetApp.getUi();if(ui.alert('Refresh game lines?','Up to 3 credits; one DraftKings request, no automatic retry.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('Game lines',()=>{
    const rows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length);if(!rows.length)fail_('Run Refresh Index first.');
    const data=odds_('/sports/'+SPORT+'/odds','bookmakers='+requestBookmakers_()+'&markets=h2h,spreads,totals&oddsFormat=american',true,'',3);
    if(!Array.isArray(data))fail_('Invalid game lines response.');
    recordComparisonQuotesSafely_(data,'game',now_());
    rows.forEach(r=>{try{
      const matches=data.filter(g=>g.id===r[0]);if(matches.length!==1)fail_('Event missing/duplicated in game lines.');const g=matches[0];
      if(g.away_team+' @ '+g.home_team!==r[1])fail_('Game lines team mismatch.');
      const result=gameLines_(g);result.values.forEach((v,i)=>r[i+3]=v);r[IDX.LINES_UPDATED]=now_();r[IDX.LINES_SOURCE]=result.source;r[IDX.BOOK]=BOOK;
      r[IDX.HOME_SPREAD_PRICE]=result.prices.home_spread;r[IDX.AWAY_SPREAD_PRICE]=result.prices.away_spread;r[IDX.TOTAL_OVER_PRICE]=result.prices.total_over;r[IDX.TOTAL_UNDER_PRICE]=result.prices.total_under;
    }catch(e){log_('Game lines',r[0],'ERROR',safeError_(e),0);}});
    write_(TAB_INDEX,INDEX_HEADERS.concat(INDEX_EXTRA),rows);
  });
}
function poolDisplayValue_(value) {return value===null||value===undefined||value===''?'UNKNOWN':String(value);}
function keyPoolStatusText_() {
  const pool=nbaSharedKeyView_(),lines=['Shared owner key pool (cached; no network call):'];
  pool.slots.forEach(slot=>lines.push(slot.label+(slot.active?' (PREFERRED)':'')+' — Available: '+slot.remaining+' | Used: '+slot.used+' | State: '+slot.state+' | Checked: '+slot.updated));
  lines.push('','Values come only from prior API response headers. UNKNOWN does not mean zero.');return lines.join('\n');
}
function showApiKeyPool() {SpreadsheetApp.getUi().alert(keyPoolStatusText_());}
function resetApiKeyPool() {
  fail_('NBA uses the shared owner key pool. Manage keys in the owner dashboard.');
}
function showCredits() {return run_('Credits',()=>{
  nbaSharedCall_('check_balances',{},true);
  SpreadsheetApp.getUi().alert(keyPoolStatusText_());
});}

function ladderScanGame_() {
  const games=checkedGames_();
  if(games.length!==1)fail_('Check exactly one game on INDEX before running a ladder scan.');
  return games[0];
}
function ladderScanParams_() {
  // Bookmakers takes priority over regions, so do not send both parameters.
  return 'bookmakers='+encodeURIComponent(BOOK)+'&markets='+LADDER_SCAN_MARKETS.map(encodeURIComponent).join(',')+'&oddsFormat=american';
}
function ladderScanPlan_(game) {
  return '/sports/'+SPORT+'/events/'+encodeURIComponent(game.id)+'/odds?'+ladderScanParams_();
}
function writeDriveTextIdempotent_(name,text) {
  const matches=[],files=DriveApp.getFilesByName(name);
  while(files.hasNext())matches.push(files.next());
  if(matches.length>1)fail_('Multiple Drive files named '+name+' exist. Resolve them before rerunning; no new file was created.');
  const file=matches.length===1?matches[0]:DriveApp.createFile(name,text,MimeType.PLAIN_TEXT);
  if(matches.length===1)file.setContent(text);
  return file;
}
function analysisExportFolder_() {
  const properties=PropertiesService.getScriptProperties(),saved=properties.getProperty(MOBILE_EXPORT_FOLDER_PROPERTY);
  if(saved) {
    try{return DriveApp.getFolderById(saved);}catch(ignore){properties.deleteProperty(MOBILE_EXPORT_FOLDER_PROPERTY);}
  }
  const matches=[],folders=DriveApp.getFoldersByName(MOBILE_EXPORT_FOLDER_NAME);
  while(folders.hasNext())matches.push(folders.next());
  if(matches.length>1)fail_('Multiple Drive folders named '+MOBILE_EXPORT_FOLDER_NAME+' exist. Resolve them before exporting.');
  const folder=matches.length===1?matches[0]:DriveApp.createFolder(MOBILE_EXPORT_FOLDER_NAME);
  properties.setProperty(MOBILE_EXPORT_FOLDER_PROPERTY,folder.getId());
  return folder;
}
function writeAnalysisExport_(name,text) {
  const folder=analysisExportFolder_(),matches=[],files=folder.getFilesByName(name);
  while(files.hasNext())matches.push(files.next());
  if(matches.length)fail_('Analysis snapshot '+name+' already exists. It will not be overwritten.');
  const file=folder.createFile(name,text,MimeType.PLAIN_TEXT);
  return {file:file,folder:folder};
}

// Sheet-only handoff for parse-only analysis. This intentionally performs no
// network request, including no injury refresh, so exporting still works when
// the free injury source is unavailable. The payload states that explicitly.
function exportValue_(value) {
  return Object.prototype.toString.call(value)==='[object Date]'?value.toISOString():value;
}
function exportRowObject_(headers,row) {
  const out={};headers.forEach((header,i)=>out[header]=exportValue_(row[i]));return out;
}
function readExistingTable_(name) {
  const s=spreadsheet_().getSheetByName(name);
  if(!s||s.getLastRow()<1)return {headers:[],rows:[]};
  const width=s.getLastColumn();
  if(width<1)return {headers:[],rows:[]};
  const headers=s.getRange(1,1,1,width).getValues()[0].map(v=>String(v).trim());
  const rows=s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,width).getValues();
  return {headers,rows};
}
function analysisSnapshotId_(timestamp,requestId) {
  const id=String(requestId||Utilities.getUuid()).replace(/[^a-zA-Z0-9-]/g,'');
  if(!id)fail_('Unable to create a unique analysis snapshot ID.');
  return String(timestamp).replace(/[^0-9]/g,'')+'-'+id;
}
function analysisExportFilename_(timestamp,eventIds,snapshotId) {
  const day=String(timestamp).slice(0,10),ids=eventIds.slice().sort().map(id=>String(id).replace(/[^a-zA-Z0-9_-]/g,''));
  return 'props_export_'+day+'_'+ids.join('-')+'_'+snapshotId+'.json';
}
function compactAnalysisGameFilename_(timestamp,eventId,snapshotId) {
  return 'analysis_game_'+String(timestamp).slice(0,10)+'_'+String(eventId).replace(/[^a-zA-Z0-9_-]/g,'')+'_'+snapshotId+'.json';
}
function analysisManifestFilename_(timestamp,eventIds,snapshotId) {
  const ids=eventIds.slice().sort().map(id=>String(id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,10));
  return 'analysis_manifest_'+String(timestamp).slice(0,10)+'_'+ids.join('-')+'_'+snapshotId+'.json';
}
function analysisEligibility_(game,timestamp) {
  const kickoff=Date.parse(String(game.kickoff_utc||'')),created=Date.parse(String(timestamp||''));
  if(!Number.isFinite(kickoff))return {eligible:false,reason:'KICKOFF_UNAVAILABLE'};
  if(!Number.isFinite(created))return {eligible:false,reason:'EXPORT_TIME_UNAVAILABLE'};
  return kickoff>created?{eligible:true,reason:''}:{eligible:false,reason:'KICKOFF_ALREADY_REACHED_AT_EXPORT'};
}
function compactEventAnalysisPayload_(payload,game,timestamp,auditExport) {
  const eventId=String(game.event_id),eligibility=analysisEligibility_(game,timestamp),forEvent=rows=>rows.filter(item=>String(item.event_id||item['Event ID']||'')===eventId);
  const fresh=item=>{
    const snapshot=Date.parse(timestamp),source=Date.parse(String(item.source_updated_utc||'')),written=Date.parse(String(item.updated_utc||'')),maxAge=SLATE_FRESHNESS_MINUTES*60000;
    return Number.isFinite(source)&&Number.isFinite(written)&&snapshot-source>=0&&snapshot-source<maxAge&&snapshot-written>=0&&snapshot-written<maxAge;
  };
  const gameMarkets=forEvent(payload.game_markets||[]),allProps=forEvent(payload.prop_markets||[]),allAlternates=forEvent(payload.alternate_prop_markets||[]),propMarkets=allProps.filter(fresh),alternateMarkets=allAlternates.filter(fresh),pendingLegs=(payload.pending_legs||[]).filter(item=>String(item['Event ID']||item.event_id||'')===eventId);
  const teams=new Set([String(game.home_team||''),String(game.away_team||'')]),roster=(payload.roster_rows||[]).filter(item=>teams.has(String(item.Team||item.team||'')));
  const coverage=((payload.provider_coverage||{})[eventId]||{}),diagnostics=((payload.cross_provider_diagnostics||{}).events||{})[eventId]||{};
  const compactGame=JSON.parse(JSON.stringify(game));
  if(!compactGame.odds||compactGame.odds.actionable!==true) {
    const old=compactGame.odds||{};
    compactGame.odds={actionable:false,reason:old.freshness_reason||'Game prices are missing or older than 90 minutes. Refresh game odds with separate approval.',lines_updated_utc:old.lines_updated_utc||'',bookmaker:old.bookmaker||BOOK};
  }
  return {schema_version:1,kind:'nba_compact_game_analysis',sport:SPORT,league:'NBA',app_build:MOBILE_APP_BUILD,snapshot_id:payload.snapshot_id,export_timestamp_utc:timestamp,event_id:eventId,analysis_eligible:eligibility.eligible,ineligible_reason:eligibility.reason,
    audit_export:auditExport,pricing_instructions:payload.pricing_instructions||'',usage_instructions:payload.usage_instructions||'',usage_context:(payload.usage_context||{})[eventId]||null,game:compactGame,game_markets:gameMarkets,prop_markets:propMarkets,alternate_prop_markets:alternateMarkets,roster_rows:roster,pending_legs:pendingLegs,
    provider_coverage:coverage,cross_provider_diagnostics:diagnostics,provider_usage:payload.provider_usage,
    data_quality:{props_market_count:propMarkets.length,alternate_prop_market_count:alternateMarkets.length,stale_prop_market_count:allProps.length-propMarkets.length,stale_alternate_market_count:allAlternates.length-alternateMarkets.length,roster_row_count:roster.length,pending_leg_count:pendingLegs.length,
      duplicate_provider_observations:Number(diagnostics.same_bookmaker_duplicate_observation_count||0),note:'Raw provider quotes and redundant sheet rows remain only in the audit export.'}};
}
function writeCompactAnalysisFiles_(payload,timestamp,auditExport) {
  const games=[];
  payload.games.forEach(game=>{
    const filename=compactAnalysisGameFilename_(timestamp,game.event_id,payload.snapshot_id),compact=compactEventAnalysisPayload_(payload,game,timestamp,auditExport),saved=writeAnalysisExport_(filename,JSON.stringify(compact,null,2));
    games.push({event_id:String(game.event_id),matchup:String(game.matchup||''),kickoff_utc:String(game.kickoff_utc||''),analysis_eligible:compact.analysis_eligible,ineligible_reason:compact.ineligible_reason,filename:filename,drive_url:saved.file.getUrl()});
  });
  const filename=analysisManifestFilename_(timestamp,payload.event_ids,payload.snapshot_id),manifest={schema_version:1,kind:'nba_slate_analysis_manifest',sport:SPORT,league:'NBA',app_build:MOBILE_APP_BUILD,snapshot_id:payload.snapshot_id,export_timestamp_utc:timestamp,
    audit_export:auditExport,event_ids:payload.event_ids.slice(),eligible_event_ids:games.filter(g=>g.analysis_eligible).map(g=>g.event_id),ineligible_events:games.filter(g=>!g.analysis_eligible).map(g=>({event_id:g.event_id,reason:g.ineligible_reason})),events:games,
    provider_usage:payload.provider_usage,provider_scope:'SportsGameOdds NBA coverage is disabled pending an approved coverage test.',
    instructions:'Each compact game file is the only input a game worker should read. The audit export is retained for verification, not routine slate research.'},saved=writeAnalysisExport_(filename,JSON.stringify(manifest,null,2));
  return {manifestFilename:filename,manifestDriveUrl:saved.file.getUrl(),gameFiles:games,eligibleEventIds:manifest.eligible_event_ids,ineligibleEventIds:manifest.ineligible_events.map(item=>item.event_id)};
}
function providerQuoteObjects_(eventSet) {
  return sgoQuoteRows_().filter(r=>eventSet.has(String(r[2]))).map(r=>exportRowObject_(NBA_PROPS_HEADERS,r));
}
function providerCoverage_(quotes,eventIds) {
  const byEvent={};eventIds.forEach(id=>byEvent[id]={});quotes.forEach(q=>{
    const event=String(q['Odds API Event ID']);if(!byEvent[event])byEvent[event]={};const provider=String(q.Provider);
    const item=byEvent[event][provider]||(byEvent[event][provider]={provider:provider,provider_event_id:q['Provider Event ID'],markets:{},available_quote_count:0});
    item.markets[q['Market Key']]=(item.markets[q['Market Key']]||0)+1;if(q.Available===true)item.available_quote_count++;
  });return byEvent;
}
function providerCoverageSummary_(coverage) {
  const events=Object.keys(coverage||{}).sort();if(!events.length)return 'No provider quotes were available in this export.';
  return events.map(eventId=>{
    const providers=coverage[eventId]||{};
    const detail=Object.keys(providers).sort().map(provider=>{
      const item=providers[provider]||{},markets=Object.keys(item.markets||{}).sort();
      return provider+': '+Number(item.available_quote_count||0)+' available quote(s)'+(markets.length?' across '+markets.join(', '):'');
    });
    return eventId+' — '+(detail.join('; ')||'no provider quotes');
  }).join(' | ');
}
function crossProviderExportDiagnostics_(quotes,eventIds) {
  const result={scope:'SportsGameOdds NBA coverage is disabled pending an approved coverage test.',events:{}};
  eventIds.forEach(eventId=>{
    const rows=quotes.filter(q=>String(q['Odds API Event ID'])===String(eventId)&&q.Available===true),byKey={};
    rows.forEach(q=>{const key=[q['Market Key'],q['Player Key'],q.Side,q.Line].join('|');(byKey[key]||(byKey[key]=[])).push(q);});
    let exact=0,priceDiff=0,duplicateDraftKings=0;Object.keys(byKey).forEach(key=>{const group=byKey[key],odds=group.filter(q=>q.Provider==='the_odds_api'),sgo=group.filter(q=>q.Provider==='sportsgameodds');if(odds.length&&sgo.length){exact++;duplicateDraftKings++;if(Number(odds[0]['American Price'])!==Number(sgo[0]['American Price']))priceDiff++;}});
    result.events[eventId]={same_bookmaker_duplicate_observation_count:duplicateDraftKings,exact_line_match_count:exact,price_difference_count:priceDiff,interpretation:'Provider observations are retained separately and are not independent sportsbook prices.'};
  });return result;
}
function buildAnalysisExport_(games,timestamp,providerUsage) {
  const eventIds=games.map(g=>g.id),eventSet=new Set(eventIds),teams=new Set(games.flatMap(g=>[g.home,g.away]));
  const indexRows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length),indexById={};indexRows.forEach(r=>indexById[String(r[IDX.EVENT])]=r);
  const exportedGames=games.map(g=>{
    const r=indexById[g.id];if(!r)fail_('Selected event '+g.id+' is missing from INDEX.');
    const priceFreshness=nbaGameOddsFresh_(r,timestamp);
    const time=nbaGameTime_(r[IDX.KICKOFF],Date.parse(timestamp));
    return {event_id:g.id,matchup:r[1],home_team:r[IDX.HOME],away_team:r[IDX.AWAY],kickoff_utc:exportValue_(r[IDX.KICKOFF]),kickoff_et:time.full_label,slate:time.day_label,game_date_et:time.date_key,props_updated_utc:exportValue_(r[IDX.PROPS_UPDATED]),
      odds:{favorite:r[3],spread:r[4],total:r[5],home_moneyline:r[6],away_moneyline:r[7],home_spread_price:r[IDX.HOME_SPREAD_PRICE],away_spread_price:r[IDX.AWAY_SPREAD_PRICE],total_over_price:r[IDX.TOTAL_OVER_PRICE],total_under_price:r[IDX.TOTAL_UNDER_PRICE],home_implied_total:r[8],away_implied_total:r[9],bookmaker:r[IDX.BOOK],lines_updated_utc:exportValue_(r[IDX.LINES_UPDATED]),lines_source_utc:r[IDX.LINES_SOURCE],actionable:priceFreshness.fresh,freshness_reason:priceFreshness.reason}};
  });
  const propHeaders=propsHeaders_(),propMap=headerMap_(propHeaders,['Player','Team','Event ID','Bookmaker'],'PROPS'),propUpdatedIndex=propHeaders.indexOf('Updated'),propSourceIndex=propHeaders.indexOf('Market Source Times JSON');
  const propRows=read_(TAB_PROPS,propHeaders.length).filter(r=>eventSet.has(String(r[propMap['Event ID']])));
  const alternateHeaders=ALT_PROPS_HEADERS,alternateMap=headerMap_(alternateHeaders,['Event ID'],'ALT_PROPS');
  const alternateRows=read_(TAB_ALT_PROPS,alternateHeaders.length).filter(r=>eventSet.has(String(r[alternateMap['Event ID']])));
  const propMarkets=[];
  propRows.forEach(r=>{
    let marketTimes={};try{marketTimes=JSON.parse(String(r[propSourceIndex]||'{}'));}catch(ignore){}
    OU_MARKETS.forEach(m=>{
      const lineIndex=propHeaders.indexOf(m[1]+' Line'),overIndex=propHeaders.indexOf(m[1]+' O'),underIndex=propHeaders.indexOf(m[1]+' U');
      if(r[lineIndex]===''&&r[overIndex]===''&&r[underIndex]==='')return;
      propMarkets.push({event_id:String(r[propMap['Event ID']]),player:r[propMap.Player],team:r[propMap.Team],market_key:m[0],line:exportValue_(r[lineIndex]),over_price:exportValue_(r[overIndex]),under_price:exportValue_(r[underIndex]),bookmaker:r[propMap.Bookmaker],source_updated_utc:exportValue_(marketTimes[m[0]]||''),updated_utc:propUpdatedIndex<0?'':exportValue_(r[propUpdatedIndex])});
    });
  });
  const rosterRows=read_(TAB_ROSTER,ROSTER_HEADERS.length).filter(r=>teams.has(String(r[2])));
  const legsTable=readExistingTable_(TAB_LEGS),legMap={};legsTable.headers.forEach((h,i)=>legMap[h]=i);
  const pendingLegs=legMap.Status===undefined||legMap['Event ID']===undefined?[]:legsTable.rows.filter(r=>String(r[legMap.Status]).toUpperCase()==='PENDING'&&eventSet.has(String(r[legMap['Event ID']])));
  const propsByEvent={};propRows.forEach(r=>propsByEvent[String(r[propMap['Event ID']])]=(propsByEvent[String(r[propMap['Event ID']])]||0)+1);
  const warnings=[];games.forEach(g=>{if(!propsByEvent[g.id])warnings.push('No PROPS rows found for '+g.id+'.');});
  const providerQuotes=providerQuoteObjects_(eventSet),providerCoverage=providerCoverage_(providerQuotes,eventIds),providerCoverageSummary=providerCoverageSummary_(providerCoverage),crossProviderDiagnostics=crossProviderExportDiagnostics_(providerQuotes,eventIds);
  const gameMarkets=[];exportedGames.forEach(game=>{
    const odds=game.odds||{},source=odds.lines_source_utc||'',favoriteSpread=Number(odds.spread),homeSpread=odds.favorite===game.home_team?favoriteSpread:-favoriteSpread,awaySpread=-homeSpread;
    if(odds.actionable!==true)return;
    [['h2h',game.home_team,'Moneyline',odds.home_moneyline],['h2h',game.away_team,'Moneyline',odds.away_moneyline],['spreads',game.home_team,Number.isFinite(homeSpread)?homeSpread:'',odds.home_spread_price],['spreads',game.away_team,Number.isFinite(awaySpread)?awaySpread:'',odds.away_spread_price],['totals','Over',odds.total,odds.total_over_price],['totals','Under',odds.total,odds.total_under_price]].forEach(item=>{if(Number.isFinite(Number(item[3])))gameMarkets.push({event_id:game.event_id,market_key:item[0],selection:item[1],line:exportValue_(item[2]),price:exportValue_(item[3]),bookmaker:odds.bookmaker||BOOK,source_updated_utc:exportValue_(odds.lines_updated_utc),market_source_times_json:source});});
  });
  exportedGames.forEach(game=>{if(!game.odds.actionable)warnings.push(game.matchup+': game prices are stale or missing; game bets are excluded from actionable analysis.');});
  const alternateMarkets=alternateRows.map(r=>({event_id:String(r[alternateMap['Event ID']]),player:r[0],team:r[1],market_key:r[4],line:exportValue_(r[5]),side:r[6],price:exportValue_(r[7]),bookmaker:r[12],source_updated_utc:exportValue_(r[14]),updated_utc:exportValue_(r[10])}));
  // Comparison and consensus are context: a failure leaves notes, never fails the export.
  try{enrichComparisonPricing_(exportedGames,gameMarkets,propMarkets,alternateMarkets);}
  catch(e){warnings.push('Price comparison was not added to this export: '+safeError_(e));}
  return {schema_version:3,sport:SPORT,league:'NBA',export_timestamp_utc:timestamp,event_ids:eventIds.slice(),games:exportedGames,
    injury_pull:{status:'SKIPPED',succeeded_on_this_run:false,skipped_on_this_run:true,detail:'Analysis export is sheet-only and did not call Pull Injuries.'},
    game_markets:gameMarkets,props_rows:propRows.map(r=>exportRowObject_(propHeaders,r)),prop_markets:propMarkets,
    alternate_props_rows:alternateRows.map(r=>exportRowObject_(alternateHeaders,r)),alternate_prop_markets:alternateMarkets,pricing_instructions:pricingInstructions_(),bookmakers_requested:requestedBooks_(),
    usage_context:nbaUsageContextForGames_(exportedGames,propMarkets,alternateMarkets,timestamp),usage_instructions:usageInstructions_(),
    roster_rows:rosterRows.map(r=>exportRowObject_(ROSTER_HEADERS,r)),pending_legs:pendingLegs.map(r=>exportRowObject_(legsTable.headers,r)),
    provider_quotes:providerQuotes,provider_coverage:providerCoverage,provider_coverage_summary:providerCoverageSummary,cross_provider_diagnostics:crossProviderDiagnostics,
    provider_usage:providerUsage||{odds_api:{status:'NOT_RUN'},sports_game_odds:{scope:'NBA coverage test not yet approved',status:'DISABLED_PENDING_COVERAGE_TEST'}},
    data_quality:{selected_game_count:games.length,props_row_count:propRows.length,prop_market_count:propMarkets.length,roster_row_count:rosterRows.length,pending_leg_count:pendingLegs.length,warnings:warnings}};
}
function exportSelectedGamesCore_(games,providerUsage,requestId) {
  const timestamp=now_(),payload=buildAnalysisExport_(games,timestamp,providerUsage),snapshotId=analysisSnapshotId_(timestamp,requestId);
  payload.app_build=MOBILE_APP_BUILD;payload.snapshot_id=snapshotId;
  const filename=analysisExportFilename_(timestamp,payload.event_ids,snapshotId),saved=writeAnalysisExport_(filename,JSON.stringify(payload,null,2)),auditExport={filename:filename,drive_url:saved.file.getUrl()},compact=writeCompactAnalysisFiles_(payload,timestamp,auditExport);
  log_('Analysis export',payload.event_ids.join(','),'SUCCESS','Saved audit export, '+compact.gameFiles.length+' compact game files, and '+compact.manifestFilename+' in '+MOBILE_EXPORT_FOLDER_NAME+'; injury pull SKIPPED; zero Odds API credits',0);
  return {filename:filename,fileId:saved.file.getId(),driveUrl:saved.file.getUrl(),folderUrl:saved.folder.getUrl(),eventIds:payload.event_ids,exportTimestampUtc:timestamp,providerCoverageSummary:payload.provider_coverage_summary,warnings:payload.data_quality.warnings,appBuild:MOBILE_APP_BUILD,snapshotId:snapshotId,
    analysisManifestFilename:compact.manifestFilename,analysisManifestDriveUrl:compact.manifestDriveUrl,analysisGameFiles:compact.gameFiles,eligibleEventIds:compact.eligibleEventIds,ineligibleEventIds:compact.ineligibleEventIds,
    games:payload.games.map(game=>({event_id:game.event_id,matchup:game.matchup,kickoff_et:game.kickoff_et,kickoff_utc:game.kickoff_utc,analysis_eligible:compact.eligibleEventIds.indexOf(game.event_id)>=0}))};
}
function exportSelectedGamesForAnalysis() {
  return run_('Analysis export',()=>{
    const exported=exportSelectedGamesCore_(requireGames_());
    SpreadsheetApp.getUi().alert('Analysis export saved',exported.filename+'\n\nSaved in '+MOBILE_EXPORT_FOLDER_NAME+'.\nWarnings: '+(exported.warnings.join(' ')||'none'),SpreadsheetApp.getUi().ButtonSet.OK);
    return exported;
  });
}
function ladderScanDryRun() {
  return run_('Ladder scan dry run',()=>{
    const game=ladderScanGame_(),plan=ladderScanPlan_(game),detail=plan+' | projected credits: 2 | no request made';
    Logger.log(detail);
    log_('Ladder scan',game.id,'DRY RUN',detail,2);
    SpreadsheetApp.getUi().alert('Ladder scan dry run',game.matchup+'\n\n'+detail,SpreadsheetApp.getUi().ButtonSet.OK);
  });
}
function ladderScanFetch() {
  const planned=ladderScanGame_(),ui=SpreadsheetApp.getUi();
  const message=planned.matchup+'\nMarkets: '+LADDER_SCAN_MARKETS.join(', ')+'\nBookmaker: DraftKings\nMaximum cost: 2 credits\nNo automatic retry. Continue?';
  if(ui.alert('Fetch alternate-line ladder?',message,ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('Ladder scan',()=>{
    const game=ladderScanGame_();
    if(game.id!==planned.id)fail_('INDEX selection changed after confirmation. Run the dry run again.');
    const path='/sports/'+SPORT+'/events/'+encodeURIComponent(game.id)+'/odds',params=ladderScanParams_();
    logRequired_('Ladder scan',game.id,'PLANNED',path+'?'+params,2);
    const response=oddsRequest_(path,params,true,game.id,2);
    const filename='ladder_scan_raw_'+game.id+'.json';
    const file=writeDriveTextIdempotent_(filename,response.text); // Save exact raw body before parsing.
    const payload=json_(response,'Ladder scan');
    if(!payload||payload.id!==game.id)fail_('Ladder scan response event mismatch. Raw response retained in Drive.');
    log_('Ladder scan',game.id,'SUCCESS','Raw response saved to Drive as '+filename+' (file '+file.getId()+').',0);
    ui.alert('Ladder scan saved',filename+'\nEvent: '+game.matchup+'\nReview LOG for actual credits and remaining balance.',ui.ButtonSet.OK);
  });
}

// -----------------------------------------------------------------------------
// Persistent parlay tracker. Every function below is Sheets-only and makes zero
// HTTP/Odds API requests. PARLAYS and LEGS are the permanent source of truth.

function ensureTrackerSheet_(name,headers) {
  const s=sheet_(name);
  s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  s.setFrozenRows(1);
  return s;
}
function compatibleHeaders_(name,desired) {
  const s=sheet_(name),width=Math.max(desired.length,s.getLastColumn?Math.max(s.getLastColumn(),1):desired.length),raw=s.getRange(1,1,1,width).getValues()[0],last=raw.reduce((n,v,i)=>String(v).trim()?i+1:n,0);let headers=raw.slice(0,last).map(v=>String(v).trim());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)fail_(name+' has blank or duplicate headers. Repair the header row before grading.');
  if(!headers.length)headers=[];desired.forEach(h=>{if(headers.indexOf(h)<0)headers.push(h);});s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');s.setFrozenRows(1);return {sheet:s,headers};
}

function setupParlayTracker() {return run_('Tracker setup',()=>{
  ensureTrackerSheet_(TAB_PARLAYS,PARLAY_HEADERS);
  ensureTrackerSheet_(TAB_LEGS,LEG_HEADERS);
  const s=sheet_(TAB_PARLAY_ENTRY);
  s.getRange('A1').setValue('NFL PARLAY ENTRY').setFontWeight('bold');
  const nonDefaultLegCounts_=[];for(let n=PARLAY_LEG_COUNT_MIN;n<=PARLAY_LEG_COUNT_MAX;n++)if(n!==PARLAY_LEG_COUNT_DEFAULT)nonDefaultLegCounts_.push(n);
  s.getRange('A2').setValue('Default is '+PARLAY_LEG_COUNT_DEFAULT+' analyzed legs. '+nonDefaultLegCounts_.join(', ')+' legs are accepted only with explicit owner approval. Then use NBA Tools → Parlay Tracker (free) → Lock In Parlay. Tracker actions never call the Odds API.');
  s.getRange('A3:A7').setValues([['Slate / Label'],['Bookmaker'],['Stake'],['Parlay Notes'],['Combined Odds (calculated when saved)']]).setFontWeight('bold');
  if(!s.getRange('B4').getValue())s.getRange('B4').setValue('DraftKings');
  s.getRange(9,1,1,ENTRY_LEG_COLUMNS).setValues([['Event ID','Event / Game','Player / Team','Market','Side / Selection','Line','American Price','Reasoning','Confidence','Estimated Probability','Notes']]).setFontWeight('bold');
  s.getRange(ENTRY_FIRST_LEG_ROW+PARLAY_LEG_COUNT_MAX,1).setValue('Grading is manual: update Status / actual result / closing line fields on LEGS, then run Grade My Parlays. PENDING is never guessed.');
  s.setFrozenRows(9);
  log_('Tracker setup','','SUCCESS','PARLAYS, LEGS, and entry sheet ready; zero API credits',0);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(s);
});}

function openParlayEntry() {
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_PARLAY_ENTRY);
  if(!s){setupParlayTracker();return;}
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(s);
}

function americanToDecimal_(price) {
  const p=Number(price);
  if(!Number.isFinite(p)||!Number.isInteger(p)||Math.abs(p)<100)fail_('American prices must be whole numbers of +100 or longer, or -100 or shorter.');
  return p>0?1+p/100:1+100/Math.abs(p);
}

function decimalToAmerican_(decimalOdds) {
  const d=Number(decimalOdds);
  if(!Number.isFinite(d)||d<=1)fail_('Invalid decimal odds.');
  return Math.round(d>=2?(d-1)*100:-100/(d-1));
}

function combineAmericanOdds_(prices) {
  if(!Array.isArray(prices)||!prices.length)fail_('At least one price is required.');
  return decimalToAmerican_(prices.reduce((product,p)=>product*americanToDecimal_(p),1));
}

function impliedProbability_(price) {return 1/americanToDecimal_(price);}
function money_(n) {return Math.round((Number(n)+Number.EPSILON)*100)/100;}
function textValue_(v) {return String(v===undefined||v===null?'':v).trim();}
function validEventId_(v) {return /^[a-zA-Z0-9_-]+$/.test(textValue_(v));}

function normalizedProbability_(value) {
  if(value===''||value===null||value===undefined)fail_('Each leg needs an estimated probability.');
  let p=Number(value);
  if(!Number.isFinite(p))fail_('Estimated probability must be a number or percent-formatted cell.');
  if(p>1&&p<=100)p/=100;
  if(p<=0||p>=1)fail_('Estimated probability must be greater than 0% and less than 100%.');
  return p;
}

function validateParlay_(draft) {
  if(!draft||!Array.isArray(draft.legs)||draft.legs.length<PARLAY_LEG_COUNT_MIN||draft.legs.length>PARLAY_LEG_COUNT_MAX)fail_('A parlay must contain between '+PARLAY_LEG_COUNT_MIN+' and '+PARLAY_LEG_COUNT_MAX+' legs.');
  if(!textValue_(draft.label))fail_('Slate / Label is required.');
  if(!textValue_(draft.bookmaker))fail_('Bookmaker is required.');
  const stake=Number(draft.stake);
  if(!Number.isFinite(stake)||stake<=0)fail_('Stake must be greater than zero.');
  const seen={};
  const legs=draft.legs.map((leg,i)=>{
    const x={
      eventId:textValue_(leg.eventId),game:textValue_(leg.game),subject:textValue_(leg.subject),
      market:textValue_(leg.market),selection:textValue_(leg.selection),line:leg.line,
      price:Number(leg.price),reasoning:textValue_(leg.reasoning),confidence:textValue_(leg.confidence),
      probability:normalizedProbability_(leg.probability),notes:textValue_(leg.notes)
    };
    if(!validEventId_(x.eventId))fail_('Leg '+(i+1)+': Event ID is required and may contain letters, numbers, underscores, and hyphens.');
    if(!x.game||!x.market||!x.selection)fail_('Leg '+(i+1)+': Event / Game, Market, and Side / Selection are required.');
    if(!x.reasoning||!x.confidence)fail_('Leg '+(i+1)+': Reasoning and Confidence are required.');
    americanToDecimal_(x.price);
    const key=[x.eventId.toLowerCase(),x.subject.toLowerCase(),x.market.toLowerCase(),x.selection.toLowerCase(),textValue_(x.line)].join('|');
    if(seen[key])fail_('Duplicate leg detected at leg '+(i+1)+'.');
    seen[key]=true;return x;
  });
  const combined=combineAmericanOdds_(legs.map(x=>x.price));
  if(combined<200||combined>500)fail_('Combined odds must be between +200 and +500 inclusive; calculated odds are '+(combined>0?'+':'')+combined+'.');
  return {label:textValue_(draft.label),bookmaker:textValue_(draft.bookmaker),stake:money_(stake),notes:textValue_(draft.notes),legs,combined};
}

function readParlayEntry_() {
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_PARLAY_ENTRY);
  if(!s)fail_('Run Set up / repair tracker first.');
  const meta=s.getRange('B3:B6').getValues().flat();
  const rows=s.getRange(ENTRY_FIRST_LEG_ROW,1,PARLAY_LEG_COUNT_MAX,ENTRY_LEG_COLUMNS).getValues();
  const legs=rows.filter(r=>r.some(v=>textValue_(v)!=='')).map(r=>({eventId:r[0],game:r[1],subject:r[2],market:r[3],selection:r[4],line:r[5],price:r[6],reasoning:r[7],confidence:r[8],probability:r[9],notes:r[10]}));
  return validateParlay_({label:meta[0],bookmaker:meta[1],stake:meta[2],notes:meta[3],legs});
}

function fingerprint_(draft) {
  const legs=draft.legs.map(x=>[x.eventId.toLowerCase(),x.subject.toLowerCase(),x.market.toLowerCase(),x.selection.toLowerCase(),textValue_(x.line),x.price].join('|')).sort();
  const raw=[draft.label.toLowerCase(),draft.bookmaker.toLowerCase(),draft.stake].concat(legs).join('||');
  let h1=2166136261,h2=2246822519;
  for(let i=0;i<raw.length;i++){const c=raw.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^c,3266489917);}
  return ('00000000'+(h1>>>0).toString(16)).slice(-8)+('00000000'+(h2>>>0).toString(16)).slice(-8);
}

function trackerId_(prefix) {return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();}

function saveParlay_(draft,time) {
  const ps=ensureTrackerSheet_(TAB_PARLAYS,PARLAY_HEADERS),ls=ensureTrackerSheet_(TAB_LEGS,LEG_HEADERS);
  const fingerprint=fingerprint_(draft),existing=read_(TAB_PARLAYS,PARLAY_HEADERS.length);
  if(existing.some(r=>String(r[12])===fingerprint))fail_('This exact parlay was already locked in.');
  const parlayId=trackerId_('P'),legIds=draft.legs.map(()=>trackerId_('L'));
  const parlayRow=[parlayId,time,draft.label,draft.bookmaker,draft.legs.length,draft.combined,draft.stake,money_(draft.stake*draft.legs.reduce((p,x)=>p*americanToDecimal_(x.price),1)),'PENDING','','',draft.notes,fingerprint,'','',''];
  const legRows=draft.legs.map((x,i)=>[legIds[i],parlayId,i+1,x.eventId,x.game,x.subject,x.market,x.selection,x.line,x.price,draft.bookmaker,time,x.reasoning,x.confidence,x.probability,'','','PENDING','',x.notes,'','','','','',false,'','','BLOCKED','Not yet evaluated by the availability gate.']);
  const pStart=ps.getLastRow()+1,lStart=ls.getLastRow()+1;
  let parlayWritten=false,legsWritten=false;
  try {
    ps.getRange(pStart,1,1,PARLAY_HEADERS.length).setValues([parlayRow]);parlayWritten=true;
    ls.getRange(lStart,1,legRows.length,LEG_HEADERS.length).setValues(legRows);legsWritten=true;
    ls.getRange(lStart,LEG_HEADERS.indexOf('Manual Availability Confirm')+1,legRows.length,1).insertCheckboxes();
  } catch(e) {
    try{if(legsWritten)ls.deleteRows(lStart,legRows.length);}catch(ignore){}
    try{if(parlayWritten)ps.deleteRow(pStart);}catch(ignore){}
    fail_('Parlay save failed and attempted rollback. Verify PARLAYS and LEGS before retrying.');
  }
  return {parlayId,combined:draft.combined,payout:parlayRow[7]};
}

function clearParlayEntry_() {
  const s=sheet_(TAB_PARLAY_ENTRY);
  s.getRange('B3:B7').clearContent();s.getRange('B4').setValue('DraftKings');
  s.getRange(ENTRY_FIRST_LEG_ROW,1,PARLAY_LEG_COUNT_MAX,ENTRY_LEG_COLUMNS).clearContent();
}

function lockInParlay() {
  const first=readParlayEntry_(),signature=fingerprint_(first),ui=SpreadsheetApp.getUi();
  const odds=(first.combined>0?'+':'')+first.combined;
  if(ui.alert('Lock in this parlay?',first.legs.length+' legs at '+odds+'; stake $'+first.stake+'; potential payout $'+money_(first.stake*first.legs.reduce((p,x)=>p*americanToDecimal_(x.price),1))+'.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  return run_('Lock parlay',()=>{
    const draft=readParlayEntry_();if(fingerprint_(draft)!==signature)fail_('Entry changed during confirmation. Review it and lock in again.');
    const saved=saveParlay_(draft,now_());clearParlayEntry_();
    log_('Lock parlay',saved.parlayId,'SUCCESS',draft.legs.length+' legs at '+odds+'; zero API credits',0);
    ui.alert('Locked in '+saved.parlayId+' at '+odds+'. Potential payout: $'+saved.payout+'.');
    return saved;
  });
}

function gradeOneParlay_(parlay,legs,time) {
  const expected=Number(parlay[4]);
  if(!Number.isInteger(expected)||expected<PARLAY_LEG_COUNT_MIN||expected>PARLAY_LEG_COUNT_MAX||legs.length!==expected)fail_('Parlay '+parlay[0]+' does not have its expected '+PARLAY_LEG_COUNT_MIN+' to '+PARLAY_LEG_COUNT_MAX+' matching legs. Keep it pending and repair LEGS before grading.');
  const numbers=legs.map(l=>Number(l[2]));
  if(new Set(numbers).size!==expected||numbers.some(n=>!Number.isInteger(n)||n<1||n>expected))fail_('Parlay '+parlay[0]+' has invalid or duplicate leg numbers.');
  const statuses=legs.map(l=>textValue_(l[17]).toUpperCase()||'PENDING');
  statuses.forEach(s=>{if(!TRACKER_STATUSES.includes(s))fail_('Invalid leg status "'+s+'" in parlay '+parlay[0]+'. Use PENDING, WIN, LOSS, PUSH, or VOID.');});
  if(statuses.includes('PENDING'))return {status:'PENDING',settled:'',profit:''};
  const stake=Number(parlay[6]);if(!Number.isFinite(stake)||stake<=0)fail_('Invalid stake for parlay '+parlay[0]+'.');
  if(statuses.includes('LOSS'))return {status:'LOSS',settled:parlay[9]||time,profit:money_(-stake)};
  const wins=legs.filter((l,i)=>statuses[i]==='WIN');
  if(!wins.length)return {status:'VOID',settled:parlay[9]||time,profit:0};
  const decimal=wins.reduce((p,l)=>p*americanToDecimal_(l[9]),1);
  return {status:'WIN',settled:parlay[9]||time,profit:money_(stake*(decimal-1))};
}

function gradeParlays() {return run_('Grade parlays',()=>{
  ensureTrackerSheet_(TAB_PARLAYS,PARLAY_HEADERS);ensureTrackerSheet_(TAB_LEGS,LEG_HEADERS);
  const parlays=read_(TAB_PARLAYS,PARLAY_HEADERS.length),legs=read_(TAB_LEGS,LEG_HEADERS.length),byParlay={};
  legs.forEach(l=>(byParlay[String(l[1])]||(byParlay[String(l[1])]=[])).push(l));
  const time=now_();let settled=0,pending=0;
  parlays.forEach(p=>{const result=gradeOneParlay_(p,byParlay[String(p[0])]||[],time);p[8]=result.status;p[9]=result.settled;p[10]=result.profit;result.status==='PENDING'?pending++:settled++;});
  if(parlays.length)sheet_(TAB_PARLAYS).getRange(2,1,parlays.length,PARLAY_HEADERS.length).setValues(parlays.map(r=>r.map(cell_)));
  log_('Grade parlays','','SUCCESS',settled+' settled; '+pending+' pending; manual leg results only; zero API credits',0);
  SpreadsheetApp.getUi().alert('Grading complete: '+settled+' settled, '+pending+' pending. No results were fetched or guessed.');
  return {settled,pending};
});}

// -----------------------------------------------------------------------------
// Zero-Odds-API-credit nflverse grading. GitHub release assets are discovered
// at runtime; parsed season/week rows are cached audibly in a hidden sheet.

function headerMap_(headers,required,label) {
  const map={};headers.forEach((h,i)=>map[String(h).trim()]=i);
  const missing=(required||[]).filter(h=>map[h]===undefined);
  if(missing.length)fail_((label||'Data')+' is missing required columns: '+missing.join(', ')+'.');
  return map;
}
function githubJson_(url,label) {return json_(request_(url,label||'GitHub',false,'',false),label||'GitHub');}
function githubPaged_(base,maxPages) {
  const out=[];
  for(let page=1;page<=maxPages;page++) {
    const join=base.indexOf('?')>=0?'&':'?',batch=githubJson_(base+join+'per_page=100&page='+page,'GitHub releases');
    if(!Array.isArray(batch))fail_('GitHub Releases API returned an invalid page.');
    out.push.apply(out,batch);if(batch.length<100)return out;
  }
  fail_('GitHub Releases API pagination exceeded the safe page limit.');
}
function releaseRelevant_(release,dataset) {
  const text=(String(release.tag_name||'')+' '+String(release.name||'')).toLowerCase();
  if(dataset==='PLAYER_STATS')return text.indexOf('player')>=0&&text.indexOf('stat')>=0;
  if(dataset==='INJURIES')return text.indexOf('injur')>=0;
  return text.indexOf('schedule')>=0||text.indexOf('game')>=0;
}
function releaseAssets_(release) {
  if(!release||!Number.isFinite(Number(release.id)))fail_('A relevant nflverse release had no valid release ID.');
  return githubPaged_(GITHUB_RELEASES_API+'/'+Number(release.id)+'/assets',30);
}
function safeNflverseAssetUrl_(url) {return /^https:\/\/github\.com\/nflverse\/nflverse-data\/releases\/download\//.test(String(url));}
function assetMatches_(asset,dataset,season) {
  const name=String(asset.name||'').toLowerCase();
  if(!/\.csv$/.test(name))return false;
  if(dataset==='PLAYER_STATS')return name.indexOf('player')>=0&&name.indexOf('stat')>=0&&name.indexOf('week')>=0&&new RegExp('(^|[^0-9])'+season+'([^0-9]|$)').test(name);
  if(dataset==='INJURIES')return name.indexOf('injur')>=0&&new RegExp('(^|[^0-9])'+season+'([^0-9]|$)').test(name);
  return name.indexOf('schedule')>=0||name.indexOf('game')>=0;
}
function discoverNflverseAsset_(dataset,season,week) {
  const releases=githubPaged_(GITHUB_RELEASES_API,10).filter(r=>releaseRelevant_(r,dataset));
  releases.sort((a,b)=>Date.parse(b.updated_at||b.published_at||0)-Date.parse(a.updated_at||a.published_at||0));
  for(const release of releases) {
    const candidates=releaseAssets_(release).filter(a=>assetMatches_(a,dataset,season)&&safeNflverseAssetUrl_(a.browser_download_url));
    candidates.sort((a,b)=>Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0)||String(a.name).length-String(b.name).length);
    if(candidates.length) {
      const best=candidates[0];
      log_('nflverse asset','', 'RESOLVED',dataset+' '+season+' week '+week+': '+best.browser_download_url,0);
      return {id:String(best.id||''),name:String(best.name),url:String(best.browser_download_url),updated:String(best.updated_at||release.updated_at||'')};
    }
  }
  fail_('No current nflverse '+(dataset==='PLAYER_STATS'?'weekly player-stats':dataset==='INJURIES'?'injuries':'schedule')+' CSV release asset was found for season '+season+'. No tracker rows were changed.');
}
function ensureNflverseCache_() {
  const s=ensureTrackerSheet_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS);try{s.hideSheet();}catch(ignore){}return s;
}
function readNflverseCache_(dataset,season,week) {
  const s=ensureNflverseCache_(),all=read_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS.length),matches=all.filter(r=>r[1]===dataset&&Number(r[2])===season&&Number(r[3])===week);
  if(!matches.length)return null;
  const newest=Math.max.apply(null,matches.map(r=>Date.parse(r[8])||0));
  if(Date.now()-newest>NFLVERSE_CACHE_HOURS*3600000)return null;
  const rows=matches.filter(r=>(Date.parse(r[8])||0)===newest);let headers,data;
  try{headers=JSON.parse(rows[0][9]);data=rows.map(r=>JSON.parse(r[10]));}catch(ignore){return null;}
  if(!Array.isArray(headers)||!headers.length||!data.length)return null;
  log_('nflverse cache','','HIT',dataset+' '+season+' week '+week+'; fetched '+rows[0][8]+'; asset '+rows[0][6],0);
  return {headers,rows:data,asset:{id:String(rows[0][4]),name:String(rows[0][5]),url:String(rows[0][6]),updated:String(rows[0][7])},fetched:String(rows[0][8]),cacheHit:true};
}
function writeNflverseCache_(dataset,season,week,asset,headers,rows,fetched) {
  ensureNflverseCache_();const old=read_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS.length).filter(r=>!(r[1]===dataset&&Number(r[2])===season&&Number(r[3])===week));
  const key=[dataset,season,week,asset.id,asset.updated].join('|'),added=rows.map(r=>[key,dataset,season,week,asset.id,asset.name,asset.url,asset.updated,fetched,JSON.stringify(headers),JSON.stringify(r)]),combined=old.concat(added),groups={};
  combined.forEach(r=>{groups[r[0]]=Math.max(groups[r[0]]||0,Date.parse(r[8])||0);});
  const keep=Object.keys(groups).sort((a,b)=>groups[b]-groups[a]).slice(0,NFLVERSE_CACHE_GROUPS),bounded=combined.filter(r=>keep.indexOf(r[0])>=0);
  write_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS,bounded);try{sheet_(TAB_NFLVERSE_CACHE).hideSheet();}catch(ignore){}
}
function filterCsvWeek_(table,dataset,season,week) {
  if(!Array.isArray(table)||table.length<2)fail_('The resolved nflverse CSV was empty.');
  const headers=table[0].map(String),map=headerMap_(headers,['season','week'],dataset);
  let rows=table.slice(1).filter(r=>Number(r[map.season])===season&&Number(r[map.week])===week);
  if(dataset==='SCHEDULE'&&map.game_type!==undefined){const regular=rows.filter(r=>String(r[map.game_type]).toUpperCase()==='REG');rows=regular.length?regular:rows.filter(r=>String(r[map.game_type]).toUpperCase()!=='PRE');}
  if(dataset==='PLAYER_STATS'&&map.season_type!==undefined){const wanted=week<=18?'REG':'POST',typed=rows.filter(r=>String(r[map.season_type]).toUpperCase()===wanted);if(typed.length)rows=typed;}
  if(!rows.length)fail_('The resolved nflverse '+dataset+' CSV has no rows for season '+season+', week '+week+'.');
  return {headers,rows};
}
function loadNflverseWeekDataset_(dataset,season,week) {
  const cached=readNflverseCache_(dataset,season,week);if(cached)return cached;
  const asset=discoverNflverseAsset_(dataset,season,week),response=request_(asset.url,'nflverse '+dataset+' CSV',false,'',false);let table;
  try{table=Utilities.parseCsv(response.text);}catch(ignore){fail_('The resolved nflverse '+dataset+' CSV could not be parsed.');}
  const filtered=filterCsvWeek_(table,dataset,season,week),fetched=now_();writeNflverseCache_(dataset,season,week,asset,filtered.headers,filtered.rows,fetched);
  log_('nflverse cache','','MISS',dataset+' '+season+' week '+week+' fetched and cached',0);
  return {headers:filtered.headers,rows:filtered.rows,asset,fetched,cacheHit:false};
}

// The injuries CSV is one continuously-updated file per season (not one file
// per week like PLAYER_STATS/SCHEDULE), so it is cached by season alone and
// its current week is discovered from the data itself, not passed in.
function readInjuriesCache_(season) {
  const all=read_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS.length),matches=all.filter(r=>r[1]==='INJURIES'&&Number(r[2])===season);
  if(!matches.length)return null;
  const newest=Math.max.apply(null,matches.map(r=>Date.parse(r[8])||0));
  if(Date.now()-newest>INJURIES_CACHE_HOURS*3600000)return null;
  const rows=matches.filter(r=>(Date.parse(r[8])||0)===newest);let headers,data;
  try{headers=JSON.parse(rows[0][9]);data=rows.map(r=>JSON.parse(r[10]));}catch(ignore){return null;}
  if(!Array.isArray(headers)||!headers.length||!data.length)return null;
  log_('nflverse cache','','HIT','INJURIES '+season+' week '+rows[0][3]+'; fetched '+rows[0][8]+'; asset '+rows[0][6],0);
  return {headers,rows:data,week:Number(rows[0][3]),asset:{id:String(rows[0][4]),name:String(rows[0][5]),url:String(rows[0][6]),updated:String(rows[0][7])},fetched:String(rows[0][8]),cacheHit:true};
}
function writeInjuriesCache_(season,week,asset,headers,rows,fetched) {
  ensureNflverseCache_();const old=read_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS.length).filter(r=>!(r[1]==='INJURIES'&&Number(r[2])===season));
  const key=['INJURIES',season,week,asset.id,asset.updated].join('|'),added=rows.map(r=>[key,'INJURIES',season,week,asset.id,asset.name,asset.url,asset.updated,fetched,JSON.stringify(headers),JSON.stringify(r)]),combined=old.concat(added),groups={};
  combined.forEach(r=>{groups[r[0]]=Math.max(groups[r[0]]||0,Date.parse(r[8])||0);});
  const keep=Object.keys(groups).sort((a,b)=>groups[b]-groups[a]).slice(0,NFLVERSE_CACHE_GROUPS),bounded=combined.filter(r=>keep.indexOf(r[0])>=0);
  write_(TAB_NFLVERSE_CACHE,NFLVERSE_CACHE_HEADERS,bounded);try{sheet_(TAB_NFLVERSE_CACHE).hideSheet();}catch(ignore){}
}
function filterInjuriesLatestWeek_(table,season) {
  if(!Array.isArray(table)||table.length<2)fail_('The resolved nflverse injuries CSV was empty.');
  const headers=table[0].map(String),map=headerMap_(headers,['season','week','team','gsis_id','full_name','position','practice_status','report_status'],'Injuries');
  let rows=table.slice(1).filter(r=>Number(r[map.season])===season);
  if(!rows.length)fail_('The resolved nflverse injuries CSV has no rows for season '+season+'.');
  if(map.game_type!==undefined){const regular=rows.filter(r=>String(r[map.game_type]).toUpperCase()==='REG');if(regular.length)rows=regular;}
  const week=Math.max.apply(null,rows.map(r=>Number(r[map.week])).filter(Number.isFinite));
  if(!Number.isFinite(week))fail_('The resolved nflverse injuries CSV has no numeric week values for season '+season+'.');
  rows=rows.filter(r=>Number(r[map.week])===week);
  return {headers,rows,map,week};
}
function loadNflverseInjuries_(season) {
  const cached=readInjuriesCache_(season);if(cached)return cached;
  const asset=discoverNflverseAsset_('INJURIES',season,'latest'),response=request_(asset.url,'nflverse INJURIES CSV',false,'',false);let table;
  try{table=Utilities.parseCsv(response.text);}catch(ignore){fail_('The resolved nflverse injuries CSV could not be parsed.');}
  const filtered=filterInjuriesLatestWeek_(table,season),fetched=now_();writeInjuriesCache_(season,filtered.week,asset,filtered.headers,filtered.rows,fetched);
  log_('nflverse cache','','MISS','INJURIES '+season+' week '+filtered.week+' fetched and cached',0);
  return {headers:filtered.headers,rows:filtered.rows,map:filtered.map,week:filtered.week,asset,fetched,cacheHit:false};
}
function teamFullNameForAbbr_(abbr) {
  const norm=teamAbbr_(abbr);if(!norm)return '';
  return Object.keys(TEAM_CODES).find(full=>TEAM_CODES[full].toUpperCase()===norm)||'';
}
function matchRosterForInjuryRow_(injuryRow,im,rosterRows) {
  const gsisId=String(injuryRow[im.gsis_id]||'').trim(),team=teamFullNameForAbbr_(injuryRow[im.team]),name=String(injuryRow[im.full_name]||'').trim();
  if(gsisId){const byId=rosterRows.filter(r=>String(r[5])===gsisId);if(byId.length===1)return {row:byId[0],method:'ID'};}
  if(!team)return {reason:'INJURY_ROW_UNKNOWN_TEAM',candidates:injuryRow[im.team]+' | '+name};
  const teamRows=rosterRows.filter(r=>r[2]===team);
  const exact=teamRows.filter(r=>r[0]===normName_(name));
  if(exact.length===1)return {row:exact[0],method:'NAME_EXACT'};
  if(exact.length>1)return {reason:'AMBIGUOUS_EXACT_NAME',candidates:exact.map(r=>r[1]+' | '+r[5]).join('; ')};
  const scored=teamRows.map(r=>({row:r,score:nameSimilarity_(name,r[1])})).sort((a,b)=>b.score-a.score);
  const best=scored[0],second=scored[1];
  if(best&&best.score>=0.90&&(!second||best.score-second.score>=0.08))return {row:best.row,method:'FUZZY '+Math.round(best.score*100)+'%'};
  return {reason:'UNMATCHED_NAME',candidates:scored.slice(0,4).map(x=>x.row[1]+' | '+x.row[5]+' | '+Math.round(x.score*100)+'%').join('; ')};
}
function numericCell_(value) {return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value));}
function validateCompletedWeek_(schedule,stats,season,week) {
  const sm=headerMap_(schedule.headers,['game_id','season','week','away_team','home_team','away_score','home_score','result','total'],'Schedule');
  const pm=headerMap_(stats.headers,['game_id','season','week','player_id','player_display_name','team'],'Player stats');
  const statusName=['status','game_status','game_state','state'].find(h=>sm[h]!==undefined),statGames=new Set(stats.rows.map(r=>String(r[pm.game_id]))),problems=[];
  schedule.rows.forEach(r=>{
    const id=String(r[sm.game_id]);
    if(statusName) {
      const status=String(r[sm[statusName]]||'').trim().toUpperCase();
      if(!/^(FINAL|FINAL\/OT|COMPLETED|COMPLETE|CLOSED)$/.test(status))problems.push(id+' status '+(status||'MISSING'));
    } else {
      if(!['away_score','home_score','result','total'].every(h=>numericCell_(r[sm[h]])))problems.push(id+' missing final score/result evidence');
      else if(Number(r[sm.result])!==Number(r[sm.home_score])-Number(r[sm.away_score])||Number(r[sm.total])!==Number(r[sm.home_score])+Number(r[sm.away_score]))problems.push(id+' inconsistent final score/result evidence');
    }
    if(!statGames.has(id))problems.push(id+' missing player-stat coverage');
  });
  if(problems.length)fail_('Season '+season+' week '+week+' is not safely final as a complete week: '+problems.slice(0,6).join('; ')+(problems.length>6?'; and '+(problems.length-6)+' more':'')+'. No legs were graded.');
  return {scheduleMap:sm,statsMap:pm,statusColumn:statusName||''};
}
function normPlayerName_(value) {
  let s=String(value||'');try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(ignore){}
  return s.toLowerCase().replace(/[’'`.]/g,'').replace(/-/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim().replace(/\s+(jr|sr|ii|iii|iv|v)$/,'').trim();
}
function teamAbbr_(value) {
  const s=String(value||'').trim(),full=Object.keys(TEAM_CODES).find(t=>t.toLowerCase()===s.toLowerCase());if(full)return TEAM_CODES[full].toUpperCase();
  const upper=s.toUpperCase(),aliases={LAR:'LA',STL:'LA',SD:'LAC',OAK:'LV',JAC:'JAX',WSH:'WAS'};return aliases[upper]||(/^[A-Z]{2,3}$/.test(upper)?upper:'');
}
function matchScheduleGame_(game,schedule,sm) {
  const text=String(game||'').trim(),at=text.split(/\s+@\s+|\s+at\s+/i),vs=text.split(/\s+vs\.?\s+/i);let candidates=[];
  if(at.length===2){const away=teamAbbr_(at[0]),home=teamAbbr_(at[1]);candidates=schedule.filter(r=>teamAbbr_(r[sm.away_team])===away&&teamAbbr_(r[sm.home_team])===home);}
  else if(vs.length===2){const a=teamAbbr_(vs[0]),b=teamAbbr_(vs[1]);candidates=schedule.filter(r=>{const away=teamAbbr_(r[sm.away_team]),home=teamAbbr_(r[sm.home_team]);return (away===a&&home===b)||(away===b&&home===a);});}
  return candidates.length===1?candidates[0]:null;
}
function levenshtein_(a,b) {
  const prev=Array(b.length+1).fill(0).map((_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}return prev[b.length];
}
function nameSimilarity_(a,b) {a=normPlayerName_(a);b=normPlayerName_(b);return !a&&!b?1:1-levenshtein_(a,b)/Math.max(a.length,b.length,1);}
function manualMappings_(exceptionRows) {
  const map={};exceptionRows.forEach(r=>{const id=String(r[7]||'').trim();if(!id)return;const key=normPlayerName_(r[2])+'|'+teamAbbr_(r[3]);if(!map[key])map[key]=[];if(map[key].indexOf(id)<0)map[key].push(id);});return map;
}
function exceptionTeamForLeg_(exceptionRows,legId) {const teams=[...new Set(exceptionRows.filter(r=>String(r[11])===String(legId)).map(r=>teamAbbr_(r[3])).filter(Boolean))];return teams.length===1?teams[0]:'';}
function candidateLabel_(row,pm,score) {return [row[pm.player_display_name]||row[pm.player_name],row[pm.player_id],row[pm.team],score===undefined?'':Math.round(score*100)+'%'].filter(x=>x!=='').join(' | ');}
function resolvePlayer_(sourceName,sourceTeam,gameRow,stats,pm,manual) {
  const gameId=String(gameRow.gameId),team=teamAbbr_(sourceTeam),gameRows=stats.filter(r=>String(r[pm.game_id])===gameId),manualIds=manual[normPlayerName_(sourceName)+'|'+team]||[];
  if(manualIds.length>1)return {reason:'CONFLICTING_MANUAL_IDS',candidates:manualIds.join('; ')};
  if(manualIds.length===1){const found=gameRows.filter(r=>String(r[pm.player_id])===manualIds[0]&&(!team||teamAbbr_(r[pm.team])===team));return found.length===1?{row:found[0],method:'MANUAL'}:{reason:'MANUAL_ID_NOT_FOUND_FOR_GAME',candidates:manualIds[0]};}
  const exact=gameRows.filter(r=>[r[pm.player_display_name],r[pm.player_name]].some(n=>normPlayerName_(n)===normPlayerName_(sourceName))&&(!team||teamAbbr_(r[pm.team])===team));
  const uniqueExact=[...new Map(exact.map(r=>[String(r[pm.player_id]),r])).values()];if(uniqueExact.length===1)return {row:uniqueExact[0],method:'EXACT'};if(uniqueExact.length>1)return {reason:'AMBIGUOUS_EXACT_NAME',candidates:uniqueExact.map(r=>candidateLabel_(r,pm)).join('; ')};
  if(!team)return {reason:'TEAM_UNKNOWN_FOR_FUZZY_MATCH',candidates:''};
  const candidates=[...new Map(gameRows.filter(r=>teamAbbr_(r[pm.team])===team).map(r=>[String(r[pm.player_id]),r])).values()].map(r=>({row:r,score:Math.max(nameSimilarity_(sourceName,r[pm.player_display_name]),nameSimilarity_(sourceName,r[pm.player_name]))})).sort((a,b)=>b.score-a.score);
  const best=candidates[0],second=candidates[1];if(best&&best.score>=0.90&&(!second||best.score-second.score>=0.08))return {row:best.row,method:'FUZZY '+Math.round(best.score*100)+'%'};
  return {reason:best&&best.score>=0.90?'AMBIGUOUS_FUZZY_MATCH':'UNMATCHED_NAME',candidates:candidates.slice(0,4).map(x=>candidateLabel_(x.row,pm,x.score)).join('; ')};
}
function sourceTeamForLeg_(leg,lm,props,roster,gameRow,sm,stats,pm) {
  const name=normPlayerName_(leg[lm['Player / Team']]),event=String(leg[lm['Event ID']]),gameTeams=[teamAbbr_(gameRow[sm.away_team]),teamAbbr_(gameRow[sm.home_team])],teams=[];
  props.forEach(r=>{if(normPlayerName_(r.name)===name&&(!event||!r.event||r.event===event)&&r.team)teams.push(teamAbbr_(r.team));});
  roster.forEach(r=>{if(normPlayerName_(r.name)===name&&r.team)teams.push(teamAbbr_(r.team));});
  let unique=[...new Set(teams.filter(t=>gameTeams.indexOf(t)>=0))];if(unique.length===1)return unique[0];
  const exactTeams=stats.filter(r=>String(r[pm.game_id])===String(gameRow[sm.game_id])&&[r[pm.player_display_name],r[pm.player_name]].some(n=>normPlayerName_(n)===name)).map(r=>teamAbbr_(r[pm.team]));unique=[...new Set(exactTeams)];return unique.length===1?unique[0]:'';
}
function marketSettlement_(market,row,pm,selection,line,playerName) {
  const key=String(market||'').toLowerCase(),mapping={player_receiving_yards:'receiving_yards',player_reception_yds:'receiving_yards',player_rushing_yards:'rushing_yards',player_rush_yds:'rushing_yards',player_passing_yards:'passing_yards',player_pass_yds:'passing_yards',player_receptions:'receptions',player_pass_tds:'passing_tds',player_pass_completions:'completions',player_rush_attempts:'carries'};
  if(key==='player_anytime_td') {
    const needed=['rushing_tds','receiving_tds','special_teams_tds','def_tds','fumble_recovery_tds'],missing=needed.filter(h=>pm[h]===undefined);if(missing.length)return {error:'ATD_COVERAGE_INCOMPLETE: missing '+missing.join(', ')};
    const side=String(selection||'').toLowerCase(),validYes=side==='yes'||normPlayerName_(selection)===normPlayerName_(playerName);if(side==='no')return {error:'UNSUPPORTED_ATD_NO_SIDE'};if(!validYes)return {error:'UNSUPPORTED_ATD_SIDE: '+selection};
    const values=needed.map(h=>Number(row[pm[h]]||0));if(values.some(v=>!Number.isFinite(v)))return {error:'ATD_STAT_NOT_NUMERIC'};
    const stat=values.reduce((a,b)=>a+b,0);return {stat,result:stat>0?'WIN':'LOSS',detail:'Non-passing TDs: rush '+values[0]+', receiving '+values[1]+', special teams '+values[2]+', defense '+values[3]+', fumble recovery '+values[4]+'; passing TDs excluded.'};
  }
  if(key==='player_rush_reception_yds') {
    if(pm.rushing_yards===undefined||pm.receiving_yards===undefined)return {error:'MISSING_SETTLEMENT_COLUMN: rushing_yards or receiving_yards'};
    const stat=Number(row[pm.rushing_yards])+Number(row[pm.receiving_yards]),target=Number(line),side=String(selection||'').toLowerCase();if(!Number.isFinite(stat)||!Number.isFinite(target))return {error:'NON_NUMERIC_STAT_OR_LINE'};
    if(side.indexOf('over')<0&&side.indexOf('under')<0)return {error:'UNSUPPORTED_SIDE: '+selection};const result=stat===target?'PUSH':side.indexOf('over')>=0?(stat>target?'WIN':'LOSS'):(stat<target?'WIN':'LOSS');return {stat,result,detail:'rushing_yards + receiving_yards='+stat+' versus '+selection+' '+target};
  }
  const column=mapping[key];if(!column)return {error:'UNSUPPORTED_MARKET: '+key};if(pm[column]===undefined)return {error:'MISSING_SETTLEMENT_COLUMN: '+column};
  const stat=Number(row[pm[column]]),target=Number(line),side=String(selection||'').toLowerCase();if(!Number.isFinite(stat)||!Number.isFinite(target))return {error:'NON_NUMERIC_STAT_OR_LINE'};
  if(side.indexOf('over')<0&&side.indexOf('under')<0)return {error:'UNSUPPORTED_SIDE: '+selection};
  const result=stat===target?'PUSH':side.indexOf('over')>=0?(stat>target?'WIN':'LOSS'):(stat<target?'WIN':'LOSS');return {stat,result,detail:column+'='+stat+' versus '+selection+' '+target};
}
function upsertExceptions_(items,time) {
  const s=ensureTrackerSheet_(TAB_EXCEPTIONS,EXCEPTION_HEADERS),rows=read_(TAB_EXCEPTIONS,EXCEPTION_HEADERS.length),byKey={};rows.forEach((r,i)=>byKey[[r[0],r[1],r[11]].join('|')]=i);
  items.forEach(x=>{const key=[x.season,x.week,x.legId].join('|'),i=byKey[key];if(i===undefined){byKey[key]=rows.length;rows.push([x.season,x.week,x.name,x.team,x.game,x.candidates,x.reason,'','OPEN',time,time,x.legId]);}else{const r=rows[i];r[0]=x.season;r[1]=x.week;r[2]=x.name;r[3]=x.team;r[4]=x.game;r[5]=x.candidates;r[6]=x.reason;r[10]=time;r[11]=x.legId;}});
  if(rows.length)s.getRange(2,1,rows.length,EXCEPTION_HEADERS.length).setValues(rows.map(r=>r.map(cell_)));return rows;
}
function rollupAutoParlays_(parlays,legs,time,parlayHeaders,legHeaders,onlyParlayIds) {
  const pm=headerMap_(parlayHeaders||PARLAY_HEADERS,['Parlay ID','Leg Count','Stake','Status','Settled UTC','Actual Profit/Loss','Adjusted Combined American Odds','Adjusted Potential Payout','Settlement Detail'],'PARLAYS'),lm=headerMap_(legHeaders||LEG_HEADERS,['Parlay ID','American Price','Status'],'LEGS'),by={};legs.forEach(l=>(by[String(l[lm['Parlay ID']])]||(by[String(l[lm['Parlay ID']])]=[])).push(l));let settled=0;
  parlays.forEach(p=>{const parlayId=String(p[pm['Parlay ID']]);if(onlyParlayIds&&onlyParlayIds.indexOf(parlayId)<0)return;if((String(p[pm.Status]||'PENDING').toUpperCase())!=='PENDING')return;const linked=by[parlayId]||[],expected=Number(p[pm['Leg Count']]);if(linked.length!==expected)return;const statuses=linked.map(l=>String(l[lm.Status]||'PENDING').toUpperCase()),stake=Number(p[pm.Stake]);
    if(statuses.indexOf('LOSS')>=0){p[pm.Status]='LOSS';p[pm['Settled UTC']]=time;p[pm['Actual Profit/Loss']]=money_(-stake);p[pm['Adjusted Combined American Odds']]='';p[pm['Adjusted Potential Payout']]=0;p[pm['Settlement Detail']]='At least one leg lost.';settled++;return;}
    if(statuses.some(s=>!['WIN','PUSH','VOID'].includes(s)))return;const wins=linked.filter((l,i)=>statuses[i]==='WIN');
    if(!wins.length){p[pm.Status]='VOID';p[pm['Settled UTC']]=time;p[pm['Actual Profit/Loss']]=0;p[pm['Adjusted Combined American Odds']]='';p[pm['Adjusted Potential Payout']]=money_(stake);p[pm['Settlement Detail']]='All legs pushed or were void; stake returned.';settled++;return;}
    const decimal=wins.reduce((v,l)=>v*americanToDecimal_(l[lm['American Price']]),1),adjusted=decimalToAmerican_(decimal);p[pm.Status]='WIN';p[pm['Settled UTC']]=time;p[pm['Actual Profit/Loss']]=money_(stake*(decimal-1));p[pm['Adjusted Combined American Odds']]=adjusted;p[pm['Adjusted Potential Payout']]=money_(stake*decimal);p[pm['Settlement Detail']]=(wins.length===linked.length?'All legs won.':'Push/void legs removed; adjusted from '+wins.length+' winning legs.');settled++;
  });return settled;
}
function grade_week(season,week) {
  season=Number(season);week=Number(week);if(!Number.isInteger(season)||season<1999||season>2100||!Number.isInteger(week)||week<1||week>22)fail_('grade_week requires a valid four-digit season and week 1 through 22.');
  return run_('Auto-grade week',()=>{
    const legSetup=compatibleHeaders_(TAB_LEGS,LEG_HEADERS),parlaySetup=compatibleHeaders_(TAB_PARLAYS,PARLAY_HEADERS),legHeaders=legSetup.headers,parlayHeaders=parlaySetup.headers;ensureTrackerSheet_(TAB_EXCEPTIONS,EXCEPTION_HEADERS);
    const schedule=loadNflverseWeekDataset_('SCHEDULE',season,week),stats=loadNflverseWeekDataset_('PLAYER_STATS',season,week),validation=validateCompletedWeek_(schedule,stats,season,week),sm=validation.scheduleMap,pm=validation.statsMap;
    const legSheet=legSetup.sheet,legs=read_(TAB_LEGS,legHeaders.length),lm=headerMap_(legHeaders,['Leg ID','Parlay ID','Event ID','Event / Game','Player / Team','Market','Side / Selection','Line','Status','Actual Stat / Score','nflverse Player ID','nflverse Source URL','nflverse Asset Updated UTC','Graded UTC','Grading Detail'],'LEGS');
    const propsHeader=propsHeaders_(),propsMap=headerMap_(propsHeader,['Player','Team','Event ID'],'PROPS'),props=read_(TAB_PROPS,propsHeader.length).map(r=>({name:r[propsMap.Player],team:r[propsMap.Team],event:r[propsMap['Event ID']]})),roster=read_(TAB_ROSTER,ROSTER_HEADERS.length).map(r=>({name:r[1],team:r[2]})),exceptionRows=read_(TAB_EXCEPTIONS,EXCEPTION_HEADERS.length),manual=manualMappings_(exceptionRows),exceptions=[],relevantParlays=[];let graded=0,skipped=0;
    legs.forEach(leg=>{const scheduleRow=matchScheduleGame_(leg[lm['Event / Game']],schedule.rows,sm);if(!scheduleRow)return;const parlayId=String(leg[lm['Parlay ID']]);if(relevantParlays.indexOf(parlayId)<0)relevantParlays.push(parlayId);if(String(leg[lm.Status]||'PENDING').toUpperCase()!=='PENDING'){skipped++;return;}
      const game={gameId:String(scheduleRow[sm.game_id])};let team=sourceTeamForLeg_(leg,lm,props,roster,scheduleRow,sm,stats.rows,pm);if(!team)team=exceptionTeamForLeg_(exceptionRows,leg[lm['Leg ID']]);const resolved=resolvePlayer_(leg[lm['Player / Team']],team,game,stats.rows,pm,manual);
      if(!resolved.row){exceptions.push({season,week,name:String(leg[lm['Player / Team']]),team,game:String(leg[lm['Event / Game']]),candidates:resolved.candidates||'',reason:resolved.reason,legId:String(leg[lm['Leg ID']])});return;}
      const settlement=marketSettlement_(leg[lm.Market],resolved.row,pm,leg[lm['Side / Selection']],leg[lm.Line],leg[lm['Player / Team']]);
      if(settlement.error){exceptions.push({season,week,name:String(leg[lm['Player / Team']]),team:team||resolved.row[pm.team],game:String(leg[lm['Event / Game']]),candidates:candidateLabel_(resolved.row,pm),reason:settlement.error,legId:String(leg[lm['Leg ID']])});return;}
      leg[lm.Status]=settlement.result;leg[lm['Actual Stat / Score']]=settlement.stat;leg[lm['nflverse Player ID']]=resolved.row[pm.player_id];leg[lm['nflverse Source URL']]=stats.asset.url;leg[lm['nflverse Asset Updated UTC']]=stats.asset.updated;leg[lm['Graded UTC']]=now_();leg[lm['Grading Detail']]='game '+game.gameId+'; '+resolved.method+'; '+settlement.detail;graded++;
    });
    const time=now_(),parlays=read_(TAB_PARLAYS,parlayHeaders.length),settled=rollupAutoParlays_(parlays,legs,time,parlayHeaders,legHeaders,relevantParlays);upsertExceptions_(exceptions,time);if(legs.length)legSheet.getRange(2,1,legs.length,legHeaders.length).setValues(legs.map(r=>r.map(cell_)));
    if(parlays.length)parlaySetup.sheet.getRange(2,1,parlays.length,parlayHeaders.length).setValues(parlays.map(r=>r.map(cell_)));
    log_('Auto-grade week','','SUCCESS',season+' week '+week+': '+graded+' legs graded, '+exceptions.length+' exceptions, '+settled+' parlays settled; schedule '+schedule.asset.url+'; stats '+stats.asset.url+'; zero Odds API credits',0);
    SpreadsheetApp.getUi().alert('Week '+week+' grading complete: '+graded+' legs graded, '+exceptions.length+' exceptions, '+settled+' parlays settled. No Odds API calls or credits were used.');return {graded,exceptions:exceptions.length,settled,skipped};
  });
}
function gradeWeekPrompt() {
  const ui=SpreadsheetApp.getUi(),s=ui.prompt('Auto-grade completed week','Season (for example 2026):',ui.ButtonSet.OK_CANCEL);if(s.getSelectedButton()!==ui.Button.OK)return;
  const w=ui.prompt('Auto-grade completed week','Week number:',ui.ButtonSet.OK_CANCEL);if(w.getSelectedButton()!==ui.Button.OK)return;return grade_week(Number(s.getResponseText()),Number(w.getResponseText()));
}

// -----------------------------------------------------------------------------
// Availability gate. Blocking is the default; a leg only reaches CLEARED by
// passing every check below. Zero Odds API credits: reads only ROSTER/INDEX,
// already populated for free by pullInjuries()/refreshIndex().

function mostRecentPracticeDayStr_(kickoffIso) {
  const kickoff=new Date(kickoffIso);
  for(let back=1;back<=10;back++) {
    const d=new Date(kickoff.getTime()-back*86400000),dow=Utilities.formatDate(d,'America/New_York','u');
    if(['3','4','5'].indexOf(dow)>=0)return Utilities.formatDate(d,'America/New_York','yyyy-MM-dd');
  }
  fail_('Could not compute the most recent practice day before kickoff.');
}
function resolveLegGameAndPlayer_(leg,lm,indexRows,roster) {
  const eventId=String(leg[lm['Event ID']]||'').trim();
  const indexRow=indexRows.find(r=>String(r[IDX.EVENT])===eventId);
  if(!indexRow)return {error:'Event ID not found on INDEX; kickoff unknown.'};
  const kickoffIso=indexRow[IDX.KICKOFF];
  if(!kickoffIso||!Number.isFinite(Date.parse(kickoffIso)))return {error:'Kickoff time on INDEX is missing or invalid.'};
  const g={home:indexRow[IDX.HOME],away:indexRow[IDX.AWAY]},meta=matchPlayer_(leg[lm['Player / Team']],g,roster);
  if(meta.status!=='MATCHED')return {error:'Player did not match ROSTER ('+meta.status+').'};
  return {eventId,kickoffIso,row:meta.row};
}
function evaluateLegAvailability_(leg,lm,indexRows,roster) {
  const resolved=resolveLegGameAndPlayer_(leg,lm,indexRows,roster);
  if(resolved.error)return {gate:'BLOCKED',detail:resolved.error};
  const kickoffIso=resolved.kickoffIso,row=resolved.row;
  const gameStatus=String(row[12]||'').toUpperCase(),statusSource=String(row[14]||''),reportDate=String(row[13]||'');
  if(!statusSource)return {gate:'BLOCKED',detail:'Player did not match the injury data at all; the availability check has never run for them.'};
  // A manual confirmation is scoped to this leg's own event: the owner
  // personally checked the inactives list announced for THIS game, not a
  // standing fact about the player across every game they appear in.
  const confirmedAt=String(leg[lm['Manual Confirmed UTC']]||'');
  if(confirmedAt) {
    const confirmedGameStatus=String(leg[lm['Manual Confirmed Game Status']]||'');
    if(confirmedGameStatus!==gameStatus)return {gate:'BLOCKED',detail:STATUS_SOURCE_MANUAL+' at '+confirmedAt+' when game status was '+(confirmedGameStatus||'(not listed)')+', but a later pull now shows '+(gameStatus||'(not listed)')+'. Re-check the inactives list and re-confirm.'};
    return {gate:'CLEARED',detail:STATUS_SOURCE_MANUAL+' for this event at '+confirmedAt+'; game status unchanged ('+(gameStatus||'(not listed)')+') since confirmation.'};
  }
  if(INJURY_BLOCKING_STATUSES.indexOf(gameStatus)>=0)return {gate:'BLOCKED',detail:'Game status is '+gameStatus+'.'};
  if(!reportDate||!Number.isFinite(Date.parse(reportDate)))return {gate:'BLOCKED',detail:'Injury report date is missing.'};
  const cutoff=mostRecentPracticeDayStr_(kickoffIso),reportDateStr=Utilities.formatDate(new Date(reportDate),'America/New_York','yyyy-MM-dd');
  if(reportDateStr<cutoff)return {gate:'BLOCKED',detail:'Injury report ('+reportDateStr+') is older than the most recent practice day before kickoff ('+cutoff+').'};
  const minutesToKickoff=(Date.parse(kickoffIso)-Date.now())/60000;
  if(minutesToKickoff<AVAILABILITY_CONFIRM_WINDOW_MINUTES)return {gate:'BLOCKED',detail:'Kickoff is under '+AVAILABILITY_CONFIRM_WINDOW_MINUTES+' minutes away and no manual inactives confirmation exists for this event.'};
  return {gate:'CLEARED',detail:'Matched '+row[1]+' ('+row[2]+'); game status '+(gameStatus||'(not listed)')+'; source '+statusSource+'.'};
}
// Superseded: the weekly workflow no longer uses the Sheet injury gate;
// analysis handles current availability from live sources instead.
function runAvailabilityGate() {return run_('Availability gate',()=>{
  const legSetup=compatibleHeaders_(TAB_LEGS,LEG_HEADERS),legHeaders=legSetup.headers;
  const lm=headerMap_(legHeaders,['Leg ID','Event ID','Player / Team','Status','Manual Availability Confirm','Manual Confirmed UTC','Manual Confirmed Game Status','Availability Gate','Availability Gate Detail'],'LEGS');
  const confirmCol=legHeaders.indexOf('Manual Availability Confirm')+1;
  if(legSetup.sheet.getLastRow()>1)legSetup.sheet.getRange(2,confirmCol,legSetup.sheet.getLastRow()-1,1).insertCheckboxes();
  const legs=read_(TAB_LEGS,legHeaders.length),roster=read_(TAB_ROSTER,ROSTER_HEADERS.length),indexRows=read_(TAB_INDEX,INDEX_HEADERS.length+INDEX_EXTRA.length);
  const time=now_();let confirmed=0;
  // A tick on one leg confirms that player for that leg's event only — the
  // same 90-minute window and the same announced inactives list. It also
  // clears every OTHER pending leg that resolves to the same ROSTER player
  // in the SAME event (same game, same inactives list); it must never
  // reach a pending leg on the same player in a different event. Never
  // overwrite an existing confirmation timestamp: that is when the owner
  // actually confirmed it, not when the gate happened to run again.
  legs.forEach(trigger=>{
    if(trigger[lm['Manual Availability Confirm']]!==true||trigger[lm['Manual Confirmed UTC']])return;
    const resolved=resolveLegGameAndPlayer_(trigger,lm,indexRows,roster);
    if(resolved.error)return;
    const gameStatusNow=String(resolved.row[12]||'').toUpperCase();
    legs.forEach(candidate=>{
      if(String(candidate[lm.Status]||'PENDING').toUpperCase()!=='PENDING')return;
      if(candidate[lm['Manual Confirmed UTC']])return;
      if(String(candidate[lm['Event ID']]||'').trim()!==resolved.eventId)return;
      const candidateResolved=resolveLegGameAndPlayer_(candidate,lm,indexRows,roster);
      if(candidateResolved.error||candidateResolved.row!==resolved.row)return;
      candidate[lm['Manual Confirmed UTC']]=time;candidate[lm['Manual Confirmed Game Status']]=gameStatusNow;
      candidate[lm['Manual Availability Confirm']]=true;confirmed++;
    });
  });
  let blocked=0,cleared=0,evaluated=0;
  legs.forEach(leg=>{
    if(String(leg[lm.Status]||'PENDING').toUpperCase()!=='PENDING')return;
    const result=evaluateLegAvailability_(leg,lm,indexRows,roster);
    leg[lm['Availability Gate']]=result.gate;leg[lm['Availability Gate Detail']]=result.detail;
    result.gate==='BLOCKED'?blocked++:cleared++;evaluated++;
  });
  if(legs.length)sheet_(TAB_LEGS).getRange(2,1,legs.length,legHeaders.length).setValues(legs.map(r=>r.map(cell_)));
  log_('Availability gate','','SUCCESS',evaluated+' pending legs evaluated: '+blocked+' blocked, '+cleared+' cleared; '+confirmed+' leg(s) newly carry a manual confirmation; zero Odds API credits',0);
  SpreadsheetApp.getUi().alert('Availability gate: '+evaluated+' pending legs evaluated — '+blocked+' BLOCKED, '+cleared+' CLEARED. '+confirmed+' leg(s) newly confirmed.');
  return {evaluated,blocked,cleared,confirmed};
});}

function groupLegPerformance_(legs,keyFn) {
  const groups={};
  legs.forEach(l=>{
    const status=textValue_(l[17]).toUpperCase(),key=keyFn(l)||'(blank)';
    if(!groups[key])groups[key]={wins:0,losses:0,priceClv:[],lineClv:[],n:0};
    const g=groups[key];g.n++;
    if(status==='WIN')g.wins++;if(status==='LOSS')g.losses++;
    if(l[16]!==''&&l[16]!==null&&l[16]!==undefined){try{g.priceClv.push(impliedProbability_(l[16])-impliedProbability_(l[9]));}catch(ignore){}}
    if(l[8]!==''&&l[8]!==null&&l[8]!==undefined&&l[15]!==''&&l[15]!==null&&l[15]!==undefined) {
      const open=Number(l[8]),close=Number(l[15]),side=textValue_(l[7]).toLowerCase();
      if(Number.isFinite(open)&&Number.isFinite(close)) {
        if(side.indexOf('over')>=0)g.lineClv.push(close-open);
        if(side.indexOf('under')>=0)g.lineClv.push(open-close);
      }
    }
  });
  return Object.keys(groups).sort().map(k=>{const g=groups[k],decisions=g.wins+g.losses;return [k,g.n,g.wins,g.losses,decisions?g.wins/decisions:'',g.priceClv.length?g.priceClv.reduce((a,b)=>a+b,0)/g.priceClv.length:'',g.priceClv.length,g.lineClv.length?g.lineClv.reduce((a,b)=>a+b,0)/g.lineClv.length:'',g.lineClv.length];});
}

function oddsBand_(price) {const p=Number(price);return p<=-151?'≤ -151':p<=-100?'-150 to -100':p<=149?'+100 to +149':'+150 or longer';}

function buildPerformanceRows_(parlays,legs,time) {
  const decisions=parlays.filter(p=>['WIN','LOSS'].includes(textValue_(p[8]).toUpperCase()));
  const wins=decisions.filter(p=>textValue_(p[8]).toUpperCase()==='WIN').length;
  const losses=decisions.length-wins,settled=parlays.filter(p=>TRACKER_STATUSES.slice(1).includes(textValue_(p[8]).toUpperCase()));
  const profit=settled.reduce((s,p)=>s+(Number(p[10])||0),0),staked=settled.reduce((s,p)=>s+(Number(p[6])||0),0);
  const resolvedLegs=legs.filter(l=>['WIN','LOSS','PUSH','VOID'].includes(textValue_(l[17]).toUpperCase()));
  const decidedLegs=resolvedLegs.filter(l=>['WIN','LOSS'].includes(textValue_(l[17]).toUpperCase()));
  const legWins=decidedLegs.filter(l=>textValue_(l[17]).toUpperCase()==='WIN').length;
  const legCountByParlay_={};parlays.forEach(p=>{legCountByParlay_[String(p[0])]=Number(p[4]);});
  const rows=[
    ['NFL PARLAY PERFORMANCE'],['Updated UTC',time],
    ['Caution','Small samples are noisy. Use these splits descriptively; do not treat them as proven predictive edges.'],[],
    ['PARLAY SUMMARY','Value'],['Total parlays',parlays.length],['Pending parlays',parlays.filter(p=>textValue_(p[8]).toUpperCase()==='PENDING').length],
    ['Record',wins+'-'+losses],['Void parlays',settled.filter(p=>textValue_(p[8]).toUpperCase()==='VOID').length],
    ['Total staked',money_(staked)],['Actual profit/loss',money_(profit)],['ROI',staked?profit/staked:''],
    ['Decided leg hit rate',decidedLegs.length?legWins/decidedLegs.length:''],['Decided legs',decidedLegs.length],['Push/void legs',resolvedLegs.length-decidedLegs.length],[]
  ];
  const add=(title,data)=>{rows.push([title,'Legs','Wins','Losses','Hit Rate','Avg Price CLV (probability points)','Price CLV Samples','Avg Line CLV','Line CLV Samples']);data.forEach(r=>rows.push(r));rows.push([]);};
  add('BY MARKET',groupLegPerformance_(resolvedLegs,l=>textValue_(l[6])));
  add('BY ODDS BAND',groupLegPerformance_(resolvedLegs,l=>oddsBand_(l[9])));
  add('BY CONFIDENCE',groupLegPerformance_(resolvedLegs,l=>textValue_(l[13])));
  add('BY LEG COUNT',groupLegPerformance_(resolvedLegs,l=>{const n=legCountByParlay_[String(l[1])];return Number.isFinite(n)?n+' legs':'(unknown)';}));
  return rows;
}

function showPerformance() {return run_('Performance',()=>{
  ensureTrackerSheet_(TAB_PARLAYS,PARLAY_HEADERS);ensureTrackerSheet_(TAB_LEGS,LEG_HEADERS);
  const rows=buildPerformanceRows_(read_(TAB_PARLAYS,PARLAY_HEADERS.length),read_(TAB_LEGS,LEG_HEADERS.length),now_());
  const s=sheet_(TAB_PERFORMANCE),width=Math.max.apply(null,rows.map(r=>r.length));
  const padded=rows.map(r=>r.concat(Array(width-r.length).fill('')));write_(TAB_PERFORMANCE,padded[0],padded.slice(1));
  log_('Performance','','SUCCESS','Summary refreshed; zero API credits',0);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(s);return rows;
});}

// -----------------------------------------------------------------------------
// Phase 2: price comparison. One request names ten books: DraftKings, Fanatics
// and eight reference books. Up to ten named books count as one region, so
// every request costs the same as DraftKings alone (5 standard, 5 alternate,
// 3 game lines). Only DraftKings feeds PROPS, ALT_PROPS, INDEX, line history
// and exports' quotes. Fanatics goes to COMPARE_QUOTES; the reference books
// feed one compact MARKET_CONSENSUS row per DraftKings quote. These are market
// references and a line shopping aid: never a forecast, a probability, an edge
// claim or a refusal reason.
let NBA_REQUEST_BOOKMAKERS = 'draftkings,fanatics,fanduel,betmgm,williamhill_us,betrivers,hardrockbet,pinnacle,betonlineag,lowvig';
const MAX_REQUEST_BOOKMAKERS = 10;
const TAB_COMPARE_QUOTES = 'COMPARE_QUOTES';
const COMPARE_QUOTE_HEADERS = ['Event ID','Family','Market Key','Subject','Side','Line','Price','Bookmaker','Source Updated UTC','Captured UTC'];
const COMPARE_FRESHNESS_MINUTES = 15;
const COMPARE_RETENTION_DAYS = 7;
// Books the owner can bet besides DraftKings. Only these are stored quote by quote.
const BETTABLE_BOOKS = ['draftkings','fanatics'];
function cellText_(v) {const x=exportValue_(v);return x===undefined||x===null?'':String(x);}
function requestedBooks_() {return String(NBA_REQUEST_BOOKMAKERS||'').split(',').map(b=>b.trim()).filter(Boolean);}
// Checked at plan time and before every paid request: an 11th book would make
// every request cost double, so it is refused before anything is sent.
function requestBookmakers_() {
  const list=requestedBooks_(),seen={};
  if(list[0]!==BOOK)fail_('The bookmaker list must start with '+BOOK+'.');
  list.forEach(b=>{if(seen[b])fail_('The bookmaker list names '+b+' twice.');seen[b]=true;});
  if(list.length>MAX_REQUEST_BOOKMAKERS)fail_('The bookmaker list names '+list.length+' books; more than '+MAX_REQUEST_BOOKMAKERS+' would double the credit cost of every request.');
  return list.join(',');
}
function comparisonBooks_() {return requestedBooks_().filter(b=>b!==BOOK&&BETTABLE_BOOKS.indexOf(b)>=0);}
function comparisonQuotes_(event,family,bookKey) {
  const book=((event&&event.bookmakers)||[]).find(b=>b&&b.key===bookKey);if(!book)return null;
  const allowed=family==='game'?['h2h','spreads','totals']:family==='alternate'?MOBILE_ALTERNATE_MARKETS:PROP_MARKETS,out=[];
  (book.markets||[]).forEach(m=>{
    if(allowed.indexOf(m.key)<0)return;
    (m.outcomes||[]).forEach(o=>{
      if(!o||!Number.isFinite(o.price)||Math.abs(o.price)<100)return; // Comparison data is skipped, never fatal.
      let subject,side,line='';
      if(family==='game'){
        if(m.key==='totals'){if(['Over','Under'].indexOf(o.name)<0||!Number.isFinite(o.point))return;subject='Total';side=o.name;line=o.point;}
        else {if(!o.name)return;subject=o.name;side=o.name;if(m.key==='spreads'){if(!Number.isFinite(o.point))return;line=o.point;}}
      } else {
        if(!o.description||['Over','Under'].indexOf(o.name)<0||!Number.isFinite(o.point))return;subject=o.description;side=o.name;line=o.point;
      }
      out.push([String(event.id),family,m.key,subject,side,line,o.price,bookKey,m.last_update||'']);
    });
  });
  return out;
}
function recordComparisonQuotes_(events,family,time) {
  const books=comparisonBooks_();if(!books.length)return;
  const list=(Array.isArray(events)?events:[events]).filter(ev=>ev&&ev.id);if(!list.length)return;
  const ids={},rows=[];
  list.forEach(ev=>{ids[String(ev.id)]=true;books.forEach(book=>{
    const quotes=comparisonQuotes_(ev,family,book);
    if(!quotes||!quotes.length){rows.push([String(ev.id),family,'','','NOT_OFFERED','','',book,'',time]);return;}
    quotes.forEach(q=>rows.push(q.concat([time])));
  });});
  // Replace this load's event/family; drop anything captured over 7 days ago so the tab stays small.
  const cutoff=Date.parse(time)-COMPARE_RETENTION_DAYS*86400000;
  replaceRows_(TAB_COMPARE_QUOTES,COMPARE_QUOTE_HEADERS,[0,1,9],r=>(ids[String(r[0])]&&String(r[1])===family)||Date.parse(cellText_(r[9]))<cutoff,rows);
}
// Comparison and consensus are optional context: their failure never fails a load.
function recordComparisonQuotesSafely_(events,family,time) {
  try{recordComparisonQuotes_(events,family,time);}
  catch(e){log_('Comparison quotes','','ERROR','DraftKings data loaded; '+family+' comparison quotes were not updated: '+safeError_(e),0);}
  try{recordMarketConsensus_(events,family,time);}
  catch(e){log_('Market consensus','','ERROR','DraftKings data loaded; '+family+' market consensus was not updated: '+safeError_(e),0);}
}

// Deterministic price arithmetic. These are references, not outcome probabilities.
function impliedRate_(price) {const p=Number(price);if(price===''||price===null||price===undefined||!Number.isFinite(p)||Math.abs(p)<100)return null;return p>0?100/(p+100):-p/(-p+100);}
function breakEvenPct_(price) {const v=impliedRate_(price);return v===null?null:Math.round(v*10000)/100;}
function noVigPct_(price,opposite) {
  const a=impliedRate_(price),b=impliedRate_(opposite);if(a===null||b===null)return null;
  return [Math.round(a/(a+b)*10000)/100,Math.round(b/(a+b)*10000)/100];
}
function betterPriceBook_(draftkings,other,otherBook) {
  const a=impliedRate_(draftkings),b=impliedRate_(other);if(a===null||b===null)return BOOK;
  return a===b?'tie':(b<a?(otherBook||comparisonBooks_()[0]||'other'):BOOK);
}
function comparisonIndex_(eventIds) {
  const books=comparisonBooks_(),book=books[0]||'',quotes={},status={};
  if(!book)return {book:'',quotes:quotes,status:status};
  const wanted={};eventIds.forEach(id=>wanted[String(id)]=true);
  let stored;try{stored=read_(TAB_COMPARE_QUOTES,COMPARE_QUOTE_HEADERS.length);}catch(ignore){return {book:book,quotes:quotes,status:status,unavailable:true};}
  stored.forEach(r=>{
    const eventId=String(r[0]),family=String(r[1]),key=eventId+'|'+family;if(!wanted[eventId]||String(r[7])!==book)return;
    if(String(r[4])==='NOT_OFFERED'){status[key]='NOT_OFFERED';return;}
    status[key]='OFFERED';(quotes[key]||(quotes[key]=[])).push({market_key:String(r[2]),subject:String(r[3]),side:String(r[4]),line:r[5]===''?'':Number(r[5]),price:Number(r[6]),source:cellText_(r[8]),captured:cellText_(r[9]),used:false});
  });
  return {book:book,quotes:quotes,status:status};
}
function comparisonSubjectKey_(family,value) {return family==='game'?String(value||'').trim().toLowerCase():normPlayerName_(value);}
function comparisonMatch_(index,eventId,family,market,subject,side,line,draftkingsTime) {
  if(!index.book)return null;
  if(index.unavailable)return {note:'COMPARISON_UNAVAILABLE'};
  const key=String(eventId)+'|'+family,state=index.status[key];
  if(!state)return {note:'NOT_REQUESTED'};if(state==='NOT_OFFERED')return {note:'NOT_OFFERED'};
  const wantLine=line===''||line===null||line===undefined||String(line).toLowerCase()==='moneyline'?'':Number(line),subjectKey=comparisonSubjectKey_(family,subject),sideKey=String(side||'').toLowerCase();
  const found=(index.quotes[key]||[]).find(q=>q.market_key===market&&comparisonSubjectKey_(family,q.subject)===subjectKey&&q.side.toLowerCase()===sideKey&&(wantLine===''?q.line==='':q.line===wantLine));
  if(!found)return {note:'NO_MATCHING_LINE'};
  found.used=true;
  const a=Date.parse(String(draftkingsTime||'')),b=Date.parse(found.source||found.captured);
  if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>COMPARE_FRESHNESS_MINUTES*60000)return {note:'STALE_OVER_15_MINUTES'};
  return {price:found.price};
}
function sidePricing_(index,price,opposite,match,consensus) {
  const out={break_even_pct:breakEvenPct_(price)},noVig=noVigPct_(price,opposite);
  if(noVig)out.market_reference_no_vig_pct=noVig[0];
  if(index.book){
    out.fanatics_price=match&&match.price!==undefined?match.price:null;
    if(out.fanatics_price===null)out.fanatics_note=match?match.note:'NOT_REQUESTED';
    out.best_price_book=out.fanatics_price===null?BOOK:betterPriceBook_(price,out.fanatics_price,index.book);
  }
  if(consensus)consensusPricing_(out,price,consensus);
  return out;
}
function marketSourceTime_(json,market) {try{return (JSON.parse(String(json||'{}'))||{})[market]||'';}catch(ignore){return '';}}
// Adds pricing to every exported DraftKings quote and a comparison summary per game.
function enrichComparisonPricing_(games,gameMarkets,propMarkets,alternateMarkets) {
  const index=comparisonIndex_(games.map(g=>g.event_id)),cIndex=consensusIndex_(games.map(g=>g.event_id));
  const cm=(eventId,family,market,subject,side,line)=>consensusMatch_(cIndex,eventId,family,market,subject,side,line);
  gameMarkets.forEach(q=>{
    const other=gameMarkets.find(x=>x!==q&&x.event_id===q.event_id&&x.market_key===q.market_key&&x.selection!==q.selection);
    const subject=q.market_key==='totals'?'Total':q.selection,time=marketSourceTime_(q.market_source_times_json,q.market_key)||q.source_updated_utc,line=q.market_key==='h2h'?'':q.line;
    q.pricing=sidePricing_(index,q.price,other?other.price:null,comparisonMatch_(index,q.event_id,'game',q.market_key,subject,q.selection,line,time),cm(q.event_id,'game',q.market_key,subject,q.selection,line));
  });
  propMarkets.forEach(q=>{
    const time=q.source_updated_utc;q.pricing={};
    if(impliedRate_(q.over_price)!==null)q.pricing.over=sidePricing_(index,q.over_price,q.under_price,comparisonMatch_(index,q.event_id,'standard',q.market_key,q.player,'Over',q.line,time),cm(q.event_id,'standard',q.market_key,q.player,'Over',q.line));
    if(impliedRate_(q.under_price)!==null)q.pricing.under=sidePricing_(index,q.under_price,q.over_price,comparisonMatch_(index,q.event_id,'standard',q.market_key,q.player,'Under',q.line,time),cm(q.event_id,'standard',q.market_key,q.player,'Under',q.line));
  });
  alternateMarkets.forEach(q=>{
    const other=alternateMarkets.find(x=>x!==q&&x.event_id===q.event_id&&x.market_key===q.market_key&&normPlayerName_(x.player)===normPlayerName_(q.player)&&Number(x.line)===Number(q.line)&&String(x.side)!==String(q.side));
    q.pricing=sidePricing_(index,q.price,other?other.price:null,comparisonMatch_(index,q.event_id,'alternate',q.market_key,q.player,q.side,q.line,q.source_updated_utc),cm(q.event_id,'alternate',q.market_key,q.player,q.side,q.line));
  });
  games.forEach(g=>{g.market_consensus=consensusGameSummary_(cIndex,g,gameMarkets,propMarkets,alternateMarkets);});
  games.forEach(g=>{
    if(!index.book){g.comparison=null;return;}
    const id=String(g.event_id),familyStatus=f=>index.status[id+'|'+f]||'NOT_REQUESTED',draftkingsLines={};
    propMarkets.filter(q=>q.event_id===id).forEach(q=>draftkingsLines[q.market_key+'|'+normPlayerName_(q.player)]=true);
    const otherLines=(index.quotes[id+'|standard']||[]).filter(q=>!q.used&&draftkingsLines[q.market_key+'|'+normPlayerName_(q.subject)]).map(q=>({market_key:q.market_key,subject:q.subject,side:q.side,line:q.line,price:q.price,note:'NOT_COMPARABLE_DIFFERENT_LINE'}));
    g.comparison={book:index.book,status:familyStatus('standard')!=='NOT_REQUESTED'?familyStatus('standard'):familyStatus('game'),families:{game:familyStatus('game'),standard:familyStatus('standard'),alternate:familyStatus('alternate')},freshness_minutes:COMPARE_FRESHNESS_MINUTES,other_lines:otherLines};
  });
}
function comparisonInstructions_() {
  return 'PRICE COMPARISON: Each DraftKings quote carries pricing. break_even_pct is the win rate the price requires. market_reference_no_vig_pct (when both sides are posted) is a market reference after removing the DraftKings margin, not a true probability. fanatics_price and best_price_book appear when Fanatics posted the identical player or team, market, side, and line in the same load; otherwise fanatics_note explains why. game.comparison.other_lines are Fanatics quotes at different lines: they are not comparable and must not be priced against DraftKings. DraftKings remains the logged and quoted price. When Fanatics is better at the identical line, name it as the best available price. Missing Fanatics data is never a reason to pass.';
}

// Market consensus. For each DraftKings quote, every reference book that posted
// the identical player or team, market, side and line within 15 minutes of
// DraftKings counts as a book at the line; those that also posted the opposite
// side give a no-vig price, and the median of at least three is the consensus.
const CONSENSUS_MIN_BOOKS = 3;
const TAB_MARKET_CONSENSUS = 'MARKET_CONSENSUS';
const MARKET_CONSENSUS_HEADERS = ['Event ID','Family','Market Key','Subject','Side','Line','DraftKings Price','Books At Line','Books In Consensus','Consensus No-vig %','Best Reference Price','Best Reference Book','Note','DraftKings Updated UTC','Captured UTC'];
function referenceBooks_() {return requestedBooks_().filter(b=>b!==BOOK);}
function consensusEnabled_() {return referenceBooks_().length>=CONSENSUS_MIN_BOOKS;}
function round2_(v) {return Math.round(v*100)/100;}
function median_(values) {const v=values.slice().sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
function consensusKey_(family,market,subject,side,line) {
  const l=line===''||line===null||line===undefined||String(line).toLowerCase()==='moneyline'?'':String(Number(line));
  return [family,market,comparisonSubjectKey_(family,subject),String(side||'').trim().toLowerCase(),l].join('|');
}
// The other side of the same market at the same line, from one book's quotes.
function oppositeQuote_(quotes,family,q) {
  const market=q[2],subject=comparisonSubjectKey_(family,q[3]),side=String(q[4]).toLowerCase(),line=q[5]===''?'':Number(q[5]);
  if(family==='game'&&market==='h2h')return quotes.find(x=>x[2]===market&&comparisonSubjectKey_(family,x[3])!==subject)||null;
  if(family==='game'&&market==='spreads')return quotes.find(x=>x[2]===market&&comparisonSubjectKey_(family,x[3])!==subject&&Number(x[5])===-line)||null;
  const other=side==='over'?'under':side==='under'?'over':'';if(!other)return null;
  return quotes.find(x=>x[2]===market&&comparisonSubjectKey_(family,x[3])===subject&&String(x[4]).toLowerCase()===other&&Number(x[5])===line)||null;
}
function consensusRowsForEvent_(event,family,time) {
  const id=String(event.id),dk=comparisonQuotes_(event,family,BOOK);if(!dk||!dk.length)return [];
  const byBook={},returned=[];
  referenceBooks_().forEach(b=>{const quotes=comparisonQuotes_(event,family,b)||[],index={};quotes.forEach(q=>index[consensusKey_(family,q[2],q[3],q[4],q[5])]=q);byBook[b]={quotes:quotes,index:index};if(quotes.length)returned.push(b);});
  const rows=[[id,family,'','','STATUS','','','','','','','',returned.length?'BOOKS:'+returned.join(','):'NO_REFERENCE_BOOKS','',time]];
  dk.forEach(q=>{
    const key=consensusKey_(family,q[2],q[3],q[4],q[5]),dkTime=Date.parse(String(q[8]||'')),atLine=[],noVig=[];
    returned.forEach(b=>{
      const r=byBook[b].index[key];if(!r)return;
      const t=Date.parse(String(r[8]||''));if(Number.isFinite(dkTime)&&Number.isFinite(t)&&Math.abs(dkTime-t)>COMPARE_FRESHNESS_MINUTES*60000)return;
      atLine.push({book:b,price:r[6]});
      const opposite=oppositeQuote_(byBook[b].quotes,family,r),pair=opposite?noVigPct_(r[6],opposite[6]):null;if(pair)noVig.push(pair[0]);
    });
    if(!atLine.length)return;
    const best=atLine.reduce((a,x)=>impliedRate_(x.price)<impliedRate_(a.price)?x:a);
    const consensus=noVig.length>=CONSENSUS_MIN_BOOKS?round2_(median_(noVig)):'';
    const note=consensus!==''?'':!noVig.length?'ONE_SIDED':'FEWER_THAN_'+CONSENSUS_MIN_BOOKS+'_BOOKS';
    rows.push([id,family,q[2],q[3],q[4],q[5],q[6],atLine.length,noVig.length,consensus,best.price,best.book,note,q[8]||'',time]);
  });
  return rows;
}
function recordMarketConsensus_(events,family,time) {
  if(!consensusEnabled_())return;
  const list=(Array.isArray(events)?events:[events]).filter(ev=>ev&&ev.id);if(!list.length)return;
  const ids={},rows=[];
  list.forEach(ev=>{ids[String(ev.id)]=true;consensusRowsForEvent_(ev,family,time).forEach(r=>rows.push(r));});
  // Replace this load's event/family; drop rows captured over 7 days ago.
  const cutoff=Date.parse(time)-COMPARE_RETENTION_DAYS*86400000;
  replaceRows_(TAB_MARKET_CONSENSUS,MARKET_CONSENSUS_HEADERS,[0,1,14],r=>(ids[String(r[0])]&&String(r[1])===family)||Date.parse(cellText_(r[14]))<cutoff,rows);
}
function consensusIndex_(eventIds) {
  const out={enabled:consensusEnabled_(),rows:{},status:{}};if(!out.enabled)return out;
  const wanted={};eventIds.forEach(id=>wanted[String(id)]=true);
  let stored;try{stored=read_(TAB_MARKET_CONSENSUS,MARKET_CONSENSUS_HEADERS.length);}catch(ignore){out.unavailable=true;return out;}
  stored.forEach(r=>{
    const eventId=String(r[0]),family=String(r[1]);if(!wanted[eventId])return;
    if(String(r[4])==='STATUS'){out.status[eventId+'|'+family]=String(r[12]);return;}
    out.rows[eventId+'|'+consensusKey_(family,String(r[2]),String(r[3]),String(r[4]),r[5])]={dk_price:Number(r[6]),books_at_line:Number(r[7]),consensus:r[9]===''?null:Number(r[9]),best_price:r[10]===''?null:Number(r[10]),best_book:String(r[11]||''),note:String(r[12]||'')};
  });
  return out;
}
function consensusMatch_(cIndex,eventId,family,market,subject,side,line) {
  if(!cIndex.enabled)return null;
  if(cIndex.unavailable)return {note:'CONSENSUS_UNAVAILABLE'};
  // NOT_RECORDED: no consensus was saved for this game and family (reused from
  // an earlier load, or the save failed; the LOG says which).
  const status=cIndex.status[String(eventId)+'|'+family];
  if(!status)return {note:'NOT_RECORDED'};if(status==='NO_REFERENCE_BOOKS')return {note:'NO_REFERENCE_BOOKS'};
  return cIndex.rows[String(eventId)+'|'+consensusKey_(family,market,subject,side,line)]||{note:'NO_BOOKS_AT_LINE'};
}
// price_gap_pp = consensus minus the DraftKings break-even: positive means
// DraftKings pays more than the reference books imply. Not an edge claim.
function consensusPricing_(out,price,c) {
  const empty=note=>{out.books_at_line=0;out.consensus_no_vig_pct=null;out.price_gap_pp=null;out.consensus_note=note;out.best_reference_price=null;out.best_reference_book=null;};
  if(c.dk_price===undefined)return empty(c.note);
  if(Number(price)!==c.dk_price)return empty('DK_PRICE_CHANGED');
  out.books_at_line=c.books_at_line;out.consensus_no_vig_pct=c.consensus;
  out.price_gap_pp=c.consensus===null||out.break_even_pct===null?null:round2_(c.consensus-out.break_even_pct);
  if(c.consensus===null)out.consensus_note=c.note||'NO_CONSENSUS';
  out.best_reference_price=c.best_price;out.best_reference_book=c.best_book||null;
}
function consensusGameSummary_(cIndex,g,gameMarkets,propMarkets,alternateMarkets) {
  if(!cIndex.enabled)return null;
  const id=String(g.event_id),family=f=>{const s=cIndex.unavailable?'CONSENSUS_UNAVAILABLE':cIndex.status[id+'|'+f]||'NOT_RECORDED';return s.indexOf('BOOKS:')===0?{status:'OFFERED',books_returned:s.slice(6).split(',')}:{status:s,books_returned:[]};};
  let sides=0,withConsensus=0;const count=p=>{if(!p||typeof p.break_even_pct!=='number')return;sides++;if(typeof p.consensus_no_vig_pct==='number')withConsensus++;};
  gameMarkets.filter(q=>String(q.event_id)===id).forEach(q=>count(q.pricing));
  propMarkets.filter(q=>String(q.event_id)===id).forEach(q=>{const p=q.pricing||{};count(p.over);count(p.under);});
  alternateMarkets.filter(q=>String(q.event_id)===id).forEach(q=>count(q.pricing));
  return {reference_books_requested:referenceBooks_(),min_books:CONSENSUS_MIN_BOOKS,freshness_minutes:COMPARE_FRESHNESS_MINUTES,families:{game:family('game'),standard:family('standard'),alternate:family('alternate')},draftkings_sides:sides,sides_with_consensus:withConsensus};
}
function consensusInstructions_() {
  return 'MARKET CONSENSUS: Pricing also compares each DraftKings quote with up to eight reference books that posted the identical player or team, market, side, and line within 15 minutes of DraftKings; books_at_line counts them. consensus_no_vig_pct is the median no-vig price across the reference books that posted both sides (at least 3 are needed; otherwise consensus_note says why). price_gap_pp is consensus_no_vig_pct minus break_even_pct: positive means DraftKings pays more than the other books imply, negative means it pays less. It is a market reference, not a forecast, a probability, or an edge claim. For every shortlisted pick, state price_gap_pp or its consensus_note. Because break_even_pct includes the DraftKings margin, a fairly priced -110/-110 market scores about -2.4 (50.00 minus 52.38), so most gaps are negative. A pick with price_gap_pp below -2.5 (DraftKings pricier than a standard -110 market) needs a specific stated reason to remain RECOMMENDED. A missing consensus is never a reason to pass, and the gap alone never decides a pick. best_reference_price and best_reference_book are context only: the owner bets only at DraftKings and Fanatics.';
}
function pricingInstructions_() {return comparisonInstructions_()+' '+consensusInstructions_();}

// Overcharge hold: if a paid request is charged more than its reviewed maximum,
// the data is kept but no new paid request is sent until the owner acknowledges.
const PAID_HOLD_PROPERTY = 'NBA_PAID_HOLD';
function paidHold_() {try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(PAID_HOLD_PROPERTY)||'null');}catch(ignore){return null;}}
function assertNoPaidHold_() {const hold=paidHold_();if(hold)failNotSent_('Paid Odds API requests are paused: '+hold.message+' Review the LOG, then run acknowledgeOverchargeHold in the NBA Apps Script editor. No request was sent.');}
function setPaidHold_(actual,expected,label) {
  const time=now_(),message='A request ('+String(label||'odds')+') was charged '+actual+' credits against a reviewed maximum of '+expected+' at '+time+'.';
  try{PropertiesService.getScriptProperties().setProperty(PAID_HOLD_PROPERTY,JSON.stringify({actual:actual,expected:expected,label:String(label||''),utc:time,message:message}));}catch(ignore){}
  log_('Paid request hold','','OVERCHARGE',message+' The data was kept; paid requests are paused until the owner acknowledges this.',actual);
  return message;
}
function checkOvercharge_(headers,expected,label) {
  const actual=numberHeader_(headers||{},'x-requests-last');
  if(Number.isFinite(actual)&&Number.isFinite(expected)&&actual>expected)setPaidHold_(actual,expected,label);
}
// Owner-only, run from the Apps Script editor after reviewing the LOG.
function acknowledgeOverchargeHold() {
  const hold=paidHold_();PropertiesService.getScriptProperties().deleteProperty(PAID_HOLD_PROPERTY);
  log_('Paid request hold','','ACKNOWLEDGED',hold?hold.message:'No hold was set.',0);
  const result={cleared:Boolean(hold)};console.log(JSON.stringify(result));return result;
}

// -----------------------------------------------------------------------------
// Phase 3: recent usage context. Free, no Odds API credits: one download of
// the season's player box scores published by sportsdataverse hoopR (ESPN
// box scores, updated daily). For every player with a prop line it lists his
// last five team games before tipoff, game by game, and each team's rest and
// back-to-back status. History only: no averages, rates or expected numbers.
// Any download or parse failure marks the game UNAVAILABLE; it never blocks.
const USAGE_CONTEXT_ENABLED = true;
const USAGE_TEAM_GAMES = 5;
const USAGE_SOURCE_PREFIX = 'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_player_boxscores/player_box_';
const USAGE_REQUIRED_COLUMNS = ['team_score','game_id','game_date','athlete_id','athlete_display_name','team_display_name','team_abbreviation','opponent_team_abbreviation','home_away','minutes',
  'field_goals_attempted','three_point_field_goals_made','three_point_field_goals_attempted','free_throws_attempted','offensive_rebounds','defensive_rebounds','rebounds','assists','turnovers','points','starter','did_not_play','reason'];
// hoopR names a season by its end year: 2026-27 is 2027.
function nbaSeasonEndYear_(ms) {const parts=Utilities.formatDate(new Date(ms),'America/New_York','yyyy-MM-dd').split('-').map(Number);return parts[1]>=8?parts[0]+1:parts[0];}
function nbaUsageSourceUrl_(season) {return USAGE_SOURCE_PREFIX+season+'.csv';}
function usageNumber_(v) {const s=String(v===undefined||v===null?'':v).trim();if(s==='')return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function usageBool_(v) {return String(v).trim().toLowerCase()==='true';}
function usagePct_(part,whole) {return part===null||!whole?null:Math.round(part/whole*1000)/10;}
function nbaDaysBetween_(a,b) {return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
// Downloads and indexes the season file. Returns {rows, teams, source}.
function nbaLoadBoxScores_(season) {
  const url=nbaUsageSourceUrl_(season),response=request_(url,'NBA box scores',false,'',false);
  let table;try{table=Utilities.parseCsv(response.text);}catch(e){fail_('The NBA box score file could not be read.');}
  if(!table||table.length<2)fail_('The NBA box score file has no rows for season '+season+'.');
  const map=headerMap_(table[0].map(String),USAGE_REQUIRED_COLUMNS,'NBA box scores'),rows=[],teams={};let lastDate='';
  table.slice(1).forEach(r=>{
    const row={};USAGE_REQUIRED_COLUMNS.forEach(c=>row[c]=r[map[c]]);
    row.game_id=String(row.game_id);row.game_date=String(row.game_date).slice(0,10);if(!/^\d{4}-\d\d-\d\d$/.test(row.game_date))return;
    row.played=!usageBool_(row.did_not_play)&&(usageNumber_(row.minutes)||0)>0;rows.push(row);if(row.game_date>lastDate)lastDate=row.game_date;
    const team=String(row.team_display_name),games=teams[team]||(teams[team]={abbreviation:String(row.team_abbreviation||''),games:{}});
    const g=games.games[row.game_id]||(games.games[row.game_id]={game_id:row.game_id,date:row.game_date,opponent:String(row.opponent_team_abbreviation||''),home_away:String(row.home_away||''),min:0,fga:0,fta:0,tov:0,reb:0,ast:0});
    if(row.played){g.min+=usageNumber_(row.minutes)||0;g.fga+=usageNumber_(row.field_goals_attempted)||0;g.fta+=usageNumber_(row.free_throws_attempted)||0;g.tov+=usageNumber_(row.turnovers)||0;g.reb+=usageNumber_(row.rebounds)||0;g.ast+=usageNumber_(row.assists)||0;}
  });
  return {rows:rows,teams:teams,source:{provider:'sportsdataverse hoopR (ESPN box scores)',url:url,season:season,row_count:rows.length,last_game_date_in_file:lastDate,fetched_utc:now_()}};
}
// Team games strictly before the tipoff date (Eastern), newest first.
function nbaTeamGamesBefore_(box,team,dateKey) {
  const t=box.teams[team];if(!t)return [];
  return Object.keys(t.games).map(k=>t.games[k]).filter(g=>g.date<dateKey).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
}
function nbaTeamRest_(box,team,dateKey) {
  const games=nbaTeamGamesBefore_(box,team,dateKey),last=games[0];
  if(!last)return {team:team,abbreviation:(box.teams[team]||{}).abbreviation||'',last_game_date:null,rest_days:null,back_to_back:null,games_in_last_7_days:0,note:'NO_EARLIER_GAME_IN_FILE'};
  const rest=nbaDaysBetween_(last.date,dateKey)-1;
  return {team:team,abbreviation:box.teams[team].abbreviation,last_game_date:last.date,rest_days:rest,back_to_back:rest===0,games_in_last_7_days:games.filter(g=>nbaDaysBetween_(g.date,dateKey)<=7).length};
}
// Usage rate from the box score: 100 x (FGA + 0.44 FTA + TOV) x (team minutes / 5)
// / (minutes x (team FGA + 0.44 team FTA + team TOV)). Arithmetic on what happened.
function nbaUsageRate_(row,team) {
  const min=usageNumber_(row.minutes),fga=usageNumber_(row.field_goals_attempted),fta=usageNumber_(row.free_throws_attempted),tov=usageNumber_(row.turnovers);
  const teamPoss=team.fga+0.44*team.fta+team.tov;
  if(!min||fga===null||fta===null||tov===null||!teamPoss||!team.min)return null;
  return Math.round(100*(fga+0.44*fta+tov)*(team.min/5)/(min*teamPoss)*10)/10;
}
function nbaPlayerUsage_(box,name,teams,dateKey) {
  const key=normPlayerName_(name),allMatches=box.rows.filter(r=>normPlayerName_(r.athlete_display_name)===key),matches=allMatches.filter(r=>teams.indexOf(String(r.team_display_name))>=0);
  const ids=[...new Set(matches.map(r=>String(r.athlete_id)))];
  if(!ids.length)return {not_found:{player:name,reason:allMatches.length?'ONLY_FOUND_ON_ANOTHER_TEAM':'NO_BOX_SCORE_ROWS'}};
  if(ids.length>1)return {not_found:{player:name,reason:'SAME_NAME_ON_BOTH_TEAMS'}};
  const id=ids[0],own=box.rows.filter(r=>String(r.athlete_id)===id),latest=own.filter(r=>teams.indexOf(String(r.team_display_name))>=0&&r.game_date<dateKey).sort((a,b)=>a.game_date<b.game_date?1:-1)[0]||matches[0];
  const team=String(latest.team_display_name),teamGames=nbaTeamGamesBefore_(box,team,dateKey).slice(0,USAGE_TEAM_GAMES);
  const games=teamGames.map(tg=>{
    const r=own.find(x=>x.game_id===tg.game_id),base={date:tg.date,opponent:tg.opponent,home_away:tg.home_away};
    if(!r)return Object.assign(base,{status:'NOT_ON_TEAM_BOX_SCORE'});
    if(!r.played)return Object.assign(base,{status:'DID_NOT_PLAY',reason:String(r.reason||'')});
    const n=c=>usageNumber_(r[c]);
    return Object.assign(base,{status:'PLAYED',started:usageBool_(r.starter),minutes:n('minutes'),points:n('points'),rebounds:n('rebounds'),offensive_rebounds:n('offensive_rebounds'),defensive_rebounds:n('defensive_rebounds'),assists:n('assists'),
      threes_made:n('three_point_field_goals_made'),threes_attempted:n('three_point_field_goals_attempted'),field_goal_attempts:n('field_goals_attempted'),free_throw_attempts:n('free_throws_attempted'),turnovers:n('turnovers'),
      usage_rate_pct:nbaUsageRate_(r,tg),team_rebound_share_pct:usagePct_(n('rebounds'),tg.reb),team_assist_share_pct:usagePct_(n('assists'),tg.ast)});
  });
  const otherTeams=[...new Set(own.filter(r=>String(r.team_display_name)!==team).map(r=>String(r.team_display_name)))];
  return {player:{player:name,box_score_name:String(latest.athlete_display_name),athlete_id:id,team:team,team_abbreviation:String(latest.team_abbreviation||''),match:'EXACT_NAME_ON_GAME_TEAM',
    earlier_teams_this_season:otherTeams,team_games_shown:games.length,games_played:games.filter(g=>g.status==='PLAYED').length,games:games}};
}
// Returns {event_id: usage_context}. Any failure marks usage UNAVAILABLE.
function nbaUsageContextForGames_(games,propMarkets,alternateMarkets,timestamp,box) {
  const out={},stamp=Date.parse(timestamp);
  if(!USAGE_CONTEXT_ENABLED){games.forEach(g=>out[g.event_id]={status:'DISABLED'});return out;}
  try{box=box||nbaLoadBoxScores_(nbaSeasonEndYear_(stamp));}
  catch(e){const reason=safeError_(e);games.forEach(g=>out[g.event_id]={status:'UNAVAILABLE',reason:reason,note:'Usage context could not be loaded; research minutes and roles live. This is never a reason to pass.'});return out;}
  const yesterday=Utilities.formatDate(new Date(stamp-86400000),'America/New_York','yyyy-MM-dd');
  games.forEach(g=>{
    try{
      const dateKey=g.game_date_et||Utilities.formatDate(new Date(Date.parse(g.kickoff_utc)),'America/New_York','yyyy-MM-dd'),teams=[String(g.home_team),String(g.away_team)];
      const names=[...new Set(propMarkets.concat(alternateMarkets).filter(q=>String(q.event_id)===String(g.event_id)).map(q=>String(q.player||'')).filter(Boolean))].sort();
      const players=[],notFound=[];names.forEach(n=>{const r=nbaPlayerUsage_(box,n,teams,dateKey);if(r.player)players.push(r.player);else notFound.push(r.not_found);});
      const behind=box.source.last_game_date_in_file<yesterday&&box.source.last_game_date_in_file<dateKey;
      out[g.event_id]={status:'OK',note:'History from box scores, not a projection. Verify minutes, roles and injuries with live news.',source:box.source,
        source_freshness:behind?'SOURCE_BEHIND: the file ends '+box.source.last_game_date_in_file+'; games after that are missing.':'CURRENT',
        rest:{home:nbaTeamRest_(box,String(g.home_team),dateKey),away:nbaTeamRest_(box,String(g.away_team),dateKey)},
        players:players,not_found:notFound,not_available_in_source:['rebound chances','potential assists','touches']};
    }catch(e){out[g.event_id]={status:'UNAVAILABLE',reason:safeError_(e)};}
  });
  return out;
}
function usageInstructions_() {
  return 'USAGE CONTEXT: usage_context lists, for every player with a prop line, his last five team games before tipoff from box scores: started, minutes, points, rebounds, assists, threes, shot and free-throw attempts, turnovers, usage_rate_pct, and his share of team rebounds and assists, or DID_NOT_PLAY with the listed reason. rest gives each team\'s rest days and back-to-back flag. It is history to verify against live news, not a projection; do not average it into an expected number. Rebound chances and potential assists are not in this source. A missing or UNAVAILABLE usage context is never a reason to pass.';
}

// -----------------------------------------------------------------------------
// Phase 3: candidate log and free grading. The ChatGPT and Claude handoffs end
// with an NBA_CANDIDATES_V1 JSON block. "Log AI picks" checks every row
// against the exact snapshot's compact game files (all or nothing) and appends
// to CANDIDATES. "Grade finished games — free" settles them from the same free
// hoopR box score file. Flat 1 unit at the logged price; no probabilities.
const CANDIDATE_LOG_ENABLED = true;
const TAB_CANDIDATES = 'CANDIDATES';
const TAB_CANDIDATE_RESULTS = 'CANDIDATE_RESULTS';
const TAB_CANDIDATE_SUMMARY = 'CANDIDATE_SUMMARY';
const CANDIDATE_BLOCK = 'NBA_CANDIDATES_V1';
const CANDIDATE_CLASSES = ['RECOMMENDED','CONDITIONAL','WATCHLIST','PASS','UNASSESSED'];
const CANDIDATE_HEADERS = ['Candidate ID','Revision','Supersedes Revision','Snapshot ID','Event ID','Matchup','Kickoff UTC','Market Key','Subject','Subject Team','Side','Line','Price','Book','Classification','Condition','Reason','Imported UTC','Timing Flag','Content Hash','Books At Line','Consensus No-vig %','Price Gap pp','Home Team','Away Team'];
const CANDIDATE_RESULT_HEADERS = ['Candidate ID','Revision','Result','Actual Value','ESPN Athlete ID','Box Score File Through','Graded UTC','Detail'];
const CANDIDATE_GAME_MARKETS = ['h2h','spreads','totals'];

function candidateBlockInstructions_(snapshotId) {
  return 'MACHINE-READABLE PICK LOG: After the full report, end with one fenced code block whose info string is '+CANDIDATE_BLOCK+' and which contains only JSON whose first key is "block":"'+CANDIDATE_BLOCK+'", so the label is copied with the code: {"block":"'+CANDIDATE_BLOCK+'","snapshot_id":"'+(snapshotId||'<snapshot_id from the manifest>')+'","rows":[...],"game_notes":[...]}. '+
    'rows holds the same five classified candidates per eligible game shown in your game tables (never more than five per game), one object each: {"event_id","market_key","subject","side","line","price","book","classification","condition","reason"}. '+
    'Copy event_id, market_key, line, and price exactly from the compact game file. subject: the player name exactly as exported; the team name for h2h and spreads; "Total" for totals. side: "Over" or "Under" for props and totals, the team name for h2h and spreads. '+
    'line: the exported number, or null for h2h. book: "draftkings". classification: RECOMMENDED, CONDITIONAL, WATCHLIST, PASS, or UNASSESSED, matching the report. condition: required for CONDITIONAL, otherwise "". reason: one sentence of at most 200 characters. '+
    'For an alternate rung use its exported *_alternate market_key and exact rung. If an eligible game has fewer than five candidates, add {"event_id","reason"} to game_notes. Never include a quote that is not in the export.';
}
function candidateHash_(text) {
  let h1=2166136261,h2=2246822519;const s=String(text);
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^c,3266489917);}
  return ((h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')).toUpperCase();
}
function candidateNumber_(value) {
  if(value===null||value===undefined||value===''||String(value).toLowerCase()==='moneyline')return null;
  const n=Number(value);return Number.isFinite(n)?n:NaN;
}
// Reads one balanced JSON object starting at s[start]; never throws.
function candidateJsonAt_(s,start) {
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<s.length;i++){
    const c=s[i];
    if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
    if(c==='"')inString=true;else if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0){try{return {value:JSON.parse(s.slice(start,i+1))};}catch(ignore){return {invalid:true};}}}
  }
  return {incomplete:true};
}
function isCandidateObject_(value) {return !!value&&typeof value==='object'&&!Array.isArray(value)&&value.snapshot_id!==undefined&&Array.isArray(value.rows);}
// The last object that is recognisably the pick block (snapshot_id plus rows),
// so a phone copy of the code box without its label still works.
function findCandidateObject_(variants) {
  for(const v of variants){
    const key=v.lastIndexOf('"snapshot_id"');if(key<0)continue;
    for(let start=v.lastIndexOf('{',key),tries=0;start>=0&&tries<200;start=v.lastIndexOf('{',start-1),tries++){
      const r=candidateJsonAt_(v,start);if(isCandidateObject_(r.value))return r.value;
    }
  }
  return null;
}
function extractCandidateBlock_(text) {
  const original=String(text||''),at=original.lastIndexOf(CANDIDATE_BLOCK);
  // As pasted first; then with curly quotes straightened (phone keyboards swap them).
  const variants=[original,original.replace(/[“”]/g,'"')];
  const found=findCandidateObject_(variants);if(found)return {value:found};
  if(at<0)return {error:'No '+CANDIDATE_BLOCK+' block was found. Paste the whole AI answer, including its final '+CANDIDATE_BLOCK+' block.'};
  let incomplete=false;
  for(const v of variants){
    const s=v.slice(at),start=s.indexOf('{');if(start<0)return {error:'The '+CANDIDATE_BLOCK+' block has no JSON object.'};
    const r=candidateJsonAt_(s,start);if(r.value!==undefined)return {value:r.value};if(r.incomplete)incomplete=true;
  }
  return {error:'The '+CANDIDATE_BLOCK+' block could not be read as JSON'+(incomplete?': it is incomplete.':'.')};
}
function candidateDriveJson_(file) {try{return JSON.parse(file.getBlob().getDataAsString());}catch(ignore){return null;}}
// Load the manifest and compact game files for one snapshot, verifying every
// file belongs to it. Never falls back to another export.
function candidateSnapshot_(snapshotId) {
  const id=String(snapshotId||'').trim();
  if(!/^[0-9]{8,}-[A-Za-z0-9-]+$/.test(id))return {error:'snapshot_id is missing or malformed. Copy it exactly from the manifest.'};
  const folder=analysisExportFolder_(),suffix='_'+id+'.json',latest=mobileLastExport_(),manifests=[];
  const isManifest=name=>String(name).indexOf('analysis_manifest_')===0&&String(name).slice(-suffix.length)===suffix;
  if(latest&&isManifest(latest.analysis_manifest_filename||'')){const it=folder.getFilesByName(latest.analysis_manifest_filename);while(it.hasNext())manifests.push(it.next());}
  else if(typeof folder.searchFiles==='function'){const it=folder.searchFiles("title contains '"+id+"' and title contains 'analysis_manifest_'");while(it.hasNext()){const file=it.next();if(isManifest(file.getName()))manifests.push(file);}}
  if(!manifests.length)return {error:'Snapshot '+id+' was not found in '+MOBILE_EXPORT_FOLDER_NAME+'. Use the snapshot_id from the manifest you analyzed.'};
  if(manifests.length>1)return {error:'More than one manifest matches snapshot '+id+'.'};
  const manifest=candidateDriveJson_(manifests[0]);
  if(!manifest)return {error:'The manifest for snapshot '+id+' could not be read.'};
  if(String(manifest.snapshot_id)!==id)return {error:'The manifest snapshot_id does not match '+id+'.'};
  const games={};
  for(const event of (manifest.events||[])){
    const eventId=String(event.event_id||''),it=folder.getFilesByName(String(event.filename||'')),files=[];while(it.hasNext())files.push(it.next());
    if(files.length!==1)return {error:'The compact game file for '+eventId+' is missing or duplicated for snapshot '+id+'.'};
    const game=candidateDriveJson_(files[0]);
    if(!game)return {error:'The compact game file for '+eventId+' could not be read.'};
    if(String(game.snapshot_id)!==id||String(game.event_id)!==eventId)return {error:'The compact game file for '+eventId+' does not belong to snapshot '+id+'.'};
    games[eventId]={event:event,game:game,eligible:event.analysis_eligible===true&&game.analysis_eligible===true};
  }
  return {id:id,manifest:manifest,games:games};
}
// The verified team abbreviation for a player, from the export's usage context.
function candidatePlayerTeam_(game,player) {
  const p=((game.usage_context||{}).players||[]).find(x=>normPlayerName_(x.player)===normPlayerName_(player));return p?String(p.team_abbreviation||''):'';
}
// Find the exact exported quote for one block row. Returns {quote} or {error}.
function candidateQuote_(entry,row) {
  const g=entry.game,key=String(row.market_key||'').trim(),subject=String(row.subject||'').trim(),side=String(row.side||'').trim(),line=candidateNumber_(row.line),price=candidateNumber_(row.price);
  const label=String(row.event_id)+' '+key+' '+subject+' '+side+(line===null?'':' '+line)+' @ '+String(row.price);
  if(!Number.isInteger(price)||Math.abs(price)<100)return {error:label+': price must be an exported American price such as -110 or 150.'};
  if(Number.isNaN(line))return {error:label+': line must be the exported number.'};
  if(row.book!==undefined&&row.book!==null&&row.book!==''&&String(row.book).toLowerCase()!==BOOK)return {error:label+': book must be '+BOOK+'.'};
  const isBook=q=>String(q.bookmaker||BOOK)===BOOK,missing={error:label+': not found in the export (check line, price, side, and name).'},lower=v=>String(v||'').trim().toLowerCase(),samePlayer=q=>normPlayerName_(q.player)===normPlayerName_(subject)&&normPlayerName_(subject)!=='';
  // The market consensus at logging time travels with the candidate (blank when absent).
  const sidePricing=(q,canonicalSide)=>{const p=q.pricing||{};return (CANDIDATE_GAME_MARKETS.indexOf(key)>=0||/_alternate$/.test(key)?p:canonicalSide==='Over'?p.over:p.under)||{};};
  const done=(q,canonicalSubject,team,canonicalSide)=>{const p=sidePricing(q,canonicalSide),v=x=>typeof x==='number'?x:'';
    return {quote:{subject:canonicalSubject,team:team,side:canonicalSide,line:line===null?'':line,price:price,book:String(q.bookmaker||BOOK),books_at_line:v(p.books_at_line),consensus_no_vig_pct:v(p.consensus_no_vig_pct),price_gap_pp:v(p.price_gap_pp)}};};
  if(CANDIDATE_GAME_MARKETS.indexOf(key)>=0){
    const rows=(g.game_markets||[]).filter(q=>isBook(q)&&q.market_key===key&&Number(q.price)===price);
    if(key==='totals'){const q=rows.find(q=>lower(q.selection)===lower(side)&&Number(q.line)===line);return q?done(q,'Total','',String(q.selection)):missing;}
    if(lower(subject)!==lower(side))return {error:label+': for '+key+' the subject and side must both be the team name.'};
    const q=rows.find(q=>lower(q.selection)===lower(side)&&(key==='h2h'?line===null:Number(q.line)===line));
    return q?done(q,String(q.selection),String(q.selection),String(q.selection)):missing;
  }
  if(lower(side)!=='over'&&lower(side)!=='under')return {error:label+': side must be Over or Under.'};
  const canonicalSide=lower(side)==='over'?'Over':'Under';
  if(/_alternate$/.test(key)){
    if(MOBILE_ALTERNATE_MARKETS.indexOf(key)<0)return {error:label+': market_key is not a supported export market.'};
    const q=(g.alternate_prop_markets||[]).find(q=>isBook(q)&&q.market_key===key&&samePlayer(q)&&Number(q.line)===line&&lower(q.side)===lower(side)&&Number(q.price)===price);
    return q?done(q,String(q.player),String(q.team||candidatePlayerTeam_(g,q.player)),canonicalSide):missing;
  }
  if(PROP_MARKETS.indexOf(key)<0)return {error:label+': market_key is not a supported export market.'};
  const q=(g.prop_markets||[]).find(q=>isBook(q)&&q.market_key===key&&samePlayer(q)&&Number(q.line)===line&&Number(canonicalSide==='Over'?q.over_price:q.under_price)===price);
  return q?done(q,String(q.player),String(q.team||candidatePlayerTeam_(g,q.player)),canonicalSide):missing;
}
function candidateFixRequest_(snapshotId,errors) {
  return 'Your '+CANDIDATE_BLOCK+' block'+(snapshotId?' for snapshot '+snapshotId:'')+' was rejected for these reasons:\n'+errors.map(e=>'- '+e).join('\n')+
    '\n\nRe-send only a corrected '+CANDIDATE_BLOCK+' block. Use only exact quotes from the compact game files and do not change your analysis.';
}
// Validate a pasted AI answer. Nothing is written unless every check passes.
function validateCandidateImport_(text) {
  const parsed=extractCandidateBlock_(text);if(parsed.error)return {errors:[parsed.error]};
  const block=parsed.value||{},snap=candidateSnapshot_(block.snapshot_id);if(snap.error)return {errors:[snap.error]};
  const rows=Array.isArray(block.rows)?block.rows:null;if(!rows||!rows.length)return {snapshot:snap.id,errors:['The block has no rows.']};
  const errors=[],accepted=[],seen={},perEvent={},notes={};
  (Array.isArray(block.game_notes)?block.game_notes:[]).forEach(n=>{if(n&&String(n.reason||'').trim())notes[String(n.event_id||'')]=String(n.reason).trim().slice(0,300);});
  rows.forEach((row,i)=>{
    row=row||{};const eventId=String(row.event_id||''),entry=snap.games[eventId],where='Row '+(i+1)+' ('+eventId+')';
    if(!entry){errors.push(where+': event_id is not in this export.');return;}
    if(!entry.eligible){errors.push(eventId+' is not eligible for analysis in this export; remove its rows.');return;}
    const classification=String(row.classification||'').trim().toUpperCase(),condition=String(row.condition||'').trim(),reason=String(row.reason||'').trim();
    if(CANDIDATE_CLASSES.indexOf(classification)<0){errors.push(where+': classification must be one of '+CANDIDATE_CLASSES.join(', ')+'.');return;}
    if(classification==='CONDITIONAL'&&!condition){errors.push(where+': CONDITIONAL rows need a condition.');return;}
    if(!reason){errors.push(where+': reason is required.');return;}
    const found=candidateQuote_(entry,row);if(found.error){errors.push(found.error);return;}
    const q=found.quote,identity=[snap.id,eventId,String(row.market_key).trim(),normPlayerName_(q.subject)||q.subject.toLowerCase(),q.side.toLowerCase(),q.line].join('|');
    if(seen[identity]){errors.push(where+': duplicate row for the same quote.');return;}
    seen[identity]=true;perEvent[eventId]=(perEvent[eventId]||0)+1;
    const gameInfo=entry.game.game||{};
    accepted.push({identity:identity,eventId:eventId,matchup:String(entry.event.matchup||gameInfo.matchup||''),kickoff:String(entry.event.kickoff_utc||gameInfo.kickoff_utc||''),home:String(gameInfo.home_team||''),away:String(gameInfo.away_team||''),
      market:String(row.market_key).trim(),quote:q,classification:classification,condition:condition.slice(0,300),reason:reason.slice(0,300)});
  });
  Object.keys(snap.games).forEach(eventId=>{
    if(!snap.games[eventId].eligible)return;const n=perEvent[eventId]||0;
    if(n>5)errors.push(eventId+' has more than 5 rows; log exactly the five candidates from its game table.');
    else if(n<5&&!notes[eventId]&&!errors.some(e=>e.indexOf(eventId)>=0))errors.push(eventId+' has '+n+' rows; each eligible game needs 5 rows or a game_notes reason.');
  });
  return {snapshot:snap.id,errors:errors,rows:accepted};
}
function importCandidates_(text) {
  if(!CANDIDATE_LOG_ENABLED)fail_('Candidate log is not enabled in this app.');
  const checked=validateCandidateImport_(text);
  if(checked.errors.length){const errors=checked.errors.slice(0,25);return {ok:false,snapshot_id:checked.snapshot||'',errors:errors,fix_request:candidateFixRequest_(checked.snapshot,errors)};}
  return run_('Candidate import',()=>{
    const s=ensureTrackerSheet_(TAB_CANDIDATES,CANDIDATE_HEADERS),existing=read_(TAB_CANDIDATES,CANDIDATE_HEADERS.length),latest={};
    existing.forEach(r=>{const id=String(r[0]),rev=Number(r[1]);if(!latest[id]||rev>latest[id].revision)latest[id]={revision:rev,hash:String(r[19])};});
    const time=now_(),nowMs=Date.parse(time),out=[];let unchanged=0,revised=0,postKickoff=0;
    checked.rows.forEach(c=>{
      const id='C-'+candidateHash_(c.identity),hash='H-'+candidateHash_([c.classification,c.condition,c.reason,c.quote.price].join('|')),prior=latest[id];
      if(prior&&prior.hash===hash){unchanged++;return;}
      const kickoff=Date.parse(c.kickoff),timing=Number.isFinite(kickoff)&&nowMs<kickoff?'PRE_KICKOFF':'POST_KICKOFF';
      if(prior)revised++;if(timing==='POST_KICKOFF')postKickoff++;
      latest[id]={revision:prior?prior.revision+1:1,hash:hash};
      out.push([id,latest[id].revision,prior?prior.revision:'',checked.snapshot,c.eventId,c.matchup,c.kickoff,c.market,c.quote.subject,c.quote.team,c.quote.side,c.quote.line,c.quote.price,c.quote.book,c.classification,c.condition,c.reason,time,timing,hash,c.quote.books_at_line,c.quote.consensus_no_vig_pct,c.quote.price_gap_pp,c.home,c.away]);
    });
    if(out.length)s.getRange(existing.length+2,1,out.length,CANDIDATE_HEADERS.length).setValues(out.map(r=>r.map(cell_)));
    log_('Candidate import',checked.snapshot,'SUCCESS',out.length+' saved ('+revised+' revised, '+postKickoff+' after tipoff), '+unchanged+' unchanged; zero Odds API credits',0);
    return {ok:true,snapshot_id:checked.snapshot,saved:out.length,revised:revised,unchanged:unchanged,post_kickoff:postKickoff};
  });
}
function mobileImportCandidates(text) {return importCandidates_(String(text||'').slice(0,400000));}
function candidateLogStatus_(latest) {
  if(!CANDIDATE_LOG_ENABLED)return {enabled:false};
  const snapshotId=latest&&latest.snapshot_id||'',out={enabled:true,snapshot_id:snapshotId,logged:false,rows:0};
  if(!snapshotId)return out;
  try{
    const sheet=spreadsheet_().getSheetByName(TAB_CANDIDATES);if(!sheet||sheet.getLastRow()<2)return out;
    const ids={};sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().forEach(r=>{if(String(r[3])===snapshotId)ids[String(r[0])]=true;});
    out.rows=Object.keys(ids).length;out.logged=out.rows>0;
  }catch(ignore){}
  return out;
}
function candidateRecords_() {
  return read_(TAB_CANDIDATES,CANDIDATE_HEADERS.length).map(r=>({id:String(r[0]),revision:Number(r[1]),snapshot:String(r[3]),eventId:String(r[4]),matchup:String(r[5]),kickoff:cellText_(r[6]),market:String(r[7]),subject:String(r[8]),team:String(r[9]),side:String(r[10]),line:r[11],price:Number(r[12]),classification:String(r[14]),timing:String(r[18]),gap:r[22]===''||r[22]===null||r[22]===undefined?null:Number(r[22]),home:String(r[23]||''),away:String(r[24]||'')}));
}
function candidateResults_() {
  const latest={};read_(TAB_CANDIDATE_RESULTS,CANDIDATE_RESULT_HEADERS.length).forEach(r=>{latest[String(r[0])+'|'+Number(r[1])]={result:String(r[2]),stat:r[3]};});return latest;
}
// The latest pre-tipoff revision of each candidate that still needs a final result.
function candidatesToGrade_() {
  const chosen={},results=candidateResults_();
  candidateRecords_().forEach(c=>{if(!c.id||c.timing!=='PRE_KICKOFF')return;if(!chosen[c.id]||c.revision>chosen[c.id].revision)chosen[c.id]=c;});
  return Object.keys(chosen).map(id=>chosen[id]).filter(c=>{if(c.classification==='UNASSESSED')return false;const r=results[c.id+'|'+c.revision];return !r||r.result==='UNRESOLVED';});
}
// The final box score of one game: both teams' rows on the tipoff date
// (Eastern). hoopR publishes a game only once it is final.
function nbaFinalGame_(box,home,away,kickoffUtc) {
  const dateKey=Utilities.formatDate(new Date(Date.parse(kickoffUtc)),'America/New_York','yyyy-MM-dd');
  const rows=box.rows.filter(r=>r.game_date===dateKey&&(String(r.team_display_name)===home||String(r.team_display_name)===away));
  const ids=[...new Set(rows.map(r=>r.game_id))];
  if(ids.length!==1)return null;
  const gameRows=rows.filter(r=>r.game_id===ids[0]),homeRow=gameRows.find(r=>String(r.team_display_name)===home),awayRow=gameRows.find(r=>String(r.team_display_name)===away);
  if(!homeRow||!awayRow)return null;
  const homeScore=usageNumber_(homeRow.team_score),awayScore=usageNumber_(awayRow.team_score);
  if(homeScore===null||awayScore===null)return null;
  return {game_id:ids[0],date:dateKey,home:home,away:away,home_score:homeScore,away_score:awayScore,rows:gameRows};
}
function gradeTeamSelection_(c,game) {
  const line=Number(c.line);
  if(c.market==='totals'){
    const total=game.home_score+game.away_score,side=String(c.side).toLowerCase();if(!Number.isFinite(line)||(side!=='over'&&side!=='under'))return {error:'BAD_TOTAL_ROW'};
    return {stat:total,result:total===line?'PUSH':((side==='over')===(total>line)?'WIN':'LOSS'),detail:'final total '+total+' versus '+c.side+' '+line};
  }
  const team=String(c.side),isHome=team===game.home,isAway=team===game.away;if(!isHome&&!isAway)return {error:'TEAM_NOT_IN_GAME: '+team};
  const mine=isHome?game.home_score:game.away_score,theirs=isHome?game.away_score:game.home_score;
  if(c.market==='h2h')return {stat:mine+'-'+theirs,result:mine===theirs?'PUSH':mine>theirs?'WIN':'LOSS',detail:team+' '+mine+'-'+theirs+' moneyline'};
  if(!Number.isFinite(line))return {error:'BAD_SPREAD_ROW'};
  const adjusted=mine+line;return {stat:mine+'-'+theirs,result:adjusted===theirs?'PUSH':adjusted>theirs?'WIN':'LOSS',detail:team+' '+mine+'-'+theirs+' with '+line};
}
const NBA_STAT_FOR_MARKET = {player_points:['points'],player_rebounds:['rebounds'],player_assists:['assists'],player_threes:['three_point_field_goals_made'],player_points_rebounds_assists:['points','rebounds','assists']};
// One selection (market, subject, side, line) against a final game. Shared by AI
// picks and logged bets so both settle the same way. A player missing from the
// box score is UNRESOLVED for a manual check, never guessed.
function settleSelection_(c,game) {
  if(CANDIDATE_GAME_MARKETS.indexOf(c.market)>=0)return {settlement:gradeTeamSelection_(c,game),playerId:''};
  const base=String(c.market).replace(/_alternate$/,''),cols=NBA_STAT_FOR_MARKET[base];if(!cols)return {settlement:{error:'MARKET_NOT_GRADED: '+c.market},playerId:''};
  const matches=game.rows.filter(r=>normPlayerName_(r.athlete_display_name)===normPlayerName_(c.subject)),ids=[...new Set(matches.map(r=>String(r.athlete_id)))];
  if(!ids.length)return {settlement:{error:'PLAYER_NOT_IN_BOX_SCORE: '+c.subject},playerId:''};
  if(ids.length>1)return {settlement:{error:'AMBIGUOUS_PLAYER_NAME: '+c.subject},playerId:''};
  const r=matches[0];
  // DraftKings gives no action on a player prop when the player does not play.
  if(usageBool_(r.did_not_play)||!r.played)return {settlement:{stat:'',result:'VOID',detail:'did not play'+(r.reason?' ('+r.reason+')':'')+'; player props have no action'},playerId:String(r.athlete_id)};
  const values=cols.map(col=>usageNumber_(r[col]));if(values.some(v=>v===null))return {settlement:{error:'STAT_MISSING: '+cols.join('+')},playerId:String(r.athlete_id)};
  const stat=values.reduce((a,b)=>a+b,0),line=Number(c.line),side=String(c.side).toLowerCase();
  if(!Number.isFinite(line)||(side!=='over'&&side!=='under'))return {settlement:{error:'BAD_PROP_ROW'},playerId:String(r.athlete_id)};
  return {settlement:{stat:stat,result:stat===line?'PUSH':((side==='over')===(stat>line)?'WIN':'LOSS'),detail:base+' '+stat+' versus '+c.side+' '+line},playerId:String(r.athlete_id)};
}
function candidateSeason_(c) {return nbaSeasonEndYear_(Date.parse(c.kickoff));}
// Grades every pending candidate whose game is final in the box score file.
// A game not yet published is left pending, never forced.
function gradeCandidates_(boxBySeason) {
  if(!CANDIDATE_LOG_ENABLED)fail_('Candidate log is not enabled in this app.');
  return run_('Candidate grading',()=>{
    const now=Date.now(),pending=candidatesToGrade_().filter(c=>{const k=Date.parse(c.kickoff);return Number.isFinite(k)&&k<now-3*3600000;});
    const resultSheet=ensureTrackerSheet_(TAB_CANDIDATE_RESULTS,CANDIDATE_RESULT_HEADERS),time=now_(),out=[],boxes=boxBySeason||{};let graded=0,unresolved=0,notFinal=0;
    pending.forEach(c=>{
      const season=candidateSeason_(c);if(!boxes[season])boxes[season]=nbaLoadBoxScores_(season);
      const box=boxes[season],game=nbaFinalGame_(box,c.home,c.away,c.kickoff);if(!game){notFinal++;return;}
      const settled=settleSelection_(c,game),s=settled.settlement;
      if(s.error){unresolved++;out.push([c.id,c.revision,'UNRESOLVED','',settled.playerId,box.source.last_game_date_in_file,time,'game '+game.game_id+'; '+s.error]);return;}
      graded++;out.push([c.id,c.revision,s.result,s.stat,settled.playerId,box.source.last_game_date_in_file,time,'game '+game.game_id+'; '+s.detail]);
    });
    if(out.length)resultSheet.getRange(resultSheet.getLastRow()+1,1,out.length,CANDIDATE_RESULT_HEADERS.length).setValues(out.map(r=>r.map(cell_)));
    const summary=writeCandidateSummary_();
    log_('Candidate grading','','SUCCESS',graded+' graded, '+unresolved+' unresolved, '+notFinal+' not final yet; hoopR box scores; zero Odds API credits',0);
    return {graded:graded,unresolved:unresolved,not_final:notFinal,summary:summary};
  });
}
function mobileGradeCandidates() {return gradeCandidates_();}
function mobileCandidateSummary() {if(!CANDIDATE_LOG_ENABLED)fail_('Candidate log is not enabled in this app.');return computeCandidateSummary_();}
// Market consensus gap at logging time; a reference split, not a forecast.
function candidateGapBand_(gap) {
  if(gap===null||!Number.isFinite(gap))return 'No consensus';
  return gap>=2?'DK +2 pp or more vs market':gap>0?'DK 0 to +2 pp vs market':gap>-2?'DK 0 to -2 pp vs market':'DK -2 pp or worse vs market';
}
function candidatePriceBand_(price) {
  const p=Number(price);
  if(p<=-300)return '-300 or shorter';if(p<=-200)return '-299 to -200';if(p<=-150)return '-199 to -150';if(p<0)return '-149 to -100';
  if(p<150)return '+100 to +149';if(p<300)return '+150 to +299';return '+300 or longer';
}
function candidateSideGroup_(c) {return CANDIDATE_GAME_MARKETS.indexOf(c.market)>=0&&c.market!=='totals'?'Team':c.side;}
// Results joined to the exact graded revision. Flat 1 unit at the logged
// price; no probabilities or confidence labels are produced.
function computeCandidateSummary_() {
  const results=candidateResults_(),graded=[];
  candidateRecords_().forEach(c=>{const r=results[c.id+'|'+c.revision];if(r&&r.result!=='UNRESOLVED')graded.push({c:c,result:r.result});});
  const groups=[],add=(type,keyOf)=>{
    const by={};graded.forEach(g=>{const key=keyOf(g.c);(by[key]||(by[key]=[])).push(g);});
    Object.keys(by).sort().forEach(key=>{
      const list=by[key],count=r=>list.filter(g=>g.result===r).length,wins=count('WIN'),losses=count('LOSS');
      const units=money_(list.reduce((sum,g)=>sum+(g.result==='WIN'?americanToDecimal_(g.c.price)-1:g.result==='LOSS'?-1:0),0)),kickoffs=list.map(g=>g.c.kickoff).sort();
      groups.push({type:type,group:key,graded:list.length,wins:wins,losses:losses,pushes:count('PUSH'),voids:count('VOID'),hit_rate:wins+losses?Math.round(wins/(wins+losses)*1000)/1000:null,units:units,units_per_bet:money_(units/list.length),first_kickoff_utc:kickoffs[0],last_kickoff_utc:kickoffs[kickoffs.length-1]});
    });
  };
  add('All',()=>'All graded candidates');add('Classification',c=>c.classification);add('Market',c=>c.market);add('Side',candidateSideGroup_);add('Price band',c=>candidatePriceBand_(c.price));add('Price gap vs market',c=>candidateGapBand_(c.gap));
  const kickoffs=graded.map(g=>g.c.kickoff).sort();
  return {graded:graded.length,first_kickoff_utc:kickoffs[0]||'',last_kickoff_utc:kickoffs[kickoffs.length-1]||'',groups:groups};
}
function writeCandidateSummary_() {
  const s=computeCandidateSummary_(),headers=['NBA CANDIDATE RESULTS','Coverage: '+(s.first_kickoff_utc||'none')+' to '+(s.last_kickoff_utc||'none'),'Graded candidates: '+s.graded,'Flat 1 unit at the logged price; sample sizes shown; no probabilities.','','','','','','','',''];
  const rows=[['Group Type','Group','Graded','Wins','Losses','Pushes','Voids','Hit Rate','Units','Units per Bet','First Tipoff UTC','Last Tipoff UTC']].concat(s.groups.map(g=>[g.type,g.group,g.graded,g.wins,g.losses,g.pushes,g.voids,g.hit_rate===null?'':g.hit_rate,g.units,g.units_per_bet,g.first_kickoff_utc,g.last_kickoff_utc]));
  write_(TAB_CANDIDATE_SUMMARY,headers,rows);return s;
}
