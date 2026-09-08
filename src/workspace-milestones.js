const text = value => value === null || value === undefined ? '' : String(value).trim();

const BEDFORD_NTP_DATE = '2026-08-13';
const BEDFORD_CONTRACT_COMPLETION_DATE = '2028-08-14';
const dates = Object.freeze({ importedAt: '2026-01-06T14:00:00.000Z', indexedAt: '2026-01-06T14:05:00.000Z', lastModified: '2026-01-05T17:00:00.000Z' });

export const BEDFORD_NTP_SOURCE_DOCUMENT = Object.freeze({
  id: 'bedford-ntp-notice-to-proceed',
  projectId: 'bedford',
  libraryId: 'bedford-lib-main',
  name: 'C08 - Notice to Proceed Sawtooth - EHRM Upgrades Bedford MA.pdf',
  originalFilename: 'C08 - Notice to Proceed Sawtooth - EHRM Upgrades Bedford MA.pdf',
  extension: 'pdf',
  mimeType: 'application/pdf',
  category: 'Contractual',
  type: 'report',
  tags: ['Bedford', 'Notice to Proceed', 'Contract', 'Milestone'],
  status: 'verified',
  sectionCount: 0,
  parser: 'built-in bundle',
  hierarchyVersion: 'mc-hierarchy-v2',
  builtIn: true,
  ...dates,
  staticPath: 'project-documents/bedford/drawings/C08 - Notice to Proceed Sawtooth - EHRM Upgrades Bedford MA.pdf',
  role: 'report',
  documentType: 'report'
});

