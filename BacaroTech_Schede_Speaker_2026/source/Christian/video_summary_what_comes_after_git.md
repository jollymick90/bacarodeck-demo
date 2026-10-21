# What comes after Git? by Christian Schabetsberger

## 🇮🇹 Italiano

### 1. Riassunto in una frase
Un'esplorazione della storia dei sistemi di controllo di versione, dei motivi del dominio ventennale di Git e un'analisi pratica di tre nuovi strumenti (Jujutsu, Sapling e GitButler) che puntano a rivoluzionare l'esperienza degli sviluppatori usando Git come motore sottostante.

### 2. Punti Chiave in Lista Puntata
*   **Storia del Version Control:** Prima di Git ci sono state generazioni di sistemi locali (SCCS, RCS negli anni '70/'80) e centralizzati (CVS, Subversion negli anni '90/2000), prima di arrivare ai sistemi distribuiti (BitKeeper, Git, Mercurial).
*   **Il dominio di Git:** Git ha vinto il mercato (oggi ha circa il 97% di share professionale) grazie all'adozione per il kernel Linux da parte di Linus Torvalds e al successo esplosivo di piattaforme come GitHub.
*   **I limiti di Git:** Dopo 20 anni, Git è uno standard solido ma la sua interfaccia e la complessità del suo workflow (es. gestione dei conflitti, area di staging, rebase) mostrano i segni del tempo.
*   **Jujutsu (di Google):** Un sistema che astrae il backend (utilizzando Git), rende i branch anonimi di default ed elimina l'area di staging: ogni modifica entra nell'ultimo commit aperto. Inoltre, tratta i conflitti come "oggetti" che possono essere messi da parte e risolti in seguito senza bloccare il lavoro.
*   **Sapling (di Meta):** Uno strumento compatibile con Git progettato specificamente per monorepo enormi. Offre un file system virtuale per checkout istantanei e include una potente interfaccia web per riordinare e manipolare i commit visivamente.
*   **GitButler:** Un client desktop innovativo che sfrutta i "branch virtuali". Permette di lavorare su più task (es. un refactoring e una nuova feature) nella stessa directory contemporaneamente, smistando le singole modifiche su branch diversi tramite drag-and-drop, senza mai usare i comandi di `stash` o cambiare contesto.
*   **Conclusione:** Il futuro del controllo di versione sarà probabilmente ancora basato su Git, usato però non più come interfaccia diretta ma come "storage engine" universale per strumenti che offrono workflow superiori.

### 3. Riassunto Dettagliato
Christian Schabetsberger analizza l'evoluzione dei sistemi di controllo di versione per capire cosa ci aspetta dopo gli attuali 20 anni di egemonia incontrastata di Git. Lo speech ripercorre storicamente il passaggio dalla generazione "locale" (SCCS, RCS), a quella incentrata sulla collaborazione "centralizzata" (CVS, Subversion), fino ad arrivare alla necessità di sistemi "distribuiti" inaugurata da BitKeeper.

Git, nato nel 2005 in risposta alle dispute sulle licenze di BitKeeper, ha sbaragliato la concorrenza di alternative come Mercurial principalmente per due motivi: il traino del progetto Linux e la popolarità dei servizi di hosting gratuiti come GitHub. Nonostante sia un backend eccezionale, il relatore nota che l'esperienza utente di Git (la CLI, la gestione dei merge complessi, l'area di staging) è spesso causa di frustrazione. 

Per risolvere queste inefficienze, l'industria sta sviluppando nuovi strumenti che non cercano di sostituire Git, ma di costruirci sopra:
1.  **Jujutsu (JJ):** Creato da un ingegnere di Google, stravolge il modello mentale classico. Non ha un'area di staging: il commit attuale assorbe le modifiche man mano che si lavora. Registra ogni singola azione in un "evolution log", rendendo impossibile perdere il lavoro, e permette di rimandare la risoluzione dei conflitti lavorando su altri file nel frattempo.
2.  **Sapling:** Nato in casa Meta (Facebook) per gestire codebase ciclopiche. Ottimizza in modo estremo i tempi di *status* e *checkout* grazie a un file system virtuale. La sua caratteristica più affascinante è la web UI integrata che permette di modificare la cronologia dei commit e fare rebase semplicemente trascinando i blocchi di codice.
3.  **GitButler:** Più che un client UI, è un gestore di workflow. Introduce i "branch virtuali": lo sviluppatore può editare numerosi file nello stesso ambiente di lavoro e assegnare specifiche righe o file a "corsie" (branch) diverse. Questo rende banalmente semplice separare modifiche indipendenti (come un fix rapido e una feature in lavorazione) e inviarle come Pull Request separate, eliminando i fastidi del context switching.

