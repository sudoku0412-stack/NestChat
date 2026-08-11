import { crypto_box_seal, crypto_box_seal_open, from_base64, randombytes_buf, to_base64 } from 'react-native-libsodium';
import { supabase } from '../supabase';
import type { IdentityKeyPair } from './keys';

const CHAT_KEY_BYTES = 32;

export interface ChatKeyHandle {
  keyId: string;
  key: Uint8Array;
}

// Unwrapping is a full crypto_box_seal_open per call -- cheap, but messages.load() decrypts many
// rows per poll, almost always under the same one or two keys. Keyed by key_id, not chat_id,
// since old messages reference retired keys that stay valid for decryption forever.
const unwrappedKeyCache = new Map<string, Uint8Array>();

function wrapKey(key: Uint8Array, recipientPublicKeyBase64: string): string {
  return to_base64(crypto_box_seal(key, from_base64(recipientPublicKeyBase64)));
}

function unwrapKey(wrappedBase64: string, identity: IdentityKeyPair): Uint8Array {
  return crypto_box_seal_open(from_base64(wrappedBase64), identity.publicKey, identity.secretKey);
}

// Returns the active (non-retired) chat key this user already has a wrap for, or creates one --
// generating a fresh 32-byte key, inserting the chat_keys row, and wrapping it for every current
// member who has published a public key (members without one yet are simply skipped; they'll get
// a wrap once someone runs rewrapChatKeyForMembers, e.g. after they finish onboarding).
export async function getOrCreateChatKey(
  chatId: string,
  userId: string,
  identity: IdentityKeyPair
): Promise<ChatKeyHandle> {
  const { data: existing } = await supabase
    .from('chat_keys')
    .select('id, chat_key_members!inner(wrapped_key, user_id)')
    .eq('chat_id', chatId)
    .is('retired_at', null)
    .eq('chat_key_members.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const cached = unwrappedKeyCache.get(existing.id);
    if (cached) return { keyId: existing.id, key: cached };
    const wrapped = (existing.chat_key_members as unknown as { wrapped_key: string }[])[0]?.wrapped_key;
    if (wrapped) {
      const key = unwrapKey(wrapped, identity);
      unwrappedKeyCache.set(existing.id, key);
      return { keyId: existing.id, key };
    }
  }

  const key = randombytes_buf(CHAT_KEY_BYTES);
  const { data: keyRow, error } = await supabase
    .from('chat_keys')
    .insert({ chat_id: chatId })
    .select('id')
    .single();
  if (error || !keyRow) throw error ?? new Error('Failed to create chat key');

  const { data: members } = await supabase
    .from('chat_members')
    .select('user_id, users(public_key)')
    .eq('chat_id', chatId);

  const wraps = (members ?? [])
    .map((m) => ({
      user_id: m.user_id,
      public_key: (m.users as unknown as { public_key: string | null } | null)?.public_key ?? null,
    }))
    .filter((m): m is { user_id: string; public_key: string } => !!m.public_key)
    .map((m) => ({
      key_id: keyRow.id,
      user_id: m.user_id,
      wrapped_key: wrapKey(key, m.public_key),
    }));

  if (wraps.length > 0) {
    await supabase.from('chat_key_members').insert(wraps);
  }

  unwrappedKeyCache.set(keyRow.id, key);
  return { keyId: keyRow.id, key };
}

// Fetches and unwraps a *specific* key_id, active or retired -- used when decrypting a message
// that references an older, possibly-retired key (getOrCreateChatKey only ever looks at the
// current active key, which is wrong for history).
export async function getChatKeyById(
  keyId: string,
  userId: string,
  identity: IdentityKeyPair
): Promise<Uint8Array | null> {
  const cached = unwrappedKeyCache.get(keyId);
  if (cached) return cached;

  const { data } = await supabase
    .from('chat_key_members')
    .select('wrapped_key')
    .eq('key_id', keyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;

  const key = unwrapKey(data.wrapped_key, identity);
  unwrappedKeyCache.set(keyId, key);
  return key;
}

// Wraps the chat's current active key for every member in memberIds who doesn't already have a
// wrap for it -- called after adding a member, and (separately, on a timer/refresh) to pick up
// members who published a public key after the chat key was first created. Requires the caller
// to already have their own wrap (skips silently if not -- they can't unwrap a key they can't
// read in the first place).
export async function rewrapChatKeyForMembers(
  chatId: string,
  memberIds: string[],
  identity: IdentityKeyPair,
  myUserId: string
): Promise<void> {
  const { data: active } = await supabase
    .from('chat_keys')
    .select('id, chat_key_members!inner(wrapped_key, user_id)')
    .eq('chat_id', chatId)
    .is('retired_at', null)
    .eq('chat_key_members.user_id', myUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!active) return;

  const myWrap = (active.chat_key_members as unknown as { wrapped_key: string }[])[0]?.wrapped_key;
  if (!myWrap) return;
  const key = unwrapKey(myWrap, identity);

  const { data: existingWraps } = await supabase
    .from('chat_key_members')
    .select('user_id')
    .eq('key_id', active.id);
  const alreadyWrapped = new Set((existingWraps ?? []).map((w) => w.user_id));

  const { data: users } = await supabase
    .from('users')
    .select('id, public_key')
    .in('id', memberIds.filter((id) => !alreadyWrapped.has(id)));

  const newWraps = (users ?? [])
    .filter((u): u is { id: string; public_key: string } => !!u.public_key)
    .map((u) => ({ key_id: active.id, user_id: u.id, wrapped_key: wrapKey(key, u.public_key) }));

  if (newWraps.length > 0) {
    await supabase.from('chat_key_members').insert(newWraps);
  }
}

// Retires the chat's current key and creates a fresh one wrapped only for remainingMemberIds --
// called after removing a member. Old messages stay under the retired key (remaining members
// keep their old wrap rows, so history stays readable); the removed member can't read anything
// encrypted after this point since they never get a wrap for the new key.
export async function rotateChatKeyOnRemoval(
  chatId: string,
  remainingMemberIds: string[]
): Promise<ChatKeyHandle> {
  await supabase.from('chat_keys').update({ retired_at: new Date().toISOString() }).eq('chat_id', chatId).is('retired_at', null);

  const key = randombytes_buf(CHAT_KEY_BYTES);
  const { data: keyRow, error } = await supabase
    .from('chat_keys')
    .insert({ chat_id: chatId })
    .select('id')
    .single();
  if (error || !keyRow) throw error ?? new Error('Failed to rotate chat key');

  const { data: users } = await supabase.from('users').select('id, public_key').in('id', remainingMemberIds);
  const wraps = (users ?? [])
    .filter((u): u is { id: string; public_key: string } => !!u.public_key)
    .map((u) => ({ key_id: keyRow.id, user_id: u.id, wrapped_key: wrapKey(key, u.public_key) }));

  if (wraps.length > 0) {
    await supabase.from('chat_key_members').insert(wraps);
  }

  return { keyId: keyRow.id, key };
}
