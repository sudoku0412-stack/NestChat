import { ensureIdentityKeyPair, wipeIdentityKeyPair, type IdentityKeyPair } from './keys';
import { publishPublicKeyIfNeeded } from './registry';

export { SEND_ENCRYPTED } from './config';
export { isEncryptedRow } from './envelope';
export { ensureIdentityKeyPair, getIdentityKeyPair, wipeIdentityKeyPair } from './keys';
export type { IdentityKeyPair } from './keys';
export { getOrCreateChatKey, rewrapChatKeyForMembers, rotateChatKeyOnRemoval } from './chatKeys';
export { encryptMessageText, decryptMessageText } from './message';
export { decryptTextField } from './decryptRow';

// Call once per app session after the user is known (onboarding completion, sign-in, recovery)
// -- generates a device identity keypair if one doesn't exist yet and publishes the public half.
// Idempotent and safe to call redundantly (e.g. on every app foreground).
export async function initializeCrypto(userId: string): Promise<IdentityKeyPair> {
  const identity = await ensureIdentityKeyPair();
  await publishPublicKeyIfNeeded(userId, identity);
  return identity;
}

// Called on sign-out -- removes the local identity key entirely. Per this project's chosen
// tradeoff (strict E2EE, no server-side key escrow), this is irreversible: signing back in on
// this device generates a *new* identity key with no relation to the old one, so any chat keys
// wrapped for the old key become permanently unreadable on this device (recoverable only if a
// co-member's device rewraps history for the new key -- "social recovery", see the E2EE plan).
export async function clearCryptoState(): Promise<void> {
  await wipeIdentityKeyPair();
}
