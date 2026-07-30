/**
 * Human-quotable enquiry reference, e.g. "UUD-7K2Q9".
 *
 * Staff read these back over the phone, so the alphabet leaves out the
 * characters people mishear or mistype: no O/0, no I/1.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference() {
  let random = "";
  for (let i = 0; i < 5; i += 1) {
    random += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return `UUD-${random}`;
}
