import { expect, it } from 'vitest';
import { runAccessStep, accessDiagnostic } from '../src/lib/server/access-diagnostics';
it('reports stage and a known code without exposing error content', async () => {
  try {
    await runAccessStep('policy-read', async () => {
      throw { code: 7, message: 'private@example.test SECRET', details: 'TOKEN' };
    });
  } catch (error) {
    expect(accessDiagnostic(error)).toEqual({ stage: 'policy-read', code: '7' });
    expect(JSON.stringify(accessDiagnostic(error))).not.toContain('SECRET');
  }
});
it('does not log arbitrary error codes or messages', async () => {
  try {
    await runAccessStep('admin-init', () => {
      throw { code: 'secret-token', message: 'PRIVATE KEY' };
    });
  } catch (error) {
    expect(accessDiagnostic(error)).toEqual({ stage: 'admin-init', code: 'unknown' });
  }
});
it('passes successful values through', async () => {
  expect(await runAccessStep('member-sync', () => 42)).toBe(42);
});
