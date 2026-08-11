import * as Keychain from 'react-native-keychain';
import { crypto_box_keypair, from_base64, to_base64 } from 'react-native-libsodium';

export interface IdentityKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

// A fixed service name, not per-user -- react-native-keychain's Keychain/Keystore storage is
// already scoped to this app (and, on iOS, will be scoped to the shared access group once Phase 5
// adds one for the Notification Service Extension), so there is exactly one identity key per
// installed app, matching the product's one-device-per-user model.
const IDENTITY_KEY_SERVICE = 'nestchat.identityKey';

function encode(keyPair: IdentityKeyPair): string {
  return JSON.stringify({
    publicKey: to_base64(keyPair.publicKey),
    secretKey: to_base64(keyPair.secretKey),
  });
}

function decode(raw: string): IdentityKeyPair {
  const parsed = JSON.parse(raw) as { publicKey: string; secretKey: string };
  return {
    publicKey: from_base64(parsed.publicKey),
    secretKey: from_base64(parsed.secretKey),
  };
}

export function generateIdentityKeyPair(): IdentityKeyPair {
  const pair = crypto_box_keypair();
  return { publicKey: pair.publicKey, secretKey: pair.privateKey };
}

export async function storeIdentityKeyPair(keyPair: IdentityKeyPair): Promise<void> {
  await Keychain.setGenericPassword('identity', encode(keyPair), { service: IDENTITY_KEY_SERVICE });
}

export async function getIdentityKeyPair(): Promise<IdentityKeyPair | null> {
  const result = await Keychain.getGenericPassword({ service: IDENTITY_KEY_SERVICE });
  if (!result) return null;
  return decode(result.password);
}

// Idempotent: returns the existing keypair if one is already stored, otherwise generates and
// persists a new one. This is the only function most call sites need -- onboarding and recovery
// both just call this and don't care which branch ran.
export async function ensureIdentityKeyPair(): Promise<IdentityKeyPair> {
  const existing = await getIdentityKeyPair();
  if (existing) return existing;
  const generated = generateIdentityKeyPair();
  await storeIdentityKeyPair(generated);
  return generated;
}

export async function wipeIdentityKeyPair(): Promise<void> {
  await Keychain.resetGenericPassword({ service: IDENTITY_KEY_SERVICE });
}
