# Accessi e intervistatori Implementation Plan

**Goal:** Gli intervistatori selezionabili coincidono con gli account abilitati negli Accessi.
**Architecture:** Una policy comune deriva accessi e directory; gli alias storici restano stabili. Il server rivalida il destinatario nella transazione di assegnazione.
**Tech Stack:** SvelteKit, TypeScript, Firebase Admin, Vitest, Playwright.
**Spec:** Richiesta utente del 25 ottobre: sei email predefinite, Michele superadmin, lista intervistatori uguale agli accessi.

## Constraints and review focus
- Conservare assegnazioni e collegamenti alla programmazione.
- Includere Danilo e Lorenzo e account abilitati senza primo login.
- Escludere account revocati, anche se il popup era già aperto.
- La configurazione esplicita sostituisce i default; stringa vuota non concede accessi.
- Non modificare i dati dell’evento durante i test.

## Steps
- [ ] Aggiungere test per default, aggiunte, revoche, superadmin e alias.
- [ ] Creare directory condivisa e usarla in policy, API accessi e API assignees.
- [ ] Consumare la directory in workspace, assegnazione, filtro e programmazione; verificare nel server.
- [ ] Verificare con unit test, controllo Svelte, build e test browser su emulatori isolati.

## Execution notes
Implementazione nella workspace corrente, senza commit automatico, per proseguire il lavoro richiesto nell’IDE. Nessuna migrazione distruttiva.
