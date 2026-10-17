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

## Firebase e accesso

1. Scegli esplicitamente il progetto Firebase da usare; nessun progetto reale è stato selezionato da questo scaffold.
2. Abilita Authentication → Google e aggiungi il dominio locale/Vercel ai domini autorizzati.
3. Crea Firestore. Con un accesso Google l’app mostra l’UID quando l’utente non è ancora membro.
4. Dalla console Firebase, come amministratore, crea `workspaces/codemotion-milano-2026/members/{uid}` con `displayName` (stringa) e, facoltativamente, `role: "editor"`. Non serve salvare email. Tutti i membri hanno gli stessi permessi editoriali. L’app non può creare membri.
5. Integra **il solo blocco match di questo workspace** di `firebase/firestore.rules` nelle regole del progetto, mantenendo tutti i match degli altri dataset. Controlla che eventuali regole globali permissive non concedano accesso a questo percorso: i permessi Firestore si combinano in OR.
6. Solo dopo la verifica del progetto e delle regole pubblica il ruleset unificato con il tuo normale processo di deploy.

Il `firebase.json` incluso serve soprattutto all’emulatore; **non pubblicarlo ciecamente sopra le regole di un progetto condiviso**. Non sono state modificate regole o configurazioni degli altri progetti della cartella Bacarotech.

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

I test browser avviano Vite con configurazione fittizia e usano soltanto gli emulatori `demo-bacarodeck`. Non richiedono credenziali reali. Le porte 4173, 8080 e 9099 devono essere libere. Il runner browser crea membri attraverso l’API amministrativa dell’emulatore; l’app non ha questo permesso.

## Vercel

Importa questa directory come root del progetto Vercel, preset SvelteKit, Node 22, build `npm run build`. L’adapter Vercel è già configurato. Imposta le quattro variabili `PUBLIC_FIREBASE_*`, lascia `PUBLIC_USE_EMULATORS=false`, abilita il dominio Vercel in Firebase Auth e verifica i membri e il ruleset unificato prima dell’uso. Nessun deploy è stato eseguito.

Vedi `IMPLEMENTATION_REPORT.md` per evidenze, scelte sui documenti mancanti e limiti di accettazione.

Riferimenti tecnici: [transazioni Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [regole e autenticazione](https://firebase.google.com/docs/firestore/security/rules-conditions), [SvelteKit su Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit).
