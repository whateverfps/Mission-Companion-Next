const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
export const normalizeSpecificationNumber = value => text(value).replace(/\D/g, '').replace(/^(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3');
const keyFor = (documentId, number) => `${text(documentId)}:${normalizeSpecificationNumber(number).replace(/\s/g, '')}`;

function articleKind(value) {
  const heading = text(value).toLowerCase();
  const categories = [['submittals','submittal'], ['quality assurance','quality assurance'], ['testing','test'], ['inspection','inspection'], ['commissioning','commission'], ['closeout','closeout'], ['products/materials','product'], ['products/materials','material'], ['execution','execution'], ['examination/preparation','examin'], ['examination/preparation','prepar'], ['installation','install'], ['protection','protection']];
  return categories.find(([, needle]) => heading.includes(needle))?.[0] || '';
}

export function createSpecificationIndex({ storage = globalThis.localStorage, storageKey = 'mission-companion:specification-index:v1' } = {}) {
  const documents = new Map();
  const sections = new Map();
  const load = () => {
    try {
      const saved = JSON.parse(storage?.getItem?.(storageKey) || '{}');
      for (const item of list(saved.documents)) documents.set(item.documentId, item);
      for (const item of list(saved.sections)) sections.set(keyFor(item.documentId, item.sectionNumber), item);
    } catch { /* optional intelligence remains empty */ }
  };
  const save = () => { try { storage?.setItem?.(storageKey, JSON.stringify({ documents: [...documents.values()], sections: [...sections.values()] })); return true; } catch { return false; } };
  load();
  return {
    index({ document = {}, sourceSections = [], tocRows = [], revisionSource = null } = {}) {
      const documentId = text(document.id || document.documentId);
      if (!documentId || !text(document.projectId)) return { ok: false, reason: 'Specification document ownership is unavailable.', sections: [] };
      const authoritativeRows = list(sourceSections).filter(item => item.hierarchyType === 'spec-section');
      const rows = list(tocRows).length ? tocRows : authoritativeRows.length ? authoritativeRows : list(sourceSections).filter(item => normalizeSpecificationNumber(item.sectionNumber || item.metadata?.sectionNumber));
      const childrenByParent = new Map();
      for (const item of list(sourceSections)) if (item.parentId) childrenByParent.set(item.parentId, [...(childrenByParent.get(item.parentId) || []), item]);
      const descendants = parentId => {
        const output = []; const queue = [...list(childrenByParent.get(parentId))]; const visited = new Set();
        while (queue.length && output.length < 200) { const item = queue.shift(); if (!item?.id || visited.has(item.id)) continue; visited.add(item.id); output.push(item); queue.push(...list(childrenByParent.get(item.id))); }
        return output;
      };
      const normalized = rows.map((row, index) => {
        const sectionNumber = normalizeSpecificationNumber(row.sectionNumber || row.metadata?.sectionNumber);
        const pageStart = Number(row.pageStart || row.page || row.metadata?.pageRange?.start) || null;
        const next = rows[index + 1];
        const pageEnd = Number(row.pageEnd || row.metadata?.pageRange?.end) || (Number(next?.pageStart || next?.page || next?.metadata?.pageRange?.start) ? Number(next.pageStart || next.page || next.metadata.pageRange.start) - 1 : pageStart);
        return {
          specificationSectionId: text(row.id || row.sectionId) || keyFor(documentId, sectionNumber), projectId: text(document.projectId), documentId,
          division: text(row.division || row.metadata?.division || sectionNumber.slice(0, 2)), sectionNumber, normalizedSectionNumber: sectionNumber.replace(/\s/g, ''),
          sectionTitle: text(row.sectionTitle || row.title || row.heading || row.sourceLabel).replace(new RegExp(`^${sectionNumber.replace(/\s/g, '\\s*')}\\s*[-—:]?\\s*`, 'i'), ''),
          startPdfPage: pageStart, endPdfPage: Math.max(pageStart || 0, pageEnd || 0) || null, internalPages: list(row.internalPages),
          articles: [...list(row.articles), ...descendants(row.id)].map(article => ({ id: text(article.id), heading: text(article.heading || article.title), pageNumber: Number(article.pageNumber || article.page || article.pageStart) || null, kind: articleKind(article.heading || article.title) })).filter(article => article.heading && article.kind),
          references: list(row.crossReferences || row.references).map(normalizeSpecificationNumber).filter(Boolean), revisionSource: revisionSource ? structuredClone(revisionSource) : null,
          supersessionStatus: text(row.supersessionStatus || 'current'), verificationState: text(row.verificationState || row.metadata?.verificationState || 'indexed')
        };
      }).filter(item => item.sectionNumber && item.startPdfPage);
      for (const item of normalized) sections.set(keyFor(documentId, item.sectionNumber), item);
      documents.set(documentId, { documentId, projectId: text(document.projectId), title: text(document.title || document.name), documentType: 'specifications', revision: text(document.revision), issueDate: text(document.issueDate), sourceIdentity: text(document.sourceIdentity || document.name), supersessionStatus: text(document.supersessionStatus || 'current'), indexedAt: new Date().toISOString() });
      save();
      return { ok: true, document: structuredClone(documents.get(documentId)), sections: structuredClone(normalized) };
    },
    get(documentId, sectionNumber) { const item = sections.get(keyFor(documentId, sectionNumber)); return item ? structuredClone(item) : null; },
    find(query, { projectId = '', documentId = '' } = {}) {
      const needle = text(query).toLowerCase().replace(/[-.]/g, ' ');
      return [...sections.values()].filter(item => (!projectId || item.projectId === projectId) && (!documentId || item.documentId === documentId)
        && `${item.sectionNumber} ${item.normalizedSectionNumber} ${item.sectionTitle}`.toLowerCase().includes(needle)).map(item => structuredClone(item));
    },
    sections({ projectId = '', documentId = '' } = {}) { return [...sections.values()].filter(item => (!projectId || item.projectId === projectId) && (!documentId || item.documentId === documentId)).map(item => structuredClone(item)); },
    documents() { return [...documents.values()].map(item => structuredClone(item)); },
    answerContext(section, articleId = '') {
      if (!section) return null;
      const article = articleId ? section.articles?.find(item => item.id === articleId) : null;
      return { documentId: section.documentId, sectionNumber: section.sectionNumber, sectionTitle: section.sectionTitle, startPdfPage: section.startPdfPage, endPdfPage: section.endPdfPage, article: article ? structuredClone(article) : null };
    }
  };
}
