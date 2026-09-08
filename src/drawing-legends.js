const text = value => value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' ');
const list = value => Array.isArray(value) ? value : [];
const region = value => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0, width: Number(value?.width) || 0, height: Number(value?.height) || 0 });
function hash(value) { let output = 2166136261; for (const character of String(value)) { output ^= character.charCodeAt(0); output = Math.imul(output, 16777619); } return (output >>> 0).toString(36); }
const verification = () => ({ status: 'Unreviewed', correctedValue: '', verifiedAt: '' });

export function normalizeSymbolPrimitive(primitive = {}) {
  const bounds = region(primitive.bounds);
  const scale = Math.max(bounds.width, bounds.height, .000001);
  const points = list(primitive.points).slice(0, 128).map(point => ({ x: Math.round(((Number(point.x) || 0) - bounds.x) / scale * 1000) / 1000, y: Math.round(((Number(point.y) || 0) - bounds.y) / scale * 1000) / 1000 }));
  return { kind: text(primitive.kind) || 'path', aspectRatio: Math.round(bounds.width / Math.max(bounds.height, .000001) * 1000) / 1000, points, stroke: Boolean(primitive.stroke), fill: Boolean(primitive.fill), lineWidth: Math.round((Number(primitive.lineWidth) || 0) / scale * 1000) / 1000 };
}

export function symbolFingerprint(primitives = []) {
  const normalized = list(primitives).map(normalizeSymbolPrimitive).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return normalized.length ? `symbol-${hash(JSON.stringify(normalized))}` : '';
}

export function extractLegendCandidates({ documentId, drawingSetId, sheet, primitives = [] } = {}) {
  if (!documentId || !drawingSetId || !sheet?.sheetId || !list(sheet.sheetTypes).some(type => /Symbols and Abbreviations|General Notes/.test(type))) return [];
  const items = list(sheet.textItems).map(item => ({ text: text(item.text), region: region(item.region) })).filter(item => item.text);
  const headings = items.filter(item => /\b(?:SYMBOLS?|ABBREVIATIONS?|LEGEND)\b/i.test(item.text) && item.text.length < 90);
  return headings.map((heading, legendIndex) => {
    const candidates = items.filter(item => item.region.y > heading.region.y && item.region.y - heading.region.y < .36 && item.text.length >= 2 && item.text.length < 120 && !/\b(?:NOTE|NOT ALL|LEGEND|SYMBOL DESCRIPTION)\b/i.test(item.text));
    const entries = candidates.slice(0, 200).map((item, index) => {
      const leftPrimitives = list(primitives).filter(value => value.bounds && Math.abs((value.bounds.y || 0) - item.region.y) < .018 && (value.bounds.x || 0) < item.region.x && item.region.x - ((value.bounds.x || 0) + (value.bounds.width || 0)) < .08);
      const fingerprint = symbolFingerprint(leftPrimitives);
      return { legendEntryId: `legend-entry-${hash(`${drawingSetId}:${sheet.sheetId}:${legendIndex}:${index}:${item.text}`)}`, label: item.text, description: item.text, abbreviation: /^[A-Z0-9-]{1,12}$/.test(item.text) ? item.text : '', qualifiers: [], symbolRegion: leftPrimitives.length ? region(leftPrimitives[0].bounds) : null, symbolFingerprint: fingerprint, extractionMethod: fingerprint ? 'positioned-text-and-pdf-vector' : 'positioned-text-candidate', confidence: fingerprint ? .8 : .5, verification: verification(), warnings: fingerprint ? [] : ['Legend symbol geometry requires review.'] };
    });
    return { legendId: `legend-${hash(`${drawingSetId}:${sheet.sheetId}:${heading.text}:${legendIndex}`)}`, documentId, drawingSetId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, discipline: sheet.discipline, legendTitle: heading.text, sourceRegion: heading.region, entries, warnings: entries.some(item => !item.symbolFingerprint) ? ['Some legend entries require graphical review.'] : [], diagnostics: { candidateCount: candidates.length } };
  });
}

export function matchLegendOccurrences({ legend, targetSheet, primitives = [], threshold = 1 } = {}) {
  if (!legend || !targetSheet || legend.drawingSetId !== targetSheet.drawingSetId || legend.documentId !== targetSheet.documentId) return [];
  if (legend.discipline !== 'Unknown' && targetSheet.discipline !== legend.discipline) return [];
  if (targetSheet.extractionEligibility?.equipment === false) return [];
  const fingerprints = new Map(list(legend.entries).filter(entry => entry.symbolFingerprint).map(entry => [entry.symbolFingerprint, entry]));
  return list(primitives).flatMap((primitive, index) => {
    const fingerprint = symbolFingerprint([primitive]);
    const entry = fingerprints.get(fingerprint);
    if (!entry || threshold > 1) return [];
    return [{ occurrenceId: `occurrence-${hash(`${targetSheet.sheetId}:${index}:${fingerprint}`)}`, documentId: targetSheet.documentId, drawingSetId: legend.drawingSetId, sheetId: targetSheet.sheetId, pageNumber: targetSheet.pageNumber, legendEntryId: entry.legendEntryId, symbolFingerprint: fingerprint, region: region(primitive.bounds), nearbyText: '', roomCandidate: null, extractionMethod: 'same-set-vector-fingerprint', matchScore: 1, verification: verification(), limitations: ['Candidate occurrence; construction meaning requires human verification.'] }];
  });
}

export function applyOccurrenceVerification(occurrence, overlay = {}) {
  const states = ['Unreviewed', 'Confirmed', 'Corrected', 'Rejected', 'Uncertain'];
  if (!states.includes(overlay.status)) throw new Error('Unsupported occurrence verification state.');
  return { ...structuredClone(occurrence), verification: { status: overlay.status, correctedValue: overlay.status === 'Corrected' ? text(overlay.correctedValue) : '', verifiedAt: text(overlay.verifiedAt) } };
}
