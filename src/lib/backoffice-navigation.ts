export const backofficeActions = [
  {
    label: 'Aggiungi speaker',
    href: '/backoffice/nuovo/speakers',
    description:
      'Crea una nuova scheda speaker inserendo nome, profilo e informazioni utili. Usalo per aggiungere una persona che non è ancora presente nel workspace.'
  },
  {
    label: 'Programmazione',
    href: '/backoffice/programmazione',
    description:
      'Consulta il calendario delle interviste e organizza gli appuntamenti: giorno, orario e stato di conferma. Le modifiche sono condivise con il team.'
  },
  {
    label: 'Importa JSON',
    href: '/backoffice/importa',
    description:
      'Carica un file JSON o incolla contenuti strutturati, per esempio ricerche e domande preparate con un assistente AI o un export editoriale. Puoi controllare e selezionare le modifiche prima di confermare il salvataggio.'
  },
  {
    label: 'Importa tutti gli 84 speaker',
    href: '/backoffice/importa/catalogo',
    description:
      'Prepara l’importazione del catalogo di Codemotion con gli 84 speaker e i contenuti collegati. Propone solo i record mancanti: le schede già presenti non vengono sostituite. Controlla l’anteprima prima di confermare.'
  },
  {
    label: 'Importa orari Codemotion',
    href: '/backoffice/importa/orari',
    description:
      'Abbina giorno, inizio, fine e sala ai talk già presenti. Usa gli orari inclusi nell’app oppure un nuovo JSON delle sessioni. Controlla le differenze e scegli gli aggiornamenti: note, domande e appuntamenti delle interviste restano invariati.'
  },
  {
    label: 'Importa traduzioni IT/EN',
    href: '/backoffice/importa/traduzioni',
    description:
      'Recupera le traduzioni già predisposte per biografie e abstract del catalogo. Propone quelle mancanti ed esclude le schede già verificate o con originale modificato. Controlla i testi nell’anteprima prima di importarli.'
  },
  {
    label: 'Aggiorna tag',
    href: '/backoffice/tag',
    description:
      'Propone argomenti per gli speaker a partire dalle parole chiave nei titoli e negli abstract dei talk. Scegli quali aggiungere: i tag esistenti vengono conservati.'
  },
  {
    label: 'Prepara import dei 5 speaker',
    href: '/backoffice/importa/esempio',
    description:
      'Carica il pacchetto iniziale di cinque speaker con materiali e domande di esempio. È un punto di partenza per un workspace vuoto; puoi controllare l’anteprima prima di importare.'
  },
  {
    label: 'Esporta il mio lavoro',
    href: '/backoffice/esporta',
    description:
      'Seleziona e scarica i contenuti editoriali e le modifiche salvate nel workspace condiviso, con la possibilità di includere i tuoi voti. Serve a trasferire il lavoro tramite Importa JSON. Non comprende le bozze non salvate e non è una copia completa del workspace.'
  },
  {
    label: 'Export / import completo',
    href: '/backoffice/backup',
    description:
      'Scarica una copia completa dei dati del workspace, inclusi interessi e scalette condivise. Usala per conservare o trasferire il lavoro. Il ripristino può sostituire dati esistenti, richiede un amministratore e mostra un’anteprima da confermare.'
  },
  {
    label: 'Gestisci accessi',
    href: '/backoffice/accessi',
    description:
      'Abilita o revoca l’accesso al workspace per gli account Google dei collaboratori. È una funzione riservata agli amministratori; non assegna gli speaker ai conduttori.'
  }
];
