# BacaroDeck: catalogo, team e organizzazione interviste

## Richiesta e vincoli

Ampliare l'app esistente con tutti gli 84 speaker del catalogo locale, preservando dati e revisioni già lavorate; distinguere in elenco/fuori elenco. Team: Giorgio (interviste IT), Alberto, Martin, Michele (interviste), Lorenzo e Danilo (camera). Non presumere altre lingue per i membri.

Primo superadmin: account Google attuale dell'utente, solo in configurazione privata SUPERADMIN_EMAILS, mai nei file pubblici. Accessi aggiunti/revocati dall'app. Il server verifica token Google ed email verificata a ogni richiesta, conserva ALLOW_LIST come configurazione iniziale, usa un registro privato aggiunte/blocchi; i blocchi prevalgono su ALLOW_LIST. I superadmin permanenti si gestiscono dall'ambiente. Nessuna sincronizzazione durante la build, npm run build resta il comando Vercel. Firestore SDK client resta chiuso.

## Funzioni

- Import catalogo con anteprima e creazione dei soli documenti mancanti; migrazione degli ID già presenti senza duplicazioni. Nessun import automatico sul database remoto.
- Team editoriale separato dagli account: si può assegnare Giorgio senza conoscerne l'email; assegnazioni distinte intervistatore/camera.
- Agenda: conservare i 14 slot originali da 30 minuti forniti dall'utente e relative coppie principale/backup. Il backup è un'alternativa, non un secondo appuntamento. Date 28 e 29 ottobre 2026, Europe/Rome. Fonte ufficiale e data dell'ultimo aggiornamento sempre visibili.
- Ogni slot conserva proposta originale, talk collegato, suggerimento fine talk +30 minuti, orario scelto, stato proposta/provvisoria/confermata. Nessuna conferma automatica. Un aggiornamento agenda non cambia appuntamenti scelti o confermati. Più talk richiedono selezione esplicita. Nomi non trovati restano da verificare.
- Mostrare conflitti per speaker, intervistatore e camera, e orari suggeriti fuori dalle finestre originarie 11–13 e 15–17 (mercoledì), 11–13 e 15–16 (giovedì). Fuori finestra è una segnalazione, non autorizzazione a prolungare la giornata. Non assegnare risorse arbitrariamente.
- Descrizione speaker e abstract talk in IT/EN: preservare originale, provenienza e stato traduzione da verificare. Non inventare biografie o traduzioni senza testo sorgente.
- Domande: obiettivo iniziale 10–15 per speaker quando il materiale lo consente, IT/EN, motivazione e riferimenti. Se mancano fonti, evidenziare la lacuna e usare solo domande esplorative senza false premesse. Voto personale intero 1–5 con media e conteggio; un voto per account, modificabile, mai tramite UID scelto dal client. Scarto e cancellazione con conferma; import successivi non ripristinano domande eliminate (tombstone).
- PWA installabile: manifest, icone e service worker per shell/offline fallback. Nessuna cache di token, API, pagine autenticate o dati privati; salvataggi online, messaggio offline chiaro. Questa prima versione non offre editing offline.

## Scelte implementative proposte

Mantenere SvelteKit/Svelte 5, API server Firebase Admin e transazioni revisionate. Componenti separati per agenda, accessi e rating. Nessun provider AI o costo API nuovo: il pacchetto editoriale iniziale viene preparato come dati revisionabili; l'import esistente consente ampliamenti futuri. Nessuna traduzione automatica durante il deploy.

## Evidenza agenda

Vedere `2026-10-17-agenda-comparison.md` e snapshot JSON. Il confronto mostra numerosi cambi di giorno rispetto alla proposta. Cassani: talk principale giovedì, non mercoledì; Collina: mercoledì, non giovedì. Breslav finisce alle 18:20: +30 implica 18:50, fuori dalle finestre fornite. Non forzare questa proposta come appuntamento. Carolina Pinto, Erick Wendel e Paolo Insogna non hanno un match esatto nello snapshot: richiedono verifica, non deduzioni di assenza dall'evento.

## Accettazione

Test autorizzazioni/revoca/autopromozione, import ripetuto senza sovrascrittura, voti concorrenti e non impersonabili, domande cancellate non ripristinate, conversione orari/autunno, multi-talk, backup, conflitti e preservazione slot confermati. Browser desktop/mobile: catalogo, assegnazioni, agenda, CRUD bilingue, rating, pannello admin e installabilità/offline. Nessuna email personale nei file pubblici; nessun deploy o modifica Firebase remota automatica.

## Requisito aggiunto e approvato: mobile first

Catalogo speaker verticale, nessun carosello orizzontale. Ricerca per nome, organizzazione e tag, tollerante agli accenti; conteggio risultati, filtri compatti richiudibili, reset e stato vuoto. Su telefono elenco e dettaglio sono due viste, con ritorno alla ricerca che conserva filtri e posizione. Verifica con 84 speaker e viewport 390px; tocchi di almeno 44px, navigazione da tastiera e focus gestito.
