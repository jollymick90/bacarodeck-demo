# Bacarodeck: scheda conduttore e connessioni editoriali

Data: 25 ottobre 2026. Stato: progetto approvato in conversazione; prima fase mobile implementata sul branch feat/conductor-mobile. Grafo 3D e somiglianze automatiche restano la seconda fase.

Revisione indipendente di pianificabilità completata: nessuna domanda di prodotto indispensabile rimasta aperta. Le decisioni tecniche delegate devono essere motivate nel successivo piano. Bozza interattiva locale: `.superpowers/brainstorm/52241-1792936991/content/conductor-flow-v2.html` (non inclusa nel commit).

## Intento

Il lavoro autoriale prepara i conduttori alle interviste. L'app deve permettere anche a chi ha pochi minuti di capire un talk e usare una scaletta pronta dal telefono, digitando il meno possibile. Chi ha tempo può esplorare, approfondire e modificare. L'interfaccia attuale resta il backoffice, accessibile anche ai conduttori; le due viste lavorano sugli stessi dati.

## Decisioni concordate

- Ingresso per speaker, con esplorazione per topic disponibile.
- I propri speaker salvati vengono prima; restano visibili anche dopo l'assegnazione a un collega.
- Il salvataggio esprime interesse, attribuito a una persona e visibile a tutto il team. Più persone possono essere interessate allo stesso speaker.
- Interesse e assegnazione sono distinti. Chiunque può assegnare sé o un collega; sostituire un assegnatario richiede un popup di allerta e conferma.
- Testi, scelta e ordine delle domande sono condivisi. Non esistono scalette private.
- Le tre domande principali sono inizialmente suggerite dall'autore; i conduttori possono modificarle, sostituirle e riordinarle.
- Il grafo 3D collega topic, speaker e domande: topic comuni, speaker con argomenti simili e domande simili tra speaker diversi.
- Le connessioni si aggiornano automaticamente quando cambiano i contenuti e sono immediatamente visibili, senza revisione obbligatoria.
- Tutti i conduttori possono anche aggiungere e rimuovere collegamenti manualmente.

## Home mobile

Prima sezione: «I miei speaker», cioè gli speaker per cui la persona corrente ha espresso interesse. Ogni scheda mostra nome, topic, sintesi breve del talk, stato della scaletta, interessati e assegnatario se presente. Il salvataggio non assegna né blocca la persona.

Segue «Ancora da assegnare». Un filtro per topic richiede solo un tocco; ricerca testuale e accesso all'elenco completo rimangono facoltativi. Gli speaker già presenti nella prima sezione non sono ripetuti nella seconda (scelta progettuale proposta). Le assegnazioni sono sempre visibili nelle schede salvate. Non confondere disponibilità organizzativa con disponibilità reale dello speaker.

Navigazione proposta: Speaker, Topic, Backoffice. Nessuna sezione «le mie scalette», perché le scalette sono comuni.

## Scheda conduttore

In ordine: nome e ruolo breve; talk e sintesi leggibile in circa venti secondi; topic; interesse proprio e degli altri; assegnazione; tre domande principali numerate. Quindi sezioni espandibili per domande classiche, tutte le altre domande, approfondimenti e fonti. Accesso alle connessioni dal topic, dallo speaker e dalla singola domanda.

«Usa la scaletta» apre una modalità intervista con una domanda grande alla volta, avanti/indietro, posizione nella sequenza e approfondimenti facoltativi. L'uso della modalità non cambia automaticamente lo stato delle domande (scelta proposta).

Le tre domande sono un insieme ordinato di riferimenti a domande strutturate, non copie. Se ne mancano, mostrare quelle disponibili e una lacuna esplicita, senza inventare contenuti. Se esistono più talk, la scheda distingue il talk selezionato e permette di cambiarlo; la pianificazione esistente resta disponibile nel backoffice. Non concatenare abstract diversi in una sintesi ambigua.

Per sostituire una domanda si apre l'elenco e si sceglie con un tocco. Per riordinare prevedere anche pulsanti su/giù, senza dipendere dal trascinamento. La modifica testuale è volontaria e richiede salvataggio esplicito; selezione e ordine si salvano direttamente con feedback. Mostrare che le modifiche valgono per tutti. Concorrenza: conservare le modifiche non salvate e segnalare un conflitto, senza sovrascrivere silenziosamente.

Le domande classiche sono tracce editoriali introduttive, distinte da quelle specifiche del talk. Scelta proposta: permetterne l'inserimento nella scaletta come domande strutturate; non sostituire automaticamente le tre principali in base ai voti. Le sintesi brevi sono contenuti editoriali condivisi; in loro assenza mostrare il titolo e un estratto dell'abstract chiaramente indicato, senza bloccare l'accesso alle domande.

## Interesse e assegnazione

Ogni interesse identifica speaker e persona. Non usare un solo booleano globale per tutti. La vista personale è un filtro dei dati condivisi. Rimuovere il proprio interesse non rimuove quelli dei colleghi, l'assegnazione o la scaletta.

Assegnare uno speaker libero è un'azione esplicita; riassegnarlo mostra nome dello speaker, assegnatario attuale e nuovo assegnatario, con «Annulla» e «Conferma riassegnazione». Se l'assegnatario cambia durante il popup, richiedere una nuova conferma con lo stato aggiornato. La lista delle persone assegnabili deve riutilizzare il team editoriale esistente, distinto dagli account Google; il builder definirà la mappatura tra identità autenticata e persona del team. Il controllo delle revisioni deve mantenere coerenti piano e programmazione, evitando una seconda assegnazione indipendente.

