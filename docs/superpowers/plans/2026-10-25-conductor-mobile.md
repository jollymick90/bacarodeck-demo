# Conductor Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Nessuna implementazione prima della revisione del piano.

**Goal:** Rendere utilizzabile sul telefono la preparazione editoriale condivisa, con interessi visibili al gruppo, assegnazioni coerenti e scaletta pronta.

**Architecture:** Conservare la pagina attuale come backoffice e introdurre una home conduttore sugli stessi dati. Interessi per account autenticato e scalette per speaker/talk sono nuovi dati condivisi, con mutazioni server autenticate. Un solo servizio gestisce le assegnazioni anche quando vengono modificate dal backoffice.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Firebase Admin/Firestore, Vitest e Playwright già presenti. Nessuna nuova dipendenza necessaria per questa fase.

**Spec:** `docs/superpowers/specs/2026-10-25-conductor-mobile-design.md`

## Global Constraints

- «Il salvataggio esprime interesse, attribuito a una persona e visibile a tutto il team.»
- «Testi, scelta e ordine delle domande sono condivisi. Non esistono scalette private.»
- «Le tre domande principali sono inizialmente suggerite dall'autore; i conduttori possono modificarle, sostituirle e riordinarle.»
- «Chiunque può assegnare sé o un collega; sostituire un assegnatario richiede un popup di allerta e conferma.»
- «Le due viste lavorano sugli stessi dati.»
- Tutti i conduttori autorizzati accedono a entrambe le viste; gestione accessi e ripristino completo conservano i privilegi attuali.
- Nessun deploy o aggiornamento di dati remoti durante l'implementazione locale.

## Confini delle due fasi

Questo piano consegna autonomamente home, scheda, scaletta, interessi e assegnazione. Il grafo 3D e l'aggiornamento semantico automatico sono la seconda fase della stessa specifica: non vengono sostituiti con un grafo statico né dichiarati completati da questa consegna. In questa fase i topic esistenti filtrano gli speaker; non mostrare pulsanti per un grafo non disponibile.

Prima della seconda fase occorre un piano dedicato, basato su documentazione ufficiale aggiornata, che scelga: normalizzazione dei topic, servizio semantico multilingue e relativi costi, coda persistente e worker compatibile con Vercel, rendering 3D e fallback, integrazione di import/export e scarti. Usare revisioni degli input, ricalcolo incrementale e separazione tra risultati automatici e interventi manuali come vincoli già approvati, non come nuove domande di prodotto.

## Review Focus

1. Più account interessati allo stesso speaker: rimuovere il proprio interesse lascia intatti gli altri (Task 2).
2. Assegnazione cambiata da un collega mentre il popup è aperto: nuova conferma, nessuna sovrascrittura silenziosa (Task 3).
3. Speaker con più talk o meno di tre domande: contesto esplicito e nessun riempimento inventato (Task 4–5).
4. Ricerca Markdown con domande non strutturate: promozione esplicita, nessuna importazione automatica di paragrafi (Task 4).
5. Account rimosso o campi legacy incompleti: visualizzare nome storico e stato mancante senza impedire l'accesso alla scheda (Task 2–5).

## Decisioni tecniche proposte

- Identità degli interessi: UID dell'account Google; nome visibile dal profilo membro già presente. Il team editoriale resta l'elenco per le assegnazioni. Nessuna associazione automatica tra nomi Google e persone del team.
- Collezione `speakerInterests`: un documento con ID deterministico da hash SHA-256 di UID e speakerId; campi `speakerId`, `memberUid` e audit. Il client non può dichiarare un UID diverso dal proprio.
- Collezione `conductorBriefs`: un documento per speaker e talk con ID deterministico, `speakerId`, `talkId` facoltativo, `summaryIt`, `summaryEn`, `mainQuestionIds` ordinati e `classicQuestionIds`. Massimo tre principali, ID unici. Le domande rimangono nella collezione esistente.
- Assegnazione canonica nel piano intervista: aggiungere `assignedTeamId`, mantenendo leggibili `assignedToUid`/`assignedToName` per i dati storici. Sincronizzare gli slot associati allo speaker nella medesima transazione. Aggiungere `primarySpeakerId` agli slot; risolvere i nomi storici solo se corrispondono a una singola persona del catalogo. Segnalare i casi ambigui senza associarli automaticamente.
- Evitare un grande refactor: estrarre la pagina attuale in `Backoffice.svelte` con il minimo adattamento e un contenitore di autenticazione/dati condiviso. La home diventa la vista iniziale; il backoffice ha un URL navigabile.
- Domande IT/EN: la modifica riguarda la lingua selezionata e non riscrive la traduzione opposta. Mostrare il fallback se manca una lingua, senza presentarlo come traduzione verificata.
- Condivisione: riusare il refresh locale dopo mutazione e il polling esistente per gli altri dispositivi; non promettere push in tempo reale. Il successivo piano del grafo dovrà considerare un refresh del relativo stato di elaborazione.

