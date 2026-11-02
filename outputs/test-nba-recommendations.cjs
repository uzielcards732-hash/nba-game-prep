const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'Mobile.html'), 'utf8');
const controller = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const build = controller.match(/var APP_BUILD='([^']+)'/)[1];
let checks = 0;
async function test(name, run) {
  await run(); checks++; console.log('PASS ' + name);
}

// Execute the unchanged active controller and press its real result/share buttons.
// Every server bridge is read-only and unexpected calls fail the test.
function mobile(mode = 'native', overrides = {}) {
  const elements = {}, shared = [], copied = [], opened = [], calls = [];
  const latest = {filename: 'audit-snapshot.json', drive_url: 'https://drive.test/audit',
    event_ids: ['nba-event-1', 'nba-event-2'], export_timestamp_utc: new Date().toISOString(),
    analysis_manifest_filename: 'manifest-snapshot.json',
    analysis_manifest_drive_url: 'https://drive.test/manifest-snapshot', app_build: build,
    provider_coverage_summary: 'The Odds API; SportsGameOdds disabled', ...overrides};
  function el(id) {
    return elements[id] ||= {id, innerHTML: '', textContent: '', className: '',
      getElementsByTagName() {return [];}, getElementsByClassName() {return [];}};
  }
  const bridge = new Proxy({
    withSuccessHandler(ok) {this.ok = ok; return this;},
    withFailureHandler(fail) {this.fail = fail; return this;},
    mobileDashboard() {calls.push('dashboard'); this.ok({app_build: build,
      games: [], slates: [], operation: null, last_export: latest});},
    mobileKeyPoolStatus() {calls.push('cached-keys'); this.ok({slots: []});}
  }, {get(target, key) {
    if (key in target) return target[key];
    throw Error('Unexpected endpoint/provider call: ' + String(key));
  }});
  const navigator = {standalone: true};
  if (mode === 'native' || mode === 'share-failure') navigator.share = payload => {
    if (mode === 'share-failure') return Promise.reject(Error('Sharing unavailable'));
    shared.push(payload); return Promise.resolve();
  };
  if (mode !== 'legacy-clipboard') navigator.clipboard = {
    writeText(value) {
      if (mode === 'clipboard-failure') return Promise.reject(Error('Permission denied'));
      copied.push(value); return Promise.resolve();
    }
  };
  let textarea;
  const document = {getElementById: el, querySelector: () => ({href: 'icon'}),
    createElement: () => (textarea = {style: {}, select() {}}),
    body: {appendChild() {}, removeChild() {}},
    execCommand(command) {assert.equal(command, 'copy'); copied.push(textarea.value); return true;}};
  const window = {google: {script: {run: bridge}}, navigator,
    localStorage: {getItem: () => null, removeItem() {}},
    matchMedia: () => ({matches: false}), scrollTo() {},
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    open: url => opened.push(url)};
  vm.runInNewContext(controller, {window, document, navigator,
    google: window.google, Date, Intl, Math, console});
  el('continue-export').onclick();
  return {el, shared, copied, opened, calls, latest};
}
async function pressShare(ui, destination) {
  ui.el('choose-analysis').onclick();
  ui.el('share-' + destination.toLowerCase()).onclick();
  await new Promise(resolve => setImmediate(resolve));
}
function checkPayload(request, latest) {
  for (const value of [latest.analysis_manifest_filename, latest.analysis_manifest_drive_url,
    latest.export_timestamp_utc, ...latest.event_ids]) assert.ok(request.includes(value), value);
  for (const rule of [
    'proof of mispricing and the absence of normal betting uncertainty are not required',
    'generic possibilities such as blowouts, missed shots or a different game script cannot automatically veto',
    'Preseason performances, historical averages and points-per-minute arithmetic are context',
    'easier thresholds and shorter prices are not automatically better or worse',
    'RECOMMENDED: completed research provides a credible overall case',
    'CONDITIONAL: the case is supported subject to a named material injury, role or price condition',
    'UNASSESSED: material research is incomplete; identify the missing evidence',
    'working source links', 'up to ten distinct RECOMMENDED or CONDITIONAL picks only',
    'In game tables, the final shortlist and parlays, format each player name with its verified NBA team abbreviation in parentheses',
    'Shai Gilgeous-Alexander (OKC)',
    "Use the export's verified team mapping or current sourced research",
    'if unresolved, display (team unverified) rather than guessing',
    'This label must not change the exact exported player identity or quote',
    'if only two picks qualify, show two', 'same-game combinations require an actual sportsbook quote',
    'Retry that read-only call at most once', 'SportsGameOdds NBA coverage remains disabled'
  ]) assert.ok(request.includes(rule), rule);
  assert.match(request, /24 hours/);
  assert.match(request, /snapshot IDs/);
  assert.match(request, /fresh eligible alternate rungs/);
  assert.doesNotMatch(request, /distinct final top ten|Finish with a distinct top ten|Reply Continue|ODDS_API_KEY|apiKey=|SECRET_TEST/);
  assert.ok(!request.includes('https://drive.test/audit'), 'Share the manifest, not the full audit');
  assert.ok(!request.includes('\\n'), 'No literal newline escapes');
}

