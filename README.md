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
4. Avvia l’app con `npm run dev`. Non serve sincronizzare la lista nel database.

Come in BacaroGame, i dati passano attraverso il server Firebase Admin. Ogni richiesta verifica il token Firebase, il provider Google, l’email verificata e `ALLOW_LIST` privata. Il browser conserva il login Firebase e invia il token Bearer alle API; non usa una sessione cookie. I documenti membri servono per assegnare interviste, non concedono accesso.

Le regole negano letture e scritture dirette dal browser. **Migrazione dalla versione precedente:** pubblica il blocco di regole aggiornato per questo workspace, preservando le altre regole del progetto condiviso. Finché restano attive le vecchie regole, la vecchia policy nel database può ancora autorizzare accessi SDK. Il documento `access/config` non viene più usato dal server.

Quando cambi `ALLOW_LIST`, riavvia il server locale o crea un nuovo deploy Vercel. Ogni deploy usa il proprio ambiente: vecchi deployment ancora raggiungibili possono continuare a usare la vecchia lista e vanno rimossi o protetti quando revochi accessi. Il browser aggiorna i dati ogni 15 secondi e dopo ogni salvataggio; le transazioni mantengono il controllo dei conflitti.

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

Importa questa directory come root del progetto Vercel, preset SvelteKit, Node 22, build `npm run build`. Imposta `PUBLIC_FIREBASE_*`, `ALLOW_LIST` e `FIREBASE_ADMIN_KEY`, lascia `PUBLIC_USE_EMULATORS=false` e abilita il dominio Vercel in Firebase Auth. Se avevi impostato `npm run build:deploy`, sostituiscilo con `npm run build`. Dopo ogni modifica delle variabili crea un nuovo deploy. La build non scrive su Firebase. Nessun deploy è stato eseguito automaticamente.

Vedi `IMPLEMENTATION_REPORT.md` per evidenze, scelte sui documenti mancanti e limiti di accettazione.

Riferimenti tecnici: [transazioni Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [regole e autenticazione](https://firebase.google.com/docs/firestore/security/rules-conditions), [SvelteKit su Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit).

## Errore Vercel `ERR_REQUIRE_ESM` nel login

La catena `firebase-admin → jwks-rsa → jose` può fallire nei runtime Vercel che non supportano `require()` di moduli ESM. L’override mirato in `package.json` usa `jose@5.10.0` soltanto per `jwks-rsa`, conservando la verifica crittografica dei token. Il test `tests/runtime-auth.test.ts` disabilita esplicitamente il bridge CommonJS/ESM e verifica il recupero di una chiave RSA reale.

Commetti anche `package-lock.json` e riesegui il deploy con le nuove dipendenze (se necessario disattiva la cache di build nel Redeploy Vercel). Questo errore avviene al caricamento del modulo, prima della lettura di `ALLOW_LIST`: non richiede cambiare i secret.

Riferimento: [segnalazione upstream jwks-rsa #507](https://github.com/auth0/node-jwks-rsa/issues/507).

## Catalogo e organizzazione mobile

La ricerca speaker è verticale anche sul telefono: cerca nome, organizzazione o tag (accenti ignorati), apri i filtri e seleziona una scheda. “Torna agli speaker” conserva ricerca e posizione. “Importa tutti gli 84 speaker” prepara soltanto i documenti mancanti, con anteprima; i dati già lavorati non vengono sovrascritti. Il catalogo originale resta intatto; il pacchetto app normalizza un titolo alternativo strutturato conservandone la fonte.

Il team editoriale è distinto dagli account Google: Giorgio (IT), Alberto, Martin e Michele per le interviste; Lorenzo e Danilo per camera. I campi descrizione e abstract hanno IT/EN e stato di revisione; se manca una traduzione, l'app segnala esplicitamente il fallback al testo originale. I testi del catalogo non sono stati tradotti automaticamente.

## Superadmin

Imposta `SUPERADMIN_EMAILS` su Vercel con l'email Google del primo amministratore (solo il valore, nessuna assegnazione o virgolette). La variabile locale è configurata privatamente per l'account indicato. Gli amministratori permanenti possono aprire “Gestisci accessi”, abilitare e revocare email. Un blocco prevale su ALLOW_LIST; i permanenti si gestiscono dall'ambiente. Le email autorizzate e bloccate sono in un documento privato access/members. Nessun comando di sincronizzazione; build sempre `npm run build`.

## Programmazione

Il pannello conserva 14 coppie principale/backup e gli slot originali da 30 minuti. Permette di scegliere il talk, applicare il suggerimento fine +30 minuti, assegnare intervistatore/camera e salvare proposta, provvisoria o confermata. Mostra conflitti e avvisi fuori dalle finestre iniziali. Gli orari sono Europe/Rome; il backup è un'alternativa. Lo snapshot ufficiale è datato, non una sincronizzazione continua. Per aggiornare: `python3 scripts/refresh-agenda.py`, controlla il diff e ridistribuisci. Il comando aggiorna solo le sessioni locali e conserva gli slot originali; gli appuntamenti salvati nel database non vengono spostati. Nessun nome non trovato viene associato automaticamente.

## Domande e PWA

“Prepara altre 10 domande” offre bozze IT/EN ancorate a estratti di abstract, materiali o biografia; senza testi usa tracce esplorative sul titolo e segnala la lacuna. Sono spunti editoriali da rivedere, non una ricerca autonoma o un servizio AI. IDs stabili evitano duplicati e la ricomparsa di bozze eliminate. Voti personali 1–5, media, ordinamento; scarto tramite stato e cancellazione con conferma. Le cancellazioni registrano un tombstone privato che impedisce il reimport dello stesso ID.

La PWA è installabile dal browser su HTTPS. Il service worker conserva solo asset pubblici e pagina offline, mai API o pagine autenticate. Non supporta scritture offline. La pagina offline invita a riconnettersi; le bozze aperte rimangono nello stato della pagina finché questa resta aperta.
