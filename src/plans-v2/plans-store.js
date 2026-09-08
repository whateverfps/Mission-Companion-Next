const clone = value => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? null));
  }
};

export function createPlansStore(initialState = {}) {
  let state = {
    projectId: '',
    drawingSetId: '',
    sheets: [],
    currentSheet: null,
    renderGeneration: 0,
    renderStatus: 'idle',
    requirementsStatus: 'idle',
    requirements: { confirmedSpecifications: [], suggestedSpecifications: [], evidence: [] },
    error: null,
    ...clone(initialState)
  };
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(getState()); };
  const getState = () => clone(state);
  const setState = patch => {
    state = { ...state, ...clone(patch) };
    notify();
    return getState();
  };
  const setSheets = sheets => setState({ sheets: Array.isArray(sheets) ? clone(sheets) : [] });
  const setCurrentSheet = sheet => {
    const nextSheet = sheet ? clone(sheet) : null;
    state = {
      ...state,
      currentSheet: nextSheet,
      renderGeneration: Number(state.renderGeneration) + 1,
      renderStatus: 'loading',
      requirementsStatus: 'loading',
      error: null
    };
    notify();
    return getState();
  };
  const setRenderStatus = renderStatus => setState({ renderStatus });
  const setRequirements = (requirementsStatus, requirements, error = null) => setState({
    requirementsStatus,
    requirements: requirements ? clone(requirements) : state.requirements,
    error
  });
  return {
    subscribe(listener) { listeners.add(listener); listener(getState()); return () => listeners.delete(listener); },
    getState,
    setState,
    setSheets,
    setCurrentSheet,
    setRenderStatus,
    setRequirements
  };
}
