# Preparazione intervista

## Punti chiave IT / EN

* **IT:** La critica al «vibe coding» non nega l'efficacia dei modelli generativi, ma evidenzia che il vero collo di bottiglia dell'ingegneria del software risiede nella definizione rigorosa e non ambigua delle specifiche.
**EN:** The critique of "vibe coding" does not dismiss generative models, but highlights that the true software engineering bottleneck lies in rigorously and unambiguously defining specifications.
* **IT:** La sintassi EARS (*Easy Approach to Requirements Syntax*) opera come un linter per il linguaggio naturale, eliminando precondizioni implicite e requisiti ambigui prima di qualsiasi fase esecutiva.
**EN:** EARS (*Easy Approach to Requirements Syntax*) functions as a linter for natural language, eliminating implicit preconditions and ambiguous requirements before any execution phase.
* **IT:** Con il kernel open source Walden, l'autore propone workflow deterministici a gate che separano preparazione del contesto, implementazione e code review, creando un modello di controllo per orchestrazioni ad agenti.
**EN:** Through the open-source kernel Walden, the author establishes deterministic gated workflows that decouple context preparation, implementation, and code review, providing a control framework for agentic orchestration.
* **IT:** Sul piano enterprise, il framework INLAY di Engineering traduce questi principi in pratiche industriali (*Human-in-the-Reasoning*, SPDD e *Requirements-as-Code*) per governare il ciclo di vita del software su larga scala.
**EN:** At an enterprise scale, Engineering's INLAY framework translates these principles into industrial practices (*Human-in-the-Reasoning*, SPDD, and Requirements-as-Code) to govern the software lifecycle.
* **IT:** Il collegamento editoriale con Codemotion risiede nella formazione e nel confronto tra pari: trasformare l'adozione dell'AI in Italia da sperimentazione individuale a disciplina ingegneristica condivisa e verificabile.
**EN:** The editorial connection to Codemotion centers on peer exchange and training: transforming AI adoption in Italy from isolated experimentation into a shared, verifiable engineering discipline.

---

## Domande proposte

### 1. EARS come disciplina contro l'ambiguità dei requisiti

* **Ruolo:** TALK
* **Origine:** nuova proposta
* **Domanda IT:** Nel presentare il metodo EARS utilizzi la metafora del «linter per il linguaggio naturale». Qual è il tipico difetto logico o requisito implicito che incontri più spesso quando un team definisce una funzionalità, e in che modo le regole sintattiche di EARS costringono a risolverlo prima di passare all'implementazione?
* **Question EN:** When presenting EARS, you describe it as a "linter for natural language." What is the most common logical defect or implicit assumption you encounter when a team specifies a feature, and how do EARS syntactic rules force developers to address it before implementation begins?
* **Follow-up IT:** Puoi fare un esempio concreto di un requisito scritto in modo discorsivo che, una volta tradotto nelle forme di EARS, ha evidenziato una contraddizione architetturale?
* **Follow-up EN:** Could you share a concrete example of a conversational requirement that, once mapped into EARS patterns, exposed a structural architectural contradiction?
* **Perché è utile:** Si concentra interamente sulla tecnica di specifica (il cuore del talk) senza forzare il tema dell'AI, facendo emergere problemi reali di analisi e criteri di verifica del software.
* **Riferimenti:** [R1] (Articolo sul blog di Andrea Raponi: «EARS è un linter per il linguaggio naturale [...] trova le ambiguità prima che diventino software»).
* **Da verificare:** Nessun presupposto incerto; la definizione di EARS e le sue forme sono documentate direttamente dall'autore.

### 2. Meccanica dei gate e determinismo in Walden

