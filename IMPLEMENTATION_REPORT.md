## Accessi server come BacaroGame

ALLOW_LIST viene verificata dal server per ogni richiesta autenticata. CRUD e import usano Firebase Admin con validazione e transazioni atomiche; nessuna pubblicazione della policy durante la build. Rimossi access:sync e build:deploy. Il browser usa Bearer Firebase anziché il cookie di BacaroGame, e aggiorna i dati ogni 15 secondi e dopo i salvataggi. Regole workspace: deny all per SDK client. È necessario pubblicare il blocco aggiornato preservando le regole degli altri dataset. Nessuna modifica remota effettuata. Le sezioni sottostanti descrivono la storia precedente e sono superate dove citano la sincronizzazione della policy.

Verifica della migrazione: 20 test unitari più 1 test regole con emulatore superati; 4 test browser desktop/mobile superati, incluse API negate agli esclusi, conflitti, validazione e rollback atomico. Check TypeScript/Svelte senza errori o warning; build Vercel completata. Resta il warning preesistente di tracing google-gax sul package.json opzionale.

# Implementation report — BacaroTech Interview Hub

## Diagnostica ALLOW_LIST

Distinti i casi lista assente/vuota, formato Value errato (virgolette/array/assegnazione incollati in Vercel), provider diverso da Google, email non verificata e account escluso. Il messaggio per account escluso mostra soltanto l’email dell’identità autenticata, mai la lista. Nessuna modifica alle autorizzazioni per aggirare il controllo. Il valore Vercel non è stato letto o verificato; la causa specifica del deployment resta da confermare attraverso il formato configurato e l’account usato. Test di regressione prima fallito e poi superato; 20 test locali, typecheck e build verificati.

## Correzione Vercel: ERR_REQUIRE_ESM nel login

Riprodotto l’errore fornito con `node --no-experimental-require-module -e "require('firebase-admin/auth')"`: jwks-rsa 4.1.0 caricava jose 6.2.12 ESM tramite require CommonJS. L’override mirato `jwks-rsa: { jose: "5.10.0" }` e il lockfile aggiornato mantengono Firebase Admin e lasciano jose 6 agli altri consumatori. Nessun secret o controllo di autorizzazione modificato.

Nuovo test `tests/runtime-auth.test.ts`: processo Node con bridge require(ESM) disabilitato, caricamento Firebase Auth, endpoint JWKS locale con RSA generata al momento, recupero della chiave e verifica di una firma reale. Il test riproduceva ERR_REQUIRE_ESM prima della correzione e passa dopo. Verificato anche l’endpoint compilato: import riuscito con lo stesso flag e risposta 401 alla richiesta senza token. Revisione indipendente senza rilievi.

Verifiche aggiornate: 19 test senza emulatore, 26 con emulatore, 4 prove browser; typecheck e build Vercel. Audit runtime: zero vulnerabilità rilevate. Il deploy remoto non è stato eseguito: pubblicare package.json e package-lock.json aggiornati e creare un nuovo deployment; se Vercel riutilizza le vecchie dipendenze, disattivare la cache di build per quel redeploy.

## Aggiornamento: Google e ALLOW_LIST privata

L’accesso ora dipende esclusivamente da email Google verificate presenti nella variabile server `ALLOW_LIST`. Il browser non riceve la lista né `FIREBASE_ADMIN_KEY`. Il token è verificato con Firebase Admin (inclusa revoca), con controllo del provider Google e confronto esatto dell’email normalizzata. Il server crea il documento membro automaticamente: non serve più abilitare UID dalla console.

Configurazione richiesta: `ALLOW_LIST` e `FIREBASE_ADMIN_KEY` nel `.env` ignorato da Git o nelle variabili private Vercel. Sono state aggiunte voci vuote quando mancanti nel `.env` locale, senza leggere/copiare segreti da BacaroGame. La credenziale Admin usa la stessa convenzione di quel progetto e deve appartenere allo stesso progetto Firebase delle variabili pubbliche. In locale è supportato anche `GOOGLE_APPLICATION_CREDENTIALS`.

