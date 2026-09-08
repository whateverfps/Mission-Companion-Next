const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];
const compact = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  submittalNumber: ['submittal number', 'submittal no', 'submittal #', 'number', 'item no'],
  specificationSection: ['spec section', 'specification section', 'section', 'spec'],
  title: ['title', 'description', 'submittal title', 'subject'],
  type: ['type', 'submittal type'],
  status: ['status', 'review status'],
  responsibleParty: ['ball in court', 'responsible party', 'responsible contractor', 'submittal manager'],
  submitBy: ['submit by', 'required date', 'target date', 'due date'],
  receivedDate: ['received date', 'date received'],
  reviewDate: ['review date', 'date reviewed'],
  location: ['location', 'building', 'workspace', 'area']
};
const date = value => { const raw = text(value); if (!raw) return ''; const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10); };
const fieldValue = (row, names) => { const keys = Object.keys(row); const key = keys.find(item => names.some(alias => compact(item) === compact(alias))); return key ? text(row[key]) : ''; };

export function resolveWorkspaceReference(value = '', workspaces = []) {
  const raw = text(value); if (!raw) return { status: 'unresolved', sourceValue: raw };
  const normalized = raw.toUpperCase().replace(/\b(BLDG|BUILDING)\s*/i, '');
  const matches = list(workspaces).filter(item => { const id = text(item.id).toUpperCase(); const building = text(item.pmisBuilding || item.buildingId).toUpperCase(); return normalized === id || normalized === building || normalized === `B${building}` || raw.toLowerCase().includes(text(item.name).toLowerCase()); });
  if (matches.length === 1) return { status: 'matched', sourceValue: raw, workspaceId: matches[0].id };
  if (matches.length > 1) return { status: 'possible-match', sourceValue: raw, candidates: matches.map(item => item.id) };
  return { status: 'unresolved', sourceValue: raw };
}

