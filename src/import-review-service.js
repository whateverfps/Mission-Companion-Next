import { parseFiles } from './parsers.js';
import { classifyDocumentRole, documentRoute } from './document-routing.js';
import { createIdentifier } from './identifiers.js';
import { parseDelimitedRows, detectStructuredReport, normalizeSubmittalRow, normalizeScheduleRow, compareStructuredRecords, acceptStructuredRecords, loadStructuredRecords, resolveWorkspaceReference } from './structured-records.js';
import { listBedfordWorkspaceRecords } from './workspace-registry.js';
import { extractWorkbookTables } from './xlsx-structured-adapter.js';
import { loadAuthoritativeProjectRecords, saveAuthoritativeProjectRecords } from './project-record-store.js';

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];

export function createImportBatch({ projectId = '', libraryId = '', files = [], createdAt = new Date().toISOString(), sourceSystem = 'Unknown source' } = {}) {
  return { id: createIdentifier(), projectId, libraryId, sourceSystem, createdAt, status: 'review', files: list(files).map(file => ({ id: createIdentifier(), file, name: file.name, size: file.size, originalName: file.name, classification: null, mapping: null, preview: null, status: 'queued', duplicate: null, corrections: [] })) };
}

async function fingerprint(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await globalThis.crypto?.subtle?.digest?.('SHA-256', bytes);
  return digest ? [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') : `${file.name}:${file.size}:${file.lastModified || ''}`;
}

function mappingFor(role) { return { 'drawing-set': 'Drawings', specifications: 'Specifications', submittal: 'Submittals', RFI: 'RFIs', report: 'Documents', inspection: 'Documents', other: 'Documents' }[role] || 'Documents'; }

function previewFor(document, sections, file) {
  const owned = sections.filter(section => section.documentId === document.id);
  const sectionNumbers = [...new Set(owned.map(section => section.sectionNumber).filter(Boolean))];
  return { sectionCount: owned.length, sectionNumbers, pageCount: document.pageCount || null, characterCount: document.characterCount || 0, status: document.status, sourcePreserved: file.type === 'application/pdf' || file.size > 0 };
}

export async function analyzeImportBatch(batch, { existingDocuments = [], existingStructuredRecords = [], onProgress = () => {} } = {}) {
  const files = batch.files.map(item => item.file);
  const existingHashes = new Set(existingDocuments.map(item => item.contentHash).filter(Boolean));
  onProgress({ stage: 'reading', current: 0, total: files.length });
  const parsed = await parseFiles(files, batch.projectId, progress => onProgress({ ...progress, stage: progress.stage === 'detecting' ? 'identifying' : progress.stage }), batch.libraryId);
  for (let index = 0; index < batch.files.length; index += 1) {
    const item = batch.files[index];
    const document = parsed.documents[index];
    const classification = classifyDocumentRole(document);
    const hash = await fingerprint(item.file);
    item.classification = { detectedType: classification.documentType, method: classification.method, confidence: classification.method === 'safe-default' ? null : 'supported' };
    item.mapping = { destination: mappingFor(classification.documentType), projectId: batch.projectId, reviewState: 'needs-review' };
    item.preview = previewFor(document, parsed.sections, item.file);
    item.sourceIdentity = { originalName: item.file.name, fingerprint: hash, documentId: document.id, projectId: batch.projectId };
    const rawText = /\.(csv|txt|log)$/i.test(item.file.name) ? await item.file.text() : '';
    let rows = parseDelimitedRows(rawText);
    if (/\.xlsx?$/i.test(item.file.name) && globalThis.XLSX?.read) {
      const workbook = globalThis.XLSX.read(await item.file.arrayBuffer(), { type: 'array', cellDates: true });
      const tables = extractWorkbookTables(workbook).filter(table => table.status === 'structured');
      const table = tables[0];
      rows = table?.records || [];
      item.workbook = { sheetName: table?.sheetName || '', headerRow: table?.headerRow || null, candidateSheets: tables.map(value => value.sheetName) };
    }
    const reportType = detectStructuredReport({ fileName: item.file.name, headers: rows[0] ? Object.keys(rows[0]) : [], textValue: rawText });
    if (reportType !== 'general-spreadsheet' && rows.length) {
      item.classification = { ...item.classification, detectedType: reportType === 'submittal-register' ? 'submittal-register' : reportType, method: 'structured-header' };
      const normalized = rows.map((row, rowIndex) => reportType === 'submittal-register' ? normalizeSubmittalRow(row, { projectId: batch.projectId, sourceDocumentId: document.id, sourceSystem: batch.sourceSystem, importBatchId: batch.id, rowNumber: rowIndex + 2 }) : reportType === 'schedule' ? normalizeScheduleRow(row, { projectId: batch.projectId, sourceDocumentId: document.id, sourceSystem: batch.sourceSystem, importBatchId: batch.id, rowNumber: rowIndex + 2 }) : null).filter(Boolean).map(record => ({ ...record, workspaceMapping: resolveWorkspaceReference(record.normalized.location, listBedfordWorkspaceRecords()) }));
      const existingRecords = (existingStructuredRecords.length ? existingStructuredRecords : loadStructuredRecords(batch.projectId)).filter(record => record.recordType === normalized[0]?.recordType);
      item.structured = { reportType, records: normalized, reconciliation: compareStructuredRecords(existingRecords, normalized) };
      item.mapping = { ...item.mapping, destination: reportType === 'submittal-register' ? 'Submittals' : reportType === 'schedule' ? 'Schedule' : item.mapping.destination };
    }
    item.duplicate = existingHashes.has(hash) ? { kind: 'exact', message: 'An identical source fingerprint already exists in this project.' } : null;
    item.status = document.status === 'verified' ? 'ready' : 'error';
    onProgress({ stage: 'mapping', current: index + 1, total: files.length, name: item.name });
  }
  batch.analysis = { documents: parsed.documents, sections: parsed.sections, sourceFiles: parsed.sourceFiles, drawingAnalyses: parsed.drawingAnalyses };
  batch.status = 'ready-for-review';
  return structuredClone(batch);
}

export function correctImportFile(batch, fileId, correction = {}) {
  const item = batch.files.find(entry => entry.id === fileId);
  if (!item) return batch;
  const original = item.classification?.detectedType || '';
  if (correction.documentType) item.classification = { ...item.classification, detectedType: correction.documentType, method: 'manual' };
  if (correction.destination) item.mapping = { ...item.mapping, destination: correction.destination, reviewState: 'corrected' };
  item.corrections = [...item.corrections, { field: correction.documentType ? 'documentType' : 'destination', original, value: correction.documentType || correction.destination, at: new Date().toISOString() }];
  return batch;
}

export async function acceptImportBatch(batch, { engine, duplicateAction = 'skip', onProgress = () => {} } = {}) {
  if (!engine?.ingest) throw new Error('The existing ingestion engine is unavailable.');
  const accepted = batch.files.filter(item => item.status === 'ready' && !item.duplicate || item.status === 'ready' && duplicateAction !== 'skip').map(item => item.file);
  const result = await engine.ingest(accepted, onProgress, batch.libraryId, { duplicateAction });
  const structured = batch.files.flatMap(item => item.structured?.records || []);
  if (structured.length) {
    const existing = (await loadAuthoritativeProjectRecords({ engine, projectId: batch.projectId })).filter(record => record.recordType === structured[0].recordType);
    const comparison = compareStructuredRecords(existing, structured);
    const acceptedRecords = acceptStructuredRecords({ existing, records: comparison.records, possiblyRemoved: comparison.possiblyRemoved });
    await saveAuthoritativeProjectRecords({ engine, records: acceptedRecords });
  }
  batch.status = 'accepted';
  batch.acceptedAt = new Date().toISOString();
  batch.acceptedFileCount = accepted.length;
  batch.ingestResult = result;
  return { batch: structuredClone(batch), result };
}
