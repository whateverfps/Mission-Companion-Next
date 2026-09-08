import { createIdentifier } from './identifiers.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const nowIso = now => {
  try {
    return text(now?.()) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export const WORKSPACE_DRAWING_MARKUP_TYPES = Object.freeze([
  Object.freeze({ id: 'SELECT', label: 'Select' }),
  Object.freeze({ id: 'PAN', label: 'Pan' }),
  Object.freeze({ id: 'PEN', label: 'Pen' }),
  Object.freeze({ id: 'HIGHLIGHTER', label: 'Highlighter' }),
  Object.freeze({ id: 'LINE', label: 'Line' }),
  Object.freeze({ id: 'ARROW', label: 'Arrow' }),
  Object.freeze({ id: 'RECTANGLE', label: 'Rectangle' }),
  Object.freeze({ id: 'ELLIPSE', label: 'Ellipse' }),
  Object.freeze({ id: 'CLOUD', label: 'Cloud' }),
  Object.freeze({ id: 'TEXT', label: 'Text' }),
  Object.freeze({ id: 'CALLOUT', label: 'Callout' })
]);

export const WORKSPACE_DRAWING_MARKUP_TOOL_SECTIONS = Object.freeze([
  Object.freeze({ id: 'recent', label: 'Recent Tools' }),
  Object.freeze({ id: 'my-tools', label: 'My Tools' })
]);

const DEFAULT_STORAGE_KEY = 'mission-companion:workspace-drawing-markups:v1';
const DEFAULT_TOOL_STORAGE_KEY = 'mission-companion:workspace-drawing-tool-chest:v1';

const MARKUP_DEFAULT_STYLE = Object.freeze({
  stroke: '#4dc2c1',
  fill: 'transparent',
  opacity: 1,
  strokeWidth: 2,
  fontSize: 12,
  fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
  textAlign: 'left',
  lineStyle: 'solid',
  textColor: '#e7f7f8'
});

const MARKUP_STYLE_PALETTE = Object.freeze([
  '#d9534f',
  '#2f80ed',
  '#27ae60',
  '#f2c94c',
  '#f2994a',
  '#111111',
  '#ffffff'
]);

function scopeKey(projectId = '', workspaceId = '', drawingSetId = '') {
  return [text(projectId), text(workspaceId), text(drawingSetId)].join('::');
}

export function normalizeMarkupGeometry(geometry = {}, type = '') {
  const markupType = text(type).toUpperCase();
  if (markupType === 'TEXT' || markupType === 'CALLOUT') {
    return Object.freeze({
      x: clamp01(geometry.x),
      y: clamp01(geometry.y),
      width: Math.max(0.01, clamp01(geometry.width || 0.22)),
      height: Math.max(0.01, clamp01(geometry.height || 0.1))
    });
  }
  if (markupType === 'LINE' || markupType === 'ARROW') {
    return Object.freeze({
      x1: clamp01(geometry.x1),
      y1: clamp01(geometry.y1),
      x2: clamp01(geometry.x2),
      y2: clamp01(geometry.y2)
    });
  }
  if (markupType === 'PEN' || markupType === 'HIGHLIGHTER') {
    return Object.freeze({
      points: list(geometry.points).map(point => normalizeMarkupPoint(point)).filter(Boolean)
    });
  }
  if (markupType === 'CLOUD') {
    return Object.freeze({
      x: clamp01(geometry.x),
      y: clamp01(geometry.y),
      width: Math.max(0.01, clamp01(geometry.width || 0.1)),
      height: Math.max(0.01, clamp01(geometry.height || 0.1))
    });
  }
  return Object.freeze({
    x: clamp01(geometry.x),
    y: clamp01(geometry.y),
    width: Math.max(0.01, clamp01(geometry.width || 0.1)),
    height: Math.max(0.01, clamp01(geometry.height || 0.1))
  });
}

export function normalizeMarkupPoint(point = {}) {
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Object.freeze({ x: clamp01(x), y: clamp01(y) });
}

export function normalizeMarkupStyle(style = {}, type = '') {
  const markupType = text(type).toUpperCase();
  const base = { ...MARKUP_DEFAULT_STYLE };
  if (markupType === 'HIGHLIGHTER') {
    base.stroke = '#f6d04d';
    base.fill = 'transparent';
    base.opacity = 0.28;
    base.strokeWidth = 4;
  }
  if (markupType === 'TEXT' || markupType === 'CALLOUT') {
    base.fill = 'transparent';
    base.stroke = '#4dc2c1';
    base.strokeWidth = 1.5;
    base.fontSize = 12;
  }
  if (markupType === 'PEN') {
    base.strokeWidth = 1.5;
  }
  if (markupType === 'LINE' || markupType === 'ARROW' || markupType === 'RECTANGLE' || markupType === 'ELLIPSE' || markupType === 'CLOUD') {
    base.strokeWidth = 1.5;
  }
  return Object.freeze({
    stroke: text(style.stroke || base.stroke) || base.stroke,
    fill: text(style.fill || base.fill) || base.fill,
    opacity: Math.max(0, Math.min(1, Number(style.opacity ?? base.opacity) || base.opacity)),
    strokeWidth: Math.max(0.75, Math.min(8, Number(style.strokeWidth ?? base.strokeWidth) || base.strokeWidth)),
    fontSize: Math.max(9, Math.min(18, Number(style.fontSize ?? base.fontSize) || base.fontSize)),
    fontFamily: text(style.fontFamily || base.fontFamily) || base.fontFamily,
    textAlign: text(style.textAlign || base.textAlign) || base.textAlign,
    lineStyle: text(style.lineStyle || base.lineStyle) || base.lineStyle,
    textColor: text(style.textColor || base.textColor) || base.textColor
  });
}

export function normalizeMarkupDisplayStyle(style = {}, type = '') {
  const normalized = normalizeMarkupStyle(style, type);
  const markupType = text(type).toUpperCase();
  const strokeWidth = markupType === 'HIGHLIGHTER'
    ? Math.max(2.5, Math.min(6, Number(normalized.strokeWidth) || 4))
    : markupType === 'TEXT' || markupType === 'CALLOUT'
      ? Math.max(1, Math.min(2.5, Number(normalized.strokeWidth) || 1.5))
      : Math.max(1, Math.min(3, Number(normalized.strokeWidth) || 1.5));
  const fontSize = markupType === 'TEXT' || markupType === 'CALLOUT'
    ? Math.max(10, Math.min(14, Number(normalized.fontSize) || 12))
    : Number(normalized.fontSize) || 12;
  return Object.freeze({
    ...normalized,
    strokeWidth,
    fontSize,
    fill: markupType === 'HIGHLIGHTER' ? 'transparent' : normalized.fill,
    vectorEffect: 'non-scaling-stroke',
    markerSize: markupType === 'ARROW' || markupType === 'CALLOUT' ? 6 : 0
  });
}

export function getWorkspaceDrawingMarkupPalette() {
  return MARKUP_STYLE_PALETTE.slice();
}

function toMarkupBounds(record = {}) {
  const type = text(record.type).toUpperCase();
  if (type === 'LINE' || type === 'ARROW') {
    const x1 = Number(record.geometry?.x1) || 0;
    const y1 = Number(record.geometry?.y1) || 0;
    const x2 = Number(record.geometry?.x2) || 0;
    const y2 = Number(record.geometry?.y2) || 0;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(0.01, Math.abs(x2 - x1)),
      height: Math.max(0.01, Math.abs(y2 - y1))
    };
  }
  if (type === 'PEN' || type === 'HIGHLIGHTER') {
    const points = list(record.geometry?.points).map(normalizeMarkupPoint).filter(Boolean);
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    if (!points.length) return { x: 0, y: 0, width: 0.01, height: 0.01 };
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(0.01, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(0.01, Math.max(...ys) - Math.min(...ys)),
      points
    };
  }
  return {
    x: Number(record.geometry?.x) || 0,
    y: Number(record.geometry?.y) || 0,
    width: Math.max(0.01, Number(record.geometry?.width) || 0.01),
    height: Math.max(0.01, Number(record.geometry?.height) || 0.01)
  };
}

