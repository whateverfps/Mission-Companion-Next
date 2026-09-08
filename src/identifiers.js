let fallbackCounter = 0;

function uuidFromBytes(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map(byte =>
    byte.toString(16).padStart(2, '0')
  );

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

function fallbackIdentifier() {
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;

  const timestamp = Date.now().toString(36);
  const highResolution = typeof globalThis.performance?.now === 'function'
    ? Math.floor(globalThis.performance.now() * 1000).toString(36)
    : '0';
  const randomParts = Array.from(
    { length: 4 },
    () => Math.floor(Math.random() * 0x100000000)
      .toString(36)
      .padStart(7, '0')
  ).join('');

  return `mc-${timestamp}-${highResolution}-${fallbackCounter.toString(36)}-${randomParts}`;
}

export function createIdentifier() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return uuidFromBytes(bytes);
  }

  return fallbackIdentifier();
}