`npm run access:sync` pubblica la policy amministrativa in `workspaces/codemotion-milano-2026/access/config`; vuota revoca tutti gli accessi. Va eseguito dopo ogni modifica della lista. `npm run build:deploy` lo esegue prima della build per il deployment autorevole. `npm run build` resta senza scritture remote. La richiesta di login **non può modificare la policy**: una vecchia versione dell’app con env diverso viene rifiutata. Le regole richiedono email verificata, provider Google, inclusione nella policy pubblicata e membership, quindi una vecchia membership da sola non concede accesso. Il documento con la lista è inaccessibile ai client.

Il browser controlla l’accesso prima di aprire le collezioni e ogni 60 secondi; le regole applicano la revoca anche agli accessi diretti via SDK appena viene pubblicata. Un errore di rete temporaneo durante il controllo periodico conserva la bozza già aperta; il primo accesso senza verifica riuscita resta bloccato. Una revoca effettiva chiude il workspace. Rimuovere un indirizzo soltanto dall’env senza pubblicare la policy non modifica Firestore: le istruzioni README includono esplicitamente questo passaggio e il comando automatico per Vercel.

Verifiche aggiornamento: 18 test senza emulatore (16 dominio + 2 policy), 25 con emulatore (inclusi 7 regole/repository), 4 prove browser desktop/mobile per account ammessi/esclusi, token falsificati, pubblicazione della policy, revoca senza ripristino da vecchi server e bozza conservata in caso di rete interrotta durante il controllo. TypeScript/Svelte: zero errori e warning; formattazione e build Vercel verificate. Il test sulla policy inizialmente restituiva 200 e ripristinava la vecchia lista: corretto rimuovendo la pubblicazione dalle richieste di login. Il test sulla rete inizialmente cancellava la bozza: corretto conservando lo stato nei soli errori di trasporto di una sessione già aperta.

Revisione indipendente: corretti i due rilievi importanti su propagazione della revoca e vecchi deploy che sovrascrivevano le policy. La build segnala un warning di tracing per un tentativo opzionale di caricamento `google-gax/build/package.json`; il modulo esegue un fallback protetto da catch e l’adapter conclude correttamente. Smoke test su Vercel e OAuth reale restano da eseguire con credenziali e progetto scelti. Nessuna policy o regola remota è stata pubblicata durante questo lavoro; `access:sync` è stato eseguito soltanto su `demo-bacarodeck` nell’emulatore. Le regole BacaroGame sono state lette e non modificate.

Le sezioni seguenti descrivono lo scaffold iniziale; per autorizzazione e comandi di deployment valgono questo aggiornamento e il README corrente.

Data: 17 ottobre 2026. Implementazione locale in `bacarodeck-demo`, senza deploy, push o import su servizi reali.

## Risultato

Scaffold funzionante SvelteKit 2 / Svelte 5 / TypeScript con adapter Vercel, Firebase Authentication Google e Firestore. Il workspace è isolato sotto `workspaces/codemotion-milano-2026`. Senza configurazione Firebase l’app mostra istruzioni; senza membership non carica le collezioni. Nessuna modalità demo aggira l’autorizzazione.

La UI italiana è responsive, con ricerca per nome/tag, filtri per tag/preparazione/intervistatore, scheda speaker, pulsante evidente “Aggiungi materiale”, editor Markdown e anteprima sanificata. Tutte le sette collezioni editoriali hanno CRUD reale: speaker, talk, fonti, materiali, insight, domande e piani intervista. Tutti i campi supportati dal modello sono modificabili, inclusi quelli aggiuntivi sotto “Mostra tutti i campi editoriali”; soltanto ID e audit sono protetti.

Il piano consente assegnazione dalla lista membri, stato preparazione/intervista, priorità, data/orario e note. Le domande si ordinano con il campo Ordine, con stati editoriali e toggle IT/EN.

L’import valida JSON Schema con Ajv, espone errori e differenze per campo, segnala ID duplicati, omonimie e URL già presenti (anche nello stesso file), supporta targetSpeakerId senza unire persone per nome. I campi esistenti sono deselezionati; le domande già lavorate sono protette. Ogni domanda importata viene forzata a suggested. Il seed dei cinque speaker passa dallo stesso flusso di approvazione esplicita.