function cloudPathD(bounds = {}) {
  const x = Number(bounds.x) || 0;
  const y = Number(bounds.y) || 0;
  const width = Math.max(0.01, Number(bounds.width) || 0.01);
  const height = Math.max(0.01, Number(bounds.height) || 0.01);
  const padX = width * 0.16;
  const padY = height * 0.16;
  const points = [
    [x + padX, y],
    [x + width * 0.32, y - padY * 0.15],
    [x + width * 0.48, y],
    [x + width * 0.64, y - padY * 0.1],
    [x + width * 0.80, y],
    [x + width, y + padY],
    [x + width + padX * 0.15, y + height * 0.28],
    [x + width, y + height * 0.44],
    [x + width + padX * 0.08, y + height * 0.62],
    [x + width, y + height * 0.80],
    [x + width - padX, y + height],
    [x + width * 0.68, y + height + padY * 0.12],
    [x + width * 0.50, y + height],
    [x + width * 0.32, y + height + padY * 0.1],
    [x + padX, y + height],
    [x, y + height - padY],
    [x - padX * 0.15, y + height * 0.72],
    [x, y + height * 0.54],
    [x - padX * 0.1, y + height * 0.36],
    [x, y + height * 0.18]
  ];
  const [startX, startY] = points[0];
  const segments = [`M ${startX.toFixed(2)} ${startY.toFixed(2)}`];
  for (let index = 1; index < points.length; index += 1) {
    const [px, py] = points[index - 1];
    const [cx, cy] = points[index];
    const mx = ((px + cx) / 2).toFixed(2);
    const my = ((py + cy) / 2).toFixed(2);
    segments.push(`Q ${mx} ${my} ${cx.toFixed(2)} ${cy.toFixed(2)}`);
  }
  segments.push('Z');
  return segments.join(' ');
}