async function main() {
  for (const destination of ['ChatGPT', 'Claude', 'Perplexity']) {
    let expected;
    await test(destination + ': real Share button, exact manifest and common policy', async () => {
      const ui = mobile(); await pressShare(ui, destination);
      assert.equal(ui.shared.length, 1); expected = ui.shared[0].text;
      checkPayload(expected, ui.latest);
      assert.deepEqual(ui.calls, ['cached-keys', 'dashboard']);
    });
    for (const mode of ['clipboard', 'share-failure', 'legacy-clipboard', 'clipboard-failure']) {
      await test(destination + ': ' + mode + ' keeps the same complete request', async () => {
        const ui = mobile(mode); await pressShare(ui, destination);
        assert.equal(ui.copied.length, 1); checkPayload(ui.copied[0], ui.latest);
        // Ignore only the independently generated fixture timestamp.
        assert.equal(ui.copied[0].replace(ui.latest.export_timestamp_utc, 'UTC'),
          expected.replace(/Export UTC: [^\n]+/, 'Export UTC: UTC'));
        assert.deepEqual(ui.calls, ['cached-keys', 'dashboard']);
        if (destination === 'Perplexity') assert.deepEqual(ui.opened, ['https://www.perplexity.ai/']);
      });
    }
  }
  await test('one-game and missing-manifest/build guards remain intact', async () => {
    const single = mobile('native', {event_ids: ['nba-event-1']});
    await pressShare(single, 'ChatGPT');
    assert.match(single.shared[0].text, /Expected event IDs: nba-event-1\n/);
    for (const invalid of [{analysis_manifest_drive_url: ''}, {app_build: 'unknown-build'}]) {
      const ui = mobile('native', invalid); await pressShare(ui, 'ChatGPT');
      assert.equal(ui.shared.length, 0); assert.ok(ui.el('status').textContent);
    }
  });
  await test('classification/report fixtures encode the agreed judgment standard', async () => {
    // These are contract fixtures, not a forecasting/classification engine or an AI eval.
    const rows = [
      {id: 'normal-uncertainty', status: 'RECOMMENDED', reason: 'Sourced role and matchup support; ordinary missed-shot risk remains.'},
      {id: 'material-condition', status: 'CONDITIONAL', reason: 'Only if the team confirms no minutes restriction.'},
      {id: 'incomplete-research', status: 'UNASSESSED', reason: 'Current rotation evidence is missing.'},
      {id: 'price-concern', status: 'WATCHLIST', reason: 'Available threshold/price tradeoff is unattractive.'},
      {id: 'specific-opposition', status: 'PASS', reason: 'Confirmed role reduction outweighs historical production.'}
    ];
    const ui = mobile(); await pressShare(ui, 'Claude'); const request = ui.shared[0].text;
    assert.ok(request.includes('generic possibilities such as blowouts, missed shots or a different game script cannot automatically veto'));
    assert.ok(request.includes('named material injury, role or price condition'));
    assert.ok(request.includes('UNASSESSED: material research is incomplete'));
    const shortlist = rows.filter(row => ['RECOMMENDED', 'CONDITIONAL'].includes(row.status)).slice(0, 10);
    assert.deepEqual(shortlist.map(row => row.id), ['normal-uncertainty', 'material-condition']);
    assert.equal(shortlist.length, 2);
    assert.ok(request.includes('if only two picks qualify, show two'));
    assert.ok(request.includes('label the report Analysis incomplete rather than giving a no-bet verdict'));
  });
  console.log(checks + ' NBA recommendation handoff checks passed. Zero provider calls. External AI behavior is not tested.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
