import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

// Explicit administrative publication, never called by a runtime login request.
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
const emulator =
  process.env.PUBLIC_USE_EMULATORS === 'true' && !!process.env.FIRESTORE_EMULATOR_HOST;
function configError(message) {
  console.error(message);
  process.exit(1);
}
if (!projectId) configError('Configura PUBLIC_FIREBASE_PROJECT_ID.');
if (process.env.ALLOW_LIST === undefined)
  configError('Configura ALLOW_LIST; usa una stringa vuota per revocare tutti gli accessi.');
if (process.env.FIRESTORE_EMULATOR_HOST && !emulator)
  configError('Configurazione emulatore incoerente: pubblicazione annullata.');
let credential;
if (emulator) credential = applicationDefault();
else if (process.env.FIREBASE_ADMIN_KEY) {
  let account;
  try {
    account = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
  } catch {
    configError('FIREBASE_ADMIN_KEY deve contenere JSON valido.');
  }
  if (account.project_id !== projectId)
    configError('FIREBASE_ADMIN_KEY deve appartenere allo stesso PUBLIC_FIREBASE_PROJECT_ID.');
  try {
    credential = cert(account);
  } catch {
    configError('FIREBASE_ADMIN_KEY non è un service account valido.');
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credential = applicationDefault();
else configError('Configura FIREBASE_ADMIN_KEY sul server o GOOGLE_APPLICATION_CREDENTIALS.');
const allowedEmails = [
  ...new Set(
    process.env.ALLOW_LIST.split(/[,;\n]/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  )
].sort();
const app = initializeApp({ projectId, credential });
const db = getFirestore(app);
try {
  await db
    .doc('workspaces/codemotion-milano-2026/access/config')
    .set({ allowedEmails, updatedAt: FieldValue.serverTimestamp() });
  console.log(
    `ALLOW_LIST pubblicata: ${allowedEmails.length} account, workspace codemotion-milano-2026.`
  );
} catch {
  console.error(
    'Pubblicazione non riuscita. Controlla connessione, progetto e permessi del service account.'
  );
  process.exitCode = 1;
} finally {
  await db.terminate();
}
