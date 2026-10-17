# BacaroTech Interview Hub

Workspace collaborativo per preparare le interviste a Codemotion Milano, 28–29 ottobre 2026. Interfaccia mobile in italiano, SvelteKit 2 / Svelte 5 / TypeScript, Google Auth e Firestore, adapter Vercel.

## Avvio

Richiede Node 22 e npm. Per i test Firebase serve Java 21; per i test browser Chromium di Playwright.

```sh
npm ci
cp .env.example .env
# Compila le quattro PUBLIC_FIREBASE_* con la configurazione web del progetto scelto.
npm run dev
```

Senza configurazione appare una schermata di istruzioni: nessun bypass locale e nessun caricamento del dataset. Le variabili PUBLIC sono la configurazione client Firebase, non credenziali amministrative. Non inserire service account nel frontend e non commettere `.env`.

## Firebase e accesso con Google + ALLOW_LIST

Puoi usare lo stesso **database esistente di BacaroGame**, anche sul piano gratuito. `workspaces/codemotion-milano-2026` è solo un percorso di documenti, non un altro database. Il server crea automaticamente i documenti necessari.

1. Mantieni le quattro variabili `PUBLIC_FIREBASE_*` del progetto scelto e abilita Google in Firebase Authentication, con i domini locale/Vercel autorizzati.
2. In `.env` configura le due variabili **private**, senza prefisso PUBLIC:

   ```dotenv
   ALLOW_LIST="nome@gmail.com,collega@gmail.com"
   FIREBASE_ADMIN_KEY='{"type":"service_account", ...}'
   ```

   `ALLOW_LIST` contiene email Google esatte separate da virgola (accettati anche punto e virgola e righe separate), senza distinzione maiuscole/minuscole. Vuota significa nessun accesso. `FIREBASE_ADMIN_KEY` contiene il JSON completo del service account, in una sola riga: è la stessa convenzione già usata da BacaroGame e puoi riutilizzare la credenziale dello stesso progetto. Il JSON abbreviato nell’esempio non è una credenziale utilizzabile. Non commettere `.env` o il file JSON e non inserire la chiave nel frontend. In alternativa locale è supportato `GOOGLE_APPLICATION_CREDENTIALS` verso un file fuori dal repository.

3. Integra **il solo blocco match di questo workspace** di `firebase/firestore.rules` nelle regole del progetto, mantenendo tutti i match degli altri dataset. Controlla che eventuali regole globali permissive non concedano accesso a questo percorso: i permessi Firestore si combinano in OR. Pubblica il ruleset unificato con il normale processo del progetto scelto.
4. Pubblica la lista privata nel database e avvia l’app:

   ```sh
   npm run access:sync
   npm run dev
   ```

   Il comando scrive soltanto la configurazione di autorizzazione di questo workspace, non importa speaker o modifica dati BacaroGame. Ogni volta che cambi `ALLOW_LIST` in locale, riesegui `npm run access:sync` e riavvia il server. Non servono documenti membri creati a mano.

Il server verifica il token Firebase, il provider Google, l’email verificata e la presenza in `ALLOW_LIST`. Un account autorizzato riceve automaticamente il documento membro per assegnare le interviste. Un account escluso può autenticarsi con Google, ma non può aprire il workspace o leggere/scrivere i dati. Il browser ricontrolla la sessione ogni 60 secondi; i permessi database sono applicati dalle regole Firestore e non dipendono dal polling.

La lista viene pubblicata dal comando amministrativo, **mai da una richiesta di login**. Un server con una configurazione diversa da quella pubblicata rifiuta l’accesso senza sovrascrivere i permessi. La rimozione di un’email diventa effettiva anche per accessi diretti via SDK appena esegui `access:sync`; non occorre aspettare la scadenza del token. Le copie già lette sul dispositivo non possono essere ritirate.

Il `firebase.json` incluso serve soprattutto all’emulatore; **non pubblicarlo ciecamente sopra le regole di un progetto condiviso**. Il service account deve poter verificare gli utenti Auth e leggere/scrivere questo workspace in Firestore. Nessuna regola o credenziale remota è stata modificata automaticamente durante l’implementazione.

## Primo caricamento: cinque persone

Un membro entra nel workspace vuoto, sceglie **Prepara import dei 5 speaker**, controlla l’anteprima e conferma esplicitamente. Il seed contiene 5 speaker, 5 talk, 5 piani, 5 materiali, 15 domande suggerite e 2 fonti. Il caricamento non è automatico. Il catalogo completo in `BacaroTech_Schede_Speaker_2026` resta materiale di riferimento e non viene incluso nell’app o importato automaticamente.

## Uso

- Cerca per nome/tag e filtra per tag, preparazione o intervistatore.
- Scegli uno speaker e usa **Aggiungi materiale** per incollare Markdown senza campi di classificazione obbligatori; l’anteprima è sanificata e il testo originale è conservato.
- **Modifica profilo** e **Mostra tutti i campi editoriali** permettono di modificare ogni campo del modello supportato. Gli ID tecnici e gli audit non sono modificabili.
- Talk, fonti, materiali, insight, domande e piani hanno creazione, lettura, modifica ed eliminazione. I riferimenti aggiuntivi si gestiscono come ID; non esiste cancellazione a cascata.
- **Prepara intervista** assegna un membro, gli stati, gli orari e le note. Le domande si ordinano cambiando `Ordine`; IT/EN cambia la lingua visualizzata.
- Le eliminazioni richiedono conferma e non sono reversibili. Eliminare una fonte o uno speaker non elimina i materiali collegati; verificare i riferimenti rimasti.

