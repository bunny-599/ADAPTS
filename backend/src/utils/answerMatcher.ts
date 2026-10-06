/**
 * Robust MCQ and answer matching utility.
 * Handles exact matches, letter indicators ('A', 'B', 'C', 'D'),
 * prefixed options ('A) ...', 'Option A:', '1. ...'), whitespace, quotes, and punctuation.
 */
export function matchMCQAnswer(
  studentAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
  options?: string[]
): boolean {
  if (!studentAnswer || !correctAnswer) return false;

  const clean = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/^[`"']+|[`"']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const rawStudent = clean(studentAnswer);
  const rawCorrect = clean(correctAnswer);

  if (rawStudent === rawCorrect) return true;

  // Helper to strip leading labels like "A)", "A.", "(A)", "Option A:", "Option A", "Choice A"
  const stripPrefix = (str: string): string => {
    return str
      .replace(/^(option\s+|choice\s+)/i, '')
      .replace(/^[\(\[]?([a-d]|[1-4])[\)\]\.\:\-]?\s*/i, '')
      .trim();
  };

  const studentStripped = stripPrefix(rawStudent);
  const correctStripped = stripPrefix(rawCorrect);

  if (studentStripped.length > 0 && correctStripped.length > 0) {
    if (studentStripped === correctStripped) return true;
  }

  // Extract single letter if string is just a letter or "Option A"
  const extractLetter = (str: string): string | null => {
    const match = str.match(/^(?:option\s+|choice\s+)?[\(\[]?([a-d])[\)\]\.\:\-]?$/i);
    return match ? match[1].toLowerCase() : null;
  };

  const studentLetter = extractLetter(rawStudent);
  const correctLetter = extractLetter(rawCorrect);

  if (studentLetter && correctLetter && studentLetter === correctLetter) {
    return true;
  }

  if (options && Array.isArray(options) && options.length > 0) {
    const cleanedOptions = options.map((opt) => clean(opt));
    const strippedOptions = cleanedOptions.map((opt) => stripPrefix(opt));

    // If student provided letter (e.g. "a" -> 0, "b" -> 1, "c" -> 2, "d" -> 3)
    if (studentLetter) {
      const idx = studentLetter.charCodeAt(0) - 97;
      if (idx >= 0 && idx < options.length) {
        const optionAtIdx = cleanedOptions[idx];
        const optionStrippedAtIdx = strippedOptions[idx];
        if (
          optionAtIdx === rawCorrect ||
          optionStrippedAtIdx === correctStripped ||
          rawCorrect === studentLetter
        ) {
          return true;
        }
      }
    }

    // If correct answer is a letter (e.g. "A") and student submitted option text
    if (correctLetter) {
      const idx = correctLetter.charCodeAt(0) - 97;
      if (idx >= 0 && idx < options.length) {
        if (
          rawStudent === cleanedOptions[idx] ||
          studentStripped === strippedOptions[idx]
        ) {
          return true;
        }
      }
    }

    // Check if rawStudent matches the option that matches rawCorrect
    const correctOptIndex = cleanedOptions.findIndex(
      (opt, i) => opt === rawCorrect || strippedOptions[i] === correctStripped
    );
    if (correctOptIndex !== -1) {
      if (
        rawStudent === cleanedOptions[correctOptIndex] ||
        studentStripped === strippedOptions[correctOptIndex]
      ) {
        return true;
      }
    }
  }

  return false;
}
