/**
 * Contact-field rules shared by every public form, matching what the API
 * accepts (normalizePhone in the enquiry and booking routes): a Mongolian
 * number is 8 digits, with or without +976; a foreign one 10–15 digits.
 *
 * No imports on purpose: the tests load this file straight under Node.
 */

/** Groups digits as they are typed: "99112233" → "9911 2233", "+97699112233" → "+976 9911 2233". */
export function formatPhoneInput(value: string): string {
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (hasPlus && digits.startsWith("976")) {
    const local = digits.slice(3);
    return `+976${local ? ` ${local.slice(0, 4)}${local.length > 4 ? ` ${local.slice(4, 8)}` : ""}` : ""}${local.length > 8 ? local.slice(8) : ""}`;
  }
  if (hasPlus) return `+${digits}`;
  if (digits.length <= 8) return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
  return digits;
}

export function phoneError(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Утасны дугаараа оруулна уу";
  const local = digits.startsWith("976") && digits.length > 8 ? digits.slice(3) : digits;
  if (local.length === 8) return null;
  if (value.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) return null;
  return "Утасны дугаар 8 оронтой байна (жишээ нь 9911 2233)";
}

export function nameError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Нэрээ оруулна уу";
  if (trimmed.length < 2) return "Нэрээ бүтнээр нь оруулна уу";
  return null;
}

/** Optional: empty is fine, a typo is not. */
export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? null : "И-мэйл хаяг буруу байна";
}
