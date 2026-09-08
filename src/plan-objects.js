const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
function hash(value) { let output = 2166136261; for (const character of String(value)) { output ^= character.charCodeAt(0); output = Math.imul(output, 16777619); } return (output >>> 0).toString(36); }

export function createPlanObject({ occurrence, legendEntry = null, scheduleMatch = null, keyedNote = null, referenceIds = [], roomAssociation = null } = {}) {
  if (!occurrence?.documentId || !occurrence?.drawingSetId || !occurrence?.sheetId || !occurrence?.pageNumber) return null;
  const confirmed = occurrence.verification?.status === 'Confirmed' || occurrence.verification?.status === 'Corrected';
  const room = roomAssociation?.method && roomAssociation.method !== 'proximity' ? roomAssociation : roomAssociation ? { ...roomAssociation, status: 'Unverified', label: 'Nearby Room Label — graphical association unverified' } : { room: '', method: 'unavailable', status: 'Unavailable' };
  return { planObjectId: `plan-object-${hash(occurrence.occurrenceId)}`, kind: confirmed && legendEntry ? text(legendEntry.label) : 'Candidate occurrence', documentId: occurrence.documentId, drawingSetId: occurrence.drawingSetId, sheetId: occurrence.sheetId, pageNumber: occurrence.pageNumber, region: occurrence.region, observedLabel: text(occurrence.nearbyText), legendEntryId: legendEntry?.legendEntryId || '', scheduleId: scheduleMatch?.scheduleId || '', scheduleRowId: scheduleMatch?.rowId || '', keyedNoteId: keyedNote?.keyedNoteId || '', referenceIds: [...new Set(list(referenceIds).map(text).filter(Boolean))].sort(), occurrenceVerification: structuredClone(occurrence.verification || { status: 'Unreviewed' }), roomAssociation: room, evidenceBasis: { directPlanEvidence: [occurrence.occurrenceId], derivedLinkage: [legendEntry?.legendEntryId, scheduleMatch?.rowId, keyedNote?.keyedNoteId].filter(Boolean), humanVerifiedFinding: confirmed ? [occurrence.occurrenceId] : [], expertInterpretation: [] }, quantity: null, limitations: [...new Set([...(occurrence.limitations || []), ...(!confirmed ? ['Candidate occurrence is not a definitive installed finding.'] : []), ...(room.status !== 'Confirmed' ? ['Room association is not verified.'] : [])])] };
}

export function planObjectReport(objects = []) {
  const source = list(objects);
  return { directPlanEvidence: source.flatMap(item => item.evidenceBasis?.directPlanEvidence || []), derivedLinkage: source.flatMap(item => item.evidenceBasis?.derivedLinkage || []), humanVerifiedFindings: source.filter(item => item.occurrenceVerification?.status === 'Confirmed' || item.occurrenceVerification?.status === 'Corrected'), expertInterpretation: [], unavailableOrAmbiguous: source.flatMap(item => item.limitations || []), quantities: source.filter(item => item.quantity !== null && item.quantity !== undefined) };
}
