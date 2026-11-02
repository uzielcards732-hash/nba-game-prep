'use strict';
// Helper for .github/workflows/deploy-nba.yml. Pure checks only: it never
// calls Google, never reads credentials, and never changes anything. Each
// subcommand prints one plain line and exits 1 when the deploy must stop.
const fs=require('node:fs'),path=require('node:path');

const FILES=['NbaOddsLoader.gs','Mobile.html','appsscript.json'];

// The NBA app has no scheduled trigger, so there is no clock window to guard.
// The one timing risk is a background load already running, because its
// continuation trigger runs HEAD; the owner confirms none is running.
function liveVersion(deployments,deploymentId){
 const d=(deployments||[]).find(x=>x&&x.deploymentId===deploymentId);
 if(!d)throw Error('Stopped: the NBA web app deployment was not found in this Apps Script project.');
 const v=Number(d.versionNumber);if(!Number.isInteger(v)||v<1)throw Error('Stopped: the NBA web app deployment is not pinned to a numbered version.');
 return v;
}
function nextVersion(versions){
 const nums=(versions||[]).map(v=>Number(v&&v.versionNumber)).filter(n=>Number.isInteger(n)&&n>0);
 return nums.length?Math.max.apply(null,nums)+1:1;
}
// Byte compare of the three deployable files. Anything extra in the live
// project also stops the deploy, because a push would silently remove it.
function compareDirs(liveDir,expectedDir){
 const problems=[],live=fs.readdirSync(liveDir).filter(f=>!f.startsWith('.'));
 FILES.forEach(f=>{
  const a=path.join(liveDir,f),b=path.join(expectedDir,f);
  if(!fs.existsSync(a))problems.push(f+' is missing from the live project');
  else if(!fs.existsSync(b))problems.push(f+' is missing from the expected commit');
  else if(!fs.readFileSync(a).equals(fs.readFileSync(b)))problems.push(f+' differs');
 });
 live.filter(f=>FILES.indexOf(f)<0).forEach(f=>problems.push(f+' exists live but is not in the repo'));
 return {match:!problems.length,problems};
}
function buildId(file){const m=/const MOBILE_APP_BUILD = '([^']+)';/.exec(fs.readFileSync(file,'utf8'));return m?m[1]:'unknown';}
// The web app deployment ID is read from the app's own link in the source, so
// there is one place to change it.
function deploymentId(file){
 const m=/const MOBILE_WEB_APP_URL = 'https:\/\/script\.google\.com\/macros\/s\/(AKfy[A-Za-z0-9_-]+)\/exec';/.exec(fs.readFileSync(file,'utf8'));
 if(!m)throw Error('Stopped: the web app link is missing from NbaOddsLoader.gs.');return m[1];
}
// The manifest must keep NBA on its own shared library version; NFL and
// Friends pin version 1 and must never be moved by an NBA deploy.
function libraryPin(file){
 const lib=((JSON.parse(fs.readFileSync(file,'utf8')).dependencies||{}).libraries||[]).find(l=>l.userSymbol==='SharedNFL');
 if(!lib)throw Error('Stopped: the shared key library is missing from appsscript.json.');
 if(String(lib.version)==='1')throw Error('Stopped: NBA must not pin shared library version 1; that is the NFL version.');
 if(lib.developmentMode!==false)throw Error('Stopped: the shared library must not use development mode.');
 return String(lib.version);
}

module.exports={FILES,liveVersion,nextVersion,compareDirs,buildId,deploymentId,libraryPin};

if(require.main===module){
 const [cmd,...args]=process.argv.slice(2);
 try{
  if(cmd==='live-version'){console.log(liveVersion(JSON.parse(fs.readFileSync(args[0],'utf8')),args[1]));process.exit(0);}
  if(cmd==='next-version'){console.log(nextVersion(JSON.parse(fs.readFileSync(args[0],'utf8'))));process.exit(0);}
  if(cmd==='compare'){const r=compareDirs(args[0],args[1]),label=args[2]||'live code';console.log(r.match?label+' matches the expected commit byte for byte.':'Stopped: '+label+' does not match the expected commit: '+r.problems.join('; ')+'.');process.exit(r.match?0:1);}
  if(cmd==='build-id'){console.log(buildId(args[0]));process.exit(0);}
  if(cmd==='deployment-id'){console.log(deploymentId(args[0]));process.exit(0);}
  if(cmd==='library-pin'){console.log('Shared library pinned to version '+libraryPin(args[0])+' (NFL keeps version 1).');process.exit(0);}
  console.error('Unknown command: '+cmd);process.exit(2);
 }catch(e){console.log(e.message);process.exit(1);}
}