## Task 1: Separare la vista backoffice e definire il modello

**Files:** modificare `src/routes/+page.svelte`, `src/lib/fields.ts`, `src/lib/domain.ts`, `schemas/speaker-research-import.schema.json`; creare `src/lib/components/Backoffice.svelte`, `src/routes/backoffice/+page.svelte`, `src/lib/conductor/types.ts`, `src/lib/conductor/brief.ts`, `tests/conductor-model.test.ts`.

**Interfaces:** produrre `ConductorBrief`, `SpeakerInterest` e `briefId(speakerId: string, talkId?: string): string`; `resolveBrief(data: Dataset, speakerId: string, talkId?: string): ResolvedBrief`, con `mainQuestions`, `classicQuestions`, `summary`, `summaryOrigin: 'editorial' | 'abstract_excerpt' | 'missing'`, `selectionOrigin: 'editorial' | 'legacy_proposal' | 'empty'`.

- [ ] Scrivere test che rifiutano quattro principali, duplicati e riferimenti a domande di un altro speaker; accettano zero, una o due principali e brief separati per talk.
- [ ] Eseguire `npm test -- tests/conductor-model.test.ts`: verificare il fallimento sulle nuove interfacce.
- [ ] Implementare modello e validazione; senza brief esistente proporre al massimo tre domande attive già ordinate, escludendo `rejected`, senza scrivere dati automaticamente o chiamare la proposta «scelta dall'autore». Titolo ed estratto dell'abstract costituiscono il fallback della sintesi.
- [ ] Estrarre il backoffice e il contenitore condiviso di autenticazione/dati, preservando editor, ricerca, import, accessi e programmazione. Non duplicare inizializzazioni Firebase o subscription tra viste.
- [ ] Eseguire `npm run check`, `npm test -- tests/conductor-model.test.ts` e lo smoke browser esistente del backoffice. Atteso: nessun errore e funzionalità precedenti raggiungibili.
- [ ] Committare modello e separazione delle viste.

## Task 2: Interessi condivisi e home mobile

**Files:** creare `src/lib/server/conductor-interests.ts`, `src/routes/api/conductor/interests/+server.ts`, `src/lib/components/conductor/SpeakerHome.svelte`, `src/lib/conductor/home.ts`, `tests/conductor-interests.test.ts`, `tests/conductor-home.test.ts`; modificare `src/lib/repository.ts`, `src/lib/server/firestore-cache.ts`, `src/routes/+page.svelte`.

**Interfaces:** `setInterest(db, actorUid: string, speakerId: string, interested: boolean): Promise<void>`; API POST `{ speakerId, interested }`, GET restituisce gli interessi del workspace autorizzato; `groupSpeakers(speakers: Entity[], interests: SpeakerInterest[], plans: Entity[], actorUid: string, topic?: string)` restituisce `saved`, `unassigned`, `all`.

- [ ] Scrivere test: Alberto e Martin salvano Giulia; Martin rimuove il proprio interesse e quello di Alberto resta; chiamate ripetute sono idempotenti; UID contraffatto è rifiutato; speaker inesistente è rifiutato. Profili mancanti mostrano un'etichetta storica neutra senza esporre email.
- [ ] Scrivere test di raggruppamento: Giulia salvata e assegnata resta in `saved`; non appare due volte; Luca libero e non salvato appare in `unassigned`; filtri non fanno scomparire i propri salvati.
- [ ] Eseguire `npm test -- tests/conductor-interests.test.ts tests/conductor-home.test.ts`: atteso FAIL iniziale.
- [ ] Implementare servizio e route con `authorize`, controllo dello speaker e identità dal token, invalidazione delle letture e refresh repository. Includere gli interessi nelle letture condivise senza consentire scritture generiche per impersonare altri account.
- [ ] Implementare home: salvati prima, non assegnati dopo, elenco completo espandibile; topic a un tocco, stato della scaletta, interessati e assegnatario. Accesso diretto a backoffice e scheda.
- [ ] Eseguire gli stessi test e `npm run check`: atteso PASS. Committare.