* **Ruolo:** TALK
* **Origine:** nuova proposta
* **Domanda IT:** Walden è descritto come un «delivery kernel» a riga di comando che guida il lavoro attraverso gate deterministici. Dal punto di vista della developer experience, qual è il compromesso tra la fluidità dello sviluppo quotidiano e la rigidità imposta da questi checkpoint di convalida?
* **Question EN:** Walden is described as a CLI "delivery kernel" that steers work through deterministic validation gates. From a developer experience standpoint, what is the trade-off between day-to-day workflow fluidity and the strictness imposed by these verification checkpoints?
* **Follow-up IT:** Come gestisce Walden le situazioni in cui una specifica deve cambiare in corsa senza invalidare l'intera catena dei task già approvati?
* **Follow-up EN:** How does Walden handle mid-flight specification changes without invalidating the entire chain of previously approved tasks?
* **Perché è utile:** Approfondisce la scelta tecnica e architetturale dello strumento open source ideato dallo speaker, valorizzando il suo approccio pragmatico da software craftsman.
* **Riferimenti:** [R1] (Repository GitHub di Walden e abstract del talk).
* **Da verificare:** Non è noto il formato esatto dei file di configurazione con cui Walden definisce i gate (se YAML, Markdown o CLI flag).

### 3. La metafora del FADEC e i confini dei sistemi critici

* **Ruolo:** TALK
* **Origine:** nuova proposta
* **Domanda IT:** Il titolo del talk evoca i sistemi critici aeronautici come il FADEC. Quando si passa da sistemi avionici a progetti software web o enterprise ordinari, quali pratiche di verifica formale vale la pena importare e quali rischierebbero invece di paralizzare il ciclo di rilascio?
* **Question EN:** Your talk's premise references critical aviation systems such as FADEC. Moving from avionics to standard web or enterprise software, which formal verification practices are worth adopting, and which ones risk paralyzing the delivery cycle?
* **Follow-up IT:** Qual è la metrica minima che utilizzi per stabilire se una verifica automatizzata è sufficiente per mandare in produzione un modulo non critico?
* **Follow-up EN:** What minimal threshold or metric do you rely on to decide whether an automated check is sufficient to ship a non-critical module to production?
* **Perché è utile:** Esplora il confine tra rigore formale e pragmatismo ingegneristico, tema centrale dell'esperienza dello speaker tra infrastruttura e codice.
* **Riferimenti:** [R1] (Articolo sul blog: parallelo tra FADEC, assenza di ambiguità e «infrastrutture di carta»).
* **Da verificare:** Non è documentata un'esperienza diretta dello speaker nell'industria aerospaziale (il FADEC è citato come caso studio e metafora architetturale).

### 4. Specializzazione e separazione dei ruoli nelle pipeline multi-agente

* **Ruolo:** AI
* **Origine:** nuova proposta
* **Domanda IT:** Nelle tue analisi sull'orchestrazione indichi uno schema basato su ruoli distinti: un agente che prepara il contesto, un executor che scrive il codice e un revisore che valida l'output. Quali criteri utilizzi per evitare che l'agente di review condivida gli stessi bias o allucinazioni dell'agente che ha generato il codice?
* **Question EN:** In your analysis of agentic workflows, you outline a clear division of labor: one agent gathers context, an executor generates code, and a reviewer validates output. What criteria do you use to prevent the reviewing agent from inheriting the same blind spots or hallucinations as the generating agent?
* **Follow-up IT:** Trattare i prompt come asset versionati (come previsto nello Structured Prompt-Driven Development) è sufficiente a garantire la riproducibilità del comportamento degli agenti nel tempo?
* **Follow-up EN:** Is versioning prompts as code assets (as in Structured Prompt-Driven Development) sufficient to ensure reproducible agent behavior over time?
* **Perché è utile:** Interroga lo speaker su un'architettura AI complessa e documentata nei suoi scritti, evitando domande generiche e stimolando una risposta sui limiti di affidabilità dell'AI.
* **Riferimenti:** [R1] (Articolo sul blog di Raponi: «un agente che prepara il contesto, un executor che implementa, un terzo che fa la code review»; whitepaper INLAY su SPDD).
* **Da verificare:** Se nei suoi test personali con Walden questa pipeline a tre agenti sia già completamente cablata nel repository open source o se sia un pattern architetturale implementato a livello prototipale.

### 5. Il paradigma «Human-in-the-Reasoning» e la gestione del debito tecnico

