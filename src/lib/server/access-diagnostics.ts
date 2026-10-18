type Stage = 'admin-init' | 'token-verify' | 'policy-read' | 'member-sync';
const codes = new Set([
  'app/invalid-credential',
  'app/invalid-app-options',
  'auth/internal-error',
  'auth/insufficient-permission',
  'auth/invalid-credential',
  'auth/project-not-found',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
  'ENOTFOUND',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_REQUIRE_ESM'
]);
class AccessFailure extends Error {
  constructor(
    readonly stage: Stage,
    readonly code: string,
    cause: unknown
  ) {
    super('Access service unavailable', { cause });
  }
}
export async function runAccessStep<T>(stage: Stage, run: () => T | Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (failure) {
    const raw =
      failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
    const code =
      typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 16
        ? String(raw)
        : typeof raw === 'string' && codes.has(raw)
          ? raw
          : 'unknown';
    throw new AccessFailure(stage, code, failure);
  }
}
export function accessDiagnostic(failure: unknown) {
  return failure instanceof AccessFailure ? { stage: failure.stage, code: failure.code } : {};
}
