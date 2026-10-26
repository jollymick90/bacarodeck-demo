export interface SpeakerAudio {
  src: string;
  title: string;
  duration: string;
}

export const speakerAudio: Readonly<Partial<Record<string, SpeakerAudio>>> = {
  'abiodun-olowode': {
    src: '/audio/abiodun-olowode.m4a',
    title: 'Perché l’AI non velocizza lo sviluppo software',
    duration: '14:40'
  },
  'andrey-breslav': {
    src: '/audio/andrey-breslav.m4a',
    title: 'Dal codice alle specifiche con Andrey Breslav',
    duration: '13:48'
  },
  'alexio-cassani': {
    src: '/audio/alexio-cassani.m4a',
    title: 'Harness engineering per gli agenti AI',
    duration: '11:39'
  },
  'alfonso-fuggetta': {
    src: '/audio/alfonso-fuggetta.m4a',
    title: 'Il paradosso del codice generato dall’AI',
    duration: '21:08'
  },
  'alfonso-graziano': {
    src: '/audio/alfonso-graziano.m4a',
    title: 'Il paradosso dell’IA nello sviluppo software',
    duration: '15:01'
  }
};
