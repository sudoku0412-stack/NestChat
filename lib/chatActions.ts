import { supabase } from './supabase';
import { readAssetBytes, uploadMediaBytes, type PickedAsset } from './media';
import {
  SEND_ENCRYPTED,
  encryptFileBuffer,
  encryptMessageText,
  getIdentityKeyPair,
  getOrCreateChatKey,
} from './crypto';
import type { MessagesRow } from './database.types';

// Math.random-based v4 UUID — good enough for a client-generated primary key
// (lets the UI render the sent message before the insert round-trips back).
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Falls back to plaintext (returns null) if SEND_ENCRYPTED is off or this device has no identity
// key yet (shouldn't happen post-onboarding, but sending must never hard-fail because of it).
async function maybeEncryptText(chatId: string, senderId: string, messageId: string, text: string) {
  if (!SEND_ENCRYPTED) return null;
  const identity = await getIdentityKeyPair();
  if (!identity) return null;
  return encryptMessageText({ chatId, messageId, senderId, text, identity });
}

export async function sendTextMessage(
  chatId: string,
  senderId: string,
  body: string,
  id: string = generateId(),
  replyToMessageId: string | null = null
): Promise<MessagesRow> {
  const encrypted = await maybeEncryptText(chatId, senderId, id, body);
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id,
      chat_id: chatId,
      sender_id: senderId,
      body: encrypted ? null : body,
      reply_to_message_id: replyToMessageId,
      ...(encrypted ?? {}),
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to send message');
  return data as MessagesRow;
}

// Id is generated client-side (like sendTextMessage) so the upload can happen *before* any DB
// row exists -- if the upload fails, there's simply nothing to insert or clean up, unlike the
// old flow which created a placeholder message row first and had to explicitly delete it on
// failure. Also required for encryption: the file key gets wrapped with the chat key, and that
// wrap's AEAD additional-data binds it to this specific message id (see lib/crypto/media.ts) --
// something to bind to has to exist before encrypting, and a DB round-trip for it would defeat
// the point of generating ids client-side in the first place.
export async function sendMediaMessage(
  chatId: string,
  senderId: string,
  asset: PickedAsset
): Promise<{ id: string }> {
  const messageId = generateId();
  const { asset: prepared, bytes } = await readAssetBytes(asset);

  let uploadBytes: ArrayBuffer | Uint8Array = bytes;
  let keyId: string | null = null;
  let wrappedKey: string | null = null;

  if (SEND_ENCRYPTED) {
    const identity = await getIdentityKeyPair();
    if (identity) {
      const chatKeyHandle = await getOrCreateChatKey(chatId, senderId, identity);
      const encrypted = encryptFileBuffer(bytes, chatKeyHandle.key, chatId, messageId, chatKeyHandle.keyId);
      uploadBytes = encrypted.encryptedBytes;
      wrappedKey = encrypted.wrappedKey;
      keyId = chatKeyHandle.keyId;
    }
  }

  const uploaded = await uploadMediaBytes(chatId, messageId, prepared, uploadBytes, {
    encrypted: !!wrappedKey,
  });

  const { error: messageError } = await supabase
    .from('messages')
    .insert({ id: messageId, chat_id: chatId, sender_id: senderId, body: null, key_id: keyId });
  if (messageError) {
    await supabase.storage.from('chat-media').remove([uploaded.storagePath]);
    throw messageError;
  }

  const { error: mediaError } = await supabase.from('message_media').insert({
    message_id: messageId,
    kind: uploaded.kind,
    storage_path: uploaded.storagePath,
    width: uploaded.width,
    height: uploaded.height,
    duration_seconds: uploaded.durationSeconds,
    file_name: uploaded.fileName,
    file_size: uploaded.fileSize,
    wrapped_key: wrappedKey,
  });
  if (mediaError) {
    await supabase.from('messages').delete().eq('id', messageId);
    await supabase.storage.from('chat-media').remove([uploaded.storagePath]);
    throw mediaError;
  }

  return { id: messageId };
}

export async function softDeleteMessage(messageId: string) {
  await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId);
}

// Personal to the caller — hides messages sent before now for them only, never deletes anything
// the other person can see. Always scoped by user_id: chat_members_update_comember lets any
// co-member update any row in the chat, so an unscoped update could clear someone else's view.
export async function clearChat(chatId: string, userId: string) {
  await supabase
    .from('chat_members')
    .update({ cleared_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
}

export async function setChatWallpaper(chatId: string, userId: string, path: string | null) {
  await supabase
    .from('chat_members')
    .update({ wallpaper_path: path })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
}

// Shared/visible-to-everyone-in-the-chat, unlike starMessage below — matches
// chats_update_member's existing "any co-member can update" model.
export async function setPinnedMessage(chatId: string, messageId: string | null) {
  await supabase.from('chats').update({ pinned_message_id: messageId }).eq('id', chatId);
}

export async function starMessage(messageId: string, userId: string) {
  await supabase.from('message_stars').insert({ message_id: messageId, user_id: userId });
}

export async function unstarMessage(messageId: string, userId: string) {
  await supabase.from('message_stars').delete().eq('message_id', messageId).eq('user_id', userId);
}

// One reaction per user per message -- setting a new emoji replaces whatever was there before.
export async function setMessageReaction(messageId: string, userId: string, emoji: string) {
  await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' });
}

export async function clearMessageReaction(messageId: string, userId: string) {
  await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId);
}
