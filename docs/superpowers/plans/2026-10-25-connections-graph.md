# Connessioni semantiche e grafo 3D Implementation Plan

**Goal:** Scoprire temi comuni, speaker affini e domande simili con ricalcolo automatico e collegamenti manuali condivisi.
**Spec:** `docs/superpowers/specs/2026-10-25-conductor-mobile-design.md`, sezione connessioni, approvata; utente autorizza implementazione in questa sessione.
**Architecture:** SvelteKit, Firestore per contenuti/decisioni/job, embeddings multilingue sul server e Three.js solo nel browser. Nessun database a grafo o servizio AI a pagamento. I risultati automatici sono derivati; conferme, collegamenti e scarti sono record editoriali separati.

## Decisioni tecniche
- Modello `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, revisione fissata, q8, 384 dimensioni, mean pooling normalizzato, Transformers.js CPU. Pesi scaricati da Hugging Face nella cache del server, testi mai inviati al provider. Costo: CPU/storage hosting, nessun costo API. Prima elaborazione più lenta; errore esplicito e ritento se modello non disponibile.
- Embeddings per contenuto/hash, estratti limitati delle note (non intero dossier); nuova versione invalida cache. Confronti del corpus limitati e batch per controllare risorse. Soglie calibrate su esempi reali IT/EN, senza trasformare coincidenze di tag in equivalenza semantica.
- Job persistente con lease e generazione in Firestore, `waitUntil` per lavoro dopo risposta e ripresa al caricamento/poll della vista; un crash non perde la richiesta. Pubblicazione condizionata alla versione ancora corrente. Salvataggi invalidano anche collegamenti in entrata; risultati vecchi etichettati.
- `topics` e `graphLinks` entrano nello schema, negli export e nei backup. Vecchi backup restano leggibili. I default dei topic provengono dal catalogo editoriale; i collegamenti editoriali precedenti non sono spacciati per calcolo semantico.
- Route `/topic/connessioni`, query `node`, `view=3d|list`, `depth=1|2`; nessun routing hash. Three.js/OrbitControls per 3D reale, nessuna autorotazione, lista equivalente e fallback WebGL.

## Interfacce condivise
`src/lib/connections/types.ts`:
- GraphNode: `{id,kind:'speaker'|'topic'|'question',entityId,label,href,text,speakerId?:string,aliases?:string[],tags?:string[],evidence:Evidence[]}`.
- Evidence: `{collection:string,id:string,excerpt:string}`.
- GraphEdge: `{id,source,target,kind:RelationKind,origin:'explicit'|'automatic'|'manual'|'confirmed',reason,score?:number,evidence:Evidence[]}`.
- RelationKind: speaker-topic, question-topic, topic-related, speaker-similar, question-similar.
- GraphResponse: `{nodes,edges,overrides:Entity[],status:{state:'pending'|'running'|'ready'|'error',error?:string,generatedAt?:number,progress?:number,total?:number},model:string,stale:boolean}`.
- `buildGraphNodes(data:Dataset):GraphNode[]`, `buildAutomaticEdges(nodes,vectors:Record<string,number[]>):GraphEdge[]`, `mergeGraphEdges(nodes,automatic,overrides):GraphEdge[]`, `relationId(kind,source,target):string`, `validateRelation(kind,sourceNode,targetNode):void`.
- GET `/api/connections`: GraphResponse; POST `{action:'refresh'}` oppure `{action:'decision',source,target,kind,decision:'linked'|'confirmed'|'dismissed'|'reset',reason?,expectedRevision:number|null}`. Conferme e modifiche con controllo revisione.
- `topics` fields: label, aliases[], description. `graphLinks` fields: source,target,kind,decision (linked/confirmed/dismissed),reason. Auto graph in collezioni interne non esportate, ricalcolabile.

## Tasks
- [x] Motore puro: nodi/alias, relazioni esplicite e semantiche, merge persistente degli scarti; unit test prima del codice.
- [x] Schema/import/export/backup compatibili, validazione dei riferimenti e test migrazione backup.
- [x] Worker e API: cache embeddings incrementale, job recuperabile, invalidazione su ogni mutazione pertinente e restore, protezione da risultati superati; test concorrenza/errori.
- [x] UI Svelte: lista, ricerca e filtro, spiegazioni, controlli manuali, route, accessi dai contenuti; Three.js navigabile e fallback.
- [x] Verifica su modello reale, unit test, check/build, browser desktop/mobile su emulatori isolati 19399/18380; nessuna alterazione dei contenuti evento nei test.

## Review focus
- IT/EN simili senza parole uguali; domande stesse parole ma intento diverso.
- Scarto e collegamento manuale resistono a ricalcoli/cancellazioni; endpoint impedisce riferimenti inesistenti.
- Modifiche concorrenti e job interrotti non pubblicano un grafo obsoleto come pronto.
- Model download/compute fallito non blocca salvataggi; niente false affinità basate solo sui tag.
- Browser senza WebGL, tastiera, telefono, deep link e backup vecchi restano utilizzabili.

## Execution
Lavoro nella workspace condivisa richiesta dall’utente, senza commit/deploy automatici; sottotask indipendenti con file distinti e integrazione finale. Nessun nuovo invio di dati a servizi esterni.


## Risultati verifica
- 117 test unitari passati; 4 test di integrazione Firestore separati su 18380 (nessuna fixture nel workspace evento).
- 4 test Playwright desktop/mobile: navigazione, revisione decisioni, modalità offline nella sessione, fallback WebGL e canvas 3D reale. Anche API autenticata e worker reale, salvataggio/reset e conflitto 409.
- Modello reale sullo snapshot: 242 nodi, 476 relazioni complessive, 212 suggerimenti automatici. Sulle 15 coppie editoriali la similarità varia da 0.397 a 0.758: il calcolo non sostituisce la lettura editoriale e può perdere collegamenti concettuali. Nessun suggerimento precompilato viene presentato come risultato del modello.
- Primo indice derivato calcolato sull'emulatore evento esistente (84 speaker): stato ready, contenuti editoriali invariati.
- Backup conserva anche decisioni storiche riferite a nodi eliminati; la mappa le esclude finché i nodi non esistono. Le nuove decisioni richiedono riferimenti esistenti.
- Grafo consultabile offline nella sessione aperta. Il download persistente per riavvio offline non è implementato dall'app attuale.