* **Ruolo:** AI
* **Origine:** nuova proposta
* **Domanda IT:** Nel framework enterprise INLAY si parla di «Human-in-the-Reasoning» anziché del tradizionale Human-in-the-Loop. In cosa differisce concretamente questo presidio decisionale umano quando si usano agenti per la remediation o il refactoring di sistemi legacy complessi?
* **Question EN:** The enterprise framework INLAY introduces "Human-in-the-Reasoning" rather than traditional Human-in-the-Loop. How does this human oversight differ in practice when deploying agents for remediation and refactoring in complex legacy systems?
* **Follow-up IT:** Quando l'AI accelera la produzione di codice, come si evita che il debito tecnico venga semplicemente spostato dalla scrittura alla fase di revisione e validazione?
* **Follow-up EN:** When AI accelerates code generation, how do you prevent technical debt from simply shifting from code authoring to the review and validation stage?
* **Perché è utile:** Valorizza il ruolo dello speaker come Technical Manager in Engineering su scala enterprise, affrontando il tema della qualità e della sostenibilità dell'AI nei sistemi aziendali.
* **Riferimenti:** [R1] (Documentazione INLAY: «Human-in-the-Reasoning Approach», moduli REMEDY e SHIELD).
* **Da verificare:** Il grado esatto di coinvolgimento diretto di Raponi nella scrittura del codice del framework INLAY rispetto al suo ruolo di divulgatore/presentatore accademico e manageriale.

### 6. Dal «vibe coding» alla maturità ingegneristica: il ruolo delle community tecniche

