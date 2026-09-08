import { buildSpecificationHierarchy } from '../../src/parsers.js';

export const specificationText = `PAGE 10
DIVISION 01 – GENERAL REQUIREMENTS
SECTION 01-45-00: Quality Control
PART 1 - GENERAL
1.1 Owner QC
Owner shall inspect the Work and document deficiencies. See 01 91 00.
1.2 Contractor QC
Contractor shall perform testing before acceptance.
PAGE 11
019100 General Commissioning Requirements
Commissioning records are required. Per Section 01.45.00.`;

export function textFile(name = 'compact-specification.txt', text = specificationText) {
  return {
    name,
    type: 'text/plain',
    size: text.length,
    lastModified: 1700000000000,
    text: async () => text
  };
}

export function hierarchySections(text = specificationText) {
  const parts = buildSpecificationHierarchy(text, 'compact-specification.txt');
  const ids = new Map(parts.map((part, index) => [part.key, `section-${index}`]));
  const sectionIds = new Map(parts
    .filter(part => part.hierarchyType === 'spec-section')
    .map(part => [part.sectionNumber, ids.get(part.key)]));
  return parts.map((part, order) => ({
    ...part,
    id: ids.get(part.key),
    parentId: ids.get(part.parentKey) || null,
    heading: part.title,
    documentId: 'document-1',
    documentName: 'compact-specification.txt',
    projectId: 'project-1',
    libraryId: 'library-1',
    hierarchyVersion: 1,
    level: part.hierarchyLevel,
    order,
    crossReferenceIds: part.crossReferences
      .map(reference => sectionIds.get(reference))
      .filter(Boolean)
  }));
}
