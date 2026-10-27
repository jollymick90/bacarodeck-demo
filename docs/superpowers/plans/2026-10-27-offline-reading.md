# Consultazione offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Riaprire il workspace preparato sullo stesso telefono senza login funzionante o rete, in sola lettura, per 30 giorni dalla verifica riuscita.

**Architecture:** Snapshot IndexedDB atomico separato dall'identità Firebase, indicizzato per progetto/workspace/UID. API autenticate paginate con impronte prima/dopo il download; service worker conserva solo shell pubblica e asset. Workspace distingue accesso verificato online e lettura locale.

**Tech Stack:** Svelte 5/SvelteKit esistenti, IndexedDB nativo, service worker, Vitest e Playwright/Chromium con emulatori Firebase.

**Spec:** `docs/superpowers/specs/2026-10-25-session-offline-design.md` (già approvata).

## Global Constraints

- Accesso locale valido 30 giorni; 401/5xx/rete fallita non rinnovano la validità.
- 403 revoca, logout e cambio account invalidano la copia precedente.
- Nessuna cache HTTP di API private; nessuna scrittura offline o coda.
- Download iniziale esplicito; sostituzione atomica solo dopo pacchetto e shell completi.
- Membri visualizzati inclusi; configurazione accessi, token e strumenti amministrativi esclusi.
- Aggiornamento automatico solo per dispositivi già preparati, intervallo 5 minuti, deduplicato.
- Lavoro in worktree isolato; mantenere le altre modifiche intatte. Nessun deploy senza richiesta.

## Review Focus

- Risposte lente dopo cambio account/logout non ripristinano copie o dati precedenti (Task 2).
- Errori storage e pacchetti interrotti conservano l'ultima copia completa (Task 1).
- Riconnessione con revoca non mostra dati prima di verificare l'accesso (Task 2).
- Dialog aperti prima della disconnessione non inviano modifiche (Task 3).
- Riapertura completa offline su route mai visitate usa una shell pubblica (Task 4).

### Task 1: Pacchetto locale e download consistente

**Files:** Create `src/lib/offline/{snapshot,storage,download}.ts`, `src/lib/server/offline-package.ts`, `src/routes/api/offline/+server.ts`, `tests/offline-{snapshot,package}.test.ts`.
**Interfaces:** `OfflineSnapshot` conserva scope/UID/identità/verifiedAt/downloadedAt/data/members; `OfflineStore` load/save/clear(scope). `downloadSnapshot(request, identity, onprogress, signal)` restituisce il pacchetto completo senza salvarlo. API GET manifest e pagine con versione hash e 50 documenti/massimo 1 MB per pagina; cambiamento → 409 e nuovo tentativo, massimo due download.

- [x] Test RED: scadenza a 30 giorni, scope/UID differenti, download spezzato/cambiato, nessun segreto nel manifest, pagine limitate.
- [x] Implementare storage IndexedDB che attende transaction.oncomplete, API protetta e download che confronta manifest prima/dopo.
- [x] Test GREEN: `npx vitest run tests/offline-snapshot.test.ts tests/offline-package.test.ts`.

### Task 2: Ripristino, revoca e preparazione

**Files:** Modify `src/lib/workspace.svelte.ts`, `src/lib/repository.ts`; Create `src/lib/offline/session.ts`, `tests/offline-session.test.ts`.
**Interfaces:** Workspace espone `readOnly`, `identityUid`, `offlineSnapshot`, `prepareOffline()`, progress/error; repository rifiuta POST quando il workspace non è verificato. Snapshot e lease separati permettono rinnovo senza aggiornare i dati.

- [x] Test RED: 401/5xx/rete con copia valida → sola lettura; 403/scadenza/cambio identità → blocco; nessun rinnovo fallito; logout durante download; errori polling non cancellano dati.
- [x] Implementare sessione locale verificabile e lifecycle con cancellazione/generation, purge prima di signOut, verifica prima di riaprire dopo riconnessione, scadenza anche a pagina aperta.
- [x] Test GREEN: `npx vitest run tests/offline-session.test.ts tests/offline-snapshot.test.ts`.

### Task 3: Consultazione e stato dispositivo

**Files:** Create `src/lib/components/OfflineStatus.svelte`; Modify WorkspaceShell, ConductorPage/Conductor, AssignmentControl, QuestionRating, Editor, Backoffice, InterviewQuestions e controlli di scrittura restanti.
**Interfaces:** Le stesse viste ricevono identityUid anche senza Firebase User; comandi di scrittura disabilitati, navigazione/lingua/filtri/modalità intervista utilizzabili. Pannello globale con preparazione, progresso, conteggi, data contenuti/scadenza, aggiorna.

- [x] Test browser RED: preparazione disponibile, lettura snapshot senza utente, pulsanti mutazione/dialog bloccati, data e scadenza visibili, login per ritornare online.
- [x] Implementare controlli con readOnly reattivo e guardia repository; pannello globale non intrusivo raggiungibile da entrambe le viste.
- [x] GREEN: typecheck e test browser selezionati.

### Task 4: Shell offline e accettazione production-like

**Files:** Modify `src/service-worker.ts`, `static/offline.html`, README/spec; Create `src/lib/offline/shell.ts`, `playwright.offline.config.ts`, `tests/e2e/offline.spec.ts`.
**Interfaces:** MessageChannel `PREPARE_OFFLINE` conferma cache shell corrente completa; navigation fallback HTML pubblico con dati gestiti solo da IndexedDB. Pronto solo dopo ACK worker e commit IndexedDB.

- [x] RED: build production con service worker reale, login/prepara, chiusura browser, offline riapertura `/backoffice` e route speaker/intervista mai visitata. Nessuna API in CacheStorage.
- [x] Implementare shell pubblica generica, precache asset incluse immagini locali, fallback navigation; conservare shell precedente finché quella nuova non è completa.
- [x] GREEN: `npm run check`, `npm test`, `npm run build`, Playwright offline desktop/mobile con emulatori; controllo visivo e review finale. Aggiornare README con uso e limiti verificati.

## Evidenze di consegna

- 27 ottobre: build production e test offline Chromium desktop/mobile passati (2/2).
- Riavvio completo offline, route mai visitate, lingua e domande intervista, mutazioni bloccate, revoca e cache HTTP esclusa verificati.
- Aggiornamento abortito e quota IndexedDB esaurita conservano il pacchetto precedente.
- Review indipendente: corretti scadenza dopo 401, logout cross-tab, revoca durante download, chiusura dialog offline e guardia token del restore.
- Per compatibilità con il divieto di Firebase Admin emulato in produzione, il test usa frontend production/service worker e un backend dev autenticato separato tramite proxy preview solo di test.
