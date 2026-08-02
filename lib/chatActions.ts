import { supabase } from './supabase';
import { uploadMedia, type PickedAsset } from './media';
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

export async function sendTextMessage(
  chatId: string,
  senderId: string,
  body: string,
  id: string = generateId()
): Promise<MessagesRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ id, chat_id: chatId, sender_id: senderId, body })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to send message');
  return data as MessagesRow;
}

export async function sendMediaMessage(chatId: string, senderId: string, asset: PickedAsset) {
  const { data: message, error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, body: null })
    .select()
    .single();
  if (error || !message) throw error ?? new Error('Failed to create message');

  try {
    const uploaded = await uploadMedia(chatId, message.id, asset);
    const { error: mediaError } = await supabase.from('message_media').insert({
      message_id: message.id,
      kind: uploaded.kind,
      storage_path: uploaded.storagePath,
      width: uploaded.width,
      height: uploaded.height,
      duration_seconds: uploaded.durationSeconds,
    });
    if (mediaError) throw mediaError;
  } catch (err) {
    // Upload failed — remove the empty message rather than leaving a dangling bubble.
    await supabase.from('messages').delete().eq('id', message.id);
    throw err;
  }
}

export async function softDeleteMessage(messageId: string) {
  await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId);
}
