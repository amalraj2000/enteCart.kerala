import { randomInt } from "node:crypto";

/**
 * Public, non-guessable product address: /product/k7m2x9qa4t instead of /product/2.
 * 10 random characters from an alphabet without look-alikes (no 0/o, 1/l/i) — about 8×10^14 combinations.
 * It is only a name for the link; the numeric id stays the primary key and the only thing orders/stock/payments use.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const newPublicId = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const isPublicId = (s: string) => /^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/.test(s);
