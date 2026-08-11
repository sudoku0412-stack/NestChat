import { randombytes_buf } from 'react-native-libsodium';
import { isEncryptedRow, packCiphertext, unpackCiphertext } from './envelope';
import { CURRENT_ENVELOPE_VERSION } from './config';

describe('packCiphertext / unpackCiphertext', () => {
  it('round-trips nonce and ciphertext through a single base64 blob', () => {
    const nonce = randombytes_buf(24);
    const ciphertext = randombytes_buf(48);

    const packed = packCiphertext(nonce, ciphertext);
    const unpacked = unpackCiphertext(packed, 24);

    expect(Array.from(unpacked.nonce)).toEqual(Array.from(nonce));
    expect(Array.from(unpacked.ciphertext)).toEqual(Array.from(ciphertext));
  });
});

describe('isEncryptedRow', () => {
  it('is true only when enc_v matches the current version and key_id/ciphertext are present', () => {
    expect(
      isEncryptedRow({ enc_v: CURRENT_ENVELOPE_VERSION, key_id: 'k1', ciphertext: 'c1' })
    ).toBe(true);
  });

  it('is false for legacy plaintext rows (enc_v null)', () => {
    expect(isEncryptedRow({ enc_v: null, key_id: null, ciphertext: null })).toBe(false);
  });

  it('is false when key_id or ciphertext is missing despite enc_v being set', () => {
    expect(isEncryptedRow({ enc_v: CURRENT_ENVELOPE_VERSION, key_id: null, ciphertext: 'c1' })).toBe(false);
    expect(isEncryptedRow({ enc_v: CURRENT_ENVELOPE_VERSION, key_id: 'k1', ciphertext: null })).toBe(false);
  });
});
