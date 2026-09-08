import test from 'node:test';
import assert from 'node:assert/strict';

const diagnosticsUrl = new URL('../src/diagnostics.js', import.meta.url).href;

test('diagnostics are disabled by default and do not persist or console-log', async () => {
  const writes = [];
  const originalLocalStorage = globalThis.localStorage;
  const originalDiagnosticsEnabled = globalThis.__MC_DIAGNOSTICS_ENABLED;
  const originalDiagnosticsPersistenceEnabled = globalThis.__MC_DIAGNOSTICS_PERSISTENCE_ENABLED;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  try {
    globalThis.__MC_DIAGNOSTICS_ENABLED = false;
    globalThis.__MC_DIAGNOSTICS_PERSISTENCE_ENABLED = false;
    globalThis.localStorage = {
      getItem: () => '[]',
      setItem: (...args) => writes.push(args)
    };
    console.log = () => { throw new Error('console.log should not run when diagnostics are disabled.'); };
    console.warn = () => { throw new Error('console.warn should not run when diagnostics are disabled.'); };
    console.error = () => { throw new Error('console.error should not run when diagnostics are disabled.'); };
    const { logger } = await import(`${diagnosticsUrl}?t=${Date.now()}`);
    logger.debug('sheet-change', { pageId: '61G-000' });
    assert.equal(writes.length, 0);
    assert.equal(logger.list().length, 0);
  } finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.__MC_DIAGNOSTICS_ENABLED = originalDiagnosticsEnabled;
    globalThis.__MC_DIAGNOSTICS_PERSISTENCE_ENABLED = originalDiagnosticsPersistenceEnabled;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
});
