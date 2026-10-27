# Login persistente e consultazione offline per l'evento

Data: 25 ottobre 2026. Requisiti e proposta tecnica approvati in chat.
Revisione indipendente completata: nessuna domanda di prodotto indispensabile
rimasta aperta per pianificare l'implementazione.
Ordine: login unico, download locale completo, riapertura offline, aggiornamento online.
Il grafo rimane successivo a questa consegna.

## Stato di implementazione

Prima priorità implementata: home e backoffice riutilizzano Auth e Firestore;
la persistenza locale di Auth è esplicita e il listener attende il ripristino
dell'identità prima di mostrare l'accesso. Test browser desktop e mobile verificano
navigazione ripetuta, reload, chiusura e riapertura completa del browser con lo
stesso profilo e logout. Corretto anche il favicon mancante.

27 ottobre: aggiunti download completo in pagine limitate, snapshot atomico IndexedDB,
lettura locale per 30 giorni, shell riapribile offline e aggiornamento della copia.
Lo stato «Pronto» attende risorse e dati completi; API private e permessi server restano protetti.
Le prove di accettazione sono registrate nel piano `2026-10-27-offline-reading.md`.

## Obiettivo e decisioni concordate

Una persona accede con Google sul proprio telefono quando ha rete, prepara il
dispositivo e può poi consultare tutti i contenuti senza rete, anche chiudendo e
riaprendo l'app. Home e backoffice usano lo stesso accesso. Offline è prevista
soltanto la consultazione: ricerca, filtri di lettura, speaker salvati, domande,
approfondimenti e modalità intervista. Nessuna coda di modifiche da sincronizzare.

L'accesso alla copia offline vale 30 giorni dall'ultima verifica online riuscita,
rinnovato automaticamente da una nuova verifica riuscita. La validità dell'accesso
e la data di aggiornamento dei contenuti sono informazioni distinte.

## Evidenze sul codice attuale

`getFirebase()` chiama ogni volta `initializeFirestore()` con una nuova istanza di
`memoryLocalCache()`. Un esperimento con le stesse versioni SDK, senza credenziali o
richieste remote, riproduce `failed-precondition: initializeFirestore() has already
been called with different options` alla seconda chiamata. Le due route montano
nuovamente Hub, quindi questo percorso deve diventare idempotente usando l'istanza
già inizializzata. La prova browser dovrà verificare anche che non rimangano altre
cause del sintomo segnalato.

Ogni montaggio ripete `/api/access`. Errori nelle letture possono attualmente
chiamare `denied()` e svuotare la memoria. Il service worker salva asset e una
pagina informativa offline, ma non un'app riapribile con contenuti persistenti.
Le letture editoriali passano dalle API Admin: attivare la cache offline Firestore
da solo non conserverebbe queste risposte.

## Login e accesso

- Google resta obbligatorio per accedere inizialmente ai contenuti condivisi.
- Rendere esplicita la persistenza locale dell'autenticazione e attendere il suo
  ripristino prima di mostrare il login. Riutilizzare app, Auth e Firestore già
  inizializzati tra route, reload e navigazioni ripetute.
- Conservare nello storage locale l'identità della copia scaricata e l'esito
  temporale dell'ultima autorizzazione riuscita, separati dalle credenziali Firebase.
- Una verifica di rete fallita o una risposta 5xx non equivale a revoca: una copia
  già autorizzata e non scaduta resta consultabile. In questa condizione le scritture
  restano disabilitate finché non riesce una nuova verifica online.
- Una risposta 401 richiede una nuova autenticazione per operazioni online. Può
  restare disponibile la copia locale dell'identità precedentemente verificata,
  entro i suoi 30 giorni, senza autorizzare nuove richieste protette.
- Una risposta 403 di accesso esplicitamente revocato blocca l'accesso e invalida la
  copia locale. La scadenza dei 30 giorni richiede rete e verifica prima di riaprire
  i contenuti. Tornare online non deve mostrare per un istante dati revocati.
- Logout esplicito e cambio account eliminano o rendono inaccessibili i contenuti
  della precedente identità; non mostrare uno snapshot di un altro account.

## Preparazione del telefono

Comando «Prepara questo telefono per l'evento» raggiungibile da entrambe le viste.
Il primo download è esplicito, eseguito dopo autorizzazione online riuscita.

Il pacchetto include tutte le collezioni editoriali, membri visualizzati, interessi,
scalette, domande IT/EN, materiali e fonti del workspace. Esclude configurazione
accessi, segreti, token e strumenti amministrativi. I testi già importati vengono
scaricati; siti esterni, PDF non importati e altri allegati remoti restano link che
richiedono rete. Le foto remote sono facoltative e non bloccano la preparazione.

