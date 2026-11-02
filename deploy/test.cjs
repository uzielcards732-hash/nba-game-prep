'use strict';
// Deploy button checks. Offline only: no Google calls, no credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const d=require('./deploy.cjs'),root=path.resolve(__dirname,'..');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(error){failures.push(name);console.log('FAIL '+name+'\n     '+String(error&&error.message||error).split('\n')[0]);}}
const workflow=fs.readFileSync(path.join(root,'.github','workflows','deploy-nba.yml'),'utf8');
function tmpDir(files){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deploy-test-'));Object.entries(files).forEach(([f,c])=>fs.writeFileSync(path.join(dir,f),c));return dir;}
const three={'NbaOddsLoader.gs':'a','Mobile.html':'c','appsscript.json':'{}'};

test('the live version is read from the NBA deployment only, and must be a numbered version',()=>{
 const list=[{deploymentId:'HEAD_ID',versionNumber:undefined},{deploymentId:'AKfyNba',versionNumber:13},{deploymentId:'other',versionNumber:12}];
 assert.equal(d.liveVersion(list,'AKfyNba'),13);
 assert.throws(()=>d.liveVersion(list,'missing'),/not found/);assert.throws(()=>d.liveVersion(list,'HEAD_ID'),/numbered version/);
});
test('the next version is one above the highest existing version',()=>{
 assert.equal(d.nextVersion([{versionNumber:12},{versionNumber:13},{versionNumber:11}]),14);assert.equal(d.nextVersion([]),1);
});
test('live code must match the expected commit byte for byte, with no extra files',()=>{
 const a=tmpDir(three),b=tmpDir(three);assert.deepEqual(d.compareDirs(a,b),{match:true,problems:[]});
 fs.writeFileSync(path.join(a,'Mobile.html'),'c ');let r=d.compareDirs(a,b);assert.equal(r.match,false);assert.match(r.problems.join(),/Mobile.html differs/);
 fs.writeFileSync(path.join(a,'Mobile.html'),'c');fs.unlinkSync(path.join(a,'appsscript.json'));r=d.compareDirs(a,b);assert.match(r.problems.join(),/appsscript.json is missing from the live project/);
 fs.writeFileSync(path.join(a,'appsscript.json'),'{}');fs.writeFileSync(path.join(a,'Scratch.gs'),'x');fs.writeFileSync(path.join(a,'.clasp.json'),'{}');r=d.compareDirs(a,b);assert.deepEqual(r.problems,['Scratch.gs exists live but is not in the repo']);
});
test('the build ID and deployment ID are read from the loader',()=>{
 const loader=path.join(root,'outputs','NbaOddsLoader.gs');
 assert.match(d.buildId(loader),/^\d{4}\.\d\d\.\d\d-nba-/);assert.match(d.deploymentId(loader),/^AKfy[A-Za-z0-9_-]{40,}$/);
 assert.doesNotMatch(workflow,/AKfy/,'the deployment ID lives in one place, the source');
});
test('the shared library pin stays NBA only: never version 1, never development mode',()=>{
 assert.equal(d.libraryPin(path.join(root,'outputs','appsscript.json')),'2');
 const bad=v=>{const dir=tmpDir({'a.json':JSON.stringify({dependencies:{libraries:[Object.assign({userSymbol:'SharedNFL',libraryId:'x',version:'2',developmentMode:false},v)]}})});return path.join(dir,'a.json');};
 assert.throws(()=>d.libraryPin(bad({version:'1'})),/NFL version/);assert.throws(()=>d.libraryPin(bad({developmentMode:true})),/development mode/);
 assert.match(workflow,/node deploy\/deploy\.cjs library-pin outputs\/appsscript\.json/);
});
test('the workflow runs only when the owner presses it, and only for the NBA app',()=>{
 assert.match(workflow,/^on:\n  workflow_dispatch:/m);assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule|workflow_run):/m);
 assert.match(workflow,/if: github\.triggering_actor == github\.repository_owner/);
 assert.match(workflow,/\[ "\$CONFIRM" != "deploy now" \]/);assert.match(workflow,/default: check/);
 assert.match(workflow,/cancel-in-progress: false/);assert.doesNotMatch(workflow,/nfl-game-prep|friends-app|shared-admin|personal-v/i);
 assert.match(workflow,/TAG="nba-v\$/);
});
test('the Google sign-in and script ID come only from secrets, and are never printed',()=>{
 const secrets=workflow.match(/secrets\.[A-Z_]+/g)||[];assert.deepEqual([...new Set(secrets)].sort(),['secrets.CLASPRC_JSON','secrets.NBA_SCRIPT_ID']);
 assert.equal(secrets.filter(s=>s==='secrets.CLASPRC_JSON').length,1,'the sign-in is used in exactly one step');
 assert.match(workflow,/umask 077/);assert.doesNotMatch(workflow,/echo "?\$(CLASPRC_JSON|NBA_SCRIPT_ID)|cat .*clasprc/);
 assert.match(workflow,/@google\/clasp@\$\{CLASP_VERSION\}/);assert.match(workflow,/CLASP_VERSION: 3\.4\.1/);
});
test('free text inputs reach the shell only through environment variables',()=>{
 ['confirm','rollback_version','live_commit'].forEach(name=>{
  workflow.split('\n').filter(l=>l.includes('${{ inputs.'+name+' }}')).forEach(l=>assert.match(l,/^\s+[A-Z_]+: \$\{\{ inputs\./,l));
 });
});
test('every offline suite runs before anything is pushed: CLAUDE.md lists them all and the workflow runs that list',()=>{
 const listed=new Set([...fs.readFileSync(path.join(root,'CLAUDE.md'),'utf8').matchAll(/`node ([\w\-\/]+\.cjs)`/g)].map(m=>m[1]));
 const suites=fs.readdirSync(path.join(root,'outputs')).filter(f=>/^test.*\.cjs$/.test(f)).map(f=>'outputs/'+f);
 assert.ok(suites.length>=9,suites.join());suites.forEach(f=>assert.ok(listed.has(f),f+' is missing from the CLAUDE.md suite list'));
 assert.ok(listed.has('deploy/test.cjs'));
 assert.match(workflow,/grep -oE '`node \[A-Za-z0-9_\.\/-\]\+\\\.cjs`' CLAUDE\.md/);assert.match(workflow,/echo "node deploy\/test\.cjs"/);
 assert.ok(workflow.indexOf('name: Run every offline test suite')<workflow.indexOf('clasp push --force'));
});
test('a deploy is checked before and after, tagged, and rollback does not depend on live code matching',()=>{
 const at=s=>{const i=workflow.indexOf(s);assert.ok(i>=0,s);return i;};
 assert.ok(at('name: Confirm live code matches')<at('name: Deploy this commit'));
 assert.ok(at('name: Deploy this commit')<at('name: Verify after the change'));
 assert.ok(at('name: Verify after the change')<at('name: Tag the new version'));
 assert.match(workflow,/name: Confirm live code matches[^\n]*\n\s+if: inputs\.mode != 'rollback'/);
 assert.match(workflow,/git checkout "\$TAG" -- outputs\/NbaOddsLoader\.gs outputs\/Mobile\.html outputs\/appsscript\.json/);
 assert.match(workflow,/Something stopped partway/);assert.match(workflow,/Stopped before anything changed/);assert.match(workflow,/Only a bookkeeping step after it failed/);
 assert.match(workflow,/already records this commit/);assert.match(workflow,/already exists for a different commit/);
});
test('clasp only ever pushes the three allowlisted files',()=>{
 const ignore=fs.readFileSync(path.join(root,'.claspignore'),'utf8').split('\n').map(s=>s.trim()).filter(Boolean);
 assert.deepEqual(ignore,['**/**','!appsscript.json','!NbaOddsLoader.gs','!Mobile.html']);
 assert.match(workflow,/"rootDir":"outputs"/);assert.deepEqual(d.FILES.slice().sort(),['Mobile.html','NbaOddsLoader.gs','appsscript.json']);
});

console.log('\n'+count+' passed, '+failures.length+' failed (deploy button; offline only).');
if(failures.length)process.exitCode=1;