## Task 3: Assegnazione unica con conferma di sostituzione

**Files:** creare `src/lib/server/conductor-assignment.ts`, `src/routes/api/conductor/assignment/+server.ts`, `src/lib/components/conductor/AssignmentDialog.svelte`, `tests/conductor-assignment.test.ts`; modificare `src/lib/fields.ts`, schema, `src/routes/api/data/+server.ts`, `src/lib/components/Schedule.svelte`, `src/lib/components/Editor.svelte`, `src/lib/repository.ts`.

**Interfaces:** POST `{speakerId, teamId, expectedOwner, expectedPlanRevision, expectedSlotRevisions, confirmReplacement}`. `assignSpeaker(db, actorUid, request): Promise<AssignmentResult>`. `expectedOwner` è il valore canonico atteso oppure null; risposta 409 include lo stato aggiornato da mostrare e riconfermare. Prima letture e poi scritture in transazione.

- [ ] Scrivere test: assegnazione iniziale; sostituzione rifiutata senza conferma; popup per Alberto→Martin; modifica concorrente produce 409; nessun interesse cancellato; piano e slot collegati cambiano atomicamente; nome legacy ambiguo non viene sincronizzato per supposizione.
- [ ] Eseguire `npm test -- tests/conductor-assignment.test.ts`: atteso FAIL.
- [ ] Implementare risoluzione legacy e servizio transazionale. Gli editor esistenti devono usare lo stesso servizio quando cambia l'assegnazione; impedire bypass tramite API di salvataggio generico. Aggiornamenti ai campi non relativi all'assegnazione conservano il flusso corrente.
- [ ] Implementare dialog: nome speaker, attuale e nuovo assegnatario, «Annulla» e «Conferma riassegnazione». Un 409 aggiorna il riepilogo ma non ritenta una sostituzione senza nuova conferma.
- [ ] Eseguire test dedicati, `npm test -- tests/scheduling.test.ts` e `npm run check`: atteso PASS. Committare.

## Task 4: Scaletta comune e promozione dalla ricerca

**Files:** creare `src/lib/server/conductor-brief.ts`, `src/routes/api/conductor/brief/+server.ts`, `src/lib/components/conductor/QuestionPicker.svelte`, `src/lib/components/conductor/ResearchQuestionPromotion.svelte`, `tests/conductor-brief.test.ts`; modificare `src/lib/repository.ts`, `src/lib/components/ResearchReader.svelte`, `src/lib/components/Backoffice.svelte`.

**Interfaces:** POST brief `{brief, expectedRevision}`; `saveBrief(db, actorUid, brief: ConductorBrief, expectedRevision: number | null): Promise<ConductorBrief>`; promozione di una domanda crea un record `questions` con testo selezionato, lingua, speaker e `materialIds` espliciti. Nessuna estrazione automatica.

- [ ] Scrivere test: sostituzione della terza domanda conserva le altre due; ordine salvato è comune; modifica IT conserva EN; domanda cancellata nel frattempo causa conflitto; speaker con più talk non condivide accidentalmente le scelte tra brief; Markdown non viene trasformato senza conferma.
- [ ] Eseguire `npm test -- tests/conductor-brief.test.ts`: atteso FAIL.
- [ ] Implementare salvataggio transazionale con controllo dei riferimenti e revisioni. Promozione: selezione/incolla volontario del testo, anteprima e conferma; preservare il materiale originale. Integrazione nel backoffice per impostare sintesi, classiche e tre principali.
- [ ] Implementare selezione/sostituzione e pulsanti su/giù; rimozione da scaletta non cancella la domanda. Conflitti conservano la bozza; salvataggi mostrano il carattere condiviso.
- [ ] Eseguire test dedicati e `npm run check`: atteso PASS. Committare.

