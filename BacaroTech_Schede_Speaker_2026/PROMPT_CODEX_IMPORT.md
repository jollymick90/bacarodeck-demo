# Prompt per Codex — Import schede speaker base

Integra nel progetto BacaroTech Interview Hub già in costruzione il pacchetto `BacaroTech_Schede_Speaker_2026/` senza modificare lo scaffolding esistente.

Le cartelle `01_speaker_in_elenco/` (29 persone) e `02_speaker_fuori_elenco/` (55) contengono ciascuna `scheda.md` e `import.json`. I file cumulativi sono in `import/`. Usa `manifest.json` per indicizzazione.

**Obiettivo:** importare uno o più speaker nei path Firestore già definiti `workspaces/codemotion-milano-2026/{speakers,talks,sources,interviewPlans}` con `record.id` stabile. L'import deve essere **create-only di default**: gli speaker dei 5 seed esistenti e i contenuti che modificheremo a mano non devono essere sovrascritti. Validare `schemaVersion`, `workspaceId`, tipi, ID, duplicati, dimensione e campi vietati (email, phone, contactAddress). Prima di scrivere mostra un riepilogo `nuovi / già presenti / errori`; un aggiornamento ai documenti esistenti richiede una funzionalità separata con diff e conferma campo per campo.

Non generare tag tematici, research insights, domande o riassunti AI. Mantieni editabili dopo import nome, headline, bio, azienda, talk, fonti e note. Non introdurre credenziali Admin SDK nel browser o nel bundle Vercel. Il file `scripts/import-to-firestore.mjs` è disponibile per import server-side/admin create-only; l'eventuale import da UI richiede autenticazione e membership Firebase secondo le security rules del progetto.

Prima di implementare, esamina le collezioni già presenti e riutilizza gli stessi modelli Firestore. Concludi con un report Markdown nel repository indicando quali test sono passati e quali no.
