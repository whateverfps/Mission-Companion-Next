const list = value => Array.isArray(value) ? value : [];
export function buildControlsModel({ milestones = [], activities = [], submittals = [], risks = [] } = {}) {
  return { milestones: list(milestones), activities: list(activities), submittals: list(submittals), risks: list(risks), scheduleStatus: list(activities).length ? 'Available' : 'Awaiting contractor schedule' };
}
