// Windows/Arabic keyboards often produce Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) or
// Extended Arabic-Indic/Persian digits (۰۱۲۳۴۵۶۷۸۹) instead of plain ASCII
// digits. A native <input type="number"> silently rejects those characters,
// which looks like "I can't type anything in this field" to the user.
// We use <input type="text" inputMode="decimal"> instead and normalize
// whatever the user types back into plain ASCII digits.
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EXTENDED_ARABIC_INDIC.indexOf(d)))
    .replace(/[^\d.\-]/g, ''); // strip anything that still isn't a digit/decimal point/minus
}

export function toNumber(input: string): number {
  const normalized = normalizeDigits(input);
  return normalized === '' ? 0 : Number(normalized);
}
