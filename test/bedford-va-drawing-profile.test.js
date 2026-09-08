import test from 'node:test';
import assert from 'node:assert/strict';
import { BEDFORD_VA_PROFILE_ID, BEDFORD_VA_PROFILE_VERSION, detectBedfordVaProfile, findBedfordDrawingIndexPage, parseBedfordDrawingIndex, parseBedfordTitleBlock } from '../src/bedford-va-drawing-profile.js';
import { buildDrawingAnalysis, drawingAnalysisRequiresUpgrade, drawingIdFor, upgradeDrawingAnalysis } from '../src/drawing-intelligence.js';
import { inspectDrawingRegistryRuntime } from '../src/drawing-registry-diagnostics.js';

const item = (text, x, y, width = .12) => ({ text, region: { x, y, width, height: .008 } });
const titleBlock = (number, title, building = '61') => [
  item('VA FORM 08-6231', .5, .58), item('TRIPLE C', .7, .58), item('PROJECT NUMBER', .5, .7), item('518-22-700', .5, .72),
  item('BUILDING NUMBER', .62, .7), item(building, .62, .72), item('DRAWING TITLE', .5, .78), item(title, .5, .8, .3),
  item('DRAWING NUMBER', .82, .86), item(number, .82, .88), item('ISSUE DATE', .65, .86), item('03/16/2026', .65, .88), item('BEDFORD VA MEDICAL CENTER', .5, .94, .35)
];

const required = new Map([
  [0, ['61G-000', 'COVER SHEET']], [1, ['61G-001', 'DRAWING INDEX']], [20, ['61M-101', 'MECHANICAL PLAN - FIRST LEVEL - OVERALL']],
  [28, ['61M-701', 'MECHANICAL SCHEDULES']], [35, ['61E-101', 'ELECTRICAL PLAN - FIRST LEVEL']],
  [51, ['61T-402', 'TELECOMMUNICATION ROOM 137 - INVENTORY LIST']], [69, ['61R-900', 'PHOTO REFERENCES']]
]);
const entries = Array.from({ length: 70 }, (_, index) => required.get(index) || [`61A-${String(100 + index).padStart(3, '0')}`, `ARCHITECTURAL DETAIL ${index}`]);

function indexItems() {
  const output = [item('DRAWING INDEX', .06, .03), item('SHEET NUMBER', .06, .05), item('SHEET NAME', .2, .05)];
  let current = '';
  entries.forEach(([number, title], index) => {
    const discipline = number.includes('M-') ? 'MECHANICAL' : number.includes('E-') ? 'ELECTRICAL' : number.includes('T-') ? 'TELECOMMUNICATIONS' : number.includes('R-') ? 'REFERENCE' : number.includes('G-') ? 'GENERAL' : 'ARCHITECTURAL';
    const y = .07 + index * .0065;
    if (discipline !== current) { output.push(item(discipline, .06, y - .002, .12)); current = discipline; }
    output.push(item(number, .06, y, .09), item(title, .2, y, .4), item('YES', .7, y, .04));
  });
  return output;
}

function runtimeIndexItems() {
  const output = [item('DRAWING INDEX', .05, .02), item('SHEET NUMBER', .05, .045), item('SHEET NAME', .16, .045), item('SHEET NUMBER', .53, .045), item('SHEET NAME', .64, .045)];
  [entries.slice(0, 56), entries.slice(56)].forEach((columnEntries, columnIndex) => {
    let current = '';
    const numberX = columnIndex ? .53 : .05;
    const titleX = columnIndex ? .64 : .16;
    columnEntries.forEach(([number, title], index) => {
      const discipline = number.includes('M-') ? 'MECHANICAL' : number.includes('E-') ? 'ELECTRICAL' : number.includes('T-') ? 'TELECOMMUNICATIONS' : number.includes('R-') ? 'REFERENCE' : number.includes('G-') ? 'GENERAL' : 'ARCHITECTURAL';
      const y = .065 + index * .008;
      if (discipline !== current) { output.push(item(discipline, numberX, y - .003, .1)); current = discipline; }
      const words = title.split(' '), split = Math.max(1, Math.ceil(words.length / 2));
      if (columnIndex) {
        const compact = number.replace('-', '');
        const fragmentCount = 2 + (index % 4);
        const size = Math.ceil(compact.length / fragmentCount);
        const fragments = Array.from({ length: fragmentCount }, (_, fragmentIndex) => compact.slice(fragmentIndex * size, (fragmentIndex + 1) * size)).filter(Boolean);
        fragments.forEach((fragment, fragmentIndex) => {
          output.push(item(fragment, numberX + fragmentIndex * .014, y + (fragmentIndex % 2 ? .003 : 0), .012));
          if (fragmentIndex < fragments.length - 1) output.push(item('   ', numberX + fragmentIndex * .014 + .012, y, .001));
        });
      } else output.push(item(number, numberX, y, .08));
      output.push(item(words.slice(0, split).join(' '), titleX, y, .18), item(words.slice(split).join(' '), titleX, y + .0035, .18), item('YES', titleX + .29, y, .03));
    });
  });
  return output;
}

