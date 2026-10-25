# BacaroTech Interview Hub

## Vista conduttore

La home `/` apre la vista per il telefono. «Mi interessa» salva uno speaker tra i
propri preferiti, visibili in cima anche quando assegnati a un collega. Gli interessi
di ciascun account sono visibili a tutto il team e non prenotano l'intervista.

La scheda riunisce talk, sintesi, tre domande principali, altre domande e ricerca.
«Usa la scaletta» mostra una domanda alla volta. Testi, scelta e ordine sono comuni:
una modifica vale per tutti. Se non è ancora stata salvata una scelta editoriale,
l'app propone le prime domande attive nell'ordine esistente e segnala la proposta.
La mancanza di tre domande o della sintesi non viene riempita con contenuti inventati.

«Assegna / cambia» usa il team editoriale; una sostituzione richiede una conferma
con il riepilogo. Piano e slot collegati vengono aggiornati insieme. I vecchi slot
senza ID speaker vengono collegati solo con corrispondenza univoca del nome; i casi
ambigui richiedono verifica. L'assegnazione non cambia gli interessi.
Gli slot originali pertinenti vengono salvati insieme all'assegnazione anche se
non erano ancora stati aperti nella programmazione. Piani e slot già assegnati
non possono essere eliminati dal CRUD generico, per non lasciare stati discordanti.

Gestione resta accessibile a tutti i conduttori autorizzati su `/backoffice`.
L’header compatto mostra il logo BacaroTech e «Interview Hub». Il pulsante «Utente»
apre i dettagli dell’account e il comando «Esci». La barra inferiore resta visibile
durante lo scorrimento e collega Speaker, Topic e Gestione.
Dentro Gestione, Speaker, Programmazione e Strumenti formano un secondo livello
nel footer fisso, sopra la navigazione principale; «Aggiungi speaker» resta
come azione rapida. Importazioni,
esportazioni, tag, traduzioni e gestione accessi si trovano nella pagina
«Strumenti» (`/backoffice/strumenti`), organizzata per funzione. Il pulsante ⓘ accanto
a ogni comando apre una spiegazione; non esegue l'operazione.
«Modifica profilo e intervista» apre un unico form con le due sezioni e un solo
salvataggio. Un conflitto su una delle sezioni blocca entrambe le scritture e
conserva le bozze nel form.
I contenuti esistenti si aprono in lettura, con Markdown formattato e il pulsante
«Modifica» per abilitare i campi. La descrizione speaker usa una sola area IT / EN;
il cambio lingua conserva i due testi e le rispettive modifiche non ancora salvate.
I nuovi contenuti si aprono direttamente in modifica.
Da un materiale di ricerca si può incollare una domanda, controllare l'anteprima e
confermare la creazione del record strutturato, conservando il materiale originale.
Sintesi, domande classiche e scaletta si gestiscono dalla scheda conduttore collegata.
Le funzioni amministrative conservano i privilegi precedenti.

Ogni schermata ha una pagina SvelteKit e un URL apribile direttamente:

- `/speaker`, `/speaker/[id]`, `/speaker/[id]/scaletta`: elenco, scheda e lettura per il conduttore.
- `/topic` e `/topic/[topic]`: esplorazione degli argomenti.
- `/backoffice/speaker/[id]`: Info con biografia, assegnazione e modifica del profilo; `/note` per appunti e approfondimenti condivisi, con un popup ⓘ che ne spiega lo scopo; `/strumenti` per i prompt Gemini/ChatGPT/NotebookLM e l’importazione Markdown; `/intervista` unisce domande e preparazione; `/talk` per i dettagli del talk. I vecchi link `/domande` rimandano a `/intervista` e `/ricerca` a `/note`.
- In Intervista le **Domande per intervista** compaiono prima delle altre, evidenziate e riordinabili. La selezione, fino a tre domande per talk, è condivisa con la scaletta conduttore. In assenza di una selezione salvata vengono proposte le prime tre domande, da confermare.
- `/backoffice/programmazione`: calendario delle interviste.
- `/backoffice/contenuti/[collection]/[id]` e `/backoffice/nuovo/[collection]`: lettura/modifica e creazione dei contenuti.
- `/backoffice/importa`, `/esporta`, `/backup`, `/tag`, `/accessi`: strumenti dedicati (tutti sotto `/backoffice`).

