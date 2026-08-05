import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import type {
  ChatMembersRow,
  LiveLocationsRow,
  MessageMediaRow,
  MessageReactionsRow,
  MessagesRow,
} from '../database.types';
import type { Member, MessageReactionSummary, MessageWithMedia } from '../types';

let channelSeq = 0;

export function useMessages(chatId: string, userId: string | null) {
  const [messages, setMessages] = useState<MessageWithMedia[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberStates, setMemberStates] = useState<ChatMembersRow[]>([]);
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`chat-${chatId}-${++channelSeq}`);
  const lastMarkedIdRef = useRef<string | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const load = useCallback(async () => {
    const [
      { data: msgRows },
      { data: mediaRows },
      { data: memberRows },
      { data: locationRows },
      { data: starRows },
      { data: reactionRows },
    ] = await Promise.all([
      supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at'),
      supabase
        .from('message_media')
        .select('*, messages!inner(chat_id)')
        .eq('messages.chat_id', chatId),
      supabase.from('chat_members').select('*, users(*)').eq('chat_id', chatId),
      supabase.from('live_locations').select('*').eq('chat_id', chatId),
      supabase.from('message_stars').select('message_id').eq('user_id', userId ?? ''),
      supabase
        .from('message_reactions')
        .select('*, messages!inner(chat_id)')
        .eq('messages.chat_id', chatId),
    ]);

    setStarredMessageIds(new Set((starRows ?? []).map((r) => r.message_id)));

    const mediaByMessage = new Map<string, MessageMediaRow[]>();
    for (const row of (mediaRows as (MessageMediaRow & { messages: unknown })[]) ?? []) {
      const list = mediaByMessage.get(row.message_id) ?? [];
      list.push(row);
      mediaByMessage.set(row.message_id, list);
    }

    const reactionsByMessage = new Map<string, MessageReactionSummary[]>();
    for (const row of (reactionRows as (MessageReactionsRow & { messages: unknown })[]) ?? []) {
      const summaries = reactionsByMessage.get(row.message_id) ?? [];
      const existing = summaries.find((s) => s.emoji === row.emoji);
      if (existing) {
        existing.count += 1;
        existing.reactedByMe = existing.reactedByMe || row.user_id === userId;
      } else {
        summaries.push({ emoji: row.emoji, count: 1, reactedByMe: row.user_id === userId });
      }
      reactionsByMessage.set(row.message_id, summaries);
    }

    const locationById = new Map<string, LiveLocationsRow>();
    for (const row of (locationRows as LiveLocationsRow[]) ?? []) {
      locationById.set(row.id, row);
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

    // "Clear chat" hides messages sent before the caller cleared it — for them only, since
    // cleared_at lives on their own chat_members row, not the shared chats/messages rows.
    const ownState = states.find((s) => s.user_id === userId) ?? null;
    const clearedAt = ownState?.cleared_at ? new Date(ownState.cleared_at).getTime() : null;

    const rows = ((msgRows as MessagesRow[]) ?? []).filter(
      (m) => clearedAt === null || new Date(m.created_at).getTime() > clearedAt
    );

    // Reply quotes are resolved client-side from the same message list already fetched above —
    // matches this hook's existing convention of joining in JS rather than via a nested select.
    const byId = new Map<string, MessagesRow>();
    for (const m of rows) byId.set(m.id, m);

    setMessages(
      rows.map((m) => {
        const repliedTo = m.reply_to_message_id ? byId.get(m.reply_to_message_id) : null;
        return {
          ...m,
          media: mediaByMessage.get(m.id) ?? [],
          liveLocation: m.location_share_id ? locationById.get(m.location_share_id) ?? null : null,
          replyTo: repliedTo ? { ...repliedTo, media: [], replyTo: null } : null,
          reactions: reactionsByMessage.get(m.id) ?? [],
        };
      })
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, load)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` },
          load
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'live_locations', filter: `chat_id=eq.${chatId}` },
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
  const ownMembership = memberStates.find((s) => s.user_id === userId) ?? null;

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
    ownMembership,
    starredMessageIds,
  };
}
