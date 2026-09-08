export function createDrawingInteractionSession({ settleMs = 200, requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis), cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis), onSettle = () => {} } = {}) {
  let interactionType = '';
  let active = false;
  let pendingFrame = 0;
  let settleTimer = 0;
  let latestViewport = null;
  let context = null;

  const clearTimers = () => {
    if (pendingFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingFrame);
    }
    pendingFrame = 0;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    }
  };

  const snapshot = () => ({
    interactionType,
    active,
    latestViewport: latestViewport ? structuredClone(latestViewport) : null,
    context
  });

  const settle = () => {
    settleTimer = 0;
    active = false;
    onSettle(snapshot());
  };

  return {
    begin(nextType, nextContext = null) {
      interactionType = String(nextType || '');
      active = true;
      context = nextContext || context;
      clearTimers();
      return snapshot();
    },

    updateContext(nextContext = null) {
      context = nextContext || context;
      return snapshot();
    },

    updateViewport(nextViewport = null) {
      latestViewport = nextViewport ? { ...(latestViewport || {}), ...nextViewport } : latestViewport;
      return snapshot();
    },

    scheduleFrame(callback) {
      if (typeof requestAnimationFrame !== 'function') {
        callback?.(snapshot());
        return 0;
      }

      if (pendingFrame) {
        return pendingFrame;
      }

      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        callback?.(snapshot());
      });

      return pendingFrame;
    },

    settleSoon() {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, Math.max(0, Number(settleMs) || 0));
      return settleTimer;
    },

    flushNow() {
      clearTimers();
      if (active) settle();
    },

    cancel() {
      interactionType = '';
      active = false;
      latestViewport = null;
      context = null;
      clearTimers();
    },

    snapshot,
    isActive: () => active,
    latestViewport: () => (latestViewport ? structuredClone(latestViewport) : null),
    context: () => context
  };
}