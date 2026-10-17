# Editorial Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Integrare catalogo completo, team, amministrazione accessi, agenda, contenuti bilingui, domande valutabili e PWA.

**Architecture:** SvelteKit API con Firebase Admin e autorizzazione per richiesta. Conservare transazioni e revisioni; separare account, team e slot. Import e suggerimenti richiedono revisione e non sovrascrivono lavoro esistente.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Firebase Admin, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-editorial-hub.md`

## Global Constraints

- npm run build resta il comando Vercel; nessuna sincronizzazione in build.
- Europe/Rome; interviste di 30 minuti, suggerimento fine talk +30 minuti.
- Token Google verificato; SDK client Firestore chiuso; nessun dato privato in cache PWA.
- Nessun import remoto, push o deploy automatico.

## Review Focus

- Account bloccato ma ancora in ALLOW_LIST: blocco effettivo su tutte le API (task 1).
- Import ripetuto con schede già modificate e domande cancellate: preservare il lavoro (task 2/5).
- Cambio giorno, più talk e fine evento: suggerimenti espliciti senza appuntamenti automatici (task 3).
- Richieste concorrenti: revisioni e voti coerenti, senza impersonificazione (task 5).
- Logout/offline: nessun contenuto privato servito dalla cache (task 6).

### Task 1: Accessi amministrabili

Files: `src/lib/server/authorize.ts`, nuovo `src/lib/server/member-access.ts`, `src/routes/api/admin/access/+server.ts`, nuovo `src/lib/components/AccessAdmin.svelte`, `.env.example`, `tests/member-access.test.ts`.

Interface: `getAccessState(identity): Promise<{allowed:boolean;superadmin:boolean}>`, consumo in authorize; gestione accessi solo in API admin, mai tramite API data generica.

- [ ] Test RED: verified Google + permanente ammesso, blocco prevale su ALLOW_LIST, non admin 403, impossibile rimuovere permanente via UI o autopromuoversi.
- [ ] Implementare registro privato aggiunte/blocchi, SUPERADMIN_EMAILS, UI aggiunta/revoca e informazione ruolo in /api/access.
- [ ] GREEN: unitari e test endpoint con emulatore; account personale solo in `.env` privato e istruzioni Vercel.

### Task 2: Catalogo e team

Files: `src/lib/fields.ts`, schema import, `src/lib/domain.ts`, `src/lib/components/Import.svelte`, `src/lib/components/Editor.svelte`, `src/routes/+page.svelte`, `data/seed/`, `tests/domain.test.ts`.

Interfaces: catalogo normalizzato nello schema app; `teamMembers` con ID stabili e ruolo interview/camera; piani mantengono assegnazioni legacy finché migrate esplicitamente.

- [ ] Test RED: tutti gli 84 speaker validi, import ripetuto non sovrascrive, ID compatibili con seed esistente, filtro in/fuori elenco.
- [ ] Implementare pacchetto import completo, selezione membri team per ruolo e Giorgio IT; mantenere account separati.
- [ ] GREEN: unitari, import/assegnazioni browser e API validazione collezioni aggiornate.

### Task 3: Agenda e proposte

Files: nuovi `src/lib/scheduling.ts`, `src/lib/components/Schedule.svelte`, `scripts/fetch-agenda.mjs`, `data/agenda/`, `tests/scheduling.test.ts`; aggiornare schema, fields e route principale.

Interfaces: `suggestInterview(talkEnd:string): string`; `findConflicts(slots: InterviewSlot[]): Conflict[]`. InterviewSlot: ID, originalStart/end, primarySpeakerId, backupSpeakerId, selectedTalkId, chosenStart/end, status, interviewerId, cameraId. Sessioni ufficiali separate e versionate.

- [ ] Test RED: conversione Europe/Rome ottobre, +30 minuti, cambio giorno, 14 coppie preservate, backup non doppia prenotazione, sovrapposizioni e intervalli adiacenti.
- [ ] Importare snapshot e proposta originale; associare ID verificati, segnalare nomi mancanti. Aggiornamento con anteprima, mai overwriting slot scelti/confermati.
- [ ] Implementare vista comparativa e selezione talk per multi-talk; avvisi fuori finestre e conflitti, conservando la proposta originale.
- [ ] GREEN: unitari e browser con due talk, spostamento manuale e refresh agenda.

### Task 4: Contenuti IT/EN

Files: fields, schema, Editor, page, pacchetti `data/seed/`, test dominio/browser.

Interfaces: biographyIt/En e abstractIt/En con indicazione lingua originale e traduzione verificata; fallback ai campi legacy senza cancellarli.

- [ ] Test RED: documento legacy leggibile e modificabile senza perdere testo; traduzione mancante esplicita.
- [ ] Implementare UI bilingue e migrazione revisionabile; preparare traduzioni dei testi disponibili, contrassegnate da verificare.
- [ ] GREEN: validazione pacchetti e browser passaggio IT/EN, mantenimento originale.

### Task 5: Domande e rating

Files: nuovo `src/routes/api/questions/[id]/rating/+server.ts`, `src/lib/components/QuestionRating.svelte`, domain/schema, API data, pacchetto editoriale e test.

Interfaces: POST rating `{score:1..5}` usa UID dal token; aggregazione media/conteggio; cancellazione transazionale con tombstone protetto e controllato anche in import.

- [ ] Test RED: voto fuori range, UID falso, due votanti concorrenti, modifica proprio voto, eliminazione e successivo reimport.
- [ ] Implementare voto personale, media e ordinamento; scarto/eliminazione, protezione reimport. Preparare 10–15 domande IT/EN dove fonti sufficienti con riferimenti; segnalare schede senza materiale.
- [ ] GREEN: unitari/API e browser rating/scarto/cancellazione/anteprima import.

### Task 6: PWA e verifica integrata

Files: `static/manifest.webmanifest`, icone, `static/offline.html`, `src/service-worker.ts`, layout, README, IMPLEMENTATION_REPORT, test browser.

- [ ] Test RED: manifest e icone mancanti, offline fallback, API non presenti in CacheStorage.
- [ ] Implementare installabilità e cache limitata agli asset pubblici; aggiornamenti service worker e messaggio offline, nessuna coda scritture.
- [ ] GREEN: npm test, npm run check, npm run format:check, npm run build; emulatori auth/firestore con suite browser desktop/mobile. Verificare logout e cache.
- [ ] Rileggere diff completo e documentare migrazione, variabile superadmin, agenda consultata, lacune delle fonti e istruzioni deploy. Non effettuare commit/push senza richiesta.

## Requisito aggiunto e approvato: mobile first

Catalogo speaker verticale, nessun carosello orizzontale. Ricerca per nome, organizzazione e tag, tollerante agli accenti; conteggio risultati, filtri compatti richiudibili, reset e stato vuoto. Su telefono elenco e dettaglio sono due viste, con ritorno alla ricerca che conserva filtri e posizione. Verifica con 84 speaker e viewport 390px; tocchi di almeno 44px, navigazione da tastiera e focus gestito.
