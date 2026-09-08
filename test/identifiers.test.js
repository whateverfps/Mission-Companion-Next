import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentifier } from '../src/identifiers.js';

function withCrypto(value, operation) {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto'
  );

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value
  });

  try {
    return operation();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    } else {
      delete globalThis.crypto;
    }
  }
}

test('identifier helper uses native randomUUID when available', () => {
  const expected = '12345678-1234-4234-8234-123456789abc';
  const actual = withCrypto(
    {
      randomUUID: () => expected,
      getRandomValues: () => {
        throw new Error('getRandomValues should not be used');
      }
    },
    () => createIdentifier()
  );

  assert.equal(actual, expected);
});

test('identifier helper creates a UUID-compatible getRandomValues fallback', () => {
  const actual = withCrypto(
    {
      getRandomValues(bytes) {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      }
    },
    () => createIdentifier()
  );

  assert.match(
    actual,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('identifier helper has a unique last-resort fallback without crypto', () => {
  const identifiers = withCrypto(
    undefined,
    () => Array.from({ length: 500 }, () => createIdentifier())
  );

  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.ok(identifiers.every(identifier => identifier.startsWith('mc-')));
});
