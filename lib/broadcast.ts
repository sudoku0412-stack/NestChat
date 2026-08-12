import { supabase } from './supabase';
import { sendTextMessage, sendMediaMessage } from './chatActions';
import type { PickedAsset } from './media';

export interface BroadcastResult {
  sent: number;
  failed: { recipientId: string; error: unknown }[];
}

// Fan-out is client-orchestrated, never a server RPC -- E2EE wraps happen per-chat on-device
// (find_or_create_dm + sendTextMessage/sendMediaMessage, unchanged), so there's no server-side
// loop that could do this instead. Each recipient's send is independent (try/catch per
// iteration) so one recipient without a published public_key yet doesn't sink the rest.
async function forEachRecipient(
  recipientIds: string[],
  senderId: string,
  listId: string | null,
  sendOne: (chatId: string) => Promise<{ id: string }>
): Promise<BroadcastResult> {
  const { data: sendRow, error } = await supabase
    .from('broadcast_sends')
    .insert({ sender_id: senderId, list_id: listId })
    .select('id')
    .single();
  if (error || !sendRow) throw error ?? new Error('Failed to start broadcast');

  const failed: { recipientId: string; error: unknown }[] = [];
  let sent = 0;

  for (const recipientId of recipientIds) {
    try {
      const { data: chatId, error: dmError } = await supabase.rpc('find_or_create_dm', {
        other_user_id: recipientId,
      });
      if (dmError || !chatId) throw dmError ?? new Error('find_or_create_dm failed');

      const message = await sendOne(chatId);

      await supabase.from('broadcast_send_targets').insert({
        send_id: sendRow.id,
        recipient_id: recipientId,
        chat_id: chatId,
        message_id: message.id,
      });
      sent++;
    } catch (err) {
      failed.push({ recipientId, error: err });
    }
  }

  return { sent, failed };
}

export async function sendBroadcastText(
  recipientIds: string[],
  senderId: string,
  body: string,
  listId: string | null = null
): Promise<BroadcastResult> {
  return forEachRecipient(recipientIds, senderId, listId, (chatId) => sendTextMessage(chatId, senderId, body));
}

export async function sendBroadcastMedia(
  recipientIds: string[],
  senderId: string,
  asset: PickedAsset,
  listId: string | null = null
): Promise<BroadcastResult> {
  return forEachRecipient(recipientIds, senderId, listId, (chatId) => sendMediaMessage(chatId, senderId, asset));
}
