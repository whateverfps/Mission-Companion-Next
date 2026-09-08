const text = value => String(value ?? '').trim();
export function buildSpecificationsModel({ documents = [], sections = [] } = {}) {
  const records = (Array.isArray(sections) ? sections : []).filter(item => item.sectionNumber || item.metadata?.sectionNumber).map(section => ({ ...section, sectionNumber: text(section.sectionNumber || section.metadata?.sectionNumber), title: text(section.sectionTitle || section.heading || section.title), sourceDocumentId: section.documentId, sourcePage: section.pageStart || section.page || null }));
  const documentRecords = (Array.isArray(documents) ? documents : []).filter(item => /spec/i.test(`${item.category || ''} ${item.documentType || ''} ${item.type || ''}`));
  return { records, documents: documentRecords, divisions: [...new Set(records.map(item => item.sectionNumber.slice(0, 2)).filter(Boolean))].sort() };
}

export function reverseDrawingLookup(relationships = [], sectionNumber = '') { return relationships.filter(item => text(item.sectionNumber).replace(/\s/g, '') === text(sectionNumber).replace(/\s/g, '')); }
