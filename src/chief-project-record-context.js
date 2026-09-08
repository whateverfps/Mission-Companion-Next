import { effectiveRecord } from './structured-records.js';

const text = value => String(value ?? '').trim();

export function selectRelevantProjectRecords(records = [], question = '', { selectedRecordId = '', projectId = '' } = {}) {
  const query = text(question).toLowerCase();
  return records
    .filter(record => (!projectId || record.projectId === projectId) && (!selectedRecordId || record.recordId === selectedRecordId))
    .filter(record => {
      if (selectedRecordId) return true;
      const values = effectiveRecord(record).effective || {};
      const haystack = `${record.recordId} ${record.sourceRecordId} ${Object.values(values).join(' ')}`.toLowerCase();
      const typeMatch = record.recordType === 'submittal' ? /submittal|spec section|ball in court|review status/.test(query) : record.recordType === 'schedule-activity' ? /schedule|activity|start|finish|mobilization|milestone/.test(query) : false;
      return typeMatch && (haystack.split(/\s+/).some(term => term.length > 2 && query.includes(term)) || /schedule|submittal|activity/.test(query));
    })
    .slice(0, 8)
    .map(record => ({ ...effectiveRecord(record), sourceValue: record.normalized, overrideValues: record.overrides || {}, sourceHistory: record.sourceHistory || [] }));
}

export function buildProjectRecordContext(records = []) {
  return records.map(record => {
    const overridden = Object.keys(record.overrideValues || {});
    const sourceChanged = (record.reconciliation?.changedFields || []).filter(item => item.sourceChangedUnderOverride).map(item => item.field);
    return [`${record.recordType.toUpperCase()} ${record.recordId}`, `CURRENT PROJECT VALUE: ${JSON.stringify(record.effective || {})}`, `SOURCE-REPORTED VALUE: ${JSON.stringify(record.sourceValue || {})}`, overridden.length ? `USER OVERRIDES: ${overridden.map(field => `${field}=${record.overrideValues[field].value}; reason=${record.overrideValues[field].reason || 'not reported'}`).join(', ')}` : '', sourceChanged.length ? `SOURCE CHANGED UNDER OVERRIDE: ${sourceChanged.join(', ')}` : '', `SOURCE: ${record.sourceDocumentId || 'Not reported'} row ${record.sourceRow || 'Not reported'}`].filter(Boolean).join('\n');
  }).join('\n\n');
}
