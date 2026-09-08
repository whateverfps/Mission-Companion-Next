import { buildBedfordWorkspaceModel, listBedfordWorkspaceRecords } from './workspace-registry.js';
export function buildWorkspacesModel(workspaces = listBedfordWorkspaceRecords()) { return { records: Array.isArray(workspaces) ? workspaces : [] }; }
export function buildWorkspaceDetail(id) { return buildBedfordWorkspaceModel(id).activeWorkspace; }
