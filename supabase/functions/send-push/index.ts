// Supabase Edge Function: fires on new `messages` rows (via a Database Webhook)
// and sends an Expo push notification to every non-muted chat member except the
// sender. Deploy with `supabase functions deploy send-push`, then wire up the
// webhook — see README.md "Push notifications" section.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    chat_id: string;
    sender_id: string;
    body: string | null;
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload;
  if (payload.table !== 'messages' || payload.type !== 'INSERT') {
    return new Response('ignored', { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { record } = payload;

  const [{ data: sender }, { data: chat }, { data: recipients }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', record.sender_id).single(),
    supabase.from('chats').select('type, name').eq('id', record.chat_id).single(),
    supabase
      .from('chat_members')
      .select('user_id, muted, users(push_token)')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id)
      .eq('muted', false),
  ]);

  const tokens = (recipients ?? [])
    .map((r) => (r.users as unknown as { push_token: string | null } | null)?.push_token)
    .filter((t): t is string => !!t);

  if (tokens.length === 0) {
    return new Response('no recipients', { status: 200 });
  }

  const senderName = sender?.display_name ?? 'Someone';
  const title = chat?.type === 'group' ? `${senderName} in ${chat?.name ?? 'group'}` : senderName;
  const body = record.body ?? 'Sent an attachment';

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    data: { chatId: record.chat_id },
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  return new Response('ok', { status: 200 });
});
