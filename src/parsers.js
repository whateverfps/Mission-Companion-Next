import { normalizeSectionNumber } from './data-model.js';
import { createIdentifier } from './identifiers.js';
import { createPdfSourceRecord, openPdfBlob, readPdfPage } from './pdf-source.js';
import { buildDrawingAnalysis } from './drawing-intelligence.js';
import { persistDocumentClassification } from './document-routing.js';

const HIERARCHY_VERSION = 1;
const TRADE_RULES = [
  ['electrical', /\belectri|\bpower|\blighting|\b26\s/],
  ['communications', /\btelecom|\bdata cabl|\bcommunications|\b27\s/],
  ['mechanical', /\bhvac|\bmechanical|\bduct|\b23\s/],
  ['plumbing', /\bplumb|\bpiping|\b22\s/],
  ['fire protection', /\bfire suppress|\bsprinkler|\b21\s/],
  ['concrete', /\bconcrete|\b03\s/],
  ['masonry', /\bmasonry|\b04\s/],
  ['metals', /\bstructural steel|\bmetal|\b05\s/],
  ['finishes', /\bfinish|\bpaint|\bflooring|\b09\s/],
  ['general requirements', /\bquality control|\bsubmittal|\b01\s/]
];
const BUILDING_SYSTEM_RULES = [
  ['quality control', /quality control|\bqc\b|testing|deficien/],
  ['commissioning', /commission/],
  ['life safety', /life safety|fire alarm|egress/],
  ['building envelope', /envelope|roof|waterproof|air barrier/],
  ['controls', /control system|automation|\bbas\b/]
];
const KEYWORD_STOP = /^(that|this|with|from|shall|will|section|page|have|into|their)$/;