## Import JSON

Schema pubblico: `schemas/speaker-research-import.schema.json`. Formato a collezioni compatibile con il seed e con le schede base. Esempio:

```json
{
  "schemaVersion": 1,
  "targetSpeakerId": "andrey-breslav",
  "materials": [
    {
      "id": "ricerca-andrey-01",
      "speakerIds": ["andrey-breslav"],
      "bodyMd": "# Appunti\n\nTesto incollato senza modifiche.",
      "provenance": "ai_generated"
    }
  ],
  "questions": [
    {
      "id": "domanda-andrey-01",
      "speakerId": "andrey-breslav",
      "textIt": "Quale criterio usi per valutare una specifica?"
    }
  ]
}
```

Valida lo schema, rifiuta campi sconosciuti/contatti, ID duplicati e URL con protocolli pericolosi. La similarità del nome e gli URL già presenti sono avvisi, non unioni automatiche. `targetSpeakerId` rimappa lo speaker e i riferimenti correlati; un import standalone destinato a una persona non può contenere riferimenti a più persone.

I nuovi documenti sono selezionati nell’anteprima; **tutti i campi esistenti partono deselezionati**. Le domande esistenti con stato diverso da `suggested` sono protette dall’import; per modificarle usa l’editor manuale. Tutte le domande importate sono forzate a `suggested`. I metadati workspace nel seed sono descrittivi; non vengono scritti dal flusso di import.

Prima di confermare si può annullare senza scrivere nulla. Dopo la conferma non esiste undo automatico; nessun salvataggio avviene senza approvazione esplicita. Ogni conferma è una singola transazione (massimo 400 documenti) che verifica tutte le revisioni dell’anteprima e annulla tutto in caso di conflitto.

## Offline e concorrenza

Online-first, cache Firestore solo in memoria per la sessione corrente. Nessuna cache persistente tra accessi, nessun accodamento volontario di scritture offline. Offline restano visibili i dati già letti; le transazioni richiedono la rete e segnalano l’errore. Conserva il testo di un form e riprova. Un conflitto conserva il form aperto: copia le modifiche, chiudi, riapri la versione aggiornata e riapplicale. L’app richiede una verifica membership dal server all’avvio.

## Verifica

```sh
npm run check
npm test
DEBUG= npm run test:rules
npx playwright install chromium
DEBUG= npx firebase emulators:exec --only auth,firestore --project demo-bacarodeck 'npm run test:e2e'
npm run build
```

I test browser avviano Vite con configurazione fittizia e usano soltanto gli emulatori `demo-bacarodeck`. Non richiedono credenziali reali. Le porte 4173, 8080 e 9099 devono essere libere. Il runner pubblica una lista fittizia nel solo emulatore; il server verifica Google e crea automaticamente i membri autorizzati. Non esistono permessi amministrativi nel codice client.

## Vercel

Importa questa directory come root del progetto Vercel, preset SvelteKit, Node 22, build `npm run build:deploy`. Questo comando pubblica ALLOW_LIST con Firebase Admin e poi esegue la build; usalo solo nel deployment autorevole dello workspace. L’adapter Vercel è già configurato. Imposta le quattro variabili `PUBLIC_FIREBASE_*` e le due variabili private `ALLOW_LIST` e `FIREBASE_ADMIN_KEY`, lascia `PUBLIC_USE_EMULATORS=false` e abilita il dominio Vercel in Firebase Auth. Dopo ogni modifica alle variabili, esegui un nuovo deploy. Le preview devono usare un progetto separato oppure il normale comando `npm run build`, senza pubblicare policy differenti sul database condiviso. La build locale `npm run build` non scrive su Firebase. Nessun deploy è stato eseguito.

Vedi `IMPLEMENTATION_REPORT.md` per evidenze, scelte sui documenti mancanti e limiti di accettazione.

Riferimenti tecnici: [transazioni Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [regole e autenticazione](https://firebase.google.com/docs/firestore/security/rules-conditions), [SvelteKit su Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit).

## Errore Vercel `ERR_REQUIRE_ESM` nel login

La catena `firebase-admin → jwks-rsa → jose` può fallire nei runtime Vercel che non supportano `require()` di moduli ESM. L’override mirato in `package.json` usa `jose@5.10.0` soltanto per `jwks-rsa`, conservando la verifica crittografica dei token. Il test `tests/runtime-auth.test.ts` disabilita esplicitamente il bridge CommonJS/ESM e verifica il recupero di una chiave RSA reale.

Commetti anche `package-lock.json` e riesegui il deploy con le nuove dipendenze (se necessario disattiva la cache di build nel Redeploy Vercel). Questo errore avviene al caricamento del modulo, prima della lettura di `ALLOW_LIST`: non richiede cambiare i secret.

Riferimento: [segnalazione upstream jwks-rsa #507](https://github.com/auth0/node-jwks-rsa/issues/507).
