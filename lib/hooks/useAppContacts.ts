import { useCallback, useEffect, useState } from 'react';
import { loadDeviceContacts, phoneMatchKey } from '../contacts';
import { useMembers } from './useMembers';
import type { Member } from '../types';

export interface MatchedContact {
  key: string;
  displayName: string;
  member: Member;
}

export interface UnmatchedContact {
  key: string;
  displayName: string;
}

interface AppContactsResult {
  onNestChat: MatchedContact[];
  alsoOnNestChat: MatchedContact[];
  inviteOnly: UnmatchedContact[];
  loading: boolean;
  permissionDenied: boolean;
  retry: () => void;
}

export function useAppContacts(excludeUserId?: string | null): AppContactsResult {
  const { members, loading: membersLoading } = useMembers(excludeUserId);
  const [onNestChat, setOnNestChat] = useState<MatchedContact[]>([]);
  const [alsoOnNestChat, setAlsoOnNestChat] = useState<MatchedContact[]>([]);
  const [inviteOnly, setInviteOnly] = useState<UnmatchedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (membersLoading) return;

    let active = true;
    setLoading(true);

    loadDeviceContacts().then((deviceContacts) => {
      if (!active) return;

      if (deviceContacts === null) {
        setPermissionDenied(true);
        setOnNestChat([]);
        setAlsoOnNestChat(
          members.map((m) => ({ key: m.id, displayName: m.display_name, member: m }))
        );
        setInviteOnly([]);
        setLoading(false);
        return;
      }
      setPermissionDenied(false);

      const usersByPhoneKey = new Map<string, Member>();
      for (const m of members) {
        const key = phoneMatchKey(m.phone);
        if (key) usersByPhoneKey.set(key, m);
      }

      const matched: MatchedContact[] = [];
      const matchedUserIds = new Set<string>();
      const unmatched: UnmatchedContact[] = [];

      for (const contact of deviceContacts) {
        const hit = contact.phoneKeys.map((k) => usersByPhoneKey.get(k)).find(Boolean);
        if (hit) {
          if (!matchedUserIds.has(hit.id)) {
            matchedUserIds.add(hit.id);
            matched.push({ key: hit.id, displayName: contact.name, member: hit });
          }
        } else {
          unmatched.push({ key: `${contact.name}-${contact.phoneKeys[0]}`, displayName: contact.name });
        }
      }

      const also = members
        .filter((m) => !matchedUserIds.has(m.id))
        .map((m) => ({ key: m.id, displayName: m.display_name, member: m }));

      matched.sort((a, b) => a.displayName.localeCompare(b.displayName));
      also.sort((a, b) => a.displayName.localeCompare(b.displayName));
      unmatched.sort((a, b) => a.displayName.localeCompare(b.displayName));

      setOnNestChat(matched);
      setAlsoOnNestChat(also);
      setInviteOnly(unmatched.slice(0, 200));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [members, membersLoading, attempt]);

  return { onNestChat, alsoOnNestChat, inviteOnly, loading: loading || membersLoading, permissionDenied, retry };
}
