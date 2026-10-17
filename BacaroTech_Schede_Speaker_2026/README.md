# BacaroTech — Schede base speaker Codemotion Milano 2026

Questo è un **pacchetto autonomo di soli dati di base** che puoi affiancare al progetto SvelteKit/Firebase/Vercel mentre lavori sullo scaffolding.

## Contenuto

- `01_speaker_in_elenco/`: **29 persone nel CSV prioritario BacaroTech**, in ordine alfabetico.
- `02_speaker_fuori_elenco/`: **55 altre persone presenti nella directory generale**, ma non nel CSV prioritario, in ordine alfabetico.
- **Una cartella per ciascuna delle 84 persone**, identificata dall'ID stabile `nome-cognome`.
- In ogni cartella:
  - `scheda.md`: lettura rapida di **nome, ruolo, organizzazione, biografia pubblica e titolo del talk**. Segnala le informazioni da verificare e suggerisce solo task da svolgere, non domande o argomenti.
  - `import.json`: stessa forma a collezioni del `catalog_all.json` del precedente starter, con `speakers`, `talks`, `sources`, `interviewPlans` e array vuoti `questions`, `materials`, `insights`.
- `import/`: tre JSON cumulativi (`01_...`, `02_...`, `00_...`) per importare il gruppo oppure tutti.
- `manifest.json`: indice machine-readable con percorsi e identificatori; `INDICE.md`: indice leggibile.
- `scripts/import-to-firestore.mjs`: importer **create-only** (dry-run predefinito); `scripts/validate_package.py`: controlli locali.
- `segnalazioni_da_verificare.json`: incoerenze già note tra gli input.

## Cosa contiene una scheda base

Dati che erano già presenti nei due file del progetto: nome, organizzazione quando nota, headline e bio pubblica quando presenti, immagine quando disponibile, metadati del talk (titolo, lingua e livello se presenti), **abstract originale del CSV quando presente** in `talks[].abstractMd`.

**Non contiene** ricerche aggiuntive, tag tematici, domande, insight, trascrizioni o materiali di Gemini/ChatGPT. I campi `tags`, `suggestedTags`, `questions`, `materials`, `insights` e le note partono vuoti. Il campo `topic` del talk parte `null` anche se era nel CSV: lo compilerete voi.

Non vengono importati email, recapiti personali o contatti privati. I profili assenti da una fonte mantengono i campi vuoti; nessun dato è inventato.

**`in elenco` significa nel CSV di lavoro BacaroTech**, non semplicemente nella directory generale. Carolina Pinto, Erick Wendel e Paolo Insogna sono tra i 29 prioritari, pur non essendo nello snapshot della directory.

## Come importarli in app

### Opzione A — Leggere i JSON (consigliata mentre Codex costruisce l'import)

L'app può caricare **un** `import.json` di una singola cartella, oppure uno dei tre file aggregati in `import/`. Tutti hanno il contratto `schemaVersion:1` e `workspaceId:codemotion-milano-2026`, con array di documenti Firestore.

Le chiavi dei documenti sono `record.id` e la destinazione è:

```text
workspaces/codemotion-milano-2026/speakers/{id}
workspaces/codemotion-milano-2026/talks/{id}
workspaces/codemotion-milano-2026/sources/{id}
workspaces/codemotion-milano-2026/interviewPlans/{id}
```

Regola fondamentale: **create only** se il documento non esiste; non sovrascrivere domande, materiali o note già aggiunti nell'app. Se lo speaker esiste, mostra un messaggio di *già presente*; in una futura funzione di aggiornamento, usa diff + scelta dei singoli campi.

### Opzione B — Import diretto Firestore dal tuo ambiente locale

Da questa cartella, con Node 20+ e `firebase-admin` disponibile nel progetto, credenziali **solo locali** e progetto Firebase selezionato esplicitamente:

```bash
node scripts/import-to-firestore.mjs --group=in                 # dry-run 29
node scripts/import-to-firestore.mjs --group=out                # dry-run 55
node scripts/import-to-firestore.mjs --speaker=andrey-breslav   # dry-run 1
FIREBASE_PROJECT_ID=<id-del-tuo-progetto> node scripts/import-to-firestore.mjs --group=out --apply
```

`--apply` richiede credenziali Admin SDK configurate localmente (Application Default Credentials o `GOOGLE_APPLICATION_CREDENTIALS`). **Non aggiungere service-account JSON nel repository o al frontend Vercel.** Se nella prima fase hai già caricato i 5 speaker iniziali, questo script non li sovrascrive.

Se vuoi tenere l'import dentro il repository SvelteKit, puoi copiare i file JSON in `data/` e adattare l'installer allo scaffolding Codex.

## Distinzione importante

- I dati dentro `import.json` sono la **base per creare documenti**; il Markdown è una vista leggibile iniziale.
- Dopo l'import, modifica campi, domande e note dalla webapp; **non c'è sincronizzazione automatica tra Markdown locale e Firestore**.
- Le differenze e i dubbi nelle fonti restano in `reviewFlags` e `segnalazioni_da_verificare.json` (non sono stati corretti a intuito).

## Validazione

```bash
python3 scripts/validate_package.py
```
