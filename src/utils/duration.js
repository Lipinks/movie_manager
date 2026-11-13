/**
 * Format a video duration as it is typed, so the ':' appears by itself.
 *
 *   "12"      -> "12:"      the colon follows two minute digits
 *   "1234"    -> "12:34"    (also what pasting "1234" gives)
 *   "5:30"    -> "5:30"     one-digit minutes: type the ':' yourself
 *   "1:02:33" -> "1:02:33"  hours work the same way
 *
 * Seconds stop at two digits, and '.', ',' and spaces count as ':' so phone
 * number pads (which have no colon key) still work.
 *
 * @param {string} raw  the field's new value
 * @param {{autoColon?: boolean}} [options]  pass autoColon: false while the
 *        user is deleting, so backspacing over the colon doesn't put it back
 * @returns {string}
 */
export const formatDurationInput = (raw, { autoColon = true } = {}) => {
  let out = '';
  let colons = 0;
  let digitsInSegment = 0;

  for (const char of String(raw ?? '')) {
    if (/[:.,\s]/.test(char)) {
      // A separator only after a digit, never doubled, at most two (h:mm:ss).
      if (digitsInSegment > 0 && colons < 2) {
        out += ':';
        colons += 1;
        digitsInSegment = 0;
      }
      continue;
    }
    if (!/\d/.test(char)) continue;

    if (digitsInSegment === 2) {
      if (colons > 0) continue; // seconds (or minutes after hours) are full
      // Two minute digits already, colon deleted: start the seconds again.
      out += ':';
      colons += 1;
      digitsInSegment = 0;
    }

    out += char;
    digitsInSegment += 1;

    if (autoColon && colons === 0 && digitsInSegment === 2) {
      out += ':';
      colons += 1;
      digitsInSegment = 0;
    }
  }

  return out;
};
