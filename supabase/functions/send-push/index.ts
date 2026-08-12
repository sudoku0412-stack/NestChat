// Supabase Edge Function driven by three separate Database Webhooks (see README.md "Push
// notifications" section for the exact dashboard steps):
//   - messages       INSERT  -- text messages only (media messages have body = null at insert
//                                time, since sendMediaMessage creates the placeholder row before
//                                the upload finishes; message_media's own webhook below covers
//                                those instead so the notification always describes real content)
//   - message_media  INSERT  -- photo/video/document/gif/sticker messages, once the media row
//                                (and therefore its `kind`) actually exists
//   - message_reactions INSERT/UPDATE -- notifies the *original message's sender* that someone
//                                reacted, never the reactor themselves

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mediaKindLabel(senderName: string, kind: string, fileName: string | null) {
  switch (kind) {
    case 'photo':
      return `${senderName} sent you a photo`;
    case 'video':
      return `${senderName} sent you a video`;
    case 'gif':
      return `${senderName} sent you a GIF`;
    case 'sticker':
      return `${senderName} sent you a sticker`;
    case 'document':
      return `${senderName} sent you a document: ${fileName || 'Document'}`;
    default:
      return `${senderName} sent you an attachment`;
  }
}

async function sendExpoPush(messages: Record<string, unknown>[]) {
  if (messages.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
}

async function handleMessageInsert(record: {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  enc_v: number | null;
}) {
  // body = null happens for two different reasons that need different handling:
  //  - a media placeholder row (enc_v also null) -- message_media's own insert fires its own
  //    webhook (handleMediaInsert below) once the real kind/body exists, so skip here rather than
  //    sending a premature "Sent an attachment" notification.
  //  - an encrypted text message (enc_v set, body intentionally never written in plaintext) --
  //    the server can't decrypt it to build real notification text, so send a generic body
  //    instead of skipping outright (skipping would mean encrypted chats never notify at all).
  if (record.body === null && record.enc_v === null) {
    return new Response('skip: media pending', { status: 200 });
  }

  const [{ data: sender }, { data: chat }, { data: recipients }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', record.sender_id).single(),
    supabase.from('chats').select('type, name').eq('id', record.chat_id).single(),
    supabase
      .from('chat_members')
      .select('user_id, muted, users(push_token, notify_messages)')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id)
      .eq('muted', false),
  ]);

  const tokens = (recipients ?? [])
    .map((r) => r.users as unknown as { push_token: string | null; notify_messages: boolean } | null)
    .filter((u): u is { push_token: string; notify_messages: boolean } => !!u?.push_token && u.notify_messages)
    .map((u) => u.push_token);
  if (tokens.length === 0) return new Response('no recipients', { status: 200 });

  const senderName = sender?.display_name ?? 'Someone';
  const title = chat?.type === 'group' ? `${senderName} in ${chat?.name ?? 'group'}` : senderName;

  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title,
      body: record.body ?? 'New message',
      sound: 'default',
      data: { chatId: record.chat_id, messageId: record.id },
    }))
  );
  return new Response('ok', { status: 200 });
}

async function handleMediaInsert(record: {
  message_id: string;
  kind: string;
  file_name: string | null;
}) {
  const { data: message } = await supabase
    .from('messages')
    .select('id, chat_id, sender_id')
    .eq('id', record.message_id)
    .single();
  if (!message) return new Response('message not found', { status: 200 });

  const [{ data: sender }, { data: chat }, { data: recipients }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', message.sender_id).single(),
    supabase.from('chats').select('type, name').eq('id', message.chat_id).single(),
    supabase
      .from('chat_members')
      .select('user_id, muted, users(push_token, notify_media)')
      .eq('chat_id', message.chat_id)
      .neq('user_id', message.sender_id)
      .eq('muted', false),
  ]);

  const tokens = (recipients ?? [])
    .map((r) => r.users as unknown as { push_token: string | null; notify_media: boolean } | null)
    .filter((u): u is { push_token: string; notify_media: boolean } => !!u?.push_token && u.notify_media)
    .map((u) => u.push_token);
  if (tokens.length === 0) return new Response('no recipients', { status: 200 });

  const senderName = sender?.display_name ?? 'Someone';
  const title = chat?.type === 'group' ? `${senderName} in ${chat?.name ?? 'group'}` : senderName;

  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title,
      body: mediaKindLabel(senderName, record.kind, record.file_name),
      sound: 'default',
      data: { chatId: message.chat_id, messageId: message.id },
    }))
  );
  return new Response('ok', { status: 200 });
}

async function handleReactionUpsert(record: { message_id: string; user_id: string; emoji: string }) {
  const { data: message } = await supabase
    .from('messages')
    .select('id, chat_id, sender_id')
    .eq('id', record.message_id)
    .single();
  if (!message) return new Response('message not found', { status: 200 });

  // Don't notify someone for reacting to their own message.
  if (message.sender_id === record.user_id) return new Response('self-reaction, skipped', { status: 200 });

  const [{ data: reactor }, { data: recipientMember }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', record.user_id).single(),
    supabase
      .from('chat_members')
      .select('muted, users(push_token, notify_reactions)')
      .eq('chat_id', message.chat_id)
      .eq('user_id', message.sender_id)
      .single(),
  ]);

  if (recipientMember?.muted) return new Response('chat muted, skipped', { status: 200 });
  const recipientUser = recipientMember?.users as unknown as
    | { push_token: string | null; notify_reactions: boolean }
    | null;
  if (!recipientUser?.notify_reactions) return new Response('reactions muted, skipped', { status: 200 });
  const token = recipientUser.push_token;
  if (!token) return new Response('no push token', { status: 200 });

  const reactorName = reactor?.display_name ?? 'Someone';

  await sendExpoPush([
    {
      to: token,
      title: reactorName,
      body: `${reactorName} reacted ${record.emoji} to your message`,
      sound: 'default',
      data: { chatId: message.chat_id, messageId: message.id },
    },
  ]);
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload;

  if (payload.table === 'messages' && payload.type === 'INSERT') {
    return handleMessageInsert(
      payload.record as {
        id: string;
        chat_id: string;
        sender_id: string;
        body: string | null;
        enc_v: number | null;
      }
    );
  }

  if (payload.table === 'message_media' && payload.type === 'INSERT') {
    return handleMediaInsert(
      payload.record as { message_id: string; kind: string; file_name: string | null }
    );
  }

  if (payload.table === 'message_reactions' && (payload.type === 'INSERT' || payload.type === 'UPDATE')) {
    return handleReactionUpsert(payload.record as { message_id: string; user_id: string; emoji: string });
  }

  return new Response('ignored', { status: 200 });
});
