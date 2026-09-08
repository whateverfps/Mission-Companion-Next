const text = value => String(value ?? '').trim();
export function buildDocumentsModel(documents = [], sections = []) {
  const records = (Array.isArray(documents) ? documents : []).map(document => ({
    ...document,
    title: text(document.title || document.name) || 'Untitled document',
    category: text(document.category || document.documentType || document.type) || 'Other',
    sourceStatus: document.sourceAvailability || (document.status === 'verified' ? 'Available' : 'Not available'),
    sections: (Array.isArray(sections) ? sections : []).filter(section => section.documentId === document.id)
  }));
  return { records, categories: [...new Set(records.map(item => item.category))].sort() };
}
