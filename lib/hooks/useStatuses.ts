import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import type { StatusesRow } from '../database.types';
import type { Member } from '../types';

export interface StatusGroup {
  user: Member;
  statuses: StatusesRow[];
  hasUnviewed: boolean;
  latestAt: string;
}

let channelSeq = 0;

export function useStatuses(userId: string | null) {
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [myStatuses, setMyStatuses] = useState<StatusesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`status-updates-${++channelSeq}`);

  const load = useCallback(async () => {
    if (!userId) return;

    const [{ data: statusRows }, { data: viewedRows }] = await Promise.all([
      supabase
        .from('statuses')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true }),
      supabase.from('status_views').select('status_id').eq('viewer_id', userId),
    ]);

    const viewedIds = new Set((viewedRows ?? []).map((v) => v.status_id));
    const rows = (statusRows as StatusesRow[]) ?? [];

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: userRows } =
      userIds.length > 0
        ? await supabase.from('users').select('*').in('id', userIds)
        : { data: [] as Member[] };
    const usersById = new Map((userRows as Member[] | null ?? []).map((u) => [u.id, u]));

    const byUser = new Map<string, { user: Member; statuses: StatusesRow[] }>();
    for (const status of rows) {
      const user = usersById.get(status.user_id);
      if (!user) continue;
      const entry = byUser.get(user.id) ?? { user, statuses: [] };
      entry.statuses.push(status);
      byUser.set(user.id, entry);
    }

    const own: StatusesRow[] = byUser.get(userId)?.statuses ?? [];
    byUser.delete(userId);

    const nextGroups: StatusGroup[] = Array.from(byUser.values())
      .map(({ user, statuses }) => ({
        user,
        statuses,
        hasUnviewed: statuses.some((s) => !viewedIds.has(s.id)),
        latestAt: statuses[statuses.length - 1]?.created_at ?? '',
      }))
      .sort((a, b) => {
        if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
        return b.latestAt.localeCompare(a.latestAt);
      });

    setGroups(nextGroups);
    setMyStatuses(own);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_views' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { groups, myStatuses, loading, refresh: load };
}
