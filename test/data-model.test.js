import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstText,
  normalizeCrossReference,
  normalizeDocumentRecord,
  normalizeHierarchyNode,
  normalizeSectionNumber,
  normalizeSectionRecord,
  sectionHeadingValue,
  sectionLocationValue,
  sectionSourceLabelValue,
  sectionTextValue
} from '../src/data-model.js';

test('document records normalize current, legacy, malformed, zero, and false values', () => {
  assert.deepEqual(
    normalizeDocumentRecord({ documentId: 'd1', filename: 'spec.pdf', sectionCount: 0, characterCount: '12' }),
    {
      documentId: 'd1', filename: 'spec.pdf', sectionCount: 0, characterCount: 12,
      id: 'd1', name: 'spec.pdf', title: 'spec.pdf', category: 'General', projectId: '', libraryId: ''
    }
  );
  assert.equal(firstText(null, 0, 'fallback'), '0');
  assert.equal(firstText(undefined, false, 'fallback'), 'false');
  assert.equal(normalizeDocumentRecord(null).name, 'Untitled document');
});

test('section and hierarchy records normalize legacy property names and metadata fallbacks', () => {
  const legacy = {
    sectionId: 's1',
    document: { id: 'd1', name: 'legacy.pdf' },
    title: 'Owner QC',
    content: 'Owner shall inspect.',
    sectionLabel: 'Page 8',
    source: '01 45 00 Owner QC',
    parent: 'parent-1',
    sectionNumber: '01-45-00',
    level: 0,
    order: 0,
    metadata: { division: '01' }
  };
  const section = normalizeSectionRecord(legacy, 5);
  assert.equal(section.id, 's1');
  assert.equal(section.heading, 'Owner QC');
  assert.equal(section.text, 'Owner shall inspect.');
  assert.equal(section.location, 'Page 8');
  assert.equal(section.sourceLabel, '01 45 00 Owner QC');
  assert.equal(section.parentId, 'parent-1');
  assert.equal(section.sectionNumber, '01 45 00');
  assert.equal(section.level, 0);
  assert.equal(section.order, 0);
  assert.equal(normalizeHierarchyNode({ ...legacy, kind: 'heading' }).hierarchyType, 'heading');
});

test('text, heading, location, source label, CSI number, and malformed references are predictable', () => {
  assert.equal(sectionTextValue({ metadata: { content: 'metadata text' } }), 'metadata text');
  assert.equal(sectionHeadingValue({}, 2), 'Section 3');
  assert.equal(sectionLocationValue({ metadata: { location: 'Lines 3-8' } }), 'Lines 3-8');
  assert.equal(sectionSourceLabelValue({ heading: false }), 'false');
  assert.equal(normalizeSectionNumber('01.91.00'), '01 91 00');
  assert.equal(normalizeSectionNumber('bad'), '');
  assert.deepEqual(normalizeCrossReference('26-05-33'), {
    sectionNumber: '26 05 33', targetId: null, resolved: false
  });
});
