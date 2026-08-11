// Jest can't run react-native-libsodium's native JSI bindings (they don't exist under plain
// Node), so tests run against this real-cryptography-but-different-primitives stand-in: X25519 +
// AES-256-GCM via Node's builtin `crypto`, instead of libsodium's actual X25519 + XChaCha20-
// Poly1305. Same security properties (wrong key/tampered ciphertext/wrong AAD all fail closed),
// which is what lib/crypto/*.test.ts actually needs to verify -- the native library's own
// correctness was already validated by Phase 0's successful device compile, not by this mock.
const crypto = require('crypto');

const NPUBBYTES = 24;
const KEYBYTES = 32;
const PUBLICKEYBYTES = 32;
const SECRETKEYBYTES = 32;

function toBuffer(input) {
  return typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
}

function to_base64(input) {
  return toBuffer(input).toString('base64');
}

function from_base64(input) {
  return new Uint8Array(Buffer.from(input, 'base64'));
}

function to_string(input) {
  return Buffer.from(input).toString('utf8');
}

function randombytes_buf(length) {
  return new Uint8Array(crypto.randomBytes(length));
}

function rawToPublicKeyObject(publicKeyBytes) {
  return crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: Buffer.from(publicKeyBytes).toString('base64url') },
    format: 'jwk',
  });
}

function rawToPrivateKeyObject(secretKeyBytes, publicKeyBytes) {
  return crypto.createPrivateKey({
    key: {
      kty: 'OKP',
      crv: 'X25519',
      d: Buffer.from(secretKeyBytes).toString('base64url'),
      x: Buffer.from(publicKeyBytes).toString('base64url'),
    },
    format: 'jwk',
  });
}

function crypto_box_keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  return {
    publicKey: new Uint8Array(Buffer.from(pubJwk.x, 'base64url')),
    privateKey: new Uint8Array(Buffer.from(privJwk.d, 'base64url')),
    keyType: 'x25519',
  };
}

function crypto_box_seal(message, recipientPublicKeyBytes) {
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const recipientPub = rawToPublicKeyObject(recipientPublicKeyBytes);
  const shared = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipientPub });
  const key = crypto.createHash('sha256').update(shared).digest();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ct = cipher.update(toBuffer(message));
  cipher.final();
  const tag = cipher.getAuthTag();
  const ephemeralPubRaw = Buffer.from(ephemeral.publicKey.export({ format: 'jwk' }).x, 'base64url');
  return new Uint8Array(Buffer.concat([ephemeralPubRaw, nonce, ct, tag]));
}

function crypto_box_seal_open(ciphertext, recipientPublicKeyBytes, recipientSecretKeyBytes) {
  const buf = toBuffer(ciphertext);
  const ephemeralPubRaw = buf.subarray(0, 32);
  const nonce = buf.subarray(32, 44);
  const rest = buf.subarray(44);
  const tag = rest.subarray(rest.length - 16);
  const ct = rest.subarray(0, rest.length - 16);
  const ephemeralPub = rawToPublicKeyObject(ephemeralPubRaw);
  const recipientPriv = rawToPrivateKeyObject(recipientSecretKeyBytes, recipientPublicKeyBytes);
  const shared = crypto.diffieHellman({ privateKey: recipientPriv, publicKey: ephemeralPub });
  const key = crypto.createHash('sha256').update(shared).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
}

function crypto_aead_xchacha20poly1305_ietf_encrypt(message, additional_data, _secret_nonce, public_nonce, key) {
  const iv = toBuffer(public_nonce).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', toBuffer(key), iv);
  if (additional_data) cipher.setAAD(toBuffer(additional_data));
  const ct = cipher.update(toBuffer(message));
  cipher.final();
  const tag = cipher.getAuthTag();
  return new Uint8Array(Buffer.concat([ct, tag]));
}

function crypto_aead_xchacha20poly1305_ietf_decrypt(_secret_nonce, ciphertext, additional_data, public_nonce, key) {
  const iv = toBuffer(public_nonce).subarray(0, 12);
  const buf = toBuffer(ciphertext);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', toBuffer(key), iv);
  if (additional_data) decipher.setAAD(toBuffer(additional_data));
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
}

module.exports = {
  to_base64,
  from_base64,
  to_string,
  randombytes_buf,
  crypto_box_keypair,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: NPUBBYTES,
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES: KEYBYTES,
  crypto_box_PUBLICKEYBYTES: PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES: SECRETKEYBYTES,
};
