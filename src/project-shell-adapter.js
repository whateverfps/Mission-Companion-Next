import { BEDFORD_PROJECT, BEDFORD_PROJECT_ID } from './bedford-project.js';

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];

export function projectIdentity(project = BEDFORD_PROJECT.manifest?.project) {
  return { id: text(project?.id) || BEDFORD_PROJECT_ID, name: text(project?.name) || 'Project', number: '518-22-700', description: text(project?.description) };
}

export function buildProjectShellModel({ project = BEDFORD_PROJECT.manifest?.project, documents = [], milestones = [], workspaces = [], attention = [] } = {}) {
  const identity = projectIdentity(project);
  const nextUp = list(milestones).filter(item => item && item.status !== 'complete' && (item.date || item.targetDate || item.startDate)).sort((a, b) => String(a.date || a.targetDate || a.startDate).localeCompare(String(b.date || b.targetDate || b.startDate)));
  const counts = {
    drawings: list(documents).filter(item => /drawing/i.test(`${item.category || ''} ${item.documentType || ''} ${item.type || ''}`)).length,
    specifications: list(documents).filter(item => /spec/i.test(`${item.category || ''} ${item.documentType || ''} ${item.type || ''}`)).length,
    schedule: list(milestones).filter(item => /schedule|activity/i.test(`${item.category || ''} ${item.type || ''}`)).length,
    submittals: list(milestones).filter(item => /submittal/i.test(`${item.category || ''} ${item.type || ''}`)).length,
    workspaces: list(workspaces).length
  };
  return { identity, nextUp, attention: list(attention), counts, documents: list(documents), workspaces: list(workspaces) };
}

export const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date not reported' : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
};
