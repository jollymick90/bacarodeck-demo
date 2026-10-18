import { accessDiagnostic } from './access-diagnostics';

function redact(text: string, secrets: string[]): string {
  let safe = text;
  for (const secret of secrets
    .filter((value) => value.length >= 4)
    .sort((a, b) => b.length - a.length)) {
    safe = safe.split(secret).join('[REDACTED]');
  }
  return safe
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      '[PRIVATE KEY REDACTED]'
    )
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN REDACTED]')
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:password|passwd|secret|token|api[_-]?key|private[_-]?key|authorization|cookie)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDACTED]')
    .slice(0, 8000);
}

export function errorDiagnostic(failure: unknown, secrets: string[] = []) {
  // Select diagnostic fields only. Do not serialize Firebase payloads or request objects.
  const root =
    failure && typeof failure === 'object' && 'cause' in failure && failure.cause
      ? failure.cause
      : failure;
  const record = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
  const message =
    typeof record.message === 'string'
      ? record.message
      : typeof root === 'string'
        ? root
        : 'Unknown server error';
  return {
    ...accessDiagnostic(failure),
    name: redact(typeof record.name === 'string' ? record.name : 'Error', secrets),
    message: redact(message, secrets),
    ...(typeof record.stack === 'string' ? { stack: redact(record.stack, secrets) } : {})
  };
}
