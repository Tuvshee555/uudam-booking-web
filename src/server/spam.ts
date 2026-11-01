/**
 * The public forms carry a hidden "website" field (see components/site/
 * Honeypot.tsx). People never see it; form-filling bots fill every field.
 * Paired with the per-IP rate limits on the same routes.
 */
export const HONEYPOT_FIELD = "website";

export function isBotSubmission(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}