function formatMilestoneDate(dateText = '') {
  if (!dateText) return '';
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateText;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function createMilestone({
  id,
  name,
  dueDate = '',
  status,
  category,
  notes,
  scope = 'PROJECT',
  source = 'Notice to Proceed',
  sourceDocument = BEDFORD_NTP_SOURCE_DOCUMENT
}) {
  return Object.freeze({
    id,
    name,
    dueDate: dueDate || '',
    dueDateLabel: formatMilestoneDate(dueDate),
    status,
    category,
    source,
    scope,
    notes,
    sourceDocumentId: sourceDocument.id,
    sourceDocumentTitle: sourceDocument.originalFilename || sourceDocument.name || sourceDocument.id,
    sourceDocument,
    sourceType: 'NTP / Contractual'
  });
}

export const BEDFORD_PROJECT_MILESTONES = Object.freeze([
  createMilestone({
    id: 'ntp-issued',
    name: 'Notice to Proceed',
    dueDate: BEDFORD_NTP_DATE,
    status: 'complete',
    category: 'contract',
    notes: 'Notice to Proceed issued and contractor acknowledgement recorded.'
  }),
  createMilestone({
    id: 'insurance-certificate',
    name: 'Insurance Certificate',
    dueDate: BEDFORD_NTP_DATE,
    status: 'complete',
    category: 'submittal',
    notes: 'Insurance certificate received and accepted.'
  }),
  createMilestone({
    id: 'performance-payment-bonds',
    name: 'Performance and Payment Bonds',
    dueDate: BEDFORD_NTP_DATE,
    status: 'complete',
    category: 'submittal',
    notes: 'Performance and payment bonds received and accepted.'
  }),
  createMilestone({
    id: 'quality-control-plan',
    name: 'Quality Control Plan',
    dueDate: '2026-08-28',
    status: 'awaiting-submission',
    category: 'submittal',
    notes: 'Fifteen days after Notice to Proceed.'
  }),
  createMilestone({
    id: 'interim-project-schedule',
    name: 'Interim Project Schedule',
    dueDate: '2026-09-03',
    status: 'awaiting-schedule',
    category: 'schedule',
    notes: 'Twenty-one days after Notice to Proceed.'
  }),
  createMilestone({
    id: 'final-project-schedule',
    name: 'Final Project Schedule',
    dueDate: '2026-09-28',
    status: 'awaiting-schedule',
    category: 'schedule',
    notes: 'Forty-five calendar days prior to construction.'
  }),
  createMilestone({
    id: 'accident-prevention-plan',
    name: 'Accident Prevention Plan',
    status: 'pending-date',
    category: 'safety',
    notes: 'Due fifteen days prior to the preconstruction conference; pending until that date is established.'
  }),
  createMilestone({
    id: 'contract-completion',
    name: 'Contract Completion',
    dueDate: BEDFORD_CONTRACT_COMPLETION_DATE,
    status: 'scheduled',
    category: 'contract',
    notes: 'Seven hundred thirty calendar days after Notice to Proceed.'
  })
]);

const milestoneDateIndex = Object.freeze({
  [BEDFORD_NTP_DATE]: 'Notice to Proceed',
  '2026-08-28': 'Quality Control Plan Due',
  '2026-09-03': 'Interim Project Schedule Due',
  '2026-09-28': 'Final Project Schedule Due',
  [BEDFORD_CONTRACT_COMPLETION_DATE]: 'Contract Completion',
  pending: 'APP pending preconstruction conference date'
});

export function buildBedfordProjectMilestoneContext({ workspace = null } = {}) {
  const workspaceLabel = workspace?.room || workspace?.id || 'Workspace';
  const workspaceBuilding = workspace?.building || '61';
  const ntpLabel = formatMilestoneDate(BEDFORD_NTP_DATE);
  const completionLabel = formatMilestoneDate(BEDFORD_CONTRACT_COMPLETION_DATE);
  const nextSteps = [
    {
      id: 'milestone-qcp',
      label: 'Quality Control Plan',
      detail: 'Submit the Quality Control Plan fifteen days after Notice to Proceed.',
      dueDate: '2026-08-28',
      dueDateLabel: formatMilestoneDate('2026-08-28'),
      status: 'awaiting-submission',
      category: 'submittal',
      scope: 'PROJECT',
      source: 'NTP'
    },
    {
      id: 'milestone-interim-schedule',
      label: 'Interim Project Schedule',
      detail: 'Submit the interim project schedule twenty-one days after Notice to Proceed.',
      dueDate: '2026-09-03',
      dueDateLabel: formatMilestoneDate('2026-09-03'),
      status: 'awaiting-schedule',
      category: 'schedule',
      scope: 'PROJECT',
      source: 'NTP'
    },
    {
      id: 'milestone-final-schedule',
      label: 'Final Project Schedule',
      detail: 'Prepare the final project schedule forty-five calendar days before construction.',
      dueDate: '2026-09-28',
      dueDateLabel: formatMilestoneDate('2026-09-28'),
      status: 'awaiting-schedule',
      category: 'schedule',
      scope: 'PROJECT',
      source: 'NTP'
    },
    {
      id: 'milestone-app',
      label: 'Accident Prevention Plan',
      detail: 'Hold until the preconstruction conference date is established.',
      dueDate: '',
      dueDateLabel: 'Pending date',
      status: 'pending-date',
      category: 'safety',
      scope: 'PROJECT',
      source: 'NTP'
    },
    {
      id: 'milestone-cor',
      label: 'COR coordination',
      detail: 'Coordinate with the COR before commencing work.',
      dueDate: BEDFORD_NTP_DATE,
      dueDateLabel: ntpLabel,
      status: 'complete',
      category: 'coordination',
      scope: 'PROJECT',
      source: 'NTP'
    }
  ];

  const timeline = BEDFORD_PROJECT_MILESTONES.map(milestone => ({
    id: milestone.id,
    label: milestoneDateIndex[milestone.dueDate || 'pending'] || milestone.name,
    detail: milestone.notes,
    dueDate: milestone.dueDate,
    dueDateLabel: milestone.dueDateLabel || (milestone.dueDate ? formatMilestoneDate(milestone.dueDate) : 'Pending date'),
    status: milestone.status,
    category: milestone.category,
    scope: milestone.scope,
    source: milestone.source,
    sourceDocumentId: milestone.sourceDocumentId
  }));

  const scheduleStatus = 'Awaiting Interim Schedule';
  const roomScheduleStatus = 'Awaiting Contractor Schedule';
  const projectPhaseLabel = 'Preconstruction';
  const summary = `The project is in the ${projectPhaseLabel} phase under Notice to Proceed dated ${ntpLabel}. The interim contractor schedule is ${scheduleStatus.toLowerCase()}, and room-level construction dates remain ${roomScheduleStatus.toLowerCase()} until the contractor schedule is established.`;
  return Object.freeze({
    sourceDocument: BEDFORD_NTP_SOURCE_DOCUMENT,
    sourceType: 'NTP / Contractual',
    contractNumber: '518-22-700',
    ntpDate: BEDFORD_NTP_DATE,
    ntpDateLabel: ntpLabel,
    contractorAcknowledgementDate: BEDFORD_NTP_DATE,
    contractorAcknowledgementDateLabel: ntpLabel,
    contractDurationCalendarDays: 730,
    contractCompletionDate: BEDFORD_CONTRACT_COMPLETION_DATE,
    contractCompletionDateLabel: completionLabel,
    projectPhase: projectPhaseLabel,
    scheduleStatus,
    roomScheduleStatus,
    roomScheduleLabel: `Room Schedule: ${roomScheduleStatus}`,
    currentProjectStatus: `Project Phase: ${projectPhaseLabel}`,
    milestones: BEDFORD_PROJECT_MILESTONES.map(item => ({ ...item })),
    timeline,
    nextSteps,
    summary,
    workspaceId: workspace?.id || '',
    workspaceBuilding,
    workspaceRoom: workspaceLabel,
    workspaceScope: 'PROJECT',
    corCoordinationRequired: true
  });
}