function pages() {
  return entries.map(([number, title], index) => ({ pageNumber: index + 1, width: 1000, height: 700, rotation: 0, textItems: [...(index === 1 ? indexItems() : []), ...titleBlock(number, title)] }));
}

function runtimePages() {
  const source = pages();
  source[1].textItems = [...runtimeIndexItems(), ...titleBlock('61G-001', 'DRAWING INDEX')];
  return source;
}

test('Bedford profile detects exact project evidence and rejects unrelated formats', () => {
  const detected = detectBedfordVaProfile(pages());
  assert.equal(detected.selected, true);
  assert.equal(detected.profileId, BEDFORD_VA_PROFILE_ID);
  assert.equal(detectBedfordVaProfile([{ pageNumber: 1, textItems: [item('DRAWING INDEX', .1, .1)] }]).selected, false);
});

test('Bedford lower-right title block and 70-row index parse authoritatively', () => {
  const source = pages();
  const block = parseBedfordTitleBlock(source[20].textItems);
  assert.equal(block.projectNumber, '518-22-700');
  assert.equal(block.buildingNumber, '61');
  assert.equal(block.drawingNumber, '61M-101');
  assert.equal(block.drawingTitle, 'MECHANICAL PLAN - FIRST LEVEL - OVERALL');
  const indexPage = findBedfordDrawingIndexPage(source);
  assert.equal(indexPage.pageNumber, 2);
  const rows = parseBedfordDrawingIndex(indexPage);
  assert.equal(rows.length, 70);
  assert.equal(rows.find(row => row.sheetNumber === '61M-101').discipline, 'Mechanical');
  assert.equal(rows.find(row => row.sheetNumber === '61T-402').sheetTitle, 'TELECOMMUNICATION ROOM 137 - INVENTORY LIST');
});

test('Bedford title block reconstructs normalized sheet identity only inside the labeled region', () => {
  const source = titleBlock('61M-101', 'MECHANICAL PLAN - FIRST LEVEL - OVERALL').filter(entry => entry.text !== '61M-101');
  source.push(item('61', .82, .88, .018), item('M', .841, .883, .009), item('-', .852, .88, .005), item('1', .86, .882, .006), item('0', .868, .88, .006), item('1', .876, .883, .006), item('FX500', .2, .2));
  const block = parseBedfordTitleBlock(source);
  assert.equal(block.drawingNumber, '61M-101');
  assert.notEqual(block.drawingNumber, 'FX500');
});

test('runtime-shaped split-column index recovers all 70 rows including wrapped titles', () => {
  const source = runtimePages();
  const rows = parseBedfordDrawingIndex(findBedfordDrawingIndexPage(source));
  assert.equal(rows.length, 70);
  assert.equal(rows.find(row => row.normalizedSheetNumber === '61M101').sheetTitle, 'MECHANICAL PLAN - FIRST LEVEL - OVERALL');
  assert.equal(rows.some(row => row.normalizedSheetNumber === '61T402'), true);
  assert.deepEqual(rows.slice(56).map(row => row.normalizedSheetNumber), entries.slice(56).map(([number]) => number.replace(/[^A-Z0-9]/gi, '')));
  const analysis = buildDrawingAnalysis({ documentId: 'runtime-general', projectId: 'general', pages: source, analyzedAt: 'now' });
  assert.equal(analysis.drawingRegistry.length, 70);
  assert.equal(analysis.registryHealth.unresolvedPages, 0);
  assert.equal(analysis.registryHealth.blankIdentityCount, 0);
  assert.equal(analysis.registryHealth.genericOnlyIdentityCount, 0);
  assert.equal(analysis.registryHealth.reviewOnlyIdentityCount, 0, JSON.stringify(analysis.sheets.filter(sheet => sheet.identityStatus === 'Ambiguous').map(sheet => ({ pageNumber: sheet.pageNumber, sheetNumber: sheet.sheetNumber, sheetTitle: sheet.sheetTitle, warnings: sheet.warnings }))));
});

