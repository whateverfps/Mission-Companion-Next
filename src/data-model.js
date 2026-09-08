export function textValue(value) {
  return value == null ? '' : String(value);
}

export function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizedText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizedKey(value) {
  return normalizedText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function firstText(...values) {
  return textValue(values.find(value =>
    value != null && textValue(value).trim() !== ''
  ));
}

export function normalizeSectionNumber(value) {
  const digits = textValue(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 6) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  }
  return digits;
}

export function sectionNumberKey(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? firstText(
        value.sectionNumber,
        value.metadata?.sectionNumber,
        value.number,
        value.metadata?.number,
        value.label,
        value.metadata?.label
      )
    : value;
  return normalizeSectionNumber(source).replace(/\D/g, '');
}

export function sectionTextValue(section) {
  return firstText(
    section?.text,
    section?.content,
    section?.metadata?.text,
    section?.metadata?.content
  );
}

export function sectionHeadingValue(section, index = 0) {
  return firstText(
    section?.heading,
    section?.label,
    section?.title,
    section?.metadata?.heading,
    section?.metadata?.title,
    `Section ${Math.max(0, index) + 1}`
  );
}

export function sectionLocationValue(section) {
  return firstText(
    section?.location,
    section?.sectionLabel,
    section?.metadata?.location,
    section?.metadata?.sectionLabel
  );
}

export function sectionSourceLabelValue(section, index = 0) {
  return firstText(
    section?.sourceLabel,
    section?.source,
    section?.metadata?.sourceLabel,
    section?.metadata?.source,
    section?.heading,
    section?.label,
    section?.title,
    `Section ${Math.max(0, index) + 1}`
  );
}

export function normalizeDocumentRecord(document = {}) {
  const source = document && typeof document === 'object' ? document : {};
  return {
    ...source,
    id: firstText(source.id, source.documentId),
    name: firstText(source.name, source.filename, source.title, 'Untitled document'),
    title: firstText(source.title, source.name, source.filename, 'Untitled document'),
    category: firstText(source.category, 'General'),
    projectId: firstText(source.projectId),
    libraryId: firstText(source.libraryId),
    sectionCount: Number.isFinite(Number(source.sectionCount)) ? Number(source.sectionCount) : 0,
    characterCount: Number.isFinite(Number(source.characterCount)) ? Number(source.characterCount) : 0
  };
}

export function normalizeSectionRecord(section = {}, index = 0) {
  const source = section && typeof section === 'object' ? section : {};
  const heading = sectionHeadingValue(source, index);
  const text = sectionTextValue(source);
  const sectionNumber = normalizeSectionNumber(source.sectionNumber ?? source.metadata?.sectionNumber);
  return {
    ...source,
    id: firstText(source.id, source.sectionId),
    documentId: firstText(source.documentId, source.document?.id),
    documentName: firstText(source.documentName, source.document?.name, source.metadata?.document),
    parentId: firstText(source.parentId, source.parent, source.metadata?.parent) || null,
    heading,
    text,
    location: sectionLocationValue(source),
    sourceLabel: sectionSourceLabelValue(source, index),
    sectionNumber,
    division: firstText(source.division, source.metadata?.division, sectionNumber.slice(0, 2)),
    level: Number.isFinite(Number(source.level)) ? Number(source.level) : 1,
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
    path: arrayValue(source.path).map(textValue),
    crossReferences: arrayValue(source.crossReferences).map(normalizeSectionNumber).filter(Boolean),
    metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
  };
}

export function normalizeHierarchyNode(section = {}, index = 0) {
  const normalized = normalizeSectionRecord(section, index);
  return {
    ...normalized,
    hierarchyType: firstText(normalized.hierarchyType, normalized.kind, 'section'),
    hierarchyVersion: Number.isFinite(Number(normalized.hierarchyVersion))
      ? Number(normalized.hierarchyVersion)
      : 0
  };
}

export function normalizeCrossReference(reference = {}) {
  const source = reference && typeof reference === 'object'
    ? reference
    : { sectionNumber: reference };
  return {
    ...source,
    sectionNumber: normalizeSectionNumber(source.sectionNumber ?? source.reference ?? source.target),
    targetId: firstText(source.targetId, source.sectionId) || null,
    resolved: source.resolved === true
  };
}
