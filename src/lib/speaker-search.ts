import type { Entity } from './fields';
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
export function searchSpeakers(speakers: Entity[], query: string): Entity[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return speakers.filter((speaker) => {
    const text = normalize(
      [
        speaker.fullName,
        speaker.organization,
        ...(Array.isArray(speaker.tags) ? speaker.tags : [])
      ].join(' ')
    );
    return words.every((word) => text.includes(word));
  });
}
