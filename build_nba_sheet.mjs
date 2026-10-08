import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = new URL('./build/', import.meta.url).pathname;
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheets = [
  ['INDEX', ['eventId', 'Matchup', 'Kickoff ET', 'Favorite', 'Spread', 'Total', 'Home ML', 'Away ML', 'Home ImpTot', 'Away ImpTot', 'Slate', 'LOAD', 'Props Updated']],
  ['PROPS', ['Player', 'Team', 'Pos', 'Status', 'Points Line', 'Points O', 'Points U', 'Rebounds Line', 'Rebounds O', 'Rebounds U', 'Assists Line', 'Assists O', 'Assists U', 'Threes Line', 'Threes O', 'Threes U', 'PRA Line', 'PRA O', 'PRA U', 'Game', 'Slate', 'Updated', 'Event ID', 'Bookmaker', 'Kickoff UTC', 'Market Source Times JSON', 'Roster Source', 'Roster Source Updated UTC', 'Roster Fetched UTC', 'Join Status', 'Eligibility JSON', 'Validation Notes']],
  ['ALT_PROPS', ['Player', 'Team', 'Pos', 'Status', 'Market Key', 'Line', 'Side', 'American Price', 'Game', 'Slate', 'Updated', 'Event ID', 'Bookmaker', 'Kickoff UTC', 'Market Source UTC', 'Roster Source', 'Roster Source Updated UTC', 'Roster Fetched UTC', 'Join Status', 'Validation Notes']],
  ['NBA_PROPS', ['Provider', 'Provider Event ID', 'Odds API Event ID', 'Game', 'Home Team', 'Away Team', 'Kickoff UTC', 'Bookmaker', 'Market Key', 'Provider Market Key', 'Player ID', 'Player Key', 'Player', 'Player Team', 'Line', 'Side', 'American Price', 'Available', 'Source Updated UTC', 'Retrieved UTC', 'Provider Quote ID', 'Capture Context']],
  ['PROVIDER_EVENT_MAP', ['Odds API Event ID', 'SportsGameOdds Event ID', 'Home Team', 'Away Team', 'Kickoff UTC', 'Resolved UTC', 'Source']],
  ['LINE_HISTORY', ['History ID', 'Capture UTC', 'Source Updated UTC', 'Provider', 'Provider Event ID', 'Canonical Event Key', 'Bookmaker', 'Market Key', 'Provider Market Key', 'Provider Quote ID', 'Player ID', 'Player Key', 'Player', 'Player Team', 'Line', 'Side', 'American Price', 'Available', 'Capture Context']],
  ['LOG', ['UTC', 'Action', 'Event ID', 'Result', 'Detail', 'Request Credits', 'Used', 'Remaining']],
];

for (const [name, headers] of sheets) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  const header = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  header.format = { fill: '#10213A', font: { name: 'Arial', bold: true, color: '#FFFFFF', size: 10 }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  header.format.rowHeightPx = 30;
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 20, headers.length).format.font = { name: 'Arial', size: 10, color: '#172033' };
  sheet.getRangeByIndexes(0, 0, 20, headers.length).format.autofitColumns();
  sheet.tabColor = name === 'INDEX' ? '#1F4E78' : '#566573';
}

const index = workbook.worksheets.getItem('INDEX');
index.getRange('A3').values = [['NBA Game Prep']];
index.getRange('A3').format.font = { name: 'Arial', bold: true, size: 14, color: '#10213A' };
index.getRange('A4').values = [['Use the NBA Game Prep mobile app to refresh schedule, select games, review cost, and export.']];
index.getRange('A4').format.font = { name: 'Arial', italic: true, size: 10, color: '#52616B' };

workbook.recalculate();
const inspection = await workbook.inspect({ kind: 'workbook,sheet,table', maxChars: 4000, tableMaxRows: 3, tableMaxCols: 8 });
if (!String(inspection.ndjson).includes('INDEX') || !String(inspection.ndjson).includes('ALT_PROPS')) throw new Error('Expected NBA tabs were not created.');
const preview = await workbook.render({ sheetName: 'INDEX', range: 'A1:M5', scale: 1, format: 'png' });
await fs.writeFile(`${outputDir}nba-game-prep-preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}nba-game-prep.xlsx`);
