import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useChatList(userId: string | null) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`chat-list-updates-${++channelSeq}`);

  const load = useCallback(async () => {
    if (!userId) return;

    const { data: rows, error } = await supabase.rpc('get_chat_list');
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
      };
    });

    setChats(items);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { chats, loading, refresh: load };
}
