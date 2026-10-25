# Consegna prima fase: vista conduttore

Branch: `feat/conductor-mobile`, derivato da `main` al commit `39e305d`.
Worktree: `.worktrees/conductor-mobile`.

## Risultato

- `/`: speaker salvati in cima, interessi personali visibili al team, topic e ricerca.
- Scheda con talk, sintesi, tre principali, classiche, altre domande e ricerca.
- Scaletta e testi condivisi; modalità intervista senza digitazione obbligatoria.
- Assegnazione dal controllo comune alle due viste; conferma informata della sostituzione e controllo dei conflitti.
- `/backoffice`: ambiente precedente, disponibile agli stessi conduttori autorizzati.
- Promozione volontaria delle domande dai materiali Markdown, con anteprima.
- Backup versione 2 con lettura dei precedenti; schede incluse nell'export editoriale con dipendenze.

## Scelte di implementazione

L'autenticazione e le subscription restano nel componente `Hub`, condiviso dalle
due route. Questa scelta evita due inizializzazioni concorrenti; un'ulteriore
separazione del contenitore potrà essere fatta senza cambiare i dati.

Gli interessi possono essere modificati soltanto dal titolare autenticato, ma tutti
i membri autorizzati possono leggerli. L'import di ricerca non può attribuirli ad
altri; il ripristino completo del superadmin li conserva con gli UID originali.
Se in futuro servirà selezionare per conto di un collega, occorrerà un'azione dedicata.

## Revisione indipendente

La review ha individuato due problemi di coerenza delle assegnazioni, corretti con
test prima falliti e poi passati:

1. Gli slot originali non ancora salvati vengono ora materializzati nella stessa
   transazione dell'assegnazione. Il risultato non dipende dall'ordine di apertura
   della programmazione.
2. Il CRUD generico non può eliminare un piano o uno slot assegnato, lasciando
   valori discordanti nell'altro documento. La regressione API verifica il rifiuto.

Nessuna osservazione minore rinviata. La qualità del grafo è esclusa dalla review
perché appartiene alla seconda fase approvata. Nessuna verifica tramite deploy è
stata eseguita: la consegna è locale.

## Verifiche

- Baseline: 79 test unitari.
- Dopo le correzioni: 96 test unitari passati; Svelte/TypeScript senza errori o warning.
- Browser: percorso conduttore con due account e backoffice su desktop e telefono,
  usando esclusivamente Auth e Firestore del progetto `demo-bacarodeck` su porte dedicate:
  6 test passati dopo le correzioni (26,7 secondi).
- Build Vercel locale riuscita dopo le correzioni, senza deploy o scritture sui dati reali.
  L'adapter emette avvisi di risoluzione per `ws` (`utf-8-validate`, `bufferutil`) e
  il percorso dei metadati `google-gax`; non è stata aggiunta alcuna dipendenza.
- Controllo visivo della scheda a 390 CSS px e verifica assenza di overflow orizzontale.

Grafo 3D, connessioni semantiche e ricalcolo automatico non sono implementati in
questa prima fase. Le altre sessioni ricevono i cambiamenti tramite il polling già
presente (60 secondi) o ricaricando.
