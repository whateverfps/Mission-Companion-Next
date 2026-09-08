const parseFlag = value => value === '1' || value === 'true';

export const pdfTraceEnabled = (() => {
  try {
    const url = new URL(globalThis.location?.href || 'http://localhost/');
    return parseFlag(url.searchParams.get('pdfTrace')) || parseFlag(globalThis.localStorage?.getItem?.('pdfTrace'));
  } catch {
    return false;
  }
})();

export function tracePdfStage(stage, detail = {}) {
  if (!pdfTraceEnabled) return;
  console.info('[pdf-trace]', stage, detail);
}

export function tracePdfError(stage, error, detail = {}) {
  if (!pdfTraceEnabled) return;
  console.error('[pdf-trace:error]', stage, detail, error);
}
