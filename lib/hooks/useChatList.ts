import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import type { ChatListItem, Member } from '../types';

function previewFor(row: {
  last_message_body: string | null;
  last_message_has_media: boolean;
  last_message_deleted: boolean;
}) {
  if (row.last_message_deleted) return 'This message was deleted';
  if (row.last_message_body) return row.last_message_body;
  if (row.last_message_has_media) return 'Photo · attachment';
  return 'No messages yet';
}

let channelSeq = 0;

export function useChatList(userId: string | null, options: { archived?: boolean } = {}) {
  const { archived = false } = options;
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`chat-list-updates-${++channelSeq}`);

  const load = useCallback(async () => {
    if (!userId) return;

    const { data: rows, error } = await supabase.rpc('get_chat_list', { p_archived: archived });
    if (error) {
      console.warn('get_chat_list failed', error.message);
      setLoading(false);
      return;
    }

    const chatIds = (rows ?? []).map((r) => r.chat_id);
    let membersByChat = new Map<string, Member[]>();

    if (chatIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('chat_members')
        .select('chat_id, users(*)')
        .in('chat_id', chatIds);

      for (const row of memberRows ?? []) {
        const user = row.users as unknown as Member | null;
        if (!user) continue;
        const list = membersByChat.get(row.chat_id) ?? [];
        list.push(user);
        membersByChat.set(row.chat_id, list);
      }
    }

    const items: ChatListItem[] = (rows ?? []).map((row) => {
      const members = (membersByChat.get(row.chat_id) ?? []).filter((m) => m.id !== userId);
      const title =
        row.type === 'group' ? row.name ?? 'Unnamed group' : members[0]?.display_name ?? 'Unknown';

      return {
        id: row.chat_id,
        type: row.type,
        title,
        avatarMembers: row.type === 'group' ? members : members.slice(0, 1),
        lastMessagePreview: previewFor(row),
        lastMessageAt: row.last_message_at,
        unreadCount: row.unread_count,
        muted: row.muted,
        archived: row.archived,
        favorite: row.favorite,
      };
    });

    setChats(items);
    setLoading(false);
  }, [userId, archived]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    async function subscribe() {
      // Refresh the realtime socket's auth before every (re)subscribe — a
      // stale/expired access token makes the server close the channel
      // immediately, which otherwise looks identical to a network drop.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`${channelName.current}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, load)
        .subscribe((status, err) => {
          console.log('[realtime:chat-list] channel status', status, err?.message);
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (cancelled) return;
            const delay = Math.min(30000, 1000 * 2 ** attempt);
            attempt += 1;
            console.warn('[realtime:chat-list] channel dropped, retrying in', delay, 'ms', status);
            if (channel) supabase.removeChannel(channel);
            retryTimer = setTimeout(subscribe, delay);
          }
        });
    }

    subscribe();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    // Belt-and-suspenders: poll while the list is mounted so unread counts
    // stay correct even if the realtime channel above never delivers an event.
    const pollId = setInterval(load, 6000);

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearInterval(pollId);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { chats, loading, refresh: load };
}