function clean(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function csiHeading(raw) {
  const text = clean(raw).replace(/^#{1,6}\s*/, '');
  const division = text.match(/^DIVISION\s+(\d{1,2})\s*(?:[-–—:]\s*)?(.*)$/i);

  if (division) {
    const number = division[1].padStart(2, '0');
    return {
      title: `Division ${number}${division[2] ? ` — ${division[2].trim()}` : ''}`,
      hierarchyType: 'division',
      hierarchyLevel: 1,
      division: number,
      sectionNumber: ''
    };
  }

  const section = text.match(/^(?:SECTION\s+)?(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})\b\s*(?:[-–—:]\s*)?(.*)$/i);

  if (section) {
    const sectionNumber = normalizeSectionNumber(section.slice(1, 4).join(''));
    return {
      title: `${sectionNumber}${section[4] ? ` ${section[4].trim()}` : ''}`,
      hierarchyType: 'spec-section',
      hierarchyLevel: 2,
      division: section[1],
      sectionNumber,
      sectionTitle: section[4]?.trim() || ''
    };
  }

  return null;
}

function headingInfo(raw) {
  const text = clean(raw).replace(/^#{1,6}\s*/, '');
  const csi = csiHeading(text);
  if (csi) return csi;

  const markdown = (String(raw ?? '').match(/^(#{1,6})\s+/) || [])[1];
  if (markdown) return { title: text, hierarchyType: 'heading', hierarchyLevel: Math.min(6, markdown.length + 2) };

  const part = text.match(/^PART\s+(\d+)\s*(?:[-–—:]\s*)?(.*)$/i);
  if (part) return { title: text, hierarchyType: 'part', hierarchyLevel: 3 };

  const paragraph = text.match(/^(\d+(?:\.\d+){1,5})[.)]?\s+(.+)/);
  if (paragraph) return {
    title: text,
    hierarchyType: 'heading',
    hierarchyLevel: Math.min(6, paragraph[1].split('.').length + 2)
  };

  if (/^(ARTICLE|APPENDIX|CHAPTER)\s+/i.test(text)) {
    return { title: text, hierarchyType: 'heading', hierarchyLevel: 3 };
  }

  return { title: text, hierarchyType: 'heading', hierarchyLevel: 4 };
}

function isHeading(line) {
  const value = clean(line);
  if (!value || value.length > 180 || /^PAGE\s+\d+$/i.test(value)) return false;
  if (csiHeading(value)) return true;
  if (/^#{1,6}\s+/.test(value)) return true;
  if (/^(PART|ARTICLE|APPENDIX|CHAPTER)\s+[A-Z0-9]/i.test(value)) return true;
  if (/^\d+(?:\.\d+){1,5}[.)]?\s+[A-Z]/.test(value)) return true;
  if (value.length <= 80 && /^(?:[A-Z][A-Za-z0-9/&'\-]*)(?:\s+[A-Z][A-Za-z0-9/&'\-]*){1,7}$/.test(value)) return true;
  return value.length >= 5 && value.length <= 100 &&
    /^[A-Z][A-Z0-9 /&(),'.\-–—]+$/.test(value) &&
    /[A-Z]{3}/.test(value);
}

function semanticMetadata(node, documentName, pageStart, pageEnd) {
  const source = `${node.title} ${node.text}`.toLowerCase();
  const trades = TRADE_RULES.filter(([, rule]) => rule.test(source)).map(([name]) => name);
  const buildingSystems = BUILDING_SYSTEM_RULES.filter(([, rule]) => rule.test(source)).map(([name]) => name);
  const keywords = [...new Set(source.match(/[a-z][a-z-]{3,}/g) || [])]
    .filter(word => !KEYWORD_STOP.test(word))
    .slice(0, 24);

  return {
    division: node.division || '',
    sectionNumber: node.sectionNumber || '',
    sectionTitle: node.sectionTitle || (node.hierarchyType === 'spec-section' ? node.title : ''),
    parent: node.parentKey || null,
    keywords,
    trade: trades[0] || '',
    discipline: trades[0] || '',
    buildingSystems,
    document: documentName,
    pageRange: pageStart ? { start: pageStart, end: pageEnd || pageStart } : null
  };
}

function crossReferences(text) {
  const found = new Set();
  const pattern = /\b(?:see|reference|refer\s+to|per|under|in)\s+(?:specification\s+)?(?:section\s+)?(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})\b/gi;
  for (const match of String(text ?? '').matchAll(pattern)) {
    found.add(normalizeSectionNumber(match.slice(1, 4).join('')));
  }
  return [...found];
}

export function buildSpecificationHierarchy(text, name = 'Unknown document') {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const nodes = [];
  const stack = [];
  let page = null;
  let lastContentPage = null;
  let current = null;

  const close = endLine => {
    if (!current) return;
    current.text = clean(current.buffer.join('\n'));
    current.endLine = Math.max(current.startLine, endLine);
    current.pageEnd = lastContentPage || current.pageStart;
    current.location = current.pageStart
      ? `Pages ${current.pageStart}-${current.pageEnd}`
      : `Lines ${current.startLine}-${current.endLine}`;
    delete current.buffer;
    nodes.push(current);
    current = null;
  };

  const begin = (heading, lineNumber) => {
    close(lineNumber - 1);
    lastContentPage = page;
    const info = headingInfo(heading);
    const level = info.hierarchyLevel;
    const parent = [...stack].reverse().find(item => item.level < level) || null;
    const inheritedDivision = [...stack].reverse().find(item => item.division)?.division || '';
    const inheritedSection = [...stack].reverse().find(item => item.sectionNumber) || null;
    const key = `node-${nodes.length}-${lineNumber}`;
    current = {
      ...info,
      division: info.division || inheritedDivision,
      sectionNumber: info.sectionNumber || inheritedSection?.sectionNumber || '',
      sectionTitle: info.sectionTitle || inheritedSection?.sectionTitle || '',
      key,
      parentKey: parent?.key || null,
      path: [...stack.filter(item => item.level < level).map(item => item.title), info.title],
      pageStart: page,
      startLine: lineNumber + 1,
      buffer: []
    };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({
      key,
      title: info.title,
      level,
      division: current.division,
      sectionNumber: current.sectionNumber,
      sectionTitle: current.sectionTitle
    });
  };

  lines.forEach((line, index) => {
    const pageMarker = line.trim().match(/^PAGE\s+(\d+)$/i);
    if (pageMarker) {
      page = Number(pageMarker[1]);
      return;
    }
    if (isHeading(line)) {
      begin(line, index + 1);
      return;
    }
    if (!current && clean(line)) begin('Document beginning', index + 1);
    if (current) {
      current.buffer.push(line);
      if (clean(line)) lastContentPage = page || lastContentPage;
    }
  });
  close(lines.length);

  return nodes.flatMap(node => node.text.length > 7000 ? chunkLong(node) : [node])
    .map(node => ({
      ...node,
      crossReferences: crossReferences(`${node.title}\n${node.text}`),
      metadata: semanticMetadata(node, name, node.pageStart, node.pageEnd)
    }));
}

function chunkLong(section) {
  const paragraphs = section.text.split(/\n\s*\n/);
  const output = [];
  let buffer = '';
  let part = 1;
  for (const paragraph of paragraphs) {
    if (`${buffer}\n\n${paragraph}`.length > 6500 && buffer) {
      output.push({
        ...section,
        key: part === 1 ? section.key : `${section.key}-part-${part}`,
        parentKey: part === 1 ? section.parentKey : section.key,
        title: `${section.title} — Part ${part++}`,
        text: buffer
      });
      buffer = paragraph;
    } else buffer += `${buffer ? '\n\n' : ''}${paragraph}`;
  }
  if (buffer) output.push({
    ...section,
    key: part === 1 ? section.key : `${section.key}-part-${part}`,
    parentKey: part === 1 ? section.parentKey : section.key,
    title: part > 1 ? `${section.title} — Part ${part}` : section.title,
    text: buffer
  });
  return output;
}

async function loadScript(src, test) {
  if (test()) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load parser: ${src}`));
    document.head.appendChild(script);
  });
}

export async function parsePdfFile(file, options = {}) {
  const sourceBlob = file instanceof Blob && file.type === 'application/pdf'
    ? file
    : new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
  const pdf = await openPdfBlob(sourceBlob, options);
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await readPdfPage(pdf, pageNumber);
      const lines = [];
      let currentY = null;
      let line = [];
      for (const item of page.textItems.slice().sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x)) {
        const y = item.region.y;
        if (currentY !== null && Math.abs(y - currentY) > .006) {
          if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
          line = [];
        }
        line.push(item.text);
        currentY = y;
      }
      if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
      pages.push({ ...page, sourceText: lines.filter(Boolean).join('\n') });
    }
  } finally {
    pdf.cleanup?.();
    pdf.destroy?.();
  }
  return { text: pages.map(page => `PAGE ${page.pageNumber}\n${page.sourceText}`).join('\n'), pages, pageCount: pages.length, sourceBlob };
}

async function parseDocx(file) {
  await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', () => window.mammoth);
  return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
}

async function parseXlsx(file) {
  await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX);
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return workbook.SheetNames.map(sheet => `SHEET: ${sheet}\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])}`).join('\n\n');
}

async function parseFile(file, options = {}) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml', 'log'].includes(extension)) return { text: await file.text() };
  if (extension === 'docx') return { text: await parseDocx(file) };
  if (['xlsx', 'xls'].includes(extension)) return { text: await parseXlsx(file) };
  if (extension === 'pdf') return parsePdfFile(file, options);
  throw new Error(`Unsupported file type: .${extension}`);
}

function categoryFor(name) {
  const value = name.toLowerCase();
  if (/spec|section|division/.test(value)) return 'Specifications';
  if (/drawing|plan|sheet/.test(value)) return 'Drawings';
  if (/sop|procedure|manual/.test(value)) return 'SOPs';
  if (/report|assessment|inspection/.test(value)) return 'Reports';
  if (/photo|image/.test(value)) return 'Photos';
  return 'General';
}

export async function parseFiles(files, projectId, onProgress = () => {}, libraryId = null, options = {}) {
  const documents = [];
  const sections = [];
  const sourceFiles = [];
  const drawingAnalyses = [];
  let index = 0;
  for (const file of files) {
    index += 1;
    onProgress({
      current: index,
      total: files.length,
      name: file.name,
      stage: 'extracting'
    });
    try {
      const parsedFile = await parseFile(file, options);
      const text = clean(parsedFile.text);
      onProgress({
        current: index,
        total: files.length,
        name: file.name,
        stage: 'detecting'
      });
      const documentId = createIdentifier();
      const parts = buildSpecificationHierarchy(text, file.name);
      const ids = new Map(parts.map(part => [part.key, createIdentifier()]));
      const sectionIds = new Map(parts
        .filter(part => part.hierarchyType === 'spec-section' && part.sectionNumber)
        .map(part => [part.sectionNumber.replace(/\D/g, ''), ids.get(part.key)]));
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const documentRecord = persistDocumentClassification({
        id: documentId, projectId, libraryId, name: file.name,
        title: file.name.replace(/\.[^.]+$/, ''), type: file.type || extension, extension,
        size: file.size, lastModified: file.lastModified || null, category: categoryFor(file.name), tags: [],
        sectionCount: parts.length, characterCount: text.length, lineCount: text ? text.split('\n').length : 0,
        headingCount: parts.filter(part => part.title !== 'Document beginning').length,
        largestSection: Math.max(0, ...parts.map(part => part.text.length)),
        averageSection: parts.length ? Math.round(text.length / parts.length) : 0,
        hierarchyVersion: HIERARCHY_VERSION, indexedAt: new Date().toISOString(), status: 'verified',
        ...(extension === 'pdf' ? { pageCount: parsedFile.pageCount, sourceAvailability: 'pending-registration', drawingAnalysisStatus: 'pending-registration' } : {}),
        health: text.length < 100 ? 'warning' : 'healthy',
        retrievalChunkCount: parts.length,
        specificationSectionCount: parts.filter(part => part.hierarchyType === 'spec-section' && part.sectionNumber).length,
        healthDetail: text.length < 100 ? 'Very little extractable text was found.' : 'Text extraction and hierarchy indexing completed.'
      });
      documents.push(documentRecord);
      parts.forEach((part, order) => {
        const id = ids.get(part.key);
        const parentId = ids.get(part.parentKey) || null;
        const pageRange = part.metadata.pageRange;
        sections.push({
          id, parentId, projectId, libraryId, documentId, documentName: file.name,
          heading: part.title, level: part.hierarchyLevel || 1, kind: part.hierarchyType || 'section',
          hierarchyType: part.hierarchyType || 'section', hierarchyVersion: HIERARCHY_VERSION,
          division: part.division || '', sectionNumber: part.sectionNumber || '', sectionTitle: part.sectionTitle || '',
          path: part.path || [part.title], location: part.location, page: part.pageStart,
          pageStart: part.pageStart, pageEnd: part.pageEnd, pageRange,
          startLine: part.startLine || null, endLine: part.endLine || null, order,
          text: part.text, characters: part.text.length,
          wordCount: part.text.trim() ? part.text.trim().split(/\s+/).length : 0,
          sourceLabel: part.sectionNumber && !part.title.startsWith(part.sectionNumber)
            ? `${part.sectionNumber} — ${part.title}`
            : part.title,
          crossReferences: part.crossReferences,
          crossReferenceIds: part.crossReferences.map(reference => sectionIds.get(reference.replace(/\D/g, ''))).filter(Boolean),
          metadata: { ...part.metadata, parent: parentId },
          citations: [{ document: file.name, pageStart: part.pageStart, pageEnd: part.pageEnd, location: part.location, sectionNumber: part.sectionNumber || '' }]
        });
      });
      if (extension === 'pdf') {
        const storedAt = new Date().toISOString();
        sourceFiles.push(createPdfSourceRecord({ documentId, projectId, sourceBlob: parsedFile.sourceBlob, storedAt }));
        if (documentRecord.documentType === 'drawing-set') drawingAnalyses.push(buildDrawingAnalysis({ documentId, projectId, pages: parsedFile.pages, analyzedAt: storedAt }));
      }
    } catch (error) {
      documents.push(persistDocumentClassification({
        id: createIdentifier(), projectId, libraryId, name: file.name,
        title: file.name.replace(/\.[^.]+$/, ''), type: file.type,
        extension: (file.name.split('.').pop() || '').toLowerCase(), size: file.size,
        lastModified: file.lastModified || null, category: categoryFor(file.name), tags: [],
        sectionCount: 0, characterCount: 0, hierarchyVersion: HIERARCHY_VERSION,
        indexedAt: new Date().toISOString(), status: 'error', health: 'error',
        healthDetail: error.message, error: error.message,
        errorStack: error.stack || ''
      }));
    }
  }
  return { documents, sections, sourceFiles, drawingAnalyses };
}