Ogni scrittura usa una transazione con revisione attesa, audit del membro e timestamp server; una revisione cambiata annulla l’intero import. I metadati di creazione restano invariati. Nessuna scrittura viene intenzionalmente accodata offline. La cache è solo in memoria nella sessione e si richiede verifica membership dal server all’accesso.

## File principali

- `src/routes/+page.svelte`: accesso, membership gate, filtri e schede.
- `src/lib/fields.ts`: campi editoriali, default e traduzioni.
- `src/lib/domain.ts`: validazione, Markdown sicuro, audit, anteprima e selezione import.
- `src/lib/repository.ts`: letture live e transazioni CRUD/import.
- `src/lib/components/`: editor, anteprima, import e conferma eliminazione accessibile.
- `schemas/speaker-research-import.schema.json`: schema del formato a collezioni.
- `firebase/firestore.rules`: membership, isolamento, audit, revisioni e allowlist dei campi.
- `.env.example`, `firebase.json`, `svelte.config.js`: avvio e deployment.
- `README.md`: configurazione Firebase/Vercel, autorizzazioni, primo import, comandi e limiti operativi.

Gli originali `seed_five.json` e il pacchetto di 84 schede sono conservati. `data/seed/seed_five.json` è copia integrale del seed originale; soltanto questo seed è caricato dal codice dell’app e solo su richiesta. Nessuna email/telefono/indirizzo privato è stato aggiunto al modello o importato.

## Verifiche eseguite