## Task 5: Scheda pronta e modalità intervista

**Files:** creare `src/lib/components/conductor/SpeakerBrief.svelte`, `src/lib/components/conductor/InterviewCards.svelte`, `tests/e2e/conductor.spec.ts`; modificare `src/routes/+page.svelte`, `src/app.css`.

**Interfaces:** i componenti consumano `ResolvedBrief`, dati speaker e callback repository definiti nei task precedenti; la navigazione serializza speaker e talk nell'URL per poter ricaricare la scheda. `InterviewCards` riceve soltanto le domande risolte e la lingua; non scrive stati.

- [ ] Scrivere test browser su emulatori: aprire speaker→usare scaletta senza input testuale; modificare e vedere la versione da un secondo account; tornare all'elenco conservando filtri; cambiare talk; vedere una sola domanda se ne esiste una; avviso su lingua mancante; nessuna biografia o domanda inventata.
- [ ] Eseguire il test browser dedicato con il comando di verifica finale sotto: atteso FAIL sulle nuove viste.
- [ ] Implementare scheda con gerarchia approvata, dettagli espandibili, selettore talk solo quando necessario e switch lingua con fallback dichiarato. Non appesantire la parte iniziale con tutti gli editor.
- [ ] Implementare lettura una domanda per volta, avanti/indietro limitati agli estremi, indice, testo leggibile e ritorno alla scheda. Aggiornamenti condivisi non spostano improvvisamente la domanda corrente: preservare l'ID se ancora presente, altrimenti mostrare avviso e posizione valida.
- [ ] Verificare a 390px e con tastiera: nessuno scroll orizzontale, azioni principali di almeno 44px, focus dei dialog ripristinato e nessuna dipendenza da hover o trascinamento. Eseguire i test e committare.

## Task 6: Import/export, compatibilità e verifica della consegna

**Files:** modificare `src/lib/workspace-backup.ts`, `src/lib/editorial-export.ts`, `src/routes/api/backup/+server.ts`, `src/routes/api/export/+server.ts`, `schemas/speaker-research-import.schema.json`, `tests/workspace-backup.test.ts`, `tests/editorial-export.test.ts`, `README.md`; adattare altre enumerazioni delle collezioni individuate con `rg`.

**Interfaces:** backup completo include interessi e brief; export editoriale include sintesi e scalette modificate, con riferimenti necessari; import di ricerca ordinario non modifica interessi o assegnazioni implicitamente. Versionare i formati e conservare la lettura di quelli precedenti. Il trasferimento degli interessi mantiene gli UID originari e ne documenta i limiti negli emulatori, come i voti esistenti.

- [ ] Scrivere test roundtrip di brief e interessi; vecchi backup senza nuove collezioni restano leggibili; import di ricerca non può attribuire interesse a un account; brief con riferimenti mancanti viene segnalato prima di scrivere.
- [ ] Eseguire `npm test -- tests/workspace-backup.test.ts tests/editorial-export.test.ts`: atteso FAIL per i nuovi casi.
- [ ] Implementare compatibilità e aggiornare README su condivisione, limiti del refresh, uso mobile e funzioni ancora previste nella seconda fase.
- [ ] Eseguire `npm run check`, `npm test`, `npm run build` e `DEBUG= npx firebase emulators:exec --only auth,firestore --project demo-bacarodeck 'npm run test:e2e'`. Eseguire inoltre `npm run test:rules` se sono cambiate regole o loro percorsi. Atteso: tutti i controlli pertinenti passano; nessun accesso a credenziali reali nei test.
- [ ] Rivedere la diff rispetto ai criteri 1–5 e 9 della specifica; documentare esplicitamente che i criteri 6–8 relativi al grafo appartengono alla seconda fase. Committare e presentare la consegna per revisione, senza deploy automatico.

## Self-review del piano

Coperti home, condivisione, assegnazioni concorrenti, scalette, ricerca e modalità intervista, accesso al backoffice e portabilità. I cinque casi di Review Focus hanno un task di verifica dedicato. Nomi dei modelli e contratti sono comuni tra i task; il piano non introduce un secondo stato di assegnazione. Le decisioni relative al motore semantico e al rendering 3D sono deliberate nella seconda fase, non risolte con una simulazione presentata come funzionalità.
