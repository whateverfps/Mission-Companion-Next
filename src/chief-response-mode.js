const text = value => String(value || '').trim().toLowerCase();

export function normalizeChiefResponseMode(value) {
  const mode = text(value);

  if (mode === 'offline' || mode === 'offline-evidence' || mode === 'source-only-evidence') return 'offline';
  if (mode === 'source' || mode === 'source-only' || mode === 'source-only-ai') return 'source';
  if (mode === 'assisted' || mode === 'expert-assisted' || mode === 'expert-assisted-ai') return 'assisted';
  if (mode === 'general' || mode === 'general-ai' || mode === 'general-assistant' || mode === 'general-assistant-ai') return 'general';

  return 'offline';
}

export function missionControlVisibleResponseMode(mode) {
  return normalizeChiefResponseMode(mode) === 'offline' ? 'offline' : 'assisted';
}

export function missionControlResponseModeLabel(mode) {
  return {
    offline: 'Source Evidence',
    assisted: 'Chief Analysis'
  }[missionControlVisibleResponseMode(mode)] || 'Source Evidence';
}

export function resolveChiefResponseModeSelection({
  selectedOptionText = '',
  selectedOptionValue = '',
  uiStateMode = 'offline'
} = {}) {
  const normalizedMode = normalizeChiefResponseMode(selectedOptionValue || uiStateMode);
  return {
    selectedOptionText: String(selectedOptionText || ''),
    selectedOptionValue: String(selectedOptionValue || ''),
    uiStateMode: normalizeChiefResponseMode(uiStateMode),
    normalizedMode,
    modePassedToEngine: normalizedMode
  };
}
