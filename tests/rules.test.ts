import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  updateDoc,
  type Firestore
} from 'firebase/firestore';
import { commitChanges, removeEntity } from '../src/lib/repository';
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
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'workspaces/codemotion-milano-2026/access/config'), {
      allowedEmails: ['alice@example.test']
    });
    await setDoc(doc(c.firestore(), 'workspaces/codemotion-milano-2026/members/alice'), {
      displayName: 'Alice',
      role: 'editor'
    });
  });
});
function googleContext(uid: string) {
  return env.authenticatedContext(uid, {
    email: uid + '@example.test',
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' }
  });
}
const base = 'workspaces/codemotion-milano-2026/';
it('denies unauthenticated users, outsiders and self enrollment', async () => {
  const outsider = googleContext('outsider').firestore();
  await assertFails(getDocs(collection(outsider, base + 'speakers')));
  await assertFails(
    getDocs(collection(env.unauthenticatedContext().firestore(), base + 'speakers'))
  );
  await assertFails(setDoc(doc(outsider, base + 'members/outsider'), { displayName: 'Me' }));
  await assertFails(setDoc(doc(outsider, base + 'speakers/s'), { id: 's', fullName: 'N' }));
});
it('allows member CRUD, preserves audit, rejects stale edit and delete', async () => {
  // The rules harness returns a compat instance; modular SDK unwraps it internally.
  const db = googleContext('alice').firestore() as unknown as Firestore;
  await commitChanges(db, 'alice', [
    {
      collection: 'sources',
      data: { id: 's', title: 'Fonte', url: 'https://example.com', notesMd: 'old' },
      expectedRevision: null
    }
  ]);
  const old = (await getDoc(doc(db, base + 'sources/s'))).data()!;
  await commitChanges(db, 'alice', [
    {
      collection: 'sources',
      data: { ...old, id: 's', url: 'https://example.org', notesMd: 'new' },
      expectedRevision: 1
    }
  ]);
  const saved = (await getDoc(doc(db, base + 'sources/s'))).data()!;
  expect(saved).toMatchObject({
    url: 'https://example.org',
    notesMd: 'new',
    createdBy: 'alice',
    revision: 2
  });
  expect(saved.createdAt.isEqual(old.createdAt)).toBe(true);
  await expect(
    commitChanges(db, 'alice', [
      { collection: 'sources', data: { ...old, id: 's' }, expectedRevision: 1 }
    ])
  ).rejects.toThrow(/conflitto/i);
  await expect(removeEntity(db, 'sources', { ...old, id: 's' })).rejects.toThrow(/conflitto/i);
  await removeEntity(db, 'sources', { ...saved, id: 's' });
  expect((await getDoc(doc(db, base + 'sources/s'))).exists()).toBe(false);
});
it('aborts entire import when one revision changed', async () => {
  // The rules harness returns a compat instance; modular SDK unwraps it internally.
  const db = googleContext('alice').firestore() as unknown as Firestore;
  await commitChanges(db, 'alice', [
    { collection: 'speakers', data: { id: 's', fullName: 'Name' }, expectedRevision: null }
  ]);
  await expect(
    commitChanges(db, 'alice', [
      {
        collection: 'materials',
        data: { id: 'm', bodyMd: 'x'.repeat(2500) },
        expectedRevision: null
      },
      { collection: 'speakers', data: { id: 's', fullName: 'Other' }, expectedRevision: null }
    ])
  ).rejects.toThrow(/conflitto/i);
  expect((await getDoc(doc(db, base + 'materials/m'))).exists()).toBe(false);
});
it('enforces revision, author, contact restrictions and workspace isolation at rules level', async () => {
  // The rules harness returns a compat instance; modular SDK unwraps it internally.
  const db = googleContext('alice').firestore() as unknown as Firestore;
  const audit = {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: 'alice',
    updatedBy: 'alice',
    revision: 1
  };
  await assertFails(
    setDoc(doc(db, base + 'speakers/private'), {
      id: 'private',
      fullName: 'Name',
      email: 'private@x.it',
      ...audit
    })
  );
  await assertFails(setDoc(doc(db, base + 'unknown/x'), { id: 'x', ...audit }));
  await assertFails(
    setDoc(doc(db, 'workspaces/other/speakers/s'), { id: 's', fullName: 'N', ...audit })
  );
  await assertSucceeds(setDoc(doc(db, base + 'speakers/s'), { id: 's', fullName: 'N', ...audit }));
  await assertFails(
    updateDoc(doc(db, base + 'speakers/s'), {
      fullName: 'Bad',
      revision: 1,
      updatedAt: serverTimestamp()
    })
  );
  await assertFails(
    updateDoc(doc(db, base + 'speakers/s'), {
      createdBy: 'outsider',
      revision: 2,
      updatedAt: serverTimestamp()
    })
  );
});
it('persists insights and nullable Markdown accepted by import schema', async () => {
  const db = googleContext('alice').firestore() as unknown as Firestore;
  await commitChanges(db, 'alice', [
    {
      collection: 'insights',
      data: { id: 'i', bodyMd: 'Interpretazione', provenance: 'member_interpretation' },
      expectedRevision: null
    },
    { collection: 'materials', data: { id: 'null-material', bodyMd: null }, expectedRevision: null }
  ]);
  expect((await getDoc(doc(db, base + 'insights/i'))).data()?.bodyMd).toBe('Interpretazione');
  expect((await getDoc(doc(db, base + 'materials/null-material'))).data()?.bodyMd).toBeNull();
});

it('supports create read update delete for every editorial collection', async () => {
  const { collections, emptyEntity } = await import('../src/lib/fields');
  const db = googleContext('alice').firestore() as unknown as Firestore;
  for (const name of collections) {
    const entity = emptyEntity(name, 'test-speaker');
    if (name === 'speakers') entity.fullName = 'Test Speaker';
    if (name === 'materials') entity.bodyMd = 'contenuto '.repeat(300);
    await commitChanges(db, 'alice', [{ collection: name, data: entity, expectedRevision: null }]);
    const ref = doc(db, base + name + '/' + entity.id);
    const old = (await getDoc(ref)).data()!;
    expect(old.revision).toBe(1);
    await commitChanges(db, 'alice', [
      {
        collection: name,
        data: { ...old, id: entity.id, notesMd: 'Note modificate' },
        expectedRevision: 1
      }
    ]);
    const updated = (await getDoc(ref)).data()!;
    expect(updated.notesMd).toBe('Note modificate');
    expect(updated.revision).toBe(2);
    await removeEntity(db, name, { ...updated, id: entity.id });
    expect((await getDoc(ref)).exists()).toBe(false);
  }
});

it('denies legacy members, unverified identities and removed allowlist entries', async () => {
  const db = googleContext('alice').firestore() as unknown as Firestore;
  await assertSucceeds(getDocs(collection(db, base + 'speakers')));
  await assertFails(getDoc(doc(db, base + 'access/config')));
  await assertFails(
    getDocs(
      collection(
        env
          .authenticatedContext('alice', {
            email: 'alice@example.test',
            email_verified: false,
            firebase: { sign_in_provider: 'google.com' }
          })
          .firestore(),
        base + 'speakers'
      )
    )
  );
  await assertFails(
    getDocs(
      collection(
        env
          .authenticatedContext('alice', {
            email: 'alice@example.test',
            email_verified: true,
            firebase: { sign_in_provider: 'password' }
          })
          .firestore(),
        base + 'speakers'
      )
    )
  );
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), base + 'access/config'), { allowedEmails: [] });
  });
  await assertFails(getDocs(collection(db, base + 'speakers')));
});
