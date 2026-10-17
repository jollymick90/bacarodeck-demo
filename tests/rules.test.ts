import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bacarodeck',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') }
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it('denies direct SDK access even to verified Google members and legacy policy entries', async () => {
  const base = 'workspaces/codemotion-milano-2026/';
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), base + 'members/alice'), { role: 'editor' });
    await setDoc(doc(context.firestore(), base + 'access/config'), {
      allowedEmails: ['alice@example.test']
    });
  });
  for (const context of [
    env.unauthenticatedContext(),
    env.authenticatedContext('alice', {
      email: 'alice@example.test',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    })
  ]) {
    const db = context.firestore();
    for (const name of [
      'speakers',
      'talks',
      'sources',
      'materials',
      'insights',
      'questions',
      'interviewPlans',
      'members',
      'access'
    ]) {
      await assertFails(getDocs(collection(db, base + name)));
      await assertFails(getDoc(doc(db, base + name + '/test')));
      await assertFails(setDoc(doc(db, base + name + '/test'), { id: 'test' }));
    }
  }
});
