import { from_base64, to_base64 } from 'react-native-libsodium';
import { CURRENT_ENVELOPE_VERSION } from './config';

// The plaintext JSON that gets AEAD-encrypted as a message's content. `t: 'text'` is all Phase 2
// needs; 'media'/'contact'/'location' are added as later phases reach them, but the shape is
// fixed now so the wire format doesn't change again.
export interface MessageEnvelopePlaintext {
  t: 'text' | 'contact' | 'media' | 'location';
  text?: string;
}

// messages.ciphertext stores base64(nonce || ct) as one blob -- one column instead of two, same
// idea as most AEAD wire formats (the nonce isn't secret, just needs to travel with the ciphertext).
export function packCiphertext(nonce: Uint8Array, ciphertext: Uint8Array): string {
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  return to_base64(combined);
}

export function unpackCiphertext(packed: string, nonceLength: number): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const combined = from_base64(packed);
  return {
    nonce: combined.slice(0, nonceLength),
    ciphertext: combined.slice(nonceLength),
  };
}

// A row is "encrypted" iff it has all three of enc_v/key_id/ciphertext -- there's no backfill, so
// legacy plaintext rows simply have enc_v = null and keep rendering via their `body` column as
// they always have. See HANDOVER.md's E2EE section for why there's no migration of old rows.
export function isEncryptedRow(row: { enc_v: number | null; key_id: string | null; ciphertext: string | null }): boolean {
  return row.enc_v === CURRENT_ENVELOPE_VERSION && !!row.key_id && !!row.ciphertext;
}