| Comando                                                                                                                      | Esito finale                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm install`                                                                                                                | Dipendenze installate e lockfile generato                                  |
| `npm run check`                                                                                                              | 0 errori, 0 warning Svelte/TypeScript                                      |
| `npm test`                                                                                                                   | 16 test di dominio superati senza emulatore                                |
| `DEBUG= npm run test:rules`                                                                                                  | Regole e repository verificati su Firestore emulator                       |
| `DEBUG= npx firebase emulators:exec --only auth,firestore --project demo-bacarodeck 'npx vitest run && npx playwright test'` | 22 test superati: 16 dominio + 6 integrazione; poi 2 browser test superati |
| `npm run format:check`                                                                                                       | Formattazione verificata                                                   |
| `npm run build`                                                                                                              | Build produzione e adapter Vercel riusciti                                 |
| `npm audit --omit=dev`                                                                                                       | 0 vulnerabilità runtime                                                    |

I test Firestore verificano non membri e utenti anonimi, impossibilità di autoiscriversi, isolamento da altri workspace, campi contatto rifiutati, metadati, revisioni, edit/delete obsoleti e rollback atomico. Un test esegue create/read/update/delete per ciascuna delle sette collezioni. Gli errori PERMISSION_DENIED nei log sono attesi nei test che verificano il rifiuto.

Le prove browser usano Chromium desktop e viewport/emulazione iPhone 13 (390×844), con Google Auth Emulator e Firestore Emulator. Eseguono login, rifiuto iniziale del non membro, abilitazione amministrativa nel solo emulatore, import approvato dei cinque speaker, Markdown oltre 2.000 caratteri conservato esattamente, creazione/modifica/eliminazione materiale, modifica URL e note di una fonte, assegnazione membro, stato preparazione, IT/EN e persistenza dopo reload. Verificano assenza di overflow orizzontale globale e di errori JavaScript. Screenshot desktop/mobile ispezionati visivamente; artefatti in `test-results/`, esclusi da git.

La verifica iniziale ha rilevato problemi poi risolti: install prima dell’esistenza della route, incompatibilità di tipi del test harness compat/modular, clonazione dei proxy Svelte, avvio asincrono del widget Google nell’emulatore, e una corsa nel test prima del caricamento dei dati. Un’esecuzione browser è stata invalidata dal riavvio Vite durante la formattazione della configurazione; il run finale è stato eseguito a file stabili ed è interamente verde.

Revisione indipendente eseguita: tre rilievi importanti (ID degli insight escluso dallo schema/regole, Markdown nullo incoerente con le regole, target degli import standalone incoerente) corretti con test di regressione. Aggiunti inoltre test su provenienza non classificata, ID stabile del piano e duplicati nello stesso file.

L’override di `@grpc/grpc-js` a `^1.14.6` sotto Firestore evita la vecchia dipendenza Node `~1.9.0`; integrazione e build sono state rieseguite con l’override. L’audit completo della toolchain conserva segnalazioni su dipendenze di sviluppo; non sono stati applicati downgrade/aggiornamenti maggiori automatici.

## Configurazione e sicurezza deployment

Non esisteva configurazione Firebase in questo repository; nessuna regola remota o di altri progetti è stata modificata. Le regole incluse sono verificate localmente. Per un progetto Firebase condiviso occorre integrare il blocco workspace nel ruleset esistente e controllare le regole generali permissive, che in Firestore si combinano in OR. Le istruzioni dettagliate sono nel README. Non pubblicare il file locale come sostituzione cieca del ruleset remoto.

Vercel: root `bacarodeck-demo`, preset SvelteKit, Node 22, build `npm run build`, quattro variabili `PUBLIC_FIREBASE_*`, emulatori disattivati. Abilitare Google e il dominio in Auth, creare i documenti membri dalla console amministrativa. Nessuna chiave richiesta o commessa; `.env` ignorato. Nessun progetto production scelto.

## Accettazione e limiti rimasti

I documenti richiesti dal prompt (`README.md` iniziale, `START_HERE.md`, `docs/PRODUCT.md`, `docs/USER_FLOWS.md`, `docs/FIRESTORE_MODEL.md`, `docs/UI_SCREENS.md`, `docs/ACCEPTANCE.md`, `docs/DEPLOY_FIREBASE_VERCEL.md`, `data/README.md` iniziale e schema) non erano forniti. Esistevano lo scaffold, il seed e un pacchetto autonomo di dati. Campi e schema sono stati derivati dal seed, con insight e provenienza aggiunti esplicitamente. Il README e data/README sono stati creati. Non è possibile attestare criteri aggiuntivi contenuti nei documenti assenti.

| Checkpoint                                                                    | Stato                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A — Foundation, Google, membri, env, isolamento                               | Implementato e verificato con emulatori; merge regole e Auth reali da verificare sul progetto scelto |
| B — Seed 5, ricerca, editor di tutti i campi, CRUD e Markdown                 | Implementato; nessun import automatico di 84 persone                                                 |
| C — Assegnazione, stati, ordine, IT/EN e note                                 | Implementato e verificato                                                                            |
| D — Schema, anteprima selettiva, duplicati, approvazione, transazione         | Implementato; annullamento possibile prima delle scritture                                           |
| E — Mobile, permessi, fonte, Markdown lungo, revisioni, accessibilità di base | Verificato; manca audit specialistico screen reader e prova su dispositivi fisici                    |

Da completare prima dell’uso reale: scelta e configurazione progetto Firebase, merge/review delle regole esistenti, creazione membri, verifica Google OAuth reale, deployment Vercel e smoke test sul dominio finale. Queste azioni non sono state eseguite senza la scelta esplicita del progetto.

Limiti intenzionali dello scaffold: nessuna cache persistente dopo reload offline; nessun undo dopo conferma (correzione manuale), cancellazione a cascata o pannello amministrazione membri; i riferimenti avanzati sono editor di ID/liste, non selettori visuali. Il contenuto Markdown è reso in sicurezza, ma non viene verificato fattualmente. La natura dei dati distingue fatti riportati, interpretazioni, testo AI, domande e contenuti non classificati. Il limite di 200 KiB dei materiali rifiuta il salvataggio con un messaggio e conserva il testo nel form, senza troncamento.

Il metadata workspace del seed (titolo e date evento) è descrittivo e non viene scritto dall’import; le date dell’evento restano configurazione dell’app. La build segnala un chunk client superiore a 500 KiB (circa 287 KiB gzip): ottimizzazione del caricamento differito rimandata. Nessuna funzione LLM/RAG, scraping, registrazione o seconda fase è stata implementata.

Nessun commit è stato creato: il repository era senza commit iniziali e i materiali forniti erano già non tracciati; il lavoro resta nella directory richiesta per la revisione.
