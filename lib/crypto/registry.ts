import { to_base64 } from 'react-native-libsodium';
import { supabase } from '../supabase';
import type { IdentityKeyPair } from './keys';

// Publishes the local identity public key to users.public_key if it isn't already there --
// idempotent, safe to call on every launch. Other members read this column (via chat_members
// joins they already do today) to wrap chat keys for this user.
export async function publishPublicKeyIfNeeded(userId: string, keyPair: IdentityKeyPair): Promise<void> {
  const publicKeyBase64 = to_base64(keyPair.publicKey);

  const { data } = await supabase.from('users').select('public_key').eq('id', userId).single();
  if (data?.public_key === publicKeyBase64) return;

  await supabase
    .from('users')
    .update({ public_key: publicKeyBase64, key_updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function getPublicKey(userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('public_key').eq('id', userId).single();
  return data?.public_key ?? null;
}