Il layout radice mantiene sessione e dati condivisi durante la navigazione. I link
supportano nuove schede, ricaricamento e Indietro/Avanti del browser; le vecchie URL
con `?speaker=` reindirizzano alla scheda corrispondente. Talk, lingua e domanda
corrente della scaletta sono parametri dell'URL. I popup restano per spiegazioni,
conferme e modifiche brevi; non sostituiscono le pagine.

Le altre sessioni ricevono i cambiamenti con il refresh periodico già presente
(60 secondi) o ricaricando; non è una sincronizzazione push. I salvataggi richiedono
rete e controllo delle revisioni; in caso di conflitto il testo aperto è conservato.

Il backup completo versione 2 comprende `speakerInterests` e `conductorBriefs` e
legge anche i backup versione 1. Gli interessi mantengono gli UID originali nel
trasferimento e si modificano solo dal proprio account; l'import di ricerca non
può attribuirli ad altri. L'export editoriale include le schede modificate con i
riferimenti alle domande, ma esclude gli interessi: per questi usare il backup completo.

Il grafo 3D e il calcolo automatico delle somiglianze sono previsti nella seconda
fase del progetto e non sono inclusi in questa versione.

Per testare senza interferire con emulatori già attivi, il client in sviluppo
accetta `PUBLIC_AUTH_EMULATOR_URL` e `PUBLIC_FIRESTORE_EMULATOR_PORT`; Playwright
accetta `TEST_PORT`. I valori predefiniti restano 9099, 8080 e 4173.

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

Home e backoffice condividono lo stesso accesso Google. La sessione viene conservata
nel profilo del browser anche dopo chiusura e riapertura, finché non si esce,
si cancellano i dati del browser o Firebase richiede una nuova autenticazione.
Il ripristino dell'account precede la schermata di login. Questo non abilita ancora
la riapertura dei contenuti offline: il download locale è previsto nella
[specifica sessione/offline](docs/superpowers/specs/2026-10-25-session-offline-design.md).

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

Il team editoriale è distinto dagli account Google: Giorgio (IT), Alberto, Martin e Michele per le interviste; Lorenzo e Danilo per camera. I campi descrizione e abstract hanno IT/EN e stato di revisione; se manca una traduzione, l'app segnala esplicitamente il fallback al testo originale. Sono disponibili traduzioni automatiche Google Translate per le 81 biografie e i 27 abstract presenti nel catalogo, tutte da verificare. Le schede prive di testo originale restano vuote.

## Superadmin

Imposta `SUPERADMIN_EMAILS` su Vercel con l'email Google del primo amministratore (solo il valore, nessuna assegnazione o virgolette). La variabile locale è configurata privatamente per l'account indicato. Gli amministratori permanenti possono aprire “Gestisci accessi”, abilitare e revocare email. Un blocco prevale su ALLOW_LIST; i permanenti si gestiscono dall'ambiente. Le email autorizzate e bloccate sono in un documento privato access/members. Nessun comando di sincronizzazione; build sempre `npm run build`.

## Programmazione

Il pannello conserva 14 coppie principale/backup e gli slot originali da 30 minuti. Permette di scegliere il talk, applicare il suggerimento fine +30 minuti, assegnare intervistatore/camera e salvare proposta, provvisoria o confermata. Mostra conflitti e avvisi fuori dalle finestre iniziali. Gli orari sono Europe/Rome; il backup è un'alternativa. Lo snapshot ufficiale è datato, non una sincronizzazione continua. Per aggiornare: `python3 scripts/refresh-agenda.py`, controlla il diff e ridistribuisci. Il comando aggiorna solo le sessioni locali e conserva gli slot originali; gli appuntamenti salvati nel database non vengono spostati. Nessun nome non trovato viene associato automaticamente.

## Domande e PWA

“Prepara altre 10 domande” offre bozze IT/EN ancorate a estratti di abstract, materiali o biografia; senza testi usa tracce esplorative sul titolo e segnala la lacuna. Sono spunti editoriali da rivedere, non una ricerca autonoma o un servizio AI. IDs stabili evitano duplicati e la ricomparsa di bozze eliminate. Voti personali 1–5, media, ordinamento; scarto tramite stato e cancellazione con conferma. Le cancellazioni registrano un tombstone privato che impedisce il reimport dello stesso ID.

La PWA è installabile dal browser su HTTPS. Il service worker conserva solo asset pubblici e pagina offline, mai API o pagine autenticate. Non supporta scritture offline. La pagina offline invita a riconnettersi; le bozze aperte rimangono nello stato della pagina finché questa resta aperta.