## Connessioni e grafo 3D

Tipi di nodo: topic, speaker, domanda; i talk forniscono contesto ed evidenze ai collegamenti. Topic con ID stabili e alias permettono di ricondurre sinonimi e IT/EN allo stesso tema. Le categorie generali attuali non bastano a rappresentare temi specifici come valutazione degli agenti.

Tipi di collegamento: speaker tratta topic; domanda riguarda topic; topic correlato a topic; speaker affine a speaker; domanda simile a domanda. Distinguere relazione esplicita, somiglianza automatica e collegamento manuale. Ogni relazione espone un motivo leggibile, i contenuti di origine e, per i suggerimenti, la natura automatica. Le somiglianze tra domande indicano vicinanza semantica, non equivalenza certa: non deduplicare o cancellare automaticamente.

La vista si apre sul nodo di provenienza e mostra inizialmente un intorno limitato. Toccare un nodo mostra dettagli e azioni per aprire la scheda, espandere o restringere le connessioni. Filtri per tipo di nodo e relazione. Il grafo deve essere realmente navigabile in 3D; il disegno nella bozza è solo uno schema concettuale. Affiancare una lista equivalente, utilizzabile su telefono e senza WebGL. Testi e azioni non devono dipendere da rotazione, hover o colore. Nessuna rotazione automatica obbligatoria.

Dal dettaglio di un nodo, «Collega» consente di cercare e selezionare un nodo destinazione e il tipo di relazione. Rimozione e conferma sono disponibili anche sul telefono. Rimuovere un collegamento automatico registra uno scarto; non elimina i nodi.

## Aggiornamento automatico

Al salvataggio di un contenuto pertinente, accodare in background un ricalcolo incrementale. Considerare titolo, abstract, topic, testo delle domande IT/EN e materiali pertinenti; il builder definirà granularità, limiti e selezione del contesto. Aggiornare anche le connessioni in entrata dei contenuti modificati. Revisioni o hash degli input impediscono di pubblicare risultati riferiti a versioni superate; operazioni ripetute non devono creare duplicati.

Nuove connessioni automatiche appaiono subito al termine del calcolo. Durante il lavoro mostrare «Connessioni in aggiornamento» e conservare le precedenti come potenzialmente datate, escludendo riferimenti a elementi eliminati. Un errore non blocca salvataggio e interviste; rendere disponibile il ritento. Elaborare i contenuti esistenti una prima volta.

Conservare separatamente risultati automatici, collegamenti/conferme manuali e scarti. Il ricalcolo non sovrascrive interventi manuali. Scelta proposta: uno scarto vale per coppia di nodi e tipo di relazione fino a ripristino esplicito, anche dopo modifiche testuali; eliminare un nodo rende inattivi i suoi collegamenti.

La tecnica semantica è demandata al builder: confronto multilingue tramite embeddings o soluzione equivalente, con soglie calibrate su esempi reali IT/EN. Non bastano parole chiave uguali per dichiarare domande semanticamente simili. Provider, modello, costi, limiti di volume e servizio per i processi in background devono essere esplicitati nel piano prima dell'implementazione; nessun invio a servizi esterni viene effettuato in questa fase. Le spiegazioni devono citare elementi presenti nei contenuti; non inventare biografie o competenze. Non introdurre un database a grafo come requisito implicito.

## Integrazione con l'esistente

Riutilizzare SvelteKit/Svelte 5, autenticazione, autorizzazioni server e Firestore attuali. Tutti i conduttori autorizzati accedono a entrambe le viste; le funzioni amministrative di gestione accessi e ripristino completo mantengono i permessi attuali. Nessuna nuova gerarchia editoriale.

Riutilizzare domande, materiali, fonti, piani e programmazione. Le domande presenti solo nei Markdown di ricerca richiedono promozione esplicita a record strutturati, con anteprima e riferimenti alla ricerca originale; non estrarre e pubblicare automaticamente domande da qualsiasi paragrafo.

Il piano deve includere estensioni di schema e API, compatibilità import/export e backup per interessi, scalette, topic e collegamenti, migrazione non distruttiva e controllo delle revisioni. Nessuna ricostruzione retroattiva degli interessi dai voti o dalle assegnazioni. Proporre inizialmente le domande già ordinate quando presenti; conservarle come proposta da validare, senza attribuire una selezione autoriale mai effettuata.

## Criteri di verifica

1. Un conduttore trova i propri interessi per primi e vede anche quelli altrui; salvare non assegna.
2. Uno speaker salvato resta visibile se assegnato a un collega.
3. Uno speaker preparato può essere portato in modalità intervista senza digitare.
4. Modificare o sostituire una domanda aggiorna la scaletta visibile a tutti e conserva i riferimenti alle fonti.
5. Una riassegnazione richiede conferma informata; un conflitto successivo non viene sovrascritto.
6. Da un topic si raggiungono temi comuni e speaker affini; da una domanda si trovano domande simili di altri speaker, anche IT/EN.
7. Modificare un contenuto avvia il ricalcolo, senza bloccare la scheda o pubblicare risultati superati.
8. Collegamenti manuali e scarti resistono ai ricalcoli e sono modificabili dal telefono.
9. Grafo 3D e lista permettono entrambi di aprire i contenuti; il backoffice resta accessibile ai conduttori.

## Fuori da questa fase

Implementazione, dipendenze, deployment e modifiche a dati remoti. Non sono richiesti messaggi agli speaker, prenotazioni esclusive o scalette private. La bozza usa contenuti dimostrativi e illustra interazioni locali, senza salvare nel workspace.