Il pannello mostra avanzamento, conteggi, data dell'ultimo download completo e
scadenza dell'accesso offline. «Pronto per l'evento» appare soltanto quando dati e
risorse dell'app necessari a entrambe le route sono disponibili localmente.
Richiedere lo storage persistente quando supportato e mostrare errori di quota o
storage indisponibile senza dichiarare pronto il dispositivo.

Usare IndexedDB per uno snapshot coerente, indicizzato per progetto, workspace e
UID. Scaricare in pagine limitate tramite API autenticate; non affidarsi a una
risposta unica contenente tutto il workspace. Un aggiornamento incompleto o fallito
non sostituisce mai l'ultimo pacchetto valido. Identificatori/versioni delle
collezioni permettono di rilevare cambiamenti durante il download e ritentare.
Il timestamp di completamento non implica una transazione globale Firestore.

## Consultazione offline

Il service worker conserva il necessario ad avviare l'app e a raggiungere `/` e
`/backoffice`, anche con query per speaker/talk. Non mette nella cache HTTP risposte
API private. L'autorizzazione locale e lo snapshot vengono controllati nell'app;
il fallback HTML non incorpora contenuti personali.

La copia scaricata alimenta le stesse viste già presenti: nessuna scheda offline
separata da mantenere. Mostrare «Consultazione offline» e data dei contenuti.
Domande, ricerca locale, espansione degli approfondimenti, lingua e carte intervista
sono utilizzabili. Salvataggio interessi, assegnazione, edit, voti, import, restore,
promozione domande e altre mutazioni sono disabilitati con spiegazione breve.
La disabilitazione deve coprire anche i dialog aperti prima della disconnessione.
Nessuna perdita di dati visibili a seguito del fallimento di un polling.

Senza pacchetto completo mostrare la necessità di preparare il dispositivo online.
Con storage cancellato dal browser o app installata su un altro dispositivo serve
un nuovo download: non promettere conservazione garantita dal sistema operativo.

## Ritorno online

Verificare prima identità e autorizzazione; solo dopo riabilitare le scritture.
Se il dispositivo è già stato preparato, aggiornare automaticamente il pacchetto
con un processo deduplicato e un intervallo limitato, oltre al comando «Aggiorna
adesso». Il builder stabilisce intervallo e batching; non ricostruire tutto a ogni
polling o tocco. La copia precedente resta valida finché la nuova è completa.
Il rinnovo dei 30 giorni dipende da `/api/access` riuscita, anche se il download
successivo fallisce; la data dei dati resta quella effettiva.

## Limiti consapevoli

Questa è disponibilità locale su un dispositivo già autorizzato, non una sessione
server di 30 giorni né un token API esteso. Offline una revoca remota non è
conoscibile fino alla riconnessione; il limite locale di 30 giorni è una regola
dell'app, non una protezione contro la manipolazione del dispositivo o dell'orologio.
Nessuna modifica alle autorizzazioni delle API o alle regole Firestore per ottenere
l'offline. Nessun accesso pubblico ai dati.

## Prove di accettazione

1. Login Google una volta, home→backoffice→home ripetuto, reload e nuovo avvio nello
   stesso profilo browser: stesso account, nessun secondo popup, nessun errore SDK.
2. Preparazione completa online, rete spenta, app chiusa e riaperta: entrambe le
   route e le carte intervista funzionano con tutti i dati scaricati, inclusi
   materiali mai aperti prima del download.
3. Token API scaduto ma verifica locale entro 30 giorni: lettura offline funziona;
   dopo il limite serve rete. Nessuna verifica fallita rinnova il periodo.
4. Tutte le mutazioni restano disabilitate offline, compresi dialog già aperti;
   nessuna scrittura locale viene accodata.
5. Download interrotto, quota esaurita o aggiornamento parziale: vecchia copia
   conservata e nessun falso «Pronto». Primo download fallito non abilita l'offline.
6. Rete torna: permessi verificati, dati aggiornati; un 403 invalida la copia.
   Logout/cambio account non espongono i dati dell'identità precedente.
7. Test production-like del service worker, oltre ai test su Vite dev che da soli
   non dimostrano la riapertura offline. Nessun test richiede credenziali reali.

## Riferimenti tecnici

- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/auth/admin/manage-sessions
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

La libreria per IndexedDB, la suddivisione dei moduli e i dettagli del test
production-like sono lasciati al piano tecnico; non richiedono nuove decisioni di
prodotto salvo incompatibilità concreta emersa durante la verifica.