### Importare le traduzioni nelle schede esistenti

Apri **Importa traduzioni IT/EN**, poi **Valida e mostra anteprima → Seleziona traduzioni mancanti**. Controlla il risultato e conferma l’importazione. Il pacchetto contiene solo campi vuoti su schede esistenti con originale invariato; le schede già verificate e quelle con originale modificato vengono escluse e conteggiate. I testi già scritti dal team e i documenti sorgenti restano invariati. Ogni salvataggio usa le revisioni per evitare sovrascritture concorrenti. I nuovi import del catalogo/seed includono già i testi IT/EN. `data/seed/translations.json` è il pacchetto manuale equivalente, da usare con revisione campo per campo.

Il filtro **Elenco interviste** segue la selezione Bacaro del manifest, corrispondente alle cartelle `01_speaker_in_elenco` (29) e `02_speaker_fuori_elenco` (55). Non usa `inDirectorySnapshot`, che indica la presenza nella directory della conferenza (81), né la priorità modificabile. La correzione si applica anche ai dati già importati senza migrazione.

### Aggiornare i tag

**Aggiorna tag** propone categorie (AI, Backend, Frontend, Cloud, DevOps, Sicurezza, Dati, Leadership) dai titoli, abstract IT/EN e argomenti dei talk associati. È un riconoscimento locale per parole chiave, non ricerca AI. L’anteprima mostra la parola riconosciuta; seleziona singoli tag o tutti e premi **Conferma aggiornamento tag**. Sono aggiunti solo nuovi tag: quelli manuali restano invariati, i duplicati sono ignorati senza distinzione maiuscole/minuscole e gli speaker senza indizi non vengono modificati. Le revisioni impediscono sovrascritture se una scheda cambia dopo l’anteprima. Ripetere l’operazione senza nuovi contenuti non propone nuovamente i tag già presenti.

### Cache delle letture Firestore

Le letture dell'app passano dalle API SvelteKit dopo l'autenticazione. Il server usa
`@vercel/functions` Runtime Cache su Vercel, condivisa fra le istanze nella stessa
regione; in sviluppo il pacchetto usa una cache in memoria. Non servono nuove chiavi
segrete. Il namespace separa progetto Firebase, progetto Vercel, workspace ed emulatori.

- Collezioni, inclusi membri e ID delle domande eliminate: cache di 5 minuti.
- Documento degli accessi: cache di 30 minuti per le letture. Le scritture verificano
  sempre i permessi su Firestore; la verifica del token Firebase resta attiva.
- Sincronizzazione profilo al login: una volta all'ora per UID/nome, salvo cache miss.
- Salvataggi/import, cancellazioni, rating e gestione accessi invalidano le rispettive
  cache dopo la transazione. Una query precedente alla modifica non può ripopolare la
  generazione corrente con una risposta vecchia.
- Il browser aggiorna i dati ogni minuto solo se visibile e online; dopo una propria
  modifica aggiorna subito le sole collezioni interessate.

L'invalidazione tramite versione aggiorna la regione che riceve la scrittura. In un
futuro deploy multi-regione, o se il backend cache non registra l'invalidazione,
altre istanze possono mostrare i dati precedenti fino alla scadenza (5 minuti per
contenuti, 30 minuti per accessi). Non è una garanzia di consistenza immediata globale;
le revisioni nelle transazioni impediscono comunque di sovrascrivere dati più recenti.

Le risposte HTTP autenticate restano `private, no-store`: questa è una cache dei dati
sul server, non una cache pubblica della CDN. Le transazioni mantengono le letture
Firestore dirette per controllo revisioni, rating e cancellazioni. Le modifiche fatte
fuori dall'app (console/script) diventano visibili alla scadenza della cache; una
revoca esterna può richiedere fino a 30 minuti sulle letture, mentre le scritture
consultano sempre il documento corrente.

Un esempio senza modifiche: 300 documenti ricaricati ogni 15 secondi producono circa
72.000 letture/ora per browser. Con una cache calda di 5 minuti nella stessa regione,
le scansioni periodiche equivalenti scendono a circa 3.600 documenti/ora, condivise tra
utenti. Non è un limite garantito: scritture, scadenze, eviction, regioni e cache miss
contemporanei possono aumentare il consumo. I payload grandi vengono suddivisi in
blocchi per rispettare il limite per elemento di Runtime Cache.

