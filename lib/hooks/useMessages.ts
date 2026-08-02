import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

    setMessages(
      ((msgRows as MessagesRow[]) ?? []).map((m) => ({
        ...m,
        media: mediaByMessage.get(m.id) ?? [],
      }))
    );
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        load
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_media' }, load)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` },
        load
      )
      .subscribe();

    // Mark as read on open; harmless to call again on subsequent updates.
    supabase.rpc('mark_chat_read', { p_chat_id: chatId });

    return () => {
      supabase.removeChannel(channel);
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
