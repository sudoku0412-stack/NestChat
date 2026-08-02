import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import type { ChatMembersRow, MessageMediaRow, MessagesRow } from '../database.types';
import type { Member, MessageWithMedia } from '../types';

let channelSeq = 0;

export function useMessages(chatId: string, userId: string | null) {
  const [messages, setMessages] = useState<MessageWithMedia[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberStates, setMemberStates] = useState<ChatMembersRow[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`chat-${chatId}-${++channelSeq}`);
  const lastMarkedIdRef = useRef<string | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const load = useCallback(async () => {
    const [{ data: msgRows }, { data: mediaRows }, { data: memberRows }] = await Promise.all([
      supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at'),
      supabase
        .from('message_media')
        .select('*, messages!inner(chat_id)')
        .eq('messages.chat_id', chatId),
      supabase.from('chat_members').select('*, users(*)').eq('chat_id', chatId),
    ]);

    const mediaByMessage = new Map<string, MessageMediaRow[]>();
    for (const row of (mediaRows as (MessageMediaRow & { messages: unknown })[]) ?? []) {
      const list = mediaByMessage.get(row.message_id) ?? [];
      list.push(row);
      mediaByMessage.set(row.message_id, list);
    }

    const memberList: Member[] = [];
    const states: ChatMembersRow[] = [];
    for (const row of memberRows ?? []) {
      const user = row.users as unknown as Member | null;
      if (user) memberList.push(user);
      states.push(row as ChatMembersRow);
    }
    setMembers(memberList);
    setMemberStates(states);

    const rows = (msgRows as MessagesRow[]) ?? [];
    setMessages(
      rows.map((m) => ({
        ...m,
        media: mediaByMessage.get(m.id) ?? [],
      }))
    );
    setLoading(false);

    const newestId = rows[rows.length - 1]?.id ?? null;
    if (userId && newestId && newestId !== lastMarkedIdRef.current) {
      lastMarkedIdRef.current = newestId;
      const { error } = await supabase.rpc('mark_chat_read', { p_chat_id: chatId });
      if (error) console.warn('mark_chat_read failed', error.message);
    }
  }, [chatId, userId]);

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
      console.log(
        '[realtime:messages] subscribing, token expires_at',
        sessionData.session?.expires_at,
        'now',
        Math.floor(Date.now() / 1000)
      );
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`${channelName.current}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload) => {
            console.log('[realtime:messages] event received', payload.eventType);
            load();
          }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_media' }, load)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` },
          load
        )
        .subscribe((status, err) => {
          console.log('[realtime:messages] channel status', status, err?.message, 'for chat', chatId);
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (cancelled) return;
            const delay = Math.min(30000, 1000 * 2 ** attempt);
            attempt += 1;
            console.warn('[realtime:messages] channel dropped, retrying in', delay, 'ms', status);
            if (channel) supabase.removeChannel(channel);
            retryTimer = setTimeout(subscribe, delay);
          }
        });
    }

    subscribe();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    // Belt-and-suspenders: poll while the chat is open so it stays correct
    // even if the realtime channel above never delivers an event.
    const pollId = setInterval(load, 4000);

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearInterval(pollId);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [chatId, userId, load]);

  const otherMemberStates = memberStates.filter((s) => s.user_id !== userId);

  function isReadByOthers(message: MessagesRow) {
    if (otherMemberStates.length === 0) return false;
    return otherMemberStates.every((state) => {
      if (!state.last_read_message_id) return false;
      const readUpTo = messages.find((m) => m.id === state.last_read_message_id);
      if (!readUpTo) return false;
      return new Date(readUpTo.created_at) >= new Date(message.created_at);
    });
  }

  return {
    messages,
    members,
    membersById,
    loading,
    refresh: load,
    isReadByOthers,
  };
}
