# Modalità intervista

Richiesta: una domanda della scaletta alla volta a schermo intero, verticale o
orizzontale, solo Prossima domanda ed Esci.

- Route SvelteKit `/speaker/[speakerId]/intervista`.
- Avvio dalla scheda conduttore, scaletta o tab Intervista di Gestione.
- Richiesta Fullscreen API dentro il gesto dell'utente; fallback a tutto viewport.
- Header, footer e notifiche del workspace nascosti durante la lettura.
- Copia della scaletta e dei testi nella lingua scelta all'avvio: polling o modifiche
  degli altri non sostituiscono una domanda mentre il conduttore la sta leggendo.
- Pulsante Prossima disabilitato all'ultima domanda, senza ripartenza automatica.
- Esci/Escape riportano alla schermata d'origine e rilasciano il fullscreen;
  distruzione del componente gestisce anche il tasto Indietro del browser.
- Test desktop/mobile: fullscreen effettivo e fallback, rotazione, avanzamento,
  ultima domanda, uscita e accesso diretto alla route.