export function parseDelimitedRows(textValue = '') {
  const lines = text(textValue).split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const split = line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(value => value.trim().replace(/^\"|\"$/g, ''));
  const headers = split(lines[0]);
  return lines.slice(1).map(line => Object.fromEntries(split(line).map((value, index) => [headers[index] || `Column ${index + 1}`, value])));
}

export function detectStructuredReport({ fileName = '', headers = [], textValue = '' } = {}) {
  const haystack = `${fileName} ${headers.join(' ')} ${textValue.slice(0, 3000)}`.toLowerCase();
  if (/(submittal number|submittal no|submittal #)/i.test(haystack)) return 'submittal-register';
  if (/(activity id|activity name|total float|planned finish)/i.test(haystack)) return 'schedule';
  if (/(rfi number|rfi no|request for information)/i.test(haystack)) return 'rfi-log';
  if (/(sheet number|drawing number|discipline)/i.test(haystack)) return 'drawing-log';
  if (/(specification section|spec section)/i.test(haystack)) return 'specification-log';
  return 'general-spreadsheet';
}

export function normalizeSubmittalRow(row, { projectId = '', sourceDocumentId = '', sourceSystem = '', importBatchId = '', rowNumber = 0 } = {}) {
  const raw = structuredClone(row || {});
  const submittalNumber = fieldValue(raw, aliases.submittalNumber);
  const specificationSection = fieldValue(raw, aliases.specificationSection);
  const normalized = { submittalNumber, specificationSection: specificationSection.replace(/^(section|spec)\s*/i, ''), title: fieldValue(raw, aliases.title), type: fieldValue(raw, aliases.type), status: fieldValue(raw, aliases.status), responsibleParty: fieldValue(raw, aliases.responsibleParty), submitBy: date(fieldValue(raw, aliases.submitBy)), receivedDate: date(fieldValue(raw, aliases.receivedDate)), reviewDate: date(fieldValue(raw, aliases.reviewDate)), location: fieldValue(raw, aliases.location) };
  const identity = submittalNumber ? `${projectId}:submittal:${submittalNumber}` : '';
  return { recordType: 'submittal', recordId: identity, projectId, sourceSystem, sourceDocumentId, sourceRecordId: submittalNumber, sourceRow: rowNumber || null, importBatchId, raw, normalized, sourceHistory: [{ importBatchId, sourceDocumentId, sourceRow: rowNumber || null, raw, observedAt: new Date().toISOString() }], reviewState: identity ? 'ready' : 'needs-review' };
}

export function normalizeScheduleRow(row, { projectId = '', sourceDocumentId = '', sourceSystem = '', importBatchId = '', rowNumber = 0 } = {}) {
  const raw = structuredClone(row || {}); const value = names => fieldValue(raw, names);
  const activityId = value(['activity id', 'activity number', 'id']);
  const normalized = { activityId, name: value(['activity name', 'activity', 'name', 'description']), start: date(value(['start', 'planned start'])), finish: date(value(['finish', 'planned finish'])), actualStart: date(value(['actual start'])), actualFinish: date(value(['actual finish'])), status: value(['status']), totalFloat: value(['total float', 'float']), location: value(aliases.location), critical: value(['critical', 'critical path']) };
  return { recordType: 'schedule-activity', recordId: activityId ? `${projectId}:activity:${activityId}` : '', projectId, sourceSystem, sourceDocumentId, sourceRecordId: activityId, sourceRow: rowNumber || null, importBatchId, raw, normalized, sourceHistory: [{ importBatchId, sourceDocumentId, sourceRow: rowNumber || null, raw, observedAt: new Date().toISOString() }], reviewState: activityId ? 'ready' : 'needs-review' };
}

export function compareStructuredRecords(existing = [], incoming = []) {
  const prior = new Map(list(existing).map(item => [item.recordId, item])); const current = new Map(list(incoming).map(item => [item.recordId, item])); const changes = [];
  const records = list(incoming).map(item => { const old = prior.get(item.recordId); if (!old) return { ...item, overrides: {}, overrideHistory: [], reconciliation: { status: 'new', changedFields: [] } }; const changedFields = Object.keys(item.normalized).filter(key => text(old.normalized?.[key]) !== text(item.normalized?.[key])).map(field => ({ field, current: old.normalized?.[field] || '', imported: item.normalized?.[field] || '', sourceChangedUnderOverride: Object.hasOwn(old.overrides || {}, field) })); changes.push(...changedFields.map(change => ({ recordId: item.recordId, ...change }))); return { ...item, overrides: structuredClone(old.overrides || {}), overrideHistory: structuredClone(old.overrideHistory || []), sourceHistory: [...list(old.sourceHistory), ...list(item.sourceHistory)], reconciliation: { status: changedFields.length ? 'changed' : 'unchanged', changedFields } }; });
  const possiblyRemoved = list(existing).filter(item => item.recordId && !current.has(item.recordId)).map(item => ({ ...item, reconciliation: { status: 'possibly-removed', changedFields: [] } }));
  return { records, possiblyRemoved, changes, summary: { new: records.filter(item => item.reconciliation.status === 'new').length, changed: records.filter(item => item.reconciliation.status === 'changed').length, unchanged: records.filter(item => item.reconciliation.status === 'unchanged').length, possiblyRemoved: possiblyRemoved.length } };
}

const STORAGE_KEY = 'mission-companion:structured-records:v1';
export function loadStructuredRecords(projectId = '') { try { const stored = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '[]'); return stored.filter(item => !projectId || item.projectId === projectId); } catch { return []; } }
export function saveStructuredRecords(records = []) { try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* persistence diagnostics remain with host */ } return records; }
export function acceptStructuredRecords({ existing = [], records = [], possiblyRemoved = [] } = {}) { const merged = new Map(list(existing).map(item => [item.recordId, item])); for (const item of records) { if (item.reconciliation?.status === 'changed' || item.reconciliation?.status === 'new') merged.set(item.recordId, item); } for (const item of possiblyRemoved) merged.set(item.recordId, item); return saveStructuredRecords([...merged.values()]); }

export function effectiveRecordValue(record = {}, field = '') { return Object.hasOwn(record.overrides || {}, field) ? record.overrides[field].value : record.normalized?.[field]; }
export function effectiveRecord(record = {}) { const fields = new Set([...Object.keys(record.normalized || {}), ...Object.keys(record.overrides || {})]); return { ...record, effective: Object.fromEntries([...fields].map(field => [field, effectiveRecordValue(record, field)])) }; }
export function setRecordOverride(record, field, value, reason = '', now = new Date().toISOString()) {
  if (!record?.recordId || !field || text(value) === text(record.normalized?.[field])) return structuredClone(record);
  const previousEffectiveValue = effectiveRecordValue(record, field); const next = structuredClone(record); next.overrides = { ...(next.overrides || {}), [field]: { value, reason, updatedAt: now, sourceChangedUnderOverride: false } }; next.overrideHistory = [...(next.overrideHistory || []), { recordId: record.recordId, field, previousEffectiveValue, newOverrideValue: value, reason, timestamp: now }]; return next;
}
export function removeRecordOverride(record, field, now = new Date().toISOString()) { const next = structuredClone(record); if (!next.overrides?.[field]) return next; next.overrideHistory = [...(next.overrideHistory || []), { recordId: record.recordId, field, previousEffectiveValue: next.overrides[field].value, newOverrideValue: next.normalized?.[field], reason: 'Override removed', timestamp: now }]; delete next.overrides[field]; return next; }
