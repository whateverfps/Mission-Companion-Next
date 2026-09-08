import { buildBedfordProjectMilestoneContext } from './workspace-milestones.js';
import { listBedfordWorkspaceRecords } from './workspace-registry.js';
import { buildProjectShellModel } from './project-shell-adapter.js';

export function buildProjectHomeModel({ project, documents = [], milestones = [], attention = [], workspaces = listBedfordWorkspaceRecords() } = {}) {
  const context = buildBedfordProjectMilestoneContext();
  const sourceMilestones = milestones.length ? milestones : context.milestones || [];
  return buildProjectShellModel({ project, documents, milestones: sourceMilestones, attention, workspaces });
}
