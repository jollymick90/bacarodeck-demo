import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';

it('loads Firebase Auth and resolves RSA signing keys without require(ESM) support', () => {
  // Match runtimes/instrumentation that cannot bridge CommonJS require() to ESM.
  const script = `
    require('firebase-admin/auth');
    const { generateKeyPairSync, sign, verify } = require('node:crypto');
    const { createServer } = require('node:http');
    const jwksClient = require('jwks-rsa');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'regression', alg: 'RS256', use: 'sig' };
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    server.listen(0, '127.0.0.1', async () => {
      try {
        const client = jwksClient({ jwksUri: 'http://127.0.0.1:' + server.address().port, cache: false });
        const key = await client.getSigningKey('regression');
        const payload = Buffer.from('Firebase signing key regression');
        const signature = sign('RSA-SHA256', payload, privateKey);
        if (!verify('RSA-SHA256', payload, key.getPublicKey(), signature)) throw new Error('Invalid RSA key');
        console.log('auth-runtime-ok');
      } catch (error) { console.error(error); process.exitCode = 1; }
      finally { server.close(); }
    });
  `;
  expect(
    execFileSync(process.execPath, ['--no-experimental-require-module', '-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  ).toBe('auth-runtime-ok');
});
