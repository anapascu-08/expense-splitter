// Romanian dative of a recipient's given name, for phrases like
// "{fromName} îi dă {toDative(toName)}" / "i-a plătit {toDative(toName)}".
//
// Feminine given names take an inflected form (Ana → Anei, Anca → Ancăi,
// Olga → Olgăi). Masculine names always use the analytic "lui <name>", and so
// does anything we can't confidently inflect — consonant-ending names, compound
// names, and the handful of masculine names that happen to end in "-a". "lui" is
// always correct for masculine and reads as acceptable colloquial for the rest.

const MASCULINE_A_NAMES = new Set([
  "luca",
  "toma",
  "mircea",
  "horea",
  "nicoara",
  "costea",
  "oprea",
  "badea",
]);

export function toDative(name: string): string {
  const trimmed = name.trim();

  // Only a single-token feminine name ending in "-a" gets inflected.
  const isSingleAWord = /^[a-zăâîșț]+a$/i.test(trimmed);
  if (isSingleAWord && !MASCULINE_A_NAMES.has(trimmed.toLowerCase())) {
    if (/ca$/i.test(trimmed)) return `${trimmed.slice(0, -2)}căi`;
    if (/ga$/i.test(trimmed)) return `${trimmed.slice(0, -2)}găi`;
    return `${trimmed.slice(0, -1)}ei`;
  }

  return `lui ${trimmed}`;
}
