const text = value => String(value || '').trim();

export function resolveChiefSpecificationAnswerPresentation(message = {}) {
  const mode = String(message.mode || '').trim().toLowerCase();
  const deterministicText = text(message?.specificationAnswer?.answer || '');
  const providerText = text(message?.content || '');
  const source = mode === 'offline' ? 'deterministic-sme' : 'provider';
  const visibleText = mode === 'offline'
    ? (deterministicText || providerText)
    : (providerText || deterministicText);

  return {
    source,
    text: visibleText,
    deterministicText,
    providerText
  };
}
