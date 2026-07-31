import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { Member } from '../types';

export function useMembers(excludeUserId?: string | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from('users').select('*').order('display_name');
      if (!active) return;
      setMembers(((data as Member[]) ?? []).filter((m) => m.id !== excludeUserId));
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('members-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [excludeUserId]);

  return { members, loading };
}