I log `[firestore-read]` mostrano collezione e numero di documenti per le scansioni
che raggiungono Firestore, senza contenuti o credenziali. Su Vercel controllare anche
Runtime Cache nell'osservabilità: se compare `Runtime Cache unavailable`, il pacchetto
sta usando solo memoria locale e il risparmio non è condiviso tra istanze. La cache
Vercel ha quote e condizioni proprie: vedere la
[documentazione ufficiale](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#getcache).

### Trasferire il lavoro editoriale da Vercel al locale

Dopo il deploy di questa versione, apri **Esporta il mio lavoro** su Vercel. Il pannello
legge lo stato salvato attraverso le API autenticate e la cache server. Non include
bozze ancora aperte nell'editor. Controlla i campi proposti e premi **Scarica export JSON**.

- I nuovi salvataggi distinguono inserimenti manuali e import JSON. Le modifiche manuali
  a una scheda importata vengono esportate come campi aggiuntivi/modificati, senza
  copiare tutto il catalogo. Il tracciamento è calcolato sul server, non accetta i
  metadati dichiarati dal documento inviato dal client.
- Per i dati salvati prima di questa funzione non esiste una cronologia dell'origine:
  il confronto con catalogo, seed, pacchetto speaker e abstract riconosce i valori già
  importabili. Le differenze e i documenti sconosciuti sono **da verificare**, inizialmente
  deselezionati. Anche un vecchio import JSON personalizzato può apparire tra questi.
  Controlla quindi i campi per distinguere il tuo lavoro dagli altri import.
- I contenuti editoriali sono condivisi dal workspace: il pannello non pretende di
  attribuire retroattivamente ogni testo al singolo autore. I voti, invece, sono solo
  quelli dell'account con cui stai esportando e non contengono il suo UID.

In locale, con gli emulatori attivi e `PUBLIC_USE_EMULATORS=true`:

1. Importa i pacchetti originali necessari (catalogo speaker e gli eventuali altri JSON
   usati su Vercel), mantenendo gli stessi ID.
2. Apri **Importa JSON → Apri file JSON** e scegli l'export del lavoro.
3. Controlla l'anteprima. I nuovi documenti sono selezionati; le modifiche a documenti
   esistenti richiedono la selezione dei singoli campi. I riferimenti di base mancanti
   bloccano il ripristino per evitare schede scollegate/incomplete.
4. Se desiderato seleziona **Ripristina … voti sul mio account attuale**. Le domande
   devono già esistere o essere create dallo stesso import. Puoi lasciare i voti
   deselezionati e ripristinare comunque gli altri contenuti.
5. Approva e conferma. I documenti sono salvati in transazione con controllo revisioni;
   i voti sono applicati successivamente. In caso di errore nei voti riapri il file:
   ripeterli non crea duplicati. Gli export editoriali preservano gli stati delle domande;
   gli import di ricerca ordinari continuano a proporle come `suggested`.

Massimo 400 documenti per file: per quantità maggiori seleziona gruppi separati. I
riferimenti a documenti manuali esclusi dalla selezione vanno ripristinati prima dei
contenuti che li citano. Il nome completo dello speaker e il contesto di validazione
per gli slot sono mantenuti anche negli export parziali.

Questo è un trasferimento del lavoro editoriale, non un backup completo del database:
non trasferisce account, credenziali, voti altrui, cronologia o cancellazioni/tombstone.
Le assegnazioni a UID di membri remoti possono richiedere una nuova assegnazione in
locale. I file scaricati restano sul tuo computer: non committarli se contengono appunti
privati. Con gli emulatori salva un nuovo export prima di interrompere la sessione se
non hai configurato la persistenza dei loro dati.

### Export / import completo del workspace

Il pulsante **Export / import completo** è distinto da **Esporta il mio lavoro**.
**Scarica backup completo** include tutte le otto collezioni editoriali, `members`
(profili visualizzati, non account Auth) e `deletedQuestions`, compresi dati importati
via JSON, voti di tutti, stati delle domande, origine dei contenuti e riferimenti.
Non include altre applicazioni Firebase, credenziali, Firebase Authentication,
`ALLOW_LIST`, `SUPERADMIN_EMAILS` o il documento privato degli accessi.

L'export usa letture autenticate e la cache server esistente. Le pagine di risposta
rimangono sotto 2 MB, e il browser le ricompone in un file JSON. La versione della
collezione viene verificata tra le pagine: se cambia, l'export viene interrotto per
non mescolare pagine differenti. Non è una transazione unica su tutto il workspace;
evitare modifiche durante il trasferimento e attendere la scadenza della cache (5
minuti) per modifiche fatte direttamente dalla console/script.

Per ripristinare:

1. Accedi come **superadmin della destinazione**, anche negli emulatori locali.
2. Apri **Export / import completo → Apri backup completo**. Non usare l'import di
   ricerca JSON o quello del solo lavoro editoriale per questo formato.
3. Controlla progetto di destinazione, conteggi e differenze tra documenti attuali
   e backup. In una destinazione vuota non occorre importare prima il catalogo.
4. Approva le sostituzioni/cancellazioni indicate e premi **Ripristina backup completo**.

Il ripristino aggiunge i documenti mancanti e sostituisce interamente quelli con lo
stesso ID. **Non svuota la destinazione**: i documenti assenti dal file sono conservati,
salvo le domande marcate come eliminate nel backup. Ripristinare una domanda presente
rimuove il suo eventuale tombstone locale; ripristinare un tombstone elimina la domanda
locale corrispondente. Le due operazioni viaggiano nello stesso blocco atomico.

Le scritture sono suddivise in blocchi fino a 100 operazioni e 2 MB, quindi possono
superare complessivamente 400 documenti. Ogni blocco ricontrolla i valori della preview
in transazione; un conflitto interrompe il ripristino senza annullare i blocchi già
completati. **Ricarica anteprima completa** prima di riprovare: i documenti già uguali
vengono saltati. Revisioni e ultimo aggiornamento dei contenuti ripristinati vengono
aggiornati sul server per mantenere il controllo dei conflitti.

Voti e assegnazioni mantengono gli UID originali: un account creato nell'emulatore
potrebbe avere un UID differente. Il ripristino dei profili non concede accesso né
privilegi e non ricrea gli account Google. L'import completo è riservato al superadmin
perché può sostituire anche voti e contenuti degli altri membri. File fino a 100 MiB
sono accettati dal pannello; conservare il file scaricato come backup prima di procedere.

### Ricerca unificata

La scheda **Ricerca** riunisce materiali, fonti e insight dello speaker. **Aggiungi
ricerca** apre un unico modulo per nuovi appunti, riassunti e link. I record esistenti
rimangono nelle rispettive collezioni: modifica ed eliminazione operano sull'ID e
sulla collezione originali, senza migrazioni o riscritture automatiche. Anche record
con lo stesso ID in collezioni diverse rimangono distinti. Import/export e backup
mantengono il formato precedente. Sono visibili anche le fonti citate nei materiali
e negli insight, e gli insight collegati ai materiali dello speaker.

### Due sessioni AI per la ricerca

Nella scheda **Ricerca**, aprire **Ricerca con Gemini / ChatGPT**:

1. **Copia prompt ricerca** prepara il contesto dello speaker e dei talk, richiede
   fonti verificabili e un Markdown italiano con punti chiave IT/EN. Incollarlo nella
   propria chat AI; l'app non effettua chiamate AI e non invia i contenuti automaticamente.
2. Caricare uno o più file `.md`, oppure incollare ogni risultato e premere
   **Aggiungi all’anteprima**. Controllare i testi, quindi **Conferma e salva**.
   Ogni risultato crea un nuovo materiale collegato allo speaker con provenienza
   `ai_generated`. Nessun contenuto precedente viene sovrascritto. Limiti: 200 KiB
   per documento, 30 documenti per anteprima e 2 MB complessivi per salvataggio.
3. Selezionare i contenuti utili e premere **Copia prompt domande**. Aprire una nuova
   chat: il prompt include la ricerca scelta, lingua prevista, talk e domande già
   presenti per evitare duplicati; richiede domande e follow-up IT/EN con riferimenti.

Il prompt resta visibile e selezionabile se la copia automatica non è disponibile.
Il contesto non viene troncato; sopra 50.000 caratteri viene suggerita una selezione
più piccola. Biografia e abstract sono inclusi in una sola lingua per ridurre ripetizioni.
Le domande importate via Markdown rimangono testo nella Ricerca: non vengono inserite
automaticamente nella scaletta strutturata. Le bozze nell'anteprima non sono ancora
salvate: confermarle prima di cambiare speaker o ricaricare la pagina.