* **Ruolo:** PONTE
* **Origine:** nuova proposta
* **Domanda IT:** La facilità con cui oggi si genera codice con l'AI spinge molti sviluppatori verso un approccio esplorativo e non strutturato. Guardando all'ecosistema dei professionisti in Italia, che ruolo possono avere le community tecniche e gli eventi dal vivo come Codemotion nel trasformare questo entusiasmo in una disciplina ingegneristica basata su specifiche formali?
* **Question EN:** The ease of generating code with AI often encourages an exploratory, unstructured "vibe coding" approach. Looking at the professional engineering ecosystem in Italy, what role can tech communities and in-person conferences like Codemotion play in channeling this enthusiasm into a rigorous engineering discipline based on formal specifications?
* **Follow-up IT:** Nei contesti di confronto tecnico tra colleghi, qual è il modo più efficace per mostrare a un team che investire tempo nelle specifiche EARS riduce, anziché aumentare, il time-to-market complessivo?
* **Follow-up EN:** When engaging with peers and engineering teams, what is the most effective way to demonstrate that investing time in EARS specifications decreases, rather than increases, overall time-to-market?
* **Perché è utile:** Crea il ponte richiesto dal brief: collega il contrasto tra vibe coding e specifiche formali al valore del confronto professionale, della formazione e dell'ecosistema italiano, posizionando la conferenza come luogo di maturazione metodologica.
* **Riferimenti:** [R1] (Articolo sul blog di Raponi sul vibe coding vs spec-driven; brief editoriale sull'ecosistema italiano).
* **Da verificare:** *Proposta editoriale ipotetica:* Si assume che il confronto comunitario sia una leva per elevare gli standard dell'AI; la domanda non attribuisce allo speaker analisi di mercato pregresse ma gli chiede un punto di vista professionale sul valore della community.

### 7. Governance della delivery agentica: standard aperti vs soluzioni proprietarie

* **Ruolo:** PONTE
* **Origine:** nuova proposta
* **Domanda IT:** Da un lato progetti strumenti open source minimalisti come Walden per il singolo sviluppatore, dall'altro operi all'interno di una grande realtà aziendale che adotta framework di delivery strutturati come INLAY. Per le software house e i team italiani che vogliono adottare l'AI in produzione, da dove conviene iniziare per evitare il vendor lock-in e mantenere il controllo architetturale?
* **Question EN:** On one hand, you build lightweight open-source tools like Walden for individual developers; on the other, you operate within a major enterprise deploying comprehensive delivery frameworks like INLAY. For engineering teams looking to run AI in production, where should they start to avoid vendor lock-in while preserving architectural ownership?
* **Follow-up IT:** È pensabile definire standard condivisi tra aziende e sviluppatori indipendenti per i contratti di specifica e i gate di convalida dell'AI generativa?
* **Follow-up EN:** Is it feasible to establish shared industry standards between enterprise players and independent developers for specification contracts and generative AI validation gates?
* **Perché è utile:** Collega la biografia dello speaker (software craftsman, sostenitore dell'open source e manager enterprise) con il tema della governance dell'AI, stimolando una riflessione aperta sul futuro del mercato IT.
* **Riferimenti:** [R1] (Bio dello speaker: passione per open source e tecnologie indipendenti dai vendor; repo Walden; documentazione INLAY).
* **Da verificare:** La fattibilità di standard interaziendali sui gate AI è uno scenario ipotetico aperto, non una prassi già formalizzata.

---

## Scaletta consigliata

Una sequenza di tre domande formulata per rispettare la progressione obbligatoria: prima il talk e il metodo, poi l'architettura tecnica dell'AI, infine il ponte editoriale sul ruolo del confronto tra pari per una cultura ingegneristica dell'AI in Italia.

```
[1. TALK: Metodo EARS]  --->  [2. AI: Ruoli Multi-Agente]  --->  [3. PONTE: Formazione & Community]
 (Disciplina dei requisiti)    (Orchestrazione e Guardrail)       (Dalla moda al rigore in produzione)

```

### 1. TALK — Disciplina dei requisiti con EARS

* **Domanda IT:** Nel presentare il metodo EARS utilizzi la metafora del «linter per il linguaggio naturale». Qual è il tipico difetto logico o requisito implicito che incontri più spesso quando un team definisce una funzionalità, e in che modo le regole sintattiche di EARS costringono a risolverlo prima di passare all'implementazione?
* **Question EN:** When presenting EARS, you describe it as a "linter for natural language." What is the most common logical defect or implicit assumption you encounter when a team specifies a feature, and how do EARS syntactic rules force developers to address it before implementation begins?
* **Follow-up IT:** Puoi fare un esempio concreto di un requisito discorsivo che, una volta tradotto nelle forme di EARS, ha evidenziato una contraddizione architetturale nascosta?
* **Follow-up EN:** Could you share a concrete example of a conversational requirement that, once mapped into EARS patterns, exposed a hidden architectural contradiction?

### 2. AI — Orchestrazione multi-agente e verifica del codice

* **Domanda IT:** Nelle tue analisi sull'orchestrazione indichi uno schema basato su ruoli distinti: un agente che prepara il contesto, un executor che scrive il codice e un revisore che valida l'output. Quali criteri utilizzi per evitare che l'agente di review condivida gli stessi bias o allucinazioni dell'agente che ha generato il codice?
* **Question EN:** In your analysis of agentic workflows, you outline a clear division of labor: one agent gathers context, an executor generates code, and a reviewer validates output. What criteria do you use to prevent the reviewing agent from inheriting the same blind spots or hallucinations as the generating agent?
* **Follow-up IT:** Trattare i prompt come asset versionati (come previsto nello Structured Prompt-Driven Development) è sufficiente a garantire la riproducibilità del comportamento degli agenti nel tempo?
* **Follow-up EN:** Is versioning prompts as code assets (as in Structured Prompt-Driven Development) sufficient to ensure reproducible agent behavior over time?

### 3. PONTE — Dalla sperimentazione del «vibe coding» alla maturità ingegneristica

* **Domanda IT:** La facilità con cui oggi si genera codice con l'AI spinge molti sviluppatori verso un approccio esplorativo e non strutturato. Guardando all'ecosistema dei professionisti in Italia, che ruolo possono avere le community tecniche e gli eventi dal vivo come Codemotion nel trasformare questo entusiasmo in una disciplina ingegneristica basata su specifiche formali?
* **Question EN:** The ease of generating code with AI often encourages an exploratory, unstructured "vibe coding" approach. Looking at the professional engineering ecosystem in Italy, what role can tech communities and in-person conferences like Codemotion play in channeling this enthusiasm into a rigorous engineering discipline based on formal specifications?
* **Follow-up IT:** Nei contesti di confronto tecnico tra colleghi, qual è il modo più efficace per mostrare a un team che investire tempo nelle specifiche EARS riduce, anziché aumentare, il time-to-market complessivo?
* **Follow-up EN:** When engaging with peers and engineering teams, what is the most effective way to demonstrate that investing time in EARS specifications decreases, rather than increases, overall time-to-market?

*(Nota sulle domande esistenti: l'archivio non conteneva domande precedenti, pertanto tutte le proposte sono nuove elaborazioni originali e non presentano sovrapposizioni o duplicazioni).*