test('Bedford sequence reconciliation expands 18 title-block anchors to 70 authoritative records', () => {
  const source = runtimePages();
  for (let index = 18; index < source.length; index += 1) {
    const block = titleBlock(entries[index][0], entries[index][1]);
    source[index].textItems = source[index].textItems.filter(entry => !block.some(blockItem => blockItem.text === entry.text && blockItem.region.x === entry.region.x && blockItem.region.y === entry.region.y));
    source[index].textItems.push(item(index % 2 ? 'FX500' : 'FX001', .2, .2));
  }
  const analysis = buildDrawingAnalysis({ documentId: 'runtime-sequence', projectId: 'general', pages: source, analyzedAt: 'now' });
  assert.equal(analysis.indexEntries.length, 70);
  assert.equal(analysis.sheets.filter(sheet => sheet.bedfordTitleBlock?.drawingNumber).length, 18);
  assert.equal(analysis.drawingRegistry.length, 70);
  assert.equal(analysis.registryHealth.unresolvedPages, 0);
  assert.equal(analysis.drawingRegistry.some(record => ['FX500', 'FX001'].includes(record.sheetNumber)), false);
  assert.equal(analysis.sheets.filter(sheet => sheet.identityMethod === 'drawing-index-page-order').length, 52);
});

test('Bedford analysis builds a stable owned direct page registry and tolerates one missing page', () => {
  const source = pages();
  const first = buildDrawingAnalysis({ documentId: 'bedford-61', projectId: 'bedford-project', pages: source, analyzedAt: 'now' });
  const second = buildDrawingAnalysis({ documentId: 'bedford-61', projectId: 'bedford-project', pages: source, analyzedAt: 'later' });
  assert.equal(first.profile.profileId, BEDFORD_VA_PROFILE_ID);
  assert.equal(first.indexEntries.length, 70);
  for (const [sheetNumber, title] of required.values()) {
    const record = first.drawingRegistry.find(item => item.sheetNumber === sheetNumber);
    assert.equal(record.sheetTitle, title);
    assert.equal(record.projectId, 'bedford-project');
    assert.equal(record.drawingId, drawingIdFor('bedford-61', record.pageNumber));
    assert.equal(second.drawingRegistry.find(item => item.sheetNumber === sheetNumber).drawingId, record.drawingId);
  }
  const missing = buildDrawingAnalysis({ documentId: 'bedford-61-missing', projectId: 'bedford-project', pages: source.filter(page => page.pageNumber !== 36), analyzedAt: 'now' });
  assert.equal(missing.registryHealth.missingIndexedSheets, 1);
  assert.equal(missing.drawingRegistry.some(item => item.sheetNumber === '61E-101'), false);
  assert.equal(missing.status, 'Completed with warnings');
  const general = buildDrawingAnalysis({ documentId: 'general-owned', projectId: 'general', pages: source, analyzedAt: 'now' });
  assert.equal(general.projectId, 'general');
  assert.equal(general.drawingRegistry.length, 70);
  assert.equal(general.registryHealth.totalPdfPages, 70);
  assert.equal(general.registryHealth.unresolvedPages, 0);
});

test('legacy current-version Bedford analysis without profile registry metadata rebuilds once', () => {
  const complete = buildDrawingAnalysis({ documentId: 'bedford-61', projectId: 'bedford-project', pages: pages(), analyzedAt: 'now' });
  const legacy = structuredClone(complete);
  delete legacy.profile;
  delete legacy.drawingRegistry;
  assert.equal(drawingAnalysisRequiresUpgrade(legacy), true);
  assert.equal(drawingAnalysisRequiresUpgrade({ ...legacy, analysisVersion: 5 }), true);
  const upgraded = upgradeDrawingAnalysis(legacy);
  assert.equal(upgraded.profile.profileVersion, BEDFORD_VA_PROFILE_VERSION);
  assert.equal(upgraded.indexEntries.length, 70);
  assert.equal(upgraded.drawingRegistry.length, 70);
  assert.equal(upgraded.drawingRegistry.find(record => record.normalizedSheetNumber === '61M101').sheetNumber, '61M-101');
  assert.equal(upgraded.drawingRegistry.find(record => record.normalizedSheetNumber === '61T402').sheetNumber, '61T-402');
  assert.equal(drawingAnalysisRequiresUpgrade(upgraded), false);
  assert.deepEqual(upgradeDrawingAnalysis(upgraded), upgraded);
  const incompleteV1 = { ...structuredClone(upgraded), profile: { ...upgraded.profile, profileVersion: 1 }, indexEntries: upgraded.indexEntries.slice(0, 56), drawingRegistry: upgraded.drawingRegistry.slice(0, 18) };
  assert.equal(drawingAnalysisRequiresUpgrade(incompleteV1), true);
});

