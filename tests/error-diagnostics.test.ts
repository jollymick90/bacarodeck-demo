import { expect, it } from 'vitest';
import { errorDiagnostic } from '../src/lib/server/error-diagnostics';
import { runAccessStep } from '../src/lib/server/access-diagnostics';
it('keeps the original message and stack of wrapped access failures', async () => {
  await expect(
    runAccessStep('policy-read', () => {
      throw new Error('8 RESOURCE_EXHAUSTED: Quota exceeded');
    })
  ).rejects.toSatisfy((error: unknown) => {
    const diagnostic = errorDiagnostic(error);
    expect(diagnostic.message).toContain('Quota exceeded');
    expect(diagnostic.stack).toContain('error-diagnostics.test.ts');
    expect(diagnostic.stage).toBe('policy-read');
    return true;
  });
});
it('redacts credentials and email without serializing arbitrary payloads', () => {
  const error = Object.assign(
    new Error('Failed for user@example.test Bearer abc123 password="hunter2" key=known-secret'),
    { details: { token: 'never-print-payload' } }
  );
  const output = JSON.stringify(errorDiagnostic(error, ['known-secret']));
  for (const secret of [
    'user@example.test',
    'abc123',
    'hunter2',
    'known-secret',
    'never-print-payload'
  ])
    expect(output).not.toContain(secret);
  expect(output).toContain('Failed for');
});
it('redacts private keys and JWTs and handles ordinary errors', () => {
  const result = errorDiagnostic(
    new Error(
      '-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY----- eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzZWNyZXQifQ.signature'
    )
  );
  expect(result.message).not.toContain('ABCDEF');
  expect(result.message).not.toContain('eyJ');
  expect(errorDiagnostic(new TypeError('Cannot read properties of undefined')).name).toBe(
    'TypeError'
  );
});