Lo speaker conclude suggerendo che "quello che viene dopo Git" è, molto probabilmente, più Git. Nuovi strumenti useranno i repository Git come base dati standardizzata (esattamente come applicazioni diverse girano sullo stesso protocollo IP), garantendo compatibilità universale e offrendo allo stesso tempo interfacce radicalmente più intelligenti e moderne.

---

## 🇬🇧 English

### 1. One-Sentence Summary
An exploration of version control history, the reasons behind Git's 20-year dominance, and a hands-on look at three new tools (Jujutsu, Sapling, and GitButler) aiming to revolutionize the developer experience by using Git as a backend engine.

### 2. Key Takeaways
*   **History of VCS:** Before Git, there were generations of local systems (SCCS, RCS in the 70s/80s) and centralized systems (CVS, Subversion in the 90s/00s), before reaching distributed systems (BitKeeper, Git, Mercurial).
*   **Git's Dominance:** Git conquered the market (currently holding around 97% professional share) thanks to its adoption for the Linux kernel by Linus Torvalds and the explosive success of platforms like GitHub.
*   **Git's Limitations:** After 20 years, Git is a rock-solid standard, but its UI and complex workflows (e.g., conflict resolution, staging area, rebasing) show their age.
*   **Jujutsu (from Google):** Abstracts the backend (using Git), makes branches anonymous by default, and removes the staging area: every change goes directly into the current open commit. It also treats conflicts as first-class objects that can be set aside and resolved later.
*   **Sapling (from Meta):** A Git-compatible tool specifically designed for massive monorepos. It offers a virtual file system for instant checkouts and includes a powerful web UI to visually reorder and manipulate commits.
*   **GitButler:** An innovative desktop client that leverages "virtual branches". It allows developers to work on multiple tasks (e.g., refactoring and feature development) in the same working directory simultaneously, routing specific changes to different branches via drag-and-drop without ever needing to `stash` or switch contexts.
*   **Conclusion:** The future of version control will likely still be Git-based, but Git will transition from being the direct UI to acting as a universal "storage engine" for tools that provide vastly superior workflows.

### 3. Detailed Summary
Christian Schabetsberger analyzes the evolution of Version Control Systems (VCS) to understand what comes next after 20 years of Git's undisputed hegemony. The speech retraces the historical shift from the "local" generation (SCCS, RCS), to the "centralized" collaboration-focused generation (CVS, Subversion), up to the need for "distributed" systems pioneered by BitKeeper.

Created in 2005 in response to BitKeeper's licensing disputes, Git beat alternatives like Mercurial primarily for two reasons: the momentum of the Linux project and the rising popularity of free hosting services like GitHub. Despite being an exceptional backend engine, the speaker notes that Git's user experience (the CLI, complex merge resolutions, the staging area) often causes developer friction.

To address these inefficiencies, the industry is developing new tools that don't try to replace Git, but build on top of it:
1.  **Jujutsu (JJ):** Developed by a Google engineer, it completely changes the mental model. There is no staging area: the current commit automatically absorbs changes as you work. It records every single action in an "evolution log," making it nearly impossible to lose work, and allows you to postpone conflict resolution while continuing to work on other files.
2.  **Sapling:** Created internally at Meta (Facebook) to handle gigantic codebases. It highly optimizes *status* and *checkout* times using a virtual file system. Its most fascinating feature is a built-in web UI that allows developers to edit commit history and rebase simply by dragging and dropping blocks of code.
3.  **GitButler:** More than just a UI client, it's a workflow manager. It introduces "virtual branches": a developer can edit multiple files in the same workspace and assign specific lines or files to different "lanes" (branches). This makes it trivially easy to separate independent changes (like a quick fix and a work-in-progress feature) and push them as distinct Pull Requests, eliminating the pain of context switching.

The speaker concludes by suggesting that "what comes after Git" is, most likely, more Git. New tools will use Git repositories as a standardized database (much like different applications run on the same IP protocol), guaranteeing universal compatibility while offering radically smarter and more modern interfaces.