test('Bedford registry counts only authoritative identities and rejects body-text FX candidates', () => {
  const source = pages();
  source[10].textItems.push(item('FX500', .2, .2), item('FX001', .3, .3));
  source[10].textItems = source[10].textItems.filter(entry => !titleBlock(entries[10][0], entries[10][1]).some(blockItem => blockItem.text === entry.text && blockItem.region.x === entry.region.x));
  source[1].textItems = source[1].textItems.filter(entry => entry.text !== entries[10][0] && entry.text !== entries[10][1]);
  const analysis = buildDrawingAnalysis({ documentId: 'bedford-runtime-shape', projectId: 'general', pages: source, analyzedAt: 'now' });
  assert.equal(analysis.registryHealth.totalPdfPages, 70);
  assert.ok(analysis.registryHealth.registryRecordsCreated < analysis.registryHealth.totalPdfPages);
  assert.equal(analysis.registryHealth.unresolvedPages, analysis.registryHealth.totalPdfPages - analysis.registryHealth.registryRecordsCreated);
  assert.equal(analysis.drawingRegistry.some(record => !record.sheetNumber || !record.normalizedSheetNumber), false);
  assert.equal(analysis.drawingRegistry.some(record => ['FX500', 'FX001'].includes(record.sheetNumber)), false);
});

test('runtime registry diagnostics trace exact Bedford commands globally while General is active', () => {
  const analysis = buildDrawingAnalysis({ documentId: 'bedford-61', projectId: 'bedford-project', pages: pages(), analyzedAt: 'now' });
  const input = { activeProject: { id: 'general', name: 'General' }, documents: [{ id: 'bedford-61', title: 'Building 61 plans' }], analyses: [analysis], persistedAnalyses: [analysis] };
  const mechanical = inspectDrawingRegistryRuntime({ ...input, query: 'Open Mechanical Sheet 61M-101' });
  assert.equal(mechanical.activeProjectId, 'general');
  assert.equal(mechanical.activeProjectRegistryCount, 0);
  assert.equal(mechanical.globalRegistryCount, 70);
  assert.equal(mechanical.analyses[0].profileSelected, true);
  assert.equal(mechanical.analyses[0].parsedIndexRowCount, 70);
  assert.equal(mechanical.registeredSheetCount, 70);
  assert.equal(mechanical.registeredSheetNumbers.length, 70);
  assert.ok(mechanical.registeredSheetNumbers.includes('61M-101'));
  assert.ok(mechanical.registeredSheetNumbers.includes('61T-402'));
  assert.deepEqual(mechanical.registeredSheetNumbers, [...mechanical.registeredSheetNumbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  assert.equal(mechanical.lifecycle.persisted[0].has61M101, true);
  assert.equal(mechanical.lifecycle.availableAfterRebuild[0].has61M101, true);
  assert.deepEqual(mechanical.knownSheets, { '61G001': true, '61M101': true, '61T402': true });
  assert.equal(mechanical.commandTrace.normalizedQueryKey, '61M101');
  assert.equal(mechanical.commandTrace.rawSheetToken, '61M-101');
  assert.equal(mechanical.commandTrace.finalMatchCount, 1);
  assert.equal(mechanical.commandTrace.rejectionReason, '');
  assert.equal(mechanical.matchingRecords.find(record => record.normalizedSheetNumber === '61M101').projectId, 'bedford-project');
  assert.equal(mechanical.matchingRecords.find(record => record.normalizedSheetNumber === '61M101').profileVersion, BEDFORD_VA_PROFILE_VERSION);
  assert.deepEqual(mechanical.ownershipFailures, []);
  const telecom = inspectDrawingRegistryRuntime({ ...input, query: 'Open sheet 61T-402' });
  assert.equal(telecom.commandTrace.normalizedQueryKey, '61T402');
  assert.equal(telecom.commandTrace.finalMatchCount, 1);
});