export function renderWorkspaceDrawingMarkupPrimitive(record = {}, { selected = false } = {}) {
  const type = text(record.type).toUpperCase();
  const style = normalizeMarkupDisplayStyle(record.style || {}, type);
  const stroke = style.stroke || '#4dc2c1';
  const opacity = Math.max(0, Math.min(1, Number(style.opacity ?? 1) || 1));
  const strokeWidth = Math.max(1, Math.min(6, Number(style.strokeWidth ?? 1.5) || 1.5));
  const common = `data-markup-id="${text(record.id)}" class="mc-mdi-markup${selected ? ' is-selected' : ''}" stroke="${stroke}" stroke-width="${strokeWidth}px" vector-effect="${style.vectorEffect || 'non-scaling-stroke'}" opacity="${opacity}"`;
  if (type === 'LINE' || type === 'ARROW') {
    const x1 = (Number(record.geometry?.x1) || 0) * 100;
    const y1 = (Number(record.geometry?.y1) || 0) * 100;
    const x2 = (Number(record.geometry?.x2) || 0) * 100;
    const y2 = (Number(record.geometry?.y2) || 0) * 100;
    const arrowEnd = type === 'ARROW' ? ' marker-end="url(#mc-mdi-arrowhead)"' : '';
    return `<g ${common}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${arrowEnd} fill="none" /><text x="${x2 + 2}" y="${y2 + 2}" class="mc-mdi-markup-label" font-size="${style.fontSize}px" fill="${style.textColor || stroke}">${text(record.subject || record.text || 'Line')}</text></g>`;
  }
  if (type === 'PEN' || type === 'HIGHLIGHTER') {
    const points = list(record.geometry?.points).map(normalizeMarkupPoint).filter(Boolean);
    const d = points.length ? `M ${points.map(point => `${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`).join(' L ')}` : '';
    return `<path ${common} d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  const x = (Number(record.geometry?.x) || 0) * 100;
  const y = (Number(record.geometry?.y) || 0) * 100;
  const width = Math.max(0.01, Number(record.geometry?.width || 0.01) * 100);
  const height = Math.max(0.01, Number(record.geometry?.height || 0.01) * 100);
  if (type === 'TEXT' || type === 'CALLOUT') {
    const leader = type === 'CALLOUT'
      ? `<path d="M ${x.toFixed(2)} ${(y + height / 2).toFixed(2)} L ${(x + Math.min(12, Math.max(4, width * 0.55))).toFixed(2)} ${(y + height / 2).toFixed(2)}" fill="none" marker-end="url(#mc-mdi-arrowhead)" />`
      : '';
    return `<g ${common}>${leader}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5" ry="1.5" fill="none" /><text x="${x + 1.5}" y="${y + 5}" class="mc-mdi-markup-label" font-size="${style.fontSize}px" fill="${style.textColor || stroke}">${text(record.text || 'Text')}</text></g>`;
  }
  if (type === 'CLOUD') {
    return `<path ${common} d="${cloudPathD({ x, y, width, height })}" fill="none" stroke-dasharray="5 3" />`;
  }
  if (type === 'ELLIPSE') {
    return `<ellipse ${common} cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="none" />`;
  }
  return `<rect ${common} x="${x}" y="${y}" width="${width}" height="${height}" fill="none" />`;
}

export function renderWorkspaceDrawingMarkupSelectionOverlay(record = {}) {
  const type = text(record.type).toUpperCase();
  const selected = record?.id ? ` data-markup-id="${text(record.id)}"` : '';
  if (!record?.id) return '';
  if (type === 'LINE' || type === 'ARROW') {
    const x1 = (Number(record.geometry?.x1) || 0) * 100;
    const y1 = (Number(record.geometry?.y1) || 0) * 100;
    const x2 = (Number(record.geometry?.x2) || 0) * 100;
    const y2 = (Number(record.geometry?.y2) || 0) * 100;
    return `<g class="mc-mdi-selection${selected}"><line class="mc-mdi-selection-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" /><circle class="mc-mdi-selection-handle" data-mdi-handle="start" cx="${x1}" cy="${y1}" r="1.8" /><circle class="mc-mdi-selection-handle" data-mdi-handle="end" cx="${x2}" cy="${y2}" r="1.8" /></g>`;
  }
  const bounds = toMarkupBounds(record);
  const x = bounds.x * 100;
  const y = bounds.y * 100;
  const width = bounds.width * 100;
  const height = bounds.height * 100;
  const handles = [
    ['nw', x, y],
    ['n', x + width / 2, y],
    ['ne', x + width, y],
    ['e', x + width, y + height / 2],
    ['se', x + width, y + height],
    ['s', x + width / 2, y + height],
    ['sw', x, y + height],
    ['w', x, y + height / 2]
  ];
  return `<g class="mc-mdi-selection${selected}"><rect class="mc-mdi-selection-box" x="${x}" y="${y}" width="${width}" height="${height}" /><g class="mc-mdi-selection-handles">${handles.map(([handle, cx, cy]) => `<rect class="mc-mdi-selection-handle" data-mdi-handle="${handle}" x="${cx - 1.3}" y="${cy - 1.3}" width="2.6" height="2.6" />`).join('')}</g></g>`;
}

export function normalizeMarkup(record = {}, { existing = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const timestamp = nowIso(now);
  const type = text(record.type || existing?.type || 'RECTANGLE').toUpperCase();
  const style = normalizeMarkupStyle(record.style || existing?.style || {}, type);
  const geometry = normalizeMarkupGeometry(record.geometry || existing?.geometry || {}, type);
  const linkedRecords = {
    issueIds: [...new Set(list(record.linkedRecords?.issueIds || existing?.linkedRecords?.issueIds).map(value => text(value)).filter(Boolean))],
    rfiIds: [...new Set(list(record.linkedRecords?.rfiIds || existing?.linkedRecords?.rfiIds).map(value => text(value)).filter(Boolean))],
    evidenceIds: [...new Set(list(record.linkedRecords?.evidenceIds || existing?.linkedRecords?.evidenceIds).map(value => text(value)).filter(Boolean))],
    observationIds: [...new Set(list(record.linkedRecords?.observationIds || existing?.linkedRecords?.observationIds).map(value => text(value)).filter(Boolean))]
  };
  return Object.freeze({
    id: text(existing?.id || record.id || idFactory()),
    projectId: text(record.projectId || existing?.projectId || ''),
    workspaceId: text(record.workspaceId || existing?.workspaceId || ''),
    drawingSetId: text(record.drawingSetId || existing?.drawingSetId || ''),
    sheetNumber: text(record.sheetNumber || existing?.sheetNumber || ''),
    pdfPageNumber: Number(record.pdfPageNumber ?? existing?.pdfPageNumber ?? 0) || 0,
    type,
    geometry,
    style,
    text: text(record.text || existing?.text || ''),
    author: text(record.author || existing?.author || ''),
    createdAt: text(existing?.createdAt || record.createdAt || timestamp) || timestamp,
    updatedAt: text(record.updatedAt || timestamp) || timestamp,
    status: text(record.status || existing?.status || 'active') || 'active',
    subject: text(record.subject || existing?.subject || ''),
    layer: text(record.layer || existing?.layer || 'default') || 'default',
    linkedRecords
  });
}

function loadCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : list(parsed?.markups);
    return items.map(item => normalizeMarkup(item, { existing: item })).filter(item => item.id);
  } catch {
    return [];
  }
}

function saveCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, markups = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, markups }));
    return true;
  } catch {
    return false;
  }
}

function compareIsoDesc(a = '', b = '') {
  const aTime = new Date(text(a) || 0).getTime();
  const bTime = new Date(text(b) || 0).getTime();
  return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
}

function sortMarkups(a = {}, b = {}) {
  return compareIsoDesc(a.updatedAt, b.updatedAt)
    || compareIsoDesc(a.createdAt, b.createdAt)
    || text(a.type).localeCompare(text(b.type))
    || text(a.subject).localeCompare(text(b.subject))
    || text(a.id).localeCompare(text(b.id));
}

function normalizeTool(tool = {}, { existing = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const timestamp = nowIso(now);
  const markup = existing ? normalizeMarkup(existing.markup || {}, { existing: existing.markup || {}, now, idFactory }) : null;
  const toolMarkup = markup ? {
    ...markup,
    id: text(tool.markup?.id || existing?.markup?.id || markup.id),
    createdAt: text(tool.markup?.createdAt || existing?.markup?.createdAt || markup.createdAt),
    updatedAt: text(tool.markup?.updatedAt || existing?.markup?.updatedAt || markup.updatedAt)
  } : null;
  return Object.freeze({
    id: text(existing?.id || tool.id || idFactory()),
    projectId: text(tool.projectId || existing?.projectId || ''),
    workspaceId: text(tool.workspaceId || existing?.workspaceId || ''),
    drawingSetId: text(tool.drawingSetId || existing?.drawingSetId || existing?.markup?.drawingSetId || ''),
    name: text(tool.name || existing?.name || ''),
    section: text(tool.section || existing?.section || 'recent'),
    subject: text(tool.subject || existing?.subject || ''),
    markup: toolMarkup,
    createdAt: text(existing?.createdAt || tool.createdAt || timestamp) || timestamp,
    updatedAt: text(tool.updatedAt || timestamp) || timestamp
  });
}

function loadToolCollection(storage = globalThis.localStorage, storageKey = DEFAULT_TOOL_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : list(parsed?.tools);
    return items.map(item => normalizeTool(item, { existing: item })).filter(item => item.id);
  } catch {
    return [];
  }
}

