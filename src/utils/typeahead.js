/**
 * Type-to-select matching for list widgets (like a native <select>): typing
 * "se" jumps to the first label starting with "se"; pressing the same letter
 * repeatedly ("s", "s", …) cycles through the labels starting with it.
 *
 * @param {string[]} labels    option labels in display order
 * @param {string}   buffer    characters typed so far (within the typeahead window)
 * @param {number}   fromIndex currently highlighted index (-1 for none)
 * @returns {number} index to highlight, or -1 when nothing matches
 */
export const findTypeaheadMatch = (labels, buffer, fromIndex = -1) => {
  const query = String(buffer || '').toLowerCase();
  if (!query || !labels.length) return -1;
  const norm = labels.map((l) => String(l ?? '').trim().toLowerCase());

  // Same character repeated → cycle through items starting with that character.
  const repeated = query.split('').every((c) => c === query[0]);
  if (repeated) {
    const ch = query[0];
    for (let step = 1; step <= norm.length; step++) {
      const i = (fromIndex + step + norm.length) % norm.length;
      if (norm[i].startsWith(ch)) return i;
    }
    return -1;
  }

  // Otherwise: first label (from the current item onward, wrapping) starting with the buffer.
  const start = Math.max(fromIndex, 0);
  for (let step = 0; step < norm.length; step++) {
    const i = (start + step) % norm.length;
    if (norm[i].startsWith(query)) return i;
  }
  return -1;
};