function saveToolCollection(storage = globalThis.localStorage, storageKey = DEFAULT_TOOL_STORAGE_KEY, tools = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, tools }));
    return true;
  } catch {
    return false;
  }
}

function scopeRecordFilter(record = {}, projectId = '', workspaceId = '', drawingSetId = '') {
  if (projectId && text(record.projectId) !== text(projectId)) return false;
  if (workspaceId && text(record.workspaceId) !== text(workspaceId)) return false;
  if (drawingSetId && text(record.drawingSetId) !== text(drawingSetId)) return false;
  return true;
}

export function createWorkspaceDrawingMarkupStore({ storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, toolStorageKey = DEFAULT_TOOL_STORAGE_KEY, persistence = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const markupsByScope = new Map();
  const toolsByScope = new Map();

  const scopeId = (projectId = '', workspaceId = '', drawingSetId = '') => scopeKey(projectId, workspaceId, drawingSetId);

  function loadFromPersistence(records = [], tools = [], projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    markupsByScope.set(scope, records.map(record => normalizeMarkup(record, { existing: record, now, idFactory })).filter(record => record.id));
    toolsByScope.set(scope, tools.map(tool => normalizeTool(tool, { existing: tool, now, idFactory })).filter(tool => tool.id));
  }

  function diagnostics() {
    const markups = [...markupsByScope.values()].flat();
    const tools = [...toolsByScope.values()].flat();
    return Object.freeze({
      backend: persistence ? 'IndexedDB' : 'localStorage',
      storageKey,
      toolStorageKey,
      scopeCount: Math.max(markupsByScope.size, toolsByScope.size),
      markupCount: markups.length,
      toolCount: tools.length,
      scopes: [...new Set([...markupsByScope.keys(), ...toolsByScope.keys()])],
      persistenceAvailable: Boolean(persistence)
    });
  }

  async function load(projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    if (markupsByScope.has(scope) || toolsByScope.has(scope)) return list({ projectId, workspaceId, drawingSetId });
    const [markups, tools] = persistence
      ? await Promise.all([
        persistence.loadMarkups ? persistence.loadMarkups(projectId, workspaceId, drawingSetId) : Promise.resolve([]),
        persistence.loadMarkupTools ? persistence.loadMarkupTools(projectId, workspaceId, drawingSetId) : Promise.resolve([])
      ])
      : [loadCollection(storage, storageKey), loadToolCollection(storage, toolStorageKey)];
    loadFromPersistence(markups, tools, projectId, workspaceId, drawingSetId);
    return list({ projectId, workspaceId, drawingSetId });
  }

  function list({ projectId = '', workspaceId = '', drawingSetId = '', sheetNumber = '', pdfPageNumber = null, filter = null } = {}) {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const markups = (markupsByScope.get(scope) || []).filter(record => scopeRecordFilter(record, projectId, workspaceId, drawingSetId));
    return markups.filter(record => {
      if (sheetNumber && text(record.sheetNumber) !== text(sheetNumber)) return false;
      if (pdfPageNumber !== null && pdfPageNumber !== undefined && pdfPageNumber !== '' && Number.isFinite(Number(pdfPageNumber)) && Number(record.pdfPageNumber) !== Number(pdfPageNumber)) return false;
      if (filter && text(filter).toLowerCase() !== 'all' && text(record.type).toLowerCase() !== text(filter).toLowerCase()) return false;
      return true;
    }).map(record => ({ ...record, geometry: structuredClone(record.geometry), style: structuredClone(record.style), linkedRecords: structuredClone(record.linkedRecords) })).sort(sortMarkups);
  }

  function listTools({ projectId = '', workspaceId = '', drawingSetId = '', section = '' } = {}) {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    return (toolsByScope.get(scope) || []).filter(tool => {
      if (section && text(tool.section) !== text(section)) return false;
      return scopeRecordFilter(tool, projectId, workspaceId, drawingSetId);
    }).map(tool => ({ ...tool, markup: tool.markup ? { ...tool.markup, geometry: structuredClone(tool.markup.geometry), style: structuredClone(tool.markup.style), linkedRecords: structuredClone(tool.markup.linkedRecords) } : null })).sort((a, b) => compareIsoDesc(a.updatedAt, b.updatedAt) || text(a.name).localeCompare(text(b.name)));
  }

  async function persistScope(projectId, workspaceId, drawingSetId) {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const markups = markupsByScope.get(scope) || [];
    const tools = toolsByScope.get(scope) || [];
    if (persistence) {
      await Promise.all([
        persistence.saveMarkups ? persistence.saveMarkups(markups.map(record => ({ ...record, geometry: structuredClone(record.geometry), style: structuredClone(record.style), linkedRecords: structuredClone(record.linkedRecords) })), projectId, workspaceId, drawingSetId) : Promise.resolve(),
        persistence.saveMarkupTools ? persistence.saveMarkupTools(tools.map(tool => ({ ...tool, markup: tool.markup ? { ...tool.markup, geometry: structuredClone(tool.markup.geometry), style: structuredClone(tool.markup.style), linkedRecords: structuredClone(tool.markup.linkedRecords) } : null })), projectId, workspaceId, drawingSetId) : Promise.resolve()
      ]);
      return;
    }
    saveCollection(storage, storageKey, markups);
    saveToolCollection(storage, toolStorageKey, tools);
  }

  async function save(record = {}) {
    const normalized = normalizeMarkup(record, { existing: record, now, idFactory });
    if (!normalized.projectId || !normalized.workspaceId || !normalized.drawingSetId || !normalized.sheetNumber) return null;
    const scope = scopeId(normalized.projectId, normalized.workspaceId, normalized.drawingSetId);
    if (!markupsByScope.has(scope)) markupsByScope.set(scope, []);
    const scoped = markupsByScope.get(scope);
    const index = scoped.findIndex(item => item.id === normalized.id);
    if (index >= 0) scoped.splice(index, 1, normalized); else scoped.push(normalized);
    await persistScope(normalized.projectId, normalized.workspaceId, normalized.drawingSetId);
    return { ...normalized, geometry: structuredClone(normalized.geometry), style: structuredClone(normalized.style), linkedRecords: structuredClone(normalized.linkedRecords) };
  }

  async function remove(markupId = '', projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const scoped = markupsByScope.get(scope) || [];
    const index = scoped.findIndex(item => item.id === markupId);
    if (index < 0) return false;
    scoped.splice(index, 1);
    await persistScope(projectId, workspaceId, drawingSetId);
    return true;
  }

  function get(markupId = '', projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const record = (markupsByScope.get(scope) || []).find(item => item.id === markupId) || null;
    return record ? { ...record, geometry: structuredClone(record.geometry), style: structuredClone(record.style), linkedRecords: structuredClone(record.linkedRecords) } : null;
  }

  async function saveTool(tool = {}, markup = null) {
    const normalized = normalizeTool({ ...tool, markup: markup || tool.markup || null }, { existing: tool, now, idFactory });
    if (!normalized.projectId || !normalized.workspaceId || !normalized.drawingSetId) return null;
    const scope = scopeId(normalized.projectId, normalized.workspaceId, normalized.drawingSetId);
    if (!toolsByScope.has(scope)) toolsByScope.set(scope, []);
    const scoped = toolsByScope.get(scope);
    const index = scoped.findIndex(item => item.id === normalized.id);
    if (index >= 0) scoped.splice(index, 1, normalized); else scoped.push(normalized);
    await persistScope(normalized.projectId, normalized.workspaceId, normalized.drawingSetId);
    return { ...normalized, markup: normalized.markup ? { ...normalized.markup, geometry: structuredClone(normalized.markup.geometry), style: structuredClone(normalized.markup.style), linkedRecords: structuredClone(normalized.markup.linkedRecords) } : null };
  }

  function getTool(toolId = '', projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const tool = (toolsByScope.get(scope) || []).find(item => item.id === toolId) || null;
    return tool ? { ...tool, markup: tool.markup ? { ...tool.markup, geometry: structuredClone(tool.markup.geometry), style: structuredClone(tool.markup.style), linkedRecords: structuredClone(tool.markup.linkedRecords) } : null } : null;
  }

  async function deleteTool(toolId = '', projectId = '', workspaceId = '', drawingSetId = '') {
    const scope = scopeId(projectId, workspaceId, drawingSetId);
    const scoped = toolsByScope.get(scope) || [];
    const index = scoped.findIndex(item => item.id === toolId);
    if (index < 0) return false;
    scoped.splice(index, 1);
    await persistScope(projectId, workspaceId, drawingSetId);
    return true;
  }

  return Object.freeze({
    load,
    list,
    get,
    save,
    remove,
    listTools,
    getTool,
    saveTool,
    deleteTool,
    diagnostics
  });
}
